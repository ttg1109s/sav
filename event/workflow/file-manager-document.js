/**
 * event/workflow/file-manager-document.js — Workflow cụm "fileManagerDocument" (drawer Documents
 * trong File Manager). Mở/đóng drawer thuần (`showFileManagerDocumentDrawer`/`hide...`,
 * core/file-manager/nav.js) KHÔNG cần workflow — CHỈ những nghiệp vụ ≥2 bước (đọc DB + vẽ lại,
 * upload có xử lý mammoth.js + cảnh báo, tạo/xoá/đổi tên có modal xác nhận) mới ở đây.
 *
 * FIX (05/07/2026, mục 1/2/3/4 phản hồi Giang — sửa tiếp các lỗi UI Documents):
 *   1. Menu "..." (Đổi tên/Xoá) bị chồng lấn layout trên hàng danh sách — BỎ HẲN.
 *   2. Bấm hàng giờ mở `openDocumentDetailModal()` (core/file-manager/document-ui.js) — icon lớn +
 *      tên/dung lượng + hàng icon Đổi tên/Tải về (CẢ 2 loại)/Sửa (chỉ 'user')/Xoá.
 *   3. "Sửa" (chỉ `createdBy==='user'`) — **VIẾT LẠI HOÀN TOÀN** sau phản hồi Giang lần 2: bản đầu
 *      (đóng Settings rồi mở `workflowDocumentReader`) SAI — gây mở chồng Reader + modal khác cùng
 *      lúc. Giờ mở `openDocumentEditorDrawer()` — 1 drawer RIÊNG, full-view, trượt NGANG, nằm
 *      TRÊN `#drawer-file-manager-document` theo đúng nav-stack sẵn có (z-[91] > z-[90], giống
 *      Folder Detail), KHÔNG đụng Settings/Reader.
 *   4. Thêm hẳn icon "Đổi tên" tường minh trong modal chi tiết (trước đó chỉ bấm vào tên, dễ bị bỏ
 *      sót) — cả 2 cách đều mở cùng 1 editor tên tại chỗ.
 * `promptRename()` cũ (mở modal riêng) đã XOÁ TỪ TRƯỚC, đổi tên NGAY TẠI CHỖ trong modal chi tiết,
 * xem `_renameFromDetail()` dưới đây.
 *
 * CẬP NHẬT TIẾP (05/07/2026, mục 5 phản hồi Giang — đã chốt "Markdown + WYSIWYG format ngay khi
 * gõ, dùng thư viện ngoài"): `openEditor()` mount THẬT **Toast UI Editor** qua
 * `openDocumentEditorDrawer()` (CDN `toastui-editor-all.min.js`), bấm X trong drawer đó tự LƯU
 * (đọc `editor.getMarkdown()`) rồi mới đóng — KHÔNG có nút Lưu riêng. `createNewDocument()` ĐỒNG BỘ
 * dùng CHUNG `openEditor()` (trước đây mở `workflowDocumentReader`, dính đúng lỗi z-index y hệt mục
 * 2/3 nhưng chưa ai bấm thử ra). Upload `.docx` đổi từ tự tách đoạn plaintext (MẤT hết định dạng)
 * sang mammoth.js -> HTML -> **Turndown** (CDN `turndown.js`) -> Markdown (GIỮ đậm/nghiêng/tiêu
 * đề/danh sách). Upload `.txt` dùng NGUYÊN VĂN làm Markdown (bỏ hẳn tách đoạn bằng regex).
 *
 * UPLOAD (mục 1/2/3 phản hồi Giang — tính năng Documents):
 *   - 2 luồng TÁCH RIÊNG (KHÔNG dùng chung upload bài hát di sản — không đụng
 *     core/playlist/actions.js): `handleUploadFile()` (chọn .txt/.docx có sẵn) và
 *     `createNewDocument()` (.txt rỗng, mở thẳng Editor ở chế độ Sửa).
 *   - `.docx`: LUÔN cảnh báo (modalChoice) TRƯỚC khi xử lý — đồng ý mới đọc file (mammoth.js -> HTML
 *     -> Turndown -> Markdown, xem `_processDocxUpload()`). `.txt`: đọc thẳng, dùng nguyên văn làm
 *     Markdown — KHÔNG cảnh báo (không mất gì).
 *   - `filename` LƯU NGUYÊN tên gốc (giữ đuôi .docx/.txt) dù `content` luôn là 1 chuỗi Markdown.
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
     * @param {{key: string, title: string, format: string, createdBy: string, content: string[]}} doc
     */
    openDetail(doc) {
        openDocumentDetailModal(doc, { // core/file-manager/document-ui.js
            onRename: (title) => this._renameFromDetail(doc.key, title),
            onDelete: () => this.confirmDelete(doc.key),
            onEdit: () => this.openEditor(doc),
            onDownload: () => downloadDocumentAsMarkdown(doc, resolveDocumentMarkdown(doc)), // core/file-manager/document-ui.js + document.js
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
     * `workflowDocumentReader`/Settings (FIX 05/07/2026, mục 2/3 phản hồi Giang — bản trước SAI vì
     * đóng hẳn Settings rồi mở Reader, gây mở chồng 2 thứ cùng lúc). Nhận thẳng `doc` (đã có sẵn từ
     * `openDetail()`, không cần đọc lại DB). `onSave` ghi Markdown lấy từ `editor.getMarkdown()`
     * (mục 5 phản hồi Giang — Toast UI Editor) — bấm X trong drawer đó tự lưu, KHÔNG có nút Lưu
     * riêng (đúng yêu cầu Giang "chỉ tên file + nút đóng").
     * @param {{key: string, title: string, format: string, content: string|string[]}} doc
     */
    openEditor(doc) {
        openDocumentEditorDrawer(doc, { // core/file-manager/document-ui.js
            onSave: async (markdown) => {
                await updateDocumentContent(doc.key, markdown); // core
                if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshContentIfOpen(doc.key, markdown);
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
     * FIX (05/07/2026, mục 5 phản hồi Giang) — mammoth.js -> HTML -> **Turndown** (HTML->Markdown,
     * CDN `turndown.js`, xem index.html) THAY `extractParagraphsFromDocxHtml()` cũ (ĐÃ XOÁ) — giữ
     * được đậm/nghiêng/tiêu đề/danh sách (trước đây mất HẾT định dạng). Gọi `TurndownService` TRỰC
     * TIẾP ở đây, KHÔNG wrap qua core, giống hệt cách gọi `mammoth` — cả 2 đều là thư viện ngoài
     * (dịch vụ), không phải "hàm core khác". */
    async _processDocxUpload(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const markdown = new TurndownService().turndown(result.value); // thư viện ngoài — HTML -> Markdown
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.docx$/i, ''),
                content: markdown,
                format: 'docx',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Nhánh .txt — đọc thẳng, dùng NGUYÊN VĂN làm Markdown (FIX 05/07/2026, mục 5 phản hồi Giang —
     * bỏ hẳn `splitPlainTextIntoParagraphs()`, text thuần vốn đã là Markdown hợp lệ — không cú
     * pháp đặc biệt thì Toast UI Editor/Viewer hiển thị y hệt text thường, không cần tự tách đoạn). */
    async _handleUploadTxt(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const text = await file.text();
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.txt$/i, ''),
                content: text,
                format: 'txt',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Ứng với "Tạo tài liệu mới" — hỏi tiêu đề, tạo record RỖNG (createdBy='user'), mở THẲNG
     * `openEditor()` (drawer Sửa MỚI — đúng yêu cầu Giang, không cần vào rồi bấm Sửa thêm 1 bước).
     * FIX (05/07/2026) — TRƯỚC ĐÂY mở `workflowDocumentReader` (Reader ở Control Center), dính
     * ĐÚNG lỗi z-index y hệt mục 2/3 phản hồi Giang (Reader z-40 bị che sau Documents drawer z-90 —
     * chưa từng lộ ra vì chưa ai bấm thử) — giờ đồng bộ dùng CHUNG `openEditor()`/
     * `openDocumentEditorDrawer()` với nút "Sửa" trong modal chi tiết, không còn 2 đường khác nhau
     * cho cùng 1 việc. `content: ''` (chuỗi rỗng — mục 5, KHÔNG còn `[]`). */
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
