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
 * `PlaylistMain.init()` được gọi 1 lần (cuối file này) — mọi #id liên quan đã tồn tại trong DOM
 * vì main.js (bootstrap) đã mount toàn bộ component TRƯỚC khi nhóm core + playlist chạy.
 *
 * MIGRATE (kiến trúc /event/): TRƯỚC ĐÂY initSortMenu/initViewMode/initSearch tự
 * document.getElementById + addEventListener trực tiếp ngay trong file này. Toàn bộ
 * addEventListener đã dời sang event/listener/playlist.js (gộp chung router 'playlist' đã có từ
 * cụm actions.js/loader.js — KHÔNG tạo router riêng, vì cùng thuộc 1 "module Playlist" theo đúng
 * comment đầu file này từ trước). getElementById dọn về core/dom-refs.js (biến sortSelect,
 * viewModeSelect, playlistSearchInput, playlistSearchClear). File này giờ CHỈ còn 2 method
 * "init" (gán giá trị ban đầu cho UI đúng state hiện có lúc Settings/Playlist mở ra lần đầu —
 * KHÔNG phải addEventListener, vẫn giữ ở đây vì là việc khởi tạo 1-lần, không phải định tuyến
 * nghiệp vụ theo từng lượt tương tác) + các hàm core thuần mà router gọi tới khi nhận message.
 */
        const PlaylistMain = {

            // ---- "Sắp xếp" (default / A→Z / Z→A; v6 đã bỏ "Ngẫu nhiên") — select trong Settings ----
            initSortMenu() {
                if (!sortSelect) return;
                sortSelect.value = appState.get('displaySortMode'); // đồng bộ giá trị hiện tại lúc Settings mở ra
            },

            // ---- "Kiểu xem" (Danh sách / Lưới) — select trong Settings, thay cho #btn-toggle-view
            //      cũ (logic chuyển nguyên từ state-and-video-bg.js, không đổi gì về hành vi). ----
            initViewMode() {
                if (!viewModeSelect) return;
                viewModeSelect.value = appState.get('isGridView') ? 'grid' : 'list'; // đồng bộ giá trị hiện tại lúc Settings mở ra
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
             * Gọi lúc init() (boot/mở Settings) VÀ ngay sau mỗi lần `persistScopeChoice()` đổi
             * (workflowPlaylistScope) để phản ánh đúng NGAY, không cần đợi reload — cùng tinh thần
             * "badge phản ánh đúng NGAY" đã ghi trong docstring persistScopeChoice().
             */
            async updateActiveFolderUI() {
                const folderId = appState.get('activePlayListFolder');
                if (mediaSourceSelect) {
                    mediaSourceSelect.disabled = !!folderId;
                    mediaSourceSelect.classList.toggle('opacity-40', !!folderId);
                    mediaSourceSelect.title = folderId ? t('settingsPlaylistBg.mediaSource.lockedByFolderScope') : '';
                }
                const el = document.getElementById('setting-playlist-active-folder');
                if (!el) return;
                if (!folderId) { el.textContent = t('settingsPlaylistBg.activeFolder.none'); return; }
                const folderRecord = typeof getFolderRecord === 'function' ? await getFolderRecord(folderId) : null;
                el.textContent = folderRecord ? folderRecord.name : t('settingsPlaylistBg.activeFolder.none');
            },

            init() {
                this.initSortMenu();
                this.initViewMode();
                this.initMediaSource();
                this.updateActiveFolderUI();
            }
        };

        /**
         * Ứng với select "Kiểu xem" đổi giá trị — đổi isGridView + className của playlistContainer
         * + vẽ lại toàn bộ (layout grid/list khác cấu trúc node hoàn toàn -> không diff được).
         * @param {string} mode - 'grid' | 'list'
         */
        function setPlaylistViewMode(mode) {
            appState.set('isGridView', mode === 'grid');
            playlistContainer.className = appState.get('isGridView')
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32'
                : 'flex flex-col pb-32';
            renderPlaylistFull();
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

        PlaylistMain.init();
