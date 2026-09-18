/**
 * event/router/hud.js — Router "hud" (Volume + Speed, 2 panel nổi kiểu popup hệ thống).
 * NẠP SAU: event/bus.js, event/workflow/hud.js.
 * NẠP TRƯỚC: event/listener/hud.js.
 */
const routerHud = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'hud.volume.open.click':
                workflowHud.openVolume();
                break;
            case 'hud.volume.slider.input':
                workflowHud.handleVolumeSliderInput(msg.payload.value);
                break;
            case 'hud.speed.open.click':
                workflowHud.openSpeed();
                break;
            case 'hud.speed.option.click':
                workflowHud.selectSpeed(msg.payload.value);
                break;
            default:
                console.warn(`[routerHud] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('hud', routerHud);
