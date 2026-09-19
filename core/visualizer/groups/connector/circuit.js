/**
 * core/visualizer/groups/connector/circuit.js — bước 1 khung hình, style circuit. THUẦN,
 * Workflow (_tickConnectorCircuit(), event/workflow/visualizer-render.js) tự gom rồi gọi.
 */

// ĐỔI (yêu cầu Giang — payload bit theo cường độ CỦA CHÍNH node): trước đây pickOnBitCount(beatScale
// toàn cục lúc beat) — mọi xung trong cùng 1 beat dùng chung 1 giá trị, không liên quan node nào bắn.
// Giờ đo phần năng lượng của node VƯỢT ngưỡng bắn cơ sở (slider fireThreshold*255) trên phần còn
// lại tới 255, quy ra 1..7 bit sáng (tối thiểu 1 — xung đã bắn thì luôn mang ít nhất 1 bit). Vị
// trí các bit sáng vẫn ngẫu nhiên (buildBitPattern()).
function pickOnBitCountFromEnergy(energyByte, baseThresholdByte) {
    const span = Math.max(1, 255 - baseThresholdByte);
    const t = Math.max(0, Math.min(1, (energyByte - baseThresholdByte) / span));
    return 1 + Math.round(t * 6);
}

// MỚI — chọn ĐÍCH cho xung của node `sourceIndex`: node theo pitch (`pitchNodeIndex`, Workflow tra
// bằng tonotopicNodeIndexForFrequency(), synapse.js) nếu có VÀ khác chính nguồn; không thì rơi về
// node GẦN NHẤT theo khoảng cách thật (hoà thì ngẫu nhiên trong các node cùng khoảng cách). null
// khi chỉ có 1 chip.
function pickCircuitTargetIndex(chips, sourceIndex, pitchNodeIndex) {
    if (pitchNodeIndex !== null && pitchNodeIndex !== undefined && pitchNodeIndex !== sourceIndex && chips[pitchNodeIndex]) return pitchNodeIndex;
    const sourcePos = chips[sourceIndex].pos;
    let bestDist = Infinity, candidates = [];
    chips.forEach((chip, j) => {
        if (j === sourceIndex) return;
        const d = chip.pos.distanceToSquared(sourcePos);
        if (d < bestDist - 1e-6) { bestDist = d; candidates = [j]; }
        else if (Math.abs(d - bestDist) <= 1e-6) candidates.push(j);
    });
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
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
 * GIỮ NGUYÊN mechanic update() gốc (line grow-to-front theo progress, fade sau khi tới đích, bit
 * pulse theo offsetIndex*bitSpacingSteps). ĐỔI: (1) speed nhận units/sec thật, quy đổi ra
 * progress-fraction/sec THEO ĐÚNG chiều dài route này thay vì hằng số random 0.35-0.6 gốc;
 * (2) thêm setDrawRange (đuôi wipe dần theo trailLength) — cộng thêm, không thay phần grow gốc.
 * Trả về 'destroy' | 'arrive' | null.
 */
function updateCircuitSignal(signal, delta, speedUnitsPerSec, trailLength) {
    if (signal.isFading) {
        signal.fadeOpacity -= delta * 1.2;
        if (signal.fadeOpacity <= 0) return 'destroy';
        signal.lineMaterial.opacity = signal.fadeOpacity;
        signal.bitMeshes.forEach((b) => { if (b.mesh.material) b.mesh.material.opacity = signal.fadeOpacity; });
        return null;
    }

    const speedFraction = speedUnitsPerSec / Math.max(1, signal.totalDistance);
    signal.progress += speedFraction * delta;
    const currentStep = Math.min(signal.totalSteps - 1, Math.floor(signal.progress * (signal.totalSteps - 1)));

    const posArr = signal.lineGeometry.attributes.position.array;
    for (let i = 0; i <= currentStep; i++) {
        const pt = signal.pathPoints[i];
        posArr[i * 3] = pt.x; posArr[i * 3 + 1] = pt.y; posArr[i * 3 + 2] = pt.z;
    }
    const currentPos = signal.pathPoints[currentStep];
    for (let i = currentStep + 1; i < signal.totalSteps; i++) {
        posArr[i * 3] = currentPos.x; posArr[i * 3 + 1] = currentPos.y; posArr[i * 3 + 2] = currentPos.z;
    }
    signal.lineGeometry.attributes.position.needsUpdate = true;

    const drawStart = Math.max(0, currentStep - trailLength);
    signal.lineGeometry.setDrawRange(drawStart, currentStep - drawStart + 1);

    signal.headSpark.position.copy(currentPos);

    const bitSpacingSteps = Math.floor(signal.totalSteps / (signal.binaryPattern.length + 3));
    signal.bitMeshes.forEach((item) => {
        const stepIndex = currentStep - (item.offsetIndex * bitSpacingSteps);
        if (stepIndex >= 0 && stepIndex < currentStep) {
            item.mesh.visible = true;
            item.mesh.position.copy(signal.pathPoints[stepIndex]);
            if (stepIndex < signal.totalSteps - 1) item.mesh.lookAt(signal.pathPoints[stepIndex + 1]);
        } else {
            item.mesh.visible = false;
        }
    });

    return signal.progress >= 1.0 ? 'arrive' : null;
}

// GIỮ NGUYÊN nhịp tự quay của gốc (trước là ring.rotation.z/mesh.rotation.y riêng — chip không
// còn ring, dùng mesh.rotation.y của cả group).
function decayChipSpin(chip, deltaTime) {
    chip.group.rotation.y += deltaTime * 0.6;
}

// MỚI (yêu cầu Giang 17/09/2026 — "đổi màu phải render lại từ đầu, render không có tính liên
// tục"): TRƯỚC ĐÂY màu chip (body/pin/pointlight) bake 1 LẦN lúc buildCircuitNodes() (three-
// connector.js), style circuit KHÔNG hề đọc lại getComputedColor() cho bất kỳ mesh nào mỗi frame
// (khác hẳn style synapse — dù trước bản sửa này synapse cũng chỉ đọc lại 1 phần, xem
// applyNeuronExcitement(), synapse.js) — cách duy nhất thấy màu mới trước đây là rebuild toàn bộ
// qua initThreeJSConnector() (refresh hiện gắn cho nodeCount). Gọi hàm này mỗi frame/mỗi chip từ
// _tickConnectorCircuit() (visualizer-render.js) với màu MỚI tính lại — cùng tinh thần
// applyNeuronExcitement() bên style synapse. Cập nhật LUÔN `chip.color` (hex int, khớp kiểu dữ liệu
// gốc) để signal MỚI spawn (spawnCircuitSignal(), three-connector.js) dùng đúng màu hiện tại —
// signal ĐANG BAY giữ nguyên màu lúc spawn (không hồi tố, đúng hành vi tự nhiên của 1 "gói tin" đã
// gửi đi).
function applyChipLiveColor(chip, fillColor) {
    chip.bodyMesh.material.color.set(fillColor);
    chip.bodyMesh.material.emissive.set(fillColor);
    chip.pinMat.color.set(fillColor);
    chip.pLight.color.set(fillColor);
    chip.color = new THREE.Color(fillColor).getHex();
}
