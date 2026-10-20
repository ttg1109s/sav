/**
 * event/workflow/visualizer-gesture.js — Workflow router "visualizerGesture": cử chỉ trên #visualizer-gesture-surface
 * (components/visualizer-overlay.js — lớp phủ chạm riêng giữa canvas/video và thanh UI).
 *
 * - touchstart phân loại rìa TRÊN ngay (computeGestureTouchStart(), core) — vuốt rìa trên (mở Control Center) và cử chỉ
 *   thường là 2 nhánh loại trừ nhau từ điểm bắt đầu.
 * - touchend: classifyGestureRelease() (core) -> 'edgeOpen' | 'tap' | 'swipe' | 'none'. Tap đơn/đúp/ba đếm dồn trong cửa
 *   sổ TAP_WINDOW_MS (taskManager), tap thứ 3 chốt ngay.
 * - 4 hướng vuốt + tap đơn/đúp/ba dùng chung 1 pool hành động (GESTURE_ACTIONS) hoặc 1 trong 3 Action slot (mỗi slot gán
 *   1 nút Control Center, components/gesture-settings-drawer.js) — chạy được cả Song lẫn Video.
 * - SEEK-HOLD ("ngón tay ảo", Giang chốt 07/10/2026): giữ yên ở nửa trái/phải -> tua lùi/tiến lặp lại, đi đúng luồng kéo
 *   thanh tiến trình. 3 thời gian tách biệt: SEEK_HOLD_ACTIVATE_MS (ngưỡng kích hoạt, cố định), gestureSeekStepMs (Time 1 —
 *   bước nhảy), gestureSeekHoldIntervalMs (Time 2 — nhịp lặp). Mỗi nhịp đặt thumb + gửi 'progressBar.seeking' (như 'input'
 *   khi kéo tay); thả tay / touchcancel / chạm biên gửi 'progressBar.seekCommit' đúng 1 lần (như 'change'). Song/Video dừng
 *   media ở nhịp đầu, thả tay cổng seek phát lại. Mốc do phiên tự giữ, không đọc lại currentTime. Photo không có seek-hold.
 *
 * NẠP SAU: core/visualizer-gesture.js, core/visualizer-control-center.js, core/dom-refs.js, service/task-manager.js,
 * core/hud.js (findAdjacentPlaybackSpeedPreset), event/workflow/hud.js, event/workflow/player-controls.js (lúc chạy).
 */
const EDGE_ZONE_PX = 28;
const EDGE_SWIPE_MIN_DISTANCE_PX = 40;
const SWIPE_MIN_DISTANCE_PX = 60;
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 300;
const TAP_WINDOW_MS = 300; // cửa sổ chờ giữa các lần chạm liên tiếp — dùng chung đơn/đúp/ba
const GESTURE_TAP_TASK = 'visualizerGestureTapWindow';
const SEEK_HOLD_ACTIVATE_MS = 2000; // ngưỡng giữ để KÍCH HOẠT — cố định, không phải setting
const SEEK_HOLD_MOVE_CANCEL_PX = 20;
const SEEK_HOLD_PENDING_TASK = 'visualizerGestureSeekHoldPending';
const SEEK_HOLD_TICK_TASK = 'visualizerGestureSeekHoldTick';

/** Pool hành động chung (key khớp <option> ở components/gesture-settings-drawer.js + giá trị field vizConfig). speedUp/
 * speedDown: mốc tốc độ liền kề (core/hud.js) qua workflowHud.selectSpeed(). */
const GESTURE_ACTIONS = {
    next: () => eventBus.send({ router: 'playerControls', type: 'playerControls.next.click', payload: {} }),
    prev: () => eventBus.send({ router: 'playerControls', type: 'playerControls.prev.click', payload: {} }),
    playPause: () => eventBus.send({ router: 'playerControls', type: 'playerControls.playPause.click', payload: {} }),
    openPlaylist: () => eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} }),
    speedUp: () => workflowHud.selectSpeed(findAdjacentPlaybackSpeedPreset(appConfigViz.getAll().playbackSpeed, 1)), // core/hud.js
    speedDown: () => workflowHud.selectSpeed(findAdjacentPlaybackSpeedPreset(appConfigViz.getAll().playbackSpeed, -1)), // core/hud.js
    none: () => {},
};

