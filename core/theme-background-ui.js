/**
 * core/theme-background-ui.js — MỚI (21/09/2026, Giang yêu cầu "sửa lại UI: thay vì dropdown, hiện ra ba card Solid / Gradient / Background
 * media mà nó phản ánh được nền của nó, và nút chọn bên dưới"). Core-ui (Rule 5c, hậu tố `-ui`): CHỈ dựng HTML + gắn listener + vá DOM, KHÔNG
 * `appState.get()`/`appConfig*.getAll()` (Rule 2) — mọi dữ liệu do Workflow đọc rồi truyền vào `state`. Dùng ở Settings > System > Theme, CHỈ khi
 * Color = Morphin (event/workflow/app-settings.js::_renderTheme()).
 *
 * 3 card, mỗi card là 1 nút bấm CHỌN nền đó + 1 hàng điều khiển ngay bên dưới:
 *   - Solid           — preview = màu phẳng; điều khiển: 1 ô màu.
 *   - Gradient        — preview = gradient 135° đúng kiểu nền thật; điều khiển: 2 ô màu (Từ -> Đến).
 *   - Background media — preview = CHÍNH ảnh nền (photo) hoặc thumb full-res của video (kèm dấu play); chưa chọn -> khung nét đứt + dấu "+";
 *                        điều khiển: 2 nút Photo / Video mở picker thư viện.
 * Card đang dùng: nền + viền nổi (`rowActiveBg`/`rowActiveBorder`) + dấu tick. Chạm ô màu của 1 card cũng CHỌN card đó (Workflow lo, xem
 * event/workflow/theme.js). Toàn bộ màu chữ/viền/nền UI đi qua theme key (`data-uitk`); riêng màu PREVIEW là dữ liệu nền thật nên gán `style` inline.
 *
 * `patchThemeBackgroundCards()` cập nhật tại chỗ (preview, tick, giá trị ô màu) mà KHÔNG dựng lại — gọi được lúc người dùng đang kéo ô màu
 * (dựng lại sẽ đóng bảng chọn màu của trình duyệt giữa chừng).
 *
 * NẠP SAU: core/ui-theme/apply-ui.js (applyUiThemeToDom), lang/lang.js (t). NẠP TRƯỚC: event/workflow/app-settings.js, event/workflow/theme.js.
 *
 * MỚI 23/09/2026 (Giang: "tinh chỉnh độ mờ cho playlist main app" — THAY hàng blur ảnh nền vừa làm, đã bỏ) — 1 HÀNG RIÊNG "Panel glass" dưới cụm 3
 * card (`#theme-glass-row`) gồm 2 slider: Blur 0-40px (`#theme-glass-blur`) + Opacity 0-40% (`#theme-glass-tint`), chỉnh kính các màn App Panel chính
 * (Playlist, Game catalog, Statistics — class `.uitk-glass-tunable`, assets/css/glass.css). CHỈ hiện khi đang chọn Background media VÀ đã có item (ảnh
 * hoặc video) — `state.showGlassRow`, Workflow tính. Hàng luôn có trong DOM, chỉ bật/tắt `hidden` -> `patchThemeBackgroundCards()` vá được.
 *
 * @typedef {{themeMode:string, solidColor:string, gradientFrom:string, gradientTo:string, mediaKind:''|'photo'|'video', hasMedia:boolean, mediaPreviewUrl:string, glassBlur:number, glassTint:number, showGlassRow:boolean}} ThemeBackgroundState
 */

const THEME_BG_CARD_MODES = ['solid', 'gradient', 'background']; // thứ tự hiển thị; 'background' = "Background media"
const THEME_GLASS_BLUR_MAX_PX = 40; // khớp mức kẹp của setAppGlassBlur() (core/visualizer/visualizer-display.js)
const THEME_GLASS_TINT_MAX_PCT = 40; // khớp mức kẹp của setAppGlassTint()
const THEME_BG_PREVIEW_HEIGHT_PX = 88; // inline style — tránh class ngoặc vuông (Tailwind CDN tiêm CSS bất đồng bộ, xem ghi chú cùng lý do ở core/statis-panel-ui.js)

