/**
 * core/file-manager/folder-picker-ui.js — UI Folder dùng chung: modal đổi tên folder, wiring lưới
 * chọn Folder trong Generic Drawer (Folder Browser và "Thêm vào thư mục" của Playlist), wiring modal
 * Thuộc tính và màn "Cài đặt filter" của Folder Browser. Callback CHỈ `eventBus.send()` (Rule 5a).
 *
 * NẠP SAU: core/modal-choice-ui.js (modalChoice() dựng `#modal-choice-body`), lang/lang.js (t()), event/bus.js, service/task-manager.js,
 * core/dom-refs.js (genericDrawerHeader/Body), core/ui-theme/apply-ui.js (runtime).
 */

// Ngưỡng giữ tay mở menu hành động của 1 folder tile.
const FOLDER_TILE_HOLD_MS = 1000;

/**
 * Modal đổi tên 1 folder (ô nhập điền sẵn tên hiện tại + Huỷ/Lưu). Lưu -> router
 * 'fileManagerFolderBrowser' `rename.confirm`.
 * @param {string} currentName
 * @param {string} folderId
 */
function openRenameFolderModal(currentName, folderId) {
    const stale = document.getElementById('rename-folder-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rename-folder-overlay';
    overlay.className = 'fixed inset-0 z-[130] backdrop-blur-sm flex items-center justify-center px-5';
    overlay.dataset.uitk = 'overlayBg';

    const card = document.createElement('div');
    card.className = 'rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';
    card.dataset.uitk = 'modalCardBg modalCardBorder';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base';
    titleEl.dataset.uitk = 'modalTitleText';
    titleEl.textContent = t('fileManager.song.renameFolderTitle');
    card.appendChild(titleEl);

    function closeModal() { overlay.remove(); }

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.value = currentName;
    inputEl.className = 'rounded-lg px-3 py-2 text-sm outline-none transition-colors';
    inputEl.dataset.uitk = 'inputBg inputBorder inputText';
    card.appendChild(inputEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors';
    cancelBtn.dataset.uitk = 'btnNeutralBg btnNeutralHoverBg btnNeutralText';
    cancelBtn.textContent = t('common.cancel');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors';
    saveBtn.dataset.uitk = 'btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent';
    saveBtn.textContent = t('common.ok');
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    applyUiThemeToDom(overlay, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    inputEl.focus();
    inputEl.select();

    // --- addEventListener gom cuối hàm (Rule 5a) ---
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', () => {
        const name = inputEl.value.trim();
        if (!name) return; // guard: tên rỗng
        closeModal();
        eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.rename.confirm', payload: { folderId, name } });
    });
}

/**
 * Wire toàn bộ sự kiện 1 lưới Folder trong Generic Drawer — gọi lại SAU MỖI lần vẽ grid (nội dung
 * `genericDrawerBody` bị thay hoàn toàn). Nơi gọi tự lọc nội dung lưới trước khi vẽ. Phát:
 * `${msgPrefix}.close.click` / `.confirm.click` / `.typeChange` / `.tile.click` / `.tile.longpress`
 * (giữ tay FOLDER_TILE_HOLD_MS; click ngay sau long-press bị nuốt) / `.addTile.click` / `.rename.commit`
 * (blur hoặc Enter). Phần tử tuỳ chọn không có trong DOM thì bỏ qua.
 * @param {string} routerName - vd 'playlist' | 'fileManagerFolderBrowser'.
 * @param {string} msgPrefix - vd 'playlist.folderPicker' | 'fileManagerFolderBrowser.list'.
 */
function wireFolderPickerDrawerEvents(routerName, msgPrefix) {
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} }));

    const confirmBtn = genericDrawerHeader.querySelector('#playlist-folder-picker-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.confirm.click`, payload: {} }));

    const typeSelect = genericDrawerHeader.querySelector('#playlist-folder-picker-type');
    if (typeSelect) typeSelect.addEventListener('change', (e) => eventBus.send({ router: routerName, type: `${msgPrefix}.typeChange`, payload: { value: e.target.value } }));

    // Mỗi tile 1 cờ `holdFired` riêng; taskId gắn folderId để 2 tile không dùng chung task.
    genericDrawerBody.querySelectorAll('.generic-item-folder-tile').forEach((tileEl) => {
        const folderId = tileEl.dataset.folderId;
        const holdTaskId = `folder-tile-longpress-${folderId}`;
        let holdFired = false;
        tileEl.addEventListener('pointerdown', () => {
            holdFired = false;
            taskManager.once(() => {
                holdFired = true;
                eventBus.send({ router: routerName, type: `${msgPrefix}.tile.longpress`, payload: { folderId, anchorEl: tileEl } });
            }, FOLDER_TILE_HOLD_MS, holdTaskId);
        });
        tileEl.addEventListener('pointerup', () => taskManager.kill(holdTaskId));
        tileEl.addEventListener('pointercancel', () => { taskManager.kill(holdTaskId); holdFired = false; });
        tileEl.addEventListener('pointerleave', () => { taskManager.kill(holdTaskId); holdFired = false; });
        tileEl.addEventListener('click', () => {
            if (holdFired) { holdFired = false; return; } // click tự phát sau long-press — nuốt
            eventBus.send({ router: routerName, type: `${msgPrefix}.tile.click`, payload: { folderId } });
        });
    });

    const addTileEl = genericDrawerBody.querySelector('#generic-folder-picker-add-tile');
    if (addTileEl) addTileEl.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.addTile.click`, payload: {} }));

    const renameInputEl = genericDrawerBody.querySelector('.generic-folder-tile-rename-input');
    if (renameInputEl) {
        renameInputEl.focus();
        renameInputEl.select();
        const commit = () => eventBus.send({ router: routerName, type: `${msgPrefix}.rename.commit`, payload: { folderId: renameInputEl.closest('[data-folder-id]').dataset.folderId, name: renameInputEl.value } });
        renameInputEl.addEventListener('blur', commit);
        renameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameInputEl.blur(); }); // Enter -> blur -> commit
    }
}

/**
 * Wire 3 checkbox trong modal Thuộc tính folder (Read-only/Hidden/Áp dụng filter) — gọi NGAY sau
 * `modalChoice()` dựng xong. Phát `fileManagerFolderBrowser.properties.{readOnly|hidden|applyFilter}.change`
 * với payload `{ folderId, mediaType, enabled }`.
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
 * Wire 2 nút header màn "Cài đặt filter" của folder (Back/Áp dụng) — gọi SAU khi nội dung vừa dựng. Field rule
 * bên trong body KHÔNG wire ở đây: đi qua delegate chung `handlePlaylistFilterPanelEvent()` (event/listener/
 * playlist.js) theo `data-filter-owner="folder"`.
 */
function wireFolderFilterEditUi() {
    const backBtn = genericDrawerHeader.querySelector('#btn-folder-filter-edit-back');
    const applyBtn = genericDrawerHeader.querySelector('#btn-folder-filter-edit-apply');

    // --- addEventListener gom cuối hàm (Rule 5a) ---
    if (backBtn) backBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.filterEdit.back.click', payload: {} }));
    if (applyBtn) applyBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.filterEdit.apply.click', payload: {} }));
}
