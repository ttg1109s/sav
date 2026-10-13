/**
 * core/slider-panel-scroll.js — cuộn ngang thanh công cụ Subtitle Editor (`#toolbar-scroll-container`) theo nút mũi
 * tên: `getStepScrollTarget()` tính đích, `scrollSliderTo()` cuộn. Workflow gọi:
 * event/workflow/subtitle-editor.js::scrollToolbar(). Chỉ nạp ở pages/subtitle-editor.html.
 */

/**
 * Vị trí đích khi cuộn "từng bước" (1 bước = 80% chiều rộng khung nhìn thấy) — dùng cho khung cuộn
 * có nút mũi tên trái/phải. Hàm THUẦN — chỉ đọc layout THẬT của chính
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
 * @param {number} position - vị trí X đích (từ `getStepScrollTarget()`).
 * @param {boolean} animate - true = cuộn mượt (`behavior:'smooth'`), false = nhảy thẳng tức thời
 *        (`behavior:'instant'`) — dùng lúc đóng hẳn/đặt lại trạng thái, không cần mượt.
 */
function scrollSliderTo(containerEl, position, animate) {
    containerEl.scrollTo({ left: position, behavior: animate ? 'smooth' : 'instant' });
}
