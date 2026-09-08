/**
 * core/playlist/filter-presets.js — Core THUẦN (Rule 1-5) cho hệ "Playlist Filter Presets" — mirror
 * core/motion-presets.js/core/eq-presets.js. MỚI (08/09/2026, phản hồi Giang — thay panel Lọc 1-bộ-
 * rule-sống bằng danh sách preset đặt tên, có thể sửa/xoá/chọn áp dụng).
 *
 * Preset = {id, name, config} — `config` CÙNG SHAPE với `clonePlaylistFilterConfigDefaults()`
 * (service/state/playlist.js, nguồn sự thật DUY NHẤT cho field nào hợp lệ theo Nguồn): { song: {...},
 * video: {...}, photo: {...} }. Danh sách preset SỐNG ở `appState.playlistFilterPresets` (nạp lúc
 * boot từ `meta.playlistFilterPresets`, xem event/workflow/playlist-filter-presets.js::loadOnBoot())
 * — rỗng là HỢP LỆ (KHÔNG seed preset mặc định nào, giống Motion, khác EQ).
 *
 * Điều kiện filter CÓ hiệu lực trên Playlist thật (đọc bởi core/playlist/filter.js::
 * applyPlaylistFilter() qua `appState.playlistFilterConfig` — KHÔNG đổi gì ở phía đọc) = 2 field
 * SONG SONG: `appState.playlistFilterEnabled === true` VÀ `appState.playlistFilterActivePresetId`
 * trỏ ĐÚNG 1 preset còn tồn tại. Thiếu 1 trong 2 -> playlistFilterConfig suy ra rỗng (mọi field
 * null), hành vi giống hệt "chưa có Filter" — xem _recomputeLiveConfig() ở workflow.
 */

/** Preset trắng (mọi field rule = null) — dùng cho nút "+" ở màn danh sách.
 * @param {string} name @returns {{id:string,name:string,config:object}} */
function buildBlankPlaylistFilterPreset(name) {
    return {
        id: 'pf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        name,
        config: clonePlaylistFilterConfigDefaults(), // service/state/playlist.js
    };
}

/** @param {object[]} presets @param {string|null} id @returns {object|null} */
function findPlaylistFilterPresetById(presets, id) {
    if (!id) return null;
    return presets.find((p) => p.id === id) || null;
}

/** Validate `meta.playlistFilterPresets` đọc lên lúc boot — mảng lạ/phần tử hỏng bị loại, `config`
 * luôn được merge lên trên default (bù field Nguồn mới nếu dữ liệu cũ thiếu, CÙNG cách
 * `loadPersistedFilterConfigOnBoot()` bản cũ đã làm cho `playlistFilterConfig` — xem docstring
 * event/workflow/playlist-filter-presets.js). @param {*} raw @returns {object[]} */
function sanitizePlaylistFilterPresets(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string')
        .map((p) => ({
            id: p.id,
            name: p.name,
            config: (p.config && typeof p.config === 'object')
                ? { ...clonePlaylistFilterConfigDefaults(), ...p.config }
                : clonePlaylistFilterConfigDefaults(),
        }));
}
