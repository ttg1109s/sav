/**
 * core/webgl/three-connector.js — port GẦN NGUYÊN VĂN 2 demo gốc (neuron sinh học 3D + mạch tín
 * hiệu lượng tử 3D), chỉ đổi đúng phần đã chốt: vị trí/graph nơ-ron (3 vỏ cầu), trigger (32 bin
 * audio thay click), tốc độ/xung lực/damping (audio-driven), màu (getComputedColor), hình node
 * circuit (chip+chân thay icosahedron+ring), quota spawn theo beat. Camera (OrbitControls +
 * GSAP cinematic của circuit) GIỮ NGUYÊN cơ chế gốc — chỉ đổi driver/thời điểm kích hoạt.
 */

let cnClock = new THREE.Clock();

function computeConnectorSpeed(base, mult, energy) {
    return base + mult * energy;
}

// ===================== SYNAPSE — port từ "3D Biological Neural Network Simulation" =====================

function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.25, 'rgba(0, 220, 255, 0.9)');
    gradient.addColorStop(0.55, 'rgba(30, 80, 240, 0.35)');
    gradient.addColorStop(0.85, 'rgba(120, 20, 200, 0.1)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createActionPotentialSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(0, 255, 220, 0.95)');
    gradient.addColorStop(0.7, 'rgba(0, 140, 255, 0.5)');
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

/**
 * SỬA (yêu cầu Giang 16/09/2026 — "đang vo viên lẫn lộn -> làm phẳng map dạng 2D, nhưng vẫn cấu
 * trúc 3D"): bỏ hẳn layout 3 vỏ CẦU (fibonacciSpherePoint, đã xoá) — thay bằng LƯỚI PHẲNG (mặt
 * X-Y CỤC BỘ của cnGroupSynapse, Z=0 lúc rest). "Vẫn cấu trúc 3D" đến từ trục Z cục bộ = trục
 * "đàn hồi" (lún/phồng khi bắn tín hiệu — xem impulse Z-only ở _tickConnectorSynapse, event/
 * workflow/visualizer-render.js) — lưới phẳng nhưng KHÔNG phẳng lì, vẫn gồ ghề động theo audio.
 *
 * SỬA TIẾP (phản hồi Giang cùng ngày — "map phải trải đều/diện tích bằng màn hình" + "bỏ camera
 * xoay/zoom"): bản đầu tiên chỉ khớp XẤP XỈ theo tỉ lệ khung hình rồi để camera tự xoay quanh —
 * KHÔNG đúng ý "diện tích bằng màn hình". Sửa lại đúng nghĩa đen: SYNAPSE_CAMERA_FOV_DEG/
 * SYNAPSE_CAMERA_DISTANCE dưới đây PHẢI khớp NGUYÊN VĂN cnCamera.fov/position ở
 * updateConnectorVisibility() (cuối file) — buildSynapseGridCells() tính NGƯỢC ra đúng khung hình
 * (frustum) camera nhìn thấy ở mặt phẳng Z=0, rồi trải lưới KÍN 92% khung hình đó (chừa biên nhỏ
 * tránh mesh rìa bị crop) — lấp ĐÚNG diện tích màn hình, không còn ước lượng. Camera giờ đứng
 * THẲNG trục Z (không lệch Y), OrbitControls khoá HẲN rotate/zoom/pan — không tự xoay/orbit nữa
 * (rotateSpeedBase/EnergyMult trong config vẫn còn field nhưng KHÔNG còn tác dụng cho style
 * synapse — nợ kỹ thuật đã biết, chưa gỡ field/slider vì ngoài phạm vi yêu cầu lần này).
 *
 * Chốt với Giang (3 câu hỏi 16/09/2026):
 * 1) Lưới ĐỀU, vòng đồng tâm HÌNH CHỮ NHẬT ngoài->trong — giữ tinh thần "shell mạnh ngoài/yếu
 *    trong" cũ, chỉ đổi hình cầu -> hình chữ nhật phẳng (KHÔNG so le ngẫu nhiên như phác thảo).
 * 2) Lún/phồng: xem hàm _tickConnectorSynapse — 1 xung +Z duy nhất lúc bắn (khử cực), lò xo Hooke
 *    GIỮ NGUYÊN bên dưới tự overshoot rồi undershoot ÂM trước khi ổn định — đúng dạng sóng điện
 *    thế hoạt động thật (depolarize -> hyperpolarization undershoot -> rest). MỚI (phản hồi Giang
 *    "đàn hồi quá mạnh, văng mất") — kẹp biên velocity/displacement, xem stepNeuronSpring() (core/
 *    visualizer/groups/connector/synapse.js): xung Z LUÔN CÙNG DẤU (không tự triệt tiêu như 3 trục
 *    ngẫu nhiên cũ) nên nơ-ron bậc-vào cao (nhiều dây tới, nhất là sau SỬA TIẾP mục 3 dưới đảm bảo
 *    tối thiểu 1 dây/nơ-ron) có thể nhận NHIỀU xung dồn dập cộng don không giới hạn — kẹp là lớp
 *    bảo vệ cuối, không phụ thuộc xung tới từ đâu/dồn bao nhiêu lần.
 * 3) Lân cận lan tín hiệu: đồ thị CỐ ĐỊNH dựng 1 LẦN lúc khởi tạo theo Ô LƯỚI THẬT kề nhau. SỬA
 *    TIẾP (phản hồi Giang "không phát tín hiệu liên tục dù audio vẫn có") — bản đầu random-skip
 *    35% ĐỘC LẬP mỗi hướng khiến nơ-ron ở biên/góc (ít ứng viên) có xác suất KHÔNG CÓ dây ra nào
 *    (connectedSynapses rỗng) -> bắn tín hiệu nhưng không gì để lan -> im lặng dù vẫn còn audio.
 *    Sửa: mọi nơ-ron còn ≥1 ứng viên hướng "tới" LUÔN được đảm bảo ÍT NHẤT 1 dây ra, phần ứng viên
 *    còn lại mới random 50% thêm — cùng tinh thần connectCount=2-3/nơ-ron bảo đảm tối thiểu của
 *    graph shell cũ, không phó mặc hoàn toàn cho random nữa.
 */

