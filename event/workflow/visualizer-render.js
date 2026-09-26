/**
 * event/workflow/visualizer-render.js — Workflow DUY NHẤT sở hữu vòng lặp render chính (thay
 * `drawVisualizer()` cũ — `core/visualizer/draw-visualizer.js`, nay đã RỖNG HẲN, vai trò dispatch
 * dời hết vào đây) — tự đăng ký task `taskManager` mode `raf` (xem `service/task-manager.js`), tự
 * `appState.get([...])` mỗi tick, tự gọi các hàm Core cần thiết theo đúng thứ tự — ĐÚNG định
 * nghĩa vai trò Workflow (đọc state rồi quyết định gọi Core nào), KHÔNG qua `eventBus`/Router
 * (đây là 1 trường hợp Workflow tự "tick" bằng `taskManager`, KHÔNG phải luồng Listener→Router
 * thông thường — xem ghi chú bổ sung ở `readme/event-bus-flow.md`).
 *
 * [TÁCH 2 TASK — 21/09/2026, yêu cầu Giang, "Show Visual = tắt thì tắt cả phần vẽ lẫn render nhưng
 * vẫn cập nhật status bar"] Trước đây MỘT task `raf` duy nhất `visualizerRender` làm cả 2 việc: (1)
 * PHÂN TÍCH audio mỗi frame (FFT, beatScale, smoothedEnergy, globalHueOffset, updateStatsDashboard
 * -> beat/BPM/pitch/status bar, Game tick, nốt nhạc bay), (2) VẼ canvas 2D/WebGL. Tắt Show Visual chỉ
 * `return` sớm giữa chừng nên vòng RAF vẫn sống. Nay tách:
 *   - `ANALYSIS_TASK` ('audioAnalysis', `_tick()`) — LUÔN chạy suốt đời app: mọi thứ (1) ở
 *     trên. KHÔNG được dừng theo Show Visual vì Game (workflowGameplay.tick), React Beat của Motion
 *     (`beatScale`, motion-beat-react-runner.js), visual-bg-common.js (`smoothedEnergy`) và status
 *     bar đều sống nhờ dữ liệu do task này ghi vào appState.
 *   - `RENDER_TASK` ('visualizerRender', `_tickDraw()`) — CHỈ phần (2). Tự đăng ký/kill theo
 *     `cfg.visualEnabled` qua `_syncRenderTask()` (gọi mỗi frame từ `_tick()` — 1 so sánh cờ,
 *     nên mọi đường đổi config: toggle, Restore default, nạp config lúc boot... đều tự đồng bộ,
 *     không cần Router/Listener riêng). Tắt = `taskManager.kill()` (KHÔNG dùng pause(): `pauseAll()`/
 *     `resumeAll()` lúc ẩn/hiện tab sẽ vô tình resume task đang bị "pause vì tắt Visual").
 *   `_tickDraw()` đọc beatScale/smoothedEnergy/globalHueOffset từ appState (do `_tick()` ghi) — 2
 *     task cùng nhịp RAF nên lệch tối đa 1 frame (~16ms), không cảm nhận được.
 *
 * Điểm khởi động DUY NHẤT: `core/audio-engine.js::setupAudioContext()` gọi
 * `workflowVisualizerRender.start()` (Core gọi Workflow — vi phạm kỹ thuật đã ĐÁNH DẤU RÕ là
 * ngoại lệ đã biết, xem comment tại đó) — `taskManager.operator(name,'enabled')` tự guard chống
 * double-start nên an toàn tuyệt đối dù `setupAudioContext()` được gọi lại nhiều lần (Next/Prev/
 * chọn bài khác... — guard "chỉ chạy thật lần đầu" nằm ngay trong hàm đó).
 *
 * VISUAL bar/rubik/vortex/black hole/rain — [SỬA, rà soát Rule 3, không ngoại lệ] TRƯỚC ĐÂY gọi
 * THẲNG 1 hàm `drawXxx()` duy nhất mỗi visual (y hệt `drawVisualizer()` cũ, không đụng logic bên
 * trong `core/visualizer/types/*.js`). Cả 5 hàm `drawXxx()` đó ĐÃ XOÁ (từng vi phạm Rule 1/2/3:
 * tự `appState.get()`, tự gọi `getActiveEffectConfig()`/`getComputedColor()`/hàm core khác cùng
 * hoặc khác file, `bar`/`rain`/`vortex` còn if/else tự chọn style con). Workflow giờ điều phối
 * THẬT SỰ, cùng khuôn Galaxy: `_tickBar()` (gồm cả style 'black hole', gộp từ `_tickBlackHole()`
 * cũ 05/09/2026)/`_tickRubik()` (dispatch qua `cfg.type === 'shape'`)/`_tickVortexRender()`/
 * `_tickRain()` bên dưới — tự gom appState/cfg TRƯỚC, tự vòng lặp gọi RIÊNG LẺ từng hàm Core.
 * [CHUYỂN NHÓM, 05/09/2026, yêu cầu Giang] Core của 5 visual này giờ nằm ở
 * `core/visualizer/groups/<group>/<style>.js` (mỗi style 1 file riêng, không gộp chung nữa) thay
 * vì `core/visualizer/types/*.js` cũ: `bar/mirror.js`, `bar/cascade.js`, `bar/black-hole.js` (Black
 * Hole CHUYỂN vào group "bar"), `shape/rubik.js` (Rubik CHUYỂN vào group "shape"),
 * `vortex/rings.js`, `vortex/bars.js`, `vortex/wave.js`, `rain/glass.js`, `rain/street.js` — mỗi
 * group có thêm 1 `common.js` (registry style con + biến/cơ chế dùng chung, nếu có).
 *
 * VISUAL Lighting (`type: 'lighting'`) — Workflow điều phối thật (không nằm trong
 * `VISUALIZER_DRAWERS`), 2 style con qua `customEffect.lighting.lightingStyle`: 'thunder'
 * (`_tickLightingThunder()`) và 'fireworks' (`_tickLightingFireworks()`, tự gom rocket/particle —
 * `fwRockets`/`fwParticles`). Mỗi style 1 file riêng — `core/visualizer/groups/lighting/thunder.js`/
 * `fireworks.js` (CHUYỂN NHÓM, 05/09/2026 — trước đây gộp chung `core/visualizer/types/
 * lighting.js`), cơ chế chớp sáng dùng chung ở `groups/lighting/common.js`.
 * Xem `_tickLighting()` bên dưới. [SỬA — rà soát Rule 3] Style "fireworks": `explodeFireworksXXX()`/
 * `splitFireworksParticle()`/`explodeFireworksText()` (core) giờ trả về SPEC thuần, không tự gọi
 * `getComputedColor()`/`createFireworksParticle()` nữa — Workflow tự `_fwMaterializeSpecs()` (mới,
 * xem bên dưới) để vật chất hoá thành particle thật, TRƯỚC KHI gọi tiếp `applyFireworksDepth()`/
 * `applyFireworksSizeScale()` như cũ.
 *
 * [XOÁ — 15/09/2026, yêu cầu Giang, "dọn sạch visualizer effect space"] VISUAL Galaxy (`type:
 * 'space'`, mô hình 2 lớp cụm/thiên hà 4-pha) — toàn bộ đã BỎ HẲN cùng group "space": engine
 * `core/webgl/three-space.js`, `core/visualizer/groups/space/`, `service/state/three-space.js`
 * đã xoá; `_tickSpace()` → `_completeGalaxyVisit()` (10 method) + toàn bộ hằng số `SPACE_*` trong
 * file này cũng đã xoá theo.
 *
 * NẠP: SAU toàn bộ `core/visualizer/groups/<group>/<style>.js` (mỗi group's `common.js` trước, style con sau —
 * xem index.html), `core/visualizer/draw/*.js`,
 * `core/webgl/three-vortex.js`, `core/audio-analysis.js` (cần
 * `detectMusicTransition()`/`isPhraseBoundary()` đã định nghĩa), `core/visualizer/visualizer-
 * display.js` — xem vị trí thẻ `<script>` trong index.html (đặt ngay vị trí cũ của
 * `draw-visualizer.js`, cuối khối 4-VISUALIZERS, SAU khối gameplay).
 */

const RENDER_TASK = 'visualizerRender';     // CHỈ vẽ — bật/tắt theo cfg.visualEnabled (xem _syncRenderTask())
const ANALYSIS_TASK = 'audioAnalysis'; // phân tích audio + stats + Game tick — LUÔN chạy

// ===== Connector (synapse/circuit) — "ổn định lại" sau SEEK (MỚI 21/09/2026) =====
// Mỗi neuron/chip giữ state thời gian (smoothedBinEnergy/prevBinEnergy/adaptation/lateralInhibition +
// tia đang bay) — seek cùng 1 media KHÔNG qua resetConnectorPerTrackState() (chỉ chạy khi đổi bài) nên
// state cũ sống xuyên qua seek, frame đầu sau seek bị hiểu nhầm thành onset (hoặc ngược lại) và tia cũ
// vẫn bay tiếp. currentTime nhảy quá ngưỡng này giữa 2 frame (dù `seeking` kịp bắn hay không — seek
// blob cục bộ có thể xong trong <1 frame) = 1 lần seek. Playback 2x chỉ tiến ~0.03s/frame.
const SEEK_JUMP_THRESHOLD_SEC = 0.5;
// Số frame giữ connector ở trạng thái "ổn định lại" (không bắn, mỗi frame lấy FFT hiện tại làm baseline)
// sau lần seek CUỐI — `analyser` tự làm mượt FFT (smoothingTimeConstant mặc định 0.8, mỗi lần
// getByteFrequencyData) nên còn kéo đuôi audio CŨ ~0.2s sau khi media đã seek xong; ~15 frame @60fps
// là đủ để phần đuôi đó tắt hẳn trước khi coi FFT là "vị trí mới".
const CONNECTOR_SEEK_SETTLE_FRAMES = 15;

// Tra cứu hàm vẽ 2D theo `vizConfig.type` — dời nguyên từ `draw-visualizer.js` cũ (đã RỖNG).
// `bar`/`rain`/`shape`/`vortex` KHÔNG nằm trong bảng này: `bar` có 3 style con (mirror/
// cascade/'black hole', CHUYỂN NHÓM 05/09/2026 — trước đây 'black hole' là type riêng) nên
// Workflow tự chọn qua `_tickBar()` (Rule 1), `rain` tương tự qua `_tickRain()`; `shape` (đổi tên
// từ 'rubik' 05/09/2026) cần nhiều bước xoay 3D nối tiếp nên qua `_tickRubik()`; `vortex`
// render qua WebGL (canvas riêng), xử lý RIÊNG trong `_tick()` TRƯỚC khi canvas 2D được clear.
// Bảng để lại rỗng (thay vì xoá hẳn) để không phá cấu trúc dispatch `if (drawFn)` bên dưới.
const VISUALIZER_DRAWERS = {};

// ===== Fireworks — biến NỘI BỘ (KHÔNG thuộc STATE) =====
let _fwLastLaunchAt = 0;
let _fwTextIndex = 0;
let _fwLastConsumedBeatTime = 0;
let _fwPendingBeatFluxSum = 0;
let _fwPendingBeatFluxCount = 0;
let _fwBeatFluxHistory = [];
// Bin FFT gán cho rocket kế tiếp (mục 4, phản hồi Giang) — CỘNG DỒN mỗi lần bắn để rải đều qua 1
// dải tần thay vì luôn rơi vào 1-2 bin cố định; giới hạn trong dải bass/mid (thường có năng lượng
// ổn định hơn treble, tránh rocket luôn đọc bin gần như im lặng -> luôn nhỏ).
let _fwNextBinIndex = 0;
const FIREWORKS_SIZE_BIN_MIN = 2;
const FIREWORKS_SIZE_BIN_MAX = 40;
// energyWindowBeats/sectionWindowBeats/fluxThreshold giờ là field THẬT (customEffect.lighting,
// core/config.js, chỉ nghĩa lý ở style "fireworks") — không còn hardcode ở đây.
const FIREWORKS_FINALE_ROCKET_COUNT = 10;

// ===== Vortex — biến NỘI BỘ (KHÔNG thuộc STATE), mirror _fw* =====
let _vxLastConsumedBeatTime = 0;
let _vxPendingBeatFluxSum = 0;
let _vxPendingBeatFluxCount = 0;
let _vxBeatFluxHistory = [];
let _vxBeatsSinceLastTurn = 999; // lớn sẵn — cho phép rẽ ngay từ lần đầu, không phải đợi

// ===== Connector (circuit) — biến NỘI BỘ (nhịp camera shift theo beat/flux) =====
// ĐỔI (yêu cầu Giang — audio kích hoạt xung TỪNG node): XOÁ _cnBeatSignalsRemaining/_cnBeatScaleAtBeat
// (quota xung theo beat toàn cục) — xung giờ sinh khi dải tần của CHÍNH node onset, xem _tickConnectorCircuit().
// Nốt (lastValidMidiNote) chỉ được coi là "đang phát" nếu được cập nhật trong khoảng này (ms, Date.now()).
const CIRCUIT_PITCH_FRESH_MS = 300;
let _cnLastConsumedBeatTime = 0;
let _cnPendingBeatFluxSum = 0;
let _cnPendingBeatFluxCount = 0;
let _cnBeatFluxHistory = [];
let _cnBeatsSinceLastShift = 999; // lớn sẵn, cho phép cinematic shift ngay lần đầu
// ===== Connector (brain) — MỚI (23/09/2026, Giang): triggerBurst() theo Music Transition — tích luỹ
// flux/beat RIÊNG (không dùng chung mảng với circuit/vortex/fireworks), mirror _tickConnectorBeat().
// MỚI (25/09/2026) — style bar 'dot' (trục thời gian chuyển từ connector brain, core/visualizer/groups/
// bar/dot.js). Trạng thái giữ ở Workflow (core thuần), xem _tickBarDot().
// MỚI (26/09/2026) — style shape 'clock': động cơ bánh răng (góc chủ + pha bánh lắc) + cache hình học theo
// kích thước canvas (core/visualizer/groups/shape/clock.js). Kim giây màu đỏ cổ điển cố định.
let _clockDrive = null, _clockLastTime = 0, _clockGeomKey = '', _clockLayout = null, _clockOutlines = null;
const CLOCK_SECOND_HAND_COLOR = '#e0283f';
// SỬA (26/09/2026, lượt 2) — nguồn kim đang chạy (đổi nguồn -> reset state của nguồn), kim Past/Future theo
// nốt (`_clockPitch`), thời gian bài làm mượt (`_clockMedia`), con lắc (`_clockPendulum`, giữ cả khi tắt để
// chạy hiệu ứng thu dây). Glow = khối Blur Custom Effect (perf.blurMult) × CLOCK_GLOW_PX.
let _clockPitch = null, _clockPendulum = null; // lượt 5 — bỏ _clockHandsSource/_clockMedia (chỉ còn Past & Future)
// Lượt 4 — lật quanh trục (`_clockFlip`) + vòng quanh đồng hồ (`_clockRings`, lượt 5 = 6 vòng quỹ đạo), giữ cả khi tắt để chạy hiệu ứng ra/vào.
let _clockFlip = null, _clockRings = null;
const CLOCK_GLOW_PX = 14;
const CLOCK_PENDULUM_GHOST_LAG = 0.09; // rad pha giữa 2 dây ma liên tiếp (bóng mờ dây con lắc, lượt 6)
const CLOCK_PITCH_FRESH_MS = 300; // cùng ngưỡng "nốt đang phát" với circuit/brain/dot
// MỚI (25/09/2026) — style bar 'mirror': vạch đỉnh (hold + rơi) giữ ở Workflow, core/visualizer/groups/bar/
// mirror.js::stepBarMirrorPeaks() thuần trả state mới mỗi frame.
let _mirrorPeaks = null, _mirrorLastTime = 0;
let _dotGeom = null, _dotGeomKey = '';
let _dotSnake = null, _dotSnakeKey = ''; // (25/09/2026, lượt 2) toggle dotMoving — rắn bò (lượt 3: bỏ mồi, lang thang)
let _dotClusters = [];
let _dotSmoothed = new Float32Array(0);
let _dotEnergyPeak = 0, _dotLastTime = 0, _dotLastSeenBeatTime = 0;
let _dotVibAmps = new Float32Array(DOT_VIB_SLOTS); // core/visualizer/groups/bar/dot.js (nạp trước file này)
// (25/09/2026, lượt 4) Moving kiểu DNA + chuyển vị trí mượt rắn <-> hình tĩnh
let _dotDnaLevels = new Float32Array(0), _dotDnaBonds = new Float32Array(0);
let _dotDnaBreakClock = 0, _dotDnaRot = 0;
let _dotBaseKind = '', _dotLastBase = null, _dotBlendFrom = null, _dotBlendStart = 0;
const BRAIN_PITCH_FRESH_MS = 300; // nốt chỉ coi là "đang phát" nếu cập nhật trong khoảng này (cùng ngưỡng circuit)
let _brLastConsumedBeatTime = 0;
let _brPendingBeatFluxSum = 0;
let _brPendingBeatFluxCount = 0;
let _brBeatFluxHistory = [];
let _brBeatsSinceLastBurst = 999;
// XOÁ (yêu cầu Giang 17/09/2026 — thay bằng "spike-frequency adaptation" mô phỏng đúng sinh lý
// hơn): CONNECTOR_FIRE_COOLDOWN_FRAMES + so sánh frameCounter/lastFiredFrame — cổng cooldown NHỊ
// PHÂN cứng, đã gắn liền với bug frameCounter đứng yên (17/09/2026). Xem
// computeEffectiveFireThresholdByte()/triggerNeuronAdaptation() (core/visualizer/groups/connector/
// synapse.js) — ngưỡng bắn giờ TĂNG DẦN rồi TỰ HẠ theo thời gian thay vì khoá/mở cứng theo frame.

