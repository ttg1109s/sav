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
 *
 * === Batch D5 (Settings restructure, 06/07/2026) ===
 * Song + Folder Detail giờ 2 CẤP push/pop động TRONG CÙNG 1 ngăn xếp (core/settings-panel-
 * stack.js hỗ trợ sẵn độ sâu tuỳ ý) — Song ở cấp 1, Folder Detail ở cấp 2 (mở đè lên Song, Back 1
 * lần chỉ lùi về Song, KHÔNG đóng cả 2). 2 biến module bên dưới lưu panel đang mở của MỖI cấp
 * (giống pattern đã dùng ở Slideshow, event/workflow/slideshow.js::slideshowSettingsPanelEl) —
 * KHÔNG chủ động null-hoá lúc đóng (Back dùng CHUNG, không biết gì về File Manager) — vô hại vì
 * không listener nào bắn sự kiện tới khi panel đã đóng (delegation chỉ khớp khi phần tử thật sự
 * hiển thị). `renderFolderListUI`/`renderFolderDetailSongList`/`setFolderDetailTitle`/
 * `renderStorageStats`/`resetScanResultUI`/`renderScanResultUI` (core) ĐÃ đổi sang nhận phần tử
 * qua tham số — mọi method dưới đây tự `querySelector` bên trong panel tương ứng rồi truyền vào.
 *
 * `fileManagerSong.close`/`fileManagerSong.folder.closeDetail` (router) ĐÃ XOÁ — đóng dùng CHUNG
 * 'settingsStackNav.back.click' cho MỌI panel/cấp.
 */
let fileManagerSongPanelEl = null; // panel Song đang mở — null nếu đang đóng (Batch D5)
let fileManagerFolderDetailPanelEl = null; // panel Folder Detail đang mở (cấp 2, lồng trong Song)

