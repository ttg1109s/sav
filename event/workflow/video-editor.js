/**
 * event/workflow/video-editor.js — Workflow DUY NHẤT của `video-editor.html` v3 (23/07/2026). KHÔNG
 * dùng `appState` (cùng lý do `image-edit.html`) — state cục bộ sống trong object này.
 *
 * [v3] ĐỔI KIẾN TRÚC LỚN theo yêu cầu Giang — xem đầu `video-editor.html` để tóm tắt. Chi tiết mô
 * hình dữ liệu:
 *   - `_videoClips`: mảng `{sourceStart, sourceEnd}` (giây NGUỒN, tức giây trong file video gốc),
 *     THEO THỨ TỰ, nối tiếp nhau trên timeline OUTPUT (vị trí OUTPUT của mỗi đoạn = TỰ TÍNH từ tổng
 *     độ dài các đoạn TRƯỚC nó — xem `computeVideoClipsLayout()`, core/video-editor/timeline-calc.js
 *     — KHÔNG lưu vị trí riêng, không thể đặt tự do, không hở/không đè). Trim = đổi sourceStart/End
 *     của 1 đoạn (đoạn khác tự dịch theo, do vị trí luôn tính lại). Tách = chia 1 đoạn thành 2 (mảng
 *     +1 phần tử). Xoá: KHÔNG cho phép. Đổi thứ tự: hoán đổi vị trí trong mảng.
 *   - `_audioClips`/`_textClips`: mảng clip TỰ DO, mỗi clip có `timelineStart`/`timelineEnd` riêng
 *     (giây OUTPUT, KHÔNG neo theo Video) — trim/di chuyển/tách/nhân bản/xoá đều được. Được phép
 *     kéo vượt quá tổng thời lượng Video trên giao diện — CHỈ bị cắt bỏ lúc xuất thật
 *     (`core/video-editor/webcodecs-engine.js::processVideo()`).
 *   - `_selected`: `{track, index}|null` — clip đang chọn, quyết định nội dung `#video-editor-toolbar`
 *     (dựng động, xem `_renderToolbar()`).
 *
 * PREVIEW: canvas, vòng lặp `taskManager` mode `raf`. Vì Video giờ nhiều đoạn KHÔNG LIÊN TỤC trong
 * file nguồn, lúc phát phải TỰ nhảy `currentTime` sang đoạn kế tiếp khi hết đoạn hiện tại (xem `_tick()`).
 *
 * GIỚI HẠN ĐÃ BIẾT (thành thật với Giang): preview trực tiếp chỉ phát ĐÚNG 1 bài hát tại 1 thời điểm
 * (đổi `<audio>` src theo clip nào đang active tại thời điểm phát) — nếu 2 clip Nhạc chồng nhau trên
 * timeline, preview chỉ nghe được 1 trong 2; lúc XUẤT THẬT (Lưu) vẫn trộn ĐẦY ĐỦ mọi clip chồng nhau
 * (qua OfflineAudioContext, xem webcodecs-engine.js) — chỉ preview bị giới hạn.
 */
