/**
 * core/file-manager/folder-picker-ui.js — Modal đổi tên 1 folder.
 *
 * [DỌN 14/07/2026] — `openFolderPickerModal()` (modal "Thêm vào thư mục" cũ, chọn folder có sẵn
 * HOẶC tạo mới) ĐÃ XOÁ khỏi file này — không còn nơi gọi nào từ 14/07/2026 (thay bằng Generic
 * Drawer grid, xem components/items.js::itemTemplateFolderTile()/buildAddFolderTileHtml() +
 * event/workflow/playlist.js::_openFolderPickerDrawer()). Đã MỒ CÔI từ trước (0 lời gọi thật), giờ
 * xoá hẳn luôn vì đang sửa file này cho việc khác — không để lại code chết không cần thiết.
 *
 * Đây là hàm UI-thuần (dựng DOM), KHÔNG chứa nghiệp vụ đọc/ghi IndexedDB — không thuộc phạm vi 4
 * rule core-function-conventions.md (rule đó áp cho hàm NGHIỆP VỤ, không áp cho hàm dựng UI thuần).
 *
 * NẠP SAU: core/modal-choice.js (dùng chung escapeHtml()), lang/lang.js (t()), event/bus.js.
 */

/**
 * Modal đổi tên 1 folder — 1 ô nhập liệu đã điền sẵn tên hiện tại + 2 nút Huỷ/Lưu.
 *
 * [SỬA 14/07/2026, tự audit lại Rule 5a — Giang yêu cầu "đụng hàm di sản phải refactor luôn theo
 * rule"] — TRƯỚC ĐÂY nút "Lưu" gọi THẲNG callback `onConfirm(name)` truyền vào tham số — đúng khuôn
 * CŨ của `modalChoice()`, nhưng khuôn đó giờ CHỈ còn là ngoại lệ ĐÃ AUDIT riêng cho chính
 * `modalChoice()` (readme/core-function-conventions.md mục 5a) — file NÀY (docstring bản cũ) từng
 * tự nhận "CÙNG PATTERN với modalChoice()" để suy ra miễn trừ tương tự, ĐÃ bị coi KHÔNG hợp lệ
 * (chưa qua audit chính thức, xem readme/event-bus-flow.md). Giờ nút "Lưu" CHỈ bắn eventBus.send().
 *
 * SỬA (Batch 5, "Song/Video Unification" mục 6e) — router đích đổi từ 'fileManagerSong' sang
 * 'fileManagerFolderBrowser' (Folder List/Detail cũ kiểu Settings-panel ĐÃ THAY bằng Generic Drawer
 * List↔Read, xem event/workflow/file-manager-folder-browser.js) — chỉ nơi gọi này là nơi DUY NHẤT
 * còn dùng modal đổi tên, không cần giữ 2 đích.
 * @param {string} currentName
 * @param {string} folderId
 */
function openRenameFolderModal(currentName, folderId) {
    const stale = document.getElementById('rename-folder-overlay');
    if (stale) stale.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rename-folder-overlay';
    overlay.className = 'fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';

    const card = document.createElement('div');
    card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-base font-bold text-white';
    titleEl.textContent = t('fileManager.song.renameFolderTitle');
    card.appendChild(titleEl);

    function closeModal() { overlay.remove(); }

    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.value = currentName;
    inputEl.className = 'bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors';
    card.appendChild(inputEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-3';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors';
    cancelBtn.textContent = t('common.cancel');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors';
    saveBtn.textContent = t('common.ok');
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    inputEl.focus();
    inputEl.select();

    // --- addEventListener: gom cuối hàm (Rule 5a) — callback CHỈ bắn eventBus.send() ---
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', () => {
        const name = inputEl.value.trim();
        if (!name) return; // guard clause thuần — chưa nhập tên thì không làm gì
        closeModal();
        eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.rename.confirm', payload: { folderId, name } });
    });
}

// ===================== "9 file khác" (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ
// không phải workflow" — rà rộng ra ngoài Photo/Edit) =====================
// 3 hàm dưới đây TÁCH RA từ event/workflow/playlist.js::_wireFolderPickerEvents() và
// event/workflow/file-manager-folder-browser.js::_wireListEvents()/_wireReadEvents() — Generic
// Drawer picker/browser Folder DÙNG CHUNG cấu trúc HTML (components/items.js::
// itemTemplateFolderTile()/buildAddFolderTileHtml()) giữa 2 domain (playlist chọn folder để thêm
// bài hát VS file-manager-folder-browser duyệt/quản lý folder) nên đặt chung 1 file, nhưng vẫn 2
// hàm RIÊNG (router đích khác nhau, không gộp thành 1 hàm nhận tham số router).

