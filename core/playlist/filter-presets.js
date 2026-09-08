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
 * applyPlaylistFilter() qua `appState.playlistFilterConfig` — KHÔNG đổi gì ở phía đọc) = CHỈ
 * `appState.playlistFilterActivePresetId` trỏ ĐÚNG 1 preset còn tồn tại (SỬA 09/09/2026, phản hồi
 * Giang — bỏ hẳn công tắc tổng riêng, "Chọn áp dụng"/preset đang active TỰ LÀ công tắc). Không có
 * preset active -> playlistFilterConfig suy ra rỗng (mọi field null), hành vi giống hệt "chưa có
 * Filter" — xem _recomputeLiveConfig() ở workflow.
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

/** MỚI (09/09/2026, phản hồi Giang mục 3a — "không có tối thiểu 1 trường được bật + trường bật rồi
 * mà không nhập dữ liệu -> không cho bấm Chọn áp dụng") — preset có ÍT NHẤT 1 field rule "hợp lệ"
 * hay không, cho 1 Nguồn cụ thể (bucket = `preset.config[source]`). Field hợp lệ = rule khác `null`
 * (đã bật) VÀ (field TEXT thì `value` khác rỗng sau trim — field số/ngày/giây LUÔN coi có dữ liệu
 * ngay khi bật, `value=0` vẫn là 1 giá trị THẬT chứ không phải "chưa nhập gì", khác text). Phân biệt
 * text/số KHÔNG cần gọi `_filterFieldKind()` (core/playlist/filter.js) — chỉ cần `typeof rule.value`
 * ('string' = field text, 'number' = field số/ngày/giây), đủ dùng cho việc validate này.
 * @param {object} bucket - `preset.config[source]` @returns {boolean} */
function hasValidPlaylistFilterField(bucket) {
    if (!bucket) return false;
    return Object.keys(bucket).some((field) => {
        const rule = bucket[field];
        if (!rule) return false;
        return typeof rule.value === 'string' ? rule.value.trim() !== '' : true;
    });
}

