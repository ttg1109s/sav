/**
 * core/file-manager/document-ui.js — Hàm dựng UI THUẦN cho Documents (danh sách trong File
 * Manager + engine phân trang của Reader) — CÙNG NHÓM với core/file-manager/photo-ui.js (hàm dựng
 * UI, KHÔNG thuộc phạm vi Rule 1-4 core-function-conventions.md — rule đó áp cho hàm NGHIỆP VỤ).
 *
 * PHÂN TRANG READER — kỹ thuật CSS multi-column (đã tra cứu, cùng cách epub.js và phần lớn trình
 * đọc ebook JS dùng): đặt `column-width` = đúng bề rộng khung đọc, `height` cố định theo chiều cao
 * khung, `overflow: hidden` ở khung NGOÀI — trình duyệt TỰ chia nội dung theo cột (mỗi cột = 1
 * "trang"), không cần JS tự đo từng dòng chữ. Next/Prev = dịch `transform: translateX()` đúng
 * 1 (bề rộng trang + khoảng cách cột) mỗi lần. Ưu điểm ĐÚNG yêu cầu "tự căn lại nếu kích thước
 * khác nhau": đổi cỡ chữ/resize/xoay màn hình chỉ cần đo lại `scrollWidth`, KHÔNG cần thuật toán đo
 * text riêng — trình duyệt tự dàn lại hoàn toàn.
 *
 * FIX (05/07/2026, mục 1/2 phản hồi Giang — 2 lỗi UI Documents):
 *   1. Menu "..." (Đổi tên/Xoá) trên mỗi hàng bị CHỒNG LẤN layout — BỎ HẲN, không vá CSS.
 *   2. Tài liệu tự tạo (createdBy='user') không có lối vào Sửa (batch trước đã cố tình tắt "bấm
 *      hàng mở Reader", xem comment cũ ở event/workflow/file-manager-document.js::refresh()).
 * Thay bằng: bấm vào 1 hàng bất kỳ mở `openDocumentDetailModal()` — icon lớn (phân biệt txt/docx)
 * + tên file đầy đủ (bấm để đổi tên, phần mở rộng CỐ ĐỊNH theo `format`) + dung lượng (KB/MB, tính
 * từ `content` — xem `computeDocumentSizeBytes()`) + hàng icon Xoá (luôn có) và Sửa (`user`)/Tải về
 * (`upload`). `renderDocumentList()` giờ CHỈ nhận 1 callback `onOpen(doc)`, không còn `onMenuAction`.
 *
 * CẬP NHẬT TIẾP (05/07/2026, mục 5 phản hồi Giang — đã chốt "Markdown + WYSIWYG format ngay khi
 * gõ, dùng thư viện ngoài"): tích hợp **Toast UI Editor** (CDN `toastui-editor-all.min.js`, xem
 * index.html) — `openDocumentEditorDrawer()` mount Editor thật (`initialEditType: 'wysiwyg'`),
 * `renderReaderMarkdown()` (thay `renderReaderParagraphs()` cũ) dùng `Editor.factory({viewer:true})`
 * TẠM để render Markdown -> HTML rồi huỷ ngay. `content` trong toàn bộ file này giờ là 1 chuỗi
 * Markdown (không còn mảng đoạn) — MỌI nơi đọc `doc.content` phải qua
 * `resolveDocumentMarkdown()` (core/file-manager/document.js) trước để tương thích ngược record cũ.
 *
 * NẠP SAU: core/dom-refs.js, core/file-manager/document.js (resolveDocumentMarkdown), CDN
 * `toastui-editor-all.min.js` (global `toastui.Editor`).
 */

const READER_PAGE_GAP_PX = 48; // khoảng cách giữa 2 "trang" (2 cột CSS) — cố định, dùng cả lúc set CSS lẫn lúc tính offset JS

