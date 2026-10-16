/**
 * event/workflow/recorder.js — Workflow chế độ GHI ÂM ở Player Song/Video.
 *
 * LUỒNG:
 *   1. Icon Ghi âm (Control Center) -> start(): xin mic (Audio Session 'play-and-record'), dựng graph ghi (core/recorder.js
 *      — mic + nhạc lấy sau masterGainNode, trộn NGAY lúc ghi), MediaRecorder chạy, overlay #recorder-layer che toàn màn
 *      Visualizer + chặn thanh player (giống Game). Media đang dừng thì tự phát.
 *   2. Dừng ghi = X / media hết THẬT / ngắt từ ngoài (pause từ tai nghe-màn hình khoá-cuộc gọi, ẩn app, mic bị thu hồi)
 *      — xử lý như X: pause media -> dừng MediaRecorder -> trả Audio Session 'playback' -> Blob vào RAM state
 *      (`recordBlob`) -> modal nghe lại (mini waveform, tự phát lặp, chạm waveform để tua). Hết bài KHÔNG tự chuyển bài
 *      (event/router/player-controls.js chuyển 'ended' về đây khi recordPhase !== 'idle').
 *   3. Huỷ: bỏ bản ghi -> media phát dở thì phát tiếp, đã hết thật thì sang bài kế (handleMediaEnded() — tôn trọng
 *      Repeat/Shuffle). Lưu: thành 1 Song MỚI (workflowPlaylist.addRecordedSong()) — định dạng theo OS (iOS m4a, Chrome
 *      webm), tag "<tên gốc> (Recording dd/MM HH:mm)" / nghệ sĩ gốc / album "Recording" / cover gốc (Video: thumbnail) —
 *      rồi đi tiếp như Huỷ.
 * Cấu hình bền (Settings > System > Ghi âm) — domain AppConfig 'recorder' (core/config.js), lưu meta.recorderConfig.
 *
 * Tính năng:
 *   - Recording mode: 'speaker' = CHỈ mic (nhạc từ loa + giọng); 'headphones' = nhạc gốc + mic, nhạc trễ theo Sync.
 *   - Count-in: đếm ngược N giây (media tạm dừng) rồi nhạc + MediaRecorder cùng bắt đầu. Lúc đếm phase vẫn là 'starting'
 *     (Block gate + khoá điều khiển như đang ghi); X / ẩn app / mic bị thu hồi -> huỷ phiên, trả media như cũ. 'pause' do
 *     chính lệnh dừng media lúc vào đếm bị handleInterruption() bỏ qua (chỉ xử lý phase 'recording').
 *   - Clip warning, Recording quality (bitrate), Latency calibration (Headphones: phát tick ra tai nghe đặt sát mic, đo
 *     độ lệch trong cùng graph -> điền Sync).
 *
 * Sự kiện của MediaRecorder ('dataavailable', 'stop') và ScriptProcessorNode (đo trễ) là nửa sau bất đồng bộ của chính
 * API ghi -> nhận qua core/dynamic-object-ui.js (ngoại lệ chính thức, event-bus-flow.md). 'ended' của track mic là sự
 * kiện nghiệp vụ -> core/recorder-ui.js::wireRecorderMicEnded() gửi eventBus.
 *
 * NẠP SAU: core/recorder.js, core/recorder-ui.js, core/config.js (appConfigRecorder), core/audio-engine.js (Audio
 * Session), core/player-controls.js (getActiveMediaElement/setPlayerControlsBlocked), core/media-element-ui.js,
 * core/dynamic-object-ui.js, core/playlist/state.js (formatTime), core/modal-choice-ui.js, core/upload-validation.js,
 * components/recorder-overlay.js, service/blob-url.js, service/db.js, service/task-manager.js. Gọi lúc chạy:
 * workflowPlaylist, workflowPlayerControls, workflowAppSettings.
 */

const RECORDER_TIMER_TASK = 'recorderTimer';
const RECORDER_TIMER_INTERVAL_MS = 100;
const RECORDER_PREVIEW_TASK = 'recorderPreviewPlayhead';
const RECORDER_STOP_TIMEOUT_TASK = 'recorderStopTimeout';
const RECORDER_STOP_TIMEOUT_MS = 3000; // MediaRecorder không bắn 'stop' (hiếm, iOS) -> vẫn lấy phần đã thu
const RECORDER_TIMESLICE_MS = 1000; // gom dữ liệu theo từng giây — dừng đột ngột vẫn còn gần đủ
const RECORDER_MIC_ANALYSER_FFT = 2048; // khung dài -> Clip warning ít sót đỉnh
const RECORDER_COUNT_IN_TASK = 'recorderCountIn';
const RECORDER_COUNT_IN_INTERVAL_MS = 1000;
const RECORDER_CALIB_TASK = 'recorderCalibration';
const RECORDER_WAVE_BUCKETS = 96;
const RECORDER_LOG_TAG = '[recorder]';
const RECORDER_PREVIEW_LOG_TAG = '[recorder] nghe lại'; // iOS chặn tự phát -> người dùng bấm nút phát

/** Chuẩn bị ghi xong -> mở phiên; mic bị từ chối (đã báo) -> huỷ khởi động; dựng graph/MediaRecorder lỗi -> dọn + báo. */
const RECORDER_START_BY_CAPTURE = {
    ready: (ctx, cfg) => workflowRecorder._openSession(ctx, cfg),
    noMic: () => workflowRecorder._abortStart(),
    failed: (ctx, cfg, err) => workflowRecorder._failStart(err),
};

