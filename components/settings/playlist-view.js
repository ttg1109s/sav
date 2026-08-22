/**
 * Component (sub-template): Settings Drawer — Section "Playlist".
 *
 * SỬA (mục 1a/1b/1d, phản hồi Giang — "Playlist Filter/Sort subpanel") — VIẾT LẠI:
 *   - "Sắp xếp" (trước đây 1 <select> tĩnh, 4 giá trị az/za/newest/oldest) ĐỔI thành 1 nút mở
 *     SUBPANEL riêng (2 trục: tên/ngày + thống kê nghe, xem components/playlist-sort-drawer.js) —
 *     CÙNG khuôn "Tuỳ chỉnh" (nút mở panel) đã có sẵn ở nhiều section khác trong Settings.
 *   - Dòng đọc-thôi "Thư mục đang active" (`#setting-playlist-active-folder`) ĐÃ XOÁ HẲN — tên
 *     folder giờ hiện NGAY TRONG `<select>` "Nguồn" phía trên (option ĐỘNG, tự khoá luôn `<select>`
 *     đó khi có Scope — xem core/playlist/main.js::updateActiveFolderUI()).
 *   - Thêm nút mở SUBPANEL "Lọc" (MỚI, mục 1d — xem components/playlist-filter-drawer.js).
 *
 * TÁCH (07/07/2026, phản hồi Giang mục 4 — "Tổ chức lại section PLAYLIST & BACKGROUND"): section
 * cũ "Hệ thống & Playlist" (components/settings/playlist-background.js) gộp lẫn 2 chủ đề KHÔNG
 * liên quan — "Kiểu xem"/"Sắp xếp" (cách hiển thị DANH SÁCH) và "Video/Ảnh nền" (chủ đề NỀN). Tách
 * làm 2 file riêng cho đúng tinh thần "1 section = 1 chủ đề".
 *
 * Đặt Ở ĐẦU danh sách section (xem components/settings-drawer.js) — "Kiểu xem"/"Sắp xếp"/"Lọc" là
 * thao tác dùng THƯỜNG XUYÊN NHẤT khi duyệt thư viện nhạc hàng ngày.
 */
const TPL_SETTINGS_PLAYLIST_VIEW = `

        <!-- SECTION: PLAYLIST -->
        <div>
            <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsPlaylistBg.sectionTitle">${t('settingsPlaylistBg.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <!-- MỚI (ver12 "Song/Video Unification", Batch 1, mục 1) — chọn Nguồn browse cho
                     Playlist. Đứng ĐẦU section. Khi có Scope (folder) đang Apply, JS tự chèn thêm 1
                     <option> MANG TÊN folder + tự chọn + khoá <select> (mục 1a, xem
                     core/playlist/main.js::updateActiveFolderUI()) — KHÔNG còn dòng đọc-thôi riêng
                     bên dưới nữa. -->
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.mediaSource.label">${t('settingsPlaylistBg.mediaSource.label')}</span>
                    <select id="setting-playlist-media-source" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="song" data-i18n="settingsPlaylistBg.mediaSource.song">${t('settingsPlaylistBg.mediaSource.song')}</option>
                        <option value="video" data-i18n="settingsPlaylistBg.mediaSource.video">${t('settingsPlaylistBg.mediaSource.video')}</option>
                        <option value="photo" data-i18n="settingsPlaylistBg.mediaSource.photo">${t('settingsPlaylistBg.mediaSource.photo')}</option>
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.viewMode.label">${t('settingsPlaylistBg.viewMode.label')}</span>
                    <select id="setting-playlist-view-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="list" data-i18n="settingsPlaylistBg.viewMode.list">${t('settingsPlaylistBg.viewMode.list')}</option>
                        <option value="grid" data-i18n="settingsPlaylistBg.viewMode.grid">${t('settingsPlaylistBg.viewMode.grid')}</option>
                    </select>
                </div>
                <!-- MỚI (mục 1b) — "Sắp xếp" giờ mở SUBPANEL (2 trục), thay cho <select> tĩnh cũ. -->
                <button id="setting-open-playlist-sort" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9M3 12h9m-9 4h5M17 4v16m0 0l-4-4m4 4l4-4" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.sortMode.label">${t('settingsPlaylistBg.sortMode.label')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <!-- MỚI (mục 1d) — "Lọc", subpanel field theo Nguồn hiện tại. -->
                <button id="setting-open-playlist-filter" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.filter.label">${t('settingsPlaylistBg.filter.label')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
`;
