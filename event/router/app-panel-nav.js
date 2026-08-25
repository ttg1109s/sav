/**
 * event/router/app-panel-nav.js — Router tên "appPanelNav", tự đăng ký với eventBus lúc nạp.
 * 6 case, mỗi case gọi ĐÚNG 1 method Workflow — KHÔNG đọc appState nào khác để rẽ nhánh (msg.type
 * đã tự đủ nghĩa, event-bus-flow.md mục 4B — mỗi case đều cần ≥1 bước chuẩn bị/≥2 lời gọi nối tiếp
 * nên LUÔN giao Workflow, không có case nào đạt điều kiện (A) gọi thẳng core). Case 'photo' đã xoá
 * — Photo hợp nhất vào Playlist làm 1 Source, không còn tab riêng.
 *
 * NẠP SAU: event/bus.js, event/workflow/app-panel-nav.js.
 * NẠP TRƯỚC: event/listener/app-panel-nav.js.
 */
const routerAppPanelNav = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'appPanelNav.media.click': {
                workflowAppPanelNav.openMedia();
                break;
            }

            case 'appPanelNav.folder.click': {
                workflowAppPanelNav.openFolder();
                break;
            }

            case 'appPanelNav.storage.click': {
                workflowAppPanelNav.openStorage();
                break;
            }

            case 'appPanelNav.game.click': {
                workflowAppPanelNav.openGame();
                break;
            }

            case 'appPanelNav.statis.click': {
                workflowAppPanelNav.openStatis();
                break;
            }

            case 'appPanelNav.setting.click': {
                workflowAppPanelNav.openSetting();
                break;
            }

            default:
                console.warn(`[router:appPanelNav] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('appPanelNav', routerAppPanelNav);
