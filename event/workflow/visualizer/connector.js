/**
 * event/workflow/visualizer/connector.js — Group "connector" (2 style WebGL: synapse + circuit).
 * [01/10/2026] Style 'brain' (canvas 2D) ĐÃ XOÁ HẲN theo Giang; dữ liệu audio đọc từ kho audioAnalysis
 * (frame.audio — service/audio-analysis.js) thay vì key appState.
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
// Nốt chỉ coi là "đang phát" nếu được cập nhật trong khoảng này (ms) — circuit.
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
    /** Cửa sổ beat flux riêng: circuit đổi góc máy (cinematic shift). */
    _cameraShiftWin: createBeatFluxWindow(), // core/visualizer/beat-window.js

    styles: {
        synapse: (frame) => workflowVizConnector._drawSynapse(frame),
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
        this._stepSynapse(frame, wf);
        appState.get('cnControls').update();
        appState.get('tRenderer').render(appState.get('cnScene'), appState.get('cnCamera'));
    },

    _drawCircuit(frame) {
        this._tickCameraShift(frame);
        const wf = this._beginWebglFrame();
        if (!wf) return;
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
        workflowVizBeatWindow.accumulateLatest(this._cameraShiftWin, frame.audio.fluxHistory()); // service/audio-analysis.js
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
        if (!frame.audio.isPitchFresh(CONNECTOR_PITCH_FRESH_MS)) return null; // service/audio-analysis.js (01/10/2026)
        const pitchHz = 440 * Math.pow(2, (frame.midiNote - 69) / 12);
        const ranges = Array.from({ length: chipCount }, (_, j) => tonotopicBinRange(j, chipCount, frame.bufferLength)); // core/visualizer/groups/connector/synapse.js
        return findTonotopicNodeForBin(ranges, frequencyToFftBin(pitchHz, frame.bufferLength, frame.audio.sampleRate())); // core
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
    // (Style 'brain' — canvas 2D: ĐÃ XOÁ HẲN 01/10/2026 theo Giang, cùng core/visualizer/groups/connector/brain.js.
    // Cấu hình đã lưu đang chọn brain -> synapse, xem core/config.js.)
};

workflowVisualizerRender.registerGroup('connector', workflowVizConnector);
