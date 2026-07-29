/**
 * event/router/app-boot.js — Router tên "appBoot", tự đăng ký với eventBus lúc nạp. SỬA
 * (25/07/2026, đợt tái cấu trúc state) — TRƯỚC ĐÂY file này tự đăng ký thẳng
 * `document.addEventListener('DOMContentLoaded', ...)` chứa NGUYÊN chuỗi boot — giờ chỉ còn
 * đúng vai trò Router (nhận message từ event/listener/app-boot.js, chọn workflow/core tương ứng).
 * Chuỗi boot thật SỰ nay ở event/workflow/app-boot.js.
 *
 * XOÁ (phản hồi Giang — "phải cho ngay lên hàng đầu trước bất kỳ script nào") — case
 * 'app.fatalError' đã bỏ hẳn: 2 listener error/unhandledrejection từng gửi message này qua
 * eventBus đã DỜI HẲN vào 1 khối <script> inline đầu <body> (index.html, TRƯỚC CẢ Preloader),
 * gọi THẲNG `window._reportFatalError()`, không còn qua eventBus/router nữa (xem comment đầy đủ ở
 * event/listener/app-boot.js) — msg.type này không còn ai gửi tới.
 *
 * NẠP SAU: event/bus.js, event/workflow/app-boot.js (workflowAppBoot).
 * NẠP TRƯỚC: event/listener/app-boot.js.
 */
const routerAppBoot = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'app.boot':
                workflowAppBoot.boot();
                break;
            default:
                console.warn(`[routerAppBoot] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('appBoot', routerAppBoot);
