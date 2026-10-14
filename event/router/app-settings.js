/**
 * event/router/app-settings.js — Router "appSettings" (điều hướng Setting: Main/System/Playlist/Theme/Gesture/Motion/Language/
 * Pagination/Visualizer Screen/Player/Troubleshooting), tự đăng ký với eventBus lúc nạp. Nút động (core/app-settings-ui.js) chỉ
 * gửi message tới đây.
 *
 * `NAV_TARGETS` — key -> hàm render đích cho 'appSettings.nav.click' (Router đọc payload của chính message, không cần
 * VirtualMachineState).
 *
 * NẠP SAU: event/bus.js, event/workflow/app-settings.js.
 */
const routerAppSettings = (() => {
    const NAV_TARGETS = {
        playlist: () => workflowAppSettings._renderPlaylist(),
        system: () => workflowAppSettings._renderSystem(),
        visualizerScreen: () => workflowAppSettings._renderVisualizerScreen(),
        troubleshooting: () => workflowAppSettings._renderTroubleshooting(),
        debugConsole: () => workflowAppSettings._renderDebugConsole(), // con của Troubleshooting
        videoThumb: () => workflowAppSettings._renderVideoThumbRepair(), // con của Troubleshooting
        perfHud: () => workflowAppSettings._renderPerfHudSettings(), // con của Troubleshooting
        theme: () => workflowAppSettings._renderTheme(),
        gesture: () => workflowAppSettings._renderGesture(),
        motion: () => workflowAppSettings._renderMotionList(),
        language: () => workflowAppSettings._renderLanguage(),
        playlistSort: () => workflowAppSettings._renderPlaylistSort(),
        display: () => workflowAppSettings._renderDisplay(),
        autoSwitch: () => workflowAppSettings._renderAutoSwitch(),
        subtitle: () => workflowAppSettings._renderSubtitle(), // row của Visualizer Screen
        visualBgColor: () => workflowAppSettings._renderVisualBgColor(), // Visualizer Screen > Background Color
        player: () => workflowAppSettings._renderPlayer(),
        playerVideo: () => workflowAppSettings._renderPlayerVideo(),
        playerPhoto: () => workflowAppSettings._renderPlayerPhoto(),
        playerSong: () => workflowAppSettings._renderPlayerSong(), // con của Player
        playerSongBgMedia: () => workflowAppSettings._renderPlayerSongBgMedia(), // con của Player > Song
        recorder: () => workflowAppSettings._renderRecorder(), // con của System
        pagination: () => workflowAppSettings._renderPagination(), // con của System
    };

    /** Mở màn đích theo key — row danh sách và card carousel Main ở tâm (Workflow gửi lại 'appSettings.nav.click'). */
    function openNavTarget(key) {
        const target = NAV_TARGETS[key];
        if (target) workflowAppSettings.navigateTo(target);
    }

    function handle(msg) {
        switch (msg.type) {

            case 'appSettings.nav.click': {
                openNavTarget(msg.payload.key);
                break;
            }

            // Carousel ngang màn Main — hẹn giờ debounce + nhớ cờ chạm -> Workflow.
            case 'appSettings.carousel.scroll': {
                workflowAppSettings.handleCarouselScroll(msg.payload.scrollerEl);
                break;
            }

            case 'appSettings.carousel.touch.start': {
                workflowAppSettings.handleCarouselTouch(msg.payload.scrollerEl, true);
                break;
            }

            case 'appSettings.carousel.touch.end': {
                workflowAppSettings.handleCarouselTouch(msg.payload.scrollerEl, false);
                break;
            }

            case 'appSettings.carousel.card.click': {
                const { scrollerEl, cardEl, key } = msg.payload;
                workflowAppSettings.handleCarouselCardTap(scrollerEl, cardEl, key); // card ở tâm -> gửi lại 'appSettings.nav.click'
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

            // Đổi Color (Light/Dark/Morphin): đổi UI Theme + đồng bộ nền + dựng lại màn -> Workflow.
            case 'appSettings.uiTheme.change': {
                workflowAppSettings.handleUiThemeChange(msg.payload.themeName);
                break;
            }

            case 'appSettings.player.resolution.change': {
                workflowAppSettings.handlePlayerResolutionChange(msg.payload.kind, msg.payload.value);
                break;
            }

            // Nút reset nhanh zoom/pan (Player > Video/Photo > Zoom).
            case 'appSettings.player.zoom.reset.click': {
                workflowAppSettings.handlePlayerZoomReset(msg.payload.kind);
                break;
            }

            // Hàng Motion (Player > Video/Photo) mở màn Chọn của Motion -> Workflow miền 'playerDisplay' (liên tuyến).
            case 'appSettings.player.motionSlot.openPicker.click': {
                workflowPlayerDisplaySettings.openMotionSlotPicker(msg.payload.kind, msg.payload.slot);
                break;
            }

            // System > Ghi âm: select / slider Sync (thả tay) đổi — chuẩn hoá + ghi bền -> Workflow miền 'recorder' (liên tuyến).
            case 'appSettings.recorder.field.change': {
                workflowRecorder.changeConfigField(msg.payload.field, msg.payload.value);
                break;
            }

            // Đang kéo slider bù trễ — chỉ cập nhật nhãn giá trị, message tự đủ nghĩa -> gọi thẳng Core (mục 4A).
            case 'appSettings.recorder.latency.input': {
                setRecorderLatencyLabel(genericDrawerBody, Number(msg.payload.value)); // core/recorder-ui.js
                break;
            }

            // Nút Latency calibration (chế độ Headphones) -> Workflow miền 'recorder' (liên tuyến).
            case 'appSettings.recorder.calibrate.click': {
                workflowRecorder.openCalibration();
                break;
            }

            // System > Pagination: 1 control của 1 NƠI đổi — ghi bền + dựng lại màn -> Workflow.
            case 'appSettings.pagination.place.change': {
                workflowAppSettings.handlePaginationPlaceChange(msg.payload);
                break;
            }

            case 'appSettings.pagination.input.keydown': {
                workflowAppSettings.handlePaginationInputKeydown(msg.payload.key, msg.payload.inputEl);
                break;
            }

            // Đổi trang danh sách preset Filter (nơi 'filterPresets' của pagination).
            case 'appSettings.playlistFilterList.page.change': {
                workflowAppSettings.setPlaylistFilterListPage(msg.payload.pageIndex);
                break;
            }

            // Đổi trang danh sách preset Motion (nơi 'motionPresets' của pagination).
            case 'appSettings.motionList.page.change': {
                workflowAppSettings.setMotionListPage(msg.payload.pageIndex);
                break;
            }

            default:
                console.warn(`[router:appSettings] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('appSettings', routerAppSettings);
