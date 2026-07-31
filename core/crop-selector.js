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
 * SESSION pattern (đúng khuôn cropper-engine.js) — 1 object thuần giữ trạng thái tương tác
 * (rect/activeHandle/dragStart/aspectRatio/kích thước nguồn), Workflow tự giữ tham chiếu, truyền
 * lại cho mỗi lời gọi sau. Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác.
 *
 * SỬA (31/07/2026, tự audit lại theo yêu cầu Giang "kiểm tra rule core") — bản đầu có 2 hàm top-
 * level RIÊNG (`_fitRectToAspectRatio()`/`_resizeHandleWithRatio()`) bị các hàm export khác GỌI —
 * VI PHẠM Rule 3 (core cấm gọi core khác, kể cả cùng file — ngoại lệ 3c CHỈ cho closure LỒNG BÊN
 * TRONG có vòng lặp, 2 hàm đó không có vòng lặp nào, không đủ điều kiện). SỬA: gộp thẳng logic tỉ
 * lệ vào `setCropSessionAspectRatio()` (nơi DUY NHẤT còn cần — bỏ hẳn `options.aspectRatio` ở
 * `initCropSession()`, không nơi gọi nào thực tế dùng tham số đó). Riêng việc "kéo 1 handle" —
 * TRƯỚC ĐÂY gộp CẢ dispatch (chọn move/resize-tự-do/resize-khoá-tỉ-lệ theo `session.activeHandle`/
 * `session.aspectRatio`) LẪN phép tính vào 1 hàm `cropSessionPointerMove()` — CŨNG vi phạm Rule 1
 * (chọn giữa ≥3 tiến trình khác nhau tuỳ trạng thái session). Đã XOÁ HẲN hàm đó — tách thành 3 hàm
 * TÍNH THUẦN độc lập (`moveCropRect()`/`computeFreeResizedRect()`/`computeRatioLockedResizedRect()`,
 * không hàm nào gọi hàm còn lại) — Workflow (nơi gọi, không bị Rule 1 ràng buộc) tự đọc
 * `session.activeHandle`/`session.aspectRatio` rồi CHỌN gọi ĐÚNG 1 trong 3 hàm, đúng tinh thần Rule
 * 1: "việc chọn tiến trình nào chạy không còn là việc của 1 function core duy nhất".
 *
 * KẾT QUẢ SAU "Áp dụng" KHÁC NHAU theo nơi dùng — file này CHỈ lo phần TƯƠNG TÁC (ra được `rect`
 * cuối cùng qua `getCropSessionRect()`), KHÔNG quyết định "làm gì với rect đó": Photo cắt pixel
 * thật NGAY (`cropCanvas()`, core/photo-editor-engine.js); Video Editor quy đổi tỉ lệ 0-1, lưu lại,
 * cắt THẬT lúc export sau (mediabunny/WebCodecs) — mỗi Workflow tự viết phần đó, không dùng chung
 * được (bản chất khác nhau, không phải trùng logic).
 */

/**
 * Khởi tạo 1 phiên chọn crop — khung mặc định chừa `padRatio` mỗi cạnh (0.1 = 10%, đúng khuôn
 * Lumina Pro/Cropper.js `autoCropArea`), Tự do (không khoá tỉ lệ) — muốn khoá tỉ lệ ngay từ đầu,
 * nơi gọi tự gọi thêm `setCropSessionAspectRatio()` ngay sau (2 bước riêng, KHÔNG gộp vào đây —
 * xem giải thích Rule 3 ở đầu file).
 * @param {number} sourceWidth @param {number} sourceHeight - kích thước THẬT (px) của ảnh/khung hình đang chọn crop.
 * @param {{padRatio?: number}} [options]
 * @returns {object} session
 */
function initCropSession(sourceWidth, sourceHeight, options = {}) {
    const padRatio = options.padRatio ?? 0.1;
    const pad = Math.min(sourceWidth, sourceHeight) * padRatio;
    return {
        sourceWidth, sourceHeight,
        rect: { x: pad, y: pad, w: sourceWidth - pad * 2, h: sourceHeight - pad * 2 },
        activeHandle: null,
        dragStart: null,
        aspectRatio: NaN, // NaN = Tự do
    };
}

/** Đổi tỉ lệ khung hình — LUÔN tính lại khung TỪ KÍCH THƯỚC NGUỒN GỐC (`session.sourceWidth/
 * sourceHeight`, KHÔNG dựa trên `rect` hiện tại đang méo/lệch) — đổi qua lại nhiều tỉ lệ (vd 16:9
 * rồi 9:16 rồi lại 16:9) luôn ra ĐÚNG kích thước ban đầu, không biến dạng/co lại dần qua mỗi lần
 * đổi (đúng yêu cầu Giang, từng ghi trong docstring `setAspectRatioSession()` cũ).
 * @param {object} session @param {number} ratio - `NaN` = Tự do (giữ nguyên `rect` hiện tại).
 */
