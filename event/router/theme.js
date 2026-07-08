/**
 * event/router/theme.js — Router tên "theme", tự đăng ký với eventBus lúc nạp (MỞ ĐẦU THEME THẬT,
 * 07/07/2026, phản hồi Giang mục 3).
 *
 * NẠP SAU: event/bus.js, event/workflow/theme.js (workflowTheme).
 * NẠP TRƯỚC: event/listener/theme.js.
 */
const routerTheme = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'theme.selectMode.click':
                workflowTheme.selectThemeMode(msg.payload.mode); // >1 hàm core (đọc/ghi ảnh + đồng bộ UI) -> workflow
                break;
            default:
                console.warn(`[routerTheme] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('theme', routerTheme);
