/**
 * core/statis-panel.js — phép tính thuần cho panel Statistics (event/workflow/statis-panel.js): tổng hợp số liệu, xếp hạng
 * Top list, hình học biểu đồ tròn Media types. Template: components/statis-panel.js; ghi DOM: core/statis-panel-ui.js.
 *
 * @typedef {{key:string, mediaType:'song'|'video'|'photo', name:string, count:number, totalTime:number}} StatisItem
 */

const STATIS_MEDIA_TYPES = ['song', 'video', 'photo'];

/** Record còn Blob (Video/Photo thiếu blob không tính — cùng guard buildAdaptedPlaylistCache()). @param {object[]} records */
function pickMediaRecordsWithBlob(records) {
    return records.filter((r) => r.blob);
}

/** Tổng hợp theo loại + toàn thư viện. `playedPercent` dùng floor (không bao giờ hiện 100% khi còn file chưa phát);
 * `*SharePercent` làm tròn (tổng có thể 99/101), `*ShareRaw` chưa làm tròn (cho biểu đồ tròn, tổng đúng 100).
 * @param {StatisItem[]} items @returns {{byType: object, grandTotal: object}} */
function computeStatisAggregates(items) {
    const byType = {};
    for (const mediaType of STATIS_MEDIA_TYPES) {
        const ofType = items.filter((i) => i.mediaType === mediaType);
        byType[mediaType] = {
            itemCount: ofType.length,
            playCount: ofType.reduce((sum, i) => sum + i.count, 0),
            totalTime: ofType.reduce((sum, i) => sum + i.totalTime, 0),
        };
    }
    const neverPlayedCount = items.filter((i) => i.count === 0).length;
    const playedItemCount = items.length - neverPlayedCount;
    const grandTotal = {
        itemCount: items.length,
        playCount: items.reduce((sum, i) => sum + i.count, 0),
        totalTime: items.reduce((sum, i) => sum + i.totalTime, 0),
        neverPlayedCount,
        playedItemCount,
        playedPercent: items.length > 0 ? Math.floor((playedItemCount / items.length) * 100) : 0,
    };
    for (const mediaType of STATIS_MEDIA_TYPES) {
        const totals = byType[mediaType];
        totals.playSharePercent = grandTotal.playCount > 0 ? Math.round((totals.playCount / grandTotal.playCount) * 100) : 0;
        totals.playShareRaw = grandTotal.playCount > 0 ? (totals.playCount / grandTotal.playCount) * 100 : 0;
        totals.timeSharePercent = grandTotal.totalTime > 0 ? Math.round((totals.totalTime / grandTotal.totalTime) * 100) : 0;
        totals.timeShareRaw = grandTotal.totalTime > 0 ? (totals.totalTime / grandTotal.totalTime) * 100 : 0;
    }
    return { byType, grandTotal };
}

/** Bảng xếp hạng Top list: lọc theo loại ('all' = mọi loại), chỉ item có dữ liệu ở tiêu chí đang sort, giảm dần; `limit`
 * null = không cắt (đang phân trang). @param {StatisItem[]} items @param {'all'|'song'|'video'|'photo'} filterType
 * @param {'count'|'totalTime'} sortMode @param {number|null} limit @returns {StatisItem[]} mảng MỚI */
function rankStatisItems(items, filterType, sortMode, limit) {
    const ranked = items
        .filter((i) => (filterType === 'all' || i.mediaType === filterType) && i[sortMode] > 0)
        .sort((a, b) => b[sortMode] - a[sortMode]);
    return limit == null ? ranked : ranked.slice(0, limit);
}

/** Hình học biểu đồ tròn đặc Media types: mỗi lát là 1 `<circle r=24 stroke-width=48 pathLength=100>` nên dasharray/offset
 * tính thẳng theo %; thứ tự Song -> Video -> Photo, có >1 lát thì chừa khe 0.6%; chữ % chỉ cho lát >= 7%.
 * @param {object} byType - computeStatisAggregates().byType @param {'count'|'totalTime'} shareMode
 * @returns {{slices: Array<{mediaType:string, dashArray:string, dashOffset:string}>, labels: Array<{x:string, y:string, text:string}>}} */
function computeStatisShareChart(byType, shareMode) {
    const shareRawKey = shareMode === 'totalTime' ? 'timeShareRaw' : 'playShareRaw';
    const parts = STATIS_MEDIA_TYPES.map((mediaType) => ({ mediaType, share: Number(byType[mediaType][shareRawKey]) || 0 })).filter((s) => s.share > 0);
    const gap = parts.length > 1 ? 0.6 : 0;
    const slices = [];
    const labels = [];
    let cursor = 0;
    for (const { mediaType, share } of parts) {
        const dash = Math.max(share - gap, 0.01);
        const offset = cursor + gap / 2;
        slices.push({ mediaType, dashArray: `${dash.toFixed(3)} ${(100 - dash).toFixed(3)}`, dashOffset: (-offset).toFixed(3) });
        if (share >= 7) {
            const angle = ((cursor + share / 2) / 100) * 2 * Math.PI - Math.PI / 2;
            labels.push({ x: (50 + 30 * Math.cos(angle)).toFixed(2), y: (50 + 30 * Math.sin(angle)).toFixed(2), text: `${Math.round(share)}%` });
        }
        cursor += share;
    }
    return { slices, labels };
}

/** Số nguyên hiển thị theo locale máy ("1,284") — dùng cho khung đếm-lên. @param {number} value @returns {string} */
function formatStatisCount(value) {
    return Number(value).toLocaleString();
}
