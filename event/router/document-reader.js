/**
 * event/router/document-reader.js — Router tên "documentReader", tự đăng ký với eventBus lúc nạp.
 * Toàn bộ msg.type ở đây đều ≥2 bước (đọc DB, tính layout, sửa DOM nhiều phần tử phối hợp) ->
 * giao hết cho workflowDocumentReader, TRỪ đóng cửa sổ (chỉ 1 hàm core patch DOM thuần) và
 * huỷ Sửa (chỉ 1 hàm core patch DOM thuần).
 *
 * NẠP SAU: event/bus.js, event/workflow/document-reader.js.
 * NẠP TRƯỚC: event/listener/document-reader.js.
 */
const routerDocumentReader = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'documentReader.openFromControlCenter.click':
                workflowDocumentReader.openFromControlCenter(); // >1 hàm core (đọc DB + vẽ) -> workflow
                break;

            case 'documentReader.close':
                workflowDocumentReader.close(); // >1 việc (ẩn DOM + dọn resize watcher + reset state) -> workflow
                break;

            case 'documentReader.prev.click':
                workflowDocumentReader.prevPage();
                break;

            case 'documentReader.next.click':
                workflowDocumentReader.nextPage();
                break;

            case 'documentReader.listToggle.click':
                workflowDocumentReader.toggleListDropdown(); // >1 hàm core (đọc DB + vẽ) -> workflow
                break;

            case 'documentReader.edit.click':
                workflowDocumentReader.enterEditMode();
                break;

            case 'documentReader.editCancel.click':
                workflowDocumentReader.cancelEdit();
                break;

            case 'documentReader.editSave.click':
                workflowDocumentReader.saveEdit(); // >1 hàm core (ghi DB + vẽ lại + báo workflow khác) -> workflow
                break;

            default:
                console.warn(`[routerDocumentReader] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('documentReader', routerDocumentReader);
