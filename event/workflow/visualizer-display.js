/**
 * event/workflow/visualizer-display.js — "THẰNG THỰC THI CUỐI" của router "visualizerDisplay" (panel "Display" — Hiện
 * Visual + toggle UI chrome). Cấu hình riêng effect nằm ở Custom Effect Drawer (event/workflow/custom-effect.js).
 *
 * QUY TẮC:
 *   - Workflow KHÔNG tự nghĩ ra logic nghiệp vụ mới — chỉ gọi các hàm core thuần đã có.
 *   - withLoadingShield() và alertModal() ĐẶT Ở TẦNG NÀY — core hoàn toàn không biết 2 thứ này tồn tại.
 *   - alertModal() KHÔNG bao giờ gọi BÊN TRONG callback của withLoadingShield() — luôn gọi SAU KHI shield đã đóng hẳn.
 */
const workflowVisualizerDisplay = {

    /** Đồng bộ 6 toggle panel "Display" (components/settings/visualizer-display-panel.js) — bodyHtml do
     * event/workflow/app-settings.js dựng sẵn qua `navigateTo()`, hàm này chỉ đồng bộ giá trị vào `genericDrawerBody`
     * (kể cả "Show subtitles" ở card "Thành phần"). */
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

    /** Ứng với 'visualizerDisplay.statsPanelEnable.change'. Lưu bền qua domain 'player' (CÙNG Shuffle/Repeat — tái dùng
     * workflowPlayerControls._persistPlayerConfig()). */
    setStatsPanelEnabled(checked) {
        setStatsPanelVisible(checked); // core/visualizer-ui-visibility.js
        workflowPlayerControls._persistPlayerConfig(); // event/workflow/player-controls.js — liên tuyến domain
    },

    /** 3 toggle RIÊNG — tên KHẲNG ĐỊNH, checked=true nghĩa là HIỆN. Tên method TRÙNG core cùng chức năng (lời gọi trần
     * bên trong phân giải tới hàm core toàn cục). Ứng với 'visualizerDisplay.bottomPlayerVisible/playlistButtonVisible/
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
