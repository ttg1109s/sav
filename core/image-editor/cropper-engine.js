/**
 * core/image-edit/cropper-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI
 * (phản hồi Giang — "sau này đổi thư viện chỉnh sửa ảnh thì?"). GOM TOÀN BỘ lời gọi trực tiếp tới
 * Cropper.js (thư viện CDN) vào ĐÚNG 1 file này — `event/workflow/image-edit.js` KHÔNG còn tham
 * chiếu `Cropper`/`new Cropper(...)` ở bất kỳ đâu nữa, chỉ gọi các hàm ở đây.
 *
 * KHÁC VỚI `core/video-editor/webcodecs-engine.js` (1 hàm thuần, vào Blob ra Blob, không trạng
 * thái) — Cropper.js vốn dĩ là 1 THƯ VIỆN TƯƠNG TÁC SỐNG (người dùng kéo tay chỉnh khung crop trực
 * tiếp), không thể gói thành "1 lần gọi xử lý xong" — nên các hàm dưới đây thao tác trên 1
 * `session` (chính là instance `Cropper` trả về từ `initCropperSession()`), Workflow tự giữ tham
 * chiếu `session` đó và truyền lại cho mỗi lời gọi sau (KHÔNG giữ trạng thái nào bên trong module
 * này — đúng Rule 2, mọi dữ liệu cần đều nhận qua tham số, kể cả chính session).
 *
 * SAU NÀY ĐỔI THƯ VIỆN CROP ẢNH (vd sang thư viện khác) — CHỈ viết lại THÂN các hàm dưới đây, giữ
 * NGUYÊN chữ ký (tham số vào/ra) — `event/workflow/image-edit.js` không cần sửa gì.
 *
 * NẠP SAU: Cropper.js (CDN, global `Cropper`).
 * Rule 3 — chỉ gọi API thư viện ngoài (Cropper.js), không gọi core nào khác của project.
 * Rule 2 — không đọc `appState`, không giữ state module-level — mọi tham số (kể cả `session`)
 * đều nhận qua tham số hàm.
 */

/**
 * Khởi tạo 1 phiên crop mới trên phần tử `<img>` đã có sẵn `src`. Trả về `session` — Workflow tự
 * giữ tham chiếu này, truyền lại cho các hàm còn lại trong file này.
 * @param {HTMLImageElement} imgEl
 * @param {object} options - options gốc của Cropper.js (viewMode/autoCropArea/background/responsive/ready/...).
 * @returns {any} session (hiện tại chính là instance `Cropper`, coi là "hộp đen" — Workflow không tự gọi method nào khác ngoài các hàm ở file này).
 */
function initCropperSession(imgEl, options) {
    return new Cropper(imgEl, options); // CDN global
}

/** Huỷ 1 phiên crop (giải phóng DOM/canvas nội bộ Cropper.js tạo ra). @param {any} session */
function destroyCropperSession(session) {
    session.destroy();
}

/** Lấy canvas đã áp crop/rotate/flip hiện tại của phiên (KHÔNG áp filter màu — filter là việc
 * riêng của Workflow, xem `_buildFinalBlob()`/`_applyFilterPreview()` ở image-edit.js).
 * @param {any} session @returns {HTMLCanvasElement|null} */
function getCroppedCanvasFromSession(session) {
    return session.getCroppedCanvas();
}

/** Xoay thêm N độ so với góc hiện tại của phiên. @param {any} session @param {number} deg */
function rotateSession(session, deg) {
    session.rotate(deg);
}

/**
 * [MỚI, module Video Editor — dùng để đọc toạ độ vùng crop RA khỏi phiên, KHÔNG cần canvas đã áp
 * crop (khác `getCroppedCanvasFromSession()`, dùng cho `image-edit.html` — cần ảnh THẬT đã cắt sẵn;
 * Video Editor chỉ cần toạ độ để tự tính lại theo tỉ lệ 0-1, "nướng" thật lúc `processVideo()`)]
 * @param {any} session @param {boolean} rounded @returns {{x:number,y:number,width:number,height:number}}
 */
function getCropDataFromSession(session, rounded) {
    return session.getData(!!rounded);
}

/** Đặt hệ số lật ngang (1 = bình thường, -1 = đã lật) — Workflow tự tính toggle, hàm này chỉ ÁP
 * giá trị. @param {any} session @param {number} scaleX */
function flipHorizontalSession(session, scaleX) {
    session.scaleX(scaleX);
}

/** Đặt hệ số lật dọc (1 = bình thường, -1 = đã lật). @param {any} session @param {number} scaleY */
function flipVerticalSession(session, scaleY) {
    session.scaleY(scaleY);
}

/** Đưa phiên về trạng thái crop/rotate/flip mặc định ban đầu (KHÔNG đụng filter màu). @param {any} session */
function resetSession(session) {
    session.reset();
}
