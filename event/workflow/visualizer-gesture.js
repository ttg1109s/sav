/**
 * event/workflow/visualizer-gesture.js — "THẰNG THỰC THI CUỐI" của router "visualizerGesture".
 *
 * Bắt trên #visualizer-gesture-surface (components/visualizer-overlay.js — lớp phủ chạm RIÊNG,
 * pointer-events:auto, nằm giữa canvas visualizer/bgVideoElement và thanh UI thật).
 *
 * touchstart PHÂN LOẠI RÌA TRÊN NGAY (isInTopEdgeZone(), core) — vuốt RÌA TRÊN và vuốt
 * lên/xuống/trái/phải THƯỜNG đi 2 nhánh loại trừ nhau NGAY TỪ ĐIỂM BẮT ĐẦU (rìa DƯỚI đã bỏ hẳn,
 * xem mục "TAP 3 LẦN" bên dưới — thay thế đúng chức năng đó). Vuốt thường: touchend tính vector
 * (deltaX, deltaY) rồi phân loại tap (isTapGesture) -> đơn/đúp/ba (đếm dồn qua taskManager) -> trục
 * vuốt chiếm ưu thế (resolveDominantSwipeAxis) -> chiều (resolveSwipeDirection).
 *
 * 4 hướng vuốt + 2 tap (đơn/đúp) đều là "hành động do người dùng chọn" — mỗi cái 1 field string
 * riêng trong vizConfig, giá trị 1 trong 5: 'next'/'prev'/'playPause'/'openPlaylist'/'none' — xem
 * GESTURE_ACTIONS. Hoạt động bất kể đang phát Song hay Video (playerControls.next/prev.click TỰ
 * đúng cho cả 2 loại — Workflow này không cần biết đang phát gì).
 *
 * TAP 3 LẦN (MỚI, THAY THẾ vuốt cạnh dưới đã bỏ hẳn) — KHÔNG nằm trong action picker (khác tap
 * đơn/đúp) — CHỈ để bấm 1 nút Control Center do người dùng chọn riêng (gestureTripleTapTarget),
 * đúng chức năng vuốt cạnh dưới cũ, đổi cơ chế kích hoạt sang chạm 3 lần liên tiếp cho dễ thao tác
 * hơn (phản hồi Giang).
 *
 * Vuốt rìa TRÊN (mở Control Center) KHÔNG đổi.
 *
 * SEEK-HOLD — giữ tay ĐỨNG YÊN (không rìa, không vuốt) ở nửa trái/phải màn hình -> tua lùi/tiến
 * LẶP LẠI. 3 THỜI GIAN TÁCH BIỆT HOÀN TOÀN:
 *   1. SEEK_HOLD_ACTIVATE_MS (2s) — ngưỡng giữ để KÍCH HOẠT vào seek mode. CỐ ĐỊNH, KHÔNG phải
 *      setting, KHÔNG liên quan gì tới 2 giá trị bên dưới.
 *   2. gestureSeekStepMs (Time 1, setting) — ĐƠN VỊ NHẢY mỗi lần seek — tua bao nhiêu giây.
 *   3. gestureSeekHoldIntervalMs (Time 2, setting) — SAU KHI đã vào seek mode (qua ngưỡng #1), giữ
 *      TIẾP đủ Time 2 thì mới kích hoạt 1 lệnh seek theo Time 1 — lặp lại liên tục: giữ Time 2 ->
 *      seek Time 1 -> giữ Time 2 -> seek Time 1 -> ...
 * Dừng khi thả tay / chạm biên 0 / (thời lượng - 1s) / touch bị huỷ (touchcancel — hệ thống chen
 * ngang) — muốn tua tiếp phải giữ tay lại từ đầu (không tự nối phiên, phải qua lại ngưỡng #1).
 * touchmove chỉ dùng để HUỶ hẹn giờ NẾU CHƯA kích hoạt (tay di chuyển quá xa = đang thành vuốt,
 * không phải giữ yên) — KHÔNG huỷ 1 phiên seek ĐANG chạy.
 *
 * TỰ PAUSE media lúc kích hoạt, RESUME lại (nếu trước đó đang phát) lúc dừng — không pause thì
 * giữa 2 lần tick, media vẫn tự chạy tiếp bình thường, cộng dồn ngược chiều với bước tua lùi -> vị
 * trí thực tế sai lệch so với bước đã cấu hình. Pause loại bỏ hẳn xung đột — mỗi tick là 1 bước
 * NHẢY CHÍNH XÁC, không bị playback "kéo ngược" giữa chừng.
 *
 * Mũi tên + số giây đã tua (core/visualizer-gesture.js — showSeekHoldIndicator()/
 * hideSeekHoldIndicator()) — CỐ ĐỊNH giữa theo chiều dọc, tại tâm nửa trái/phải màn hình tuỳ chiều
 * (KHÔNG bám toạ độ chạm) — hiện lúc kích hoạt, cộng dồn theo từng tick, gỡ lúc dừng.
 *
 * Seek THẬT qua message CÓ SẴN 'playerControls.progressBar.seekCommit' (y hệt buông tay kéo thanh
 * tiến trình) — TỰ đúng cho cả Song/Video (event/router/player-controls.js), không viết lại logic
 * seek. Pause/resume gọi THẲNG lên `bgVideoElement`/`audioPlayer` — 2 element này tự bắn sự kiện
 * 'pause'/'play' NGUYÊN BẢN, các listener có sẵn (core/player-controls.js, event/listener/
 * video-player.js) tự lo icon/wake lock/Media Session, không cần dispatch gì thêm ở đây.
 *
 * NẠP SAU: core/visualizer-gesture.js, core/dom-refs.js, service/task-manager.js,
 * event/router/player-controls.js, event/router/visualizer-control-center.js.
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

/** Pool hành động dùng CHUNG cho cả 4 hướng vuốt + tap đơn/đúp — key khớp <option> ở
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

/** Nút Control Center hợp lệ để gán cho TAP 3 LẦN + 3 "Action" slot (MỚI 12/08/2026) — key khớp
 * <option> ở components/gesture-settings-drawer.js. Tham chiếu THẲNG biến dom-refs (không tự
 * document.getElementById) — undefined-safe cho trang không nạp đủ bộ dom-refs (subtitle-editor.html).
 * SỬA (12/08/2026, Giang yêu cầu thêm "Action") — bổ sung 3 nút CÒN THIẾU so với TOÀN BỘ nút
 * data-cc-action thật sự có ở Control Center (components/visualizer-overlay.js): openVolume/
 * cycleEq/editEq — trước đây map này viết TRƯỚC khi 3 nút đó tồn tại, lúc đó đủ cả 8/8.
 * SỬA TIẾP (cùng ngày, "gộp eq edit vào hold 3s, bỏ icon edit riêng") — `editEq` (#btn-edit-eq) ĐÃ
 * BỎ khỏi map này cùng lúc xoá hẳn nút (mở Edit EQ giờ gộp vào GIỮ 3s trên `cycleEq`, không còn
 * là 1 "nút bấm hộ được" riêng nữa) — còn lại đúng 7/7. `cycleEq` (#btn-cycle-eq) VẪN gán được như
 * cũ — `.click()` do _clickControlCenterTarget() gọi vẫn hoạt động đúng (bấm NGẮN/cycle), xem
 * docstring event/listener/eq-presets.js (lý do #btn-cycle-eq giữ riêng 1 listener `click`, không
 * gộp vào `pointerup`, để tương thích CHÍNH cơ chế `.click()` này). Config cũ (nếu người dùng đã
 * TỪNG gán 1 trong 3 Action slot/Tap-3-lần cho `editEq` trước bản sửa này) không cần migrate — tra
 * map trả `undefined`, `_clickControlCenterTarget()` tự im lặng bỏ qua (CÙNG cách xử lý nút đang
 * ẩn, vd `captureFrame` ngoài Video mode). */
