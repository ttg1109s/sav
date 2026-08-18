/**
 * core/file-manager/document-ui.js — Hàm dựng UI cho Documents (danh sách CRUD trong File Manager
 * + modal chi tiết + surface Sửa dùng chung) — Core NGHIỆP VỤ tuân Rule 1-5 ĐẦY ĐỦ
 * (core-function-conventions.md).
 *
 * SIẾT LẠI LẦN 2 (10/07/2026, sau khi Rule 5 được viết thành văn bản chính thức): bản SIẾT LẦN 1
 * (cùng ngày, phản hồi đầu của Giang) đã ĐI QUÁ TAY — gỡ SẠCH `addEventListener` ra khỏi file này,
 * kể cả phần ĐÚNG RA được phép theo Rule 5a (hàm dựng cụm DOM MỚI bằng `createElement`, callback
 * CHỈ gọi tham số, gom cuối hàm — ĐÚNG NGUYÊN NHỮNG GÌ file này cần). Giờ khôi phục lại đúng khuôn
 * `core/modal-choice-ui.js` (ví dụ tham chiếu đã được audit chính thức): mỗi hàm dựng UI ở đây
 * **tự mount vào `document.body` + tự gắn `addEventListener` GOM Ở CUỐI hàm**, callback bên trong
 * CHỈ gọi tham số (`callbacks.onXxx`) — TUYỆT ĐỐI KHÔNG gọi thẳng tên hàm nào của
 * `core/file-manager/document.js` (đó vẫn là Rule 3, không đổi, không có ngoại lệ nào ở đây).
 *
 * Hệ quả kiến trúc: file này KHÔNG tự resolve/sanitize/tính size gì cả — mọi input cần từ
 * document.js (html đã resolve, size đã tính) PHẢI được Workflow tính SẴN rồi truyền vào qua tham
 * số; MỌI output cần sanitize lại (`getHtml()` của editor surface) trả về HTML THÔ, Workflow tự
 * `sanitizeDocumentHtml()` sau khi nhận lại — xem event/workflow/file-manager-document.js và
 * event/workflow/document-reader.js để thấy luồng đầy đủ.
 *
 * NẠP SAU: lang/lang.js (t()), core/modal-choice-ui.js (dùng chung escapeHtml()).
 */

/**
 * Modal nhập tiêu đề — dùng chung "Tạo tài liệu mới"/"Đổi tên". Tự mount + tự gắn sự kiện (Rule
 * 5a) — CHỈ gọi `onConfirm` (tham số) khi Lưu, KHÔNG gọi core nào khác.
 * @param {string} titleKey - i18n key tiêu đề modal.
 * @param {string} confirmLabelKey - i18n key nút xác nhận.
 * @param {string} initialValue - giá trị input ban đầu ('' cho tạo mới).
 * @param {(value: string) => void} onConfirm
 * @returns {() => void} hàm đóng modal bằng code (hiếm dùng, đối xứng với modalChoice()).
 */
function buildDocumentTitleModal(titleKey, confirmLabelKey, initialValue, onConfirm) {
    const stale = document.getElementById('document-title-modal-overlay');
    if (stale) stale.remove();

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
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t(confirmLabelKey);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    function closeModal() { overlay.remove(); }

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', () => {
        const value = inputEl.value.trim();
        closeModal();
        if (value) onConfirm(value); // CHỈ gọi tham số — KHÔNG gọi core nào khác
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    document.body.appendChild(overlay);
    inputEl.focus();
    return closeModal;
}

/**
 * Vẽ danh sách document trong drawer File Manager + tự gắn click từng hàng (Rule 5a) — mỗi hàng
 * bấm gọi `onOpen(doc)` (tham số), KHÔNG gọi core nào khác. Mỗi hàng: icon theo `format`, title,
 * badge "Đã tạo"/"Đã tải lên" (createdBy).
 * @param {HTMLElement} containerEl
 * @param {Array<{key: string, title: string, format: string, createdBy: string}>} documents
 * @param {(doc: Object) => void} onOpen
 */
