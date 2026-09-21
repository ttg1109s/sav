/**
 * Component: màn hình "Cấu hình Motion" — hệ PRESET độc lập, đặt tên/thêm/xoá được (CÙNG KHUÔN
 * hệ preset EQ — core/eq-presets.js/components/eq-presets-drawer.js). Preset TỰ đăng ký cho nơi
 * tiêu thụ (VBG Photo) ngay trong màn Edit, chứ KHÔNG sở hữu/quản lý nơi tiêu thụ. Lối vào DUY
 * NHẤT: Settings > System > Motion -> thẳng danh sách preset.
 *
 * 5 màn (mỗi màn 1 hàm render, tất cả điều hướng qua workflowAppSettings.navigateTo(), xem
 * event/workflow/app-settings.js + event/workflow/motion-presets.js):
 *   1. `renderMotionListBody(presets)` — danh sách preset, tap = sửa, nút xoá nhanh mỗi dòng.
 *   2. `renderMotionEditBody(preset, motionApply, consumerKey)` — sửa 1 preset: Transition +
 *      Point Move (thay Ken Burns, xem core/motion-presets.js) + React Beat Audio + "Áp dụng cho"
 *      (đăng ký nơi tiêu thụ) + "Quản lý" (đổi tên/Reset/Xoá).
 *   3. `renderPointMoveListBody(pointMoves)` — danh sách point move: checkbox | tên | xoá | sửa.
 *   4. `renderPointMoveEditBody(pointMove)` — sửa 6 thông số (Linear X/Y, Rotate, Zoom, Flip X/Y).
 *   5. `renderPointMoveTimingBody()` — khung chứa đường cong Timing (SVG dựng bởi
 *      core/point-move-timing-ui.js, workflow tự append vào #ptmove-timing-container).
 *
 * Logic: event/workflow/motion-presets.js (workflowMotionPresets). Router/Listener: cụm
 * "motionPresets" (event/router/motion-presets.js).
 * NẠP SAU: core/modal-choice-ui.js (escapeHtml()), core/motion-engine.js/motion-presets.js,
 * components/settings/app-settings-main.js (renderAppSettingsRowList()).
 *
 * SỬA (09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — toàn bộ 5 màn viết LẠI TRỰC TIẾP bằng
 * bảng màu sáng (trước đây `glass-modal`/`border-white/5`/toggle track `bg-slate-600`/select
 * `bg-black/50`, phụ thuộc `.app-settings-scope` đè màu — assets/css/layout-nav.css). Đồng thời phát
 * hiện + sửa 3 rule CSS `.ptmove-*` (assets/css/sliders.css) vẫn dùng track/tick màu
 * `rgba(255,255,255,x)` — gần như vô hình trên nền trắng Generic Drawer, CÙNG lỗi đã fix trước đây
 * cho EQ slider (`.eq-preset-slider*` thay `.eq-slider`) nhưng chưa lan sang Point Move lúc đó.
 */

/** @param {{id:string, name:string}[]} presets */
function renderMotionListBody(presets) {
    const addRowHtml = `
        <button type="button" id="btn-motion-list-add" class="w-full text-center px-4 py-3.5 rounded-2xl mb-2 text-sm font-semibold" data-uitk="btnAccentSoft accentSoftBorder">${t('motionPresetsDrawer.list.add.label')}</button>
    `;
    if (presets.length === 0) {
        return addRowHtml + `<p class="text-sm text-center py-10 px-6" data-uitk="textSecondary">${t('motionPresetsDrawer.list.empty')}</p>`;
    }
    const itemsHtml = presets.map((p) => `
        <div data-motion-preset-tile="${escapeHtml(p.id)}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3 cursor-pointer" data-uitk="cardBg cardBorder cardHoverBg">
            <span class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${escapeHtml(p.name)}</span>
            <button type="button" data-motion-preset-quickdelete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full shrink-0" data-uitk="iconBtnDestructive" title="${t('motionPresetsDrawer.list.delete.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
    `).join('');
    return addRowHtml + itemsHtml;
}

/** Option {value,labelKey} cho select hướng — trục ngang (Pan X/Rotate) vs trục dọc (Pan Y, MỚI —
 * phản hồi Giang "chia Pan thành Pan X/Pan Y"). Dùng bởi renderMotionBeatReactEffectRows() ngay dưới. */
const MOTION_SETTINGS_BEATREACT_DIRECTIONS_X = [
    { value: 'left', labelKey: 'motionPresetsDrawer.beatReact.direction.left' },
    { value: 'right', labelKey: 'motionPresetsDrawer.beatReact.direction.right' },
    { value: 'leftToRight', labelKey: 'motionPresetsDrawer.beatReact.direction.leftToRight' },
    { value: 'rightToLeft', labelKey: 'motionPresetsDrawer.beatReact.direction.rightToLeft' },
];
const MOTION_SETTINGS_BEATREACT_DIRECTIONS_Y = [
    { value: 'up', labelKey: 'motionPresetsDrawer.beatReact.direction.up' },
    { value: 'down', labelKey: 'motionPresetsDrawer.beatReact.direction.down' },
    { value: 'upToDown', labelKey: 'motionPresetsDrawer.beatReact.direction.upToDown' },
    { value: 'downToUp', labelKey: 'motionPresetsDrawer.beatReact.direction.downToUp' },
];

