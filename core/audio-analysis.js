/**
 * Tính màu sắc theo dữ liệu tần số (getComputedColor) & cập nhật bảng thống kê BPM / Pitch / Energy.
 *
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

        /** Màu riêng theo TỪNG effect (cfg.customEffect[cfg.type]) — không còn 1 mode màu chung
         * cho toàn app, xem core/custom-effect.js::getActiveEffectConfig(). */
        function getComputedColor(i, totalLength, dataValue) {
            // SỬA (28/09/2026, Phase 2 dọn visualizer) — đọc config effect ĐÃ RESOLVE SẴN cho frame vẽ hiện tại
            // (`frameEffectConfig`, workflowVisualizerRender._tickDraw() ghi đầu frame, xoá về null cuối frame)
            // thay vì gọi getActiveEffectConfig() MỖI LẦN — hàm đó tạo object mới (2 spread + forEach + delete)
            // mỗi lời gọi, nhân với hàng trăm lời gọi/frame. Ngoài frame vẽ (init scene, UI...) giá trị là
            // null -> rơi về getActiveEffectConfig() như cũ, luôn đọc config MỚI NHẤT. Hàm hot-path di sản
            // (miễn trừ, core-legacy-audit.md) — chỉ đổi NGUỒN đọc, không đổi logic.
            const ec = appState.get('frameEffectConfig') || getActiveEffectConfig(); // core/custom-effect.js
            // MỚI (Giang báo "THREE.Color: Alpha component of hsla(...) will be ignored" khi ở connector):
            // `fillNoAlpha` = CÙNG màu với `fill` nhưng KHÔNG có alpha — dành riêng cho nơi đưa màu vào
            // THREE.Color (connector). Parser hsla() của THREE r128 luôn cảnh báo (mỗi lần gọi, kể cả mỗi
            // frame) khi alpha < 1 dù bỏ qua alpha; canvas 2D vẫn dùng `fill` (alpha 0.9) như cũ. 2 mode
            // còn lại vốn không có alpha nên `fillNoAlpha` === `fill`.
            if (ec.mode === 'dynamic') { const c = interpolateColor(ec.dynA, ec.dynB, i / totalLength); return { fill: c, fillNoAlpha: c, glow: c }; }
            else if (ec.mode === 'gradient') {
                let baseHue = (appState.get('globalHueOffset') + (i / totalLength) * 240) % 360;
                let finalHue = (baseHue + (dataValue / 255) * 80) % 360;
                // FIX (16/09/2026, Giang báo "THREE.Color: Unknown color hsla(...)"): saturation/
                // lightness PHẢI là số nguyên — parser hsl()/hsla() của THREE.Color (r128) chỉ nhận
                // %-value dạng \d+ (không hỗ trợ thập phân), trong khi hue thì hỗ trợ thập phân bình
                // thường. Trước đây 2 giá trị này là số thập phân (vd "83.764...%") -> khớp regex
                // thất bại toàn bộ -> "Unknown color" (không chỉ dừng ở mức cảnh báo "alpha ignored"
                // như khi chúng tình cờ là số nguyên). Math.round() ở đây không ảnh hưởng canvas 2D
                // (fillStyle vẫn nhận hsla() bình thường, sai khác <1% không nhận ra được bằng mắt).
                let lightness = Math.round(40 + (dataValue / 255) * 30);
                let saturation = Math.round(70 + (dataValue / 255) * 30);
                return { fill: `hsla(${finalHue}, ${saturation}%, ${lightness}%, 0.9)`, fillNoAlpha: `hsl(${finalHue}, ${saturation}%, ${lightness}%)`, glow: `hsl(${finalHue}, 100%, ${lightness + 15}%)` };
            } else return { fill: ec.solidColor, fillNoAlpha: ec.solidColor, glow: ec.solidColor };
        }

        /** Cường độ blur/glow effect ĐANG CHẠY, quy đổi 0-1 cho `perf.blurMult` cũ — 0 nếu tắt. */
        function getActiveBlurMult() {
            const ec = appState.get('frameEffectConfig') || getActiveEffectConfig(); // xem ghi chú ở getComputedColor()
            return ec.blurEnabled ? ec.blurIntensity / 100 : 0;
        }

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
            const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
            const checkWindow = (windowSize) => {
                if (beatFluxHistory.length < windowSize * 2) return false;
                const recentAvg = avg(beatFluxHistory.slice(-windowSize));
                const priorAvg = avg(beatFluxHistory.slice(-windowSize * 2, -windowSize));
                if (priorAvg <= 0) return false; // tránh chia 0 lúc đoạn trước hoàn toàn im lặng
                return Math.abs(recentAvg - priorAvg) / priorAvg >= relativeThreshold;
            };
            return checkWindow(energyWindowBeats) || checkWindow(sectionWindowBeats);
        }

        /** Xấp xỉ ranh giới phrase bằng đếm beat cố định (không có phrase detection thật). Nơi gọi
         * tự đếm `beatsSincePhraseRefresh`, reset về 0 khi hàm này trả true. */
        function isPhraseBoundary(beatsSincePhraseRefresh, refreshBeatsForPhrase) {
            return beatsSincePhraseRefresh >= refreshBeatsForPhrase;
        }

        // =====================================================================================
        // [TÁCH — 28/09/2026, Phase 2 dọn visualizer, Giang duyệt] Thay `updateStatsDashboard()` cũ
        // (1 hàm di sản: 21 lần appState.get, tự ghi DOM, tự gọi requestPitchDetection(), rẽ nhiều
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
        const AUDIO_BEAT_INTERVALS_MAX = 5;
        const AUDIO_PITCH_HISTORY_MAX = 30;
        /** Giữ hiển thị nốt cuối trong khoảng này (ms) khi worker tạm chưa bắt được pitch. */
        const AUDIO_NOTE_HOLD_MS = 250;
        /** BPM ngoài khoảng (min, max) bị bỏ qua — không ghi đè BPM đang hiển thị. */
        const AUDIO_BPM_MIN = 40;
        const AUDIO_BPM_MAX = 220;
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

        /** BPM từ trung bình khoảng cách beat (ms). `intervalCount < 2` (chưa đủ dữ liệu) hoặc ra ngoài
         * khoảng hợp lệ -> null (nơi gọi giữ nguyên BPM cũ, đúng hành vi trước đây). Nhận SẴN trung bình
         * (Workflow tự gọi computeArrayMean() trước) — không tự tính lại, tránh trùng logic (Rule 3c). */
        function computeBpmFromMeanInterval(meanIntervalMs, intervalCount) {
            if (intervalCount < 2) return null;
            const bpm = Math.round(60000 / meanIntervalMs);
            return (bpm > AUDIO_BPM_MIN && bpm < AUDIO_BPM_MAX) ? bpm : null;
        }

        /** Tần số (Hz) -> số nốt MIDI. Tần số không hợp lệ (<= 0, worker chưa bắt được) hoặc nốt ngoài
         * (0, 128) -> null. */
        function computeMidiNoteFromFrequency(frequency) {
            if (!(frequency > 0)) return null;
            const midi = Math.round(12 * Math.log2(frequency / 440)) + 69;
            return (midi > 0 && midi < 128) ? midi : null;
        }

        /** Tên nốt kèm quãng tám, vd 69 -> "A4". */
        function formatMidiNoteName(midi) {
            return `${MIDI_NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
        }

        /** Chữ hiển thị ô Pitch: đang phát + đủ năng lượng + nốt gần nhất còn "tươi" (trong
         * AUDIO_NOTE_HOLD_MS) -> tên nốt đó; mọi trường hợp khác -> "---". */
        function resolveNoteDisplayText(isPlaying, energyPercent, lastNoteStr, lastNoteTime, now) {
            if (!isPlaying || energyPercent <= 1) return '---';
            if (!lastNoteStr || (now - lastNoteTime) >= AUDIO_NOTE_HOLD_MS) return '---';
            return lastNoteStr;
        }

        /** Ghi 3 ô số liệu BPM / Pitch / Energy trên thanh trạng thái. */
        function paintAudioStatsBar(energyEl, bpmEl, noteEl, energyText, bpmText, noteText) {
            energyEl.textContent = energyText;
            bpmEl.textContent = bpmText;
            noteEl.textContent = noteText;
        }