function renderDocumentList(containerEl, documents, onOpen) {
    if (!containerEl) return;
    containerEl.replaceChildren();

    const rows = documents.map((doc) => {
        const row = document.createElement('button');
        row.type = 'button';
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

        containerEl.appendChild(row);
        return { row, doc };
    });

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    rows.forEach(({ row, doc }) => row.addEventListener('click', () => onOpen(doc)));
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
 * Tải 1 tài liệu về máy dạng `.txt` — LUÔN `.txt` bất kể `format` gốc, vì `plainText` (tham số) đã
 * được Workflow tự quy về text kiểu-Markdown SẴN qua `convertDocumentHtmlToPlainText()`
 * (core/file-manager/document.js) TRƯỚC khi gọi hàm này. Không có gì để `addEventListener` ở đây —
 * `.click()` là hành động trình duyệt thuần (trigger), không phải đăng ký lắng nghe.
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
 * Modal "Chi tiết tài liệu" — tự mount + tự gắn TOÀN BỘ sự kiện (Rule 5a), kể cả khối chuyển đổi
 * hiện tên/sửa tên tại chỗ (thuần trạng thái UI nội bộ, KHÔNG gọi callback nào) — CHỈ 4 hành động
 * cuối cùng (Đổi tên xong/Tải về/Sửa/Xoá) mới gọi ra `callbacks` (tham số).
 * @param {{title: string, format: 'txt'|'docx', createdBy: 'upload'|'user'}} doc
 * @param {string} sizeText - đã format sẵn, xem formatDocumentSize().
 * @param {{onRename: (title: string) => void, onDownload: () => void, onEdit: () => void, onDelete: () => void}} callbacks
 * @returns {() => void} hàm đóng modal bằng code.
 */
function buildDocumentDetailModal(doc, sizeText, callbacks) {
    const stale = document.getElementById('document-detail-modal-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'document-detail-modal-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4';
    overlay.appendChild(card);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    card.appendChild(closeBtn);

    const iconWrap = document.createElement('div');
    iconWrap.className = `w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 mt-2 ${doc.format === 'docx' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300'}`;
    iconWrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
    card.appendChild(iconWrap);

    // ---- Khối hiện tên (mặc định hiện) ----
    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'w-full flex flex-col items-center gap-1 min-w-0';
    const nameBtn = document.createElement('button');
    nameBtn.className = 'max-w-full px-2 text-center text-sm font-semibold text-white hover:text-sky-300 transition-colors truncate';
    nameBtn.textContent = `${doc.title}.${doc.format}`;
    nameDisplay.appendChild(nameBtn);
    const sizeEl = document.createElement('div');
    sizeEl.className = 'text-xs text-slate-400';
    sizeEl.textContent = sizeText;
    nameDisplay.appendChild(sizeEl);
    card.appendChild(nameDisplay);

    // ---- Khối sửa tên (mặc định ẩn) — input CHỈ chứa phần TÊN, phần mở rộng hiện tĩnh cạnh bên ----
    const nameEditor = document.createElement('div');
    nameEditor.className = 'hidden w-full flex flex-col items-center gap-1 min-w-0';
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
    nameEditor.appendChild(row);
    const nameBtnRow = document.createElement('div');
    nameBtnRow.className = 'flex gap-2 mt-1';
    const nameCancelBtn = document.createElement('button');
    nameCancelBtn.className = 'px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors';
    nameCancelBtn.textContent = t('common.cancel');
    const nameSaveBtn = document.createElement('button');
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

    function addActionButton(label, svgInner, danger) {
        const btn = document.createElement('button');
        btn.className = `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${danger ? 'text-rose-400 hover:text-rose-300' : 'text-slate-300 hover:text-white'}`;
        const iconBox = document.createElement('div');
        iconBox.className = `w-11 h-11 rounded-full flex items-center justify-center transition-colors ${danger ? 'bg-rose-500/10 hover:bg-rose-500/20' : 'bg-white/5 hover:bg-white/10'}`;
        iconBox.innerHTML = svgInner;
        btn.appendChild(iconBox);
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        btn.appendChild(labelEl);
        actionRow.appendChild(btn);
        return btn;
    }

    const renameBtn = addActionButton(t('fileManager.document.btnRename'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>', false);
    const downloadBtn = addActionButton(t('fileManager.document.btnDownload'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>', false);
    const editBtn = doc.createdBy === 'user'
        ? addActionButton(t('documentReader.btnEdit'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>', false)
        : null;
    const deleteBtn = addActionButton(t('fileManager.document.btnDelete'), '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>', true);

    function closeModal() { overlay.remove(); }
    function showNameEditor() {
        nameDisplay.classList.add('hidden');
        nameEditor.classList.remove('hidden');
        inputEl.value = doc.title;
        inputEl.focus();
        inputEl.select();
    }
    function showNameDisplay() {
        nameEditor.classList.add('hidden');
        nameDisplay.classList.remove('hidden');
    }

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    nameBtn.addEventListener('click', showNameEditor);
    renameBtn.addEventListener('click', showNameEditor);
    nameCancelBtn.addEventListener('click', showNameDisplay);
    nameSaveBtn.addEventListener('click', () => {
        const value = inputEl.value.trim();
        if (value && value !== doc.title) {
            doc.title = value;
            nameBtn.textContent = `${doc.title}.${doc.format}`;
            callbacks.onRename(value); // CHỈ gọi tham số
        }
        showNameDisplay();
    });
    downloadBtn.addEventListener('click', () => { closeModal(); callbacks.onDownload(); });
    if (editBtn) editBtn.addEventListener('click', () => { closeModal(); callbacks.onEdit(); });
    deleteBtn.addEventListener('click', () => { closeModal(); callbacks.onDelete(); });

    document.body.appendChild(overlay);
    return closeModal;
}

/**
 * Dựng 1 khối "toolbar + vùng contentEditable" — DÙNG CHUNG cho Editor Drawer (File Manager) VÀ
 * Reader (nút Sửa nội bộ). Tự gắn TOÀN BỘ sự kiện toolbar (Rule 5a) — mỗi nút chỉ gọi
 * `document.execCommand()`/`window.prompt()` (API trình duyệt thuần, KHÔNG phải "gọi core khác")
 * hoặc 1 closure NỘI BỘ (lồng bên trong, không phải hàm top-level riêng — không tính core-gọi-core).
 * `getHtml()` trả về HTML THÔ (CHƯA sanitize) — nơi gọi (Workflow) tự `sanitizeDocumentHtml()` sau
 * khi lấy lại, file này KHÔNG tự gọi document.js (Rule 3).
 *
 * FIX (10/07/2026, phản hồi Giang — mục 3):
 *   - Quote giờ TỰ TOGGLE đúng nghĩa: bấm lần 2 khi ĐANG ở blockquote sẽ THOÁT về `<p>` (trước đây
 *     `execCommand('formatBlock', false, 'blockquote')` KHÔNG tự toggle — bấm lại chỉ áp lại
 *     blockquote, không có cách nào thoát).
 *   - Heading cycle sửa lại: từ BẤT KỲ trạng thái nào KHÔNG PHẢI heading (kể cả đang ở blockquote)
 *     -> H2 trước (trước đây mọi tag lạ đều rơi về `P`, khiến bấm Heading lúc đang quote chỉ thoát
 *     quote nhưng KHÔNG thành heading thật — matched đúng mô tả "quote không thoát được nếu ấn
 *     heading + text").
 *   - THÊM trạng thái active: mỗi nút b/i/u/heading/quote/bullet/numbered giờ tự thêm/xoá class
 *     "đang bật" (`document.queryCommandState()` cho lệnh toggle chuẩn; so `getCurrentBlockTag()`
 *     cho heading/quote vì `formatBlock` không có `queryCommandState` đáng tin cậy) — cập nhật
 *     SAU MỖI lần bấm nút VÀ mỗi khi gõ phím/click trong vùng soạn thảo (`keyup`/`mouseup`).
 * @param {string} initialHtml - HTML ban đầu (đã sanitize từ trước bởi Workflow).
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

    const ACTIVE_CLASSES = ['bg-sky-500', 'text-white'];
    const INACTIVE_CLASSES = ['bg-white/5', 'text-slate-200'];

    function addToolbarButton(label, titleKey) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-white/15 transition-colors ${INACTIVE_CLASSES.join(' ')}`;
        btn.textContent = label;
        btn.title = t(titleKey);
        toolbar.appendChild(btn);
        return btn;
    }

    const boldBtn = addToolbarButton('B', 'documentEditor.toolbar.bold');
    const italicBtn = addToolbarButton('I', 'documentEditor.toolbar.italic');
    const underlineBtn = addToolbarButton('U', 'documentEditor.toolbar.underline');
    const headingBtn = addToolbarButton('H', 'documentEditor.toolbar.heading');
    const quoteBtn = addToolbarButton('❝', 'documentEditor.toolbar.quote');
    const bulletBtn = addToolbarButton('•', 'documentEditor.toolbar.bulletList');
    const numberedBtn = addToolbarButton('1.', 'documentEditor.toolbar.numberedList');
    const linkBtn = addToolbarButton(t('documentEditor.toolbar.link'), 'documentEditor.toolbar.link');

    // Đọc tag của khối (block-level) đang chứa con trỏ/selection hiện tại — closure NỘI BỘ, dùng
    // chung bởi cycleHeading()/toggleQuote()/updateActiveStates() (KHÔNG phải hàm top-level riêng
    // — Rule 3 chỉ cấm gọi hàm ĐỘC LẬP khác, không cấm closure lồng bên trong chính hàm đang chạy).
    function getCurrentBlockTag() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return 'P';
        let node = selection.anchorNode;
        while (node && node !== surfaceEl && node.parentNode !== surfaceEl) node = node.parentNode;
        return node && node.nodeType === Node.ELEMENT_NODE ? node.tagName : 'P';
    }

    // Xoay vòng khối chứa con trỏ hiện tại: BẤT KỲ tag nào KHÔNG PHẢI H2/H3 (kể cả P, BLOCKQUOTE,
    // hay bất cứ gì khác) -> H2 TRƯỚC (FIX — trước đây rơi thẳng về P, khiến bấm Heading lúc đang
    // trong blockquote CHỈ thoát quote chứ không thành heading thật).
    function cycleHeading() {
        const currentTag = getCurrentBlockTag();
        const nextTag = currentTag === 'H2' ? 'H3' : (currentTag === 'H3' ? 'P' : 'H2');
        document.execCommand('formatBlock', false, nextTag);
    }

    // FIX — `formatBlock` KHÔNG tự toggle (không như bold/italic/underline): bấm quote lần 2 lúc
    // ĐANG blockquote phải THOÁT về `<p>`, tự kiểm tra tag hiện tại để quyết định chiều đổi.
    function toggleQuote() {
        const currentTag = getCurrentBlockTag();
        document.execCommand('formatBlock', false, currentTag === 'BLOCKQUOTE' ? 'P' : 'BLOCKQUOTE');
    }

    function setButtonActive(btn, isActive) {
        btn.classList.remove(...(isActive ? INACTIVE_CLASSES : ACTIVE_CLASSES));
        btn.classList.add(...(isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES));
    }

    // Cập nhật trạng thái "đang bật" của TỪNG nút theo con trỏ/selection HIỆN TẠI — gọi sau mỗi lần
    // bấm nút (phản ánh NGAY thay đổi vừa làm) VÀ mỗi khi gõ phím/click trong vùng soạn thảo.
    function updateActiveStates() {
        setButtonActive(boldBtn, document.queryCommandState('bold'));
        setButtonActive(italicBtn, document.queryCommandState('italic'));
        setButtonActive(underlineBtn, document.queryCommandState('underline'));
        const blockTag = getCurrentBlockTag();
        setButtonActive(headingBtn, blockTag === 'H2' || blockTag === 'H3');
        setButtonActive(quoteBtn, blockTag === 'BLOCKQUOTE');
        setButtonActive(bulletBtn, document.queryCommandState('insertUnorderedList'));
        setButtonActive(numberedBtn, document.queryCommandState('insertOrderedList'));
    }

    // mousedown + preventDefault trên CẢ toolbar (delegation nội bộ 1 dòng, KHÔNG lặp cho từng
    // nút) — giữ nguyên Selection hiện tại trong contentEditable (click thường làm mất focus/
    // selection TRƯỚC khi execCommand kịp chạy).
    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    toolbar.addEventListener('mousedown', (e) => e.preventDefault());
    boldBtn.addEventListener('click', () => { document.execCommand('bold'); updateActiveStates(); });
    italicBtn.addEventListener('click', () => { document.execCommand('italic'); updateActiveStates(); });
    underlineBtn.addEventListener('click', () => { document.execCommand('underline'); updateActiveStates(); });
    headingBtn.addEventListener('click', () => { cycleHeading(); updateActiveStates(); });
    quoteBtn.addEventListener('click', () => { toggleQuote(); updateActiveStates(); });
    bulletBtn.addEventListener('click', () => { document.execCommand('insertUnorderedList'); updateActiveStates(); });
    numberedBtn.addEventListener('click', () => { document.execCommand('insertOrderedList'); updateActiveStates(); });
    linkBtn.addEventListener('click', () => {
        const url = window.prompt(t('documentEditor.linkPrompt'));
        if (url) document.execCommand('createLink', false, url);
        updateActiveStates();
    });
    // keyup/mouseup TRÊN CHÍNH surfaceEl (không phải document toàn trang — tự dọn theo vòng đời
    // của chính surfaceEl, không cần gỡ tay khi đóng editor) — cập nhật active state khi gõ phím/
    // click DI CHUYỂN con trỏ trong vùng soạn thảo, không chỉ lúc bấm nút toolbar.
    surfaceEl.addEventListener('keyup', updateActiveStates);
    surfaceEl.addEventListener('mouseup', updateActiveStates);

    return {
        el: wrap,
        getHtml() { return surfaceEl.innerHTML; }, // HTML THÔ — Workflow tự sanitizeDocumentHtml() sau
        focus() { surfaceEl.focus(); },
    };
}

/**
 * Dựng + tự mount + trượt vào khung "Drawer Sửa tài liệu" (File Manager -> Documents -> Sửa) —
 * full-view, trượt NGANG, z-[91] TRÊN `#drawer-file-manager-document` (z-[90]). Header: tên file +
 * nút đóng X — bấm X CHỈ gọi `onCloseClick` (tham số, Rule 5a); Workflow tự quyết định "đóng =
 * lưu luôn" bằng cách implement `onCloseClick` gọi `editorApi.getHtml()` (surface build RIÊNG,
 * compose ở Workflow — xem event/workflow/file-manager-document.js::openEditor(), 2 hàm dựng UI
 * KHÔNG được tự compose với nhau trong CÙNG 1 hàm vì đó là core gọi core, Rule 3).
 * @param {{title: string, format: string}} doc
 * @param {() => void} onCloseClick
 * @returns {{bodyEl: HTMLElement, slideOutAndRemove: () => void}}
 */
function buildDocumentEditorDrawer(doc, onCloseClick) {
    const stale = document.getElementById('document-editor-drawer-overlay');
    if (stale) stale.remove();

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
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'flex-grow min-h-0 flex flex-col';
    overlay.appendChild(bodyEl);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    closeBtn.addEventListener('click', onCloseClick); // CHỈ gọi tham số

    document.body.appendChild(overlay);
    // Ép reflow trước khi bỏ translate-x-full — đảm bảo transition CHẠY (thêm node + bỏ class
    // off-screen cùng lúc trong 1 tick JS có thể bị trình duyệt gộp, bỏ qua animation nếu không
    // ép reflow ở giữa).
    void overlay.offsetHeight;
    overlay.classList.remove('translate-x-full');

    function slideOutAndRemove() {
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        overlay.classList.add('translate-x-full');
    }

    return { bodyEl, slideOutAndRemove };
}
