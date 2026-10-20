/**
 * core/playlist/order.js — thuật toán THỨ TỰ (hàm thuần, nhận đủ qua tham số) cho 2 khái niệm (xem state.js):
 *   - `renderOrder` (UI): sort theo mode + lọc tìm kiếm (title/artist/album), cập nhật ngay mọi lúc.
 *   - `displayOrder` (hàng đợi phát): sort theo mode nhưng có "pending append" lúc đang phát.
 * Cùng 1 cách sắp (workflowPlaylistOrder.sortKeys() -> sortKeysByRank()) để 2 thứ tự nhất quán. Đọc state + thứ tự
 * gọi: event/workflow/playlist-order.js.
 * Chỉ `updateShuffleArrayFromQueue()` ghi state (`shuffleIndices`).
 */

/** Mảng key đã lọc bỏ bài lỗi (confirmedBrokenKeys) — nền chung cho cả render lẫn hàng đợi.
 * @param {string[]} playlistOrder - appState.get('playlistOrder') hiện tại
 * @param {Set<string>} confirmedBrokenKeys - appState.get('confirmedBrokenKeys') hiện tại
 * @returns {string[]}
 */
function liveKeys(playlistOrder, confirmedBrokenKeys) {
    return playlistOrder.filter(k => !confirmedBrokenKeys.has(k));
}

// ===================== Sắp xếp 2 trục =====================
// Trục (1) tên/ngày: xếp hạng bằng rankKeysByName()/rankKeysByAddedAt() (Workflow chọn theo displaySortMode). Trục (2)
// thống kê (tuỳ chọn): collectStatSortValues(). sortKeysByRank() gộp: có trục (2) thì nó là chính, bằng nhau thì theo
// hạng trục (1); sort ổn định nên bài bằng nhau ở cả 2 trục giữ thứ tự vào.

/** Hạng theo tên (`songNameIndex` — tên đã chuẩn hoá của Song/Video/Photo), so sánh tiếng Việt.
 * @param {string[]} keys @param {Map<string, string>} songNameIndex @param {boolean} descending - true = Z-A
 * @returns {Map<string, number>} key -> hạng */
function rankKeysByName(keys, songNameIndex, descending) {
    const sorted = keys.slice().sort((a, b) => {
        const cmp = (songNameIndex.get(a) || '').localeCompare(songNameIndex.get(b) || '', 'vi');
        return descending ? -cmp : cmp;
    });
    return new Map(sorted.map((key, rank) => [key, rank]));
}

/** Hạng theo ngày thêm (`addedAt` trong playlistCache, thiếu -> 0).
 * @param {string[]} keys @param {Map} playlistCache @param {boolean} newestFirst @returns {Map<string, number>} key -> hạng */
function rankKeysByAddedAt(keys, playlistCache, newestFirst) {
    const sorted = keys.slice().sort((a, b) => {
        const dateA = (playlistCache.get(a) || {}).addedAt || 0;
        const dateB = (playlistCache.get(b) || {}).addedAt || 0;
        return newestFirst ? dateB - dateA : dateA - dateB;
    });
    return new Map(sorted.map((key, rank) => [key, rank]));
}

/** Field thống kê của trục (2) -> nguồn + tên field. `stats` = mediaStatsMap (key `type:key`), `cache` = playlistCache
 * (cùng nguồn với Filter — core/playlist/filter.js). */
const SORT_STAT_FIELD_SPEC = {
    count: { from: 'stats', prop: 'count' },
    times: { from: 'stats', prop: 'totalTime' },
    size: { from: 'cache', prop: 'size' },
    duration: { from: 'cache', prop: 'duration' },
};

/**
 * Giá trị trục (2) của từng key (bài chưa có thống kê -> 0). `statField` 'none' -> null (chỉ trục 1 quyết định); giá trị
 * lạ khác 'none' -> 'duration'.
 * @param {string[]} keys @param {string} statField @param {Map} playlistCache @param {Map} mediaStatsMap
 * @param {'song'|'video'|'photo'} mediaType - `keys` luôn cùng 1 loại (Nguồn đang xem)
 * @returns {Map<string, number>|null}
 */
function collectStatSortValues(keys, statField, playlistCache, mediaStatsMap, mediaType) {
    if (statField === 'none') return null; // guard — không sắp theo thống kê
    const spec = SORT_STAT_FIELD_SPEC[statField] || SORT_STAT_FIELD_SPEC.duration;
    const sources = { stats: { map: mediaStatsMap, prefix: `${mediaType}:` }, cache: { map: playlistCache, prefix: '' } };
    const { map, prefix } = sources[spec.from];
    return new Map(keys.map((key) => [key, (map.get(prefix + key) || {})[spec.prop] || 0]));
}

