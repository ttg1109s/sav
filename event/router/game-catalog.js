/**
 * event/router/game-catalog.js — MỚI (02/09/2026). Router tên "gameCatalog" (Game Panel, danh sách
 * card game kiểu appstore). 3 case, mỗi case CHỈ 1 hàm Workflow -> gọi THẲNG, KHÔNG giữ state
 * context riêng (msg.payload.gameId lấy thẳng từ `data-game-id` gắn lúc dựng card, xem
 * core/gameplay/game-panel-ui.js) — cùng khuôn router "gameplay"/"placeholderPanels".
 *
 * NẠP SAU: event/bus.js, event/workflow/game-catalog.js.
 * NẠP TRƯỚC: event/listener/game-catalog.js.
 */
const routerGameCatalog = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'gameCatalog.card.play.click':
                workflowGameCatalog.armGame(msg.payload.gameId);
                break;

            case 'gameCatalog.card.exit.click':
                workflowGameCatalog.disarmGame(msg.payload.gameId);
                break;

            case 'gameCatalog.card.difficulty.click':
                // [SỬA — 02/09/2026, Giang yêu cầu "phải lưu độ khó cho từng game"] Giờ truyền
                // `gameId` — cycleDifficulty() cần biết ĐÚNG card nào vừa bấm để ghi persistent
                // riêng cho game đó (trước đây bỏ qua payload này vì chỉ có 1 field dùng chung).
                workflowGameCatalog.cycleDifficulty(msg.payload.gameId);
                break;

            default:
                console.warn(`[router:gameCatalog] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('gameCatalog', routerGameCatalog);
