/**
 * components/subtitle-settings-drawer.js — Body panel con "Subtitles" (Settings > Display > Subtitles), dựng qua
 * workflowAppSettings._renderSubtitle(). Đồng bộ giá trị + ẩn/hiện hàng phụ thuộc: event/workflow/subtitle-style-
 * settings.js. Listener: event/listener/subtitle-style-settings.js (delegation trên genericDrawerBody).
 *
 * 3 khối: (1) Custom styling (toggle; bật -> nút Styling mở Element Style Editor cho #subtitle-frame, tắt -> cỡ chữ
 * 8-16px + màu); (2) Comming/In/Outing; (3) Karaoke (dòng có timing đã Apply ở Subtitle Editor).
 * Toggle "Show subtitles" nằm ở panel cha Display (components/settings/visualizer-display-panel.js).
 *
 * NẠP SAU: core/subtitle/subtitle-transition.js (SUBTITLE_TRANSITION_EFFECTS/SUBTITLE_IN_EFFECTS),
 * core/subtitle/subtitle-karaoke-display-ui.js (KARAOKE_POINTER_SHAPES) — chỉ cần lúc gọi hàm, không lúc nạp file.
 */
function renderSubtitlePanelBody() {
    return `
                <div class="flex flex-col gap-4">
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center p-4">
                            <div class="pr-3">
                                <div class="text-sm font-medium truncate" data-i18n="settingsSubtitleStyle.useCustom.label">${t('settingsSubtitleStyle.useCustom.label')}</div>
                                <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="settingsSubtitleStyle.useCustom.hint">${t('settingsSubtitleStyle.useCustom.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-subtitle-use-custom-styling" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                            </label>
                        </div>
                        <button id="setting-open-subtitle-styling" class="hidden flex justify-between items-center p-4 w-full text-left border-t" data-uitk="dividerBorder cardHoverBg">
                            <div class="flex items-center gap-3 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" data-uitk="categoryAccent:yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10M12 17v4M5 3h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
                                <div class="min-w-0">
                                    <div class="text-sm font-medium truncate" data-i18n="settingsSubtitleStyle.styling.label">${t('settingsSubtitleStyle.styling.label')}</div>
                                    <div class="text-xs mt-0.5 truncate" data-uitk="textSecondary" data-i18n="settingsSubtitleStyle.styling.hint">${t('settingsSubtitleStyle.styling.hint')}</div>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" data-uitk="textMutedIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div id="setting-subtitle-default-fields" class="flex flex-col gap-3 p-4 border-t" data-uitk="dividerBorder">
                            <div class="flex justify-between items-center gap-2">
                                <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.defaultFontSize.label">${t('settingsSubtitleStyle.defaultFontSize.label')}</span>
                                <select id="setting-subtitle-default-fontsize" class="rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">${_subtitleFontSizeOptions()}</select>
                            </div>
                            <div class="flex justify-between items-center gap-2">
                                <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.defaultColor.label">${t('settingsSubtitleStyle.defaultColor.label')}</span>
                                <input type="color" id="setting-subtitle-default-color" value="#ffffff" class="w-10 h-8 rounded-lg bg-transparent cursor-pointer p-0.5" data-uitk="inputBorder">
                            </div>
                        </div>
                    </div>
                    ${_renderSubtitleTransitionSection()}
                    ${_renderSubtitleKaraokeSection()}
                </div>
`;
}

/** Cỡ chữ mặc định 8..16px. */
function _subtitleFontSizeOptions() {
    let opts = '';
    for (let px = 8; px <= 16; px++) opts += `<option value="${px}">${px}px</option>`;
    return opts;
}

/** Comming/In/Outing — dropdown effect chung mọi dòng; Comming/Outing thêm dấu (+/-) + nút độ lớn mở
 * openTimePickerModal (format 's-ms', biên [0, SUBTITLE_TRANSITION_MAX_MS]). `data-ms` = độ lớn hiện có. */
function _renderSubtitleTransitionSection() {
    const effectOptions = (map) => {
        let opts = `<option value="none">${t('settingsSubtitleStyle.effect.none')}</option>`;
        Object.keys(map).forEach((key) => { opts += `<option value="${key}">${t(`settingsSubtitleStyle.effect.${key}`)}</option>`; });
        return opts;
    };
    const valueField = (prefix) => `
                            <select id="setting-subtitle-${prefix}-sign" class="rounded-lg px-1.5 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">
                                <option value="+">+</option>
                                <option value="-">−</option>
                            </select>
                            <button type="button" id="setting-subtitle-${prefix}-magnitude" data-ms="0" class="w-16 rounded-lg px-2 py-1.5 text-xs outline-none text-right" data-uitk="cardHoverBg inputBg inputBorder inputText">0.0s</button>`;

    return `
                    <div>
                        <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="categoryAccent:yellow" data-i18n="settingsSubtitleStyle.transition.sectionTitle">${t('settingsSubtitleStyle.transition.sectionTitle')}</h3>
                        <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                            <div class="flex flex-col gap-2 p-4 border-b" data-uitk="dividerBorder">
                                <div class="flex justify-between items-center gap-2">
                                    <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.comming.label">${t('settingsSubtitleStyle.comming.label')}</span>
                                    <div class="flex items-center gap-2">
                                        <select id="setting-subtitle-comming-effect" class="rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">${effectOptions(SUBTITLE_TRANSITION_EFFECTS)}</select>
                                        ${valueField('comming')}
                                    </div>
                                </div>
                                <p class="text-[11px]" data-uitk="textSecondary" data-i18n="settingsSubtitleStyle.transition.hint">${t('settingsSubtitleStyle.transition.hint')}</p>
                            </div>
                            <div class="flex justify-between items-center p-4 gap-2 border-b" data-uitk="dividerBorder">
                                <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.in.label">${t('settingsSubtitleStyle.in.label')}</span>
                                <select id="setting-subtitle-in-effect" class="rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">${effectOptions(SUBTITLE_IN_EFFECTS)}</select>
                            </div>
                            <div class="flex justify-between items-center p-4 gap-2">
                                <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.outing.label">${t('settingsSubtitleStyle.outing.label')}</span>
                                <div class="flex items-center gap-2">
                                    <select id="setting-subtitle-outing-effect" class="rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">${effectOptions(SUBTITLE_TRANSITION_EFFECTS)}</select>
                                    ${valueField('outing')}
                                </div>
                            </div>
                        </div>
                    </div>
`;
}

