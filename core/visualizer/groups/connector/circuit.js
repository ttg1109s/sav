/**
 * core/visualizer/groups/connector/circuit.js — bước 1 khung hình, style circuit. THUẦN, Workflow
 * (event/workflow/visualizer/connector.js) tự gom rồi gọi. Builder scene ở core/webgl/three-connector.js.
 *
 * [06/10/2026, Giang — thiết kế lại circuit] Chân phóng bit = KẾT HỢP 3 thông số audio:
 *   1) chip bắn khi DẢI TẦN của nó có onset (như cũ — tonotopic.js);
 *   2) SỐ chân phóng cùng lúc theo năng lượng onset (pickFirePinCountFromEnergy(), trần = slider maxPinsPerFire);
 *   3) CHÂN nào phóng: mỗi chân nối riêng tới 1 chip (= 1 dải tần) — chân đầu tiên là chân nối tới chip theo PITCH
 *      (nốt đang phát rơi vào dải tần của chip đó), các chân còn lại là chân nối tới những chip có dải tần đang ONSET
 *      mạnh nhất cùng frame (pickCircuitFireTargets()).
 * Bit chạy dọc dây có sẵn và đi HẾT vào chân đích (không còn dừng giữa đường lúc đầu xung tới nơi — bản cũ chuyển sang
 * fade ngay khi đầu xung chạm đích nên các bit phía sau đứng im giữa dây).
 */

// Payload bit theo cường độ CỦA CHÍNH node: phần năng lượng vượt ngưỡng bắn cơ sở quy ra 1..7 bit sáng. GIỮ NGUYÊN.
function pickOnBitCountFromEnergy(energyByte, baseThresholdByte) {
    const span = Math.max(1, 255 - baseThresholdByte);
    const t = Math.max(0, Math.min(1, (energyByte - baseThresholdByte) / span));
    return 1 + Math.round(t * 6);
}

/** MỚI (06/10/2026) — số chân phóng cùng lúc: 1 (vừa chạm ngưỡng) .. maxPins (năng lượng tối đa). */
function pickFirePinCountFromEnergy(energyByte, baseThresholdByte, maxPins) {
    const span = Math.max(1, 255 - baseThresholdByte);
    const t = Math.max(0, Math.min(1, (energyByte - baseThresholdByte) / span));
    return Math.max(1, 1 + Math.round(t * (Math.max(1, maxPins) - 1)));
}

/** MỚI (06/10/2026) — danh sách chip ĐÍCH cho lần bắn của chip `sourceIndex` (= các chân sẽ phóng, vì mỗi chân nối 1
 * chip): [chip theo pitch (nếu có, khác nguồn)] + các chip có dải tần đang onset (frameDiff > 0 và vượt ngưỡng cơ sở)
 * xếp giảm dần theo độ tăng, tới đủ `pinCount`. Không ai thoả -> chip GẦN NHẤT (hoà thì ngẫu nhiên). Đọc
 * chip.frameDiff/frameEnergy do Workflow ghi ở lượt 1 của frame. */
function pickCircuitFireTargets(chips, sourceIndex, pitchNodeIndex, pinCount, baseThresholdByte) {
    const out = [];
    if (pitchNodeIndex !== null && pitchNodeIndex !== undefined && pitchNodeIndex !== sourceIndex && chips[pitchNodeIndex]) out.push(pitchNodeIndex);
    const ranked = [];
    chips.forEach((chip, j) => {
        if (j === sourceIndex || out.includes(j)) return;
        if (chip.frameDiff > 0 && chip.frameEnergy > baseThresholdByte) ranked.push(j);
    });
    ranked.sort((a, b) => chips[b].frameDiff - chips[a].frameDiff);
    out.push(...ranked.slice(0, Math.max(0, pinCount - out.length)));
    if (out.length) return out;

    const sourcePos = chips[sourceIndex].pos;
    let bestDist = Infinity, candidates = [];
    chips.forEach((chip, j) => {
        if (j === sourceIndex) return;
        const d = chip.pos.distanceToSquared(sourcePos);
        if (d < bestDist - 1e-6) { bestDist = d; candidates = [j]; }
        else if (Math.abs(d - bestDist) <= 1e-6) candidates.push(j);
    });
    return candidates.length ? [candidates[Math.floor(Math.random() * candidates.length)]] : [];
}

function buildBitPattern(onBitCount) {
    const idx = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const on = new Set(idx.slice(0, onBitCount));
    return [0, 1, 2, 3, 4, 5, 6, 7].map((b) => on.has(b));
}

