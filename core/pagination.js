/**
 * core/pagination.js — Pagination DÙNG CHUNG (mới, 14/07/2026, tích hợp Generic Drawer/Item/
 * windowing — Giang yêu cầu). KHÔNG gắn riêng 1 tính năng nào — file này KHÔNG biết gì về
 * "folder"/"song"/... — chỉ nhận `items`/`pageIndex`/`pageSize` thuần.
 *
 * SỬA (23/09/2026, Giang yêu cầu "cải tiến theo đề xuất + dùng key theme + đem cài đặt vào Settings >
 * System > Pagination, áp dụng chung cho mọi nơi dùng pagination"):
 *   - Dãy số trang ('list'/'full') RÚT GỌN bằng dấu "…" — luôn giữ trang đầu + trang cuối + trang
 *     hiện tại ± PAGINATION_SIBLING_COUNT, tối đa 2*sibling+5 ô (= 7) dù có bao nhiêu trang. Trước đây
 *     render TOÀN BỘ số trang (50 trang = 50 nút). Dãy ô do `computePaginationPageSlots()` tính (core
 *     riêng — kết quả có ý nghĩa nghiệp vụ riêng, KHÔNG làm hàm con được, Rule 3c), Workflow tính xong
 *     truyền vào template (Rule 3 — template KHÔNG tự gọi).
 *   - 'arrow' thêm 2 nút về trang đầu/cuối (« ») — 'list'/'full' KHÔNG cần (trang 1 + trang cuối luôn
 *     hiện sẵn trong dãy số rút gọn).
 *   - Style MỚI 'loadMore' — 1 nút "Tải thêm" (cộng dồn), tính trang bằng `computeLoadMorePage()`.
 *   - Mọi nút có `aria-label` (t()), trang hiện tại có `aria-current="page"`, khung là `<nav>`.
 *   - MỌI màu đi qua theme key (`data-uitk`) — KHÔNG còn class màu Tailwind nào trong file này. Nơi
 *     gọi chèn HTML xong PHẢI tự `applyUiThemeToDom(containerEl, _activeUiThemeKeyList)` (core/ui-
 *     theme/apply-ui.js) — Generic Drawer tự làm cho nội dung của nó lúc `openGenericDrawer()`/
 *     `updateGenericDrawer()`, chèn LẠI sau đó (vd đổi trang) thì phải tự gọi.
 *   - MỌI nút (kể cả ‹ › « » và "Tải thêm") mang sẵn `data-page-index` = trang ĐÍCH khi bấm — nơi wire
 *     (core/pagination-ui.js::wirePaginationControls()) chỉ việc đọc 1 thuộc tính đó, KHÔNG cần biết
 *     trang hiện tại để tự cộng/trừ. `data-pagination-action` (first/prev/next/last/goto/loadMore) giữ
 *     lại cho CSS/đọc code.
 *
 * Bật/tắt + page size + style RIÊNG TỪNG NƠI — domain config 'pagination' (core/config.js::
 * DEFAULT_PAGINATION_CONFIG.places), Settings > System > Pagination. `event/workflow/pagination.js`
 * (workflowPagination) đọc config của ĐÚNG nơi rồi CHỌN hàm tính trang + template theo style — nơi dùng
 * pagination chỉ gọi workflow đó, KHÔNG tự gọi thẳng các hàm dưới đây (sẽ bỏ qua cài đặt).
 *
 * `computePage()`/`computeLoadMorePage()`/`computePaginationPageSlots()` — core NGHIỆP VỤ THUẦN (Rule
 * 1-4): không DOM, không appState, không gọi core khác (chỉ toán học kẹp giá trị — cùng tinh thần
 * `computeVirtualWindowRange()` ở components/items.js).
 *
 * `buildPagination*Html()` — 4 hàm TEMPLATE riêng, mỗi style 1 hàm (tinh thần `itemTemplateFolderTile()`
 * ở components/items.js — KHÔNG gộp chung 1 hàm rồi rẽ nhánh theo style bên trong, Rule 1 "nơi gọi tự
 * chọn đúng hàm"). HTML nút ‹/›/«/» VIẾT LẶP LẠI trong TỪNG hàm cần nó (KHÔNG trích hàm phụ top-level —
 * Rule 3, xem ghi chú bản 14/07); phần DÙNG CHUNG được là DỮ LIỆU (hằng class/path icon ngay dưới), không
 * phải hàm. Không hàm nào tự `addEventListener`.
 *
 * NẠP SAU: lang/lang.js (t/tFormat — nhãn aria + chữ "Tải thêm").
 */

