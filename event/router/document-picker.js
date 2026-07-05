/**
 * event/router/document-picker.js — Router tên "documentPicker", tự đăng ký với eventBus lúc nạp.
 *
 * NẠP SAU: event/bus.js, event/workflow/document-picker.js.
 * NẠP TRƯỚC: event/listener/document-picker.js.
 */
const routerDocumentPicker = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'documentPicker.open.click':
                workflowDocumentPicker.open(); // >1 hàm core (đọc DB + vẽ) -> workflow
                break;

            case 'documentPicker.close':
                workflowDocumentPicker.close();
                break;

            default:
                console.warn(`[routerDocumentPicker] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('documentPicker', routerDocumentPicker);