/**
 * Đo khung đọc + áp layout multi-column + trả về TỔNG số trang hiện có. Gọi lúc mở Reader/đổi
 * tài liệu/đổi cỡ chữ/resize cửa sổ — nơi gọi (event/workflow/document-reader.js) tự quyết định
 * khi nào cần gọi lại.
 * @param {HTMLElement} bodyEl - khung NGOÀI (overflow hidden, đo kích thước thật).
 * @param {HTMLElement} pagesEl - khung TRONG (nhận column-width/height, chứa các <p> đoạn văn).
 * @returns {{pageWidth: number, totalPages: number}}
 */
function applyReaderPagination(bodyEl, pagesEl) {
    const pageWidth = bodyEl.clientWidth;
    const pageHeight = bodyEl.clientHeight;
    pagesEl.style.columnWidth = `${pageWidth}px`;
    pagesEl.style.columnGap = `${READER_PAGE_GAP_PX}px`;
    pagesEl.style.columnFill = 'auto'; // "auto" (không phải "balance") — lấp ĐẦY cột trước khi qua cột kế, đúng cảm giác lật trang
    pagesEl.style.height = `${pageHeight}px`;
    pagesEl.style.transform = 'translateX(0)'; // về trang 1 mỗi lần layout lại (đổi tài liệu/resize)
    const totalPages = Math.max(1, Math.round((pagesEl.scrollWidth + READER_PAGE_GAP_PX) / (pageWidth + READER_PAGE_GAP_PX)));
    return { pageWidth, totalPages };
}

/** Dịch khung TRONG tới đúng trang `pageIndex` (0-based). */
function setReaderPageIndex(pagesEl, pageIndex, pageWidth) {
    pagesEl.style.transform = `translateX(-${pageIndex * (pageWidth + READER_PAGE_GAP_PX)}px)`;
}

/**
 * FIX (05/07/2026, mục 5 phản hồi Giang) — THAY HẲN `renderReaderParagraphs()` cũ (nhận mảng đoạn
 * văn, tự tạo `<p>`). `content` giờ là 1 chuỗi MARKDOWN (xem core/file-manager/document.js) — cần
 * RENDER ra HTML trước khi nhét vào khung phân trang multi-column.
 *
 * Kỹ thuật: mount 1 Toast UI Viewer TẠM trên 1 `<div>` RỜI (không gắn vào DOM thật), gọi
 * `.getHTML()` lấy chuỗi HTML đã render, `.destroy()` NGAY, rồi gán thẳng `pagesEl.innerHTML` —
 * CHỦ Ý không giữ Viewer sống lâu dài trong `pagesEl` (khác cách dùng thông thường của thư viện)
 * vì kỹ thuật phân trang CSS multi-column (`applyReaderPagination()`) cần `pagesEl` chứa HTML THUẦN
 * không có wrapper/overflow riêng của Viewer can thiệp vào — đúng yêu cầu Giang "phải dùng thư viện"
 * (mục 5) nhưng vẫn giữ nguyên cơ chế phân trang đã có, không viết lại toàn bộ Reader.
 *
 * **CHƯA TEST TRÊN BROWSER THẬT** — cần Giang xác nhận: (1) `Editor.factory({ viewer: true })` có
 * render đồng bộ ngay khi gọi hay cần đợi 1 tick/callback nào đó trước khi `.getHTML()` cho kết quả
 * đầy đủ; (2) HTML Viewer trả về (h1-h6/ul/ol/strong/em/blockquote...) có ngắt cột multi-column tự
 * nhiên, đẹp mắt hay cần thêm CSS riêng (vd khoảng cách đầu đoạn, list-style trong cột hẹp).
 * @param {HTMLElement} pagesEl
 * @param {string} markdown
 */
function renderReaderMarkdown(pagesEl, markdown) {
    const tempEl = document.createElement('div');
    const tempViewer = toastui.Editor.factory({ el: tempEl, viewer: true, initialValue: markdown, usageStatistics: false });
    const html = tempViewer.getHTML();
    tempViewer.destroy();
    pagesEl.innerHTML = html;
}

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