// PHẢI khớp NGUYÊN VĂN cnCamera.fov/position.z gán trong updateConnectorVisibility() (cuối file,
// style synapse) — xem giải thích ở docblock trên.
const SYNAPSE_CAMERA_FOV_DEG = 50;
const SYNAPSE_CAMERA_DISTANCE = 380;

// Kích thước thế giới (world units) camera nhìn thấy trọn khung hình ở mặt phẳng Z=0 (nơi lưới
// nơ-ron đứng yên lúc rest) — suy ngược từ FOV/khoảng cách camera + tỉ lệ khung hình MÀN HÌNH
// THẬT (window.innerWidth/innerHeight).
function computeSynapseVisibleFrustum() {
    const aspect = window.innerWidth / window.innerHeight;
    const halfHeight = SYNAPSE_CAMERA_DISTANCE * Math.tan((SYNAPSE_CAMERA_FOV_DEG * Math.PI / 180) / 2);
    return { width: halfHeight * 2 * aspect, height: halfHeight * 2 };
}

// Cột/hàng khớp tỉ lệ khung hình MÀN HÌNH THẬT — kẹp biên tránh lưới dẹt bất thường ở màn siêu
// ngang/dọc.
function computeSynapseGridDims(neuronCount) {
    const aspect = Math.max(0.5, Math.min(2.2, window.innerWidth / window.innerHeight));
    const rows = Math.max(1, Math.round(Math.sqrt(neuronCount / aspect)));
    const cols = Math.max(1, Math.ceil(neuronCount / rows));
    return { cols, rows };
}

// "Vòng" = khoảng cách Chebyshev tới viền lưới gần nhất (0 = ô viền ngoài cùng, tăng dần vào
// tâm) — dùng để chọn ĐÚNG neuronCount ô, ưu tiên viền ngoài trước khi cols*rows > neuronCount
// (hầu như luôn xảy ra) — đúng yêu cầu "phân bổ nơ-ron tại các điểm từ ngoài vào trong".
function ringIndexOf(col, row, cols, rows) {
    return Math.min(col, cols - 1 - col, row, rows - 1 - row);
}

/**
 * Trả về đúng neuronCount ô {col, row, ring, position(cục bộ, Z=0)} + cellSize thật (world units)
 * — lưới lấp KÍN 92% khung hình camera thấy (computeSynapseVisibleFrustum(), chừa biên nhỏ tránh
 * mesh rìa bị bloom/khung hình cắt). cellSizeX/Y tính RIÊNG mỗi trục — khớp đúng hình chữ nhật
 * màn hình thật (dọc/ngang/vuông), không còn ép về 1 span vuông như bản trước.
 */
function buildSynapseGridCells(neuronCount) {
    const { cols, rows } = computeSynapseGridDims(neuronCount);
    const frustum = computeSynapseVisibleFrustum();
    const fillRatio = 0.92;
    const cellSizeX = (frustum.width * fillRatio) / Math.max(cols - 1, 1);
    const cellSizeY = (frustum.height * fillRatio) / Math.max(rows - 1, 1);

    const cells = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) cells.push({ col: c, row: r, ring: ringIndexOf(c, r, cols, rows) });
    }
    cells.sort((a, b) => a.ring - b.ring || a.row - b.row || a.col - b.col);
    const chosen = cells.slice(0, neuronCount);

    const halfW = (cols - 1) * cellSizeX / 2, halfH = (rows - 1) * cellSizeY / 2;
    chosen.forEach((cell) => { cell.position = new THREE.Vector3(cell.col * cellSizeX - halfW, halfH - cell.row * cellSizeY, 0); });
    return { cells: chosen, cellSize: Math.min(cellSizeX, cellSizeY) };
}

// SỬA (phản hồi Giang "không phát tín hiệu liên tục") — mọi nơ-ron còn ≥1 ứng viên hướng "tới"
// (phải/xuống/chéo-xuống-phải/chéo-lên-phải) LUÔN được đảm bảo ÍT NHẤT 1 dây ra (ép chọn ngẫu
// nhiên 1 trong số ứng viên), phần còn lại mới random 50% thêm — không còn nơ-ron "câm" (0 dây
// ra) chỉ vì xui rủi random như bản trước. Chỉ nơ-ron ở góc/biên tận cùng (0 ứng viên) chấp nhận
// không có dây ra — đúng bản chất đồ thị có hướng có điểm cuối.
function buildSynapseGraph(cells) {
    const cellMap = new Map();
    cells.forEach((cell, idx) => cellMap.set(`${cell.col},${cell.row}`, idx));
    const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
    const edges = [];
    const inDegree = new Array(cells.length).fill(0);
    cells.forEach((cell, idx) => {
        const candidates = DIRS
            .map(([dc, dr]) => cellMap.get(`${cell.col + dc},${cell.row + dr}`))
            .filter((t) => t !== undefined);
        if (candidates.length === 0) return;

        const guaranteed = candidates[Math.floor(Math.random() * candidates.length)];
        edges.push({ from: idx, to: guaranteed }); inDegree[guaranteed]++;
        candidates.forEach((target) => {
            if (target !== guaranteed && Math.random() > 0.5) { edges.push({ from: idx, to: target }); inDegree[target]++; }
        });
    });
    return { edges, inDegree };
}

