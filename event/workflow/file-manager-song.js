/**
 * event/workflow/file-manager-song.js — "THẰNG THỰC THI CUỐI" của router "fileManagerSong".
 *
 * QUY TẮC: giống hệt event/workflow/playlist.js — chuỗi gọi hàm core thuần, withLoadingShield()/
 * alertModal()/modalChoice() CHỈ đặt ở tầng này.
 *
 * 3 nhóm method:
 *   1. Folder (MỚI, mục 4.b1): refreshSongTab/createFolderFromInput/renameFolderById/deleteFolderById.
 *   2. Folder Detail Drawer (Phase 2, MỚI mục 1b/c, CHỐT 03/07/2026): openFolderDetail/
 *      refreshFolderDetail/removeSongFromFolderById/applyFolderToPlaylist/deleteActiveFolderById.
 *   3. Quản lý dung lượng (DỜI NGUYÊN VẸN từ event/workflow/settings-misc.js — nhánh storageDrawer
 *      cũ, xem comment đầu components/file-manager.js) — askDeleteBroken/executeDeleteBroken/
 *      askDownloadThenClear/executeDownloadThenClear/askClearNoDownload/executeClearNoDownload/
 *      executeScanBroken. Thân hàm GIỮ NGUYÊN 100% so với bản gốc, chỉ đổi vị trí file + tên biến
 *      workflow (workflowSettingsMisc -> workflowFileManagerSong).
 */
