/**
 * core/file-manager/image.js — Ảnh trong thư viện: ghi record, thống kê, gom nhóm ngày cho lưới, chọn object-fit xem
 * ảnh. Record (3 store media, xem readme/db-schema.md): { blob, thumbBlob, width, height, duration, filename, addedAt }.
 *   - `thumbBlob`: ảnh resize lúc upload (event/workflow/file-manager-photo.js::resizeImageForThumbnail()) cho lưới.
 *   - `width`/`height`: kích thước gốc — attribute của `<img>` để fjGallery tính tỉ lệ trước khi ảnh tải xong.
 *   - `duration`: giây (computePhotoDurationSec() dưới; Workflow tính SHA-256 rồi truyền vào — event/workflow/photo-duration.js).
 * Record cũ có thể thiếu 4 field trên — nơi đọc tự fallback (`thumbBlob || blob`, `width > 0 ? … : 1`).
 * Xoá ảnh: `deleteMediaRecord('photo', …)` (service/db.js).
 *
 * NẠP SAU: service/db.js (createMediaRecord/updateMediaMeta/setMediaBlob/setMediaThumbs).
 */

// Thời lượng ảnh — tuyến tính theo weight, KHÔNG trần (Giang chốt "không kẹp max"). DURATION_MIN_SEC là sàn, cũng là
// thời lượng mặc định cho record cũ thiếu field (event/workflow/photo-player.js, picker sửa duration ở playlist.js).
const DURATION_MIN_SEC = 5;
const DURATION_PIXEL_WEIGHT = 2;            // 1 pixel ảnh gốc "nặng" bằng bao nhiêu byte
const DURATION_PER_WEIGHT_SEC = 0.00000125; // giây cộng thêm cho mỗi byte-tương-đương
const DURATION_JITTER_SEC = 0.4;            // jitter tối đa từ SHA-256 — chỉ phá trùng số giữa 2 ảnh cùng weight, không đảo thứ tự

/**
 * Thời lượng (giây, 2 chữ số thập phân) deterministic từ chính file:
 * `DURATION_MIN_SEC + (fileSize + DURATION_PIXEL_WEIGHT × width × height) × DURATION_PER_WEIGHT_SEC + jitter`, jitter lấy từ
 * 4 byte đầu SHA-256 (không có digest -> 0).
 * @param {number} fileSize - byte ảnh GỐC @param {number} width @param {number} height
 * @param {ArrayBuffer|null} digestBuffer - SHA-256 của file, null khi không tính được
 * @returns {number}
 */
function computePhotoDurationSec(fileSize, width, height, digestBuffer) {
    const weight = fileSize + DURATION_PIXEL_WEIGHT * (width * height);
    const jitter = digestBuffer ? (new DataView(digestBuffer).getUint32(0) / 4294967295) * DURATION_JITTER_SEC : 0;
    return Math.round((DURATION_MIN_SEC + weight * DURATION_PER_WEIGHT_SEC + jitter) * 100) / 100;
}

/**
 * Lưu 1 ảnh mới (hoặc ghi đè trọn nếu trùng filename — key do Workflow resolve qua `resolveImageKey()`, service/db.js).
 * `thumbBlob`/`width`/`height`/`duration` tính sẵn ở Workflow.
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
 * Ghi đè ảnh sau khi sửa ("Ghi đè" trong Edit), giữ `filename`/`addedAt`/folder/thống kê. Ghi riêng từng store: meta
 * (kích thước/thời lượng — cũng là bước kiểm tồn tại), file chính, thumb. Báo "đang dùng" là việc của Workflow nơi gọi
 * (`mediaInUse`).
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

/**
 * Thống kê Photo (số lượng, dung lượng) từ record Workflow đã đọc (getAllImageRecords()). Bỏ qua record thiếu Blob.
 * @param {Array<object>} records
 * @returns {{totalImages: number, totalBytes: number}}
 */
function summarizeImageLibrary(records) {
    const valid = records.filter((record) => record && record.blob);
    return {
        totalImages: valid.length,
        totalBytes: valid.reduce((sum, record) => sum + record.blob.size + (record.thumbBlob ? record.thumbBlob.size : 0), 0),
    };
}

// ===================== Gom nhóm ngày cho lưới (event/workflow/photo-gallery-window.js) =====================

/**
 * Sắp xếp ảnh theo `addedAt` mới nhất lên đầu (không mutate mảng gốc).
 * @param {Array<{key:string, blob:Blob, filename:string, addedAt:number}>} images
 * @returns {Array} bản sao MỚI đã sắp xếp
 */
function sortImagesByAddedDateDesc(images) {
    return [...images].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

/**
 * Nhãn header ngày phía trên mỗi nhóm ảnh (vd "Thứ Hai, 15 thg 7") — theo `navigator.language` qua
 * `Intl.DateTimeFormat` (tên thứ/tháng không thuộc bộ key dịch).
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
 * Gom ảnh đã sắp xếp thành các nhóm theo ngày — đơn vị windowing của lưới (layout trong nhóm do fjGallery lo).
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

/** Ảnh cùng hướng màn hình (cùng ngang/cùng dọc) -> 'cover' (chỉ cắt rất ít), lệch hướng -> 'contain' (hiện trọn ảnh).
 * Dùng chung cho `<img>` xem tạm và 4 canvas Edit của modal xem ảnh.
 * @param {number} naturalW @param {number} naturalH - kích thước gốc ảnh (0 = chưa có)
 * @param {number} viewW @param {number} viewH - kích thước màn hình
 * @returns {'cover'|'contain'|null} null khi chưa có kích thước ảnh */
function computeCoverOrContain(naturalW, naturalH, viewW, viewH) {
    if (!naturalW || !naturalH) return null;
    return ((naturalW >= naturalH) === (viewW >= viewH)) ? 'cover' : 'contain';
}
