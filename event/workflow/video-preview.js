/**
 * event/workflow/video-preview.js — Workflow "videoPreview". Modal xem/sửa Video kiểu Story: trạng
 * thái xem (video tràn màn hình + rail dọc) và 2 công cụ Cắt / Cắt khung (mỗi lúc 1 công cụ, xem mục
 * SỬA 26/09/2026 dưới).
 *
 * SỬA (29/09/2026, Giang) — BỎ HẲN zoom-pan (Panzoom) trong editor: không còn session, không còn
 * reset/snapshot zoom. Thêm nút Chụp (Capture) ở hàng công cụ — bắn ĐÚNG event Control Center
 * 'videoPlayer.captureFrame.click' (kèm `sourceVideoEl` = `<video>` của editor), xem
 * core/file-manager/video-ui.js + event/workflow/video-player.js::captureCurrentFrame().
 *
 * `open()` bọc TOÀN BỘ trong `withLoadingShield()` (core/loading-shield-util.js) — chỉ tắt shield
 * SAU KHI modal đã dựng xong VÀ đã có metadata thật (crop/trim sẵn sàng tương tác), không
 * chỉ sau khi DOM append xong.
 *
 * `this._modalHandle`/`this._beforeToolSnapshot`/`this._resolveMetadataReady` giữ TRỰC TIẾP trên
 * object Workflow (KHÔNG qua appState — không phải dữ liệu nghiệp vụ tuần tự hoá được).
 *
 * SỬA (05/08/2026, đợt 5, phản hồi Giang):
 * - MỤC 1 — "loại bỏ toàn bộ tính năng undo/redo, giữ nút reset [+ cảnh báo]": bỏ hẳn
 *   `videoPreviewHistorySession`/`core/edit-history.js` (KHÔNG còn Workflow nào dùng file đó nữa —
 *   RÁC, đề nghị Giang tự xoá `core/edit-history.js` + dòng `<script>` tương ứng trong index.html đã
 *   gỡ sẵn ở patch này). `_buildSnapshot()`/`_applySnapshot()` VẪN GIỮ — phục vụ RIÊNG cơ chế khôi
 *   phục lúc Huỷ công cụ (`_beforeToolSnapshot`, KHÔNG phải Undo/Redo, xem comment tại đó). Reset giờ
 *   bắt buộc qua `modalChoice()` xác nhận trước khi chạy — trước đó KHÔNG hề có bước xác nhận nào.
 * - MỤC 2 — "zoom-pan kéo ra bị 'phóng to/thu nhỏ kích thước' chứ không 'zoom' như ảnh": so với
 *   Photo Edit (nơi Panzoom chạy ĐÚNG, xem `core/file-manager/photo-ui.js::openImagePreviewModal()`
 *   → `.photo-preview-image`, `position:absolute; inset:0`), tìm ra 2 khác biệt CỤ THỂ, đã sửa cả 2
 *   (CHƯA có cách tự kiểm chứng lại trên máy thật — cần Giang xác nhận):
 *   (a) `initPanzoomSession(videoEl, ...)` TRƯỚC ĐÂY gọi trong lúc `videoEl` VẪN CÒN class `hidden`
 *       (`display:none`) — `getBoundingClientRect()` của phần tử `display:none` LUÔN trả về
 *       `{0,0,0,0}`, khiến Panzoom đo kích thước SAI ngay lúc khởi tạo (`contain:'outside'` cần đo
 *       đúng để tính giới hạn pan/zoom) — giờ dời xuống SAU dòng gỡ `hidden`.
 *   (b) `videoEl`/`posterEl` TRƯỚC ĐÂY là block tĩnh thường (`w-full h-full`, KHÔNG `position:
 *       absolute`) — khác `.photo-preview-image` (`position:absolute; inset:0`, pin cứng theo khung
 *       chứa). Đã thêm `absolute inset-0` cho cả 2 (xem components/video-preview.js) — khớp tuyệt
 *       đối cách Photo Edit đang chạy đúng.
 *
 * SỬA (26/09/2026, Giang — "cải tổ editor video theo hướng Story Facebook", chốt: GIỮ tỉ lệ gốc,
 * chỉ đổi UI/UX, làm KHUNG UI trước; layer chữ/sticker sau này hiện SUỐT video):
 * - Bỏ mô hình "Cut luôn hiện + Crop toggle song song". Giờ ĐÚNG 1 công cụ tại 1 thời điểm
 *   (`videoPreviewActiveTool` 'none'|'trim'|'crop'), mở từ rail dọc, thoát qua Huỷ/Xong ở topbar
 *   (`handleToolOpen/Cancel/Done`) — thay `modalChoice` Áp dụng/Huỷ lúc tắt Crop cũ. Snapshot
 *   trước khi mở công cụ (`_beforeToolSnapshot`) dùng CHUNG cho cả Cắt lẫn Cắt khung, Huỷ khôi phục
 *   cả cờ `videoPreviewHasUnsavedChanges` về đúng giá trị trước đó (trước đây Huỷ Crop vẫn bật cờ).
 * - Mỗi lần đổi công cụ, `#video-preview-media-wrap` đổi kích thước (topbar/panel dưới hiện/ẩn) →
 *   `_renderTransformPreview()` tính lại hệ số scale xoay 90°/270° theo khung MỚI.
 * - (Từng thêm Tắt tiếng — ĐÃ BỎ 27/09/2026 theo yêu cầu Giang; engine vẫn nhận `muteAudio` tuỳ chọn), rail mở
 *   rộng nhãn (`handleRailExpandClick`), biểu tượng Play giữa màn hình (`handleVideoPlayState`).
 * - Lật khi đang Cắt khung giờ đồng bộ lại canvas Crop (trước đây nút Lật trong dải tỉ lệ chỉ lật
 *   `<video>`, canvas Crop KHÔNG lật theo → khung crop lệch khỏi hình).
 *
 * PHASE 1 (26/09/2026, Giang):
 * - Engine xuất mới (`Mediabunny.Conversion`, core/video-editor/webcodecs-engine.js) ghi thẳng vào
 *   file tạm OPFS (core/video-editor/opfs-temp.js; máy không hỗ trợ -> RAM). Mediabunny nạp OFFLINE từ
 *   assets/vendor/mediabunny.js (+ tuỳ chọn assets/vendor/mediabunny-aac-encoder.js nếu máy không tự
 *   encode được AAC).
 * - Hiện % lúc tải video vào edit (các bước chuẩn bị + trích dải phim, dải phim giờ trích TRONG
 *   shield) và lúc xuất (tiến độ Conversion + bước chụp thumb/ghi DB) — `loadingText` (tiền lệ
 *   workflowPlaylist.uploadVideos()).
 * - Lưu: bọc trong shield (hết bấm Lưu 2 lần/đóng modal giữa chừng), thumb dùng lại
 *   `workflowPlaylist.extractVideoThumbAndMeta()` (có timeout + thumb full-res), Lưu đè qua
 *   `replaceVideoMedia()` (giữ customName...), Lưu mới gắn vào folder Video đang scope, xong thì
 *   làm mới playlist + ĐÓNG modal (như nút Chia sẻ của Story — nguồn trong modal đã cũ sau khi lưu).
 * - Zoom-pan = CHẾ ĐỘ XEM + hệ toạ độ gắn chữ/sticker sau này (Giang chốt), KHÔNG vào file xuất —
 *   `_computeCropFraction()` (trộn pan CSS-px với crop px gốc, sai đơn vị) thay bằng
 *   `_computeCropRect()` chỉ đọc khung crop. Panzoom chuyển sang `stageEl` (bọc poster + video) để
 *   không giẫm transform xoay/lật trên `<video>`. Mở Cắt khung thì đưa zoom về 1 (khung crop không
 *   zoom theo).
 * - `<video>` lỗi/không có metadata sau 15s -> đóng modal + báo, không kẹt shield.
 * - Guard crop pointerMove/Up khi chưa có session (listener document bắn MỌI lúc toàn app -> trước
 *   đây TypeError ở mỗi lần chạm khi modal đóng).
 *
 * UI LẦN 2 (26/09/2026, Giang gửi ảnh chụp editor Story Facebook thật): bỏ rail dọc + nút mở rộng
 * nhãn (`handleRailExpandClick`, state `videoPreviewRailExpanded`). Hàng công cụ ngang ở đáy thẻ
 * video; Đặt lại dời vào menu "•••" (`handleMoreClick`). Lưu tách 2 bước kiểu FB "Bạn bè" + "Chia
 * sẻ": viên chọn kiểu lưu (`handleSaveModeClick` -> dropdown Lưu đè / Video mới, state
 * `videoPreviewSaveMode`, mặc định 'asNew' — an toàn, không đè mất bản gốc) + nút xanh "Lưu"
 * (`handleSaveClick` -> `_runSave(kiểu đang chọn)`). Nhãn Âm lượng cố định (icon tự đổi theo tắt/bật).
 *
 * NẠP SAU: core/file-manager/video-ui.js, core/media-transform.js (gộp crop-selector.js +
 * image-zoom.js + cycleRotation(), 04/08/2026), core/video-editor/compat-guard.js/filmstrip.js/
 * webcodecs-engine.js, core/video-player-capture.js, core/file-manager/video.js/image.js, service/state/
 * video-preview.js, service/blob-url.js, event/workflow/media-transform-helpers.js (đổi tên từ
 * crop-ratio-helpers.js).
 */
