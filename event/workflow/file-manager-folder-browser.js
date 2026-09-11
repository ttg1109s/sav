/**
 * event/workflow/file-manager-folder-browser.js — VIẾT LẠI (06/09/2026, hợp nhất Folder vào
 * Playlist, Giang chốt mục 3.6 "bỏ hẳn màn Read"). TRƯỚC ĐÂY 2 tầng List↔Read qua 1 Generic Drawer
 * (xem lịch sử ở git/bản cũ) — Read (browse nội dung 1 folder: danh sách item phân trang + 2
 * toggle Scope/Exclude + nút đổi tên/xoá trong header) ĐÃ BỎ HẲN. Giờ CHỈ còn 1 màn (List, grid
 * folder), với 2 tương tác trên MỖI tile:
 *   - Tap (click) — ÁP DỤNG NGAY folder đó làm Scope của Playlist (mục 2.1 plan-folder-playlist-
 *     merge.md) — thay hẳn "vào xem rồi tự bật switch Scope" cũ. Xem `applyFolderFromTile()`.
 *   - Giữ tay 1.5s (long-press) — mở DROPDOWN (SỬA 06/09/2026, Giang chỉ ra bản trước dùng SAI
 *     modalChoice cho cả menu — `core/dropdown-menu.js::openDropdownMenu()`, dropdown neo-theo-nút
 *     dùng CHUNG, cùng khuôn `event/workflow/image-edit.js::openSaveMenu()`) với 4 lựa chọn: đổi
 *     tên/xoá/ẩn-hiện khỏi "Tất cả"/thuộc tính — THAY cho các nút riêng lẻ ở header Read cũ, dồn hết
 *     vào đây (rename/delete/setExclude core đã có sẵn từ trước, KHÔNG viết lại, chỉ đổi NƠI GỌI).
 *     `modalChoice()` CHỈ còn dùng ở 2 chỗ hẹp: xác nhận Xoá (hành động phá huỷ) và màn "Thuộc
 *     tính" (số lượng + dung lượng + nút Tải xuống) — xem `showFolderProperties()`.
 * Xem nội dung 1 folder giờ làm THẲNG trên Playlist chính (đã Scope, xem event/workflow/playlist-
 * scope.js) — không còn màn duyệt riêng trong Generic Drawer nữa.
 *
 * TÁI DÙNG (không viết lại) — `itemTemplateFolderTile()`/`buildAddFolderTileHtml()`/
 * `renderItemList()`/`buildFolderGridWrapperHtml()` (components/items.js, cùng template "Add to
 * Folder" picker ở event/workflow/playlist.js) cho grid List; `openDropdownMenu()`
 * (core/dropdown-menu.js) cho menu long-press; `createFolder()`/`renameFolder()`/`deleteFolder()`/
 * `setFolderExcludeFlag()`/`getFolderRecord()`/`getFolderSongMap()`/`getFolderSongKeys()`/
 * `listFolders()`/`resolveFolderId()` (core/file-manager/folder.js, service/db.js) cho toàn bộ
 * nghiệp vụ; `buildAllSongsZipBlob()`/`buildAllVideosZipBlob()`/`buildAllPhotosZipBlob()`
 * (core/storage-manager.js, SỬA 06/09/2026 thêm tham số `keys` tuỳ chọn) cho nút Tải xuống ở
 * "Thuộc tính" — ĐÚNG core Storage Management như Giang yêu cầu, không viết logic zip riêng.
 *
 * WIRING SỰ KIỆN — giữ nguyên nguyên tắc đã chốt 31/07/2026 (Rule 5a: DOM động do CORE wire, callback
 * CHỈ `eventBus.send()`) — toàn bộ đi qua `wireFolderPickerDrawerEvents()` (core/file-manager/
 * folder-picker-ui.js, dùng CHUNG với Add to Folder picker/VBG picker — long-press MỚI thêm ở đó
 * cùng đợt, payload mang theo `anchorEl` để neo dropdown) + `openDropdownMenu()` (core/dropdown-
 * menu.js, tự wire click cho từng mục — callback truyền vào CHỈ `eventBus.send()`, không viết
 * nghiệp vụ trực tiếp trong callback) + Router (event/router/file-manager-folder-browser.js).
 * `wireFolderBrowserReadEvents()` (wiring riêng cho Read cũ) đã xoá cùng file đó.
 *
 * VIDEO/PHOTO — `addSongsToFolder()`/`removeSongFromFolder()`/`removeAllSongsFromFolder()`/
 * `deleteFolder()` (core/file-manager/folder.js) đã hỗ trợ đủ 3 `mediaType` từ trước, không đổi gì
 * ở đây.
 *
 * NẠP SAU: core/file-manager/folder.js, core/generic-drawer.js, components/items.js
 * (renderItemList/itemTemplateFolderTile/buildAddFolderTileHtml/buildFolderGridWrapperHtml),
 * core/file-manager/folder-picker-ui.js (openRenameFolderModal, wireFolderPickerDrawerEvents),
 * core/dropdown-menu.js (openDropdownMenu), service/z-index.js (Z_INDEX),
 * core/storage-manager.js (buildAllSongsZipBlob/buildAllVideosZipBlob/buildAllPhotosZipBlob),
 * core/about-stats.js (formatBytes), core/dom-refs.js (genericDrawerHeader/Body/Panel),
 * event/workflow/playlist-scope.js (persistScopeChoice/applyFolderScope/applyAllSongsScope).
 * MỚI (Giang yêu cầu tính năng "folder tự quyết áp dụng Filter") — thêm: components/
 * playlist-filter-drawer.js (buildFolderFilterEditBodyHtml, _renderFilterTextFieldRow/
 * _renderFilterNumericFieldRow dùng GIÁN TIẾP qua hàm đó), core/playlist/filter.js
 * (_filterFieldKind/_formatSecondsAsHms/_formatFilterNumberForInput/_parseFilterNumberInput —
 * MIRROR lại cách event/workflow/playlist-filter-presets.js dùng, xem docstring
 * showFolderFilterEditor()), service/state/playlist.js (clonePlaylistFilterConfigDefaults),
 * core/time-picker-modal.js (openTimePickerModal).
 * NẠP TRƯỚC: event/router/file-manager-folder-browser.js.
 */
