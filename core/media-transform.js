/**
 * core/media-transform.js — Core THUẦN (Rule 1-5, readme/core-function-conventions.md). GỘP
 * (04/08/2026, phản hồi Giang — "gộp crop, zoompan vào 1 file core, workflow chung nhất") từ
 * `core/crop-selector.js` + `core/image-zoom.js` + thêm `cycleRotation()` — cả 3 nhóm (crop/zoom-
 * pan/rotate) đều là thao tác HÌNH HỌC trên media, dùng CHUNG bởi Photo Edit
 * (event/workflow/file-manager-photo.js) và Video Preview (event/workflow/video-preview.js). Tên
 * hàm giữ NGUYÊN như 2 file cũ — nơi gọi không cần sửa gì ngoài đường dẫn `<script>`.
 *
 * Session pattern — 1 object thuần giữ trạng thái, Workflow tự giữ tham chiếu, truyền lại cho mỗi
 * lời gọi sau. Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác.
 *
 * ================================ CROP ================================
 * Khung + 4 handle góc + lưới rule-of-thirds, kéo tay resize/di chuyển, khoá tỉ lệ tuỳ chọn. File
 * này CHỈ lo phần TƯƠNG TÁC (ra `rect` cuối qua `getCropSessionRect()`), KHÔNG quyết định "làm gì
 * với rect đó" — mỗi Workflow tự cắt pixel thật/quy đổi fraction theo nhu cầu riêng.
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

/** Đổi tỉ lệ khung — LUÔN tính lại TỪ KÍCH THƯỚC NGUỒN GỐC (không dựa `rect` hiện tại đang lệch) —
 * đổi qua lại nhiều tỉ lệ không biến dạng/co dần qua mỗi lần đổi.
 * @param {object} session @param {number} ratio - `NaN` = Tự do (giữ nguyên `rect` hiện tại). */
function setCropSessionAspectRatio(session, ratio) {
    session.aspectRatio = ratio;
    if (Number.isNaN(ratio)) return;
    const sw = session.sourceWidth, sh = session.sourceHeight;
    let w, h;
    if (sw / sh > ratio) { h = sh * 0.8; w = h * ratio; } else { w = sw * 0.8; h = w / ratio; }
    session.rect = { x: (sw - w) / 2, y: (sh - h) / 2, w, h };
}

/** Đặt thẳng `rect` (vd khôi phục crop đã lưu trước đó).
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

/** Bắt đầu kéo — nhận diện đang chạm handle nào (4 góc hoặc bên trong = di chuyển cả khung).
 * `hitTestRadius` nên LỚN hơn hẳn kích thước vẽ thật — dễ bấm trúng tay.
 * @param {object} session @param {{x:number,y:number}} pos @param {number} hitTestRadius */
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

/** Di chuyển CẢ khung (kéo từ chính giữa) — TRẢ VỀ rect mới, KHÔNG tự ghi vào `session.rect` (nơi
 * gọi tự gán). Dùng khi `session.activeHandle === 'center'`.
 * @param {{x:number,y:number,w:number,h:number}} rect @param {number} dx @param {number} dy
 * @param {number} maxW @param {number} maxH @returns {{x:number,y:number,w:number,h:number}} */
function moveCropRect(rect, dx, dy, maxW, maxH) {
    return {
        x: Math.min(maxW - rect.w, Math.max(0, rect.x + dx)),
        y: Math.min(maxH - rect.h, Math.max(0, rect.y + dy)),
        w: rect.w, h: rect.h,
    };
}

/** Resize từ 1 góc, TỰ DO (không khoá tỉ lệ) — mỗi góc di chuyển đúng 2 cạnh của chính nó.
 * `flipX`/`flipY`: `true` nếu đang kéo cạnh trái/trên (nơi gọi tự suy ra từ `session.activeHandle`).
 * TRẢ VỀ rect mới, không tự ghi vào session.
 * @param {{x:number,y:number,w:number,h:number}} rect @param {boolean} flipX @param {boolean} flipY
 * @param {number} dx @param {number} dy @param {number} minSize @param {number} maxW @param {number} maxH
 * @returns {{x:number,y:number,w:number,h:number}} */
