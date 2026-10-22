/**
 * core/visualizer/groups/bar/common.js — phần dùng chung của group "bar": `paintBarRects()` (chỉ Canvas API) cho
 * `mirror.js` và `cascade.js`. `black-hole.js`/`dot.js` vẽ kiểu riêng, không dùng.
 *
 * NẠP TRƯỚC: các style của group (thứ tự đọc).
 */

/** Vẽ 1 lô rect CÙNG màu/glow đã resolve sẵn (bar mirror + cascade). Mỗi rect tự khai `alpha` (tuỳ chọn) và `plain`
 * (góc vuông — thân mờ cascade) / `cornerR`. Không reset `shadowBlur` sau lô — Workflow reset 1 lần sau cả nhóm. */
function paintBarRects(ctx, rects, color, glow, dpr, blurMult, shadowBlurPx) {
    ctx.shadowBlur = shadowBlurPx * dpr * blurMult;
    ctx.shadowColor = blurMult > 0 ? glow : 'transparent';
    ctx.fillStyle = color;
    rects.forEach((r) => {
        if (r.alpha !== undefined) ctx.globalAlpha = r.alpha;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, r.plain ? 0 : (r.cornerR || 0));
        ctx.fill();
        if (r.alpha !== undefined) ctx.globalAlpha = r.resetAlphaTo !== undefined ? r.resetAlphaTo : 1;
    });
}
