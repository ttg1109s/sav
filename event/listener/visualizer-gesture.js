/**
 * event/listener/visualizer-gesture.js — TẤT CẢ listener của cụm "visualizerGesture".
 *
 * Gắn trên #visualizer-gesture-surface (core/dom-refs.js — visualizerGestureSurface), KHÔNG phải
 * bgVideoElement (khác bản cũ đã bỏ) — lớp phủ riêng nên luôn nhận được touch bất kể đang phát
 * Song hay Video. touchmove CHỈ dùng để huỷ hẹn giờ seek-hold 3s (xem event/workflow/
 * visualizer-gesture.js), không ảnh hưởng phân loại tap/vuốt (vẫn tính thuần theo start/end).
 */
if (visualizerGestureSurface) {
    visualizerGestureSurface.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        eventBus.send({ router: 'visualizerGesture', type: 'visualizerGesture.touch.start', payload: { x: t.clientX, y: t.clientY } });
    }, { passive: true });

    visualizerGestureSurface.addEventListener('touchmove', (e) => {
        const t = e.changedTouches[0];
        eventBus.send({ router: 'visualizerGesture', type: 'visualizerGesture.touch.move', payload: { x: t.clientX, y: t.clientY } });
    }, { passive: true });

    visualizerGestureSurface.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        eventBus.send({ router: 'visualizerGesture', type: 'visualizerGesture.touch.end', payload: { x: t.clientX, y: t.clientY } });
    }, { passive: true });

    visualizerGestureSurface.addEventListener('touchcancel', () => {
        eventBus.send({ router: 'visualizerGesture', type: 'visualizerGesture.touch.cancel', payload: {} });
    }, { passive: true });
}
