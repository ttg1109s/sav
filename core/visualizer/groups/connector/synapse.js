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

function stepNeuronSpring(neuron, stiffness, damping) {
    const displacement = neuron.pos.clone().sub(neuron.basePos);
    neuron.vel.add(displacement.multiplyScalar(-stiffness));
    neuron.vel.multiplyScalar(damping);
    neuron.pos.add(neuron.vel);
    neuron.group.position.copy(neuron.pos);
    if (neuron.energy > 0) neuron.energy = Math.max(0, neuron.energy - 0.03);
}

function stepActionPotential(signal, synapse, speed, deltaTime) {
    signal.progress += (speed * deltaTime) / synapse.totalDistance;
    if (signal.progress >= 1) return true;
    const p = synapse.curve.getPoint(Math.min(1, signal.progress));
    signal.mesh.position.copy(p);
    return false;
}
