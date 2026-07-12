/**
 * core/slider-panel-scroll.js — Core UI THUẦN, dùng CHUNG cho MỌI khung cuộn ngang kiểu
 * "slider panel" trong app (3 nơi đang dùng, xem NẠP SAU):
 *   1. `#side-left-container` (Playlist <-> Settings) — core/player-controls.js.
 *   2. `#settings-stack-body` (ngăn xếp panel con của Settings) — core/settings-panel-stack-ui.js.
 *   3. `#toolbar-scroll-container` (thanh công cụ Subtitle Editor, `subtitle-editor.html`) —
 *      `event/workflow/subtitle-editor.js::scrollToolbar()`.
 *
 * TÁCH RA (09/07/2026, theo đúng kế hoạch đã thống nhất — xem sav12-handoff-plan.md Phần 1):
 * trước đó 2 nơi trên tự viết `scrollTo({left, behavior})` RIÊNG (settings-panel-stack.js tính vị
 * trí bằng `clientWidth * index`, player-controls.js hardcode 2 giá trị `0`/`clientWidth`) — 2 bộ
 * logic SONG SONG làm cùng 1 việc. Rút đúng 2 hàm dùng chung ra đây, ĐỔI TÊN trung tính (không dính
 * miền gốc "Playlist/Settings"), CẢ 2 miền đều gọi thẳng đúng 2 hàm này — không viết bản riêng.
 *
 * THÊM `getStepScrollTarget()` (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/
 * v12.md mục "sửa nốt") — nút mũi tên cuộn toolbar Subtitle Editor TRƯỚC ĐÂY tính target THẲNG
 * TRONG `event/listener/subtitle-editor.js` (`Math.max/min` tự viết) — vừa vi phạm "listener
 * không tính toán/gọi core", vừa lặp lại đúng kiểu "logic song song" mà file này được tạo ra để
 * tránh. Giờ TÍNH TOÁN sống ở đây (Core, hàm THUẦN), Workflow chỉ gọi 2 hàm Core nối tiếp
 * (`getStepScrollTarget()` rồi `scrollSliderTo()`) — không tự tính gì trong chính nó.
 *
 * Core UI THUẦN (giống core/generic-drawer.js/document-ui.js) — KHÔNG thuộc phạm vi Rule 1-4
 * (core-function-conventions.md, chỉ áp cho core NGHIỆP VỤ có quyết định dữ liệu) NHƯNG vẫn viết
 * sạch: chỉ nhận tham số, không tự appState.get(), không tự taskManager — nhất quán phong cách toàn
 * bộ core dù được miễn Rule 1-4. Rule 3 (không core gọi core BẰNG TÊN) vẫn áp dụng CHO file này với
 * các core KHÁC (không có, cả 3 hàm độc lập, không hàm nào gọi hàm kia).
 *
 * NẠP TRƯỚC CẢ core/settings-panel-stack-ui.js, core/player-controls.js (index.html) VÀ
 * event/workflow/subtitle-editor.js (subtitle-editor.html) — mọi nơi đều cần các hàm này tồn tại
 * sẵn lúc chạy.
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
 * Vị trí đích khi cuộn "từng bước" (1 bước = 80% chiều rộng khung nhìn thấy) — dùng cho khung cuộn
 * có nút mũi tên trái/phải thay vì nhảy thẳng tới 1 phần tử con cụ thể như `getPositionStart()`
 * (vd toolbar cuộn ngang của Subtitle Editor). Hàm THUẦN — chỉ đọc layout THẬT của chính
 * `containerEl` (`scrollLeft`/`clientWidth`/`scrollWidth`), không đọc `appState`, không gọi hàm
 * nào khác.
 * @param {HTMLElement} containerEl - khung cuộn ngang (cha).
 * @param {'left'|'right'} direction
 * @returns {number}
 */
function getStepScrollTarget(containerEl, direction) {
    const step = containerEl.clientWidth * 0.8;
    if (direction === 'left') return Math.max(0, containerEl.scrollLeft - step);
    return Math.min(containerEl.scrollWidth - containerEl.clientWidth, containerEl.scrollLeft + step);
}

/**
 * Cuộn 1 khung ngang tới đúng vị trí X — LUÔN dùng `scrollTo()` TƯỜNG MINH (TUYỆT ĐỐI KHÔNG gán
 * trực tiếp `containerEl.scrollLeft = position`: nếu phần tử có CSS `scroll-behavior: smooth`, gán
 * thẳng `.scrollLeft` KHÔNG nhảy tức thời mà tự động animate — đúng lớp bug đã tốn nhiều vòng vá mới
 * tìm ra, xem HOTFIX 12 lịch sử dự án).
 * @param {HTMLElement} containerEl - khung cuộn ngang (cha).
 * @param {number} position - vị trí X đích (thường lấy từ `getPositionStart()` hoặc
 *        `getStepScrollTarget()`).
 * @param {boolean} animate - true = cuộn mượt (`behavior:'smooth'`), false = nhảy thẳng tức thời
 *        (`behavior:'instant'`) — dùng lúc đóng hẳn/đặt lại trạng thái, không cần mượt.
 */
function scrollSliderTo(containerEl, position, animate) {
    containerEl.scrollTo({ left: position, behavior: animate ? 'smooth' : 'instant' });
}