function setCropSessionAspectRatio(session, ratio) {
    session.aspectRatio = ratio;
    if (Number.isNaN(ratio)) return; // Tự do — không ép lại rect, guard clause thuần (Rule 1)

    const sw = session.sourceWidth, sh = session.sourceHeight;
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

/** Bắt đầu kéo — nhận diện đang chạm handle nào (4 góc hoặc bên trong khung = di chuyển cả khung),
 * ghi vào `session.activeHandle`/`session.dragStart`. Bán kính bắt (`hitTestRadius`) nên LỚN HƠN
 * hẳn kích thước vẽ thật — dễ bấm trúng tay. Đây là 1 phép PHÂN LOẠI thuần (nhận toạ độ, trả về
 * ĐÚNG 1 trong 6 giá trị khả dĩ) — không phải rẽ nhánh giữa các tiến trình khác nhau (Rule 1: mọi
 * nhánh đều "cùng 1 việc" — so khoảng cách rồi gán kết quả — vẫn hợp lệ dù trả giá trị khác nhau,
 * khác với nhánh có SIDE EFFECT/Ý NGHĨA nghiệp vụ khác nhau).
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

/** Kết thúc kéo. @param {object} session */
function cropSessionPointerUp(session) {
    session.activeHandle = null;
}

/**
 * Di chuyển CẢ khung (kéo từ chính giữa) — TRẢ VỀ rect mới, KHÔNG tự ghi vào `session.rect` (nơi
 * gọi tự gán, giữ hàm thuần input->output — đúng khuôn `applyColorAdjustments()`, core/photo-
 * editor-engine.js). Dùng khi `session.activeHandle === 'center'` — nơi gọi (Workflow) tự đọc
 * field đó rồi CHỌN gọi hàm này (Rule 1 — việc chọn tiến trình thuộc về nơi gọi, không phải core).
 * @param {{x:number,y:number,w:number,h:number}} rect - rect HIỆN TẠI lúc bắt đầu kéo (`session.dragStart` quy về rect).
 * @param {number} dx @param {number} dy - độ lệch so với lúc bắt đầu kéo.
 * @param {number} maxW @param {number} maxH - kích thước nguồn (`session.sourceWidth/sourceHeight`).
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function moveCropRect(rect, dx, dy, maxW, maxH) {
    return {
        x: Math.min(maxW - rect.w, Math.max(0, rect.x + dx)),
        y: Math.min(maxH - rect.h, Math.max(0, rect.y + dy)),
        w: rect.w, h: rect.h,
    };
}

/**
 * Resize từ 1 góc, TỰ DO (không khoá tỉ lệ) — mỗi góc di chuyển ĐÚNG 2 cạnh của chính nó, cạnh đối
 * diện giữ nguyên. `flipX`/`flipY` xác định góc nào (tl: flipX+flipY, tr: flipY, bl: flipX, br:
 * không flip nào) — nơi gọi tự suy ra 2 cờ này từ `session.activeHandle` (Rule 1 — lựa chọn thuộc
 * nơi gọi). TRẢ VỀ rect mới, không tự ghi vào session (cùng lý do `moveCropRect()`).
 * @param {{x:number,y:number,w:number,h:number}} rect - rect lúc bắt đầu kéo.
 * @param {boolean} flipX - `true` nếu đang kéo cạnh TRÁI (handle 'tl'/'bl').
 * @param {boolean} flipY - `true` nếu đang kéo cạnh TRÊN (handle 'tl'/'tr').
 * @param {number} dx @param {number} dy @param {number} minSize @param {number} maxW @param {number} maxH
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function computeFreeResizedRect(rect, flipX, flipY, dx, dy, minSize, maxW, maxH) {
    const anchorX = flipX ? rect.x + rect.w : rect.x;
    const anchorY = flipY ? rect.y + rect.h : rect.y;
    const availW = flipX ? anchorX : maxW - anchorX;
    const availH = flipY ? anchorY : maxH - anchorY;

    const w = Math.max(minSize, Math.min(availW, rect.w + (flipX ? -dx : dx)));
    const h = Math.max(minSize, Math.min(availH, rect.h + (flipY ? -dy : dy)));

    return { x: flipX ? anchorX - w : rect.x, y: flipY ? anchorY - h : rect.y, w, h };
}

/**
 * Resize từ 1 góc, GIỮ NGUYÊN tỉ lệ (`session.aspectRatio`), neo tại góc ĐỐI DIỆN — trục X luôn là
 * "trục dẫn" (tính `w` trước theo `dx`, suy `h` theo tỉ lệ), rồi thu nhỏ lại cả 2 chiều đồng bộ nếu
 * `h` vượt không gian khả dụng (không méo). `flipX`/`flipY` cùng ý nghĩa `computeFreeResizedRect()`.
 * TRẢ VỀ rect mới, không tự ghi vào session (cùng lý do 2 hàm trên).
 * @param {{x:number,y:number,w:number,h:number}} rect @param {boolean} flipX @param {boolean} flipY
 * @param {number} dx @param {number} ratio @param {number} minSize @param {number} maxW @param {number} maxH
 * @returns {{x:number,y:number,w:number,h:number}}
 */
function computeRatioLockedResizedRect(rect, flipX, flipY, dx, ratio, minSize, maxW, maxH) {
    const anchorX = flipX ? rect.x + rect.w : rect.x;
    const anchorY = flipY ? rect.y + rect.h : rect.y;
    const widthLimit = flipX ? anchorX : maxW - anchorX;
    const heightLimit = flipY ? anchorY : maxH - anchorY;

    let w = Math.max(minSize, Math.min(widthLimit, rect.w + (flipX ? -dx : dx)));
    let h = w / ratio;
    if (h > heightLimit) { h = heightLimit; w = h * ratio; }
    if (h < minSize) { h = minSize; w = h * ratio; }

    return { x: flipX ? anchorX - w : rect.x, y: flipY ? anchorY - h : rect.y, w, h };
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
