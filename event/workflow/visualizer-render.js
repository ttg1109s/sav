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
 * VIẾT LẠI LẦN 2 (21/07/2026, phản hồi Giang) — mô hình di chuyển "waypoint nối tiếp": camera LUÔN
 * đang bay từ 1 điểm (`spLegStartPos`) tới điểm kế tiếp (`spNextPos`), tốc độ = BPM hiện tại lúc
 * BẮT ĐẦU mỗi leg + random — waypoint SAU đó được sinh sẵn giữa chừng leg hiện tại, dùng để blend
 * hướng nhìn mượt ở đoạn cuối (fix "hard cut" mục 1). "Nhảy" sang thiên hà khác giờ trigger bằng
 * NỐT CAO NHẤT vừa vang lên (KHÔNG còn ngưỡng năng lượng/random), khoá roll + khoá không cho nhảy
 * chồng lấp trong lúc di chuyển. Xem `_tickSpace()`/`_advanceSpaceLeg()`/`_startGalaxyJumpLeg()`.
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
const SPACE_CHAIN_DISPOSE_LATERAL_DISTANCE = 900;
const SPACE_CHAIN_AHEAD_MARGIN = 20;

// ===== Hằng số mô hình "waypoint nối tiếp" (plan mục 3, lượt 2) =====
// Khoảng cách CƠ SỞ mỗi leg thường (đơn vị 3D) — thực tế NHÂN THÊM theo vị trí trong bar nhạc lúc
// sinh leg (mục 2, lượt 4 — "tăng khoảng cách nextPos lên * bar"), xem `_computeNextNormalLeg()`.
const SPACE_LEG_DISTANCE = 220;
// Tốc độ (đơn vị/giây) tại 120bpm — nhân với (bpm/120) mỗi leg. TĂNG THÊM 5x (fix mục 2, phản hồi
// 21/07/2026 lượt 4 — "tăng tốc 5x lần nữa"), trước 46 (lượt 3) -> 230.
const SPACE_LEG_SPEED_BASE = 230;
// +-30% ngẫu nhiên thời lượng mỗi leg ("Đương nhiên phải cộng thêm giá trị ngẫu nhiên").
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// Độ lệch hướng NHẸ mỗi leg thường (radian) — lệch DẦN từng chút 1 so với hướng leg trước.
const SPACE_LEG_YAW_JITTER = Math.PI * 0.16;
const SPACE_LEG_PITCH_JITTER = Math.PI * 0.10;
// % progress bắt đầu blend hướng nhìn sang leg KẾ TIẾP (đã sinh sẵn) — mượt hoá chuyển tiếp, fix
// "hard cut" (hướng nhìn đổi ĐỘT NGỘT đúng lúc hết leg) — cơ chế này cũng chính là thứ mượt hoá
// luôn cả lúc BẮT ĐẦU leg nhảy (xem _startGalaxyJumpLeg).
const SPACE_LEG_BLEND_START = 0.65;
// % progress bắt đầu sinh SẴN waypoint kế tiếp ("đồng thời sinh điểm kế tiếp", mục 3).
const SPACE_LEG_PENDING_GEN_PROGRESS = 0.35;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu — TĂNG THEO cùng tỉ lệ
// 5x (mục 2, lượt 4), trước 8 -> 40.
const SPACE_IDLE_LEG_SPEED = 40;

// ===== Hằng số "nhảy" sang thiên hà khác theo NỐT CAO NHẤT =====
const SPACE_JUMP_NOTE_MARGIN = 2;
const SPACE_NOTE_PEAK_DECAY_PER_SEC = 0.6;
// "di chuyển NHANH" — nhân thêm vào tốc độ leg thường khi leg đó là leg nhảy.
const SPACE_JUMP_LEG_SPEED_MULT = 3.0;

