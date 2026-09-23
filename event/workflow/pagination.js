/**
 * event/workflow/pagination.js — MỚI (23/09/2026, Giang yêu cầu). "THẰNG THỰC THI CUỐI" cho domain
 * 'pagination' (core/config.js::DEFAULT_PAGINATION_CONFIG) + là CỬA DUY NHẤT để 1 danh sách dùng
 * pagination — đọc cài đặt RIÊNG của đúng nơi (`placeKey`, PAGINATION_PLACES ở core/pagination.js) rồi
 * chọn đúng hàm core theo style (Rule 1 — core không tự rẽ nhánh theo style).
 *
 * SỬA (23/09/2026, Giang: "những nơi áp dụng được liệt kê checkbox vuông tại setting, khi true thì nơi
 * đó áp dụng, mỗi checkbox có ô nhập item/page + style riêng") — bỏ cài đặt chung, mỗi nơi 1 bộ
 * {enabled, pageSize, style}. Nơi đang TẮT -> `computePlaceView()` trả view "đi thẳng" (toàn bộ
 * `items`, style null) và `buildControlsHtml()` trả '' — nơi dùng KHÔNG cần tự rẽ nhánh bật/tắt.
 *
 * Persist qua `meta.paginationConfig` (IndexedDB, `setMeta()` mỗi lần đổi, KHÔNG debounce — tần suất
 * đổi cực thấp), cùng khuôn event/workflow/player-display-settings.js. Settings gọi trực tiếp từ
 * workflowAppSettings (cùng cách workflowPlayerDisplaySettings).
 *
 * CÁCH MỘT DANH SÁCH DÙNG (nơi dùng tự giữ `pageIndex` của riêng nó trong Workflow của mình):
 *   const view = workflowPagination.computePlaceView('<placeKey>', items, pageIndex);
 *   this._pageIndex = view.pageIndex;                                  // giá trị đã kẹp
 *   ...vẽ view.pageItems (đánh số từ view.startIndex nếu cần)...
 *   controlsEl.innerHTML = workflowPagination.buildControlsHtml(view); // '' nếu tắt / 1 trang / tải hết
 *   applyUiThemeToDom(controlsEl, _activeUiThemeKeyList);              // nếu chèn ngoài lúc Generic Drawer dựng
 *   wirePaginationControls(controlsEl, '<router>', '<type>');          // core/pagination-ui.js (hoặc delegate sẵn có)
 * Đổi dữ liệu nguồn (lọc/sắp xếp) thì nơi dùng tự đưa `pageIndex` về 0; muốn nhảy tới trang chứa 1 item
 * cụ thể -> `pageIndexOfItem()`. Style 'loadMore' dùng CÙNG luồng (`view.pageItems` = phần cộng dồn).
 * Đổi cài đặt ở Settings KHÔNG tự dựng lại danh sách nào đang mở — lần dựng sau tự đọc cài đặt mới.
 *
 * NẠP SAU: core/config.js (appConfigPagination, DEFAULT_PAGINATION_PLACE), core/pagination.js,
 * service/db.js (getMeta/setMeta).
 * NẠP TRƯỚC: event/workflow/app-settings.js, event/workflow/app-boot.js và MỌI workflow nơi dùng.
 */

/** Bảng tra style -> (hàm tính trang, hàm dựng HTML thanh điều khiển). Đây là chỗ DUY NHẤT nối style
 * với hàm core — thêm style mới = thêm 1 dòng ở đây + 1 mục PAGINATION_STYLES (core/pagination.js).
 * Bọc arrow function (không gán thẳng tên hàm) để không phụ thuộc thứ tự nạp lúc khởi tạo object. */
