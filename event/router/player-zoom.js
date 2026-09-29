/**
 * event/router/player-zoom.js — Router "playerZoom" (MỚI 29/09/2026) — Zoom mode của Player Video/Photo, xem
 * event/workflow/player-zoom.js.
 * NẠP SAU: event/bus.js, event/workflow/player-zoom.js.
 */
const routerPlayerZoom = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'playerZoom.toggle.click': { workflowPlayerZoom.toggle(); break; }
            case 'playerZoom.pointer.down': { workflowPlayerZoom.handlePointerDown(msg.payload.pointerId, msg.payload.x, msg.payload.y); break; }
            case 'playerZoom.pointer.move': { workflowPlayerZoom.handlePointerMove(msg.payload.pointerId, msg.payload.x, msg.payload.y); break; }
            case 'playerZoom.pointer.up': { workflowPlayerZoom.handlePointerUp(msg.payload.pointerId); break; }
            default:
                console.warn(`[router:playerZoom] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('playerZoom', routerPlayerZoom);
