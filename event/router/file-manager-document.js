/**
 * event/router/file-manager-document.js — Router tên "fileManagerDocument", tự đăng ký với
 * eventBus lúc nạp. CHỐT 03/07/2026 (plan-v12-multimedia-decisions.md mục 1a/2/7) — drawer con
 * "Documents" (đổi tên từ "Văn bản"/Text, b4) mở thẳng từ section File Manager trong Settings.
 *
 * Hiện CHỈ có mở/đóng (nội dung thật của b4 CHƯA code, đang placeholder "sắp ra mắt") — cả 2 đều
 * CHỈ 1 hàm core patch DOM thuần (core/file-manager/nav.js), không cần workflow.
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (showFileManagerDocumentDrawer/
 * hideFileManagerDocumentDrawer).
 * NẠP TRƯỚC: event/listener/file-manager-document.js.
 */
const routerFileManagerDocument = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerDocument.open': {
                showFileManagerDocumentDrawer();
                break;
            }
            case 'fileManagerDocument.close': {
                hideFileManagerDocumentDrawer();
                break;
            }
            default:
                console.warn(`[router:fileManagerDocument] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerDocument', routerFileManagerDocument);
