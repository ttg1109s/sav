/**
 * core/file-manager/folder-list-ui.js — Vẽ danh sách folder trong File Manager -> Song (ver 12
 * "Multi Media", plan-v12-multimedia.md mục 4.b1). Hàm THUẦN (không I/O, không appState) — nhận
 * mảng folder đã đọc sẵn qua tham số (Rule 2), nơi gọi (workflow) tự listFolders() rồi truyền vào.
 *
 * NẠP SAU: core/dom-refs.js (fileManagerFolderList/fileManagerFolderEmpty), lang/lang.js (t()).
 */

/**
 * @param {Array<{id: string, name: string}>} folders
 * @param {string|null} activeFolderId - MỚI (sửa gap UX 03/07/2026): folder đang là
 *        activePlayListFolder (nếu có) — đánh dấu riêng để người dùng biết đang scope theo folder
 *        nào, tránh quên/nhầm sau khi F5 (scope giờ lưu bền qua meta, không còn "hiển nhiên thấy
 *        ngay" như trước).
 */
function renderFolderListUI(folders, activeFolderId) {
    if (!fileManagerFolderList) return; // guard: DOM chưa sẵn sàng (hiếm, race lúc mount)

    fileManagerFolderList.innerHTML = '';
    if (fileManagerFolderEmpty) fileManagerFolderEmpty.classList.toggle('hidden', folders.length > 0);

    folders.forEach((folder) => {
        const isActive = folder.id === activeFolderId;
        const row = document.createElement('div');
        // MỚI (Phase 2, CHỐT 03/07/2026): cả hàng giờ bấm được (mở Folder Detail Drawer) — 2 nút
        // rename/xoá vẫn giữ nguyên hành vi cũ, listener phân biệt qua e.target.closest() (xem
        // event/listener/file-manager-song.js).
        row.className = `flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors${isActive ? ' bg-sky-500/10' : ''}`;
        row.dataset.folderId = folder.id;

        if (isActive) {
            const dotEl = document.createElement('span');
            dotEl.className = 'w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0';
            dotEl.title = t('fileManager.song.activeFolderBadge');
            row.appendChild(dotEl);
        }

        const nameEl = document.createElement('span');
        nameEl.dataset.role = 'name'; // MỚI (03/07/2026, đợt 6) — để querySelector không nhầm với chấm active (cũng là <span>)
        nameEl.className = `flex-1 min-w-0 truncate text-sm font-medium${isActive ? ' text-sky-300' : ' text-slate-200'}`;
        nameEl.textContent = folder.name;
        row.appendChild(nameEl);

        const renameBtn = document.createElement('button');
        renameBtn.dataset.folderAction = 'rename';
        renameBtn.className = 'p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-emerald-400 shrink-0';
        renameBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
        row.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.dataset.folderAction = 'delete';
        deleteBtn.className = 'p-1.5 rounded-full hover:bg-rose-500/10 transition-colors text-slate-400 hover:text-rose-400 shrink-0';
        deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
        row.appendChild(deleteBtn);

        const chevronEl = document.createElement('span');
        chevronEl.className = 'text-slate-500 shrink-0 pl-1';
        chevronEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>';
        row.appendChild(chevronEl);

        fileManagerFolderList.appendChild(row);
    });
}
