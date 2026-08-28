/**
 * event/workflow/visualizer-render.js — Workflow DUY NHẤT sở hữu vòng lặp render chính (thay
 * `drawVisualizer()` cũ — `core/visualizer/draw-visualizer.js`, nay đã RỖNG HẲN, vai trò dispatch
 * dời hết vào đây) — tự đăng ký task `taskManager` mode `raf` (xem `service/task-manager.js`), tự
 * `appState.get([...])` mỗi tick, tự gọi các hàm Core cần thiết theo đúng thứ tự — ĐÚNG định
 * nghĩa vai trò Workflow (đọc state rồi quyết định gọi Core nào), KHÔNG qua `eventBus`/Router
 * (đây là 1 trường hợp Workflow tự "tick" bằng `taskManager`, KHÔNG phải luồng Listener→Router
 * thông thường — xem ghi chú bổ sung ở `readme/event-bus-flow.md`).
 *
 * Điểm khởi động DUY NHẤT: `core/audio-engine.js::setupAudioContext()` gọi
 * `workflowVisualizerRender.start()` (Core gọi Workflow — vi phạm kỹ thuật đã ĐÁNH DẤU RÕ là
 * ngoại lệ đã biết, xem comment tại đó) — `taskManager.operator(name,'enabled')` tự guard chống
 * double-start nên an toàn tuyệt đối dù `setupAudioContext()` được gọi lại nhiều lần (Next/Prev/
 * chọn bài khác... — guard "chỉ chạy thật lần đầu" nằm ngay trong hàm đó).
 *
 * VISUAL CŨ (bar/rubik/vortex/black hole/rain) — gọi THẲNG, y nguyên tham số, y hệt
 * `drawVisualizer()` cũ đang làm — KHÔNG đụng logic bên trong các file `core/visualizer/types/*.js`
 * này.
 *
 * VISUAL Galaxy (`type: 'space'`) — Workflow điều phối THẬT SỰ: tự gom state, tự gọi RIÊNG LẺ
 * từng hàm/method Core của `core/webgl/three-space.js` + `core/visualizer/types/space.js` — không
 * hàm Core nào trong engine Galaxy gọi hàm Core khác, Workflow đứng NGOÀI gọi CẢ tất cả. Xem
 * `_tickSpace()` bên dưới.
 *
 * VISUAL Lighting (`type: 'lighting'`) — CÙNG khuôn Galaxy (Workflow điều phối thật, không nằm
 * trong `VISUALIZER_DRAWERS`), 2 style con qua `customEffect.lighting.lightingStyle`: 'thunder'
 * (`_tickLightingThunder()`) và 'fireworks' (`_tickLightingFireworks()`, tự gom rocket/particle —
 * `fwRockets`/`fwParticles`). Cả 2 style dùng chung hàm Core ở `core/visualizer/types/lighting.js`.
 * Xem `_tickLighting()` bên dưới.
 *
 * MÔ HÌNH GALAXY — VIẾT LẠI HOÀN TOÀN (26/08/2026, phản hồi Giang — "loại bỏ mô hình cũ, không
 * cần ý kiến"). SỬA LẠI CÙNG NGÀY (lượt 2, phản hồi Giang — tách RÕ 2 khái niệm bản đầu gộp
 * nhầm): mô hình 2 LỚP đúng nghĩa thiên văn, máy trạng thái 4 pha nối tiếp (tham khảo cách
 * `gameplayPhase` chuyển pha ở `event/workflow/gameplay.js` — 1 field STATE dạng chuỗi, mỗi
 * method Workflow tự đọc/ghi):
 *
 *   1. **`clusterRotate`** — xoay camera (vị trí KHOÁ) về hướng TÂM cụm đích (mục 2a(1)/(2)).
 *   2. **`clusterTravel`** — bay thẳng tới tâm cụm, tốc độ BPM + gia tốc beat, hướng KHOÁ (2a(3)/(4)).
 *   3. Đến tâm cụm — "mắc kẹt" trong cụm (mục 2b(1), KHÔNG phải 1 pha riêng — là việc LẶP LẠI 2
 *      pha dưới đây, chọn 1 thiên hà thành viên bất kỳ mỗi lượt — mục 2b(2)).
 *   4. **`galaxyRotate`** — xoay camera (vị trí KHOÁ) về điểm B (gần tâm thiên hà đó, lệch nhẹ).
 *   5. **`galaxyTravel`** — bay A->B->C (C = trôi tiếp từ B theo beat), ĐỒNG THỜI hướng nhìn nội
 *      suy SONG SONG từ hướng vừa bay sang NGƯỢC LẠI (quay lưng, mục 2b(5)).
 *
 * **Điều kiện "chuyển pha" cụm (mục 2c) — SỬA (26/08/2026, lượt 2, phản hồi Giang: "chuyển pha là
 * điều kiện MOVE từ cụm này sang cụm khác chứ không phải tái tạo các cụm... điều kiện là thay đổi
 * MẠNH về pha nhạc như game mode Circle dùng để rebuild map pitch")** — KHÔNG còn là "ghé đủ mọi
 * thiên hà trong cụm" (bản đầu SAI). Giờ TÁI DÙNG NGUYÊN VẸN cơ chế phát hiện chuyển pha nhạc của
 * Circle: `detectFluxTransition()` (energy/section transition, core/gameplay/engine.js) +
 * `isPhraseBoundary()` (core/gameplay/circle-mode.js) — Workflow tự tích luỹ flux/beat RIÊNG cho
 * Space (mirror `_beatFluxHistory`/`_beatsSincePhraseRefresh` của `event/workflow/gameplay.js`,
 * KHÔNG dùng chung biến với gameplay — 2 domain độc lập). Phát hiện được -> đặt cờ
 * `spClusterSwitchPending`, CHỈ THỰC SỰ đổi cụm ở điểm dừng tự nhiên kế tiếp (vừa ghé xong 1 thiên
 * hà, `_completeGalaxyVisit()`) — giống hệt cách `gameplayRefreshPending` chờ tới lúc board rỗng.
 *
 * **Quần thể cụm — tan/thêm theo nhạc (mục "cụm thiên hà có thể tan đi hoặc thêm vào theo nhạc"),
 * HOÀN TOÀN ĐỘC LẬP với việc chuyển pha ở trên** — mỗi BEAT, `_manageClusterPopulation()` có thể
 * (a) thêm 1 cụm MỚI (mờ dần HIỆN — `fadeState:'in'`) nếu năng lượng đủ cao và quần thể chưa đầy,
 * và/hoặc (b) chọn 1 cụm hiện có (KHÔNG phải cụm đang là đích) để bắt đầu TAN (mờ dần BIẾN MẤT —
 * `fadeState:'out'`) nếu quần thể chưa cạn. `_advanceClusterFades()` chạy MỖI FRAME, dispose hẳn
 * cụm nào tan xong (fadeProgress chạm 0) — KHÔNG BAO GIỜ dispose-rồi-tạo-lại hàng loạt như bản đầu
 * SAI (mục "phải phát sinh cụm MỚI rồi clear DẦN DẦN cụm cũ").
 *
 * Mọi lúc CHỈ ĐÚNG 1 pha camera chạy (KHÔNG BAO GIỜ 2 pha cùng lúc) — RIÊNG bên trong
 * `galaxyTravel`, vị trí VÀ hướng nhìn nội suy ĐỘC LẬP nhưng SONG SONG (cùng progress, mục 2b(5)).
 *
 * NẠP: SAU toàn bộ `core/visualizer/types/*.js`, `core/visualizer/draw/*.js`,
 * `core/webgl/three-vortex.js`, `core/webgl/three-space.js`, `core/audio-analysis.js`,
 * `core/gameplay/engine.js`, `core/gameplay/circle-mode.js` (cần `detectFluxTransition()`/
 * `isPhraseBoundary()` đã định nghĩa), `core/visualizer/visualizer-display.js` — xem vị trí thẻ
 * `<script>` trong index.html (đặt ngay vị trí cũ của `draw-visualizer.js`, cuối khối
 * 4-VISUALIZERS, SAU khối gameplay).
 */

