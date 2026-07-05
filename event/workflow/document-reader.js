/**
 * event/workflow/document-reader.js — Workflow cụm "documentReader" (cửa sổ đọc tài liệu — CHỈ
 * hiện nội dung phân trang; KHÔNG còn tự quyết định "mở tài liệu nào lúc mới bấm Reader" — việc đó
 * giờ thuộc về `workflowDocumentPicker`, xem components/document-picker-drawer.js).
 *
 * VIẾT LẠI LUỒNG (04/07/2026, mục 3 phản hồi Giang) — bỏ hẳn `openFromControlCenter()`: nút
 * "Reader" ở Control Center giờ mở `workflowDocumentPicker` (drawer trắng chọn tài liệu) TRƯỚC,
 * CHỌN XONG mới gọi `openDocument()` ở ĐÂY. File này chỉ còn lo hiển thị/phân trang/sửa 1 tài liệu
 * ĐÃ ĐƯỢC CHỌN SẴN, không tự ý mở tài liệu nào theo mặc định nữa.
 *
 * PHÂN TRANG: dùng core/file-manager/document-ui.js::applyReaderPagination() (CSS multi-column) —
 * gọi lại mỗi khi mở tài liệu MỚI, sửa xong lưu, HOẶC khung đọc đổi kích thước (ResizeObserver,
 * debounce qua taskManager.once() — CHỈ Workflow được dùng taskManager, xem
 * readme/task-manager-conventions.md). Đơn giản hoá CHỦ Ý: mỗi lần layout lại LUÔN về trang 1
 * (KHÔNG cố giữ đúng vị trí đọc cũ theo % nội dung — phức tạp không cần thiết cho tính năng này).
 *
 * FIX (05/07/2026, mục 5 phản hồi Giang — Markdown + Toast UI Editor): `content` giờ là 1 chuỗi
 * Markdown (không còn mảng đoạn) — `_currentMarkdown` thay `_currentParagraphs`. Chế độ Sửa (nút
 * "Sửa" trong Reader) đổi từ `<textarea>` sang mount THẬT Toast UI Editor (WYSIWYG) vào
 * `#document-reader-edit-mount` — ĐỒNG BỘ với `openDocumentEditorDrawer()`
 * (event/workflow/file-manager-document.js), tránh 2 kiểu sửa khác nhau trong cùng 1 app.
 *
 * NẠP SAU: core/file-manager/document.js, core/file-manager/document-ui.js, core/dom-refs.js,
 * service/task-manager.js. NẠP TRƯỚC: event/router/document-reader.js,
 * event/listener/document-reader.js. Cross-workflow: event/workflow/file-manager-document.js gọi
 * `workflowDocumentReader.closeIfShowing()`/`refreshTitleIfOpen()`/`refreshContentIfOpen()` (đóng/
 * cập nhật tiêu đề/nội dung khi xoá/đổi tên/sửa từ File Manager); event/workflow/document-picker.js
 * gọi `openDocument()` (chọn xong trong drawer) — Workflow được phép gọi Workflow khác tự do (không
 * bị Rule 3, rule đó CHỈ áp cho Core).
 */
const DOCUMENT_READER_RELAYOUT_TASK = 'documentReaderRelayout';

