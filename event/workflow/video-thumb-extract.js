/**
 * event/workflow/video-thumb-extract.js — Workflow DÙNG CHUNG đọc kích thước/thời lượng + chụp 2 thumbnail của 1 file
 * video (khung đầu full-res + thumb vuông). TÁCH (06/10/2026, Giang — tách trình sửa video thành trang riêng
 * video-editor.html) NGUYÊN VẸN từ event/workflow/playlist.js: trang editor cần đúng hàm này lúc Lưu nhưng không thể nạp
 * cả workflowPlaylist (phụ thuộc toàn bộ index.html). Không đổi logic — chỉ đổi tên public:
 *   - `extractVideoThumbAndMeta(file)` -> `extract(file)` (workflowPlaylist.extractVideoThumbAndMeta() giữ tên cũ, gọi sang đây).
 *   - `_probeVideoFrame(source)` -> `probeFrame(source)` (workflowPlaylist._probeVideoFrame() giữ tên cũ, gọi sang đây —
 *     workflowFileManagerStorage._classifyThumbBlob() vẫn gọi qua tên cũ).
 * Dùng ở: index.html (upload video, Scan & fix video thumbnails) + video-editor.html (Lưu).
 *
 * NẠP SAU: service/task-manager.js. Không phụ thuộc gì khác của index.html.
 */
/** DỜI từ event/workflow/file-manager-video.js (file đó đã xoá) — cạnh thumbnail vuông cố định
 * cho video upload, dùng bởi `uploadVideos()`/`extractVideoThumbAndMeta()` bên dưới. */
const VIDEO_THUMBNAIL_SIZE = 320;

/** MỚI (19/09/2026) — hằng số cho việc chụp KHUNG HÌNH ĐẦU video lúc upload (`extractVideoThumbAndMeta()`
 * và các hàm `_captureFirstFrame()`/`_probeVideoFrame()` cùng file). */
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
const VIDEO_EXTRACT_TIMEOUT_MS = 10000; // timeout tổng 1 file (trước đây 8000)

