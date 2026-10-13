/**
 * core/playlist/filter-presets.js — core thuần của "Playlist Filter Presets" (khuôn core/eq-presets.js).
 *
 * `playlistFilterPresets`/`playlistFilterActivePresetId`/`playlistFilterAppliedConfig`/`playlistFilterAppliesToFolder`
 * (service/state/playlist.js) là object keyed theo Nguồn `{song, video, photo}` — mỗi Nguồn danh sách + preset active riêng.
 * Preset = {id, name, config, appliesToFolder}; `config` = bucket rule của đúng Nguồn đó (shape
 * `clonePlaylistFilterConfigDefaults()[source]`). Filter có hiệu lực cho 1 Nguồn khi `playlistFilterActivePresetId[source]`
 * trỏ đúng 1 preset còn tồn tại — không có thì `playlistFilterConfig[source]` rỗng (computePlaylistFilterLiveConfig()).
 */

/** Preset trắng (mọi field rule = null, `appliesToFolder` mặc định BẬT — phản hồi Giang 09/09/2026)
 * cho ĐÚNG 1 Nguồn — dùng cho nút "+" ở màn danh sách.
 * @param {string} name @param {string} source - 'song'|'video'|'photo'
 * @returns {{id:string,name:string,config:object,appliesToFolder:boolean}} */
function buildBlankPlaylistFilterPreset(name, source) {
    return {
        id: 'pf-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        name,
        config: clonePlaylistFilterConfigDefaults()[source], // service/state/playlist.js — CHỈ lấy bucket của ĐÚNG Nguồn, không ôm cả 3 nữa
        appliesToFolder: true,
    };
}

/** @param {object[]} presets - danh sách preset của 1 Nguồn (`playlistFilterPresets[source]`)
 * @param {string|null} id @returns {object|null} */
function findPlaylistFilterPresetById(presets, id) {
    if (!id || !presets) return null;
    return presets.find((p) => p.id === id) || null;
}

/** Validate 1 mảng preset (của ĐÚNG 1 Nguồn) đọc lên lúc boot — mảng lạ/phần tử hỏng bị loại,
 * `config` luôn được merge lên trên default CỦA ĐÚNG Nguồn đó (bù field mới nếu dữ liệu cũ thiếu).
 * `appliesToFolder` — MỚI (09/09/2026) — thiếu/hỏng (dữ liệu cũ trước tính năng này) tự rơi về `true`
 * (mặc định BẬT, CHỐT Giang).
 * @param {*} raw @param {string} source - 'song'|'video'|'photo' @returns {object[]} */
function sanitizePlaylistFilterPresets(raw, source) {
    if (!Array.isArray(raw)) return [];
    const defaultBucket = clonePlaylistFilterConfigDefaults()[source];
    return raw
        .filter((p) => p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string')
        .map((p) => ({
            id: p.id,
            name: p.name,
            config: (p.config && typeof p.config === 'object')
                ? { ...defaultBucket, ...p.config }
                : { ...defaultBucket },
            appliesToFolder: typeof p.appliesToFolder === 'boolean' ? p.appliesToFolder : true,
        }));
}

/** Validate object active-preset-id `{song,video,photo}` đọc lúc boot — id không trỏ tới preset có thật trong
 * `presetsMap[source]` (preset đã xoá / dữ liệu hỏng) -> null.
 * @param {*} raw @param {{song:object[],video:object[],photo:object[]}} presetsMap
 * @returns {{song:string|null,video:string|null,photo:string|null}} */
function sanitizePlaylistFilterActiveIdMap(raw, presetsMap) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const pick = (mediaType) => {
        const id = source[mediaType];
        return typeof id === 'string' && (presetsMap[mediaType] || []).some((p) => p.id === id) ? id : null;
    };
    return { song: pick('song'), video: pick('video'), photo: pick('photo') };
}

/** Ảnh chốt đọc lúc boot (`meta.playlistFilterAppliedConfig`) gộp lên default (Nguồn thiếu giữ default).
 * @param {*} raw @param {object} defaults - clonePlaylistFilterConfigDefaults() @returns {object} */
