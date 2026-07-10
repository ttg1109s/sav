/**
 * core/slider-panel-scroll.js — Core UI THUẦN, dùng CHUNG cho MỌI khung cuộn ngang kiểu
 * "slider panel" trong app (2 nơi đang dùng, xem NẠP SAU):
 *   1. `#side-left-container` (Playlist <-> Settings) — core/player-controls.js.
 *   2. `#settings-stack-body` (ngăn xếp panel con của Settings) — core/settings-panel-stack.js.
 *
 * TÁCH RA (09/07/2026, theo đúng kế hoạch đã thống nhất — xem sav12-handoff-plan.md Phần 1):
 * trước đó 2 nơi trên tự viết `scrollTo({left, behavior})` RIÊNG (settings-panel-stack.js tính vị
 * trí bằng `clientWidth * index`, player-controls.js hardcode 2 giá trị `0`/`clientWidth`) — 2 bộ
 * logic SONG SONG làm cùng 1 việc. Rút đúng 2 hàm dùng chung ra đây, ĐỔI TÊN trung tính (không dính
 * miền gốc "Playlist/Settings"), CẢ 2 miền đều gọi thẳng đúng 2 hàm này — không viết bản riêng.
 *
 * Core UI THUẦN (giống core/generic-drawer.js/document-ui.js) — KHÔNG thuộc phạm vi Rule 1-4
 * (core-function-conventions.md, chỉ áp cho core NGHIỆP VỤ có quyết định dữ liệu) NHƯNG vẫn viết
 * sạch: chỉ nhận tham số, không tự appState.get(), không tự taskManager — nhất quán phong cách toàn
 * bộ core dù được miễn Rule 1-4. Rule 3 (không core gọi core BẰNG TÊN) vẫn áp dụng CHO file này với
 * các core KHÁC (không có, file chỉ có 2 hàm độc lập, không hàm nào gọi hàm kia).
 *
 * NẠP TRƯỚC CẢ core/settings-panel-stack.js VÀ core/player-controls.js (2 nơi đều cần 2 hàm này
 * tồn tại sẵn lúc chạy).
 */

/** Ước lượng thời lượng an toàn cho 1 lần cuộn mượt 1 "trang" — dùng chung cho MỌI nơi cuộn (native
 * `scrollTo({behavior:'smooth'})` không có CSS duration cố định để canh chính xác 100%, đây chỉ là
 * mốc ước lượng đủ an toàn để taskManager đợi trước khi xoá DOM/coi animation đã xong). */
const SLIDER_PANEL_SCROLL_ESTIMATED_MS = 500;

/**
 * Vị trí bắt đầu (theo trục X) của 1 phần tử con BÊN TRONG khung cuộn cha của nó — dùng làm tham số
 * `position` cho `scrollSliderTo()` bên dưới, tính đúng theo layout THẬT của phần tử (không đoán
 * bằng `clientWidth * index`, tránh sai lệch nếu panel không đúng 100% chiều rộng khung cha).
 * @param {HTMLElement} el - phần tử con (đã nằm trong DOM, đã có layout thật).
 * @returns {number}
 */
function getPositionStart(el) {
    return el.offsetLeft;
}

/**
 * Cuộn 1 khung ngang tới đúng vị trí X — LUÔN dùng `scrollTo()` TƯỜNG MINH (TUYỆT ĐỐI KHÔNG gán
 * trực tiếp `containerEl.scrollLeft = position`: nếu phần tử có CSS `scroll-behavior: smooth`, gán
 * thẳng `.scrollLeft` KHÔNG nhảy tức thời mà tự động animate — đúng lớp bug đã tốn nhiều vòng vá mới
 * tìm ra, xem HOTFIX 12 lịch sử dự án).
 * @param {HTMLElement} containerEl - khung cuộn ngang (cha).
 * @param {number} position - vị trí X đích (thường lấy từ `getPositionStart()`).
 * @param {boolean} animate - true = cuộn mượt (`behavior:'smooth'`), false = nhảy thẳng tức thời
 *        (`behavior:'instant'`) — dùng lúc đóng hẳn/đặt lại trạng thái, không cần mượt.
 */
function scrollSliderTo(containerEl, position, animate) {
    containerEl.scrollTo({ left: position, behavior: animate ? 'smooth' : 'instant' });
}
