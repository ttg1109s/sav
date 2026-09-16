/**
 * core/webgl/three-connector.js — engine THREE.js group "connector" (style synapse/circuit),
 * dùng chung canvas #webgl-canvas + tRenderer (three-vortex.js), scene/camera RIÊNG (cnScene/
 * cnCamera). Dựng graph (nối trước, hình học sau — mỗi nhánh sinh ra khớp đúng 1 cạnh thật,
 * không nhánh thừa) rồi mesh cho cả 2 style ngay lúc init, toggle visible theo style đang chọn.
 */

function computeConnectorSignalSpeed(base, mult, energy) {
    return base + mult * energy;
}

function fibonacciSpherePoint(i, n, radius) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (i / (n - 1 || 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return new THREE.Vector3(Math.cos(theta) * r * radius, y * radius, Math.sin(theta) * r * radius);
}

function connectorGlowTexture() {
    let tex = appState.get('cnGlowTexture');
    if (tex) return tex;
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(canvas);
    appState.set('cnGlowTexture', tex, { skipCheck: true });
    return tex;
}

// ===================== SYNAPSE — graph =====================

function buildSynapseGraph(neuronCount) {
    const shellSize = Math.ceil(neuronCount / 3);
    const shellOf = new Array(neuronCount);
    for (let i = 0; i < neuronCount; i++) shellOf[i] = Math.min(2, Math.floor(i / shellSize));

    const edges = [];
    const outDegree = new Array(neuronCount).fill(0);
    const inDegree = new Array(neuronCount).fill(0);
    const addEdge = (from, to) => {
        if (from === to) return;
        edges.push({ from, to });
        outDegree[from]++; inDegree[to]++;
    };

    for (let shell = 0; shell < 2; shell++) {
        const current = []; const next = [];
        for (let i = 0; i < neuronCount; i++) {
            if (shellOf[i] === shell) current.push(i);
            else if (shellOf[i] === shell + 1) next.push(i);
        }
        current.forEach((i) => {
            const count = 1 + Math.floor(Math.random() * 2);
            for (let c = 0; c < count && next.length; c++) addEdge(i, next[Math.floor(Math.random() * next.length)]);
        });
    }
    for (let shell = 0; shell < 3; shell++) {
        const inShell = [];
        for (let i = 0; i < neuronCount; i++) if (shellOf[i] === shell) inShell.push(i);
        for (let k = 0; k < inShell.length - 1; k++) if (Math.random() > 0.5) addEdge(inShell[k], inShell[k + 1]);
    }

    // an toàn — nơ-ron cô lập hoàn toàn (không edge nào chạm tới) nối vào 1 nơ-ron bất kỳ khác.
    for (let i = 0; i < neuronCount; i++) {
        if (outDegree[i] === 0 && inDegree[i] === 0 && neuronCount > 1) {
            let target = Math.floor(Math.random() * neuronCount);
            if (target === i) target = (target + 1) % neuronCount;
            addEdge(i, target);
        }
    }
    return { edges, outDegree, inDegree, shellOf };
}

function createNeuronMesh(color) {
    const group = new THREE.Group();
    const somaMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.3, metalness: 0.5 });
    const somaMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 2), somaMat);
    group.add(somaMesh);
    const nucleusMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.0 });
    const nucleusMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), nucleusMat);
    group.add(nucleusMesh);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: connectorGlowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    glowSprite.scale.setScalar(20);
    group.add(glowSprite);
    return { group, somaMesh, nucleusMesh, glowSprite };
}

