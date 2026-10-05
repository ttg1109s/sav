/**
 * event/workflow/perf-hud.js — MỚI (05/10/2026, Giang yêu cầu "đưa perf-probe từ service về thành core riêng chịu rule
 * core, event bus"). Điều phối Performance HUD — thay service/perf-probe.js (ĐÃ XOÁ, từng tự đứng ngoài kiến trúc).
 *
 * Luồng:
 *   Settings > Troubleshooting > Performance HUD (core/app-settings-ui.js::wireAppSettingsPerfHud) ─┐
 *   Chạm trên HUD (core/perf-hud-ui.js::mountPerfHud, Rule 5a)                                     ├─▶ router 'perfHud' ─▶ đây
 *   Chạm bất kỳ trong app (event/listener/perf-hud.js, Block gate khi HUD tắt — event/block.js)    ─┘
 *   Vòng đo: task raf 'perfHud' (taskManager) do chính Workflow này đăng ký — trường hợp riêng "vòng tự nuôi sống",
 *   cùng loại visualizerRender (event-bus-flow.md mục 1).
 *
 * Cấu hình bền: domain AppConfig 'perfHud' (core/config.js) {enabled, style, orientation, position}, lưu
 * meta.perfHudConfig — Restore default settings xoá key này (event/workflow/settings-misc.js). Thay 3 key localStorage
 * `sav_perfProbe*` cũ (không còn đọc).
 *
 * Số liệu đo là RUNTIME của phiên (bộ đệm frame, lịch sử FPS, cú chạm đang theo dõi...) — giữ trong field `_xxx` của
 * Workflow (cùng khuôn `_screenStack` của workflowAppSettings), không đưa vào appState: hot path 60fps, không nơi nào
 * khác đọc. Tính toán ở core/perf-hud.js; ghi DOM ở core/perf-hud-ui.js.
 *
 * Chỉ ĐO, không can thiệp luồng app. 5 chỉ số, ~2 lần/giây: FPS (2s), frame giật > 25ms (2s), thời gian 1 frame,
 * JS của MỌI task raf trong 1 frame (bọc `loop.callback` của taskManager — frame lâu mà JS nhỏ = trình duyệt tự làm
 * style/layout/paint; JS lớn = code app nặng), frame video bị bỏ /s (#bg-video). Console (Debug console): 1 dòng sau mỗi
 * lần đổi màn Playlist <-> Visualizer, 1 dòng mỗi cú chạm (phần tử, khoảng chặn main thread dài nhất 1,5s đầu, fps).
 *
 * NẠP SAU: core/perf-hud.js, core/perf-hud-ui.js, components/perf-hud.js, core/config.js (appConfigPerfHud),
 * core/ui-theme/apply-ui.js, core/dom-refs.js (appStack), service/db.js, service/task-manager.js.
 * Gọi lúc chạy: workflowAppSettings (re-render màn cài đặt). NẠP TRƯỚC: event/router/perf-hud.js, event/workflow/app-boot.js.
 */
const PERF_HUD_TASK = 'perfHud';
const PERF_HUD_LONG_PRESS_TASK = 'perfHudLongPress';

/** Kiểu -> template (components/perf-hud.js). */
const PERF_HUD_TEMPLATE_BY_STYLE = {
    strip: () => renderPerfHudStrip(),
    detail: () => renderPerfHudDetail(PERF_HUD_SPARK_BARS),
};

/** Bật/tắt -> dựng hoặc gỡ HUD + vòng đo. */
const PERF_HUD_APPLY_BY_ENABLED = {
    true: () => workflowPerfHud._start(),
    false: () => workflowPerfHud._stop(),
};

/** pointermove trên HUD theo pha chạm: chưa nhấc lên = canh ngưỡng lệch (vuốt -> huỷ), đã nhấc = di chuyển HUD. */
const PERF_HUD_POINTER_MOVE_BY_ARMED = {
    true: (payload) => workflowPerfHud._moveDrag(payload),
    false: (payload) => workflowPerfHud._cancelLongPressIfSlid(payload),
};

