/**
 * event/router/app-settings.js — Router tên "appSettings", tự đăng ký với eventBus lúc nạp.
 * Điều phối toàn bộ điều hướng Setting (Main/System/Playlist/Theme/Gesture/Motion/Language/Pagination/
 * Visualizer Screen/Player/Troubleshooting) — mọi nút động (Rule 5a) chỉ gửi message tới đây, KHÔNG gọi
 * thẳng workflowAppSettings (xem core/app-settings-ui.js).
 *
 * `NAV_TARGETS` — bảng tra key -> hàm render đích, dùng cho case 'appSettings.nav.click'. Đây là
 * Router đọc THẲNG payload của CHÍNH message đang xử lý (không đọc appState khác để quyết định
 * chạy gì) — đúng (A) event-bus-flow.md mục 4B, KHÔNG cần VirtualMachineState.
 *
 * SỬA (20/09/2026) — 4 case 'appSettings.carousel.*' cho màn Main dạng carousel ngang; Troubleshooting
 * gộp Debug console/Scan & fix video thumbnails làm màn con (NAV_TARGETS.debugConsole/videoThumb), key 'resetApp'
 * BỎ (Reset app tách: Restore/Clear cache thành 2 hàng riêng ngang hàng ở Troubleshooting, Restart app lên
 * icon header — xem event/workflow/app-settings.js::_renderTroubleshooting()).
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
        debugConsole: () => workflowAppSettings._renderDebugConsole(), // MỚI (20/09/2026) — con của Troubleshooting
        videoThumb: () => workflowAppSettings._renderVideoThumbRepair(), // MỚI (20/09/2026) — con của Troubleshooting (scan & fix thumb video)
        perfHud: () => workflowAppSettings._renderPerfHudSettings(), // MỚI (05/10/2026) — con của Troubleshooting (Performance HUD)
        theme: () => workflowAppSettings._renderTheme(),
        gesture: () => workflowAppSettings._renderGesture(),
        motion: () => workflowAppSettings._renderMotionList(),
        language: () => workflowAppSettings._renderLanguage(),
        playlistSort: () => workflowAppSettings._renderPlaylistSort(),
        display: () => workflowAppSettings._renderDisplay(),
        autoSwitch: () => workflowAppSettings._renderAutoSwitch(),
        subtitle: () => workflowAppSettings._renderSubtitle(), // DỜI 05/10/2026 — Subtitles thành row của Visualizer Screen (trước mở từ nút trong panel Display)
        visualBgColor: () => workflowAppSettings._renderVisualBgColor(), // SỬA (05/10/2026) — thay 'visualBg' (Visual Background -> Background Color)
        player: () => workflowAppSettings._renderPlayer(),
        playerVideo: () => workflowAppSettings._renderPlayerVideo(),
        playerPhoto: () => workflowAppSettings._renderPlayerPhoto(),
        playerSong: () => workflowAppSettings._renderPlayerSong(), // MỚI 05/10/2026 — Song (con của Player)
        playerSongBgMedia: () => workflowAppSettings._renderPlayerSongBgMedia(), // MỚI 05/10/2026 — Background Media (con của Player > Song)
        recorder: () => workflowAppSettings._renderRecorder(), // DỜI 05/10/2026 — Ghi âm (con của System, trước đây 'playerRecorder' con của Player)
        pagination: () => workflowAppSettings._renderPagination(), // MỚI 23/09/2026 — con của System
    };

    /** Mở màn đích theo key — DÙNG CHUNG cho row danh sách ('appSettings.nav.click') lẫn card carousel
     * Main ('appSettings.carousel.card.click', khi card đã ở giữa). */
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

            // MỚI (20/09/2026) — carousel ngang màn Main (core/app-settings-ui.js::wireAppSettingsMainCarousel()).
            // scroll/touch: cần hẹn giờ debounce (taskManager) + nhớ cờ chạm -> giao Workflow.
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
                if (workflowAppSettings.handleCarouselCardTap(scrollerEl, cardEl)) break; // true = vừa cuộn card bên cạnh vào giữa, chưa mở gì
                openNavTarget(key);
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

            // MỚI 21/09/2026 — đổi màu GIAO DIỆN (Color: Light/Dark/Morphin). Cần ≥2 việc nối tiếp (đổi UI Theme + đồng bộ nền + dựng lại
            // màn) -> Workflow. (Case 'appSettings.theme.selectMode.change' cũ — select "Background" — ĐÃ XOÁ cùng select đó.)
            case 'appSettings.uiTheme.change': {
                workflowAppSettings.handleUiThemeChange(msg.payload.themeName);
                break;
            }

            // DỌN 23/09/2026: case 'appSettings.theme.selectGlassType.change' ĐÃ XOÁ — không nơi nào gửi message này và gọi method
            // workflowAppSettings.handleThemeSelectGlassType() không tồn tại (tàn dư UI chọn kiểu kính cũ).

            case 'appSettings.player.resolution.change': {
                workflowAppSettings.handlePlayerResolutionChange(msg.payload.kind, msg.payload.value);
                break;
            }

            // MỚI (29/09/2026, Giang) — nút reset nhanh zoom/pan (Player > Video/Photo > Zoom).
            case 'appSettings.player.zoom.reset.click': {
                workflowAppSettings.handlePlayerZoomReset(msg.payload.kind);
                break;
            }

            // SỬA (24/09/2026, Giang yêu cầu — xoá cơ chế đăng ký Motion vào nơi tiêu thụ) — THAY case
            // 'appSettings.player.motionSlot.change' (select cũ): hàng Motion giờ mở THẲNG màn Chọn của Motion.
            // Chuẩn bị state (đọc id đang gắn) + điều hướng -> Workflow của domain 'playerDisplay' (liên tuyến).
            case 'appSettings.player.motionSlot.openPicker.click': {
                workflowPlayerDisplaySettings.openMotionSlotPicker(msg.payload.kind, msg.payload.slot);
                break;
            }

            // MỚI (01/10/2026, Ghi âm) — Settings > System > Ghi âm (dời từ Player 05/10/2026): toggle khử tiếng vọng / slider bù trễ (thả tay) đổi.
            // Chuẩn hoá + ghi bền -> Workflow của domain 'recorder' (liên tuyến).
            case 'appSettings.recorder.field.change': {
                workflowRecorder.changeConfigField(msg.payload.field, msg.payload.value);
                break;
            }

            // Đang kéo slider bù trễ — chỉ cập nhật nhãn giá trị, message tự đủ nghĩa -> gọi thẳng Core (mục 4A).
            case 'appSettings.recorder.latency.input': {
                setRecorderLatencyLabel(genericDrawerBody, Number(msg.payload.value)); // core/recorder-ui.js
                break;
            }

            // MỚI 23/09/2026 — Settings > System > Pagination: 1 control (checkbox / ô số / select) của 1 NƠI đổi.
            // Ghi bền + dựng lại màn = 2 việc nối tiếp -> Workflow.
            case 'appSettings.pagination.place.change': {
                workflowAppSettings.handlePaginationPlaceChange(msg.payload);
                break;
            }

            // MỚI 23/09/2026 — đổi trang danh sách preset Filter (nơi 'filterPresets' của pagination).
            case 'appSettings.playlistFilterList.page.change': {
                workflowAppSettings.setPlaylistFilterListPage(msg.payload.pageIndex);
                break;
            }

            // MỚI 23/09/2026 — đổi trang danh sách preset Motion (nơi 'motionPresets' của pagination).
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
