/**
 * event/router/visualizer-control-center.js — Router "visualizerControlCenter": mỗi case 1 lời gọi (core
 * core/visualizer-control-center.js, hoặc workflowPlayerControls.returnToVisualizer()). Không giữ state riêng.
 */
const routerVisualizerControlCenter = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'visualizerControlCenter.returnToVisualizer.click':
                workflowPlayerControls.returnToVisualizer(); // event/workflow/player-controls.js
                break;

            case 'visualizerControlCenter.toggle.click':
                toggleControlCenter();
                break;

            case 'visualizerControlCenter.overlay.click':
                closeControlCenter();
                break;

            case 'visualizerControlCenter.gridAction.click': // icon trong grid (data-cc-action) -> đóng ngay, không đợi animation
                closeControlCenter();
                break;

            default:
                console.warn(`[routerVisualizerControlCenter] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerControlCenter', routerVisualizerControlCenter);
