/**
 * event/workflow/player-zoom.js — Workflow "playerZoom" (MỚI 29/09/2026, Giang yêu cầu): Zoom mode cho Player
 * Video/Photo. Icon kính lúp (#btn-player-zoom, Control Center, cạnh Capture — Giang chọn) bật/tắt; lúc bật:
 *   - #player-zoom-surface hiện, che #visualizer-gesture-surface -> MỌI cử chỉ app (vuốt/tap/giữ tua/vuốt rìa
 *     trên) tắt; cử chỉ trên surface này chỉ còn pinch (2 ngón) + pan (1 ngón, chỉ khi đã zoom > 1).
 *   - Nút mở Control Center bị ép hiện (lối duy nhất còn lại để tắt kính lúp).
 * Giới hạn (Giang chốt): mức nhỏ nhất = 1 (đúng Resolution của Player), ở mức 1 khoá giữa, pan không lộ ra ngoài
 * khung — xem core/player-zoom.js. Next/Prev/ảnh tự chuyển GIỮ NGUYÊN mức zoom.
 *
 * SỬA (29/09/2026, Giang: "tắt zoom thì zoom vẫn lưu trong state, kể cả app boot lại; zoom video riêng, zoom photo
 * riêng") — tắt kính lúp KHÔNG còn về mức 1: chỉ tắt cử chỉ zoom, hình giữ nguyên mức đang zoom. Mức zoom/pan lưu
 * bền trong domain 'playerDisplay' (`videoZoom`/`photoZoom`, qua workflowPlayerDisplaySettings.saveZoom()) mỗi khi
 * nhấc hết ngón; vào Video/Photo Player mode -> áp lại ĐÚNG bộ của kind đó. Thoát Player mode -> CHỈ gỡ transform
 * khỏi DOM (lớp zoom bọc cả Visual Background dùng chung `#visual-motion-react`), giá trị đã lưu giữ nguyên.
 * Reset nhanh: Settings > Player > Video/Photo > Zoom (workflowPlayerDisplaySettings.resetZoom() -> refreshFromConfig()).
 *
 * `_zoom` luôn ở hệ TỈ LỆ (x, y = phần của khung — core/player-zoom.js); cử chỉ tính bằng px theo kích thước khung
 * HIỆN TẠI rồi đổi lại. `_pointers`/`_gestureBase`/`_zoom`/`_kind` giữ TRÊN object Workflow (không qua appState) —
 * dữ liệu từng khung pointermove, cùng cách event/workflow/visualizer-gesture.js giữ `_startX/_startY`; bản bền là
 * config 'playerDisplay', cờ `isPlayerZoomMode` (service/state/player-zoom.js) là state phiên.
 *
 * Nơi gọi vòng đời: event/workflow/video-player.js + event/workflow/photo-player.js (`startFromPlaylist()` ->
 * `onPlayerModeEnter(kind)`, đầu `exit*PlayerMode()` -> `onPlayerModeLeave()`).
 *
 * NẠP SAU: core/player-zoom.js, service/state/player-zoom.js.
 */