/** Core thuần: hiện/ẩn cửa sổ Reader (overlay + window cùng lúc). */
function setDocumentReaderVisible(overlayEl, windowEl, visible) {
    if (!overlayEl || !windowEl) return;
    overlayEl.classList.toggle('hidden', !visible);
    windowEl.classList.toggle('hidden', !visible);
}

/** Core thuần: hiện/ẩn Document Picker Drawer — overlay dùng `classList.hidden`, drawer dùng
 * `translateY` (trượt lên/xuống, khớp `transition-transform` đã khai báo sẵn trong template). */
function setDocumentPickerVisible(overlayEl, drawerEl, visible) {
    if (!overlayEl || !drawerEl) return;
    overlayEl.classList.toggle('hidden', !visible);
    if (visible) {
        drawerEl.classList.remove('hidden');
        // Ép reflow trước khi bỏ translate-y-full — đảm bảo transition CHẠY (thêm/bỏ 'hidden' và
        // 'translate-y-full' cùng lúc trong 1 tick JS có thể bị trình duyệt gộp, bỏ qua animation).
        void drawerEl.offsetHeight;
        drawerEl.classList.remove('translate-y-full');
    } else {
        drawerEl.classList.add('translate-y-full');
    }
}

/**
 * Vẽ danh sách tài liệu trong Document Picker Drawer (components/document-picker-drawer.js) — CHỈ
 * tap-để-chọn, KHÔNG có menu CRUD (đúng yêu cầu Giang: "..." Đổi tên/Xoá CHỈ có trong File Manager
 * -> Documents, drawer picker này thuần tuý để CHỌN đọc). Đánh dấu tài liệu ĐANG mở (nếu có, viền
 * sáng) — CHỮ ĐEN vì drawer nền TRẮNG (khác hẳn phần còn lại của app, đúng yêu cầu Giang).
 * @param {HTMLElement} listEl
 * @param {Array<{key: string, title: string, format: string}>} documents
 * @param {string|null} activeDocumentKey
 * @param {(documentKey: string) => void} onSelect
 */
function renderDocumentPickerList(listEl, documents, activeDocumentKey, onSelect) {
    if (!listEl) return;
    listEl.replaceChildren();
    documents.forEach((doc) => {
        const isActive = doc.key === activeDocumentKey;
        const item = document.createElement('button');
        item.className = `w-full text-left px-4 py-3.5 rounded-xl mb-1.5 flex items-center gap-3 transition-colors ${isActive ? 'bg-sky-50 border border-sky-300' : 'hover:bg-slate-100 border border-transparent'}`;
        const icon = document.createElement('div');
        icon.className = `w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.format === 'docx' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'}`;
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
        item.appendChild(icon);
        const titleEl = document.createElement('span');
        titleEl.className = 'text-sm font-semibold text-slate-800 truncate';
        titleEl.textContent = doc.title;
        item.appendChild(titleEl);
        item.addEventListener('click', () => onSelect(doc.key));
        listEl.appendChild(item);
    });
}

/**
 * Vẽ lại danh sách document trong drawer File Manager. Mỗi hàng: icon theo `format`, title, badge
 * "Đã tạo"/"Đã tải lên" (createdBy) — CẢ HÀNG là 1 nút bấm mở `openDocumentDetailModal()` (FIX
 * 05/07/2026 — THAY HẲN menu "..." cũ, từng bị chồng lấn layout trên hàng danh sách).
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
 * Tính dung lượng "file" (bytes) từ Markdown — ước lượng theo ĐÚNG nội dung đang lưu thật trong DB
 * (app KHÔNG giữ byte gốc của file upload, kể cả .docx — xem comment đầu
 * core/file-manager/document.js). Nhận `content` đã QUA `resolveDocumentMarkdown()` (nơi gọi tự
 * resolve, xem `openDocumentDetailModal()` — hàm này KHÔNG tự resolve để tránh phụ thuộc ngược vào
 * document.js ở mọi hàm UI thuần). Đo bằng `Blob` để ra ĐÚNG số byte UTF-8 thật (không phải
 * `string.length` — sai với tiếng Việt có dấu, vốn nhiều ký tự chiếm 2-3 byte UTF-8 mỗi ký tự).
 * @param {string} markdown
 * @returns {number}
 */