const RENDER_TASK = 'visualizerRender';

// Tra cứu hàm vẽ 2D theo `vizConfig.type` — dời nguyên từ `draw-visualizer.js` cũ (đã RỖNG).
// `vortex`/`space` KHÔNG nằm trong bảng này: 2 visual đó render qua WebGL (canvas riêng), xử lý
// RIÊNG trong `_tick()` TRƯỚC khi canvas 2D được clear.
const VISUALIZER_DRAWERS = {
    'bar':        (ctx, perf) => drawBar(ctx, perf),
    'rubik':      (ctx, perf, isPlaying) => drawRubik(ctx, isPlaying),
    'black hole': (ctx, perf, isPlaying) => drawBlackHole(ctx, perf, isPlaying),
    'rain':       (ctx, perf, isPlaying) => drawRain(ctx, isPlaying)
};

// ===== Mô hình Galaxy — hằng số (VIẾT LẠI HOÀN TOÀN 26/08/2026, xem docstring đầu file) =====

// ----- Quần thể cụm (tan/thêm theo nhạc — ĐỘC LẬP với chuyển pha) -----
const SPACE_CLUSTER_INITIAL_COUNT = 5; // bootstrap — mục 2 "ban đầu chỉ tạo 5 cụm thiên hà xung quanh"
const SPACE_CLUSTER_MIN_COUNT = 3;     // không để quần thể tan xuống dưới mức này
const SPACE_CLUSTER_MAX_COUNT = 8;     // không thêm quá mức này (tránh phình vô hạn)
const SPACE_CLUSTER_FADE_IN_DURATION = 3;   // giây — cụm MỚI mờ dần hiện ra
const SPACE_CLUSTER_FADE_OUT_DURATION = 4;  // giây — cụm sắp tan mờ dần biến mất
// Chỉ XÉT thêm cụm mới khi năng lượng đủ cao (nhạc "sôi động" mới sinh thêm vũ trụ mới).
const SPACE_POPULATION_ENERGY_THRESHOLD = 0.35;
const SPACE_CLUSTER_SPAWN_CHANCE_PER_BEAT = 0.12;    // xác suất THÊM 1 cụm mỗi nhịp (khi đủ điều kiện)
const SPACE_CLUSTER_DISSOLVE_CHANCE_PER_BEAT = 0.08; // xác suất cho 1 cụm BẮT ĐẦU tan mỗi nhịp

// ----- Điều kiện "chuyển pha" cụm (mục 2c) — tái dùng detectFluxTransition()/isPhraseBoundary()
// của game mode Circle (core/gameplay/engine.js, core/gameplay/circle-mode.js). Số liệu tham khảo
// trực tiếp từ GAMEPLAY_CIRCLE_CONFIG (service/state/gameplay-runtime.js) mức "medium", chỉnh
// sectionWindow/phraseRefresh DÀI hơn 1 chút — Space cần cảm giác chuyển cảnh CHẬM/điện ảnh hơn
// nhịp game, không cần phản ứng gấp như gameplay. -----
const SPACE_ENERGY_WINDOW_BEATS = 4;
const SPACE_SECTION_WINDOW_BEATS = 12;
const SPACE_FLUX_TRANSITION_THRESHOLD = 0.5;
const SPACE_PHRASE_REFRESH_BEATS = 24;

// ----- Tốc độ di chuyển (dùng CHUNG clusterTravel/galaxyTravel, mục 2a(3)/2b(4)) -----
const SPACE_TRAVEL_SPEED_BASE = 46;     // đơn vị/giây tại 120bpm, năng lượng trung bình, KHÔNG beat.
const SPACE_IDLE_TRAVEL_SPEED = 8;      // không phát nhạc — vẫn phải trôi tối thiểu.
const SPACE_SPEED_MULTIPLIER = 2;
const SPACE_TRAVEL_SPEED_RANDOM_VARIANCE = 0.3; // +-30%, chốt 1 lần lúc BẮT ĐẦU travel.
// "Gia tốc theo beat" — beatScale (0..~1+) ĐỌC LẠI MỖI FRAME, cộng thêm vào tốc độ nền.
const SPACE_BEAT_ACCEL_FACTOR = 1.6;

// ----- Thời lượng pha ROTATE (dùng CHUNG clusterRotate/galaxyRotate) -----
const SPACE_ROTATE_MIN_DURATION = 3;
const SPACE_ROTATE_MAX_DURATION = 9;
const SPACE_ROTATE_DURATION_POWER = 0.6;
const SPACE_ROTATE_MUSIC_FACTOR_MIN = 0.5;
const SPACE_ROTATE_MUSIC_FACTOR_MAX = 2.2;

// ----- galaxyTravel — điểm B (mục 2b(2), "cho phép lệch nhẹ") -----
const SPACE_GALAXY_ARRIVAL_JITTER_MIN = 10;
const SPACE_GALAXY_ARRIVAL_JITTER_MAX = 25;

// ----- galaxyTravel — điểm C (mục 2b(2)/(5), "khoảng cách trôi từ B đến C dựa vào beat lúc đấy") -----
const SPACE_GALAXY_DRIFT_BASE_DISTANCE = 20;
const SPACE_GALAXY_DRIFT_BEAT_MULTIPLIER = 60;

