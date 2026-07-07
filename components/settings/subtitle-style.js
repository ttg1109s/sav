/**
 * Component (sub-template): Settings Drawer — Section "Phụ đề" (rút gọn).
 *
 * Ver 8 refine (mục 3): toàn bộ slider style khung/chữ phụ đề (màu/độ trong suốt nền, màu/độ
 * trong suốt/độ dày/độ uốn viền, màu chữ, cỡ chữ, line-height, letter-spacing) ĐÃ CHUYỂN sang
 * `components/subtitle-settings-drawer.js` — Batch D2 (06/07/2026) đổi tiếp file đó từ template
 * tĩnh (`TPL_SUBTITLE_SETTINGS_DRAWER`) sang hàm `renderSubtitlePanelBody()`, PUSH ĐỘNG vào Settings
 * Stack (core/settings-panel-stack.js) thay vì mount 1 lần lúc boot. File NÀY (Main list) giờ CHỈ
 * còn:
 *   - toggle "Hiện phụ đề" (#setting-subtitles-enabled, chuyển từ modal sub về Settings ở 1 lượt
 *     refine trước) — vẫn ngay trong giao diện, không cần mở drawer.
 *   - nút "Tùy chỉnh" mở drawer chứa toàn bộ slider style chi tiết.
 */
const TPL_SETTINGS_SUBTITLE_STYLE = `

        <!-- SECTION: PHỤ ĐỀ (rút gọn, ver 8 refine) -->
        <div>
            <h3 class="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsSubtitleStyle.sectionTitle">${t('settingsSubtitleStyle.sectionTitle')}</h3>
            <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-white/5">
                    <div class="pr-3">
                        <div class="text-sm font-medium" data-i18n="settingsSubtitleStyle.enable.label">${t('settingsSubtitleStyle.enable.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsSubtitleStyle.enable.hint">${t('settingsSubtitleStyle.enable.hint')}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-subtitles-enabled" class="sr-only peer" checked>
                        <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                    </label>
                </div>
                <button id="setting-open-subtitle-settings" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div>
                        <div class="text-sm font-medium" data-i18n="settingsSubtitleStyle.openDrawer.label">${t('settingsSubtitleStyle.openDrawer.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsSubtitleStyle.openDrawer.hint">${t('settingsSubtitleStyle.openDrawer.hint')}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
`;
