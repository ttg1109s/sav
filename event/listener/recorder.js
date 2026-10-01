/**
 * event/listener/recorder.js — Listener chế độ Ghi âm (MỚI 01/10/2026). Phần tử TĨNH (components/visualizer-overlay.js
 * + components/recorder-overlay.js, có sẵn lúc boot). Chỉ gửi eventBus. Tương tác modal nghe lại (DOM động) wire ở
 * core/recorder-ui.js::wireRecorderReviewBody().
 * `#recorder-layer` KHÔNG cần listener: pointer-events-auto tự nuốt mọi chạm (cử chỉ Visualizer gắn riêng trên
 * #visualizer-gesture-surface — sự kiện trên overlay không tới được đó).
 * NẠP SAU: core/dom-refs.js (btnRecordStart/btnRecorderStop), event/bus.js, event/router/recorder.js.
 */
if (btnRecordStart) {
    btnRecordStart.addEventListener('click', () => {
        eventBus.send({ router: 'recorder', type: 'recorder.start.click', payload: {} });
    });
}

if (btnRecorderStop) {
    btnRecorderStop.addEventListener('click', () => {
        eventBus.send({ router: 'recorder', type: 'recorder.stop.click', payload: {} });
    });
}
