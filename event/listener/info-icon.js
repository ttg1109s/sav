/**
 * event/listener/info-icon.js — listener duy nhất cho mọi icon (i) (components/info-icon.js::renderInfoIconHtml()). Ủy
 * quyền trên `document.body` vì icon có thể nằm ở bất kỳ template nào. Nút X / scrim của popover gắn ở
 * core/info-icon-ui.js::mountInfoPopover() (DOM tạo động).
 *
 * NẠP SAU: event/bus.js, event/router/info-icon.js.
 */
document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.info-icon-btn');
    if (!btn) return;
    eventBus.send({ router: 'infoIcon', type: 'infoIcon.click', payload: { text: btn.dataset.infoText || '', anchorEl: btn } });
});
