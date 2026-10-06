/**
 * core/webgl/three-connector.js — builder THUẦN (dựng mesh/scene, không đọc appState) cho group "connector".
 *
 * [06/10/2026, Giang] Style 'synapse' ĐÃ XOÁ HẲN (lưới neuron, sợi trục, tia điện thế, hạt dịch nền, góc máy synapse) —
 * connector giờ CHỈ còn style 'circuit'. Cấu hình đã lưu đang chọn synapse/brain -> 'circuit' (core/config.js::loadConfig()).
 *
 * [06/10/2026, Giang — thiết kế lại circuit, giữ khối lập phương 3D]
 *   - Chip VUÔNG dẹt, chân THANH MẢNH ở cả 4 cạnh; TỔNG số chân mỗi chip = Chip count (nodeCount) chia đều 4 cạnh. Thân +
 *     chân gộp chung MỘT geometry (buildChipGeometry()) -> chân liền mạch với thân. 1 geometry dùng chung mọi chip.
 *   - Chân đứng yên: không phập phồng, không xoay (bỏ gsap scale pulse + tự quay). Chip "nháy" bằng độ phát sáng.
 *   - Mỗi chân dành riêng cho 1 chip khác (assignCircuitPinTargets(): chân quay về phía chip đích) -> có đúng 1 dây
 *     (đường mạch) cho mỗi cặp chip; chân thừa (tổng N chân, N-1 chip khác) là chân "của chính nó", không nối.
 *   - Dây = đường thẳng + bẻ góc vuông (buildCircuitWires()): chân -> ra ngoài 1 đoạn -> lên/xuống "kênh" nằm GIỮA 2 lớp
 *     chip -> chạy ngang trong kênh -> xuống/lên -> vào chân đích. Đoạn ngang luôn nằm trong kênh nên không xuyên thân chip.
 *   - Dây chạm/cắt nhau -> 1 nút tròn tại điểm chạm (collectCircuitJunctions() + InstancedMesh).
 *   - Bit chạy DỌC dây có sẵn, ra từ đầu chân nguồn và đi HẾT vào chân đích (updateCircuitSignal(), circuit.js).
 */

let cnClock = new THREE.Clock();

function computeConnectorSpeed(base, mult, energy) {
    return base + mult * energy;
}

// ===================== Circuit — bố trí node theo LƯỚI LẬP PHƯƠNG k×k×k, lấp từ lớp ngoài vào trong =====================
// (Giang 20/09/2026) "vòng" (ring) = khoảng cách Chebyshev tới MẶT cube gần nhất (0 = vỏ ngoài), sắp ô theo ring rồi lấy
// nodeCount ô ĐẦU — node index i ứng với dải tần i (tonotopic, bass ở vỏ ngoài, treble vào lõi). Lớp cuối chưa lấp đủ được
// rải ĐỀU (stride) trong lớp đó để cube không lệch về 1 phía. GIỮ NGUYÊN.
const CIRCUIT_NODE_MIN = 16;
const CIRCUIT_NODE_MAX = 64;
const CIRCUIT_NODE_FALLBACK = 32;
// Nửa cạnh cube (world units) — cố định để cube luôn vừa khung camera orbit (vị trí (0,30,210), fov 45) kể cả màn dọc.
const CIRCUIT_CUBE_HALF_EXTENT = 32;
// Vị trí camera mặc định chế độ orbit (cũng là vị trí khởi tạo của sân khấu).
const CIRCUIT_ORBIT_HOME = { x: 0, y: 30, z: 210 };
// Trần số nút tròn tại điểm chạm dây (InstancedMesh) — chặn trường hợp cực đoan ở 64 chip.
const CIRCUIT_JUNCTION_MAX = 6000;
// Số đỉnh tối đa của vệt sáng 1 xung (đầu + cuối + các góc bẻ của dây, dây tối đa 7 điểm).
const CIRCUIT_TRAIL_MAX_POINTS = 12;

