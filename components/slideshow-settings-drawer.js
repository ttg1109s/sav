/**
 * Component: màn hình "Cấu hình Slideshow" — VIẾT LẠI TOÀN BỘ (29/08/2026, phản hồi Giang — Slideshow
 * KHÔNG còn là 1 cấu hình DUY NHẤT nhúng trong Visual Background, mà là hệ PRESET độc lập, đặt tên/
 * thêm/xoá được (CÙNG KHUÔN hệ preset EQ — core/eq-presets.js/components/eq-presets-drawer.js, chỉ
 * đổi field). Visual Background (Photo) chỉ là 1 trong các "nơi tiêu thụ" CÓ THỂ gắn 1 preset vào
 * dùng — KHÔNG sở hữu/quản lý hệ preset này. Lối vào DUY NHẤT: Settings > System > Slideshow.
 *
 * 4 màn (mỗi màn 1 hàm render, tất cả điều hướng qua workflowAppSettings.navigateTo(), xem
 * event/workflow/app-settings.js + event/workflow/slideshow-presets.js):
 *   1. `renderSlideshowMenuBody()` — 2 dòng: "Quản lý cấu hình" / "Áp dụng cấu hình".
 *   2. `renderSlideshowListBody(presets, pickMode)` — danh sách preset — DÙNG CHUNG cho CẢ "Quản lý"
 *      (tap = sửa, có nút xoá nhanh mỗi dòng) LẪN "Áp dụng > chọn" (tap = CHỌN gắn vào, không có nút
 *      xoá) — `pickMode` phân biệt 2 hành vi.
 *   3. `renderSlideshowEditBody(preset)` — sửa 1 preset: Transition (toggle riêng + type/duration/
 *      ratio/easing LUÔN hiện, KHÔNG ẩn theo toggle nữa — Giang chốt) + Ken Burns (toggle + mode
 *      LUÔN hiện, cùng lý do — tên nhóm về lại "Ken Burns", KHÔNG còn "Photo Movement") + nhóm CUỐI
 *      "Quản lý" (MỚI 29/08/2026, phản hồi Giang — dời Reset/Xoá xuống thành 2 hàng cuối, CÙNG nhóm
 *      với đổi tên — KHÔNG còn 2 nút text nhỏ ở header, KHÔNG còn nút "+" icon nào — "Thêm cấu hình
 *      mới" cũng đã dời xuống thành 1 hàng chữ thuần đầu danh sách, xem `renderSlideshowListBody()`).
 *      Tên preset là 1 input trong nhóm CUỐI đó, tự lưu lúc blur (KHÔNG cần nút "Cập nhật" riêng —
 *      mọi field khác trong app đều tự lưu ngay lúc đổi, tên cũng vậy cho nhất quán).
 *   4. `renderSlideshowApplyListBody()` — 1 dòng "Photo visual background" (tạm thời DUY NHẤT nơi
 *      tiêu thụ) + `renderSlideshowApplyDetailBody(presetName)` — tên preset đang gắn bên trái + nút
 *      "Gỡ", cùng nút "Chọn cấu hình khác" mở lại `renderSlideshowListBody(..., true)`.
 *
 * Logic: event/workflow/slideshow-presets.js (workflowSlideshowPresets). Router/Listener: cụm
 * "slideshowPresets" (event/router,listener/slideshow-presets.js).
 * NẠP SAU: core/modal-choice-ui.js (dùng chung escapeHtml()), core/file-manager/slideshow.js
 * (transitionSupportsInOutRatio()), components/settings/app-settings-main.js (renderAppSettingsRowList()).
 */

