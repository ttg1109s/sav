/**
 * Component (sub-template): Settings Drawer — Section "Danh sách phát & Nền".
 * Tách từ js/components/settings-drawer.js (ver 8) — xem object điều phối SettingsDrawer
 * trong settings-drawer.js để biết thứ tự ghép các section này lại thành TPL_SETTINGS_DRAWER.
 * Toggle Video Background, ảnh nền Playlist + độ mờ nhòe (blur).
 *
 * Ver 10 refine: 2 dòng "Kiểu xem" (Grid/List) + "Sắp xếp" (Mặc định/A→Z/Z→A) CHUYỂN VÀO ĐÂY,
 * thay cho 2 icon riêng ở header Playlist (#btn-toggle-view, #btn-sort-display + dropdown nổi) —
 * dọn header gọn lại, JS điều khiển ở js/playlist/main.js (PlaylistMain.initSortMenu/initViewMode).
 *
 * Ver 8 refine: toggle "Tắt Visual" ĐÃ CHUYỂN sang section "Visualizer" chính (xem
 * js/components/settings/visualizer-geometry-color.js) — không còn section "Hiệu ứng Visualizer"
 * riêng ở đây nữa (ver 10 refine), để mọi setting liên quan tới hiển thị hiệu ứng nằm 1 nơi.
 */
const TPL_SETTINGS_PLAYLIST_BG = `

        <!-- SECTION: HỆ THỐNG & PLAYLIST -->
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
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.sortMode.label">${t('settingsPlaylistBg.sortMode.label')}</span>
                    <select id="setting-playlist-sort-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="default" data-i18n="settingsPlaylistBg.sortMode.default">${t('settingsPlaylistBg.sortMode.default')}</option>
                        <option value="az" data-i18n="settingsPlaylistBg.sortMode.az">${t('settingsPlaylistBg.sortMode.az')}</option>
                        <option value="za" data-i18n="settingsPlaylistBg.sortMode.za">${t('settingsPlaylistBg.sortMode.za')}</option>
                    </select>
                </div>
                <!-- FIX (04/07/2026, mục 1 phản hồi Giang) — bỏ hẳn nút "Choose" riêng: gạt toggle
                     lên "On" giờ TỰ mở hộp thoại chọn file video LUÔN (input ẩn, kích hoạt qua JS —
                     xem event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle).
                     Huỷ hộp thoại không chọn gì -> tự trả toggle về "off" (sự kiện 'cancel', xem
                     event/listener/visualizer-control-center.js). Tắt toggle chỉ ẩn hiển thị,
                     KHÔNG xoá video đã lưu (đảo ngược quyết định cũ) — gạt lại "On" mở lại hộp
                     thoại chọn file MỚI (không có khái niệm "khôi phục y nguyên không cần chọn
                     lại" — mỗi lần "On" là 1 lượt chọn mới, xem plan-v12-multimedia-update-5.md
                     mục 1 để biết lý do). -->
                <div class="flex flex-col border-b border-sky-500/30 bg-sky-900/20">
                    <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                        <span class="text-sm font-medium text-sky-300" data-i18n="settingsPlaylistBg.videoEnable.label">${t('settingsPlaylistBg.videoEnable.label')}</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="setting-video-enable" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                    <div class="px-4 pb-4 -mt-2">
                        <div class="text-xs text-slate-400" data-i18n="settingsPlaylistBg.videoEnable.hint">${t('settingsPlaylistBg.videoEnable.hint')}</div>
                    </div>
                    <input type="file" id="setting-video-upload" accept=".mp4,.webm,.ogv,.mov,video/mp4,video/webm,video/ogg,video/quicktime" class="hidden">
                </div>

                <!-- MỚI (03/07/2026, mục 2) — Ảnh nền tĩnh cho màn Visualizer (KHÁC HẲN ảnh nền
                     Playlist ở khối dưới đây — 2 field/2 cơ chế riêng biệt, xem
                     readme/song-cover-background-relations.md). FIX (04/07/2026, mục 1) — cùng cơ
                     chế Video ở trên: bỏ nút "Chọn ảnh" riêng, chỉ còn toggle tự mở picker. -->
                <div class="flex flex-col border-b border-white/5">
                    <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                        <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.visualBgImage.label">${t('settingsPlaylistBg.visualBgImage.label')}</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="setting-visual-bg-image-enable" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                    <div class="px-4 pb-4 -mt-2">
                        <div class="text-xs text-slate-400" data-i18n="settingsPlaylistBg.visualBgImage.hint">${t('settingsPlaylistBg.visualBgImage.hint')}</div>
                    </div>
                </div>

                <!-- FIX (04/07/2026, mục 1) — GỘP 2 hàng cũ (nút "Chọn thư viện" riêng + toggle
                     bật/tắt riêng) thành 1 hàng DUY NHẤT, cùng khuôn 2 khối trên — bỏ hẳn nút
                     #setting-bg-pick-library. -->
                <div class="flex flex-col border-b border-white/5">
                    <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                        <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.bgImageEnable.label">${t('settingsPlaylistBg.bgImageEnable.label')}</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="setting-bg-image-enable" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                </div>
                <div class="flex flex-col p-4 hover:bg-white/5 transition-colors">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.bgBlur.label">${t('settingsPlaylistBg.bgBlur.label')}</span>
                        <span id="val-bg-blur" class="text-xs text-sky-400 font-mono">0px</span>
                    </div>
                    <input type="range" id="setting-bg-blur" min="0" max="20" step="1" class="setting-slider">
                </div>
            </div>
        </div>
`;

