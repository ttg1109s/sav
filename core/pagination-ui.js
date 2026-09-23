/**
 * core/pagination-ui.js — MỚI (23/09/2026, đi cùng đợt cải tiến core/pagination.js + Settings >
 * System > Pagination). Wire sự kiện cho thanh phân trang mà `workflowPagination.buildControlsHtml()`
 * (event/workflow/pagination.js) vừa dựng — hậu tố `-ui` (Rule 5c) vì có `addEventListener`.
 *
 * Rule 5a: callback CHỈ `eventBus.send()` — router + msg.type do NƠI DÙNG pagination truyền vào (mỗi
 * danh sách có router riêng của nó, vd 'statisPanel'), file này KHÔNG biết gì về danh sách nào. Payload
 * gửi đi = `{ ...extraPayload, pageIndex }` với `pageIndex` đọc thẳng từ `data-page-index` của nút vừa
 * bấm — template (core/pagination.js) đã ghi sẵn trang ĐÍCH lên MỌI nút (‹ › « » / số trang / "Tải
 * thêm"), nên ở đây không cần biết trang hiện tại, không cộng/trừ gì. Nút `disabled` không bắn `click`
 * (trình duyệt tự chặn) — không cần guard.
 *
 * Nơi dùng (Workflow) tự lo phần còn lại khi nhận message: ghi `pageIndex` mới vào state của mình rồi
 * dựng lại danh sách + thanh phân trang (gọi lại `workflowPagination.computePlaceView()`).
 *
 * NẠP SAU: event/bus.js (chỉ cần lúc CLICK, không cần lúc nạp).
 */

/**
 * @param {HTMLElement} containerEl - phần tử chứa HTML thanh phân trang (có thể rỗng — no-op).
 * @param {string} routerName - router nhận message (của nơi dùng pagination).
 * @param {string} msgType - msg.type (của nơi dùng pagination), vd 'statisPanel.topList.page.change'.
 * @param {object} [extraPayload] - field cộng thêm vào payload (vd id danh sách nếu 1 router có nhiều).
 */
function wirePaginationControls(containerEl, routerName, msgType, extraPayload) {
    if (!containerEl) return;
    const pageBtns = containerEl.querySelectorAll('[data-pagination-action][data-page-index]');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    pageBtns.forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: routerName, type: msgType, payload: { ...(extraPayload || {}), pageIndex: Number(btn.dataset.pageIndex) } }));
    });
}