const SPACE_GALAXY_SPIN_SPEED = 0.8; // tốc độ tự quay CHUNG của thiên hà.
const SPACE_DRIFT_BIN_SPREAD = 3;    // snapshot driftSpeedFactor lúc spawn.

// Biến NỘI BỘ (KHÔNG thuộc STATE, cùng kiểu với `tWarpSpeed` ở core/webgl/three-vortex.js).
let _spLastFrameTime = null;
let _spGlobalTime = 0;

// ===== Fireworks — biến NỘI BỘ (KHÔNG thuộc STATE), mirror _sp* của Space =====
let _fwLastLaunchAt = 0;
let _fwTextIndex = 0;
let _fwLastConsumedBeatTime = 0;
let _fwPendingBeatFluxSum = 0;
let _fwPendingBeatFluxCount = 0;
let _fwBeatFluxHistory = [];
let _fwBeatsSincePhraseRefresh = 0;
// Bin FFT gán cho rocket kế tiếp (mục 4, phản hồi Giang) — CỘNG DỒN mỗi lần bắn để rải đều qua 1
// dải tần thay vì luôn rơi vào 1-2 bin cố định; giới hạn trong dải bass/mid (thường có năng lượng
// ổn định hơn treble, tránh rocket luôn đọc bin gần như im lặng -> luôn nhỏ).
let _fwNextBinIndex = 0;
const FIREWORKS_SIZE_BIN_MIN = 2;
const FIREWORKS_SIZE_BIN_MAX = 40;
const FIREWORKS_ENERGY_WINDOW_BEATS = 4;
const FIREWORKS_SECTION_WINDOW_BEATS = 12;
const FIREWORKS_FLUX_TRANSITION_THRESHOLD = 0.5;
const FIREWORKS_FINALE_ROCKET_COUNT = 10;

