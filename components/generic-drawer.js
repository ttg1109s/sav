/**
 * Component: Generic Drawer — khung HTML dùng CHUNG cho nhiều tính năng (Settings, Folder Browser, Add to Folder picker,
 * EQ Presets, Custom Effect, Storage...).
 *
 * `#generic-drawer-overlay` (nền mờ toàn màn hình) có `transition-opacity` RIÊNG — core/generic-drawer.js tự đồng bộ 2
 * lớp qua `closeGenericDrawer()`/`hideGenericDrawerImmediately()`. `pointer-events` do core bật/gỡ qua class
 * `pointer-events-auto`, KHÔNG cố định trong markup: mặc định cho lọt thao tác qua (an toàn nếu core lỡ quên gỡ), core
 * phải chủ động BẬT lúc mở.
 *
 * Header/Body RỖNG lúc mount tĩnh — core/generic-drawer.js (qua event/workflow/generic-drawer-helpers.js) tự gán nội
 * dung mỗi lần mở/chuyển cấu hình; sự kiện bên trong do Listener của từng cụm ủy quyền trên genericDrawerBody/Header
 * hoặc hàm wire của core -ui (Rule 5a) — component KHÔNG biết nội dung là gì (quy ước "component tĩnh + dom-refs").
 *
 * `#generic-drawer-body`: base class CHỈ `flex-1 min-h-0` — overflow/padding/relative do `bodyClass` (tham số mở/cập
 * nhật) quyết định theo TỪNG ngữ cảnh. `height` mặc định '70vh' hoặc tuỳ tính năng — set inline lúc mở/cập nhật.
 *
 * `z-40`/`z-[39]` ở đây CHỈ là giá trị KHỞI TẠO tĩnh (khớp mặc định của core/generic-drawer.js) — bị ghi đè bằng
 * style.zIndex inline mỗi lần mở/cập nhật (overlay luôn = zIndex panel - 1).
 *
 * Theme: panel/header/handle gắn `data-uitk` (core/ui-theme/apply-ui.js đồng bộ class theo theme đang active; styling
 * Generic Drawer chính là bộ Light gốc — core/ui-theme/light.js). CHỈ `#generic-drawer-overlay` không đổi theo theme
 * (chủ đích — "làm tối phần còn lại của app", xem `overlayBg` ở core/ui-theme/light.js).
 *
 * Panel có `bottom-0` TĨNH (neo đáy), trượt lên/xuống bằng `style.transform` (`translateY(100%)`/`translateY(0)`, xem
 * core/generic-drawer.js) — `translateY(100%)` luôn đẩy đúng 1 lần chiều cao chính nó, JS không cần biết trước số px.
 */
const TPL_GENERIC_DRAWER = `
    <div id="generic-drawer-overlay" class="hidden fixed inset-0 z-[39] opacity-0 transition-opacity duration-300 ease-out" data-uitk="overlayBg"></div>
    <div id="generic-drawer-panel" class="hidden fixed inset-x-0 bottom-0 z-40 rounded-t-3xl flex flex-col pointer-events-auto" data-uitk="panelBg panelShadow">
        <div class="flex justify-center pt-3 pb-1 shrink-0">
            <div class="w-10 h-1.5 rounded-full" data-uitk="dragHandleBg"></div>
        </div>
        <div id="generic-drawer-header" class="shrink-0"></div>
        <div id="generic-drawer-body" class="flex-1 min-h-0"></div>
    </div>
`;

