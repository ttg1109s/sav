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

// XOÁ (v13 Batch A) — listener cho `videoEnableToggle` (#setting-video-enable) ĐÃ BỎ HẲN cùng
// chính toggle đó: "Video nền" giờ là 1 tổ hợp (mediaType='video') bên trong panel "Visual
// Background", điều khiển qua cụm router `visualBg` (event/listener,router,workflow/visual-bg.js).
// Cơ chế "controlled toggle" + Block gate khoá chéo với Video Player mode KHÔNG mất — chuyển sang
// đúng msg.type mới của cụm đó (xem event/block.js, field 'visualBgConfig.enabled').

if (typeof visualEnabledToggle !== 'undefined' && visualEnabledToggle) {
    visualEnabledToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.visualEnable.change', payload: { checked: e.target.checked } });
    });
}

// (LỊCH SỬ) block listener `videoUploadInput` (change + cancel) đã xoá 21/07/2026 — input
// `#setting-video-upload` không còn tồn tại trong DOM.
//
// XOÁ (v13 Batch A) — listener cho `settingVisualBgImageEnableToggle` (#setting-visual-bg-image-enable)
// ĐÃ BỎ HẲN cùng chính toggle đó: "Ảnh nền Visual" giờ là tổ hợp (mediaType='image' +
// sourceMode='single') bên trong panel "Visual Background" — xem event/listener/visual-bg.js.
