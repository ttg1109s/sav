/**
 * event/listener/subtitle-modal.js — TẤT CẢ listener của cụm "subtitleModal".
 *
 * SỬA (10/07/2026) — `btnSubtitle` giờ gửi 'toggleEnabled.click' (bật/tắt nhanh), KHÔNG còn mở
 * Subtitle Editor nữa (xem docstring đầu event/router/subtitle-modal.js).
 */
if (btnSubtitle) {
    btnSubtitle.addEventListener('click', () => {
        eventBus.send({ router: 'subtitleModal', type: 'subtitleModal.toggleEnabled.click', payload: {} });
    });
}
