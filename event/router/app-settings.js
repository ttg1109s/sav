/**
 * event/router/app-settings.js — Router tên "appSettings", tự đăng ký với eventBus lúc nạp.
 * Điều phối toàn bộ điều hướng Setting (Main/System/Playlist/Theme/Gesture/Motion/Language/
 * Visualizer Screen/Troubleshooting) — mọi nút động (Rule 5a) chỉ gửi message tới đây, KHÔNG gọi
 * thẳng workflowAppSettings (xem core/app-settings-ui.js).
 *
 * `NAV_TARGETS` — bảng tra key -> hàm render đích, dùng cho case 'appSettings.nav.click'. Đây là
 * Router đọc THẲNG payload của CHÍNH message đang xử lý (không đọc appState khác để quyết định
 * chạy gì) — đúng (A) event-bus-flow.md mục 4B, KHÔNG cần VirtualMachineState.
 *
 * NẠP SAU: event/bus.js, event/workflow/app-settings.js.
 * NẠP TRƯỚC: core/app-settings-ui.js (KHÔNG bắt buộc thứ tự với core-ui vì core-ui chỉ gọi
 * eventBus.send() lúc CLICK, không lúc nạp).
 */
const routerAppSettings = (() => {
    const NAV_TARGETS = {
        playlist: () => workflowAppSettings._renderPlaylist(),
        system: () => workflowAppSettings._renderSystem(),
        visualizerScreen: () => workflowAppSettings._renderVisualizerScreen(),
        troubleshooting: () => workflowAppSettings._renderTroubleshooting(),
        theme: () => workflowAppSettings._renderTheme(),
        gesture: () => workflowAppSettings._renderGesture(),
        motion: () => workflowAppSettings._renderMotion(),
        language: () => workflowAppSettings._renderLanguage(),
        playlistSort: () => workflowAppSettings._renderPlaylistSort(),
        playlistFilter: () => workflowAppSettings._renderPlaylistFilter(),
        display: () => workflowAppSettings._renderDisplay(),
        autoSwitch: () => workflowAppSettings._renderAutoSwitch(),
        visualBg: () => workflowAppSettings._renderVisualBg(),
        // MỚI (29/08/2026) — hệ Cấu hình Motion, xem event/workflow/motion-presets.js.
        motionManage: () => workflowAppSettings._renderMotionManage(),
        motionApply: () => workflowAppSettings._renderMotionApply(),
        motionApplyPhotoVisualBg: () => workflowAppSettings._renderMotionApplyPhotoVisualBg(),
    };

    function handle(msg) {
        switch (msg.type) {

            case 'appSettings.nav.click': {
                const { key } = msg.payload;
                if (key === 'resetApp') { workflowAppSettings._openResetAppMenu(); break; } // KHÔNG điều hướng màn — modalChoice() độc lập
                const target = NAV_TARGETS[key];
                if (target) workflowAppSettings.navigateTo(target);
                break;
            }

            case 'appSettings.back.click': {
                workflowAppSettings.back();
                break;
            }

            case 'appSettings.close.click': {
                workflowAppSettings.close();
                break;
            }

            case 'appSettings.theme.selectMode.change': {
                workflowAppSettings.handleThemeSelectMode(msg.payload.mode);
                break;
            }

            case 'appSettings.theme.selectGlassType.change': {
                workflowAppSettings.handleThemeSelectGlassType(msg.payload.glassType, msg.payload.solidColor);
                break;
            }

            default:
                console.warn(`[router:appSettings] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('appSettings', routerAppSettings);
