/**
 * event/router/subtitle-style-settings.js — Router tên "subtitleStyleSettings".
 *
 * === VIẾT LẠI (mục 2, phản hồi Giang) === 10 case set* (style khung/chữ) ĐÃ XOÁ cùng 10 method
 * tương ứng ở workflow — xem docstring event/workflow/subtitle-style-settings.js.
 * MỚI (mục 4a/4b, 15/08/2026) — thêm case mở Styling (>1 bước -> Workflow) + case ghi field
 * Comming/In/Outing (1 hàm core -> gọi thẳng, đúng quy ước router).
 */
const routerSubtitleStyleSettings = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'subtitleStyleSettings.openPanel.click':
                workflowSubtitleStyleSettings.openPanel();
                break;
            case 'subtitleStyleSettings.openStyling.click':
                workflowSubtitleStyleSettings.openStyling();
                break;
            case 'subtitleStyleSettings.transitionField.change':
                setSubtitleTransitionField(msg.payload.field, msg.payload.value);
                break;
            case 'subtitleStyleSettings.enable.change':
                setSubtitlesEnabled(msg.payload.checked);
                break;
            default:
                console.warn(`[routerSubtitleStyleSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleStyleSettings', routerSubtitleStyleSettings);
