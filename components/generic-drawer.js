/**
 * Component: Generic Drawer — khung HTML dùng CHUNG (mục 2 plan-v12-extended.md) cho nhiều tính
 * năng (hiện tại: Folder Browser, Add to Folder picker, EQ Presets, Custom Effect...) — Settings/
 * File Manager Song/Photo/Folder Detail GIỮ NGUYÊN nav-stack riêng, KHÔNG migrate.
 *
 * [SỬA 13/07/2026, Giang yêu cầu] — KHÔI PHỤC lại `#generic-drawer-overlay` (nền mờ `bg-black/50`
 * che toàn màn hình, ĐÃ BỎ 10/07/2026 vì bug timing — xem lịch sử ở core/generic-drawer.js). Lần
 * này overlay có `transition-opacity` RIÊNG (không dùng chung timing với panel qua CSS, core tự
 * đồng bộ 2 lớp qua `closeGenericDrawer()`/`hideGenericDrawerImmediately()`) — `pointer-events`
 * chuyển qua class `pointer-events-auto`/(gỡ) do core toggle, KHÔNG cố định trong markup (mặc định
 * KHÔNG có `pointer-events-auto` — an toàn, tránh lặp lại bug "che chắn UI mãi mãi" nếu core lỡ
 * quên gỡ: mặc định luôn CHO LỌT thao tác qua, core phải chủ động BẬT lúc mở).
 *
 * Header/Body RỖNG lúc mount tĩnh — core/generic-drawer.js (openGenericDrawer()/
 * updateGenericDrawer()) tự gán nội dung mỗi lần mở/chuyển cấu hình, Workflow tự querySelector
 * bên trong SAU khi gán để wire event (component KHÔNG biết nội dung là gì, đúng quy ước
 * "component tĩnh + dom-refs" sẵn có của app).
 *
 * `#generic-drawer-body`: base class CHỈ `flex-1 min-h-0` — overflow/padding/relative do
 * `bodyClass` (tham số openGenericDrawer()/updateGenericDrawer()) quyết định theo TỪNG ngữ cảnh
 * (tuỳ tính năng cần cuộn dọc hay overflow-hidden).
 *
 * `height` mặc định '70vh', hoặc tuỳ chỉnh theo TỪNG tính năng — set qua
 * style.height inline lúc gọi openGenericDrawer()/updateGenericDrawer(), KHÔNG cố định ở đây.
 *
 * `z-40`/`z-[39]` ở đây CHỈ là giá trị KHỞI TẠO tĩnh (khớp mặc định của core/generic-drawer.js) —
 * bị ghi đè NGAY bằng style.zIndex inline mỗi lần openGenericDrawer()/updateGenericDrawer() chạy
 * (overlay luôn = zIndex panel - 1).
 *
 * Mục 7 plan-v12-extended.md (Theme Light/Dark/System, KHÔNG code ở Nhóm A) TỪNG loại Generic
 * Drawer khỏi mọi hệ theme, giữ nền TRẮNG cố định — QUYẾT ĐỊNH ĐÓ ĐÃ HUỶ (09/09/2026, Giang yêu cầu
 * xây hệ UI Theme Light/Dark/Morphin THẬT, lấy CHÍNH styling Generic Drawer làm bộ Light gốc — xem
 * core/ui-theme/light.js). Panel/header/handle giờ gắn `data-uitk` (core/ui-theme/apply-ui.js tự
 * đồng bộ class theo theme đang active) THAY vì hardcode `bg-white`/`border-slate-*` tĩnh như bản
 * cũ — CHỈ `#generic-drawer-overlay` (nền mờ phía sau) GIỮ NGUYÊN không đổi theo theme (chủ đích,
 * xem docstring `overlayBg` ở core/ui-theme/light.js — lớp phủ này là "làm tối phần còn lại của
 * app", ý nghĩa không đổi dù panel đang theme nào).
 *
 * [SỬA 20/08/2026, Giang xác nhận — ĐẢO NGƯỢC quyết định "bỏ transform, dùng position" trước đó,
 * xem lịch sử ngay dưới] — panel giờ có `bottom-0` TĨNH trong class (neo đáy CỐ ĐỊNH, không đổi
 * nữa) — trượt lên/xuống lại bằng `style.transform` (JS set `translateY(100%)`/`translateY(0)`,
 * xem `core/generic-drawer.js`) — LỢI ÍCH: `translateY(100%)` LUÔN đẩy đúng 1 lần chiều cao CHÍNH
 * NÓ bất kể chiều cao thật là bao nhiêu, không cần JS biết trước số px như `bottom` cũ.
 *
 * [LỊCH SỬ] VIẾT LẠI (phản hồi Giang — "bỏ transform, dùng position") — panel từng bỏ hẳn
 * `bottom-0`/`transform translate-y-full`/`transition-transform` TĨNH trong class, chuyển
 * `bottom` hoàn toàn do JS quản lý qua `style.bottom` — nay đảo ngược lại như trên. Xem thuật toán
 * đầy đủ ở docstring `openGenericDrawer()`.
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
 * MỚI (07/10/2026, Giang chốt rà soát SVG — mục B) — header DÙNG CHUNG cho mọi màn Generic Drawer, THAY ~15 bản header viết
 * tay (rải ở components/, core -ui và cả Workflow) vốn lệch nhau ở padding/nút/màu hover. 2 bố cục:
 *   - 'start' (mặc định): [tiêu đề | (nút phụ) (X)] — màn danh sách/công cụ.
 *   - 'center': tiêu đề GIỮA, nút Back tuyệt đối bên trái, (nút phụ)(X) tuyệt đối bên phải — màn con có Back (Settings,
 *     Edit EQ, chọn font, Filter của folder...). Có `backId` mà không truyền `layout` -> tự dùng 'center'.
 * Nút Back/X cùng 1 kiểu (w-8 h-8, headerCloseHover headerCloseIcon), icon lấy từ kho chung (iconSvg()). Id nút giữ
 * nguyên theo tham số -> wiring sẵn có của từng màn không đổi.
 * @param {object} o
 * @param {string} [o.title] - tiêu đề đã dịch (dữ liệu người dùng phải escape sẵn)
 * @param {string} [o.titleAttrs] - thuộc tính thêm cho <h3>, vd 'data-i18n="eqPresets.title"'
 * @param {string} [o.titleSuffixHtml] - đứng ngay sau tiêu đề (vd nút (i)) — chỉ bố cục 'start'
 * @param {string} [o.leftHtml] - THAY cả khối tiêu đề (vd hàng tab) — chỉ bố cục 'start'
 * @param {string} [o.backId] - id nút Back (có -> hiện nút Back)
 * @param {string} [o.backTitle] - tooltip nút Back (mặc định common.back)
 * @param {string} [o.actionsHtml] - nút phụ đứng TRƯỚC nút đóng
 * @param {boolean} [o.close=true] - có nút đóng không
 * @param {string} [o.closeId='btn-generic-drawer-close']
 * @param {string} [o.closeAttrs] - thuộc tính thêm cho nút đóng, vd 'data-ce-close="1"'
 * @param {'start'|'center'} [o.layout]
 * @returns {string}
 */
