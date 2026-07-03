/**
 * event/listener/visualizer-control-center.js — TẤT CẢ listener của cụm
 * "visualizerControlCenter".
 */
if (btnReturnVisual) {
    btnReturnVisual.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.returnToVisualizer.click', payload: {} });
    });
}

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
    // Bấm bất kỳ icon nào trong grid (data-cc-action) -> đóng panel ngay.
    visualizerControlCenter.addEventListener('click', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.gridClick', payload: { target: e.target } });
    });
}

if (videoEnableToggle) {
    videoEnableToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.videoEnable.change', payload: { checked: e.target.checked } });
    });
}

if (typeof visualEnabledToggle !== 'undefined' && visualEnabledToggle) {
    visualEnabledToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.visualEnable.change', payload: { checked: e.target.checked } });
    });
}

if (videoUploadInput) {
    videoUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.videoUpload.change', payload: { file } });
    });
}

// MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer (toggle bật/tắt + nút mở picker),
// cùng cụm với video nền (đúng vai trò "nền màn Visualizer").
if (settingVisualBgImageEnableToggle) {
    settingVisualBgImageEnableToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.visualBgImageEnable.change', payload: { checked: e.target.checked } });
    });
}

if (btnSettingVisualBgImagePick) {
    btnSettingVisualBgImagePick.addEventListener('click', () => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.visualBgImagePick.click', payload: {} });
    });
}
