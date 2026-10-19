/**
 * event/workflow/video-preview.js — Workflow "videoPreview" của trang video-editor.html (không nạp ở index.html).
 * Trình sửa Video kiểu Story: thẻ video khít đúng tỉ lệ nội dung (`_fitCardToContent()`), hàng công cụ ngang ở đáy thẻ,
 * dải seek ngoài màn xem (`handleOuterSeekPointerDown()`/`_renderOuterSeek()`, chạy trong đoạn Start..End).
 *
 * Vào trang = `bootFromUrl()` (?video=<key mã hoá>, service/song-key-cipher.js); "đóng" = quay về index.html
 * (`_reallyClose()` -> `_leaveToPlaylist()`, cuộn tới đúng item qua localStorage `sav_editingSubtitle` +
 * `sav_scrollToSongKey` — cùng cơ chế subtitle-editor.html, xem event/listener/render.js).
 *
 * `open()` bọc TOÀN BỘ trong `withLoadingShield()` (core/loading-shield-util.js) — chỉ tắt shield SAU KHI modal đã dựng
 * xong VÀ đã có metadata thật; `<video>` không có metadata sau VIDEO_PREVIEW_METADATA_TIMEOUT_MS -> báo + quay về.
 * Hiện % lúc tải (chuẩn bị + trích dải phim) và lúc xuất (tiến độ Conversion + chụp thumb/ghi DB).
 *
 * Công cụ: ĐÚNG 1 công cụ tại 1 thời điểm (`videoPreviewActiveTool` 'none'|'trim'|'crop'), thoát qua Huỷ/Xong ở topbar
 * (`handleToolOpen/Cancel/Done`). Snapshot trước khi mở công cụ (`_beforeToolSnapshot`) dùng CHUNG cho Cắt lẫn Cắt
 * khung — Huỷ khôi phục cả cờ `videoPreviewHasUnsavedChanges`. Không có Undo/Redo; Đặt lại (menu "•••",
 * `handleMoreClick`) phải xác nhận qua `modalChoice()`. Xoay/Lật áp LIVE lên `<video>` (+ canvas Crop khi đang Cắt
 * khung). Nút Chụp lưu khung hiện tại thành ảnh (workflowVideoFrameCapture). Không có zoom-pan.
 *
 * Xuất: `Mediabunny.Conversion` (core/video-editor/webcodecs-engine.js) ghi thẳng vào file tạm OPFS
 * (core/video-editor/opfs-temp.js; không hỗ trợ -> RAM). Mediabunny nạp OFFLINE từ assets/vendor/mediabunny.js (+ tuỳ
 * chọn assets/vendor/mediabunny-aac-encoder.js khi máy không tự encode được AAC). Lưu 2 bước: viên chọn kiểu lưu
 * (`handleSaveModeClick` -> Lưu đè / Video mới, state `videoPreviewSaveMode`, mặc định 'asNew') + nút "Lưu"
 * (`handleSaveClick` -> `_runSave()`), toàn bộ trong shield. Thumb qua workflowVideoThumbExtract; Lưu đè qua
 * `replaceVideoMedia()`; Video mới vào folder Video đang Scope (meta `activePlayListFolder`). Xong: báo rồi quay về,
 * cuộn tới video vừa lưu.
 *
 * `this._modalHandle`/`this._beforeToolSnapshot`/`this._resolveMetadataReady` giữ TRỰC TIẾP trên object Workflow (KHÔNG
 * qua appState — không phải dữ liệu nghiệp vụ tuần tự hoá được).
 *
 * NẠP SAU: core/file-manager/video-ui.js, core/media-transform.js, core/video-editor/compat-guard.js/filmstrip.js/
 * webcodecs-engine.js, core/video-player-capture.js, core/file-manager/video.js/image.js, core/dynamic-object-ui.js,
 * core/video-editor/opfs-temp.js, service/state/video-preview.js, service/blob-url.js, event/workflow/media-transform-helpers.js,
 * event/workflow/timeout.js.
 */
// Dải phim 10 ô (giữ trong RAM): mốc ô thứ i = i × thời lượng/10 (core/video-editor/filmstrip.js). Ô nào không trích được ảnh: tạm hiện ảnh của ô gần
// nhất (không để ô đen), rồi trích LẠI ở giữa ô khi thả tay cầm Start/End (`_refillMissingFilmstripFrames()`).
const FILMSTRIP_FRAME_COUNT = 10;
const FILMSTRIP_THUMB_H = 56;              // = chiều cao dải phim (assets/css/video-preview.css)
const FILMSTRIP_REFILL_OFFSET = 0.5;       // trích lại tại GIỮA ô (mốc đầu ô đã không có khung)
const MIN_TRIM_DURATION = 0.3; // giây — khoảng cách tối thiểu giữa Start/End

const VIDEO_EDIT_TEMP_WRITABLE_TIMEOUT_MS = 10000; // createWritable() file tạm OPFS có thể treo thay vì lỗi trên vài bản Safari
const VIDEO_PREVIEW_METADATA_TIMEOUT_MS = 15000; // quá hạn chờ `<video>` báo metadata thì coi như hỏng, không kẹt shield

/** Nạp 1 file script cục bộ (core/dynamic-object-ui.js::loadScriptFile()). Thành công thì nhớ lại (không nạp lần 2);
 * THẤT BẠI thì KHÔNG nhớ — chép file vào assets/vendor/ sau lần mở đầu vẫn nạp lại được mà không cần tải lại trang.
 * Lỗi CHẠY script (nhầm bản .mjs/ESM hoặc bản Node — vẫn "load" nhưng không tạo biến global) trả về `runError` để báo
 * đúng nguyên nhân lên màn hình.
 * @param {string} src @returns {Promise<{loaded: boolean, runError: (string|null)}>} */
function _loadVideoEditorScriptOnce(src) {
    window._videoEditorScriptPromises = window._videoEditorScriptPromises || {};
    window._videoEditorScriptRetry = window._videoEditorScriptRetry || {};
    if (window._videoEditorScriptPromises[src]) return window._videoEditorScriptPromises[src];
    // Lần thử lại sau 1 lần hỏng: thêm tham số chống cache — không thì trình duyệt trả lại đúng bản file sai đã nhớ.
    const url = window._videoEditorScriptRetry[src] ? `${src}?retry=${Date.now()}` : src;
    const promise = loadScriptFile(src, url).then(({ loaded, runError, el }) => { // core/dynamic-object-ui.js
        if (!loaded) console.error(`[_loadVideoEditorScriptOnce] không tìm thấy/không tải được "${src}"`);
        if (!loaded || runError || (src === MEDIABUNNY_VENDOR_PATH && !window.Mediabunny)) { // lần sau thử lại từ đầu
            removeScriptElement(el); // core/dynamic-object-ui.js
            delete window._videoEditorScriptPromises[src];
            window._videoEditorScriptRetry[src] = true;
        }
        return { loaded, runError };
    });
    window._videoEditorScriptPromises[src] = promise;
    return promise;
}

const MEDIABUNNY_VENDOR_PATH = '../assets/vendor/mediabunny.js'; // tương đối với pages/video-editor.html

/** Nạp Mediabunny OFFLINE (chỉ file cục bộ assets/vendor/). Trả LÝ DO cụ thể để thông báo chỉ đúng chỗ sai:
 *   'mediabunnyMissing'    — không tìm thấy file (sai tên/sai thư mục/chưa chép).
 *   'mediabunnyWrongBuild' — file có nhưng không tạo `window.Mediabunny` (tải nhầm bản .mjs/ESM hoặc
 *                            bản cho Node; cần bản `dist/bundles/mediabunny.cjs`). Kèm lỗi chạy script.
 *   'mediabunnyTooOld'     — thiếu tính năng lật (`VideoSample.prototype.setFlip`, có từ 1.57.0).
 * Kèm tuỳ chọn gói encoder AAC (WASM) CHỈ khi máy không tự encode được AAC — thiếu file đó thì bỏ qua.
 * @returns {Promise<{ok: boolean, reason?: string, detail?: string}>} */
