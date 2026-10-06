/**
 * core/file-manager/image.js — Ảnh trong File Manager → Photo, ver 12 "Multi Media", Batch 3
 * (03/07/2026). Schema ĐÃ CHỐT từ hạ tầng DB trước đó (xem comment DB_VERSION ở service/db.js):
 * store 'images', key = imageKey, value = { blob, filename, addedAt }.
 *
 * MỚI (Giai đoạn 1, rewrite Photo/Album — mục 3c/3d) — record thêm 3 field: `thumbBlob` (ảnh đã
 * resize lúc upload, height cố định — event/workflow/file-manager-photo.js::resizeImageForThumbnail(),
 * DÙNG cho lưới ảnh), `width`/`height` (kích thước ẢNH GỐC, đo lúc resize — DÙNG làm attribute
 * width/height thật trên thẻ <img> để fjGallery (thư viện, event/workflow/photo-gallery-window.js)
 * tính tỉ lệ hiển thị mà KHÔNG cần đợi ảnh decode xong mới layout được). `blob` gốc CHỈ dùng khi
 * mở full view (openImagePreviewModal()/carousel) — KHÔNG đổi.
 * Record CŨ (upload trước bản này) THIẾU 3 field trên — mọi nơi đọc PHẢI tự fallback (`thumbBlob ||
 * blob`, `width > 0 ? ... : 1` coi như ảnh vuông) — KHÔNG migrate DB_VERSION (idb-keyval tự do field).
 *
 * MỚI (Giang yêu cầu — Photo tích hợp `duration` như Song/Video, chạy trong Playlist/visualizer
 * thừa hưởng đúng cơ chế Play/Next-Prev/Shuffle, im lặng hoàn toàn lúc hiển thị) — record thêm field
 * `duration` (giây, số thực — event/workflow/file-manager-photo.js::computePhotoDuration(),
 * deterministic từ size+resolution+SHA-256 của chính file). CÙNG NGUYÊN TẮC fallback record cũ như
 * `thumbBlob`/`width`/`height` — record cũ (upload trước field này tồn tại) THIẾU `duration`, nơi
 * đọc PHẢI tự fallback (xem core/playlist/loader.js::buildAdaptedPlaylistCache()).
 *
 * XOÁ (loại bỏ Album khỏi Photo Panel) — không còn cascade dọn ảnh khỏi album lúc xoá (Album đã
 * xoá hẳn khỏi app, xem core/file-manager/image.js::deleteImage()).
 *
 * Trùng filename: ÁP DỤNG Y HỆT logic resolveSongKey() (mục 6 "Đã chốt" — ảnh/docs dùng chung công
 * thức với song). KHÔNG lặp lại thuật toán, gọi thẳng slugify() dùng chung.
 *
 * NẠP SAU: service/db.js (createMediaRecord/updateMediaMeta/setMediaBlob/setMediaThumbs — API media 3 store, 06/10/2026).
 *
 * PATCH mục 1/2 (14/07/2026, group ảnh theo ngày + Item/window ảo); VIẾT LẠI (rewrite Photo/
 * Album, dùng fjGallery) — 2 hàm THUẦN `sortImagesByAddedDateDesc()`/`groupImagesByDay()` (đổi
 * tên từ `buildPhotoGridRows()`, giờ CHỈ gom nhóm theo ngày, không tự đóng gói hàng/tính width
 * nào nữa) — CHUẨN BỊ dữ liệu cho lưới ảnh Photo, xem event/workflow/photo-gallery-
 * window.js.
 */

// DỜI (06/10/2026, plan-media-db-split.md) — `resolveImageKey()` (core TỰ ĐỌC DB — vi phạm Rule 3) sang service/db.js
// (data layer, dùng chung `resolveMediaKey()` với Song/Video). Workflow gọi nó rồi truyền key vào `saveImage()`.
// XOÁ (06/10/2026) — `deleteImage()`: không còn nơi nào gọi (xoá ảnh đi qua `deleteMediaRecord('photo', ...)`).

/**
 * Lưu 1 ảnh mới (hoặc ghi đè trọn nếu trùng filename — key do Workflow resolve sẵn qua `resolveImageKey()`,
 * service/db.js). `thumbBlob`/`width`/`height`/`duration` PHẢI tính SẴN ở Workflow.
 * SỬA (06/10/2026, plan-media-db-split.md) — ghi qua `createMediaRecord('photo', ...)` (3 store), nhận `imageKey`
 * qua tham số (Rule 3).
 * @param {string} imageKey
 * @param {File|Blob} file - ảnh GỐC, Blob MỚI (không đọc từ IndexedDB).
 * @param {string} filename
 * @param {Blob} thumbBlob
 * @param {number} width @param {number} height - kích thước ảnh GỐC.
 * @param {number} duration - giây.
 * @returns {Promise<string>} imageKey
 */
async function saveImage(imageKey, file, filename, thumbBlob, width, height, duration) {
    await createMediaRecord('photo', imageKey, { blob: file, thumbBlob, width, height, duration, filename, addedAt: Date.now() }); // service/db.js
    console.log(`[saveImage] ghi ảnh "${imageKey}" (${filename}) vào 3 store media`);
    return imageKey;
}

