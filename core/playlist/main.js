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
 * này (`this.initSortMenu()`/`initViewMode()`/`initMediaSource()`/`updateActiveFolderBadge()`) — core
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
             * XOÁ (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") —
             * `updateActiveFolderUI(selectEl)` (khoá `<select>` "Nguồn" + chèn option mang tên
             * folder, sống ở đây từ mục 1a) bỏ hẳn — badge mới trong ô tìm kiếm Playlist
             * (components/playlist-view.js, `#playlist-active-folder-badge`) đảm nhiệm việc báo
             * "đang Scope folder nào" — `<select>` "Nguồn" ở Settings → Playlist trở lại bình
             * thường (không khoá/không chèn option gì nữa), chỉ còn `initMediaSource()` ngay trên lo
             * đồng bộ `.value`.
             * MỚI (06/09/2026, cùng đợt) — `updateActiveFolderBadge()` thay thế, đọc field ĐÚNG
             * Nguồn hiện tại trong object `activePlayListFolder` ({song,video,photo}), hiện/ẩn
             * badge tĩnh (`playlist-active-folder-badge`, dom-refs.js — mounted CỐ ĐỊNH cùng màn
             * Playlist chính, KHÔNG cần nhận tham số DOM như `updateActiveFolderUI()` cũ, vì phần tử
             * này không thuộc Generic Drawer content-swap nên không bị stale). Gọi từ
             * `event/workflow/playlist-scope.js::applyFolderScope()`/`applyAllSongsScope()` (thay vì
             * `persistScopeChoice()` như hàm cũ — badge phản ánh SCOPE THẬT ĐANG ÁP DỤNG, không chỉ
             * ý định vừa lưu, dù 2 hàm đó luôn gọi liền nhau trong thực tế nên khác biệt không lộ ra).
             */
            async updateActiveFolderBadge() {
                if (!playlistActiveFolderBadge) return; // guard phòng vệ thuần — thực tế luôn mounted (tĩnh, không thuộc content-swap)
                const folderId = appState.get('activePlayListFolder')[appState.get('activeMediaSource')];
                if (!folderId) {
                    playlistActiveFolderBadge.classList.add('hidden');
                    return;
                }
                const folderRecord = typeof getFolderRecord === 'function' ? await getFolderRecord(folderId) : null;
                if (playlistActiveFolderBadgeName) playlistActiveFolderBadgeName.textContent = folderRecord ? folderRecord.name : '';
                playlistActiveFolderBadge.classList.remove('hidden');
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
        // XOÁ (06/09/2026) — `PlaylistMain.updateActiveFolderUI(bootMediaSourceSelectEl)` bỏ theo
        // hàm đã xoá (mục 3.1, xem docstring updateActiveFolderBadge() ngay trên). Không gọi
        // `updateActiveFolderBadge()` thay thế Ở ĐÂY: badge tĩnh đã `hidden` sẵn trong HTML gốc,
        // và `appState.activePlayListFolder` còn giữ default (chưa nạp từ meta — việc đó xảy ra
        // sau, trong `event/workflow/app-boot.js::boot()`) — gọi lúc này chỉ là 1 lượt async vô ích.
