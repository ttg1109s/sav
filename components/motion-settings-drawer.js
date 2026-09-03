/**
 * Component: màn hình "Cấu hình Motion" — hệ PRESET độc lập, đặt tên/thêm/xoá được (CÙNG KHUÔN
 * hệ preset EQ — core/eq-presets.js/components/eq-presets-drawer.js). Visual Background (Photo)
 * chỉ là 1 trong các "nơi tiêu thụ" CÓ THỂ gắn 1 preset vào dùng — KHÔNG sở hữu/quản lý hệ preset
 * này. Lối vào DUY NHẤT: Settings > System > Motion.
 *
 * 7 màn (mỗi màn 1 hàm render, tất cả điều hướng qua workflowAppSettings.navigateTo(), xem
 * event/workflow/app-settings.js + event/workflow/motion-presets.js):
 *   1. `renderMotionMenuBody()` — 2 dòng: "Quản lý cấu hình" / "Áp dụng cấu hình".
 *   2. `renderMotionListBody(presets, pickMode)` — danh sách preset — DÙNG CHUNG cho CẢ "Quản lý"
 *      (tap = sửa, có nút xoá nhanh mỗi dòng) LẪN "Áp dụng > chọn" (tap = CHỌN gắn vào, không có nút
 *      xoá) — `pickMode` phân biệt 2 hành vi.
 *   3. `renderMotionEditBody(preset)` — sửa 1 preset: Transition (toggle riêng + type/duration/
 *      ratio/easing LUÔN hiện) + Point Move (danh sách điểm chuyển động — thay Ken Burns, xem
 *      core/motion-presets.js) + React Beat Audio + nhóm CUỐI "Quản lý" (đổi tên/Reset/Xoá).
 *   4. `renderPointMoveListBody(pointMoves)` — danh sách point move: checkbox | tên | xoá | sửa.
 *   5. `renderPointMoveEditBody(pointMove)` — sửa 6 thông số (Linear X/Y, Rotate, Zoom, Flip X/Y).
 *   6. `renderPointMoveTimingBody()` — khung chứa đường cong Timing (SVG dựng bởi
 *      core/point-move-timing-ui.js, workflow tự append vào #ptmove-timing-container).
 *   7. `renderMotionApplyListBody()` — 1 dòng "Photo visual background" + `renderMotionApplyDetailBody()`.
 *
 * Logic: event/workflow/motion-presets.js (workflowMotionPresets). Router/Listener: cụm
 * "motionPresets" (event/router/motion-presets.js).
 * NẠP SAU: core/modal-choice-ui.js (escapeHtml()), core/motion-engine.js/motion-presets.js,
 * components/settings/app-settings-main.js (renderAppSettingsRowList()).
 */