function buildSynapseNetwork(cfg) {
    const neuronCount = cfg.neuronCount;
    const { edges, outDegree, inDegree } = buildSynapseGraph(neuronCount);
    const shellSize = Math.ceil(neuronCount / 3);
    const shellRadius = [220, 130, 60]; // ngoài(mạnh) -> giữa(trung) -> trong cùng(yếu)

    const neurons = [];
    for (let i = 0; i < neuronCount; i++) {
        const shell = Math.min(2, Math.floor(i / shellSize));
        const indexInShell = i - shell * shellSize;
        const shellCount = Math.min(shellSize, neuronCount - shell * shellSize);
        const radius = shellRadius[shell] * (0.9 + Math.random() * 0.2);
        const basePos = fibonacciSpherePoint(indexInShell, shellCount, radius);
        const { group, somaMesh, nucleusMesh, glowSprite } = createNeuronMesh(0xffffff);
        group.position.copy(basePos);
        neurons.push({
            shell, basePos, pos: basePos.clone(), vel: new THREE.Vector3(),
            group, somaMesh, nucleusMesh, glowSprite,
            energy: 0, prevBinEnergy: 0, lastFiredFrame: -9999,
            outEdges: [], inEdges: [],
        });
    }

    const synapses = [];
    edges.forEach((edge, edgeIdx) => {
        const from = neurons[edge.from], to = neurons[edge.to];
        const fromSlot = from.outEdges.length, fromSlots = outDegree[edge.from];
        const toSlot = to.inEdges.length, toSlots = inDegree[edge.to];
        const startPos = from.basePos.clone().add(fibonacciSpherePoint(fromSlot, fromSlots, 4.2));
        const endPos = to.basePos.clone().add(fibonacciSpherePoint(toSlot, toSlots, 4.6));

        const mid = startPos.clone().lerp(endPos, 0.5);
        const dir = endPos.clone().sub(startPos).normalize();
        const perp = new THREE.Vector3(-dir.y, dir.x, dir.z || 0.001).normalize();
        mid.add(perp.multiplyScalar((Math.random() - 0.5) * 14));
        const curve = new THREE.CatmullRomCurve3([startPos, mid, endPos]);
        const totalDistance = startPos.distanceTo(mid) + mid.distanceTo(endPos);

        const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        const tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.35, 6, false), tubeMat);

        from.outEdges.push(edgeIdx); to.inEdges.push(edgeIdx);
        synapses.push({ from: edge.from, to: edge.to, curve, totalDistance, tubeMesh });
    });

    return { neurons, synapses };
}

// ===================== CIRCUIT — graph =====================

function buildCircuitGraph(nodeCount, avgDegree) {
    const edges = [];
    const degree = new Array(nodeCount).fill(0);
    for (let i = 0; i < nodeCount; i++) {
        const wanted = 1 + Math.floor(Math.random() * avgDegree);
        for (let k = 0; k < wanted && degree[i] < avgDegree + 2; k++) {
            let target = Math.floor(Math.random() * nodeCount);
            if (target === i) continue;
            if (edges.some((e) => (e.from === i && e.to === target) || (e.from === target && e.to === i))) continue;
            edges.push({ from: i, to: target });
            degree[i]++; degree[target]++;
        }
    }
    for (let i = 0; i < nodeCount; i++) {
        if (degree[i] === 0 && nodeCount > 1) {
            let target = Math.floor(Math.random() * nodeCount);
            if (target === i) target = (target + 1) % nodeCount;
            edges.push({ from: i, to: target });
            degree[i]++; degree[target]++;
        }
    }
    return { edges, degree };
}

function createChipMesh(color, pinCount) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.6 });
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 6), bodyMat);
    group.add(bodyMesh);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pins = [];
    for (let p = 0; p < pinCount; p++) {
        const angle = (p / pinCount) * Math.PI * 2;
        const pinMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 2), pinMat);
        pinMesh.position.set(Math.cos(angle) * 4, 0, Math.sin(angle) * 4);
        group.add(pinMesh);
        pins.push(pinMesh);
    }
    return { group, bodyMesh, pins };
}

function buildManhattanPath(startPos, endPos) {
    const corners = [startPos.clone()];
    const current = startPos.clone();
    const axes = Math.random() > 0.5 ? ['x', 'y', 'z'] : ['z', 'x', 'y'];
    axes.forEach((axis) => {
        if (Math.abs(current[axis] - endPos[axis]) > 0.1) { current[axis] = endPos[axis]; corners.push(current.clone()); }
    });
    const points = [];
    for (let i = 0; i < corners.length - 1; i++) {
        const a = corners[i], b = corners[i + 1];
        const steps = Math.max(2, Math.floor(a.distanceTo(b) * 1.5));
        for (let s = 0; s < steps; s++) points.push(new THREE.Vector3().lerpVectors(a, b, s / steps));
    }
    points.push(endPos.clone());
    return points;
}

