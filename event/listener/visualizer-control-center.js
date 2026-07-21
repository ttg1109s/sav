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

// SỬA (21/07/2026, dọn dẹp sau Batch 2 module Video) — block listener `videoUploadInput`
// (change + cancel) ĐÃ XOÁ HẲN — input `#setting-video-upload` không còn tồn tại trong DOM (xem
// components/settings/visualizer-geometry-color.js), thay bằng Generic Drawer picker
// (event/workflow/file-manager-video.js::openVideoBgPicker(), gọi từ
// event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle()).

// FIX (04/07/2026, mục 1 phản hồi Giang) — bỏ hẳn nút riêng #setting-visual-bg-image-pick (từng mở
// picker độc lập với toggle #setting-visual-bg-image-enable). Giờ CHỈ CÒN toggle — gạt "On" tự mở
// picker (xem event/workflow/visualizer-control-center.js::pickVisualBgImageFromLibrary), huỷ/
// không chọn gì thì tự gạt về "off" (fix đúng bug đã báo).
if (settingVisualBgImageEnableToggle) {
    settingVisualBgImageEnableToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.visualBgImageEnable.change', payload: { checked: e.target.checked } });
    });
}
