/**
 * event/workflow/audio-engine.js — Workflow điều phối Web Audio graph (AudioContext/EQ/master gain/2 analyser) và
 * pitch worker (YIN, core/workers/pitch-worker.js).
 *
 * [MỚI — 01/10/2026, Giang yêu cầu "xử lý toàn bộ" vi phạm core rule phân tích audio] Thay 3 hàm di sản của
 * core/audio-engine.js (setupAudioContext / initPitchWorker / requestPitchDetection — vi phạm R1-R4, xem header file
 * đó). Core bên kia chỉ còn builder thuần; file này làm phần CHUẨN BỊ + ĐIỀU PHỐI:
 *   - `setup()`            — thay `setupAudioContext()`: chưa có context -> dựng graph lần đầu + khởi động vòng lặp;
 *                            đã có -> resume nếu 'suspended'/'interrupted'. Rẽ nhánh bằng object map (mục 7).
 *                            Gọi lại nhiều lần/nhiều nguồn an toàn (Song/Video/Photo/VBG Video đều gọi).
 *   - `ensurePitchWorker()`— thay `initPitchWorker()`.
 *   - `requestPitch()`     — thay `requestPitchDetection()` (event/workflow/audio-analysis.js gọi mỗi frame).
 *   - `setVolume()`        — (01/10/2026) thay `setVolume()` core cũ; âm lượng tách khỏi phân tích (volumeGainNode).
 *   - `discardPendingPitch()` — (01/10/2026) bỏ hồi đáp pitch của bài cũ khi đổi bài.
 *
 * `workflowVisualizerRender.start()` nay do Workflow này gọi (Workflow gọi Workflow — hợp lệ), hết ngoại lệ
 * "Core gọi Workflow" duy nhất từng ghi ở readme/event-bus-flow.md mục 1.
 *
 * Hồi đáp của pitch worker (`onmessage`/`onerror`) được gắn và xử lý NGAY TẠI ĐÂY, không qua Listener -> Router:
 * đó là nửa sau của vòng phân tích mỗi frame (cùng trường hợp riêng với task `raf` ở mục 1 event-bus-flow.md) —
 * đi qua eventBus ~60 lần/giây không mang thêm giá trị gì. Hot path: các `appState.set()` của hồi đáp/khung gửi
 * đi KHÔNG log (ngoại lệ Rule 4 hot path 60fps); các lần ghi 1 lần/phiên (dựng graph, gắn worker, lỗi worker) CÓ log.
 *
 * NẠP: sau core/audio-engine.js + core/eq-presets.js + service/state/audio-engine.js, TRƯỚC
 * event/workflow/audio-analysis.js (xem index.html). Mọi tham chiếu tới workflow khác chỉ xảy ra lúc chạy.
 */

/** Chưa có / đã có AudioContext — object map thay if/else (readme/event-bus-flow.md mục 7). Khoá = `!!audioContext`. */
const AUDIO_ENGINE_SETUP_BY_HAS_CONTEXT = {
    false: () => workflowAudioEngine._buildGraph(),
    true: (audioContext) => workflowAudioEngine._resumeContext(audioContext),
};

