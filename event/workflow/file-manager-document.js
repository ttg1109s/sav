/**
 * event/workflow/file-manager-document.js — Workflow cụm "fileManagerDocument" (drawer Documents
 * trong File Manager). Mở/đóng drawer thuần (`showFileManagerDocumentDrawer`/`hide...`,
 * core/file-manager/nav.js) KHÔNG cần workflow — CHỈ những nghiệp vụ ≥2 bước mới ở đây.
 *
 * SIẾT LẠI LẦN 2 (10/07/2026, sau khi Rule 5 chính thức hoá — xem docstring đầu core/file-manager/
 * document-ui.js): các hàm `buildDocumentXxx()` giờ TỰ mount + TỰ gắn sự kiện (Rule 5a), Workflow
 * này CHỈ còn việc CHUẨN BỊ data (gọi document.js) + truyền callback nghiệp vụ vào — KHÔNG còn phải
 * tự `document.body.appendChild()`/`querySelector()`/`addEventListener()` thủ công cho từng nút
 * như bản SIẾT LẦN 1 (quá tay, đã sửa).
 *
 * CONTENT MODEL: `.txt` upload KHÔNG markup -> lưu THẲNG `string[]` (splitPlainTextIntoParagraphs(),
 * KHÔNG convert sang HTML lúc lưu). `.docx` (mammoth.js) VÀ tài liệu `createdBy==='user'` (mọi lần
 * Sửa) -> lưu `string` HTML đã sanitizeDocumentHtml(). Tải về LUÔN ra `.txt` — 
 * convertDocumentHtmlToPlainText() quy HTML về lại cú pháp kiểu-Markdown tương ứng.
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
        appState.set('pageCurrentDocumentList', 0); // MỚI (14/07/2026) — mở lại panel từ đầu luôn về trang 1
        console.log(`writer: "openPanel", page: "pageCurrentDocumentList", content: "0"`);
        await this.refresh();
    },

    /** Vẽ lại danh sách document (ĐÃ PHÂN TRANG, ~50 tài liệu/trang, mode 'list') — gọi lúc mở
     * panel + sau mỗi lần thêm/xoá/đổi tên. */
    async refresh() {
        if (!fileManagerDocumentPanelEl) return; // guard: panel đã đóng
        const documents = await listDocuments(); // core
        const emptyEl = fileManagerDocumentPanelEl.querySelector('#file-manager-document-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', documents.length > 0);

        // MỚI (14/07/2026, Giang yêu cầu — "tiện luôn làm list ở document file manager mode list
        // 50/page") — CÙNG pattern computePage()/appState với danh sách folder
        // (event/workflow/file-manager-song.js::refreshSongTab()), field appState RIÊNG
        // (pageCurrentDocumentList) vì đây là danh sách độc lập.
        const pageResult = computePage(documents, appState.get('pageCurrentDocumentList'), 50); // core/pagination.js
        if (pageResult.pageIndex !== appState.get('pageCurrentDocumentList')) {
            appState.set('pageCurrentDocumentList', pageResult.pageIndex);
            console.log(`writer: "refresh", page: "pageCurrentDocumentList", content: "${pageResult.pageIndex}"`);
        }

        const listEl = fileManagerDocumentPanelEl.querySelector('#file-manager-document-list');
        renderDocumentList(listEl, pageResult.pageItems, (doc) => this.openDetail(doc)); // core — tự wire click từng hàng (Rule 5a)

        const paginationEl = fileManagerDocumentPanelEl.querySelector('#file-manager-document-pagination');
        // mode 'list' (dãy số trang) theo đúng yêu cầu Giang.
        if (paginationEl) paginationEl.innerHTML = buildPaginationListHtml(pageResult.pageIndex, pageResult.totalPages); // core/pagination.js
    },

    /** Ứng với 'fileManagerDocument.page.goto' — mode 'list', bấm THẲNG vào 1 số trang. MỚI
     * (14/07/2026). */
    async goToDocumentPage(pageIndex) {
        appState.set('pageCurrentDocumentList', pageIndex);
        console.log(`writer: "goToDocumentPage", page: "pageCurrentDocumentList", content: "${pageIndex}"`);
        await this.refresh();
    },

    /**
     * Mở modal "Chi tiết tài liệu" — chuẩn bị data (resolve/tính size) rồi truyền callback nghiệp
     * vụ vào `buildDocumentDetailModal()` (core, tự mount + tự wire). `doc` là record ĐẦY ĐỦ đã có
     * sẵn từ `listDocuments()` (kể cả `content`), KHÔNG cần đọc lại DB.
     * @param {{key: string, title: string, format: string, createdBy: string, content: string|string[]}} doc
     */
    openDetail(doc) {
        const html = resolveDocumentHtml(doc); // core/file-manager/document.js
        const sizeText = formatDocumentSize(computeDocumentSizeBytes(html)); // core/file-manager/document-ui.js x2

        buildDocumentDetailModal(doc, sizeText, { // core/file-manager/document-ui.js — tự mount + tự wire (Rule 5a)
            onRename: (title) => this._renameFromDetail(doc.key, title),
            onDownload: () => downloadDocumentAsText(doc, convertDocumentHtmlToPlainText(html)), // core/file-manager/document-ui.js + document.js
            onEdit: () => this.openEditor(doc),
            onDelete: () => this.confirmDelete(doc.key),
        });
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
     * Drawer + surface soạn thảo (2 hàm core RIÊNG, Workflow tự compose vì core không được gọi core
     * khác) — bấm X trong drawer = LƯU LUÔN rồi mới đóng (đọc `editorApi.getHtml()`, TỰ
     * `sanitizeDocumentHtml()` ở ĐÂY — file dựng UI KHÔNG được gọi document.js, Rule 3).
     * @param {{key: string, title: string, format: string, content: string|string[]}} doc
     */
    openEditor(doc) {
        const initialHtml = resolveDocumentHtml(doc); // core/file-manager/document.js

        let closed = false;
        const closeAndSave = async () => {
            if (closed) return;
            closed = true;
            const html = sanitizeDocumentHtml(editorApi.getHtml()); // core/file-manager/document.js — getHtml() trả về THÔ, sanitize ở đây
            drawer.slideOutAndRemove(); // core/file-manager/document-ui.js
            await updateDocumentContent(doc.key, html); // core
            if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.refreshContentIfOpen(doc.key, html);
        };

        const drawer = buildDocumentEditorDrawer(doc, closeAndSave); // core/file-manager/document-ui.js — tự mount + trượt vào + tự wire nút X
        const editorApi = buildDocumentEditorSurface(initialHtml); // core/file-manager/document-ui.js — tự wire toolbar (Rule 5a)
        drawer.bodyEl.appendChild(editorApi.el); // compose 2 core UNIT riêng — CHỈ Workflow được làm việc này (Rule 3)
        editorApi.focus();
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
     * (core/file-manager/document.js) TRỰC TIẾP, LƯU DẠNG HTML. Gọi `mammoth` TRỰC TIẾP ở đây —
     * thư viện ngoài, không phải core. */
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
     * (core/file-manager/document.js) -> LƯU THẲNG `string[]`. */
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
        buildDocumentTitleModal('fileManager.document.createTitle', 'fileManager.document.btnCreate', '', async (title) => { // core/file-manager/document-ui.js — tự mount + tự wire
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