/**
 * Header DÙNG CHUNG cho mọi màn Generic Drawer (cùng padding/nút/màu hover). 2 bố cục:
 *   - 'start' (mặc định): [tiêu đề | (nút phụ) (X)] — màn danh sách/công cụ.
 *   - 'center': tiêu đề GIỮA, nút Back tuyệt đối bên trái, (nút phụ)(X) tuyệt đối bên phải — màn con có Back (Settings,
 *     Edit EQ, chọn font, Filter của folder...). Có `backId` mà không truyền `layout` -> tự dùng 'center'.
 * Nút Back/X cùng 1 kiểu (w-8 h-8, headerCloseHover headerCloseIcon), icon lấy từ kho chung (iconSvg()). Id nút theo
 * tham số; `closeAttrs`/`backAttrs` gắn attribute riêng của cụm để Listener ủy quyền nhận đúng nút của mình (id X/Back
 * dùng chung mọi Drawer).
 * @param {object} o
 * @param {string} [o.title] - tiêu đề đã dịch (dữ liệu người dùng phải escape sẵn)
 * @param {string} [o.titleAttrs] - thuộc tính thêm cho <h3>, vd 'data-i18n="eqPresets.title"'
 * @param {string} [o.titleSuffixHtml] - đứng ngay sau tiêu đề (vd nút (i)) — chỉ bố cục 'start'
 * @param {string} [o.leftHtml] - THAY cả khối tiêu đề (vd hàng tab) — chỉ bố cục 'start'
 * @param {string} [o.backId] - id nút Back (có -> hiện nút Back)
 * @param {string} [o.backTitle] - tooltip nút Back (mặc định common.back)
 * @param {string} [o.backAttrs] - thuộc tính thêm cho nút Back, vd 'data-eq-back="1"'
 * @param {string} [o.actionsHtml] - nút phụ đứng TRƯỚC nút đóng
 * @param {boolean} [o.close=true] - có nút đóng không
 * @param {string} [o.closeId='btn-generic-drawer-close']
 * @param {string} [o.closeAttrs] - thuộc tính thêm cho nút đóng, vd 'data-ce-close="1"'
 * @param {'start'|'center'} [o.layout]
 * @returns {string}
 */
function buildDrawerHeaderHtml(o) {
    const opts = Object.assign({ title: '', titleAttrs: '', titleSuffixHtml: '', leftHtml: '', backId: '', backTitle: t('common.back'), backAttrs: '', actionsHtml: '', close: true, closeId: 'btn-generic-drawer-close', closeAttrs: '', layout: '' }, o);
    const btnClass = 'w-8 h-8 flex items-center justify-center rounded-full shrink-0';
    const closeHtml = opts.close ? `<button type="button" id="${opts.closeId}" class="${btnClass}" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}"${opts.closeAttrs ? ` ${opts.closeAttrs}` : ''}>${iconSvg('x', 'h-5 w-5')}</button>` : '';
    const rightHtml = `${opts.actionsHtml}${closeHtml}`;
    const titleHtml = `<h3 class="text-base truncate${opts.backId || opts.layout === 'center' ? ' text-center' : ''}" data-uitk="headerTitle"${opts.titleAttrs ? ` ${opts.titleAttrs}` : ''}>${opts.title}</h3>`;
    const layout = opts.layout || (opts.backId ? 'center' : 'start');
    if (layout === 'center') {
        const backHtml = opts.backId ? `<button type="button" id="${opts.backId}" class="absolute left-4 top-1/2 -translate-y-1/2 ${btnClass}" data-uitk="headerCloseHover headerCloseIcon" title="${opts.backTitle}"${opts.backAttrs ? ` ${opts.backAttrs}` : ''}>${iconSvg('chevron-left', 'h-5 w-5')}</button>` : '';
        return `
            <div class="relative flex items-center justify-center px-14 py-3" data-uitk="headerBorder">
                ${backHtml}
                ${titleHtml}
                ${rightHtml ? `<div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">${rightHtml}</div>` : ''}
            </div>`;
    }
    const left = opts.leftHtml || (opts.titleSuffixHtml ? `<div class="flex items-center gap-2 min-w-0">${titleHtml}${opts.titleSuffixHtml}</div>` : titleHtml);
    return `
        <div class="flex justify-between items-center gap-2 px-5 pb-3" data-uitk="headerBorder">
            ${left}
            ${rightHtml ? `<div class="flex items-center gap-1 shrink-0">${rightHtml}</div>` : ''}
        </div>`;
}
