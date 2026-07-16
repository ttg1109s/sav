/**
 * core/file-manager/image.js — Ảnh trong File Manager → Photo & Album, ver 12 "Multi Media",
 * Batch 3 (03/07/2026). Schema ĐÃ CHỐT từ hạ tầng DB trước đó (xem comment DB_VERSION ở
 * service/db.js): store 'images', key = imageKey, value = { blob, filename, addedAt }.
 *
 * MỚI (Giai đoạn 1, rewrite Photo/Album — mục 3c/3d) — record thêm 3 field: `thumbBlob` (ảnh đã
 * resize lúc upload, height cố định — event/workflow/file-manager-photo.js::_resizeImageForThumbnail(),
 * DÙNG cho lưới ảnh), `width`/`height` (kích thước ẢNH GỐC, đo lúc resize — DÙNG để
 * buildPhotoGridRows() tính tỉ lệ hiển thị mà KHÔNG cần decode ảnh lại lúc dựng lưới, xem hàm ngay
 * dưới). `blob` gốc CHỈ dùng khi mở full view (openImagePreviewModal()/carousel) — KHÔNG đổi.
 * Record CŨ (upload trước bản này) THIẾU 3 field trên — mọi nơi đọc PHẢI tự fallback (`thumbBlob ||
 * blob`, `width > 0 ? ... : 1` coi như ảnh vuông) — KHÔNG migrate DB_VERSION (idb-keyval tự do field,
 * cùng nguyên tắc `caption` ở setImageCaption() ngay dưới).
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
 * sinh key -> ghi record. `thumbBlob`/`width`/`height` PHẢI tính SẴN trước khi gọi hàm này (Workflow
 * — event/workflow/file-manager-photo.js::_resizeImageForThumbnail(), cần Image/canvas là DOM API,
 * core KHÔNG được đụng theo Rule 1-4, đúng tiền lệ event/workflow/image-edit.js đang xử lý canvas
 * riêng ở Workflow) — hàm này (core) CHỈ ghi lại nguyên xi, không tự resize/decode gì thêm.
 * @param {File|Blob} file - blob ẢNH GỐC (không resize).
 * @param {string} filename
 * @param {Blob} thumbBlob - ảnh đã resize sẵn, dùng cho lưới (Giai đoạn 1, mục 3d).
 * @param {number} width - chiều rộng ẢNH GỐC (px), đo lúc resize.
 * @param {number} height - chiều cao ẢNH GỐC (px), đo lúc resize.
 * @returns {Promise<string>} imageKey vừa lưu
 */
