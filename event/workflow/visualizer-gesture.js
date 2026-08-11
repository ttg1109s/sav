/**
 * event/workflow/visualizer-gesture.js — "THẰNG THỰC THI CUỐI" của router "visualizerGesture".
 *
 * Bắt trên #visualizer-gesture-surface (components/visualizer-overlay.js — lớp phủ chạm RIÊNG,
 * pointer-events:auto, nằm giữa canvas visualizer/bgVideoElement và thanh UI thật) — THAY HẲN cách
 * cũ gắn touchstart/touchend thẳng vào bgVideoElement, hay bị canvas/UI đè mất hit-test.
 *
 * touchstart PHÂN LOẠI RÌA NGAY (isInTopEdgeZone()/isInBottomEdgeZone(), core) — vuốt RÌA và vuốt
 * lên/xuống/trái/phải THƯỜNG đi 2 nhánh loại trừ nhau NGAY TỪ ĐIỂM BẮT ĐẦU, không suy đoán qua
 * chiều vuốt. touchend tính vector (deltaX, deltaY) rồi phân loại: tap (isTapGesture) -> đơn/đúp
 * (debounce qua taskManager) -> trục vuốt chiếm ưu thế (resolveDominantSwipeAxis) -> chiều
 * (resolveSwipeDirection).
 *
 * 4 hướng vuốt (lên/xuống/trái/phải) + 2 tap (đơn/đúp) đều là "hành động do người dùng chọn" — MỖI
 * cái 1 field string riêng trong vizConfig (core/config.js), giá trị 1 trong 5: 'next'/'prev'/
 * 'playPause'/'openPlaylist'/'none' (none = không làm gì) — xem GESTURE_ACTIONS. Hoạt động bất kể
 * đang phát Song hay Video (playerControls.next/prev.click TỰ đúng cho cả 2 loại, xem
 * event/router/player-controls.js — Workflow này KHÔNG cần biết đang phát gì). Chỉnh ở Settings ->
 * Visualizer -> Cử chỉ (components/gesture-settings-drawer.js, cụm "gestureSettings").
 *
 * Vuốt rìa trên/dưới KHÔNG nằm trong action picker — rìa trên CỐ ĐỊNH mở Control Center, rìa dưới
 * bấm 1 nút Control Center do người dùng chọn riêng (gestureEdgeBottomTarget, không đổi).
 *
 * NẠP SAU: core/visualizer-gesture.js, core/dom-refs.js, service/task-manager.js,
 * event/router/player-controls.js, event/router/visualizer-control-center.js.
 */
const EDGE_ZONE_PX = 28;
const EDGE_SWIPE_MIN_DISTANCE_PX = 40;
const SWIPE_MIN_DISTANCE_PX = 60;
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 300;
const DOUBLE_TAP_WINDOW_MS = 300;
const GESTURE_TAP_TASK = 'visualizerGestureTapWindow';

/** Pool hành động dùng CHUNG cho cả 4 hướng vuốt + 2 tap — key khớp <option> ở
 * components/gesture-settings-drawer.js + giá trị field vizConfig. Tái dùng THẲNG message có sẵn,
 * không viết lại logic next/prev/play-pause/mở-playlist. */
const GESTURE_ACTIONS = {
    next: () => eventBus.send({ router: 'playerControls', type: 'playerControls.next.click', payload: {} }),
    prev: () => eventBus.send({ router: 'playerControls', type: 'playerControls.prev.click', payload: {} }),
    playPause: () => eventBus.send({ router: 'playerControls', type: 'playerControls.playPause.click', payload: {} }),
    openPlaylist: () => eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} }),
    none: () => {},
};

/** Trục + chiều vuốt (đã resolveDominantSwipeAxis/resolveSwipeDirection, core) -> field vizConfig
 * tương ứng. 1 = xuôi trục (xuống/phải), -1 = ngược trục (lên/trái) — xem resolveSwipeDirection(). */
const GESTURE_SWIPE_CONFIG_FIELD = {
    y: { '-1': 'gestureActionSwipeUp', '1': 'gestureActionSwipeDown' },
    x: { '-1': 'gestureActionSwipeLeft', '1': 'gestureActionSwipeRight' },
};

/** Nút Control Center hợp lệ để gán cho cử chỉ vuốt rìa dưới — key khớp <option> ở
 * components/gesture-settings-drawer.js. Tham chiếu THẲNG biến dom-refs (không tự
 * document.getElementById) — undefined-safe cho trang không nạp đủ bộ dom-refs (subtitle-editor.html). */
