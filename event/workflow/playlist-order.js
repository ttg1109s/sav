/**
 * event/workflow/playlist-order.js — `workflowPlaylistOrder`: tính lại thứ tự Playlist (renderOrder / displayOrder /
 * shuffleIndices), đổi kiểu sắp xếp, ô tìm kiếm. Chỉ đọc state + điều phối; thuật toán thứ tự ở core/playlist/order.js.
 *
 * NẠP SAU: core/playlist/order.js, core/song-search.js (normalizeSongName), core/playlist/main.js (ô tìm kiếm),
 * service/state.js. Lúc chạy: event/workflow/playlist-render.js.
 */
/** Gõ Search: lọc lại sau khi NGỪNG gõ 150ms (gõ Telex 1 chữ có dấu là 2-3 sự kiện input). Task tên cố định ->
 * taskManager.once() tự huỷ lần hẹn trước. */
const PLAYLIST_SEARCH_DEBOUNCE_MS = 150;
const PLAYLIST_SEARCH_APPLY_TASK = 'playlistSearchApply';

/** applyNewSongsToDisplayOrder(): 3 kịch bản theo resolveNewSongsDisplayMode() (core/playlist/order.js). */
const NEW_SONGS_DISPLAY_BY_MODE = {
    resync: () => workflowPlaylistOrder._resyncDisplayOrderIfStale(),
    resort: () => workflowPlaylistOrder.recomputeDisplayOrder(),
    append: (newKeys) => workflowPlaylistOrder._appendNewKeysAsPending(newKeys),
};

/** Trục (1) sắp xếp theo displaySortMode; giá trị lạ (vd 'default' của state cũ) -> az. */
const NAME_RANK_BY_SORT_MODE = {
    az: (keys, s) => rankKeysByName(keys, s.songNameIndex, false), // core/playlist/order.js
    za: (keys, s) => rankKeysByName(keys, s.songNameIndex, true),
    newest: (keys, s) => rankKeysByAddedAt(keys, s.playlistCache, true),
    oldest: (keys, s) => rankKeysByAddedAt(keys, s.playlistCache, false),
};

/** Key appState mà sortKeys() cần — nơi gọi gộp vào lần get([…]) của mình. */
const PLAYLIST_SORT_STATE_KEYS = ['displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap', 'activeMediaSource'];

/** Lọc Search: không có query -> giữ nguyên (khỏi tính chuỗi tìm kiếm); có -> lọc theo chuỗi đã chuẩn hoá của từng bài. */
const SEARCH_FILTER_BY_HAS_QUERY = {
    false: (keys) => keys,
    true: (keys, query, playlistCache) => {
        const memo = workflowPlaylistOrder._searchTextMemo();
        const searchTexts = keys.map((key) => workflowPlaylistOrder._searchTextOf(key, playlistCache.get(key), memo));
        return filterKeysBySearchText(keys, searchTexts, query); // core/playlist/order.js
    },
};

