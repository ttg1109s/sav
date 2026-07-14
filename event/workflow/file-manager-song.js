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
        appState.set('pageCurrentFolderSongList', 0); // mở lại panel từ đầu luôn về trang 1
        console.log(`writer: "openPanel", page: "pageCurrentFolderSongList", content: "0"`);
        await this.refreshSongTab();
    },

    // ===================== Folder (mục 4.b1) =====================

    /** Vẽ lại toàn bộ nội dung panel Song: danh sách folder (ĐÃ PHÂN TRANG, 10 folder/trang, xem
     * core/pagination.js) + thống kê dung lượng + reset UI quét lỗi — gọi lúc mở panel. */
    async refreshSongTab() {
        if (!fileManagerSongPanelEl) return; // panel đã đóng — an toàn bỏ qua
        const folders = await listFolders(); // core có sẵn (core/file-manager/folder.js), CÓ return, DÙNG ngay dưới

        // MỚI (14/07/2026, Giang yêu cầu — "10 folder/page, mặc định bật, mode arrow") —
        // computePage() (core/pagination.js) THUẦN, KHÔNG tự appState.get() (Rule 2) — Workflow
        // (đây) tự đọc appState.get('pageCurrentFolderSongList') rồi TRUYỀN vào làm tham số, đúng
        // Rule 2. Field này sống ở appState (KHÔNG phải property riêng của workflow) — tránh mỗi
        // lần refreshSongTab() bị lệch/reset nếu sau này có nơi khác cũng cần biết/đổi trang đang
        // xem (gom state nghiệp vụ về 1 chỗ, đúng tinh thần chính service/state.js đề ra).
        // computePage() tự KẸP pageIndex về khoảng hợp lệ (vd vừa xoá hết folder ở trang cuối) —
        // ghi lại appState nếu bị kẹp, để lần gọi SAU (prev/next) tính đúng từ đây, không lệch.
        const pageResult = computePage(folders, appState.get('pageCurrentFolderSongList'), 10); // core/pagination.js
        if (pageResult.pageIndex !== appState.get('pageCurrentFolderSongList')) {
            appState.set('pageCurrentFolderSongList', pageResult.pageIndex);
            console.log(`writer: "refreshSongTab", page: "pageCurrentFolderSongList", content: "${pageResult.pageIndex}"`);
        }

        // MỚI (14/07/2026, Giang yêu cầu — hiển thị số bài mỗi folder) — CHỈ đếm cho ĐÚNG 10 folder
        // của TRANG ĐANG XEM (không phải toàn bộ folders — tránh N lượt đọc DB thừa cho folder
        // không hiển thị), chạy song song qua Promise.all.
        const pageItemsWithCount = await Promise.all(pageResult.pageItems.map(async (folder) => ({
            ...folder,
            songCount: await getFolderSongCount(folder.id), // core có sẵn (core/file-manager/folder.js)
        })));

        renderFolderListUI(
            pageItemsWithCount, appState.get('activePlayListFolder'),
            fileManagerSongPanelEl.querySelector('#file-manager-folder-list'),
            fileManagerSongPanelEl.querySelector('#file-manager-folder-empty')
        );
        const paginationEl = fileManagerSongPanelEl.querySelector('#file-manager-folder-pagination');
        // MỚI (14/07/2026, Giang chỉnh lại) — mode 'arrow' (‹ trang/tổng ›), MẶC ĐỊNH BẬT — tự trả
        // chuỗi rỗng nếu totalPages <= 1, không cần tự if riêng ở đây.
        if (paginationEl) paginationEl.innerHTML = buildPaginationArrowsHtml(pageResult.pageIndex, pageResult.totalPages); // core/pagination.js

        await renderStorageStats( // core có sẵn (core/storage-manager.js)
            fileManagerSongPanelEl.querySelector('#stat-storage-total-songs'),
            fileManagerSongPanelEl.querySelector('#stat-storage-total-bytes')
        );
        resetScanResultUI( // core có sẵn (core/storage-manager.js)
            fileManagerSongPanelEl.querySelector('#storage-scan-result'),
            fileManagerSongPanelEl.querySelector('#storage-scan-list')
        );
    },

    /** Ứng với 'fileManagerSong.folder.page.prev'/'.next' — MỚI (14/07/2026). `direction` = -1
     * (prev) hoặc +1 (next); refreshSongTab() tự listFolders() lại + computePage() lại từ đầu —
     * đơn giản, nhất quán với cách các thao tác khác trong file này luôn "sửa xong thì refresh lại
     * toàn bộ", không tự vá DOM cục bộ. */
    async changeFolderListPage(direction) {
        const next = appState.get('pageCurrentFolderSongList') + direction;
        appState.set('pageCurrentFolderSongList', next);
        console.log(`writer: "changeFolderListPage", page: "pageCurrentFolderSongList", content: "${next}"`);
        await this.refreshSongTab();
    },

    /** Ứng với 'fileManagerSong.folder.create'. */
    async createFolderFromInput() {
        if (!fileManagerSongPanelEl) return; // guard
        const input = fileManagerSongPanelEl.querySelector('#file-manager-new-folder-input');
        if (!input) return;
        const name = input.value.trim();
        if (!name) return; // guard: chưa nhập tên thì không làm gì

        // SỬA (14/07/2026, tự audit lại Rule 3) — createFolder() đổi chữ ký, không còn tự
        // resolveFolderId() nội bộ (2 core TÁCH RỜI, xem docstring createFolder() —
        // core/file-manager/folder.js) — Workflow (đây) tự gọi CẢ HAI theo đúng thứ tự.
        const folderId = await resolveFolderId(name); // core
        const result = await createFolder(folderId, name); // core có sẵn (core/file-manager/folder.js)
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
        this._promptRenameFolder(folderId, currentName);
    },

    /** MỚI (14/07/2026) — icon Sửa tên trong Folder Detail (layout mới, Giang yêu cầu) — đọc
     * currentName từ CHÍNH tiêu đề đang hiển thị (khác nguồn với renameFolderById() ở trên, vốn
     * đọc từ hàng trong panel Song — 2 ngữ cảnh khác nhau, CÙNG dùng chung _promptRenameFolder()). */
    renameActiveFolderDetail(folderId) {
        if (!fileManagerFolderDetailPanelEl) return;
        const titleEl = fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-title');
        const currentName = titleEl ? titleEl.textContent : '';
        this._promptRenameFolder(folderId, currentName);
    },

    /** DÙNG CHUNG bởi renameFolderById()/renameActiveFolderDetail(), chỉ khác NƠI đọc currentName.
     * SỬA (14/07/2026, tự audit lại Rule 5a) — openRenameFolderModal() không còn nhận callback,
     * CHỈ mở modal — bấm "Lưu" tự bắn eventBus, xem confirmRenameFolder() bên dưới. */
    _promptRenameFolder(folderId, currentName) {
        openRenameFolderModal(currentName, folderId); // core/file-manager/folder-picker-ui.js — tự bắn eventBus khi bấm Lưu
    },

    /** Ứng với 'fileManagerSong.folder.rename.confirm' (bấm "Lưu" trong modal đổi tên, cả 2 nguồn
     * renameFolderById()/renameActiveFolderDetail() đều dẫn tới ĐÂY). Refresh CẢ 2 panel nếu đang
     * mở (chỉ đúng 1 cái thật sự liên quan tại 1 thời điểm, refresh cả 2 vô hại + khỏi cần biết
     * ngữ cảnh nào gọi tới). */
    async confirmRenameFolder(folderId, name) {
        const result = await renameFolder(folderId, name); // core có sẵn
        // MỚI (03/07/2026, đợt 6, điểm 4) — renameFolder() giờ chặn trùng tên (case-sensitive,
        // trừ chính nó) — báo lỗi rõ, KHÔNG refresh (tên chưa hề đổi trong DB).
        if (result.status === 'duplicateName') {
            await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) }));
            return;
        }
        if (fileManagerSongPanelEl) await this.refreshSongTab();
        if (fileManagerFolderDetailPanelEl) await this.refreshFolderDetail(folderId);
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
     * (`#file-manager-folder-detail-title`, xem components/file-manager.js), không phải ở header.
     * SỬA (14/07/2026, đồng bộ Photo & Album) — ĐÚNG trình tự: trượt xong HẲN (chờ THẬT
     * `SLIDER_PANEL_SCROLL_ESTIMATED_MS`, taskManager, Rule 3) -> RỒI MỚI bật shield -> tải DOM
     * danh sách bài -> tắt shield. */
    async openFolderDetail(folderId) {
        fileManagerFolderDetailPanelEl = pushSettingsPanel({ title: t('fileManager.song.folderDetail.headerTitle'), bodyHtml: renderFileManagerFolderDetailPanelBody() });
        // MỚI (14/07/2026, Giang yêu cầu) — mở 1 folder MỚI luôn về trang 1 của danh sách bài bên
        // trong nó (khác folder khác, "trang đang xem" của folder CŨ không còn ý nghĩa gì).
        appState.set('pageCurrentFolderDetailSongList', 0);
        console.log(`writer: "openFolderDetail", page: "pageCurrentFolderDetailSongList", content: "0"`);

        await new Promise((resolve) => taskManager.once(resolve, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'openFolderDetail')); // core/slider-panel-scroll.js — đợi trượt xong HẲN

        await withLoadingShield(t('fileManager.song.folderDetail.loadingTitle'), async () => { // core/loading-shield-util.js
            await this.refreshFolderDetail(folderId);
        });
    },

    /** Vẽ lại tiêu đề + danh sách bài (ĐÃ PHÂN TRANG, ~30 bài/trang, mode 'list') + nút Áp dụng/Bỏ
     * áp dụng của Folder Detail Drawer đang mở — dùng lúc mở lần đầu, sau khi gỡ 1 bài, và sau khi
     * đổi scope (Áp dụng/Bỏ áp dụng).
     * @returns {Promise<Object>} folderMap vừa đọc
     */
    async refreshFolderDetail(folderId) {
        if (!fileManagerFolderDetailPanelEl) return; // guard: panel đã đóng
        const folderRecord = await getFolderRecord(folderId); // core có sẵn (service/db.js)
        setFolderDetailTitle(folderRecord ? folderRecord.name : '', fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-title'));

        const folderMap = await getFolderSongMap(folderId); // core có sẵn (service/db.js)
        const allSongs = getFolderSongsForDisplay(folderMap, appState.get('playlistCache')); // core/file-manager/folder-detail-ui.js

        // MỚI (14/07/2026, Giang yêu cầu — "~30 bài/trang, mode list, nhớ qua appState") —
        // computePage() (core/pagination.js) THUẦN — Workflow tự đọc/ghi appState, không để core tự làm.
        const pageResult = computePage(allSongs, appState.get('pageCurrentFolderDetailSongList'), 30); // core/pagination.js
        if (pageResult.pageIndex !== appState.get('pageCurrentFolderDetailSongList')) {
            appState.set('pageCurrentFolderDetailSongList', pageResult.pageIndex);
            console.log(`writer: "refreshFolderDetail", page: "pageCurrentFolderDetailSongList", content: "${pageResult.pageIndex}"`);
        }

        renderFolderDetailSongList(
            pageResult.pageItems,
            fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-song-list'),
            fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-empty'),
            fileManagerFolderDetailPanelEl.querySelector('#btn-file-manager-folder-detail-remove-all'), // tự ẩn khi rỗng — dùng allSongs.length (xem bên trong hàm, KHÔNG bị ảnh hưởng bởi phân trang)
            fileManagerFolderDetailPanelEl.querySelector('#btn-file-manager-folder-apply-to-playlist'), // MỚI (14/07/2026) — tự ẩn khi rỗng VÀ chưa active
            folderId === appState.get('activePlayListFolder') // isActive
        );
        const paginationEl = fileManagerFolderDetailPanelEl.querySelector('#file-manager-folder-detail-song-pagination');
        // mode 'list' (dãy số trang, không mũi tên) theo đúng yêu cầu Giang.
        if (paginationEl) paginationEl.innerHTML = buildPaginationListHtml(pageResult.pageIndex, pageResult.totalPages); // core/pagination.js

        appState.set('folderDetailSongCount', allSongs.length); // TỔNG số bài THẬT (không phải chỉ trang đang xem) — Block gate 'applyToPlaylist.click' cần biết folder có rỗng HOÀN TOÀN hay không, xem event/block.js
        console.log(`writer: "refreshFolderDetail", page: "folderDetailSongCount", content: "${allSongs.length}"`);

        this._updateApplyButtonMode(folderId);
        return folderMap;
    },

    /** Ứng với 'fileManagerSong.folder.detail.song.page.goto' — mode 'list', bấm THẲNG vào 1 số
     * trang (khác 'arrow' ở danh sách folder, chỉ có prev/next). MỚI (14/07/2026). */
    async goToFolderDetailSongPage(folderId, pageIndex) {
        appState.set('pageCurrentFolderDetailSongList', pageIndex);
        console.log(`writer: "goToFolderDetailSongPage", page: "pageCurrentFolderDetailSongList", content: "${pageIndex}"`);
        await this.refreshFolderDetail(folderId);
    },

    /** DOM-patch thuần (không I/O) — đổi nhãn/màu/`data-mode` nút Áp dụng/Bỏ áp dụng theo đúng
     * folder đang xem có phải activePlayListFolder hay không. Tách riêng vì gọi lại nhiều lần
     * (refreshFolderDetail, applyFolderToPlaylist, unapplyFolderFromPlaylist).
     * SỬA (14/07/2026, Giang yêu cầu — bỏ icon ở header, đưa lại thành nút CHỮ đứng CẠNH "Xoá hết
     * bài" ở cuối panel) — quay lại đổi `textContent` + set/bỏ class viền/nền/chữ theo cặp
     * sky (chưa áp dụng) / rose (đã áp dụng), khớp đúng style pill của nút "Xoá hết bài" bên cạnh. */
    _updateApplyButtonMode(folderId) {
        if (!fileManagerFolderDetailPanelEl) return; // guard
        const btn = fileManagerFolderDetailPanelEl.querySelector('#btn-file-manager-folder-apply-to-playlist');
        if (!btn) return;
        const isActive = folderId === appState.get('activePlayListFolder');
        btn.textContent = isActive
            ? t('fileManager.song.folderDetail.btnUnapply')
            : t('fileManager.song.folderDetail.btnApply');
        btn.dataset.mode = isActive ? 'unapply' : 'apply';
        btn.classList.toggle('bg-sky-500/10', !isActive);
        btn.classList.toggle('hover:bg-sky-500/20', !isActive);
        btn.classList.toggle('border-sky-400/30', !isActive);
        btn.classList.toggle('text-sky-300', !isActive);
        btn.classList.toggle('bg-rose-600/10', isActive);
        btn.classList.toggle('hover:bg-rose-600/20', isActive);
        btn.classList.toggle('border-rose-500/30', isActive);
        btn.classList.toggle('text-rose-400', isActive);
    },

    /** Ứng với 'fileManagerSong.folder.removeSong'. CHỈ gỡ khỏi folder, KHÔNG xoá bài.
     * MỚI (03/07/2026, đợt 4 — điểm 3): nếu gỡ xong folder RỖNG HOÀN TOÀN (isFolderEmpty()) VÀ
     * folder này ĐANG là scope hiện tại -> TỰ ĐỘNG bỏ áp dụng (persistScopeChoice(null)).
     * MỚI (14/07/2026, Giang yêu cầu — "xoá song xong back không render lại") — đánh dấu
     * `staleFolderListRowId` để danh sách folder (đang BỊ CHE phía sau, không vẽ lại ngay) tự vá
     * đúng hàng khi Back, xem `refreshStaleFolderRowIfNeeded()` cuối file. */
    async removeSongFromFolderById(folderId, songKey) {
        await removeSongFromFolder(songKey, folderId); // core có sẵn (core/file-manager/folder.js)
        const folderMap = await this.refreshFolderDetail(folderId); // CÓ return, DÙNG ngay dưới
        this._markFolderListRowStale(folderId);

        if (isFolderEmpty(folderMap) && folderId === appState.get('activePlayListFolder')) {
            await workflowPlaylistScope.persistScopeChoice(null);
            await this.refreshFolderDetail(folderId); // vẽ lại nút (giờ về "Áp dụng", không còn "Bỏ áp dụng")
            workflowPlaylistScope.askReloadToApplyNow(t('fileManager.song.folderDetail.autoUnapplyReloadBody'));
        }
    },

    /** Ứng với 'fileManagerSong.folder.removeAllSongs.click'. MỚI (14/07/2026, Giang yêu cầu) —
     * "Xoá hết bài" — CHỈ dọn rỗng folder (removeAllSongsFromFolder(), core/file-manager/folder.js),
     * KHÔNG xoá folder (khác hẳn "Xoá folder" ở panel Song, deleteActiveFolderById()). Cùng logic
     * tự-bỏ-áp-dụng-nếu-rỗng với removeSongFromFolderById() phía trên (folder rỗng hoàn toàn +
     * đang là scope hiện tại -> tự persistScopeChoice(null)). */
    removeAllSongsFromActiveFolder(folderId) {
        if (!fileManagerFolderDetailPanelEl) return;
        modalChoice(
            t('fileManager.song.folderDetail.removeAllConfirm'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.song.folderDetail.btnRemoveAll'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await removeAllSongsFromFolder(folderId); // core có sẵn (core/file-manager/folder.js)
                    const folderMap = await this.refreshFolderDetail(folderId); // CÓ return, DÙNG ngay dưới
                    this._markFolderListRowStale(folderId);

                    if (isFolderEmpty(folderMap) && folderId === appState.get('activePlayListFolder')) {
                        await workflowPlaylistScope.persistScopeChoice(null);
                        await this.refreshFolderDetail(folderId); // vẽ lại icon (giờ về "Áp dụng", không còn "Bỏ áp dụng")
                        workflowPlaylistScope.askReloadToApplyNow(t('fileManager.song.folderDetail.autoUnapplyReloadBody'));
                    }
                } }
            ],
            { title: t('fileManager.song.folderDetail.removeAllTitle') }
        );
    },

    /** Ứng với 'fileManagerSong.folder.applyToPlaylist.click'. */
    async applyFolderToPlaylist(folderId) {
        const folderRecord = await getFolderRecord(folderId); // core có sẵn (service/db.js)
        await workflowPlaylistScope.persistScopeChoice(folderId);
        this._updateApplyButtonMode(folderId); // đổi nút sang "Bỏ áp dụng" ngay, không đợi reload
        this._markFolderListRowStale(folderId); // MỚI (14/07/2026) — danh sách folder cần vá lại dấu chấm active
        workflowPlaylistScope.askReloadToApplyNow(tFormat('fileManager.song.folderDetail.applyReloadBody', { name: escapeHtml(folderRecord ? folderRecord.name : '') }));
    },

    /** Ứng với 'fileManagerSong.folder.unapplyFromPlaylist.click'. */
    async unapplyFolderFromPlaylist(folderId) {
        await workflowPlaylistScope.persistScopeChoice(null);
        this._updateApplyButtonMode(folderId); // đổi nút về "Áp dụng" ngay
        this._markFolderListRowStale(folderId); // MỚI (14/07/2026) — danh sách folder cần vá lại dấu chấm active
        workflowPlaylistScope.askReloadToApplyNow(t('fileManager.song.folderDetail.unapplyReloadBody'));
    },

    /** MỚI (14/07/2026, Giang yêu cầu) — đánh dấu 1 folder VỪA đổi (xoá bài/remove-all/apply/
     * unapply) trong lúc danh sách folder (panel Song) ĐANG BỊ CHE phía sau (Folder Detail đang
     * mở đè lên) — KHÔNG vẽ lại ngay (tốn kém + panel Song không hiển thị lúc này), chỉ ghi nhớ
     * qua appState, đợi tới lúc Back mới thật sự vá (xem refreshStaleFolderRowIfNeeded()). */
    _markFolderListRowStale(folderId) {
        appState.set('staleFolderListRowId', folderId);
        console.log(`writer: "_markFolderListRowStale", page: "staleFolderListRowId", content: "${folderId}"`);
    },

    /** Gọi từ `workflowSettingsStackNav.back()` (domain KHÁC — Workflow gọi Workflow tự do, không
     * bị Rule 3) SAU MỖI lần Back, BẤT KỂ đang lùi từ panel nào — tự no-op ngay nếu không có gì
     * stale. Nếu có, vá lại ĐÚNG 1 hàng đó trong danh sách folder (KHÔNG render lại toàn bộ — danh
     * sách có thể đang ở TRANG KHÁC lúc này, `querySelector` không thấy hàng đó thì bỏ qua, KHÔNG
     * coi là lỗi). LUÔN đặt lại `staleFolderListRowId = null` NGAY sau khi xử lý (dù vá được hay
     * không) — tránh lặp lại việc kiểm tra vô ích ở lần Back kế tiếp. */
    async refreshStaleFolderRowIfNeeded() {
        const staleFolderId = appState.get('staleFolderListRowId');
        if (!staleFolderId) return; // không có gì cần vá -> bỏ qua ngay, không đụng gì tới panel Song
        appState.set('staleFolderListRowId', null);
        console.log(`writer: "refreshStaleFolderRowIfNeeded", page: "staleFolderListRowId", content: "null"`);

        if (!fileManagerSongPanelEl) return; // panel Song đã đóng hẳn (không chỉ bị che) -> không có gì để vá
        const rowEl = fileManagerSongPanelEl.querySelector(`[data-folder-id="${staleFolderId}"]`);
        if (!rowEl) return; // folder đó không nằm trên TRANG đang xem hiện tại (đã lật trang khác, hoặc folder đã bị xoá) -> bỏ qua, không cần vá

        const songCount = await getFolderSongCount(staleFolderId); // core có sẵn (core/file-manager/folder.js)
        updateFolderListRowUI(rowEl, songCount, staleFolderId === appState.get('activePlayListFolder')); // core/file-manager/folder-list-ui.js
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
