/**
 * Component (sub-template): Settings Drawer — Section "Playlist".
 *
 * TÁCH (07/07/2026, phản hồi Giang mục 4 — "Tổ chức lại section PLAYLIST & BACKGROUND"): section
 * cũ "Hệ thống & Playlist" (components/settings/playlist-background.js) gộp lẫn 2 chủ đề KHÔNG
 * liên quan — "Kiểu xem"/"Sắp xếp" (cách hiển thị DANH SÁCH) và "Video/Ảnh nền" (chủ đề NỀN). Tách
 * làm 2 file riêng cho đúng tinh thần "1 section = 1 chủ đề": file NÀY chỉ còn 2 dòng
 * view/sort mode — phần Nền dời sang components/settings/playlist-background.js (ĐỔI biến xuất ra
 * thành `TPL_SETTINGS_BACKGROUND`, xem file đó).
 *
 * Đặt Ở ĐẦU danh sách section (xem components/settings-drawer.js) — "Kiểu xem"/"Sắp xếp" là thao
 * tác dùng THƯỜNG XUYÊN NHẤT khi duyệt thư viện nhạc hàng ngày (theo nguyên tắc "mục dùng thường
 * xuyên lên đầu" — xem báo cáo tái tổ chức 07/07/2026).
 */
const TPL_SETTINGS_PLAYLIST_VIEW = `

        <!-- SECTION: PLAYLIST -->
        <div>
            <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsPlaylistBg.sectionTitle">${t('settingsPlaylistBg.sectionTitle')}</h3>
            <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.viewMode.label">${t('settingsPlaylistBg.viewMode.label')}</span>
                    <select id="setting-playlist-view-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="list" data-i18n="settingsPlaylistBg.viewMode.list">${t('settingsPlaylistBg.viewMode.list')}</option>
                        <option value="grid" data-i18n="settingsPlaylistBg.viewMode.grid">${t('settingsPlaylistBg.viewMode.grid')}</option>
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.sortMode.label">${t('settingsPlaylistBg.sortMode.label')}</span>
                    <select id="setting-playlist-sort-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="default" data-i18n="settingsPlaylistBg.sortMode.default">${t('settingsPlaylistBg.sortMode.default')}</option>
                        <option value="az" data-i18n="settingsPlaylistBg.sortMode.az">${t('settingsPlaylistBg.sortMode.az')}</option>
                        <option value="za" data-i18n="settingsPlaylistBg.sortMode.za">${t('settingsPlaylistBg.sortMode.za')}</option>
                    </select>
                </div>
            </div>
        </div>
`;