/**
 * Bán kính mesh (nucleus/soma/dendrite/axon/myelin/bouton/spark, xem createAnatomicalNeuron()/
 * createPhysicalSynapticAxon()) tỉ lệ theo cellSize THẬT sau khi lưới đã lấp kín khung hình —
 * "tự thân các nhân, dây, sợi to nhỏ theo kích thước hiển thị của visualizer screen" (yêu cầu
 * Giang). Mốc 60 ~ cellSize mặc định ở neuronCount=32 trên khung hình cỡ điện thoại phổ biến (đã
 * test). Kẹp biên tránh 2 cực đoan (ô rất nhỏ ở neuronCount=64 màn hẹp / ô rất to ở neuronCount=16
 * màn rộng).
 */
function computeConnectorMeshScale(cellSize) {
    return Math.max(0.4, Math.min(2.2, cellSize / 60));
}

/**
 * Creates an anatomically authentic 3D Neuron Model — GIỮ NGUYÊN NGUYÊN VẸN mô hình hình học gốc
 * (nucleus, soma deform, dendrite arbor+spines — cùng loại geometry/cấu trúc, không đổi). ĐỔI:
 * dendriteCount = đúng inDegree (không random 5-7 nữa); màu nhận từ getComputedColor() thay
 * hardcode; MỚI (16/09/2026) — tham số `scale` nhân đều mọi bán kính/chiều dài tuyệt đối (nucleus/
 * nucleolus/soma/glow/dendrite/spine) — "tự thân nhân/dây/sợi to nhỏ theo kích thước hiển thị",
 * xem computeConnectorMeshScale(). Không đổi TỈ LỆ giữa các phần (mọi noise/offset tương đối
 * theo somaRadius vẫn nguyên công thức gốc, tự động ăn theo khi somaRadius scale).
 */
function createAnatomicalNeuron(id, position, dendriteCount, fillColorHex, glowColorHex, glowTexture, scale) {
    const neuronGroup = new THREE.Group();
    neuronGroup.position.copy(position);
    const restPosition = position.clone();

    const nucleusGeo = new THREE.SphereGeometry(1.6 * scale, 20, 20);
    const nucleusMat = new THREE.MeshStandardMaterial({
        color: fillColorHex, emissive: fillColorHex, emissiveIntensity: 0.95, roughness: 0.25, metalness: 0.5
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    neuronGroup.add(nucleusMesh);

    const nucleolusMesh = new THREE.Mesh(new THREE.SphereGeometry(0.65 * scale, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    nucleusMesh.add(nucleolusMesh);

    const somaRadius = 4.0 * scale;
    const somaGeo = new THREE.IcosahedronGeometry(somaRadius, 3);
    const posAttr = somaGeo.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
        vertex.fromBufferAttribute(posAttr, i);
        const noise = Math.sin(vertex.x * 0.95) * Math.cos(vertex.y * 0.95) * Math.sin(vertex.z * 0.95);
        vertex.multiplyScalar(1.0 + noise * 0.2);
        posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    somaGeo.computeVertexNormals();

    const somaMat = new THREE.MeshStandardMaterial({
        color: fillColorHex, emissive: fillColorHex, emissiveIntensity: 0.65,
        transparent: true, opacity: 0.78, roughness: 0.3, metalness: 0.55
    });
    const somaMesh = new THREE.Mesh(somaGeo, somaMat);
    somaMesh.userData = { neuronId: id };
    neuronGroup.add(somaMesh);

    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: glowColorHex, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.85
    }));
    glowSprite.scale.setScalar(25 * scale);
    neuronGroup.add(glowSprite);

    // ĐỔI: dendrite dùng ĐÚNG màu hệ core (fillColorHex) thay hardcode 0x00b3ff/0x0033aa.
    const dendriteGroup = new THREE.Group();
    const dendriteMat = new THREE.MeshStandardMaterial({ color: fillColorHex, emissive: fillColorHex, emissiveIntensity: 0.5, roughness: 0.4 });
    const dendriteEndpoints = [];

    for (let d = 0; d < dendriteCount; d++) {
        let dDir = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();

        const curvePoints = [];
        let currentPoint = dDir.clone().multiplyScalar(somaRadius * 0.8);
        curvePoints.push(currentPoint.clone());

        const segments = 4;
        const branchLength = (11 + Math.random() * 8) * scale;
        for (let s = 1; s <= segments; s++) {
            const stepProgress = s / segments;
            const jitter = new THREE.Vector3((Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 3.5).multiplyScalar(scale);
            currentPoint = dDir.clone().multiplyScalar(somaRadius + branchLength * stepProgress).add(jitter);
            curvePoints.push(currentPoint.clone());
        }

        const dendriteCurve = new THREE.CatmullRomCurve3(curvePoints);
        const dendriteMesh = new THREE.Mesh(new THREE.TubeGeometry(dendriteCurve, 14, 0.65 * scale, 8, false), dendriteMat);
        dendriteGroup.add(dendriteMesh);

        for (let sp = 0; sp < 5; sp++) {
            const spineProgress = 0.3 + Math.random() * 0.6;
            const spineMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35 * scale, 8, 8), dendriteMat);
            spineMesh.position.copy(dendriteCurve.getPoint(spineProgress));
            dendriteGroup.add(spineMesh);
        }

        dendriteEndpoints.push(curvePoints[curvePoints.length - 1].clone().add(position));
    }
    neuronGroup.add(dendriteGroup);

    return {
        id, position, restPosition, velocity: new THREE.Vector3(0, 0, 0),
        container: neuronGroup, somaMesh, nucleusMesh, glowSprite, scale,
        dendriteEndpoints, dendriteTipCursor: 0, fillColorHex, glowColorHex,
        energy: 0.0, connectedSynapses: [], prevBinEnergy: 0, lastFiredFrame: -9999,
    };
}