function sanitizePlaylistFilterAppliedConfig(raw, defaults) {
    return { ...defaults, ...((raw && typeof raw === 'object') ? raw : {}) };
}

/** Cờ appliesToFolder theo Nguồn đọc lúc boot — thiếu/hỏng -> true (mặc định BẬT).
 * @param {*} raw @returns {{song:boolean,video:boolean,photo:boolean}} */
function sanitizePlaylistFilterAppliesToFolderMap(raw) {
    const src = (raw && typeof raw === 'object') ? raw : {};
    return {
        song: typeof src.song === 'boolean' ? src.song : true,
        video: typeof src.video === 'boolean' ? src.video : true,
        photo: typeof src.photo === 'boolean' ? src.photo : true,
    };
}

/** `playlistFilterConfig` sống cả 3 Nguồn: Nguồn có preset active hợp lệ -> default + ảnh chốt; không -> default (rỗng).
 * @param {object} presetsMap @param {object} activeIdMap @param {object} appliedMap @param {object} defaults -
 *        clonePlaylistFilterConfigDefaults() @returns {{config: object, summary: string}} */
function computePlaylistFilterLiveConfig(presetsMap, activeIdMap, appliedMap, defaults) {
    const config = { ...defaults };
    const summary = [];
    for (const source of ['song', 'video', 'photo']) {
        const hasValidActive = !!activeIdMap[source] && (presetsMap[source] || []).some((p) => p.id === activeIdMap[source]);
        config[source] = hasValidActive ? { ...defaults[source], ...appliedMap[source] } : defaults[source];
        summary.push(`${source}=${hasValidActive ? 'ảnh chốt' : 'rỗng'}`);
    }
    return { config, summary: summary.join(', ') };
}

/** Số thứ tự cho tên preset mới của 1 Nguồn ("New filter N"). @returns {number} */
function resolveNextPlaylistFilterPresetOrdinal(presetsMap, source) {
    return presetsMap[source].length + 1;
}

/** Map preset MỚI với `preset` thêm vào cuối danh sách của `source`. */
function appendPlaylistFilterPreset(presetsMap, source, preset) {
    return { ...presetsMap, [source]: [...presetsMap[source], preset] };
}

/** Map preset MỚI bỏ preset `id` khỏi danh sách của `source`. */
function removePlaylistFilterPreset(presetsMap, source, id) {
    return { ...presetsMap, [source]: presetsMap[source].filter((p) => p.id !== id) };
}

/** Bản sao sâu bucket rule — ảnh chốt lúc Chọn áp dụng (sửa field sau đó sửa object rule lồng trong preset). */
function clonePlaylistFilterBucket(bucket) {
    return JSON.parse(JSON.stringify(bucket));
}

/** MỚI (09/09/2026, phản hồi Giang mục 3a — "không có tối thiểu 1 trường được bật + trường bật rồi
 * mà không nhập dữ liệu -> không cho bấm Chọn áp dụng") — preset có ÍT NHẤT 1 field rule "hợp lệ"
 * hay không. Field hợp lệ = rule khác `null` (đã bật) VÀ (field TEXT thì `value` khác rỗng sau trim
 * — field số/ngày/giây LUÔN coi có dữ liệu ngay khi bật, `value=0` vẫn là 1 giá trị THẬT chứ không
 * phải "chưa nhập gì", khác text). Phân biệt text/số KHÔNG cần gọi `_filterFieldKind()`
 * (core/playlist/filter.js) — chỉ cần `typeof rule.value` ('string' = field text, 'number' = field
 * số/ngày/giây), đủ dùng cho việc validate này.
 * @param {object} bucket - `preset.config` (SỬA 09/09/2026 — TRƯỚC ĐÂY tham số này là
 *   `preset.config[source]`, giờ preset đã thuộc riêng 1 Nguồn nên `config` CHÍNH LÀ bucket, gọi
 *   THẲNG không cần index thêm) @returns {boolean} */
function hasValidPlaylistFilterField(bucket) {
    if (!bucket) return false;
    return Object.keys(bucket).some((field) => {
        const rule = bucket[field];
        if (!rule) return false;
        return typeof rule.value === 'string' ? rule.value.trim() !== '' : true;
    });
}
