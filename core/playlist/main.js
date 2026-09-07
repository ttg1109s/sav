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

            // ---- "Sắp xếp"/"Lọc" ĐÃ CHUYỂN thành subpanel riêng (mục 1b/1d, phản hồi Giang) —
            // initSortMenu() (đồng bộ 1 <select> tĩnh) ĐÃ XOÁ, không còn <select> nào ở Main list
            // nữa. Đồng bộ 2 <select> BÊN TRONG panel giờ là việc của workflowPlaylist.
            // openSortPanel() (event/workflow/playlist.js), CHẠY LÚC PANEL MỞ — cùng khuôn
            // workflowVisualizerDisplay.openDisplayPanel() (event/workflow/visualizer-display.js).

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
            //
            // SỬA LẠI (mục 2, Giang báo lại ĐÚNG bug NÀY tái xuất — "Grid -> thoát ra -> vào lại ->
            // vỡ layout") — bug hồi 05/08 tưởng đã sửa xong, NHƯNG fix cũ đặt CẢ 2 dòng gán
            // className phía SAU guard `if (!viewModeSelect) return;`, dựa trên giả định lúc đó
            // ĐÚNG (Settings còn là panel TĨNH gắn sẵn cả phiên, `viewModeSelect` — core/dom-refs.js,
            // 1 lần `document.getElementById()` lúc nạp script — không bao giờ null). Settings SAU
            // ĐÓ migrate sang Generic Drawer (event/workflow/app-settings.js) — nội dung panel
            // (kể cả `<select id="setting-playlist-view-mode">`) giờ CHỈ tồn tại trong khoảng thời
            // gian panel "Playlist" đang MỞ, bị huỷ/dựng lại mỗi lần đóng/mở — dom-refs.js CHƯA
            // từng cập nhật theo kiến trúc mới. Ngay sau mỗi lần mở lại app (chưa từng mở Settings
            // > Playlist trong phiên đó), phần tử này CHƯA tồn tại lúc dom-refs.js chạy ->
            // `viewModeSelect` = `null` VĨNH VIỄN cho hết phiên (const, không tự truy vấn lại) ->
            // guard cũ chặn LUÔN cả dòng gán `playlistContainer.className` — restore lúc boot
            // (`workflowPlaylist.loadPersistedPlaylistConfigOnBoot()` -> `syncPlaylistSettingsUI()`
            // -> hàm NÀY) âm thầm bỏ qua, className mặc định TĨNH trong HTML ("list") đứng yên
            // trong khi buildSongNode() vẫn dựng từng item ĐÚNG kiểu GRID theo appState -> vỡ
            // layout đúng y hệt trước — chỉ khác NGUYÊN NHÂN gốc, không phải cùng 1 chỗ hổng.
            // Chọn thủ công List rồi Grid lại "tự sửa" được vì `setPlaylistViewMode()` (ngay dưới)
            // gán `playlistContainer.className` TRỰC TIẾP, không hề đụng `viewModeSelect` — không
            // đi qua guard này nên không bao giờ dính bug.
            // SỬA TẬN GỐC — TÁCH riêng 2 việc: `.value` của select (CÓ THỂ không tồn tại nếu panel
            // Settings đang đóng, chỉ áp KHI có) và `className` của `playlistContainer` (LUÔN LUÔN
            // phải áp — 2 phần tử độc lập, không có lý do gì để chung 1 guard khiến 1 cái kẹt theo
            // cái kia).
            // @param {boolean} isGridView
            initViewMode(isGridView) {
                if (viewModeSelect) viewModeSelect.value = isGridView ? 'grid' : 'list';
                playlistContainer.className = isGridView
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-6 px-5 pb-32'
                    : 'flex flex-col pb-32';
            },

            // ---- MỚI (ver12 "Song/Video Unification", Batch 1) — "Nguồn" (Song/Video), select
            //      trong Settings, cùng khu vực Sắp xếp/Kiểu xem ngay trên. ----
            // SỬA (06/09/2026, Giang chỉ ra bug) — nhận `selectEl` qua THAM SỐ thay vì tự đọc biến
            // toàn cục `mediaSourceSelect` (dom-refs.js, document.getElementById() 1 LẦN lúc script
            // nạp — TỪ LÚC Settings migrate sang Generic Drawer content-swap, phần tử này CHƯA tồn
            // tại lúc dom-refs.js chạy nên biến đó `null` VĨNH VIỄN cả phiên, y hệt bug `viewModeSelect`
            // đã sửa trước đó). Nơi gọi tự truy vấn LẠI DOM MỖI LẦN cần (querySelector trên
            // `genericDrawerBody`/`body` đang render), KHÔNG cache — xem event/workflow/app-settings.js
            // ::_renderPlaylist() (nơi gọi CHÍNH, mỗi lần màn Playlist Settings mở) và
            // event/workflow/playlist.js::syncPlaylistSettingsUI().
            initMediaSource(selectEl) {
                if (!selectEl) return;
                selectEl.value = appState.get('activeMediaSource'); // đồng bộ giá trị hiện tại lúc Settings mở ra
            },

            /**
             * SỬA (mục 1a, phản hồi Giang — "bỏ row active folder, thêm vào dropdown của Nguồn") —
             * dòng đọc-thôi RIÊNG (`#setting-playlist-active-folder`) ĐÃ XOÁ khỏi Settings →
             * Playlist (components/settings/playlist-view.js). Tên folder đang Scope giờ hiện
             * NGAY TRONG `<select>` "Nguồn" — chèn thêm 1 `<option>` MANG TÊN folder, tự chọn
             * (`selected`) option đó, rồi khoá `<select>` — CƠ CHẾ KHOÁ GIỮ NGUYÊN Y HỆT bản cũ
             * (`disabled` + class mờ + tooltip, KHÔNG qua block gate — xem event/block.js, đã bỏ
             * hẳn 2 block cho 'playlist.mediaSource.change' từ v14, `disabled` là đủ vì browser tự
             * chặn sự kiện 'change' bắn ra từ 1 <select> đang `disabled`).
             * Gọi lúc boot/mở Settings (qua `workflowPlaylist.syncPlaylistSettingsUI()` hoặc
             * bootstrap cuối file) VÀ ngay sau mỗi lần `persistScopeChoice()` đổi
             * (workflowPlaylistScope) để phản ánh đúng NGAY, không cần đợi reload.
             * SỬA (06/09/2026, Giang chỉ ra bug — "khoá Nguồn khi có Scope không hoạt động") — hàm
             * này TRƯỚC ĐÂY tự đọc biến toàn cục `mediaSourceSelect` (dom-refs.js), capture 1 LẦN
             * lúc script nạp — luôn `null` từ lúc Settings migrate sang Generic Drawer content-swap
             * (phần tử `<select>` chỉ tồn tại đúng lúc màn Playlist Settings đang MỞ), khiến guard
             * `if (!mediaSourceSelect) return;` chặn HẲN, function no-op ÂM THẦM ở MỌI lần gọi — tính
             * năng khoá <select> khi có Folder Scope active KHÔNG BAO GIỜ thật sự chạy, dù
             * `_renderPlaylist()` (event/workflow/app-settings.js) vẫn đồng bộ đúng `.value` mỗi lần
             * mở (nên bug không lộ ra ở đó, chỉ riêng phần khoá/option folder là mất). Nhận `selectEl`
             * qua THAM SỐ, nơi gọi tự truy vấn DOM sống ngay trước khi gọi (KHÔNG cache) — xem
             * event/workflow/app-settings.js::_renderPlaylist() (nơi gọi MỚI thêm, sửa đúng gốc).
             * @param {HTMLSelectElement|null} selectEl
             */
            async updateActiveFolderUI(selectEl) {
                if (!selectEl) return;
                // Dọn option folder CŨ (nếu có) trước — tránh đọng lại option của lần Scope trước
                // khi đổi/bỏ Scope (mỗi lần gọi hàm này tự dựng lại ĐÚNG 1 option, không cộng dồn).
                const oldOption = selectEl.querySelector('option[data-folder-option]');
                if (oldOption) oldOption.remove();

                // SỬA (06/09/2026, đổi schema activePlayListFolder theo Nguồn) — object
                // {song,video,photo} thay vì 1 giá trị phẳng, đọc ĐÚNG field của Nguồn đang browse.
                const folderId = appState.get('activePlayListFolder')[appState.get('activeMediaSource')];
                if (!folderId) {
                    selectEl.disabled = false;
                    selectEl.classList.remove('opacity-40');
                    selectEl.title = '';
                    return;
                }

                const folderRecord = typeof getFolderRecord === 'function' ? await getFolderRecord(folderId) : null;
                const opt = document.createElement('option');
                opt.dataset.folderOption = 'true';
                opt.value = appState.get('activeMediaSource'); // giữ ĐÚNG value song/video hiện tại — chỉ đổi CHỮ hiển thị
                opt.textContent = folderRecord ? folderRecord.name : t('settingsPlaylistBg.activeFolder.none');
                selectEl.appendChild(opt);
                opt.selected = true;
                selectEl.disabled = true;
                selectEl.classList.add('opacity-40');
                selectEl.title = t('settingsPlaylistBg.mediaSource.lockedByFolderScope');
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
        PlaylistMain.initViewMode(appState.get('isGridView'));
        // SỬA (06/09/2026) — `genericDrawerBody.querySelector(...)` thay biến toàn cục
        // `mediaSourceSelect` (dom-refs.js) đã XOÁ — tại đúng dòng này (bootstrap lúc script vừa
        // nạp) chắc chắn trả `null` (Settings chưa từng mở), NO-OP đúng ý nghĩa như trước giờ.
        const bootMediaSourceSelectEl = genericDrawerBody.querySelector('#setting-playlist-media-source');
        PlaylistMain.initMediaSource(bootMediaSourceSelectEl);
        PlaylistMain.updateActiveFolderUI(bootMediaSourceSelectEl);
