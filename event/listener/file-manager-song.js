/**
 * event/listener/file-manager-song.js — TẤT CẢ listener của cụm "fileManagerSong".
 *
 * QUY TẮC: giống event/listener/playlist.js — listener KHÔNG biết nghiệp vụ, chỉ bắt sự kiện DOM +
 * gửi message qua eventBus.send().
 *
 * === Batch D5 (Settings restructure, 06/07/2026) ===
 * Panel Song (cấp 1) + Folder Detail (cấp 2) giờ push/pop động (core/settings-panel-stack.js) —
 * TOÀN BỘ listener bên dưới (trừ `btnOpenFileManagerSong`, Main tĩnh) ĐỔI sang 1 DELEGATE DUY NHẤT
 * trên `settingsStackBody` (CHUẨN đã dùng từ Batch D2), phân biệt qua `e.target.closest(...)` —
 * kể cả 2 khối vốn ĐÃ tự delegate nội bộ (`fileManagerFolderList`/`fileManagerFolderDetailSongList`)
 * chỉ cần đổi ANCHOR (từ container tĩnh sang settingsStackBody + `closest()` để scope đúng vùng),
 * logic phân biệt hàng/nút bên trong GIỮ NGUYÊN 100%. `btnBackFileManagerSong`/
 * `btnBackFileManagerFolderDetail` ĐÃ XOÁ (Back dùng CHUNG cho cả 2 cấp).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerSong) {
    btnOpenFileManagerSong.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.openPanel.click', payload: {} });
    });
}

function handleFileManagerSongDelegatedClick(e) {
    // ===================== Folder (mục 4.b1) =====================
    if (e.target.closest('#btn-file-manager-create-folder')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.create', payload: {} });
        return;
    }

    const folderList = e.target.closest('#file-manager-folder-list');
    if (folderList) {
        const row = e.target.closest('[data-folder-id]');
        if (!row) return; // không bấm trúng hàng folder nào -> không gửi gì cả
        const btn = e.target.closest('button[data-folder-action]');
        if (btn) {
            eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.actionClick', payload: { action: btn.dataset.folderAction, folderId: row.dataset.folderId } });
            return;
        }
        // Bấm vào hàng (không trúng nút rename/xoá) -> mở Folder Detail Drawer (Phase 2, MỚI).
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.openDetail', payload: { folderId: row.dataset.folderId } });
        return;
    }

    // ===================== Folder Detail Drawer (Phase 2, MỚI — mục 1b/c) =====================
    if (e.target.closest('#btn-file-manager-folder-apply-to-playlist')) {
        const btnApply = e.target.closest('#btn-file-manager-folder-apply-to-playlist');
        // MỚI (03/07/2026, đợt 4, điểm 2) — 1 nút, 2 msg.type tuỳ data-mode (workflow tự đổi
        // data-mode mỗi lần refresh, xem event/workflow/file-manager-song.js _updateApplyButtonMode()).
        const type = btnApply.dataset.mode === 'unapply'
            ? 'fileManagerSong.folder.unapplyFromPlaylist.click'
            : 'fileManagerSong.folder.applyToPlaylist.click';
        eventBus.send({ router: 'fileManagerSong', type, payload: {} });
        return;
    }

    const folderDetailSongList = e.target.closest('#file-manager-folder-detail-song-list');
    if (folderDetailSongList) {
        const btn = e.target.closest('button[data-remove-song-key]');
        if (!btn) return; // không bấm trúng icon X -> không gửi gì cả
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.removeSong', payload: { songKey: btn.dataset.removeSongKey } });
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
