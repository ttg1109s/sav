/**
 * core/settings-misc-ui.js — wire nút ĐỘNG của panel Debug Console (`pushSettingsPanel()` dựng
 * mới mỗi lần mở, core/settings-panel-stack-ui.js) — TÁCH RA từ event/workflow/settings-misc.js
 * (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow" — rà soát mở
 * rộng ra ngoài Photo/Edit). Rule 5a: DOM động, callback CHỈ `eventBus.send()`.
 *
 * NẠP SAU: event/bus.js.
 */

/** Wire 2 nút Copy all/Clear all + delegate cho nút Copy/Xoá TỪNG DÒNG của panel Debug Console.
 * Danh sách log (`#debug-console-list`) bị vẽ lại nhiều lần (mở/xoá dòng/Clear all) nên KHÔNG gắn
 * listener lên từng item — 1 delegate duy nhất trên chính phần tử danh sách (tồn tại suốt đời panel,
 * chỉ innerHTML con bị thay), callback CHỈ `eventBus.send()` (Rule 5a).
 * @param {HTMLElement} panelEl
 */
function wireDebugConsolePanelActions(panelEl) {
    const copyBtn = panelEl.querySelector('#btn-debug-console-copy');
    const clearBtn = panelEl.querySelector('#btn-debug-console-clear');
    const listEl = panelEl.querySelector('#debug-console-list');
    const paginationEl = panelEl.querySelector('#debug-console-pagination'); // MỚI 23/09/2026 — khung thanh phân trang (sống suốt đời panel, chỉ innerHTML con bị thay) -> 1 delegate

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (copyBtn) copyBtn.addEventListener('click', () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.copy.click', payload: {} }));
    if (clearBtn) clearBtn.addEventListener('click', () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.clear.click', payload: {} }));
    if (listEl) listEl.addEventListener('click', (e) => {
        const btnEl = e.target.closest('[data-debug-log-action]');
        if (!btnEl) return;
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.item.click', payload: { action: btnEl.dataset.debugLogAction, id: Number(btnEl.dataset.debugLogId), btnEl } });
    });
    if (paginationEl) paginationEl.addEventListener('click', (e) => {
        const pageBtn = e.target.closest('[data-pagination-action][data-page-index]');
        if (!pageBtn || pageBtn.disabled) return;
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.page.change', payload: { pageIndex: Number(pageBtn.dataset.pageIndex) } });
    });
}

/** Đổi icon của 1 nút Copy dòng (báo "đã copy" bằng dấu tick, rồi trả về icon gốc) — `iconHtml` do
 * components/debug-console-drawer.js::renderDebugConsoleCopyIconHtml() cung cấp (Rule 5d).
 * @param {HTMLElement} btnEl @param {string} iconHtml */
function setDebugConsoleCopyIcon(btnEl, iconHtml) {
    if (btnEl && btnEl.isConnected) btnEl.innerHTML = iconHtml;
}
