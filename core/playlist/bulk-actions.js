/**
 * core/playlist/bulk-actions.js — Hàm core cho hành động "Xoá hàng loạt" trong chế độ chọn nhiều
 * (ver 12 "Multi Media", plan-v12-multimedia.md mục 4.b1).
 *
 * SỬA (sau trao đổi Rule 2/3/4): bản trước có `deleteSongsBatch()` (core) gọi
 * `removeSongFromAllFolders()`/`removeSongStats()` (2 hàm VOID, không return — vi phạm Rule 3) và
 * `removeKeysFromDisplay()` (core) tự `appState.get('playlistOrder'/'displayOrder')` (vi phạm
 * Rule 2) rồi gọi tiếp 4 hàm void khác (`updateShuffleArray`/`recomputeRenderOrder`/
 * `renderPlaylistDiff`/`updateEmptyState` — vi phạm Rule 3), lại KHÔNG có `console.log` nào cho 6
 * lượt ghi appState (vi phạm Rule 4). Sửa đúng:
 *   - Bỏ hẳn `deleteSongsBatch()` khỏi core — vòng lặp xoá (đọc record + gọi
 *     `removeSongFromAllFolders`/`deleteSongRecord`/`removeSongStats` nối tiếp nhau) dời THẲNG vào
 *     workflow (`event/workflow/playlist.js`, `deleteSelectedSongs()`) — đúng vai trò workflow
 *     (được gọi nhiều hàm core void tự do), không cần bọc qua 1 lớp core giả.
 *   - `removeKeysFromDisplay()` → `removeKeysFromDisplayState()`: CHỈ còn phần đồng bộ appState
 *     thuần (set/mutate, không gọi hàm nào khác) — nhận `playlistOrder`/`displayOrder` hiện tại
 *     qua THAM SỐ (Rule 2), đủ `console.log` cho mọi lượt ghi (Rule 4). 4 hàm vẽ lại
 *     (`updateShuffleArray`/`recomputeRenderOrder`/`renderPlaylistDiff`/`updateEmptyState`) dời
 *     sang gọi TRỰC TIẾP từ workflow, ngay sau khi gọi hàm này.
 *
 * NẠP SAU: service/state.js (appState).
 */

/**
 * Đồng bộ appState sau khi ĐÃ xoá xong 1 lô key khỏi DB (workflow tự lo phần I/O trước, xem
 * event/workflow/playlist.js) — CHỈ set/mutate, không gọi hàm nào khác (Rule 3 N/A, không có core
 * gọi core). Nhận `playlistOrder`/`displayOrder` hiện tại qua tham số — KHÔNG tự appState.get()
 * (Rule 2).
 * @param {string[]} keys
 * @param {string[]} playlistOrder - appState.get('playlistOrder') hiện tại, nơi gọi tự đọc trước
 * @param {string[]} displayOrder - appState.get('displayOrder') hiện tại, nơi gọi tự đọc trước
 */
function removeKeysFromDisplayState(keys, playlistOrder, displayOrder) {
    const keySet = new Set(keys);

    appState.set('playlistOrder', playlistOrder.filter(k => !keySet.has(k)));
    console.log(`writer: "removeKeysFromDisplayState", page: "playlistOrder", content: "gỡ ${keys.length} key vừa xoá"`);

    appState.set('displayOrder', displayOrder.filter(k => !keySet.has(k)));
    console.log(`writer: "removeKeysFromDisplayState", page: "displayOrder", content: "gỡ ${keys.length} key vừa xoá"`);

    appState.mutate('pendingResortKeys', s => keys.forEach(k => s.delete(k)));
    console.log(`writer: "removeKeysFromDisplayState", page: "pendingResortKeys", content: "gỡ ${keys.length} key vừa xoá"`);

    appState.mutate('playlistCache', m => keys.forEach(k => m.delete(k)));
    console.log(`writer: "removeKeysFromDisplayState", page: "playlistCache", content: "gỡ ${keys.length} key vừa xoá"`);

    appState.mutate('songNameIndex', m => keys.forEach(k => m.delete(k)));
    console.log(`writer: "removeKeysFromDisplayState", page: "songNameIndex", content: "gỡ ${keys.length} key vừa xoá"`);

    appState.mutate('selectedSongKeys', s => keys.forEach(k => s.delete(k)));
    console.log(`writer: "removeKeysFromDisplayState", page: "selectedSongKeys", content: "gỡ ${keys.length} key vừa xoá"`);
}