/**
 * Ghi đè ảnh sau khi sửa ("Ghi đè" trong Edit mode), giữ nguyên `filename`/`addedAt`/folder/thống kê... Nhận cả
 * `thumbBlob`/`width`/`height`/`duration` MỚI (crop/rotate đổi cả kích thước lẫn nội dung).
 * SỬA (06/10/2026, plan-media-db-split.md) — 3 bước ghi riêng từng store: meta (kích thước/thời lượng — cũng là bước
 * kiểm tồn tại), file chính, thumb; không đọc lại record (Rule 3 + lỗi round-trip). Báo "đang dùng" là việc của
 * Workflow nơi gọi (request trung tâm `mediaInUse`).
 * @param {string} imageKey @param {Blob} newBlob @param {Blob} thumbBlob
 * @param {number} width @param {number} height @param {number} duration
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function updateImageBlob(imageKey, newBlob, thumbBlob, width, height, duration) {
    const metaResult = await updateMediaMeta('photo', imageKey, (meta) => ({ ...meta, width, height, duration })); // service/db.js
    if (metaResult.status === 'notFound') return { status: 'notFound' };
    await setMediaBlob('photo', imageKey, newBlob); // service/db.js
    await setMediaThumbs('photo', imageKey, { thumbBlob }); // service/db.js
    console.log(`[updateImageBlob] ghi đè ảnh "${imageKey}"`);
    return { status: 'ok' };
}

// XOÁ (02/10/2026, Giang duyệt) — `listImages()` (core TỰ ĐỌC DB — vi phạm Rule 3b; đọc MỖI record 1 transaction song
// song — thư viện lớn làm sập trang). Nơi gọi duy nhất (event/workflow/playlist-scope.js::PICKABLE_MEDIA_LISTER) giờ
// gọi thẳng `getAllImageRecords()` (service/db.js — 1 transaction, cursor).

/**
 * MỚI (29/07/2026, yêu cầu Giang — panel "Quản lý lưu trữ" MỚI, mục 2a "bổ sung thống kê dung
 * lượng Photo/Document vào thanh dung lượng") — mirror `computeVideoStats()` (core/file-manager/
 * video.js) — viết RIÊNG bản của Photo (Rule 3 cấm core gọi core, kể cả hàm "giống nhau" ở domain
 * khác).
 * @returns {Promise<{totalImages: number, totalBytes: number}>}
 */
async function computeImageStats() {
    const keys = await getAllImageKeys();
    let totalImages = 0, totalBytes = 0;
    for (const key of keys) {
        const record = await getImageRecord(key);
        if (!record || !record.blob) continue;
        totalImages++;
        totalBytes += record.blob.size + (record.thumbBlob ? record.thumbBlob.size : 0);
    }
    return { totalImages, totalBytes };
}

// ===================== Group theo ngày + Window ảo (Patch mục 1/2, 14/07/2026) ====================
// 2 hàm THUẦN dưới đây CHUẨN BỊ dữ liệu cho lưới ảnh Photo & Album — xem event/workflow/
// file-manager-photo.js::setupPhotoGridWindow() (Workflow gọi CẢ HAI, RỒI mới giao
// workflowPhotoGalleryWindow.mount() — event/workflow/photo-gallery-window.js) + core/
// file-manager/photo-ui.js (docstring đầu file, giải thích đầy đủ vì sao tách qua Workflow thay
// vì tự gọi nhau).

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
 * MỚI (rewrite Photo/Album, thay itemTemplateImageGridRow() đã xoá) — format nhãn header ngày hiển
 * thị phía trên mỗi nhóm ảnh (vd "Thứ Hai, 15 thg 7"). Theo `navigator.language` — tên thứ/tháng
 * không thuộc bộ key dịch `t()`/`tFormat()` hiện có, nên KHÔNG qua hệ i18n, dùng thẳng
 * `Intl.DateTimeFormat` (built-in JS, không phải DOM API — an toàn với Rule 1-4).
 * @param {number} addedAt - timestamp (ms) của 1 ảnh BẤT KỲ trong nhóm ngày đó.
 * @returns {string}
 */
function formatPhotoDayHeaderLabel(addedAt) {
    const d = new Date(addedAt || 0);
    const opts = { weekday: 'long', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return new Intl.DateTimeFormat(navigator.language, opts).format(d);
}

/**
 * Gom danh sách ảnh ĐÃ sắp xếp (sortImagesByAddedDateDesc()) thành các NHÓM THEO NGÀY — dùng làm
 * đơn vị windowing cấp NHÓM (KHÔNG phải cấp hàng/pixel) cho event/workflow/photo-gallery-window.js.
 *
 * ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa, dùng
 * thư viện") — THAY HẲN `buildPhotoGridRows()` (bản trước ở đây, tự cộng dồn width để đóng gói
 * TỪNG HÀNG — đúng nguồn gốc hàng loạt bug layout/lệch cuộn đã gặp). Giờ core CHỈ còn việc gom
 * nhóm theo ngày — việc "xếp ảnh vào đúng hàng, hàng cao bao nhiêu, ảnh nào rộng bao nhiêu" giao
 * HẲN cho fjGallery (thư viện thật, thuật toán Flickr/Google Photos, xem event/workflow/
 * photo-gallery-window.js) — core không tự tính toán layout nào nữa.
 *
 * Hàm THUẦN (Rule 1-4 core-function-conventions.md) — không appState, không DOM, không gọi core
 * khác (khoá ngày tính INLINE ngay trong vòng lặp, KHÔNG tách hàm riêng — tránh Core gọi Core).
 * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, filename:string, addedAt:number}>} sortedImages
 * @returns {Array<{dayKey:string, addedAt:number, images:Array}>}
 */
function groupImagesByDay(sortedImages) {
    const groups = [];
    let currentGroup = null;
    let lastDayKey = null;
    for (const image of sortedImages) {
        const d = new Date(image.addedAt || 0);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dayKey !== lastDayKey) {
            currentGroup = { dayKey, addedAt: image.addedAt, images: [] };
            groups.push(currentGroup);
            lastDayKey = dayKey;
        }
        currentGroup.images.push(image);
    }
    return groups;
}
