/**
 * event/router/gameplay.js — Router tên "gameplay" (Game Mode, Circle v1, MỚI 16/08/2026). Mọi
 * case CHỈ 1 hàm Workflow -> gọi THẲNG, KHÔNG giữ state context riêng (cùng khuôn router
 * 'visualizerControlCenter').
 *
 * SỬA (16/08/2026, Giang yêu cầu dùng modalChoice() thay overlay riêng cho màn Start/Kết quả) — bỏ
 * 3 case cũ ('gameplay.startCountdown.click'/'gameplay.scoreScreen.replay.click'/'gameplay.
 * scoreScreen.next.click') — nút trong modalChoice() giờ gọi THẲNG method Workflow (this.
 * startCountdown()/this.replay()/this.nextSong()), không còn DOM button riêng để dispatch qua đây
 * nữa (xem event/workflow/gameplay.js::start()/onSongEnded()).
 */
const routerGameplay = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'gameplay.modeEnabled.change':
                workflowGameplay.setModeEnabled(msg.payload.checked);
                break;

            case 'gameplay.tap.press':
                workflowGameplay.handleTap(msg.payload.x, msg.payload.y);
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
