/**
 * core/file-manager/cleanup.js — dọn DỮ LIỆU TỒN ĐỌNG (tham chiếu mồ côi trong IndexedDB, file tạm OPFS) khi người dùng
 * bấm "Dọn dẹp dữ liệu"; cộng thêm 2 bước dọn lúc boot (khoá meta nền cũ, Service Worker đời cũ). Khác
 * event/workflow/app-cleanup.js (dọn tài nguyên phiên lúc tab đóng).
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

/**
 * Mồ côi #3 — file .zip tạm trong OPFS (`sav-zip-tmp/`, phải khớp OPFS_ZIP_TEMP_DIR ở core/streaming-zip.js) bị bỏ lại khi
 * phiên nén bị gián đoạn trước khi `cleanupStreamingZipTemp()` kịp dọn. Tuổi file lấy từ `<timestamp>` trong tên
 * `zip-<timestamp>-<random>.zip`; chỉ xoá file cũ hơn 1 giờ (OPFS dùng chung theo origin — tab khác có thể đang ghi dở).
 * @returns {Promise<number>} số file đã xoá
 */
async function cleanupOrphanedZipTempFiles() {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') return 0; // OPFS không khả dụng
    const ZIP_TEMP_DIR_NAME = 'sav-zip-tmp';
    const MAX_AGE_MS = 60 * 60 * 1000;
    let fixedCount = 0;
    try {
        const root = await navigator.storage.getDirectory();
        const tmpDirHandle = await root.getDirectoryHandle(ZIP_TEMP_DIR_NAME, { create: false }).catch(() => null);
        if (!tmpDirHandle) return 0; // chưa từng tạo -> sạch
        const now = Date.now();
        const staleNames = [];
        for await (const name of tmpDirHandle.keys()) {
            const match = /^zip-(\d+)-/.exec(name);
            const createdAt = match ? Number(match[1]) : 0;
            if (createdAt && (now - createdAt) < MAX_AGE_MS) continue; // còn mới — có thể đang ghi dở
            staleNames.push(name);
        }
        for (const name of staleNames) {
            try {
                await tmpDirHandle.removeEntry(name);
                fixedCount++;
            } catch (e) { /* đang khoá — để lần dọn sau */ }
        }
    } catch (err) {
        console.warn('[file-manager/cleanup] Không quét được thư mục tạm zip OPFS (bỏ qua):', err);
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
