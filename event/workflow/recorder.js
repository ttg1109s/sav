/**
 * event/workflow/recorder.js — Workflow chế độ GHI ÂM ở Player Song/Video (MỚI 01/10/2026, Giang yêu cầu + chốt).
 *
 * LUỒNG:
 *   1. Icon Ghi âm (Control Center) -> start(): xin mic (Audio Session 'play-and-record'), dựng graph ghi (core/recorder.js
 *      — mic + nhạc lấy sau masterGainNode, trộn NGAY lúc ghi, Giang chốt phương án A), MediaRecorder chạy, overlay
 *      #recorder-layer che toàn màn Visualizer + chặn thanh player (giống Game). Media đang dừng thì tự phát.
 *   2. Dừng ghi = X / media hết THẬT / bị ngắt từ ngoài (pause từ tai nghe-màn hình khoá-cuộc gọi, ẩn app, mic bị thu
 *      hồi) — Giang chốt ngắt ngoài xử lý NHƯ X: pause media -> dừng MediaRecorder -> trả Audio Session 'playback' ->
 *      bản ghi (Blob) vào RAM state (`recordBlob`) -> modal nghe lại (mini waveform, tự phát lặp, chạm waveform để tua).
 *      Hết bài KHÔNG tự chuyển bài (event/router/player-controls.js chuyển 'ended' về đây khi recordPhase !== 'idle').
 *   3. Huỷ: bỏ bản ghi trong RAM -> media đang phát dở thì phát tiếp, đã hết thật thì sang bài kế (handleMediaEnded() —
 *      tôn trọng Repeat/Shuffle như hết bài thường).
 *      Lưu: ghi thành 1 Song MỚI (workflowPlaylist.addRecordedSong()) — định dạng theo OS (iOS m4a, Chrome webm), tag tự
 *      tạo "<tên gốc> (Recording dd/MM HH:mm)" / nghệ sĩ gốc / album "Recording" / cover gốc (Video: thumbnail) — rồi
 *      đi tiếp y hệt Huỷ.
 * Cấu hình bền (Settings > Visualizer Screen > Player > Ghi âm): khử tiếng vọng + bù trễ giọng — domain AppConfig
 * 'recorder' (core/config.js), lưu meta.recorderConfig (`loadPersistedConfigOnBoot()`/`changeConfigField()`).
 *
 * NGOẠI LỆ CÓ CHỦ ĐÍCH (cùng loại pitch worker của workflowAudioEngine, event-bus-flow.md mục 1): `ondataavailable`/
 * 'stop' của MediaRecorder là NỬA SAU bất đồng bộ của chính API ghi -> gắn + xử lý ngay tại đây, không qua Listener/
 * Router (thuần thu dữ liệu / đợi xong, không quyết định nghiệp vụ). Riêng 'ended' của track mic (mic bị hệ điều hành
 * thu hồi) LÀ 1 sự kiện nghiệp vụ -> callback CHỈ eventBus.send() về router 'recorder' (đúng tinh thần Rule 5a).
 *
 * NẠP SAU: core/recorder.js, core/recorder-ui.js, core/config.js (appConfigRecorder), core/audio-engine.js
 * (applyPlayAndRecordAudioSession/applyPlaybackAudioSession), core/player-controls.js (getActiveMediaElement/
 * setPlayerControlsBlocked), core/playlist/state.js (formatTime), core/modal-choice-ui.js (modalChoice/alertModal/
 * escapeHtml), components/recorder-overlay.js (renderRecorderReviewBody), service/blob-url.js, service/db.js
 * (getMeta/setMeta), service/task-manager.js. Gọi lúc chạy: workflowPlaylist (event/workflow/playlist.js),
 * workflowPlayerControls (event/workflow/player-controls.js).
 */

const RECORDER_TIMER_TASK = 'recorderTimer';
const RECORDER_TIMER_INTERVAL_MS = 100;
const RECORDER_PREVIEW_TASK = 'recorderPreviewPlayhead';
const RECORDER_STOP_TIMEOUT_TASK = 'recorderStopTimeout';
const RECORDER_STOP_TIMEOUT_MS = 3000; // MediaRecorder không bắn 'stop' (hiếm, iOS) -> vẫn lấy phần đã thu
const RECORDER_TIMESLICE_MS = 1000; // gom dữ liệu theo từng giây — dừng đột ngột vẫn còn gần đủ
const RECORDER_MIC_ANALYSER_FFT = 512;
const RECORDER_WAVE_BUCKETS = 96;

