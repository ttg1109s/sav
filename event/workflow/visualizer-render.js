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

// ===== Hằng số mô hình "waypoint nối tiếp" =====
// Khoảng cách mỗi leg thường (đơn vị 3D).
const SPACE_LEG_DISTANCE = 380;
// Tốc độ (đơn vị/giây) tại 120bpm, năng lượng trung bình — nhân với (bpm/120) VÀ hệ số năng
// lượng TỨC THỜI mỗi frame (xem _advanceSpaceLeg — fix "speed đang cài cứng lại không theo nhạc").
const SPACE_LEG_SPEED_BASE = 46;
// +-30% ngẫu nhiên tốc độ CẢ leg (1 lần lúc bắt đầu, không đổi giữa chừng — "cộng thêm giá trị
// ngẫu nhiên", TÁCH RIÊNG khỏi phần phản ứng nhạc LIÊN TỤC ở trên).
const SPACE_LEG_DURATION_RANDOM_VARIANCE = 0.3;
// Độ lệch hướng NHẸ mỗi leg thường (radian) — lệch DẦN từng chút 1 so với hướng leg trước.
const SPACE_LEG_YAW_JITTER = Math.PI * 0.16;
const SPACE_LEG_PITCH_JITTER = Math.PI * 0.10;
// % progress bắt đầu blend hướng nhìn (+ roll) sang leg KẾ TIẾP — mượt hoá chuyển tiếp, fix "hard
// cut" (hướng nhìn đổi ĐỘT NGỘT đúng lúc hết leg) — cũng chính là thứ mượt hoá lúc BẮT ĐẦU leg nhảy.
const SPACE_LEG_BLEND_START = 0.65;
// % progress bắt đầu THỬ sinh waypoint kế tiếp ("đồng thời sinh điểm kế tiếp") — "thử" vì còn phải
// qua kiểm tra mật độ (`_stageNextLeg`), không phải lúc nào cũng chốt được ngay.
const SPACE_LEG_PENDING_GEN_PROGRESS = 0.35;
// Tốc độ (đơn vị/giây) khi KHÔNG phát nhạc — LUÔN phải có trôi tối thiểu.
const SPACE_IDLE_LEG_SPEED = 8;

// ===== Hằng số "nhảy" sang thiên hà khác theo NỐT CAO NHẤT =====
const SPACE_JUMP_NOTE_MARGIN = 2;
const SPACE_NOTE_PEAK_DECAY_PER_SEC = 0.6;
// "di chuyển NHANH" — nhân thêm vào tốc độ leg thường khi leg đó là leg nhảy.
const SPACE_JUMP_LEG_SPEED_MULT = 3.0;

// ===== Roll camera theo nốt (giống Rubik, sinh ngẫu nhiên, tái sử dụng) =====
const SPACE_NOTE_ROLL_RANGE = Math.PI; // [-π, π) — ĐỦ 360°, xem phản hồi "có đảm bảo roll 360 độ không"

// Tốc độ tự quay CHUNG của thiên hà — hệ số NHÂN CHUNG nhẹ lên trên `rotationSpeed` RIÊNG của
// từng thiên hà — TÁCH HẲN khỏi tốc độ camera/BPM.
const SPACE_GALAXY_SPIN_SPEED = 0.8;

