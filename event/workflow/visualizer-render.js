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
 * (plan B2). Xem `_tickSpace()`/`_manageSpaceChain()` bên dưới.
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
// MỚI (21/07/2026, phản hồi Giang mục 2d) — dispose thêm theo khoảng cách NGANG khỏi trục bay
// hiện tại (xem manageGalaxyChain(), core/visualizer/types/space.js) — dọn thiên hà "lạc hướng"
// sau khi camera quay đổi hướng nhiều, tránh chuỗi phình to vô hạn.
const SPACE_CHAIN_DISPOSE_LATERAL_DISTANCE = 900;
const SPACE_CHAIN_AHEAD_MARGIN = 20;
const SPACE_CHAIN_JUMP_AHEAD_MARGIN = 50;

// ===== Hằng số tốc độ (mục 2b — CHẬM LẠI so với bản trước; mục 3 — luôn có trôi tối thiểu khi
// audio dừng) — TRƯỚC ĐÂY là 4 field vizConfig có UI slider riêng (spaceRerollThreshold/Chance,
// spaceJumpThreshold/Chance), ĐÃ BỎ UI (21/07/2026, phản hồi Giang mục 1) — giờ là hằng số cố
// định ở đây, chỉnh tay trực tiếp trong code nếu cần, không còn qua UI/vizConfig. =====
const SPACE_CAMERA_SPEED_MULT = 16;   // trước là 42 — giảm mạnh, cảm giác "trôi" chậm rãi hơn hẳn
const SPACE_BASE_SPEED_MIN = 0.45;    // trước là 0.8 — hệ số baseline khi CÓ nhạc
const SPACE_BASE_SPEED_ENERGY = 0.45; // trước là 0.8 — biên độ theo energy khi CÓ nhạc
const SPACE_IDLE_DRIFT_SPEED = 0.2;   // mục 3 — tốc độ trôi TỐI THIỂU khi KHÔNG phát nhạc (LUÔN phải có, không phụ thuộc công thức BPM/energy nữa)

// ===== Hằng số reroll hướng nhìn (mục 2c) =====
const SPACE_REROLL_THRESHOLD = 0.6;
const SPACE_REROLL_CHANCE = 0.985;
const SPACE_VIEW_LERP_FACTOR = 0.025; // trước là 0.045 — CHẬM lại, mượt hơn (đi cùng bộ với arrival-gate dưới)
// "Xoay tới nơi" (góc còn lại < ngưỡng này) MỚI được phép reroll tiếp — fix mục 2c ("chuyển động
// 360 chưa mượt... phải xoay đến vị trí target thì mới được roll sang hướng khác").
const SPACE_VIEW_ARRIVAL_ANGLE = 0.05; // radian (~2.9°)

