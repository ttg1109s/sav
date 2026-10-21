/**
 * core/video-player-capture.js — chụp/đo khung hình của `<video>` trên canvas nội bộ (không gắn DOM — chỉ là bộ đệm pixel):
 * chụp khung hiện tại thành ảnh mới (workflowVideoFrameCapture), khung đóng băng của cổng seek Video (workflowVideoPlayer),
 * thumb khung đầu + thumb vuông lúc nạp video (workflowVideoThumbExtract), mã hoá JPEG. Nạp ở index.html và video-editor.html.
 * Lưu ảnh: core/file-manager/image.js::saveImage() (Workflow gọi).
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

/** Khung đóng băng của cổng seek Video — chụp khung hiện tại của `<video>` ra canvas, thu nhỏ
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

/** Mã hoá canvas ra JPEG. @param {HTMLCanvasElement} canvas @param {number} quality 0..1 @returns {Promise<Blob|null>} */
function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Mã hoá canvas ra JPEG rồi thu canvas về 0 (giải phóng bộ nhớ — Safari giữ canvas rất lâu).
 * @param {HTMLCanvasElement} canvas @param {number} quality 0..1 @returns {Promise<Blob|null>} */
function canvasToJpegBlobReleased(canvas, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            canvas.width = 0; canvas.height = 0;
            resolve(blob);
        }, 'image/jpeg', quality);
    });
}

/** Thu canvas về 0×0 (giải phóng bộ nhớ). null vô hại. @param {HTMLCanvasElement|null} canvas */
function releaseCanvas(canvas) {
    if (!canvas) return; // guard
    canvas.width = 0; canvas.height = 0;
}

// ===== Thumb lúc nạp video (event/workflow/video-thumb-extract.js) =====

/**
 * Đo khung HIỆN TẠI của `source` (`<video>`, hoặc `<img>` đã decode — scan thumb cũ) trên canvas nhỏ `size`×`size`.
 * `drawn=false` khi không vẽ được gì (drawImage ném lỗi, hoặc mọi pixel alpha=0 — theo spec `drawImage()` không vẽ gì nếu video
 * chưa có khung); `isBlack=true` khi ≥ `blackRatio` số pixel có luma ≤ `blackLuma`. Không đọc được pixel (getImageData lỗi)
 * -> coi như vẽ được + không đen (không đủ dữ kiện để từ chối).
 * @param {CanvasImageSource} source @param {number} size @param {number} blackLuma @param {number} blackRatio
 * @returns {{drawn: boolean, isBlack: boolean}}
 */
function probeDrawableFrame(source, size, blackLuma, blackRatio) {
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = size; probeCanvas.height = size;
    let drawn = false, isBlack = false;
    let data = null;
    try {
        const ctx = probeCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, size, size);
        try { data = ctx.getImageData(0, 0, size, size).data; }
        catch (readErr) { drawn = true; } // vẽ được nhưng không đo được
    } catch (drawErr) { drawn = false; } // Firefox/Safari có thể ném lỗi khi video chưa có khung
    if (data) {
        let blackPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) drawn = true;
            const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
            if (luma <= blackLuma) blackPixels++;
        }
        isBlack = drawn && (blackPixels / (size * size)) >= blackRatio;
    }
    probeCanvas.width = 0; probeCanvas.height = 0;
    return { drawn, isBlack };
}

/** Chụp full-res khung HIỆN TẠI (đồng bộ — nơi gọi đo bằng probeDrawableFrame() trong cùng tick). Giữ kích thước gốc, chỉ
 * thu nhỏ đều nếu vượt `maxPixels` (trần diện tích canvas Safari/iOS). Vẽ lỗi -> giải phóng canvas, `drawn=false`.
 * @param {HTMLVideoElement} videoEl @param {number} width @param {number} height @param {number} maxPixels
 * @param {boolean} isBlack - kết quả đo, trả kèm @returns {{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement|null}} */
function drawVideoFrameFull(videoEl, width, height, maxPixels, isBlack) {
    const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    try {
        canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    } catch (err) {
        canvas.width = 0; canvas.height = 0;
        return { drawn: false, isBlack: false, canvas: null };
    }
    return { drawn: true, isBlack, canvas };
}

/** Thumb VUÔNG center-crop `size`×`size` từ khung hiện tại. Vẽ lỗi -> null (canvas đã giải phóng).
 * @param {HTMLVideoElement} videoEl @param {number} size @returns {HTMLCanvasElement|null} */
function drawVideoSquareThumb(videoEl, size) {
    const width = videoEl.videoWidth, height = videoEl.videoHeight;
    const side = Math.min(width, height);
    const sx = (width - side) / 2, sy = (height - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    try {
        canvas.getContext('2d').drawImage(videoEl, sx, sy, side, side, 0, 0, size, size);
    } catch (err) {
        canvas.width = 0; canvas.height = 0;
        return null;
    }
    return canvas;
}

/** Media đã đứng đúng mốc chưa (không có 'seeked' để đợi). @param {number} currentSec @param {number} targetSec @returns {boolean} */
function isAtMediaTime(currentSec, targetSec) {
    return Math.abs(currentSec - targetSec) < 0.0001;
}

/** Mốc chụp thumb vuông: min(1 s, nửa thời lượng). @param {number} durationSec @returns {number} */
function computeSquareThumbTimeSec(durationSec) {
    return Math.min(1, durationSec / 2 || 0);
}

/** Media đã có khung hiện tại (readyState ≥ HAVE_CURRENT_DATA). @param {number} readyState @returns {boolean} */
function hasMediaCurrentFrame(readyState) {
    return readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

/** Phân loại 1 lần chụp. @param {{drawn: boolean, isBlack: boolean}|null} grab @returns {'none'|'black'|'ok'} */
function classifyFrameGrab(grab) {
    if (!grab || !grab.drawn) return 'none';
    return grab.isBlack ? 'black' : 'ok';
}

/** Đen đủ số lần (mà vẫn vẽ được) = đen THẬT (fade-in...). @param {number} blackCount @param {number} confirmCount @returns {boolean} */
function isBlackFrameConfirmed(blackCount, confirmCount) {
    return blackCount >= confirmCount;
}

/** Khung requestVideoFrameCallback vừa present còn là khung ĐẦU không (`mediaTime` không quá mốc).
 * @param {{mediaTime?: number}|undefined} metadata @param {number} maxMediaTimeSec @returns {boolean} */
function isFirstPresentedFrame(metadata, maxMediaTimeSec) {
    return !(metadata && metadata.mediaTime > maxMediaTimeSec);
}

/** Bước của 1 lần thử ở đường dự phòng: có khung -> 'grab'; chưa, và chưa "nhá" play() lần nào -> 'nudge' (iOS không tải
 * khung nếu chưa play); còn lại 'wait'. @param {boolean} hasFrame @param {boolean} nudged @returns {'grab'|'nudge'|'wait'} */
function resolveFirstFrameRetryStep(hasFrame, nudged) {
    if (hasFrame) return 'grab';
    return nudged ? 'wait' : 'nudge';
}
