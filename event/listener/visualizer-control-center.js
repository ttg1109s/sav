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
    // MỚI (04/07/2026, mục 1 phản hồi Giang) — sự kiện 'cancel' chuẩn của <input type="file">
    // (hỗ trợ Chrome/Edge/most WebView hiện đại; trình duyệt cũ hơn chưa hỗ trợ sẽ bỏ qua, toggle
    // có thể kẹt "on" tới lần đổi khác — nợ kỹ thuật nhỏ, xem plan-v12-multimedia-update-5.md mục 1).
    // Bắn ra khi người dùng đóng hộp thoại chọn file của OS mà KHÔNG chọn gì — dùng để tự trả
    // #setting-video-enable về "off" (bug đã báo: gạt On mở hộp thoại, huỷ, toggle vẫn kẹt "on").
    videoUploadInput.addEventListener('cancel', () => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.videoUpload.cancel', payload: {} });
    });
}

// FIX (04/07/2026, mục 1 phản hồi Giang) — bỏ hẳn nút riêng #setting-visual-bg-image-pick (từng mở
// picker độc lập với toggle #setting-visual-bg-image-enable). Giờ CHỈ CÒN toggle — gạt "On" tự mở
// picker (xem event/workflow/visualizer-control-center.js::pickVisualBgImageFromLibrary), huỷ/
// không chọn gì thì tự gạt về "off" (fix đúng bug đã báo).
if (settingVisualBgImageEnableToggle) {
    settingVisualBgImageEnableToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.visualBgImageEnable.change', payload: { checked: e.target.checked } });
    });
}
