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
