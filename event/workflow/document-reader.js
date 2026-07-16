/**
 * event/workflow/document-reader.js — Workflow HỢP NHẤT cụm "documentReader" (VIẾT LẠI HOÀN TOÀN
 * 10/07/2026, Nhóm A — mục 5 plan-v12-extended.md): GỘP `workflowDocumentPicker` (drawer chọn tài
 * liệu, file event/workflow/document-picker.js CŨ — ĐÃ XOÁ) VÀO ĐÂY. Danh sách (List) và cửa sổ
 * đọc (Read) giờ dùng CHUNG 1 Generic Drawer (core/generic-drawer.js) — chuyển đổi qua
 * `updateGenericDrawer()` (mượt, KHÔNG đóng/mở lại từ đầu, xem mục 2/4.1 plan-v12-extended.md).
 *
 * LUỒNG: bấm "Reader" ở Control Center (event/listener/document-picker.js) -> `openPicker()` (mở
 * Generic Drawer ở mode 'list', renderItemList() từ components/items.js) -> chọn 1 dòng ->
 * `openDocument()` (chuyển SANG mode 'read' TRONG CÙNG drawer qua updateGenericDrawer(), KHÔNG
 * đóng/mở lại). Nút "←" (back) trong Read lại gọi `openPicker()` — dùng CHUNG.
 *
 * WIRING SỰ KIỆN: Generic Drawer KHÔNG biết nội dung header/body là gì (chỉ nhận chuỗi HTML) —
 * Workflow NÀY tự `querySelector` trên `genericDrawerHeader`/`genericDrawerBody` SAU MỖI lần
 * `openGenericDrawer()`/`updateGenericDrawer()` để gắn `addEventListener` trực tiếp (KHÔNG qua
 * eventBus cho các nút động này — nội dung đổi HOÀN TOÀN giữa List/Read nên listener cũ luôn bị
 * innerHTML thay thế theo, không cần tự gỡ tay). Điều này khác hẳn kiểu event delegation ổn định
 * của Settings Panel Stack (settingsStackBody) — CHỦ Ý theo đúng plan-v12-extended.md mục 2.
 *
 * PHÂN TRANG: dùng core/file-manager/document-pagination.js::computeNextDocumentReaderSlot() (cắt
 * theo khối + đo DOM tạm) — THAY HẲN kỹ thuật CSS multi-column cũ. `computeNextDocumentReaderSlot`
 * là hàm ĐỒNG BỘ (đo DOM tạm, không I/O) nên preload/tính thêm trang chạy tức thời — KHÔNG cần
 * loading-shield ngay cả khi "bấm nhanh hơn tốc độ tính" (mục 4.1 plan-v12-extended.md có nhắc
 * trường hợp này cho 1 thuật toán tính CHẬM giả định; với DOM tạm đồng bộ trên tài liệu cỡ vài
 * chục KB thực tế, phép đo luôn xong trong cùng 1 tick JS — nếu sau này Giang thấy giật trên tài
 * liệu rất dài, có thể bọc `_computeMoreSlots()` qua `withLoadingShield()` lúc đó).
 *
 * SỬA: `enterEditMode()` dùng CHUNG `buildDocumentEditorSurface()` (core/file-manager/
 * document-ui.js, TỰ wire toolbar bên trong — Rule 5a core-function-conventions.md) với
 * `workflowFileManagerDocument.openEditor()` (File Manager -> Documents -> Sửa) — đúng mục 1.3
 * "toolbar+surface dùng chung cho cả 2 nơi cần Sửa". Đây là 2 DRAWER RIÊNG (Editor Drawer của File
 * Manager KHÔNG dùng Generic Drawer — ngoài phạm vi batch này, xem mục 2 plan-v12-extended.md
 * "CHỈ Document List+Reader dùng") — chỉ CHIA SẺ hàm dựng surface, không chia sẻ khung drawer.
 * `editorApi.getHtml()` trả về HTML THÔ (chưa sanitize) — MỖI Workflow (đây và
 * file-manager-document.js) TỰ `sanitizeDocumentHtml()` sau khi nhận lại, trước khi ghi DB.
 *
 * NẠP SAU: core/file-manager/document.js (listDocuments/resolveDocumentHtml/updateDocumentContent),
 * core/file-manager/document-ui.js (buildDocumentEditorSurface), core/file-manager/
 * document-pagination.js (computeNextDocumentReaderSlot), core/generic-drawer.js, components/
 * items.js (renderItemList/itemTemplateDocumentRow), core/dom-refs.js, service/task-manager.js.
 * NẠP TRƯỚC: event/router/document-picker.js. Cross-workflow:
 * event/workflow/file-manager-document.js gọi `closeIfShowing()`/`refreshTitleIfOpen()`/
 * `refreshContentIfOpen()` (đóng/cập nhật khi xoá/đổi tên/sửa từ File Manager) — Workflow được
 * phép gọi Workflow khác tự do (không bị Rule 3, rule đó CHỈ áp cho Core).
 */
