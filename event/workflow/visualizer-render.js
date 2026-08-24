/**
 * event/workflow/visualizer-render.js — MỚI (20/07/2026, plan-space-galaxy.md Phần A + Phần B).
 *
 * Workflow DUY NHẤT sở hữu vòng lặp render chính (thay `drawVisualizer()` cũ —
 * `core/visualizer/draw-visualizer.js`, nay đã RỖNG HẲN, vai trò dispatch dời hết vào đây) — tự
 * đăng ký task `taskManager` mode `raf` (MỚI, xem `service/task-manager.js`), tự
 * `appState.get([...])` mỗi tick, tự gọi các hàm Core cần thiết theo đúng thứ tự — ĐÚNG định
 * nghĩa vai trò Workflow (đọc state rồi quyết định gọi Core nào), KHÔNG qua `eventBus`/Router
 * (đây là 1 trường hợp Workflow tự "tick" bằng `taskManager`, KHÔNG phải luồng Listener→Router
 * thông thường — xem ghi chú bổ sung ở `readme/event-bus-flow.md`).
 *
 * Điểm khởi động DUY NHẤT: `core/audio-engine.js::setupAudioContext()` gọi
 * `workflowVisualizerRender.start()` (Core gọi Workflow — vi phạm kỹ thuật đã ĐÁNH DẤU RÕ là
 * ngoại lệ đã biết, xem comment tại đó + plan A2) — `taskManager.operator(name,'enabled')` tự
 * guard chống double-start nên an toàn tuyệt đối dù `setupAudioContext()` được gọi lại nhiều lần
 * (Next/Prev/chọn bài khác... — guard "chỉ chạy thật lần đầu" nằm ngay trong hàm đó).
 *
 * VISUAL CŨ (bar/lightning/rubik/vortex/black hole/rain) — gọi THẲNG, y nguyên tham số, y hệt
 * `drawVisualizer()` cũ đang làm — KHÔNG đụng logic bên trong các file `core/visualizer/types/*.js`
 * này (nợ kỹ thuật cũ nếu có không bắt sửa, đúng Rule 0.5).
 *
 * VISUAL MỚI (Galaxy, `type: 'space'`) — Workflow điều phối THẬT SỰ: tự gom state, tự gọi RIÊNG
 * LẺ từng hàm/method Core của `core/webgl/three-space.js` + `core/visualizer/types/space.js` —
 * không hàm Core nào trong engine Galaxy gọi hàm Core khác, Workflow đứng NGOÀI gọi CẢ tất cả
 * (plan B2). Xem `_tickSpace()` bên dưới.
 *
 * VIẾT LẠI LẦN 4 (21/07/2026, phản hồi Giang lượt 9 — "thay vì vừa chuyển vừa tạo. Ngay từ lúc
 * đầu tạo ra một map thiên hà sẵn có 3D trải đều các hướng và không gian khu vực... khỏi cần tính
 * việc sinh ra cụm và thiên hà tính hướng") — BỎ HẲN mô hình chuỗi thiên hà "vừa bay vừa
 * spawn/dispose theo cửa sổ phía trước camera" (`_manageSpaceChain()`, `_stageNextLeg()`,
 * `_advancePreSpawn()`, gate mật độ trước khi rotate — TẤT CẢ ĐÃ BỎ). Giờ:
 *   - Bản đồ thiên hà TĨNH, dựng SẴN 1 lần (toàn bộ N cụm, phân bố ĐỀU quanh 1 tâm, xem
 *     `generateGalaxyMapNodePositions()`, core/webgl/three-space.js) — `_ensureGalaxyMap()` tự
 *     quyết định lúc nào cần TÁI TẠO TOÀN BỘ (energy đủ cao VÀ camera đang ĐỨNG YÊN — tức đang ở
 *     điểm chuyển pha travel->rotate/bootstrap, KHÔNG BAO GIỜ tái tạo giữa lúc đang bay).
 *   - Chọn mục tiêu (`_computeTravelWaypoint()`) tìm trong bản đồ TĨNH này — CHẮC CHẮN luôn có kết
 *     quả hợp lệ (fallback: 1 cụm bất kỳ trong bản đồ nếu nón phía trước trống, rồi kẹp về đúng
 *     biên bản đồ nếu vượt quá — `mirrorPositionIfOutOfBounds()`), nên `_tryCommitRotatePhase()`
 *     giờ ĐỒNG BỘ HOÀN TOÀN, không cần chờ/khoá gì nữa.
 *   - Thời lượng pha ROTATE giờ còn phụ thuộc BPM/energy (mục "tốc độ xoay camera... phụ thuộc
 *     thông số nhạc"), không chỉ riêng góc lệch.
 *
 * VIẾT LẠI LẦN 3 (21/07/2026, phản hồi Giang lượt 6) — máy trạng thái `spPhase`: 'travel' (camera
 * di chuyển A->B theo quỹ đạo CONG — Quadratic Bezier — hướng nhìn `spForward` CỐ ĐỊNH, không đổi
 * dù chỉ 1 độ) | 'rotating' (vị trí camera KHOÁ NGUYÊN tại B, chỉ hướng nhìn nội suy dần X->Y,
 * thời lượng MỀM theo góc lệch — góc nhỏ xoay nhanh, góc lớn xoay chậm hơn, KHÔNG tuyến tính).
 * Chỉ 1 trong 2 trạng thái tại 1 thời điểm — KHÔNG BAO GIỜ vừa dịch chuyển vừa xoay cùng lúc.
 *
 * NẠP: SAU toàn bộ `core/visualizer/types/*.js`, `core/visualizer/draw/*.js`,
 * `core/webgl/three-vortex.js`, `core/webgl/three-space.js`, `core/audio-analysis.js`,
 * `core/visualizer/visualizer-display.js` (cần mọi hàm Core mà `_tick()`/`_tickSpace()` gọi tới
 * đã được định nghĩa) — xem vị trí thẻ `<script>` trong index.html (đặt ngay vị trí cũ của
 * `draw-visualizer.js`, cuối khối 4-VISUALIZERS).
 */