const workflowFileManagerSong = {

    // ===================== Mở/đóng drawer (CHỐT 03/07/2026, mục 1a/7 — Song giờ là drawer con
    // độc lập mở thẳng từ Settings, không còn màn "File Manager" cha điều phối nữa) ============

    /** Ứng với 'fileManagerSong.open'. >1 hàm core nối tiếp (patch DOM + refresh dữ liệu) -> workflow. */
    async openDrawer() {
        showFileManagerSongDrawer(); // core/file-manager/nav.js
        await this.refreshSongTab();
    },

    // ===================== Folder (mục 4.b1) =====================

    /** Vẽ lại toàn bộ nội dung tab Song: danh sách folder + thống kê dung lượng + reset UI quét lỗi
     * — gọi lúc mở drawer Song. */
    async refreshSongTab() {
        const folders = await listFolders(); // core có sẵn (core/file-manager/folder.js), CÓ return, DÙNG ngay dưới
        renderFolderListUI(folders, appState.get('activePlayListFolder')); // core có sẵn (core/file-manager/folder-list-ui.js) — MỚI: truyền activeFolderId (sửa gap UX 03/07/2026)
        await renderStorageStats(); // core có sẵn (core/storage-manager.js)
        resetScanResultUI(); // core có sẵn (core/storage-manager.js)
    },

    /** Ứng với 'fileManagerSong.folder.create'. */
    async createFolderFromInput() {
        if (!fileManagerNewFolderInput) return; // guard
        const name = fileManagerNewFolderInput.value.trim();
        if (!name) return; // guard: chưa nhập tên thì không làm gì

        await createFolder(name); // core có sẵn (core/file-manager/folder.js)
        fileManagerNewFolderInput.value = '';
        await this.refreshSongTab();
    },

    /** Ứng với 'fileManagerSong.folder.actionClick' (action='rename'). Đọc tên hiện tại THẲNG từ
     * DOM đã render sẵn (tránh round-trip đọc lại DB chỉ để lấy tên đang hiển thị). */
    renameFolderById(folderId) {
        const row = fileManagerFolderList.querySelector(`[data-folder-id="${folderId}"]`);
        const currentName = row ? row.querySelector('span').textContent : '';
        openRenameFolderModal(currentName, async (newName) => {
            await renameFolder(folderId, newName); // core có sẵn
            await this.refreshSongTab();
        });
    },

    /** Ứng với 'fileManagerSong.folder.actionClick' (action='delete'). */
    deleteFolderById(folderId) {
        const row = fileManagerFolderList.querySelector(`[data-folder-id="${folderId}"]`);
        const folderName = row ? row.querySelector('span').textContent : '';
        modalChoice(
            tFormat('fileManager.song.deleteFolderConfirm', { name: escapeHtml(folderName) }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteFolder(folderId); // core có sẵn
                    await this.refreshSongTab();
                } }
            ],
            { title: t('fileManager.song.deleteFolderTitle') }
        );
    },

    // ===================== Folder Detail Drawer (Phase 2, MỚI — mục 1b/c, CHỐT 03/07/2026) =====

    /** Ứng với 'fileManagerSong.folder.openDetail'. Mở + vẽ danh sách bài trong 1 folder cụ thể. */
    async openFolderDetail(folderId) {
        showFileManagerFolderDetailDrawer(); // core/file-manager/nav.js
        await this.refreshFolderDetail(folderId);
    },

    /** Vẽ lại tiêu đề + danh sách bài của Folder Detail Drawer đang mở — dùng lúc mở lần đầu VÀ
     * sau khi gỡ 1 bài (danh sách có thể đổi). */
    async refreshFolderDetail(folderId) {
        const folderRecord = await getFolderRecord(folderId); // core có sẵn (core/db.js)
        setFolderDetailTitle(folderRecord ? folderRecord.name : ''); // core/file-manager/folder-detail-ui.js

        const folderMap = await getFolderSongMap(folderId); // core có sẵn (core/db.js)
        const songs = getFolderSongsForDisplay(folderMap, appState.get('playlistCache')); // core/file-manager/folder-detail-ui.js
        renderFolderDetailSongList(songs); // core/file-manager/folder-detail-ui.js
    },

    /** Ứng với 'fileManagerSong.folder.removeSong'. CHỈ gỡ khỏi folder, KHÔNG xoá bài.
     * SỬA 03/07/2026 (đợt 3): KHÔNG còn tự áp dụng ngay vào Playlist đang chạy nữa (bản trước gọi
     * applyFolderScope() live-patch DOM ngay — SAI theo đúng góp ý mới: mọi thay đổi scope chỉ có
     * hiệu lực qua reload, xem event/workflow/playlist-scope.js). Gỡ bài không đổi "folder nào
     * đang active" (identity `activePlayListFolder` không đổi) nên cũng KHÔNG cần persistScopeChoice()
     * — chỉ cần dữ liệu DB đúng, lần tải trang kế tiếp (hoặc lần bấm "Áp dụng" kế tiếp) sẽ tự đọc
     * đúng danh sách mới. */
    async removeSongFromFolderById(folderId, songKey) {
        await removeSongFromFolder(songKey, folderId); // core có sẵn (core/file-manager/folder.js)
        await this.refreshFolderDetail(folderId);
    },

    /** Ứng với 'fileManagerSong.folder.applyToPlaylist.click'. SỬA 03/07/2026 (đợt 3): KHÔNG còn
     * live-apply ngay — chỉ lưu lựa chọn rồi hỏi có muốn tải lại để thấy ngay không (xem
     * event/workflow/playlist-scope.js). */
    async applyFolderToPlaylist(folderId) {
        const folderRecord = await getFolderRecord(folderId); // core có sẵn (core/db.js)
        await workflowPlaylistScope.persistScopeChoice(folderId);
        workflowPlaylistScope.askReloadToApplyNow(tFormat('fileManager.song.folderDetail.applyReloadBody', { name: escapeHtml(folderRecord ? folderRecord.name : '') }));
    },

    /** Ứng với 'fileManagerSong.folder.actionClick' (action='delete'), nhánh folder ĐANG là scope
     * hiện tại (activePlayListFolder). SỬA 03/07/2026 (đợt 3) — ĐƠN GIẢN HOÁ HẲN so với bản trước:
     * KHÔNG còn tự tay dừng audio/revoke object URL/đưa UI về Playlist/đóng 3 tầng drawer nữa —
     * chỉ xoá folder (DB) + lưu scope mới = null + hỏi tải lại. Nếu người dùng chọn "Có", reload
     * tự lo SẠCH toàn bộ phần dọn dẹp đó (trang tải mới hoàn toàn không có audio nào đang chạy,
     * tự về đúng Playlist "Tất cả bài") — không có cách nào sót state nửa vời như cách làm tay cũ. */
    deleteActiveFolderById(folderId) {
        const row = fileManagerFolderList.querySelector(`[data-folder-id="${folderId}"]`);
        const folderName = row ? row.querySelector('span').textContent : '';
        modalChoice(
            tFormat('fileManager.song.deleteActiveFolderConfirm', { name: escapeHtml(folderName) }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteFolder(folderId); // core có sẵn (core/file-manager/folder.js)
                    await workflowPlaylistScope.persistScopeChoice(null); // folder đã mất -> scope mới LUÔN là null
                    workflowPlaylistScope.askReloadToApplyNow(t('fileManager.song.folderDetail.deleteReloadBody'));
                } }
            ],
            { title: t('fileManager.song.deleteFolderTitle') }
        );
    },

    // ===================== Quản lý dung lượng (DỜI từ workflow/settings-misc.js) =====================

    /** Ứng với msg.type = 'fileManagerSong.deleteBroken.click'.
     * @param {{scanResults: Array, onConfirmSend: function}} payload
     */
    askDeleteBroken(payload) {
        const { scanResults, onConfirmSend } = payload;
        modalChoice(
            tFormat('common.storage.deleteBrokenConfirm', { n: scanResults.length }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.storage.deleteBrokenConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.deleteBrokenTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerSong.deleteBroken.confirm'.
     * @param {{scanResults: Array, currentKey: string|null}} payload
     */
    async executeDeleteBroken(payload) {
        const { scanResults, currentKey } = payload;

        await withLoadingShield(t('common.storage.deletingBroken'), async () => {
            await deleteCorruptedSongs(scanResults, currentKey);
            resetScanResultUI();
            renderStorageStats();
        });

        await alertModal(t('common.storage.deleteBrokenDone'));
    },

    /** Ứng với msg.type = 'fileManagerSong.downloadThenClear.click'. */
    askDownloadThenClear(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.storage.downloadThenClearConfirm'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.storage.downloadThenClearConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.downloadThenClearTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerSong.downloadThenClear.confirm'. */
    async executeDownloadThenClear() {
        let result;
        await withLoadingShield(t('common.storage.zippingStart'), async () => {
            result = await downloadAllSongsThenClear((pct) => {
                loadingText.textContent = tFormat('common.storage.zippingProgress', { percent: pct });
            });
        });

        if (result.status === 'noSongs') {
            await alertModal(t('common.storage.noSongsToDownload'));
        } else if (result.status === 'zipError') {
            await alertModal(tFormat('common.storage.zipBuildError', { message: escapeHtml(result.message) }));
        } else {
            await alertModal(t('common.storage.downloadThenClearDone'));
        }
    },

    /** Ứng với msg.type = 'fileManagerSong.clearNoDownload.click'. */
    askClearNoDownload(payload) {
        const { onConfirmSend } = payload;
        modalChoice(
            t('common.storage.clearNoDownloadConfirm'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('common.storage.clearNoDownloadConfirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirmSend }
            ],
            { title: t('common.storage.clearNoDownloadTitle') }
        );
    },

    /** Ứng với msg.type = 'fileManagerSong.clearNoDownload.confirm'. */
    async executeClearNoDownload() {
        await withLoadingShield(t('common.storage.deletingData'), async () => {
            await clearAllSongsNoDownload();
        });
        await alertModal(t('common.storage.clearNoDownloadDone'));
    },

    /** Ứng với msg.type = 'fileManagerSong.scanBroken.click'.
     * @param {{onScanComplete: (results: Array) => void}} payload
     */
    async executeScanBroken(payload) {
        const { onScanComplete } = payload;
        let results;
        await withLoadingShield(t('common.storage.scanning'), async () => {
            results = await scanAllSongsForCorruption((current, total) => {
                loadingText.textContent = tFormat('common.storage.scanningProgress', { n: current, total });
            });
            renderScanResultUI(results);
        });
        if (onScanComplete) onScanComplete(results);
    }
};
