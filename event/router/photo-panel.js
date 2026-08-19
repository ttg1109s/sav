/**
 * event/router/photo-panel.js — Router tên "photoPanel", tự đăng ký với eventBus lúc nạp. Chỉ 1
 * nhánh: đóng hẳn Photo (nút X ở header Main) — luôn cần Workflow (≥2 lời gọi core nối tiếp: reset
 * ngăn xếp Album List + ẩn panel + đồng bộ lại bottom nav, đúng event-bus-flow.md mục 4B).
 *
 * NẠP SAU: event/bus.js, event/workflow/photo-panel.js.
 * NẠP TRƯỚC: event/listener/photo-panel.js.
 */
const routerPhotoPanel = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'photoPanel.close.click': {
                workflowPhotoPanel.close();
                break;
            }

            default:
                console.warn(`[router:photoPanel] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('photoPanel', routerPhotoPanel);
