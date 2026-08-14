/**
 * core/playlist/filter.js — Playlist Filter (mục 1d, phản hồi Giang) — LỌC playlistOrder theo
 * điều kiện, mô phỏng cơ chế `SQL WHERE field1 = x AND field2 = y ...`: mỗi field trong
 * `playlistFilterConfig.<source>` là ĐÚNG 1 điều kiện (không phải danh sách điều kiện lặp lại
 * trên cùng 1 field) — field nào có rule (khác `null`) thì tham gia phép AND; tất cả rule đang
 * bật đều PHẢI khớp thì bản ghi mới lọt qua (`Array.every()` — đúng bản chất AND của WHERE).
 *
 * KHÁC BIỆT VỚI Ô TÌM KIẾM (`songMatchesQuery()`, core/song-search.js): Search lọc `renderOrder`
 * (chỉ UI, đổi ngay theo từng ký tự gõ), CHUẨN HOÁ dấu tiếng Việt (`normalizeSongName()`). Filter
 * lọc `playlistOrder` NGAY GỐC — chỉ chạy lại ở ĐÚNG 4 nơi `playlistOrder` được TÍNH MỚI (đổi
 * Nguồn/áp Scope folder/boot — xem `applyPlaylistFilter()` gọi từ `event/workflow/playlist.js::
 * switchToSongSource()`/`switchToVideoSource()` + `event/workflow/playlist-scope.js::
 * applyFolderScope()`/`applyAllSongsScope()`). 2 cơ chế KHÔNG đụng nhau, không tái dùng logic của
 * nhau — Filter so khớp text KHÔNG phân biệt hoa/thường (`.toLowerCase()` JS builtin, viết NGAY
 * TRONG file này) nhưng CÓ phân biệt dấu tiếng Việt (KHÔNG gọi `normalizeSongName()`,
 * core/song-search.js — đó là 1 core KHÁC của project, Rule 3 cấm tuyệt đối Core gọi Core khác,
 * kể cả để tái dùng logic chuẩn hoá — xem core-function-conventions.md Rule 3).
 *
 * Rule 2 — mọi hàm CHỈ nhận tham số, KHÔNG tự `appState.get()`. Rule 3 — không gọi core nào khác
 * của project — CHỈ gọi `operation.evaluate()` (service/operation.js, thuộc `service/`, được
 * phép theo Rule 3 "CHỈ được gọi API service/") + JS builtin thuần (`.toLowerCase()`).
 *
 * NẠP SAU: service/operation.js (operation.evaluate).
 */

/** 2 field text theo từng Nguồn — song có 3, video chỉ 1 (không có album/artist). */
const PLAYLIST_FILTER_TEXT_FIELDS = { song: ['name', 'album', 'artist'], video: ['name'] };
/** 5 field số/ngày — DÙNG CHUNG cho cả 2 Nguồn (addedAt=ngày tải, count/totalTime=thống kê nghe,
 * size=dung lượng byte, duration=thời lượng bài/video giây). */
const PLAYLIST_FILTER_NUMERIC_FIELDS = ['addedAt', 'count', 'totalTime', 'size', 'duration'];

/**
 * Phân loại 1 field Filter — quyết định input nào hiển thị (text/date/number) + cách parse giá
 * trị gõ vào (`_parseFilterNumberInput()`) — dùng ở `event/workflow/playlist.js`
 * (`setFilterField()`/`_syncFilterPanelUI()`, đọc/ghi rule theo đúng đơn vị/kiểu). Đặt Ở ĐÂY
 * (cùng nhà 2 danh sách field trên) để chỉ có ĐÚNG 1 nơi định nghĩa "field nào thuộc loại gì".
 * @param {string} field
 * @returns {'text'|'date'|'sizeMb'|'number'}
 */
function _filterFieldKind(field) {
    if (field === 'name' || field === 'album' || field === 'artist') return 'text';
    if (field === 'addedAt') return 'date';
    if (field === 'size') return 'sizeMb';
    return 'number'; // count, totalTime
}

/**
 * Parse 1 giá trị input THÔ (chuỗi từ `<input>`) thành số LƯU TRONG STATE theo đúng đơn vị nội
 * bộ — 'date' -> epoch ms (đầu ngày, giờ local); 'sizeMb' -> NGƯỜI DÙNG gõ MB, LƯU byte (nhân
 * 1024*1024, khớp `cached.size` ở core/playlist/loader.js); 'number' -> số thô (giây/lượt).
 * @param {'date'|'sizeMb'|'number'} kind @param {string} rawValue
 * @returns {number}
 */