const workflowPlayerZoom = {
    _pointers: new Map(), // pointerId -> {x, y} — tối đa 2 điểm được dùng
    _gestureBase: null,   // {state:{scale,x,y} (tỉ lệ), points:[{x,y}] (px)} — mốc lúc số ngón thay đổi
    _zoom: { ...PLAYER_ZOOM_DEFAULT },
    _kind: null,          // 'video' | 'photo' | null — Player mode đang chạy (bộ zoom nào đang áp)

    /** Vào Video/Photo Player mode — hiện icon kính lúp + áp lại mức zoom/pan đã lưu của kind này.
     * @param {'video'|'photo'} kind */
    onPlayerModeEnter(kind) {
        this._kind = kind;
        this._zoom = workflowPlayerDisplaySettings.getZoom(kind); // event/workflow/player-display-settings.js — đã chuẩn hoá
        applyPlayerZoomTransformToDOM(this._zoom); // core/player-zoom.js
        setPlayerZoomButtonVisible(true); // core/player-zoom.js
    },

    /** Thoát Video/Photo Player mode (gọi ĐẦU exit*PlayerMode(), đồng bộ) — tắt Zoom mode nếu đang bật, gỡ transform
     * khỏi DOM (giá trị đã lưu GIỮ NGUYÊN), ẩn icon kính lúp. */
    onPlayerModeLeave() {
        this._leaveZoomMode();
        applyPlayerZoomTransformToDOM(PLAYER_ZOOM_DEFAULT); // core/player-zoom.js — chỉ DOM, KHÔNG ghi config
        setPlayerZoomButtonVisible(false);
        this._kind = null;
        this._zoom = { ...PLAYER_ZOOM_DEFAULT };
    },

    /** Config của `kind` vừa đổi từ ngoài (reset nhanh ở Settings) — nếu đang ở đúng Player mode đó thì áp lại ngay.
     * @param {'video'|'photo'} kind */
    refreshFromConfig(kind) {
        if (this._kind !== kind) return; // guard — kind khác / không ở Player mode: lần vào mode sau tự đọc config
        this._zoom = workflowPlayerDisplaySettings.getZoom(kind); // event/workflow/player-display-settings.js
        this._rebaseGesture();
        applyPlayerZoomTransformToDOM(this._zoom); // core/player-zoom.js
    },

    /** Ứng 'playerZoom.toggle.click' (icon kính lúp). */
    toggle() {
        if (!this._kind) return; // guard — icon chỉ hiện ở Video/Photo Player mode
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

    /** Tắt Zoom mode (an toàn gọi cả khi đang không bật). SỬA 29/09/2026 — KHÔNG còn về mức 1, hình giữ nguyên. */
    _leaveZoomMode() {
        appState.set('isPlayerZoomMode', false);
        console.log('writer: "workflowPlayerZoom._leaveZoomMode", page: "player-zoom", content: "isPlayerZoomMode=false"');
        setPlayerZoomSurfaceVisible(false); // core/player-zoom.js
        setPlayerZoomButtonActive(false);
        setControlCenterButtonForcedVisible(false);
        this._pointers.clear();
        this._gestureBase = null;
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

    /** Nhấc ngón / pointercancel. Nhấc HẾT ngón -> lưu bền mức zoom/pan hiện tại (1 lần/cử chỉ, không ghi mỗi khung).
     * @param {number} pointerId */
    async handlePointerUp(pointerId) {
        if (!this._pointers.delete(pointerId)) return; // guard
        this._rebaseGesture();
        if (this._pointers.size > 0 || !this._kind) return; // guard — còn ngón trên màn / đã rời Player mode
        await workflowPlayerDisplaySettings.saveZoom(this._kind, this._zoom); // event/workflow/player-display-settings.js
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
        const view = readPlayerZoomViewportSize(); // core/player-zoom.js
        const basePx = convertPlayerZoomToPixels(base.state, view.width, view.height); // core/player-zoom.js
        const computeRaw = {
            1: () => computePlayerZoomPan(basePx, base.points[0], current[0]), // core/player-zoom.js
            2: () => {
                const start = resolvePlayerZoomPointerPair(base.points); // core/player-zoom.js
                const now = resolvePlayerZoomPointerPair(current);
                return computePlayerZoomPinch(basePx, start.distance, start.mid, now.distance, now.mid);
            },
        };
        const clampedPx = clampPlayerZoomState(computeRaw[current.length](), view.width, view.height, PLAYER_ZOOM_MIN_SCALE, PLAYER_ZOOM_MAX_SCALE);
        this._zoom = convertPlayerZoomToFractions(clampedPx, view.width, view.height); // core/player-zoom.js
        applyPlayerZoomTransformToDOM(this._zoom);
    },
};
