/**
 * event/listener/gesture-settings.js — TẤT CẢ listener của cụm "gestureSettings".
 *
 * #setting-open-gesture-settings tĩnh (dom-refs.js). Toàn bộ input còn lại SỐNG BÊN TRONG panel
 * push/pop động (core/settings-panel-stack-ui.js) — CÙNG khuôn Visualizer Settings
 * (event/listener/visualizer-display.js): 1 listener delegate (change) trên `settingsStackBody`.
 */
if (btnOpenGestureSettings) {
    btnOpenGestureSettings.addEventListener('click', () => {
        eventBus.send({ router: 'gestureSettings', type: 'gestureSettings.openPanel.click', payload: {} });
    });
}

const GESTURE_SETTINGS_INPUT_MAP = {
    'setting-gesture-action-swipe-up': { type: 'gestureSettings.swipeUp.change', checkbox: false },
    'setting-gesture-action-swipe-down': { type: 'gestureSettings.swipeDown.change', checkbox: false },
    'setting-gesture-action-swipe-left': { type: 'gestureSettings.swipeLeft.change', checkbox: false },
    'setting-gesture-action-swipe-right': { type: 'gestureSettings.swipeRight.change', checkbox: false },
    'setting-gesture-action-tap-single': { type: 'gestureSettings.tapSingle.change', checkbox: false },
    'setting-gesture-action-tap-double': { type: 'gestureSettings.tapDouble.change', checkbox: false },
    'setting-gesture-edge-top': { type: 'gestureSettings.edgeTop.change', checkbox: true },
    'setting-gesture-edge-bottom': { type: 'gestureSettings.edgeBottom.change', checkbox: true },
    'setting-gesture-edge-bottom-target': { type: 'gestureSettings.edgeBottomTarget.change', checkbox: false },
};

if (settingsStackBody) {
    settingsStackBody.addEventListener('change', (e) => {
        const entry = GESTURE_SETTINGS_INPUT_MAP[e.target.id];
        if (!entry) return;
        const payload = entry.checkbox ? { checked: e.target.checked } : { value: e.target.value };
        eventBus.send({ router: 'gestureSettings', type: entry.type, payload });
    });
}
