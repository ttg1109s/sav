/**
 * components/items.js — Catalog template item + renderItemList() dùng CHUNG MỚI (mục 3
 * plan-v12-extended.md, 10/07/2026, Nhóm A). **Batch này CHỈ wire cho Document Picker** (danh sách
 * bên trong Generic Drawer ở chế độ List, xem event/workflow/document-reader.js::openPicker()) —
 * File Manager Song/Photo (tự createElement từng dòng) GIỮ NGUYÊN, chưa đụng. File Manager ->
 * Documents (CRUD, renderDocumentList() ở core/file-manager/document-ui.js) CŨNG GIỮ NGUYÊN — đó
 * là danh sách KHÁC (có badge/mở modal chi tiết), không phải Document Picker.
 *
 * Mốc hiệu năng đã hiệu chỉnh: ~100-200 item (không phải 1000+). Ở mốc này, virtual scroll thật
 * (tái dùng node theo vùng nhìn thấy) là dư thừa — renderItemList() dùng giao diện TỔNG QUÁT để
 * SAU NÀY (không phải batch này) có thể đổi phần BÊN TRONG sang windowed rendering cho chỗ thật
 * sự cần (vd danh sách bài hát dài) mà KHÔNG phải sửa nơi gọi.
 *
 * Generic Drawer (core/generic-drawer.js) và items.js TÁCH BIỆT HOÀN TOÀN, không phụ thuộc nhau:
 * Drawer không biết "item" là gì (chỉ nhận `bodyHtml` là 1 chuỗi có sẵn), items.js không biết
 * "drawer" là gì (chỉ trả chuỗi HTML). Workflow là nơi DUY NHẤT nối 2 thứ:
 *   openGenericDrawer({ bodyHtml: renderItemList(null, docs, itemTemplateDocumentRow, ctx) })
 *
 * NẠP SAU: core/modal-choice.js (dùng chung escapeHtml()), lang/lang.js (t() — hiện CHƯA cần
 * trong itemTemplateDocumentRow(), giữ chỗ nếu template sau này cần dịch text tĩnh).
 */

/**
 * Template 1 dòng Document trong Document Picker — CHỈ tap-để-chọn, KHÔNG có menu CRUD (đúng yêu
 * cầu Giang — CRUD chỉ có trong File Manager -> Documents, xem
 * core/file-manager/document-ui.js::renderDocumentList(), KHÔNG migrate batch này). Đánh dấu tài
 * liệu ĐANG mở (viền sáng) nếu `doc.key === ctx.activeDocumentKey` — CHỮ ĐEN vì Generic Drawer
 * nền TRẮNG (khác phần còn lại của app, mục 2/7 plan-v12-extended.md).
 * @param {{key: string, title: string, format: string}} doc
 * @param {{activeDocumentKey: string|null}} [ctx] - dữ liệu NGOÀI item (không thuộc riêng item
 *        này) mà template cần — renderItemList() truyền NGUYÊN ctx cho MỌI item khi gọi templateFn.
 * @returns {string}
 */
function itemTemplateDocumentRow(doc, ctx) {
    const isActive = !!(ctx && doc.key === ctx.activeDocumentKey);
    const iconBg = doc.format === 'docx' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600';
    const rowClass = isActive ? 'bg-sky-50 border border-sky-300' : 'hover:bg-slate-100 border border-transparent';
    return `
        <button type="button" class="generic-item-document-row w-full text-left px-4 py-3.5 rounded-xl mb-1.5 flex items-center gap-3 transition-colors ${rowClass}" data-document-key="${escapeHtml(doc.key)}">
            <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <span class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(doc.title)}</span>
        </button>
    `;
}

/**
 * Dựng 1 danh sách item bằng cách gán `containerEl.innerHTML` (nếu có) **1 LẦN DUY NHẤT** (thay N
 * lần createElement+appendChild) — đủ mượt tới ~100-200 item trên mobile webview (xem docstring
 * đầu file). Hàm THUẦN, KHÔNG tự gắn sự kiện click — nơi gọi (Workflow) tự querySelector +
 * addEventListener SAU khi HTML đã vào DOM thật (xem event/workflow/document-reader.js).
 * @param {HTMLElement|null} containerEl - truyền `null` nếu CHỈ cần chuỗi HTML trả về (vd để làm
 *        `bodyHtml` cho openGenericDrawer()/updateGenericDrawer() — nơi đó mới THẬT SỰ gán vào
 *        DOM, gán 2 lần là thừa).
 * @param {Array<Object>} items
 * @param {(item: Object, ctx?: Object) => string} templateFn
 * @param {Object} [ctx] - dữ liệu NGOÀI item dùng chung cho MỌI item (vd activeDocumentKey).
 * @returns {string} chuỗi HTML đã dựng.
 */
function renderItemList(containerEl, items, templateFn, ctx) {
    const html = items.map((item) => templateFn(item, ctx)).join('');
    if (containerEl) containerEl.innerHTML = html;
    return html;
}
