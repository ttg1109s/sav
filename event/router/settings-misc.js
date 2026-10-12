/**
 * event/router/settings-misc.js — Router tên "settingsMisc", tự đăng ký với eventBus lúc nạp.
 *
 * Gộp các nhánh nhỏ của Settings vào 1 router (mỗi nhánh quá nhỏ để xứng đáng 1 router/listener riêng):
 *   - `debugConsole`  — xem/copy/xoá log console trong app (kể cả lối tắt mở cưỡng chế trên loading shield).
 *   - `appRecovery`   — Khởi động lại app / Khôi phục cài đặt mặc định / Xoá cache.
 *
 * QUY TẮC RẼ NHÁNH:
 *   - Nghiệp vụ CHỈ CẦN ĐÚNG 1 HÀM CORE -> router tự gọi thẳng, BỎ QUA workflow.
 *   - Cần >1 hàm core (hoặc modal/shield) -> router giao cho workflowSettingsMisc.
 *
 * NẠP SAU: event/bus.js, core/app-recovery.js, core/debug-console.js, components/debug-console-drawer.js, lang/lang.js,
 * event/workflow/settings-misc.js. NẠP TRƯỚC: event/listener/settings-misc.js.
 */
const routerSettingsMisc = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'settingsMisc.debugConsole.open': {
                workflowSettingsMisc.openDebugConsole(); // >1 hàm core (push panel + đọc buffer + wire nút) -> workflow
                break;
            }

            // Lối tắt cưỡng chế mở Debug Console ngay trên layer loading shield (workflowSettingsMisc.forceOpenDebugConsole()).
            case 'settingsMisc.debugConsole.forceOpen': {
                workflowSettingsMisc.forceOpenDebugConsole();
                break;
            }
            // Nút X của Debug Console mở cưỡng chế (event/listener/settings-misc.js) — đóng hẳn Generic Drawer.
            case 'settingsMisc.debugConsole.forceClose.click': {
                workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
                break;
            }

            // Nút Copy all / Clear all — wire 1 lần ở core/settings-misc-ui.js.
            case 'settingsMisc.debugConsole.copy.click': {
                workflowSettingsMisc.copyDebugConsoleLog();
                break;
            }
            case 'settingsMisc.debugConsole.clear.click': {
                workflowSettingsMisc.clearDebugConsoleLog();
                break;
            }

            case 'settingsMisc.debugConsole.page.change': { // thanh phân trang Debug console
                workflowSettingsMisc.setDebugConsolePage(msg.payload.pageIndex);
                break;
            }

            // Copy/Xoá TỪNG DÒNG log (delegate trên #debug-console-list, core/settings-misc-ui.js) — rẽ theo payload.action.
            case 'settingsMisc.debugConsole.item.click': {
                const { action, id, btnEl } = msg.payload;
                if (action === 'copy') workflowSettingsMisc.copyDebugConsoleItem(id, btnEl);
                else if (action === 'remove') workflowSettingsMisc.removeDebugConsoleItem(id);
                break;
            }

            // ===================== appRecovery =====================

            case 'settingsMisc.restartApp.click': {
                workflowSettingsMisc.askRestartApp({
                    onConfirmSend: () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restartApp.confirm', payload: {} })
                });
                break;
            }

            case 'settingsMisc.restartApp.confirm': {
                executeRestartApp();
                break;
            }

            case 'settingsMisc.restoreDefaults.click': {
                workflowSettingsMisc.askRestoreDefaults({
                    onConfirmSend: () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restoreDefaults.confirm', payload: {} })
                });
                break;
            }

            case 'settingsMisc.restoreDefaults.confirm': {
                workflowSettingsMisc.confirmRestoreDefaults();
                break;
            }

            // Xoá cache js/css của trang.
            case 'settingsMisc.clearCache.click': {
                workflowSettingsMisc.askClearCache({
                    onConfirmSend: () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.clearCache.confirm', payload: {} })
                });
                break;
            }

            case 'settingsMisc.clearCache.confirm': {
                executeClearCache(); // core/app-recovery.js — async, không cần await ở đây (router không giữ gì sau lệnh gọi)
                break;
            }

            default:
                console.warn(`[router:settingsMisc] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('settingsMisc', routerSettingsMisc);