const RENDER_TASK = 'visualizerRender';

// Tra cứu hàm vẽ 2D theo `vizConfig.type` — MỜI dời nguyên từ `draw-visualizer.js` cũ (đã RỖNG).
// `vortex`/`space` KHÔNG nằm trong bảng này: 2 visual đó render qua WebGL (canvas riêng), xử lý
// RIÊNG trong `_tick()` TRƯỚC khi canvas 2D được clear.
const VISUALIZER_DRAWERS = {
    'bar':        (ctx, perf) => drawBar(ctx, perf),
    'lightning':  (ctx, perf, isPlaying) => drawLightning(ctx, perf, isPlaying),
    'rubik':      (ctx, perf, isPlaying) => drawRubik(ctx, isPlaying),
    'black hole': (ctx, perf, isPlaying) => drawBlackHole(ctx, perf, isPlaying),
    'rain':       (ctx, perf, isPlaying) => drawRain(ctx, isPlaying)
};

// ===== Hằng số mô hình pha TRAVEL/ROTATE =====
// Khoảng cách FALLBACK MÙ tuyệt đối — CHỈ dùng khi bản đồ thiên hà HOÀN TOÀN RỖNG (không thể xảy
// ra thật sự sau `_ensureGalaxyMap()`, giữ lại phòng hờ tuyệt đối).
const SPACE_LEG_DISTANCE = 550;
// Tốc độ (đơn vị/giây) tại 120bpm, năng lượng trung bình — nhân với (bpm/120), hệ số năng lượng
// TẠI THỜI ĐIỂM lấy mẫu (xem mốc lấy mẫu BPM dưới), và SPACE_SPEED_MULTIPLIER.
const SPACE_LEG_SPEED_BASE = 46;
// +-30% ngẫu nhiên tốc độ CẢ leg (1 lần lúc bắt đầu, không đổi giữa chừng).
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu.
const SPACE_IDLE_LEG_SPEED = 8;
// "Bổ sung thêm x2 cho tốc độ" (phản hồi Giang lượt 6).
const SPACE_SPEED_MULTIPLIER = 2;
// Số mốc % quãng đường lấy mẫu BPM NGẪU NHIÊN mỗi leg (LUÔN cộng thêm mốc 0 — lấy mẫu ngay lúc bắt
// đầu leg), xem _startTravelPhase()/_advanceSpaceTravel().
const SPACE_SPEED_SAMPLE_MIN = 1;
const SPACE_SPEED_SAMPLE_MAX = 3;

// ===== "Bẻ lái" hướng bay theo nốt — ĐỦ 3 CHIỀU (yaw+pitch), xem steerSpaceForward3D()
// (core/webgl/three-space.js). Áp dụng CHO CẢ yaw lẫn pitch, KHÔNG giới hạn biên độ. =====
const SPACE_NOTE_STEER_RANGE = Math.PI; // [-π, π) — ĐỦ 360°

// Tốc độ tự quay CHUNG của thiên hà — hệ số NHÂN CHUNG nhẹ lên trên `rotationSpeed` RIÊNG của
// từng thiên hà — TÁCH HẲN khỏi tốc độ camera/BPM.
const SPACE_GALAXY_SPIN_SPEED = 0.8;

// ===== Chọn mục tiêu trong bản đồ TĨNH (findClusterTargetAhead(), core/visualizer/types/space.js)
// — KHÔNG ưu tiên khoảng xa (phản hồi Giang lượt 9 — "không cần ưu tiên khoảng xa"). =====
const SPACE_TARGET_CONE_ANGLE_DEG = 35;
const SPACE_TARGET_CONE_COS = Math.cos(SPACE_TARGET_CONE_ANGLE_DEG * Math.PI / 180);
// Tầm quét mục tiêu = tỉ lệ NÀY nhân `perf.galaxyMapRadius` (bán kính bản đồ hiện tại, co giãn
// theo `quality` — xem core/config.js) — KHÔNG dùng số tuyệt đối cố định, để tự động khớp đúng
// kích thước bản đồ dù đang ở mức hiệu năng nào.
const SPACE_TARGET_MAX_DIST_RATIO = 1.6;
// "Bay xuyên qua" thay vì dừng đúng tâm cụm — cộng thêm 1 đoạn ngắn theo hướng bay.
const SPACE_FLYTHROUGH_OVERSHOOT = 60;

