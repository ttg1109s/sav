/**
 * core/gameplay/circle-mode-ui.js — Core-ui (Rule 5c) RIÊNG cho vẽ canvas mode "Circle": approach
 * ring + target circle. Tier popup/HUD combo/layer show-hide/countdown DÙNG CHUNG mọi mode đã dời
 * sang core/gameplay/engine-ui.js. KHÔNG appState.get() (Rule 2), KHÔNG gọi core khác (Rule 3a).
 *
 * Vẽ 2 PASS mỗi frame: pass 1 (drawApproachRings) LUÔN trước pass 2 (drawTargetCircles) — target
 * circle mọi note vì vậy luôn nổi trên approach ring mọi note. [SỬA — Giang yêu cầu "vòng tròn xuất
 * hiện trước có z-index lớn hơn, bỏ kiểu bấm xuyên qua lớp"] TRONG mỗi pass, thứ tự `entries` do
 * Workflow tự đảo NGƯỢC thứ tự spawn TRƯỚC khi truyền vào đây (event/workflow/gameplay.js::tick())
 * — wave xuất hiện SỚM HƠN giờ vẽ SAU CÙNG (đè lên trên) trong CẢ 2 pass. Hit-test tap giờ CŨNG tôn
 * trọng đúng thứ tự z này (KHÔNG còn "thuần toạ độ, không phụ thuộc thứ tự" như trước — xem
 * findTopmostNoteInTolerance() core/gameplay/engine.js) dù tự nó vẫn không đọc gì từ canvas, chỉ
 * ăn ĐÚNG quy ước thứ tự entries giống hệt file này.
 */

/** Set kích thước canvas khớp devicePixelRatio — PHẢI gọi lại mỗi khi layer resize. Trả kích thước
 * CSS px (không nhân dpr) — Workflow dùng số này tính lưới pitch→ô (circle-mode.js). */
function resizeGameplayCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const widthPx = canvas.clientWidth;
    const heightPx = canvas.clientHeight;
    canvas.width = widthPx * dpr;
    canvas.height = heightPx * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { widthPx, heightPx };
}

/** Xoá khung hình trước — nền TRONG SUỐT (KHÔNG fillRect), visualizer phía sau xuyên qua được. */
function clearGameplayCanvas(ctx, widthPx, heightPx) {
    ctx.clearRect(0, 0, widthPx, heightPx);
}

/** Pass 1 — approach ring (wave co dần): glow mờ, không viền cứng. `entries`: [{x,y,radius,opacity,colorLight}]. */
function drawApproachRings(ctx, entries) {
    for (const entry of entries) {
        ctx.save();
        ctx.globalAlpha = entry.opacity;
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, entry.radius, 0, Math.PI * 2);
        ctx.fillStyle = entry.colorLight;
        ctx.shadowColor = entry.colorLight;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.restore();
    }
}

/** Pass 2 — target circle cố định, LUÔN vẽ sau (nổi trên) approach ring. `entries`: [{x,y,centerRadius,colorMain}]. */
function drawTargetCircles(ctx, entries) {
    for (const entry of entries) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, entry.centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = entry.colorMain;
        ctx.shadowColor = entry.colorMain;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }
}
