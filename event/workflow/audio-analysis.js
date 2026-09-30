/**
 * event/workflow/audio-analysis.js — Workflow sở hữu task PHÂN TÍCH AUDIO mỗi khung hình
 * (`AUDIO_ANALYSIS_TASK` = 'audioAnalysis', taskManager mode `raf`).
 *
 * [MỚI — 28/09/2026, Phase 2 dọn visualizer, Giang duyệt] TÁCH từ `workflowVisualizerRender._tick()`
 * (event/workflow/visualizer-render.js). Ghi đè file mồ côi cùng tên trước đây (bản cũ không được
 * index.html nạp). Task này LUÔN chạy suốt vòng đời AudioContext, không phụ thuộc Show Visual:
 * Game (workflowGameplay.tick), React Beat của Motion (`beatScale`), visual-bg-common.js
 * (`smoothedEnergy`) và thanh trạng thái BPM/Pitch/Energy đều sống nhờ dữ liệu task này ghi vào
 * appState. Phần VẼ vẫn thuộc `workflowVisualizerRender` (task 'visualizerRender').
 *
 * Mỗi frame, theo đúng thứ tự cũ:
 *   1. Đồng bộ canvas + task vẽ với Show Visual (`workflowVisualizerRender.syncVisibility()`).
 *   2. frameCounter, phát hiện seek (connector), FFT, beatScale, smoothedEnergy, globalHueOffset.
 *   3. Energy + spectral flux (đã chuẩn hoá 128 bin) + baseline phổ.
 *   4. Số liệu theo trạng thái phát: đang phát -> lịch sử flux, beat, BPM, pitch; dừng -> BPM "---".
 *   5. Ghi thanh trạng thái (chỉ khi dải số liệu đang hiện).
 *   6. Game tick, nốt nhạc bay.
 *
 * Rẽ nhánh (readme/event-bus-flow.md mục 7): chỉ guard clause + object map. Tiến trình "đang phát /
 * không phát" chọn qua `AUDIO_STATS_BY_PLAYING`; các bước tuỳ chọn (beat, BPM, pitch, nốt bay, ghi
 * DOM) là method riêng mở đầu bằng guard.
 *
 * Start/pause/resume/kill task: xem `workflowVisualizerRender.start()/stop()/suspendForBackground()/
 * resumeFromBackground()` — nơi điều phối vòng đời chung của CẢ 2 task (điểm gọi: event/workflow/audio-engine.js
 * — thay core/audio-engine.js::setupAudioContext() từ 01/10/2026 — và event/workflow/app-visibility.js).
 *
 * NẠP: trước event/workflow/visualizer-render.js (xem index.html). Mọi tham chiếu tới core/workflow khác
 * chỉ xảy ra lúc chạy (sau khi toàn bộ script đã nạp), không phải lúc nạp file.
 */

const AUDIO_ANALYSIS_TASK = 'audioAnalysis';

/** Tiến trình số liệu theo trạng thái phát — object map thay if/else (key boolean -> 'true'/'false'). */
const AUDIO_STATS_BY_PLAYING = {
    true: (frame) => workflowAudioAnalysis._analyzePlayingStats(frame),
    false: () => workflowAudioAnalysis._resetPlayingStats(),
};

