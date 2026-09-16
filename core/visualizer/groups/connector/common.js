/**
 * core/visualizer/groups/connector/common.js — helper dùng chung synapse/circuit, THUẦN. Riêng
 * biệt với applyNeuronExcitement() (synapse.js) — glowIntensity là sở thích chung người dùng,
 * excite là trạng thái bắn tức thời, không trộn 2 khái niệm.
 */

function applyConnectorGlowSettings(sprite, glowEnabled, glowIntensity) {
    sprite.visible = glowEnabled;
    if (glowEnabled) sprite.material.opacity = 0.85 * (glowIntensity / 100);
}

function applyChipGlowSettings(bodyMesh, glowEnabled, glowIntensity) {
    bodyMesh.material.emissiveIntensity = glowEnabled ? 0.8 * (glowIntensity / 100) : 0.15;
}