/** Kiểu nền của khối preview cho 1 card, từ `state`. @param {'solid'|'gradient'|'background'} mode @param {ThemeBackgroundState} state @returns {string} chuỗi `style` */
function _themeBgPreviewStyle(mode, state) {
    if (mode === 'solid') return `height:${THEME_BG_PREVIEW_HEIGHT_PX}px; background:${state.solidColor};`;
    if (mode === 'gradient') return `height:${THEME_BG_PREVIEW_HEIGHT_PX}px; background:linear-gradient(135deg, ${state.gradientFrom}, ${state.gradientTo});`;
    return state.mediaPreviewUrl
        ? `height:${THEME_BG_PREVIEW_HEIGHT_PX}px; background:url(${state.mediaPreviewUrl}) center / cover no-repeat;`
        : `height:${THEME_BG_PREVIEW_HEIGHT_PX}px;`;
}

/** Key theme cho 1 card theo trạng thái chọn. @param {boolean} selected @returns {string} */
function _themeBgCardUitk(selected) {
    return selected ? 'rowActiveBg rowActiveBorder' : 'cardBg cardBorder';
}

/** 1 slider trong hàng "Panel glass" (nhãn + số + range). Hàm lá, chỉ dựng chuỗi. MỚI 23/09/2026.
 * @param {'blur'|'tint'} part @param {string} labelKey @param {number} value @param {number} max @param {string} unit @param {function} t */
function _themeGlassSliderHtml(part, labelKey, value, max, unit, t) {
    return `<div>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs" data-uitk="textSecondary" data-i18n="${labelKey}">${t(labelKey)}</span>
                        <span id="theme-glass-${part}-value" class="text-xs font-mono tabular-nums" data-uitk="accentText">${value}${unit}</span>
                    </div>
                    <input type="range" id="theme-glass-${part}" min="0" max="${max}" step="1" value="${value}" class="w-full ce-slider">
                </div>`;
}

/**
 * @param {ThemeBackgroundState} state
 * @param {function} t
 * @returns {string}
 */
