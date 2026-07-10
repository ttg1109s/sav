/**
 * event/workflow/file-manager-document.js — Workflow cụm "fileManagerDocument" (drawer Documents
 * trong File Manager). Mở/đóng drawer thuần (`showFileManagerDocumentDrawer`/`hide...`,
 * core/file-manager/nav.js) KHÔNG cần workflow — CHỈ những nghiệp vụ ≥2 bước (đọc DB + vẽ lại,
 * upload có xử lý mammoth.js + cảnh báo, tạo/xoá/đổi tên có modal xác nhận) mới ở đây.
 *
 * VIẾT LẠI (10/07/2026, Nhóm A — mục 1/12 plan-v12-extended.md): ĐỔI HƯỚNG LƯU TRỮ, content giờ là
 * HTML đã lọc whitelist (KHÔNG còn Markdown) — bỏ hẳn Turndown (CDN đã gỡ khỏi index.html):
 *   - `.docx`: mammoth.js -> HTML -> `sanitizeDocumentHtml()` (core/file-manager/document.js)
 *     TRỰC TIẾP — KHÔNG còn bước trung gian Turndown (HTML -> Markdown) nữa.
 *   - `.txt`: `buildDocumentHtmlFromPlainText()` (core/file-manager/document.js) — tách đoạn theo
 *     dòng trống (thuật toán CŨ hồi sinh lại), escape + bọc `<p>`.
 *   - `openEditor()`: `openDocumentEditorDrawer()` (core/file-manager/document-ui.js) giờ mount
 *     `buildDocumentEditorSurface()` (contentEditable + toolbar tự viết) THAY Toast UI Editor —
 *     `onSave` nhận thẳng HTML đã sanitize (KHÔNG cần Turndown/`editor.getMarkdown()` nữa).
 *   - `openDetail()`: `onDownload` dùng `downloadDocumentAsHtml()` (đổi tên từ
 *     `downloadDocumentAsMarkdown()` cũ) + `resolveDocumentHtml()` (đổi tên từ
 *     `resolveDocumentMarkdown()` cũ).
 *
 * NẠP SAU: core/file-manager/document.js, core/file-manager/document-ui.js, core/settings-panel-
 * stack.js (pushSettingsPanel).
 *
 * === Batch D7 (Settings restructure, 06/07/2026 — batch CUỐI của Nhóm D) ===
 * Panel Document giờ push/pop động — `fileManagerDocumentPanelEl` (biến module, cùng pattern đã
 * dùng ở Song/Photo/Slideshow) lưu panel đang mở. `core/file-manager/document-ui.js` KHÔNG cần
 * đổi GÌ CẢ — `renderDocumentList()` đã nhận `containerEl` qua tham số từ trước;
 * `openDocumentDetailModal()`/`openDocumentEditorDrawer()`/`openCreateDocumentModal()` đều tự dựng
 * overlay ĐỘC LẬP (`document.body.appendChild`), không phụ thuộc panel — giống hệt các modal ở
 * Photo (Batch D6).
 */
let fileManagerDocumentPanelEl = null; // panel Document đang mở — null nếu đang đóng (Batch D7)