const GESTURE_TRIPLE_TAP_TARGET_ELS = {
    cycleMode: typeof btnCycleMode !== 'undefined' ? btnCycleMode : null,
    shuffle: typeof btnShuffle !== 'undefined' ? btnShuffle : null,
    repeat: typeof btnRepeat !== 'undefined' ? btnRepeat : null,
    documentReader: typeof btnOpenDocumentReader !== 'undefined' ? btnOpenDocumentReader : null,
    captureFrame: typeof btnCaptureVideoFrame !== 'undefined' ? btnCaptureVideoFrame : null,
    openVolume: typeof btnOpenVolume !== 'undefined' ? btnOpenVolume : null,
    cycleEq: typeof btnCycleEq !== 'undefined' ? btnCycleEq : null,
};

/** MỚI (12/08/2026, Giang yêu cầu — "Action" cho Cử chỉ) — 3 "ngăn" CỐ ĐỊNH, mỗi ngăn gán 1 nút
 * Control Center (chọn ở section Action riêng, components/gesture-settings-drawer.js) — 6 dropdown
 * vuốt/tap (KHÔNG gồm seek/vuốt cạnh trên, xem docstring vizConfig.gestureActionSlot1) chọn được
 * 'actionSlot1/2/3' NGOÀI 5 hành động mặc định trong GESTURE_ACTIONS — _dispatchGestureAction() tra
 * bảng NÀY trước, khớp thì đi qua _clickControlCenterTarget() (CÙNG cơ chế Tap 3 lần, gọi
 * targetEl.click() — KHÔNG chép lại logic), không khớp thì mới tra GESTURE_ACTIONS như cũ. */
