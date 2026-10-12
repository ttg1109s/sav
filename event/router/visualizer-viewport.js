/**
 * event/router/visualizer-viewport.js — Router cụm "visualizerViewport" (MỚI 28/09/2026, Phase 3 dọn visualizer).
 *
 * Nhận sự kiện khung nhìn đổi kích thước từ event/listener/visualizer-viewport.js, giao Workflow
 * (`workflowVisualizerRender.onViewportResize()` — đổi kích thước canvas/renderer, báo từng group tự dựng lại
 * phần của mình). Thay `window.addEventListener('resize', resizeCanvas)` cũ đặt thẳng trong core/canvas-scene-setup.js.
 * SỬA (12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 3, khuôn W5) — thêm consumer thứ 2: lưới Game
 * (`workflowGameplay._handleLayoutResize()`, tự bỏ qua khi không có ván), thay `window.addEventListener('resize')` riêng
 * từng đặt trong event/workflow/gameplay.js. Gọi TRƯỚC visualizer — giữ đúng thứ tự cũ (listener của gameplay.js
 * đăng ký lúc nạp Workflow, trước listener viewport).
 */
const routerVisualizerViewport = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'visualizerViewport.window.resize':
                workflowGameplay._handleLayoutResize(); // event/workflow/gameplay.js — MỚI 12/10/2026
                workflowVisualizerRender.onViewportResize(); // event/workflow/visualizer-render.js
                break;
            default:
                console.warn(`[routerVisualizerViewport] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerViewport', routerVisualizerViewport);
