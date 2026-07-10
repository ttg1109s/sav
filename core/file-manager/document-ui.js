/**
 * core/file-manager/document-ui.js — Hàm dựng UI THUẦN cho Documents (danh sách CRUD trong File
 * Manager + modal chi tiết + surface Sửa dùng chung) — CÙNG NHÓM với core/file-manager/photo-ui.js
 * (hàm dựng UI, KHÔNG thuộc phạm vi Rule 1-4 core-function-conventions.md — rule đó áp cho hàm
 * NGHIỆP VỤ).
 *
 * VIẾT LẠI (10/07/2026, Nhóm A — mục 1.3/2/4 plan-v12-extended.md): BỎ HẲN
 * `applyReaderPagination()`/`setReaderPageIndex()`/`renderReaderMarkdown()` (kỹ thuật CSS
 * multi-column + Toast UI Viewer cũ) — phân trang Reader giờ ở core/file-manager/
 * document-pagination.js (core nghiệp vụ RIÊNG, thuật toán khác hẳn: cắt theo khối + đo DOM tạm),
 * điều phối ở event/workflow/document-reader.js. BỎ `setDocumentReaderVisible()`/
 * `setDocumentPickerVisible()`/`renderDocumentPickerList()` (drawer/window tĩnh cũ) — thay bằng
 * Generic Drawer (core/generic-drawer.js) + items.js (renderItemList/itemTemplateDocumentRow).
 *
 * MỚI (10/07/2026, Nhóm A — mục 1.3 plan-v12-extended.md): `buildDocumentEditorSurface()` — 1 khối
 * toolbar + `contentEditable` DÙNG CHUNG cho CẢ 2 nơi cần Sửa trong app: Editor Drawer (File
 * Manager -> Documents -> Sửa, `openDocumentEditorDrawer()` dưới đây) VÀ Reader (nút Sửa nội bộ,
 * xem event/workflow/document-reader.js::enterEditMode()) — THAY Toast UI Editor (đã gỡ khỏi
 * index.html, xem readme Nhóm A). Toolbar qua `document.execCommand()` trên Selection/Range hiện
 * tại — KHÔNG tự parse cú pháp lúc gõ (né đúng bài toán khó nhất đã phân tích: WYSIWYG-markdown-
 * live rất dễ vỡ với IME tiếng Việt; contentEditable thao tác trực tiếp DOM theo lệnh toolbar thì
 * không có bài toán đó).
 *
 * `content` trong toàn bộ file này giờ là 1 chuỗi HTML ĐÃ LỌC WHITELIST (không còn Markdown) —
 * MỌI nơi đọc `doc.content` phải qua `resolveDocumentHtml()` (core/file-manager/document.js)
 * trước để tương thích ngược record cũ.
 *
 * NẠP SAU: core/dom-refs.js, core/file-manager/document.js (resolveDocumentHtml/
 * sanitizeDocumentHtml), core/modal-choice.js (dùng chung escapeHtml()), lang/lang.js (t()).
 */

/** Modal nhập tiêu đề — dùng chung cho "Tạo tài liệu mới" và "Đổi tên", CÙNG KHUÔN
 * openCreateAlbumModal() (core/file-manager/photo-ui.js).
 * @param {string} titleKey - i18n key tiêu đề modal.
 * @param {string} confirmLabelKey - i18n key nút xác nhận.
 * @param {string} initialValue - giá trị input ban đầu ('' cho tạo mới).
 * @param {(value: string) => void} onConfirm
 */
