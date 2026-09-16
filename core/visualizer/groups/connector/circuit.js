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

function stepCircuitSignal(signal, edge, speed, deltaTime, trailLength) {
    const totalSteps = edge.points.length;
    const avgStepDistance = edge.totalDistance / Math.max(1, totalSteps - 1);
    const stepsPerSec = speed / Math.max(0.01, avgStepDistance);
    signal.currentStep += stepsPerSec * deltaTime;
    if (signal.currentStep >= totalSteps - 1) return true;
    const drawCount = Math.min(Math.floor(signal.currentStep), trailLength);
    const drawStart = Math.max(0, Math.floor(signal.currentStep) - trailLength);
    edge.geometry.setDrawRange(drawStart, drawCount);
    return false;
}

function stepCircuitBits(signal, edge, trailLength) {
    if (!signal.bitMeshes) return;
    const spacing = Math.max(1, Math.floor(trailLength / 8));
    signal.bitMeshes.forEach((bm) => {
        const stepIdx = Math.floor(signal.currentStep) - bm.slot * spacing;
        if (stepIdx >= 0 && stepIdx < edge.points.length) {
            bm.sprite.visible = true;
            bm.sprite.position.copy(edge.points[stepIdx]);
        } else {
            bm.sprite.visible = false;
        }
    });
}

function decayChipPulse(chip, deltaTime) {
    if (chip.bodyMesh.scale.x > 1) {
        const next = Math.max(1, chip.bodyMesh.scale.x - deltaTime * 2);
        chip.bodyMesh.scale.setScalar(next);
    }
}
