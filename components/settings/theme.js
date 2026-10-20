/**
 * Component: màn Settings > System > Theme — select "Color" (Light/Dark/Morphin) và, chỉ khi Color = Morphin, cụm 3 card nền
 * (None / Gradient / Background media) + hàng "Panel glass" (2 slider kính Playlist chính, chỉ hiện khi đang dùng nền media).
 * Card "Player control" (mọi Color): kiểu nền, độ đục, bìa trong nút Play, vị trí phụ đề của Bottom Player, có khung xem
 * trước — computePlayerControlView() (core/player-control-style.js), wire/vá: core/player-control-settings-ui.js.
 *
 * Logic: event/workflow/app-settings.js (_renderTheme) + event/workflow/theme.js. Trạng thái card: computeThemeBackgroundView()
 * (core/theme-background.js). Wiring: core/app-settings-ui.js::wireAppSettingsTheme(), core/theme-background-ui.js::
 * wireThemeBackgroundCards(); vá tại chỗ: patchThemeBackgroundCards() (giữ đúng các `data-theme-bg-*`/id dưới đây).
 * NẠP SAU: lang/lang.js (t), core/ui-theme/icon-svg-ui.js (iconSvg). Lúc chạy: core/theme-background.js (THEME_GLASS_*),
 * core/player-control-style.js (PLAYER_CONTROL_OPACITY_*, PLAYER_CONTROL_SUBTITLE_GAP_*).
 */

/** Thân màn Theme. @param {string[]} themeNames - getSelectableUiThemeNames() @param {string} activeUiTheme
 * @param {string} backgroundHtml - renderThemeBackgroundCardsHtml() khi Color = Morphin, '' nếu không
 * @param {string} playerControlHtml - renderPlayerControlSettingsHtml() @returns {string} */
function renderAppSettingsThemeBody(themeNames, activeUiTheme, backgroundHtml, playerControlHtml) {
    const optionsHtml = themeNames.map((name) => `<option value="${name}"${name === activeUiTheme ? ' selected' : ''}>${t('appSettings.theme.uiTheme.option.' + name)}</option>`).join('');
    return `
            <div class="flex flex-col gap-2">
                <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                    <div class="flex justify-between items-center px-4 py-3.5">
                        <span class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${t('appSettings.theme.uiTheme.label')}</span>
                        <select id="app-settings-ui-theme-select" class="rounded-lg px-2 py-1.5 text-xs outline-none w-40 text-right" data-uitk="inputBg inputBorder inputText">
                            ${optionsHtml}
                        </select>
                    </div>
                    ${backgroundHtml}
                </div>
                ${playerControlHtml}
            </div>
        `;
}

/** Card "Player control" — khung xem trước (nền giả lập Visualizer + thanh điều khiển thu nhỏ, cùng CSS bề mặt + key `pc*`
 * với Bottom Player thật; Shuffle vẽ ở trạng thái bật), nút kiểu nền, slider độ đục, công tắc bìa trong nút Play, vị trí phụ
 * đề (Inside/Outside) + slider khoảng cách (chỉ Outside). Thuộc tính khung xem trước là slot — gán qua
 * patchPlayerControlSettings() (core/player-control-settings-ui.js) sau khi dựng.
 * @param {ReturnType<typeof computePlayerControlView>} view @returns {string} */
