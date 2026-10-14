/**
 * event/router/visualizer-display.js — Router tên "visualizerDisplay": cycle effect #btn-cycle-mode (giữ mở Custom
 * Effect Drawer / bấm đổi effect — cùng khuôn event/router/eq-presets.js), volume (Control Center HUD), panel "Display"
 * (Hiện Visual + 4 toggle UI chrome), modal chọn effect (đổi group). Cấu hình riêng effect: Custom Effect Drawer.
 *
 * QUY TẮC RẼ NHÁNH: nghiệp vụ chỉ cần ĐÚNG 1 hàm core -> gọi THẲNG; cần shield/modal hoặc >1 hàm
 * core nối tiếp -> giao workflowVisualizerDisplay.
 *
 * NẠP SAU: event/bus.js, event/workflow/visualizer-display.js, event/workflow/custom-effect.js, event/workflow/audio-engine.js.
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

            // ===================== Volume (Control Center HUD) =====================
            case 'visualizerDisplay.volume.input': {
                const { value } = msg.payload;
                workflowAudioEngine.setVolume(value); // event/workflow/audio-engine.js
                break;
            }

            // ===================== Panel "Display" (Hiện Visual + 4 toggle UI chrome) =====================
            case 'visualizerDisplay.visualEnable.change': {
                workflowVisualizerDisplay.setVisualEnabled(msg.payload.checked);
                break;
            }

            case 'visualizerDisplay.effectPicker.group.change': {
                workflowVisualizerDisplay.refillEffectPickerStyles(msg.payload.group);
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