/** Số trang kề 2 bên trang hiện tại trong dãy số rút gọn ('list'/'full'). 1 -> tối đa 7 ô
 * (1 … 4 5 6 … 20) — vừa màn điện thoại (~9 nút x 32px kể cả ‹ ›). */
const PAGINATION_SIBLING_COUNT = 1;

/** Biên ô NHẬP SỐ "số item/trang" ở Settings > System > Pagination (Giang chốt: không chọn cứng sẵn, người
 * dùng tự nhập, tối đa 200). Mặc định 20 — DEFAULT_PAGINATION_PLACE, core/config.js. */
const PAGINATION_PAGE_SIZE_MIN = 1;
const PAGINATION_PAGE_SIZE_MAX = 200;

/** Các NƠI dùng được pagination — mỗi nơi 1 hàng checkbox + ô số + select kiểu RIÊNG ở Settings (THỨ TỰ
 * HIỂN THỊ). `key` PHẢI khớp `DEFAULT_PAGINATION_CONFIG.places` (core/config.js). Danh sách
 * Playlist CHÍNH (main UI) CỐ Ý không có (Giang chốt loại bỏ) — preset Filter thì CÓ.
 *   statisTopList — Statistics > Top media (tắt = giữ Top 20 như cũ)
 *   debugConsole  — Troubleshooting > Debug console (bật = log MỚI NHẤT lên đầu, trang 1 = mới nhất)
 *   folderBrowser — App Panel > Folder (lưới thư mục; ô "Tạo mới" luôn ở cuối trang)
 *   motionPresets — Settings > System > Motion (danh sách preset)
 *   filterPresets — Settings > Playlist > Lọc (danh sách preset Filter của Nguồn đang chọn)
 *   eqPresets     — giữ nút EQ ở Visualizer > danh sách preset EQ */
const PAGINATION_PLACES = [
    { key: 'statisTopList', labelKey: 'appSettings.pagination.place.statisTopList', hintKey: 'appSettings.pagination.place.statisTopList.hint' },
    { key: 'debugConsole', labelKey: 'appSettings.pagination.place.debugConsole', hintKey: 'appSettings.pagination.place.debugConsole.hint' },
    { key: 'folderBrowser', labelKey: 'appSettings.pagination.place.folderBrowser', hintKey: 'appSettings.pagination.place.folderBrowser.hint' },
    { key: 'motionPresets', labelKey: 'appSettings.pagination.place.motionPresets', hintKey: 'appSettings.pagination.place.motionPresets.hint' },
    { key: 'filterPresets', labelKey: 'appSettings.pagination.place.filterPresets', hintKey: 'appSettings.pagination.place.filterPresets.hint' },
    { key: 'eqPresets', labelKey: 'appSettings.pagination.place.eqPresets', hintKey: 'appSettings.pagination.place.eqPresets.hint' },
];

/** Danh sách style cho select ở Settings — THỨ TỰ HIỂN THỊ. `value` khớp key bảng tra
 * PAGINATION_STYLE_HANDLERS (event/workflow/pagination.js). */
const PAGINATION_STYLES = [
    { value: 'arrow', labelKey: 'pagination.style.arrow' },
    { value: 'list', labelKey: 'pagination.style.list' },
    { value: 'full', labelKey: 'pagination.style.full' },
    { value: 'loadMore', labelKey: 'pagination.style.loadMore' },
];

/** Class CẤU TRÚC dùng chung cho mọi nút tròn 32px (không chứa màu — màu qua data-uitk). */
const PAGINATION_BTN_CLASS = 'w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold shrink-0 disabled:opacity-30 disabled:pointer-events-none';

/** Path SVG (stroke) của 4 nút điều hướng. */
const PAGINATION_ICON_PATH = {
    first: 'M11 19l-7-7 7-7m8 14l-7-7 7-7',
    prev: 'M15 19l-7-7 7-7',
    next: 'M9 5l7 7-7 7',
    last: 'M13 5l7 7-7 7M5 5l7 7-7 7',
};

