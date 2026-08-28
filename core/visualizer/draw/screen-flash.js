/**
 * Vẽ 1 lớp chớp sáng toàn màn hình (canvas 2D) — nhóm hiệu ứng "lighting", style hiện có duy
 * nhất là "thunder" (tint trắng-xanh, giống màu tia sét). Thuần — không appState. Dùng bởi
 * Fireworks khi có burst lớn (core/visualizer/types/fireworks.js); tách riêng để tái dùng cho
 * hiệu ứng khác sau này nếu cần, không lặp lại logic fillRect ở từng file.
 */
function drawScreenFlash(ctx, width, height, alpha, tint = '200, 220, 255') {
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(${tint}, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
}