/** Karaoke — toggle bật + các hàng phụ thuộc (ẩn/hiện theo cấu hình, xem resolveKaraokeSettingsVisibility()). */
function _renderSubtitleKaraokeSection() {
    const toggle = (id) => `
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" id="${id}" class="sr-only peer">
                                    <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                                </label>`;
    const select = (id, options) => `<select id="${id}" class="rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">${options.map((key) => `<option value="${key}">${t(`settingsSubtitleStyle.karaoke.option.${key}`)}</option>`).join('')}</select>`;
    const row = (rowId, labelKey, control) => `
                            <div${rowId ? ` id="${rowId}"` : ''} class="flex justify-between items-center gap-2 px-4 py-3 border-t" data-uitk="dividerBorder">
                                <span class="text-sm font-medium" data-i18n="${labelKey}">${t(labelKey)}</span>
                                ${control}
                            </div>`;
    const range = (id, labelKey, min, max, step) => `
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex justify-between items-center gap-2">
                                        <span class="text-xs" data-uitk="textSecondary" data-i18n="${labelKey}">${t(labelKey)}</span>
                                        <span id="${id}-value" class="text-xs tabular-nums" data-uitk="textSecondary"></span>
                                    </div>
                                    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" class="w-full" style="accent-color:#eab308">
                                </div>`;
    return `
                    <div>
                        <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="categoryAccent:yellow" data-i18n="settingsSubtitleStyle.karaoke.sectionTitle">${t('settingsSubtitleStyle.karaoke.sectionTitle')}</h3>
                        <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                            <div class="flex justify-between items-center p-4">
                                <div class="pr-3">
                                    <div class="text-sm font-medium" data-i18n="settingsSubtitleStyle.karaoke.enable.label">${t('settingsSubtitleStyle.karaoke.enable.label')}</div>
                                    <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="settingsSubtitleStyle.karaoke.enable.hint">${t('settingsSubtitleStyle.karaoke.enable.hint')}</div>
                                </div>
                                ${toggle('setting-subtitle-karaoke-enabled')}
                            </div>
                            <div id="setting-subtitle-karaoke-body" class="flex flex-col">
                                ${row('', 'settingsSubtitleStyle.karaoke.mode.label', select('setting-subtitle-karaoke-mode', ['k', 'kf', 'vanish', 'reveal']))}
                                ${row('setting-subtitle-karaoke-dissolve-row', 'settingsSubtitleStyle.karaoke.dissolve.label', select('setting-subtitle-karaoke-dissolve', ['fade', 'dust', 'smoke']))}
                                ${row('', 'settingsSubtitleStyle.karaoke.color.label', '<input type="color" id="setting-subtitle-karaoke-color" value="#facc15" class="w-10 h-8 rounded-lg bg-transparent cursor-pointer p-0.5" data-uitk="inputBorder">')}
                                ${row('', 'settingsSubtitleStyle.karaoke.effect.label', select('setting-subtitle-karaoke-effect', ['none', 'swell', 'bounceUp', 'dropDown', 'squashX', 'squashY']))}
                                ${row('setting-subtitle-karaoke-squash-row', 'settingsSubtitleStyle.karaoke.squash.label', select('setting-subtitle-karaoke-squash', ['in', 'out']))}
                                ${row('', 'settingsSubtitleStyle.karaoke.outline.label', toggle('setting-subtitle-karaoke-outline'))}
                                <div id="setting-subtitle-karaoke-outline-params" class="flex flex-col gap-3 px-4 pb-4">
                                    ${range('setting-subtitle-karaoke-outline-width', 'settingsSubtitleStyle.karaoke.outlineWidth.label', 0.5, 6, 0.5)}
                                    ${range('setting-subtitle-karaoke-outline-opacity', 'settingsSubtitleStyle.karaoke.outlineOpacity.label', 0, 1, 0.05)}
                                    ${range('setting-subtitle-karaoke-outline-glow', 'settingsSubtitleStyle.karaoke.outlineGlow.label', 0, 1, 0.05)}
                                    ${range('setting-subtitle-karaoke-outline-blur', 'settingsSubtitleStyle.karaoke.outlineBlur.label', 0, 20, 1)}
                                </div>
                                ${row('', 'settingsSubtitleStyle.karaoke.pointer.label', toggle('setting-subtitle-karaoke-pointer'))}
                                ${row('setting-subtitle-karaoke-pointer-shape-row', 'settingsSubtitleStyle.karaoke.pointerShape.label', select('setting-subtitle-karaoke-pointer-shape', Object.keys(KARAOKE_POINTER_SHAPES)))}
                            </div>
                        </div>
                    </div>
`;
}