/** Trục + chiều vuốt -> field vizConfig (1 = xuống/phải, -1 = lên/trái). */
const GESTURE_SWIPE_CONFIG_FIELD = {
    y: { '-1': 'gestureActionSwipeUp', '1': 'gestureActionSwipeDown' },
    x: { '-1': 'gestureActionSwipeLeft', '1': 'gestureActionSwipeRight' },
};

/** Nút gán được cho 3 Action slot — Control Center + Shuffle/Repeat (Bottom Player); key khớp <option> ở
 * components/gesture-settings-drawer.js. Key cũ không còn trong bảng (vd editEq đã bỏ) tự im lặng bỏ qua. */
const GESTURE_TRIPLE_TAP_TARGET_ELS = {
    cycleMode: btnCycleMode,
    shuffle: btnShuffle,
    repeat: btnRepeat,
    captureFrame: btnCaptureVideoFrame,
    openVolume: btnOpenVolume,
    cycleEq: btnCycleEq,
};

/** Action slot -> field vizConfig giữ key nút Control Center đã gán. */
const GESTURE_ACTION_SLOT_CONFIG_FIELD = {
    actionSlot1: 'gestureActionSlot1',
    actionSlot2: 'gestureActionSlot2',
    actionSlot3: 'gestureActionSlot3',
};

const GESTURE_TRIPLE_TAP_COUNT = 3;
const GESTURE_RELEASE_LIMITS = {
    edgeMinPx: EDGE_SWIPE_MIN_DISTANCE_PX,
    tapMaxPx: TAP_MAX_DISTANCE_PX,
    tapMaxMs: TAP_MAX_DURATION_MS,
    swipeMinPx: SWIPE_MIN_DISTANCE_PX,
};

// Thả tay / touch bị huỷ: đang có phiên seek-hold -> thả "ngón tay ảo" (commit); chưa -> huỷ hẹn kích hoạt rồi (thả tay)
// xử lý như cử chỉ thường.
const GESTURE_TOUCH_END_BY_SEEK_HOLD = {
    true: () => workflowVisualizerGesture._stopSeekHold(),
    false: (x, y) => workflowVisualizerGesture._resolveRelease(x, y),
};
const GESTURE_TOUCH_CANCEL_BY_SEEK_HOLD = {
    true: () => workflowVisualizerGesture._stopSeekHold(),
    false: () => taskManager.kill(SEEK_HOLD_PENDING_TASK),
};

// Kết quả classifyGestureRelease() (core).
const GESTURE_RELEASE_BY_KIND = {
    edgeOpen: (release, cfg) => workflowVisualizerGesture._openControlCenterFromEdge(cfg),
    tap: (release, cfg) => workflowVisualizerGesture._resolveTap(cfg),
    swipe: (release, cfg) => workflowVisualizerGesture._dispatchGestureAction(cfg[GESTURE_SWIPE_CONFIG_FIELD[release.axis][String(release.direction)]], cfg),
    none: () => {},
};

// Lần chạm thứ 3 chốt ngay; 1–2 lần thì (đặt lại) hẹn cửa sổ chờ lần chạm kế.
const GESTURE_TAP_STEP_BY_TRIPLE = {
    true: (cfg) => workflowVisualizerGesture._fireTripleTap(cfg),
    false: (cfg) => taskManager.once(() => workflowVisualizerGesture._fireTapWindow(cfg), TAP_WINDOW_MS, GESTURE_TAP_TASK),
};
const GESTURE_TAP_FIELD_BY_COUNT = { 1: 'gestureActionTapSingle', 2: 'gestureActionTapDouble' };

// Hành động là Action slot -> bấm nút Control Center đã gán; không thì tra pool GESTURE_ACTIONS.
const GESTURE_DISPATCH_BY_IS_SLOT = {
    true: (action, cfg) => clickControlCenterButtonIfShown(GESTURE_TRIPLE_TAP_TARGET_ELS[cfg[GESTURE_ACTION_SLOT_CONFIG_FIELD[action]]]), // core/visualizer-control-center.js
    false: (action) => (GESTURE_ACTIONS[action] || GESTURE_ACTIONS.none)(),
};