/**
 * Builds a continuous physical Axon — GIỮ NGUYÊN hillock/myelin+node-of-Ranvier/bouton của gốc.
 * ĐỔI 3 chỗ (phản hồi Giang, round sau):
 * 1) targetPos chọn ĐÚNG 1 dendrite tip theo cursor tuần tự (không nearest-search).
 * 2) toạ độ tính CỤC BỘ quanh `fromNeuron.restPosition`, axonGroup làm con của
 *    `fromNeuron.container` (không phải `networkGroup`) — để khi nơ-ron NGUỒN nảy lò xo, toàn bộ
 *    axon (output của nó) nảy theo NHƯ 1 khối cứng, không còn tách rời.
 * 3) biên độ uốn cong (bend) tỉ lệ THEO totalDistance thay vì hằng số tuyệt đối gốc — ở khoảng
 *    cách xa (3 vỏ cầu bán kính lớn) hằng số cũ quá nhỏ so với chiều dài, trông thẳng đơ.
 * Màu hillock/core/myelin/bouton dùng `colorHex` (màu hệ core của fromNeuron) thay 4 màu
 * cyan-teal hardcode gốc.
 */
function createPhysicalSynapticAxon(fromNeuron, toNeuron, colorHex, scale) {
    const origin = fromNeuron.restPosition;
    const startPos = fromNeuron.position.clone().sub(origin);

    let targetWorld = toNeuron.position;
    if (toNeuron.dendriteEndpoints.length > 0) {
        targetWorld = toNeuron.dendriteEndpoints[toNeuron.dendriteTipCursor % toNeuron.dendriteEndpoints.length];
        toNeuron.dendriteTipCursor++;
    }
    const targetPos = targetWorld.clone().sub(origin);

    const totalVector = targetPos.clone().sub(startPos);
    const totalDistance = totalVector.length();
    const axonDir = totalVector.clone().normalize();

    const axonGroup = new THREE.Group();

    // MỚI (16/09/2026): tham số `scale` nhân đều mọi bán kính/offset tuyệt đối — cùng lý do/cơ
    // chế với createAnatomicalNeuron(), xem computeConnectorMeshScale().
    const hillockMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5 * scale, 2.2 * scale, 3.0 * scale, 10),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.6 })
    );
    hillockMesh.position.copy(startPos.clone().add(axonDir.clone().multiplyScalar(2.8 * scale)));
    hillockMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axonDir);
    axonGroup.add(hillockMesh);

    const curvePoints = [startPos.clone().add(axonDir.clone().multiplyScalar(3.5 * scale))];
    // SỬA (phản hồi Giang — line thẳng đơ): bản trước chỉ 1 cung sin phẳng, biên độ quá nhỏ so
    // khoảng cách 3 vỏ cầu mới (nhìn xa lại càng phẳng). Đổi sang uốn 3D thật — 2 trục vuông góc
    // độc lập (perp1/perp2) + 2 tần số sin lệch pha mỗi nhánh (wiggle1/wiggle2) -> đường ngoằn
    // ngoèo tự nhiên, biên độ ~18-36% chiều dài (đủ thấy rõ ở khoảng cách camera zoom-out cố
    // định). envelope vẫn về 0 ở 2 đầu — không gãy khúc chỗ nối vào neuron.
    const perp1 = new THREE.Vector3(-axonDir.y, axonDir.x, axonDir.z || 0.001).normalize();
    const perp2 = new THREE.Vector3().crossVectors(axonDir, perp1).normalize();
    const bendAmount = totalDistance * (0.18 + Math.random() * 0.18);
    const phase = Math.random() * Math.PI * 2;
    const segments = 6;
    for (let i = 1; i < segments; i++) {
        const frac = i / segments;
        const midPoint = startPos.clone().lerp(targetPos, frac);
        const envelope = Math.sin(frac * Math.PI);
        const wiggle1 = Math.sin(frac * Math.PI * 2 + phase) * bendAmount;
        const wiggle2 = Math.cos(frac * Math.PI * 3 + phase * 1.3) * bendAmount * 0.6;
        const bend = perp1.clone().multiplyScalar(envelope * wiggle1).add(perp2.clone().multiplyScalar(envelope * wiggle2));
        curvePoints.push(midPoint.add(bend));
    }
    curvePoints.push(targetPos.clone());

    const axonCurve = new THREE.CatmullRomCurve3(curvePoints);

    const axonCoreMesh = new THREE.Mesh(
        new THREE.TubeGeometry(axonCurve, 36, 0.42 * scale, 8, false),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.8 })
    );
    axonGroup.add(axonCoreMesh);

    const myelinMat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0.75 });
    const myelinCount = Math.max(2, Math.floor(totalDistance / (18.0 * scale))); // mật độ đốt myelin/chiều dài GIỮ NGUYÊN cảm giác dù scale bao nhiêu
    const nodesOfRanvierGaps = [];
    for (let m = 0; m < myelinCount; m++) {
        const startT = (m / myelinCount) + 0.035;
        const endT = ((m + 1) / myelinCount) - 0.035;
        if (startT >= 0.95) break;
        const segSubPoints = [];
        for (let st = 0; st <= 6; st++) {
            const t = Math.min(0.96, startT + (endT - startT) * (st / 6));
            segSubPoints.push(axonCurve.getPoint(t));
        }
        if (segSubPoints.length > 1) {
            const myelinMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(segSubPoints), 8, 0.9 * scale, 10, false), myelinMat);
            axonGroup.add(myelinMesh);
        }
        nodesOfRanvierGaps.push(axonCurve.getPoint(Math.min(0.98, endT + 0.018)));
    }

    const boutonMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.1 * scale, 12, 12),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.95 })
    );
    boutonMesh.position.copy(targetPos);
    axonGroup.add(boutonMesh);

    fromNeuron.container.add(axonGroup); // ĐỔI: con của neuron NGUỒN, không phải networkGroup — nảy cùng lúc lò xo nảy

    const synapseObject = { fromNeuron, toNeuron, axonCurve, totalDistance, nodesOfRanvier: nodesOfRanvierGaps, groupMesh: axonGroup, originOffset: origin };
    fromNeuron.connectedSynapses.push(synapseObject);
    return synapseObject;
}

