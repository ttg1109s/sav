/**
 * core/file-manager/image.js — Ảnh trong File Manager → Photo & Album, ver 12 "Multi Media",
 * Batch 3 (03/07/2026). Schema ĐÃ CHỐT từ hạ tầng DB trước đó (xem comment DB_VERSION ở
 * core/db.js): store 'images', key = imageKey, value = { blob, filename, addedAt }.
 *
 * KHÔNG có store quan hệ riêng ảnh<->album (khác hẳn folder<->song) — quan hệ nằm ở field
 * `imageKeys` NGAY TRÊN record album (xem core/file-manager/album.js) — đơn giản hơn vì album
 * KHÔNG cần giữ "vị trí" của ảnh đã gỡ (không có khái niệm resume vị trí phát như playlist), nên
 * không cần tombstone/position — gỡ ảnh khỏi album = filter thẳng khỏi mảng.
 *
 * Trùng filename: ÁP DỤNG Y HỆT logic resolveSongKey() (mục 6 "Đã chốt" — ảnh/docs dùng chung công
 * thức với song). KHÔNG lặp lại thuật toán, gọi thẳng slugify() dùng chung.
 *
 * NẠP SAU: core/db.js (getImageRecord/setImageRecord/deleteImageRecord/getAllImageKeys/slugify,
 * getAllAlbumKeys/getAlbumRecord/setAlbumRecord — dùng cho cascade dọn album trong deleteImage()).
 */

/**
 * Sinh imageKey DUY NHẤT từ tên file — CÙNG THUẬT TOÁN resolveSongKey (core/db.js): slug chưa tồn
 * tại -> dùng luôn; slug đã tồn tại + filename TRÙNG -> ghi đè cùng key; slug đã tồn tại + filename
 * KHÁC -> thêm hậu tố số.
 * @param {string} filename
 * @returns {Promise<string>}
 */
async function resolveImageKey(filename) {
    const baseSlug = slugify(filename) || 'image'; // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[resolveImageKey] callTo: "slugify", request: "chuẩn hoá tên file '${filename}' thành slug làm base cho key"`);
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getImageRecord(candidate); // data layer (core/db.js)
        if (!existing) return candidate;
        if (existing.filename === filename) return candidate; // cùng file -> ghi đè đúng key này
        candidate = `${baseSlug}-${suffix}`; suffix++;
    }
}

/**
 * Lưu 1 ảnh mới (hoặc ghi đè nếu trùng filename — xem resolveImageKey()). 1 tiến trình duy nhất:
 * sinh key -> ghi record.
 * @param {File|Blob} file
 * @param {string} filename
 * @returns {Promise<string>} imageKey vừa lưu
 */
async function saveImage(file, filename) {
    const imageKey = await resolveImageKey(filename); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[saveImage] callTo: "resolveImageKey", request: "sinh/tái dùng key duy nhất từ tên file '${filename}'"`);
    await setImageRecord(imageKey, { blob: file, filename, addedAt: Date.now() });
    return imageKey;
}

/**
 * Xoá hẳn 1 ảnh khỏi thư viện — dọn cascade khỏi MỌI album đang chứa nó TRƯỚC khi xoá record.
 * Cascade viết TRỰC TIẾP trong thân hàm (không gọi ra 1 hàm core riêng ở album.js) — cùng nguyên
 * tắc deleteFolder() ở core/file-manager/folder.js: dọn cascade + xoá record CHÍNH là 1 tiến trình
 * nghiệp vụ duy nhất ("xoá 1 ảnh"), các lệnh get/setAlbumRecord chỉ là tầng dữ liệu thuần (không
 * tính "core khác" theo Rule 3). Số album luôn nhỏ (người dùng tự tạo, không phải hàng nghìn như
 * bài hát) nên quét toàn bộ ở đây rẻ, không cần tối ưu thêm.
 * (Phần dọn tham chiếu `vizConfig.bgImage`/`visualBgImage` — mục 5c
 * plan-v12-multimedia-decisions.md — thuộc Batch 5, CHƯA code ở đây vì 2 field đó CHƯA tồn tại.)
 * @param {string} imageKey
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteImage(imageKey) {
    const record = await getImageRecord(imageKey);
    if (!record) return { status: 'notFound' };

    const albumIds = await getAllAlbumKeys(); // data layer (core/db.js)
    for (const albumId of albumIds) {
        const albumRecord = await getAlbumRecord(albumId); // data layer (core/db.js)
        if (!albumRecord || !Array.isArray(albumRecord.imageKeys)) continue; // guard: dữ liệu hỏng/thiếu — bỏ qua, không chặn xoá ảnh
        if (albumRecord.imageKeys.includes(imageKey)) {
            albumRecord.imageKeys = albumRecord.imageKeys.filter(k => k !== imageKey);
            await setAlbumRecord(albumId, albumRecord); // data layer (core/db.js)
        }
    }

    await deleteImageRecord(imageKey);
    return { status: 'ok' };
}

/**
 * Liệt kê toàn bộ ảnh hiện có.
 * @returns {Promise<Array<{key: string, blob: Blob, filename: string, addedAt: number}>>}
 */
async function listImages() {
    const keys = await getAllImageKeys();
    const records = await Promise.all(keys.map(async (key) => {
        const record = await getImageRecord(key);
        return record ? { key, ...record } : null;
    }));
    return records.filter(Boolean);
}
