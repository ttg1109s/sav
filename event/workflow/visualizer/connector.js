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
 * Scene vẫn dựng bằng `initThreeJSConnector()` (core/webgl/three-connector.js, di sản — làm thuần ở Phase 5).
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

    activate() {
        this._ensureInitialized();
        updateConnectorVisibility(); // core/webgl/three-connector.js
    },

    _ensureInitialized() {
        if (appState.get('cnInitialized')) return;
        initThreeJSConnector(); // core/webgl/three-connector.js (di sản) — tự gọi updateConnectorVisibility()
    },

    /** Custom Effect đổi số neuron/node (field refresh 'initThreeJSConnector'): dọn scene cũ rồi dựng lại. */
    rebuild() {
        this._disposeScene();
        initThreeJSConnector(); // core/webgl/three-connector.js
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

    /** Đổi bài/video: dọn tia/xung đang bay + đưa neuron/chip về trạng thái nghỉ. */
    onNewMedia() {
        resetConnectorPerTrackState(); // core/webgl/three-connector.js (tự guard chưa dựng scene)
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
            const rawPeak = computeNeuronBinEnergy(frame.vizDataArray, frame.bufferLength, i, neurons.length); // core/visualizer/groups/connector/synapse.js — dải tần tonotopic (log)
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
            litNeuronFromSignalArrival(signal.synapse.toNeuron.id); // core/webgl/three-connector.js
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
        fireNeuronActionPotential(i, Math.min(2.2, 1.2 + diff / 60), computeSignalSpeedMult(diff)); // core/webgl/three-connector.js
    },

    _rebaselineWhenSettling(node, rawPeak, isSettling) {
        if (!isSettling) return;
        rebaselineTonotopicNode(node, rawPeak); // core/visualizer/groups/connector/synapse.js
    },

    /** Xoá mọi tia synapse đang bay (dispose mesh) — chỉ khi đang ổn định lại sau seek. */
    _clearSynapseSignalsWhenSettling(isSettling) {
        if (!isSettling) return;
        const activeSignals = appState.get('cnActiveSignalsSynapse');
        if (activeSignals.length === 0) return;
        activeSignals.forEach((signal) => {
            signal.synapse.fromNeuron.container.remove(signal.mesh);
            signal.mesh.geometry.dispose(); signal.mesh.material.dispose();
        });
        appState.set('cnActiveSignalsSynapse', [], { skipCheck: true });
        console.log(`writer: "workflowVizConnector._clearSynapseSignalsWhenSettling", page: "cnActiveSignalsSynapse", content: "xoá ${activeSignals.length} tia sau seek"`);
    },

    /** Xoá mọi xung circuit đang bay + trả pin về rảnh — chỉ khi đang ổn định lại sau seek. */
    _clearCircuitSignalsWhenSettling(chips, isSettling) {
        if (!isSettling) return;
        const activeSignals = appState.get('cnActiveSignalsCircuit');
        if (activeSignals.length === 0) return;
        const cnGroupCircuit = appState.get('cnGroupCircuit');
        activeSignals.forEach((signal) => destroyCircuitSignal(signal, cnGroupCircuit)); // core/webgl/three-connector.js
        appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
        console.log(`writer: "workflowVizConnector._clearCircuitSignalsWhenSettling", page: "cnActiveSignalsCircuit", content: "xoá ${activeSignals.length} xung sau seek"`);
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

            const rawPeak = computeNeuronBinEnergy(frame.vizDataArray, frame.bufferLength, i, chips.length); // core/visualizer/groups/connector/synapse.js
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
        return tonotopicNodeIndexForFrequency(pitchHz, chipCount, frame.bufferLength, audioContext.sampleRate); // core/visualizer/groups/connector/synapse.js
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
        const signal = spawnCircuitSignal(chip, chips[targetIndex], activeSignals, onBitCount, cnGroupCircuit); // core/webgl
        if (!signal) return;
        appState.mutate('cnActiveSignalsCircuit', (arr) => arr.push(signal), { skipCheck: true });
        pulseChipOnFire(chip); // core/webgl/three-connector.js
    },

    /** Chế độ camera ORBIT_SWEEP: trôi chậm quanh cụm chip. */
    _driftOrbitSweep() {
        if (appState.get('cnActiveCamMode') !== 'ORBIT_SWEEP') return;
        driftOrbitSweepCamera(appState.get('cnCamera'), cnClock.getElapsedTime()); // core/visualizer/groups/connector/circuit.js
    },

    // ===================== Frame — canvas 2D (brain) =====================

    /** Brain vẽ canvas 2D (host đã clearRect); canvas WebGL xoá trắng 1 lần để không kẹt khung cuối synapse/circuit. */
    _drawBrain(frame) {
        this._tickCameraShift(frame); // tiêu thụ beat như mọi style (đúng thứ tự cũ)
        this._blankWebglOnce(this._beginWebglFrame());
        this._fireBrainBurst(this._isBrainBurstDue(frame));
        const s = appState.get(['audioContext', 'lastValidNoteTime', 'currentCalculatedBpm']);
        brainFilterOriginal.draw(frame.ctx, frame.canvas, {
            time: performance.now(),
            lastBeatTime: frame.lastBeatTime,
            smoothedEnergy: frame.smoothedEnergy,
            vizDataArray: frame.vizDataArray,
            bufferLength: frame.bufferLength,
            midiNote: frame.midiNote,
            beatScale: frame.beatScale,
            isPlaying: frame.isPlaying,
            noteFresh: isPitchNoteFresh(frame.midiNote, s.lastValidNoteTime, Date.now(), CONNECTOR_PITCH_FRESH_MS), // core/audio-analysis.js
            bpm: parseFloat(s.currentCalculatedBpm),
            sampleRate: s.audioContext ? s.audioContext.sampleRate : 44100,
            direction: frame.cfg.brainDirection,
            settings: frame.cfg, // toàn bộ Custom Effect connector — brain.js::_applySettings() tự lấy field cần
        }); // core/visualizer/groups/connector/brain.js
    },

    /** `wf` null = scene WebGL chưa dựng -> không có gì để xoá. */
    _blankWebglOnce(wf) {
        if (!wf || this._webglBlank) return;
        appState.get('tRenderer').clear();
        this._webglBlank = true;
    },

    _fireBrainBurst(isDue) {
        if (!isDue) return;
        brainFilterOriginal.triggerBurst(); // core/visualizer/groups/connector/brain.js
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
