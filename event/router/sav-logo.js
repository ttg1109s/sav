/**
 * event/router/sav-logo.js — Router "savLogo". 'set' gọi thẳng core (payload đủ), 'toggle' giao workflowSavLogo.
 *
 * NẠP SAU: event/bus.js, event/workflow/sav-logo.js. NẠP TRƯỚC: event/listener/sav-logo.js.
 */
const routerSavLogo = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'savLogo.expand.set':
                setSavLogoExpanded(!!msg.payload.expand);
                break;
            case 'savLogo.expand.toggle':
                workflowSavLogo.toggleExpand();
                break;
            default:
                console.warn(`[routerSavLogo] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('savLogo', routerSavLogo);