// SỬA (16/09/2026 — lưới phẳng thay 3 vỏ cầu): orchestrator vẫn "graph trước, hình học sau" như
// bản trước, chỉ đổi NGUỒN vị trí (buildSynapseGridCells thay fibonacciSpherePoint) + graph theo
// lân cận ô lưới (buildSynapseGraph(cells) thay theo shell) — createAnatomicalNeuron()/
// createPhysicalSynapticAxon() GIỮ NGUYÊN mô hình hình học, chỉ nhận thêm `meshScale`.
function buildSynapseNetwork(cfg, networkGroup, glowTexture) {
    const neuronCount = cfg.neuronCount;
    const { cells, cellSize } = buildSynapseGridCells(neuronCount);
    const meshScale = computeConnectorMeshScale(cellSize);
    const { edges, inDegree } = buildSynapseGraph(cells);

    const neurons = cells.map((cell, i) => {
        const color = getComputedColor(i, neuronCount, 128); // core/audio-analysis.js
        const neuron = createAnatomicalNeuron(
            i, cell.position, inDegree[i],
            new THREE.Color(color.fill).getHex(), new THREE.Color(color.glow).getHex(), glowTexture, meshScale
        );
        networkGroup.add(neuron.container);
        return neuron;
    });

    const synapses = edges.map((edge) => createPhysicalSynapticAxon(neurons[edge.from], neurons[edge.to], neurons[edge.from].fillColorHex, meshScale));
    return { neurons, synapses };
}

// GIỮ NGUYÊN 100% — hạt lỏng nền, không đổi gì.
function buildMicroscopicFluidParticles() {
    const count = 500;
    const posArray = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 400;
        posArray[i + 1] = (Math.random() - 0.5) * 400;
        posArray[i + 2] = (Math.random() - 0.5) * 400;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.PointsMaterial({ size: 1.2, color: 0x00b3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending });
    return new THREE.Points(geo, mat);
}

// GIỮ NGUYÊN mesh spark + spawn theo MỌI connectedSynapses. ĐỔI: energyOverride (mặc định 2.2 y
// hệt gốc cho trường hợp lan truyền tới; truyền riêng cho trường hợp bắn theo onset bin).
function fireNeuronActionPotential(neuronIdx, impulseVector, energyOverride) {
    const neurons = appState.get('cnNeurons');
    const neuron = neurons[neuronIdx];
    if (!neuron) return;
    const sparkTexture = appState.get('cnSparkTexture');

    neuron.velocity.add(impulseVector);
    neuron.energy = energyOverride != null ? energyOverride : 2.2;

    neuron.connectedSynapses.forEach((synapse) => {
        // MỚI (16/09/2026): spark theo scale của neuron NGUỒN — đồng bộ kích thước với nhân/dây đã scale.
        const sparkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.85 * neuron.scale, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const sparkGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture, transparent: true, blending: THREE.AdditiveBlending }));
        sparkGlow.scale.setScalar(8.5 * neuron.scale);
        sparkMesh.add(sparkGlow);
        synapse.fromNeuron.container.add(sparkMesh); // ĐỔI: con của neuron NGUỒN — axonCurve giờ ở toạ độ cục bộ quanh nó (xem createPhysicalSynapticAxon), spark phải cùng hệ toạ độ mới bám đúng ống
        appState.mutate('cnActiveSignalsSynapse', (arr) => arr.push({ synapse, progress: 0.0, mesh: sparkMesh }), { skipCheck: true });
    });
}

// ===================== CIRCUIT — port từ "Mô Phỏng Tín Hiệu Điện Tử Lượng Tử 3D" =====================

// GIỮ NGUYÊN 100% — particle field môi trường lượng tử nền.
function createQuantumEnvironment() {
    const count = 600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(0x00f3ff), new THREE.Color(0xff007f), new THREE.Color(0x9d00ff)];
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 160;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
        const c = palette[Math.floor(Math.random() * palette.length)];
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const particleMat = new THREE.PointsMaterial({ size: 0.6, vertexColors: true, transparent: true, opacity: 0.6 });
    return new THREE.Points(particleGeo, particleMat);
}

// ĐỔI: hình node — thân chip + N chân cố định (trang trí/cấu trúc, KHÔNG khớp graph vì bản gốc
// không có graph cố định nào — xem spawnCircuitSignal(), any-to-any y hệt gốc). Giữ PointLight
// per-node của gốc.
const CIRCUIT_PIN_COUNT = 8;

function createChipMesh(colorHex) {
    const group = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.8, 2.4),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.8 })
    );
    group.add(bodyMesh);

    const pinMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const pins = [];
    for (let p = 0; p < CIRCUIT_PIN_COUNT; p++) {
        const angle = (p / CIRCUIT_PIN_COUNT) * Math.PI * 2;
        const pinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.9), pinMat);
        pinMesh.position.set(Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6);
        pinMesh.rotation.y = -angle;
        group.add(pinMesh);
        pins.push({ mesh: pinMesh, busy: false });
    }

    const pLight = new THREE.PointLight(colorHex, 1.2, 20);
    group.add(pLight);

    return { group, bodyMesh, pins };
}

// Chọn chân TRỐNG hướng gần nhất về phía node kia (không có graph cố định để khớp — tín hiệu
// động như bản gốc, chân chỉ là điểm neo vật lý). Hết chân trống thì dùng lại (không chặn tín
// hiệu, đúng tinh thần "any-to-any" gốc).
function pickNearestFreePin(chip, towardWorldPos) {
    const localDir = towardWorldPos.clone().sub(chip.pos).normalize();
    let best = null, bestDot = -Infinity;
    chip.pins.forEach((pin) => {
        if (pin.busy) return;
        const dot = pin.mesh.position.clone().normalize().dot(localDir);
        if (dot > bestDot) { bestDot = dot; best = pin; }
    });
    if (!best) best = chip.pins[Math.floor(Math.random() * chip.pins.length)];
    best.busy = true;
    return best;
}

