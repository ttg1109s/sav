/**
 * event/workflow/video-editor.js — Workflow DUY NHẤT của trang `video-editor.html` v2 (23/07/2026).
 * KHÔNG dùng `appState`/`service/state.js` (cùng lý do `image-edit.html`) — state cục bộ sống trong
 * object này. Toàn bộ quyết định kiến trúc đã chốt với Giang — xem `plan-video-editor.md` mục 0
 * (KHÔNG lặp lại chi tiết ở đây).
 *
 * HỆ TOẠ ĐỘ TIMELINE (quan trọng, đọc trước khi sửa bất kỳ hàm _timelineXxx nào):
 *   - Toàn bộ track (Video/Audio/Text) dùng CHUNG 1 hệ toạ độ giây = giây GỐC của file video (0 →
 *     `_originalDuration`), KHÔNG phải giây "đã cắt". Track Video hiển thị TOÀN BỘ chiều dài gốc,
 *     2 tay cầm (`videoStart`/`videoEnd`) kéo TRỰC TIẾP trong khoảng đó (đúng cơ chế `video.txt`,
 *     GIỮ NGUYÊN — không đổi thành overlay filmstrip riêng).
 *   - Track Audio (nhạc chèn) LUÔN neo trái = `_cutRange.start` (không có vị trí tự do), độ rộng =
 *     `_cutRange.end - _cutRange.start` — tự dịch/co giãn theo mỗi khi `_cutRange` đổi (mục 4c plan).
 *   - Track Text: `timelineStart`/`timelineEnd` lưu tương đối so với `_cutRange.start` (0 = đầu đoạn
 *     ACTIVE) — vị trí HIỂN THỊ trên track = `_cutRange.start + timelineStart/End` (để luôn nằm
 *     đúng vùng KHÔNG bị cắt bỏ, dịch theo cùng `_cutRange.start` khi tay cầm videoStart bị kéo).
 *   - Playhead hiển thị tại `_cutRange.start + hoạt động hiện tại` (cùng hệ toạ độ với track Video).
 *
 * PREVIEW: canvas (KHÔNG còn `<video controls>` native) — vòng lặp vẽ qua `taskManager` mode `raf`
 * (đăng ký 1 lần lúc init, `pause()`/`resume()` theo Play/Pause — đúng tiền lệ `visualizerRender`).
 *
 * NẠP SAU: mọi core/video-editor/*.js, core/song-search.js, core/image-editor/cropper-engine.js,
 * core/dropdown-menu.js, service/task-manager.js, Cropper.js/Mediabunny/JSZip (CDN), DOM tĩnh của
 * video-editor.html (event/listener/video-editor.js khai const NGAY ĐẦU file đó).
 */
