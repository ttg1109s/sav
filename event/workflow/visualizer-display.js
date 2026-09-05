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

    /** Ứng với msg.type = 'visualizerDisplay.openAutoSwitchPanel.click' — push panel "Auto-Switch
     * Effect" (MỚI 12/08/2026, mục 4f — tách từ card "Auto-switch effect" cũ trong panel
     * "Customize Visualizer") + đồng bộ mọi input (thay `initAutoSwitchVisualUI()` cũ — xem
     * core/auto-switch-visual.js). */
    /** Đồng bộ mọi input panel "Auto-Switch Effect" (thay `initAutoSwitchVisualUI()` cũ — xem
     * core/auto-switch-visual.js). SỬA (đợt migrate Visualizer Screen) — KHÔNG còn
     * `pushSettingsPanel()`, cùng khuôn openDisplayPanel() ngay trên. */
    openAutoSwitchPanel() {
        const panelEl = genericDrawerBody;
        const cfg = appConfigViz.getAll();

        const elEnable = panelEl.querySelector('#setting-auto-switch-enable');
        const elOptions = panelEl.querySelector('#auto-switch-options');
        elEnable.checked = cfg.autoSwitchVisualEnabled === true;
        elOptions.classList.toggle('hidden', !elEnable.checked);
        panelEl.querySelector('#setting-auto-switch-mode').value = cfg.autoSwitchVisualMode;
        panelEl.querySelector('#setting-auto-switch-time-mode').value = cfg.autoSwitchVisualTimeMode;
        panelEl.querySelector('#setting-auto-switch-seconds-fixed').value = cfg.autoSwitchVisualSecondsFixed;
        panelEl.querySelector('#setting-auto-switch-seconds-random').value = cfg.autoSwitchVisualSecondsRandom;
        panelEl.querySelector('#setting-auto-switch-seconds-duration').value = cfg.autoSwitchVisualSecondsDuration;
        syncAutoSwitchTimeModeBlocks(
            cfg.autoSwitchVisualTimeMode,
            panelEl.querySelector('#auto-switch-time-fixed-block'),
            panelEl.querySelector('#auto-switch-time-random-block'),
            panelEl.querySelector('#auto-switch-time-duration-block')
        );
    },

    // (14 method set* cho màu/blur/style con/kích thước ĐÃ DỜI sang event/workflow/custom-effect.js)
    // (Phần B, Galaxy — 5 method spaceStyle/4 slider ĐÃ BỎ 21/07/2026)
    // XOÁ (toggleBgImage() mồ côi — case 'visualizerDisplay.bgImage.toggle' không còn listener nào
    // gửi từ 07/07/2026, và đường vào còn lại qua theme.js đã đổi sang Generic Drawer picker từ
    // 17/07/2026, xem event/workflow/theme.js::pickNewBackgroundImage()) bỏ hẳn.

    /** Ứng với 'visualizerDisplay.bgBlur.input' — batch "nền chung" (07/07/2026): trước đây router
     * gọi thẳng `setBgBlur()` (1 hàm core). Core giờ Rule 1-4 đầy đủ (bỏ updatePlaylistBg/
     * saveConfig nội bộ) nên chuyển qua đây. @param {string} value */
    setBgBlur(value) {
        setBgBlur(value); // core cùng tên, gọi trần phân giải theo scope từ vựng (xem lưu ý đặt tên đầu file)
        updatePlaylistBg();
        forceGlassRepaint(); // fix bug 09/07/2026 (mục 3)
        saveConfig();
    },

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
     * chức năng (gọi trần phân giải theo scope từ vựng — xem setBgBlur() trên, cùng khuôn). Ứng
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
