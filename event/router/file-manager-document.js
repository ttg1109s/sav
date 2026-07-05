/**
 * event/router/file-manager-document.js — Router tên "fileManagerDocument", tự đăng ký với
 * eventBus lúc nạp. CHỐT 03/07/2026 (plan-v12-multimedia-decisions.md mục 1a/2/7) — drawer con
 * "Documents" (đổi tên từ "Văn bản"/Text, b4) mở thẳng từ section File Manager trong Settings.
 *
 * ĐÃ CODE THẬT (04/07/2026) — 'close' vẫn CHỈ 1 hàm core patch DOM thuần (gọi thẳng); 'open'/
 * 'upload.change'/'create.click' đều ≥2 bước (đọc DB/mammoth.js/modal xác nhận + vẽ lại) -> giao
 * workflowFileManagerDocument.
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (hideFileManagerDocumentDrawer),
 * event/workflow/file-manager-document.js.
 * NẠP TRƯỚC: event/listener/file-manager-document.js.
 */
const routerFileManagerDocument = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerDocument.open': {
                workflowFileManagerDocument.openDrawer(); // >1 hàm core nối tiếp (DOM + đọc DB + vẽ) -> workflow
                break;
            }
            case 'fileManagerDocument.close': {
                hideFileManagerDocumentDrawer();
                break;
            }
            // MỚI (04/07/2026, tính năng Documents) — upload/tạo mới, cả 2 CẦN >1 bước (đọc file/
            // mammoth.js/modal xác nhận + lưu DB + vẽ lại) -> workflow.
            case 'fileManagerDocument.upload.change': {
                workflowFileManagerDocument.handleUploadFile(msg.payload.file);
                break;
            }
            case 'fileManagerDocument.create.click': {
                workflowFileManagerDocument.createNewDocument();
                break;
            }
            default:
                console.warn(`[router:fileManagerDocument] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerDocument', routerFileManagerDocument);
