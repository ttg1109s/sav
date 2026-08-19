/**
 * event/router/placeholder-panels.js — Router tên "placeholderPanels", tự đăng ký với eventBus lúc
 * nạp. 2 case Game/Statis — cùng gọi 1 method Workflow (nhận `panelEl` qua tham số, Rule 1: đây là
 * chọn ĐÍCH tác động, không phải rẽ nhánh TIẾN TRÌNH — "đóng panel X" luôn 1 tiến trình dù X là
 * Game hay Statis).
 *
 * NẠP SAU: event/bus.js, event/workflow/placeholder-panels.js, core/dom-refs.js (gamePanel/statisPanel).
 * NẠP TRƯỚC: event/listener/placeholder-panels.js.
 */
const routerPlaceholderPanels = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'placeholderPanels.game.close.click': {
                workflowPlaceholderPanels.close(gamePanel);
                break;
            }

            case 'placeholderPanels.statis.close.click': {
                workflowPlaceholderPanels.close(statisPanel);
                break;
            }

            default:
                console.warn(`[router:placeholderPanels] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('placeholderPanels', routerPlaceholderPanels);
