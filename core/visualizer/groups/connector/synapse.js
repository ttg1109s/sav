/**
 * core/visualizer/groups/connector/synapse.js — bước 1 khung hình, style synapse. THUẦN, Workflow
 * (_tickConnectorSynapse(), event/workflow/visualizer-render.js) tự gom appState rồi gọi.
 */

// SỬA (phản hồi Giang — bắn quá thưa, không rõ theo nhạc): trung bình 34 bin/nơ-ron (1024 bin ÷
// 30) làm loãng hẳn đỉnh phổ — 1 tần số nổi bật giữa nhiều bin yên tĩnh vẫn bị kéo tụt xuống dưới
// ngưỡng. Đổi sang LẤY ĐỈNH (max) của dải — nhạy đúng với 1 nốt/nhạc cụ nổi lên trong dải đó.
function computeNeuronBinEnergy(vizDataArray, bufferLength, neuronIndex, neuronCount) {
    const segment = Math.max(1, Math.floor(bufferLength / neuronCount));
    const start = neuronIndex * segment;
    let peak = 0;
    for (let i = 0; i < segment; i++) peak = Math.max(peak, vizDataArray[start + i] || 0);
    return peak;
}

// GIỮ NGUYÊN công thức Hooke's Law + decay energy (1.7/s) của updatePhysicsAndSignals() gốc.
function stepNeuronSpring(neuron, stiffness, damping, deltaTime) {
    const displacement = neuron.position.clone().sub(neuron.restPosition);
    neuron.velocity.add(displacement.multiplyScalar(-stiffness));
    neuron.velocity.multiplyScalar(damping);
    neuron.position.add(neuron.velocity);
    neuron.container.position.copy(neuron.position);
    if (neuron.energy > 0) neuron.energy = Math.max(0, neuron.energy - deltaTime * 1.7);
}

// GIỮ NGUYÊN công thức "bioluminescent excitation" gốc — chỉ đổi base hue từ hardcode 0.52 sang
// HSL của màu getComputedColor() đang active. MỚI (16/09/2026): glow pulse theo neuron.scale —
// đồng bộ với nhân/dây đã scale theo màn hình (xem createAnatomicalNeuron(), core/webgl/three-connector.js).
function applyNeuronExcitement(neuron, baseColorHex) {
    const excite = Math.min(1.0, neuron.energy);
    const hsl = {};
    new THREE.Color(baseColorHex).getHSL(hsl);
    neuron.nucleusMesh.material.emissiveIntensity = 0.95 + excite * 3.5;
    neuron.somaMesh.material.emissiveIntensity = 0.65 + excite * 2.8;
    neuron.somaMesh.material.color.setHSL((hsl.h + excite * 0.08) % 1, 1.0, Math.min(0.9, hsl.l + excite * 0.4));
    neuron.glowSprite.scale.setScalar((25 + excite * 20) * neuron.scale);
}

// GIỮ NGUYÊN mechanic lan truyền + saltatory pulse gần Node of Ranvier của gốc.
function stepActionPotential(signal, synapse, speed, deltaTime) {
    signal.progress += (speed * deltaTime) / synapse.totalDistance;
    if (signal.progress >= 1) return true;
    const p = synapse.axonCurve.getPoint(Math.min(1, signal.progress));
    signal.mesh.position.copy(p);
    let nearNode = false;
    synapse.nodesOfRanvier.forEach((nodePos) => { if (p.distanceTo(nodePos) < 2.8) nearNode = true; });
    signal.mesh.scale.setScalar(nearNode ? 1.95 : 1.0);
    return false;
}
