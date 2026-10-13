/**
 * core/visualizer/groups/bar/common.js — phần dùng chung của group "bar": `paintBarRects()` (chỉ Canvas API) cho
 * `mirror.js` và `cascade.js`. `black-hole.js`/`dot.js` vẽ kiểu riêng, không dùng.
 *
 * NẠP TRƯỚC: các style của group (thứ tự đọc).
 */

/** Vẽ 1 lô rect CÙNG màu/glow đã resolve sẵn — dùng chung cho bar mirror (bar 2 bên + bar trung
 * tâm, không đụng `globalAlpha`) và cascade (thân mờ dùng `fillRect` phẳng + đỉnh đặc dùng
 * `roundRect`, mỗi rect tự khai `alpha`/`plain` nếu cần — khớp chính xác thứ tự lệnh Canvas gốc).
 * Chỉ gọi Canvas API (KHÔNG tính "gọi hàm khác trong file" theo Rule 3 — chỉ cấm gọi tên hàm/
 * method TỰ VIẾT). Không tự reset `shadowBlur`/`globalAlpha` sau lô — nơi gọi (Workflow) tự reset
 * `shadowBlur = 0` một lần sau khi vẽ xong cả nhóm, đúng vị trí bản gốc. */
function paintBarRects(ctx, rects, color, glow, dpr, blurMult, shadowBlurPx) {
    ctx.shadowBlur = shadowBlurPx * dpr * blurMult;
    ctx.shadowColor = blurMult > 0 ? glow : 'transparent';
    ctx.fillStyle = color;
    rects.forEach((r) => {
        if (r.alpha !== undefined) ctx.globalAlpha = r.alpha;
        if (r.plain) {
            ctx.fillRect(r.x, r.y, r.w, r.h);
        } else {
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, r.cornerR || 0);
            ctx.fill();
        }
        if (r.alpha !== undefined) ctx.globalAlpha = r.resetAlphaTo !== undefined ? r.resetAlphaTo : 1;
    });
}