// GIỮ NGUYÊN thuật toán snap-lưới + chống trùng vị trí của generateRandomNodes() gốc — chỉ đổi
// mesh (createChipMesh thay icosahedron+ring+pointlight) + màu (getComputedColor thay NODE_COLORS).
function buildCircuitNodes(cfg, nodeGroup) {
    const chips = [];
    const gridSize = 12;
    for (let i = 0; i < cfg.nodeCount; i++) {
        const gx = Math.floor((Math.random() - 0.5) * 14) * gridSize;
        const gy = Math.floor((Math.random() - 0.5) * 8) * gridSize;
        const gz = Math.floor((Math.random() - 0.5) * 14) * gridSize;
        if (chips.some((c) => c.pos.x === gx && c.pos.y === gy && c.pos.z === gz)) continue;

        const color = getComputedColor(i, cfg.nodeCount, 128); // core/audio-analysis.js
        const colorHex = new THREE.Color(color.fill).getHex();
        const { group, bodyMesh, pins } = createChipMesh(colorHex);
        group.position.set(gx, gy, gz);
        nodeGroup.add(group);

        chips.push({ id: `NODE_${i}`, pos: new THREE.Vector3(gx, gy, gz), group, bodyMesh, pins, color: colorHex });
    }
    return chips;
}

// GIỮ NGUYÊN 100% thuật toán bẻ góc vuông + densify của gốc (bỏ field "corners" không ai dùng).
function create3DManhattanPath(startPos, endPos) {
    const points = [startPos.clone()];
    const current = startPos.clone();
    const target = endPos.clone();
    const axes = Math.random() > 0.5 ? ['x', 'y', 'z'] : ['z', 'x', 'y'];
    axes.forEach((axis) => {
        if (Math.abs(current[axis] - target[axis]) > 0.1) { current[axis] = target[axis]; points.push(current.clone()); }
    });
    const densePoints = [];
    for (let i = 0; i < points.length - 1; i++) {
        const pA = points[i], pB = points[i + 1];
        const steps = Math.max(2, Math.floor(pA.distanceTo(pB) * 2));
        for (let s = 0; s < steps; s++) densePoints.push(new THREE.Vector3().lerpVectors(pA, pB, s / steps));
    }
    densePoints.push(endPos.clone());
    return densePoints;
}

// ĐỔI: DynamicQuantumSignal (class gốc) -> factory + hàm rời (khớp style vanilla project, không
// dùng class) — GIỮ NGUYÊN toàn bộ field/cơ chế (line grow-to-front, bit payload, fade/destroy).
function createCircuitSignal(sourceChip, targetChip, sourcePin, targetPin, onBitCount, cnGroupCircuit) {
    const startPos = sourceChip.pos.clone().add(sourcePin.mesh.position);
    const endPos = targetChip.pos.clone().add(targetPin.mesh.position);
    const pathPoints = create3DManhattanPath(startPos, endPos);
    const totalSteps = pathPoints.length;

    let totalDistance = 0;
    for (let i = 1; i < pathPoints.length; i++) totalDistance += pathPoints[i - 1].distanceTo(pathPoints[i]);

    const positions = new Float32Array(totalSteps * 3);
    for (let i = 0; i < totalSteps; i++) { positions[i * 3] = startPos.x; positions[i * 3 + 1] = startPos.y; positions[i * 3 + 2] = startPos.z; }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: sourceChip.color, transparent: true, opacity: 0.9, linewidth: 3 });
    const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
    cnGroupCircuit.add(lineMesh);

    const headSpark = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    headSpark.position.copy(startPos);
    cnGroupCircuit.add(headSpark);

    const bitContainer = new THREE.Group();
    cnGroupCircuit.add(bitContainer);

    const signal = {
        source: sourceChip, target: targetChip, sourcePin, targetPin, color: sourceChip.color,
        pathPoints, totalSteps, totalDistance, progress: 0, lineGeometry, lineMaterial, lineMesh,
        headSpark, binaryPattern: buildBitPattern(onBitCount), bitMeshes: [], bitContainer, // groups/connector/circuit.js
        isFinished: false, isFading: false, fadeOpacity: 0.9,
    };
    initCircuitSignalBits(signal);
    return signal;
}

// GIỮ NGUYÊN 100% cơ chế bit=1 "hộp neon"/bit=0 "chấm ma" của gốc.
function initCircuitSignalBits(signal) {
    signal.binaryPattern.forEach((bit, idx) => {
        const mesh = bit
            ? new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.7), new THREE.MeshStandardMaterial({
                color: signal.color, emissive: signal.color, emissiveIntensity: 1.5, roughness: 0.1
            }))
            : new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }));
        mesh.visible = false;
        signal.bitContainer.add(mesh);
        signal.bitMeshes.push({ mesh, bitVal: bit ? 1 : 0, offsetIndex: idx });
    });
}

function onCircuitSignalArrival(signal) {
    signal.isFinished = true;
    signal.headSpark.visible = false;
    signal.sourcePin.busy = false;
    signal.targetPin.busy = false;
    gsap.to(signal.target.bodyMesh.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });
    signal.isFading = true;
}

function destroyCircuitSignal(signal, cnGroupCircuit) {
    cnGroupCircuit.remove(signal.lineMesh);
    cnGroupCircuit.remove(signal.headSpark);
    cnGroupCircuit.remove(signal.bitContainer);
    signal.lineGeometry.dispose();
    signal.lineMaterial.dispose();
}