const workflowPerfHud = {

    _handle: null, // {hudEl, valueEls, sparkBarEls} — null = HUD đang tắt
    _drag: null, // {pointerId, startX, startY, offsetX, offsetY, armed} trong lúc đang chạm HUD

    // ===== Số liệu runtime của phiên =====
    _frameLog: [], // [timestamp, delta]
    _fpsHistory: [], // mẫu FPS mỗi lần ghi HUD — biểu đồ cột kiểu detail
    _lastFrameTs: 0,
    _lastHudTs: 0,
    _lastSecTs: 0,
    _lastPlaylistHidden: false,
    _snapshotDueTs: 0,
    _snapshotLabel: '',
    _tapRecord: null, // {ts, label, maxGapMs}
    _jsMsThisSec: 0, // tổng ms JS của mọi task raf trong giây đang đếm (callback bọc cộng vào)
    _jsMsLastSec: 0,
    _lastDropped: null,
    _droppedPerSec: 0,

    // ===================== Cấu hình =====================

    /** Boot (event/workflow/app-boot.js): khôi phục meta.perfHudConfig rồi bật lại HUD nếu lần trước đang bật. */
    async loadPersistedConfigOnBoot() {
        const saved = await getMeta('perfHudConfig'); // service/db.js
        this._restoreSavedConfig(saved);
        PERF_HUD_APPLY_BY_ENABLED[appConfigPerfHud.getAll().enabled === true]();
    },

    /** Bước tuỳ chọn — chưa từng lưu thì giữ default đã seed. @param {*} saved */
    _restoreSavedConfig(saved) {
        if (!saved || typeof saved !== 'object') return; // guard
        const normalized = normalizePerfHudConfig(saved, appConfigPerfHud.getAll()); // core/perf-hud.js
        appConfigPerfHud.mutateAll((cfg) => { Object.assign(cfg, normalized); }); // core/config.js
        console.log('writer: "workflowPerfHud._restoreSavedConfig", page: "perfHudConfig", content: "khôi phục từ meta.perfHudConfig"');
    },

    /** Ứng 'perfHud.enabled.change' (công tắc ở Settings). @param {boolean} checked */
    async setEnabled(checked) {
        const enabled = checked === true;
        appConfigPerfHud.mutateAll((cfg) => { cfg.enabled = enabled; }); // core/config.js
        console.log(`writer: "workflowPerfHud.setEnabled", page: "perfHudConfig", content: "enabled=${enabled}"`);
        PERF_HUD_APPLY_BY_ENABLED[enabled]();
        await this._persist();
    },

    /** Ứng 'perfHud.style.change' — đổi Kiểu: đang hiện thì dựng lại HUD theo kiểu mới (giữ vị trí); vẽ lại màn cài đặt
     * (nút đang chọn + hiện/ẩn hàng Chiều). @param {string} style */
    async setStyle(style) {
        const next = normalizePerfHudStyle(style); // core/perf-hud.js
        appConfigPerfHud.mutateAll((cfg) => { cfg.style = next; }); // core/config.js
        console.log(`writer: "workflowPerfHud.setStyle", page: "perfHudConfig", content: "style=${next}"`);
        this._remount();
        workflowAppSettings._renderPerfHudSettings(); // event/workflow/app-settings.js — vẽ lại tại chỗ, giữ cuộn
        await this._persist();
    },

    /** Ứng 'perfHud.orientation.change' — đổi Chiều dải. @param {string} orientation */
    async setOrientation(orientation) {
        const next = normalizePerfHudOrientation(orientation); // core/perf-hud.js
        appConfigPerfHud.mutateAll((cfg) => { cfg.orientation = next; }); // core/config.js
        console.log(`writer: "workflowPerfHud.setOrientation", page: "perfHudConfig", content: "orientation=${next}"`);
        this._applyOrientation(next);
        workflowAppSettings._renderPerfHudSettings(); // event/workflow/app-settings.js
        await this._persist();
    },

    async _persist() {
        await setMeta('perfHudConfig', { ...appConfigPerfHud.getAll() }); // service/db.js
    },

    // ===================== Dựng / gỡ =====================

    _start() {
        if (this._handle) return; // guard — đang chạy
        this._resetMetrics();
        this._mountHud();
        taskManager.addNew(PERF_HUD_TASK, { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator(PERF_HUD_TASK, 'enabled');
    },

    _stop() {
        if (!this._handle) return; // guard — đang tắt
        taskManager.kill(PERF_HUD_TASK);
        taskManager.kill(PERF_HUD_LONG_PRESS_TASK);
        this._unwrapRafCallbacks();
        removePerfHud(this._handle); // core/perf-hud-ui.js
        this._handle = null;
        this._drag = null;
        this._tapRecord = null;
        this._snapshotDueTs = 0;
    },

    _resetMetrics() {
        this._frameLog.length = 0;
        this._fpsHistory.length = 0;
        this._lastFrameTs = 0;
        this._lastHudTs = 0;
        this._lastSecTs = performance.now();
        this._jsMsThisSec = 0;
        this._jsMsLastSec = 0;
        this._lastDropped = null;
        this._droppedPerSec = 0;
        this._lastPlaylistHidden = appStack.classList.contains('playlist-hidden'); // core/dom-refs.js
    },

    /** Dựng HUD theo config hiện tại, áp theme, đặt về vị trí đã lưu (kẹp trong màn hình), ghi số ngay. */
    _mountHud() {
        const cfg = appConfigPerfHud.getAll(); // core/config.js
        this._handle = mountPerfHud(PERF_HUD_TEMPLATE_BY_STYLE[cfg.style](), cfg.orientation); // components/perf-hud.js, core/perf-hud-ui.js
        applyUiThemeToDom(this._handle.hudEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — đổi theme sau đó: lượt quét toàn document tự cập nhật
        const pos = cfg.position || PERF_HUD_DEFAULT_POSITION;
        this._placeClamped(pos.left, pos.top);
        this._renderHud(performance.now());
    },

    /** Đổi Kiểu lúc đang hiện — gỡ bản cũ, dựng bản mới (vòng đo + số liệu giữ nguyên). */
    _remount() {
        if (!this._handle) return; // guard — HUD đang tắt, lần bật sau tự dựng đúng kiểu
        taskManager.kill(PERF_HUD_LONG_PRESS_TASK);
        this._drag = null;
        removePerfHud(this._handle); // core/perf-hud-ui.js
        this._mountHud();
    },

    _applyOrientation(orientation) {
        if (!this._handle) return; // guard
        setPerfHudOrientation(this._handle.hudEl, orientation); // core/perf-hud-ui.js
        this._placeClamped(parseFloat(this._handle.hudEl.style.left) || PERF_HUD_EDGE_GAP_PX, parseFloat(this._handle.hudEl.style.top) || PERF_HUD_EDGE_GAP_PX);
    },

    /** Đặt HUD tại (left, top) đã kẹp trong màn hình. @returns {{left:number, top:number}} vị trí thật */
    _placeClamped(left, top) {
        const hudEl = this._handle.hudEl;
        const pos = computePerfHudPosition(left, top, hudEl.offsetWidth, hudEl.offsetHeight, window.innerWidth, window.innerHeight, PERF_HUD_EDGE_GAP_PX); // core/perf-hud.js
        placePerfHud(hudEl, pos.left, pos.top); // core/perf-hud-ui.js
        return pos;
    },

    // ===================== Chạm giữ để kéo =====================

    /** Ứng 'perfHud.hud.pointerdown': ghi điểm chạm, hẹn giờ chạm giữ — đủ lâu mà chưa trượt thì HUD nhấc lên để kéo.
     * @param {{pointerId:number, x:number, y:number}} payload */
    onHudPointerDown({ pointerId, x, y }) {
        if (!this._handle || this._drag) return; // guard — HUD tắt / ngón thứ 2 khi đang chạm
        const rect = this._handle.hudEl.getBoundingClientRect();
        this._drag = { pointerId, startX: x, startY: y, offsetX: x - rect.left, offsetY: y - rect.top, armed: false };
        capturePerfHudPointer(this._handle.hudEl, pointerId); // core/perf-hud-ui.js
        taskManager.once(() => this._armDrag(), PERF_HUD_LONG_PRESS_MS, PERF_HUD_LONG_PRESS_TASK); // service/task-manager.js
    },

    _armDrag() {
        if (!this._drag || !this._handle) return; // guard — đã nhả tay/HUD đã gỡ
        this._drag.armed = true;
        setPerfHudDragging(this._handle.hudEl, true); // core/perf-hud-ui.js
    },

    /** Ứng 'perfHud.hud.pointermove'. @param {{pointerId:number, x:number, y:number}} payload */
    onHudPointerMove(payload) {
        if (!this._drag || payload.pointerId !== this._drag.pointerId) return; // guard — không phải ngón đang theo dõi
        PERF_HUD_POINTER_MOVE_BY_ARMED[this._drag.armed](payload);
    },

    _moveDrag({ x, y }) {
        this._placeClamped(x - this._drag.offsetX, y - this._drag.offsetY);
    },

    /** Trượt quá ngưỡng trước khi đủ thời gian chạm giữ = vuốt -> huỷ, HUD đứng yên. */
    _cancelLongPressIfSlid({ x, y }) {
        if (!isPerfHudDragSlopExceeded(this._drag.startX, this._drag.startY, x, y, PERF_HUD_DRAG_SLOP_PX)) return; // core/perf-hud.js
        taskManager.kill(PERF_HUD_LONG_PRESS_TASK);
        this._drag = null;
    },

    /** Ứng 'perfHud.hud.pointerup' (cả pointercancel). Đã kéo thì lưu vị trí mới. @param {{pointerId:number}} payload */
    async onHudPointerUp({ pointerId }) {
        if (!this._drag || pointerId !== this._drag.pointerId) return; // guard
        taskManager.kill(PERF_HUD_LONG_PRESS_TASK);
        const wasArmed = this._drag.armed;
        this._drag = null;
        await this._commitDragPosition(wasArmed);
    },

    /** Bước tuỳ chọn — chỉ khi HUD đã thật sự được nhấc lên kéo. @param {boolean} wasArmed */
    async _commitDragPosition(wasArmed) {
        if (!wasArmed || !this._handle) return; // guard — chạm ngắn / vuốt: không đổi gì
        const hudEl = this._handle.hudEl;
        setPerfHudDragging(hudEl, false); // core/perf-hud-ui.js
        const position = { left: parseFloat(hudEl.style.left), top: parseFloat(hudEl.style.top) };
        appConfigPerfHud.mutateAll((cfg) => { cfg.position = position; }); // core/config.js
        console.log(`writer: "workflowPerfHud._commitDragPosition", page: "perfHudConfig", content: "position=${position.left},${position.top}"`);
        await this._persist();
    },

    // ===================== Nhật ký chạm =====================

    /** Ứng 'perfHud.app.pointerdown' (mọi cú chạm trong app — Block gate chặn sẵn khi HUD tắt). @param {Element} target */
    onAppPointerDown(target) {
        if (!this._handle || this._handle.hudEl.contains(target)) return; // guard — HUD tắt / đang chạm chính HUD
        const now = performance.now();
        this._flushTapRecord(now); // chạm dồn dập -> chốt bản trước
        this._tapRecord = { ts: now, label: describePerfTapTarget(target), maxGapMs: 0 }; // core/perf-hud.js
    },

    _flushTapRecord(now) {
        if (!this._tapRecord) return; // guard
        trimPerfFrameLog(this._frameLog, now, PERF_HUD_WINDOW_MS); // core/perf-hud.js
        const { fps } = computePerfFrameStats(this._frameLog, PERF_HUD_JANK_MS); // core/perf-hud.js
        const screen = resolvePerfScreenLabel(appStack.classList.contains('playlist-hidden')); // core/perf-hud.js
        console.log(`[perf-hud] chạm ${this._tapRecord.label} | chặn max ${this._tapRecord.maxGapMs.toFixed(0)}ms | fps sau ${((now - this._tapRecord.ts) / 1000).toFixed(1)}s ${fps} | màn ${screen}`);
        this._tapRecord = null;
    },

    // ===================== Vòng đo (task raf 'perfHud') =====================

    _tick() {
        const now = performance.now();
        this._recordFrame(now);
        this._trackTapBlock(now);
        this._flushTapIfDue(now);
        this._lastFrameTs = now;
        this._wrapRafCallbacks();
        this._rollSecond(now);
        this._detectScreenChange(now);
        this._refreshHudIfDue(now);
        this._flushSnapshotIfDue(now);
    },

    _recordFrame(now) {
        if (!this._lastFrameTs) return; // guard — frame đầu chưa có mốc
        this._frameLog.push([now, now - this._lastFrameTs]);
    },

    _trackTapBlock(now) {
        if (!this._tapRecord || !this._lastFrameTs || now - this._tapRecord.ts > PERF_HUD_TAP_BLOCK_WINDOW_MS) return; // guard
        this._tapRecord.maxGapMs = Math.max(this._tapRecord.maxGapMs, now - this._lastFrameTs);
    },

    _flushTapIfDue(now) {
        if (!this._tapRecord || now - this._tapRecord.ts < PERF_HUD_TAP_REPORT_DELAY_MS) return; // guard
        this._flushTapRecord(now);
    },

    /** Bọc callback của MỌI task raf (task tạo sau được bọc ở lượt tick kế) để cộng thời gian JS. Gỡ hết lúc tắt. */
    _wrapRafCallbacks() {
        Object.keys(taskManager.plan).forEach((name) => this._wrapRafTask(name));
    },

    _wrapRafTask(name) {
        const loop = taskManager.plan[name];
        if (!loop || loop.mode !== 'raf' || name === PERF_HUD_TASK || loop.callback.__perfHudOriginal) return; // guard
        const original = loop.callback;
        const wrapped = function perfHudTimedCallback() {
            const t0 = performance.now();
            try {
                return original.apply(this, arguments);
            } finally {
                workflowPerfHud._jsMsThisSec += performance.now() - t0;
            }
        };
        wrapped.__perfHudOriginal = original;
        loop.callback = wrapped;
    },

    _unwrapRafCallbacks() {
        Object.keys(taskManager.plan).forEach((name) => this._unwrapRafTask(name));
    },

    _unwrapRafTask(name) {
        const loop = taskManager.plan[name];
        if (!loop || !loop.callback || !loop.callback.__perfHudOriginal) return; // guard
        loop.callback = loop.callback.__perfHudOriginal;
    },

    _rollSecond(now) {
        if (now - this._lastSecTs < 1000) return; // guard
        this._jsMsLastSec = this._jsMsThisSec;
        this._jsMsThisSec = 0;
        this._sampleDroppedFrames();
        this._lastSecTs = now;
    },

    /** Đọc bộ đếm frame bị bỏ của #bg-video (null = trình duyệt không hỗ trợ -> HUD hiện '-'). */
    _sampleDroppedFrames() {
        const video = document.getElementById('bg-video');
        const dropped = (video && typeof video.getVideoPlaybackQuality === 'function') ? video.getVideoPlaybackQuality().droppedVideoFrames : null;
        this._droppedPerSec = computePerfDroppedPerSec(dropped, this._lastDropped); // core/perf-hud.js
        this._lastDropped = dropped;
    },

    _detectScreenChange(now) {
        const playlistHidden = appStack.classList.contains('playlist-hidden'); // core/dom-refs.js
        if (playlistHidden === this._lastPlaylistHidden) return; // guard — chưa đổi màn
        this._lastPlaylistHidden = playlistHidden;
        this._snapshotLabel = `đổi màn -> ${playlistHidden ? 'Visualizer' : 'Playlist'}`;
        this._snapshotDueTs = now + PERF_HUD_SNAPSHOT_DELAY_MS;
    },

    _refreshHudIfDue(now) {
        if (now - this._lastHudTs < PERF_HUD_REFRESH_MS) return; // guard
        this._lastHudTs = now;
        this._renderHud(now);
    },

    _flushSnapshotIfDue(now) {
        if (!this._snapshotDueTs || now < this._snapshotDueTs) return; // guard
        this._snapshotDueTs = 0;
        const screen = resolvePerfScreenLabel(this._lastPlaylistHidden); // core/perf-hud.js
        console.log(`[perf-hud] SAU ${this._snapshotLabel} :: ${formatPerfHudReport(screen, this._buildMetrics(now))}`); // core/perf-hud.js
    },

    _buildMetrics(now) {
        trimPerfFrameLog(this._frameLog, now, PERF_HUD_WINDOW_MS); // core/perf-hud.js
        const { fps, jank } = computePerfFrameStats(this._frameLog, PERF_HUD_JANK_MS); // core/perf-hud.js
        return computePerfHudMetrics({ fps, jank, jsMsLastSec: this._jsMsLastSec, droppedPerSec: this._droppedPerSec }); // core/perf-hud.js
    },

    /** Ghi số + biểu đồ lên HUD (kiểu strip không có cột biểu đồ — core tự bỏ qua mảng rỗng). */
    _renderHud(now) {
        const metrics = this._buildMetrics(now);
        pushPerfFpsHistory(this._fpsHistory, metrics.fps, PERF_HUD_SPARK_BARS); // core/perf-hud.js
        writePerfHudValues(this._handle.valueEls, formatPerfHudValues(metrics)); // core/perf-hud.js, core/perf-hud-ui.js
        writePerfHudSparkHeights(this._handle.sparkBarEls, computePerfHudSparkHeights(this._fpsHistory, PERF_HUD_SPARK_BARS, PERF_HUD_SPARK_MIN_PEAK)); // core/perf-hud.js, core/perf-hud-ui.js
    },
};