function renderSlideshowMenuBody() {
    const rows = [
        { key: 'slideshowManage', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', labelKey: 'slideshowPresetsDrawer.menu.manage.label', hintKey: 'slideshowPresetsDrawer.menu.manage.hint' },
        { key: 'slideshowApply', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', labelKey: 'slideshowPresetsDrawer.menu.apply.label', hintKey: 'slideshowPresetsDrawer.menu.apply.hint' },
    ];
    return renderAppSettingsRowList(rows); // components/settings/app-settings-main.js — data-app-settings-nav, tái dùng cơ chế chung
}

/** @param {{id:string, name:string}[]} presets @param {boolean} pickMode */
function renderSlideshowListBody(presets, pickMode) {
    // SỬA (29/08/2026, phản hồi Giang — "bỏ dấu +") — hàng "Thêm cấu hình mới" dời từ nút icon "+"
    // ở header (đã bỏ hẳn) xuống thành 1 hàng CUỐI danh sách, chữ thuần, không icon — CHỈ hiện khi
    // KHÔNG phải pickMode (Áp dụng > Chọn chỉ được CHỌN trong preset có sẵn, không tạo mới từ đó).
    const addRowHtml = pickMode ? '' : `
        <button type="button" id="btn-slideshow-list-add" class="w-full text-center px-4 py-3.5 rounded-2xl mb-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors text-sm font-semibold text-sky-600">${t('slideshowPresetsDrawer.list.add.label')}</button>
    `;
    if (presets.length === 0) {
        return addRowHtml + `<p class="text-sm text-slate-500 text-center py-10 px-6">${t(pickMode ? 'slideshowPresetsDrawer.list.emptyPick' : 'slideshowPresetsDrawer.list.emptyManage')}</p>`;
    }
    const itemsHtml = presets.map((p) => `
        <div data-slideshow-preset-tile="${escapeHtml(p.id)}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
            <span class="text-sm font-semibold text-slate-700 truncate">${escapeHtml(p.name)}</span>
            ${pickMode ? `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            ` : `
            <button type="button" data-slideshow-preset-quickdelete="${escapeHtml(p.id)}" class="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0" title="${t('slideshowPresetsDrawer.list.delete.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            `}
        </div>
    `).join('');
    return addRowHtml + itemsHtml;
}

/** Dựng 3 hàng (checkbox bật + slider "mỗi N beat" + [select hướng] + slider biên độ) cho 1 hiệu
 * ứng con (zoom/pan/rotate) trong nhóm "React Beat Audio" — DÙNG CHUNG cả 3, tránh lặp HTML gần
 * giống nhau 3 lần (chỉ khác: có/không select hướng, biên độ min/max/step/hậu tố, tên field).
 * @param {'zoom'|'pan'|'rotate'} key - dùng làm phần ID (`setting-slideshow-beatreact-${key}-*`).
 * @param {object} effect - `preset.reactBeatAudio[key]` — {enabled, everyNBeats, amountPct|amountDeg, direction?}.
 * @param {{titleKey:string, amountLabelKey:string, amountMin:number, amountMax:number, amountStep:number, amountSuffix:string, hasDirection:boolean, isLast?:boolean}} cfg
 */
function renderSlideshowBeatReactEffectRows(key, effect, cfg) {
    const amount = key === 'rotate' ? effect.amountDeg : effect.amountPct;
    const borderClass = cfg.isLast ? '' : ' border-b border-white/5';
    const directionHtml = cfg.hasDirection ? `
                        <div class="flex justify-between items-center px-4 pb-3">
                            <span class="text-xs text-slate-400" data-i18n="slideshowPresetsDrawer.beatReact.direction.label">${t('slideshowPresetsDrawer.beatReact.direction.label')}</span>
                            <select id="setting-slideshow-beatreact-${key}-direction" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none w-36 text-right">
                                <option value="left" ${effect.direction === 'left' ? 'selected' : ''} data-i18n="slideshowPresetsDrawer.beatReact.direction.left">${t('slideshowPresetsDrawer.beatReact.direction.left')}</option>
                                <option value="right" ${effect.direction === 'right' ? 'selected' : ''} data-i18n="slideshowPresetsDrawer.beatReact.direction.right">${t('slideshowPresetsDrawer.beatReact.direction.right')}</option>
                                <option value="leftToRight" ${effect.direction === 'leftToRight' ? 'selected' : ''} data-i18n="slideshowPresetsDrawer.beatReact.direction.leftToRight">${t('slideshowPresetsDrawer.beatReact.direction.leftToRight')}</option>
                                <option value="rightToLeft" ${effect.direction === 'rightToLeft' ? 'selected' : ''} data-i18n="slideshowPresetsDrawer.beatReact.direction.rightToLeft">${t('slideshowPresetsDrawer.beatReact.direction.rightToLeft')}</option>
                            </select>
                        </div>` : '';
    return `
                        <div class="p-4${borderClass}">
                            <label class="flex items-center gap-2.5 mb-3 cursor-pointer">
                                <input type="checkbox" id="setting-slideshow-beatreact-${key}-enabled" class="w-4 h-4 rounded accent-sky-500 shrink-0" ${effect.enabled ? 'checked' : ''}>
                                <span class="text-sm font-medium" data-i18n="${cfg.titleKey}">${t(cfg.titleKey)}</span>
                            </label>
                            <div class="flex justify-between items-center mb-1.5">
                                <span class="text-xs text-slate-400" data-i18n="slideshowPresetsDrawer.beatReact.everyNBeats.label">${t('slideshowPresetsDrawer.beatReact.everyNBeats.label')}</span>
                                <span id="slideshow-beatreact-${key}-beats-label" class="text-xs text-slate-300 font-mono">${effect.everyNBeats}</span>
                            </div>
                            <input type="range" id="setting-slideshow-beatreact-${key}-beats" min="${SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MIN}" max="${SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MAX}" step="1" value="${effect.everyNBeats}" class="w-full accent-sky-500 mb-3">
                            ${directionHtml}
                            <div class="flex justify-between items-center mb-1.5">
                                <span class="text-xs text-slate-400" data-i18n="${cfg.amountLabelKey}">${t(cfg.amountLabelKey)}</span>
                                <span id="slideshow-beatreact-${key}-amount-label" class="text-xs text-slate-300 font-mono">${amount}${cfg.amountSuffix}</span>
                            </div>
                            <input type="range" id="setting-slideshow-beatreact-${key}-amount" min="${cfg.amountMin}" max="${cfg.amountMax}" step="${cfg.amountStep}" value="${amount}" class="w-full accent-sky-500">
                        </div>
    `;
}

/** @param {object} preset - 1 phần tử `appState.slideshowPresets` (core/slideshow-presets.js). */
function renderSlideshowEditBody(preset) {
    return `
                <!-- ===================== NHÓM 1: CHUYỂN CẢNH ===================== -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="slideshowSettingsDrawer.groupTransition.title">${t('slideshowSettingsDrawer.groupTransition.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <!-- MỚI (29/08/2026, Giang chốt) — toggle "Có áp dụng Transition hay không",
                             ĐỘC LẬP với việc chọn hiệu ứng (select ngay dưới LUÔN hiện, kể cả tắt). -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionEnabled.label">${t('slideshowSettingsDrawer.transitionEnabled.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-transition-enabled" class="sr-only peer" ${preset.transitionEnabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transition.label">${t('slideshowSettingsDrawer.transition.label')}</span>
                            <select id="setting-slideshow-transition" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <option value="fade" ${preset.transitionType === 'fade' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.fade">${t('slideshowSettingsDrawer.transition.fade')}</option>
                                <option value="slideLeft" ${preset.transitionType === 'slideLeft' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.slideLeft">${t('slideshowSettingsDrawer.transition.slideLeft')}</option>
                                <option value="slideRight" ${preset.transitionType === 'slideRight' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.slideRight">${t('slideshowSettingsDrawer.transition.slideRight')}</option>
                                <option value="zoomIn" ${preset.transitionType === 'zoomIn' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.zoomIn">${t('slideshowSettingsDrawer.transition.zoomIn')}</option>
                                <option value="zoomOut" ${preset.transitionType === 'zoomOut' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.zoomOut">${t('slideshowSettingsDrawer.transition.zoomOut')}</option>
                                <option value="wipe" ${preset.transitionType === 'wipe' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.wipe">${t('slideshowSettingsDrawer.transition.wipe')}</option>
                                <option value="flip" ${preset.transitionType === 'flip' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.flip">${t('slideshowSettingsDrawer.transition.flip')}</option>
                                <option value="blur" ${preset.transitionType === 'blur' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.blur">${t('slideshowSettingsDrawer.transition.blur')}</option>
                                <option value="rotateFade" ${preset.transitionType === 'rotateFade' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.rotateFade">${t('slideshowSettingsDrawer.transition.rotateFade')}</option>
                                <option value="curtain" ${preset.transitionType === 'curtain' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.curtain">${t('slideshowSettingsDrawer.transition.curtain')}</option>
                                <option value="circleReveal" ${preset.transitionType === 'circleReveal' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.circleReveal">${t('slideshowSettingsDrawer.transition.circleReveal')}</option>
                                <option value="glitch" ${preset.transitionType === 'glitch' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transition.glitch">${t('slideshowSettingsDrawer.transition.glitch')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionDuration.label">${t('slideshowSettingsDrawer.transitionDuration.label')}</div>
                            </div>
                            <button type="button" id="setting-slideshow-transition-duration" class="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-20 text-right shrink-0 hover:bg-white/10 transition-colors">${(preset.transitionDurationMs / 1000).toFixed(1)}s</button>
                        </div>
                        <div id="slideshow-transition-ratio-row" class="p-4 border-b border-white/5 hover:bg-white/5 transition-colors${transitionSupportsInOutRatio(preset.transitionType) ? '' : ' hidden'}">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionRatio.label">${t('slideshowSettingsDrawer.transitionRatio.label')}</span>
                                <span id="slideshow-transition-ratio-label" class="text-xs text-slate-400 font-mono"></span>
                            </div>
                            <input type="range" id="setting-slideshow-transition-ratio" min="0" max="100" step="5" value="${preset.transitionInOutRatio}" class="w-full accent-sky-500">
                        </div>
                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.transitionEasing.label">${t('slideshowSettingsDrawer.transitionEasing.label')}</span>
                            <select id="setting-slideshow-transition-easing" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="linear" ${preset.transitionEasing === 'linear' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transitionEasing.linear">${t('slideshowSettingsDrawer.transitionEasing.linear')}</option>
                                <option value="ease" ${preset.transitionEasing === 'ease' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transitionEasing.ease">${t('slideshowSettingsDrawer.transitionEasing.ease')}</option>
                                <option value="ease-in" ${preset.transitionEasing === 'ease-in' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transitionEasing.easeIn">${t('slideshowSettingsDrawer.transitionEasing.easeIn')}</option>
                                <option value="ease-out" ${preset.transitionEasing === 'ease-out' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transitionEasing.easeOut">${t('slideshowSettingsDrawer.transitionEasing.easeOut')}</option>
                                <option value="ease-in-out" ${preset.transitionEasing === 'ease-in-out' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.transitionEasing.easeInOut">${t('slideshowSettingsDrawer.transitionEasing.easeInOut')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== NHÓM 2: KEN BURNS ===================== -->
                <!-- SỬA (29/08/2026, Giang chốt "chuyển về lại thành Ken Burns") — tên nhóm về lại
                     "Ken Burns" (thay "Photo Movement"), select mode LUÔN hiện — bỏ hẳn ẩn/hiện theo
                     toggle (KHÁC bản cũ tự toggle class "hidden" trên #slideshow-kenburns-mode-row). -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="slideshowSettingsDrawer.groupKenBurns.title">${t('slideshowSettingsDrawer.groupKenBurns.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.kenBurns.label">${t('slideshowSettingsDrawer.kenBurns.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-kenburns" class="sr-only peer" ${preset.kenBurnsEnabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <span class="text-sm font-medium" data-i18n="slideshowSettingsDrawer.kenBurnsMode.label">${t('slideshowSettingsDrawer.kenBurnsMode.label')}</span>
                            <select id="setting-slideshow-kenburns-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <optgroup label="${t('slideshowSettingsDrawer.kenBurnsMode.groupPan')}">
                                    <option value="panLeft" ${preset.kenBurnsMode === 'panLeft' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.panLeft">${t('slideshowSettingsDrawer.kenBurnsMode.panLeft')}</option>
                                    <option value="panRight" ${preset.kenBurnsMode === 'panRight' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.panRight">${t('slideshowSettingsDrawer.kenBurnsMode.panRight')}</option>
                                    <option value="panTop" ${preset.kenBurnsMode === 'panTop' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.panTop">${t('slideshowSettingsDrawer.kenBurnsMode.panTop')}</option>
                                    <option value="panBottom" ${preset.kenBurnsMode === 'panBottom' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.panBottom">${t('slideshowSettingsDrawer.kenBurnsMode.panBottom')}</option>
                                    <option value="panRandom" ${preset.kenBurnsMode === 'panRandom' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.panRandom">${t('slideshowSettingsDrawer.kenBurnsMode.panRandom')}</option>
                                </optgroup>
                                <optgroup label="${t('slideshowSettingsDrawer.kenBurnsMode.groupZoom')}">
                                    <option value="zoomIn" ${preset.kenBurnsMode === 'zoomIn' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomIn">${t('slideshowSettingsDrawer.kenBurnsMode.zoomIn')}</option>
                                    <option value="zoomOut" ${preset.kenBurnsMode === 'zoomOut' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomOut">${t('slideshowSettingsDrawer.kenBurnsMode.zoomOut')}</option>
                                    <option value="zoomRandom" ${preset.kenBurnsMode === 'zoomRandom' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomRandom">${t('slideshowSettingsDrawer.kenBurnsMode.zoomRandom')}</option>
                                </optgroup>
                                <optgroup label="${t('slideshowSettingsDrawer.kenBurnsMode.groupZoomPan')}">
                                    <option value="zoomPanLeft" ${preset.kenBurnsMode === 'zoomPanLeft' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanLeft">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanLeft')}</option>
                                    <option value="zoomPanRight" ${preset.kenBurnsMode === 'zoomPanRight' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanRight">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanRight')}</option>
                                    <option value="zoomPanTop" ${preset.kenBurnsMode === 'zoomPanTop' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanTop">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanTop')}</option>
                                    <option value="zoomPanBottom" ${preset.kenBurnsMode === 'zoomPanBottom' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanBottom">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanBottom')}</option>
                                    <option value="zoomPanRandom" ${preset.kenBurnsMode === 'zoomPanRandom' ? 'selected' : ''} data-i18n="slideshowSettingsDrawer.kenBurnsMode.zoomPanRandom">${t('slideshowSettingsDrawer.kenBurnsMode.zoomPanRandom')}</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- ===================== NHÓM 3: REACT BEAT AUDIO ===================== -->
                <!-- MỚI (29/08/2026, phản hồi Giang) — pulse zoom/pan/rotate bắn theo beat nhạc.
                     2 toggle ĐẦU (enabled/replaceMovement) LUÔN hiện — cùng quy ước Transition/Ken
                     Burns (không ẩn field theo toggle). 3 cụm con (Zoom/Pan/Rotate) mỗi cụm 1
                     checkbox VUÔNG (khác pill-toggle 2 cái trên — đúng chữ "checkbox" Giang dùng,
                     phân biệt 3 cái ĐỘC LẬP có thể tick 1/vài/cả 3 cùng lúc) + slider cho từng field
                     số (N beat/biên độ) thay vì mở modal riêng — đỡ phải dựng thêm picker mới, cùng
                     khuôn slider "In/Out ratio" đã có (Transition). -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="slideshowPresetsDrawer.beatReact.groupTitle">${t('slideshowPresetsDrawer.beatReact.groupTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="slideshowPresetsDrawer.beatReact.enabled.label">${t('slideshowPresetsDrawer.beatReact.enabled.label')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-beatreact-enabled" class="sr-only peer" ${preset.reactBeatAudio.enabled ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="slideshowPresetsDrawer.beatReact.replaceMovement.label">${t('slideshowPresetsDrawer.beatReact.replaceMovement.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="slideshowPresetsDrawer.beatReact.replaceMovement.hint">${t('slideshowPresetsDrawer.beatReact.replaceMovement.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-slideshow-beatreact-replace" class="sr-only peer" ${preset.reactBeatAudio.replaceMovement ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>

                        ${renderSlideshowBeatReactEffectRows('zoom', preset.reactBeatAudio.zoom, {
                            titleKey: 'slideshowPresetsDrawer.beatReact.zoom.title',
                            amountLabelKey: 'slideshowPresetsDrawer.beatReact.zoom.amountLabel',
                            amountMin: 100, amountMax: 200, amountStep: 5, amountSuffix: '%',
                            hasDirection: false,
                        })}
                        ${renderSlideshowBeatReactEffectRows('pan', preset.reactBeatAudio.pan, {
                            titleKey: 'slideshowPresetsDrawer.beatReact.pan.title',
                            amountLabelKey: 'slideshowPresetsDrawer.beatReact.pan.amountLabel',
                            amountMin: 100, amountMax: 150, amountStep: 5, amountSuffix: '%',
                            hasDirection: true,
                        })}
                        ${renderSlideshowBeatReactEffectRows('rotate', preset.reactBeatAudio.rotate, {
                            titleKey: 'slideshowPresetsDrawer.beatReact.rotate.title',
                            amountLabelKey: 'slideshowPresetsDrawer.beatReact.rotate.amountLabel',
                            amountMin: 0, amountMax: 360, amountStep: 15, amountSuffix: '°',
                            hasDirection: true,
                            isLast: true,
                        })}
                    </div>
                </div>

                <!-- ===================== NHÓM 4: QUẢN LÝ ===================== -->
                <!-- MỚI (29/08/2026, phản hồi Giang — dời Reset/Xoá xuống dưới cùng, chung nhóm với
                     đổi tên, khỏi 2 nút nhỏ ở header) — "Cập nhật" (đổi tên, input auto-lưu lúc
                     blur) + "Reset"/"Xoá" giờ là 3 hàng CUỐI, CÙNG khuôn hàng "Slideshow options..."
                     (components/visual-bg-settings-drawer.js) — không còn 2 nút text nhỏ ở header. -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2 mt-4" data-i18n="slideshowPresetsDrawer.edit.groupManage.title">${t('slideshowPresetsDrawer.edit.groupManage.title')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium shrink-0 pr-3" data-i18n="slideshowPresetsDrawer.edit.nameLabel">${t('slideshowPresetsDrawer.edit.nameLabel')}</span>
                            <input type="text" id="setting-slideshow-name" value="${escapeHtml(preset.name)}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right focus:border-sky-400" placeholder="${t('slideshowPresetsDrawer.edit.namePlaceholder')}">
                        </div>
                        <button type="button" id="btn-slideshow-edit-reset" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                            <span class="text-sm font-medium text-slate-300" data-i18n="slideshowPresetsDrawer.edit.reset.label">${t('slideshowPresetsDrawer.edit.reset.label')}</span>
                        </button>
                        <button type="button" id="btn-slideshow-edit-delete" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                            <span class="text-sm font-medium text-rose-400" data-i18n="slideshowPresetsDrawer.edit.delete.label">${t('slideshowPresetsDrawer.edit.delete.label')}</span>
                        </button>
                    </div>
                </div>
    `;
}

/** Màn "Áp dụng cấu hình" — danh sách "nơi tiêu thụ". Tạm thời DUY NHẤT 1 dòng "Photo visual
 * background" (Giang chốt — hệ preset dựng để dùng chung cho nhiều nơi về sau, chỉ mới có đúng 1
 * nơi tiêu thụ thật). Hint hiện tên preset đang gắn (hoặc "Chưa gắn").
 * @param {string} attachedName - tên preset đang gắn cho Photo VBG, hoặc '' nếu chưa gắn. */
function renderSlideshowApplyListBody(attachedName) {
    const hint = attachedName || t('slideshowPresetsDrawer.apply.notAttached');
    return `
        <button type="button" data-app-settings-nav="slideshowApplyPhotoVisualBg" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
            <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-700 truncate">${t('slideshowPresetsDrawer.apply.photoVisualBg.label')}</div>
                <div class="text-xs text-slate-400 mt-0.5 truncate">${escapeHtml(hint)}</div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `;
}

/** Chi tiết 1 nơi tiêu thụ (hiện chỉ "Photo visual background") — tên preset đang gắn bên trái + nút
 * "Gỡ" (chỉ hiện khi ĐÃ gắn), cùng nút mở lại danh sách preset ở chế độ CHỌN.
 * @param {string} attachedName - '' nếu chưa gắn. */
function renderSlideshowApplyDetailBody(attachedName) {
    return `
        <div class="glass-modal rounded-2xl flex flex-col overflow-hidden mb-4">
            <div class="flex justify-between items-center gap-3 p-4">
                <div class="min-w-0">
                    <div class="text-xs text-slate-400 mb-0.5" data-i18n="slideshowPresetsDrawer.apply.currentLabel">${t('slideshowPresetsDrawer.apply.currentLabel')}</div>
                    <div class="text-sm font-semibold truncate">${escapeHtml(attachedName || t('slideshowPresetsDrawer.apply.notAttached'))}</div>
                </div>
                ${attachedName ? `
                <button type="button" id="btn-slideshow-apply-detach" class="text-xs font-semibold text-rose-400 px-2 shrink-0 hover:text-rose-300">${t('slideshowPresetsDrawer.apply.detach.label')}</button>
                ` : ''}
            </div>
        </div>
        <button type="button" id="btn-slideshow-apply-pick" class="w-full text-center py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors">${t('slideshowPresetsDrawer.apply.pickButton')}</button>
    `;
}