function buildThemeBackgroundCardsHtml(state, t) {
    const labelKey = { solid: 'appSettings.theme.bg.solid', gradient: 'appSettings.theme.bg.gradient', background: 'appSettings.theme.bg.media' };
    const colorInput = (id, value) => `<div class="w-8 h-8 rounded-full overflow-hidden shrink-0" data-uitk="inputBorder"><input type="color" id="${id}" class="w-10 h-10 -m-1 cursor-pointer" value="${value}"></div>`;
    const arrowIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" data-uitk="textMutedIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>';
    const pickBtn = (kind, labelI18nKey) => `<button type="button" data-theme-bg-pick="${kind}" class="h-8 px-2.5 rounded-full text-xs font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralText" data-i18n="${labelI18nKey}">${t(labelI18nKey)}</button>`;

    const controls = {
        solid: colorInput('theme-bg-solid-color', state.solidColor),
        gradient: `${colorInput('theme-bg-gradient-from', state.gradientFrom)}${arrowIcon}${colorInput('theme-bg-gradient-to', state.gradientTo)}`,
        background: `${pickBtn('photo', 'appSettings.theme.bg.media.pickPhoto')}${pickBtn('video', 'appSettings.theme.bg.media.pickVideo')}`,
    };

    const plusIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>';
    const playBadge = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z"/></svg>';
    const checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';

    const cards = THEME_BG_CARD_MODES.map((mode) => {
        const selected = state.themeMode === mode;
        const isMedia = mode === 'background';
        const hasMedia = isMedia && state.hasMedia;
        const mediaOverlay = isMedia ? `
                    <div data-theme-bg-empty class="${hasMedia ? 'hidden' : 'flex'} absolute inset-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed" data-uitk="inputBorder textMutedIcon">
                        ${plusIcon}
                        <span class="text-xs leading-none" data-uitk="textSecondary" data-i18n="appSettings.theme.bg.media.empty">${t('appSettings.theme.bg.media.empty')}</span>
                    </div>
                    <span data-theme-bg-video-badge class="${hasMedia && state.mediaKind === 'video' ? 'flex' : 'hidden'} absolute left-1.5 bottom-1.5 w-5 h-5 rounded-full items-center justify-center" data-uitk="btnNeutralBg btnNeutralText">${playBadge}</span>` : '';
        return `
            <div class="flex flex-col items-center gap-2 min-w-0">
                <button type="button" data-theme-bg-card="${mode}" class="relative w-full rounded-2xl p-1 transition-colors" data-uitk="${_themeBgCardUitk(selected)}">
                    <div data-theme-bg-preview class="relative w-full rounded-xl overflow-hidden" style="${_themeBgPreviewStyle(mode, state)}">${mediaOverlay}</div>
                    <span class="flex items-center justify-center text-xs font-semibold text-center leading-tight mt-1.5 mb-0.5" style="min-height:30px;" data-uitk="textPrimary" data-i18n="${labelKey[mode]}">${t(labelKey[mode])}</span>
                    <span data-theme-bg-check class="${selected ? 'flex' : 'hidden'} absolute top-2 right-2 w-5 h-5 rounded-full items-center justify-center" data-uitk="btnPrimaryPillBg textOnAccent">${checkIcon}</span>
                </button>
                <div class="flex items-center justify-center gap-1.5" style="min-height:32px;">${controls[mode]}</div>
            </div>`;
    }).join('');

    return `
        <div id="theme-bg-cards" class="px-4 pb-4 pt-3 border-t" data-uitk="dividerBorder">
            <p class="text-sm font-semibold mb-3" data-uitk="textSecondaryStrong" data-i18n="appSettings.theme.bg.section">${t('appSettings.theme.bg.section')}</p>
            <div class="grid grid-cols-3 gap-2">${cards}</div>
            <div id="theme-glass-row" class="${state.showGlassRow ? '' : 'hidden'} mt-4 pt-3 border-t space-y-3" data-uitk="dividerBorder">
                <div class="text-sm font-semibold" data-uitk="textSecondaryStrong" data-i18n="appSettings.theme.glass.section">${t('appSettings.theme.glass.section')}</div>
                ${_themeGlassSliderHtml('blur', 'appSettings.theme.glass.blur', state.glassBlur, THEME_GLASS_BLUR_MAX_PX, 'px', t)}
                ${_themeGlassSliderHtml('tint', 'appSettings.theme.glass.tint', state.glassTint, THEME_GLASS_TINT_MAX_PCT, '%', t)}
            </div>
        </div>`;
}

/**
 * Gắn listener cho cụm 3 card (DOM do `buildThemeBackgroundCardsHtml()` vừa dựng) — callback CHỈ `eventBus.send()` (Rule 5a), gom cuối.
 * Chạm ô màu của 1 card = chọn card đó (Router/Workflow xử lý — không tự đổi class ở đây).
 * @param {HTMLElement} rootEl
 */
function wireThemeBackgroundCards(rootEl) {
    rootEl.querySelectorAll('[data-theme-bg-card]').forEach((card) => card.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: card.dataset.themeBgCard } })));
    rootEl.querySelectorAll('[data-theme-bg-pick]').forEach((btn) => btn.addEventListener('click', () => eventBus.send({ router: 'theme', type: 'theme.pickBackgroundMedia.click', payload: { kind: btn.dataset.themeBgPick } })));
    const solidInput = rootEl.querySelector('#theme-bg-solid-color');
    if (solidInput) solidInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.solidColor.input', payload: { value: e.target.value } }));
    const fromInput = rootEl.querySelector('#theme-bg-gradient-from');
    if (fromInput) fromInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.gradientFrom.input', payload: { value: e.target.value } }));
    const toInput = rootEl.querySelector('#theme-bg-gradient-to');
    if (toInput) toInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.gradientTo.input', payload: { value: e.target.value } }));
    const glassBlurInput = rootEl.querySelector('#theme-glass-blur'); // MỚI 23/09/2026 — kính Playlist/Game catalog/Statistics
    if (glassBlurInput) glassBlurInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.glassBlur.input', payload: { value: e.target.value } }));
    const glassTintInput = rootEl.querySelector('#theme-glass-tint');
    if (glassTintInput) glassTintInput.addEventListener('input', (e) => eventBus.send({ router: 'theme', type: 'theme.glassTint.input', payload: { value: e.target.value } }));
}

