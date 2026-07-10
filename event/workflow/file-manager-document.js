/**
 * event/workflow/file-manager-document.js — Workflow cụm "fileManagerDocument" (drawer Documents
 * trong File Manager). Mở/đóng drawer thuần (`showFileManagerDocumentDrawer`/`hide...`,
 * core/file-manager/nav.js) KHÔNG cần workflow — CHỈ những nghiệp vụ ≥2 bước mới ở đây.
 *
 * SIẾT LẠI HOÀN TOÀN (10/07/2026, sau phản hồi Giang — xem docstring đầu core/file-manager/
 * document-ui.js để biết lý do đầy đủ): mọi modal/drawer của Documents giờ ĐƯỢC MOUNT + WIRE Ở
 * ĐÂY, KHÔNG còn ở core/file-manager/document-ui.js nữa (file đó giờ CHỈ dựng cây DOM tĩnh, trả
 * về CHƯA mount/CHƯA gắn sự kiện). Workflow này CŨNG là nơi DUY NHẤT phối hợp gọi
 * core/file-manager/document.js (resolveDocumentHtml/sanitizeDocumentHtml/
 * convertDocumentHtmlToPlainText/splitPlainTextIntoParagraphs) VỚI core/file-manager/
 * document-ui.js (buildDocumentXxx) — 2 core file đó KHÔNG được gọi lẫn nhau (Rule 3), nên việc
 * phối hợp thứ tự luôn thuộc về Workflow.
 *
 * CONTENT MODEL (SỬA lại sau phản hồi Giang — bản đầu Nhóm A hiểu sai): `.txt` upload KHÔNG
 * markup -> lưu THẲNG `string[]` (splitPlainTextIntoParagraphs(), KHÔNG convert sang HTML lúc
 * lưu). `.docx` (mammoth.js) VÀ tài liệu `createdBy==='user'` (mọi lần Sửa) -> lưu `string` HTML
 * đã sanitizeDocumentHtml(). Tải về LUÔN ra `.txt` (downloadDocumentAsText(), KHÔNG phải .html) —
 * convertDocumentHtmlToPlainText() quy HTML về lại cú pháp kiểu-Markdown tương ứng
 * (`<h3>` -> "### ", `<b>` -> "**x**"...), round-trip với .txt thuần (không thẻ gì ngoài `<p>`)
 * cho lại ĐÚNG NGUYÊN VĂN.
 *
 * NẠP SAU: core/file-manager/document.js, core/file-manager/document-ui.js, core/settings-panel-
 * stack.js (pushSettingsPanel).
 *
 * === Batch D7 (Settings restructure, 06/07/2026) ===
 * Panel Document push/pop động — `fileManagerDocumentPanelEl` (biến module) lưu panel đang mở.
 */
let fileManagerDocumentPanelEl = null; // panel Document đang mở — null nếu đang đóng (Batch D7)

