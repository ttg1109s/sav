/**
 * event/workflow/subtitle-style-settings.js — Workflow router "subtitleStyleSettings" (panel Settings > Display >
 * Subtitles + toggle "Show subtitles" ở panel Display). Mọi thay đổi: ghi vizConfig (core) -> saveConfig() -> áp
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
        const panel = genericDrawerBody;
        panel.querySelector('#setting-subtitle-use-custom-styling').checked = !!cfg.subtitleUseCustomStyling;
        panel.querySelector('#setting-subtitle-default-fontsize').value = cfg.subtitleDefaultFontSize || 16;
        panel.querySelector('#setting-subtitle-default-color').value = cfg.subtitleDefaultColor || '#ffffff';
        this._syncCustomStylingVisibility(!!cfg.subtitleUseCustomStyling);
        panel.querySelector('#setting-subtitle-comming-effect').value = cfg.subtitleCommingEffect || 'none';
        panel.querySelector('#setting-subtitle-comming-sign').value = (cfg.subtitleCommingValueMs || 0) < 0 ? '-' : '+';
        this._syncMagnitudeButton('comming', cfg.subtitleCommingValueMs);
        panel.querySelector('#setting-subtitle-in-effect').value = cfg.subtitleInEffect || 'none';
        panel.querySelector('#setting-subtitle-outing-effect').value = cfg.subtitleOutingEffect || 'none';
        panel.querySelector('#setting-subtitle-outing-sign').value = (cfg.subtitleOutingValueMs || 0) < 0 ? '-' : '+';
        this._syncMagnitudeButton('outing', cfg.subtitleOutingValueMs);
        this._syncKaraokeSettings();
    },

    /** Toggle "Show subtitles" (panel Display). */
    setEnabled(checked) {
        setSubtitleVizField('subtitlesEnabled', checked); // core
        saveConfig();
        workflowSubtitleDisplay.setEnabled(checked);
    },

    /** Toggle Custom styling: bật -> nút Styling, tắt -> 2 field mặc định. */
    setUseCustomStyling(checked) {
        setSubtitleVizField('subtitleUseCustomStyling', checked); // core
        saveConfig();
        workflowSubtitleDisplay.applyFrameStyle();
        this._syncCustomStylingVisibility(checked);
    },

    /** Cỡ chữ / màu mặc định. */
    setDefaultField(field, value) {
        setSubtitleVizField(field, value); // core
        saveConfig();
        workflowSubtitleDisplay.applyFrameStyle();
    },

    /** Effect / giá trị Comming-In-Outing (dòng kế tiếp dùng cài đặt mới). */
    setTransitionField(field, value) {
        setSubtitleVizField(field, value); // core
        saveConfig();
    },

    /** Mọi control karaoke. Đổi bật/tắt karaoke thì dựng lại các dòng đang hiện (span từ <-> text thường). */
    setKaraokeField(field, value) {
        setSubtitleVizField(field, value); // core
        saveConfig();
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
        genericDrawerBody.querySelector('#setting-open-subtitle-styling').classList.toggle('hidden', !useCustom);
        genericDrawerBody.querySelector('#setting-subtitle-default-fields').classList.toggle('hidden', useCustom);
    },

    /** Nút độ lớn Comming/Outing: hiển thị |valueMs| dạng "Xs" + giữ mili giây ở data-ms. */
    _syncMagnitudeButton(prefix, valueMs) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const btn = genericDrawerBody.querySelector(`#setting-subtitle-${prefix}-magnitude`);
        if (!btn) return;
        const ms = Math.abs(valueMs || 0);
        btn.dataset.ms = String(ms);
        btn.textContent = `${(ms / 1000).toFixed(1)}s`;
    },

    /** Mở bánh xe chọn độ lớn Comming/Outing (format 's-ms'), xác nhận thì ghép dấu đang chọn thành ms có dấu.
     * @param {'comming'|'outing'} prefix */
    openMagnitudePicker(prefix) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const configField = prefix === 'comming' ? 'subtitleCommingValueMs' : 'subtitleOutingValueMs';
        openTimePickerModal({ // core/time-picker-modal.js
            title: t(`settingsSubtitleStyle.${prefix}.label`),
            format: 's-ms',
            valueMs: Math.abs(appConfigViz.getAll()[configField] || 0),
            minMs: 0,
            maxMs: SUBTITLE_TRANSITION_MAX_MS, // core/subtitle/subtitle-transition.js
            onConfirm: (resultMs) => {
                const signEl = genericDrawerBody.querySelector(`#setting-subtitle-${prefix}-sign`);
                const signedMs = (signEl && signEl.value === '-' ? -1 : 1) * resultMs;
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
            saveConfig();
            workflowSubtitleDisplay.applyFrameStyle();
        }, appConfigViz.getAll().subtitleBoxCss, () => workflowAppSettings._renderSubtitle());
    },
};
