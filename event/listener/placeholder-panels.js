/**
 * event/listener/placeholder-panels.js — Listener cụm "placeholderPanels" (MỚI — Game/Statis,
 * chưa có nghiệp vụ riêng, dùng CHUNG 1 router vì cùng hình dạng hệt nhau: chỉ có đúng 1 hành động
 * "đóng"). `#btn-game-panel-close`/`#btn-statis-panel-close` là DOM TĨNH (mount 1 lần lúc boot,
 * KHÔNG re-render), gắn listener trực tiếp — KHÔNG cần delegation.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnGamePanelClose) {
    btnGamePanelClose.addEventListener('click', () => {
        eventBus.send({ router: 'placeholderPanels', type: 'placeholderPanels.game.close.click', payload: {} });
    });
}

if (btnStatisPanelClose) {
    btnStatisPanelClose.addEventListener('click', () => {
        eventBus.send({ router: 'placeholderPanels', type: 'placeholderPanels.statis.close.click', payload: {} });
    });
}
