/**
 * event/workflow/file-manager-folder-browser.js — VIẾT LẠI (06/09/2026, hợp nhất Folder vào
 * Playlist, Giang chốt mục 3.6 "bỏ hẳn màn Read"). TRƯỚC ĐÂY 2 tầng List↔Read qua 1 Generic Drawer
 * (xem lịch sử ở git/bản cũ) — Read (browse nội dung 1 folder: danh sách item phân trang + 2
 * toggle Scope/Exclude + nút đổi tên/xoá trong header) ĐÃ BỎ HẲN. Giờ CHỈ còn 1 màn (List, grid
 * folder), với 2 tương tác trên MỖI tile:
 *   - Tap (click) — ÁP DỤNG NGAY folder đó làm Scope của Playlist (mục 2.1 plan-folder-playlist-
 *     merge.md) — thay hẳn "vào xem rồi tự bật switch Scope" cũ. Xem `applyFolderFromTile()`.
 *   - Giữ tay 1.5s (long-press) — mở menu hành động (đổi tên/xoá/ẩn-hiện khỏi "Tất cả"/thuộc tính +
 *     tải xuống), xem `openTileActionsMenu()` — THAY cho các nút riêng lẻ ở header Read cũ, dồn hết
 *     vào đây (rename/delete/setExclude core đã có sẵn từ trước, KHÔNG viết lại, chỉ đổi NƠI GỌI).
 * Xem nội dung 1 folder giờ làm THẲNG trên Playlist chính (đã Scope, xem event/workflow/playlist-
 * scope.js) — không còn màn duyệt riêng trong Generic Drawer nữa.
 *
 * TÁI DÙNG (không viết lại) — `itemTemplateFolderTile()`/`buildAddFolderTileHtml()`/
 * `renderItemList()`/`buildFolderGridWrapperHtml()` (components/items.js, cùng template "Add to
 * Folder" picker ở event/workflow/playlist.js) cho grid List; `createFolder()`/`renameFolder()`/
 * `deleteFolder()`/`setFolderExcludeFlag()`/`getFolderRecord()`/`getFolderSongMap()`/
 * `getFolderSongKeys()`/`listFolders()`/`resolveFolderId()` (core/file-manager/folder.js,
 * service/db.js) cho toàn bộ nghiệp vụ; `buildAllSongsZipBlob()`/`buildAllVideosZipBlob()`/
 * `buildAllPhotosZipBlob()` (core/storage-manager.js, SỬA 06/09/2026 thêm tham số `keys` tuỳ chọn)
 * cho nút Tải xuống ở "Thuộc tính" — ĐÚNG core Storage Management như Giang yêu cầu, không viết
 * logic zip riêng.
 *
 * WIRING SỰ KIỆN — giữ nguyên nguyên tắc đã chốt 31/07/2026 (Rule 5a: DOM động do CORE wire, callback
 * CHỈ `eventBus.send()`) — toàn bộ đi qua `wireFolderPickerDrawerEvents()` (core/file-manager/
 * folder-picker-ui.js, dùng CHUNG với Add to Folder picker/VBG picker — long-press MỚI thêm ở đó
 * cùng đợt) + Router (event/router/file-manager-folder-browser.js). `wireFolderBrowserReadEvents()`
 * (wiring riêng cho Read cũ) đã xoá cùng file đó.
 *
 * VIDEO/PHOTO — `addSongsToFolder()`/`removeSongFromFolder()`/`removeAllSongsFromFolder()`/
 * `deleteFolder()` (core/file-manager/folder.js) đã hỗ trợ đủ 3 `mediaType` từ trước, không đổi gì
 * ở đây.
 *
 * NẠP SAU: core/file-manager/folder.js, core/generic-drawer.js, components/items.js
 * (renderItemList/itemTemplateFolderTile/buildAddFolderTileHtml/buildFolderGridWrapperHtml),
 * core/file-manager/folder-picker-ui.js (openRenameFolderModal, wireFolderPickerDrawerEvents),
 * core/storage-manager.js (buildAllSongsZipBlob/buildAllVideosZipBlob/buildAllPhotosZipBlob),
 * core/about-stats.js (formatBytes), core/dom-refs.js (genericDrawerHeader/Body/Panel),
 * event/workflow/playlist-scope.js (persistScopeChoice/applyFolderScope/applyAllSongsScope).
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
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${t('fileManager.folderBrowser.listTitle')}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
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

    /** Ứng với 'fileManagerFolderBrowser.list.tile.longpress' — MỚI (06/09/2026, Batch 4). Menu
     * hành động (modalChoice, xem core/modal-choice-ui.js) THAY cho 4 nút rải rác ở header Read cũ:
     * Đổi tên / Xoá thư mục (ẨN nếu đang active — mục 3.2, chặn hẳn) / Ẩn khỏi "Tất cả" ↔ Hiện lại
     * (đổi nhãn động theo `excludeFromMainPlaylist` hiện tại) / Thuộc tính (tổng số + dung lượng +
     * nút Tải xuống).
     * @param {string} folderId
     */
    async openTileActionsMenu(folderId) {
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        if (!folderRecord) return; // guard hiếm: folder vừa bị xoá ở nơi khác đúng lúc long-press
        const mediaType = folderRecord.type || 'song';
        const isActiveFolder = folderId === appState.get('activePlayListFolder')[mediaType];
        const isExcluded = !!folderRecord.excludeFromMainPlaylist;
        const btnClassSecondary = 'flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold transition-colors';
        const btnClassDanger = 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors';

        const choices = [
            { label: t('fileManager.song.folderDetail.renameTitle'), className: btnClassSecondary, onClick: () => this.promptRename(folderId, folderRecord) },
        ];
        // SỬA (06/09/2026, Giang chốt mục 3.2 — "chặn hẳn, không tự unapply-rồi-xoá") — ẨN HẲN mục
        // Xoá khi đang active, thay vì hiện ra rồi báo lỗi lúc bấm — người dùng thấy NGAY trong menu
        // là chưa xoá được lúc này, không cần thử mới biết.
        if (!isActiveFolder) {
            choices.push({ label: t('fileManager.song.btnDeleteFolder'), className: btnClassDanger, onClick: () => this._confirmDeleteFromMenu(folderId, folderRecord) });
        }
        choices.push({
            label: this._folderText(isExcluded ? 'fileManager.folderBrowser.tileMenu.unhide' : 'fileManager.song.folderDetail.excludeToggle.label', folderRecord),
            className: btnClassSecondary,
            onClick: () => this._toggleExcludeFromMenu(folderId, folderRecord, !isExcluded),
        });
        choices.push({ label: t('fileManager.folderBrowser.tileMenu.properties'), className: btnClassSecondary, onClick: () => this.showFolderProperties(folderId, folderRecord) });

        modalChoice( // core/modal-choice-ui.js
            t('fileManager.folderBrowser.tileMenu.subtitle'),
            choices,
            { title: escapeHtml(folderRecord.name) }
        );
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
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
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

    /** Thuộc tính: tổng số item + tổng dung lượng + nút Tải xuống (zip). MỚI (06/09/2026, mục 2.7). */
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
        const bodyText = tFormat('fileManager.folderBrowser.tileMenu.propertiesBody', { count: String(keys.length), size: formatBytes(totalBytes) }); // core/about-stats.js
        modalChoice( // core/modal-choice-ui.js
            bodyText,
            keys.length > 0 ? [
                { label: t('fileManager.folderBrowser.tileMenu.propertiesDownload'), className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors', onClick: () => this._downloadFolderZip(folderRecord.name, mediaType, keys) }
            ] : [],
            { title: escapeHtml(folderRecord.name) }
        );
    },

    /** Tải toàn bộ item của 1 folder thành 1 file .zip — tái dùng THẲNG core Storage Management
     * (`buildAllSongsZipBlob()`/`buildAllVideosZipBlob()`/`buildAllPhotosZipBlob()`,
     * core/storage-manager.js) — CHỈ khác Storage Management ở chỗ truyền `keys` là danh sách CỦA
     * RIÊNG folder này (tham số `keys` tuỳ chọn MỚI thêm ở 3 hàm đó, SỬA 06/09/2026) thay vì để hàm
     * tự lấy TOÀN BỘ thư viện — đúng ý Giang "sử dụng core của storage management trong phạm vi
     * folder". */
    async _downloadFolderZip(folderName, mediaType, keys) {
        const buildFn = mediaType === 'video' ? buildAllVideosZipBlob : mediaType === 'photo' ? buildAllPhotosZipBlob : buildAllSongsZipBlob; // core/storage-manager.js
        let zipBlob;
        try {
            await withLoadingShield(t('common.storage.zippingStart'), async () => {
                zipBlob = await buildFn(keys, (done, total, percent) => {
                    const pct = percent != null ? Math.round(percent) : Math.round((done / total) * 100);
                    loadingText.textContent = tFormat('common.storage.zippingProgress', { percent: pct });
                });
            });
        } catch (err) {
            console.error('[file-manager-folder-browser] Lỗi đóng gói zip:', err);
            await alertModal(t('common.storage.zipLibMissing'));
            return;
        }
        triggerDownload(zipBlob, `${folderName}.zip`); // core/id3-export.js
    },
};
