/**
 * core/media-picker-drawer-ui.js — picker Generic Drawer "chọn mục từ lưới media" dùng chung Ảnh/Video: config drawer,
 * wiring nút X + click tile, nút Xác nhận (chọn nhiều). Mở/thay qua `workflowGenericDrawerHelpers.mountMediaPicker()`
 * (event/workflow/generic-drawer-helpers.js); lưới bên trong: event/workflow/{photo,video}-gallery-window.js.
 * Picker folder có hạ tầng riêng (`wireFolderPickerDrawerEvents()`).
 *
 * NẠP SAU: core/dom-refs.js, service/z-index.js.
 */

/** Config Generic Drawer cho picker media — cao cố định 90vh, `maxHeight` cùng giá trị làm trần (lưới tải trước nhiều
 * màn hình không đẩy được header ra ngoài). @param {string} headerHtml - buildDrawerHeaderHtml() (components/generic-drawer.js)
 * @param {string} bodyHtml @param {number} [zIndex] - mở trên 1 modal (vd sửa ảnh); mặc định lớp Generic Drawer
 * @returns {object} config cho workflowGenericDrawerHelpers.open()/update() */
function buildMediaPickerDrawerConfig(headerHtml, bodyHtml, zIndex) {
    return {
        height: '90vh',
        maxHeight: '90vh',
        zIndex: zIndex || Z_INDEX.GENERIC_DRAWER, // service/z-index.js
        headerHtml,
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