const workflowVisualizerRender = {
    /** Cờ nội bộ (KHÔNG thuộc STATE — chỉ để `_syncRenderTask()` biết `RENDER_TASK` hiện có đang
     * được đăng ký + chạy hay không, tránh hỏi taskManager mỗi frame). */
    _renderActive: false,

    // Phát hiện seek (KHÔNG thuộc STATE) — xem `_detectMediaSeek()`/SEEK_JUMP_THRESHOLD_SEC.
    _seekLastMedia: null,
    _seekLastTime: 0,
    _connectorSettleFrames: 0, // >0 = connector đang "ổn định lại" sau seek, `_tickConnectorRender()` trừ dần mỗi frame
    _connectorWebglBlank: false, // style 'brain' (canvas 2D): canvas WebGL đã xoá trắng chưa (tránh kẹt khung hình cuối của synapse/circuit)

    /** Đăng ký + bật task phân tích `raf` — xem docstring đầu file về điểm gọi DUY NHẤT + guard
     * chống double-start. Task vẽ (`RENDER_TASK`) KHÔNG đăng ký ở đây: `_tick()` tự bật nó ở frame
     * đầu tiên nếu Show Visual đang bật (`_syncRenderTask()`). Gọi lại `start()` = dọn sạch cả 2
     * task rồi dựng lại từ đầu. */
    start() {
        taskManager.kill(RENDER_TASK);
        this._renderActive = false;
        taskManager.addNew(ANALYSIS_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator(ANALYSIS_TASK, 'enabled');
    },

    /** Không có nơi nào gọi hiện tại (vòng lặp phân tích sống suốt đời app, giống hành vi
     * `requestAnimationFrame(drawVisualizer)` cũ) — cung cấp để đối xứng API + phòng cần tới sau này. */
    stop() {
        taskManager.kill(RENDER_TASK);
        taskManager.kill(ANALYSIS_TASK);
        this._renderActive = false;
    },

    /** MỚI (25/09/2026, Giang — ẩn tab/PWA ở chế độ không Game) — TẠM DỪNG cả 2 task (phân tích + vẽ): không FFT,
     * không status bar, không pitch worker, không nốt nhạc bay, không vẽ canvas/WebGL. Dùng pause() (giữ đăng ký),
     * KHÔNG kill: `_renderActive` vẫn đúng với Show Visual nên hiện lại chỉ cần resume, không phải dựng lại.
     * Task đã bị kill vì Show Visual tắt -> pause() no-op (taskManager tự guard). Gọi từ
     * event/workflow/app-visibility.js (Workflow gọi Workflow). */
    suspendForBackground() {
        taskManager.pause(ANALYSIS_TASK);
        taskManager.pause(RENDER_TASK);
        console.log('[workflowVisualizerRender] tạm dừng task "audioAnalysis" + "visualizerRender" (app ẩn)'); // log vòng đời task — không phải ghi appState
    },

    /** Ngược lại `suspendForBackground()` — resume() tự guard (task không paused/không tồn tại -> no-op). */
    resumeFromBackground() {
        taskManager.resume(ANALYSIS_TASK);
        taskManager.resume(RENDER_TASK);
        console.log('[workflowVisualizerRender] chạy lại task "audioAnalysis" + "visualizerRender" (app hiện lại)');
    },

    /** Đồng bộ `RENDER_TASK` với Show Visual: tắt Visual -> `kill` (dừng hẳn RAF vẽ, không còn
     * callback/`clearRect`/WebGL render nào), bật lại -> đăng ký + chạy lại. Gọi mỗi frame từ
     * `_tick()`, chỉ thật sự làm gì khi trạng thái ĐỔI (so cờ `_renderActive`). */
    _syncRenderTask(isVisualOff) {
        if (this._renderActive === !isVisualOff) return;
        this._renderActive = !isVisualOff;
        if (isVisualOff) {
            taskManager.kill(RENDER_TASK);
        } else {
            taskManager.addNew(RENDER_TASK, { time: 0, exe: () => this._tickDraw(), mode: 'raf', count: 0 });
            taskManager.operator(RENDER_TASK, 'enabled');
        }
        console.log(`[workflowVisualizerRender] task "${RENDER_TASK}" ${isVisualOff ? 'đã kill (Show Visual tắt)' : 'đã start (Show Visual bật)'}`); // log vòng đời task — KHÔNG phải ghi appState nên không dùng format "writer:" của Rule 4
    },

    /** Phát hiện media vừa SEEK (mọi nguồn: kéo thanh seek, cử chỉ giữ tay, Media Session, đổi bài, tab ẩn
     * rồi hiện lại) — CHỈ báo hiệu (`_connectorSettleFrames`), việc dọn nằm ở `_tickConnectorRender()`
     * (task vẽ) vì chỉ nơi đó mới đụng state connector. Photo Player mode bỏ qua (không có audio/seek thật).
     * @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode */
    _detectMediaSeek(isVideoPlayerMode, isPhotoPlayerMode) {
        if (isPhotoPlayerMode) return;
        const media = isVideoPlayerMode ? bgVideoElement : audioPlayer;
        const t = media.currentTime;
        const isSeek = media.seeking || media !== this._seekLastMedia || Math.abs(t - this._seekLastTime) > SEEK_JUMP_THRESHOLD_SEC;
        this._seekLastMedia = media;
        this._seekLastTime = t;
        if (isSeek) this._connectorSettleFrames = CONNECTOR_SEEK_SETTLE_FRAMES;
    },

    /** Tick PHÂN TÍCH — 1 lần mỗi khung hình, LUÔN chạy (xem docstring đầu file). Thay phần đầu của
     * `drawVisualizer()` cũ. Phần VẼ nằm ở `_tickDraw()` bên dưới. */
    _tick() {
        const cfg = appConfigViz.getAll();
        const { vizDataArray, analyser, frameCounter, smoothedEnergy, globalHueOffset } = appState.get([
            'vizDataArray', 'analyser', 'frameCounter', 'smoothedEnergy', 'globalHueOffset'
        ]);

        const isVisualOff = cfg.visualEnabled === false;
        updateCanvasVisibility(canvas, document.getElementById('webgl-canvas'), isVisualOff); // core
        this._syncRenderTask(isVisualOff); // bật/tắt task VẼ theo Show Visual

        if (!vizDataArray) return; // guard — audio context chưa init (giống hệt hành vi cũ)

        // SỬA (bug Giang phát hiện 17/09/2026 — connector synapse bắn vài giây đầu mỗi bài rồi im
        // hẳn dù audio vẫn còn): `frameCounter` (service/state/visualizer-runtime.js) được ĐỌC ở
        // nhiều nơi (cooldown bắn synapse ngay dưới, globalTwist vortex, nhịp spawnFlyingNote()
        // mỗi-8-frame) nhưng rà toàn bộ codebase KHÔNG CÓ CHỖ NÀO TĂNG nó — đứng yên ở giá trị mặc
        // định (0) suốt đời app. Hệ quả rõ nhất: CONNECTOR_FIRE_COOLDOWN_FRAMES so
        // `frameCounter - neuron.lastFiredFrame` mãi mãi = 0 ngay sau lần bắn ĐẦU TIÊN của mỗi
        // nơ-ron (lastFiredFrame gán = frameCounter tĩnh đó) → không bao giờ > 12 nữa → nơ-ron tự
        // khoá cooldown vĩnh viễn (giai đoạn ngắn bắn được lúc đầu là vì lastFiredFrame khởi tạo
        // -9999, còn đủ hiệu số vượt cooldown). Tăng NGAY SAU guard audio-context (chỉ đếm frame
        // THẬT SỰ có xử lý audio data, khớp tinh thần mọi field khác cùng package
        // visualizer-runtime.js).
        appState.set('frameCounter', frameCounter + 1, { skipCheck: true });

        this._detectMediaSeek(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode'));

        analyser.getByteFrequencyData(vizDataArray);
        const bufferLength = analyser.frequencyBinCount;
        const isPlaying = appState.get('isVideoPlayerMode') ? !bgVideoElement.paused : !audioPlayer.paused;

        const bassCount = Math.floor(bufferLength * 0.1);
        const newBeatScale = computeBeatScale(vizDataArray, bassCount); // core
        appState.set('beatScale', newBeatScale, { skipCheck: true });

        const newSmoothedEnergy = computeSmoothedEnergy(newBeatScale, smoothedEnergy); // core
        appState.set('smoothedEnergy', newSmoothedEnergy, { skipCheck: true });

        const newGlobalHueOffset = computeNextGlobalHueOffset(globalHueOffset, newBeatScale, isPlaying); // core
        appState.set('globalHueOffset', newGlobalHueOffset, { skipCheck: true });

        updateStatsDashboard(bufferLength); // core hiện có (di sản — Rule 0.5, KHÔNG đụng logic bên trong)

        // Game Mode Circle — dùng CHUNG vòng lặp phân tích này (KHÔNG mở RAF loop riêng cho gameplay).
        // Workflow-gọi-Workflow (KHÔNG phải Core-gọi-Core — Rule 3 không áp dụng ở đây). Nằm ở task
        // PHÂN TÍCH (luôn chạy), KHÔNG ở `_tickDraw()` CÓ CHỦ Ý — layer game là DOM riêng
        // (#gameplay-layer), không phụ thuộc canvas #visualizer, phải tiếp tục chạy dù người dùng
        // tắt Visual (lúc đó task vẽ đã bị kill hẳn).
        workflowGameplay.tick(performance.now());

        // "Nốt nhạc bay lên" — luôn bật, cùng lý do: phần tử DOM phụ trên #record-container,
        // không phụ thuộc canvas.
        if (isPlaying && newSmoothedEnergy > 0.3 && Math.random() > 0.6) spawnFlyingNote(); // core hiện có
    },

    /** Tick VẼ — task riêng `RENDER_TASK`, CHỈ tồn tại khi Show Visual bật (xem `_syncRenderTask()`).
     * Đọc dữ liệu audio đã được `_tick()` ghi vào appState (lệch tối đa 1 frame), KHÔNG tự đọc
     * analyser/tự tính lại beat/energy. Toàn bộ dispatch vẽ bên dưới GIỮ NGUYÊN như trước khi tách. */
    _tickDraw() {
        const cfg = appConfigViz.getAll();
        if (cfg.visualEnabled === false) return; // phòng thủ — config vừa đổi nhưng `_tick()` chưa kịp kill task này (tối đa 1 frame)
        const { vizDataArray, analyser, beatScale, smoothedEnergy, globalHueOffset, lastValidMidiNote, lastBeatTime } = appState.get([
            'vizDataArray', 'analyser', 'beatScale', 'smoothedEnergy', 'globalHueOffset', 'lastValidMidiNote', 'lastBeatTime'
        ]);
        if (!vizDataArray || !analyser) return; // guard — audio context chưa init

        const perf = { blurMult: getActiveBlurMult() }; // core/audio-analysis.js
        const bufferLength = analyser.frequencyBinCount;
        const isPlaying = appState.get('isVideoPlayerMode') ? !bgVideoElement.paused : !audioPlayer.paused;
        const newBeatScale = beatScale;
        const newSmoothedEnergy = smoothedEnergy;
        const newGlobalHueOffset = globalHueOffset;

        // ================== VISUAL CŨ — gọi THẲNG, y nguyên tham số ==================
        if (cfg.type === 'vortex') {
            // Hướng rẽ ống (Workflow điều phối thật — beat flux/pitch/ghi tPathTarget) TRƯỚC,
            // rồi tới phần cập nhật vị trí/màu/camera mỗi frame (_tickVortexRender() — rà soát
            // Rule 3, Workflow điều phối thật, không còn gọi thẳng drawVortex() cũ).
            this._tickVortexCurve(isPlaying);
            this._tickVortexRender(perf, isPlaying, newSmoothedEnergy, vizDataArray);
        } else if (cfg.type === 'connector') {
            this._tickConnectorBeat(isPlaying);
            this._tickConnectorRender(isPlaying, newSmoothedEnergy, vizDataArray, bufferLength);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawFn = VISUALIZER_DRAWERS[cfg.type];
        if (drawFn) {
            drawFn(ctx, perf, isPlaying, newBeatScale);
        } else if (cfg.type === 'bar') {
            // ============= VISUAL Bar — Workflow tự chọn style mirror/cascade/'black hole' (Rule 1) =============
            // [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] "Black Hole" CHUYỂN từ
            // type riêng thành 1 style của group "bar" (cfg.barStyle==='black hole') — _tickBar()
            // giờ rẽ 3 nhánh thay vì 2, cần thêm isPlaying/globalHueOffset (trước đây chỉ
            // _tickBlackHole() cũ cần).
            this._tickBar(ctx, perf, isPlaying, newBeatScale, newSmoothedEnergy, newGlobalHueOffset, vizDataArray, analyser);
        } else if (cfg.type === 'rain') {
            // ================== VISUAL Rain — Workflow tự chọn style glass/street (Rule 1) ==================
            this._tickRain(ctx, perf, isPlaying, newSmoothedEnergy, newBeatScale, vizDataArray);
        } else if (cfg.type === 'shape') {
            // ================== VISUAL Shape (style 'rubik') — Workflow điều phối xoay 3D + vẽ ==================
            // ĐỔI TÊN (05/09/2026) — trước đây cfg.type === 'rubik' (group giờ tên "shape", vẫn
            // chỉ 1 style con 'rubik' — xem EFFECT_GROUPS, service/state/visualizer-runtime.js).
            // SỬA (26/09/2026) — group có thêm style 'clock' (core/visualizer/groups/shape/clock.js).
            if (getActiveEffectConfig().shapeStyle === 'clock') this._tickClock(ctx, perf, isPlaying, appState.get('dpr'), newSmoothedEnergy, newBeatScale, vizDataArray, analyser);
            else this._tickRubik(ctx, isPlaying, appState.get('dpr'), newSmoothedEnergy, newBeatScale, vizDataArray);
        } else if (cfg.type === 'lighting') {
            // ================== VISUAL Lighting — Workflow điều phối style thunder/fireworks ==================
            this._tickLighting(ctx, perf, isPlaying, newBeatScale, newSmoothedEnergy, vizDataArray);
        } else if (cfg.type === 'connector') {
            // Style 'brain' vẽ canvas 2D — PHẢI đứng SAU ctx.clearRect() phía trên (synapse/circuit đã render WebGL ở trên).
            if (getActiveEffectConfig().connectorStyle === 'brain') this._tickConnectorBrain(ctx, lastBeatTime, newSmoothedEnergy, vizDataArray, bufferLength, lastValidMidiNote, newBeatScale, isPlaying);
        }
    },

    _fwFlashAlpha: 0,

    /** Hướng rẽ ống Vortex theo nhạc — mirror _fwUpdateFinaleTrigger()
     * (tích luỹ beat flux RIÊNG, không dùng chung mảng với Fireworks/Circle). Debounce bằng
     * `_vxBeatsSinceLastTurn >= 2` (cửa sổ ngắn HARDCODE — [SỬA 15/09/2026, yêu cầu Giang] không
     * còn field cfg.energyWindowBeats nữa) — chặn dội liên tiếp mỗi beat suốt 1 đoạn nhạc biến
     * động kéo dài. `cfg.redirectEnabled` (MỚI, toggle "Redirect") tắt thì KHÔNG BAO GIỜ rẽ nữa,
     * bất kể nhạc có biến động hay không — ống đi thẳng mãi. Đủ điều kiện "nhạc vừa biến động"
     * (detectMusicTransition(), core/audio-analysis.js) -> chọn hướng rẽ theo nốt MIDI TỨC
     * THỜI (lastValidMidiNote, null thì Core tự fallback random), ghi thẳng target mới vào
     * tPathTarget (SỬA 25/09/2026: không còn phụ thuộc z camera; chỉ rẽ khi lượt trước đã hội tụ) — phần cập nhật vị trí/màu/camera mỗi frame nằm ở
     * `_tickVortexRender()` (bên dưới, rà soát Rule 3). */
    _tickVortexCurve(isPlaying) {
        const fluxHistory = appState.get('fluxHistory');
        if (fluxHistory.length > 0) {
            _vxPendingBeatFluxSum += fluxHistory[fluxHistory.length - 1];
            _vxPendingBeatFluxCount++;
        }
        const isNewBeat = lastBeatTime > 0 && lastBeatTime !== _vxLastConsumedBeatTime;
        if (!isNewBeat) return;
        _vxLastConsumedBeatTime = lastBeatTime;

        if (_vxPendingBeatFluxCount > 0) {
            _vxBeatFluxHistory.push(_vxPendingBeatFluxSum / _vxPendingBeatFluxCount);
            if (_vxBeatFluxHistory.length > 24) _vxBeatFluxHistory.shift();
        }
        _vxPendingBeatFluxSum = 0;
        _vxPendingBeatFluxCount = 0;
        _vxBeatsSinceLastTurn++;
        if (!isPlaying) return;

        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        if (!cfg.redirectEnabled) return; // toggle tắt -> không bao giờ rẽ
        // Debounce — chỉ xét rẽ tiếp khi đã tích đủ 1 CỬA SỔ MỚI (2 beat, hardcode) kể từ lần rẽ
        // trước, tránh dội liên tiếp mỗi beat suốt 1 đoạn build-up/drop kéo dài nhiều beat (mục 1,
        // phản hồi Giang — "dao động liên tục theo trục x,y" + "văng ra nhìn thấy ống từ ngoài"):
        // không debounce thì target bị ghi đè liên tục, params không bao giờ kịp hội tụ, trong khi
        // ring/bar/wave (không có damping) bám sát target MỚI ngay lập tức -> camera (có damping
        // 0.045) lệch hẳn ra khỏi hình học ống thật.
        if (_vxBeatsSinceLastTurn < 2) return;

        // MỚI (25/09/2026, Giang báo "liên tục đổi hướng gây loạn màn hình") — lượt rẽ trước CHƯA hội tụ
        // (lệch pha còn >= VORTEX_TURN_SETTLE_RAD) thì bỏ qua biến động nhạc lần này: 2 beat (~1s) ngắn
        // hơn nhiều thời gian ống cần để rẽ xong, trước đây target bị ghi đè liên tục nên ống không bao
        // giờ đi hết 1 hướng, cứ giằng co giữa các hướng mới.
        const { tPathParams, tPathTarget, lastValidMidiNote } = appState.get(['tPathParams', 'tPathTarget', 'lastValidMidiNote']);
        if (!isVortexTurnSettled(tPathParams, tPathTarget, VORTEX_TURN_SETTLE_RAD)) return; // core (three-vortex.js)

        const musicTransition = detectMusicTransition(_vxBeatFluxHistory, 2, cfg.sectionWindowBeats, cfg.fluxThreshold); // core (audio-analysis.js)
        if (!musicTransition) return;
        _vxBeatsSinceLastTurn = 0;

        const direction = pickVortexDirectionFromNote(lastValidMidiNote); // core (three-vortex.js)
        const nextTarget = computeVortexCurveTarget(tPathTarget, direction); // core — SỬA 25/09/2026: không còn nhận z hiện tại
        appState.set('tPathTarget', nextTarget, { skipCheck: true });
    },

    /** [MỚI — rà soát Rule 3] VISUAL Vortex — Workflow tự gom TOÀN BỘ appState/cfg, tự chọn ĐÚNG
     * style rings/bars/wave (Rule 1 — chọn style KHÔNG được nằm trong 1 hàm core nữa), tự vòng lặp
     * gọi RIÊNG LẺ từng hàm "1 bước/1 item" (core/visualizer/groups/vortex/{rings,bars,wave}.js) —
     * center/màu tự
     * resolve qua `getVortexCenterAt()`/`getComputedColor()` (core/webgl/three-vortex.js, core/
     * audio-analysis.js) TRƯỚC khi truyền vào. Thay hẳn `drawVortex()` cũ (đã xoá, vi phạm
     * Rule 1/2/3). */
    _tickVortexRender(perf, isPlaying, smoothedEnergy, vizDataArray) {
        if (!appState.get('tInitialized')) return;
        const bufferLength = appState.get('analyser').frequencyBinCount;
        const cfg = getActiveEffectConfig(); // core/custom-effect.js

        const tWarpSpeed = computeVortexWarpSpeed(cfg.warpSpeedBase, cfg.warpSpeedEnergyMult, smoothedEnergy); // core
        let tCurrentWarpZ = appState.get('tCurrentWarpZ') - tWarpSpeed;
        // MỚI (25/09/2026) — dời gốc z khi bay quá xa (chặn z tịnh tiến vô hạn). Tâm ống chỉ phụ thuộc
        // camZ - z nên dời CẢ camera lẫn mọi object cùng 1 lượng là không đổi hình gì.
        if (tCurrentWarpZ < -VORTEX_REBASE_Z) { // core/webgl/three-vortex.js
            const shift = -tCurrentWarpZ;
            const nextBarRingZs = shiftVortexSceneZ(shift, appState.get('tRings'), appState.get('tWaveMeshes'), appState.get('tBarRingZs')); // core
            appState.set('tBarRingZs', nextBarRingZs, { skipCheck: true });
            tCurrentWarpZ = 0;
        }
        appState.set('tCurrentWarpZ', tCurrentWarpZ, { skipCheck: true });

        // THAY `updateVortexCurveLerp()` cũ (25/09/2026) — hàm thuần, pha tiến theo quãng vừa bay.
        const path = computeNextVortexPath(appState.get('tPathParams'), appState.get('tPathTarget'), tWarpSpeed); // core/webgl/three-vortex.js
        appState.set('tPathParams', path.params, { skipCheck: true });
        appState.set('tPathTarget', path.target, { skipCheck: true });
        const pathParams = path.params;

        if (cfg.vortexStyle === 'rings') {
            const tRings = appState.get('tRings');
            tRings.forEach((ring, idx) => {
                stepVortexRingZ(ring, tWarpSpeed, tCurrentWarpZ, TUNNEL_DEPTH); // core
                const center = getVortexCenterAt(ring.position.z, pathParams, tCurrentWarpZ); // core/webgl/three-vortex.js
                const val = vizDataArray[idx % bufferLength] || 0;
                const color = getComputedColor(idx, tRings.length, val); // core/audio-analysis.js
                let colorToApply;
                if (cfg.mode === 'gradient') colorToApply = color.fill;
                else if (cfg.mode === 'dynamic') colorToApply = idx % 2 === 0 ? cfg.dynA : cfg.dynB;
                else colorToApply = cfg.solidColor;
                finishVortexRingFrame(ring, center, val, smoothedEnergy, colorToApply); // core
            });
        } else if (cfg.vortexStyle === 'bars') {
            const dummy = new THREE.Object3D();
            const barsRingCount = cfg.barsRingCount, barsPerRing = cfg.barsPerRing;
            const twistPerRing = (Math.PI * 2 / barsRingCount) * cfg.barsTwistFactor;
            const globalTwist = appState.get('frameCounter') * 0.004;
            const tBarsMesh = appState.get('tBarsMesh');
            const tBarRingZs = appState.get('tBarRingZs');
            for (let r = 0; r < barsRingCount; r++) {
                stepVortexBarRingZ(r, tWarpSpeed, tCurrentWarpZ, TUNNEL_DEPTH); // core
                const z = tBarRingZs[r];
                const center = getVortexCenterAt(z, pathParams, tCurrentWarpZ); // core/webgl/three-vortex.js
                const val = vizDataArray[r % 40] || 0;
                const color = getComputedColor(r, barsRingCount, val); // core/audio-analysis.js
                let ringColor;
                if (cfg.mode === 'gradient') ringColor = color.fill;
                else if (cfg.mode === 'dynamic') ringColor = (r % 2 === 0) ? cfg.dynA : cfg.dynB;
                else ringColor = cfg.solidColor;
                const threeColor = new THREE.Color(ringColor);
                computeVortexBarsRingFrame(dummy, tBarsMesh, r, barsPerRing, z, center, val, smoothedEnergy, twistPerRing, globalTwist, threeColor); // core
            }
            tBarsMesh.instanceMatrix.needsUpdate = true;
            if (tBarsMesh.instanceColor) tBarsMesh.instanceColor.needsUpdate = true;
        } else if (cfg.vortexStyle === 'wave') {
            const tWaveMeshes = appState.get('tWaveMeshes');
            tWaveMeshes.forEach((wave, idx) => {
                stepVortexWaveZ(wave, tWarpSpeed, tCurrentWarpZ, TUNNEL_DEPTH); // core
                const center = getVortexCenterAt(wave.position.z, pathParams, tCurrentWarpZ); // core/webgl/three-vortex.js
                const val = vizDataArray[idx % bufferLength] || 0;
                const color = getComputedColor(idx, tWaveMeshes.length, val); // core/audio-analysis.js
                let colorToApply;
                if (cfg.mode === 'gradient') colorToApply = color.fill;
                else if (cfg.mode === 'dynamic') colorToApply = idx % 2 === 0 ? cfg.dynA : cfg.dynB;
                else colorToApply = cfg.solidColor;
                finishVortexWaveFrame(wave, center, cfg.waveRotationBase, cfg.waveRotationEnergyMult, cfg.waveScaleBase, cfg.waveScaleEnergyMult, smoothedEnergy, colorToApply); // core
            });
        }

        // SỬA (25/09/2026, Giang báo "va đập") — camera đặt ĐÚNG tâm ống, bỏ damping + lưới kẹp cứng.
        const camPos = getVortexCenterAt(tCurrentWarpZ, pathParams, tCurrentWarpZ); // core/webgl/three-vortex.js
        const tCamera = appState.get('tCamera');
        placeVortexCamera(tCamera, camPos, tCurrentWarpZ); // core

        const lookAheadZ = tCurrentWarpZ - VORTEX_LOOK_AHEAD;
        const lookPos = getVortexCenterAt(lookAheadZ, pathParams, tCurrentWarpZ); // core/webgl/three-vortex.js
        tCamera.lookAt(lookPos.x, lookPos.y, lookAheadZ);

        appState.get('tRenderer').render(appState.get('tScene'), tCamera);
    },

    /** Nhịp beat của circuit — CHỈ còn lo cinematic camera shift (GIỮ NGUYÊN 3 chế độ gốc,
     * core/webgl::triggerCinematicCameraShift(), trigger = nhạc vừa đổi đoạn (detectMusicTransition(),
     * mirror redirect vortex/finale fireworks) thay setInterval(7000) cố định gốc). ĐỔI (yêu cầu
     * Giang): bỏ phần cấp quota `signalsPerBeat` mỗi beat — xung giờ do từng node bắn theo audio
     * riêng, xem _tickConnectorCircuit(). */
    _tickConnectorBeat(isPlaying) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        if (cfg.connectorStyle === 'circuit' && cfg.cameraShiftEnabled) { // GIỮ đúng thứ tự gốc: tích luỹ flux MỖI FRAME, không chỉ lúc beat
            const fluxHistory = appState.get('fluxHistory');
            if (fluxHistory.length > 0) { _cnPendingBeatFluxSum += fluxHistory[fluxHistory.length - 1]; _cnPendingBeatFluxCount++; }
        }

        const isNewBeat = lastBeatTime > 0 && lastBeatTime !== _cnLastConsumedBeatTime;
        if (!isNewBeat) return;
        _cnLastConsumedBeatTime = lastBeatTime;
        if (!isPlaying || cfg.connectorStyle !== 'circuit') return;

        if (!cfg.cameraShiftEnabled) return;
        if (_cnPendingBeatFluxCount > 0) {
            _cnBeatFluxHistory.push(_cnPendingBeatFluxSum / _cnPendingBeatFluxCount);
            if (_cnBeatFluxHistory.length > 24) _cnBeatFluxHistory.shift();
        }
        _cnPendingBeatFluxSum = 0; _cnPendingBeatFluxCount = 0;
        _cnBeatsSinceLastShift++;
        if (_cnBeatsSinceLastShift < 2) return;
        if (!detectMusicTransition(_cnBeatFluxHistory, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return; // core/audio-analysis.js
        _cnBeatsSinceLastShift = 0;
        const mode = triggerCinematicCameraShift(appState.get('cnCamera'), appState.get('cnControls'), appState.get('cnChips'), appState.get('cnActiveSignalsCircuit')); // core/webgl
        appState.set('cnActiveCamMode', mode, { skipCheck: true });
    },

    /** VISUAL Connector — chọn ĐÚNG style rồi render (synapse: tRenderer trực tiếp không bloom,
     * y hệt gốc; circuit: qua cnComposer/bloomPass, y hệt gốc). `cnControls.update()` GIỮ NGUYÊN
     * chạy mỗi frame bất kể style, đúng animate() gốc. deltaTime thật (THREE.Clock, cap 0.1) GIỮ
     * NGUYÊN gốc thay vì giả định 60fps cố định. */
    _tickConnectorRender(isPlaying, smoothedEnergy, vizDataArray, bufferLength) {
        if (!appState.get('cnInitialized')) return;
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        const glowIntensity = getConnectorGlowMult() * 100; // core/custom-effect.js
        const deltaTime = Math.min(cnClock.getDelta(), 0.1); // core/webgl/three-connector.js

        // "Ổn định lại" sau seek: đang trong cửa sổ này thì KHÔNG bắn, xoá tia cũ, mỗi frame lấy FFT
        // hiện tại làm baseline — xem CONNECTOR_SEEK_SETTLE_FRAMES.
        const isSettling = this._connectorSettleFrames > 0;
        if (isSettling) this._connectorSettleFrames--;

        // Style 'brain' KHÔNG dùng WebGL — vẽ canvas 2D ở `_tickConnectorBrain()` (SAU clearRect, xem `_tickDraw()`). Ở đây chỉ xoá trắng canvas WebGL 1 lần.
        if (cfg.connectorStyle === 'brain') {
            if (!this._connectorWebglBlank) { appState.get('tRenderer').clear(); this._connectorWebglBlank = true; }
            return;
        }
        this._connectorWebglBlank = false;

        if (cfg.connectorStyle === 'synapse') {
            this._tickConnectorSynapse(isPlaying, smoothedEnergy, vizDataArray, bufferLength, cfg, glowIntensity, deltaTime, isSettling);
        } else {
            this._tickConnectorCircuit(isPlaying, smoothedEnergy, vizDataArray, bufferLength, cfg, glowIntensity, deltaTime, isSettling);
        }

        appState.get('cnControls').update();

        if (cfg.connectorStyle === 'synapse') appState.get('tRenderer').render(appState.get('cnScene'), appState.get('cnCamera'));
        else appState.get('cnComposer').render();
    },

    /** Xoá mọi tia synapse đang bay (dispose mesh — cùng cách xử lý lúc tia tới đích, xem
     * `_tickConnectorSynapse()`) — dùng lúc "ổn định lại" sau seek. */
    _clearSynapseSignals() {
        const activeSignals = appState.get('cnActiveSignalsSynapse');
        if (activeSignals.length === 0) return;
        activeSignals.forEach((signal) => {
            signal.synapse.fromNeuron.container.remove(signal.mesh); // spark là con của neuron nguồn, xem fireNeuronActionPotential()
            signal.mesh.geometry.dispose(); signal.mesh.material.dispose();
        });
        appState.set('cnActiveSignalsSynapse', [], { skipCheck: true });
        console.log(`writer: "workflowVisualizerRender._clearSynapseSignals", page: "cnActiveSignalsSynapse", content: "xoá ${activeSignals.length} tia sau seek"`);
    },

    /** Xoá mọi xung circuit đang bay + trả pin về rảnh (đúng như `resetConnectorPerTrackState()`,
     * core/webgl/three-connector.js, làm lúc đổi bài) — dùng lúc "ổn định lại" sau seek. @param {object[]} chips */
    _clearCircuitSignals(chips) {
        const activeSignals = appState.get('cnActiveSignalsCircuit');
        if (activeSignals.length === 0) return;
        const cnGroupCircuit = appState.get('cnGroupCircuit');
        activeSignals.forEach((signal) => destroyCircuitSignal(signal, cnGroupCircuit)); // core/webgl/three-connector.js
        appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
        console.log(`writer: "workflowVisualizerRender._clearCircuitSignals", page: "cnActiveSignalsCircuit", content: "xoá ${activeSignals.length} xung sau seek"`);
        chips.forEach((chip) => chip.pins.forEach((pin) => { pin.busy = false; }));
    },

    /** Mỗi nơ-ron: quét năng lượng theo dải tần TONOTOPIC riêng (log, không đều tuyến tính —
     * tonotopicBinRange(), synapse.js) qua bộ lọc mượt-hoá tăng dần theo tần số
     * (applyTonotopicSmoothing() — mô phỏng phase-locking ở trầm/rate-coding ở cao). Onset (diff>0)
     * + vượt ngưỡng HIỆU DỤNG (computeEffectiveFireThresholdByte() — gốc + tự thích nghi
     * (adaptation) + bị lân cận ức chế (lateralInhibition), THAY cooldown nhị phân cũ, xem
     * decayNeuronState()) mới bắn. Độ bừng sáng + tốc độ spark (computeSignalSpeedMult()) đều tỉ lệ
     * theo `diff`. KHÔNG còn vật lý lò xo (yêu cầu Giang 17/09/2026 — "loại bỏ tính đàn hồi") — chỉ
     * còn màu/glow cập nhật mỗi frame bất kể có bắn hay không. */
    _tickConnectorSynapse(isPlaying, smoothedEnergy, vizDataArray, bufferLength, cfg, glowIntensity, deltaTime, isSettling) {
        const neurons = appState.get('cnNeurons');
        if (isSettling) this._clearSynapseSignals(); // tia sinh trước seek — xoá NGAY (dispose mesh), không để bay tiếp
        const speed = computeConnectorSpeed(cfg.synapseSpeedBase, cfg.synapseSpeedEnergyMult, smoothedEnergy); // core/webgl
        // BỎ (phản hồi Giang 16/09/2026 — "bỏ camera xoay và zoom", map phải trải đều đúng diện
        // tích màn hình): trước đây KHỐI tự xoay quanh chính nó (rotation.x/y) để bù cho việc
        // camera không autoRotate — giờ camera ĐỨNG YÊN HẲN (updateConnectorVisibility(), core/
        // webgl/three-connector.js) và lưới cũng KHÔNG tự xoay nữa, đứng yên khớp đúng khung hình
        // đã tính (buildSynapseGridCells()). cfg.rotateSpeedBase/EnergyMult (slider "Rotate
        // speed") còn field/UI nhưng không còn tác dụng cho style synapse — nợ kỹ thuật đã biết,
        // chưa gỡ field vì ngoài phạm vi yêu cầu lần này.
        // BỎ (yêu cầu Giang 17/09/2026 — "loại bỏ tính đàn hồi"): `stiffness`/`damping`
        // (cfg.springStiffnessBase/EnergyMult, cfg.dampingBase/EnergyMult) hết tác dụng cùng lúc
        // với stepNeuronSpring() (ĐÃ XOÁ, synapse.js) — field/UI slider tương ứng còn trong
        // core/custom-effect.js, cùng diện "nợ kỹ thuật đã biết, chưa gỡ" như rotateSpeedBase ở
        // trên (ngoài phạm vi yêu cầu lần này).

        neurons.forEach((neuron, i) => {
            const rawPeak = computeNeuronBinEnergy(vizDataArray, bufferLength, i, neurons.length); // core/visualizer/groups/connector/synapse.js — dải tần tonotopic (log), không còn chia đều
            if (isSettling) { neuron.smoothedBinEnergy = rawPeak; neuron.prevBinEnergy = rawPeak; neuron.energy = 0; neuron.adaptation = 0; neuron.lateralInhibition = 0; } // rebaseline — frame này KHÔNG phải onset (diff = 0, không bắn)
            const energyByte = applyTonotopicSmoothing(neuron, rawPeak, i, neurons.length); // core/visualizer/groups/connector/synapse.js — MỚI: mượt-hoá tăng dần theo tần số (rate/volley coding)
            const diff = energyByte - neuron.prevBinEnergy;
            if (isPlaying && !isSettling) {
                const effectiveThresholdByte = computeEffectiveFireThresholdByte(neuron, cfg); // core/visualizer/groups/connector/synapse.js — MỚI: thay cooldown nhị phân bằng adaptation + lateralInhibition
                if (diff > 0 && energyByte > effectiveThresholdByte) {
                    triggerNeuronAdaptation(neuron); // core/visualizer/groups/connector/synapse.js — MỚI: tự đè ngưỡng lên (refractory), thay lastFiredFrame cũ
                    // MỚI (yêu cầu Giang — lateral inhibition): đè tạm ngưỡng của NEURON LÂN CẬN
                    // (cả 2 chiều dây — connectedSynapses/incomingSynapses) mỗi khi nơ-ron này bắn,
                    // để 1 tiếng động broadband không làm cả cụm cùng sáng loạt.
                    neuron.connectedSynapses.forEach((s) => applyLateralInhibition(s.toNeuron, cfg.lateralInhibitStrength)); // core/visualizer/groups/connector/synapse.js
                    neuron.incomingSynapses.forEach((s) => applyLateralInhibition(s.fromNeuron, cfg.lateralInhibitStrength)); // core/visualizer/groups/connector/synapse.js
                    // BỎ (yêu cầu Giang 17/09/2026 — "loại bỏ tính đàn hồi"): trước tính thêm
                    // `magnitude`/`impulse` (Vector3 +Z) để cộng vào neuron.velocity qua
                    // stepNeuronSpring() — không còn velocity/vị trí đàn hồi nào để cộng vào nữa.
                    // energyOverride (độ bừng sáng) + speedMult (tốc độ spark, MỚI) đều tỉ lệ theo
                    // `diff` — onset càng mạnh, càng sáng VÀ càng bắn nhanh.
                    fireNeuronActionPotential(i, Math.min(2.2, 1.2 + diff / 60), computeSignalSpeedMult(diff)); // core/webgl/three-connector.js
                }
            }
            neuron.prevBinEnergy = energyByte;
            decayNeuronState(neuron, deltaTime); // core/visualizer/groups/connector/synapse.js — THAY stepNeuronSpring() (đã xoá) + decayNeuronExcitement() (đổi tên) — fade glow + adaptation + lateralInhibition
            const color = getComputedColor(i, neurons.length, energyByte); // core/audio-analysis.js
            applyNeuronExcitement(neuron, color.fillNoAlpha, color.glow); // core/visualizer/groups/connector/synapse.js — SỬA: đồng bộ SỐNG mọi vật liệu (không chỉ soma), xem docblock hàm
            applyConnectorGlowSettings(neuron.glowSprite, cfg.glowEnabled, glowIntensity); // core/visualizer/groups/connector/common.js
        });

        const activeSignals = appState.get('cnActiveSignalsSynapse');
        for (let i = activeSignals.length - 1; i >= 0; i--) {
            const signal = activeSignals[i];
            const arrived = stepActionPotential(signal, signal.synapse, speed * signal.speedMult, deltaTime); // core/visualizer/groups/connector/synapse.js — MỚI: speedMult riêng từng signal (tốc độ NỀN chung × độ mạnh onset đã sinh ra nó)
            if (!arrived) continue;
            signal.synapse.fromNeuron.container.remove(signal.mesh); // ĐỔI: spark là con của neuron nguồn (three-connector.js::fireNeuronActionPotential), không phải cnGroupSynapse
            signal.mesh.geometry.dispose(); signal.mesh.material.dispose();
            activeSignals.splice(i, 1);
            const toNeuron = signal.synapse.toNeuron;
            // SỬA (bug Giang phát hiện 17/09/2026 — "chạy liên tục nhưng quá liên tục... toàn mạng
            // đều phát tín hiệu -> lag"): TRƯỚC ĐÂY gọi lại fireNeuronActionPotential() ở đây —
            // hàm đó spawn spark MỚI tới TẤT CẢ connectedSynapses của toNeuron, biến 1 lần bắn onset
            // thật thành CHAIN REACTION vô điều kiện lan khắp đồ thị (không cooldown/ngưỡng nào
            // chặn). Đổi sang litNeuronFromSignalArrival() (MỚI, core/webgl/three-connector.js) —
            // chỉ bừng sáng tại đích, KHÔNG lan spark tiếp, dừng đúng 1 bước kể từ nơ-ron bắn onset
            // thật. Bỏ luôn `pushDir` (Vector3 +Z 11.0) — không còn velocity/đàn hồi nào để đẩy vào.
            litNeuronFromSignalArrival(toNeuron.id); // core/webgl/three-connector.js — energyOverride mặc định 2.2 GIỮ NGUYÊN gốc
        }
    },

    /** ĐỔI (yêu cầu Giang — "mapping audio kích hoạt bắn xung ở các node tương ứng"): mỗi chip
     * là 1 dải tần tonotopic riêng (node index i <-> dải i, bass ở vỏ ngoài cube — CÙNG hàm với
     * neuron synapse: computeNeuronBinEnergy/applyTonotopicSmoothing/computeEffectiveFireThreshold
     * Byte/triggerNeuronAdaptation/applyLateralInhibition/decayNeuronState, synapse.js). Dải của
     * chip onset (tăng + vượt ngưỡng hiệu dụng) thì CHÍNH chip đó phát 1 xung; payload = 1..7 bit
     * sáng theo cường độ của chip (pickOnBitCountFromEnergy(), circuit.js). ĐÍCH theo pitch: node
     * có dải tần chứa nốt đang phát (YIN -> lastValidMidiNote, tra qua tonotopicNodeIndexForFrequency())
     * — không có nốt mới/trùng nguồn thì rơi về node gần nhất (pickCircuitTargetIndex()). BỎ quota
     * theo beat + chain-reaction 1-3 xung con ngẫu nhiên (tới đích chỉ nháy chip đó, giống synapse
     * 17/09/2026); trần đồng thời = cfg.maxConcurrentSignals. Line lan + đuôi wipe qua
     * updateCircuitSignal() (GIỮ NGUYÊN mechanic gốc + setDrawRange thêm). */
    _tickConnectorCircuit(isPlaying, smoothedEnergy, vizDataArray, bufferLength, cfg, glowIntensity, deltaTime, isSettling) {
        const chips = appState.get('cnChips');
        if (isSettling) this._clearCircuitSignals(chips); // xung sinh trước seek — xoá NGAY, trả pin về rảnh
        const activeSignals = appState.get('cnActiveSignalsCircuit');
        const cnGroupCircuit = appState.get('cnGroupCircuit');
        const speed = computeConnectorSpeed(cfg.circuitSpeedBase, cfg.circuitSpeedEnergyMult, smoothedEnergy); // core/webgl
        appState.get('cnBloomPass').strength = computeConnectorSpeed(cfg.bloomStrengthBase, cfg.bloomStrengthEnergyMult, smoothedEnergy); // core/webgl

        // Node đích theo pitch — tra 1 lần/frame (mọi chip cùng bắn frame này dùng chung nốt hiện tại).
        let pitchNodeIndex = null;
        if (isPlaying && chips.length > 1) {
            const { lastValidMidiNote, lastValidNoteTime, audioContext } = appState.get(['lastValidMidiNote', 'lastValidNoteTime', 'audioContext']);
            if (lastValidMidiNote != null && audioContext && Date.now() - lastValidNoteTime < CIRCUIT_PITCH_FRESH_MS) {
                const pitchHz = 440 * Math.pow(2, (lastValidMidiNote - 69) / 12);
                pitchNodeIndex = tonotopicNodeIndexForFrequency(pitchHz, chips.length, bufferLength, audioContext.sampleRate); // core/visualizer/groups/connector/synapse.js
            }
        }

        chips.forEach((chip, i) => {
            const chipColor = getComputedColor(i, chips.length, 128); // core/audio-analysis.js — dataValue=128 GIỮ NGUYÊN như lúc build (chip không có "giá trị audio riêng" như bar)
            applyChipLiveColor(chip, chipColor.fillNoAlpha); // core/visualizer/groups/connector/circuit.js — MỚI, xem docblock hàm (đồng bộ màu sống, tránh phải rebuild)
            applyChipGlowSettings(chip.bodyMesh, cfg.glowEnabled, glowIntensity); // core/visualizer/groups/connector/common.js
            decayChipSpin(chip, deltaTime); // core/visualizer/groups/connector/circuit.js

            const rawPeak = computeNeuronBinEnergy(vizDataArray, bufferLength, i, chips.length); // core/visualizer/groups/connector/synapse.js
            if (isSettling) { chip.smoothedBinEnergy = rawPeak; chip.prevBinEnergy = rawPeak; chip.energy = 0; chip.adaptation = 0; chip.lateralInhibition = 0; } // rebaseline sau seek — không phải onset
            const energyByte = applyTonotopicSmoothing(chip, rawPeak, i, chips.length); // core/visualizer/groups/connector/synapse.js
            const diff = energyByte - chip.prevBinEnergy;
            if (isPlaying && !isSettling && diff > 0 && energyByte > computeEffectiveFireThresholdByte(chip, cfg)) { // core/visualizer/groups/connector/synapse.js
                triggerNeuronAdaptation(chip); // core/visualizer/groups/connector/synapse.js
                chip.neighbors.forEach((n) => applyLateralInhibition(chips[n], cfg.lateralInhibitStrength)); // core/visualizer/groups/connector/synapse.js
                if (activeSignals.length < cfg.maxConcurrentSignals) {
                    const targetIndex = pickCircuitTargetIndex(chips, i, pitchNodeIndex); // core/visualizer/groups/connector/circuit.js
                    if (targetIndex !== null) {
                        const onBitCount = pickOnBitCountFromEnergy(energyByte, cfg.fireThreshold * 255); // core/visualizer/groups/connector/circuit.js
                        const signal = spawnCircuitSignal(chip, chips[targetIndex], activeSignals, onBitCount, cnGroupCircuit); // core/webgl
                        if (signal) {
                            appState.mutate('cnActiveSignalsCircuit', (arr) => arr.push(signal), { skipCheck: true });
                            pulseChipOnFire(chip); // core/webgl/three-connector.js
                        }
                    }
                }
            }
            chip.prevBinEnergy = energyByte;
            decayNeuronState(chip, deltaTime); // core/visualizer/groups/connector/synapse.js
        });

        if (appState.get('cnActiveCamMode') === 'ORBIT_SWEEP') { // GIỮ NGUYÊN "gentle slow drift" animate() gốc
            const t = cnClock.getElapsedTime();
            const cam = appState.get('cnCamera');
            cam.position.x += Math.cos(t * 0.15) * 0.04;
            cam.position.z += Math.sin(t * 0.15) * 0.04;
        }

        for (let i = activeSignals.length - 1; i >= 0; i--) {
            const signal = activeSignals[i];
            const result = updateCircuitSignal(signal, deltaTime, speed, cfg.trailLength); // core/visualizer/groups/connector/circuit.js
            if (result === 'destroy') {
                destroyCircuitSignal(signal, cnGroupCircuit); // core/webgl/three-connector.js
                activeSignals.splice(i, 1);
            } else if (result === 'arrive') {
                onCircuitSignalArrival(signal); // core/webgl/three-connector.js — GSAP shockwave + bắt đầu fade (KHÔNG spawn xung con — xem docblock hàm)
            }
        }
    },

    /** VISUAL Connector — style 'brain': BÊ NGUYÊN phần canvas của Brain_Filter_Perception_Visualization.html
     * (core/visualizer/groups/connector/brain.js). SỬA (22/09/2026, Giang báo "sóng không theo beat")
     * — bỏ hẳn bộ phát hiện beat TỰ CHẾ trong brain.js (so beatScale/smoothedEnergy, không đáng tin —
     * xem lịch sử ở đầu core/visualizer/groups/connector/brain.js), thay bằng đọc THẲNG `lastBeatTime`
     * — mốc beat THẬT (spectral flux, đã dùng để tính BPM) mà audio-analysis.js đã ghi sẵn ra appState
     * (xem service/state/visualizer-runtime.js). Nhận thêm `smoothedEnergy`/`vizDataArray`/
     * `bufferLength` (đã đọc sẵn ở `_tickDraw()`) và `midiNote` (đọc thêm từ appState).
     * THÊM (23/09/2026) `beatScale` + `isPlaying` (tia input co bóp) và `bpm` — đọc `currentCalculatedBpm`
     * (chuỗi, "---" khi chưa tính được -> NaN, brain.js tự fallback) cho dot chạy quanh ellipse. */
    _tickConnectorBrain(ctx, lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote, beatScale, isPlaying) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        if (this._tickBrainBurstTrigger(isPlaying, lastBeatTime, cfg)) brainFilterOriginal.triggerBurst(); // core/visualizer/groups/connector/brain.js

        // ĐỔI (23/09/2026) — gom tham số vào 1 object `frame` (xem docblock draw(), brain.js). Thêm:
        // noteFresh (7 dây output — nốt còn "tươi"), sampleRate (năng lượng FFT đúng tần số nốt),
        // direction (Custom Effect). [SỬA 25/09/2026] timelineShape bỏ — trục thời gian đã chuyển sang style bar 'dot'.
        const audioContext = appState.get('audioContext');
        brainFilterOriginal.draw(ctx, canvas, {
            time: performance.now(),
            lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote, beatScale, isPlaying,
            noteFresh: midiNote !== null && midiNote !== undefined && (Date.now() - (appState.get('lastValidNoteTime') || 0)) < BRAIN_PITCH_FRESH_MS,
            bpm: parseFloat(appState.get('currentCalculatedBpm')),
            sampleRate: audioContext ? audioContext.sampleRate : 44100,
            direction: cfg.brainDirection,
            settings: cfg, // (23/09/2026) toàn bộ Custom Effect connector — brain.js::_applySettings() tự lấy field cần
        }); // core/visualizer/groups/connector/brain.js
    },

    /** MỚI (23/09/2026, Giang — "triggerBurst -> dùng music transition") — mirror
     * _tickConnectorBeat() (circuit camera shift): tích luỹ flux MỖI FRAME, mỗi beat mới đẩy trung
     * bình flux đoạn giữa 2 beat vào `_brBeatFluxHistory`, debounce tối thiểu 2 beat, rồi hỏi
     * detectMusicTransition() (core/audio-analysis.js). Trả true = vừa chuyển đoạn -> bắn burst.
     * `cfg.burstEnabled` tắt -> không bao giờ bắn. */
    _tickBrainBurstTrigger(isPlaying, lastBeatTime, cfg) {
        if (!cfg.burstEnabled) return false;
        const fluxHistory = appState.get('fluxHistory');
        if (fluxHistory.length > 0) { _brPendingBeatFluxSum += fluxHistory[fluxHistory.length - 1]; _brPendingBeatFluxCount++; }

        const isNewBeat = lastBeatTime > 0 && lastBeatTime !== _brLastConsumedBeatTime;
        if (!isNewBeat) return false;
        _brLastConsumedBeatTime = lastBeatTime;
        if (!isPlaying) return false;

        if (_brPendingBeatFluxCount > 0) {
            _brBeatFluxHistory.push(_brPendingBeatFluxSum / _brPendingBeatFluxCount);
            if (_brBeatFluxHistory.length > 24) _brBeatFluxHistory.shift();
        }
        _brPendingBeatFluxSum = 0; _brPendingBeatFluxCount = 0;
        _brBeatsSinceLastBurst++;
        if (_brBeatsSinceLastBurst < 2) return false;
        if (!detectMusicTransition(_brBeatFluxHistory, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return false; // core/audio-analysis.js
        _brBeatsSinceLastBurst = 0;
        return true;
    },

    /** [MỚI — rà soát Rule 3] VISUAL Bar — Workflow tự đọc `cfg.barStyle` rồi gọi ĐÚNG 1 trong 3
     * nhánh (Rule 1 — chọn style KHÔNG được nằm trong 1 hàm core nữa): 'mirror'/'cascade' tự
     * resolve màu qua `getComputedColor()` rồi `paintBarRects()` cho từng lô (core/visualizer/
     * groups/bar/{mirror,cascade}.js); 'black hole' [CHUYỂN NHÓM 05/09/2026, yêu cầu Giang — trước
     * đây `cfg.type === 'black hole'` riêng, `_tickBlackHole()` riêng] gọi RIÊNG LẺ từng hàm Core
     * theo đúng thứ tự bản gốc (core/visualizer/groups/bar/black-hole.js): bán kính mượt -> flare
     * (nếu đủ năng lượng) -> bước+vẽ sao -> tiến+vẽ flash -> dải cột tần số -> tâm hố đen. Thay hẳn
     * `drawBar()`/`drawBlackHole()` cũ (đã xoá, vi phạm Rule 1/2/3). */
    _tickBar(ctx, perf, isPlaying, beatScale, smoothedEnergy, globalHueOffset, vizDataArray, analyser) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        const dpr = appState.get('dpr');
        if (cfg.barStyle === 'dot') {
            this._tickBarDot(ctx, perf, isPlaying, cfg, dpr, smoothedEnergy, vizDataArray, analyser); // MỚI 25/09/2026
        } else if (cfg.barStyle === 'cascade') {
            const keys = computeBarCascadeFrame(cfg, canvas.width, canvas.height, dpr, vizDataArray); // core
            keys.forEach((k) => {
                const color = getComputedColor(...k.colorArgs); // core/audio-analysis.js
                paintBarRects(ctx, [k.shadowRect, k.capRect], color.fill, color.glow, dpr, perf.blurMult, 10); // core
            });
            ctx.shadowBlur = 0;
        } else if (cfg.barStyle === 'black hole') {
            const centerX = canvas.width / 2, centerY = canvas.height / 2;
            const minDimension = Math.min(canvas.width, canvas.height);
            const maxDist = Math.max(canvas.width, canvas.height);

            const currentRadius = computeBlackHoleRadius(minDimension, smoothedEnergy, beatScale, cfg.radiusRatio, cfg.radiusEnergyMult); // core
            const currentSuction = cfg.suctionBase + (isPlaying ? smoothedEnergy * cfg.suctionEnergyMult : 0);

            if (isPlaying && smoothedEnergy > cfg.flareThreshold) {
                const flareAlpha = (smoothedEnergy - cfg.flareThreshold) * 2.5;
                paintBlackHoleFlare(ctx, canvas.width, canvas.height, centerX, centerY, currentRadius, globalHueOffset, flareAlpha); // core
            }

            stepAndDrawBlackHoleStars(ctx, dpr, centerX, centerY, maxDist, currentRadius, currentSuction); // core

            const starFlashes = appState.get('starFlashes');
            advanceAndDrawBlackHoleFlashes(ctx, dpr, starFlashes, cfg.flashFadeSpeed); // core

            const usefulLength = Math.floor(analyser.frequencyBinCount * 0.35);
            const dynamicMaxBarHeight = (cfg.maxH / 1000) * (minDimension * 0.25);
            paintBlackHoleBarsSetup(ctx, dpr, cfg.barWidth); // core
            const bars = computeBlackHoleBarsFrame(vizDataArray, usefulLength, cfg.minH, dpr, dynamicMaxBarHeight, centerX, centerY, currentRadius); // core
            bars.forEach((b) => {
                const color = getComputedColor(...b.colorArgs); // core/audio-analysis.js
                paintBlackHoleBarLines(ctx, b.lines, color.fill, color.glow, dpr, perf.blurMult); // core
            });
            ctx.shadowBlur = 0;

            paintBlackHoleCore(ctx, centerX, centerY, currentRadius); // core
        } else {
            // VIẾT LẠI (25/09/2026, Giang — cải tiến mirror, giữ bản chất mirror + butterfly, xem docblock
            // core/visualizer/groups/bar/mirror.js): dải log + dB -85/-25 + nâng treble -> làm mượt kề ->
            // vạch đỉnh (state giữ ở Workflow `_mirrorPeaks`) -> dựng rect. Style này chạy FFT 2048
            // (needsHighResFft(group, style), service/state/visualizer-runtime.js).
            const time = performance.now();
            const dt = _mirrorLastTime ? Math.min(100, Math.max(0, time - _mirrorLastTime)) : 16;
            _mirrorLastTime = time;
            const barCount = resolveBarMirrorCount(cfg); // core
            const rawLevels = computeBarMirrorLevels(vizDataArray, analyser.frequencyBinCount, analyser.context.sampleRate, analyser.minDecibels, analyser.maxDecibels, barCount, cfg.mirrorTilt); // core
            const levels = spreadBarMirrorLevels(rawLevels, cfg.mirrorSmoothSpread); // core
            let peaks = null;
            if (cfg.mirrorPeaks !== false) {
                _mirrorPeaks = stepBarMirrorPeaks(levels, _mirrorPeaks, dt); // core
                peaks = _mirrorPeaks.vals;
            } else {
                _mirrorPeaks = null; // bật lại -> khởi tạo từ mức hiện tại, không bắn vạch cũ
            }
            const frame = computeBarMirrorFrame(cfg, canvas.width, canvas.height, dpr, levels, peaks); // core
            frame.bars.forEach((b) => {
                const color = getComputedColor(...b.colorArgs); // core/audio-analysis.js
                paintBarRects(ctx, b.rects, color.fill, color.glow, dpr, perf.blurMult, 15); // core
            });
            ctx.shadowBlur = 0;
        }
    },

    /** MỚI (25/09/2026, yêu cầu Giang) — style bar 'dot': trục thời gian chuyển từ connector brain thành
     * effect độc lập (core/visualizer/groups/bar/dot.js). Workflow giữ trạng thái (`_dot*`), tự đọc
     * appState (beat/nốt/audioContext), tự gọi RIÊNG LẺ từng hàm core: dựng hình (cache theo kích thước/
     * hình/số dot) -> đỉnh năng lượng -> cụm theo beat -> năng lượng dải từng cụm -> độ phồng + EMA ->
     * rung đàn hồi (chỉ hình line + toggle) -> vẽ dot. SỬA (25/09/2026, lượt 2): bỏ đường nối + mũi tên,
     * đồng màu, thêm rắn bò (dotMoving) + bẻ góc nhánh (dotBend/dotBendAngle). (Lượt 4) Moving có 2 kiểu
     * `dotMoveType` snake | dna — DNA nhân đôi + xoắn kép, tắt thì đứt từng cặp rồi nhập lại. */
    _tickBarDot(ctx, perf, isPlaying, cfg, dpr, smoothedEnergy, vizDataArray, analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const { lastBeatTime, lastValidMidiNote, lastValidNoteTime, audioContext } = appState.get(['lastBeatTime', 'lastValidMidiNote', 'lastValidNoteTime', 'audioContext']);
        const time = performance.now();
        const dt = _dotLastTime ? Math.min(100, Math.max(0, time - _dotLastTime)) : 16;
        _dotLastTime = time;

        const dotCount = Math.max(2, Math.round(cfg.dotCount || 40));
        if (_dotSmoothed.length !== dotCount) {
            _dotSmoothed = new Float32Array(dotCount); _dotClusters = [];
            _dotDnaLevels = new Float32Array(dotCount); _dotDnaBonds = new Float32Array(dotCount);
            _dotLastBase = null; _dotBlendFrom = null;
        }

        // Vị trí dot GỐC: rắn bò (Moving + kiểu snake) HOẶC hình trục tĩnh (tắt Moving / kiểu DNA — DNA
        // xoắn quanh hình tĩnh). SỬA (25/09/2026, lượt 2) — rắn chỉ bò khi đang phát nhạc.
        const moving = cfg.dotMoving === true;
        const dnaOn = moving && cfg.dotMoveType === 'dna';
        const snakeOn = moving && !dnaOn;
        let dots, baseRadius, maxRadius, shape;
        if (snakeOn) {
            const snakeKey = [canvas.width, canvas.height].join('|');
            if (!_dotSnake || snakeKey !== _dotSnakeKey) { _dotSnakeKey = snakeKey; _dotSnake = initDotSnake(canvas.width, canvas.height, dotCount); } // core
            // Số dot đổi -> khoảng cách/bán kính theo số dot mới (vết giữ nguyên, thân tự dài/ngắn theo)
            const expectSpacing = canvas.width * (1 - 2 * DOT_AXIS_MARGIN_X_FRAC) / (dotCount - 1);
            if (Math.abs(expectSpacing - _dotSnake.spacing) > 1e-6) {
                _dotSnake = { ..._dotSnake, spacing: expectSpacing, baseRadius: expectSpacing * DOT_BASE_RADIUS_FRAC, maxRadius: expectSpacing * DOT_MAX_RADIUS_FRAC };
            }
            if (isPlaying) _dotSnake = stepDotSnake(_dotSnake, dt / 1000, smoothedEnergy, dotCount); // core
            dots = sampleDotSnakeBody(_dotSnake, dotCount); // core
            baseRadius = _dotSnake.baseRadius;
            maxRadius = _dotSnake.maxRadius;
            shape = 'snake';
        } else {
            const geomKey = [canvas.width, canvas.height, cfg.dotShape, dotCount].join('|');
            if (geomKey !== _dotGeomKey) { _dotGeomKey = geomKey; _dotGeom = buildDotAxisGeometry(cfg.dotShape, canvas.width, canvas.height, dotCount); } // core
            dots = _dotGeom.dots; baseRadius = _dotGeom.baseRadius; maxRadius = _dotGeom.maxRadius; shape = _dotGeom.shape;
        }

        // (lượt 4) Đổi rắn <-> hình tĩnh: trượt mượt từ vị trí vừa vẽ sang vị trí mới, không nhảy.
        const baseKind = snakeOn ? 'snake' : 'static';
        if (_dotBaseKind && baseKind !== _dotBaseKind && _dotLastBase) { _dotBlendFrom = _dotLastBase; _dotBlendStart = time; }
        _dotBaseKind = baseKind;
        if (_dotBlendFrom) {
            const blendT = (time - _dotBlendStart) / DOT_BASE_BLEND_MS;
            dots = blendDotPositions(_dotBlendFrom, dots, blendT); // core
            if (blendT >= 1) _dotBlendFrom = null;
        }
        _dotLastBase = dots;

        // (lượt 4) DNA — nhân đôi + xoắn khi bật; tắt/đổi sang snake thì đứt lần lượt từng cặp rồi nhập lại.
        _dotDnaBreakClock = dnaOn ? 0 : _dotDnaBreakClock + dt;
        const dnaMax = stepDotDnaPairs(_dotDnaLevels, _dotDnaBonds, dt, dnaOn, _dotDnaBreakClock); // core
        if (isPlaying && dnaMax > 0) _dotDnaRot = (_dotDnaRot + (dt / 1000) * (DOT_DNA_ROT_SPEED + (isFinite(smoothedEnergy) ? smoothedEnergy : 0) * DOT_DNA_ROT_ENERGY)) % (Math.PI * 2);

        // Cụm sóng — beat THẬT mới (lastBeatTime đổi) sinh 1 cụm, quãng đường theo năng lượng chuẩn hoá.
        _dotEnergyPeak = computeDotEnergyPeak(_dotEnergyPeak, smoothedEnergy, dt); // core
        const isOnset = isPlaying && lastBeatTime && lastBeatTime !== _dotLastSeenBeatTime;
        if (lastBeatTime) _dotLastSeenBeatTime = lastBeatTime;
        const spawn = isOnset ? {
            normEnergy: (isFinite(smoothedEnergy) ? smoothedEnergy : 0) / Math.max(_dotEnergyPeak, 0.05),
            clusterSize: pitchToDotClusterSize(lastValidMidiNote), // core
        } : null;
        _dotClusters = stepDotClusters(_dotClusters, time, spawn, dotCount); // core
        const clusterEnergies = _dotClusters.map((cl) => {
            const arr = [];
            for (let k = 0; k < cl.clusterSize; k++) arr.push(computeNeuronBinEnergy(vizDataArray, bufferLength, k, cl.clusterSize) / 255); // core/visualizer/groups/connector/synapse.js
            return arr;
        });
        const targets = computeDotTargetBoosts(_dotClusters, clusterEnergies, time, dotCount); // core
        smoothDotBoosts(_dotSmoothed, targets); // core

        // Rung đàn hồi — chỉ hình line tĩnh + toggle bật; tắt thì biên độ về 0 ngay.
        const vibrate = !moving && dnaMax <= 0 && shape === 'line' && cfg.dotLineVibrate !== false; // DNA còn dở (đang nhập lại) thì chưa rung
        let vibAmpPx = 0;
        if (vibrate) {
            const noteFresh = isPlaying && lastValidMidiNote !== null && lastValidMidiNote !== undefined && (Date.now() - (lastValidNoteTime || 0)) < DOT_NOTE_FRESH_MS;
            const midi = noteFresh ? lastValidMidiNote : null;
            const noteEnergy = computeDotNoteEnergy(midi, vizDataArray, bufferLength, audioContext ? audioContext.sampleRate : 44100); // core
            stepDotLineVibration(_dotVibAmps, dt, midi, noteEnergy); // core
            vibAmpPx = Math.min(canvas.width, canvas.height) * DOT_VIB_AMP_FRAC;
        } else {
            _dotVibAmps.fill(0);
        }

        // SỬA (25/09/2026, lượt 2) — ĐỒNG MÀU: 1 màu duy nhất cho mọi dot trong frame (không theo index,
        // dot nghỉ không còn xám). Dot tác động chỉ khác kích thước + glow. Bỏ vẽ đường nối + mũi tên.
        const color = getComputedColor(0, 1, 128); // core/audio-analysis.js
        // SỬA (25/09/2026, Giang báo "không áp màu B ở chế độ 2 color") — chế độ 'dynamic' (2-color blend) trước đây luôn
        // ra màu A (getComputedColor(0,...) = hệ số 0). Giờ: dot nghỉ = A, dot trong cụm đang phình ngả dần sang B theo độ
        // phình (căn bậc 2 — lên B nhanh ở mức phình vừa), phình hết cỡ = B thuần. solid/gradient giữ nguyên 1 màu.
        const isTwoColor = cfg.mode === 'dynamic';
        const impactColor = (boost) => {
            if (!isTwoColor) return color;
            const c = interpolateColor(cfg.dynA, cfg.dynB, Math.sqrt(Math.min(1, Math.max(0, boost)))); // core/color-utils.js
            return { fill: c, glow: c };
        };
        // MỚI (25/09/2026, Giang) — "Độ phình" (%): nhân phần phình thêm của kiểu 'radius' (100% = như cũ).
        const swell = (isFinite(cfg.dotSwell) ? cfg.dotSwell : 100) / 100;
        const mode = cfg.dotImpactMode === 'height' ? 'height' : 'radius';
        const maxHalf = (cfg.maxH || 400) * dpr * 0.5; // cùng quy ước bar mirror (maxH × dpr × 0.5 mỗi bên)
        const bend = mode === 'height' ? (cfg.dotBend || 'none') : 'none';
        const bendDeg = isFinite(cfg.dotBendAngle) ? cfg.dotBendAngle : 35;
        // Danh sách dot cần vẽ: chuỗi gốc (A) + chuỗi DNA (B, chỉ khi còn DNA), kèm chiều sâu. Vẽ thanh nối
        // trước, rồi dot phía sau, rồi dot phía trước (đè đúng thứ tự trong/ngoài của vòng xoắn).
        const dnaRadius = Math.min(canvas.width, canvas.height) * DOT_DNA_RADIUS_FRAC;
        const items = [];
        for (let i = 0; i < dotCount; i++) {
            const d = dots[i];
            const y = vibrate ? d.y + computeDotLineDisplacement(d.u, _dotVibAmps, time, vibAmpPx) : d.y; // core
            if (dnaMax > 0 && _dotDnaLevels[i] > 0) {
                const pair = computeDotDnaPair(d, i, _dotDnaLevels[i], _dotDnaRot, dnaRadius); // core
                paintDotDnaBond(ctx, pair.ax, pair.ay, pair.bx, pair.by, _dotDnaBonds[i], color.fill, dpr); // core
                const da = computeDotDnaDepth(pair.az, pair.sep), db = computeDotDnaDepth(pair.bz, pair.sep); // core
                items.push({ i, x: pair.ax, y: pair.ay, z: pair.az * pair.sep, scale: da.scale, alpha: da.alpha });
                items.push({ i, x: pair.bx, y: pair.by, z: pair.bz * pair.sep, scale: db.scale, alpha: db.alpha * pair.appear });
            } else {
                items.push({ i, x: d.x, y, z: 0, scale: 1, alpha: 1 });
            }
        }
        for (let pass = 0; pass < 2; pass++) {
            for (let k = 0; k < items.length; k++) {
                const it = items[k];
                if ((pass === 0) !== (it.z < 0)) continue;
                const d = dots[it.i];
                const boost = _dotSmoothed[it.i];
                if (boost > DOT_IMPACT_MIN) {
                    const r = (mode === 'radius' ? baseRadius + boost * (maxRadius - baseRadius) * swell : baseRadius) * it.scale;
                    const halfLen = mode === 'height' ? boost * maxHalf * it.scale : 0;
                    const c = impactColor(boost);
                    paintDotAxisDot(ctx, d, it.x, it.y, mode, r, halfLen, bend, bendDeg, c.fill, c.glow, DOT_GLOW_BLUR_PX * boost * dpr * perf.blurMult, it.alpha); // core
                } else {
                    paintDotAxisDot(ctx, d, it.x, it.y, 'radius', baseRadius * it.scale, 0, 'none', 0, color.fill, color.glow, 0, it.alpha); // core
                }
            }
        }
        ctx.shadowBlur = 0;
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; // paintDotAxisDot() mode 'height' đặt round — trả về mặc định canvas
    },

    /** [MỚI — rà soát Rule 3] VISUAL Rain — Workflow tự đọc `cfg.rainStyle` rồi gọi ĐÚNG 1 trong
     * `_tickRainGlass()`/`_tickRainStreet()` (Rule 1 — chọn style KHÔNG được nằm trong 1 hàm core
     * nữa). Thay hẳn `drawRain()` cũ (đã xoá, vi phạm Rule 1/2/3). */
    _tickRain(ctx, perf, isPlaying, smoothedEnergy, beatScale, vizDataArray) {
        ctx.lineCap = 'round';
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        if (cfg.rainStyle === 'street') {
            this._tickRainStreet(ctx, perf, isPlaying, cfg, smoothedEnergy, beatScale, vizDataArray);
        } else {
            this._tickRainGlass(ctx, perf, isPlaying, cfg, smoothedEnergy, vizDataArray);
        }
    },

    /** Kiểu 'glass' — Workflow tự gom state + gọi RIÊNG LẺ từng hàm Core theo đúng thứ tự bản gốc
     * (core/visualizer/groups/rain/glass.js). */
    _tickRainGlass(ctx, perf, isPlaying, cfg, smoothedEnergy, vizDataArray) {
        const dpr = appState.get('dpr');
        const hasCustomBg = appConfigVisualBg.getAll().source.list.some((k) => k !== null) || appState.get('isVideoPlayerMode');
        if (!hasCustomBg) {
            const bgFill = getVisualBgFillStyle(ctx, canvas.width, canvas.height); // core/visual-bg.js
            ctx.fillStyle = bgFill;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const moon = computeRainMoonFrame(canvas.width, canvas.height, dpr, smoothedEnergy, cfg.glassMoonVisible); // core
        paintRainMoon(ctx, moon); // core

        const flashAlpha = computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, computeRainFlashEnergy(smoothedEnergy, vizDataArray), cfg.flashThreshold, cfg.flashMaxOpacity); // core
        drawScreenFlash(ctx, canvas.width, canvas.height, flashAlpha); // core/visualizer/draw

        if (cfg.glassCityVisible !== false) {
            const cityOpacity = (typeof cfg.glassCityOpacity === 'number' ? cfg.glassCityOpacity : 40) / 100;
            // SỬA (25/09/2026, Giang) — cửa sổ Big City theo color mode: sáng = đúng màu mode, tắt = màu tương
            // phản (core/visualizer/groups/rain/glass.js). Palette hexToRgb() 1 lần/frame, màu resolve TỪNG cửa.
            const cityFrame = computeRainCityFrame(canvas.width, canvas.height, appState.get('cityBuildings'), dpr, vizDataArray, isPlaying); // core
            const palette = {
                mode: cfg.mode, solid: hexToRgb(cfg.solidColor), dynA: hexToRgb(cfg.dynA), dynB: hexToRgb(cfg.dynB), // core/color-utils.js
                hueOffset: appState.get('globalHueOffset'),
            };
            const windowColors = cityFrame.windows.map((w) => {
                const litColor = resolveRainCityLitColor(palette, w.t, w.value); // core
                return w.lit ? litColor.css : resolveRainCityOffColor(litColor.h, litColor.s, litColor.l); // core
            });
            paintRainCity(ctx, cityFrame, windowColors, cityOpacity); // core
        }

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(10, 15, 25, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        appState.get('glassStaticDrops').forEach((d) => drawWaterDrop(ctx, d.x, d.y, d.r, 0.6)); // core

        maybeSpawnRainStreak(canvas.width, vizDataArray, isPlaying, smoothedEnergy, cfg.glassStreakFrequency, dpr); // core

        const glassStreaks = appState.get('glassStreaks');
        const glassStaticDrops = appState.get('glassStaticDrops');
        for (let i = glassStreaks.length - 1; i >= 0; i--) {
            const streak = glassStreaks[i];
            const result = advanceRainStreak(streak, glassStaticDrops, smoothedEnergy, dpr, canvas.width, canvas.height, cfg.glassDropDensity); // core
            drawWaterDrop(ctx, ...result.drawArgs); // core
            if (!result.alive) appState.mutate('glassStreaks', (arr) => arr.splice(i, 1), { skipCheck: true });
        }

        const glassGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.0)'); glassGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)');
        glassGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)'); glassGradient.addColorStop(0.41, 'transparent'); glassGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glassGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawWindowFrame(ctx); // core
    },

    /** Kiểu 'street' — Workflow tự gom state + gọi RIÊNG LẺ từng hàm Core theo đúng thứ tự bản gốc
     * (core/visualizer/groups/rain/street.js). */
    _tickRainStreet(ctx, perf, isPlaying, cfg, smoothedEnergy, beatScale, vizDataArray) {
        const dpr = appState.get('dpr');
        const hasCustomBg = appConfigVisualBg.getAll().source.list.some((k) => k !== null) || appState.get('isVideoPlayerMode');
        if (!hasCustomBg) {
            const bgFill = getVisualBgFillStyle(ctx, canvas.width, canvas.height); // core/visual-bg.js
            ctx.fillStyle = bgFill;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const flashAlpha = computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, computeRainFlashEnergy(smoothedEnergy, vizDataArray), cfg.flashThreshold, cfg.flashMaxOpacity); // core
        drawScreenFlash(ctx, canvas.width, canvas.height, flashAlpha); // core/visualizer/draw

        const rainIntensity = computeRainIntensity(isPlaying, smoothedEnergy); // core
        const streetRain = appState.get('streetRain');
        paintRainStreetDrops(ctx, canvas.width, canvas.height, dpr, streetRain.length, rainIntensity); // core

        const groundY = appState.get('streetGroundY') || canvas.height * 0.88;
        let stopColors;
        if (cfg.mode === 'solid') {
            stopColors = [{ offset: 0, color: interpolateColor('#0f141c', cfg.solidColor, 0.08) }, { offset: 1, color: '#08090f' }]; // core/color-utils.js
        } else if (cfg.mode === 'dynamic') {
            stopColors = [{ offset: 0, color: interpolateColor('#0f141c', cfg.dynA, 0.1) }, { offset: 1, color: interpolateColor('#08090f', cfg.dynB, 0.1) }]; // core/color-utils.js
        } else {
            stopColors = [{ offset: 0, color: 'rgba(15, 20, 28, 0.9)' }, { offset: 1, color: 'rgba(8, 10, 15, 0.95)' }];
        }
        paintRainGroundGradient(ctx, canvas.width, canvas.height, groundY, stopColors); // core

        paintParkFence(ctx, canvas.width, groundY, dpr); // core

        const streetLamps = appState.get('streetLamps');
        const lampSpecs = advanceRainLampsAndBuildSpecs(streetLamps, isPlaying, beatScale, dpr); // core
        lampSpecs.forEach((spec) => {
            const lampColor = getComputedColor(...spec.colorArgs); // core/audio-analysis.js
            let lampFill;
            if (cfg.mode === 'solid') lampFill = cfg.solidColor;
            else if (cfg.mode === 'dynamic') lampFill = spec.colorArgs[0] % 2 === 0 ? cfg.dynA : cfg.dynB;
            else lampFill = lampColor.fill;
            paintRainLamp(ctx, spec, lampFill, dpr); // core
        });

        if (isPlaying && beatScale > 0.55 && Math.random() > 0.92) {
            const mainLamp = streetLamps.find((l) => l.main);
            if (mainLamp) {
                const rippleColor = getComputedColor(0, 1, 200); // core/audio-analysis.js
                spawnRainRipple(mainLamp.x, groundY, canvas.height, dpr, rippleColor.fill, rippleColor.glow); // core
            }
        }
        const ripples = appState.get('ripples');
        advanceAndDrawRainRipples(ctx, ripples, dpr); // core
        ctx.globalAlpha = 1.0;
    },

    /** MỚI (26/09/2026, Giang) — VISUAL Shape style 'clock': đồng hồ lộ máy (vỏ + núm, không dây đeo), chuỗi
     * bánh răng ăn khớp quay theo nhạc, bánh lắc + càng hãm, vòng 60 vạch = phổ tròn, 3 kim. Workflow tự gom
     * state (động cơ `_clockDrive`, cache hình học `_clockLayout`/`_clockOutlines`), resolve màu qua
     * getComputedColor(), gọi RIÊNG LẺ từng hàm core/visualizer/groups/shape/clock.js.
     * SỬA (26/09/2026, lượt 2, Giang) — màu dùng đúng .fill/.glow (color mode trước đây không ăn), glow theo
     * khối Blur, kính phủ mặt số, toggle ẩn vỏ (`clockCaseVisible`), con lắc (`clockPendulum`), kim thêm nguồn
     * 'pastFuture' chạy theo nốt. Mọi hàm vẽ core giờ vẽ quanh gốc = tâm mặt số: Workflow translate tới tâm
     * (tâm dời lên khi có con lắc) + scale (thu nhỏ cả cụm khi màn không đủ cao).
     * SỬA (lượt 4, Giang) — bánh răng rời nhau phủ kín mặt số, toggle ẩn kính (`clockGlassVisible`), lật quanh
     * trục (`clockFlip`), vòng quét cỗ máy thời gian (`clockRingsVisible`) quay theo chiều kim của Hands show.
     * SỬA (lượt 5, Giang) — bỏ nguồn kim realtime/track (chỉ còn Past & Future, không dropdown); vòng quét thay
     * bằng 6 vòng quỹ đạo 3D: quay theo chiều kim, lật hướng kiểu Rubik theo bậc nốt (1-3 -> vòng 1-3, 5-7 -> 4-6).
     * SỬA (lượt 6, Giang) — con lắc / vòng quỹ đạo thành 1 dropdown `clockAccessory` (không đồng thời); con lắc thêm
     * bóng mờ dây (`clockPendulumTrail`) + chiều dài (`clockPendulumLength`, % tối đa vừa màn hình). */
    _tickClock(ctx, perf, isPlaying, dpr, smoothedEnergy, beatScale, vizDataArray, analyser) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        const W = canvas.width, H = canvas.height;
        const dialR = (Math.min(W, H) / 2) * (cfg.clockSizeRatio || 0.8) / 1.18;
        const geomKey = dialR.toFixed(1);
        if (geomKey !== _clockGeomKey) {
            _clockGeomKey = geomKey;
            _clockLayout = computeClockGearLayout(dialR); // core
            _clockOutlines = _clockLayout.gears.map((g) => buildClockGearOutline(g.z, g.r, g.m, g.ratchet)); // core
        }
        const now = performance.now();
        const dt = _clockLastTime ? Math.min(100, Math.max(0, now - _clockLastTime)) : 16;
        _clockLastTime = now;
        const caseVisible = cfg.clockCaseVisible !== false;
        const glowPx = CLOCK_GLOW_PX * dpr * perf.blurMult;
        const realtimeSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000; };

        // ---- Kim: CHỈ còn cơ chế Past & Future (lượt 5, Giang — bỏ realtime/track + dropdown). Kim chạy theo bậc
        // nốt 1-7 (< 4 ngược, 4 kẹt, > 4 thuận) × BPM; giờ ảo khởi đầu = giờ thật lúc clock chạy frame đầu. ----
        const { lastValidMidiNote, lastValidNoteTime, currentCalculatedBpm } = appState.get(['lastValidMidiNote', 'lastValidNoteTime', 'currentCalculatedBpm']);
        const bpm = parseFloat(currentCalculatedBpm) || 0; // '---' (chưa đo) -> 0 -> core dùng ×1
        const noteFresh = lastValidMidiNote !== null && lastValidMidiNote !== undefined && (Date.now() - (lastValidNoteTime || 0)) < CLOCK_PITCH_FRESH_MS;
        _clockPitch = advanceClockPitchHands(_clockPitch, dt, isPlaying, lastValidMidiNote, noteFresh, _clockPitch ? 0 : realtimeSec(), bpm); // core
        const totalSec = _clockPitch.virtualSec;
        const handsDir = _clockPitch.level / 2; // bánh răng + vòng quỹ đạo cùng chiều kim, bậc 1/7 = 1.5×
        const jam = _clockPitch.jam;

        _clockDrive = advanceClockDrive(_clockDrive, dt, isPlaying, beatScale, smoothedEnergy, cfg.clockGearSpeedBase, cfg.clockGearSpeedEnergyMult, handsDir, jam); // core
        const jitter = computeClockJamJitter(jam, now); // core
        const gearAngles = computeClockGearAngles(_clockLayout.gears, _clockDrive.masterAngle + jitter.gear); // core
        const levels = computeClockGearLevels(vizDataArray, _clockLayout, isPlaying); // core
        const gearCount = _clockLayout.gears.length;

        // ---- Vòng quét + lật + con lắc (state giữ cả khi tắt để chạy hiệu ứng ra/vào) ----
        // Lượt 6 (Giang) — con lắc / vòng quỹ đạo chọn 1 bằng dropdown `clockAccessory`. Khi đổi, cái cũ thu hẳn
        // về 0 rồi cái mới mới bắt đầu hiện -> không bao giờ cùng tồn tại, kể cả lúc chuyển.
        const accessory = cfg.clockAccessory || 'rings';
        const ringsOn = accessory === 'rings' && (!_clockPendulum || _clockPendulum.progress === 0);
        const pendulumOn = accessory === 'pendulum' && (!_clockRings || _clockRings.reveal === 0);
        _clockRings = advanceClockOrbitRings(_clockRings, dt, ringsOn, handsDir, isPlaying, smoothedEnergy, lastValidMidiNote, noteFresh); // core
        _clockFlip = advanceClockFlip(_clockFlip, dt, cfg.clockFlip === true, isPlaying, smoothedEnergy); // core
        _clockPendulum = advanceClockPendulum(_clockPendulum, dt, pendulumOn, isPlaying, smoothedEnergy, jam); // core
        const ringE = _clockRings.reveal;
        const caseR = dialR * (caseVisible ? 1.08 : 1.0);
        const topExtR = caseR + (dialR * 1.42 - caseR) * ringE;
        const baseScale = 1.18 / (1.18 + 0.24 * ringE); // co cụm lại chừa chỗ vòng quỹ đạo (mép ngoài ~1.42R)
        const pl = computeClockPendulumLayout(H, dialR, _clockPendulum.progress, caseVisible, topExtR, baseScale, cfg.clockPendulumLength); // core
        const caseColor = getComputedColor(0, 1, 200); // core/audio-analysis.js

        ctx.save();
        ctx.translate(W / 2, pl.cy);
        ctx.scale(pl.scale, pl.scale);

        if (_clockPendulum.progress > 0) {
            const swingAt = (ph) => Math.sin(ph) * _clockPendulum.amp * pl.reveal;
            // Bóng mờ dây (lượt 6): 6 dây ma lùi pha dần, tắt toggle -> mảng rỗng.
            const ghostSwings = cfg.clockPendulumTrail !== false ? [1, 2, 3, 4, 5, 6].map((g) => swingAt(_clockPendulum.phase - g * CLOCK_PENDULUM_GHOST_LAG)) : [];
            paintClockPendulum(ctx, pl.pivotY, pl.length, pl.bobR, swingAt(_clockPendulum.phase), pl.reveal, caseColor.fill, caseColor.glow, glowPx, dpr, ghostSwings); // core
        }
        // Vòng quỹ đạo — nửa SAU vẽ trước thân đồng hồ, nửa TRƯỚC vẽ sau cùng (xem cuối hàm).
        const ringColors = ringE > 0 ? [0, 1, 2, 3, 4, 5].map((k) => getComputedColor(k, 6, 170 + 85 * (isPlaying ? smoothedEnergy : 0))) : null; // core/audio-analysis.js
        if (ringE > 0) paintClockOrbitRings(ctx, dialR, _clockRings, false, ringColors, glowPx, jitter.gear * 3, dpr); // core

        // Lật quanh trục của chính đồng hồ (chỉ thân đồng hồ — không lật con lắc/vòng quét): nén theo cos góc.
        ctx.save();
        const flipCos = Math.cos(_clockFlip.angle);
        if (_clockFlip.axis === 0) ctx.scale(flipCos, 1); else ctx.scale(1, flipCos);

        _clockLayout.gears.forEach((g, i) => {
            const color = getComputedColor(i, gearCount + 1, levels[i]); // core/audio-analysis.js
            paintClockGear(ctx, g, _clockOutlines[i], gearAngles[i], color.fill, color.glow, glowPx, levels[i] / 255, dpr); // core
        });
        const balLevel = levels[gearCount] / 255;
        const swing = Math.sin(_clockDrive.balancePhase) * (0.5 + (isPlaying ? smoothedEnergy : 0) * 1.6) + jitter.gear * 3;
        const escapeGear = _clockLayout.gears.find((g) => g.ratchet);
        const balColor = getComputedColor(gearCount, gearCount + 1, levels[gearCount]); // core/audio-analysis.js
        paintClockBalance(ctx, _clockLayout.balance, escapeGear, swing, balColor.fill, balColor.glow, glowPx, balLevel, dpr); // core

        const glassVisible = cfg.clockGlassVisible !== false; // lượt 4 — toggle ẩn kính
        if (glassVisible) paintClockGlass(ctx, dialR, caseColor.glow); // core — kính phủ kín bánh răng

        // Lượt 3 (Giang) — toggle `clockTicksVisible` ẩn cả vòng 60 vạch đo giờ (bỏ luôn phần tính phổ).
        if (cfg.clockTicksVisible !== false) {
            const tickLevels = computeClockSpectrumTicks(vizDataArray, analyser.frequencyBinCount, isPlaying, cfg.clockTickGain); // core
            const tickColors = Array.from(tickLevels, (v, i) => getComputedColor(i, 60, v * 255)); // core/audio-analysis.js
            paintClockTicks(ctx, dialR, tickLevels, tickColors, glowPx * 0.6, dpr); // core
        }

        if (caseVisible) paintClockCase(ctx, dialR, caseColor.fill, caseColor.glow, glowPx, isPlaying ? beatScale : 0, dpr); // core

        const handAngles = computeClockHandAngles(totalSec); // core
        handAngles.hour += jitter.hour; handAngles.minute += jitter.minute; handAngles.second += jitter.second;
        paintClockHands(ctx, dialR, handAngles, caseColor.fill, caseColor.glow, CLOCK_SECOND_HAND_COLOR, glowPx, dpr); // core
        if (glassVisible) paintClockGlassGlare(ctx, dialR, dpr); // core — vệt loá kính đè lên kim
        ctx.restore();
        if (ringE > 0) paintClockOrbitRings(ctx, dialR, _clockRings, true, ringColors, glowPx, jitter.gear * 3, dpr); // core — nửa trước

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    },

    /** [MỚI — rà soát Rule 3] VISUAL Rubik — Workflow tự gom appState/cfg, tự vòng lặp gọi RIÊNG
     * LẺ `rotate3D()`/`project3D()`/`rotateRubikIndices()` (core/rubik-math.js) +
     * `getComputedColor()` (core/audio-analysis.js) cho từng khối/đỉnh — core/visualizer/groups/
     * shape/rubik.js chỉ còn tính toán thuần + vẽ. Thay hẳn `drawRubik()` cũ (đã xoá, vi phạm Rule 2/3). */
    _tickRubik(ctx, isPlaying, dpr, smoothedEnergy, beatScale, vizDataArray) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        const currentMidi = appState.get('lastValidMidiNote');
        const rubikPitchAvg = appState.get('rubikPitchAvg');

        advanceRubikSelfSpin(isPlaying, currentMidi, rubikPitchAvg, smoothedEnergy, cfg.pitchSensitivity); // core

        maybeTriggerRubikLayerTurn(isPlaying, smoothedEnergy, currentMidi, cfg.rotationEnergyThreshold, rubikPitchAvg); // core
        const completedTurn = advanceRubikLayerTurnProgress(cfg.layerTurnSpeed, smoothedEnergy); // core
        if (completedTurn) rotateRubikIndices(completedTurn.axis, completedTurn.layer, completedTurn.dir); // core/rubik-math.js

        const cubeSize = Math.min(canvas.width, canvas.height) * cfg.cubeSizeRatio;
        const spacing = cubeSize * 1.05;
        const viewDist = cubeSize * 25;
        const fov = cubeSize * 18;
        const centerX = canvas.width / 2, centerY = canvas.height / 2;

        const rubikCubes = appState.get('rubikCubes');
        const drawnCubes = [];
        for (let i = 0; i < rubikCubes.length; i++) {
            const rc = rubikCubes[i];
            const val = vizDataArray[rc.binIdx * 4] || 0;
            const base = computeRubikCubeBase(rc, val, isPlaying, beatScale, cubeSize, spacing); // core
            let pos = base.pos;
            if (base.turnRotAxis === 'x') pos = rotate3D(pos, base.turnRotAngle, 0, 0); // core/rubik-math.js
            else if (base.turnRotAxis === 'y') pos = rotate3D(pos, 0, base.turnRotAngle, 0); // core/rubik-math.js
            else if (base.turnRotAxis === 'z') pos = rotate3D(pos, 0, 0, base.turnRotAngle); // core/rubik-math.js
            const cCenter = rotate3D(pos, rubikRotX, rubikRotY, 0); // core/rubik-math.js
            drawnCubes.push({ rc, centerZ: cCenter.z, val, pos, scale: base.scale });
        }

        drawnCubes.sort((a, b) => b.centerZ - a.centerZ);
        drawnCubes.forEach((c) => {
            const colors = getComputedColor(c.rc.binIdx, 27, c.val); // core/audio-analysis.js
            const projVerts = RUBIK_UNIT_VERTICES.map((uv) => {
                let vertPos = computeRubikVertexLocalPos(c.pos, uv, cubeSize, c.scale); // core
                if (rubikAnim.active && c.rc['c' + rubikAnim.axis] === rubikAnim.layer) {
                    const currentRot = rubikAnim.angle * rubikAnim.dir;
                    vertPos = { x: vertPos.x - c.pos.x, y: vertPos.y - c.pos.y, z: vertPos.z - c.pos.z };
                    if (rubikAnim.axis === 'x') vertPos = rotate3D(vertPos, currentRot, 0, 0); // core/rubik-math.js
                    else if (rubikAnim.axis === 'y') vertPos = rotate3D(vertPos, 0, currentRot, 0); // core/rubik-math.js
                    else if (rubikAnim.axis === 'z') vertPos = rotate3D(vertPos, 0, 0, currentRot); // core/rubik-math.js
                    vertPos = { x: vertPos.x + c.pos.x, y: vertPos.y + c.pos.y, z: vertPos.z + c.pos.z };
                }
                const rotV = rotate3D(vertPos, rubikRotX, rubikRotY, 0); // core/rubik-math.js
                return project3D(rotV, fov, viewDist, centerX, centerY); // core/rubik-math.js
            });
            paintRubikCubeFaces(ctx, projVerts, colors.fill, dpr); // core
            if (c.val > 140) paintRubikCubeGlow(ctx, projVerts, colors.glow, dpr); // core
        });
    },

    _tickLighting(ctx, perf, isPlaying, beatScale, smoothedEnergy, vizDataArray) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        if (cfg.lightingStyle === 'fireworks') {
            this._tickLightingFireworks(ctx, perf, isPlaying, beatScale, smoothedEnergy, vizDataArray, cfg);
        } else {
            this._tickLightingThunder(ctx, perf, isPlaying, smoothedEnergy, vizDataArray, cfg);
        }
    },

    /** Style "thunder" (tia sét) — đọc/ghi appState, gọi RIÊNG LẺ từng hàm Core (core/visualizer/
     * groups/lighting/thunder.js). Port thuần từ drawLightning() cũ (đã xoá, vi phạm Rule 2). */
    _tickLightingThunder(ctx, perf, isPlaying, smoothedEnergy, vizDataArray, cfg) {
        const { dpr, activeLightnings } = appState.get(['dpr', 'activeLightnings']);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter';

        const energySpike = computeLightningEnergySpike(smoothedEnergy, vizDataArray); // core
        const flashAlpha = computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, energySpike, cfg.flashThreshold, cfg.flashMaxOpacity); // core
        drawScreenFlash(ctx, canvas.width, canvas.height, flashAlpha); // core/visualizer/draw

        if (shouldSpawnLightningBolt(isPlaying, energySpike, cfg.boltThreshold, cfg.boltSpawnChance, activeLightnings.length, cfg.maxBoltCount)) { // core
            const color = getComputedColor(Math.floor(Math.random() * 10), 10, 255); // core/audio-analysis.js
            const bolt = createLightningBolt(canvas.width, canvas.height, dpr, cfg.boltHorizontalDeviation, cfg.boltSegmentLength, color); // core
            appState.mutate('activeLightnings', (arr) => arr.push(bolt), { skipCheck: true });
        }

        const survivors = [];
        appState.get('activeLightnings').forEach((bolt) => {
            if (advanceLightningBolt(bolt, cfg.boltFadeSpeed, smoothedEnergy)) { // core
                drawLightningBolt(ctx, bolt, dpr, perf.blurMult); // core
                survivors.push(bolt);
            }
        });
        appState.set('activeLightnings', survivors, { skipCheck: true });
    },

    /** Style "fireworks" (pháo hoa) — đọc/ghi appState, gọi RIÊNG LẺ từng hàm Core (core/
     * visualizer/groups/lighting/fireworks.js). @param {object} perf - { blurMult } */
    _tickLightingFireworks(ctx, perf, isPlaying, beatScale, smoothedEnergy, vizDataArray, cfg) {
        const { dpr, currentCalculatedBpm } = appState.get(['dpr', 'currentCalculatedBpm']);

        this._fwAutoLaunch(isPlaying, beatScale, smoothedEnergy, currentCalculatedBpm, cfg);
        this._fwUpdateFinaleTrigger(isPlaying, beatScale, cfg);

        const { fwRockets, fwParticles } = appState.get(['fwRockets', 'fwParticles']);
        const spectrumBin = (vizDataArray && vizDataArray.length > 0) ? vizDataArray[Math.floor(Math.random() * Math.min(32, vizDataArray.length))] : 0;
        const remainingRockets = [];
        let burstParticles = [];
        let flashTarget = 0;

        fwRockets.forEach((rocket) => {
            advanceFireworksRocket(rocket); // core
            if (hasFireworksRocketArrived(rocket)) { // core
                // "Zoom to/nhỏ" theo nhạc (mục 1+4, phản hồi Giang) — độ cao bin FFT gán cho rocket
                // này ĐỌC LẠI NGAY LÚC NỔ, kết hợp độ mạnh bass lúc BẮN (đã lưu trên rocket).
                const binValue01 = (vizDataArray && vizDataArray[rocket.binIndex] !== undefined) ? vizDataArray[rocket.binIndex] / 255 : 0;
                const sizeScale = computeFireworksSizeScale(binValue01, rocket.launchBeatScale); // core
                const power = computeFireworksBurstPower(cfg.burstPower, beatScale) * sizeScale; // core
                const exploder = FIREWORKS_EXPLODERS[rocket.style] || FIREWORKS_EXPLODERS.chrysanthemum; // core
                const count = Math.max(8, Math.round(cfg.particleCount * rocket.depthScale * sizeScale));
                const burstSpecs = exploder(rocket.x, rocket.y, count, power, cfg.gravity, spectrumBin); // core — trả SPEC thuần (Rule 3)
                const burst = this._fwMaterializeSpecs(burstSpecs); // Workflow tự resolve màu + tạo particle thật
                const scaled = applyFireworksSizeScale(applyFireworksDepth(burst, rocket.depthScale), sizeScale); // core
                burstParticles = burstParticles.concat(scaled);
                flashTarget = Math.max(flashTarget, computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, beatScale, cfg.flashThreshold, cfg.flashMaxOpacity) * rocket.depthScale); // core — 3 field chớp DÙNG CHUNG với thunder + rain
            } else {
                remainingRockets.push(rocket);
            }
        });

        // Nhóm "lighting" — chớp nền trước, rocket/particle vẽ đè lên sau.
        this._fwFlashAlpha = Math.max(flashTarget, this._fwFlashAlpha * 0.85);
        drawScreenFlash(ctx, canvas.width, canvas.height, this._fwFlashAlpha); // core/visualizer/draw

        remainingRockets.forEach((rocket) => drawFireworksRocket(ctx, rocket, dpr)); // core
        appState.set('fwRockets', remainingRockets, { skipCheck: true });

        const survivors = [];
        fwParticles.concat(burstParticles).forEach((particle) => {
            const status = updateFireworksParticle(particle); // core
            if (status === 'split') {
                const splitSpecs = splitFireworksParticle(particle); // core — trả SPEC thuần (Rule 3)
                const splitParticles = this._fwMaterializeSpecs(splitSpecs); // Workflow tự resolve
                survivors.push(...applyFireworksDepth(splitParticles, particle.depthAlpha)); // core
            } else if (status === 'alive') survivors.push(particle);
        });
        survivors.forEach((particle) => drawFireworksParticle(ctx, particle, perf.blurMult, dpr)); // core
        appState.set('fwParticles', survivors, { skipCheck: true });
    },

    /** Tự bắn rocket theo nhạc — không nút bấm thủ công (BPM/mật độ nhạc quyết định nhịp). Dừng
     * hẳn khi đã chạm `maxConcurrentRockets` (mục 2, phản hồi Giang) — KHÔNG cập nhật
     * `_fwLastLaunchAt` lúc bị chặn, để bắn lại NGAY khung hình kế tiếp có chỗ trống, thay vì phải
     * chờ thêm nguyên 1 interval nữa. */
    _fwAutoLaunch(isPlaying, beatScale, smoothedEnergy, currentCalculatedBpm, cfg) {
        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const intervalMs = computeFireworksAutoLaunchIntervalMs(bpm, cfg.autoLaunchDensity, smoothedEnergy, isPlaying); // core
        const now = performance.now();
        if (now - _fwLastLaunchAt < intervalMs) return;
        if (appState.get('fwRockets').length >= cfg.maxConcurrentRockets) return;
        _fwLastLaunchAt = now;
        this._fwLaunchOne(cfg, beatScale);
    },

    /**
     * [MỚI — rà soát Rule 3] Vật chất hoá 1 mảng SPEC thuần (từ `explodeFireworksXXX()`/
     * `splitFireworksParticle()`/`explodeFireworksText()`, core/visualizer/groups/lighting/
     * fireworks.js) thành particle THẬT — nơi DUY NHẤT gọi `getComputedColor()` (core/audio-
     * analysis.js) + `createFireworksParticle()` (core/visualizer/groups/lighting/fireworks.js)
     * cho nhóm fireworks, đúng
     * tinh thần "core gọi core PHẢI chuyển ra Workflow" (Rule 3a/3c điều kiện 2). Mỗi spec đã tự
     * quyết định `fixedColor` (dùng nguyên) hay `colorArgs` (bộ 3 tham số gọi `getComputedColor`) —
     * hàm này không biết/không cần biết ý nghĩa nghiệp vụ của từng field, chỉ resolve rồi tạo.
     * @param {object[]} specs @returns {object[]} particle thật, cùng thứ tự với `specs`.
     */
    _fwMaterializeSpecs(specs) {
        return specs.map((spec) => {
            const color = spec.fixedColor !== undefined ? spec.fixedColor : getComputedColor(...spec.colorArgs).fill; // core
            const options = spec.targetColorArgs
                ? { ...spec.options, targetColor: getComputedColor(...spec.targetColorArgs).fill } // core
                : spec.options;
            return createFireworksParticle(spec.x, spec.y, color, options); // core
        });
    },

    /** Bắn 1 rocket — kiểu nổ random trong enabledStyles, `depthScale` random (0.4 xa..1.0 gần)
     * cho cảm giác lớp xa/gần; điểm bắn LỆCH ĐÁNG KỂ khỏi đích để quỹ đạo chéo thật sự thay vì gần
     * như thẳng đứng; rocket "xa" nổ cao/gọn hơn. Gán `binIndex` (rải qua dải bass/mid, mục 4) +
     * lưu `beatScale` NGAY LÚC BẮN (mục 1) — cả 2 dùng ở computeFireworksSizeScale() lúc nổ. */
    _fwLaunchOne(cfg, beatScale) {
        const enabledStyles = resolveEnabledFireworksStyles(cfg.enabledStyles); // core
        const style = pickRandomFireworksStyle(enabledStyles); // core
        const depthScale = 0.4 + Math.random() * 0.6;
        const yMin = canvas.height * 0.15;
        const yMax = canvas.height * (0.25 + depthScale * 0.3);
        const targetY = yMin + Math.random() * (yMax - yMin);
        const targetX = Math.random() * (canvas.width * 0.8) + canvas.width * 0.1;
        const rawStartX = targetX + (Math.random() - 0.5) * canvas.width * 0.35;
        const startX = Math.min(canvas.width * 0.95, Math.max(canvas.width * 0.05, rawStartX));
        const color = getComputedColor(0, 1, 0).fill; // core/audio-analysis.js
        const binRange = FIREWORKS_SIZE_BIN_MAX - FIREWORKS_SIZE_BIN_MIN;
        _fwNextBinIndex = FIREWORKS_SIZE_BIN_MIN + ((_fwNextBinIndex - FIREWORKS_SIZE_BIN_MIN + 7) % binRange);
        const rocket = createFireworksRocket(startX, canvas.height, targetX, targetY, style, color, depthScale, _fwNextBinIndex, beatScale || 0); // core
        appState.mutate('fwRockets', (arr) => arr.push(rocket), { skipCheck: true });
    },

    /** Tích luỹ flux/beat riêng cho Fireworks (mirror detectMusicTransition() của Vortex ở trên) —
     * chuyển đoạn/phrase nhạc -> tự bắn 1 chuỗi "Đại Tiệc Pháo Hoa" thay nút bấm thủ công cũ.
     * [XOÁ — 15/09/2026, yêu cầu Giang] Nhịp ép định kỳ (`cfg.finaleIntervalBeats`, isPhraseBoundary())
     * ĐÃ BỎ HẲN — Finale giờ CHỈ trigger theo detectMusicTransition(), `cfg.finaleEnabled` (MỚI,
     * toggle "Finale") tắt thì KHÔNG BAO GIỜ tự bắn nữa dù nhạc có chuyển đoạn. Cửa sổ ngắn
     * (energyWindowBeats) không còn field, hardcode 2. */
    _fwUpdateFinaleTrigger(isPlaying, beatScale, cfg) {
        const fluxHistory = appState.get('fluxHistory');
        if (fluxHistory.length > 0) {
            _fwPendingBeatFluxSum += fluxHistory[fluxHistory.length - 1];
            _fwPendingBeatFluxCount++;
        }
        const isNewBeat = lastBeatTime > 0 && lastBeatTime !== _fwLastConsumedBeatTime;
        if (!isNewBeat) return;
        _fwLastConsumedBeatTime = lastBeatTime;

        if (_fwPendingBeatFluxCount > 0) {
            _fwBeatFluxHistory.push(_fwPendingBeatFluxSum / _fwPendingBeatFluxCount);
            if (_fwBeatFluxHistory.length > 24) _fwBeatFluxHistory.shift();
        }
        _fwPendingBeatFluxSum = 0;
        _fwPendingBeatFluxCount = 0;
        if (!isPlaying || !cfg.finaleEnabled) return;

        const musicTransition = detectMusicTransition(_fwBeatFluxHistory, 2, cfg.sectionWindowBeats, cfg.fluxThreshold); // core (audio-analysis.js)
        if (musicTransition) {
            this._fwFireFinale(cfg, beatScale);
        }
    },

    /** Chuỗi rocket liên tiếp (dừng sớm nếu chạm `maxConcurrentRockets`, mục 2) + 1 chữ trong
     * customTexts (nếu có, round-robin). */
    _fwFireFinale(cfg, beatScale) {
        for (let i = 0; i < FIREWORKS_FINALE_ROCKET_COUNT; i++) {
            if (appState.get('fwRockets').length >= cfg.maxConcurrentRockets) break;
            this._fwLaunchOne(cfg, beatScale);
        }
        const picked = pickNextFireworksText(cfg.customTexts, _fwTextIndex); // core
        if (!picked) return;
        _fwTextIndex = picked.nextIndex;
        const points = buildFireworksTextPoints(picked.text); // core
        const textSpecs = explodeFireworksText(canvas.width / 2, canvas.height * 0.35, points, cfg.burstPower, 0); // core — trả SPEC thuần (Rule 3)
        const particles = this._fwMaterializeSpecs(textSpecs); // Workflow tự resolve màu + tạo particle thật
        appState.mutate('fwParticles', (arr) => { particles.forEach((p) => arr.push(p)); }, { skipCheck: true });
    },
};
