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
 * đang bay từ 1 điểm (`spLegStartPos`) tới điểm kế tiếp (`spNextPos`), tốc độ = BPM + năng lượng
 * nhạc TỨC THỜI mỗi frame — waypoint SAU đó được sinh sẵn giữa chừng leg hiện tại, dùng để blend
 * hướng nhìn mượt ở đoạn cuối (fix "hard cut"), có KIỂM TRA MẬT ĐỘ thiên hà trước khi cam kết
 * hướng mới (`_stageNextLeg()`/`_advancePreSpawn()`, khoá `spPreSpawnLocked` nếu chưa đủ, tránh
 * "màn đen xì" + spawn dồn cục). Cơ chế "nhảy" sang thiên hà khác (jump) ĐÃ BỎ HẲN (phản hồi
 * 21/07/2026 — "loại bỏ toàn bộ cơ chế jump"). Hướng bay MỖI leg giờ được "bẻ lái" (KHÔNG phải
 * roll cosmetic quanh trục nhìn — sửa hiểu nhầm, xem `core/webgl/three-space.js::steerSpaceForward()`)
 * theo nốt hiện tại, biên độ ĐỦ 360°. Xem `_tickSpace()`/`_advanceSpaceLeg()`/`_computeNextNormalLeg()`.
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

// ===== Hằng số mô hình "waypoint nối tiếp" =====
// Khoảng cách mỗi leg thường (đơn vị 3D).
const SPACE_LEG_DISTANCE = 380;
// Tốc độ (đơn vị/giây) tại 120bpm, năng lượng trung bình — nhân với (bpm/120) VÀ hệ số năng
// lượng TỨC THỜI mỗi frame (xem _advanceSpaceLeg — tốc độ phản ứng liên tục theo nhạc).
const SPACE_LEG_SPEED_BASE = 46;
// +-30% ngẫu nhiên tốc độ CẢ leg (1 lần lúc bắt đầu, không đổi giữa chừng — "cộng thêm giá trị
// ngẫu nhiên", TÁCH RIÊNG khỏi phần phản ứng nhạc LIÊN TỤC ở trên).
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// % progress bắt đầu blend hướng nhìn sang leg KẾ TIẾP — mượt hoá chuyển tiếp, fix "hard cut"
// (hướng nhìn đổi ĐỘT NGỘT đúng lúc hết leg).
const SPACE_LEG_BLEND_START = 0.65;
// % progress bắt đầu THỬ sinh waypoint kế tiếp ("đồng thời sinh điểm kế tiếp") — "thử" vì còn phải
// qua kiểm tra mật độ (`_stageNextLeg`), không phải lúc nào cũng chốt được ngay.
const SPACE_LEG_PENDING_GEN_PROGRESS = 0.35;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu.
const SPACE_IDLE_LEG_SPEED = 8;

// ===== "Bẻ lái" hướng bay theo nốt (VIẾT LẠI HOÀN TOÀN, 21/07/2026, phản hồi Giang — "roll... đang
// bị hiểu nhầm thành rotate 2D chứ không phải bẻ hướng di chuyển của camera theo 360 độ theo pitch
// note") — thay HẲN mô hình "roll cosmetic quanh trục nhìn" (đã bỏ) LẪN "lệch nhẹ ngẫu nhiên mỗi
// leg" (đã bỏ, generateNextSpaceLegForward()) — giờ MỖI leg mới, hướng `forward` bị XOAY THẲNG
// (steerSpaceForward(), core/webgl/three-space.js) 1 góc tra theo NỐT HIỆN TẠI, biên độ ĐỦ 360°. =====
const SPACE_NOTE_STEER_RANGE = Math.PI; // [-π, π) — ĐỦ 360°

// Tốc độ tự quay CHUNG của thiên hà — hệ số NHÂN CHUNG nhẹ lên trên `rotationSpeed` RIÊNG của
// từng thiên hà — TÁCH HẲN khỏi tốc độ camera/BPM.
const SPACE_GALAXY_SPIN_SPEED = 0.8;

