/**
 * core/visualizer/draw/screen-flash.js — Vẽ 1 lớp CHỚP SÁNG TOÀN MÀN HÌNH (canvas 2D) — hàm VẼ DUY NHẤT
 * cho mọi effect có chớp: Lighting/Thunder, Lighting/Fireworks, Rain/Glass, Rain/Street (Workflow
 * event/workflow/visualizer-render.js gọi TRỰC TIẾP, không qua wrapper core nào — Rule 3 cấm core
 * gọi core). Alpha đưa vào do `computeScreenFlashAlpha()` (screen-flash-alpha.js, cùng thư mục) tính.
 *
 * [MỚI — 19/09/2026, yêu cầu Giang] Gom `drawLightingFlash()` + `paintRainFlash()` về đây. Trần CỨNG
 * SCREEN_FLASH_MAX_ALPHA (0.8) kẹp ở ĐÚNG 1 chỗ này cho MỌI effect (lưới an toàn cuối cùng — dù nơi
 * gọi truyền alpha lớn cỡ nào). Màu chớp cũng chung 1 tint duy nhất (bản cũ Street từng lệch nhẹ).
 *
 * Thuần — không appState, chỉ Canvas API (Rule 2/3).
 *
 * NẠP SAU: core/custom-effect.js (hằng SCREEN_FLASH_MAX_ALPHA).
 */

const SCREEN_FLASH_TINT = '200, 220, 255';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width @param {number} height  Kích thước canvas (px thật).
 * @param {number} alpha  Alpha (thường đã qua computeScreenFlashAlpha) — hàm vẫn tự kẹp <= trần cứng.
 */
function drawScreenFlash(ctx, width, height, alpha) {
    const finalAlpha = Math.min(alpha, SCREEN_FLASH_MAX_ALPHA);
    if (!(finalAlpha > 0)) return;
    // Reset globalAlpha — fillStyle rgba đã mang alpha riêng, globalAlpha sót từ lớp vẽ trước (nếu != 1)
    // sẽ nhân thêm làm sai độ chớp. Giữ đúng hành vi paintRainFlash() cũ.
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = `rgba(${SCREEN_FLASH_TINT}, ${finalAlpha})`;
    ctx.fillRect(0, 0, width, height);
}
