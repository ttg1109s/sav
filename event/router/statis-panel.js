/**
 * event/router/statis-panel.js — MỚI (Giang yêu cầu "tích hợp 1+2+3"). Router tên "statisPanel"
 * (toggle sort + chip lọc trong Top list). 2 case, mỗi case CHỈ 1 hàm Workflow -> gọi THẲNG, KHÔNG
 * giữ state context riêng (msg.payload lấy thẳng từ `data-sort-mode`/`data-filter-type` gắn lúc
 * dựng, xem core/statis-panel-ui.js) — cùng khuôn router "gameCatalog". Nút Close panel VẪN dùng
 * CHUNG router "placeholderPanels" cũ (KHÔNG đổi gì — xem event/router/placeholder-panels.js), CÙNG
 * cách Game giữ nguyên `btn-game-panel-close` trên router đó dù đã graduate sang "gameCatalog".
 *
 * NẠP SAU: event/bus.js, event/workflow/statis-panel.js.
 * NẠP TRƯỚC: event/listener/statis-panel.js.
 */
const routerStatisPanel = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'statisPanel.sort.click':
                workflowStatisPanel.setSortMode(msg.payload.mode);
                break;

            case 'statisPanel.filter.click':
                workflowStatisPanel.setFilterType(msg.payload.type);
                break;

            default:
                console.warn(`[router:statisPanel] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('statisPanel', routerStatisPanel);