// ===== Pre-spawn có kiểm tra mật độ TRƯỚC khi cam kết hướng leg kế tiếp (fix "roll về hướng không
// có thiên hà nào, màn đen xì... bỗng nhiên lại phóng đến nhanh như jump") =====
const SPACE_PRESPAWN_CHECK_DISTANCE = 600;
const SPACE_PRESPAWN_LATERAL_RADIUS = 320;
const SPACE_PRESPAWN_MIN_DENSITY = 6;
const SPACE_PRESPAWN_BATCH_PER_TICK = 1;

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
     * Điều phối 1 frame của visual Galaxy — mô hình "waypoint nối tiếp" CÓ KIỂM TRA MẬT ĐỘ trước
     * khi cam kết hướng mới. VIẾT LẠI (21/07/2026, phản hồi Giang — xoá HẲN cơ chế "nhảy" sang
     * thiên hà khác) — không còn bước kiểm tra "nốt đỉnh mới" để bắt đầu nhảy nữa, hướng bay chỉ
     * còn 1 nguồn DUY NHẤT: "bẻ lái" theo nốt mỗi khi sinh leg mới (`_computeNextNormalLeg()`).
     * Thứ tự mỗi tick: bootstrap -> chuỗi thiên hà (theo forward leg HIỆN TẠI) -> nếu đang khoá chờ
     * mật độ, bơm thêm 1 đợt nhỏ -> tiến hành di chuyển dọc leg (LUÔN chạy, "trôi nhẹ" không phụ
     * thuộc khoá) -> cập nhật từng thiên hà -> bụi nền -> render.
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
            this._beginFirstSpaceLeg(spCamera.position);
        }

        // ----- 1. chuỗi thiên hà: theo hướng leg HIỆN TẠI -----
        const legForward = appState.get('spLegForward');
        this._manageSpaceChain(spScene, spGalaxyClusters, spCamera.position, legForward, cfg, perf);

        // ----- 2. đang khoá chờ đủ mật độ thiên hà theo hướng ứng viên? Bơm thêm 1 đợt NHỎ. -----
        if (appState.get('spPreSpawnLocked')) {
            this._advancePreSpawn(spScene, spGalaxyClusters, spCamera.position, cfg, perf);
        }

        // ----- 3. tiến hành di chuyển dọc leg hiện tại — LUÔN chạy bất kể có đang khoá chờ mật độ
        // hay không ("trôi nhẹ", KHÔNG đứng hình chờ) — vị trí + hướng nhìn khoá ổn định. -----
        this._advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy);

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
     * (core/dom-refs.js) — trả về GÓC BẺ LÁI (radian), dùng để XOAY THẲNG hướng bay (KHÔNG phải
     * roll cosmetic quanh trục nhìn — xem `steerSpaceForward()`, core/webgl/three-space.js).
     * @returns {number} 0 nếu chưa detect được nốt nào hoặc bảng chưa sẵn sàng.
     */
    _pickNoteSteerAngle() {
        const midiNote = appState.get('lastValidMidiNote');
        const table = appState.get('spNoteSteerTable');
        if (!midiNote || !table) return 0;
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
        const memberCount = 3 + Math.floor(Math.random() * 3);
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
        appState.set('spTotalGalaxiesSpawned', totalSpawned);
    },

    /**
     * Tính 1 bộ (hướng, điểm đến) cho leg ứng viên KẾ TIẾP — hướng = `currentForward` XOAY THẲNG
     * (`steerSpaceForward()`, core/webgl/three-space.js) 1 góc TRA THEO NỐT HIỆN TẠI
     * (`_pickNoteSteerAngle()`) — VIẾT LẠI (21/07/2026, phản hồi Giang — "bẻ hướng di chuyển của
     * camera theo 360 độ theo pitch note", KHÔNG phải roll cosmetic hay lệch ngẫu nhiên nhỏ như
     * trước). CHỈ tính toán ứng viên — KHÔNG tự chốt thành pending (xem `_stageNextLeg`).
     */
    _computeNextNormalLeg(originPos, currentForward) {
        const { right } = computeSpaceForwardBasis(currentForward); // core
        const steerAngle = this._pickNoteSteerAngle();
        const nextForward = steerSpaceForward(currentForward, right, steerAngle); // core
        const nextPos = originPos.clone().addScaledVector(nextForward, SPACE_LEG_DISTANCE);
        return { nextForward, nextPos };
    },

    /**
     * "Tiên đoán trước hướng, kiểm tra tỉ lệ mật độ thiên hà vùng đó rồi mới quyết định thêm hay
     * không thêm và thêm bao nhiêu" — nhận 1 leg ỨNG VIÊN, kiểm tra mật độ thiên hà SẴN CÓ theo
     * hướng đó (`assessGalaxyDensityAhead`, core, chỉ ĐẾM, không tự spawn). ĐỦ dày thì CHỐT NGAY
     * thành pending thật. CHƯA đủ thì khoá lại (`spPreSpawnLocked`), lưu ứng viên vào vùng staging
     * — `_advancePreSpawn()` tự bơm thêm dần ở các tick sau. Leg ĐANG CHẠY hoàn toàn KHÔNG bị đụng
     * — vẫn tiếp tục di chuyển bình thường ("trôi nhẹ") trong lúc khoá.
     */
    _stageNextLeg(candidateForward, candidateNextPos, camPos, spGalaxyClusters, cfg, perf) {
        const density = assessGalaxyDensityAhead(spGalaxyClusters, camPos, candidateForward, SPACE_PRESPAWN_CHECK_DISTANCE, SPACE_PRESPAWN_LATERAL_RADIUS); // core
        if (density >= SPACE_PRESPAWN_MIN_DENSITY) {
            appState.set('spPendingForward', candidateForward);
            appState.set('spPendingNextPos', candidateNextPos);
            return;
        }
        appState.set('spPreSpawnLocked', true);
        appState.set('spPreSpawnForward', candidateForward);
        appState.set('spPreSpawnNextPos', candidateNextPos);
    },

    /**
     * Bơm thêm thiên hà DẦN DẦN (giới hạn `SPACE_PRESPAWN_BATCH_PER_TICK` nút/tick — trải công
     * việc ra NHIỀU FRAME, tránh giật hình do sinh hàng loạt thiên hà dồn 1 lúc) theo hướng đang
     * chờ (`spPreSpawnForward`) — kiểm tra lại mật độ mỗi tick, ĐỦ rồi thì CHỐT thành pending thật
     * + mở khoá.
     */
    _advancePreSpawn(spScene, spGalaxyClusters, camPos, cfg, perf) {
        const forward = appState.get('spPreSpawnForward');
        const { right, up } = computeSpaceForwardBasis(forward); // core
        const spGlowTexture = appState.get('spGlowTexture');
        const spNebulaTexture = appState.get('spNebulaTexture');

        let nextIdx = appState.get('spNextClusterIndex');
        for (let n = 0; n < SPACE_PRESPAWN_BATCH_PER_TICK; n++) {
            const distanceAhead = SPACE_CLUSTER_SPACING_Z * (n + 1);
            const clusterCore = computeGalaxyClusterCore(camPos, forward, right, up, distanceAhead); // core
            nextIdx++;
            this._spawnGalaxyNodeMembers(clusterCore, cfg, perf, spScene, spGlowTexture, spNebulaTexture);
        }
        appState.set('spNextClusterIndex', nextIdx);

        const density = assessGalaxyDensityAhead(spGalaxyClusters, camPos, forward, SPACE_PRESPAWN_CHECK_DISTANCE, SPACE_PRESPAWN_LATERAL_RADIUS); // core
        if (density >= SPACE_PRESPAWN_MIN_DENSITY) {
            appState.set('spPendingForward', forward);
            appState.set('spPendingNextPos', appState.get('spPreSpawnNextPos'));
            appState.set('spPreSpawnLocked', false);
        }
    },

    /** Sinh leg ĐẦU TIÊN lúc vừa vào 'space' — hướng khởi điểm mặc định (0,0,-1). KHÔNG qua kiểm
     * tra mật độ (`_stageNextLeg`) — chưa hề có thiên hà nào tồn tại nên chắc chắn sẽ khoá chờ vô
     * ích; `_manageSpaceChain()` tự lấp đầy NGAY sau đó cùng tick. */
    _beginFirstSpaceLeg(camPos) {
        const initialForward = new THREE.Vector3(0, 0, -1);
        const generated = this._computeNextNormalLeg(camPos, initialForward);
        appState.set('spLegStartPos', camPos.clone());
        appState.set('spLegForward', generated.nextForward);
        appState.set('spNextPos', generated.nextPos);
        appState.set('spLegDistanceCovered', 0);
        appState.set('spLegTotalDistance', camPos.distanceTo(generated.nextPos));
        appState.set('spLegSpeedRandomFactor', 1);
        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
    },

    /**
     * Tiến 1 bước dọc leg hiện tại — tốc độ tính LẠI MỖI FRAME từ BPM + `smoothedEnergy` (EMA mượt
     * sẵn, KHÔNG dùng `beatScale` thô để tránh giật/lag), CỘNG DỒN quãng đường thay vì "duration"
     * cố định tính 1 lần lúc bắt đầu leg.
     *
     * Vị trí nội suy THẲNG (`computeSpaceLegPosition`). Hướng camera THEO `legForward` — BLEND dần
     * sang hướng leg KẾ TIẾP (đã BAO GỒM SẴN việc bẻ lái theo nốt) ở đoạn cuối để KHÔNG có cú xoay
     * đột ngột lúc chuyển leg. Khi đến nơi: snap chính xác vị trí + chuyển sang leg kế tiếp. Khi
     * chưa đến, VÀ KHÔNG đang khoá chờ mật độ, VÀ chưa có pending: thử sinh + kiểm tra mật độ
     * waypoint kế tiếp giữa chừng.
     */
    _advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy) {
        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const randomFactor = appState.get('spLegSpeedRandomFactor');
        const legSpeed = isPlaying
            ? SPACE_LEG_SPEED_BASE * (bpm / 120) * (0.7 + smoothedEnergy * 0.6) * randomFactor
            : SPACE_IDLE_LEG_SPEED;

        const distanceCovered = appState.get('spLegDistanceCovered') + legSpeed * delta;
        const totalDistance = appState.get('spLegTotalDistance');
        const progress = totalDistance > 0 ? distanceCovered / totalDistance : 1;

        const legStartPos = appState.get('spLegStartPos');
        const nextPos = appState.get('spNextPos');
        const legForward = appState.get('spLegForward');

        const finalPos = computeSpaceLegPosition(legStartPos, nextPos, progress); // core
        spCamera.position.copy(finalPos);

        let orientForward = legForward;
        const pendingForward = appState.get('spPendingForward');
        if (pendingForward && progress > SPACE_LEG_BLEND_START) {
            const blendT = Math.min(1, (progress - SPACE_LEG_BLEND_START) / (1 - SPACE_LEG_BLEND_START));
            orientForward = legForward.clone().lerp(pendingForward, blendT).normalize();
        }
        const orientBasis = computeSpaceForwardBasis(orientForward); // core
        applyStableSpaceOrientation(spCamera, orientForward, orientBasis.right, orientBasis.up); // core — khoá ổn định, không lật roll ngoài ý muốn

        if (progress >= 1) {
            spCamera.position.copy(nextPos); // snap chính xác vị trí
            this._commitNextSpaceLeg(currentCalculatedBpm, isPlaying);
        } else {
            appState.set('spLegDistanceCovered', distanceCovered, { skipCheck: true });
            if (progress > SPACE_LEG_PENDING_GEN_PROGRESS && !appState.get('spPendingNextPos') && !appState.get('spPreSpawnLocked')) {
                const cfg = appState.get('vizConfig');
                const perf = PERFORMANCE_PROFILES[cfg.quality];
                const candidate = this._computeNextNormalLeg(nextPos, legForward);
                this._stageNextLeg(candidate.nextForward, candidate.nextPos, spCamera.position, appState.get('spGalaxyClusters'), cfg, perf);
            }
        }
    },

    /**
     * Hoàn tất leg hiện tại, chuyển sang leg KẾ TIẾP (đã chốt sẵn — nếu CHƯA, sinh 1 leg "nối tiếp
     * tạm" CÙNG hướng vừa xong, KHÔNG qua kiểm tra mật độ — tránh camera đứng khựng hẳn; quá trình
     * khoá chờ ở nền, nếu có, VẪN TIẾP TỤC, sẽ chốt vào lần commit SAU).
     */
    _commitNextSpaceLeg(currentCalculatedBpm, isPlaying) {
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
        appState.set('spLegDistanceCovered', 0);
        appState.set('spLegTotalDistance', finishedPos.distanceTo(nextPos));
        appState.set('spLegSpeedRandomFactor', 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE); // "cộng thêm giá trị ngẫu nhiên"

        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
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
            const clusterCore = computeGalaxyClusterCore(camPos, forward, right, up, furthestAheadDist); // core
            nextIdx++;
            this._spawnGalaxyNodeMembers(clusterCore, cfg, perf, spScene, spGlowTexture, spNebulaTexture);
        }
        appState.set('spNextClusterIndex', nextIdx);

        if (info.nearestAheadIndex !== null) appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
    },
};
