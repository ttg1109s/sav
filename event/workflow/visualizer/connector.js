/**
 * event/workflow/visualizer/connector.js — Group "connector" (3 style: synapse + circuit = WebGL, brain = canvas 2D).
 *
 * [TÁCH — 28/09/2026, Phase 3-4 dọn visualizer] Từ `_tickConnectorBeat/Render/Synapse/Circuit/Brain()` +
 * `_tickBrainBurstTrigger()` của event/workflow/visualizer-render.js cũ + các biến `_cn*`/`_br*`. Hành vi mỗi frame
 * giữ nguyên; thay đổi:
 *   - Vòng đời (Phase 3): resize đổi aspect camera + kích thước EffectComposer (trước đây KHÔNG xử lý — xoay máy
 *     làm synapse/circuit méo, bloom sai độ phân giải). Dựng lại theo Custom Effect (số neuron/node) dọn hết
 *     scene, texture, render target bloom, OrbitControls cũ trước (trước đây bỏ lại, listener chồng dần).
 *   - Seek/đổi bài qua hook host (`onSeek`/`onNewMedia`) thay cờ nằm trong host + lời gọi thẳng rải rác.
 *   - Beat flux dùng cửa sổ chung; rẽ nhánh -> guard + object map (readme/event-bus-flow.md mục 7).
 * Phase 5 (28/09/2026): scene dựng qua builder thuần (buildConnectorStage/buildConnectorComposer), góc máy/ẩn hiện
 * theo style + dọn khi đổi bài do Workflow điều phối. Còn di sản: buildSynapseNetwork/buildCircuitNodes (chuỗi builder
 * bên trong), fireNeuronActionPotential/spawnCircuitSignal (đọc appState).
 */

// Số frame giữ connector "ổn định lại" (không bắn, mỗi frame lấy FFT hiện tại làm baseline) sau lần seek CUỐI —
// analyser tự làm mượt FFT (smoothingTimeConstant 0.8) nên còn kéo đuôi audio CŨ ~0.2s sau khi media seek xong.
const CONNECTOR_SEEK_SETTLE_FRAMES = 15;
// Nốt (lastValidMidiNote) chỉ coi là "đang phát" nếu được cập nhật trong khoảng này (ms) — circuit + brain.
const CONNECTOR_PITCH_FRESH_MS = 300;

/** Kết quả updateCircuitSignal() -> việc cần làm (null/khác = đang bay, không làm gì). */
const CIRCUIT_SIGNAL_BY_RESULT = {
    destroy: (signal, index, activeSignals, cnGroupCircuit) => {
        destroyCircuitSignal(signal, cnGroupCircuit); // core/webgl/three-connector.js
        activeSignals.splice(index, 1);
    },
    arrive: (signal) => onCircuitSignalArrival(signal), // core/webgl/three-connector.js — GSAP shockwave + bắt đầu fade
};

/** Góc máy theo style — synapse nhìn thẳng lưới; circuit (và brain — nhánh `else` cũ) cho xoay/zoom. */
const CONNECTOR_CAMERA_VIEW_BY_STYLE = {
    synapse: (scene, camera, controls) => applySynapseCameraView(scene, camera, controls), // core/webgl/three-connector.js
    circuit: (scene, camera, controls) => applyCircuitCameraView(scene, camera, controls),
};

