/**
 * event/workflow/visualizer-render.js — HOST của hệ Visualizer: vòng đời 2 task `raf`, dựng frame context,
 * tra registry style -> hàm vẽ, và phát hook vòng đời cho từng group.
 *
 * [VIẾT LẠI — 28/09/2026, Phase 3-4 dọn visualizer, Giang duyệt] Trước đây file này ~1540 dòng ("God workflow"):
 * toàn bộ điều phối của 16 style + ~35 biến trạng thái cấp module + chuỗi if/else theo type/style. Nay tách:
 *   - File này (host): start/stop/suspend/resume, Show Visual, phát hiện seek, resize khung nhìn, đổi/kích hoạt
 *     style, dựng frame context + dispatch qua registry. KHÔNG còn chứa logic riêng của effect nào.
 *   - event/workflow/visualizer/<group>.js — 6 group (bar, rain, lighting, shape, vortex, connector), mỗi file
 *     giữ trạng thái RIÊNG của group mình + bảng `styles` (style -> hàm vẽ) + hook vòng đời tuỳ chọn:
 *       activate(style)      — style của group vừa được chọn (vd dựng scene WebGL lần đầu, ẩn/hiện nhóm mesh)
 *       onResize(viewport)   — khung nhìn đổi kích thước ({ width, height, dpr } px CSS)
 *       onStyleApplied(vp)   — người dùng/auto-switch vừa chọn style thuộc group (sau activate + saveConfig)
 *       onSeek()             — media vừa nhảy thời gian (connector ổn định lại FFT)
 *       onNewMedia()         — đổi bài/video (connector dọn tia đang bay)
 *       rebuild()            — Custom Effect đổi field cần dựng lại scene (vortex/connector)
 *     Group tự đăng ký lúc nạp file: `workflowVisualizerRender.registerGroup('<group>', workflowVizXxx)`.
 *   - event/workflow/visualizer/beat-window.js — điều phối "cửa sổ beat flux" dùng chung 4 effect.
 *   - event/workflow/audio-analysis.js — task PHÂN TÍCH (Phase 2), gọi `syncVisibility()`/`_detectMediaSeek()`.
 *
 * Vòng đời WebGL (Phase 3): resize CHỈ đổi camera/renderer/composer (không dựng lại scene — trước đây mỗi lần
 * resize dựng lại cả scene Vortex, scene cũ không dispose -> rò GPU); dựng lại Vortex/Connector (Custom Effect)
 * dispose scene cũ trước (core/webgl/three-common.js).
 *
 * Rẽ nhánh (readme/event-bus-flow.md mục 7): chỉ guard clause + object map.
 *
 * Show Visual vẫn đồng bộ bằng cách so 1 cờ mỗi frame (`syncVisibility()`, task phân tích gọi) — CỐ Ý giữ: mọi
 * đường đổi `visualEnabled` (toggle, Restore default, boot, khôi phục backup) đều tự được bắt, không cần phát
 * event ở từng nơi.
 *
 * Điểm khởi động: event/workflow/audio-engine.js::_buildGraph() gọi `start()` (Workflow gọi Workflow — từ 01/10/2026;
 * trước đó là core/audio-engine.js::setupAudioContext(), ngoại lệ Core gọi Workflow nay đã hết). `start()` giờ tự dựng canvas/scene theo khung nhìn (thay `resizeCanvas()` cũ đứng ngay
 * trước nó).
 *
 * NẠP: sau event/workflow/audio-analysis.js, TRƯỚC 6 file event/workflow/visualizer/*.js (các file đó gọi
 * `registerGroup()` lúc nạp). Mọi tham chiếu khác chỉ xảy ra lúc chạy.
 */

const RENDER_TASK = 'visualizerRender'; // CHỈ vẽ — bật/tắt theo cfg.visualEnabled (xem _syncRenderTask())

// currentTime nhảy quá ngưỡng này giữa 2 frame (dù `seeking` kịp bắn hay không — seek blob cục bộ có thể xong
// trong <1 frame) = 1 lần seek. Playback 2x chỉ tiến ~0.03s/frame.
const SEEK_JUMP_THRESHOLD_SEC = 0.5;

