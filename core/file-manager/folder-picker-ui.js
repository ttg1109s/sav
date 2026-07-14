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
 * (chưa qua audit chính thức, xem readme/event-bus-flow.md). Giờ nút "Lưu" CHỈ bắn
 * `eventBus.send({router:'fileManagerSong', type:'fileManagerSong.folder.rename.confirm', ...})`
 * — nơi gọi (event/workflow/file-manager-song.js) không còn truyền callback, chỉ truyền `folderId`
 * để đính kèm vào payload.
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
        eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.folder.rename.confirm', payload: { folderId, name } });
    });
}
