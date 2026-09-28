/**
 * event/workflow/visualizer/vortex.js — Group "vortex" (WebGL, 3 style: rings / bars / wave).
 *
 * [TÁCH — 28/09/2026, Phase 3-4 dọn visualizer] Từ `_tickVortexCurve()`/`_tickVortexRender()` của
 * event/workflow/visualizer-render.js cũ + các biến `_vx*`. Hành vi mỗi frame giữ nguyên; thay đổi:
 *   - Vòng đời (Phase 3): resize CHỈ đổi aspect camera (trước đây dựng lại cả scene mỗi lần resize, scene cũ
 *     không dispose — rò GPU, đồng thời reset ống về đầu). Dựng lại theo Custom Effect (số vòng/bar) dispose
 *     scene cũ trước.
 *   - Beat flux dùng cửa sổ chung (event/workflow/visualizer/beat-window.js).
 *   - Rẽ nhánh theo style/color mode -> object map (readme/event-bus-flow.md mục 7).
 * Phase 5 (28/09/2026): scene dựng bằng builder thuần `buildVortexScene()` (core/webgl/three-vortex.js), renderer dùng
 * chung qua `workflowVisualizerRender.ensureSharedRenderer()`; toán đường ống (quấn pha, lệch pha, z vòng) Workflow ghép
 * từ các core nhỏ — không core nào gọi core khác.
 */

/** Bước cập nhật mesh theo style — object map thay if/else theo cfg.vortexStyle. */
const VORTEX_SCENE_STEP_BY_STYLE = {
    rings: (frame, motion) => workflowVizVortex._stepRings(frame, motion),
    bars: (frame, motion) => workflowVizVortex._stepBars(frame, motion),
    wave: (frame, motion) => workflowVizVortex._stepWaves(frame, motion),
};

