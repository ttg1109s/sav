/**
 * core/video-editor/frame-extract.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI
 * (Batch 2, module Video Editor — chức năng "Trích xuất ảnh"). 3 hàm đơn tuyến, độc lập nhau, đều
 * nhận tham số qua đối số (Rule 2 — không đọc `appState`), không gọi core nào khác của project
 * (Rule 3 — chỉ dùng DOM/Canvas API chuẩn của trình duyệt).
 *
 * Lưu ảnh trích xuất TÁI DÙNG THẲNG `core/file-manager/image.js::saveImage()` (Workflow tự gọi,
 * xem `event/workflow/video-editor.js::handleExtractFrame()`) — file này CHỈ lo phần "tạo ra dữ
 * liệu ảnh" (canvas/blob/tên file), KHÔNG tự lưu DB (đúng Rule 1 — 1 core = 1 việc).
 */

/**
 * Chụp khung hình HIỆN TẠI của thẻ `<video>` ra 1 canvas MỚI, ĐÚNG độ phân giải gốc của video
 * (KHÔNG resize) — "chất lượng gốc" theo yêu cầu. Canvas này dùng để xuất CẢ blob ảnh chính LẪN
 * thumbnail (`buildExtractedPhotoThumbnail()`), tránh decode lại 2 lần.
 * @param {HTMLVideoElement} videoEl
 * @returns {HTMLCanvasElement}
 */
function captureVideoFrameToCanvas(videoEl) {
    const canvas = document.createElement('canvas'); // canvas nội bộ, KHÔNG gắn DOM — chỉ làm bộ đệm pixel, không phải "dựng UI" (Rule 5 không áp dụng)
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/**
 * Resize xuống làm thumbnail cho lưới Photo & Album — CÙNG CÔNG THỨC `THUMBNAIL_SCALE_RATIO`
 * (0.2) đã dùng ở `event/workflow/file-manager-photo.js` — 2 nơi PHẢI ra kết quả tương đương (đổi
 * 1 trong 2 chỗ PHẢI đổi luôn chỗ kia, mỗi trang là 1 bundle độc lập nên không import chung hằng
 * số được).
 * @param {HTMLCanvasElement} sourceCanvas - từ `captureVideoFrameToCanvas()`.
 * @param {number} scaleRatio
 * @returns {Promise<Blob|null>}
 */
function buildExtractedPhotoThumbnail(sourceCanvas, scaleRatio) {
    const targetWidth = Math.max(1, Math.round(sourceCanvas.width * scaleRatio));
    const targetHeight = Math.max(1, Math.round(sourceCanvas.height * scaleRatio));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = targetWidth;
    thumbCanvas.height = targetHeight;
    thumbCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    return new Promise((resolve) => thumbCanvas.toBlob(resolve, 'image/jpeg', 0.9));
}

/**
 * Sinh tên file theo ĐÚNG định dạng Giang yêu cầu: "ngày tháng năm giờ phút giây_random chuỗi 5 ký
 * tự" — vd 22072026143005_a8k3f (không có phần mở rộng, nơi gọi tự thêm ".jpg").
 * @param {Date} [date] - mặc định thời điểm hiện tại.
 * @returns {string}
 */
function buildExtractedPhotoFilename(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${pad(date.getDate())}${pad(date.getMonth() + 1)}${date.getFullYear()}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < 5; i++) randomPart += chars[Math.floor(Math.random() * chars.length)];
    return `${datePart}_${randomPart}`;
}
