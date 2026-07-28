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
 * nữa — xem docstring đầu file đó). Delegate 'change' (2 toggle) ĐÃ BỎ HẲN cùng lý do — không còn
 * gì cần bắt sự kiện 'change' ở ĐÂY nữa. Panel Song & Video giờ chỉ còn 1 nút MỚI mở Drawer đó
 * ("Duyệt thư mục", `#btn-file-manager-folder-browser-open`).
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

    // ===================== Quản lý dung lượng (DỜI từ event/listener/settings-misc.js) =====================
    if (e.target.closest('#btn-storage-download-then-clear')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.downloadThenClear.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-clear-no-download')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.clearNoDownload.click', payload: {} });
        return;
    }
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

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerSongDelegatedClick);
}
