/**
 * core/playlist/main.js — `PlaylistMain`: đồng bộ các control "cách hiển thị danh sách" (Kiểu xem, Nguồn) + badge
 * folder + ô tìm kiếm. Sự kiện gắn ở event/listener/playlist.js; Workflow đọc state rồi gọi
 * (`workflowPlaylist.syncPlaylistSettingsUI()` lúc boot, sau khi khôi phục cấu hình Playlist).
 * Cùng thư mục: state.js (biến dùng chung), order.js (thứ tự), render.js (DOM danh sách), loader.js (nạp), actions.js
 * (menu/modal từng bài).
 */
        /** className của #playlist-container theo Kiểu xem (Grid/List). */
        const PLAYLIST_CONTAINER_CLASS_BY_GRID = {
            true: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32',
            false: 'flex flex-col pb-32',
        };

        const PlaylistMain = {

            // "Kiểu xem" (Danh sách / Lưới) — select trong Settings. `.value` của select chỉ áp khi panel đang mở (select
            // sống trong Generic Drawer); `className` của #playlist-container luôn áp.
            // @param {boolean} isGridView
            initViewMode(isGridView) {
                if (viewModeSelect) viewModeSelect.value = isGridView ? 'grid' : 'list';
                playlistContainer.className = PLAYLIST_CONTAINER_CLASS_BY_GRID[isGridView];
            },

            // "Nguồn" (Song/Video/Photo) — select trong Settings (Generic Drawer), nơi gọi tự truy vấn lại DOM mỗi lần.
            initMediaSource(selectEl, mediaSource) {
                if (!selectEl) return;
                selectEl.value = mediaSource;
            },
        };

        /** Hiện/ẩn badge "đang xem folder" trong ô tìm kiếm + tên folder (Workflow: workflowPlaylistScope.syncActiveFolderBadge()).
         * @param {boolean} isScoped @param {string} folderName */
        function applyActiveFolderBadge(isScoped, folderName) {
            if (!playlistActiveFolderBadge) return; // guard phòng vệ — badge tĩnh, luôn mounted
            if (playlistActiveFolderBadgeName) playlistActiveFolderBadgeName.textContent = folderName;
            playlistActiveFolderBadge.classList.toggle('hidden', !isScoped);
        }

        /**
         * Select "Kiểu xem" đổi — ghi isGridView + className của #playlist-container. Vẽ lại danh sách: Workflow
         * (workflowPlaylist.changeViewMode()).
         * @param {string} mode - 'grid' | 'list'
         */
        function setPlaylistViewMode(mode) {
            const isGridView = mode === 'grid';
            appState.set('isGridView', isGridView);
            console.log(`writer: "setPlaylistViewMode", page: "isGridView", content: "${isGridView}"`);
            playlistContainer.className = PLAYLIST_CONTAINER_CLASS_BY_GRID[isGridView];
        }

        /**
         * Ô tìm kiếm gõ chữ — chỉ hiện/ẩn nút xoá. Lọc lại danh sách: workflowPlaylistOrder.searchInput().
         * @param {string} value
         */
        function syncPlaylistSearchClearButton(value) {
            if (playlistSearchClear) playlistSearchClear.classList.toggle('hidden', !value);
        }

        /** Nút xoá ô tìm kiếm — reset input + ẩn nút + focus lại ô nhập. Bỏ lọc: workflowPlaylistOrder.searchClear(). */
        function resetPlaylistSearchInput() {
            if (playlistSearchInput) playlistSearchInput.value = '';
            if (playlistSearchClear) playlistSearchClear.classList.add('hidden');
            if (playlistSearchInput) playlistSearchInput.focus();
        }