// Biên độ cong (Quadratic Bezier) = tỉ lệ này nhân tổng khoảng cách leg (mục 4, phản hồi Giang lượt
// 6 — "cung di chuyển uốn lượn cong... thay vì tuyến tính thẳng").
const SPACE_LEG_CURVE_STRENGTH_RATIO = 0.25;

// ===== Thời lượng pha ROTATE — power-law theo góc (mục "xoay hướng phải mềm"), NHÂN thêm hệ số
// nhạc (MỚI, lượt 9, phản hồi Giang — "tốc độ xoay camera... phụ thuộc vào thông số nhạc"). =====
const SPACE_ROTATE_MIN_DURATION = 3;  // giây, góc nhỏ
const SPACE_ROTATE_MAX_DURATION = 9;  // giây, góc 180°
const SPACE_ROTATE_DURATION_POWER = 0.6;
const SPACE_ROTATE_MUSIC_FACTOR_MIN = 0.5; // nhạc chậm/yên tĩnh nhất — xoay chậm hơn tối đa 2x
const SPACE_ROTATE_MUSIC_FACTOR_MAX = 2.2; // nhạc nhanh/năng lượng cao nhất — xoay nhanh hơn tối đa 2.2x

// Số bin quét quanh bin trung tâm (trung bình) lúc snapshot driftSpeedFactor mỗi thiên hà, xem
// _spawnGalaxyNodeMembers().
const SPACE_DRIFT_BIN_SPREAD = 3;

// ===== Tái tạo TOÀN BỘ bản đồ (MỚI, lượt 9, phản hồi Giang mục 4 — "dựa vào energy + camera không
// phải đang moving để quyết định tái tạo lại mảng array + các thiên hà") — CHỈ kiểm tra tại đúng 1
// thời điểm camera THẬT SỰ đứng yên (bootstrap hoặc vừa xong pha ROTATE, xem
// _startTravelPhase()/_ensureGalaxyMap()), KHÔNG BAO GIỜ giữa lúc đang travel. =====
const SPACE_MAP_REGEN_ENERGY_THRESHOLD = 0.6;
const SPACE_MAP_REGEN_MIN_INTERVAL = 20; // giây — chống tái tạo dồn dập kể cả khi energy giữ cao liên tục (tốn hiệu năng)

// Biến NỘI BỘ (KHÔNG thuộc STATE, cùng kiểu với `tWarpSpeed` ở core/webgl/three-vortex.js) —
// đồng hồ delta-time riêng cho Galaxy (6 visual cũ không cần delta, giữ nguyên hành vi cũ).
let _spLastFrameTime = null;
let _spGlobalTime = 0;

