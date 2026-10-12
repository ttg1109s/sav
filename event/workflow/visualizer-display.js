/**
 * event/workflow/visualizer-display.js — "THẰNG THỰC THI CUỐI" của router "visualizerDisplay".
 *
 * QUY TẮC (giống workflow/storage.js, workflow/playlist.js):
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — chỉ gọi các hàm core thuần đã có ở
 *     visualizers/visualizer-display.js.
 *   - withLoadingShield() và alertModal() ĐẶT Ở TẦNG NÀY — core hoàn toàn không biết 2 thứ này
 *     tồn tại.
 *   - QUY TẮC SHIELD/MODAL: alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của
 *     withLoadingShield() — luôn gọi SAU KHI shield đã đóng hẳn.
 *
 * (12/08/2026) Cấu hình riêng effect (màu/blur/style con/kích thước) ĐÃ DỜI hẳn sang Custom Effect
 * Drawer (event/workflow/custom-effect.js) — `openPanel()`/`openCustomEffectPanel()` cũ ĐÃ BỎ,
 * thay bằng `openDisplayPanel()` (panel "Display", 5 toggle UI chrome).
 */
const workflowVisualizerDisplay = {

    /** Đồng bộ 6 toggle panel "Display" (components/settings/visualizer-display-panel.js). SỬA
     * (đợt migrate Visualizer Screen, phản hồi Giang "làm nốt visualizer") — KHÔNG còn
     * `pushSettingsPanel()`, bodyHtml do event/workflow/app-settings.js cung cấp SẴN qua
     * `navigateTo()` — chỉ còn đồng bộ giá trị vào `genericDrawerBody`.
     * CHUYỂN (mục 1, Giang yêu cầu dời "Show subtitles" từ panel con "Phụ đề" sang đây, card
     * "Thành phần") — thêm dòng đồng bộ `#setting-subtitles-enabled` (trước đây ở
     * `workflowSubtitleStyleSettings.refresh()`, event/workflow/subtitle-style-settings.js). */
    openDisplayPanel() {
        const panelEl = genericDrawerBody;
        const cfg = appConfigViz.getAll();
        panelEl.querySelector('#setting-visual-enable').checked = cfg.visualEnabled !== false;
        panelEl.querySelector('#setting-subtitles-enabled').checked = cfg.subtitlesEnabled !== false;
        panelEl.querySelector('#setting-stats-panel-enable').checked = appConfigPlayer.getAll().isStatsPanelVisible !== false;
        panelEl.querySelector('#setting-bottom-player-enable').checked = cfg.bottomPlayerVisible !== false;
        panelEl.querySelector('#setting-playlist-button-enable').checked = cfg.playlistButtonVisible !== false;
        panelEl.querySelector('#setting-control-center-button-enable').checked = cfg.controlCenterButtonVisible !== false;
    },

    // XOÁ (12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 4) — `openAutoSwitchPanel()`: chỉ còn việc tự gắn 4 listener
    // pointer kéo thả lên từng tay cầm của sub panel "Effect list" (bỏ qua Listener -> Router). Kéo thả nay đi
    // event/listener/auto-switch-visual.js -> Router 'autoSwitchVisual.drag.*' -> workflowAutoSwitchVisual.startItemDrag()...
    // (phiên kéo về đúng domain Auto-Switch). Case router 'visualizerDisplay.openAutoSwitchPanel.click' (không còn nơi
    // gửi) xoá cùng; event/workflow/app-settings.js bỏ onMount gọi hàm này.

    // (14 method set* cho màu/blur/style con/kích thước ĐÃ DỜI sang event/workflow/custom-effect.js)
    // (Phần B, Galaxy — 5 method spaceStyle/4 slider ĐÃ BỎ 21/07/2026)
    // XOÁ (toggleBgImage() mồ côi — case 'visualizerDisplay.bgImage.toggle' không còn listener nào
    // gửi từ 07/07/2026, và đường vào còn lại qua theme.js đã đổi sang Generic Drawer picker từ
    // 17/07/2026, xem event/workflow/theme.js::pickNewBackgroundImage()) bỏ hẳn.

    // DỌN 23/09/2026: setBgBlur() ĐÃ XOÁ — blur ảnh nền đã bỏ hẳn (Giang: Morphin vốn đã mờ).

    /** Ứng với 'visualizerDisplay.statsPanelEnable.change' — checkbox dời từ nút Control Center.
     * Lưu bền qua domain 'player' (CÙNG Shuffle/Repeat, KHÔNG đổi domain — tái dùng
     * workflowPlayerControls._persistPlayerConfig() thay vì viết lại logic ghi bền lần 2). */
    setStatsPanelEnabled(checked) {
        setStatsPanelVisible(checked); // core/visualizer-ui-visibility.js
        workflowPlayerControls._persistPlayerConfig(); // event/workflow/player-controls.js — liên tuyến domain
    },

    /** 3 toggle RIÊNG (bỏ hẳn "full mode" gộp chung) — CÙNG khuôn setStatsPanelEnabled() ngay
     * trên: đặt tên KHẲNG ĐỊNH, checked=true nghĩa là HIỆN (không đảo `!checked` như bản cũ đặt
     * tên phủ định "hideX" — phản hồi Giang, nhất quán toàn section). Tên method TRÙNG core cùng
     * chức năng (gọi trần phân giải theo scope từ vựng — cùng khuôn các hàm core cùng tên, cùng khuôn). Ứng
     * với 'visualizerDisplay.bottomPlayerVisible/playlistButtonVisible/
     * controlCenterButtonVisible.change'. */
    setBottomPlayerVisible(checked) {
        setBottomPlayerVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.bottomPlayerVisible = checked; });
        saveConfig();
    },
    setPlaylistButtonVisible(checked) {
        setPlaylistButtonVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.playlistButtonVisible = checked; });
        saveConfig();
    },
    setControlCenterButtonVisible(checked) {
        setControlCenterButtonVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.controlCenterButtonVisible = checked; });
        saveConfig();
    },
};
