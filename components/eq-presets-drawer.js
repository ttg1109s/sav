/**
 * Component: nội dung Generic Drawer cho "Edit EQ" (event/workflow/eq-presets.js mở qua
 * #btn-edit-eq). 2 mode, CÙNG khuôn Document Reader (List <-> Read):
 *   - 'list': danh sách preset (tên + khoá-icon nếu locked) + hàng "Tạo preset mới" (nhập tên
 *     inline, không dùng modal prompt — codebase chưa có sẵn, tránh xây thêm hạ tầng mới).
 *   - 'edit': tên (input, khoá nếu locked) + 10 slider băng tần (khoá nếu locked) + Lưu (ẩn nếu
 *     locked) + Xoá (ẩn nếu locked).
 *
 * SỬA (12/08/2026, Giang chỉ ra "loại bỏ tư duy cũ, khớp với Generic Drawer") — bản đầu (11/08)
 * lỡ bê NGUYÊN bảng màu TỐI (glass-modal/text-white/bg-black...) của phần còn lại của app vào đây
 * — SAI, vì Generic Drawer thuộc vùng LOẠI TRỪ theme, nền LUÔN TRẮNG cố định (mục 7
 * plan-v12-extended.md, xem docstring components/generic-drawer.js) bất kể Light/Dark/System —
 * nội dung tối bên trong khung trắng khiến "glass-modal" (vốn thiết kế nổi TRÊN nền tối) chỉ còn
 * là 1 khối xám nhạt vô nghĩa, chữ trắng gần như biến mất. SỬA ĐÚNG: đổi HẲN sang bảng màu SÁNG
 * (text-slate-900/700/500/400, border-slate-200, hover:bg-slate-100...) — ĐÚNG NGUYÊN bảng màu
 * event/workflow/document-reader.js đã dùng (List/Read cùng Generic Drawer) + components/items.js
 * (itemTemplateDocumentRow) — 2 nơi DUY NHẤT khác từng render nội dung thật bên trong Generic
 * Drawer, dùng làm chuẩn tham chiếu.
 *
 * Đồng thời đổi id 3 nút điều hướng header (đóng/lùi/lưu) từ tự đặt riêng (#eq-drawer-close/back/
 * save) sang ĐÚNG bộ id CHUNG mà document-reader.js đã lập (#btn-generic-drawer-close/back) +
 * thêm #btn-generic-drawer-save cùng khuôn — mọi Workflow dùng Generic Drawer nên quy về 1 bộ id
 * duy nhất cho các nút chrome header (đóng/lùi/hành động chính), tránh mỗi feature tự bịa 1 kiểu
 * tên riêng (đúng ý "khớp với generic drawer" của Giang). Các phần tử THÂN bài (list row/input
 * tên/slider/nút Xoá) vẫn giữ id riêng theo domain EQ — CHỈ chrome header mới dùng bộ chung.
 *
 * Generic Drawer KHÔNG biết nội dung là gì — event/workflow/eq-presets.js tự querySelector +
 * addEventListener SAU MỖI lần openGenericDrawer()/updateGenericDrawer() (KHÔNG qua eventBus cho
 * các nút động này, xem docstring core/generic-drawer.js).
 */

function renderEqListHeader() {
    return `
        <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900" data-i18n="eqPresets.title">${t('eqPresets.title')}</h3>
            <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
    `;
}

/** @param {object[]} presets @param {string} activeId */
function renderEqListBody(presets, activeId) {
    const rows = presets.map((p) => {
        const isActive = p.id === activeId;
        const rowClass = isActive ? 'bg-sky-50 border border-sky-300' : 'hover:bg-slate-100 border border-transparent';
        return `
        <button type="button" data-eq-id="${p.id}" class="w-full text-left px-4 py-3.5 rounded-xl mb-1.5 flex items-center justify-between gap-3 transition-colors ${rowClass}">
            <span class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(p.name)}</span>
                ${isActive ? `<span class="shrink-0 w-1.5 h-1.5 rounded-full bg-sky-500"></span>` : ''}
                ${p.locked ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>` : ''}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `;
    }).join('');

    return `
        <div class="flex gap-2 items-center p-3 mb-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <input type="text" id="eq-drawer-new-name" maxlength="24" placeholder="${t('eqPresets.newNamePlaceholder')}" class="flex-1 min-w-0 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500">
            <button id="eq-drawer-add" type="button" class="shrink-0 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 transition-colors text-white text-sm font-medium" data-i18n="eqPresets.create">${t('eqPresets.create')}</button>
        </div>
        ${rows}
    `;
}

/** @param {{id: string, name: string, locked: boolean}} preset */
function renderEqEditHeader(preset) {
    return `
        <div class="relative flex items-center justify-center px-14 py-3 border-b border-slate-200">
            <button id="btn-generic-drawer-back" class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 shrink-0" title="${t('eqPresets.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
            <h3 class="text-sm font-bold text-slate-900 truncate px-10" data-i18n="eqPresets.editTitle">${t('eqPresets.editTitle')}</h3>
            ${preset.locked ? '' : `<button id="btn-generic-drawer-save" class="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white text-sm font-medium shrink-0" data-i18n="eqPresets.save">${t('eqPresets.save')}</button>`}
        </div>
    `;
}

/** @param {{id: string, name: string, gains: number[], locked: boolean}} preset */
function renderEqEditBody(preset) {
    const sliders = preset.gains.map((g, i) => `
        <div class="flex flex-col items-center gap-1 w-7">
            <span class="text-[9px] text-sky-600 font-medium w-full text-center" id="eq-edit-val-${i}">${g > 0 ? `+${g}` : g}</span>
            <div class="eq-slider-container"><input type="range" class="eq-slider" min="-12" max="12" step="1" value="${g}" data-index="${i}" ${preset.locked ? 'disabled' : ''}></div>
            <span class="text-[9px] text-slate-500 mt-1">${EQ_LABELS[i]}</span>
        </div>
    `).join('');

    return `
        <div class="flex flex-col gap-4">
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label class="text-xs text-slate-500 mb-1.5 block" data-i18n="eqPresets.name.label">${t('eqPresets.name.label')}</label>
                <input type="text" id="eq-drawer-name" maxlength="24" value="${escapeHtml(preset.name)}" ${preset.locked ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 disabled:opacity-60 disabled:bg-slate-100">
                ${preset.locked ? `<p class="text-xs text-slate-400 mt-2" data-i18n="eqPresets.lockedHint">${t('eqPresets.lockedHint')}</p>` : ''}
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div class="flex justify-between items-end h-28 px-1">${sliders}</div>
            </div>
            ${preset.locked ? '' : `<button id="eq-drawer-delete" type="button" class="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 transition-colors text-rose-600 text-sm font-medium" data-i18n="eqPresets.delete">${t('eqPresets.delete')}</button>`}
        </div>
    `;
}
