/**
 * event/workflow/subtitle-style-settings.js — Workflow router "subtitleStyleSettings" (panel Settings > Display >
 * Subtitles + toggle "Show subtitles" ở panel Display). Mọi thay đổi: ghi vizConfig (core) -> workflowConfig.save() -> áp
 * lên hiển thị qua workflowSubtitleDisplay -> đồng bộ lại panel.
 *
 * NẠP SAU: core/subtitle/subtitle-style-settings.js, core/subtitle/subtitle-transition.js, core/subtitle/
 * subtitle-karaoke-display.js, core/time-picker-modal.js, event/workflow/element-style-editor.js,
 * event/workflow/subtitle-display.js.
 */
const workflowSubtitleStyleSettings = {

    /** Gọi sau khi workflowAppSettings dựng body panel (bodyHtml) — chỉ đồng bộ giá trị. */
    openPanel() {
        this.refresh();
    },

    refresh() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // panel đã đóng
        const cfg = appConfigViz.getAll();
        const view = computeSubtitleStylePanelView(cfg); // core/subtitle/subtitle-style-settings.js
        syncSubtitleStylePanelUi(genericDrawerBody, view); // core/subtitle/subtitle-style-settings.js
        this._syncCustomStylingVisibility(view.useCustomStyling);
        this._syncMagnitudeButton('comming', cfg.subtitleCommingValueMs);
        this._syncMagnitudeButton('outing', cfg.subtitleOutingValueMs);
        this._syncKaraokeSettings();
    },

    /** Toggle "Show subtitles" (panel Display). */
    setEnabled(checked) {
        setSubtitleVizField('subtitlesEnabled', checked); // core
        workflowConfig.save();
        workflowSubtitleDisplay.setEnabled(checked);
    },

    /** Toggle Custom styling: bật -> nút Styling, tắt -> 2 field mặc định. */
    setUseCustomStyling(checked) {
        setSubtitleVizField('subtitleUseCustomStyling', checked); // core
        workflowConfig.save();
        workflowSubtitleDisplay.applyFrameStyle();
        this._syncCustomStylingVisibility(checked);
    },

    /** Cỡ chữ / màu mặc định. */
    setDefaultField(field, value) {
        setSubtitleVizField(field, value); // core
        workflowConfig.save();
        workflowSubtitleDisplay.applyFrameStyle();
    },

    /** Effect / giá trị Comming-In-Outing (dòng kế tiếp dùng cài đặt mới). */
    setTransitionField(field, value) {
        setSubtitleVizField(field, value); // core
        workflowConfig.save();
    },

    /** Mọi control karaoke. Đổi bật/tắt karaoke thì dựng lại các dòng đang hiện (span từ <-> text thường). */
    setKaraokeField(field, value) {
        setSubtitleVizField(field, value); // core
        workflowConfig.save();
        workflowSubtitleDisplay.applyKaraokeConfig();
        this._rebuildIfKaraokeToggled(field);
        this._syncKaraokeSettings();
    },

    _rebuildIfKaraokeToggled(field) {
        if (field !== 'subtitleKaraokeEnabled') return;
        workflowSubtitleDisplay.rebuildActiveBlocks();
    },

    _syncKaraokeSettings() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigViz.getAll();
        syncSubtitleKaraokeSettingsUi(genericDrawerBody, cfg); // core
        applySubtitleKaraokeSettingsVisibilityUi(genericDrawerBody, resolveKaraokeSettingsVisibility(cfg)); // core
    },

    _syncCustomStylingVisibility(useCustom) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        setSubtitleCustomStylingVisibilityUi(genericDrawerBody, useCustom); // core/subtitle/subtitle-style-settings.js
    },

    /** Nút độ lớn Comming/Outing: |valueMs| dạng "X.Xs" + giữ mili giây ở data-ms. */
    _syncMagnitudeButton(prefix, valueMs) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        setSubtitleTransitionMagnitudeUi(genericDrawerBody, prefix, computeSubtitleTransitionMagnitude(valueMs)); // core/subtitle/subtitle-style-settings.js
    },

    /** Mở bánh xe chọn độ lớn Comming/Outing (format 's-ms'), xác nhận thì ghép dấu đang chọn thành ms có dấu.
     * @param {'comming'|'outing'} prefix */
    openMagnitudePicker(prefix) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const configField = SUBTITLE_TRANSITION_VALUE_FIELD_BY_PREFIX[prefix]; // core/subtitle/subtitle-style-settings.js
        openTimePickerModal({ // core/time-picker-modal.js
            title: t(`settingsSubtitleStyle.${prefix}.label`),
            format: 's-ms',
            valueMs: computeSubtitleTransitionMagnitude(appConfigViz.getAll()[configField]).ms, // core/subtitle/subtitle-style-settings.js
            minMs: 0,
            maxMs: SUBTITLE_TRANSITION_MAX_MS, // core/subtitle/subtitle-transition.js
            onConfirm: (resultMs) => {
                const signEl = genericDrawerBody.querySelector(`#setting-subtitle-${prefix}-sign`);
                const signedMs = computeSignedSubtitleTransitionMs(signEl ? signEl.value : '+', resultMs); // core/subtitle/subtitle-style-settings.js
                this._syncMagnitudeButton(prefix, signedMs);
                this.setTransitionField(configField, signedMs);
            },
        });
    },

    /** Nút "Styling" -> Element Style Editor cho #subtitle-frame (nạp lại CSS đã lưu); Apply thì lưu + áp lại khung
     * (applyFrameStyle() xoá sạch style cũ trước, tránh sót thuộc tính bản trước). */
    openStyling() {
        workflowElementStyleEditor.open(subtitleFrame, (cssString) => {
            setSubtitleVizField('subtitleBoxCss', cssString); // core
            workflowConfig.save();
            workflowSubtitleDisplay.applyFrameStyle();
        }, appConfigViz.getAll().subtitleBoxCss, () => workflowAppSettings._renderSubtitle());
    },
};
