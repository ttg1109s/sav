/**
 * event/listener/slideshow.js — TẤT CẢ listener của cụm "slideshowSettings" (Batch 8, ver 12
 * "Multi Media"; VIẾT LẠI Batch 9, 04/07/2026, mục 4 — toggle DUY NHẤT thay 2 nút Chọn/Tắt cũ +
 * panel chọn Album kiểu "notify center"). NẠP SAU CÙNG (sau bus, core, router, VÀ SAU dom-refs.js).
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

// MỚI (Batch 9, mục 4) — toggle "Use slideshow" DUY NHẤT (THAY 2 nút "Chọn Album"/"Tắt" cũ).
if (settingSlideshowEnableToggle) {
    settingSlideshowEnableToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.enable.change', payload: { checked: e.target.checked } });
    });
}

if (slideshowCurrentAlbumRow) {
    slideshowCurrentAlbumRow.addEventListener('click', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.currentAlbumRow.click', payload: {} });
    });
}

if (slideshowAlbumPickerOverlay) {
    slideshowAlbumPickerOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.albumPicker.overlay.click', payload: {} });
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