function computeFreeResizedRect(rect, flipX, flipY, dx, dy, minSize, maxW, maxH) {
    const anchorX = flipX ? rect.x + rect.w : rect.x;
    const anchorY = flipY ? rect.y + rect.h : rect.y;
    const availW = flipX ? anchorX : maxW - anchorX;
    const availH = flipY ? anchorY : maxH - anchorY;
    const w = Math.max(minSize, Math.min(availW, rect.w + (flipX ? -dx : dx)));
    const h = Math.max(minSize, Math.min(availH, rect.h + (flipY ? -dy : dy)));
    return { x: flipX ? anchorX - w : rect.x, y: flipY ? anchorY - h : rect.y, w, h };
}

/** Resize từ 1 góc, GIỮ tỉ lệ (`session.aspectRatio`), neo góc ĐỐI DIỆN — trục X luôn "dẫn" (tính
 * `w` trước theo `dx`, suy `h`), thu nhỏ đồng bộ nếu `h` vượt không gian khả dụng (không méo).
 * TRẢ VỀ rect mới, không tự ghi vào session.
 * @param {{x:number,y:number,w:number,h:number}} rect @param {boolean} flipX @param {boolean} flipY
 * @param {number} dx @param {number} ratio @param {number} minSize @param {number} maxW @param {number} maxH
 * @returns {{x:number,y:number,w:number,h:number}} */
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

/** Vẽ overlay crop (nền tối phủ ngoài khung + viền trắng + lưới rule-of-thirds + 4 handle góc) —
 * gọi lại MỖI LẦN `session.rect` đổi. `displayScale` = độ phân giải canvas / kích thước CSS thật
 * (không nhân hệ số này thì nét/handle sẽ tí hin trên màn hình).
 * @param {CanvasRenderingContext2D} ctx @param {object} session
 * @param {number} canvasWidth @param {number} canvasHeight @param {number} displayScale */
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

/**
 * ================================ ZOOM-PAN ================================
 * Bọc Panzoom (timmywil, CDN). Dùng chung cho Zoom mode xem Ảnh (view-only, luôn reset khi thoát)
 * và Video Preview (đọc lại scale/pan để lưu, xem `getPanzoomState()`).
 * Session = instance Panzoom, Workflow tự giữ tham chiếu. NẠP SAU: Panzoom (CDN, global `Panzoom`).
 */
function initPanzoomSession(el, options) {
    return Panzoom(el, options); // factory function, không phải constructor
}

/** Huỷ session — `session.destroy()` một mình không dọn hết style (bug timmywil/panzoom#554), phải
 * `reset({animate:false})` trước rồi `resetStyle()` dọn nốt. @param {any} session */
function destroyPanzoomSession(session) {
    session.reset({ animate: false });
    session.destroy();
    session.resetStyle();
}

/** Đưa về scale/pan mặc định, không huỷ session. @param {any} session */
function resetPanzoomSession(session) {
    session.reset();
}

/** Đọc lại scale/pan hiện tại — không reset/destroy gì. Dùng khi cần lưu lại vị trí zoom/pan.
 * @param {any} session @returns {{scale: number, x: number, y: number}} */
function getPanzoomState(session) {
    const pan = session.getPan();
    return { scale: session.getScale(), x: pan.x, y: pan.y };
}

/**
 * ================================ ROTATE ================================
 * MỚI (04/08/2026) — xoay theo bước 90°, tiến tới trước mỗi lần gọi (0→90→180→270→0...), dùng cho
 * nút xoay DUY NHẤT (thay 2 nút trái/phải riêng — Giang: "ấn vào thì xoay kế, ấn tiếp lại xoay
 * kế"). Transform thuần trên tham số, không đọc/tạo gì thêm.
 * @param {number} currentDeg @returns {number} góc kế tiếp (0-270).
 */
function cycleRotation(currentDeg) {
    return (currentDeg + 90) % 360;
}