function computeDocumentSizeBytes(markdown) {
    return new Blob([markdown]).size;
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
 * Tải 1 tài liệu về máy dạng `.md` (Markdown thuần). ĐỔI từ `.txt` (mục 5 phản hồi Giang 05/07/2026
 * — content giờ LÀ Markdown thật, đặt đuôi `.md` trung thực hơn `.txt` với cú pháp `**đậm**`/`# tiêu
 * đề` hiển thị nguyên văn nếu mở bằng trình đọc .txt thường). Nhận `content` ĐÃ resolve qua
 * `resolveDocumentMarkdown()` ở nơi gọi (cùng lý do `computeDocumentSizeBytes()` ở trên).
 * @param {{title: string}} doc
 * @param {string} markdown
 */
function downloadDocumentAsMarkdown(doc, markdown) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Modal "Chi tiết tài liệu" — mở khi bấm vào 1 hàng trong danh sách Documents (FIX 05/07/2026, mục
 * 1/2 phản hồi Giang, CẬP NHẬT thêm cùng ngày mục 1/4). Layout: icon lớn (phân biệt txt/docx) → tên
 * file đầy đủ (bấm để đổi tên, PHẦN MỞ RỘNG cố định theo `format`, không sửa được — chỉ đổi
 * `title`) → dung lượng (`computeDocumentSizeBytes`/`formatDocumentSize`) → hàng icon hành động:
 * Đổi tên (luôn, mở editor tên NGAY TẠI CHỖ giống hệt bấm vào tên) + Tải về (luôn, CẢ 'user' lẫn
 * 'upload') + Sửa (chỉ `createdBy==='user'`, mở `openDocumentEditorDrawer()` — KHÔNG phải Reader,
 * xem hàm đó) + Xoá (luôn, đặt cuối).
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
        sizeEl.textContent = formatDocumentSize(computeDocumentSizeBytes(resolveDocumentMarkdown(doc))); // resolveDocumentMarkdown: core/file-manager/document.js — quy tương thích ngược mảng cũ/string mới
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
    // (luôn, CẢ 'user' lẫn 'upload' — FIX 05/07/2026 mục 1 phản hồi Giang) + Sửa (chỉ 'user') +
    // Xoá (luôn, đặt CUỐI vì là hành động phá huỷ) ----
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
 * Drawer "Sửa tài liệu" — mở TỪ File Manager -> Documents (FIX 05/07/2026, mục 2/3 phản hồi Giang:
 * "Edit file là hành vi khác nhau" — TRƯỚC ĐÓ sai vì tái dùng Reader ở Control Center + đóng hẳn
 * Settings, gây mở chồng 2 thứ cùng lúc). Đây là 1 drawer HOÀN TOÀN RIÊNG, KHÔNG đụng
 * `workflowDocumentReader`/Settings — nằm THEO ĐÚNG nav-stack đã có sẵn của File Manager (giống hệt
 * Folder Detail z-[91] nằm TRÊN Song z-[90], xem components/file-manager.js) — z-[91], TRÊN
 * `#drawer-file-manager-document` (z-[90]) mà KHÔNG cần đóng nó hay Settings phía dưới.
 *
 * Full-view (`fixed inset-0`), trượt NGANG (`translateX`, không phải `translate-y-full` như các
 * drawer khác trong app) — phân biệt trực quan với nav-stack dọc đã có, đúng yêu cầu Giang. Tạo/gỡ
 * hoàn toàn bằng JS (không phải node tĩnh trong 1 component template) — giống `openImagePreviewModal`/
 * `openDocumentDetailModal`, dùng sự kiện `transitionend` để gỡ khỏi DOM SAU khi trượt ra hết
 * (KHÔNG dùng `setTimeout` — cấm dùng timer thô ngoài Workflow, xem readme/task-manager-conventions.md).
 *
 * Header: CHỈ tên file (trái) + nút đóng X (phải) — ĐÚNG YÊU CẦU GIANG, không thêm nút Lưu riêng —
 * bấm X = LƯU LUÔN rồi mới đóng (đọc `editor.getMarkdown()` trước khi `destroy()`).
 *
 * FIX (05/07/2026, mục 5 phản hồi Giang, CẬP NHẬT cùng ngày — đã chốt thư viện): mount THẬT
 * **Toast UI Editor** (CDN `toastui-editor-all.min.js`, xem index.html) chế độ `wysiwyg` — format
 * HIỆN NGAY trong lúc gõ (đậm/nghiêng/tiêu đề/danh sách...), lưu ra 1 chuỗi Markdown qua
 * `editor.getMarkdown()`. **CHƯA TEST TRÊN BROWSER THẬT** — cần Giang xác nhận layout Editor bên
 * trong `bodyEl` (`flex-grow`, không set `height` cố định — Editor cần `height` CSS rõ ràng để tính
 * toolbar/khung soạn thảo, đã truyền `height: '100%'`, NHƯNG cha `bodyEl` phải thật sự có chiều cao
 * > 0 lúc mount — đang mount NGAY sau khi gắn vào DOM, nếu lỗi layout thử đổi sang mount SAU 1
 * `requestAnimationFrame`).
 * @param {{key: string, title: string, format: string, content: string|string[]}} doc
 * @param {{onSave?: (markdown: string) => void, onClose?: () => void}} [callbacks]
 * @returns {{close: () => void}} `close()` — đóng drawer bằng code (tự lưu luôn, giống bấm X).
 */
function openDocumentEditorDrawer(doc, callbacks) {
    const stale = document.getElementById('document-editor-drawer-overlay');
    if (stale) stale.remove();

    const initialMarkdown = resolveDocumentMarkdown(doc); // core/file-manager/document.js — quy tương thích ngược mảng cũ/string mới

    const overlay = document.createElement('div');
    overlay.id = 'document-editor-drawer-overlay';
    overlay.className = 'fixed inset-0 z-[91] bg-[#0b0f1a] flex flex-col transition-transform duration-300 ease-in-out translate-x-full';

    let editorInstance = null;
    let closed = false;

    /** Đọc markdown hiện tại + huỷ instance + báo `onSave` — TÁCH RIÊNG khỏi `closeNow()` (đóng
     * KHÔNG lưu, dùng khi cần đóng thẳng bằng code mà nơi gọi tự lo việc lưu, hiện CHƯA có nơi nào
     * dùng nhánh đó nhưng giữ 2 hàm riêng cho rõ ràng, đúng Rule 1 "1 hàm 1 việc"). */
    function saveAndDestroyEditor() {
        if (!editorInstance) return;
        const markdown = editorInstance.getMarkdown();
        editorInstance.destroy();
        editorInstance = null;
        if (callbacks && callbacks.onSave) callbacks.onSave(markdown);
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
    bodyEl.className = 'flex-grow min-h-0';
    overlay.appendChild(bodyEl);

    document.body.appendChild(overlay);
    // Ép reflow trước khi bỏ translate-x-full — đảm bảo transition CHẠY (cùng lý do/kỹ thuật với
    // setDocumentPickerVisible() ở trên: thêm node + bỏ class off-screen cùng lúc trong 1 tick JS
    // có thể bị trình duyệt gộp, bỏ qua animation nếu không ép reflow ở giữa).
    void overlay.offsetHeight;
    overlay.classList.remove('translate-x-full');

    editorInstance = new toastui.Editor({
        el: bodyEl,
        height: '100%',
        initialEditType: 'wysiwyg',
        initialValue: initialMarkdown,
        usageStatistics: false,
    });

    return { close: closeNow };
}
