/**
 * event/router/file-manager-document.js — Router tên "fileManagerDocument", tự đăng ký với
 * eventBus lúc nạp. CHỐT 03/07/2026 (plan-v12-multimedia-decisions.md mục 1a/2/7) — panel
 * "Documents" (đổi tên từ "Văn bản"/Text, b4) mở thẳng từ section File Manager trong Settings.
 *
 * ĐÃ CODE THẬT (04/07/2026) — 'open'/'upload.change'/'create.click' đều ≥2 bước (đọc DB/mammoth.js/
 * modal xác nhận + vẽ lại) -> giao workflowFileManagerDocument.
 *
 * Batch D7 (Settings restructure, 06/07/2026 — batch CUỐI Nhóm D) — 'open' ĐỔI TÊN
 * 'openPanel.click'. Case 'close' ĐÃ XOÁ — đóng dùng CHUNG 'settingsStackNav.back.click'.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-document.js, core/settings-panel-stack.js
 * (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-document.js.
 */
const routerFileManagerDocument = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerDocument.openPanel.click': {
                workflowFileManagerDocument.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
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
