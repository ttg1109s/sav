/**
 * event/router/media-wait.js — Router "mediaWait": sự kiện của 2 phần tử media tĩnh (audioPlayer, bgVideoElement) cho danh
 * sách lượt chờ của event/workflow/media-wait.js.
 * NẠP SAU: event/bus.js, event/workflow/media-wait.js. NẠP TRƯỚC: event/listener/media-wait.js.
 */
const routerMediaWait = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'mediaWait.event':
                workflowMediaWait.notify(msg.payload.target, msg.payload.eventName);
                break;
            default:
                console.warn(`[router:mediaWait] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('mediaWait', routerMediaWait);
