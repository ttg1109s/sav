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
 * 4 hướng vuốt + 2 tap (đơn/đúp) + TAP 3 LẦN — CẢ 7 đều là "hành động do người dùng chọn", CÙNG 1
 * pool lựa chọn (SỬA 12/08/2026, Giang yêu cầu "tap 3 dùng chung select giống tap/cử chỉ khác" —
 * TRƯỚC ĐÂY tap 3 lần tách riêng, chọn THẲNG 1 nút Control Center, KHÁC hẳn 6 cái kia) — mỗi cái 1
 * field string riêng trong vizConfig, giá trị 1 trong 7 hành động cố định
 * ('next'/'prev'/'playPause'/'openPlaylist'/'speedUp'/'speedDown'/'none', GESTURE_ACTIONS —
 * speedUp/speedDown MỚI 18/09/2026) HOẶC 1 trong 3 Action slot ('actionSlot1/2/3',
 * GESTURE_ACTION_SLOT_CONFIG_FIELD — MỖI slot gán 1 nút Control Center riêng, xem components/
 * gesture-settings-drawer.js section "Actions"). Hoạt động bất kể đang phát Song hay Video
 * (playerControls.next/prev.click TỰ đúng cho cả 2 loại — Workflow này không cần biết đang phát
 * gì).
 *
 * TAP 3 LẦN (MỚI, THAY THẾ vuốt cạnh dưới đã bỏ hẳn) — đúng chức năng vuốt cạnh dưới cũ, đổi cơ
 * chế kích hoạt sang chạm 3 lần liên tiếp cho dễ thao tác hơn (phản hồi Giang) — muốn bấm THẲNG 1
 * nút Control Center (như hành vi CŨ trước 12/08/2026) thì gán nút đó cho 1 trong 3 Action slot rồi
 * chọn slot đó ở đây, CÙNG cách 6 action picker kia đã làm từ đầu — không còn "đường tắt" riêng.
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
 * Dừng khi thả tay / touch bị huỷ (touchcancel — hệ thống chen ngang) / chạm biên 0 hoặc (thời lượng - 1s) — chạm biên TỰ NHẢ
 * "ngón tay ảo" (commit ngay, không chờ thả tay — SỬA 07/10/2026, Giang). Muốn tua tiếp phải giữ tay lại từ đầu (không tự nối
 * phiên, phải qua lại ngưỡng #1); touchend sau khi đã tự nhả rơi xuống nhánh cử chỉ thường nhưng không khớp gì (giữ > 300ms
 * nên không phải tap, đứng yên nên không phải vuốt). touchmove chỉ dùng để HUỶ hẹn giờ NẾU CHƯA kích hoạt (tay di chuyển quá xa = đang thành vuốt,
 * không phải giữ yên) — KHÔNG huỷ 1 phiên seek ĐANG chạy.
 *
 * SỬA (07/10/2026, Giang chốt "ngón tay ảo") — cử chỉ ĐI ĐÚNG luồng kéo tay thanh tiến trình, KHÔNG còn cơ chế seek riêng:
 *   - kích hoạt + mỗi tick: cộng dồn mốc (tự giữ `_seekHoldPositionSec`, KHÔNG đọc lại currentTime — Song vẫn phát tiếp lúc
 *     giữ tay), đặt thumb thanh tiến trình tới mốc (setProgressBarValue(), core/player-controls.js) rồi gửi
 *     'playerControls.progressBar.seeking' — y hệt sự kiện 'input' khi kéo tay: Song chỉ đổi nhãn giờ + phụ đề (vẫn phát);
 *     Video tự pause + xem trước khung hình (hàng đợi scrub).
 *   - thả tay / touchcancel: gửi 'playerControls.progressBar.seekCommit' ĐÚNG 1 lần — y hệt 'change' khi thả tay: 1 lệnh cổng
 *     seek duy nhất, chạy NGAY trong touchend (thao tác chạm của người dùng). Video tự phát lại nếu trước đó đang phát.
 * Trước đây mỗi tick là 1 lệnh seek THẬT qua cổng seek (tự pause/resume media, cờ `fromGesture` + nhánh riêng ở
 * workflowVideoPlayer.handleVideoSeekCommit()) -> mỗi tick 1 lần nạp lại nguồn, thả tay phải đợi lệnh cuối xong mới phát
 * (Giang báo trễ, trong khi chọn mốc trên thanh gần như không trễ). Đã bỏ toàn bộ phần riêng đó.
 *
 * Mũi tên + số giây đã tua (core/visualizer-gesture.js — showSeekHoldIndicator()/
 * hideSeekHoldIndicator()) — CỐ ĐỊNH giữa theo chiều dọc, tại tâm nửa trái/phải màn hình tuỳ chiều
 * (KHÔNG bám toạ độ chạm) — hiện lúc kích hoạt, cộng dồn theo từng tick, gỡ lúc dừng.
 *
 * NẠP SAU: core/visualizer-gesture.js, core/dom-refs.js, service/task-manager.js,
 * event/router/player-controls.js, event/router/visualizer-control-center.js, core/hud.js
 * (findAdjacentPlaybackSpeedPreset — MỚI 18/09/2026, speedUp/speedDown), event/workflow/hud.js
 * (workflowHud.selectSpeed — MỚI 18/09/2026, gọi runtime NÊN thứ tự nạp so với 2 file này không
 * thật sự bắt buộc, ghi lại cho rõ phụ thuộc).
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
 * không viết lại logic next/prev/play-pause/mở-playlist.
 * MỚI (18/09/2026, Giang yêu cầu "bổ sung tăng/giảm theo các mốc tốc độ trong cử chỉ") —
 * speedUp/speedDown: tìm mốc liền kề hiện tại trong PLAYBACK_SPEED_PRESETS (core/hud.js,
 * findAdjacentPlaybackSpeedPreset() — hoạt động đúng cả khi tốc độ hiện tại đang là 1 giá trị liên
 * tục KHÔNG khớp mốc nào, do slider mới cho phép) rồi gọi THẲNG workflowHud.selectSpeed() (event/
 * workflow/hud.js) — Workflow gọi Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B, KHÔNG
 * viết lại logic áp speed/đồng bộ HUD (apply + persist + sync UI CÙNG 1 chỗ với slider/nút mốc). */
