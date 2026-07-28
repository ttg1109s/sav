/**
 * Component (sub-template): Settings Drawer — Section "Playlist".
 *
 * TÁCH (07/07/2026, phản hồi Giang mục 4 — "Tổ chức lại section PLAYLIST & BACKGROUND"): section
 * cũ "Hệ thống & Playlist" (components/settings/playlist-background.js) gộp lẫn 2 chủ đề KHÔNG
 * liên quan — "Kiểu xem"/"Sắp xếp" (cách hiển thị DANH SÁCH) và "Video/Ảnh nền" (chủ đề NỀN). Tách
 * làm 2 file riêng cho đúng tinh thần "1 section = 1 chủ đề": file NÀY chỉ còn 2 dòng
 * view/sort mode — phần "Video nền"/"Ảnh nền Visual" đã dời tiếp sang components/settings/
 * visualizer-geometry-color.js (mục 3, 07/07/2026); "Ảnh nền App"/"Độ mờ" đã gộp vào section
 * "Theme" (components/settings/theme.js, mục 3, MỞ ĐẦU THEME THẬT) — components/settings/
 * playlist-background.js (TPL_SETTINGS_BACKGROUND) KHÔNG còn mount, để lại làm tư liệu.
 *
 * Đặt Ở ĐẦU danh sách section (xem components/settings-drawer.js) — "Kiểu xem"/"Sắp xếp" là thao
 * tác dùng THƯỜNG XUYÊN NHẤT khi duyệt thư viện nhạc hàng ngày (theo nguyên tắc "mục dùng thường
 * xuyên lên đầu" — xem báo cáo tái tổ chức 07/07/2026).
 */
const TPL_SETTINGS_PLAYLIST_VIEW = `

        <!-- SECTION: PLAYLIST -->
        <div>
            <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsPlaylistBg.sectionTitle">${t('settingsPlaylistBg.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <!-- MỚI (ver12 "Song/Video Unification", Batch 1, mục 1) — chọn Nguồn browse cho
                     Playlist. Đứng ĐẦU section. [SỬA — Giang chốt "dùng chung hết" sort mode]
                     Option list "Sắp xếp" ngay dưới KHÔNG còn bị dựng lại theo Nguồn nữa — tĩnh cố
                     định, dùng chung cho cả 2 nguồn (xem core/playlist/order.js::sortKeysByMode()). -->
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.mediaSource.label">${t('settingsPlaylistBg.mediaSource.label')}</span>
                    <select id="setting-playlist-media-source" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="song" data-i18n="settingsPlaylistBg.mediaSource.song">${t('settingsPlaylistBg.mediaSource.song')}</option>
                        <option value="video" data-i18n="settingsPlaylistBg.mediaSource.video">${t('settingsPlaylistBg.mediaSource.video')}</option>
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.viewMode.label">${t('settingsPlaylistBg.viewMode.label')}</span>
                    <select id="setting-playlist-view-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="list" data-i18n="settingsPlaylistBg.viewMode.list">${t('settingsPlaylistBg.viewMode.list')}</option>
                        <option value="grid" data-i18n="settingsPlaylistBg.viewMode.grid">${t('settingsPlaylistBg.viewMode.grid')}</option>
                    </select>
                </div>
                <!-- [SỬA — Giang chốt "dùng chung hết" 4 kiểu sort cho CẢ Song lẫn Video, KHÔNG
                     tách theo Nguồn nữa] Option list giờ TĨNH CỐ ĐỊNH — JS KHÔNG còn ghi đè
                     innerHTML theo activeMediaSource nữa (renderSongSortModeOptions()/
                     renderVideoSortModeOptions() đã xoá hẳn, core/playlist/order.js). Bỏ hẳn
                     'default' (giữ nguyên thứ tự thêm) — vô nghĩa khi đã có az/za/newest/oldest. -->
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.sortMode.label">${t('settingsPlaylistBg.sortMode.label')}</span>
                    <select id="setting-playlist-sort-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="az" data-i18n="settingsPlaylistBg.sortMode.az">${t('settingsPlaylistBg.sortMode.az')}</option>
                        <option value="za" data-i18n="settingsPlaylistBg.sortMode.za">${t('settingsPlaylistBg.sortMode.za')}</option>
                        <option value="newest" data-i18n="settingsPlaylistBg.sortMode.newest">${t('settingsPlaylistBg.sortMode.newest')}</option>
                        <option value="oldest" data-i18n="settingsPlaylistBg.sortMode.oldest">${t('settingsPlaylistBg.sortMode.oldest')}</option>
                    </select>
                </div>
                <!-- MỚI (phản hồi Giang, mục 5 — "thêm dòng folder đang active source") — dòng
                     ĐỌC-THÔI (không phải control), đặt CUỐI section (SAU "Sắp xếp" — 2 dòng trên là
                     control tương tác dùng thường xuyên, dòng thông tin phụ này đặt cuối theo đúng
                     nguyên tắc "mục dùng thường xuyên lên đầu" đã ghi ở docstring đầu file). JS
                     (PlaylistMain.updateActiveFolderUI(), core/playlist/main.js) tự đồng bộ chữ
                     lúc mở Settings + ngay khi Scope đổi (không cần đợi reload) — CÙNG HÀM này còn
                     khoá <select> "Nguồn" ngay phía trên khi đang có Scope (mục 2, phản hồi Giang). -->
                <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.activeFolder.label">${t('settingsPlaylistBg.activeFolder.label')}</span>
                    <span id="setting-playlist-active-folder" class="text-xs text-slate-400 truncate max-w-[128px]">${t('settingsPlaylistBg.activeFolder.none')}</span>
                </div>
            </div>
        </div>
`;