const GESTURE_ACTION_SLOT_CONFIG_FIELD = {
    actionSlot1: 'gestureActionSlot1',
    actionSlot2: 'gestureActionSlot2',
    actionSlot3: 'gestureActionSlot3',
};

const workflowVisualizerGesture = {
    _startX: 0, _startY: 0, _startTime: 0, _startEdge: null,
    _tapCount: 0, // số lần chạm liên tiếp đang đếm dồn trong cửa sổ TAP_WINDOW_MS (1/2/3)
    _seekHoldDirection: 0, // 1 = tua tiến (nửa phải), -1 = tua lùi (nửa trái) — set lúc touchstart
    _seekHoldActive: false, // đã qua ngưỡng SEEK_HOLD_ACTIVATE_MS, đang thật sự tua lặp lại
    _seekHoldMediaEl: null, // media element đang seek (chốt lúc kích hoạt, dùng xuyên suốt phiên)
    _seekHoldWasPlaying: false, // đang phát trước lúc pause để seek — biết có cần resume lúc dừng không
    _seekHoldTotalSec: 0, // tổng đã tua trong phiên hiện tại — hiện lên badge, cộng dồn mỗi tick

    /** Ứng với 'visualizerGesture.touch.start'. @param {number} x @param {number} y */
    handleTouchStart(x, y) {
        this._startX = x; this._startY = y; this._startTime = Date.now();
        this._startEdge = isInTopEdgeZone(y, EDGE_ZONE_PX) ? 'top' : null; // core/visualizer-gesture.js — rìa DƯỚI đã bỏ (thay bằng tap 3 lần)

        if (!this._startEdge && appConfigViz.getAll().gestureSeekHoldEnabled !== false) {
            this._seekHoldDirection = isInLeftHalf(x, window.innerWidth) ? -1 : 1; // core/visualizer-gesture.js
            taskManager.once(() => this._activateSeekHold(), SEEK_HOLD_ACTIVATE_MS, SEEK_HOLD_PENDING_TASK);
        }
    },

    /** Ứng với 'visualizerGesture.touch.move' — CHỈ huỷ hẹn giờ seek-hold CHƯA kích hoạt nếu tay di
     * chuyển quá xa (đang thành vuốt, không phải giữ yên). KHÔNG huỷ 1 phiên seek ĐANG chạy (chỉ
     * thả tay/chạm biên mới dừng, xem docstring đầu file). @param {number} x @param {number} y */
    handleTouchMove(x, y) {
        if (this._seekHoldActive) return;
        const distance = Math.hypot(x - this._startX, y - this._startY);
        if (distance > SEEK_HOLD_MOVE_CANCEL_PX) taskManager.kill(SEEK_HOLD_PENDING_TASK);
    },

    /** Ứng với 'visualizerGesture.touch.end'. @param {number} x @param {number} y */
    handleTouchEnd(x, y) {
        if (this._seekHoldActive) { this._stopSeekHold(); return; }
        taskManager.kill(SEEK_HOLD_PENDING_TASK); // thả tay trước khi qua ngưỡng -> huỷ hẹn, xử lý như cử chỉ thường

        const cfg = appConfigViz.getAll();
        const deltaX = x - this._startX, deltaY = y - this._startY;
        const distance = Math.hypot(deltaX, deltaY);
        const elapsed = Date.now() - this._startTime;

        if (this._startEdge) { this._resolveEdgeSwipe(deltaY, distance, cfg); return; }

        if (isTapGesture(distance, elapsed, TAP_MAX_DISTANCE_PX, TAP_MAX_DURATION_MS)) { this._resolveTap(cfg); return; }

        const axis = resolveDominantSwipeAxis(deltaX, deltaY, SWIPE_MIN_DISTANCE_PX);
        if (!axis) return;
        this._resolveAxisSwipe(axis, axis === 'x' ? deltaX : deltaY, cfg);
    },

    /** Ứng với 'visualizerGesture.touch.cancel' — trình duyệt cắt ngang touch (vd hệ thống chen
     * ngang) — CHỈ dọn dẹp (dừng seek-hold nếu đang chạy / huỷ hẹn giờ nếu đang chờ), KHÔNG chạy
     * tap/swipe (gesture bị huỷ giữa chừng, không phải hoàn tất bình thường). */
    handleTouchCancel() {
        if (this._seekHoldActive) { this._stopSeekHold(); return; }
        taskManager.kill(SEEK_HOLD_PENDING_TASK);
    },

    /** Chạm bắt đầu trong dải rìa TRÊN, vuốt XUỐNG đủ xa -> mở Control Center. Sai chiều/chưa đủ
     * khoảng cách -> bỏ qua, KHÔNG rơi xuống nhánh vuốt/tap thường. */
    _resolveEdgeSwipe(deltaY, distance, cfg) {
        if (distance < EDGE_SWIPE_MIN_DISTANCE_PX || deltaY <= 0) return;
        if (cfg.gestureEdgeTopEnabled === false) return;
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.toggle.click', payload: {} });
    },

    /** Tap đơn/đúp/ba — đếm dồn qua `_tapCount`, mỗi lần chạm tự đặt lại (debounce, taskManager tự
     * huỷ bản hẹn cũ cùng tên) hẹn TAP_WINDOW_MS chờ lần chạm kế tiếp. Tap thứ 3 chốt NGAY (không
     * còn gì để chờ phân biệt tiếp) — bấm thẳng nút Control Center đã chọn (gestureTripleTapTarget,
     * THAY THẾ đúng chức năng vuốt cạnh dưới đã bỏ), KHÔNG thuộc action picker (đơn/đúp mới thuộc). */
    _resolveTap(cfg) {
        this._tapCount++;
        if (this._tapCount >= 3) {
            this._tapCount = 0;
            taskManager.kill(GESTURE_TAP_TASK);
            this._resolveTripleTap(cfg);
            return;
        }
        taskManager.once(() => {
            const count = this._tapCount;
            this._tapCount = 0;
            if (count === 1) this._dispatchGestureAction(cfg.gestureActionTapSingle, cfg);
            else if (count === 2) this._dispatchGestureAction(cfg.gestureActionTapDouble, cfg);
        }, TAP_WINDOW_MS, GESTURE_TAP_TASK);
    },

    /** Tap 3 lần — bấm thẳng 1 nút Control Center do người dùng chọn (KHÁC action picker). Chọn
     * 'none' trong dropdown = tắt (KHÔNG còn toggle bật/tắt riêng, phản hồi Giang). */
    _resolveTripleTap(cfg) {
        this._clickControlCenterTarget(cfg.gestureTripleTapTarget);
    },

    /** Bấm thẳng 1 nút Control Center theo key (GESTURE_TRIPLE_TAP_TARGET_ELS) — DÙNG CHUNG bởi
     * Tap 3 lần VÀ 3 Action slot (MỚI 12/08/2026, xem _dispatchGestureAction()) — 'none'/rỗng/nút
     * đang ẩn (vd captureFrame ngoài Video mode) đều im lặng bỏ qua.
     * @param {string} targetKey */
    _clickControlCenterTarget(targetKey) {
        if (!targetKey || targetKey === 'none') return;
        const targetEl = GESTURE_TRIPLE_TAP_TARGET_ELS[targetKey];
        if (targetEl && !targetEl.classList.contains('hidden')) targetEl.click();
    },

    /** Vuốt thường (không rìa) — cả 4 hướng đều hoạt động bất kể đang phát Song hay Video. */
    _resolveAxisSwipe(axis, delta, cfg) {
        const direction = resolveSwipeDirection(delta); // core/visualizer-gesture.js
        const field = GESTURE_SWIPE_CONFIG_FIELD[axis][String(direction)];
        this._dispatchGestureAction(cfg[field], cfg);
    },

    /** Tra + chạy 1 hành động — dùng chung bởi tap đơn/đúp và vuốt. Tra GESTURE_ACTION_SLOT_
     * CONFIG_FIELD TRƯỚC (3 Action slot, MỚI 12/08/2026) — khớp thì bấm thẳng nút Control Center đã
     * gán (_clickControlCenterTarget(), CÙNG cơ chế Tap 3 lần); không khớp mới tra GESTURE_ACTIONS
     * (5 hành động mặc định next/prev/playPause/openPlaylist/none) như cũ.
     * @param {string} action @param {object} cfg - CẦN để tra field gán cho action slot (nếu có) */
    _dispatchGestureAction(action, cfg) {
        const slotField = GESTURE_ACTION_SLOT_CONFIG_FIELD[action];
        if (slotField) {
            this._clickControlCenterTarget(cfg[slotField]);
            return;
        }
        const run = GESTURE_ACTIONS[action];
        if (run) run();
    },

    /** Hết ngưỡng CỐ ĐỊNH SEEK_HOLD_ACTIVATE_MS (2s) giữ tay yên (touchend chưa fire) -> vào chế
     * độ tua lặp lại: PAUSE media trước (tránh xung đột với playback tự nhiên, xem docstring đầu
     * file), hiện badge, chạy 1 tick NGAY, rồi lặp lại mỗi Time 2 (gestureSeekHoldIntervalMs —
     * taskManager mode 'timeout', cùng khuôn listenClock, core/player-controls.js) tới khi
     * _stopSeekHold(). Time 2 ≠ ngưỡng kích hoạt — 2 khái niệm HOÀN TOÀN riêng (xem docstring đầu
     * file). */
    _activateSeekHold() {
        const isVideo = appState.get('isVideoPlayerMode');
        this._seekHoldMediaEl = isVideo ? bgVideoElement : audioPlayer;
        this._seekHoldWasPlaying = !this._seekHoldMediaEl.paused;
        this._seekHoldMediaEl.pause();

        this._seekHoldActive = true;
        this._seekHoldTotalSec = 0;
        this._runSeekTick();
        const holdIntervalMs = appConfigViz.getAll().gestureSeekHoldIntervalMs || 2000; // Time 2 — nhịp lặp lại
        taskManager.addNew(SEEK_HOLD_TICK_TASK, { time: holdIntervalMs, exe: () => this._runSeekTick(), mode: 'timeout', count: 0 });
        taskManager.operator(SEEK_HOLD_TICK_TASK, 'enabled');
    },

    /** 1 lần tua — đọc currentTime/duration TRỰC TIẾP từ `_seekHoldMediaEl` (chốt lúc kích hoạt),
     * di chuyển theo Time 1 (gestureSeekStepMs — ĐƠN VỊ NHẢY, KHÁC Time 2 là nhịp lặp gọi hàm
     * này), kẹp biên (core), commit qua message CÓ SẴN, cộng dồn + cập nhật badge. Chạm biên -> tự
     * dừng. */
    _runSeekTick() {
        const mediaEl = this._seekHoldMediaEl;
        const durationSec = mediaEl.duration || 0;
        const currentSec = mediaEl.currentTime || 0;
        const stepSec = (appConfigViz.getAll().gestureSeekStepMs || 2000) / 1000; // Time 1 — đơn vị nhảy
        const targetSec = currentSec + this._seekHoldDirection * stepSec;
        const { clampedSec, hitBoundary } = clampSeekPosition(targetSec, durationSec); // core/visualizer-gesture.js
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seekCommit', payload: { value: clampedSec } });

        this._seekHoldTotalSec += stepSec;
        const sign = this._seekHoldDirection > 0 ? '+' : '-';
        showSeekHoldIndicator(this._seekHoldDirection, `${sign}${this._seekHoldTotalSec.toFixed(1)}s`); // core/visualizer-gesture.js

        if (hitBoundary) this._stopSeekHold();
    },

    /** Dừng phiên seek-hold — gỡ badge, RESUME lại media nếu trước đó đang phát (xem docstring đầu
     * file). */
    _stopSeekHold() {
        taskManager.kill(SEEK_HOLD_TICK_TASK);
        this._seekHoldActive = false;
        hideSeekHoldIndicator(); // core/visualizer-gesture.js
        if (this._seekHoldWasPlaying && this._seekHoldMediaEl) this._seekHoldMediaEl.play().catch(() => {});
        this._seekHoldMediaEl = null;
    },
};
