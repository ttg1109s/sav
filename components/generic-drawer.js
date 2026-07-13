/**
 * Component: Generic Drawer — khung HTML dùng CHUNG (mục 2 plan-v12-extended.md), lấy NGUYÊN từ
 * components/document-picker-drawer.js CŨ (ĐÃ XOÁ — xoá tay nếu còn sót trên máy) — đổi id/class
 * sang trung tính `generic-drawer*`. Document List+Reader dùng (xem
 * event/workflow/document-reader.js) — Settings/File Manager Song/Photo/Folder Detail GIỮ NGUYÊN
 * nav-stack riêng, KHÔNG migrate.
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
 * (List cần cuộn dọc, Read cần overflow-hidden vì tự phân trang — xem
 * event/workflow/document-reader.js).
 *
 * `height` mặc định '70vh' (List) hoặc 'calc(100% - 4rem)' (Read, khớp mốc top-16 mà
 * `#visualizer-control-center` đang neo, xem components/visualizer-overlay.js) — set qua
 * style.height inline lúc gọi openGenericDrawer()/updateGenericDrawer(), KHÔNG cố định ở đây.
 *
 * `z-40`/`z-[39]` ở đây CHỈ là giá trị KHỞI TẠO tĩnh (khớp mặc định của core/generic-drawer.js) —
 * bị ghi đè NGAY bằng style.zIndex inline mỗi lần openGenericDrawer()/updateGenericDrawer() chạy
 * (overlay luôn = zIndex panel - 1).
 *
 * Mục 7 plan-v12-extended.md (Theme Light/Dark/System, KHÔNG code ở Nhóm A): Generic Drawer thuộc
 * vùng LOẠI TRỪ theme — giữ nền TRẮNG cố định, không đổi theo Light/Dark/System.
 */
const TPL_GENERIC_DRAWER = `
    <div id="generic-drawer-overlay" class="hidden fixed inset-0 z-[39] bg-black/50 opacity-0 transition-opacity duration-300 ease-out"></div>
    <div id="generic-drawer-panel" class="hidden fixed inset-x-0 bottom-0 z-40 h-[70vh] bg-white rounded-t-3xl shadow-2xl flex flex-col transform translate-y-full transition-transform duration-300 ease-out pointer-events-auto">
        <div class="flex justify-center pt-3 pb-1 shrink-0">
            <div class="w-10 h-1.5 rounded-full bg-slate-300"></div>
        </div>
        <div id="generic-drawer-header" class="shrink-0"></div>
        <div id="generic-drawer-body" class="flex-1 min-h-0"></div>
    </div>
`;
