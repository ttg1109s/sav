/**
 * event/router/theme.js — Router "theme" (nền App: Light/Dark/Morphin None/Gradient/Background media), tự đăng ký với eventBus
 * lúc nạp. Mọi việc giao event/workflow/theme.js (workflowTheme).
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, event/workflow/theme.js. NẠP TRƯỚC: event/listener/theme.js.
 */
const routerTheme = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'theme.selectMode.click': {
                // Rẽ theo `mode` của payload: card khác media -> chốt mode; card media -> dùng lại item đã có (chưa có -> bỏ qua).
                const { mode } = msg.payload;
                VirtualMachineState.run([
                    { state: mode, operation: '!==', value: 'background', callback: () => workflowTheme.commitThemeMode(mode) },
                    { state: mode, operation: '===', value: 'background', callback: () => workflowTheme.reuseExistingBackgroundMedia() },
                ]);
                break;
            }
            case 'theme.pickBackgroundMedia.click': // nút Photo/Video dưới card Background media
                workflowTheme.pickBackgroundMedia(msg.payload.kind);
                break;
            case 'theme.mediaPicker.tile.click': // bấm 1 item trong picker (msgPrefix 'theme.mediaPicker')
                workflowTheme.handleMediaPickerTileClick(msg.payload);
                break;
            case 'theme.mediaPicker.close.click':
                workflowTheme.handleMediaPickerCloseClick();
                break;
            case 'theme.appStackScreen.change':
                workflowTheme.onAppStackScreenChange();
                break;
            case 'theme.documentVisibility.change':
                workflowTheme.onDocumentVisibilityChange();
                break;
            case 'theme.glassBlur.input': // hàng "Panel glass"
                workflowTheme.setAppGlassBlur(msg.payload.value);
                break;
            case 'theme.glassTint.input':
                workflowTheme.setAppGlassTint(msg.payload.value);
                break;
            case 'theme.gradientFrom.input':
                workflowTheme.setGradientFrom(msg.payload.value);
                break;
            case 'theme.gradientTo.input':
                workflowTheme.setGradientTo(msg.payload.value);
                break;
            default:
                console.warn(`[routerTheme] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('theme', routerTheme);
