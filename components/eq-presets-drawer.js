/**
 * Component: nội dung Generic Drawer "Edit EQ" (event/workflow/eq-presets.js mở khi GIỮ 1.5s #btn-cycle-eq). 2 mode:
 *   - 'list': danh sách preset (tên + chấm "đang dùng" + khoá-icon nếu locked) + nút "+" trong HEADER — tạo NGAY 1
 *     preset tên tự sinh ("New preset", "New preset 2"...) rồi mở thẳng Edit.
 *   - 'edit': hàng "Name | input" + 10 dòng slider NGANG -12..+12 (khoá nếu locked) + Áp dụng + Xoá (Xoá ẩn nếu
 *     locked). Không có nút Lưu: chỉnh là tự lưu, preset đang áp dụng thì có tác dụng ngay; Áp dụng có trạng thái khoá
 *     "Đang áp dụng" (xem renderEqEditBody()). Preset gốc chưa khoá có thêm nút "Khôi phục mặc định" ở header.
 *
 * Màu qua `data-uitk` (theme). Sự kiện: event/listener/eq-presets.js ủy quyền 1 lần trên genericDrawerBody/Header, nhận
 * phần tử qua id/attribute có tiền tố cụm (`data-eq-close`, `data-eq-back`, `data-eq-id` hàng List,
 * `data-eq-apply-id`/`data-eq-reset-id`/`data-eq-delete-id` mang id preset, `.eq-band-slider` + `data-index`,
 * `#eq-drawer-name`, `#btn-eq-drawer-add`). Id nút chrome chung (#btn-generic-drawer-close/back) giữ nguyên.
 */

function renderEqListHeader() {
    return buildDrawerHeaderHtml({ // components/generic-drawer.js
        title: t('eqPresets.title'), titleAttrs: 'data-i18n="eqPresets.title"',
        closeAttrs: 'data-eq-close="1"', // Listener ủy quyền nhận đúng nút X của EQ (id X dùng chung mọi Drawer)
        actionsHtml: `<button type="button" id="btn-eq-drawer-add" class="w-8 h-8 flex items-center justify-center rounded-full" data-uitk="cardHoverBg textSecondaryStrong" title="${t('eqPresets.addButton.title')}">${iconSvg('plus', 'h-5 w-5')}</button>`,
    });
}

/** `presets` = đúng trang cần vẽ (Workflow cắt sẵn theo nơi 'eqPresets' của Settings > System > Pagination);
 * `paginationHtml` ('' khi tắt/1 trang) đặt trong `#eq-list-pagination` cuối danh sách để Workflow wire
 * (core/pagination-ui.js).
 * @param {Array} presets @param {string} activeId @param {string} [paginationHtml] */
function renderEqListBody(presets, activeId, paginationHtml) {
    return presets.map((p) => {
        const isActive = p.id === activeId;
        const rowUitk = isActive ? 'rowActiveBg rowActiveBorder' : 'btnGhostHoverBg';
        return `
        <button type="button" data-eq-id="${p.id}" class="w-full text-left px-4 py-3.5 rounded-xl mb-1.5 flex items-center justify-between gap-3 transition-colors ${isActive ? '' : 'border border-transparent'}" data-uitk="${rowUitk}">
            <span class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold truncate" data-uitk="textPrimary">${escapeHtml(p.name)}</span>
                ${isActive ? `<span class="shrink-0 w-1.5 h-1.5 rounded-full" data-uitk="btnPrimaryPillBg"></span>` : ''}
                ${p.locked ? iconSvg('lock-closed', 'h-3.5 w-3.5 shrink-0', 'data-uitk="textMutedIcon"') : ''}
            </span>
            ${iconSvg('chevron-right', 'h-4 w-4 shrink-0', 'data-uitk="textMutedIcon"')}
        </button>
    `;
    }).join('') + `<div id="eq-list-pagination">${paginationHtml || ''}</div>`;
}

/** @param {{id: string, name: string, locked: boolean}} preset @param {boolean} isBuiltIn - preset
 * gốc (1 trong 6 id cố định của buildDefaultEqPresets(), core/eq-presets.js) — Workflow tự tính
 * (Rule 3, component KHÔNG tự tra core) rồi truyền vào, quyết định hiện/ẩn nút "Khôi phục mặc định". */
