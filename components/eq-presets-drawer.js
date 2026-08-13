/**
 * Component: nội dung Generic Drawer cho "Edit EQ" (event/workflow/eq-presets.js mở qua GIỮ 1.5s
 * #btn-cycle-eq — 12/08/2026: icon #btn-edit-eq riêng ĐÃ BỎ, gộp vào hold, xem docstring
 * event/workflow/eq-presets.js). 2 mode, CÙNG khuôn Document Reader (List <-> Read):
 *   - 'list': danh sách preset (tên + khoá-icon nếu locked) + nút "+" trong HEADER để tạo preset
 *     mới (KHÔNG còn ô nhập tên/nút Tạo trong body — xem SỬA 2 bên dưới).
 *   - 'edit': tên (hàng "Name | input", khoá nếu locked) + 10 slider dọc lưỡng cực (-12..+12,
 *     khoá nếu locked) + Lưu (ẩn nếu locked) + Áp dụng + Xoá (2 nút cạnh nhau, CẢ 2 ẩn nếu locked
 *     — xem SỬA 3 bên dưới).
 *
 * SỬA 3 (12/08/2026, Giang yêu cầu "thêm nút apply cạnh nút delete") — hàng dưới cùng body Edit
 * TRƯỚC ĐÂY chỉ có Xoá (full-width) — giờ thêm `#eq-drawer-apply` NGAY BÊN CẠNH (`flex gap-2`, mỗi
 * nút `flex-1`) — CHỌN preset đang sửa làm preset ĐANG DÙNG + áp NGAY gains đang chỉnh dở trên
 * slider (kể cả CHƯA bấm Lưu) lên audio graph thật, cho nghe thử trực tiếp trong lúc chỉnh — KHÁC
 * Lưu (chỉ ghi DB, chỉ áp gains NẾU preset đó ĐÃ SẴN đang active từ trước) — xem
 * event/workflow/eq-presets.js::_applyPreset().
 *
 * SỬA (11/08/2026, Giang chỉ ra "loại bỏ tư duy cũ, khớp với Generic Drawer") — bản đầu lỡ bê
 * NGUYÊN bảng màu TỐI (glass-modal/text-white/bg-black...) vào đây — SAI, vì Generic Drawer thuộc
 * vùng LOẠI TRỪ theme, nền LUÔN TRẮNG cố định (mục 7 plan-v12-extended.md, xem docstring
 * components/generic-drawer.js). Đã đổi HẲN sang bảng màu SÁNG (text-slate-900/700/500/400,
 * border-slate-200...) — ĐÚNG bảng màu event/workflow/document-reader.js + components/items.js
 * (itemTemplateDocumentRow) đã dùng, cùng bộ id nút chrome header CHUNG (#btn-generic-drawer-
 * close/back/save) — xem docstring event/workflow/eq-presets.js.
 *
 * SỬA 2 (12/08/2026, phản hồi Giang round 2 — 5 điểm):
 *   1+2. Track dọc vô hình + số dính rìa box — TRƯỚC ĐÂY dùng chung `.eq-slider`/
 *     `.eq-slider-container` (assets/css/style.css) — track nền `rgba(255,255,255,0.1)` thiết kế
 *     cho theme TỐI của core/equalizer.js CŨ, gần như vô hình trên nền TRẮNG của Generic Drawer;
 *     10 cột lại xếp bằng `justify-between` không có gap/padding riêng nên 2 cột đầu/cuối dính sát
 *     rìa box. SỬA: đổi sang class MỚI RIÊNG `.eq-preset-slider*` (track sáng `slate-200` + mốc 0dB
 *     giữa + dải MÀU tím kéo dài từ mốc 0 ra giá trị hiện tại, xem CSS) + đổi layout hàng 10 cột
 *     sang `gap` cố định (không còn `justify-between`) + `overflow-x-auto` (an toàn cho màn hình
 *     rất hẹp, không bao giờ còn cảnh tràn/dính rìa dù cỡ máy nào).
 *   3. Khối "Name" đổi sang ĐÚNG khuôn 1 hàng "label trái | input phải" như mọi hàng Settings khác
 *     (vd "Kiểu hiệu ứng", components/settings/visualizer-geometry-color.js) — trước đây label
 *     NẰM TRÊN, input NẰM DƯỚI (2 hàng), không khớp quy ước chung của app.
 *   4. Nút "Tạo preset mới" dời HẲN vào HEADER (icon "+" cạnh nút đóng, CÙNG khuôn document-
 *     reader.js xếp nhiều nút hành động ở góc phải header) — bấm là tạo NGAY 1 preset tên tự sinh
 *     ("New preset"/"New preset 2"...), KHÔNG còn ô nhập tên/nút Tạo trong body — CÙNG khuôn
 *     createFolderInPicker()/_computeDefaultFolderName() (event/workflow/playlist.js): tạo xong mở
 *     THẲNG view Sửa (đã có sẵn ô Name để đổi nếu muốn — Giang chỉ ra "đằng nào cũng sửa được sau").
 *   (Điểm 5 — Volume HUD không tô màu phần đã kéo — thuộc core/volume-hud.js, KHÔNG phải file này.)
 *
 * Generic Drawer KHÔNG biết nội dung là gì — event/workflow/eq-presets.js tự querySelector +
 * addEventListener SAU MỖI lần openGenericDrawer()/updateGenericDrawer() (KHÔNG qua eventBus cho
 * các nút động này, xem docstring core/generic-drawer.js).
 */

