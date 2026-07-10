/**
 * core/file-manager/document-ui.js — Hàm dựng UI cho Documents (danh sách CRUD trong File Manager
 * + modal chi tiết + surface Sửa dùng chung) — Core NGHIỆP VỤ tuân Rule 1-4 ĐẦY ĐỦ.
 *
 * SIẾT LẠI HOÀN TOÀN (10/07/2026, sau phản hồi Giang): bản đầu Nhóm A đặt file này vào nhóm
 * "core UI thuần" (nhãn đã có SẴN trong codebase cho document-ui.js/photo-ui.js/modal-choice.js/
 * folder-picker-ui.js/settings-panel-stack.js TỪ TRƯỚC — không phải mình bịa ra) và dùng nhãn đó
 * để né Rule 1-4: gọi thẳng `resolveDocumentHtml()`/`sanitizeDocumentHtml()` (core/file-manager/
 * document.js — 1 core file KHÁC) VÀ tự `addEventListener` cho mọi nút bên trong modal. Giang xác
 * nhận: dựng UI VẪN là 1 nhiệm vụ nghiệp vụ, KHÔNG có ngoại lệ. File này (vì bị ĐỤNG TỚI trong đợt
 * Nhóm A, nên PHẢI tuân rule đầy đủ theo readme/core-function-conventions.md mục "Rule 0.5") giờ
 * là core THUẦN đúng nghĩa:
 *   - KHÔNG addEventListener bất kỳ đâu — mọi hàm ở đây CHỈ dựng cây DOM tĩnh (id cố định để nơi
 *     gọi querySelector), KHÔNG tự mount vào document.body, KHÔNG tự gắn hành vi. Toàn bộ việc
 *     "mount + addEventListener + gọi callback" chuyển hết sang event/workflow/
 *     file-manager-document.js (modal File Manager) và event/workflow/document-reader.js (surface
 *     Sửa dùng chung + toolbar) — xem 2 file đó để biết luồng đầy đủ.
 *   - KHÔNG gọi bất kỳ hàm nào của core/file-manager/document.js (`resolveDocumentHtml`/
 *     `sanitizeDocumentHtml`/`computeDocumentSizeBytes` không tính vì nó Ở CHÍNH FILE NÀY và
 *     KHÔNG gọi hàm nào khác — nhưng `computeDocumentSizeBytes`/`formatDocumentSize` KHÔNG được
 *     gọi document.js). Mọi input cần từ document.js (html đã resolve, size đã tính) PHẢI được
 *     Workflow tính SẴN rồi truyền vào qua tham số — xem chữ ký từng hàm dưới đây.
 *
 * `content` giờ có thể là `string[]` (.txt thuần) HOẶC `string` HTML (.docx/user) — file NÀY KHÔNG
 * tự resolve, luôn nhận `html`/`sizeText` đã resolve SẴN từ Workflow.
 *
 * NẠP SAU: lang/lang.js (t()), core/modal-choice.js (dùng chung escapeHtml() — file KHÁC nhưng là
 * tiện ích escape thuần, không phải nghiệp vụ Documents, cùng cách document.js gọi thẳng
 * service/db.js: escapeHtml không giữ trạng thái/quyết định nghiệp vụ nào, chỉ escape ký tự).
 */

/**
 * Dựng (KHÔNG mount) modal nhập tiêu đề — dùng chung cho "Tạo tài liệu mới" và "Đổi tên". ID cố
 * định để Workflow querySelector: `#document-title-modal-overlay` (root, trả về), `-input`,
 * `-cancel`, `-save`.
 * @param {string} titleKey - i18n key tiêu đề modal.
 * @param {string} confirmLabelKey - i18n key nút xác nhận.
 * @param {string} initialValue - giá trị input ban đầu ('' cho tạo mới).
 * @returns {HTMLElement} overlay CHƯA mount, CHƯA gắn sự kiện.
 */