function renderEqEditHeader(preset, isBuiltIn) {
    // Preset GỐC (built-in) chưa khoá có nút "khôi phục mặc định" ở header — ghi lại gains GỐC lúc seed, xem
    // event/workflow/eq-presets.js::_resetEditToDefault().
    const resetBtn = (!preset.locked && isBuiltIn)
        ? `<button id="btn-eq-drawer-reset" data-eq-reset-id="${preset.id}" class="w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0" data-uitk="headerCloseHover headerCloseIcon" title="${t('eqPresets.resetButton.title')}">${iconSvg('reset', 'h-[18px] w-[18px]')}</button>`
        : '';
    return buildDrawerHeaderHtml({ // components/generic-drawer.js
        backId: 'btn-generic-drawer-back', backAttrs: 'data-eq-back="1"', backTitle: t('eqPresets.title'), // backAttrs — xem docstring đầu file
        title: t('eqPresets.editTitle'), titleAttrs: 'data-i18n="eqPresets.editTitle"',
        actionsHtml: resetBtn, close: false,
    });
}

/** 10 kênh = 10 DÒNG ngang (nhãn tần số | slider | giá trị dB), cùng kiểu hàng slider các màn Settings khác. Nút Áp
 * dụng có 2 trạng thái: chưa áp dụng (nút nhấn) / ĐANG áp dụng (khoá — vẫn bấm được để hiện thông báo "đang áp dụng
 * rồi", xem event/workflow/eq-presets.js::onApplyClick()). Nút Áp dụng/Xoá mang `data-eq-apply-id`/`data-eq-delete-id`
 * = id preset (Listener đọc làm payload).
 * @param {{id: string, name: string, gains: number[], locked: boolean}} preset
 * @param {boolean} isActive - preset này đang là preset được chọn (`eqPresetId`) — Workflow tự tính. */
function renderEqEditBody(preset, isActive) {
    const rows = preset.gains.map((g, i) => `
                <div class="flex items-center gap-3 px-4 py-3${i < preset.gains.length - 1 ? ' border-b' : ''}"${i < preset.gains.length - 1 ? ' data-uitk="dividerBorder"' : ''}>
                    <span class="w-10 shrink-0 text-xs tabular-nums" data-uitk="textSecondary">${EQ_LABELS[i]}</span>
                    <input type="range" class="eq-band-slider flex-1 min-w-0" min="-12" max="12" step="1" value="${g}" data-index="${i}" data-uitk="accentControl" ${preset.locked ? 'disabled' : ''}>
                    <span class="w-10 shrink-0 text-right text-xs font-semibold tabular-nums" data-uitk="textPrimary" id="eq-edit-val-${i}">${g > 0 ? `+${g}` : g}</span>
                </div>`).join('');
    const applyBtn = isActive
        ? `<button id="eq-drawer-apply" type="button" data-eq-apply-id="${preset.id}" data-eq-applied="1" class="${preset.locked ? 'w-full' : 'flex-1'} py-3 rounded-2xl transition-colors text-sm font-medium flex items-center justify-center gap-1.5" data-uitk="btnNeutralBg btnNeutralText">${iconSvg('lock-closed', 'h-4 w-4 shrink-0')}<span data-i18n="eqPresets.applied">${t('eqPresets.applied')}</span></button>`
        : `<button id="eq-drawer-apply" type="button" data-eq-apply-id="${preset.id}" class="${preset.locked ? 'w-full' : 'flex-1'} py-3 rounded-2xl transition-colors text-sm font-medium" data-uitk="btnAccentSoft" data-i18n="eqPresets.apply">${t('eqPresets.apply')}</button>`;

    return `
        <div class="flex flex-col gap-4">
            <div class="rounded-2xl px-4 flex items-center justify-between gap-3" data-uitk="cardBg cardBorder">
                <label for="eq-drawer-name" class="text-sm shrink-0" data-uitk="textSecondary" data-i18n="eqPresets.name.label">${t('eqPresets.name.label')}</label>
                <input type="text" id="eq-drawer-name" maxlength="24" value="${escapeHtml(preset.name)}" ${preset.locked ? 'disabled' : ''} class="flex-1 min-w-0 bg-transparent text-right py-3 text-sm outline-none disabled:opacity-60" data-uitk="textPrimary">
            </div>
            ${preset.locked ? `<p class="text-xs -mt-2 px-1" data-uitk="textMutedIcon" data-i18n="eqPresets.lockedHint">${t('eqPresets.lockedHint')}</p>` : ''}
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">${rows}
            </div>
            ${preset.locked ? applyBtn : `
            <div class="flex gap-2">
                ${applyBtn}
                <button id="eq-drawer-delete" type="button" data-eq-delete-id="${preset.id}" class="flex-1 py-3 rounded-2xl transition-colors text-sm font-medium" data-uitk="btnDestructiveSoft" data-i18n="eqPresets.delete">${t('eqPresets.delete')}</button>
            </div>`}
        </div>
    `;
}