function buildCircuitCubeCells(nodeCountRaw) {
    const requested = Math.round(Number(nodeCountRaw));
    const nodeCount = Math.max(CIRCUIT_NODE_MIN, Math.min(CIRCUIT_NODE_MAX, Number.isFinite(requested) ? requested : CIRCUIT_NODE_FALLBACK));
    let k = 2;
    while (k * k * k < nodeCount) k++;

    const ringsMap = new Map();
    for (let z = 0; z < k; z++) {
        for (let y = 0; y < k; y++) {
            for (let x = 0; x < k; x++) {
                const ring = Math.min(x, k - 1 - x, y, k - 1 - y, z, k - 1 - z);
                if (!ringsMap.has(ring)) ringsMap.set(ring, []);
                ringsMap.get(ring).push({ x, y, z, ring });
            }
        }
    }

    const chosen = [];
    let remaining = nodeCount;
    for (let r = 0; remaining > 0 && ringsMap.has(r); r++) {
        const cellsInRing = ringsMap.get(r);
        if (cellsInRing.length <= remaining) {
            chosen.push(...cellsInRing);
            remaining -= cellsInRing.length;
        } else {
            for (let j = 0; j < remaining; j++) chosen.push(cellsInRing[Math.floor((j + 0.5) * cellsInRing.length / remaining)]);
            remaining = 0;
        }
    }

    const spacing = (CIRCUIT_CUBE_HALF_EXTENT * 2) / (k - 1);
    const half = (k - 1) / 2;
    chosen.forEach((cell) => { cell.position = new THREE.Vector3((cell.x - half) * spacing, (cell.y - half) * spacing, (cell.z - half) * spacing); });
    return { cells: chosen, spacing, k };
}

// ===================== Chip vuông + chân =====================

/** Kích thước chip/chân/dây/bit tỉ lệ theo khoảng cách ô lưới (k=3 -> 32, k=4 -> ~21.3) và số chân mỗi cạnh. */
function computeCircuitChipMetrics(spacing, pinTotal) {
    const size = spacing * 0.24;
    const perEdgeMax = Math.ceil(pinTotal / 4);
    const pitch = size / (perEdgeMax + 1);
    const pinWidth = Math.min(pitch * 0.4, size * 0.06);
    return {
        spacing, size,
        thickness: size * 0.14,
        pinLen: size * 0.2,
        pinWidth,
        pinThick: size * 0.14 * 0.3,
        stubLen: size * 0.25,               // đoạn dây thẳng ra khỏi đầu chân trước khi bẻ góc
        channelHalf: spacing / 2,           // kênh đi dây nằm giữa 2 lớp chip
        bitRadius: size * 0.045,
        ghostRadius: size * 0.018,
        headRadius: size * 0.06,
        bitGap: size * 0.28,                // khoảng cách giữa 2 bit liên tiếp dọc dây
        junctionRadius: Math.max(pinWidth * 1.4, size * 0.03),
        followBack: size * 1.4,             // camera bám bit: lùi sau đuôi dãy bit
        followUp: size * 0.6,               // ... và nhích lên/lệch ra ngoài dây
    };
}

/** Vị trí các chân (toạ độ CỤC BỘ chip, mặt XZ, y=0): `pinTotal` chân chia đều 4 cạnh (dư thì cạnh đầu thêm 1), mỗi
 * chân {base (sát mép thân), tip (đầu chân), dir (hướng ra ngoài), angle}. Sắp theo góc quanh tâm chip. */
function buildCircuitPinSlots(metrics, pinTotal) {
    const S = metrics.size;
    const base = Math.floor(pinTotal / 4), rem = pinTotal % 4;
    const edges = [
        { dir: new THREE.Vector3(1, 0, 0), at: (u) => new THREE.Vector3(S / 2, 0, u) },
        { dir: new THREE.Vector3(0, 0, 1), at: (u) => new THREE.Vector3(u, 0, S / 2) },
        { dir: new THREE.Vector3(-1, 0, 0), at: (u) => new THREE.Vector3(-S / 2, 0, u) },
        { dir: new THREE.Vector3(0, 0, -1), at: (u) => new THREE.Vector3(u, 0, -S / 2) },
    ];
    const slots = [];
    edges.forEach((edge, e) => {
        const count = base + (e < rem ? 1 : 0);
        for (let m = 0; m < count; m++) {
            const u = -S / 2 + S * (m + 1) / (count + 1);
            const basePos = edge.at(u);
            const tip = basePos.clone().add(edge.dir.clone().multiplyScalar(metrics.pinLen));
            slots.push({ base: basePos, tip, dir: edge.dir.clone(), angle: Math.atan2(tip.z, tip.x) });
        }
    });
    slots.sort((a, b) => a.angle - b.angle);
    return slots;
}

