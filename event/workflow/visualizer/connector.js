/**
 * event/workflow/visualizer/connector.js — Group "connector" (WebGL, style DUY NHẤT: circuit).
 * [01/10/2026] Style 'brain' (canvas 2D) ĐÃ XOÁ HẲN theo Giang; dữ liệu audio đọc từ kho audioAnalysis (frame.audio).
 * [06/10/2026, Giang] Style 'synapse' ĐÃ XOÁ HẲN (mạng neuron, tia điện thế, góc máy synapse). Circuit thiết kế lại:
 *   - Chip vuông, chân thanh mảnh liền thân, đứng yên; tổng chân mỗi chip = Chip count; mỗi chân nối riêng 1 chip bằng
 *     dây thẳng/bẻ góc vuông, chỗ dây chạm nhau có nút tròn (builder: core/webgl/three-connector.js).
 *   - Bit phóng ra từ chân, chạy dọc dây và đi hết vào chân đích; chân nào phóng = kết hợp dải tần onset + năng lượng +
 *     pitch (core/visualizer/groups/connector/circuit.js).
 *   - Camera 3 chế độ (field `cameraMode`): 'orbit' (như cũ: OrbitControls + cinematic shift), 'follow' (bắt ngẫu nhiên 1
 *     dãy bit, đi theo nó; xong thì bắt dãy khác), 'fixed' (cố định nhìn từ ngoài vào, slider X/Y/Z + xoay ngang/dọc).
 *
 * [TÁCH — 28/09/2026, Phase 3-5 dọn visualizer] vòng đời (resize, dựng lại theo Custom Effect, seek/đổi bài qua hook host),
 * rẽ nhánh -> guard + object map (readme/event-bus-flow.md mục 7).
 */

/** Cỡ phổ VẼ của group (01/10/2026: group tự khai báo, host xin qua audioAnalysis.requireSpectrum()). */
const CONNECTOR_FFT_SIZE = 2048;

// Số frame giữ connector "ổn định lại" (không bắn, mỗi frame lấy FFT hiện tại làm baseline) sau lần seek CUỐI —
// analyser tự làm mượt FFT (smoothingTimeConstant 0.8) nên còn kéo đuôi audio CŨ ~0.2s sau khi media seek xong.
const CONNECTOR_SEEK_SETTLE_FRAMES = 15;
// Nốt chỉ coi là "đang phát" nếu được cập nhật trong khoảng này (ms).
const CONNECTOR_PITCH_FRESH_MS = 300;
// trailLength (slider, đơn vị lịch sử = số bước, 2 bước/unit) -> độ dài vệt sáng theo world units.
const CONNECTOR_TRAIL_UNITS_PER_STEP = 0.5;

/** Kết quả updateCircuitSignal() -> việc cần làm (null = đang bay, không làm gì). */
const CIRCUIT_SIGNAL_BY_RESULT = {
    destroy: (signal, index, activeSignals, cnGroupCircuit) => {
        destroyCircuitSignal(signal, cnGroupCircuit); // core/webgl/three-connector.js
        activeSignals.splice(index, 1);
    },
    arrive: (signal) => onCircuitSignalArrival(signal), // core/visualizer/groups/connector/circuit.js — chip đích sáng bừng
};

/** Chế độ camera (cfg.cameraMode) -> vào chế độ + bước mỗi frame. Giá trị lạ -> orbit. */
const CONNECTOR_CAMERA_MODES = {
    orbit: {
        enter: (s) => enterCircuitOrbitCamera(s.cnCamera, s.cnControls), // core/visualizer/groups/connector/circuit.js
        tick: (frame, wf, s) => {
            workflowVizConnector._driftOrbitSweep(s.cnCamera);
            s.cnControls.update();
        },
    },
    follow: {
        enter: (s) => {
            enterCircuitManualCamera(s.cnControls); // core
            workflowVizConnector._followSignal = null;
            workflowVizConnector._followLook.set(0, 0, 0);
        },
        tick: (frame, wf, s) => workflowVizConnector._tickFollowCamera(wf, s),
    },
    fixed: {
        enter: (s) => enterCircuitManualCamera(s.cnControls), // core
        tick: (frame, wf, s) => applyFixedCircuitCameraPose(s.cnCamera, frame.cfg.camPosX, frame.cfg.camPosY, frame.cfg.camPosZ, frame.cfg.camRotY, frame.cfg.camRotX), // core
    },
};

