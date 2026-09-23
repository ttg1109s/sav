/**
 * Component: màn Settings > System > Pagination — MỚI (23/09/2026, Giang yêu cầu).
 *
 * SỬA cùng ngày (Giang: "những nơi áp dụng được liệt kê checkbox vuông tại setting, khi true thì nơi đó
 * áp dụng, mỗi checkbox có ô input nhập item/page + style riêng"; "không chọn cứng sẵn số lượng item/
 * page, cho người dùng input number max 200") — mỗi NƠI (PAGINATION_PLACES, core/pagination.js) là 1
 * card: checkbox vuông + tên + mô tả; BẬT thì card mở thêm ô nhập số item/trang (1..200), select kiểu
 * và 1 thanh Preview (dựng bằng đúng pipeline thật — workflowPagination.buildPreviewHtml(), Workflow
 * truyền vào `previewHtmlByPlace`; `inert` + `aria-hidden`, chỉ để xem). TẮT thì ẩn cả 3.
 *
 * Logic: event/workflow/app-settings.js (_renderPagination()) + event/workflow/pagination.js. Wiring:
 * core/app-settings-ui.js::wireAppSettingsPagination() (Rule 5a) — mọi control mang `data-pagination-
 * place="<key>"` để wiring biết đang đổi nơi nào.
 * NẠP SAU: core/pagination.js (PAGINATION_PLACES/PAGINATION_STYLES/PAGINATION_PAGE_SIZE_MIN/MAX), lang/lang.js.
 */

/** @param {Object<string, {enabled:boolean, pageSize:number, style:string}>} settingsByPlace -
 *        workflowPagination.getPlaceSettings() của từng nơi
 * @param {Object<string, string>} previewHtmlByPlace - workflowPagination.buildPreviewHtml() của từng nơi đang BẬT
 * @returns {string} */
function renderPaginationSettingsBody(settingsByPlace, previewHtmlByPlace) {
    const cardsHtml = PAGINATION_PLACES.map((place) => {
        const s = settingsByPlace[place.key];
        const styleOptionsHtml = PAGINATION_STYLES.map((st) => `<option value="${st.value}" ${s.style === st.value ? 'selected' : ''}>${t(st.labelKey)}</option>`).join('');
        const detailHtml = !s.enabled ? '' : `
            <div class="border-t" data-uitk="dividerBorder">
                <div class="flex justify-between items-center gap-3 px-4 py-3">
                    <span class="text-sm font-medium">${t('appSettings.pagination.pageSize.label')}</span>
                    <input type="number" inputmode="numeric" min="${PAGINATION_PAGE_SIZE_MIN}" max="${PAGINATION_PAGE_SIZE_MAX}" step="1" value="${s.pageSize}" data-pagination-place="${place.key}" data-pagination-field="pageSize" class="w-20 rounded-lg px-2 py-1.5 text-xs outline-none text-right" data-uitk="inputBg inputBorder inputText" aria-label="${t('appSettings.pagination.pageSize.label')}">
                </div>
                <div class="flex justify-between items-center gap-3 px-4 pb-3">
                    <span class="text-sm font-medium">${t('appSettings.pagination.style.label')}</span>
                    <select data-pagination-place="${place.key}" data-pagination-field="style" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText" aria-label="${t('appSettings.pagination.style.label')}">
                        ${styleOptionsHtml}
                    </select>
                </div>
                <div class="mx-3 mb-3 rounded-xl" data-uitk="btnNeutralBg" inert aria-hidden="true" style="pointer-events:none;">
                    ${previewHtmlByPlace[place.key] || ''}
                </div>
            </div>`;
        return `
            <div class="rounded-2xl overflow-hidden" data-uitk="cardBg cardBorder">
                <label class="flex items-center gap-3 p-4 cursor-pointer">
                    <input type="checkbox" data-pagination-place="${place.key}" data-pagination-field="enabled" class="w-5 h-5 rounded shrink-0" data-uitk="accentControl" ${s.enabled ? 'checked' : ''}>
                    <span class="min-w-0">
                        <span class="block text-sm font-semibold" data-uitk="textSecondaryStrong">${t(place.labelKey)}</span>
                        <span class="block text-xs mt-0.5 leading-snug" data-uitk="textSecondary">${t(place.hintKey)}</span>
                    </span>
                </label>
                ${detailHtml}
            </div>`;
    }).join('');

    return `
        <div>
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText">${t('appSettings.pagination.places.label')}</h3>
            <div class="flex flex-col gap-2">${cardsHtml}</div>
            <p class="text-xs mt-2 mx-2 leading-snug" data-uitk="textSecondary">${tFormat('appSettings.pagination.places.hint', { max: PAGINATION_PAGE_SIZE_MAX })}</p>
        </div>
    `;
}
