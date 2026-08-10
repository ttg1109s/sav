/**
 * event/workflow/visualizer-gesture.js — "THẰNG THỰC THI CUỐI" của router "visualizerGesture".
 *
 * Bắt trên #visualizer-gesture-surface (components/visualizer-overlay.js — lớp phủ chạm RIÊNG,
 * pointer-events:auto, nằm giữa canvas visualizer/bgVideoElement và thanh UI thật) — THAY HẲN cách
 * cũ gắn touchstart/touchend thẳng vào bgVideoElement (event/listener/video-player.js, đã bỏ, hay
 * bị canvas/UI đè mất hit-test, không đáng tin cậy).
 *
 * touchstart PHÂN LOẠI RÌA NGAY (isInTopEdgeZone()/isInBottomEdgeZone(), core) — vuốt RÌA và vuốt
 * lên/xuống THƯỜNG đi 2 nhánh loại trừ nhau NGAY TỪ ĐIỂM BẮT ĐẦU, không suy đoán qua chiều vuốt.
 * touchend tính vector (deltaX, deltaY) rồi phân loại: tap (isTapGesture) -> đơn/đúp (debounce qua
 * taskManager) -> trục vuốt chiếm ưu thế (resolveDominantSwipeAxis) -> chiều (resolveSwipeDirection).
 *
 * Mọi hành động cuối cùng đều TÁI DÙNG message/nút CÓ SẴN (playerControls.next/prev/playPause.click,
 * playerControls.backToPlaylist.click, visualizerControlCenter.toggle.click, .click() thẳng lên 1
 * nút Control Center do người dùng chọn) — Workflow này KHÔNG viết lại logic next/prev/play-pause.
 * Mỗi nhóm cử chỉ gate qua 1 cờ boolean riêng trong vizConfig (core/config.js), chỉnh ở Settings ->
 * Visualizer -> Cử chỉ (components/gesture-settings-drawer.js, cụm "gestureSettings").
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

/** Nút Control Center hợp lệ để gán cho cử chỉ vuốt rìa dưới — key khớp <option> ở
 * components/gesture-settings-drawer.js. Tham chiếu THẲNG biến dom-refs (không tự
 * document.getElementById) — undefined-safe cho trang không nạp đủ bộ dom-refs (subtitle-editor.html). */
const GESTURE_EDGE_BOTTOM_TARGET_ELS = {
    cycleMode: typeof btnCycleMode !== 'undefined' ? btnCycleMode : null,
    subtitleToggle: typeof btnSubtitle !== 'undefined' ? btnSubtitle : null,
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
     * KHÔNG rơi xuống nhánh vuốt/tap thường (2 nhánh loại trừ nhau ngay từ touchstart). */
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

    /** Tap đơn (play/pause) vs tap đúp (mở Playlist) — debounce chuẩn: hẹn hành động tap đơn, tap
     * thứ 2 tới trong cửa sổ thì huỷ hẹn đó, đổi sang hành động tap đúp. */
    _resolveTap(cfg) {
        if (this._tapPending) {
            taskManager.kill(GESTURE_TAP_TASK);
            this._tapPending = false;
            if (cfg.gestureDoubleTapPlaylistEnabled !== false) eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
            return;
        }
        this._tapPending = true;
        taskManager.once(() => {
            this._tapPending = false;
            if (cfg.gestureTapPlayPauseEnabled !== false) eventBus.send({ router: 'playerControls', type: 'playerControls.playPause.click', payload: {} });
        }, DOUBLE_TAP_WINDOW_MS, GESTURE_TAP_TASK);
    },

    /** Vuốt thường (không rìa) — trục dọc chỉ có ý nghĩa lúc đang phát Video, trục ngang chỉ có ý
     * nghĩa lúc đang phát Song (đúng yêu cầu gốc, KHÔNG áp cả 2 trục cùng lúc cho 1 media type). */
    _resolveAxisSwipe(axis, delta, cfg) {
        const direction = resolveSwipeDirection(delta); // 1 = xuôi trục (xuống/phải), -1 = ngược (lên/trái)
        const isVideo = appState.get('isVideoPlayerMode');
        if (axis === 'y' && isVideo) {
            if (cfg.gestureVideoNavEnabled === false) return;
            eventBus.send({ router: 'playerControls', type: direction === -1 ? 'playerControls.next.click' : 'playerControls.prev.click', payload: {} });
        } else if (axis === 'x' && !isVideo) {
            if (cfg.gestureSongNavEnabled === false) return;
            eventBus.send({ router: 'playerControls', type: direction === 1 ? 'playerControls.next.click' : 'playerControls.prev.click', payload: {} });
        }
    },
};
