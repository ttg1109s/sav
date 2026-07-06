/**
 * event/listener/settings-misc.js — TẤT CẢ listener của cụm "settingsMisc" (aboutDrawer +
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

// ===================== aboutDrawer =====================

if (btnOpenAbout) {
    btnOpenAbout.addEventListener('click', () => {
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.aboutDrawer.open', payload: {} });
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

if (typeof btnRestoreDefaults !== 'undefined' && btnRestoreDefaults) {
    btnRestoreDefaults.addEventListener('click', () => {
        eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restoreDefaults.click', payload: {} });
    });
}
