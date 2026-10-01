/**
 * Tính màu sắc theo dữ liệu tần số (getComputedColor) & cập nhật bảng thống kê BPM / Pitch / Energy.
 *
 * [SỬA — 01/10/2026] Các số liệu chung (beatScale/smoothedEnergy/energy/flux/beat/BPM) nay tính trên phổ PHÂN TÍCH cố định
 * (`analysisSpectrumArray`, analyserPitch FFT 2048) thay vì phổ vẽ `vizDataArray` (fftSize đổi theo effect) — cùng 1 bài
 * cho cùng số liệu dù đang chọn effect nào. BPM: xem core/audio-tempo.js.
 * [SỬA — 28/09/2026, Phase 2 dọn visualizer] `updateStatsDashboard()` ĐÃ XOÁ — tách thành các Core thuần
 * ở cuối file (energy/flux/beat/BPM/pitch/chữ hiển thị/ghi DOM), điều phối dời sang
 * event/workflow/audio-analysis.js. Spectral flux giờ quy về thang 128 bin (hết lệch độ nhạy beat giữa
 * effect FFT 256 và FFT 2048). Biến toàn cục `lastBeatTime`/`runningFluxMean`/`noteNames` (core/dom-refs.js)
 * đã bỏ — mốc beat đọc từ appState `lastBeatTime`, bảng tên nốt là MIDI_NOTE_NAMES bên dưới.
 * Ghi chú FIX ver 10 phía dưới (bọc isStatsPanelVisible) vẫn đúng tinh thần: chỉ phần ghi DOM bị bỏ qua khi
 * dải số liệu ẩn, phần tính toán luôn chạy — nay nằm ở guard của workflowAudioAnalysis._paintStats().
 * (Trích từ file gốc, dòng 1016-1065 trong khối <script>)
 *
 * FIX (ver 10 refine, bổ sung — toggle ẩn/hiện dải BPM/Pitch/Energy, xem core/visualizer-ui-
 * visibility.js): mọi dòng ghi statBpm/statNote/statEnergy.textContent dưới đây đều bọc thêm điều
 * kiện `isStatsPanelVisible &&` ở ĐẦU — khi dải bị ẩn, bỏ qua đúng phần thao tác DOM đó (đỡ work vô
 * nghĩa khi không ai nhìn thấy), nhưng KHÔNG đụng tới phần TÍNH TOÁN logic phía sau (beatTimes/
 * fluxHistory/currentCalculatedBpm/rubikPitchAvg...) — các giá trị này được visual Rubik dùng,
 * phải tiếp tục chạy đúng bất kể dải số liệu có hiện hay không.
 */
        /**
         * MỚI (20/07/2026, plan-space-galaxy.md Phần A, mục A3) — 3 hàm Core THUẦN tách ra từ
         * đoạn tính `beatScale`/`smoothedEnergy`/`globalHueOffset` TRƯỚC ĐÂY nằm thẳng trong vòng
         * lặp `drawVisualizer()` (core/visualizer/draw-visualizer.js, nay đã RỖNG — logic dời sang
         * `event/workflow/visualizer-render.js::_tick()`). Mỗi hàm 1 việc, CHỈ nhận tham số, KHÔNG
         * tự `appState.get()` (Rule 2) — Workflow tự đọc appState rồi truyền vào, tự
         * `appState.set(..., { skipCheck: true })` lại kết quả trả về (hot path 60fps, MIỄN Rule 4
         * console.log — đúng ngoại lệ đã ghi ở `core-function-conventions.md` Rule 4).
         */

        /** Trung bình biên độ dải bass (bassCount phần tử đầu của vizDataArray), chuẩn hoá 0-1. */
        function computeBeatScale(vizDataArray, bassCount) {
            let bassSum = 0;
            for (let i = 0; i < bassCount; i++) bassSum += vizDataArray[i];
            return (bassSum / bassCount) / 255;
        }

        /** Làm mượt beatScale theo thời gian (EMA hệ số 0.15) — dùng cho mọi hiệu ứng cần phản ứng
         * "mượt" với nhạc thay vì giật theo từng khung hình thô. */
        function computeSmoothedEnergy(beatScale, prevSmoothedEnergy) {
            return prevSmoothedEnergy + (beatScale - prevSmoothedEnergy) * 0.15;
        }

        /** Tiến hue-cycle 1 bước (chỉ khi đang phát) — guard clause thuần (KHÔNG phải rẽ nhánh 2
         * tiến trình khác nhau theo Rule 1: xoá nhánh `if` đi, hàm vẫn còn ĐÚNG 1 kịch bản "tiến
         * hue", chỉ mất phần "dừng sớm nếu không phát nhạc"). */
        function computeNextGlobalHueOffset(current, beatScale, isPlaying) {
            if (!isPlaying) return current;
            return (current + 0.5 + (beatScale * 5)) % 360;
        }

        // (getComputedColor() / getActiveBlurMult() — DỜI 01/10/2026 sang core/visualizer/effect-paint.js: tính màu/blur của
        // effect, không phải phân tích audio.)

        /** "Nhạc vừa biến động" — so trung bình `windowSize` MỐC/BEAT gần nhất với `windowSize`
         * mốc trước đó, lệch tương đối (không phải tuyệt đối — bất biến độ to nhỏ bài hát/thiết
         * bị) >= `relativeThreshold`. Gộp SẴN 2 cửa sổ (ngắn = build-up/drop nhanh, dài = chuyển
         * đoạn verse/chorus) — nơi gọi chỉ cần đưa energyWindowBeats/sectionWindowBeats/
         * fluxThreshold, không tự OR 2 lần riêng nữa. Dùng chung cho game mode Circle, Space,
         * Fireworks — mỗi nơi tự tích luỹ `beatFluxHistory` RIÊNG (không dùng chung mảng giữa các
         * domain — mỗi domain 1 nhịp tiêu thụ khác nhau).
         * @param {number[]} beatFluxHistory - mỗi phần tử = flux trung bình đoạn giữa 2 beat liên tiếp.
         * @param {number} energyWindowBeats - cửa sổ ngắn, số BEAT.
         * @param {number} sectionWindowBeats - cửa sổ dài, số BEAT.
         * @param {number} relativeThreshold - tỉ lệ lệch tối thiểu, vd 0.35 = lệch 35%.
         */
        function detectMusicTransition(beatFluxHistory, energyWindowBeats, sectionWindowBeats, relativeThreshold) {
            // SỬA (01/10/2026, dọn nợ core rule, Giang duyệt "xử lý toàn bộ") — bỏ 2 hàm con `avg`/`checkWindow` vi phạm
            // Rule 3c: `avg` trùng logic computeArrayMean() cùng file (3c-2), `checkWindow` không tự có vòng lặp (3c-1) và
            // gọi hàm con khác (3c-4). Viết thẳng 1 vòng lặp qua 2 cửa sổ. Không cần tính TRUNG BÌNH: 2 đoạn so sánh luôn
            // cùng độ dài `size`, nên |TB mới - TB cũ| / TB cũ = |tổng mới - tổng cũ| / tổng cũ — kết quả y hệt bản cũ,
            // chữ ký giữ nguyên (5 nơi gọi không đổi).
            const windowSizes = [energyWindowBeats, sectionWindowBeats];
            const len = beatFluxHistory.length;
            for (let w = 0; w < windowSizes.length; w++) {
                const size = windowSizes[w];
                if (len < size * 2) continue; // chưa đủ 2 đoạn để so
                let recentSum = 0, priorSum = 0;
                for (let i = len - size; i < len; i++) recentSum += beatFluxHistory[i];
                for (let i = len - size * 2; i < len - size; i++) priorSum += beatFluxHistory[i];
                if (priorSum <= 0) continue; // tránh chia 0 lúc đoạn trước hoàn toàn im lặng
                if (Math.abs(recentSum - priorSum) / priorSum >= relativeThreshold) return true;
            }
            return false;
        }

        /** Xấp xỉ ranh giới phrase bằng đếm beat cố định (không có phrase detection thật). Nơi gọi
         * tự đếm `beatsSincePhraseRefresh`, reset về 0 khi hàm này trả true. */
        function isPhraseBoundary(beatsSincePhraseRefresh, refreshBeatsForPhrase) {
            return beatsSincePhraseRefresh >= refreshBeatsForPhrase;
        }

        // =====================================================================================
        // [TÁCH — 28/09/2026, Phase 2 dọn visualizer, Giang duyệt] Thay `updateStatsDashboard()` cũ
        // (1 hàm di sản: 21 lần appState.get, tự ghi DOM, tự gọi requestPitchDetection() [nay workflowAudioEngine.requestPitch()], rẽ nhiều
        // tiến trình) bằng các Core THUẦN dưới đây — mỗi hàm 1 việc, chỉ nhận tham số, không đọc
        // appState, không gọi core khác. Điều phối (đọc state, chọn nhánh, ghi state, gọi pitch worker)
        // nằm ở event/workflow/audio-analysis.js (`workflowAudioAnalysis`).
        // =====================================================================================

        /** Số bin CHUẨN để quy đổi spectral flux. FFT 256 (128 bin) là kích thước mà ngưỡng
         * `AUDIO_FLUX_BEAT_FLOOR` từng được chỉnh tay — flux của FFT 2048 (1024 bin) được nhân
         * 128/1024 để cùng thang đo, beat/BPM không còn nhạy khác nhau theo effect đang chọn. */
        const AUDIO_FLUX_REFERENCE_BINS = 128;
        /** Sàn tuyệt đối để 1 frame được coi là beat (đơn vị: flux đã quy về 128 bin). */
        const AUDIO_FLUX_BEAT_FLOOR = 150;
        /** Flux phải vượt trung bình lịch sử gần nhất × hệ số này mới là beat. */
        const AUDIO_FLUX_BEAT_MEAN_RATIO = 1.3;
        /** Độ dài tối đa các lịch sử cuộn (giữ nguyên giá trị cũ). */
        const AUDIO_FLUX_HISTORY_MAX = 45;
        // (AUDIO_BEAT_INTERVALS_MAX, AUDIO_BPM_MIN/MAX — ĐÃ BỎ 01/10/2026 cùng computeBpmFromMeanInterval(): BPM nay ước lượng
        // bằng tự tương quan đường bao onset, xem core/audio-tempo.js.)
        const AUDIO_PITCH_HISTORY_MAX = 30;
        // (AUDIO_NOTE_HOLD_MS — DỜI 01/10/2026 sang core/visualizer/stats-bar.js cùng resolveNoteDisplayText().)
        /** MỚI (01/10/2026) — sau mỗi lần dòng thời gian bị ngắt (pause/seek/cổng seek/đổi bài/app ẩn) bỏ qua phát hiện beat
         * + đường bao tempo trong khoảng này: phổ đang dâng từ im lặng lên (analyser làm mượt 0.8/frame) sinh flux giả. */
        const ANALYSIS_SETTLE_MS = 250;
        /** 2 tick phân tích cách nhau quá khoảng này (app ẩn, máy treo) -> coi như dòng thời gian bị ngắt. */
        const ANALYSIS_TICK_GAP_MS = 500;
        const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        /** Năng lượng tổng phổ quy ra % (0-100) — y hệt công thức cũ (trung bình biên độ × 1.5). */
        function computeEnergyPercent(spectrum, binCount) {
            let total = 0;
            for (let i = 0; i < binCount; i++) total += spectrum[i];
            return Math.min(100, Math.round(((total / binCount) / 255) * 100 * 1.5));
        }

        /**
         * Spectral flux (tổng phần TĂNG biên độ so với frame trước), đã quy về thang
         * `AUDIO_FLUX_REFERENCE_BINS`. `baselineValid = false` (frame đầu tiên, hoặc vừa đổi fftSize —
         * mảng baseline mới cấp phát toàn 0) -> trả 0 thay vì 1 giá trị vọt lên giả tạo (trước đây frame
         * đầu sau khi đổi effect có flux = toàn bộ phổ, dễ sinh beat giả).
         */
        function computeNormalizedSpectralFlux(spectrum, prevSpectrum, binCount, baselineValid) {
            if (!baselineValid) return 0;
            let flux = 0;
            for (let i = 0; i < binCount; i++) flux += Math.max(0, spectrum[i] - prevSpectrum[i]);
            return flux * (AUDIO_FLUX_REFERENCE_BINS / binCount);
        }

        /** Chép phổ frame hiện tại vào mảng baseline (sửa tại chỗ mảng nhận vào) cho frame sau so. */
        function storeSpectrumBaseline(prevSpectrum, spectrum, binCount) {
            for (let i = 0; i < binCount; i++) prevSpectrum[i] = spectrum[i];
        }

        /** Trung bình cộng 1 mảng số — mảng rỗng trả 0. */
        function computeArrayMean(values) {
            if (values.length === 0) return 0;
            let sum = 0;
            for (let i = 0; i < values.length; i++) sum += values[i];
            return sum / values.length;
        }

        /** Frame này có phải 1 beat không: vượt trung bình động × hệ số, vượt sàn tuyệt đối, và đã qua
         * đủ `minWaitMs` kể từ beat trước (giữ nguyên 3 điều kiện cũ, chỉ đổi sang flux đã chuẩn hoá). */
        function isSpectralFluxBeat(flux, fluxMean, now, lastBeatTime, minWaitMs) {
            return flux > fluxMean * AUDIO_FLUX_BEAT_MEAN_RATIO
                && flux > AUDIO_FLUX_BEAT_FLOOR
                && (now - lastBeatTime) > minWaitMs;
        }

        /** Thêm 1 giá trị vào cuối mảng lịch sử (sửa tại chỗ) và cắt bớt đầu cho đủ `maxLen`. */
        function pushBoundedHistory(history, value, maxLen) {
            history.push(value);
            while (history.length > maxLen) history.shift();
        }

        // (computeBpmFromMeanInterval() — ĐÃ XOÁ 01/10/2026, thay bằng core/audio-tempo.js::estimateTempoFromOnsets().)

        /**
         * MỚI (01/10/2026) — Pha phát của media ĐỐI VỚI PHÂN TÍCH:
         *   'held'    — cổng seek đang giữ media (pause/nạp lại tạm) hoặc media đang seek: KHÔNG phải người dùng dừng, số
         *               liệu giữ nguyên (không nháy "---"), chỉ đánh dấu dòng thời gian bị ngắt.
         *   'playing' — đang phát thật (currentTime > 0, giữ điều kiện cũ).
         *   'stopped' — dừng thật / chưa phát.
         * @param {boolean} isHeld @param {boolean} isPaused @param {number} currentTime @returns {'held'|'playing'|'stopped'}
         */
        function resolveAnalysisPlaybackPhase(isHeld, isPaused, currentTime) {
            if (isHeld) return 'held';
            return !isPaused && currentTime > 0 ? 'playing' : 'stopped';
        }

        // (computeMidiNoteFromFrequency() — ĐÃ GỘP 01/10/2026 vào computeMidiFloatFromFrequency() + làm tròn ở nơi gọi —
        // 2 hàm cùng công thức. Nốt hợp lệ (0, 128) kiểm ở isValidMidiNote().)

        /** Nốt MIDI (đã làm tròn) có nằm trong (0, 128) không — NaN/ngoài dải -> false. */
        function isValidMidiNote(midi) {
            return midi > 0 && midi < 128;
        }

        /** Tên nốt kèm quãng tám, vd 69 -> "A4". */
        function formatMidiNoteName(midi) {
            return `${MIDI_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
        }

        // (resolveNoteDisplayText() / paintAudioStatsBar() — DỜI 01/10/2026 sang core/visualizer/stats-bar.js: định dạng +
        // ghi DOM thanh số liệu BPM/Pitch/Energy, không phải phân tích audio.)

        // (isPitchNoteFresh() — ĐÃ XOÁ 01/10/2026: nơi gọi dùng audioAnalysis.isPitchFresh(ms) — service/audio-analysis.js
        // tự lo mốc thời gian, hết lẫn Date.now()/performance.now().)

// =====================================================================================================================
// ĐẶC TRƯNG MỞ RỘNG — GỘP từ core/audio-features.js (01/10/2026, Giang: "gộp file core/workflow về lại audio-analysis").
// Hàm thuần (Rule 1-3); hàm nào ghi vào object/mảng nhận vào là sửa tại chỗ thứ nó nhận (Rule 3b). Kết quả do
// event/workflow/audio-analysis.js ghi vào kho service/audio-analysis.js (`audioAnalysis`).
// NGUỒN: phổ PHÂN TÍCH cố định (analyserPitch, FFT 2048) + sóng thời gian 2048 mẫu, cả 2 đứng TRƯỚC âm lượng người dùng.
// GIỚI HẠN: chroma/key/hợp âm trên FFT 2048 là xấp xỉ (dưới ~700 Hz 1 bin rộng hơn 1 bán cung); loudness là RMS dBFS
// (không K-weighting, không phải LUFS); build-up/drop là heuristic theo xu hướng loudness — cần chỉnh trên máy.
// =====================================================================================================================


// ===================== Hằng số =====================

/** 6 dải tần theo Hz thật (thứ tự = chỉ số trong `bands`/`bandOnsets`/`bandOnsetTimes`). Kick ≈ sub/bass, snare ≈
 * lowMid/mid/highMid (thân + tiếng "crack"), hi-hat ≈ treble. */
const AUDIO_FEATURE_BANDS = Object.freeze([
    Object.freeze({ key: 'sub', loHz: 20, hiHz: 60 }),
    Object.freeze({ key: 'bass', loHz: 60, hiHz: 250 }),
    Object.freeze({ key: 'lowMid', loHz: 250, hiHz: 500 }),
    Object.freeze({ key: 'mid', loHz: 500, hiHz: 2000 }),
    Object.freeze({ key: 'highMid', loHz: 2000, hiHz: 4000 }),
    Object.freeze({ key: 'treble', loHz: 4000, hiHz: 16000 }),
]);
/** Onset theo dải: vượt trung bình lịch sử × hệ số và vượt sàn (dB tăng/frame), cách onset trước của CÙNG dải >= ms. */
const BAND_ONSET_HISTORY_MAX = 45;
const BAND_ONSET_MEAN_RATIO = 1.5;
const BAND_ONSET_FLOOR_DB = 1.5;
const BAND_ONSET_MIN_INTERVAL_MS = 120; // kick quét tần xuống sub sau ~90 ms — 80 ms cũ đếm 2 lần (test mô phỏng)
/** Spectral rolloff: tần số mà dưới nó chứa tỉ lệ năng lượng này. */
const SPECTRAL_ROLLOFF_RATIO = 0.85;
/** Chroma: dải tần dùng + hằng thời gian 2 bộ làm mượt (hợp âm: ngắn; key: dài). */
const CHROMA_MIN_HZ = 80;
const CHROMA_MAX_HZ = 5000;
const CHORD_CHROMA_TAU_MS = 300;
const KEY_CHROMA_TAU_MS = 12000;
/** Hợp âm: điểm tương đồng cosine tối thiểu (dưới -> "N", không xác định). */
const CHORD_MIN_SCORE = 0.6;
/** Key: ước lượng lại mỗi KEY_ESTIMATE_INTERVAL_MS, cần >= KEY_MIN_TRACKED_MS nhạc có tiếng, tương quan >= ngưỡng. */
const KEY_ESTIMATE_INTERVAL_MS = 1000;
const KEY_MIN_TRACKED_MS = 6000;
const KEY_MIN_CORRELATION = 0.5;
/** Profile Krumhansl-Kessler (trưởng / thứ), chỉ số 0 = chủ âm. */
const KEY_PROFILE_MAJOR = Object.freeze([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]);
const KEY_PROFILE_MINOR = Object.freeze([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]);
/** Pitch: độ tin cậy tối thiểu (1 - giá trị YIN tại lag chọn) để nhận 1 nốt — dưới mức này coi là nốt giả. Trước đây
 * worker nhận mọi nốt có YIN < 0.6 (tương đương confidence > 0.4). */
const PITCH_MIN_CONFIDENCE = 0.5;
/** Hướng giai điệu: độ dốc cao độ (bán cung/giây) trong cửa sổ; |dốc| <= deadband -> đứng yên. Mất pitch quá lâu thì
 * xoá lịch sử. */
const MELODY_WINDOW_MS = 1000;
const MELODY_DEADBAND_ST_PER_SEC = 1.5;
const MELODY_GAP_RESET_MS = 400;
/** Vibrato: xét trong 1 nốt liền mạch (nhảy > NOTE_JUMP_SEMITONES hoặc mất pitch > NOTE_GAP_MS = nốt mới). */
const VIBRATO_WINDOW_MS = 600;
const VIBRATO_MIN_SPAN_MS = 400;
const VIBRATO_RATE_MIN_HZ = 4;
const VIBRATO_RATE_MAX_HZ = 8;
const VIBRATO_EXTENT_MIN_CENTS = 20;
const VIBRATO_EXTENT_MAX_CENTS = 200;
const NOTE_JUMP_SEMITONES = 1;
const NOTE_GAP_MS = 150;
/** Loudness ngắn hạn (làm mượt RMS dB) + xu hướng (độ dốc dB/giây trong cửa sổ). */
const LOUDNESS_TAU_MS = 400;
/** Sàn loudness: khoảng lặng kéo loudness về đây (không về -200 dB của số 0 tuyệt đối) để so "vọt lên" có nghĩa. */
const LOUDNESS_FLOOR_DB = -60;
const LOUDNESS_TREND_WINDOW_MS = 4000;
const LOUDNESS_TREND_MIN_SPAN_MS = 2000;
const LOUDNESS_TREND_THRESHOLD_DB_PER_SEC = 1;
/** Build-up: xu hướng 'rising' kéo dài >= ms. Drop: loudness vọt >= DROP_JUMP_DB so với mức thấp nhất DROP_LOOKBACK_MS
 * gần đây, trong lúc build-up đang diễn ra hoặc vừa kết thúc <= DROP_AFTER_BUILDUP_MS; 2 drop cách nhau >= ms.
 * Lookback ngắn (750 ms) để 1 đoạn riser tăng đều (vài dB/giây) không bị tính là "vọt" — drop phải là bước nhảy đột ngột. */
const BUILDUP_MIN_MS = 2000;
const DROP_JUMP_DB = 6;
const DROP_LOOKBACK_MS = 750;
const DROP_AFTER_BUILDUP_MS = 3000;
const DROP_MIN_INTERVAL_MS = 4000;
/** Im lặng: vào khi RMS < ENTER, ra khi > EXIT (trễ chống chập chờn), phải kéo dài >= MIN_MS. 'outro' khi phần còn lại
 * <= min(OUTRO_TAIL_SEC, OUTRO_TAIL_RATIO × thời lượng) — bài ngắn không bị coi cả nửa sau là outro. */
const SILENCE_ENTER_DB = -50;
const SILENCE_EXIT_DB = -45;
const SILENCE_MIN_MS = 300;
const SILENCE_OUTRO_TAIL_SEC = 15;
const SILENCE_OUTRO_TAIL_RATIO = 0.1;
/** Sức chứa các ring buffer theo thời gian (đủ > 4 s ở 120 Hz). */
const AUDIO_FEATURE_RING_CAPACITY = 600;

// ===================== Dựng sẵn (1 lần mỗi lần cấp phát) — hình dạng dữ liệu: service/audio-analysis.js =====================

/** Khoảng bin [start, end) của từng dải theo Hz — mỗi dải >= 1 bin. @returns {Int32Array} 2 phần tử / dải */
function buildFeatureBandRanges(binCount, sampleRate, bands) {
    const binHz = sampleRate / (2 * binCount);
    const ranges = new Int32Array(bands.length * 2);
    for (let b = 0; b < bands.length; b++) {
        const start = Math.min(binCount - 1, Math.max(1, Math.round(bands[b].loHz / binHz)));
        const end = Math.min(binCount, Math.max(start + 1, Math.round(bands[b].hiHz / binHz)));
        ranges[b * 2] = start;
        ranges[b * 2 + 1] = end;
    }
    return ranges;
}

/** Bảng byte (0-255, getByteFrequencyData) -> biên độ tuyến tính theo min/max dB của analyser. Byte 0 = dưới sàn -> 0. */
function buildByteToMagnitudeTable(dbMin, dbMax) {
    const table = new Float32Array(256);
    for (let b = 1; b < 256; b++) table[b] = Math.pow(10, (dbMin + (b / 255) * (dbMax - dbMin)) / 20);
    return table;
}

/** Map bin -> cung (0-11, -1 = ngoài dải chroma) + trọng số (bin rộng hơn 1 bán cung thì giảm theo tỉ lệ). */
function buildChromaBinMap(binCount, sampleRate, fMinHz, fMaxHz) {
    const binHz = sampleRate / (2 * binCount);
    const pitchClass = new Int8Array(binCount).fill(-1);
    const weight = new Float32Array(binCount);
    for (let i = 1; i < binCount; i++) {
        const f = i * binHz;
        if (f < fMinHz || f > fMaxHz) continue;
        const midi = Math.round(12 * Math.log2(f / 440)) + 69;
        pitchClass[i] = ((midi % 12) + 12) % 12;
        weight[i] = Math.min(1, (f * (Math.pow(2, 1 / 12) - 1)) / binHz);
    }
    return { pitchClass, weight };
}

// ===================== Nhóm 1 — phổ =====================

/** Mức 0-1 từng dải: công suất trung bình trong dải -> dB -> chuẩn hoá theo [dbMin, dbMax]. Ghi vào `out`. */
function computeBandLevels(spectrum, magTable, bandRanges, dbMin, dbMax, out) {
    for (let b = 0; b < out.length; b++) {
        const start = bandRanges[b * 2];
        const end = bandRanges[b * 2 + 1];
        let power = 0;
        for (let i = start; i < end; i++) { const m = magTable[spectrum[i]]; power += m * m; }
        const db = 10 * Math.log10(power / (end - start) + 1e-20);
        out[b] = Math.min(1, Math.max(0, (db - dbMin) / (dbMax - dbMin)));
    }
}

/** Độ tăng (dB) trung bình mỗi dải so với frame trước — onset theo dải. Baseline chưa hợp lệ -> 0. Ghi vào `out`. */
function computeBandOnsetStrengths(spectrum, prevSpectrum, bandRanges, dbPerByte, baselineValid, out) {
    for (let b = 0; b < out.length; b++) {
        const start = bandRanges[b * 2];
        const end = bandRanges[b * 2 + 1];
        let rise = 0;
        for (let i = start; i < end; i++) rise += Math.max(0, spectrum[i] - prevSpectrum[i]);
        out[b] = baselineValid ? (rise / (end - start)) * dbPerByte : 0;
    }
}

/** Dải `band` có onset ở frame này không: vượt trung bình lịch sử × hệ số, vượt sàn, đủ xa onset trước của dải. */
function isBandOnset(strengthDb, historyMeanDb, nowMs, lastOnsetMs, meanRatio, floorDb, minIntervalMs) {
    return strengthDb > historyMeanDb * meanRatio && strengthDb > floorDb && (nowMs - lastOnsetMs) > minIntervalMs;
}

/**
 * Hình dạng phổ (trên công suất): centroid (trọng tâm, "độ sáng"), spread (độ trải quanh centroid), rolloff (tần số
 * chứa `rolloffRatio` năng lượng), flatness (trung bình nhân / trung bình cộng: ~0 = có cao độ rõ, ~1 = giống tiếng ồn).
 * Phổ im lặng -> mọi giá trị 0. Ghi vào `out` (các field centroidHz/spreadHz/rolloffHz/flatness).
 */
function computeSpectralShape(spectrum, magTable, binHz, rolloffRatio, floorMagnitude, out) {
    const n = spectrum.length;
    let total = 0;
    let weighted = 0;
    let logSum = 0;
    const floorPower = floorMagnitude * floorMagnitude;
    for (let i = 1; i < n; i++) {
        const m = magTable[spectrum[i]];
        const p = m * m;
        total += p;
        weighted += p * i * binHz;
        logSum += Math.log(p > floorPower ? p : floorPower);
    }
    if (total <= 0) { out.centroidHz = 0; out.spreadHz = 0; out.rolloffHz = 0; out.flatness = 0; return; }
    const centroid = weighted / total;
    let variance = 0;
    let cumulative = 0;
    let rolloff = 0;
    const target = total * rolloffRatio;
    for (let i = 1; i < n; i++) {
        const m = magTable[spectrum[i]];
        const p = m * m;
        const d = i * binHz - centroid;
        variance += p * d * d;
        cumulative += p;
        if (rolloff === 0 && cumulative >= target) rolloff = i * binHz;
    }
    out.centroidHz = centroid;
    out.spreadHz = Math.sqrt(variance / total);
    out.rolloffHz = rolloff;
    out.flatness = Math.min(1, Math.exp(logSum / (n - 1)) / (total / (n - 1)));
}

/** Tần số trội nhất (bin lớn nhất, nội suy parabol trên byte dB). Phổ im lặng -> 0. */
function computeDominantFrequency(spectrum, binHz) {
    let best = 1;
    for (let i = 2; i < spectrum.length - 1; i++) if (spectrum[i] > spectrum[best]) best = i;
    if (spectrum[best] === 0) return 0;
    const a = spectrum[best - 1];
    const b = spectrum[best];
    const c = spectrum[best + 1];
    const den = a - 2 * b + c;
    return (den < 0 ? best + 0.5 * (a - c) / den : best) * binHz;
}

// ===================== Nhóm 2 — hoà âm / cao độ =====================

/** Chroma tức thời (12 cung) từ phổ, chuẩn hoá đỉnh = 1 (phổ im lặng -> toàn 0). Ghi vào `out` (Float32Array 12). */
function computeChroma(spectrum, magTable, chromaMap, out) {
    out.fill(0);
    for (let i = 1; i < spectrum.length; i++) {
        const pc = chromaMap.pitchClass[i];
        if (pc < 0) continue;
        const m = magTable[spectrum[i]];
        out[pc] += m * m * chromaMap.weight[i];
    }
    let max = 0;
    for (let k = 0; k < 12; k++) if (out[k] > max) max = out[k];
    if (max <= 0) return;
    for (let k = 0; k < 12; k++) out[k] /= max;
}

/** Làm mượt `target` về phía `sample` (EMA theo thời gian thật, sửa tại chỗ). */
function blendChromaTowards(target, sample, dtMs, tauMs) {
    const k = 1 - Math.exp(-dtMs / tauMs);
    for (let i = 0; i < 12; i++) target[i] += (sample[i] - target[i]) * k;
}

/**
 * Key (Krumhansl-Schmuckler): tương quan Pearson giữa chroma tích luỹ dài và 24 profile (12 chủ âm × trưởng/thứ).
 * Chroma phẳng (toàn 0) -> null.
 * @returns {{tonic: number, mode: 'major'|'minor', correlation: number}|null}
 */
function estimateKeyFromChroma(chroma, profileMajor, profileMinor) {
    let cMean = 0;
    for (let i = 0; i < 12; i++) cMean += chroma[i];
    cMean /= 12;
    let cVar = 0;
    for (let i = 0; i < 12; i++) cVar += (chroma[i] - cMean) * (chroma[i] - cMean);
    if (cVar <= 0) return null;
    const profiles = [profileMajor, profileMinor];
    const modes = ['major', 'minor'];
    let best = { tonic: 0, mode: 'major', correlation: -Infinity };
    for (let p = 0; p < 2; p++) {
        const prof = profiles[p];
        let pMean = 0;
        for (let i = 0; i < 12; i++) pMean += prof[i];
        pMean /= 12;
        let pVar = 0;
        for (let i = 0; i < 12; i++) pVar += (prof[i] - pMean) * (prof[i] - pMean);
        for (let tonic = 0; tonic < 12; tonic++) {
            let cov = 0;
            for (let i = 0; i < 12; i++) cov += (chroma[(i + tonic) % 12] - cMean) * (prof[i] - pMean);
            const r = cov / Math.sqrt(cVar * pVar);
            if (r > best.correlation) best = { tonic, mode: modes[p], correlation: r };
        }
    }
    return best;
}

/**
 * Hợp âm xấp xỉ: tương đồng cosine giữa chroma ngắn hạn và 24 mẫu hợp âm ba (trưởng {0,4,7}, thứ {0,3,7}).
 * Chroma phẳng -> null. @returns {{root: number, quality: 'major'|'minor', score: number}|null}
 */
function estimateChordFromChroma(chroma) {
    let norm = 0;
    for (let i = 0; i < 12; i++) norm += chroma[i] * chroma[i];
    if (norm <= 0) return null;
    const qualities = ['major', 'minor'];
    const thirds = [4, 3];
    let best = { root: 0, quality: 'major', score: -Infinity };
    for (let q = 0; q < 2; q++) {
        for (let root = 0; root < 12; root++) {
            const dot = chroma[root] + chroma[(root + thirds[q]) % 12] + chroma[(root + 7) % 12];
            const score = dot / (Math.sqrt(norm) * Math.sqrt(3));
            if (score > best.score) best = { root, quality: qualities[q], score };
        }
    }
    return best;
}

/** Tên key/hợp âm: "C major"/"A minor" (key) hoặc "C"/"Am" (hợp âm). `noteNames` = MIDI_NOTE_NAMES. */
function formatKeyName(tonic, mode, noteNames) {
    return `${noteNames[tonic]} ${mode}`;
}
function formatChordName(root, quality, noteNames) {
    return `${noteNames[root]}${quality === 'minor' ? 'm' : ''}`;
}

/** Tần số -> nốt MIDI DẠNG THỰC (không làm tròn, cho đo độ dốc/vibrato). Không hợp lệ -> NaN. */
function computeMidiFloatFromFrequency(frequency) {
    return frequency > 0 ? 12 * Math.log2(frequency / 440) + 69 : NaN;
}

/** Hướng giai điệu từ độ dốc (bán cung/giây): 1 lên, -1 xuống, 0 đứng yên (trong deadband). */
function resolveMelodyDirection(slopeStPerSec, deadband) {
    if (slopeStPerSec > deadband) return 1;
    return slopeStPerSec < -deadband ? -1 : 0;
}

/**
 * Vibrato trong ring cao độ của 1 nốt (mốc ms, MIDI thực): khử xu hướng tuyến tính trong `windowMs` gần nhất, đếm số
 * lần phần dư đổi dấu -> tần số dao động; độ lệch chuẩn phần dư -> biên độ (cents, đỉnh-đỉnh ≈ 2√2·σ).
 * Chưa đủ `minSpanMs` dữ liệu -> {rateHz: 0, extentCents: 0}.
 */
function measureVibrato(ring, windowMs, minSpanMs) {
    const cap = ring.times.length;
    if (ring.count < 4) return { rateHz: 0, extentCents: 0 };
    const newest = ring.times[(ring.head - 1 + cap) % cap];
    let n = 0;
    let sumT = 0;
    let sumV = 0;
    let sumTT = 0;
    let sumTV = 0;
    let oldest = newest;
    for (let k = 0; k < ring.count; k++) {
        const idx = (ring.head - 1 - k + cap) % cap;
        const t = ring.times[idx];
        if (newest - t > windowMs) break;
        const x = (t - newest) / 1000;
        const v = ring.values[idx];
        n++; sumT += x; sumV += v; sumTT += x * x; sumTV += x * v; oldest = t;
    }
    const spanMs = newest - oldest;
    if (n < 4 || spanMs < minSpanMs) return { rateHz: 0, extentCents: 0 };
    const den = n * sumTT - sumT * sumT;
    const slope = den !== 0 ? (n * sumTV - sumT * sumV) / den : 0;
    const intercept = (sumV - slope * sumT) / n;
    let crossings = 0;
    let prevSign = 0;
    let sq = 0;
    for (let k = n - 1; k >= 0; k--) {
        const idx = (ring.head - 1 - k + cap) % cap;
        const r = ring.values[idx] - (intercept + slope * (ring.times[idx] - newest) / 1000);
        sq += r * r;
        const sign = r > 0 ? 1 : (r < 0 ? -1 : 0);
        if (sign !== 0 && prevSign !== 0 && sign !== prevSign) crossings++;
        if (sign !== 0) prevSign = sign;
    }
    return { rateHz: crossings / 2 / (spanMs / 1000), extentCents: 2 * Math.SQRT2 * Math.sqrt(sq / n) * 100 };
}

/** Có phải vibrato không (tần số + biên độ đều trong khoảng điển hình của giọng hát/nhạc cụ). */
function isVibratoMeasure(rateHz, extentCents, rateMin, rateMax, extentMin, extentMax) {
    return rateHz >= rateMin && rateHz <= rateMax && extentCents >= extentMin && extentCents <= extentMax;
}

// ===================== Nhóm 3 — miền thời gian =====================

/** RMS / peak (dBFS), crest factor (dB = peak - RMS), zero-crossing rate (tỉ lệ cặp mẫu đổi dấu, 0-1). Ghi vào `out`. */
function computeTimeDomainLevels(buf, out) {
    let sumSq = 0;
    let peak = 0;
    let crossings = 0;
    for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sumSq += v * v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
        if (i > 0 && ((v >= 0) !== (buf[i - 1] >= 0))) crossings++;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    out.rmsDb = 20 * Math.log10(rms + 1e-10);
    out.peakDb = 20 * Math.log10(peak + 1e-10);
    out.crestDb = out.peakDb - out.rmsDb;
    out.zcr = crossings / (buf.length - 1);
}

/** Loudness ngắn hạn: EMA theo thời gian thật của mức dB (nơi gọi đã kẹp sàn LOUDNESS_FLOOR_DB). */
function smoothLoudnessDb(prevDb, levelDb, dtMs, tauMs) {
    return prevDb + (levelDb - prevDb) * (1 - Math.exp(-dtMs / tauMs));
}

/** Đang ở vùng "nhỏ" theo cổng có trễ: đã im thì phải vượt `exitDb` mới hết, chưa im thì phải dưới `enterDb`. */
function isBelowSilenceGate(rmsDb, wasQuiet, enterDb, exitDb) {
    return wasQuiet ? rmsDb < exitDb : rmsDb < enterDb;
}

/** Loại khoảng lặng: chưa nghe tiếng nào trong bài -> 'intro'; phần còn lại <= min(tailSec, tailRatio × thời lượng)
 * -> 'outro'; còn lại 'gap'. Thời lượng không biết (stream/NaN) -> không bao giờ 'outro'. */
function resolveSilenceKind(hasHeardSound, mediaTimeSec, mediaDurationSec, tailSec, tailRatio) {
    if (!hasHeardSound) return 'intro';
    const tail = Math.min(tailSec, mediaDurationSec * tailRatio);
    return isFinite(mediaDurationSec) && mediaDurationSec - mediaTimeSec <= tail ? 'outro' : 'gap';
}

/**
 * Độ dốc (đơn vị giá trị / giây) bằng bình phương tối thiểu trên ring theo thời gian (createOnsetEnvelope(), core/
 * audio-tempo.js — ring buffer mốc thời gian dùng chung), xét `windowMs` gần nhất. Chưa phủ đủ `minSpanMs` -> 0.
 */
function computeTimedRingSlope(ring, windowMs, minSpanMs) {
    const cap = ring.times.length;
    if (ring.count < 2) return 0;
    const newest = ring.times[(ring.head - 1 + cap) % cap];
    let n = 0;
    let sumT = 0;
    let sumV = 0;
    let sumTT = 0;
    let sumTV = 0;
    let oldest = newest;
    for (let k = 0; k < ring.count; k++) {
        const idx = (ring.head - 1 - k + cap) % cap;
        const t = ring.times[idx];
        if (newest - t > windowMs) break;
        const x = (t - newest) / 1000;
        const v = ring.values[idx];
        n++; sumT += x; sumV += v; sumTT += x * x; sumTV += x * v; oldest = t;
    }
    const den = n * sumTT - sumT * sumT;
    if (newest - oldest < minSpanMs || den === 0) return 0;
    return (n * sumTV - sumT * sumV) / den;
}

/** Giá trị nhỏ nhất trong `windowMs` gần nhất của ring theo thời gian. Ring rỗng -> Infinity. */
function computeTimedRingMin(ring, windowMs) {
    const cap = ring.times.length;
    if (ring.count === 0) return Infinity;
    const newest = ring.times[(ring.head - 1 + cap) % cap];
    let min = Infinity;
    for (let k = 0; k < ring.count; k++) {
        const idx = (ring.head - 1 - k + cap) % cap;
        if (newest - ring.times[idx] > windowMs) break;
        if (ring.values[idx] < min) min = ring.values[idx];
    }
    return min;
}

/** Xu hướng loudness từ độ dốc (dB/giây). */
function resolveLoudnessTrend(slopeDbPerSec, threshold) {
    if (slopeDbPerSec > threshold) return 'rising';
    return slopeDbPerSec < -threshold ? 'falling' : 'steady';
}

/**
 * Drop: loudness hiện tại vọt >= jumpDb so với mức thấp nhất gần đây, trong lúc build-up đang diễn ra hoặc vừa kết
 * thúc <= afterBuildUpMs, và cách drop trước >= minIntervalMs.
 */
function isLoudnessDrop(loudnessDb, recentMinDb, jumpDb, nowMs, lastBuildUpMs, afterBuildUpMs, lastDropMs, minIntervalMs) {
    return loudnessDb - recentMinDb >= jumpDb
        && lastBuildUpMs > 0 && nowMs - lastBuildUpMs <= afterBuildUpMs
        && nowMs - lastDropMs >= minIntervalMs;
}
