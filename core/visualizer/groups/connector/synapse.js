/**
 * core/visualizer/groups/connector/synapse.js — bước 1 khung hình, style synapse. THUẦN, Workflow
 * (_tickConnectorSynapse(), event/workflow/visualizer-render.js) tự gom appState rồi gọi.
 */

function computeNeuronBinEnergy(vizDataArray, bufferLength, neuronIndex, neuronCount) {
    const segment = Math.max(1, Math.floor(bufferLength / neuronCount));
    const start = neuronIndex * segment;
    let sum = 0;
    for (let i = 0; i < segment; i++) sum += vizDataArray[start + i] || 0;
    return sum / segment;
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
// HSL của màu getComputedColor() đang active.
function applyNeuronExcitement(neuron, baseColorHex) {
    const excite = Math.min(1.0, neuron.energy);
    const hsl = {};
    new THREE.Color(baseColorHex).getHSL(hsl);
    neuron.nucleusMesh.material.emissiveIntensity = 0.95 + excite * 3.5;
    neuron.somaMesh.material.emissiveIntensity = 0.65 + excite * 2.8;
    neuron.somaMesh.material.color.setHSL((hsl.h + excite * 0.08) % 1, 1.0, Math.min(0.9, hsl.l + excite * 0.4));
    neuron.glowSprite.scale.setScalar(25 + excite * 20);
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
