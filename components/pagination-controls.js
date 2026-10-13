/**
 * components/pagination-controls.js — template thanh phân trang, 4 style (arrow / list / full / loadMore). Chọn style +
 * dữ liệu: event/workflow/pagination.js (PAGINATION_STYLE_HANDLERS); wire click: core/pagination-ui.js.
 *
 * NẠP SAU: lang/lang.js (t, tFormat), core/ui-theme/icon-svg-ui.js (iconSvg).
 */

/** Class CẤU TRÚC dùng chung cho mọi nút tròn 32px (không chứa màu — màu qua data-uitk). */
const PAGINATION_BTN_CLASS = 'w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold shrink-0 disabled:opacity-30 disabled:pointer-events-none';

/** Icon của 4 nút điều hướng — tên trong assets/icon/icons.js. */
const PAGINATION_ICON_NAME = {
    first: 'chevron-double-left',
    prev: 'chevron-left',
    next: 'chevron-right',
    last: 'chevron-double-right',
};

/** Style 'arrow' — « ‹ "trang hiện tại / tổng" › ». Trả CHUỖI RỖNG nếu `totalPages <= 1` (không có gì
 * để phân trang) — nơi gọi tự quyết ẩn container dựa vào chuỗi rỗng đó.
 * @param {number} pageIndex @param {number} totalPages @returns {string} */
function renderPaginationArrowsHtml(pageIndex, totalPages) {
    if (totalPages <= 1) return '';
    const isFirst = pageIndex <= 0;
    const isLast = pageIndex >= totalPages - 1;
    return `
        <nav class="flex items-center justify-center gap-1 py-2" aria-label="${t('pagination.ariaLabel')}" data-pagination-style="arrow">
            <button type="button" data-pagination-action="first" data-page-index="0" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.first')}" ${isFirst ? 'disabled' : ''}>
                ${iconSvg(PAGINATION_ICON_NAME.first, 'h-4 w-4')}
            </button>
            <button type="button" data-pagination-action="prev" data-page-index="${Math.max(0, pageIndex - 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.prev')}" ${isFirst ? 'disabled' : ''}>
                ${iconSvg(PAGINATION_ICON_NAME.prev, 'h-4 w-4')}
            </button>
            <span class="text-xs font-mono tabular-nums text-center px-2" data-uitk="textSecondary" style="min-width:64px;">${pageIndex + 1} / ${totalPages}</span>
            <button type="button" data-pagination-action="next" data-page-index="${Math.min(totalPages - 1, pageIndex + 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.next')}" ${isLast ? 'disabled' : ''}>
                ${iconSvg(PAGINATION_ICON_NAME.next, 'h-4 w-4')}
            </button>
            <button type="button" data-pagination-action="last" data-page-index="${totalPages - 1}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.last')}" ${isLast ? 'disabled' : ''}>
                ${iconSvg(PAGINATION_ICON_NAME.last, 'h-4 w-4')}
            </button>
        </nav>
    `;
}

/** Style 'list' — dãy số trang RÚT GỌN (1 … 4 5 6 … 20), bấm thẳng vào số, KHÔNG có nút ‹ ›. Trả CHUỖI
 * RỖNG nếu chỉ có 1 trang.
 * @param {number} pageIndex @param {Array<number|null>} pageSlots - computePaginationPageSlots()
 * @returns {string} */
function renderPaginationListHtml(pageIndex, pageSlots) {
    if (pageSlots.length <= 1) return '';
    const slotsHtml = pageSlots.map((slot) => (slot === null
        ? '<span class="w-8 h-8 flex items-center justify-center text-xs select-none shrink-0" data-uitk="textMutedIcon" aria-hidden="true">…</span>'
        : `<button type="button" data-pagination-action="goto" data-page-index="${slot}" class="${PAGINATION_BTN_CLASS}" data-uitk="${slot === pageIndex ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary btnGhostHoverBg'}" aria-label="${tFormat('pagination.page', { n: slot + 1 })}" ${slot === pageIndex ? 'aria-current="page"' : ''}>${slot + 1}</button>`
    )).join('');
    return `<nav class="flex items-center justify-center gap-1 flex-wrap py-2" aria-label="${t('pagination.ariaLabel')}" data-pagination-style="list">${slotsHtml}</nav>`;
}

/** Style 'full' — 2 nút ‹ › BỌC NGOÀI dãy số rút gọn (‹ 1 … 4 5 6 … 20 ›). Trả CHUỖI RỖNG nếu chỉ có 1
 * trang.
 * @param {number} pageIndex @param {number} totalPages @param {Array<number|null>} pageSlots -
 *        computePaginationPageSlots() @returns {string} */
function renderPaginationFullHtml(pageIndex, totalPages, pageSlots) {
    if (totalPages <= 1) return '';
    const slotsHtml = pageSlots.map((slot) => (slot === null
        ? '<span class="w-8 h-8 flex items-center justify-center text-xs select-none shrink-0" data-uitk="textMutedIcon" aria-hidden="true">…</span>'
        : `<button type="button" data-pagination-action="goto" data-page-index="${slot}" class="${PAGINATION_BTN_CLASS}" data-uitk="${slot === pageIndex ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary btnGhostHoverBg'}" aria-label="${tFormat('pagination.page', { n: slot + 1 })}" ${slot === pageIndex ? 'aria-current="page"' : ''}>${slot + 1}</button>`
    )).join('');
    return `
        <nav class="flex items-center justify-center gap-1 flex-wrap py-2" aria-label="${t('pagination.ariaLabel')}" data-pagination-style="full">
            <button type="button" data-pagination-action="prev" data-page-index="${Math.max(0, pageIndex - 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.prev')}" ${pageIndex <= 0 ? 'disabled' : ''}>
                ${iconSvg(PAGINATION_ICON_NAME.prev, 'h-4 w-4')}
            </button>
            ${slotsHtml}
            <button type="button" data-pagination-action="next" data-page-index="${Math.min(totalPages - 1, pageIndex + 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.next')}" ${pageIndex >= totalPages - 1 ? 'disabled' : ''}>
                ${iconSvg(PAGINATION_ICON_NAME.next, 'h-4 w-4')}
            </button>
        </nav>
    `;
}

/** Style 'loadMore': 1 nút "Tải thêm · đã hiện / tổng". Trả CHUỖI RỖNG khi đã hiện
 * hết (`hasNext` false) — danh sách tự kết thúc, không còn nút.
 * @param {number} pageIndex - computeLoadMorePage().pageIndex @param {boolean} hasNext
 * @param {number} shownCount - pageItems.length @param {number} totalCount @returns {string} */
function renderPaginationLoadMoreHtml(pageIndex, hasNext, shownCount, totalCount) {
    if (!hasNext) return '';
    return `
        <nav class="flex items-center justify-center py-2" aria-label="${t('pagination.ariaLabel')}" data-pagination-style="loadMore">
            <button type="button" data-pagination-action="loadMore" data-page-index="${pageIndex + 1}" class="px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2" data-uitk="btnAccentSoft accentSoftBorder">
                <span>${t('pagination.loadMore')}</span>
                <span class="font-mono tabular-nums opacity-70">${tFormat('pagination.loadMoreCount', { shown: shownCount, total: totalCount })}</span>
            </button>
        </nav>
    `;
}
