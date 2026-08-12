/**
 * event/router/settings-misc.js — Router tên "settingsMisc", tự đăng ký với eventBus lúc nạp.
 *
 * Gộp 2 nhánh ĐIỀU HƯỚNG/CHỨC NĂNG nhỏ của Settings vào 1 router (không phải vì cùng nghiệp vụ, mà
 * vì mỗi nhánh quá nhỏ để xứng đáng 1 router/listener riêng — quyết định gom nhóm đã thống nhất,
 * xem plan.md):
 *   - `aboutDrawer`   — MỞ panel About (push + render thống kê). Đóng KHÔNG còn ở đây (Batch D1,
 *     06/07/2026) — dùng CHUNG `settingsStackNav.back.click` cho MỌI panel con Settings, xem
 *     event/router,workflow/settings-stack-nav.js.
 *   - `appRecovery`   — Khởi động lại app / Khôi phục cài đặt mặc định.
 *
 * Ver 12 "Multi Media": nhánh `storageDrawer` (CON của aboutDrawer, "Quản lý dung lượng") đã DỜI
 * sang cụm "fileManagerSong" (event/router/file-manager-song.js, plan-v12-multimedia.md mục 3) —
 * File Manager giờ là điều hướng CẤP CAO riêng, không còn lồng trong About nữa.
 *
 * QUY TẮC RẼ NHÁNH:
 *   - Nghiệp vụ CHỈ CẦN ĐÚNG 1 HÀM CORE -> router tự gọi thẳng, BỎ QUA workflow.
 *   - Cần >1 hàm core (hoặc modal/shield) -> router giao cho workflowSettingsMisc.
 *
 * NẠP SAU: event/bus.js, core/about-stats.js, core/app-recovery.js, core/debug-console.js (MỚI
 * 18/07/2026 — getDebugConsoleLogs/clearDebugConsoleLogs), core/settings-panel-stack-ui.js (cần
 * pushSettingsPanel), components/about-drawer.js (cần renderAboutPanelBody),
 * components/debug-console-drawer.js (MỚI — cần renderDebugConsolePanelBody), lang/lang.js
 * (cần t()), event/workflow/settings-misc.js (cần workflowSettingsMisc tồn tại).
 * NẠP TRƯỚC: event/listener/settings-misc.js.
 */
const routerSettingsMisc = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== aboutDrawer =====================

            case 'settingsMisc.aboutDrawer.open': {
                // Batch D1 — nay >1 hàm core (push panel + tính thống kê bất đồng bộ) -> workflow.
                workflowSettingsMisc.openAbout();
                break;
            }

            // MỚI (18/07/2026, Giang yêu cầu — xem log console ngay trong app).
            case 'settingsMisc.debugConsole.open': {
                workflowSettingsMisc.openDebugConsole(); // >1 hàm core (push panel + đọc buffer + wire nút) -> workflow
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
