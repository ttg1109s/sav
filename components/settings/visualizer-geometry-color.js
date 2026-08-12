/**
 * Component (sub-template): Settings Drawer — Section "Visualizer Screen" (Main).
 *
 * SỬA (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main, mục 4a-h) — VIẾT LẠI TOÀN BỘ card này:
 *   a. Bỏ hẳn hàng "Effect type" (select #setting-visualizer-type) — đổi hiệu ứng giờ CHỈ qua
 *      #btn-cycle-mode/Action (Control Center), không cần chọn trực tiếp ở Settings nữa.
 *   b+d. "Chất lượng render" (#setting-quality) + "Làm mờ" (#setting-blur-enable) DỜI VÀO ĐÂY từ
 *      card "Custom Effect" cũ (trước đây "Visualizer Geometry", components/
 *      visualizer-settings-drawer.js) — Chất lượng đứng ĐẦU card (thế chỗ Effect type), Làm mờ
 *      đứng NGAY SAU "Hiện Visual".
 *   c+f. 2 nút điều hướng MỚI, panel RIÊNG: "Custom Effect" (components/settings/
 *      visualizer-custom-effect-drawer.js, đổi tên từ "Visualizer Geometry") + "Auto-Switch
 *      Effect" (components/settings/visualizer-auto-switch-drawer.js) — cả 2 ngang hàng
 *      "Customize Visualizer" (panel đó giờ CHỈ còn Colors/Display/Cử chỉ, xem components/
 *      visualizer-settings-drawer.js).
 *   e. Tiêu đề section đổi "Visualizer" -> "Visualizer Screen" (settingsVisualizer.sectionTitle).
 *   h. "Cử chỉ" (#setting-open-gesture-settings) DỜI RA khỏi card này, vào trong panel "Customize
 *      Visualizer" — id/panel con GIỮ NGUYÊN 100%, chỉ đổi panel CHA chứa nút bấm.
 *
 * Thứ tự card giờ: Chất lượng render -> Hiện Visual -> Làm mờ -> Custom Effect (nav) -> Customize
 * Visualizer (nav) -> Auto-Switch Effect (nav) -> Visual Background (nav).
 */
const TPL_SETTINGS_VISUALIZER = `

        <!-- SECTION: VISUALIZER SCREEN — TÁI CẤU TRÚC (12/08/2026, Giang yêu cầu, mục 4a-h):
             a. Bỏ hẳn hàng "Effect type" (select #setting-visualizer-type) — đổi hiệu ứng giờ qua
                #btn-cycle-mode/Action ở Control Center, không cần chọn trực tiếp ở đây nữa.
             b. Hàng "Làm mờ" (#setting-blur-enable) DỜI VÀO ĐÂY, đứng NGAY SAU "Hiện Visual" — dời
                từ card "Custom Effect" cũ (trước đây "Visualizer Geometry").
             c. Nút "Custom Effect" (đổi tên từ "Visualizer Geometry") — panel RIÊNG MỚI
                (components/settings/visualizer-custom-effect-drawer.js), đứng TRƯỚC "Customize
                Visualizer".
             d. Hàng "Chất lượng render" (#setting-quality) DỜI VÀO ĐÂY, đứng ĐẦU card (thế chỗ
                Effect type vừa bỏ) — dời từ card "Custom Effect" cũ.
             f. Nút "Auto-Switch Effect" — panel RIÊNG MỚI (components/settings/
                visualizer-auto-switch-drawer.js), ngang hàng "Customize Visualizer".
             (Cử chỉ ĐÃ DỜI RA khỏi card này, vào trong panel "Customize Visualizer" — mục 4h, xem
             components/visualizer-settings-drawer.js.) -->
        <div>
            <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsVisualizer.sectionTitle">${t('settingsVisualizer.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.quality.label">${t('visualizerSettingsDrawer.quality.label')}</span>
                    <select id="setting-quality" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                        <option value="high" data-i18n="visualizerSettingsDrawer.quality.high">${t('visualizerSettingsDrawer.quality.high')}</option>
                        <option value="medium" data-i18n="visualizerSettingsDrawer.quality.medium">${t('visualizerSettingsDrawer.quality.medium')}</option>
                        <option value="low" data-i18n="visualizerSettingsDrawer.quality.low">${t('visualizerSettingsDrawer.quality.low')}</option>
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.visualEnable.label">${t('settingsVisualizer.visualEnable.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsVisualizer.visualEnable.hint">${t('settingsVisualizer.visualEnable.hint')}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-visual-enable" class="sr-only peer" checked>
                        <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                    </label>
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div class="pr-3">
                        <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.blurEnable.label">${t('visualizerSettingsDrawer.blurEnable.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.blurEnable.hint">${t('visualizerSettingsDrawer.blurEnable.hint')}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-blur-enable" class="sr-only peer">
                        <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                    </label>
                </div>
                <button id="setting-open-visualizer-custom-effect" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.openCustomEffect.label">${t('settingsVisualizer.openCustomEffect.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.openCustomEffect.hint">${t('settingsVisualizer.openCustomEffect.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button id="setting-open-visualizer-settings" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7M14 18l2 2 4-4" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.openDrawer.label">${t('settingsVisualizer.openDrawer.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.openDrawer.hint">${t('settingsVisualizer.openDrawer.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button id="setting-open-visualizer-auto-switch" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-fuchsia-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.openAutoSwitch.label">${t('settingsVisualizer.openAutoSwitch.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.openAutoSwitch.hint">${t('settingsVisualizer.openAutoSwitch.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <!-- MỚI (v13 Batch A, plan-v13-visual-background-unification.md mục 2) — 1 nút
                     điều hướng DUY NHẤT "Visual Background", THAY HẲN 3 entry rời rạc trước đây
                     (toggle "Video nền" #setting-video-enable, toggle "Ảnh nền Visual"
                     #setting-visual-bg-image-enable, nút "Slideshow" #setting-open-slideshow-settings).
                     Panel con: components/visual-bg-settings-drawer.js (push/pop qua Settings
                     Stack); logic: event/workflow/visual-bg.js. Panel Slideshow cũ VẪN CÒN, nhưng
                     lối vào giờ nằm BÊN TRONG panel Visual Background (chỉ hiện khi chọn Danh
                     sách + Ảnh + Trình chiếu), không còn đứng ngang hàng ở đây nữa. -->
                <button id="setting-open-visual-bg-settings" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.visualBg.label">${t('settingsVisualizer.visualBg.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.visualBg.hint">${t('settingsVisualizer.visualBg.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
`;