// ===== Hằng số LUT sin quỹ đạo (mục 4, lượt 3 — giờ ăn theo BAR NHẠC THẬT, lượt 4 mục 1) =====
const SPACE_LEG_SINE_MAX_SIZE = 64; // "số lượng ngẫu nhiên từ 1-64"
const SPACE_LEG_SINE_AMPLITUDE_MIN = 10;
const SPACE_LEG_SINE_AMPLITUDE_MAX = 45; // "+ ngẫu nhiên" biên độ lệch quỹ đạo
// Số beat/bar (giả định nhịp 4/4 phổ biến nhất — project chưa có time-signature detection riêng).
const SPACE_BEATS_PER_BAR = 4;
// Bước "nhìn trước" (progress, KHÔNG phải giây) dùng để lấy mẫu tiếp tuyến quỹ đạo cong — xem
// _advanceSpaceLeg(). Nhỏ để tiếp tuyến chính xác cục bộ, đủ lớn để không triệt tiêu bởi sai số
// dấu phẩy động.
const SPACE_TANGENT_LOOKAHEAD = 0.02;

// ===== Tốc độ tự quay của thiên hà — biên độ NGẪU NHIÊN THEO TỪNG THIÊN HÀ (mục "xoay đều giống
// nhau nhìn rất chán", phản hồi 21/07/2026 lượt 4) — KHÔNG còn 1 hằng số DUY NHẤT cho tất cả (lượt
// 3) — mỗi thiên hà tự có `rotationSpeed` RIÊNG (đã random khi spawn, xem _manageSpaceChain, biên
// độ MỞ RỘNG nhiều so với bản gốc 0.12-0.16), giá trị GLOBAL dưới đây chỉ còn là hệ số NHÂN CHUNG
// nhẹ, không quyết định phần lớn cảm giác quay nữa.
const SPACE_GALAXY_SPIN_SPEED = 0.8;

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
     * Điều phối 1 frame của visual Galaxy — mô hình "waypoint nối tiếp": camera LUÔN đang bay
     * giữa 2 điểm (`spLegStartPos` -> `spNextPos`) theo `spLegForward`, tốc độ tính từ BPM lúc
     * BẮT ĐẦU mỗi leg. Thứ tự mỗi tick: bootstrap (nếu chưa có leg) -> chuỗi thiên hà (theo
     * forward của leg HIỆN TẠI) -> kiểm tra "nốt đỉnh mới" để CHÈN 1 leg NHẢY làm pending ưu tiên
     * -> tiến hành di chuyển dọc leg -> cập nhật từng thiên hà -> bụi nền -> render.
     */
    _tickSpace(cfg, isPlaying, smoothedEnergy, globalHueOffset) {
        if (!appState.get('spInitialized')) return; // guard, giống hệt drawVortex()

        const spScene = appState.get('spScene');
        const spCamera = appState.get('spCamera');
        const tRenderer = appState.get('tRenderer');
        const spDustMesh = appState.get('spDustMesh');
        const spGalaxyClusters = appState.get('spGalaxyClusters'); // reference SỐNG — mọi push/splice bên dưới đều phản ánh qua biến này (cùng 1 mảng, không cần đọc lại)
        const currentCalculatedBpm = appState.get('currentCalculatedBpm');
        const lastValidMidiNote = appState.get('lastValidMidiNote');
        const beatScale = appState.get('beatScale');
        const perf = PERFORMANCE_PROFILES[cfg.quality];

        // ----- đồng hồ riêng của Galaxy (delta giây + tích luỹ globalTime cho shader uTime) -----
        const now = performance.now();
        const delta = _spLastFrameTime === null ? 0.016 : Math.min((now - _spLastFrameTime) / 1000, 0.1);
        _spLastFrameTime = now;
        _spGlobalTime += delta;

        // ----- 0. bootstrap — chưa có leg nào (lần đầu vào 'space') -----
        if (!appState.get('spNextPos')) {
            this._beginFirstSpaceLeg(spCamera.position);
        }

        // ----- 1. chuỗi thiên hà: theo hướng leg HIỆN TẠI -----
        const legForward = appState.get('spLegForward');
        this._manageSpaceChain(spScene, spGalaxyClusters, spCamera.position, legForward, cfg, perf);

        // ----- 2. "nhảy" sang thiên hà khác — trigger bằng NỐT CAO NHẤT vừa vang lên — CHÈN LÀM
        // PENDING ƯU TIÊN (KHÔNG cắt ngang leg hiện tại — xem docstring _startGalaxyJumpLeg). -----
        if (!appState.get('spJumpLocked') && isPlaying) {
            const isNewPeakNote = this._checkNewHighestNote(lastValidMidiNote, delta);
            if (isNewPeakNote) this._startGalaxyJumpLeg(spGalaxyClusters, appState.get('spCurrentTargetIndex'), legForward);
        }

        // ----- 3. tiến hành di chuyển dọc leg hiện tại (vị trí + hướng nhìn khoá roll + LUT sin) -----
        this._advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying);

        // ----- 4. cập nhật từng thiên hà (tốc độ tự quay ĐÃ RIÊNG theo từng thiên hà, mục "xoay
        // đều nhìn chán" — hệ số SPACE_GALAXY_SPIN_SPEED chỉ còn là số nhân chung nhẹ) -----
        const hueShift = (cfg.mode === 'dynamic' || cfg.mode === 'gradient') ? globalHueOffset : 0;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, SPACE_GALAXY_SPIN_SPEED, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 5. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 6. render -----
        renderSpaceScene(tRenderer, spScene, spCamera); // core
    },

    /** Sinh 1 bộ tham số LUT sin MỚI — kích thước bảng dựa theo BAR NHẠC hiện tại lúc leg bắt đầu
     * (mục 1/4, lượt 4 — "theo bar nhạc tại thời điểm bắt đầu di chuyển... + ngẫu nhiên") CỘNG
     * thêm phần random thật, biên độ ngẫu nhiên độc lập. `beatCount` (STATE, MỚI — xem
     * core/audio-analysis.js) tăng dần theo từng beat phát hiện được; "bar" = số beat / 4.
     * KHÔNG PHẢI đồng bộ chính xác tuyệt đối theo ranh giới bar (leg có thời lượng riêng, không
     * luôn khớp đúng lúc 1 bar mới bắt đầu) — mà là LẤY GIÁ TRỊ bar hiện tại NGAY LÚC leg này được
     * sinh ra, làm 1 phần dữ liệu đầu vào cho kích thước bảng, cộng thêm random thật lên trên. */
    _generateLegSineParams() {
        const beatCount = appState.get('beatCount') || 0;
        const currentBar = Math.floor(beatCount / SPACE_BEATS_PER_BAR);
        const barSeed = currentBar % SPACE_LEG_SINE_MAX_SIZE;
        const lutSize = 1 + ((barSeed + Math.floor(Math.random() * SPACE_LEG_SINE_MAX_SIZE)) % SPACE_LEG_SINE_MAX_SIZE);
        const lut = buildSpaceLegSineLUT(lutSize); // core
        const amplitude = SPACE_LEG_SINE_AMPLITUDE_MIN + Math.random() * (SPACE_LEG_SINE_AMPLITUDE_MAX - SPACE_LEG_SINE_AMPLITUDE_MIN);
        return { lut, amplitude };
    },

    /** Vị trí camera dọc leg tại `progress` — THẲNG (`computeSpaceLegPosition`) CỘNG lệch LUT sin
     * (mục 4) — hàm WORKFLOW thường (KHÔNG phải Core), tự do kết hợp nhiều lời gọi Core, dùng LẠI
     * ở cả `_advanceSpaceLeg()` (vị trí thật) LẪN lúc lấy mẫu tiếp tuyến quỹ đạo (mục 1, lượt 4 —
     * xem bên dưới) — tránh trùng lặp công thức. */
    _computeSpaceLegCurvedPos(legStartPos, nextPos, rightAxis, lut, amplitude, progress) {
        const straight = computeSpaceLegPosition(legStartPos, nextPos, progress); // core
        const lutValue = sampleSpaceLegSineLUT(lut, progress); // core
        return straight.addScaledVector(rightAxis, lutValue * amplitude);
    },

    /** Tính 1 bộ (hướng, điểm đến, LUT sin) cho leg THƯỜNG kế tiếp — lệch NHẸ khỏi `currentForward`
     * (mục 3, lượt 2 "sinh ra... góc độ tiếp theo", KHÔNG phải chọn hướng ngẫu nhiên hoàn toàn
     * mới). Khoảng cách leg NHÂN THÊM theo vị trí trong bar nhạc hiện tại (mục 2, lượt 4 — "tăng
     * khoảng cách nextPos lên * bar") — dùng `(beatCount % 4) + 1` (vị trí trong bar, 1-4, LẶP LẠI
     * mỗi bar) thay vì nhân theo TỔNG số bar đã trôi qua cả bài — tránh khoảng cách phình to vô
     * hạn theo thời gian nếu để nguyên nghĩa đen "nhân theo tổng số bar".
     */
    _computeNextNormalLeg(originPos, currentForward) {
        const { right, up } = computeSpaceForwardBasis(currentForward); // core
        const nextForward = generateNextSpaceLegForward(currentForward, right, up, SPACE_LEG_YAW_JITTER, SPACE_LEG_PITCH_JITTER); // core
        const beatCount = appState.get('beatCount') || 0;
        const barPositionMult = (beatCount % SPACE_BEATS_PER_BAR) + 1; // 1..4, lặp lại mỗi bar
        const nextPos = originPos.clone().addScaledVector(nextForward, SPACE_LEG_DISTANCE * barPositionMult);
        const sineParams = this._generateLegSineParams();
        return { nextForward, nextPos, lut: sineParams.lut, amplitude: sineParams.amplitude };
    },

    /** Sinh leg ĐẦU TIÊN lúc vừa vào 'space' — hướng khởi điểm mặc định (0,0,-1), tốc độ dùng
     * baseline 120bpm (BPM thật có thể chưa sẵn sàng ngay lúc này). */
    _beginFirstSpaceLeg(camPos) {
        const initialForward = new THREE.Vector3(0, 0, -1);
        const generated = this._computeNextNormalLeg(camPos, initialForward);
        appState.set('spLegStartPos', camPos.clone());
        appState.set('spLegForward', generated.nextForward);
        appState.set('spNextPos', generated.nextPos);
        appState.set('spLegElapsed', 0);
        appState.set('spLegDuration', camPos.distanceTo(generated.nextPos) / SPACE_LEG_SPEED_BASE);
        appState.set('spLegSineLUT', generated.lut);
        appState.set('spLegSineAmplitude', generated.amplitude);
        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
        appState.set('spCurrentLegIsJump', false);
    },

    /**
     * Tiến 1 bước dọc leg hiện tại: nội suy vị trí THEO ĐÚNG QUỸ ĐẠO CONG (thẳng + lệch LUT sin,
     * `_computeSpaceLegCurvedPos`). Hướng camera NHÌN THEO TIẾP TUYẾN quỹ đạo cong đó (lấy mẫu
     * thêm 1 điểm `progress + SPACE_TANGENT_LOOKAHEAD` rồi trừ nhau lấy hướng tức thời) — FIX
     * (21/07/2026, phản hồi Giang lượt 4, mục 1 — "chưa thấy LUT đâu vẫn di chuyển thẳng"): bản
     * TRƯỚC vị trí CÓ lệch theo LUT (đã kiểm chứng bằng số liệu) nhưng CAMERA VẪN NHÌN THEO HƯỚNG
     * LEG THẲNG CỐ ĐỊNH (`legForward`) suốt cả leg — mắt người gần như không cảm nhận được 1 lệch
     * ngang nhỏ khi hướng nhìn không hề rẽ theo (giống "đi ngang cua" thay vì "rẽ lái") — giờ
     * hướng camera THỰC SỰ bám theo đường cong, tạo cảm giác rẽ trái/phải rõ rệt đúng hình sin.
     *
     * BLEND dần sang hướng leg KẾ TIẾP (kể cả leg đó là leg NHẢY) ở đoạn cuối
     * (`SPACE_LEG_BLEND_START`) để KHÔNG có cú xoay đột ngột lúc chuyển leg (fix "hard cut", CẢ
     * lúc chuyển leg thường LẪN lúc bắt đầu leg nhảy). Khi đến nơi: snap chính xác vị trí + chuyển
     * sang leg kế tiếp (`_commitNextSpaceLeg`). Khi chưa đến: sinh SẴN waypoint kế tiếp giữa chừng
     * (mục 3, lượt 2 "đồng thời sinh điểm kế tiếp").
     */
    _advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying) {
        const elapsed = appState.get('spLegElapsed') + delta;
        const duration = appState.get('spLegDuration');
        const progress = duration > 0 ? elapsed / duration : 1;

        const legStartPos = appState.get('spLegStartPos');
        const nextPos = appState.get('spNextPos');
        const legForward = appState.get('spLegForward');
        const legBasis = computeSpaceForwardBasis(legForward); // core
        const lut = appState.get('spLegSineLUT');
        const amplitude = appState.get('spLegSineAmplitude');

        const finalPos = this._computeSpaceLegCurvedPos(legStartPos, nextPos, legBasis.right, lut, amplitude, progress);
        spCamera.position.copy(finalPos);

        // Tiếp tuyến quỹ đạo cong TẠI ĐIỂM HIỆN TẠI — hướng camera bám theo đường cong THẬT, không
        // phải hướng thẳng cố định (fix mục 1, "LUT vô hình" — xem docstring hàm).
        const lookAheadProgress = Math.min(1, progress + SPACE_TANGENT_LOOKAHEAD);
        const lookAheadPos = this._computeSpaceLegCurvedPos(legStartPos, nextPos, legBasis.right, lut, amplitude, lookAheadProgress);
        let tangentForward = lookAheadPos.clone().sub(finalPos);
        if (tangentForward.lengthSq() < 0.0001) tangentForward = legForward.clone(); // rất gần cuối leg, epsilon không đủ chênh lệch -> dùng thẳng hướng leg
        else tangentForward.normalize();

        let orientForward = tangentForward;
        const pendingForward = appState.get('spPendingForward');
        if (pendingForward && progress > SPACE_LEG_BLEND_START) {
            const blendT = Math.min(1, (progress - SPACE_LEG_BLEND_START) / (1 - SPACE_LEG_BLEND_START));
            orientForward = tangentForward.lerp(pendingForward, blendT).normalize();
        }
        const orientBasis = computeSpaceForwardBasis(orientForward); // core
        applyStableSpaceOrientation(spCamera, orientForward, orientBasis.right, orientBasis.up); // core — khoá roll

        if (progress >= 1) {
            spCamera.position.copy(nextPos); // snap chính xác vị trí THẲNG (2 đầu mút LUT vốn = 0 nên khớp)
            this._commitNextSpaceLeg(currentCalculatedBpm, isPlaying);
        } else {
            appState.set('spLegElapsed', elapsed, { skipCheck: true });
            if (progress > SPACE_LEG_PENDING_GEN_PROGRESS && !appState.get('spPendingNextPos')) {
                const generated = this._computeNextNormalLeg(nextPos, legForward);
                appState.set('spPendingNextPos', generated.nextPos);
                appState.set('spPendingForward', generated.nextForward);
                appState.set('spPendingLegSineLUT', generated.lut);
                appState.set('spPendingLegSineAmplitude', generated.amplitude);
            }
        }
    },

    /**
     * Hoàn tất leg hiện tại, chuyển sang leg KẾ TIẾP (đã sinh sẵn giữa chừng — nếu chưa kịp sinh,
     * sinh ngay tại đây) — mở khoá `spJumpLocked` NẾU leg VỪA HOÀN THÀNH (tới giờ) là leg nhảy (đã
     * THỰC SỰ tới đích B) — rồi ĐỌC TƯƠI BPM hiện tại làm tốc độ cho leg MỚI, NHÂN THÊM hệ số
     * nhanh nếu leg MỚI đó lại là 1 leg nhảy khác.
     */
    _commitNextSpaceLeg(currentCalculatedBpm, isPlaying) {
        if (appState.get('spCurrentLegIsJump')) appState.set('spJumpLocked', false);

        const finishedPos = appState.get('spNextPos');
        const finishedForward = appState.get('spLegForward');
        let nextForward = appState.get('spPendingForward');
        let nextPos = appState.get('spPendingNextPos');
        let nextLUT = appState.get('spPendingLegSineLUT');
        let nextAmplitude = appState.get('spPendingLegSineAmplitude');
        const nextIsJump = !!appState.get('spPendingIsJump');
        const nextJumpTargetIndex = appState.get('spPendingJumpTargetIndex');

        if (!nextPos) {
            const generated = this._computeNextNormalLeg(finishedPos, finishedForward);
            nextForward = generated.nextForward;
            nextPos = generated.nextPos;
            nextLUT = generated.lut;
            nextAmplitude = generated.amplitude;
        }

        appState.set('spLegStartPos', finishedPos.clone());
        appState.set('spLegForward', nextForward);
        appState.set('spNextPos', nextPos);
        appState.set('spLegElapsed', 0);
        appState.set('spLegSineLUT', nextLUT);
        appState.set('spLegSineAmplitude', nextAmplitude);
        appState.set('spCurrentLegIsJump', nextIsJump);
        if (nextIsJump && nextJumpTargetIndex !== null) appState.set('spCurrentTargetIndex', nextJumpTargetIndex);

        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        let legSpeed = isPlaying ? SPACE_LEG_SPEED_BASE * (bpm / 120) : SPACE_IDLE_LEG_SPEED; // LUÔN có trôi tối thiểu khi dừng nhạc
        if (nextIsJump) legSpeed *= SPACE_JUMP_LEG_SPEED_MULT; // "di chuyển nhanh"
        const distance = finishedPos.distanceTo(nextPos);
        const randomFactor = 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE; // "cộng thêm giá trị ngẫu nhiên"
        appState.set('spLegDuration', Math.max(0.3, (distance / legSpeed) * randomFactor));

        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
        appState.set('spPendingLegSineLUT', null);
        appState.set('spPendingIsJump', false);
        appState.set('spPendingJumpTargetIndex', null);
    },

    /**
     * Phát hiện "đỉnh nốt mới" — `spHighestNoteSeen` là 1 cái "trần" tự hạ dần theo thời gian
     * (`SPACE_NOTE_PEAK_DECAY_PER_SEC`); nốt hiện tại VƯỢT trần đó (cộng biên
     * `SPACE_JUMP_NOTE_MARGIN`) mới tính là đỉnh mới — trần tự hạ cho phép nốt tương tự kích hoạt
     * lại sau vài giây, KHÔNG bị "dùng 1 lần rồi thôi" suốt phần còn lại bài hát.
     */
    _checkNewHighestNote(lastValidMidiNote, delta) {
        if (!lastValidMidiNote) return false;
        let ceiling = appState.get('spHighestNoteSeen') - SPACE_NOTE_PEAK_DECAY_PER_SEC * delta;
        if (ceiling < 0) ceiling = 0;
        const isPeak = lastValidMidiNote > ceiling + SPACE_JUMP_NOTE_MARGIN;
        appState.set('spHighestNoteSeen', isPeak ? lastValidMidiNote : ceiling, { skipCheck: true });
        return isPeak;
    },

    /**
     * CHÈN 1 leg "NHẢY" làm PENDING ƯU TIÊN — KHÔNG cắt ngang leg hiện tại: chỉ CHÈN kết quả vào
     * `spPendingNextPos`/`spPendingForward` (ghi đè pending thường nếu có) — cơ chế blend hướng
     * nhìn CÓ SẴN ở `_advanceSpaceLeg()` (đoạn cuối leg hiện tại) TỰ xoay camera MƯỢT sang hướng
     * này trước khi leg nhảy thật sự bắt đầu. Khi leg hiện tại hoàn tất tự nhiên,
     * `_commitNextSpaceLeg()` "kích hoạt" leg nhảy này với tốc độ NHANH hơn hẳn.
     *
     * B chọn dựa trên khoảng cách/hướng TỪ A (thiên hà ĐANG khoá làm mục tiêu,
     * `spCurrentTargetIndex`), KHÔNG phải từ vị trí camera hiện tại — bám đúng cấu trúc thật của
     * sợi vũ trụ tại điểm đó (vector A->B) thay vì hướng tuỳ tiện theo vị trí camera nhất thời.
     * @param {GalaxyCluster[]} spGalaxyClusters @param {number|null} currentTargetIndex @param {THREE.Vector3} currentForward
     */
    _startGalaxyJumpLeg(spGalaxyClusters, currentTargetIndex, currentForward) {
        const clusterA = currentTargetIndex !== null ? spGalaxyClusters.find(g => g.index === currentTargetIndex) : null;
        if (!clusterA) return; // chưa có mục tiêu nào đang khoá (rất sớm lúc mới vào Space) — bỏ qua, thử lại đỉnh nốt kế tiếp

        const candidates = spGalaxyClusters
            .filter(g => g !== clusterA)
            .map(g => ({ g, dist: g.position.clone().sub(clusterA.position).dot(currentForward) }))
            .filter(o => o.dist > 0)
            .sort((a, b) => a.dist - b.dist);
        if (candidates.length === 0) return; // chưa có gì "kế cận" đúng nghĩa phía trước A — bỏ qua

        const clusterB = candidates[0].g;
        const abDirection = clusterB.position.clone().sub(clusterA.position).normalize();
        const sineParams = this._generateLegSineParams();

        appState.set('spPendingNextPos', clusterB.position.clone());
        appState.set('spPendingForward', abDirection);
        appState.set('spPendingLegSineLUT', sineParams.lut);
        appState.set('spPendingLegSineAmplitude', sineParams.amplitude);
        appState.set('spPendingIsJump', true);
        appState.set('spPendingJumpTargetIndex', clusterB.index);

        appState.set('spJumpLocked', true); // khoá NGAY lúc CHÈN
    },

    /**
     * Quản lý chuỗi thiên hà 1 tick: đọc quyết định THUẦN từ `manageGalaxyChain()` (core, chỉ
     * TÍNH TOÁN — xem docstring hàm đó), rồi TỰ thực thi (dispose/sinh mới/khoá mục tiêu) bằng
     * cách gọi RIÊNG LẺ từng hàm/method Core theo đúng thứ tự — không hàm Core nào ở đây gọi hàm
     * Core khác (plan B2/Rule 3c).
     *
     * KHÔNG tự ý ghi đè `spCurrentTargetIndex` khi đang khoá (`spJumpLocked`).
     */
    _manageSpaceChain(spScene, spGalaxyClusters, camPos, forward, cfg, perf) {
        const info = manageGalaxyChain(spGalaxyClusters, camPos, forward, SPACE_CHAIN_DISPOSE_DISTANCE, SPACE_CHAIN_DISPOSE_LATERAL_DISTANCE, SPACE_AHEAD_WINDOW, SPACE_CHAIN_AHEAD_MARGIN); // core

        // 1. dispose thiên hà đã trôi quá xa phía sau HOẶC lệch quá xa ngang khỏi hướng bay hiện
        // tại (index giảm dần trong toDisposeIndices -> splice an toàn)
        if (info.toDisposeIndices.length > 0) {
            info.toDisposeIndices.forEach(i => spGalaxyClusters[i].dispose(spScene)); // core method
            appState.mutate('spGalaxyClusters', arr => { info.toDisposeIndices.forEach(i => arr.splice(i, 1)); });
        }

        // 2. sinh thêm cụm phía trước (dọc trục forward HIỆN TẠI) cho tới khi đủ tầm nhìn xa CỐ
        // ĐỊNH (SPACE_AHEAD_WINDOW, plan B6)
        let furthestAheadDist = info.furthestAheadDist;
        let nextIdx = appState.get('spNextClusterIndex');
        let totalSpawned = appState.get('spTotalGalaxiesSpawned');
        const spGlowTexture = appState.get('spGlowTexture');
        const spNebulaTexture = appState.get('spNebulaTexture');
        const { right, up } = computeSpaceForwardBasis(forward); // core

        while (furthestAheadDist < SPACE_AHEAD_WINDOW) {
            furthestAheadDist += SPACE_CLUSTER_SPACING_Z;
            const clusterCore = computeGalaxyClusterCore(camPos, forward, right, up, furthestAheadDist); // core — MỚI: ngẫu nhiên thật, không còn wobbleSeed
            nextIdx++;
            // Số thành viên mỗi nút 3-5 (mật độ, lượt 3).
            const memberCount = 3 + Math.floor(Math.random() * 3);
            for (let k = 0; k < memberCount; k++) {
                const offset = computeGalaxyMemberOffset(); // core
                const finalPos = clusterCore.clone().add(offset);
                const type = pickGalaxyType(); // core
                const palette = pickGalaxyPalette(cfg.mode, cfg.solidColor, cfg.dynA, cfg.dynB); // core — MỌI hình thái đều theo cfg.mode, không ngoại lệ
                const radius = 65 + Math.random() * 25;
                // Snapshot lúc SPAWN (one-shot) — mật độ sao bám theo smoothedEnergy TẠI THỜI ĐIỂM
                // sinh (KHÔNG đổi lại sau đó, "baked" vào chính thiên hà này).
                const smoothedEnergyAtSpawn = appState.get('smoothedEnergy');
                const densityRatio = THREE.MathUtils.clamp(0.3 + smoothedEnergyAtSpawn * 0.7, 0, 1);
                const starsCount = Math.round(perf.galaxyStarsMin + (perf.galaxyStarsMax - perf.galaxyStarsMin) * densityRatio);
                const rotationDir = Math.random() < 0.5 ? 1.0 : -1.0;
                // FIX (21/07/2026, phản hồi Giang lượt 4 — "các thiên hà xoay đều giống nhau nhìn
                // rất chán"): biên độ MỞ RỘNG NHIỀU (trước 0.12-0.16, chỉ chênh lệch ~33% giữa
                // thiên hà quay chậm nhất/nhanh nhất — gần như không phân biệt được bằng mắt) —
                // giờ 0.05-0.6, chênh lệch tới 12x, tạo cảm giác thiên hà quay CHẬM RÃI ("già cỗi")
                // rõ rệt khác hẳn thiên hà quay VÙN VỤT ("trẻ, năng động") khi đứng cạnh nhau.
                const rotationSpeed = 0.05 + Math.random() * 0.55;
                const rotation = new THREE.Euler(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
                const name = generateRandomGalaxyName(); // core

                const cluster = new GalaxyCluster(finalPos, totalSpawned, name, type, radius, starsCount, rotationDir, rotationSpeed, rotation);
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
        }
        appState.set('spNextClusterIndex', nextIdx);
        appState.set('spTotalGalaxiesSpawned', totalSpawned);

        // 3. khoá mục tiêu gần nhất phía trước — CHỈ khi KHÔNG đang khoá bởi 1 leg nhảy
        if (!appState.get('spJumpLocked') && info.nearestAheadIndex !== null) {
            appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
        }
    },
};
