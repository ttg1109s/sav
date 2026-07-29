/**
 * Component: Playlist View (màn hình danh sách bài hát)
 * Biến này chứa chuỗi HTML, được main.js chèn vào DOM lúc khởi động.
 *
 * FIX (04/07/2026, mục 1b/4 phản hồi Giang) — `position: absolute` -> `fixed`. Nguyên nhân bug
 * "bàn phím trượt lên làm khuyết mất 1 phần Playlist UI" (Settings drawer KHÔNG bị, cùng bug):
 * `#drawer-settings` vốn đã dùng `fixed` (containing block = viewport, KHÔNG đổi theo bàn phím);
 * `#playlist-view` dùng `absolute` (containing block = `body`/`html`, mà chiều cao đó CÓ THỂ bị
 * trình duyệt tính lại khi bàn phím ảo mở trên 1 số thiết bị/trình duyệt) — đổi sang `fixed` cho
 * ĐÚNG BẰNG hành vi đã chứng minh ổn định của Settings drawer.
 *
 * VIẾT LẠI THÊM (04/07/2026, mục 4) — bỏ class Tailwind `transition-transform duration-500` khỏi
 * template (chuyển hẳn qua CSS riêng `#playlist-view` ở assets/css/style.css, dùng chung 1 chỗ với
 * `#visualizer-ui`/`#player-container` cho cơ chế slide NGANG mới — khác hẳn `-translate-y-full`
 * dọc cũ). Responsive: mobile/tablet slide ngang (pager 2 trang); desktop (>=1024px) hiện SONG
 * SONG vĩnh viễn, Playlist làm cột trái 420px cố định — xem chi tiết đầy đủ trong file CSS đó.
 *
 * === VIẾT LẠI (07/07/2026, phản hồi Giang — gộp Playlist+Settings chung 1 container cuộn ngang) ===
 * `#playlist-view` KHÔNG còn tự định vị (`fixed inset-0 z-[60] bg-[#000000]` ĐÃ BỎ) — giờ chỉ là 1
 * "trang" bên trong `#side-left-container` (component MỚI, xem components/app-view-stack.js),
 * cuộn ngang qua lại với `#drawer-settings` bằng `scrollTo()` (core/player-controls.js). 2 div nền
 * (`#playlist-bg` + lớp phủ đen 40%) ĐÃ DỜI ra `#side-left-container` (dùng CHUNG cho cả Playlist
 * lẫn Settings — đúng yêu cầu "ảnh set chung cho container") — `updatePlaylistBg()`
 * (core/color-utils.js) KHÔNG cần sửa gì (vẫn `document.getElementById('playlist-bg')`, chỉ khác
 * vị trí vật lý trong DOM, ID giữ nguyên).
 */
