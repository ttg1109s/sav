/**
 * event/listener/gameplay.js — TẤT CẢ listener của cụm "gameplay" (Game Mode). NẠP SAU CÙNG (sau bus,
 * router/gameplay.js, VÀ SAU dom-refs.js) — cùng quy ước mọi listener khác.
 *
 * `#gameplay-tap-surface` dùng `touchstart` (KHÔNG đợi `touchend`) — phản hồi tức thời đúng bản chất 1 rhythm game,
 * cùng khuôn `#visualizer-gesture-surface` (event/listener/visualizer-gesture.js). Gửi kèm toạ độ chạm PX THẬT (quy
 * đổi theo bounding box của tap-surface, khớp hệ toạ độ canvas) — workflowGameplay.handleTap() so với vị trí từng note.
 *
 * `#btn-gameplay-exit` — nút thoát CỐ ĐỊNH (đúng vị trí #btn-open-control-center), lo phase 'playing'/'countdown'.
 * Phase 'ready'/'ended' có nút riêng trong modalChoice() (gọi thẳng method Workflow).
 */

if (gameplayTapSurface) {
    gameplayTapSurface.addEventListener('touchstart', (e) => {
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        const rect = gameplayTapSurface.getBoundingClientRect();
        const x = touch.clientX - rect.left; // px thật — khớp hệ toạ độ canvas
        const y = touch.clientY - rect.top;
        eventBus.send({ router: 'gameplay', type: 'gameplay.tap.press', payload: { x, y } });
    }, { passive: true });
}

if (btnGameplayExit) {
    btnGameplayExit.addEventListener('click', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.exit.click', payload: {} });
    });
}

// Game "Arrow" — bàn phím tròn 8 hướng + nút Enter (DOM TĨNH, components/gameplay-arrow-stage.js).
// `pointerdown` (không đợi click/pointerup) — phản hồi tức thời như tap-surface Circle, nhiều ngón bấm dồn vẫn nhận đủ.
// Delegation trên `#gameplay-arrow-pad`: `closest('[data-arrow-dir]')` chỉ để biết nút nào bị chạm (event-bus-flow.md
// mục 1) rồi gửi hướng 0..7. Zoom double-tap/cuộn đã chặn bằng CSS `touch-action: none` (assets/css/gameplay-arrow.css) —
// không preventDefault để trạng thái :active (nút lún xuống) vẫn hiện.
if (gameplayArrowPad) {
    gameplayArrowPad.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('[data-arrow-dir]');
        if (!btn) return;
        eventBus.send({ router: 'gameplay', type: 'gameplay.arrow.direction.press', payload: { dir: Number(btn.dataset.arrowDir) } });
    });
}

if (btnGameplayArrowCommit) {
    btnGameplayArrowCommit.addEventListener('pointerdown', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.arrow.commit.press', payload: {} });
    });
}

// Lưới pitch→ô của Game phải khớp kích thước thật của `#gameplay-layer`, kể cả lúc layer chuyển từ ẩn (0×0, đang ở
// Playlist) sang hiện — `window.resize` không bắn khi chỉ đổi `display`, nên theo dõi chính layer
// (xem workflowGameplay.handleLayoutResize()).
if (gameplayLayer) {
    new ResizeObserver(() => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.layer.resize', payload: {} });
    }).observe(gameplayLayer);
}