/** Dựng các hàng (checkbox bật + [select hướng + checkbox reverse + tick Random Max] + ô nhập số +
 * slider max biên độ) cho 1 hiệu ứng con (zoom/panX/panY/rotate) trong nhóm "React Beat Audio" —
 * DÙNG CHUNG cả 4. SỬA (phản hồi Giang — ô input số sync 2 chiều với slider + tick "Random Max" dưới
 * Reverse) — `cfg.directions` (mảng {value,labelKey}) thay vì hard-code trái/phải, để Pan Y dùng
 * được bộ hướng lên/xuống riêng (core/motion-presets.js::MOTION_BEAT_REACT_DIRECTIONS_Y) mà không
 * cần viết lại cả hàm. Hiệu ứng KHÔNG có hướng (zoom) vẫn có Random Max — đặt ngay dưới ô nhập số/
 * slider max (không có hàng Reverse để bám vào).
 * @param {'zoom'|'panX'|'panY'|'rotate'} key @param {object} effect - `preset.reactBeatAudio[key]`.
 * @param {{titleKey:string, maxLabelKey:string, boundMin:number, boundMax:number, step:number, suffix:string, hasDirection:boolean, directions?:{value:string,labelKey:string}[], isLast?:boolean}} cfg
 */
function renderMotionBeatReactEffectRows(key, effect, cfg) {
    const isDeg = key === 'rotate';
    const maxVal = isDeg ? effect.maxDeg : effect.maxPct;
    const borderClass = cfg.isLast ? '' : ' border-b'; // màu đường kẻ = key dividerBorder gắn ở thẻ dùng borderClass (data-uitk bên dưới)
    const directionOptionsHtml = cfg.hasDirection ? cfg.directions.map((d) => `<option value="${d.value}" ${effect.direction === d.value ? 'selected' : ''} data-i18n="${d.labelKey}">${t(d.labelKey)}</option>`).join('') : '';
    const directionHtml = cfg.hasDirection ? `
                        <div class="flex justify-between items-center px-4 pb-3">
                            <span class="text-xs" data-uitk="textSecondary" data-i18n="motionPresetsDrawer.beatReact.direction.label">${t('motionPresetsDrawer.beatReact.direction.label')}</span>
                            <select id="setting-motion-beatreact-${key}-direction" class="rounded-lg px-2 py-1 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                ${directionOptionsHtml}
                            </select>
                        </div>
                        <label class="flex items-center gap-2.5 px-4 pb-3 cursor-pointer">
                            <input type="checkbox" id="setting-motion-beatreact-${key}-reverse" class="w-4 h-4 rounded shrink-0" data-uitk="accentControl" ${effect.reverse ? 'checked' : ''}>
                            <span class="text-xs" data-uitk="textSecondary" data-i18n="motionPresetsDrawer.beatReact.reverse.label">${t('motionPresetsDrawer.beatReact.reverse.label')}</span>
                        </label>` : '';
    // MỚI (phản hồi Giang — "bổ sung tick random Max ở dưới Reverse") — hiệu ứng CÓ hướng (Reverse
    // đứng trên) thì Random Max nối NGAY sau; hiệu ứng KHÔNG có hướng (zoom, không có Reverse) thì
    // Random Max đặt ngay dưới ô nhập số/slider max (xem cuối template).
    const randomMaxHtml = `
                        <label class="flex items-center gap-2.5 px-4 ${cfg.hasDirection ? 'pb-3' : 'pt-3'} cursor-pointer">
                            <input type="checkbox" id="setting-motion-beatreact-${key}-randommax" class="w-4 h-4 rounded shrink-0" data-uitk="accentControl" ${effect.randomMax ? 'checked' : ''}>
                            <span class="text-xs" data-uitk="textSecondary" data-i18n="motionPresetsDrawer.beatReact.randomMax.label">${t('motionPresetsDrawer.beatReact.randomMax.label')}</span>
                        </label>`;
    return `
                        <div class="p-4${borderClass}"${cfg.isLast ? '' : ' data-uitk="dividerBorder"'}>
                            <label class="flex items-center gap-2.5 mb-3 cursor-pointer">
                                <input type="checkbox" id="setting-motion-beatreact-${key}-enabled" class="w-4 h-4 rounded shrink-0" data-uitk="accentControl" ${effect.enabled ? 'checked' : ''}>
                                <span class="text-sm font-medium" data-i18n="${cfg.titleKey}">${t(cfg.titleKey)}</span>
                            </label>
                            ${directionHtml}
                            ${cfg.hasDirection ? randomMaxHtml : ''}
                            <div class="flex justify-between items-center mb-1.5 gap-2">
                                <span class="text-xs shrink-0" data-uitk="textSecondary" data-i18n="${cfg.maxLabelKey}">${t(cfg.maxLabelKey)}</span>
                                <div class="flex items-center gap-1">
                                    <input type="number" inputmode="decimal" id="motion-beatreact-${key}-max-input" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${maxVal}" class="w-20 rounded-lg px-2 py-1 text-xs text-right outline-none" data-uitk="inputBg inputBorder inputText">
                                    <span class="text-xs" data-uitk="textSecondary">${cfg.suffix}</span>
                                </div>
                            </div>
                            <input type="range" id="setting-motion-beatreact-${key}-max" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${maxVal}" class="w-full" data-uitk="accentControl">
                            ${cfg.hasDirection ? '' : randomMaxHtml}
                        </div>
    `;
}

