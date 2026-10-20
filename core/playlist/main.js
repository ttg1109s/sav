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

            // "Nguồn" (Song/Video/Photo) — select trong Settings (Generic Drawer, truy vấn lại mỗi lần; panel đóng -> bỏ qua).
            initMediaSource(mediaSource) {
                const selectEl = genericDrawerBody.querySelector('#setting-playlist-media-source');
                if (!selectEl) return;
                selectEl.value = mediaSource;
            },
        };

        const PLAYLIST_SOURCES = ['song', 'video', 'photo'];

        /** Cấu hình Playlist đọc từ meta -> giá trị hợp lệ (Nguồn lạ -> 'song', thiếu field -> mặc định).
         * @param {object} cfg - appConfigPlaylist.getAll()
         * @returns {{activeMediaSource: string, displaySortMode: string, displayStatSortField: string, displayStatSortDirection: string, isGridView: boolean}} */
        function sanitizePlaylistConfig(cfg) {
            return {
                activeMediaSource: PLAYLIST_SOURCES.includes(cfg.activeMediaSource) ? cfg.activeMediaSource : 'song',
                displaySortMode: cfg.displaySortMode || 'az',
                displayStatSortField: cfg.displayStatSortField || 'none',
                displayStatSortDirection: cfg.displayStatSortDirection || 'desc',
                isGridView: !!cfg.isGridView,
            };
        }

        /** Phần giao diện đổi theo Nguồn: placeholder ô tìm kiếm, `accept` 2 input upload dùng chung (#media-upload,
         * #media-upload-folder), hiện hàng Phát/Trộn bài. @param {string} placeholderText @param {string} uploadAccept */
        function applyPlaylistSourceChrome(placeholderText, uploadAccept) {
            if (playlistSearchInput) playlistSearchInput.placeholder = placeholderText;
            if (fileInput) fileInput.accept = uploadAccept;
            if (folderInput) folderInput.accept = uploadAccept;
            if (btnPlaylistEmptyPlay) btnPlaylistEmptyPlay.classList.remove('hidden');
            if (btnPlaylistEmptyShuffle) btnPlaylistEmptyShuffle.classList.remove('hidden');
        }

        /** Panel "Sắp xếp" (components/playlist-sort-drawer.js) vừa mở — điền giá trị hiện tại vào 3 select.
         * @param {HTMLElement} panelEl @param {string} sortMode @param {string} statField @param {string} statDirection */
        function syncSortPanelValues(panelEl, sortMode, statField, statDirection) {
            panelEl.querySelector('#setting-playlist-sort-name').value = sortMode;
            panelEl.querySelector('#setting-playlist-sort-stat-field').value = statField;
            panelEl.querySelector('#setting-playlist-sort-stat-direction').value = statDirection;
        }

        /** Hàng "Hướng" + icon (i) cạnh nhãn Tên/Ngày chỉ hiện khi Stats chọn field khác 'none'. Panel đóng -> bỏ qua.
         * @param {HTMLElement} panelEl @param {string} statField */
        function toggleSortStatDependents(panelEl, statField) {
            const isOff = statField === 'none';
            ['[data-sort-direction-row]', '[data-sort-stat-info]'].forEach((selector) => {
                const el = panelEl.querySelector(selector);
                if (el) el.classList.toggle('hidden', isOff);
            });
        }

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