const workflowPlaylistOrder = {

    /** Loại 1 key khỏi playlist (xoá tay / "Xóa luôn" / "Giữ lại" lúc phát lỗi / xoá file lỗi): cập nhật nguồn chân lý,
     * hàng đợi phát lẫn danh sách hiển thị rồi vẽ lại. @param {string} key */
    removeKeyFromDisplay(key) {
        const { playlistOrder, displayOrder } = appState.get(['playlistOrder', 'displayOrder']);
        appState.set('playlistOrder', removeKeyFromList(playlistOrder, key)); // core/playlist/order.js
        appState.set('displayOrder', removeKeyFromList(displayOrder, key));
        appState.mutate('pendingResortKeys', s => s.delete(key));
        appState.mutate('playlistCache', m => m.delete(key)); appState.mutate('songNameIndex', m => m.delete(key));
        console.log(`writer: "workflowPlaylistOrder.removeKeyFromDisplay", page: "playlistOrder/displayOrder/playlistCache", content: "-${key}"`);
        this.updateShuffleArray();
        this.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
        workflowPlaylistRender.syncEmptyState();
    },

    /** Sắp `keys` theo cài đặt Sắp xếp hiện tại (trục tên/ngày + trục thống kê tuỳ chọn). Dùng chung renderOrder,
     * displayOrder và "Phát bài đã chọn". @param {string[]} keys @param {object} s - appState.get(PLAYLIST_SORT_STATE_KEYS)
     * @returns {string[]} mảng mới */
    sortKeys(keys, s) {
        const nameRanks = (NAME_RANK_BY_SORT_MODE[s.displaySortMode] || NAME_RANK_BY_SORT_MODE.az)(keys, s);
        const statValues = collectStatSortValues(keys, s.displayStatSortField, s.playlistCache, s.mediaStatsMap, s.activeMediaSource); // core/playlist/order.js
        return sortKeysByRank(keys, nameRanks, statValues, s.displayStatSortDirection); // core/playlist/order.js
    },

    /** renderOrder = bài hợp lệ, lọc theo ô tìm kiếm, sắp theo cài đặt hiện tại. Không phụ thuộc currentKey/pending/hàng
     * đợi phát — UI luôn "đúng như mắt thấy". */
    recomputeRenderOrder() {
        const startMs = performance.now();
        const s = appState.get(['playlistOrder', 'confirmedBrokenKeys', 'searchQuery', ...PLAYLIST_SORT_STATE_KEYS]);
        const live = liveKeys(s.playlistOrder, s.confirmedBrokenKeys); // core/playlist/order.js
        const filtered = SEARCH_FILTER_BY_HAS_QUERY[!!s.searchQuery](live, s.searchQuery, s.playlistCache);
        const sorted = this.sortKeys(filtered, s);
        appState.set('renderOrder', sorted);
        console.log(`writer: "workflowPlaylistOrder.recomputeRenderOrder", page: "renderOrder", content: "${computePlaylistElapsedMs(startMs, performance.now())}ms cho ${sorted.length} item"`); // core/playlist/render.js
    },

    /** displayOrder = top-level (bài hợp lệ) sắp theo cài đặt, xoá pending. Dùng khi đổi kiểu sắp xếp / chạm biên. Mọi
     * section đang phát (playSelectedSongs(), event/workflow/playlist.js) coi như kết thúc -> sectionQueueActive=false.
     * @returns {string[]} displayOrder mới */
    recomputeDisplayOrder() {
        const s = appState.get(['playlistOrder', 'confirmedBrokenKeys', ...PLAYLIST_SORT_STATE_KEYS]);
        const sorted = this.sortKeys(liveKeys(s.playlistOrder, s.confirmedBrokenKeys), s); // core/playlist/order.js
        appState.set('displayOrder', sorted);
        console.log(`writer: "workflowPlaylistOrder.recomputeDisplayOrder", page: "displayOrder", content: "resort lại theo displaySortMode, về top-level"`);
        appState.mutate('pendingResortKeys', set => set.clear());
        console.log(`writer: "workflowPlaylistOrder.recomputeDisplayOrder", page: "pendingResortKeys", content: "clear toàn bộ"`);
        appState.set('sectionQueueActive', false);
        console.log(`writer: "workflowPlaylistOrder.recomputeDisplayOrder", page: "sectionQueueActive", content: "false"`);
        return sorted;
    },

    /** Reset shuffleIndices theo TOÀN BỘ top-level (boot / thêm bài / dọn lưu trữ / áp Scope) — Shuffle bật thì trộn. Khác
     * nút Shuffle ở Bottom Player (trộn "hiện hành" — workflowPlayerControls.toggleShuffleAndReshuffle()). */
    updateShuffleArray() {
        const { playlistOrder, isShuffle } = appState.get(['playlistOrder', 'isShuffle']);
        updateShuffleArrayFromQueue([], playlistOrder, !!isShuffle); // core/playlist/order.js — không có nhóm hiện hành
    },

    /** Thêm bài MỚI vào hàng đợi phát: không đang phát gì -> resort ngay; đang phát -> nối cuối + ghi nhận pending (chỉ
     * resort khi chạm biên), không làm gãy thứ tự đang nghe. Không ảnh hưởng renderOrder. */
    applyNewSongsToDisplayOrder(newKeys) {
        const mode = resolveNewSongsDisplayMode(newKeys.length, !!appState.get('currentKey')); // core/playlist/order.js
        NEW_SONGS_DISPLAY_BY_MODE[mode](newKeys);
    },

    /** Không có bài mới — chỉ tính lại hàng đợi phát nếu đang lệch số bài hợp lệ. */
    _resyncDisplayOrderIfStale() {
        const { displayOrder, playlistOrder, confirmedBrokenKeys } = appState.get(['displayOrder', 'playlistOrder', 'confirmedBrokenKeys']);
        if (displayOrder.length === liveKeys(playlistOrder, confirmedBrokenKeys).length) return; // guard — đã khớp (core/playlist/order.js)
        this.recomputeDisplayOrder();
    },

    /** Đang phát — nối bài mới (chưa có) vào cuối hàng đợi phát + ghi nhận chờ resort khi chạm biên. */
    _appendNewKeysAsPending(newKeys) {
        const keysToAppend = pickKeysToAppend(appState.get('displayOrder'), newKeys); // core/playlist/order.js
        appState.mutate('displayOrder', arr => arr.push(...keysToAppend));
        console.log(`writer: "workflowPlaylistOrder._appendNewKeysAsPending", page: "displayOrder", content: "nối thêm ${keysToAppend.length} key"`);
        appState.mutate('pendingResortKeys', set => newKeys.forEach((k) => set.add(k)));
        console.log(`writer: "workflowPlaylistOrder._appendNewKeysAsPending", page: "pendingResortKeys", content: "thêm ${newKeys.length} key chờ resort"`);
    },

    /** Đổi kiểu sắp xếp tên/ngày (az/za/newest/oldest — dùng chung Song/Video/Photo): hàng đợi phát resort thật (hành động
     * chủ động), UI sắp lại ngay. */
    setDisplaySortMode(mode) {
        if (!['az', 'za', 'newest', 'oldest'].includes(mode)) return;
        appState.set('displaySortMode', mode);
        console.log(`writer: "workflowPlaylistOrder.setDisplaySortMode", page: "displaySortMode", content: "${mode}"`);
        this._resortAll();
    },

    /** Đổi trục (2) — field thống kê. */
    setDisplayStatSortField(field) {
        if (!['none', 'count', 'times', 'size', 'duration'].includes(field)) return;
        appState.set('displayStatSortField', field);
        console.log(`writer: "workflowPlaylistOrder.setDisplayStatSortField", page: "displayStatSortField", content: "${field}"`);
        this._resortAll();
    },

    /** Đổi trục (2) — hướng sắp xếp. */
    setDisplayStatSortDirection(direction) {
        if (!['desc', 'asc'].includes(direction)) return;
        appState.set('displayStatSortDirection', direction);
        console.log(`writer: "workflowPlaylistOrder.setDisplayStatSortDirection", page: "displayStatSortDirection", content: "${direction}"`);
        this._resortAll();
    },

    /** Sau khi đổi cài đặt Sắp xếp: tính lại hàng đợi phát + renderOrder rồi vẽ lại. */
    _resortAll() {
        this.recomputeDisplayOrder();
        this.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
    },

    // ===================== Search =====================

    /** Ứng với 'playlist.search.input' — nút xoá hiện/ẩn ngay, lọc lại sau khi ngừng gõ. @param {string} value */
    searchInput(value) {
        syncPlaylistSearchClearButton(value); // core/playlist/main.js
        taskManager.once(() => this.applySearchQuery(value), PLAYLIST_SEARCH_DEBOUNCE_MS, PLAYLIST_SEARCH_APPLY_TASK);
    },

    /** Ứng với 'playlist.search.clear' — huỷ lượt lọc đang hẹn (kẻo nó chạy sau và lọc lại), xoá ô nhập rồi bỏ lọc. */
    searchClear() {
        taskManager.kill(PLAYLIST_SEARCH_APPLY_TASK);
        resetPlaylistSearchInput(); // core/playlist/main.js
        this.applySearchQuery('');
    },

    /** Map key -> { source, text } nhớ chuỗi tìm kiếm đã chuẩn hoá của từng bài (playlistStore, tạo lần đầu cần). Không cần
     * dọn theo key: mục của bài đã xoá chỉ nằm im, mục của bài đổi tag tự tính lại (so `source`). */
    _searchTextMemo() {
        const existing = playlistStore.get('searchTextMemo');
        if (existing) return existing;
        const memo = new Map();
        playlistStore.set({ searchTextMemo: memo });
        console.log(`writer: "workflowPlaylistOrder._searchTextMemo", page: "playlistStore.searchTextMemo", content: "khởi tạo Map rỗng"`);
        return memo;
    },

    /** Chuỗi tìm kiếm đã chuẩn hoá của 1 bài (title/artist/album). Chỉ chuẩn hoá lại khi 1 trong 3 field gốc đổi (sửa tag /
     * đổi Nguồn trùng key). Ghi thẳng vào Map trong store — không log từng mục (10000 dòng/lần lọc đầu).
     * @param {string} key @param {Object|undefined} cached @param {Map} memo @returns {string} */
    _searchTextOf(key, cached, memo) {
        const fields = resolveSearchFields(key, cached); // core/playlist/order.js
        const hit = memo.get(key);
        if (hit && hit.source === fields.source) return hit.text; // guard — đã chuẩn hoá đúng bản tag này
        const text = joinSearchText([normalizeSongName(fields.title), normalizeSongName(fields.artist), normalizeSongName(fields.album)]); // core/song-search.js + core/playlist/order.js
        memo.set(key, { source: fields.source, text });
        return text;
    },

    /** Ô tìm kiếm đổi: chỉ lọc lại danh sách hiển thị (không đụng hàng đợi phát), rồi cuộn: kết quả có media đang phát ->
     * tới thẳng nó, không có -> về đầu danh sách. @param {string} raw */
    applySearchQuery(raw) {
        const normalizedQuery = normalizeSongName(raw); // core/song-search.js
        appState.set('searchQuery', normalizedQuery);
        console.log(`writer: "workflowPlaylistOrder.applySearchQuery", page: "searchQuery", content: "${normalizedQuery}"`);
        this.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js — chỉ ẩn/hiện key bị Search lọc, không rebuild
        workflowPlaylistRender.scrollToCurrentOrTop();
    },
};
