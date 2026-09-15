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

const RENDER_TASK = 'visualizerRender';

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
            // Hướng rẽ ống (Workflow điều phối thật — beat flux/pitch/ghi tPathTarget) TRƯỚC,
            // rồi tới phần cập nhật vị trí/màu/camera mỗi frame (_tickVortexRender() — rà soát
            // Rule 3, Workflow điều phối thật, không còn gọi thẳng drawVortex() cũ).
            this._tickVortexCurve(isPlaying);
            this._tickVortexRender(perf, isPlaying, newSmoothedEnergy, vizDataArray);
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
            this._tickRubik(ctx, isPlaying, appState.get('dpr'), newSmoothedEnergy, newBeatScale, vizDataArray);
        } else if (cfg.type === 'lighting') {
            // ================== VISUAL Lighting — Workflow điều phối style thunder/fireworks ==================
            this._tickLighting(ctx, perf, isPlaying, newBeatScale, newSmoothedEnergy, vizDataArray);
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
     * THỜI (lastValidMidiNote, null thì Core tự fallback random) + z hiện tại của camera, ghi
     * thẳng target mới vào tPathTarget — phần cập nhật vị trí/màu/camera mỗi frame nằm ở
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

        const musicTransition = detectMusicTransition(_vxBeatFluxHistory, 2, cfg.sectionWindowBeats, cfg.fluxThreshold); // core (audio-analysis.js)
        if (!musicTransition) return;
        _vxBeatsSinceLastTurn = 0;

        const { tPathTarget, tCurrentWarpZ, lastValidMidiNote } = appState.get(['tPathTarget', 'tCurrentWarpZ', 'lastValidMidiNote']);
        const direction = pickVortexDirectionFromNote(lastValidMidiNote); // core (three-vortex.js)
        const nextTarget = computeVortexCurveTarget(tPathTarget, direction, tCurrentWarpZ); // core
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

        updateVortexCurveLerp(); // core/webgl/three-vortex.js

        const tWarpSpeed = computeVortexWarpSpeed(cfg.warpSpeedBase, cfg.warpSpeedEnergyMult, smoothedEnergy); // core
        const tCurrentWarpZ = appState.get('tCurrentWarpZ') - tWarpSpeed;
        appState.set('tCurrentWarpZ', tCurrentWarpZ, { skipCheck: true });

        if (cfg.vortexStyle === 'rings') {
            const tRings = appState.get('tRings');
            tRings.forEach((ring, idx) => {
                stepVortexRingZ(ring, tWarpSpeed, tCurrentWarpZ, TUNNEL_DEPTH); // core
                const center = getVortexCenterAt(ring.position.z); // core/webgl/three-vortex.js
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
                const center = getVortexCenterAt(z); // core/webgl/three-vortex.js
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
                const center = getVortexCenterAt(wave.position.z); // core/webgl/three-vortex.js
                const val = vizDataArray[idx % bufferLength] || 0;
                const color = getComputedColor(idx, tWaveMeshes.length, val); // core/audio-analysis.js
                let colorToApply;
                if (cfg.mode === 'gradient') colorToApply = color.fill;
                else if (cfg.mode === 'dynamic') colorToApply = idx % 2 === 0 ? cfg.dynA : cfg.dynB;
                else colorToApply = cfg.solidColor;
                finishVortexWaveFrame(wave, center, cfg.waveRotationBase, cfg.waveRotationEnergyMult, cfg.waveScaleBase, cfg.waveScaleEnergyMult, smoothedEnergy, colorToApply); // core
            });
        }

        const camTargetPos = getVortexCenterAt(tCurrentWarpZ); // core/webgl/three-vortex.js
        const tCamera = appState.get('tCamera');
        dampVortexCameraPosition(tCamera, camTargetPos, tCurrentWarpZ); // core
        const clampedPos = clampVortexCameraOffset(tCamera.position.x, tCamera.position.y, camTargetPos.x, camTargetPos.y, VORTEX_CAMERA_SAFE_RADIUS); // core/webgl/three-vortex.js
        applyVortexCameraClamp(tCamera, clampedPos); // core

        const lookAheadZ = tCurrentWarpZ - 800;
        const lookPos = getVortexCenterAt(lookAheadZ); // core/webgl/three-vortex.js
        tCamera.lookAt(lookPos.x, lookPos.y, lookAheadZ);

        appState.get('tRenderer').render(appState.get('tScene'), tCamera);
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
        if (cfg.barStyle === 'cascade') {
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
            const maxBin = analyser.frequencyBinCount * 0.5;
            // [SỬA — 15/09/2026, yêu cầu Giang] Bỏ hẳn bar trung tâm — computeBarMirrorFrame() (core)
            // không còn trả `center` nữa, chỉ còn `bars`.
            const frame = computeBarMirrorFrame(cfg, canvas.width, canvas.height, dpr, vizDataArray, maxBin); // core
            frame.bars.forEach((b) => {
                const color = getComputedColor(...b.colorArgs); // core/audio-analysis.js
                paintBarRects(ctx, b.rects, color.fill, color.glow, dpr, perf.blurMult, 15); // core
            });
            ctx.shadowBlur = 0;
        }
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

        const flashAlpha = computeRainFlashAlpha(cfg.glassFlash, isPlaying, smoothedEnergy, vizDataArray); // core
        paintRainFlash(ctx, canvas.width, canvas.height, flashAlpha, (a) => `rgba(200, 220, 255, ${a})`); // core

        if (cfg.glassCityVisible !== false) {
            const cityOpacity = (typeof cfg.glassCityOpacity === 'number' ? cfg.glassCityOpacity : 40) / 100;
            paintRainCity(ctx, canvas.height, appState.get('cityBuildings'), dpr, vizDataArray, isPlaying, cityOpacity); // core
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

        const flashAlpha = computeRainFlashAlpha(cfg.glassFlash, isPlaying, smoothedEnergy, vizDataArray); // core
        paintRainFlash(ctx, canvas.width, canvas.height, flashAlpha, (a) => `rgba(220, 225, 255, ${a * 0.8})`); // core

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
