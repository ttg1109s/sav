/**
 * event/workflow/photo-panel.js — "THẰNG THỰC THI CUỐI" của router "photoPanel" (MỚI). Đóng HẲN
 * Photo (khác Back trong Album List sub-panel, dùng chung `settingsStackNav`/`popSettingsPanel()`
 * — GIỮ NGUYÊN, không đổi gì).
 *
 * NẠP SAU: core/settings-panel-stack-ui.js (resetSettingsStackToMain), core/photo-panel.js
 * (hidePhotoPanel), event/workflow/app-panel-nav.js (activateMedia — liên tuyến domain, TH2
 * event-bus-flow.md mục 3a: đóng Photo luôn nghĩa là bottom nav phải quay về Media, tái dùng
 * THẲNG, không viết lại).
 * NẠP TRƯỚC: event/router/photo-panel.js.
 */
const workflowPhotoPanel = {
    close() {
        resetSettingsStackToMain(); // core/settings-panel-stack-ui.js — pop hết Album List sub-panel nếu đang mở
        hidePhotoPanel(); // core/photo-panel.js
        workflowAppPanelNav.activateMedia(); // event/workflow/app-panel-nav.js — liên tuyến domain
    },
};
