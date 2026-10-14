/**
 * event/listener/visualizer-display.js — Listener cụm "visualizerDisplay": #btn-cycle-mode (pointerdown/up/cancel/leave
 * đếm giờ giữ 1.5s mở Custom Effect Drawer — cùng khuôn #btn-cycle-eq; `click` riêng mở modal chọn effect, giữ cho
 * Action slot của cử chỉ bấm hộ), panel "Display" (ủy quyền trên genericDrawerBody), dropdown group của modal chọn effect
 * (ủy quyền trên document.body).
 *
 * NẠP SAU: event/bus.js, event/router/visualizer-display.js, core/dom-refs.js.
 */

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

// ===================== Volume (HUD Control Center, event/listener/hud.js) =====================
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

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('change', handleVisualizerDisplayPanelChange);
}

// ===================== Modal chọn effect (modalChoice() gắn vào document.body — ủy quyền) =====================
document.body.addEventListener('change', (e) => {
    if (e.target.id !== 'effect-picker-group') return;
    eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.effectPicker.group.change', payload: { group: e.target.value } });
});
