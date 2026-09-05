/**
 * core/visualizer/groups/lighting/common.js — Registry style con của group "lighting" (đăng ký
 * theo yêu cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng).
 * Trước đây `core/visualizer/types/lighting.js` gộp 2 style 'thunder'/'fireworks' — giờ mỗi style
 * 1 file riêng (`thunder.js`/`fireworks.js`, cùng thư mục).
 *
 * `drawLightingFlash()` là cơ chế CHUNG (Rule 3 — chỉ Canvas API) dùng bởi CẢ 2 style: thunder tô
 * trước khi vẽ bolt, fireworks tô khi có burst lớn — đặt ở đây để 2 file đó không phải định nghĩa
 * trùng lặp. `flashThreshold` (ngưỡng kích hoạt chớp) cũng dùng CHUNG cho cả 2 style qua
 * customEffect.lighting.flashThreshold.
 *
 * NẠP: TRƯỚC `thunder.js`/`fireworks.js`.
 */

/** Danh sách style con thuộc group "lighting" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). */
const LIGHTING_GROUP_STYLE_KEYS = ['thunder', 'fireworks'];

// ================================ Nhóm "lighting" — chớp màn hình =============================
// Dùng chung cho cả 2 style: thunder tô trước khi vẽ bolt, fireworks tô khi có burst lớn.

function drawLightingFlash(ctx, width, height, alpha) {
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
}