/**
 * VIẾT LẠI (06/10/2026) — 1 bước của xung trên dây có sẵn. `headDist` (world units, tính từ đầu chân nguồn) tăng theo
 * tốc độ; bit thứ k nằm sau đầu xung (k+1)*bitGap, chỉ hiện khi đã ló khỏi chân nguồn và CHƯA lọt vào chân đích; vệt
 * sáng dài `trailUnits` sau đầu xung, bị "nuốt" dần vào chân đích. Xung chỉ xong khi BIT CUỐI + vệt sáng đã vào hết chip.
 * Cập nhật signal.headPos/headDir/tailPos (camera bám bit đọc). Trả 'arrive' (đầu xung vừa chạm chân đích, đúng 1 lần)
 * | 'destroy' (đã vào hết) | null.
 */
function updateCircuitSignal(signal, delta, speedUnitsPerSec, trailUnits, bitGap) {
    const wire = signal.wire, pts = wire.points, cum = wire.cum, total = wire.total, rev = signal.reverse;
    const lastSeg = pts.length - 2;
    // Điểm ở quãng đường d (tính theo chiều xung đi) -> out; trả chỉ số đoạn (theo chiều lưu của dây).
    const at = (d, out) => {
        const w = Math.max(0, Math.min(total, rev ? total - d : d));
        let k = 0;
        while (k < lastSeg && cum[k + 1] < w) k++;
        const len = Math.max(1e-6, cum[k + 1] - cum[k]);
        out.lerpVectors(pts[k], pts[k + 1], Math.max(0, Math.min(1, (w - cum[k]) / len)));
        return k;
    };

    signal.headDist += speedUnitsPerSec * delta;
    let result = null;
    if (!signal.arrived && signal.headDist >= total) { signal.arrived = true; result = 'arrive'; }

    const headClamped = Math.min(signal.headDist, total);
    const seg = at(headClamped, signal.headPos);
    signal.headDir.subVectors(pts[seg + 1], pts[seg]).normalize();
    if (rev) signal.headDir.negate();
    signal.headSpark.visible = signal.headDist < total;
    signal.headSpark.position.copy(signal.headPos);

    signal.bitMeshes.forEach((mesh, k) => {
        const d = signal.headDist - (k + 1) * bitGap;
        mesh.visible = d >= 0 && d <= total;
        if (mesh.visible) at(d, mesh.position);
    });
    at(signal.headDist - (signal.bitMeshes.length + 1) * bitGap, signal.tailPos);

    const d1 = headClamped, d0 = Math.max(0, signal.headDist - trailUnits);
    const posArr = signal.trailGeo.attributes.position.array;
    let count = 0;
    const tmp = new THREE.Vector3();
    const push = (p) => { posArr[count * 3] = p.x; posArr[count * 3 + 1] = p.y; posArr[count * 3 + 2] = p.z; count++; };
    if (d1 - d0 > 1e-4) {
        at(d0, tmp); push(tmp);
        for (let n = 0; n < pts.length && count < CIRCUIT_TRAIL_MAX_POINTS - 1; n++) {
            const v = rev ? pts.length - 1 - n : n;
            const dv = rev ? total - cum[v] : cum[v];
            if (dv > d0 && dv < d1) push(pts[v]);
        }
        at(d1, tmp); push(tmp);
    }
    signal.trailGeo.setDrawRange(0, count);
    signal.trailGeo.attributes.position.needsUpdate = true;

    const tailIn = signal.headDist - (signal.bitMeshes.length + 1) * bitGap >= total;
    const trailIn = signal.headDist - trailUnits >= total;
    if (tailIn && trailIn) return 'destroy';
    return result;
}

/** Chip đích sáng bừng khi đầu xung chạm chân (thay gsap phình thân cũ — chân đứng yên, liền thân). */
function onCircuitSignalArrival(signal) {
    signal.target.energy = Math.max(signal.target.energy, 2.2);
}

/** Chip nguồn sáng nhẹ lúc bắn (thay gsap phình thân cũ). */
function markCircuitChipFired(chip) {
    chip.energy = Math.max(chip.energy, 1.4);
}

/** Màu SỐNG mỗi frame (thân+chân chung 1 vật liệu, PointLight). `chip.color` (hex int) cập nhật để xung MỚI mang màu
 * hiện tại; xung ĐANG BAY giữ màu lúc bắn. */
function applyChipLiveColor(chip, fillColor) {
    chip.material.color.set(fillColor);
    chip.material.emissive.set(fillColor);
    chip.pLight.color.set(fillColor);
    chip.color = chip.material.color.getHex();
}

