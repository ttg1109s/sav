/**
 * core/crop-selector.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI (31/07/2026).
 *
 * Cơ chế CHỌN vùng crop tương tác (khung + 4 handle góc + lưới rule-of-thirds, kéo tay resize/di
 * chuyển, khoá tỉ lệ khung hình tuỳ chọn) — DÙNG CHUNG giữa Photo Edit mode
 * (event/workflow/file-manager-photo.js) và Video Editor (event/workflow/video-editor.js). THAY
 * THẾ Cropper.js/core/image-editor/cropper-engine.js cho CẢ 2 nơi này (Giang chốt 31/07/2026:
 * "tái sử dụng, không dùng hai thứ lại cùng tính năng và logic") — cropper-engine.js CHỈ còn
 * image-edit.html dùng (trang đang chờ xoá, xem plan riêng — CHƯA đụng ở đây).
 *
 * SESSION pattern (đúng khuôn cropper-engine.js) — 1 object thuần giữ TOÀN BỘ trạng thái tương tác
 * (rect/activeHandle/dragStart/aspectRatio/kích thước nguồn), Workflow tự giữ tham chiếu, truyền
 * lại cho mỗi lời gọi sau. Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác.
 *
 * KẾT QUẢ SAU "Áp dụng" KHÁC NHAU theo nơi dùng — file này CHỈ lo phần TƯƠNG TÁC (ra được `rect`
 * cuối cùng qua `getCropSessionRect()`), KHÔNG quyết định "làm gì với rect đó": Photo cắt pixel
 * thật NGAY (`cropCanvas()`, core/photo-editor-engine.js); Video Editor quy đổi tỉ lệ 0-1, lưu lại,
 * cắt THẬT lúc export sau (mediabunny/WebCodecs) — mỗi Workflow tự viết phần đó, không dùng chung
 * được (bản chất khác nhau, không phải trùng logic).
 */

/**
 * Khởi tạo 1 phiên chọn crop — khung mặc định chừa `padRatio` mỗi cạnh (0.1 = 10%, đúng khuôn
 * Lumina Pro/Cropper.js `autoCropArea`).
 * @param {number} sourceWidth @param {number} sourceHeight - kích thước THẬT (px) của ảnh/khung hình đang chọn crop.
 * @param {{padRatio?: number, aspectRatio?: number}} [options] - `aspectRatio` NaN = Tự do (mặc định).
 * @returns {object} session
 */
function initCropSession(sourceWidth, sourceHeight, options = {}) {
    const padRatio = options.padRatio ?? 0.1;
    const pad = Math.min(sourceWidth, sourceHeight) * padRatio;
    const session = {
        sourceWidth, sourceHeight,
        rect: { x: pad, y: pad, w: sourceWidth - pad * 2, h: sourceHeight - pad * 2 },
        activeHandle: null,
        dragStart: null,
        aspectRatio: options.aspectRatio ?? NaN,
    };
    if (!Number.isNaN(session.aspectRatio)) _fitRectToAspectRatio(session);
    return session;
}

/** Đổi tỉ lệ khung hình — LUÔN tính lại khung TỪ KÍCH THƯỚC NGUỒN GỐC (`session.sourceWidth/
 * sourceHeight`, KHÔNG dựa trên `rect` hiện tại đang méo/lệch) — đổi qua lại nhiều tỉ lệ (vd 16:9
 * rồi 9:16 rồi lại 16:9) luôn ra ĐÚNG kích thước ban đầu, không biến dạng/co lại dần qua mỗi lần
 * đổi (đúng yêu cầu Giang, từng ghi trong docstring `setAspectRatioSession()` cũ).
 * @param {object} session @param {number} ratio - `NaN` = Tự do (giữ nguyên `rect` hiện tại).
 */
function setCropSessionAspectRatio(session, ratio) {
    session.aspectRatio = ratio;
    if (!Number.isNaN(ratio)) _fitRectToAspectRatio(session);
}

function _fitRectToAspectRatio(session) {
    const sw = session.sourceWidth, sh = session.sourceHeight, ratio = session.aspectRatio;
    let w, h;
    if (sw / sh > ratio) { h = sh * 0.8; w = h * ratio; } else { w = sw * 0.8; h = w / ratio; }
    session.rect = { x: (sw - w) / 2, y: (sh - h) / 2, w, h };
}

