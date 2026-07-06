/**
 * event/router/settings-stack-nav.js — Router tên "settingsStackNav", tự đăng ký với eventBus lúc
 * nạp. CHỈ 1 nhánh: nút Back dùng CHUNG cho mọi panel con Settings (About/Visualizer/Slideshow/
 * .../File Manager) — xem event/workflow/settings-stack-nav.js để biết vì sao đây LUÔN cần
 * Workflow (taskManager chờ animation xong mới xoá DOM, Rule 3 cấm taskManager trong core).
 *
 * NẠP SAU: event/bus.js, event/workflow/settings-stack-nav.js.
 * NẠP TRƯỚC: event/listener/settings-stack-nav.js.
 */
const routerSettingsStackNav = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'settingsStackNav.back.click': {
                workflowSettingsStackNav.back();
                break;
            }

            default:
                console.warn(`[router:settingsStackNav] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('settingsStackNav', routerSettingsStackNav);
