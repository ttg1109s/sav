/**
 * event/router/visualizer-viewport.js — Router cụm "visualizerViewport" (MỚI 28/09/2026, Phase 3 dọn visualizer).
 *
 * Nhận sự kiện khung nhìn đổi kích thước từ event/listener/visualizer-viewport.js, giao Workflow
 * (`workflowVisualizerRender.onViewportResize()` — đổi kích thước canvas/renderer, báo từng group tự dựng lại
 * phần của mình). Thay `window.addEventListener('resize', resizeCanvas)` cũ đặt thẳng trong core/canvas-scene-setup.js.
 */
const routerVisualizerViewport = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'visualizerViewport.window.resize':
                workflowVisualizerRender.onViewportResize(); // event/workflow/visualizer-render.js
                break;
            default:
                console.warn(`[routerVisualizerViewport] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerViewport', routerVisualizerViewport);
