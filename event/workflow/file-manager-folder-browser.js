/**
 * event/workflow/file-manager-folder-browser.js — Folder Browser (Generic Drawer), router "fileManagerFolderBrowser".
 *
 * 2 màn trong cùng 1 phiên Drawer:
 *   - List: grid folder ĐÚNG loại `activeMediaSource` (+ ô "Tạo mới", phân trang 'folderBrowser').
 *       Tap tile = áp Scope ngay rồi đóng; giữ tay = dropdown Đổi tên (ẩn nếu Read-only) / Xoá (ẩn nếu
 *       đang active) / Cài đặt filter / Thuộc tính (luôn cuối).
 *       Thuộc tính = modalChoice: Contains/Size + 3 checkbox Read-only/Hidden/Áp dụng filter (áp ngay) + Tải xuống zip.
 *   - Filter Edit: bộ rule riêng của folder, draft RAM, chỉ ghi DB khi bấm "Áp dụng".
 *
 * Wiring DOM ở core/file-manager/folder-picker-ui.js (wireFolderPickerDrawerEvents/wireFolderPropertiesModalUi/
 * wireFolderFilterEditUi) + core/dropdown-menu.js; field rule của Filter Edit đi qua delegate chung
 * `handlePlaylistFilterPanelEvent()` (event/listener/playlist.js, `data-filter-owner="folder"`) và sửa qua
 * workflowFilterRuleEdit (dùng chung với màn Edit preset). Rẽ nhánh = guard + object map (readme/event-bus-flow.md §7).
 *
 * NẠP SAU: core/file-manager/folder.js, core/file-manager/folder-picker-ui.js, components/items.js, core/dropdown-menu.js,
 * core/modal-choice-ui.js, core/storage-manager.js, core/about-stats.js (formatBytes), components/playlist-filter-drawer.js
 * (buildFolderFilterEditBodyHtml), service/state/playlist.js (clonePlaylistFilterConfigDefaults), core/pagination-ui.js,
 * core/dom-refs.js, service/z-index.js, event/workflow/filter-rule-edit.js, event/workflow/generic-drawer-helpers.js,
 * event/workflow/pagination.js, event/workflow/playlist-scope.js, event/workflow/file-manager-storage.js.
 */

const FOLDER_ICON_RENAME = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
const FOLDER_ICON_DELETE = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
const FOLDER_ICON_PROPERTIES = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>';
const FOLDER_ICON_FILTER = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>';

// Hậu tố key lang theo loại folder (vd 'fileManager.song.deleteFolderConfirm' + 'Video').
const FOLDER_TEXT_SUFFIX_BY_TYPE = { song: '', video: 'Video', photo: 'Photo' };
const FOLDER_COUNT_LABEL_KEY_BY_TYPE = {
    song: 'fileManager.folderBrowser.tileMenu.countSongs',
    video: 'fileManager.folderBrowser.tileMenu.countVideos',
    photo: 'fileManager.folderBrowser.tileMenu.countPhotos',
};
const FOLDER_RECORD_GETTER_BY_TYPE = { // service/db.js
    song: (key) => getSongRecord(key),
    video: (key) => getVideoRecord(key),
    photo: (key) => getImageRecord(key),
};
const FOLDER_ZIP_BUILDER_BY_TYPE = { // core/storage-manager.js
    song: (...args) => buildAllSongsZipBlob(...args),
    video: (...args) => buildAllVideosZipBlob(...args),
    photo: (...args) => buildAllPhotosZipBlob(...args),
};
const FOLDER_DRAWER_MOUNT_BY_FIRST_OPEN = { // event/workflow/generic-drawer-helpers.js
    true: (config) => workflowGenericDrawerHelpers.open(config),
    false: (config) => workflowGenericDrawerHelpers.update(config),
};

const FOLDER_FILTER_DRAFT_BY_HAS_CONFIG = {
    true: (folderRecord) => JSON.parse(JSON.stringify(folderRecord.filterConfig)), // deep clone — không mutate record gốc
    false: (folderRecord, mediaType) => clonePlaylistFilterConfigDefaults()[mediaType], // service/state/playlist.js
};

