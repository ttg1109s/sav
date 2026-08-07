/**
 * playlist/main.js — "Bộ điều phối" của module Playlist, viết theo DẠNG OBJECT-FUNCTION.
 *
 * Gom các phần "khởi tạo & gắn sự kiện ở cấp màn hình Playlist" (sắp xếp, kiểu xem, ô tìm kiếm)
 * vào một object duy nhất `PlaylistMain` với các method rõ ràng, thay vì rải rác top-level như
 * bản gộp cũ. Logic chi tiết vẫn nằm ở các file cùng thư mục:
 *   - state.js   : biến trạng thái dùng chung
 *   - order.js   : thuật toán thứ tự (render order / play queue / sort / shuffle)
 *   - render.js  : dựng & diff DOM danh sách, trạng thái rỗng, lọc tìm kiếm
 *   - loader.js  : nạp file mới + quét DB lúc khởi động
 *   - actions.js : phát/xoá/menu/modal từng bài
 *
 * Ver 10 refine: "Sắp xếp" + "Kiểu xem" (grid/list) CHUYỂN từ 2 icon riêng ở header Playlist
 * (#btn-sort-display + dropdown nổi, #btn-toggle-view) sang 2 <select> trong Settings (section
 * "Danh sách phát & Nền", xem components/settings/playlist-background.js) — dọn header gọn
 * lại. initSortMenu() đổi tên ý nghĩa thành đọc/ghi qua select thay cho dropdown menu nổi.
 * initViewMode() là method MỚI, chuyển nguyên logic grid/list từ state-and-video-bg.js sang đây
 * (cùng nhà với initSortMenu() — cùng nhóm "cách hiển thị danh sách Playlist").
 *
 * MIGRATE (kiến trúc /event/): TRƯỚC ĐÂY initSortMenu/initViewMode/initSearch tự
 * document.getElementById + addEventListener trực tiếp ngay trong file này. Toàn bộ
 * addEventListener đã dời sang event/listener/playlist.js (gộp chung router 'playlist' đã có từ
 * cụm actions.js/loader.js — KHÔNG tạo router riêng, vì cùng thuộc 1 "module Playlist" theo đúng
 * comment đầu file này từ trước). getElementById dọn về core/dom-refs.js (biến sortSelect,
 * viewModeSelect, playlistSearchInput, playlistSearchClear).
 *
 * SỬA (05/08/2026, Rule 3a, phản hồi Giang "xử lý triệt để... theo event bus, rule core") — ĐÃ BỎ
 * HẲN method `PlaylistMain.init()`: nội bộ nó gọi lần lượt 4 method core khác trong CHÍNH object
 * này (`this.initSortMenu()`/`initViewMode()`/`initMediaSource()`/`updateActiveFolderUI()`) — core
 * gọi core, vi phạm Rule 3a bất kể gói trong 1 method "init" tiện tay hay không. Việc GỌI TUẦN TỰ
 * 4 method này (điều phối, không phải nghiệp vụ core) giờ thuộc về Workflow — xem
 * `workflowPlaylist.syncPlaylistSettingsUI()` (event/workflow/playlist.js), dùng lại ở MỌI nơi
 * trước đây gọi `PlaylistMain.init()`.
 * NGOẠI LỆ DUY NHẤT — lần gọi ĐẦU TIÊN lúc boot (cuối file này): `event/workflow/playlist.js`
 * NẠP SAU file này (xem thứ tự <script> trong index.html) nên `workflowPlaylist` CHƯA tồn tại lúc
 * đó — bootstrap 1 lần ở cuối file này (top-level, KHÔNG phải hàm core/nghiệp vụ, chỉ dây nối 1
 * lần lúc nạp trang — đúng tinh thần "không phải định tuyến nghiệp vụ theo từng lượt tương tác" đã
 * ghi ở đây từ trước) vẫn tự gọi trực tiếp 4 method, KHÔNG qua Workflow được.
 */
        const PlaylistMain = {

            // ---- "Sắp xếp" (default / A→Z / Z→A; v6 đã bỏ "Ngẫu nhiên") — select trong Settings ----
            initSortMenu() {
                if (!sortSelect) return;
                sortSelect.value = appState.get('displaySortMode'); // đồng bộ giá trị hiện tại lúc Settings mở ra
            },

            // ---- "Kiểu xem" (Danh sách / Lưới) — select trong Settings, thay cho #btn-toggle-view
            //      cũ (logic chuyển nguyên từ state-and-video-bg.js, không đổi gì về hành vi). ----
            // FIX (05/08/2026, phản hồi Giang — "List -> Grid -> thoát app -> nạp lại -> Grid ->
            // vỡ layout"): TRƯỚC ĐÂY hàm này CHỈ gán lại <select>, KHÔNG đụng className của
            // #playlist-container, nên lúc boot #playlist-container vẫn giữ className "list" gán
            // sẵn trong HTML tĩnh (components/playlist-view.js) dù isGridView khôi phục là true —
            // buildSongNode() (core/playlist/render.js) dựng node theo cấu trúc LƯỚI trong khi
            // container cha vẫn flex-col -> mỗi node lưới xếp chồng full-width dọc, đúng y hệt ảnh
            // lỗi Giang gửi. Thêm 2 dòng gán className ngay dưới để đồng bộ NGAY tại đây.
            // SỬA THÊM (Rule 2, cùng đợt "xử lý triệt để") — nhận `isGridView` qua THAM SỐ thay vì
            // tự `appState.get('isGridView')` bên trong — nơi gọi (Workflow, hoặc bootstrap
            // top-level cuối file) chịu trách nhiệm đọc appState rồi truyền vào.
            // @param {boolean} isGridView
            initViewMode(isGridView) {
                if (!viewModeSelect) return;
                viewModeSelect.value = isGridView ? 'grid' : 'list';
                playlistContainer.className = isGridView
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32'
                    : 'flex flex-col pb-32';
            },

            // ---- MỚI (ver12 "Song/Video Unification", Batch 1) — "Nguồn" (Song/Video), select
            //      trong Settings, cùng khu vực Sắp xếp/Kiểu xem ngay trên. ----
            initMediaSource() {
                if (!mediaSourceSelect) return;
                mediaSourceSelect.value = appState.get('activeMediaSource'); // đồng bộ giá trị hiện tại lúc Settings mở ra
            },

            /**
             * MỚI (phản hồi Giang, mục 5 — "thêm dòng folder đang active source") — dòng đọc-thôi
             * hiển thị thư mục đang được Apply làm Scope cho Playlist (đọc `activePlayListFolder`,
             * service/state/file-manager.js) — "chưa kích hoạt thư mục nào" nếu rỗng.
             * MỞ RỘNG (phản hồi Giang, mục 2 — "có folder active thì phải ẩn/block đổi Nguồn") —
             * ĐỔI TÊN từ `updateActiveFolderBadge()`: giờ CÙNG LÚC khoá `<select>` "Nguồn" (thêm
             * `disabled` + class mờ) khi đang có Scope — folder Scope CHỈ chứa 1 loại (song/video),
             * đổi Nguồn giữa chừng sẽ làm `playlistOrder` (đã lọc theo folder) lệch hẳn với
             * `playlistCache` (đổi hết sang loại khác) — coi 2 việc "hiện tên folder"/"khoá đổi
             * Nguồn" là 1 cụm UI phản ứng CÙNG 1 state (`activePlayListFolder`), gộp lại tránh quên
             * gọi 1 trong 2 ở chỗ nào đó.
             * Gọi lúc boot/mở Settings (qua `workflowPlaylist.syncPlaylistSettingsUI()` hoặc bootstrap
             * cuối file) VÀ ngay sau mỗi lần `persistScopeChoice()` đổi (workflowPlaylistScope) để
             * phản ánh đúng NGAY, không cần đợi reload — cùng tinh thần "badge phản ánh đúng NGAY"
             * đã ghi trong docstring persistScopeChoice().
             */
            async updateActiveFolderUI() {
                const folderId = appState.get('activePlayListFolder');
                // XOÁ (v14, Giang chốt mục 2) — khoá thứ hai "Visual Background đang bật" bỏ hẳn:
                // đổi Nguồn Playlist sang Video giờ được phép tự do; xung đột giải quyết ở CHIỀU
                // NGƯỢC LẠI lúc thật sự VÀO Video Player mode (workflowVisualBg.clearMediaLayers(),
                // event/workflow/video-player.js::startFromPlaylist()) — không cần khoá select này
                // nữa, chỉ còn đúng 1 lý do khoá (Folder Scope).
                const locked = !!folderId;
                if (mediaSourceSelect) {
                    mediaSourceSelect.disabled = locked;
                    mediaSourceSelect.classList.toggle('opacity-40', locked);
                    mediaSourceSelect.title = folderId ? t('settingsPlaylistBg.mediaSource.lockedByFolderScope') : '';
                }
                const el = document.getElementById('setting-playlist-active-folder');
                if (!el) return;
                if (!folderId) { el.textContent = t('settingsPlaylistBg.activeFolder.none'); return; }
                const folderRecord = typeof getFolderRecord === 'function' ? await getFolderRecord(folderId) : null;
                el.textContent = folderRecord ? folderRecord.name : t('settingsPlaylistBg.activeFolder.none');
            }
        };

        /**
         * Ứng với select "Kiểu xem" đổi giá trị — đổi isGridView + className của playlistContainer.
         * SỬA (05/08/2026, Rule 2) — trước đây đọc lại `appState.get('isGridView')` NGAY SAU khi
         * vừa `appState.set()` chính field đó để tính className — thừa 1 lượt đọc, dùng thẳng
         * `mode` (tham số đã có sẵn) thay thế.
         * SỬA THÊM (Rule 3a, "xử lý triệt để") — BỎ lời gọi `renderPlaylistFull()` (core khác) ở
         * cuối hàm — core gọi core, cấm tuyệt đối. Nơi gọi hàm này (`workflowPlaylist.
         * changeViewMode()`, event/workflow/playlist.js) giờ tự gọi `renderPlaylistFull()` NGAY SAU
         * `setPlaylistViewMode()`, đúng vai Workflow điều phối ≥2 lời gọi core độc lập.
         * @param {string} mode - 'grid' | 'list'
         */
        function setPlaylistViewMode(mode) {
            const isGridView = mode === 'grid';
            appState.set('isGridView', isGridView);
            playlistContainer.className = isGridView
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32'
                : 'flex flex-col pb-32';
        }

        /**
         * Ứng với ô tìm kiếm gõ chữ — toggle hiện/ẩn nút xoá theo có chữ hay không, rồi lọc lại
         * danh sách hiển thị qua applySearchQuery() (đã có sẵn ở playlist/render.js).
         * @param {string} value
         */
        function handlePlaylistSearchInput(value) {
            if (playlistSearchClear) playlistSearchClear.classList.toggle('hidden', !value);
            applySearchQuery(value);
        }

        /** Ứng với nút xoá ô tìm kiếm — reset input + ẩn nút + xoá lọc + focus lại ô nhập. */
        function clearPlaylistSearch() {
            if (playlistSearchInput) playlistSearchInput.value = '';
            if (playlistSearchClear) playlistSearchClear.classList.add('hidden');
            applySearchQuery('');
            if (playlistSearchInput) playlistSearchInput.focus();
        }

        // Bootstrap 1 lần lúc nạp script — top-level, KHÔNG phải hàm core/nghiệp vụ (xem docstring
        // đầu file, đoạn "SỬA 05/08/2026") — gọi trực tiếp 4 method PlaylistMain ở đây thay vì qua
        // `workflowPlaylist.syncPlaylistSettingsUI()` vì event/workflow/playlist.js nạp SAU file
        // này (thứ tự <script> trong index.html), `workflowPlaylist` chưa tồn tại lúc dòng này chạy.
        PlaylistMain.initSortMenu();
        PlaylistMain.initViewMode(appState.get('isGridView'));
        PlaylistMain.initMediaSource();
        PlaylistMain.updateActiveFolderUI();
