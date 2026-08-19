/**
 * event/workflow/placeholder-panels.js — "THẰNG THỰC THI CUỐI" của router "placeholderPanels".
 *
 * NẠP SAU: core/placeholder-panel.js (hidePlaceholderPanel), event/workflow/app-panel-nav.js
 * (activateMedia — liên tuyến domain, TH2 event-bus-flow.md mục 3a).
 * NẠP TRƯỚC: event/router/placeholder-panels.js.
 */
const workflowPlaceholderPanels = {
    /** @param {HTMLElement} panelEl - gamePanel hoặc statisPanel (core/dom-refs.js). */
    close(panelEl) {
        hidePlaceholderPanel(panelEl); // core/placeholder-panel.js
        workflowAppPanelNav.activateMedia(); // event/workflow/app-panel-nav.js
    },
};
