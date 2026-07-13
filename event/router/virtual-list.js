/**
 * event/router/virtual-list.js — Router tên "virtualList", tự đăng ký với eventBus lúc nạp.
 *
 * PHẠM VI: đúng 1 msg.type ('virtualList.scroll') — bắn từ event/listener/virtual-list.js mỗi lần
 * container đang windowing (xem event/workflow/virtual-list.js) cuộn.
 *
 * [SỬA 13/07/2026, Giang yêu cầu — tránh xung đột với nội dung KHÁC của Generic Drawer, vd
 * Document Reader] — Generic Drawer dùng CHUNG cho nhiều tính năng, container (`genericDrawerBody`)
 * là DUY NHẤT nhưng nội dung bên trong đổi liên tục (danh sách windowing / Document Reader tự phân
 * trang riêng / danh sách thường không windowing...). Listener KHÔNG biết nội dung hiện tại là gì
 * (đúng vai trò, chỉ forward sự kiện thô) — Router ở đây tự đọc `appState.get
 * ('isGenericDrawerContentVirtual')` (ghi bởi core/generic-drawer.js mỗi lần openGenericDrawer()/
 * updateGenericDrawer() chạy, xem docstring ở đó) để biết nội dung ĐANG HIỂN THỊ có phải danh sách
 * windowing hay không — KHÔNG đúng thì bỏ qua hẳn, tránh gọi `workflowVirtualList.handleScroll()`
 * với state cũ/không liên quan (Router được phép tự đọc `appState` để quyết định gọi hay không —
 * Rule 2/3 chỉ áp cho CORE, không áp cho Router).
 *
 * QUY TẮC RẼ NHÁNH (còn lại): cần 2 hàm core phụ thuộc kết quả nhau (computeVirtualWindowRange()
 * rồi renderItemList(), components/items.js) -> giao Workflow (Rule 3, core-function-conventions.md).
 * Xem event/workflow/virtual-list.js::handleScroll().
 *
 * NẠP SAU: event/bus.js, event/workflow/virtual-list.js, service/state.js (appState).
 */
const routerVirtualList = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'virtualList.scroll': {
                if (!appState.get('isGenericDrawerContentVirtual')) break; // Drawer đang hiện nội dung KHÁC (vd Document Reader) -> bỏ qua
                workflowVirtualList.handleScroll(msg.payload);
                break;
            }

            default:
                console.warn(`[router:virtualList] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('virtualList', routerVirtualList);