const workflowFileManagerFolderBrowser = {
    _folders: [],           // cache RAM danh sách folder đang hiển thị — chỉ dùng lúc Drawer đang mở
    _editingFolderId: null, // tile đang ở chế độ sửa tên (vừa tạo) — null = không có

    /** Chọn ĐÚNG biến thể Song/Video/Photo của 1 key (key gốc = Song, key + hậu tố = Video/Photo).
     * SỬA (06/09/2026, bỏ màn Read) — nhận `folderRecord` qua THAM SỐ thay vì đọc
     * `this._readFolderRecord` (đã xoá cùng màn Read — không còn 1 folder "đang mở" cố định nào để
     * đóng vai instance state nữa, mọi hàm giờ tự nhận đúng folder đang thao tác qua tham số, Rule 2).
     * @param {{type?: string}|null} folderRecord
     * @returns {''|'Video'|'Photo'}
     */
    _folderTypeSuffix(folderRecord) {
        const type = folderRecord && folderRecord.type;
        return type === 'video' ? 'Video' : type === 'photo' ? 'Photo' : '';
    },

    /** SỬA (06/09/2026) — nhận `folderRecord` qua tham số, cùng lý do `_folderTypeSuffix()` ngay trên. */
    _folderText(baseKey, folderRecord, params) {
        const fullKey = `${baseKey}${this._folderTypeSuffix(folderRecord)}`;
        return params ? tFormat(fullKey, params) : t(fullKey);
    },

    // ============================== LIST (grid folder) ==============================

    /** Ứng với 'fileManagerFolderBrowser.open.click' — ĐIỂM VÀO DUY NHẤT (nút "Duyệt thư mục" ở
     * panel Song & Video) — vẽ lại danh sách MỚI NHẤT mỗi lần (phòng vừa thêm/xoá/đổi tên ở nơi khác).
     * CHỐT Giang (hợp nhất Photo vào Playlist) — "playlist source nào thì chỉ hiển thị type folder
     * của source tương ứng": lọc NGAY tại nguồn qua `listFolders(activeMediaSource)` (core/file-
     * manager/folder.js) — Folder Browser giờ LUÔN đúng ĐÚNG loại folder khớp Nguồn Playlist đang
     * active, bất kể mở từ đâu.
     */
    async openList() {
        this._folders = await listFolders(appState.get('activeMediaSource')); // core/file-manager/folder.js
        this._editingFolderId = null;
        this._renderList(true);
    },

    /** @param {boolean} isFirstOpen - true: openGenericDrawer(); false: updateGenericDrawer() (đang mở sẵn). */
    _renderList(isFirstOpen) {
        const itemsHtml = renderItemList(null, this._folders, itemTemplateFolderTile, { editingFolderId: this._editingFolderId }); // components/items.js
        const bodyHtml = buildFolderGridWrapperHtml(`${itemsHtml}${buildAddFolderTileHtml()}`); // components/items.js
        const config = {
            height: 'auto',
            maxHeight: '60vh',
            headerHtml: this._buildListHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        };
        if (isFirstOpen) openGenericDrawer(config); else updateGenericDrawer(config); // core/generic-drawer.js
        wireFolderPickerDrawerEvents('fileManagerFolderBrowser', 'fileManagerFolderBrowser.list'); // core/file-manager/folder-picker-ui.js
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

    /** Tạo NGAY 1 folder tên tự động (không trùng tên bất kỳ folder CÙNG TYPE nào đang có), vào
     * thẳng chế độ sửa tên (focus sẵn) — cùng khuôn `createFolderInPicker()` (event/workflow/
     * playlist.js). CHỐT Giang (hợp nhất Photo vào Playlist) — type gán NGAY = `activeMediaSource`
     * hiện tại (list đang hiển thị đã lọc đúng type này từ `openList()`, folder mới tạo tự nhiên
     * cùng type với những gì đang thấy trên màn). */
    async createFolderInBrowser() {
        const mediaType = appState.get('activeMediaSource');
        const defaultName = this._computeDefaultFolderName();
        const folderId = await resolveFolderId(defaultName, mediaType); // core/file-manager/folder.js
        const result = await createFolder(folderId, defaultName, mediaType); // core/file-manager/folder.js
        if (result.status !== 'ok') return; // guard hiếm: trùng tên đúng lúc race — bỏ qua, người dùng bấm lại
        this._folders.push({ id: folderId, name: defaultName, type: mediaType });
        this._editingFolderId = folderId;
        this._renderList(false);
    },

    /** Pure — sinh tên mặc định "Thư mục N" chưa trùng bất kỳ folder nào đang có trong cache RAM. */
    _computeDefaultFolderName() {
        const existingNames = new Set(this._folders.map((f) => f.name));
        let n = this._folders.length + 1;
        let name = tFormat('fileManager.folderBrowser.defaultNewFolderName', { n });
        while (existingNames.has(name)) { n++; name = tFormat('fileManager.folderBrowser.defaultNewFolderName', { n }); }
        return name;
    },

    async commitListRename(folderId, rawName) {
        this._editingFolderId = null;
        const name = rawName.trim();
        if (!name) { this._renderList(false); return; } // guard: bỏ trống -> huỷ sửa, giữ tên mặc định vừa tạo
        const result = await renameFolder(folderId, name); // core/file-manager/folder.js
        if (result.status === 'ok') {
            const folder = this._folders.find((f) => f.id === folderId);
            if (folder) folder.name = name;
        }
        this._renderList(false);
    },

    /** Ứng với nút X ở List. */
    closeBrowser() {
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    // ============================== Tap tile — áp dụng Scope NGAY ==============================

    /** Ứng với 'fileManagerFolderBrowser.list.tile.click' — MỚI (06/09/2026, thay hẳn `openRead()`
     * cũ). Nguồn CHẮC CHẮN khớp `activeMediaSource` hiện tại (List đã tự lọc đúng type từ
     * `openList()`) — áp SỐNG (xem event/workflow/playlist-scope.js, đã bỏ hỏi reload từ trước),
     * rồi đóng Drawer NGAY — người dùng thấy kết quả trên Playlist chính lập tức, không qua bước
     * xem/xác nhận nào nữa. Tap lại ĐÚNG folder đang active cũng chạy y hệt (vô hại, idempotent).
     * @param {string} folderId
     */
    async applyFolderFromTile(folderId) {
        const mediaType = appState.get('activeMediaSource');
        await withLoadingShield(t('common.loading.generic'), async () => {
            await workflowPlaylistScope.persistScopeChoice(folderId, mediaType);
            await workflowPlaylistScope.applyFolderScope(folderId, mediaType);
        });
        this.closeBrowser();
    },

    // ============================== Long-press tile — menu hành động ==============================

    /** Ứng với 'fileManagerFolderBrowser.list.tile.longpress' — SỬA (06/09/2026, Giang chỉ ra sai —
     * "nhấn giữ phải ra DROPDOWN, không phải modalChoice; modalChoice CHỈ dùng khi bấm 'Thuộc
     * tính'") — bản trước dùng SAI `modalChoice()` cho cả 4 lựa chọn. Giờ dùng ĐÚNG
     * `openDropdownMenu()` (core/dropdown-menu.js, component dropdown-neo-theo-nút DÙNG CHUNG có
     * sẵn — CÙNG khuôn `event/workflow/image-edit.js::openSaveMenu()`): mỗi mục chỉ
     * `eventBus.send()`, KHÔNG tự làm nghiệp vụ trong callback (Rule 5a) — case đích riêng ngay
     * dưới (`renameFromTileMenu`/`deleteFromTileMenu`/`propertiesFromTileMenu`) mới THẬT SỰ làm
     * việc, mỗi hàm tự đọc lại `getFolderRecord()` (Rule 2 — không truyền cả object qua payload
     * eventBus, chỉ truyền `folderId`).
     * SỬA (06/09/2026, mục 4a — "Hidden" dời vào checkbox Properties) — mục "Ẩn khỏi Tất cả ↔ Hiện
     * lại" bỏ HẲN khỏi dropdown này — nay là checkbox trong `showFolderProperties()`.
     * SỬA (06/09/2026, mục 4b — Read-only) — ẨN HẲN mục Đổi tên khi `folderRecord.isReadOnly`
     * (không phân biệt đang active hay không — Read-only áp cho chính folder đó, không phải chỉ
     * lúc đang Scope).
     * Đổi tên (ẨN nếu Read-only) / Xoá thư mục (ẨN nếu đang active — mục 3.2, chặn hẳn) / Thuộc
     * tính (mở modalChoice — CHỈ mục NÀY, hiện Contains/Size + 2 checkbox Read-only/Hidden + nút
     * Download, xem `showFolderProperties()`).
     * @param {string} folderId
     * @param {HTMLElement} anchorEl - tile vừa long-press, neo dropdown ngay cạnh nó.
     */
    async openTileActionsMenu(folderId, anchorEl) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard hiếm: folder vừa bị xoá ở nơi khác đúng lúc long-press
        const mediaType = folderRecord.type || 'song';
        const isActiveFolder = folderId === appState.get('activePlayListFolder')[mediaType];

        const ICON_RENAME = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
        const ICON_DELETE = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
        const ICON_PROPERTIES = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>';
        const ICON_FILTER = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>';

        const items = [];
        if (!folderRecord.isReadOnly) {
            items.push({ icon: ICON_RENAME, name: t('fileManager.song.folderDetail.renameTitle'), callback: () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.tileMenu.rename.click', payload: { folderId } }) });
        }
        // SỬA (06/09/2026, Giang chốt mục 3.2 — "chặn hẳn, không tự unapply-rồi-xoá") — ẨN HẲN mục
        // Xoá khi đang active, thay vì hiện ra rồi báo lỗi lúc bấm — người dùng thấy NGAY trong menu
        // là chưa xoá được lúc này, không cần thử mới biết. Xoá KHÔNG bị Read-only chặn (Giang chốt
        // "tất nhiên trừ delete").
        if (!isActiveFolder) {
            items.push({ icon: ICON_DELETE, name: t('fileManager.song.btnDeleteFolder'), destructive: true, callback: () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.tileMenu.delete.click', payload: { folderId } }) });
        }
        items.push({ icon: ICON_PROPERTIES, name: t('fileManager.folderBrowser.tileMenu.properties'), callback: () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.tileMenu.properties.click', payload: { folderId } }) });
        // MỚI (Giang yêu cầu tính năng "folder tự quyết áp dụng Filter", mục 4 "Cài đặt filter") —
        // LUÔN hiện, KHÔNG phụ thuộc `applyFilter` đang bật/tắt (Giang có thể cấu hình field TRƯỚC
        // rồi mới bật checkbox "Áp dụng filter" SAU trong Properties, hoặc ngược lại) — 2 mục ĐỘC
        // LẬP nhau trên dropdown này.
        items.push({ icon: ICON_FILTER, name: t('fileManager.folderBrowser.tileMenu.filterSettings'), callback: () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.tileMenu.filter.click', payload: { folderId } }) });

        openDropdownMenu(anchorEl, items, { zIndex: Z_INDEX.FOLDER_TILE_ACTION_MENU }); // core/dropdown-menu.js
    },

    /** Ứng với 'fileManagerFolderBrowser.tileMenu.rename.click'. */
    async renameFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard hiếm: đã bị xoá ở đâu đó giữa lúc mở menu và bấm mục này
        this.promptRename(folderId, folderRecord);
    },

    /** Ứng với 'fileManagerFolderBrowser.tileMenu.delete.click'. */
    async deleteFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard hiếm — cùng lý do renameFromTileMenu()
        this._confirmDeleteFromMenu(folderId, folderRecord); // modalChoice CHỈ để XÁC NHẬN 1 hành động phá huỷ — khác hẳn bản thân menu, giữ nguyên
    },

    /** Ứng với 'fileManagerFolderBrowser.tileMenu.properties.click' — ĐÂY MỚI ĐÚNG LÀ chỗ DUY NHẤT
     * mở `modalChoice()` trong toàn bộ menu long-press (Giang chốt). */
    async propertiesFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard hiếm — cùng lý do renameFromTileMenu()
        await this.showFolderProperties(folderId, folderRecord);
    },

    /** Ứng với 'fileManagerFolderBrowser.tileMenu.filter.click' — MỚI (Giang yêu cầu tính năng
     * "folder tự quyết áp dụng Filter", mục 4 "Cài đặt filter"). */
    async filterFromTileMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard hiếm — cùng lý do renameFromTileMenu()
        this.showFolderFilterEditor(folderId, folderRecord);
    },

    /** Ứng với 'fileManagerFolderBrowser.rename.confirm' (modal đổi tên — DOM overlay NGOÀI
     * genericDrawerBody, giữ nguyên eventBus).
     * SỬA (06/09/2026, bỏ màn Read) — nhận `folderId`/`folderRecord` qua tham số (mở modal từ menu
     * long-press, không còn `this._readFolderId`/`this._readFolderRecord`). */
    promptRename(folderId, folderRecord) {
        if (!folderRecord) return;
        openRenameFolderModal(folderRecord.name, folderId); // core/file-manager/folder-picker-ui.js — tự bắn eventBus router 'fileManagerFolderBrowser' khi bấm Lưu
    },

    /** Ứng với 'fileManagerFolderBrowser.rename.confirm'. SỬA (06/09/2026, bỏ màn Read) — không
     * còn `this._mode`/refresh Read gì cả, chỉ cần vẽ lại List nếu Drawer đang mở đúng lúc đó (tile
     * vừa đổi tên vẫn còn hiển thị trong `this._folders`). */
    async confirmRenameFolder(folderId, name) {
        const result = await renameFolder(folderId, name); // core/file-manager/folder.js
        if (result.status === 'duplicateName') {
            await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) }));
            return;
        }
        const folder = this._folders.find((f) => f.id === folderId);
        if (folder) { folder.name = name; this._renderList(false); }
    },

    /** SỬA (06/09/2026, Giang chốt mục 3.2 — "chặn hẳn, không tự unapply-rồi-xoá") — mục Xoá đã ẨN
     * HẲN khỏi menu khi folder đang active (xem `openTileActionsMenu()`), nên hàm này CHỈ còn được
     * gọi khi CHẮC CHẮN không active — không cần check lại `isActiveFolder` ở đây nữa. */
    _confirmDeleteFromMenu(folderId, folderRecord) {
        const folderName = folderRecord.name;
        const folderType = folderRecord.type; // capture NGAY — xem SỬA 28/07/2026 ở core/file-manager/folder.js
        modalChoice( // core/modal-choice-ui.js
            this._folderText('fileManager.song.deleteFolderConfirm', folderRecord, { name: escapeHtml(folderName) }),
            [
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: async () => {
                    await deleteFolder(folderId, folderType); // core/file-manager/folder.js
                    await this.openList(); // vẽ lại List — folder đã mất, tự động không còn trong danh sách
                } }
            ],
            { title: t('fileManager.song.deleteFolderTitle') }
        );
    },

    /** Ẩn/hiện khỏi view "Tất cả" — tái dùng THẲNG `setFolderExcludeFlag()` (core/file-manager/
     * folder.js, có sẵn từ Batch 4, không đổi gì). SỬA (06/09/2026, áp sống) — CÙNG LÝ DO
     * `setExclude()` bản cũ (đã xoá cùng màn Read): chỉ có gì để áp SỐNG khi Nguồn hiện tại ĐANG ở
     * "Tất cả" (không đang Scope 1 folder khác) — nếu đang Scope 1 folder cụ thể, đổi Exclude không
     * đổi gì đang hiển thị NGAY LÚC NÀY, chỉ có tác dụng lần sau quay về "Tất cả" (tự đúng,
     * `getExcludedSongKeysFromFolders()` luôn đọc lại tươi mỗi lần `applyAllSongsScope()` chạy). */
    async _toggleExcludeFromMenu(folderId, folderRecord, enabled) {
        const mediaType = folderRecord.type || 'song';
        await setFolderExcludeFlag(folderId, enabled); // core/file-manager/folder.js
        if (appState.get('activePlayListFolder')[mediaType] == null) {
            await withLoadingShield(t('common.loading.generic'), () => workflowPlaylistScope.applyAllSongsScope(mediaType));
        }
    },

    /** Thuộc tính — SỬA (06/09/2026, Giang chốt "thiết kế lại giống Windows") — layout kiểu Windows
     * Properties (hàng "Contains"/"Size" + 2 checkbox Read-only/Hidden ở dưới, vẫn trong khuôn
     * `modalChoice()` hệ thống qua `options.bodyHtml` — KHÔNG tự chế modal riêng). Nhãn số lượng đổi
     * theo type (`{n} songs`/`videos`/`photos`, không còn "items" chung chung). 2 checkbox áp dụng
     * NGAY khi tick (không có nút Lưu riêng) — wiring TRỰC TIẾP ngay sau lời gọi `modalChoice()`,
     * CÙNG khuôn đã có sẵn ở `event/workflow/image-edit.js::editLayerTextContent()` (query
     * `#modal-choice-body` NGAY SAU khi modal đã dựng DOM xong, gắn listener 'change'/'input') — chỉ
     * còn ĐÚNG 1 lựa chọn thật (Tải xuống, ẩn nếu rỗng) nên `modalChoice()` tự render hàng nút
     * ngang [Đóng][Tải xuống], không phải dropdown.
     * "Hide/Unhide" ĐÃ RỜI từ mục riêng trong dropdown long-press sang checkbox "Hidden" ở đây (xem
     * `openTileActionsMenu()` — mục đó đã bỏ khỏi `items[]`). */
    async showFolderProperties(folderId, folderRecord) {
        const mediaType = folderRecord.type || 'song';
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        const keys = getFolderSongKeys(folderMap); // core/file-manager/folder.js — pure, lọc tombstone
        const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
        let totalBytes = 0;
        for (const key of keys) {
            const record = await getRecordFn(key);
            if (record && record.blob) totalBytes += record.blob.size;
        }
        const countLabel = tFormat(
            mediaType === 'video' ? 'fileManager.folderBrowser.tileMenu.countVideos' : mediaType === 'photo' ? 'fileManager.folderBrowser.tileMenu.countPhotos' : 'fileManager.folderBrowser.tileMenu.countSongs',
            { count: String(keys.length) }
        );
        const bodyHtml = `
            <div class="space-y-3">
                <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <span data-uitk="textSecondary">${t('fileManager.folderBrowser.tileMenu.propertiesContains')}</span><span class="font-medium" data-uitk="textPrimary">${escapeHtml(countLabel)}</span>
                    <span data-uitk="textSecondary">${t('fileManager.folderBrowser.tileMenu.propertiesSize')}</span><span class="font-medium" data-uitk="textPrimary">${formatBytes(totalBytes)}</span>
                </div>
                <div class="border-t pt-3 space-y-2.5" data-uitk="dividerBorder">
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                        <input type="checkbox" id="folder-properties-readonly-checkbox" class="w-4 h-4 rounded accent-sky-500"${folderRecord.isReadOnly ? ' checked' : ''}>
                        ${t('fileManager.folderBrowser.tileMenu.readOnlyLabel')}
                    </label>
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                        <input type="checkbox" id="folder-properties-hidden-checkbox" class="w-4 h-4 rounded accent-sky-500"${folderRecord.excludeFromMainPlaylist ? ' checked' : ''}>
                        ${t('fileManager.folderBrowser.tileMenu.hiddenLabel')}
                    </label>
                    <!-- MỚI (Giang yêu cầu tính năng "folder tự quyết áp dụng Filter") — checkbox
                         thứ 3, CÙNG khuôn 2 checkbox trên. Field vắng mặt (folder tạo TRƯỚC tính
                         năng này) = coi như true (mặc định VÂNG LỆNH filter tổng), xem
                         record.applyFilter !== false — KHÁC 2 checkbox trên (vắng mặt = false). -->
                    <label class="flex items-center gap-2.5 text-sm cursor-pointer" data-uitk="textPrimary">
                        <input type="checkbox" id="folder-properties-applyfilter-checkbox" class="w-4 h-4 rounded accent-sky-500"${folderRecord.applyFilter !== false ? ' checked' : ''}>
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

        const modalBody = document.getElementById('modal-choice-body');
        const readOnlyCheckbox = modalBody.querySelector('#folder-properties-readonly-checkbox');
        readOnlyCheckbox.addEventListener('change', (e) => this._onPropertiesReadOnlyChange(folderId, mediaType, e.target.checked));
        const hiddenCheckbox = modalBody.querySelector('#folder-properties-hidden-checkbox');
        hiddenCheckbox.addEventListener('change', (e) => this._toggleExcludeFromMenu(folderId, folderRecord, e.target.checked));
        const applyFilterCheckbox = modalBody.querySelector('#folder-properties-applyfilter-checkbox');
        applyFilterCheckbox.addEventListener('change', (e) => this._onPropertiesApplyFilterChange(folderId, mediaType, e.target.checked));
    },

    /** Checkbox "Read-only" đổi — MỚI (06/09/2026, mục 4b). Ghi `isReadOnly` xong, NẾU folder này
     * đang chính là Scope hiện tại của Nguồn hiện tại thì đồng bộ NGAY `isActiveFolderReadOnly`
     * (field phẳng dùng cho Block gate chặn upload, xem event/block.js) — không đợi lần
     * applyFolderScope() kế tiếp mới cập nhật, vì folder có thể đang active NGAY LÚC tick checkbox
     * này (mở Thuộc tính của chính folder đang xem). */
    async _onPropertiesReadOnlyChange(folderId, mediaType, enabled) {
        await setFolderReadOnlyFlag(folderId, enabled); // core/file-manager/folder.js
        if (mediaType === appState.get('activeMediaSource') && folderId === appState.get('activePlayListFolder')[mediaType]) {
            appState.set('isActiveFolderReadOnly', enabled);
        }
    },

    /** Checkbox "Áp dụng filter" đổi — MỚI (Giang yêu cầu tính năng "folder tự quyết áp dụng
     * Filter"). KHÁC `_onPropertiesReadOnlyChange()` ở chỗ ảnh hưởng THẲNG tới danh sách item đang
     * hiển thị (không chỉ 1 field phẳng chặn thao tác) — NẾU folder này đang chính là Scope hiện
     * tại thì phải gọi lại `applyFolderScope()` NGAY để Playlist phản ánh đúng công thức mới (xem
     * event/workflow/playlist-scope.js), CÙNG khuôn `_toggleExcludeFromMenu()` ngay dưới (bọc
     * `withLoadingShield` — dù thường rất nhanh vì cache đã sẵn, tránh nháy UI giữa chừng). */
    async _onPropertiesApplyFilterChange(folderId, mediaType, enabled) {
        await setFolderApplyFilterFlag(folderId, enabled); // core/file-manager/folder.js
        if (mediaType === appState.get('activeMediaSource') && folderId === appState.get('activePlayListFolder')[mediaType]) {
            await withLoadingShield(t('common.loading.generic'), () => workflowPlaylistScope.applyFolderScope(folderId, mediaType));
        }
    },

    // ============================== "Cài đặt filter" riêng cho 1 folder ==============================

    /** Dựng + mở modal "Cài đặt filter" — MỚI (Giang yêu cầu tính năng "folder tự quyết áp dụng
     * Filter"). CÙNG khuôn `showFolderProperties()` (modalChoice() + wiring trực tiếp NGAY SAU khi
     * DOM vừa chèn, KHÔNG qua eventBus — modal ephemeral, wiring xong trong CÙNG 1 lần gọi hàm,
     * không có rủi ro tham chiếu cũ).
     *
     * `liveConfig` — bản nháp RAM, deep-clone từ `folderRecord.filterConfig` (hoặc bucket rỗng nếu
     * chưa từng cấu hình) — mọi thay đổi field GHI THẲNG (live-commit) vào đây RỒI persist qua
     * `setFolderFilterConfig()` mỗi lần đổi, CÙNG khuôn `workflowPlaylistFilterPresets.
     * setFilterField()` (event/workflow/playlist-filter-presets.js) — KHÔNG tái dùng THẲNG hệ đó vì
     * nó gắn chặt với khái niệm Preset (đọc/ghi qua `appState.playlistFilterPresets[source]` theo
     * id + query cứng `genericDrawerBody`) — modal này KHÔNG nằm trong Generic Drawer, KHÔNG có tên/
     * danh sách/Select/Delete, CHỈ đúng 1 bộ rule RIÊNG của folder này. 3 hàm dưới đây
     * (`_syncFolderFilterEditUI`/`_handleFolderFilterFieldEvent`) mirror lại đúng logic
     * `_syncEditUI()`/`setFilterField()`/`openFilterTimePicker()` của hệ Preset — trùng lặp CÓ CHỦ
     * Ý, đổi tối thiểu (nhận `bodyEl`/`liveConfig` qua tham số thay vì query cứng/tra theo id).
     * @param {string} folderId
     * @param {{name:string, type?:string, filterConfig?:object|null}} folderRecord
     */
    showFolderFilterEditor(folderId, folderRecord) {
        const mediaType = folderRecord.type || 'song';
        const liveConfig = folderRecord.filterConfig
            ? JSON.parse(JSON.stringify(folderRecord.filterConfig)) // deep clone — KHÔNG mutate thẳng object đang sống trong `this._folders` cache/record vừa đọc
            : clonePlaylistFilterConfigDefaults()[mediaType]; // core/playlist/filter.js — folder chưa từng cấu hình field nào
        const bodyHtml = buildFolderFilterEditBodyHtml(liveConfig, mediaType, t); // components/playlist-filter-drawer.js
        modalChoice('', [], { title: escapeHtml(folderRecord.name), bodyHtml }); // core/modal-choice-ui.js — 0 choices thật, dùng nút Đóng mặc định của modalChoice

        const modalBody = document.getElementById('modal-choice-body');
        this._syncFolderFilterEditUI(modalBody, liveConfig);
        const handler = (e) => this._handleFolderFilterFieldEvent(e, folderId, mediaType, liveConfig, modalBody);
        modalBody.addEventListener('change', handler);
        modalBody.addEventListener('input', handler);
        modalBody.addEventListener('click', handler); // nút mở time-picker (data-filter-time-trigger) là 'click' thật — CÙNG lý do gộp 3 listener của handlePlaylistFilterPanelEvent() (event/listener/playlist.js)
    },

    /** Đổ giá trị `config` HIỆN TẠI lên DOM vừa dựng — MIRROR `workflowPlaylistFilterPresets.
     * _syncEditUI()` (event/workflow/playlist-filter-presets.js) NHƯNG nhận `bodyEl`/`config` qua
     * THAM SỐ thay vì query `genericDrawerBody`/tra preset theo id (xem docstring
     * showFolderFilterEditor() — lý do KHÔNG tái dùng thẳng). */
    _syncFolderFilterEditUI(bodyEl, config) {
        const setDisplay = (el, kind, value) => {
            if (!el) return;
            if (kind === 'seconds') el.textContent = _formatSecondsAsHms(value); // core/playlist/filter.js
            else el.value = kind === 'text' ? (value || '') : _formatFilterNumberForInput(kind, value); // core/playlist/filter.js
        };
        for (const field of Object.keys(config)) {
            const rule = config[field];
            const rowEl = bodyEl.querySelector(`[data-filter-row="${field}"]`);
            if (!rowEl) continue;
            const kind = _filterFieldKind(field); // core/playlist/filter.js
            const enableEl = rowEl.querySelector('[data-filter-prop="enabled"]');
            if (enableEl) enableEl.checked = !!rule;
            const bodyBlockEl = rowEl.querySelector('[data-filter-body]');
            if (bodyBlockEl) {
                bodyBlockEl.classList.toggle('opacity-40', !rule);
                bodyBlockEl.classList.toggle('pointer-events-none', !rule);
            }
            if (!rule) continue;
            const opEl = rowEl.querySelector('[data-filter-prop="op"]');
            if (opEl && rule.op !== undefined) opEl.value = rule.op;
            const modeEl = rowEl.querySelector('[data-filter-prop="mode"]');
            if (modeEl && rule.mode !== undefined) modeEl.value = rule.mode;
            const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
            const singleBlock = rowEl.querySelector('[data-filter-single-block]');
            if (!rangeBlock && !singleBlock) {
                setDisplay(rowEl.querySelector('[data-filter-prop="value"]'), kind, rule.value);
                continue;
            }
            setDisplay(singleBlock && singleBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
            setDisplay(rangeBlock && rangeBlock.querySelector('[data-filter-prop="value"]'), kind, rule.value);
            setDisplay(rangeBlock && rangeBlock.querySelector('[data-filter-prop="valueTo"]'), kind, rule.valueTo);
            if (rangeBlock && singleBlock && rule.mode !== undefined) {
                rangeBlock.classList.toggle('hidden', rule.mode === 'single');
                singleBlock.classList.toggle('hidden', rule.mode !== 'single');
            }
        }
    },

    /** Xử lý 1 sự kiện đổi field rule trong modal "Cài đặt filter" — MIRROR
     * `workflowPlaylistFilterPresets.setFilterField()`/`openFilterTimePicker()` NHƯNG ghi thẳng vào
     * `liveConfig` (tham số, đối tượng RAM cục bộ của phiên sửa NÀY) rồi persist qua
     * `setFolderFilterConfig()` (core/file-manager/folder.js) thay vì `appState.
     * playlistFilterPresets`. Gộp CHUNG 1 handler cho cả 3 loại sự kiện (change/input/click) — CÙNG
     * lý do `handlePlaylistFilterPanelEvent()` (event/listener/playlist.js): nút time-picker cần
     * 'click', input/select cần 'change'/'input'.
     *
     * ÁP SỐNG NGAY mỗi lần đổi field — KHÁC hệ Preset (edit KHÔNG tự đổi filter thật đang chạy, cần
     * bấm "Chọn áp dụng" riêng) — CHỐT ở đây theo hướng đơn giản hơn: folder KHÔNG có khái niệm
     * preset/nhiều bộ rule đặt tên, CHỈ đúng 1 bộ rule RIÊNG của chính nó, nên "sửa xong là dùng
     * luôn" hợp lý hơn thêm 1 bước "áp dụng" nữa — CÙNG mức áp sống với 2 checkbox Properties
     * (Read-only/Hidden/Áp dụng filter) đã có sẵn.
     * @param {Event} e @param {string} folderId @param {'song'|'video'|'photo'} mediaType
     * @param {object} liveConfig @param {HTMLElement} bodyEl */
    async _handleFolderFilterFieldEvent(e, folderId, mediaType, liveConfig, bodyEl) {
        const el = e.target.closest('[data-filter-field]');
        if (!el) return;
        const { filterField: field, filterProp: prop } = el.dataset;
        if (!field || !prop) return;

        if (el.hasAttribute('data-filter-time-trigger')) {
            if (e.type !== 'click') return;
            const rule = liveConfig[field];
            if (!rule) return; // guard — field đang tắt, nút bị pointer-events-none nên hiếm khi lọt vào đây
            const currentSeconds = (prop === 'valueTo' ? rule.valueTo : rule.value) || 0;
            openTimePickerModal({ // core/time-picker-modal.js
                title: t(field === 'totalTime' ? 'playlistFilterPanel.field.totalTime' : 'playlistFilterPanel.field.duration'),
                format: 'h-m-s',
                valueMs: currentSeconds * 1000,
                minMs: 0,
                maxMs: 359999000, // 99:59:59 — CÙNG hằng số openFilterTimePicker() (event/workflow/playlist-filter-presets.js)
                onConfirm: async (resultMs) => {
                    const seconds = Math.round(resultMs / 1000);
                    if (prop === 'valueTo') rule.valueTo = seconds; else rule.value = seconds;
                    await this._commitFolderFilterConfig(folderId, mediaType, liveConfig);
                    const btn = bodyEl.querySelector(`[data-filter-field="${field}"][data-filter-prop="${prop}"][data-filter-time-trigger]`);
                    if (btn) btn.textContent = _formatSecondsAsHms(seconds); // core/playlist/filter.js
                },
            });
            return;
        }
        if (prop === 'enabled' && e.type !== 'change') return; // checkbox chỉ nghe 'change'
        if (prop !== 'enabled' && e.type === 'click') return; // op/mode/value/valueTo không có 'click'

        const kind = _filterFieldKind(field); // core/playlist/filter.js
        if (prop === 'enabled') {
            liveConfig[field] = el.checked
                ? (kind === 'text' ? { op: '===', value: '' } : { mode: 'single', op: '===', value: 0, valueTo: 0 })
                : null;
        } else {
            const rule = liveConfig[field];
            if (!rule) return; // guard — field đang tắt, bỏ qua input ẩn
            if (prop === 'op') rule.op = el.value;
            else if (prop === 'mode') rule.mode = el.value;
            else if (prop === 'value') rule.value = kind === 'text' ? el.value : _parseFilterNumberInput(kind, el.value);
            else if (prop === 'valueTo') rule.valueTo = _parseFilterNumberInput(kind, el.value);
        }
        await this._commitFolderFilterConfig(folderId, mediaType, liveConfig);

        // Toggle mờ/khoá data-filter-body NGAY khi bật/tắt field — NGUYÊN VẸN hiệu ứng bản Preset.
        if (prop === 'enabled') {
            const rowEl = bodyEl.querySelector(`[data-filter-row="${field}"]`);
            const bodyBlockEl = rowEl && rowEl.querySelector('[data-filter-body]');
            if (bodyBlockEl) {
                bodyBlockEl.classList.toggle('opacity-40', !el.checked);
                bodyBlockEl.classList.toggle('pointer-events-none', !el.checked);
            }
        }
        if (prop === 'mode') {
            const rowEl = bodyEl.querySelector(`[data-filter-row="${field}"]`);
            if (rowEl) {
                const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
                const singleBlock = rowEl.querySelector('[data-filter-single-block]');
                if (rangeBlock && singleBlock) {
                    rangeBlock.classList.toggle('hidden', el.value === 'single');
                    singleBlock.classList.toggle('hidden', el.value !== 'single');
                }
            }
        }
    },

    /** Persist `liveConfig` vào record folder RỒI áp sống NGAY nếu folder này đang chính là Scope
     * hiện tại — tách riêng khỏi `_handleFolderFilterFieldEvent()` vì được gọi từ 2 chỗ (field
     * thường VÀ callback `onConfirm` của time-picker, xem ngay trên). CÙNG khuôn
     * `_onPropertiesApplyFilterChange()` — bọc `withLoadingShield`. */
    async _commitFolderFilterConfig(folderId, mediaType, liveConfig) {
        await setFolderFilterConfig(folderId, liveConfig); // core/file-manager/folder.js
        if (mediaType === appState.get('activeMediaSource') && folderId === appState.get('activePlayListFolder')[mediaType]) {
            await withLoadingShield(t('common.loading.generic'), () => workflowPlaylistScope.applyFolderScope(folderId, mediaType));
        }
    },

    /** Tải toàn bộ item của 1 folder thành 1 file .zip — tái dùng THẲNG core Storage Management
     * (`buildAllSongsZipBlob()`/`buildAllVideosZipBlob()`/`buildAllPhotosZipBlob()`,
     * core/storage-manager.js) — CHỈ khác Storage Management ở chỗ truyền `keys` là danh sách CỦA
     * RIÊNG folder này (tham số `keys` tuỳ chọn MỚI thêm ở 3 hàm đó, SỬA 06/09/2026) thay vì để hàm
     * tự lấy TOÀN BỘ thư viện — đúng ý Giang "sử dụng core của storage management trong phạm vi
     * folder".
     *
     * SỬA (10/09/2026) — giao hẳn cho `workflowFileManagerStorage.zipAndDownloadOrFallback()`
     * (event/workflow/file-manager-storage.js — method DÙNG CHUNG với Storage Management) thay vì
     * tự lặp lại logic build+tải ở đây. XOÁ (10/09/2026, Giang yêu cầu "loại bỏ toàn bộ JSZip") —
     * `getRecordFn` (trước dùng cho nhánh ước lượng dung lượng/tải riêng dự phòng JSZip, đã bỏ) không
     * còn cần nữa. */
    async _downloadFolderZip(folderName, mediaType, keys) {
        const buildFn = mediaType === 'video' ? buildAllVideosZipBlob : mediaType === 'photo' ? buildAllPhotosZipBlob : buildAllSongsZipBlob; // core/storage-manager.js
        const result = await workflowFileManagerStorage.zipAndDownloadOrFallback(keys, buildFn, `${folderName}.zip`); // event/workflow/file-manager-storage.js
        // KHÔNG có bước "xoá" nào ở luồng Folder Download này (khác Storage Management) — chỉ cần
        // báo lỗi thẳng khi build/tải thất bại.
        if (result.status === 'zipError') await alertModal(tFormat('common.storage.zipDownloadError', { message: escapeHtml(result.message || '') }));
    },
};
