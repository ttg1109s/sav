/**
 * event/workflow/visualizer/vortex.js — Group "vortex" (WebGL, 3 style: rings / bars / wave).
 *
 * Mỗi frame: đồng bộ toggle Redirect -> rẽ theo nhạc (beat flux + nốt) -> bay + uốn ống + đặt camera + render. Toán đường
 * ống ở core/webgl/three-vortex.js, mesh từng style ở core/visualizer/groups/vortex/. Resize chỉ đổi aspect camera; đổi số
 * vòng/bar (Custom Effect) dispose scene cũ rồi dựng lại.
 */

/** Cỡ phổ VẼ của group (host xin qua audioAnalysis.requireSpectrum()). */
const VORTEX_FFT_SIZE = 2048;

/** Toggle Redirect: tắt -> đích thẳng (ống duỗi êm về thẳng); bật -> lượt rẽ do _steerTunnel() đặt. */
const VORTEX_BEND_SYNC_BY_REDIRECT = {
    false: (s) => workflowVizVortex._straightenTunnel(s),
    true: () => {},
};
/** Lượt rẽ: đang thẳng -> rẽ ngay beat đủ điều kiện; đang giữ 1 hướng -> chờ nhạc chuyển đoạn (detectMusicTransition()). */
const VORTEX_TURN_GATE_BY_STRAIGHT = {
    true: () => true,
    false: (win, cfg) => detectMusicTransition(win.history, 2, cfg.sectionWindowBeats, cfg.fluxThreshold), // core/visualizer/beat-window.js
};

const VORTEX_SCENE_STEP_BY_STYLE = {
    rings: (frame, motion) => workflowVizVortex._stepRings(frame, motion),
    bars: (frame, motion) => workflowVizVortex._stepBars(frame, motion),
    wave: (frame, motion) => workflowVizVortex._stepWaves(frame, motion),
};