const workflowVisualizerRender = {
    /** Đăng ký + bật task `raf` — xem docstring đầu file về điểm gọi DUY NHẤT + guard chống
     * double-start. */
    start() {
        taskManager.addNew(RENDER_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator(RENDER_TASK, 'enabled');
    },

    /** Không có nơi nào gọi hiện tại (vòng lặp render sống suốt đời app, giống hành vi
     * `requestAnimationFrame(drawVisualizer)` cũ) — cung cấp để đối xứng API + phòng cần tới sau này. */
    stop() {
        taskManager.kill(RENDER_TASK);
    },

    /** Tick chính — 1 lần mỗi khung hình. Thay thế `drawVisualizer()` cũ. */
    _tick() {
        const cfg = appConfigViz.getAll();
        const { vizDataArray, analyser, frameCounter, beatScale, smoothedEnergy, globalHueOffset } = appState.get([
            'vizDataArray', 'analyser', 'frameCounter', 'beatScale', 'smoothedEnergy', 'globalHueOffset'
        ]);

        // SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video, "visualizer hiển thị
        // trạng thái idle/tĩnh" lúc đang phát 1 ảnh) — thêm `isPhotoPlayerMode` vào điều kiện ẩn
        // canvas — ảnh hiện qua `#visual-bg-image` (z-index -2, DƯỚI canvas #webgl-canvas(1)/
        // #visualizer(10) — xem assets/css/base.css, tái dùng element VBG, event/workflow/visual-
        // bg.js::applyVisualBgImageToDOM()), phải ẩn canvas mới lộ ra được, CÙNG cơ chế
        // `updateCanvasVisibility()` (core) đã dùng cho cfg.visualEnabled===false — KHÔNG cần hàm
        // core mới, chỉ thêm điều kiện vào biến đã có. Không tự return sớm ở đây (Game Mode vẫn
        // cần workflowGameplay.tick() chạy dù canvas ẩn, xem comment "layer game là DOM riêng" ngay
        // dưới) — audioPlayer đã pause() lúc vào Photo mode (event/workflow/photo-player.js) nên
        // `isPlaying` ở dòng dưới tự = false, giữ mọi tính toán energy/beatScale tự decay về idle,
        // KHÔNG cần sửa gì thêm trong phần vẽ.
        const isVisualOff = cfg.visualEnabled === false || appState.get('isPhotoPlayerMode');
        updateCanvasVisibility(canvas, document.getElementById('webgl-canvas'), isVisualOff); // core

        // Blur/glow giờ CẤU HÌNH RIÊNG từng effect (customEffect[type].blurEnabled/blurIntensity,
        // xem core/custom-effect.js) — perf chỉ còn mang đúng field `blurMult` mà 5 file vẽ (bar/
        // black-hole/lightning/rain/rubik.js) đang đọc qua `perf.blurMult`.
        const perf = { blurMult: getActiveBlurMult() }; // core/audio-analysis.js
        if (!vizDataArray) return; // guard — audio context chưa init (giống hệt hành vi cũ)

        analyser.getByteFrequencyData(vizDataArray);
        const bufferLength = analyser.frequencyBinCount;
        // SỬA (21/07/2026, cùng lý do core/audio-analysis.js::updateStatsDashboard()) — đọc
        // bgVideoElement khi đang ở Video Player mode, audioPlayer không còn liên quan gì tới video.
        const isPlaying = appState.get('isVideoPlayerMode') ? !bgVideoElement.paused : !audioPlayer.paused;

        const bassCount = Math.floor(bufferLength * 0.1);
        const newBeatScale = computeBeatScale(vizDataArray, bassCount); // core
        appState.set('beatScale', newBeatScale, { skipCheck: true });

        const newSmoothedEnergy = computeSmoothedEnergy(newBeatScale, smoothedEnergy); // core
        appState.set('smoothedEnergy', newSmoothedEnergy, { skipCheck: true });

        const newGlobalHueOffset = computeNextGlobalHueOffset(globalHueOffset, newBeatScale, isPlaying); // core
        appState.set('globalHueOffset', newGlobalHueOffset, { skipCheck: true });

        updateStatsDashboard(bufferLength); // core hiện có (di sản trước 04/07/2026 — Rule 0.5, KHÔNG đụng logic bên trong)

        // MỚI (16/08/2026, Game Mode Circle v1) — dùng CHUNG vòng lặp render này (KHÔNG mở RAF loop
        // riêng cho gameplay, xem docstring đầu event/workflow/gameplay.js). Workflow-gọi-Workflow
        // (KHÔNG phải Core-gọi-Core — Rule 3 không áp dụng ở đây). Đặt TRƯỚC "if (isVisualOff)
        // return;" bên dưới CÓ CHỦ Ý — layer game là DOM riêng (#gameplay-layer), không phụ thuộc
        // canvas #visualizer, phải tiếp tục chạy dù người dùng tắt Visual.
        workflowGameplay.tick(performance.now());

        // "Nốt nhạc bay lên" — luôn bật (bỏ gate theo chế độ hiệu năng đã xoá), tách khỏi
        // isVisualOff bên dưới: phần tử DOM phụ trên #record-container, không phụ thuộc canvas.
        if (isPlaying && newSmoothedEnergy > 0.3 && Math.random() > 0.6) spawnFlyingNote(); // core hiện có

        // Mọi phần dưới đây CHỈ liên quan tới việc VẼ ra canvas — bỏ qua khi visual đang tắt.
        if (isVisualOff) return;

        // ================== VISUAL CŨ — gọi THẲNG, y nguyên tham số (KHÔNG đụng, plan A2) ==================
        if (cfg.type === 'vortex') {
            drawVortex(perf, isPlaying);
        } else if (cfg.type === 'space') {
            // ================== VISUAL MỚI (Galaxy) — Workflow điều phối THẬT SỰ (plan B2) ==================
            this._tickSpace(isPlaying, newSmoothedEnergy, newGlobalHueOffset);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawFn = VISUALIZER_DRAWERS[cfg.type];
        if (drawFn) drawFn(ctx, perf, isPlaying, newBeatScale);
    },

    /**
     * Điều phối 1 frame của visual Galaxy — máy trạng thái TRAVEL/ROTATE (xem docstring đầu file).
     * VIẾT LẠI LẦN 4 (lượt 9) — KHÔNG còn quản lý chuỗi/pre-spawn theo cửa sổ nữa (bản đồ TĨNH,
     * xem `_ensureGalaxyMap()` được gọi TỪ BÊN TRONG `_startTravelPhase()` — đúng thời điểm camera
     * đứng yên). Thứ tự mỗi tick: bootstrap -> tiến hành đúng pha hiện tại (travel HOẶC rotate,
     * KHÔNG BAO GIỜ cả 2 cùng lúc) -> cập nhật từng thiên hà -> bụi nền -> render.
     */
    _tickSpace(isPlaying, smoothedEnergy, globalHueOffset) {
        if (!appState.get('spInitialized')) return; // guard, giống hệt drawVortex()

        const spCamera = appState.get('spCamera');
        const tRenderer = appState.get('tRenderer');
        const spDustMesh = appState.get('spDustMesh');
        const currentCalculatedBpm = appState.get('currentCalculatedBpm');
        const beatScale = appState.get('beatScale');

        // ----- đồng hồ riêng của Galaxy (delta giây + tích luỹ globalTime cho shader uTime) -----
        const now = performance.now();
        const delta = _spLastFrameTime === null ? 0.016 : Math.min((now - _spLastFrameTime) / 1000, 0.1);
        _spLastFrameTime = now;
        _spGlobalTime += delta;

        // ----- 0. bootstrap — chưa có leg nào (lần đầu vào 'space') -----
        if (!appState.get('spNextPos')) {
            this._beginFirstSpaceLeg(spCamera.position, smoothedEnergy);
        }

        // ----- 1. tiến ĐÚNG 1 trong 2 pha (không bao giờ chạy cả 2 cùng lúc) -----
        if (appState.get('spPhase') === 'rotating') {
            this._advanceSpaceRotate(spCamera, delta, smoothedEnergy);
        } else {
            this._advanceSpaceTravel(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy);
        }

        // ----- 2. cập nhật từng thiên hà (đọc LẠI sau bước 1 — có thể vừa được THAY TOÀN BỘ bởi
        // `_ensureGalaxyMap()` gọi từ bên trong travel/rotate transition) -----
        const spGalaxyClusters = appState.get('spGalaxyClusters');
        const spaceCfg = getEffectConfig('space'); // core/custom-effect.js
        const hueShift = (spaceCfg.mode === 'dynamic' || spaceCfg.mode === 'gradient') ? globalHueOffset : 0;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, SPACE_GALAXY_SPIN_SPEED, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 3. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 4. render -----
        renderSpaceScene(tRenderer, appState.get('spScene'), spCamera); // core
    },

    /**
     * Tra bảng `spNoteSteerTable` theo nốt HIỆN TẠI, giống hệt cách Rubik tra `RUBIK_NOTE_TO_TURN`
     * (core/dom-refs.js) — trả về CẶP GÓC BẺ LÁI {yaw, pitch} (radian).
     * @returns {{yaw: number, pitch: number}} {0,0} nếu chưa detect được nốt nào hoặc bảng chưa sẵn sàng.
     */
    _pickNoteSteerAngles() {
        const midiNote = appState.get('lastValidMidiNote');
        const table = appState.get('spNoteSteerTable');
        if (!midiNote || !table) return { yaw: 0, pitch: 0 };
        const noteIdx = ((midiNote % 12) + 12) % 12;
        return table[noteIdx];
    },

    /** Tra "túi xáo trộn" hình thái thiên hà — MỌI lần spawn 1 thiên hà đều PHẢI qua đây, KHÔNG
     * gọi thẳng `pickGalaxyTypeFromBag()` riêng lẻ ở 2 nơi (tránh 2 túi độc lập không đồng bộ).
     * @returns {string} */
    _pickNextGalaxyType() {
        const bag = appState.get('spGalaxyTypeBag');
        const result = pickGalaxyTypeFromBag(bag); // core
        appState.set('spGalaxyTypeBag', result.remainingBag);
        return result.type;
    },

    /** Sinh toàn bộ thành viên của 1 "nút" bản đồ — dùng CHUNG cho toàn bộ `_ensureGalaxyMap()`.
     * @param {object} spaceCfg - getEffectConfig('space'), core/custom-effect.js */
    _spawnGalaxyNodeMembers(clusterCore, spaceCfg, spScene, spGlowTexture, spNebulaTexture) {
        let totalSpawned = appState.get('spTotalGalaxiesSpawned');
        const vizDataArray = appState.get('vizDataArray');
        const memberCount = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < memberCount; k++) {
            const offset = computeGalaxyMemberOffset(); // core
            const finalPos = clusterCore.clone().add(offset);
            const type = this._pickNextGalaxyType();
            const palette = pickGalaxyPalette(spaceCfg.mode, spaceCfg.solidColor, spaceCfg.dynA, spaceCfg.dynB); // core — MỌI hình thái đều theo màu riêng effect Space
            const radius = 65 + Math.random() * 25;
            // Snapshot lúc SPAWN (one-shot) — mật độ sao bám theo smoothedEnergy TẠI THỜI ĐIỂM
            // sinh (KHÔNG đổi lại sau đó, "baked" vào chính thiên hà này).
            const smoothedEnergyAtSpawn = appState.get('smoothedEnergy');
            const densityRatio = THREE.MathUtils.clamp(0.3 + smoothedEnergyAtSpawn * 0.7, 0, 1);
            const starsCount = Math.round(spaceCfg.starCountMin + (spaceCfg.starCountMax - spaceCfg.starCountMin) * densityRatio);
            const rotationDir = Math.random() < 0.5 ? 1.0 : -1.0;
            const rotationSpeed = 0.05 + Math.random() * 0.55; // biên độ rộng — mỗi thiên hà quay 1 tốc độ khác biệt rõ
            const rotation = new THREE.Euler(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
            const name = generateRandomGalaxyName(); // core

            // Snapshot 1 dải bin `vizDataArray` NGAY LÚC SPAWN, mỗi thiên hà "bốc" 1 vùng phổ khác
            // nhau theo thứ tự spawn (tham khảo cách Vortex đọc vizDataArray[idx % bufferLength]).
            const binIndex = (vizDataArray && vizDataArray.length > 0) ? (totalSpawned * 7) % vizDataArray.length : -1;
            const driftSpeedFactor = binIndex >= 0 ? computeGalaxyDriftSpeedFactor(vizDataArray, binIndex, SPACE_DRIFT_BIN_SPREAD) : 1; // core

            const cluster = new GalaxyCluster(finalPos, totalSpawned, name, type, radius, starsCount, rotationDir, rotationSpeed, rotation, driftSpeedFactor);
            totalSpawned++;

            const genFn = GALAXY_GENERATORS[type]; // bảng dữ liệu (three-space.js) — Workflow tự tra + tự gọi
            const positions = new Float32Array(starsCount * 3);
            const colors = new Float32Array(starsCount * 3);
            const sizes = new Float32Array(starsCount);
            const geomConfig = buildGalaxyGeometryConfig(radius); // core
            const colorIn = new THREE.Color(palette.in);
            const colorOut = new THREE.Color(palette.out);
            for (let i = 0; i < starsCount; i++) genFn(positions, colors, sizes, i, geomConfig, colorIn, colorOut);

            cluster.build(positions, colors, sizes, spGlowTexture, spScene); // core method
            cluster.buildNebula(colorOut, spNebulaTexture, spaceCfg.nebulaCount); // core method

            appState.mutate('spGalaxyClusters', arr => arr.push(cluster));
        }
        appState.set('spTotalGalaxiesSpawned', totalSpawned);
    },

    /**
     * Đảm bảo bản đồ thiên hà TĨNH đã tồn tại + còn PHÙ HỢP — MỚI (21/07/2026, lượt 9, phản hồi
     * Giang mục 1+4). Lần ĐẦU TIÊN (bản đồ rỗng) LUÔN dựng — các lần sau CHỈ tái tạo TOÀN BỘ khi
     * `smoothedEnergy` đủ cao VÀ đã đủ thời gian nghỉ (`SPACE_MAP_REGEN_MIN_INTERVAL`, tránh tái
     * tạo dồn dập tốn hiệu năng dù nhạc năng lượng cao kéo dài). CHỈ được gọi từ
     * `_startTravelPhase()` — đúng thời điểm camera THẬT SỰ đứng yên (vừa bootstrap hoặc vừa xong
     * pha ROTATE), KHÔNG BAO GIỜ giữa lúc đang travel — đúng yêu cầu "dựa vào... camera không phải
     * đang moving để quyết định tái tạo".
     * @param {THREE.Vector3} centerPos - tâm bản đồ MỚI (vị trí camera hiện tại)
     * @param {number} smoothedEnergy
     */
    _ensureGalaxyMap(centerPos, smoothedEnergy) {
        const clusters = appState.get('spGalaxyClusters');
        const isFirstTime = clusters.length === 0;
        if (!isFirstTime) {
            const lastRegen = appState.get('spMapLastRegenTime');
            const cooldownPassed = (_spGlobalTime - lastRegen) >= SPACE_MAP_REGEN_MIN_INTERVAL;
            const energyHighEnough = smoothedEnergy >= SPACE_MAP_REGEN_ENERGY_THRESHOLD;
            if (!cooldownPassed || !energyHighEnough) return;
        }

        const spScene = appState.get('spScene');
        clusters.forEach(c => c.dispose(spScene)); // core method — dọn sạch bản đồ CŨ trước khi dựng bản đồ MỚI
        appState.set('spGalaxyClusters', []);

        const spaceCfg = getEffectConfig('space'); // core/custom-effect.js
        const spGlowTexture = appState.get('spGlowTexture');
        const spNebulaTexture = appState.get('spNebulaTexture');

        const nodePositions = generateGalaxyMapNodePositions(centerPos, spaceCfg.mapNodeCount, spaceCfg.mapRadius); // core
        nodePositions.forEach(nodeCore => {
            this._spawnGalaxyNodeMembers(nodeCore, spaceCfg, spScene, spGlowTexture, spNebulaTexture);
        });

        appState.set('spMapCenter', centerPos.clone());
        appState.set('spMapLastRegenTime', _spGlobalTime);
    },

    /**
     * Hướng ứng viên KẾ TIẾP — CHỈ tính HƯỚNG (khác hẳn `_computeTravelWaypoint()`, không kèm vị
     * trí): xoay `forward` HIỆN TẠI theo nốt (bảng `spNoteSteerTable`, đủ yaw+pitch 3D — xem
     * `steerSpaceForward3D()`, core/webgl/three-space.js).
     */
    _computeSteeredCandidateForward(currentForward) {
        const basis = computeSpaceForwardBasis(currentForward); // core
        const { yaw, pitch } = this._pickNoteSteerAngles();
        return steerSpaceForward3D(currentForward, basis.up, yaw, pitch); // core
    },

    /**
     * Waypoint (điểm B) cho pha TRAVEL — tìm trong bản đồ TĨNH (`findClusterTargetAhead()`, core
     * — nón phía trước theo `forward`, khoảng cách 3D THẬT, KHÔNG ưu tiên xa). VIẾT LẠI (lượt 9)
     * — CHẮC CHẮN LUÔN trả về 1 toạ độ THẬT hợp lệ (đã có bản đồ TĨNH đủ dày nhờ
     * `_ensureGalaxyMap()` gọi TRƯỚC hàm này): không có cụm nào trong nón (hiếm — vd vừa xoay sang
     * góc hẹp) → lấy ĐẠI 1 cụm bất kỳ trong TOÀN BỘ bản đồ; bản đồ trống hoàn toàn (không thể xảy
     * ra) → công thức mù tuyệt đối. Cộng thêm chút "overshoot" để bay XUYÊN QUA, rồi KẸP về đúng
     * biên bản đồ nếu vượt quá (`mirrorPositionIfOutOfBounds()`, mục "biên bản đồ").
     */
    _computeTravelWaypoint(originPos, forward) {
        const spGalaxyClusters = appState.get('spGalaxyClusters');
        const mapCenter = appState.get('spMapCenter');
        const mapRadius = getEffectConfig('space').mapRadius; // core/custom-effect.js
        const maxDist = mapRadius * SPACE_TARGET_MAX_DIST_RATIO;

        let targetPos = findClusterTargetAhead(spGalaxyClusters, originPos, forward, SPACE_TARGET_CONE_COS, maxDist); // core
        if (!targetPos && spGalaxyClusters.length > 0) {
            targetPos = spGalaxyClusters[Math.floor(Math.random() * spGalaxyClusters.length)].position.clone();
        }
        if (!targetPos) return originPos.clone().addScaledVector(forward, SPACE_LEG_DISTANCE); // phòng hờ tuyệt đối

        targetPos.addScaledVector(forward, SPACE_FLYTHROUGH_OVERSHOOT);
        return mirrorPositionIfOutOfBounds(targetPos, mapCenter, mapRadius); // core
    },

    /**
     * Bắt đầu pha TRAVEL MỚI — ĐẦU TIÊN đảm bảo bản đồ còn hợp lệ/còn mới (`_ensureGalaxyMap()`,
     * đúng lúc camera đứng yên), rồi tính waypoint B, sinh control point cong, reset đồng hồ quãng
     * đường + mốc lấy mẫu tốc độ theo BPM. Gọi lúc bootstrap LẪN mỗi khi pha ROTATE vừa hoàn tất.
     */
    _startTravelPhase(fromPos, forward, smoothedEnergy) {
        this._ensureGalaxyMap(fromPos, smoothedEnergy);

        const nextPos = this._computeTravelWaypoint(fromPos, forward);
        const basis = computeSpaceForwardBasis(forward); // core
        const totalDistance = fromPos.distanceTo(nextPos);
        const controlPoint = computeSpaceLegControlPoint(fromPos, nextPos, basis.right, basis.up, totalDistance * SPACE_LEG_CURVE_STRENGTH_RATIO); // core

        appState.set('spPhase', 'travel');
        appState.set('spForward', forward);
        appState.set('spLegStartPos', fromPos.clone());
        appState.set('spNextPos', nextPos);
        appState.set('spLegControlPoint', controlPoint);
        appState.set('spLegDistanceCovered', 0);
        appState.set('spLegTotalDistance', totalDistance);
        appState.set('spLegSpeedRandomFactor', 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE);

        // Mốc lấy mẫu BPM ngẫu nhiên (mục speed) — LUÔN có mốc 0 (lấy mẫu ngay lúc bắt đầu).
        const sampleCount = SPACE_SPEED_SAMPLE_MIN + Math.floor(Math.random() * (SPACE_SPEED_SAMPLE_MAX - SPACE_SPEED_SAMPLE_MIN + 1));
        const points = [0];
        for (let i = 0; i < sampleCount; i++) points.push(Math.random());
        points.sort((a, b) => a - b);
        appState.set('spSpeedSamplePoints', points);
        appState.set('spSpeedSampleIdx', 0);
        appState.set('spCurrentLegSpeed', -1); // sentinel "chưa lấy mẫu lần nào" (tốc độ thật LUÔN >= 0)
    },

    /**
     * Sinh leg ĐẦU TIÊN lúc vừa vào 'space' — hướng khởi điểm mặc định (0,0,-1). Bản đồ chưa tồn
     * tại lúc này nên `_startTravelPhase()` -> `_ensureGalaxyMap()` LUÔN dựng bản đồ MỚI ngay lập
     * tức (nhánh `isFirstTime`).
     */
    _beginFirstSpaceLeg(camPos, smoothedEnergy) {
        const initialForward = new THREE.Vector3(0, 0, -1);
        appState.set('spForward', initialForward);
        this._startTravelPhase(camPos, initialForward, smoothedEnergy);
    },

    /**
     * Tiến 1 bước dọc pha TRAVEL — hướng nhìn `spForward` CỐ ĐỊNH suốt pha này. Tốc độ KHOÁ theo
     * mốc lấy mẫu BPM ngẫu nhiên, nhân `SPACE_SPEED_MULTIPLIER`. Vị trí nội suy CONG (Quadratic
     * Bezier). Đến nơi (progress>=1): snap vị trí, chuyển NGAY sang pha ROTATE
     * (`_tryCommitRotatePhase()` — ĐỒNG BỘ hoàn toàn từ lượt 9, không còn chờ/khoá gì nữa).
     */
    _advanceSpaceTravel(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy) {
        const samplePoints = appState.get('spSpeedSamplePoints');
        let sampleIdx = appState.get('spSpeedSampleIdx');
        let currentSpeed = appState.get('spCurrentLegSpeed');
        const totalDistance = appState.get('spLegTotalDistance');
        const distanceCoveredPrev = appState.get('spLegDistanceCovered');
        const progressPrev = totalDistance > 0 ? distanceCoveredPrev / totalDistance : 1;

        const needsResample = currentSpeed < 0 || (sampleIdx + 1 < samplePoints.length && progressPrev >= samplePoints[sampleIdx + 1]);
        if (needsResample) {
            if (currentSpeed >= 0 && sampleIdx + 1 < samplePoints.length) sampleIdx++;
            const bpm = parseInt(currentCalculatedBpm, 10) || 120;
            const randomFactor = appState.get('spLegSpeedRandomFactor');
            currentSpeed = (isPlaying
                ? SPACE_LEG_SPEED_BASE * (bpm / 120) * (0.7 + smoothedEnergy * 0.6)
                : SPACE_IDLE_LEG_SPEED) * randomFactor * SPACE_SPEED_MULTIPLIER;
            appState.set('spSpeedSampleIdx', sampleIdx);
            appState.set('spCurrentLegSpeed', currentSpeed);
        }

        const distanceCovered = distanceCoveredPrev + currentSpeed * delta;
        const progress = totalDistance > 0 ? distanceCovered / totalDistance : 1;

        const legStartPos = appState.get('spLegStartPos');
        const nextPos = appState.get('spNextPos');
        const controlPoint = appState.get('spLegControlPoint');
        const finalPos = computeSpaceLegPosition(legStartPos, controlPoint, nextPos, progress); // core
        spCamera.position.copy(finalPos);

        const forward = appState.get('spForward');
        const orientBasis = computeSpaceForwardBasis(forward); // core
        applyStableSpaceOrientation(spCamera, forward, orientBasis.right, orientBasis.up); // core

        if (progress >= 1) {
            spCamera.position.copy(nextPos); // snap chính xác vị trí
            appState.set('spLegDistanceCovered', totalDistance, { skipCheck: true });
            this._tryCommitRotatePhase(spCamera.position, isPlaying, smoothedEnergy, currentCalculatedBpm);
        } else {
            appState.set('spLegDistanceCovered', distanceCovered, { skipCheck: true });
        }
    },

    /**
     * Đến waypoint B — chuyển sang pha ROTATE. VIẾT LẠI (21/07/2026, lượt 9) — ĐỒNG BỘ HOÀN TOÀN,
     * KHÔNG còn "chờ đủ mật độ" nào nữa (bản đồ TĨNH đã dựng sẵn ĐỦ mọi hướng từ trước, xem
     * `_ensureGalaxyMap()`) — chọn hướng ứng viên (note table) rồi cam kết NGAY. Thời lượng ROTATE
     * = power-law theo góc lệch, NHÂN thêm hệ số nhạc (mục "tốc độ xoay camera... phụ thuộc thông
     * số nhạc") — BPM cao/energy cao xoay NHANH hơn, ngược lại xoay CHẬM hơn.
     */
    _tryCommitRotatePhase(camPos, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const fromForward = appState.get('spForward');
        const candidateForward = this._computeSteeredCandidateForward(fromForward);
        const angleDeg = computeAngleBetweenForwards(fromForward, candidateForward); // core

        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const musicSpeedFactor = isPlaying
            ? THREE.MathUtils.clamp((bpm / 120) * (0.7 + smoothedEnergy * 0.6), SPACE_ROTATE_MUSIC_FACTOR_MIN, SPACE_ROTATE_MUSIC_FACTOR_MAX)
            : 1;
        const duration = computeSpaceRotateDuration(angleDeg, SPACE_ROTATE_MIN_DURATION, SPACE_ROTATE_MAX_DURATION, SPACE_ROTATE_DURATION_POWER, musicSpeedFactor); // core

        appState.set('spPhase', 'rotating');
        appState.set('spRotateFromForward', fromForward);
        appState.set('spRotateToForward', candidateForward);
        appState.set('spRotateElapsed', 0);
        appState.set('spRotateDuration', duration);
    },

    /**
     * Tiến 1 bước dọc pha ROTATE — vị trí camera KHOÁ NGUYÊN (KHÔNG đụng `spCamera.position`),
     * chỉ hướng nhìn nội suy dần (quaternion slerp, đủ mọi góc kể cả 180° đối cực) theo thời lượng
     * đã tính lúc bắt đầu. Xoay xong: `spForward` = chính xác hướng đích, bắt đầu pha TRAVEL kế
     * tiếp (`_startTravelPhase()` — cũng là nơi DUY NHẤT kiểm tra tái tạo bản đồ, mục 4).
     */
    _advanceSpaceRotate(spCamera, delta, smoothedEnergy) {
        const elapsed = appState.get('spRotateElapsed') + delta;
        const duration = appState.get('spRotateDuration');
        const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
        const eased = progress * progress * (3 - 2 * progress); // smoothstep

        const fromForward = appState.get('spRotateFromForward');
        const toForward = appState.get('spRotateToForward');
        const currentForward = computeSpaceRotateForward(fromForward, toForward, eased); // core
        appState.set('spForward', currentForward, { skipCheck: true });

        const orientBasis = computeSpaceForwardBasis(currentForward); // core
        applyStableSpaceOrientation(spCamera, currentForward, orientBasis.right, orientBasis.up); // core

        if (progress >= 1) {
            appState.set('spRotateElapsed', duration, { skipCheck: true });
            this._startTravelPhase(spCamera.position.clone(), toForward.clone(), smoothedEnergy);
        } else {
            appState.set('spRotateElapsed', elapsed, { skipCheck: true });
        }
    },
};