/** Hook group không cài -> không làm gì. */
const VIZ_NOOP = () => {};

/** Show Visual đổi trạng thái -> bật/tắt task VẼ (object map, key = isVisualOff). Tắt dùng `kill()` (KHÔNG
 * `pause()`: `resumeAll()` lúc hiện lại tab sẽ vô tình chạy lại task đang "tắt vì Show Visual"). */
const VIZ_RENDER_TASK_BY_VISUAL_OFF = {
    true: () => taskManager.kill(RENDER_TASK),
    false: () => workflowVisualizerRender._startRenderTask(),
};

/** Màu 1 phần tử theo color mode của effect — dùng chung các effect tự chọn màu theo mode (vortex rings/bars/
 * wave, đèn Rain street): gradient = màu getComputedColor() đã tính, dynamic = xen kẽ dynA/dynB theo index,
 * solid = solidColor. */
const VIZ_MODE_COLOR_BY_MODE = {
    gradient: (cfg, index, gradientFill) => gradientFill,
    dynamic: (cfg, index) => (index % 2 === 0 ? cfg.dynA : cfg.dynB),
    solid: (cfg) => cfg.solidColor,
};

const workflowVisualizerRender = {
    /** Cờ nội bộ (KHÔNG thuộc STATE) — RENDER_TASK hiện có đang đăng ký + chạy hay không. */
    _renderActive: false,

    // Phát hiện seek (KHÔNG thuộc STATE) — xem `_detectMediaSeek()`/SEEK_JUMP_THRESHOLD_SEC.
    _seekLastMedia: null,
    _seekLastTime: 0,

    /** group -> workflow của group (event/workflow/visualizer/*.js tự đăng ký lúc nạp). */
    _groups: {},

    /** Group tự đăng ký lúc nạp file. */
    registerGroup(group, groupWorkflow) {
        this._groups[group] = groupWorkflow;
    },

    // ===================== Vòng đời task =====================

    /** Dựng canvas/scene theo khung nhìn rồi đăng ký + bật task phân tích. Task VẼ không đăng ký ở đây:
     * `workflowAudioAnalysis._tick()` tự bật nó ở frame đầu nếu Show Visual đang bật (`syncVisibility()`).
     * Gọi lại `start()` = dọn task vẽ rồi dựng lại từ đầu. */
    start() {
        taskManager.kill(RENDER_TASK);
        this._renderActive = false;
        this.allocateVizSpectrumBuffer(); // phổ VẼ theo FFT effect hiện tại (bộ đệm phân tích: workflowAudioAnalysis.start())
        this.rebuildCanvasScenes(); // thay resizeCanvas() cũ (từng được gọi ngay trước start())
        workflowAudioAnalysis.start(); // event/workflow/audio-analysis.js
    },

    /** Không có nơi nào gọi hiện tại — giữ để đối xứng API. */
    stop() {
        taskManager.kill(RENDER_TASK);
        taskManager.kill(AUDIO_ANALYSIS_TASK); // event/workflow/audio-analysis.js
        this._renderActive = false;
    },

    /** Ẩn tab/PWA ở chế độ không Game — TẠM DỪNG cả 2 task (pause(), giữ đăng ký). Task vẽ đã bị kill vì Show
     * Visual tắt -> pause() no-op. Gọi từ event/workflow/app-visibility.js. */
    suspendForBackground() {
        taskManager.pause(AUDIO_ANALYSIS_TASK); // event/workflow/audio-analysis.js
        taskManager.pause(RENDER_TASK);
        console.log('[workflowVisualizerRender] tạm dừng task "audioAnalysis" + "visualizerRender" (app ẩn)'); // log vòng đời task — không phải ghi appState
    },

    /** Ngược lại `suspendForBackground()` — resume() tự guard. */
    resumeFromBackground() {
        taskManager.resume(AUDIO_ANALYSIS_TASK); // event/workflow/audio-analysis.js
        taskManager.resume(RENDER_TASK);
        console.log('[workflowVisualizerRender] chạy lại task "audioAnalysis" + "visualizerRender" (app hiện lại)');
    },

    /** `workflowAudioAnalysis._tick()` gọi mỗi frame: ẩn/hiện 2 canvas + bật/tắt task VẼ theo Show Visual. */
    syncVisibility(isVisualOff) {
        updateCanvasVisibility(canvas, document.getElementById('webgl-canvas'), isVisualOff); // core
        this._syncRenderTask(isVisualOff);
    },

    /** Chỉ thật sự làm gì khi trạng thái ĐỔI (so cờ `_renderActive`). */
    _syncRenderTask(isVisualOff) {
        if (this._renderActive === !isVisualOff) return;
        this._renderActive = !isVisualOff;
        VIZ_RENDER_TASK_BY_VISUAL_OFF[isVisualOff]();
        console.log(`[workflowVisualizerRender] task "${RENDER_TASK}" ${isVisualOff ? 'đã kill (Show Visual tắt)' : 'đã start (Show Visual bật)'}`); // log vòng đời task
    },

    _startRenderTask() {
        taskManager.addNew(RENDER_TASK, { time: 0, exe: () => this._tickDraw(), mode: 'raf', count: 0 });
        taskManager.operator(RENDER_TASK, 'enabled');
    },

    // ===================== Sự kiện media / khung nhìn =====================

    /** Phát hiện media vừa SEEK (mọi nguồn: kéo thanh seek, cử chỉ, Media Session, đổi bài, tab ẩn rồi hiện lại)
     * — task phân tích gọi mỗi frame. Photo Player mode bỏ qua (không có audio/seek thật).
     * SỬA 01/10/2026: trả kết quả để task phân tích ngắt đường bao tempo (workflowAudioAnalysis._breakOnSeek()).
     * @returns {boolean} */
    _detectMediaSeek(isVideoPlayerMode, isPhotoPlayerMode) {
        if (isPhotoPlayerMode) return false;
        const media = isVideoPlayerMode ? bgVideoElement : audioPlayer;
        const t = media.currentTime;
        const isSeek = media.seeking || media !== this._seekLastMedia || Math.abs(t - this._seekLastTime) > SEEK_JUMP_THRESHOLD_SEC;
        this._seekLastMedia = media;
        this._seekLastTime = t;
        this._notifySeek(isSeek);
        return isSeek;
    },

    _notifySeek(isSeek) {
        if (!isSeek) return;
        this._broadcast('onSeek');
    },

    /** MỚI (Phase 3) — đổi bài/video: báo mọi group dọn trạng thái theo bài (thay các lời gọi thẳng
     * `resetConnectorPerTrackState()` rải ở event/workflow/player.js + video-player.js). */
    resetForNewMedia() {
        workflowAudioAnalysis.resetForNewMedia(); // event/workflow/audio-analysis.js — MỚI 01/10/2026: số liệu phân tích theo bài, chung Song + Video
        this._broadcast('onNewMedia');
    },

    /** MỚI (Phase 3) — router 'visualizerViewport' gọi khi cửa sổ đổi kích thước (thay listener `resize` cũ đặt
     * thẳng trong core/canvas-scene-setup.js). */
    onViewportResize() {
        this.rebuildCanvasScenes();
    },

    /** Đặt dpr + kích thước canvas 2D + renderer WebGL theo khung nhìn hiện tại rồi báo mọi group `onResize`
     * (dựng lại cảnh 2D phụ thuộc kích thước; WebGL chỉ đổi camera/composer). Cũng là hành động refresh
     * 'resizeCanvas' của Custom Effect. */
    rebuildCanvasScenes() {
        const viewport = this._currentViewport();
        appState.set('dpr', viewport.dpr);
        console.log(`writer: "workflowVisualizerRender.rebuildCanvasScenes", page: "dpr", content: "${viewport.dpr}"`);
        resizeVisualizerCanvas(canvas, viewport.width, viewport.height, viewport.dpr); // core/canvas-scene-setup.js
        this._resizeSharedRenderer(viewport);
        this._broadcast('onResize', viewport);
    },

    _currentViewport() {
        return { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 };
    },

    /** Renderer WebGL dùng chung (Vortex + Connector) — chưa group WebGL nào dựng thì chưa có gì để đổi. */
    _resizeSharedRenderer(viewport) {
        const renderer = appState.get('tRenderer');
        if (!renderer) return;
        resizeThreeRenderer(renderer, viewport.width, viewport.height); // core/webgl/three-common.js
    },

    // ===================== Chọn / kích hoạt style =====================

    /** Áp 1 STYLE cụ thể (modal chọn effect, auto-switch). THAY `applyVisualizerStyleChoice()` cũ trong core. */
    applyStyle(style) {
        const idx = MODES.indexOf(style);
        if (idx === -1) return;
        appState.set('currentModeIndex', idx);
        console.log(`writer: "workflowVisualizerRender.applyStyle", page: "currentModeIndex", content: "${idx} (${style})"`);
        this.activateCurrentStyle();
        saveConfig(); // core/config.js
        this._callGroupHook(STYLE_TO_GROUP[style], 'onStyleApplied', this._currentViewport());
    },

    /** Kích hoạt style theo `currentModeIndex`: ghi vizConfig, nhãn icon, ẩn/hiện #webgl-canvas, hook `activate`
     * của group, độ phân giải FFT. THAY `updateTypeUI()` cũ trong core. Gọi lúc boot (app-boot.js, sau
     * loadConfig()), trước khi phát (player.js, video-player.js) và từ `applyStyle()`. */
    activateCurrentStyle() {
        const style = MODES[appState.get('currentModeIndex')];
        const groupName = STYLE_TO_GROUP[style];
        applyStyleToVizConfig(groupName, GROUP_STYLE_FIELD[groupName], style); // core/visualizer/visualizer-display.js
        setModeCycleLabelText(modeCycleLabel, t(VISUALIZER_STYLE_LABEL_KEYS[style] || style)); // core
        // Màn Visualizer đang hiện (#app-stack có class playlist-hidden) — ĐỌC để chuẩn bị giá trị, không rẽ nhánh.
        const visualizerScreenShown = appStack.classList.contains('playlist-hidden');
        const usesWebgl = (this._groups[groupName] || {}).usesWebgl === true;
        setWebglCanvasHidden(document.getElementById('webgl-canvas'), !(usesWebgl && visualizerScreenShown)); // core
        this._callGroupHook(groupName, 'activate', style);
        this._applyFftSizeForStyle(groupName, style);
    },

    /** Effect cần phổ mịn (vortex/lighting/connector/mirror) dùng FFT 2048, còn lại 256 — rồi cấp phát lại buffer
     * (flux frame kế tiếp tự coi baseline chưa hợp lệ, xem workflowAudioAnalysis). Chưa có AudioContext -> bỏ qua. */
    _applyFftSizeForStyle(groupName, style) {
        const analyser = appState.get('analyser');
        if (!analyser) return;
        setAnalyserFftSize(analyser, needsHighResFft(groupName, style) ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard); // core/audio-engine.js
        this.allocateVizSpectrumBuffer();
    },

    /** Cấp phát lại phổ VẼ (`vizDataArray`) theo FFT effect hiện tại. Chưa có AudioContext -> bỏ qua.
     * SỬA 01/10/2026 (thay allocateAnalysisBuffers()): phổ phân tích + baseline flux + sóng pitch giờ theo analyser
     * PHÂN TÍCH cố định, do workflowAudioAnalysis.allocateBuffers() cấp 1 lần — đổi effect không còn làm mất baseline. */
    allocateVizSpectrumBuffer() {
        const analyser = appState.get('analyser');
        if (!analyser) return;
        appState.set('vizDataArray', new Uint8Array(analyser.frequencyBinCount));
        console.log(`writer: "workflowVisualizerRender.allocateVizSpectrumBuffer", page: "vizDataArray", content: "${analyser.frequencyBinCount} bin"`);
    },

    /** MỚI (Phase 5) — renderer WebGL dùng chung (Vortex + Connector): có rồi thì dùng lại, chưa có thì tạo với
     * `pixelRatio` của group gọi trước. Đặt kích thước theo khung nhìn hiện tại. */
    ensureSharedRenderer(pixelRatio) {
        const renderer = appState.get('tRenderer') || this._createSharedRenderer(pixelRatio);
        const viewport = this._currentViewport();
        resizeThreeRenderer(renderer, viewport.width, viewport.height); // core/webgl/three-common.js
        return renderer;
    },

    _createSharedRenderer(pixelRatio) {
        const renderer = createSharedWebglRenderer(document.getElementById('webgl-canvas'), pixelRatio); // core/webgl/three-common.js
        appState.set('tRenderer', renderer, { skipCheck: true });
        console.log('writer: "workflowVisualizerRender._createSharedRenderer", page: "tRenderer", content: "tạo renderer WebGL dùng chung"');
        return renderer;
    },

    /** Hành động refresh của Custom Effect cho group (vd 'rebuild'). */
    callGroupAction(groupName, action) {
        this._callGroupHook(groupName, action);
    },

    /** Màu theo color mode — xem VIZ_MODE_COLOR_BY_MODE. `fallbackMode` = mode dùng khi cfg.mode lạ (giữ đúng
     * nhánh `else` của từng nơi gọi cũ). */
    modeColor(cfg, index, gradientFill, fallbackMode) {
        return (VIZ_MODE_COLOR_BY_MODE[cfg.mode] || VIZ_MODE_COLOR_BY_MODE[fallbackMode])(cfg, index, gradientFill);
    },

    _callGroupHook(groupName, hook, ...args) {
        const group = this._groups[groupName];
        if (!group) return;
        (group[hook] || VIZ_NOOP).apply(group, args);
    },

    _broadcast(hook, ...args) {
        Object.keys(this._groups).forEach((groupName) => this._callGroupHook(groupName, hook, ...args));
    },

    // ===================== Frame vẽ =====================

    /** Tick VẼ (RENDER_TASK, chỉ tồn tại khi Show Visual bật). Resolve config effect đang chạy 1 lần cho cả frame
     * (`frameEffectConfig`, getComputedColor() đọc lại); `finally` luôn xoá về null để lời gọi NGOÀI frame vẽ
     * không đọc phải bản cũ. */
    _tickDraw() {
        appState.set('frameEffectConfig', getActiveEffectConfig(), { skipCheck: true }); // core/custom-effect.js
        try {
            this._drawFrame();
        } finally {
            appState.set('frameEffectConfig', null, { skipCheck: true });
        }
    },

    /** Dựng frame context 1 lần rồi giao cho hàm vẽ của style đang chạy. Dữ liệu audio do task phân tích ghi
     * (lệch tối đa 1 frame). */
    _drawFrame() {
        const vizCfg = appConfigViz.getAll();
        if (vizCfg.visualEnabled === false) return; // phòng thủ — config vừa đổi, task chưa kịp bị kill (tối đa 1 frame)
        const s = appState.get([
            'vizDataArray', 'analyser', 'beatScale', 'smoothedEnergy', 'globalHueOffset', 'lastValidMidiNote',
            'lastBeatTime', 'dpr', 'isVideoPlayerMode', 'frameEffectConfig',
        ]);
        if (!s.vizDataArray || !s.analyser) return; // guard — audio context chưa init
        const cfg = s.frameEffectConfig;
        const media = s.isVideoPlayerMode ? bgVideoElement : audioPlayer;
        const frame = {
            ctx, canvas, cfg,
            group: vizCfg.type,
            style: cfg[GROUP_STYLE_FIELD[vizCfg.type]],
            perf: { blurMult: getActiveBlurMult() }, // core/audio-analysis.js
            isPlaying: !media.paused,
            beatScale: s.beatScale,
            smoothedEnergy: s.smoothedEnergy,
            hue: s.globalHueOffset,
            vizDataArray: s.vizDataArray,
            analyser: s.analyser,
            bufferLength: s.analyser.frequencyBinCount,
            dpr: s.dpr,
            lastBeatTime: s.lastBeatTime,
            midiNote: s.lastValidMidiNote,
        };
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this._drawStyle(frame);
    },

    /** Registry style -> hàm vẽ. Style lạ (config hỏng) -> style mặc định của group, đúng nhánh `else` cũ. */
    _drawStyle(frame) {
        const group = this._groups[frame.group];
        if (!group) return;
        const draw = group.styles[frame.style] || group.styles[group.defaultStyle];
        draw.call(group, frame);
    },
};
