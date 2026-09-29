/**
 * event/workflow/player-zoom.js — Workflow "playerZoom" (MỚI 29/09/2026, Giang yêu cầu): Zoom mode cho Player
 * Video/Photo. Icon kính lúp (#btn-player-zoom, Control Center, cạnh Capture — Giang chọn) bật/tắt; lúc bật:
 *   - #player-zoom-surface hiện, che #visualizer-gesture-surface -> MỌI cử chỉ app (vuốt/tap/giữ tua/vuốt rìa
 *     trên) tắt; cử chỉ trên surface này chỉ còn pinch (2 ngón) + pan (1 ngón, chỉ khi đã zoom > 1).
 *   - Nút mở Control Center bị ép hiện (lối duy nhất còn lại để tắt kính lúp).
 * Giới hạn (Giang chốt): mức nhỏ nhất = 1 (đúng Resolution của Player), ở mức 1 khoá giữa, pan không lộ ra ngoài
 * khung — xem core/player-zoom.js. Next/Prev/ảnh tự chuyển GIỮ NGUYÊN mức zoom (lớp zoom nằm ngoài Motion, không
 * ai reset nó giữa các lượt). Tắt kính lúp HOẶC thoát Video/Photo Player mode -> về mức 1.
 *
 * `_pointers`/`_gestureBase`/`_zoom` giữ TRÊN object Workflow (không qua appState) — dữ liệu từng khung
 * pointermove, cùng cách event/workflow/visualizer-gesture.js giữ `_startX/_startY`; chỉ cờ `isPlayerZoomMode`
 * (service/state/player-zoom.js) là state thật.
 *
 * Nơi gọi vòng đời: event/workflow/video-player.js + event/workflow/photo-player.js (`startFromPlaylist()` ->
 * `onPlayerModeEnter()`, đầu `exit*PlayerMode()` -> `onPlayerModeLeave()`).
 *
 * NẠP SAU: core/player-zoom.js, service/state/player-zoom.js.
 */
const workflowPlayerZoom = {
    _pointers: new Map(), // pointerId -> {x, y} — tối đa 2 điểm được dùng
    _gestureBase: null,   // {state:{scale,x,y}, points:[{x,y}]} — mốc lúc số ngón thay đổi
    _zoom: { scale: PLAYER_ZOOM_MIN_SCALE, x: 0, y: 0 },

    /** Vào Video/Photo Player mode — hiện icon kính lúp trong Control Center. */
    onPlayerModeEnter() {
        setPlayerZoomButtonVisible(true); // core/player-zoom.js
    },

    /** Thoát Video/Photo Player mode (gọi ĐẦU exit*PlayerMode(), đồng bộ) — tắt Zoom mode nếu đang bật, về mức 1,
     * ẩn icon kính lúp. */
    onPlayerModeLeave() {
        this._leaveZoomMode();
        setPlayerZoomButtonVisible(false); // core/player-zoom.js
    },

    /** Ứng 'playerZoom.toggle.click' (icon kính lúp). */
    toggle() {
        if (!appState.get('isVideoPlayerMode') && !appState.get('isPhotoPlayerMode')) return; // guard — icon chỉ hiện ở 2 mode này
        const actions = {
            true: () => this._leaveZoomMode(),
            false: () => this._enterZoomMode(),
        };
        actions[appState.get('isPlayerZoomMode')]();
    },

    _enterZoomMode() {
        appState.set('isPlayerZoomMode', true);
        console.log('writer: "workflowPlayerZoom._enterZoomMode", page: "player-zoom", content: "isPlayerZoomMode=true"');
        setPlayerZoomSurfaceVisible(true); // core/player-zoom.js
        setPlayerZoomButtonActive(true);
        setControlCenterButtonForcedVisible(true);
    },

    /** Tắt Zoom mode + về mức 1 (an toàn gọi cả khi đang không bật). */
    _leaveZoomMode() {
        appState.set('isPlayerZoomMode', false);
        console.log('writer: "workflowPlayerZoom._leaveZoomMode", page: "player-zoom", content: "isPlayerZoomMode=false"');
        setPlayerZoomSurfaceVisible(false); // core/player-zoom.js
        setPlayerZoomButtonActive(false);
        setControlCenterButtonForcedVisible(false);
        this._pointers.clear();
        this._gestureBase = null;
        this._zoom = { scale: PLAYER_ZOOM_MIN_SCALE, x: 0, y: 0 };
        applyPlayerZoomTransformToDOM(this._zoom); // core/player-zoom.js
    },

    // ===================== Cử chỉ trên #player-zoom-surface =====================

    /** @param {number} pointerId @param {number} x @param {number} y */
    handlePointerDown(pointerId, x, y) {
        this._pointers.set(pointerId, { x, y });
        this._rebaseGesture();
    },

    /** @param {number} pointerId @param {number} x @param {number} y */
    handlePointerMove(pointerId, x, y) {
        if (!this._pointers.has(pointerId)) return; // guard — ngón không bắt đầu trên surface
        this._pointers.set(pointerId, { x, y });
        this._applyGesture();
    },

    /** Nhấc ngón / pointercancel. @param {number} pointerId */
    handlePointerUp(pointerId) {
        if (!this._pointers.delete(pointerId)) return; // guard
        this._rebaseGesture();
    },

    /** Số ngón đổi (1 <-> 2) -> lấy trạng thái HIỆN TẠI làm mốc mới, tránh nhảy giật. */
    _rebaseGesture() {
        const points = Array.from(this._pointers.values()).slice(0, 2).map((p) => ({ x: p.x, y: p.y }));
        this._gestureBase = { state: { ...this._zoom }, points };
    },

    _applyGesture() {
        const base = this._gestureBase;
        const current = Array.from(this._pointers.values()).slice(0, 2);
        if (!base || base.points.length === 0 || base.points.length !== current.length) return; // guard
        const computeRaw = {
            1: () => computePlayerZoomPan(base.state, base.points[0], current[0]), // core/player-zoom.js
            2: () => {
                const start = resolvePlayerZoomPointerPair(base.points); // core/player-zoom.js
                const now = resolvePlayerZoomPointerPair(current);
                return computePlayerZoomPinch(base.state, start.distance, start.mid, now.distance, now.mid);
            },
        };
        const raw = computeRaw[current.length]();
        const view = readPlayerZoomViewportSize(); // core/player-zoom.js
        this._zoom = clampPlayerZoomState(raw, view.width, view.height, PLAYER_ZOOM_MIN_SCALE, PLAYER_ZOOM_MAX_SCALE);
        applyPlayerZoomTransformToDOM(this._zoom);
    },
};