// GIỮ NGUYÊN logic any-to-any + chống trùng cặp + trần 90 của spawnSignalFromNode(sourceNode)
// gốc — source CỐ ĐỊNH (tham số), chỉ target random, đúng chữ ký gốc (chain reaction cần gọi lại
// với source = chip vừa nhận tín hiệu). KHÔNG có graph cố định nào (đọc lại kỹ bản gốc: target
// luôn chọn ngẫu nhiên trong TOÀN BỘ node).
function spawnCircuitSignal(sourceChip, chips, activeSignals, onBitCount, cnGroupCircuit) {
    if (activeSignals.length > 90) return null;
    const candidates = chips.filter((c) => c !== sourceChip);
    if (candidates.length === 0) return null;
    const targetChip = candidates[Math.floor(Math.random() * candidates.length)];
    if (activeSignals.some((s) => s.source === sourceChip && s.target === targetChip)) return null;

    const sourcePin = pickNearestFreePin(sourceChip, targetChip.pos);
    const targetPin = pickNearestFreePin(targetChip, sourceChip.pos);
    return createCircuitSignal(sourceChip, targetChip, sourcePin, targetPin, onBitCount, cnGroupCircuit);
}

// GIỮ NGUYÊN 100% — 3 chế độ + hằng số hình học + tween GSAP của triggerCinematicCameraShift() gốc.
function triggerCinematicCameraShift(camera, controls, chips, activeSignals) {
    const modes = ['ORBIT_SWEEP', 'TRACK_SIGNAL', 'CLOSE_NODE'];
    const mode = modes[Math.floor(Math.random() * modes.length)];

    if (mode === 'ORBIT_SWEEP') {
        const angle = Math.random() * Math.PI * 2;
        const radius = 55 + Math.random() * 30;
        gsap.to(camera.position, { x: Math.cos(angle) * radius, y: 20 + Math.random() * 30, z: Math.sin(angle) * radius, duration: 4.5, ease: 'power2.inOut' });
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 3.5, ease: 'power2.inOut' });
    } else if (mode === 'CLOSE_NODE' && chips.length > 0) {
        const targetChip = chips[Math.floor(Math.random() * chips.length)];
        gsap.to(camera.position, { x: targetChip.pos.x + 12, y: targetChip.pos.y + 8, z: targetChip.pos.z + 14, duration: 3.5, ease: 'power3.inOut' });
        gsap.to(controls.target, { x: targetChip.pos.x, y: targetChip.pos.y, z: targetChip.pos.z, duration: 3.0, ease: 'power3.inOut' });
    } else if (mode === 'TRACK_SIGNAL' && activeSignals.length > 0) {
        const sig = activeSignals[Math.floor(Math.random() * activeSignals.length)];
        gsap.to(controls.target, { x: sig.source.pos.x, y: sig.source.pos.y, z: sig.source.pos.z, duration: 2.5, ease: 'power2.out' });
    }
    return mode;
}

// ===================== bootstrap dùng chung =====================

function initThreeJSConnector() {
    const canvas = document.getElementById('webgl-canvas');
    const cnScene = new THREE.Scene();
    cnScene.background = null; // trong suốt — lộ Visual Background phía dưới (plan-connector.md Phần D)

    const cnCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1200);
    cnCamera.position.set(0, 30, 210);

    if (!appState.get('tRenderer')) {
        appState.set('tRenderer', new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }), { skipCheck: true });
        appState.get('tRenderer').setPixelRatio(Math.min(window.devicePixelRatio, 2));
        appState.get('tRenderer').setClearAlpha(0); // tường minh — đảm bảo clear về trong suốt, không ngầm định opaque
    }
    const tRenderer = appState.get('tRenderer');
    tRenderer.setSize(window.innerWidth, window.innerHeight);

    const cnControls = new THREE.OrbitControls(cnCamera, tRenderer.domElement);
    cnControls.enableDamping = true;
    cnControls.dampingFactor = 0.05;
    cnControls.rotateSpeed = 0.8;
    cnControls.zoomSpeed = 1.0;
    cnControls.autoRotate = true;

    // SỬA (phản hồi Giang — màu setting không hiện ra): keyLight/fillLight màu bão hoà mạnh (cyan/
    // tím) của gốc PHẢN XẠ đè lên MeshStandardMaterial bất kể color/emissive đặt gì — 2 màu đó
    // vốn được chọn khớp riêng palette cứng hồng-lam-tím-ngọc của bản gốc, giờ vật liệu đổi màu
    // động theo hệ màu core thì đèn màu cố định luôn lấn át. Trung tính hoá về trắng, GIỮ NGUYÊN
    // vị trí/cường độ (rig ánh sáng không đổi, chỉ đổi màu đèn).
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    cnScene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(100, 120, 80);
    cnScene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-100, -80, -60);
    cnScene.add(fillLight);
    const centralLight = new THREE.PointLight(0x00f3ff, 2.0, 100);
    cnScene.add(centralLight);

    const glowTexture = createGlowTexture();
    const sparkTexture = createActionPotentialSparkTexture();
    const cfg = getEffectConfig('connector'); // core/custom-effect.js

    const cnGroupSynapse = new THREE.Group();
    const { neurons, synapses } = buildSynapseNetwork(cfg, cnGroupSynapse, glowTexture);
    cnGroupSynapse.add(buildMicroscopicFluidParticles());
    cnScene.add(cnGroupSynapse);

    const cnGroupCircuit = new THREE.Group();
    cnGroupCircuit.add(createQuantumEnvironment());
    const chips = buildCircuitNodes(cfg, cnGroupCircuit);
    cnScene.add(cnGroupCircuit);

    const renderPass = new THREE.RenderPass(cnScene, cnCamera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.2, 0.6, 0.12);
    const cnComposer = new THREE.EffectComposer(tRenderer);
    cnComposer.addPass(renderPass);
    cnComposer.addPass(bloomPass);

    appState.set('cnScene', cnScene, { skipCheck: true });
    appState.set('cnCamera', cnCamera, { skipCheck: true });
    appState.set('cnControls', cnControls, { skipCheck: true });
    appState.set('cnComposer', cnComposer, { skipCheck: true });
    appState.set('cnBloomPass', bloomPass, { skipCheck: true });
    appState.set('cnGroupSynapse', cnGroupSynapse, { skipCheck: true });
    appState.set('cnGroupCircuit', cnGroupCircuit, { skipCheck: true });
    appState.set('cnNeurons', neurons, { skipCheck: true });
    appState.set('cnSynapses', synapses, { skipCheck: true });
    appState.set('cnChips', chips, { skipCheck: true });
    appState.set('cnActiveSignalsSynapse', [], { skipCheck: true });
    appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
    appState.set('cnGlowTexture', glowTexture, { skipCheck: true });
    appState.set('cnSparkTexture', sparkTexture, { skipCheck: true });
    appState.set('cnInitialized', true, { skipCheck: true });
    updateConnectorVisibility();
}

