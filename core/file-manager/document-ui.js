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
 * NẠP SAU: core/dom-refs.js.
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

/** Đổ mảng đoạn văn (`content: string[]`) thành các thẻ `<p>` trong khung TRONG — mỗi đoạn 1 `<p>`
 * để CSS multi-column không cắt ngang giữa 2 đoạn (browser tự ưu tiên ngắt ở ranh giới block). */
function renderReaderParagraphs(pagesEl, paragraphs) {
    pagesEl.replaceChildren();
    paragraphs.forEach((paragraph) => {
        const p = document.createElement('p');
        p.className = 'mb-4 leading-relaxed';
        p.textContent = paragraph;
        pagesEl.appendChild(p);
    });
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

/** @param {string} currentTitle
 *  @param {(title: string) => void} onConfirm */
function openRenameDocumentModal(currentTitle, onConfirm) {
    _openDocumentTitleModal('fileManager.document.renameTitle', 'common.save', currentTitle, onConfirm);
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
 * "Đã tạo"/"Đã tải lên" (createdBy), nút "..." (Đổi tên/Xoá).
 * @param {HTMLElement} containerEl
 * @param {Array<{key: string, title: string, format: string, createdBy: string}>} documents
 * @param {(documentKey: string) => void} onOpen - bấm vào hàng (mở Reader).
 * @param {(documentKey: string, action: 'rename'|'delete') => void} onMenuAction
 */
function renderDocumentList(containerEl, documents, onOpen, onMenuAction) {
    if (!containerEl) return;
    containerEl.replaceChildren();

    documents.forEach((doc) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors';

        const openBtn = document.createElement('button');
        openBtn.className = 'flex items-center gap-3 flex-1 min-w-0 text-left';
        const icon = document.createElement('div');
        icon.className = `w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.format === 'docx' ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300'}`;
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>';
        openBtn.appendChild(icon);
        const textWrap = document.createElement('div');
        textWrap.className = 'min-w-0';
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
        openBtn.appendChild(textWrap);
        openBtn.addEventListener('click', () => onOpen(doc.key));
        row.appendChild(openBtn);

        const menuWrap = document.createElement('div');
        menuWrap.className = 'relative shrink-0';
        const menuBtn = document.createElement('button');
        menuBtn.className = 'w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300';
        menuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/></svg>';
        const menu = document.createElement('div');
        menu.className = 'hidden absolute top-9 right-0 z-10 w-40 rounded-xl bg-[#1a1a1e] border border-white/10 shadow-2xl overflow-hidden flex flex-col py-1';
        const renameItem = document.createElement('button');
        renameItem.className = 'text-left px-3.5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors';
        renameItem.textContent = t('fileManager.document.btnRename');
        renameItem.addEventListener('click', () => { menu.classList.add('hidden'); onMenuAction(doc.key, 'rename'); });
        const deleteItem = document.createElement('button');
        deleteItem.className = 'text-left px-3.5 py-2.5 text-sm font-medium text-rose-400 hover:bg-white/10 transition-colors';
        deleteItem.textContent = t('fileManager.document.btnDelete');
        deleteItem.addEventListener('click', () => { menu.classList.add('hidden'); onMenuAction(doc.key, 'delete'); });
        menu.appendChild(renameItem);
        menu.appendChild(deleteItem);
        menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
        menuWrap.appendChild(menuBtn);
        menuWrap.appendChild(menu);
        row.appendChild(menuWrap);

        containerEl.appendChild(row);
    });
}
