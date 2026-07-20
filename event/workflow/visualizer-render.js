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
// Khoảng cách MỖI leg (đơn vị 3D) — gần bằng SPACE_CLUSTER_SPACING_Z (110, đã giảm mục 2 lượt 3).
const SPACE_LEG_DISTANCE = 220;
// Tốc độ (đơn vị/giây) tại 120bpm — nhân với (bpm/120) mỗi leg. TĂNG (fix mục 3, phản hồi
// 21/07/2026 lượt 3 — "tăng tốc thêm cho camera lên"), trước 26.
const SPACE_LEG_SPEED_BASE = 46;
// +-30% ngẫu nhiên thời lượng mỗi leg ("Đương nhiên phải cộng thêm giá trị ngẫu nhiên").
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// Độ lệch hướng NHẸ mỗi leg thường (radian) — "sinh ra... góc độ tiếp theo của camera", lệch DẦN
// từng chút 1 so với hướng leg trước.
const SPACE_LEG_YAW_JITTER = Math.PI * 0.16;
const SPACE_LEG_PITCH_JITTER = Math.PI * 0.10;
// % progress bắt đầu blend hướng nhìn sang leg KẾ TIẾP (đã sinh sẵn) — mượt hoá chuyển tiếp, fix
// trực tiếp nguyên nhân "hard cut" (hướng nhìn đổi ĐỘT NGỘT đúng lúc hết leg) — CƠ CHẾ NÀY giờ
// cũng chính là thứ mượt hoá luôn cả lúc BẮT ĐẦU leg nhảy (mục 1, lượt 3 — xem _startGalaxyJumpLeg).
const SPACE_LEG_BLEND_START = 0.65;
// % progress bắt đầu sinh SẴN waypoint kế tiếp ("đồng thời sinh điểm kế tiếp", mục 3).
const SPACE_LEG_PENDING_GEN_PROGRESS = 0.35;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu.
const SPACE_IDLE_LEG_SPEED = 8;

// ===== Hằng số "nhảy" sang thiên hà khác theo NỐT CAO NHẤT (mục 2, lượt 2 — luồng chèn pending
// ưu tiên VIẾT LẠI mục 1, lượt 3) =====
const SPACE_JUMP_NOTE_MARGIN = 2;
const SPACE_NOTE_PEAK_DECAY_PER_SEC = 0.6;
// "di chuyển NHANH" — nhân thêm vào tốc độ leg thường khi leg đó là leg nhảy.
const SPACE_JUMP_LEG_SPEED_MULT = 3.0;

// ===== Hằng số LUT sin quỹ đạo (MỚI, mục 4, phản hồi 21/07/2026 lượt 3) =====
const SPACE_LEG_SINE_MIN_SIZE = 1;
const SPACE_LEG_SINE_MAX_SIZE = 64; // "số lượng ngẫu nhiên từ 1-64"
const SPACE_LEG_SINE_AMPLITUDE_MIN = 10;
const SPACE_LEG_SINE_AMPLITUDE_MAX = 45; // "+ ngẫu nhiên" biên độ lệch quỹ đạo

