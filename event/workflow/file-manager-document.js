/**
 * event/workflow/file-manager-document.js — Workflow cụm "fileManagerDocument" (drawer Documents
 * trong File Manager). Mở/đóng drawer thuần (`showFileManagerDocumentDrawer`/`hide...`,
 * core/file-manager/nav.js) KHÔNG cần workflow — CHỈ những nghiệp vụ ≥2 bước (đọc DB + vẽ lại,
 * upload có xử lý mammoth.js + cảnh báo, tạo/xoá/đổi tên có modal xác nhận) mới ở đây.
 *
 * UPLOAD (mục 1/2/3 phản hồi Giang — tính năng Documents):
 *   - 2 luồng TÁCH RIÊNG (KHÔNG dùng chung upload bài hát di sản — không đụng
 *     core/playlist/actions.js): `handleUploadFile()` (chọn .txt/.docx có sẵn) và
 *     `createNewDocument()` (.txt rỗng, mở thẳng Reader ở chế độ Sửa).
 *   - `.docx`: LUÔN cảnh báo mất định dạng (modalChoice) TRƯỚC khi xử lý — đồng ý mới đọc file
 *     (mammoth.js -> HTML -> tách đoạn theo thẻ <p>, core/file-manager/document.js::
 *     extractParagraphsFromDocxHtml). `.txt`: đọc thẳng, tách đoạn theo dòng trống
 *     (splitPlainTextIntoParagraphs) — KHÔNG cảnh báo (vốn đã là text thuần, không mất gì).
 *   - `filename` LƯU NGUYÊN tên gốc (giữ đuôi .docx/.txt) dù `content` luôn là mảng text thuần.
 *
 * NẠP SAU: core/file-manager/document.js, core/file-manager/document-ui.js, core/dom-refs.js,
 * core/file-manager/nav.js (showFileManagerDocumentDrawer). NẠP TRƯỚC:
 * event/router/file-manager-document.js, event/listener/file-manager-document.js.
 */
const workflowFileManagerDocument = {

    /** Ứng với 'fileManagerDocument.open' — mở drawer + vẽ lại danh sách. */
    async openDrawer() {
        showFileManagerDocumentDrawer(); // core (core/file-manager/nav.js)
        await this.refresh();
    },

    /** Vẽ lại danh sách document — gọi lúc mở drawer + sau mỗi lần thêm/xoá/đổi tên.
     * FIX (04/07/2026, mục 3 phản hồi Giang) — bấm vào hàng KHÔNG còn mở Reader nữa (File Manager
     * -> Documents CHỈ có tác dụng CRUD — upload/tạo/đổi tên/xoá qua menu "...". Đọc tài liệu CHỈ
     * qua nút "Reader" ở Control Center -> drawer picker riêng, xem
     * event/workflow/document-picker.js). */
    async refresh() {
        const documents = await listDocuments(); // core (core/file-manager/document.js)
        if (fileManagerDocumentEmpty) fileManagerDocumentEmpty.classList.toggle('hidden', documents.length > 0);
        renderDocumentList(fileManagerDocumentList, documents, () => {}, (documentKey, action) => { // core/file-manager/document-ui.js — onOpen = no-op (chỉ CRUD)
            if (action === 'rename') this.promptRename(documentKey);
            else if (action === 'delete') this.confirmDelete(documentKey);
        });
    },

    /**
     * Ứng với chọn file ở input `#file-manager-document-upload-input`. Validate đuôi file, tách
     * nhánh .docx (cảnh báo + mammoth.js) / .txt (đọc thẳng) — 2 TIẾN TRÌNH KHÁC NHAU thật sự,
     * không gộp chung 1 if/else nông cạn vì .docx cần thêm bước xác nhận + thư viện ngoài.
     * @param {File} file
     */
    async handleUploadFile(file) {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.docx')) {
            await this._handleUploadDocx(file);
        } else if (lowerName.endsWith('.txt') || file.type === 'text/plain') {
            await this._handleUploadTxt(file);
        } else {
            await alertModal(t('fileManager.document.invalidType'));
        }
    },

    /** Nhánh .docx — CẢNH BÁO mất định dạng TRƯỚC, đồng ý mới đọc + xử lý qua mammoth.js. */
    async _handleUploadDocx(file) {
        modalChoice(
            t('fileManager.document.docxWarningBody'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.document.docxWarningConfirm'), className: 'flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold transition-colors', onClick: () => this._processDocxUpload(file) },
            ],
            { title: t('fileManager.document.docxWarningTitle') },
        );
    },

    /** Đọc + lưu THẬT (sau khi đã đồng ý cảnh báo) — tách riêng khỏi `_handleUploadDocx()` vì đây
     * là "tiến trình xử lý file" (Rule 1), khác "tiến trình hỏi xác nhận" ở trên. */
    async _processDocxUpload(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const paragraphs = extractParagraphsFromDocxHtml(result.value); // core (core/file-manager/document.js)
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.docx$/i, ''),
                content: paragraphs,
                format: 'docx',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Nhánh .txt — đọc thẳng, KHÔNG cảnh báo (vốn đã là text thuần). */
    async _handleUploadTxt(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const text = await file.text();
            const paragraphs = splitPlainTextIntoParagraphs(text); // core
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.txt$/i, ''),
                content: paragraphs,
                format: 'txt',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Ứng với "Tạo tài liệu mới" — hỏi tiêu đề, tạo record RỖNG (createdBy='user'), mở THẲNG
     * Reader ở chế độ Sửa (đúng yêu cầu Giang — không cần vào Reader rồi bấm Sửa thêm 1 bước). */
    async createNewDocument() {
        openCreateDocumentModal(async (title) => { // core/file-manager/document-ui.js
            const filename = `${title}.txt`;
            const documentKey = await resolveDocumentKey(filename); // core
            await saveDocumentRecord(documentKey, { // core
                filename, title, content: [], format: 'txt', createdBy: 'user',
            });
            await this.refresh();
            if (typeof workflowDocumentReader !== 'undefined') await workflowDocumentReader.openDocument(documentKey, { startInEdit: true });
        });
    },

    /** Ứng với "Đổi tên" ở menu "..." của 1 hàng. */
    promptRename(documentKey) {
        listDocuments().then((documents) => { // core — cần lấy title hiện tại làm giá trị input ban đầu
            const doc = documents.find((d) => d.key === documentKey);
            if (!doc) return;
            openRenameDocumentModal(doc.title, async (title) => { // core/file-manager/document-ui.js
                await renameDocumentTitle(documentKey, title); // core
                await this.refresh();
                if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshTitleIfOpen(documentKey, title);
            });
        });
    },

    /** Ứng với "Xoá" ở menu "..." của 1 hàng — xác nhận trước, đóng luôn Reader nếu đang mở đúng
     * tài liệu đó. */
    confirmDelete(documentKey) {
        modalChoice(
            t('fileManager.document.deleteConfirmBody'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.document.btnDelete'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteDocument(documentKey); // core
                    if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.closeIfShowing(documentKey);
                    await this.refresh();
                } },
            ],
            { title: t('fileManager.document.deleteConfirmTitle') },
        );
    },
};
