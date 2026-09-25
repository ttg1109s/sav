/**
 * event/listener/app-visibility.js — listener cụm "appVisibility" (MỚI 25/09/2026). App bị ẩn/hiện lại (khoá máy,
 * chuyển app, chuyển tab, ẩn PWA) -> gửi message, KHÔNG biết nghiệp vụ (phát nền/dừng render nằm ở Router + Workflow).
 * `document` là đối tượng tĩnh sẵn có, listener đăng ký 1 lần (cùng khuôn event/listener/theme.js — cụm theme vẫn tự
 * nghe riêng cho video nền App Panel, 2 cụm độc lập).
 *
 * NẠP SAU: event/bus.js, event/router/app-visibility.js.
 */
document.addEventListener('visibilitychange', () => {
    eventBus.send({ router: 'appVisibility', type: 'appVisibility.document.change', payload: { visible: document.visibilityState !== 'hidden' } });
});
