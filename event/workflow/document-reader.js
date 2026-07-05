/**
 * event/workflow/document-reader.js — Workflow cụm "documentReader" (cửa sổ đọc tài liệu, mở từ
 * Control Center — components/document-reader.js).
 *
 * PHÂN TRANG: dùng core/file-manager/document-ui.js::applyReaderPagination() (CSS multi-column) —
 * gọi lại mỗi khi mở tài liệu MỚI, sửa xong lưu, HOẶC khung đọc đổi kích thước (ResizeObserver,
 * debounce qua taskManager.once() — CHỈ Workflow được dùng taskManager, xem
 * readme/task-manager-conventions.md). Đơn giản hoá CHỦ Ý: mỗi lần layout lại LUÔN về trang 1
 * (KHÔNG cố giữ đúng vị trí đọc cũ theo % nội dung — phức tạp không cần thiết cho tính năng này).
 *
 * NẠP SAU: core/file-manager/document.js, core/file-manager/document-ui.js, core/dom-refs.js,
 * service/task-manager.js. NẠP TRƯỚC: event/router/document-reader.js,
 * event/listener/document-reader.js. Cross-workflow: event/workflow/file-manager-document.js gọi
 * `workflowDocumentReader.openDocument()`/`closeIfShowing()`/`refreshTitleIfOpen()` (mở tài liệu từ
 * danh sách, đóng/cập nhật tiêu đề khi xoá/đổi tên) — Workflow được phép gọi Workflow khác tự do
 * (không bị Rule 3, rule đó CHỈ áp cho Core).
 */
const DOCUMENT_READER_RELAYOUT_TASK = 'documentReaderRelayout';

const workflowDocumentReader = {
    _currentDocumentKey: null,
    _currentParagraphs: [],
    _currentPageIndex: 0,
    _totalPages: 1,
    _pageWidth: 0,
    _resizeObserver: null,

    /** Ứng với bấm nút "Reader" trong Control Center (Visualizer) — entry point DUY NHẤT để mở
     * Reader từ bên ngoài drawer Documents. Mặc định: còn tài liệu đang mở từ trước (cùng phiên)
     * -> hiện lại đúng cái đó; chưa từng mở -> hiện tài liệu MỚI NHẤT (`listDocuments()` đã sort
     * `addedAt` giảm dần); chưa có tài liệu nào -> hiện trạng thái rỗng + gợi ý vào File Manager. */
    async openFromControlCenter() {
        if (this._currentDocumentKey) {
            setDocumentReaderVisible(documentReaderOverlay, documentReaderWindow, true); // core/UI
            this._startResizeWatcher();
            return;
        }
        const documents = await listDocuments(); // core
        if (documents.length === 0) {
            setDocumentReaderVisible(documentReaderOverlay, documentReaderWindow, true); // core/UI
            documentReaderTitle.textContent = t('documentReader.noDocuments');
            if (documentReaderEmpty) documentReaderEmpty.classList.remove('hidden');
            btnDocumentReaderEdit.classList.add('hidden');
            renderReaderParagraphs(documentReaderPages, []); // core/UI
            this._updateNavUI();
            return;
        }
        await this.openDocument(documents[0].key);
    },

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
        this._currentParagraphs = record.content;

        documentReaderTitle.textContent = record.title;
        btnDocumentReaderEdit.classList.toggle('hidden', record.createdBy !== 'user'); // CHỈ 'user' được sửa (đúng yêu cầu Giang)
        documentReaderEditMode.classList.add('hidden'); // phòng còn kẹt chế độ Sửa từ lần mở trước
        documentReaderListDropdown.classList.add('hidden');

        setDocumentReaderVisible(documentReaderOverlay, documentReaderWindow, true); // core/UI
        this._layoutAndRenderCurrentPage();
        this._startResizeWatcher();

        if (options && options.startInEdit) this.enterEditMode();
    },

    /** Vẽ lại toàn bộ đoạn văn + tính lại phân trang — gọi lúc mở tài liệu MỚI, sửa xong lưu, và
     * (debounce) mỗi khi khung đọc đổi kích thước. LUÔN về trang 1 (đơn giản hoá chủ ý, xem
     * comment đầu file). */
    _layoutAndRenderCurrentPage() {
        renderReaderParagraphs(documentReaderPages, this._currentParagraphs); // core/UI
        if (documentReaderEmpty) documentReaderEmpty.classList.toggle('hidden', this._currentParagraphs.length > 0);
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
     * 2 việc khác nhau — dùng chung bởi cả 2 nhánh Lưu/Huỷ ở trên). */
    _closeNow() {
        setDocumentReaderVisible(documentReaderOverlay, documentReaderWindow, false); // core/UI
        this._stopResizeWatcher();
        this._currentDocumentKey = null;
    },

    /** Gọi từ workflowFileManagerDocument.confirmDelete() — đóng Reader NẾU đang mở đúng tài liệu
     * vừa bị xoá (tránh hiện nội dung "ma" của tài liệu đã không còn tồn tại). */
    closeIfShowing(documentKey) {
        if (this._currentDocumentKey === documentKey) this.close();
    },

    /** Gọi từ workflowFileManagerDocument.promptRename() — cập nhật tiêu đề NGAY trên Reader nếu
     * đang mở đúng tài liệu vừa đổi tên. */
    refreshTitleIfOpen(documentKey, title) {
        if (this._currentDocumentKey === documentKey) documentReaderTitle.textContent = title;
    },

    /** Ứng với bấm nút mở/đóng dropdown chọn tài liệu ở header Reader. */
    async toggleListDropdown() {
        if (!documentReaderListDropdown.classList.contains('hidden')) {
            documentReaderListDropdown.classList.add('hidden');
            return;
        }
        const documents = await listDocuments(); // core
        renderDocumentReaderListDropdown(documentReaderListDropdown, documents, this._currentDocumentKey, (documentKey) => { // core/UI
            documentReaderListDropdown.classList.add('hidden');
            this.openDocument(documentKey);
        });
        documentReaderListDropdown.classList.remove('hidden');
    },

    /** Ứng với nút Sửa (CHỈ hiện khi createdBy='user') — thay khung phân trang bằng textarea, nối
     * các đoạn văn lại bằng dòng trống (đúng NGƯỢC lại splitPlainTextIntoParagraphs()). */
    enterEditMode() {
        documentReaderEditTextarea.value = this._currentParagraphs.join('\n\n');
        documentReaderEditMode.classList.remove('hidden');
        documentReaderEditTextarea.focus();
    },

    cancelEdit() {
        documentReaderEditMode.classList.add('hidden');
    },

    /** Lưu nội dung Sửa — tách lại thành mảng đoạn văn, ghi DB, vẽ lại Reader + báo
     * workflowFileManagerDocument refresh (đề phòng drawer Documents đang mở phía sau). */
    async saveEdit() {
        const paragraphs = splitPlainTextIntoParagraphs(documentReaderEditTextarea.value); // core
        await updateDocumentContent(this._currentDocumentKey, paragraphs); // core
        this._currentParagraphs = paragraphs;
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
