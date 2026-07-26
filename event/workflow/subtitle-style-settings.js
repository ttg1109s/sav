/**
 * event/workflow/subtitle-style-settings.js — "THẰNG THỰC THI CUỐI" của router
 * "subtitleStyleSettings".
 *
 * === VIẾT LẠI TOÀN BỘ (07/07/2026, phản hồi Giang — "không biết lỗi do đâu, làm lại từ đầu") ===
 * Bug cũ: bấm "Tùy chỉnh Phụ đề" hoàn toàn im lặng, không mở panel, không lỗi Console quan sát
 * được (không có devtools). Rà code tĩnh nhiều lần không tìm ra nguyên nhân cụ thể — quyết định
 * viết lại toàn bộ 5 file của cụm này (template/core/workflow/router/listener) THAY vì tiếp tục dò,
 * đổi sang ĐÚNG pattern đã CHỨNG MINH hoạt động ở Slideshow (event/workflow/slideshow.js — biến
 * module lưu panel đang mở, KHÔNG chỉ dựa vào `panelEl` cục bộ trả về từ `pushSettingsPanel()`).
 *
 * NẠP SAU: core/settings-panel-stack.js (pushSettingsPanel), components/subtitle-settings-
 * drawer.js (renderSubtitlePanelBody), core/subtitle/subtitle-style-settings.js (10 hàm set*),
 * core/subtitle/subtitle-display.js (applySubtitleStyle), core/config.js (saveConfig).
 */
let subtitleSettingsPanelEl = null; // panel Subtitle đang mở — null nếu đang đóng

const workflowSubtitleStyleSettings = {

    /** Ứng với msg.type = 'subtitleStyleSettings.openPanel.click' — push panel + đồng bộ 8 input
     * từ config hiện tại. */
    openPanel() {
        subtitleSettingsPanelEl = pushSettingsPanel({
            title: t('subtitleSettingsDrawer.title'),
            bodyHtml: renderSubtitlePanelBody(),
        });
        this.refresh();
    },

    /** Đồng bộ 8 input theo vizConfig.subtitleStyle hiện tại — gọi lúc mở panel. */
    refresh() {
        if (!subtitleSettingsPanelEl) return; // guard: panel đã đóng
        const ss = appConfigViz.getAll().subtitleStyle;

        subtitleSettingsPanelEl.querySelector('#setting-sub-bg-color').value = ss.bgColor;
        subtitleSettingsPanelEl.querySelector('#setting-sub-bg-opacity').value = Math.round(ss.bgOpacity * 100);
        subtitleSettingsPanelEl.querySelector('#val-sub-bg-opacity').textContent = Math.round(ss.bgOpacity * 100) + '%';
        subtitleSettingsPanelEl.querySelector('#setting-sub-border-color').value = ss.borderColor;
        subtitleSettingsPanelEl.querySelector('#setting-sub-border-opacity').value = Math.round(ss.borderOpacity * 100);
        subtitleSettingsPanelEl.querySelector('#val-sub-border-opacity').textContent = Math.round(ss.borderOpacity * 100) + '%';
        subtitleSettingsPanelEl.querySelector('#setting-sub-border-width').value = ss.borderWidth;
        subtitleSettingsPanelEl.querySelector('#val-sub-border-width').textContent = ss.borderWidth;
        subtitleSettingsPanelEl.querySelector('#setting-sub-border-radius').value = ss.borderRadius;
        subtitleSettingsPanelEl.querySelector('#val-sub-border-radius').textContent = ss.borderRadius;
        subtitleSettingsPanelEl.querySelector('#setting-sub-text-color').value = ss.textColor;
        subtitleSettingsPanelEl.querySelector('#setting-sub-font-size').value = ss.fontSize;
        subtitleSettingsPanelEl.querySelector('#val-sub-font-size').textContent = ss.fontSize;
        subtitleSettingsPanelEl.querySelector('#setting-sub-line-height').value = ss.lineHeight;
        subtitleSettingsPanelEl.querySelector('#val-sub-line-height').textContent = ss.lineHeight;
        subtitleSettingsPanelEl.querySelector('#setting-sub-letter-spacing').value = ss.letterSpacing;
        subtitleSettingsPanelEl.querySelector('#val-sub-letter-spacing').textContent = ss.letterSpacing;
    },

    setBgColor(value) {
        setSubtitleStyleBgColor(value);
        applySubtitleStyle();
        saveConfig();
    },
    setBgOpacity(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-bg-opacity');
        setSubtitleStyleBgOpacity(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
    setBorderColor(value) {
        setSubtitleStyleBorderColor(value);
        applySubtitleStyle();
        saveConfig();
    },
    setBorderOpacity(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-border-opacity');
        setSubtitleStyleBorderOpacity(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
    setBorderWidth(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-border-width');
        setSubtitleStyleBorderWidth(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
    setBorderRadius(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-border-radius');
        setSubtitleStyleBorderRadius(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
    setTextColor(value) {
        setSubtitleStyleTextColor(value);
        applySubtitleStyle();
        saveConfig();
    },
    setFontSize(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-font-size');
        setSubtitleStyleFontSize(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
    setLineHeight(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-line-height');
        setSubtitleStyleLineHeight(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
    setLetterSpacing(rawValue) {
        if (!subtitleSettingsPanelEl) return;
        const displayEl = subtitleSettingsPanelEl.querySelector('#val-sub-letter-spacing');
        setSubtitleStyleLetterSpacing(rawValue, displayEl);
        applySubtitleStyle();
        saveConfig();
    },
};
