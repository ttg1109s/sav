/**
 * event/router/subtitle-style-settings.js — Router tên "subtitleStyleSettings".
 *
 * === VIẾT LẠI TOÀN BỘ (07/07/2026) — xem docstring event/workflow/subtitle-style-settings.js. ===
 * Workflow giờ tự tìm `displayEl` bên trong (dùng `subtitleSettingsPanelEl` lưu sẵn, KHÔNG cần
 * listener tính toán rồi gửi qua payload nữa — đơn giản hoá, giảm điểm có thể sai lệch).
 */
const routerSubtitleStyleSettings = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'subtitleStyleSettings.openPanel.click':
                workflowSubtitleStyleSettings.openPanel();
                break;
            case 'subtitleStyleSettings.enable.change':
                setSubtitlesEnabled(msg.payload.checked);
                break;
            case 'subtitleStyleSettings.bgColor.input':
                workflowSubtitleStyleSettings.setBgColor(msg.payload.value);
                break;
            case 'subtitleStyleSettings.bgOpacity.input':
                workflowSubtitleStyleSettings.setBgOpacity(msg.payload.rawValue);
                break;
            case 'subtitleStyleSettings.borderColor.input':
                workflowSubtitleStyleSettings.setBorderColor(msg.payload.value);
                break;
            case 'subtitleStyleSettings.borderOpacity.input':
                workflowSubtitleStyleSettings.setBorderOpacity(msg.payload.rawValue);
                break;
            case 'subtitleStyleSettings.borderWidth.input':
                workflowSubtitleStyleSettings.setBorderWidth(msg.payload.rawValue);
                break;
            case 'subtitleStyleSettings.borderRadius.input':
                workflowSubtitleStyleSettings.setBorderRadius(msg.payload.rawValue);
                break;
            case 'subtitleStyleSettings.textColor.input':
                workflowSubtitleStyleSettings.setTextColor(msg.payload.value);
                break;
            case 'subtitleStyleSettings.fontSize.input':
                workflowSubtitleStyleSettings.setFontSize(msg.payload.rawValue);
                break;
            case 'subtitleStyleSettings.lineHeight.input':
                workflowSubtitleStyleSettings.setLineHeight(msg.payload.rawValue);
                break;
            case 'subtitleStyleSettings.letterSpacing.input':
                workflowSubtitleStyleSettings.setLetterSpacing(msg.payload.rawValue);
                break;
            default:
                console.warn(`[routerSubtitleStyleSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleStyleSettings', routerSubtitleStyleSettings);