// ĐỔI: reconfigure fog/camera/controls theo style active — 2 demo gốc có thông số camera/fog
// khác nhau, giờ dùng chung 1 cnScene/cnCamera nên phải áp lại đúng bộ số của style vừa chọn.
// MỚI (phản hồi Giang — trạng thái tạm bị "kẹt" qua bài mới, cảm giác không theo nhạc thật): dọn
// tia/tín hiệu ĐANG BAY của bài cũ (dispose mesh, tránh rò rỉ) + reset baseline onset — cùng tinh
// thần player.js reset raindrops/ripples/activeLightnings mỗi lần đổi bài. Không rebuild network
// (mạng/vị trí neuron giữ nguyên, chỉ dọn trạng thái CHUYỂN ĐỘNG tạm thời).
function resetConnectorPerTrackState() {
    if (!appState.get('cnInitialized')) return;

    const neurons = appState.get('cnNeurons');
    neurons.forEach((n) => { n.prevBinEnergy = 0; n.lastFiredFrame = -9999; n.energy = 0; });
    appState.get('cnActiveSignalsSynapse').forEach((s) => {
        s.synapse.fromNeuron.container.remove(s.mesh);
        s.mesh.geometry.dispose(); s.mesh.material.dispose();
    });
    appState.set('cnActiveSignalsSynapse', [], { skipCheck: true });

    const cnGroupCircuit = appState.get('cnGroupCircuit');
    appState.get('cnActiveSignalsCircuit').forEach((s) => destroyCircuitSignal(s, cnGroupCircuit));
    appState.set('cnActiveSignalsCircuit', [], { skipCheck: true });
    appState.get('cnChips').forEach((c) => c.pins.forEach((p) => { p.busy = false; }));
}

function updateConnectorVisibility() {
    if (!appState.get('cnInitialized')) return;
    const style = getEffectConfig('connector').connectorStyle; // core/custom-effect.js
    const cnScene = appState.get('cnScene');
    const cnCamera = appState.get('cnCamera');
    const cnControls = appState.get('cnControls');
    appState.get('cnGroupSynapse').visible = (style === 'synapse');
    appState.get('cnGroupCircuit').visible = (style === 'circuit');

    if (style === 'synapse') {
        cnScene.fog = new THREE.FogExp2(0x010308, 0.0018);
        // SỬA (phản hồi Giang 16/09/2026 — "bỏ camera xoay và zoom", "map 2D diện tích bằng màn
        // hình"): fov/position.z PHẢI khớp NGUYÊN VĂN SYNAPSE_CAMERA_FOV_DEG/SYNAPSE_CAMERA_DISTANCE
        // (đầu file, buildSynapseGridCells() dùng 2 hằng số này để trải lưới KÍN khung hình camera
        // thấy) — lệch 1 trong 2 chỗ là lưới hết khớp khung hình thật. Bỏ lệch Y (90) trước đây —
        // camera đứng THẲNG trục Z nhìn thẳng vào mặt lưới, không còn nghiêng. Khoá HẲN
        // OrbitControls (rotate/zoom/pan) — không autoRotate, không cho người dùng xoay/zoom/kéo
        // tay nữa; KHỐI cũng không tự xoay nữa (bỏ cnGroupSynapse.rotation trong _tickConnectorSynapse).
        cnCamera.fov = SYNAPSE_CAMERA_FOV_DEG; cnCamera.far = 1200;
        cnCamera.position.set(0, 0, SYNAPSE_CAMERA_DISTANCE);
        cnControls.target.set(0, 0, 0);
        cnControls.minDistance = SYNAPSE_CAMERA_DISTANCE; cnControls.maxDistance = SYNAPSE_CAMERA_DISTANCE;
        cnControls.enableZoom = false;
        cnControls.enableRotate = false;
        cnControls.enablePan = false;
        cnControls.autoRotate = false;
    } else {
        cnScene.fog = new THREE.FogExp2(0x02040a, 0.005);
        cnCamera.fov = 45; cnCamera.far = 1000;
        cnControls.minDistance = 5; cnControls.maxDistance = 180;
        cnControls.enableZoom = true;
        // ĐỔI (16/09/2026): cnControls DÙNG CHUNG 1 instance cho cả 2 style — synapse giờ khoá
        // hẳn rotate/pan (trên), phải TRẢ LẠI true ở đây kẻo circuit thừa hưởng trạng thái khoá từ
        // lần cuối ở synapse (bản gốc circuit vẫn cho kéo/xoay tay bình thường, chỉ không autoRotate).
        cnControls.enableRotate = true;
        cnControls.enablePan = true;
        cnControls.autoRotate = false; // bản gốc circuit không autoRotate — dùng GSAP cinematic riêng
    }
    cnCamera.updateProjectionMatrix();
}
