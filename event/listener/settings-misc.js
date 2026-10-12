/**
 * event/listener/settings-misc.js — TẤT CẢ listener TĨNH của cụm "settingsMisc" (debugConsole + appRecovery) — gộp
 * vì mỗi nhánh quá nhỏ để xứng đáng 1 listener riêng (xem ghi chú đầu router/settings-misc.js).
 *
 * QUY TẮC (ẩn dụ "người gửi thư"):
 *   - Listener KHÔNG biết, KHÔNG quan tâm nội dung nghiệp vụ.
 *   - "Địa chỉ nhà" (msg.router) LUÔN là 'settingsMisc' cho mọi listener trong file này.
 *   - Dùng biến DOM có sẵn từ dom-refs.js, KHÔNG tự document.getElementById.
 * Nút trong màn Troubleshooting/Debug console dựng động gửi msg qua core/app-settings-ui.js / core/settings-misc-ui.js.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

// Lối tắt cưỡng chế mở Debug Console ngay trên layer loading shield — debug lúc app bị kẹt/treo dưới #loading-shield
// (xem TPL_LOADING_SHIELD, components/loading-shield.js + workflowSettingsMisc.forceOpenDebugConsole()).
if (btnLoadingShieldDebug) {
    btnLoadingShieldDebug.addEventListener('click', () => {
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.forceOpen', payload: {} });
    });
}

// Nút X của Debug Console mở cưỡng chế (header mang `data-debug-force-close`). Ủy quyền 1 lần trên genericDrawerHeader
// (TĨNH, core/dom-refs.js); Drawer khác không có attribute này -> bỏ qua.
if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => {
        if (!(e.target.closest && e.target.closest('[data-debug-force-close]'))) return;
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.forceClose.click', payload: {} });
    });
}

// ===================== appRecovery =====================

if (typeof btnRestartApp !== 'undefined' && btnRestartApp) {
    btnRestartApp.addEventListener('click', () => {
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restartApp.click', payload: {} });
    });
}

