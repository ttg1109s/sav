/**
 * event/router/wakelock.js — Router "wakeLock".
 * NẠP SAU: event/bus.js, event/workflow/wakelock.js. NẠP TRƯỚC: event/listener/wakelock.js.
 */
const routerWakeLock = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'wakeLock.firstInteraction':
                workflowWakeLock.requestIfSongPlaying();
                break;
            default:
                console.warn(`[routerWakeLock] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }
    return { handle };
})();

eventBus.register('wakeLock', routerWakeLock);
