/**
 * core/file-manager/cleanup.js — dọn DỮ LIỆU TỒN ĐỌNG (tham chiếu mồ côi trong IndexedDB) khi người dùng bấm "Dọn dẹp
 * dữ liệu" (thư mục zip tạm OPFS do workflowStreamingZip.sweepTemp() dọn); cộng thêm bước dọn khoá meta nền cũ lúc boot.
 * Khác event/workflow/app-cleanup.js (dọn tài nguyên phiên lúc tab đóng).
 *
 * Mỗi hàm dọn đúng 1 kiểu rác. Danh sách + thứ tự các bước dọn nằm ở Workflow (event/workflow/file-manager-cleanup.js,
 * `FILE_MANAGER_CLEANUP_STEPS`) — Workflow đọc DB rồi truyền vào; core chỉ tính + ghi/xoá.
 *
 * NẠP SAU: service/db.js.
 */

/**
 * Mồ côi #1 — `meta.folder[folderId]` còn sót trên bài hát sau khi folder bị xoá (bài đã tombstone khỏi folder TRƯỚC lúc xoá
 * folder — deleteFolder() chỉ dọn bài đang ở trong folder lúc xoá). `deletedFolderIds` cho biết field nào cần dọn.
 * @param {Array<{key: string, folder?: object}>} songMetas - getAllMediaMeta('song')
 * @param {string[]} deletedFolderIds - meta.deletedFolderIds
 * @returns {Promise<number>} số bài đã dọn
 */
async function cleanupOrphanedSongFolderFields(songMetas, deletedFolderIds) {
    if (deletedFolderIds.length === 0) return 0;
    const deletedSet = new Set(deletedFolderIds);
    const staleItems = songMetas
        .filter((meta) => meta.folder && Object.keys(meta.folder).some((id) => deletedSet.has(id)))
        .map((meta) => ({
            type: 'song',
            key: meta.key,
            mutate: (current) => {
                const folder = { ...(current.folder || {}) };
                Object.keys(folder).filter((id) => deletedSet.has(id)).forEach((id) => { delete folder[id]; });
                return { ...current, folder };
            },
        }));
    await updateMediaMetaBatch(staleItems); // service/db.js
    return staleItems.length;
}

/**
 * Mồ côi #2 — `folder_song` còn tồn tại dù record `folders` đã bị xoá (lưới an toàn: crash giữa chừng, sửa tay IndexedDB…).
 * @param {string[]} liveFolderIds - getAllFolderKeys() @param {string[]} mapKeys - getAllFolderSongKeys()
 * @returns {Promise<number>} số map đã xoá
 */
async function cleanupOrphanedFolderSongMaps(liveFolderIds, mapKeys) {
    const liveSet = new Set(liveFolderIds);
    let fixedCount = 0;
    for (const folderId of mapKeys) {
        if (liveSet.has(folderId)) continue;
        await deleteFolderSongMap(folderId); // service/db.js
        fixedCount++;
    }
    return fixedCount;
}

/** Pure — tổng số mục đã dọn của các bước. @param {number[]} counts */
function sumCleanupCounts(counts) {
    return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Xoá 4 khoá `meta` mồ côi của cơ chế nền cũ (đã ngừng ghi): `videoBg`, `visualBgImage` (bản sao Blob — có thể hàng trăm
 * MB), `activeBackgroundAlbum`, `slideshowConfig`. Gọi lúc boot (event/workflow/app-boot.js); chạy lại không sao.
 * @returns {Promise<void>}
 */
async function purgeVisualBgLegacyMeta() {
    await Promise.all([
        delMeta('videoBg'),
        delMeta('visualBgImage'),
        delMeta('activeBackgroundAlbum'),
        delMeta('slideshowConfig'),
    ]); // service/db.js
}