function _parseFilterNumberInput(kind, rawValue) {
    if (kind === 'date') { const ms = rawValue ? new Date(`${rawValue}T00:00:00`).getTime() : 0; return ms || 0; }
    if (kind === 'sizeMb') { const mb = parseFloat(rawValue); return (isFinite(mb) ? mb : 0) * 1024 * 1024; }
    const n = parseFloat(rawValue);
    return isFinite(n) ? n : 0;
}

/**
 * Chiều NGƯỢC LẠI `_parseFilterNumberInput()` — đổi giá trị LƯU TRONG STATE thành chuỗi hiển thị
 * lại đúng lên `<input>` lúc mở panel (`workflowPlaylist._syncFilterPanelUI()`).
 * @param {'text'|'date'|'sizeMb'|'number'} kind @param {number|undefined} value
 */
function _formatFilterNumberForInput(kind, value) {
    if (value == null) return '';
    if (kind === 'date') return value ? new Date(value).toISOString().slice(0, 10) : '';
    if (kind === 'sizeMb') return value ? +(value / (1024 * 1024)).toFixed(2) : 0;
    return value;
}

/**
 * So khớp 1 field bất kỳ (text HOẶC số/ngày) với đúng 1 rule — DÙNG CHUNG cho cả 2 loại, vì cả 2
 * cùng chung 1 hình dạng so sánh: `mode:'range'` (CHỈ numeric/date, 2 điều kiện >=/<= ANDed lại,
 * đúng cơ chế SQL `BETWEEN`) hoặc so sánh đơn qua `rule.op` (text dùng ===/!==/contains/
 * notContains; numeric/date dùng ===/!==/>/</>=/<=). Text hoá thường CẢ 2 phía (`isText`) trước
 * khi so — case-insensitive nhưng CÓ phân biệt dấu tiếng Việt (xem docstring đầu file, lý do Rule
 * 3 không cho gọi `normalizeSongName()`).
 * @param {string|number} fieldValue @param {Object} rule @param {boolean} isText
 */
function _evaluateFilterRule(fieldValue, rule, isText) {
    if (!isText && rule.mode === 'range') return operation.evaluate(fieldValue, '>=', rule.value) && operation.evaluate(fieldValue, '<=', rule.valueTo);
    if (isText) return operation.evaluate(String(fieldValue).toLowerCase(), rule.op, String(rule.value).toLowerCase());
    return operation.evaluate(fieldValue, rule.op, rule.value);
}

/**
 * Rule 1: đơn tuyến — lọc `keys` theo TOÀN BỘ rule đang bật trong `rulesBucket` (AND hết, xem
 * docstring đầu file). `rulesBucket` rỗng (mọi field `null`) -> trả nguyên `keys` (fast path,
 * KHÔNG tốn 1 vòng lặp nào khi Giang chưa bật filter nào).
 * Rule 2: nhận `playlistCache`/`songStatsMap`/`rulesBucket` qua tham số.
 * @param {string[]} keys
 * @param {Map} playlistCache
 * @param {Map} songStatsMap
 * @param {Object<string, ?Object>} rulesBucket - `playlistFilterConfig.song` hoặc `.video`
 * @returns {string[]}
 */
function applyPlaylistFilter(keys, playlistCache, songStatsMap, rulesBucket) {
    const activeFields = Object.keys(rulesBucket).filter((field) => rulesBucket[field]);
    if (activeFields.length === 0) return keys.slice();

    return keys.filter((key) => {
        const cached = playlistCache.get(key);
        if (!cached) return false;
        const stats = songStatsMap.get(key) || { count: 0, totalTime: 0 };

        for (const field of activeFields) {
            const rule = rulesBucket[field];
            const isText = field === 'name' || field === 'album' || field === 'artist';
            let fieldValue;
            if (field === 'name') fieldValue = cached.tag.title || '';
            else if (field === 'album') fieldValue = cached.tag.album || '';
            else if (field === 'artist') fieldValue = cached.tag.artist || '';
            else if (field === 'addedAt') fieldValue = cached.addedAt || 0;
            else if (field === 'count') fieldValue = stats.count || 0;
            else if (field === 'totalTime') fieldValue = stats.totalTime || 0;
            else if (field === 'size') fieldValue = cached.size || 0;
            else if (field === 'duration') fieldValue = cached.duration || 0;
            else fieldValue = null; // guard — field lạ (không nên xảy ra, danh sách field đã cố định)
            if (!_evaluateFilterRule(fieldValue, rule, isText)) return false; // AND — 1 rule không khớp là loại ngay
        }
        return true;
    });
}
