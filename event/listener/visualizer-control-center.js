/**
 * event/listener/visualizer-control-center.js — listener cụm "visualizerControlCenter" (nút mở, overlay, grid icon).
 * "Hiện Visual" ở panel Display — event/listener/visualizer-display.js.
 */

if (btnOpenControlCenter) {
    btnOpenControlCenter.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.toggle.click', payload: {} });
    });
}

if (controlCenterOverlay) {
    controlCenterOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.overlay.click', payload: {} });
    });
}

if (visualizerControlCenter) {
    // Ủy quyền: bấm icon trong grid (data-cc-action) -> đóng panel.
    visualizerControlCenter.addEventListener('click', (e) => {
        if (!e.target.closest('[data-cc-action]')) return;
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.gridAction.click', payload: {} });
    });
}
