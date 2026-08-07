/**
 * core/file-manager/cleanup.js — Công cụ dọn rác chung File Manager (mục cuối cùng của
 * plan-v12-multimedia.md — cố ý dời tới khi mọi tính năng File Manager khác đã xong, vì mỗi tính
 * năng mới đều có thể phát sinh 1 kiểu quan hệ mồ côi riêng, viết registry TRƯỚC sẽ phải đoán mò).
 *
 * KHÁC HẲN `core/app-cleanup.js` (dọn tài nguyên PHIÊN LÀM VIỆC — animation frame/AudioContext/
 * object URL — lúc tab/app THẬT SỰ đóng): file NÀY dọn DỮ LIỆU TỒN ĐỌNG trong IndexedDB (tham
 * chiếu mồ côi tích luỹ qua nhiều phiên, do những góc khuất đã biết — xem từng hàm bên dưới) —
 * chạy khi người dùng CHỦ ĐỘNG bấm nút "Dọn dẹp dữ liệu" (Settings -> File Manager), KHÔNG tự động
 * chạy lúc boot (quét toàn bộ thư viện có thể chậm với thư viện lớn — để người dùng tự quyết định
 * lúc nào chạy, đúng tinh thần "công cụ").
 *
 * REGISTRY: mỗi kiểu quan hệ mồ côi đăng ký 1 hàm quét+tự sửa riêng qua `registerCleanupCheck()` —
 * tính năng SAU NÀY phát sinh quan hệ mới chỉ cần viết thêm 1 hàm + đăng ký thêm 1 dòng, KHÔNG sửa
 * lại orchestration (event/workflow/file-manager-cleanup.js lặp qua registry, không biết/không cần
 * biết chi tiết từng check).
 *
 * Core THUẦN — tuân Rule 1-4 (siết chặt 04/07/2026): mỗi hàm CHỈ gọi service/db.js (dịch vụ hạ
 * tầng, KHÔNG tính "core khác" — xem giải thích gốc ở core/file-manager/folder.js dòng 6-15) và
 * chỉ làm ĐÚNG 1 tiến trình "phát hiện + tự sửa 1 KIỂU quan hệ mồ côi cụ thể" (Rule 1).
 *
 * NẠP SAU: service/db.js.
 */

const _cleanupChecks = []; // Array<{ name: string, run: () => Promise<number> }> — run() trả số mục đã dọn

/**
 * Đăng ký 1 check dọn rác — gọi ở CUỐI file này cho từng hàm bên dưới (self-register lúc nạp
 * script, giống nhiều pattern self-init khác trong project).
 * @param {string} name - tên ngắn để hiện trong log/kết quả.
 * @param {() => Promise<number>} run - hàm quét+tự sửa, trả về SỐ MỤC đã dọn (0 nếu sạch).
 */
function registerCleanupCheck(name, run) {
    _cleanupChecks.push({ name, run });
}

/** Workflow (event/workflow/file-manager-cleanup.js) đọc registry qua hàm này — KHÔNG export
 * biến `_cleanupChecks` trực tiếp (giữ nguyên tắc "chỉ đọc qua hàm", tránh code ngoài sửa tay mảng). */
function getRegisteredCleanupChecks() {
    return _cleanupChecks;
}

/**
 * MỒ CÔI #1 — `record.folder[folderId]` còn sót trên bài hát SAU KHI folder đã bị xoá, cho những
 * bài đã TOMBSTONE khỏi folder TRƯỚC lúc folder bị xoá (deleteFolder() chỉ dọn được bài đang
 * ACTIVE tại thời điểm xoá — xem giải thích đầy đủ ở core/file-manager/folder.js dòng 40-52,
 * "resolveFolderId() — SỬA 03/07/2026 đợt 5"). Dùng `meta.deletedFolderIds` (danh sách ĐẦY ĐỦ mọi
 * folderId từng bị xoá) để biết chính xác cần dọn field nào trên mỗi bài.
 * @returns {Promise<number>} số bài hát đã dọn field `folder[...]` mồ côi.
 */
async function cleanupOrphanedSongFolderFields() {
    const deletedFolderIds = (await getMeta('deletedFolderIds')) || []; // data layer
    if (deletedFolderIds.length === 0) return 0;
    const deletedSet = new Set(deletedFolderIds);

    const songKeys = await getAllSongKeys(); // data layer
    let fixedCount = 0;
    for (const key of songKeys) {
        const record = await getSongRecord(key); // data layer
        if (!record || !record.folder) continue;
        const staleIds = Object.keys(record.folder).filter((id) => deletedSet.has(id));
        if (staleIds.length === 0) continue;
        staleIds.forEach((id) => { delete record.folder[id]; });
        await setSongRecord(key, record); // data layer
        fixedCount++;
    }
    return fixedCount;
}

