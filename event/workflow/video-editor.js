/**
 * event/workflow/video-editor.js — Workflow DUY NHẤT của `video-editor.html` v3 (23/07/2026). 32
 * field state RIÊNG của trang này sống trong `appState` (package `video-editor`, xem
 * `service/state/video-editor.js` + `service/state/record/video-editor.js`) — SỬA 25/07/2026 (đợt
 * tái cấu trúc state, 2 lượt: lượt 1 nhầm dùng EventStore cho state nghiệp vụ toàn trang — SAI
 * ranh giới EventStore chỉ dành cho "state context" nhỏ giữa 2 message; lượt 2 sửa lại đúng —
 * dùng CÙNG hạ tầng AppState/schema/registry() như mọi domain khác của app, KHÔNG phải cơ chế
 * riêng). Trước đây nhúng thẳng làm property của object literal `workflowVideoEditor`, giờ đọc/ghi
 * qua `appState.get('_xxx')`/`appState.set('_xxx', value)` trực tiếp trong từng method. (2 key
 * cross-cutting khác — `isGenericDrawerOpen`/`dbReadyPromise`, thuộc package khác — đọc/ghi CÙNG
 * `appState`, xem `service/state/record/video-editor.js`.)
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
 *
 * [v4, 24/07/2026, phản hồi Giang]
 * d) Bỏ hẳn "Chỉnh" (Brightness/Contrast/Saturation/Volume TOÀN CỤC — `_brightness/_contrast/
 *    _saturation/_volumeVideo` đã xoá). Volume giờ là thuộc tính RIÊNG của TỪNG đoạn trong
 *    `_videoClips[i].volume` (0-2, 1 = 100%, cùng thang đo `_audioClips[i].volume` đã có sẵn) — mở
 *    qua toolbar lúc đang CHỌN 1 đoạn Video (xem `handleVideoClipVolumeOpen()`).
 * e) "Dịch chuyển đoạn" (`handleSongShiftOpen()`) đổi từ thanh màu kéo tay sang waveform thật
 *    (WaveSurfer.js v7 + Regions, tái dùng đúng thư viện/pattern đã có ở subtitle-editor.html).
 *    Region LUÔN giữ NGUYÊN độ rộng (= độ dài clip) — kéo chỉ dịch `offsetInSong` (đúng logic cũ,
 *    `clampSongOffsetDrag()`, core/video-editor/audio-sync.js). Thêm nút Play phát ĐÚNG vùng chọn.
 *
 * [SỬA CÙNG NGÀY 24/07/2026 — Giang báo "mất tiếng cả video cả nhạc"] Bản đầu mục e có dùng GainNode
 * (`core/video-editor/media-gain.js`, `createMediaElementSource()`) để Volume >100% ra ĐÚNG cả
 * preview lẫn xuất thật — ĐÃ BỎ HẲN (file `media-gain.js` không còn dùng, XOÁ được). NGUYÊN NHÂN
 * câm tiếng: `createMediaElementSource()` tự NGẮT đường phát mặc định của thẻ media, âm thanh CHỈ
 * còn ra qua graph Web Audio tự nối — graph đó CHỈ chạy khi AudioContext ở trạng thái 'running',
 * trong khi context được tạo trong `_onMetadataReady()` (do sự kiện 'loadedmetadata', KHÔNG phải
 * user-gesture) MẶC ĐỊNH 'suspended' và KHÔNG hề được `.resume()` ở đâu — câm HẲN cả video lẫn nhạc,
 * kể cả volume=100% (không liên quan gì >100% nữa, toàn bộ đường phát bị khoá). Quay lại `.volume`
 * gốc kẹp [0,1] cho cả `videoEditorSourceEl`/`videoEditorSongAudioEl`/waveform preview — CHẤP NHẬN
 * giới hạn: volume >100% ở PREVIEW nghe như đúng 100% (thẻ media gốc không khuếch đại được), nhưng
 * lúc XUẤT THẬT (Lưu) vẫn khuếch đại ĐÚNG >100% (webcodecs-engine.js dùng OfflineAudioContext —
 * KHÔNG cần user-gesture vì không phát ra loa lúc dựng, không bị chính sách autoplay chặn).
 *
 * [SỬA THÊM 24/07/2026, phản hồi Giang — 2 việc]
 * 1) "Chỉ cần cân bằng Video/Nhạc, không cần khuếch đại vượt gốc" — 2 slider Volume (Video clip lẫn
 *    Nhạc clip) đổi từ 0-200% xuống 0-100% (mặc định 100%) — khớp ĐÚNG khả năng thật của `.volume`
 *    thẻ media gốc, không còn lý do giữ khoảng 100-200% (vốn chỉ hoạt động lúc xuất thật, không
 *    phải preview, xem đoạn trên) — dùng để MIX (kéo bên nào xuống cho bên kia nổi hơn).
 * 2) Clip Nhạc/Chữ THÊM MỚI hoặc NHÂN BẢN tự CẮT (`timelineEnd` kẹp lại) nếu vượt quá tổng thời
 *    lượng video hiện tại (`_totalDuration()`, xem `_recomputeTrackFullFlags()`,
 *    `_handleSongPickerSelect()`, `handleAddText()`, `handleDuplicateClip()`). Khi track Nhạc/Chữ đã
 *    "phủ kín" tới hết video (không còn chỗ có nghĩa để thêm), nút "Thêm nhạc"/"Thêm chữ" bị CHẶN
 *    HẲN kèm modal thông báo — dùng Block gate (event/block.js, đọc `videoEditAudioTrackFull`/
 *    `videoEditTextTrackFull` ở `service/state.js`, KHÔNG rẽ nhánh if/else ở Router/Workflow, đúng
 *    yêu cầu Giang "dùng Block thay vì Router, Block có notify sẵn").
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
    MIN_CLIP_GAP_SEC: 0.3, // độ dài tối thiểu 1 đoạn/khoảng cách tối thiểu tới mép khi trim/cắt — DÙNG CHUNG, tránh lặp `const MIN_GAP = 0.3` rải rác nhiều hàm. HẰNG SỐ THẬT — không mutate, KHÔNG sống trong appState.

    // SỬA (25/07/2026, đợt tái cấu trúc state, lượt 2) — 32 field state dưới đây KHÔNG còn là
    // property của object literal này nữa — sống thật trong `appState` (package `video-editor`,
    // xem `service/state/video-editor.js` + `service/state/record/video-editor.js`), CÙNG hạ tầng
    // schema/registry() như mọi domain khác. MỌI method bên dưới đọc/ghi qua
    // `appState.get('_xxx')`/`appState.set('_xxx', value)`.

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

        appState.set('_videoKey', videoKey);
        appState.set('_record', record);
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
        appState.set('_nativeW', videoEditorSourceEl.videoWidth || 16);
        appState.set('_nativeH', videoEditorSourceEl.videoHeight || 9);
        appState.set('_fullSourceDuration', videoEditorSourceEl.duration || 0);
        appState.set('_videoClips', [{ sourceStart: 0, sourceEnd: appState.get('_fullSourceDuration'), volume: 1 }]); // volume MỚI (mục d) — mặc định 100%
        appState.set('_currentClipIndex', 0);
        videoEditorPreviewCanvasEl.width = appState.get('_nativeW');
        videoEditorPreviewCanvasEl.height = appState.get('_nativeH');
        videoEditorEmptyStateEl.classList.add('hidden');
        videoEditorPlayheadEl.classList.remove('hidden');
        this._syncCurrentClipVolume(); // MỚI (mục d) — áp volume 100% mặc định của đoạn Video đầu tiên
        this._recomputeTrackFullFlags(); // MỚI (mục 2) — khởi tạo đúng cờ ban đầu (rỗng -> false)

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
            appState.set('_masterFilmstripFrames', await buildCutFilmstripFrames(appState.get('_record').blob, 30, 60, 64)); // core/video-editor/filmstrip.js — TRÍCH 1 LẦN duy nhất, dùng lại cho MỌI đoạn sau khi tách
            this._renderVideoTrack(); // vẽ lại RIÊNG track Video để hiện ảnh minh hoạ vừa trích xong
        } catch (err) {
            console.error('[_onMetadataReady] Lỗi trích filmstrip — bỏ qua ảnh minh hoạ, KHÔNG chặn phần còn lại của app:', err);
            appState.set('_masterFilmstripFrames', []);
        }
    },

    _totalDuration() { return computeVideoTotalDuration(appState.get('_videoClips')); }, // core/video-editor/timeline-calc.js

    /** [MỚI 24/07/2026, phản hồi Giang mục 2] Tính lại 2 cờ "track đã phủ kín video" — ghi vào
     * `appState` (service/state.js) để Block gate (event/block.js) đọc, CHẶN HẲN
     * `videoEdit.addMusic.open`/`videoEdit.addText.click` kèm `notify` khi đúng. "Phủ kín" = tồn
     * tại ÍT NHẤT 1 clip trong track đó có `timelineEnd` đã chạm/vượt tổng thời lượng video hiện
     * tại (`_totalDuration()`) — không còn khoảng trống Ý NGHĨA nào sau điểm đó để thêm 1 clip mới
     * (clip Nhạc/Chữ mới luôn mặc định phủ hết phần còn lại/toàn bộ video, xem
     * `_handleSongPickerSelect()`/`handleAddText()`).
     * GỌI LẠI mỗi khi `_audioClips`/`_textClips`/`_videoClips` đổi hình dạng (thêm/nhân bản/xoá/
     * tách/kéo trim clip BẤT KỲ track nào — kể cả Video, vì `_totalDuration()` phụ thuộc
     * `_videoClips`).
     * [SỬA 24/07/2026, Giang báo "không ấn được Thêm nhạc/Thêm chữ dù chưa có track nào"] — đã dò
     * lại kỹ toàn bộ logic (kể cả mô phỏng chạy thử eventBus.send() qua node) và KHÔNG tìm ra được
     * đường nào khiến cờ này sai thành `true` khi 2 mảng clip đang RỖNG — `.some()` trên mảng rỗng
     * LUÔN trả `false` bất kể `total` là gì. Bọc try/catch phòng thủ ở đây (không để 1 lỗi ngoài dự
     * kiến của appState — vd sai lệch bản deploy — làm hỏng LUÔN thao tác thêm/nhân bản/xoá clip
     * chính, vốn quan trọng hơn việc chặn khi đầy) — nếu Giang vẫn gặp lại, rất có thể do cache cũ
     * (SAV là PWA, xem ghi chú ở core/video-editor/media-gain.js) chứ không phải logic sai — cần mở
     * console kiểm tra có warning "[AppState.get]/[AppState.set] Account ... không có quyền" hay
     * không (dấu hiệu bản deploy thiếu file `service/state.js`/`video-editor.html` mới nhất). */
    _recomputeTrackFullFlags() {
        try {
            const total = this._totalDuration();
            const audioFull = total > 0 && appState.get('_audioClips').some((c) => c.timelineEnd >= total - 0.01);
            const textFull = total > 0 && appState.get('_textClips').some((c) => c.timelineEnd >= total - 0.01);
            appState.set('videoEditAudioTrackFull', audioFull);
            appState.set('videoEditTextTrackFull', textFull);
        } catch (err) {
            console.error('[_recomputeTrackFullFlags] Lỗi không lường trước — BỎ QUA, không để chặn thao tác chính:', err);
        }
    },

    /** [TÁI TẠO 24/07/2026, round 4] Tạo (đúng 1 LẦN) + `.resume()` 2 GainNode boost cho video/nhạc
     * — bắt buộc PHẢI gọi từ 1 user-gesture THẬT (nút Play/nút mở Drawer Volume) để trình duyệt cho
     * phép AudioContext chạy (chính sách autoplay) — xem docstring core/video-editor/media-gain.js.
     * Idempotent — gọi nhiều lần chỉ tạo 1 lần (guard `if (!this._xGainBoost)`), các lần sau chỉ
     * resume() lại (rẻ, cần thiết vì mobile Safari có thể tự suspend lại context sau khi app xuống
     * nền/bị gián đoạn — ngắt cuộc gọi tới, chuyển app...). */
    _ensureGainBoosts() {
        if (!appState.get('_videoGainBoost')) {
            try { appState.set('_videoGainBoost', createMediaGainBoost(videoEditorSourceEl)); } catch (err) { console.warn('[_ensureGainBoosts] Không tạo được GainNode cho video (volume sẽ không chỉnh được trên iOS):', err); }
        }
        if (!appState.get('_songGainBoost')) {
            try { appState.set('_songGainBoost', createMediaGainBoost(videoEditorSongAudioEl)); } catch (err) { console.warn('[_ensureGainBoosts] Không tạo được GainNode cho nhạc (volume sẽ không chỉnh được trên iOS):', err); }
        }
        if (appState.get('_videoGainBoost')) appState.get('_videoGainBoost').audioCtx.resume().catch((err) => console.warn('[_ensureGainBoosts] resume() video bị reject:', err));
        if (appState.get('_songGainBoost')) appState.get('_songGainBoost').audioCtx.resume().catch((err) => console.warn('[_ensureGainBoosts] resume() nhạc bị reject:', err));
    },

    _nextId() {
        const id = appState.get('_idCounter');
        appState.set('_idCounter', id + 1);
        return `c${id}`;
    },


    _totalRenderWidthSeconds() {
        return computeTimelineRenderWidthSeconds(appState.get('_videoClips'), appState.get('_audioClips'), appState.get('_textClips')); // core/video-editor/timeline-calc.js
    },

    // ===================== Vòng lặp render (taskManager mode raf) =====================

    _tick() {
        if (!appState.get('_isPlaying')) return;
        if (appState.get('_currentClipIndex') == null || !appState.get('_videoClips')[appState.get('_currentClipIndex')]) { this._pause(); return; }
        const clip = appState.get('_videoClips')[appState.get('_currentClipIndex')];
        if (videoEditorSourceEl.currentTime >= clip.sourceEnd - 0.03 || videoEditorSourceEl.ended) {
            if (appState.get('_currentClipIndex') + 1 < appState.get('_videoClips').length) {
                appState.set('_currentClipIndex', appState.get('_currentClipIndex') + 1);
                videoEditorSourceEl.currentTime = appState.get('_videoClips')[appState.get('_currentClipIndex')].sourceStart;
                videoEditorSourceEl.play().catch(() => {});
                this._syncCurrentClipVolume(); // MỚI (mục d) — đoạn Video mới có thể có volume khác đoạn vừa hết
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
        if (appState.get('_currentClipIndex') == null || !appState.get('_videoClips')[appState.get('_currentClipIndex')]) return 0;
        const clip = appState.get('_videoClips')[appState.get('_currentClipIndex')];
        const outputStart = computeOutputStartForClipIndex(appState.get('_videoClips'), appState.get('_currentClipIndex')); // core/video-editor/timeline-calc.js
        return outputStart + Math.max(0, videoEditorSourceEl.currentTime - clip.sourceStart);
    },

    /** [SỬA 24/07/2026, round 4 — Giang báo "vẫn chưa chỉnh được volume"] Áp volume của đoạn Video
     * ĐANG active (`_currentClipIndex`) — QUA GainNode (`_videoGainBoost`) nếu đã sẵn sàng (BẮT
     * BUỘC trên iOS — `.volume` gốc bị khoá cứng, xem docstring core/video-editor/media-gain.js),
     * fallback `.volume` gốc kẹp [0,1] nếu trình duyệt không hỗ trợ AudioContext (hiếm — trên iOS
     * fallback này sẽ KHÔNG có tác dụng, nhưng không throw). Gọi mỗi khi `_currentClipIndex` đổi
     * (`_tick()`/`_seekToOutputTime()`/`_previewVideoAtSourceTime()`), mỗi khi slider Volume của
     * đoạn đang chọn thay đổi, VÀ mỗi khi bấm Play (`_play()`, xem đó — trước đây THIẾU, khiến
     * volume vừa sửa không áp lại lúc bấm Play nếu đoạn hiện tại KHÔNG đổi). */
    _syncCurrentClipVolume() {
        const clip = appState.get('_currentClipIndex') != null ? appState.get('_videoClips')[appState.get('_currentClipIndex')] : null;
        const volume = clip && typeof clip.volume === 'number' ? clip.volume : 1;
        if (appState.get('_videoGainBoost')) applyMediaGainBoost(appState.get('_videoGainBoost'), volume); // core/video-editor/media-gain.js
        else videoEditorSourceEl.volume = Math.min(1, Math.max(0, volume));
    },

    _drawFrame() {
        const ctx = videoEditorPreviewCanvasEl.getContext('2d');
        const cropPx = computeCropPixels(appState.get('_cropFraction'), appState.get('_nativeW'), appState.get('_nativeH')); // core/video-editor/preview-draw.js
        const { outW, outH, deg } = computeRotatedOutputSize(cropPx, appState.get('_rotateDeg'));
        if (videoEditorPreviewCanvasEl.width !== outW) videoEditorPreviewCanvasEl.width = outW;
        if (videoEditorPreviewCanvasEl.height !== outH) videoEditorPreviewCanvasEl.height = outH;
        drawVideoPreviewFrame(ctx, videoEditorSourceEl, cropPx, deg, outW, outH);
        const outputTime = this._computeCurrentOutputTime();
        appState.get('_textClips').forEach((tc) => {
            if (outputTime >= tc.timelineStart && outputTime < tc.timelineEnd) drawTextOverlay(ctx, outW, outH, tc, outputTime);
        });
    },

    /** LƯU Ý (xem docstring đầu file): preview chỉ phát ĐÚNG 1 bài hát tại 1 thời điểm.
     * SỬA (Giang báo "nhạc bị biến dạng và méo") — bản trước nhảy thẳng `currentTime` mỗi khi lệch
     * > 0.2s, có thể xảy ra RẤT thường xuyên (mỗi frame ở ~60fps) do sai số tích luỹ nhỏ — nhảy
     * currentTime liên tục gây giật/rè tiếng ở nhiều trình duyệt. Nay: lệch NHỎ (0.08-0.35s) chỉ
     * chỉnh nhẹ `playbackRate` (êm tai hơn nhiều, tự từ từ bắt kịp) — CHỈ lệch LỚN (>0.35s, vd vừa
     * tua) mới nhảy thẳng `currentTime`. Cũng kẹp `targetTime` trong biên hợp lệ [0, songDuration]
     * — gán currentTime ra ngoài biên có thể khiến 1 số trình duyệt phát lỗi/im/rè.
     * [SỬA 24/07/2026, phản hồi Giang mục e — "kiểm tra âm lượng"] — BUG: trước đây `.volume` CHỈ
     * được gán ĐÚNG 1 LẦN lúc đổi bài hát (`_activePreviewAudioClipId !== active.id`) — nếu người
     * dùng kéo slider Volume trong Drawer "Dịch chuyển đoạn" TRONG LÚC clip đó đang là clip active,
     * âm lượng nghe được KHÔNG đổi cho tới lần đổi bài hát kế tiếp. Nay gán MỖI LẦN gọi hàm (mỗi
     * frame lúc đang phát) — rẻ, không có side-effect gì đáng kể.
     * [SỬA THÊM 24/07/2026, round 4 — Giang báo "vẫn chưa chỉnh được volume"] Quay lại GainNode
     * (`_songGainBoost`) — BẮT BUỘC trên iOS (`.volume` gốc bị khoá cứng, xem docstring core/
     * video-editor/media-gain.js), lần này tạo lười + resume() từ user-gesture thật (`_ensureGainBoosts()`,
     * gọi ở `_play()`/`handleSongShiftOpen()`) nên KHÔNG còn bug câm tiếng của bản thử trước. */
    _syncAudioClips(outputTime) {
        const active = appState.get('_audioClips').find((c) => outputTime >= c.timelineStart && outputTime < c.timelineEnd);
        if (!active) { videoEditorSongAudioEl.pause(); videoEditorSongAudioEl.playbackRate = 1; appState.set('_activePreviewAudioClipId', null); return; }
        if (appState.get('_activePreviewAudioClipId') !== active.id) {
            appState.set('_activePreviewAudioClipId', active.id);
            videoEditorSongAudioEl.src = URL.createObjectURL(active.record.blob);
            videoEditorSongAudioEl.playbackRate = 1;
        }
        if (appState.get('_songGainBoost')) applyMediaGainBoost(appState.get('_songGainBoost'), active.volume); // core/video-editor/media-gain.js
        else videoEditorSongAudioEl.volume = Math.min(1, Math.max(0, active.volume));
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
        if (appState.get('_isPlaying') && videoEditorSongAudioEl.paused) videoEditorSongAudioEl.play().catch(() => {});
    },

    _updateTimeDisplay(outputTime) {
        videoEditorCurrentTimeEl.textContent = formatClipTimeLabel(outputTime); // core/video-editor/timeline-calc.js
        videoEditorTotalTimeEl.textContent = formatClipTimeLabel(this._totalDuration());
        videoEditorPlayheadEl.style.left = `${computePlayheadLeftPx(outputTime, appState.get('_pixelsPerSecond'))}px`;
        videoEditorPlayheadTimeEl.textContent = formatClipTimeLabel(outputTime);
    },

    _seekToOutputTime(outputSeconds) {
        const total = this._totalDuration();
        const clamped = Math.max(0, Math.min(outputSeconds, total));
        const lastClip = appState.get('_videoClips')[appState.get('_videoClips').length - 1];
        const found = findVideoClipAtOutputTime(appState.get('_videoClips'), clamped) // core/video-editor/timeline-calc.js
            || (lastClip ? { index: appState.get('_videoClips').length - 1, sourceSplitPoint: lastClip.sourceEnd } : null); // clamped === total (mép cuối cùng) — findVideoClipAtOutputTime dùng "<" nghiêm ngặt nên không khớp, tự rơi về cuối đoạn cuối
        if (!found) return;
        appState.set('_currentClipIndex', found.index);
        videoEditorSourceEl.currentTime = found.sourceSplitPoint;
        this._syncCurrentClipVolume(); // MỚI (mục d) — đoạn Video có thể đổi sau khi tua
        this._syncAudioClips(clamped);
        this._updateTimeDisplay(clamped);
        this._drawFrame();
    },

    // ===================== Transport =====================

    handleTogglePlay() { if (appState.get('_isPlaying')) this._pause(); else this._play(); },

    /** [SỬA 24/07/2026, round 4] Bấm Play là 1 user-gesture THẬT — đúng chỗ để
     * `_ensureGainBoosts()` tạo/`.resume()` GainNode (bắt buộc trên iOS). CŨNG SỬA 1 bug thật tìm ra
     * lúc rà lại: hàm này TRƯỚC ĐÂY KHÔNG hề gọi `_syncCurrentClipVolume()` — nếu người dùng chỉnh
     * Volume của đoạn Video trong lúc ĐANG TẠM DỪNG (không phải đoạn đang active lúc đó theo
     * `_currentClipIndex`) rồi bấm Play, giá trị mới KHÔNG BAO GIỜ được áp lại (chỉ áp khi
     * `_currentClipIndex` ĐỔI SANG đoạn khác, không áp lại khi Play LẠI đúng đoạn cũ vừa sửa). */
    _play() {
        if (!appState.get('_videoClips').length) return;
        const total = this._totalDuration();
        const cur = this._computeCurrentOutputTime();
        if (cur >= total - 0.05 || appState.get('_currentClipIndex') == null) this._seekToOutputTime(0);
        appState.set('_isPlaying', true);
        videoEditorPlayIconEl.textContent = '❚❚';
        this._ensureGainBoosts(); // MỚI (mục 2, iOS) — PHẢI gọi trong user-gesture này, không được trễ hơn
        this._syncCurrentClipVolume(); // SỬA — áp ĐÚNG volume đoạn hiện tại NGAY LÚC BẤM PLAY
        videoEditorSourceEl.play().catch(() => {});
        this._syncAudioClips(this._computeCurrentOutputTime());
        taskManager.resume('videoEditorPreviewRender');
    },

    _pause() {
        appState.set('_isPlaying', false);
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
        if (appState.get('_isPlaying')) this._pause();
        const rect = videoEditorTimelineContentEl.getBoundingClientRect();
        const sec = pxToSeconds(clientX - rect.left, appState.get('_pixelsPerSecond'));
        this._seekToOutputTime(sec);
    },

    /** MỚI — Giang yêu cầu: nhấn vào chữ trên preview phải kéo di chuyển được (2 chiều — trước chỉ
     * chỉnh được `posY`). Chạm gần dòng chữ nào (đang hiển thị tại thời điểm hiện tại) thì chọn +
     * kéo dòng đó, đổi `posX`/`posY` theo % kích thước canvas. */
    handlePreviewTextDragStart(canvasX, canvasY) {
        const outputTime = this._computeCurrentOutputTime();
        const ctx = videoEditorPreviewCanvasEl.getContext('2d');
        const canvasW = videoEditorPreviewCanvasEl.width || 1;
        const canvasH = videoEditorPreviewCanvasEl.height || 1;
        const index = findTextClipAtPoint(ctx, appState.get('_textClips'), outputTime, canvasX, canvasY, canvasW, canvasH, 28); // core/video-editor/preview-draw.js — hộp bao thật (đo ctx.measureText), có tính xoay
        if (index == null) { appState.set('_previewTextDragIndex', null); return; }
        appState.set('_previewTextDragIndex', index);
        appState.set('_selected', { track: 'text', index });
        this._renderAllTracks();
        this._renderToolbar();
    },

    handlePreviewTextDragMove(canvasX, canvasY) {
        if (appState.get('_previewTextDragIndex') == null) return;
        const clip = appState.get('_textClips')[appState.get('_previewTextDragIndex')];
        if (!clip) return;
        const canvasW = videoEditorPreviewCanvasEl.width || 1;
        const canvasH = videoEditorPreviewCanvasEl.height || 1;
        clip.posX = Math.max(2, Math.min(98, Math.round((canvasX / canvasW) * 100)));
        clip.posY = Math.max(2, Math.min(98, Math.round((canvasY / canvasH) * 100)));
        appState.set('_hasUnsavedChanges', true);
        this._drawFrame();
    },

    handlePreviewTextDragEnd() {
        if (appState.get('_previewTextDragIndex') != null) this._renderAllTracks();
        appState.set('_previewTextDragIndex', null);
    },

    /** MỚI — Giang yêu cầu: co giãn kích cỡ + xoay Text trên preview. Cử chỉ 2 ngón (pinch):
     * khoảng cách 2 ngón đổi = co giãn `size`, góc 2 ngón đổi = xoay `rotation`. Toán tính ở Core
     * (`computePinchTransform()`, core/video-editor/preview-draw.js) — Workflow chỉ giữ giá trị
     * GỐC lúc bắt đầu cử chỉ (`_pinchState`) rồi áp kết quả mới vào clip đang chọn. */
    handlePreviewTextPinchStart() {
        if (!appState.get('_selected') || appState.get('_selected').track !== 'text') { appState.set('_pinchState', null); return; }
        const clip = appState.get('_textClips')[appState.get('_selected').index];
        if (!clip) { appState.set('_pinchState', null); return; }
        appState.set('_pinchState', { baseSize: clip.size, baseRotation: clip.rotation || 0 });
    },

    handlePreviewTextPinchMove(startDist, startAngleDeg, currentDist, currentAngleDeg) {
        if (!appState.get('_pinchState') || !appState.get('_selected') || appState.get('_selected').track !== 'text') return;
        const clip = appState.get('_textClips')[appState.get('_selected').index];
        if (!clip) return;
        const result = computePinchTransform(startDist, startAngleDeg, currentDist, currentAngleDeg, appState.get('_pinchState').baseSize, appState.get('_pinchState').baseRotation); // core/video-editor/preview-draw.js
        clip.size = result.newSize;
        clip.rotation = result.newRotation;
        appState.set('_hasUnsavedChanges', true);
        this._drawFrame();
    },

    handlePreviewTextPinchEnd() {
        appState.set('_pinchState', null);
        this._renderAllTracks();
    },

    // ===================== Chọn clip (viền + toolbar theo ngữ cảnh) =====================

    _isSelected(track, index) { return !!appState.get('_selected') && appState.get('_selected').track === track && appState.get('_selected').index === index; },

    handleSelectClip(track, index) {
        appState.set('_selected', { track, index });
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleDeselect() {
        appState.set('_selected', null);
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
        videoEditorTimelineContentEl.style.width = `${Math.max(renderWidthSec, 1) * appState.get('_pixelsPerSecond')}px`;
        if (renderWidthSec > totalDuration + 0.05) {
            videoEditorDurationEndMarkerEl.classList.remove('hidden');
            videoEditorDurationEndMarkerEl.style.left = `${totalDuration * appState.get('_pixelsPerSecond')}px`;
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
        const layout = computeVideoClipsLayout(appState.get('_videoClips'), appState.get('_pixelsPerSecond'));
        appState.get('_videoClips').forEach((clip, index) => {
            const l = layout[index];
            const el = document.createElement('div');
            el.className = `absolute h-full top-0 bg-slate-800 rounded-lg overflow-hidden border-2 ${this._isSelected('video', index) ? 'border-white' : 'border-transparent'}`;
            el.style.left = `${l.leftPx}px`;
            el.style.width = `${Math.max(l.widthPx, 8)}px`;

            const handleStart = document.createElement('div');
            handleStart.className = 'video-editor-clip-handle absolute left-0 top-0 bottom-0 w-4 bg-white z-10 rounded-l-md';
            const filmstrip = document.createElement('div');
            filmstrip.className = 'absolute inset-0 flex pointer-events-none';
            (appState.get('_masterFilmstripFrames') || []).filter((f) => f.blob && f.timestamp >= clip.sourceStart && f.timestamp <= clip.sourceEnd).forEach((f) => {
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
        const layout = computeVideoClipsLayout(appState.get('_videoClips'), appState.get('_pixelsPerSecond'));
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
            const { leftPx, widthPx } = computeClipLayoutPx(clip.timelineStart, clip.timelineEnd - clip.timelineStart, appState.get('_pixelsPerSecond'));
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

    _renderAudioTrack() { this._renderFreeClipTrack(videoEditorTrackAudioEl, appState.get('_audioClips'), 'audio', 'bg-emerald-500/80', (c) => c.record.tag.title || c.songKey); },
    _renderTextTrack() { this._renderFreeClipTrack(videoEditorTrackTextEl, appState.get('_textClips'), 'text', 'bg-purple-500/80', (c) => c.val); },

    _layoutSingleFreeClip(track, index) {
        const list = track === 'audio' ? appState.get('_audioClips') : appState.get('_textClips');
        const clip = list[index];
        const containerEl = track === 'audio' ? videoEditorTrackAudioEl : videoEditorTrackTextEl;
        const el = containerEl.children[index];
        if (!clip || !el) return;
        const { leftPx, widthPx } = computeClipLayoutPx(clip.timelineStart, clip.timelineEnd - clip.timelineStart, appState.get('_pixelsPerSecond'));
        el.style.left = `${leftPx}px`;
        el.style.width = `${Math.max(widthPx, 8)}px`;
        this._updateTimelineWidthAndMarker(this._totalDuration());
    },

    // ===================== Kéo-thả timeline (trim/move — chung cho cả 3 track) =====================

    handleTimelineDragStart(track, index, handleType, clientX) {
        appState.set('_dragHandle', { track, index, handleType });
        appState.set('_dragLastClientX', clientX);
    },

    /** Delta-based (so với lần move TRƯỚC, không phải toạ độ tuyệt đối) — bền vững kể cả khi
     * `#video-editor-timeline-container` đang cuộn dở (không cần đo `getBoundingClientRect()`). */
    handleTimelineDragMove(clientX) {
        if (!appState.get('_dragHandle')) return;
        const { track, index, handleType } = appState.get('_dragHandle');
        const deltaSec = pxToSeconds(clientX - appState.get('_dragLastClientX'), appState.get('_pixelsPerSecond')); // core/video-editor/timeline-calc.js
        appState.set('_dragLastClientX', clientX);
        const MIN_GAP = this.MIN_CLIP_GAP_SEC;

        if (track === 'video') {
            const clip = appState.get('_videoClips')[index];
            if (!clip) return;
            // Toán RIPPLE (giữ cố định mép ĐỐI DIỆN — Giang yêu cầu) nằm ở Core, xem docstring
            // `computeVideoStartTrim()`/`computeVideoEndTrim()`, core/video-editor/timeline-calc.js.
            if (handleType === 'start') {
                const result = computeVideoStartTrim(appState.get('_videoClips'), index, deltaSec, MIN_GAP, appState.get('_fullSourceDuration'));
                clip.sourceStart = result.newSourceStart;
                if (result.prevSourceEnd != null) appState.get('_videoClips')[index - 1].sourceEnd = result.prevSourceEnd;
                this._previewVideoAtSourceTime(index, clip.sourceStart);
            } else if (handleType === 'end') {
                const result = computeVideoEndTrim(appState.get('_videoClips'), index, deltaSec, MIN_GAP, appState.get('_fullSourceDuration'));
                clip.sourceEnd = result.newSourceEnd;
                if (result.nextSourceStart != null) appState.get('_videoClips')[index + 1].sourceStart = result.nextSourceStart;
                this._previewVideoAtSourceTime(index, Math.max(clip.sourceStart, clip.sourceEnd - 0.05));
            }
            this._layoutVideoTrackLive();
        } else {
            const list = track === 'audio' ? appState.get('_audioClips') : appState.get('_textClips');
            const clip = list[index];
            if (!clip) return;
            const result = computeFreeClipDrag(clip, handleType, deltaSec, MIN_GAP); // core/video-editor/timeline-calc.js
            clip.timelineStart = result.timelineStart;
            clip.timelineEnd = result.timelineEnd;
            this._layoutSingleFreeClip(track, index);
            if (handleType === 'start' || handleType === 'move') this._seekToOutputTime(clip.timelineStart);
            else this._seekToOutputTime(Math.max(clip.timelineStart, clip.timelineEnd - 0.05));
        }
        appState.set('_hasUnsavedChanges', true);
    },

    /** Nhảy `<video>` tới đúng giây NGUỒN đang kéo (start/end) VÀ vẽ lại preview ngay khi khung đó
     * decode xong — MỚI (Giang báo trim không cập nhật preview). `clipIndex` cập nhật luôn
     * `_currentClipIndex` để current-time hiển thị đúng theo track Video đang chỉnh. */
    _previewVideoAtSourceTime(clipIndex, sourceTime) {
        appState.set('_currentClipIndex', clipIndex);
        videoEditorSourceEl.currentTime = Math.max(0, Math.min(sourceTime, Math.max(0, appState.get('_fullSourceDuration') - 0.01)));
        this._syncCurrentClipVolume(); // MỚI (mục d) — đang xem trước đoạn nào thì áp đúng volume đoạn đó
        videoEditorSourceEl.addEventListener('seeked', () => {
            this._drawFrame();
            this._updateTimeDisplay(this._computeCurrentOutputTime());
        }, { once: true });
    },

    handleTimelineDragEnd() {
        if (!appState.get('_dragHandle')) return;
        appState.set('_dragHandle', null);
        this._recomputeTrackFullFlags(); // MỚI (mục 2) — trim Video đổi _totalDuration(), trim/dời Nhạc/Chữ đổi timelineEnd
        this._drawFrame();
        this._renderAllTracks(); // đồng bộ đầy đủ (viền chọn, marker, độ rộng) — filmstrip KHÔNG trích lại (đã cache _masterFilmstripFrames, chỉ lọc theo range)
    },

    // ===================== Cắt tại current / Nhân bản / Xoá / Đổi thứ tự =====================

    handleCutAtCurrent() {
        if (!appState.get('_selected')) return;
        const outputTime = this._computeCurrentOutputTime();
        const { track, index } = appState.get('_selected');
        const MIN_GAP = this.MIN_CLIP_GAP_SEC;

        if (track === 'video') {
            const found = findVideoClipAtOutputTime(appState.get('_videoClips'), outputTime); // core/video-editor/timeline-calc.js
            if (!found || found.index !== index) return; // guard — con trỏ không nằm trong đúng đoạn đang chọn
            const clip = appState.get('_videoClips')[index];
            if (found.sourceSplitPoint <= clip.sourceStart + MIN_GAP || found.sourceSplitPoint >= clip.sourceEnd - MIN_GAP) return; // guard — quá sát mép
            const [a, b] = splitRangeAt(clip.sourceStart, clip.sourceEnd, found.sourceSplitPoint); // core/video-editor/timeline-calc.js
            appState.get('_videoClips').splice(index, 1, { sourceStart: a.start, sourceEnd: a.end, volume: clip.volume }, { sourceStart: b.start, sourceEnd: b.end, volume: clip.volume }); // volume (mục d) — GIỮ NGUYÊN cho cả 2 nửa
            appState.set('_selected', { track: 'video', index });
        } else {
            const list = track === 'audio' ? appState.get('_audioClips') : appState.get('_textClips');
            const clip = list[index];
            if (!clip || outputTime <= clip.timelineStart + MIN_GAP || outputTime >= clip.timelineEnd - MIN_GAP) return;
            const originalStart = clip.timelineStart;
            const [a, b] = splitRangeAt(clip.timelineStart, clip.timelineEnd, outputTime);
            const cloneB = Object.assign({}, clip, { timelineStart: b.start, timelineEnd: b.end });
            if (track === 'audio') cloneB.offsetInSong = clip.offsetInSong + (b.start - originalStart); // giữ liền mạch nội dung bài hát qua điểm cắt
            clip.timelineStart = a.start; clip.timelineEnd = a.end;
            list.splice(index + 1, 0, cloneB);
        }
        appState.set('_hasUnsavedChanges', true);
        this._recomputeTrackFullFlags(); // MỚI (mục 2)
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleDuplicateClip() {
        if (!appState.get('_selected')) return;
        const { track, index } = appState.get('_selected');
        if (track === 'video') {
            appState.get('_videoClips').splice(index + 1, 0, Object.assign({}, appState.get('_videoClips')[index]));
            appState.set('_selected', { track: 'video', index: index + 1 });
        } else {
            const list = track === 'audio' ? appState.get('_audioClips') : appState.get('_textClips');
            const clip = list[index];
            const length = clip.timelineEnd - clip.timelineStart;
            // [SỬA 24/07/2026, phản hồi Giang mục 2] Nhân bản đặt NGAY SAU bản gốc — TỰ CẮT nếu vượt
            // quá tổng thời lượng video hiện tại (không thể có Nhạc/Chữ kéo dài hơn chính video).
            // Nếu KHÔNG còn đủ chỗ (< MIN_CLIP_GAP_SEC) sau bản gốc, bỏ qua hẳn (không tạo bản trùng
            // gần như 0 giây, vô nghĩa) — CHẶN modal đã lo phần "Thêm nhạc/Thêm chữ" (event/block.js),
            // đây chỉ là 1 guard câm lặng cho riêng hành động Nhân bản (khác msg.type, không qua Block gate).
            const total = this._totalDuration();
            const room = total - clip.timelineEnd;
            if (room <= this.MIN_CLIP_GAP_SEC) return; // guard — hết chỗ, không nhân bản
            const dup = Object.assign({}, clip, { id: this._nextId(), timelineStart: clip.timelineEnd, timelineEnd: Math.min(clip.timelineEnd + length, total) });
            list.splice(index + 1, 0, dup);
            appState.set('_selected', { track, index: index + 1 });
        }
        appState.set('_hasUnsavedChanges', true);
        this._recomputeTrackFullFlags(); // MỚI (mục 2)
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleDeleteClip() {
        if (!appState.get('_selected')) return;
        const { track, index } = appState.get('_selected');
        if (track === 'video') {
            if (appState.get('_videoClips').length <= 1) return; // guard — KHÔNG được xoá đoạn Video DUY NHẤT còn lại (không thể có Video rỗng)
            appState.get('_videoClips').splice(index, 1);
            if (appState.get('_currentClipIndex') != null && appState.get('_currentClipIndex') >= appState.get('_videoClips').length) appState.set('_currentClipIndex', appState.get('_videoClips').length - 1);
        } else {
            const list = track === 'audio' ? appState.get('_audioClips') : appState.get('_textClips');
            list.splice(index, 1);
        }
        appState.set('_selected', null);
        appState.set('_hasUnsavedChanges', true);
        this._recomputeTrackFullFlags(); // MỚI (mục 2)
        this._renderAllTracks();
        this._renderToolbar();
    },

    handleMoveClipEarlier() {
        if (!appState.get('_selected') || appState.get('_selected').track !== 'video' || appState.get('_selected').index <= 0) return;
        const { index } = appState.get('_selected');
        const arr = appState.get('_videoClips');
        [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
        appState.set('_selected', { track: 'video', index: index - 1 });
        this._afterVideoClipsReordered();
    },

    handleMoveClipLater() {
        if (!appState.get('_selected') || appState.get('_selected').track !== 'video' || appState.get('_selected').index >= appState.get('_videoClips').length - 1) return;
        const { index } = appState.get('_selected');
        const arr = appState.get('_videoClips');
        [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
        appState.set('_selected', { track: 'video', index: index + 1 });
        this._afterVideoClipsReordered();
    },

    _afterVideoClipsReordered() {
        appState.set('_hasUnsavedChanges', true);
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

        if (!appState.get('_selected')) {
            addBtn(_veIcon('crop'), 'videoEdit.btnCrop.title', 'videoEdit.crop.click');
            addBtn(_veIcon('rotateLeft'), 'videoEdit.btnRotateLeft.title', 'videoEdit.rotateLeft.click');
            addBtn(_veIcon('rotateRight'), 'videoEdit.btnRotateRight.title', 'videoEdit.rotateRight.click');
            addBtn(_veIcon('reset'), 'videoEdit.btnReset.title', 'videoEdit.reset.click');
            addBtn(_veIcon('extractFrame'), 'videoEdit.btnExtractFrame.title', 'videoEdit.extractFrame.click');
            addBtn(_veIcon('addMusic'), 'videoEdit.btnAddMusic.title', 'videoEdit.addMusic.open');
            addBtn('<span class="font-bold text-sm">T</span>', 'videoEdit.btnAddText.title', 'videoEdit.addText.click');
            return;
        }

        const { track } = appState.get('_selected');
        addBtn(_veIcon('deselect'), 'videoEdit.btnDeselect.title', 'videoEdit.deselect.click');
        addBtn(_veIcon('cut'), 'videoEdit.btnCutCurrent.title', 'videoEdit.cutAtCurrent.click');
        addBtn(_veIcon('duplicate'), 'videoEdit.btnDuplicate.title', 'videoEdit.duplicateClip.click');

        if (track === 'video') {
            // MỚI (24/07/2026, mục d) — Volume RIÊNG của đoạn Video đang chọn (thay "Chỉnh" toàn cục đã bỏ).
            addBtn(_veIcon('volume'), 'videoEdit.btnVolume.title', 'videoEdit.videoClipVolume.open');
            if (appState.get('_videoClips').length > 1) {
                addBtn(_veIcon('delete'), 'videoEdit.btnDelete.title', 'videoEdit.deleteClip.click');
                if (appState.get('_selected').index > 0) addBtn(_veIcon('moveLeft'), 'videoEdit.btnMoveEarlier.title', 'videoEdit.moveClipEarlier.click');
                if (appState.get('_selected').index < appState.get('_videoClips').length - 1) addBtn(_veIcon('moveRight'), 'videoEdit.btnMoveLater.title', 'videoEdit.moveClipLater.click');
            }
        } else {
            addBtn(_veIcon('delete'), 'videoEdit.btnDelete.title', 'videoEdit.deleteClip.click');
            if (track === 'audio') addBtn(_veIcon('shiftSegment'), 'videoEdit.btnShiftSegment.title', 'videoEdit.songShift.open');
            else addBtn('<span class="font-bold text-sm">Aa</span>', 'videoEdit.btnEditText.title', 'videoEdit.textEdit.open');
        }
    },

    // ===================== Crop (Cropper.js — toàn cục, không đổi so với v2) =====================

    handleCropOpen() {
        if (!appState.get('_nativeW')) return;
        this._pause();
        const canvas = document.createElement('canvas');
        canvas.width = appState.get('_nativeW');
        canvas.height = appState.get('_nativeH');
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
        if (!appState.get('_cropper')) return;
        setAspectRatioSession(appState.get('_cropper'), ratio); // core/image-editor/cropper-engine.js — luôn tính lại từ ảnh gốc, đổi qua lại nhiều lần không biến dạng cộng dồn
    },

    _initCropper() {
        if (appState.get('_cropper')) destroyCropperSession(appState.get('_cropper')); // core/image-editor/cropper-engine.js
        const cropFraction = appState.get('_cropFraction');
        appState.set('_cropper', initCropperSession(videoEditorCropSourceEl, {
            viewMode: 1, autoCropArea: 1, background: false, responsive: true,
            ready() {
                if (!cropFraction) return;
                const w = videoEditorCropSourceEl.naturalWidth;
                const h = videoEditorCropSourceEl.naturalHeight;
                this.cropper.setData({ x: cropFraction.x * w, y: cropFraction.y * h, width: cropFraction.w * w, height: cropFraction.h * h });
            },
        }));
    },

    handleCropConfirm() {
        if (!appState.get('_cropper')) return;
        const data = getCropDataFromSession(appState.get('_cropper'), true); // core/image-editor/cropper-engine.js
        const w = videoEditorCropSourceEl.naturalWidth;
        const h = videoEditorCropSourceEl.naturalHeight;
        appState.set('_cropFraction', { x: data.x / w, y: data.y / h, w: data.width / w, h: data.height / h });
        appState.set('_hasUnsavedChanges', true);
        this._closeCropOverlay();
        this._drawFrame();
    },

    handleCropCancel() { this._closeCropOverlay(); },

    _closeCropOverlay() {
        if (appState.get('_cropper')) { destroyCropperSession(appState.get('_cropper')); appState.set('_cropper', null); }
        videoEditorCropOverlayEl.classList.add('hidden');
    },

    handleCropReset() { appState.set('_cropFraction', null); appState.set('_hasUnsavedChanges', true); this._drawFrame(); },

    // ===================== Rotate / Reset (toàn cục) =====================

    handleRotateLeft() { appState.set('_rotateDeg', ((appState.get('_rotateDeg') - 90) % 360 + 360) % 360); appState.set('_hasUnsavedChanges', true); this._drawFrame(); },
    handleRotateRight() { appState.set('_rotateDeg', (appState.get('_rotateDeg') + 90) % 360); appState.set('_hasUnsavedChanges', true); this._drawFrame(); },

    /** [SỬA 24/07/2026, mục d] — bỏ reset Brightness/Contrast/Saturation/Volume toàn cục ("Chỉnh"
     * đã bỏ hẳn). Volume giờ RIÊNG từng đoạn Video — không có ý nghĩa "reset toàn cục" nữa, muốn về
     * 100% thì kéo lại slider trong Drawer Volume của đúng đoạn đó (handleVideoClipVolumeOpen()). */
    handleReset() {
        appState.set('_cropFraction', null);
        appState.set('_rotateDeg', 0);
        appState.set('_hasUnsavedChanges', true);
        this._drawFrame();
    },

    // ===================== Generic Drawer — khung DÙNG CHUNG cho Volume Video/Sửa chữ/Chọn nhạc/Dịch
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
     * preview sau khi đóng — AN TOÀN dù vừa đóng loại nội dung nào (đổi volume/text/nhạc đều cần).
     * [SỬA 24/07/2026, mục e] — luôn dọn WaveSurfer của "Dịch chuyển đoạn" nếu đang sống (an toàn
     * dù đóng từ loại nội dung Drawer nào — no-op nếu không phải đang mở "Dịch chuyển đoạn"). */
    _closeGenericDrawerFully() {
        this._destroyShiftWaveform();
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
        this._renderAllTracks();
        this._renderToolbar();
        this._drawFrame();
    },

    // ===================== Volume RIÊNG từng đoạn Video — MỚI (24/07/2026, mục d, thay "Chỉnh") =====================

    _activeVideoClip() { return appState.get('_selected') && appState.get('_selected').track === 'video' ? appState.get('_videoClips')[appState.get('_selected').index] : null; },

    /** [SỬA 24/07/2026, phản hồi Giang mục 1] "Có thể tăng giảm âm thanh để mix video với nhạc" —
     * chỉ cần CÂN BẰNG 2 track (kéo bên nào xuống cho bên kia nổi hơn), KHÔNG cần khuếch đại vượt
     * mức gốc — bỏ hẳn 0-200%, giờ 0-100% (mặc định 100%).
     * [SỬA THÊM round 4] Mở Drawer này CŨNG là 1 user-gesture thật — gọi `_ensureGainBoosts()` ngay
     * (bắt buộc trên iOS, xem core/video-editor/media-gain.js) để chắc chắn AudioContext đã chạy
     * trước khi người dùng kéo slider. Nếu đoạn đang chọn CŨNG là đoạn đang phát
     * (`_currentClipIndex`), áp NGAY qua `_syncCurrentClipVolume()` để nghe thấy thay đổi tức thời —
     * nếu KHÔNG phải đoạn đang phát, chỉ ghi vào `clip.volume`, lần tới đoạn đó active
     * `_syncCurrentClipVolume()` tự đọc đúng giá trị mới (và `_play()` cũng tự áp lại lúc bấm Play). */
    handleVideoClipVolumeOpen() {
        const clip = this._activeVideoClip();
        if (!clip) return;
        this._ensureGainBoosts(); // MỚI (mục 2, iOS) — mở Drawer Volume = user-gesture thật
        const volumePercent = Math.round((typeof clip.volume === 'number' ? clip.volume : 1) * 100);
        const bodyHtml = `
            <div class="px-4 flex flex-col gap-5 video-editor-gd-body-pb">
                <div><label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.videoClipVolume.label'))}</span><span id="ve-gd-video-vol-val">${volumePercent}%</span></label><input type="range" id="ve-gd-video-vol" min="0" max="100" value="${volumePercent}" class="w-full ve-range"></div>
            </div>`;
        openGenericDrawer({ height: 'auto', maxHeight: '40vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.videoClipVolume.title')), bodyHtml });
        this._wireDrawerCloseButton();

        const volEl = genericDrawerBody.querySelector('#ve-gd-video-vol');
        const volValEl = genericDrawerBody.querySelector('#ve-gd-video-vol-val');
        _paintRangeFill(volEl); // MỚI (mục 3) — tô màu dải đã kéo ngay lúc mở, không đợi tới lần 'input' đầu tiên
        volEl.addEventListener('input', () => {
            const c = this._activeVideoClip();
            if (!c) return;
            c.volume = (parseInt(volEl.value, 10) || 0) / 100;
            volValEl.textContent = `${volEl.value}%`;
            _paintRangeFill(volEl); // MỚI (mục 3)
            appState.set('_hasUnsavedChanges', true);
            if (appState.get('_currentClipIndex') === appState.get('_selected').index) this._syncCurrentClipVolume(); // nghe thấy NGAY nếu đúng đoạn đang phát
        });
    },

    // ===================== Trích xuất ảnh (không đổi) =====================

    async handleExtractFrame() {
        if (!appState.get('_nativeW')) return;
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
            <div class="px-4 flex flex-col gap-2.5 h-full video-editor-gd-body-pb">
                <div class="relative shrink-0">
                    <input id="ve-gd-song-search" type="text" inputmode="search" autocomplete="off" placeholder="${_escapeVideoEditorHtml(t('videoEdit.songSearch.placeholder'))}" class="w-full bg-slate-100 border border-slate-200 rounded-xl pl-3 pr-8 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none">
                    <button id="ve-gd-song-search-clear" type="button" class="hidden absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm leading-none">&times;</button>
                </div>
                <div id="ve-gd-song-list" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1"></div>
            </div>`;
        openGenericDrawer({ height: '70vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.songPicker.title')), bodyHtml, bodyClass: 'overflow-hidden flex flex-col' });
        this._wireDrawerCloseButton();

        appState.set('_songSearchQuery', ''); // MỖI LẦN MỞ reset rỗng — không tự hiện toàn bộ danh sách
        const searchEl = genericDrawerBody.querySelector('#ve-gd-song-search');
        const clearBtn = genericDrawerBody.querySelector('#ve-gd-song-search-clear');
        searchEl.addEventListener('input', () => {
            appState.set('_songSearchQuery', normalizeSongName(searchEl.value)); // core/song-search.js
            clearBtn.classList.toggle('hidden', !searchEl.value);
            this._renderSongList();
        });
        clearBtn.addEventListener('click', () => {
            searchEl.value = '';
            clearBtn.classList.add('hidden');
            appState.set('_songSearchQuery', '');
            this._renderSongList();
            searchEl.focus();
        });
        this._ensureSongListLoaded();
        this._renderSongList(); // hiện NGAY thông báo "gõ để tìm" trước khi danh sách tải xong
    },

    async _ensureSongListLoaded() {
        if (appState.get('_songListCache')) return;
        const keys = await getAllSongKeys();
        const records = await Promise.all(keys.map(async (key) => {
            const record = await getSongRecord(key);
            return record ? { key, tag: record.tag, duration: record.duration } : null;
        }));
        appState.set('_songListCache', records.filter(Boolean));
        this._renderSongList();
    },

    _renderSongList() {
        const listEl = genericDrawerBody.querySelector('#ve-gd-song-list');
        if (!listEl) return; // drawer đã đóng/đổi nội dung khác trong lúc đang tải — bỏ qua an toàn
        const query = appState.get('_songSearchQuery');
        if (!query) {
            listEl.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">${_escapeVideoEditorHtml(t('videoEdit.songSearch.emptyPrompt'))}</p>`;
            return;
        }
        const filtered = (appState.get('_songListCache') || []).filter((item) => songMatchesQuery(query, item.tag.title, item.tag.artist, item.tag.album)); // core/song-search.js
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

    /** [SỬA 24/07/2026 — Giang báo "mặc định min time khi add nhạc là 10s"] Clip Nhạc MỚI THÊM giờ
     * LUÔN mặc định phủ TOÀN BỘ video (`timelineStart:0` tới `timelineEnd:this._totalDuration()`),
     * KHÔNG còn 10 giây cố định tại vị trí con trỏ (`outputTime`) như trước — kẹp lại theo đúng độ
     * dài THẬT của bài hát nếu bài NGẮN HƠN video (không thể kéo dài hơn nội dung âm thanh sẵn có,
     * chưa có tính năng lặp lại bài hát). */
    async _handleSongPickerSelect(songKey) {
        const record = await getSongRecord(songKey);
        if (!record) return;
        const totalDuration = this._totalDuration();
        const length = Math.min(totalDuration, record.duration || totalDuration);
        appState.get('_audioClips').push({ id: this._nextId(), songKey, record, timelineStart: 0, timelineEnd: length, offsetInSong: 0, volume: 1 });
        appState.set('_selected', { track: 'audio', index: appState.get('_audioClips').length - 1 });
        appState.set('_hasUnsavedChanges', true);
        this._recomputeTrackFullFlags(); // MỚI (mục 2) — clip mới luôn phủ hết -> track Nhạc thành "đầy" ngay
        this._closeGenericDrawerFully();
    },

    // ===================== Chữ (Text overlay đa-clip — MỞ RỘNG: phông Google Fonts, đậm/nghiêng,
    // blur, đổ bóng bật/tắt, transition fade cơ bản; vị trí/kích cỡ/góc xoay giờ chỉnh trực tiếp
    // trên preview bằng cử chỉ, xem handlePreviewTextDrag*/handlePreviewTextPinch*) =====================

    /** [SỬA 24/07/2026, phản hồi Giang mục 2] Clip Chữ mới mặc định dài 3 giây tại vị trí con trỏ —
     * KẸP `timelineEnd` không vượt quá tổng thời lượng video hiện tại (`_totalDuration()`, không thể
     * có Chữ kéo dài hơn chính video), lùi `timelineStart` lại nếu cần để vẫn giữ ĐỘ DÀI tối thiểu
     * `MIN_CLIP_GAP_SEC` (trường hợp con trỏ đang ở rất sát cuối video). */
    handleAddText() {
        const outputTime = this._computeCurrentOutputTime();
        const total = this._totalDuration();
        const timelineEnd = Math.min(outputTime + 3, total);
        const timelineStart = Math.max(0, Math.min(outputTime, timelineEnd - this.MIN_CLIP_GAP_SEC));
        appState.get('_textClips').push({
            id: this._nextId(), val: t('videoEdit.text.defaultValue'),
            size: 60, color: '#ffffff', posX: 50, posY: 80, rotation: 0,
            bold: false, italic: false, fontFamily: 'system-ui', blur: 0, shadow: true, transition: 'none',
            timelineStart, timelineEnd,
        });
        appState.set('_selected', { track: 'text', index: appState.get('_textClips').length - 1 });
        appState.set('_hasUnsavedChanges', true);
        this._recomputeTrackFullFlags(); // MỚI (mục 2)
        this._renderAllTracks();
        this._renderToolbar();
        this.handleTextEditOpen();
    },

    _activeTextClip() { return appState.get('_selected') && appState.get('_selected').track === 'text' ? appState.get('_textClips')[appState.get('_selected').index] : null; },

    handleTextEditOpen() {
        const clip = this._activeTextClip();
        if (!clip) return;
        const fontOptionsHtml = VIDEO_EDITOR_FONTS.map((f) => `<option value="${_escapeVideoEditorHtml(f.value)}" ${clip.fontFamily === f.value ? 'selected' : ''}>${_escapeVideoEditorHtml(f.label)}</option>`).join('');
        const boldClass = (on) => `py-2 rounded-xl text-xs font-bold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'}`;
        const italicClass = (on) => `py-2 rounded-xl text-xs italic font-semibold border ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'}`;
        const bodyHtml = `
            <div class="px-4 flex flex-col gap-3 video-editor-gd-body-pb">
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

        valueEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.val = valueEl.value; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        fontEl.addEventListener('change', () => { const c = this._activeTextClip(); if (!c) return; c.fontFamily = fontEl.value; fontEl.style.fontFamily = `'${fontEl.value}'`; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        boldBtn.addEventListener('click', () => { const c = this._activeTextClip(); if (!c) return; c.bold = !c.bold; boldBtn.className = boldClass(c.bold); appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        italicBtn.addEventListener('click', () => { const c = this._activeTextClip(); if (!c) return; c.italic = !c.italic; italicBtn.className = italicClass(c.italic); appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        sizeEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.size = parseInt(sizeEl.value, 10) || 60; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        colorEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.color = colorEl.value; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        blurEl.addEventListener('input', () => { const c = this._activeTextClip(); if (!c) return; c.blur = parseInt(blurEl.value, 10) || 0; blurValEl.textContent = `${c.blur}px`; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        shadowEl.addEventListener('change', () => { const c = this._activeTextClip(); if (!c) return; c.shadow = shadowEl.checked; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
        transitionEl.addEventListener('change', () => { const c = this._activeTextClip(); if (!c) return; c.transition = transitionEl.value; appState.set('_hasUnsavedChanges', true); this._drawFrame(); });
    },

    // ===================== "Dịch chuyển tới đoạn" (chọn đoạn nhạc gốc + âm lượng riêng clip) =====================
    // [SỬA TOÀN BỘ, 24/07/2026, phản hồi Giang mục e] — BỎ thanh màu kéo tay trừu tượng cũ, thay
    // bằng WAVEFORM THẬT (WaveSurfer.js v7 + Regions, tái dùng đúng thư viện/pattern đã có ở
    // subtitle-editor.html — xem event/workflow/subtitle-editor.js::_initWaveform()). Region LUÔN
    // giữ NGUYÊN độ rộng = độ dài clip trên timeline (đúng logic cũ, Giang yêu cầu KHÔNG cho co
    // giãn) — `resize:false`, kéo CHỈ dịch `offsetInSong` (kẹp qua `clampSongOffsetDrag()`, core/
    // video-editor/audio-sync.js — TÁI DÙNG NGUYÊN, không viết lại). Thêm nút Play phát ĐÚNG vùng
    // chọn (tự dừng ở cuối, cùng cơ chế 'timeupdate' như subtitle-editor.html, ĐƠN GIẢN HOÁ — bỏ lớp
    // seek-retry nhiều tầng của bản subtitle-editor vì đây chỉ là preview trong 1 Drawer phụ, không
    // phải công cụ chính). Volume (0-200%) SỬA để cập nhật NGAY lúc kéo — cả `wavesurfer.setVolume()`
    // của waveform preview LẪN của preview chính đang phát nếu ĐÚNG clip này đang active
    // (`_syncAudioClips()`), khớp yêu cầu "áp dụng cho cả preview lẫn thật" (lúc xuất thật đã đúng
    // sẵn từ trước, xem `_buildMixedAudioTrack()`, webcodecs-engine.js). [SỬA THÊM 24/07/2026 — Giang
    // báo "mất tiếng cả video cả nhạc"] — BỎ HẲN GainNode (`_shiftGainBoost`, `core/video-editor/
    // media-gain.js` — file này KHÔNG dùng nữa, có thể xoá) — quay lại `wavesurfer.setVolume()` gốc,
    // kẹp [0,1] (AudioContext tự tạo bị 'suspended' ngoài user-gesture, không hề resume(), câm hẳn).

    _activeAudioClip() { return appState.get('_selected') && appState.get('_selected').track === 'audio' ? appState.get('_audioClips')[appState.get('_selected').index] : null; },

    handleSongShiftOpen() {
        const clip = this._activeAudioClip();
        if (!clip) return;
        this._ensureGainBoosts(); // MỚI (mục 2, iOS) — mở Drawer này CŨNG là user-gesture thật
        const clipLength = clip.timelineEnd - clip.timelineStart;
        const bodyHtml = `
            <div class="px-4 flex flex-col gap-4 video-editor-gd-body-pb">
                <p class="text-center text-[11px] text-slate-500">${_escapeVideoEditorHtml(t('videoEdit.songShift.positionLabel'))}: ${formatClipTimeLabel(clip.timelineStart)} – ${formatClipTimeLabel(clip.timelineEnd)} / ${formatClipTimeLabel(this._totalDuration())}</p>
                <div class="flex items-center gap-3">
                    <button type="button" id="ve-gd-shift-play" class="shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm"><span id="ve-gd-shift-play-icon">&#9654;</span></button>
                    <div id="ve-gd-shift-time-label" class="flex-1 text-center text-[11px] font-mono text-emerald-600"></div>
                </div>
                <div id="ve-gd-shift-waveform"></div>
                <p id="ve-gd-shift-error" class="hidden text-center text-[11px] text-rose-500"></p>
                <div>
                    <label class="flex justify-between text-[11px] text-slate-500 mb-1.5"><span>${_escapeVideoEditorHtml(t('videoEdit.clipVolume.label'))}</span><span id="ve-gd-clip-vol-val">${Math.round(clip.volume * 100)}%</span></label>
                    <input type="range" id="ve-gd-clip-vol" min="0" max="100" value="${Math.round(clip.volume * 100)}" class="ve-range">
                </div>
            </div>`;
        openGenericDrawer({ height: 'auto', maxHeight: '70vh', headerHtml: this._buildDrawerHeaderHtml(t('videoEdit.songShift.title')), bodyHtml });
        this._wireDrawerCloseButton();

        const timeLabelEl = genericDrawerBody.querySelector('#ve-gd-shift-time-label');
        const volEl = genericDrawerBody.querySelector('#ve-gd-clip-vol');
        const volValEl = genericDrawerBody.querySelector('#ve-gd-clip-vol-val');
        const playBtn = genericDrawerBody.querySelector('#ve-gd-shift-play');
        const playIconEl = genericDrawerBody.querySelector('#ve-gd-shift-play-icon');
        const waveformEl = genericDrawerBody.querySelector('#ve-gd-shift-waveform');
        const errorEl = genericDrawerBody.querySelector('#ve-gd-shift-error');
        _paintRangeFill(volEl); // MỚI (mục 3) — tô màu dải đã kéo ngay lúc mở

        const updateTimeLabel = () => {
            const c = this._activeAudioClip();
            if (!c) return;
            timeLabelEl.textContent = `${formatClipTimeLabel(c.offsetInSong)} / ${formatClipTimeLabel(c.record.duration || 0)}`;
        };
        updateTimeLabel();

        volEl.addEventListener('input', () => {
            const c = this._activeAudioClip();
            if (!c) return;
            c.volume = (parseInt(volEl.value, 10) || 0) / 100;
            volValEl.textContent = `${volEl.value}%`;
            _paintRangeFill(volEl); // MỚI (mục 3)
            appState.set('_hasUnsavedChanges', true);
            if (appState.get('_shiftWavesurfer')) appState.get('_shiftWavesurfer').setVolume(Math.min(1, Math.max(0, c.volume))); // nghe thấy NGAY trong waveform preview
            if (appState.get('_activePreviewAudioClipId') === c.id) this._syncAudioClips(this._computeCurrentOutputTime()); // ĐANG là clip active ở preview chính -> áp NGAY luôn (SỬA bug mục e)
        });

        playBtn.addEventListener('click', () => this._toggleShiftRegionPlay(playIconEl));

        if (typeof WaveSurfer === 'undefined' || typeof WaveSurfer.Regions === 'undefined') {
            console.error('[handleSongShiftOpen] WaveSurfer.js không tải được (CDN chặn/lỗi mạng?).');
            errorEl.textContent = t('videoEdit.songShift.waveformError');
            errorEl.classList.remove('hidden');
            return;
        }
        // Đợi 1 khung requestAnimationFrame trước khi dựng WaveSurfer — cùng lý do bản cũ ("chưa
        // chọn được", panel vừa hiện chưa layout xong, container có thể đo được width=0).
        requestAnimationFrame(() => this._initShiftWaveform(clip.record.blob, clipLength, waveformEl, errorEl, updateTimeLabel));
    },

    /** Dựng WaveSurfer + Region cho waveform "Dịch chuyển đoạn" — tách riêng khỏi handleSongShiftOpen()
     * cho gọn (Rule 3c — hàm con phục vụ 1 nghiệp vụ duy nhất của handleSongShiftOpen(), không dùng
     * độc lập ở đâu khác). */
    _initShiftWaveform(blob, clipLength, waveformEl, errorEl, updateTimeLabel) {
        try {
            appState.set('_shiftRegionsPlugin', WaveSurfer.Regions.create());
            appState.set('_shiftWavesurfer', WaveSurfer.create({
                container: waveformEl,
                height: 72,
                waveColor: '#94a3b8',
                progressColor: '#0ea5e9',
                cursorColor: '#0f172a',
                normalize: true,
                plugins: [appState.get('_shiftRegionsPlugin')],
            }));
            appState.get('_shiftWavesurfer').on('error', (err) => {
                console.error('[handleSongShiftOpen] WaveSurfer lỗi tải/giải mã audio:', err);
                errorEl.textContent = t('videoEdit.songShift.waveformError');
                errorEl.classList.remove('hidden');
            });
            appState.get('_shiftWavesurfer').on('decode', () => {
                const c = this._activeAudioClip();
                if (!c || !appState.get('_shiftWavesurfer')) return;
                const songDuration = appState.get('_shiftWavesurfer').getDuration();
                const clampedOffset = clampSongOffsetDrag(c.offsetInSong, clipLength, songDuration); // core/video-editor/audio-sync.js — TÁI DÙNG, đúng logic cũ
                appState.set('_shiftRegion', appState.get('_shiftRegionsPlugin').addRegion({
                    start: clampedOffset,
                    end: clampedOffset + Math.min(clipLength, songDuration),
                    color: 'rgba(16, 185, 129, 0.28)',
                    drag: true,
                    resize: false, // MỤC e, Giang yêu cầu — ĐỘ RỘNG LUÔN CỐ ĐỊNH, kéo CHỈ dịch offset
                }));
                c.offsetInSong = clampedOffset;
                updateTimeLabel();
                // Kéo Region -> dịch offset, kẹp lại đúng biên [0, songDuration-clipLength] (giữ
                // NGUYÊN độ rộng — nếu WaveSurfer cho kéo vượt biên, tự ép region.setOptions() về lại
                // giá trị đã kẹp, tránh region "trôi" ra ngoài phạm vi hợp lệ của bài hát).
                appState.get('_shiftRegion').on('update', () => {
                    const cc = this._activeAudioClip();
                    if (!cc) return;
                    const desired = appState.get('_shiftRegion').start;
                    const clamped = clampSongOffsetDrag(desired, clipLength, songDuration); // core/video-editor/audio-sync.js
                    if (Math.abs(clamped - desired) > 0.001) appState.get('_shiftRegion').setOptions({ start: clamped, end: clamped + clipLength });
                    cc.offsetInSong = clamped;
                    appState.set('_hasUnsavedChanges', true);
                    updateTimeLabel();
                });
                // Volume — quay lại `wavesurfer.setVolume()` gốc, kẹp [0,1] (BỎ GainNode, xem
                // docstring khối "Dịch chuyển tới đoạn" ở trên — Giang báo mất tiếng).
                const volNow = typeof c.volume === 'number' ? c.volume : 1;
                appState.get('_shiftWavesurfer').setVolume(Math.min(1, Math.max(0, volNow)));
            });
            // load() trả về Promise — LUÔN .catch() (WaveSurfer.js v7 có bug dangling-promise đã
            // biết, cùng lý do subtitle-editor.html).
            appState.get('_shiftWavesurfer').load(URL.createObjectURL(blob)).catch((err) => {
                console.error('[handleSongShiftOpen] wavesurfer.load() bị reject:', err);
                errorEl.textContent = t('videoEdit.songShift.waveformError');
                errorEl.classList.remove('hidden');
            });
        } catch (err) {
            console.error('[handleSongShiftOpen] Lỗi khởi tạo WaveSurfer:', err);
            errorEl.textContent = t('videoEdit.songShift.waveformError');
            errorEl.classList.remove('hidden');
        }
    },

    /** Toggle Play/Pause nút "▶" — phát ĐÚNG vùng chọn (Region), tự dừng ở `region.end` (nghe
     * 'timeupdate', cùng cơ chế subtitle-editor.html nhưng ĐƠN GIẢN HOÁ — không lặp lại lớp seek-
     * retry nhiều tầng của trang đó, chấp nhận được vì đây chỉ là preview phụ trong 1 Drawer). */
    _toggleShiftRegionPlay(playIconEl) {
        if (!appState.get('_shiftWavesurfer') || !appState.get('_shiftRegion')) return;
        if (appState.get('_shiftIsPlayingRegion') && appState.get('_shiftWavesurfer').isPlaying()) {
            appState.get('_shiftWavesurfer').pause();
            this._clearShiftStopHandler(playIconEl);
            return;
        }
        this._playShiftRegion(playIconEl);
    },

    _playShiftRegion(playIconEl) {
        this._clearShiftStopHandler(playIconEl);
        const region = appState.get('_shiftRegion');
        if (!region || !appState.get('_shiftWavesurfer')) return;
        appState.set('_shiftIsPlayingRegion', true);
        playIconEl.textContent = '\u275A\u275A'; // ❚❚ — cùng ký hiệu transport bar chính
        appState.set('_shiftStopHandler', (currentTime) => {
            if (currentTime >= region.end) { appState.get('_shiftWavesurfer').pause(); this._clearShiftStopHandler(playIconEl); }
        });
        appState.get('_shiftWavesurfer').on('timeupdate', appState.get('_shiftStopHandler'));
        appState.get('_shiftWavesurfer').setTime(region.start);
        const playResult = appState.get('_shiftWavesurfer').play();
        if (playResult && typeof playResult.catch === 'function') playResult.catch((err) => console.warn('[handleSongShiftOpen] play() bị reject:', err));
    },

    _clearShiftStopHandler(playIconEl) {
        if (appState.get('_shiftStopHandler') && appState.get('_shiftWavesurfer')) { appState.get('_shiftWavesurfer').un('timeupdate', appState.get('_shiftStopHandler')); appState.set('_shiftStopHandler', null); }
        appState.set('_shiftIsPlayingRegion', false);
        if (playIconEl) playIconEl.textContent = '\u25B6'; // ▶
    },

    /** Dọn sạch WaveSurfer của "Dịch chuyển đoạn" — gọi từ `_closeGenericDrawerFully()` (an toàn,
     * no-op nếu đang không mở đúng Drawer này) MỖI LẦN đóng Generic Drawer, tránh rò rỉ nhiều
     * instance WaveSurfer qua nhiều lần mở/đóng. */
    _destroyShiftWaveform() {
        this._clearShiftStopHandler(null);
        if (appState.get('_shiftWavesurfer')) {
            try { appState.get('_shiftWavesurfer').destroy(); } catch (err) { console.warn('[_destroyShiftWaveform] Lỗi destroy() WaveSurfer (bỏ qua):', err); }
        }
        appState.set('_shiftWavesurfer', null);
        appState.set('_shiftRegionsPlugin', null);
        appState.set('_shiftRegion', null);
    },

    // ===================== Lưu (dropdown Ghi đè | Lưu mới) =====================

    handleSaveClick(anchorEl) {
        openDropdownMenu(anchorEl, [
            { icon: _veIcon('cut'), name: t('videoEdit.save.overwrite'), callback: () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.saveOverwrite.click', payload: {} }) },
            { icon: _veIcon('duplicate'), name: t('videoEdit.save.asNew'), callback: () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.saveAsNew.click', payload: {} }) },
        ]);
    },

    /** [SỬA 24/07/2026, mục d] — bỏ `filterCss`/`volumeVideo` TOÀN CỤC ("Chỉnh" bỏ hẳn). `videoClips`
     * (`_videoClips`) đã tự mang `volume` RIÊNG từng đoạn — webcodecs-engine.js đọc thẳng từ đó. */
    _buildProcessParams() {
        return {
            sourceBlob: appState.get('_record').blob,
            videoClips: appState.get('_videoClips'),
            cropFraction: appState.get('_cropFraction'),
            rotateDeg: appState.get('_rotateDeg'),
            textClips: appState.get('_textClips'),
            audioClips: appState.get('_audioClips').map((c) => ({ blob: c.record.blob, offsetInSong: c.offsetInSong, timelineStart: c.timelineStart, timelineEnd: c.timelineEnd, volume: c.volume })),
        };
    },

    _buildNewFilename(suffix) {
        const original = appState.get('_record').filename || 'video';
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
            await setVideoRecord(appState.get('_videoKey'), { blob, thumbBlob, width, height, duration, filename: appState.get('_record').filename, addedAt: appState.get('_record').addedAt });
            appState.set('_hasUnsavedChanges', false);
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
            appState.set('_hasUnsavedChanges', false);
            await alertModal(t('videoEdit.save.success'));
        } catch (err) {
            console.error('[handleSaveAsNew] Lỗi xử lý/lưu video mới:', err);
            await alertModal(t('videoEdit.save.failed'));
        }
    },

    // ===================== Quay lại =====================

    handleBack() {
        if (!appState.get('_hasUnsavedChanges')) { window.location.href = 'index.html'; return; }
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

/** [MỚI 24/07/2026, mục 3 — Giang báo "slider volume không phân biệt được dải current với dải
 * chưa kéo tới, đồng màu với nhau"] Tô màu phần ĐÃ kéo qua (min -> value) khác màu phần CÒN LẠI
 * (value -> max) bằng CSS gradient trên chính `background` của `input[type=range]` — kỹ thuật
 * cross-browser phổ biến nhất (track/thumb là pseudo-element riêng của TỪNG engine, style rất khó
 * đồng bộ; gradient nền thì mọi trình duyệt vẽ giống nhau). Gọi 1 lần lúc dựng slider (giá trị mặc
 * định) + lại mỗi lần 'input' bắn ra (xem 2 nơi gọi: handleVideoClipVolumeOpen()/handleSongShiftOpen()).
 * Cần đi kèm class `.ve-range` (assets/css/video-editor.css) để tắt style track mặc định của trình
 * duyệt — nếu không, gradient bị chính track mặc định của trình duyệt vẽ đè lên, không thấy được. */
function _paintRangeFill(el) {
    const min = parseFloat(el.min) || 0;
    const max = parseFloat(el.max) || 100;
    const val = parseFloat(el.value) || 0;
    const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
    el.style.background = `linear-gradient(to right, #10b981 0%, #10b981 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
}

/** Icon SVG dùng cho toolbar/dropdown (Workflow, KHÔNG thuộc core/ — không bị ràng buộc Rule 5). */
function _veIcon(name) {
    const paths = {
        crop: 'M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3',
        rotateLeft: 'M9 15L3 9m0 0l6-6M3 9h11a6 6 0 010 12h-2',
        rotateRight: 'M15 15l6-6m0 0l-6-6m6 6H10a6 6 0 000 12h2',
        volume: 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14',
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
