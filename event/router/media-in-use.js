/**
 * event/router/media-in-use.js — Router "mediaInUse" (MỚI 06/10/2026, plan-media-db-split.md mục 7) — request trung tâm
 * nạp lại media đang dùng sau khi nội dung file bị thay. Message tới từ các Workflow thay file (upload ghi đè, Video editor
 * "Ghi đè", sửa ảnh "Ghi đè", sửa thumbnail video). Việc kiểm state + quyết định nằm ở event/workflow/media-in-use.js.
 * NẠP SAU: event/bus.js, event/workflow/media-in-use.js.
 */
const routerMediaInUse = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'mediaInUse.contentReplaced': {
                workflowMediaInUse.handleContentReplaced(msg.payload.type, msg.payload.key)
                    .catch((err) => console.error('[router:mediaInUse] nạp lại media đang dùng lỗi:', err));
                break;
            }
            default:
                console.warn(`[router:mediaInUse] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('mediaInUse', routerMediaInUse);
