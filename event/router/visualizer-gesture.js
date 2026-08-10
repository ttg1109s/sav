/**
 * event/router/visualizer-gesture.js — Router tên "visualizerGesture".
 *
 * 2 msg.type, mỗi cái giao thẳng 1 method Workflow (cần track state điểm chạm giữa start/end,
 * không phải "1 hàm core" — xem event/workflow/visualizer-gesture.js).
 *
 * NẠP SAU: event/bus.js, event/workflow/visualizer-gesture.js.
 * NẠP TRƯỚC: event/listener/visualizer-gesture.js.
 */
const routerVisualizerGesture = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'visualizerGesture.touch.start':
                workflowVisualizerGesture.handleTouchStart(msg.payload.x, msg.payload.y);
                break;
            case 'visualizerGesture.touch.end':
                workflowVisualizerGesture.handleTouchEnd(msg.payload.x, msg.payload.y);
                break;
            default:
                console.warn(`[routerVisualizerGesture] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerGesture', routerVisualizerGesture);
