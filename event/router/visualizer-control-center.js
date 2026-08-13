/**
 * event/router/visualizer-control-center.js — Router tên "visualizerControlCenter".
 *
 * QUY TẮC RẼ NHÁNH:
 *   - returnToVisualizer/controlCenter.toggle/controlCenter.overlayClick/controlCenter.gridClick/
 *     visualEnable.change CHỈ CẦN 1 hàm core (hoặc 1 DOM thuần) -> gọi THẲNG.
 * SỬA (v13 Batch A+B) — 4 case còn lại ĐỀU gọi THẲNG Core (core/visualizer-control-center.js), cụm
 * này KHÔNG còn file Workflow nào (đã xoá — toàn bộ nghiệp vụ nền/picker dời sang cụm `visualBg`).
 * KHÔNG giữ state context riêng.
 */
const routerVisualizerControlCenter = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'visualizerControlCenter.returnToVisualizer.click':
                returnToVisualizer();
                break;

            case 'visualizerControlCenter.toggle.click':
                toggleControlCenter();
                break;

            case 'visualizerControlCenter.overlay.click':
                closeControlCenter();
                break;

            case 'visualizerControlCenter.gridClick':
                handleControlCenterGridClick(msg.payload.target);
                break;

            // XOÁ (v13 Batch A) — 2 case 'videoEnable.enable.click'/'videoEnable.disable.click'
            // ĐÃ BỎ HẲN cùng toggle #setting-video-enable. Video nền giờ là 1 tổ hợp của cụm
            // router `visualBg` (event/router/visual-bg.js).

            // XOÁ (12/08/2026) — case 'visualizerControlCenter.visualEnable.change' ĐÃ BỎ, nút dời
            // sang delegate router 'visualizerDisplay' (panel "Display" động).

            // SỬA (21/07/2026, dọn dẹp sau Batch 2) — case 'videoUpload.change'/'videoUpload.cancel'
            // ĐÃ XOÁ HẲN — input `#setting-video-upload` không còn tồn tại (xem event/listener/
            // visualizer-control-center.js), luồng "on" giờ đi thẳng qua Generic Drawer picker
            // (luồng đó giờ thuộc cụm router `visualBg`).

            // XOÁ (v13 Batch A) — case 'visualBgImageEnable.change' ĐÃ BỎ HẲN cùng toggle
            // #setting-visual-bg-image-enable (xem event/router/visual-bg.js).

            // XOÁ (v13 Batch B) — 2 case 'videoBgPicker.tile.click'/'videoBgPicker.close.click'
            // ĐÃ DỜI sang cụm router `visualBg` ('visualBg.videoPicker.*') cùng toàn bộ picker.

            default:
                console.warn(`[routerVisualizerControlCenter] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerControlCenter', routerVisualizerControlCenter);
