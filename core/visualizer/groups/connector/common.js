/**
 * core/visualizer/groups/connector/common.js — helper vẽ dùng chung synapse/circuit. THUẦN
 * (không appState.get) — Workflow tự gom rồi truyền vào.
 */

function applyConnectorGlow(sprite, material, glowEnabled, glowIntensity, baseOpacity, baseScale) {
    sprite.visible = glowEnabled;
    if (!glowEnabled) { material.emissiveIntensity = 0.5; return; }
    const mult = glowIntensity / 100;
    sprite.material.opacity = baseOpacity * mult;
    sprite.scale.setScalar(baseScale * (0.6 + mult));
    material.emissiveIntensity = 0.5 + mult * 2.5;
}

function applyConnectorNeuronColor(neuron, fill, glow) {
    neuron.somaMesh.material.color.set(fill);
    neuron.somaMesh.material.emissive.set(fill);
    neuron.nucleusMesh.material.color.set(fill);
    neuron.nucleusMesh.material.emissive.set(fill);
    neuron.glowSprite.material.color.set(glow);
}

function applyConnectorChipColor(chip, fill) {
    chip.bodyMesh.material.color.set(fill);
    chip.bodyMesh.material.emissive.set(fill);
}
