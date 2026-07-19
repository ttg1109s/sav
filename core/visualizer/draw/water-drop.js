/**
 * Vẽ 1 giọt nước (canvas 2D) — dùng bởi Rain (core/visualizer/types/rain.js, cả 2 kiểu
 * glass/street). TÁCH RIÊNG (19/07/2026, yêu cầu Giang — mỗi hàm 1 file trong core/visualizer/draw/)
 * từ file gộp cũ core/visualizer/draw-helpers.js (đã xoá, XEM readme/folder-structure.md).
 */
        function drawWaterDrop(ctx, x, y, r, alpha=1) {
            let safeR = Math.max(0.1, r); 
            ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, safeR, 0, Math.PI*2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y+safeR*0.2, safeR*0.8, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
            ctx.beginPath(); ctx.arc(x-safeR*0.3, y-safeR*0.3, safeR*0.2, 0, Math.PI*2); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill(); ctx.globalAlpha = 1;
        }