/** 1 geometry DUY NHẤT cho thân vuông + mọi chân (gộp buffer không chỉ mục) — chân cắm sâu vào thân 1 đoạn nên liền
 * mạch, không hở khe. Dùng chung cho mọi chip (mỗi chip vật liệu riêng để đổi màu/độ sáng). */
function buildChipGeometry(metrics, slots) {
    const parts = [new THREE.BoxGeometry(metrics.size, metrics.thickness, metrics.size)];
    const overlap = metrics.size * 0.04;
    const len = metrics.pinLen + overlap;
    slots.forEach((slot) => {
        const alongX = Math.abs(slot.dir.x) > 0.5;
        const pin = new THREE.BoxGeometry(alongX ? len : metrics.pinWidth, metrics.pinThick, alongX ? metrics.pinWidth : len);
        const center = slot.base.clone().add(slot.dir.clone().multiplyScalar((metrics.pinLen - overlap) / 2));
        pin.translate(center.x, center.y, center.z);
        parts.push(pin);
    });
    const flat = parts.map((g) => g.toNonIndexed());
    const total = flat.reduce((n, g) => n + g.attributes.position.count, 0);
    const positions = new Float32Array(total * 3);
    const normals = new Float32Array(total * 3);
    let offset = 0;
    flat.forEach((g) => {
        positions.set(g.attributes.position.array, offset * 3);
        normals.set(g.attributes.normal.array, offset * 3);
        offset += g.attributes.position.count;
    });
    parts.concat(flat).forEach((g) => g.dispose());
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.computeBoundingSphere();
    return merged;
}

/** Mesh 1 chip (geometry dùng chung) + PointLight riêng (giữ như bản gốc). */
function createChipMesh(colorHex, geometry, lightDistance) {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.8 });
    const bodyMesh = new THREE.Mesh(geometry, material);
    group.add(bodyMesh);
    const pLight = new THREE.PointLight(colorHex, 1.2, lightDistance);
    group.add(pLight);
    return { group, bodyMesh, material, pLight };
}

/** Dữ liệu 1 chip từ ô lưới + mesh + vị trí chân. Chân: toạ độ THẾ GIỚI đầu chân + hướng; chip đích/dây gán sau
 * (assignCircuitPinTargets(), buildCircuitWires()). Trạng thái audio cùng tên field cũ để dùng lại tonotopic.js. */
function assembleCircuitChip(cell, index, colorHex, chipMesh, slots) {
    chipMesh.group.position.copy(cell.position);
    return {
        id: `NODE_${index}`, index, pos: cell.position.clone(), cell: { x: cell.x, y: cell.y, z: cell.z, ring: cell.ring },
        group: chipMesh.group, bodyMesh: chipMesh.bodyMesh, material: chipMesh.material, pLight: chipMesh.pLight, color: colorHex,
        pins: slots.map((slot, s) => ({ slot: s, angle: slot.angle, dir: slot.dir.clone(), tipWorld: cell.position.clone().add(slot.tip), targetIndex: -1, wireIndex: -1 })),
        pinByTarget: [], neighbors: [],
        energy: 0, prevBinEnergy: 0, smoothedBinEnergy: 0, adaptation: 0, lateralInhibition: 0,
        frameEnergy: 0, frameDiff: 0,
    };
}

/** Láng giềng của mỗi chip = các chip cách ≤ 1 ô theo cả 3 trục (Chebyshev) — lateral inhibition. Sửa tại chỗ. */
function linkCircuitChipNeighbors(chips) {
    chips.forEach((a, i) => {
        chips.forEach((b, j) => {
            if (i === j) return;
            if (Math.max(Math.abs(a.cell.x - b.cell.x), Math.abs(a.cell.y - b.cell.y), Math.abs(a.cell.z - b.cell.z)) <= 1) a.neighbors.push(j);
        });
    });
}