function renderPlayerControlSettingsHtml(view) {
    const pickBtn = (attr, value, item) => `<button type="button" ${attr}="${value}" aria-pressed="${item.selected}" class="h-8 px-3 rounded-full text-xs font-semibold transition-colors" data-uitk="${item.uitk}" data-i18n="${item.labelKey}">${t(item.labelKey)}</button>`;
    const styleButtons = view.items.map((item) => pickBtn('data-pc-style-pick', item.style, item)).join('');
    const subtitleButtons = view.subtitleItems.map((item) => pickBtn('data-pc-sub-pick', item.placement, item)).join('');
    const sliderRow = (rowId, labelKey, inputId, min, max, value, unit, visible) => `
                    <div id="${rowId}" class="${visible ? '' : 'hidden'}">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs" data-uitk="textSecondary" data-i18n="${labelKey}">${t(labelKey)}</span>
                            <span id="${inputId}-value" class="text-xs font-mono tabular-nums" data-uitk="accentText">${value}${unit}</span>
                        </div>
                        <input type="range" id="${inputId}" min="${min}" max="${max}" step="1" value="${value}" class="w-full ce-slider">
                    </div>`;
    return `
                <div id="player-control-settings" class="rounded-2xl flex flex-col gap-3 px-4 py-4" data-uitk="cardBg cardBorder">
                    <p class="text-sm font-semibold" data-uitk="textSecondaryStrong" data-i18n="appSettings.theme.playerControl.section">${t('appSettings.theme.playerControl.section')}</p>
                    <div class="pc-preview" data-pc-preview aria-hidden="true">
                        <div class="pc-surface group" data-pc-preview-surface>
                            <div class="pc-preview-sub pc-preview-sub-out"></div>
                            <div class="pc-preview-sub pc-preview-sub-in"></div>
                            <div class="pc-preview-title bg-current" data-uitk="pcText"></div>
                            <div class="pc-preview-track"><div class="pc-preview-fill"></div><div class="pc-preview-thumb"></div></div>
                            <div class="pc-preview-meta">
                                <span class="pc-preview-meta-time bg-current" data-uitk="pcText"></span>
                                <span class="pc-preview-meta-artist bg-current" data-uitk="pcText"></span>
                                <span class="pc-preview-meta-time bg-current" data-uitk="pcTextMuted"></span>
                            </div>
                            <div class="pc-preview-controls">
                                <span class="pc-preview-btn" aria-pressed="true" data-uitk="pcToggleBtn">${iconSvg('switch-horizontal', 'pc-icon-off w-3 h-3')}${iconSvg('shuffle', 'pc-icon-on w-3 h-3')}</span>
                                <span class="pc-preview-btn" data-uitk="pcIconBtn">${iconSvg('rewind', 'w-3.5 h-3.5')}</span>
                                <span class="pc-preview-btn pc-preview-play" data-uitk="pcPlayBtn"><span class="pc-preview-cover"></span>${iconSvg('play', 'pc-play-icon w-3 h-3 ml-px')}</span>
                                <span class="pc-preview-btn" data-uitk="pcIconBtn">${iconSvg('fast-forward', 'w-3.5 h-3.5')}</span>
                                <span class="pc-preview-btn" aria-pressed="false" data-uitk="pcToggleBtn">${iconSvg('repeat', 'w-3 h-3')}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <span class="text-xs" data-uitk="textSecondary" data-i18n="appSettings.theme.playerControl.background">${t('appSettings.theme.playerControl.background')}</span>
                        <div class="flex flex-wrap gap-2 mt-2">${styleButtons}</div>
                    </div>
                    ${sliderRow('player-control-opacity-row', 'appSettings.theme.playerControl.opacity', 'player-control-opacity', PLAYER_CONTROL_OPACITY_MIN_PCT, PLAYER_CONTROL_OPACITY_MAX_PCT, view.opacityPct, '%', view.showOpacity)}
                    <div class="flex justify-between items-center">
                        <span class="text-xs" data-uitk="textSecondary" data-i18n="appSettings.theme.playerControl.coverPlay">${t('appSettings.theme.playerControl.coverPlay')}</span>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="player-control-cover" class="sr-only peer" ${view.coverOn ? 'checked' : ''}>
                            <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                        </label>
                    </div>
                    <div>
                        <span class="text-xs" data-uitk="textSecondary" data-i18n="appSettings.theme.playerControl.subtitle">${t('appSettings.theme.playerControl.subtitle')}</span>
                        <div class="flex flex-wrap gap-2 mt-2">${subtitleButtons}</div>
                    </div>
                    ${sliderRow('player-control-sub-gap-row', 'appSettings.theme.playerControl.subtitleGap', 'player-control-sub-gap', PLAYER_CONTROL_SUBTITLE_GAP_MIN_PX, PLAYER_CONTROL_SUBTITLE_GAP_MAX_PX, view.subtitleGapPx, 'px', view.showSubtitleGap)}
                </div>`;
}

/** 1 slider của hàng "Panel glass". @param {'blur'|'tint'} part @param {string} labelKey @param {number} value
 * @param {number} min @param {number} max @param {string} unit */
function renderThemeGlassSliderHtml(part, labelKey, value, min, max, unit) {
    return `<div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs" data-uitk="textSecondary" data-i18n="${labelKey}">${t(labelKey)}</span>
                        <span id="theme-glass-${part}-value" class="text-xs font-mono tabular-nums" data-uitk="accentText">${value}${unit}</span>
                    </div>
                    <input type="range" id="theme-glass-${part}" min="${min}" max="${max}" step="1" value="${value}" class="w-full ce-slider">
                </div>`;
}

/** Cụm 3 card nền + hàng "Panel glass". Card đang dùng: nền + viền nổi + tick; preview là nền thật nên gán `style` inline.
 * @param {ThemeBgCardsView} view @returns {string} */
