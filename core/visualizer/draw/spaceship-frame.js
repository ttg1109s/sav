/**
 * Khung kính "khoang lái tàu vũ trụ" cho visualizer Space (item 4, MỚI 19/07/2026) — RIÊNG,
 * KHÔNG dùng chung drawWindowFrame() (draw/window-frame.js): hàm đó vẽ cửa sổ NHÀ (thanh chữ
 * thập chia 4 ô kính, đúng cho Rain đứng nhìn mưa ngoài cửa sổ) — sai theme hoàn toàn cho khoang
 * lái tàu vũ trụ (Giang chỉ ra sau khi xem bản đầu dùng nhầm hàm này). Tham khảo thiết kế HUD
 * tàu vũ trụ/sci-fi thật (góc ngoặc HUD phát sáng mảnh, viền sát mép, vignette tối 4 góc — KHÔNG
 * có thanh chia giữa màn hình như cửa sổ nhà) thay vì tự nghĩ hoặc tái dùng nhầm hàm cũ.
 *
 * Gọi từ core/visualizer/draw-visualizer.js khi cfg.type==='space' && cfg.spaceGlassFrame.
 * TÁCH RIÊNG (19/07/2026, yêu cầu Giang — mỗi hàm 1 file trong core/visualizer/draw/) từ file gộp
 * cũ core/visualizer/draw-helpers.js (đã xoá, xem readme/folder-structure.md).
 */
        function drawSpaceshipFrame(ctx) {
            const dpr = appState.get('dpr');
            const w = canvas.width, h = canvas.height;

            // Vignette tối 4 góc — cảm giác đang nhìn qua khoang lái, không phải toàn màn hình trong suốt.
            const vignette = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.35, w/2, h/2, Math.max(w,h)*0.62);
            vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);

            // Viền mảnh SÁT MÉP (KHÔNG chia đôi màn hình như drawWindowFrame() — khác hẳn cửa sổ nhà).
            const rimW = 6 * dpr;
            ctx.strokeStyle = 'rgba(180,210,255,0.22)'; ctx.lineWidth = rimW;
            ctx.strokeRect(rimW/2, rimW/2, w - rimW, h - rimW);

            // 4 góc ngoặc HUD (corner bracket) phát sáng nhẹ — đặc trưng HUD/cockpit sci-fi thật,
            // KHÁC hẳn cửa sổ nhà (không có thanh chữ thập ở giữa).
            const cornerLen = 46 * dpr, cornerOffset = 20 * dpr;
            ctx.strokeStyle = 'rgba(190,225,255,0.55)'; ctx.lineWidth = 2.5 * dpr;
            ctx.shadowColor = 'rgba(140,200,255,0.6)'; ctx.shadowBlur = 6 * dpr;
            [[cornerOffset, cornerOffset, 1, 1], [w - cornerOffset, cornerOffset, -1, 1],
             [cornerOffset, h - cornerOffset, 1, -1], [w - cornerOffset, h - cornerOffset, -1, -1]]
                .forEach(([x, y, dx, dy]) => {
                    ctx.beginPath();
                    ctx.moveTo(x, y + cornerLen * dy); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen * dx, y);
                    ctx.stroke();
                });
            ctx.shadowBlur = 0;
        }