/** Mỗi chip: N-1 chip khác -> N chân. Sắp chip đích theo góc (mặt XZ) quanh chip này, sắp chân theo góc, rồi tìm độ
 * xoay vòng khớp 2 dãy sai lệch góc NHỎ NHẤT -> mỗi chân hướng gần đúng về chip nó nối. Chip cùng cột (không lệch XZ)
 * nhận góc rải theo golden angle. Chân còn dư (chân "của chính nó") giữ targetIndex = -1. Sửa tại chỗ. */
function assignCircuitPinTargets(chips) {
    const n = chips.length;
    chips.forEach((chip, i) => {
        const targets = [];
        chips.forEach((other, j) => {
            if (j === i) return;
            const dx = other.pos.x - chip.pos.x, dz = other.pos.z - chip.pos.z;
            const flat = dx * dx + dz * dz < 1e-6;
            targets.push({ j, angle: flat ? ((j * 2.39996323) % (Math.PI * 2)) - Math.PI : Math.atan2(dz, dx) });
        });
        targets.sort((a, b) => a.angle - b.angle);
        const pinCount = chip.pins.length;
        let bestShift = 0, bestCost = Infinity;
        for (let r = 0; r < pinCount; r++) {
            let cost = 0;
            for (let k = 0; k < targets.length; k++) {
                const diff = Math.abs(targets[k].angle - chip.pins[(k + r) % pinCount].angle) % (Math.PI * 2);
                cost += Math.min(diff, Math.PI * 2 - diff);
            }
            if (cost < bestCost) { bestCost = cost; bestShift = r; }
        }
        chip.pinByTarget = new Array(n).fill(-1);
        targets.forEach((t, k) => {
            const pinIndex = (k + bestShift) % pinCount;
            chip.pins[pinIndex].targetIndex = t.j;
            chip.pinByTarget[t.j] = pinIndex;
        });
    });
}

// ===================== Dây (đường mạch) =====================

/** 1 dây cho mỗi cặp chip (i<j), nối chân i->j với chân j->i. Đường: đầu chân A -> thẳng ra (stub) -> dọc trục Y tới kênh
 * (giữa lớp A và lớp kế bên phía chip B; cùng lớp thì kênh phía tâm cube) -> 2 đoạn ngang vuông góc trong kênh (thứ tự X/Z
 * xen kẽ theo cặp) -> dọc trục Y tới stub B -> vào đầu chân B. Bỏ điểm trùng/thẳng hàng. Ghi wireIndex vào 2 chân.
 * Trả mảng {a, b, points, cum (độ dài cộng dồn), total}. */
function buildCircuitWires(chips, metrics) {
    const wires = [];
    const h = metrics.channelHalf;
    for (let i = 0; i < chips.length; i++) {
        for (let j = i + 1; j < chips.length; j++) {
            const A = chips[i], B = chips[j];
            const pinA = A.pins[A.pinByTarget[j]], pinB = B.pins[B.pinByTarget[i]];
            if (!pinA || !pinB) continue;
            const stubA = pinA.tipWorld.clone().add(pinA.dir.clone().multiplyScalar(metrics.stubLen));
            const stubB = pinB.tipWorld.clone().add(pinB.dir.clone().multiplyScalar(metrics.stubLen));
            const dy = B.pos.y - A.pos.y;
            let side = Math.sign(dy);
            if (Math.abs(dy) < 1e-3) side = A.pos.y < -1e-3 ? 1 : (A.pos.y > 1e-3 ? -1 : ((i + j) % 2 ? 1 : -1));
            const yc = A.pos.y + side * h;
            const corner = (i * 7 + j * 3) % 2
                ? new THREE.Vector3(stubB.x, yc, stubA.z)
                : new THREE.Vector3(stubA.x, yc, stubB.z);
            const raw = [pinA.tipWorld.clone(), stubA, new THREE.Vector3(stubA.x, yc, stubA.z), corner, new THREE.Vector3(stubB.x, yc, stubB.z), stubB, pinB.tipWorld.clone()];
            const dedup = raw.filter((p, k) => k === 0 || p.distanceToSquared(raw[k - 1]) > 1e-8);
            const points = dedup.filter((p, k) => {
                if (k === 0 || k === dedup.length - 1) return true;
                const d1 = p.clone().sub(dedup[k - 1]).normalize(), d2 = dedup[k + 1].clone().sub(p).normalize();
                return d1.dot(d2) < 0.9999;
            });
            const cum = [0];
            for (let k = 1; k < points.length; k++) cum.push(cum[k - 1] + points[k].distanceTo(points[k - 1]));
            pinA.wireIndex = wires.length;
            pinB.wireIndex = wires.length;
            wires.push({ a: i, b: j, points, cum, total: cum[cum.length - 1] });
        }
    }
    return wires;
}

