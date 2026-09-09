/**
 * core/playlist/filter-presets.js — Core THUẦN (Rule 1-5) cho hệ "Playlist Filter Presets" — mirror
 * core/motion-presets.js/core/eq-presets.js.
 *
 * SỬA (09/09/2026, phản hồi Giang — "mỗi source media 1 list filter khác nhau + mỗi source có
 * filter active khác nhau", tham khảo mẫu `activePlayListFolder` — service/state/file-manager.js:
 * `{song: string|null, video: string|null, photo: string|null}`) — `playlistFilterPresets`/
 * `playlistFilterActivePresetId` (service/state/playlist.js) giờ là OBJECT keyed theo Nguồn
 * `{song, video, photo}` — MỖI Nguồn có danh sách preset RIÊNG + preset active RIÊNG, hoàn toàn độc
 * lập nhau (đổi/chọn/xoá preset ở Song không đụng gì tới Video/Photo).
 *
 * Preset = {id, name, config} — TRƯỚC ĐÂY (08/09/2026) `config` ôm CẢ 3 bucket {song,video,photo}
 * (vì 1 preset dùng chung cho mọi Nguồn) — GIỜ preset đã thuộc RIÊNG 1 danh sách theo Nguồn nên
 * `config` chỉ còn CHÍNH bucket rule của Nguồn đó (vd preset trong `playlistFilterPresets.song` thì
 * `config` = {name,album,artist,addedAt,count,totalTime,duration,size} — shape CHÍNH XÁC bằng
 * `clonePlaylistFilterConfigDefaults().song`, service/state/playlist.js).
 *
 * Điều kiện filter CÓ hiệu lực trên Playlist thật cho 1 Nguồn (đọc bởi core/playlist/filter.js::
 * applyPlaylistFilter() qua `appState.playlistFilterConfig[source]` — KHÔNG đổi gì ở phía đọc) =
 * CHỈ `appState.playlistFilterActivePresetId[source]` trỏ ĐÚNG 1 preset còn tồn tại TRONG
 * `playlistFilterPresets[source]` (preset ĐANG active TỰ LÀ công tắc, không cần field riêng). Không
 * có preset active cho Nguồn đó -> `playlistFilterConfig[source]` suy ra rỗng (mọi field null),
 * hành vi giống hệt "chưa có Filter" — xem `_recomputeLiveConfig()` ở workflow.
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

/** Validate CẢ object `{song,video,photo}` đọc lên lúc boot (`meta.playlistFilterPresets`) — gọi
 * `sanitizePlaylistFilterPresets()` cho từng Nguồn, Nguồn nào thiếu/hỏng tự rơi về mảng rỗng.
 * @param {*} raw @returns {{song:object[],video:object[],photo:object[]}} */
function sanitizePlaylistFilterPresetsMap(raw) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    return {
        song: sanitizePlaylistFilterPresets(source.song, 'song'),
        video: sanitizePlaylistFilterPresets(source.video, 'video'),
        photo: sanitizePlaylistFilterPresets(source.photo, 'photo'),
    };
}

/** Validate CẢ object `{song,video,photo}` active-preset-id đọc lên lúc boot
 * (`meta.playlistFilterActivePresetId`) — Nguồn nào ID không trỏ tới preset THẬT SỰ tồn tại trong
 * `presetsMap[source]` (preset đã bị xoá bằng cách nào đó, hoặc dữ liệu hỏng) tự rơi về `null`.
 * @param {*} raw @param {{song:object[],video:object[],photo:object[]}} presetsMap
 * @returns {{song:string|null,video:string|null,photo:string|null}} */
function sanitizePlaylistFilterActiveIdMap(raw, presetsMap) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const pick = (mediaType) => (typeof source[mediaType] === 'string' && findPlaylistFilterPresetById(presetsMap[mediaType], source[mediaType])) ? source[mediaType] : null;
    return { song: pick('song'), video: pick('video'), photo: pick('photo') };
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
