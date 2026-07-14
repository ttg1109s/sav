/**
 * core/pagination.js — Pagination DÙNG CHUNG (mới, 14/07/2026, tích hợp Generic Drawer/Item/
 * windowing — Giang yêu cầu). KHÔNG gắn riêng 1 tính năng nào — nơi đầu tiên dùng là File Manager
 * -> Song -> danh sách Folder (10 folder/trang, xem event/workflow/file-manager-song.js), nhưng
 * file này KHÔNG biết gì về "folder" — chỉ nhận `items`/`pageIndex`/`pageSize` thuần.
 *
 * `computePage()` — core NGHIỆP VỤ đúng nghĩa (chịu Rule 1-4 core-function-conventions.md): THUẦN,
 * không DOM, không appState, không gọi core nào khác, không rẽ nhánh tiến trình (chỉ toán học kẹp
 * giá trị — cùng tinh thần `computeVirtualWindowRange()` ở components/items.js).
 *
 * `buildPagination*Html()` — 3 hàm TEMPLATE riêng (tinh thần `itemTemplateDocumentRow()` ở
 * components/items.js: mỗi kiểu hiển thị = 1 hàm riêng, KHÔNG gộp chung 1 hàm rồi rẽ nhánh theo
 * tham số `control` bên trong — đúng Rule 1 "nơi gọi tự chọn đúng hàm", không phải core tự chọn).
 * Nơi gọi (Workflow) tự quyết định gọi hàm nào theo `control` mình muốn:
 *   - 'arrow'     -> buildPaginationArrowsHtml() — CHỈ 2 nút ‹ › (không hiện số trang).
 *   - 'list'      -> buildPaginationListHtml()   — dãy số trang (1 2 3 ...), bấm thẳng vào số.
 *   - 'full'      -> buildPaginationFullHtml()   — 2 nút ‹ › + "trang hiện tại / tổng số trang".
 * Không hàm nào tự `addEventListener` (chỉ trả chuỗi HTML, giống mọi template khác trong
 * components/items.js) — nơi gọi tự wire sự kiện SAU khi đã chèn vào DOM thật.
 *
 * ID dùng trong 3 template CỐ Ý generic (`data-pagination-action="prev"/"next"/"goto"`,
 * `data-page-index`) — KHÔNG gắn `id` duy nhất kiểu `#file-manager-...` NGAY TRONG file này (đó là
 * việc của nơi gọi bọc thêm 1 container `id` RIÊNG bên ngoài, giữ file này trung tính/tái dùng
 * được cho bất kỳ danh sách phân trang nào khác sau này).
 *
 * NẠP SAU: không phụ thuộc gì (core THUẦN, không cần core/dom-refs.js).
 */

/**
 * Tính đúng 1 "trang" của `items` — THUẦN, không side-effect.
 * @param {Array} items - mảng ĐẦY ĐỦ (chưa cắt trang).
 * @param {number} pageIndex - 0-based, sẽ tự KẸP về khoảng hợp lệ [0, totalPages-1] nếu truyền
 *        lệch (vd trang cuối cùng vừa bị xoá hết item) — nơi gọi không cần tự kẹp trước.
 * @param {number} pageSize - số item/trang, tối thiểu 1.
 * @returns {{pageItems: Array, pageIndex: number, totalPages: number, hasPrev: boolean, hasNext: boolean}}
 */
function computePage(items, pageIndex, pageSize) {
    const safePageSize = Math.max(1, pageSize);
    const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
    const clampedIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
    const start = clampedIndex * safePageSize;
    return {
        pageItems: items.slice(start, start + safePageSize),
        pageIndex: clampedIndex,
        totalPages,
        hasPrev: clampedIndex > 0,
        hasNext: clampedIndex < totalPages - 1,
    };
}

/** Control 'arrow' — CHỈ 2 nút ‹ › (không hiện số trang). Trả CHUỖI RỖNG nếu `totalPages <= 1`
 * (không có gì để phân trang) — nơi gọi tự quyết định có ẩn hẳn container hay không dựa vào chuỗi
 * rỗng đó, KHÔNG cần tự kiểm tra `totalPages` riêng.
 * @param {number} pageIndex @param {number} totalPages @returns {string} */
function buildPaginationArrowsHtml(pageIndex, totalPages) {
    if (totalPages <= 1) return '';
    return `
        <div class="flex items-center justify-center gap-3 py-2">
            <button type="button" data-pagination-action="prev" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 disabled:opacity-30 disabled:pointer-events-none" ${pageIndex <= 0 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button type="button" data-pagination-action="next" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 disabled:opacity-30 disabled:pointer-events-none" ${pageIndex >= totalPages - 1 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    `;
}

/** Control 'list' — dãy số trang bấm thẳng (1 2 3 ...), trang hiện tại tô nổi bật. Trả CHUỖI RỖNG
 * nếu `totalPages <= 1`.
 * @param {number} pageIndex @param {number} totalPages @returns {string} */
function buildPaginationListHtml(pageIndex, totalPages) {
    if (totalPages <= 1) return '';
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
        const isActive = i === pageIndex;
        pages.push(`
            <button type="button" data-pagination-action="goto" data-page-index="${i}" class="w-8 h-8 rounded-full text-xs font-semibold transition-colors ${isActive ? 'bg-sky-500 text-white' : 'hover:bg-white/10 text-slate-300'}">${i + 1}</button>
        `);
    }
    return `<div class="flex items-center justify-center gap-1.5 flex-wrap py-2">${pages.join('')}</div>`;
}

/** Control 'full' — 2 nút ‹ › + "trang hiện tại / tổng số trang". Trả CHUỖI RỖNG nếu
 * `totalPages <= 1`.
 * @param {number} pageIndex @param {number} totalPages @returns {string} */
function buildPaginationFullHtml(pageIndex, totalPages) {
    if (totalPages <= 1) return '';
    return `
        <div class="flex items-center justify-center gap-4 py-2">
            <button type="button" data-pagination-action="prev" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 disabled:opacity-30 disabled:pointer-events-none" ${pageIndex <= 0 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span class="text-xs font-mono text-slate-400 tabular-nums">${pageIndex + 1} / ${totalPages}</span>
            <button type="button" data-pagination-action="next" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 disabled:opacity-30 disabled:pointer-events-none" ${pageIndex >= totalPages - 1 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    `;
}
