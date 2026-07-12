/**
 * event/listener/sav-logo.js — Đăng ký DOM listener cho cụm "savLogo".
 *
 * Việc CHỌN NHÁNH (hover thật vs cảm ứng) là quyết định "đăng ký sự kiện nào" — đúng vai trò của
 * tầng listener (KHÔNG phải nghiệp vụ), nên giữ nguyên ở đây, không đẩy lên router.
 *
 * SỬA (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 14) — listener
 * document 'click' TRƯỚC ĐÂY tự đọc `appState.get('savLogoExpanded')` để quyết định CÓ gửi message
 * hay không — vi phạm "Listener KHÔNG đọc appState để quyết định gì" (readme/event-bus-flow.md
 * mục 1). Giờ LUÔN gửi `savLogo.expand.set: {expand:false}` vô điều kiện mỗi lần bấm ra ngoài —
 * `core/sav-logo.js::setSavLogoExpanded(false)` tự nó idempotent (set lại đúng giá trị cũ nếu logo
 * đã thu sẵn, không có tác dụng phụ gì thêm), nên bỏ điều kiện không đổi hành vi thực tế.
 */
if (savLogo) {
    if (hasRealHoverDevice()) {
        // Desktop có chuột thật — hover tự nhiên như bản gốc, không cần toggle/click.
        savLogo.addEventListener('mouseenter', () => {
            eventBus.send({ router: 'savLogo', type: 'savLogo.expand.set', payload: { expand: true } });
        });
        savLogo.addEventListener('mouseleave', () => {
            eventBus.send({ router: 'savLogo', type: 'savLogo.expand.set', payload: { expand: false } });
        });
    } else {
        // Mobile/cảm ứng — 'click' trên chính logo TOGGLE mở/thu. 'click' ở DOCUMENT (capture
        // phase, chạy TRƯỚC handler của logo ở bubble phase phía dưới) tự THU LẠI nếu điểm bấm
        // nằm ngoài logo — đúng cảm giác "bấm chỗ khác thì tự đóng" như hover thật.
        savLogo.addEventListener('click', (e) => {
            e.stopPropagation(); // không để listener document (đăng ký dưới đây) coi đây là "bấm ra ngoài"
            eventBus.send({ router: 'savLogo', type: 'savLogo.expand.toggle', payload: {} });
        });
        document.addEventListener('click', () => {
            eventBus.send({ router: 'savLogo', type: 'savLogo.expand.set', payload: { expand: false } });
        });
    }
}
