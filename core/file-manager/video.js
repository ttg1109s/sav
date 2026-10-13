/**
 * core/file-manager/video.js — Video trong thư viện: ghi record, thống kê, gom nhóm ngày cho lưới, định dạng tên/thời
 * lượng. Record (3 store media, xem readme/db-schema.md): { blob, thumbBlob, thumbFullBlob, width, height, duration,
 * filename, addedAt, customName, thumbFullBlack }.
 *   - `thumbBlob`: khung vuông `VIDEO_THUMBNAIL_SIZE` chụp tại giây `min(1, duration/2)` — cho lưới/cover.
 *   - `thumbFullBlob`: khung đầu (time=0) đúng kích thước gốc; `null` với video cũ hoặc khi toBlob() lỗi — không chặn
 *     phát/hiển thị.
 *   - `thumbFullBlack`: khung đầu đã chụp đúng nhưng đen thật (fade-in…) — Scan broken bỏ qua record có cờ này.
 *   - `customName`: tên hiển thị người dùng đặt, chỉ trong app (download vẫn theo `filename`); không có thì hiển thị
 *     `stripFileExtension(filename)`.
 * Thumb/kích thước/thời lượng do Workflow đo lúc upload (cần `<video>`/canvas). Xoá video: Workflow gỡ khỏi folder rồi
 * `deleteMediaRecord()` (service/db.js).
 *
 * NẠP SAU: service/db.js (createMediaRecord/updateMediaMeta/setMediaBlob/setMediaThumbs).
 */

/**
 * Lưu 1 video mới (hoặc ghi đè trọn nếu trùng filename — key do Workflow resolve qua `resolveVideoKey()`, service/db.js).
 * Thumb/kích thước/thời lượng tính sẵn ở Workflow (event/workflow/playlist.js::extractVideoThumbAndMeta()).
 * @param {string} videoKey
 * @param {File|Blob} file - blob video GỐC (không resize), Blob MỚI (không đọc từ IndexedDB).
 * @param {string} filename
 * @param {Blob} thumbBlob - khung hình center-crop vuông + resize, dùng cho lưới/cover.
 * @param {number} width @param {number} height - kích thước video GỐC (px).
 * @param {number} duration - giây.
 * @param {Blob} [thumbFullBlob] - khung đầu tiên full resolution (`null` nếu không có).
 * @param {boolean} [thumbFullIsBlack] - khung đầu đen THẬT, xem docstring đầu file.
 * @returns {Promise<string>} videoKey
 */
async function saveVideo(videoKey, file, filename, thumbBlob, width, height, duration, thumbFullBlob, thumbFullIsBlack) {
    await createMediaRecord('video', videoKey, { // service/db.js
        blob: file, thumbBlob, thumbFullBlob: thumbFullBlob || null, width, height, duration, filename, addedAt: Date.now(),
        customName: null,
        thumbFullBlack: !!thumbFullIsBlack,
    });
    console.log(`[saveVideo] ghi video "${videoKey}" (${filename}) vào 3 store media`);
    return videoKey;
}

