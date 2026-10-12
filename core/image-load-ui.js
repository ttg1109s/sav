/**
 * core/image-load-ui.js — tải/giải mã ảnh và vẽ thu nhỏ ra Blob, dùng chung cho Workflow (thumbnail Photo lúc upload/
 * lưu sửa ảnh, quét thumb video ở Storage, ảnh nền mặt Clock). Giải mã bằng `img.decode()` (Promise của trình duyệt) —
 * KHÔNG gắn onload/onerror. Không đọc appState, không gọi core khác.
 */

/** Tải + giải mã 1 URL ảnh (object URL hoặc URL thường). `decode()` có thể reject dù ảnh đã tải xong (vd ảnh rất
 * lớn trên Safari) -> chỉ coi là hỏng khi không có kích thước.
 * @param {string} url @returns {Promise<HTMLImageElement|null>} null = không tải/giải mã được */
async function decodeImageFromUrl(url) {
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch (err) { /* xét kích thước bên dưới */ }
    return img.naturalWidth > 0 ? img : null;
}

/** Vẽ ảnh thu nhỏ CẢ 2 chiều theo `scaleRatio` (giữ tỉ lệ, tối thiểu 1px) ra Blob JPEG.
 * @param {HTMLImageElement} img @param {number} scaleRatio @param {number} quality
 * @returns {Promise<Blob|null>} null = canvas.toBlob trả về null */
function renderImageScaledToJpegBlob(img, scaleRatio, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scaleRatio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scaleRatio));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Nhả bộ nhớ ảnh đã giải mã (bỏ `src`) — dùng khi quét nhiều ảnh liên tiếp. @param {HTMLImageElement|null} img */
function releaseDecodedImage(img) {
    if (!img) return;
    img.removeAttribute('src');
}
