/**
 * core/pagination-ui.js — wire sự kiện cho thanh phân trang (template: components/pagination-controls.js, dựng qua
 * workflowPagination.buildControlsHtml()). Callback chỉ `eventBus.send()` — router + msg.type do nơi dùng truyền vào
 * (file này không biết danh sách nào). Payload = `{ ...extraPayload, pageIndex }`, `pageIndex` đọc từ `data-page-index`
 * của nút vừa bấm (template ghi sẵn trang ĐÍCH lên mọi nút). Nút `disabled` không bắn `click`.
 *
 * NẠP SAU: event/bus.js (chỉ cần lúc click).
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
