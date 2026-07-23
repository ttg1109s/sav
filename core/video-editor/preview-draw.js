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
 * này hay không tuỳ đang trong khoảng thời gian hiển thị hay không).
 *
 * [MỞ RỘNG, 23/07/2026, phản hồi Giang — "phông chữ Google, in đậm nghiêng, blur, shadow,
 * transition cơ bản, xoay/di chuyển 2 chiều"] — thêm `posX` (trước chỉ có `posY`, luôn canh giữa
 * ngang), `rotation` (độ), `bold`/`italic` (boolean), `fontFamily` (tên font đã nạp qua `<link>`
 * Google Fonts, xem video-editor.html head), `blur` (px, dùng `ctx.filter`), `shadow` (boolean,
 * bật/tắt đổ bóng cố định cũ), `transition` ('none'|'fade' — mờ dần 0.4s ở 2 đầu clip, cần
 * `outputTime` để tính).
 * @param {CanvasRenderingContext2D} ctx @param {number} outW @param {number} outH
 * @param {{val:string,size:number,color:string,posX:number,posY:number,rotation:number,bold:boolean,italic:boolean,fontFamily:string,blur:number,shadow:boolean,transition:string,timelineStart:number,timelineEnd:number}} text - posX/posY tính theo % (0-100).
 * @param {number} outputTime - giây OUTPUT hiện tại, dùng để tính độ mờ transition 'fade'.
 */
function drawTextOverlay(ctx, outW, outH, text, outputTime) {
    ctx.save();
    const scaleF = outH / 1080; // scale tương đối theo chiều cao canvas, khớp công thức video.txt
    const finalSize = Math.round((text.size || 60) * scaleF);
    const weight = text.bold ? 'bold' : 'normal';
    const style = text.italic ? 'italic' : 'normal';
    const family = text.fontFamily || 'system-ui';
    ctx.font = `${style} ${weight} ${finalSize}px "${family}", -apple-system, Inter, sans-serif`;
    ctx.fillStyle = text.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Transition — mờ dần 0.4s ở CẢ 2 đầu khoảng thời gian hiển thị clip (không mờ nếu clip quá ngắn).
    let alpha = 1;
    if (text.transition === 'fade' && outputTime !== undefined) {
        const FADE_SEC = 0.4;
        const clipDur = Math.max(0, text.timelineEnd - text.timelineStart);
        const fadeDur = Math.min(FADE_SEC, clipDur / 2);
        if (fadeDur > 0) {
            const distIn = outputTime - text.timelineStart;
            const distOut = text.timelineEnd - outputTime;
            alpha = Math.max(0, Math.min(1, Math.min(distIn, distOut) / fadeDur));
        }
    }
    ctx.globalAlpha = alpha;

    if (text.shadow !== false) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
    }
    if (text.blur > 0) ctx.filter = `blur(${Math.round(text.blur * scaleF)}px)`;

    const cx = outW * ((text.posX ?? 50) / 100);
    const cy = outH * ((text.posY ?? 80) / 100);
    ctx.translate(cx, cy);
    ctx.rotate(((text.rotation || 0) * Math.PI) / 180);
    ctx.fillText(text.val, 0, 0);
    ctx.restore();
}

/** Chuỗi CSS filter từ 3 giá trị slider (0-200%, brightness/contrast mặc định 50-150). */
function buildFilterCss(brightness, contrast, saturation) {
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
}

/**
 * [MỚI, audit event-bus-flow.md 23/07/2026 — chuyển từ event/listener/video-editor.js] Đổi toạ độ Y
 * trên MÀN HÌNH (`clientY`) thành toạ độ Y BÊN TRONG canvas theo ĐỘ PHÂN GIẢI THẬT (canvas.height),
 * KHÔNG phải kích thước hiển thị CSS (canvas bị co giãn qua `object-contain`) — dùng cho kéo Text
 * trực tiếp trên preview. Listener chỉ đọc DOM lấy 3 số (rectTop/rectHeight/canvasHeight) rồi gọi
 * hàm này — bản thân phép NHÂN/CHIA tỉ lệ là nghiệp vụ, không được để thẳng trong Listener.
 * @param {number} clientY @param {number} rectTop @param {number} rectHeight @param {number} canvasHeight
 * @returns {number}
 */
function computeCanvasYFromClientY(clientY, rectTop, rectHeight, canvasHeight) {
    const scaleY = rectHeight > 0 ? canvasHeight / rectHeight : 1;
    return (clientY - rectTop) * scaleY;
}

/** Đối xứng `computeCanvasYFromClientY()` — trục X. */
function computeCanvasXFromClientX(clientX, rectLeft, rectWidth, canvasWidth) {
    const scaleX = rectWidth > 0 ? canvasWidth / rectWidth : 1;
    return (clientX - rectLeft) * scaleX;
}

/**
 * [MỚI, 23/07/2026, phản hồi Giang — "co giãn kích cỡ, xoay Text trên preview"] Tính size/rotation
 * MỚI của 1 clip Chữ từ cử chỉ 2 ngón (pinch — khoảng cách đổi = scale, góc đổi = xoay). Nhận
 * khoảng cách/góc LÚC BẮT ĐẦU cử chỉ + LÚC HIỆN TẠI (Listener tự tính từ toạ độ 2 pointer, xem
 * event/listener/video-editor.js) + size/rotation GỐC (lúc bắt đầu cử chỉ) — trả về giá trị MỚI,
 * KHÔNG mutate gì (Workflow tự gán lại vào clip).
 * @param {number} startDist @param {number} startAngleDeg @param {number} currentDist @param {number} currentAngleDeg
 * @param {number} baseSize @param {number} baseRotation
 * @returns {{newSize:number, newRotation:number}}
 */
function computePinchTransform(startDist, startAngleDeg, currentDist, currentAngleDeg, baseSize, baseRotation) {
    const scaleRatio = startDist > 0 ? currentDist / startDist : 1;
    const newSize = Math.max(10, Math.min(300, Math.round(baseSize * scaleRatio)));
    const newRotation = Math.round(baseRotation + (currentAngleDeg - startAngleDeg));
    return { newSize, newRotation };
}

/** Khoảng cách giữa 2 điểm màn hình (px) — dùng cho cử chỉ pinch 2 ngón (Listener tự tính từ toạ độ 2 pointer trước khi gọi Workflow). */
function computeDistanceBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** Góc (độ) của đường nối 2 điểm màn hình — dùng cho cử chỉ pinch 2 ngón (xoay Text). */
function computeAngleBetweenPoints(x1, y1, x2, y2) {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}