/**
 * Thay thumb của 1 video đã có (Storage → Scan broken → "Sửa file lỗi"; Workflow chụp thumb mới trước). Cờ
 * `thumbFullBlack` ghi qua `updateMediaMeta()` (cũng là bước kiểm tồn tại), 2 thumb qua `setMediaThumbs()`.
 * @param {string} videoKey
 * @param {Blob} thumbBlob
 * @param {Blob} thumbFullBlob
 * @param {boolean} [thumbFullIsBlack]
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setVideoThumbnails(videoKey, thumbBlob, thumbFullBlob, thumbFullIsBlack) {
    const metaResult = await updateMediaMeta('video', videoKey, (meta) => ({ ...meta, thumbFullBlack: !!thumbFullIsBlack })); // service/db.js
    if (metaResult.status === 'notFound') return { status: 'notFound' };
    await setMediaThumbs('video', videoKey, { thumbBlob, thumbFullBlob: thumbFullBlob || null }); // service/db.js
    console.log(`[setVideoThumbnails] ghi thumb mới cho video "${videoKey}"`);
    return { status: 'ok' };
}

/**
 * Thay nội dung media của 1 video đã có ("Lưu đè" từ trình sửa Video), giữ mọi field khác (tên riêng, ngày thêm,
 * folder, thống kê…). Ghi riêng từng store: meta (cũng là bước kiểm tồn tại), file chính, thumb. Báo "đang dùng" là
 * việc của Workflow nơi gọi (`mediaInUse`).
 * @param {string} videoKey
 * @param {{blob: Blob, thumbBlob: Blob, thumbFullBlob: (Blob|null), thumbFullIsBlack: boolean, width: number, height: number, duration: number}} media
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function replaceVideoMedia(videoKey, media) {
    const metaResult = await updateMediaMeta('video', videoKey, (meta) => ({ // service/db.js
        ...meta,
        thumbFullBlack: !!media.thumbFullIsBlack,
        width: media.width,
        height: media.height,
        duration: media.duration,
    }));
    if (metaResult.status === 'notFound') return { status: 'notFound' };
    await setMediaBlob('video', videoKey, media.blob); // service/db.js
    await setMediaThumbs('video', videoKey, { thumbBlob: media.thumbBlob, thumbFullBlob: media.thumbFullBlob || null }); // service/db.js
    console.log(`[replaceVideoMedia] ghi đè media video "${videoKey}" (giữ nguyên tên riêng/ngày thêm)`);
    return { status: 'ok' };
}

/**
 * Thống kê Video (số lượng, dung lượng gồm cả 2 thumb) từ record Workflow đã đọc (getAllVideoRecords()). Bỏ qua record
 * thiếu Blob.
 * @param {Array<object>} records
 * @returns {{totalVideos: number, totalBytes: number}}
 */
function summarizeVideoLibrary(records) {
    const valid = records.filter((record) => record && record.blob);
    return {
        totalVideos: valid.length,
        totalBytes: valid.reduce((sum, record) => sum + record.blob.size + (record.thumbBlob ? record.thumbBlob.size : 0) + (record.thumbFullBlob ? record.thumbFullBlob.size : 0), 0),
    };
}

// ===================== Gom nhóm ngày cho lưới (event/workflow/video-gallery-window.js) =====================
// Trùng logic bản Photo (core/file-manager/image.js) — viết riêng vì core không gọi core.

/**
 * Sắp xếp danh sách video theo `addedAt` MỚI NHẤT lên đầu. Hàm THUẦN — không mutate mảng gốc.
 * @param {Array<{key:string, addedAt:number}>} videos
 * @returns {Array} bản sao MỚI đã sắp xếp
 */
function sortVideosByAddedDateDesc(videos) {
    return [...videos].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

/** Format nhãn header ngày hiển thị phía trên mỗi nhóm video (vd "Thứ Hai, 15 thg 7") — theo
 * `navigator.language`, dùng `Intl.DateTimeFormat` (built-in JS, không phải DOM API).
 * @param {number} addedAt - timestamp (ms) của 1 video BẤT KỲ trong nhóm ngày đó.
 * @returns {string}
 */
function formatVideoDayHeaderLabel(addedAt) {
    const d = new Date(addedAt || 0);
    const opts = { weekday: 'long', day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return new Intl.DateTimeFormat(navigator.language, opts).format(d);
}

/**
 * Gom danh sách video ĐÃ sắp xếp (sortVideosByAddedDateDesc()) thành các NHÓM THEO NGÀY — đơn vị
 * windowing cấp NHÓM (IntersectionObserver) cho event/workflow/video-gallery-window.js. Hàm THUẦN.
 * @param {Array<{key:string, addedAt:number}>} sortedVideos
 * @returns {Array<{dayKey:string, addedAt:number, videos:Array}>}
 */
function groupVideosByDay(sortedVideos) {
    const groups = [];
    let currentGroup = null;
    let lastDayKey = null;
    for (const video of sortedVideos) {
        const d = new Date(video.addedAt || 0);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dayKey !== lastDayKey) {
            currentGroup = { dayKey, addedAt: video.addedAt, videos: [] };
            groups.push(currentGroup);
            lastDayKey = dayKey;
        }
        currentGroup.videos.push(video);
    }
    return groups;
}

/**
 * Bỏ đuôi mở rộng khỏi filename — tên hiển thị mặc định khi chưa đặt customName.
 * @param {string} filename
 * @returns {string}
 */
function stripFileExtension(filename) {
    if (!filename) return '';
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Format số giây thành "m:ss" (vd 75 -> "1:15").
 * @param {number} seconds
 * @returns {string}
 */
function formatVideoDuration(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}