/** Đặt thẳng `rect` (vd khôi phục lựa chọn crop đã lưu trước đó — Video Editor cần lại khi mở lại
 * overlay crop 1 đoạn đã crop rồi, đúng khuôn `ready()` callback cũ của Cropper.js).
 * @param {object} session @param {{x:number,y:number,w:number,h:number}} rect */
function setCropSessionRect(session, rect) {
    session.rect = { ...rect };
}

/** @param {object} session @returns {{x:number,y:number,w:number,h:number}} rect làm tròn nguyên (px). */
function getCropSessionRect(session) {
    return {
        x: Math.round(session.rect.x), y: Math.round(session.rect.y),
        w: Math.round(session.rect.w), h: Math.round(session.rect.h),
    };
}

/** Bắt đầu kéo — nhận diện đang chạm handle nào (4 góc hoặc bên trong khung = di chuyển cả khung)
 * dựa trên bán kính bắt (`hitTestRadius`, nên LỚN HƠN hẳn kích thước vẽ thật — dễ bấm trúng tay).
 * @param {object} session @param {{x:number,y:number}} pos @param {number} hitTestRadius
 */
function cropSessionPointerDown(session, pos, hitTestRadius) {
    const r = session.rect;
    const hw = hitTestRadius;
    if (Math.abs(pos.x - r.x) < hw && Math.abs(pos.y - r.y) < hw) session.activeHandle = 'tl';
    else if (Math.abs(pos.x - (r.x + r.w)) < hw && Math.abs(pos.y - r.y) < hw) session.activeHandle = 'tr';
    else if (Math.abs(pos.x - r.x) < hw && Math.abs(pos.y - (r.y + r.h)) < hw) session.activeHandle = 'bl';
    else if (Math.abs(pos.x - (r.x + r.w)) < hw && Math.abs(pos.y - (r.y + r.h)) < hw) session.activeHandle = 'br';
    else if (pos.x > r.x && pos.x < r.x + r.w && pos.y > r.y && pos.y < r.y + r.h) session.activeHandle = 'center';
    else session.activeHandle = null;
    if (session.activeHandle) session.dragStart = { x: pos.x, y: pos.y, rx: r.x, ry: r.y, rw: r.w, rh: r.h };
}

/** Kéo tiếp — cập nhật `session.rect`. Có `session.aspectRatio` (không NaN) thì TẤT CẢ 4 handle
 * góc resize theo tỉ lệ khoá (neo tại góc ĐỐI DIỆN góc đang kéo), không có thì mỗi góc độc lập tự
 * do (đúng hành vi Photo Edit mode — cố ý KHÔNG khoá tỉ lệ, xem nơi gọi).
 * @param {object} session @param {{x:number,y:number}} pos @param {number} minSize - kích thước tối thiểu (px), cả 2 chiều.
 */
function cropSessionPointerMove(session, pos, minSize) {
    if (!session.activeHandle) return;
    const dx = pos.x - session.dragStart.x, dy = pos.y - session.dragStart.y;
    const s = session.dragStart;
    const maxW = session.sourceWidth, maxH = session.sourceHeight;

    if (session.activeHandle === 'center') {
        session.rect.x = Math.min(maxW - s.rw, Math.max(0, s.rx + dx));
        session.rect.y = Math.min(maxH - s.rh, Math.max(0, s.ry + dy));
        return;
    }

    if (!Number.isNaN(session.aspectRatio)) {
        session.rect = _resizeHandleWithRatio(session.activeHandle, s, dx, session.aspectRatio, minSize, maxW, maxH);
        return;
    }

    if (session.activeHandle === 'br') {
        session.rect.w = Math.max(minSize, Math.min(maxW - s.rx, s.rw + dx));
        session.rect.h = Math.max(minSize, Math.min(maxH - s.ry, s.rh + dy));
    } else if (session.activeHandle === 'tl') {
        const newX = Math.max(0, Math.min(s.rx + s.rw - minSize, s.rx + dx));
        const newY = Math.max(0, Math.min(s.ry + s.rh - minSize, s.ry + dy));
        session.rect.x = newX; session.rect.y = newY;
        session.rect.w = s.rx + s.rw - newX; session.rect.h = s.ry + s.rh - newY;
    } else if (session.activeHandle === 'tr') {
        const newY = Math.max(0, Math.min(s.ry + s.rh - minSize, s.ry + dy));
        session.rect.y = newY; session.rect.h = s.ry + s.rh - newY;
        session.rect.w = Math.max(minSize, Math.min(maxW - s.rx, s.rw + dx));
    } else if (session.activeHandle === 'bl') {
        const newX = Math.max(0, Math.min(s.rx + s.rw - minSize, s.rx + dx));
        session.rect.x = newX; session.rect.w = s.rx + s.rw - newX;
        session.rect.h = Math.max(minSize, Math.min(maxH - s.ry, s.rh + dy));
    }
}