function buildDrawerHeaderHtml(o) {
    const opts = Object.assign({ title: '', titleAttrs: '', titleSuffixHtml: '', leftHtml: '', backId: '', backTitle: t('common.back'), actionsHtml: '', close: true, closeId: 'btn-generic-drawer-close', closeAttrs: '', layout: '' }, o);
    const btnClass = 'w-8 h-8 flex items-center justify-center rounded-full shrink-0';
    const closeHtml = opts.close ? `<button type="button" id="${opts.closeId}" class="${btnClass}" data-uitk="headerCloseHover headerCloseIcon" title="${t('common.close')}"${opts.closeAttrs ? ` ${opts.closeAttrs}` : ''}>${iconSvg('x', 'h-5 w-5')}</button>` : '';
    const rightHtml = `${opts.actionsHtml}${closeHtml}`;
    const titleHtml = `<h3 class="text-base truncate${opts.backId || opts.layout === 'center' ? ' text-center' : ''}" data-uitk="headerTitle"${opts.titleAttrs ? ` ${opts.titleAttrs}` : ''}>${opts.title}</h3>`;
    const layout = opts.layout || (opts.backId ? 'center' : 'start');
    if (layout === 'center') {
        const backHtml = opts.backId ? `<button type="button" id="${opts.backId}" class="absolute left-4 top-1/2 -translate-y-1/2 ${btnClass}" data-uitk="headerCloseHover headerCloseIcon" title="${opts.backTitle}">${iconSvg('chevron-left', 'h-5 w-5')}</button>` : '';
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
