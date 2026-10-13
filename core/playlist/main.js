/**
 * core/playlist/main.js — `PlaylistMain`: đồng bộ các control "cách hiển thị danh sách" (Kiểu xem, Nguồn) + badge
 * folder + ô tìm kiếm. Sự kiện gắn ở event/listener/playlist.js; gọi tuần tự các method là việc của Workflow
 * (`workflowPlaylist.syncPlaylistSettingsUI()`), trừ lần bootstrap lúc nạp script ở cuối file.
 * Cùng thư mục: state.js (biến dùng chung), order.js (thứ tự), render.js (DOM danh sách), loader.js (nạp), actions.js
 * (menu/modal từng bài).
 */
        const PlaylistMain = {

            // Sắp xếp/Lọc là subpanel riêng — đồng bộ select bên trong panel ở workflowPlaylist.openSortPanel().

            // "Kiểu xem" (Danh sách / Lưới) — select trong Settings. `.value` của select chỉ áp khi panel đang mở (select
            // sống trong Generic Drawer); `className` của #playlist-container LUÔN áp — boot khôi phục Grid mà còn class
            // "list" tĩnh trong HTML là vỡ layout.
            // @param {boolean} isGridView
            initViewMode(isGridView) {
                if (viewModeSelect) viewModeSelect.value = isGridView ? 'grid' : 'list';
                playlistContainer.className = isGridView
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32'
                    : 'flex flex-col pb-32';
            },

            // "Nguồn" (Song/Video/Photo) — select trong Settings. Nhận `selectEl` qua tham số: select sống trong Generic
            // Drawer, nơi gọi truy vấn lại DOM mỗi lần (event/workflow/app-settings.js::_renderPlaylist(),
            // workflowPlaylist.syncPlaylistSettingsUI()).
            initMediaSource(selectEl, mediaSource) {
                if (!selectEl) return;
                selectEl.value = mediaSource;
            },
        };

        /** Hiện/ẩn badge "đang xem folder" trong ô tìm kiếm + tên folder (Workflow đọc:
         * workflowPlaylistScope.syncActiveFolderBadge()). @param {boolean} isScoped @param {string} folderName */
        function applyActiveFolderBadge(isScoped, folderName) {
            if (!playlistActiveFolderBadge) return; // guard phòng vệ — badge tĩnh, luôn mounted
            if (playlistActiveFolderBadgeName) playlistActiveFolderBadgeName.textContent = folderName;
            playlistActiveFolderBadge.classList.toggle('hidden', !isScoped);
        }

        /**
         * Ứng với select "Kiểu xem" — đổi isGridView + className của playlistContainer. Vẽ lại danh sách do Workflow gọi
         * tiếp (workflowPlaylist.changeViewMode()).
         * @param {string} mode - 'grid' | 'list'
         */
        function setPlaylistViewMode(mode) {
            const isGridView = mode === 'grid';
            appState.set('isGridView', isGridView);
            console.log(`writer: "setPlaylistViewMode", page: "isGridView", content: "${isGridView}"`);
            playlistContainer.className = isGridView
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32'
                : 'flex flex-col pb-32';
        }

        /**
         * Ô tìm kiếm gõ chữ — chỉ hiện/ẩn nút xoá theo có chữ hay không. Lọc lại danh sách:
         * workflowPlaylistOrder.searchInput() (event/workflow/playlist-order.js).
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

        // Bootstrap 1 lần lúc nạp script — gọi trực tiếp vì event/workflow/playlist.js nạp sau file này.
        PlaylistMain.initViewMode(appState.get('isGridView'));
        // Settings chưa từng mở -> select chưa có, NO-OP.
        const bootMediaSourceSelectEl = genericDrawerBody.querySelector('#setting-playlist-media-source');
        PlaylistMain.initMediaSource(bootMediaSourceSelectEl, appState.get('activeMediaSource'));
        // Badge folder không đồng bộ ở đây: badge tĩnh đã `hidden` sẵn, activePlayListFolder chưa nạp từ meta (app-boot).