/** Toàn bộ dây vẽ bằng 1 LineSegments (vertex color): nửa dây phía chip A mang màu A, nửa phía B mang màu B (đoạn vắt
 * qua điểm giữa tự chuyển màu). `vertexChip` = chip quyết định màu từng đỉnh — updateCircuitTraceColors() đọc lại. */
function buildCircuitTraceMesh(wires, opacity) {
    let segCount = 0;
    wires.forEach((w) => { segCount += w.points.length - 1; });
    const positions = new Float32Array(segCount * 2 * 3);
    const colors = new Float32Array(segCount * 2 * 3);
    const vertexChip = new Int16Array(segCount * 2);
    let v = 0;
    wires.forEach((w) => {
        for (let k = 0; k < w.points.length - 1; k++) {
            [k, k + 1].forEach((idx) => {
                const p = w.points[idx];
                positions[v * 3] = p.x; positions[v * 3 + 1] = p.y; positions[v * 3 + 2] = p.z;
                vertexChip[v] = w.cum[idx] / Math.max(1e-6, w.total) < 0.5 ? w.a : w.b;
                v++;
            });
        }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.LineSegments(geometry, material);
    return { mesh, vertexChip, lastHex: [] };
}

/** Điểm 2 dây KHÁC NHAU chạm/cắt nhau (mọi đoạn đều song song trục X/Y/Z): X×Z cùng cao độ y, X×Y cùng z, Z×Y cùng x —
 * gom theo toạ độ chung (bucket) để không phải xét mọi cặp đoạn. Tính cả chạm đầu mút (dây rẽ nhánh khỏi dây khác). Đoạn
 * TRÙNG phương nằm chồng nhau coi như 1 đường bus, không đặt nút. Khử trùng điểm, tối đa `maxCount`.
 * Trả [{ position, chip }] (chip = chip A của dây đầu tiên, dùng làm màu nút). */
function collectCircuitJunctions(wires, maxCount) {
    const q = (v) => Math.round(v * 1000);
    const EPS = 1e-3;
    const inRange = (v, lo, hi) => v >= lo - EPS && v <= hi + EPS;
    const buckets = { xByY: new Map(), zByY: new Map(), xByZ: new Map(), yByZ: new Map(), zByX: new Map(), yByX: new Map() };
    const put = (map, key, seg) => { if (!map.has(key)) map.set(key, []); map.get(key).push(seg); };
    wires.forEach((w, wi) => {
        for (let k = 0; k < w.points.length - 1; k++) {
            const p = w.points[k], r = w.points[k + 1];
            const seg = { wire: wi, chip: w.a, p };
            if (Math.abs(p.x - r.x) > EPS) {
                seg.lo = Math.min(p.x, r.x); seg.hi = Math.max(p.x, r.x);
                put(buckets.xByY, q(p.y), seg); put(buckets.xByZ, q(p.z), seg);
            } else if (Math.abs(p.z - r.z) > EPS) {
                seg.lo = Math.min(p.z, r.z); seg.hi = Math.max(p.z, r.z);
                put(buckets.zByY, q(p.y), seg); put(buckets.zByX, q(p.x), seg);
            } else if (Math.abs(p.y - r.y) > EPS) {
                seg.lo = Math.min(p.y, r.y); seg.hi = Math.max(p.y, r.y);
                put(buckets.yByZ, q(p.z), seg); put(buckets.yByX, q(p.x), seg);
            }
        }
    });
    const found = new Map();
    const add = (x, y, z, chip) => {
        if (found.size >= maxCount) return;
        const key = `${q(x)},${q(y)},${q(z)}`;
        if (!found.has(key)) found.set(key, { position: new THREE.Vector3(x, y, z), chip });
    };
    // X × Z (cùng y): X-seg cố định z, Z-seg cố định x
    buckets.xByY.forEach((xs, key) => {
        const zs = buckets.zByY.get(key);
        if (!zs) return;
        xs.forEach((a) => zs.forEach((b) => {
            if (a.wire === b.wire) return;
            if (inRange(b.p.x, a.lo, a.hi) && inRange(a.p.z, b.lo, b.hi)) add(b.p.x, a.p.y, a.p.z, a.chip);
        }));
    });
    // X × Y (cùng z): X-seg cố định y, Y-seg cố định x
    buckets.xByZ.forEach((xs, key) => {
        const ys = buckets.yByZ.get(key);
        if (!ys) return;
        xs.forEach((a) => ys.forEach((b) => {
            if (a.wire === b.wire) return;
            if (inRange(b.p.x, a.lo, a.hi) && inRange(a.p.y, b.lo, b.hi)) add(b.p.x, a.p.y, a.p.z, a.chip);
        }));
    });
    // Z × Y (cùng x): Z-seg cố định y, Y-seg cố định z
    buckets.zByX.forEach((zs, key) => {
        const ys = buckets.yByX.get(key);
        if (!ys) return;
        zs.forEach((a) => ys.forEach((b) => {
            if (a.wire === b.wire) return;
            if (inRange(b.p.z, a.lo, a.hi) && inRange(a.p.y, b.lo, b.hi)) add(a.p.x, a.p.y, b.p.z, a.chip);
        }));
    });
    return Array.from(found.values());
}

/** Nút tròn tại điểm chạm — InstancedMesh (1 draw call) màu từng nút theo chip (updateCircuitTraceColors()). */
function buildCircuitJunctionMesh(junctions, radius, opacity) {
    const geometry = new THREE.SphereGeometry(radius, 10, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: Math.min(1, opacity * 1.6) });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, junctions.length));
    const matrix = new THREE.Matrix4();
    const white = new THREE.Color(0xffffff);
    junctions.forEach((jn, idx) => {
        matrix.makeTranslation(jn.position.x, jn.position.y, jn.position.z);
        mesh.setMatrixAt(idx, matrix);
        mesh.setColorAt(idx, white); // tạo instanceColor TRƯỚC lần render đầu
    });
    mesh.count = junctions.length;
    mesh.frustumCulled = false; // r128 cull theo bounding sphere geometry gốc (tại gốc toạ độ), không theo vị trí instance
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, junctionChip: Int16Array.from(junctions.map((jn) => jn.chip)) };
}