/** MỚI (06/10/2026) — màu dây + nút chạm theo màu chip (chỉ ghi lại buffer khi có chip đổi màu) + độ sáng dây. */
function updateCircuitTraceColors(trace, junction, chips, opacity) {
    trace.mesh.material.opacity = opacity;
    junction.mesh.material.opacity = Math.min(1, opacity * 1.6);
    let changed = trace.lastHex.length !== chips.length;
    chips.forEach((chip, i) => { if (trace.lastHex[i] !== chip.color) changed = true; });
    if (!changed) return;
    trace.lastHex = chips.map((chip) => chip.color);
    const rgb = chips.map((chip) => new THREE.Color(chip.color));
    const colors = trace.mesh.geometry.attributes.color.array;
    for (let v = 0; v < trace.vertexChip.length; v++) {
        const c = rgb[trace.vertexChip[v]];
        colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
    }
    trace.mesh.geometry.attributes.color.needsUpdate = true;
    for (let n = 0; n < junction.mesh.count; n++) junction.mesh.setColorAt(n, rgb[junction.junctionChip[n]]);
    if (junction.mesh.instanceColor) junction.mesh.instanceColor.needsUpdate = true;
}

/** Camera trôi chậm quanh cụm chip ở chế độ ORBIT_SWEEP (orbit). GIỮ NGUYÊN. */
function driftOrbitSweepCamera(camera, elapsedSec) {
    camera.position.x += Math.cos(elapsedSec * 0.15) * 0.04;
    camera.position.z += Math.sin(elapsedSec * 0.15) * 0.04;
}

// ===================== Camera (06/10/2026, Giang — 3 chế độ) =====================

/** Vào chế độ orbit: bật OrbitControls, đưa camera về vị trí nhà nhìn tâm cube. */
function enterCircuitOrbitCamera(camera, controls) {
    controls.enabled = true;
    camera.position.set(CIRCUIT_ORBIT_HOME.x, CIRCUIT_ORBIT_HOME.y, CIRCUIT_ORBIT_HOME.z);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
}

/** Vào chế độ bám bit / cố định: tắt OrbitControls (camera do code đặt mỗi frame). */
function enterCircuitManualCamera(controls) {
    controls.enabled = false;
}

/** Xung để camera bám: ưu tiên xung mới bắn (còn quãng đường dài), ngẫu nhiên; không còn xung -> null. */
function pickFollowCircuitSignal(activeSignals) {
    const alive = activeSignals.filter((s) => !s.done && !s.arrived);
    const fresh = alive.filter((s) => s.headDist < s.wire.total * 0.4);
    const pool = fresh.length ? fresh : alive;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/** Camera bám dãy bit: đứng sau đuôi dãy bit (lùi `back` ngược hướng chạy), nhích ra khỏi dây `up` (đoạn dọc thì lệch ra
 * phía ngoài cube), nhìn về đầu xung; vị trí/điểm nhìn đuổi mượt theo thời gian (không giật ở góc bẻ). `lookTarget` là
 * Vector3 trạng thái của Workflow (sửa tại chỗ). */
function stepFollowCircuitCamera(camera, lookTarget, signal, deltaTime, back, up) {
    const offset = Math.abs(signal.headDir.y) > 0.9
        ? new THREE.Vector3(signal.tailPos.x, 0, signal.tailPos.z)
        : new THREE.Vector3(0, 1, 0);
    if (offset.lengthSq() < 1e-6) offset.set(1, 0, 0);
    offset.normalize().multiplyScalar(up);
    const desired = signal.tailPos.clone().sub(signal.headDir.clone().multiplyScalar(back)).add(offset);
    camera.position.lerp(desired, 1 - Math.exp(-deltaTime * 5));
    lookTarget.lerp(signal.headPos, 1 - Math.exp(-deltaTime * 7));
    camera.lookAt(lookTarget);
}

/** Camera cố định nhìn từ ngoài vào: X/Y = dời ngang/dọc (dời cả điểm nhìn), Z = khoảng cách tới điểm nhìn, xoay ngang
 * (quanh trục dọc) / xoay dọc (ngẩng-cúi) quanh điểm nhìn. Góc theo độ. */
function applyFixedCircuitCameraPose(camera, posX, posY, distance, rotYDeg, rotXDeg) {
    const yaw = rotYDeg * Math.PI / 180, pitch = rotXDeg * Math.PI / 180;
    const target = new THREE.Vector3(Math.cos(yaw) * posX, posY, -Math.sin(yaw) * posX);
    camera.position.set(
        target.x + distance * Math.cos(pitch) * Math.sin(yaw),
        target.y + distance * Math.sin(pitch),
        target.z + distance * Math.cos(pitch) * Math.cos(yaw)
    );
    camera.lookAt(target);
}
