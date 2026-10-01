/**
 * event/workflow/audio-analysis.js — Workflow sở hữu task PHÂN TÍCH AUDIO mỗi khung hình
 * (`AUDIO_ANALYSIS_TASK` = 'audioAnalysis', taskManager mode `raf`).
 *
 * [MỚI — 28/09/2026, Phase 2 dọn visualizer, Giang duyệt] TÁCH từ `workflowVisualizerRender._tick()`
 * (event/workflow/visualizer-render.js). Task này LUÔN chạy suốt vòng đời AudioContext, không phụ thuộc Show Visual:
 * Game (workflowGameplay.tick), React Beat của Motion (`beatScale`), visual-bg-common.js (`smoothedEnergy`) và thanh
 * trạng thái BPM/Pitch/Energy đều sống nhờ dữ liệu task này ghi vào appState. Phần VẼ thuộc `workflowVisualizerRender`.
 *
 * [SỬA — 01/10/2026, Giang: fix lỗi audio 2/3/4/5]
 *   - (5) Số liệu CHUNG (beatScale/smoothedEnergy/energy/flux/beat/BPM) đọc từ phổ PHÂN TÍCH cố định
 *     `analysisSpectrumArray` (analyserPitch, FFT 2048) thay vì phổ vẽ `vizDataArray` (fftSize đổi theo effect).
 *     `vizDataArray` vẫn được đọc mỗi frame cho các effect tự tính (mirror, black hole, synapse...).
 *   - (2) BPM: ước lượng bằng tự tương quan đường bao onset (core/audio-tempo.js) thay "trung bình 5 khoảng beat".
 *     Pha phát chia 3 (`resolveAnalysisPlaybackPhase()`): cổng seek giữ media / đang seek = 'held' (số liệu giữ nguyên,
 *     hết nháy "---"); mọi lần dòng thời gian bị ngắt (held/dừng/seek/app ẩn/đổi bài) -> xoá đường bao + bỏ qua beat
 *     ANALYSIS_SETTLE_MS (hết beat giả lúc phổ dâng lại). BPM của bài đang phát hiện lại NGAY khi resume.
 *   - (3)(4) `resetForNewMedia()` — reset số liệu phân tích theo bài, dùng CHUNG Song + Video (gọi từ
 *     workflowVisualizerRender.resetForNewMedia()), bỏ luôn hồi đáp pitch đang bay của bài cũ.
 *   - Đặc trưng mở rộng (dải Hz, onset theo dải, centroid/rolloff/spread/flatness, tần số trội, chroma/key/hợp âm,
 *     độ tin cậy pitch, hướng giai điệu/vibrato, RMS/peak/crest/ZCR, im lặng, xu hướng loudness/build-up/drop): giao
 *     event/workflow/audio-features.js (`measureFrame()` trước khi ghi baseline, `track()` sau khi xét pha). Pitch giờ
 *     lọc theo độ tin cậy YIN (PITCH_MIN_CONFIDENCE).
 *
 * Mỗi frame:
 *   1. Đồng bộ canvas + task vẽ với Show Visual (`workflowVisualizerRender.syncVisibility()`).
 *   2. frameCounter; phát hiện seek + khoảng hở tick (-> ngắt dòng thời gian).
 *   3. FFT vẽ + FFT phân tích; beatScale, smoothedEnergy, globalHueOffset; energy; flux + độ mạnh onset theo dải.
 *   4. Số liệu theo pha: playing -> pitch, (qua ổn định) lịch sử flux, beat, đường bao + ước lượng tempo;
 *      held -> giữ nguyên; stopped -> BPM "---".
 *   5. Ghi thanh trạng thái (dải số liệu đang hiện và không 'held').
 *   6. Game tick, nốt nhạc bay.
 *
 * Rẽ nhánh (readme/event-bus-flow.md mục 7): chỉ guard clause + object map (`AUDIO_STATS_BY_PHASE`).
 *
 * Start/pause/resume/kill task: xem `workflowVisualizerRender.start()/stop()/suspendForBackground()/
 * resumeFromBackground()` (điểm gọi: event/workflow/audio-engine.js và event/workflow/app-visibility.js).
 *
 * NẠP: sau core/audio-analysis.js + core/audio-tempo.js (field `_onsetEnvelope` tạo lúc nạp), trước
 * event/workflow/visualizer-render.js. Tham chiếu tới workflow khác chỉ xảy ra lúc chạy.
 */

