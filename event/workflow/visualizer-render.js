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

// ===== Hằng số mô hình "waypoint nối tiếp" (MỚI 21/07/2026, phản hồi Giang lượt 2, mục 3 — thay
// HẲN toàn bộ hằng số spViewDir/spDriftSpeed/reroll của lượt 1) =====
// Khoảng cách MỖI leg (đơn vị 3D) — gần bằng SPACE_CLUSTER_SPACING_Z (200), hợp lý cho 1 "bước"
// giữa các cụm thiên hà liên tiếp.
const SPACE_LEG_DISTANCE = 220;
// Tốc độ (đơn vị/giây) tại 120bpm — nhân với (bpm/120) mỗi leg ("lấy bpm hiện tại làm tốc độ").
const SPACE_LEG_SPEED_BASE = 26;
// +-30% ngẫu nhiên thời lượng mỗi leg ("Đương nhiên phải cộng thêm giá trị ngẫu nhiên").
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// Độ lệch hướng NHẸ mỗi leg (radian) — "sinh ra... góc độ tiếp theo của camera", lệch DẦN từng
// chút 1 so với hướng leg trước, KHÔNG phải chọn hướng ngẫu nhiên hoàn toàn mới mỗi lần.
const SPACE_LEG_YAW_JITTER = Math.PI * 0.16;
const SPACE_LEG_PITCH_JITTER = Math.PI * 0.10;
// % progress bắt đầu blend hướng nhìn sang leg KẾ TIẾP (đã sinh sẵn) — mượt hoá chuyển tiếp, fix
// trực tiếp nguyên nhân "hard cut" mục 1 (trước đây hướng nhìn đổi ĐỘT NGỘT đúng lúc hết leg).
const SPACE_LEG_BLEND_START = 0.65;
// % progress bắt đầu sinh SẴN waypoint kế tiếp ("đồng thời sinh điểm kế tiếp", mục 3).
const SPACE_LEG_PENDING_GEN_PROGRESS = 0.35;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu (giữ nguyên yêu cầu mục
// 3 của LƯỢT 1, "kể cả khi dừng audio thì camera vẫn phải có độ trôi nhất định").
const SPACE_IDLE_LEG_SPEED = 6;

// ===== Hằng số "nhảy" sang thiên hà khác theo NỐT CAO NHẤT (MỚI 21/07/2026, phản hồi Giang lượt
// 2, mục 2 — thay HẲN ngưỡng năng lượng + random rời rạc của lượt 1) =====
// Nốt phải CAO HƠN "trần" gần nhất ít nhất ngần này (nửa cung MIDI) mới tính là "đỉnh mới".
const SPACE_JUMP_NOTE_MARGIN = 2;
// "Trần" tự hạ dần theo thời gian (nửa cung/giây) — cho phép nốt tương tự kích hoạt lại sau vài giây,
// tránh việc chạm đỉnh 1 lần rồi không bao giờ nhảy được nữa suốt phần còn lại của bài hát.
const SPACE_NOTE_PEAK_DECAY_PER_SEC = 0.6;
// "di chuyển NHANH" (mục 2) — nhân thêm vào tốc độ leg thường khi đang thực hiện cú nhảy.
const SPACE_JUMP_LEG_SPEED_MULT = 2.6;

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
     * Điều phối 1 frame của visual Galaxy — mô hình "waypoint nối tiếp" (mục 3, viết lại lần 2):
     * camera LUÔN đang bay giữa 2 điểm (`spLegStartPos` -> `spNextPos`) theo `spLegForward`, tốc
     * độ tính từ BPM lúc BẮT ĐẦU mỗi leg. Thứ tự mỗi tick: bootstrap (nếu chưa có leg) -> chuỗi
     * thiên hà (theo forward của leg HIỆN TẠI) -> kiểm tra "nốt đỉnh mới" để bắt đầu 1 leg NHẢY
     * (mục 2) -> tiến hành di chuyển dọc leg -> cập nhật từng thiên hà -> bụi nền -> render.
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

        // ----- 2. "nhảy" sang thiên hà khác — trigger bằng NỐT CAO NHẤT vừa vang lên (mục 2, KHÔNG
        // còn ngưỡng năng lượng/random) — CHỈ khi KHÔNG đang khoá (đang thực hiện 1 leg nhảy khác). -----
        if (!appState.get('spJumpLocked') && isPlaying) {
            const isNewPeakNote = this._checkNewHighestNote(lastValidMidiNote, delta);
            if (isNewPeakNote) this._startGalaxyJumpLeg(spCamera.position, spGalaxyClusters, legForward);
        }

        // ----- 3. tiến hành di chuyển dọc leg hiện tại (vị trí + hướng nhìn khoá roll) -----
        this._advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying);

        // ----- 4. cập nhật từng thiên hà (tốc độ tự quay TÁCH RIÊNG khỏi tốc độ camera — không
        // còn 1 biến `speed` DUY NHẤT dùng chung cho cả 2 như mô hình lượt 1 nữa). -----
        const hueShift = (cfg.mode === 'dynamic' || cfg.mode === 'gradient') ? globalHueOffset : 0;
        const bpmForSpin = parseInt(currentCalculatedBpm, 10) || 120;
        const spinSpeed = isPlaying ? (bpmForSpin / 120) : 0.5;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, spinSpeed, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 5. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 6. render -----
        renderSpaceScene(tRenderer, spScene, spCamera); // core
    },

    /** Tính 1 cặp (hướng, điểm đến) cho leg THƯỜNG kế tiếp — lệch NHẸ khỏi `currentForward` (mục
     * 3 "sinh ra... góc độ tiếp theo", KHÔNG phải chọn hướng ngẫu nhiên hoàn toàn mới). Dùng
     * chung cho cả bootstrap (leg đầu tiên) lẫn mọi lần chuyển leg thường sau này. */
    _computeNextNormalLeg(originPos, currentForward) {
        const { right, up } = computeSpaceForwardBasis(currentForward); // core
        const nextForward = generateNextSpaceLegForward(currentForward, right, up, SPACE_LEG_YAW_JITTER, SPACE_LEG_PITCH_JITTER); // core
        const nextPos = originPos.clone().addScaledVector(nextForward, SPACE_LEG_DISTANCE);
        return { nextForward, nextPos };
    },

    /** Sinh leg ĐẦU TIÊN lúc vừa vào 'space' — hướng khởi điểm mặc định (0,0,-1), tốc độ dùng
     * baseline 120bpm (BPM thật có thể chưa sẵn sàng ngay lúc này). */
    _beginFirstSpaceLeg(camPos) {
        const initialForward = new THREE.Vector3(0, 0, -1);
        const { nextForward, nextPos } = this._computeNextNormalLeg(camPos, initialForward);
        appState.set('spLegStartPos', camPos.clone());
        appState.set('spLegForward', nextForward);
        appState.set('spNextPos', nextPos);
        appState.set('spLegElapsed', 0);
        appState.set('spLegDuration', SPACE_LEG_DISTANCE / SPACE_LEG_SPEED_BASE);
        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
    },

    /**
     * Tiến 1 bước dọc leg hiện tại: nội suy vị trí mượt (`computeSpaceLegPosition`), dựng hướng
     * camera ỔN ĐỊNH (khoá roll, `applyStableSpaceOrientation`) — BLEND dần sang hướng leg KẾ TIẾP
     * ở đoạn cuối (`SPACE_LEG_BLEND_START`) để KHÔNG có cú xoay đột ngột lúc chuyển leg (fix "hard
     * cut" mục 1). Khi đến nơi: snap chính xác vị trí + chuyển sang leg kế tiếp
     * (`_commitNextSpaceLeg`). Khi chưa đến: sinh SẴN waypoint kế tiếp giữa chừng (mục 3 "đồng
     * thời sinh điểm kế tiếp").
     */
    _advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying) {
        const elapsed = appState.get('spLegElapsed') + delta;
        const duration = appState.get('spLegDuration');
        const progress = duration > 0 ? elapsed / duration : 1;

        const legStartPos = appState.get('spLegStartPos');
        const nextPos = appState.get('spNextPos');
        const legForward = appState.get('spLegForward');

        const newPos = computeSpaceLegPosition(legStartPos, nextPos, progress); // core
        spCamera.position.copy(newPos);

        let orientForward = legForward;
        const pendingForward = appState.get('spPendingForward');
        if (pendingForward && progress > SPACE_LEG_BLEND_START) {
            const blendT = Math.min(1, (progress - SPACE_LEG_BLEND_START) / (1 - SPACE_LEG_BLEND_START));
            orientForward = legForward.clone().lerp(pendingForward, blendT).normalize();
        }
        const { right, up } = computeSpaceForwardBasis(orientForward); // core
        applyStableSpaceOrientation(spCamera, orientForward, right, up); // core — khoá roll (mục 2)

        if (progress >= 1) {
            spCamera.position.copy(nextPos); // snap chính xác, tránh trôi dư do làm tròn số
            this._commitNextSpaceLeg(currentCalculatedBpm, isPlaying);
        } else {
            appState.set('spLegElapsed', elapsed, { skipCheck: true });
            if (progress > SPACE_LEG_PENDING_GEN_PROGRESS && !appState.get('spPendingNextPos')) {
                const generated = this._computeNextNormalLeg(nextPos, legForward);
                appState.set('spPendingNextPos', generated.nextPos);
                appState.set('spPendingForward', generated.nextForward);
            }
        }
    },

    /**
     * Hoàn tất leg hiện tại, chuyển sang leg KẾ TIẾP (đã sinh sẵn giữa chừng — nếu chưa kịp sinh,
     * ví dụ leg nhảy quá ngắn, sinh ngay tại đây) — "kết thúc, mở khoá, lại lấy bpm hiện tại lấy
     * làm tốc độ" (mục 3): mở khoá `spJumpLocked` nếu vừa hoàn thành 1 leg nhảy, rồi ĐỌC TƯƠI BPM
     * hiện tại (KHÔNG dùng giá trị cũ từ lúc leg trước bắt đầu) làm tốc độ cho leg MỚI.
     */
    _commitNextSpaceLeg(currentCalculatedBpm, isPlaying) {
        if (appState.get('spJumpLocked')) appState.set('spJumpLocked', false);

        const finishedPos = appState.get('spNextPos');
        const finishedForward = appState.get('spLegForward');
        let nextForward = appState.get('spPendingForward');
        let nextPos = appState.get('spPendingNextPos');

        if (!nextPos) {
            const generated = this._computeNextNormalLeg(finishedPos, finishedForward);
            nextForward = generated.nextForward;
            nextPos = generated.nextPos;
        }

        appState.set('spLegStartPos', finishedPos.clone());
        appState.set('spLegForward', nextForward);
        appState.set('spNextPos', nextPos);
        appState.set('spLegElapsed', 0);

        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const legSpeed = isPlaying ? SPACE_LEG_SPEED_BASE * (bpm / 120) : SPACE_IDLE_LEG_SPEED; // mục 3 lượt 1 — LUÔN có trôi tối thiểu khi dừng nhạc
        const distance = finishedPos.distanceTo(nextPos);
        const randomFactor = 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE; // "cộng thêm giá trị ngẫu nhiên" (mục 3)
        appState.set('spLegDuration', Math.max(0.3, (distance / legSpeed) * randomFactor));

        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
    },

    /**
     * Phát hiện "đỉnh nốt mới" (mục 2 — thay hẳn ngưỡng năng lượng/random lượt 1) — `spHighestNoteSeen`
     * là 1 cái "trần" tự hạ dần theo thời gian (`SPACE_NOTE_PEAK_DECAY_PER_SEC`); nốt hiện tại VƯỢT
     * trần đó (cộng biên `SPACE_JUMP_NOTE_MARGIN`) mới tính là đỉnh mới — trần tự hạ cho phép nốt
     * tương tự kích hoạt lại sau vài giây, KHÔNG bị "dùng 1 lần rồi thôi" suốt phần còn lại bài hát.
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
     * Bắt đầu 1 leg "NHẢY" sang thiên hà khác (mục 2) — chọn thiên hà GẦN NHẤT phía trước theo
     * hướng đang bay hiện tại ("kế cận của hướng đó"), rồi THAY THẾ leg hiện tại bằng 1 leg mới bắt
     * đầu từ VỊ TRÍ CAMERA HIỆN TẠI (KHÔNG teleport — vị trí liên tục, chỉ đổi ĐIỂM ĐẾN/HƯỚNG) với
     * tốc độ NHANH hơn hẳn leg thường (`SPACE_JUMP_LEG_SPEED_MULT`) — "di chuyển nhanh tới thay vì
     * jump đột ngột". Khoá `spJumpLocked` (mở lại ở `_commitNextSpaceLeg` khi leg này hoàn tất) —
     * vừa khoá không cho trigger nhảy chồng lấp, vừa khoá không cho `_manageSpaceChain()` tự ý ghi
     * đè `spCurrentTargetIndex` giữa chừng (đúng NGUYÊN NHÂN GỐC "hard cut" mục 1).
     */
    _startGalaxyJumpLeg(camPos, spGalaxyClusters, currentForward) {
        const ahead = spGalaxyClusters
            .map(g => ({ g, dist: g.position.clone().sub(camPos).dot(currentForward) }))
            .filter(o => o.dist > SPACE_CHAIN_AHEAD_MARGIN)
            .sort((a, b) => a.dist - b.dist);
        if (ahead.length === 0) return; // chưa có gì đủ gần phía trước để nhảy tới — bỏ qua, thử lại lúc đỉnh nốt kế tiếp

        const target = ahead[0].g;
        const targetPos = target.position.clone();
        const newForward = targetPos.clone().sub(camPos).normalize();

        appState.set('spLegStartPos', camPos.clone());
        appState.set('spLegForward', newForward);
        appState.set('spNextPos', targetPos);
        appState.set('spLegElapsed', 0);

        const bpm = parseInt(appState.get('currentCalculatedBpm'), 10) || 120;
        const legSpeed = SPACE_LEG_SPEED_BASE * (bpm / 120) * SPACE_JUMP_LEG_SPEED_MULT;
        const distance = camPos.distanceTo(targetPos);
        const randomFactor = 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE; // "cộng thêm giá trị ngẫu nhiên" (mục 3)
        appState.set('spLegDuration', Math.max(0.3, (distance / legSpeed) * randomFactor));

        appState.set('spPendingNextPos', null); // huỷ waypoint thường đã sinh sẵn (nếu có) — leg nhảy này thay thế hoàn toàn
        appState.set('spPendingForward', null);
        appState.set('spCurrentTargetIndex', target.index);
        appState.set('spJumpLocked', true);
    },

    /**
     * Quản lý chuỗi thiên hà 1 tick: đọc quyết định THUẦN từ `manageGalaxyChain()` (core, chỉ
     * TÍNH TOÁN — xem docstring hàm đó), rồi TỰ thực thi (dispose/sinh mới/khoá mục tiêu) bằng
     * cách gọi RIÊNG LẺ từng hàm/method Core theo đúng thứ tự — không hàm Core nào ở đây gọi hàm
     * Core khác (plan B2/Rule 3c).
     *
     * FIX (21/07/2026, phản hồi Giang lượt 2, mục 1) — KHÔNG còn tự ý ghi đè `spCurrentTargetIndex`
     * khi đang khoá (`spJumpLocked`) — đây chính là NGUYÊN NHÂN GỐC gây "hard cut" lượt trước: 2 cơ
     * chế (chain-management tự khoá "gần nhất phía trước" MỖI FRAME, và jump tự khoá mục tiêu riêng)
     * giành nhau ghi `spCurrentTargetIndex`, khiến hướng nhìn/mục tiêu đổi đột ngột giữa chừng.
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
                // FIX (21/07/2026, phản hồi Giang lượt 2, mục 4 — dứt điểm) — pickGalaxyPalette()
                // KHÔNG còn nhận `type` nữa: MỌI hình thái đều theo `cfg.mode`/`solidColor`/
                // `dynA`/`dynB`, không còn ngoại lệ 5 hình thái "đặc thù" phớt lờ setting màu.
                const palette = pickGalaxyPalette(cfg.mode, cfg.solidColor, cfg.dynA, cfg.dynB); // core
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

        // 3. khoá mục tiêu gần nhất phía trước — CHỈ khi KHÔNG đang khoá bởi 1 leg nhảy (fix mục 1)
        if (!appState.get('spJumpLocked') && info.nearestAheadIndex !== null) {
            appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
        }
    },
};
