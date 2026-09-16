/**
 * core/visualizer/groups/connector/circuit.js — bước 1 khung hình, style circuit. THUẦN,
 * Workflow (_tickConnectorCircuit(), event/workflow/visualizer-render.js) tự gom rồi gọi.
 */

function pickOnBitCount(beatScaleAtBeat) {
    return Math.round(Math.max(0, Math.min(1, beatScaleAtBeat)) * 7);
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
