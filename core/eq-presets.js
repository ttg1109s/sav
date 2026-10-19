/**
 * core/eq-presets.js — Core THUẦN (Rule 1-5) cho hệ thống preset EQ lưu DB.
 *
 * Preset = {id, name, gains: number[10], locked}. Danh sách preset SỐNG ở `appState.eqPresets`
 * (service/state/audio-engine.js), NẠP lúc boot từ `meta.eqPresets` (IndexedDB) — xem
 * event/workflow/eq-presets.js::loadPresetsOnBoot(). Preset ĐANG CHỌN là field `appConfigViz.eqPresetId`, lưu bền qua
 * workflowConfig.save() như mọi field vizConfig khác.
 *
 * Chỉ preset 'flat' (Default) khoá sửa/xoá (`locked:true`) — 5 preset gốc còn lại + preset người dùng tự tạo đều
 * sửa/xoá được.
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

/** Danh sách MỚI với gains của preset `id` thay bằng bản copy của `gains` (bản nháp còn bị slider sửa tại chỗ).
 * @param {object[]} presets @param {string} id @param {number[]} gains @returns {object[]} */
function replaceEqPresetGains(presets, id, gains) {
    return presets.map((p) => (p.id === id ? { ...p, gains: gains.slice() } : p));
}

/** Rời ô Tên của Edit: tên đã trim; rỗng -> `isBlank` (giữ tên cũ `current.name`). `presets` = danh sách MỚI đã đổi tên
 * (chỉ dùng khi không rỗng). @param {object[]} presets @param {object} current - preset đang sửa @param {string} draftName
 * @returns {{isBlank: boolean, name: string, presets: object[]}} */
function resolveEqPresetRename(presets, current, draftName) {
    const name = draftName.trim();
    return { isBlank: !name, name: name || current.name, presets: presets.map((p) => (p.id === current.id ? { ...p, name } : p)) };
}

/** Thêm 1 preset mới (gains phẳng, không khoá) tên tự sinh không trùng — `baseName`, `baseName 2`, `baseName 3`...
 * @param {object[]} presets @param {string} baseName @param {string} id - generateEqPresetId()
 * @returns {{preset: object, presets: object[]}} `presets` = danh sách MỚI */
function buildEqPresetListWithNew(presets, baseName, id) {
    const existingNames = new Set(presets.map((p) => p.name));
    let name = baseName;
    let n = 2;
    while (existingNames.has(name)) { name = `${baseName} ${n}`; n++; }
    const preset = { id, name, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], locked: false };
    return { preset, presets: [...presets, preset] };
}

/** Vị trí preset `id` trong danh sách (-1 nếu không có). @param {object[]} presets @param {string} id @returns {number} */
function findEqPresetIndexById(presets, id) {
    return presets.findIndex((p) => p.id === id);
}

/** Danh sách MỚI bỏ preset `id`. @param {object[]} presets @param {string} id @returns {object[]} */
function removeEqPresetById(presets, id) {
    return presets.filter((p) => p.id !== id);
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

/** Áp gains vào audio graph thật — nhận mảng gains (của preset) + mảng node qua tham số (Rule 2).
 * @param {GainNode[]} eqBandNodes @param {number[]} gains */
function applyEqGains(eqBandNodes, gains) {
    if (!eqBandNodes || eqBandNodes.length === 0) return;
    for (let i = 0; i < eqBandNodes.length; i++) {
        if (eqBandNodes[i]) eqBandNodes[i].gain.value = (gains && gains[i]) || 0;
    }
}

/** Đọc giá trị thô của 1 slider kênh Edit EQ (`data-index` + `value`, Listener gửi nguyên chuỗi) thành số kênh/số dB +
 * chữ hiển thị cạnh slider ('+7' / '0' / '-5').
 * @param {string} rawIndex @param {string} rawValue
 * @returns {{isValid: boolean, index: number, value: number, text: string}} — `isValid` false khi `data-index` hỏng */
function resolveEqBandSliderInput(rawIndex, rawValue) {
    const index = parseInt(rawIndex, 10);
    const value = parseInt(rawValue, 10);
    return { isValid: !isNaN(index), index, value, text: value > 0 ? `+${value}` : `${value}` };
}

/** Đồng bộ tên preset ĐANG CHỌN lên nhãn nút EQ Control Center (#eq-badge-label) — gọi mỗi khi đổi
 * preset (cycle/lưu preset đang active/xoá preset đang active).
 * @param {string} name */
function syncEqBadgeLabel(name) {
    if (typeof eqBadgeLabel !== 'undefined' && eqBadgeLabel) eqBadgeLabel.textContent = name;
}