function renderThemeBackgroundCardsHtml(view) {
    const colorInput = (id, value) => `<div class="w-8 h-8 rounded-full overflow-hidden shrink-0" data-uitk="inputBorder"><input type="color" id="${id}" class="w-10 h-10 -m-1 cursor-pointer" value="${value}"></div>`;
    const pickBtn = (kind, labelKey) => `<button type="button" data-theme-bg-pick="${kind}" class="h-8 px-2.5 rounded-full text-xs font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralText" data-i18n="${labelKey}">${t(labelKey)}</button>`;
    // Hàng điều khiển dưới mỗi card (None không có gì để chỉnh — hàng vẫn giữ min-height cho 3 card thẳng hàng).
    const controlsByMode = {
        none: '',
        gradient: `${colorInput('theme-bg-gradient-from', view.gradientFrom)}${iconSvg('arrow-narrow-right', 'h-3.5 w-3.5 shrink-0', 'data-uitk="textMutedIcon"')}${colorInput('theme-bg-gradient-to', view.gradientTo)}`,
        background: `${pickBtn('photo', 'appSettings.theme.bg.media.pickPhoto')}${pickBtn('video', 'appSettings.theme.bg.media.pickVideo')}`,
    };
    // Lớp phủ trong khối preview: None = icon "cấm" (chữ trắng mờ — nền preview luôn tối); media = khung "chưa có" + dấu play.
    const overlayByMode = {
        none: () => `<div class="absolute inset-0 flex items-center justify-center text-white/60">${iconSvg('ban', 'h-7 w-7')}</div>`,
        gradient: () => '',
        background: (item) => `
                    <div data-theme-bg-empty class="${item.showEmpty ? 'flex' : 'hidden'} absolute inset-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed" data-uitk="inputBorder textMutedIcon">
                        ${iconSvg('plus', 'h-6 w-6')}
                        <span class="text-xs leading-none" data-uitk="textSecondary" data-i18n="appSettings.theme.bg.media.empty">${t('appSettings.theme.bg.media.empty')}</span>
                    </div>
                    <span data-theme-bg-video-badge class="${item.showVideoBadge ? 'flex' : 'hidden'} absolute left-1.5 bottom-1.5 w-5 h-5 rounded-full items-center justify-center" data-uitk="btnNeutralBg btnNeutralText">${iconSvg('play', 'h-3 w-3')}</span>`,
    };

    const cards = view.items.map((item) => `
            <div class="flex flex-col items-center gap-2 min-w-0">
                <button type="button" data-theme-bg-card="${item.mode}" class="relative w-full rounded-2xl p-1 transition-colors" data-uitk="${item.uitk}">
                    <div data-theme-bg-preview class="relative w-full rounded-xl overflow-hidden" style="${item.previewStyle}">${overlayByMode[item.mode](item)}</div>
                    <span class="flex items-center justify-center text-xs font-semibold text-center leading-tight mt-1.5 mb-0.5" style="min-height:30px;" data-uitk="textPrimary" data-i18n="${item.labelKey}">${t(item.labelKey)}</span>
                    <span data-theme-bg-check class="${item.selected ? 'flex' : 'hidden'} absolute top-2 right-2 w-5 h-5 rounded-full items-center justify-center" data-uitk="btnPrimaryPillBg textOnAccent">${iconSvg('check', 'h-3 w-3')}</span>
                </button>
                <div class="flex items-center justify-center gap-1.5" style="min-height:32px;">${controlsByMode[item.mode]}</div>
            </div>`).join('');

    return `
        <div id="theme-bg-cards" class="px-4 pb-4 pt-3 border-t" data-uitk="dividerBorder">
            <p class="text-sm font-semibold mb-3" data-uitk="textSecondaryStrong" data-i18n="appSettings.theme.bg.section">${t('appSettings.theme.bg.section')}</p>
            <div class="grid grid-cols-3 gap-2">${cards}</div>
            <div id="theme-glass-row" class="${view.showGlassRow ? '' : 'hidden'} mt-4 pt-3 border-t space-y-3" data-uitk="dividerBorder">
                <div class="text-sm font-semibold" data-uitk="textSecondaryStrong" data-i18n="appSettings.theme.glass.section">${t('appSettings.theme.glass.section')}</div>
                ${renderThemeGlassSliderHtml('blur', 'appSettings.theme.glass.blur', view.glassBlur, THEME_GLASS_BLUR_MIN_PX, THEME_GLASS_BLUR_MAX_PX, 'px')}
                ${renderThemeGlassSliderHtml('tint', 'appSettings.theme.glass.tint', view.glassTint, THEME_GLASS_TINT_MIN_PCT, THEME_GLASS_TINT_MAX_PCT, '%')}
            </div>
        </div>`;
}
