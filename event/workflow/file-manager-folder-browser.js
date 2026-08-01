/**
 * event/workflow/file-manager-folder-browser.js — MỚI (ver12 "Song/Video Unification", Batch 5,
 * mục 6e plan-v12-song-video-unification.md). "Duyệt thư mục" — THAY HẲN Folder List/Folder Detail
 * kiểu Settings-panel-stack cũ (core/file-manager/folder-list-ui.js + phần lớn
 * event/workflow/file-manager-song.js — ĐÃ XOÁ, xem changelog) bằng 2 tầng List↔Read DÙNG CHUNG 1
 * Generic Drawer (core/generic-drawer.js) — ĐÚNG use-case gốc Generic Drawer sinh ra để làm, mirror
 * NGUYÊN kiến trúc event/workflow/document-reader.js (List=Document Picker, Read=Reader):
 *   - List: grid folder — TÁI DÙNG NGUYÊN `itemTemplateFolderTile()`/`buildAddFolderTileHtml()`/
 *     `renderItemList()` (components/items.js, cùng template đang dùng cho "Add to Folder" picker ở
 *     event/workflow/playlist.js) — KHÔNG viết UI grid mới.
 *   - Read: danh sách item (Song HOẶC Video — KHÔNG BAO GIỜ trộn 2 loại trong 1 folder, xem
 *     addSongsToFolder()) của 1 folder — TÁI DÙNG NGUYÊN `renderFolderDetailSongList()`/
 *     `setFolderDetailTitle()` (core/file-manager/folder-detail-ui.js, đã Rule-1-4-compliant từ
 *     Batch 4, không đổi gì) + 2 toggle Scope/Exclude (Batch 4, mục 5).
 *
 * LÝ DO CẦN VIẾT LẠI (không chỉ đổi vỏ) — `getFolderSongsForDisplay()` cũ đọc tên/nghệ sĩ qua
 * `playlistCache`, CHỈ đúng khi Playlist đang browse ĐÚNG loại của folder đó (`playlistCache` chỉ
 * chứa 1 nguồn tại 1 thời điểm, theo `activeMediaSource`) — folder Video xem lúc Playlist đang
 * browse Song sẽ hiện sai tên. Đã thay `getFolderItemsForDisplay()` (core/file-manager/folder.js,
 * MỚI) đọc TRỰC TIẾP `service/db.js` theo `folder.type`.
 *
 * WIRING SỰ KIỆN — ĐÚNG khuôn document-reader.js (KHÁC hẳn Settings Panel Stack cũ): mọi tương tác
 * BÊN TRONG Generic Drawer (tile/back/đóng/sửa tên/xoá/remove item/toggle/phân trang) gọi THẲNG
 * `this.xxx()` (Workflow tự gọi Workflow, không bị Rule 3 — rule đó CHỈ áp cho Core), KHÔNG qua
 * eventBus — nội dung `genericDrawerBody` bị thay HOÀN TOÀN mỗi lần render lại nên không cần tự gỡ
 * listener cũ. CHỈ 2 msg.type còn qua eventBus/Router thật: nút "Duyệt thư mục" (nằm NGOÀI Generic
 * Drawer, trong panel Song & Video — event/listener/file-manager-song.js delegate như mọi nút tĩnh
 * khác) và modal đổi tên folder (core/file-manager/folder-picker-ui.js::openRenameFolderModal(),
 * DOM overlay riêng NGOÀI genericDrawerBody, giữ nguyên cơ chế eventBus đã có).
 *
 * BLOCK GATE (event/block.js) — KHÔNG còn đăng ký cho toggle Scope ở đây (khác Batch 4): Block gate
 * chỉ chặn được message ĐI QUA eventBus.send() — toggle giờ gọi thẳng `this._enableScope()`, không
 * còn message nào để chặn. Thay bằng guard clause THẲNG trong `_enableScope()` (cùng điều kiện cũ:
 * rỗng + chưa active) + `disabled` attribute trên checkbox (đã có từ Batch 4) làm lớp phòng vệ UI.
 *
 * VIDEO — SỬA (phản hồi Giang 28/07/2026, HOÀN THIỆN "thêm Video vào folder") — `folder.type ===
 * 'video'` giờ hoạt động ĐẦY ĐỦ: `addSongsToFolder()`/`removeSongFromFolder()`/
 * `removeAllSongsFromFolder()`/`deleteFolder()` (core/file-manager/folder.js) ĐÃ thêm tham số
 * `mediaType`, tự chọn ĐÚNG `getVideoRecord`/`setVideoRecord` (thay vì hardcode Song) — record
 * Video giờ CŨNG có field `.folder` (thêm ĐỘNG lúc gọi, không cần đổi schema). "Thêm Video vào
 * folder" đã nối vào menu 3 chấm Playlist (event/workflow/playlist.js::
 * openAddToFolderPickerForSongMenu()/openAddToFolderPicker(), đọc `activeMediaSource` để chọn
 * đúng mediaType, KHÔNG hardcode 'song' nữa).
 *
 * NẠP SAU: core/file-manager/folder.js, core/file-manager/folder-detail-ui.js, core/generic-
 * drawer.js, components/items.js (renderItemList/itemTemplateFolderTile/buildAddFolderTileHtml),
 * core/file-manager/folder-picker-ui.js (openRenameFolderModal), core/pagination.js,
 * event/workflow/playlist-scope.js (persistScopeChoice/askReloadToApplyNow), core/dom-refs.js
 * (genericDrawerHeader/Body/Panel), service/task-manager.js.
 * NẠP TRƯỚC: event/router/file-manager-folder-browser.js.
 */
