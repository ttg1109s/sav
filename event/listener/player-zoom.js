/**
 * event/listener/player-zoom.js — listener cụm "playerZoom" (MỚI 29/09/2026).
 *
 * #btn-player-zoom (icon kính lúp, Control Center) — bật/tắt Zoom mode. Có `data-cc-action` nên bấm xong Control
 * Center tự đóng (core/visualizer-control-center.js::handleControlCenterGridClick()).
 * #player-zoom-surface — lớp bắt cử chỉ, CHỈ hiện lúc Zoom mode (che #visualizer-gesture-surface). Pointer Events
 * (đa điểm, mỗi ngón 1 pointerId) + `touch-action: none` (assets/css/base.css) để trình duyệt không tự zoom trang.
 * pointercancel dùng chung nhánh 'up' (ngón bị hệ thống huỷ = coi như nhấc).
 *
 * NẠP SAU: core/dom-refs.js (btnPlayerZoom, playerZoomSurface), event/bus.js, event/router/player-zoom.js.
 */
if (btnPlayerZoom) {
    btnPlayerZoom.addEventListener('click', () => {
        eventBus.send({ router: 'playerZoom', type: 'playerZoom.toggle.click', payload: {} });
    });
}

if (playerZoomSurface) {
    playerZoomSurface.addEventListener('pointerdown', (e) => {
        eventBus.send({ router: 'playerZoom', type: 'playerZoom.pointer.down', payload: { pointerId: e.pointerId, x: e.clientX, y: e.clientY } });
    });
    playerZoomSurface.addEventListener('pointermove', (e) => {
        eventBus.send({ router: 'playerZoom', type: 'playerZoom.pointer.move', payload: { pointerId: e.pointerId, x: e.clientX, y: e.clientY } });
    });
    playerZoomSurface.addEventListener('pointerup', (e) => {
        eventBus.send({ router: 'playerZoom', type: 'playerZoom.pointer.up', payload: { pointerId: e.pointerId } });
    });
    playerZoomSurface.addEventListener('pointercancel', (e) => {
        eventBus.send({ router: 'playerZoom', type: 'playerZoom.pointer.up', payload: { pointerId: e.pointerId } });
    });
}