const FILMSTRIP_FRAME_COUNT = 14;
const MIN_TRIM_DURATION = 0.3; // giây — khoảng cách tối thiểu giữa Start/End

const VIDEO_PREVIEW_METADATA_TIMEOUT_MS = 15000; // Phase 1 — quá hạn chờ `<video>` báo metadata thì coi như hỏng, không kẹt shield

/** Nạp 1 file script cục bộ. Thành công thì nhớ lại (không nạp lần 2); THẤT BẠI thì KHÔNG nhớ —
 * SỬA (26/09/2026, Giang báo "library is missing"): bản trước cache luôn cả promise thất bại, nên
 * chép file vào assets/vendor/ SAU lần mở đầu tiên vẫn báo thiếu cho tới khi tải lại trang.
 * Bắt thêm lỗi CHẠY script (vd tải nhầm bản .mjs/ESM hoặc bản CommonJS cho Node — script vẫn "load"
 * nhưng ném SyntaxError/ReferenceError, không tạo biến global) để báo đúng nguyên nhân lên màn hình.
 * @param {string} src @returns {Promise<{loaded: boolean, runError: (string|null)}>} */
function _loadVideoEditorScriptOnce(src) {
    window._videoEditorScriptPromises = window._videoEditorScriptPromises || {};
    if (window._videoEditorScriptPromises[src]) return window._videoEditorScriptPromises[src];
    const promise = new Promise((resolve) => {
        const el = document.createElement('script');
        let runError = null;
        // file:// (origin mờ) trình duyệt che tên file trong lỗi -> lỗi không có filename phát ra giữa
        // lúc gắn thẻ và 'load' cũng tính là của file này.
        const onRunError = (e) => {
            if (!e.filename || e.filename.indexOf(src) !== -1) runError = e.message || String(e.error) || 'Script error';
        };
        window.addEventListener('error', onRunError);
        const done = (loaded) => {
            window.removeEventListener('error', onRunError);
            if (!loaded || runError || (src === MEDIABUNNY_VENDOR_PATH && !window.Mediabunny)) { // lần sau thử lại từ đầu
                el.remove();
                delete window._videoEditorScriptPromises[src];
                window._videoEditorScriptRetry[src] = true;
            }
            resolve({ loaded, runError });
        };
        // Lần thử lại sau 1 lần hỏng: thêm tham số chống cache — không thì trình duyệt trả lại đúng bản
        // file sai đã nhớ, dù Giang đã chép đè bản đúng.
        window._videoEditorScriptRetry = window._videoEditorScriptRetry || {};
        el.src = window._videoEditorScriptRetry[src] ? `${src}?retry=${Date.now()}` : src;
        el.onload = () => done(true);
        el.onerror = () => { console.error(`[_loadVideoEditorScriptOnce] không tìm thấy/không tải được "${src}"`); done(false); };
        document.head.appendChild(el);
    });
    window._videoEditorScriptPromises[src] = promise;
    return promise;
}