const workflowFileManagerDocument = {

    /** Ứng với 'fileManagerDocument.openPanel.click' — push panel + vẽ lại danh sách. */
    async openPanel() {
        fileManagerDocumentPanelEl = pushSettingsPanel({ title: t('fileManager.document.title'), bodyHtml: renderFileManagerDocumentPanelBody() });
        await this.refresh();
    },

    /** Vẽ lại danh sách document — gọi lúc mở panel + sau mỗi lần thêm/xoá/đổi tên. */
    async refresh() {
        if (!fileManagerDocumentPanelEl) return; // guard: panel đã đóng
        const documents = await listDocuments(); // core (core/file-manager/document.js)
        const emptyEl = fileManagerDocumentPanelEl.querySelector('#file-manager-document-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', documents.length > 0);
        renderDocumentList(fileManagerDocumentPanelEl.querySelector('#file-manager-document-list'), documents, (doc) => this.openDetail(doc)); // core/file-manager/document-ui.js
    },

    /**
     * Mở modal "Chi tiết tài liệu" cho 1 hàng vừa bấm — `doc` là record ĐẦY ĐỦ đã có sẵn từ
     * `listDocuments()` (kể cả `content`), KHÔNG cần đọc lại DB.
     * @param {{key: string, title: string, format: string, createdBy: string, content: string|string[]}} doc
     */
    openDetail(doc) {
        openDocumentDetailModal(doc, { // core/file-manager/document-ui.js
            onRename: (title) => this._renameFromDetail(doc.key, title),
            onDelete: () => this.confirmDelete(doc.key),
            onEdit: () => this.openEditor(doc),
            onDownload: () => downloadDocumentAsHtml(doc, resolveDocumentHtml(doc)), // core/file-manager/document-ui.js + document.js
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

    /** Ứng với icon "Sửa" trong modal chi tiết (chỉ hiện khi `createdBy==='user'`) — mở
     * `openDocumentEditorDrawer()` (core/file-manager/document-ui.js), KHÔNG đụng
     * `workflowDocumentReader`/Settings. Nhận thẳng `doc` (đã có sẵn từ `openDetail()`, không cần
     * đọc lại DB). `onSave` nhận HTML đã `sanitizeDocumentHtml()` sẵn (xem
     * `buildDocumentEditorSurface().getHtml()`) — bấm X trong drawer đó tự lưu, KHÔNG có nút Lưu
     * riêng (đúng yêu cầu Giang "chỉ tên file + nút đóng").
     * @param {{key: string, title: string, format: string, content: string|string[]}} doc
     */
    openEditor(doc) {
        openDocumentEditorDrawer(doc, { // core/file-manager/document-ui.js
            onSave: async (html) => {
                await updateDocumentContent(doc.key, html); // core
                if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshContentIfOpen(doc.key, html);
            },
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
     * là "tiến trình xử lý file" (Rule 1), khác "tiến trình hỏi xác nhận" ở trên.
     * VIẾT LẠI (10/07/2026, Nhóm A) — mammoth.js -> HTML -> `sanitizeDocumentHtml()`
     * (core/file-manager/document.js) TRỰC TIẾP, THAY Turndown cũ (HTML -> Markdown, ĐÃ GỠ khỏi
     * index.html) — giữ được đậm/nghiêng/tiêu đề/danh sách (mất ảnh/bảng/định dạng phức tạp khác,
     * đúng cảnh báo docxWarningBody). Gọi `mammoth` TRỰC TIẾP ở đây, KHÔNG wrap qua core — thư viện
     * ngoài, coi là dịch vụ giống mammoth trước đây từng dùng chung Turndown. */
    async _processDocxUpload(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = sanitizeDocumentHtml(result.value); // core/file-manager/document.js
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.docx$/i, ''),
                content: html,
                format: 'docx',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Nhánh .txt — đọc thẳng, chuyển qua `buildDocumentHtmlFromPlainText()`
     * (core/file-manager/document.js, VIẾT LẠI 10/07/2026 Nhóm A) — tách đoạn theo dòng trống,
     * escape + bọc `<p>`. */
    async _handleUploadTxt(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const text = await file.text();
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.txt$/i, ''),
                content: buildDocumentHtmlFromPlainText(text), // core/file-manager/document.js
                format: 'txt',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Ứng với "Tạo tài liệu mới" — hỏi tiêu đề, tạo record RỖNG (createdBy='user'), mở THẲNG
     * `openEditor()` (drawer Sửa MỚI — đúng yêu cầu Giang, không cần vào rồi bấm Sửa thêm 1 bước).
     * `content: ''` (chuỗi rỗng — hợp lệ với cả Markdown trước đây lẫn HTML bây giờ, không cần đổi
     * gì thêm ở đây). */
    async createNewDocument() {
        openCreateDocumentModal(async (title) => { // core/file-manager/document-ui.js
            const filename = `${title}.txt`;
            const documentKey = await resolveDocumentKey(filename); // core
            await saveDocumentRecord(documentKey, { // core
                filename, title, content: '', format: 'txt', createdBy: 'user',
            });
            await this.refresh();
            this.openEditor({ key: documentKey, title, format: 'txt', content: '' });
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