const workflowAudioAnalysis = {
    /** Mảng baseline phổ đã dùng ở frame trước (KHÔNG thuộc STATE — chỉ để so danh tính). Khác với
     * `previousSpectrumArray` hiện tại = mảng vừa được allocateBuffers() cấp phát lại (đổi fftSize khi
     * đổi effect, hoặc lần đầu) -> baseline chưa hợp lệ, flux frame đó = 0. */
    _baselineSpectrum: null,

    /** Đăng ký + bật task phân tích. Chỉ `workflowVisualizerRender.start()` gọi (điều phối cả 2 task).
     * Gọi lại = đăng ký lại từ đầu, baseline phổ coi như chưa có. */
    start() {
        this._baselineSpectrum = null;
        taskManager.addNew(AUDIO_ANALYSIS_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator(AUDIO_ANALYSIS_TASK, 'enabled');
    },

    /** Tick PHÂN TÍCH — 1 lần mỗi khung hình. */
    _tick() {
        const isVisualOff = appConfigViz.getAll().visualEnabled === false;
        workflowVisualizerRender.syncVisibility(isVisualOff); // bật/tắt canvas + task VẼ theo Show Visual

        const s = appState.get([
            'vizDataArray', 'previousSpectrumArray', 'analyser', 'frameCounter', 'smoothedEnergy',
            'globalHueOffset', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'isStatsPanelVisible',
        ]);
        if (!s.vizDataArray) return; // guard — audio context chưa init

        // frameCounter chỉ đếm frame THẬT SỰ có xử lý audio (sau guard). Lịch sử (bug 17/09/2026): từng KHÔNG
        // có chỗ nào tăng biến này — đứng yên ở 0 khiến cooldown bắn neuron synapse tự khoá vĩnh viễn sau lần
        // bắn đầu tiên; nhịp nốt bay mỗi 8 frame, globalTwist vortex cũng đọc nó.
        const frameCounter = s.frameCounter + 1;
        appState.set('frameCounter', frameCounter, { skipCheck: true });

        workflowVisualizerRender._detectMediaSeek(s.isVideoPlayerMode, s.isPhotoPlayerMode); // connector ổn định lại sau seek

        s.analyser.getByteFrequencyData(s.vizDataArray);
        const binCount = s.analyser.frequencyBinCount;
        const media = s.isVideoPlayerMode ? bgVideoElement : audioPlayer;
        const isPlaying = !media.paused;

        const beatScale = computeBeatScale(s.vizDataArray, Math.floor(binCount * 0.1)); // core
        appState.set('beatScale', beatScale, { skipCheck: true });
        const smoothedEnergy = computeSmoothedEnergy(beatScale, s.smoothedEnergy); // core
        appState.set('smoothedEnergy', smoothedEnergy, { skipCheck: true });
        const hue = computeNextGlobalHueOffset(s.globalHueOffset, beatScale, isPlaying); // core
        appState.set('globalHueOffset', hue, { skipCheck: true });

        const energyPercent = computeEnergyPercent(s.vizDataArray, binCount); // core
        const baselineValid = s.previousSpectrumArray === this._baselineSpectrum;
        const flux = computeNormalizedSpectralFlux(s.vizDataArray, s.previousSpectrumArray, binCount, baselineValid); // core
        storeSpectrumBaseline(s.previousSpectrumArray, s.vizDataArray, binCount); // core
        this._baselineSpectrum = s.previousSpectrumArray;

        // "Đang phát" của số liệu chặt hơn `isPlaying` ở trên (thêm currentTime > 0) — giữ nguyên như cũ.
        const now = Date.now();
        const isPlayingStats = isPlaying && media.currentTime > 0;
        AUDIO_STATS_BY_PLAYING[isPlayingStats]({ now, flux, energyPercent });

        const t = appState.get(['currentCalculatedBpm', 'lastValidNoteStr', 'lastValidNoteTime']);
        const noteText = resolveNoteDisplayText(isPlayingStats, energyPercent, t.lastValidNoteStr, t.lastValidNoteTime, now); // core
        this._paintStats(s.isStatsPanelVisible, `${energyPercent}%`, t.currentCalculatedBpm, noteText);

        // Game Mode Circle dùng CHUNG vòng lặp này (layer game là DOM riêng #gameplay-layer, phải chạy
        // cả khi Show Visual tắt). Workflow gọi Workflow — không thuộc phạm vi Rule 3.
        workflowGameplay.tick(performance.now());

        this._spawnFlyingNote(isPlaying, smoothedEnergy, frameCounter, hue);
    },

    /** Tiến trình "đang phát": cập nhật lịch sử flux, phát hiện beat (+ BPM), bắt pitch. */
    _analyzePlayingStats(frame) {
        appState.mutate('fluxHistory', (arr) => pushBoundedHistory(arr, frame.flux, AUDIO_FLUX_HISTORY_MAX), { skipCheck: true }); // core
        const s = appState.get(['fluxHistory', 'lastBeatTime']);
        const isBeat = isSpectralFluxBeat(frame.flux, computeArrayMean(s.fluxHistory), frame.now, s.lastBeatTime, APP_CONFIG.bpmMinWaitTime); // core
        this._commitBeat(isBeat, frame.now, s.lastBeatTime);
        this._detectPitch(frame.energyPercent, frame.now);
    },

    /** Tiến trình "không phát": BPM về "---" (ô Pitch tự về "---" qua resolveNoteDisplayText()). */
    _resetPlayingStats() {
        appState.set('currentCalculatedBpm', '---', { skipCheck: true });
    },

    /** Ghi nhận 1 beat: khoảng cách tới beat trước, mốc beat mới (consumer khác so lệch giá trị này để
     * biết "vừa có beat"), BPM mới. */
    _commitBeat(isBeat, now, lastBeatTime) {
        if (!isBeat) return;
        this._recordBeatInterval(now, lastBeatTime);
        appState.set('lastBeatTime', now, { skipCheck: true });
        const beatTimes = appState.get('beatTimes');
        this._commitBpm(computeBpmFromMeanInterval(computeArrayMean(beatTimes), beatTimes.length)); // core
    },

    /** Beat đầu tiên (chưa có mốc trước) không tạo khoảng cách nào. */
    _recordBeatInterval(now, lastBeatTime) {
        if (lastBeatTime <= 0) return;
        appState.mutate('beatTimes', (arr) => pushBoundedHistory(arr, now - lastBeatTime, AUDIO_BEAT_INTERVALS_MAX), { skipCheck: true }); // core
    },

    /** BPM null (chưa đủ dữ liệu / ngoài khoảng hợp lệ) -> giữ nguyên BPM đang có. */
    _commitBpm(bpm) {
        if (bpm === null) return;
        appState.set('currentCalculatedBpm', String(bpm), { skipCheck: true });
    },

    /** Gửi buffer time-domain cho pitch worker (không chờ) rồi dùng kết quả MỚI NHẤT worker đã trả
     * (`latestPitchFrequency`, có thể trễ vài frame — xem event/workflow/audio-engine.js). Quá nhỏ tiếng thì bỏ qua. */
    _detectPitch(energyPercent, now) {
        if (energyPercent <= 1) return;
        const s = appState.get(['analyserPitch', 'pitchTimeDomainArray', 'audioContext', 'latestPitchFrequency']);
        s.analyserPitch.getFloatTimeDomainData(s.pitchTimeDomainArray);
        // SỬA (01/10/2026) — thay requestPitchDetection() (core di sản, R2/R3) bằng Workflow gọi Workflow.
        workflowAudioEngine.requestPitch(s.pitchTimeDomainArray, s.audioContext.sampleRate); // event/workflow/audio-engine.js
        this._commitPitch(computeMidiNoteFromFrequency(s.latestPitchFrequency), now); // core
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

    /** Ghi thanh trạng thái — dải số liệu đang ẩn thì bỏ qua phần DOM (phần tính toán đã chạy xong). */
    _paintStats(isVisible, energyText, bpmText, noteText) {
        if (!isVisible) return;
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
