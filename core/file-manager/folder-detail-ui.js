/**
 * core/file-manager/folder-detail-ui.js — Vẽ danh sách item + tiêu đề Folder Detail (Phase 2, CHỐT
 * 03/07/2026 — mục 1b/c). Hàm THUẦN (không I/O, không appState), nhận dữ liệu đã đọc sẵn qua tham
 * số (Rule 2), nơi gọi (workflow) tự đọc IndexedDB rồi truyền vào.
 *
 * SỬA (Batch 5, "Song/Video Unification" mục 6e) — `getFolderSongsForDisplay()` (đọc tên/nghệ sĩ
 * qua `playlistCache`, CHỈ đúng khi Playlist đang browse ĐÚNG loại của folder) ĐÃ XOÁ khỏi file
 * này — thay bằng `getFolderItemsForDisplay()` (core/file-manager/folder.js, đọc TRỰC TIẾP
 * `service/db.js`, ĐÚNG bất kể Playlist đang browse nguồn nào). File này giờ CHỈ còn 2 hàm render
 * thuần — tái dùng NGUYÊN cho cả Folder Browser mới (Generic Drawer, event/workflow/
 * file-manager-folder-browser.js) lẫn mọi nơi khác cần render y hệt shape này.
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/**
 * @param {Array<{key: string, title: string, artist: string}>} songs
 * @param {HTMLElement} listEl @param {HTMLElement} [emptyEl]
 * @param {HTMLElement} [removeAllBtnEl] - nút "Xoá hết bài", tự ẩn khi `songs.length === 0`
 *        (không có gì để xoá).
 *
 * SỬA (Batch 4, "Song/Video Unification") — 2 tham số `applyBtnEl`/`isActive` ĐÃ BỎ: nút Áp dụng/
 * Bỏ áp dụng cũ thay bằng toggle Scope ĐỘC LẬP, đồng bộ trạng thái riêng qua
 * `event/workflow/file-manager-song.js::_updateScopeToggleUI()` (không còn phụ thuộc vào lần
 * render danh sách bài này nữa).
 */
function renderFolderDetailSongList(songs, listEl, emptyEl, removeAllBtnEl) {
    if (!listEl) return; // guard: panel đang đóng

    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', songs.length > 0);
    if (removeAllBtnEl) removeAllBtnEl.classList.toggle('hidden', songs.length === 0);

    songs.forEach((song) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 px-4 py-3';
        row.dataset.songKey = song.key;

        const infoEl = document.createElement('div');
        infoEl.className = 'flex-1 min-w-0';
        const titleEl = document.createElement('div');
        titleEl.className = 'truncate text-sm font-medium text-slate-200';
        titleEl.textContent = song.title;
        const artistEl = document.createElement('div');
        artistEl.className = 'truncate text-xs text-slate-400 mt-0.5';
        artistEl.textContent = song.artist;
        infoEl.appendChild(titleEl);
        infoEl.appendChild(artistEl);
        row.appendChild(infoEl);

        const removeBtn = document.createElement('button');
        removeBtn.dataset.removeSongKey = song.key;
        removeBtn.className = 'p-1.5 rounded-full hover:bg-rose-500/10 transition-colors text-slate-400 hover:text-rose-400 shrink-0';
        removeBtn.title = t('fileManager.song.folderDetail.removeSongTitle');
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';
        row.appendChild(removeBtn);

        listEl.appendChild(row);
    });
}

/**
 * Đặt tiêu đề drawer = tên folder đang xem. Hàm THUẦN, DOM-patch 1 dòng — không cần tách core
 * riêng theo Rule 1 (đây không phải "tiến trình nghiệp vụ", chỉ là 1 dòng patch UI đơn lẻ).
 * @param {string} name @param {HTMLElement} [titleEl]
 */
function setFolderDetailTitle(name, titleEl) {
    if (titleEl) titleEl.textContent = name;
}