const workflowVideoEditor = {
    _videoKey: null,
    _record: null,
    _originalDuration: 0,
    _nativeW: 0,
    _nativeH: 0,
    _pixelsPerSecond: 40,

    _rotateDeg: 0,
    _cropFraction: null,
    _cropper: null,
    _cutRange: null, // {start,end} giây GỐC — set sau khi metadata load xong
    _filmstripBuilt: false,

    _textOverlay: null, // {val,size,color,posY,timelineStart,timelineEnd} | null — timelineStart/End tương đối _cutRange.start
    _song: null, // {songKey, record, offsetInSong} | null
    _songSearchQuery: '',
    _songListCache: null, // [{key,tag,duration}] — build 1 lần lúc mở panel Nhạc lần đầu
    _volumeVideo: 100, // %
    _volumeSong: 100, // %

    _isPlaying: false,
    _dragHandle: null, // 'videoStart'|'videoEnd'|'textStart'|'textMove'|'textEnd'|'audioOffsetDrag'|null
    _dragBarLeft: 0,
    _dragLastClientX: 0, // dùng riêng cho audioOffsetDrag (delta-based, xem docstring đầu file)
    _dragGrabOffsetSec: 0, // dùng riêng cho textMove (giữ nguyên khoảng cách điểm chạm ↔ mép trái clip)

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
        videoEditorSourceEl.addEventListener('loadedmetadata', () => this._onMetadataReady(), { once: true });

        taskManager.addNew('videoEditorPreviewRender', { time: 0, exe: () => this._tick(), mode: 'raf', count: 0 });
        taskManager.operator('videoEditorPreviewRender', 'enabled');
        taskManager.pause('videoEditorPreviewRender'); // chỉ chạy liên tục lúc đang Play — xem togglePlay()
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
        this._originalDuration = videoEditorSourceEl.duration || 0;
        this._cutRange = { start: 0, end: this._originalDuration };
        videoEditorSourceEl.currentTime = 0;
        videoEditorPreviewCanvasEl.width = this._nativeW;
        videoEditorPreviewCanvasEl.height = this._nativeH;
        videoEditorEmptyStateEl.classList.add('hidden');
        videoEditorPlayheadEl.classList.remove('hidden');
        videoEditorTimelineContentEl.style.width = `${this._originalDuration * this._pixelsPerSecond}px`;
        await this._buildFilmstripIfNeeded();
        this._layoutAllClips();
        this._updateTimeDisplay(0);
        this._drawFrame(); // vẽ ngay 1 khung khi đang tạm dừng
    },

    // ===================== Vòng lặp render (taskManager mode raf) =====================

    _tick() {
        if (!this._isPlaying) return;
        const activeDuration = computeActiveDuration(this._cutRange); // core/video-editor/timeline-calc.js
        const activeCur = videoEditorSourceEl.currentTime - this._cutRange.start;
        if (activeCur >= activeDuration - 0.03 || videoEditorSourceEl.ended) {
            this._pause();
            this._seekActive(activeDuration);
            return;
        }
        this._syncSongPlayback(activeCur);
        this._updateTimeDisplay(activeCur);
        this._drawFrame();
    },

    _currentFilterCss() {
        return `brightness(${sliderVeBrightness.value}%) contrast(${sliderVeContrast.value}%) saturate(${sliderVeSaturation.value}%)`;
    },

    /** Vẽ 1 khung hiện tại (crop+rotate+filter+text) lên canvas — core/video-editor/preview-draw.js. */
    _drawFrame() {
        const ctx = videoEditorPreviewCanvasEl.getContext('2d');
        const cropPx = computeCropPixels(this._cropFraction, this._nativeW, this._nativeH);
        const { outW, outH, deg } = computeRotatedOutputSize(cropPx, this._rotateDeg);
        if (videoEditorPreviewCanvasEl.width !== outW) videoEditorPreviewCanvasEl.width = outW;
        if (videoEditorPreviewCanvasEl.height !== outH) videoEditorPreviewCanvasEl.height = outH;
        drawVideoPreviewFrame(ctx, videoEditorSourceEl, cropPx, deg, this._currentFilterCss(), outW, outH);
        if (this._textOverlay) {
            const activeCur = videoEditorSourceEl.currentTime - this._cutRange.start;
            if (activeCur >= this._textOverlay.timelineStart && activeCur < this._textOverlay.timelineEnd) {
                drawTextOverlay(ctx, outW, outH, this._textOverlay);
            }
        }
    },

    _syncSongPlayback(activeCur) {
        if (!this._song) return;
        const targetTime = this._song.offsetInSong + activeCur;
        if (Math.abs(videoEditorSongAudioEl.currentTime - targetTime) > 0.15) videoEditorSongAudioEl.currentTime = targetTime;
        if (this._isPlaying && videoEditorSongAudioEl.paused) videoEditorSongAudioEl.play().catch(() => {});
    },

    _updateTimeDisplay(activeCur) {
        const activeDuration = computeActiveDuration(this._cutRange);
        videoEditorCurrentTimeEl.textContent = formatClipTimeLabel(activeCur); // core/video-editor/timeline-calc.js
        videoEditorTotalTimeEl.textContent = formatClipTimeLabel(activeDuration);
        const playheadLeft = computePlayheadLeftPx(this._cutRange.start + Math.max(0, activeCur), this._pixelsPerSecond);
        videoEditorPlayheadEl.style.left = `${playheadLeft}px`;
    },

    _seekActive(activeSeconds) {
        const clamped = Math.max(0, Math.min(activeSeconds, computeActiveDuration(this._cutRange)));
        videoEditorSourceEl.currentTime = this._cutRange.start + clamped;
        this._syncSongPlayback(clamped);
        this._updateTimeDisplay(clamped);
        this._drawFrame();
    },

    // ===================== Transport (Play/Pause/Skip) =====================

    handleTogglePlay() {
        if (this._isPlaying) this._pause(); else this._play();
    },

    _play() {
        if (!this._cutRange) return; // guard — video chưa load xong metadata
        const activeDuration = computeActiveDuration(this._cutRange);
        const activeCur = videoEditorSourceEl.currentTime - this._cutRange.start;
        if (activeCur >= activeDuration - 0.05) this._seekActive(0); // đã ở cuối -> phát lại từ đầu
        this._isPlaying = true;
        videoEditorPlayIconEl.textContent = '❚❚';
        videoEditorSourceEl.play().catch(() => {});
        this._syncSongPlayback(Math.max(0, videoEditorSourceEl.currentTime - this._cutRange.start));
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

    handleSkipStart() { this._seekActive(0); },
    handleSkipEnd() { this._seekActive(computeActiveDuration(this._cutRange)); },

    // ===================== Bottom-sheet panel (tab) =====================

    handleTabClick(targetId) {
        const isOpen = !videoEditorToolPanelEl.classList.contains('translate-y-full');
        const alreadyShowingThis = !document.getElementById(targetId).classList.contains('hidden');
        if (isOpen && alreadyShowingThis) { this._closePanel(); return; }
        this._openPanel(targetId);
    },

    _openPanel(targetId) {
        videoEditorPanelContents.forEach((p) => p.classList.add('hidden'));
        const target = document.getElementById(targetId);
        target.classList.remove('hidden');
        target.classList.add('flex');
        videoEditorPanelTitleEl.textContent = t(`videoEdit.panelTitle.${targetId}`);
        videoEditorToolPanelEl.classList.remove('translate-y-full');
        videoEditorToolTabs.forEach((tabEl) => tabEl.classList.remove('text-white'));
        const activeTab = Array.from(videoEditorToolTabs).find((tabEl) => tabEl.dataset.target === targetId);
        if (activeTab) activeTab.classList.add('text-white');
        if (targetId === 'video-editor-panel-audio') this._ensureSongListLoaded();
    },

    handlePanelClose() { this._closePanel(); },

    _closePanel() {
        videoEditorToolPanelEl.classList.add('translate-y-full');
        videoEditorToolTabs.forEach((tabEl) => tabEl.classList.remove('text-white'));
    },

    // ===================== Layout (áp toạ độ tính được lên style của clip) =====================

    _layoutAllClips() {
        this._layoutVideoClip();
        this._layoutAudioClip();
        this._layoutTextClip();
    },

    _layoutVideoClip() {
        const { leftPx, widthPx } = computeClipLayoutPx(0, this._originalDuration, this._pixelsPerSecond);
        videoEditorClipVideoEl.style.left = `${leftPx}px`;
        videoEditorClipVideoEl.style.width = `${widthPx}px`;
    },

    _layoutAudioClip() {
        if (!this._song) { videoEditorClipAudioEl.classList.add('hidden'); return; }
        videoEditorClipAudioEl.classList.remove('hidden');
        videoEditorClipAudioEl.classList.add('flex');
        const activeDuration = computeActiveDuration(this._cutRange);
        const { leftPx, widthPx } = computeClipLayoutPx(this._cutRange.start, activeDuration, this._pixelsPerSecond);
        videoEditorClipAudioEl.style.left = `${leftPx}px`;
        videoEditorClipAudioEl.style.width = `${widthPx}px`;
        videoEditorClipAudioLabelEl.textContent = this._song.record.tag.title || this._song.songKey;
    },

    _layoutTextClip() {
        if (!this._textOverlay) { videoEditorClipTextEl.classList.add('hidden'); return; }
        videoEditorClipTextEl.classList.remove('hidden');
        videoEditorClipTextEl.classList.add('flex');
        const start = this._cutRange.start + this._textOverlay.timelineStart;
        const length = this._textOverlay.timelineEnd - this._textOverlay.timelineStart;
        const { leftPx, widthPx } = computeClipLayoutPx(start, length, this._pixelsPerSecond);
        videoEditorClipTextEl.style.left = `${leftPx}px`;
        videoEditorClipTextEl.style.width = `${widthPx}px`;
        videoEditorClipTextLabelEl.textContent = this._textOverlay.val || t('videoEdit.text.defaultValue');
    },

    // ===================== Cut — kéo 2 tay cầm TRỰC TIẾP trên track Video =====================

    async _buildFilmstripIfNeeded() {
        if (this._filmstripBuilt) return;
        this._filmstripBuilt = true;
        videoEditorClipVideoFilmstripEl.innerHTML = '';
        const frames = await buildCutFilmstripFrames(this._record.blob, 14, 60, 64); // core/video-editor/filmstrip.js — TÁI DÙNG, không viết filmstrip mới
        frames.forEach((frame) => {
            if (!frame.blob) return;
            const img = document.createElement('img');
            img.className = 'h-full flex-1 object-cover opacity-70';
            img.src = URL.createObjectURL(frame.blob);
            videoEditorClipVideoFilmstripEl.appendChild(img);
        });
    },

    handleTimelineDragStart(handle, clientX) {
        this._dragHandle = handle;
        const rect = videoEditorTimelineContentEl.getBoundingClientRect();
        this._dragBarLeft = rect.left;
        this._dragLastClientX = clientX;
        if (handle === 'textMove') {
            const clipLeftPx = computeClipLayoutPx(this._cutRange.start + this._textOverlay.timelineStart, 0, this._pixelsPerSecond).leftPx;
            this._dragGrabOffsetSec = pxToSeconds(clientX - rect.left - clipLeftPx, this._pixelsPerSecond);
        } else if (handle !== 'audioOffsetDrag') {
            this.handleTimelineDragMove(clientX); // áp NGAY vị trí chạm đầu tiên — trừ audioOffsetDrag (delta-based, xem dưới)
        }
    },

    handleTimelineDragMove(clientX) {
        if (!this._dragHandle) return;
        const MIN_GAP = 0.5; // giây, khoảng cách tối thiểu giữa 2 tay cầm
        const activeDuration = computeActiveDuration(this._cutRange);

        if (this._dragHandle === 'audioOffsetDrag') {
            const deltaSec = pxToSeconds(clientX - this._dragLastClientX, this._pixelsPerSecond); // core/video-editor/timeline-calc.js
            this._dragLastClientX = clientX;
            const windowLength = computeActiveDuration(this._cutRange);
            this._song.offsetInSong = clampSongOffsetDrag(this._song.offsetInSong + deltaSec, windowLength, this._song.record.duration); // core/video-editor/audio-sync.js
            this._syncSongPlayback(Math.max(0, videoEditorSourceEl.currentTime - this._cutRange.start));
            return;
        }

        const px = clientX - this._dragBarLeft;
        const sec = pxToSeconds(px, this._pixelsPerSecond);

        if (this._dragHandle === 'videoStart') {
            this._cutRange.start = Math.max(0, Math.min(sec, this._cutRange.end - MIN_GAP));
            this._onCutRangeChanged();
        } else if (this._dragHandle === 'videoEnd') {
            this._cutRange.end = Math.min(this._originalDuration, Math.max(sec, this._cutRange.start + MIN_GAP));
            this._onCutRangeChanged();
        } else if (this._textOverlay && (this._dragHandle === 'textStart' || this._dragHandle === 'textMove' || this._dragHandle === 'textEnd')) {
            const relSec = sec - this._cutRange.start; // đổi về toạ độ TƯƠNG ĐỐI (0 = đầu đoạn active)
            if (this._dragHandle === 'textStart') {
                this._textOverlay.timelineStart = Math.max(0, Math.min(relSec, this._textOverlay.timelineEnd - MIN_GAP));
            } else if (this._dragHandle === 'textEnd') {
                this._textOverlay.timelineEnd = Math.min(activeDuration, Math.max(relSec, this._textOverlay.timelineStart + MIN_GAP));
            } else { // textMove
                const length = this._textOverlay.timelineEnd - this._textOverlay.timelineStart;
                let newStart = relSec - this._dragGrabOffsetSec;
                newStart = Math.max(0, Math.min(newStart, activeDuration - length));
                this._textOverlay.timelineStart = newStart;
                this._textOverlay.timelineEnd = newStart + length;
            }
            this._layoutTextClip();
        }
        this._hasUnsavedChanges = true;
    },

    handleTimelineDragEnd() {
        this._dragHandle = null;
    },

    /** Video vừa bị trim — layout lại track Video/Audio/Text + đồng bộ khung nhạc (mục 4c plan). */
    _onCutRangeChanged() {
        this._layoutVideoClip();
        if (this._song) {
            const activeDuration = computeActiveDuration(this._cutRange);
            const result = recalcSongWindowOnVideoTrim(this._song.offsetInSong, activeDuration, this._song.record.duration); // core/video-editor/audio-sync.js
            this._song.offsetInSong = result.offsetInSong;
            this._layoutAudioClip();
        }
        if (this._textOverlay) {
            const activeDuration = computeActiveDuration(this._cutRange);
            this._textOverlay.timelineStart = Math.max(0, Math.min(this._textOverlay.timelineStart, activeDuration));
            this._textOverlay.timelineEnd = Math.max(this._textOverlay.timelineStart, Math.min(this._textOverlay.timelineEnd, activeDuration));
            this._layoutTextClip();
        }
        const activeCur = videoEditorSourceEl.currentTime - this._cutRange.start;
        this._seekActive(Math.max(0, Math.min(activeCur, computeActiveDuration(this._cutRange))));
    },

    // ===================== Crop (Cropper.js — GIỮ NGUYÊN, xem plan mục 0.4) =====================

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
        this._updateCropBadge();
        this._drawFrame();
    },

    handleCropCancel() { this._closeCropOverlay(); },

    _closeCropOverlay() {
        if (this._cropper) { destroyCropperSession(this._cropper); this._cropper = null; }
        videoEditorCropOverlayEl.classList.add('hidden');
    },

    handleCropReset() {
        this._cropFraction = null;
        this._hasUnsavedChanges = true;
        this._updateCropBadge();
        this._drawFrame();
    },

    _updateCropBadge() {
        if (this._cropFraction) {
            videoEditorCropBadgeEl.textContent = tFormat('videoEdit.cropBadge.active', { w: Math.round(this._cropFraction.w * 100), h: Math.round(this._cropFraction.h * 100) });
            btnVeCropReset.classList.remove('hidden');
        } else {
            videoEditorCropBadgeEl.textContent = t('videoEdit.cropBadge.none');
            btnVeCropReset.classList.add('hidden');
        }
    },

    // ===================== Rotate =====================

    handleRotateLeft() {
        this._rotateDeg = ((this._rotateDeg - 90) % 360 + 360) % 360;
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    handleRotateRight() {
        this._rotateDeg = (this._rotateDeg + 90) % 360;
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    // ===================== Filter (đọc trực tiếp slider mỗi lần vẽ, xem _currentFilterCss()) =====================

    handleFilterChange() {
        this._hasUnsavedChanges = true;
        if (!this._isPlaying) this._drawFrame();
    },

    // ===================== Volume =====================
    // LƯU Ý: preview trực tiếp qua thẻ <audio>/<video> chỉ hỗ trợ .volume tối đa 1.0 (100%) —
    // khuếch đại >100% CHỈ áp dụng đúng lúc "nướng" thật (processVideo() dùng GainNode, không giới
    // hạn 1.0). Preview khi kéo slider >100% sẽ nghe như đúng 100% cho tới lúc bấm Lưu — hạn chế đã
    // biết, chấp nhận được (native volume API của trình duyệt không hỗ trợ khuếch đại).

    handleVolVideoChange(value) {
        this._volumeVideo = parseInt(value, 10) || 0;
        videoEditorVolVideoValEl.textContent = `${this._volumeVideo}%`;
        videoEditorSourceEl.volume = Math.min(1, this._volumeVideo / 100);
        this._hasUnsavedChanges = true;
    },

    handleVolSongChange(value) {
        this._volumeSong = parseInt(value, 10) || 0;
        videoEditorVolSongValEl.textContent = `${this._volumeSong}%`;
        videoEditorSongAudioEl.volume = Math.min(1, this._volumeSong / 100);
        this._hasUnsavedChanges = true;
    },

    // ===================== Trích xuất ảnh (KHÔNG đổi so với Batch 2) =====================

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

    // ===================== Nhạc chèn (panel "Nhạc" — tự viết, không Generic Drawer/appState) =====================

    async _ensureSongListLoaded() {
        if (this._songListCache) { this._renderSongList(); return; }
        const keys = await getAllSongKeys();
        this._songListCache = await Promise.all(keys.map(async (key) => {
            const record = await getSongRecord(key);
            return record ? { key, tag: record.tag, duration: record.duration } : null;
        }));
        this._songListCache = this._songListCache.filter(Boolean);
        this._renderSongList();
    },

    _renderSongList() {
        const query = this._songSearchQuery;
        const filtered = this._songListCache.filter((item) => songMatchesQuery(query, item.tag.title, item.tag.artist, item.tag.album)); // core/song-search.js — DÙNG CHUNG với Playlist
        videoEditorSongListEl.innerHTML = '';
        filtered.forEach((item) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 flex flex-col';
            row.innerHTML = `<span class="text-xs font-semibold text-white truncate">${_escapeVideoEditorHtml(item.tag.title || item.key)}</span><span class="text-[10px] text-slate-400 truncate">${_escapeVideoEditorHtml(item.tag.artist || '')}</span>`;
            // addEventListener gom cuối hàm dựng cụm DOM MỚI, callback CHỈ bắn eventBus (Rule 5a).
            row.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songSelect.click', payload: { songKey: item.key } }));
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

    async handleSongSelect(songKey) {
        const record = await getSongRecord(songKey);
        if (!record) return;
        const activeDuration = computeActiveDuration(this._cutRange);
        const result = recalcSongWindowOnVideoTrim(0, activeDuration, record.duration || 0); // core/video-editor/audio-sync.js
        this._song = { songKey, record, offsetInSong: result.offsetInSong };
        videoEditorSongAudioEl.src = URL.createObjectURL(record.blob);
        videoEditorSongAudioEl.volume = Math.min(1, this._volumeSong / 100);
        videoEditorVolSongGroupEl.classList.remove('opacity-40');
        sliderVeVolSong.disabled = false;
        btnVeRemoveSong.classList.remove('hidden');
        this._layoutAudioClip();
        this._hasUnsavedChanges = true;
        this._closePanel();
    },

    handleRemoveSong() {
        this._song = null;
        videoEditorSongAudioEl.pause();
        videoEditorSongAudioEl.src = '';
        videoEditorVolSongGroupEl.classList.add('opacity-40');
        sliderVeVolSong.disabled = true;
        btnVeRemoveSong.classList.add('hidden');
        this._layoutAudioClip();
        this._hasUnsavedChanges = true;
    },

    // ===================== Text overlay =====================

    handleAddText() {
        const activeDuration = computeActiveDuration(this._cutRange);
        this._textOverlay = {
            val: videoEditorTextValueEl.value || t('videoEdit.text.defaultValue'),
            size: parseInt(sliderVeTextSize.value, 10) || 60,
            color: videoEditorTextColorEl.value,
            posY: parseInt(sliderVeTextPosY.value, 10) || 80,
            timelineStart: 0,
            timelineEnd: Math.min(3, activeDuration),
        };
        videoEditorTextControlsEl.classList.remove('hidden');
        videoEditorTextControlsEl.classList.add('flex');
        btnVeAddText.classList.add('hidden');
        this._layoutTextClip();
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    handleRemoveText() {
        this._textOverlay = null;
        videoEditorTextControlsEl.classList.add('hidden');
        videoEditorTextControlsEl.classList.remove('flex');
        btnVeAddText.classList.remove('hidden');
        this._layoutTextClip();
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    handleTextValueInput(value) {
        if (!this._textOverlay) return;
        this._textOverlay.val = value;
        videoEditorClipTextLabelEl.textContent = value || t('videoEdit.text.defaultValue');
        this._drawFrame();
    },

    handleTextSizeChange(value) {
        if (!this._textOverlay) return;
        this._textOverlay.size = parseInt(value, 10) || 60;
        this._drawFrame();
    },

    handleTextColorChange(value) {
        if (!this._textOverlay) return;
        this._textOverlay.color = value;
        this._drawFrame();
    },

    handleTextPosYChange(value) {
        if (!this._textOverlay) return;
        this._textOverlay.posY = parseInt(value, 10) || 80;
        videoEditorTextPosYDisplayEl.textContent = `${this._textOverlay.posY}%`;
        this._drawFrame();
    },

    // ===================== Reset (chỉ Crop/Rotate/Filter — Cut/Nhạc/Chữ có nút xoá riêng) =====================

    handleReset() {
        this._cropFraction = null;
        this._rotateDeg = 0;
        sliderVeBrightness.value = 100;
        sliderVeContrast.value = 100;
        sliderVeSaturation.value = 100;
        this._updateCropBadge();
        this._hasUnsavedChanges = true;
        this._drawFrame();
    },

    // ===================== Lưu (dropdown Ghi đè | Lưu mới — Batch 4) =====================

    handleSaveClick(anchorEl) {
        openDropdownMenu(anchorEl, [ // core/dropdown-menu.js — TÁI DÙNG, không viết dropdown riêng
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4"/></svg>',
                name: t('videoEdit.save.overwrite'),
                callback: () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.saveOverwrite.click', payload: {} }),
            },
            {
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v16m8-8H4"/></svg>',
                name: t('videoEdit.save.asNew'),
                callback: () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.saveAsNew.click', payload: {} }),
            },
        ]);
    },

    /** Tham số CHUNG cho processVideo() — dùng cho cả Ghi đè/Lưu mới/Split (mục Split gọi riêng, tự override cutRange/textOverlay/songOffset theo từng đoạn). */
    _buildProcessParams(overrides) {
        return Object.assign({
            sourceBlob: this._record.blob,
            cropFraction: this._cropFraction,
            rotateDeg: this._rotateDeg,
            filterCss: this._currentFilterCss(),
            cutRange: this._cutRange,
            textOverlay: this._textOverlay,
            songBlob: this._song ? this._song.record.blob : null,
            songOffsetSeconds: this._song ? this._song.offsetInSong : 0,
            volumeVideo: this._volumeVideo / 100,
            volumeSong: this._volumeSong / 100,
        }, overrides || {});
    },

    _buildNewFilename(suffix) {
        const original = this._record.filename || 'video';
        const base = original.replace(/\.[^/.]+$/, '');
        const stamp = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${base}-${suffix || 'edit'}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`;
    },

    /** Chụp khung đầu của 1 Blob video MỚI để làm thumbBlob (lưới Video Manager) — dùng <video> tạm, KHÔNG tái dùng captureVideoFrameToCanvas() (hàm đó đọc từ videoEditorSourceEl đang mở, không phải blob mới). */
    async _buildThumbForBlob(blob) {
        const tmp = document.createElement('video');
        tmp.muted = true;
        tmp.src = URL.createObjectURL(blob);
        await new Promise((resolve) => { tmp.addEventListener('loadeddata', resolve, { once: true }); });
        const canvas = document.createElement('canvas');
        canvas.width = tmp.videoWidth;
        canvas.height = tmp.videoHeight;
        canvas.getContext('2d').drawImage(tmp, 0, 0, canvas.width, canvas.height);
        const thumbBlob = await buildExtractedPhotoThumbnail(canvas, 0.2); // core/video-editor/frame-extract.js — tái dùng
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

    // ===================== Split theo giây + nén zip (Batch 4) =====================

    handleSplitOpen() {
        if (!this._cutRange) return;
        this._pause();
        const activeDuration = computeActiveDuration(this._cutRange);
        const maxSeconds = Math.max(1, Math.floor(activeDuration / 2));
        videoEditorSplitInputLabelEl.textContent = tFormat('videoEdit.split.inputLabel', { max: maxSeconds });
        videoEditorSplitSecondsInputEl.max = String(maxSeconds);
        videoEditorSplitSecondsInputEl.value = String(Math.min(10, maxSeconds));
        videoEditorSplitModalEl.classList.remove('hidden');
        videoEditorSplitModalEl.classList.add('flex');
        videoEditorSplitSetupBoxEl.classList.remove('hidden');
        videoEditorSplitProgressBoxEl.classList.add('hidden');
    },

    handleSplitCancel() {
        videoEditorSplitModalEl.classList.add('hidden');
        videoEditorSplitModalEl.classList.remove('flex');
    },

    async handleSplitStart() {
        const activeDuration = computeActiveDuration(this._cutRange);
        const maxSeconds = Math.max(1, Math.floor(activeDuration / 2));
        const seconds = parseInt(videoEditorSplitSecondsInputEl.value, 10);
        if (!seconds || seconds < 1 || seconds > maxSeconds) { await alertModal(tFormat('videoEdit.split.invalid', { max: maxSeconds })); return; }

        videoEditorSplitSetupBoxEl.classList.add('hidden');
        videoEditorSplitProgressBoxEl.classList.remove('hidden');
        const totalSegments = Math.ceil(activeDuration / seconds);
        const zip = new JSZip();
        const baseName = this._buildNewFilename('split').replace(/\.mp4$/, '');

        try {
            for (let i = 0; i < totalSegments; i++) {
                videoEditorSplitProgressTextEl.textContent = tFormat('videoEdit.split.progress', { current: i + 1, total: totalSegments });
                const segStartActive = i * seconds;
                const segEndActive = Math.min((i + 1) * seconds, activeDuration);
                const segCutRange = { start: this._cutRange.start + segStartActive, end: this._cutRange.start + segEndActive };

                let segText = null;
                if (this._textOverlay) {
                    const ts = Math.max(this._textOverlay.timelineStart, segStartActive) - segStartActive;
                    const te = Math.min(this._textOverlay.timelineEnd, segEndActive) - segStartActive;
                    if (te > ts) segText = Object.assign({}, this._textOverlay, { timelineStart: ts, timelineEnd: te });
                }
                let segSongBlob = null;
                let segSongOffset = 0;
                if (this._song) {
                    segSongOffset = this._song.offsetInSong + segStartActive;
                    if (segSongOffset < this._song.record.duration) segSongBlob = this._song.record.blob; // hết bài hát giữa chừng -> đoạn sau không chèn nhạc nữa (giới hạn đã biết)
                }

                const blob = await processVideo(this._buildProcessParams({ cutRange: segCutRange, textOverlay: segText, songBlob: segSongBlob, songOffsetSeconds: segSongOffset }));
                zip.file(`${baseName}-part${i + 1}.mp4`, blob);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(zipBlob);
            a.download = `${baseName}.zip`;
            a.click();
            this.handleSplitCancel();
        } catch (err) {
            console.error('[handleSplitStart] Lỗi chia video:', err);
            await alertModal(t('videoEdit.split.failed'));
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

/** Escape HTML tối thiểu cho tên bài hát/nghệ sĩ hiển thị trong danh sách (dữ liệu người dùng nhập lúc thêm bài hát — KHÔNG escape trong hàm dùng chung core/song-search.js vì đó là hàm so khớp thuần, không dựng DOM). */
function _escapeVideoEditorHtml(str) {
    return (str || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
