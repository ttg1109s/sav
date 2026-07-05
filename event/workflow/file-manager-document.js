/**
 * event/workflow/file-manager-document.js — Workflow cụm "fileManagerDocument" (drawer Documents
 * trong File Manager). Mở/đóng drawer thuần (`showFileManagerDocumentDrawer`/`hide...`,
 * core/file-manager/nav.js) KHÔNG cần workflow — CHỈ những nghiệp vụ ≥2 bước (đọc DB + vẽ lại,
 * upload có xử lý mammoth.js + cảnh báo, tạo/xoá/đổi tên có modal xác nhận) mới ở đây.
 *
 * FIX (05/07/2026, mục 1/2 phản hồi Giang — 2 lỗi UI Documents): menu "..." (Đổi tên/Xoá) bị chồng
 * lấn layout trên hàng danh sách — BỎ HẲN; tài liệu tự tạo không có lối vào Sửa — bấm vào hàng giờ
 * mở `openDocumentDetailModal()` (core/file-manager/document-ui.js) thay vì no-op như trước.
 * `promptRename()` cũ (mở modal riêng) đã XOÁ, đổi tên giờ NGAY TẠI CHỖ trong modal chi tiết, xem
 * `openDetail()`/`_renameFromDetail()` dưới đây. **Lưu ý z-index** — nút Sửa trong modal chi tiết
 * mở `workflowDocumentReader` (`#document-reader-window` z-40), THẤP HƠN HẲN cả
 * `#drawer-file-manager-document` (z-90) LẪN `#drawer-settings` (z-80) đang mở phía sau — PHẢI tự
 * đóng cả 2 TRƯỚC khi mở Reader, nếu không Reader sẽ bị che khuất hoàn toàn (đúng lý do batch
 * trước từng cố tình tắt hẳn "bấm hàng mở Reader", xem git blame `refresh()`).
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
     * FIX (05/07/2026, mục 1/2 phản hồi Giang) — bấm vào hàng giờ mở `openDetail()` (modal chi
     * tiết: icon lớn + tên/dung lượng + Xoá/Sửa hoặc Tải về) — THAY HẲN no-op cũ (batch 04/07/2026
     * từng cố tình tắt hẳn vì lý do z-index Reader, xem đầu file). Đọc tài liệu (phân trang, lật
     * trang) vẫn CHỈ qua nút "Reader" ở Control Center -> drawer picker riêng
     * (event/workflow/document-picker.js) — modal chi tiết này KHÔNG phải Reader. */
    async refresh() {
        const documents = await listDocuments(); // core (core/file-manager/document.js)
        if (fileManagerDocumentEmpty) fileManagerDocumentEmpty.classList.toggle('hidden', documents.length > 0);
        renderDocumentList(fileManagerDocumentList, documents, (doc) => this.openDetail(doc)); // core/file-manager/document-ui.js
    },

    /**
     * Mở modal "Chi tiết tài liệu" cho 1 hàng vừa bấm — `doc` là record ĐẦY ĐỦ đã có sẵn từ
     * `listDocuments()` (kể cả `content`), KHÔNG cần đọc lại DB.
     * @param {{key: string, title: string, format: string, createdBy: string, content: string[]}} doc
     */
    openDetail(doc) {
        openDocumentDetailModal(doc, { // core/file-manager/document-ui.js
            onRename: (title) => this._renameFromDetail(doc.key, title),
            onDelete: () => this.confirmDelete(doc.key),
            onEdit: () => this._openReaderForEdit(doc.key),
            onDownload: () => downloadDocumentAsText(doc), // core/file-manager/document-ui.js
        });
    },

    /** Đổi tên NGAY từ modal chi tiết — thay `promptRename()` cũ (từng mở modal riêng, đọc lại
     * `listDocuments()` để lấy title hiện tại; modal chi tiết giờ đã có sẵn `doc.title`, không cần
     * đọc lại). */
    async _renameFromDetail(documentKey, title) {
        await renameDocumentTitle(documentKey, title); // core
        await this.refresh();
        if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshTitleIfOpen(documentKey, title);
    },

    /** Ứng với icon "Sửa" trong modal chi tiết (chỉ hiện khi `createdBy==='user'`) — PHẢI đóng cả
     * `#drawer-file-manager-document` (z-90) LẪN `#drawer-settings` (z-80) TRƯỚC khi mở Reader
     * (`#document-reader-window` z-40) — Reader thấp hơn hẳn 2 drawer này, mở Reader mà không đóng
     * chúng sẽ khiến Reader bị che khuất hoàn toàn (xem comment z-index đầu file). */
    _openReaderForEdit(documentKey) {
        hideFileManagerDocumentDrawer(); // core (core/file-manager/nav.js)
        closeSettingsDrawer(); // core (core/player-controls.js)
        if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.openDocument(documentKey, { startInEdit: true });
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

    /** Ứng với icon "Xoá" trong modal chi tiết — xác nhận trước, đóng luôn Reader nếu đang mở đúng
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
