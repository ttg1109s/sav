/**
 * event/workflow/stats-panel.js — MỚI (phản hồi Giang, mục 3 — "thêm nhớ trạng thái shuffle/
 * repeat/stats của icon Control Center"). File này TRƯỚC ĐÂY không tồn tại (docstring cũ ở
 * event/router/stats-panel.js ghi rõ "chỉ 1 msg.type, chỉ cần đúng 1 hàm core -> gọi THẲNG, KHÔNG
 * có event/workflow/stats-panel.js") — giờ CẦN vì `toggleStatsPanelVisibility()` (core/stats-
 * panel-toggle.js) đơn tuyến vẫn giữ NGUYÊN, nhưng router cần thêm bước lưu bền
 * (`workflowPlayerControls._persistPlayerConfig()`, async, đụng IndexedDB) NGAY SAU — 2 bước nối
 * tiếp -> đúng hình dạng Workflow (event-bus-flow.md mục 4B), không còn "gọi thẳng core" 1 bước.
 *
 * NẠP SAU: core/stats-panel-toggle.js (toggleStatsPanelVisibility), event/workflow/
 * player-controls.js (_persistPlayerConfig() — Workflow gọi Workflow miền khác, tự do).
 * NẠP TRƯỚC: event/router/stats-panel.js.
 */
const workflowStatsPanel = {
    /** Ứng với 'statsPanel.toggle.click'. */
    toggleAndPersist() {
        toggleStatsPanelVisibility(); // core có sẵn (core/stats-panel-toggle.js)
        workflowPlayerControls._persistPlayerConfig(); // event/workflow/player-controls.js
    },
};