// ===== MỚI (21/07/2026, phản hồi Giang — "roll về hướng không có thiên hà nào, màn đen xì... cần
// tiên đoán trước hướng, kiểm tra mật độ... khoá toàn bộ moving... đợi thêm xong xong rồi mới mở
// khoá") — pre-spawn có kiểm tra mật độ TRƯỚC khi cam kết hướng leg kế tiếp =====
// Phạm vi kiểm tra mật độ: dọc trục (đơn vị 3D) và bán kính "nón" ngang trục.
const SPACE_PRESPAWN_CHECK_DISTANCE = 600;
const SPACE_PRESPAWN_LATERAL_RADIUS = 320;
// Số thiên hà TỐI THIỂU cần có trong vùng kiểm tra mới coi là "đủ dày", không cần bơm thêm.
const SPACE_PRESPAWN_MIN_DENSITY = 6;
// Số "nút" (3-5 thiên hà/nút) bơm thêm MỖI TICK trong lúc khoá chờ — GIỚI HẠN để trải công việc ra
// NHIỀU FRAME, tránh giật hình do sinh hàng loạt thiên hà dồn 1 lúc (đúng nguyên nhân "bỗng nhiên
// phóng đến nhanh như jump" Giang báo — trước đây có thể phải sinh ~20 nút dồn 1 frame duy nhất).
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
     * khi cam kết hướng mới (mục "roll về hướng không có thiên hà"). Thứ tự mỗi tick: bootstrap ->
     * chuỗi thiên hà (theo forward leg HIỆN TẠI) -> kiểm tra "nốt đỉnh mới" để bắt đầu quy trình
     * nhảy -> nếu đang khoá chờ mật độ, bơm thêm 1 đợt nhỏ -> tiến hành di chuyển dọc leg (LUÔN
     * chạy, "trôi nhẹ" không phụ thuộc khoá) -> cập nhật từng thiên hà -> bụi nền -> render.
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

        // ----- 2. "nhảy" sang thiên hà khác — trigger bằng NỐT CAO NHẤT vừa vang lên. -----
        if (!appState.get('spJumpLocked') && isPlaying) {
            const isNewPeakNote = this._checkNewHighestNote(lastValidMidiNote, delta);
            if (isNewPeakNote) this._startGalaxyJumpLeg(spGalaxyClusters, appState.get('spCurrentTargetIndex'), legForward, spCamera.position, cfg, perf);
        }

        // ----- 3. đang khoá chờ đủ mật độ thiên hà theo hướng ứng viên? Bơm thêm 1 đợt NHỎ. -----
        if (appState.get('spPreSpawnLocked')) {
            this._advancePreSpawn(spScene, spGalaxyClusters, spCamera.position, cfg, perf);
        }

        // ----- 4. tiến hành di chuyển dọc leg hiện tại — LUÔN chạy bất kể có đang khoá chờ mật độ
        // hay không ("trôi nhẹ", KHÔNG đứng hình chờ) — vị trí + hướng nhìn + roll khoá ổn định. -----
        this._advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy);

        // ----- 5. cập nhật từng thiên hà (tốc độ tự quay RIÊNG theo từng thiên hà) -----
        const hueShift = (cfg.mode === 'dynamic' || cfg.mode === 'gradient') ? globalHueOffset : 0;
        spGalaxyClusters.forEach(cluster => cluster.update(delta, SPACE_GALAXY_SPIN_SPEED, _spGlobalTime, hueShift, smoothedEnergy)); // core method

        // ----- 6. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, beatScale); // core

        // ----- 7. render -----
        renderSpaceScene(tRenderer, spScene, spCamera); // core
    },

    /**
     * Tra bảng `spNoteRollTable` theo nốt HIỆN TẠI, giống hệt cách Rubik tra `RUBIK_NOTE_TO_TURN`.
     * @returns {number} góc roll (radian), 0 nếu chưa detect được nốt nào hoặc bảng chưa sẵn sàng.
     */
    _pickNoteRoll() {
        const midiNote = appState.get('lastValidMidiNote');
        const table = appState.get('spNoteRollTable');
        if (!midiNote || !table) return 0;
        const noteIdx = ((midiNote % 12) + 12) % 12;
        return table[noteIdx];
    },

    /** Tra "túi xáo trộn" hình thái thiên hà (fix "hình thái phân bổ không đều, trùng lặp khá
     * nhiều") — MỌI lần spawn 1 thiên hà (dù trong `_manageSpaceChain()` hay `_advancePreSpawn()`)
     * đều PHẢI qua đây, KHÔNG gọi thẳng `pickGalaxyTypeFromBag()` riêng lẻ ở 2 nơi (tránh 2 túi
     * độc lập không đồng bộ).
     * @returns {string} */
    _pickNextGalaxyType() {
        const bag = appState.get('spGalaxyTypeBag');
        const result = pickGalaxyTypeFromBag(bag); // core
        appState.set('spGalaxyTypeBag', result.remainingBag);
        return result.type;
    },

    /** Sinh toàn bộ thành viên (3-5 thiên hà) của 1 "nút" — dùng CHUNG cho cả `_manageSpaceChain()`
     * (spawn theo hướng leg ĐANG CHẠY) LẪN `_advancePreSpawn()` (spawn theo hướng ỨNG VIÊN đang
     * chờ đủ mật độ) — tránh trùng lặp logic ở 2 nơi. */
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

    /** Tính 1 bộ (hướng, điểm đến, roll) cho leg THƯỜNG ứng viên — lệch NHẸ khỏi `currentForward`
     * ("sinh ra... góc độ tiếp theo", KHÔNG phải chọn hướng ngẫu nhiên hoàn toàn mới); roll tra
     * theo nốt hiện tại. CHỈ tính toán ứng viên — KHÔNG tự chốt thành pending (xem `_stageNextLeg`).
     */
    _computeNextNormalLeg(originPos, currentForward) {
        const { right, up } = computeSpaceForwardBasis(currentForward); // core
        const nextForward = generateNextSpaceLegForward(currentForward, right, up, SPACE_LEG_YAW_JITTER, SPACE_LEG_PITCH_JITTER); // core
        const nextPos = originPos.clone().addScaledVector(nextForward, SPACE_LEG_DISTANCE);
        const roll = this._pickNoteRoll();
        return { nextForward, nextPos, roll };
    },

    /**
     * "Tiên đoán trước hướng next roll của camera, kiểm tra tỉ lệ mật độ thiên hà vùng đó rồi mới
     * quyết định thêm hay không thêm và thêm bao nhiêu" — nhận 1 leg ỨNG VIÊN (thường hoặc nhảy),
     * kiểm tra mật độ thiên hà SẴN CÓ theo hướng đó (`assessGalaxyDensityAhead`, core, chỉ ĐẾM,
     * không tự spawn). ĐỦ dày thì CHỐT NGAY thành pending thật. CHƯA đủ thì khoá lại
     * (`spPreSpawnLocked`), lưu ứng viên vào vùng staging — `_advancePreSpawn()` tự bơm thêm dần ở
     * các tick sau. "Khoá toàn bộ moving, không sinh next pos/next roll cho trôi nhẹ" — leg ĐANG
     * CHẠY (`spLegForward`/`spNextPos`) hoàn toàn KHÔNG bị đụng — vẫn tiếp tục di chuyển bình
     * thường trong lúc khoá, chỉ có việc CHỐT HƯỚNG KẾ TIẾP là bị hoãn lại.
     */
    _stageNextLeg(candidateForward, candidateNextPos, candidateRoll, isJump, jumpTargetIndex, camPos, spGalaxyClusters, cfg, perf) {
        const density = assessGalaxyDensityAhead(spGalaxyClusters, camPos, candidateForward, SPACE_PRESPAWN_CHECK_DISTANCE, SPACE_PRESPAWN_LATERAL_RADIUS); // core
        if (density >= SPACE_PRESPAWN_MIN_DENSITY) {
            appState.set('spPendingForward', candidateForward);
            appState.set('spPendingNextPos', candidateNextPos);
            appState.set('spPendingRoll', candidateRoll);
            appState.set('spPendingIsJump', isJump);
            appState.set('spPendingJumpTargetIndex', jumpTargetIndex);
            return;
        }
        appState.set('spPreSpawnLocked', true);
        appState.set('spPreSpawnForward', candidateForward);
        appState.set('spPreSpawnNextPos', candidateNextPos);
        appState.set('spPreSpawnRoll', candidateRoll);
        appState.set('spPreSpawnIsJump', isJump);
        appState.set('spPreSpawnJumpTargetIndex', jumpTargetIndex);
    },

    /**
     * Bơm thêm thiên hà DẦN DẦN (giới hạn `SPACE_PRESPAWN_BATCH_PER_TICK` nút/tick — trải công
     * việc ra NHIỀU FRAME) theo hướng đang chờ (`spPreSpawnForward`) — fix trực tiếp "bỗng nhiên
     * lại phóng đến nhanh như jump chứ không trôi": nguyên nhân THẬT SỰ là TRƯỚC ĐÂY toàn bộ ~20
     * nút cần thiết để lấp đầy tầm nhìn bị sinh DỒN 1 LẦN trong CÙNG 1 frame ngay khi camera vừa
     * quay hướng mới — hàng chục thiên hà "nổ" ra cùng lúc trông như 1 cú jump giả. Giờ CHỈ 1
     * nút/tick, kiểm tra lại mật độ mỗi tick — ĐỦ rồi thì CHỐT thành pending thật + mở khoá.
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
            appState.set('spPendingRoll', appState.get('spPreSpawnRoll'));
            appState.set('spPendingIsJump', appState.get('spPreSpawnIsJump'));
            appState.set('spPendingJumpTargetIndex', appState.get('spPreSpawnJumpTargetIndex'));
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
        appState.set('spLegRoll', generated.roll);
        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
        appState.set('spPendingRoll', 0);
        appState.set('spCurrentLegIsJump', false);
    },

    /**
     * Tiến 1 bước dọc leg hiện tại — FIX (21/07/2026, phản hồi Giang — "speed đang cài cứng lại
     * không theo nhạc"): tốc độ tính LẠI MỖI FRAME từ BPM + `smoothedEnergy` (EMA mượt sẵn, KHÔNG
     * dùng `beatScale` thô để tránh giật/lag), CỘNG DỒN quãng đường thay vì dùng "duration" cố
     * định tính 1 lần lúc bắt đầu leg (mô hình cũ — tốc độ "đông cứng" suốt cả leg, không phản ứng
     * nhạc nữa sau khi leg đã bắt đầu).
     *
     * Vị trí nội suy THẲNG (`computeSpaceLegPosition`). Hướng camera THEO `legForward` — BLEND dần
     * sang hướng leg KẾ TIẾP (kể cả leg nhảy) ở đoạn cuối để KHÔNG có cú xoay đột ngột lúc chuyển
     * leg. Roll blend theo ĐƯỜNG NGẮN NHẤT (biên độ đã full 360°). Khi đến nơi: snap chính xác vị
     * trí + chuyển sang leg kế tiếp. Khi chưa đến, VÀ KHÔNG đang khoá chờ mật độ (`spPreSpawnLocked`),
     * VÀ chưa có pending: thử sinh + kiểm tra mật độ waypoint kế tiếp giữa chừng.
     */
    _advanceSpaceLeg(spCamera, delta, currentCalculatedBpm, isPlaying, smoothedEnergy) {
        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const randomFactor = appState.get('spLegSpeedRandomFactor');
        let legSpeed = isPlaying
            ? SPACE_LEG_SPEED_BASE * (bpm / 120) * (0.7 + smoothedEnergy * 0.6) * randomFactor
            : SPACE_IDLE_LEG_SPEED;
        if (appState.get('spCurrentLegIsJump')) legSpeed *= SPACE_JUMP_LEG_SPEED_MULT;

        const distanceCovered = appState.get('spLegDistanceCovered') + legSpeed * delta;
        const totalDistance = appState.get('spLegTotalDistance');
        const progress = totalDistance > 0 ? distanceCovered / totalDistance : 1;

        const legStartPos = appState.get('spLegStartPos');
        const nextPos = appState.get('spNextPos');
        const legForward = appState.get('spLegForward');

        const finalPos = computeSpaceLegPosition(legStartPos, nextPos, progress); // core
        spCamera.position.copy(finalPos);

        let orientForward = legForward;
        let appliedRoll = appState.get('spLegRoll');
        const pendingForward = appState.get('spPendingForward');
        if (pendingForward && progress > SPACE_LEG_BLEND_START) {
            const blendT = Math.min(1, (progress - SPACE_LEG_BLEND_START) / (1 - SPACE_LEG_BLEND_START));
            orientForward = legForward.clone().lerp(pendingForward, blendT).normalize();
            const pendingRoll = appState.get('spPendingRoll');
            let rollDelta = pendingRoll - appliedRoll;
            while (rollDelta > Math.PI) rollDelta -= Math.PI * 2;
            while (rollDelta < -Math.PI) rollDelta += Math.PI * 2;
            appliedRoll = appliedRoll + rollDelta * blendT;
        }
        const orientBasis = computeSpaceForwardBasis(orientForward); // core
        const rolledBasis = applySpaceRoll(orientBasis.right, orientBasis.up, appliedRoll); // core
        applyStableSpaceOrientation(spCamera, orientForward, rolledBasis.right, rolledBasis.up); // core — khoá ổn định

        if (progress >= 1) {
            spCamera.position.copy(nextPos); // snap chính xác vị trí
            this._commitNextSpaceLeg(currentCalculatedBpm, isPlaying);
        } else {
            appState.set('spLegDistanceCovered', distanceCovered, { skipCheck: true });
            if (progress > SPACE_LEG_PENDING_GEN_PROGRESS && !appState.get('spPendingNextPos') && !appState.get('spPreSpawnLocked')) {
                const cfg = appState.get('vizConfig');
                const perf = PERFORMANCE_PROFILES[cfg.quality];
                const candidate = this._computeNextNormalLeg(nextPos, legForward);
                this._stageNextLeg(candidate.nextForward, candidate.nextPos, candidate.roll, false, null, spCamera.position, appState.get('spGalaxyClusters'), cfg, perf);
            }
        }
    },

    /**
     * Hoàn tất leg hiện tại, chuyển sang leg KẾ TIẾP (đã chốt sẵn — nếu CHƯA (hiếm, ví dụ vẫn
     * đang khoá chờ mật độ đúng lúc leg cũ hết), sinh 1 leg "nối tiếp tạm" CÙNG hướng vừa xong,
     * KHÔNG qua kiểm tra mật độ — tránh camera đứng khựng hẳn; quá trình khoá chờ ở nền (nếu có)
     * VẪN TIẾP TỤC, sẽ chốt vào lần commit SAU) — mở khoá `spJumpLocked` NẾU leg VỪA HOÀN THÀNH là
     * leg nhảy (đã THỰC SỰ tới đích B).
     */
    _commitNextSpaceLeg(currentCalculatedBpm, isPlaying) {
        if (appState.get('spCurrentLegIsJump')) appState.set('spJumpLocked', false);

        const finishedPos = appState.get('spNextPos');
        const finishedForward = appState.get('spLegForward');
        let nextForward = appState.get('spPendingForward');
        let nextPos = appState.get('spPendingNextPos');
        let nextRoll = appState.get('spPendingRoll');
        const nextIsJump = !!appState.get('spPendingIsJump');
        const nextJumpTargetIndex = appState.get('spPendingJumpTargetIndex');

        if (!nextPos) {
            const generated = this._computeNextNormalLeg(finishedPos, finishedForward);
            nextForward = generated.nextForward;
            nextPos = generated.nextPos;
            nextRoll = generated.roll;
        }

        appState.set('spLegStartPos', finishedPos.clone());
        appState.set('spLegForward', nextForward);
        appState.set('spNextPos', nextPos);
        appState.set('spLegDistanceCovered', 0);
        appState.set('spLegTotalDistance', finishedPos.distanceTo(nextPos));
        appState.set('spLegSpeedRandomFactor', 1 + (Math.random() - 0.5) * SPACE_LEG_DURATION_RANDOM_VARIANCE); // "cộng thêm giá trị ngẫu nhiên"
        appState.set('spLegRoll', nextRoll);
        appState.set('spCurrentLegIsJump', nextIsJump);
        if (nextIsJump && nextJumpTargetIndex !== null) appState.set('spCurrentTargetIndex', nextJumpTargetIndex);

        appState.set('spPendingNextPos', null);
        appState.set('spPendingForward', null);
        appState.set('spPendingRoll', 0);
        appState.set('spPendingIsJump', false);
        appState.set('spPendingJumpTargetIndex', null);
    },

    /**
     * Phát hiện "đỉnh nốt mới" — `spHighestNoteSeen` là 1 cái "trần" tự hạ dần theo thời gian
     * (`SPACE_NOTE_PEAK_DECAY_PER_SEC`); nốt hiện tại VƯỢT trần đó (cộng biên
     * `SPACE_JUMP_NOTE_MARGIN`) mới tính là đỉnh mới.
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
     * Bắt đầu quy trình "nhảy" sang thiên hà khác — chọn thiên hà GẦN NHẤT phía trước theo hướng
     * đang bay hiện tại TÍNH TỪ A (thiên hà đang khoá làm mục tiêu), rồi ĐƯA QUA `_stageNextLeg()`
     * (kiểm tra mật độ TRƯỚC khi chốt, giống hệt leg thường) — KHÔNG còn tự ý chốt pending ngay
     * lập tức nữa. Khoá `spJumpLocked` NGAY (trước cả khi biết mật độ đủ hay chưa) — chặn trigger
     * nhảy chồng lấp trong lúc chờ.
     */
    _startGalaxyJumpLeg(spGalaxyClusters, currentTargetIndex, currentForward, camPos, cfg, perf) {
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

        appState.set('spJumpLocked', true);
        this._stageNextLeg(abDirection, clusterB.position.clone(), this._pickNoteRoll(), true, clusterB.index, camPos, spGalaxyClusters, cfg, perf);
    },

    /**
     * Quản lý chuỗi thiên hà 1 tick: đọc quyết định THUẦN từ `manageGalaxyChain()` (core), rồi TỰ
     * thực thi (dispose/sinh mới/khoá mục tiêu) — không hàm Core nào ở đây gọi hàm Core khác.
     * KHÔNG tự ý ghi đè `spCurrentTargetIndex` khi đang khoá (`spJumpLocked`).
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

        if (!appState.get('spJumpLocked') && info.nearestAheadIndex !== null) {
            appState.set('spCurrentTargetIndex', info.nearestAheadIndex);
        }
    },
};
