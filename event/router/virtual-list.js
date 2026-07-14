/**
 * event/router/virtual-list.js — Router "virtualList", đúng 1 msg.type ('virtualList.scroll').
 *
 * SỬA 14/07/2026 (tổng quát hoá theo `mountKey`, xem event/listener/virtual-list.js +
 * event/workflow/virtual-list.js) — TRƯỚC chỉ phục vụ `genericDrawerBody`. Riêng mount
 * 'genericDrawer': container dùng CHUNG nhiều tính năng (nội dung đổi liên tục — Document Reader tự
 * phân trang riêng, không phải windowing) nên vẫn giữ gate `appState.get
 * ('isGenericDrawerContentVirtual')` (ghi bởi core/generic-drawer.js) để không gọi
 * `handleScroll()` với nội dung KHÔNG phải danh sách windowing. Mount khác (vd 'photoGrid') —
 * container RIÊNG, không cần gate: `workflowVirtualList.handleScroll()` tự no-op nếu mount không
 * còn tồn tại (xem guard trong `redraw()`).
 *
 * NẠP SAU: event/bus.js, event/workflow/virtual-list.js, service/state.js (appState).
 */
const routerVirtualList = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'virtualList.scroll': {
                const { mountKey } = msg.payload;
                if (mountKey === 'genericDrawer' && !appState.get('isGenericDrawerContentVirtual')) break;
                workflowVirtualList.handleScroll(mountKey);
                break;
            }

            default:
                console.warn(`[router:virtualList] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('virtualList', routerVirtualList);
