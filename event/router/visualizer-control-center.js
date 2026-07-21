/**
 * event/router/visualizer-control-center.js — Router tên "visualizerControlCenter".
 *
 * QUY TẮC RẼ NHÁNH:
 *   - returnToVisualizer/controlCenter.toggle/controlCenter.overlayClick/controlCenter.gridClick/
 *     visualEnable.change CHỈ CẦN 1 hàm core (hoặc 1 DOM thuần) -> gọi THẲNG.
 *   - videoEnable.change/visualBgImageEnable.change (MỚI 04/07/2026, mục 1; SỬA 21/07/2026 —
 *     videoEnable giờ mở Generic Drawer picker thay vì hộp thoại file OS, xem event/workflow/
 *     file-manager-video.js::openVideoBgPicker()) — nhánh "bật" cần mở picker, >1 bước -> giao workflow.
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

            case 'visualizerControlCenter.videoEnable.change': {
                // FIX (04/07/2026, mục 1) — checked=true KHÔNG còn gọi thẳng enableVideoBackground()
                // nữa (giả định "đã biết chắc videoBgUrl có sẵn" SAI khi bật lần đầu -> "on ảo" tới
                // lúc đóng Settings mới tự sửa, xem validateVideoBgOnClose()). Giờ LUÔN mở hộp thoại
                // chọn file NGAY khi gạt On (>1 bước, có thể huỷ) -> workflow.
                if (msg.payload.checked) {
                    workflowVisualizerControlCenter.enableVideoBackgroundToggle();
                } else {
                    workflowVisualizerControlCenter.disableVideoBackground();
                }
                break;
            }

            case 'visualizerControlCenter.visualEnable.change':
                setVisualEnabled(msg.payload.checked);
                break;

            // SỬA (21/07/2026, dọn dẹp sau Batch 2) — case 'videoUpload.change'/'videoUpload.cancel'
            // ĐÃ XOÁ HẲN — input `#setting-video-upload` không còn tồn tại (xem event/listener/
            // visualizer-control-center.js), luồng "on" giờ đi thẳng qua Generic Drawer picker
            // (workflowVisualizerControlCenter.enableVideoBackgroundToggle(), case 'videoEnable.change' ở trên).

            // MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer. FIX (04/07/2026, mục 1) —
            // checked=false giờ CHỈ ẩn hiển thị (không còn đụng IndexedDB) nên KHÔNG cần workflow
            // nữa, nhưng vẫn giữ 1 chỗ gọi (workflow) cho nhất quán interface — xem
            // event/workflow/visualizer-control-center.js::disableVisualBgImage().
            case 'visualizerControlCenter.visualBgImageEnable.change': {
                if (msg.payload.checked) {
                    workflowVisualizerControlCenter.pickVisualBgImageFromLibrary(); // >1 hàm core -> workflow
                } else {
                    workflowVisualizerControlCenter.disableVisualBgImage();
                }
                break;
            }

            default:
                console.warn(`[routerVisualizerControlCenter] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerControlCenter', routerVisualizerControlCenter);