const GESTURE_ACTIONS = {
    next: () => eventBus.send({ router: 'playerControls', type: 'playerControls.next.click', payload: {} }),
    prev: () => eventBus.send({ router: 'playerControls', type: 'playerControls.prev.click', payload: {} }),
    playPause: () => eventBus.send({ router: 'playerControls', type: 'playerControls.playPause.click', payload: {} }),
    openPlaylist: () => eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} }),
    speedUp: () => workflowHud.selectSpeed(findAdjacentPlaybackSpeedPreset(appConfigViz.getAll().playbackSpeed, 1)), // core/hud.js
    speedDown: () => workflowHud.selectSpeed(findAdjacentPlaybackSpeedPreset(appConfigViz.getAll().playbackSpeed, -1)), // core/hud.js
    none: () => {},
};

/** Trục + chiều vuốt (đã resolveDominantSwipeAxis/resolveSwipeDirection, core) -> field vizConfig
 * tương ứng. 1 = xuôi trục (xuống/phải), -1 = ngược trục (lên/trái) — xem resolveSwipeDirection(). */
const GESTURE_SWIPE_CONFIG_FIELD = {
    y: { '-1': 'gestureActionSwipeUp', '1': 'gestureActionSwipeDown' },
    x: { '-1': 'gestureActionSwipeLeft', '1': 'gestureActionSwipeRight' },
};