/**
 * Mảng MỚI đã sắp: trục (2) (nếu có, theo `statDirection`) là chính, bằng nhau thì theo hạng trục (1).
 * @param {string[]} keys @param {Map<string, number>} nameRanks - rankKeysByName()/rankKeysByAddedAt()
 * @param {Map<string, number>|null} statValues - collectStatSortValues() @param {'desc'|'asc'} statDirection
 * @returns {string[]}
 */
function sortKeysByRank(keys, nameRanks, statValues, statDirection) {
    const desc = statDirection === 'desc';
    return keys.slice().sort((a, b) => {
        const va = statValues ? statValues.get(a) : 0;
        const vb = statValues ? statValues.get(b) : 0;
        const primary = desc ? vb - va : va - vb;
        return primary !== 0 ? primary : nameRanks.get(a) - nameRanks.get(b);
    });
}

/**
 * Tính lại `shuffleIndices` theo "hiện hành": `activeQueueKeys` (displayOrder lúc đó — có thể là 1 section vừa chọn-phát)
 * đứng đầu, phần còn lại của top-level nối sau (tổng độ dài = topLevelKeys). Shuffle bật thì trộn RIÊNG từng nhóm
 * (Fisher-Yates) — bài top-level không chen vào giữa lúc hiện hành còn bài chưa nghe; Next/Prev giới hạn trong đúng
 * nhóm đầu khi `sectionQueueActive`. Gọi với `activeQueueKeys = []` = trộn toàn bộ top-level.
 * @param {string[]} activeQueueKeys @param {string[]} topLevelKeys - playlistOrder hiện tại @param {boolean} shuffleEnabled
 */
