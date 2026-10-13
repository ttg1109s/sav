/**
 * core/listen-stats.js — Thống kê NGHE/XEM riêng từng media: mỗi media có `stats = { count, totalTime }`
 *   - count     : số lần bắt đầu phát/xem.
 *   - totalTime : tổng số giây đã thực sự phát/xem (đồng hồ thực, xem workflowListenStats._tick()).
 *
 * VIẾT LẠI (06/10/2026, plan-media-db-split.md mục 6, Giang duyệt — Lượt 3):
 *   - LƯU Ở ĐÂU: `stats` nằm trong META của chính media (store `songs`/`videos`/`images` — đã tách khỏi Blob), KHÔNG còn
 *     key gộp `meta.songStats` (key gộp đó dùng chung cho cả 3 loại nên "Bài A.mp3" và "Bài A.mp4" bị cộng chung lượt).
 *     Ghi meta không đụng Blob nên ghi thường xuyên vẫn nhẹ.
 *   - RAM: `mediaStatsMap` (state) key dạng `type:key` (vd "song:bai-a") — chỗ DUY NHẤT trộn 3 loại vào 1 Map.
 *   - Toàn bộ phần đọc state/DB/hẹn giờ ghi (loadSongStats/getSongStats/bumpSongPlayCount/addSongListenTime/
 *     removeSongStats/clearAllSongStats/scheduleSongStatsSave/flushSongStats) + đồng hồ nghe (startListenClock/
 *     stopListenClock/_listenTick, trước ở core/player-controls.js) DỜI sang Workflow `workflowListenStats`
 *     (event/workflow/listen-stats.js) — bản cũ là core tự appState.get + đọc DB (vi phạm Rule 2/3b).
 *   - File này chỉ còn hàm THUẦN.
 */

/** Key RAM của 1 media trong `mediaStatsMap`. @param {'song'|'video'|'photo'} type @param {string} key @returns {string} */
function mediaStatsKey(type, key) {
    return `${type}:${key}`;
}

/** Tách ngược key RAM `type:key` (key media là slug, không chứa ':'). @param {string} statsKey
 * @returns {{type: 'song'|'video'|'photo', key: string}} */
function parseMediaStatsKey(statsKey) {
    const colonAt = statsKey.indexOf(':');
    return { type: statsKey.slice(0, colonAt), key: statsKey.slice(colonAt + 1) };
}

/** Dựng `mediaStatsMap` từ meta của cả 3 loại (getAllMediaMeta()) — media chưa có `stats` thì bỏ qua (coi như 0).
 * @param {{song: Array<object>, video: Array<object>, photo: Array<object>}} metasByType - mỗi meta đã gộp `key`
 * @returns {Map<string, {count: number, totalTime: number}>} */
function buildMediaStatsMap(metasByType) {
    const map = new Map();
    Object.keys(metasByType).forEach((type) => {
        metasByType[type]
            .filter((meta) => meta.stats)
            .forEach((meta) => map.set(`${type}:${meta.key}`, { count: meta.stats.count || 0, totalTime: meta.stats.totalTime || 0 }));
    });
    return map;
}

/** Định dạng thời gian nghe thân thiện: "1 giờ 5 phút", "12 phút 30 giây", "45 giây". */
function formatListenTime(totalSeconds) {
    const s = Math.floor(totalSeconds || 0);
    if (s <= 0) return t('common.listenTime.zero');
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    if (h > 0) return tFormat('common.listenTime.hourMinute', { h, m });
    if (m > 0) return tFormat('common.listenTime.minuteSecond', { m, s: sec });
    return tFormat('common.listenTime.secondOnly', { s: sec });
}

/** Các bản ghi cần ghi xuống meta lúc flush: chỉ key bẩn còn trong `statsMap`, chốt {count, totalTime} ngay lúc gọi.
 * @param {Set<string>} dirtyKeys @param {Map<string, {count:number, totalTime:number}>} statsMap
 * @returns {Array<{type: string, key: string, stats: {count:number, totalTime:number}}>} */
function buildMediaStatsFlushEntries(dirtyKeys, statsMap) {
    return [...dirtyKeys]
        .filter((statsKey) => statsMap.has(statsKey))
        .map((statsKey) => {
            const colonAt = statsKey.indexOf(':');
            const source = statsMap.get(statsKey);
            return { type: statsKey.slice(0, colonAt), key: statsKey.slice(colonAt + 1), stats: { count: source.count, totalTime: source.totalTime } };
        });
}

/** 1 nhịp đồng hồ nghe: delta giây kể từ nhịp trước (kẹp 4s — tab bị treo/throttle nền rồi thức không cộng vọt), cộng vào
 * phần chờ ghi; đủ 5s thì `shouldFlush` (ghi `pendingSeconds` vào totalListenSeconds rồi về 0).
 * @param {number} nowMs @param {number} lastTickMs @param {number} pendingSeconds
 * @returns {{isCounted: boolean, delta: number, pendingSeconds: number, shouldFlush: boolean}} `isCounted` false (delta <= 0 /
 *          NaN) -> bỏ nhịp này */
function computeListenTick(nowMs, lastTickMs, pendingSeconds) {
    const raw = (nowMs - lastTickMs) / 1000;
    const delta = raw > 4 ? 4 : raw;
    const total = pendingSeconds + delta;
    return { isCounted: raw > 0, delta, pendingSeconds: total, shouldFlush: total >= 5 };
}

/** Tổng thời gian nghe mới sau khi cộng phần vừa ghi. @param {number|undefined} stored @param {number} addSeconds @returns {number} */
function addTotalListenSeconds(stored, addSeconds) {
    return (stored || 0) + addSeconds;
}