/** Bản ghi có dữ liệu -> mở modal nghe lại; rỗng (mic lỗi/dừng quá sớm) -> báo rồi kết thúc như Huỷ. */
const RECORDER_REVIEW_BY_HAS_AUDIO = {
    true: (blob, fallbackSec) => workflowRecorder._openReview(blob, fallbackSec),
    false: () => workflowRecorder._handleEmptyTake(),
};

/** Kết thúc phiên (Huỷ/Lưu xong): media đã hết THẬT trong phiên -> sang bài kế; chưa hết -> phát tiếp. */
const RECORDER_AFTER_SESSION_BY_MEDIA_ENDED = {
    true: () => workflowPlayerControls.handleMediaEnded(), // event/workflow/player-controls.js — Repeat/Shuffle như hết bài thường
    false: (activeEl) => workflowRecorder._resumeMedia(activeEl),
};

/** Nút phát/dừng của modal nghe lại — theo trạng thái `paused` của element nghe thử. */
const RECORDER_PREVIEW_TOGGLE_BY_PAUSED = {
    true: (el) => workflowRecorder._playPreview(el),
    false: (el) => el.pause(),
};

/** Chuẩn hoá giá trị Settings theo field (field lạ -> bỏ qua). */
const RECORDER_CONFIG_NORMALIZER_BY_FIELD = {
    echoCancellation: (value) => value === true,
    latencyMs: (value) => clampRecorderLatencyMs(value), // core/recorder.js
};