function updateShuffleArrayFromQueue(activeQueueKeys, topLevelKeys, shuffleEnabled) {
    const activeSet = new Set(activeQueueKeys);
    const remaining = topLevelKeys.filter(k => !activeSet.has(k));
    appState.set('shuffleIndices', activeQueueKeys.concat(remaining));
    console.log(`writer: "updateShuffleArrayFromQueue", page: "shuffleIndices", content: "${activeQueueKeys.length} bài hiện hành lên đầu + ${remaining.length} bài top-level còn lại"`);

    if (shuffleEnabled) {
        appState.mutate('shuffleIndices', arr => {
            for (let i = activeQueueKeys.length - 1; i > 0; i--) { // nhóm hiện hành
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            for (let i = arr.length - 1; i > activeQueueKeys.length; i--) { // phần còn lại
                const j = activeQueueKeys.length + Math.floor(Math.random() * (i - activeQueueKeys.length + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        });
        console.log(`writer: "updateShuffleArrayFromQueue", page: "shuffleIndices", content: "đã trộn ngẫu nhiên riêng từng nhóm (hiện hành/còn lại)"`);
    }
}

// ===================== NEXT/PREV — bước 1 trong 1 hàng đợi =====================
// Shuffle và tuần tự cùng là "tiến 1 bước trong 1 danh sách, có xử lý chạm biên", chỉ khác nguồn danh sách
// (shuffleIndices hay displayOrder) — Workflow chọn trước khi gọi (workflowPlayerControls.goToNextTrack()/goToPrevTrack()).

/**
 * Chỉ số kế tiếp trong 1 danh sách theo 1 hướng — chỉ toán học chỉ số, quyết định tại biên ở decideBoundaryAction().
 * Không tìm thấy `currentKey` (index -1) tính là biên cho cả Next lẫn Prev; Prev: biên khi vị trí <= 0.
 * @param {string[]} list - shuffleIndices hoặc displayOrder @param {string|null} currentKey @param {1|-1} direction - 1 = Next, -1 = Prev
 * @returns {{index: number, atBoundary: boolean}} `index` chỉ có nghĩa khi `atBoundary===false`
 */
function computeListStep(list, currentKey, direction) {
    const currentPos = list.indexOf(currentKey);
    if (direction === 1) {
        const atBoundary = (currentPos === -1 || currentPos === list.length - 1);
        return { index: atBoundary ? -1 : currentPos + 1, atBoundary };
    }
    const atBoundary = (currentPos <= 0);
    return { index: atBoundary ? -1 : currentPos - 1, atBoundary };
}

/**
 * Hành động khi Next chạm cuối danh sách (chính sách lặp lại, tách khỏi toán học chỉ số). Chỉ Next — Prev luôn wrap
 * (workflowPlayerControls.goToPrevTrack() không gọi hàm này).
 * @param {number} repeatMode @param {boolean} force @returns {'wrapToStart'|'stopAtEnd'}
 */
function decideBoundaryAction(repeatMode, force) {
    return (repeatMode === 1 || force) ? 'wrapToStart' : 'stopAtEnd';
}

/**
 * Chỉ Next: lặp 1 bài (repeatMode 2) mà không force (bấm nút Next luôn force; chỉ auto-next lúc hết bài mới không) ->
 * phát lại đúng bài đang phát từ đầu. Prev không có nhánh này.
 * @param {number} repeatMode @param {boolean} force @returns {boolean}
 */
function shouldRestartInsteadOfAdvance(repeatMode, force) {
    return !force && repeatMode === 2;
}

/** Thêm bài mới vào hàng đợi phát (workflowPlaylistOrder.applyNewSongsToDisplayOrder()): không có bài mới -> 'resync'
 * (chỉ đồng bộ lại nếu lệch); chưa phát gì -> 'resort' (sắp lại toàn bộ ngay); đang phát -> 'append' (nối cuối + chờ
 * resort, không làm gãy thứ tự đang nghe).
 * @param {number} newKeyCount @param {boolean} hasCurrent @returns {'resync'|'resort'|'append'} */
function resolveNewSongsDisplayMode(newKeyCount, hasCurrent) {
    if (newKeyCount === 0) return 'resync';
    return hasCurrent ? 'append' : 'resort';
}

/** Nút to "Phát" (header Playlist) — gộp các điều kiện thành 1 việc cần làm: media đang phát nằm trong danh sách đang xem
 * -> 'visualizer' (về màn Visualizer, không phát lại); đang phát 1 section con -> 'resetTopLevel'; Nguồn rỗng -> 'none';
 * còn lại -> 'play' với `key` = bài đang phát nếu cùng loại media với Nguồn đang xem (key trùng giữa các Nguồn là có
 * thật), không thì bài đầu.
 * @param {{isPlayingListed: boolean, sectionActive: boolean, playingMediaType: string, activeMediaSource: string,
 *          currentKey: string|null, displayOrder: string[]}} p
 * @returns {{action: 'visualizer'|'resetTopLevel'|'play'|'none', key: string|undefined}} */
function resolvePlaylistEmptyPlayAction({ isPlayingListed, sectionActive, playingMediaType, activeMediaSource, currentKey, displayOrder }) {
    const resumableKey = playingMediaType === activeMediaSource ? currentKey : null;
    const action = isPlayingListed ? 'visualizer'
        : sectionActive ? 'resetTopLevel'
            : displayOrder.length > 0 ? 'play' : 'none';
    return { action, key: resumableKey || displayOrder[0] };
}

/** Bài phát tiếp sau khi đưa hàng đợi về top-level: bài đang phát nếu còn trong hàng đợi, không thì bài đầu.
 * @param {string|null} currentKey @param {string[]} displayOrder @returns {string|undefined} */
function resolveTopLevelResumeKey(currentKey, displayOrder) {
    return currentKey != null && displayOrder.includes(currentKey) ? currentKey : displayOrder[0];
}

/** Danh sách bỏ 1 key (giữ thứ tự). @param {string[]} list @param {string} key @returns {string[]} */
function removeKeyFromList(list, key) {
    return list.filter((k) => k !== key);
}

/** Key mới cần nối vào cuối hàng đợi phát: bỏ trùng trong `newKeys` và key đã có trong `displayOrder`.
 * @param {string[]} displayOrder @param {string[]} newKeys @returns {string[]} */
function pickKeysToAppend(displayOrder, newKeys) {
    const displaySet = new Set(displayOrder);
    return [...new Set(newKeys)].filter((k) => !displaySet.has(k));
}

/** 3 field tìm kiếm của 1 bài (chưa có cache -> chính key) + chuỗi gốc `source` để biết khi nào phải chuẩn hoá lại.
 * @param {string} key @param {object|undefined} cached @returns {{title: string, artist: string, album: string, source: string}} */
function resolveSearchFields(key, cached) {
    const title = cached ? cached.tag.title : key;
    const artist = cached ? cached.tag.artist : '';
    const album = cached ? cached.tag.album : '';
    return { title, artist, album, source: `${title}\n${artist}\n${album}` };
}

/** Nối 3 field đã chuẩn hoá bằng '\n' — query 1 dòng không khớp vắt qua 2 field. @param {string[]} normalizedFields @returns {string} */
function joinSearchText(normalizedFields) {
    return normalizedFields.join('\n');
}

/** Lọc key theo query đã chuẩn hoá: khớp nếu query nằm trong chuỗi tìm kiếm của bài.
 * @param {string[]} keys @param {string[]} searchTexts - cùng chỉ số với `keys` @param {string} query @returns {string[]} */
function filterKeysBySearchText(keys, searchTexts, query) {
    return keys.filter((key, i) => searchTexts[i].includes(query));
}