const PAGINATION_STYLE_HANDLERS = {
    arrow: {
        compute: (items, pageIndex, pageSize) => computePage(items, pageIndex, pageSize), // core/pagination.js
        buildHtml: (view) => buildPaginationArrowsHtml(view.pageIndex, view.totalPages), // core/pagination.js
    },
    list: {
        compute: (items, pageIndex, pageSize) => computePage(items, pageIndex, pageSize),
        buildHtml: (view) => buildPaginationListHtml(view.pageIndex, computePaginationPageSlots(view.pageIndex, view.totalPages, PAGINATION_SIBLING_COUNT)),
    },
    full: {
        compute: (items, pageIndex, pageSize) => computePage(items, pageIndex, pageSize),
        buildHtml: (view) => buildPaginationFullHtml(view.pageIndex, view.totalPages, computePaginationPageSlots(view.pageIndex, view.totalPages, PAGINATION_SIBLING_COUNT)),
    },
    loadMore: {
        compute: (items, pageIndex, pageSize) => computeLoadMorePage(items, pageIndex, pageSize), // core/pagination.js
        buildHtml: (view) => buildPaginationLoadMoreHtml(view.pageIndex, view.hasNext, view.pageItems.length, view.totalCount), // core/pagination.js
    },
};

/** Trang mẫu cho khung Preview ở Settings — 12 trang, đang ở trang 5 (đủ để dãy số hiện cả 2 dấu "…"). */
const PAGINATION_PREVIEW_TOTAL_PAGES = 12;
const PAGINATION_PREVIEW_PAGE_INDEX = 4;

