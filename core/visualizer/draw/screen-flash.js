/**
 * core/visualizer/draw/screen-flash.js — Vẽ 1 lớp CHỚP SÁNG TOÀN MÀN HÌNH (canvas 2D) — hàm DUY NHẤT
 * cho mọi effect có chớp: Lighting/Thunder, Lighting/Fireworks, Rain/Glass, Rain/Street (Workflow
 * event/workflow/visualizer-render.js gọi TRỰC TIẾP, không qua wrapper core nào — Rule 3 cấm core
 * gọi core).
 *
 * [MỚI — 19/09/2026, yêu cầu Giang] Gom `drawLightingFlash()` (lighting/common.js) + `paintRainFlash()`
 * (rain/common.js) về đây, kèm CAP opacity cứng SCREEN_FLASH_MAX_ALPHA (0.8) áp dụng cho MỌI effect ở
 * đúng 1 chỗ này — nơi gọi không tự cap lẻ nữa. `maxAlpha` là mức trần do người dùng chỉnh
 * (customEffect.<group>.flashMaxOpacity, Custom Effect Drawer), luôn bị kẹp lại <= trần cứng.
 * Cách tính alpha thô (ngưỡng/công thức/decay) vẫn ở từng group (computeLightningFlashAlpha/
 * computeFireworksFlashAlpha/computeRainFlashAlpha) vì khác nhau thật — chỉ phần VẼ + CAP được gom.
 *
 * Thuần — không appState, chỉ Canvas API (Rule 2/3).
 *
 * NẠP SAU: core/custom-effect.js (hằng SCREEN_FLASH_MAX_ALPHA).
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width @param {number} height  Kích thước canvas (px thật).
 * @param {number} alpha  Alpha THÔ (chưa cap) — hàm tự kẹp vào [0, min(maxAlpha, SCREEN_FLASH_MAX_ALPHA)].
 * @param {string} [tint] Chuỗi "r, g, b".
 * @param {number} [maxAlpha] Trần do người dùng chỉnh; không hợp lệ/thiếu -> dùng trần cứng.
 */
function drawScreenFlash(ctx, width, height, alpha, tint = '200, 220, 255', maxAlpha = SCREEN_FLASH_MAX_ALPHA) {
    const userCap = Number.isFinite(maxAlpha) ? maxAlpha : SCREEN_FLASH_MAX_ALPHA;
    const cap = Math.max(0, Math.min(userCap, SCREEN_FLASH_MAX_ALPHA));
    const finalAlpha = Math.min(alpha, cap);
    if (!(finalAlpha > 0)) return;
    // Reset globalAlpha — fillStyle rgba đã mang alpha riêng, globalAlpha còn sót từ lớp vẽ trước
    // (nếu != 1) sẽ nhân thêm vào làm sai độ chớp. Giữ đúng hành vi paintRainFlash() cũ.
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = `rgba(${tint}, ${finalAlpha})`;
    ctx.fillRect(0, 0, width, height);
}