// ===================== Xung bit =====================

/** Geometry dùng chung cho mọi xung của lần dựng này (tỉ lệ theo cỡ chip) — dispose khi dựng lại scene. */
function createCircuitSignalAssets(metrics) {
    return {
        bitGeo: new THREE.SphereGeometry(metrics.bitRadius, 10, 8),
        ghostGeo: new THREE.SphereGeometry(metrics.ghostRadius, 6, 5),
        headGeo: new THREE.SphereGeometry(metrics.headRadius, 10, 8),
        bitGap: metrics.bitGap,
        followBack: metrics.followBack,
        followUp: metrics.followUp,
    };
}

function disposeCircuitSignalAssets(assets) {
    assets.bitGeo.dispose();
    assets.ghostGeo.dispose();
    assets.headGeo.dispose();
}

/** 1 xung chạy trên dây `wire` từ chip nguồn (reverse = đi ngược chiều lưu của dây). Gồm vệt sáng (Line, tối đa
 * CIRCUIT_TRAIL_MAX_POINTS đỉnh), đầu xung trắng và dãy bit (1 = cầu màu, 0 = chấm mờ). Bit ẩn tới khi ló ra khỏi chân. */
function createCircuitSignal(sourceChip, targetChip, wire, reverse, binaryPattern, colorHex, assets, parentGroup) {
    const container = new THREE.Group();
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CIRCUIT_TRAIL_MAX_POINTS * 3), 3));
    trailGeo.setDrawRange(0, 0);
    const trailMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    trailLine.frustumCulled = false; // đỉnh đổi mỗi frame — bounding sphere không cập nhật
    container.add(trailLine);

    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headSpark = new THREE.Mesh(assets.headGeo, headMat);
    headSpark.visible = false;
    container.add(headSpark);

    const bitMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const bitMeshes = binaryPattern.map((bit) => {
        const mesh = new THREE.Mesh(bit ? assets.bitGeo : assets.ghostGeo, bit ? bitMat : ghostMat);
        mesh.visible = false;
        container.add(mesh);
        return mesh;
    });
    parentGroup.add(container);

    return {
        source: sourceChip, target: targetChip, wire, reverse, color: colorHex,
        headDist: 0, arrived: false, done: false,
        container, trailGeo, trailMat, trailLine, headSpark, headMat, bitMat, ghostMat, bitMeshes,
        headPos: sourceChip.pos.clone(), headDir: new THREE.Vector3(1, 0, 0), tailPos: sourceChip.pos.clone(),
    };
}

