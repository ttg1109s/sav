/**
 * event/listener/file-manager-storage.js — TẤT CẢ listener của cụm "fileManagerStorage" + 2 nút
 * TĨNH liên quan (Song & Video / Quản lý lưu trữ) ở section chính File Manager. MỚI (29/07/2026,
 * yêu cầu Giang) — THAY event/listener/file-manager-song.js + event/listener/file-manager-
 * cleanup.js (CẢ HAI ĐÃ XOÁ).
 *
 * SỬA (mục 1, phản hồi Giang "vào sub panel -> trực tiếp mở generic drawer browser Song & Video")
 * — `btnOpenFileManagerSong` (hàng "Song & Video", section chính) KHÔNG còn gửi
 * 'fileManagerSong.openPanel.click' (panel đó đã xoá) — giờ gửi THẲNG
 * 'fileManagerFolderBrowser.open.click' (router "fileManagerFolderBrowser" có sẵn, event/router/
 * file-manager-folder-browser.js — KHÔNG đổi gì ở router/workflow/core đó, chỉ đổi NƠI GỌI).
 *
 * MỚI (mục 2) — `btnOpenFileManagerStorage` (hàng "Quản lý lưu trữ" MỚI) mở panel MỚI qua router
 * "fileManagerStorage".
 *
 * MỚI (mục 2d) — nút "Dọn dẹp dữ liệu" (`#btn-file-manager-cleanup-run`, router "fileManagerCleanup"
 * — KHÔNG đổi gì ở router/workflow/core đó) giờ nằm TRONG panel push động "Quản lý lưu trữ" thay vì
 * ở section tĩnh — chuyển từ static binding (event/listener/file-manager-cleanup.js cũ, đã xoá) sang
 * delegate qua `settingsStackBody`, CÙNG khối delegate với các nút khác của panel này.
 *
 * QUY TẮC: giống event/listener/playlist.js — listener KHÔNG biết nghiệp vụ, chỉ bắt sự kiện DOM +
 * gửi message qua eventBus.send().
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerSong) {
    btnOpenFileManagerSong.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.open.click', payload: {} });
    });
}

if (btnOpenFileManagerStorage) {
    btnOpenFileManagerStorage.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.openPanel.click', payload: {} });
    });
}

function handleFileManagerStorageDelegatedClick(e) {
    // ===================== Dọn dẹp dữ liệu (DỜI từ event/listener/file-manager-cleanup.js) =====
    if (e.target.closest('#btn-file-manager-cleanup-run')) {
        eventBus.send({ router: 'fileManagerCleanup', type: 'fileManagerCleanup.run.click', payload: {} });
        return;
    }

    // ===================== Chọn mục xoá =====================
    if (e.target.closest('#btn-storage-execute')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageExecute.click', payload: {} });
        return;
    }

    // ===================== Dọn file lỗi =====================
    if (e.target.closest('#btn-storage-scan-broken')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.scanBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-delete-broken')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.deleteBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-dismiss-scan')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.dismissScan.click', payload: {} });
        return;
    }
}

/**
 * Delegate RIÊNG cho sự kiện 'change' — 4 toggle nguồn (MỚI, THAY <select> phạm vi cũ) + 2 toggle
 * hành động (Tải xuống/Xoá) — 'click' không bắt được đổi trạng thái checkbox đúng ngữ nghĩa 'change'.
 */
function handleFileManagerStorageDelegatedChange(e) {
    if (e.target.id === 'toggle-storage-source-song') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'song', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-source-video') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'video', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-source-photo') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'photo', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-source-document') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'document', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-download') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageDownloadToggle.change', payload: { checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-delete') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageDeleteToggle.change', payload: { checked: e.target.checked } });
        return;
    }
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerStorageDelegatedClick);
    settingsStackBody.addEventListener('change', handleFileManagerStorageDelegatedChange);
}
