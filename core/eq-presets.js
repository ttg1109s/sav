/**
 * core/eq-presets.js — Core THUẦN (Rule 1-5) cho hệ thống preset EQ lưu DB (THAY HẲN bảng
 * EQ_PRESETS tĩnh + chế độ 'manual' riêng cũ — core/equalizer.js/event/workflow/
 * equalizer-settings.js đã xoá).
 *
 * Preset = {id, name, gains: number[10], locked}. Danh sách preset SỐNG ở `appState.eqPresets`
 * (service/state/audio-engine.js), NẠP lúc boot từ `meta.eqPresets` (IndexedDB, cùng cơ chế
 * `meta.playerConfig`) — xem event/workflow/eq-presets.js::loadPresetsOnBoot(). Preset ĐANG CHỌN
 * là 1 field string đơn giản `appConfigViz.eqPresetId` (thay `eqMode` cũ), lưu bền qua saveConfig()
 * như mọi field vizConfig khác.
 *
 * Chỉ preset 'flat' (Default) khoá sửa/xoá (`locked:true`) — 5 preset gốc còn lại + preset người
 * dùng tự tạo đều sửa/xoá được (phản hồi Giang, mục b/d).
 */

/** 6 preset gốc — seed lần đầu vào `meta.eqPresets` nếu DB chưa có (xem loadPresetsOnBoot()).
 * @returns {{id: string, name: string, gains: number[], locked: boolean}[]} */
function buildDefaultEqPresets() {
    return [
        { id: 'flat', name: 'Default', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], locked: true },
        { id: 'bass_boost', name: 'Bass Boost', gains: [6, 5, 4, 1, 0, 0, 0, 0, 0, 0], locked: false },
        { id: 'pop', name: 'Pop', gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2], locked: false },
        { id: 'rock', name: 'Rock', gains: [5, 4, 3, 1, -1, -1, 1, 2, 3, 4], locked: false },
        { id: 'acoustic', name: 'Acoustic', gains: [2, 1, 0, 0, 1, 2, 3, 4, 3, 2], locked: false },
        { id: 'electronic', name: 'Electronic', gains: [5, 4, 1, -1, -2, 0, 1, 3, 4, 5], locked: false },
    ];
}

/** @param {object[]} presets @param {string} id @returns {object|null} */
function findEqPresetById(presets, id) {
    return presets.find((p) => p.id === id) || null;
}

/** Id preset kế tiếp trong danh sách (xoay vòng hết-quay-lại-đầu) — dùng cho nút cycle EQ ở
 * Control Center, CÙNG khuôn xoay MODES (đổi hiệu ứng Visualizer).
 * @param {object[]} presets @param {string} currentId @returns {string} */
function resolveNextEqPresetId(presets, currentId) {
    if (!presets || presets.length === 0) return currentId;
    const idx = presets.findIndex((p) => p.id === currentId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % presets.length;
    return presets[nextIdx].id;
}

/** Id RIÊNG cho preset người dùng tự tạo — không đụng 6 id cố định (flat/bass_boost/...).
 * @returns {string} */
function generateEqPresetId() {
    return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Áp gains vào audio graph thật — THAY applyEQPreset(mode) cũ (tra bảng cố định EQ_PRESETS),
 * nhận thẳng mảng gains (từ preset DB-backed) + mảng node qua tham số (Rule 2 — không tự đọc
 * appState.get('eqBandNodes') như bản cũ).
 * @param {GainNode[]} eqBandNodes @param {number[]} gains */
function applyEqGains(eqBandNodes, gains) {
    if (!eqBandNodes || eqBandNodes.length === 0) return;
    for (let i = 0; i < eqBandNodes.length; i++) {
        if (eqBandNodes[i]) eqBandNodes[i].gain.value = (gains && gains[i]) || 0;
    }
}

/** Đồng bộ tên preset ĐANG CHỌN lên nhãn nút EQ Control Center (#eq-badge-label) — gọi mỗi khi đổi
 * preset (cycle/lưu preset đang active/xoá preset đang active).
 * @param {string} name */
function syncEqBadgeLabel(name) {
    if (typeof eqBadgeLabel !== 'undefined' && eqBadgeLabel) eqBadgeLabel.textContent = name;
}