const workflowAudioEngine = {
    /** Nguồn MediaElement của `audioPlayer` — giữ tham chiếu suốt phiên (thay biến toàn cục `source` cũ ở
     * core/dom-refs.js). KHÔNG thuộc STATE: không ai khác cần đọc. */
    _songSourceNode: null,
    /** Bộ đếm reqId tăng dần + reqId mới nhất đã nhận — loại hồi đáp CŨ về trễ/sai thứ tự (hiếm, lúc giật khung). */
    _pitchReqCounter: 0,
    _latestPitchReqId: -1,

    /** Đảm bảo audio graph tồn tại và đang chạy. Thay `setupAudioContext()` (core cũ) ở mọi nơi gọi. */
    setup() {
        const audioContext = appState.get('audioContext');
        AUDIO_ENGINE_SETUP_BY_HAS_CONTEXT[!!audioContext](audioContext);
    },

    /** Lần đầu trong phiên: dựng toàn bộ graph (thứ tự nối giữ nguyên bản cũ), ghi state, tạo pitch worker, khởi
     * động 2 task `raf` (phân tích + vẽ), rồi áp nền DOM của visualizer. */
    _buildGraph() {
        const vizCfg = appConfigViz.getAll();
        const { audioContext, sourceNode } = openAudioContextForElement(audioPlayer); // core/audio-engine.js
        this._songSourceNode = sourceNode;
        const analyser = createAnalyserNode(audioContext, APP_CONFIG.fftSizeStandard); // core
        const analyserPitch = createAnalyserNode(audioContext, APP_CONFIG.fftSizePitch); // core
        const masterGainNode = createGainNode(audioContext, 1); // core — cổng seek (câm cả loa lẫn phân tích), bình thường = 1
        const volumeGainNode = createGainNode(audioContext, vizCfg.volume / 100); // core — CHỈ nhánh ra loa (01/10/2026)
        const eq = buildPeakingEqChain(audioContext, sourceNode, EQ_FREQS); // core
        // Preset EQ nạp lúc boot (workflowEqPresets.loadPresetsOnBoot()) — luôn xong trước lượt phát đầu tiên; không
        // khớp id nào (chưa nạp kịp/đã xoá) thì EQ phẳng.
        const activePreset = findEqPresetById(appState.get('eqPresets'), vizCfg.eqPresetId); // core/eq-presets.js
        applyEqGains(eq.filters, activePreset ? activePreset.gains : EQ_FLAT_GAINS); // core/eq-presets.js
        wireAudioOutputGraph(eq.outputNode, masterGainNode, volumeGainNode, analyser, analyserPitch, audioContext.destination); // core
        this._commitGraphState(audioContext, analyser, analyserPitch, masterGainNode, volumeGainNode, eq.filters);
        this.ensurePitchWorker();
        workflowVisualizerRender.start(); // event/workflow/visualizer-render.js — cần analyser đã có trong state
        updateDOMBackground(); // core/color-utils.js
    },

    /** Ghi các node vào state — PHẢI trước `workflowVisualizerRender.start()` (start() đọc `analyser`). */
    _commitGraphState(audioContext, analyser, analyserPitch, masterGainNode, volumeGainNode, eqBandNodes) {
        appState.set('audioContext', audioContext);
        console.log(`writer: "workflowAudioEngine._commitGraphState", page: "audioContext", content: "AudioContext mới (${audioContext.sampleRate} Hz)"`);
        appState.set('analyser', analyser);
        console.log(`writer: "workflowAudioEngine._commitGraphState", page: "analyser", content: "fftSize ${analyser.fftSize}"`);
        appState.set('analyserPitch', analyserPitch);
        console.log(`writer: "workflowAudioEngine._commitGraphState", page: "analyserPitch", content: "fftSize ${analyserPitch.fftSize}"`);
        appState.set('masterGainNode', masterGainNode);
        console.log(`writer: "workflowAudioEngine._commitGraphState", page: "masterGainNode", content: "gain ${masterGainNode.gain.value} (cổng seek)"`);
        appState.set('volumeGainNode', volumeGainNode);
        console.log(`writer: "workflowAudioEngine._commitGraphState", page: "volumeGainNode", content: "gain ${volumeGainNode.gain.value}"`);
        appState.set('eqBandNodes', eqBandNodes);
        console.log(`writer: "workflowAudioEngine._commitGraphState", page: "eqBandNodes", content: "${eqBandNodes.length} dải"`);
    },

    // ===================== Âm lượng =====================

    /**
     * Ứng với 'visualizerDisplay.volume.input' (Volume HUD). THAY `setVolume()` core cũ (core/visualizer/visualizer-display.js,
     * đã xoá 01/10/2026 — R2 tự appState.get, ghi thẳng masterGainNode). Âm lượng giờ nằm ở `volumeGainNode` — node CHỈ có
     * trên nhánh ra loa, nên phân tích audio không đổi theo volume.
     * @param {string|number} value - 0..100
     */
    setVolume(value) {
        appConfigViz.mutateAll((cfg) => { cfg.volume = parseInt(value, 10); });
        const volume = appConfigViz.getAll().volume;
        console.log(`writer: "workflowAudioEngine.setVolume", page: "vizConfig", content: "volume=${volume}"`);
        this._applyVolumeGain(appState.get('volumeGainNode'), volume);
        saveConfig(); // core/config.js
        syncVolumeHudIcon(volume); // core/hud.js — icon loa Volume HUD khớp dù đổi âm lượng từ đâu
    },

    /** Chưa có audio graph (chưa phát lần nào) -> bỏ qua; lượt dựng graph đầu tiên tự đọc volume từ config. */
    _applyVolumeGain(volumeGainNode, volume) {
        if (!volumeGainNode) return;
        volumeGainNode.gain.value = volume / 100;
    },

    /** Đã có context (mọi lượt phát sau lượt đầu): resume nếu 'suspended'/'interrupted' (iOS), không thì no-op. */
    _resumeContext(audioContext) {
        resumeAudioContextIfInterrupted(audioContext, true); // core/audio-engine.js
    },

    // ===================== Pitch worker =====================

    /** Tạo worker nếu chưa có. Trình duyệt không cho tạo -> state giữ null, lượt sau thử lại (như bản cũ). */
    ensurePitchWorker() {
        if (appState.get('pitchWorker')) return;
        this._attachPitchWorker(createPitchWorker(PITCH_WORKER_URL)); // core/audio-engine.js
    },

    /** Gắn handler hồi đáp/lỗi rồi ghi worker vào state. null (tạo thất bại) -> không làm gì. */
    _attachPitchWorker(worker) {
        if (!worker) return;
        worker.onmessage = (e) => this._onPitchReply(e.data);
        worker.onerror = (err) => this._onPitchWorkerError(err);
        appState.set('pitchWorker', worker);
        console.log(`writer: "workflowAudioEngine._attachPitchWorker", page: "pitchWorker", content: "Worker ${PITCH_WORKER_URL}"`);
    },

    /**
     * Gửi 1 khung time-domain cho worker — KHÔNG chờ (kết quả đọc ở `latestPitchFrequency`, có thể trễ vài frame).
     * Worker đang bận (request trước chưa hồi đáp) -> bỏ qua khung này, tránh dồn hàng đợi lúc máy yếu.
     * @param {Float32Array} buf - pitchTimeDomainArray (buffer tái sử dụng — core tự clone trước khi transfer)
     * @param {number} sampleRate
     */
    requestPitch(buf, sampleRate) {
        this.ensurePitchWorker();
        const s = appState.get(['pitchWorker', 'pitchWorkerBusy']);
        if (!s.pitchWorker || s.pitchWorkerBusy) return;
        appState.set('pitchWorkerBusy', true); // hot path — không log (Rule 4 ngoại lệ)
        this._pitchReqCounter++;
        postPitchFrame(s.pitchWorker, buf, sampleRate, this._pitchReqCounter); // core/audio-engine.js
    },

    /** Hồi đáp worker: nhận tần số nếu không phải hồi đáp cũ, rồi luôn nhả cờ bận. */
    _onPitchReply(data) {
        this._acceptPitchFrequency(data.frequency, data.confidence, data.reqId);
        appState.set('pitchWorkerBusy', false); // hot path — không log
    },

    /**
     * Đổi bài/video (event/workflow/audio-analysis.js::resetForNewMedia()): mọi hồi đáp đang "bay" của bài CŨ phải bị bỏ —
     * trước đây chỉ đặt `latestPitchFrequency = -1` nên hồi đáp cũ về sau vẫn được nhận, nốt bài cũ hiện ~250 ms (lỗi 4,
     * 01/10/2026). Nâng mốc reqId lên trên mọi request đã gửi; request kế tiếp (= mốc mới) vẫn được nhận.
     */
    discardPendingPitch() {
        this._latestPitchReqId = this._pitchReqCounter + 1;
        appState.set('latestPitchFrequency', -1);
        appState.set('latestPitchConfidence', 0);
        console.log(`writer: "workflowAudioEngine.discardPendingPitch", page: "latestPitchFrequency", content: "-1 (bỏ hồi đáp tới reqId ${this._pitchReqCounter})"`);
    },

    /** Hồi đáp CŨ hơn hồi đáp đã nhận (về trễ, sai thứ tự) -> bỏ. */
    _acceptPitchFrequency(frequency, confidence, reqId) {
        if (reqId < this._latestPitchReqId) return;
        this._latestPitchReqId = reqId;
        appState.set('latestPitchFrequency', frequency); // hot path — không log
        // hot path — MỚI 01/10/2026. Worker bản cũ còn trong cache (chưa gửi confidence) -> coi như 1 để không chặn nhầm mọi nốt.
        appState.set('latestPitchConfidence', typeof confidence === 'number' ? confidence : 1);
    },

    /** Worker lỗi -> tắt hẳn (state null); `requestPitch()` lượt sau sẽ thử tạo lại. */
    _onPitchWorkerError(err) {
        console.error('[audio-engine] Lỗi pitch-worker, tắt phát hiện cao độ:', err);
        appState.set('pitchWorker', null);
        console.log(`writer: "workflowAudioEngine._onPitchWorkerError", page: "pitchWorker", content: "null"`);
        appState.set('pitchWorkerBusy', false);
        console.log(`writer: "workflowAudioEngine._onPitchWorkerError", page: "pitchWorkerBusy", content: "false"`);
    },
};
