/**
 * event/router/settings-misc.js — Router tên "settingsMisc", tự đăng ký với eventBus lúc nạp.
 *
 * Gộp các nhánh nhỏ của Settings vào 1 router (không phải vì cùng nghiệp vụ, mà vì mỗi nhánh quá nhỏ để
 * xứng đáng 1 router/listener riêng — quyết định gom nhóm đã thống nhất, xem plan.md):
 *   - `debugConsole`  — xem/copy/xoá log console trong app.
 *   - `appRecovery`   — Khởi động lại app / Khôi phục cài đặt mặc định.
 * [21/09/2026] Nhánh `aboutDrawer` ĐÃ XOÁ (nút mở không còn tồn tại trong UI Settings).
 *
 * Ver 12 "Multi Media": nhánh `storageDrawer` ("Quản lý dung lượng") đã DỜI sang cụm "fileManagerSong"
 * (event/router/file-manager-song.js, plan-v12-multimedia.md mục 3).
 *
 * QUY TẮC RẼ NHÁNH:
 *   - Nghiệp vụ CHỈ CẦN ĐÚNG 1 HÀM CORE -> router tự gọi thẳng, BỎ QUA workflow.
 *   - Cần >1 hàm core (hoặc modal/shield) -> router giao cho workflowSettingsMisc.
 *
 * NẠP SAU: event/bus.js, core/app-recovery.js, core/debug-console.js (MỚI
 * 18/07/2026 — getDebugConsoleLogs/clearDebugConsoleLogs), core/settings-panel-stack-ui.js (cần
 * pushSettingsPanel),
 * components/debug-console-drawer.js (MỚI — cần renderDebugConsolePanelBody), lang/lang.js
 * (cần t()), event/workflow/settings-misc.js (cần workflowSettingsMisc tồn tại).
 * NẠP TRƯỚC: event/listener/settings-misc.js.
 */
const routerSettingsMisc = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // MỚI (18/07/2026, Giang yêu cầu — xem log console ngay trong app).
            case 'settingsMisc.debugConsole.open': {
                workflowSettingsMisc.openDebugConsole(); // >1 hàm core (push panel + đọc buffer + wire nút) -> workflow
                break;
            }

            // MỚI (10/09/2026, Giang yêu cầu — lối tắt cưỡng chế mở Debug Console ngay trên layer
            // loading shield, xem docstring workflowSettingsMisc.forceOpenDebugConsole()).
            case 'settingsMisc.debugConsole.forceOpen': {
                workflowSettingsMisc.forceOpenDebugConsole();
                break;
            }

            // MỚI (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow")
            // — nút Copy/Xoá wire 1 lần ở core/settings-misc-ui.js, KHÔNG còn gán trực tiếp trong
            // Workflow.
            case 'settingsMisc.debugConsole.copy.click': {
                workflowSettingsMisc.copyDebugConsoleLog();
                break;
            }
            case 'settingsMisc.debugConsole.clear.click': {
                workflowSettingsMisc.clearDebugConsoleLog();
                break;
            }

            // MỚI (20/09/2026) — Copy/Xoá TỪNG DÒNG log (delegate trên #debug-console-list, xem
            // core/settings-misc-ui.js). Rẽ nhánh theo payload.action của CHÍNH message này.
            case 'settingsMisc.debugConsole.page.change': { // MỚI 23/09/2026 — thanh phân trang Debug console
                workflowSettingsMisc.setDebugConsolePage(msg.payload.pageIndex);
                break;
            }

            case 'settingsMisc.debugConsole.item.click': {
                const { action, id, btnEl } = msg.payload;
                if (action === 'copy') workflowSettingsMisc.copyDebugConsoleItem(id, btnEl);
                else if (action === 'remove') workflowSettingsMisc.removeDebugConsoleItem(id);
                break;
            }

            // (aboutDrawer.close ĐÃ XOÁ — đóng About giờ dùng CHUNG 'settingsStackNav.back.click'
            // cho MỌI panel, xem event/router,workflow/settings-stack-nav.js)

            // (storageDrawer đã dời sang cụm "fileManagerSong" — xem header comment ở trên)

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

            // MỚI (14/07/2026, Giang yêu cầu — "nút xoá cache js/css cho page")
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