const workflowVisualizerGesture = {
    _start: { x: 0, y: 0, timeMs: 0, edge: null },
    _tapCount: 0, // số lần chạm liên tiếp trong cửa sổ TAP_WINDOW_MS
    _seekHoldDirection: 1, // 1 = tua tiến (nửa phải), -1 = tua lùi (nửa trái)
    _seekHoldActive: false, // đã qua ngưỡng kích hoạt, phiên "ngón tay ảo" đang mở
    _seekHoldKey: null, // currentKey lúc kích hoạt — hết bài giữa chừng thì không commit mốc cũ lên bài mới
    _seekHoldTotalSec: 0, // tổng đã tua trong phiên (badge)
    _seekHoldPositionSec: 0, // mốc "ngón tay ảo" đang đứng
    _seekHoldDurationSec: 0, // thời lượng chốt lúc kích hoạt

    /** 'visualizerGesture.touch.start'. @param {number} x @param {number} y */
    handleTouchStart(x, y) {
        const start = computeGestureTouchStart(x, y, window.innerWidth, EDGE_ZONE_PX, appState.get('isPhotoPlayerMode'), appConfigViz.getAll().gestureSeekHoldEnabled !== false); // core/visualizer-gesture.js
        this._start = { x, y, timeMs: Date.now(), edge: start.startEdge };
        this._seekHoldDirection = start.seekHoldDirection;
        if (start.armSeekHold) taskManager.once(() => this._activateSeekHold(), SEEK_HOLD_ACTIVATE_MS, SEEK_HOLD_PENDING_TASK);
    },

    /** 'visualizerGesture.touch.move' — chỉ huỷ hẹn seek-hold CHƯA kích hoạt khi tay đi quá xa; không huỷ phiên đang chạy.
     * @param {number} x @param {number} y */
    handleTouchMove(x, y) {
        if (this._seekHoldActive) return;
        if (isGestureMovedBeyond(x, y, this._start.x, this._start.y, SEEK_HOLD_MOVE_CANCEL_PX)) taskManager.kill(SEEK_HOLD_PENDING_TASK); // core/visualizer-gesture.js
    },

    /** 'visualizerGesture.touch.end'. @param {number} x @param {number} y */
    handleTouchEnd(x, y) {
        GESTURE_TOUCH_END_BY_SEEK_HOLD[this._seekHoldActive](x, y);
    },

    /** 'visualizerGesture.touch.cancel' — hệ thống cắt ngang: chỉ dọn (không chạy tap/vuốt). */
    handleTouchCancel() {
        GESTURE_TOUCH_CANCEL_BY_SEEK_HOLD[this._seekHoldActive]();
    },

    _resolveRelease(x, y) {
        taskManager.kill(SEEK_HOLD_PENDING_TASK);
        const release = classifyGestureRelease(this._start, x, y, Date.now(), GESTURE_RELEASE_LIMITS); // core/visualizer-gesture.js
        GESTURE_RELEASE_BY_KIND[release.kind](release, appConfigViz.getAll());
    },

    _openControlCenterFromEdge(cfg) {
        if (cfg.gestureEdgeTopEnabled === false) return;
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.toggle.click', payload: {} });
    },

    _resolveTap(cfg) {
        const step = computeTapStep(this._tapCount, GESTURE_TRIPLE_TAP_COUNT); // core/visualizer-gesture.js
        this._tapCount = step.count;
        GESTURE_TAP_STEP_BY_TRIPLE[step.isTriple](cfg);
    },

    _fireTripleTap(cfg) {
        this._tapCount = 0;
        taskManager.kill(GESTURE_TAP_TASK);
        this._dispatchGestureAction(cfg.gestureTripleTapTarget, cfg);
    },

    /** Hết cửa sổ chờ: chốt tap đơn / đúp. */
    _fireTapWindow(cfg) {
        const field = GESTURE_TAP_FIELD_BY_COUNT[this._tapCount];
        this._tapCount = 0;
        if (!field) return;
        this._dispatchGestureAction(cfg[field], cfg);
    },

    /** Chạy 1 hành động (vuốt, tap đơn/đúp/ba). @param {string} action @param {object} cfg */
    _dispatchGestureAction(action, cfg) {
        GESTURE_DISPATCH_BY_IS_SLOT[!!GESTURE_ACTION_SLOT_CONFIG_FIELD[action]](action, cfg);
    },

    /** Hết ngưỡng SEEK_HOLD_ACTIVATE_MS giữ yên -> mở phiên: chốt thời lượng + vị trí, chạy 1 nhịp ngay rồi lặp mỗi Time 2
     * tới khi chạm biên hoặc thả tay. Media chưa có thời lượng -> không vào. */
    _activateSeekHold() {
        const { isVideoPlayerMode, currentKey } = appState.get(['isVideoPlayerMode', 'currentKey']);
        const mediaEl = isVideoPlayerMode ? bgVideoElement : audioPlayer; // chọn giá trị để đọc vị trí/thời lượng
        const durationSec = mediaEl.duration;
        if (!Number.isFinite(durationSec) || durationSec <= 0) return;
        this._seekHoldDurationSec = durationSec;
        this._seekHoldPositionSec = workflowPlayerControls.getSeekGatePosition(mediaEl); // event/workflow/player-controls.js — cổng đang chạy thì lấy mốc của nó
        this._seekHoldKey = currentKey;
        this._seekHoldActive = true;
        this._seekHoldTotalSec = 0;
        console.log(`[seekHold] bật: ${isVideoPlayerMode ? 'video' : 'song'} từ ${this._seekHoldPositionSec.toFixed(2)}s / ${durationSec.toFixed(2)}s, chiều ${this._seekHoldDirection}`); // log điều phối (Debug console)
        this._runSeekTick();
        if (!this._seekHoldActive) return; // nhịp đầu đã chạm biên và tự nhả
        const holdIntervalMs = appConfigViz.getAll().gestureSeekHoldIntervalMs || 2000; // Time 2
        taskManager.addNew(SEEK_HOLD_TICK_TASK, { time: holdIntervalMs, exe: () => this._runSeekTick(), mode: 'timeout', count: 0 });
        taskManager.operator(SEEK_HOLD_TICK_TASK, 'enabled');
    },

    /** 1 nhịp: dời mốc thêm Time 1, cập nhật badge (trước khi gửi 'seeking' — UI cử chỉ không phụ thuộc nơi nhận), đặt
     * thumb + gửi 'seeking'. Chạm biên -> tự nhả (commit ngay). */
    _runSeekTick() {
        const tick = computeSeekHoldTick(this._seekHoldPositionSec, this._seekHoldDirection, appConfigViz.getAll().gestureSeekStepMs || 2000, this._seekHoldDurationSec, this._seekHoldTotalSec); // core/visualizer-gesture.js
        this._seekHoldPositionSec = tick.positionSec;
        this._seekHoldTotalSec = tick.totalSec;
        showSeekHoldIndicator(seekHoldIndicator, this._seekHoldDirection, tick.label); // core/visualizer-gesture.js
        setProgressBarValue(tick.positionSec); // core/player-controls.js — không có ngón tay thật trên thanh
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seeking', payload: { value: tick.positionSec } });
        if (tick.hitBoundary) this._stopSeekHold();
    },

    /** Thả "ngón tay ảo": gỡ badge, gửi 'seekCommit' đúng 1 lần. Media đã đổi lúc giữ tay (hết bài) -> commit vị trí hiện tại
     * của media mới (chỉ để đóng phiên kéo), không đẩy mốc bài cũ sang. */
    _stopSeekHold() {
        taskManager.kill(SEEK_HOLD_TICK_TASK);
        this._seekHoldActive = false;
        hideSeekHoldIndicator(seekHoldIndicator); // core/visualizer-gesture.js
        const { currentKey, isVideoPlayerMode } = appState.get(['currentKey', 'isVideoPlayerMode']);
        const activeMediaEl = isVideoPlayerMode ? bgVideoElement : audioPlayer; // chọn giá trị
        const commitSec = currentKey !== this._seekHoldKey ? workflowPlayerControls.getSeekGatePosition(activeMediaEl) : this._seekHoldPositionSec; // chọn giá trị
        console.log(`[seekHold] thả: commit ${commitSec.toFixed(2)}s (đã tua ${this._seekHoldTotalSec.toFixed(1)}s)`); // log điều phối (Debug console)
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seekCommit', payload: { value: commitSec } });
    },
};