const workflowFileManagerFolderBrowser = {
    _mode: null, // 'list' | 'read' | null (đóng hẳn)

    // ---- List ----
    _folders: [],          // cache RAM danh sách folder đang hiển thị — chỉ dùng lúc Drawer đang mở
    _editingFolderId: null, // tile đang ở chế độ sửa tên (vừa tạo) — null = không có

    // ---- Read ----
    _readFolderId: null,
    _readFolderRecord: null, // { id, name, type, excludeFromMainPlaylist }
    _readAllItems: [],       // TOÀN BỘ item (chưa phân trang) của folder đang xem — dùng tính lại count mỗi lần

    /** MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — true nếu folder đang xem ở
     * Read là Video (`_readFolderRecord.type === 'video'`). UI Folder Browser Read DÙNG CHUNG 1
     * bộ chuỗi cho cả Song lẫn Video (ra đời TRƯỚC Video, xem lang/patch/patch-file-manager.js) —
     * nhiều chuỗi hardcode "song" dù áp dụng được cho folder Video (empty/removeAll/reload...). */
    _folderIsVideo() {
        return !!(this._readFolderRecord && this._readFolderRecord.type === 'video');
    },

    /** Chọn ĐÚNG biến thể Song/Video của 1 key (key gốc = Song, key + "Video" = Video) — chỉ dùng
     * cho các key ĐÃ CÓ biến thể Video tương ứng (xem lang/patch/patch-file-manager.js), KHÔNG dùng
     * cho key trung lập/không cần biến thể (ví dụ renameTitle/btnDeleteFolder). */
    _folderText(baseKey, params) {
        const fullKey = this._folderIsVideo() ? `${baseKey}Video` : baseKey;
        return params ? tFormat(fullKey, params) : t(fullKey);
    },

    // ============================== LIST (grid folder) ==============================

    /** Ứng với 'fileManagerFolderBrowser.open.click' — ĐIỂM VÀO DUY NHẤT (nút "Duyệt thư mục" ở
     * panel Song & Video) VÀ đích "back" từ Read — vẽ lại danh sách MỚI NHẤT mỗi lần (phòng vừa
     * thêm/xoá/đổi tên ở nơi khác). */
    async openList() {
        this._mode = 'list';
        this._readFolderId = null;
        this._folders = await listFolders(); // core/file-manager/folder.js
        this._editingFolderId = null;
        this._renderList(true);
    },

    /** @param {boolean} isFirstOpen - true: openGenericDrawer(); false: updateGenericDrawer() (đang mở sẵn, vd từ Read back về). */
    _renderList(isFirstOpen) {
        const itemsHtml = renderItemList(null, this._folders, itemTemplateFolderTile, { editingFolderId: this._editingFolderId }); // components/items.js
        const bodyHtml = `<div class="flex flex-wrap justify-start gap-4 p-5">${itemsHtml}${buildAddFolderTileHtml()}</div>`; // components/items.js
        const config = {
            height: 'auto',
            maxHeight: '60vh',
            headerHtml: this._buildListHeaderHtml(),
            bodyHtml,
            bodyClass: 'overflow-y-auto',
        };
        if (isFirstOpen) openGenericDrawer(config); else updateGenericDrawer(config); // core/generic-drawer.js
        this._wireListEvents();
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

    _wireListEvents() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeBrowser());

        genericDrawerBody.querySelectorAll('.generic-item-folder-tile').forEach((tileEl) => {
            tileEl.addEventListener('click', () => this.openRead(tileEl.dataset.folderId));
        });

        const addTileEl = genericDrawerBody.querySelector('#generic-folder-picker-add-tile');
        if (addTileEl) addTileEl.addEventListener('click', () => this._createFolderInBrowser());

        const renameInputEl = genericDrawerBody.querySelector('.generic-folder-tile-rename-input');
        if (renameInputEl) {
            renameInputEl.focus();
            renameInputEl.select();
            const commit = () => this._commitListRename(renameInputEl.closest('[data-folder-id]').dataset.folderId, renameInputEl.value);
            renameInputEl.addEventListener('blur', commit);
            renameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameInputEl.blur(); }); // Enter -> blur -> tự trigger commit, không lặp logic
        }
    },

    /** Tạo NGAY 1 folder tên tự động (không trùng tên bất kỳ folder nào đang có), vào thẳng chế độ
     * sửa tên (focus sẵn) — cùng khuôn `createFolderInPicker()` (event/workflow/playlist.js). */
    async _createFolderInBrowser() {
        const defaultName = this._computeDefaultFolderName();
        const folderId = await resolveFolderId(defaultName); // core/file-manager/folder.js
        const result = await createFolder(folderId, defaultName); // core/file-manager/folder.js
        if (result.status !== 'ok') return; // guard hiếm: trùng tên đúng lúc race — bỏ qua, người dùng bấm lại
        this._folders.push({ id: folderId, name: defaultName, type: null });
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

    async _commitListRename(folderId, rawName) {
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

    /** Ứng với nút X ở List, hoặc gián tiếp từ Read (đóng hẳn, không phải back). */
    closeBrowser() {
        this._mode = null;
        this._readFolderId = null;
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    // ============================== READ (nội dung 1 folder) ==============================

    /** Mở 1 folder vào Read — LUÔN dùng updateGenericDrawer() (Drawer đã mở sẵn ở List). */
    async openRead(folderId) {
        appState.set('pageCurrentFolderDetailSongList', 0); // MỚI mở 1 folder khác -> luôn về trang 1
        this._mode = 'read';
        this._readFolderId = folderId;
        await this._refreshRead();
    },

    /** Đọc lại folder record + items + vẽ lại TOÀN BỘ Read (tiêu đề, danh sách, phân trang, 2
     * toggle) — dùng lúc mở lần đầu VÀ sau MỌI thao tác đổi dữ liệu (gỡ item/xoá hết/đổi scope). */
    async _refreshRead() {
        const folderId = this._readFolderId;
        if (!folderId) return; // guard: đã rời Read
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        this._readFolderRecord = folderRecord;
        if (!folderRecord) { await this.openList(); return; } // guard hiếm: folder vừa bị xoá ở nơi khác trong lúc đang xem -> quay về List

        const folderMap = await getFolderSongMap(folderId); // service/db.js
        const effectiveType = folderRecord.type ?? ((folderMap.list.some((k) => k != null)) ? 'song' : null);
        this._readAllItems = await getFolderItemsForDisplay(folderMap, effectiveType); // core/file-manager/folder.js

        const pageResult = computePage(this._readAllItems, appState.get('pageCurrentFolderDetailSongList'), 30); // core/pagination.js
        if (pageResult.pageIndex !== appState.get('pageCurrentFolderDetailSongList')) {
            appState.set('pageCurrentFolderDetailSongList', pageResult.pageIndex);
            console.log(`writer: "_refreshRead", page: "pageCurrentFolderDetailSongList", content: "${pageResult.pageIndex}"`);
        }

        updateGenericDrawer({ // core/generic-drawer.js
            height: 'auto',
            maxHeight: '80vh',
            headerHtml: this._buildReadHeaderHtml(folderRecord.name),
            bodyHtml: this._buildReadBodyHtml(pageResult),
            bodyClass: 'overflow-y-auto',
        });

        // SỬA (tự audit lại) — renderFolderDetailSongList() PHẢI chạy TRƯỚC _wireReadEvents(): hàm
        // đó mới THẬT SỰ tạo các nút "gỡ item" (`[data-remove-song-key]`) bên trong
        // `#folder-browser-read-item-list` (lúc updateGenericDrawer() vừa xong, container này còn
        // RỖNG — _buildReadBodyHtml() chỉ dựng cái khung). Gọi wire TRƯỚC render sẽ khiến
        // querySelectorAll() không tìm thấy nút nào, nút "gỡ item" sẽ hiện ra nhưng KHÔNG bấm được.
        renderFolderDetailSongList( // core/file-manager/folder-detail-ui.js — TÁI DÙNG NGUYÊN, không đổi
            pageResult.pageItems,
            genericDrawerBody.querySelector('#folder-browser-read-item-list'),
            genericDrawerBody.querySelector('#folder-browser-read-empty'),
            genericDrawerBody.querySelector('#btn-folder-browser-read-remove-all')
        );
        this._wireReadEvents();
        this._updateScopeToggleUI(this._readAllItems.length === 0);
        this._updateExcludeToggleUI();
    },

    _buildReadHeaderHtml(folderName) {
        return `
            <div class="flex items-center gap-1 px-3 pb-3 border-b border-slate-200">
                <button id="btn-folder-browser-read-back" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 shrink-0" title="${t('common.back')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h3 class="flex-1 min-w-0 truncate text-base font-bold text-slate-900">${escapeHtml(folderName)}</h3>
                <button id="btn-folder-browser-read-rename" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500 shrink-0" title="${t('fileManager.song.folderDetail.renameTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button id="btn-folder-browser-read-delete" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-rose-50 transition-colors text-slate-500 hover:text-rose-500 shrink-0" title="${t('fileManager.song.btnDeleteFolder')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <button id="btn-generic-drawer-close" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500 shrink-0" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    /** @param {{pageIndex: number, totalPages: number}} pageResult */
    _buildReadBodyHtml(pageResult) {
        return `
            <div class="px-4 pt-4 flex flex-col gap-4">
                <div class="rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
                    <div id="folder-browser-read-item-list" class="flex flex-col divide-y divide-slate-100 text-slate-800"></div>
                    <p id="folder-browser-read-empty" class="hidden text-sm text-slate-400 p-4 text-center">${this._folderText('fileManager.song.folderDetail.empty')}</p>
                    <div id="folder-browser-read-pagination" class="border-t border-slate-100">${buildPaginationListHtml(pageResult.pageIndex, pageResult.totalPages)}</div>
                </div>

                <div class="rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4 border-b border-slate-100">
                        <div class="pr-3">
                            <div class="text-sm font-medium text-slate-800 truncate">${t('fileManager.song.folderDetail.scopeToggle.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5">${this._folderText('fileManager.song.folderDetail.scopeToggle.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="toggle-folder-browser-read-scope" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner peer-disabled:opacity-40"></div>
                        </label>
                    </div>
                    <div class="flex justify-between items-center p-4">
                        <div class="pr-3">
                            <div class="text-sm font-medium text-slate-800 truncate">${this._folderText('fileManager.song.folderDetail.excludeToggle.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5">${this._folderText('fileManager.song.folderDetail.excludeToggle.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="toggle-folder-browser-read-exclude" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500 shadow-inner"></div>
                        </label>
                    </div>
                </div>

                <div class="flex justify-center pb-2">
                    <button id="btn-folder-browser-read-remove-all" class="hidden px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-sm font-semibold transition-colors">${this._folderText('fileManager.song.folderDetail.btnRemoveAll')}</button>
                </div>
            </div>
        `;
    },

    _wireReadEvents() {
        const backBtn = genericDrawerHeader.querySelector('#btn-folder-browser-read-back');
        if (backBtn) backBtn.addEventListener('click', () => this.openList());

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeBrowser());

        const renameBtn = genericDrawerHeader.querySelector('#btn-folder-browser-read-rename');
        if (renameBtn) renameBtn.addEventListener('click', () => this._promptRename());

        const deleteBtn = genericDrawerHeader.querySelector('#btn-folder-browser-read-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._confirmDeleteFolder());

        genericDrawerBody.querySelectorAll('[data-remove-song-key]').forEach((btn) => {
            btn.addEventListener('click', () => this._removeItem(btn.dataset.removeSongKey));
        });

        const removeAllBtn = genericDrawerBody.querySelector('#btn-folder-browser-read-remove-all');
        if (removeAllBtn) removeAllBtn.addEventListener('click', () => this._confirmRemoveAllItems());

        const paginationEl = genericDrawerBody.querySelector('#folder-browser-read-pagination');
        // data-pagination-action="goto" + data-page-index="N" — ĐÚNG thuộc tính thật core/
        // pagination.js phát ra (mode 'list', xem buildPaginationListHtml()). LƯU Ý thẩm mỹ (KHÔNG
        // phải lỗi chức năng): hàm này tô màu sẵn cho nền TỐI (Settings panel) — text-slate-300 trên
        // nền TRẮNG của Generic Drawer sẽ hơi nhạt, chấp nhận được vì đây là component DÙNG CHUNG,
        // không sửa riêng cho 1 nơi gọi (core/pagination.js phục vụ nhiều nơi khác nền tối).
        if (paginationEl) paginationEl.querySelectorAll('[data-pagination-action="goto"]').forEach((btn) => {
            btn.addEventListener('click', () => this._goToReadPage(parseInt(btn.dataset.pageIndex, 10)));
        });

        const scopeToggle = genericDrawerBody.querySelector('#toggle-folder-browser-read-scope');
        if (scopeToggle) scopeToggle.addEventListener('change', (e) => {
            if (e.target.checked) this._enableScope(); else this._disableScope();
        });
        const excludeToggle = genericDrawerBody.querySelector('#toggle-folder-browser-read-exclude');
        if (excludeToggle) excludeToggle.addEventListener('change', (e) => this._setExclude(e.target.checked));
    },

    async _goToReadPage(pageIndex) {
        appState.set('pageCurrentFolderDetailSongList', pageIndex);
        console.log(`writer: "_goToReadPage", page: "pageCurrentFolderDetailSongList", content: "${pageIndex}"`);
        await this._refreshRead();
    },

    /** DOM-patch thuần — đồng bộ checkbox Scope. Rỗng + chưa active -> `disabled` (không cho bật) —
     * cùng lý do đã áp dụng ở Batch 4, giờ càng QUAN TRỌNG hơn vì Block gate không còn chặn được
     * đường này nữa (xem docstring đầu file). */
    _updateScopeToggleUI(isEmpty) {
        const toggle = genericDrawerBody.querySelector('#toggle-folder-browser-read-scope');
        if (!toggle) return;
        const isActive = this._readFolderId === appState.get('activePlayListFolder');
        toggle.checked = isActive;
        toggle.disabled = isEmpty && !isActive;
    },

    _updateExcludeToggleUI() {
        const toggle = genericDrawerBody.querySelector('#toggle-folder-browser-read-exclude');
        if (!toggle) return;
        toggle.checked = !!(this._readFolderRecord && this._readFolderRecord.excludeFromMainPlaylist);
    },

    /** Bật Scope. Guard THẲNG (thay Block gate cũ, xem docstring đầu file): rỗng + chưa active ->
     * không làm gì (checkbox đã `disabled` nên bình thường không tới được đây, guard này là lớp
     * phòng vệ thứ 2). */
    async _enableScope() {
        if (this._readAllItems.length === 0 && this._readFolderId !== appState.get('activePlayListFolder')) return;
        const folderId = this._readFolderId;
        await workflowPlaylistScope.persistScopeChoice(folderId);
        this._updateScopeToggleUI(this._readAllItems.length === 0);
        workflowPlaylistScope.askReloadToApplyNow(this._folderText('fileManager.song.folderDetail.applyReloadBody', { name: escapeHtml(this._readFolderRecord ? this._readFolderRecord.name : '') }));
    },

    async _disableScope() {
        await workflowPlaylistScope.persistScopeChoice(null);
        this._updateScopeToggleUI(this._readAllItems.length === 0);
        workflowPlaylistScope.askReloadToApplyNow(this._folderText('fileManager.song.folderDetail.unapplyReloadBody'));
    },

    async _setExclude(enabled) {
        await setFolderExcludeFlag(this._readFolderId, enabled); // core/file-manager/folder.js
        workflowPlaylistScope.askReloadToApplyNow(enabled
            ? this._folderText('fileManager.song.folderDetail.excludeOnReloadBody')
            : this._folderText('fileManager.song.folderDetail.excludeOffReloadBody'));
    },

    /** Gỡ 1 item khỏi folder (KHÔNG xoá bài/video thật). Rỗng hoàn toàn + đang là scope hiện tại ->
     * tự bỏ áp dụng (cùng logic đã có từ trước Batch 4). */
    async _removeItem(key) {
        const folderId = this._readFolderId;
        const mediaType = this._readFolderRecord && this._readFolderRecord.type; // xem SỬA 28/07/2026 ở core/file-manager/folder.js — đọc đúng type đã khoá của folder
        await removeSongFromFolder(key, folderId, mediaType); // core/file-manager/folder.js
        const folderMap = await getFolderSongMap(folderId); // service/db.js — CÓ return, DÙNG ngay dưới để check rỗng
        await this._refreshRead();
        if (isFolderEmpty(folderMap) && folderId === appState.get('activePlayListFolder')) { // core/file-manager/folder.js
            await workflowPlaylistScope.persistScopeChoice(null);
            await this._refreshRead();
            workflowPlaylistScope.askReloadToApplyNow(this._folderText('fileManager.song.folderDetail.autoUnapplyReloadBody'));
        }
    },

    _confirmRemoveAllItems() {
        const folderId = this._readFolderId;
        modalChoice( // core/modal-choice.js
            this._folderText('fileManager.song.folderDetail.removeAllConfirm'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: this._folderText('fileManager.song.folderDetail.btnRemoveAll'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    const mediaType = this._readFolderRecord && this._readFolderRecord.type; // xem SỬA 28/07/2026 ở core/file-manager/folder.js
                    await removeAllSongsFromFolder(folderId, mediaType); // core/file-manager/folder.js
                    await this._refreshRead();
                    if (folderId === appState.get('activePlayListFolder')) {
                        await workflowPlaylistScope.persistScopeChoice(null);
                        await this._refreshRead();
                        workflowPlaylistScope.askReloadToApplyNow(this._folderText('fileManager.song.folderDetail.autoUnapplyReloadBody'));
                    }
                } }
            ],
            { title: this._folderText('fileManager.song.folderDetail.removeAllTitle') }
        );
    },

    _promptRename() {
        if (!this._readFolderRecord) return;
        openRenameFolderModal(this._readFolderRecord.name, this._readFolderId); // core/file-manager/folder-picker-ui.js — tự bắn eventBus router 'fileManagerFolderBrowser' khi bấm Lưu
    },

    /** Ứng với 'fileManagerFolderBrowser.rename.confirm' (modal đổi tên — DOM overlay NGOÀI
     * genericDrawerBody, giữ nguyên eventBus, xem docstring đầu file). */
    async confirmRenameFolder(folderId, name) {
        const result = await renameFolder(folderId, name); // core/file-manager/folder.js
        if (result.status === 'duplicateName') {
            await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) }));
            return;
        }
        if (this._mode === 'read' && this._readFolderId === folderId) await this._refreshRead();
    },

    _confirmDeleteFolder() {
        if (!this._readFolderRecord) return;
        const folderId = this._readFolderId;
        const folderName = this._readFolderRecord.name;
        const folderType = this._readFolderRecord.type; // capture NGAY — xem SỬA 28/07/2026 ở core/file-manager/folder.js
        const isActiveFolder = folderId === appState.get('activePlayListFolder');
        // SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — 'deleteActiveFolderConfirm'
        // vốn đã trung lập (không nói "song"), CHỈ 'deleteFolderConfirm' cần biến thể Video
        // ("Songs inside stay in your library..." — dùng _folderText() thay vì tFormat() thẳng).
        const confirmBody = isActiveFolder
            ? tFormat('fileManager.song.deleteActiveFolderConfirm', { name: escapeHtml(folderName) })
            : this._folderText('fileManager.song.deleteFolderConfirm', { name: escapeHtml(folderName) });
        modalChoice( // core/modal-choice.js
            confirmBody,
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.song.btnDeleteFolder'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteFolder(folderId, folderType); // core/file-manager/folder.js
                    if (isActiveFolder) await workflowPlaylistScope.persistScopeChoice(null);
                    await this.openList(); // folder đã mất -> luôn quay về List
                    if (isActiveFolder) workflowPlaylistScope.askReloadToApplyNow(this._folderText('fileManager.song.folderDetail.deleteReloadBody'));
                } }
            ],
            { title: t('fileManager.song.deleteFolderTitle') }
        );
    },
};
