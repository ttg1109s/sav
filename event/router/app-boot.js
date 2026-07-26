/**
 * event/router/app-boot.js — Router tên "appBoot", tự đăng ký với eventBus lúc nạp. SỬA
 * (25/07/2026, đợt tái cấu trúc state) — TRƯỚC ĐÂY file này tự đăng ký thẳng
 * `document.addEventListener('DOMContentLoaded', ...)` chứa NGUYÊN chuỗi boot — giờ chỉ còn
 * đúng vai trò Router (nhận message từ event/listener/app-boot.js, chọn workflow/core tương ứng).
 * Chuỗi boot thật SỰ nay ở event/workflow/app-boot.js.
 *
 * NẠP SAU: event/bus.js, event/workflow/app-boot.js (workflowAppBoot), core/fatal-error.js
 * (_reportFatalError).
 * NẠP TRƯỚC: event/listener/app-boot.js.
 */
const routerAppBoot = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'app.boot':
                workflowAppBoot.boot();
                break;
            case 'app.fatalError':
                // Không cần appState/chuẩn bị gì — gọi THẲNG Core, không qua Workflow (đúng phân
                // loại event-bus-flow.md mục 4C: hành vi không đọc/ghi appState).
                _reportFatalError(msg.payload.context, msg.payload.err);
                break;
            default:
                console.warn(`[routerAppBoot] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('appBoot', routerAppBoot);
