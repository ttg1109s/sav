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
 * Rule 1: đơn tuyến — reset playlistOrder về TOÀN BỘ bài đang có trong playlistCache (bỏ scope).
 * Rule 2: nhận playlistCache qua tham số, KHÔNG tự appState.get().
 * @param {Map} playlistCache
 */
function loadAllSongs(playlistCache) {
    appState.set('playlistOrder', Array.from(playlistCache.keys()));
    console.log(`writer: "loadAllSongs", page: "playlistOrder", content: "toàn bộ ${playlistCache.size} bài (không scope)"`);
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
    const folderKeys = getFolderSongKeys(folderMap); // CÓ return, DÙNG ngay dưới -> Rule 3 hợp lệ
    console.log(`[loadSongsFromFolder] callTo: "getFolderSongKeys", request: "lấy danh sách bài đang thật trong folder ${folderId} để scope playlist"`);

    const scoped = folderKeys.filter(k => playlistCache.has(k));
    appState.set('playlistOrder', scoped);
    console.log(`writer: "loadSongsFromFolder", page: "playlistOrder", content: "${scoped.length} bài trong folder ${folderId}"`);
}
