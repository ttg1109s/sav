/**
 * core/visualizer/groups/connector/common.js — helper THUẦN của group connector.
 * [06/10/2026] applyConnectorGlowSettings() (sprite glow neuron) XOÁ cùng style synapse.
 * [07/10/2026, Giang báo "Glow và Bloom xung đột, bloom = 0 thì glow cũng không tác dụng"] Glow KHÔNG còn chỉnh độ phát
 * sáng thân chip (chip màu sáng/trắng đã bão hoà sẵn dưới đèn nên kéo glow gần như không đổi gì) — Glow giờ là bloom
 * (Workflow). Thân chip phát sáng mức cố định + bừng theo `chip.energy` lúc bắn/nhận bit.
 */

const CIRCUIT_CHIP_BASE_EMISSIVE = 0.6;

/** Độ phát sáng thân chip: mức nền cố định + bừng theo năng lượng tức thời (decayNeuronState(), tonotopic.js). */
function applyChipEnergyGlow(chip) {
    chip.material.emissiveIntensity = CIRCUIT_CHIP_BASE_EMISSIVE + Math.min(2.2, chip.energy) * 1.2;
}
