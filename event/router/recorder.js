/**
 * event/router/recorder.js — Router "recorder" — chế độ Ghi âm Player Song/Video (event/workflow/recorder.js). Mọi case
 * giao thẳng Workflow. 'recorder.start.click' đã qua Block gate (event/block.js: đang ghi / Photo / Game).
 * NẠP SAU: event/bus.js, event/workflow/recorder.js.
 */
const routerRecorder = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'recorder.start.click': { workflowRecorder.start(); break; }
            case 'recorder.stop.click': { workflowRecorder.stop(); break; }
            // Mic bị hệ điều hành thu hồi giữa chừng (cuộc gọi, app khác giành mic) — xử lý như X (kể cả đang Count-in).
            case 'recorder.mic.ended': { workflowRecorder.handleMicEnded(); break; }
            // Bấm "Bắt đầu đo" trong modal hướng dẫn Latency calibration.
            case 'recorder.calibration.start.click': { workflowRecorder.runCalibration(); break; }
            case 'recorder.preview.toggle.click': { workflowRecorder.togglePreview(); break; }
            case 'recorder.preview.seek': { workflowRecorder.seekPreview(msg.payload.ratio); break; }
            case 'recorder.review.save.click': { workflowRecorder.save(); break; }
            case 'recorder.review.cancel.click': { workflowRecorder.cancel(); break; }
            default:
                console.warn(`[router:recorder] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('recorder', routerRecorder);
