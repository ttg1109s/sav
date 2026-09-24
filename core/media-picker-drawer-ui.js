/**
 * core/media-picker-drawer-ui.js — ĐỔI TÊN (24/09/2026) từ core/media-picker-drawer-helper.js (Rule 5c: file core wire
 * UI phải hậu tố `-ui`). Picker Generic Drawer "chọn 1 mục từ lưới media" (v13) dùng chung Ảnh/Video.
 *
 * SỬA (24/09/2026, dọn vi phạm core rule/event bus) — hàm cũ `openMediaPickerDrawerUi()` TÁCH 3:
 *   - `buildMediaPickerDrawerConfig()` — chỉ TRẢ config (bản cũ tự gọi `openGenericDrawer()`/`updateGenericDrawer()`
 *     = core gọi core, Rule 3; kèm rẽ nhánh theo tham số `updateInPlace`, Rule 1). Mở/thay do Workflow
 *     `workflowGenericDrawerHelpers.mountMediaPicker()` (event/workflow/generic-drawer-helpers.js).
 *   - `wireMediaPickerDrawerUi()` — wire nút X + click tile. Bản cũ gắn delegated click lên `genericDrawerBody`
 *     TĨNH (không tự mất theo innerHTML -> phải trả hàm gỡ, quên gỡ là chồng listener); nay gắn lên các con TRỰC
 *     TIẾP của body (DOM động của chính nội dung picker, tự mất khi nội dung bị thay) — hết cần hàm gỡ.
 *   - `wireMediaPickerConfirmButtonUi()` — nút Xác nhận (bản cũ rẽ nhánh `showConfirmButton` bên trong core).
 *
 * DỜI TỪ core/file-manager/photo-ui.js::openPhotoImagePickerDrawerUi(). Hàm gốc chỉ phục vụ lưới
 * ẢNH (router + selector tile hardcode), nên khi cần picker VIDEO thì đã có một bản sao gần y hệt
 * được viết ra — nay bản sao đó xoá, hàm gốc tham số hoá và dời ra file trung lập vì nó KHÔNG còn
 * thuộc miền Photo. (Ghi chú cũ về hậu tố `-helper` đã hết hiệu lực — xem ĐỔI TÊN ở đầu file.)
 *
 * KHÔNG gộp picker FOLDER vào đây — tile folder khác loại và đã có hạ tầng riêng
 * (`wireFolderPickerDrawerEvents()` + `workflowPlaylist._openFolderPickerDrawer()`).
 *
 * NẠP SAU: core/generic-drawer.js, core/dom-refs.js, service/z-index.js, lang/lang.js.
 */

/** Config Generic Drawer cho picker media (height/maxHeight 90vh, header "tiêu đề + nút X").
 * @param {string} title - đã dịch sẵn @param {string} bodyHtml @returns {object} config cho workflowGenericDrawerHelpers.open()/update() */
function buildMediaPickerDrawerConfig(title, bodyHtml) {
    return {
        height: '90vh',
        // SỬA (24/09/2026) — Generic Drawer giờ đặt `height` THẬT (không còn cơ chế min-height), 90vh là chiều cao cố định
        // thật; `maxHeight` giữ nguyên làm trần an toàn. Ghi chú cũ dưới đây mô tả cơ chế min-height đã bỏ.
        // SỬA (khôi phục — thiếu `maxHeight`, Giang báo "picker photo không bị kẹp max height") —
        // openGenericDrawer() KHÔNG có khái niệm "height cố định" thật sự (chỉ set `min-height`,
        // 1 SÀN — xem docstring core/generic-drawer.js), CHỈ `maxHeight` mới thật sự kẹp trần. Panel
        // này KHÔNG truyền `maxHeight` nên lưới ảnh/video (windowing IntersectionObserver tải trước
        // ~2 màn hình mỗi phía) có thể đẩy panel cao vượt hẳn 90vh, đẩy header/nút X ra ngoài màn
        // hình. Set trùng giá trị với `height` — mọi feature khác dùng cặp height:'auto'+maxHeight
        // (co theo nội dung, kẹp trần); picker này CỐ Ý giữ `height:'90vh'` cố định (Giang chỉ định
        // trước đây, xem docstring _openImagePickerDrawer() — event/workflow/file-manager-photo.js)
        // nên chỉ thêm `maxHeight` làm trần CHẶN, không đổi ý định gốc "luôn ~90vh".
        maxHeight: '90vh',
        zIndex: Z_INDEX.GENERIC_DRAWER, // service/z-index.js — mặc định, KHÔNG có modal xem ảnh nào mở đồng thời với picker này (khác action-menu cần z=131)
        headerHtml: `
            <div class="flex justify-between items-center px-5 pb-3" data-uitk="headerBorder">
                <h3 class="text-base font-bold" data-uitk="headerTitle">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `,
        bodyHtml,
        bodyClass: 'flex flex-col',
    };
}

/** Wire nút X (header) + click tile (delegated trên các con TRỰC TIẾP của body — DOM động của nội dung picker).
 * Callback CHỈ bắn eventBus (Rule 5a). Gọi NGAY SAU khi gắn nội dung.
 * @param {string} routerName @param {string} msgPrefix @param {string} tileSelector @param {string} tileDataKey */
function wireMediaPickerDrawerUi(routerName, msgPrefix, tileSelector, tileDataKey) {
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    const contentRoots = Array.from(genericDrawerBody.children);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} }));
    contentRoots.forEach((root) => root.addEventListener('click', (e) => {
        const tile = e.target.closest(tileSelector);
        if (!tile) return;
        eventBus.send({ router: routerName, type: `${msgPrefix}.tile.click`, payload: { [tileDataKey]: tile.dataset[tileDataKey] } });
    }));
}

/** Wire nút Xác nhận của picker multi-select (`#btn-file-manager-image-picker-confirm`, nằm trong bodyHtml nơi gọi dựng).
 * @param {string} routerName @param {string} msgPrefix */
function wireMediaPickerConfirmButtonUi(routerName, msgPrefix) {
    const confirmBtn = genericDrawerBody.querySelector('#btn-file-manager-image-picker-confirm');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (confirmBtn) confirmBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.confirm.click`, payload: {} }));
}