function buildDocumentTitleModal(titleKey, confirmLabelKey, initialValue) {
    const overlay = document.createElement('div');
    overlay.id = 'document-title-modal-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';
    overlay.appendChild(card);

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t(titleKey);
    card.appendChild(titleEl);

    const inputEl = document.createElement('input');
    inputEl.id = 'document-title-modal-input';
    inputEl.type = 'text';
    inputEl.value = initialValue;
    inputEl.placeholder = t('fileManager.document.titlePlaceholder');
    inputEl.className = 'bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors';
    card.appendChild(inputEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'document-title-modal-cancel';
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    const saveBtn = document.createElement('button');
    saveBtn.id = 'document-title-modal-save';
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t(confirmLabelKey);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    return overlay;
}

/**
 * Vẽ danh sách document trong drawer File Manager VÀO `containerEl` (container đã tồn tại sẵn từ
 * Workflow, KHÁC với "mount 1 overlay mới" — vẫn hợp lệ vì đây là RENDER THUẦN, không gắn hành vi
 * gì). Mỗi hàng: icon theo `format`, title, badge "Đã tạo"/"Đã tải lên" (createdBy),
 * `data-document-key` để Workflow tự querySelectorAll + addEventListener theo key SAU khi gọi hàm
 * này (xem workflowFileManagerDocument.refresh()) — hàm này KHÔNG addEventListener, KHÔNG nhận
 * callback `onOpen` nữa.
 * @param {HTMLElement} containerEl
 * @param {Array<{key: string, title: string, format: string, createdBy: string}>} documents
 */
function renderDocumentList(containerEl, documents) {
    if (!containerEl) return;
    containerEl.replaceChildren();

    documents.forEach((doc) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'file-manager-document-row w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left';
        row.dataset.documentKey = doc.key;

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

        containerEl.appendChild(row);
    });
}

/**
 * Tính dung lượng "file" (bytes) từ HTML đã resolve — ước lượng theo ĐÚNG nội dung đang lưu thật
 * trong DB. Đo bằng `Blob` để ra ĐÚNG số byte UTF-8 thật (không phải `string.length` — sai với
 * tiếng Việt có dấu).
 * @param {string} html
 * @returns {number}
 */
function computeDocumentSizeBytes(html) {
    return new Blob([html]).size;
}

/**
 * Định dạng bytes -> "x.x KB"/"x.xx MB". KHÔNG dùng chung `formatBytes()` (core/about-stats.js) —
 * hàm đó chỉ có bậc MB/GB, trong khi tài liệu text thường chỉ vài KB.
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
 * Dựng (KHÔNG mount, KHÔNG gắn sự kiện) modal "Chi tiết tài liệu". Nhận `sizeText` đã format SẴN
 * từ Workflow (Workflow tự gọi `resolveDocumentHtml()`+`computeDocumentSizeBytes()`+
 * `formatDocumentSize()` TRƯỚC khi gọi hàm này — file này không được phép tự resolve/tính).
 *
 * ID cố định để Workflow wire (xem event/workflow/file-manager-document.js::openDetail()):
 * `#document-detail-modal-overlay` (root), `-close`, `#document-detail-name-display` (khối hiện
 * tên, mặc định hiện), `#document-detail-name-btn`, `#document-detail-name-size`,
 * `#document-detail-name-editor` (khối sửa tên, mặc định `hidden`), `#document-detail-name-input`,
 * `#document-detail-name-cancel`, `#document-detail-name-save`, `#document-detail-btn-rename`,
 * `#document-detail-btn-download`, `#document-detail-btn-edit` (chỉ có nếu `createdBy==='user'`),
 * `#document-detail-btn-delete`.
 * @param {{title: string, format: 'txt'|'docx', createdBy: 'upload'|'user'}} doc
 * @param {string} sizeText - đã format sẵn, xem formatDocumentSize().
 * @returns {HTMLElement}
 */
