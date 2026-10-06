/**
 * event/router/zip-download.js — Router "zipDownload" (MỚI 06/10/2026) — modal tải nhiều phần zip, xem
 * event/workflow/zip-download.js. Mọi case giao thẳng Workflow (cần trạng thái modal đang mở). Message tới từ
 * core/zip-download-ui.js::wireZipPartsBody() (nút từng phần) và nút "Xong" của modalChoice().
 * NẠP SAU: event/bus.js, event/workflow/zip-download.js.
 */
const routerZipDownload = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'zipDownload.part.click': { workflowZipDownload.downloadPart(msg.payload.index); break; }
            case 'zipDownload.done.click': { workflowZipDownload.finishParts(); break; }
            default:
                console.warn(`[router:zipDownload] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('zipDownload', routerZipDownload);
