/**
 * event/router/visualizer-viewport.js — Router cụm "visualizerViewport".
 *
 * Nhận sự kiện khung nhìn đổi kích thước từ event/listener/visualizer-viewport.js, giao 2 consumer theo thứ tự:
 *   1. Lưới Game — `workflowGameplay.handleLayoutResize()` (tự bỏ qua khi không có ván).
 *   2. Visualizer — `workflowVisualizerRender.onViewportResize()` (đổi kích thước canvas/renderer, báo từng group tự
 *      dựng lại phần của mình).
 */
const routerVisualizerViewport = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'visualizerViewport.window.resize':
                workflowGameplay.handleLayoutResize(); // event/workflow/gameplay.js
                workflowVisualizerRender.onViewportResize(); // event/workflow/visualizer-render.js
                break;
            default:
                console.warn(`[routerVisualizerViewport] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerViewport', routerVisualizerViewport);