const workflowRecorder = {

    _stream: null,         // MediaStream mic của phiên đang ghi
    _graph: null,          // graph ghi (core/recorder.js::buildRecorderMixGraph())
    _mediaRecorder: null,
    _chunks: [],
    _startedAtMs: 0,
    _levelBuf: null,       // Float32Array đo mức mic (tái dùng mỗi tick)
    _previewEl: null,      // <audio> nghe lại — NGOÀI audio graph chính (không làm visualizer nhảy theo)
    _previewUrl: null,
    _previewDurationSec: 0,
    _peaks: null,
    _reviewBodyEl: null,   // #modal-choice-body của modal nghe lại
    _waveCanvas: null,

    // ===================== Cấu hình (Settings > Player > Ghi âm) =====================

    /** Khôi phục cấu hình đã lưu LÚC BOOT (event/workflow/app-boot.js). Chưa từng lưu -> giữ default đã seed. */
    async loadPersistedConfigOnBoot() {
        const saved = await getMeta('recorderConfig'); // service/db.js
        if (!saved || typeof saved !== 'object') return;
        appConfigRecorder.mutateAll((cfg) => {
            cfg.echoCancellation = saved.echoCancellation !== false;
            cfg.latencyMs = clampRecorderLatencyMs(saved.latencyMs ?? cfg.latencyMs); // core/recorder.js
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
    },

    // ===================== Bắt đầu ghi =====================

    /** Ứng 'recorder.start.click' (Block gate đã chặn sẵn: đang ghi / Photo / Game — event/block.js). */
    async start() {
        const { recordPhase, isVideoPlayerMode, currentKey, audioContext, masterGainNode, playlistCache } = appState.get([
            'recordPhase', 'isVideoPlayerMode', 'currentKey', 'audioContext', 'masterGainNode', 'playlistCache',
        ]);
        if (recordPhase !== 'idle') return;
        if (!isMediaRecordingSupported(navigator, window.MediaRecorder)) { // core/recorder.js — file:// không có mic
            await alertModal(t('recorder.error.unsupported')); // core/modal-choice-ui.js
            return;
        }
        if (!currentKey || !audioContext || !masterGainNode) {
            await alertModal(t('recorder.error.noMedia'));
            return;
        }

        this._setPhase('starting');
        const cfg = appConfigRecorder.getAll(); // core/config.js
        applyPlayAndRecordAudioSession(); // core/audio-engine.js — TRƯỚC getUserMedia
        const stream = await this._requestMic(cfg.echoCancellation);
        if (!stream) { this._abortStart(); return; }

        try {
            await this._beginCapture(stream, audioContext, masterGainNode, cfg.latencyMs);
        } catch (err) {
            console.error('[recorder] Không bắt đầu ghi được:', err);
            this._releaseCaptureResources();
            this._abortStart();
            await alertModal(tFormat('recorder.error.startFailed', { message: escapeHtml(err && err.message ? err.message : String(err)) }));
            return;
        }

        const cached = playlistCache.get(currentKey) || {};
        appState.set('recordMeta', {
            mediaKind: isVideoPlayerMode ? 'video' : 'song',
            sourceKey: currentKey,
            sourceTag: cached.tag || null,     // Song: tag ID3 thật; Video: tag adapter (title = tên video, artist rỗng)
            sourceCover: cached.cover || null, // Song: cover ID3; Video: thumbnail
            mimeType: this._mediaRecorder.mimeType || '',
            latencyMs: cfg.latencyMs,
            mediaEnded: false,
            durationSec: 0,
        });
        console.log(`writer: "workflowRecorder.start", page: "recordMeta", content: "${currentKey} (${isVideoPlayerMode ? 'video' : 'song'})"`);
        this._setPhase('recording');

        showRecorderLayer(recorderLayer); // core/recorder-ui.js
        setPlayerControlsBlocked(true); // core/player-controls.js — thanh player dưới đáy (ngoài stacking context overlay)
        setRecorderTimerText(recorderTimer, formatTime(0)); // core/recorder-ui.js, core/playlist/state.js
        setRecorderLevel(recorderLevel, 0);
        this._startedAtMs = performance.now();
        taskManager.kill(RECORDER_TIMER_TASK);
        taskManager.addNew(RECORDER_TIMER_TASK, { time: RECORDER_TIMER_INTERVAL_MS, exe: () => this._tick(), mode: 'interval', count: 0 });
        taskManager.operator(RECORDER_TIMER_TASK, 'enabled');

        this._ensureMediaPlaying(getActiveMediaElement(isVideoPlayerMode, false)); // core/player-controls.js
    },

    /** Xin mic. Bị từ chối/lỗi -> báo người dùng, trả null. @param {boolean} echoCancellation @returns {Promise<MediaStream|null>} */
    async _requestMic(echoCancellation) {
        try {
            return await navigator.mediaDevices.getUserMedia(buildRecorderMicConstraints(echoCancellation)); // core/recorder.js
        } catch (err) {
            console.warn('[recorder] getUserMedia lỗi:', err);
            await alertModal(tFormat('recorder.error.micDenied', { message: escapeHtml(err && err.name ? err.name : String(err)) }));
            return null;
        }
    },

    /** Dựng graph + MediaRecorder + bắt đầu thu. Ném lỗi để start() dọn và báo. */
    async _beginCapture(stream, audioContext, masterGainNode, latencyMs) {
        this._stream = stream;
        if (audioContext.state !== 'running') await audioContext.resume();
        this._graph = buildRecorderMixGraph(audioContext, masterGainNode, stream, latencyMs / 1000, RECORDER_MIC_ANALYSER_FFT); // core/recorder.js
        this._levelBuf = new Float32Array(this._graph.micAnalyser.fftSize);
        const mimeType = RECORDER_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ''; // core/recorder.js — định dạng theo OS
        const options = mimeType ? { mimeType } : undefined;
        this._chunks = [];
        this._mediaRecorder = new MediaRecorder(this._graph.destination.stream, options);
        this._mediaRecorder.ondataavailable = (e) => this._collectChunk(e.data); // nửa sau bất đồng bộ của API ghi (xem đầu file)
        stream.getAudioTracks().forEach((track) => {
            track.addEventListener('ended', () => eventBus.send({ router: 'recorder', type: 'recorder.mic.ended', payload: {} }), { once: true });
        });
        this._mediaRecorder.start(RECORDER_TIMESLICE_MS);
        const session = navigator.audioSession ? `${navigator.audioSession.type}/${navigator.audioSession.state}` : 'không hỗ trợ';
        console.log(`[recorder] Bắt đầu ghi — mimeType="${this._mediaRecorder.mimeType}", audioSession=${session}, bù trễ=${latencyMs}ms, sampleRate=${audioContext.sampleRate}, baseLatency=${audioContext.baseLatency}, outputLatency=${audioContext.outputLatency}`);
    },

    /** Huỷ khởi động (mic bị từ chối/lỗi dựng graph): trả Audio Session + phase về idle. */
    _abortStart() {
        applyPlaybackAudioSession(); // core/audio-engine.js
        this._setPhase('idle');
    },

    /** @param {Blob} data */
    _collectChunk(data) {
        if (!data || data.size === 0) return;
        this._chunks.push(data);
    },

    /** Tick đồng hồ + mức mic của overlay (interval 100ms). */
    _tick() {
        setRecorderTimerText(recorderTimer, formatTime((performance.now() - this._startedAtMs) / 1000)); // core/recorder-ui.js
        if (!this._graph) return;
        this._graph.micAnalyser.getFloatTimeDomainData(this._levelBuf);
        setRecorderLevel(recorderLevel, computeRecorderMicLevel(this._levelBuf)); // core/recorder.js -> core/recorder-ui.js
    },

    /** Media đang dừng lúc bấm ghi -> tự phát ("ghi cùng audio đang phát"). @param {HTMLMediaElement} activeEl */
    _ensureMediaPlaying(activeEl) {
        if (!activeEl.paused) return;
        activeEl.play().catch((err) => console.warn('[recorder] Không tự phát được media khi bắt đầu ghi:', err));
    },

    // ===================== Dừng ghi =====================

    /** Ứng 'recorder.stop.click' (X) — và là đích chung của mọi đường dừng khác (handleInterruption()). */
    async stop() {
        if (appState.get('recordPhase') !== 'recording') return;
        this._setPhase('stopping'); // từ đây 'pause' do chính hàm này bắn sẽ bị handleInterruption() bỏ qua
        taskManager.kill(RECORDER_TIMER_TASK);
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        const activeEl = getActiveMediaElement(isVideoPlayerMode, false); // core/player-controls.js
        this._markMediaEnded(activeEl.ended); // hết bài: 'pause' tới TRƯỚC 'ended' nhưng thuộc tính ended đã true
        activeEl.pause();
        const elapsedSec = (performance.now() - this._startedAtMs) / 1000;
        const blob = await this._finishMediaRecorder();
        this._releaseCaptureResources();
        hideRecorderLayer(recorderLayer); // core/recorder-ui.js — modal nghe lại thay chỗ; thanh player vẫn khoá tới hết phiên
        appState.set('recordBlob', blob);
        console.log(`writer: "workflowRecorder.stop", page: "recordBlob", content: "${blob.size} byte, ${blob.type || 'không rõ MIME'}, ~${elapsedSec.toFixed(1)}s"`);
        this._setPhase('review');
        await RECORDER_REVIEW_BY_HAS_AUDIO[blob.size > 0](blob, elapsedSec);
    },

    /** Ngắt từ ngoài (pause tai nghe/màn hình khoá/cuộc gọi, mic bị thu hồi) — Giang chốt xử lý NHƯ X. Bước tuỳ chọn:
     * chỉ chạy khi đang ghi thật, nơi gọi gọi thẳng không điều kiện (event-bus-flow.md mục 7). */
    handleInterruption() {
        if (appState.get('recordPhase') !== 'recording') return;
        this.stop();
    },

    /** Ứng 'appVisibility.document.change' khi app ẩn — dừng ghi như X + dừng nghe thử (không phát lặp ngầm). */
    handleAppHidden() {
        this.handleInterruption();
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

    /** Dừng MediaRecorder, đợi 'stop' (phần dữ liệu cuối) rồi gộp Blob. Không có 'stop' sau 3s -> lấy phần đã thu. */
    _finishMediaRecorder() {
        const recorder = this._mediaRecorder;
        const buildBlob = () => new Blob(this._chunks, { type: recorder.mimeType || '' });
        if (recorder.state === 'inactive') return Promise.resolve(buildBlob());
        return new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                timeout.kill();
                resolve(buildBlob());
            };
            const timeout = taskManager.once(done, RECORDER_STOP_TIMEOUT_MS, RECORDER_STOP_TIMEOUT_TASK);
            recorder.addEventListener('stop', done, { once: true }); // nửa sau bất đồng bộ của API ghi (xem đầu file)
            try { recorder.stop(); } catch (err) { console.warn('[recorder] MediaRecorder.stop() lỗi:', err); done(); }
        });
    },

    /** Dọn tài nguyên ghi (graph, mic, recorder) + trả Audio Session 'playback'. Gọi được nhiều lần. */
    _releaseCaptureResources() {
        const graph = this._graph;
        const stream = this._stream;
        this._graph = null;
        this._stream = null;
        this._mediaRecorder = null;
        this._levelBuf = null;
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

    // ===================== Modal nghe lại =====================

    /** Giải mã bản ghi (vẽ waveform + thời lượng thật), mở modal, tự phát lặp. */
    async _openReview(blob, fallbackSec) {
        const decoded = await this._decodeTake(blob, appState.get('audioContext'));
        const channels = decoded ? Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)) : [];
        const durationSec = decoded ? decoded.duration : fallbackSec;
        appState.mutate('recordMeta', (meta) => { meta.durationSec = durationSec; });
        console.log(`writer: "workflowRecorder._openReview", page: "recordMeta", content: "durationSec=${durationSec.toFixed(2)}"`);
        this._peaks = computeWaveformPeaks(channels, RECORDER_WAVE_BUCKETS); // core/recorder.js
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
        this._previewEl = new Audio();
        this._previewEl.loop = true; // "phát, lặp bản ghi"
        this._previewEl.preload = 'auto';
        this._previewEl.src = this._previewUrl;
        taskManager.kill(RECORDER_PREVIEW_TASK);
        taskManager.addNew(RECORDER_PREVIEW_TASK, { time: 0, exe: () => this._renderPreviewFrame(), mode: 'raf', count: 0 });
        taskManager.operator(RECORDER_PREVIEW_TASK, 'enabled');
        this._playPreview(this._previewEl);
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
        const progress = durationSec > 0 ? el.currentTime / durationSec : 0;
        drawRecorderWaveform(this._waveCanvas, this._peaks, progress, window.devicePixelRatio || 1); // core/recorder-ui.js
        setRecorderPreviewState(this._reviewBodyEl, !el.paused, `${formatTime(el.currentTime)} / ${formatTime(durationSec)}`);
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
        el.currentTime = Math.max(0, Math.min(1, ratio)) * this._previewDurationSec;
    },

    /** iOS có thể chặn tự phát (lệnh phát tới sau await, xa cú chạm X) -> người dùng bấm nút phát. */
    _playPreview(el) {
        el.play().catch((err) => console.warn('[recorder] Chưa tự phát được bản ghi (bấm nút phát):', err));
    },

    _pausePreview() {
        if (!this._previewEl) return;
        this._previewEl.pause();
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
        this._stopPreviewElement(el);
        this._revokePreviewUrl(url);
    },

    _stopPreviewElement(el) {
        if (!el) return;
        el.pause();
        el.removeAttribute('src');
        el.load();
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

    /** Ứng 'recorder.review.save.click' — lưu thành Song mới rồi kết thúc phiên như Huỷ. Lỗi ghi DB -> báo, bản ghi mất. */
    async save() {
        const { recordPhase, recordBlob, recordMeta } = appState.get(['recordPhase', 'recordBlob', 'recordMeta']);
        if (recordPhase !== 'review' || !recordBlob || !recordMeta) return;
        this._teardownPreview();
        this._setPhase('saving');
        const song = this._buildRecordedSong(recordBlob, recordMeta, new Date());
        try {
            const key = await workflowPlaylist.addRecordedSong(song); // event/workflow/playlist.js
            console.log(`[recorder] Đã lưu bản ghi thành Song "${key}" — ${song.filename}`);
        } catch (err) {
            console.error('[recorder] Lưu bản ghi lỗi:', err);
            await alertModal(tFormat('recorder.error.saveFailed', { message: escapeHtml(err && err.message ? err.message : String(err)) }));
        }
        this._endSession();
    },

    /**
     * Dựng dữ liệu Song từ bản ghi — tag tự tạo (Giang chốt): "<tên gốc> (Recording dd/MM HH:mm)", nghệ sĩ gốc (Video
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
        RECORDER_AFTER_SESSION_BY_MEDIA_ENDED[mediaEnded](getActiveMediaElement(isVideoPlayerMode, false));
    },

    /** @param {HTMLMediaElement} activeEl */
    _resumeMedia(activeEl) {
        activeEl.play().catch((err) => console.warn('[recorder] Không phát tiếp được media sau phiên ghi:', err));
    },

    /** @param {'idle'|'starting'|'recording'|'stopping'|'review'|'saving'} phase */
    _setPhase(phase) {
        appState.set('recordPhase', phase);
        console.log(`writer: "workflowRecorder._setPhase", page: "recordPhase", content: "${phase}"`);
    },
};