const DOCUMENT_READER_RELAYOUT_TASK = 'documentReaderRelayout';
const DOCUMENT_READER_PRELOAD_SLOT_COUNT = 5; // mục 4.1 plan-v12-extended.md
const DOCUMENT_READER_KEEP_BEHIND_COUNT = 10; // giữ tối đa 10 trang ĐÃ ĐỌC (phía sau currentPageIndex) có html thật trong bộ nhớ — xa hơn thì dọn, xem _pruneFarBehindPages()
const DOCUMENT_READER_RESTORE_BATCH_COUNT = 5; // mỗi lần cần khôi phục html đã dọn, khôi phục theo LÔ (không phải từng trang 1) — đỡ tính lại nhiều lần nếu người dùng tiếp tục lùi quanh khu vực đó

const workflowDocumentReader = {
    _mode: null, // 'list' | 'read' | null (đóng hẳn)
    _currentDocumentKey: null,
    _currentContentHtml: '',
    _currentTitle: '',
    _currentCreatedBy: 'upload',
    _pages: [], // {startCursor, endCursor: {blockIndex,textOffset}, html: string|null}[] — html=null nghĩa là đã bị dọn (xem _pruneFarBehindPages()), cần _restorePageHtmlIfNeeded() lại trước khi hiện
    _currentPageIndex: 0,
    _isLastSlotReached: false,
    _pageSize: null, // {width, height, className} — đo lần gần nhất, xem _measurePageSize()
    _resizeObserver: null,
    _editorApi: null, // {el, getHtml, focus} đang mở (Reader edit mode) — trả về từ buildDocumentEditorSurface(), null nếu KHÔNG đang sửa
    // Tham chiếu DOM ĐỘNG (KHÔNG nằm trong core/dom-refs.js — body Generic Drawer bị thay HOÀN
    // TOÀN mỗi lần openPicker()/openDocument(), querySelector lại SAU MỖI lần đó, xem _wireReadEvents()).
    _pagesEl: null,
    _emptyEl: null,
    _prevBtn: null,
    _nextBtn: null,
    _pageIndicatorEl: null,
    _editModeEl: null,
    _editMountEl: null,

    // ============================== LIST (Document Picker) ==============================

    /** Mở/chuyển sang List — ĐÂY LÀ ENTRY POINT DUY NHẤT của nút "Reader" ở Control Center (xem
     * event/listener/document-picker.js) VÀ nút "←" (back) trong Read. Vẽ lại danh sách MỚI NHẤT
     * mỗi lần mở (phòng vừa thêm/xoá ở File Manager). */
    async openPicker() {
        this._stopResizeWatcher(); // rời khỏi Read (nếu đang) — dừng theo dõi resize
        this._mode = 'list';
        const documents = await listDocuments(); // core
        const bodyHtml = documents.length
            ? renderItemList(null, documents, itemTemplateDocumentRow, { activeDocumentKey: this._currentDocumentKey }) // components/items.js
            : `<p class="text-sm text-slate-400 text-center py-10">${t('documentPicker.empty')}</p>`;
        // ĐÃ GỠ (rewrite Photo/Album) — comment cũ về `isWindowVirtual: false`/`event/router/
        // virtual-list.js` không còn ý nghĩa, hạ tầng đó đã xoá hẳn. Danh sách này vẫn render đầy đủ
        // 1 lần qua `renderItemList(null, ...)` như cũ (vẫn dưới ngưỡng ~100-200 tài liệu, KHÔNG
        // liên quan gì windowing ảnh).
        // SỬA (14/07/2026, Giang báo bug z-index — Drawer bị #app-stack z-[60] đè khi mở từ
        // Playlist) — BỎ `zIndex: 40` cứng ở đây (thấp hơn #app-stack), để rơi về
        // GENERIC_DRAWER_DEFAULT_Z_INDEX (128) mặc định của core/generic-drawer.js.
        const config = { height: '70vh', headerHtml: this._buildListHeaderHtml(), bodyHtml, bodyClass: 'overflow-y-auto px-4 py-3' };
        if (genericDrawerPanel.classList.contains('hidden')) {
            openGenericDrawer(config); // core/generic-drawer.js
        } else {
            updateGenericDrawer(config); // core/generic-drawer.js
        }
        this._wireListEvents();
    },

    closePicker() {
        this._mode = null;
        this._closeGenericDrawerFully();
    },

    _buildListHeaderHtml() {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${t('documentPicker.title')}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    _wireListEvents() {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closePicker());
        genericDrawerBody.querySelectorAll('.generic-item-document-row').forEach((rowEl) => {
            rowEl.addEventListener('click', () => this.openDocument(rowEl.dataset.documentKey));
        });
    },

    // ============================== READ (Reader) ==============================

    /**
     * Mở 1 tài liệu vào Read — LUÔN gọi SAU KHI drawer đã mở ở mode 'list' (openPicker(), chọn 1
     * dòng) HOẶC đang ở mode 'read' khác (đổi tài liệu ngay trong Reader) -> LUÔN dùng
     * `updateGenericDrawer()` (KHÔNG BAO GIỜ `openGenericDrawer()` ở đây).
     * @param {string} documentKey
     * @param {{startInEdit?: boolean}} [options] - startInEdit=true: mở thẳng chế độ Sửa ngay khi
     *   vào Read. Giữ lại làm API dự phòng (kế thừa từ bản trước Nhóm A) — HIỆN KHÔNG nơi nào gọi
     *   với option này ("Tạo tài liệu mới" ở File Manager dùng `openEditor()` riêng (dựng
     *   `buildDocumentEditorDrawer()`), KHÔNG đi qua `openDocument()` ở đây, xem
     *   event/workflow/file-manager-document.js::createNewDocument()).
     */
    async openDocument(documentKey, options) {
        const record = await getDocumentRecord(documentKey); // service/db.js (data layer)
        if (!record) return;

        this._mode = 'read';
        this._currentDocumentKey = documentKey;
        this._currentContentHtml = resolveDocumentHtml(record); // core/file-manager/document.js
        this._currentTitle = record.title;
        this._currentCreatedBy = record.createdBy;

        updateGenericDrawer({ // core/generic-drawer.js
            height: 'calc(100% - 4rem)',
            // SỬA (14/07/2026) — BỎ `zIndex: 40` cứng (thấp hơn #app-stack z-[60]) — xem giải
            // thích đầy đủ ở config List phía trên/docstring core/generic-drawer.js.
            headerHtml: this._buildReadHeaderHtml(),
            bodyHtml: this._buildReadBodyHtml(),
            bodyClass: 'relative overflow-hidden px-6 pt-5 pb-16',
        });
        this._wireReadEvents();
        this._rebuildPagesFromScratch();
        this._startResizeWatcher();

        if (options && options.startInEdit) this.enterEditMode();
    },

    /** Đóng HẲN drawer (nút X trong Read) — hỏi Lưu/Huỷ trước nếu đang dở chế độ Sửa (tránh mất
     * nội dung vừa gõ mà không hỏi gì). */
    close() {
        this._confirmLeaveEditIfNeeded(() => this._closeNow());
    },

    /** Phần đóng THẬT — tách riêng khỏi `close()` (Rule 1 tương tự áp dụng cho Workflow theo tinh
     * thần rõ ràng, dù Workflow không bị Rule 1-4 ràng buộc cứng — "hỏi có cần lưu không" và "đóng
     * thật" là 2 việc khác nhau, dùng chung bởi cả 2 nhánh Lưu/Huỷ ở trên). */
    _closeNow() {
        this._stopResizeWatcher();
        this._mode = null;
        this._currentDocumentKey = null;
        this._editorApi = null;
        this._closeGenericDrawerFully();
    },

    /** FIX (10/07/2026, phản hồi Giang — bug "đóng Generic Drawer không xoá overlay, che chắn UI
     * mãi mãi"): `closeGenericDrawer()` (core) CHỈ trượt panel xuống, KHÔNG tự thêm lại `hidden`
     * (core/generic-drawer.js không được tự `addEventListener` cho DOM tĩnh — Rule 5a). Workflow
     * NÀY tự nghe `transitionend` rồi gọi `hideGenericDrawerImmediately()` (core) để ẩn hẳn — dùng
     * CHUNG bởi cả `closePicker()` VÀ `_closeNow()`. (Lớp overlay riêng đã BỎ HẲN theo yêu cầu
     * Giang — xem components/generic-drawer.js — nên giờ chỉ còn panel cần xử lý.) */
    _closeGenericDrawerFully() {
        closeGenericDrawer(); // core/generic-drawer.js — trượt xuống
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js — ẩn hẳn
        }, { once: true });
    },

    /** Chạy `onProceed` NGAY nếu KHÔNG đang dở chế độ Sửa; nếu ĐANG dở, hỏi Lưu/Huỷ TRƯỚC (dùng
     * CHUNG bởi `close()` VÀ nút "←" back-to-list trong header Read — cả 2 đường rời khỏi Read đều
     * có thể làm mất nội dung đang gõ dở nếu không hỏi). */
    _confirmLeaveEditIfNeeded(onProceed) {
        if (this._editModeEl && !this._editModeEl.classList.contains('hidden')) {
            modalChoice(
                t('documentReader.closeWhileEditingBody'),
                [
                    { label: t('documentReader.discardChanges'), className: 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors', onClick: () => onProceed() },
                    { label: t('common.save'), className: 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors', onClick: async () => { await this.saveEdit(); onProceed(); } },
                ],
            );
            return;
        }
        onProceed();
    },

    /** Gọi từ workflowFileManagerDocument.confirmDelete() — đóng Reader NẾU đang mở đúng tài liệu
     * vừa bị xoá (tránh hiện nội dung "ma" của tài liệu đã không còn tồn tại). Guard `_mode ===
     * 'read'` — `_currentDocumentKey` vẫn GIỮ NGUYÊN khi đã quay lại List (dùng để tô sáng dòng
     * "đang mở" trong renderItemList(), xem openPicker()), KHÔNG có nghĩa tài liệu đó đang HIỂN
     * THỊ thật trong Read. */
    closeIfShowing(documentKey) {
        if (this._mode === 'read' && this._currentDocumentKey === documentKey) this.close();
    },

    /** Gọi từ workflowFileManagerDocument._renameFromDetail() — cập nhật tiêu đề NGAY trên Reader
     * nếu đang THẬT SỰ hiển thị đúng tài liệu vừa đổi tên (guard `_mode === 'read'` — cùng lý do
     * closeIfShowing() ở trên: nếu đang ở List, `genericDrawerHeader` chứa tiêu đề CỦA LIST, không
     * phải tiêu đề tài liệu — ghi đè nhầm nếu không guard mode). */
    refreshTitleIfOpen(documentKey, title) {
        if (this._mode !== 'read' || this._currentDocumentKey !== documentKey) return;
        this._currentTitle = title;
        const titleEl = genericDrawerHeader.querySelector('h3');
        if (titleEl) titleEl.textContent = title;
    },

    /** Gọi từ workflowFileManagerDocument.openEditor() (drawer Sửa của File Manager) sau khi lưu —
     * nếu Reader ĐANG THẬT SỰ hiển thị đúng tài liệu vừa sửa (2 nơi mở cùng lúc — hiếm nhưng có
     * thể), vẽ lại nội dung mới NGAY. KHÔNG làm gì nếu Reader đang ở chế độ Sửa CỦA CHÍNH NÓ (tránh
     * ghi đè bản đang gõ dở) HOẶC đang ở List (guard `_mode === 'read'`, cùng lý do 2 hàm trên). */
    refreshContentIfOpen(documentKey, html) {
        if (this._mode !== 'read' || this._currentDocumentKey !== documentKey) return;
        if (this._editModeEl && !this._editModeEl.classList.contains('hidden')) return;
        this._currentContentHtml = html;
        this._rebuildPagesFromScratch();
    },

    _buildReadHeaderHtml() {
        const showEditBtn = this._currentCreatedBy === 'user';
        return `
            <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <button id="btn-generic-drawer-back" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 shrink-0" title="${t('documentReader.listTitle')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h3 class="text-sm font-bold text-slate-900 truncate">${escapeHtml(this._currentTitle)}</h3>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    ${showEditBtn ? `<button id="btn-generic-drawer-edit" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600" title="${t('documentReader.btnEdit')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>` : ''}
                    <button id="btn-generic-drawer-close" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600" title="${t('common.close')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
        `;
    },

    _buildReadBodyHtml() {
        return `
            <div id="document-reader-pages" class="document-html-content relative h-full overflow-hidden text-slate-800 text-[15px] leading-relaxed"></div>
            <p id="document-reader-empty" class="hidden text-sm text-slate-400 text-center py-10">${t('documentReader.empty')}</p>
            <div id="document-reader-nav" class="absolute bottom-0 inset-x-0 h-16 flex items-center justify-between px-4 border-t border-slate-200 bg-white">
                <button id="btn-document-reader-prev" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 disabled:opacity-30" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span id="document-reader-page-indicator" class="text-xs text-slate-500 font-mono">1 / 1</span>
                <button id="btn-document-reader-next" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 disabled:opacity-30" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
            <div id="document-reader-edit-mode" class="hidden absolute inset-0 bg-white flex flex-col">
                <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200 shrink-0">
                    <h3 class="text-sm font-bold text-slate-900">${t('documentReader.editTitle')}</h3>
                </div>
                <div id="document-reader-edit-mount" class="flex-1 min-h-0"></div>
                <div class="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 shrink-0">
                    <button id="btn-document-reader-edit-cancel" class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">${t('common.cancel')}</button>
                    <button id="btn-document-reader-edit-save" class="px-5 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors">${t('common.save')}</button>
                </div>
            </div>
        `;
    },

    _wireReadEvents() {
        const backBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-back');
        if (backBtn) backBtn.addEventListener('click', () => this._confirmLeaveEditIfNeeded(() => this.openPicker()));
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        const editBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-edit');
        if (editBtn) editBtn.addEventListener('click', () => this.enterEditMode());

        this._pagesEl = genericDrawerBody.querySelector('#document-reader-pages');
        this._emptyEl = genericDrawerBody.querySelector('#document-reader-empty');
        this._prevBtn = genericDrawerBody.querySelector('#btn-document-reader-prev');
        this._nextBtn = genericDrawerBody.querySelector('#btn-document-reader-next');
        this._pageIndicatorEl = genericDrawerBody.querySelector('#document-reader-page-indicator');
        this._editModeEl = genericDrawerBody.querySelector('#document-reader-edit-mode');
        this._editMountEl = genericDrawerBody.querySelector('#document-reader-edit-mount');

        this._prevBtn.addEventListener('click', () => this.prevPage());
        this._nextBtn.addEventListener('click', () => this.nextPage());
        genericDrawerBody.querySelector('#btn-document-reader-edit-cancel').addEventListener('click', () => this.cancelEdit());
        genericDrawerBody.querySelector('#btn-document-reader-edit-save').addEventListener('click', () => this.saveEdit());
    },

    // ============================== PHÂN TRANG ==============================

    _measurePageSize() {
        this._pageSize = { width: this._pagesEl.clientWidth, height: this._pagesEl.clientHeight, className: this._pagesEl.className };
    },

    /** Tính THÊM `count` slot nối tiếp cache hiện có (dùng cursor = endCursor của slot cuối cùng
     * đã có, hoặc {blockIndex:0, textOffset:0} nếu cache rỗng — xem cursor mở rộng ở
     * core/file-manager/document-pagination.js). Dừng sớm nếu đã chạm slot cuối tài liệu. */
    _computeMoreSlots(count) {
        let cursor = this._pages.length ? this._pages[this._pages.length - 1].endCursor : { blockIndex: 0, textOffset: 0 };
        for (let i = 0; i < count && !this._isLastSlotReached; i++) {
            const { slotHtml, nextCursor, isLastSlot } = computeNextDocumentReaderSlot(this._currentContentHtml, cursor, this._pageSize); // core
            this._pages.push({ startCursor: cursor, endCursor: nextCursor, html: slotHtml });
            cursor = nextCursor;
            if (isLastSlot) this._isLastSlotReached = true;
        }
    },

    /** Dọn `html` (chuỗi đo được — phần TỐN bộ nhớ nhất của 1 trang, có thể dài với tài liệu lớn)
     * của các trang ĐÃ ĐỌC quá xa phía sau `_currentPageIndex` (quá
     * `DOCUMENT_READER_KEEP_BEHIND_COUNT` trang) — vẫn GIỮ NGUYÊN `startCursor`/`endCursor` (2 số/
     * object nhẹ) để khôi phục lại RẺ (chỉ 1 lần gọi `computeNextDocumentReaderSlot()` cho ĐÚNG
     * trang cần, không cần tính lại từ đầu tài liệu) nếu người dùng lùi lại xa sau này — xem
     * `_restorePageHtmlIfNeeded()`. Gọi sau MỖI lần `nextPage()` — KHÔNG gọi ở `prevPage()` (lùi
     * lại không tích luỹ thêm trang phía sau cần dọn). */
    _pruneFarBehindPages() {
        const cutoff = this._currentPageIndex - DOCUMENT_READER_KEEP_BEHIND_COUNT;
        for (let i = 0; i < cutoff; i++) {
            if (this._pages[i] && this._pages[i].html !== null) this._pages[i].html = null;
        }
    },

    /** Nếu trang tại `index` đã bị dọn html (`html === null`) — tính lại NGAY từ `startCursor` đã
     * nhớ sẵn (KHÔNG cần duyệt lại từ đầu tài liệu) — khôi phục theo LÔ
     * `DOCUMENT_READER_RESTORE_BATCH_COUNT` trang liền kề (không chỉ đúng 1 trang) để hạn chế số
     * lần gọi lại `computeNextDocumentReaderSlot()` nếu người dùng tiếp tục lùi quanh khu vực đó. */
    _restorePageHtmlIfNeeded(index) {
        if (!this._pages[index] || this._pages[index].html !== null) return;
        let cursor = this._pages[index].startCursor;
        const end = Math.min(index + DOCUMENT_READER_RESTORE_BATCH_COUNT, this._pages.length);
        for (let i = index; i < end; i++) {
            if (this._pages[i].html === null) {
                const { slotHtml } = computeNextDocumentReaderSlot(this._currentContentHtml, cursor, this._pageSize); // core
                this._pages[i].html = slotHtml;
            }
            cursor = this._pages[i].endCursor;
        }
    },

    /** FIX (10/07/2026, phản hồi Giang — mục 1.2): đảm bảo LUÔN có ÍT NHẤT `count` trang cache SẴN
     * phía TRƯỚC (chưa đọc tới) tính từ trang hiện tại — gọi SAU MỖI lần next/prev (không chỉ lúc
     * mở tài liệu), để giữ đúng "tạo trước 5 trang mỗi lần prev/next" theo yêu cầu, không phải chỉ
     * tính thêm +1 khi cache cạn. */
    _ensureLookahead(count) {
        const aheadAvailable = this._pages.length - 1 - this._currentPageIndex;
        if (aheadAvailable < count && !this._isLastSlotReached) {
            this._computeMoreSlots(count - aheadAvailable);
        }
    },

    /** Đo lại khung đọc + xoá cache + tính lại từ slot 1 — gọi lúc mở tài liệu MỚI, sửa xong lưu,
     * và (debounce) mỗi khi khung đọc đổi kích thước. LUÔN về trang 1 (đơn giản hoá CHỦ Ý, giữ
     * nguyên triết lý đã áp dụng từ bản CSS multi-column cũ — không cố giữ đúng % vị trí đọc cũ). */
    _rebuildPagesFromScratch() {
        this._measurePageSize();
        this._pages = [];
        this._isLastSlotReached = false;
        this._computeMoreSlots(DOCUMENT_READER_PRELOAD_SLOT_COUNT); // mục 4.1 — preload 5 slot lúc mở tài liệu
        this._currentPageIndex = 0;
        this._renderCurrentPage(); // không truyền direction -> hiện tức thời, không trượt (mở tài liệu mới/resize, không phải điều hướng)
    },

    /**
     * Vẽ trang hiện tại. `direction` truyền vào CHỈ khi gọi từ `nextPage()`/`prevPage()` (điều
     * hướng thật của người dùng) — trượt ngang có hiệu ứng (FIX 10/07/2026, phản hồi Giang — mục
     * 1.2, trước đây gán `innerHTML` tức thời, KHÔNG có hiệu ứng slide nào). Gọi KHÔNG truyền
     * `direction` (mở tài liệu mới/resize/sửa xong lưu) -> hiện tức thời, không hoạt náo gì.
     * @param {'next'|'prev'} [direction]
     */
    _renderCurrentPage(direction) {
        const page = this._pages[this._currentPageIndex];
        const html = page ? (page.html || '') : ''; // page.html có thể null nếu bị dọn — nơi gọi (nextPage/prevPage) LUÔN _restorePageHtmlIfNeeded() trước khi tới đây
        if (direction) {
            this._slideToNewPage(html, direction);
        } else {
            this._pagesEl.innerHTML = html;
        }
        const isEmpty = this._currentContentHtml.replace(/<[^>]+>/g, '').trim().length === 0;
        this._emptyEl.classList.toggle('hidden', !isEmpty);
        this._updateNavUI();
    },

    /** Trượt nội dung CŨ ra + nội dung MỚI vào theo hướng `direction` — 2 lớp tuyệt đối chồng lên
     * nhau bên trong `#document-reader-pages` (đã có `relative` trong class tĩnh, xem
     * `_buildReadBodyHtml()`), dùng CSS transition (`.document-reader-slide-layer`,
     * assets/css/style.css) thay vì `taskManager`/`setTimeout` — dọn dẹp qua `transitionend`
     * (tự huỷ, không cần theo dõi thời gian thủ công). */
    _slideToNewPage(newHtml, direction) {
        const outgoing = document.createElement('div');
        outgoing.className = 'document-reader-slide-layer';
        outgoing.innerHTML = this._pagesEl.innerHTML;

        const incoming = document.createElement('div');
        incoming.className = 'document-reader-slide-layer';
        incoming.innerHTML = newHtml;
        incoming.style.transform = direction === 'next' ? 'translateX(100%)' : 'translateX(-100%)';

        this._pagesEl.innerHTML = '';
        this._pagesEl.appendChild(outgoing);
        this._pagesEl.appendChild(incoming);

        void incoming.offsetHeight; // ép reflow trước khi đổi transform — đảm bảo transition CHẠY

        outgoing.style.transform = direction === 'next' ? 'translateX(-100%)' : 'translateX(100%)';
        incoming.style.transform = 'translateX(0)';

        incoming.addEventListener('transitionend', () => {
            this._pagesEl.innerHTML = newHtml; // dọn về 1 lớp đơn giản sau khi trượt xong
        }, { once: true });
    },

    _updateNavUI() {
        this._pageIndicatorEl.textContent = `${this._currentPageIndex + 1} / ${this._pages.length}`;
        this._prevBtn.disabled = this._currentPageIndex <= 0;
        this._nextBtn.disabled = this._currentPageIndex >= this._pages.length - 1 && this._isLastSlotReached;
    },

    nextPage() {
        if (this._currentPageIndex >= this._pages.length - 1) {
            if (this._isLastSlotReached) return; // đã ở trang cuối thật sự
            this._computeMoreSlots(1); // tính thêm 1 slot (đồng bộ — xem lý do KHÔNG cần loading-shield ở đầu file)
            if (this._currentPageIndex >= this._pages.length - 1) return; // vẫn không có trang mới (hết thật)
        }
        this._currentPageIndex++;
        this._renderCurrentPage('next');
        this._ensureLookahead(DOCUMENT_READER_PRELOAD_SLOT_COUNT); // giữ luôn 5 trang cache phía trước
        this._pruneFarBehindPages(); // dọn html các trang đã đọc quá xa phía sau (>10 trang) — nhẹ bộ nhớ với tài liệu dài
    },

    prevPage() {
        if (this._currentPageIndex <= 0) return;
        this._currentPageIndex--;
        this._restorePageHtmlIfNeeded(this._currentPageIndex); // khôi phục nếu trang này đã bị dọn html (xem _pruneFarBehindPages())
        this._renderCurrentPage('prev');
        this._ensureLookahead(DOCUMENT_READER_PRELOAD_SLOT_COUNT); // giữ luôn 5 trang cache phía trước
    },

    // ============================== SỬA (dùng chung buildDocumentEditorSurface) ==============================

    /** Ứng với nút Sửa (CHỈ hiện khi createdBy='user') — mount `buildDocumentEditorSurface()`
     * (core, tự wire toolbar bên trong — Rule 5a) vào `#document-reader-edit-mount`. */
    enterEditMode() {
        if (!this._editModeEl) return;
        this._editModeEl.classList.remove('hidden');
        this._editorApi = buildDocumentEditorSurface(this._currentContentHtml); // core/file-manager/document-ui.js — tự wire toolbar
        this._editMountEl.innerHTML = '';
        this._editMountEl.appendChild(this._editorApi.el);
        this._editorApi.focus();
    },

    /** Huỷ surface KHÔNG lưu — quay lại chế độ đọc với nội dung CŨ (chưa sửa). */
    cancelEdit() {
        this._editModeEl.classList.add('hidden');
        this._editorApi = null;
    },

    /** Lưu nội dung Sửa — `editorApi.getHtml()` trả về HTML THÔ (chưa sanitize, xem docstring đầu
     * core/file-manager/document-ui.js) — Workflow này TỰ `sanitizeDocumentHtml()` (core/file-
     * manager/document.js) trước khi ghi DB (file dựng UI không được gọi document.js, Rule 3). Vẽ
     * lại Reader + báo workflowFileManagerDocument refresh (đề phòng drawer Documents đang mở
     * phía sau). */
    async saveEdit() {
        if (!this._editorApi) return;
        const html = sanitizeDocumentHtml(this._editorApi.getHtml()); // core/file-manager/document.js
        await updateDocumentContent(this._currentDocumentKey, html); // core
        this._currentContentHtml = html;
        this._editModeEl.classList.add('hidden');
        this._editorApi = null;
        this._rebuildPagesFromScratch();
        if (typeof workflowFileManagerDocument !== 'undefined') await workflowFileManagerDocument.refresh();
    },

    // ============================== RESIZE ==============================

    /** ResizeObserver + debounce qua taskManager.once() (CHỈ Workflow được dùng taskManager, xem
     * readme/task-manager-conventions.md) — tránh layout lại liên tục lúc đang kéo resize cửa sổ.
     * Quan sát `genericDrawerBody` (bền vững — luôn tồn tại, chỉ nội dung con đổi). */
    _startResizeWatcher() {
        this._stopResizeWatcher();
        this._resizeObserver = new ResizeObserver(() => {
            taskManager.once(() => this._rebuildPagesFromScratch(), 150, DOCUMENT_READER_RELAYOUT_TASK);
        });
        this._resizeObserver.observe(genericDrawerBody);
    },

    _stopResizeWatcher() {
        taskManager.kill(DOCUMENT_READER_RELAYOUT_TASK);
        if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    },
};
