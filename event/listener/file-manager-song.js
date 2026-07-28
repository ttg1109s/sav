/**
 * event/listener/file-manager-song.js — TẤT CẢ listener của cụm "fileManagerSong". Panel này giờ
 * tên hiển thị "Song & Video" (ver12 "Song/Video Unification").
 *
 * QUY TẮC: giống event/listener/playlist.js — listener KHÔNG biết nghiệp vụ, chỉ bắt sự kiện DOM +
 * gửi message qua eventBus.send().
 *
 * SỬA (Batch 5, "Song/Video Unification" mục 6e) — TOÀN BỘ handler Folder/Folder Detail Drawer
 * (list, phân trang, rename/xoá, remove item, 2 toggle Scope/Exclude...) ĐÃ XOÁ khỏi file này —
 * chuyển hẳn sang event/workflow/file-manager-folder-browser.js (Generic Drawer, tự wire
 * addEventListener trực tiếp lên genericDrawerHeader/Body, KHÔNG qua delegate settingsStackBody
 * nữa — xem docstring đầu file đó). Panel Song & Video giờ có 1 nút MỚI mở Drawer đó ("Duyệt thư
 * mục", `#btn-file-manager-folder-browser-open`).
 *
 * SỬA (Batch 5, mục 6b) — 2 handler nút cũ (download-then-clear/clear-no-download) ĐÃ XOÁ, thay
 * bằng delegate 'change' MỚI (`handleFileManagerSongDelegatedChange`, cùng anchor
 * `settingsStackBody`) cho 2 toggle "Giải phóng bộ nhớ" (Tải xuống/Xoá) + 3 nút phạm vi vẫn bắt
 * qua 'click' (handleFileManagerSongDelegatedClick).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerSong) {
    btnOpenFileManagerSong.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.openPanel.click', payload: {} });
    });
}

function handleFileManagerSongDelegatedClick(e) {
    // MỚI (Batch 5, mục 6e) — nút "Duyệt thư mục", mở Generic Drawer List↔Read (router riêng
    // "fileManagerFolderBrowser", xem event/router/file-manager-folder-browser.js).
    if (e.target.closest('#btn-file-manager-folder-browser-open')) {
        eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.open.click', payload: {} });
        return;
    }

    // ===================== Giải phóng bộ nhớ — 3 chiều độc lập (Batch 5, mục 6b) =====================
    const scopeBtn = e.target.closest('button[data-storage-scope]');
    if (scopeBtn) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.storageScope.change', payload: { scope: scopeBtn.dataset.storageScope } });
        return;
    }
    if (e.target.closest('#btn-storage-execute')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.storageExecute.click', payload: {} });
        return;
    }

    // ===================== Dọn file lỗi (DỜI từ event/listener/settings-misc.js) =====================
    if (e.target.closest('#btn-storage-scan-broken')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.scanBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-delete-broken')) {
        // Không cần gửi gì trong payload — router tự đọc lastScanResults + currentKey trực tiếp.
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.deleteBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-dismiss-scan')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.dismissScan.click', payload: {} });
        return;
    }
}

/**
 * MỚI (Batch 5, mục 6b) — delegate RIÊNG cho sự kiện 'change' (2 toggle "Giải phóng bộ nhớ") —
 * cùng lý do đã áp dụng cho 2 toggle Scope/Exclude ở Batch 4 (đã dời sang Generic Drawer từ Batch
 * 5 mục 6e, không còn ở file này nữa) — 'click' không bắt được đổi trạng thái checkbox đúng ngữ
 * nghĩa "change".
 */
function handleFileManagerSongDelegatedChange(e) {
    if (e.target.id === 'toggle-storage-download') {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.storageDownloadToggle.change', payload: { checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-delete') {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.storageDeleteToggle.change', payload: { checked: e.target.checked } });
        return;
    }
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerSongDelegatedClick);
    settingsStackBody.addEventListener('change', handleFileManagerSongDelegatedChange);
}