async function _ensureMediabunnyLoaded() {
    if (!window.Mediabunny) {
        const r = await _loadVideoEditorScriptOnce(MEDIABUNNY_VENDOR_PATH);
        if (!r.loaded) return { ok: false, reason: 'mediabunnyMissing' };
        if (!window.Mediabunny) {
            console.error('[_ensureMediabunnyLoaded] file đã tải nhưng không có window.Mediabunny:', r.runError);
            return { ok: false, reason: 'mediabunnyWrongBuild', detail: r.runError || '' };
        }
    }
    if (!(Mediabunny.VideoSample && Mediabunny.VideoSample.prototype && typeof Mediabunny.VideoSample.prototype.setFlip === 'function')) {
        // Quên bản đã nạp để lần mở sau nạp lại file (chép đè bản mới không cần tải lại trang).
        window.Mediabunny = undefined;
        delete window._videoEditorScriptPromises[MEDIABUNNY_VENDOR_PATH];
        window._videoEditorScriptRetry[MEDIABUNNY_VENDOR_PATH] = true;
        return { ok: false, reason: 'mediabunnyTooOld' };
    }
    if (!window._videoEditorAacChecked) {
        window._videoEditorAacChecked = true;
        try {
            const aacOk = await Mediabunny.canEncodeAudio('aac');
            if (!aacOk) {
                const r = await _loadVideoEditorScriptOnce('../assets/vendor/mediabunny-aac-encoder.js');
                if (r.loaded && window.MediabunnyAacEncoder) {
                    MediabunnyAacEncoder.registerAacEncoder();
                    console.log('[_ensureMediabunnyLoaded] đã đăng ký encoder AAC (WASM) cho máy không tự encode được AAC');
                }
            }
        } catch (err) {
            console.warn('[_ensureMediabunnyLoaded] kiểm tra/đăng ký encoder AAC lỗi (bỏ qua):', err);
        }
    }
    return { ok: true };
}

function _formatVideoPreviewTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Icon dùng riêng cho dropdown Lưu (core/dropdown-menu.js — nhận sẵn chuỗi SVG, không tự build). */
function _svgIcon(name) {
    return iconSvg(name, 'h-5 w-5'); // core/theme/icon-svg-ui.js — kho icon chung
}

