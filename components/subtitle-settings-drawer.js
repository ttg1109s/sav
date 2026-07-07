/**
 * Component: Subtitle Settings panel body ("Tùy chỉnh Phụ đề") — nội dung slider style
 * khung/chữ phụ đề.
 *
 * === VIẾT LẠI TOÀN BỘ (07/07/2026, phản hồi Giang) ===
 * Viết lại từ đầu cùng cụm với workflow/router/listener — xem docstring
 * event/workflow/subtitle-style-settings.js.
 */
function renderSubtitlePanelBody() {
    return `
                <div>
                    <h3 class="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 ml-2" data-i18n="subtitleSettingsDrawer.sectionTitle">${t('subtitleSettingsDrawer.sectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.bgColor.label">${t('subtitleSettingsDrawer.bgColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-sub-bg-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.bgOpacity.label">${t('subtitleSettingsDrawer.bgOpacity.label')}</span><span id="val-sub-bg-opacity" class="text-xs text-yellow-400 font-mono">40%</span></div>
                            <input type="range" id="setting-sub-bg-opacity" min="0" max="100" step="1" class="setting-slider">
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.borderColor.label">${t('subtitleSettingsDrawer.borderColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-sub-border-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.borderOpacity.label">${t('subtitleSettingsDrawer.borderOpacity.label')}</span><span id="val-sub-border-opacity" class="text-xs text-yellow-400 font-mono">10%</span></div>
                            <input type="range" id="setting-sub-border-opacity" min="0" max="100" step="1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.borderWidth.label">${t('subtitleSettingsDrawer.borderWidth.label')}</span><span id="val-sub-border-width" class="text-xs text-yellow-400 font-mono">1</span></div>
                            <input type="range" id="setting-sub-border-width" min="0" max="6" step="1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.borderRadius.label">${t('subtitleSettingsDrawer.borderRadius.label')}</span><span id="val-sub-border-radius" class="text-xs text-yellow-400 font-mono">16</span></div>
                            <input type="range" id="setting-sub-border-radius" min="0" max="40" step="1" class="setting-slider">
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.textColor.label">${t('subtitleSettingsDrawer.textColor.label')}</span>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="setting-sub-text-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.fontSize.label">${t('subtitleSettingsDrawer.fontSize.label')}</span><span id="val-sub-font-size" class="text-xs text-yellow-400 font-mono">8</span></div>
                            <input type="range" id="setting-sub-font-size" min="8" max="16" step="1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.lineHeight.label">${t('subtitleSettingsDrawer.lineHeight.label')}</span><span id="val-sub-line-height" class="text-xs text-yellow-400 font-mono">1.3</span></div>
                            <input type="range" id="setting-sub-line-height" min="1" max="2.5" step="0.1" class="setting-slider">
                        </div>
                        <div class="flex flex-col p-4 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium truncate" data-i18n="subtitleSettingsDrawer.letterSpacing.label">${t('subtitleSettingsDrawer.letterSpacing.label')}</span><span id="val-sub-letter-spacing" class="text-xs text-yellow-400 font-mono">0</span></div>
                            <input type="range" id="setting-sub-letter-spacing" min="-1" max="5" step="0.5" class="setting-slider">
                        </div>
                    </div>
                </div>
`;
}
