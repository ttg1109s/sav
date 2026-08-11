/**
 * Component: nội dung Generic Drawer cho "Edit EQ" (event/workflow/eq-presets.js mở qua
 * #btn-edit-eq). 2 mode, CÙNG khuôn Document Reader (List <-> Read):
 *   - 'list': danh sách preset (tên + khoá-icon nếu locked) + hàng "Tạo preset mới" (nhập tên
 *     inline, không dùng modal prompt — codebase chưa có sẵn, tránh xây thêm hạ tầng mới).
 *   - 'edit': tên (input, khoá nếu locked) + 10 slider băng tần (khoá nếu locked) + Lưu (ẩn nếu
 *     locked) + Xoá (ẩn nếu locked).
 *
 * Generic Drawer KHÔNG biết nội dung là gì — event/workflow/eq-presets.js tự querySelector +
 * addEventListener SAU MỖI lần openGenericDrawer()/updateGenericDrawer() (KHÔNG qua eventBus cho
 * các nút động này, xem docstring core/generic-drawer.js).
 */

function renderEqListHeader() {
    return `
        <div class="relative flex items-center justify-center px-14 py-3 h-14 shrink-0">
            <h2 class="text-base font-semibold text-white truncate text-center" data-i18n="eqPresets.title">${t('eqPresets.title')}</h2>
            <button id="eq-drawer-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
    `;
}

/** @param {object[]} presets @param {string} activeId */
function renderEqListBody(presets, activeId) {
    const rows = presets.map((p) => `
        <button type="button" data-eq-id="${p.id}" class="flex items-center justify-between w-full p-4 border-b border-white/5 hover:bg-white/5 transition-colors text-left">
            <span class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-medium text-white truncate">${escapeHtml(p.name)}</span>
                ${p.id === activeId ? `<span class="shrink-0 w-1.5 h-1.5 rounded-full bg-sky-400"></span>` : ''}
                ${p.locked ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>` : ''}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `).join('');

    return `
        <div class="px-4 pb-2">
            <div class="flex gap-2 items-center p-3 bg-black/20 rounded-2xl">
                <input type="text" id="eq-drawer-new-name" maxlength="24" placeholder="${t('eqPresets.newNamePlaceholder')}" class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500">
                <button id="eq-drawer-add" type="button" class="shrink-0 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-white text-sm font-medium" data-i18n="eqPresets.create">${t('eqPresets.create')}</button>
            </div>
        </div>
        <div class="glass-modal mx-4 rounded-2xl flex flex-col overflow-hidden">${rows}</div>
    `;
}

/** @param {{id: string, name: string, locked: boolean}} preset */
function renderEqEditHeader(preset) {
    return `
        <div class="relative flex items-center justify-center px-14 py-3 h-14 shrink-0">
            <button id="eq-drawer-back" class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
            <h2 class="text-base font-semibold text-white truncate text-center px-10" data-i18n="eqPresets.editTitle">${t('eqPresets.editTitle')}</h2>
            ${preset.locked ? '' : `<button id="eq-drawer-save" class="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white text-sm font-medium shrink-0" data-i18n="eqPresets.save">${t('eqPresets.save')}</button>`}
        </div>
    `;
}

/** @param {{id: string, name: string, gains: number[], locked: boolean}} preset */
function renderEqEditBody(preset) {
    const sliders = preset.gains.map((g, i) => `
        <div class="flex flex-col items-center gap-1 w-7">
            <span class="text-[9px] text-sky-300 w-full text-center" id="eq-edit-val-${i}">${g > 0 ? `+${g}` : g}</span>
            <div class="eq-slider-container"><input type="range" class="eq-slider" min="-12" max="12" step="1" value="${g}" data-index="${i}" ${preset.locked ? 'disabled' : ''}></div>
            <span class="text-[9px] text-slate-400 mt-1">${EQ_LABELS[i]}</span>
        </div>
    `).join('');

    return `
        <div class="p-4 flex flex-col gap-4">
            <div class="glass-modal rounded-2xl p-4">
                <label class="text-xs text-slate-400 mb-1.5 block" data-i18n="eqPresets.name.label">${t('eqPresets.name.label')}</label>
                <input type="text" id="eq-drawer-name" maxlength="24" value="${escapeHtml(preset.name)}" ${preset.locked ? 'disabled' : ''} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none disabled:opacity-50">
                ${preset.locked ? `<p class="text-xs text-slate-500 mt-2" data-i18n="eqPresets.lockedHint">${t('eqPresets.lockedHint')}</p>` : ''}
            </div>
            <div class="glass-modal rounded-2xl p-4">
                <div class="flex justify-between items-end h-28 px-1">${sliders}</div>
            </div>
            ${preset.locked ? '' : `<button id="eq-drawer-delete" type="button" class="w-full py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-rose-400 text-sm font-medium" data-i18n="eqPresets.delete">${t('eqPresets.delete')}</button>`}
        </div>
    `;
}
