/**
 * core/pagination.js — pagination dùng chung: chỉ nhận `items`/`pageIndex`/`pageSize` thuần, không biết danh sách nào.
 *
 * - Dãy số trang ('list'/'full') rút gọn bằng "…": luôn giữ trang đầu + cuối + trang hiện tại ± PAGINATION_SIBLING_COUNT
 *   (tối đa 2*sibling+5 ô) — computePaginationPageSlots(). 'arrow' có thêm « »; 'loadMore' cộng dồn (computeLoadMorePage()).
 * - Template 4 style: components/pagination-controls.js — mọi nút mang `data-page-index` = trang ĐÍCH, mọi màu qua theme
 *   key (`data-uitk`); chèn HTML ngoài lúc Generic Drawer dựng thì nơi gọi tự `applyUiThemeToDom()`.
 * - Bật/tắt + page size + style riêng từng nơi (core/config.js::DEFAULT_PAGINATION_CONFIG.places, Settings > System >
 *   Pagination) — nơi dùng chỉ gọi event/workflow/pagination.js (workflowPagination), không gọi thẳng các hàm dưới.
 *
 * Mọi hàm thuần: không DOM, không appState, không gọi core khác.
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

/** Cài đặt đã chuẩn hoá của 1 nơi — giá trị lạ (meta cũ/hỏng, style đã bỏ, số ngoài biên) rơi về mặc định / bị kẹp.
 * @param {object|undefined} place - appConfigPagination.getAll().places[key] @param {{pageSize:number, style:string}} defaults
 * @returns {{enabled:boolean, pageSize:number, style:string}} */
function sanitizePaginationPlace(place, defaults) {
    const p = place || {};
    const size = Math.round(Number(p.pageSize));
    return {
        enabled: p.enabled === true,
        pageSize: Number.isFinite(size) ? Math.max(PAGINATION_PAGE_SIZE_MIN, Math.min(PAGINATION_PAGE_SIZE_MAX, size)) : defaults.pageSize,
        style: PAGINATION_STYLES.some((st) => st.value === p.style) ? p.style : defaults.style,
    };
}

/** Ô nhập số item/trang (chuỗi từ `<input type=number>`): làm tròn + kẹp [MIN, MAX]; rỗng/không phải số -> không hợp lệ.
 * @param {string|number} value @returns {{isValid: boolean, size: number}} */
function resolvePaginationPageSizeInput(value) {
    const size = Math.round(Number(value));
    return { isValid: value !== '' && Number.isFinite(size), size: Math.max(PAGINATION_PAGE_SIZE_MIN, Math.min(PAGINATION_PAGE_SIZE_MAX, size)) };
}

/** Trang (0-based) chứa item thứ `itemIndex`. @param {number} itemIndex @param {number} pageSize @returns {number} */
function computePaginationPageOfItem(itemIndex, pageSize) {
    return Math.floor(itemIndex / pageSize);
}