const workflowVizConnector = {
    usesWebgl: true,
    defaultStyle: 'circuit',

    /** >0 = đang "ổn định lại" sau seek, trừ dần mỗi frame WebGL. */
    _settleFrames: 0,
    /** Style 'brain' (canvas 2D): canvas WebGL đã xoá trắng chưa (tránh kẹt khung hình cuối của synapse/circuit). */
    _webglBlank: false,
    /** Cửa sổ beat flux riêng: circuit đổi góc máy (cinematic shift) và brain burst. */
    _cameraShiftWin: createBeatFluxWindow(), // core/visualizer/beat-window.js
    _burstWin: createBeatFluxWindow(),

    styles: {
        synapse: (frame) => workflowVizConnector._drawSynapse(frame),
        circuit: (frame) => workflowVizConnector._drawCircuit(frame),
        brain: (frame) => workflowVizConnector._drawBrain(frame),
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

    /** Custom Effect đổi số neuron/node (field refresh 'initThreeJSConnector' — tên lịch sử): dọn scene cũ rồi dựng lại. */
    rebuild() {
        this._disposeScene();
        this._build();
    },

    /** Phase 5 — THAY initThreeJSConnector() (core cũ): Workflow điều phối builder thuần + ghi appState. Mạng synapse
     * (buildSynapseNetwork) và lưới chip (buildCircuitNodes) vẫn là builder di sản trong core/webgl/three-connector.js. */
    _build() {
        const cfg = getEffectConfig('connector'); // core/custom-effect.js
        const renderer = workflowVisualizerRender.ensureSharedRenderer(Math.min(window.devicePixelRatio, 2)); // event/workflow/visualizer-render.js
        const width = window.innerWidth, height = window.innerHeight;
        const stage = buildConnectorStage(width / height, renderer); // core/webgl/three-connector.js
        const glowTexture = createGlowTexture(); // core
        const sparkTexture = createActionPotentialSparkTexture(); // core
        const { neurons, synapses } = this._buildSynapseNetwork(cfg.neuronCount, stage.groupSynapse, glowTexture, width / height);
        attachThreeChild(stage.groupSynapse, buildMicroscopicFluidParticles()); // core
        const chips = this._buildCircuitNodes(cfg.nodeCount, stage.groupCircuit);
        const post = buildConnectorComposer(renderer, stage.scene, stage.camera, width, height); // core
        const entries = {
            cnScene: stage.scene, cnCamera: stage.camera, cnControls: stage.controls,
            cnComposer: post.composer, cnBloomPass: post.bloomPass,
            cnGroupSynapse: stage.groupSynapse, cnGroupCircuit: stage.groupCircuit,
            cnNeurons: neurons, cnSynapses: synapses, cnChips: chips,
            cnActiveSignalsSynapse: [], cnActiveSignalsCircuit: [],
            cnGlowTexture: glowTexture, cnSparkTexture: sparkTexture,
            cnInitialized: true,
        };
        Object.keys(entries).forEach((key) => appState.set(key, entries[key], { skipCheck: true }));
        console.log(`writer: "workflowVizConnector._build", page: "cnScene/cnNeurons/cnChips/...", content: "dựng scene Connector (${neurons.length} neuron, ${chips.length} chip)"`);
        this._applyStyleView(cfg.connectorStyle);
    },

    /** Lưới neuron phẳng lấp đầy khung nhìn -> đồ thị sợi trục -> từng neuron (màu theo color mode) -> từng sợi trục.
     * THAY buildSynapseNetwork() (core cũ gọi 6 core khác). Thứ tự tạo (và tiêu thụ Math.random) giữ nguyên. */
    _buildSynapseNetwork(neuronCount, networkGroup, glowTexture, aspect) {
        const dims = computeSynapseGridDims(neuronCount, aspect); // core/webgl/three-connector.js
        const { cells, cellSize } = buildSynapseGridCells(neuronCount, dims, computeSynapseVisibleFrustum(aspect)); // core
        const meshScale = computeConnectorMeshScale(cellSize); // core
        const { edges, inDegree } = buildSynapseGraph(cells); // core
        const neurons = cells.map((cell, i) => {
            const color = getComputedColor(i, neuronCount, 128); // core/audio-analysis.js
            const neuron = createAnatomicalNeuron(i, cell.position, inDegree[i], new THREE.Color(color.fillNoAlpha).getHex(), new THREE.Color(color.glow).getHex(), glowTexture, meshScale); // core
            attachThreeChild(networkGroup, neuron.container); // core
            return neuron;
        });
        const synapses = edges.map((edge) => createPhysicalSynapticAxon(neurons[edge.from], neurons[edge.to], neurons[edge.from].fillColorHex, meshScale)); // core
        return { neurons, synapses };
    },

    /** Chip theo lưới lập phương (lớp ngoài vào trong) -> màu -> mesh -> dữ liệu chip -> láng giềng. THAY buildCircuitNodes(). */
    _buildCircuitNodes(nodeCount, nodeGroup) {
        const { cells } = buildCircuitCubeCells(nodeCount); // core/webgl/three-connector.js
        const chips = cells.map((cell, i) => {
            const colorHex = new THREE.Color(getComputedColor(i, cells.length, 128).fillNoAlpha).getHex(); // core/audio-analysis.js — fillNoAlpha tránh cảnh báo alpha của THREE.Color
            const chip = assembleCircuitChip(cell, i, colorHex, createChipMesh(colorHex)); // core
            attachThreeChild(nodeGroup, chip.group); // core
            return chip;
        });
        linkCircuitChipNeighbors(chips); // core
        return chips;
    },

    /** Ẩn/hiện nhóm + góc máy theo style (THAY updateConnectorVisibility()). Dừng tween cinematic đang chạy trước. */
    _applyStyleView(style) {
        const s = appState.get(['cnScene', 'cnCamera', 'cnControls', 'cnGroupSynapse', 'cnGroupCircuit']);
        stopThreeCameraTweens(s.cnCamera, s.cnControls); // core/webgl/three-common.js
        setConnectorGroupVisibility(s.cnGroupSynapse, s.cnGroupCircuit, style); // core/webgl/three-connector.js
        (CONNECTOR_CAMERA_VIEW_BY_STYLE[style] || CONNECTOR_CAMERA_VIEW_BY_STYLE.circuit)(s.cnScene, s.cnCamera, s.cnControls);
    },

    _disposeScene() {
        if (!appState.get('cnInitialized')) return;
        const s = appState.get(['cnScene', 'cnCamera', 'cnControls', 'cnComposer', 'cnGlowTexture', 'cnSparkTexture']);
        stopThreeCameraTweens(s.cnCamera, s.cnControls); // core/webgl/three-common.js
        disposeOrbitControls(s.cnControls); // core
        disposeThreeComposer(s.cnComposer); // core
        disposeThreeObjectTree(s.cnScene); // core
        disposeThreeTexture(s.cnGlowTexture); // core
        disposeThreeTexture(s.cnSparkTexture); // core
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

    /** Đổi bài/video: dọn tia/xung đang bay + đưa neuron/chip về trạng thái nghỉ (THAY resetConnectorPerTrackState()). */
    onNewMedia() {
        if (!appState.get('cnInitialized')) return;
        const { cnNeurons, cnChips } = appState.get(['cnNeurons', 'cnChips']);
        cnNeurons.forEach((n) => rebaselineTonotopicNode(n, 0)); // core/visualizer/groups/connector/synapse.js — năng lượng/thích nghi/ức chế về 0
        this._clearSynapseSignals();
        this._clearCircuitSignals(cnChips);
        releaseCircuitPins(cnChips); // core/visualizer/groups/connector/circuit.js — kể cả khi không còn xung nào
        cnChips.forEach((c) => rebaselineTonotopicNode(c, 0)); // core
    },

    // ===================== Frame — WebGL (synapse / circuit) =====================

    _drawSynapse(frame) {
        this._tickCameraShift(frame);
        const wf = this._beginWebglFrame();
        if (!wf) return;
        this._webglBlank = false;
        this._stepSynapse(frame, wf);
        appState.get('cnControls').update();
        appState.get('tRenderer').render(appState.get('cnScene'), appState.get('cnCamera'));
    },

    _drawCircuit(frame) {
        this._tickCameraShift(frame);
        const wf = this._beginWebglFrame();
        if (!wf) return;
        this._webglBlank = false;
        this._stepCircuit(frame, wf);
        appState.get('cnControls').update();
        appState.get('cnComposer').render();
    },

    /** Phần đầu chung mỗi frame WebGL: null nếu scene chưa dựng. Luôn tiêu thụ đồng hồ + trừ cửa sổ ổn định
     * (kể cả style brain) — đúng như `_tickConnectorRender()` cũ. */
    _beginWebglFrame() {
        if (!appState.get('cnInitialized')) return null;
        const isSettling = this._settleFrames > 0;
        this._settleFrames = Math.max(0, this._settleFrames - 1);
        return {
            glowIntensity: getConnectorGlowMult() * 100, // core/custom-effect.js
            deltaTime: Math.min(cnClock.getDelta(), 0.1), // core/webgl/three-connector.js
            isSettling,
        };
    },

    /** Circuit: nhạc chuyển đoạn -> đổi góc máy (cinematic shift). Tích luỹ flux MỖI FRAME (chỉ khi đang ở
     * circuit + bật camera shift), tiêu thụ beat ở MỌI style — giữ đúng thứ tự gốc. */
    _tickCameraShift(frame) {
        const win = this._cameraShiftWin;
        const cfg = frame.cfg;
        this._accumulateCameraShiftFlux(frame);
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.lastBeatTime)) return;
        if (!frame.isPlaying || frame.style !== 'circuit') return;
        if (!cfg.cameraShiftEnabled) return;
        workflowVizBeatWindow.closeInterval(win);
        countBeatSinceTrigger(win); // core/visualizer/beat-window.js
        if (win.beatsSinceTrigger < 2) return;
        if (!detectMusicTransition(win.history, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return; // core/audio-analysis.js
        resetBeatTriggerCount(win); // core
        const s = appState.get(['cnCamera', 'cnControls', 'cnChips', 'cnActiveSignalsCircuit']);
        const mode = triggerCinematicCameraShift(s.cnCamera, s.cnControls, s.cnChips, s.cnActiveSignalsCircuit); // core/webgl
        appState.set('cnActiveCamMode', mode, { skipCheck: true });
    },

    _accumulateCameraShiftFlux(frame) {
        if (frame.style !== 'circuit' || !frame.cfg.cameraShiftEnabled) return;
        workflowVizBeatWindow.accumulateLatest(this._cameraShiftWin, appState.get('fluxHistory'));
    },

    _stepSynapse(frame, wf) {
        const cfg = frame.cfg;
        const neurons = appState.get('cnNeurons');
        this._clearSynapseSignalsWhenSettling(wf.isSettling); // tia sinh trước seek — xoá NGAY, không để bay tiếp
        const speed = computeConnectorSpeed(cfg.synapseSpeedBase, cfg.synapseSpeedEnergyMult, frame.smoothedEnergy); // core/webgl

        neurons.forEach((neuron, i) => {
            const rawPeak = computeBinRangePeak(frame.vizDataArray, tonotopicBinRange(i, neurons.length, frame.bufferLength)); // core/visualizer/groups/connector/synapse.js — đỉnh dải tần tonotopic (log)
            this._rebaselineWhenSettling(neuron, rawPeak, wf.isSettling); // frame này KHÔNG phải onset (diff = 0)
            const energyByte = applyTonotopicSmoothing(neuron, rawPeak, i, neurons.length); // core — mượt-hoá tăng dần theo tần số
            const diff = energyByte - neuron.prevBinEnergy;
            this._fireNeuron(frame, wf, neuron, i, energyByte, diff);
            neuron.prevBinEnergy = energyByte;
            decayNeuronState(neuron, wf.deltaTime); // core — fade glow + adaptation + lateralInhibition
            const color = getComputedColor(i, neurons.length, energyByte); // core/audio-analysis.js
            applyNeuronExcitement(neuron, color.fillNoAlpha, color.glow); // core
            applyConnectorGlowSettings(neuron.glowSprite, cfg.glowEnabled, wf.glowIntensity); // core/visualizer/groups/connector/common.js
        });

        const activeSignals = appState.get('cnActiveSignalsSynapse');
        for (let i = activeSignals.length - 1; i >= 0; i--) {
            const signal = activeSignals[i];
            const arrived = stepActionPotential(signal, signal.synapse, speed * signal.speedMult, wf.deltaTime); // core — tốc độ nền × độ mạnh onset đã sinh ra tia
            if (!arrived) continue;
            signal.synapse.fromNeuron.container.remove(signal.mesh); // spark là con của neuron nguồn (fireNeuronActionPotential)
            signal.mesh.geometry.dispose(); signal.mesh.material.dispose();
            activeSignals.splice(i, 1);
            setNeuronEnergy(signal.synapse.toNeuron, 2.2); // core/webgl/three-connector.js — neuron đích sáng lên khi tia tới
        }
    },

    /** Onset (biên độ tăng vượt ngưỡng hiệu dụng) -> thích nghi + ức chế neuron lân cận + bắn điện thế hoạt động. */
    _fireNeuron(frame, wf, neuron, i, energyByte, diff) {
        const cfg = frame.cfg;
        const thresholdByte = computeEffectiveFireThresholdByte(neuron, cfg); // core/visualizer/groups/connector/synapse.js
        if (!shouldFireTonotopicNode(frame.isPlaying, wf.isSettling, diff, energyByte, thresholdByte)) return; // core
        triggerNeuronAdaptation(neuron); // core — tự đè ngưỡng lên (refractory)
        neuron.connectedSynapses.forEach((s) => applyLateralInhibition(s.toNeuron, cfg.lateralInhibitStrength)); // core
        neuron.incomingSynapses.forEach((s) => applyLateralInhibition(s.fromNeuron, cfg.lateralInhibitStrength)); // core
        const sparks = launchActionPotentialSparks(neuron, appState.get('cnSparkTexture'), Math.min(2.2, 1.2 + diff / 60), computeSignalSpeedMult(diff)); // core/webgl/three-connector.js
        appState.mutate('cnActiveSignalsSynapse', (arr) => arr.push(...sparks), { skipCheck: true });
    },

    _rebaselineWhenSettling(node, rawPeak, isSettling) {
        if (!isSettling) return;
        rebaselineTonotopicNode(node, rawPeak); // core/visualizer/groups/connector/synapse.js
    },

    /** Xoá mọi tia synapse đang bay (dispose mesh) — chỉ khi đang ổn định lại sau seek. */
    _clearSynapseSignalsWhenSettling(isSettling) {
        if (!isSettling) return;
        this._clearSynapseSignals();
    },

    _clearSynapseSignals() {
        const activeSignals = appState.get('cnActiveSignalsSynapse');
        if (activeSignals.length === 0) return;
        activeSignals.forEach((signal) => {
            signal.synapse.fromNeuron.container.remove(signal.mesh);
            signal.mesh.geometry.dispose(); signal.mesh.material.dispose();
        });
        appState.set('cnActiveSignalsSynapse', [], { skipCheck: true });
        console.log(`writer: "workflowVizConnector._clearSynapseSignalsWhenSettling", page: "cnActiveSignalsSynapse", content: "xoá ${activeSignals.length} tia (seek/đổi bài)"`);
    },

    /** Xoá mọi xung circuit đang bay + trả pin về rảnh — chỉ khi đang ổn định lại sau seek. */
    _clearCircuitSignalsWhenSettling(chips, isSettling) {
        if (!isSettling) return;
        this._clearCircuitSignals(chips);
    },

    _clearCircuitSignals(chips) {
        const activeSignals = appState.get('cnActiveSignalsCircuit');
        if (activeSignals.length === 0) return;
        const cnGroupCircuit = appState.get('cnGroupCircuit');
        activeSignals.forEach((signal) => destroyCircuitSignal(signal, cnGroupCircuit)); // core/webgl/three-connector.js
        appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
        console.log(`writer: "workflowVizConnector._clearCircuitSignalsWhenSettling", page: "cnActiveSignalsCircuit", content: "xoá ${activeSignals.length} xung (seek/đổi bài)"`);
        chips.forEach((chip) => chip.pins.forEach((pin) => { pin.busy = false; }));
    },

    _stepCircuit(frame, wf) {
        const cfg = frame.cfg;
        const chips = appState.get('cnChips');
        this._clearCircuitSignalsWhenSettling(chips, wf.isSettling); // xung sinh trước seek — xoá NGAY, trả pin về rảnh
        const activeSignals = appState.get('cnActiveSignalsCircuit');
        const cnGroupCircuit = appState.get('cnGroupCircuit');
        const speed = computeConnectorSpeed(cfg.circuitSpeedBase, cfg.circuitSpeedEnergyMult, frame.smoothedEnergy); // core/webgl
        appState.get('cnBloomPass').strength = computeConnectorSpeed(cfg.bloomStrengthBase, cfg.bloomStrengthEnergyMult, frame.smoothedEnergy); // core/webgl
        const pitchNodeIndex = this._resolvePitchNodeIndex(frame, chips.length);

        chips.forEach((chip, i) => {
            const chipColor = getComputedColor(i, chips.length, 128); // core/audio-analysis.js — dataValue=128 như lúc build
            applyChipLiveColor(chip, chipColor.fillNoAlpha); // core/visualizer/groups/connector/circuit.js
            applyChipGlowSettings(chip.bodyMesh, cfg.glowEnabled, wf.glowIntensity); // core/visualizer/groups/connector/common.js
            decayChipSpin(chip, wf.deltaTime); // core

            const rawPeak = computeBinRangePeak(frame.vizDataArray, tonotopicBinRange(i, chips.length, frame.bufferLength)); // core/visualizer/groups/connector/synapse.js
            this._rebaselineWhenSettling(chip, rawPeak, wf.isSettling);
            const energyByte = applyTonotopicSmoothing(chip, rawPeak, i, chips.length); // core
            const diff = energyByte - chip.prevBinEnergy;
            this._fireChip(frame, wf, chips, chip, i, energyByte, diff, activeSignals, cnGroupCircuit, pitchNodeIndex);
            chip.prevBinEnergy = energyByte;
            decayNeuronState(chip, wf.deltaTime); // core
        });

        this._driftOrbitSweep();

        for (let i = activeSignals.length - 1; i >= 0; i--) {
            const signal = activeSignals[i];
            const result = updateCircuitSignal(signal, wf.deltaTime, speed, cfg.trailLength); // core/visualizer/groups/connector/circuit.js
            (CIRCUIT_SIGNAL_BY_RESULT[result] || VIZ_NOOP)(signal, i, activeSignals, cnGroupCircuit);
        }
    },

    /** Node (chip) mà nốt đang phát rơi vào dải tần — đích ưu tiên của xung; null nếu không có nốt "tươi". */
    _resolvePitchNodeIndex(frame, chipCount) {
        if (!frame.isPlaying || chipCount <= 1) return null;
        const { lastValidMidiNote, lastValidNoteTime, audioContext } = appState.get(['lastValidMidiNote', 'lastValidNoteTime', 'audioContext']);
        if (!audioContext || !isPitchNoteFresh(lastValidMidiNote, lastValidNoteTime, Date.now(), CONNECTOR_PITCH_FRESH_MS)) return null; // core/audio-analysis.js
        const pitchHz = 440 * Math.pow(2, (lastValidMidiNote - 69) / 12);
        const ranges = Array.from({ length: chipCount }, (_, j) => tonotopicBinRange(j, chipCount, frame.bufferLength)); // core/visualizer/groups/connector/synapse.js
        return findTonotopicNodeForBin(ranges, frequencyToFftBin(pitchHz, frame.bufferLength, audioContext.sampleRate)); // core
    },

    _fireChip(frame, wf, chips, chip, i, energyByte, diff, activeSignals, cnGroupCircuit, pitchNodeIndex) {
        const cfg = frame.cfg;
        if (!shouldFireTonotopicNode(frame.isPlaying, wf.isSettling, diff, energyByte, computeEffectiveFireThresholdByte(chip, cfg))) return; // core/visualizer/groups/connector/synapse.js
        triggerNeuronAdaptation(chip); // core
        chip.neighbors.forEach((n) => applyLateralInhibition(chips[n], cfg.lateralInhibitStrength)); // core
        this._spawnCircuitPulse(cfg, chips, chip, i, energyByte, activeSignals, cnGroupCircuit, pitchNodeIndex);
    },

    /** Bắn 1 xung từ chip nguồn tới đích (theo pitch nếu có) — bỏ qua khi đã đủ số xung đồng thời, không có đích,
     * hoặc không còn pin rảnh. */
    _spawnCircuitPulse(cfg, chips, chip, i, energyByte, activeSignals, cnGroupCircuit, pitchNodeIndex) {
        if (activeSignals.length >= cfg.maxConcurrentSignals) return;
        const targetIndex = pickCircuitTargetIndex(chips, i, pitchNodeIndex); // core/visualizer/groups/connector/circuit.js
        if (targetIndex === null) return;
        const onBitCount = pickOnBitCountFromEnergy(energyByte, cfg.fireThreshold * 255); // core
        const signal = this._createCircuitSignal(chip, chips[targetIndex], activeSignals, onBitCount, cnGroupCircuit);
        if (!signal) return;
        appState.mutate('cnActiveSignalsCircuit', (arr) => arr.push(signal), { skipCheck: true });
        pulseChipOnFire(chip); // core/webgl/three-connector.js
    },

    /** 1 xung từ chip nguồn tới chip đích (null nếu đích thiếu/trùng nguồn hoặc cặp này đang có xung bay): pin gần nhất 2
     * đầu -> đường Manhattan 3D -> mẫu bit -> mesh xung + bit. THAY spawnCircuitSignal()/createCircuitSignal() gọi lồng. */
    _createCircuitSignal(sourceChip, targetChip, activeSignals, onBitCount, cnGroupCircuit) {
        if (!targetChip || targetChip === sourceChip) return null;
        if (hasCircuitSignalBetween(activeSignals, sourceChip, targetChip)) return null; // core/webgl/three-connector.js
        const sourcePin = pickNearestFreePin(sourceChip, targetChip.pos); // core
        const targetPin = pickNearestFreePin(targetChip, sourceChip.pos); // core
        const { startPos, endPos } = computeCircuitSignalEndpoints(sourceChip, targetChip, sourcePin, targetPin); // core
        const pathPoints = create3DManhattanPath(startPos, endPos); // core
        const signal = createCircuitSignal(sourceChip, targetChip, sourcePin, targetPin, startPos, pathPoints, buildBitPattern(onBitCount), cnGroupCircuit); // core (+ circuit.js)
        initCircuitSignalBits(signal); // core
        return signal;
    },

    /** Chế độ camera ORBIT_SWEEP: trôi chậm quanh cụm chip. */
    _driftOrbitSweep() {
        if (appState.get('cnActiveCamMode') !== 'ORBIT_SWEEP') return;
        driftOrbitSweepCamera(appState.get('cnCamera'), cnClock.getElapsedTime()); // core/visualizer/groups/connector/circuit.js
    },

    // ===================== Frame — canvas 2D (brain) =====================

    /** Brain vẽ canvas 2D (host đã clearRect); canvas WebGL xoá trắng 1 lần để không kẹt khung cuối synapse/circuit.
     * SỬA (28/09/2026, Phase 5) — THAY brainFilterOriginal.draw(): Workflow điều phối các core thuần của
     * core/visualizer/groups/connector/brain.js (thứ tự bước/vẽ giữ nguyên bản cũ). */
    _drawBrain(frame) {
        this._tickCameraShift(frame); // tiêu thụ beat như mọi style (đúng thứ tự cũ)
        this._blankWebglOnce(this._beginWebglFrame());
        this._fireBrainBurst(this._isBrainBurstDue(frame));
        const s = appState.get(['audioContext', 'lastValidNoteTime', 'currentCalculatedBpm']);
        const brain = this._brain;
        const tuning = computeBrainTuning(frame.cfg); // core/visualizer/groups/connector/brain.js
        const time = performance.now();
        const bpm = parseFloat(s.currentCalculatedBpm);
        const sampleRate = s.audioContext ? s.audioContext.sampleRate : 44100;
        const noteFresh = isPitchNoteFresh(frame.midiNote, s.lastValidNoteTime, Date.now(), CONNECTOR_PITCH_FRESH_MS); // core/audio-analysis.js
        const colors = [0, 1, 2].map((role) => getComputedColor(role, 3, 128)); // core/audio-analysis.js — 0 viền/node/hạt, 1 viền phụ, 2 dây ra
        const spectrum = { vizDataArray: frame.vizDataArray, bufferLength: frame.bufferLength, sampleRate };

        this._ensureBrainLayout(frame.canvas, frame.cfg.brainDirection || 'ltr', tuning.signalCount);
        stepBrainInputPump(brain, tuning, time, frame.beatScale, frame.isPlaying); // core
        stepBrainFilterFlux(brain, tuning, time, this._brainBandEnergies(frame)); // core
        stepBrainOrbit(brain, tuning, time, bpm, frame.isPlaying, this._brainCentroid(frame)); // core
        this._stepBrainStrings(brain, tuning, time, frame, noteFresh, bpm, spectrum);

        const layout = brain.layout;
        advanceBrainParticles(brain.particles, tuning.speedMultiplier); // core
        const points = brain.particles.map((p) => this._brainParticlePoint(brain.inputPaths[p.pathIndex], p.t));
        beginBrainPaint(frame.ctx, layout.matrix); // core
        drawBrainInputCurves(frame.ctx, brain.inputPaths, colors[0]); // core
        drawBrainParticles(frame.ctx, brain.particles, points, colors[0], tuning.glowMult); // core
        settleBrainParticles(brain.particles, points, brain.bursts, tuning.filterStrictness, colors[0].glow); // core
        drawBrainBursts(frame.ctx, brain.bursts, tuning.glowMult); // core
        advanceBrainBursts(brain.bursts); // core
        this._drawBrainStrings(frame.ctx, brain, tuning, time, colors[2]);
        saveBrainCanvas(frame.ctx); // core
        drawBrainFilterShell(frame.ctx, layout.filterPos, time, colors[0], colors[1], tuning.glowMult); // core
        this._drawBrainFilterNodes(frame.ctx, brain, tuning, colors[0]);
        restoreBrainCanvas(frame.ctx); // core
        this._drawBrainOrbit(frame.ctx, brain, tuning, colors[0]);
        restoreBrainCanvas(frame.ctx); // core — đóng beginBrainPaint()
    },

    /** Trạng thái brain (KHÔNG thuộc STATE) — core/visualizer/groups/connector/brain.js::createBrainState(). */
    _brain: createBrainState(),

    /** Dựng lại bố cục + đường/hạt/node khi đổi kích thước canvas, hướng chảy hoặc số tín hiệu vào. Thứ tự dựng (và
     * tiêu thụ Math.random) giữ nguyên initNodesAndPaths() cũ: node -> đường vào + hạt -> dây ra. */
    _ensureBrainLayout(canvasEl, direction, signalCount) {
        const brain = this._brain;
        const key = computeBrainLayoutKey(canvasEl.width, canvasEl.height, direction, signalCount); // core
        if (key === brain.layoutKey) return;
        brain.layoutKey = key;
        const layout = computeBrainLayout(canvasEl.width, canvasEl.height, direction); // core
        brain.layout = layout;
        brain.filterNodes = buildBrainFilterNodes(layout.filterPos); // core
        const input = buildBrainInputPathsAndParticles(signalCount, layout.filterPos, layout.leftPersonPos); // core
        brain.inputPaths = input.inputPaths;
        brain.particles = input.particles;
        brain.outputPaths = buildBrainOutputPaths(layout.filterPos, layout.rightPersonPos, layout.width, layout.stageH); // core
        brain.outputPaths.forEach((path) => {
            const samples = Array.from({ length: BRAIN_ARC_LUT_SAMPLES + 1 }, (_, k) => computeBrainBezierPoint(path, k / BRAIN_ARC_LUT_SAMPLES)); // core
            path.arcLut = buildBrainArcLengthLut(samples); // core — dot chạy đều tốc độ dọc dây
        });
    },

    /** Năng lượng 0-1 của 16 dải tonotopic cho chớp node bộ lọc. */
    _brainBandEnergies(frame) {
        return Array.from({ length: BRAIN_FILTER_FLUX_BAND_COUNT }, (_, b) => computeBinRangePeak(frame.vizDataArray, tonotopicBinRange(b, BRAIN_FILTER_FLUX_BAND_COUNT, frame.bufferLength)) / 255); // core/visualizer/groups/connector/synapse.js
    },

    /** Trọng tâm phổ — chỉ khi đang phát (dừng -> 0, dot quỹ đạo nhỏ/mờ dần). */
    _brainCentroid(frame) {
        if (!frame.isPlaying) return 0;
        return computeBrainSpectralCentroid(frame.vizDataArray, frame.bufferLength); // core
    },

    /** Vị trí hạt trên đường vào; đường không còn (hiếm) -> null (bỏ qua, như bản cũ). */
    _brainParticlePoint(path, t) {
        if (!path) return null;
        return computeBrainBezierPoint(path, t); // core
    },

    /** Dây ra: nốt hiện tại -> biên độ rung + (nốt mới) 1 đoàn dot mới; rồi tiến các đoàn đang chạy. */
    _stepBrainStrings(brain, tuning, time, frame, noteFresh, bpm, spectrum) {
        const noteEnergy = computeBrainFreqEnergy(computeBrainNoteFrequency(frame.midiNote), spectrum.vizDataArray, spectrum.bufferLength, spectrum.sampleRate); // core
        const step = stepBrainStringNote(brain, tuning, time, frame.midiNote, noteFresh, frame.isPlaying, bpm, noteEnergy); // core
        this._startBrainTrain(brain, tuning, step.newTrain, spectrum);
        const liveTargets = brain.strings.trains.map((tr) => this._brainLiveTrainTarget(tr, tuning, spectrum));
        advanceBrainStringTrains(brain, tuning, time, step.dt, liveTargets); // core
    },

    _startBrainTrain(brain, tuning, train, spectrum) {
        if (!train) return;
        const count = computeBrainTrainCount(train.midi); // core
        startBrainStringTrain(brain, train, count, this._brainTrainOffsets(train.midi, count, tuning, spectrum)); // core
    },

    /** Khoảng cách dot mục tiêu theo hoạ âm HIỆN TẠI (toggle "khoảng cách sống"; đoàn 1 dot không cần). */
    _brainLiveTrainTarget(train, tuning, spectrum) {
        if (!tuning.stringDotGapLive || train.count <= 1) return null;
        return this._brainTrainOffsets(train.midi, train.count, tuning, spectrum);
    },

    /** Năng lượng các hoạ âm bậc 2..count của nốt -> khoảng cách dot. */
    _brainTrainOffsets(midi, count, tuning, spectrum) {
        const f0 = computeBrainNoteFrequency(midi); // core
        const energies = Array.from({ length: Math.max(0, count - 1) }, (_, j) => computeBrainFreqEnergy(f0 * (j + 2), spectrum.vizDataArray, spectrum.bufferLength, spectrum.sampleRate)); // core
        return computeBrainTrainOffsets(energies, tuning.stringDotGapMin, tuning.stringDotGapMax); // core
    },

    /** Dây ra + đoàn dot + chấm đầu dây (toggle brainShowStrings). */
    _drawBrainStrings(ctx, brain, tuning, time, color) {
        if (!tuning.showStrings) return;
        const lines = brain.outputPaths.map((path, s) => this._brainStringLine(brain, tuning, s, time));
        const trainDots = [];
        brain.strings.trains.forEach((tr) => {
            const head = (time - tr.startTime) / tr.runMs;
            for (let j = 0; j < tr.count; j++) {
                const u = head - tr.offsets[j];
                if (u < 0 || u > 1) continue;
                const pt = this._brainStringPoint(brain, tuning, tr.stringIdx, computeBrainArcT(brain.outputPaths[tr.stringIdx].arcLut, u), time); // core
                trainDots.push({ x: pt.x, y: pt.y, alpha: Math.min(1, u / 0.12) });
            }
        });
        drawBrainOutputStrings(ctx, brain.outputPaths, brain.strings.amp, lines, trainDots, brain.strings.endFlash, color, tuning.glowMult); // core
    },

    /** Điểm mẫu của 1 dây đang rung; dây gần như đứng yên (biên độ < 0.01) -> null (vẽ bezier thẳng). */
    _brainStringLine(brain, tuning, s, time) {
        if (brain.strings.amp[s] < 0.01) return null;
        return Array.from({ length: BRAIN_STRING_SAMPLES + 1 }, (_, k) => this._brainStringPoint(brain, tuning, s, k / BRAIN_STRING_SAMPLES, time));
    },

    /** Điểm trên dây s tại t = điểm bezier + độ lệch rung. */
    _brainStringPoint(brain, tuning, s, t, time) {
        const pt = computeBrainBezierPoint(brain.outputPaths[s], t); // core
        return { x: pt.x, y: pt.y + computeBrainStringOffsetY(brain.strings.amp[s], brain.layout.stageH, tuning.stringAmpMaxFrac, s, t, time) }; // core
    },

    /** Dây nối + node bộ lọc (toggle brainShowNodes) — dây vẽ theo vị trí trước khi node nhích, node vẽ sau khi nhích. */
    _drawBrainFilterNodes(ctx, brain, tuning, primary) {
        if (!tuning.showNodes) return;
        drawBrainFilterLinks(ctx, brain.filterNodes, brain.flux.flash, brain.layout.filterPos, primary); // core
        advanceBrainFilterNodes(brain.filterNodes); // core
        drawBrainFilterNodes(ctx, brain.filterNodes, brain.flux.flash, primary, tuning.glowMult); // core
    },

    /** Dot quỹ đạo (toggle brainShowOrbit). */
    _drawBrainOrbit(ctx, brain, tuning, primary) {
        if (!tuning.showOrbit) return;
        drawBrainOrbitDots(ctx, brain.orbit, tuning, brain.layout.filterPos, primary); // core
    },

    /** `wf` null = scene WebGL chưa dựng -> không có gì để xoá. */
    _blankWebglOnce(wf) {
        if (!wf || this._webglBlank) return;
        appState.get('tRenderer').clear();
        this._webglBlank = true;
    },

    _fireBrainBurst(isDue) {
        if (!isDue) return;
        triggerBrainBurst(this._brain); // core/visualizer/groups/connector/brain.js
    },

    /** Brain burst khi nhạc chuyển đoạn (toggle burstEnabled) — cửa sổ beat flux riêng, debounce 2 beat. */
    _isBrainBurstDue(frame) {
        const cfg = frame.cfg;
        if (!cfg.burstEnabled) return false;
        const win = this._burstWin;
        workflowVizBeatWindow.accumulateLatest(win, appState.get('fluxHistory'));
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.lastBeatTime)) return false;
        if (!frame.isPlaying) return false;
        workflowVizBeatWindow.closeInterval(win);
        countBeatSinceTrigger(win); // core/visualizer/beat-window.js
        if (win.beatsSinceTrigger < 2) return false;
        if (!detectMusicTransition(win.history, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return false; // core/audio-analysis.js
        resetBeatTriggerCount(win); // core
        return true;
    },
};

workflowVisualizerRender.registerGroup('connector', workflowVizConnector);
