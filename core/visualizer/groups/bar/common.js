/**
 * core/visualizer/groups/bar/common.js — Registry style con của group "bar" (đăng ký theo yêu
 * cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng). Trước đây
 * `core/visualizer/types/bar.js` gộp 2 style 'mirror'/'cascade', và `core/visualizer/types/
 * black-hole.js` đứng riêng — giờ cả 3 cùng thuộc group "bar", mỗi style 1 file riêng
 * (`mirror.js`/`cascade.js`/`black-hole.js`, cùng thư mục).
 *
 * `paintBarRects()` là cơ chế CHUNG (Rule 3 — chỉ Canvas API) dùng bởi CẢ `mirror.js` lẫn
 * `cascade.js` — đặt ở đây để 2 file đó không phải định nghĩa trùng lặp. `black-hole.js` có cách vẽ
 * riêng (dải cột toả tia quanh hố đen, không phải rect) nên KHÔNG dùng hàm này.
 *
 * NẠP: TRƯỚC `mirror.js`/`cascade.js` (2 file đó gọi `paintBarRects()` qua Workflow, không tự gọi
 * trực tiếp trong thân hàm — nhưng đặt common.js trước cho nhất quán thứ tự đọc).
 */

/** Danh sách style con thuộc group "bar" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). 'black hole' giữ nguyên tên có khoảng trắng, khớp `cfg.type === 'black hole'`
 * hiện hành (dispatch chưa đổi trong lượt này — xem ghi chú cuối tin nhắn). */
const BAR_GROUP_STYLE_KEYS = ['mirror', 'cascade', 'black hole'];

/** Vẽ 1 lô rect CÙNG màu/glow đã resolve sẵn — dùng chung cho bar mirror (bar 2 bên + bar trung
 * tâm, không đụng `globalAlpha`) và cascade (thân mờ dùng `fillRect` phẳng + đỉnh đặc dùng
 * `roundRect`, mỗi rect tự khai `alpha`/`plain` nếu cần — khớp chính xác thứ tự lệnh Canvas gốc).
 * Chỉ gọi Canvas API (KHÔNG tính "gọi hàm khác trong file" theo Rule 3 — chỉ cấm gọi tên hàm/
 * method TỰ VIẾT). Không tự reset `shadowBlur`/`globalAlpha` sau lô — nơi gọi (Workflow) tự reset
 * `shadowBlur = 0` một lần sau khi vẽ xong cả nhóm, đúng vị trí bản gốc. */
function paintBarRects(ctx, rects, color, glow, dpr, blurMult, shadowBlurPx) {
    ctx.shadowBlur = shadowBlurPx * dpr * blurMult;
    ctx.shadowColor = blurMult > 0 ? glow : 'transparent';
    ctx.fillStyle = color;
    rects.forEach((r) => {
        if (r.alpha !== undefined) ctx.globalAlpha = r.alpha;
        if (r.plain) {
            ctx.fillRect(r.x, r.y, r.w, r.h);
        } else {
            ctx.beginPath();
            ctx.roundRect(r.x, r.y, r.w, r.h, r.cornerR || 0);
            ctx.fill();
        }
        if (r.alpha !== undefined) ctx.globalAlpha = r.resetAlphaTo !== undefined ? r.resetAlphaTo : 1;
    });
}
