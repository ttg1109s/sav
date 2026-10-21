/**
 * event/workflow/video-thumb-extract.js — Workflow DÙNG CHUNG đọc kích thước/thời lượng + chụp 2 thumbnail của 1 file
 * video (khung đầu full-res + thumb vuông). File riêng (không nằm trong playlist.js) vì trang video-editor.html cần
 * đúng hàm này lúc Lưu nhưng không nạp được cả workflowPlaylist. Public: `extract(file)`, `probeFrame(source)`.
 * Dùng ở: index.html (upload video, Scan & fix video thumbnails) + video-editor.html (Lưu).
 *
 * `<video>` tạm + sự kiện của nó đi qua core/dynamic-object-ui.js (ngoại lệ chính thức — đối tượng tạo động); vẽ/đo/mã hoá
 * khung ở core/video-player-capture.js, điều khiển `<video>` tạm ở core/media-element-ui.js.
 *
 * NẠP SAU: service/task-manager.js, service/blob-url.js, core/dynamic-object-ui.js, core/video-player-capture.js,
 * core/media-element-ui.js (cả 2 trang đều nạp).
 */
/** Cạnh thumbnail vuông cố định của video (`extract()`). */
const VIDEO_THUMBNAIL_SIZE = 320;

/** Hằng số chụp KHUNG HÌNH ĐẦU video (`extract()`, `_captureFirstFrame()`, `probeFrame()`). */
const VIDEO_MAX_CANVAS_PIXELS = 16777216; // trần diện tích canvas của Safari/iOS (4096×4096) — vượt là canvas không dùng được (ảnh đen)
const VIDEO_PROBE_SIZE = 32; // cạnh canvas nhỏ dùng đo alpha + độ sáng của khung vừa vẽ
const VIDEO_BLACK_PIXEL_LUMA = 26; // pixel coi là "đen" khi luma ≤ ngưỡng (~10% dải 0–255 — cùng mặc định pix_th của ffmpeg blackdetect)
const VIDEO_BLACK_FRAME_RATIO = 0.98; // khung coi là "đen" khi ≥ tỉ lệ này số pixel đen (cùng mặc định pic_th của ffmpeg blackdetect)
const VIDEO_BLACK_CONFIRM_COUNT = 3; // vẽ được nhưng vẫn đen chừng này lần (kể cả lần đầu) -> đen THẬT (fade-in...), chấp nhận
const VIDEO_FIRST_FRAME_RVFC_TIMEOUT_MS = 2500; // đợi requestVideoFrameCallback bắn khung đầu; quá hạn -> đường dự phòng
const VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC = 0.25; // khung rVFC đầu có mediaTime lớn hơn mốc này = không còn là khung đầu -> bỏ
const VIDEO_FIRST_FRAME_MAX_ATTEMPTS = 12; // số lần thử ở đường dự phòng / thumb vuông
const VIDEO_FIRST_FRAME_RETRY_MS = 150; // khoảng cách giữa 2 lần thử
const VIDEO_SEEK_TIMEOUT_MS = 3000; // đợi 'seeked' tối đa
const VIDEO_EXTRACT_TIMEOUT_MS = 10000; // timeout tổng 1 file

/** 1 lần chụp khung đầu (classifyFrameGrab()) — trả true = xong. 'black': giữ làm ứng viên, đủ VIDEO_BLACK_CONFIRM_COUNT lần
 * (mà vẫn vẽ được) = đen THẬT. `session` = { best, blackCount }. */
const FIRST_FRAME_GRAB_BY_VERDICT = {
    none: () => false,
    ok: (session, grab) => {
        workflowVideoThumbExtract._keepBestGrab(session, grab);
        return true;
    },
    black: (session, grab) => {
        workflowVideoThumbExtract._keepBestGrab(session, grab);
        session.blackCount += 1;
        return isBlackFrameConfirmed(session.blackCount, VIDEO_BLACK_CONFIRM_COUNT); // core/video-player-capture.js
    },
};