const workflowDocumentReader = {
    _currentDocumentKey: null,
    _currentMarkdown: '',
    _currentPageIndex: 0,
    _totalPages: 1,
    _pageWidth: 0,
    _resizeObserver: null,
    _editModeEditorInstance: null,

    /**
     * Mở 1 tài liệu vào Reader (từ danh sách File Manager HOẶC dropdown list ngay trong Reader).
     * @param {string} documentKey
     * @param {{startInEdit?: boolean}} [options] - startInEdit=true: mở thẳng chế độ Sửa (dùng khi
     *   vừa "Tạo tài liệu mới" — đúng yêu cầu Giang, không cần vào Reader rồi bấm Sửa thêm 1 bước).
     */
    async openDocument(documentKey, options) {
        const record = await getDocumentRecord(documentKey); // core (data layer)
        if (!record) return;

        this._currentDocumentKey = documentKey;
        this._currentMarkdown = resolveDocumentMarkdown(record); // core (core/file-manager/document.js) — tương thích ngược record cũ

        documentReaderTitle.textContent = record.title;
        btnDocumentReaderEdit.classList.toggle('hidden', record.createdBy !== 'user'); // CHỈ 'user' được sửa (đúng yêu cầu Giang)
        documentReaderEditMode.classList.add('hidden'); // phòng còn kẹt chế độ Sửa từ lần mở trước

        setDocumentReaderVisible(documentReaderOverlay, documentReaderWindow, true); // core/UI
        this._layoutAndRenderCurrentPage();
        this._startResizeWatcher();

        if (options && options.startInEdit) this.enterEditMode();
    },

    /** Vẽ lại toàn bộ nội dung (render Markdown -> HTML) + tính lại phân trang — gọi lúc mở tài
     * liệu MỚI, sửa xong lưu, và (debounce) mỗi khi khung đọc đổi kích thước. LUÔN về trang 1 (đơn
     * giản hoá chủ ý, xem comment đầu file). */
    _layoutAndRenderCurrentPage() {
        renderReaderMarkdown(documentReaderPages, this._currentMarkdown); // core/UI (Toast UI Viewer tạm, xem document-ui.js)
        if (documentReaderEmpty) documentReaderEmpty.classList.toggle('hidden', this._currentMarkdown.trim().length > 0);
        const { pageWidth, totalPages } = applyReaderPagination(documentReaderBody, documentReaderPages); // core/UI
        this._pageWidth = pageWidth;
        this._totalPages = totalPages;
        this._currentPageIndex = 0;
        this._updateNavUI();
    },

    _updateNavUI() {
        documentReaderPageIndicator.textContent = `${this._currentPageIndex + 1} / ${this._totalPages}`;
        btnDocumentReaderPrev.disabled = this._currentPageIndex <= 0;
        btnDocumentReaderNext.disabled = this._currentPageIndex >= this._totalPages - 1;
    },

    nextPage() {
        if (this._currentPageIndex >= this._totalPages - 1) return;
        this._currentPageIndex++;
        setReaderPageIndex(documentReaderPages, this._currentPageIndex, this._pageWidth); // core/UI
        this._updateNavUI();
    },

    prevPage() {
        if (this._currentPageIndex <= 0) return;
        this._currentPageIndex--;
        setReaderPageIndex(documentReaderPages, this._currentPageIndex, this._pageWidth); // core/UI
        this._updateNavUI();
    },

    /** FIX (04/07/2026, liên quan mục 1 phản hồi Giang — đảm bảo nội dung LUÔN được tách đoạn +
     * lưu đúng cách, không bị mất giữa chừng) — nếu đang ở chế độ Sửa (đặc biệt sau "Tạo tài liệu
     * mới", content vẫn đang RỖNG chờ lưu lần đầu), đóng thẳng theo cách cũ sẽ mất TOÀN BỘ nội dung
     * vừa gõ mà không hỏi gì. Giờ hỏi Lưu/Huỷ trước khi đóng thật. */
    close() {
        if (documentReaderEditMode && !documentReaderEditMode.classList.contains('hidden')) {
            modalChoice(
                t('documentReader.closeWhileEditingBody'),
                [
                    { label: t('documentReader.discardChanges'), className: 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors', onClick: () => this._closeNow() },
                    { label: t('common.save'), className: 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors', onClick: async () => { await this.saveEdit(); this._closeNow(); } },
                ],
            );
            return;
        }
        this._closeNow();
    },

    /** Phần đóng THẬT — tách riêng khỏi `close()` (Rule 1: "hỏi có cần lưu không" và "đóng thật" là
     * 2 việc khác nhau — dùng chung bởi cả 2 nhánh Lưu/Huỷ ở trên). Huỷ editor instance NẾU còn kẹt
     * (nhánh "Huỷ" ở `close()` không tự lưu nhưng vẫn phải destroy để tránh rò rỉ). */
    _closeNow() {
        if (this._editModeEditorInstance) { this._editModeEditorInstance.destroy(); this._editModeEditorInstance = null; }
        setDocumentReaderVisible(documentReaderOverlay, documentReaderWindow, false); // core/UI
        this._stopResizeWatcher();
        this._currentDocumentKey = null;
    },

    /** Gọi từ workflowFileManagerDocument.confirmDelete() — đóng Reader NẾU đang mở đúng tài liệu
     * vừa bị xoá (tránh hiện nội dung "ma" của tài liệu đã không còn tồn tại). */
    closeIfShowing(documentKey) {
        if (this._currentDocumentKey === documentKey) this.close();
    },

    /** Gọi từ workflowFileManagerDocument._renameFromDetail() (FIX 05/07/2026 — trước đây là
     * promptRename(), đã xoá) — cập nhật tiêu đề NGAY trên Reader nếu đang mở đúng tài liệu vừa
     * đổi tên. */
    refreshTitleIfOpen(documentKey, title) {
        if (this._currentDocumentKey === documentKey) documentReaderTitle.textContent = title;
    },

    /** MỚI (05/07/2026, mục 5 phản hồi Giang) — gọi từ workflowFileManagerDocument.openEditor()
     * (drawer Sửa mới trong File Manager) sau khi lưu — nếu Reader ĐANG mở ĐÚNG tài liệu vừa sửa
     * (2 nơi mở cùng lúc — hiếm nhưng có thể, xem comment đầu file), vẽ lại nội dung mới NGAY.
     * KHÔNG làm gì nếu Reader đang ở chế độ Sửa CỦA CHÍNH NÓ (tránh ghi đè bản đang gõ dở). */
    refreshContentIfOpen(documentKey, markdown) {
        if (this._currentDocumentKey !== documentKey) return;
        if (documentReaderEditMode && !documentReaderEditMode.classList.contains('hidden')) return;
        this._currentMarkdown = markdown;
        this._layoutAndRenderCurrentPage();
    },

    /** Ứng với nút Sửa (CHỈ hiện khi createdBy='user') — mount THẬT Toast UI Editor (WYSIWYG) vào
     * `#document-reader-edit-mount` (FIX 05/07/2026, mục 5 — thay `<textarea>` cũ, ĐỒNG BỘ với
     * `openDocumentEditorDrawer()`). */
    enterEditMode() {
        documentReaderEditMode.classList.remove('hidden');
        this._editModeEditorInstance = new toastui.Editor({
            el: documentReaderEditMount,
            height: '100%',
            initialEditType: 'wysiwyg',
            initialValue: this._currentMarkdown,
            usageStatistics: false,
        });
    },

    /** Huỷ editor instance KHÔNG lưu — quay lại chế độ đọc với nội dung CŨ (chưa sửa). */
    cancelEdit() {
        if (this._editModeEditorInstance) { this._editModeEditorInstance.destroy(); this._editModeEditorInstance = null; }
        documentReaderEditMode.classList.add('hidden');
    },

    /** Lưu nội dung Sửa — đọc Markdown từ editor instance, ghi DB, vẽ lại Reader + báo
     * workflowFileManagerDocument refresh (đề phòng drawer Documents đang mở phía sau). */
    async saveEdit() {
        if (!this._editModeEditorInstance) return;
        const markdown = this._editModeEditorInstance.getMarkdown();
        await updateDocumentContent(this._currentDocumentKey, markdown); // core
        this._editModeEditorInstance.destroy();
        this._editModeEditorInstance = null;
        this._currentMarkdown = markdown;
        documentReaderEditMode.classList.add('hidden');
        this._layoutAndRenderCurrentPage();
        if (typeof workflowFileManagerDocument !== 'undefined') await workflowFileManagerDocument.refresh();
    },

    /** ResizeObserver + debounce qua taskManager.once() (CHỈ Workflow được dùng taskManager, xem
     * readme/task-manager-conventions.md) — tránh layout lại liên tục lúc đang kéo resize cửa sổ. */
    _startResizeWatcher() {
        this._stopResizeWatcher();
        this._resizeObserver = new ResizeObserver(() => {
            taskManager.once(() => this._layoutAndRenderCurrentPage(), 150, DOCUMENT_READER_RELAYOUT_TASK);
        });
        this._resizeObserver.observe(documentReaderBody);
    },

    _stopResizeWatcher() {
        taskManager.kill(DOCUMENT_READER_RELAYOUT_TASK);
        if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    },
};
