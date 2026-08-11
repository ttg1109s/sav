/**
 * event/router/eq-presets.js — Router tên "eqPresets".
 *
 * NẠP SAU: event/bus.js, event/workflow/eq-presets.js.
 * NẠP TRƯỚC: event/listener/eq-presets.js.
 */
const routerEqPresets = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'eqPresets.cycle.click':
                workflowEqPresets.cyclePreset();
                break;
            case 'eqPresets.openDrawer.click':
                workflowEqPresets.openListView();
                break;
            default:
                console.warn(`[routerEqPresets] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('eqPresets', routerEqPresets);