const workflowVideoThumbExtract = {
    // ===================== Chụp khung hình đầu video lúc upload — VIẾT LẠI (19/09/2026) =====================
    // Giang chốt "quan trọng nhất là lấy chính xác frame đầu khi upload để làm full res". Bản cũ chụp ở
    // sự kiện nào tới trước (loadeddata/canplay/seeked) rồi KHÓA LUÔN bằng cờ, không nhìn vào pixel —
    // khung chưa sẵn sàng thì `drawImage()` không vẽ gì (canvas trong suốt), JPEG ép nền ĐEN, blob vẫn
    // khác null nên lọt vào record. Bản mới: (1) chụp qua ĐÚNG đường player sẽ hiện — phát từ t=0 rồi lấy
    // khung ĐẦU TIÊN mà trình duyệt thật sự present (requestVideoFrameCallback, có `mediaTime`), không
    // seek epsilon; (2) kiểm tra ngay sau khi vẽ: alpha=0 -> KHÔNG vẽ được (thử lại), alpha đủ + đen ->
    // đen (thử lại vài lần rồi coi là đen THẬT, vd fade-in); (3) canvas không vượt trần 16.777.216 px của
    // Safari/iOS, và luôn thu nhỏ về 0 sau khi dùng; (4) `<video>` được giải phóng thật sự (gỡ src + load()).

    /** Đợi 1 sự kiện của `<video>` hoặc hết `timeoutMs`. @returns {Promise<boolean>} true nếu sự kiện bắn, false nếu hết giờ. */
    _waitVideoEvent(videoEl, eventName, timeoutMs) {
        return new Promise((resolve) => {
            let done = false;
            const onEvent = () => finish(true);
            const finish = (ok) => {
                if (done) return;
                done = true;
                videoEl.removeEventListener(eventName, onEvent);
                timer.kill();
                resolve(ok);
            };
            const timer = taskManager.once(() => finish(false), timeoutMs);
            videoEl.addEventListener(eventName, onEvent, { once: true });
        });
    },

    /** Ngủ `ms` — qua taskManager (quy ước project, thay setTimeout). */
    _sleep(ms) {
        return new Promise((resolve) => { taskManager.once(resolve, ms); });
    },

    /** Seek `videoEl` tới `timeSec` và đợi 'seeked' (+ 60ms cho khung kịp sẵn sàng). Đã đứng đúng mốc thì bỏ qua (không có 'seeked' để đợi). */
    async _seekVideoTo(videoEl, timeSec) {
        if (Math.abs(videoEl.currentTime - timeSec) < 0.0001) return;
        const seeked = this._waitVideoEvent(videoEl, 'seeked', VIDEO_SEEK_TIMEOUT_MS); // đăng ký TRƯỚC khi gán currentTime
        videoEl.currentTime = timeSec;
        await seeked;
        await this._sleep(60);
    },

    /** Vẽ khung hình HIỆN TẠI của `source` (`<video>`, hoặc `<img>` đã decode — dùng cho scan thumb cũ,
     * xem workflowFileManagerStorage._classifyThumbBlob(), qua workflowPlaylist._probeVideoFrame()) xuống canvas nhỏ rồi đo. `drawn=false` khi không vẽ được gì
     * (drawImage ném lỗi, hoặc mọi pixel alpha=0 — theo spec `drawImage()` không vẽ gì nếu video chưa có
     * khung); `isBlack=true` khi ≥ VIDEO_BLACK_FRAME_RATIO số pixel có luma ≤ VIDEO_BLACK_PIXEL_LUMA.
     * Không đọc được pixel (getImageData lỗi) -> coi như vẽ được + không đen (không đủ dữ kiện để từ chối). */
    probeFrame(source) {
        const size = VIDEO_PROBE_SIZE;
        const probeCanvas = document.createElement('canvas');
        probeCanvas.width = size; probeCanvas.height = size;
        let drawn = false, isBlack = false;
        let data = null;
        try {
            const ctx = probeCanvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(source, 0, 0, size, size);
            try { data = ctx.getImageData(0, 0, size, size).data; }
            catch (readErr) { drawn = true; } // vẽ được nhưng không đo được
        } catch (drawErr) { drawn = false; } // Firefox/Safari có thể ném lỗi khi video chưa có khung
        if (data) {
            let blackPixels = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 0) drawn = true;
                const luma = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
                if (luma <= VIDEO_BLACK_PIXEL_LUMA) blackPixels++;
            }
            isBlack = drawn && (blackPixels / (size * size)) >= VIDEO_BLACK_FRAME_RATIO;
        }
        probeCanvas.width = 0; probeCanvas.height = 0;
        return { drawn, isBlack };
    },

    /** Chụp full-res khung hình HIỆN TẠI — ĐỒNG BỘ (đo + vẽ trong CÙNG 1 tick, không thể lệch khung).
     * Cạnh canvas giữ nguyên kích thước gốc, chỉ thu nhỏ đều nếu vượt VIDEO_MAX_CANVAS_PIXELS (Safari/iOS).
     * @returns {{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement|null}} */
    _grabFullFrame(videoEl, width, height) {
        const probe = this.probeFrame(videoEl);
        if (!probe.drawn) return { drawn: false, isBlack: false, canvas: null };
        const scale = Math.min(1, Math.sqrt(VIDEO_MAX_CANVAS_PIXELS / (width * height)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(height * scale));
        try {
            canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        } catch (err) {
            canvas.width = 0; canvas.height = 0;
            return { drawn: false, isBlack: false, canvas: null };
        }
        return { drawn: true, isBlack: probe.isBlack, canvas };
    },

    /** canvas -> JPEG Blob, rồi thu nhỏ canvas về 0 (giải phóng bộ nhớ — Safari giữ canvas rất lâu). */
    _canvasToJpegBlob(canvas, quality) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                canvas.width = 0; canvas.height = 0;
                resolve(blob);
            }, 'image/jpeg', quality);
        });
    },

    /** KHUNG ĐẦU TIÊN của video — đúng thứ player sẽ hiện lúc bắt đầu phát (xem docstring extractVideoThumbAndMeta()).
     * Đường chính: `requestVideoFrameCallback` — play() từ t=0 (không seek), callback bắn khi khung đầu THẬT SỰ
     * được present; chụp NGAY trong callback rồi pause(). Khung có `mediaTime` > VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC
     * không còn là khung đầu -> bỏ. Đường dự phòng (không có rVFC / hết giờ / khung không vẽ được hoặc đen):
     * seek về 0 rồi thử lại tối đa VIDEO_FIRST_FRAME_MAX_ATTEMPTS lần. Đen ≥ VIDEO_BLACK_CONFIRM_COUNT lần liên
     * tiếp (mà vẫn VẼ ĐƯỢC) = đen THẬT (fade-in...) -> chấp nhận, KHÔNG đổi sang khung khác.
     * @returns {Promise<{drawn: boolean, isBlack: boolean, canvas: HTMLCanvasElement}>} ném lỗi nếu không lần nào vẽ được. */
    async _captureFirstFrame(videoEl, width, height) {
        let best = null;
        let blackCount = 0;
        const releaseCanvas = (c) => { if (c) { c.width = 0; c.height = 0; } };
        const consider = (grab) => { // 'ok' | 'black' | 'none'
            if (!grab || !grab.drawn) return 'none';
            if (best) releaseCanvas(best.canvas);
            best = grab;
            return grab.isBlack ? 'black' : 'ok';
        };
        const isDone = (verdict) => {
            if (verdict === 'ok') return true;
            if (verdict === 'black') { blackCount++; return blackCount >= VIDEO_BLACK_CONFIRM_COUNT; }
            return false;
        };

        // ---- Đường chính: requestVideoFrameCallback ----
        if (typeof videoEl.requestVideoFrameCallback === 'function') {
            let abandoned = false; // callback tới trễ sau khi đã hết giờ -> bỏ, không tạo canvas mồ côi
            const grabbed = await new Promise((resolve) => {
                const timer = taskManager.once(() => { abandoned = true; resolve(null); }, VIDEO_FIRST_FRAME_RVFC_TIMEOUT_MS);
                videoEl.requestVideoFrameCallback((now, metadata) => {
                    if (abandoned) return;
                    timer.kill();
                    let grab = this._grabFullFrame(videoEl, width, height); // ĐỒNG BỘ trong callback = đúng khung vừa present
                    if (metadata && metadata.mediaTime > VIDEO_FIRST_FRAME_MAX_MEDIA_TIME_SEC) { releaseCanvas(grab.canvas); grab = null; }
                    videoEl.pause();
                    resolve(grab);
                });
                videoEl.play().catch(() => {}); // muted + playsInline — autoplay được phép
            });
            if (isDone(consider(grabbed))) return best;
        }

        // ---- Đường dự phòng / thử lại ----
        videoEl.pause();
        await this._seekVideoTo(videoEl, 0);
        let nudged = false; // chỉ "nhá" play() ép decode 1 lần (iOS không tải khung nếu chưa play)
        for (let i = 0; i < VIDEO_FIRST_FRAME_MAX_ATTEMPTS; i++) {
            if (videoEl.readyState >= 2) {
                if (isDone(consider(this._grabFullFrame(videoEl, width, height)))) return best;
            } else if (!nudged) {
                nudged = true;
                try { await Promise.race([videoEl.play(), this._sleep(1500)]); } catch (e) {}
                videoEl.pause();
                await this._seekVideoTo(videoEl, 0);
            }
            await this._sleep(VIDEO_FIRST_FRAME_RETRY_MS);
        }
        if (best) return best; // các lần vẽ được đều đen -> đen thật
        throw new Error('[extractVideoThumbAndMeta] không vẽ được khung hình đầu (video không cho khung nào sau nhiều lần thử)');
    },

    /** Thumb VUÔNG (lưới/cover) ở mốc `min(1, duration/2)` — center-crop `VIDEO_THUMBNAIL_SIZE`. Thử lại tới khi vẽ được. @returns {Promise<Blob|null>} */
    async _captureSquareThumb(videoEl) {
        await this._seekVideoTo(videoEl, Math.min(1, videoEl.duration / 2 || 0));
        for (let i = 0; i < VIDEO_FIRST_FRAME_MAX_ATTEMPTS; i++) {
            if (videoEl.readyState >= 2 && this.probeFrame(videoEl).drawn) {
                const width = videoEl.videoWidth, height = videoEl.videoHeight;
                const side = Math.min(width, height);
                const sx = (width - side) / 2, sy = (height - side) / 2;
                const canvas = document.createElement('canvas');
                canvas.width = VIDEO_THUMBNAIL_SIZE; canvas.height = VIDEO_THUMBNAIL_SIZE;
                try {
                    canvas.getContext('2d').drawImage(videoEl, sx, sy, side, side, 0, 0, VIDEO_THUMBNAIL_SIZE, VIDEO_THUMBNAIL_SIZE);
                    return await this._canvasToJpegBlob(canvas, 0.85);
                } catch (err) {
                    canvas.width = 0; canvas.height = 0; // rớt xuống thử lại
                }
            }
            await this._sleep(VIDEO_FIRST_FRAME_RETRY_MS);
        }
        return null;
    },

    /** Đọc thời lượng/kích thước + chụp 2 thumbnail của 1 file video:
     *   - `thumbFullBlob`: KHUNG HÌNH ĐẦU TIÊN ở kích thước GỐC (không crop) — đúng khung mà Video Player
     *     mode sẽ hiện lúc bắt đầu phát (dùng làm lớp nền dự phòng lúc Next/Prev, xem
     *     workflowVideoPlayer.swapBgVideoSource()). Chụp bằng `_captureFirstFrame()`.
     *   - `thumbBlob`: thumb VUÔNG `VIDEO_THUMBNAIL_SIZE` (center-crop), mốc `min(1, duration/2)` — lưới/cover.
     * `width`/`height` trả về là kích thước GỐC của video (KHÔNG phải kích thước thumb). Đặt ở Workflow
     * (không phải core) vì cần `<video>`/`canvas` — DOM API, core không được đụng theo Rule 1-4.
     *
     * VIẾT LẠI (19/09/2026, Giang: "quan trọng nhất là lấy chính xác frame đầu khi upload") — bản cũ chụp ở
     * sự kiện tới trước (loadeddata/canplay/seeked), khóa bằng cờ, không nhìn pixel; hỏng ở ~10% video
     * (khung chưa sẵn sàng -> drawImage không vẽ gì -> JPEG đen; hoặc frame đầu có timestamp > 0 nên seek
     * 0.0001 không có khung để hiện). Xem các hàm `_captureFirstFrame()`/`_probeVideoFrame()` ngay trên.
     * `<video>` giờ được giải phóng thật (pause + gỡ src + load()) ở MỌI đường thoát, timeout tổng
     * VIDEO_EXTRACT_TIMEOUT_MS (trước đây 8000ms).
     *
     * Reject nếu không đọc được video / không vẽ được khung nào / toBlob null (như bản 18/09/2026) — nơi gọi
     * (`uploadVideos()`) skip đúng file đó, KHÔNG lưu record.
     * Tên PUBLIC (bỏ `_`) vì TÁI DÙNG chéo miền: `workflowFileManagerStorage.executeRepairBroken()` gọi lại
     * đúng hàm này để tạo lại thumb cho video ĐÃ lưu (event-bus-flow.md mục 4B).
     * @param {File|Blob} file - File lúc upload MỚI, hoặc `record.blob` của 1 video ĐÃ LƯU.
     * @returns {Promise<{thumbBlob: Blob, thumbFullBlob: Blob, thumbFullIsBlack: boolean, width: number, height: number, duration: number}>}
     *   `thumbFullIsBlack` (MỚI 19/09/2026): khung đầu VẼ ĐƯỢC nhưng đen sau nhiều lần chụp = đen THẬT — nơi gọi
     *   ghi xuống record (`saveVideo()`/`setVideoThumbnails()`) để scan không báo lỗi lặp.
     */
    extract(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const videoEl = document.createElement('video');
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.preload = 'auto';
            let settled = false;
            const dispose = () => {
                try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch (e) {} // giải phóng decoder thật sự, không chờ GC
                try { URL.revokeObjectURL(objectUrl); } catch (e) {}
            };
            const safetyTimeout = taskManager.once(() => fail(new Error('[extractVideoThumbAndMeta] timeout đọc video')), VIDEO_EXTRACT_TIMEOUT_MS);
            const fail = (err) => { if (settled) return; settled = true; safetyTimeout.kill(); dispose(); reject(err); };
            const succeed = (result) => { if (settled) return; settled = true; safetyTimeout.kill(); dispose(); resolve(result); };
            videoEl.addEventListener('error', () => fail(new Error('[extractVideoThumbAndMeta] không đọc được video')), { once: true });

            (async () => {
                try {
                    await new Promise((resolveMeta) => {
                        videoEl.addEventListener('loadedmetadata', resolveMeta, { once: true });
                        videoEl.src = objectUrl;
                    });
                    const width = videoEl.videoWidth, height = videoEl.videoHeight;
                    if (!width || !height) throw new Error('[extractVideoThumbAndMeta] video không có kích thước hợp lệ');

                    const first = await this._captureFirstFrame(videoEl, width, height);
                    const thumbFullBlob = await this._canvasToJpegBlob(first.canvas, 0.92);
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
