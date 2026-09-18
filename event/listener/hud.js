/**
 * event/listener/hud.js — TẤT CẢ listener của cụm "hud" (Volume + Speed).
 * Mọi phần tử ĐỀU tĩnh (có sẵn từ lúc boot, components/visualizer-overlay.js) — addEventListener
 * trực tiếp, KHÔNG cần delegate.
 */
if (btnOpenVolume) {
    btnOpenVolume.addEventListener('click', () => {
        eventBus.send({ router: 'hud', type: 'hud.volume.open.click', payload: {} });
    });
}

if (volumeHudSlider) {
    volumeHudSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'hud', type: 'hud.volume.slider.input', payload: { value: e.target.value } });
    });
}

if (btnOpenSpeed) {
    btnOpenSpeed.addEventListener('click', () => {
        eventBus.send({ router: 'hud', type: 'hud.speed.open.click', payload: {} });
    });
}

if (speedHudOptions) {
    speedHudOptions.forEach((btn) => {
        btn.addEventListener('click', () => {
            eventBus.send({ router: 'hud', type: 'hud.speed.option.click', payload: { value: btn.dataset.speedOption } });
        });
    });
}

// MỚI (18/09/2026, slider liên tục 0.5-2) — CÙNG khuôn volumeHudSlider ngay trên.
if (speedHudSlider) {
    speedHudSlider.addEventListener('input', (e) => {
        eventBus.send({ router: 'hud', type: 'hud.speed.slider.input', payload: { value: e.target.value } });
    });
}