const workflowFileManagerFolderBrowser = {
    _folders: [],             // cache RAM danh sách folder của List
    _editingFolderId: null,   // tile đang ở chế độ sửa tên (vừa tạo)
    _listPageIndex: 0,        // trang đang xem của List (core tự kẹp)
    _filterEditFolderId: null, // 3 field của màn Filter Edit — null = không ở màn đó
    _filterEditMediaType: null,
    _filterEditDraft: null,

    // ============================== List ==============================

    /** Mở từ tab Folder (event/workflow/app-panel-nav.js::openFolder()) — nạp lại folder ĐÚNG loại Nguồn đang active, về trang 1. */
    async openList() {
        this._folders = await listFolders(appState.get('activeMediaSource')); // core/file-manager/folder.js
        this._editingFolderId = null;
        this._listPageIndex = 0;
        this._renderList(true);
    },

    /** @param {boolean} isFirstOpen - true: mở Drawer; false: thay nội dung Drawer đang mở. */
    _renderList(isFirstOpen) {
        const view = workflowPagination.computePlaceView('folderBrowser', this._folders, this._listPageIndex); // event/workflow/pagination.js
        this._listPageIndex = view.pageIndex;
        const itemsHtml = renderItemList(null, view.pageItems, itemTemplateFolderTile, { editingFolderId: this._editingFolderId }); // components/items.js
        const bodyHtml = buildFolderGridWrapperHtml(`${itemsHtml}${buildAddFolderTileHtml()}`) + `<div id="folder-browser-pagination" class="px-3 pb-3">${workflowPagination.buildControlsHtml(view)}</div>`; // components/items.js
        FOLDER_DRAWER_MOUNT_BY_FIRST_OPEN[isFirstOpen]({
            scrollKey: 'folderBrowser:list',
            height: 'auto',
            maxHeight: '60vh',
            headerHtml: this._buildListHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        });
        wireFolderPickerDrawerEvents('fileManagerFolderBrowser', 'fileManagerFolderBrowser.list'); // core/file-manager/folder-picker-ui.js
        wirePaginationControls(genericDrawerBody.querySelector('#folder-browser-pagination'), 'fileManagerFolderBrowser', 'fileManagerFolderBrowser.list.page.change'); // core/pagination-ui.js
    },

    /** 'fileManagerFolderBrowser.list.page.change'. @param {number} pageIndex */
    setListPage(pageIndex) {
        this._listPageIndex = pageIndex;
        this._renderList(false);
        genericDrawerBody.scrollTop = 0;
    },

    _buildListHeaderHtml() {
        return `
            <div class="flex justify-between items-center px-5 pb-3" data-uitk="headerBorder">
                <h3 class="text-base font-bold" data-uitk="headerTitle">${t('fileManager.folderBrowser.listTitle')}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    /** 'fileManagerFolderBrowser.list.addTile.click' — tạo ngay folder tên tự động (type = Nguồn đang active),
     * nhảy tới trang chứa nó và mở ô sửa tên. */
    async createFolderInBrowser() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = computeNextFolderName(this._folders); // core/file-manager/folder.js
        const folderId = await resolveFolderId(defaultName, mediaType); // core/file-manager/folder.js
        const result = await createFolder(folderId, defaultName, mediaType); // core/file-manager/folder.js
        if (result.status !== 'ok') return; // guard: trùng tên do race — người dùng bấm lại
        this._folders.push({ id: folderId, name: defaultName, type: mediaType });
        this._editingFolderId = folderId;
        this._listPageIndex = workflowPagination.pageIndexOfItem('folderBrowser', this._folders.length - 1);
        this._renderList(false);
    },

    /** 'fileManagerFolderBrowser.list.rename.commit' — blur/Enter ô sửa tên; tên rỗng/trùng giữ tên cũ. */
    async commitListRename(folderId, rawName) {
        this._editingFolderId = null;
        await this._renameFolder(folderId, rawName.trim());
        this._renderList(false);
    },

    /** 'fileManagerFolderBrowser.list.close.click'. */
    closeBrowser() {
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** 'fileManagerFolderBrowser.list.tile.click' — áp Scope folder này ngay rồi đóng Drawer. @param {string} folderId */
    async applyFolderFromTile(folderId) {
        const mediaType = appState.get('activeMediaSource');
        await withLoadingShield(t('common.loading.generic'), async () => { // core/loading-shield-util.js
            await workflowPlaylistScope.persistScopeChoice(folderId, mediaType);
            await workflowPlaylistScope.applyFolderScope(folderId, mediaType);
        });
        this.closeBrowser();
    },

    // ============================== Long-press — dropdown ==============================

    /** 'fileManagerFolderBrowser.list.tile.longpress' — mỗi mục chỉ bắn eventBus.
     * @param {string} folderId @param {HTMLElement} anchorEl - tile vừa giữ tay. */
    async openTileActionsMenu(folderId, anchorEl) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard: folder vừa bị xoá ở nơi khác
        const mediaType = folderRecord.type || 'song';
        const isActiveFolder = folderId === appState.get('activePlayListFolder')[mediaType];
        const send = (action) => () => eventBus.send({ router: 'fileManagerFolderBrowser', type: `fileManagerFolderBrowser.tileMenu.${action}.click`, payload: { folderId } });
        const items = [
            { visible: !folderRecord.isReadOnly, icon: FOLDER_ICON_RENAME, name: t('fileManager.song.folderDetail.renameTitle'), callback: send('rename') },
            { visible: !isActiveFolder, icon: FOLDER_ICON_DELETE, name: t('fileManager.song.btnDeleteFolder'), destructive: true, callback: send('delete') },
            { visible: true, icon: FOLDER_ICON_FILTER, name: t('fileManager.folderBrowser.tileMenu.filterSettings'), callback: send('filter') },
            { visible: true, icon: FOLDER_ICON_PROPERTIES, name: t('fileManager.folderBrowser.tileMenu.properties'), callback: send('properties') }, // luôn cuối
        ].filter((item) => item.visible);
        openDropdownMenu(anchorEl, items, { zIndex: Z_INDEX.FOLDER_TILE_ACTION_MENU }); // core/dropdown-menu.js
    },

    /** 'fileManagerFolderBrowser.tileMenu.rename.click' — modal đổi tên (Lưu -> 'rename.confirm'). */
    async renameFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard: folder vừa bị xoá
        openRenameFolderModal(folderRecord.name, folderId); // core/file-manager/folder-picker-ui.js
    },

    /** 'fileManagerFolderBrowser.rename.confirm' — trùng tên thì báo; đổi được thì vẽ lại List. */
    async confirmRenameFolder(folderId, name) {
        const status = await this._renameFolder(folderId, name);
        await this._alertDuplicateFolderName(status, name);
        this._renderListAfterRename(status, folderId);
    },

    /** Đổi tên (DB + cache RAM). Tên rỗng -> bỏ qua. @returns {Promise<string>} status */
    async _renameFolder(folderId, name) {
        if (!name) return 'empty';
        const result = await renameFolder(folderId, name); // core/file-manager/folder.js
        this._setCachedFolderName(result.status, folderId, name);
        return result.status;
    },

    _setCachedFolderName(status, folderId, name) {
        if (status !== 'ok') return;
        const folder = this._folders.find((f) => f.id === folderId);
        if (!folder) return;
        folder.name = name;
    },

    async _alertDuplicateFolderName(status, name) {
        if (status !== 'duplicateName') return;
        await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) })); // core/modal-choice-ui.js
    },

    _renderListAfterRename(status, folderId) {
        if (status !== 'ok') return;
        if (!this._folders.some((f) => f.id === folderId)) return;
        this._renderList(false);
    },

    /** 'fileManagerFolderBrowser.tileMenu.delete.click' — xác nhận rồi xoá (mục Xoá chỉ hiện khi folder không active). */
    async deleteFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard: folder vừa bị xoá
        const folderType = folderRecord.type || 'song';
        modalChoice( // core/modal-choice-ui.js
            tFormat(`fileManager.song.deleteFolderConfirm${FOLDER_TEXT_SUFFIX_BY_TYPE[folderType]}`, { name: escapeHtml(folderRecord.name) }),
            [
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: async () => {
                    await deleteFolder(folderId, folderType); // core/file-manager/folder.js
                    await this.openList();
                } }
            ],
            { title: t('fileManager.song.deleteFolderTitle') }
        );
    },

    // ============================== Thuộc tính ==============================

    /** 'fileManagerFolderBrowser.tileMenu.properties.click'. */
    async propertiesFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard: folder vừa bị xoá
        await this._showFolderProperties(folderId, folderRecord);
    },

    /** Modal Thuộc tính kiểu Windows: Contains/Size + 3 checkbox (áp ngay khi tick, qua Router) + nút Tải xuống (ẩn nếu rỗng). */
    async _showFolderProperties(folderId, folderRecord) {
        const mediaType = folderRecord.type || 'song';
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        const keys = getFolderSongKeys(folderMap); // core/file-manager/folder.js
        const records = await Promise.all(keys.map((key) => FOLDER_RECORD_GETTER_BY_TYPE[mediaType](key)));
        const totalBytes = records.reduce((sum, record) => sum + (record && record.blob ? record.blob.size : 0), 0);
        const countLabel = tFormat(FOLDER_COUNT_LABEL_KEY_BY_TYPE[mediaType], { count: String(keys.length) });
        const bodyHtml = `
            <div class="space-y-3">
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <span data-uitk="textSecondary">${t('fileManager.folderBrowser.tileMenu.propertiesContains')}</span><span class="font-medium" data-uitk="textPrimary">${escapeHtml(countLabel)}</span>
                    <span data-uitk="textSecondary">${t('fileManager.folderBrowser.tileMenu.propertiesSize')}</span><span class="font-medium" data-uitk="textPrimary">${formatBytes(totalBytes)}</span>
                </div>
                <div class="border-t pt-3 space-y-2.5" data-uitk="dividerBorder">
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                        <input type="checkbox" id="folder-properties-readonly-checkbox" class="w-4 h-4 rounded" data-uitk="accentControl"${folderRecord.isReadOnly ? ' checked' : ''}>
                        ${t('fileManager.folderBrowser.tileMenu.readOnlyLabel')}
                    </label>
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                        <input type="checkbox" id="folder-properties-hidden-checkbox" class="w-4 h-4 rounded" data-uitk="accentControl"${folderRecord.excludeFromMainPlaylist ? ' checked' : ''}>
                        ${t('fileManager.folderBrowser.tileMenu.hiddenLabel')}
                    </label>
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                        <input type="checkbox" id="folder-properties-applyfilter-checkbox" class="w-4 h-4 rounded" data-uitk="accentControl"${folderRecord.applyFilter !== false ? ' checked' : ''}>
                        ${t('fileManager.folderBrowser.tileMenu.applyFilterLabel')}
                    </label>
                </div>
            </div>
        `;
        modalChoice( // core/modal-choice-ui.js
            '',
            keys.length > 0 ? [
                { label: t('fileManager.folderBrowser.tileMenu.propertiesDownload'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => this._downloadFolderZip(folderRecord.name, mediaType, keys) }
            ] : [],
            { title: escapeHtml(folderRecord.name), bodyHtml }
        );
        wireFolderPropertiesModalUi(folderId, mediaType); // core/file-manager/folder-picker-ui.js
    },

    /** 'fileManagerFolderBrowser.properties.readOnly.change'. */
    async changeReadOnlyFromProperties(folderId, mediaType, enabled) {
        await setFolderReadOnlyFlag(folderId, enabled); // core/file-manager/folder.js
        this._syncActiveFolderReadOnly(folderId, mediaType, enabled);
    },

    /** 'fileManagerFolderBrowser.properties.hidden.change' — view "Tất cả" đang hiện thì nạp lại ngay. */
    async changeHiddenFromProperties(folderId, mediaType, enabled) {
        await setFolderExcludeFlag(folderId, enabled); // core/file-manager/folder.js
        await this._reloadAllViewIfShowing(mediaType);
    },

    /** 'fileManagerFolderBrowser.properties.applyFilter.change' — folder đang là Scope thì áp lại ngay. */
    async changeApplyFilterFromProperties(folderId, mediaType, enabled) {
        await setFolderApplyFilterFlag(folderId, enabled); // core/file-manager/folder.js
        await this._reapplyScopeIfActive(folderId, mediaType);
    },

    /** Folder này có đang là Scope của Nguồn đang hiển thị không. */
    _isActiveScopeFolder(folderId, mediaType) {
        return mediaType === appState.get('activeMediaSource') && folderId === appState.get('activePlayListFolder')[mediaType];
    },

    /** Đồng bộ `isActiveFolderReadOnly` (Block gate upload, event/block.js) khi đổi Read-only của chính folder đang Scope. */
    _syncActiveFolderReadOnly(folderId, mediaType, enabled) {
        if (!this._isActiveScopeFolder(folderId, mediaType)) return;
        appState.set('isActiveFolderReadOnly', enabled);
        console.log(`writer: "_syncActiveFolderReadOnly", page: "isActiveFolderReadOnly", content: "${enabled} (folder ${folderId})"`);
    },

    async _reapplyScopeIfActive(folderId, mediaType) {
        if (!this._isActiveScopeFolder(folderId, mediaType)) return;
        await withLoadingShield(t('common.loading.generic'), () => workflowPlaylistScope.applyFolderScope(folderId, mediaType)); // event/workflow/playlist-scope.js
    },

    /** Đang ở view "Tất cả" của đúng Nguồn này -> nạp lại (Hidden vừa đổi); đang Scope folder khác thì lần sau về "Tất cả" tự đúng. */
    async _reloadAllViewIfShowing(mediaType) {
        if (mediaType !== appState.get('activeMediaSource')) return;
        if (appState.get('activePlayListFolder')[mediaType] != null) return;
        await withLoadingShield(t('common.loading.generic'), () => workflowPlaylistScope.applyAllSongsScope(mediaType)); // event/workflow/playlist-scope.js
    },

    /** Tải toàn bộ item của folder thành .zip — dùng chung luồng của Storage Management. */
    async _downloadFolderZip(folderName, mediaType, keys) {
        const result = await workflowFileManagerStorage.zipAndDownloadOrFallback(keys, FOLDER_ZIP_BUILDER_BY_TYPE[mediaType], `${folderName}.zip`); // event/workflow/file-manager-storage.js
        await this._alertZipError(result);
    },

    async _alertZipError(result) {
        if (result.status !== 'zipError') return;
        await alertModal(tFormat('common.storage.zipDownloadError', { message: escapeHtml(result.message || '') })); // core/modal-choice-ui.js
    },

    // ============================== Filter Edit ==============================

    /** 'fileManagerFolderBrowser.tileMenu.filter.click'. */
    async filterFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard: folder vừa bị xoá
        this._filterEditFolderId = folderId;
        this._filterEditMediaType = folderRecord.type || 'song';
        this._filterEditDraft = FOLDER_FILTER_DRAFT_BY_HAS_CONFIG[!!folderRecord.filterConfig](folderRecord, this._filterEditMediaType);
        this._renderFilterEdit();
    },

    /** Swap Drawer (đang mở từ List) sang màn Filter Edit, đổ draft lên DOM rồi wire. */
    _renderFilterEdit() {
        const bodyHtml = buildFolderFilterEditBodyHtml(this._filterEditMediaType); // components/playlist-filter-drawer.js
        workflowGenericDrawerHelpers.update({ // event/workflow/generic-drawer-helpers.js
            scrollKey: 'folderBrowser:filterEdit',
            scrollReset: true,
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: this._buildFilterEditHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        });
        workflowFilterRuleEdit.syncUi(this._filterEditDraft); // event/workflow/filter-rule-edit.js
        wireFolderFilterEditUi(); // core/file-manager/folder-picker-ui.js — nút Back/Áp dụng; field đi qua delegate chung (event/listener/playlist.js)
    },

    _buildFilterEditHeaderHtml() {
        return `
            <div class="flex justify-between items-center gap-2 px-5 pb-3" data-uitk="headerBorder">
                <button id="btn-folder-filter-edit-back" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.back')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h3 class="text-base font-bold truncate flex-1 text-center" data-uitk="headerTitle">${t('fileManager.folderBrowser.tileMenu.filterSettings')}</h3>
                <button id="btn-folder-filter-edit-apply" type="button" class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold" data-uitk="btnPrimaryBg btnPrimaryHoverBg textOnAccent">${t('common.apply')}</button>
            </div>
        `;
    },

    /** 'fileManagerFolderBrowser.filterEdit.back.click' — bỏ draft (chưa ghi DB), quay về List. */
    backFromFilterEdit() {
        this._filterEditFolderId = null;
        this._filterEditMediaType = null;
        this._filterEditDraft = null;
        this._renderList(false);
    },

    /** 'fileManagerFolderBrowser.filterEdit.apply.click' — ghi draft, áp lại nếu folder đang là Scope. Ở lại màn để sửa tiếp. */
    async applyFolderFilterEdit() {
        const folderId = this._filterEditFolderId, mediaType = this._filterEditMediaType;
        if (!folderId) return; // guard: đã rời màn
        await setFolderFilterConfig(folderId, this._filterEditDraft); // core/file-manager/folder.js
        await this._reapplyScopeIfActive(folderId, mediaType);
    },

    /** 'fileManagerFolderBrowser.filterEdit.field.change' — chỉ sửa draft RAM + DOM tại chỗ (không vẽ lại, giữ focus). */
    setFilterField(field, prop, value) {
        if (!this._filterEditDraft) return; // guard: không ở màn Filter Edit
        workflowFilterRuleEdit.applyFieldChange(this._filterEditDraft, field, prop, value); // event/workflow/filter-rule-edit.js
    },

    /** 'fileManagerFolderBrowser.filterEdit.openTimePicker.click' (totalTime/duration). */
    openFilterTimePicker(field, prop) {
        const draft = this._filterEditDraft;
        if (!draft) return; // guard: không ở màn Filter Edit
        workflowFilterRuleEdit.openTimePicker(draft, field, prop, (seconds) => workflowFilterRuleEdit.applyFieldChange(draft, field, prop, String(seconds))); // event/workflow/filter-rule-edit.js
    },
};
