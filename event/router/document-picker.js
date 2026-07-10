/**
 * event/router/document-picker.js — Router tên "documentPicker", tự đăng ký với eventBus lúc nạp.
 *
 * VIẾT LẠI (10/07/2026, Nhóm A — mục 5/6 plan-v12-extended.md): đây giờ là router DUY NHẤT còn
 * lại của toàn bộ tính năng Documents-Reader (event/router/document-reader.js CŨ ĐÃ XOÁ — xoá tay
 * nếu còn sót trên máy) — CHỈ còn 1 msg.type ('open.click', nút "Reader" ở Control Center). Mọi
 * tương tác BÊN TRONG Generic Drawer (đóng/back/sửa/next/prev...) giờ KHÔNG qua eventBus nữa —
 * `event/workflow/document-reader.js` tự querySelector + addEventListener trực tiếp lên
 * genericDrawerHeader/genericDrawerBody SAU MỖI lần render lại (đúng quy ước Generic Drawer, xem
 * docstring đầu core/generic-drawer.js) — router này vì vậy KHÔNG còn case 'close' như bản cũ.
 *
 * NẠP SAU: event/bus.js, event/workflow/document-reader.js (workflowDocumentReader.openPicker()).
 * NẠP TRƯỚC: event/listener/document-picker.js.
 */
const routerDocumentPicker = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'documentPicker.open.click':
                workflowDocumentReader.openPicker(); // >1 hàm core (đọc DB + vẽ) -> workflow
                break;

            default:
                console.warn(`[routerDocumentPicker] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('documentPicker', routerDocumentPicker);