/** Resize 1 góc GIỮ NGUYÊN tỉ lệ, neo tại góc ĐỐI DIỆN — trục X luôn là "trục dẫn" (tính `w` trước
 * theo `dx`, suy `h` theo tỉ lệ), rồi validate/thu nhỏ lại nếu `h` vượt giới hạn không gian khả
 * dụng theo chiều dọc của góc neo tương ứng (tự thu cả 2 chiều đồng bộ, không méo).
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function _resizeHandleWithRatio(handleName, s, dx, ratio, minSize, maxW, maxH) {
    let anchorX, anchorY, widthLimit, heightLimit, signW;
    if (handleName === 'br') { anchorX = s.rx; anchorY = s.ry; widthLimit = maxW - s.rx; heightLimit = maxH - s.ry; signW = 1; }
    else if (handleName === 'tl') { anchorX = s.rx + s.rw; anchorY = s.ry + s.rh; widthLimit = s.rx + s.rw; heightLimit = s.ry + s.rh; signW = -1; }
    else if (handleName === 'tr') { anchorX = s.rx; anchorY = s.ry + s.rh; widthLimit = maxW - s.rx; heightLimit = s.ry + s.rh; signW = 1; }
    else { anchorX = s.rx + s.rw; anchorY = s.ry; widthLimit = s.rx + s.rw; heightLimit = maxH - s.ry; signW = -1; } // 'bl'

    let w = Math.max(minSize, Math.min(widthLimit, s.rw + signW * dx));
    let h = w / ratio;
    if (h > heightLimit) { h = heightLimit; w = h * ratio; }
    if (h < minSize) { h = minSize; w = h * ratio; }

    if (handleName === 'br') return { x: s.rx, y: s.ry, w, h };
    if (handleName === 'tl') return { x: anchorX - w, y: anchorY - h, w, h };
    if (handleName === 'tr') return { x: s.rx, y: anchorY - h, w, h };
    return { x: anchorX - w, y: s.ry, w, h }; // 'bl'
}

/** Kết thúc kéo. @param {object} session */
function cropSessionPointerUp(session) {
    session.activeHandle = null;
}

/**
 * Vẽ overlay crop (nền tối phủ ngoài khung + viền trắng + lưới rule-of-thirds + 4 handle góc) lên
 * `ctx` — gọi lại MỖI LẦN `session.rect` đổi. `displayScale` = tỉ lệ độ phân giải canvas / kích
 * thước hiển thị CSS thật (canvas thường phân giải cao hơn hẳn kích thước hiện trên màn hình —
 * không nhân hệ số này thì nét/handle sẽ tí hin, khó thấy/khó bấm).
 * @param {CanvasRenderingContext2D} ctx @param {object} session
 * @param {number} canvasWidth @param {number} canvasHeight - kích thước THẬT của canvas đang vẽ lên (ctx.canvas.width/height).
 * @param {number} displayScale
 */
function drawCropSessionOverlay(ctx, session, canvasWidth, canvasHeight, displayScale) {
    const r = session.rect;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.clearRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * displayScale;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1 * displayScale;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 3, r.y); ctx.lineTo(r.x + r.w / 3, r.y + r.h);
    ctx.moveTo(r.x + (r.w / 3) * 2, r.y); ctx.lineTo(r.x + (r.w / 3) * 2, r.y + r.h);
    ctx.moveTo(r.x, r.y + r.h / 3); ctx.lineTo(r.x + r.w, r.y + r.h / 3);
    ctx.moveTo(r.x, r.y + (r.h / 3) * 2); ctx.lineTo(r.x + r.w, r.y + (r.h / 3) * 2);
    ctx.stroke();

    const hw = 15 * displayScale;
    ctx.fillStyle = 'white';
    ctx.fillRect(r.x - hw / 2, r.y - hw / 2, hw, hw);
    ctx.fillRect(r.x + r.w - hw / 2, r.y - hw / 2, hw, hw);
    ctx.fillRect(r.x - hw / 2, r.y + r.h - hw / 2, hw, hw);
    ctx.fillRect(r.x + r.w - hw / 2, r.y + r.h - hw / 2, hw, hw);
}
