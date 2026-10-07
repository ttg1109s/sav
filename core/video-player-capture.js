/**
 * core/video-player-capture.js — DI DỜI từ core/video-editor/frame-extract.js (xoá file cũ, xoá
 * dòng <script> tương ứng thủ công). Trước đây phục vụ nút "Trích xuất ảnh" trong modal Video
 * Preview (đã bỏ hẳn — xem event/workflow/video-preview.js). Giờ CHỈ còn 1 nơi dùng:
 * workflowVideoPlayer.captureCurrentFrame() (Control Center, chụp khung hình `bgVideoElement`
 * đang phát) — không nhân bản logic, chuyển thẳng thay vì viết bản thứ 2.
 *
 * Core THUẦN (Rule 1-5) — 3 hàm đơn tuyến, độc lập, chỉ dùng Canvas/DOM API chuẩn. Lưu ảnh tái
 * dùng THẲNG core/file-manager/image.js::saveImage() (Workflow gọi).
 */

/** Chụp khung hình HIỆN TẠI của 1 thẻ `<video>` ra canvas mới, đúng độ phân giải gốc.
 * @param {HTMLVideoElement} videoEl
 * @returns {HTMLCanvasElement} */
function captureVideoFrameToCanvas(videoEl) {
    const canvas = document.createElement('canvas'); // canvas nội bộ, không gắn DOM — chỉ là bộ đệm pixel
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/** Resize xuống làm thumbnail cho lưới Photo & Album — cùng công thức THUMBNAIL_SCALE_RATIO (0.2)
 * ở event/workflow/file-manager-photo.js.
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {number} scaleRatio
 * @returns {Promise<Blob|null>} */
function buildExtractedPhotoThumbnail(sourceCanvas, scaleRatio) {
    const targetWidth = Math.max(1, Math.round(sourceCanvas.width * scaleRatio));
    const targetHeight = Math.max(1, Math.round(sourceCanvas.height * scaleRatio));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = targetWidth;
    thumbCanvas.height = targetHeight;
    thumbCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return new Promise((resolve) => thumbCanvas.toBlob(resolve, 'image/jpeg', 0.9));
}

/** Sinh tên file "ngàythángnămgiờphútgiây_random 5 ký tự", không gồm phần mở rộng.
 * @param {Date} [date]
 * @returns {string} */
function buildExtractedPhotoFilename(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${pad(date.getDate())}${pad(date.getMonth() + 1)}${date.getFullYear()}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 5; i++) randomPart += chars[Math.floor(Math.random() * chars.length)];
    return `${datePart}_${randomPart}`;
}

/** MỚI (07/10/2026, cổng seek v3 cho Video — đóng băng khung hình) — chụp khung hiện tại của `<video>` ra canvas, thu nhỏ
 * để cạnh dài nhất ≤ `maxSidePx` (giữ tỉ lệ; video nhỏ hơn thì giữ nguyên). Khung đóng băng chỉ hiện vài trăm ms trong lúc
 * cổng nạp lại nguồn — không cần full-res 4K, thu nhỏ để mã hoá JPEG nhanh.
 * @param {HTMLVideoElement} videoEl @param {number} maxSidePx @returns {HTMLCanvasElement} */
function captureVideoFrameToCanvasMaxSide(videoEl, maxSidePx) {
    const scale = Math.min(1, maxSidePx / Math.max(videoEl.videoWidth, videoEl.videoHeight));
    const canvas = document.createElement('canvas'); // canvas nội bộ, không gắn DOM
    canvas.width = Math.max(1, Math.round(videoEl.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(videoEl.videoHeight * scale));
    canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/** MỚI (07/10/2026) — mã hoá canvas ra JPEG. @param {HTMLCanvasElement} canvas @param {number} quality 0..1
 * @returns {Promise<Blob|null>} */
function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}
