/**
 * core/file-manager/image.js — Ảnh trong File Manager → Photo & Album, ver 12 "Multi Media",
 * Batch 3 (03/07/2026). Schema ĐÃ CHỐT từ hạ tầng DB trước đó (xem comment DB_VERSION ở
 * service/db.js): store 'images', key = imageKey, value = { blob, filename, addedAt }.
 *
 * KHÔNG có store quan hệ riêng ảnh<->album (khác hẳn folder<->song) — quan hệ nằm ở field
 * `imageKeys` NGAY TRÊN record album (xem core/file-manager/album.js) — đơn giản hơn vì album
 * KHÔNG cần giữ "vị trí" của ảnh đã gỡ (không có khái niệm resume vị trí phát như playlist), nên
 * không cần tombstone/position — gỡ ảnh khỏi album = filter thẳng khỏi mảng.
 *
 * Trùng filename: ÁP DỤNG Y HỆT logic resolveSongKey() (mục 6 "Đã chốt" — ảnh/docs dùng chung công
 * thức với song). KHÔNG lặp lại thuật toán, gọi thẳng slugify() dùng chung.
 *
 * NẠP SAU: service/db.js (getImageRecord/setImageRecord/deleteImageRecord/getAllImageKeys/slugify,
 * getAllAlbumKeys/getAlbumRecord/setAlbumRecord — dùng cho cascade dọn album trong deleteImage()).
 *
 * PATCH mục 1/2 (14/07/2026, group ảnh theo ngày + Item/window ảo): thêm 2 hàm THUẦN
 * `sortImagesByAddedDateDesc()`/`buildPhotoGridRows()` — CHUẨN BỊ dữ liệu cho lưới ảnh Photo &
 * Album, xem event/workflow/file-manager-photo.js::setupPhotoGridWindow().
 */

/**
 * Sinh imageKey DUY NHẤT từ tên file — CÙNG THUẬT TOÁN resolveSongKey (service/db.js): slug chưa tồn
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
        const existing = await getImageRecord(candidate); // data layer (service/db.js)
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
 * MỚI (04/07/2026, mục 2 phản hồi Giang) — đặt/xoá caption cho 1 ảnh (field MỚI trong record, ảnh
 * cũ chưa từng có caption coi như '' — không cần migrate DB_VERSION vì idb-keyval lưu object tự do,
 * thêm field mới không phá record cũ). Đọc lại record đầy đủ trước (giữ nguyên blob/filename/
 * addedAt), chỉ ghi đè `caption`, lưu lại NGUYÊN record — 1 tiến trình duy nhất.
 * @param {string} imageKey
 * @param {string} caption - truyền '' để xoá caption.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setImageCaption(imageKey, caption) {
    const record = await getImageRecord(imageKey); // data layer
    if (!record) return { status: 'notFound' };
    await setImageRecord(imageKey, { ...record, caption });
    return { status: 'ok' };
}

/**
 * MỚI (14/07/2026, mục cuối — tính năng Edit ảnh) — ghi đè `blob` sau khi sửa ở trang
 * `image-edit.html`, giữ nguyên `filename`/`addedAt`/`caption` — cùng khuôn `setImageCaption()`
 * ngay trên (đọc record đầy đủ, ghi đè ĐÚNG 1 field, lưu lại nguyên record).
 * @param {string} imageKey
 * @param {Blob} newBlob
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function updateImageBlob(imageKey, newBlob) {
    const record = await getImageRecord(imageKey); // data layer
    if (!record) return { status: 'notFound' };
    await setImageRecord(imageKey, { ...record, blob: newBlob });
    return { status: 'ok' };
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

    const albumIds = await getAllAlbumKeys(); // data layer (service/db.js)
    for (const albumId of albumIds) {
        const albumRecord = await getAlbumRecord(albumId); // data layer (service/db.js)
        if (!albumRecord || !Array.isArray(albumRecord.imageKeys)) continue; // guard: dữ liệu hỏng/thiếu — bỏ qua, không chặn xoá ảnh
        if (albumRecord.imageKeys.includes(imageKey)) {
            albumRecord.imageKeys = albumRecord.imageKeys.filter(k => k !== imageKey);
            await setAlbumRecord(albumId, albumRecord); // data layer (service/db.js)
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

// ===================== Group theo ngày + Window ảo (Patch mục 1/2, 14/07/2026) ====================
// 2 hàm THUẦN dưới đây CHUẨN BỊ dữ liệu cho lưới ảnh Photo & Album — xem event/workflow/
// file-manager-photo.js::setupPhotoGridWindow() (Workflow gọi CẢ HAI, RỒI mới gọi
// computeVirtualWindowRange()/renderItemList() — components/items.js) + core/file-manager/
// photo-ui.js (docstring đầu file, giải thích đầy đủ vì sao tách qua Workflow thay vì tự gọi nhau).

/**
 * Sắp xếp danh sách ảnh theo `addedAt` MỚI NHẤT lên đầu (kiểu Google Photos) — CHUẨN BỊ cho
 * buildPhotoGridRows() nhóm theo ngày. Hàm THUẦN — không mutate mảng gốc, không appState, không
 * gọi core khác.
 * @param {Array<{key:string, blob:Blob, filename:string, addedAt:number}>} images
 * @returns {Array} bản sao MỚI đã sắp xếp
 */
