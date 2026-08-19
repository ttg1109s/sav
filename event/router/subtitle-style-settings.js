/**
 * event/router/subtitle-style-settings.js — Router tên "subtitleStyleSettings".
 *
 * === VIẾT LẠI (mục 2, phản hồi Giang) === 10 case set* (style khung/chữ) ĐÃ XOÁ cùng 10 method
 * tương ứng ở workflow — xem docstring event/workflow/subtitle-style-settings.js.
 * MỚI (mục 4a/4b, 15/08/2026) — thêm case mở Styling (>1 bước -> Workflow) + case ghi field
 * Comming/In/Outing (1 hàm core -> gọi thẳng, đúng quy ước router).
 * MỚI (16/08/2026, mục 3) — thêm case mở modal chọn độ lớn Comming/Outing (>1 bước (mở modal +
 * chờ callback) -> Workflow, CÙNG quy ước case "openStyling" ngay trên).
 * MỚI (16/08/2026, mục 3 tiếp) — thêm case toggle Custom Styling (>1 bước, đụng UI ẩn/hiện khác ->
 * Workflow) + case ghi 2 field mặc định fontSize/color (1 hàm core -> gọi thẳng).
 */
const routerSubtitleStyleSettings = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'subtitleStyleSettings.openPanel.click':
                // SỬA (đợt migrate Visualizer Screen) — điều hướng qua ngăn xếp app-settings.js
                // (liên tuyến domain, TH2) — panel này mở TỪ BÊN TRONG Display (đã migrate), không
                // còn pushSettingsPanel() nữa.
                workflowAppSettings.navigateTo(() => workflowAppSettings._renderSubtitle());
                break;
            case 'subtitleStyleSettings.openStyling.click':
                workflowSubtitleStyleSettings.openStyling();
                break;
            case 'subtitleStyleSettings.openMagnitudePicker.click':
                workflowSubtitleStyleSettings.openMagnitudePicker(msg.payload.prefix);
                break;
            case 'subtitleStyleSettings.transitionField.change':
                setSubtitleTransitionField(msg.payload.field, msg.payload.value);
                break;
            case 'subtitleStyleSettings.enable.change':
                setSubtitlesEnabled(msg.payload.checked);
                break;
            case 'subtitleStyleSettings.useCustomStyling.change':
                workflowSubtitleStyleSettings.setUseCustomStyling(msg.payload.checked);
                break;
            case 'subtitleStyleSettings.defaultField.change':
                setSubtitleDefaultField(msg.payload.field, msg.payload.value);
                break;
            default:
                console.warn(`[routerSubtitleStyleSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleStyleSettings', routerSubtitleStyleSettings);