/** Nút Control Center hợp lệ để gán cho 3 "Slot" trong section Actions (MỚI 12/08/2026) — key
 * khớp <option> ở components/gesture-settings-drawer.js. Tham chiếu THẲNG biến dom-refs (không tự
 * document.getElementById) — undefined-safe cho trang không nạp đủ bộ dom-refs (subtitle-editor.html).
 * SỬA (12/08/2026, Giang yêu cầu thêm "Action") — bổ sung 3 nút CÒN THIẾU so với TOÀN BỘ nút
 * data-cc-action thật sự có ở Control Center (components/visualizer-overlay.js): openVolume/
 * cycleEq/editEq — trước đây map này viết TRƯỚC khi 3 nút đó tồn tại, lúc đó đủ cả 8/8.
 * SỬA TIẾP (cùng ngày, "gộp eq edit vào hold 3s, bỏ icon edit riêng") — `editEq` (#btn-edit-eq) ĐÃ
 * BỎ khỏi map này cùng lúc xoá hẳn nút (mở Edit EQ giờ gộp vào GIỮ 1.5s trên `cycleEq`, không còn
 * là 1 "nút bấm hộ được" riêng nữa) — còn lại đúng 7/7. `cycleEq` (#btn-cycle-eq) VẪN gán được như
 * cũ — `.click()` do _clickControlCenterTarget() gọi vẫn hoạt động đúng (bấm NGẮN/cycle), xem
 * docstring event/listener/eq-presets.js (lý do #btn-cycle-eq giữ riêng 1 listener `click`, không
 * gộp vào `pointerup`, để tương thích CHÍNH cơ chế `.click()` này).
 * XOÁ (loại bỏ Document Reader khỏi app) — `documentReader` (#btn-open-document-reader) khỏi map,
 * còn lại 6/6.
 * SỬA TIẾP (cùng ngày, "tap 3 dùng chung select giống tap/cử chỉ khác") — Tap 3 lần KHÔNG còn tra
 * map này TRỰC TIẾP nữa (đi qua _dispatchGestureAction() như 6 action picker kia — CHỈ tới map này
 * GIÁN TIẾP nếu người dùng chọn 1 Action slot đã gán nút, y hệt cách swipe/tap đơn/đúp vẫn luôn
 * làm). Config cũ (nếu người dùng đã TỪNG gán 1 trong 3 Action slot cho `editEq` trước bản sửa
 * trước, HOẶC gán Tap 3 lần THẲNG cho 1 nút Control Center trước bản sửa NÀY) không cần migrate —
 * tra map/GESTURE_ACTIONS đều trả `undefined`, _clickControlCenterTarget()/_dispatchGestureAction()
 * tự im lặng bỏ qua (CÙNG cách xử lý nút đang ẩn, vd `captureFrame` ngoài Video mode). */
const GESTURE_TRIPLE_TAP_TARGET_ELS = {
    cycleMode: typeof btnCycleMode !== 'undefined' ? btnCycleMode : null,
    shuffle: typeof btnShuffle !== 'undefined' ? btnShuffle : null,
    repeat: typeof btnRepeat !== 'undefined' ? btnRepeat : null,
    captureFrame: typeof btnCaptureVideoFrame !== 'undefined' ? btnCaptureVideoFrame : null,
    openVolume: typeof btnOpenVolume !== 'undefined' ? btnOpenVolume : null,
    cycleEq: typeof btnCycleEq !== 'undefined' ? btnCycleEq : null,
};

