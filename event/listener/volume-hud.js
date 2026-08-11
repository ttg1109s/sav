/**
 * event/listener/volume-hud.js — TẤT CẢ listener của cụm "volumeHud".
 *
 * Cả 2 phần tử ĐỀU tĩnh (có sẵn từ lúc boot, components/visualizer-overlay.js) — addEventListener
 * trực tiếp bình thường, KHÔNG cần delegate như Settings Stack/Generic Drawer.
 */
if (btnOpenVolume) {
    btnOpenVolume.addEventListener('click', () => {
        eventBus.send({ router: 'volumeHud', type: 'volumeHud.open.click', payload: {} });
    });
}

if (volumeHudSlider) {
    volumeHudSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'volumeHud', type: 'volumeHud.slider.input', payload: { value: e.target.value } });
    });
}
