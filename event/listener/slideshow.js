/**
 * event/listener/slideshow.js — TẤT CẢ listener của cụm "slideshowSettings" (Batch 8, ver 12
 * "Multi Media"). NẠP SAU CÙNG (sau bus, core, router, VÀ SAU dom-refs.js).
 */

if (btnOpenSlideshowSettings) {
    btnOpenSlideshowSettings.addEventListener('click', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.open', payload: {} });
    });
}

if (btnBackSlideshowSettings) {
    btnBackSlideshowSettings.addEventListener('click', () => {
        // Back trong drawer Slideshow chỉ ẩn drawer này — KHÔNG động vào #drawer-settings bên dưới.
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.close', payload: {} });
    });
}

if (btnSlideshowPickAlbum) {
    btnSlideshowPickAlbum.addEventListener('click', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.pickAlbum.click', payload: {} });
    });
}

if (btnSlideshowClearAlbum) {
    btnSlideshowClearAlbum.addEventListener('click', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.clearAlbum.click', payload: {} });
    });
}

if (slideshowModeSelect) {
    slideshowModeSelect.addEventListener('change', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.mode.change', payload: { value: slideshowModeSelect.value } });
    });
}

if (slideshowIntervalInput) {
    slideshowIntervalInput.addEventListener('change', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.interval.change', payload: { value: slideshowIntervalInput.value } });
    });
}

if (slideshowTransitionSelect) {
    slideshowTransitionSelect.addEventListener('change', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.transitionType.change', payload: { value: slideshowTransitionSelect.value } });
    });
}