function renderEqListHeader() {
    return `
        <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900" data-i18n="eqPresets.title">${t('eqPresets.title')}</h3>
            <div class="flex items-center gap-1 shrink-0">
                <button id="btn-eq-drawer-add" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600" title="${t('eqPresets.addButton.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg></button>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
    `;
}

/** @param {object[]} presets @param {string} activeId */
function renderEqListBody(presets, activeId) {
    return presets.map((p) => {
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
}

/** @param {{id: string, name: string, locked: boolean}} preset @param {boolean} isBuiltIn - preset
 * gốc (1 trong 6 id cố định của buildDefaultEqPresets(), core/eq-presets.js) — Workflow tự tính
 * (Rule 3, component KHÔNG tự tra core) rồi truyền vào, quyết định hiện/ẩn nút "Khôi phục mặc định". */
function renderEqEditHeader(preset, isBuiltIn) {
    // FIX (12/08/2026, Giang yêu cầu — "eq mặc định có nút reset ở header") — preset GỐC (built-in,
    // isBuiltIn=true) mà CHƯA khoá (5/6 preset gốc sửa được, xem core/eq-presets.js) giờ có thêm
    // icon "khôi phục mặc định" cạnh Lưu, GỘP CHUNG 1 wrapper flex bên phải (KHÔNG 2 toạ độ absolute
    // cứng riêng — tránh đè lên nhau nếu 1 trong 2 đổi độ rộng) — CHỈ đổi _draftGains về giá trị GỐC
    // lúc seed lần đầu (KHÔNG tự lưu DB — vẫn phải bấm Lưu mới ghi, cùng 1 cửa duy nhất với sửa
    // tay), xem event/workflow/eq-presets.js::_resetEditToDefault().
    const resetBtn = (!preset.locked && isBuiltIn)
        ? `<button id="btn-eq-drawer-reset" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500 shrink-0" title="${t('eqPresets.resetButton.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M4 9a8 8 0 1 1 2.34 5.66" /></svg></button>`
        : '';
    const saveBtn = preset.locked ? '' : `<button id="btn-generic-drawer-save" class="px-3 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white text-sm font-medium shrink-0" data-i18n="eqPresets.save">${t('eqPresets.save')}</button>`;
    return `
        <div class="relative flex items-center justify-center px-14 py-3 border-b border-slate-200">
            <button id="btn-generic-drawer-back" class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600 shrink-0" title="${t('eqPresets.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg></button>
            <h3 class="text-sm font-bold text-slate-900 truncate px-10" data-i18n="eqPresets.editTitle">${t('eqPresets.editTitle')}</h3>
            <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 shrink-0">${resetBtn}${saveBtn}</div>
        </div>
    `;
}

/** Tính % chiều cao (bottom/height thật, KHÔNG còn qua trục xoay — xem SỬA 12/08/2026 trong CSS
 * .eq-preset-slider*) của dải màu biểu diễn 1 giá trị gain -12..+12 — LUÔN kéo dài từ mốc 0dB
 * (giữa track, bottom 50%) lên/xuống phía giá trị hiện tại, để thấy NGAY hướng tăng/giảm bằng mắt.
 * @param {number} gain -12..12 @returns {{bottom: number, height: number}} % */
function computeEqFillRect(gain) {
    const clamped = Math.max(-12, Math.min(12, gain));
    const height = (Math.abs(clamped) / 24) * 100;
    const bottom = clamped >= 0 ? 50 : 50 - height;
    return { bottom, height };
}

/** @param {{id: string, name: string, gains: number[], locked: boolean}} preset */
function renderEqEditBody(preset) {
    const sliders = preset.gains.map((g, i) => {
        const fill = computeEqFillRect(g); // dùng lại ở event/workflow/eq-presets.js::_wireEditView() mỗi lần kéo
        return `
        <div class="flex flex-col items-center gap-1.5 w-8 shrink-0">
            <span class="text-[10px] text-violet-600 font-semibold tabular-nums" id="eq-edit-val-${i}">${g > 0 ? `+${g}` : g}</span>
            <div class="eq-preset-slider-box">
                <div class="eq-preset-slider-track"><div class="eq-preset-slider-fill" id="eq-edit-fill-${i}" style="bottom:${fill.bottom}%;height:${fill.height}%;"></div></div>
                <input type="range" class="eq-preset-slider" min="-12" max="12" step="1" value="${g}" data-index="${i}" ${preset.locked ? 'disabled' : ''}>
            </div>
            <span class="text-[9px] text-slate-400 tabular-nums">${EQ_LABELS[i]}</span>
        </div>
    `;
    }).join('');

    return `
        <div class="flex flex-col gap-4">
            <div class="bg-slate-50 border border-slate-200 rounded-2xl px-4 flex items-center justify-between gap-3">
                <label for="eq-drawer-name" class="text-sm text-slate-500 shrink-0" data-i18n="eqPresets.name.label">${t('eqPresets.name.label')}</label>
                <input type="text" id="eq-drawer-name" maxlength="24" value="${escapeHtml(preset.name)}" ${preset.locked ? 'disabled' : ''} class="flex-1 min-w-0 bg-transparent text-right py-3 text-sm text-slate-900 outline-none disabled:opacity-60">
            </div>
            ${preset.locked ? `<p class="text-xs text-slate-400 -mt-2 px-1" data-i18n="eqPresets.lockedHint">${t('eqPresets.lockedHint')}</p>` : ''}
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                <div class="flex items-end gap-2 overflow-x-auto px-1 pb-0.5">${sliders}</div>
            </div>
            ${preset.locked ? '' : `
            <div class="flex gap-2">
                <button id="eq-drawer-apply" type="button" class="flex-1 py-3 rounded-2xl bg-sky-50 hover:bg-sky-100 transition-colors text-sky-600 text-sm font-medium" data-i18n="eqPresets.apply">${t('eqPresets.apply')}</button>
                <button id="eq-drawer-delete" type="button" class="flex-1 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 transition-colors text-rose-600 text-sm font-medium" data-i18n="eqPresets.delete">${t('eqPresets.delete')}</button>
            </div>`}
        </div>
    `;
}