const workflowPagination = {

    /** Cài đặt ĐÃ CHUẨN HOÁ của 1 nơi — giá trị lạ (meta cũ/hỏng, style đã bỏ, số ngoài biên) rơi về
     * mặc định / bị kẹp, để nơi dùng luôn nhận 1 bộ hợp lệ.
     * @param {string} placeKey @returns {{enabled:boolean, pageSize:number, style:string}} */
    getPlaceSettings(placeKey) {
        const place = (appConfigPagination.getAll().places || {})[placeKey] || {}; // core/config.js
        const size = Math.round(Number(place.pageSize));
        return {
            enabled: place.enabled === true,
            pageSize: Number.isFinite(size) ? Math.max(PAGINATION_PAGE_SIZE_MIN, Math.min(PAGINATION_PAGE_SIZE_MAX, size)) : DEFAULT_PAGINATION_PLACE.pageSize,
            style: PAGINATION_STYLE_HANDLERS[place.style] ? place.style : DEFAULT_PAGINATION_PLACE.style,
        };
    },

    /** Cắt trang `items` theo cài đặt của `placeKey`. Kết quả = kết quả core (pageItems/pageIndex/
     * totalPages/totalCount/startIndex/hasPrev/hasNext) + `style`. Nơi đang TẮT -> toàn bộ `items`,
     * `style` null (buildControlsHtml() trả '').
     * @param {string} placeKey @param {Array} items @param {number} pageIndex */
    computePlaceView(placeKey, items, pageIndex) {
        const { enabled, pageSize, style } = this.getPlaceSettings(placeKey);
        if (!enabled) return { pageItems: items, pageIndex: 0, totalPages: 1, totalCount: items.length, startIndex: 0, hasPrev: false, hasNext: false, style: null };
        return this._computeViewWith(style, items, pageIndex, pageSize);
    },

    /** Trang (0-based) chứa item thứ `itemIndex` theo cài đặt của `placeKey` — dùng để mở danh sách đúng
     * trang có item đang chọn / vừa tạo. Nơi TẮT -> 0. Đúng cho cả 'loadMore' (cộng dồn tới trang đó là
     * thấy item). @param {string} placeKey @param {number} itemIndex @returns {number} */
    pageIndexOfItem(placeKey, itemIndex) {
        const { enabled, pageSize } = this.getPlaceSettings(placeKey);
        if (!enabled || itemIndex < 0) return 0;
        return Math.floor(itemIndex / pageSize);
    },

    /** @param {string} style - đã chuẩn hoá @param {Array} items @param {number} pageIndex @param {number} pageSize */
    _computeViewWith(style, items, pageIndex, pageSize) {
        return { ...PAGINATION_STYLE_HANDLERS[style].compute(items, pageIndex, pageSize), style };
    },

    /** HTML thanh phân trang cho `view` — '' nếu nơi đó tắt / chỉ 1 trang / đã tải hết.
     * @param {object} view - computePlaceView() @returns {string} */
    buildControlsHtml(view) {
        return view.style ? PAGINATION_STYLE_HANDLERS[view.style].buildHtml(view) : '';
    },

    /** HTML Preview của 1 nơi ở Settings — chạy ĐÚNG pipeline thật trên 1 danh sách mẫu
     * PAGINATION_PREVIEW_TOTAL_PAGES trang theo pageSize/style của nơi đó (bỏ qua bật/tắt).
     * @param {string} placeKey @returns {string} */
    buildPreviewHtml(placeKey) {
        const { pageSize, style } = this.getPlaceSettings(placeKey);
        const sampleItems = Array.from({ length: pageSize * PAGINATION_PREVIEW_TOTAL_PAGES }, (_, i) => i);
        return this.buildControlsHtml(this._computeViewWith(style, sampleItems, PAGINATION_PREVIEW_PAGE_INDEX, pageSize));
    },

    /** Khôi phục cài đặt đã lưu LÚC BOOT — gọi từ event/workflow/app-boot.js. Gộp THEO TỪNG NƠI (nơi mới
     * thêm sau lần lưu trước vẫn giữ mặc định đã seed; nơi đã bị bỏ khỏi PAGINATION_PLACES bị lờ đi). */
    async loadPersistedPaginationOnBoot() {
        const saved = await getMeta('paginationConfig'); // service/db.js
        if (!saved || typeof saved !== 'object' || !saved.places || typeof saved.places !== 'object') return;
        appConfigPagination.mutateAll((cfg) => { // core/config.js
            for (const place of PAGINATION_PLACES) {
                const savedPlace = saved.places[place.key];
                if (savedPlace && typeof savedPlace === 'object') cfg.places[place.key] = { ...cfg.places[place.key], ...savedPlace };
            }
        });
        console.log('writer: "loadPersistedPaginationOnBoot", page: "paginationConfig", content: "khôi phục từ meta.paginationConfig"');
    },

    /** Ghi 1 field của 1 nơi rồi persist. Nơi lạ -> bỏ qua. */
    async _setPlaceField(placeKey, field, value) {
        if (!PAGINATION_PLACES.some((p) => p.key === placeKey)) return;
        appConfigPagination.mutateAll((cfg) => { cfg.places[placeKey] = { ...cfg.places[placeKey], [field]: value }; }); // core/config.js
        console.log(`writer: "workflowPagination._setPlaceField", page: "paginationConfig", content: "${placeKey}.${field}=${value}"`);
        await setMeta('paginationConfig', appConfigPagination.getAll()); // service/db.js
    },

    /** Checkbox bật/tắt 1 nơi. @param {string} placeKey @param {boolean} enabled */
    async changePlaceEnabled(placeKey, enabled) {
        await this._setPlaceField(placeKey, 'enabled', enabled === true);
    },

    /** Ô nhập số item/trang của 1 nơi — `value` từ `<input type=number>` (chuỗi). Làm tròn + KẸP về
     * [PAGINATION_PAGE_SIZE_MIN, PAGINATION_PAGE_SIZE_MAX]; rỗng/không phải số -> BỎ QUA (giữ giá trị cũ —
     * nơi gọi dựng lại màn nên ô tự hiện lại số cũ). @param {string} placeKey @param {string|number} value */
    async changePlacePageSize(placeKey, value) {
        const size = Math.round(Number(value));
        if (value === '' || !Number.isFinite(size)) return;
        await this._setPlaceField(placeKey, 'pageSize', Math.max(PAGINATION_PAGE_SIZE_MIN, Math.min(PAGINATION_PAGE_SIZE_MAX, size)));
    },

    /** Select kiểu của 1 nơi. Style lạ -> bỏ qua. @param {string} placeKey @param {string} style */
    async changePlaceStyle(placeKey, style) {
        if (!PAGINATION_STYLE_HANDLERS[style]) return;
        await this._setPlaceField(placeKey, 'style', style);
    },
};
