/**
 * event/listener/file-manager-song.js — TẤT CẢ listener của cụm "fileManagerSong".
 *
 * QUY TẮC: giống event/listener/playlist.js — listener KHÔNG biết nghiệp vụ, chỉ bắt sự kiện DOM +
 * gửi message qua eventBus.send(). Dùng biến DOM có sẵn từ core/dom-refs.js.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

// ===================== Mở/đóng drawer (CHỐT 03/07/2026, mục 1a/7) =====================

if (btnOpenFileManagerSong) {
    btnOpenFileManagerSong.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.open', payload: {} });
    });
}

if (btnBackFileManagerSong) {
    btnBackFileManagerSong.addEventListener('click', () => {
        // Back trong drawer Song chỉ ẩn drawer này — KHÔNG động vào #drawer-settings bên dưới.
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.close', payload: {} });
    });
}

// ===================== Folder (mục 4.b1) =====================

if (btnFileManagerCreateFolder) {
    btnFileManagerCreateFolder.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.create', payload: {} });
    });
}

if (fileManagerFolderList) {
    fileManagerFolderList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-folder-action]');
        if (!btn) return; // không bấm trúng nút đổi tên/xoá -> không gửi gì cả
        const row = btn.closest('[data-folder-id]');
        if (!row) return;
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.actionClick', payload: { action: btn.dataset.folderAction, folderId: row.dataset.folderId } });
    });
}

// ===================== Quản lý dung lượng (DỜI từ event/listener/settings-misc.js) =====================

if (btnDownloadThenClear) {
    btnDownloadThenClear.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.downloadThenClear.click', payload: {} });
    });
}

if (btnClearNoDownload) {
    btnClearNoDownload.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.clearNoDownload.click', payload: {} });
    });
}

if (btnScanBroken) {
    btnScanBroken.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.scanBroken.click', payload: {} });
    });
}

if (btnDeleteBroken) {
    btnDeleteBroken.addEventListener('click', () => {
        // Không cần gửi gì trong payload — router tự đọc lastScanResults + currentKey trực tiếp.
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.deleteBroken.click', payload: {} });
    });
}

if (btnDismissScan) {
    btnDismissScan.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.dismissScan.click', payload: {} });
    });
}
