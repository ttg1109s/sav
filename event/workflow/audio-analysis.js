/**
 * event/workflow/audio-analysis.js — Workflow sở hữu task PHÂN TÍCH AUDIO mỗi khung hình
 * (`AUDIO_ANALYSIS_TASK` = 'audioAnalysis', taskManager mode `raf`) và là nơi DUY NHẤT ghi kho `audioAnalysis`
 * (service/audio-analysis.js).
 *
 * Lịch sử ngắn:
 *   - 28/09/2026 (Phase 2): tách khỏi workflowVisualizerRender._tick(); luôn chạy suốt đời AudioContext, kể cả tắt
 *     Show Visual (Game, React Beat, VBG, thanh trạng thái sống nhờ dữ liệu ở đây).
 *   - 01/10/2026 lượt 2: phân tích chung đọc phổ PHÂN TÍCH cố định (FFT 2048); BPM bằng tự tương quan (core/audio-tempo.js);
 *     pha phát 3 trạng thái + ngắt dòng thời gian + cửa sổ ổn định; reset theo bài chung Song/Video.
 *   - 01/10/2026 lượt 3-4 (Giang chốt): GỘP event/workflow/audio-features.js vào đây; MỌI số liệu ghi vào kho
 *     `audioAnalysis` (class, API chỉ đọc) thay vì ~20 key appState; phổ để vẽ xin theo cỡ FFT
 *     (audioAnalysis.requireSpectrum()) — file này đọc phổ cho đúng các cỡ đang được xin mỗi frame.
 *
 * Mỗi frame (_tick):
 *   1. Show Visual -> bật/tắt task vẽ.  2. frameIndex; ngắt dòng thời gian khi hở tick / seek.
 *   3. Đọc phổ + sóng phân tích, phổ các cỡ đang được xin.  4. Năng lượng, hue, energy %, flux, onset tempo.
 *   5. Đo tức thời (dải, onset dải, hình dạng phổ, tần số trội, RMS/peak/crest/ZCR, chroma) — TRƯỚC khi ghi baseline.
 *   6. Theo pha phát: playing -> pitch, (qua ổn định) flux/beat/tempo; held -> giữ nguyên; stopped -> BPM null.
 *   7. Theo dòng thời gian (khi đã ổn định): im lặng, onset dải, loudness/build-up/drop, hợp âm/key, giai điệu/vibrato.
 *   8. Thanh trạng thái, Game tick, nốt bay.
 *
 * Rẽ nhánh (readme/event-bus-flow.md mục 7): guard + object map (`AUDIO_STATS_BY_PHASE`, `AUDIO_TRACK_BY_SETTLED`);
 * ternary chỉ chọn giá trị. Hot path: ghi thẳng `audioAnalysis._data()` — không log (ngoại lệ Rule 4); cấp phát/reset có log.
 * Mọi mốc thời gian theo performance.now().
 *
 * NẠP: sau core/audio-analysis.js + core/audio-tempo.js + service/audio-analysis.js (field tạo LÚC NẠP dùng
 * createOnsetEnvelope / AUDIO_FEATURE_BANDS), trước event/workflow/visualizer-render.js.
 */

const AUDIO_ANALYSIS_TASK = 'audioAnalysis';

/** Tiến trình số liệu theo pha phát (khoá = resolveAnalysisPlaybackPhase()). */
const AUDIO_STATS_BY_PHASE = {
    playing: (frame) => workflowAudioAnalysis._analyzePlayingStats(frame),
    held: () => workflowAudioAnalysis._breakTimeline(),
    stopped: () => workflowAudioAnalysis._stopPlayingStats(),
};

/** Theo dòng thời gian: đã qua cửa sổ ổn định / chưa (chưa -> ngắt các ring theo thời gian). */
const AUDIO_TRACK_BY_SETTLED = {
    true: (frame, dt) => workflowAudioAnalysis._trackFrame(frame, dt),
    false: () => workflowAudioAnalysis._breakTracking(),
};

