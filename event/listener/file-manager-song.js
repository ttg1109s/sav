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
 * === Batch 4 ("Song/Video Unification", mục 5) ===
 * Thêm 1 delegate 'change' RIÊNG (`handleFileManagerSongDelegatedChange`, cùng anchor
 * `settingsStackBody`) cho 2 toggle Scope/Exclude trong Folder Detail Drawer — nút Áp dụng/Bỏ áp
 * dụng cũ (bắt qua 'click') ĐÃ BỎ.
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

    // MỚI (14/07/2026, tích hợp pagination) — 2 nút ‹ › của #file-manager-folder-pagination
    // (buildPaginationFullHtml(), core/pagination.js — `data-pagination-action="prev"/"next"`,
    // KHÔNG có id riêng vì hàm đó trung tính/tái dùng được, xem docstring core/pagination.js).
    const folderPagination = e.target.closest('#file-manager-folder-pagination');
    if (folderPagination) {
        const actionBtn = e.target.closest('button[data-pagination-action]');
        if (!actionBtn) return; // bấm trúng vùng trống/số trang hiện tại (không phải nút) -> không gửi gì
        const type = actionBtn.dataset.paginationAction === 'next'
            ? 'fileManagerSong.folder.page.next'
            : 'fileManagerSong.folder.page.prev';
        eventBus.send({ router: 'fileManagerSong', type, payload: {} });
        return;
    }

    // ===================== Folder Detail Drawer (Phase 2, MỚI — mục 1b/c) =====================
    // MỚI (14/07/2026, Giang yêu cầu layout lại) — icon Sửa tên NGAY cạnh tên folder.
    if (e.target.closest('#btn-file-manager-folder-detail-rename')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.detail.rename.click', payload: {} });
        return;
    }

    const folderDetailSongList = e.target.closest('#file-manager-folder-detail-song-list');
    if (folderDetailSongList) {
        const btn = e.target.closest('button[data-remove-song-key]');
        if (!btn) return; // không bấm trúng icon X -> không gửi gì cả
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.removeSong', payload: { songKey: btn.dataset.removeSongKey } });
        return;
    }

    // MỚI (14/07/2026, tích hợp pagination) — mode 'list' (dãy số trang, buildPaginationListHtml(),
    // core/pagination.js) của danh sách bài trong Folder Detail.
    const folderDetailSongPagination = e.target.closest('#file-manager-folder-detail-song-pagination');
    if (folderDetailSongPagination) {
        const gotoBtn = e.target.closest('button[data-pagination-action="goto"]');
        if (!gotoBtn) return; // bấm trúng vùng trống -> không gửi gì
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.detail.song.page.goto', payload: { pageIndex: Number(gotoBtn.dataset.pageIndex) } });
        return;
    }

    // MỚI (14/07/2026, Giang yêu cầu) — nút "Xoá hết bài", CĂN GIỮA cuối panel Folder Detail.
    if (e.target.closest('#btn-file-manager-folder-detail-remove-all')) {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.removeAllSongs.click', payload: {} });
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

/**
 * MỚI (Batch 4, "Song/Video Unification" mục 5) — delegate RIÊNG cho sự kiện 'change' (2 toggle
 * Scope/Exclude trong Folder Detail Drawer) — TÁCH khỏi handleFileManagerSongDelegatedClick() ở
 * trên (sự kiện 'click' không bắt được đổi trạng thái checkbox theo đúng ngữ nghĩa "change", và
 * input[type=checkbox] không bubble 'input'/'change' qua `closest()` khác selector nào ngoài chính
 * nó nên kiểm tra thẳng `e.target.id`).
 */
function handleFileManagerSongDelegatedChange(e) {
    if (e.target.id === 'toggle-file-manager-folder-scope') {
        // MỚI (Batch 4) — THAY nút Áp dụng/Bỏ áp dụng cũ (1 nút đổi nhãn theo data-mode) bằng 1
        // toggle switch, 2 msg.type CŨ GIỮ NGUYÊN (Block gate event/block.js vẫn khớp đúng, không
        // cần đụng) tuỳ theo `checked` mới của checkbox.
        const type = e.target.checked
            ? 'fileManagerSong.folder.applyToPlaylist.click'
            : 'fileManagerSong.folder.unapplyFromPlaylist.click';
        eventBus.send({ router: 'fileManagerSong', type, payload: {} });
        return;
    }
    if (e.target.id === 'toggle-file-manager-folder-exclude') {
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.excludeToggle.change', payload: { enabled: e.target.checked } });
        return;
    }
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerSongDelegatedClick);
    settingsStackBody.addEventListener('change', handleFileManagerSongDelegatedChange);
}
