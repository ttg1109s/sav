/**
 * event/router/subtitle-style-settings.js — Router tên "subtitleStyleSettings".
 *
 * Batch D2 (Settings restructure, 06/07/2026) — 8/9 msg.type giờ CẦN workflow (Rule 1-4 đầy đủ đã
 * tách applySubtitleStyle()/saveConfig() ra khỏi core, xem event/workflow/subtitle-style-
 * settings.js). CHỈ `enable.change` còn gọi thẳng core (`setSubtitlesEnabled()` không đổi, checkbox
 * Main không di chuyển). Thêm case MỚI `openPanel.click` (push panel — trước đây thuộc router
 * "visualizerMiscSettings", dời VỀ ĐÚNG router của chính nó cho gọn, xem event/router/visualizer-
 * misc-settings.js đã bỏ case này).
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
                workflowSubtitleStyleSettings.setBgOpacity(msg.payload.rawValue, msg.payload.displayEl);
                break;
            case 'subtitleStyleSettings.borderColor.input':
                workflowSubtitleStyleSettings.setBorderColor(msg.payload.value);
                break;
            case 'subtitleStyleSettings.borderOpacity.input':
                workflowSubtitleStyleSettings.setBorderOpacity(msg.payload.rawValue, msg.payload.displayEl);
                break;
            case 'subtitleStyleSettings.borderWidth.input':
                workflowSubtitleStyleSettings.setBorderWidth(msg.payload.rawValue, msg.payload.displayEl);
                break;
            case 'subtitleStyleSettings.borderRadius.input':
                workflowSubtitleStyleSettings.setBorderRadius(msg.payload.rawValue, msg.payload.displayEl);
                break;
            case 'subtitleStyleSettings.textColor.input':
                workflowSubtitleStyleSettings.setTextColor(msg.payload.value);
                break;
            case 'subtitleStyleSettings.fontSize.input':
                workflowSubtitleStyleSettings.setFontSize(msg.payload.rawValue, msg.payload.displayEl);
                break;
            case 'subtitleStyleSettings.lineHeight.input':
                workflowSubtitleStyleSettings.setLineHeight(msg.payload.rawValue, msg.payload.displayEl);
                break;
            case 'subtitleStyleSettings.letterSpacing.input':
                workflowSubtitleStyleSettings.setLetterSpacing(msg.payload.rawValue, msg.payload.displayEl);
                break;
            default:
                console.warn(`[routerSubtitleStyleSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleStyleSettings', routerSubtitleStyleSettings);