/** Bản ghi có dữ liệu -> mở modal nghe lại; rỗng (mic lỗi/dừng quá sớm) -> báo rồi kết thúc như Huỷ. */
const RECORDER_REVIEW_BY_HAS_AUDIO = {
    true: (blob, fallbackSec) => workflowRecorder._openReview(blob, fallbackSec),
    false: () => workflowRecorder._handleEmptyTake(),
};

/** Lưu: vừa giới hạn dung lượng (như upload) -> ghi DB; quá cỡ -> báo, không lưu. Cả 2 rồi kết thúc phiên như Huỷ. */
const RECORDER_SAVE_BY_SIZE_VALID = {
    true: (song) => workflowRecorder._persistRecordedSong(song),
    false: (song, sizeCheck) => alertModal(tFormat('common.validate.generatedNotSaved', { reason: sizeCheck.reason })), // core/modal-choice-ui.js
};

/** Kết thúc phiên (Huỷ/Lưu xong): media đã hết THẬT trong phiên -> sang bài kế; chưa hết -> phát tiếp. */
const RECORDER_AFTER_SESSION_BY_MEDIA_ENDED = {
    true: () => workflowPlayerControls.handleMediaEnded(), // event/workflow/player-controls.js — Repeat/Shuffle như hết bài thường
    false: (activeEl) => playMediaElement(activeEl, RECORDER_LOG_TAG), // core/media-element-ui.js
};

/** Nút phát/dừng của modal nghe lại — theo trạng thái `paused` của element nghe thử. */
const RECORDER_PREVIEW_TOGGLE_BY_PAUSED = {
    true: (el) => playMediaElement(el, RECORDER_PREVIEW_LOG_TAG), // core/media-element-ui.js
    false: (el) => pauseMediaElement(el),
};

/** Chuẩn hoá giá trị Settings theo field (field lạ -> bỏ qua). */
const RECORDER_CONFIG_NORMALIZER_BY_FIELD = {
    mode: (value) => normalizeRecorderMode(value), // core/recorder.js
    latencyMs: (value) => clampRecorderLatencyMs(value),
    countInSec: (value) => normalizeRecorderCountIn(value),
    quality: (value) => normalizeRecorderQuality(value),
};

/** Đổi field xong cần làm thêm gì (field không có -> không gì): đổi chế độ thu làm hiện/ẩn Sync + nút đo -> vẽ lại màn. */
const RECORDER_AFTER_FIELD_CHANGE = {
    mode: () => workflowAppSettings._renderRecorder(), // event/workflow/app-settings.js — vẽ lại tại chỗ, giữ vị trí cuộn
};

/** Graph ghi theo chế độ thu (core/recorder.js). Chế độ lạ đã được chuẩn hoá từ lúc đọc config. */
const RECORDER_GRAPH_BY_MODE = {
    speaker: (audioContext, masterGainNode, stream) => buildRecorderMicOnlyGraph(audioContext, stream, RECORDER_MIC_ANALYSER_FFT),
    headphones: (audioContext, masterGainNode, stream, latencyMs) => buildRecorderMixGraph(audioContext, masterGainNode, stream, latencyMs, RECORDER_MIC_ANALYSER_FFT),
};

/** Media đang phát trước khi tạm dừng (Count-in bị huỷ / Latency calibration xong) -> phát tiếp; đang dừng -> giữ nguyên.
 * KHÁC RECORDER_AFTER_SESSION_BY_MEDIA_ENDED (nhánh true ở đó là sang bài kế). */
const RECORDER_RESUME_BY_WAS_PLAYING = {
    true: (activeEl) => playMediaElement(activeEl, RECORDER_LOG_TAG), // core/media-element-ui.js
    false: () => {},
};

/** Có Count-in (> 0 giây) -> đếm rồi mới ghi; không -> ghi ngay. */
const RECORDER_START_BY_COUNT_IN = {
    true: (sec, activeEl) => workflowRecorder._runCountIn(sec, activeEl),
    false: (sec, activeEl) => workflowRecorder._beginRecording(activeEl),
};

/** X (recorder.stop.click) theo phase: đang ghi -> dừng; đang khởi động (xin mic / Count-in) -> huỷ Count-in. */
const RECORDER_STOP_BY_PHASE = {
    recording: () => workflowRecorder._stopRecording(),
    starting: () => workflowRecorder._cancelCountIn(),
};

/** Kết quả Latency calibration -> áp vào Sync hoặc báo không đo được. */
const RECORDER_CALIB_RESULT_BY_OK = {
    true: (result) => workflowRecorder._applyCalibration(result),
    false: (result) => workflowRecorder._reportCalibrationFailed(result),
};

