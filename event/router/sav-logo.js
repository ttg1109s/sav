/**
 * event/router/sav-logo.js — Router tên "savLogo", tự đăng ký với eventBus lúc nạp.
 *
 * `savLogoExpanded` là key `appState` (service/state.js) — KHÔNG phải biến toàn cục.
 *
 * SỬA BUG (phát hiện khi rà soát ver 12): case 'savLogo.expand.toggle' cũ đọc `savLogoExpanded`
 * như 1 biến bare (sót lại từ trước khi migrate sang appState ở ver 11) — biến đó KHÔNG tồn tại ở
 * đâu cả (chỉ appState.get('savLogoExpanded') mới đúng), nên mỗi lần gọi throw ReferenceError
 * NGAY TRONG router.handle() -> setSavLogoExpanded() không bao giờ chạy tới -> bấm logo trên
 * cảm ứng (nhánh dùng 'toggle', xem event/listener/sav-logo.js) không bung ra được. Nhánh hover
 * thật (desktop, dùng 'set') không đụng dòng này nên không lộ bug — đúng cùng dạng bug đã tìm thấy
 * ở event/router/playlist-empty-state.js lúc migrate STATE ver 11 (xem lịch sử dự án).
 *
 * SỬA (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 16) — case 'toggle'
 * ĐÃ DỜI sang `event/workflow/sav-logo.js` (MỚI): tự đọc `appState.get('savLogoExpanded')` để
 * chuẩn bị input cho Core — "chuẩn bị state cho Core" tự nó là Workflow (readme/event-bus-flow.md
 * mục 4B), dù chỉ 1 key, dù chỉ gọi đúng 1 hàm. Case 'set' GIỮ NGUYÊN gọi thẳng Core — payload đã
 * có sẵn `expand` (boolean), KHÔNG cần đọc `appState` gì thêm, đúng (A) như cũ.
 *
 * NẠP SAU: event/bus.js, event/workflow/sav-logo.js.
 * NẠP TRƯỚC: event/listener/sav-logo.js.
 */
const routerSavLogo = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'savLogo.expand.set':
                setSavLogoExpanded(!!msg.payload.expand);
                break;
            case 'savLogo.expand.toggle':
                workflowSavLogo.toggleExpand();
                break;
            default:
                console.warn(`[routerSavLogo] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('savLogo', routerSavLogo);
