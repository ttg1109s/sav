/**
 * event/router/visualizer-display.js — Router tên "visualizerDisplay".
 *
 * Cấu hình riêng effect (màu/blur/style con/kích thước) ĐÃ DỜI sang Custom Effect Drawer — case
 * tương ứng ĐÃ BỎ khỏi router này, xem event/workflow/custom-effect.js (wiring trực tiếp trong
 * Drawer, không qua eventBus). Router này giờ chỉ còn: ảnh nền, độ mờ nền, cycle effect (hold mở
 * Drawer/click đổi effect — CÙNG khuôn event/router/eq-presets.js), volume, panel "Display".
 *
 * QUY TẮC RẼ NHÁNH: nghiệp vụ chỉ cần ĐÚNG 1 hàm core -> gọi THẲNG; cần shield/modal hoặc >1 hàm
 * core nối tiếp -> giao workflowVisualizerDisplay.
 *
 * NẠP SAU: event/bus.js, core/visualizer/visualizer-display.js, core/visualizer-control-center.js
 * (setVisualEnabled), event/workflow/visualizer-display.js, event/workflow/custom-effect.js.
 * NẠP TRƯỚC: event/listener/visualizer-display.js.
 */
const routerVisualizerDisplay = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'visualizerDisplay.openDisplayPanel.click': {
                workflowVisualizerDisplay.openDisplayPanel();
                break;
            }

            case 'visualizerDisplay.openAutoSwitchPanel.click': {
                workflowVisualizerDisplay.openAutoSwitchPanel();
                break;
            }

            // ===================== Cycle effect (#btn-cycle-mode) — CÙNG khuôn #btn-cycle-eq =====================
            case 'visualizerDisplay.cyclePress.start':
                workflowCustomEffect.startHold();
                break;
            case 'visualizerDisplay.cyclePress.end':
                workflowCustomEffect.endHold();
                break;
            case 'visualizerDisplay.cyclePress.cancel':
                workflowCustomEffect.cancelHold();
                break;
            case 'visualizerDisplay.cycle.click':
                workflowCustomEffect.onCycleModeClick();
                break;

            // ===================== Ảnh nền (Main, KHÔNG di chuyển) =====================
            case 'visualizerDisplay.bgImage.toggle': {
                const { enabled } = msg.payload;
                workflowVisualizerDisplay.toggleBgImage({ enabled });
                break;
            }

            case 'visualizerDisplay.bgBlur.input': {
                const { value } = msg.payload;
                workflowVisualizerDisplay.setBgBlur(value);
                break;
            }

            // ===================== Volume (Control Center HUD) =====================
            case 'visualizerDisplay.volume.input': {
                const { value } = msg.payload;
                setVolume(value);
                break;
            }

            // ===================== Panel "Display" (Hiện Visual + 4 toggle UI chrome) =====================
            case 'visualizerDisplay.visualEnable.change': {
                setVisualEnabled(msg.payload.checked); // core/visualizer-control-center.js
                break;
            }

            case 'visualizerDisplay.statsPanelEnable.change': {
                workflowVisualizerDisplay.setStatsPanelEnabled(msg.payload.checked);
                break;
            }

            case 'visualizerDisplay.bottomPlayerVisible.change': {
                workflowVisualizerDisplay.setBottomPlayerVisible(msg.payload.checked);
                break;
            }

            case 'visualizerDisplay.playlistButtonVisible.change': {
                workflowVisualizerDisplay.setPlaylistButtonVisible(msg.payload.checked);
                break;
            }

            case 'visualizerDisplay.controlCenterButtonVisible.change': {
                workflowVisualizerDisplay.setControlCenterButtonVisible(msg.payload.checked);
                break;
            }

            default:
                console.warn(`[router:visualizerDisplay] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('visualizerDisplay', routerVisualizerDisplay);