/** @param {object} preset - 1 phần tử `appState.motionPresets` (core/motion-presets.js). */
/** @param {object} preset @param {Object<string,string[]>} motionApply @param {string} consumerKey - đang chọn ở dropdown "Áp dụng cho". */
function renderMotionEditBody(preset, motionApply, consumerKey) {
    return `
                <!-- ===================== NHÓM 1: CHUYỂN CẢNH ===================== -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2 flex items-center justify-between" data-uitk="accentText">
                        <span data-i18n="motionSettingsDrawer.groupTransition.title">${t('motionSettingsDrawer.groupTransition.title')}</span>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0 normal-case tracking-normal">
                            <input type="checkbox" id="setting-motion-transition-enabled" class="sr-only peer" ${preset.transitionEnabled ? 'checked' : ''}>
                            <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                        </label>
                    </h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transition.label">${t('motionSettingsDrawer.transition.label')}</span>
                            <select id="setting-motion-transition" class="rounded-lg px-2 py-1.5 text-xs outline-none w-40 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="fade" ${preset.transitionType === 'fade' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.fade">${t('motionSettingsDrawer.transition.fade')}</option>
                                <option value="slide" ${preset.transitionType === 'slide' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.slide">${t('motionSettingsDrawer.transition.slide')}</option>
                                <option value="wipe" ${preset.transitionType === 'wipe' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.wipe">${t('motionSettingsDrawer.transition.wipe')}</option>
                                <option value="flipCard" ${preset.transitionType === 'flipCard' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.flipCard">${t('motionSettingsDrawer.transition.flipCard')}</option>
                                <option value="flipEdge" ${preset.transitionType === 'flipEdge' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.flipEdge">${t('motionSettingsDrawer.transition.flipEdge')}</option>
                                <option value="zoom" ${preset.transitionType === 'zoom' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.zoom">${t('motionSettingsDrawer.transition.zoom')}</option>
                                <option value="blur" ${preset.transitionType === 'blur' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.blur">${t('motionSettingsDrawer.transition.blur')}</option>
                                <option value="rotateFade" ${preset.transitionType === 'rotateFade' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.rotateFade">${t('motionSettingsDrawer.transition.rotateFade')}</option>
                                <option value="curtain" ${preset.transitionType === 'curtain' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.curtain">${t('motionSettingsDrawer.transition.curtain')}</option>
                                <option value="circleReveal" ${preset.transitionType === 'circleReveal' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.circleReveal">${t('motionSettingsDrawer.transition.circleReveal')}</option>
                                <option value="glitch" ${preset.transitionType === 'glitch' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.glitch">${t('motionSettingsDrawer.transition.glitch')}</option>
                                <option value="whipPan" ${preset.transitionType === 'whipPan' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.whipPan">${t('motionSettingsDrawer.transition.whipPan')}</option>
                                <option value="spin" ${preset.transitionType === 'spin' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transition.spin">${t('motionSettingsDrawer.transition.spin')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-direction-row" class="flex justify-between items-center p-4 ${transitionSupportsDirection(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDirection.label">${t('motionSettingsDrawer.transitionDirection.label')}</span>
                            <select id="setting-motion-transition-direction" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="left" ${preset.transitionDirection === 'left' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.left">${t('motionSettingsDrawer.transitionDirection.left')}</option>
                                <option value="right" ${preset.transitionDirection === 'right' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.right">${t('motionSettingsDrawer.transitionDirection.right')}</option>
                                <option value="up" ${preset.transitionDirection === 'up' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.up">${t('motionSettingsDrawer.transitionDirection.up')}</option>
                                <option value="down" ${preset.transitionDirection === 'down' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.down">${t('motionSettingsDrawer.transitionDirection.down')}</option>
                                <option value="random" ${preset.transitionDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.random">${t('motionSettingsDrawer.transitionDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-zoom-direction-row" class="flex justify-between items-center p-4 ${transitionSupportsZoomDirection(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionZoomDirection.label">${t('motionSettingsDrawer.transitionZoomDirection.label')}</span>
                            <select id="setting-motion-transition-zoom-direction" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="in" ${preset.transitionZoomDirection === 'in' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionZoomDirection.in">${t('motionSettingsDrawer.transitionZoomDirection.in')}</option>
                                <option value="out" ${preset.transitionZoomDirection === 'out' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionZoomDirection.out">${t('motionSettingsDrawer.transitionZoomDirection.out')}</option>
                                <option value="random" ${preset.transitionZoomDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionZoomDirection.random">${t('motionSettingsDrawer.transitionZoomDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-spin-direction-row" class="flex justify-between items-center p-4 ${transitionSupportsSpinDirection(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionSpinDirection.label">${t('motionSettingsDrawer.transitionSpinDirection.label')}</span>
                            <select id="setting-motion-transition-spin-direction" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="clockwise" ${preset.transitionSpinDirection === 'clockwise' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionSpinDirection.clockwise">${t('motionSettingsDrawer.transitionSpinDirection.clockwise')}</option>
                                <option value="counterclockwise" ${preset.transitionSpinDirection === 'counterclockwise' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionSpinDirection.counterclockwise">${t('motionSettingsDrawer.transitionSpinDirection.counterclockwise')}</option>
                                <option value="random" ${preset.transitionSpinDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionSpinDirection.random">${t('motionSettingsDrawer.transitionSpinDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-wipe-direction-row" class="flex justify-between items-center p-4 ${transitionSupportsWipeDirection(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDirection.label">${t('motionSettingsDrawer.transitionDirection.label')}</span>
                            <select id="setting-motion-transition-wipe-direction" class="rounded-lg px-2 py-1.5 text-xs outline-none w-40 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="left" ${preset.transitionWipeDirection === 'left' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.left">${t('motionSettingsDrawer.transitionDirection.left')}</option>
                                <option value="right" ${preset.transitionWipeDirection === 'right' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.right">${t('motionSettingsDrawer.transitionDirection.right')}</option>
                                <option value="up" ${preset.transitionWipeDirection === 'up' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.up">${t('motionSettingsDrawer.transitionDirection.up')}</option>
                                <option value="down" ${preset.transitionWipeDirection === 'down' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.down">${t('motionSettingsDrawer.transitionDirection.down')}</option>
                                <option value="cornerTopLeft" ${preset.transitionWipeDirection === 'cornerTopLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerTopLeft">${t('motionSettingsDrawer.transitionWipeDirection.cornerTopLeft')}</option>
                                <option value="cornerTopRight" ${preset.transitionWipeDirection === 'cornerTopRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerTopRight">${t('motionSettingsDrawer.transitionWipeDirection.cornerTopRight')}</option>
                                <option value="cornerBottomLeft" ${preset.transitionWipeDirection === 'cornerBottomLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerBottomLeft">${t('motionSettingsDrawer.transitionWipeDirection.cornerBottomLeft')}</option>
                                <option value="cornerBottomRight" ${preset.transitionWipeDirection === 'cornerBottomRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerBottomRight">${t('motionSettingsDrawer.transitionWipeDirection.cornerBottomRight')}</option>
                                <option value="random" ${preset.transitionWipeDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.random">${t('motionSettingsDrawer.transitionDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-curtain-direction-row" class="flex justify-between items-center p-4 ${transitionSupportsCurtainDirection(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDirection.label">${t('motionSettingsDrawer.transitionDirection.label')}</span>
                            <select id="setting-motion-transition-curtain-direction" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="horizontal" ${preset.transitionCurtainDirection === 'horizontal' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionCurtainDirection.horizontal">${t('motionSettingsDrawer.transitionCurtainDirection.horizontal')}</option>
                                <option value="vertical" ${preset.transitionCurtainDirection === 'vertical' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionCurtainDirection.vertical">${t('motionSettingsDrawer.transitionCurtainDirection.vertical')}</option>
                                <option value="diagonalRight" ${preset.transitionCurtainDirection === 'diagonalRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionCurtainDirection.diagonalRight">${t('motionSettingsDrawer.transitionCurtainDirection.diagonalRight')}</option>
                                <option value="diagonalLeft" ${preset.transitionCurtainDirection === 'diagonalLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionCurtainDirection.diagonalLeft">${t('motionSettingsDrawer.transitionCurtainDirection.diagonalLeft')}</option>
                                <option value="cornerTopLeft" ${preset.transitionCurtainDirection === 'cornerTopLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerTopLeft">${t('motionSettingsDrawer.transitionWipeDirection.cornerTopLeft')}</option>
                                <option value="cornerTopRight" ${preset.transitionCurtainDirection === 'cornerTopRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerTopRight">${t('motionSettingsDrawer.transitionWipeDirection.cornerTopRight')}</option>
                                <option value="cornerBottomLeft" ${preset.transitionCurtainDirection === 'cornerBottomLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerBottomLeft">${t('motionSettingsDrawer.transitionWipeDirection.cornerBottomLeft')}</option>
                                <option value="cornerBottomRight" ${preset.transitionCurtainDirection === 'cornerBottomRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.cornerBottomRight">${t('motionSettingsDrawer.transitionWipeDirection.cornerBottomRight')}</option>
                                <option value="random" ${preset.transitionCurtainDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.random">${t('motionSettingsDrawer.transitionDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-edge-flip-variant-row" class="flex justify-between items-center p-4 ${transitionIsEdgeFlip(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.edgeFlipVariant.label">${t('motionSettingsDrawer.edgeFlipVariant.label')}</span>
                            <select id="setting-motion-edge-flip-variant" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="open" ${preset.edgeFlipVariant === 'open' ? 'selected' : ''} data-i18n="motionSettingsDrawer.edgeFlipVariant.open">${t('motionSettingsDrawer.edgeFlipVariant.open')}</option>
                                <option value="close" ${preset.edgeFlipVariant === 'close' ? 'selected' : ''} data-i18n="motionSettingsDrawer.edgeFlipVariant.close">${t('motionSettingsDrawer.edgeFlipVariant.close')}</option>
                            </select>
                        </div>
                        <div id="motion-edge-flip-static-old-row" class="flex justify-between items-center p-4 ${(transitionIsEdgeFlip(preset.transitionType) && preset.edgeFlipVariant === 'close') ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.edgeFlipStaticOld.label">${t('motionSettingsDrawer.edgeFlipStaticOld.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-edge-flip-static-old" class="sr-only peer" ${preset.edgeFlipStaticOld ? 'checked' : ''}>
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDuration.label">${t('motionSettingsDrawer.transitionDuration.label')}</div>
                            </div>
                            <button type="button" id="setting-motion-transition-duration" class="rounded-lg px-3 py-1.5 text-xs outline-none w-20 text-right shrink-0" data-uitk="inputBg inputBorder inputText cardHoverBg">${(preset.transitionDurationMs / 1000).toFixed(1)}s</button>
                        </div>
                        <div id="motion-transition-ratio-row" class="p-4 ${transitionSupportsInOutRatio(preset.transitionType) ? '' : ' hidden'} border-b" data-uitk="dividerBorder cardHoverBg">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionRatio.label">${t('motionSettingsDrawer.transitionRatio.label')}</span>
                                <span id="motion-transition-ratio-label" class="text-xs font-mono" data-uitk="textSecondary"></span>
                            </div>
                            <input type="range" id="setting-motion-transition-ratio" min="0" max="100" step="5" value="${preset.transitionInOutRatio}" class="w-full" data-uitk="accentControl">
                        </div>
                        <div class="flex justify-between items-center p-4" data-uitk="cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionEasing.label">${t('motionSettingsDrawer.transitionEasing.label')}</span>
                            <select id="setting-motion-transition-easing" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="linear" ${preset.transitionEasing === 'linear' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionEasing.linear">${t('motionSettingsDrawer.transitionEasing.linear')}</option>
                                <option value="ease" ${preset.transitionEasing === 'ease' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionEasing.ease">${t('motionSettingsDrawer.transitionEasing.ease')}</option>
                                <option value="ease-in" ${preset.transitionEasing === 'ease-in' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionEasing.easeIn">${t('motionSettingsDrawer.transitionEasing.easeIn')}</option>
                                <option value="ease-out" ${preset.transitionEasing === 'ease-out' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionEasing.easeOut">${t('motionSettingsDrawer.transitionEasing.easeOut')}</option>
                                <option value="ease-in-out" ${preset.transitionEasing === 'ease-in-out' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionEasing.easeInOut">${t('motionSettingsDrawer.transitionEasing.easeInOut')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== NHÓM 2: POINT MOVE (thay Ken Burns) ===================== -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2 mt-4 flex items-center justify-between" data-uitk="accentText">
                        <span data-i18n="motionSettingsDrawer.groupPointMove.title">${t('motionSettingsDrawer.groupPointMove.title')}</span>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0 normal-case tracking-normal">
                            <input type="checkbox" id="setting-motion-pointmove-enabled" class="sr-only peer" ${preset.pointMoveEnabled ? 'checked' : ''}>
                            <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                        </label>
                    </h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <button type="button" id="btn-motion-pointmove-list" class="flex justify-between items-center p-4 w-full text-left border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.list.label">${t('motionSettingsDrawer.pointMove.list.label')}</span>
                            <span class="flex items-center gap-1.5 text-xs shrink-0" data-uitk="textSecondary">
                                ${tFormat('motionSettingsDrawer.pointMove.list.count', { n: preset.pointMoves.length })}
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </span>
                        </button>
                        <div class="flex justify-between items-center p-4${preset.pointMoveRunMode === 'one' ? ' border-b' : ''}" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.runMode.label">${t('motionSettingsDrawer.pointMove.runMode.label')}</span>
                            <select id="setting-motion-pointmove-runmode" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="all" ${preset.pointMoveRunMode === 'all' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.runMode.all">${t('motionSettingsDrawer.pointMove.runMode.all')}</option>
                                <option value="one" ${preset.pointMoveRunMode === 'one' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.runMode.one">${t('motionSettingsDrawer.pointMove.runMode.one')}</option>
                            </select>
                        </div>
                        <div id="motion-pointmove-order-row" class="flex justify-between items-center p-4 ${preset.pointMoveRunMode === 'one' ? '' : ' hidden'}" data-uitk="cardHoverBg">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.oneOrder.label">${t('motionSettingsDrawer.pointMove.oneOrder.label')}</span>
                            <select id="setting-motion-pointmove-order" class="rounded-lg px-2 py-1.5 text-xs outline-none w-32 text-right" data-uitk="inputBg inputBorder inputText">
                                <option value="sequential" ${preset.pointMoveOneOrder === 'sequential' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.oneOrder.sequential">${t('motionSettingsDrawer.pointMove.oneOrder.sequential')}</option>
                                <option value="random" ${preset.pointMoveOneOrder === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.oneOrder.random">${t('motionSettingsDrawer.pointMove.oneOrder.random')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== NHÓM 3: REACT BEAT AUDIO ===================== -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2 mt-4 flex items-center justify-between" data-uitk="accentText">
                        <span data-i18n="motionPresetsDrawer.beatReact.groupTitle">${t('motionPresetsDrawer.beatReact.groupTitle')}</span>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0 normal-case tracking-normal">
                            <input type="checkbox" id="setting-motion-beatreact-enabled" class="sr-only peer" ${preset.reactBeatAudio.enabled ? 'checked' : ''}>
                            <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                        </label>
                    </h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        ${renderMotionBeatReactEffectRows('zoom', preset.reactBeatAudio.zoom, {
                            titleKey: 'motionPresetsDrawer.beatReact.zoom.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.zoom.maxLabel',
                            boundMin: 100, boundMax: 200, step: 5, suffix: '%',
                            hasDirection: false,
                        })}
                        ${renderMotionBeatReactEffectRows('panX', preset.reactBeatAudio.panX, {
                            titleKey: 'motionPresetsDrawer.beatReact.panX.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.panX.maxLabel',
                            boundMin: 100, boundMax: 150, step: 5, suffix: '%',
                            hasDirection: true, directions: MOTION_SETTINGS_BEATREACT_DIRECTIONS_X,
                        })}
                        ${renderMotionBeatReactEffectRows('panY', preset.reactBeatAudio.panY, {
                            titleKey: 'motionPresetsDrawer.beatReact.panY.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.panY.maxLabel',
                            boundMin: 100, boundMax: 150, step: 5, suffix: '%',
                            hasDirection: true, directions: MOTION_SETTINGS_BEATREACT_DIRECTIONS_Y,
                        })}
                        ${renderMotionBeatReactEffectRows('rotate', preset.reactBeatAudio.rotate, {
                            titleKey: 'motionPresetsDrawer.beatReact.rotate.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.rotate.maxLabel',
                            boundMin: 0, boundMax: 360, step: 15, suffix: '°',
                            hasDirection: true, directions: MOTION_SETTINGS_BEATREACT_DIRECTIONS_X,
                            isLast: true,
                        })}
                    </div>
                </div>

                <!-- ===================== NHÓM 4: QUẢN LÝ ===================== -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2 mt-4" data-uitk="accentText" data-i18n="motionPresetsDrawer.edit.groupManage.title">${t('motionPresetsDrawer.edit.groupManage.title')}</h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium shrink-0 pr-3" data-i18n="motionPresetsDrawer.edit.nameLabel">${t('motionPresetsDrawer.edit.nameLabel')}</span>
                            <input type="text" id="setting-motion-name" value="${escapeHtml(preset.name)}" class="rounded-lg px-2 py-1.5 text-xs outline-none w-40 text-right" data-uitk="inputBg inputBorder inputText inputFocusBorder" placeholder="${t('motionPresetsDrawer.edit.namePlaceholder')}">
                        </div>
                        <button type="button" id="btn-motion-edit-reset" class="flex justify-between items-center p-4 w-full text-left border-b" data-uitk="dividerBorder cardHoverBg">
                            <span class="text-sm font-medium" data-uitk="textPrimary" data-i18n="motionPresetsDrawer.edit.reset.label">${t('motionPresetsDrawer.edit.reset.label')}</span>
                        </button>
                        <button type="button" id="btn-motion-edit-delete" class="flex justify-between items-center p-4 w-full text-left" data-uitk="cardHoverBg">
                            <span class="text-sm font-medium" data-uitk="destructiveText" data-i18n="motionPresetsDrawer.edit.delete.label">${t('motionPresetsDrawer.edit.delete.label')}</span>
                        </button>
                    </div>
                </div>

                <!-- ===================== NHÓM 5: ÁP DỤNG CHO — đăng ký nơi tiêu thụ ===================== -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2 mt-4" data-uitk="accentText" data-i18n="motionPresetsDrawer.apply.groupTitle">${t('motionPresetsDrawer.apply.groupTitle')}</h3>
                    <div class="rounded-2xl flex items-center gap-2 p-4" data-uitk="cardBg cardBorder">
                        <select id="setting-motion-apply-consumer" class="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs outline-none" data-uitk="inputBg inputBorder inputText">
                            ${MOTION_APPLY_CONSUMERS.map((c) => `<option value="${c.key}" ${c.key === consumerKey ? 'selected' : ''}>${t(c.labelKey)}</option>`).join('')}
                        </select>
                        <button type="button" id="btn-motion-apply-toggle" class="shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors ${isMotionApplySubscribed(motionApply, consumerKey, preset.id) ? 'bg-rose-500 hover:bg-rose-400' : 'bg-emerald-500 hover:bg-emerald-400'}">${t(isMotionApplySubscribed(motionApply, consumerKey, preset.id) ? 'motionPresetsDrawer.apply.unsubscribe.label' : 'motionPresetsDrawer.apply.subscribe.label')}</button>
                    </div>
                </div>
    `;
}

