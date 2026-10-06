/**
 * core/visualizer/groups/connector/common.js — helper THUẦN của group connector. glowIntensity là sở thích chung người
 * dùng; `chip.energy` là trạng thái bắn/nhận tức thời (decayNeuronState(), tonotopic.js).
 * [06/10/2026] applyConnectorGlowSettings() (sprite glow neuron) XOÁ cùng style synapse.
 */

/** SỬA (06/10/2026) — nhận cả chip: phát sáng nền theo Glow + bừng sáng theo `energy` (thay cú phình thân bằng gsap — thân
 * và chân giờ là 1 khối liền, đứng yên). */
function applyChipGlowSettings(chip, glowEnabled, glowIntensity) {
    const base = glowEnabled ? 0.8 * (glowIntensity / 100) : 0.15;
    chip.material.emissiveIntensity = base + Math.min(2.2, chip.energy) * 1.2;
}
