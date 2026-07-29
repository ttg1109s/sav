/**
 * event/router/stats-panel.js — Router cho cụm "Stats Panel Toggle" (dải BPM/Pitch/Energy).
 *
 * SỬA (phản hồi Giang, mục 3 — "nhớ trạng thái shuffle/repeat/stats") — TỪNG chỉ cần đúng 1 hàm
 * core (toggleStatsPanelVisibility()) -> gọi THẲNG, KHÔNG có workflow. Giờ cần thêm bước lưu bền
 * config (đụng IndexedDB, async) NGAY SAU — 2 bước nối tiếp -> giao workflowStatsPanel (event/
 * workflow/stats-panel.js, MỚI).
 * KHÔNG giữ state context riêng (isStatsPanelVisible là global ở core, không phải state context
 * của router — xem mục 2b.1).
 */
const routerStatsPanel = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'statsPanel.toggle.click':
                workflowStatsPanel.toggleAndPersist();
                break;
            default:
                console.warn(`[routerStatsPanel] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('statsPanel', routerStatsPanel);
