/**
 * Component: Debug Console Drawer — panel hiện log đã bắt được từ console.log/warn/error (xem
 * core/debug-console.js). MỚI (18/07/2026, Giang yêu cầu — debug lúc test mobile không mở được
 * DevTools thật).
 *
 * `renderDebugConsolePanelBody()` chỉ dựng KHUNG (nút Copy/Xoá + khung rỗng #debug-console-list) —
 * DANH SÁCH LOG THẬT được `event/workflow/settings-misc.js::_renderDebugConsoleList()` tự vẽ SAU
 * (đọc `getDebugConsoleLogs()` — core, có thể thay đổi liên tục nên KHÔNG vẽ 1 lần cố định ở
 * template tĩnh này).
 */
function renderDebugConsolePanelBody() {
    return `
        <div class="flex flex-col gap-3" style="height: calc(100vh - 140px);">
            <div class="flex gap-2 shrink-0">
                <button id="btn-debug-console-copy" type="button" class="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-semibold transition-colors" data-i18n="settingsMisc.debugConsole.btnCopy">${t('settingsMisc.debugConsole.btnCopy')}</button>
                <button id="btn-debug-console-clear" type="button" class="flex-1 py-2 rounded-xl bg-rose-800 hover:bg-rose-700 text-xs font-semibold transition-colors" data-i18n="settingsMisc.debugConsole.btnClear">${t('settingsMisc.debugConsole.btnClear')}</button>
            </div>
            <div id="debug-console-list" class="flex-1 overflow-y-auto bg-black/40 rounded-xl p-3 font-mono text-[11px] leading-relaxed"></div>
        </div>
    `;
}
