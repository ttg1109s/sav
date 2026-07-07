/**
 * Component (sub-template): Settings Drawer — Section "Background" (Nền).
 *
 * TÁCH (07/07/2026, phản hồi Giang mục 4 — "Tổ chức lại section PLAYLIST & BACKGROUND"): section
 * cũ "Hệ thống & Playlist" gộp lẫn 2 chủ đề không liên quan — phần "Kiểu xem"/"Sắp xếp" đã DỜI
 * sang components/settings/playlist-view.js (TPL_SETTINGS_PLAYLIST_VIEW). File NÀY giờ CHỈ còn 4
 * mục cùng 1 chủ đề "Nền": Video nền, Ảnh nền Visual, Ảnh nền Playlist, Độ mờ — biến xuất ra ĐỔI
 * TÊN thành `TPL_SETTINGS_BACKGROUND` (KHÁC `TPL_SETTINGS_PLAYLIST_BG` cũ — xem components/
 * settings-drawer.js đã cập nhật theo).
 *
 * Đặt NGAY SAU section "Playlist" (xem components/settings-drawer.js) — Nền là thứ hay NHÌN THẤY
 * (theo nguyên tắc "mục hay dùng/hay thấy lên đầu" — xem báo cáo tái tổ chức 07/07/2026).
 */
const TPL_SETTINGS_BACKGROUND = `

        <!-- SECTION: BACKGROUND -->
        <div>
            <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsBackground.sectionTitle">${t('settingsBackground.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <!-- FIX (04/07/2026, mục 1 phản hồi Giang) — bỏ hẳn nút "Choose" riêng: gạt toggle
                     lên "On" giờ TỰ mở hộp thoại chọn file video LUÔN (input ẩn, kích hoạt qua JS —
                     xem event/workflow/visualizer-control-center.js::enableVideoBackgroundToggle).
                     Huỷ hộp thoại không chọn gì -> tự trả toggle về "off" (sự kiện 'cancel', xem
                     event/listener/visualizer-control-center.js). Tắt toggle chỉ ẩn hiển thị,
                     KHÔNG xoá video đã lưu (đảo ngược quyết định cũ) — gạt lại "On" mở lại hộp
                     thoại chọn file MỚI. -->
                <div class="flex flex-col border-b border-sky-500/30 bg-sky-900/20">
                    <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                        <span class="text-sm font-medium text-sky-300 truncate" data-i18n="settingsPlaylistBg.videoEnable.label">${t('settingsPlaylistBg.videoEnable.label')}</span>
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
                     readme/song-cover-background-relations.md). -->
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
