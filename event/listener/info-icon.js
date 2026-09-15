/**
 * event/listener/info-icon.js — Listener DUY NHẤT cho MỌI icon (i) tạo bởi core/info-icon-ui.js::
 * infoIconHtml() (bất kể xuất hiện ở template/panel nào). DELEGATION trên `document.body` (icon (i)
 * có thể chèn ở BẤT KỲ template tĩnh nào — Generic Drawer content, Settings, Player...) — KHÔNG có 1
 * container ổn định chung như `genericDrawerBody` cho MỌI nơi dùng, `document.body` là điểm neo DUY
 * NHẤT LUÔN tồn tại từ đầu tới cuối vòng đời app, không cần guard `if (...)`.
 *
 * NẠP SAU: event/bus.js, event/router/info-icon.js.
 */
document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-icon-btn');
    if (!btn) return;
    eventBus.send({ router: 'infoIcon', type: 'infoIcon.click', payload: { text: btn.dataset.infoText || '' } });
});
