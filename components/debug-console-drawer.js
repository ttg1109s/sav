/**
 * Component: Debug Console Drawer — panel hiện log đã bắt được từ console.log/warn/error (xem
 * core/debug-console.js). MỚI (18/07/2026, Giang yêu cầu — debug lúc test mobile không mở được
 * DevTools thật).
 *
 * SỬA (20/09/2026, Giang yêu cầu "chuyển các line thành item list: Nội dung | icon copy + clear,
 * styling theo chuẩn theme Light, sửa luôn styling 2 nút Copy all / Clear all") — TRƯỚC ĐÂY khối log
 * là 1 khung đen (`bg-black/40`, chữ `slate-300`, sót từ theme tối cũ) và 2 nút nền tối cứng; giờ:
 *   - mỗi dòng log = 1 ITEM (card `cardBg cardBorder`, log lỗi/cảnh báo nền rose/amber nhạt): bên trái
 *     nội dung (giờ + cấp độ + text), bên phải 2 icon nút — Copy dòng đó + Xoá dòng đó;
 *   - 2 nút trên cùng dùng ĐÚNG bộ key chuẩn của theme Light: Copy all = `btnPrimary*`, Clear all =
 *     `btnDestructive*` (cùng khuôn nút Storage/EQ), có icon.
 *
 * `renderDebugConsolePanelBody()` chỉ dựng KHUNG (2 nút + khung rỗng #debug-console-list) — DANH SÁCH
 * LOG THẬT được `event/workflow/settings-misc.js::_renderDebugConsoleList()` vẽ SAU bằng
 * `renderDebugConsoleListHtml()` bên dưới (đọc `getDebugConsoleLogs()` — core, đổi liên tục nên KHÔNG
 * vẽ 1 lần cố định ở template tĩnh này). Nút Copy/Xoá từng dòng mang `data-debug-log-action`
 * ('copy'|'remove') + `data-debug-log-id` (id dòng, core/debug-console.js) — wire bằng delegate 1 lần
 * trên #debug-console-list ở core/settings-misc-ui.js.
 */

const DEBUG_CONSOLE_ICON_COPY = 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z';
const DEBUG_CONSOLE_ICON_CHECK = 'M5 13l4 4L19 7';
const DEBUG_CONSOLE_ICON_REMOVE = 'M6 18L18 6M6 6l12 12';
const DEBUG_CONSOLE_ICON_TRASH = 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

function _renderDebugConsoleIconSvg(pathD, sizeClass) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${pathD}" /></svg>`;
}

/** Icon của nút Copy TỪNG DÒNG — `isDone` true = dấu tick (báo đã copy xong, Workflow tự trả về icon
 * gốc sau ~1s, xem workflowSettingsMisc.copyDebugConsoleItem()). */
function renderDebugConsoleCopyIconHtml(isDone) {
    return _renderDebugConsoleIconSvg(isDone ? DEBUG_CONSOLE_ICON_CHECK : DEBUG_CONSOLE_ICON_COPY, 'h-4 w-4');
}

function renderDebugConsolePanelBody() {
    return `
        <div class="flex flex-col gap-3" style="height: calc(85vh - 140px);">
            <div class="flex gap-2 shrink-0">
                <button id="btn-debug-console-copy" type="button" class="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${_renderDebugConsoleIconSvg(DEBUG_CONSOLE_ICON_COPY, 'h-4 w-4')}<span data-i18n="settingsMisc.debugConsole.btnCopy">${t('settingsMisc.debugConsole.btnCopy')}</span></button>
                <button id="btn-debug-console-clear" type="button" class="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" data-uitk="btnDestructiveBg btnDestructiveHoverBg textOnAccent">${_renderDebugConsoleIconSvg(DEBUG_CONSOLE_ICON_TRASH, 'h-4 w-4')}<span data-i18n="settingsMisc.debugConsole.btnClear">${t('settingsMisc.debugConsole.btnClear')}</span></button>
            </div>
            <div id="debug-console-list" class="flex flex-col gap-1.5 overflow-y-auto" style="flex: 1 1 0; min-height: 0;"></div>
        </div>
    `;
}

/** Trạng thái rỗng (chưa có log / đã Xoá hết). */
function renderDebugConsoleEmptyHtml() {
    return `<div class="text-sm text-center py-10" data-uitk="emptyStateText">${t('settingsMisc.debugConsole.emptyMsg')}</div>`;
}

/** 1 dòng log = 1 item. `escapeHtml()` (core/modal-choice-ui.js) BẮT BUỘC — nội dung log có thể chứa
 * bất kỳ ký tự nào (object dump, tên file người dùng...), gán qua `innerHTML` không escape sẽ vỡ layout/lộ XSS.
 * @param {{id: number, time: number, level: 'log'|'warn'|'error', text: string}} entry */
function renderDebugConsoleItemHtml(entry) {
    const isError = entry.level === 'error';
    const isWarn = entry.level === 'warn';
    // SỬA 23/09/2026 (rà soát theme) — khung/chữ dòng error/warn trước đây class cứng (bg-rose-50/text-rose-700...), giờ theo key theme.
    const boxTheme = ` data-uitk="${isError ? 'dangerSoftSurface' : isWarn ? 'cautionSoftSurface' : 'cardBg cardBorder'}"`;
    const textTheme = ` data-uitk="${isError ? 'destructiveText' : isWarn ? 'cautionText' : 'textPrimary'}"`;
    const levelLabel = (isError || isWarn) ? ` · ${entry.level.toUpperCase()}` : '';
    const time = new Date(entry.time).toLocaleTimeString();
    return `
        <div class="flex items-start gap-1 rounded-xl pl-3 pr-1.5 py-2"${boxTheme}>
            <div class="flex-1 min-w-0">
                <div class="text-[10px] font-mono leading-none mb-1" data-uitk="textSecondary">${time}${levelLabel}</div>
                <div class="text-xs font-mono leading-snug break-all whitespace-pre-wrap"${textTheme}>${escapeHtml(entry.text)}</div>
            </div>
            <div class="flex items-center shrink-0">
                <button type="button" data-debug-log-action="copy" data-debug-log-id="${entry.id}" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="btnGhostHoverBg textMutedIcon" title="${t('settingsMisc.debugConsole.item.copy.title')}">${renderDebugConsoleCopyIconHtml(false)}</button>
                <button type="button" data-debug-log-action="remove" data-debug-log-id="${entry.id}" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="btnGhostHoverBg destructiveText" title="${t('settingsMisc.debugConsole.item.remove.title')}">${_renderDebugConsoleIconSvg(DEBUG_CONSOLE_ICON_REMOVE, 'h-4 w-4')}</button>
            </div>
        </div>
    `;
}

/** Toàn bộ danh sách (cũ -> mới). @param {Array} logs */
function renderDebugConsoleListHtml(logs) {
    return logs.length === 0 ? renderDebugConsoleEmptyHtml() : logs.map(renderDebugConsoleItemHtml).join('');
}