/** Danh sách point move — [kéo] | checkbox | tên | icon nhân bản | icon xoá | icon sửa. SỬA (phản
 * hồi Giang — "Point 0 = start point") — Point 0 (index 0) giờ KHÔNG BAO GIỜ kéo-thả/xoá được nữa
 * (start point CỐ ĐỊNH, `timingX` khoá cứng = 0 — xem core/motion-presets.js), CHỈ còn bấm SỬA được
 * (6 field chuyển động vẫn chỉnh bình thường) — bỏ hẳn tay cầm kéo + nút xoá LUÔN disabled ở hàng đó
 * (KHÔNG còn phụ thuộc `canDelete`/số lượng còn lại như các hàng khác). Checkbox vẫn khoá
 * (disabled, luôn checked) như trước.
 * MỚI (phản hồi Giang — dời "Endpoint: force baseline" (đổi tên "Return baseline") + "Timing" vào
 * ĐÂY, bỏ khỏi màn Edit chính) — 1 card nhỏ phía trên danh sách, CHỈ hiện khi `pointMoveRunMode ===
 * 'all'` (2 field này vốn chỉ có ý nghĩa với mode đó).
 * @param {object} preset - preset ĐANG sửa (cần `pointMoves`/`pointMoveEndForceBaseline`/`pointMoveRunMode`). */