const TPL_PLAYLIST_VIEW = `
    <div id="playlist-view" class="flex flex-col overflow-hidden">
        <div class="px-5 pt-4 pb-3 z-20 relative shrink-0">
            <!-- Hàng 1: logo SAV bên trái (hover trượt ra thành tên đầy đủ) + cụm icon góc phải
                 (Thêm nhạc + Cài đặt + Đổi giao diện). -->
            <div class="flex justify-between items-center gap-5 text-white mb-3">
                <!-- Logo "SAV" — không khung/nền/viền, in đậm màu trắng (kiểu logo Facebook).
                     LUÔN 1 DÒNG NGANG (cả lúc nghỉ và lúc mở rộng). Nghỉ: chỉ hiện "S A V". Mở
                     rộng: ngay sau mỗi chữ hoa, phần chữ thường còn lại của từ (imple/udio/
                     isualizer) TRƯỢT RA theo chiều ngang (max-width 0 -> giá trị đích, đúng kiểu
                     logo HTML5 nổi tiếng), nối liền nhau trên cùng 1 dòng thành "Simple Audio
                     Visualizer". Thu lại thì animate NGƯỢC LẠI co về "SAV" — cùng 1 transition
                     nên 2 chiều tự đối xứng. Mỗi chữ thường delay tăng dần (0/60/120ms) để có cảm
                     giác "trượt nối tiếp" từ trái qua phải thay vì cả 3 nở cùng lúc.

                     FIX (bug "bấm logo không ăn, có lúc còn bị zoom vào trang"): bản trước dùng
                     THUẦN CSS hover/group-hover — trên mobile Safari/Chrome, phần tử này là 1
                     div chữ thường (không phải button/a), không có thuộc tính touch-action riêng.
                     Trình duyệt có thể nhận lầm 1 chạm vào nó là tín hiệu "double-tap vào đoạn
                     văn bản" và kích hoạt ZOOM trang vào đúng vùng đó (tính năng "double-tap to
                     zoom paragraph" của WebKit) thay vì coi đó là 1 lượt hover/tap bình thường —
                     đúng triệu chứng quan sát được. Khi trang đã bị zoom, toạ độ chạm các lần sau
                     không còn khớp vị trí thật của logo nữa (lệch theo tỉ lệ zoom), trông như
                     "logo không bấm được" dù các nút khác (vốn là button thật) không bị ảnh
                     hưởng vì trình duyệt xử lý phần tử tương tác chuẩn khác hẳn.

                     SỬA: bỏ hẳn hover/group-hover, chuyển toggle mở/thu sang JS lắng nghe trực
                     tiếp (xem dom-refs.js) — desktop (chuột thật, phát hiện qua matchMedia
                     hover:hover and pointer:fine) dùng mouseenter/mouseleave để giữ ĐÚNG cảm giác
                     hover như cũ; mobile/cảm ứng dùng click (bắn ra từ 1 tap thật, không phải
                     gesture đoán) để toggle mở/thu — không tap nào còn bị trình duyệt hiểu nhầm
                     thành double-tap vì không còn phụ thuộc CSS hover nữa. Thuộc tính
                     touch-action: manipulation khai báo thêm trực tiếp trên thẻ làm lớp chặn
                     double-tap-zoom thứ 2 ở tầng trình duyệt. -->
                <div id="sav-logo" class="flex items-baseline shrink-0 cursor-pointer select-none leading-none" style="touch-action: manipulation;" data-i18n-title="playlistView.logo.title" title="${t('playlistView.logo.title')}">
                    <span class="text-base font-extrabold text-white">S</span><span class="sav-logo-expand text-base font-extrabold text-white whitespace-pre overflow-hidden inline-block max-w-0 transition-all duration-300 ease-in-out" data-expand-width="4.2em">imple </span><span class="text-base font-extrabold text-white">A</span><span class="sav-logo-expand text-base font-extrabold text-white whitespace-pre overflow-hidden inline-block max-w-0 transition-all duration-300 ease-in-out delay-[60ms]" data-expand-width="3.6em">udio </span><span class="text-base font-extrabold text-white">V</span><span class="sav-logo-expand text-base font-extrabold text-white whitespace-nowrap overflow-hidden inline-block max-w-0 transition-all duration-300 ease-in-out delay-[120ms]" data-expand-width="6em">isualizer</span>
                </div>
                <div class="flex items-center gap-5 shrink-0">
                <button id="btn-return-visual" class="hidden hover:text-emerald-400 transition-colors animate-pulse" data-i18n-title="playlistView.btnReturnVisual.title" title="${t('playlistView.btnReturnVisual.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <!-- #btn-open-file-manager ĐÃ XOÁ (CHỐT 03/07/2026, plan-v12-multimedia-decisions.md
                     mục 1a) — File Manager giờ mở từ Settings (section mới), không còn icon riêng
                     ở header Playlist nữa. -->
                <button id="btn-toggle-selection" class="hover:text-sky-400 transition-colors" data-i18n-title="playlistView.selection.toggleTitle" title="${t('playlistView.selection.toggleTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <button id="btn-upload-audio" class="hover:text-sky-400 transition-colors" data-i18n-title="playlistView.btnUploadAudio.title" title="${t('playlistView.btnUploadAudio.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </button>
                <!-- MỚI (FIX 28/07/2026, phản hồi Giang "Video chỉ 1 chế độ chọn nhiều file, bỏ
                     dropdown, input luôn") — "Thêm video" TÁCH RIÊNG khỏi #btn-upload-audio, đổi chỗ
                     ẩn/hiện cho nhau theo activeMediaSource (event/workflow/playlist.js::
                     switchToVideoSource()/switchToSongSource(), toggle class 'hidden'). Bản thân
                     phần tử này LÀ <label> BỌC TRỰC TIẾP <input type="file"> — CÙNG platform-compat
                     pattern audio-upload/audio-upload-folder (xem comment #upload-action-menu bên
                     dưới): click NATIVE thật lên label mới chắc chắn mở được file picker mọi nền
                     tảng, KHÔNG gọi .click() qua JS. Video CHỈ 1 lựa chọn (chọn nhiều file, KHÔNG có
                     "chọn cả thư mục") nên bấm 1 phát mở picker luôn, KHÔNG cần dropdown trung gian
                     như Song (#upload-action-menu, 2 lựa chọn) — #video-upload-menu (dropdown 1 lựa
                     chọn cũ, Batch 6 mục 7) ĐÃ XOÁ, input dời thẳng vào đây.
                     [KHÔI PHỤC 29/07/2026, phản hồi Giang] — khối <label> này bị THIẾU trong 1 lần
                     đóng gói trước (patch đè lên bản playlist-view.js CŨ, trước lúc khối này được
                     thêm) — Giang tự phát hiện qua diff bản gốc, chèn lại NGUYÊN VẸN từ bản gốc. -->
                <!-- FIX (29/07/2026, yêu cầu Giang mục 1 — "icon giống upload song") — đổi hẳn path
                     SVG (trước đây icon máy quay video) sang ĐÚNG NGUYÊN path đang dùng ở
                     #btn-upload-audio phía trên (icon "cloud upload") — CHỈ đổi icon hiển thị,
                     KHÔNG đổi id/class/behaviour/input picker gì khác. -->
                <label id="btn-upload-video" class="hidden hover:text-sky-400 transition-colors cursor-pointer" data-i18n-title="playlistView.uploadMenu.pickVideoFiles" title="${t('playlistView.uploadMenu.pickVideoFiles')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <input type="file" id="video-upload-input" accept="video/*" multiple class="hidden">
                </label>
                <button id="btn-settings-playlist" class="hover:text-sky-400 transition-colors" data-i18n-title="playlistView.btnSettings.title" title="${t('playlistView.btnSettings.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
                <!-- "Đổi giao diện" (Grid/List) đã dồn vào Settings (section "Danh sách phát &
                     Nền") — không còn icon riêng ở header, theo yêu cầu dọn header gọn lại. -->
                </div>
            </div>

            <!-- Hàng 2 (SỬA, phản hồi Giang mục 4 — bỏ heading "Bài hát" cạnh trái, thanh tìm kiếm
                 giờ chiếm TRỌN chiều ngang): heading cũ chỉ đúng ngữ cảnh Song, không còn hợp lý khi
                 Playlist dùng chung cho cả Video (đổi Nguồn qua Settings) — bỏ hẳn thay vì đổi chữ
                 theo nguồn, đơn giản hơn và khớp đúng yêu cầu "search full width". -->
            <div class="mb-3">
                <div class="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input id="playlist-search-input" type="text" inputmode="search" autocomplete="off" data-i18n-placeholder="playlistView.search.placeholder" placeholder="${t('playlistView.search.placeholder')}" class="w-full bg-white/10 focus:bg-white/15 border border-white/10 focus:border-sky-500/60 rounded-2xl pl-10 pr-10 py-2.5 text-[15px] text-white placeholder-slate-400 outline-none transition-colors backdrop-blur-md">
                    <button id="playlist-search-clear" class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1" data-i18n-title="playlistView.search.clear.title" title="${t('playlistView.search.clear.title')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            <!-- Hàng 3: Phát | Trộn bài. "Sắp xếp" + "Kiểu xem" (Grid/List) đã dồn vào Settings
                 (section "Danh sách phát & Nền", xem js/components/settings/playlist-background.js)
                 — không còn icon riêng ở đây, theo yêu cầu dọn header gọn lại. -->
            <div class="flex gap-3">
                <button id="btn-playlist-empty-play" class="flex-1 min-w-0 bg-white/10 hover:bg-white/20 backdrop-blur-md active:scale-95 transition-all py-3 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
                    <span data-i18n="playlistView.btnPlay">${t('playlistView.btnPlay')}</span>
                </button>
                <button id="btn-playlist-empty-shuffle" class="flex-1 min-w-0 bg-white/10 hover:bg-white/20 backdrop-blur-md active:scale-95 transition-all py-3 rounded-2xl flex items-center justify-center gap-1.5 font-semibold text-[14px] text-white whitespace-nowrap">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    <span data-i18n="playlistView.btnShuffleAll">${t('playlistView.btnShuffleAll')}</span>
                </button>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto z-10 w-full relative">
            <div id="playlist-empty" class="hidden h-[60%] flex flex-col items-center justify-center text-slate-400 gap-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <p class="text-sm" data-i18n="playlistView.empty.noSongs">${t('playlistView.empty.noSongs')}</p>
            </div>
            <div id="playlist-search-empty" class="hidden h-[40%] flex flex-col items-center justify-center text-slate-400 gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <p class="text-sm" data-i18n="playlistView.empty.noSearchResults">${t('playlistView.empty.noSearchResults')}</p>
            </div>
            <!-- Lớp "đang nạp danh sách": phủ lên vùng list lúc khởi động đọc record từ IndexedDB, fade
                 out khi DOM list dựng xong. Mục đích: tránh nháy "Chưa có bài hát nào" trong lúc đang
                 đọc dữ liệu. Logic ở initPlaylistFromDB: keys<=0 -> hiện #playlist-empty; else -> hiện
                 lớp này (cập nhật "x / y bài") rồi fade out sau khi render. -->
            <div id="playlist-loading-list" class="hidden absolute inset-0 z-10 flex flex-col items-center justify-center text-slate-300 gap-3 bg-black/30 backdrop-blur-sm transition-opacity duration-300" style="opacity:0;">
                <svg class="animate-spin h-10 w-10 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p id="playlist-loading-text" class="text-sm font-medium tracking-wide">${t('playlistView.loading.generic')}</p>
            </div>
            <div id="playlist-container" class="flex flex-col pb-32"></div>
        </div>

        <!-- Thanh hành động "chọn nhiều" (ver 12 "Multi Media") — ẩn mặc định (class hidden), hiện
             qua workflow toggleSelectionMode() khi selectionMode=true. z-20: nổi trên
             #playlist-container (z-10 mặc định của flex-grow cha) nhưng vẫn dưới mọi modal
             (z-[110]+). ĐÚNG layout bác chốt: trái = nhãn số lượng, phải = 1 nút 3 chấm mở dropup
             4 hành động (KHÔNG phải 4 nút rời) — xem #selection-more-menu bên dưới, dùng lại đúng
             pattern định vị/đóng của #song-action-menu + #song-action-overlay. -->
        <div id="selection-action-bar" class="hidden absolute bottom-0 inset-x-0 z-20 bg-[#0f172a]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
            <span id="selection-count-label" class="text-sm font-semibold text-slate-200"></span>
            <button id="btn-selection-more" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-200" data-i18n-title="playlistView.selection.moreTitle" title="${t('playlistView.selection.moreTitle')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle><circle cx="5" cy="12" r="1.5"></circle></svg>
            </button>
        </div>
    </div>

    <!-- Dropup 4 hành động "chọn nhiều" — CÙNG PATTERN #song-action-menu (menu dùng chung, JS định
         vị lại mỗi lần mở), CHỈ khác: luôn mở PHÍA TRÊN #btn-selection-more (nút nằm sát đáy màn
         hình trong thanh hành động), xem openSelectionMoreMenu() (core/playlist/selection.js).
         Dùng CHUNG #song-action-overlay để đóng khi bấm ra ngoài (thêm 1 listener riêng, không đổi
         2 listener cũ đã có — xem event/listener/playlist.js). -->
    <div id="selection-more-menu" class="hidden fixed z-[115] w-52 bg-[#171c2b] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <button data-menu-action="play" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
            <span data-i18n="playlistView.selection.btnPlay">${t('playlistView.selection.btnPlay')}</span>
        </button>
        <button data-menu-action="export" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-4V4m0 8l-3-3m3 3l3-3" /></svg>
            <span data-i18n="playlistView.selection.btnExport">${t('playlistView.selection.btnExport')}</span>
        </button>
        <button data-menu-action="addToFolder" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span data-i18n="playlistView.selection.btnAddToFolder">${t('playlistView.selection.btnAddToFolder')}</span>
        </button>
        <button data-menu-action="delete" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-rose-500/10 transition-colors text-rose-400 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span data-i18n="playlistView.selection.btnDelete">${t('playlistView.selection.btnDelete')}</span>
        </button>
    </div>

    <!-- Modal: Sửa thông tin bài hát (title/artist/album + ảnh bìa) — 2 tab trong cùng 1 modal:
         "Thông tin" (text fields cũ) và "Ảnh bìa" (upload/xem trước/xóa cover, mới ở ver 8).
         Card dùng .glass-modal (kính mờ "nét" — nền đậm hơn .glass-panel để chữ/control nổi rõ
         trên mọi ảnh nền playlist, viền sáng + glow nhẹ) thay cho nền đặc bg-[#0f172a] trước đây. -->
    <!-- Modal: Chi tiết bài hát (đổi tên từ "Sửa thông tin", yêu cầu Giang 11/07/2026 — modal vẫn
         giữ NGUYÊN 3 tab Chi tiết/Sửa/Ảnh bìa, chỉ đổi tên hiển thị ngoài + tiêu đề cho khớp đúng ý
         nghĩa "xem chi tiết" là chính, sửa chỉ là 1 trong các việc có thể làm bên trong).
         FIX (11/07/2026, yêu cầu Giang) — ĐỔI items-center -> items-start + pt-16: modal cũ
         canh GIỮA màn hình theo chiều dọc — 3 tab (Chi tiết/Sửa/Ảnh bìa) có chiều cao nội dung
         KHÁC NHAU, mỗi lần đổi tab modal đổi cao/thấp làm card "nhảy" CẢ 2 HƯỚNG trên/dưới (canh
         giữa co giãn đối xứng quanh tâm) — UX giật, khó theo dõi. Neo modal theo mép TRÊN cố định:
         đổi tab chỉ làm mép DƯỚI di chuyển, mép trên luôn đứng yên tại 1 vị trí — cảm giác ổn định
         hơn hẳn. overflow-y-auto phòng khi nội dung + khoảng đệm trên vượt quá chiều cao màn hình
         thấp. -->
    <div id="song-edit-modal" class="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm hidden flex items-start justify-center px-5 pt-16 pb-8 overflow-y-auto">
        <div class="glass-modal rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden">
            <div class="flex items-center gap-2.5 px-5 pt-5 pb-3 border-b border-white/10">
                <div class="w-8 h-8 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 class="text-base font-bold text-white" data-i18n="playlistView.songEdit.title">${t('playlistView.songEdit.title')}</h3>
            </div>

            <!-- SỬA (10/07/2026, gộp #song-info-modal cũ vào làm tab ĐẦU — phản hồi Giang): 3 tab
                 "Chi tiết" (đọc-thôi, MẶC ĐỊNH/đầu tiên) / "Sửa" (title/artist/album, SỬA được) /
                 "Ảnh bìa" — pill switcher như cũ, chỉ thêm 1 nút. -->
            <div class="flex gap-1 px-5 pt-4">
                <div class="flex w-full p-1 rounded-xl bg-black/30 border border-white/10 gap-1">
                    <button data-edit-tab="details" class="song-edit-tab-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-white/10 text-white shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span data-i18n="playlistView.songEdit.tabDetails">${t('playlistView.songEdit.tabDetails')}</span>
                    </button>
                    <button data-edit-tab="fields" class="song-edit-tab-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        <span data-i18n="playlistView.songEdit.tabFields">${t('playlistView.songEdit.tabFields')}</span>
                    </button>
                    <button id="song-edit-tab-btn-cover" data-edit-tab="cover" class="song-edit-tab-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 8h.01M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" /></svg>
                        <span data-i18n="playlistView.songEdit.tabCover">${t('playlistView.songEdit.tabCover')}</span>
                    </button>
                </div>
            </div>

            <!-- Tab 1 (MẶC ĐỊNH/đầu): Chi tiết — gộp từ #song-info-modal cũ (title/artist/album/
                 duration/lượt nghe/thời gian đã nghe, đọc-thôi) — populate qua JS
                 (core/playlist/actions.js::openSongEditModal(), dùng songInfoRowHtml()). -->
            <div id="song-edit-tab-details" class="flex flex-col gap-2 p-5"></div>

            <!-- Tab 2: Sửa — ĐỔI TÊN từ "Thông tin" (tab đầu cũ) — 2 nhóm LOẠI TRỪ NHAU tuỳ media
                 type (SỬA phản hồi Giang 28/07/2026, "video/song modal": Song = 3 field title/
                 artist/album như cũ; Video = CHỈ 1 ô tên hiển thị, KHÔNG có 3 tag) — JS
                 (core/playlist/actions.js::openSongEditModal()) tự ẩn/hiện ĐÚNG 1 group. -->
            <div id="song-edit-tab-fields" class="hidden flex-col gap-3 p-5">
                <div id="song-edit-fields-song-group" class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide ml-0.5" data-i18n="playlistView.songEdit.fieldTitle">${t('playlistView.songEdit.fieldTitle')}</label>
                        <div class="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                            <input type="text" id="song-edit-title" class="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide ml-0.5" data-i18n="playlistView.songEdit.fieldArtist">${t('playlistView.songEdit.fieldArtist')}</label>
                        <div class="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <input type="text" id="song-edit-artist" class="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors">
                        </div>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide ml-0.5" data-i18n="playlistView.songEdit.fieldAlbum">${t('playlistView.songEdit.fieldAlbum')}</label>
                        <div class="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM3 9a9 9 0 0118 0" /></svg>
                            <input type="text" id="song-edit-album" class="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors">
                        </div>
                    </div>
                </div>
                <!-- MỚI (ver12 "Song/Video Unification", phản hồi Giang 28/07/2026) — nhóm Video:
                     CHỈ 1 ô "Tên hiển thị" (customName) — KHÔNG có title/artist/album (Video không
                     có 3 tag ID3 để sửa). -->
                <div id="song-edit-fields-video-group" class="hidden flex-col gap-1.5">
                    <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide ml-0.5" data-i18n="playlistView.songEdit.fieldCustomName">${t('playlistView.songEdit.fieldCustomName')}</label>
                    <div class="relative">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                        <input type="text" id="song-edit-custom-name" class="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-sky-500 focus:bg-black/60 transition-colors">
                    </div>
                </div>
            </div>

            <!-- Tab 3: Ảnh bìa — không đổi. -->
            <div id="song-edit-tab-cover" class="hidden flex-col gap-4 p-5">
                <div class="flex items-center gap-4">
                    <div class="w-24 h-24 rounded-2xl overflow-hidden border border-white/15 shrink-0 bg-black/40 shadow-lg ring-1 ring-white/5">
                        <img id="song-edit-cover-preview" src="" class="w-full h-full object-cover" data-i18n-title="playlistView.songEdit.coverAlt" alt="${t('playlistView.songEdit.coverAlt')}">
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <button id="song-edit-cover-pick-library" class="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-colors shadow">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span data-i18n="playlistView.songEdit.coverPickLibrary">${t('playlistView.songEdit.coverPickLibrary')}</span>
                        </button>
                        <button id="song-edit-cover-remove" class="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-bold transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            <span data-i18n="playlistView.songEdit.coverRemove">${t('playlistView.songEdit.coverRemove')}</span>
                        </button>
                    </div>
                </div>
                <div class="flex items-start gap-2 bg-black/30 border border-white/5 rounded-lg p-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p class="text-[11px] text-slate-400 leading-relaxed" data-i18n="playlistView.songEdit.coverHint">${t('playlistView.songEdit.coverHint')}</p>
                </div>
            </div>

            <div class="flex gap-3 p-5 pt-2 border-t border-white/10">
                <button id="song-edit-cancel" class="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors" data-i18n="playlistView.songEdit.btnCancel">${t('playlistView.songEdit.btnCancel')}</button>
                <button id="song-edit-save" class="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shadow" data-i18n="playlistView.songEdit.btnSave">${t('playlistView.songEdit.btnSave')}</button>
            </div>
        </div>
    </div>


    <!-- Menu nhỏ cho nút "Thêm nhạc" (góc phải Playlist) — 2 lựa chọn: chọn từng file rời, hoặc
         chọn cả 1 thư mục (toàn bộ nhạc trong thư mục đó + thư mục con được nạp 1 lượt). Cùng
         cơ chế định vị "fixed, JS đặt lại vị trí ngay dưới nút bấm" như #song-action-menu — dùng
         CHUNG #song-action-overlay để đóng khi bấm ra ngoài (chỉ 1 trong 2 menu hiện tại 1 lúc).
         FIX (ver 8 refine): 2 mục giờ là <label> BỌC TRỰC TIẾP <input type="file"> ẩn bên trong —
         giống đúng pattern đã dùng ổn định ở setting-bg-upload/setting-video-upload — THAY CHO
         <button> gọi fileInput.click()/folderInput.click() bằng JS. Một số trình duyệt/WebView
         (đặc biệt chạy qua file://, hoặc Android WebView cũ) CHẶN HOÀN TOÀN việc input[type=file]
         phản hồi với .click() gọi gián tiếp qua JS (không lỗi, không event, im lặng "treo" mãi chờ
         change không bao giờ tới) — chỉ click NATIVE thật (chuột/chạm) lên label/input mới chắc
         chắn hoạt động trên mọi nền tảng. -->
    <div id="upload-action-menu" class="hidden fixed z-[115] w-52 bg-[#171c2b] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <label class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span data-i18n="playlistView.uploadMenu.pickFiles">${t('playlistView.uploadMenu.pickFiles')}</span>
            <input type="file" id="audio-upload" accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac" multiple class="hidden">
        </label>
        <label class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span data-i18n="playlistView.uploadMenu.pickFolder">${t('playlistView.uploadMenu.pickFolder')}</span>
            <input type="file" id="audio-upload-folder" webkitdirectory directory multiple class="hidden">
        </label>
    </div>

    <!-- #video-upload-menu (dropdown 1 lựa chọn "Thêm video", ver12 Batch 6 mục 7) ĐÃ XOÁ (FIX
         28/07/2026, phản hồi Giang "Video chỉ 1 chế độ chọn nhiều file, bỏ dropdown, input luôn") —
         #video-upload-input dời thẳng vào <label id="btn-upload-video"> ở header phía trên (đổi chỗ
         ẩn/hiện với #btn-upload-audio theo activeMediaSource), KHÔNG còn dropdown trung gian nào. -->

    <!-- Menu 3 chấm dùng chung cho mọi bài hát (info / sửa / xuất file / xóa) — chỉ 1 phần tử duy
         nhất trong DOM, được JS định vị lại (position: fixed) ngay dưới nút "..." vừa bấm mỗi lần
         mở, thay vì nhân bản dropdown riêng cho từng item trong danh sách (đỡ tốn DOM + dễ quản lý
         khi danh sách dài). Đóng khi bấm ra ngoài hoặc chọn 1 hành động. -->
    <div id="song-action-overlay" class="hidden fixed inset-0 z-[110]"></div>
    <div id="song-action-menu" class="hidden fixed z-[115] w-48 bg-[#171c2b] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
        <!-- SỬA (11/07/2026, yêu cầu Giang): đổi tên "Edit info" -> "Details" (menu này giờ mở
             thẳng modal Chi tiết, mặc định tab đọc-thôi trước — xem song-edit-modal) — đổi luôn
             icon bút sửa -> icon info-circle cho khớp ý nghĩa mới, ĐỒNG BỘ với icon header modal +
             icon tab "Chi tiết" bên trong (cùng path). -->
        <button data-menu-action="edit" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span data-i18n="playlistView.songMenu.edit">${t('playlistView.songMenu.edit')}</span>
        </button>
        <!-- MỚI (10/07/2026) — mở Subtitle Editor (trang riêng, subtitle-editor.html?song=<mã hoá>)
             — message RIÊNG (data-menu-action="editSubtitles"), CÙNG PRECEDENT với addToFolder bên
             dưới, xem event/listener/playlist.js + event/workflow/playlist.js::
             openSubtitleEditorForSongMenu(). SỬA (ver12 "Song/Video Unification", Batch 6, mục 6d,
             phản hồi Giang) — thêm id "song-menu-btn-edit-subtitles" để JS ẩn khi item là Video
             ("openSongActionMenu()", core/playlist/actions.js — phụ đề không áp dụng cho Video). -->
        <button id="song-menu-btn-edit-subtitles" data-menu-action="editSubtitles" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
            <span data-i18n="playlistView.songMenu.editSubtitles">${t('playlistView.songMenu.editSubtitles')}</span>
        </button>
        <!-- SỬA (Batch 6, mục 6d, phản hồi Giang) — id "song-menu-btn-restore" để JS ẩn khi Video
             (xuất file kèm tag ID3 — không áp dụng, Video không có 3 tag). -->
        <button id="song-menu-btn-restore" data-menu-action="restore" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-4V4m0 0L8 8m4-4l4 4" /></svg>
            <span data-i18n="playlistView.songMenu.export">${t('playlistView.songMenu.export')}</span>
        </button>
        <!-- XOÁ (phản hồi Giang — "bỏ luôn set background cho dropdown của video đi") —
             "song-menu-btn-set-bg-video"/data-menu-action="setAsBgVideo" đã bỏ hẳn khỏi dropdown.
             TỰ AUDIT LẠI lúc xoá: workflowFileManagerVideo.setVideoAsBackground() (core nghiệp vụ)
             tưởng còn picker "Use background video" dùng — THỰC RA KHÔNG, picker đó tự inline logic
             riêng — đã XOÁ THẲNG hàm này (0 lời gọi) cùng 2 lang key liên quan. -->
        <!-- MỚI (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — "Sửa video"
             (mở Video Editor) — THAY 1 trong 2 lựa chọn từng có ở dropdown tile "File Manager →
             Video" (đã xoá hẳn cùng lúc xoá panel đó). ẨN MẶC ĐỊNH (class "hidden"), JS
             ("openSongActionMenu()") chỉ HIỆN khi item đang mở menu là Video — tái dùng nguyên
             navigateToVideoEdit(), KHÔNG viết lại, chỉ đổi nơi gọi. -->
        <button id="song-menu-btn-edit-video" data-menu-action="editVideoFile" class="hidden flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3" /></svg>
            <span data-i18n="playlistView.songMenu.editVideoFile">${t('playlistView.songMenu.editVideoFile')}</span>
        </button>
        <!-- MỚI (mục 1d, CHỐT 03/07/2026) — dùng data-menu-action="addToFolder" RIÊNG, KHÔNG đi
             qua handleSongActionMenuSelect() (đã có sẵn 4 nhánh if/else — thêm nhánh thứ 5 vào đó
             sẽ buộc phải đưa NGUYÊN hàm cũ về đủ 4 rule, tốn công hơn hẳn tính năng này). Xử lý ở
             1 nhánh message RIÊNG (event/router/playlist.js: 'playlist.actionMenu.addToFolder'),
             không đụng hàm cũ. -->
        <button data-menu-action="addToFolder" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-white/10 transition-colors text-slate-200 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span data-i18n="playlistView.songMenu.addToFolder">${t('playlistView.songMenu.addToFolder')}</span>
        </button>
        <!-- SỬA (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — id "song-menu-delete-
             label" để JS ("openSongActionMenu()") đổi chữ "Xoá bài hát"/"Xoá video" đúng ngữ cảnh
             item đang mở menu — nhãn tĩnh cũ luôn nói "song" kể cả khi đang xoá Video. -->
        <button data-menu-action="delete" class="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-rose-500/10 transition-colors text-rose-400 border-t border-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span id="song-menu-delete-label" data-i18n="playlistView.songMenu.delete">${t('playlistView.songMenu.delete')}</span>
        </button>
    </div>

    <!-- Modal: Bài hát lỗi lúc phát (audioPlayer báo 'error' thật khi decode) — hỏi Giữ lại (chuyển
         vào danh sách chờ ở Quản lý dung lượng, không hiện trong playlist nữa) hay Xóa luôn khỏi
         IndexedDB ngay. -->
    <div id="playback-error-modal" class="fixed inset-0 z-[125] bg-black/70 backdrop-blur-sm hidden flex items-center justify-center px-5">
        <div class="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4">
            <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <h3 class="text-base font-bold text-amber-400" data-i18n="playlistView.playbackError.title">${t('playlistView.playbackError.title')}</h3>
            </div>
            <p id="playback-error-filename" class="text-sm text-slate-300 break-all"></p>
            <p class="text-xs text-slate-500" data-i18n="playlistView.playbackError.body">${t('playlistView.playbackError.body')}</p>
            <div class="flex gap-3 mt-1">
                <button id="playback-error-keep" class="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors" data-i18n="playlistView.playbackError.btnKeep">${t('playlistView.playbackError.btnKeep')}</button>
                <button id="playback-error-delete" class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors" data-i18n="playlistView.playbackError.btnDelete">${t('playlistView.playbackError.btnDelete')}</button>
            </div>
        </div>
    </div>
`;
