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
 * VIẾT LẠI LẦN 3 (21/07/2026, phản hồi Giang lượt 6) — thay hẳn mô hình "waypoint nối tiếp +
 * blend hướng nhìn ở đoạn cuối leg" của lượt 2 (VỐN CHỒNG "di chuyển" và "xoay hướng" vào cùng 1
 * lúc — đúng phản hồi Giang: "đi từ A đến B kết thúc và xoay từ X đến Y là hai pha khác nhau").
 * Giờ là máy trạng thái `spPhase`: 'travel' (camera di chuyển A->B theo quỹ đạo CONG — Quadratic
 * Bezier, mục 4 — hướng nhìn `spForward` CỐ ĐỊNH, không đổi dù chỉ 1 độ) | 'rotating' (vị trí
 * camera KHOÁ NGUYÊN tại B, chỉ hướng nhìn nội suy dần X->Y, thời lượng MỀM theo góc lệch — góc
 * nhỏ xoay nhanh, góc lớn xoay chậm hơn, KHÔNG tuyến tính). Chỉ 1 trong 2 trạng thái tại 1 thời
 * điểm — KHÔNG BAO GIỜ vừa dịch chuyển vừa xoay cùng lúc.
 *
 * Đúng mục 2 (Giang — "đã có hàm dự đoán hướng quay sẽ có bao nhiêu thiên hà... phải thêm xong
 * mới được phép quay"): pha ROTATE CHỈ bắt đầu khi hướng kế tiếp đã được XÁC NHẬN đủ mật độ thiên
 * hà (`spCandidateForward`, qua `_stageNextLeg()`/`_advancePreSpawn()`) — nếu đến B mà CHƯA đủ,
 * camera ĐỨNG CHỜ NGUYÊN tại B (bản trước có 1 nhánh "leg nối tiếp tạm KHÔNG qua kiểm tra mật độ"
 * để tránh đứng khựng, ĐÃ BỎ HẲN, đó chính là lỗi Giang chỉ ra).
 *
 * Đúng mục 3 (Giang — "tìm điểm nextPos tới cụm thiên hà kế cận và bay xuyên qua"): waypoint pha
 * TRAVEL giờ chọn NGẪU NHIÊN 1 cụm thiên hà, ƯU TIÊN cụm đủ XA, trong nón phía trước theo hướng
 * hiện tại (`findClusterTargetAhead()`, core/visualizer/types/space.js — VIẾT LẠI lượt 7, phản hồi
 * Giang mục 1 — "chọn nhất" khiến chặng bay quá NGẮN, camera chỉ nhảy sang cụm sát vách thay vì
 * bay hẳn 1 hành trình rõ rệt), rơi về công thức mù cũ chỉ khi không có cụm nào trong tầm.
 *
 * Đúng mục speed (Giang — "tính X lần trong phạm vi di chuyển, dùng bpm tại thời điểm đó làm
 * base, x2 tốc độ"): mỗi leg travel tự sinh vài mốc % quãng đường ngẫu nhiên, mỗi lần vượt qua 1
 * mốc mới lấy lại BPM+energy làm tốc độ (giữ nguyên tới mốc kế), nhân thêm `SPACE_SPEED_MULTIPLIER`.
 *
 * Hướng bay MỖI lần cần đổi hướng được "bẻ lái" ĐỦ 3 CHIỀU (yaw+pitch, xem
 * `steerSpaceForward3D()`, core/webgl/three-space.js — trước chỉ có yaw, tức chỉ trái/phải).
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
    'rubik':      (ctx, perf, isPlaying) => drawRubik(ctx, perf, isPlaying),
    'black hole': (ctx, perf, isPlaying) => drawBlackHole(ctx, perf, isPlaying),
    'rain':       (ctx, perf, isPlaying) => drawRain(ctx, perf, isPlaying)
};

// ===== Hằng số chuỗi thiên hà Galaxy (Phần B, plan B6) =====
// `SPACE_AHEAD_WINDOW` CỐ ĐỊNH 1500 ở MỌI mức quality (đã CHỐT — hạ hiệu năng máy yếu chỉ qua
// giảm số hạt/cụm ở PERFORMANCE_PROFILES, KHÔNG đụng tầm nhìn xa).
const SPACE_AHEAD_WINDOW = 1500;
const SPACE_CHAIN_DISPOSE_DISTANCE = 300;
// Dispose thêm theo khoảng cách NGANG khỏi trục bay hiện tại (xem manageGalaxyChain(),
// core/visualizer/types/space.js) — dọn thiên hà "lạc hướng" sau khi camera quay đổi hướng nhiều.
// TĂNG (21/07/2026, lượt 7, đi cùng SPACE_LATERAL_SPREAD_RATIO_* — nút sinh ở xa giờ tán RỘNG hơn
// hẳn theo hình nón, 900 cũ sẽ dispose NHẦM những nút vừa sinh hợp lệ ở rìa xa).
const SPACE_CHAIN_DISPOSE_LATERAL_DISTANCE = 1300;
const SPACE_CHAIN_AHEAD_MARGIN = 20;

// ===== Hằng số mô hình pha TRAVEL/ROTATE =====
// Khoảng cách FALLBACK MÙ khi không có cụm thiên hà nào trong nón phía trước lúc tính waypoint
// (xem _computeTravelWaypoint()) — bình thường waypoint nhắm thẳng cụm gần nhất, KHÔNG dùng số này.
// TĂNG (21/07/2026, lượt 7 — đồng bộ với SPACE_TARGET_MIN_DIST, tránh fallback ra chặng NGẮN hơn
// cả trường hợp có cụm thật).
const SPACE_LEG_DISTANCE = 550;
// Tốc độ (đơn vị/giây) tại 120bpm, năng lượng trung bình — nhân với (bpm/120), hệ số năng lượng
// TẠI THỜI ĐIỂM lấy mẫu (xem mốc lấy mẫu BPM dưới), và SPACE_SPEED_MULTIPLIER.
const SPACE_LEG_SPEED_BASE = 46;
// +-30% ngẫu nhiên tốc độ CẢ leg (1 lần lúc bắt đầu, không đổi giữa chừng).
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// % progress bắt đầu THỬ tính + kiểm tra mật độ hướng ứng viên KẾ TIẾP (chạy NGẦM trong lúc vẫn
// đang travel — chuẩn bị trước cho pha ROTATE sắp tới, KHÔNG đổi hướng nhìn hiện tại).
const SPACE_LEG_PENDING_GEN_PROGRESS = 0.35;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu.
const SPACE_IDLE_LEG_SPEED = 8;
// MỚI (21/07/2026, lượt 6, phản hồi Giang mục speed — "bổ sung thêm x2 cho tốc độ").
const SPACE_SPEED_MULTIPLIER = 2;
// MỚI (21/07/2026, lượt 6, phản hồi Giang mục speed — "tính X lần trong phạm vi di chuyển sau đó
// dùng bpm tại thời điểm Xn đó làm base") — số mốc % quãng đường lấy mẫu BPM NGẪU NHIÊN mỗi leg
// (LUÔN cộng thêm mốc 0 — lấy mẫu ngay lúc bắt đầu leg), xem _startTravelPhase()/_advanceSpaceTravel().
const SPACE_SPEED_SAMPLE_MIN = 1;
const SPACE_SPEED_SAMPLE_MAX = 3;

// ===== "Bẻ lái" hướng bay theo nốt — ĐỦ 3 CHIỀU (yaw+pitch), xem steerSpaceForward3D()
// (core/webgl/three-space.js) — VIẾT LẠI (21/07/2026, lượt 6, phản hồi Giang — "camera chuyển
// hướng hiện tại chỉ có trái phải, cần thêm trên dưới, chéo góc... môi trường 3D là đa hướng").
// Áp dụng CHO CẢ yaw lẫn pitch, KHÔNG giới hạn biên độ (Giang xác nhận "cứ cho lộn"). =====
const SPACE_NOTE_STEER_RANGE = Math.PI; // [-π, π) — ĐỦ 360°

// Tốc độ tự quay CHUNG của thiên hà — hệ số NHÂN CHUNG nhẹ lên trên `rotationSpeed` RIÊNG của
// từng thiên hà — TÁCH HẲN khỏi tốc độ camera/BPM.
const SPACE_GALAXY_SPIN_SPEED = 0.8;

// ===== Pre-spawn có kiểm tra mật độ TRƯỚC khi cam kết hướng kế tiếp (fix "roll về hướng không có
// thiên hà nào, màn đen xì") — mục 2 Giang: pha ROTATE CHỈ bắt đầu khi đủ mật độ. =====
const SPACE_PRESPAWN_CHECK_DISTANCE = 600;
const SPACE_PRESPAWN_LATERAL_RADIUS = 320;
const SPACE_PRESPAWN_MIN_DENSITY = 6;
const SPACE_PRESPAWN_BATCH_PER_TICK = 1;

// VIẾT LẠI (21/07/2026, lượt 7, phản hồi Giang mục 1 — "chọn một điểm ngẫu nhiên rồi bắt di chuyển
// đến đó") — waypoint pha TRAVEL giờ chọn NGẪU NHIÊN 1 cụm trong nón phía trước (không còn "gần
// nhất"), ƯU TIÊN cụm đủ XA (SPACE_TARGET_MIN_DIST) để mỗi chặng bay là 1 hành trình THẬT SỰ, xem
// findClusterTargetAhead() (core/visualizer/types/space.js).
const SPACE_TARGET_CONE_ANGLE_DEG = 35;
const SPACE_TARGET_CONE_COS = Math.cos(SPACE_TARGET_CONE_ANGLE_DEG * Math.PI / 180);
// Khoảng cách 3D THẬT tối thiểu ưu tiên (đảm bảo hành trình đủ dài, không nhảy sang cụm sát vách).
const SPACE_TARGET_MIN_DIST = 450;
// TĂNG (21/07/2026, lượt 7 — đi cùng mật độ thiên hà dày hơn, có nhiều cụm ĐỦ XA hơn để chọn).
const SPACE_TARGET_MAX_DIST = 1300;
// "Bay xuyên qua" thay vì dừng đúng tâm cụm — cộng thêm 1 đoạn ngắn theo hướng bay.
const SPACE_FLYTHROUGH_OVERSHOOT = 60;

// MỚI (21/07/2026, lượt 6, phản hồi Giang mục 4 — "cung di chuyển uốn lượn cong... thay vì tuyến
// tính thẳng") — biên độ cong (Quadratic Bezier) = tỉ lệ này nhân tổng khoảng cách leg.
const SPACE_LEG_CURVE_STRENGTH_RATIO = 0.25;

// MỚI (21/07/2026, lượt 7, phản hồi Giang mục 2 — "phân bổ đều trên khắp màn hình, hướng camera dự
// kiến trước khi quay") — tỉ lệ lệch ngang/dọc TỐI ĐA mỗi đơn vị khoảng cách khi sinh 1 "nút" chuỗi
// thiên hà (xem computeGalaxyClusterCore(), core/webgl/three-space.js) — xấp xỉ tan(nửa góc FOV)
// camera (fov dọc 65° ở initThreeSpace(), core/webgl/three-space.js) — NGANG rộng hơn DỌC (màn hình
// luôn rộng hơn cao) — nhân thêm hệ số dư (>1) để phủ tràn ra cả rìa màn hình thay vì vừa khít,
// tránh viền tối lúc camera hơi lệch trục giữa các thiên hà đang có.
const SPACE_LATERAL_SPREAD_RATIO_H = 0.85;
const SPACE_LATERAL_SPREAD_RATIO_V = 0.55;

// MỚI (21/07/2026, lượt 6, phản hồi Giang — "xoay hướng này phải được làm mềm... dù quay 1-30 độ
// hay 1-180 độ cảm giác mượt vẫn là như nhau") — thời lượng pha ROTATE, power-law theo góc lệch.
const SPACE_ROTATE_MIN_DURATION = 3;  // giây, góc nhỏ
const SPACE_ROTATE_MAX_DURATION = 9;  // giây, góc 180°
const SPACE_ROTATE_DURATION_POWER = 0.6;

// MỚI (21/07/2026, lượt 6, phản hồi Giang mục audio — "tốc độ di chuyển tự thân thiên hà làm 1
// phổ số ngẫu nhiên dựa trên dải FFT bin audio tại thời điểm nó xuất hiện") — số bin quét quanh
// bin trung tâm (trung bình) lúc snapshot driftSpeedFactor, xem _spawnGalaxyNodeMembers().
const SPACE_DRIFT_BIN_SPREAD = 3;

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
        const { vizConfig: cfg, vizDataArray, analyser, frameCounter, beatScale, smoothedEnergy, globalHueOffset } = appState.get([
            'vizConfig', 'vizDataArray', 'analyser', 'frameCounter', 'beatScale', 'smoothedEnergy', 'globalHueOffset'
        ]);

        const isVisualOff = cfg.visualEnabled === false;
        updateCanvasVisibility(canvas, document.getElementById('webgl-canvas'), isVisualOff); // core

        appState.set('frameCounter', frameCounter + 1, { skipCheck: true });
        const perf = PERFORMANCE_PROFILES[cfg.quality];
        if (!vizDataArray) return; // guard — audio context chưa init (giống hệt hành vi cũ)

        analyser.getByteFrequencyData(vizDataArray);
        const bufferLength = analyser.frequencyBinCount;
        const isPlaying = !audioPlayer.paused;

        const bassCount = Math.floor(bufferLength * 0.1);
        const newBeatScale = computeBeatScale(vizDataArray, bassCount); // core
        appState.set('beatScale', newBeatScale, { skipCheck: true });

        const newSmoothedEnergy = computeSmoothedEnergy(newBeatScale, smoothedEnergy); // core
        appState.set('smoothedEnergy', newSmoothedEnergy, { skipCheck: true });

        const newGlobalHueOffset = computeNextGlobalHueOffset(globalHueOffset, newBeatScale, isPlaying); // core
        appState.set('globalHueOffset', newGlobalHueOffset, { skipCheck: true });

        updateStatsDashboard(bufferLength); // core hiện có (di sản trước 04/07/2026 — Rule 0.5, KHÔNG đụng logic bên trong)

        // Mọi phần dưới đây CHỈ liên quan tới việc VẼ ra canvas — bỏ qua khi visual đang tắt.
        if (isVisualOff) return;

        if (isPlaying && (cfg.quality === 'high' || cfg.quality === 'medium') && newSmoothedEnergy > 0.3 && Math.random() > 0.6) spawnFlyingNote(); // core hiện có

        // ================== VISUAL CŨ — gọi THẲNG, y nguyên tham số (KHÔNG đụng, plan A2) ==================
        if (cfg.type === 'vortex') {
            drawVortex(perf, isPlaying);
        } else if (cfg.type === 'space') {
            // ================== VISUAL MỚI (Galaxy) — Workflow điều phối THẬT SỰ (plan B2) ==================
            this._tickSpace(cfg, isPlaying, newSmoothedEnergy, newGlobalHueOffset);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawFn = VISUALIZER_DRAWERS[cfg.type];
        if (drawFn) drawFn(ctx, perf, isPlaying, newBeatScale);
    },

    /**
     * Điều phối 1 frame của visual Galaxy — máy trạng thái TRAVEL/ROTATE (xem docstring đầu file).
     * Thứ tự mỗi tick: bootstrap -> chuỗi thiên hà (theo `spForward` HIỆN TẠI) -> nếu đang khoá
     * chờ mật độ, bơm thêm 1 đợt nhỏ -> tiến hành đúng pha hiện tại (travel HOẶC rotate, KHÔNG BAO
     * GIỜ cả 2 cùng lúc) -> cập nhật từng thiên hà -> bụi nền -> render.
     */
    _tickSpace(cfg, isPlaying, smoothedEnergy, globalHueOffset) {
        if (!appState.get('spInitialized')) return; // guard, giống hệt drawVortex()

        const spScene = appState.get('spScene');
        const spCamera = appState.get('spCamera');
        const tRenderer = appState.get('tRenderer');
        const spDustMesh = appState.get('spDustMesh');
        const spGalaxyClusters = appState.get('spGalaxyClusters'); // reference SỐNG — mọi push/splice bên dưới đều phản ánh qua biến này (cùng 1 mảng, không cần đọc lại)
        const currentCalculatedBpm = appState.get('currentCalculatedBpm');
        const beatScale = appState.get('beatScale');
        const perf = PERFORMANCE_PROFILES[cfg.quality];

        // ----- đồng hồ riêng của Galaxy (delta giây + tích luỹ globalTime cho shader uTime) -----
        const now = performance.now();
        const delta = _spLastFrameTime === null ? 0.016 : Math.min((now - _spLastFrameTime) / 1000, 0.1);
        _spLastFrameTime = now;
        _spGlobalTime += delta;

        // ----- 0. bootstrap — chưa có leg nào (lần đầu vào 'space') -----
        if (!appState.get('spNextPos')) {
            this._beginFirstSpaceLeg(spCamera.position, spGalaxyClusters);
        }

        // ----- 1. chuỗi thiên hà: theo `spForward` HIỆN TẠI (cố định lúc travel, đổi dần lúc rotate) -----
        const forward = appState.get('spForward');
        this._manageSpaceChain(spScene, spGalaxyClusters, spCamera.position, forward, cfg, perf);

        // ----- 2. đang khoá chờ đủ mật độ thiên hà theo hướng ứng viên? Bơm thêm 1 đợt NHỎ. -----
        if (appState.get('spPreSpawnLocked')) {
            this._advancePreSpawn(spScene, spGalaxyClusters, spCamera.position, cfg, perf);
        }

        // ----- 3. tiến ĐÚNG 1 trong 2 pha (không bao giờ chạy cả 2 cùng lúc) -----
        if (appState.get('spPhase') === 'rotating') {
            this._advanceSpaceRotate(spCamera, delta, spGalaxyClusters);
        } else {
            this._advanceSpaceTravel(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy, spGalaxyClusters);
        }

        // ----- 4. cập nhật từng thiên hà (tốc độ tự quay RIÊNG theo từng thiên hà) -----
        const hueShift = (cfg.mode === 'dynamic' || cfg.mode === 'gradient') ? globalHueOffset : 0;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, SPACE_GALAXY_SPIN_SPEED, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 5. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 6. render -----
        renderSpaceScene(tRenderer, spScene, spCamera); // core
    },

    /**
     * Tra bảng `spNoteSteerTable` theo nốt HIỆN TẠI, giống hệt cách Rubik tra `RUBIK_NOTE_TO_TURN`
     * (core/dom-refs.js) — trả về CẶP GÓC BẺ LÁI {yaw, pitch} (radian) — MỚI (21/07/2026, lượt 6):
     * trước chỉ trả 1 số (chỉ trái/phải), giờ đủ 3 chiều (xem `steerSpaceForward3D()`,
     * core/webgl/three-space.js).
     * @returns {{yaw: number, pitch: number}} {0,0} nếu chưa detect được nốt nào hoặc bảng chưa sẵn sàng.
     */
    _pickNoteSteerAngles() {
        const midiNote = appState.get('lastValidMidiNote');
        const table = appState.get('spNoteSteerTable');
        if (!midiNote || !table) return { yaw: 0, pitch: 0 };
        const noteIdx = ((midiNote % 12) + 12) % 12;
        return table[noteIdx];
    },

    /** Tra "túi xáo trộn" hình thái thiên hà (fix "hình thái phân bổ không đều, trùng lặp khá
     * nhiều") — MỌI lần spawn 1 thiên hà đều PHẢI qua đây, KHÔNG gọi thẳng
     * `pickGalaxyTypeFromBag()` riêng lẻ ở 2 nơi (tránh 2 túi độc lập không đồng bộ).
     * @returns {string} */
    _pickNextGalaxyType() {
        const bag = appState.get('spGalaxyTypeBag');
        const result = pickGalaxyTypeFromBag(bag); // core
        appState.set('spGalaxyTypeBag', result.remainingBag);
        return result.type;
    },

    /** Sinh toàn bộ thành viên (3-5 thiên hà) của 1 "nút" — dùng CHUNG cho cả `_manageSpaceChain()`
     * LẪN `_advancePreSpawn()` — tránh trùng lặp logic ở 2 nơi. */
    _spawnGalaxyNodeMembers(clusterCore, cfg, perf, spScene, spGlowTexture, spNebulaTexture) {
        let totalSpawned = appState.get('spTotalGalaxiesSpawned');
        const vizDataArray = appState.get('vizDataArray');
        // TĂNG (21/07/2026, lượt 7, phản hồi Giang mục 2 — "tăng lượng thiên hà xuất hiện lên"),
        // trước 3-5 (lượt 5) -> 4-7, đi cùng SPACE_CLUSTER_SPACING_Z giảm (nhiều nút hơn/1500 đơn
        // vị tầm nhìn) — tổng thiên hà nhìn thấy cùng lúc tăng đáng kể.
        const memberCount = 4 + Math.floor(Math.random() * 4);
        for (let k = 0; k < memberCount; k++) {
            const offset = computeGalaxyMemberOffset(); // core
            const finalPos = clusterCore.clone().add(offset);
            const type = this._pickNextGalaxyType();
            const palette = pickGalaxyPalette(cfg.mode, cfg.solidColor, cfg.dynA, cfg.dynB); // core — MỌI hình thái đều theo cfg.mode, không ngoại lệ
            const radius = 65 + Math.random() * 25;
            // Snapshot lúc SPAWN (one-shot) — mật độ sao bám theo smoothedEnergy TẠI THỜI ĐIỂM
            // sinh (KHÔNG đổi lại sau đó, "baked" vào chính thiên hà này).
            const smoothedEnergyAtSpawn = appState.get('smoothedEnergy');
            const densityRatio = THREE.MathUtils.clamp(0.3 + smoothedEnergyAtSpawn * 0.7, 0, 1);
            const starsCount = Math.round(perf.galaxyStarsMin + (perf.galaxyStarsMax - perf.galaxyStarsMin) * densityRatio);
            const rotationDir = Math.random() < 0.5 ? 1.0 : -1.0;
            const rotationSpeed = 0.05 + Math.random() * 0.55; // biên độ rộng — mỗi thiên hà quay 1 tốc độ khác biệt rõ
            const rotation = new THREE.Euler(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
            const name = generateRandomGalaxyName(); // core

            // MỚI (21/07/2026, lượt 6, phản hồi Giang mục audio — "tốc độ di chuyển tự thân thiên
            // hà làm 1 phổ số ngẫu nhiên dựa trên dải FFT bin audio tại thời điểm nó xuất hiện") —
            // snapshot 1 dải bin `vizDataArray` NGAY LÚC SPAWN, mỗi thiên hà "bốc" 1 vùng phổ khác
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
            cluster.buildNebula(colorOut, spNebulaTexture, perf.galaxyNebulaCount); // core method

            appState.mutate('spGalaxyClusters', arr => arr.push(cluster));
        }
        appState.set('spTotalGalaxiesSpawned', totalSpawned);
    },

    /**
     * Waypoint (điểm B) cho pha TRAVEL — VIẾT LẠI (21/07/2026, lượt 7, phản hồi Giang mục 1 —
     * "chọn một điểm ngẫu nhiên rồi bắt di chuyển đến đó... toạ độ camera phải di chuyển trùng với
     * vị trí của cụm hoặc thiên hà nào đó, chứ không phải camera cố định"). Chọn NGẪU NHIÊN 1 cụm
     * (ƯU TIÊN cụm đủ xa — `SPACE_TARGET_MIN_DIST` — cho hành trình đủ dài) trong nón phía trước
     * theo `forward` (`findClusterTargetAhead()`, core/visualizer/types/space.js — khoảng cách 3D
     * THẬT, không phải chiếu phẳng), cộng thêm chút "overshoot" để bay XUYÊN QUA thay vì dừng đúng
     * tâm. Camera THẬT SỰ di chuyển toạ độ tới đây (KHÔNG cố định camera — xem `_advanceSpaceTravel()`
     * đặt thẳng `spCamera.position` mỗi frame). KHÔNG có cụm nào trong nón (vd vừa xoay sang vùng
     * chưa kịp spawn) → rơi về công thức mù cũ (originPos + forward*khoảng cách cố định).
     */
    _computeTravelWaypoint(originPos, forward, spGalaxyClusters) {
        const targetPos = findClusterTargetAhead(spGalaxyClusters, originPos, forward, SPACE_TARGET_CONE_COS, SPACE_TARGET_MIN_DIST, SPACE_TARGET_MAX_DIST); // core
        return targetPos
            ? targetPos.addScaledVector(forward, SPACE_FLYTHROUGH_OVERSHOOT)
            : originPos.clone().addScaledVector(forward, SPACE_LEG_DISTANCE);
    },

    /**
     * Hướng ứng viên KẾ TIẾP — MỚI (21/07/2026, lượt 6) — CHỈ tính HƯỚNG (khác hẳn
     * `_computeTravelWaypoint()`, không kèm vị trí): xoay `forward` HIỆN TẠI theo nốt (bảng
     * `spNoteSteerTable`, đủ yaw+pitch 3D — xem `steerSpaceForward3D()`,
     * core/webgl/three-space.js). Waypoint thật cho leg SAU pha rotate sẽ do
     * `_computeTravelWaypoint()` tính LẠI lúc rotate hoàn tất, dùng chính hướng này làm forward mới.
     */
    _computeSteeredCandidateForward(currentForward) {
        const basis = computeSpaceForwardBasis(currentForward); // core
        const { yaw, pitch } = this._pickNoteSteerAngles();
        return steerSpaceForward3D(currentForward, basis.up, yaw, pitch); // core
    },

    /**
     * Bắt đầu pha TRAVEL MỚI — tính waypoint B (nhắm cụm thiên hà gần nhất theo `forward` HIỆN
     * TẠI), sinh control point cong (mục 4), reset đồng hồ quãng đường + mốc lấy mẫu tốc độ theo
     * BPM (mục speed), dọn sạch vùng staging hướng kế tiếp (candidate MỚI sẽ được tính lại giữa
     * chừng leg này, xem `_advanceSpaceTravel()`). Gọi lúc bootstrap LẪN mỗi khi pha ROTATE vừa
     * hoàn tất.
     */
    _startTravelPhase(fromPos, forward, spGalaxyClusters) {
        const nextPos = this._computeTravelWaypoint(fromPos, forward, spGalaxyClusters);
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
        appState.set('spCurrentLegSpeed', -1); // sentinel "chưa lấy mẫu lần nào" (tốc độ thật LUÔN >= 0) — _advanceSpaceTravel() tự lấy mẫu thật ngay frame đầu

        appState.set('spCandidateForward', null);
        appState.set('spPreSpawnLocked', false);
        appState.set('spPreSpawnForward', undefined);
    },

    /**
     * Sinh leg ĐẦU TIÊN lúc vừa vào 'space' — hướng khởi điểm mặc định (0,0,-1). `spGalaxyClusters`
     * rỗng lúc này nên `_computeTravelWaypoint()` tự rơi về công thức mù — `_manageSpaceChain()` tự
     * lấp đầy NGAY sau đó cùng tick.
     */
    _beginFirstSpaceLeg(camPos, spGalaxyClusters) {
        const initialForward = new THREE.Vector3(0, 0, -1);
        appState.set('spForward', initialForward);
        this._startTravelPhase(camPos, initialForward, spGalaxyClusters);
    },

    /**
     * Tiến 1 bước dọc pha TRAVEL — hướng nhìn `spForward` CỐ ĐỊNH suốt pha này (KHÔNG đổi, đúng
     * yêu cầu "đi từ A đến B kết thúc và xoay từ X đến Y là hai pha khác nhau"). Tốc độ KHOÁ theo
     * mốc lấy mẫu BPM ngẫu nhiên, nhân `SPACE_SPEED_MULTIPLIER`. Vị trí nội suy CONG (Quadratic
     * Bezier, mục 4). Đến nơi (progress>=1): snap vị trí, thử chuyển sang pha ROTATE
     * (`_tryCommitRotatePhase()`). Chưa đến: nếu đủ điều kiện VÀ chưa có candidate/chưa khoá chờ,
     * tính + kiểm tra mật độ 1 hướng ứng viên MỚI (chạy NGẦM trong lúc vẫn đang bay, KHÔNG ảnh
     * hưởng hướng nhìn hiện tại — chỉ chuẩn bị trước cho pha ROTATE sắp tới).
     */
    _advanceSpaceTravel(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy, spGalaxyClusters) {
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
            this._tryCommitRotatePhase(spCamera.position, spGalaxyClusters);
        } else {
            appState.set('spLegDistanceCovered', distanceCovered, { skipCheck: true });
            if (progress > SPACE_LEG_PENDING_GEN_PROGRESS && !appState.get('spCandidateForward') && !appState.get('spPreSpawnLocked')) {
                const candidateForward = this._computeSteeredCandidateForward(forward);
                this._stageNextLeg(candidateForward, spCamera.position, spGalaxyClusters);
            }
        }
    },

    /**
     * Đến waypoint B — thử chuyển sang pha ROTATE. ĐÚNG mục 2 (Giang — "phải thêm xong mới được
     * phép quay"): CHỈ chuyển pha khi `spCandidateForward` đã XÁC NHẬN đủ mật độ; CHƯA có thì
     * camera ĐỨNG CHỜ NGUYÊN tại B (spPhase vẫn 'travel', progress đã kẹp ở 1 nên
     * `_advanceSpaceTravel()` tự lặp lại nhánh "đến nơi" mỗi frame kế tiếp — không tiến thêm,
     * không lùi, KHÔNG tự ý xoay sang hướng khác) — `_advancePreSpawn()` (gọi từ `_tickSpace()`)
     * tiếp tục bơm dần thiên hà ở nền cho tới khi đủ. Nếu leg VỪA XONG quá ngắn nên chưa kịp qua
     * ngưỡng `SPACE_LEG_PENDING_GEN_PROGRESS` để tính candidate (trường hợp hiếm) — tính NGAY ở
     * đây để không kẹt vĩnh viễn.
     */
    _tryCommitRotatePhase(camPos, spGalaxyClusters) {
        let candidateForward = appState.get('spCandidateForward');
        if (!candidateForward && !appState.get('spPreSpawnLocked')) {
            const forward = appState.get('spForward');
            const freshCandidate = this._computeSteeredCandidateForward(forward);
            this._stageNextLeg(freshCandidate, camPos, spGalaxyClusters);
            candidateForward = appState.get('spCandidateForward');
        }
        if (!candidateForward) return; // vẫn chưa đủ mật độ — đứng chờ, _advancePreSpawn() lo tiếp

        const fromForward = appState.get('spForward');
        const angleDeg = computeAngleBetweenForwards(fromForward, candidateForward); // core
        const duration = computeSpaceRotateDuration(angleDeg, SPACE_ROTATE_MIN_DURATION, SPACE_ROTATE_MAX_DURATION, SPACE_ROTATE_DURATION_POWER); // core

        appState.set('spPhase', 'rotating');
        appState.set('spRotateFromForward', fromForward);
        appState.set('spRotateToForward', candidateForward);
        appState.set('spRotateElapsed', 0);
        appState.set('spRotateDuration', duration);
    },

    /**
     * Tiến 1 bước dọc pha ROTATE — vị trí camera KHOÁ NGUYÊN (KHÔNG đụng `spCamera.position`),
     * chỉ hướng nhìn nội suy dần (quaternion slerp, đủ mọi góc kể cả 180° đối cực) theo thời lượng
     * đã tính lúc bắt đầu (mềm theo góc — góc nhỏ xoay nhanh, góc lớn xoay chậm hơn, KHÔNG tuyến
     * tính). Xoay xong: `spForward` = chính xác hướng đích, bắt đầu pha TRAVEL kế tiếp
     * (`_startTravelPhase()` tự tính waypoint MỚI theo hướng vừa xoay xong).
     */
    _advanceSpaceRotate(spCamera, delta, spGalaxyClusters) {
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
            this._startTravelPhase(spCamera.position.clone(), toForward.clone(), spGalaxyClusters);
        } else {
            appState.set('spRotateElapsed', elapsed, { skipCheck: true });
        }
    },

    /**
     * "Tiên đoán trước hướng, kiểm tra tỉ lệ mật độ thiên hà vùng đó rồi mới quyết định thêm hay
     * không thêm" — nhận 1 hướng ỨNG VIÊN, kiểm tra mật độ thiên hà SẴN CÓ theo hướng đó
     * (`assessGalaxyDensityAhead`, core, chỉ ĐẾM, không tự spawn). ĐỦ dày thì CHỐT NGAY thành
     * `spCandidateForward` (đủ điều kiện cho pha ROTATE). CHƯA đủ thì khoá lại
     * (`spPreSpawnLocked`), lưu ứng viên vào vùng staging — `_advancePreSpawn()` tự bơm thêm dần ở
     * các tick sau. Pha TRAVEL đang chạy hoàn toàn KHÔNG bị đụng.
     */
    _stageNextLeg(candidateForward, camPos, spGalaxyClusters) {
        const density = assessGalaxyDensityAhead(spGalaxyClusters, camPos, candidateForward, SPACE_PRESPAWN_CHECK_DISTANCE, SPACE_PRESPAWN_LATERAL_RADIUS); // core
        if (density >= SPACE_PRESPAWN_MIN_DENSITY) {
            appState.set('spCandidateForward', candidateForward);
            appState.set('spPreSpawnLocked', false);
            return;
        }
        appState.set('spPreSpawnLocked', true);
        appState.set('spPreSpawnForward', candidateForward);
    },

    /**
     * Bơm thêm thiên hà DẦN DẦN (giới hạn `SPACE_PRESPAWN_BATCH_PER_TICK` nút/tick — trải công
     * việc ra NHIỀU FRAME, tránh giật hình do sinh hàng loạt thiên hà dồn 1 lúc) theo hướng đang
     * chờ (`spPreSpawnForward`) — kiểm tra lại mật độ mỗi tick, ĐỦ rồi thì CHỐT thành
     * `spCandidateForward` + mở khoá.
     */
    _advancePreSpawn(spScene, spGalaxyClusters, camPos, cfg, perf) {
        const forward = appState.get('spPreSpawnForward');
        const { right, up } = computeSpaceForwardBasis(forward); // core
        const spGlowTexture = appState.get('spGlowTexture');
        const spNebulaTexture = appState.get('spNebulaTexture');

        let nextIdx = appState.get('spNextClusterIndex');
        for (let n = 0; n < SPACE_PRESPAWN_BATCH_PER_TICK; n++) {
            const distanceAhead = SPACE_CLUSTER_SPACING_Z * (n + 1);
            const clusterCore = computeGalaxyClusterCore(camPos, forward, right, up, distanceAhead, SPACE_LATERAL_SPREAD_RATIO_H, SPACE_LATERAL_SPREAD_RATIO_V); // core
            nextIdx++;
            this._spawnGalaxyNodeMembers(clusterCore, cfg, perf, spScene, spGlowTexture, spNebulaTexture);
        }
        appState.set('spNextClusterIndex', nextIdx);

        const density = assessGalaxyDensityAhead(spGalaxyClusters, camPos, forward, SPACE_PRESPAWN_CHECK_DISTANCE, SPACE_PRESPAWN_LATERAL_RADIUS); // core
        if (density >= SPACE_PRESPAWN_MIN_DENSITY) {
            appState.set('spCandidateForward', forward);
            appState.set('spPreSpawnLocked', false);
        }
    },

    /**
     * Quản lý chuỗi thiên hà 1 tick: đọc quyết định THUẦN từ `manageGalaxyChain()` (core), rồi TỰ
     * thực thi (dispose/sinh mới/khoá mục tiêu) — không hàm Core nào ở đây gọi hàm Core khác.
     */
    _manageSpaceChain(spScene, spGalaxyClusters, camPos, forward, cfg, perf) {
        const info = manageGalaxyChain(spGalaxyClusters, camPos, forward, SPACE_CHAIN_DISPOSE_DISTANCE, SPACE_CHAIN_DISPOSE_LATERAL_DISTANCE, SPACE_AHEAD_WINDOW, SPACE_CHAIN_AHEAD_MARGIN); // core

        if (info.toDisposeIndices.length > 0) {
            info.toDisposeIndices.forEach(i => spGalaxyClusters[i].dispose(spScene)); // core method
            appState.mutate('spGalaxyClusters', arr => { info.toDisposeIndices.forEach(i => arr.splice(i, 1)); });
        }

        let furthestAheadDist = info.furthestAheadDist;
        let nextIdx = appState.get('spNextClusterIndex');
        const spGlowTexture = appState.get('spGlowTexture');
        const spNebulaTexture = appState.get('spNebulaTexture');
        const { right, up } = computeSpaceForwardBasis(forward); // core

        while (furthestAheadDist < SPACE_AHEAD_WINDOW) {
            furthestAheadDist += SPACE_CLUSTER_SPACING_Z;
            const clusterCore = computeGalaxyClusterCore(camPos, forward, right, up, furthestAheadDist, SPACE_LATERAL_SPREAD_RATIO_H, SPACE_LATERAL_SPREAD_RATIO_V); // core
            nextIdx++;
            this._spawnGalaxyNodeMembers(clusterCore, cfg, perf, spScene, spGlowTexture, spNebulaTexture);
        }
        appState.set('spNextClusterIndex', nextIdx);

        if (info.nearestAheadIndex !== null) appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
    },
};
