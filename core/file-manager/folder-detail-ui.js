/**
 * core/file-manager/folder-detail-ui.js — Vẽ Folder Detail Drawer (Phase 2, CHỐT 03/07/2026 —
 * mục 1b/c của yêu cầu). Cùng nguyên tắc với core/file-manager/folder-list-ui.js: hàm THUẦN
 * (không I/O, không appState), nhận dữ liệu đã đọc sẵn qua tham số (Rule 2), nơi gọi (workflow)
 * tự đọc IndexedDB/playlistCache rồi truyền vào.
 *
 * Batch D5 (Settings restructure, 06/07/2026) — panel Folder Detail giờ push/pop động (core/
 * settings-panel-stack.js), 3 dom-refs tĩnh cũ (fileManagerFolderDetailSongList/Empty/Title) ĐÃ
 * XOÁ khỏi core/dom-refs.js — 2 hàm dưới đây giờ nhận phần tử qua tham số.
 *
 * NẠP SAU: lang/lang.js (t()).
 */

/**
 * Rule 1/2 (pure) — gộp danh sách songKey thật trong 1 folder với thông tin hiển thị (tên/nghệ sĩ)
 * đã có sẵn trong playlistCache. Bài nào không còn trong playlistCache (đã xoá/lỗi, còn sót key
 * trong folder_song) vẫn hiển thị bằng chính songKey làm tên tạm — KHÔNG loại bỏ khỏi danh sách,
 * để người dùng vẫn gỡ được tham chiếu rác đó ra khỏi folder.
 * @param {Object} folderMap - { list, empty } của 1 folder
 * @param {Map} playlistCache
 * @returns {Array<{key: string, title: string, artist: string}>}
 */
function getFolderSongsForDisplay(folderMap, playlistCache) {
    // [TỰ SỬA 14/07/2026, tự audit lại Rule 3] — trước đây gọi getFolderSongKeys() (1 core KHÁC ở
    // core/file-manager/folder.js) rồi biện minh "có return value nên hợp lệ" — SAI theo Rule 3
    // hiện hành (xem giải thích đầy đủ ở core/file-manager/folder.js::deleteFolder()). Inline TRỰC
    // TIẾP logic 1 dòng (lọc tombstone null) tại đây, không gọi hàm đó nữa.
    const keys = folderMap.list.filter((k) => k != null);

    return keys.map((key) => {
        const cached = playlistCache.get(key);
        return {
            key,
            title: cached ? cached.tag.title : key,
            artist: cached ? cached.tag.artist : '',
        };
    });
}

/**
 * @param {Array<{key: string, title: string, artist: string}>} songs
 * @param {HTMLElement} listEl @param {HTMLElement} [emptyEl]
 * @param {HTMLElement} [removeAllBtnEl] - nút "Xoá hết bài", tự ẩn khi `songs.length === 0`
 *        (không có gì để xoá) — cùng điều kiện với `emptyEl`.
 * @param {HTMLElement} [applyBtnEl] - MỚI (14/07/2026, Giang yêu cầu — "không có song thì cũng
 *        không hiển thị nút active") — nút "Áp dụng"/"Bỏ áp dụng". Ẩn khi `songs.length === 0`
 *        **VÀ** `isActive` false (áp dụng 1 folder rỗng làm scope mới vô nghĩa — không có gì để
 *        phát). Vẫn HIỆN khi `isActive` true dù rỗng — user cần cách "Bỏ áp dụng" ra khỏi 1 folder
 *        VỪA bị xoá hết bài trong lúc đang là scope hiện tại, không được khoá luôn lối thoát đó.
 * @param {boolean} [isActive] - folder đang xem có phải activePlayListFolder hay không.
 */
function renderFolderDetailSongList(songs, listEl, emptyEl, removeAllBtnEl, applyBtnEl, isActive) {
    if (!listEl) return; // guard: panel đang đóng

    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', songs.length > 0);
    if (removeAllBtnEl) removeAllBtnEl.classList.toggle('hidden', songs.length === 0);
    if (applyBtnEl) applyBtnEl.classList.toggle('hidden', songs.length === 0 && !isActive);

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
