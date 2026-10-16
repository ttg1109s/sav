/**
 * event/listener/wakelock.js — lần chạm/bấm ĐẦU TIÊN vào trang (Wake Lock chỉ xin được sau cử chỉ người dùng). `{ once: true }`
 * tự gỡ sau 1 lần; chạm rồi bấm thì gửi 2 lần — Workflow tự chống xin chồng.
 * NẠP SAU: event/bus.js, event/router/wakelock.js.
 */
['touchstart', 'click'].forEach((eventName) => {
    document.body.addEventListener(eventName, () => {
        eventBus.send({ router: 'wakeLock', type: 'wakeLock.firstInteraction', payload: {} });
    }, { once: true });
});
