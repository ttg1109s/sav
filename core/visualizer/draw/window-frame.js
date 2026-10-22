/**
 * core/visualizer/draw/window-frame.js — khung cửa sổ nhà (thanh chữ thập chia 4 ô kính) cho Rain kiểu "glass".
 * Chỉ Canvas API — kích thước canvas + dpr do Workflow truyền.
 */

/** @param {CanvasRenderingContext2D} ctx @param {number} W canvas.width @param {number} H canvas.height @param {number} dpr */
function drawWindowFrame(ctx, W, H, dpr) {
    const fw = 25 * dpr;
    const midW = 15 * dpr;
    const line = 2 * dpr;
    const paneW = W / 2 - fw - midW / 2;
    ctx.fillStyle = '#11131a';
    ctx.fillRect(0, 0, W, fw);
    ctx.fillRect(0, H - fw, W, fw);
    ctx.fillRect(0, 0, fw, H);
    ctx.fillRect(W - fw, 0, fw, H);
    ctx.fillRect(W / 2 - midW / 2, 0, midW, H);
    ctx.fillRect(0, H / 2 - midW / 2, W, midW);
    // Viền sáng mép trên mỗi ô kính.
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(fw, fw, paneW, line);
    ctx.fillRect(W / 2 + midW / 2, fw, paneW, line);
    ctx.fillRect(fw, H / 2 - midW / 2, paneW, line);
    ctx.fillRect(W / 2 + midW / 2, H / 2 - midW / 2, paneW, line);
    // Bóng đổ của thanh chữ thập.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - midW / 2 - line, 0, line, H);
    ctx.fillRect(0, H / 2 + midW / 2, W, line);
}