async function saveImage(file, filename, thumbBlob, width, height) {
    const imageKey = await resolveImageKey(filename); // CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3
    console.log(`[saveImage] callTo: "resolveImageKey", request: "sinh/tái dùng key duy nhất từ tên file '${filename}'"`);
    await setImageRecord(imageKey, { blob: file, thumbBlob, width, height, filename, addedAt: Date.now() });
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
 *
 * HOÀN THIỆN (Giai đoạn 5, rewrite Photo/Album — trả nợ kỹ thuật ghi ở Giai đoạn 1) — nhận thêm
 * `thumbBlob`/`width`/`height`, ghi đè CẢ 3 cùng lúc với `blob` — trước đây chỉ ghi `blob`, khiến
 * `thumbBlob` (lưới ảnh) SAI tỉ lệ/nội dung so với ảnh vừa sửa (crop/rotate đổi cả kích thước lẫn
 * hình ảnh) VĨNH VIỄN cho tới khi tự sửa lại code — KHÔNG có cơ chế backfill tự động nào cứu (đính
 * chính: comment cũ ở đầu file này từng nhắc "backfill lười khi mở full-view" như đã cài — thực tế
 * CHƯA BAO GIỜ implement, chỉ là dự định ghi nhầm thành đã làm; ảnh cũ thiếu `thumbBlob`/`width`/
 * `height` VẪN đang fallback vĩnh viễn về `blob` gốc + tỉ lệ vuông tại `itemTemplateImageGridRow()`/
 * `buildPhotoGridRows()`, không tự sửa dù đã mở full-view — cần Giang xác nhận có cần implement
 * backfill thật hay chấp nhận giữ nguyên cho tới khi ảnh được re-upload/edit). Nơi gọi
 * (event/workflow/image-edit.js::handleSave()) PHẢI tự resize thumbnail TRƯỚC khi gọi hàm này —
 * core không được đụng canvas (Rule 1-4, DOM API).
 * @param {string} imageKey
 * @param {Blob} newBlob - ảnh GỐC đã sửa.
 * @param {Blob} thumbBlob - thumbnail đã resize sẵn, cùng công thức lúc upload.
 * @param {number} width - chiều rộng ảnh GỐC đã sửa (px).
 * @param {number} height - chiều cao ảnh GỐC đã sửa (px).
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function updateImageBlob(imageKey, newBlob, thumbBlob, width, height) {
    const record = await getImageRecord(imageKey); // data layer
    if (!record) return { status: 'notFound' };
    await setImageRecord(imageKey, { ...record, blob: newBlob, thumbBlob, width, height });
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
 *     hàng ảnh trước chưa lấp đầy `containerWidthPx` (KHÔNG gộp ảnh 2 ngày khác nhau chung 1 hàng).
 *   - cụm ảnh CÙNG NGÀY vừa khít `containerWidthPx` (1 hàng lưới thật).
 *
 * SỬA (Giai đoạn 1, rewrite Photo/Album, mục 3b — "không phải NxN cố định, ảnh cao = chiều cao
 * hàng, rộng theo tỉ lệ ảnh") — bản trước gộp theo SỐ LƯỢNG ảnh cố định/hàng (`columns`, ô vuông
 * đều nhau). Giờ mỗi ảnh 1 chiều rộng hiển thị KHÁC NHAU (`rowHeightPx * tỉ lệ ảnh`) nên phải cộng
 * dồn WIDTH thay vì đếm SỐ ẢNH — hàng đầy khi tổng width cộng thêm 1 ảnh nữa VƯỢT `containerWidthPx`.
 * `image.width`/`image.height` (ảnh gốc, đo lúc upload — event/workflow/file-manager-photo.js::
 * _resizeImageForThumbnail()) dùng để tính tỉ lệ MÀ KHÔNG cần decode ảnh lại ở đây (giữ hàm THUẦN,
 * không DOM) — ảnh cũ thiếu 2 field này (upload trước Giai đoạn 1) coi tạm như ảnh vuông (tỉ lệ 1).
 *
 * Hàm THUẦN (Rule 1-4 core-function-conventions.md) — không appState, không DOM, không gọi core
 * khác (khoá ngày tính INLINE ngay trong vòng lặp, KHÔNG tách hàm riêng — tránh Core gọi Core).
 * 1 vòng lặp duy nhất, rẽ nhánh nội bộ CHỈ để chọn giữa 2 DẠNG HIỂN THỊ của CÙNG 1 khái niệm "hàng
 * tiếp theo" — cùng khuôn if/else `itemTemplateFolderTile()` (components/items.js) chọn giữa 2 dạng
 * của CÙNG 1 loại item, không phải rẽ nhánh 2 nghiệp vụ khác nhau (Rule 1).
 * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, filename:string, addedAt:number}>} sortedImages
 * @param {number} containerWidthPx - bề rộng khả dụng thật của container lưới (Workflow tự đo — xem
 *        cảnh báo đo `clientWidth` SAI thời điểm ở docstring `setupPhotoGridWindow()`, event/workflow/
 *        file-manager-photo.js — cùng nguyên tắc phải áp dụng ở đây).
 * @param {number} rowHeightPx - chiều cao CỐ ĐỊNH của 1 hàng ảnh (px) — khớp `PHOTO_ROW_HEIGHT_PX`
 *        (event/workflow/file-manager-photo.js) VÀ chiều cao resize lúc upload (`_resizeImageForThumbnail()`).
 * @returns {Array<{type:'header', addedAt:number}|{type:'imageRow', images:Array}>}
 */
function buildPhotoGridRows(sortedImages, containerWidthPx, rowHeightPx) {
    const safeContainerWidthPx = containerWidthPx > 0 ? containerWidthPx : 320; // guard clause thuần — kẹp giá trị đầu vào không hợp lệ
    const safeRowHeightPx = rowHeightPx > 0 ? rowHeightPx : 120; // guard clause thuần — khớp mặc định PHOTO_ROW_HEIGHT_PX
    const rows = [];
    let currentRow = null;
    let currentRowWidthPx = 0;
    let lastDayKey = null;
    for (const image of sortedImages) {
        const d = new Date(image.addedAt || 0);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dayKey !== lastDayKey) {
            rows.push({ type: 'header', addedAt: image.addedAt });
            currentRow = null;
            currentRowWidthPx = 0;
            lastDayKey = dayKey;
        }
        const aspectRatio = (image.width > 0 && image.height > 0) ? (image.width / image.height) : 1; // guard: ảnh cũ thiếu metadata -> coi tạm như vuông
        const displayWidthPx = safeRowHeightPx * aspectRatio;
        if (!currentRow || (currentRowWidthPx + displayWidthPx) > safeContainerWidthPx) {
            currentRow = { type: 'imageRow', images: [] };
            rows.push(currentRow);
            currentRowWidthPx = 0;
        }
        currentRow.images.push(image);
        currentRowWidthPx += displayWidthPx;
    }
    return rows;
}