const AUDIO_ANALYSIS_TASK = 'audioAnalysis';

/** Tiến trình số liệu theo pha phát — object map thay if/else (khoá = resolveAnalysisPlaybackPhase()). */
const AUDIO_STATS_BY_PHASE = {
    playing: (frame) => workflowAudioAnalysis._analyzePlayingStats(frame),
    held: () => workflowAudioAnalysis._holdPlayingStats(),
    stopped: () => workflowAudioAnalysis._resetPlayingStats(),
};

const workflowAudioAnalysis = {
    /** Baseline phổ (previousSpectrumArray) đã hợp lệ chưa — false ngay sau cấp phát (start()). */
    _baselineValid: false,
    /** Mép dải tần log cho độ mạnh onset — tính lại ở allocateBuffers() theo sampleRate thật. */
    _onsetBandEdges: null,
    /** Đường bao onset (ring buffer) + lưới đều để tự tương quan — core/audio-tempo.js. */
    _onsetEnvelope: createOnsetEnvelope(TEMPO_ENVELOPE_CAPACITY),
    _tempoGrid: new Float32Array(Math.ceil(TEMPO_WINDOW_MS * TEMPO_GRID_RATE_HZ / 1000) + 1),
    /** Các ước lượng tempo gần nhất (thô) + BPM đang dùng của bài hiện tại (null = chưa có). */
    _tempoHistory: [],
    _bpm: null,
    _lastTempoEstimatePerf: 0,
    /** Ngắt dòng thời gian: chờ frame 'playing' kế tiếp để mở cửa sổ ổn định. */
    _settlePending: true,
    _settleUntilPerf: 0,
    _lastTickPerf: 0,

    /** Cấp phát bộ đệm phân tích + đăng ký, bật task. Chỉ `workflowVisualizerRender.start()` gọi (điều phối cả 2 task). */
    start() {
        this.allocateBuffers();
        this._breakTimeline();
        taskManager.addNew(AUDIO_ANALYSIS_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator(AUDIO_ANALYSIS_TASK, 'enabled');
    },

    /** Bộ đệm theo analyser PHÂN TÍCH (FFT cố định) — cấp 1 lần mỗi lần dựng graph, KHÔNG đổi theo effect (khác
     * `vizDataArray`, xem workflowVisualizerRender.allocateVizSpectrumBuffer()). */
    allocateBuffers() {
        const { analyserPitch, audioContext } = appState.get(['analyserPitch', 'audioContext']);
        if (!analyserPitch || !audioContext) return;
        const binCount = analyserPitch.frequencyBinCount;
        appState.set('analysisSpectrumArray', new Uint8Array(binCount));
        appState.set('previousSpectrumArray', new Uint8Array(binCount));
        appState.set('pitchTimeDomainArray', new Float32Array(analyserPitch.fftSize));
        console.log(`writer: "workflowAudioAnalysis.allocateBuffers", page: "analysisSpectrumArray/previousSpectrumArray/pitchTimeDomainArray", content: "${binCount} bin, ${analyserPitch.fftSize} mẫu"`);
        this._onsetBandEdges = buildOnsetBandEdges(binCount, audioContext.sampleRate, TEMPO_ONSET_FREQ_MIN_HZ, TEMPO_ONSET_FREQ_MAX_HZ, TEMPO_ONSET_BAND_COUNT); // core/audio-tempo.js
        this._baselineValid = false;
        workflowAudioFeatures.allocate(analyserPitch, audioContext.sampleRate); // event/workflow/audio-features.js
    },

    /**
     * Đổi bài/video — reset số liệu phân tích THEO BÀI, dùng chung Song + Video (lỗi 3, 01/10/2026: trước đây chỉ nhánh
     * Song reset trong event/workflow/player.js, Video giữ BPM/nhịp/nốt của video trước). Gọi từ
     * workflowVisualizerRender.resetForNewMedia(). An toàn cả khi chưa có audio graph.
     */
    resetForNewMedia() {
        this._breakTimeline();
        this._tempoHistory = [];
        this._bpm = null;
        this._lastTempoEstimatePerf = 0;
        appState.set('fluxHistory', []);
        appState.set('currentCalculatedBpm', '---');
        appState.set('lastValidNoteStr', null);
        appState.set('lastValidNoteTime', 0);
        appState.set('lastValidMidiNote', null);
        appState.set('rubikPitchHistory', []);
        appState.set('rubikPitchAvg', 0);
        console.log(`writer: "workflowAudioAnalysis.resetForNewMedia", page: "fluxHistory/currentCalculatedBpm/lastValidNote*/rubikPitch*", content: "reset theo bài mới"`);
        workflowAudioEngine.discardPendingPitch(); // event/workflow/audio-engine.js — bỏ hồi đáp pitch của bài cũ (lỗi 4)
        workflowAudioFeatures.resetForNewMedia(); // event/workflow/audio-features.js — key/hợp âm/onset/im lặng theo bài
        statBpm.textContent = '---';
        statNote.textContent = '---';
    },

    /** Tick PHÂN TÍCH — 1 lần mỗi khung hình. */
    _tick() {
        const isVisualOff = appConfigViz.getAll().visualEnabled === false;
        workflowVisualizerRender.syncVisibility(isVisualOff); // bật/tắt canvas + task VẼ theo Show Visual

        const s = appState.get([
            'vizDataArray', 'analysisSpectrumArray', 'previousSpectrumArray', 'pitchTimeDomainArray', 'analyser', 'analyserPitch', 'frameCounter',
            'smoothedEnergy', 'globalHueOffset', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'isStatsPanelVisible',
        ]);
        if (!s.vizDataArray || !s.analysisSpectrumArray) return; // guard — audio context chưa init

        // frameCounter chỉ đếm frame THẬT SỰ có xử lý audio (sau guard). Lịch sử (bug 17/09/2026): từng KHÔNG
        // có chỗ nào tăng biến này — cooldown bắn neuron synapse tự khoá; nhịp nốt bay, globalTwist vortex cũng đọc nó.
        const frameCounter = s.frameCounter + 1;
        appState.set('frameCounter', frameCounter, { skipCheck: true });

        const nowPerf = performance.now();
        this._breakOnTickGap(nowPerf);
        const isSeek = workflowVisualizerRender._detectMediaSeek(s.isVideoPlayerMode, s.isPhotoPlayerMode); // connector ổn định lại sau seek
        this._breakOnSeek(isSeek);

        s.analyser.getByteFrequencyData(s.vizDataArray); // phổ VẼ — effect tự đọc
        s.analyserPitch.getByteFrequencyData(s.analysisSpectrumArray); // phổ PHÂN TÍCH — cố định, không đổi theo effect
        s.analyserPitch.getFloatTimeDomainData(s.pitchTimeDomainArray); // sóng ~46 ms mới nhất — RMS/ZCR (audio-features) + pitch
        const spectrum = s.analysisSpectrumArray;
        const binCount = spectrum.length;
        const media = s.isVideoPlayerMode ? bgVideoElement : audioPlayer;
        const isPlaying = !media.paused;

        const beatScale = computeBeatScale(spectrum, Math.floor(binCount * 0.1)); // core
        appState.set('beatScale', beatScale, { skipCheck: true });
        const smoothedEnergy = computeSmoothedEnergy(beatScale, s.smoothedEnergy); // core
        appState.set('smoothedEnergy', smoothedEnergy, { skipCheck: true });
        const hue = computeNextGlobalHueOffset(s.globalHueOffset, beatScale, isPlaying); // core
        appState.set('globalHueOffset', hue, { skipCheck: true });

        const energyPercent = computeEnergyPercent(spectrum, binCount); // core
        const flux = computeNormalizedSpectralFlux(spectrum, s.previousSpectrumArray, binCount, this._baselineValid); // core
        const onset = computeBandedOnsetStrength(spectrum, s.previousSpectrumArray, this._onsetBandEdges, this._baselineValid); // core/audio-tempo.js
        workflowAudioFeatures.measureFrame(spectrum, s.previousSpectrumArray, this._baselineValid, s.pitchTimeDomainArray); // TRƯỚC khi ghi đè baseline
        storeSpectrumBaseline(s.previousSpectrumArray, spectrum, binCount); // core
        this._baselineValid = true;

        // 'held' = cổng seek đang giữ media hoặc media đang seek — KHÔNG phải người dùng dừng.
        const isHeld = media.seeking || workflowPlayerControls.isHeldBySeekGate(media); // event/workflow/player-controls.js
        const phase = resolveAnalysisPlaybackPhase(isHeld, media.paused, media.currentTime); // core
        const now = Date.now();
        // Có tín hiệu = RMS trên ngưỡng im lặng (audio-features vừa đo ở measureFrame()) — cổng cho pitch + ô Pitch.
        const features = appState.get('audioFeatures');
        const hasSignal = !!features && features.rmsDb > SILENCE_ENTER_DB;
        AUDIO_STATS_BY_PHASE[phase]({ now, nowPerf, flux, onset, hasSignal });
        const p = appState.get(['latestPitchFrequency', 'latestPitchConfidence']);
        workflowAudioFeatures.track({
            nowPerf,
            isSettled: phase === 'playing' && !this._settlePending && nowPerf >= this._settleUntilPerf, // cùng quy tắc ổn định với BPM
            mediaTimeSec: media.currentTime,
            mediaDurationSec: media.duration,
            pitchFrequency: p.latestPitchFrequency,
            pitchConfidence: p.latestPitchConfidence,
        });

        const t = appState.get(['currentCalculatedBpm', 'lastValidNoteStr', 'lastValidNoteTime']);
        const noteText = resolveNoteDisplayText(phase !== 'stopped', hasSignal, t.lastValidNoteStr, t.lastValidNoteTime, now); // core
        // Lúc cổng seek giữ media (vài trăm ms), phổ bị câm tạm — giữ nguyên 3 ô số liệu thay vì nháy về 0%/---.
        this._paintStats(s.isStatsPanelVisible && phase !== 'held', `${energyPercent}%`, t.currentCalculatedBpm, noteText);

        // Game Mode Circle dùng CHUNG vòng lặp này (layer game là DOM riêng #gameplay-layer, phải chạy
        // cả khi Show Visual tắt). Workflow gọi Workflow — không thuộc phạm vi Rule 3.
        workflowGameplay.tick(performance.now());

        this._spawnFlyingNote(isPlaying, smoothedEnergy, frameCounter, hue);
    },

    // ===================== Ngắt dòng thời gian =====================

    /** Xoá đường bao tempo + hẹn cửa sổ ổn định ở frame 'playing' kế tiếp. BPM của bài GIỮ nguyên (cùng bài thì tempo
     * không đổi) — chỉ phần dữ liệu vắt qua chỗ ngắt bị bỏ. */
    _breakTimeline() {
        clearOnsetEnvelope(this._onsetEnvelope); // core/audio-tempo.js
        this._settlePending = true;
    },

    /** 2 tick cách nhau quá xa (app ẩn — task bị pause, máy treo) -> ngắt. */
    _breakOnTickGap(nowPerf) {
        const gap = nowPerf - this._lastTickPerf;
        this._lastTickPerf = nowPerf;
        if (gap <= ANALYSIS_TICK_GAP_MS) return;
        this._breakTimeline();
    },

    /** Seek mọi nguồn (kể cả kéo video không qua cổng, đổi Song <-> Video) -> ngắt. */
    _breakOnSeek(isSeek) {
        if (!isSeek) return;
        this._breakTimeline();
    },

    /** Frame 'playing' đầu tiên sau 1 lần ngắt: mở cửa sổ ổn định. */
    _openSettleWindowIfPending(nowPerf) {
        if (!this._settlePending) return;
        this._settlePending = false;
        this._settleUntilPerf = nowPerf + ANALYSIS_SETTLE_MS;
    },

    // ===================== Theo pha phát =====================

    /** Đang phát: pitch; BPM bài hiện tại hiện lại ngay; qua cửa sổ ổn định mới đến flux/beat/tempo. */
    _analyzePlayingStats(frame) {
        this._openSettleWindowIfPending(frame.nowPerf);
        this._showCurrentBpm();
        this._detectPitch(frame.hasSignal, frame.now);
        if (frame.nowPerf < this._settleUntilPerf) return; // guard — phổ đang dâng lại sau chỗ ngắt
        appState.mutate('fluxHistory', (arr) => pushBoundedHistory(arr, frame.flux, AUDIO_FLUX_HISTORY_MAX), { skipCheck: true }); // core
        const s = appState.get(['fluxHistory', 'lastBeatTime']);
        const isBeat = isSpectralFluxBeat(frame.flux, computeArrayMean(s.fluxHistory), frame.now, s.lastBeatTime, APP_CONFIG.bpmMinWaitTime); // core
        this._commitBeat(isBeat, frame.now);
        pushOnsetSample(this._onsetEnvelope, frame.nowPerf, frame.onset); // core/audio-tempo.js
        this._estimateTempoIfDue(frame.nowPerf);
    },

    /** Cổng seek giữ media / đang seek: giữ nguyên số liệu, chỉ ngắt dòng thời gian. */
    _holdPlayingStats() {
        this._breakTimeline();
    },

    /** Dừng thật: ô BPM về "---" (ô Pitch tự về "---" qua resolveNoteDisplayText()); BPM của bài vẫn nhớ trong
     * `_bpm` để hiện lại ngay khi phát tiếp. */
    _resetPlayingStats() {
        this._breakTimeline();
        appState.set('currentCalculatedBpm', '---', { skipCheck: true });
    },

    /** BPM đã ước lượng của bài đang phát (chưa có -> giữ "---"). */
    _showCurrentBpm() {
        if (this._bpm === null) return;
        appState.set('currentCalculatedBpm', String(this._bpm), { skipCheck: true });
    },

    /** Mốc beat mới cho các consumer so lệch (dot, brain, black hole, cửa sổ beat...). Không còn dùng cho BPM. */
    _commitBeat(isBeat, now) {
        if (!isBeat) return;
        appState.set('lastBeatTime', now, { skipCheck: true });
    },

    // ===================== Tempo (BPM) — core/audio-tempo.js =====================

    /** Mỗi TEMPO_ESTIMATE_INTERVAL_MS, khi đường bao đã phủ >= TEMPO_MIN_WINDOW_MS: ước lượng lại. */
    _estimateTempoIfDue(nowPerf) {
        if (nowPerf - this._lastTempoEstimatePerf < TEMPO_ESTIMATE_INTERVAL_MS) return;
        if (computeOnsetEnvelopeSpanMs(this._onsetEnvelope) < TEMPO_MIN_WINDOW_MS) return; // core
        this._lastTempoEstimatePerf = nowPerf;
        const count = resampleOnsetEnvelope(this._onsetEnvelope, TEMPO_GRID_RATE_HZ, TEMPO_WINDOW_MS, this._tempoGrid); // core
        const estimate = estimateTempoFromOnsets(this._tempoGrid, count, TEMPO_GRID_RATE_HZ, TEMPO_MIN_BPM, TEMPO_MAX_BPM,
            TEMPO_PRIOR_BPM, TEMPO_PRIOR_STD_OCTAVE, TEMPO_DETREND_HALF_MS, TEMPO_DOUBLE_SUPPORT_RATIO); // core
        this._acceptTempoEstimate(estimate);
    },

    /** Ước lượng đủ tin cậy -> vào lịch sử; các ước lượng cũ gập về quãng tám của ước lượng MỚI NHẤT rồi lấy trung vị. */
    _acceptTempoEstimate(estimate) {
        if (!estimate || estimate.confidence < TEMPO_MIN_CONFIDENCE) return; // nhạc không có nhịp rõ -> giữ BPM đang có
        pushBoundedHistory(this._tempoHistory, estimate.bpm, TEMPO_HISTORY_MAX); // core/audio-analysis.js
        const folded = this._tempoHistory.map((bpm) => foldTempoToReference(bpm, estimate.bpm, TEMPO_OCTAVE_FOLD_TOLERANCE)); // core
        this._bpm = Math.round(computeArrayMedian(folded)); // core
        appState.set('currentCalculatedBpm', String(this._bpm), { skipCheck: true });
    },

    // ===================== Pitch =====================

    /** Gửi buffer time-domain cho pitch worker (không chờ) rồi dùng kết quả MỚI NHẤT worker đã trả
     * (`latestPitchFrequency`, có thể trễ vài frame — xem event/workflow/audio-engine.js). Không có tín hiệu (RMS dưới
     * ngưỡng im lặng — SỬA 01/10/2026, trước đây energy <= 1%) thì bỏ qua. */
    _detectPitch(hasSignal, now) {
        if (!hasSignal) return;
        const s = appState.get(['pitchTimeDomainArray', 'audioContext', 'latestPitchFrequency', 'latestPitchConfidence']);
        workflowAudioEngine.requestPitch(s.pitchTimeDomainArray, s.audioContext.sampleRate); // event/workflow/audio-engine.js — sóng đã đọc đầu _tick()
        // MỚI 01/10/2026 — loại nốt giả: độ tin cậy YIN dưới PITCH_MIN_CONFIDENCE (core/audio-features.js) thì bỏ.
        const frequency = s.latestPitchConfidence >= PITCH_MIN_CONFIDENCE ? s.latestPitchFrequency : -1;
        this._commitPitch(computeMidiNoteFromFrequency(frequency), now); // core
    },

    /** Ghi nốt vừa bắt được + cập nhật pha tham chiếu cho Rubik (luôn chạy dù dải số liệu ẩn). */
    _commitPitch(midi, now) {
        if (midi === null) return;
        appState.set('lastValidNoteStr', formatMidiNoteName(midi), { skipCheck: true }); // core
        appState.set('lastValidNoteTime', now, { skipCheck: true });
        appState.set('lastValidMidiNote', midi, { skipCheck: true });
        appState.mutate('rubikPitchHistory', (arr) => pushBoundedHistory(arr, midi, AUDIO_PITCH_HISTORY_MAX), { skipCheck: true }); // core
        appState.set('rubikPitchAvg', computeArrayMean(appState.get('rubikPitchHistory')), { skipCheck: true }); // core
    },

    // ===================== DOM =====================

    /** Ghi thanh trạng thái — dải số liệu đang ẩn (hoặc đang 'held') thì bỏ qua phần DOM (phần tính toán đã chạy xong). */
    _paintStats(shouldPaint, energyText, bpmText, noteText) {
        if (!shouldPaint) return;
        paintAudioStatsBar(statEnergy, statBpm, statNote, energyText, bpmText, noteText); // core
    },

    /** Nốt nhạc bay — điều kiện sinh là phép tính trong Core (shouldSpawnFlyingNote), ở đây chỉ làm guard,
     * dựng nốt rồi hẹn giờ gỡ (taskManager — chỉ Workflow được dùng). */
    _spawnFlyingNote(isPlaying, smoothedEnergy, frameCounter, hue) {
        if (!shouldSpawnFlyingNote(isPlaying, smoothedEnergy, frameCounter, Math.random())) return; // core/visualizer/draw/flying-note-ui.js
        const note = createFlyingNoteEl(recordContainer, hue); // core
        taskManager.once(() => removeFlyingNoteEl(note), FLYING_NOTE_LIFETIME_MS); // core
    },
};
