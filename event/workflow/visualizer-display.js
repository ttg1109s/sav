/**
 * event/workflow/visualizer-display.js — Workflow router "visualizerDisplay": panel "Display" (Hiện Visual + toggle UI
 * chrome), modal chọn effect (CLICK #btn-cycle-mode), màu thanh tiến trình theo effect đang chạy. Cấu hình riêng effect:
 * Custom Effect Drawer (event/workflow/custom-effect.js).
 *
 * NẠP SAU: core/visualizer/visualizer-display.js, core/visualizer/effect-picker-ui.js, core/visualizer-control-center.js,
 * core/visualizer-ui-visibility.js, core/custom-effect.js, core/modal-choice-ui.js, components/settings/visualizer-display-
 * panel.js. Gọi lúc chạy: event/workflow/visualizer-render.js, player-controls.js.
 */
const workflowVisualizerDisplay = {
    _effectPickerStyleSelect: null, // dropdown style của modal chọn effect đang mở (đọc .value lúc bấm "Chọn")

    /** Đồng bộ 6 toggle panel "Display" (body do workflowAppSettings dựng sẵn trong genericDrawerBody). */
    openDisplayPanel() {
        const view = computeVisualizerDisplayPanelView(appConfigViz.getAll(), appConfigPlayer.getAll()); // core/visualizer/visualizer-display.js
        fillVisualizerDisplayPanel(genericDrawerBody, view);
    },

    /** 'visualizerDisplay.visualEnable.change'. */
    setVisualEnabled(checked) {
        setVisualEnabled(checked); // core/visualizer-control-center.js (cùng tên)
        workflowConfig.save(); // core/config.js
    },

    /** 'visualizerDisplay.statsPanelEnable.change' — lưu bền qua domain 'player' (cùng Shuffle/Repeat). */
    setStatsPanelEnabled(checked) {
        setStatsPanelVisible(checked); // core/visualizer-ui-visibility.js
        workflowPlayerControls._persistPlayerConfig(); // event/workflow/player-controls.js
    },

    /** 3 toggle UI chrome (checked = HIỆN) — tên trùng core cùng chức năng (core/visualizer-ui-visibility.js). */
    setBottomPlayerVisible(checked) {
        setBottomPlayerVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.bottomPlayerVisible = checked; });
        workflowConfig.save();
    },
    setPlaylistButtonVisible(checked) {
        setPlaylistButtonVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.playlistButtonVisible = checked; });
        workflowConfig.save();
    },
    setControlCenterButtonVisible(checked) {
        setControlCenterButtonVisible(checked); // core cùng tên
        appConfigViz.mutateAll(cfg => { cfg.controlCenterButtonVisible = checked; });
        workflowConfig.save();
    },

    // ===================== Modal chọn effect =====================

    /** CLICK #btn-cycle-mode: chọn group + style con trong 1 modal; "Chọn" -> workflowVisualizerRender.applyStyle(). Giữ
     * tham chiếu dropdown style ngay sau khi mở — modalChoice() gỡ overlay khỏi DOM trước khi gọi onClick nhưng phần tử đã
     * tách vẫn đọc được `.value`. */
    openEffectPicker() {
        const currentStyle = MODES[appState.get('currentModeIndex')]; // service/state/visualizer-runtime.js
        modalChoice('', [{ // core/modal-choice-ui.js
            label: t('common.select'),
            className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent',
            onClick: () => workflowVisualizerRender.applyStyle(this._effectPickerStyleSelect.value), // event/workflow/visualizer-render.js
        }], { title: t('effectPicker.title'), bodyHtml: renderEffectPickerBodyHtml(STYLE_TO_GROUP[currentStyle], currentStyle) }); // components/settings/visualizer-display-panel.js
        this._effectPickerStyleSelect = document.getElementById('effect-picker-style');
    },

    /** 'visualizerDisplay.effectPicker.group.change' — đổ lại dropdown style theo group vừa chọn. @param {string} group */
    refillEffectPickerStyles(group) {
        if (!this._effectPickerStyleSelect) return;
        setEffectPickerStyleOptionsUi(this._effectPickerStyleSelect, renderEffectPickerStyleOptionsHtml(group, null)); // core/visualizer/effect-picker-ui.js + components
    },

    // ===================== Thanh tiến trình =====================

    /** Màu thanh tiến trình theo effect đang chạy — gọi khi style hoặc màu effect đổi (visualizer-render.activateCurrentStyle(),
     * custom-effect.js). updateProgressBarCSS() (core) vẽ lại bằng màu này mỗi lần cập nhật vị trí. */
    syncProgressBarColor() {
        const cfg = appConfigViz.getAll();
        const color = computeProgressBarFillColor(resolveEffectConfig(cfg.customEffect, cfg.type)); // core/visualizer/visualizer-display.js + core/custom-effect.js
        setProgressBarFillColor(progressBar, color);
    },
};
