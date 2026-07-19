/**
 * Flash va chạm cho visualizer Space (MỚI 19/07/2026, viết lại toàn diện — phản hồi Giang "không
 * thấy va chạm gì cả") — vẽ 1 quầng sáng cam/trắng mờ dần trên canvas 2D ngay khi thiên thạch bay
 * NGANG QUA rất gần camera (xem triggerSpaceCollisionShake(), core/webgl/three-space.js) — CỘNG
 * THÊM vào rung camera (đã có sẵn), cho 2 tín hiệu va chạm rõ ràng CÙNG LÚC thay vì chỉ rung nhẹ
 * mờ nhạt như bản trước.
 *
 * Đọc biến `spFlashOpacity` (khai báo ở core/webgl/three-space.js, giảm dần mỗi khung hình ở
 * core/visualizer/types/space.js::drawSpace()) — không có ES6 module, mọi file chia sẻ 1 global
 * scope (xem readme/why-no-es6-module.md).
 *
 * Gọi từ core/visualizer/draw-visualizer.js, mọi khung hình khi cfg.type === 'space' (không phụ
 * thuộc cfg.spaceGlassFrame — flash va chạm luôn hiện bất kể khung kính bật/tắt).
 */
        function drawSpaceCollisionFlash(ctx) {
            if (spFlashOpacity <= 0) return;
            const w = canvas.width, h = canvas.height;
            const flash = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
            flash.addColorStop(0, `rgba(255,210,150,${spFlashOpacity})`);
            flash.addColorStop(0.6, `rgba(255,150,80,${spFlashOpacity * 0.5})`);
            flash.addColorStop(1, 'rgba(255,150,80,0)');
            ctx.fillStyle = flash;
            ctx.fillRect(0, 0, w, h);
        }