function buildCircuitNetwork(cfg) {
    const nodeCount = cfg.nodeCount;
    const { edges, degree } = buildCircuitGraph(nodeCount, cfg.connectorAvgDegree || 3);

    const chips = [];
    const gridSize = 16;
    for (let i = 0; i < nodeCount; i++) {
        const pos = new THREE.Vector3(
            (Math.random() - 0.5) * gridSize * 10,
            (Math.random() - 0.5) * gridSize * 6,
            (Math.random() - 0.5) * gridSize * 10,
        );
        const pinCount = Math.max(1, degree[i]);
        const { group, bodyMesh, pins } = createChipMesh(0xffffff, pinCount);
        group.position.copy(pos);
        chips.push({ pos, group, bodyMesh, pins, pinUsed: 0, edges: [] });
    }

    const edgesCircuit = [];
    edges.forEach((edge, edgeIdx) => {
        const fromChip = chips[edge.from], toChip = chips[edge.to];
        const fromPin = fromChip.pins[fromChip.pinUsed++];
        const toPin = toChip.pins[toChip.pinUsed++];
        const startPos = fromChip.pos.clone().add(fromPin.position);
        const endPos = toChip.pos.clone().add(toPin.position);
        const points = buildManhattanPath(startPos, endPos);

        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) totalDistance += points[i - 1].distanceTo(points[i]);

        const positions = new Float32Array(points.length * 3);
        points.forEach((p, i) => { positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z; });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 0);
        const lineMesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));

        fromChip.edges.push(edgeIdx); toChip.edges.push(edgeIdx);
        edgesCircuit.push({ from: edge.from, to: edge.to, points, totalDistance, geometry, lineMesh });
    });

    return { chips, edgesCircuit };
}

// ===================== bootstrap =====================

function initThreeJSConnector() {
    const canvas = document.getElementById('webgl-canvas');
    const cnScene = new THREE.Scene();
    cnScene.background = null; // giữ trong suốt — lộ Visual Background phía dưới, xem plan-connector.md Phần D
    const cnCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
    cnCamera.position.set(0, 40, 340);
    cnCamera.lookAt(0, 0, 0);

    if (!appState.get('tRenderer')) {
        appState.set('tRenderer', new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }), { skipCheck: true });
        appState.get('tRenderer').setPixelRatio(window.devicePixelRatio);
    }
    appState.get('tRenderer').setSize(window.innerWidth, window.innerHeight);

    const cfg = getEffectConfig('connector'); // core/custom-effect.js
    const { neurons, synapses } = buildSynapseNetwork(cfg);
    const cnGroupSynapse = new THREE.Group();
    neurons.forEach((n) => cnGroupSynapse.add(n.group));
    synapses.forEach((s) => cnGroupSynapse.add(s.tubeMesh));
    cnScene.add(cnGroupSynapse);

    const { chips, edgesCircuit } = buildCircuitNetwork(cfg);
    const cnGroupCircuit = new THREE.Group();
    chips.forEach((c) => cnGroupCircuit.add(c.group));
    edgesCircuit.forEach((e) => cnGroupCircuit.add(e.lineMesh));
    cnScene.add(cnGroupCircuit);

    appState.set('cnScene', cnScene, { skipCheck: true });
    appState.set('cnCamera', cnCamera, { skipCheck: true });
    appState.set('cnGroupSynapse', cnGroupSynapse, { skipCheck: true });
    appState.set('cnGroupCircuit', cnGroupCircuit, { skipCheck: true });
    appState.set('cnNeurons', neurons, { skipCheck: true });
    appState.set('cnSynapses', synapses, { skipCheck: true });
    appState.set('cnChips', chips, { skipCheck: true });
    appState.set('cnEdgesCircuit', edgesCircuit, { skipCheck: true });
    appState.set('cnActiveSignalsSynapse', [], { skipCheck: true });
    appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
    appState.set('cnInitialized', true, { skipCheck: true });
    updateConnectorVisibility();
}

function updateConnectorVisibility() {
    if (!appState.get('cnInitialized')) return;
    const style = getEffectConfig('connector').connectorStyle; // core/custom-effect.js
    appState.get('cnGroupSynapse').visible = (style === 'synapse');
    appState.get('cnGroupCircuit').visible = (style === 'circuit');
}

function createCircuitBitSprite(color) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: connectorGlowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    sprite.scale.setScalar(3);
    return sprite;
}

function fireNeuronActionPotential(neuronIdx, impulse) {
    const neurons = appState.get('cnNeurons');
    const synapses = appState.get('cnSynapses');
    const neuron = neurons[neuronIdx];
    if (!neuron) return;
    neuron.vel.add(impulse);
    neuron.energy = 2.0;
    neuron.outEdges.forEach((edgeIdx) => {
        const sparkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        appState.get('cnGroupSynapse').add(sparkMesh);
        appState.mutate('cnActiveSignalsSynapse', (arr) => arr.push({ edgeIdx, progress: 0, mesh: sparkMesh }), { skipCheck: true });
    });
}
