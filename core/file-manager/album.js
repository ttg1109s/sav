/**
 * core/file-manager/album.js — Album ảnh trong File Manager → Photo & Album, ver 12 "Multi Media",
 * Batch 3 (03/07/2026). Schema ĐÃ CHỐT (xem comment DB_VERSION ở service/db.js): store 'albums',
 * key = albumId, value = { id, name, imageKeys: [...] } — quan hệ album<->ảnh nằm NGAY trên record
 * album (không có store quan hệ riêng như folder<->song — album không cần tombstone/position, xem
 * đầu core/file-manager/image.js).
 *
 * ÁP DỤNG NGAY 2 bài học vừa sửa ở core/file-manager/folder.js (03/07/2026, đợt 5/6) — KHÔNG đợi
 * bị phát hiện lại lần nữa:
 *   1. Chặn trùng TÊN (case-sensitive) — createAlbum()/renameAlbum().
 *   2. KHÔNG BAO GIỜ tái sử dụng 1 albumId đã từng bị xoá (meta.deletedAlbumIds) — album tạo lại
 *      cùng tên sẽ nhận id khác (`...-2`...), tránh hẳn lớp bug "tham chiếu cũ đọc nhầm sang
 *      album mới trùng id" (dù ở đây rủi ro thấp hơn folder vì KHÔNG có field record.album[albumId]
 *      trên phía ảnh — nhưng vẫn chặn để nhất quán + phòng xa nếu sau này thêm field đó).
 *
 * NẠP SAU: service/db.js (getAlbumRecord/setAlbumRecord/deleteAlbumRecord/getAllAlbumKeys/
 * getMeta/setMeta/slugify).
 */

/**
 * Sinh albumId DUY NHẤT từ tên album — cùng thuật toán resolveFolderId() (bao gồm chặn tái dùng id
 * đã xoá qua meta.deletedAlbumIds).
 * @param {string} name
 * @returns {Promise<string>}
 */
async function resolveAlbumId(name) {
    const baseSlug = slugify(name) || 'album'; // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[resolveAlbumId] callTo: "slugify", request: "chuẩn hoá tên '${name}' thành slug làm base cho id"`);
    const deletedIds = (await getMeta('deletedAlbumIds')) || []; // data layer (service/db.js)
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getAlbumRecord(candidate); // data layer
        if (!existing && !deletedIds.includes(candidate)) return candidate;
        candidate = `${baseSlug}-${suffix}`; suffix++;
    }
}

/**
 * Tạo 1 album mới rỗng. Guard clause "trùng tên -> dừng sớm" (Rule 1 cho phép, không phải rẽ
 * nhánh 2 tiến trình khác nhau) — so khớp CASE-SENSITIVE, giống hệt createFolder().
 * @param {string} name
 * @returns {Promise<{status: 'duplicateName'|'ok', albumId?: string}>}
 */
async function createAlbum(name) {
    const existingAlbums = await listAlbums(); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[createAlbum] callTo: "listAlbums", request: "kiểm tra tên '${name}' đã tồn tại chưa (case-sensitive)"`);
    if (existingAlbums.some(a => a.name === name)) return { status: 'duplicateName' };

    const albumId = await resolveAlbumId(name); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[createAlbum] callTo: "resolveAlbumId", request: "sinh id duy nhất từ tên '${name}'"`);
    await setAlbumRecord(albumId, { id: albumId, name, imageKeys: [] });
    return { status: 'ok', albumId };
}

/**
 * Đổi tên 1 album đã có. Cùng nguyên tắc renameFolder() (guard clause, chặn trùng tên trừ chính nó).
 * @param {string} albumId
 * @param {string} newName
 * @returns {Promise<{status: 'notFound'|'duplicateName'|'ok'}>}
 */
async function renameAlbum(albumId, newName) {
    const record = await getAlbumRecord(albumId);
    if (!record) return { status: 'notFound' };

    const existingAlbums = await listAlbums(); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[renameAlbum] callTo: "listAlbums", request: "kiểm tra tên '${newName}' đã tồn tại ở album khác chưa (case-sensitive)"`);
    if (existingAlbums.some(a => a.id !== albumId && a.name === newName)) return { status: 'duplicateName' };

    record.name = newName;
    await setAlbumRecord(albumId, record);
    return { status: 'ok' };
}

/**
 * Xoá 1 album — KHÔNG đụng gì tới record ảnh bên trong (ảnh vẫn còn nguyên trong thư viện, chỉ mất
 * liên kết với album này — đúng bản chất "album là 1 cách nhóm ảnh", không phải "nơi chứa ảnh").
 * Ghi nhận albumId vào meta.deletedAlbumIds (xem giải thích ở resolveAlbumId()).
 * @param {string} albumId
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteAlbum(albumId) {
    const record = await getAlbumRecord(albumId);
    if (!record) return { status: 'notFound' };

    await deleteAlbumRecord(albumId);

    const deletedIds = (await getMeta('deletedAlbumIds')) || [];
    if (!deletedIds.includes(albumId)) {
        deletedIds.push(albumId);
        await setMeta('deletedAlbumIds', deletedIds);
    }
    return { status: 'ok' };
}

/**
 * Thêm NHIỀU ảnh vào 1 album — bỏ qua ảnh đã có sẵn trong album (không thêm trùng lặp trong mảng).
 * @param {string[]} imageKeys
 * @param {string} albumId
 * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
 */
async function addImagesToAlbum(imageKeys, albumId) {
    const record = await getAlbumRecord(albumId);
    if (!record) return { status: 'notFound', addedCount: 0 };
    if (!Array.isArray(record.imageKeys)) record.imageKeys = [];

    let addedCount = 0;
    for (const imageKey of imageKeys) {
        if (!record.imageKeys.includes(imageKey)) {
            record.imageKeys.push(imageKey);
            addedCount++;
        }
    }
    await setAlbumRecord(albumId, record);
    return { status: 'ok', addedCount };
}

/**
 * Gỡ 1 ảnh khỏi 1 album cụ thể — CHỈ gỡ liên kết, KHÔNG xoá ảnh khỏi thư viện.
 * @param {string} imageKey
 * @param {string} albumId
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeImageFromAlbum(imageKey, albumId) {
    const record = await getAlbumRecord(albumId);
    if (!record || !Array.isArray(record.imageKeys)) return { status: 'notFound' };
    record.imageKeys = record.imageKeys.filter(k => k !== imageKey);
    await setAlbumRecord(albumId, record);
    return { status: 'ok' };
}

/**
 * Liệt kê toàn bộ album hiện có.
 * @returns {Promise<Array<{id: string, name: string, imageKeys: string[]}>>}
 */
async function listAlbums() {
    const ids = await getAllAlbumKeys();
    const records = await Promise.all(ids.map(id => getAlbumRecord(id)));
    return records.filter(Boolean);
}