function _openDocumentTitleModal(titleKey, confirmLabelKey, initialValue, onConfirm) {
    const stale = document.getElementById('document-title-modal-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'document-title-modal-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t(titleKey);
    card.appendChild(titleEl);

    function closeModal() { overlay.remove(); }

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.value = initialValue;
    inputEl.placeholder = t('fileManager.document.titlePlaceholder');
    inputEl.className = 'bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors';
    card.appendChild(inputEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    cancelBtn.addEventListener('click', closeModal);
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t(confirmLabelKey);
    saveBtn.addEventListener('click', () => {
        const value = inputEl.value.trim();
        closeModal();
        if (value) onConfirm(value);
    });
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    inputEl.focus();
}

/** @param {(title: string) => void} onConfirm */
function openCreateDocumentModal(onConfirm) {
    _openDocumentTitleModal('fileManager.document.createTitle', 'fileManager.document.btnCreate', '', onConfirm);
}

/**
 * Vẽ lại danh sách document trong drawer File Manager. Mỗi hàng: icon theo `format`, title, badge
 * "Đã tạo"/"Đã tải lên" (createdBy) — CẢ HÀNG là 1 nút bấm mở `openDocumentDetailModal()`.
 * KHÔNG dùng renderItemList()/itemTemplateDocumentRow() (components/items.js) — danh sách này có
 * badge + mở modal chi tiết, khác hẳn Document Picker (chỉ tap-để-chọn) mà items.js phục vụ, xem
 * docstring đầu components/items.js.
 * @param {HTMLElement} containerEl
 * @param {Array<{key: string, title: string, format: string, createdBy: string, content: string|string[]}>} documents
 * @param {(doc: Object) => void} onOpen - bấm vào hàng, nhận NGUYÊN record (đã có sẵn `content` từ
 *        `listDocuments()`, không cần đọc lại DB) — mở modal chi tiết.
 */
function renderDocumentList(containerEl, documents, onOpen) {
    if (!containerEl) return;
    containerEl.replaceChildren();

    documents.forEach((doc) => {
        const row = document.createElement('button');
        row.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left';

        const icon = document.createElement('div');
        icon.className = `w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.format === 'docx' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300'}`;
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
        row.appendChild(icon);

        const textWrap = document.createElement('div');
        textWrap.className = 'min-w-0 flex-1';
        const titleEl = document.createElement('div');
        titleEl.className = 'text-sm font-semibold text-white truncate';
        titleEl.textContent = doc.title;
        textWrap.appendChild(titleEl);
        const badgeEl = document.createElement('div');
        badgeEl.className = 'text-xs text-slate-400';
        badgeEl.textContent = doc.createdBy === 'user'
            ? t('fileManager.document.badgeUser')
            : t('fileManager.document.badgeUpload');
        textWrap.appendChild(badgeEl);
        row.appendChild(textWrap);

        row.addEventListener('click', () => onOpen(doc));
        containerEl.appendChild(row);
    });
}

/**
 * Tính dung lượng "file" (bytes) từ HTML đã sanitize — ước lượng theo ĐÚNG nội dung đang lưu thật
 * trong DB (app KHÔNG giữ byte gốc của file upload, kể cả .docx — xem comment đầu
 * core/file-manager/document.js). Nhận `html` đã QUA `resolveDocumentHtml()` (nơi gọi tự resolve,
 * xem `openDocumentDetailModal()` — hàm này KHÔNG tự resolve để tránh phụ thuộc ngược vào
 * document.js ở mọi hàm UI thuần). Đo bằng `Blob` để ra ĐÚNG số byte UTF-8 thật (không phải
 * `string.length` — sai với tiếng Việt có dấu, vốn nhiều ký tự chiếm 2-3 byte UTF-8 mỗi ký tự).
 * @param {string} html
 * @returns {number}
 */
function computeDocumentSizeBytes(html) {
    return new Blob([html]).size;
}

/**
 * Định dạng bytes -> "x.x KB"/"x.xx MB". KHÔNG dùng chung `formatBytes()` (core/about-stats.js) —
 * hàm đó chỉ có bậc MB/GB (đúng cho thư viện nhạc, vài chục-trăm MB), trong khi tài liệu text
 * thường chỉ vài KB — hiện "0.0 MB" sẽ vô nghĩa với người dùng.
 * @param {number} bytes
 * @returns {string}
 */
function formatDocumentSize(bytes) {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.max(kb, 0.1).toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Tải 1 tài liệu về máy dạng `.html` (VIẾT LẠI 10/07/2026, Nhóm A — content giờ LÀ HTML thật,
 * KHÔNG còn Markdown, xem core/file-manager/document.js). Bọc trong 1 khung HTML tối thiểu hợp lệ
 * để file tải về mở được độc lập bằng trình duyệt bất kỳ (không chỉ trong app). Nhận `html` ĐÃ
 * resolve qua `resolveDocumentHtml()` ở nơi gọi (cùng lý do `computeDocumentSizeBytes()` ở trên).
 * @param {{title: string}} doc
 * @param {string} html
 */
function downloadDocumentAsHtml(doc, html) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Modal "Chi tiết tài liệu" — mở khi bấm vào 1 hàng trong danh sách Documents. Layout: icon lớn
 * (phân biệt txt/docx) → tên file đầy đủ (bấm để đổi tên, PHẦN MỞ RỘNG cố định theo `format`,
 * không sửa được — chỉ đổi `title`) → dung lượng (`computeDocumentSizeBytes`/`formatDocumentSize`)
 * → hàng icon hành động: Đổi tên (luôn, mở editor tên NGAY TẠI CHỖ giống hệt bấm vào tên) + Tải về
 * (luôn, CẢ 'user' lẫn 'upload') + Sửa (chỉ `createdBy==='user'`, mở `openDocumentEditorDrawer()`
 * — KHÔNG phải Reader, xem hàm đó) + Xoá (luôn, đặt cuối).
 * @param {{key: string, title: string, format: 'txt'|'docx', createdBy: 'upload'|'user', content: string|string[]}} doc
 * @param {{onRename: (newTitle: string) => void, onDelete: () => void, onEdit: () => void, onDownload: () => void}} callbacks
 */
function openDocumentDetailModal(doc, callbacks) {
    const stale = document.getElementById('document-detail-modal-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'document-detail-modal-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    function closeModal() { overlay.remove(); }

    const card = document.createElement('div');
    card.className = 'relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4';
    overlay.appendChild(card);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeModal);
    card.appendChild(closeBtn);

    // ---- Icon lớn (phân biệt txt/docx) ----
    const iconWrap = document.createElement('div');
    iconWrap.className = `w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 mt-2 ${doc.format === 'docx' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300'}`;
    iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
    card.appendChild(iconWrap);

    // ---- Tên file đầy đủ (bấm để đổi tên) + dung lượng ----
    const nameWrap = document.createElement('div');
    nameWrap.className = 'w-full flex flex-col items-center gap-1 min-w-0';
    card.appendChild(nameWrap);

    function renderNameDisplay() {
        nameWrap.replaceChildren();
        const nameBtn = document.createElement('button');
        nameBtn.className = 'max-w-full px-2 text-center text-sm font-semibold text-white hover:text-sky-300 transition-colors truncate';
        nameBtn.textContent = `${doc.title}.${doc.format}`;
        nameBtn.addEventListener('click', renderNameEditor);
        nameWrap.appendChild(nameBtn);

        const sizeEl = document.createElement('div');
        sizeEl.className = 'text-xs text-slate-400';
        sizeEl.textContent = formatDocumentSize(computeDocumentSizeBytes(resolveDocumentHtml(doc))); // resolveDocumentHtml: core/file-manager/document.js — quy tương thích ngược mảng cũ/string mới
        nameWrap.appendChild(sizeEl);
    }

    // Sửa tên NGAY TẠI CHỖ (không mở modal riêng như trước) — input CHỈ chứa phần TÊN, phần mở
    // rộng hiện cạnh dưới dạng text tĩnh (`extEl`), không nằm trong input -> không thể sửa được.
    function renderNameEditor() {
        nameWrap.replaceChildren();
        const row = document.createElement('div');
        row.className = 'w-full flex items-center gap-1 justify-center';
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.value = doc.title;
        inputEl.className = 'min-w-0 flex-1 max-w-[160px] bg-black/50 border border-sky-500/40 rounded-lg px-2 py-1 text-sm text-white outline-none';
        const extEl = document.createElement('span');
        extEl.className = 'text-sm text-slate-400 shrink-0';
        extEl.textContent = `.${doc.format}`;
        row.appendChild(inputEl);
        row.appendChild(extEl);
        nameWrap.appendChild(row);

        const btnRow = document.createElement('div');
        btnRow.className = 'flex gap-2 mt-1';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors';
        cancelBtn.textContent = t('common.cancel');
        cancelBtn.addEventListener('click', renderNameDisplay);
        const saveBtn = document.createElement('button');
        saveBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors';
        saveBtn.textContent = t('common.save');
        saveBtn.addEventListener('click', () => {
            const value = inputEl.value.trim();
            if (value && value !== doc.title) {
                doc.title = value; // cập nhật ngay tại chỗ để hiện đúng nếu đổi tên tiếp mà chưa đóng modal
                callbacks.onRename(value);
            }
            renderNameDisplay();
        });
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(saveBtn);
        nameWrap.appendChild(btnRow);
        inputEl.focus();
        inputEl.select();
    }

    renderNameDisplay();

    // ---- Hàng icon hành động: Đổi tên (luôn, KHÔNG đóng modal — mở editor tên tại chỗ) + Tải về
    // (luôn, CẢ 'user' lẫn 'upload') + Sửa (chỉ 'user') + Xoá (luôn, đặt CUỐI vì là hành động
    // phá huỷ) ----
    const actionRow = document.createElement('div');
    actionRow.className = 'w-full flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pt-3 border-t border-white/10';
    card.appendChild(actionRow);

    /** @param {boolean} [closeOnClick] - mặc định true (đóng modal trước khi chạy onClick); Đổi tên
     * truyền false vì cần GIỮ modal mở để hiện editor tên ngay tại chỗ (renderNameEditor()). */
    function addActionButton(label, svgInner, danger, onClick, closeOnClick = true) {
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${danger ? 'text-rose-400 hover:text-rose-300' : 'text-slate-300 hover:text-white'}`;
        const iconBox = document.createElement('div');
        iconBox.className = `w-11 h-11 rounded-full flex items-center justify-center transition-colors ${danger ? 'bg-rose-500/10 hover:bg-rose-500/20' : 'bg-white/5 hover:bg-white/10'}`;
        iconBox.innerHTML = svgInner;
        btn.appendChild(iconBox);
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        btn.appendChild(labelEl);
        btn.addEventListener('click', () => { if (closeOnClick) closeModal(); onClick(); });
        actionRow.appendChild(btn);
    }

    addActionButton(
        t('fileManager.document.btnRename'),
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>',
        false,
        renderNameEditor,
        false, // KHÔNG đóng modal — sửa tên ngay tại chỗ
    );

    addActionButton(
        t('fileManager.document.btnDownload'),
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>',
        false,
        callbacks.onDownload,
    );

    if (doc.createdBy === 'user') {
        addActionButton(
            t('documentReader.btnEdit'),
            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
            false,
            callbacks.onEdit,
        );
    }

    addActionButton(
        t('fileManager.document.btnDelete'),
        '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
        true,
        callbacks.onDelete,
    );

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
}

/**
 * MỚI (10/07/2026, Nhóm A — mục 1.3 plan-v12-extended.md) — Dựng 1 khối "toolbar + vùng
 * contentEditable" HOÀN CHỈNH, DÙNG CHUNG cho CẢ Editor Drawer (File Manager) lẫn Reader (nút Sửa
 * nội bộ) — THAY Toast UI Editor (đã gỡ khỏi index.html). Toolbar tối thiểu: Heading (bấm xoay
 * vòng p -> h2 -> h3 -> p), Bold, Italic, Underline, Quote (blockquote), Bullet list, Numbered
 * list, Link — tất cả qua `document.execCommand()` trên Selection/Range hiện tại.
 *
 * Core UI THUẦN (giống mọi hàm khác trong file này) — KHÔNG tự đọc/ghi DB. `getHtml()` tự
 * `sanitizeDocumentHtml()` lại (core/file-manager/document.js) TRƯỚC khi trả — trình duyệt hay tự
 * chèn `<div>`/`<span style="...">` lộn xộn vào nội dung contentEditable, phải lọc lại trước khi
 * ghi DB (mục 1.3 plan-v12-extended.md).
 * @param {string} initialHtml - HTML ban đầu (đã sanitize từ trước, xem resolveDocumentHtml()).
 * @returns {{el: HTMLElement, getHtml: () => string, focus: () => void}}
 */
function buildDocumentEditorSurface(initialHtml) {
    const wrap = document.createElement('div');
    wrap.className = 'flex flex-col h-full min-h-0';

    const toolbar = document.createElement('div');
    toolbar.className = 'flex flex-wrap items-center gap-1 px-3 py-2 border-b border-white/10 shrink-0 bg-black/20';
    wrap.appendChild(toolbar);

    const surfaceEl = document.createElement('div');
    surfaceEl.contentEditable = 'true';
    surfaceEl.className = 'document-html-content document-editor-surface flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm text-slate-100 outline-none';
    surfaceEl.innerHTML = initialHtml || '';
    wrap.appendChild(surfaceEl);

    /** @param {string} label @param {string} titleKey @param {() => void} onClick */
    function addToolbarButton(label, titleKey, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/15 text-slate-200 transition-colors';
        btn.textContent = label;
        btn.title = t(titleKey);
        // mousedown + preventDefault: giữ nguyên Selection hiện tại trong contentEditable (click
        // thường làm mất focus/selection TRƯỚC khi execCommand kịp chạy).
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', onClick);
        toolbar.appendChild(btn);
    }

    addToolbarButton('B', 'documentEditor.toolbar.bold', () => document.execCommand('bold'));
    addToolbarButton('I', 'documentEditor.toolbar.italic', () => document.execCommand('italic'));
    addToolbarButton('U', 'documentEditor.toolbar.underline', () => document.execCommand('underline'));
    addToolbarButton('H', 'documentEditor.toolbar.heading', () => _cycleHeadingAtSelection(surfaceEl));
    addToolbarButton('❝', 'documentEditor.toolbar.quote', () => document.execCommand('formatBlock', false, 'blockquote'));
    addToolbarButton('•', 'documentEditor.toolbar.bulletList', () => document.execCommand('insertUnorderedList'));
    addToolbarButton('1.', 'documentEditor.toolbar.numberedList', () => document.execCommand('insertOrderedList'));
    addToolbarButton(t('documentEditor.toolbar.link'), 'documentEditor.toolbar.link', () => {
        const url = window.prompt(t('documentEditor.linkPrompt'));
        if (url) document.execCommand('createLink', false, url);
    });

    return {
        el: wrap,
        getHtml() { return sanitizeDocumentHtml(surfaceEl.innerHTML); }, // core/file-manager/document.js
        focus() { surfaceEl.focus(); },
    };
}

/** Helper RIÊNG của buildDocumentEditorSurface() (private, không dùng nơi khác) — xoay vòng khối
 * chứa con trỏ hiện tại qua p -> h2 -> h3 -> p mỗi lần bấm nút "H". */
function _cycleHeadingAtSelection(surfaceEl) {
    const selection = window.getSelection();
    if (!selection.rangeCount) { surfaceEl.focus(); return; }
    let node = selection.anchorNode;
    while (node && node !== surfaceEl && node.parentNode !== surfaceEl) node = node.parentNode;
    const currentTag = node && node.nodeType === Node.ELEMENT_NODE ? node.tagName : 'P';
    const nextTag = currentTag === 'P' ? 'H2' : currentTag === 'H2' ? 'H3' : 'P';
    document.execCommand('formatBlock', false, nextTag);
}

/**
 * Drawer "Sửa tài liệu" — mở TỪ File Manager -> Documents. Đây là 1 drawer HOÀN TOÀN RIÊNG, KHÔNG
 * đụng `workflowDocumentReader`/Settings — nằm THEO ĐÚNG nav-stack đã có sẵn của File Manager
 * (giống hệt Folder Detail z-[91] nằm TRÊN Song z-[90], xem components/file-manager.js) — z-[91],
 * TRÊN `#drawer-file-manager-document` (z-[90]) mà KHÔNG cần đóng nó hay Settings phía dưới.
 *
 * Full-view (`fixed inset-0`), trượt NGANG (`translateX`, không phải `translate-y-full` như các
 * drawer khác trong app) — phân biệt trực quan với nav-stack dọc đã có. Tạo/gỡ hoàn toàn bằng JS
 * (không phải node tĩnh trong 1 component template) — giống `openImagePreviewModal`/
 * `openDocumentDetailModal`, dùng sự kiện `transitionend` để gỡ khỏi DOM SAU khi trượt ra hết
 * (KHÔNG dùng `setTimeout` — cấm dùng timer thô ngoài Workflow, xem readme/task-manager-conventions.md).
 *
 * Header: CHỈ tên file (trái) + nút đóng X (phải), KHÔNG có nút Lưu riêng — bấm X = LƯU LUÔN rồi
 * mới đóng (đọc `editorSurface.getHtml()` trước khi gỡ).
 *
 * VIẾT LẠI (10/07/2026, Nhóm A — mục 1.3/5 plan-v12-extended.md): mount
 * `buildDocumentEditorSurface()` (contentEditable + toolbar tự viết) THAY Toast UI Editor — dùng
 * CHUNG chính xác 1 hàm với event/workflow/document-reader.js::enterEditMode() (mục 1.3, "toolbar+
 * surface dùng chung cho cả 2 nơi cần Sửa").
 * @param {{key: string, title: string, format: string, content: string|string[]}} doc
 * @param {{onSave?: (html: string) => void, onClose?: () => void}} [callbacks]
 * @returns {{close: () => void}} `close()` — đóng drawer bằng code (tự lưu luôn, giống bấm X).
 */
function openDocumentEditorDrawer(doc, callbacks) {
    const stale = document.getElementById('document-editor-drawer-overlay');
    if (stale) stale.remove();

    const initialHtml = resolveDocumentHtml(doc); // core/file-manager/document.js — quy tương thích ngược mảng cũ/string mới

    const overlay = document.createElement('div');
    overlay.id = 'document-editor-drawer-overlay';
    overlay.className = 'fixed inset-0 z-[91] bg-[#0b0f1a] flex flex-col transition-transform duration-300 ease-in-out translate-x-full';

    let editorSurface = null;
    let closed = false;

    /** Đọc HTML hiện tại + gỡ instance + báo `onSave` — TÁCH RIÊNG khỏi `closeNow()` (đóng KHÔNG
     * lưu, dùng khi cần đóng thẳng bằng code mà nơi gọi tự lo việc lưu, hiện CHƯA có nơi nào dùng
     * nhánh đó nhưng giữ 2 hàm riêng cho rõ ràng, đúng Rule 1 "1 hàm 1 việc"). */
    function saveAndDestroyEditor() {
        if (!editorSurface) return;
        const html = editorSurface.getHtml(); // core/file-manager/document-ui.js — đã sanitizeDocumentHtml() lại bên trong
        editorSurface = null;
        if (callbacks && callbacks.onSave) callbacks.onSave(html);
    }

    function closeNow() {
        if (closed) return;
        closed = true;
        saveAndDestroyEditor();
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        overlay.classList.add('translate-x-full');
        if (callbacks && callbacks.onClose) callbacks.onClose();
    }

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-2 px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40';
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-base sm:text-lg font-bold text-white truncate';
    titleEl.textContent = `${doc.title}.${doc.format}`;
    header.appendChild(titleEl);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    closeBtn.addEventListener('click', closeNow);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const bodyEl = document.createElement('div');
    bodyEl.id = 'document-editor-drawer-body';
    bodyEl.className = 'flex-grow min-h-0 flex flex-col';
    overlay.appendChild(bodyEl);

    document.body.appendChild(overlay);
    // Ép reflow trước khi bỏ translate-x-full — đảm bảo transition CHẠY (cùng lý do/kỹ thuật với
    // openGenericDrawer() — thêm node + bỏ class off-screen cùng lúc trong 1 tick JS có thể bị
    // trình duyệt gộp, bỏ qua animation nếu không ép reflow ở giữa).
    void overlay.offsetHeight;
    overlay.classList.remove('translate-x-full');

    editorSurface = buildDocumentEditorSurface(initialHtml); // core/file-manager/document-ui.js — hàm KHÁC trong CÙNG file, core UI thuần nên không bị Rule 3
    bodyEl.appendChild(editorSurface.el);
    editorSurface.focus();

    return { close: closeNow };
}
