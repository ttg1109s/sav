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
 * wireFolderFilterEditUi) + core/dropdown-menu.js; chạm/giữ tay tile qua workflowFolder (event/workflow/folder.js); field rule của Filter Edit đi qua delegate chung
 * `handlePlaylistFilterPanelEvent()` (event/listener/playlist.js, `data-filter-owner="folder"`) và sửa qua
 * workflowFilterRuleEdit (dùng chung với màn Edit preset). Rẽ nhánh = guard + object map (readme/event-bus-flow.md §7).
 *
 * NẠP SAU: core/file-manager/folder.js, event/workflow/folder.js (workflowFolder — đọc/ghi DB của miền Folder), core/file-manager/folder-picker-ui.js, components/items.js, core/dropdown-menu.js,
 * core/modal-choice-ui.js, core/storage-manager.js, core/about-stats.js (formatBytes), components/playlist-filter-drawer.js
 * (buildFolderFilterEditBodyHtml), service/state/playlist.js (clonePlaylistFilterConfigDefaults), core/pagination-ui.js,
 * core/dom-refs.js, service/z-index.js, event/workflow/filter-rule-edit.js, event/workflow/generic-drawer-helpers.js,
 * event/workflow/pagination.js, event/workflow/playlist-scope.js, event/workflow/file-manager-storage.js.
 */