const workflowVizVortex = {
    usesWebgl: true,
    defaultStyle: 'rings',

    /** Cửa sổ beat flux RIÊNG (không dùng chung mảng với Fireworks/Circle). */
    _beatWin: createBeatFluxWindow(), // core/visualizer/beat-window.js

    styles: {
        rings: (frame) => workflowVizVortex._draw(frame),
        bars: (frame) => workflowVizVortex._draw(frame),
        wave: (frame) => workflowVizVortex._draw(frame),
    },

    // ===================== Vòng đời =====================

    /** Style vortex vừa được chọn: dựng scene lần đầu nếu chưa có, ẩn/hiện nhóm mesh theo style. */
    activate(style) {
        this._ensureInitialized();
        this._applyStyleVisibility(style);
    },

    _ensureInitialized() {
        if (appState.get('tInitialized')) return;
        this._build();
    },

    /** Custom Effect đổi số vòng/bar (field refresh 'initThreeJS' — tên lịch sử): dispose scene cũ rồi dựng lại. */
    rebuild() {
        this._disposeScene();
        this._build();
    },

    /** Phase 5 — THAY initThreeJS() (core cũ): đọc config, lấy renderer dùng chung, dựng scene bằng builder thuần,
     * ghi appState, ẩn/hiện theo style. */
    _build() {
        const cfg = getEffectConfig('vortex'); // core/custom-effect.js
        workflowVisualizerRender.ensureSharedRenderer(window.devicePixelRatio); // event/workflow/visualizer-render.js
        const built = buildVortexScene(cfg.tunnelRingCount, cfg.barsRingCount, cfg.barsPerRing, window.innerWidth / window.innerHeight); // core/webgl/three-vortex.js
        const entries = {
            tScene: built.scene, tCamera: built.camera,
            tGroupRings: built.groupRings, tRings: built.rings,
            tGroupBars: built.groupBars, tBarsMesh: built.barsMesh, tBarRingZs: built.barRingZs,
            tGroupWaves: built.groupWaves, tWaveMeshes: built.waveMeshes,
            tCurrentWarpZ: 0, tInitialized: true,
        };
        Object.keys(entries).forEach((key) => appState.set(key, entries[key], { skipCheck: true }));
        console.log(`writer: "workflowVizVortex._build", page: "tScene/tCamera/...", content: "dựng scene Vortex (${cfg.tunnelRingCount} vòng, ${cfg.barsRingCount}×${cfg.barsPerRing} bar)"`);
        this._applyStyleVisibility(cfg.vortexStyle);
    },

    /** Chỉ nhóm mesh của style đang chọn được hiện (THAY updateVortexVisibility()). */
    _applyStyleVisibility(style) {
        const g = appState.get(['tGroupRings', 'tGroupBars', 'tGroupWaves']);
        applyVortexStyleVisibility(g.tGroupRings, g.tGroupBars, g.tGroupWaves, style); // core/webgl/three-vortex.js
    },

    _disposeScene() {
        const scene = appState.get('tScene');
        if (!scene) return;
        disposeThreeObjectTree(scene); // core/webgl/three-common.js
    },

    /** Khung nhìn đổi: CHỈ đổi aspect camera (renderer do host đổi) — không dựng lại scene. */
    onResize(viewport) {
        const { tInitialized, tCamera } = appState.get(['tInitialized', 'tCamera']);
        if (!tInitialized || !tCamera) return;
        resizeThreeCamera(tCamera, viewport.width / viewport.height); // core/webgl/three-common.js
    },

    // ===================== Frame =====================

    /** Hướng rẽ ống trước (theo beat/pitch), rồi cập nhật vị trí/màu/camera + render. */
    _draw(frame) {
        this._steerTunnel(frame);
        this._renderTunnel(frame);
    },

    /** Hướng rẽ ống theo nhạc: đủ điều kiện "nhạc vừa biến động" (detectMusicTransition()) -> chọn hướng theo
     * nốt MIDI tức thời, ghi target mới vào tPathTarget. Debounce tối thiểu 2 beat giữa 2 lần rẽ; toggle
     * Redirect tắt thì không bao giờ rẽ; lượt rẽ trước chưa hội tụ thì bỏ qua (tránh giằng co giữa các hướng). */
    _steerTunnel(frame) {
        const win = this._beatWin;
        workflowVizBeatWindow.accumulateLatest(win, appState.get('fluxHistory'));
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.lastBeatTime)) return;
        workflowVizBeatWindow.closeInterval(win);
        countBeatSinceTrigger(win); // core/visualizer/beat-window.js
        if (!frame.isPlaying) return;
        const cfg = frame.cfg;
        if (!cfg.redirectEnabled) return; // toggle tắt -> không bao giờ rẽ
        if (win.beatsSinceTrigger < 2) return;

        const { tPathParams, tPathTarget } = appState.get(['tPathParams', 'tPathTarget']);
        const settle = this._phaseDeltas(tPathParams, tPathTarget);
        if (!isVortexTurnSettled(settle.x, settle.y, VORTEX_TURN_SETTLE_RAD)) return; // core (three-vortex.js)
        if (!detectMusicTransition(win.history, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return; // core (audio-analysis.js)
        resetBeatTriggerCount(win); // core

        const direction = pickVortexDirectionFromNote(frame.midiNote); // core (three-vortex.js)
        appState.set('tPathTarget', this._wrapTargetPhases(computeVortexCurveTarget(tPathTarget, direction)), { skipCheck: true }); // core
    },

    _renderTunnel(frame) {
        if (!appState.get('tInitialized')) return;
        const cfg = frame.cfg;
        const tWarpSpeed = computeVortexWarpSpeed(cfg.warpSpeedBase, cfg.warpSpeedEnergyMult, frame.smoothedEnergy); // core
        const tCurrentWarpZ = this._rebaseWarpZ(appState.get('tCurrentWarpZ') - tWarpSpeed);
        appState.set('tCurrentWarpZ', tCurrentWarpZ, { skipCheck: true });

        const { tPathParams, tPathTarget } = appState.get(['tPathParams', 'tPathTarget']);
        const delta = this._phaseDeltas(tPathParams, tPathTarget);
        const raw = computeNextVortexPath(tPathParams, tPathTarget, tWarpSpeed, delta.x, delta.y); // core/webgl/three-vortex.js
        const path = { params: this._wrapTargetPhases(raw.params), target: this._wrapTargetPhases(raw.target) };
        appState.set('tPathParams', path.params, { skipCheck: true });
        appState.set('tPathTarget', path.target, { skipCheck: true });

        const motion = { tWarpSpeed, tCurrentWarpZ, pathParams: path.params };
        const step = VORTEX_SCENE_STEP_BY_STYLE[cfg.vortexStyle];
        this._stepScene(step, frame, motion);

        const camPos = getVortexCenterAt(tCurrentWarpZ, path.params, tCurrentWarpZ); // core/webgl/three-vortex.js
        const tCamera = appState.get('tCamera');
        placeVortexCamera(tCamera, camPos, tCurrentWarpZ); // core
        const lookAheadZ = tCurrentWarpZ - VORTEX_LOOK_AHEAD;
        const lookPos = getVortexCenterAt(lookAheadZ, path.params, tCurrentWarpZ); // core/webgl/three-vortex.js
        tCamera.lookAt(lookPos.x, lookPos.y, lookAheadZ);

        appState.get('tRenderer').render(appState.get('tScene'), tCamera);
    },

    /** Độ lệch pha ngắn nhất params -> target (2 trục) — Phase 5: core toán tách nhỏ, Workflow ghép. */
    _phaseDeltas(params, target) {
        return { x: shortestAngleDelta(params.phaseX, target.phaseX), y: shortestAngleDelta(params.phaseY, target.phaseY) }; // core/webgl/three-vortex.js
    },

    /** Quấn 2 pha của 1 bộ tham số đường ống về [0, 2π) (core trả pha chưa quấn). */
    _wrapTargetPhases(p) {
        return { ...p, phaseX: wrapVortexAngle(p.phaseX), phaseY: wrapVortexAngle(p.phaseY) }; // core/webgl/three-vortex.js
    },

    /** Style lạ (config hỏng) -> không cập nhật mesh nào, camera/render vẫn chạy (đúng hành vi cũ). */
    _stepScene(step, frame, motion) {
        if (!step) return;
        step(frame, motion);
    },

    /** Camera đi xa quá VORTEX_REBASE_Z -> dời toàn bộ scene về gần gốc toạ độ (giữ chính xác số thực khi chạy
     * lâu), trả z camera mới. Chưa xa -> giữ nguyên. */
    _rebaseWarpZ(z) {
        if (z >= -VORTEX_REBASE_Z) return z; // core/webgl/three-vortex.js
        const nextBarRingZs = shiftVortexSceneZ(-z, appState.get('tRings'), appState.get('tWaveMeshes'), appState.get('tBarRingZs')); // core
        appState.set('tBarRingZs', nextBarRingZs, { skipCheck: true });
        return 0;
    },

    _stepRings(frame, motion) {
        const cfg = frame.cfg;
        const tRings = appState.get('tRings');
        tRings.forEach((ring, idx) => {
            placeVortexRingZ(ring, wrapVortexObjectZ(ring.position.z, motion.tWarpSpeed * VORTEX_RINGS_Z_SPEED, motion.tCurrentWarpZ, TUNNEL_DEPTH)); // core (rings.js + common.js)
            const center = getVortexCenterAt(ring.position.z, motion.pathParams, motion.tCurrentWarpZ); // core/webgl/three-vortex.js
            const val = frame.vizDataArray[idx % frame.bufferLength] || 0;
            const color = getComputedColor(idx, tRings.length, val); // core/audio-analysis.js
            const colorToApply = workflowVisualizerRender.modeColor(cfg, idx, color.fill, 'solid');
            finishVortexRingFrame(ring, center, val, frame.smoothedEnergy, colorToApply); // core
        });
    },

    _stepBars(frame, motion) {
        const cfg = frame.cfg;
        const dummy = new THREE.Object3D();
        const barsRingCount = cfg.barsRingCount, barsPerRing = cfg.barsPerRing;
        const twistPerRing = (Math.PI * 2 / barsRingCount) * cfg.barsTwistFactor;
        const globalTwist = appState.get('frameCounter') * 0.004;
        const { tBarsMesh, tBarRingZs } = appState.get(['tBarsMesh', 'tBarRingZs']);
        for (let r = 0; r < barsRingCount; r++) {
            placeVortexBarRingZ(tBarRingZs, r, wrapVortexObjectZ(tBarRingZs[r], motion.tWarpSpeed * VORTEX_BARS_Z_SPEED, motion.tCurrentWarpZ, TUNNEL_DEPTH)); // core (bars.js + common.js)
            const z = tBarRingZs[r];
            const center = getVortexCenterAt(z, motion.pathParams, motion.tCurrentWarpZ); // core/webgl/three-vortex.js
            const val = frame.vizDataArray[r % 40] || 0;
            const color = getComputedColor(r, barsRingCount, val); // core/audio-analysis.js
            const threeColor = new THREE.Color(workflowVisualizerRender.modeColor(cfg, r, color.fill, 'solid'));
            computeVortexBarsRingFrame(dummy, tBarsMesh, r, barsPerRing, z, center, val, frame.smoothedEnergy, twistPerRing, globalTwist, threeColor); // core
        }
        tBarsMesh.instanceMatrix.needsUpdate = true;
        this._flagInstanceColorUpdate(tBarsMesh);
    },

    /** InstancedMesh chỉ có instanceColor sau lần setColorAt() đầu tiên. */
    _flagInstanceColorUpdate(mesh) {
        if (!mesh.instanceColor) return;
        mesh.instanceColor.needsUpdate = true;
    },

    _stepWaves(frame, motion) {
        const cfg = frame.cfg;
        const tWaveMeshes = appState.get('tWaveMeshes');
        tWaveMeshes.forEach((wave, idx) => {
            placeVortexWaveZ(wave, wrapVortexObjectZ(wave.position.z, motion.tWarpSpeed * VORTEX_WAVE_Z_SPEED, motion.tCurrentWarpZ, TUNNEL_DEPTH)); // core (wave.js + common.js)
            const center = getVortexCenterAt(wave.position.z, motion.pathParams, motion.tCurrentWarpZ); // core/webgl/three-vortex.js
            const val = frame.vizDataArray[idx % frame.bufferLength] || 0;
            const color = getComputedColor(idx, tWaveMeshes.length, val); // core/audio-analysis.js
            const colorToApply = workflowVisualizerRender.modeColor(cfg, idx, color.fill, 'solid');
            finishVortexWaveFrame(wave, center, cfg.waveRotationBase, cfg.waveRotationEnergyMult, cfg.waveScaleBase, cfg.waveScaleEnergyMult, frame.smoothedEnergy, colorToApply); // core
        });
    },
};

workflowVisualizerRender.registerGroup('vortex', workflowVizVortex);