/**
 * Tính đúng 1 "trang" của `items` — THUẦN, không side-effect. Dùng cho 'arrow'/'list'/'full'.
 * @param {Array} items - mảng ĐẦY ĐỦ (chưa cắt trang).
 * @param {number} pageIndex - 0-based, tự KẸP về [0, totalPages-1] nếu truyền lệch (vd trang cuối
 *        vừa bị xoá hết item) — nơi gọi không cần tự kẹp trước.
 * @param {number} pageSize - số item/trang, tối thiểu 1.
 * @returns {{pageItems: Array, pageIndex: number, totalPages: number, totalCount: number, startIndex: number, hasPrev: boolean, hasNext: boolean}}
 *          `startIndex` = vị trí (0-based, trong `items`) của phần tử ĐẦU trang — dùng đánh số thứ hạng
 *          liên tục qua các trang (vd Top list: trang 2 bắt đầu từ #21).
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
        totalCount: items.length,
        startIndex: start,
        hasPrev: clampedIndex > 0,
        hasNext: clampedIndex < totalPages - 1,
    };
}

/**
 * MỚI (23/09/2026) — style 'loadMore': CỘNG DỒN từ đầu danh sách tới hết "trang" `pageIndex`
 * (`pageIndex` = số lần đã bấm "Tải thêm", 0 = mới vào). CÙNG hình dạng kết quả với computePage() để
 * nơi dùng không phải phân biệt style. `hasPrev` luôn false (không có khái niệm lùi trang).
 * @param {Array} items @param {number} pageIndex @param {number} pageSize
 * @returns {{pageItems: Array, pageIndex: number, totalPages: number, totalCount: number, startIndex: number, hasPrev: boolean, hasNext: boolean}}
 */
function computeLoadMorePage(items, pageIndex, pageSize) {
    const safePageSize = Math.max(1, pageSize);
    const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
    const clampedIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
    return {
        pageItems: items.slice(0, (clampedIndex + 1) * safePageSize),
        pageIndex: clampedIndex,
        totalPages,
        totalCount: items.length,
        startIndex: 0,
        hasPrev: false,
        hasNext: clampedIndex < totalPages - 1,
    };
}

/**
 * MỚI (23/09/2026) — dãy ô số trang RÚT GỌN cho 'list'/'full': luôn có trang đầu, trang cuối, trang
 * hiện tại ± `siblingCount`; khoảng bị lược = `null` (template vẽ "…"). Số ô LUÔN = 2*siblingCount+5
 * khi `totalPages` vượt ngưỡng đó (thanh không nhảy độ rộng lúc chuyển trang), ít trang hơn -> đủ mọi trang.
 * Vd (sibling 1, 20 trang): trang 1 -> [0,1,2,3,4,null,19]; trang 10 -> [0,null,8,9,10,null,19].
 * @param {number} pageIndex - 0-based (tự kẹp) @param {number} totalPages @param {number} siblingCount
 * @returns {Array<number|null>} chỉ số trang 0-based, `null` = "…"
 */
function computePaginationPageSlots(pageIndex, totalPages, siblingCount) {
    const total = Math.max(1, totalPages);
    const current = Math.max(0, Math.min(pageIndex, total - 1));
    const maxSlots = 2 * siblingCount + 5;
    const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
    if (total <= maxSlots) return range(0, total - 1);

    const left = Math.max(current - siblingCount, 1);
    const right = Math.min(current + siblingCount, total - 2);
    const showLeftEllipsis = left > 2;
    const showRightEllipsis = right < total - 3;
    const edgeCount = 3 + 2 * siblingCount; // số ô liền nhau khi CHỈ 1 bên có "…"
    if (!showLeftEllipsis) return [...range(0, edgeCount - 1), null, total - 1];
    if (!showRightEllipsis) return [0, null, ...range(total - edgeCount, total - 1)];
    return [0, null, ...range(left, right), null, total - 1];
}