function renderPointMoveListBody(preset) {
    const pointMoves = preset.pointMoves;
    const canDelete = pointMoves.length > 1;
    const topCardHtml = preset.pointMoveRunMode === 'all' ? `
        <div class="rounded-2xl flex flex-col overflow-hidden mb-3" data-uitk="cardBg cardBorder">
            <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.endForceBaseline.label">${t('motionSettingsDrawer.pointMove.endForceBaseline.label')}</span>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-motion-pointmove-end-force-baseline" class="sr-only peer" ${preset.pointMoveEndForceBaseline ? 'checked' : ''}>
                    <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                </label>
            </div>
            <button type="button" id="btn-motion-pointmove-timing" class="flex justify-between items-center p-4 w-full text-left" data-uitk="cardHoverBg">
                <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.timing.label">${t('motionSettingsDrawer.pointMove.timing.label')}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" data-uitk="textMutedIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </button>
        </div>
    ` : '';
    const itemsHtml = pointMoves.map((p, i) => `
        <div class="w-full px-2 py-2.5 rounded-2xl mb-2 flex items-center gap-1.5" data-uitk="cardBg cardBorder" data-ptmove-row="${escapeHtml(p.id)}">
            ${i === 0 ? `<span class="w-5 h-8 shrink-0"></span>` : `
            <span class="w-5 h-8 flex items-center justify-center shrink-0 cursor-grab touch-none" data-uitk="textMutedIcon" data-ptmove-drag-handle="${escapeHtml(p.id)}" title="${t('motionSettingsDrawer.pointMove.dragHandle.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="6" cy="5" r="1.4"/><circle cx="14" cy="5" r="1.4"/><circle cx="6" cy="10" r="1.4"/><circle cx="14" cy="10" r="1.4"/><circle cx="6" cy="15" r="1.4"/><circle cx="14" cy="15" r="1.4"/></svg>
            </span>`}
            <input type="checkbox" data-ptmove-checkbox="${escapeHtml(p.id)}" class="w-4 h-4 rounded shrink-0" data-uitk="accentControl" ${p.checked ? 'checked' : ''} ${i === 0 ? 'disabled' : ''}>
            <span class="flex-1 text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${tFormat('motionSettingsDrawer.pointMove.itemName', { n: i })}</span>
            <button type="button" data-ptmove-duplicate="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full shrink-0" data-uitk="iconBtnAccent" title="${t('motionSettingsDrawer.pointMove.duplicate.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button type="button" data-ptmove-delete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full shrink-0 disabled:opacity-30 disabled:pointer-events-none" data-uitk="iconBtnDestructive" ${(canDelete && i !== 0) ? '' : 'disabled'} title="${t('motionPresetsDrawer.list.delete.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button type="button" data-ptmove-edit="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full shrink-0" data-uitk="iconBtnAccent">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
        </div>
    `).join('');
    return topCardHtml + `<p class="text-xs mb-3 px-1" data-uitk="textSecondary">${t('motionSettingsDrawer.pointMove.dragHint')}</p>` + itemsHtml + `
        <button type="button" id="btn-ptmove-add" class="w-full text-center px-4 py-3.5 rounded-2xl text-sm font-semibold" data-uitk="btnAccentSoft accentSoftBorder">${t('motionSettingsDrawer.pointMove.add.label')}</button>
    `;
}