/** Gỡ xung khỏi scene + giải phóng vật liệu/geometry riêng (geometry bit/đầu xung dùng chung — không dispose). */
function destroyCircuitSignal(signal, parentGroup) {
    parentGroup.remove(signal.container);
    signal.trailGeo.dispose();
    signal.trailMat.dispose();
    signal.headMat.dispose();
    signal.bitMat.dispose();
    signal.ghostMat.dispose();
    signal.done = true;
}

/** Đã có xung đang bay từ `sourceChip` tới `targetChip` chưa (tránh bắn trùng cặp). */
function hasCircuitSignalBetween(activeSignals, sourceChip, targetChip) {
    return activeSignals.some((s) => s.source === sourceChip && s.target === targetChip);
}

// GIỮ NGUYÊN — 3 chế độ + hằng số hình học + tween GSAP của triggerCinematicCameraShift() gốc (chỉ chạy ở camera orbit).
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

// ===================== bootstrap =====================

// Circuit render qua EffectComposer + UnrealBloomPass; pass cuối TÍNH LẠI alpha từ độ sáng (alpha = max(r,g,b)) để nền
// trong suốt lộ Visual Background phía sau (bloom cộng đẩy alpha lên 1 khắp màn hình). GIỮ NGUYÊN.
const CN_ALPHA_FROM_LUMA_SHADER = {
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0); gl_FragColor = vec4(c.rgb, a); }'
};

/** Sân khấu Connector: scene trong suốt, camera, OrbitControls, 4 đèn, nhóm circuit rỗng đã gắn vào scene. */
function buildConnectorStage(aspect, renderer) {
    const scene = new THREE.Scene();
    scene.background = null; // trong suốt — lộ Visual Background phía dưới
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1200);
    camera.position.set(CIRCUIT_ORBIT_HOME.x, CIRCUIT_ORBIT_HOME.y, CIRCUIT_ORBIT_HOME.z);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controls.autoRotate = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(100, 120, 80);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-100, -80, -60);
    scene.add(fillLight);
    scene.add(new THREE.PointLight(0x00f3ff, 2.0, 100));

    const groupCircuit = new THREE.Group();
    scene.add(groupCircuit);
    return { scene, camera, controls, groupCircuit };
}

/** Gắn 1 object con vào nhóm. */
function attachThreeChild(parent, child) {
    parent.add(child);
}

/** Chuỗi hậu kỳ: render -> bloom -> alpha theo độ sáng (giữ nền trong suốt). */
function buildConnectorComposer(renderer, scene, camera, width, height) {
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(width, height), 2.2, 0.6, 0.12);
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(bloomPass);
    composer.addPass(new THREE.ShaderPass(CN_ALPHA_FROM_LUMA_SHADER));
    return { composer, bloomPass };
}

/** Góc máy circuit: fog + fov + giới hạn OrbitControls (bật/tắt điều khiển do chế độ camera quyết định). */
function applyCircuitCameraView(scene, camera, controls) {
    scene.fog = new THREE.FogExp2(0x02040a, 0.005);
    camera.fov = 45; camera.far = 1000;
    controls.minDistance = 5; controls.maxDistance = 180;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    camera.updateProjectionMatrix();
}
