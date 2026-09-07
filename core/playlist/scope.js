/**
 * core/playlist/scope.js — Ghi `playlistOrder` từ `playlistCache` đã nạp sẵn (mục 4.b1
 * plan-v12-multimedia.md). `playlistCache` luôn khớp ĐÚNG phạm vi hiện tại (toàn bộ thư viện, hoặc
 * chỉ 1 folder nếu đang Scope) — nạp bởi `workflowPlaylistScope.loadPlaylistCacheForSource()`
 * (event/workflow/playlist-scope.js) NGAY TRƯỚC khi gọi `loadAllSongs()` dưới đây, nên chỉ cần lấy
 * toàn bộ key trong cache là đủ, không cần giao (intersect) lại với danh sách folder.
 *
 * CHỈ ghi `playlistOrder` — KHÔNG tự chạy pipeline render (updateShuffleArray/recomputeDisplayOrder/
 * recomputeRenderOrder/renderPlaylistDiff/updateEmptyState), đó là việc của Workflow gọi sau.
 *
 * NẠP SAU: (không phụ thuộc gì thêm — chỉ đọc tham số truyền vào).
 */

/**
 * Rule 1: đơn tuyến — nạp toàn bộ key trong `playlistCache` vào `playlistOrder`, trừ những key nằm
 * trong `excludedKeys` (folder đánh dấu "loại khỏi Tất cả" — core/file-manager/folder.js::
 * getExcludedSongKeysFromFolders(); truyền `new Set()` khi không cần lọc Exclude, vd đang Scope 1
 * folder cụ thể — Exclude chỉ có ý nghĩa ở view "Tất cả").
 * Rule 2: nhận `playlistCache`/`excludedKeys` qua tham số, KHÔNG tự appState.get().
 * @param {Map} playlistCache
 * @param {Set<string>} excludedKeys
 */
function loadAllSongs(playlistCache, excludedKeys) {
    const keys = Array.from(playlistCache.keys()).filter((k) => !excludedKeys.has(k));
    appState.set('playlistOrder', keys);
    console.log(`writer: "loadAllSongs", page: "playlistOrder", content: "${keys.length} bài (đã loại ${excludedKeys.size} bài exclude)"`);
}
