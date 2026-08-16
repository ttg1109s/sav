/**
 * event/router/gameplay.js — Router tên "gameplay" (Game Mode, Circle v1, MỚI 16/08/2026). Mọi
 * case CHỈ 1 hàm Workflow -> gọi THẲNG, KHÔNG giữ state context riêng (cùng khuôn router
 * 'visualizerControlCenter').
 */
const routerGameplay = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'gameplay.modeEnabled.change':
                workflowGameplay.setModeEnabled(msg.payload.checked);
                break;

            case 'gameplay.startCountdown.click':
                workflowGameplay.startCountdown();
                break;

            case 'gameplay.tap.press':
                workflowGameplay.handleTap();
                break;

            case 'gameplay.scoreScreen.replay.click':
                workflowGameplay.replay();
                break;

            case 'gameplay.scoreScreen.next.click':
                workflowGameplay.nextSong();
                break;

            case 'gameplay.exit.click':
                workflowGameplay.exitToPlaylist();
                break;

            default:
                console.warn(`[routerGameplay] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('gameplay', routerGameplay);