/** Khung requestVideoFrameCallback: còn là khung đầu -> giữ; quá mốc -> bỏ (giải phóng canvas). */
const FIRST_FRAME_PRESENTED_BY_IS_FIRST = {
    true: (grab) => grab,
    false: (grab) => {
        releaseCanvas(grab.canvas); // core/video-player-capture.js
        return null;
    },
};

/** 1 lần thử ở đường dự phòng (resolveFirstFrameRetryStep()) — trả true = xong. */
const FIRST_FRAME_RETRY_BY_STEP = {
    grab: (videoEl, width, height, session) => workflowVideoThumbExtract._considerGrab(session, workflowVideoThumbExtract._grabFullFrame(videoEl, width, height)),
    nudge: (videoEl, width, height, session, retry) => workflowVideoThumbExtract._nudgeDecode(videoEl, retry),
    wait: () => false,
};

const workflowVideoThumbExtract = {
    // ===================== Chụp khung hình đầu video =====================
    // Mục tiêu: lấy CHÍNH XÁC khung đầu làm thumb full-res. (1) Chụp qua ĐÚNG đường player sẽ hiện — phát từ t=0 rồi
    // lấy khung ĐẦU TIÊN trình duyệt thật sự present (requestVideoFrameCallback, có `mediaTime`), không seek epsilon;
    // (2) kiểm tra ngay sau khi vẽ: alpha=0 -> KHÔNG vẽ được (thử lại), alpha đủ + đen -> đen (thử lại vài lần rồi coi
    // là đen THẬT, vd fade-in); (3) canvas không vượt trần 16.777.216 px của Safari/iOS, luôn thu nhỏ về 0 sau khi
    // dùng; (4) `<video>` được giải phóng thật sự (gỡ src + load()).

    /** Đợi 1 sự kiện của `<video>` hoặc hết `timeoutMs`. @returns {Promise<boolean>} true nếu sự kiện bắn, false nếu hết giờ. */
    _waitVideoEvent(videoEl, eventName, timeoutMs) {
        const wait = listenEventOnce(videoEl, eventName); // core/dynamic-object-ui.js
        return new Promise((resolve) => {
            const timer = taskManager.once(() => { wait.cancel(); resolve(false); }, timeoutMs);
            wait.promise.then(() => { timer.kill(); resolve(true); });
        });
    },

    /** Ngủ `ms` qua taskManager. */
    _sleep(ms) {
        return new Promise((resolve) => { taskManager.once(resolve, ms); });
    },

    /** Seek `videoEl` tới `timeSec` và đợi 'seeked' (+ 60ms cho khung kịp sẵn sàng). Đã đứng đúng mốc thì bỏ qua (không có 'seeked' để đợi). */
    async _seekVideoTo(videoEl, timeSec) {
        if (isAtMediaTime(videoEl.currentTime, timeSec)) return; // guard — core/video-player-capture.js
        const seeked = this._waitVideoEvent(videoEl, 'seeked', VIDEO_SEEK_TIMEOUT_MS); // đăng ký TRƯỚC khi gán currentTime
        seekMediaElement(videoEl, timeSec); // core/media-element-ui.js
        await seeked;
        await this._sleep(60);
    },

    /** Đo khung HIỆN TẠI của `source` (`<video>`, hoặc `<img>` đã decode — scan thumb cũ, workflowFileManagerStorage) theo
     * ngưỡng đen của file này — xem probeDrawableFrame() (core/video-player-capture.js). @returns {{drawn: boolean, isBlack: boolean}} */
    probeFrame(source) {
        return probeDrawableFrame(source, VIDEO_PROBE_SIZE, VIDEO_BLACK_PIXEL_LUMA, VIDEO_BLACK_FRAME_RATIO); // core/video-player-capture.js
    },

    /** Chụp full-res khung HIỆN TẠI — ĐỒNG BỘ (đo + vẽ trong CÙNG 1 tick, không thể lệch khung).
     * @returns {{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement|null}} */
    _grabFullFrame(videoEl, width, height) {
        const probe = this.probeFrame(videoEl);
        if (!probe.drawn) return { drawn: false, isBlack: false, canvas: null }; // guard
        return drawVideoFrameFull(videoEl, width, height, VIDEO_MAX_CANVAS_PIXELS, probe.isBlack); // core/video-player-capture.js
    },

    /** Giữ lần chụp mới làm ứng viên, giải phóng canvas ứng viên cũ. */
    _keepBestGrab(session, grab) {
        releaseCanvas(session.best && session.best.canvas); // core/video-player-capture.js
        session.best = grab;
    },

    /** @returns {boolean} true = đã có khung dùng được (xem FIRST_FRAME_GRAB_BY_VERDICT) */
    _considerGrab(session, grab) {
        return FIRST_FRAME_GRAB_BY_VERDICT[classifyFrameGrab(grab)](session, grab); // core/video-player-capture.js
    },

    /** KHUNG ĐẦU TIÊN của video — đúng thứ player sẽ hiện lúc bắt đầu phát (xem docstring extract()). Đường chính:
     * `_captureViaFrameCallback()`. Đường dự phòng (không có rVFC / hết giờ / khung không vẽ được hoặc đen): seek về 0 rồi thử
     * lại tối đa VIDEO_FIRST_FRAME_MAX_ATTEMPTS lần. Đen ≥ VIDEO_BLACK_CONFIRM_COUNT lần (mà vẫn VẼ ĐƯỢC) = đen THẬT -> chấp
     * nhận, KHÔNG đổi sang khung khác.
     * @returns {Promise<{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement}>} ném lỗi nếu không lần nào vẽ được. */
    async _captureFirstFrame(videoEl, width, height) {
        const session = { best: null, blackCount: 0 };
        if (await this._captureViaFrameCallback(videoEl, width, height, session)) return session.best;

        // ---- Đường dự phòng / thử lại ----
        pauseMediaElement(videoEl); // core/media-element-ui.js
        await this._seekVideoTo(videoEl, 0);
        const retry = { nudged: false }; // chỉ "nhá" play() ép decode 1 lần
        for (let i = 0; i < VIDEO_FIRST_FRAME_MAX_ATTEMPTS; i++) {
            const step = resolveFirstFrameRetryStep(hasMediaCurrentFrame(videoEl.readyState), retry.nudged); // core/video-player-capture.js
            if (await FIRST_FRAME_RETRY_BY_STEP[step](videoEl, width, height, session, retry)) return session.best;
            await this._sleep(VIDEO_FIRST_FRAME_RETRY_MS);
        }
        if (session.best) return session.best; // guard — các lần vẽ được đều đen -> đen thật
        throw new Error('[extractVideoThumbAndMeta] không vẽ được khung hình đầu (video không cho khung nào sau nhiều lần thử)');
    },

    /** Đường chính: `requestVideoFrameCallback` — play() từ t=0 (không seek), callback bắn khi khung đầu THẬT SỰ được present;
     * chụp NGAY trong callback rồi pause(). Trình duyệt không có rVFC -> bỏ qua. @returns {Promise<boolean>} true = xong */
    async _captureViaFrameCallback(videoEl, width, height, session) {
        const capture = { settled: false, resolve: null, timer: null };
        const grabbedPromise = new Promise((resolve) => { capture.resolve = resolve; });
        const frameWait = requestVideoFrameOnce(videoEl, (metadata) => this._onFirstPresentedFrame(capture, videoEl, width, height, metadata)); // core/dynamic-object-ui.js
        if (!frameWait.supported) return false; // guard — trình duyệt không có rVFC
        capture.timer = taskManager.once(() => this._abandonFirstFrameWait(capture, frameWait), VIDEO_FIRST_FRAME_RVFC_TIMEOUT_MS);
        playMediaElementAwaitable(videoEl).catch(() => {}); // core/media-element-ui.js — muted + playsInline: autoplay được phép
        return this._considerGrab(session, await grabbedPromise);
    },

    /** Khung đầu vừa trình chiếu (ĐỒNG BỘ trong callback rVFC). Đã hết giờ -> bỏ (không tạo canvas mồ côi). */
    _onFirstPresentedFrame(capture, videoEl, width, height, metadata) {
        if (capture.settled) return; // guard
        capture.settled = true;
        capture.timer.kill();
        capture.resolve(this._grabPresentedFrame(videoEl, width, height, metadata));
    },

    /** Hết giờ chờ khung đầu -> huỷ yêu cầu rVFC, đi đường dự phòng. */
    _abandonFirstFrameWait(capture, frameWait) {
        if (capture.settled) return; // guard
        capture.settled = true;
        frameWait.cancel();
        capture.resolve(null);
    },

    /** Trong callback rVFC: chụp ĐỒNG BỘ (= đúng khung vừa present), bỏ nếu không còn là khung đầu, rồi dừng video. */
    _grabPresentedFrame(videoEl, width, height, metadata) {
        const grab = this._grabFullFrame(videoEl, width, height);
        const kept = FIRST_FRAME_PRESENTED_BY_IS_FIRST[isFirstPresentedFrame(metadata, VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC)](grab); // core/video-player-capture.js
        pauseMediaElement(videoEl); // core/media-element-ui.js
        return kept;
    },

    /** iOS không tải khung nếu chưa play: "nhá" play() (tối đa 1,5 s) rồi dừng, tua lại về 0. @returns {Promise<boolean>} luôn false */
    async _nudgeDecode(videoEl, retry) {
        retry.nudged = true;
        try { await Promise.race([playMediaElementAwaitable(videoEl), this._sleep(1500)]); } catch (e) {} // core/media-element-ui.js
        pauseMediaElement(videoEl);
        await this._seekVideoTo(videoEl, 0);
        return false;
    },

    /** Thumb VUÔNG (lưới/cover) ở mốc `min(1, duration/2)` — center-crop `VIDEO_THUMBNAIL_SIZE`. Thử lại tới khi vẽ được. @returns {Promise<Blob|null>} */
    async _captureSquareThumb(videoEl) {
        await this._seekVideoTo(videoEl, computeSquareThumbTimeSec(videoEl.duration)); // core/video-player-capture.js
        for (let i = 0; i < VIDEO_FIRST_FRAME_MAX_ATTEMPTS; i++) {
            const attempt = await this._trySquareThumb(videoEl);
            if (attempt) return attempt.blob; // guard — đã vẽ được (blob có thể null nếu mã hoá lỗi)
            await this._sleep(VIDEO_FIRST_FRAME_RETRY_MS);
        }
        return null;
    },

    /** 1 lần chụp thumb vuông. @returns {Promise<{blob: Blob|null}|null>} null = chưa vẽ được, thử lại */
    async _trySquareThumb(videoEl) {
        if (!hasMediaCurrentFrame(videoEl.readyState)) return null; // guard — core/video-player-capture.js
        if (!this.probeFrame(videoEl).drawn) return null; // guard
        const canvas = drawVideoSquareThumb(videoEl, VIDEO_THUMBNAIL_SIZE); // core/video-player-capture.js
        if (!canvas) return null; // guard — vẽ lỗi
        return { blob: await canvasToJpegBlobReleased(canvas, 0.85) }; // core/video-player-capture.js
    },

    /** Đọc thời lượng/kích thước + chụp 2 thumbnail của 1 file video:
     *   - `thumbFullBlob`: KHUNG HÌNH ĐẦU TIÊN ở kích thước GỐC (không crop) — đúng khung mà Video Player
     *     mode sẽ hiện lúc bắt đầu phát (dùng làm lớp nền dự phòng lúc Next/Prev, xem
     *     workflowVideoPlayer.swapBgVideoSource()). Chụp bằng `_captureFirstFrame()`.
     *   - `thumbBlob`: thumb VUÔNG `VIDEO_THUMBNAIL_SIZE` (center-crop), mốc `min(1, duration/2)` — lưới/cover.
     * `width`/`height` trả về là kích thước GỐC của video (KHÔNG phải kích thước thumb).
     * `<video>` được giải phóng thật (pause + gỡ src + load()) ở MỌI đường thoát, timeout tổng VIDEO_EXTRACT_TIMEOUT_MS.
     *
     * Reject nếu không đọc được video / không vẽ được khung nào / toBlob null — nơi gọi (`uploadVideos()`) skip đúng
     * file đó, KHÔNG lưu record.
     * Tên PUBLIC (bỏ `_`) vì TÁI DÙNG chéo miền: `workflowFileManagerStorage.executeRepairBroken()` gọi lại
     * đúng hàm này để tạo lại thumb cho video ĐÃ lưu (event-bus-flow.md mục 4B).
     * @param {File|Blob} file - File lúc upload MỚI, hoặc `record.blob` của 1 video ĐÃ LƯU.
     * @returns {Promise<{thumbBlob: Blob, thumbFullBlob: Blob, thumbFullIsBlack: boolean, width: number, height: number, duration: number}>}
     *   `thumbFullIsBlack`: khung đầu VẼ ĐƯỢC nhưng đen sau nhiều lần chụp = đen THẬT — nơi gọi
     *   ghi xuống record (`saveVideo()`/`setVideoThumbnails()`) để scan không báo lỗi lặp.
     */
    extract(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = createBlobUrl(file); // service/blob-url.js
            const videoEl = createDetachedVideoElement(); // core/dynamic-object-ui.js
            const errorWait = listenEventOnce(videoEl, 'error'); // core/dynamic-object-ui.js
            let metaWait = null;
            let settled = false;
            const dispose = () => {
                errorWait.cancel();
                if (metaWait) metaWait.cancel();
                releaseMediaElement(videoEl); // core/dynamic-object-ui.js — giải phóng decoder thật sự, không chờ GC
                revokeBlobUrl(objectUrl); // service/blob-url.js
            };
            const safetyTimeout = taskManager.once(() => fail(new Error('[extractVideoThumbAndMeta] timeout đọc video')), VIDEO_EXTRACT_TIMEOUT_MS);
            const fail = (err) => { if (settled) return; settled = true; safetyTimeout.kill(); dispose(); reject(err); };
            const succeed = (result) => { if (settled) return; settled = true; safetyTimeout.kill(); dispose(); resolve(result); };
            errorWait.promise.then(() => fail(new Error('[extractVideoThumbAndMeta] không đọc được video')));

            (async () => {
                try {
                    metaWait = loadMediaElementMetadata(videoEl, objectUrl); // core/dynamic-object-ui.js
                    await metaWait.promise;
                    const width = videoEl.videoWidth, height = videoEl.videoHeight;
                    if (!width || !height) throw new Error('[extractVideoThumbAndMeta] video không có kích thước hợp lệ');

                    const first = await this._captureFirstFrame(videoEl, width, height);
                    const thumbFullBlob = await canvasToJpegBlobReleased(first.canvas, 0.92); // core/video-player-capture.js
                    if (!thumbFullBlob) throw new Error('[extractVideoThumbAndMeta] chụp full-res thất bại (canvas.toBlob trả về null)');

                    const thumbBlob = await this._captureSquareThumb(videoEl);
                    if (!thumbBlob) throw new Error('[extractVideoThumbAndMeta] không chụp được thumb vuông');

                    succeed({ thumbBlob, thumbFullBlob, thumbFullIsBlack: !!first.isBlack, width, height, duration: videoEl.duration || 0 });
                } catch (err) {
                    fail(err);
                }
            })();
        });
    },
};
