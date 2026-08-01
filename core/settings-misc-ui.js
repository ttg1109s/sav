/**
 * core/settings-misc-ui.js — wire nút ĐỘNG của panel Debug Console (`pushSettingsPanel()` dựng
 * mới mỗi lần mở, core/settings-panel-stack-ui.js) — TÁCH RA từ event/workflow/settings-misc.js
 * (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow" — rà soát mở
 * rộng ra ngoài Photo/Edit). Rule 5a: DOM động, callback CHỈ `eventBus.send()`.
 *
 * NẠP SAU: event/bus.js.
 */

/** Wire nút Copy/Xoá của panel Debug Console.
 * @param {HTMLElement} panelEl
 */
function wireDebugConsolePanelActions(panelEl) {
    const copyBtn = panelEl.querySelector('#btn-debug-console-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.copy.click', payload: {} }));
    const clearBtn = panelEl.querySelector('#btn-debug-console-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.clear.click', payload: {} }));
}
