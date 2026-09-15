/**
 * event/router/info-icon.js — Router tên "infoIcon".
 * MỚI (phản hồi Giang — icon (i) nhỏ dùng chung, xem core/info-icon-ui.js).
 *
 * NẠP SAU: event/bus.js, event/workflow/info-icon.js.
 * NẠP TRƯỚC: event/listener/info-icon.js.
 */
const routerInfoIcon = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'infoIcon.click':
                workflowInfoIcon.show(msg.payload.text);
                break;
            default:
                console.warn(`[routerInfoIcon] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('infoIcon', routerInfoIcon);
