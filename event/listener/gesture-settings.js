/**
 * event/listener/gesture-settings.js — TẤT CẢ listener của cụm "gestureSettings".
 *
 * #setting-open-gesture-settings tĩnh (dom-refs.js). 7 input còn lại SỐNG BÊN TRONG panel push/pop
 * động (core/settings-panel-stack-ui.js) — CÙNG khuôn 14 input Visualizer Settings
 * (event/listener/visualizer-display.js): 1 cặp listener delegate (change) trên `settingsStackBody`
 * thay vì 7 listener riêng trên dom-refs tĩnh (không tồn tại tĩnh).
 */
if (btnOpenGestureSettings) {
    btnOpenGestureSettings.addEventListener('click', () => {
        eventBus.send({ router: 'gestureSettings', type: 'gestureSettings.openPanel.click', payload: {} });
    });
}

const GESTURE_SETTINGS_INPUT_MAP = {
    'setting-gesture-video-nav': { type: 'gestureSettings.videoNav.change', checkbox: true },
    'setting-gesture-song-nav': { type: 'gestureSettings.songNav.change', checkbox: true },
    'setting-gesture-tap-play-pause': { type: 'gestureSettings.tapPlayPause.change', checkbox: true },
    'setting-gesture-double-tap-playlist': { type: 'gestureSettings.doubleTapPlaylist.change', checkbox: true },
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