/** Dựng 1 field/point move ("-n 0 n" slider hoặc dual-range) — DÙNG CHUNG cho 6 field.
 * @param {string} key - 'linearX'|'linearY'|'rotate'|'zoom'|'flipX'|'flipY' (dùng làm phần ID).
 * @param {object} field - `pointMove[key]` — {mode, unit, single, rangeMin, rangeMax}.
 * @param {{titleKey:string, hasUnit:boolean, boundMin:number, boundMax:number, step:number, suffix:string, isLast?:boolean}} cfg
 */
function renderPointMoveFieldRows(key, field, cfg) {
    const borderClass = cfg.isLast ? '' : ' border-b'; // màu đường kẻ = key dividerBorder gắn ở thẻ dùng borderClass (data-uitk bên dưới)
    const isSingle = field.mode === 'single';
    const unitHtml = cfg.hasUnit ? `
                    <div class="flex gap-1.5">
                        <button type="button" data-ptmove-unit="${key}" data-value="%" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors" data-uitk="${field.unit === '%' ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText'}">%</button>
                        <button type="button" data-ptmove-unit="${key}" data-value="px" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors" data-uitk="${field.unit === 'px' ? 'btnPrimaryPillBg textOnAccent' : 'btnNeutralBg btnNeutralText'}">px</button>
                    </div>` : '';
    const singleHtml = `
                    <div class="ptmove-single-slider-wrap" id="ptmove-${key}-single-wrap" style="--ptmove-zero-pct: ${((0 - cfg.boundMin) / (cfg.boundMax - cfg.boundMin) * 100).toFixed(2)}%;${isSingle ? '' : ' display:none;'}">
                        <input type="range" id="setting-ptmove-${key}-single" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.single}" class="w-full" data-uitk="accentControl">
                    </div>`;
    const rangeHtml = `
                    <div class="ptmove-range-wrap" id="ptmove-${key}-range-wrap"${isSingle ? ' style="display:none"' : ''}>
                        <div class="ptmove-range-track"></div>
                        <div class="ptmove-range-fill" id="ptmove-${key}-range-fill"></div>
                        <input type="range" data-ptmove-range="min" data-suffix="${cfg.suffix}" id="setting-ptmove-${key}-rangemin" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.rangeMin}" class="ptmove-range-input">
                        <input type="range" data-ptmove-range="max" data-suffix="${cfg.suffix}" id="setting-ptmove-${key}-rangemax" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.rangeMax}" class="ptmove-range-input">
                    </div>`;
    // MỚI (phản hồi Giang — ô nhập số type=number sync 2 chiều với slider) — single mode: 1 ô; range
    // mode: 2 ô (min/max), cùng min/max/step với slider tương ứng (validate JS ở event/workflow/
    // app-settings.js — kẹp biên trước khi gửi qua eventBus).
    // MỚI LẦN 2 (phản hồi Giang — `inputmode="decimal"` fix được bàn phím full nhưng bàn phím decimal
    // của iOS KHÔNG có phím trừ, field cho phép âm (boundMin<0 — CẢ 6 field Point Move) không gõ được
    // số âm nữa) — thêm nút "±" nhỏ cạnh MỖI ô input thuộc field cho phép âm, bấm để ĐẢO DẤU giá trị
    // hiện tại (thay cho việc gõ dấu trừ bằng bàn phím) — CHỈ hiện khi `cfg.boundMin < 0` (field
    // React Beat max — zoom/panX/panY/rotate — toàn số dương, KHÔNG cần nút này).
    const signToggleBtnHtml = (inputId) => cfg.boundMin < 0 ? `<button type="button" data-ptmove-sign-toggle="${inputId}" class="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-sm font-bold" data-uitk="inputBg inputBorder inputText" title="${escapeHtml(t('motionSettingsDrawer.pointMove.signToggle.title'))}">±</button>` : '';
    const singleInputHtml = `
                    <div class="flex items-center gap-1${isSingle ? '' : ' hidden'}" id="ptmove-${key}-single-input-wrap">
                        ${signToggleBtnHtml(`ptmove-${key}-single-input`)}
                        <input type="number" inputmode="decimal" id="ptmove-${key}-single-input" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.single}" class="w-20 rounded-lg px-2 py-1 text-xs text-right outline-none" data-uitk="inputBg inputBorder inputText">
                    </div>`;
    const rangeInputHtml = `<div class="flex items-center gap-1${isSingle ? ' hidden' : ''}" id="ptmove-${key}-range-input-wrap">
                                    ${signToggleBtnHtml(`ptmove-${key}-rangemin-input`)}
                                    <input type="number" inputmode="decimal" id="ptmove-${key}-rangemin-input" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.rangeMin}" class="w-16 rounded-lg px-2 py-1 text-xs text-right outline-none" data-uitk="inputBg inputBorder inputText">
                                    <span class="text-xs" data-uitk="textMutedIcon">~</span>
                                    <input type="number" inputmode="decimal" id="ptmove-${key}-rangemax-input" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.rangeMax}" class="w-16 rounded-lg px-2 py-1 text-xs text-right outline-none" data-uitk="inputBg inputBorder inputText">
                                    ${signToggleBtnHtml(`ptmove-${key}-rangemax-input`)}
                                </div>`;
    return `
                        <div class="p-4${borderClass}"${cfg.isLast ? '' : ' data-uitk="dividerBorder"'}>
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-sm font-medium" data-i18n="${cfg.titleKey}">${t(cfg.titleKey)}</span>
                                <div class="flex items-center gap-2.5">
                                    ${unitHtml}
                                    <select data-ptmove-mode="${key}" class="rounded-lg px-2 py-1 text-xs outline-none" data-uitk="inputBg inputBorder inputText">
                                        <option value="single" ${isSingle ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.field.mode.single">${t('motionSettingsDrawer.pointMove.field.mode.single')}</option>
                                        <option value="randomRange" ${isSingle ? '' : 'selected'} data-i18n="motionSettingsDrawer.pointMove.field.mode.randomRange">${t('motionSettingsDrawer.pointMove.field.mode.randomRange')}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="flex justify-end mb-1.5">
                                ${singleInputHtml}
                                ${rangeInputHtml}
                            </div>
                            ${singleHtml}
                            ${rangeHtml}
                        </div>
    `;
}

