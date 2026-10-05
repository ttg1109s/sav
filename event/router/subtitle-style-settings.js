/**
 * event/router/subtitle-style-settings.js — Router "subtitleStyleSettings". Mọi case ghi cài đặt đều cần lưu
 * (saveConfig) + áp lại hiển thị -> giao Workflow (event/workflow/subtitle-style-settings.js).
 */
const routerSubtitleStyleSettings = (() => {
    function handle(msg) {
        switch (msg.type) {
            // (05/10/2026) case 'subtitleStyleSettings.openPanel.click' ĐÃ XOÁ — Subtitles mở qua row 'subtitle' của
            // Visualizer Screen (event/router/app-settings.js NAV_TARGETS).
            case 'subtitleStyleSettings.openStyling.click':
                workflowSubtitleStyleSettings.openStyling();
                break;
            case 'subtitleStyleSettings.openMagnitudePicker.click':
                workflowSubtitleStyleSettings.openMagnitudePicker(msg.payload.prefix);
                break;
            case 'subtitleStyleSettings.transitionField.change':
                workflowSubtitleStyleSettings.setTransitionField(msg.payload.field, msg.payload.value);
                break;
            case 'subtitleStyleSettings.enable.change':
                workflowSubtitleStyleSettings.setEnabled(msg.payload.checked);
                break;
            case 'subtitleStyleSettings.useCustomStyling.change':
                workflowSubtitleStyleSettings.setUseCustomStyling(msg.payload.checked);
                break;
            case 'subtitleStyleSettings.defaultField.change':
                workflowSubtitleStyleSettings.setDefaultField(msg.payload.field, msg.payload.value);
                break;
            case 'subtitleStyleSettings.karaokeField.change':
                workflowSubtitleStyleSettings.setKaraokeField(msg.payload.field, msg.payload.value);
                break;
            default:
                console.warn(`[routerSubtitleStyleSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleStyleSettings', routerSubtitleStyleSettings);