/**
 * Vá TẠI CHỖ cụm 3 card theo `state` mới (preview, card đang chọn + tick, dấu play, giá trị ô màu) — KHÔNG dựng lại DOM. Ô màu đang được
 * chạm/kéo (`document.activeElement`) giữ nguyên giá trị để không giật bảng chọn màu. Cụm không có trong DOM (Settings không mở ở màn Theme,
 * hoặc Color khác Morphin) -> bỏ qua.
 * @param {HTMLElement} rootEl - phần tử chứa `#theme-bg-cards` (vd genericDrawerBody)
 * @param {ThemeBackgroundState} state
 */
function patchThemeBackgroundCards(rootEl, state) {
    const cluster = rootEl.querySelector('#theme-bg-cards');
    if (!cluster) return;
    cluster.querySelectorAll('[data-theme-bg-card]').forEach((card) => {
        const mode = card.dataset.themeBgCard;
        const selected = state.themeMode === mode;
        card.dataset.uitk = _themeBgCardUitk(selected);
        const check = card.querySelector('[data-theme-bg-check]');
        if (check) { check.classList.toggle('hidden', !selected); check.classList.toggle('flex', selected); }
        const preview = card.querySelector('[data-theme-bg-preview]');
        if (preview) preview.style.cssText = _themeBgPreviewStyle(mode, state);
        if (mode === 'background') {
            const hasMedia = state.hasMedia;
            const empty = card.querySelector('[data-theme-bg-empty]');
            if (empty) { empty.classList.toggle('hidden', hasMedia); empty.classList.toggle('flex', !hasMedia); }
            const videoBadge = card.querySelector('[data-theme-bg-video-badge]');
            if (videoBadge) { const showBadge = hasMedia && state.mediaKind === 'video'; videoBadge.classList.toggle('hidden', !showBadge); videoBadge.classList.toggle('flex', showBadge); }
        }
    });
    [['#theme-bg-solid-color', state.solidColor], ['#theme-bg-gradient-from', state.gradientFrom], ['#theme-bg-gradient-to', state.gradientTo]].forEach(([selector, value]) => {
        const input = cluster.querySelector(selector);
        if (input && document.activeElement !== input && input.value !== value) input.value = value;
    });
    // MỚI 23/09/2026 — hàng "Panel glass": ẩn/hiện theo state, số luôn cập nhật; slider đang kéo thì giữ nguyên giá trị (không giật tay kéo).
    const glassRow = cluster.querySelector('#theme-glass-row');
    if (glassRow) glassRow.classList.toggle('hidden', !state.showGlassRow);
    [['blur', state.glassBlur, 'px'], ['tint', state.glassTint, '%']].forEach(([part, value, unit]) => {
        const valueEl = cluster.querySelector(`#theme-glass-${part}-value`);
        if (valueEl) valueEl.textContent = `${value}${unit}`;
        const input = cluster.querySelector(`#theme-glass-${part}`);
        if (input && document.activeElement !== input && Number(input.value) !== value) input.value = String(value);
    });
    if (typeof applyUiThemeToDom === 'function' && typeof _activeUiThemeKeyList !== 'undefined') applyUiThemeToDom(cluster, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — `dataset.uitk` của card vừa đổi theo trạng thái chọn
}