const MEDIABUNNY_VENDOR_PATH = 'assets/vendor/mediabunny.js';

/** SỬA (Phase 1, 26/09/2026 — Giang: "Mediabunny offline luôn vào thư mục assets/vendor/") — chỉ
 * nạp file cục bộ. SỬA (cùng ngày, Giang báo lỗi thiếu thư viện) — trả LÝ DO cụ thể thay vì true/
 * false để thông báo chỉ đúng chỗ sai:
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
        // Quên bản cũ để lần mở sau nạp lại file (Giang chép đè bản mới không cần tải lại trang).
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
                const r = await _loadVideoEditorScriptOnce('assets/vendor/mediabunny-aac-encoder.js');
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
function _svgIcon(d) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"/></svg>`;
}

const workflowVideoPreview = {
    _modalHandle: null,
    _beforeToolSnapshot: null, // { snapshot, hadUnsaved } lúc mở Cắt/Cắt khung — Huỷ khôi phục (RIÊNG, không phải Undo/Redo — mục đó đã bỏ hẳn 05/08/2026)
    _resolveMetadataReady: null,
    _filmstripUrls: [], // Phase 1 — blob URL ảnh dải phim, revoke khi đóng modal (trước đây rò rỉ 14 URL/lần mở)
    _dragResumePlay: false, // SỬA (05/08/2026, mục 6) — nhớ lại video đang play hay pause TRƯỚC khi kéo tay cầm/tua, để nhả tay cầm KHÔNG tự auto-play nếu trước đó đang pause

    /** Cập nhật dòng chữ shield thành "... N%". @param {string} key @param {number} percent */
    _setShieldPercent(key, percent) {
        loadingText.textContent = tFormat(key, { percent: Math.max(0, Math.min(100, Math.round(percent))) }); // dom-refs (tiền lệ workflowPlaylist.uploadVideos())
    },

    /** @param {string} videoKey */
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
            if (!metadataOk) { this._reallyClose(); failKey = 'videoPreview.metadataFailed'; return; }
            pct(35);

            // Dải phim trích TRONG shield (Phase 1 — Giang: hiện % lúc tải video vào edit) — bước tốn
            // thời gian nhất, % chạy 35 -> 100 theo từng khung trích xong.
            try {
                await this._renderFilmstripFrames((done, total) => pct(35 + (done / (total || 1)) * 65));
            } catch (err) {
                console.error('[workflowVideoPreview.open] trích dải phim lỗi, vẫn mở modal không có ảnh nền dải phim:', err);
            }
            pct(100);
        });
        if (failKey) await alertModal(failDetail ? `${t(failKey)}\n\n${failDetail}` : t(failKey));
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
        // (29/09/2026 — zoom-pan Panzoom đã bỏ hẳn, không còn init gì trên `stageEl`.)
        this._modalHandle.posterEl.classList.add('hidden');
        this._modalHandle.videoEl.classList.remove('hidden');

        this._renderTrimPositions();

        if (this._resolveMetadataReady) { this._resolveMetadataReady(true); this._resolveMetadataReady = null; }
    },

    /** Ứng với 'videoPreview.metadata.failed' (`<video>` báo 'error') HOẶC quá hạn chờ metadata
     * (taskManager.once trong `open()`) — nhả promise chờ với `false`, `open()` tự đóng modal + báo. */
    handleMetadataFailed() {
        if (this._resolveMetadataReady) { this._resolveMetadataReady(false); this._resolveMetadataReady = null; }
    },

    /** Trích N khung hình nền dải phim — SỬA (Phase 1): chạy TRONG shield của `open()`, báo tiến độ.
     * @param {(done:number, total:number) => void} [onProgress] */
    async _renderFilmstripFrames(onProgress) {
        const record = appState.get('videoPreviewRecord');
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const thumbH = 56;
        const thumbW = Math.max(30, Math.round(thumbH * (w / (h || 1))));
        const frames = await buildCutFilmstripFrames(record.blob, FILMSTRIP_FRAME_COUNT, thumbW, thumbH, onProgress); // core/video-editor/filmstrip.js
        if (!this._modalHandle) return; // guard: modal đã đóng trước khi trích xong
        appState.set('videoPreviewFilmstripFrames', frames);

        // #video-preview-filmstrip-frames TÁCH RIÊNG khỏi #video-preview-filmstrip-track (SỬA
        // 04/08/2026) — track không còn overflow:hidden nên 2 tay cầm ở 0%/100% không bị cắt mất
        // nửa; container riêng này mới overflow:hidden để bo góc ảnh nền.
        const framesEl = this._modalHandle.filmstripFramesEl;
        framesEl.innerHTML = '';
        frames.forEach(({ blob }) => {
            const cell = document.createElement('div');
            cell.className = 'video-preview-filmstrip-frame';
            if (blob) {
                const url = createBlobUrl(blob); // service/blob-url.js — revoke ở _reallyClose() (Phase 1)
                this._filmstripUrls.push(url);
                cell.style.backgroundImage = `url(${url})`;
            }
            framesEl.appendChild(cell);
        });
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
    },

    // ===================== Cut: tay cầm Start/End =====================

    /** @param {string} handle - 'start' | 'end' */
    handleTrimDragStart(handle) {
        this._dragResumePlay = appState.get('videoPreviewIsPlaying'); // nhớ lại TRƯỚC khi pause (mục 6)
        appState.set('videoPreviewActiveDrag', handle);
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
    },

    /** Ấn/tua trong dải phim (NGOÀI 2 tay cầm Start/End) — nhảy playhead tới đó ngay, kéo tiếp thì
     * tua tiếp (mục 7, phản hồi Giang). Bắn TỪ `filmstripTrackEl` nên bubbling qua CẢ click trên tay
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
        if (activeDrag !== 'seek') appState.set('videoPreviewHasUnsavedChanges', true); // tua thuần không phải thao tác sửa
        if (this._dragResumePlay) { // CHỈ tự play lại nếu TRƯỚC đó đang play (mục 6 — không còn auto-play mặc định)
            this._modalHandle.videoEl.play().catch(() => {});
            appState.set('videoPreviewIsPlaying', true);
        }
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
    },

    /** Ứng với 'play'/'pause' của `<video>` — CHỈ vẽ biểu tượng Play giữa màn hình (class
     * `is-playing` trên overlay), không đụng `videoPreviewIsPlaying` (cờ đó vẫn do các thao tác
     * tự ghi như trước). @param {boolean} playing */
    handleVideoPlayState(playing) {
        if (!this._modalHandle) return;
        this._modalHandle.overlayEl.classList.toggle('is-playing', playing);
    },

    /** Tap màn hình — đảo phát/dừng (mục 1, phản hồi Giang). */
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
            { icon: _svgIcon('M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4'), name: t('videoPreview.rail.reset'), destructive: true, callback: () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.reset.click', payload: {} }) },
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
     * đang mở, để 2 phần tử biến đổi Y HỆT nhau quanh CÙNG 1 tâm (mục "xoay + crop", phản hồi Giang
     * 05/08/2026, đợt 5). Xoay/Đặt lại nằm trên rail — bị ẨN suốt lúc Cắt khung (26/09/2026), nên
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
     * SỬA (05/08/2026, phản hồi Giang đợt 4) — BUG THẬT #2 trong 2 bug độc lập với layout (Giang chỉ
     * ra: chọn tỉ lệ co nhỏ nằm giữa màn hình, cách xa header/dải cắt, vẫn không kéo được — tức
     * KHÔNG PHẢI do chồng lấn). Bản CŨ dùng thẳng `videoEl.getBoundingClientRect()` — SAI, vì
     * `object-contain` KHÔNG đổi kích thước layout của phần tử, chỉ đổi cách ảnh VẼ BÊN TRONG khung
     * đó — `getBoundingClientRect()` trả về khung LAYOUT (ở đây luôn bằng `mediaWrapEl` do class
     * `w-full h-full`), KHÔNG trừ phần letterbox đen 2 bên/trên-dưới khi tỉ lệ video khác tỉ lệ
     * container. Canvas vì vậy có thể bị đặt to/lệch hơn vùng pixel video thật đang hiển thị, khiến
     * phép quy đổi toạ độ ở `_toCropCanvasCoords()` (dựa 1 hệ số `scale` DUY NHẤT theo bề rộng) sai
     * theo trục còn lại — tự tính lại bằng công thức `object-contain` chuẩn (so khung chứa với tỉ lệ
     * native W/H) thay vì tin `getBoundingClientRect()` của chính `<video>`.
     *
     * Gọi lại mỗi lần vào Crop — CHƯA xử lý resize/xoay MÀN HÌNH giữa chừng (nợ kỹ thuật nhỏ, ít gặp
     * trên mobile PWA đang mở modal). */
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
     * `ratioFlipBtn` trong panel Cắt khung (26/09/2026; trước là toolsGroupEl/ratioGroupEl) — cùng phản ánh 1 state DUY
     * NHẤT `videoPreviewFlipH` (mục "flip lật cả ảnh/video", phản hồi Giang 05/08/2026, đợt 6 —
     * TRƯỚC ĐÓ `ratioFlipBtn` làm việc KHÁC hẳn — đảo tỉ lệ khung Crop (`applyFlip()`,
     * event/workflow/media-transform-helpers.js — giờ KHÔNG còn nơi nào gọi, RÁC, đề nghị Giang tự
     * xoá hàm đó) — Giang chỉ ra "flip" phải lật CẢ ảnh/video, không phải riêng crop, nên 2 nút giờ
     * bắn CHUNG 1 event `videoPreview.flip.click` → `handleFlipClick()`, xem core/file-manager/
     * video-ui.js). */
    _renderFlipButtonState() {
        const active = appState.get('videoPreviewFlipH');
        this._modalHandle.flipBtn.classList.toggle('is-active', active);
        this._modalHandle.ratioFlipBtn.classList.toggle('is-active', active);
    },

    /** Quy đổi toạ độ màn hình -> toạ độ canvas (px nguồn, CHƯA xoay/lật) — dùng chung cho pointerDown/
     * Move VÀ `_moveOrResizeCropSession()` (tránh lặp lại phép tính `scale` ở nhiều chỗ).
     *
     * SỬA (05/08/2026, đợt 5) — thêm bù NGƯỢC Flip ngang (mục 4, phản hồi Giang). Thứ tự lột NGƯỢC
     * đúng thứ tự đã áp ở `_getRotateTransform()` (rotate(deg) scale(fit) scaleX(-1) — flip áp
     * TRƯỚC/trong cùng, rotate áp SAU/ngoài cùng): lột rotate/scale trước (như cũ), lột flip SAU
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
        if (!session || !session.activeHandle) return; // listener document bắn MỌI lúc toàn app — modal đóng thì session null (Phase 1: trước đây TypeError mỗi lần chạm)
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
        drawCropSessionOverlay(canvas.getContext('2d'), session, canvas.width, canvas.height, scale); // core/media-transform.js
    },

    // ===================== Rotate / Flip / Reset =====================

    /** Xoay tới góc kế tiếp (0→90→180→270→0...) — nút DUY NHẤT, không còn tách trái/phải. */
    handleRotateClick() {
        appState.set('videoPreviewRotateDeg', cycleRotation(appState.get('videoPreviewRotateDeg'))); // core/media-transform.js
        this._renderTransformPreview();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Lật ngang CẢ nội dung video (mục 4 + đợt 6, phản hồi Giang 05/08/2026) — bắn từ nút Lật ở hàng
     * công cụ HOẶC trong panel Cắt khung. */
    handleFlipClick() {
        appState.set('videoPreviewFlipH', !appState.get('videoPreviewFlipH'));
        this._renderTransformPreview();
        if (appState.get('videoPreviewActiveTool') === 'crop') { this._syncCropCanvasBox(); this._drawCropOverlay(); } // canvas Crop lật theo video (26/09/2026)
        this._renderFlipButtonState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Áp CSS xoay + lật LIVE lên `<video>` ngay trong modal (mục 3 cũ — trước đây bấm Xoay không
     * thấy gì đổi cho tới khi Lưu/mở lại). Dùng chung `_getRotateTransform()` với
     * `_syncCropCanvasBox()`. Canvas Crop (nếu đang Cắt khung) do nơi gọi tự đồng bộ — xem
     * `handleFlipClick()`.
     *
     * SỬA (27/09/2026, Giang: "Crop done -> vẫn chưa cập nhật màn hình main") — trước đây khung crop
     * CHỈ áp lúc xuất file, màn xem vẫn hiện nguyên khung hình. Giờ 2 nhánh:
     *   - Đang Cắt khung, HOẶC chưa cắt khung (khung phủ toàn bộ): như cũ — video full khung
     *     (`object-contain` + transform xoay/lật), canvas Crop khớp đúng video để kéo khung.
     *   - Trạng thái xem / Thu ngắn MÀ đã cắt khung: hiện ĐÚNG vùng đã cắt, phóng vừa khung chứa —
     *     `_applyCroppedPreview()` (cắt bằng khung cha `cropViewEl`, KHÔNG dùng clip-path). */
    _renderTransformPreview() {
        const videoEl = this._modalHandle.videoEl;
        const cropViewEl = this._modalHandle.cropViewEl;
        const cropRect = appState.get('videoPreviewActiveTool') === 'crop' ? null : this._computeCropRect();
        if (cropRect) { this._applyCroppedPreview(cropRect); return; }
        // về lại layout class: khung cắt = cả khung chứa, video absolute inset-0 w-full h-full object-contain
        ['left', 'top', 'right', 'bottom', 'width', 'height'].forEach((k) => { cropViewEl.style[k] = ''; });
        ['left', 'top', 'right', 'bottom', 'width', 'height', 'maxWidth', 'maxHeight', 'transformOrigin', 'objectFit'].forEach((k) => { videoEl.style[k] = ''; });
        videoEl.style.transform = this._getRotateTransform().transform;
    },

    /** Xem trước kết quả cắt khung ngay trên màn chính.
     * SỬA (27/09/2026, Giang: "crop chỉ làm resize ảnh chứ không crop thật") — bản trước cắt bằng
     * `clip-path` trên chính `<video>`; WebKit/iOS vẽ video ở lớp compositing riêng và BỎ QUA
     * clip-path đó, nên chỉ thấy video phóng to (resize) mà vẫn đủ khung hình. Giờ cắt bằng KHUNG CHA
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

    /** Bấm Reset — PHẢI xác nhận trước khi chạy (mục 1, phản hồi Giang: "loại bỏ toàn bộ Undo/Redo,
     * giữ nút reset và cảnh báo modal") — TRƯỚC ĐÂY reset chạy NGAY không hỏi gì, chấp nhận được vì
     * còn Undo cứu lại; giờ không còn đường lùi nào khác nên bắt buộc hỏi trước. */
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
     * `handleToolCancel()`) — KHÔNG còn liên quan Undo/Redo (đã bỏ hẳn, mục 1 phản hồi Giang). */
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
            { icon: _svgIcon('M8 16V5a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 01-1 1H9M8 16H5a1 1 0 01-1-1V6a1 1 0 011-1h3m0 11v3a1 1 0 001 1h9a1 1 0 001-1v-9a1 1 0 00-1-1h-3'), name: t('videoPreview.save.asNew'), callback: () => pick('asNew') },
            { icon: _svgIcon('M4 7h16M9 7V4h6v3m-7 0v13a1 1 0 001 1h8a1 1 0 001-1V7H7z'), name: t('videoPreview.save.overwrite'), callback: () => pick('overwrite') },
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

    /** SỬA (Phase 1, Giang: "zoom pan không liên quan tới xuất video, đó là chế độ xem") — thay
     * `_computeCropFraction()` (từng gộp pan/zoom Panzoom — đơn vị CSS-px — vào khung crop px gốc,
     * sai đơn vị → file xuất cắt lệch). Giờ CHỈ đọc khung crop.
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

    /** Luồng lưu DUY NHẤT cho cả 2 kiểu (Phase 1). Toàn bộ nằm trong shield: không bấm Lưu 2 lần,
     * không đóng modal giữa chừng (trước đây đóng giữa chừng -> `videoPreviewRecord` null -> crash sau
     * khi encode xong, file mất). % = 0-90 tiến độ Conversion, 90-100 chụp thumb + ghi DB.
     * @param {string} mode - 'overwrite' | 'asNew' */
    async _runSave(mode) {
        this._modalHandle.videoEl.pause();
        const videoKey = appState.get('videoPreviewVideoKey');
        const params = this._buildProcessParams();
        let resultKey = null; // key thông báo sau khi shield tắt
        let saved = false;
        let tooLargeReason = null; // MỚI (06/10/2026) — video xuất ra vượt 500MB/file -> không lưu, báo sau khi shield tắt

        await withLoadingShield(tFormat('videoPreview.save.progress', { percent: 0 }), async () => { // core/loading-shield-util.js
            const pct = (p) => this._setShieldPercent('videoPreview.save.progress', p);
            let temp = null;
            try {
                await clearVideoEditTempDir(); // core/video-editor/opfs-temp.js — dọn rác lần xuất trước (nếu từng crash)
                temp = await openVideoEditTempTarget(`edit-${Date.now()}.mp4`); // core/video-editor/opfs-temp.js — null = ghi RAM
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
                // MỚI (06/10/2026, Giang chốt "media do app tự tạo chặn 500MB") — cùng giới hạn upload (core/upload-validation.js);
                // dừng TRƯỚC khi chụp thumb/ghi DB, finally bên dưới tự dọn file tạm OPFS.
                const sizeCheck = validateMediaFileSize(blob); // core/upload-validation.js
                if (!sizeCheck.valid) { tooLargeReason = sizeCheck.reason; return; }
                pct(92);

                const meta = await workflowPlaylist.extractVideoThumbAndMeta(blob); // event/workflow/playlist.js — timeout + thumb vuông + full-res
                pct(96);

                if (mode === 'overwrite') {
                    const r = await replaceVideoMedia(videoKey, { blob, ...meta }); // core/file-manager/video.js — giữ customName/addedAt...
                    if (r.status === 'notFound') { resultKey = 'videoPreview.videoNotFound'; return; }
                    // MỚI (06/10/2026, plan-media-db-split.md mục 7) — báo request trung tâm: video này đang phát/làm nền thì tự nạp lại.
                    eventBus.send({ router: 'mediaInUse', type: 'mediaInUse.contentReplaced', payload: { type: 'video', key: videoKey } });
                } else {
                    const newFilename = this._buildNewFilename();
                    const newKey = await resolveVideoKey(newFilename); // service/db.js — SỬA 06/10/2026: key resolve ở Workflow (Rule 3)
                    await saveVideo(newKey, blob, newFilename, meta.thumbBlob, meta.width, meta.height, meta.duration, meta.thumbFullBlob, meta.thumbFullIsBlack); // core/file-manager/video.js
                    const activeFolderIdForVideo = appState.get('activePlayListFolder').video; // cùng khuôn workflowPlaylist.uploadVideos()
                    if (activeFolderIdForVideo) await workflowPlaylist.addMediaToFolder([newKey], activeFolderIdForVideo, 'video'); // event/workflow/playlist.js — SỬA 06/10/2026 (Workflow đọc folder_song trước, Rule 3b)
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

        if (saved) {
            appState.set('videoPreviewHasUnsavedChanges', false);
            await workflowVideoPlayer.refreshVideoPlaylistIfActive(); // event/workflow/video-player.js — tự guard nguồn Video
            this._reallyClose();
        }
        if (tooLargeReason) { await alertModal(tFormat('common.validate.generatedNotSaved', { reason: tooLargeReason })); return; } // modal editor giữ nguyên để chỉnh tiếp (vd cắt ngắn hơn)
        if (resultKey) await alertModal(t(resultKey));
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

    _reallyClose() {
        this._filmstripUrls.forEach((url) => revokeBlobUrl(url)); // service/blob-url.js — Phase 1
        this._filmstripUrls = [];
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
