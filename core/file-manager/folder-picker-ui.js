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
 * NẠP SAU: core/modal-choice-ui.js (dùng chung escapeHtml()), lang/lang.js (t()), event/bus.js.
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
    overlay.className = 'fixed inset-0 z-[130] backdrop-blur-sm flex items-center justify-center px-5';
    overlay.dataset.uitk = 'overlayBg'; // SỬA (09/09/2026, hệ UI Theme mở rộng) — trước đây bg-black/70 riêng, giờ DÙNG CHUNG overlayBg (bg-black/50, cố ý không đổi theo theme)

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
    // GUARD (09/09/2026) — file này còn nạp ở subtitle-editor.html (trang RIÊNG, KHÔNG có
    // core/ui-theme/*.js) — gọi thẳng applyUiThemeToDom() ở đó sẽ ReferenceError. Chỉ áp
    // theme khi hạ tầng ĐÃ nạp (index.html), bỏ qua im lặng nếu chưa (trang khác).
    if (typeof applyUiThemeToDom === 'function') applyUiThemeToDom(overlay, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
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
// MỚI (06/09/2026, hợp nhất Folder vào Playlist, Batch 4) — ngưỡng giữ tay mở menu hành động 1
// folder tile (đổi tên/xoá/ẩn-hiện/thuộc tính) — CÙNG khuôn `EQ_CYCLE_HOLD_MS`
// (event/workflow/eq-presets.js)/`CUSTOM_EFFECT_HOLD_MS` (event/workflow/custom-effect.js), cố
// định, không phải setting.
// SỬA (Giang yêu cầu — "1.5s hold -> 1s") — rút ngắn từ 1500ms xuống 1000ms, nhạy tay hơn.
const FOLDER_TILE_HOLD_MS = 1000;

function wireFolderPickerDrawerEvents(routerName, msgPrefix) {
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} }));

    // MỚI (29/08/2026) — nút "Chọn (N)" xác nhận (multiSelect) + dropdown đổi loại folder đang
    // duyệt (typeOptions) — CẢ 2 tuỳ chọn, chỉ xuất hiện trong headerHtml khi nơi gọi truyền
    // tương ứng (xem event/workflow/playlist.js::_buildFolderPickerHeaderHtml()); querySelector trả
    // null thì bỏ qua im lặng, không đụng gì tới 2 luồng "Thêm vào thư mục" của Playlist tự thân.
    const confirmBtn = genericDrawerHeader.querySelector('#playlist-folder-picker-confirm');
    if (confirmBtn) confirmBtn.addEventListener('click', () => eventBus.send({ router: routerName, type: `${msgPrefix}.confirm.click`, payload: {} }));

    const typeSelect = genericDrawerHeader.querySelector('#playlist-folder-picker-type');
    if (typeSelect) typeSelect.addEventListener('change', (e) => eventBus.send({ router: routerName, type: `${msgPrefix}.typeChange`, payload: { value: e.target.value } }));

    // SỬA (06/09/2026, hợp nhất Folder vào Playlist, Batch 4) — thêm giữ tay 1s ->
    // `${msgPrefix}.tile.longpress` (CÙNG khuôn EQ_CYCLE_HOLD_MS, xem hằng số ngay trên) — `click`
    // bình thường (tap ngắn) VẪN bắn `${msgPrefix}.tile.click` y hệt trước giờ, CHỈ bị nuốt (không
    // bắn) đúng 1 lần NGAY SAU 1 lượt long-press vừa nổ (trình duyệt luôn tự phát `click` NGAY SAU
    // `pointerup`, kể cả sau khi đã giữ đủ lâu — không chặn thì tap-áp-folder sẽ chạy NGAY SAU khi
    // đóng/mở menu hành động, sai ý). Cờ `holdFired` khai báo RIÊNG mỗi lượt forEach (mỗi tile 1
    // biến đóng riêng — nhiều tile cùng tồn tại trong lưới, không dùng chung 1 cờ module-level như
    // eq-presets.js (chỉ có đúng 1 nút)). `taskId` gắn kèm `folderId` để 2 tile giữ cùng lúc (hiếm)
    // không đụng chung 1 task.
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
            if (holdFired) { holdFired = false; return; } // vừa long-press xong — click phát sinh theo sau không còn ý nghĩa "tap"
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
        renameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameInputEl.blur(); }); // Enter -> blur -> tự trigger commit ở trên, không lặp lại logic
    }
}

// XOÁ (06/09/2026, Giang chốt mục 3.6 — "bỏ hẳn màn Read") — `wireFolderBrowserReadEvents()`
// (wiring cho màn Read cũ: back/rename/delete/removeItem/removeAll/pagination/2 toggle Scope-
// Exclude) bỏ hẳn cùng màn hình đó — Folder Browser giờ CHỈ còn màn List (tap = áp dụng ngay, giữ
// tay 1s = menu hành động, xem `wireFolderPickerDrawerEvents()` ngay trên +
// event/workflow/file-manager-folder-browser.js).
