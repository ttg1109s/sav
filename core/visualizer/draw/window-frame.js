/**
 * Vẽ khung cửa sổ NHÀ (canvas 2D, thanh chữ thập chia 4 ô kính) — dùng bởi Rain kiểu "glass"
 * (core/visualizer/types/rain.js, đứng nhìn mưa ngoài cửa sổ). TÁCH RIÊNG (19/07/2026, yêu cầu
 * Giang — mỗi hàm 1 file trong core/visualizer/draw/) từ file gộp cũ
 * core/visualizer/draw-helpers.js (đã xoá, xem readme/folder-structure.md).
 */
        function drawWindowFrame(ctx) {
            let fw = 25 * appState.get('dpr'); let midW = 15 * appState.get('dpr'); 
            ctx.fillStyle = '#11131a'; 
            ctx.fillRect(0, 0, canvas.width, fw); ctx.fillRect(0, canvas.height - fw, canvas.width, fw);
            ctx.fillRect(0, 0, fw, canvas.height); ctx.fillRect(canvas.width - fw, 0, fw, canvas.height);
            ctx.fillRect(canvas.width/2 - midW/2, 0, midW, canvas.height); ctx.fillRect(0, canvas.height/2 - midW/2, canvas.width, midW);
            
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(fw, fw, canvas.width/2 - fw - midW/2, 2*appState.get('dpr')); 
            ctx.fillRect(canvas.width/2 + midW/2, fw, canvas.width/2 - fw - midW/2, 2*appState.get('dpr'));
            ctx.fillRect(fw, canvas.height/2 - midW/2, canvas.width/2 - fw - midW/2, 2*appState.get('dpr')); ctx.fillRect(canvas.width/2 + midW/2, canvas.height/2 - midW/2, canvas.width/2 - fw - midW/2, 2*appState.get('dpr'));
            
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(canvas.width/2 - midW/2 - 2*appState.get('dpr'), 0, 2*appState.get('dpr'), canvas.height); ctx.fillRect(0, canvas.height/2 + midW/2, canvas.width, 2*appState.get('dpr')); 
        }