/** MỚI (12/08/2026, Giang yêu cầu — "Action" cho Cử chỉ) — 3 "ngăn" CỐ ĐỊNH, mỗi ngăn gán 1 nút
 * Control Center (chọn ở section Action riêng, components/gesture-settings-drawer.js) — 7 dropdown
 * vuốt/tap/tap-3-lần (KHÔNG gồm seek/vuốt cạnh trên, xem docstring vizConfig.gestureActionSlot1)
 * chọn được 'actionSlot1/2/3' NGOÀI 5 hành động mặc định trong GESTURE_ACTIONS —
 * _dispatchGestureAction() tra bảng NÀY trước, khớp thì đi qua _clickControlCenterTarget() (gọi
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
    _seekHoldActive: false, // đã qua ngưỡng SEEK_HOLD_ACTIVATE_MS, phiên "ngón tay ảo" đang mở (tới lúc thả tay)
    _seekHoldKey: null, // currentKey lúc kích hoạt — Song phát tiếp lúc giữ tay, hết bài giữa chừng thì KHÔNG commit mốc lên bài mới
    _seekHoldTotalSec: 0, // tổng đã tua trong phiên hiện tại — hiện lên badge, cộng dồn mỗi tick
    // MỚI (07/10/2026) — vị trí + thời lượng do PHIÊN tự giữ, KHÔNG đọc lại từ media mỗi tick (Song vẫn phát tiếp lúc giữ tay;
    // cổng seek nạp lại nguồn làm currentTime tạm = 0).
    _seekHoldPositionSec: 0, // mốc "ngón tay ảo" đang đứng (khởi đầu = vị trí lúc kích hoạt)
    _seekHoldDurationSec: 0, // thời lượng chốt lúc kích hoạt

    /** Ứng với 'visualizerGesture.touch.start'. @param {number} x @param {number} y */
    handleTouchStart(x, y) {
        this._startX = x; this._startY = y; this._startTime = Date.now();
        this._startEdge = isInTopEdgeZone(y, EDGE_ZONE_PX) ? 'top' : null; // core/visualizer-gesture.js — rìa DƯỚI đã bỏ (thay bằng tap 3 lần)

        // Photo Player mode không có playbackRate/thanh seek thật (đã ẩn hẳn, xem core/photo-
        // player.js::enterPhotoPlayerModeState()) — seek-hold dựa vào `_activateSeekHold()` chỉ rẽ
        // nhị phân video/audioPlayer, sẽ pause/seek NHẦM audioPlayer (không phải player đang active)
        // nếu để lọt qua — tắt RIÊNG seek-hold ở mode này, KHÔNG đụng gì tới tap/vuốt khác (2 biến
        // trên vẫn cần set bình thường để touchend phân loại tap/vuốt đúng).
        const isPhotoPlayerMode = appState.get('isPhotoPlayerMode');

        if (!this._startEdge && !isPhotoPlayerMode && appConfigViz.getAll().gestureSeekHoldEnabled !== false) {
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
        if (this._seekHoldActive) { this._stopSeekHold(); return; } // thả "ngón tay ảo" -> commit (trong touchend, như 'change' của thanh)
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

    /** Tap 3 lần — SỬA (12/08/2026, Giang yêu cầu "tap 3 dùng chung select giống tap/cử chỉ khác")
     * — giờ ĐÚNG khuôn tap đơn/đúp/vuốt: tra `_dispatchGestureAction()` (5 hành động cố định HOẶC
     * 1 Action slot đã gán nút) THAY VÌ bấm THẲNG 1 nút Control Center như bản cũ
     * (`_clickControlCenterTarget()` trực tiếp) — muốn bấm thẳng 1 nút thì gán nút đó cho 1 Action
     * slot rồi chọn slot đó ở đây (xem docstring đầu file + GESTURE_TRIPLE_TAP_TARGET_ELS). */
    _resolveTripleTap(cfg) {
        this._dispatchGestureAction(cfg.gestureTripleTapTarget, cfg);
    },

    /** Bấm thẳng 1 nút Control Center theo key (GESTURE_TRIPLE_TAP_TARGET_ELS) — DÙNG BỞI 3 Action
     * slot (qua _dispatchGestureAction() khi khớp actionSlot1/2/3) — 'none'/rỗng/nút đang ẩn (vd
     * captureFrame ngoài Video mode) đều im lặng bỏ qua.
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

    /** Tra + chạy 1 hành động — DÙNG CHUNG bởi tap đơn/đúp, vuốt, VÀ tap 3 lần (SỬA 12/08/2026,
     * trước đây tap 3 lần đi thẳng _clickControlCenterTarget(), giờ qua đây như 6 cái kia — xem
     * docstring _resolveTripleTap()). Tra GESTURE_ACTION_SLOT_CONFIG_FIELD TRƯỚC (3 Action slot) —
     * khớp thì bấm thẳng nút Control Center đã gán (_clickControlCenterTarget()); không khớp mới
     * tra GESTURE_ACTIONS (5 hành động mặc định next/prev/playPause/openPlaylist/none) như cũ.
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

    /** Hết ngưỡng CỐ ĐỊNH SEEK_HOLD_ACTIVATE_MS (2s) giữ tay yên (touchend chưa fire) -> mở phiên "ngón tay ảo": hiện badge,
     * chạy 1 tick NGAY, rồi lặp lại mỗi Time 2 (gestureSeekHoldIntervalMs — taskManager mode 'timeout', cùng khuôn
     * listenClock, core/player-controls.js) tới khi chạm biên hoặc thả tay. Time 2 ≠ ngưỡng kích hoạt — 2 khái niệm HOÀN TOÀN
     * riêng (xem docstring đầu file). SỬA 07/10/2026 — KHÔNG còn tự pause media (xem docstring đầu file). */
    _activateSeekHold() {
        const isVideo = appState.get('isVideoPlayerMode');
        const mediaEl = isVideo ? bgVideoElement : audioPlayer; // chọn GIÁ TRỊ để đọc vị trí/thời lượng
        // Chốt thời lượng + vị trí 1 lần lúc kích hoạt. Media chưa có thời lượng (chưa nạp xong) -> không vào seek mode (kẹp biên
        // với duration 0 sẽ ra mốc 0 = phát lại từ đầu).
        const durationSec = mediaEl.duration;
        if (!Number.isFinite(durationSec) || durationSec <= 0) return; // guard
        this._seekHoldDurationSec = durationSec;
        this._seekHoldPositionSec = workflowPlayerControls.getSeekGatePosition(mediaEl); // event/workflow/player-controls.js — cổng đang chạy thì lấy mốc của nó
        this._seekHoldKey = appState.get('currentKey');

        this._seekHoldActive = true;
        this._seekHoldTotalSec = 0;
        this._runSeekTick();
        if (!this._seekHoldActive) return; // guard — tick đầu đã chạm biên và tự nhả, không dựng nhịp lặp (sẽ commit lần 2)
        const holdIntervalMs = appConfigViz.getAll().gestureSeekHoldIntervalMs || 2000; // Time 2 — nhịp lặp lại
        taskManager.addNew(SEEK_HOLD_TICK_TASK, { time: holdIntervalMs, exe: () => this._runSeekTick(), mode: 'timeout', count: 0 });
        taskManager.operator(SEEK_HOLD_TICK_TASK, 'enabled');
    },

    /** 1 tick — dời "ngón tay ảo" thêm Time 1 (gestureSeekStepMs — ĐƠN VỊ NHẢY, KHÁC Time 2 là nhịp lặp gọi hàm này) từ mốc phiên
     * tự giữ, kẹp biên (core), đặt thumb thanh tiến trình + gửi 'seeking' (y hệt 'input' khi kéo tay — CHƯA seek thật), cộng dồn +
     * cập nhật badge. Chạm biên -> tự nhả (commit ngay). */
    _runSeekTick() {
        const stepSec = (appConfigViz.getAll().gestureSeekStepMs || 2000) / 1000; // Time 1 — đơn vị nhảy
        const fromSec = this._seekHoldPositionSec;
        const targetSec = fromSec + this._seekHoldDirection * stepSec;
        const { clampedSec, hitBoundary } = clampSeekPosition(targetSec, this._seekHoldDurationSec); // core/visualizer-gesture.js
        this._seekHoldPositionSec = clampedSec;
        // SỬA (07/10/2026) — badge vẽ TRƯỚC khi gửi 'seeking': UI của cử chỉ không phụ thuộc nơi nhận (trước đây phụ đề Song ném lỗi
        // trong 'seeking' -> badge không bao giờ hiện, nhịp lặp cũng không được dựng).
        this._seekHoldTotalSec += Math.abs(clampedSec - fromSec); // chạm biên chỉ cộng phần thật sự tua
        const sign = this._seekHoldDirection > 0 ? '+' : '-';
        showSeekHoldIndicator(this._seekHoldDirection, `${sign}${this._seekHoldTotalSec.toFixed(1)}s`); // core/visualizer-gesture.js

        setProgressBarValue(clampedSec); // core/player-controls.js — không có ngón tay thật trên thanh, tự đặt thumb
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seeking', payload: { value: clampedSec } });

        if (hitBoundary) this._stopSeekHold(); // chạm biên 0 / (thời lượng - 1s) -> tự nhả "ngón tay ảo", commit ngay
    },

    /** Thả "ngón tay ảo" (touchend/touchcancel/chạm biên) — gỡ badge, gửi 'seekCommit' ĐÚNG 1 lần (y hệt 'change' khi thả tay trên thanh):
     * Song/Video tự chạy cổng seek + phát lại đúng như kéo tay. Đang giữ tay mà media đã đổi (Song phát tiếp, hết bài -> bài mới)
     * thì commit đúng vị trí hiện tại của media mới — chỉ để đóng phiên kéo (`isSeeking`), không đẩy mốc của bài cũ sang bài mới. */
    _stopSeekHold() {
        taskManager.kill(SEEK_HOLD_TICK_TASK);
        this._seekHoldActive = false;
        hideSeekHoldIndicator(); // core/visualizer-gesture.js
        const mediaChanged = appState.get('currentKey') !== this._seekHoldKey;
        const activeMediaEl = appState.get('isVideoPlayerMode') ? bgVideoElement : audioPlayer; // chọn GIÁ TRỊ
        const commitSec = mediaChanged ? workflowPlayerControls.getSeekGatePosition(activeMediaEl) : this._seekHoldPositionSec; // chọn GIÁ TRỊ
        eventBus.send({ router: 'playerControls', type: 'playerControls.progressBar.seekCommit', payload: { value: commitSec } });
    },
};
