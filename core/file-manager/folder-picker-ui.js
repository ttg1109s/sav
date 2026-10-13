/**
 * core/file-manager/folder-picker-ui.js — UI Folder dùng chung: ô nhập của modal đổi tên folder, wiring lưới chọn Folder
 * trong Generic Drawer (Folder Browser và "Thêm vào thư mục" của Playlist), wiring modal Thuộc tính và màn "Cài đặt
 * filter" của Folder Browser. Callback CHỈ `eventBus.send()`, gom cuối hàm (Rule 5a). Phiên chạm/giữ tay tile nằm ở
 * Workflow (`workflowFolder`, event/workflow/folder.js).
 *
 * NẠP SAU: event/bus.js, core/dom-refs.js (genericDrawerHeader/Body).
 */

/**
 * Điền tên hiện tại vào ô nhập của modal đổi tên (thân modal: components/items.js::renderRenameFolderModalBody(), mở bằng
 * modalChoice()), focus + bôi đen sẵn.
 * @param {string} currentName
 * @returns {HTMLInputElement|null} ô nhập — Workflow đọc `.value` trong `onClick` của nút OK
 */
function fillRenameFolderModalInput(currentName) {
    const inputEl = document.getElementById('rename-folder-input');
    if (!inputEl) return null; // guard: modal chưa dựng
    inputEl.value = currentName;
    inputEl.focus();
    inputEl.select();
    return inputEl;
}

/** Bỏ focus ô sửa tên tile đang mở (Enter) — `blur` tự bắn `.rename.commit`. */
function blurFolderTileRenameInput() {
    const inputEl = genericDrawerBody.querySelector('.generic-folder-tile-rename-input');
    if (inputEl) inputEl.blur();
}

/**
 * Wire sự kiện 1 lưới Folder trong Generic Drawer — gọi lại SAU MỖI lần vẽ grid (nội dung `genericDrawerBody` bị thay
 * hoàn toàn). Phát `${msgPrefix}.` + `close.click` / `confirm.click` / `typeChange` / `tile.pointerdown` / `tile.pointerup` /
 * `tile.pointercancel` / `tile.click` / `addTile.click` / `rename.commit` (blur) / `rename.keydown`. Phần tử tuỳ chọn không
 * có trong DOM thì bỏ qua. Ô sửa tên (nếu có) được focus + bôi đen sẵn.
 * @param {string} routerName - vd 'playlist' | 'fileManagerFolderBrowser'.
 * @param {string} msgPrefix - vd 'playlist.folderPicker' | 'fileManagerFolderBrowser.list'.
 */
function wireFolderPickerDrawerEvents(routerName, msgPrefix) {
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    const confirmBtn = genericDrawerHeader.querySelector('#playlist-folder-picker-confirm');
    const typeSelect = genericDrawerHeader.querySelector('#playlist-folder-picker-type');
    const tileEls = genericDrawerBody.querySelectorAll('.generic-item-folder-tile');
    const addTileEl = genericDrawerBody.querySelector('#generic-folder-picker-add-tile');
    const renameInputEl = genericDrawerBody.querySelector('.generic-folder-tile-rename-input');
    if (renameInputEl) {
        renameInputEl.focus();
        renameInputEl.select();
    }

    // --- addEventListener gom cuối hàm (Rule 5a) ---
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} }));
    if (confirmBtn) confirmBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.confirm.click`, payload: {} }));
    if (typeSelect) typeSelect.addEventListener('change', (e) => eventBus.send({ router: routerName, type: `${msgPrefix}.typeChange`, payload: { value: e.target.value } }));
    tileEls.forEach((tileEl) => {
        const folderId = tileEl.dataset.folderId;
        tileEl.addEventListener('pointerdown', () => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.pointerdown`, payload: { folderId, anchorEl: tileEl } }));
        tileEl.addEventListener('pointerup', () => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.pointerup`, payload: {} }));
        tileEl.addEventListener('pointercancel', () => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.pointercancel`, payload: {} }));
        tileEl.addEventListener('pointerleave', () => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.pointercancel`, payload: {} }));
        tileEl.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.click`, payload: { folderId } }));
    });
    if (addTileEl) addTileEl.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.addTile.click`, payload: {} }));
    if (renameInputEl) {
        renameInputEl.addEventListener('blur', () => eventBus.send({ router: routerName, type: `${msgPrefix}.rename.commit`, payload: { folderId: renameInputEl.closest('[data-folder-id]').dataset.folderId, name: renameInputEl.value } }));
        renameInputEl.addEventListener('keydown', (e) => eventBus.send({ router: routerName, type: `${msgPrefix}.rename.keydown`, payload: { key: e.key } }));
    }
}

/**
 * Wire 3 checkbox trong modal Thuộc tính folder (Read-only/Hidden/Áp dụng filter) — gọi NGAY sau `modalChoice()` dựng
 * xong. Phát `fileManagerFolderBrowser.properties.{readOnly|hidden|applyFilter}.change` với payload
 * `{ folderId, mediaType, enabled }`.
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} mediaType
 */
function wireFolderPropertiesModalUi(folderId, mediaType) {
    const modalBody = document.getElementById('modal-choice-body');
    const checkboxes = [
        ['readOnly', modalBody.querySelector('#folder-properties-readonly-checkbox')],
        ['hidden', modalBody.querySelector('#folder-properties-hidden-checkbox')],
        ['applyFilter', modalBody.querySelector('#folder-properties-applyfilter-checkbox')],
    ];

    // --- addEventListener gom cuối hàm (Rule 5a) ---
    checkboxes.forEach(([name, el]) => el.addEventListener('change', (e) => eventBus.send({ router: 'fileManagerFolderBrowser', type: `fileManagerFolderBrowser.properties.${name}.change`, payload: { folderId, mediaType, enabled: e.target.checked } })));
}

/**
 * Wire 2 nút header màn "Cài đặt filter" của folder (Back/Áp dụng) — gọi SAU khi nội dung vừa dựng. Field rule bên trong
 * body đi qua delegate chung `handlePlaylistFilterPanelEvent()` (event/listener/playlist.js, `data-filter-owner="folder"`).
 */
function wireFolderFilterEditUi() {
    const backBtn = genericDrawerHeader.querySelector('#btn-folder-filter-edit-back');
    const applyBtn = genericDrawerHeader.querySelector('#btn-folder-filter-edit-apply');

    // --- addEventListener gom cuối hàm (Rule 5a) ---
    if (backBtn) backBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.filterEdit.back.click', payload: {} }));
    if (applyBtn) applyBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.filterEdit.apply.click', payload: {} }));
}