function buildDocumentDetailModal(doc, sizeText) {
    const overlay = document.createElement('div');
    overlay.id = 'document-detail-modal-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4';
    overlay.appendChild(card);

    const closeBtn = document.createElement('button');
    closeBtn.id = 'document-detail-modal-close';
    closeBtn.className = 'absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    card.appendChild(closeBtn);

    const iconWrap = document.createElement('div');
    iconWrap.className = `w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 mt-2 ${doc.format === 'docx' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300'}`;
    iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
    card.appendChild(iconWrap);

    // ---- Khối hiện tên (mặc định hiện) ----
    const nameDisplay = document.createElement('div');
    nameDisplay.id = 'document-detail-name-display';
    nameDisplay.className = 'w-full flex flex-col items-center gap-1 min-w-0';
    const nameBtn = document.createElement('button');
    nameBtn.id = 'document-detail-name-btn';
    nameBtn.className = 'max-w-full px-2 text-center text-sm font-semibold text-white hover:text-sky-300 transition-colors truncate';
    nameBtn.textContent = `${doc.title}.${doc.format}`;
    nameDisplay.appendChild(nameBtn);
    const sizeEl = document.createElement('div');
    sizeEl.id = 'document-detail-name-size';
    sizeEl.className = 'text-xs text-slate-400';
    sizeEl.textContent = sizeText;
    nameDisplay.appendChild(sizeEl);
    card.appendChild(nameDisplay);

    // ---- Khối sửa tên (mặc định ẩn) — input CHỈ chứa phần TÊN, phần mở rộng hiện tĩnh cạnh bên
    // (`extEl`), không nằm trong input -> không thể sửa được ----
    const nameEditor = document.createElement('div');
    nameEditor.id = 'document-detail-name-editor';
    nameEditor.className = 'hidden w-full flex flex-col items-center gap-1 min-w-0';
    const row = document.createElement('div');
    row.className = 'w-full flex items-center gap-1 justify-center';
    const inputEl = document.createElement('input');
    inputEl.id = 'document-detail-name-input';
    inputEl.type = 'text';
    inputEl.value = doc.title;
    inputEl.className = 'min-w-0 flex-1 max-w-[160px] bg-black/50 border border-sky-500/40 rounded-lg px-2 py-1 text-sm text-white outline-none';
    const extEl = document.createElement('span');
    extEl.className = 'text-sm text-slate-400 shrink-0';
    extEl.textContent = `.${doc.format}`;
    row.appendChild(inputEl);
    row.appendChild(extEl);
    nameEditor.appendChild(row);
    const nameBtnRow = document.createElement('div');
    nameBtnRow.className = 'flex gap-2 mt-1';
    const nameCancelBtn = document.createElement('button');
    nameCancelBtn.id = 'document-detail-name-cancel';
    nameCancelBtn.className = 'px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors';
    nameCancelBtn.textContent = t('common.cancel');
    const nameSaveBtn = document.createElement('button');
    nameSaveBtn.id = 'document-detail-name-save';
    nameSaveBtn.className = 'px-3 py-1 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors';
    nameSaveBtn.textContent = t('common.save');
    nameBtnRow.appendChild(nameCancelBtn);
    nameBtnRow.appendChild(nameSaveBtn);
    nameEditor.appendChild(nameBtnRow);
    card.appendChild(nameEditor);

    // ---- Hàng icon hành động ----
    const actionRow = document.createElement('div');
    actionRow.className = 'w-full flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pt-3 border-t border-white/10';
    card.appendChild(actionRow);

    function addActionButton(id, label, svgInner, danger) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${danger ? 'text-rose-400 hover:text-rose-300' : 'text-slate-300 hover:text-white'}`;
        const iconBox = document.createElement('div');
        iconBox.className = `w-11 h-11 rounded-full flex items-center justify-center transition-colors ${danger ? 'bg-rose-500/10 hover:bg-rose-500/20' : 'bg-white/5 hover:bg-white/10'}`;
        iconBox.innerHTML = svgInner;
        btn.appendChild(iconBox);
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        btn.appendChild(labelEl);
        actionRow.appendChild(btn);
    }

    addActionButton('document-detail-btn-rename', t('fileManager.document.btnRename'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>', false);
    addActionButton('document-detail-btn-download', t('fileManager.document.btnDownload'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>', false);
    if (doc.createdBy === 'user') {
        addActionButton('document-detail-btn-edit', t('documentReader.btnEdit'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>', false);
    }
    addActionButton('document-detail-btn-delete', t('fileManager.document.btnDelete'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>', true);

    return overlay;
}

/**
 * Dựng (KHÔNG mount, KHÔNG gắn sự kiện) 1 khối "toolbar + vùng contentEditable" — DÙNG CHUNG cho
 * CẢ Editor Drawer (File Manager) lẫn Reader (nút Sửa nội bộ). Mỗi nút toolbar mang
 * `data-command` (giá trị khớp thẳng tên lệnh `document.execCommand()` cho lệnh đơn giản
 * `bold`/`italic`/`underline`/`insertUnorderedList`/`insertOrderedList`; 3 lệnh đặc biệt
 * `heading`/`quote`/`link` do Workflow tự xử lý riêng — xem
 * event/workflow/document-reader.js::wireDocumentEditorToolbar(), hàm DUY NHẤT đọc
 * `data-command`). Vùng soạn thảo mang class `document-editor-surface` (Workflow tự
 * querySelector để đọc/ghi nội dung, KHÔNG có id — có thể có NHIỀU surface cùng lúc trên trang,
 * vd Editor Drawer + Reader edit mode mở đồng thời, id trùng sẽ không hợp lệ).
 * @param {string} initialHtml - HTML ban đầu (đã sanitize từ trước bởi Workflow).
 * @returns {HTMLElement}
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

    function addToolbarButton(label, command, titleKey) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.command = command;
        btn.className = 'min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/15 text-slate-200 transition-colors';
        btn.textContent = label;
        btn.title = t(titleKey);
        toolbar.appendChild(btn);
    }

    addToolbarButton('B', 'bold', 'documentEditor.toolbar.bold');
    addToolbarButton('I', 'italic', 'documentEditor.toolbar.italic');
    addToolbarButton('U', 'underline', 'documentEditor.toolbar.underline');
    addToolbarButton('H', 'heading', 'documentEditor.toolbar.heading');
    addToolbarButton('❝', 'quote', 'documentEditor.toolbar.quote');
    addToolbarButton('•', 'insertUnorderedList', 'documentEditor.toolbar.bulletList');
    addToolbarButton('1.', 'insertOrderedList', 'documentEditor.toolbar.numberedList');
    addToolbarButton(t('documentEditor.toolbar.link'), 'link', 'documentEditor.toolbar.link');

    return wrap;
}

/** Xoay vòng khối chứa con trỏ hiện tại (trong 1 vùng contentEditable) qua p -> h2 -> h3 -> p —
 * tiện ích DOM thuần (đọc window.getSelection(), gọi document.execCommand() — API trình duyệt,
 * KHÔNG phải "gọi core khác"), Workflow gọi trực tiếp khi xử lý nút "H" (data-command="heading"),
 * xem event/workflow/document-reader.js::wireDocumentEditorToolbar().
 * @param {HTMLElement} surfaceEl
 */
function cycleHeadingAtSelection(surfaceEl) {
    const selection = window.getSelection();
    if (!selection.rangeCount) { surfaceEl.focus(); return; }
    let node = selection.anchorNode;
    while (node && node !== surfaceEl && node.parentNode !== surfaceEl) node = node.parentNode;
    const currentTag = node && node.nodeType === Node.ELEMENT_NODE ? node.tagName : 'P';
    const nextTag = currentTag === 'P' ? 'H2' : currentTag === 'H2' ? 'H3' : 'P';
    document.execCommand('formatBlock', false, nextTag);
}

/**
 * Tải 1 tài liệu về máy dạng `.txt` — LUÔN `.txt` bất kể `format` gốc (txt/docx), vì `plainText`
 * (tham số) đã được Workflow tự quy về text kiểu-Markdown SẴN qua
 * `convertDocumentHtmlToPlainText()` (core/file-manager/document.js) TRƯỚC khi gọi hàm này — hàm
 * này KHÔNG tự resolve/convert gì, chỉ trigger tải file (Blob + `<a>` tạm + `.click()` — hành
 * động trình duyệt thuần, KHÔNG phải addEventListener/gọi core khác).
 * @param {{title: string}} doc
 * @param {string} plainText
 */
function downloadDocumentAsText(doc, plainText) {
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Dựng (KHÔNG mount, KHÔNG gắn sự kiện, KHÔNG trượt vào) khung "Drawer Sửa tài liệu" — mở TỪ File
 * Manager -> Documents. Full-view (`fixed inset-0`), trượt NGANG (`translateX`) — z-[91], TRÊN
 * `#drawer-file-manager-document` (z-[90]).
 *
 * Header: CHỈ tên file (trái) + nút đóng X (phải, id `#document-editor-drawer-close` — Workflow tự
 * gắn: đọc HTML từ surface trước khi đóng = LƯU LUÔN, KHÔNG có nút Lưu riêng). Body RỖNG
 * (`#document-editor-drawer-body`) — Workflow tự mount `buildDocumentEditorSurface()` vào đây.
 * @param {{title: string, format: string}} doc
 * @returns {HTMLElement}
 */
function buildDocumentEditorDrawer(doc) {
    const overlay = document.createElement('div');
    overlay.id = 'document-editor-drawer-overlay';
    overlay.className = 'fixed inset-0 z-[91] bg-[#0b0f1a] flex flex-col transition-transform duration-300 ease-in-out translate-x-full';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-2 px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40';
    const titleEl = document.createElement('h2');
    titleEl.className = 'text-base sm:text-lg font-bold text-white truncate';
    titleEl.textContent = `${doc.title}.${doc.format}`;
    header.appendChild(titleEl);
    const closeBtn = document.createElement('button');
    closeBtn.id = 'document-editor-drawer-close';
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const bodyEl = document.createElement('div');
    bodyEl.id = 'document-editor-drawer-body';
    bodyEl.className = 'flex-grow min-h-0 flex flex-col';
    overlay.appendChild(bodyEl);

    return overlay;
}