const workflowVizVortex = {
    usesWebgl: true,
    defaultStyle: 'rings',
    /** Cỡ phổ VẼ style cần — host gọi khi kích hoạt style để xin qua audioAnalysis.requireSpectrum() (01/10/2026). */
    spectrumSize() { return VORTEX_FFT_SIZE; },

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
        const cfg = resolveEffectConfig(appConfigViz.getAll().customEffect, 'vortex'); // core/custom-effect.js
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

    /** Rẽ ống trước (theo beat/pitch), rồi bay + uốn + camera + render. */
    _draw(frame) {
        this._syncRedirect(frame.cfg);
        this._steerTunnel(frame);
        this._renderTunnel(frame);
    },

    /** Đồng bộ đích độ uốn với toggle Redirect. Chưa dựng scene -> bỏ qua. */
    _syncRedirect(cfg) {
        const s = appState.get(['tInitialized', 'tBendTarget', 'tBendDir']);
        if (!s.tInitialized) return;
        VORTEX_BEND_SYNC_BY_REDIRECT[cfg.redirectEnabled !== false](s);
    },

    /** Redirect tắt: đích thẳng (chỉ ghi lúc vừa tắt, không ghi mỗi frame). */
    _straightenTunnel(s) {
        if (s.tBendDir === -1 && s.tBendTarget.x === 0 && s.tBendTarget.y === 0) return;
        appState.set('tBendTarget', computeVortexBendTarget(-1), { skipCheck: true }); // core/webgl/three-vortex.js
        appState.set('tBendDir', -1, { skipCheck: true });
        console.log('writer: "workflowVizVortex._straightenTunnel", page: "tBendTarget/tBendDir", content: "redirect tắt -> ống thẳng"');
    },

    /** Rẽ ống theo nhạc: beat mới, cách lượt trước >= 2 beat, lượt trước gần xong, (đang giữ hướng thì cần nhạc chuyển
     * đoạn) -> hướng mới theo nốt MIDI tức thời (không trùng/ngược hướng đang giữ). Redirect tắt -> không rẽ. */
    _steerTunnel(frame) {
        const win = this._beatWin;
        workflowVizBeatWindow.accumulateLatest(win, frame.audio.fluxHistory()); // service/audio-analysis.js
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.audio.lastBeatTime())) return;
        workflowVizBeatWindow.closeInterval(win);
        countBeatSinceTrigger(win); // core/visualizer/beat-window.js
        if (!frame.isPlaying) return;
        const cfg = frame.cfg;
        if (cfg.redirectEnabled === false) return;
        if (win.beatsSinceTrigger < 2) return;

        const s = appState.get(['tInitialized', 'tBend', 'tBendTarget', 'tBendDir']);
        if (!s.tInitialized) return;
        if (!isVortexBendSettled(s.tBend, s.tBendTarget)) return; // core/webgl/three-vortex.js
        if (!VORTEX_TURN_GATE_BY_STRAIGHT[s.tBendDir < 0](win, cfg)) return;
        resetBeatTriggerCount(win); // core/visualizer/beat-window.js

        const dir = pickVortexDirectionIndex(frame.audio.pitchMidi(), s.tBendDir); // core/webgl/three-vortex.js
        appState.set('tBendTarget', computeVortexBendTarget(dir), { skipCheck: true });
        appState.set('tBendDir', dir, { skipCheck: true });
        console.log(`writer: "workflowVizVortex._steerTunnel", page: "tBendTarget/tBendDir", content: "rẽ hướng ${dir}"`);
    },

    _renderTunnel(frame) {
        const s = appState.get(['tInitialized', 'tCurrentWarpZ', 'tBend', 'tBendTarget', 'tCamera', 'tRenderer', 'tScene']);
        if (!s.tInitialized) return;
        const cfg = frame.cfg;
        const smoothedEnergy = frame.audio.smoothedEnergy(); // service/audio-analysis.js
        const tWarpSpeed = computeVortexWarpSpeed(cfg.warpSpeedBase, cfg.warpSpeedEnergyMult, smoothedEnergy); // core
        const tCurrentWarpZ = this._rebaseWarpZ(computeVortexNextWarpZ(s.tCurrentWarpZ, tWarpSpeed)); // core/webgl/three-vortex.js
        const bend = stepVortexBend(s.tBend, s.tBendTarget); // core/webgl/three-vortex.js
        appState.set('tCurrentWarpZ', tCurrentWarpZ, { skipCheck: true });
        appState.set('tBend', bend, { skipCheck: true });

        const path = computeVortexPathOffset(bend, s.tCamera, smoothedEnergy); // core/webgl/three-vortex.js
        this._stepScene(VORTEX_SCENE_STEP_BY_STYLE[cfg.vortexStyle], frame, { tWarpSpeed, tCurrentWarpZ, path });
        aimVortexCamera(s.tCamera, tCurrentWarpZ, computeVortexLookTarget(path, tCurrentWarpZ)); // core
        s.tRenderer.render(s.tScene, s.tCamera);
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
        const spectrum = frame.audio.spectrum(VORTEX_FFT_SIZE); // service/audio-analysis.js
        const tRings = appState.get('tRings');
        tRings.forEach((ring, idx) => {
            placeVortexRingZ(ring, wrapVortexObjectZ(ring.position.z, motion.tWarpSpeed * VORTEX_RINGS_Z_SPEED, motion.tCurrentWarpZ, TUNNEL_DEPTH)); // core (rings.js + common.js)
            const center = getVortexCenterAt(ring.position.z, motion.path, motion.tCurrentWarpZ); // core/webgl/three-vortex.js
            const val = spectrum[idx % spectrum.length] || 0;
            const color = workflowVisualizerRender.colorAt(idx, tRings.length, val); // event/workflow/visualizer-render.js
            const colorToApply = workflowVisualizerRender.modeColor(cfg, idx, color.fill, 'solid');
            finishVortexRingFrame(ring, center, val, frame.audio.smoothedEnergy(), colorToApply); // core
        });
    },

    _stepBars(frame, motion) {
        const cfg = frame.cfg;
        const spectrum = frame.audio.spectrum(VORTEX_FFT_SIZE); // service/audio-analysis.js
        const dummy = new THREE.Object3D();
        const barsRingCount = cfg.barsRingCount, barsPerRing = cfg.barsPerRing;
        const twistPerRing = (Math.PI * 2 / barsRingCount) * cfg.barsTwistFactor;
        const globalTwist = frame.audio.frameIndex() * 0.004; // service/audio-analysis.js (01/10/2026, trước đây frameCounter)
        const { tBarsMesh, tBarRingZs } = appState.get(['tBarsMesh', 'tBarRingZs']);
        for (let r = 0; r < barsRingCount; r++) {
            placeVortexBarRingZ(tBarRingZs, r, wrapVortexObjectZ(tBarRingZs[r], motion.tWarpSpeed * VORTEX_BARS_Z_SPEED, motion.tCurrentWarpZ, TUNNEL_DEPTH)); // core (bars.js + common.js)
            const z = tBarRingZs[r];
            const center = getVortexCenterAt(z, motion.path, motion.tCurrentWarpZ); // core/webgl/three-vortex.js
            const val = spectrum[r % 40] || 0;
            const color = workflowVisualizerRender.colorAt(r, barsRingCount, val); // event/workflow/visualizer-render.js
            const threeColor = new THREE.Color(workflowVisualizerRender.modeColor(cfg, r, color.fill, 'solid'));
            computeVortexBarsRingFrame(dummy, tBarsMesh, r, barsPerRing, z, center, val, frame.audio.smoothedEnergy(), twistPerRing, globalTwist, threeColor); // core
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
        const spectrum = frame.audio.spectrum(VORTEX_FFT_SIZE); // service/audio-analysis.js
        const tWaveMeshes = appState.get('tWaveMeshes');
        tWaveMeshes.forEach((wave, idx) => {
            placeVortexWaveZ(wave, wrapVortexObjectZ(wave.position.z, motion.tWarpSpeed * VORTEX_WAVE_Z_SPEED, motion.tCurrentWarpZ, TUNNEL_DEPTH)); // core (wave.js + common.js)
            const center = getVortexCenterAt(wave.position.z, motion.path, motion.tCurrentWarpZ); // core/webgl/three-vortex.js
            const val = spectrum[idx % spectrum.length] || 0;
            const color = workflowVisualizerRender.colorAt(idx, tWaveMeshes.length, val); // event/workflow/visualizer-render.js
            const colorToApply = workflowVisualizerRender.modeColor(cfg, idx, color.fill, 'solid');
            finishVortexWaveFrame(wave, center, cfg.waveRotationBase, cfg.waveRotationEnergyMult, cfg.waveScaleBase, cfg.waveScaleEnergyMult, frame.audio.smoothedEnergy(), colorToApply); // core
        });
    },
};

workflowVisualizerRender.registerGroup('vortex', workflowVizVortex);