const GESTURE_EDGE_BOTTOM_TARGET_ELS = {
    cycleMode: typeof btnCycleMode !== 'undefined' ? btnCycleMode : null,
    shuffle: typeof btnShuffle !== 'undefined' ? btnShuffle : null,
    repeat: typeof btnRepeat !== 'undefined' ? btnRepeat : null,
    documentReader: typeof btnOpenDocumentReader !== 'undefined' ? btnOpenDocumentReader : null,
    captureFrame: typeof btnCaptureVideoFrame !== 'undefined' ? btnCaptureVideoFrame : null,
};

const workflowVisualizerGesture = {
    _startX: 0, _startY: 0, _startTime: 0, _startEdge: null,
    _tapPending: false, // đang chờ hết cửa sổ double-tap (taskManager) để chốt là tap đơn

    /** Ứng với 'visualizerGesture.touch.start'. @param {number} x @param {number} y */
    handleTouchStart(x, y) {
        this._startX = x; this._startY = y; this._startTime = Date.now();
        if (isInTopEdgeZone(y, EDGE_ZONE_PX)) this._startEdge = 'top'; // core/visualizer-gesture.js
        else if (isInBottomEdgeZone(y, window.innerHeight, EDGE_ZONE_PX)) this._startEdge = 'bottom';
        else this._startEdge = null;
    },

    /** Ứng với 'visualizerGesture.touch.end'. @param {number} x @param {number} y */
    handleTouchEnd(x, y) {
        const cfg = appConfigViz.getAll();
        const deltaX = x - this._startX, deltaY = y - this._startY;
        const distance = Math.hypot(deltaX, deltaY);
        const elapsed = Date.now() - this._startTime;

        if (this._startEdge) { this._resolveEdgeSwipe(this._startEdge, deltaY, distance, cfg); return; }

        if (isTapGesture(distance, elapsed, TAP_MAX_DISTANCE_PX, TAP_MAX_DURATION_MS)) { this._resolveTap(cfg); return; }

        const axis = resolveDominantSwipeAxis(deltaX, deltaY, SWIPE_MIN_DISTANCE_PX);
        if (!axis) return;
        this._resolveAxisSwipe(axis, axis === 'x' ? deltaX : deltaY, cfg);
    },

    /** Chạm bắt đầu trong dải rìa — chỉ 2 kết quả: mở Control Center (rìa trên, vuốt XUỐNG) hoặc
     * bấm nút Control Center đã chọn (rìa dưới, vuốt LÊN). Sai chiều/chưa đủ khoảng cách -> bỏ qua,
     * KHÔNG rơi xuống nhánh vuốt/tap thường (2 nhánh loại trừ nhau ngay từ touchstart). Ngoài
     * action picker (không đổi theo phản hồi Giang — "không bao gồm icon center"). */
    _resolveEdgeSwipe(edge, deltaY, distance, cfg) {
        if (distance < EDGE_SWIPE_MIN_DISTANCE_PX) return;
        if (edge === 'top' && deltaY > 0) {
            if (cfg.gestureEdgeTopEnabled === false) return;
            eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.toggle.click', payload: {} });
        } else if (edge === 'bottom' && deltaY < 0) {
            if (cfg.gestureEdgeBottomEnabled === false) return;
            const targetEl = GESTURE_EDGE_BOTTOM_TARGET_ELS[cfg.gestureEdgeBottomTarget];
            if (targetEl && !targetEl.classList.contains('hidden')) targetEl.click();
        }
    },

    /** Tap đơn vs tap đúp — debounce chuẩn: hẹn hành động tap đơn, tap thứ 2 tới trong cửa sổ thì
     * huỷ hẹn đó, đổi sang hành động tap đúp. Hành động cụ thể do người dùng chọn (action picker). */
    _resolveTap(cfg) {
        if (this._tapPending) {
            taskManager.kill(GESTURE_TAP_TASK);
            this._tapPending = false;
            this._dispatchGestureAction(cfg.gestureActionTapDouble);
            return;
        }
        this._tapPending = true;
        taskManager.once(() => {
            this._tapPending = false;
            this._dispatchGestureAction(cfg.gestureActionTapSingle);
        }, DOUBLE_TAP_WINDOW_MS, GESTURE_TAP_TASK);
    },

    /** Vuốt thường (không rìa) — cả 4 hướng đều hoạt động bất kể đang phát Song hay Video (hành
     * động do người dùng chọn, không còn hardcode theo media type). */
    _resolveAxisSwipe(axis, delta, cfg) {
        const direction = resolveSwipeDirection(delta); // core/visualizer-gesture.js
        const field = GESTURE_SWIPE_CONFIG_FIELD[axis][String(direction)];
        this._dispatchGestureAction(cfg[field]);
    },

    /** Tra + chạy 1 hành động trong GESTURE_ACTIONS — dùng chung bởi tap và vuốt.
     * @param {string} action */
    _dispatchGestureAction(action) {
        const run = GESTURE_ACTIONS[action];
        if (run) run();
    },
};