// ===== Tốc độ tự quay của thiên hà (sao/nebula) — CỐ ĐỊNH, TÁCH HẲN khỏi tốc độ camera/BPM =====
// FIX (21/07/2026, phản hồi Giang lượt 3, mục 3 — "chỉ nói tốc độ camera sao lại chỉnh cả thiên
// hà"): TRƯỚC ĐÂY (lượt 1) dùng CHUNG 1 biến `speed` cho cả tốc độ camera LẪN tốc độ tự quay của
// sao/nebula ("miễn phí", theo plan B4 gốc) — ĐÂY chính là nguồn gốc của sự "liên quan" ngoài ý
// muốn. Lượt 2 đã tách ra dùng `bpm/120` riêng cho spin (không còn dính tốc độ CAMERA nữa), nhưng
// vẫn còn phụ thuộc BPM/nhạc. Lượt 3 CẮT ĐỨT HẲN — spin giờ là HẰNG SỐ CỐ ĐỊNH, không phụ thuộc
// BPM, không phụ thuộc tốc độ camera/leg dưới bất kỳ hình thức nào.
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
     * (mục 1/2, KHÔNG cắt ngang leg hiện tại) -> tiến hành di chuyển dọc leg -> cập nhật từng
     * thiên hà (spin CỐ ĐỊNH, mục 3) -> bụi nền -> render.
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
        // PENDING ƯU TIÊN (mục 1, KHÔNG cắt ngang leg hiện tại — xem docstring _startGalaxyJumpLeg). -----
        if (!appState.get('spJumpLocked') && isPlaying) {
            const isNewPeakNote = this._checkNewHighestNote(lastValidMidiNote, delta);
            if (isNewPeakNote) this._startGalaxyJumpLeg(spGalaxyClusters, appState.get('spCurrentTargetIndex'), legForward);
        }

        // ----- 3. tiến hành di chuyển dọc leg hiện tại (vị trí + hướng nhìn khoá roll + LUT sin) -----
        this._advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying);

        // ----- 4. cập nhật từng thiên hà — tốc độ tự quay CỐ ĐỊNH (mục 3, TÁCH HẲN khỏi camera/BPM) -----
        const hueShift = (cfg.mode === 'dynamic' || cfg.mode === 'gradient') ? globalHueOffset : 0;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, SPACE_GALAXY_SPIN_SPEED, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 5. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 6. render -----
        renderSpaceScene(tRenderer, spScene, spCamera); // core
    },

    /** Sinh 1 bộ tham số LUT sin MỚI (mục 4) — kích thước bảng NGẪU NHIÊN 1-64, biên độ NGẪU
     * NHIÊN — dùng cho MỌI leg (thường lẫn nhảy), sinh CÙNG LÚC với nextPos/forward của leg đó. */
    _generateLegSineParams() {
        const lutSize = SPACE_LEG_SINE_MIN_SIZE + Math.floor(Math.random() * (SPACE_LEG_SINE_MAX_SIZE - SPACE_LEG_SINE_MIN_SIZE + 1));
        const lut = buildSpaceLegSineLUT(lutSize); // core
        const amplitude = SPACE_LEG_SINE_AMPLITUDE_MIN + Math.random() * (SPACE_LEG_SINE_AMPLITUDE_MAX - SPACE_LEG_SINE_AMPLITUDE_MIN);
        return { lut, amplitude };
    },

    /** Tính 1 bộ (hướng, điểm đến, LUT sin) cho leg THƯỜNG kế tiếp — lệch NHẸ khỏi `currentForward`
     * (mục 3 "sinh ra... góc độ tiếp theo", KHÔNG phải chọn hướng ngẫu nhiên hoàn toàn mới). Dùng
     * chung cho cả bootstrap (leg đầu tiên) lẫn mọi lần chuyển leg thường sau này. */
    _computeNextNormalLeg(originPos, currentForward) {
        const { right, up } = computeSpaceForwardBasis(currentForward); // core
        const nextForward = generateNextSpaceLegForward(currentForward, right, up, SPACE_LEG_YAW_JITTER, SPACE_LEG_PITCH_JITTER); // core
        const nextPos = originPos.clone().addScaledVector(nextForward, SPACE_LEG_DISTANCE);
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
        appState.set('spLegDuration', SPACE_LEG_DISTANCE / SPACE_LEG_SPEED_BASE);
        appState.set('spLegSineLUT', generated.lut);
        appState.set('spLegSineAmplitude', generated.amplitude);
        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
        appState.set('spCurrentLegIsJump', false);
    },

    /**
     * Tiến 1 bước dọc leg hiện tại: nội suy vị trí THẲNG (`computeSpaceLegPosition`) rồi CỘNG THÊM
     * độ lệch theo LUT sin (mục 4 — quỹ đạo uốn lượn thay vì thẳng tắp, 2 đầu mút LUT = 0 nên vẫn
     * nối ĐÚNG vị trí waypoint). Dựng hướng camera ỔN ĐỊNH (khoá roll, `applyStableSpaceOrientation`)
     * — BLEND dần sang hướng leg KẾ TIẾP (kể cả leg đó là leg NHẢY — xem `_startGalaxyJumpLeg`) ở
     * đoạn cuối (`SPACE_LEG_BLEND_START`) để KHÔNG có cú xoay đột ngột lúc chuyển leg (fix "hard
     * cut" mục 1, CẢ lúc chuyển leg thường LẪN lúc bắt đầu leg nhảy). Khi đến nơi: snap chính xác
     * vị trí + chuyển sang leg kế tiếp (`_commitNextSpaceLeg`). Khi chưa đến: sinh SẴN waypoint kế
     * tiếp giữa chừng (mục 3 "đồng thời sinh điểm kế tiếp") — CHỈ khi KHÔNG đã có pending (thường
     * hoặc nhảy) từ trước.
     */
    _advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying) {
        const elapsed = appState.get('spLegElapsed') + delta;
        const duration = appState.get('spLegDuration');
        const progress = duration > 0 ? elapsed / duration : 1;

        const legStartPos = appState.get('spLegStartPos');
        const nextPos = appState.get('spNextPos');
        const legForward = appState.get('spLegForward');

        const straightPos = computeSpaceLegPosition(legStartPos, nextPos, progress); // core

        // Mục 4 — lệch quỹ đạo theo LUT sin (vuông góc trục leg thẳng, KHÔNG theo hướng nhìn đã blend).
        const legBasis = computeSpaceForwardBasis(legForward); // core
        const lut = appState.get('spLegSineLUT');
        const amplitude = appState.get('spLegSineAmplitude');
        const lutValue = sampleSpaceLegSineLUT(lut, progress); // core
        const finalPos = straightPos.addScaledVector(legBasis.right, lutValue * amplitude);
        spCamera.position.copy(finalPos);

        let orientForward = legForward;
        const pendingForward = appState.get('spPendingForward');
        if (pendingForward && progress > SPACE_LEG_BLEND_START) {
            const blendT = Math.min(1, (progress - SPACE_LEG_BLEND_START) / (1 - SPACE_LEG_BLEND_START));
            orientForward = legForward.clone().lerp(pendingForward, blendT).normalize();
        }
        const orientBasis = computeSpaceForwardBasis(orientForward); // core
        applyStableSpaceOrientation(spCamera, orientForward, orientBasis.right, orientBasis.up); // core — khoá roll (mục 2/3)

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
     * sinh ngay tại đây) — "kết thúc, mở khoá, lại lấy bpm hiện tại lấy làm tốc độ" (mục 3): mở
     * khoá `spJumpLocked` NẾU leg VỪA HOÀN THÀNH (tới giờ) là leg nhảy (đã THỰC SỰ tới đích B) —
     * rồi ĐỌC TƯƠI BPM hiện tại làm tốc độ cho leg MỚI, NHÂN THÊM hệ số nhanh nếu leg MỚI đó lại
     * là 1 leg nhảy khác (mục 2 "di chuyển nhanh").
     */
    _commitNextSpaceLeg(currentCalculatedBpm, isPlaying) {
        // Leg VỪA CHẠY XONG (tới giờ) là leg nhảy -> đã THỰC SỰ đến đích B -> mở khoá (mục 1 "khoá, đến -> mở khoá").
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
        if (nextIsJump) legSpeed *= SPACE_JUMP_LEG_SPEED_MULT; // "di chuyển nhanh" (mục 2)
        const distance = finishedPos.distanceTo(nextPos);
        const randomFactor = 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE; // "cộng thêm giá trị ngẫu nhiên" (mục 3)
        appState.set('spLegDuration', Math.max(0.3, (distance / legSpeed) * randomFactor));

        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
        appState.set('spPendingLegSineLUT', null);
        appState.set('spPendingIsJump', false);
        appState.set('spPendingJumpTargetIndex', null);
    },

    /**
     * Phát hiện "đỉnh nốt mới" (mục 2) — `spHighestNoteSeen` là 1 cái "trần" tự hạ dần theo thời
     * gian (`SPACE_NOTE_PEAK_DECAY_PER_SEC`); nốt hiện tại VƯỢT trần đó (cộng biên
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
     * CHÈN 1 leg "NHẢY" (mục 2) làm PENDING ƯU TIÊN — VIẾT LẠI HOÀN TOÀN (21/07/2026, phản hồi
     * Giang lượt 3, mục 1) — trước đây hàm này CẮT NGANG leg hiện tại ngay lập tức (đổi
     * `spLegForward`/`spNextPos` TỨC THÌ), khiến hướng camera SNAP đột ngột đúng lúc jump bắt đầu
     * (nguyên nhân THẬT SỰ của "hard cut": "đang ở A -> nhảy sang B -> rồi mới smooth vào" — vế
     * ĐẦU đột ngột, chỉ vế SAU mượt). VIẾT LẠI: KHÔNG đụng gì tới leg hiện tại — chỉ CHÈN kết quả
     * vào `spPendingNextPos`/`spPendingForward` (ghi đè pending thường nếu có) — cơ chế blend
     * hướng nhìn CÓ SẴN ở `_advanceSpaceLeg()` (đoạn cuối leg hiện tại, `SPACE_LEG_BLEND_START`)
     * TỰ xoay camera MƯỢT sang hướng này trước khi leg nhảy thật sự bắt đầu — KHÔNG còn cú snap
     * nào cả. Khi leg hiện tại hoàn tất tự nhiên, `_commitNextSpaceLeg()` "kích hoạt" leg nhảy này
     * với tốc độ NHANH hơn hẳn (mục 2 "di chuyển nhanh").
     *
     * "Xác định khoảng cách/góc TỪ CỤM NÀY ĐẾN CỤM KHÁC" (mục 1) — B chọn dựa trên khoảng cách/
     * hướng TỪ A (thiên hà ĐANG khoá làm mục tiêu, `spCurrentTargetIndex`), KHÔNG phải từ vị trí
     * camera hiện tại — bám đúng cấu trúc thật của sợi vũ trụ tại điểm đó (vector A->B) thay vì
     * hướng tuỳ tiện theo vị trí camera nhất thời.
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
        const sineParams = this._generateLegSineParams(); // mục 4 — sinh ĐỒNG THỜI với nextPos/next-roll của leg nhảy

        appState.set('spPendingNextPos', clusterB.position.clone());
        appState.set('spPendingForward', abDirection);
        appState.set('spPendingLegSineLUT', sineParams.lut);
        appState.set('spPendingLegSineAmplitude', sineParams.amplitude);
        appState.set('spPendingIsJump', true);
        appState.set('spPendingJumpTargetIndex', clusterB.index);

        appState.set('spJumpLocked', true); // khoá NGAY lúc CHÈN (mục 1 "chèn vào (vì ưu tiên) -> ... -> khoá")
    },

    /**
     * Quản lý chuỗi thiên hà 1 tick: đọc quyết định THUẦN từ `manageGalaxyChain()` (core, chỉ
     * TÍNH TOÁN — xem docstring hàm đó), rồi TỰ thực thi (dispose/sinh mới/khoá mục tiêu) bằng
     * cách gọi RIÊNG LẺ từng hàm/method Core theo đúng thứ tự — không hàm Core nào ở đây gọi hàm
     * Core khác (plan B2/Rule 3c).
     *
     * KHÔNG tự ý ghi đè `spCurrentTargetIndex` khi đang khoá (`spJumpLocked`) — 2 cơ chế (chain-
     * management tự khoá "gần nhất phía trước" MỖI FRAME, và jump tự khoá mục tiêu riêng) từng
     * giành nhau ghi `spCurrentTargetIndex`, là 1 phần nguyên nhân "hard cut" các lượt trước.
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
            // Số thành viên mỗi nút TĂNG (3-5, fix mục 2 "mật độ thấp") — trước 2-3.
            const memberCount = 3 + Math.floor(Math.random() * 3);
            for (let k = 0; k < memberCount; k++) {
                const offset = computeGalaxyMemberOffset(); // core
                const finalPos = clusterCore.clone().add(offset);
                const type = pickGalaxyType(); // core
                const palette = pickGalaxyPalette(cfg.mode, cfg.solidColor, cfg.dynA, cfg.dynB); // core — MỌI hình thái đều theo cfg.mode, không ngoại lệ
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

        // 3. khoá mục tiêu gần nhất phía trước — CHỈ khi KHÔNG đang khoá bởi 1 leg nhảy
        if (!appState.get('spJumpLocked') && info.nearestAheadIndex !== null) {
            appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
        }
    },
};
