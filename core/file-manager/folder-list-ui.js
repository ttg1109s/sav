/**
 * core/file-manager/folder-list-ui.js — Vẽ danh sách folder trong File Manager -> Song (ver 12
 * "Multi Media", plan-v12-multimedia.md mục 4.b1). Hàm THUẦN (không I/O, không appState) — nhận
 * mảng folder đã đọc sẵn qua tham số (Rule 2), nơi gọi (workflow) tự listFolders() rồi truyền vào.
 *
 * Batch D5 (Settings restructure, 06/07/2026) — panel Song giờ push/pop động (core/settings-
 * panel-stack.js), `fileManagerFolderList`/`fileManagerFolderEmpty` KHÔNG còn dom-refs tĩnh hợp lệ
 * (đã xoá khỏi core/dom-refs.js) — hàm giờ nhận CẢ 2 phần tử qua tham số, nơi gọi
 * (event/workflow/file-manager-song.js) tự tìm bên trong panel đang mở.
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/**
 * @param {Array<{id: string, name: string, songCount?: number}>} folders - MỚI (14/07/2026, Giang
 *        yêu cầu) — `songCount` tuỳ chọn: số bài THẬT SỰ đang có trong folder (nơi gọi tự
 *        getFolderSongCount() cho TỪNG folder rồi gắn vào, xem event/workflow/file-manager-song.js
 *        — hàm này KHÔNG tự tính, chỉ hiển thị nếu có, mặc định 0 nếu thiếu).
 * @param {string|null} activeFolderId - MỚI (sửa gap UX 03/07/2026): folder đang là
 *        activePlayListFolder (nếu có) — đánh dấu riêng để người dùng biết đang scope theo folder
 *        nào, tránh quên/nhầm sau khi F5 (scope giờ lưu bền qua meta, không còn "hiển nhiên thấy
 *        ngay" như trước).
 * @param {HTMLElement} listEl @param {HTMLElement} [emptyEl]
 */
function renderFolderListUI(folders, activeFolderId, listEl, emptyEl) {
    if (!listEl) return; // guard: panel đang đóng/DOM chưa sẵn sàng

    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', folders.length > 0);

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

        // MỚI (14/07/2026, Giang yêu cầu) — bọc tên + số bài trong 1 cột dọc thay vì <span> đơn lẻ
        // như trước, để chèn thêm dòng phụ "X bài" mà không phá layout hàng ngang hiện có.
        const nameWrapEl = document.createElement('div');
        nameWrapEl.className = 'flex-1 min-w-0';

        const nameEl = document.createElement('span');
        nameEl.dataset.role = 'name'; // MỚI (03/07/2026, đợt 6) — để querySelector không nhầm với chấm active (cũng là <span>)
        nameEl.className = `block truncate text-sm font-medium${isActive ? ' text-sky-300' : ' text-slate-200'}`;
        nameEl.textContent = folder.name;
        nameWrapEl.appendChild(nameEl);

        const countEl = document.createElement('span');
        countEl.dataset.role = 'count'; // MỚI (14/07/2026) — để updateFolderListRowUI() tìm đúng phần tử cần vá
        countEl.className = 'block text-xs text-slate-500';
        countEl.textContent = tFormat('fileManager.song.folderSongCount', { count: folder.songCount || 0 });
        nameWrapEl.appendChild(countEl);

        row.appendChild(nameWrapEl);

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

        listEl.appendChild(row);
    });
}

/**
 * Vá lại 1 HÀNG folder ĐÃ CÓ SẴN trong DOM (không dựng lại từ đầu) — dùng khi CHỈ 1 folder đổi
 * (xoá bài/remove-all/apply/unapply) TRONG LÚC danh sách KHÔNG hiển thị (vd đang xem Folder
 * Detail), tránh phải gọi lại renderFolderListUI() cho TOÀN BỘ danh sách (tốn kém — N lượt
 * getFolderSongCount() + render lại DOM không cần thiết cho các hàng KHÔNG đổi gì). MỚI
 * (14/07/2026, Giang yêu cầu — "xoá song trong folder xong back không render lại", xem
 * event/workflow/file-manager-song.js::refreshStaleFolderRowIfNeeded()).
 *
 * [TỰ SỬA 14/07/2026, tự audit lại Rule 5b] — bản đầu dùng `if (isActive && !dotEl) {...} else if
 * (!isActive && dotEl) {...}` — đọc `!dotEl` (DOM có tồn tại hay không) làm 1 phần điều kiện rẽ
 * nhánh "tạo mới" vs "xoá" — đúng lối lách Rule 1 mà Rule 5b nêu đích danh (dùng trạng thái DOM
 * làm điều kiện chọn giữa ≥2 tiến trình khác nhau). SỬA: xoá dot CŨ (nếu có) VÔ ĐIỀU KIỆN trước
 * (dọn dẹp, không phải "chọn tiến trình"), rồi CHỈ rẽ nhánh tạo dot mới theo ĐÚNG 1 tham số
 * `isActive` — không còn đọc DOM để quyết định.
 * @param {HTMLElement} rowEl - hàng ĐÃ có sẵn (tìm qua `[data-folder-id="..."]`).
 * @param {number} songCount
 * @param {boolean} isActive
 */
function updateFolderListRowUI(rowEl, songCount, isActive) {
    const nameEl = rowEl.querySelector('[data-role="name"]');
    const countEl = rowEl.querySelector('[data-role="count"]');
    if (countEl) countEl.textContent = tFormat('fileManager.song.folderSongCount', { count: songCount });

    rowEl.classList.toggle('bg-sky-500/10', isActive);
    if (nameEl) {
        nameEl.classList.toggle('text-sky-300', isActive);
        nameEl.classList.toggle('text-slate-200', !isActive);
    }

    const existingDotEl = rowEl.querySelector('[data-role="active-dot"]');
    if (existingDotEl) existingDotEl.remove(); // dọn dẹp VÔ ĐIỀU KIỆN — không phải "chọn tiến trình", chỉ tránh nhân đôi trước khi dựng lại

    if (isActive) { // rẽ nhánh THEO THAM SỐ isActive — không đọc DOM để quyết định
        const dotEl = document.createElement('span');
        dotEl.dataset.role = 'active-dot';
        dotEl.className = 'w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0';
        dotEl.title = t('fileManager.song.activeFolderBadge');
        rowEl.insertBefore(dotEl, rowEl.firstChild);
    }
}
