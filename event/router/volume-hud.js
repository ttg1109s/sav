/**
 * event/router/volume-hud.js — Router tên "volumeHud".
 *
 * NẠP SAU: event/bus.js, event/workflow/volume-hud.js.
 * NẠP TRƯỚC: event/listener/volume-hud.js.
 */
const routerVolumeHud = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'volumeHud.open.click':
                workflowVolumeHud.open();
                break;
            case 'volumeHud.slider.input':
                workflowVolumeHud.handleSliderInput(msg.payload.value);
                break;
            default:
                console.warn(`[routerVolumeHud] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('volumeHud', routerVolumeHud);