const FOLDER_ICON_RENAME = iconSvg('pencil-alt');
const FOLDER_ICON_DELETE = iconSvg('trash');
const FOLDER_ICON_PROPERTIES = iconSvg('information-circle');
const FOLDER_ICON_FILTER = iconSvg('filter');

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
        this._folders = await workflowFolder.list(appState.get('activeMediaSource')); // event/workflow/folder.js
        this._editingFolderId = null;
        this._listPageIndex = 0;
        this._renderList(true);
    },

    /** @param {boolean} isFirstOpen - true: mở Drawer; false: thay nội dung Drawer đang mở.
     * @param {boolean} [scrollReset] - true: cuộn về đầu (đổi trang); mặc định giữ vị trí đã nhớ. */
    _renderList(isFirstOpen, scrollReset = false) {
        const view = workflowPagination.computePlaceView('folderBrowser', this._folders, this._listPageIndex); // event/workflow/pagination.js
        this._listPageIndex = view.pageIndex;
        const itemsHtml = renderItemList(view.pageItems, itemTemplateFolderTile, { editingFolderId: this._editingFolderId }); // components/items.js
        const bodyHtml = buildFolderBrowserListBodyHtml(itemsHtml, workflowPagination.buildControlsHtml(view)); // components/items.js
        FOLDER_DRAWER_MOUNT_BY_FIRST_OPEN[isFirstOpen]({
            scrollKey: 'folderBrowser:list',
            scrollReset,
            height: 'auto',
            maxHeight: '60vh',
            headerHtml: buildFolderBrowserListHeaderHtml(), // components/items.js
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        });
        wireFolderPickerDrawerEvents('fileManagerFolderBrowser', 'fileManagerFolderBrowser.list'); // core/file-manager/folder-picker-ui.js
        wirePaginationControls(genericDrawerBody.querySelector('#folder-browser-pagination'), 'fileManagerFolderBrowser', 'fileManagerFolderBrowser.list.page.change'); // core/pagination-ui.js
    },

    /** 'fileManagerFolderBrowser.list.page.change'. @param {number} pageIndex */
    setListPage(pageIndex) {
        this._listPageIndex = pageIndex;
        this._renderList(false, true);
    },

    /** 'fileManagerFolderBrowser.list.addTile.click' — tạo ngay folder tên tự động (type = Nguồn đang active),
     * nhảy tới trang chứa nó và mở ô sửa tên. */
    async createFolderInBrowser() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = computeNextFolderName(this._folders); // core/file-manager/folder.js
        const result = await workflowFolder.create(defaultName, mediaType); // event/workflow/folder.js
        if (result.status !== 'ok') return; // guard: trùng tên do race — người dùng bấm lại
        this._folders.push({ id: result.folderId, name: defaultName, type: mediaType });
        this._editingFolderId = result.folderId;
        this._listPageIndex = workflowPagination.pageIndexOfItem('folderBrowser', this._folders.length - 1);
        this._renderList(false);
    },

    /** 'fileManagerFolderBrowser.list.rename.commit' — blur/Enter ô sửa tên; tên rỗng/trùng giữ tên cũ. */
    async commitListRename(folderId, rawName) {
        this._editingFolderId = null;
        await this._renameFolder(folderId, normalizeFolderNameInput(rawName)); // core/file-manager/folder.js
        this._renderList(false);
    },

    /** 'fileManagerFolderBrowser.list.close.click'. */
    closeBrowser() {
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** 'fileManagerFolderBrowser.list.tile.tap' — áp Scope folder này ngay rồi đóng Drawer. @param {string} folderId */
    async applyFolderFromTile(folderId) {
        const mediaType = appState.get('activeMediaSource');
        await withLoadingShield(t('common.loading.generic'), async () => { // core/loading-shield-util.js
            await workflowPlaylistScope.persistScopeChoice(folderId, mediaType);
            await workflowPlaylistScope.applyFolderScope(folderId, mediaType);
            // Quy tắc A: folder có media đang phát -> cuộn tới nó, không -> về đầu.
            workflowPlaylistRender.scrollToCurrentOrTop(); // event/workflow/playlist-render.js
        });
        this.closeBrowser();
    },

    // ============================== Long-press — dropdown ==============================

    /** 'fileManagerFolderBrowser.list.tile.longpress' (workflowFolder phát sau khi giữ đủ lâu) — mỗi mục chỉ bắn eventBus.
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

    /** 'fileManagerFolderBrowser.tileMenu.rename.click' — modal đổi tên (modalChoice, OK -> confirmRenameFolder()). */
    async renameFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard: folder vừa bị xoá
        modalChoice('', [ // core/modal-choice-ui.js
            { label: t('common.ok'), className: 'flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors', themeKeys: 'btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent', onClick: () => this.confirmRenameFolder(folderId, normalizeFolderNameInput(inputEl.value)) }, // core/file-manager/folder.js
        ], { title: t('fileManager.song.renameFolderTitle'), bodyHtml: renderRenameFolderModalBody() }); // components/items.js
        const inputEl = fillRenameFolderModalInput(folderRecord.name); // core/file-manager/folder-picker-ui.js
    },

    /** OK của modal đổi tên — tên rỗng bỏ qua; trùng tên thì báo; đổi được thì vẽ lại List. */
    async confirmRenameFolder(folderId, name) {
        const status = await this._renameFolder(folderId, name);
        await this._alertDuplicateFolderName(status, name);
        this._renderListAfterRename(status, folderId);
    },

    /** Đổi tên (DB + cache RAM + badge Scope). Tên rỗng -> bỏ qua. @returns {Promise<string>} status */
    async _renameFolder(folderId, name) {
        if (!name) return 'empty';
        const result = await workflowFolder.rename(folderId, name); // event/workflow/folder.js
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
                    await workflowFolder.remove(folderId, folderType); // event/workflow/folder.js
                    await this._reloadAllViewIfHiddenDeleted(folderRecord); // xem docstring
                    await this.openList();
                } }
            ],
            { title: t('fileManager.song.deleteFolderTitle') }
        );
    },

    /** Folder vừa xoá là Hidden -> nạp lại view "Tất cả" ngay (nếu đang ở đúng view đó) để media trong đó hiện lại —
     * không thì `playlistOrder` vẫn loại chúng cho tới lần nạp lại kế tiếp (đổi Scope/boot). */
    async _reloadAllViewIfHiddenDeleted(folderRecord) {
        if (!folderRecord.excludeFromMainPlaylist) return; // guard: folder không Hidden — view "Tất cả" không đổi
        await this._reloadAllViewIfShowing(folderRecord.type || 'song');
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
        const totalBytes = sumFolderRecordBytes(records); // core/file-manager/folder.js
        const countLabel = tFormat(FOLDER_COUNT_LABEL_KEY_BY_TYPE[mediaType], { count: String(keys.length) });
        const bodyHtml = buildFolderPropertiesBodyHtml(countLabel, totalBytes, folderRecord); // components/items.js
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
        await workflowFolder.writeSetting(folderId, 'readOnly', enabled); // event/workflow/folder.js
        this._syncActiveFolderReadOnly(folderId, mediaType, enabled);
    },

    /** 'fileManagerFolderBrowser.properties.hidden.change' — view "Tất cả" đang hiện thì nạp lại ngay. */
    async changeHiddenFromProperties(folderId, mediaType, enabled) {
        await workflowFolder.writeSetting(folderId, 'hidden', enabled); // event/workflow/folder.js
        await this._reloadAllViewIfShowing(mediaType);
    },

    /** 'fileManagerFolderBrowser.properties.applyFilter.change' — folder đang là Scope thì áp lại ngay. */
    async changeApplyFilterFromProperties(folderId, mediaType, enabled) {
        await workflowFolder.writeSetting(folderId, 'applyFilter', enabled); // event/workflow/folder.js
        await this._reapplyScopeIfActive(folderId, mediaType);
    },

    /** Folder này có đang là Scope của Nguồn đang hiển thị không. */
    _isActiveScopeFolder(folderId, mediaType) {
        const { activeMediaSource, activePlayListFolder } = appState.get(['activeMediaSource', 'activePlayListFolder']);
        return mediaType === activeMediaSource && folderId === activePlayListFolder[mediaType];
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
        const { activeMediaSource, activePlayListFolder } = appState.get(['activeMediaSource', 'activePlayListFolder']);
        if (mediaType !== activeMediaSource) return; // guard: Nguồn khác đang hiển thị
        if (activePlayListFolder[mediaType] != null) return; // guard: đang Scope 1 folder, không ở view "Tất cả"
        await withLoadingShield(t('common.loading.generic'), () => workflowPlaylistScope.applyAllSongsScope(mediaType)); // event/workflow/playlist-scope.js
    },

    /** Tải toàn bộ item của folder thành .zip — dùng chung luồng của Storage Management. */
    async _downloadFolderZip(folderName, mediaType, keys) {
        const result = await workflowFileManagerStorage.zipAndDownloadOrFallback(mediaType, keys, `${folderName}.zip`); // event/workflow/file-manager-storage.js
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
            headerHtml: buildFolderFilterEditHeaderHtml(), // components/playlist-filter-drawer.js
            bodyHtml,
            bodyClass: 'overflow-y-auto p-4', // cách mép Drawer như màn Edit preset Filter (Settings bọc `p-4`)
        });
        workflowFilterRuleEdit.syncUi(this._filterEditDraft); // event/workflow/filter-rule-edit.js
        wireFolderFilterEditUi(); // core/file-manager/folder-picker-ui.js — nút Back/Áp dụng; field đi qua delegate chung (event/listener/playlist.js)
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
        await workflowFolder.writeSetting(folderId, 'filterConfig', this._filterEditDraft); // event/workflow/folder.js
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
