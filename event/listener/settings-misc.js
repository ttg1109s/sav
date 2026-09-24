/**
 * event/listener/settings-misc.js — TẤT CẢ listener của cụm "settingsMisc" (debugConsole +
 * appRecovery) nằm CHUNG file này — gộp vì mỗi nhánh quá nhỏ để xứng đáng 1 listener riêng (xem
 * ghi chú đầu router/settings-misc.js).
 *
 * Ver 12 "Multi Media": nhánh storageDrawer đã DỜI sang cụm "fileManagerSong" (xem
 * event/listener/file-manager-song.js, plan-v12-multimedia.md mục 3).
 *
 * QUY TẮC (ẩn dụ "người gửi thư", không đổi):
 *   - Listener KHÔNG biết, KHÔNG quan tâm nội dung nghiệp vụ.
 *   - "Địa chỉ nhà" (msg.router) LUÔN là 'settingsMisc' cho mọi listener trong file này.
 *   - Dùng biến DOM có sẵn từ dom-refs.js, KHÔNG tự document.getElementById.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

// XOÁ (24/09/2026, rà soát refresh DOM) — listener `btnOpenDebugConsole` (#setting-open-debug-console không còn
// trong DOM, Debug console mở qua Settings > Troubleshooting — event/workflow/app-settings.js::_renderDebugConsole()).

// MỚI (10/09/2026, Giang yêu cầu — "lối tắt cưỡng chế mở Debug Console ngay trên layer loading
// shield", phục vụ debug lúc app bị kẹt/treo dưới #loading-shield, xem docstring TPL_LOADING_SHIELD
// components/loading-shield.js + workflowSettingsMisc.forceOpenDebugConsole()).
if (btnLoadingShieldDebug) {
    btnLoadingShieldDebug.addEventListener('click', () => {
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.debugConsole.forceOpen', payload: {} });
    });
}

// (btnBackAbout ĐÃ XOÁ — Batch D1: About không còn header/nút Back riêng, `#drawer-about` cũ
// không còn tồn tại. Back giờ dùng CHUNG `#btn-settings-stack-back`, xem
// event/listener/settings-stack-nav.js — KHÔNG để lại `if (x)` rỗng cho biến đã xoá.)

// ===================== storageDrawer — DỜI sang cụm "fileManagerSong" =====================
// (event/listener/file-manager-song.js, ver 12 "Multi Media", plan-v12-multimedia.md mục 3).
// #drawer-storage/#btn-open-storage/#btn-back-storage không còn tồn tại trong DOM (xem
// components/file-manager.js) — bỏ hẳn khối listener cũ ở đây, không để lại `if (x)` rỗng.

// ===================== appRecovery =====================

if (typeof btnRestartApp !== 'undefined' && btnRestartApp) {
    btnRestartApp.addEventListener('click', () => {
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restartApp.click', payload: {} });
    });
}

// XOÁ (24/09/2026, rà soát refresh DOM) — listener `btnRestoreDefaults`/`btnClearCache` (id không còn trong DOM).
// 2 hành động này giờ bấm từ màn Troubleshooting dựng động, gửi CÙNG msg.type qua core/app-settings-ui.js.
