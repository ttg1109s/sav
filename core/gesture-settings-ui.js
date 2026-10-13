/**
 * core/gesture-settings-ui.js — đồng bộ giá trị vizConfig vào panel Gesture Settings đang hiện trong Generic Drawer
 * (template components/gesture-settings-drawer.js::renderGestureSettingsPanelBody()). Gọi từ workflowGestureSettings.
 * Không đọc appState, không gọi core khác. Phần tử không có -> bỏ qua.
 */

/** id ô select -> field vizConfig (7 action picker + 3 ô Action). Giá trị rỗng -> 'none'. */
const GESTURE_SETTINGS_SELECT_FIELD_BY_ID = {
    'setting-gesture-action-swipe-up': 'gestureActionSwipeUp',
    'setting-gesture-action-swipe-down': 'gestureActionSwipeDown',
    'setting-gesture-action-swipe-left': 'gestureActionSwipeLeft',
    'setting-gesture-action-swipe-right': 'gestureActionSwipeRight',
    'setting-gesture-action-tap-single': 'gestureActionTapSingle',
    'setting-gesture-action-tap-double': 'gestureActionTapDouble',
    'setting-gesture-triple-tap-target': 'gestureTripleTapTarget',
    'setting-gesture-action-slot-1': 'gestureActionSlot1',
    'setting-gesture-action-slot-2': 'gestureActionSlot2',
    'setting-gesture-action-slot-3': 'gestureActionSlot3',
};
/** id checkbox -> field vizConfig. Chưa có giá trị (khác `false`) -> bật. */
const GESTURE_SETTINGS_CHECK_FIELD_BY_ID = {
    'setting-gesture-seek-hold-enable': 'gestureSeekHoldEnabled',
    'setting-gesture-edge-top': 'gestureEdgeTopEnabled',
};
/** id nhãn số giây -> field vizConfig (ms), hiện dạng "2.0s". */
const GESTURE_SETTINGS_SECONDS_FIELD_BY_ID = {
    'gesture-seek-step-value': 'gestureSeekStepMs',
    'gesture-seek-hold-interval-value': 'gestureSeekHoldIntervalMs',
};

/** Ghi mọi ô của panel khớp `cfg`. @param {HTMLElement} panelEl @param {object} cfg - appConfigViz.getAll() */
function fillGestureSettingsPanel(panelEl, cfg) {
    Object.entries(GESTURE_SETTINGS_SELECT_FIELD_BY_ID).forEach(([id, field]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.value = cfg[field] || 'none';
    });
    Object.entries(GESTURE_SETTINGS_CHECK_FIELD_BY_ID).forEach(([id, field]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.checked = cfg[field] !== false;
    });
    Object.entries(GESTURE_SETTINGS_SECONDS_FIELD_BY_ID).forEach(([id, field]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.textContent = `${((cfg[field] || 0) / 1000).toFixed(1)}s`;
    });
}
