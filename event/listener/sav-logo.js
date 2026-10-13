/**
 * event/listener/sav-logo.js — listener cụm "savLogo". Chọn bộ sự kiện (hover thật / cảm ứng) lúc nạp trang là việc
 * "đăng ký sự kiện nào" của tầng Listener. Bấm ra ngoài luôn gửi `expand:false` (core idempotent) — Listener không đọc state.
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