function sortImagesByAddedDateDesc(images) {
    return [...images].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

/**
 * Đóng gói danh sách ảnh ĐÃ sắp xếp (sortImagesByAddedDateDesc()) thành các HÀNG hiển thị — dùng
 * làm "items" cho window ảo (components/items.js::computeVirtualWindowRange() + renderItemList()).
 * Mỗi hàng là 1 trong 2 dạng:
 *   - header ngăn cách ngày (hàng RIÊNG, full-width) — LUÔN bắt đầu 1 hàng ẢNH MỚI ngay sau đó, dù
 *     hàng ảnh trước chưa đủ `columns` (KHÔNG gộp ảnh 2 ngày khác nhau chung 1 hàng lưới — đúng bố
 *     cục ảnh chụp Google Photos Giang gửi).
 *   - cụm tối đa `columns` ảnh CÙNG NGÀY (1 hàng lưới thật).
 * Hàm THUẦN (Rule 1-4 core-function-conventions.md) — không appState, không DOM, không gọi core
 * khác (khoá ngày tính INLINE ngay trong vòng lặp, KHÔNG tách hàm riêng — tránh Core gọi Core).
 * 1 vòng lặp duy nhất, rẽ nhánh nội bộ CHỈ để chọn giữa 2 DẠNG HIỂN THỊ của CÙNG 1 khái niệm "hàng
 * tiếp theo" — cùng khuôn if/else `itemTemplateFolderTile()` (components/items.js) chọn giữa 2 dạng
 * của CÙNG 1 loại item, không phải rẽ nhánh 2 nghiệp vụ khác nhau (Rule 1).
 * @param {Array<{key:string, blob:Blob, filename:string, addedAt:number}>} sortedImages
 * @param {number} columns - số cột lưới hiện tại (Workflow tự đo, xem setupPhotoGridWindow()).
 * @returns {Array<{type:'header', addedAt:number}|{type:'imageRow', images:Array}>}
 */
function buildPhotoGridRows(sortedImages, columns) {
    const safeColumns = columns > 0 ? columns : 3; // guard clause thuần — vẫn 1 tiến trình duy nhất, chỉ kẹp giá trị đầu vào không hợp lệ
    const rows = [];
    let currentRow = null;
    let lastDayKey = null;
    for (const image of sortedImages) {
        const d = new Date(image.addedAt || 0);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dayKey !== lastDayKey) {
            rows.push({ type: 'header', addedAt: image.addedAt });
            currentRow = null;
            lastDayKey = dayKey;
        }
        if (!currentRow || currentRow.images.length >= safeColumns) {
            currentRow = { type: 'imageRow', images: [] };
            rows.push(currentRow);
        }
        currentRow.images.push(image);
    }
    return rows;
}
