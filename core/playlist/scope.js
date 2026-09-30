/**
 * core/playlist/scope.js — view "Tất cả" (main playlist): mọi item trừ item thuộc folder Hidden
 * (`excludeFromMainPlaylist`). `playlistCache` luôn khớp đúng phạm vi hiện tại (nạp bởi
 * `workflowPlaylistScope.loadPlaylistCacheForSource()`), nên không cần giao lại với folder.
 * Tập key bị loại lấy từ `getExcludedSongKeysFromFolders()` (core/file-manager/folder.js).
 *
 * NẠP SAU: (không phụ thuộc — chỉ đọc tham số).
 */

/**
 * Ghi `playlistOrder` = mọi key trong `playlistCache` trừ `excludedKeys` (truyền `new Set()` khi
 * đang Scope 1 folder — Hidden chỉ có nghĩa ở view "Tất cả"). Không tự chạy pipeline render.
 * @param {Map} playlistCache
 * @param {Set<string>} excludedKeys
 */
function loadAllSongs(playlistCache, excludedKeys) {
    const keys = Array.from(playlistCache.keys()).filter((k) => !excludedKeys.has(k));
    appState.set('playlistOrder', keys);
    console.log(`writer: "loadAllSongs", page: "playlistOrder", content: "${keys.length} bài (đã loại ${excludedKeys.size} bài exclude)"`);
}

/**
 * Pure — bỏ item thuộc folder Hidden khỏi 1 danh sách media thư viện (picker chọn ảnh/video).
 * Cùng quy tắc `loadAllSongs()`: Hidden = không xuất hiện ở mọi nơi duyệt "Tất cả".
 * @param {Array<{key: string}>} items
 * @param {Set<string>} excludedKeys
 * @returns {Array<{key: string}>}
 */
function filterOutExcludedMedia(items, excludedKeys) {
    return items.filter((item) => !excludedKeys.has(item.key));
}
