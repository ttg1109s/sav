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
const workflowVideoEditor = {
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

    _selected: null, // {track:'video'|'audio'|'text', index}|null
    _isPlaying: false,
    _dragHandle: null, // {track,index,handleType:'start'|'end'|'move'}|null
    _dragLastClientX: 0,
    _draggingSongShift: false,
    _songShiftPxPerSec: 0,

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
        videoEditorSourceEl.addEventListener('loadedmetadata', () => this._onMetadataReady(), { once: true });

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

        this._masterFilmstripFrames = await buildCutFilmstripFrames(this._record.blob, 30, 60, 64); // core/video-editor/filmstrip.js — TRÍCH 1 LẦN duy nhất, dùng lại cho MỌI đoạn sau khi tách (lọc theo range, xem _renderVideoTrack())

        this._renderAllTracks();
        this._renderToolbar();
        this._updateTimeDisplay(0);

        // Đợi 'seeked' — đảm bảo khung tại currentTime=0 ĐÃ decode xong mới vẽ (chỉ dựa
        // loadedmetadata chưa đủ ở 1 số trình duyệt — fix bug "phải Play mới hiện hình/time").
        videoEditorSourceEl.addEventListener('seeked', () => this._drawFrame(), { once: true });
        videoEditorSourceEl.currentTime = 0.0001;
        videoEditorSourceEl.currentTime = 0;
    },

    _totalDuration() { return computeVideoTotalDuration(this._videoClips); }, // core/video-editor/timeline-calc.js
    _nextId() { return `c${this._idCounter++}`; },

    _totalRenderWidthSeconds() {
        let maxEnd = this._totalDuration();
        this._audioClips.forEach((c) => { if (c.timelineEnd > maxEnd) maxEnd = c.timelineEnd; });
        this._textClips.forEach((c) => { if (c.timelineEnd > maxEnd) maxEnd = c.timelineEnd; });
        return maxEnd;
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
        const layout = computeVideoClipsLayout(this._videoClips, this._pixelsPerSecond); // core/video-editor/timeline-calc.js
        const entry = layout[this._currentClipIndex];
        const clip = this._videoClips[this._currentClipIndex];
        if (!entry) return 0;
        return entry.outputStart + Math.max(0, videoEditorSourceEl.currentTime - clip.sourceStart);
    },

    _currentFilterCss() {
        return `brightness(${sliderVeBrightness.value}%) contrast(${sliderVeContrast.value}%) saturate(${sliderVeSaturation.value}%)`;
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
            if (outputTime >= tc.timelineStart && outputTime < tc.timelineEnd) drawTextOverlay(ctx, outW, outH, tc);
        });
    },

    /** LƯU Ý (xem docstring đầu file): preview chỉ phát ĐÚNG 1 bài hát tại 1 thời điểm. */
    _syncAudioClips(outputTime) {
        const active = this._audioClips.find((c) => outputTime >= c.timelineStart && outputTime < c.timelineEnd);
        if (!active) { videoEditorSongAudioEl.pause(); this._activePreviewAudioClipId = null; return; }
        if (this._activePreviewAudioClipId !== active.id) {
            this._activePreviewAudioClipId = active.id;
            videoEditorSongAudioEl.src = URL.createObjectURL(active.record.blob);
            videoEditorSongAudioEl.volume = Math.min(1, active.volume);
        }
        const targetTime = active.offsetInSong + (outputTime - active.timelineStart);
        if (Math.abs(videoEditorSongAudioEl.currentTime - targetTime) > 0.2) videoEditorSongAudioEl.currentTime = targetTime;
        if (this._isPlaying && videoEditorSongAudioEl.paused) videoEditorSongAudioEl.play().catch(() => {});
    },

    _updateTimeDisplay(outputTime) {
        videoEditorCurrentTimeEl.textContent = formatClipTimeLabel(outputTime); // core/video-editor/timeline-calc.js
        videoEditorTotalTimeEl.textContent = formatClipTimeLabel(this._totalDuration());
        videoEditorPlayheadEl.style.left = `${computePlayheadLeftPx(outputTime, this._pixelsPerSecond)}px`;
    },

    _seekToOutputTime(outputSeconds) {
        const total = this._totalDuration();
        const clamped = Math.max(0, Math.min(outputSeconds, total));
        const layout = computeVideoClipsLayout(this._videoClips, this._pixelsPerSecond);
        let idx = layout.findIndex((l) => clamped >= l.outputStart && clamped < l.outputEnd);
        if (idx === -1) idx = Math.max(0, layout.length - 1);
        this._currentClipIndex = idx;
        const clip = this._videoClips[idx];
        if (clip && layout[idx]) videoEditorSourceEl.currentTime = clip.sourceStart + Math.max(0, clamped - layout[idx].outputStart);
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
            [{ el: handleStart, type: 'start' }, { el: handleEnd, type: 'end' }].forEach(({ el: h, type }) => {
                h.addEventListener('pointerdown', (e) => { h.setPointerCapture(e.pointerId); eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.start', payload: { track: 'video', index, handleType: type, clientX: e.clientX } }); });
                h.addEventListener('pointermove', (e) => { if (!h.hasPointerCapture(e.pointerId)) return; eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.move', payload: { clientX: e.clientX } }); });
                h.addEventListener('pointerup', (e) => { h.releasePointerCapture(e.pointerId); eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} }); });
                h.addEventListener('pointercancel', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} }));
            });
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

            [{ el: handleStart, type: 'start' }, { el: handleEnd, type: 'end' }].forEach(({ el: h, type }) => {
                h.addEventListener('pointerdown', (e) => { h.setPointerCapture(e.pointerId); eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.start', payload: { track, index, handleType: type, clientX: e.clientX } }); });
                h.addEventListener('pointermove', (e) => { if (!h.hasPointerCapture(e.pointerId)) return; eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.move', payload: { clientX: e.clientX } }); });
                h.addEventListener('pointerup', (e) => { h.releasePointerCapture(e.pointerId); eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} }); });
                h.addEventListener('pointercancel', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} }));
            });
            // Body: PHÂN BIỆT chạm-để-CHỌN (không dịch) vs kéo-để-DI CHUYỂN (dịch đáng kể) —
            // đo khoảng dịch chuyển tại pointerup, dưới ngưỡng 4px coi là "chạm chọn".
            body.addEventListener('pointerdown', (e) => {
                body.setPointerCapture(e.pointerId);
                body._veDragStartX = e.clientX; body._veDragMoved = false;
                eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.start', payload: { track, index, handleType: 'move', clientX: e.clientX } });
            });
            body.addEventListener('pointermove', (e) => {
                if (!body.hasPointerCapture(e.pointerId)) return;
                if (Math.abs(e.clientX - body._veDragStartX) > 4) body._veDragMoved = true;
                eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.move', payload: { clientX: e.clientX } });
            });
            body.addEventListener('pointerup', (e) => {
                body.releasePointerCapture(e.pointerId);
                eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} });
                if (!body._veDragMoved) eventBus.send({ router: 'videoEdit', type: 'videoEdit.selectClip.click', payload: { track, index } });
            });
            body.addEventListener('pointercancel', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} }));

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
        const MIN_GAP = 0.3;

        if (track === 'video') {
            const clip = this._videoClips[index];
            if (!clip) return;
            if (handleType === 'start') clip.sourceStart = Math.max(0, Math.min(clip.sourceStart + deltaSec, clip.sourceEnd - MIN_GAP));
            else if (handleType === 'end') clip.sourceEnd = Math.min(this._fullSourceDuration, Math.max(clip.sourceEnd + deltaSec, clip.sourceStart + MIN_GAP));
            this._layoutVideoTrackLive();
        } else {
            const list = track === 'audio' ? this._audioClips : this._textClips;
            const clip = list[index];
            if (!clip) return;
            if (handleType === 'start') {
                clip.timelineStart = Math.max(0, Math.min(clip.timelineStart + deltaSec, clip.timelineEnd - MIN_GAP));
            } else if (handleType === 'end') {
                clip.timelineEnd = Math.max(clip.timelineEnd + deltaSec, clip.timelineStart + MIN_GAP); // KHÔNG chặn trên — cho phép kéo vượt tổng thời lượng Video (Giang yêu cầu)
            } else if (handleType === 'move') {
                const length = clip.timelineEnd - clip.timelineStart;
                clip.timelineStart = Math.max(0, clip.timelineStart + deltaSec);
                clip.timelineEnd = clip.timelineStart + length;
            }
            this._layoutSingleFreeClip(track, index);
        }
        this._hasUnsavedChanges = true;
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
        const MIN_GAP = 0.3;

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
        if (!this._selected || this._selected.track === 'video') return; // Video KHÔNG xoá được
        const { track, index } = this._selected;
        const list = track === 'audio' ? this._audioClips : this._textClips;
        list.splice(index, 1);
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
    handleFilterChange() { this._hasUnsavedChanges = true; if (!this._isPlaying) this._drawFrame(); },

    // LƯU Ý: preview qua <video>/<audio> chỉ hỗ trợ .volume tối đa 1.0 — khuếch đại >100% chỉ áp
    // dụng ĐÚNG lúc "nướng" thật (processVideo() dùng GainNode, không giới hạn 1.0).
    handleVolVideoChange(value) {
        this._volumeVideo = parseInt(value, 10) || 0;
        videoEditorVolVideoValEl.textContent = `${this._volumeVideo}%`;
        videoEditorSourceEl.volume = Math.min(1, this._volumeVideo / 100);
        this._hasUnsavedChanges = true;
    },

    handleReset() {
        this._cropFraction = null;
        this._rotateDeg = 0;
        this._volumeVideo = 100;
        sliderVeBrightness.value = 100; sliderVeContrast.value = 100; sliderVeSaturation.value = 100; sliderVeVolVideo.value = 100;
        videoEditorFilterBrightnessValEl.textContent = '100%'; videoEditorFilterContrastValEl.textContent = '100%'; videoEditorFilterSaturationValEl.textContent = '100%'; videoEditorVolVideoValEl.textContent = '100%';
        videoEditorSourceEl.volume = 1;
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    handlePropsOpen() { videoEditorPropsModalEl.classList.remove('hidden'); videoEditorPropsModalEl.classList.add('flex'); },
    handlePropsClose() { videoEditorPropsModalEl.classList.add('hidden'); videoEditorPropsModalEl.classList.remove('flex'); },

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

    // ===================== Thêm nhạc (modal chọn — thay panel bottom-sheet cũ) =====================

    handleAddMusicOpen() {
        videoEditorSongPickerModalEl.classList.remove('hidden'); videoEditorSongPickerModalEl.classList.add('flex');
        this._ensureSongListLoaded();
    },
    handleSongPickerClose() { videoEditorSongPickerModalEl.classList.add('hidden'); videoEditorSongPickerModalEl.classList.remove('flex'); },

    async _ensureSongListLoaded() {
        if (this._songListCache) { this._renderSongList(); return; }
        const keys = await getAllSongKeys();
        const records = await Promise.all(keys.map(async (key) => {
            const record = await getSongRecord(key);
            return record ? { key, tag: record.tag, duration: record.duration } : null;
        }));
        this._songListCache = records.filter(Boolean);
        this._renderSongList();
    },

    _renderSongList() {
        const query = this._songSearchQuery;
        const filtered = this._songListCache.filter((item) => songMatchesQuery(query, item.tag.title, item.tag.artist, item.tag.album)); // core/song-search.js
        videoEditorSongListEl.innerHTML = '';
        filtered.forEach((item) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 flex flex-col';
            row.innerHTML = `<span class="text-xs font-semibold text-white truncate">${_escapeVideoEditorHtml(item.tag.title || item.key)}</span><span class="text-[10px] text-slate-400 truncate">${_escapeVideoEditorHtml(item.tag.artist || '')}</span>`;
            row.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songPicker.select', payload: { songKey: item.key } }));
            videoEditorSongListEl.appendChild(row);
        });
    },

    handleSongSearchInput(value) {
        this._songSearchQuery = normalizeSongName(value); // core/song-search.js
        btnVeSongSearchClear.classList.toggle('hidden', !value);
        this._renderSongList();
    },

    handleSongSearchClear() {
        videoEditorSongSearchInputEl.value = '';
        btnVeSongSearchClear.classList.add('hidden');
        this._songSearchQuery = '';
        this._renderSongList();
        videoEditorSongSearchInputEl.focus();
    },

    async handleSongPickerSelect(songKey) {
        const record = await getSongRecord(songKey);
        if (!record) return;
        const outputTime = this._computeCurrentOutputTime();
        const length = Math.min(10, record.duration || 10);
        this._audioClips.push({ id: this._nextId(), songKey, record, timelineStart: outputTime, timelineEnd: outputTime + length, offsetInSong: 0, volume: 1 });
        this._selected = { track: 'audio', index: this._audioClips.length - 1 };
        this.handleSongPickerClose();
        this._hasUnsavedChanges = true;
        this._renderAllTracks();
        this._renderToolbar();
    },

    // ===================== Chữ (Text overlay đa-clip) =====================

    handleAddText() {
        const outputTime = this._computeCurrentOutputTime();
        this._textClips.push({ id: this._nextId(), val: t('videoEdit.text.defaultValue'), size: 60, color: '#ffffff', posY: 80, timelineStart: outputTime, timelineEnd: outputTime + 3 });
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
        videoEditorTextValueEl.value = clip.val;
        sliderVeTextSize.value = clip.size;
        videoEditorTextColorEl.value = clip.color;
        sliderVeTextPosY.value = clip.posY;
        videoEditorTextPosYDisplayEl.textContent = `${clip.posY}%`;
        videoEditorTextEditModalEl.classList.remove('hidden'); videoEditorTextEditModalEl.classList.add('flex');
    },

    handleTextEditClose() {
        videoEditorTextEditModalEl.classList.add('hidden'); videoEditorTextEditModalEl.classList.remove('flex');
        this._renderAllTracks();
        this._drawFrame();
    },

    handleTextValueInput(value) { const c = this._activeTextClip(); if (!c) return; c.val = value; this._hasUnsavedChanges = true; },
    handleTextSizeChange(value) { const c = this._activeTextClip(); if (!c) return; c.size = parseInt(value, 10) || 60; this._hasUnsavedChanges = true; this._drawFrame(); },
    handleTextColorChange(value) { const c = this._activeTextClip(); if (!c) return; c.color = value; this._hasUnsavedChanges = true; this._drawFrame(); },
    handleTextPosYChange(value) {
        const c = this._activeTextClip(); if (!c) return;
        c.posY = parseInt(value, 10) || 80;
        videoEditorTextPosYDisplayEl.textContent = `${c.posY}%`;
        this._hasUnsavedChanges = true; this._drawFrame();
    },

    // ===================== "Dịch chuyển tới đoạn" (chọn đoạn nhạc gốc + âm lượng riêng clip) =====================

    _activeAudioClip() { return this._selected && this._selected.track === 'audio' ? this._audioClips[this._selected.index] : null; },

    handleSongShiftOpen() {
        const clip = this._activeAudioClip();
        if (!clip) return;
        videoEditorSongShiftModalEl.classList.remove('hidden'); videoEditorSongShiftModalEl.classList.add('flex');
        sliderVeClipVolume.value = Math.round(clip.volume * 100);
        videoEditorClipVolumeValEl.textContent = `${Math.round(clip.volume * 100)}%`;
        this._renderSongShiftBar();
    },

    _renderSongShiftBar() {
        const clip = this._activeAudioClip();
        if (!clip) return;
        const barWidth = videoEditorSongShiftBarWrapEl.clientWidth || 300;
        const songDuration = clip.record.duration || 1;
        this._songShiftPxPerSec = barWidth / songDuration;
        const clipLength = clip.timelineEnd - clip.timelineStart;
        videoEditorSongShiftWindowEl.style.left = `${clip.offsetInSong * this._songShiftPxPerSec}px`;
        videoEditorSongShiftWindowEl.style.width = `${Math.max(8, clipLength * this._songShiftPxPerSec)}px`;
        videoEditorSongShiftTimeLabelEl.textContent = `${formatClipTimeLabel(clip.offsetInSong)} / ${formatClipTimeLabel(songDuration)}`;
    },

    handleSongShiftDragStart(clientX) { this._dragLastClientX = clientX; this._draggingSongShift = true; },

    handleSongShiftDragMove(clientX) {
        if (!this._draggingSongShift) return;
        const clip = this._activeAudioClip();
        if (!clip) return;
        const deltaSec = (clientX - this._dragLastClientX) / (this._songShiftPxPerSec || 1);
        this._dragLastClientX = clientX;
        const clipLength = clip.timelineEnd - clip.timelineStart;
        clip.offsetInSong = clampSongOffsetDrag(clip.offsetInSong + deltaSec, clipLength, clip.record.duration || 0); // core/video-editor/audio-sync.js
        this._renderSongShiftBar();
        this._hasUnsavedChanges = true;
    },

    handleSongShiftDragEnd() { this._draggingSongShift = false; },

    handleClipVolumeChange(value) {
        const clip = this._activeAudioClip();
        if (!clip) return;
        clip.volume = (parseInt(value, 10) || 0) / 100;
        videoEditorClipVolumeValEl.textContent = `${value}%`;
        this._hasUnsavedChanges = true;
    },

    handleSongShiftClose() {
        videoEditorSongShiftModalEl.classList.add('hidden'); videoEditorSongShiftModalEl.classList.remove('flex');
        this._renderAllTracks();
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
