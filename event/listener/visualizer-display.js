/**
 * event/listener/visualizer-display.js — Listener cụm "visualizerDisplay": ảnh nền, độ mờ nền,
 * cycle effect (#btn-cycle-mode). Field cấu hình riêng effect (màu/blur/style con/kích thước) ĐÃ
 * DỜI sang Custom Effect Drawer (event/workflow/custom-effect.js, wiring TRỰC TIẾP không qua
 * eventBus — xem docstring core/generic-drawer.js).
 *
 * #btn-cycle-mode nghe THÊM pointerdown/up/cancel/leave (CÙNG khuôn #btn-cycle-eq, event/listener/
 * eq-presets.js) chỉ để đếm giờ giữ 1.5s — `click` riêng vẫn giữ (tương thích hệ Tap-3-lần/
 * Action-slot gọi `.click()` hộ).
 *
 * KHÔNG tự document.getElementById — dùng biến sẵn có ở core/dom-refs.js.
 * NẠP SAU CÙNG (sau bus, router/visualizer-display.js, core/settings-panel-stack.js, dom-refs.js).
 */

if (btnOpenVisualizerDisplay) {
    btnOpenVisualizerDisplay.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.openDisplayPanel.click', payload: {} });
    });
}

if (btnOpenVisualizerAutoSwitch) {
    btnOpenVisualizerAutoSwitch.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.openAutoSwitchPanel.click', payload: {} });
    });
}

if (btnCycleMode) {
    btnCycleMode.addEventListener('pointerdown', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cyclePress.start', payload: {} });
    });
    btnCycleMode.addEventListener('pointerup', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cyclePress.end', payload: {} });
    });
    btnCycleMode.addEventListener('pointercancel', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cyclePress.cancel', payload: {} });
    });
    btnCycleMode.addEventListener('pointerleave', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cyclePress.cancel', payload: {} });
    });
    btnCycleMode.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.cycle.click', payload: {} });
    });
}

if (bgBlurSlider) {
    bgBlurSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.bgBlur.input', payload: { value: e.target.value } });
    });
}

// ===================== Volume (HUD Control Center, event/listener/volume-hud.js) =====================
// EQ ở cụm "eqPresets" riêng (event/listener/eq-presets.js).

// ===================== Panel "Display" (settings-stack, delegate) =====================
// 5 toggle: Hiện Visual + 4 toggle UI chrome — xem components/settings/visualizer-display-panel.js.
const VISUALIZER_DISPLAY_PANEL_INPUT_MAP = {
    'setting-visual-enable': { type: 'visualizerDisplay.visualEnable.change' },
    'setting-stats-panel-enable': { type: 'visualizerDisplay.statsPanelEnable.change' },
    'setting-bottom-player-enable': { type: 'visualizerDisplay.bottomPlayerVisible.change' },
    'setting-playlist-button-enable': { type: 'visualizerDisplay.playlistButtonVisible.change' },
    'setting-control-center-button-enable': { type: 'visualizerDisplay.controlCenterButtonVisible.change' },
};

function handleVisualizerDisplayPanelChange(e) {
    const entry = VISUALIZER_DISPLAY_PANEL_INPUT_MAP[e.target.id];
    if (!entry) return;
    eventBus.send({ router: 'visualizerDisplay', type: entry.type, payload: { checked: e.target.checked } });
}

if (genericDrawerBody) { // SỬA (đợt migrate Visualizer Screen) — settingsStackBody nay thuộc Photo, nội dung này sống trong genericDrawerBody
    genericDrawerBody.addEventListener('change', handleVisualizerDisplayPanelChange);
}