const workflowRecorder = {

    _stream: null,         // MediaStream mic của phiên đang ghi
    _graph: null,          // graph ghi (core/recorder.js) — kèm `levelBuf` đo mức mic
    _mediaRecorder: null,
    _chunks: [],
    _startedAtMs: 0,
    _clipUntilMs: 0,       // Clip warning — còn tô đỏ tới mốc này (performance.now())
    _countIn: null,        // { remaining, resumeAfterCancel } khi đang Count-in, null khi không
    _calibrating: false,   // đang chạy Latency calibration (chặn bấm đo lần 2)
    _previewEl: null,      // <audio> nghe lại (core/recorder-ui.js::createRecorderPreviewAudio())
    _previewUrl: null,
    _previewDurationSec: 0,
    _peaks: null,
    _reviewBodyEl: null,   // #modal-choice-body của modal nghe lại
    _waveCanvas: null,

    // ===================== Cấu hình (Settings > System > Ghi âm) =====================

    /** Khôi phục cấu hình đã lưu LÚC BOOT (event/workflow/app-boot.js). Chưa từng lưu -> giữ default đã seed. Field lạ
     * trong meta cũ không đọc — lần lưu kế tiếp tự rơi khỏi meta.recorderConfig. */
    async loadPersistedConfigOnBoot() {
        const saved = await getMeta('recorderConfig'); // service/db.js
        if (!saved || typeof saved !== 'object') return;
        appConfigRecorder.mutateAll((cfg) => {
            cfg.mode = normalizeRecorderMode(saved.mode ?? cfg.mode); // core/recorder.js
            cfg.latencyMs = clampRecorderLatencyMs(saved.latencyMs ?? cfg.latencyMs);
            cfg.countInSec = normalizeRecorderCountIn(saved.countInSec ?? cfg.countInSec);
            cfg.quality = normalizeRecorderQuality(saved.quality ?? cfg.quality);
        }); // core/config.js
        console.log('writer: "workflowRecorder.loadPersistedConfigOnBoot", page: "recorderConfig", content: "khôi phục từ meta.recorderConfig"');
    },

    /** Ứng 'appSettings.recorder.field.change' — đổi 1 field rồi lưu bền ngay (tần suất đổi rất thấp, không debounce).
     * Áp từ LẦN GHI KẾ TIẾP (phiên đang ghi giữ cấu hình lúc bắt đầu). @param {string} field @param {*} value */
    async changeConfigField(field, value) {
        const normalize = RECORDER_CONFIG_NORMALIZER_BY_FIELD[field];
        if (!normalize) return;
        const next = normalize(value);
        appConfigRecorder.mutateAll((cfg) => { cfg[field] = next; }); // core/config.js
        console.log(`writer: "workflowRecorder.changeConfigField", page: "recorderConfig", content: "${field}=${next}"`);
        await setMeta('recorderConfig', { ...appConfigRecorder.getAll() }); // service/db.js
        (RECORDER_AFTER_FIELD_CHANGE[field] || (() => {}))();
    },

    // ===================== Bắt đầu ghi =====================

    /** Ứng 'recorder.start.click' (Block gate đã chặn sẵn: đang ghi / Photo / Game — event/block.js). */
    async start() {
        const ctx = appState.get(['recordPhase', 'isVideoPlayerMode', 'currentKey', 'audioContext', 'masterGainNode', 'playlistCache']);
        if (ctx.recordPhase !== 'idle') return;
        if (!isMediaRecordingSupported(navigator, window.MediaRecorder)) { // core/recorder.js — file:// không có mic
            await alertModal(t('recorder.error.unsupported')); // core/modal-choice-ui.js
            return;
        }
        if (!ctx.currentKey || !ctx.audioContext || !ctx.masterGainNode) {
            await alertModal(t('recorder.error.noMedia'));
            return;
        }

        this._setPhase('starting');
        const cfg = appConfigRecorder.getAll(); // core/config.js
        applyPlayAndRecordAudioSession(); // core/audio-engine.js — TRƯỚC getUserMedia
        const stream = await this._requestMic();
        const capture = await this._prepareCapture(stream, ctx, cfg);
        await RECORDER_START_BY_CAPTURE[capture.status](ctx, cfg, capture.error);
    },

    /** Có mic -> dựng graph + MediaRecorder. @returns {Promise<{status: 'ready'|'noMic'|'failed', error: *}>} */
    async _prepareCapture(stream, ctx, cfg) {
        if (!stream) return { status: 'noMic', error: null };
        try {
            await this._beginCapture(stream, ctx.audioContext, ctx.masterGainNode, cfg);
            return { status: 'ready', error: null };
        } catch (err) {
            console.error('[recorder] Không bắt đầu ghi được:', err);
            return { status: 'failed', error: err };
        }
    },

    /** Dựng graph (theo chế độ thu) + MediaRecorder (MIME theo OS + bitrate theo Recording quality) — CHƯA bắt đầu thu
     * (_beginRecording(), ngay hoặc sau Count-in). Ném lỗi để _prepareCapture() báo. */
    async _beginCapture(stream, audioContext, masterGainNode, cfg) {
        this._stream = stream;
        await resumeRecorderAudioContext(audioContext); // core/recorder.js
        this._graph = RECORDER_GRAPH_BY_MODE[cfg.mode](audioContext, masterGainNode, stream, cfg.latencyMs);
        const options = buildRecorderOptions(resolveRecorderMimeType(window.MediaRecorder), cfg.quality); // core/recorder.js
        this._chunks = [];
        this._mediaRecorder = new MediaRecorder(this._graph.destination.stream, options);
        listenEventStream(this._mediaRecorder, 'dataavailable', (e) => this._collectChunk(e.data)); // core/dynamic-object-ui.js
        wireRecorderMicEnded(stream); // core/recorder-ui.js — mic bị thu hồi -> eventBus 'recorder.mic.ended'
        const session = navigator.audioSession ? `${navigator.audioSession.type}/${navigator.audioSession.state}` : 'không hỗ trợ';
        console.log(`[recorder] Sẵn sàng ghi — mode=${cfg.mode}, mimeType="${this._mediaRecorder.mimeType}", bitrate=${options.audioBitsPerSecond}, audioSession=${session}, sync=${cfg.latencyMs}ms, countIn=${cfg.countInSec}s, sampleRate=${audioContext.sampleRate}, baseLatency=${audioContext.baseLatency}, outputLatency=${audioContext.outputLatency}`);
    },

    /** Mở phiên: chốt recordMeta, hiện overlay, khoá thanh player, rồi Count-in hoặc ghi ngay. */
    _openSession(ctx, cfg) {
        const cached = ctx.playlistCache.get(ctx.currentKey) || {};
        appState.set('recordMeta', {
            mediaKind: ctx.isVideoPlayerMode ? 'video' : 'song',
            sourceKey: ctx.currentKey,
            sourceTag: cached.tag || null,     // Song: tag ID3 thật; Video: tag adapter (title = tên video, artist rỗng)
            sourceCover: cached.cover || null, // Song: cover ID3; Video: thumbnail
            mimeType: this._mediaRecorder.mimeType || '',
            mode: cfg.mode,
            latencyMs: cfg.latencyMs, // chỉ có tác dụng ở chế độ 'headphones'
            mediaEnded: false,
            durationSec: 0,
        });
        console.log(`writer: "workflowRecorder._openSession", page: "recordMeta", content: "${ctx.currentKey} (${ctx.isVideoPlayerMode ? 'video' : 'song'}, ${cfg.mode})"`);

        showRecorderLayer(recorderLayer); // core/recorder-ui.js
        setPlayerControlsBlocked(true); // core/player-controls.js — thanh player dưới đáy (ngoài stacking context overlay)
        setRecorderTimerText(recorderTimer, formatTime(0)); // core/recorder-ui.js, core/playlist/state.js
        setRecorderLevel(recorderLevel, 0);
        setRecorderClip(recorderIndicator, false);
        this._clipUntilMs = 0;
        const activeEl = getActiveMediaElement(ctx.isVideoPlayerMode); // core/player-controls.js
        RECORDER_START_BY_COUNT_IN[cfg.countInSec > 0](cfg.countInSec, activeEl);
    },

    /** Huỷ khởi động (mic bị từ chối): trả Audio Session + phase về idle. */
    _abortStart() {
        applyPlaybackAudioSession(); // core/audio-engine.js
        this._setPhase('idle');
    },

    /** Dựng graph/MediaRecorder lỗi: dọn tài nguyên đã lấy, huỷ khởi động, báo lỗi. */
    async _failStart(err) {
        this._releaseCaptureResources();
        this._abortStart();
        await alertModal(tFormat('recorder.error.startFailed', { message: escapeHtml(err && err.message ? err.message : String(err)) })); // core/modal-choice-ui.js
    },

    /** Bắt đầu ghi THẬT (ngay, hoặc sau Count-in): MediaRecorder chạy, phase 'recording', đồng hồ + mức mic, media phát.
     * @param {HTMLMediaElement} activeEl */
    _beginRecording(activeEl) {
        startRecorderCapture(this._mediaRecorder, RECORDER_TIMESLICE_MS); // core/recorder.js
        this._setPhase('recording');
        this._startedAtMs = performance.now();
        taskManager.kill(RECORDER_TIMER_TASK);
        taskManager.addNew(RECORDER_TIMER_TASK, { time: RECORDER_TIMER_INTERVAL_MS, exe: () => this._tick(), mode: 'timeout', count: 0 });
        taskManager.operator(RECORDER_TIMER_TASK, 'enabled');
        this._ensureMediaPlaying(activeEl);
    },

    // ===================== Count-in =====================

    /** Dừng media (đang phát thì nhớ để huỷ còn phát lại), hiện số đếm, mỗi giây trừ 1; hết thì ghi.
     * @param {number} seconds @param {HTMLMediaElement} activeEl */
    _runCountIn(seconds, activeEl) {
        this._countIn = { remaining: seconds, resumeAfterCancel: !activeEl.paused };
        pauseMediaElement(activeEl); // core/media-element-ui.js — 'pause' bắn ra lúc phase còn 'starting' -> handleInterruption() bỏ qua
        setRecorderCountIn(recorderLayer, recorderCountIn, seconds); // core/recorder-ui.js
        taskManager.kill(RECORDER_COUNT_IN_TASK);
        taskManager.addNew(RECORDER_COUNT_IN_TASK, { time: RECORDER_COUNT_IN_INTERVAL_MS, exe: () => this._tickCountIn(activeEl), mode: 'timeout', count: 0 });
        taskManager.operator(RECORDER_COUNT_IN_TASK, 'enabled');
    },

    /** @param {HTMLMediaElement} activeEl */
    _tickCountIn(activeEl) {
        if (!this._countIn) return;
        const step = computeRecorderCountInStep(this._countIn.remaining); // core/recorder.js
        this._countIn.remaining = step.remaining;
        setRecorderCountIn(recorderLayer, recorderCountIn, step.remaining); // core/recorder-ui.js (<= 0 tự ẩn)
        if (!step.isDone) return;
        taskManager.kill(RECORDER_COUNT_IN_TASK);
        this._countIn = null;
        this._beginRecording(activeEl);
    },

    /** Huỷ phiên đang Count-in (X / ẩn app / mic bị thu hồi): dọn mic + graph, gỡ overlay, mở khoá, media về như trước.
     * Bước tuỳ chọn — không đang đếm thì không làm gì. */
    _cancelCountIn() {
        const countIn = this._countIn;
        if (!countIn) return;
        taskManager.kill(RECORDER_COUNT_IN_TASK);
        this._countIn = null;
        setRecorderCountIn(recorderLayer, recorderCountIn, 0); // core/recorder-ui.js
        this._releaseCaptureResources();
        hideRecorderLayer(recorderLayer);
        setPlayerControlsBlocked(false); // core/player-controls.js
        appState.set('recordMeta', null);
        console.log('writer: "workflowRecorder._cancelCountIn", page: "recordMeta", content: "null (huỷ lúc Count-in)"');
        this._setPhase('idle');
        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode')); // core/player-controls.js
        RECORDER_RESUME_BY_WAS_PLAYING[countIn.resumeAfterCancel](activeEl);
    },

    /** Xin mic (thu thô). Bị từ chối/lỗi -> báo người dùng, trả null.
     * @returns {Promise<MediaStream|null>} */
    async _requestMic() {
        try {
            return await navigator.mediaDevices.getUserMedia(buildRecorderMicConstraints()); // core/recorder.js
        } catch (err) {
            console.warn('[recorder] getUserMedia lỗi:', err);
            await alertModal(tFormat('recorder.error.micDenied', { message: escapeHtml(err && err.name ? err.name : String(err)) }));
            return null;
        }
    },

    /** @param {Blob} data */
    _collectChunk(data) {
        if (!data || data.size === 0) return;
        this._chunks.push(data);
    },

    /** Tick đồng hồ + mức mic + Clip warning của overlay (mỗi 100ms). */
    _tick() {
        const now = performance.now();
        setRecorderTimerText(recorderTimer, formatTime(computeRecorderElapsedSec(this._startedAtMs, now))); // core/recorder-ui.js, core/recorder.js
        if (!this._graph) return;
        this._graph.micAnalyser.getFloatTimeDomainData(this._graph.levelBuf);
        const meter = computeRecorderMeterView(this._graph.levelBuf, now, this._clipUntilMs); // core/recorder.js
        this._clipUntilMs = meter.clipUntilMs;
        setRecorderLevel(recorderLevel, meter.level); // core/recorder-ui.js
        setRecorderClip(recorderIndicator, meter.isClipping);
    },

    /** Media đang dừng lúc bấm ghi -> tự phát ("ghi cùng audio đang phát"). @param {HTMLMediaElement} activeEl */
    _ensureMediaPlaying(activeEl) {
        if (!activeEl.paused) return;
        playMediaElement(activeEl, RECORDER_LOG_TAG); // core/media-element-ui.js
    },

    // ===================== Dừng ghi =====================

    /** Ứng 'recorder.stop.click' (X): đang ghi -> dừng; đang Count-in -> huỷ phiên. */
    stop() {
        (RECORDER_STOP_BY_PHASE[appState.get('recordPhase')] || (() => {}))();
    },

    /** Dừng ghi — đích chung của X và mọi đường dừng khác (handleInterruption()). */
    async _stopRecording() {
        const { recordPhase, isVideoPlayerMode } = appState.get(['recordPhase', 'isVideoPlayerMode']);
        if (recordPhase !== 'recording') return;
        this._setPhase('stopping'); // từ đây 'pause' do chính hàm này bắn sẽ bị handleInterruption() bỏ qua
        taskManager.kill(RECORDER_TIMER_TASK);
        const activeEl = getActiveMediaElement(isVideoPlayerMode); // core/player-controls.js
        this._markMediaEnded(activeEl.ended); // hết bài: 'pause' tới TRƯỚC 'ended' nhưng thuộc tính ended đã true
        pauseMediaElement(activeEl); // core/media-element-ui.js
        const elapsedSec = computeRecorderElapsedSec(this._startedAtMs, performance.now()); // core/recorder.js
        const blob = await this._finishMediaRecorder();
        this._releaseCaptureResources();
        hideRecorderLayer(recorderLayer); // core/recorder-ui.js — modal nghe lại thay chỗ; thanh player vẫn khoá tới hết phiên
        appState.set('recordBlob', blob);
        console.log(`writer: "workflowRecorder._stopRecording", page: "recordBlob", content: "${blob.size} byte, ${blob.type || 'không rõ MIME'}, ~${elapsedSec.toFixed(1)}s"`);
        this._setPhase('review');
        await RECORDER_REVIEW_BY_HAS_AUDIO[blob.size > 0](blob, elapsedSec);
    },

    /** Ngắt từ ngoài (pause tai nghe/màn hình khoá/cuộc gọi, mic bị thu hồi) — xử lý NHƯ X. Bước tuỳ chọn:
     * chỉ chạy khi đang ghi thật, nơi gọi gọi thẳng không điều kiện. */
    handleInterruption() {
        const { recordPhase, isSeeking } = appState.get(['recordPhase', 'isSeeking']);
        if (recordPhase !== 'recording') return;
        if (isSeeking) return; // 'pause' do kéo thanh seek / cử chỉ seek-hold tự dừng media, không phải ngắt từ ngoài
        this._stopRecording();
    },

    /** Ứng 'recorder.mic.ended' (mic bị hệ điều hành thu hồi) — như X: dừng ghi, hoặc huỷ nếu đang Count-in. */
    handleMicEnded() {
        this.handleInterruption();
        this._cancelCountIn();
    },

    /** Ứng 'appVisibility.document.change' khi app ẩn — dừng ghi như X (hoặc huỷ Count-in) + dừng nghe thử (không phát lặp
     * ngầm). Latency calibration đang chạy thì tự kết thúc theo hẹn giờ (dữ liệu ẩn app có thể hỏng -> báo đo lại). */
    handleAppHidden() {
        this.handleInterruption();
        this._cancelCountIn();
        this._pausePreview();
    },

    /** Ứng 'ended' khi recordPhase !== 'idle' (event/router/player-controls.js) — đánh dấu hết THẬT, KHÔNG tự chuyển bài. */
    onMediaEnded() {
        this._markMediaEnded(true);
        this.handleInterruption();
    },

    /** @param {boolean} isEnded */
    _markMediaEnded(isEnded) {
        if (!isEnded || !appState.get('recordMeta')) return;
        appState.mutate('recordMeta', (meta) => { meta.mediaEnded = true; });
        console.log('writer: "workflowRecorder._markMediaEnded", page: "recordMeta", content: "mediaEnded=true"');
    },

    /** Dừng MediaRecorder, đợi 'stop' (phần dữ liệu cuối) rồi gộp Blob. Không có 'stop' sau 3s / stop() lỗi -> lấy phần
     * đã thu. */
    _finishMediaRecorder() {
        const recorder = this._mediaRecorder;
        const buildBlob = () => new Blob(this._chunks, { type: recorder.mimeType || '' });
        if (recorder.state === 'inactive') return Promise.resolve(buildBlob());
        const stopWait = listenEventOnce(recorder, 'stop'); // core/dynamic-object-ui.js — nửa sau bất đồng bộ của API ghi
        return new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                timeout.kill();
                stopWait.cancel();
                resolve(buildBlob());
            };
            const timeout = taskManager.once(done, RECORDER_STOP_TIMEOUT_MS, RECORDER_STOP_TIMEOUT_TASK);
            stopWait.promise.then(done);
            if (!stopRecorderCapture(recorder)) done(); // core/recorder.js
        });
    },

    /** Dọn tài nguyên ghi (graph, mic, recorder) + trả Audio Session 'playback'. Gọi được nhiều lần. */
    _releaseCaptureResources() {
        const graph = this._graph;
        const stream = this._stream;
        this._graph = null;
        this._stream = null;
        this._mediaRecorder = null;
        this._clipUntilMs = 0;
        this._chunks = [];
        this._disposeGraph(graph);
        this._stopStream(stream);
        applyPlaybackAudioSession(); // core/audio-engine.js — giữ phát nền như cũ
    },

    _disposeGraph(graph) {
        if (!graph) return;
        disposeRecorderMixGraph(graph); // core/recorder.js
    },

    _stopStream(stream) {
        if (!stream) return;
        stopMediaStreamTracks(stream); // core/recorder.js
    },

    // ===================== Latency calibration (chế độ Headphones) =====================

    /** Ứng 'appSettings.recorder.calibrate.click' — kiểm tra điều kiện rồi mở modal hướng dẫn (đặt tai nghe sát mic). */
    async openCalibration() {
        if (this._calibrating) return;
        const { recordPhase, audioContext } = appState.get(['recordPhase', 'audioContext']);
        if (recordPhase !== 'idle') { await alertModal(t('recorderSettings.calibration.error.busy')); return; } // core/modal-choice-ui.js
        if (!isMediaRecordingSupported(navigator, window.MediaRecorder)) { await alertModal(t('recorder.error.unsupported')); return; } // core/recorder.js
        if (!audioContext) { await alertModal(t('recorderSettings.calibration.error.noAudio')); return; }
        modalChoice(t('recorderSettings.calibration.instructions'), [
            { label: t('recorderSettings.calibration.start'), themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => eventBus.send({ router: 'recorder', type: 'recorder.calibration.start.click', payload: {} }) },
        ], { title: t('recorderSettings.calibration.label') }); // core/modal-choice-ui.js
    },

    /** Ứng 'recorder.calibration.start.click': tạm dừng media -> mic (thu thô) -> phát + thu chuỗi tick -> phân tích ->
     * dọn -> media phát lại nếu đang phát -> áp kết quả. */
    async runCalibration() {
        const { recordPhase, audioContext, isVideoPlayerMode } = appState.get(['recordPhase', 'audioContext', 'isVideoPlayerMode']);
        if (this._calibrating || recordPhase !== 'idle' || !audioContext) return;
        this._calibrating = true;
        setRecorderCalibrationBusy(genericDrawerBody, true, t('recorderSettings.calibration.measuring')); // core/recorder-ui.js
        const activeEl = getActiveMediaElement(isVideoPlayerMode); // core/player-controls.js
        const resumeMedia = !activeEl.paused;
        pauseMediaElement(activeEl); // core/media-element-ui.js — nhạc lọt vào mic sẽ làm nhiễu phép đo

        applyPlayAndRecordAudioSession(); // core/audio-engine.js — TRƯỚC getUserMedia
        const stream = await this._requestMic();
        const result = stream ? await this._measureLatency(audioContext, stream) : null;
        this._stopStream(stream);
        applyPlaybackAudioSession(); // core/audio-engine.js
        RECORDER_RESUME_BY_WAS_PLAYING[resumeMedia](activeEl);
        this._calibrating = false;
        setRecorderCalibrationBusy(genericDrawerBody, false, t('recorderSettings.calibration.button'));
        if (!result) return; // mic bị từ chối — _requestMic() đã báo
        await RECORDER_CALIB_RESULT_BY_OK[result.ok](result);
    },

    /** Dựng graph đo, thu 2 kênh (gốc + mic) tới hết chuỗi tick, gỡ graph, phân tích.
     * @param {AudioContext} audioContext @param {MediaStream} stream
     * @returns {Promise<{ok: boolean, latencyMs: number, matches: number, spreadMs: number}>} */
    async _measureLatency(audioContext, stream) {
        await resumeRecorderAudioContext(audioContext); // core/recorder.js
        const graph = buildLatencyCalibrationGraph(audioContext, stream);
        const refParts = [], micParts = [];
        // Nửa thu dữ liệu của chính phép đo — chỉ chép mẫu, không quyết định gì.
        listenAudioProcess(graph.processor, (e) => { // core/dynamic-object-ui.js
            refParts.push(new Float32Array(e.inputBuffer.getChannelData(0)));
            micParts.push(new Float32Array(e.inputBuffer.getChannelData(1)));
        });
        const waitMs = computeRecorderCalibrationWaitMs(graph.endAt, audioContext.currentTime); // core/recorder.js
        await new Promise((resolve) => taskManager.once(resolve, waitMs, RECORDER_CALIB_TASK));
        disposeLatencyCalibrationGraph(graph); // core/recorder.js
        const result = detectCalibrationLatencyMs(concatRecorderSamples(refParts), concatRecorderSamples(micParts), audioContext.sampleRate);
        console.log(`[recorder] Latency calibration — ok=${result.ok}, trễ=${result.latencyMs.toFixed(1)}ms, khớp ${result.matches}/${RECORDER_CALIB_CLICK_COUNT} tick, lệch ${result.spreadMs.toFixed(1)}ms`);
        return result;
    },

    /** Đo được -> làm tròn theo slider, lưu vào Sync, cập nhật slider đang hiện, báo kết quả. */
    async _applyCalibration(result) {
        const ms = clampRecorderLatencyMs(result.latencyMs); // core/recorder.js
        await this.changeConfigField('latencyMs', ms);
        setRecorderLatencyControl(genericDrawerBody, ms); // core/recorder-ui.js
        await alertModal(tFormat('recorderSettings.calibration.done', { ms })); // core/modal-choice-ui.js
    },

    async _reportCalibrationFailed() {
        await alertModal(t('recorderSettings.calibration.error.failed')); // core/modal-choice-ui.js
    },

    // ===================== Modal nghe lại =====================

    /** Giải mã bản ghi (vẽ waveform + thời lượng thật), mở modal, tự phát lặp. iOS có thể chặn tự phát (lệnh phát tới
     * sau await, xa cú chạm X) -> người dùng bấm nút phát. */
    async _openReview(blob, fallbackSec) {
        const decoded = await this._decodeTake(blob, appState.get('audioContext'));
        const durationSec = decoded ? decoded.duration : fallbackSec;
        appState.mutate('recordMeta', (meta) => { meta.durationSec = durationSec; });
        console.log(`writer: "workflowRecorder._openReview", page: "recordMeta", content: "durationSec=${durationSec.toFixed(2)}"`);
        this._peaks = computeWaveformPeaks(decoded, RECORDER_WAVE_BUCKETS); // core/recorder.js
        this._previewDurationSec = durationSec;

        modalChoice('', [
            { label: t('recorder.review.save'), themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => eventBus.send({ router: 'recorder', type: 'recorder.review.save.click', payload: {} }) },
        ], {
            title: t('recorder.review.title'),
            bodyHtml: renderRecorderReviewBody(), // components/recorder-overlay.js
            onCancel: () => eventBus.send({ router: 'recorder', type: 'recorder.review.cancel.click', payload: {} }),
        }); // core/modal-choice-ui.js — [Huỷ][Lưu], không đóng khi bấm ra ngoài
        this._reviewBodyEl = document.getElementById('modal-choice-body');
        this._waveCanvas = this._reviewBodyEl.querySelector('#recorder-review-wave');
        wireRecorderReviewBody(this._reviewBodyEl); // core/recorder-ui.js

        this._previewUrl = createBlobUrl(blob); // service/blob-url.js
        this._previewEl = createRecorderPreviewAudio(); // core/recorder-ui.js
        setMediaElementSource(this._previewEl, this._previewUrl); // core/media-element-ui.js
        taskManager.kill(RECORDER_PREVIEW_TASK);
        taskManager.addNew(RECORDER_PREVIEW_TASK, { time: 0, exe: () => this._renderPreviewFrame(), mode: 'raf', count: 0 });
        taskManager.operator(RECORDER_PREVIEW_TASK, 'enabled');
        playMediaElement(this._previewEl, RECORDER_PREVIEW_LOG_TAG); // core/media-element-ui.js
    },

    /** @returns {Promise<AudioBuffer|null>} null = không giải mã được (vẫn nghe/lưu được, waveform phẳng). */
    async _decodeTake(blob, audioContext) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (err) {
            console.warn('[recorder] Không giải mã được bản ghi để vẽ waveform (vẫn nghe/lưu được):', err);
            return null;
        }
    },

    /** Mỗi frame lúc modal mở: vẽ waveform theo vị trí phát + đồng bộ nút/nhãn giờ. */
    _renderPreviewFrame() {
        const el = this._previewEl;
        if (!el || !this._reviewBodyEl || !this._waveCanvas) return;
        const durationSec = this._previewDurationSec;
        const progress = computeRecorderPreviewProgress(el.currentTime, durationSec); // core/recorder.js
        drawRecorderWaveform(this._waveCanvas, this._peaks, progress, window.devicePixelRatio || 1); // core/recorder-ui.js
        setRecorderPreviewState(this._reviewBodyEl, !el.paused, formatTime(el.currentTime), formatTime(durationSec));
    },

    /** Ứng 'recorder.preview.toggle.click'. */
    togglePreview() {
        const el = this._previewEl;
        if (!el) return;
        RECORDER_PREVIEW_TOGGLE_BY_PAUSED[el.paused](el);
    },

    /** Ứng 'recorder.preview.seek' — chạm waveform để tua. @param {number} ratio 0..1 */
    seekPreview(ratio) {
        const el = this._previewEl;
        if (!el || !(this._previewDurationSec > 0)) return;
        seekMediaElement(el, computeRecorderPreviewSeekSec(ratio, this._previewDurationSec)); // core/media-element-ui.js, core/recorder.js
    },

    _pausePreview() {
        if (!this._previewEl) return;
        pauseMediaElement(this._previewEl); // core/media-element-ui.js
    },

    /** Dừng + bỏ element nghe thử, dừng vòng vẽ, revoke URL. Gọi được nhiều lần. */
    _teardownPreview() {
        taskManager.kill(RECORDER_PREVIEW_TASK);
        const el = this._previewEl;
        const url = this._previewUrl;
        this._previewEl = null;
        this._previewUrl = null;
        this._reviewBodyEl = null;
        this._waveCanvas = null;
        this._peaks = null;
        this._previewDurationSec = 0;
        this._releasePreviewElement(el);
        this._revokePreviewUrl(url);
    },

    _releasePreviewElement(el) {
        if (!el) return;
        releaseMediaElement(el); // core/dynamic-object-ui.js — pause + gỡ src + load(), giải phóng decoder ngay
    },

    _revokePreviewUrl(url) {
        if (!url) return;
        revokeBlobUrl(url); // service/blob-url.js
    },

    /** Bản ghi rỗng (mic lỗi / dừng quá sớm) — báo rồi kết thúc như Huỷ. */
    async _handleEmptyTake() {
        await alertModal(t('recorder.error.empty')); // core/modal-choice-ui.js
        this._endSession();
    },

    // ===================== Huỷ / Lưu =====================

    /** Ứng 'recorder.review.cancel.click' — bỏ bản ghi trong RAM. */
    cancel() {
        if (appState.get('recordPhase') !== 'review') return;
        this._endSession();
    },

    /** Ứng 'recorder.review.save.click' — lưu thành Song mới rồi kết thúc phiên như Huỷ. Media app tự tạo chịu cùng giới
     * hạn dung lượng như upload (core/upload-validation.js). */
    async save() {
        const { recordPhase, recordBlob, recordMeta } = appState.get(['recordPhase', 'recordBlob', 'recordMeta']);
        if (recordPhase !== 'review' || !recordBlob || !recordMeta) return;
        this._teardownPreview();
        this._setPhase('saving');
        const song = this._buildRecordedSong(recordBlob, recordMeta, new Date());
        const sizeCheck = validateMediaFileSize(song.blob); // core/upload-validation.js
        await RECORDER_SAVE_BY_SIZE_VALID[sizeCheck.valid](song, sizeCheck);
        this._endSession();
    },

    /** Ghi bản ghi thành Song mới. Lỗi ghi DB -> báo, bản ghi mất. */
    async _persistRecordedSong(song) {
        try {
            const key = await workflowPlaylist.addRecordedSong(song); // event/workflow/playlist.js
            console.log(`[recorder] Đã lưu bản ghi thành Song "${key}" — ${song.filename}`);
        } catch (err) {
            console.error('[recorder] Lưu bản ghi lỗi:', err);
            await alertModal(tFormat('recorder.error.saveFailed', { message: escapeHtml(err && err.message ? err.message : String(err)) })); // core/modal-choice-ui.js
        }
    },

    /**
     * Dựng dữ liệu Song từ bản ghi — tag tự tạo: "<tên gốc> (Recording dd/MM HH:mm)", nghệ sĩ gốc (Video
     * không có -> "Unknown artist"), album "Recording", cover gốc. Blob gán lại MIME gốc (bỏ ";codecs=...") để lưu sạch.
     * @param {Blob} blob @param {object} meta - recordMeta @param {Date} now
     */
    _buildRecordedSong(blob, meta, now) {
        const baseMime = normalizeRecorderMimeType(meta.mimeType || blob.type); // core/recorder.js
        const sourceTag = meta.sourceTag || {};
        const sourceTitle = sourceTag.title || t('recorder.tag.untitled');
        return {
            filename: buildRecordingFilename(sourceTitle, formatRecordingFileStamp(now), resolveRecorderFileExtension(baseMime)), // core/recorder.js
            blob: new Blob([blob], { type: baseMime }),
            tag: {
                title: tFormat('recorder.tag.title', { title: sourceTitle, time: formatRecordingDateLabel(now) }), // core/recorder.js
                artist: sourceTag.artist || t('common.song.unknownArtist'),
                album: t('recorder.tag.album'),
            },
            cover: meta.sourceCover || null,
            duration: meta.durationSec || 0,
        };
    },

    /** Kết thúc phiên (Huỷ/Lưu/bản ghi rỗng): xoá RAM state, mở khoá điều khiển, rồi phát tiếp hoặc sang bài kế. */
    _endSession() {
        this._teardownPreview();
        const { recordMeta, isVideoPlayerMode } = appState.get(['recordMeta', 'isVideoPlayerMode']);
        const mediaEnded = !!(recordMeta && recordMeta.mediaEnded);
        appState.set('recordBlob', null);
        console.log('writer: "workflowRecorder._endSession", page: "recordBlob", content: "null (huỷ bản ghi khỏi RAM)"');
        appState.set('recordMeta', null);
        console.log('writer: "workflowRecorder._endSession", page: "recordMeta", content: "null"');
        this._setPhase('idle'); // mở Block gate TRƯỚC khi sang bài kế
        setPlayerControlsBlocked(false); // core/player-controls.js
        RECORDER_AFTER_SESSION_BY_MEDIA_ENDED[mediaEnded](getActiveMediaElement(isVideoPlayerMode));
    },

    /** @param {'idle'|'starting'|'recording'|'stopping'|'review'|'saving'} phase */
    _setPhase(phase) {
        appState.set('recordPhase', phase);
        console.log(`writer: "workflowRecorder._setPhase", page: "recordPhase", content: "${phase}"`);
    },
};
