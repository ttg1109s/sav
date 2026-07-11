/**
 * event/router/subtitle-modal.js — Router tên "subtitleModal", tự đăng ký với eventBus.
 *
 * VIẾT LẠI (10/07/2026) — CHỈ còn 1 msg.type (nút "Sub" ở Control Center mở Subtitle Editor cho
 * bài đang phát) — mọi msg.type khác (editSub/saveSub/deleteSub/autoTiming/addLine/exportSrt/
 * importSrt/apply) ĐÃ CHUYỂN sang router "subtitleEditor" (trang riêng).
 */
const routerSubtitleModal = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'subtitleModal.openEditor.click': {
                workflowSubtitleModal.openEditor(); // >1 bước (đọc currentKey, mã hoá, điều hướng/cảnh báo) -> workflow
                break;
            }

            default:
                console.warn(`[routerSubtitleModal] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleModal', routerSubtitleModal);