// ===== Hằng số nhảy cụm thiên hà (mục 2a) =====
const SPACE_JUMP_THRESHOLD = 0.8;
const SPACE_JUMP_CHANCE = 0.99;
const SPACE_JUMP_BASE_DURATION = 1.6;         // giây — thời lượng CƠ SỞ của 1 cú nhảy
const SPACE_JUMP_DURATION_RANDOM_EXTRA = 1.4; // + cộng thêm random 0..1.4s (mục 2a "+ thêm một s random")

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
            // MỚI (mục 3, phản hồi 21/07/2026) — Space giờ LUÔN chạy (kể cả !isPlaying), để camera
            // luôn có 1 độ trôi tối thiểu ngay cả khi nhạc đang dừng (xem SPACE_IDLE_DRIFT_SPEED
            // bên trong _tickSpace()) — TRƯỚC ĐÂY isPlaying chỉ ảnh hưởng audio-wiring (reroll/
            // nhảy cụm), KHÔNG hề chặn bước camera, nhưng tốc độ có thể rơi về gần 0 khi năng
            // lượng nhạc tắt dần — giờ tách RÕ 2 nhánh tốc độ (có nhạc / không nhạc) để đảm bảo.
            this._tickSpace(cfg, isPlaying, newSmoothedEnergy, newGlobalHueOffset);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawFn = VISUALIZER_DRAWERS[cfg.type];
        if (drawFn) drawFn(ctx, perf, isPlaying, newBeatScale);
    },

    /**
     * Điều phối 1 frame của visual Galaxy — tự gom state, tự gọi RIÊNG LẺ từng hàm/method Core,
     * KHÔNG hàm Core nào gọi hàm Core khác (plan B2). Thứ tự: chuỗi thiên hà (theo hướng bay HIỆN
     * TẠI, mục 2d) -> nếu đang "nhảy" thì tiếp tục nội suy (mục 2a) -> nếu KHÔNG, xét audio wiring
     * (reroll mục 2c / bắt đầu nhảy mục 2a) rồi bước camera thường -> cập nhật từng thiên hà ->
     * bụi nền -> render.
     */
    _tickSpace(cfg, isPlaying, smoothedEnergy, globalHueOffset) {
        if (!appState.get('spInitialized')) return; // guard, giống hệt drawVortex()

        const spScene = appState.get('spScene');
        const spCamera = appState.get('spCamera');
        const tRenderer = appState.get('tRenderer');
        const spDustMesh = appState.get('spDustMesh');
        const spGalaxyClusters = appState.get('spGalaxyClusters'); // reference SỐNG — mọi push/splice bên dưới đều phản ánh qua biến này (cùng 1 mảng, không cần đọc lại)
        const spViewDir = appState.get('spViewDir');
        const currentCalculatedBpm = appState.get('currentCalculatedBpm');
        const rubikPitchAvg = appState.get('rubikPitchAvg');
        const lastValidMidiNote = appState.get('lastValidMidiNote');
        const beatScale = appState.get('beatScale');
        const perf = PERFORMANCE_PROFILES[cfg.quality];

        // ----- đồng hồ riêng của Galaxy (delta giây + tích luỹ globalTime cho shader uTime) -----
        const now = performance.now();
        const delta = _spLastFrameTime === null ? 0.016 : Math.min((now - _spLastFrameTime) / 1000, 0.1);
        _spLastFrameTime = now;
        _spGlobalTime += delta;

        // ----- tốc độ hành trình — 2 nhánh RÕ RỆT (mục 3): có nhạc thì theo BPM+energy (chậm lại,
        // mục 2b), KHÔNG có nhạc thì dùng SPACE_IDLE_DRIFT_SPEED cố định (LUÔN > 0) — làm mượt qua
        // `spDriftSpeed` (STATE) như cũ, cùng vai trò `tWarpSpeed` ở Vortex.
        let targetSpeed;
        if (isPlaying) {
            const bpm = parseInt(currentCalculatedBpm, 10) || 120;
            targetSpeed = (bpm / 120) * (SPACE_BASE_SPEED_MIN + smoothedEnergy * SPACE_BASE_SPEED_ENERGY);
        } else {
            targetSpeed = SPACE_IDLE_DRIFT_SPEED;
        }
        const speed = appState.get('spDriftSpeed') + (targetSpeed - appState.get('spDriftSpeed')) * 0.025;
        appState.set('spDriftSpeed', speed, { skipCheck: true });

        // ----- 1. chuỗi thiên hà: theo TRỤC HƯỚNG NHÌN HIỆN TẠI (spViewDir), KHÔNG còn trục Z cố
        // định (fix mục 2d — quay hướng khác vẫn có thiên hà sinh ra phía trước). -----
        this._manageSpaceChain(spScene, spGalaxyClusters, spCamera.position, spViewDir, cfg, perf);

        // ----- 2. đang "nhảy" cụm dở? (mục 2a) — CHỈ nội suy tiếp, KHÔNG xét reroll/nhảy MỚI, KHÔNG
        // chạy bước camera thường (updateSpaceCamera) trong lúc này. -----
        if (appState.get('spJumpActive')) {
            this._tickSpaceJump(spCamera, spGalaxyClusters, delta);
        } else {
            // ----- 2b. audio wiring: reroll hướng nhìn — CHỈ khi đã "xoay tới nơi" hướng TRƯỚC ĐÓ
            // (mục 2c — chặn reroll chồng lấp khi viewDir còn đang lerp dở). -----
            const spViewDirTarget = appState.get('spViewDirTarget');
            if (isPlaying && hasSpaceViewArrived(spViewDir, spViewDirTarget, SPACE_VIEW_ARRIVAL_ANGLE) // core
                && smoothedEnergy > SPACE_REROLL_THRESHOLD && Math.random() > SPACE_REROLL_CHANCE) {
                const pitchBias = lastValidMidiNote ? THREE.MathUtils.clamp((lastValidMidiNote - rubikPitchAvg) / 24, -0.3, 0.3) : 0;
                appState.set('spViewDirTarget', rollNewSpaceViewDirTarget(pitchBias)); // core
            }

            // ----- 2c. audio wiring: BẮT ĐẦU nhảy sang cụm kế tiếp (mục 2a) — CHỈ khi KHÔNG đang
            // nhảy dở (guard ở nhánh if/else ngoài đã đảm bảo điều đó). -----
            if (isPlaying && smoothedEnergy > SPACE_JUMP_THRESHOLD && Math.random() > SPACE_JUMP_CHANCE) {
                this._startSpaceJump(spCamera, spGalaxyClusters, spViewDir);
            }

            // ----- 2d. camera: lerp hướng nhìn hiện tại về hướng mục tiêu (CHẬM hơn trước, mục 2c),
            // rồi tiến bước theo hướng đó (CHẬM hơn trước, mục 2b). -----
            updateSpaceViewDirLerp(spViewDir, appState.get('spViewDirTarget'), SPACE_VIEW_LERP_FACTOR); // core, mutate trực tiếp spViewDir
            const targetIdx = appState.get('spCurrentTargetIndex');
            const targetGalaxy = targetIdx !== null ? spGalaxyClusters.find(g => g.index === targetIdx) : null;
            updateSpaceCamera(spCamera, spViewDir, targetGalaxy ? targetGalaxy.position : null, SPACE_CAMERA_SPEED_MULT * speed, delta); // core
        }

        // ----- 3. cập nhật từng thiên hà (Workflow tự vòng lặp, gọi RIÊNG LẺ method của từng cluster) -----
        const hueShift = (cfg.mode === 'dynamic' || cfg.mode === 'gradient') ? globalHueOffset : 0;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, speed, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 4. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 5. render -----
        renderSpaceScene(tRenderer, spScene, spCamera); // core
    },

    /**
     * BẮT ĐẦU 1 cú "nhảy" MƯỢT sang cụm thiên hà kế tiếp (mục 2a, thay teleport tức thì bản
     * trước) — chỉ tính toán điểm đến + thời lượng rồi lưu vào STATE, KHÔNG tự di chuyển camera
     * ở đây (việc nội suy MỖI FRAME nằm ở `_tickSpaceJump()`, gọi từ `_tickSpace()` những tick
     * SAU trong lúc `spJumpActive === true`).
     */
    _startSpaceJump(spCamera, spGalaxyClusters, spViewDir) {
        const aheadJump = spGalaxyClusters
            .map(g => ({ g, dist: g.position.clone().sub(spCamera.position).dot(spViewDir) }))
            .filter(o => o.dist > SPACE_CHAIN_JUMP_AHEAD_MARGIN)
            .sort((a, b) => a.dist - b.dist);
        if (aheadJump.length === 0) return; // chưa có gì đủ xa phía trước để nhảy tới — bỏ qua, thử lại tick sau

        const jumpTarget = aheadJump[Math.min(2, aheadJump.length - 1)].g;
        // Điểm đến: lùi lại 1 đoạn theo hướng NGƯỢC spViewDir tính từ lõi thiên hà mục tiêu — giữ
        // đúng tinh thần "đứng ngay trước cửa thiên hà, nhìn thẳng vào nó" của bản demo gốc, NHƯNG
        // tính theo trục bay HIỆN TẠI thay vì trục Z thế giới cố định (nhất quán với mục 2d — camera
        // giờ có thể bay hướng bất kỳ, "lùi lại theo -Z thế giới" không còn đúng nghĩa).
        const toPos = jumpTarget.position.clone().addScaledVector(spViewDir, -85);

        appState.set('spJumpFromPos', spCamera.position.clone());
        appState.set('spJumpToPos', toPos);
        appState.set('spJumpElapsed', 0);
        appState.set('spJumpDuration', SPACE_JUMP_BASE_DURATION + Math.random() * SPACE_JUMP_DURATION_RANDOM_EXTRA);
        appState.set('spCurrentTargetIndex', jumpTarget.index);
        appState.set('spJumpActive', true);
    },

    /**
     * TIẾP TỤC 1 cú "nhảy" đang chạy — nội suy vị trí camera mượt (smoothstep) theo tiến độ thời
     * gian, tự xoay camera nhìn về thiên hà mục tiêu trong suốt quá trình di chuyển. Khi đến nơi
     * (progress >= 1): tắt cờ `spJumpActive` + đồng bộ lại `spViewDir`/`spViewDirTarget` theo
     * hướng thật sự đang nhìn thiên hà mục tiêu, để camera bước tiếp MƯỢT ngay khung hình sau
     * (không bị giật hướng đột ngột khi chuyển từ "đang nhảy" sang "bay thường").
     */
    _tickSpaceJump(spCamera, spGalaxyClusters, delta) {
        const elapsed = appState.get('spJumpElapsed') + delta;
        const duration = appState.get('spJumpDuration');
        const progress = duration > 0 ? elapsed / duration : 1;

        const newPos = computeSpaceJumpPosition(appState.get('spJumpFromPos'), appState.get('spJumpToPos'), progress); // core
        spCamera.position.copy(newPos);

        const targetIdx = appState.get('spCurrentTargetIndex');
        const targetGalaxy = targetIdx !== null ? spGalaxyClusters.find(g => g.index === targetIdx) : null;
        if (targetGalaxy) spCamera.lookAt(targetGalaxy.position);

        if (progress >= 1) {
            appState.set('spJumpActive', false);
            if (targetGalaxy) {
                const arrivedDir = targetGalaxy.position.clone().sub(spCamera.position).normalize();
                appState.get('spViewDir').copy(arrivedDir);
                appState.set('spViewDirTarget', arrivedDir.clone());
            }
        } else {
            appState.set('spJumpElapsed', elapsed, { skipCheck: true });
        }
    },

    /**
     * Quản lý chuỗi thiên hà 1 tick: đọc quyết định THUẦN từ `manageGalaxyChain()` (core, chỉ
     * TÍNH TOÁN — xem docstring hàm đó), rồi TỰ thực thi (dispose/sinh mới/khoá mục tiêu) bằng
     * cách gọi RIÊNG LẺ từng hàm/method Core theo đúng thứ tự — không hàm Core nào ở đây gọi hàm
     * Core khác (plan B2/Rule 3c).
     *
     * FIX (21/07/2026, phản hồi Giang mục 2d) — sinh cụm mới giờ đo khoảng cách/hướng từ VỊ TRÍ +
     * HƯỚNG BAY HIỆN TẠI của camera (`camPos`/`forward`, KHÔNG còn trục Z thế giới cố định) — quay
     * sang hướng nào, chuỗi thiên hà tự "mọc" theo đúng hướng đó trong vài khung hình.
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
            const clusterCore = computeGalaxyClusterCore(camPos, forward, right, up, furthestAheadDist, nextIdx); // core
            nextIdx++;
            const memberCount = 2 + Math.floor(Math.random() * 2);
            for (let k = 0; k < memberCount; k++) {
                const offset = computeGalaxyMemberOffset(); // core
                const finalPos = clusterCore.clone().add(offset);
                const type = pickGalaxyType(); // core
                const palette = pickGalaxyPalette(type, cfg.mode, cfg.solidColor, cfg.dynA, cfg.dynB); // core — fix mục 4 (tôn trọng cfg.mode/solidColor)
                const radius = 65 + Math.random() * 25;
                // Snapshot lúc SPAWN (one-shot, plan B4) — mật độ sao bám theo smoothedEnergy TẠI
                // THỜI ĐIỂM sinh (KHÔNG đổi lại sau đó, "baked" vào chính thiên hà này).
                const smoothedEnergyAtSpawn = appState.get('smoothedEnergy');
                const densityRatio = THREE.MathUtils.clamp(0.3 + smoothedEnergyAtSpawn * 0.7, 0, 1);
                const starsCount = Math.round(perf.galaxyStarsMin + (perf.galaxyStarsMax - perf.galaxyStarsMin) * densityRatio);
                const rotationDir = Math.random() < 0.5 ? 1.0 : -1.0;
                const rotationSpeed = 0.12 + Math.random() * 0.16;
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

        // 3. khoá mục tiêu gần nhất phía trước (tính TRƯỚC lúc spawn — thiên hà vừa sinh luôn ở
        // rất xa phía trước, không thể là "gần nhất" ngay trong cùng frame, nên KHÔNG cần tính lại)
        if (info.nearestAheadIndex !== null) appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
    },
};