function renderMotionMenuBody() {
    const rows = [
        { key: 'motionManage', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', labelKey: 'motionPresetsDrawer.menu.manage.label', hintKey: 'motionPresetsDrawer.menu.manage.hint' },
        { key: 'motionApply', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', labelKey: 'motionPresetsDrawer.menu.apply.label', hintKey: 'motionPresetsDrawer.menu.apply.hint' },
    ];
    return renderAppSettingsRowList(rows); // components/settings/app-settings-main.js — data-app-settings-nav, tái dùng cơ chế chung
}

/** @param {{id:string, name:string}[]} presets @param {boolean} pickMode */
function renderMotionListBody(presets, pickMode) {
    const addRowHtml = pickMode ? '' : `
        <button type="button" id="btn-motion-list-add" class="w-full text-center px-4 py-3.5 rounded-2xl mb-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors text-sm font-semibold text-sky-600">${t('motionPresetsDrawer.list.add.label')}</button>
    `;
    if (presets.length === 0) {
        return addRowHtml + `<p class="text-sm text-slate-500 text-center py-10 px-6">${t(pickMode ? 'motionPresetsDrawer.list.emptyPick' : 'motionPresetsDrawer.list.emptyManage')}</p>`;
    }
    const itemsHtml = presets.map((p) => `
        <div data-motion-preset-tile="${escapeHtml(p.id)}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
            <span class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(p.name)}</span>
            ${pickMode ? `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            ` : `
            <button type="button" data-motion-preset-quickdelete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0" title="${t('motionPresetsDrawer.list.delete.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            `}
        </div>
    `).join('');
    return addRowHtml + itemsHtml;
}

/** Dựng 3 hàng (checkbox bật + [select hướng + checkbox reverse] + 1 slider max biên độ) cho 1
 * hiệu ứng con (zoom/pan/rotate) trong nhóm "React Beat Audio" — DÙNG CHUNG cả 3.
 * @param {'zoom'|'pan'|'rotate'} key @param {object} effect - `preset.reactBeatAudio[key]`.
 * @param {{titleKey:string, maxLabelKey:string, boundMin:number, boundMax:number, step:number, suffix:string, hasDirection:boolean, isLast?:boolean}} cfg
 */
function renderMotionBeatReactEffectRows(key, effect, cfg) {
    const isDeg = key === 'rotate';
    const maxVal = isDeg ? effect.maxDeg : effect.maxPct;
    const borderClass = cfg.isLast ? '' : ' border-b border-white/5';
    const directionHtml = cfg.hasDirection ? `
                        <div class="flex justify-between items-center px-4 pb-3">
                            <span class="text-xs text-slate-400" data-i18n="motionPresetsDrawer.beatReact.direction.label">${t('motionPresetsDrawer.beatReact.direction.label')}</span>
                            <select id="setting-motion-beatreact-${key}-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none w-36 text-right">
                                <option value="left" ${effect.direction === 'left' ? 'selected' : ''} data-i18n="motionPresetsDrawer.beatReact.direction.left">${t('motionPresetsDrawer.beatReact.direction.left')}</option>
                                <option value="right" ${effect.direction === 'right' ? 'selected' : ''} data-i18n="motionPresetsDrawer.beatReact.direction.right">${t('motionPresetsDrawer.beatReact.direction.right')}</option>
                                <option value="leftToRight" ${effect.direction === 'leftToRight' ? 'selected' : ''} data-i18n="motionPresetsDrawer.beatReact.direction.leftToRight">${t('motionPresetsDrawer.beatReact.direction.leftToRight')}</option>
                                <option value="rightToLeft" ${effect.direction === 'rightToLeft' ? 'selected' : ''} data-i18n="motionPresetsDrawer.beatReact.direction.rightToLeft">${t('motionPresetsDrawer.beatReact.direction.rightToLeft')}</option>
                            </select>
                        </div>
                        <label class="flex items-center gap-2.5 px-4 pb-3 cursor-pointer">
                            <input type="checkbox" id="setting-motion-beatreact-${key}-reverse" class="w-4 h-4 rounded accent-sky-500 shrink-0" ${effect.reverse ? 'checked' : ''}>
                            <span class="text-xs text-slate-400" data-i18n="motionPresetsDrawer.beatReact.reverse.label">${t('motionPresetsDrawer.beatReact.reverse.label')}</span>
                        </label>` : '';
    return `
                        <div class="p-4${borderClass}">
                            <label class="flex items-center gap-2.5 mb-3 cursor-pointer">
                                <input type="checkbox" id="setting-motion-beatreact-${key}-enabled" class="w-4 h-4 rounded accent-sky-500 shrink-0" ${effect.enabled ? 'checked' : ''}>
                                <span class="text-sm font-medium" data-i18n="${cfg.titleKey}">${t(cfg.titleKey)}</span>
                            </label>
                            ${directionHtml}
                            <div class="flex justify-between items-center mb-1.5">
                                <span class="text-xs text-slate-400" data-i18n="${cfg.maxLabelKey}">${t(cfg.maxLabelKey)}</span>
                                <span id="motion-beatreact-${key}-max-label" class="text-xs text-slate-300 font-mono">${maxVal}${cfg.suffix}</span>
                            </div>
                            <input type="range" id="setting-motion-beatreact-${key}-max" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${maxVal}" class="w-full accent-sky-500">
                        </div>
    `;
}

/** @param {object} preset - 1 phần tử `appState.motionPresets` (core/motion-presets.js). */
function renderMotionEditBody(preset) {
    return `
                <!-- ===================== NHÓM 1: CHUYỂN CẢNH ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="motionSettingsDrawer.groupTransition.title">${t('motionSettingsDrawer.groupTransition.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionEnabled.label">${t('motionSettingsDrawer.transitionEnabled.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-transition-enabled" class="sr-only peer" ${preset.transitionEnabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transition.label">${t('motionSettingsDrawer.transition.label')}</span>
                            <select id="setting-motion-transition" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
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
                        <div id="motion-transition-direction-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsDirection(preset.transitionType) ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDirection.label">${t('motionSettingsDrawer.transitionDirection.label')}</span>
                            <select id="setting-motion-transition-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="left" ${preset.transitionDirection === 'left' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.left">${t('motionSettingsDrawer.transitionDirection.left')}</option>
                                <option value="right" ${preset.transitionDirection === 'right' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.right">${t('motionSettingsDrawer.transitionDirection.right')}</option>
                                <option value="up" ${preset.transitionDirection === 'up' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.up">${t('motionSettingsDrawer.transitionDirection.up')}</option>
                                <option value="down" ${preset.transitionDirection === 'down' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.down">${t('motionSettingsDrawer.transitionDirection.down')}</option>
                                <option value="random" ${preset.transitionDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionDirection.random">${t('motionSettingsDrawer.transitionDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-zoom-direction-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsZoomDirection(preset.transitionType) ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionZoomDirection.label">${t('motionSettingsDrawer.transitionZoomDirection.label')}</span>
                            <select id="setting-motion-transition-zoom-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="in" ${preset.transitionZoomDirection === 'in' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionZoomDirection.in">${t('motionSettingsDrawer.transitionZoomDirection.in')}</option>
                                <option value="out" ${preset.transitionZoomDirection === 'out' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionZoomDirection.out">${t('motionSettingsDrawer.transitionZoomDirection.out')}</option>
                                <option value="random" ${preset.transitionZoomDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionZoomDirection.random">${t('motionSettingsDrawer.transitionZoomDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-spin-direction-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsSpinDirection(preset.transitionType) ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionSpinDirection.label">${t('motionSettingsDrawer.transitionSpinDirection.label')}</span>
                            <select id="setting-motion-transition-spin-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="clockwise" ${preset.transitionSpinDirection === 'clockwise' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionSpinDirection.clockwise">${t('motionSettingsDrawer.transitionSpinDirection.clockwise')}</option>
                                <option value="counterclockwise" ${preset.transitionSpinDirection === 'counterclockwise' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionSpinDirection.counterclockwise">${t('motionSettingsDrawer.transitionSpinDirection.counterclockwise')}</option>
                                <option value="random" ${preset.transitionSpinDirection === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionSpinDirection.random">${t('motionSettingsDrawer.transitionSpinDirection.random')}</option>
                            </select>
                        </div>
                        <div id="motion-transition-wipe-direction-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsWipeDirection(preset.transitionType) ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDirection.label">${t('motionSettingsDrawer.transitionDirection.label')}</span>
                            <select id="setting-motion-transition-wipe-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
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
                        <div id="motion-transition-curtain-direction-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsCurtainDirection(preset.transitionType) ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDirection.label">${t('motionSettingsDrawer.transitionDirection.label')}</span>
                            <select id="setting-motion-transition-curtain-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
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
                        <div id="motion-edge-flip-variant-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionIsEdgeFlip(preset.transitionType) ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.edgeFlipVariant.label">${t('motionSettingsDrawer.edgeFlipVariant.label')}</span>
                            <select id="setting-motion-edge-flip-variant" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="open" ${preset.edgeFlipVariant === 'open' ? 'selected' : ''} data-i18n="motionSettingsDrawer.edgeFlipVariant.open">${t('motionSettingsDrawer.edgeFlipVariant.open')}</option>
                                <option value="close" ${preset.edgeFlipVariant === 'close' ? 'selected' : ''} data-i18n="motionSettingsDrawer.edgeFlipVariant.close">${t('motionSettingsDrawer.edgeFlipVariant.close')}</option>
                            </select>
                        </div>
                        <div id="motion-edge-flip-static-old-row" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors${(transitionIsEdgeFlip(preset.transitionType) && preset.edgeFlipVariant === 'close') ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.edgeFlipStaticOld.label">${t('motionSettingsDrawer.edgeFlipStaticOld.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-edge-flip-static-old" class="sr-only peer" ${preset.edgeFlipStaticOld ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionDuration.label">${t('motionSettingsDrawer.transitionDuration.label')}</div>
                            </div>
                            <button type="button" id="setting-motion-transition-duration" class="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-20 text-right shrink-0 hover:bg-white/10 transition-colors">${(preset.transitionDurationMs / 1000).toFixed(1)}s</button>
                        </div>
                        <div id="motion-transition-ratio-row" class="p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsInOutRatio(preset.transitionType) ? '' : ' hidden'}">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionRatio.label">${t('motionSettingsDrawer.transitionRatio.label')}</span>
                                <span id="motion-transition-ratio-label" class="text-xs text-slate-400 font-mono"></span>
                            </div>
                            <input type="range" id="setting-motion-transition-ratio" min="0" max="100" step="5" value="${preset.transitionInOutRatio}" class="w-full accent-sky-500">
                        </div>
                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.transitionEasing.label">${t('motionSettingsDrawer.transitionEasing.label')}</span>
                            <select id="setting-motion-transition-easing" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
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
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="motionSettingsDrawer.groupPointMove.title">${t('motionSettingsDrawer.groupPointMove.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.enabled.label">${t('motionSettingsDrawer.pointMove.enabled.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-pointmove-enabled" class="sr-only peer" ${preset.pointMoveEnabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <button type="button" id="btn-motion-pointmove-list" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.list.label">${t('motionSettingsDrawer.pointMove.list.label')}</span>
                            <span class="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                                ${tFormat('motionSettingsDrawer.pointMove.list.count', { n: preset.pointMoves.length })}
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                            </span>
                        </button>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.runMode.label">${t('motionSettingsDrawer.pointMove.runMode.label')}</span>
                            <select id="setting-motion-pointmove-runmode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="all" ${preset.pointMoveRunMode === 'all' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.runMode.all">${t('motionSettingsDrawer.pointMove.runMode.all')}</option>
                                <option value="one" ${preset.pointMoveRunMode === 'one' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.runMode.one">${t('motionSettingsDrawer.pointMove.runMode.one')}</option>
                            </select>
                        </div>
                        <div id="motion-pointmove-order-row" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors${preset.pointMoveRunMode === 'one' ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.oneOrder.label">${t('motionSettingsDrawer.pointMove.oneOrder.label')}</span>
                            <select id="setting-motion-pointmove-order" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="sequential" ${preset.pointMoveOneOrder === 'sequential' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.oneOrder.sequential">${t('motionSettingsDrawer.pointMove.oneOrder.sequential')}</option>
                                <option value="random" ${preset.pointMoveOneOrder === 'random' ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.oneOrder.random">${t('motionSettingsDrawer.pointMove.oneOrder.random')}</option>
                            </select>
                        </div>
                        <button type="button" id="btn-motion-pointmove-timing" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left${preset.pointMoveRunMode === 'all' ? '' : ' hidden'}">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.pointMove.timing.label">${t('motionSettingsDrawer.pointMove.timing.label')}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>

                <!-- ===================== NHÓM 3: REACT BEAT AUDIO ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="motionPresetsDrawer.beatReact.groupTitle">${t('motionPresetsDrawer.beatReact.groupTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionPresetsDrawer.beatReact.enabled.label">${t('motionPresetsDrawer.beatReact.enabled.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-beatreact-enabled" class="sr-only peer" ${preset.reactBeatAudio.enabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>

                        ${renderMotionBeatReactEffectRows('zoom', preset.reactBeatAudio.zoom, {
                            titleKey: 'motionPresetsDrawer.beatReact.zoom.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.zoom.maxLabel',
                            boundMin: 100, boundMax: 200, step: 5, suffix: '%',
                            hasDirection: false,
                        })}
                        ${renderMotionBeatReactEffectRows('pan', preset.reactBeatAudio.pan, {
                            titleKey: 'motionPresetsDrawer.beatReact.pan.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.pan.maxLabel',
                            boundMin: 100, boundMax: 150, step: 5, suffix: '%',
                            hasDirection: true,
                        })}
                        ${renderMotionBeatReactEffectRows('rotate', preset.reactBeatAudio.rotate, {
                            titleKey: 'motionPresetsDrawer.beatReact.rotate.title',
                            maxLabelKey: 'motionPresetsDrawer.beatReact.rotate.maxLabel',
                            boundMin: 0, boundMax: 360, step: 15, suffix: '°',
                            hasDirection: true,
                            isLast: true,
                        })}
                    </div>
                </div>

                <!-- ===================== NHÓM 4: QUẢN LÝ ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="motionPresetsDrawer.edit.groupManage.title">${t('motionPresetsDrawer.edit.groupManage.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium shrink-0 pr-3" data-i18n="motionPresetsDrawer.edit.nameLabel">${t('motionPresetsDrawer.edit.nameLabel')}</span>
                            <input type="text" id="setting-motion-name" value="${escapeHtml(preset.name)}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right focus:border-sky-400" placeholder="${t('motionPresetsDrawer.edit.namePlaceholder')}">
                        </div>
                        <button type="button" id="btn-motion-edit-reset" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                            <span class="text-sm font-medium text-slate-300" data-i18n="motionPresetsDrawer.edit.reset.label">${t('motionPresetsDrawer.edit.reset.label')}</span>
                        </button>
                        <button type="button" id="btn-motion-edit-delete" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                            <span class="text-sm font-medium text-rose-400" data-i18n="motionPresetsDrawer.edit.delete.label">${t('motionPresetsDrawer.edit.delete.label')}</span>
                        </button>
                    </div>
                </div>
    `;
}

/** Danh sách point move — checkbox | tên | icon xoá | icon sửa. Point move VỊ TRÍ ĐẦU (index 0)
 * checkbox khoá (disabled, luôn checked) — xem core/motion-presets.js::sanitizeMotionPointMoves().
 * Nút xoá disabled khi CHỈ CÒN 1 point move (luôn phải giữ ít nhất 1).
 * @param {object[]} pointMoves */
function renderPointMoveListBody(pointMoves) {
    const canDelete = pointMoves.length > 1;
    const itemsHtml = pointMoves.map((p, i) => `
        <div class="w-full px-3 py-2.5 rounded-2xl mb-2 flex items-center gap-2 bg-slate-50 border border-slate-200">
            <input type="checkbox" data-ptmove-checkbox="${escapeHtml(p.id)}" class="w-4 h-4 rounded accent-sky-500 shrink-0" ${p.checked ? 'checked' : ''} ${i === 0 ? 'disabled' : ''}>
            <span class="flex-1 text-sm font-semibold text-slate-700 truncate">${tFormat('motionSettingsDrawer.pointMove.itemName', { n: i })}</span>
            <button type="button" data-ptmove-delete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-30 disabled:pointer-events-none" ${canDelete ? '' : 'disabled'} title="${t('motionPresetsDrawer.list.delete.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button type="button" data-ptmove-edit="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-colors shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
        </div>
    `).join('');
    return itemsHtml + `
        <button type="button" id="btn-ptmove-add" class="w-full text-center px-4 py-3.5 rounded-2xl bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors text-sm font-semibold text-sky-600">${t('motionSettingsDrawer.pointMove.add.label')}</button>
    `;
}

/** Dựng 1 field/point move ("-n 0 n" slider hoặc dual-range) — DÙNG CHUNG cho 6 field.
 * @param {string} key - 'linearX'|'linearY'|'rotate'|'zoom'|'flipX'|'flipY' (dùng làm phần ID).
 * @param {object} field - `pointMove[key]` — {mode, unit, single, rangeMin, rangeMax}.
 * @param {{titleKey:string, hasUnit:boolean, boundMin:number, boundMax:number, step:number, suffix:string, isLast?:boolean}} cfg
 */
function renderPointMoveFieldRows(key, field, cfg) {
    const borderClass = cfg.isLast ? '' : ' border-b border-white/5';
    const isSingle = field.mode === 'single';
    const unitHtml = cfg.hasUnit ? `
                    <div class="flex gap-1.5">
                        <button type="button" data-ptmove-unit="${key}" data-value="%" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${field.unit === '%' ? 'bg-sky-500 text-white' : 'bg-black/40 text-slate-400'}">%</button>
                        <button type="button" data-ptmove-unit="${key}" data-value="px" class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${field.unit === 'px' ? 'bg-sky-500 text-white' : 'bg-black/40 text-slate-400'}">px</button>
                    </div>` : '';
    const singleHtml = `
                    <div class="ptmove-single-slider-wrap" id="ptmove-${key}-single-wrap" style="--ptmove-zero-pct: ${((0 - cfg.boundMin) / (cfg.boundMax - cfg.boundMin) * 100).toFixed(2)}%;${isSingle ? '' : ' display:none;'}">
                        <input type="range" id="setting-ptmove-${key}-single" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.single}" class="w-full accent-sky-500">
                    </div>`;
    const rangeHtml = `
                    <div class="ptmove-range-wrap" id="ptmove-${key}-range-wrap"${isSingle ? ' style="display:none"' : ''}>
                        <div class="ptmove-range-track"></div>
                        <div class="ptmove-range-fill" id="ptmove-${key}-range-fill"></div>
                        <input type="range" data-ptmove-range="min" data-suffix="${cfg.suffix}" id="setting-ptmove-${key}-rangemin" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.rangeMin}" class="ptmove-range-input">
                        <input type="range" data-ptmove-range="max" data-suffix="${cfg.suffix}" id="setting-ptmove-${key}-rangemax" min="${cfg.boundMin}" max="${cfg.boundMax}" step="${cfg.step}" value="${field.rangeMax}" class="ptmove-range-input">
                    </div>`;
    return `
                        <div class="p-4${borderClass}">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-sm font-medium" data-i18n="${cfg.titleKey}">${t(cfg.titleKey)}</span>
                                <div class="flex items-center gap-2.5">
                                    ${unitHtml}
                                    <select data-ptmove-mode="${key}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none">
                                        <option value="single" ${isSingle ? 'selected' : ''} data-i18n="motionSettingsDrawer.pointMove.field.mode.single">${t('motionSettingsDrawer.pointMove.field.mode.single')}</option>
                                        <option value="randomRange" ${isSingle ? '' : 'selected'} data-i18n="motionSettingsDrawer.pointMove.field.mode.randomRange">${t('motionSettingsDrawer.pointMove.field.mode.randomRange')}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="flex justify-end mb-1.5">
                                <span id="ptmove-${key}-value-label" class="text-xs text-slate-300 font-mono">${isSingle ? `${field.single}${cfg.suffix}` : `${field.rangeMin}${cfg.suffix} ~ ${field.rangeMax}${cfg.suffix}`}</span>
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
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
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

/** Khung chứa đường cong Timing — SVG THẬT dựng bởi core/point-move-timing-ui.js, workflow tự
 * append vào `#ptmove-timing-container` sau khi `_render()` xong. Kèm danh sách ô nhập số
 * timingX/timingY cho TỪNG point move ĐÃ TICK (bật/tắt point move không xử lý ở màn này — dùng
 * công tắc tổng `pointMoveEnabled` ở màn Edit, hoặc checkbox từng điểm ở màn Danh sách) — kéo trên
 * SVG và gõ số ở đây ĐỒNG BỘ 2 CHIỀU (xem event/workflow/motion-presets.js::_patchTimingPreview()).
 * KHÔNG còn field nào bị khoá X — point move #0 kéo/nhập tự do như mọi điểm khác (phản hồi Giang).
 * @param {object[]} pointMoves - MẢNG ĐẦY ĐỦ (không lọc trước) — cần index gốc để đặt tên "Point
 *   move N" khớp với màn Danh sách; phần tử chưa tick tự bị bỏ qua khi render. */
function renderPointMoveTimingBody(pointMoves) {
    const rowsHtml = pointMoves.map((p, i) => {
        if (!p.checked) return '';
        return `
            <div class="flex items-center gap-2 py-2.5 border-b border-white/5 last:border-0" data-ptmove-timing-row="${escapeHtml(p.id)}">
                <span class="text-xs text-slate-400 w-24 shrink-0 truncate">${tFormat('motionSettingsDrawer.pointMove.itemName', { n: i })}</span>
                <div class="flex items-center gap-1">
                    <input type="number" data-ptmove-timing-field="timingX" min="0" max="100" step="1" value="${p.timingX}" class="w-14 bg-black/50 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white outline-none text-right">
                    <span class="text-[10px] text-slate-500">%</span>
                </div>
                <div class="flex items-center gap-1">
                    <input type="number" data-ptmove-timing-field="timingY" min="-150" max="150" step="1" value="${p.timingY}" class="w-14 bg-black/50 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white outline-none text-right">
                </div>
            </div>`;
    }).join('');
    return `
        <p class="text-xs text-slate-400 mb-3 px-1">${t('motionSettingsDrawer.pointMove.timing.hint')}</p>
        <div class="glass-modal rounded-2xl p-4 mb-4">
            <div id="ptmove-timing-container"></div>
        </div>
        <div class="glass-modal rounded-2xl px-4">
            <div class="flex items-center gap-2 py-2 text-[10px] uppercase tracking-wide text-slate-500 border-b border-white/5">
                <span class="w-24 shrink-0"></span>
                <span class="w-[52px]">${t('motionSettingsDrawer.pointMove.timing.xLabel')}</span>
                <span>${t('motionSettingsDrawer.pointMove.timing.yLabel')}</span>
            </div>
            ${rowsHtml}
        </div>
    `;
}

/** Màn "Áp dụng cấu hình" — danh sách "nơi tiêu thụ". Tạm thời DUY NHẤT 1 dòng "Photo visual
 * background". Hint hiện tên preset đang gắn (hoặc "Chưa gắn").
 * @param {string} attachedName */
function renderMotionApplyListBody(attachedName) {
    const hint = attachedName || t('motionPresetsDrawer.apply.notAttached');
    return `
        <button type="button" data-app-settings-nav="motionApplyPhotoVisualBg" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
            <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-700 truncate">${t('motionPresetsDrawer.apply.photoVisualBg.label')}</div>
                <div class="text-xs text-slate-400 mt-0.5 truncate">${escapeHtml(hint)}</div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `;
}

/** Chi tiết 1 nơi tiêu thụ (hiện chỉ "Photo visual background") — tên preset đang gắn bên trái + nút
 * "Gỡ" (chỉ hiện khi ĐÃ gắn), cùng nút mở lại danh sách preset ở chế độ CHỌN.
 * @param {string} attachedName - '' nếu chưa gắn. */
function renderMotionApplyDetailBody(attachedName) {
    return `
        <div class="glass-modal rounded-2xl flex flex-col overflow-hidden mb-4">
            <div class="flex justify-between items-center gap-3 p-4">
                <div class="min-w-0">
                    <div class="text-xs text-slate-400 mb-0.5" data-i18n="motionPresetsDrawer.apply.currentLabel">${t('motionPresetsDrawer.apply.currentLabel')}</div>
                    <div class="text-sm font-semibold truncate">${escapeHtml(attachedName || t('motionPresetsDrawer.apply.notAttached'))}</div>
                </div>
                ${attachedName ? `
                <button type="button" id="btn-motion-apply-detach" class="text-xs font-semibold text-rose-400 px-2 shrink-0 hover:text-rose-300">${t('motionPresetsDrawer.apply.detach.label')}</button>
                ` : ''}
            </div>
        </div>
        <button type="button" id="btn-motion-apply-pick" class="w-full text-center py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors">${t('motionPresetsDrawer.apply.pickButton')}</button>
    `;
}