/** Sửa 1 point move — 6 nhóm thông số. Linear X/Y CÓ toggle đơn vị %/px (biên đổi theo đơn vị,
 * xem core/motion-presets.js::MOTION_POINT_MOVE_BOUNDS); Rotate/Zoom/Flip X/Y KHÔNG có unit.
 * @param {object} pointMove */
function renderPointMoveEditBody(pointMove) {
    const linearBounds = pointMove.linearX.unit === 'px' ? { min: -1000, max: 1000, step: 10 } : { min: -200, max: 200, step: 5 };
    const linearYBounds = pointMove.linearY.unit === 'px' ? { min: -1000, max: 1000, step: 10 } : { min: -200, max: 200, step: 5 };
    return `
                <div>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        ${renderPointMoveFieldRows('linearX', pointMove.linearX, { titleKey: 'motionSettingsDrawer.pointMove.field.linearX', hasUnit: true, boundMin: linearBounds.min, boundMax: linearBounds.max, step: linearBounds.step, suffix: pointMove.linearX.unit })}
                        ${renderPointMoveFieldRows('linearY', pointMove.linearY, { titleKey: 'motionSettingsDrawer.pointMove.field.linearY', hasUnit: true, boundMin: linearYBounds.min, boundMax: linearYBounds.max, step: linearYBounds.step, suffix: pointMove.linearY.unit })}
                        ${renderPointMoveFieldRows('rotate', pointMove.rotate, { titleKey: 'motionSettingsDrawer.pointMove.field.rotate', hasUnit: false, boundMin: -360, boundMax: 360, step: 5, suffix: '°' })}
                        ${renderPointMoveFieldRows('zoom', pointMove.zoom, { titleKey: 'motionSettingsDrawer.pointMove.field.zoom', hasUnit: false, boundMin: -2, boundMax: 2, step: 0.05, suffix: '' })}
                        ${renderPointMoveFieldRows('flipX', pointMove.flipX, { titleKey: 'motionSettingsDrawer.pointMove.field.flipX', hasUnit: false, boundMin: -360, boundMax: 360, step: 5, suffix: '°' })}
                        ${renderPointMoveFieldRows('flipY', pointMove.flipY, { titleKey: 'motionSettingsDrawer.pointMove.field.flipY', hasUnit: false, boundMin: -360, boundMax: 360, step: 5, suffix: '°', isLast: true })}
                    </div>
                </div>
    `;
}