const workflowFileManagerDocument = {

    /** Ứng với 'fileManagerDocument.openPanel.click' — push panel + vẽ lại danh sách. */
    async openPanel() {
        fileManagerDocumentPanelEl = pushSettingsPanel({ title: t('fileManager.document.title'), bodyHtml: renderFileManagerDocumentPanelBody() });
        await this.refresh();
    },

    /** Vẽ lại danh sách document — gọi lúc mở panel + sau mỗi lần thêm/xoá/đổi tên. Render (core,
     * thuần) rồi TỰ wire click từng hàng ở đây (core không còn addEventListener nữa). */
    async refresh() {
        if (!fileManagerDocumentPanelEl) return; // guard: panel đã đóng
        const documents = await listDocuments(); // core
        const emptyEl = fileManagerDocumentPanelEl.querySelector('#file-manager-document-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', documents.length > 0);
        const listEl = fileManagerDocumentPanelEl.querySelector('#file-manager-document-list');
        renderDocumentList(listEl, documents); // core/file-manager/document-ui.js — render thuần, không gắn sự kiện
        listEl.querySelectorAll('.file-manager-document-row').forEach((rowEl) => {
            const doc = documents.find((d) => d.key === rowEl.dataset.documentKey);
            if (doc) rowEl.addEventListener('click', () => this.openDetail(doc));
        });
    },

    /**
     * Mở modal "Chi tiết tài liệu" — dựng qua core, mount + wire TOÀN BỘ ở đây. `doc` là record
     * ĐẦY ĐỦ đã có sẵn từ `listDocuments()` (kể cả `content`), KHÔNG cần đọc lại DB.
     * @param {{key: string, title: string, format: string, createdBy: string, content: string|string[]}} doc
     */
    openDetail(doc) {
        const html = resolveDocumentHtml(doc); // core/file-manager/document.js
        const sizeText = formatDocumentSize(computeDocumentSizeBytes(html)); // core/file-manager/document-ui.js x2

        const stale = document.getElementById('document-detail-modal-overlay');
        if (stale) stale.remove();
        const overlay = buildDocumentDetailModal(doc, sizeText); // core/file-manager/document-ui.js
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        overlay.querySelector('#document-detail-modal-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        const nameDisplay = overlay.querySelector('#document-detail-name-display');
        const nameEditor = overlay.querySelector('#document-detail-name-editor');
        const nameBtn = overlay.querySelector('#document-detail-name-btn');
        const nameInput = overlay.querySelector('#document-detail-name-input');

        const showNameEditor = () => {
            nameDisplay.classList.add('hidden');
            nameEditor.classList.remove('hidden');
            nameInput.value = doc.title;
            nameInput.focus();
            nameInput.select();
        };
        const showNameDisplay = () => {
            nameEditor.classList.add('hidden');
            nameDisplay.classList.remove('hidden');
        };

        nameBtn.addEventListener('click', showNameEditor);
        overlay.querySelector('#document-detail-btn-rename').addEventListener('click', showNameEditor);
        overlay.querySelector('#document-detail-name-cancel').addEventListener('click', showNameDisplay);
        overlay.querySelector('#document-detail-name-save').addEventListener('click', () => {
            const value = nameInput.value.trim();
            if (value && value !== doc.title) {
                doc.title = value;
                nameBtn.textContent = `${doc.title}.${doc.format}`;
                this._renameFromDetail(doc.key, value);
            }
            showNameDisplay();
        });

        overlay.querySelector('#document-detail-btn-download').addEventListener('click', () => {
            closeModal();
            downloadDocumentAsText(doc, convertDocumentHtmlToPlainText(html)); // document-ui.js + document.js
        });

        const editBtn = overlay.querySelector('#document-detail-btn-edit');
        if (editBtn) editBtn.addEventListener('click', () => { closeModal(); this.openEditor(doc); });

        overlay.querySelector('#document-detail-btn-delete').addEventListener('click', () => { closeModal(); this.confirmDelete(doc.key); });
    },

    /** Đổi tên NGAY từ modal chi tiết — cập nhật DB + vẽ lại danh sách + báo Reader nếu đang mở
     * đúng tài liệu đó. */
    async _renameFromDetail(documentKey, title) {
        await renameDocumentTitle(documentKey, title); // core
        await this.refresh();
        if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshTitleIfOpen(documentKey, title);
    },

    /**
     * Ứng với icon "Sửa" trong modal chi tiết (chỉ hiện khi `createdBy==='user'`) — dựng khung
     * Drawer Sửa + surface soạn thảo qua core, mount + wire TOÀN BỘ ở đây (bấm X = LƯU LUÔN rồi
     * mới đóng, KHÔNG có nút Lưu riêng).
     * @param {{key: string, title: string, format: string, content: string|string[]}} doc
     */
    openEditor(doc) {
        const initialHtml = resolveDocumentHtml(doc); // core/file-manager/document.js

        const stale = document.getElementById('document-editor-drawer-overlay');
        if (stale) stale.remove();
        const overlay = buildDocumentEditorDrawer(doc); // core/file-manager/document-ui.js
        document.body.appendChild(overlay);
        void overlay.offsetHeight; // ép reflow trước khi bỏ translate-x-full — đảm bảo transition chạy
        overlay.classList.remove('translate-x-full');

        const bodyEl = overlay.querySelector('#document-editor-drawer-body');
        const surfaceEl = buildDocumentEditorSurface(initialHtml); // core/file-manager/document-ui.js
        bodyEl.appendChild(surfaceEl);
        const editorApi = wireDocumentEditorToolbar(surfaceEl); // event/workflow/document-reader.js — helper dùng chung
        editorApi.focus();

        let closed = false;
        const closeAndSave = async () => {
            if (closed) return;
            closed = true;
            const html = editorApi.getHtml();
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            overlay.classList.add('translate-x-full');
            await updateDocumentContent(doc.key, html); // core
            if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshContentIfOpen(doc.key, html);
        };
        overlay.querySelector('#document-editor-drawer-close').addEventListener('click', closeAndSave);
    },

    /**
     * Ứng với chọn file ở input `#file-manager-document-upload-input`. Validate đuôi file, tách
     * nhánh .docx (cảnh báo + mammoth.js) / .txt (đọc thẳng) — 2 TIẾN TRÌNH KHÁC NHAU thật sự.
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

    /** Đọc + lưu THẬT (sau khi đã đồng ý cảnh báo) — mammoth.js -> HTML -> sanitizeDocumentHtml()
     * (core/file-manager/document.js) TRỰC TIẾP, LƯU DẠNG HTML (`.docx` là 1 trong 2 trường hợp
     * DUY NHẤT tạo HTML lúc lưu, xem docstring đầu file). Gọi `mammoth` TRỰC TIẾP ở đây — thư viện
     * ngoài, không phải core. */
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

    /** Nhánh .txt — đọc thẳng, tách đoạn qua `splitPlainTextIntoParagraphs()`
     * (core/file-manager/document.js) -> LƯU THẲNG `string[]` (KHÔNG convert sang HTML ở bước
     * này — xem docstring đầu file, SỬA lại sau phản hồi Giang). */
    async _handleUploadTxt(file) {
        await withLoadingShield(t('common.loading.generic'), async () => {
            const text = await file.text();
            const documentKey = await resolveDocumentKey(file.name); // core
            await saveDocumentRecord(documentKey, { // core
                filename: file.name,
                title: file.name.replace(/\.txt$/i, ''),
                content: splitPlainTextIntoParagraphs(text), // core/file-manager/document.js — string[]
                format: 'txt',
                createdBy: 'upload',
            });
        });
        await this.refresh();
    },

    /** Ứng với "Tạo tài liệu mới" — hỏi tiêu đề, tạo record RỖNG (createdBy='user'), mở THẲNG
     * `openEditor()` (drawer Sửa MỚI). */
    async createNewDocument() {
        this._openTitleModal('fileManager.document.createTitle', 'fileManager.document.btnCreate', '', async (title) => {
            const filename = `${title}.txt`;
            const documentKey = await resolveDocumentKey(filename); // core
            await saveDocumentRecord(documentKey, { // core
                filename, title, content: '', format: 'txt', createdBy: 'user',
            });
            await this.refresh();
            this.openEditor({ key: documentKey, title, format: 'txt', content: '' });
        });
    },

    /** Dựng modal nhập tiêu đề qua core, mount + wire TOÀN BỘ ở đây — dùng chung cho
     * `createNewDocument()` (bên trên). */
    _openTitleModal(titleKey, confirmLabelKey, initialValue, onConfirm) {
        const stale = document.getElementById('document-title-modal-overlay');
        if (stale) stale.remove();
        const overlay = buildDocumentTitleModal(titleKey, confirmLabelKey, initialValue); // core/file-manager/document-ui.js
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        const inputEl = overlay.querySelector('#document-title-modal-input');
        overlay.querySelector('#document-title-modal-cancel').addEventListener('click', closeModal);
        overlay.querySelector('#document-title-modal-save').addEventListener('click', () => {
            const value = inputEl.value.trim();
            closeModal();
            if (value) onConfirm(value);
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        inputEl.focus();
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