// Tích luỹ flux/beat RIÊNG cho Space — mirror _beatFluxHistory/_beatsSincePhraseRefresh của
// event/workflow/gameplay.js (KHÔNG dùng chung, 2 domain độc lập — xem docstring đầu file).
let _spLastConsumedBeatTime = 0;
let _spPendingBeatFluxSum = 0;
let _spPendingBeatFluxCount = 0;
let _spBeatFluxHistory = [];
let _spBeatsSincePhraseRefresh = 0;

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

        const isVisualOff = cfg.visualEnabled === false;
        updateCanvasVisibility(canvas, document.getElementById('webgl-canvas'), isVisualOff); // core

        const perf = { blurMult: getActiveBlurMult() }; // core/audio-analysis.js
        if (!vizDataArray) return; // guard — audio context chưa init (giống hệt hành vi cũ)

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

        // Game Mode Circle — dùng CHUNG vòng lặp render này (KHÔNG mở RAF loop riêng cho gameplay).
        // Workflow-gọi-Workflow (KHÔNG phải Core-gọi-Core — Rule 3 không áp dụng ở đây). Đặt TRƯỚC
        // "if (isVisualOff) return;" bên dưới CÓ CHỦ Ý — layer game là DOM riêng (#gameplay-layer),
        // không phụ thuộc canvas #visualizer, phải tiếp tục chạy dù người dùng tắt Visual.
        workflowGameplay.tick(performance.now());

        // "Nốt nhạc bay lên" — luôn bật, tách khỏi isVisualOff bên dưới: phần tử DOM phụ trên
        // #record-container, không phụ thuộc canvas.
        if (isPlaying && newSmoothedEnergy > 0.3 && Math.random() > 0.6) spawnFlyingNote(); // core hiện có

        // Mọi phần dưới đây CHỈ liên quan tới việc VẼ ra canvas — bỏ qua khi visual đang tắt.
        if (isVisualOff) return;

        // ================== VISUAL CŨ — gọi THẲNG, y nguyên tham số ==================
        if (cfg.type === 'vortex') {
            drawVortex(perf, isPlaying);
        } else if (cfg.type === 'space') {
            // ================== VISUAL Galaxy — Workflow điều phối THẬT SỰ ==================
            this._tickSpace(isPlaying, newSmoothedEnergy, newGlobalHueOffset);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawFn = VISUALIZER_DRAWERS[cfg.type];
        if (drawFn) {
            drawFn(ctx, perf, isPlaying, newBeatScale);
        } else if (cfg.type === 'lighting') {
            // ================== VISUAL Lighting — Workflow điều phối style thunder/fireworks ==================
            this._tickLighting(ctx, perf, isPlaying, newBeatScale, newSmoothedEnergy, vizDataArray);
        }
    },

    _fwFlashAlpha: 0,

    /** Chọn ĐÚNG 1 style con để tick — customEffect.lighting.lightingStyle (core/custom-effect.js). */
    _tickLighting(ctx, perf, isPlaying, beatScale, smoothedEnergy, vizDataArray) {
        const cfg = getActiveEffectConfig(); // core/custom-effect.js
        if (cfg.lightingStyle === 'fireworks') {
            this._tickLightingFireworks(ctx, perf, isPlaying, beatScale, smoothedEnergy, vizDataArray, cfg);
        } else {
            this._tickLightingThunder(ctx, perf, isPlaying, smoothedEnergy, vizDataArray, cfg);
        }
    },

    /** Style "thunder" (tia sét) — đọc/ghi appState, gọi RIÊNG LẺ từng hàm Core (core/visualizer/
     * types/lighting.js). Port thuần từ drawLightning() cũ (đã xoá, vi phạm Rule 2). */
    _tickLightingThunder(ctx, perf, isPlaying, smoothedEnergy, vizDataArray, cfg) {
        const { dpr, activeLightnings } = appState.get(['dpr', 'activeLightnings']);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter';

        const energySpike = computeLightningEnergySpike(smoothedEnergy, vizDataArray); // core
        const flashAlpha = computeLightningFlashAlpha(isPlaying, energySpike, cfg.flashThreshold); // core
        drawLightingFlash(ctx, canvas.width, canvas.height, flashAlpha); // core

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
     * visualizer/types/lighting.js), cùng khuôn _tickSpace(). @param {object} perf - { blurMult } */
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
                const burst = exploder(rocket.x, rocket.y, count, power, cfg.gravity, spectrumBin);
                const scaled = applyFireworksSizeScale(applyFireworksDepth(burst, rocket.depthScale), sizeScale); // core
                burstParticles = burstParticles.concat(scaled);
                flashTarget = Math.max(flashTarget, computeFireworksFlashAlpha(beatScale, cfg.flashThreshold) * rocket.depthScale); // core — flashThreshold DÙNG CHUNG với style thunder
            } else {
                remainingRockets.push(rocket);
            }
        });

        // Nhóm "lighting" — chớp nền trước, rocket/particle vẽ đè lên sau.
        this._fwFlashAlpha = Math.max(flashTarget, this._fwFlashAlpha * 0.85);
        drawLightingFlash(ctx, canvas.width, canvas.height, this._fwFlashAlpha); // core

        remainingRockets.forEach((rocket) => drawFireworksRocket(ctx, rocket, dpr)); // core
        appState.set('fwRockets', remainingRockets, { skipCheck: true });

        const survivors = [];
        fwParticles.concat(burstParticles).forEach((particle) => {
            const status = updateFireworksParticle(particle); // core
            if (status === 'split') survivors.push(...applyFireworksDepth(splitFireworksParticle(particle), particle.depthAlpha)); // core
            else if (status === 'alive') survivors.push(particle);
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

    /** Tích luỹ flux/beat riêng cho Fireworks (mirror _updateClusterSwitchTrigger của Space) —
     * chuyển đoạn/phrase nhạc -> tự bắn 1 chuỗi "Đại Tiệc Pháo Hoa" thay nút bấm thủ công cũ.
     * Nhịp ép định kỳ (`cfg.finaleIntervalBeats`, mục 3, phản hồi Giang) giờ do Giang tự chỉnh,
     * không còn hằng số cứng. */
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
        _fwBeatsSincePhraseRefresh++;
        if (!isPlaying) return;

        const energyTransition = detectFluxTransition(_fwBeatFluxHistory, FIREWORKS_ENERGY_WINDOW_BEATS, FIREWORKS_FLUX_TRANSITION_THRESHOLD); // core (gameplay/engine.js)
        const sectionTransition = detectFluxTransition(_fwBeatFluxHistory, FIREWORKS_SECTION_WINDOW_BEATS, FIREWORKS_FLUX_TRANSITION_THRESHOLD); // core
        const phraseBoundary = isPhraseBoundary(_fwBeatsSincePhraseRefresh, cfg.finaleIntervalBeats); // core (gameplay/circle-mode.js)
        if (energyTransition || sectionTransition || phraseBoundary) {
            _fwBeatsSincePhraseRefresh = 0;
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
        const particles = explodeFireworksText(canvas.width / 2, canvas.height * 0.35, points, cfg.burstPower, 0); // core
        appState.mutate('fwParticles', (arr) => { particles.forEach((p) => arr.push(p)); }, { skipCheck: true });
    },

    /**
     * Điều phối 1 frame của visual Galaxy — máy trạng thái 4 pha (xem docstring đầu file). Thứ tự
     * mỗi tick: bootstrap (chưa có cụm nào) -> quần thể cụm (tan/thêm, ĐỘC LẬP với pha camera) ->
     * tiến hành đúng pha hiện tại -> cập nhật từng thiên hà -> bụi nền -> render.
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

        // ----- 0. bootstrap — chưa có cụm nào (lần đầu vào 'space') -----
        if (appState.get('spCurrentClusters').length === 0) {
            this._beginFirstSpaceJourney(spCamera.position, isPlaying, smoothedEnergy, currentCalculatedBpm);
        }

        // ----- quần thể cụm: tan/thêm theo nhạc + phát hiện điều kiện chuyển pha — HOÀN TOÀN
        // ĐỘC LẬP với máy trạng thái camera bên dưới (xem docstring đầu file, mục "SỬA lượt 2"). -----
        this._updateClusterSwitchTrigger(spCamera.position, isPlaying, smoothedEnergy);
        this._advanceClusterFades(delta);

        // ----- 1. tiến ĐÚNG 1 trong 4 pha (không bao giờ chạy 2 pha cùng lúc) -----
        const phase = appState.get('spPhase');
        if (phase === 'clusterRotate' || phase === 'galaxyRotate') {
            this._advanceSpaceRotate(spCamera, delta, isPlaying, smoothedEnergy, currentCalculatedBpm);
        } else if (phase === 'clusterTravel') {
            this._advanceClusterTravel(spCamera, delta, isPlaying, smoothedEnergy, currentCalculatedBpm, beatScale);
        } else {
            this._advanceGalaxyTravel(spCamera, delta, isPlaying, smoothedEnergy, currentCalculatedBpm, beatScale);
        }

        // ----- 2. cập nhật từng thiên hà (đọc LẠI sau bước quần thể — có thể vừa thêm/bớt cụm) -----
        const clusters = appState.get('spCurrentClusters');
        const spaceCfg = getEffectConfig('space'); // core/custom-effect.js
        const hueShift = (spaceCfg.mode === 'dynamic' || spaceCfg.mode === 'gradient') ? globalHueOffset : 0;
        clusters.forEach(cluster => {
            const fadeOutMultiplier = cluster.fadeState === 'out' ? cluster.fadeProgress : 1;
            cluster.galaxies.forEach(galaxy => {
                galaxy.update(delta, SPACE_GALAXY_SPIN_SPEED, _spGlobalTime, hueShift, smoothedEnergy, fadeOutMultiplier); // core method
            });
        });

        // ----- 3. bụi vũ trụ nền -----
        updateSpaceDustEachFrame(spDustMesh, spCamera.position, SPACE_DUST_RANGE, appState.get('beatScale')); // core

        // ----- 4. render -----
        renderSpaceScene(tRenderer, appState.get('spScene'), spCamera); // core
    },

    /** Lần đầu vào 'space' — dựng 5 cụm quanh vị trí camera hiện tại, chọn 1 cụm ngẫu nhiên làm
     * đích, bắt đầu pha `clusterRotate` về hướng cụm đó. */
    _beginFirstSpaceJourney(camPos, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        this._spawnClusterBatch(camPos, SPACE_CLUSTER_INITIAL_COUNT);
        const clusters = appState.get('spCurrentClusters');
        const target = clusters[Math.floor(Math.random() * clusters.length)];
        this._startClusterRotate(camPos, target, isPlaying, smoothedEnergy, currentCalculatedBpm);
    },

    /**
     * Sinh THÊM `count` cụm MỚI quanh `originPos` — KHÔNG đụng cụm đã có (xem docstring đầu file —
     * "phải phát sinh cụm MỚI rồi clear DẦN DẦN cụm cũ", KHÔNG phải dispose-rồi-tạo-lại hàng
     * loạt). Dùng cho CẢ bootstrap (`count = SPACE_CLUSTER_INITIAL_COUNT`) LẪN "thêm 1 cụm theo
     * nhạc" (`_manageClusterPopulation()`, `count = 1`). Cụm mới LUÔN bắt đầu `fadeState:'in'`
     * (mờ dần hiện ra, KHÔNG pop đột ngột — `_advanceClusterFades()` tự chuyển 'in' -> 'stable'
     * khi `fadeProgress` chạm 1).
     */
    _spawnClusterBatch(originPos, count) {
        const spScene = appState.get('spScene');
        const spGlowTexture = appState.get('spGlowTexture');
        const spNebulaTexture = appState.get('spNebulaTexture');
        const spaceCfg = getEffectConfig('space'); // core/custom-effect.js

        const newClusters = [];
        for (let i = 0; i < count; i++) {
            const position = generateSpaceClusterCenterPosition(originPos, spaceCfg.clusterDistanceMin, spaceCfg.clusterDistanceMax); // core
            const rotationDir = Math.random() < 0.5 ? 1 : -1; // "xác định... hướng quay" (mục 2a(1))
            const cluster = { id: THREE.MathUtils.generateUUID(), position, rotationDir, galaxies: [], fadeState: 'in', fadeProgress: 0 };
            this._spawnClusterGalaxies(cluster, spaceCfg, spScene, spGlowTexture, spNebulaTexture);
            newClusters.push(cluster);
        }
        appState.mutate('spCurrentClusters', arr => { newClusters.forEach(c => arr.push(c)); });
    },

    /** Sinh toàn bộ thiên hà thành viên của 1 cụm — rải quanh `cluster.position`, thiên hướng
     * theo `cluster.rotationDir` (70% cùng chiều cụm, 30% ngược — cụm "có xu hướng xoáy chung"
     * nhưng không cứng nhắc tuyệt đối).
     * @param {object} spaceCfg - getEffectConfig('space'), core/custom-effect.js */
    _spawnClusterGalaxies(cluster, spaceCfg, spScene, spGlowTexture, spNebulaTexture) {
        let totalSpawned = appState.get('spTotalGalaxiesSpawned');
        const vizDataArray = appState.get('vizDataArray');
        const galaxyCount = spaceCfg.clusterGalaxyCountMin + Math.floor(Math.random() * (spaceCfg.clusterGalaxyCountMax - spaceCfg.clusterGalaxyCountMin + 1));

        for (let k = 0; k < galaxyCount; k++) {
            const offset = computeSpaceRandomOffset(spaceCfg.clusterSpreadRadius * 0.4, spaceCfg.clusterSpreadRadius); // core
            const finalPos = cluster.position.clone().add(offset);
            const type = this._pickNextGalaxyType();
            const palette = pickGalaxyPalette(spaceCfg.mode, spaceCfg.solidColor, spaceCfg.dynA, spaceCfg.dynB); // core
            const radius = 65 + Math.random() * 25;
            // Snapshot lúc SPAWN (one-shot) — mật độ sao bám theo smoothedEnergy TẠI THỜI ĐIỂM
            // sinh (KHÔNG đổi lại sau đó, "baked" vào chính thiên hà này).
            const smoothedEnergyAtSpawn = appState.get('smoothedEnergy');
            const densityRatio = THREE.MathUtils.clamp(0.3 + smoothedEnergyAtSpawn * 0.7, 0, 1);
            const starsCount = Math.round(spaceCfg.starCountMin + (spaceCfg.starCountMax - spaceCfg.starCountMin) * densityRatio);
            const rotationDir = Math.random() < 0.7 ? cluster.rotationDir : -cluster.rotationDir;
            const rotationSpeed = 0.05 + Math.random() * 0.55;
            const rotation = new THREE.Euler(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
            const name = generateRandomGalaxyName(); // core

            // Snapshot 1 dải bin `vizDataArray` NGAY LÚC SPAWN, mỗi thiên hà "bốc" 1 vùng phổ khác
            // nhau theo thứ tự spawn (tham khảo cách Vortex đọc vizDataArray[idx % bufferLength]).
            const binIndex = (vizDataArray && vizDataArray.length > 0) ? (totalSpawned * 7) % vizDataArray.length : -1;
            const driftSpeedFactor = binIndex >= 0 ? computeGalaxyDriftSpeedFactor(vizDataArray, binIndex, SPACE_DRIFT_BIN_SPREAD) : 1; // core

            const galaxy = new SpaceGalaxy(finalPos, totalSpawned, name, type, radius, starsCount, rotationDir, rotationSpeed, rotation, driftSpeedFactor);
            totalSpawned++;

            const genFn = GALAXY_GENERATORS[type]; // bảng dữ liệu (three-space.js) — Workflow tự tra + tự gọi
            const positions = new Float32Array(starsCount * 3);
            const colors = new Float32Array(starsCount * 3);
            const sizes = new Float32Array(starsCount);
            const geomConfig = buildGalaxyGeometryConfig(radius); // core
            const colorIn = new THREE.Color(palette.in);
            const colorOut = new THREE.Color(palette.out);
            for (let i = 0; i < starsCount; i++) genFn(positions, colors, sizes, i, geomConfig, colorIn, colorOut);

            galaxy.build(positions, colors, sizes, spGlowTexture, spScene); // core method
            galaxy.buildNebula(colorOut, spNebulaTexture, spaceCfg.nebulaCount); // core method

            cluster.galaxies.push(galaxy);
        }
        appState.set('spTotalGalaxiesSpawned', totalSpawned);
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

    // =========================================================================================
    // QUẦN THỂ CỤM — tan/thêm theo nhạc + phát hiện điều kiện chuyển pha (mục 2c). 2 việc ĐỘC
    // LẬP nhau (xem docstring đầu file) nhưng gộp trong 1 nhịp "MỖI BEAT" cho tiện — KHÔNG có
    // nghĩa là "cùng 1 điều kiện": _updateClusterSwitchTrigger() chỉ ĐẶT CỜ chuyển pha (tiêu thụ
    // ở _completeGalaxyVisit()), _manageClusterPopulation() tự thêm/bắt đầu tan cụm NGAY LẬP TỨC.
    // =========================================================================================

    /**
     * Tích luỹ flux/beat RIÊNG cho Space (mirror `_beatFluxHistory`/`_beatsSincePhraseRefresh`
     * của `event/workflow/gameplay.js`) — MỖI FRAME cộng dồn `fluxHistory` (global, đã tính sẵn ở
     * core/audio-analysis.js) vào bộ đệm; MỖI BEAT MỚI (so `lastBeatTime` global, KHÔNG thuộc
     * appState — core/dom-refs.js) mới thực sự chốt 1 mốc + xét điều kiện chuyển pha
     * (`detectFluxTransition()`/`isPhraseBoundary()`, core/gameplay/) VÀ quản lý quần thể cụm.
     */
    _updateClusterSwitchTrigger(camPos, isPlaying, smoothedEnergy) {
        const fluxHistory = appState.get('fluxHistory');
        if (fluxHistory.length > 0) {
            _spPendingBeatFluxSum += fluxHistory[fluxHistory.length - 1];
            _spPendingBeatFluxCount++;
        }

        const isNewBeat = lastBeatTime > 0 && lastBeatTime !== _spLastConsumedBeatTime;
        if (!isNewBeat) return;
        _spLastConsumedBeatTime = lastBeatTime;

        if (_spPendingBeatFluxCount > 0) {
            _spBeatFluxHistory.push(_spPendingBeatFluxSum / _spPendingBeatFluxCount);
            if (_spBeatFluxHistory.length > 24) _spBeatFluxHistory.shift();
        }
        _spPendingBeatFluxSum = 0;
        _spPendingBeatFluxCount = 0;
        _spBeatsSincePhraseRefresh++;

        if (!appState.get('spClusterSwitchPending')) {
            const energyTransition = detectFluxTransition(_spBeatFluxHistory, SPACE_ENERGY_WINDOW_BEATS, SPACE_FLUX_TRANSITION_THRESHOLD); // core (gameplay/engine.js)
            const sectionTransition = detectFluxTransition(_spBeatFluxHistory, SPACE_SECTION_WINDOW_BEATS, SPACE_FLUX_TRANSITION_THRESHOLD); // core
            const phraseBoundary = isPhraseBoundary(_spBeatsSincePhraseRefresh, SPACE_PHRASE_REFRESH_BEATS); // core (gameplay/circle-mode.js)
            if (energyTransition || sectionTransition || phraseBoundary) {
                appState.set('spClusterSwitchPending', true, { skipCheck: true });
                _spBeatsSincePhraseRefresh = 0;
            }
        }

        this._manageClusterPopulation(camPos, isPlaying, smoothedEnergy);
    },

    /** Thêm 1 cụm MỚI (nếu đủ điều kiện) và/hoặc bắt đầu cho 1 cụm hiện có TAN (nếu đủ điều
     * kiện) — chạy mỗi BEAT, HOÀN TOÀN ĐỘC LẬP với việc chuyển pha camera. */
    _manageClusterPopulation(camPos, isPlaying, smoothedEnergy) {
        const clusters = appState.get('spCurrentClusters');

        if (isPlaying && smoothedEnergy > SPACE_POPULATION_ENERGY_THRESHOLD
            && clusters.length < SPACE_CLUSTER_MAX_COUNT
            && Math.random() < SPACE_CLUSTER_SPAWN_CHANCE_PER_BEAT) {
            this._spawnClusterBatch(camPos, 1);
        }

        const liveCount = appState.get('spCurrentClusters').filter(c => c.fadeState !== 'out').length;
        if (liveCount > SPACE_CLUSTER_MIN_COUNT && Math.random() < SPACE_CLUSTER_DISSOLVE_CHANCE_PER_BEAT) {
            const targetCluster = appState.get('spTargetCluster');
            const eligible = appState.get('spCurrentClusters').filter(c => c.fadeState === 'stable' && c !== targetCluster);
            if (eligible.length > 0) {
                eligible[Math.floor(Math.random() * eligible.length)].fadeState = 'out';
            }
        }
    },

    /** Tiến fade-in/fade-out của mọi cụm — 'in' tăng dần tới 1 rồi chuyển 'stable'; 'out' giảm
     * dần tới 0 rồi dispose hẳn (loại khỏi `spCurrentClusters`). Chạy MỖI FRAME (KHÔNG chỉ theo
     * beat — mờ dần phải mượt). */
    _advanceClusterFades(delta) {
        const clusters = appState.get('spCurrentClusters');
        const spScene = appState.get('spScene');
        const remaining = [];
        let anyDisposed = false;

        clusters.forEach(cluster => {
            if (cluster.fadeState === 'in') {
                cluster.fadeProgress = Math.min(1, cluster.fadeProgress + delta / SPACE_CLUSTER_FADE_IN_DURATION);
                if (cluster.fadeProgress >= 1) cluster.fadeState = 'stable';
                remaining.push(cluster);
            } else if (cluster.fadeState === 'out') {
                cluster.fadeProgress = Math.max(0, cluster.fadeProgress - delta / SPACE_CLUSTER_FADE_OUT_DURATION);
                if (cluster.fadeProgress <= 0) {
                    cluster.galaxies.forEach(g => g.dispose(spScene)); // core method
                    anyDisposed = true;
                } else {
                    remaining.push(cluster);
                }
            } else {
                remaining.push(cluster);
            }
        });

        if (anyDisposed) appState.set('spCurrentClusters', remaining);
    },

    /**
     * Bắt đầu pha `clusterRotate` (mục 2a(1)/(2)) — ghi cụm đích, xoay hướng nhìn HIỆN TẠI về
     * hướng tâm cụm đó. `spForward` chưa từng có giá trị (lần đầu tuyệt đối) -> mặc định (0,0,-1).
     */
    _startClusterRotate(camPos, targetCluster, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        appState.set('spTargetCluster', targetCluster);
        appState.set('spPhase', 'clusterRotate');
        const fromForward = appState.get('spForward') || new THREE.Vector3(0, 0, -1);
        const toForward = targetCluster.position.clone().sub(camPos).normalize();
        this._beginRotatePhase(fromForward, toForward, isPlaying, smoothedEnergy, currentCalculatedBpm);
    },

    /**
     * Bắt đầu pha `galaxyRotate` (mục 2b(2)/(3)) — chốt điểm B (tâm thiên hà + lệch nhẹ NGAY lúc
     * này, TÁI SỬ DỤNG nguyên vẹn cho cả pha `galaxyTravel` kế tiếp qua `spGalaxyTravelMidPos` —
     * đảm bảo hướng xoay tới VÀ hướng bay tới khớp ĐÚNG 1 điểm, không tính lại 2 lần khác nhau).
     */
    _startGalaxyRotate(camPos, targetGalaxy, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const jitter = computeSpaceRandomOffset(SPACE_GALAXY_ARRIVAL_JITTER_MIN, SPACE_GALAXY_ARRIVAL_JITTER_MAX); // core
        const pointB = targetGalaxy.position.clone().add(jitter);
        appState.set('spTargetGalaxy', targetGalaxy);
        appState.set('spGalaxyTravelMidPos', pointB);
        appState.set('spPhase', 'galaxyRotate');
        const fromForward = appState.get('spForward');
        const toForward = pointB.clone().sub(camPos).normalize();
        this._beginRotatePhase(fromForward, toForward, isPlaying, smoothedEnergy, currentCalculatedBpm);
    },

    /** Thiết lập chung cho pha ROTATE (dùng bởi CẢ `_startClusterRotate()`/`_startGalaxyRotate()`)
     * — thời lượng power-law theo góc lệch, nhân hệ số nhạc (BPM/energy). */
    _beginRotatePhase(fromForward, toForward, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const angleDeg = computeAngleBetweenForwards(fromForward, toForward); // core
        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const musicSpeedFactor = isPlaying
            ? THREE.MathUtils.clamp((bpm / 120) * (0.7 + smoothedEnergy * 0.6), SPACE_ROTATE_MUSIC_FACTOR_MIN, SPACE_ROTATE_MUSIC_FACTOR_MAX)
            : 1;
        const duration = computeSpaceRotateDuration(angleDeg, SPACE_ROTATE_MIN_DURATION, SPACE_ROTATE_MAX_DURATION, SPACE_ROTATE_DURATION_POWER, musicSpeedFactor); // core

        appState.set('spRotateFromForward', fromForward);
        appState.set('spRotateToForward', toForward);
        appState.set('spRotateElapsed', 0);
        appState.set('spRotateDuration', duration);
    },

    /** Tiến 1 bước dọc pha ROTATE (dùng CHUNG `clusterRotate`/`galaxyRotate`) — vị trí camera
     * KHOÁ NGUYÊN, chỉ hướng nhìn nội suy dần (slerp). Xoay xong: `spForward` = chính xác hướng
     * đích, bắt đầu ĐÚNG pha TRAVEL tương ứng (đọc lại `spPhase` để biết đang ở cấp cụm hay thiên
     * hà). */
    _advanceSpaceRotate(spCamera, delta, isPlaying, smoothedEnergy, currentCalculatedBpm) {
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
            const phase = appState.get('spPhase');
            if (phase === 'clusterRotate') {
                this._startClusterTravel(spCamera.position.clone(), toForward.clone(), isPlaying, smoothedEnergy, currentCalculatedBpm);
            } else {
                this._startGalaxyTravel(spCamera.position.clone(), toForward.clone(), isPlaying, smoothedEnergy, currentCalculatedBpm);
            }
        } else {
            appState.set('spRotateElapsed', elapsed, { skipCheck: true });
        }
    },

    /** Bắt đầu pha `clusterTravel` (mục 2a(3)/(4)) — 1 đoạn thẳng A->tâm cụm đích, hướng bay
     * KHOÁ (đã xoay xong ở `clusterRotate`). */
    _startClusterTravel(fromPos, forward, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const targetCluster = appState.get('spTargetCluster');
        appState.set('spPhase', 'clusterTravel');
        appState.set('spForward', forward);
        appState.set('spTravelStartPos', fromPos.clone());
        appState.set('spTravelNextPos', targetCluster.position.clone());
        appState.set('spTravelDistanceCovered', 0);
        appState.set('spTravelTotalDistance', fromPos.distanceTo(targetCluster.position));
        appState.set('spTravelSpeedRandomFactor', 1 + (Math.random() - 0.5) * SPACE_TRAVEL_SPEED_RANDOM_VARIANCE);
    },

    /** Tiến 1 bước dọc pha `clusterTravel` — tốc độ = BPM hiện tại (baseline) + gia tốc theo beat
     * (đọc lại MỖI FRAME, KHÔNG khoá). Đến tâm cụm (progress>=1): snap vị trí, vào "mắc kẹt" trong
     * cụm (`_enterClusterStuckPhase()` — chọn thiên hà đầu tiên để ghé, mục 2b(1)/(2)). */
    _advanceClusterTravel(spCamera, delta, isPlaying, smoothedEnergy, currentCalculatedBpm, beatScale) {
        const startPos = appState.get('spTravelStartPos');
        const nextPos = appState.get('spTravelNextPos');
        const totalDistance = appState.get('spTravelTotalDistance');
        const randomFactor = appState.get('spTravelSpeedRandomFactor');

        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const baseSpeed = isPlaying
            ? SPACE_TRAVEL_SPEED_BASE * (bpm / 120) * (0.7 + smoothedEnergy * 0.6)
            : SPACE_IDLE_TRAVEL_SPEED;
        const speed = baseSpeed * randomFactor * (1 + beatScale * SPACE_BEAT_ACCEL_FACTOR) * SPACE_SPEED_MULTIPLIER;

        const distanceCovered = appState.get('spTravelDistanceCovered') + speed * delta;
        const progress = totalDistance > 0 ? distanceCovered / totalDistance : 1;

        const finalPos = computeSpaceSegmentPosition(startPos, nextPos, progress); // core
        spCamera.position.copy(finalPos);

        const forward = appState.get('spForward');
        const orientBasis = computeSpaceForwardBasis(forward); // core
        applyStableSpaceOrientation(spCamera, forward, orientBasis.right, orientBasis.up); // core

        if (progress >= 1) {
            spCamera.position.copy(nextPos);
            appState.set('spTravelDistanceCovered', totalDistance, { skipCheck: true });
            this._enterClusterStuckPhase(spCamera.position, isPlaying, smoothedEnergy, currentCalculatedBpm);
        } else {
            appState.set('spTravelDistanceCovered', distanceCovered, { skipCheck: true });
        }
    },

    /** Vừa "rơi vào tâm cụm" (mục 2b(1) — "mắc kẹt = ổn định") — KHÔNG phải 1 pha riêng, chỉ là
     * bước chuyển tiếp: chọn NGẪU NHIÊN 1 thiên hà thành viên bất kỳ rồi bắt đầu `galaxyRotate`. */
    _enterClusterStuckPhase(camPos, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const targetCluster = appState.get('spTargetCluster');
        const nextGalaxy = targetCluster.galaxies[Math.floor(Math.random() * targetCluster.galaxies.length)];
        this._startGalaxyRotate(camPos, nextGalaxy, isPlaying, smoothedEnergy, currentCalculatedBpm);
    },

    /** Bắt đầu pha `galaxyTravel` (mục 2b(4)/(5)) — quãng đường A->B->C (B = `spGalaxyTravelMidPos`
     * đã chốt sẵn ở `_startGalaxyRotate()`; C tính NGAY ở đây, "trôi" tiếp từ B theo beat HIỆN
     * TẠI). Hướng nhìn nội suy SONG SONG (độc lập vị trí) từ hướng vừa bay (A->B) sang chính
     * NGƯỢC LẠI — quay lưng, đúng mục "đồng thời camera phải quay ngược lại chính hướng vừa đi". */
    _startGalaxyTravel(fromPos, forward, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const pointB = appState.get('spGalaxyTravelMidPos');
        const beatScale = appState.get('beatScale');
        const pointC = computeSpaceDriftPoint(fromPos, pointB, SPACE_GALAXY_DRIFT_BASE_DISTANCE, beatScale, SPACE_GALAXY_DRIFT_BEAT_MULTIPLIER); // core

        appState.set('spPhase', 'galaxyTravel');
        appState.set('spForward', forward);
        appState.set('spTravelStartPos', fromPos.clone());
        appState.set('spTravelNextPos', pointC);
        appState.set('spTravelDistanceCovered', 0);
        appState.set('spTravelTotalDistance', fromPos.distanceTo(pointB) + pointB.distanceTo(pointC));
        appState.set('spTravelSpeedRandomFactor', 1 + (Math.random() - 0.5) * SPACE_TRAVEL_SPEED_RANDOM_VARIANCE);

        appState.set('spGalaxyTravelFromForward', forward);
        appState.set('spGalaxyTravelToForward', forward.clone().negate());
    },

    /** Tiến 1 bước dọc pha `galaxyTravel` — 2 đoạn nối tiếp A->B->C, chia theo TỈ LỆ khoảng cách
     * từng đoạn trên tổng quãng đường. SONG SONG: hướng nhìn nội suy ĐỘC LẬP theo ĐÚNG progress
     * tổng (mục 2b(5) chỉ nói "đồng thời", không tách riêng theo đoạn). Đến C (progress>=1): ghi
     * nhận đã ghé xong 1 thiên hà (`_completeGalaxyVisit()`). */
    _advanceGalaxyTravel(spCamera, delta, isPlaying, smoothedEnergy, currentCalculatedBpm, beatScale) {
        const startPos = appState.get('spTravelStartPos');
        const midPos = appState.get('spGalaxyTravelMidPos');
        const endPos = appState.get('spTravelNextPos'); // điểm C
        const totalDistance = appState.get('spTravelTotalDistance');
        const randomFactor = appState.get('spTravelSpeedRandomFactor');

        const bpm = parseInt(currentCalculatedBpm, 10) || 120;
        const baseSpeed = isPlaying
            ? SPACE_TRAVEL_SPEED_BASE * (bpm / 120) * (0.7 + smoothedEnergy * 0.6)
            : SPACE_IDLE_TRAVEL_SPEED;
        const speed = baseSpeed * randomFactor * (1 + beatScale * SPACE_BEAT_ACCEL_FACTOR) * SPACE_SPEED_MULTIPLIER;

        const distanceCovered = appState.get('spTravelDistanceCovered') + speed * delta;
        const progress = totalDistance > 0 ? distanceCovered / totalDistance : 1;
        const clampedProgress = Math.min(1, progress);

        const distAB = startPos.distanceTo(midPos);
        const segmentRatio = totalDistance > 0 ? distAB / totalDistance : 0.5;
        let finalPos;
        if (clampedProgress <= segmentRatio) {
            const segProgress = segmentRatio > 0 ? clampedProgress / segmentRatio : 1;
            finalPos = computeSpaceSegmentPosition(startPos, midPos, segProgress); // core
        } else {
            const segProgress = segmentRatio < 1 ? (clampedProgress - segmentRatio) / (1 - segmentRatio) : 1;
            finalPos = computeSpaceSegmentPosition(midPos, endPos, segProgress); // core
        }
        spCamera.position.copy(finalPos);

        const eased = clampedProgress * clampedProgress * (3 - 2 * clampedProgress); // smoothstep — CÙNG progress tổng
        const fromForward = appState.get('spGalaxyTravelFromForward');
        const toForward = appState.get('spGalaxyTravelToForward');
        const currentForward = computeSpaceRotateForward(fromForward, toForward, eased); // core
        appState.set('spForward', currentForward, { skipCheck: true });
        const orientBasis = computeSpaceForwardBasis(currentForward); // core
        applyStableSpaceOrientation(spCamera, currentForward, orientBasis.right, orientBasis.up); // core

        if (progress >= 1) {
            spCamera.position.copy(endPos);
            appState.set('spTravelDistanceCovered', totalDistance, { skipCheck: true });
            this._completeGalaxyVisit(spCamera.position, isPlaying, smoothedEnergy, currentCalculatedBpm);
        } else {
            appState.set('spTravelDistanceCovered', distanceCovered, { skipCheck: true });
        }
    },

    /**
     * Vừa ghé xong 1 thiên hà — điểm dừng tự nhiên DUY NHẤT để tiêu thụ `spClusterSwitchPending`
     * (mục 2c, SỬA lượt 2 — KHÔNG còn liên quan "ghé đủ hết"). Cờ đang bật VÀ có ít nhất 1 cụm
     * khác (còn sống, không đang 'out') để chuyển tới -> đổi cụm; ngược lại (cờ tắt, HOẶC cờ bật
     * nhưng chưa có cụm nào khác — hiếm, quần thể vừa hụt — giữ NGUYÊN cờ để thử lại lượt sau) ->
     * ở lại cụm hiện tại, chọn tiếp 1 thiên hà khác bất kỳ.
     */
    _completeGalaxyVisit(camPos, isPlaying, smoothedEnergy, currentCalculatedBpm) {
        const targetCluster = appState.get('spTargetCluster');
        const switchPending = appState.get('spClusterSwitchPending');
        const otherClusters = appState.get('spCurrentClusters').filter(c => c !== targetCluster && c.fadeState !== 'out');

        if (switchPending && otherClusters.length > 0) {
            appState.set('spClusterSwitchPending', false, { skipCheck: true });
            const nextCluster = otherClusters[Math.floor(Math.random() * otherClusters.length)];
            this._startClusterRotate(camPos, nextCluster, isPlaying, smoothedEnergy, currentCalculatedBpm);
        } else {
            const targetGalaxy = appState.get('spTargetGalaxy');
            const candidates = targetCluster.galaxies.filter(g => g.id !== targetGalaxy.id);
            const pool = candidates.length > 0 ? candidates : targetCluster.galaxies; // cụm chỉ có 1 thiên hà -> cho phép ghé lại
            const nextGalaxy = pool[Math.floor(Math.random() * pool.length)];
            this._startGalaxyRotate(camPos, nextGalaxy, isPlaying, smoothedEnergy, currentCalculatedBpm);
        }
    },
};