const workflowVideoPreview = {
    _modalHandle: null,
    _beforeToolSnapshot: null, // { snapshot, hadUnsaved } lúc mở Cắt/Cắt khung — Huỷ khôi phục (không có Undo/Redo)
    _resolveMetadataReady: null,
    _filmstripUrls: [], // blob URL ảnh dải phim, revoke khi đóng modal
    _filmstripRefilling: false, // đang trích lại ô thiếu ảnh (chỉ 1 lượt 1 lúc)
    _dragResumePlay: false, // video đang play hay pause TRƯỚC khi kéo tay cầm/tua — nhả tay chỉ tự play lại nếu trước đó đang play

    /** Cập nhật dòng chữ shield thành "... N%". @param {string} key @param {number} percent */
    _setShieldPercent(key, percent) {
        loadingText.textContent = tFormat(key, { percent: Math.max(0, Math.min(100, Math.round(percent))) }); // dom-refs (tiền lệ workflowPlaylist.uploadVideos())
    },

    /** Vào trang video-editor.html: đọc `?video=` rồi mở editor; không mở được -> báo (open() tự báo
     * lý do) rồi quay về Playlist. Gọi 1 lần từ event/listener/video-preview.js qua router. */
    async bootFromUrl() {
        const encoded = new URLSearchParams(window.location.search).get('video');
        const videoKey = encoded ? decodeSongKeyFromUrl(encoded) : null; // service/song-key-cipher.js
        if (!videoKey) { await alertModal(t('videoPreview.videoNotFound')); this._leaveToPlaylist(null); return; } // guard: link hỏng
        const opened = await this.open(videoKey);
        if (!opened) this._leaveToPlaylist(videoKey);
    },

    /** @param {string} videoKey @returns {Promise<boolean>} true = editor đã mở */
    async open(videoKey) {
        let failKey = null; // key thông báo lỗi — báo SAU khi shield tắt
        let failDetail = ''; // chi tiết kỹ thuật kèm theo (vd lỗi chạy file thư viện) — hiện luôn lên màn hình
        await withLoadingShield(tFormat('videoPreview.loadingPercent', { percent: 0 }), async () => { // core/loading-shield-util.js
            const pct = (p) => this._setShieldPercent('videoPreview.loadingPercent', p);
            const record = await getVideoRecord(videoKey); // service/db.js — Workflow đọc (Rule 3b)
            if (!record) { failKey = 'videoPreview.videoNotFound'; return; }
            pct(5);

            const lib = await _ensureMediabunnyLoaded();
            if (!lib.ok) { failKey = `videoPreview.compat.${lib.reason}`; failDetail = lib.detail || ''; return; }
            pct(15);

            const compat = await checkVideoEditorCompat(record.blob); // core/video-editor/compat-guard.js
            if (!compat.supported) { failKey = `videoPreview.compat.${compat.reason}`; return; }
            pct(25);

            const videoUrl = createBlobUrl(record.blob); // service/blob-url.js — Workflow tạo (Rule 3b)
            const posterUrl = createBlobUrl(record.thumbBlob); // service/blob-url.js
            const ratioPresets = workflowMediaTransformHelpers.getPresets(); // event/workflow/media-transform-helpers.js

            appState.set('videoPreviewVideoKey', videoKey);
            appState.set('videoPreviewRecord', record);
            appState.set('videoPreviewRotateDeg', 0);
            appState.set('videoPreviewFlipH', false);
            appState.set('videoPreviewHasUnsavedChanges', false);
            appState.set('videoPreviewFilmstripFrames', []);
            appState.set('videoPreviewCropSession', null);
            appState.set('videoPreviewActiveDrag', null);
            appState.set('videoPreviewActiveTool', 'none');
            appState.set('videoPreviewSaveMode', 'asNew');
            appState.set('videoPreviewIsPlaying', false);

            const metadataReadyPromise = new Promise((resolve) => { this._resolveMetadataReady = resolve; });
            const metadataTimeout = taskManager.once(() => this.handleMetadataFailed(), VIDEO_PREVIEW_METADATA_TIMEOUT_MS); // service/task-manager.js
            this._modalHandle = openVideoPreviewModal({ videoUrl, posterUrl, filename: record.filename, saveMode: 'asNew', ratioPresets }); // core/file-manager/video-ui.js

            const metadataOk = await metadataReadyPromise; // true = crop/trim đã dựng xong; false = `<video>` lỗi/quá hạn
            metadataTimeout.kill();
            if (!metadataOk) { this._disposeModal(); failKey = 'videoPreview.metadataFailed'; return; } // chỉ dọn, bootFromUrl() tự quay về sau khi báo
            pct(35);

            // Dải phim trích TRONG shield (hiện % lúc tải video vào edit) — bước tốn
            // thời gian nhất, % chạy 35 -> 100 theo từng khung trích xong.
            try {
                await this._renderFilmstripFrames((done, total) => pct(35 + (done / (total || 1)) * 65));
            } catch (err) {
                console.error('[workflowVideoPreview.open] trích dải phim lỗi, vẫn mở modal không có ảnh nền dải phim:', err);
            }
            pct(100);
        });
        if (failKey) await alertModal(failDetail ? `${t(failKey)}\n\n${failDetail}` : t(failKey));
        return !failKey;
    },

    /** Ứng với 'videoPreview.metadata.loaded' — `<video>` vừa biết xong kích thước/thời lượng thật. */
    async handleMetadataLoaded() {
        if (!this._modalHandle) return; // guard — modal đã đóng (vd quá hạn chờ) trước khi metadata tới muộn
        const videoEl = this._modalHandle.videoEl;
        const w = videoEl.videoWidth, h = videoEl.videoHeight, duration = videoEl.duration || 0;
        appState.set('videoPreviewNativeW', w);
        appState.set('videoPreviewNativeH', h);
        appState.set('videoPreviewSourceDuration', duration);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', duration);

        this._modalHandle.cropCanvasEl.width = w;
        this._modalHandle.cropCanvasEl.height = h;
        const cropSession = initCropSession(w, h, { padRatio: 0 }); // core/media-transform.js — full-frame, không crop cho tới khi tự kéo
        appState.set('videoPreviewCropSession', cropSession);

        // Chuyển từ poster tĩnh sang video thật (đứng yên tại khung hình 0 — KHÔNG auto-play).
        this._modalHandle.posterEl.classList.add('hidden');
        this._modalHandle.videoEl.classList.remove('hidden');

        this._renderTrimPositions();
        this._renderTransformPreview(); // thẻ video khít tỉ lệ ngay khi biết kích thước thật

        if (this._resolveMetadataReady) { this._resolveMetadataReady(true); this._resolveMetadataReady = null; }
    },

    /** Ứng với 'videoPreview.metadata.failed' (`<video>` báo 'error') HOẶC quá hạn chờ metadata
     * (taskManager.once trong `open()`) — nhả promise chờ với `false`, `open()` tự đóng modal + báo. */
    handleMetadataFailed() {
        if (this._resolveMetadataReady) { this._resolveMetadataReady(false); this._resolveMetadataReady = null; }
    },

    /** Trích ảnh nền dải phim (10 ô, xem FILMSTRIP_FRAME_COUNT) — chạy TRONG shield của `open()`, báo tiến độ. Ảnh giữ
     * trong RAM: `videoPreviewFilmstripFrames` = 10 ô `{blob, url}` (url = blob URL tạo 1 lần, revoke lúc đóng).
     * @param {(done:number, total:number) => void} [onProgress] */
    async _renderFilmstripFrames(onProgress) {
        const record = appState.get('videoPreviewRecord');
        const size = this._computeFilmstripThumbSize();
        const frames = await buildCutFilmstripFrames(record.blob, FILMSTRIP_FRAME_COUNT, size.w, size.h, onProgress); // core/video-editor/filmstrip.js
        if (!this._modalHandle) return; // guard: modal đã đóng trước khi trích xong
        const slots = Array.from({ length: FILMSTRIP_FRAME_COUNT }, () => ({ blob: null, url: null, refilled: false }));
        frames.forEach((frame) => this._storeFilmstripFrame(slots, frame));
        appState.set('videoPreviewFilmstripFrames', slots);
        this._renderFilmstripCells();
    },

    /** Kích thước 1 ảnh ô dải phim theo tỉ lệ video gốc. @returns {{w:number, h:number}} */
    _computeFilmstripThumbSize() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        return { w: Math.max(30, Math.round(FILMSTRIP_THUMB_H * (w / (h || 1)))), h: FILMSTRIP_THUMB_H };
    },

    /** Ghi 1 khung vừa trích vào ô của nó (tạo blob URL 1 lần). @param {Array} slots @param {{index:number, blob:Blob|null}} frame */
    _storeFilmstripFrame(slots, frame) {
        const slot = slots[frame.index];
        if (!slot || !frame.blob) return; // guard: ô lạ / khung không trích được
        slot.blob = frame.blob;
        slot.url = createBlobUrl(frame.blob); // service/blob-url.js — revoke ở _disposeModal()
        this._filmstripUrls.push(slot.url);
    },

    /** Vẽ lại 10 ô từ RAM: ô thiếu ảnh mượn ảnh của ô gần nhất có ảnh (không còn dải đen).
     * #video-preview-filmstrip-frames TÁCH RIÊNG khỏi #video-preview-filmstrip-track — track không overflow:hidden nên 2
     * tay cầm ở 0%/100% không bị cắt mất nửa; container riêng này mới overflow:hidden để bo góc. */
    _renderFilmstripCells() {
        const slots = appState.get('videoPreviewFilmstripFrames');
        const framesEl = this._modalHandle.filmstripFramesEl;
        framesEl.innerHTML = '';
        slots.forEach((slot, i) => {
            const cell = document.createElement('div');
            cell.className = 'video-preview-filmstrip-frame';
            const url = slot.url || this._nearestFilmstripUrl(slots, i);
            cell.style.backgroundImage = url ? `url(${url})` : '';
            framesEl.appendChild(cell);
        });
    },

    /** URL ảnh của ô gần ô `index` nhất (trái trước, phải sau, xa dần). @returns {string|null} */
    _nearestFilmstripUrl(slots, index) {
        for (let d = 1; d < slots.length; d++) {
            const left = slots[index - d], right = slots[index + d];
            if (left && left.url) return left.url;
            if (right && right.url) return right.url;
        }
        return null;
    },

    /** Thả tay cầm Start/End: ô nào vẫn thiếu ảnh
     * (và chưa trích lại lần nào) được trích LẠI ở giữa ô, chạy nền (không shield), xong vẽ lại dải. Mỗi ô chỉ thử lại 1
     * lần — vẫn không có khung thì giữ ảnh mượn của ô gần nhất. */
    async _refillMissingFilmstripFrames() {
        if (this._filmstripRefilling) return; // guard: đang có 1 lượt trích lại
        const slots = appState.get('videoPreviewFilmstripFrames');
        const indices = slots.map((slot, i) => (!slot.url && !slot.refilled ? i : -1)).filter((i) => i >= 0);
        if (indices.length === 0) return; // guard: dải đã đủ ảnh
        this._filmstripRefilling = true;
        indices.forEach((i) => { slots[i].refilled = true; });
        try {
            const size = this._computeFilmstripThumbSize();
            const frames = await buildCutFilmstripFrames(appState.get('videoPreviewRecord').blob, FILMSTRIP_FRAME_COUNT, size.w, size.h, null, { indices, offsetFraction: FILMSTRIP_REFILL_OFFSET }); // core/video-editor/filmstrip.js
            if (!this._modalHandle) return; // guard: đã rời editor trong lúc trích
            frames.forEach((frame) => this._storeFilmstripFrame(slots, frame));
            this._renderFilmstripCells();
        } catch (err) {
            console.error('[workflowVideoPreview._refillMissingFilmstripFrames] trích lại ô thiếu ảnh lỗi (giữ ảnh mượn):', err);
        } finally {
            this._filmstripRefilling = false;
        }
    },

    /** Vị trí 2 tay cầm Start/End + 2 dim + viền — tính lại mỗi lần cutStart/cutEnd đổi. */
    _renderTrimPositions() {
        const duration = appState.get('videoPreviewSourceDuration');
        if (duration <= 0) return;
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        const trackWidth = this._modalHandle.filmstripTrackEl.getBoundingClientRect().width || 1;
        const leftPx = (cutStart / duration) * trackWidth;
        const rightPx = (1 - cutEnd / duration) * trackWidth;

        this._modalHandle.dimLeftEl.style.width = `${leftPx}px`;
        this._modalHandle.dimRightEl.style.width = `${rightPx}px`;
        this._modalHandle.rangeBorderEl.style.left = `${leftPx}px`;
        this._modalHandle.rangeBorderEl.style.right = `${rightPx}px`;
        this._modalHandle.startHandleEl.style.left = `${leftPx}px`;
        this._modalHandle.endHandleEl.style.left = `${trackWidth - rightPx}px`;
        this._modalHandle.trimLengthLabelEl.textContent = _formatVideoPreviewTime(cutEnd - cutStart); // độ dài đoạn đang chọn (panel Cắt)
        this._renderOuterSeek(this._modalHandle.videoEl.currentTime); // độ dài đoạn đổi -> dải seek ngoài đổi theo
    },

    // ===================== Cut: tay cầm Start/End =====================

    /** @param {string} handle - 'start' | 'end' */
    handleTrimDragStart(handle) {
        this._dragResumePlay = appState.get('videoPreviewIsPlaying'); // nhớ lại TRƯỚC khi pause
        appState.set('videoPreviewActiveDrag', handle);
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
    },

    /** Ấn/tua trong dải phim (NGOÀI 2 tay cầm Start/End) — nhảy playhead tới đó ngay, kéo tiếp thì
     * tua tiếp. Bắn TỪ `filmstripTrackEl` nên bubbling qua CẢ click trên tay
     * cầm Start/End (do 2 tay cầm là con của track) — Workflow tự đọc `videoPreviewActiveDrag` đã bị
     * handler của tay cầm (chạy TRƯỚC, cùng sự kiện pointerdown) chiếm chưa để bỏ qua, KHÔNG tua đè.
     * @param {number} clientX */
    handleTrimTrackPointerDown(clientX) {
        if (appState.get('videoPreviewActiveDrag')) return; // tay cầm Start/End đã xử lý trước đó rồi
        this._dragResumePlay = appState.get('videoPreviewIsPlaying');
        appState.set('videoPreviewActiveDrag', 'seek');
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
        this._seekToClientX(clientX);
    },

    /** @param {number} clientX */
    _seekToClientX(clientX) {
        const duration = appState.get('videoPreviewSourceDuration');
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        const rect = this._modalHandle.filmstripTrackEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const time = Math.max(cutStart, Math.min(cutEnd, fraction * duration)); // giới hạn trong đoạn đang cắt, khớp hành vi lặp ở handleVideoTimeUpdate
        this._modalHandle.videoEl.currentTime = time;
        this._renderPlayheadPosition(time);
    },

    /** @param {number} clientX */
    handleTrimDragMove(clientX) {
        const activeDrag = appState.get('videoPreviewActiveDrag');
        if (!activeDrag) return; // bắn liên tục từ document, guard bình thường
        if (activeDrag === 'seek') { this._seekToClientX(clientX); return; }
        if (activeDrag === 'outerSeek') { this._seekOuterToClientX(clientX); return; } // dải seek ngoài

        const duration = appState.get('videoPreviewSourceDuration');
        const rect = this._modalHandle.filmstripTrackEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const time = fraction * duration;
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');

        if (activeDrag === 'start') {
            const newStart = Math.min(time, cutEnd - MIN_TRIM_DURATION);
            appState.set('videoPreviewCutStart', newStart);
            this._modalHandle.videoEl.currentTime = newStart; // seek thật — hiện khung hình thật, không phải ảnh tĩnh
        } else {
            const newEnd = Math.max(time, cutStart + MIN_TRIM_DURATION);
            appState.set('videoPreviewCutEnd', newEnd);
            this._modalHandle.videoEl.currentTime = newEnd;
        }
        this._renderTrimPositions();
    },

    handleTrimDragEnd() {
        const activeDrag = appState.get('videoPreviewActiveDrag');
        appState.set('videoPreviewActiveDrag', null);
        if (!activeDrag) return;
        if (activeDrag !== 'seek' && activeDrag !== 'outerSeek') appState.set('videoPreviewHasUnsavedChanges', true); // tua thuần không phải thao tác sửa
        this._refillFilmstripAfterHandleDrag(activeDrag);
        if (this._dragResumePlay) { // CHỈ tự play lại nếu TRƯỚC đó đang play
            this._modalHandle.videoEl.play().catch(() => {});
            appState.set('videoPreviewIsPlaying', true);
        }
    },

    /** Chỉ sau khi thả tay cầm Start/End (không phải tua). @param {string} activeDrag */
    _refillFilmstripAfterHandleDrag(activeDrag) {
        if (activeDrag !== 'start' && activeDrag !== 'end') return; // guard: tua dải phim/dải seek ngoài
        this._refillMissingFilmstripFrames();
    },

    // ===================== Cut: phát/tạm dừng =====================

    /** @param {number} currentTime */
    handleVideoTimeUpdate(currentTime) {
        const cutEnd = appState.get('videoPreviewCutEnd');
        const cutStart = appState.get('videoPreviewCutStart');
        if (currentTime >= cutEnd) this._modalHandle.videoEl.currentTime = cutStart; // lặp trong đoạn cắt
        this._renderPlayheadPosition(currentTime);
    },

    /** @param {number} currentTime */
    _renderPlayheadPosition(currentTime) {
        const duration = appState.get('videoPreviewSourceDuration');
        if (duration <= 0) return;
        const trackWidth = this._modalHandle.filmstripTrackEl.getBoundingClientRect().width || 1;
        this._modalHandle.playheadEl.style.left = `${(currentTime / duration) * trackWidth}px`;
        this._modalHandle.currentTimeLabelEl.textContent = _formatVideoPreviewTime(currentTime);
        this._renderOuterSeek(currentTime);
    },

    // ===================== Dải seek ngoài màn xem =====================

    /** 'videoPreview.outerSeek.pointerDown' — chạm/kéo dải seek ngoài: tua trong đoạn Start..End (kéo tiếp đi qua
     * 'videoPreview.trimDrag.move' như dải phim, `videoPreviewActiveDrag` = 'outerSeek'). @param {number} clientX */
    handleOuterSeekPointerDown(clientX) {
        if (!this._modalHandle || appState.get('videoPreviewSourceDuration') <= 0) return; // guard: chưa có metadata
        this._dragResumePlay = appState.get('videoPreviewIsPlaying');
        appState.set('videoPreviewActiveDrag', 'outerSeek');
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
        this._seekOuterToClientX(clientX);
    },

    /** @param {number} clientX */
    _seekOuterToClientX(clientX) {
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        const rect = this._modalHandle.seekTrackEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const time = cutStart + fraction * (cutEnd - cutStart);
        this._modalHandle.videoEl.currentTime = time;
        this._renderPlayheadPosition(time);
    },

    /** Vẽ dải seek ngoài: vị trí trong đoạn Start..End + 2 nhãn (đã phát / độ dài đoạn). @param {number} currentTime */
    _renderOuterSeek(currentTime) {
        const h = this._modalHandle;
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        const span = Math.max(0.001, cutEnd - cutStart);
        const fraction = Math.max(0, Math.min(1, (currentTime - cutStart) / span));
        h.seekFillEl.style.width = `${fraction * 100}%`;
        h.seekThumbEl.style.left = `${fraction * 100}%`;
        h.seekCurrentLabelEl.textContent = _formatVideoPreviewTime(fraction * span);
        h.seekTotalLabelEl.textContent = _formatVideoPreviewTime(span);
    },

    // ===================== Chụp / đổi kích thước màn =====================

    /** 'videoPreview.capture.click' — chụp khung hình đang dừng/phát thành ảnh mới (CÙNG luồng nút Capture ở Control
     * Center của index.html). */
    async handleCaptureClick() {
        if (!this._modalHandle) return; // guard
        const videoEl = this._modalHandle.videoEl;
        videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
        await workflowVideoFrameCapture.captureToPhoto(videoEl); // event/workflow/video-frame-capture.js
    },

    /** 'videoPreview.window.resize' — xoay máy/đổi cỡ cửa sổ: tính lại thẻ video, khung crop (nếu đang Cắt khung), dải phim. */
    handleWindowResize() {
        if (!this._modalHandle || appState.get('videoPreviewSourceDuration') <= 0) return; // guard: chưa có metadata
        this._renderTransformPreview();
        this._resyncCropCanvasIfActive();
        this._renderTrimPositions();
        this._renderPlayheadPosition(this._modalHandle.videoEl.currentTime);
    },

    _resyncCropCanvasIfActive() {
        if (appState.get('videoPreviewActiveTool') !== 'crop') return; // guard
        this._syncCropCanvasBox();
        this._drawCropOverlay();
    },

    /** Ứng với 'play'/'pause' của `<video>` — CHỈ vẽ biểu tượng Play giữa màn hình (class
     * `is-playing` trên overlay), không đụng `videoPreviewIsPlaying` (cờ đó vẫn do các thao tác
     * tự ghi như trước). @param {boolean} playing */
    handleVideoPlayState(playing) {
        if (!this._modalHandle) return;
        this._modalHandle.overlayEl.classList.toggle('is-playing', playing);
    },

    /** Tap màn hình — đảo phát/dừng. */
    handleMediaTapClick() {
        const videoEl = this._modalHandle.videoEl;
        if (videoEl.paused) { videoEl.play().catch(() => {}); appState.set('videoPreviewIsPlaying', true); }
        else { videoEl.pause(); appState.set('videoPreviewIsPlaying', false); }
    },

    // ===================== Rail + công cụ (Cắt / Cắt khung) =====================

    /** Nút "•••" góc trên phải — menu phụ (hiện chỉ có Đặt lại, là thao tác xoá hết nên để khuất
     * khỏi hàng công cụ chính, đúng chỗ FB đặt các lựa chọn ít dùng). @param {HTMLElement} anchorEl */
    handleMoreClick(anchorEl) {
        openDropdownMenu(anchorEl, [ // core/dropdown-menu.js
            { icon: _svgIcon('reset-transform'), name: t('videoPreview.rail.reset'), destructive: true, callback: () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.reset.click', payload: {} }) },
        ], { zIndex: Z_INDEX.VIDEO_PREVIEW_MENU }); // service/z-index.js
    },

    /** Mở 1 công cụ từ hàng công cụ. Chỉ mở được khi đang ở trạng thái xem ('none') — rail bị ẩn khi đang
     * dùng công cụ nên bình thường không bấm được, guard phòng hờ.
     * @param {string} tool - 'trim' | 'crop' */
    handleToolOpen(tool) {
        if (appState.get('videoPreviewActiveTool') !== 'none') return;
        this._beforeToolSnapshot = { snapshot: this._buildSnapshot(), hadUnsaved: appState.get('videoPreviewHasUnsavedChanges') };
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
        this._setActiveTool(tool);

        if (tool === 'crop') {
            this._syncCropCanvasBox();
            this._drawCropOverlay();
            this._renderRatioButtonsActiveState();
        } else {
            this._renderTrimPositions(); // dải phim vừa hiện — lúc trước ẩn nên bề rộng đo được = 0
            this._renderPlayheadPosition(this._modalHandle.videoEl.currentTime);
        }
    },

    /** Huỷ — khôi phục đúng trạng thái lúc mở công cụ, KỂ CẢ cờ chưa lưu. */
    handleToolCancel() {
        const before = this._beforeToolSnapshot;
        if (before) {
            this._applySnapshot(before.snapshot);
            appState.set('videoPreviewHasUnsavedChanges', before.hadUnsaved);
        }
        this._beforeToolSnapshot = null;
        this._setActiveTool('none');
    },

    /** Xong — giữ thay đổi. Cắt khung bật cờ chưa lưu như nút "Áp dụng" cũ (đổi tỉ lệ không qua
     * pointerUp nên không tự bật cờ); Cắt đã tự bật cờ lúc nhả tay cầm (`handleTrimDragEnd()`). */
    handleToolDone() {
        if (appState.get('videoPreviewActiveTool') === 'crop') appState.set('videoPreviewHasUnsavedChanges', true);
        this._beforeToolSnapshot = null;
        this._setActiveTool('none');
    },

    /** Đổi trạng thái bố cục (CSS đọc `data-tool`) + tên công cụ trên topbar. Khung video đổi kích
     * thước theo → tính lại transform xoay (hệ số scale 90°/270° phụ thuộc khung chứa).
     * @param {string} tool - 'none' | 'trim' | 'crop' */
    _setActiveTool(tool) {
        appState.set('videoPreviewActiveTool', tool);
        this._modalHandle.overlayEl.dataset.tool = tool;
        if (tool !== 'none') this._modalHandle.toolTitleEl.textContent = t(`videoPreview.tool.${tool}.title`);
        this._renderTransformPreview();
    },

    /** Chuỗi CSS transform xoay + lật ngang hiện tại + hệ số scale bù (90°/270°) — DÙNG CHUNG cho
     * `<video>` (`_renderTransformPreview()`) VÀ `cropCanvasEl` (`_syncCropCanvasBox()`) khi Crop
     * đang mở, để 2 phần tử biến đổi Y HỆT nhau quanh CÙNG 1 tâm. Xoay/Đặt lại bị ẨN suốt lúc Cắt khung, nên
     * `videoPreviewRotateDeg` cố định suốt 1 phiên Crop. Lật THÌ CÓ trong panel Cắt khung —
     * `handleFlipClick()` tự đồng bộ lại canvas khi đang Cắt khung.
     *
     * THỨ TỰ ghép chuỗi CỐ Ý: `rotate(deg) scale(fit) scaleX(-1)` — CSS áp phần tử BÊN PHẢI trước
     * (flip áp lên nội dung GỐC trước), rồi mới xoay cả kết quả đó — tức Flip định nghĩa theo hướng
     * GỐC video, xoay xảy ra SAU, khớp cách các app ảnh/video khác vẫn làm. `_toCropCanvasCoords()`
     * quy đổi NGƯỢC phải lột đúng thứ tự này (xoay trước, flip sau).
     * @returns {{transform: string, deg: number, scale: number, flipH: boolean}} */
    _getRotateTransform() {
        const deg = appState.get('videoPreviewRotateDeg');
        const flipH = appState.get('videoPreviewFlipH');
        const flipPart = flipH ? ' scaleX(-1)' : '';
        if (deg === 90 || deg === 270) {
            const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
            const wrapRect = this._modalHandle.mediaWrapEl.getBoundingClientRect();
            const fitBefore = Math.min(wrapRect.width / w, wrapRect.height / h);
            const fitAfter = Math.min(wrapRect.width / h, wrapRect.height / w);
            const scale = fitAfter / fitBefore;
            return { transform: `rotate(${deg}deg) scale(${scale})${flipPart}`, deg, scale, flipH };
        }
        return { transform: (deg === 180 ? 'rotate(180deg)' : '') + flipPart, deg, scale: 1, flipH };
    },

    /** Tính lại + đặt CSS `cropCanvasEl` khớp TUYỆT ĐỐI vùng ảnh THẬT đang hiển thị của `<video
     * object-contain>` (không phải khung layout của nó), CỘNG áp CÙNG 1 transform xoay/scale với
     * `<video>` (mục "xoay + crop") — canvas được đặt/tính TRƯỚC khi xoay (khớp hướng gốc video),
     * transform lo phần xoay/co dãn giống hệt video nên 2 bên luôn khớp nhau ở BẤT KỲ góc nào, không
     * cần tính lại `session.rect` theo hướng đã xoay (vẫn nguyên hệ toạ độ pixel gốc, xem
     * `_toCropCanvasCoords()` lo phần quy đổi ngược).
     *
     * KHÔNG dùng thẳng `videoEl.getBoundingClientRect()`: `object-contain` KHÔNG đổi kích thước layout của phần tử, chỉ đổi cách ảnh VẼ BÊN TRONG khung
     * đó — `getBoundingClientRect()` trả về khung LAYOUT (ở đây luôn bằng `mediaWrapEl` do class
     * `w-full h-full`), KHÔNG trừ phần letterbox đen 2 bên/trên-dưới khi tỉ lệ video khác tỉ lệ
     * container. Canvas vì vậy có thể bị đặt to/lệch hơn vùng pixel video thật đang hiển thị, khiến
     * phép quy đổi toạ độ ở `_toCropCanvasCoords()` (dựa 1 hệ số `scale` DUY NHẤT theo bề rộng) sai
     * theo trục còn lại — nên tự tính bằng công thức `object-contain` chuẩn (so khung chứa với tỉ lệ native W/H).
     *
     * Gọi lại mỗi lần vào Crop và khi đổi cỡ màn hình lúc đang Cắt khung (`handleWindowResize()`). */
    _syncCropCanvasBox() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const canvas = this._modalHandle.cropCanvasEl;
        const wrapRect = this._modalHandle.mediaWrapEl.getBoundingClientRect();
        const containerRatio = wrapRect.width / (wrapRect.height || 1);
        const videoRatio = w / (h || 1);
        let boxW, boxH;
        if (videoRatio > containerRatio) { boxW = wrapRect.width; boxH = boxW / videoRatio; } // video "nằm ngang" hơn container — khít theo bề rộng, letterbox trên/dưới
        else { boxH = wrapRect.height; boxW = boxH * videoRatio; } // video "đứng" hơn container — khít theo chiều cao, letterbox 2 bên
        canvas.style.position = 'absolute';
        canvas.style.left = `${(wrapRect.width - boxW) / 2}px`;
        canvas.style.top = `${(wrapRect.height - boxH) / 2}px`;
        canvas.style.width = `${boxW}px`;
        canvas.style.height = `${boxH}px`;
        canvas.style.transform = this._getRotateTransform().transform; // đồng bộ y hệt video đang xoay (nếu có)
    },

    // ===================== Crop: tỉ lệ + kéo khung =====================

    /** @param {number} ratio */
    handleCropRatioSelect(ratio) {
        const session = appState.get('videoPreviewCropSession');
        setCropSessionAspectRatio(session, ratio); // core/media-transform.js
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
    },

    _renderRatioButtonsActiveState() {
        const session = appState.get('videoPreviewCropSession');
        this._modalHandle.ratioButtons.forEach(({ btn, ratio }) => {
            const matches = Number.isNaN(ratio) ? Number.isNaN(session.aspectRatio) : ratio === session.aspectRatio;
            btn.classList.toggle('is-active', matches);
        });
        this._renderFlipButtonState();
    },

    /** Đồng bộ trạng thái "đang bật" cho CẢ 2 nút Lật — `flipBtn` ở hàng công cụ (trạng thái xem) VÀ
     * `ratioFlipBtn` trong panel Cắt khung — cùng phản ánh 1 state DUY NHẤT `videoPreviewFlipH` (lật CẢ video, không
     * riêng khung crop); 2 nút bắn CHUNG `videoPreview.flip.click` → `handleFlipClick()` (core/file-manager/video-ui.js). */
    _renderFlipButtonState() {
        const active = appState.get('videoPreviewFlipH');
        this._modalHandle.flipBtn.classList.toggle('is-active', active);
        this._modalHandle.ratioFlipBtn.classList.toggle('is-active', active);
    },

    /** Quy đổi toạ độ màn hình -> toạ độ canvas (px nguồn, CHƯA xoay/lật) — dùng chung cho pointerDown/
     * Move VÀ `_moveOrResizeCropSession()` (tránh lặp lại phép tính `scale` ở nhiều chỗ).
     *
     * Bù NGƯỢC xoay + Flip ngang theo thứ tự ngược với `_getRotateTransform()` (rotate(deg) scale(fit) scaleX(-1) —
     * flip áp TRƯỚC/trong cùng, rotate áp SAU/ngoài cùng): lột rotate/scale trước, lột flip SAU
     * CÙNG (đối xứng X quanh tâm — tự nghịch đảo, chỉ cần đảo dấu `dx` 1 lần).
     * @param {number} clientX @param {number} clientY @returns {{x:number,y:number}} */
    _toCropCanvasCoords(clientX, clientY) {
        const canvas = this._modalHandle.cropCanvasEl;
        const rect = canvas.getBoundingClientRect(); // bbox SAU transform — chỉ dùng để lấy TÂM
        const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX, dy = clientY - centerY;

        const { deg, scale, flipH } = this._getRotateTransform();
        if (deg) {
            const rad = (-deg * Math.PI) / 180; // xoay NGƯỢC lại góc đã áp cho canvas
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
            dx = rx / scale; dy = ry / scale; // co dãn NGƯỢC lại
        }
        if (flipH) dx = -dx; // lột Flip SAU CÙNG (đối xứng quanh tâm, tự nghịch đảo)

        const boxW = canvas.offsetWidth || 1, boxH = canvas.offsetHeight || 1; // kích thước CSS GỐC, transform không đổi
        const pxScale = canvas.width / boxW; // canvas.width/height vuông tỉ lệ với offsetWidth/Height (cùng đặt trong _syncCropCanvasBox)
        return { x: (dx + boxW / 2) * pxScale, y: (dy + boxH / 2) * pxScale };
    },

    /** @param {number} clientX @param {number} clientY */
    handleCropCanvasPointerDown(clientX, clientY) {
        const session = appState.get('videoPreviewCropSession');
        const canvas = this._modalHandle.cropCanvasEl;
        const scale = canvas.width / (canvas.offsetWidth || 1); // offsetWidth — KHÔNG dùng getBoundingClientRect() (bbox bị tráo cạnh khi xoay 90°/270°)
        cropSessionPointerDown(session, this._toCropCanvasCoords(clientX, clientY), 30 * scale); // core/media-transform.js
    },

    /** @param {number} clientX @param {number} clientY */
    handleCropCanvasPointerMove(clientX, clientY) {
        const session = appState.get('videoPreviewCropSession');
        if (!session || !session.activeHandle) return; // listener document bắn MỌI lúc toàn app — modal đóng thì session null
        this._moveOrResizeCropSession(this._toCropCanvasCoords(clientX, clientY));
        this._drawCropOverlay();
    },

    handleCropCanvasPointerUp() {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return; // như pointerMove — modal đóng
        const wasDragging = !!session.activeHandle;
        cropSessionPointerUp(session); // core/media-transform.js
        if (wasDragging) appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** @param {{x:number,y:number}} pos */
    _moveOrResizeCropSession(pos) {
        const session = appState.get('videoPreviewCropSession');
        const s = session.dragStart;
        const dx = pos.x - s.x, dy = pos.y - s.y;
        const scale = this._modalHandle.cropCanvasEl.width / (this._modalHandle.cropCanvasEl.offsetWidth || 1); // offsetWidth — KHÔNG dùng getBoundingClientRect() (bbox bị tráo cạnh khi xoay 90°/270°)
        const minSize = 50 * scale;

        if (session.activeHandle === 'center') {
            session.rect = moveCropRect({ x: s.rx, y: s.ry, w: s.rw, h: s.rh }, dx, dy, session.sourceWidth, session.sourceHeight); // core/media-transform.js
            return;
        }
        const flipX = session.activeHandle === 'tl' || session.activeHandle === 'bl';
        const flipY = session.activeHandle === 'tl' || session.activeHandle === 'tr';
        const startRect = { x: s.rx, y: s.ry, w: s.rw, h: s.rh };
        session.rect = Number.isNaN(session.aspectRatio)
            ? computeFreeResizedRect(startRect, flipX, flipY, dx, dy, minSize, session.sourceWidth, session.sourceHeight) // core/media-transform.js
            : computeRatioLockedResizedRect(startRect, flipX, flipY, dx, session.aspectRatio, minSize, session.sourceWidth, session.sourceHeight); // core/media-transform.js
    },

    _drawCropOverlay() {
        const session = appState.get('videoPreviewCropSession');
        const canvas = this._modalHandle.cropCanvasEl;
        const scale = canvas.width / (canvas.offsetWidth || 1); // offsetWidth — KHÔNG dùng getBoundingClientRect() (bbox bị tráo cạnh khi xoay 90°/270°)
        drawCropSessionOverlay(canvas, session, scale); // core/media-transform.js
    },

    // ===================== Rotate / Flip / Reset =====================

    /** Xoay tới góc kế tiếp (0→90→180→270→0...) — nút DUY NHẤT, không còn tách trái/phải. */
    handleRotateClick() {
        appState.set('videoPreviewRotateDeg', cycleRotation(appState.get('videoPreviewRotateDeg'))); // core/media-transform.js
        this._renderTransformPreview();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Lật ngang CẢ nội dung video — bắn từ nút Lật ở hàng
     * công cụ HOẶC trong panel Cắt khung. */
    handleFlipClick() {
        appState.set('videoPreviewFlipH', !appState.get('videoPreviewFlipH'));
        this._renderTransformPreview();
        if (appState.get('videoPreviewActiveTool') === 'crop') { this._syncCropCanvasBox(); this._drawCropOverlay(); } // canvas Crop lật theo video
        this._renderFlipButtonState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Áp CSS xoay + lật LIVE lên `<video>` ngay trong modal. Dùng chung `_getRotateTransform()` với
     * `_syncCropCanvasBox()`. Canvas Crop (nếu đang Cắt khung) do nơi gọi tự đồng bộ — xem
     * `handleFlipClick()`.
     *
     * 2 nhánh:
     *   - Đang Cắt khung, HOẶC chưa cắt khung (khung phủ toàn bộ): video full khung
     *     (`object-contain` + transform xoay/lật), canvas Crop khớp đúng video để kéo khung.
     *   - Trạng thái xem / Thu ngắn MÀ đã cắt khung: hiện ĐÚNG vùng đã cắt, phóng vừa khung chứa —
     *     `_applyCroppedPreview()` (cắt bằng khung cha `cropViewEl`, KHÔNG dùng clip-path). */
    _renderTransformPreview() {
        this._fitCardToContent(); // thẻ đổi kích thước TRƯỚC, mọi phép đo bên dưới (và _getRotateTransform()) đọc thẻ mới
        const videoEl = this._modalHandle.videoEl;
        const cropViewEl = this._modalHandle.cropViewEl;
        const cropRect = appState.get('videoPreviewActiveTool') === 'crop' ? null : this._computeCropRect();
        if (cropRect) { this._applyCroppedPreview(cropRect); return; }
        // về lại layout class: khung cắt = cả khung chứa, video absolute inset-0 w-full h-full object-contain
        ['left', 'top', 'right', 'bottom', 'width', 'height'].forEach((k) => { cropViewEl.style[k] = ''; });
        ['left', 'top', 'right', 'bottom', 'width', 'height', 'maxWidth', 'maxHeight', 'transformOrigin', 'objectFit'].forEach((k) => { videoEl.style[k] = ''; });
        videoEl.style.transform = this._getRotateTransform().transform;
    },

    /** Thẻ video (`mediaWrapEl`) lấy ĐÚNG tỉ lệ nội dung đang
     * hiện rồi phóng vừa khít vùng bọc `cardAreaEl` (kiểu contain): trạng thái xem/Cắt = vùng đã cắt khung (nếu có) sau
     * xoay; đang Cắt khung = cả khung hình sau xoay (để thấy hết mà kéo khung). Video bên trong vẫn `object-contain`/
     * `_applyCroppedPreview()` nên lấp đúng thẻ, không có dải đen thừa. Chưa có metadata -> trả về 100% (CSS). */
    _fitCardToContent() {
        const cardEl = this._modalHandle.mediaWrapEl;
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        if (!w || !h) { cardEl.style.width = ''; cardEl.style.height = ''; return; } // guard: chưa biết kích thước thật
        const content = this._computeContentSize(w, h);
        const area = this._modalHandle.cardAreaEl.getBoundingClientRect();
        const s = Math.min(area.width / content.w, area.height / content.h);
        cardEl.style.width = `${Math.max(1, Math.floor(content.w * s))}px`;
        cardEl.style.height = `${Math.max(1, Math.floor(content.h * s))}px`;
    },

    /** Kích thước (px gốc) của nội dung đang hiện, SAU xoay. @returns {{w:number, h:number}} */
    _computeContentSize(w, h) {
        const cropRect = appState.get('videoPreviewActiveTool') === 'crop' ? null : this._computeCropRect();
        const base = cropRect ? { w: cropRect.w, h: cropRect.h } : { w, h };
        const deg = appState.get('videoPreviewRotateDeg');
        return (deg === 90 || deg === 270) ? { w: base.h, h: base.w } : base;
    },

    /** Xem trước kết quả cắt khung ngay trên màn chính. KHÔNG dùng `clip-path` trên `<video>` (WebKit/iOS vẽ video ở lớp
     * compositing riêng và BỎ QUA clip-path) — cắt bằng KHUNG CHA
     * `cropViewEl` (`overflow:hidden`, cắt chữ nhật — loại cắt WebKit tôn trọng với video):
     *   - `cropViewEl` = đúng kích thước vùng crop SAU XOAY, phóng vừa khít khung chứa (kiểu contain),
     *     đặt giữa.
     *   - `<video>` bên trong: kích thước gốc x `s`, dời sao cho TÂM vùng crop trùng tâm `cropViewEl`,
     *     xoay/lật quanh tâm vùng crop — phần ngoài vùng crop tràn ra ngoài khung cha và bị cắt.
     * Khớp file xuất (core/video-editor/webcodecs-engine.js: lật theo hướng gốc -> xoay -> cắt khung).
     * @param {{x:number,y:number,w:number,h:number}} rect - px GỐC. */
    _applyCroppedPreview(rect) {
        const videoEl = this._modalHandle.videoEl;
        const cropViewEl = this._modalHandle.cropViewEl;
        const W = appState.get('videoPreviewNativeW'), H = appState.get('videoPreviewNativeH');
        const deg = appState.get('videoPreviewRotateDeg');
        const flipH = appState.get('videoPreviewFlipH');
        const wrapRect = this._modalHandle.mediaWrapEl.getBoundingClientRect();
        const sideways = deg === 90 || deg === 270;
        const outW = sideways ? rect.h : rect.w, outH = sideways ? rect.w : rect.h;
        const s = Math.min(wrapRect.width / outW, wrapRect.height / outH);
        const viewW = outW * s, viewH = outH * s;
        const cx = (rect.x + rect.w / 2) * s, cy = (rect.y + rect.h / 2) * s;

        cropViewEl.style.right = 'auto';
        cropViewEl.style.bottom = 'auto';
        cropViewEl.style.width = `${viewW}px`;
        cropViewEl.style.height = `${viewH}px`;
        cropViewEl.style.left = `${(wrapRect.width - viewW) / 2}px`;
        cropViewEl.style.top = `${(wrapRect.height - viewH) / 2}px`;

        videoEl.style.objectFit = 'fill';
        // Preflight Tailwind có `video { max-width: 100%; height: auto }` — phải gỡ, không thì video
        // (to hơn khung cắt) bị ép nhỏ lại, lệch khỏi vùng crop.
        videoEl.style.maxWidth = 'none';
        videoEl.style.maxHeight = 'none';
        videoEl.style.right = 'auto';
        videoEl.style.bottom = 'auto';
        videoEl.style.width = `${W * s}px`;
        videoEl.style.height = `${H * s}px`;
        videoEl.style.left = `${viewW / 2 - cx}px`;
        videoEl.style.top = `${viewH / 2 - cy}px`;
        videoEl.style.transformOrigin = `${cx}px ${cy}px`;
        videoEl.style.transform = `${deg ? `rotate(${deg}deg)` : ''}${flipH ? ' scaleX(-1)' : ''}`;
    },

    /** Bấm Reset — PHẢI xác nhận trước khi chạy (không có Undo để lùi lại). */
    handleReset() {
        modalChoice( // core/modal-choice-ui.js
            t('videoPreview.resetConfirm.desc'),
            [
                { label: t('videoPreview.resetConfirm.confirm'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: () => this._reallyReset() },
            ],
            { title: t('videoPreview.resetConfirm.title') }
        );
    },

    _reallyReset() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const cropSession = appState.get('videoPreviewCropSession');
        setCropSessionRect(cropSession, { x: 0, y: 0, w, h }); // core/media-transform.js
        cropSession.aspectRatio = NaN;
        appState.set('videoPreviewRotateDeg', 0);
        appState.set('videoPreviewFlipH', false);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', appState.get('videoPreviewSourceDuration'));
        this._renderTransformPreview();
        this._drawCropOverlay();
        this._renderTrimPositions();
        this._renderRatioButtonsActiveState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** @returns {object} snapshot — crop rect/tỉ lệ + rotate + flip + cut hiện tại. DÙNG
     * RIÊNG cho khôi phục lúc Huỷ công cụ (`_beforeToolSnapshot`, xem `handleToolOpen()`/
     * `handleToolCancel()`). */
    _buildSnapshot() {
        const cropSession = appState.get('videoPreviewCropSession');
        return {
            cropRect: getCropSessionRect(cropSession), aspectRatio: cropSession.aspectRatio, // core/media-transform.js
            rotateDeg: appState.get('videoPreviewRotateDeg'),
            flipH: appState.get('videoPreviewFlipH'),
            cutStart: appState.get('videoPreviewCutStart'), cutEnd: appState.get('videoPreviewCutEnd'),
        };
    },

    /** @param {object} snapshot */
    _applySnapshot(snapshot) {
        const cropSession = appState.get('videoPreviewCropSession');
        setCropSessionRect(cropSession, snapshot.cropRect); // core/media-transform.js
        cropSession.aspectRatio = snapshot.aspectRatio;
        appState.set('videoPreviewRotateDeg', snapshot.rotateDeg);
        appState.set('videoPreviewFlipH', snapshot.flipH);
        appState.set('videoPreviewCutStart', snapshot.cutStart);
        appState.set('videoPreviewCutEnd', snapshot.cutEnd);
        this._renderTransformPreview();
        this._drawCropOverlay();
        this._renderTrimPositions();
        this._renderRatioButtonsActiveState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    // ===================== Lưu =====================

    /** Viên chọn kiểu lưu (dưới thẻ video, trái) — dropdown 2 lựa chọn, CHỈ đổi kiểu, chưa lưu.
     * @param {HTMLElement} anchorEl */
    handleSaveModeClick(anchorEl) {
        const pick = (mode) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.saveMode.select', payload: { mode } });
        openDropdownMenu(anchorEl, [ // core/dropdown-menu.js
            { icon: _svgIcon('copy-new'), name: t('videoPreview.save.asNew'), callback: () => pick('asNew') },
            { icon: _svgIcon('overwrite'), name: t('videoPreview.save.overwrite'), callback: () => pick('overwrite') },
        ], { zIndex: Z_INDEX.VIDEO_PREVIEW_MENU }); // service/z-index.js
    },

    /** @param {string} mode - 'asNew' | 'overwrite' */
    handleSaveModeSelect(mode) {
        appState.set('videoPreviewSaveMode', mode);
        this._modalHandle.saveModeLabelEl.textContent = t(`videoPreview.saveMode.${mode}`);
    },

    /** Nút xanh "Lưu" — lưu theo kiểu đang chọn ở viên bên trái. */
    handleSaveClick() {
        return this._runSave(appState.get('videoPreviewSaveMode'));
    },

    /** Khung cắt (px GỐC) từ phiên Crop.
     * @returns {{x:number,y:number,w:number,h:number}|null} px GỐC; null nếu khung phủ toàn bộ (không cắt). */
    _computeCropRect() {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return null; // guard — chưa có metadata
        const rect = getCropSessionRect(session); // core/media-transform.js
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const isFullFrame = rect.x <= 0.5 && rect.y <= 0.5 && rect.w >= w - 1 && rect.h >= h - 1;
        return isFullFrame ? null : rect;
    },

    _buildProcessParams() {
        return {
            sourceBlob: appState.get('videoPreviewRecord').blob,
            cutStart: appState.get('videoPreviewCutStart'),
            cutEnd: appState.get('videoPreviewCutEnd'),
            sourceDuration: appState.get('videoPreviewSourceDuration'),
            cropRect: this._computeCropRect(),
            sourceWidth: appState.get('videoPreviewNativeW'),
            sourceHeight: appState.get('videoPreviewNativeH'),
            rotateDeg: appState.get('videoPreviewRotateDeg'),
            flipH: appState.get('videoPreviewFlipH'),
        };
    },

    _buildNewFilename() {
        const original = appState.get('videoPreviewRecord').filename || 'video';
        const base = original.replace(/\.[^/.]+$/, '');
        const stamp = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${base}-edit-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`;
    },

    /** File tạm OPFS mở sẵn để ghi video xuất (core/video-editor/opfs-temp.js); máy không hỗ trợ/lỗi/treo -> null (ghi RAM).
     * @returns {Promise<{fileName: string, fileHandle: FileSystemFileHandle, writable: FileSystemWritableFileStream}|null>} */
    async _openTempTarget(fileName) {
        const temp = await openVideoEditTempFile(fileName);
        if (!temp) return null;
        try {
            const writable = await workflowTimeout.race(openVideoEditTempWritable(temp.fileHandle), VIDEO_EDIT_TEMP_WRITABLE_TIMEOUT_MS, 'createWritable() file tạm OPFS'); // event/workflow/timeout.js
            console.log(`[workflowVideoPreview._openTempTarget] mở file tạm OPFS "${fileName}" để ghi video xuất`);
            return { ...temp, writable };
        } catch (err) {
            console.warn('[workflowVideoPreview._openTempTarget] không mở được file tạm OPFS, dùng RAM:', err);
            return null;
        }
    },

    /** Luồng lưu DUY NHẤT cho cả 2 kiểu. Toàn bộ nằm trong shield: không bấm Lưu 2 lần, không đóng giữa chừng
     * (đóng giữa chừng -> `videoPreviewRecord` null -> crash sau khi encode xong, mất file). % = 0-90 tiến độ Conversion, 90-100 chụp thumb + ghi DB.
     * @param {string} mode - 'overwrite' | 'asNew' */
    async _runSave(mode) {
        this._modalHandle.videoEl.pause();
        const videoKey = appState.get('videoPreviewVideoKey');
        const params = this._buildProcessParams();
        let resultKey = null; // key thông báo sau khi shield tắt
        let saved = false;
        let tooLargeReason = null; // video xuất ra vượt giới hạn dung lượng -> không lưu, báo sau khi shield tắt
        let savedKey = null; // key video vừa lưu, để quay về Playlist cuộn đúng tới nó

        await withLoadingShield(tFormat('videoPreview.save.progress', { percent: 0 }), async () => { // core/loading-shield-util.js
            const pct = (p) => this._setShieldPercent('videoPreview.save.progress', p);
            let temp = null;
            try {
                await clearVideoEditTempDir(); // core/video-editor/opfs-temp.js — dọn rác lần xuất trước (nếu từng crash)
                temp = await this._openTempTarget(`edit-${Date.now()}.mp4`); // null = ghi RAM
                const result = await processVideo({ ...params, writable: temp ? temp.writable : null, onProgress: (f) => pct(f * 90) }); // core/video-editor/webcodecs-engine.js
                if (result.status === 'invalid') {
                    console.error('[workflowVideoPreview._runSave] Conversion không hợp lệ:', result.reasons);
                    resultKey = 'videoPreview.save.unsupported';
                    return;
                }
                if (result.status === 'unchanged' && temp) { // không có gì đổi -> không ghi gì vào file tạm, đóng lại
                    try { await temp.writable.abort(); } catch (e) { /* đã đóng */ }
                    temp = null;
                }
                const blob = result.blob || await readVideoEditTempFile(temp.fileHandle); // core/video-editor/opfs-temp.js
                // Media do app tự tạo chịu cùng giới hạn dung lượng như upload (core/upload-validation.js); dừng TRƯỚC khi chụp
                // thumb/ghi DB, finally bên dưới tự dọn file tạm OPFS.
                const sizeCheck = validateMediaFileSize(blob); // core/upload-validation.js
                if (!sizeCheck.valid) { tooLargeReason = sizeCheck.reason; return; }
                pct(92);

                const meta = await workflowVideoThumbExtract.extract(blob); // event/workflow/video-thumb-extract.js — timeout + thumb vuông + full-res
                pct(96);

                if (mode === 'overwrite') {
                    const r = await replaceVideoMedia(videoKey, { blob, ...meta }); // core/file-manager/video.js — giữ customName/addedAt...
                    if (r.status === 'notFound') { resultKey = 'videoPreview.videoNotFound'; return; }
                    // Không báo 'mediaInUse' — quay về là index.html nạp lại từ đầu.
                    savedKey = videoKey;
                } else {
                    const newFilename = this._buildNewFilename();
                    const newKey = await resolveVideoKey(newFilename); // service/db.js — key resolve ở Workflow (Rule 3)
                    await saveVideo(newKey, blob, newFilename, meta.thumbBlob, meta.width, meta.height, meta.duration, meta.thumbFullBlob, meta.thumbFullIsBlack); // core/file-manager/video.js
                    await this._attachToActiveVideoFolder(newKey); // folder Video đang Scope đọc từ DB
                    savedKey = newKey;
                }
                pct(100);
                saved = true;
                resultKey = result.audioDropped ? 'videoPreview.save.successNoAudio' : 'videoPreview.save.success';
            } catch (err) {
                console.error(`[workflowVideoPreview._runSave] Lỗi xử lý/lưu video (${mode}):`, err);
                resultKey = 'videoPreview.save.failed';
                if (temp && temp.writable && typeof temp.writable.abort === 'function') { try { await temp.writable.abort(); } catch (e) { /* đã đóng */ } }
            } finally {
                await clearVideoEditTempDir(); // DB đã giữ bản sao riêng — file tạm không còn cần
            }
        });

        if (tooLargeReason) { await alertModal(tFormat('common.validate.generatedNotSaved', { reason: tooLargeReason })); return; } // editor giữ nguyên để chỉnh tiếp (vd cắt ngắn hơn)
        if (resultKey) await alertModal(t(resultKey));
        // Báo kết quả TRƯỚC rồi mới quay về Playlist (index.html nạp lại, cuộn tới video vừa lưu).
        if (!saved) return; // guard: lưu hỏng -> ở lại sửa tiếp
        appState.set('videoPreviewHasUnsavedChanges', false);
        this._reallyClose(savedKey);
    },

    /** "Video mới" vào folder Video đang Scope (cùng khuôn upload video): trang này không có
     * appState của index.html nên đọc meta `activePlayListFolder` (index.html ghi mỗi lần đổi Scope,
     * workflowPlaylistScope.persistScopeChoice()). Đang ở "Tất cả"/folder vừa bị xoá -> bỏ qua. @param {string} newKey */
    async _attachToActiveVideoFolder(newKey) {
        const scope = await getMeta('activePlayListFolder'); // service/db.js
        const folderId = scope && scope.video;
        if (!folderId) return; // guard: đang ở view "Tất cả"
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        if (!folderMap) return; // guard: folder không còn
        await addSongsToFolder([newKey], folderId, 'video', folderMap); // core/file-manager/folder.js
    },

    // ===================== Đóng modal =====================

    handleClose() {
        if (!appState.get('videoPreviewHasUnsavedChanges')) { this._reallyClose(); return; }
        modalChoice( // core/modal-choice-ui.js
            t('videoPreview.discardConfirm.desc'),
            [
                { label: t('videoPreview.discardConfirm.title'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnDestructiveBg btnDestructiveHoverBg textOnAccent', onClick: () => this._reallyClose() },
            ],
            { title: t('videoPreview.discardConfirm.title') }
        );
    },

    /** "Đóng" = dọn rồi quay về Playlist, cuộn tới `scrollKey` (mặc định video đang sửa).
     * @param {string} [scrollKey] */
    _reallyClose(scrollKey) {
        const key = scrollKey || appState.get('videoPreviewVideoKey');
        this._disposeModal();
        this._leaveToPlaylist(key);
    },

    /** Quay về index.html — cùng cơ chế subtitle-editor.html::back(): cờ + key trong localStorage để index tự cuộn tới
     * item (event/listener/render.js), điều hướng bằng `location.href` (không history.back() — bfcache có thể bỏ qua
     * boot). @param {string|null} scrollKey */
    _leaveToPlaylist(scrollKey) {
        this._rememberScrollTarget(scrollKey);
        window.location.href = '../index.html'; // trang nằm trong pages/
    },

    _rememberScrollTarget(scrollKey) {
        if (!scrollKey) return; // guard: không có item để cuộn tới
        localStorage.setItem('sav_editingSubtitle', 'true'); // tên cờ dùng chung với subtitle-editor.html, giữ nguyên
        localStorage.setItem('sav_scrollToSongKey', scrollKey);
    },

    /** Dọn tài nguyên + DOM editor. */
    _disposeModal() {
        this._filmstripUrls.forEach((url) => revokeBlobUrl(url)); // service/blob-url.js
        this._filmstripUrls = [];
        this._filmstripRefilling = false;
        if (this._modalHandle) { this._modalHandle.close(); this._modalHandle = null; }
        appState.set('videoPreviewVideoKey', null);
        appState.set('videoPreviewRecord', null);
        appState.set('videoPreviewCropSession', null);
        appState.set('videoPreviewActiveDrag', null);
        appState.set('videoPreviewFilmstripFrames', []);
        appState.set('videoPreviewActiveTool', 'none');
        appState.set('videoPreviewSaveMode', 'asNew');
        this._beforeToolSnapshot = null;
        appState.set('videoPreviewIsPlaying', false);
    },
};
