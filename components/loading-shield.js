/**
 * Component: Loading Shield (màn hình che khi đang xử lý / nạp nhạc)
 * Biến này chứa chuỗi HTML, được main.js chèn vào DOM lúc khởi động.
 *
 * MỚI (10/09/2026, Giang yêu cầu — "lối tắt cưỡng chế mở Debug Console ngay trên layer loading
 * shield") — `#btn-loading-shield-debug` SỐNG NGAY BÊN TRONG chính shield này (KHÔNG phải 1 nút
 * riêng ở nơi khác) — nên tự động THỪA HƯỞNG đúng trạng thái pointer-events của shield cha
 * (`withLoadingShield()`, core/loading-shield-util.js, toggle `pointer-events-none` <->
 * `pointer-events-auto` + `opacity-0` <-> `opacity-100` trên CHÍNH #loading-shield): shield đang ẩn
 * (hoạt động bình thường) -> nút này CŨNG không bấm được/không thấy được (không cần CSS override gì
 * thêm); shield đang hiện (đang xử lý/bị kẹt) -> nút này CŨNG bấm được NGAY LẬP TỨC, không phụ thuộc
 * việc tác vụ bên dưới có đang treo hay không. Xem event/workflow/settings-misc.js::
 * forceOpenDebugConsole() để biết cách mở Generic Drawer ĐÈ LÊN TRÊN z-index của shield.
 */
const TPL_LOADING_SHIELD = `
    <div id="loading-shield" class="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-200">
        <svg class="animate-spin h-12 w-12 text-sky-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p id="loading-text" class="text-white font-semibold tracking-wider text-sm" data-i18n="loadingShield.text">${t('loadingShield.text')}</p>
        <button id="btn-loading-shield-debug" type="button" class="absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/40 hover:text-white font-mono text-xs transition-colors" title="Debug Console">&gt;_</button>
    </div>
`;
