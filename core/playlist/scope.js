/**
 * core/playlist/scope.js — Scoping Playlist theo folder (mục 4.b1, bước 3 plan-v12-multimedia.md).
 * VIẾT MỚI HOÀN TOÀN, KHÔNG đụng core/playlist/loader.js (initPlaylistFromDB/scanValidSongsFromDB
 * — code di sản, chưa qua 4 rule) — xem plan-v12-multimedia-decisions.md phần trao đổi 03/07/2026:
 * `playlistCache` (đã được initPlaylistFromDB() nạp đầy đủ từ lúc boot, cập nhật liên tục mỗi khi
 * thêm/xoá bài) đủ để suy ra CẢ 2 trạng thái mà không cần quét lại IndexedDB:
 *   - "Tất cả bài"   = toàn bộ key trong playlistCache.
 *   - "Theo 1 folder" = giao giữa danh sách key của folder đó và playlistCache (loại bỏ key nào
 *     đã không còn hợp lệ — bài lỗi/đã xoá — dù vẫn còn sót trong folder_song).
 *
 * 2 hàm dưới đây CHỈ ghi `playlistOrder` — KHÔNG tự chạy lại pipeline render (updateShuffleArray/
 * recomputeDisplayOrder/recomputeRenderOrder/renderPlaylistDiff/updateEmptyState) — đó là chuỗi
 * side-effect nối tiếp, thuộc về Workflow (event/workflow/playlist-scope.js), không phải core.
 *
 * NẠP SAU: core/file-manager/folder.js (getFolderSongKeys), service/db.js (getFolderSongMap).
 */

/**
 * Rule 1: đơn tuyến — reset playlistOrder về TOÀN BỘ bài đang có trong playlistCache (bỏ scope),
 * TRỪ những bài đang bị Exclude (mục 5, Batch 4 — xem core/file-manager/folder.js::
 * getExcludedSongKeysFromFolders()). Guard clause thuần: lọc bỏ key nằm trong excludedKeys không
 * phải "rẽ nhánh tiến trình khác" — bỏ điều kiện đó đi, hàm vẫn còn NGUYÊN đúng 1 kịch bản duy
 * nhất ("nạp toàn bộ playlistCache vào playlistOrder"), chỉ mất phần lọc.
 * Rule 2: nhận playlistCache/excludedKeys qua tham số, KHÔNG tự appState.get().
 * @param {Map} playlistCache
 * @param {Set<string>} excludedKeys
 */
function loadAllSongs(playlistCache, excludedKeys) {
    const keys = Array.from(playlistCache.keys()).filter((k) => !excludedKeys.has(k));
    appState.set('playlistOrder', keys);
    console.log(`writer: "loadAllSongs", page: "playlistOrder", content: "${keys.length} bài (không scope, đã loại ${excludedKeys.size} bài exclude)"`);
}

/**
 * Rule 1: đơn tuyến — lọc playlistOrder chỉ còn các bài (còn hợp lệ trong playlistCache) thuộc
 * ĐÚNG 1 folder cụ thể.
 * Rule 2: nhận playlistCache qua tham số, KHÔNG tự appState.get().
 * @param {string} folderId
 * @param {Map} playlistCache
 */
async function loadSongsFromFolder(folderId, playlistCache) {
    const folderMap = await getFolderSongMap(folderId); // data layer thuần (service/db.js) — KHÔNG tính "core khác" theo Rule 3, xem đầu core/file-manager/folder.js
    // [TỰ SỬA 14/07/2026, tự audit lại Rule 3] — trước đây gọi getFolderSongKeys() (1 core KHÁC ở
    // core/file-manager/folder.js) rồi biện minh "có return value nên hợp lệ" — SAI theo Rule 3
    // hiện hành (xem giải thích đầy đủ ở core/file-manager/folder.js::deleteFolder()). Inline TRỰC
    // TIẾP logic 1 dòng (lọc tombstone null) tại đây, không gọi hàm đó nữa.
    const folderKeys = folderMap.list.filter((k) => k != null);

    const scoped = folderKeys.filter(k => playlistCache.has(k));
    appState.set('playlistOrder', scoped);
    console.log(`writer: "loadSongsFromFolder", page: "playlistOrder", content: "${scoped.length} bài trong folder ${folderId}"`);
}
