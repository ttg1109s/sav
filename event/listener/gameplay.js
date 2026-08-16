/**
 * event/listener/gameplay.js — TẤT CẢ listener của cụm "gameplay" (Game Mode, Circle v1, MỚI
 * 16/08/2026). NẠP SAU CÙNG (sau bus, router/gameplay.js, VÀ SAU dom-refs.js) — cần cả
 * eventBus.send() và mọi biến DOM đã sẵn sàng, cùng quy ước mọi listener khác (xem event/listener/
 * player-controls.js).
 *
 * `#gameplay-tap-surface` dùng `touchstart` (KHÔNG đợi `touchend`) — phản hồi tức thời đúng bản
 * chất 1 rhythm game, cùng khuôn `touchstart` mà `#visualizer-gesture-surface` đang dùng (event/
 * listener/visualizer-gesture.js). SỬA (16/08/2026, đọc lại plan — mỗi note ở 1 vị trí riêng) —
 * giờ gửi kèm toạ độ chạm (%, quy đổi theo chính bounding box của tap-surface) — workflowGameplay.
 * handleTap() cần biết TAP TRÚNG ĐÂU để so với vị trí (x,y) của từng note.
 *
 * `#btn-gameplay-exit` — SỬA (16/08/2026, Giang yêu cầu) — GỘP 2 nút thoát riêng lẻ bản trước
 * (Thoát ở màn ready / Về Playlist ở màn kết quả) thành 1 nút DUY NHẤT, LUÔN hiện cố định (đúng vị
 * trí #btn-open-control-center thật), hoạt động ở MỌI phase kể cả playing/countdown (trước đó
 * không thoát được — xem docstring TPL_GAMEPLAY_OVERLAY, components/gameplay-overlay.js).
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

if (btnGameplayStart) {
    btnGameplayStart.addEventListener('click', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.startCountdown.click', payload: {} });
    });
}

if (btnGameplayExit) {
    btnGameplayExit.addEventListener('click', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.exit.click', payload: {} });
    });
}

if (btnGameplayReplay) {
    btnGameplayReplay.addEventListener('click', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.scoreScreen.replay.click', payload: {} });
    });
}

if (btnGameplayNext) {
    btnGameplayNext.addEventListener('click', () => {
        eventBus.send({ router: 'gameplay', type: 'gameplay.scoreScreen.next.click', payload: {} });
    });
}
