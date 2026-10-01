/**
 * event/router/recorder.js — Router "recorder" (MỚI 01/10/2026) — chế độ Ghi âm Player Song/Video, xem
 * event/workflow/recorder.js. Mọi case giao thẳng Workflow (cần đọc state/điều phối nhiều bước). 'recorder.start.click'
 * đã qua Block gate (event/block.js: đang ghi / Photo / Game -> chặn trước khi tới đây).
 * NẠP SAU: event/bus.js, event/workflow/recorder.js.
 */
const routerRecorder = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'recorder.start.click': { workflowRecorder.start(); break; }
            case 'recorder.stop.click': { workflowRecorder.stop(); break; }
            // Mic bị hệ điều hành thu hồi giữa chừng (cuộc gọi, app khác giành mic) — Giang chốt: xử lý như X.
            case 'recorder.mic.ended': { workflowRecorder.handleInterruption(); break; }
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
