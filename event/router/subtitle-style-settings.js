/**
 * event/router/subtitle-style-settings.js — Router tên "subtitleStyleSettings".
 *
 * === VIẾT LẠI (mục 2, phản hồi Giang) === 10 case set* (style khung/chữ) ĐÃ XOÁ cùng 10 method
 * tương ứng ở workflow — xem docstring event/workflow/subtitle-style-settings.js. Chỉ còn 2 case:
 * mở panel con (>1 bước — push panel + refresh -> Workflow) và bật/tắt (1 hàm core -> gọi thẳng,
 * đúng quy ước router).
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
            default:
                console.warn(`[routerSubtitleStyleSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleStyleSettings', routerSubtitleStyleSettings);