/**
 * Wire lại TOÀN BỘ sự kiện 1 lưới chọn Folder trong Generic Drawer, SAU MỖI lần vẽ lại grid (nội
 * dung `genericDrawerBody` bị thay hoàn toàn mỗi lần).
 *
 * GỘP (v13 Batch B, phản hồi Giang "tại sao phải thêm hàm logic trùng lặp?") — TRƯỚC ĐÂY là 2 hàm
 * `wirePlaylistFolderPickerEvents()` + `wireFolderBrowserListEvents()` GIỐNG NHAU TỪNG DÒNG, chỉ
 * khác tên router + tiền tố msg.type. Comment cũ tự biện minh "vẫn 2 hàm RIÊNG (router đích khác
 * nhau, không gộp thành 1 hàm nhận tham số router)" — LÝ LẼ ĐÓ SAI: truyền tên router/tiền tố là
 * truyền GIÁ TRỊ, KHÔNG phải rẽ nhánh giữa ≥2 tiến trình nghiệp vụ, nên Rule 1 không hề bị đụng tới
 * (cùng bản chất `setImage(el, url)`). Hàm này vẫn ĐÚNG 1 tiến trình duy nhất: "gắn sự kiện cho
 * lưới folder vừa vẽ" — không có if/else nào chọn giữa 2 kịch bản khác nhau.
 *
 * Nơi gọi tự quyết định LƯỚI CHỨA GÌ (lọc theo `folder.type`, ẩn tile "Tạo mới"...) TRƯỚC khi vẽ —
 * hàm này KHÔNG nhận tham số lọc nào, KHÔNG tự đọc DB (Rule 2/3b: chuẩn bị dữ liệu là việc của
 * Workflow, core chỉ thi hành trên đúng thứ đã được đưa cho).
 *
 * Input sửa tên (nếu đang có) tự focus + select — KHÔNG qua eventBus (hành vi UI thuần "đặt con trỏ
 * vào ô vừa hiện ra", không phải 1 quyết định nghiệp vụ).
 *
 * @param {string} routerName - tên router đích, vd 'playlist' | 'fileManagerFolderBrowser' | 'visualBg'.
 * @param {string} msgPrefix - tiền tố msg.type, vd 'playlist.folderPicker' | 'fileManagerFolderBrowser.list'.
 */
function wireFolderPickerDrawerEvents(routerName, msgPrefix) {
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} }));

    genericDrawerBody.querySelectorAll('.generic-item-folder-tile').forEach((tileEl) => {
        tileEl.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.click`, payload: { folderId: tileEl.dataset.folderId } }));
    });

    const addTileEl = genericDrawerBody.querySelector('#generic-folder-picker-add-tile');
    if (addTileEl) addTileEl.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.addTile.click`, payload: {} }));

    const renameInputEl = genericDrawerBody.querySelector('.generic-folder-tile-rename-input');
    if (renameInputEl) {
        renameInputEl.focus();
        renameInputEl.select();
        const commit = () => eventBus.send({ router: routerName, type: `${msgPrefix}.rename.commit`, payload: { folderId: renameInputEl.closest('[data-folder-id]').dataset.folderId, name: renameInputEl.value } });
        renameInputEl.addEventListener('blur', commit);
        renameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameInputEl.blur(); }); // Enter -> blur -> tự trigger commit ở trên, không lặp lại logic
    }
}

/** Wire lại Read (nội dung 1 folder) của File Manager Folder Browser — cùng lý do SỬA như
 * `wireFolderPickerDrawerEvents()`.
 * SỬA (v13 Batch F) — thêm tham số `folderId` để 'read.delete.click' MANG THEO id folder đang mở.
 * Trước đây payload rỗng, id chỉ nằm ở biến closure `workflowFileManagerFolderBrowser._readFolderId`
 * — Block gate không với tới được (nó chỉ đọc `appState`/`appConfig`/`payload`). Message phải TỰ MÔ
 * TẢ đối tượng nó tác động lên; đây là sửa thiếu sót sẵn có, không phải chiều theo Block.
 * SỬA (v13) — thêm `folderType`: bật Scope cho folder VIDEO khi Visual Background đang on sẽ đẩy
 * app vào trạng thái xung đột SAU KHI RELOAD (nguồn Playlist thành Video mà nền vẫn bật). Block gate
 * cần biết LOẠI folder ngay trong payload mới chặn được.
 * @param {string} folderId - folder đang mở ở khung Read.
 * @param {string|null} folderType - 'song' | 'video' | null (folder rỗng, chưa xác định).
 */
function wireFolderBrowserReadEvents(folderId, folderType) {
    const backBtn = genericDrawerHeader.querySelector('#btn-folder-browser-read-back');
    if (backBtn) backBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.back.click', payload: {} }));

    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.close.click', payload: {} }));

    const renameBtn = genericDrawerHeader.querySelector('#btn-folder-browser-read-rename');
    if (renameBtn) renameBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.rename.click', payload: {} }));

    const deleteBtn = genericDrawerHeader.querySelector('#btn-folder-browser-read-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.delete.click', payload: { folderId } }));

    genericDrawerBody.querySelectorAll('[data-remove-song-key]').forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.removeItem.click', payload: { songKey: btn.dataset.removeSongKey } }));
    });

    const removeAllBtn = genericDrawerBody.querySelector('#btn-folder-browser-read-remove-all');
    if (removeAllBtn) removeAllBtn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.removeAll.click', payload: {} }));

    // data-pagination-action="goto" + data-page-index="N" — ĐÚNG thuộc tính thật core/pagination.js
    // phát ra (mode 'list', xem buildPaginationListHtml()).
    const paginationEl = genericDrawerBody.querySelector('#folder-browser-read-pagination');
    if (paginationEl) paginationEl.querySelectorAll('[data-pagination-action="goto"]').forEach((btn) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.pagination.click', payload: { pageIndex: parseInt(btn.dataset.pageIndex, 10) } }));
    });

    const scopeToggle = genericDrawerBody.querySelector('#toggle-folder-browser-read-scope');
    if (scopeToggle) scopeToggle.addEventListener('change', (e) => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.scope.change', payload: { checked: e.target.checked, folderType } }));

    const excludeToggle = genericDrawerBody.querySelector('#toggle-folder-browser-read-exclude');
    if (excludeToggle) excludeToggle.addEventListener('change', (e) => eventBus.send({ router: 'fileManagerFolderBrowser', type: 'fileManagerFolderBrowser.read.exclude.change', payload: { checked: e.target.checked } }));
}

