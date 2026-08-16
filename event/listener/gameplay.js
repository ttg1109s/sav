/**
 * event/listener/gameplay.js — TẤT CẢ listener của cụm "gameplay" (Game Mode, Circle v1, MỚI
 * 16/08/2026). NẠP SAU CÙNG (sau bus, router/gameplay.js, VÀ SAU dom-refs.js) — cần cả
 * eventBus.send() và mọi biến DOM đã sẵn sàng, cùng quy ước mọi listener khác (xem event/listener/
 * player-controls.js).
 *
 * `#gameplay-tap-surface` dùng `touchstart` (KHÔNG đợi `touchend`) — phản hồi tức thời đúng bản
 * chất 1 rhythm game, cùng khuôn `touchstart` mà `#visualizer-gesture-surface` đang dùng (event/
 * listener/visualizer-gesture.js). Gửi kèm toạ độ chạm (%, quy đổi theo chính bounding box của
 * tap-surface) — workflowGameplay.handleTap() cần biết TAP TRÚNG ĐÂU để so với vị trí (x,y) của
 * từng note.
 *
 * `#btn-gameplay-exit` — nút thoát CỐ ĐỊNH (đúng vị trí #btn-open-control-center thật), lo phase
 * 'playing'/'countdown' (không có màn hỏi nào khác để thoát) — 'ready'/'ended' đã có nút riêng
 * NGAY TRONG modalChoice() (SỬA 16/08/2026, Giang yêu cầu dùng modalChoice() thay overlay riêng —
 * KHÔNG còn #btn-gameplay-start/#btn-gameplay-replay/#btn-gameplay-next tĩnh nữa, xem event/
 * workflow/gameplay.js::start()/onSongEnded(), nút trong modal gọi THẲNG method Workflow, không
 * qua eventBus — đã ở sẵn tầng Workflow, không cần vòng lại Router).
 */

if (gameModeSettingToggle) {
    gameModeSettingToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.modeEnabled.change', payload: { checked: e.target.checked } });
    });
}

if (gameplayTapSurface) {
    gameplayTapSurface.addEventListener('touchstart', (e) => {
        const touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        const rect = gameplayTapSurface.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 100;
        const y = ((touch.clientY - rect.top) / rect.height) * 100;
        eventBus.send({ router: 'gameplay', type: 'gameplay.tap.press', payload: { x, y } });
    }, { passive: true });
}

if (btnGameplayExit) {
    btnGameplayExit.addEventListener('click', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.exit.click', payload: {} });
    });
}
