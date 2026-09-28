/**
 * event/listener/visualizer-viewport.js — Listener cụm "visualizerViewport" (MỚI 28/09/2026, Phase 3 dọn visualizer).
 * Chỉ chuyển thư: cửa sổ đổi kích thước (xoay máy, thanh địa chỉ co/giãn, đổi cửa sổ desktop) -> Router.
 */
window.addEventListener('resize', () => {
    eventBus.send({ router: 'visualizerViewport', type: 'visualizerViewport.window.resize', payload: {} });
});