const workflowFileManagerSong = {

    // ===================== Mở/đóng drawer (CHỐT 03/07/2026, mục 1a/7 — Song giờ là drawer con
    // độc lập mở thẳng từ Settings, không còn màn "File Manager" cha điều phối nữa) ============

    /** Ứng với 'fileManagerSong.openPanel.click'. Push panel Song (cấp 1). */
    async openPanel() {
        fileManagerSongPanelEl = pushSettingsPanel({ title: t('fileManager.song.title'), bodyHtml: renderFileManagerSongPanelBody() });
        await this.refreshSongTab();
    },

    // ===================== Folder (mục 4.b1) =====================

    /** Vẽ lại toàn bộ nội dung panel Song: danh sách folder + thống kê dung lượng + reset UI quét
     * lỗi — gọi lúc mở panel. */
    async refreshSongTab() {
        if (!fileManagerSongPanelEl) return; // panel đã đóng — an toàn bỏ qua
        const folders = await listFolders(); // core có sẵn (core/file-manager/folder.js), CÓ return, DÙNG ngay dưới
        renderFolderListUI(
            folders, appState.get('activePlayListFolder'),
            fileManagerSongPanelEl.querySelector('#file-manager-folder-list'),
            fileManagerSongPanelEl.querySelector('#file-manager-folder-empty')
        );
        await renderStorageStats( // core có sẵn (core/storage-manager.js)
            fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
            fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes')
        );
        resetScanResultUI( // core có sẵn (core/storage-manager.js)
            fileManagerSongPanelEl.querySelector('#storage-scan-result'),
            fileManagerSongPanelEl.querySelector('#storage-scan-list')
        );
    },

    /** Ứng với 'fileManagerSong.folder.create'. */
    async createFolderFromInput() {
        if (!fileManagerSongPanelEl) return; // guard
        const input = fileManagerSongPanelEl.querySelector('#file-manager-new-folder-input');
        if (!input) return;
        const name = input.value.trim();
        if (!name) return; // guard: chưa nhập tên thì không làm gì

        const result = await createFolder(name); // core có sẵn (core/file-manager/folder.js)
        // MỚI (03/07/2026, đợt 6, điểm 4) — createFolder() giờ chặn trùng tên (case-sensitive) —
        // báo lỗi rõ, GIỮ NGUYÊN nội dung input để người dùng sửa lại, KHÔNG clear/refresh (khác
        // hẳn nhánh thành công bên dưới).
        if (result.status === 'duplicateName') {
            await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) }));
            return;
        }
        input.value = '';
        await this.refreshSongTab();
    },

    /** Ứng với 'fileManagerSong.folder.actionClick' (action='rename'). Đọc tên hiện tại THẲNG từ
     * DOM đã render sẵn (tránh round-trip đọc lại DB chỉ để lấy tên đang hiển thị). */
    renameFolderById(folderId) {
        if (!fileManagerSongPanelEl) return;
        const list = fileManagerSongPanelEl.querySelector('#file-manager-folder-list');
        const row = list ? list.querySelector(`[data-folder-id="${folderId}"]`) : null;
        const currentName = row ? row.querySelector('[data-role="name"]').textContent : '';
        openRenameFolderModal(currentName, async (newName) => {
            const result = await renameFolder(folderId, newName); // core có sẵn
            // MỚI (03/07/2026, đợt 6, điểm 4) — renameFolder() giờ chặn trùng tên (case-sensitive,
            // trừ chính nó) — báo lỗi rõ, KHÔNG refresh (tên chưa hề đổi trong DB).
            if (result.status === 'duplicateName') {
                await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(newName) }));
                return;
            }
            await this.refreshSongTab();
        });
    },

    /** Ứng với 'fileManagerSong.folder.actionClick' (action='delete'). */
    deleteFolderById(folderId) {
        if (!fileManagerSongPanelEl) return;
        const list = fileManagerSongPanelEl.querySelector('#file-manager-folder-list');
        const row = list ? list.querySelector(`[data-folder-id="${folderId}"]`) : null;
        const folderName = row ? row.querySelector('[data-role="name"]').textContent : '';
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

    /** Ứng với 'fileManagerSong.folder.openDetail'. Push panel Folder Detail (cấp 2, đè lên Song).
     * Header dùng CHUNG chỉ nhận title CỐ ĐỊNH lúc push (không tự cập nhật lại được sau) — tên
     * folder THẬT (chỉ biết sau khi đọc DB xong) hiển thị bằng 1 heading NGAY TRONG BODY panel
     * (`#file-manager-folder-detail-title`, xem components/file-manager.js), không phải ở header. */
    async openFolderDetail(folderId) {
        fileManagerFolderDetailPanelEl = pushSettingsPanel({ title: t('fileManager.song.folderDetail.headerTitle'), bodyHtml: renderFileManagerFolderDetailPanelBody() });
        await this.refreshFolderDetail(folderId);
    },

    /** Vẽ lại tiêu đề + danh sách bài + nút Áp dụng/Bỏ áp dụng của Folder Detail Drawer đang mở —
     * dùng lúc mở lần đầu, sau khi gỡ 1 bài, và sau khi đổi scope (Áp dụng/Bỏ áp dụng).
     * @returns {Promise<Object>} folderMap vừa đọc
     */
    async refreshFolderDetail(folderId) {
        if (!fileManagerFolderDetailPanelEl) return; // guard: panel đã đóng
        const folderRecord = await getFolderRecord(folderId); // core có sẵn (service/db.js)
        setFolderDetailTitle(folderRecord ? folderRecord.name : '', fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-title'));

        const folderMap = await getFolderSongMap(folderId); // core có sẵn (service/db.js)
        const songs = getFolderSongsForDisplay(folderMap, appState.get('playlistCache')); // core/file-manager/folder-detail-ui.js
        renderFolderDetailSongList(
            songs,
            fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-song-list'),
            fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-empty')
        );

        appState.set('folderDetailSongCount', songs.length);
        console.log(`writer: "refreshFolderDetail", page: "folderDetailSongCount", content: "${songs.length}"`);

        this._updateApplyButtonMode(folderId);
        return folderMap;
    },

    /** DOM-patch thuần (không I/O) — đổi nhãn/màu/`data-mode` nút Áp dụng/Bỏ áp dụng theo đúng
     * folder đang xem có phải activePlayListFolder hay không. Tách riêng vì gọi lại nhiều lần
     * (refreshFolderDetail, applyFolderToPlaylist, unapplyFolderFromPlaylist). */
    _updateApplyButtonMode(folderId) {
        if (!fileManagerFolderDetailPanelEl) return; // guard
        const btn = fileManagerFolderDetailPanelEl.querySelector('#btn-file-manager-folder-apply-to-playlist');
        if (!btn) return;
        const isActive = folderId === appState.get('activePlayListFolder');
        btn.textContent = isActive
            ? t('fileManager.song.folderDetail.btnUnapply')
            : t('fileManager.song.folderDetail.btnApply');
        btn.dataset.mode = isActive ? 'unapply' : 'apply';
        btn.classList.toggle('bg-sky-500', !isActive);
        btn.classList.toggle('hover:bg-sky-400', !isActive);
        btn.classList.toggle('bg-rose-600', isActive);
        btn.classList.toggle('hover:bg-rose-500', isActive);
    },

    /** Ứng với 'fileManagerSong.folder.removeSong'. CHỈ gỡ khỏi folder, KHÔNG xoá bài.
     * MỚI (03/07/2026, đợt 4 — điểm 3): nếu gỡ xong folder RỖNG HOÀN TOÀN (isFolderEmpty()) VÀ
     * folder này ĐANG là scope hiện tại -> TỰ ĐỘNG bỏ áp dụng (persistScopeChoice(null)). */
    async removeSongFromFolderById(folderId, songKey) {
        await removeSongFromFolder(songKey, folderId); // core có sẵn (core/file-manager/folder.js)
        const folderMap = await this.refreshFolderDetail(folderId); // CÓ return, DÙNG ngay dưới

        if (isFolderEmpty(folderMap) && folderId === appState.get('activePlayListFolder')) {
            await workflowPlaylistScope.persistScopeChoice(null);
            await this.refreshFolderDetail(folderId); // vẽ lại nút (giờ về "Áp dụng", không còn "Bỏ áp dụng")
            workflowPlaylistScope.askReloadToApplyNow(t('fileManager.song.folderDetail.autoUnapplyReloadBody'));
        }
    },

    /** Ứng với 'fileManagerSong.folder.applyToPlaylist.click'. */
    async applyFolderToPlaylist(folderId) {
        const folderRecord = await getFolderRecord(folderId); // core có sẵn (service/db.js)
        await workflowPlaylistScope.persistScopeChoice(folderId);
        this._updateApplyButtonMode(folderId); // đổi nút sang "Bỏ áp dụng" ngay, không đợi reload
        workflowPlaylistScope.askReloadToApplyNow(tFormat('fileManager.song.folderDetail.applyReloadBody', { name: escapeHtml(folderRecord ? folderRecord.name : '') }));
    },

    /** Ứng với 'fileManagerSong.folder.unapplyFromPlaylist.click'. */
    async unapplyFolderFromPlaylist(folderId) {
        await workflowPlaylistScope.persistScopeChoice(null);
        this._updateApplyButtonMode(folderId); // đổi nút về "Áp dụng" ngay
        workflowPlaylistScope.askReloadToApplyNow(t('fileManager.song.folderDetail.unapplyReloadBody'));
    },

    /** Ứng với 'fileManagerSong.folder.actionClick' (action='delete'), nhánh folder ĐANG là scope
     * hiện tại (activePlayListFolder). */
    deleteActiveFolderById(folderId) {
        if (!fileManagerSongPanelEl) return;
        const list = fileManagerSongPanelEl.querySelector('#file-manager-folder-list');
        const row = list ? list.querySelector(`[data-folder-id="${folderId}"]`) : null;
        const folderName = row ? row.querySelector('[data-role="name"]').textContent : '';
        modalChoice(
            tFormat('fileManager.song.deleteActiveFolderConfirm', { name: escapeHtml(folderName) }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteFolder(folderId); // core có sẵn (core/file-manager/folder.js)
                    await workflowPlaylistScope.persistScopeChoice(null); // folder đã mất -> scope mới LUÔN là null
                    await this.refreshSongTab();
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
            if (fileManagerSongPanelEl) {
                resetScanResultUI(
                    fileManagerSongPanelEl.querySelector('#storage-scan-result'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-list')
                );
                await renderStorageStats(
                    fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
                    fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes')
                );
            }
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

        // MỚI (03/07/2026, đợt 5, điểm 3) — xoá sạch thư viện thì MỌI folder cũng phải rỗng theo
        // + bỏ scope nếu đang áp dụng 1 folder (không còn ý nghĩa gì để giữ).
        await clearAllFolderSongData(); // core/file-manager/folder.js
        if (appState.get('activePlayListFolder')) {
            await workflowPlaylistScope.persistScopeChoice(null);
        }
        await this.refreshSongTab(); // vẽ lại danh sách folder (rỗng hết, hết badge active) nếu Song panel đang mở

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

        await clearAllFolderSongData(); // core/file-manager/folder.js
        if (appState.get('activePlayListFolder')) {
            await workflowPlaylistScope.persistScopeChoice(null);
        }
        await this.refreshSongTab();

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
            if (fileManagerSongPanelEl) {
                renderScanResultUI(
                    results,
                    fileManagerSongPanelEl.querySelector('#storage-scan-result'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-summary'),
                    fileManagerSongPanelEl.querySelector('#storage-scan-list'),
                    fileManagerSongPanelEl.querySelector('#btn-storage-delete-broken')
                );
            }
        });
        if (onScanComplete) onScanComplete(results);
    },

    /** Ứng với msg.type = 'fileManagerSong.dismissScan.click'. */
    dismissScan() {
        if (!fileManagerSongPanelEl) return;
        resetScanResultUI(
            fileManagerSongPanelEl.querySelector('#storage-scan-result'),
            fileManagerSongPanelEl.querySelector('#storage-scan-list')
        );
    }
};
