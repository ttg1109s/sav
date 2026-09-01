/**
 * Component: màn hình "Cấu hình Motion" — VIẾT LẠI TOÀN BỘ (29/08/2026, phản hồi Giang — Motion
 * KHÔNG còn là 1 cấu hình DUY NHẤT nhúng trong Visual Background, mà là hệ PRESET độc lập, đặt tên/
 * thêm/xoá được (CÙNG KHUÔN hệ preset EQ — core/eq-presets.js/components/eq-presets-drawer.js, chỉ
 * đổi field). Visual Background (Photo) chỉ là 1 trong các "nơi tiêu thụ" CÓ THỂ gắn 1 preset vào
 * dùng — KHÔNG sở hữu/quản lý hệ preset này. Lối vào DUY NHẤT: Settings > System > Motion.
 *
 * 4 màn (mỗi màn 1 hàm render, tất cả điều hướng qua workflowAppSettings.navigateTo(), xem
 * event/workflow/app-settings.js + event/workflow/motion-presets.js):
 *   1. `renderMotionMenuBody()` — 2 dòng: "Quản lý cấu hình" / "Áp dụng cấu hình".
 *   2. `renderMotionListBody(presets, pickMode)` — danh sách preset — DÙNG CHUNG cho CẢ "Quản lý"
 *      (tap = sửa, có nút xoá nhanh mỗi dòng) LẪN "Áp dụng > chọn" (tap = CHỌN gắn vào, không có nút
 *      xoá) — `pickMode` phân biệt 2 hành vi.
 *   3. `renderMotionEditBody(preset)` — sửa 1 preset: Transition (toggle riêng + type/duration/
 *      ratio/easing LUÔN hiện, KHÔNG ẩn theo toggle nữa — Giang chốt) + Ken Burns (toggle + mode
 *      LUÔN hiện, cùng lý do — tên nhóm về lại "Ken Burns", KHÔNG còn "Photo Movement") + nhóm CUỐI
 *      "Quản lý" (MỚI 29/08/2026, phản hồi Giang — dời Reset/Xoá xuống thành 2 hàng cuối, CÙNG nhóm
 *      với đổi tên — KHÔNG còn 2 nút text nhỏ ở header, KHÔNG còn nút "+" icon nào — "Thêm cấu hình
 *      mới" cũng đã dời xuống thành 1 hàng chữ thuần đầu danh sách, xem `renderMotionListBody()`).
 *      Tên preset là 1 input trong nhóm CUỐI đó, tự lưu lúc blur (KHÔNG cần nút "Cập nhật" riêng —
 *      mọi field khác trong app đều tự lưu ngay lúc đổi, tên cũng vậy cho nhất quán).
 *   4. `renderMotionApplyListBody()` — 1 dòng "Photo visual background" (tạm thời DUY NHẤT nơi
 *      tiêu thụ) + `renderMotionApplyDetailBody(presetName)` — tên preset đang gắn bên trái + nút
 *      "Gỡ", cùng nút "Chọn cấu hình khác" mở lại `renderMotionListBody(..., true)`.
 *
 * Logic: event/workflow/motion-presets.js (workflowMotionPresets). Router/Listener: cụm
 * "motionPresets" (event/router,listener/motion-presets.js).
 * NẠP SAU: core/modal-choice-ui.js (dùng chung escapeHtml()), core/file-manager/motion.js
 * (transitionSupportsInOutRatio()), components/settings/app-settings-main.js (renderAppSettingsRowList()).
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
    // SỬA (29/08/2026, phản hồi Giang — "bỏ dấu +") — hàng "Thêm cấu hình mới" dời từ nút icon "+"
    // ở header (đã bỏ hẳn) xuống thành 1 hàng CUỐI danh sách, chữ thuần, không icon — CHỈ hiện khi
    // KHÔNG phải pickMode (Áp dụng > Chọn chỉ được CHỌN trong preset có sẵn, không tạo mới từ đó).
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

/** Dựng 3 hàng (checkbox bật + [select hướng [+ checkbox reverse]] + 1 slider max biên độ) cho 1
 * hiệu ứng con (zoom/pan/rotate) trong nhóm "React Beat Audio" — DÙNG CHUNG cả 3, tránh lặp HTML
 * gần giống nhau 3 lần (chỉ khác: có/không select hướng, biên/step/hậu tố, tên field). VIẾT LẠI
 * (30/08/2026, phản hồi Giang mục 1/2 — bỏ hẳn slider "mỗi N beat"); SỬA LẠI NGAY sau đó (phản hồi
 * Giang — "min là cố định cứng, không phải tuỳ chọn") — CHỈ 1 slider `max` DUY NHẤT (100-200/100-150/
 * 0-360), biên dưới (baseline) CỐ ĐỊNH CỨNG trong công thức nội suy, KHÔNG phải field/slider nào ở
 * đây, xem core/motion-engine.js::computeMotionEngineBeatReactZoomScale()/computeMotionEngineBeatReactOffset().
 * BỔ SUNG (30/08/2026, phản hồi Giang — checkbox "reverse") — thêm 1 checkbox NGAY dưới select hướng
 * (CHỈ hiện khi `hasDirection`, tức pan/rotate — zoom không có direction nên không có reverse) — chỉ
 * thật sự có tác dụng khi hướng đang chọn là "leftToRight"/"rightToLeft" (đảo cực lượt beat ĐẦU TIÊN,
 * xem core/motion-engine.js::computeMotionEngineBeatReactNextPolarity()), nhưng vẫn LUÔN hiện (KHÔNG
 * ẩn/hiện động theo select hướng đang chọn) — cùng quy ước "field chi tiết luôn hiện, không ẩn theo
 * điều kiện khác" đã áp cho cả nhóm React Beat Audio từ đầu.
 * @param {'zoom'|'pan'|'rotate'} key - dùng làm phần ID (`setting-motion-beatreact-${key}-*`).
 * @param {object} effect - `preset.reactBeatAudio[key]` — {enabled, maxPct|maxDeg, direction?, reverse?}.
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
                        <!-- MỚI (29/08/2026, Giang chốt) — toggle "Có áp dụng Transition hay không",
                             ĐỘC LẬP với việc chọn hiệu ứng (select ngay dưới LUÔN hiện, kể cả tắt). -->
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
                                <option value="topLeft" ${preset.transitionWipeDirection === 'topLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.topLeft">${t('motionSettingsDrawer.transitionWipeDirection.topLeft')}</option>
                                <option value="topRight" ${preset.transitionWipeDirection === 'topRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.topRight">${t('motionSettingsDrawer.transitionWipeDirection.topRight')}</option>
                                <option value="bottomLeft" ${preset.transitionWipeDirection === 'bottomLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.bottomLeft">${t('motionSettingsDrawer.transitionWipeDirection.bottomLeft')}</option>
                                <option value="bottomRight" ${preset.transitionWipeDirection === 'bottomRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.bottomRight">${t('motionSettingsDrawer.transitionWipeDirection.bottomRight')}</option>
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
                                <option value="topLeft" ${preset.transitionCurtainDirection === 'topLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.topLeft">${t('motionSettingsDrawer.transitionWipeDirection.topLeft')}</option>
                                <option value="topRight" ${preset.transitionCurtainDirection === 'topRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.topRight">${t('motionSettingsDrawer.transitionWipeDirection.topRight')}</option>
                                <option value="bottomLeft" ${preset.transitionCurtainDirection === 'bottomLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.bottomLeft">${t('motionSettingsDrawer.transitionWipeDirection.bottomLeft')}</option>
                                <option value="bottomRight" ${preset.transitionCurtainDirection === 'bottomRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.transitionWipeDirection.bottomRight">${t('motionSettingsDrawer.transitionWipeDirection.bottomRight')}</option>
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

                <!-- ===================== NHÓM 2: KEN BURNS ===================== -->
                <!-- SỬA (29/08/2026, Giang chốt "chuyển về lại thành Ken Burns") — tên nhóm về lại
                     "Ken Burns" (thay "Photo Movement"), select mode LUÔN hiện — bỏ hẳn ẩn/hiện theo
                     toggle (KHÁC bản cũ tự toggle class "hidden" trên #motion-kenburns-mode-row). -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="motionSettingsDrawer.groupKenBurns.title">${t('motionSettingsDrawer.groupKenBurns.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.kenBurns.label">${t('motionSettingsDrawer.kenBurns.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-kenburns" class="sr-only peer" ${preset.kenBurnsEnabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <span class="text-sm font-medium" data-i18n="motionSettingsDrawer.kenBurnsMode.label">${t('motionSettingsDrawer.kenBurnsMode.label')}</span>
                            <select id="setting-motion-kenburns-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <optgroup label="${t('motionSettingsDrawer.kenBurnsMode.groupPan')}">
                                    <option value="panLeft" ${preset.kenBurnsMode === 'panLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.panLeft">${t('motionSettingsDrawer.kenBurnsMode.panLeft')}</option>
                                    <option value="panRight" ${preset.kenBurnsMode === 'panRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.panRight">${t('motionSettingsDrawer.kenBurnsMode.panRight')}</option>
                                    <option value="panTop" ${preset.kenBurnsMode === 'panTop' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.panTop">${t('motionSettingsDrawer.kenBurnsMode.panTop')}</option>
                                    <option value="panBottom" ${preset.kenBurnsMode === 'panBottom' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.panBottom">${t('motionSettingsDrawer.kenBurnsMode.panBottom')}</option>
                                    <option value="panRandom" ${preset.kenBurnsMode === 'panRandom' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.panRandom">${t('motionSettingsDrawer.kenBurnsMode.panRandom')}</option>
                                </optgroup>
                                <optgroup label="${t('motionSettingsDrawer.kenBurnsMode.groupZoom')}">
                                    <option value="zoomIn" ${preset.kenBurnsMode === 'zoomIn' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomIn">${t('motionSettingsDrawer.kenBurnsMode.zoomIn')}</option>
                                    <option value="zoomOut" ${preset.kenBurnsMode === 'zoomOut' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomOut">${t('motionSettingsDrawer.kenBurnsMode.zoomOut')}</option>
                                    <option value="zoomRandom" ${preset.kenBurnsMode === 'zoomRandom' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomRandom">${t('motionSettingsDrawer.kenBurnsMode.zoomRandom')}</option>
                                </optgroup>
                                <optgroup label="${t('motionSettingsDrawer.kenBurnsMode.groupZoomPan')}">
                                    <option value="zoomPanLeft" ${preset.kenBurnsMode === 'zoomPanLeft' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomPanLeft">${t('motionSettingsDrawer.kenBurnsMode.zoomPanLeft')}</option>
                                    <option value="zoomPanRight" ${preset.kenBurnsMode === 'zoomPanRight' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomPanRight">${t('motionSettingsDrawer.kenBurnsMode.zoomPanRight')}</option>
                                    <option value="zoomPanTop" ${preset.kenBurnsMode === 'zoomPanTop' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomPanTop">${t('motionSettingsDrawer.kenBurnsMode.zoomPanTop')}</option>
                                    <option value="zoomPanBottom" ${preset.kenBurnsMode === 'zoomPanBottom' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomPanBottom">${t('motionSettingsDrawer.kenBurnsMode.zoomPanBottom')}</option>
                                    <option value="zoomPanRandom" ${preset.kenBurnsMode === 'zoomPanRandom' ? 'selected' : ''} data-i18n="motionSettingsDrawer.kenBurnsMode.zoomPanRandom">${t('motionSettingsDrawer.kenBurnsMode.zoomPanRandom')}</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== NHÓM 3: REACT BEAT AUDIO ===================== -->
                <!-- MỚI (29/08/2026, phản hồi Giang); VIẾT LẠI (30/08/2026, phản hồi Giang mục 1/2 —
                     bỏ hẳn cơ chế "bắn theo beat", giờ zoom/pan/rotate LIÊN TỤC tự động theo năng
                     lượng nhạc, cùng cách các beatscale visualizer effect khác trong app đang dùng);
                     SỬA LẠI NGAY sau đó (phản hồi Giang — "min là cố định cứng, không phải tuỳ
                     chọn"). 2 toggle ĐẦU (enabled/replaceMovement) LUÔN hiện — cùng quy ước
                     Transition/Ken Burns (không ẩn field theo toggle). 3 cụm con (Zoom/Pan/Rotate)
                     mỗi cụm 1 checkbox VUÔNG (khác pill-toggle 2 cái trên — đúng chữ "checkbox"
                     Giang dùng, phân biệt 3 cái ĐỘC LẬP có thể tick 1/vài/cả 3 cùng lúc) + ĐÚNG 1
                     slider "max" biên độ (nội suy tuyến tính từ baseline CỐ ĐỊNH theo năng lượng,
                     KHÔNG có slider "min"/"N beat" nào) thay vì mở modal riêng — đỡ phải dựng thêm
                     picker mới, cùng khuôn slider "In/Out ratio" đã có (Transition). -->
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
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="motionPresetsDrawer.beatReact.replaceMovement.label">${t('motionPresetsDrawer.beatReact.replaceMovement.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="motionPresetsDrawer.beatReact.replaceMovement.hint">${t('motionPresetsDrawer.beatReact.replaceMovement.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-motion-beatreact-replace" class="sr-only peer" ${preset.reactBeatAudio.replaceMovement ? 'checked' : ''}>
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
                <!-- MỚI (29/08/2026, phản hồi Giang — dời Reset/Xoá xuống dưới cùng, chung nhóm với
                     đổi tên, khỏi 2 nút nhỏ ở header) — "Cập nhật" (đổi tên, input auto-lưu lúc
                     blur) + "Reset"/"Xoá" giờ là 3 hàng CUỐI, CÙNG khuôn hàng "Motion options..."
                     (components/visual-bg-settings-drawer.js) — không còn 2 nút text nhỏ ở header. -->
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

/** Màn "Áp dụng cấu hình" — danh sách "nơi tiêu thụ". Tạm thời DUY NHẤT 1 dòng "Photo visual
 * background" (Giang chốt — hệ preset dựng để dùng chung cho nhiều nơi về sau, chỉ mới có đúng 1
 * nơi tiêu thụ thật). Hint hiện tên preset đang gắn (hoặc "Chưa gắn").
 * @param {string} attachedName - tên preset đang gắn cho Photo VBG, hoặc '' nếu chưa gắn. */
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