const workflowAudioAnalysis = {
    // ---- Bộ đệm phân tích (riêng, không thuộc state) ----
    _spectrum: null,        // Uint8Array — phổ phân tích (analyserPitch, FFT 2048)
    _prevSpectrum: null,    // baseline flux
    _timeDomain: null,      // Float32Array — sóng 2048 mẫu (RMS/ZCR + pitch)
    _baselineValid: false,
    // ---- Tempo ----
    _onsetBandEdges: null,
    _onsetEnvelope: createOnsetEnvelope(TEMPO_ENVELOPE_CAPACITY),
    _tempoGrid: new Float32Array(Math.ceil(TEMPO_WINDOW_MS * TEMPO_GRID_RATE_HZ / 1000) + 1),
    _tempoHistory: [],
    _bpm: null,             // BPM ước lượng của bài hiện tại (giữ cả lúc dừng để hiện lại ngay khi phát tiếp)
    _lastTempoEstimatePerf: 0,
    // ---- Ngắt dòng thời gian ----
    _settlePending: true,
    _settleUntilPerf: 0,
    _lastTickPerf: 0,
    // ---- Bảng dựng sẵn cho đặc trưng phổ ----
    _magTable: null,
    _bandRanges: null,
    _chromaMap: null,
    _binHz: 0,
    _dbMin: -100,
    _dbMax: -30,
    _dbPerByte: 0,
    // ---- Đặc trưng theo thời gian ----
    _chromaNow: new Float32Array(12),
    _keyChroma: new Float32Array(12),
    _keyTrackedMs: 0,
    _lastKeyEstimatePerf: 0,
    _bandHistories: AUDIO_FEATURE_BANDS.map(() => []),
    _loudnessRing: createOnsetEnvelope(AUDIO_FEATURE_RING_CAPACITY),
    _melodyRing: createOnsetEnvelope(AUDIO_FEATURE_RING_CAPACITY),
    _noteRing: createOnsetEnvelope(AUDIO_FEATURE_RING_CAPACITY),
    _loudnessPrimed: false,
    _buildUpSincePerf: 0,
    _lastBuildUpPerf: 0,
    _isQuiet: false,
    _quietSincePerf: 0,
    _hasHeardSound: false,
    _lastPitchPerf: 0,
    _lastNoteMidi: NaN,
    _lastTrackPerf: 0,

    // ===================== Vòng đời =====================

    /** Cấp phát bộ đệm + gắn graph vào kho, đăng ký và bật task. Chỉ `workflowVisualizerRender.start()` gọi. */
    start() {
        this.allocateBuffers();
        this._breakTimeline();
        taskManager.addNew(AUDIO_ANALYSIS_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator(AUDIO_ANALYSIS_TASK, 'enabled');
    },

    /** Bộ đệm + bảng tra theo analyser PHÂN TÍCH (cỡ cố định), cấp 1 lần mỗi lần dựng graph; gắn graph vào kho để phổ
     * các cỡ được xin có analyser. */
    allocateBuffers() {
        const { analyserPitch, audioContext, masterGainNode } = appState.get(['analyserPitch', 'audioContext', 'masterGainNode']);
        if (!analyserPitch || !audioContext) return;
        const binCount = analyserPitch.frequencyBinCount;
        const sampleRate = audioContext.sampleRate;
        this._spectrum = new Uint8Array(binCount);
        this._prevSpectrum = new Uint8Array(binCount);
        this._timeDomain = new Float32Array(analyserPitch.fftSize);
        this._baselineValid = false;
        this._onsetBandEdges = buildOnsetBandEdges(binCount, sampleRate, TEMPO_ONSET_FREQ_MIN_HZ, TEMPO_ONSET_FREQ_MAX_HZ, TEMPO_ONSET_BAND_COUNT); // core/audio-tempo.js
        this._binHz = sampleRate / (2 * binCount);
        this._dbMin = analyserPitch.minDecibels;
        this._dbMax = analyserPitch.maxDecibels;
        this._dbPerByte = (this._dbMax - this._dbMin) / 255;
        this._magTable = buildByteToMagnitudeTable(this._dbMin, this._dbMax); // core
        this._bandRanges = buildFeatureBandRanges(binCount, sampleRate, AUDIO_FEATURE_BANDS); // core
        this._chromaMap = buildChromaBinMap(binCount, sampleRate, CHROMA_MIN_HZ, CHROMA_MAX_HZ); // core
        audioAnalysis._attachGraph(audioContext, masterGainNode, analyserPitch, this._spectrum); // service/audio-analysis.js
        console.log(`writer: "workflowAudioAnalysis.allocateBuffers", page: "audioAnalysis (service)", content: "${binCount} bin, ${sampleRate} Hz, gắn graph"`);
    },

    /** Đổi bài/video — số liệu THEO BÀI, chung Song + Video (workflowVisualizerRender.resetForNewMedia() gọi). An toàn cả
     * khi chưa có audio graph. */
    resetForNewMedia() {
        this._breakTimeline();
        this._breakTracking();
        this._tempoHistory = [];
        this._bpm = null;
        this._lastTempoEstimatePerf = 0;
        this._keyChroma.fill(0);
        this._keyTrackedMs = 0;
        this._lastKeyEstimatePerf = 0;
        this._hasHeardSound = false;
        this._lastBuildUpPerf = 0;
        this._bandHistories = AUDIO_FEATURE_BANDS.map(() => []);
        this._resetMediaFields(audioAnalysis._data());
        workflowAudioEngine.discardPendingPitch(); // event/workflow/audio-engine.js — bỏ hồi đáp pitch của bài cũ
        statBpm.textContent = '---';
        statNote.textContent = '---';
    },

    _resetMediaFields(d) {
        d.fluxHistory.length = 0;
        d.bpm = null;
        d.pitch.frequency = -1; d.pitch.confidence = 0; d.pitch.midi = null; d.pitch.name = null; d.pitch.time = 0;
        d.pitch.history.length = 0; d.pitch.average = 0;
        d.chroma.fill(0);
        d.bandOnsetTimes.fill(0);
        d.keyTonic = -1; d.keyMode = null; d.keyName = null; d.keyConfidence = 0;
        d.chordRoot = -1; d.chordQuality = null; d.chordName = null; d.chordConfidence = 0;
        d.lastDropTime = 0; d.isBuildUp = false; d.isSilent = false; d.silenceKind = null; d.silentForMs = 0;
        d.melodyDirection = 0; d.melodySlope = 0; d.vibrato = false; d.vibratoRateHz = 0; d.vibratoExtentCents = 0;
        console.log(`writer: "workflowAudioAnalysis._resetMediaFields", page: "audioAnalysis (service)", content: "reset theo bài mới"`);
    },

    // ===================== Tick =====================

    _tick() {
        const isVisualOff = appConfigViz.getAll().visualEnabled === false;
        workflowVisualizerRender.syncVisibility(isVisualOff); // bật/tắt canvas + task VẼ theo Show Visual
        if (!this._spectrum) return; // guard — audio context chưa init

        const d = audioAnalysis._data();
        const s = appState.get(['analyserPitch', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'isStatsPanelVisible']);
        // frameIndex chỉ đếm frame THẬT SỰ có xử lý audio. Lịch sử (bug 17/09/2026, khi còn là frameCounter): từng KHÔNG
        // có chỗ nào tăng biến này — cooldown bắn neuron synapse tự khoá; nhịp nốt bay, globalTwist vortex cũng đọc nó.
        d.frameIndex++;

        const nowPerf = performance.now();
        this._breakOnTickGap(nowPerf);
        this._breakOnSeek(workflowVisualizerRender._detectMediaSeek(s.isVideoPlayerMode, s.isPhotoPlayerMode)); // connector ổn định lại sau seek

        s.analyserPitch.getByteFrequencyData(this._spectrum); // phổ PHÂN TÍCH — cố định
        s.analyserPitch.getFloatTimeDomainData(this._timeDomain); // sóng ~46 ms mới nhất
        audioAnalysis._ownedSpectra().forEach((entry) => entry.analyser.getByteFrequencyData(entry.data)); // phổ VẼ các cỡ đang được xin

        const binCount = this._spectrum.length;
        const media = s.isVideoPlayerMode ? bgVideoElement : audioPlayer;
        const isPlaying = !media.paused;
        d.beatScale = computeBeatScale(this._spectrum, Math.floor(binCount * 0.1)); // core — dải 0-2 kHz
        d.smoothedEnergy = computeSmoothedEnergy(d.beatScale, d.smoothedEnergy); // core
        d.hueOffset = computeNextGlobalHueOffset(d.hueOffset, d.beatScale, isPlaying); // core
        d.energyPercent = computeEnergyPercent(this._spectrum, binCount); // core
        d.flux = computeNormalizedSpectralFlux(this._spectrum, this._prevSpectrum, binCount, this._baselineValid); // core
        const onset = computeBandedOnsetStrength(this._spectrum, this._prevSpectrum, this._onsetBandEdges, this._baselineValid); // core/audio-tempo.js
        this._measureFrame(d); // TRƯỚC khi ghi đè baseline (onset theo dải so với phổ frame trước)
        storeSpectrumBaseline(this._prevSpectrum, this._spectrum, binCount); // core
        this._baselineValid = true;
        d.hasSignal = d.rmsDb > SILENCE_ENTER_DB; // cổng pitch + ô Pitch (energy % dễ <= 1% với 1 giọng/nhạc cụ đơn)

        // 'held' = cổng seek đang giữ media hoặc media đang seek — KHÔNG phải người dùng dừng.
        const isHeld = media.seeking || workflowPlayerControls.isHeldBySeekGate(media); // event/workflow/player-controls.js
        const phase = resolveAnalysisPlaybackPhase(isHeld, media.paused, media.currentTime); // core
        AUDIO_STATS_BY_PHASE[phase]({ nowPerf, onset });
        this._track({
            nowPerf,
            isSettled: phase === 'playing' && !this._settlePending && nowPerf >= this._settleUntilPerf, // cùng quy tắc ổn định với BPM
            mediaTimeSec: media.currentTime,
            mediaDurationSec: media.duration,
        });

        const noteText = resolveNoteDisplayText(phase !== 'stopped', d.hasSignal, d.pitch.name, d.pitch.time, nowPerf); // core
        // Lúc cổng seek giữ media (vài trăm ms), phổ bị câm tạm — giữ nguyên 3 ô thay vì nháy về 0%/---.
        this._paintStats(s.isStatsPanelVisible && phase !== 'held', `${d.energyPercent}%`, audioAnalysis.bpmText(), noteText);

        // Game Mode Circle dùng CHUNG vòng lặp này (layer game là DOM riêng, chạy cả khi Show Visual tắt).
        workflowGameplay.tick(nowPerf);
        this._spawnFlyingNote(isPlaying, d.smoothedEnergy, d.frameIndex, d.hueOffset);
    },

    // ===================== Ngắt dòng thời gian =====================

    /** Xoá đường bao tempo + hẹn cửa sổ ổn định ở frame 'playing' kế tiếp. BPM của bài GIỮ nguyên. */
    _breakTimeline() {
        clearOnsetEnvelope(this._onsetEnvelope); // core/audio-tempo.js
        this._settlePending = true;
    },

    _breakOnTickGap(nowPerf) {
        const gap = nowPerf - this._lastTickPerf;
        this._lastTickPerf = nowPerf;
        if (gap <= ANALYSIS_TICK_GAP_MS) return;
        this._breakTimeline();
    },

    _breakOnSeek(isSeek) {
        if (!isSeek) return;
        this._breakTimeline();
    },

    _openSettleWindowIfPending(nowPerf) {
        if (!this._settlePending) return;
        this._settlePending = false;
        this._settleUntilPerf = nowPerf + ANALYSIS_SETTLE_MS;
    },

    // ===================== Theo pha phát =====================

    /** Đang phát: BPM bài hiện tại hiện lại ngay; pitch; qua cửa sổ ổn định mới đến flux/beat/tempo. */
    _analyzePlayingStats(frame) {
        const d = audioAnalysis._data();
        this._openSettleWindowIfPending(frame.nowPerf);
        d.bpm = this._bpm;
        this._detectPitch(d, frame.nowPerf);
        if (frame.nowPerf < this._settleUntilPerf) return; // guard — phổ đang dâng lại sau chỗ ngắt
        pushBoundedHistory(d.fluxHistory, d.flux, AUDIO_FLUX_HISTORY_MAX); // core
        const isBeat = isSpectralFluxBeat(d.flux, computeArrayMean(d.fluxHistory), frame.nowPerf, d.lastBeatTime, APP_CONFIG.bpmMinWaitTime); // core
        d.lastBeatTime = isBeat ? frame.nowPerf : d.lastBeatTime;
        pushOnsetSample(this._onsetEnvelope, frame.nowPerf, frame.onset); // core/audio-tempo.js
        this._estimateTempoIfDue(frame.nowPerf);
    },

    /** Dừng thật: BPM hiển thị null ("---"); `_bpm` của bài vẫn nhớ. */
    _stopPlayingStats() {
        this._breakTimeline();
        audioAnalysis._data().bpm = null;
    },

    // ===================== Tempo — core/audio-tempo.js =====================

    _estimateTempoIfDue(nowPerf) {
        if (nowPerf - this._lastTempoEstimatePerf < TEMPO_ESTIMATE_INTERVAL_MS) return;
        if (computeOnsetEnvelopeSpanMs(this._onsetEnvelope) < TEMPO_MIN_WINDOW_MS) return; // core
        this._lastTempoEstimatePerf = nowPerf;
        const count = resampleOnsetEnvelope(this._onsetEnvelope, TEMPO_GRID_RATE_HZ, TEMPO_WINDOW_MS, this._tempoGrid); // core
        const estimate = estimateTempoFromOnsets(this._tempoGrid, count, TEMPO_GRID_RATE_HZ, TEMPO_MIN_BPM, TEMPO_MAX_BPM,
            TEMPO_PRIOR_BPM, TEMPO_PRIOR_STD_OCTAVE, TEMPO_DETREND_HALF_MS, TEMPO_DOUBLE_SUPPORT_RATIO); // core
        this._acceptTempoEstimate(estimate);
    },

    /** Ước lượng đủ tin cậy -> lịch sử; gập các ước lượng cũ về quãng tám của ước lượng MỚI NHẤT rồi lấy trung vị. */
    _acceptTempoEstimate(estimate) {
        if (!estimate || estimate.confidence < TEMPO_MIN_CONFIDENCE) return;
        pushBoundedHistory(this._tempoHistory, estimate.bpm, TEMPO_HISTORY_MAX); // core
        const folded = this._tempoHistory.map((bpm) => foldTempoToReference(bpm, estimate.bpm, TEMPO_OCTAVE_FOLD_TOLERANCE)); // core
        this._bpm = Math.round(computeArrayMedian(folded)); // core
        audioAnalysis._data().bpm = this._bpm;
    },

    // ===================== Pitch =====================

    /** Gửi sóng cho pitch worker (không chờ) rồi dùng kết quả MỚI NHẤT worker đã trả (có thể trễ vài frame). Không có
     * tín hiệu -> bỏ qua. Nốt có độ tin cậy YIN dưới PITCH_MIN_CONFIDENCE bị loại (nốt giả). */
    _detectPitch(d, now) {
        if (!d.hasSignal) return;
        const sampleRate = appState.get('audioContext').sampleRate;
        workflowAudioEngine.requestPitch(this._timeDomain, sampleRate); // event/workflow/audio-engine.js
        d.pitch.frequency = workflowAudioEngine.latestPitchFrequency();
        d.pitch.confidence = workflowAudioEngine.latestPitchConfidence();
        const accepted = d.pitch.confidence >= PITCH_MIN_CONFIDENCE ? d.pitch.frequency : -1;
        this._commitPitch(d, Math.round(computeMidiFloatFromFrequency(accepted)), now); // core
    },

    /** Ghi nốt vừa bắt được + trung bình 30 nốt gần nhất (trước đây rubikPitch*). */
    _commitPitch(d, midi, now) {
        if (!isValidMidiNote(midi)) return; // core — NaN/ngoài dải
        d.pitch.midi = midi;
        d.pitch.name = formatMidiNoteName(midi); // core
        d.pitch.time = now;
        pushBoundedHistory(d.pitch.history, midi, AUDIO_PITCH_HISTORY_MAX); // core
        d.pitch.average = computeArrayMean(d.pitch.history); // core
    },

    // ===================== Đặc trưng tức thời =====================

    _measureFrame(d) {
        if (!this._magTable) return;
        computeBandLevels(this._spectrum, this._magTable, this._bandRanges, this._dbMin, this._dbMax, d.bands); // core
        computeBandOnsetStrengths(this._spectrum, this._prevSpectrum, this._bandRanges, this._dbPerByte, this._baselineValid, d.bandOnsets); // core
        computeSpectralShape(this._spectrum, this._magTable, this._binHz, SPECTRAL_ROLLOFF_RATIO, this._magTable[1], d); // core
        d.dominantHz = computeDominantFrequency(this._spectrum, this._binHz); // core
        computeTimeDomainLevels(this._timeDomain, d); // core
        computeChroma(this._spectrum, this._magTable, this._chromaMap, this._chromaNow); // core
    },

    // ===================== Đặc trưng theo thời gian =====================

    _track(frame) {
        const dt = Math.min(100, Math.max(0, frame.nowPerf - this._lastTrackPerf)); // kẹp — tránh 1 bước EMA quá lớn sau chỗ ngắt
        this._lastTrackPerf = frame.nowPerf;
        AUDIO_TRACK_BY_SETTLED[frame.isSettled === true](frame, dt);
    },

    _trackFrame(frame, dt) {
        const d = audioAnalysis._data();
        this._trackSilence(d, frame.nowPerf, frame.mediaTimeSec, frame.mediaDurationSec);
        this._trackBandOnsets(d, frame.nowPerf);
        this._trackLoudness(d, frame.nowPerf, dt);
        this._trackHarmony(d, frame.nowPerf, dt);
        this._trackMelody(d, frame.nowPerf);
    },

    /** Ngắt dòng thời gian của đặc trưng: xoá ring, loudness mồi lại, build-up/im lặng đếm lại. Giữ chroma key (cùng bài). */
    _breakTracking() {
        clearOnsetEnvelope(this._loudnessRing); // core/audio-tempo.js
        clearOnsetEnvelope(this._melodyRing);
        clearOnsetEnvelope(this._noteRing);
        this._loudnessPrimed = false;
        this._buildUpSincePerf = 0;
        this._isQuiet = false;
        this._quietSincePerf = 0;
        this._lastNoteMidi = NaN;
    },

    _trackSilence(d, now, mediaTimeSec, mediaDurationSec) {
        this._isQuiet = isBelowSilenceGate(d.rmsDb, this._isQuiet, SILENCE_ENTER_DB, SILENCE_EXIT_DB); // core
        this._quietSincePerf = this._isQuiet ? (this._quietSincePerf || now) : 0;
        this._hasHeardSound = this._hasHeardSound || !this._isQuiet;
        d.silentForMs = this._isQuiet ? now - this._quietSincePerf : 0;
        d.isSilent = d.silentForMs >= SILENCE_MIN_MS;
        d.silenceKind = d.isSilent ? resolveSilenceKind(this._hasHeardSound, mediaTimeSec, mediaDurationSec, SILENCE_OUTRO_TAIL_SEC, SILENCE_OUTRO_TAIL_RATIO) : null; // core
    },

    _trackBandOnsets(d, now) {
        for (let b = 0; b < d.bandOnsets.length; b++) {
            const history = this._bandHistories[b];
            const isOnset = isBandOnset(d.bandOnsets[b], computeArrayMean(history), now, d.bandOnsetTimes[b],
                BAND_ONSET_MEAN_RATIO, BAND_ONSET_FLOOR_DB, BAND_ONSET_MIN_INTERVAL_MS); // core
            d.bandOnsetTimes[b] = isOnset ? now : d.bandOnsetTimes[b];
            pushBoundedHistory(history, d.bandOnsets[b], BAND_ONSET_HISTORY_MAX); // core
        }
    },

    /** Loudness, xu hướng, build-up, drop. Đầu bài / sau chỗ ngắt mà còn im lặng thì CHƯA mồi (tránh build-up giả); khoảng
     * lặng GIỮA bài vẫn ghi (kéo về sàn) để drop sau khoảng lặng được nhận ra. */
    _trackLoudness(d, now, dt) {
        if (!this._loudnessPrimed && this._isQuiet) return;
        const level = Math.max(LOUDNESS_FLOOR_DB, d.rmsDb);
        const smoothed = smoothLoudnessDb(d.loudnessDb, level, dt, LOUDNESS_TAU_MS); // core
        d.loudnessDb = this._loudnessPrimed ? smoothed : level;
        this._loudnessPrimed = true;
        pushOnsetSample(this._loudnessRing, now, d.loudnessDb); // core/audio-tempo.js (ring theo thời gian dùng chung)
        d.loudnessTrendDbPerSec = computeTimedRingSlope(this._loudnessRing, LOUDNESS_TREND_WINDOW_MS, LOUDNESS_TREND_MIN_SPAN_MS); // core
        d.loudnessTrend = resolveLoudnessTrend(d.loudnessTrendDbPerSec, LOUDNESS_TREND_THRESHOLD_DB_PER_SEC); // core
        // Ngay sau 1 drop, cửa sổ xu hướng còn chứa cú nhảy của chính drop -> chờ hết cửa sổ mới xét build-up.
        const canBuildUp = d.loudnessTrend === 'rising' && now - d.lastDropTime > LOUDNESS_TREND_WINDOW_MS;
        this._buildUpSincePerf = canBuildUp ? (this._buildUpSincePerf || now) : 0;
        d.isBuildUp = this._buildUpSincePerf > 0 && now - this._buildUpSincePerf >= BUILDUP_MIN_MS;
        this._lastBuildUpPerf = d.isBuildUp ? now : this._lastBuildUpPerf;
        const recentMin = computeTimedRingMin(this._loudnessRing, DROP_LOOKBACK_MS); // core
        const isDrop = isLoudnessDrop(d.loudnessDb, recentMin, DROP_JUMP_DB, now, this._lastBuildUpPerf,
            DROP_AFTER_BUILDUP_MS, d.lastDropTime, DROP_MIN_INTERVAL_MS); // core
        d.lastDropTime = isDrop ? now : d.lastDropTime;
    },

    _trackHarmony(d, now, dt) {
        blendChromaTowards(d.chroma, this._chromaNow, dt, CHORD_CHROMA_TAU_MS); // core
        this._applyChord(d, estimateChordFromChroma(d.chroma)); // core
        this._accumulateKeyChroma(dt);
        this._estimateKeyIfDue(d, now);
    },

    _applyChord(d, chord) {
        const ok = !this._isQuiet && chord !== null && chord.score >= CHORD_MIN_SCORE;
        d.chordConfidence = chord ? Math.max(0, chord.score) : 0;
        d.chordRoot = ok ? chord.root : -1;
        d.chordQuality = ok ? chord.quality : null;
        d.chordName = ok ? formatChordName(chord.root, chord.quality, MIDI_NOTE_NAMES) : null; // core
    },

    _accumulateKeyChroma(dt) {
        if (this._isQuiet) return;
        blendChromaTowards(this._keyChroma, this._chromaNow, dt, KEY_CHROMA_TAU_MS); // core
        this._keyTrackedMs += dt;
    },

    _estimateKeyIfDue(d, now) {
        if (now - this._lastKeyEstimatePerf < KEY_ESTIMATE_INTERVAL_MS) return;
        if (this._keyTrackedMs < KEY_MIN_TRACKED_MS) return;
        this._lastKeyEstimatePerf = now;
        this._applyKey(d, estimateKeyFromChroma(this._keyChroma, KEY_PROFILE_MAJOR, KEY_PROFILE_MINOR)); // core
    },

    _applyKey(d, key) {
        if (!key) return;
        const ok = key.correlation >= KEY_MIN_CORRELATION;
        d.keyConfidence = key.correlation;
        d.keyTonic = ok ? key.tonic : -1;
        d.keyMode = ok ? key.mode : null;
        d.keyName = ok ? formatKeyName(key.tonic, key.mode, MIDI_NOTE_NAMES) : null; // core
    },

    /** Hướng giai điệu (qua nhiều nốt) + vibrato (trong 1 nốt), từ cao độ thô của worker. */
    _trackMelody(d, now) {
        const midiRaw = computeMidiFloatFromFrequency(d.pitch.frequency); // core
        const midi = !this._isQuiet && d.pitch.confidence >= PITCH_MIN_CONFIDENCE ? midiRaw : NaN;
        this._resetPitchRingsOnGap(now, midi);
        this._pushPitchSample(now, midi);
        d.melodySlope = computeTimedRingSlope(this._melodyRing, MELODY_WINDOW_MS, MELODY_WINDOW_MS / 2); // core
        d.melodyDirection = resolveMelodyDirection(d.melodySlope, MELODY_DEADBAND_ST_PER_SEC); // core
        const vib = measureVibrato(this._noteRing, VIBRATO_WINDOW_MS, VIBRATO_MIN_SPAN_MS); // core
        d.vibratoRateHz = vib.rateHz;
        d.vibratoExtentCents = vib.extentCents;
        d.vibrato = isVibratoMeasure(vib.rateHz, vib.extentCents, VIBRATO_RATE_MIN_HZ, VIBRATO_RATE_MAX_HZ,
            VIBRATO_EXTENT_MIN_CENTS, VIBRATO_EXTENT_MAX_CENTS); // core
    },

    /** Mất pitch lâu -> xoá ring giai điệu; mất ngắn hoặc nhảy nốt -> xoá ring nốt (nốt mới). */
    _resetPitchRingsOnGap(now, midi) {
        const gap = now - this._lastPitchPerf;
        const jumped = Math.abs(midi - this._lastNoteMidi) > NOTE_JUMP_SEMITONES; // NaN -> false
        this._clearRingIf(this._melodyRing, gap > MELODY_GAP_RESET_MS);
        this._clearRingIf(this._noteRing, gap > NOTE_GAP_MS || jumped);
    },

    _clearRingIf(ring, shouldClear) {
        if (!shouldClear) return;
        clearOnsetEnvelope(ring); // core/audio-tempo.js
    },

    _pushPitchSample(now, midi) {
        if (isNaN(midi)) return;
        pushOnsetSample(this._melodyRing, now, midi); // core/audio-tempo.js
        pushOnsetSample(this._noteRing, now, midi);
        this._lastPitchPerf = now;
        this._lastNoteMidi = midi;
    },

    // ===================== DOM =====================

    /** Thanh trạng thái — dải số liệu ẩn (hoặc đang 'held') thì bỏ qua phần DOM. */
    _paintStats(shouldPaint, energyText, bpmText, noteText) {
        if (!shouldPaint) return;
        paintAudioStatsBar(statEnergy, statBpm, statNote, energyText, bpmText, noteText); // core
    },

    /** Nốt nhạc bay — điều kiện sinh là phép tính trong Core, ở đây chỉ guard, dựng nốt rồi hẹn giờ gỡ. */
    _spawnFlyingNote(isPlaying, smoothedEnergy, frameIndex, hue) {
        if (!shouldSpawnFlyingNote(isPlaying, smoothedEnergy, frameIndex, Math.random())) return; // core/visualizer/draw/flying-note-ui.js
        const note = createFlyingNoteEl(recordContainer, hue); // core
        taskManager.once(() => removeFlyingNoteEl(note), FLYING_NOTE_LIFETIME_MS); // core
    },
};
