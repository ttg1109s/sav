/**
 * core/image-zoom.js — Core THUẦN (Rule 1-5 core-function-conventions.md), bọc Panzoom (timmywil,
 * CDN) cho "Zoom mode" của modal xem ảnh Photo (event/workflow/file-manager-photo.js).
 *
 * ĐÚNG khuôn core/image-editor/cropper-engine.js — Panzoom cũng là 1 thư viện TƯƠNG TÁC SỐNG
 * (pinch/kéo tay trực tiếp), không gói được thành "1 lần gọi xử lý xong" — các hàm dưới thao tác
 * trên 1 `session` (instance trả về từ `Panzoom(el, options)`), Workflow tự giữ tham chiếu, truyền
 * lại cho mỗi lời gọi sau (KHÔNG giữ trạng thái nào bên trong module này — Rule 2).
 *
 * Pinch-zoom + kéo tay (pan) đã TỰ ĐỘNG gắn sẵn ngay khi `initPanzoomSession()` chạy (Panzoom tự
 * bind Pointer Events nội bộ, không cần addEventListener gì thêm ở đây) — KHÔNG hỗ trợ zoom bằng
 * con lăn chuột ở bản này (Panzoom yêu cầu tự bind `wheel` thủ công cho việc đó — bỏ qua vì mobile
 * Safari là nền tảng chính, để dành nếu sau này cần).
 *
 * SAU NÀY ĐỔI THƯ VIỆN ZOOM — chỉ viết lại THÂN các hàm dưới, giữ NGUYÊN chữ ký,
 * event/workflow/file-manager-photo.js không cần sửa gì.
 *
 * NẠP SAU: Panzoom (CDN, global `Panzoom`).
 * Rule 3 — chỉ gọi API thư viện ngoài (Panzoom), không gọi core nào khác của project.
 * Rule 2 — không đọc `appState`, không giữ state module-level — mọi tham số (kể cả `session`) đều
 * nhận qua tham số hàm.
 */

/**
 * Khởi tạo 1 phiên zoom/pan trên phần tử đã có sẵn (thường là `<img>`). Trả về `session` — Workflow
 * tự giữ tham chiếu này, truyền lại cho các hàm còn lại trong file này.
 * @param {HTMLElement} el
 * @param {object} [options] - options gốc của Panzoom (maxScale/minScale/contain/cursor/...).
 * @returns {any} session (hiện tại chính là instance Panzoom, coi là "hộp đen" — Workflow không tự
 *          gọi method nào khác ngoài các hàm ở file này).
 */
function initPanzoomSession(el, options) {
    return Panzoom(el, options); // CDN global — LÀ 1 factory function, KHÔNG phải constructor (không `new`)
}

/**
 * Huỷ 1 phiên zoom — dọn CẢ event binding LẪN style (transform/cursor/overflow trên phần tử VÀ
 * phần tử cha) Panzoom đã set. `session.destroy()` MỘT MÌNH KHÔNG dọn style (bug đã biết của thư
 * viện, GitHub issue timmywil/panzoom#554) — bắt buộc gọi thêm `resetStyle()` ngay sau, nếu không
 * phần tử vẫn "kẹt" ở trạng thái đã zoom/pan (transform còn nguyên) dù session đã huỷ.
 * SỬA (31/07/2026, mục 2 phản hồi Giang — "thoát Zoom không khôi phục vị trí") — RÀ LẠI SOURCE THẬT
 * của `resetStyle()` (@panzoom/panzoom@4.6.2, types.ts): hàm đó CHỈ xoá `overflow`/`userSelect`/
 * `touchAction`/`cursor`/`transformOrigin` — KHÔNG hề đụng tới `transform` (chính thứ mang giá trị
 * scale/pan đã kéo) — issue #554 gốc chỉ phàn nàn về cursor/overflow "kẹt lại", KHÔNG phải về
 * transform. Comment cũ ở đây hiểu SAI phạm vi `resetStyle()`, nên "phần tử vẫn kẹt ở trạng thái đã
 * zoom/pan" ĐÚNG NHƯ MÔ TẢ nhưng bị chẩn đoán nhầm nguyên nhân → chưa sửa tận gốc. SỬA ĐÚNG: gọi
 * `session.reset({ animate: false })` TRƯỚC `destroy()` — `reset()` mới là hàm đưa scale/pan
 * (transform) về mặc định (KHÔNG animate — sắp huỷ session ngay, animate chỉ tốn thời gian vô ích),
 * `resetStyle()` sau đó dọn nốt phần overflow/cursor còn lại.
 * @param {any} session
 */
function destroyPanzoomSession(session) {
    session.reset({ animate: false });
    session.destroy();
    session.resetStyle();
}

/** Đưa phiên về scale/pan mặc định ban đầu (KHÔNG huỷ session — dùng khi cần "zoom lại từ đầu" mà
 * vẫn đang ở Zoom mode). @param {any} session */
function resetPanzoomSession(session) {
    session.reset();
}
