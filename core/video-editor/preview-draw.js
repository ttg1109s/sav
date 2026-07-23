/**
 * core/video-editor/preview-draw.js — Core THUẦN (Rule 1-4 core-function-conventions.md), MỚI (v2,
 * 23/07/2026). Vẽ preview LIVE (canvas) từ thẻ `<video>` đang phát — THAY cho CSS transform/filter
 * áp thẳng lên `<video>` của bản Batch 1 cũ (bắt buộc đổi vì preview giờ là canvas, không còn
 * `<video controls>` native — xem plan mục 0.2).
 *
 * KHÁC `core/video-editor/webcodecs-engine.js::_drawFrameToCanvas()` (vẽ từ VideoSample lúc ENCODE
 * thật) — file NÀY vẽ từ `HTMLVideoElement` lúc XEM TRƯỚC (mỗi frame, `<video>` đang chạy tự nhiên).
 * Cùng công thức toạ độ (translate/rotate/translate) để preview khớp CHÍNH XÁC kết quả xuất thật.
 *
 * Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác của project (Canvas API chuẩn).
 */

/** Vùng crop theo PX (từ tỉ lệ 0-1) so với kích thước gốc video. @returns {{x,y,w,h}} */
function computeCropPixels(cropFraction, nativeW, nativeH) {
    return cropFraction
        ? { x: Math.round(cropFraction.x * nativeW), y: Math.round(cropFraction.y * nativeH), w: Math.round(cropFraction.w * nativeW), h: Math.round(cropFraction.h * nativeH) }
        : { x: 0, y: 0, w: nativeW, h: nativeH };
}

/** Kích thước canvas ĐÍCH sau khi xoay (đổi chiều rộng/cao ở 90°/270°). @returns {{outW,outH,deg}} */
function computeRotatedOutputSize(cropPx, rotateDeg) {
    const deg = ((rotateDeg % 360) + 360) % 360;
    const isSideways = deg === 90 || deg === 270;
    return { outW: isSideways ? cropPx.h : cropPx.w, outH: isSideways ? cropPx.w : cropPx.h, deg };
}

/**
 * Vẽ ĐÚNG 1 khung hình hiện tại của `<video>` vào canvas đích, áp crop+rotate+filter cùng lúc.
 * @param {CanvasRenderingContext2D} ctx @param {HTMLVideoElement} videoEl
 * @param {{x,y,w,h}} cropPx @param {number} rotateDeg @param {string} filterCss
 * @param {number} outW @param {number} outH
 */
function drawVideoPreviewFrame(ctx, videoEl, cropPx, rotateDeg, filterCss, outW, outH) {
    if (!videoEl.videoWidth) return; // guard — video chưa có khung hình nào để vẽ
    ctx.save();
    ctx.clearRect(0, 0, outW, outH);
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.translate(-cropPx.w / 2, -cropPx.h / 2);
    ctx.translate(-cropPx.x, -cropPx.y);
    ctx.filter = filterCss || 'none';
    ctx.drawImage(videoEl, 0, 0, videoEl.videoWidth, videoEl.videoHeight);
    ctx.restore();
}

/**
 * Vẽ đè lớp chữ (Text overlay) lên canvas — gọi SAU `drawVideoPreviewFrame()`, KHÔNG gộp chung 1
 * hàm (2 tiến trình độc lập: vẽ khung hình vs vẽ chữ — Rule 1, Workflow tự quyết định có gọi hàm
 * này hay không tuỳ `textOverlay.active` + đang trong khoảng thời gian hiển thị hay không).
 * @param {CanvasRenderingContext2D} ctx @param {number} outW @param {number} outH
 * @param {{val:string,size:number,color:string,posY:number}} text - posY tính theo % (0-100).
 */
function drawTextOverlay(ctx, outW, outH, text) {
    ctx.save();
    const scaleF = outH / 1080; // scale tương đối theo chiều cao canvas, khớp công thức video.txt
    const finalSize = Math.round(text.size * scaleF);
    ctx.font = `bold ${finalSize}px -apple-system, Inter, sans-serif`;
    ctx.fillStyle = text.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText(text.val, outW / 2, outH * (text.posY / 100));
    ctx.restore();
}

/** Chuỗi CSS filter từ 3 giá trị slider (0-200%, brightness/contrast mặc định 50-150). */
function buildFilterCss(brightness, contrast, saturation) {
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
}
