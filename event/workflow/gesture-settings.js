/**
 * event/workflow/gesture-settings.js — "THẰNG THỰC THI CUỐI" của router "gestureSettings".
 *
 * setSelectField(field, value) DÙNG CHUNG cho cả 6 dropdown action picker (4 hướng vuốt + 2 tap)
 * LẪN dropdown gestureEdgeBottomTarget — tất cả CÙNG process: ghi 1 field string vào vizConfig +
 * saveConfig() (khác giá trị/field, không phải khác kịch bản nghiệp vụ — xem readme/
 * core-function-conventions.md, Rule 1 test). setToggle(field, checked) tương tự cho 2 checkbox
 * còn lại (vuốt cạnh trên/dưới, boolean).
 */
const workflowGestureSettings = {

    /** Ứng với 'gestureSettings.openPanel.click'. */
    openPanel() {
        const panelEl = pushSettingsPanel({ title: t('gestureSettings.title'), bodyHtml: renderGestureSettingsPanelBody() });
        const cfg = appConfigViz.getAll();
        panelEl.querySelector('#setting-gesture-action-swipe-up').value = cfg.gestureActionSwipeUp || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-down').value = cfg.gestureActionSwipeDown || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-left').value = cfg.gestureActionSwipeLeft || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-right').value = cfg.gestureActionSwipeRight || 'none';
        panelEl.querySelector('#setting-gesture-action-tap-single').value = cfg.gestureActionTapSingle || 'none';
        panelEl.querySelector('#setting-gesture-action-tap-double').value = cfg.gestureActionTapDouble || 'none';
        panelEl.querySelector('#setting-gesture-edge-top').checked = cfg.gestureEdgeTopEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-bottom').checked = cfg.gestureEdgeBottomEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-bottom-target').value = cfg.gestureEdgeBottomTarget || 'cycleMode';
    },

    /** Ứng với 2 msg.type 'gestureSettings.edgeTop/edgeBottom.change'.
     * @param {string} field @param {boolean} checked */
    setToggle(field, checked) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = checked; });
        console.log(`writer: "workflowGestureSettings.setToggle", page: "vizConfig.${field}", content: "${checked}"`);
        saveConfig();
    },

    /** Ứng với 7 msg.type còn lại (6 action picker + edgeBottomTarget).
     * @param {string} field @param {string} value */
    setSelectField(field, value) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = value; });
        console.log(`writer: "workflowGestureSettings.setSelectField", page: "vizConfig.${field}", content: "${value}"`);
        saveConfig();
    },
};
