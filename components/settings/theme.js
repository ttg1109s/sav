/**
 * Component (sub-template): Settings Drawer — Section "Theme".
 *
 * MỞ ĐẦU THEME THẬT (07/07/2026, phản hồi Giang) — THAY HẲN section "Background"
 * (components/settings/playlist-background.js CŨ, nay KHÔNG còn dùng — xem báo cáo cuối batch để
 * biết lý do không xoá file, chỉ ngừng mount). 3 chế độ LOẠI TRỪ NHAU (radio, không phải 3 toggle
 * độc lập) — UI dạng card (mini mockup + nhãn + nút radio tròn CANH GIỮA bên dưới, cùng tinh thần
 * "Sáng"/"Tối" ở Cài đặt iOS thật):
 *   a. Sáng (light) — CHƯA áp dụng lại màu app thật (chỉ lưu lựa chọn — xem docstring
 *      DEFAULT_VIZ_CONFIG.themeMode ở core/config.js để biết lý do/kế hoạch).
 *   b. Tối (dark) — mặc định, đúng giao diện hiện tại của app.
 *   c. Background (dùng ảnh nền tuỳ chỉnh) — mini mockup là dấu "+", TÁI DÙNG NGUYÊN hệ thống
 *      bgImage/bgBlur/bgImageEnabled đã có sẵn (không phải xây lại từ đầu). Card này chọn ->
 *      chưa có ảnh thì tự mở picker (như toggle "App background image" cũ); ĐANG chọn card này ->
 *      hiện thêm 1 hàng slider "Độ mờ nền" (`#theme-bg-blur-row`, ẩn/hiện qua workflow, xem
 *      event/workflow/theme.js::refreshThemeCardUI()).
 *
 * ĐỔI INDICATOR CHỌN (09/07/2026, phản hồi Giang mục 4 — "Xoá border select theme, bổ sung thêm
 * background gradient") — trước đây card ĐANG chọn được đánh dấu bằng `ring-2 ring-sky-400` (viền
 * xanh quanh nút). Bỏ hẳn viền này, thay bằng NỀN GRADIENT phủ lên card đang chọn (toggle qua
 * `event/workflow/theme.js::refreshThemeCardUI()`) — nút `.theme-mode-card` giờ có sẵn
 * `rounded-2xl p-2` TĨNH (không đổi khi chọn/bỏ chọn, chỉ để có khung bo góc cho gradient phủ vào,
 * tránh gradient tràn vuông góc nhìn gượng). Radio tròn dưới cùng GIỮ NGUYÊN, vẫn là indicator phụ.
 *
 * Đặt NGAY SAU "Playlist" (vị trí cũ của "Background") — vẫn là thứ hay NHÌN THẤY, xem
 * components/settings-drawer.js.
 */
const TPL_SETTINGS_THEME = `

        <!-- SECTION: THEME -->
        <div>
            <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsTheme.sectionTitle">${t('settingsTheme.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl p-4">
                <div class="grid grid-cols-3 gap-3">
                    <button id="theme-mode-card-light" data-theme-mode="light" class="theme-mode-card flex flex-col items-center gap-2 rounded-2xl p-2 transition-colors">
                        <div class="w-full aspect-[3/5] rounded-xl overflow-hidden border-2 border-white/15 bg-gradient-to-b from-slate-100 to-slate-300 flex items-center justify-center p-2">
                            <div class="w-full space-y-1.5">
                                <div class="h-2 bg-slate-500/40 rounded-full"></div>
                                <div class="h-2 bg-slate-500/40 rounded-full w-2/3"></div>
                                <div class="h-2 bg-slate-500/40 rounded-full w-1/2"></div>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-slate-200 truncate" data-i18n="settingsTheme.light">${t('settingsTheme.light')}</span>
                        <span class="theme-mode-radio w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0"></span>
                    </button>
                    <button id="theme-mode-card-dark" data-theme-mode="dark" class="theme-mode-card flex flex-col items-center gap-2 rounded-2xl p-2 transition-colors">
                        <div class="w-full aspect-[3/5] rounded-xl overflow-hidden border-2 border-white/15 bg-gradient-to-b from-slate-800 to-black flex items-center justify-center p-2">
                            <div class="w-full space-y-1.5">
                                <div class="h-2 bg-white/20 rounded-full"></div>
                                <div class="h-2 bg-white/20 rounded-full w-2/3"></div>
                                <div class="h-2 bg-white/20 rounded-full w-1/2"></div>
                            </div>
                        </div>
                        <span class="text-xs font-medium text-slate-200 truncate" data-i18n="settingsTheme.dark">${t('settingsTheme.dark')}</span>
                        <span class="theme-mode-radio w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0"></span>
                    </button>
                    <button id="theme-mode-card-background" data-theme-mode="background" class="theme-mode-card flex flex-col items-center gap-2 rounded-2xl p-2 transition-colors">
                        <div class="w-full aspect-[3/5] rounded-xl overflow-hidden border-2 border-dashed border-white/25 bg-black/30 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                        </div>
                        <span class="text-xs font-medium text-slate-200 truncate" data-i18n="settingsTheme.background">${t('settingsTheme.background')}</span>
                        <span class="theme-mode-radio w-5 h-5 rounded-full border-2 border-white/30 flex items-center justify-center shrink-0"></span>
                    </button>
                </div>

                <!-- Hàng "Độ mờ nền" — CHỈ hiện khi đang chọn card "background" (toggle 'hidden' ở
                     event/workflow/theme.js::refreshThemeCardUI()). -->
                <div id="theme-bg-blur-row" class="hidden flex-col mt-4 pt-4 border-t border-white/10">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-medium truncate" data-i18n="settingsPlaylistBg.bgBlur.label">${t('settingsPlaylistBg.bgBlur.label')}</span>
                        <span id="val-bg-blur" class="text-xs text-sky-400 font-mono">0px</span>
                    </div>
                    <input type="range" id="setting-bg-blur" min="0" max="20" step="1" class="setting-slider">
                </div>
            </div>
        </div>
`;
