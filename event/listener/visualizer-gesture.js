/**
 * event/listener/visualizer-gesture.js — TẤT CẢ listener của cụm "visualizerGesture".
 *
 * Gắn trên #visualizer-gesture-surface (core/dom-refs.js — visualizerGestureSurface), KHÔNG phải
 * bgVideoElement (khác bản cũ đã bỏ) — lớp phủ riêng nên luôn nhận được touch bất kể đang phát
 * Song hay Video.
 */
if (visualizerGestureSurface) {
    visualizerGestureSurface.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        eventBus.send({ router: 'visualizerGesture', type: 'visualizerGesture.touch.start', payload: { x: t.clientX, y: t.clientY } });
    }, { passive: true });

    visualizerGestureSurface.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        eventBus.send({ router: 'visualizerGesture', type: 'visualizerGesture.touch.end', payload: { x: t.clientX, y: t.clientY } });
    }, { passive: true });
}
