/**
 * Component: Subtitle Settings panel body ("Tùy chỉnh Phụ đề") — nội dung slider style
 * khung/chữ phụ đề (màu/độ trong suốt nền, màu/độ trong suốt/độ dày/độ uốn viền, màu chữ, cỡ chữ,
 * line-height, letter-spacing).
 *
 * === Batch D2 (Settings restructure, tiếp Batch D1) ===
 * TRƯỚC ĐÂY là biến `TPL_SUBTITLE_SETTINGS_DRAWER` (tự có khung `fixed inset-0 drawer-glass
 * z-[90]` + header riêng, mount 1 LẦN lúc boot). GIỜ chỉ còn là NỘI DUNG BODY của 1 panel — khung
 * ngoài + header (Back/title) dùng CHUNG ở `#drawer-settings` (xem components/settings-drawer.js +
 * core/settings-panel-stack.js), giống hệt About đã làm ở D1.
 *
 * MỚI so với About: các slider ở đây kèm `data-value-target="val-sub-X"` — trỏ đúng id span hiển
 * thị đi kèm (vd `setting-sub-bg-opacity` -> `val-sub-bg-opacity`) — để listener DELEGATE (xem
 * event/listener/subtitle-style-settings.js) tìm đúng span cần cập nhật MỖI LẦN kéo slider, KHÔNG
 * cần dò bằng CSS selector mong manh hay suy luận tên biến.
 */
function renderSubtitlePanelBody() {
    return `
                <!-- SECTION: PHỤ ĐỀ -->
                <div>
                    <h3 class="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 ml-2" data-i18n="subtitleSettingsDrawer.sectionTitle">${t('subtitleSettingsDrawer.sectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.bgColor.label">${t('subtitleSettingsDrawer.bgColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-sub-bg-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.bgOpacity.label">${t('subtitleSettingsDrawer.bgOpacity.label')}</span><span id="val-sub-bg-opacity" class="text-xs text-yellow-400 font-mono">40%</span></div>
                            <input type="range" id="setting-sub-bg-opacity" data-value-target="val-sub-bg-opacity" min="0" max="100" step="1" class="setting-slider">
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.borderColor.label">${t('subtitleSettingsDrawer.borderColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-sub-border-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.borderOpacity.label">${t('subtitleSettingsDrawer.borderOpacity.label')}</span><span id="val-sub-border-opacity" class="text-xs text-yellow-400 font-mono">10%</span></div>
                            <input type="range" id="setting-sub-border-opacity" data-value-target="val-sub-border-opacity" min="0" max="100" step="1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.borderWidth.label">${t('subtitleSettingsDrawer.borderWidth.label')}</span><span id="val-sub-border-width" class="text-xs text-yellow-400 font-mono">1</span></div>
                            <input type="range" id="setting-sub-border-width" data-value-target="val-sub-border-width" min="0" max="6" step="1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.borderRadius.label">${t('subtitleSettingsDrawer.borderRadius.label')}</span><span id="val-sub-border-radius" class="text-xs text-yellow-400 font-mono">16</span></div>
                            <input type="range" id="setting-sub-border-radius" data-value-target="val-sub-border-radius" min="0" max="40" step="1" class="setting-slider">
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.textColor.label">${t('subtitleSettingsDrawer.textColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-sub-text-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.fontSize.label">${t('subtitleSettingsDrawer.fontSize.label')}</span><span id="val-sub-font-size" class="text-xs text-yellow-400 font-mono">8</span></div>
                            <input type="range" id="setting-sub-font-size" data-value-target="val-sub-font-size" min="8" max="16" step="1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.lineHeight.label">${t('subtitleSettingsDrawer.lineHeight.label')}</span><span id="val-sub-line-height" class="text-xs text-yellow-400 font-mono">1.3</span></div>
                            <input type="range" id="setting-sub-line-height" data-value-target="val-sub-line-height" min="1" max="2.5" step="0.1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="subtitleSettingsDrawer.letterSpacing.label">${t('subtitleSettingsDrawer.letterSpacing.label')}</span><span id="val-sub-letter-spacing" class="text-xs text-yellow-400 font-mono">0</span></div>
                            <input type="range" id="setting-sub-letter-spacing" data-value-target="val-sub-letter-spacing" min="-1" max="5" step="0.5" class="setting-slider">
                        </div>
                    </div>
                </div>
`;
}
