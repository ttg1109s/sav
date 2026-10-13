/**
 * core/playlist/filter.js — Playlist Filter: lọc `playlistOrder` theo điều kiện kiểu `SQL WHERE f1 = x AND f2 = y` — mỗi
 * field trong `playlistFilterConfig[source]` là đúng 1 điều kiện, field có rule (khác `null`) tham gia phép AND.
 *
 * Khác ô tìm kiếm (core/song-search.js — lọc `renderOrder`, chuẩn hoá dấu): Filter lọc `playlistOrder` ngay gốc, chỉ chạy
 * khi `playlistOrder` được tính mới (event/workflow/playlist-scope.js), so text không phân biệt hoa/thường nhưng CÓ phân
 * biệt dấu tiếng Việt.
 *
 * Mọi hàm chỉ nhận tham số; chỉ gọi `operation.evaluate()` (service/operation.js) + JS builtin.
 */

/** Loại 1 field Filter — quyết định control hiển thị (components/playlist-filter-drawer.js) + cách parse/hiển thị giá trị:
 * totalTime/duration là 'seconds' (nút mở time picker 'h-m-s'), count là 'number'.
 * @param {string} field @returns {'text'|'date'|'sizeMb'|'seconds'|'number'} */
function _filterFieldKind(field) {
    if (field === 'name' || field === 'album' || field === 'artist') return 'text';
    if (field === 'addedAt') return 'date';
    if (field === 'size') return 'sizeMb';
    if (field === 'totalTime' || field === 'duration') return 'seconds';
    return 'number'; // count
}

/** Số giây -> "H:MM:SS" (luôn có giờ, khớp time picker 'h-m-s') — chữ trên nút time picker. Viết riêng, không dùng
 * formatTime() (core/playlist/state.js, "M:SS") — core không gọi core khác. @param {number} totalSeconds @returns {string} */
function _formatSecondsAsHms(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Giá trị thô (chuỗi `<input>`, hoặc số giây từ time picker) -> số lưu trong rule: 'date' -> epoch ms 00:00 giờ local;
 * 'sizeMb' -> người dùng gõ MB, lưu byte; 'seconds'/'number' -> số thô.
 * @param {'date'|'sizeMb'|'seconds'|'number'} kind @param {string} rawValue @returns {number} */
function _parseFilterNumberInput(kind, rawValue) {
    if (kind === 'date') { const ms = rawValue ? new Date(`${rawValue}T00:00:00`).getTime() : 0; return ms || 0; }
    if (kind === 'sizeMb') { const mb = parseFloat(rawValue); return (isFinite(mb) ? mb : 0) * 1024 * 1024; }
    const n = parseFloat(rawValue);
    return isFinite(n) ? n : 0;
}

/** Ngược lại _parseFilterNumberInput(): giá trị trong rule -> chuỗi hiện lên `<input>` (không dùng cho 'seconds'). Ngày đọc
 * năm/tháng/ngày theo LOCAL (toISOString() in theo UTC sẽ lùi 1 ngày ở múi giờ dương).
 * @param {'text'|'date'|'sizeMb'|'number'} kind @param {number|undefined} value */
function _formatFilterNumberForInput(kind, value) {
    if (value == null) return '';
    if (kind === 'date') {
        if (!value) return '';
        const d = new Date(value);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (kind === 'sizeMb') return value ? +(value / (1024 * 1024)).toFixed(2) : 0;
    return value;
}

/**
 * Lọc `keys` theo TOÀN BỘ rule đang bật trong `rulesBucket` (AND hết). Không rule nào bật -> trả nguyên `keys` (fast path).
 * Mỗi rule so khớp: `mode:'range'` (chỉ số/ngày, >= value AND <= valueTo — như SQL BETWEEN), `mode:'outRange'` (NOT BETWEEN),
 * còn lại so đơn qua `rule.op` (text: ===/!==/contains/notContains, hạ chữ thường cả 2 phía — phân biệt dấu tiếng Việt;
 * số/ngày: ===/!==/>/</>=/<=). `addedAt` (có giờ:phút:giây) quy về 00:00 giờ LOCAL trước khi so (rule 'date' lưu đầu ngày —
 * xem _parseFilterNumberInput()) để mọi toán tử hiểu theo NGÀY.
 * @param {string[]} keys @param {Map} playlistCache @param {Map} mediaStatsMap - key `type:key`
 * @param {Object<string, ?Object>} rulesBucket - `playlistFilterConfig[mediaType]` @param {'song'|'video'|'photo'} mediaType
 * @returns {string[]}
 */
function applyPlaylistFilter(keys, playlistCache, mediaStatsMap, rulesBucket, mediaType) {
    const activeFields = Object.keys(rulesBucket).filter((field) => rulesBucket[field]);
    if (activeFields.length === 0) return keys.slice();

    return keys.filter((key) => {
        const cached = playlistCache.get(key);
        if (!cached) return false;
        const stats = mediaStatsMap.get(`${mediaType}:${key}`) || { count: 0, totalTime: 0 };

        for (const field of activeFields) {
            const rule = rulesBucket[field];
            const isText = field === 'name' || field === 'album' || field === 'artist';
            let fieldValue;
            if (field === 'name') fieldValue = cached.tag.title || '';
            else if (field === 'album') fieldValue = cached.tag.album || '';
            else if (field === 'artist') fieldValue = cached.tag.artist || '';
            else if (field === 'addedAt') fieldValue = cached.addedAt ? new Date(cached.addedAt).setHours(0, 0, 0, 0) : 0; // đầu ngày local
            else if (field === 'count') fieldValue = stats.count || 0;
            else if (field === 'totalTime') fieldValue = stats.totalTime || 0;
            else if (field === 'size') fieldValue = cached.size || 0;
            else if (field === 'duration') fieldValue = cached.duration || 0;
            else fieldValue = null; // field lạ (danh sách field đã cố định)

            let matched;
            if (!isText && rule.mode === 'range') matched = operation.evaluate(fieldValue, '>=', rule.value) && operation.evaluate(fieldValue, '<=', rule.valueTo);
            else if (!isText && rule.mode === 'outRange') matched = operation.evaluate(fieldValue, '<', rule.value) || operation.evaluate(fieldValue, '>', rule.valueTo);
            else if (isText) matched = operation.evaluate(String(fieldValue).toLowerCase(), rule.op, String(rule.value).toLowerCase());
            else matched = operation.evaluate(fieldValue, rule.op, rule.value);
            if (!matched) return false; // AND — 1 rule không khớp là loại ngay
        }
        return true;
    });
}

/** Giá trị ms trả về từ time picker -> số giây lưu trong rule (làm tròn). @param {number} ms @returns {number} */
function resolveFilterSecondsFromPickerMs(ms) {
    return Math.round(ms / 1000);
}

/** Số giây của rule -> ms để mở time picker (rule chưa có giá trị -> 0). @param {number|undefined} seconds @returns {number} */
function resolveFilterPickerMsFromSeconds(seconds) {
    return (seconds || 0) * 1000;
}