/** Danh sách phông chọn cho Text overlay — KHỚP với thẻ <link> Google Fonts nạp ở đầu video-editor.html. */
const VIDEO_EDITOR_FONTS = [
    { label: 'Mặc định', value: 'system-ui' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Playfair Display', value: 'Playfair Display' },
    { label: 'Pacifico', value: 'Pacifico' },
    { label: 'Bebas Neue', value: 'Bebas Neue' },
    { label: 'Lobster', value: 'Lobster' },
    { label: 'Oswald', value: 'Oswald' },
    { label: 'Dancing Script', value: 'Dancing Script' },
];

const workflowVideoEditor = {
    MIN_CLIP_GAP_SEC: 0.3, // độ dài tối thiểu 1 đoạn/khoảng cách tối thiểu tới mép khi trim/cắt — DÙNG CHUNG, tránh lặp `const MIN_GAP = 0.3` rải rác nhiều hàm.

    _videoKey: null,
    _record: null,
    _fullSourceDuration: 0,
    _nativeW: 0,
    _nativeH: 0,
    _pixelsPerSecond: 40,

    _videoClips: [],
    _audioClips: [],
    _textClips: [],
    _currentClipIndex: null, // đoạn Video đang phát/xem (index trong _videoClips)
    _idCounter: 1,

    _rotateDeg: 0,
    _cropFraction: null,
    _cropper: null,
    _volumeVideo: 100, // % — toàn cục
    _brightness: 100, _contrast: 100, _saturation: 100, // % — toàn cục (MỚI: trước đọc thẳng DOM slider của modal cũ làm state, nay modal là Generic Drawer — nội dung mất đi mỗi lần đóng, PHẢI có field riêng làm nguồn sự thật)

    _selected: null, // {track:'video'|'audio'|'text', index}|null
    _isPlaying: false,
    _dragHandle: null, // {track,index,handleType:'start'|'end'|'move'}|null
    _dragLastClientX: 0,
    _draggingSongShift: false,
    _songShiftPxPerSec: 0,
    _pinchState: null, // {startDist,startAngleDeg,baseSize,baseRotation}|null — MỚI, kéo-giãn/xoay Text 2 ngón trên preview

    _songListCache: null,
    _songSearchQuery: '',
    _masterFilmstripFrames: null,

    _hasUnsavedChanges: false,

    /** Chạy 1 LẦN lúc trang load xong (xem event/listener/video-editor.js). */
    async init() {
        const encoded = new URLSearchParams(window.location.search).get('video');
        const videoKey = encoded ? decodeSongKeyFromUrl(encoded) : null;
        if (!videoKey) { this._showFatalError(t('videoEdit.invalidLink')); return; }

        const record = await getVideoRecord(videoKey);
        if (!record) { this._showFatalError(t('videoEdit.videoNotFound')); return; }

        await window._mediabunnyLoadPromise;
        const compat = await checkVideoEditorCompat(record.blob);
        if (!compat.supported) { this._showFatalError(t(`videoEdit.compat.${compat.reason}`)); return; }

        this._videoKey = videoKey;
        this._record = record;
        videoEditorTitleEl.textContent = record.filename || videoKey;

        videoEditorSourceEl.src = URL.createObjectURL(record.blob);
        videoEditorSourceEl.load(); // ép tải ngay — fix bug "phải Play mới hiện" (xem docstring video-editor.html)
        videoEditorSourceEl.addEventListener('loadedmetadata', () => {
            this._onMetadataReady().catch((err) => {
                console.error('[init] Lỗi không lường trước lúc dựng UI sau loadedmetadata:', err);
                this._showFatalError(t('videoEdit.compat.unreadableFile'));
            });
        }, { once: true });

        taskManager.addNew('videoEditorPreviewRender', { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator('videoEditorPreviewRender', 'enabled');
        taskManager.pause('videoEditorPreviewRender');
    },

    _showFatalError(message) {
        videoEditorTitleEl.textContent = t('videoEdit.errorTitle') || '';
        videoEditorFatalErrorEl.textContent = message;
        videoEditorFatalErrorEl.classList.remove('hidden');
        videoEditorEmptyStateEl.classList.add('hidden');
    },

    async _onMetadataReady() {
        this._nativeW = videoEditorSourceEl.videoWidth || 16;
        this._nativeH = videoEditorSourceEl.videoHeight || 9;
        this._fullSourceDuration = videoEditorSourceEl.duration || 0;
        this._videoClips = [{ sourceStart: 0, sourceEnd: this._fullSourceDuration }];
        this._currentClipIndex = 0;
        videoEditorPreviewCanvasEl.width = this._nativeW;
        videoEditorPreviewCanvasEl.height = this._nativeH;
        videoEditorEmptyStateEl.classList.add('hidden');
        videoEditorPlayheadEl.classList.remove('hidden');

        // Dựng UI CỐT LÕI TRƯỚC (toolbar/timeline/thời gian) — KHÔNG chờ filmstrip. Bug đã gặp: lỗi
        // ném ra trong lúc trích filmstrip (Mediabunny, xem catch dưới) làm cả hàm dừng NGANG, khiến
        // toolbar/timeline/tổng thời lượng KHÔNG BAO GIỜ được dựng (mất trắng) — nay tách filmstrip
        // ra thành bước PHỤ, chạy SAU, tự bọc try/catch riêng, không được phép chặn phần cốt lõi.
        this._renderAllTracks();
        this._renderToolbar();
        this._updateTimeDisplay(0);

        // Vẽ khung đầu tiên — BỀN HƠN bản cũ (chỉ đợi 1 mình 'seeked', không đủ chắc ở mọi trình
        // duyệt/thiết bị): nghe CẢ 3 sự kiện (loadeddata/canplay/seeked, cái nào tới trước vẽ trước,
        // vẽ thêm lần nữa cũng vô hại), VÀ vẽ NGAY nếu dữ liệu khung hình đã sẵn có (readyState >= 2
        // — HAVE_CURRENT_DATA) — tránh trường hợp các event đó đã bắn ra TRƯỚC khi ta kịp đăng ký.
        const drawFirstFrame = () => this._drawFrame();
        videoEditorSourceEl.addEventListener('loadeddata', drawFirstFrame, { once: true });
        videoEditorSourceEl.addEventListener('canplay', drawFirstFrame, { once: true });
        videoEditorSourceEl.addEventListener('seeked', drawFirstFrame, { once: true });
        videoEditorSourceEl.currentTime = 0.0001;
        videoEditorSourceEl.currentTime = 0;
        if (videoEditorSourceEl.readyState >= 2) this._drawFrame();

        try {
            this._masterFilmstripFrames = await buildCutFilmstripFrames(this._record.blob, 30, 60, 64); // core/video-editor/filmstrip.js — TRÍCH 1 LẦN duy nhất, dùng lại cho MỌI đoạn sau khi tách
            this._renderVideoTrack(); // vẽ lại RIÊNG track Video để hiện ảnh minh hoạ vừa trích xong
        } catch (err) {
            console.error('[_onMetadataReady] Lỗi trích filmstrip — bỏ qua ảnh minh hoạ, KHÔNG chặn phần còn lại của app:', err);
            this._masterFilmstripFrames = [];
        }
    },

    _totalDuration() { return computeVideoTotalDuration(this._videoClips); }, // core/video-editor/timeline-calc.js
    _nextId() { return `c${this._idCounter++}`; },

    _totalRenderWidthSeconds() {
        return computeTimelineRenderWidthSeconds(this._videoClips, this._audioClips, this._textClips); // core/video-editor/timeline-calc.js
    },

    // ===================== Vòng lặp render (taskManager mode raf) =====================

    _tick() {
        if (!this._isPlaying) return;
        if (this._currentClipIndex == null || !this._videoClips[this._currentClipIndex]) { this._pause(); return; }
        const clip = this._videoClips[this._currentClipIndex];
        if (videoEditorSourceEl.currentTime >= clip.sourceEnd - 0.03 || videoEditorSourceEl.ended) {
            if (this._currentClipIndex + 1 < this._videoClips.length) {
                this._currentClipIndex++;
                videoEditorSourceEl.currentTime = this._videoClips[this._currentClipIndex].sourceStart;
                videoEditorSourceEl.play().catch(() => {});
            } else {
                this._pause();
                this._seekToOutputTime(this._totalDuration());
                return;
            }
        }
        const outputTime = this._computeCurrentOutputTime();
        this._syncAudioClips(outputTime);
        this._updateTimeDisplay(outputTime);
        this._drawFrame();
    },

    _computeCurrentOutputTime() {
        if (this._currentClipIndex == null || !this._videoClips[this._currentClipIndex]) return 0;
        const clip = this._videoClips[this._currentClipIndex];
        const outputStart = computeOutputStartForClipIndex(this._videoClips, this._currentClipIndex); // core/video-editor/timeline-calc.js
        return outputStart + Math.max(0, videoEditorSourceEl.currentTime - clip.sourceStart);
    },

    _currentFilterCss() {
        return buildFilterCss(this._brightness, this._contrast, this._saturation); // core/video-editor/preview-draw.js
    },

    _drawFrame() {
        const ctx = videoEditorPreviewCanvasEl.getContext('2d');
        const cropPx = computeCropPixels(this._cropFraction, this._nativeW, this._nativeH); // core/video-editor/preview-draw.js
        const { outW, outH, deg } = computeRotatedOutputSize(cropPx, this._rotateDeg);
        if (videoEditorPreviewCanvasEl.width !== outW) videoEditorPreviewCanvasEl.width = outW;
        if (videoEditorPreviewCanvasEl.height !== outH) videoEditorPreviewCanvasEl.height = outH;
        drawVideoPreviewFrame(ctx, videoEditorSourceEl, cropPx, deg, this._currentFilterCss(), outW, outH);
        const outputTime = this._computeCurrentOutputTime();
        this._textClips.forEach((tc) => {
            if (outputTime >= tc.timelineStart && outputTime < tc.timelineEnd) drawTextOverlay(ctx, outW, outH, tc, outputTime);
        });
    },

    /** LƯU Ý (xem docstring đầu file): preview chỉ phát ĐÚNG 1 bài hát tại 1 thời điểm.
     * SỬA (Giang báo "nhạc bị biến dạng và méo") — bản trước nhảy thẳng `currentTime` mỗi khi lệch
     * > 0.2s, có thể xảy ra RẤT thường xuyên (mỗi frame ở ~60fps) do sai số tích luỹ nhỏ — nhảy
     * currentTime liên tục gây giật/rè tiếng ở nhiều trình duyệt. Nay: lệch NHỎ (0.08-0.35s) chỉ
     * chỉnh nhẹ `playbackRate` (êm tai hơn nhiều, tự từ từ bắt kịp) — CHỈ lệch LỚN (>0.35s, vd vừa
     * tua) mới nhảy thẳng `currentTime`. Cũng kẹp `targetTime` trong biên hợp lệ [0, songDuration]
     * — gán currentTime ra ngoài biên có thể khiến 1 số trình duyệt phát lỗi/im/rè. */
    _syncAudioClips(outputTime) {
        const active = this._audioClips.find((c) => outputTime >= c.timelineStart && outputTime < c.timelineEnd);
        if (!active) { videoEditorSongAudioEl.pause(); videoEditorSongAudioEl.playbackRate = 1; this._activePreviewAudioClipId = null; return; }
        if (this._activePreviewAudioClipId !== active.id) {
            this._activePreviewAudioClipId = active.id;
            videoEditorSongAudioEl.src = URL.createObjectURL(active.record.blob);
            videoEditorSongAudioEl.volume = Math.min(1, active.volume);
            videoEditorSongAudioEl.playbackRate = 1;
        }
        const songDuration = active.record.duration || 0;
        const targetTime = Math.max(0, Math.min(active.offsetInSong + (outputTime - active.timelineStart), Math.max(0, songDuration - 0.02)));
        const drift = videoEditorSongAudioEl.currentTime - targetTime;
        if (Math.abs(drift) > 0.35) {
            videoEditorSongAudioEl.currentTime = targetTime;
            videoEditorSongAudioEl.playbackRate = 1;
        } else if (Math.abs(drift) > 0.08) {
            videoEditorSongAudioEl.playbackRate = drift > 0 ? 0.96 : 1.04;
        } else {
            videoEditorSongAudioEl.playbackRate = 1;
        }
        if (this._isPlaying && videoEditorSongAudioEl.paused) videoEditorSongAudioEl.play().catch(() => {});
    },

    _updateTimeDisplay(outputTime) {
        videoEditorCurrentTimeEl.textContent = formatClipTimeLabel(outputTime); // core/video-editor/timeline-calc.js
        videoEditorTotalTimeEl.textContent = formatClipTimeLabel(this._totalDuration());
        videoEditorPlayheadEl.style.left = `${computePlayheadLeftPx(outputTime, this._pixelsPerSecond)}px`;
        videoEditorPlayheadTimeEl.textContent = formatClipTimeLabel(outputTime);
    },

    _seekToOutputTime(outputSeconds) {
        const total = this._totalDuration();
        const clamped = Math.max(0, Math.min(outputSeconds, total));
        const lastClip = this._videoClips[this._videoClips.length - 1];
        const found = findVideoClipAtOutputTime(this._videoClips, clamped) // core/video-editor/timeline-calc.js
            || (lastClip ? { index: this._videoClips.length - 1, sourceSplitPoint: lastClip.sourceEnd } : null); // clamped === total (mép cuối cùng) — findVideoClipAtOutputTime dùng "<" nghiêm ngặt nên không khớp, tự rơi về cuối đoạn cuối
        if (!found) return;
        this._currentClipIndex = found.index;
        videoEditorSourceEl.currentTime = found.sourceSplitPoint;
        this._syncAudioClips(clamped);
        this._updateTimeDisplay(clamped);
        this._drawFrame();
    },

    // ===================== Transport =====================

    handleTogglePlay() { if (this._isPlaying) this._pause(); else this._play(); },

    _play() {
        if (!this._videoClips.length) return;
        const total = this._totalDuration();
        const cur = this._computeCurrentOutputTime();
        if (cur >= total - 0.05 || this._currentClipIndex == null) this._seekToOutputTime(0);
        this._isPlaying = true;
        videoEditorPlayIconEl.textContent = '❚❚';
        videoEditorSourceEl.play().catch(() => {});
        this._syncAudioClips(this._computeCurrentOutputTime());
        taskManager.resume('videoEditorPreviewRender');
    },

    _pause() {
        this._isPlaying = false;
        videoEditorPlayIconEl.textContent = '▶';
        videoEditorSourceEl.pause();
        videoEditorSongAudioEl.pause();
        taskManager.pause('videoEditorPreviewRender');
        this._drawFrame();
    },

    handleSkipStart() { this._seekToOutputTime(0); },
    handleSkipEnd() { this._seekToOutputTime(this._totalDuration()); },

    /** Chạm/kéo trên NỀN timeline (ngoài mọi clip) — tua con trỏ chính xác tới đúng điểm chạm.
     * MỚI — trước đây chỉ có Play/Pause/Skip để dời con trỏ, gần như không thể dừng đúng 1 điểm ở
     * giữa 1 đoạn để "Cắt tại current" (Giang báo Cắt luôn không có tác dụng — do con trỏ hầu như
     * luôn dính sát mép 0, bị `MIN_GAP` trong `handleCutAtCurrent()` từ chối âm thầm). */
    handleScrub(clientX) {
        if (this._isPlaying) this._pause();
        const rect = videoEditorTimelineContentEl.getBoundingClientRect();
        const sec = pxToSeconds(clientX - rect.left, this._pixelsPerSecond);
        this._seekToOutputTime(sec);
    },

    /** MỚI — Giang yêu cầu: nhấn vào chữ trên preview phải kéo di chuyển được (2 chiều — trước chỉ
     * chỉnh được `posY`). Chạm gần dòng chữ nào (đang hiển thị tại thời điểm hiện tại) thì chọn +
     * kéo dòng đó, đổi `posX`/`posY` theo % kích thước canvas. */
    handlePreviewTextDragStart(canvasX, canvasY) {
        const outputTime = this._computeCurrentOutputTime();
        const canvasW = videoEditorPreviewCanvasEl.width || 1;
        const canvasH = videoEditorPreviewCanvasEl.height || 1;
        const touchXPercent = (canvasX / canvasW) * 100;
        const touchYPercent = (canvasY / canvasH) * 100;
        const index = findNearestActiveTextClip(this._textClips, outputTime, touchXPercent, touchYPercent, 20); // core/video-editor/timeline-calc.js
        if (index == null) { this._previewTextDragIndex = null; return; }
        this._previewTextDragIndex = index;
        this._selected = { track: 'text', index };
        this._renderAllTracks();
        this._renderToolbar();
    },

    handlePreviewTextDragMove(canvasX, canvasY) {
        if (this._previewTextDragIndex == null) return;
        const clip = this._textClips[this._previewTextDragIndex];
        if (!clip) return;
        const canvasW = videoEditorPreviewCanvasEl.width || 1;
        const canvasH = videoEditorPreviewCanvasEl.height || 1;
        clip.posX = Math.max(2, Math.min(98, Math.round((canvasX / canvasW) * 100)));
        clip.posY = Math.max(2, Math.min(98, Math.round((canvasY / canvasH) * 100)));
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    handlePreviewTextDragEnd() {
        if (this._previewTextDragIndex != null) this._renderAllTracks();
        this._previewTextDragIndex = null;
    },

    /** MỚI — Giang yêu cầu: co giãn kích cỡ + xoay Text trên preview. Cử chỉ 2 ngón (pinch):
     * khoảng cách 2 ngón đổi = co giãn `size`, góc 2 ngón đổi = xoay `rotation`. Toán tính ở Core
     * (`computePinchTransform()`, core/video-editor/preview-draw.js) — Workflow chỉ giữ giá trị
     * GỐC lúc bắt đầu cử chỉ (`_pinchState`) rồi áp kết quả mới vào clip đang chọn. */
    handlePreviewTextPinchStart() {
        if (!this._selected || this._selected.track !== 'text') { this._pinchState = null; return; }
        const clip = this._textClips[this._selected.index];
        if (!clip) { this._pinchState = null; return; }
        this._pinchState = { baseSize: clip.size, baseRotation: clip.rotation || 0 };
    },

    handlePreviewTextPinchMove(startDist, startAngleDeg, currentDist, currentAngleDeg) {
        if (!this._pinchState || !this._selected || this._selected.track !== 'text') return;
        const clip = this._textClips[this._selected.index];
        if (!clip) return;
        const result = computePinchTransform(startDist, startAngleDeg, currentDist, currentAngleDeg, this._pinchState.baseSize, this._pinchState.baseRotation); // core/video-editor/preview-draw.js
        clip.size = result.newSize;
        clip.rotation = result.newRotation;
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    handlePreviewTextPinchEnd() {
        this._pinchState = null;
        this._renderAllTracks();
    },

    // ===================== Chọn clip (viền + toolbar theo ngữ cảnh) =====================

    _isSelected(track, index) { return !!this._selected && this._selected.track === track && this._selected.index === index; },

    handleSelectClip(track, index) {
        this._selected = { track, index };
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleDeselect() {
        this._selected = null;
        this._renderAllTracks();
        this._renderToolbar();
    },

    // ===================== Layout — dựng/định vị clip trên timeline =====================

    _renderAllTracks() {
        this._updateTimelineWidthAndMarker(this._totalDuration());
        this._renderVideoTrack();
        this._renderAudioTrack();
        this._renderTextTrack();
    },

    _updateTimelineWidthAndMarker(totalDuration) {
        const renderWidthSec = this._totalRenderWidthSeconds();
        videoEditorTimelineContentEl.style.width = `${Math.max(renderWidthSec, 1) * this._pixelsPerSecond}px`;
        if (renderWidthSec > totalDuration + 0.05) {
            videoEditorDurationEndMarkerEl.classList.remove('hidden');
            videoEditorDurationEndMarkerEl.style.left = `${totalDuration * this._pixelsPerSecond}px`;
        } else {
            videoEditorDurationEndMarkerEl.classList.add('hidden');
        }
    },

    /**
     * Gắn kéo-thả cho 1 tay cầm/thân clip — DÙNG CHUNG cho cả 3 track (video/audio/text). SỬA BUG
     * (Giang báo "kéo không di chuyển được" cả 3 track): bản trước dùng `el.hasPointerCapture()`
     * làm ĐIỀU KIỆN cho phép `pointermove` chạy tiếp — nếu `setPointerCapture()` fail ÂM THẦM (có
     * thể xảy ra tuỳ trình duyệt/thiết bị, không throw ra ngoài để bắt), MỌI `pointermove` sau đó bị
     * chặn ngay từ điều kiện đó, kéo hoàn toàn không có tác dụng dù `pointerdown` vẫn chạy bình
     * thường. Nay dùng CỜ RIÊNG (`el._veDragging`) do CHÍNH TA đặt/xoá — không phụ thuộc capture có
     * thành công hay không; `setPointerCapture()`/`releasePointerCapture()` vẫn gọi (tốt hơn nếu
     * thành công, mượt tay hơn khi ngón tay lệch ra ngoài phạm vi tay cầm) nhưng bọc try/catch, lỗi
     * ở đó KHÔNG được phép chặn `eventBus.send()` phía sau.
     * @param {HTMLElement} el @param {string} track @param {number} index @param {string} handleType
     * @param {boolean} enableTapSelect - true CHỈ cho phần "thân" (body) clip Nhạc/Chữ — chạm nhẹ
     *   (không kéo đáng kể) thì tính là "chọn clip" (Video tự có listener 'click' riêng ở nơi gọi).
     */
    _attachDragHandlers(el, track, index, handleType, enableTapSelect) {
        el.addEventListener('pointerdown', (e) => {
            el._veDragging = true;
            el._veDragStartX = e.clientX;
            el._veDragMoved = false;
            try { el.setPointerCapture(e.pointerId); } catch (err) { console.warn('[timelineDrag] setPointerCapture lỗi (bỏ qua, vẫn kéo bình thường qua cờ _veDragging):', err); }
            eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.start', payload: { track, index, handleType, clientX: e.clientX } });
        });
        el.addEventListener('pointermove', (e) => {
            if (!el._veDragging) return;
            if (Math.abs(e.clientX - el._veDragStartX) > 4) el._veDragMoved = true;
            eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.move', payload: { clientX: e.clientX } });
        });
        el.addEventListener('pointerup', (e) => {
            if (!el._veDragging) return;
            el._veDragging = false;
            try { el.releasePointerCapture(e.pointerId); } catch (err) { /* không sao — pointerup vẫn xử lý bình thường */ }
            eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} });
            if (enableTapSelect && !el._veDragMoved) eventBus.send({ router: 'videoEdit', type: 'videoEdit.selectClip.click', payload: { track, index } });
        });
        el.addEventListener('pointercancel', () => {
            el._veDragging = false;
            eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} });
        });
    },

    _renderVideoTrack() {
        videoEditorTrackVideoEl.innerHTML = '';
        const layout = computeVideoClipsLayout(this._videoClips, this._pixelsPerSecond);
        this._videoClips.forEach((clip, index) => {
            const l = layout[index];
            const el = document.createElement('div');
            el.className = `absolute h-full top-0 bg-slate-800 rounded-lg overflow-hidden border-2 ${this._isSelected('video', index) ? 'border-white' : 'border-transparent'}`;
            el.style.left = `${l.leftPx}px`;
            el.style.width = `${Math.max(l.widthPx, 8)}px`;

            const handleStart = document.createElement('div');
            handleStart.className = 'video-editor-clip-handle absolute left-0 top-0 bottom-0 w-4 bg-white z-10 rounded-l-md';
            const filmstrip = document.createElement('div');
            filmstrip.className = 'absolute inset-0 flex pointer-events-none';
            (this._masterFilmstripFrames || []).filter((f) => f.blob && f.timestamp >= clip.sourceStart && f.timestamp <= clip.sourceEnd).forEach((f) => {
                const img = document.createElement('img');
                img.className = 'h-full flex-1 object-cover opacity-70';
                img.src = URL.createObjectURL(f.blob);
                filmstrip.appendChild(img);
            });
            const handleEnd = document.createElement('div');
            handleEnd.className = 'video-editor-clip-handle absolute right-0 top-0 bottom-0 w-4 bg-white z-10 rounded-r-md';
            el.append(handleStart, filmstrip, handleEnd);

            el.addEventListener('click', (e) => {
                if (e.target === handleStart || e.target === handleEnd) return;
                eventBus.send({ router: 'videoEdit', type: 'videoEdit.selectClip.click', payload: { track: 'video', index } });
            });
            [{ el: handleStart, type: 'start' }, { el: handleEnd, type: 'end' }].forEach(({ el: h, type }) => this._attachDragHandlers(h, 'video', index, type, false));
            videoEditorTrackVideoEl.appendChild(el);
        });
    },

    /** Chỉ CẬP NHẬT VỊ TRÍ (không dựng lại DOM/filmstrip) — dùng lúc đang kéo tay cầm Video, mượt hơn (Rule 5a: đây là Workflow, không phải Core, không bị ràng buộc). */
    _layoutVideoTrackLive() {
        const layout = computeVideoClipsLayout(this._videoClips, this._pixelsPerSecond);
        const els = videoEditorTrackVideoEl.children;
        for (let i = 0; i < els.length && i < layout.length; i++) {
            els[i].style.left = `${layout[i].leftPx}px`;
            els[i].style.width = `${Math.max(layout[i].widthPx, 8)}px`;
        }
        this._updateTimelineWidthAndMarker(layout.length ? layout[layout.length - 1].outputEnd : 0);
    },

    _renderFreeClipTrack(containerEl, clips, track, colorClass, labelFn) {
        containerEl.innerHTML = '';
        clips.forEach((clip, index) => {
            const { leftPx, widthPx } = computeClipLayoutPx(clip.timelineStart, clip.timelineEnd - clip.timelineStart, this._pixelsPerSecond);
            const el = document.createElement('div');
            el.className = `absolute h-full top-0 ${colorClass} rounded-lg overflow-hidden border-2 ${this._isSelected(track, index) ? 'border-white' : 'border-transparent'}`;
            el.style.left = `${leftPx}px`;
            el.style.width = `${Math.max(widthPx, 8)}px`;

            const handleStart = document.createElement('div');
            handleStart.className = 'video-editor-clip-handle absolute left-0 top-0 bottom-0 w-3 bg-white/30 z-10';
            const body = document.createElement('div');
            body.className = 'video-editor-clip-body absolute inset-0 flex items-center px-3';
            const label = document.createElement('span');
            label.className = 'text-[9px] font-bold text-white truncate pointer-events-none';
            label.textContent = labelFn(clip);
            body.appendChild(label);
            const handleEnd = document.createElement('div');
            handleEnd.className = 'video-editor-clip-handle absolute right-0 top-0 bottom-0 w-3 bg-white/30 z-10';
            el.append(handleStart, body, handleEnd);

            [{ el: handleStart, type: 'start' }, { el: handleEnd, type: 'end' }].forEach(({ el: h, type }) => this._attachDragHandlers(h, track, index, type, false));
            this._attachDragHandlers(body, track, index, 'move', true); // true — chạm nhẹ (không kéo) = chọn clip

            containerEl.appendChild(el);
        });
    },

    _renderAudioTrack() { this._renderFreeClipTrack(videoEditorTrackAudioEl, this._audioClips, 'audio', 'bg-emerald-500/80', (c) => c.record.tag.title || c.songKey); },
    _renderTextTrack() { this._renderFreeClipTrack(videoEditorTrackTextEl, this._textClips, 'text', 'bg-purple-500/80', (c) => c.val); },

    _layoutSingleFreeClip(track, index) {
        const list = track === 'audio' ? this._audioClips : this._textClips;
        const clip = list[index];
        const containerEl = track === 'audio' ? videoEditorTrackAudioEl : videoEditorTrackTextEl;
        const el = containerEl.children[index];
        if (!clip || !el) return;
        const { leftPx, widthPx } = computeClipLayoutPx(clip.timelineStart, clip.timelineEnd - clip.timelineStart, this._pixelsPerSecond);
        el.style.left = `${leftPx}px`;
        el.style.width = `${Math.max(widthPx, 8)}px`;
        this._updateTimelineWidthAndMarker(this._totalDuration());
    },

    // ===================== Kéo-thả timeline (trim/move — chung cho cả 3 track) =====================

    handleTimelineDragStart(track, index, handleType, clientX) {
        this._dragHandle = { track, index, handleType };
        this._dragLastClientX = clientX;
    },

    /** Delta-based (so với lần move TRƯỚC, không phải toạ độ tuyệt đối) — bền vững kể cả khi
     * `#video-editor-timeline-container` đang cuộn dở (không cần đo `getBoundingClientRect()`). */
    handleTimelineDragMove(clientX) {
        if (!this._dragHandle) return;
        const { track, index, handleType } = this._dragHandle;
        const deltaSec = pxToSeconds(clientX - this._dragLastClientX, this._pixelsPerSecond); // core/video-editor/timeline-calc.js
        this._dragLastClientX = clientX;
        const MIN_GAP = this.MIN_CLIP_GAP_SEC;

        if (track === 'video') {
            const clip = this._videoClips[index];
            if (!clip) return;
            // Toán RIPPLE (giữ cố định mép ĐỐI DIỆN — Giang yêu cầu) nằm ở Core, xem docstring
            // `computeVideoStartTrim()`/`computeVideoEndTrim()`, core/video-editor/timeline-calc.js.
            if (handleType === 'start') {
                const result = computeVideoStartTrim(this._videoClips, index, deltaSec, MIN_GAP, this._fullSourceDuration);
                clip.sourceStart = result.newSourceStart;
                if (result.prevSourceEnd != null) this._videoClips[index - 1].sourceEnd = result.prevSourceEnd;
                this._previewVideoAtSourceTime(index, clip.sourceStart);
            } else if (handleType === 'end') {
                const result = computeVideoEndTrim(this._videoClips, index, deltaSec, MIN_GAP, this._fullSourceDuration);
                clip.sourceEnd = result.newSourceEnd;
                if (result.nextSourceStart != null) this._videoClips[index + 1].sourceStart = result.nextSourceStart;
                this._previewVideoAtSourceTime(index, Math.max(clip.sourceStart, clip.sourceEnd - 0.05));
            }
            this._layoutVideoTrackLive();
        } else {
            const list = track === 'audio' ? this._audioClips : this._textClips;
            const clip = list[index];
            if (!clip) return;
            const result = computeFreeClipDrag(clip, handleType, deltaSec, MIN_GAP); // core/video-editor/timeline-calc.js
            clip.timelineStart = result.timelineStart;
            clip.timelineEnd = result.timelineEnd;
            this._layoutSingleFreeClip(track, index);
            if (handleType === 'start' || handleType === 'move') this._seekToOutputTime(clip.timelineStart);
            else this._seekToOutputTime(Math.max(clip.timelineStart, clip.timelineEnd - 0.05));
        }
        this._hasUnsavedChanges = true;
    },

    /** Nhảy `<video>` tới đúng giây NGUỒN đang kéo (start/end) VÀ vẽ lại preview ngay khi khung đó
     * decode xong — MỚI (Giang báo trim không cập nhật preview). `clipIndex` cập nhật luôn
     * `_currentClipIndex` để current-time hiển thị đúng theo track Video đang chỉnh. */
    _previewVideoAtSourceTime(clipIndex, sourceTime) {
        this._currentClipIndex = clipIndex;
        videoEditorSourceEl.currentTime = Math.max(0, Math.min(sourceTime, Math.max(0, this._fullSourceDuration - 0.01)));
        videoEditorSourceEl.addEventListener('seeked', () => {
            this._drawFrame();
            this._updateTimeDisplay(this._computeCurrentOutputTime());
        }, { once: true });
    },

    handleTimelineDragEnd() {
        if (!this._dragHandle) return;
        this._dragHandle = null;
        this._drawFrame();
        this._renderAllTracks(); // đồng bộ đầy đủ (viền chọn, marker, độ rộng) — filmstrip KHÔNG trích lại (đã cache _masterFilmstripFrames, chỉ lọc theo range)
    },

    // ===================== Cắt tại current / Nhân bản / Xoá / Đổi thứ tự =====================

    handleCutAtCurrent() {
        if (!this._selected) return;
        const outputTime = this._computeCurrentOutputTime();
        const { track, index } = this._selected;
        const MIN_GAP = this.MIN_CLIP_GAP_SEC;

        if (track === 'video') {
            const found = findVideoClipAtOutputTime(this._videoClips, outputTime); // core/video-editor/timeline-calc.js
            if (!found || found.index !== index) return; // guard — con trỏ không nằm trong đúng đoạn đang chọn
            const clip = this._videoClips[index];
            if (found.sourceSplitPoint <= clip.sourceStart + MIN_GAP || found.sourceSplitPoint >= clip.sourceEnd - MIN_GAP) return; // guard — quá sát mép
            const [a, b] = splitRangeAt(clip.sourceStart, clip.sourceEnd, found.sourceSplitPoint); // core/video-editor/timeline-calc.js
            this._videoClips.splice(index, 1, { sourceStart: a.start, sourceEnd: a.end }, { sourceStart: b.start, sourceEnd: b.end });
            this._selected = { track: 'video', index };
        } else {
            const list = track === 'audio' ? this._audioClips : this._textClips;
            const clip = list[index];
            if (!clip || outputTime <= clip.timelineStart + MIN_GAP || outputTime >= clip.timelineEnd - MIN_GAP) return;
            const originalStart = clip.timelineStart;
            const [a, b] = splitRangeAt(clip.timelineStart, clip.timelineEnd, outputTime);
            const cloneB = Object.assign({}, clip, { timelineStart: b.start, timelineEnd: b.end });
            if (track === 'audio') cloneB.offsetInSong = clip.offsetInSong + (b.start - originalStart); // giữ liền mạch nội dung bài hát qua điểm cắt
            clip.timelineStart = a.start; clip.timelineEnd = a.end;
            list.splice(index + 1, 0, cloneB);
        }
        this._hasUnsavedChanges = true;
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleDuplicateClip() {
        if (!this._selected) return;
        const { track, index } = this._selected;
        if (track === 'video') {
            this._videoClips.splice(index + 1, 0, Object.assign({}, this._videoClips[index]));
            this._selected = { track: 'video', index: index + 1 };
        } else {
            const list = track === 'audio' ? this._audioClips : this._textClips;
            const clip = list[index];
            const length = clip.timelineEnd - clip.timelineStart;
            const dup = Object.assign({}, clip, { id: this._nextId(), timelineStart: clip.timelineEnd, timelineEnd: clip.timelineEnd + length });
            list.splice(index + 1, 0, dup);
            this._selected = { track, index: index + 1 };
        }
        this._hasUnsavedChanges = true;
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleDeleteClip() {
        if (!this._selected) return;
        const { track, index } = this._selected;
        if (track === 'video') {
            if (this._videoClips.length <= 1) return; // guard — KHÔNG được xoá đoạn Video DUY NHẤT còn lại (không thể có Video rỗng)
            this._videoClips.splice(index, 1);
            if (this._currentClipIndex != null && this._currentClipIndex >= this._videoClips.length) this._currentClipIndex = this._videoClips.length - 1;
        } else {
            const list = track === 'audio' ? this._audioClips : this._textClips;
            list.splice(index, 1);
        }
        this._selected = null;
        this._hasUnsavedChanges = true;
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleMoveClipEarlier() {
        if (!this._selected || this._selected.track !== 'video' || this._selected.index <= 0) return;
        const { index } = this._selected;
        const arr = this._videoClips;
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
        this._selected = { track: 'video', index: index - 1 };
        this._afterVideoClipsReordered();
    },

    handleMoveClipLater() {
        if (!this._selected || this._selected.track !== 'video' || this._selected.index >= this._videoClips.length - 1) return;
        const { index } = this._selected;
        const arr = this._videoClips;
        [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
        this._selected = { track: 'video', index: index + 1 };
        this._afterVideoClipsReordered();
    },

    _afterVideoClipsReordered() {
        this._hasUnsavedChanges = true;
        this._renderAllTracks();
        this._renderToolbar();
    },

    // ===================== Toolbar (icon SVG, nội dung đổi theo lựa chọn) =====================

    _renderToolbar() {
        videoEditorToolbarEl.innerHTML = '';
        const addBtn = (iconHtml, labelKey, msgType) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shrink-0 w-14 flex flex-col items-center gap-1 py-1.5 active:opacity-50 transition-opacity text-slate-200';
            btn.innerHTML = `<span class="w-5 h-5 flex items-center justify-center">${iconHtml}</span><span class="text-[9px] font-medium truncate w-full text-center">${t(labelKey)}</span>`;
            btn.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: msgType, payload: {} }));
            videoEditorToolbarEl.appendChild(btn);
        };

        if (!this._selected) {
            addBtn(_veIcon('crop'), 'videoEdit.btnCrop.title', 'videoEdit.crop.click');
            addBtn(_veIcon('rotateLeft'), 'videoEdit.btnRotateLeft.title', 'videoEdit.rotateLeft.click');
            addBtn(_veIcon('rotateRight'), 'videoEdit.btnRotateRight.title', 'videoEdit.rotateRight.click');
            addBtn(_veIcon('adjust'), 'videoEdit.btnAdjust.title', 'videoEdit.props.open');
            addBtn(_veIcon('reset'), 'videoEdit.btnReset.title', 'videoEdit.reset.click');
            addBtn(_veIcon('extractFrame'), 'videoEdit.btnExtractFrame.title', 'videoEdit.extractFrame.click');
            addBtn(_veIcon('addMusic'), 'videoEdit.btnAddMusic.title', 'videoEdit.addMusic.open');
            addBtn('<span class="font-bold text-sm">T</span>', 'videoEdit.btnAddText.title', 'videoEdit.addText.click');
            return;
        }

        const { track } = this._selected;
        addBtn(_veIcon('deselect'), 'videoEdit.btnDeselect.title', 'videoEdit.deselect.click');
        addBtn(_veIcon('cut'), 'videoEdit.btnCutCurrent.title', 'videoEdit.cutAtCurrent.click');
        addBtn(_veIcon('duplicate'), 'videoEdit.btnDuplicate.title', 'videoEdit.duplicateClip.click');

        if (track === 'video') {
            if (this._videoClips.length > 1) {
                addBtn(_veIcon('delete'), 'videoEdit.btnDelete.title', 'videoEdit.deleteClip.click');
                if (this._selected.index > 0) addBtn(_veIcon('moveLeft'), 'videoEdit.btnMoveEarlier.title', 'videoEdit.moveClipEarlier.click');
                if (this._selected.index < this._videoClips.length - 1) addBtn(_veIcon('moveRight'), 'videoEdit.btnMoveLater.title', 'videoEdit.moveClipLater.click');
            }
        } else {
            addBtn(_veIcon('delete'), 'videoEdit.btnDelete.title', 'videoEdit.deleteClip.click');
            if (track === 'audio') addBtn(_veIcon('shiftSegment'), 'videoEdit.btnShiftSegment.title', 'videoEdit.songShift.open');
            else addBtn('<span class="font-bold text-sm">Aa</span>', 'videoEdit.btnEditText.title', 'videoEdit.textEdit.open');
        }
    },

    // ===================== Crop (Cropper.js — toàn cục, không đổi so với v2) =====================

    handleCropOpen() {
        if (!this._nativeW) return;
        this._pause();
        const canvas = document.createElement('canvas');
        canvas.width = this._nativeW;
        canvas.height = this._nativeH;
        canvas.getContext('2d').drawImage(videoEditorSourceEl, 0, 0, canvas.width, canvas.height);
        videoEditorCropSourceEl.src = canvas.toDataURL('image/jpeg', 0.92);
        videoEditorCropOverlayEl.classList.remove('hidden');
        videoEditorCropSourceEl.addEventListener('load', () => this._initCropper(), { once: true });
        this._renderCropRatioButtons();
    },

    /** MỚI — preset tỉ lệ khung hình (Giang yêu cầu: đổi 16:9 <-> 9:16 nhiều lần vẫn phải ra đúng,
     * không biến dạng cộng dồn — xem docstring `setAspectRatioSession()`, core/image-editor/cropper-engine.js). */
    _renderCropRatioButtons() {
        videoEditorCropRatioRowEl.innerHTML = '';
        const presets = [
            { label: t('videoEdit.ratio.free'), ratio: NaN },
            { label: '16:9', ratio: 16 / 9 },
            { label: '9:16', ratio: 9 / 16 },
            { label: '1:1', ratio: 1 },
            { label: '4:5', ratio: 4 / 5 },
        ];
        presets.forEach(({ label, ratio }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'shrink-0 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-slate-200 active:opacity-50';
            btn.textContent = label;
            btn.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropRatio.select', payload: { ratio } }));
            videoEditorCropRatioRowEl.appendChild(btn);
        });
    },

    handleCropRatioSelect(ratio) {
        if (!this._cropper) return;
        setAspectRatioSession(this._cropper, ratio); // core/image-editor/cropper-engine.js — luôn tính lại từ ảnh gốc, đổi qua lại nhiều lần không biến dạng cộng dồn
    },

    _initCropper() {
        if (this._cropper) destroyCropperSession(this._cropper); // core/image-editor/cropper-engine.js
        const cropFraction = this._cropFraction;
        this._cropper = initCropperSession(videoEditorCropSourceEl, {
            viewMode: 1, autoCropArea: 1, background: false, responsive: true,
            ready() {
                if (!cropFraction) return;
                const w = videoEditorCropSourceEl.naturalWidth;
                const h = videoEditorCropSourceEl.naturalHeight;
                this.cropper.setData({ x: cropFraction.x * w, y: cropFraction.y * h, width: cropFraction.w * w, height: cropFraction.h * h });
            },
        });
    },

    handleCropConfirm() {
        if (!this._cropper) return;
        const data = getCropDataFromSession(this._cropper, true); // core/image-editor/cropper-engine.js
        const w = videoEditorCropSourceEl.naturalWidth;
        const h = videoEditorCropSourceEl.naturalHeight;
        this._cropFraction = { x: data.x / w, y: data.y / h, w: data.width / w, h: data.height / h };
        this._hasUnsavedChanges = true;
        this._closeCropOverlay();
        this._drawFrame();
    },

    handleCropCancel() { this._closeCropOverlay(); },

    _closeCropOverlay() {
        if (this._cropper) { destroyCropperSession(this._cropper); this._cropper = null; }
        videoEditorCropOverlayEl.classList.add('hidden');
    },

    handleCropReset() { this._cropFraction = null; this._hasUnsavedChanges = true; this._drawFrame(); },

    // ===================== Rotate / Filter / Volume gốc / Reset (toàn cục) =====================

    handleRotateLeft() { this._rotateDeg = ((this._rotateDeg - 90) % 360 + 360) % 360; this._hasUnsavedChanges = true; this._drawFrame(); },
    handleRotateRight() { this._rotateDeg = (this._rotateDeg + 90) % 360; this._hasUnsavedChanges = true; this._drawFrame(); },

    handleReset() {
        this._cropFraction = null;
        this._rotateDeg = 0;
        this._volumeVideo = 100;
        this._brightness = 100;
        this._contrast = 100;
        this._saturation = 100;
        videoEditorSourceEl.volume = 1;
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    // ===================== Generic Drawer — khung DÙNG CHUNG cho Chỉnh/Sửa chữ/Chọn nhạc/Dịch
    // chuyển đoạn (core/generic-drawer.js, TÁI SỬ DỤNG THẬT theo yêu cầu Giang — cấm dựng modal
    // mới lặp lại). Nội dung động (bodyHtml) do CHÍNH các hàm handleXxxOpen() dưới đây tự viết +
    // querySelector lại NGAY SAU khi gọi openGenericDrawer() để wire trực tiếp (KHÔNG qua
    // eventBus.send() cho các phần tử NÀY — đúng quy ước đã có của Generic Drawer trong toàn app,
    // xem event/workflow/document-reader.js, KHÁC với quy ước Rule 5a áp cho DOM do CHÍNH file này
    // tự dựng ở nơi khác như toolbar/track — 2 quy ước độc lập, không mâu thuẫn). =====================

    _buildDrawerHeaderHtml(title) {
        return `<div class="flex items-center justify-between px-4 pt-1 pb-3 border-b border-slate-100"><h3 class="font-bold text-sm text-slate-900">${_escapeVideoEditorHtml(title)}</h3><button id="ve-gd-close-btn" type="button" class="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm leading-none">&times;</button></div>`;
    },

    _wireDrawerCloseButton() {
        const btn = genericDrawerHeader.querySelector('#ve-gd-close-btn');
        if (btn) btn.addEventListener('click', () => this._closeGenericDrawerFully());
    },

    /** Đóng Generic Drawer (dùng CHUNG cho cả 4 loại nội dung) — cùng mẫu `document-reader.js`:
     * `closeGenericDrawer()` chỉ trượt xuống, tự nghe `transitionend` rồi mới `hideGenericDrawerImmediately()`
     * ẩn hẳn (core KHÔNG tự addEventListener cho DOM tĩnh, Rule 5a). Luôn refresh lại toolbar/track/
     * preview sau khi đóng — AN TOÀN dù vừa đóng loại nội dung nào (đổi filter/text/nhạc đều cần). */
    _closeGenericDrawerFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
        this._renderAllTracks();
        this._renderToolbar();
        this._drawFrame();
    },

    // ===================== "Chỉnh" (Filter + Volume gốc, toàn cục) =====================

    handlePropsOpen() {
        const bodyHtml = `
            <div class="px-4 pb-6 flex flex-col gap-5">
                <div><label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.volVideo'))}</span><span id="ve-gd-vol-video-val">${this._volumeVideo}%</span></label><input type="range" id="ve-gd-vol-video" min="0" max="200" value="${this._volumeVideo}" class="w-full"></div>
                <div><label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.filterBrightness'))}</span><span id="ve-gd-brightness-val">${this._brightness}%</span></label><input type="range" id="ve-gd-brightness" min="50" max="150" value="${this._brightness}" class="w-full"></div>
                <div><label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.filterContrast'))}</span><span id="ve-gd-contrast-val">${this._contrast}%</span></label><input type="range" id="ve-gd-contrast" min="50" max="150" value="${this._contrast}" class="w-full"></div>
                <div><label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.filterSaturation'))}</span><span id="ve-gd-saturation-val">${this._saturation}%</span></label><input type="range" id="ve-gd-saturation" min="0" max="200" value="${this._saturation}" class="w-full"></div>
            </div>`;
        openGenericDrawer({ height: 'auto', maxHeight: '60vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.propsModal.title')), bodyHtml });
        this._wireDrawerCloseButton();

        const volEl = genericDrawerBody.querySelector('#ve-gd-vol-video');
        const volValEl = genericDrawerBody.querySelector('#ve-gd-vol-video-val');
        volEl.addEventListener('input', () => {
            this._volumeVideo = parseInt(volEl.value, 10) || 0;
            volValEl.textContent = `${this._volumeVideo}%`;
            videoEditorSourceEl.volume = Math.min(1, this._volumeVideo / 100);
            this._hasUnsavedChanges = true;
        });
        [['brightness', '_brightness'], ['contrast', '_contrast'], ['saturation', '_saturation']].forEach(([domName, field]) => {
            const el = genericDrawerBody.querySelector(`#ve-gd-${domName}`);
            const valEl = genericDrawerBody.querySelector(`#ve-gd-${domName}-val`);
            el.addEventListener('input', () => {
                this[field] = parseInt(el.value, 10) || 100;
                valEl.textContent = `${this[field]}%`;
                this._hasUnsavedChanges = true;
                if (!this._isPlaying) this._drawFrame();
            });
        });
    },

    // ===================== Trích xuất ảnh (không đổi) =====================

    async handleExtractFrame() {
        if (!this._nativeW) return;
        const sourceCanvas = captureVideoFrameToCanvas(videoEditorSourceEl); // core/video-editor/frame-extract.js
        const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob) { await alertModal(t('videoEdit.extractFrame.failed')); return; }
        const thumbBlob = await buildExtractedPhotoThumbnail(sourceCanvas, 0.2);
        const filename = `${buildExtractedPhotoFilename()}.jpg`;
        await saveImage(blob, filename, thumbBlob, sourceCanvas.width, sourceCanvas.height);
        await alertModal(t('videoEdit.extractFrame.success'));
    },

    // ===================== Thêm nhạc (Generic Drawer — chỉ hiện thanh tìm kiếm, KHÔNG tự hiện cả
    // danh sách; chưa gõ gì báo "gõ để tìm", gõ mà không khớp báo "không tìm thấy" — Giang yêu cầu) =====================

    handleAddMusicOpen() {
        const bodyHtml = `
            <div class="px-4 pb-4 flex flex-col gap-2.5 h-full">
                <div class="relative shrink-0">
                    <input id="ve-gd-song-search" type="text" inputmode="search" autocomplete="off" placeholder="${_escapeVideoEditorHtml(t('videoEdit.songSearch.placeholder'))}" class="w-full bg-slate-100 border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none">
                    <button id="ve-gd-song-search-clear" type="button" class="hidden absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm leading-none">&times;</button>
                </div>
                <div id="ve-gd-song-list" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1"></div>
            </div>`;
        openGenericDrawer({ height: '70vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.songPicker.title')), bodyHtml, bodyClass: 'overflow-hidden flex flex-col' });
        this._wireDrawerCloseButton();

        this._songSearchQuery = ''; // MỖI LẦN MỞ reset rỗng — không tự hiện toàn bộ danh sách
        const searchEl = genericDrawerBody.querySelector('#ve-gd-song-search');
        const clearBtn = genericDrawerBody.querySelector('#ve-gd-song-search-clear');
        searchEl.addEventListener('input', () => {
            this._songSearchQuery = normalizeSongName(searchEl.value); // core/song-search.js
            clearBtn.classList.toggle('hidden', !searchEl.value);
            this._renderSongList();
        });
        clearBtn.addEventListener('click', () => {
            searchEl.value = '';
            clearBtn.classList.add('hidden');
            this._songSearchQuery = '';
            this._renderSongList();
            searchEl.focus();
        });
        this._ensureSongListLoaded();
        this._renderSongList(); // hiện NGAY thông báo "gõ để tìm" trước khi danh sách tải xong
    },

    async _ensureSongListLoaded() {
        if (this._songListCache) return;
        const keys = await getAllSongKeys();
        const records = await Promise.all(keys.map(async (key) => {
            const record = await getSongRecord(key);
            return record ? { key, tag: record.tag, duration: record.duration } : null;
        }));
        this._songListCache = records.filter(Boolean);
        this._renderSongList();
    },

    _renderSongList() {
        const listEl = genericDrawerBody.querySelector('#ve-gd-song-list');
        if (!listEl) return; // drawer đã đóng/đổi nội dung khác trong lúc đang tải — bỏ qua an toàn
        const query = this._songSearchQuery;
        if (!query) {
            listEl.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">${_escapeVideoEditorHtml(t('videoEdit.songSearch.emptyPrompt'))}</p>`;
            return;
        }
        const filtered = (this._songListCache || []).filter((item) => songMatchesQuery(query, item.tag.title, item.tag.artist, item.tag.album)); // core/song-search.js
        if (!filtered.length) {
            listEl.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">${_escapeVideoEditorHtml(t('videoEdit.songSearch.noResults'))}</p>`;
            return;
        }
        listEl.innerHTML = '';
        filtered.forEach((item) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex flex-col';
            row.innerHTML = `<span class="text-xs font-semibold text-slate-900 truncate">${_escapeVideoEditorHtml(item.tag.title || item.key)}</span><span class="text-[10px] text-slate-400 truncate">${_escapeVideoEditorHtml(item.tag.artist || '')}</span>`;
            row.addEventListener('click', () => this._handleSongPickerSelect(item.key));
            listEl.appendChild(row);
        });
    },

    async _handleSongPickerSelect(songKey) {
        const record = await getSongRecord(songKey);
        if (!record) return;
        const outputTime = this._computeCurrentOutputTime();
        const length = Math.min(10, record.duration || 10);
        this._audioClips.push({ id: this._nextId(), songKey, record, timelineStart: outputTime, timelineEnd: outputTime + length, offsetInSong: 0, volume: 1 });
        this._selected = { track: 'audio', index: this._audioClips.length - 1 };
        this._hasUnsavedChanges = true;
        this._closeGenericDrawerFully();
    },

    // ===================== Chữ (Text overlay đa-clip — MỞ RỘNG: phông Google Fonts, đậm/nghiêng,
    // blur, đổ bóng bật/tắt, transition fade cơ bản; vị trí/kích cỡ/góc xoay giờ chỉnh trực tiếp
    // trên preview bằng cử chỉ, xem handlePreviewTextDrag*/handlePreviewTextPinch*) =====================

    handleAddText() {
        const outputTime = this._computeCurrentOutputTime();
        this._textClips.push({
            id: this._nextId(), val: t('videoEdit.text.defaultValue'),
            size: 60, color: '#ffffff', posX: 50, posY: 80, rotation: 0,
            bold: false, italic: false, fontFamily: 'system-ui', blur: 0, shadow: true, transition: 'none',
            timelineStart: outputTime, timelineEnd: outputTime + 3,
        });
        this._selected = { track: 'text', index: this._textClips.length - 1 };
        this._hasUnsavedChanges = true;
        this._renderAllTracks();
        this._renderToolbar();
        this.handleTextEditOpen();
    },

    _activeTextClip() { return this._selected && this._selected.track === 'text' ? this._textClips[this._selected.index] : null; },

    handleTextEditOpen() {
        const clip = this._activeTextClip();
        if (!clip) return;
        const fontOptionsHtml = VIDEO_EDITOR_FONTS.map((f) => `<option value="${_escapeVideoEditorHtml(f.value)}" ${clip.fontFamily === f.value ? 'selected' : ''}>${_escapeVideoEditorHtml(f.label)}</option>`).join('');
        const boldClass = (on) => `py-2 rounded-xl text-xs font-bold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'}`;
        const italicClass = (on) => `py-2 rounded-xl text-xs italic font-semibold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'}`;
        const bodyHtml = `
            <div class="px-4 pb-6 flex flex-col gap-3">
                <input type="text" id="ve-gd-text-value" value="${_escapeVideoEditorHtml(clip.val)}" class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none">
                <select id="ve-gd-text-font" class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none" style="font-family:'${clip.fontFamily}'">${fontOptionsHtml}</select>
                <div class="grid grid-cols-2 gap-2">
                    <button type="button" id="ve-gd-text-bold" class="${boldClass(clip.bold)}">B</button>
                    <button type="button" id="ve-gd-text-italic" class="${italicClass(clip.italic)}">I</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <label class="block text-[10px] text-slate-500 mb-1.5">${_escapeVideoEditorHtml(t('videoEdit.text.size'))}</label>
                        <input type="range" id="ve-gd-text-size" min="20" max="150" value="${clip.size}">
                    </div>
                    <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <label class="block text-[10px] text-slate-500 mb-1.5">${_escapeVideoEditorHtml(t('videoEdit.text.color'))}</label>
                        <input type="color" id="ve-gd-text-color" value="${clip.color}" class="w-full h-7 bg-transparent border-0 rounded cursor-pointer p-0">
                    </div>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <label class="flex justify-between text-[10px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.text.blur'))}</span><span id="ve-gd-text-blur-val">${clip.blur || 0}px</span></label>
                    <input type="range" id="ve-gd-text-blur" min="0" max="20" value="${clip.blur || 0}">
                </div>
                <label class="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span class="text-[11px] text-slate-600">${_escapeVideoEditorHtml(t('videoEdit.text.shadow'))}</span>
                    <input type="checkbox" id="ve-gd-text-shadow" ${clip.shadow !== false ? 'checked' : ''}>
                </label>
                <div>
                    <label class="block text-[10px] text-slate-500 mb-1.5">${_escapeVideoEditorHtml(t('videoEdit.text.transition'))}</label>
                    <select id="ve-gd-text-transition" class="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none">
                        <option value="none" ${clip.transition !== 'fade' ? 'selected' : ''}>${_escapeVideoEditorHtml(t('videoEdit.text.transitionNone'))}</option>
                        <option value="fade" ${clip.transition === 'fade' ? 'selected' : ''}>${_escapeVideoEditorHtml(t('videoEdit.text.transitionFade'))}</option>
                    </select>
                </div>
                <p class="text-[10px] text-slate-400 text-center">${_escapeVideoEditorHtml(t('videoEdit.text.gestureHint'))}</p>
            </div>`;
        openGenericDrawer({ height: 'auto', maxHeight: '85vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.textEdit.title')), bodyHtml });
        this._wireDrawerCloseButton();

        const valueEl = genericDrawerBody.querySelector('#ve-gd-text-value');
        const fontEl = genericDrawerBody.querySelector('#ve-gd-text-font');
        const boldBtn = genericDrawerBody.querySelector('#ve-gd-text-bold');
        const italicBtn = genericDrawerBody.querySelector('#ve-gd-text-italic');
        const sizeEl = genericDrawerBody.querySelector('#ve-gd-text-size');
        const colorEl = genericDrawerBody.querySelector('#ve-gd-text-color');
        const blurEl = genericDrawerBody.querySelector('#ve-gd-text-blur');
        const blurValEl = genericDrawerBody.querySelector('#ve-gd-text-blur-val');
        const shadowEl = genericDrawerBody.querySelector('#ve-gd-text-shadow');
        const transitionEl = genericDrawerBody.querySelector('#ve-gd-text-transition');

        valueEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.val = valueEl.value; this._hasUnsavedChanges = true; this._drawFrame(); });
        fontEl.addEventListener('change', () => { const c = this._activeTextClip(); if (!c) return; c.fontFamily = fontEl.value; fontEl.style.fontFamily = `'${fontEl.value}'`; this._hasUnsavedChanges = true; this._drawFrame(); });
        boldBtn.addEventListener('click', () => { const c = this._activeTextClip(); if (!c) return; c.bold = !c.bold; boldBtn.className = boldClass(c.bold); this._hasUnsavedChanges = true; this._drawFrame(); });
        italicBtn.addEventListener('click', () => { const c = this._activeTextClip(); if (!c) return; c.italic = !c.italic; italicBtn.className = italicClass(c.italic); this._hasUnsavedChanges = true; this._drawFrame(); });
        sizeEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.size = parseInt(sizeEl.value, 10) || 60; this._hasUnsavedChanges = true; this._drawFrame(); });
        colorEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.color = colorEl.value; this._hasUnsavedChanges = true; this._drawFrame(); });
        blurEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.blur = parseInt(blurEl.value, 10) || 0; blurValEl.textContent = `${c.blur}px`; this._hasUnsavedChanges = true; this._drawFrame(); });
        shadowEl.addEventListener('change', () => { const c = this._activeTextClip(); if (!c) return; c.shadow = shadowEl.checked; this._hasUnsavedChanges = true; this._drawFrame(); });
        transitionEl.addEventListener('change', () => { const c = this._activeTextClip(); if (!c) return; c.transition = transitionEl.value; this._hasUnsavedChanges = true; this._drawFrame(); });
    },

    // ===================== "Dịch chuyển tới đoạn" (chọn đoạn nhạc gốc + âm lượng riêng clip) =====================

    _activeAudioClip() { return this._selected && this._selected.track === 'audio' ? this._audioClips[this._selected.index] : null; },

    handleSongShiftOpen() {
        const clip = this._activeAudioClip();
        if (!clip) return;
        const bodyHtml = `
            <div class="px-4 pb-6 flex flex-col gap-4">
                <p class="text-center text-[11px] text-slate-500">${_escapeVideoEditorHtml(t('videoEdit.songShift.positionLabel'))}: ${formatClipTimeLabel(clip.timelineStart)} – ${formatClipTimeLabel(clip.timelineEnd)} / ${formatClipTimeLabel(this._totalDuration())}</p>
                <div>
                    <div id="ve-gd-shift-time-label" class="text-center text-[11px] font-mono text-emerald-600 mb-2"></div>
                    <div id="ve-gd-shift-bar-wrap" class="relative h-14 rounded-lg overflow-hidden bg-slate-100 select-none" style="touch-action:none;">
                        <div id="ve-gd-shift-window" class="absolute top-0 bottom-0 bg-emerald-500/80 border-2 border-emerald-600 rounded" style="touch-action:none;"></div>
                    </div>
                </div>
                <div>
                    <label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.clipVolume.label'))}</span><span id="ve-gd-clip-vol-val">${Math.round(clip.volume * 100)}%</span></label>
                    <input type="range" id="ve-gd-clip-vol" min="0" max="200" value="${Math.round(clip.volume * 100)}">
                </div>
            </div>`;
        openGenericDrawer({ height: 'auto', maxHeight: '65vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.songShift.title')), bodyHtml });
        this._wireDrawerCloseButton();

        const wrapEl = genericDrawerBody.querySelector('#ve-gd-shift-bar-wrap');
        const windowEl = genericDrawerBody.querySelector('#ve-gd-shift-window');
        const timeLabelEl = genericDrawerBody.querySelector('#ve-gd-shift-time-label');
        const volEl = genericDrawerBody.querySelector('#ve-gd-clip-vol');
        const volValEl = genericDrawerBody.querySelector('#ve-gd-clip-vol-val');

        const renderBar = () => {
            const c = this._activeAudioClip();
            if (!c) return;
            const barWidth = wrapEl.clientWidth || 300;
            const songDuration = c.record.duration || 1;
            this._songShiftPxPerSec = barWidth / songDuration;
            const clipLength = c.timelineEnd - c.timelineStart;
            windowEl.style.left = `${c.offsetInSong * this._songShiftPxPerSec}px`;
            windowEl.style.width = `${Math.max(10, clipLength * this._songShiftPxPerSec)}px`;
            timeLabelEl.textContent = `${formatClipTimeLabel(c.offsetInSong)} / ${formatClipTimeLabel(songDuration)}`;
        };
        // SỬA (Giang báo "chưa chọn được") — đợi 1 khung `requestAnimationFrame` trước khi đo
        // `clientWidth`, tránh đọc trúng lúc panel VỪA hiện (chưa layout xong, có thể trả 0/sai).
        requestAnimationFrame(renderBar);

        let dragging = false;
        let lastX = 0;
        windowEl.addEventListener('pointerdown', (e) => {
            dragging = true;
            lastX = e.clientX;
            try { windowEl.setPointerCapture(e.pointerId); } catch (err) { /* không sao — vẫn kéo qua cờ dragging */ }
        });
        windowEl.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const c = this._activeAudioClip();
            if (!c) return;
            const deltaSec = (e.clientX - lastX) / (this._songShiftPxPerSec || 1);
            lastX = e.clientX;
            const clipLength = c.timelineEnd - c.timelineStart;
            c.offsetInSong = clampSongOffsetDrag(c.offsetInSong + deltaSec, clipLength, c.record.duration || 0); // core/video-editor/audio-sync.js
            this._hasUnsavedChanges = true;
            renderBar();
        });
        const endDrag = (e) => { dragging = false; try { windowEl.releasePointerCapture(e.pointerId); } catch (err) { /* không sao */ } };
        windowEl.addEventListener('pointerup', endDrag);
        windowEl.addEventListener('pointercancel', () => { dragging = false; });

        volEl.addEventListener('input', () => {
            const c = this._activeAudioClip();
            if (!c) return;
            c.volume = (parseInt(volEl.value, 10) || 0) / 100;
            volValEl.textContent = `${volEl.value}%`;
            this._hasUnsavedChanges = true;
        });
    },

    // ===================== Lưu (dropdown Ghi đè | Lưu mới) =====================

    handleSaveClick(anchorEl) {
        openDropdownMenu(anchorEl, [
            { icon: _veIcon('cut'), name: t('videoEdit.save.overwrite'), callback: () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.saveOverwrite.click', payload: {} }) },
            { icon: _veIcon('duplicate'), name: t('videoEdit.save.asNew'), callback: () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.saveAsNew.click', payload: {} }) },
        ]);
    },

    _buildProcessParams() {
        return {
            sourceBlob: this._record.blob,
            videoClips: this._videoClips,
            cropFraction: this._cropFraction,
            rotateDeg: this._rotateDeg,
            filterCss: this._currentFilterCss(),
            volumeVideo: this._volumeVideo / 100,
            textClips: this._textClips,
            audioClips: this._audioClips.map((c) => ({ blob: c.record.blob, offsetInSong: c.offsetInSong, timelineStart: c.timelineStart, timelineEnd: c.timelineEnd, volume: c.volume })),
        };
    },

    _buildNewFilename(suffix) {
        const original = this._record.filename || 'video';
        const base = original.replace(/\.[^/.]+$/, '');
        const stamp = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${base}-${suffix || 'edit'}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`;
    },

    async _buildThumbForBlob(blob) {
        const tmp = document.createElement('video');
        tmp.muted = true;
        tmp.src = URL.createObjectURL(blob);
        await new Promise((resolve) => { tmp.addEventListener('loadeddata', resolve, { once: true }); });
        const canvas = document.createElement('canvas');
        canvas.width = tmp.videoWidth; canvas.height = tmp.videoHeight;
        canvas.getContext('2d').drawImage(tmp, 0, 0, canvas.width, canvas.height);
        const thumbBlob = await buildExtractedPhotoThumbnail(canvas, 0.2); // core/video-editor/frame-extract.js
        return { thumbBlob, width: tmp.videoWidth, height: tmp.videoHeight, duration: tmp.duration };
    },

    async handleSaveOverwrite() {
        this._pause();
        try {
            const blob = await processVideo(this._buildProcessParams());
            const { thumbBlob, width, height, duration } = await this._buildThumbForBlob(blob);
            await setVideoRecord(this._videoKey, { blob, thumbBlob, width, height, duration, filename: this._record.filename, addedAt: this._record.addedAt });
            this._hasUnsavedChanges = false;
            await alertModal(t('videoEdit.save.success'));
        } catch (err) {
            console.error('[handleSaveOverwrite] Lỗi xử lý/lưu video:', err);
            await alertModal(t('videoEdit.save.failed'));
        }
    },

    async handleSaveAsNew() {
        this._pause();
        try {
            const blob = await processVideo(this._buildProcessParams());
            const filename = this._buildNewFilename();
            const { thumbBlob, width, height, duration } = await this._buildThumbForBlob(blob);
            await saveVideo(blob, filename, thumbBlob, width, height, duration); // core/file-manager/video.js
            this._hasUnsavedChanges = false;
            await alertModal(t('videoEdit.save.success'));
        } catch (err) {
            console.error('[handleSaveAsNew] Lỗi xử lý/lưu video mới:', err);
            await alertModal(t('videoEdit.save.failed'));
        }
    },

    // ===================== Quay lại =====================

    handleBack() {
        if (!this._hasUnsavedChanges) { window.location.href = 'index.html'; return; }
        modalChoice(
            t('videoEdit.discardConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('videoEdit.discardConfirm.title'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: () => { window.location.href = 'index.html'; } },
            ],
            { title: t('videoEdit.discardConfirm.title') }
        );
    },
};

/** Escape HTML tối thiểu cho tên bài hát/nghệ sĩ hiển thị trong danh sách chọn nhạc. */
function _escapeVideoEditorHtml(str) {
    return (str || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Icon SVG dùng cho toolbar/dropdown (Workflow, KHÔNG thuộc core/ — không bị ràng buộc Rule 5). */
function _veIcon(name) {
    const paths = {
        crop: 'M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3',
        rotateLeft: 'M9 15L3 9m0 0l6-6M3 9h11a6 6 0 010 12h-2',
        rotateRight: 'M15 15l6-6m0 0l-6-6m6 6H10a6 6 0 000 12h2',
        adjust: 'M4 6h16M6 6a2 2 0 104 0 2 2 0 00-4 0zM4 12h16M14 12a2 2 0 104 0 2 2 0 00-4 0zM4 18h16M8 18a2 2 0 104 0 2 2 0 00-4 0z',
        reset: 'M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4',
        extractFrame: 'M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z',
        addMusic: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
        deselect: 'M6 18L18 6M6 6l12 12',
        cut: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M6 3a3 3 0 100 6 3 3 0 000-6zm12 12a3 3 0 100 6 3 3 0 000-6zM6.75 8.25L18 19.5m-1.5-16.5L6.75 15.75',
        duplicate: 'M8 16V5a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 01-1 1H9M8 16H5a1 1 0 01-1-1V6a1 1 0 011-1h3m0 11v3a1 1 0 001 1h9a1 1 0 001-1v-9a1 1 0 00-1-1h-3',
        delete: 'M4 7h16M9 7V4h6v3m-7 0v13a1 1 0 001 1h8a1 1 0 001-1V7H7z',
        shiftSegment: 'M8 7l-4 5 4 5M16 7l4 5-4 5',
        moveLeft: 'M15 19l-7-7 7-7',
        moveRight: 'M9 5l7 7-7 7',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full"><path d="${paths[name] || ''}"/></svg>`;
}