const workflowVizConnector = {
    usesWebgl: true,
    defaultStyle: 'circuit',
    /** Cỡ phổ VẼ style cần — host gọi khi kích hoạt style để xin qua audioAnalysis.requireSpectrum() (01/10/2026). */
    spectrumSize() { return CONNECTOR_FFT_SIZE; },

    /** >0 = đang "ổn định lại" sau seek, trừ dần mỗi frame WebGL. */
    _settleFrames: 0,
    /** Cửa sổ beat flux riêng: camera orbit đổi góc máy (cinematic shift). */
    _cameraShiftWin: createBeatFluxWindow(), // core/visualizer/beat-window.js
    /** Chế độ camera đang áp dụng (null = chưa vào chế độ nào -> frame tới chạy `enter`). */
    _camMode: null,
    /** Chế độ bám bit: xung đang bám + điểm nhìn (đuổi mượt). */
    _followSignal: null,
    _followLook: new THREE.Vector3(),

    styles: {
        circuit: (frame) => workflowVizConnector._drawCircuit(frame),
    },

    // ===================== Vòng đời =====================

    activate(style) {
        this._ensureInitialized();
        this._applyStyleView(style);
    },

    _ensureInitialized() {
        if (appState.get('cnInitialized')) return;
        this._build();
    },

    /** Custom Effect đổi số chip (field refresh 'initThreeJSConnector' — tên lịch sử): dọn scene cũ rồi dựng lại. */
    rebuild() {
        this._disposeScene();
        this._build();
    },

    _build() {
        const cfg = getEffectConfig('connector'); // core/custom-effect.js
        const renderer = workflowVisualizerRender.ensureSharedRenderer(Math.min(window.devicePixelRatio, 2)); // event/workflow/visualizer-render.js
        const width = window.innerWidth, height = window.innerHeight;
        const stage = buildConnectorStage(width / height, renderer); // core/webgl/three-connector.js
        const board = this._buildCircuitBoard(cfg, stage.groupCircuit);
        const post = buildConnectorComposer(renderer, stage.scene, stage.camera, width, height); // core
        const entries = {
            cnScene: stage.scene, cnCamera: stage.camera, cnControls: stage.controls,
            cnComposer: post.composer, cnBloomPass: post.bloomPass,
            cnGroupCircuit: stage.groupCircuit,
            cnChips: board.chips, cnWires: board.wires, cnTrace: board.trace, cnJunction: board.junction,
            cnSignalAssets: board.assets,
            cnActiveSignalsCircuit: [],
            cnInitialized: true,
        };
        Object.keys(entries).forEach((key) => appState.set(key, entries[key], { skipCheck: true }));
        console.log(`writer: "workflowVizConnector._build", page: "cnScene/cnChips/cnWires/...", content: "dựng scene Connector (${board.chips.length} chip, ${board.wires.length} dây, ${board.junction.mesh.count} nút chạm)"`);
        this._applyStyleView(cfg.connectorStyle);
    },

    /** Lưới lập phương -> cỡ chip/chân -> vị trí chân -> 1 geometry chip dùng chung -> từng chip (màu theo color mode) ->
     * láng giềng -> gán chân cho chip đích -> dây -> mesh dây + nút chạm -> tài nguyên xung. */
    _buildCircuitBoard(cfg, group) {
        const cube = buildCircuitCubeCells(cfg.nodeCount); // core/webgl/three-connector.js
        const pinTotal = cube.cells.length; // tổng chân mỗi chip = Chip count (Giang 06/10/2026)
        const metrics = computeCircuitChipMetrics(cube.spacing, pinTotal); // core
        const slots = buildCircuitPinSlots(metrics, pinTotal); // core
        const chipGeometry = buildChipGeometry(metrics, slots); // core
        const chips = cube.cells.map((cell, i) => {
            const colorHex = new THREE.Color(getComputedColor(i, cube.cells.length, 128).fillNoAlpha).getHex(); // core/visualizer/effect-paint.js
            const chip = assembleCircuitChip(cell, i, colorHex, createChipMesh(colorHex, chipGeometry, cube.spacing * 0.9), slots); // core
            attachThreeChild(group, chip.group); // core
            return chip;
        });
        linkCircuitChipNeighbors(chips); // core
        assignCircuitPinTargets(chips); // core
        const wires = buildCircuitWires(chips, metrics); // core
        const trace = buildCircuitTraceMesh(wires, cfg.traceOpacity); // core
        attachThreeChild(group, trace.mesh); // core
        const junction = buildCircuitJunctionMesh(collectCircuitJunctions(wires, CIRCUIT_JUNCTION_MAX), metrics.junctionRadius, cfg.traceOpacity); // core
        attachThreeChild(group, junction.mesh); // core
        return { chips, wires, trace, junction, assets: createCircuitSignalAssets(metrics) }; // core
    },

    /** Góc máy circuit (fog/fov/giới hạn controls) + dừng tween cinematic đang chạy; chế độ camera áp lại ở frame tới. */
    _applyStyleView() {
        const s = appState.get(['cnScene', 'cnCamera', 'cnControls']);
        stopThreeCameraTweens(s.cnCamera, s.cnControls); // core/webgl/three-common.js
        applyCircuitCameraView(s.cnScene, s.cnCamera, s.cnControls); // core/webgl/three-connector.js
        this._camMode = null;
        this._followSignal = null;
    },

    _disposeScene() {
        if (!appState.get('cnInitialized')) return;
        const s = appState.get(['cnScene', 'cnCamera', 'cnControls', 'cnComposer', 'cnSignalAssets']);
        stopThreeCameraTweens(s.cnCamera, s.cnControls); // core/webgl/three-common.js
        disposeOrbitControls(s.cnControls); // core
        disposeThreeComposer(s.cnComposer); // core
        disposeThreeObjectTree(s.cnScene); // core
        disposeCircuitSignalAssets(s.cnSignalAssets); // core/webgl/three-connector.js
        this._followSignal = null;
    },

    /** Khung nhìn đổi: aspect camera + composer (bloom tính lại render target). Renderer do host đổi. */
    onResize(viewport) {
        if (!appState.get('cnInitialized')) return;
        const { cnCamera, cnComposer } = appState.get(['cnCamera', 'cnComposer']);
        resizeThreeCamera(cnCamera, viewport.width / viewport.height); // core/webgl/three-common.js
        resizeThreeComposer(cnComposer, viewport.width, viewport.height); // core
    },

    /** Media vừa seek: giữ connector "ổn định lại" vài frame (xem CONNECTOR_SEEK_SETTLE_FRAMES). */
    onSeek() {
        this._settleFrames = CONNECTOR_SEEK_SETTLE_FRAMES;
    },

    /** Đổi bài/video: dọn xung đang bay + đưa chip về trạng thái nghỉ. */
    onNewMedia() {
        if (!appState.get('cnInitialized')) return;
        const cnChips = appState.get('cnChips');
        this._clearCircuitSignals();
        cnChips.forEach((c) => rebaselineTonotopicNode(c, 0)); // core/visualizer/tonotopic.js
    },

    // ===================== Frame =====================

    _drawCircuit(frame) {
        this._tickCameraShift(frame);
        const wf = this._beginWebglFrame();
        if (!wf) return;
        this._stepCircuit(frame, wf);
        this._tickCamera(frame, wf);
        appState.get('cnComposer').render();
    },

    /** Phần đầu chung mỗi frame WebGL: null nếu scene chưa dựng. Luôn tiêu thụ đồng hồ + trừ cửa sổ ổn định. */
    _beginWebglFrame() {
        if (!appState.get('cnInitialized')) return null;
        const isSettling = this._settleFrames > 0;
        this._settleFrames = Math.max(0, this._settleFrames - 1);
        return {
            glowMult: getConnectorGlowMult(), // core/custom-effect.js — 0 khi tắt Glow
            deltaTime: Math.min(cnClock.getDelta(), 0.1), // core/webgl/three-connector.js
            isSettling,
        };
    },

    /** Camera: chế độ đổi (Custom Effect) -> vào chế độ mới (dừng tween cinematic cũ), rồi bước của chế độ hiện tại. */
    _tickCamera(frame, wf) {
        const s = appState.get(['cnCamera', 'cnControls', 'cnActiveSignalsCircuit', 'cnSignalAssets']);
        const modeKey = CONNECTOR_CAMERA_MODES[frame.cfg.cameraMode] ? frame.cfg.cameraMode : 'orbit';
        const mode = CONNECTOR_CAMERA_MODES[modeKey];
        this._enterCameraModeWhenChanged(modeKey, mode, s);
        mode.tick(frame, wf, s);
    },

    _enterCameraModeWhenChanged(modeKey, mode, s) {
        if (this._camMode === modeKey) return;
        stopThreeCameraTweens(s.cnCamera, s.cnControls); // core/webgl/three-common.js
        mode.enter(s);
        this._camMode = modeKey;
        console.log(`writer: "workflowVizConnector._enterCameraModeWhenChanged", page: "_camMode", content: "${modeKey}"`);
    },

    /** Bám dãy bit: xung đang bám đã vào hết chip / đã tới nơi -> bắt xung khác (ngẫu nhiên); chưa có xung -> đứng yên. */
    _tickFollowCamera(wf, s) {
        this._repickFollowSignalWhenStale(s.cnActiveSignalsCircuit);
        if (!this._followSignal) return;
        stepFollowCircuitCamera(s.cnCamera, this._followLook, this._followSignal, wf.deltaTime, s.cnSignalAssets.followBack, s.cnSignalAssets.followUp); // core/visualizer/groups/connector/circuit.js
    },

    _repickFollowSignalWhenStale(activeSignals) {
        const current = this._followSignal;
        if (current && !current.done && !current.arrived) return;
        const next = pickFollowCircuitSignal(activeSignals); // core
        if (!next) return; // không có xung mới — vẫn bám nốt xung cũ (đang vào chip) hoặc đứng yên
        this._followSignal = next;
    },

    /** Orbit: nhạc chuyển đoạn -> đổi góc máy (cinematic shift). Tích luỹ flux MỖI FRAME (chỉ khi bật camera shift ở
     * chế độ orbit), tiêu thụ beat ở MỌI frame — giữ đúng thứ tự gốc. */
    _tickCameraShift(frame) {
        const win = this._cameraShiftWin;
        const cfg = frame.cfg;
        this._accumulateCameraShiftFlux(frame);
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.audio.lastBeatTime())) return;
        if (!frame.isPlaying || !this._isCameraShiftActive(cfg)) return;
        workflowVizBeatWindow.closeInterval(win);
        countBeatSinceTrigger(win); // core/visualizer/beat-window.js
        if (win.beatsSinceTrigger < 2) return;
        if (!detectMusicTransition(win.history, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return; // core/visualizer/beat-window.js
        resetBeatTriggerCount(win); // core
        const s = appState.get(['cnCamera', 'cnControls', 'cnChips', 'cnActiveSignalsCircuit']);
        const mode = triggerCinematicCameraShift(s.cnCamera, s.cnControls, s.cnChips, s.cnActiveSignalsCircuit); // core/webgl
        appState.set('cnActiveCamMode', mode, { skipCheck: true });
    },

    /** Cinematic shift chỉ có nghĩa ở camera orbit (2 chế độ kia tự đặt camera mỗi frame). */
    _isCameraShiftActive(cfg) {
        return !!cfg.cameraShiftEnabled && (cfg.cameraMode || 'orbit') === 'orbit';
    },

    _accumulateCameraShiftFlux(frame) {
        if (!this._isCameraShiftActive(frame.cfg)) return;
        workflowVizBeatWindow.accumulateLatest(this._cameraShiftWin, frame.audio.fluxHistory()); // service/audio-analysis.js
    },

    _rebaselineWhenSettling(node, rawPeak, isSettling) {
        if (!isSettling) return;
        rebaselineTonotopicNode(node, rawPeak); // core/visualizer/tonotopic.js
    },

    /** Xoá mọi xung đang bay — chỉ khi đang ổn định lại sau seek. */
    _clearCircuitSignalsWhenSettling(isSettling) {
        if (!isSettling) return;
        this._clearCircuitSignals();
    },

    _clearCircuitSignals() {
        const activeSignals = appState.get('cnActiveSignalsCircuit');
        if (activeSignals.length === 0) return;
        const cnGroupCircuit = appState.get('cnGroupCircuit');
        activeSignals.forEach((signal) => destroyCircuitSignal(signal, cnGroupCircuit)); // core/webgl/three-connector.js
        appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
        console.log(`writer: "workflowVizConnector._clearCircuitSignals", page: "cnActiveSignalsCircuit", content: "xoá ${activeSignals.length} xung (seek/đổi bài)"`);
    },

    _stepCircuit(frame, wf) {
        const cfg = frame.cfg;
        const spectrum = frame.audio.spectrum(CONNECTOR_FFT_SIZE); // service/audio-analysis.js
        this._clearCircuitSignalsWhenSettling(wf.isSettling); // xung sinh trước seek — xoá NGAY
        const s = appState.get(['cnChips', 'cnActiveSignalsCircuit', 'cnGroupCircuit', 'cnTrace', 'cnJunction', 'cnSignalAssets', 'cnBloomPass']);
        const chips = s.cnChips;
        const speed = computeConnectorSpeed(cfg.circuitSpeedBase, cfg.circuitSpeedEnergyMult, frame.audio.smoothedEnergy()); // core/webgl
        // SỬA (07/10/2026, Giang báo Glow/Bloom xung đột) — Glow là bloom: bật/tắt = bật/tắt pass bloom (tắt thì không tốn
        // GPU), Glow intensity 0-100% = bloom 0-CIRCUIT_BLOOM_MAX, cố định (energy boost BỎ cùng ngày theo Giang).
        s.cnBloomPass.enabled = cfg.glowEnabled !== false;
        s.cnBloomPass.strength = wf.glowMult * CIRCUIT_BLOOM_MAX; // core/webgl/three-connector.js
        const pitchNodeIndex = this._resolvePitchNodeIndex(frame, chips.length);

        // Lượt 1: màu + năng lượng dải tần + độ tăng của MỌI chip (lượt 2 cần biết dải nào đang onset để chọn chân).
        chips.forEach((chip, i) => {
            applyChipLiveColor(chip, getComputedColor(i, chips.length, 128).fillNoAlpha); // core/visualizer/groups/connector/circuit.js + effect-paint.js
            const rawPeak = computeBinRangePeak(spectrum, tonotopicBinRange(i, chips.length, spectrum.length)); // core/visualizer/tonotopic.js
            this._rebaselineWhenSettling(chip, rawPeak, wf.isSettling);
            chip.frameEnergy = applyTonotopicSmoothing(chip, rawPeak, i, chips.length); // core
            chip.frameDiff = chip.frameEnergy - chip.prevBinEnergy;
        });
        // Lượt 2: bắn + cập nhật mốc + decay + độ sáng.
        chips.forEach((chip, i) => {
            this._fireChip(frame, wf, chips, chip, i, pitchNodeIndex, s);
            chip.prevBinEnergy = chip.frameEnergy;
            decayNeuronState(chip, wf.deltaTime); // core/visualizer/tonotopic.js
            applyChipEnergyGlow(chip); // core/visualizer/groups/connector/common.js
        });
        updateCircuitTraceColors(s.cnTrace, s.cnJunction, chips, cfg.traceOpacity); // core/visualizer/groups/connector/circuit.js

        const activeSignals = s.cnActiveSignalsCircuit;
        const trailUnits = cfg.trailLength * CONNECTOR_TRAIL_UNITS_PER_STEP;
        for (let i = activeSignals.length - 1; i >= 0; i--) {
            const signal = activeSignals[i];
            const result = updateCircuitSignal(signal, wf.deltaTime, speed, trailUnits, s.cnSignalAssets.bitGap); // core/visualizer/groups/connector/circuit.js
            (CIRCUIT_SIGNAL_BY_RESULT[result] || VIZ_NOOP)(signal, i, activeSignals, s.cnGroupCircuit);
        }
    },

    /** Chip (dải tần) chứa nốt đang phát — đích ưu tiên của chân phóng; null nếu không có nốt "tươi". */
    _resolvePitchNodeIndex(frame, chipCount) {
        if (!frame.isPlaying || chipCount <= 1) return null;
        if (!frame.audio.isPitchFresh(CONNECTOR_PITCH_FRESH_MS)) return null; // service/audio-analysis.js (01/10/2026)
        const pitchHz = 440 * Math.pow(2, (frame.audio.pitchMidi() - 69) / 12);
        const binCount = CONNECTOR_FFT_SIZE / 2;
        const ranges = Array.from({ length: chipCount }, (_, j) => tonotopicBinRange(j, chipCount, binCount)); // core/visualizer/tonotopic.js
        return findTonotopicNodeForBin(ranges, frequencyToFftBin(pitchHz, binCount, frame.audio.sampleRate())); // core
    },

    /** Onset dải tần của chip -> thích nghi + ức chế láng giềng + phóng bit từ các chân. */
    _fireChip(frame, wf, chips, chip, i, pitchNodeIndex, s) {
        const cfg = frame.cfg;
        if (!shouldFireTonotopicNode(frame.isPlaying, wf.isSettling, chip.frameDiff, chip.frameEnergy, computeEffectiveFireThresholdByte(chip, cfg))) return; // core/visualizer/tonotopic.js
        triggerNeuronAdaptation(chip); // core
        chip.neighbors.forEach((n) => applyLateralInhibition(chips[n], cfg.lateralInhibitStrength)); // core
        markCircuitChipFired(chip); // core/visualizer/groups/connector/circuit.js
        this._launchFromPins(cfg, chips, chip, i, pitchNodeIndex, s);
    },

    /** Số chân theo năng lượng -> chip đích (pitch + dải tần onset) -> mỗi đích 1 xung chạy trên dây của chân tương ứng.
     * Bỏ qua khi đã đủ số xung đồng thời hoặc cặp đó đang có xung bay. */
    _launchFromPins(cfg, chips, chip, i, pitchNodeIndex, s) {
        const baseThresholdByte = cfg.fireThreshold * 255;
        const pinCount = pickFirePinCountFromEnergy(chip.frameEnergy, baseThresholdByte, cfg.maxPinsPerFire); // core/visualizer/groups/connector/circuit.js
        const targets = pickCircuitFireTargets(chips, i, pitchNodeIndex, pinCount, baseThresholdByte); // core
        const onBitCount = pickOnBitCountFromEnergy(chip.frameEnergy, baseThresholdByte); // core
        targets.forEach((t) => this._launchOne(cfg, chips, chip, i, t, onBitCount, s));
    },

    _launchOne(cfg, chips, chip, i, t, onBitCount, s) {
        const activeSignals = s.cnActiveSignalsCircuit;
        if (activeSignals.length >= cfg.maxConcurrentSignals) return;
        if (hasCircuitSignalBetween(activeSignals, chip, chips[t])) return; // core/webgl/three-connector.js
        const pin = chip.pins[chip.pinByTarget[t]];
        if (!pin || pin.wireIndex < 0) return;
        const wire = appState.get('cnWires')[pin.wireIndex];
        const signal = createCircuitSignal(chip, chips[t], wire, wire.a !== i, buildBitPattern(onBitCount), chip.color, s.cnSignalAssets, s.cnGroupCircuit); // core
        appState.mutate('cnActiveSignalsCircuit', (arr) => arr.push(signal), { skipCheck: true });
    },

    /** Orbit — chế độ cinematic ORBIT_SWEEP: trôi chậm quanh cụm chip. */
    _driftOrbitSweep(camera) {
        if (appState.get('cnActiveCamMode') !== 'ORBIT_SWEEP') return;
        driftOrbitSweepCamera(camera, cnClock.getElapsedTime()); // core/visualizer/groups/connector/circuit.js
    },
};

workflowVisualizerRender.registerGroup('connector', workflowVizConnector);