/** Style 'arrow' — « ‹ "trang hiện tại / tổng" › ». Trả CHUỖI RỖNG nếu `totalPages <= 1` (không có gì
 * để phân trang) — nơi gọi tự quyết ẩn container dựa vào chuỗi rỗng đó.
 * @param {number} pageIndex @param {number} totalPages @returns {string} */
function buildPaginationArrowsHtml(pageIndex, totalPages) {
    if (totalPages <= 1) return '';
    const isFirst = pageIndex <= 0;
    const isLast = pageIndex >= totalPages - 1;
    return `
        <nav class="flex items-center justify-center gap-1 py-2" aria-label="${t('pagination.ariaLabel')}" data-pagination-style="arrow">
            <button type="button" data-pagination-action="first" data-page-index="0" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.first')}" ${isFirst ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${PAGINATION_ICON_PATH.first}" /></svg>
            </button>
            <button type="button" data-pagination-action="prev" data-page-index="${Math.max(0, pageIndex - 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.prev')}" ${isFirst ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${PAGINATION_ICON_PATH.prev}" /></svg>
            </button>
            <span class="text-xs font-mono tabular-nums text-center px-2" data-uitk="textSecondary" style="min-width:64px;">${pageIndex + 1} / ${totalPages}</span>
            <button type="button" data-pagination-action="next" data-page-index="${Math.min(totalPages - 1, pageIndex + 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.next')}" ${isLast ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${PAGINATION_ICON_PATH.next}" /></svg>
            </button>
            <button type="button" data-pagination-action="last" data-page-index="${totalPages - 1}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.last')}" ${isLast ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${PAGINATION_ICON_PATH.last}" /></svg>
            </button>
        </nav>
    `;
}

/** Style 'list' — dãy số trang RÚT GỌN (1 … 4 5 6 … 20), bấm thẳng vào số, KHÔNG có nút ‹ ›. Trả CHUỖI
 * RỖNG nếu chỉ có 1 trang.
 * @param {number} pageIndex @param {Array<number|null>} pageSlots - computePaginationPageSlots()
 * @returns {string} */
function buildPaginationListHtml(pageIndex, pageSlots) {
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
function buildPaginationFullHtml(pageIndex, totalPages, pageSlots) {
    if (totalPages <= 1) return '';
    const slotsHtml = pageSlots.map((slot) => (slot === null
        ? '<span class="w-8 h-8 flex items-center justify-center text-xs select-none shrink-0" data-uitk="textMutedIcon" aria-hidden="true">…</span>'
        : `<button type="button" data-pagination-action="goto" data-page-index="${slot}" class="${PAGINATION_BTN_CLASS}" data-uitk="${slot === pageIndex ? 'btnPrimaryPillBg textOnAccent' : 'textSecondary btnGhostHoverBg'}" aria-label="${tFormat('pagination.page', { n: slot + 1 })}" ${slot === pageIndex ? 'aria-current="page"' : ''}>${slot + 1}</button>`
    )).join('');
    return `
        <nav class="flex items-center justify-center gap-1 flex-wrap py-2" aria-label="${t('pagination.ariaLabel')}" data-pagination-style="full">
            <button type="button" data-pagination-action="prev" data-page-index="${Math.max(0, pageIndex - 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.prev')}" ${pageIndex <= 0 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${PAGINATION_ICON_PATH.prev}" /></svg>
            </button>
            ${slotsHtml}
            <button type="button" data-pagination-action="next" data-page-index="${Math.min(totalPages - 1, pageIndex + 1)}" class="${PAGINATION_BTN_CLASS}" data-uitk="textSecondary btnGhostHoverBg" aria-label="${t('pagination.next')}" ${pageIndex >= totalPages - 1 ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${PAGINATION_ICON_PATH.next}" /></svg>
            </button>
        </nav>
    `;
}

/** MỚI (23/09/2026) — style 'loadMore': 1 nút "Tải thêm · đã hiện / tổng". Trả CHUỖI RỖNG khi đã hiện
 * hết (`hasNext` false) — danh sách tự kết thúc, không còn nút.
 * @param {number} pageIndex - computeLoadMorePage().pageIndex @param {boolean} hasNext
 * @param {number} shownCount - pageItems.length @param {number} totalCount @returns {string} */
function buildPaginationLoadMoreHtml(pageIndex, hasNext, shownCount, totalCount) {
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