/**
 * MỒ CÔI #2 — `folder_song` map còn tồn tại dù `folders` record tương ứng đã bị xoá (lẽ ra
 * `deleteFolder()` xoá CẢ HAI cùng lúc — safety net phòng trường hợp bất thường: crash giữa chừng,
 * sửa tay IndexedDB...).
 * @returns {Promise<number>}
 */
async function cleanupOrphanedFolderSongMaps() {
    const [liveFolderIds, mapKeys] = await Promise.all([getAllFolderKeys(), getAllFolderSongKeys()]); // data layer
    const liveSet = new Set(liveFolderIds);
    let fixedCount = 0;
    for (const folderId of mapKeys) {
        if (liveSet.has(folderId)) continue;
        await deleteFolderSongMap(folderId); // data layer
        fixedCount++;
    }
    return fixedCount;
}

/**
 * MỒ CÔI #3 — `albums.imageKeys` chứa key ảnh đã bị xoá khỏi store `images` (lẽ ra
 * `removeImageFromAlbum()`/cascade xoá ảnh đã dọn — safety net cho đường xoá khác nếu có).
 * @returns {Promise<number>} số ALBUM đã dọn (không phải số key ảnh — 1 album có thể mất nhiều key
 *   cùng lúc, vẫn tính 1).
 */
async function cleanupOrphanedAlbumImageKeys() {
    const albumIds = await getAllAlbumKeys(); // data layer
    let fixedCount = 0;
    for (const albumId of albumIds) {
        const record = await getAlbumRecord(albumId); // data layer
        if (!record || !Array.isArray(record.imageKeys) || record.imageKeys.length === 0) continue;
        const checks = await Promise.all(record.imageKeys.map((key) => getImageRecord(key))); // data layer
        const validKeys = record.imageKeys.filter((_, i) => !!checks[i]);
        if (validKeys.length === record.imageKeys.length) continue; // không có key nào mất -> bỏ qua
        await setAlbumRecord(albumId, { ...record, imageKeys: validKeys }); // data layer
        fixedCount++;
    }
    return fixedCount;
}

// XOÁ (v14) — `cleanupOrphanedActiveBackgroundAlbum()` (mồ côi #4, safety net cho
// `meta.activeBackgroundAlbum`) bỏ hẳn: khoá đó đã NGỪNG GHI từ v13 Batch B, và field nó tự đọc để
// so sánh (`visualBgConfig.listAlbumId`) cũng không còn tồn tại ở schema v14 — hàm đã thành no-op
// kép (đọc field không tồn tại -> luôn null -> luôn return 0). `purgeVisualBgLegacyMeta()` bên dưới
// đã tự xoá khoá này khỏi meta lúc boot, không cần cascade riêng nữa.

/**
 * MỒ CÔI #5 — tài liệu 'user' tạo RỒI BỎ DỞ (nội dung vẫn rỗng — "Tạo tài liệu mới" xong đóng
 * Reader mà không lưu gì, xem event/workflow/document-reader.js::close()). Không mất mát gì thật
 * (rỗng từ đầu) — an toàn xoá hẳn thay vì để "ma" nằm lì trong danh sách.
 * @returns {Promise<number>}
 */
async function cleanupEmptyUserDocuments() {
    const documentKeys = await getAllDocumentKeys(); // data layer
    let fixedCount = 0;
    for (const key of documentKeys) {
        const record = await getDocumentRecord(key); // data layer
        if (!record || record.createdBy !== 'user') continue;
        if (Array.isArray(record.content) && record.content.length === 0) {
            await deleteDocumentRecord(key); // data layer
            fixedCount++;
        }
    }
    return fixedCount;
}

registerCleanupCheck('orphanedSongFolderFields', cleanupOrphanedSongFolderFields);
registerCleanupCheck('orphanedFolderSongMaps', cleanupOrphanedFolderSongMaps);
registerCleanupCheck('orphanedAlbumImageKeys', cleanupOrphanedAlbumImageKeys);
registerCleanupCheck('emptyUserDocuments', cleanupEmptyUserDocuments);

/**
 * Dọn 4 khoá `meta` MỒ CÔI của cơ chế nền cũ (v13 Batch F) — đều đã ngừng ghi từ Batch A/B/C:
 *   meta.videoBg            — BẢN SAO Blob video nền (cơ chế cũ copy blob; v13 chỉ lưu KEY)
 *   meta.visualBgImage      — BẢN SAO Blob ảnh nền tĩnh (như trên)
 *   meta.activeBackgroundAlbum — album nền, thay bằng `visualBgConfig.source` (v14)
 *   meta.slideshowConfig    — domain config riêng, gộp vào `visualBgConfig.slideshow`
 * 2 khoá đầu là Blob THẬT, có thể chiếm hàng trăm MB — đây mới là phần đáng giá của việc dọn.
 * Gọi 1 LẦN lúc boot (event/workflow/app-boot.js). Idempotent: chạy lại không sao.
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