/** Khung chứa thanh Timing — SVG THẬT dựng bởi core/point-move-timing-ui.js, workflow tự append
 * vào `#ptmove-timing-container` sau khi `_render()` xong. CHỈ 1 TRỤC X (phản hồi Giang — "loại bỏ
 * toàn bộ timing Y") — kéo trực tiếp trên thanh để chỉnh gần đúng (2 nhãn sống "Point N" bám node +
 * "X: NN%" cố định góc trái trên tự hiện lúc ấn, core-ui tự lo — không cần gì thêm ở component này);
 * TAP (không kéo) vào 1 node mở modal nhập số chính xác, xem event/workflow/motion-presets.js::
 * openPointMoveTimingNodeModal(). 2 nút zoom +/- CHỈ đổi CSS `transform:scaleX()` cục bộ theo trục
 * thời gian (KHÔNG lưu, KHÔNG qua eventBus — thuần view, giãn khoảng cách giữa các node để đỡ bấm/
 * kéo nhầm, xem event/workflow/app-settings.js::_renderPointMoveTiming()).
 * @param {object[]} pointMoves - CHƯA dùng trực tiếp trong hàm này nữa (danh sách ô nhập số ĐÃ bỏ)
 *   — giữ tham số để chữ ký hàm ổn định, phòng cần lại sau này. */
function renderPointMoveTimingBody(pointMoves) {
    return `
        <p class="text-xs mb-2 px-1" data-uitk="textSecondary">${t('motionSettingsDrawer.pointMove.timing.hint')}</p>
        <div class="rounded-2xl p-2" data-uitk="cardBg cardBorder">
            <div id="ptmove-timing-scroll" class="ptmove-timing-scroll">
                <div id="ptmove-timing-container" class="ptmove-timing-zoomable"></div>
            </div>
            <div class="flex items-center justify-end gap-2 mt-1.5">
                <button type="button" id="btn-ptmove-timing-zoom-out" class="w-7 h-7 rounded-lg text-base font-bold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText">−</button>
                <span id="ptmove-timing-zoom-label" class="text-[11px] w-10 text-center" data-uitk="textSecondary">0%</span>
                <button type="button" id="btn-ptmove-timing-zoom-in" class="w-7 h-7 rounded-lg text-base font-bold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText">+</button>
            </div>
        </div>
    `;
}
