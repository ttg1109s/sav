/**
 * event/workflow/video-player.js — GỌI TỪ 2 nơi: (1) `window.playSong()` (core/playlist/actions.js,
 * guard clause đầu hàm khi `cached.mediaType === 'video'` — MỚI, ver12 "Song/Video Unification"
 * Batch 2, THAY hẳn checkbox "Video Player mode" cũ trong panel File Manager -> Video, ĐÃ BỎ HẲN,
 * xem plan-v12-song-video-unification.md mục 3 + cleanup Batch 2), đi qua eventBus router
 * 'videoPlayer' (event/router/video-player.js) để Block gate kịp chặn — `startFromPlaylist(startKey)`
 * ngay dưới là entry point DUY NHẤT còn lại vào Video Player mode; (2) router "playerControls" —
 * Play-Pause + 5 sự kiện RIÊNG của `bgVideoElement` (video.timeupdate/loadedmetadata/play/pause/
 * ended — xem event/listener/video-player.js) + progressBar seek (VirtualMachineState theo
 * `isVideoPlayerMode`). `exitVideoPlayerMode()` giờ có THÊM 1 caller MỚI — `window.playSong()` tự
 * gọi khi phát Song lúc đang ở Video Player mode (dọn sạch trước khi chuyển hẳn về luồng Song).
 *
 * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt: "video thừa hưởng cơ chế Playlist
 * sẵn có, không tạo cơ chế next/prev riêng — có là đang tạo exception"] Next/Prev (nút vật lý LẪN
 * cử chỉ vuốt) KHÔNG còn qua router này/VirtualMachineState theo `isVideoPlayerMode` nữa — LUÔN
 * gọi `playNext()`/`playPrev()` (core/player-controls.js, DÙNG CHUNG với Song, đọc `displayOrder`/
 * `shuffleIndices`/`currentKey` — package `playlist`, đã đúng danh sách + sort mode Video từ Batch
 * 1) bất kể nguồn nào, xem event/router/player-controls.js. `playVideoByKey()` ngay dưới giờ ghi
 * `currentKey` (KHÔNG còn `currentVideoKey` riêng, đã xoá — service/state/video-player-mode.js) —
 * chính là điểm khiến `playNext()`/`playPrev()` hoạt động đúng cho Video mà KHÔNG cần biết gì về
 * "đang phát video". `nextVideo()`/`prevVideo()` (mảng `videoPlaylist` riêng) ĐÃ XOÁ HẲN.
 *
 * VIẾT LẠI LẦN 2 (21/07/2026, Giang phát hiện qua video test) — BỎ HẲN `audioPlayer` khỏi luồng
 * Video Player (xem docstring đầy đủ ở core/video-player.js vì sao — tóm tắt: `<audio src="video
 * blob">` không đáng tin cậy cross-browser, đặc biệt Safari/iOS, khiến `audioPlayer` không thực sự
 * chạy dù `bgVideoElement` vẫn phát tiếng bình thường). `bgVideoElement` giờ là NGUỒN DUY NHẤT: vừa
 * hiện hình + phát tiếng thật (native), vừa nuôi analyser qua `connectVideoElementToAnalyser()`
 * (core/video-player.js — source RIÊNG, KHÔNG phải nguồn của audioPlayer).
 *
 * Progress bar/current time/duration/seek/play-pause-icon/ended giờ có handler RIÊNG trong CHÍNH
 * file này (đọc/ghi THẲNG `bgVideoElement`) — KHÔNG dùng lại `handleAudioTimeUpdate()`/
 * `handleAudioPlay()`/... (core/player-controls.js, các hàm đó CHỈ đụng `audioPlayer`, giữ NGUYÊN
 * KHÔNG đổi gì cho Song).
 *
 * ĐƠN GIẢN HOÁ Ở BẢN ĐẦU (đã báo Giang) — KHÔNG có shuffle/repeat riêng cho video (danh sách phát
 * TUẦN TỰ theo thứ tự thêm vào, cũ -> mới). CÓ wake lock + Media Session (mirror Song, dùng lại
 * `requestWakeLock()`/`releaseWakeLock()`/`startListenClock()`/`stopListenClock()` core/player-
 * controls.js — những hàm này THUẦN, không đụng `audioPlayer`, an toàn dùng lại nguyên).
 *
 * NẠP SAU: core/video-player.js, core/file-manager/video.js (listVideos), core/playlist/loader.js
 * (buildVideoPlaylistCache, dùng bởi refreshVideoPlaylistIfActive() — Batch 1), core/playlist/
 * order.js (updateShuffleArray/recomputeDisplayOrder/recomputeRenderOrder, cùng lý do),
 * service/db.js (getVideoRecord), core/audio-engine.js (setupAudioContext).
 */
const workflowVideoPlayer = {
    _objectUrl: null, // object URL HIỆN TẠI đang gán cho bgVideoElement (revoke trước khi tạo url mới)
    _thumbObjectUrl: null, // object URL của thumbBlob HIỆN TẠI (cover ở player bar, #record-container) — revoke trước khi tạo url mới
    _thumbFullObjectUrl: null, // THÊM (30/07/2026) — object URL của thumbFullBlob HIỆN TẠI (khung chớp thumb #visual-bg-image lúc Next/Prev/End, core/video-player.js::setVideoTransitionThumb()) — revoke trước khi tạo url mới, CÙNG khuôn 2 dòng trên
    _swipeStartY: null, // toạ độ Y lúc touchstart — dùng bởi event/listener/video-player.js (cử chỉ vuốt)

    /**
     * ===================== Ver 12 "Song/Video Unification" — Batch 2 (mục 3) =====================
     * [SỬA] Entry point DUY NHẤT còn lại để vào Video Player mode — TRƯỚC ĐÂY tên
     * `enterVideoPlayerMode()`, gọi từ `workflowFileManagerVideo.enablePlayerModeFromPanel()`
     * (checkbox "Video Player mode" trong panel File Manager -> Video, ĐÃ BỎ HẲN — xem cleanup mục
     * Batch 2, plan-v12-song-video-unification.md). Checkbox đó là caller DUY NHẤT nên ĐỔI TÊN +
     * ĐỔI CHỮ KÝ luôn tại đây (không phải rewrite hồi tố — hàm chỉ có đúng 1 caller, caller đó vừa
     * bị xoá): giờ nhận `startKey` — videoKey CỤ THỂ vừa được chọn trong Playlist.
     * [SỬA LẦN 2 — Giang chốt: "video thừa hưởng cơ chế Playlist sẵn có, không tạo cơ chế next/
     * prev riêng"] BỎ HẲN việc tự `listVideos()`/`sortVideosByAddedDateDesc()` dựng 1 mảng
     * `videoPlaylist` RIÊNG — Next/Prev giờ đọc THẲNG `displayOrder`/`shuffleIndices` (package
     * `playlist`, đã đúng danh sách + đúng sort mode Video từ Batch 1) qua `playNext()`/
     * `playPrev()` (core/player-controls.js) DÙNG CHUNG với Song, nên hàm NÀY không cần tự dựng gì
     * cho việc đó nữa — chỉ còn lo dọn Song cũ + bật state + phát ĐÚNG video vừa click.
     * @param {string} startKey - videoKey vừa được chọn để phát.
     */
    async startFromPlaylist(startKey) {
        const previousSongKey = appState.get('currentKey');
        if (previousSongKey !== null) {
            audioPlayer.pause(); // bắn sự kiện 'pause' NGUYÊN BẢN -> handleAudioPause() (core/player-controls.js, KHÔNG đụng) tự lo icon/wake lock/Media Session cho Song
            appState.set('currentKey', null);
            refreshSongNode(previousSongKey); // core/playlist/render.js — patch riêng đúng 1 hàng, xoá highlight "đang phát"
        }

        visualizerSolidBg.style.backgroundColor = '#000000'; // khớp handleVideoBackground() (core/state-and-video-bg.js) — nền đen cưỡng chế phía sau video
        enterVideoPlayerModeState(); // core/video-player.js — CHỈ còn set isVideoPlayerMode=true
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + pointer-events
        forceShowVisualBgImageForVideoPlayer(); // core/video-player.js — THÊM (30/07/2026) — cưỡng chế hiện #visual-bg-image, trưng dụng làm khung chớp thumb Next/Prev/End (xem docstring hàm đó)

        await this.playVideoByKey(startKey); // switchScreen mặc định true — TỰ switchToVisualizer() BÊN TRONG (sau khi video mới thật sự sẵn sàng), xem docstring playVideoByKey()
    },

    /** Thoát Video Player mode: dừng + dọn `bgVideoElement`, trả về mặc định trang trí.
     * SỬA (21/07/2026, cùng đợt so sánh 2 luồng) — thêm `updateDOMBackground()` (core/color-
     * utils.js, hàm CÓ SẴN) — trả `visualizerSolidBg` về ĐÚNG `cfg.bgColor` (hàm đó tự đọc
     * `cfg.videoBgEnabled`, LUÔN false cho Video Player mode — không cần biết gì thêm, tự làm đúng). */
    async exitVideoPlayerMode() {
        bgVideoElement.pause();
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, ẩn, pointer-events mặc định
        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} this._thumbObjectUrl = null; }
        if (this._thumbFullObjectUrl) { try { URL.revokeObjectURL(this._thumbFullObjectUrl); } catch (e) {} this._thumbFullObjectUrl = null; }
        bgVideoElement.removeAttribute('src');
        bgVideoElement.load(); // buộc <video> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)
        updateDOMBackground(); // core/color-utils.js, hàm CÓ SẴN — trả visualizerSolidBg về cfg.bgColor

        // THÊM (30/07/2026) — #visual-bg-image bị TRƯNG DỤNG tạm làm khung chớp thumb suốt phiên
        // Video Player mode (forceShowVisualBgImageForVideoPlayer(), lúc vào mode) — thoát mode
        // PHẢI khôi phục lại ĐÚNG trạng thái thật theo Cài đặt "Visual Background Image", KHÔNG để
        // nguyên thumb video cuối cùng còn sót lại: bật -> trả lại đúng ảnh đã cấu hình (TÁI DÙNG
        // `cfg.visualBgImage` — object URL đã tạo sẵn từ trước, KHÔNG cần đọc lại Blob từ DB); tắt
        // -> ẩn lại (`.hidden`, applyVisualBgImageToDOM() tự lo nhánh này). CÙNG 1 lời gọi duy nhất
        // xử lý ĐỦ cả 2 nhánh (Rule 1 — 1 tiến trình "đồng bộ lại DOM theo state thật").
        const cfg = appConfigViz.getAll();
        applyVisualBgImageToDOM(cfg.visualBgImageEnabled, cfg.visualBgImageEnabled ? cfg.visualBgImage : ''); // core/state-and-video-bg.js

        exitVideoPlayerModeState(); // core/video-player.js
        releaseWakeLock(); stopListenClock(); // core/player-controls.js — dọn nốt 2 cơ chế đã bật lúc phát
    },

    /** Chờ 1 object URL ảnh DECODE XONG (không chỉ tải xong network) — dùng TRƯỚC khi gán vào
     * background-image của `#visual-bg-image` (`setVideoTransitionThumb()`, core/video-player.js).
     *
     * BỐI CẢNH (phản hồi Giang 30/07/2026, "vẫn nháy đen dù đã chèn thumb vào #visual-bg-image") —
     * `bgVideoElement` đổi `src` gần như TỨC THỜI (bỏ khung hình cũ ngay), trong khi trình duyệt
     * decode 1 ảnh JPEG full-res MỚI (object URL vừa tạo lúc đầu playVideoByKey()) KHÔNG tức thời —
     * nếu bước decode chậm hơn, `#visual-bg-image` CŨNG chưa có gì để hiện đúng lúc cần -> lộ tiếp
     * xuống `visualizerSolidBg` (đen, cưỡng chế suốt Video Player mode) — vẫn là 1 cuộc đua, chỉ
     * đổi đối thủ. `Image().decode()` (Promise-based, có mặt rộng rãi từ Safari 13.1) giải quyết
     * ĐÚNG race này: "mồi" decode qua 1 `Image()` RỜI (KHÔNG gắn DOM) — trình duyệt cache bản đã
     * decode, gán CÙNG url đó vào CSS `background-image` SAU ĐÓ không decode lại lần 2.
     *
     * Kèm timeout an toàn (1s, `taskManager` — CHỈ Workflow được dùng, tên cố định tự huỷ bản cũ
     * nếu gọi lại giữa chừng) — `decode()` hiếm khi treo nhưng không phải không thể (ảnh hỏng/
     * edge-case engine) — 1 ảnh lỗi KHÔNG được làm kẹt Next/Prev vĩnh viễn. `null`/rỗng -> resolve
     * ngay (guard clause thuần, Rule 1) — KHÔNG throw dù `decode()` lỗi (field phụ, coi như "xong",
     * xem `setVideoTransitionThumb()` tự no-op nếu url rỗng).
     *
     * GIỚI HẠN (đã báo Giang) — chỉ xử lý ĐÚNG trường hợp `<video>` trong suốt lộ layer dưới lúc
     * đổi `src`. Nếu layer decode hardware của `<video>` tự vẽ ĐEN ĐẶC (placeholder buffer rỗng,
     * nhánh còn lại đã điều tra) thì decode ảnh nhanh cỡ nào cũng vô nghĩa — layer đó nằm TRÊN,
     * không phải khoảng trống để ảnh lộ ra.
     * @param {string|null} url
     * @returns {Promise<void>}
     */
    async _decodeThumbOrTimeout(url) {
        if (!url) return;
        const img = new Image();
        img.src = url;
        await Promise.race([
            img.decode().catch(() => {}), // ảnh hỏng/format lạ — coi như "xong", không chặn
            new Promise((resolve) => taskManager.once(resolve, 1000, 'videoTransitionThumbDecodeTimeout')),
        ]);
    },

    /** Nạp 1 video vào `bgVideoElement` (DUY NHẤT — xem docstring đầu file) + phát ngay + cập nhật
     * title/artist/MediaSession + nuôi analyser.
     *
     * VIẾT LẠI (phản hồi Giang 29/07/2026, "chớp đen next/prev") — luồng cũ: fetch record ->
     * NGAY LẬP TỨC đổi `poster`/`src` -> đổi UI (currentKey/title/refreshSongNode/switchToVisualizer)
     * TRONG LÚC video còn đang tải/giải mã. Vấn đề: đổi `src` LUÔN reset readyState về HAVE_NOTHING
     * NGAY LẬP TỨC (trình duyệt xoá khung hình đang hiện, bất kể `poster` có gán hay không — hành vi
     * hiện lại `poster` sau khi <video> ĐÃ phát ít nhất 1 lần KHÔNG đáng tin cậy trên nhiều
     * engine/di động) -> lộ nền đen phía sau suốt khoảng đợi giải mã, rõ nhất khi Next/Prev liên tục.
     *
     * FIX (chốt cùng Giang, 3 bước rõ ràng):
     *   1. `bgVideoElement.pause()` NGAY LẬP TỨC lúc hàm bắt đầu — CHƯA đụng `src` — video CŨ đứng
     *      hình (giữ nguyên khung hình cuối, KHÔNG đen) trong lúc (2) đang chạy.
     *   2. `await getVideoRecord()` (đọc IndexedDB) CHẠY XONG XUÔI rồi mới đụng `bgVideoElement` —
     *      trong lúc đợi, màn hình vẫn đứng yên ở khung hình cũ (không có gì để "nháy").
     *   3. Chỉ ĐÚNG 1 lần gán `poster`+`src`+`play()` (không còn khoảng hở giữa các bước), rồi ĐỢI
     *      THẬT SỰ có khung hình mới (sự kiện 'playing', kèm timeout an toàn 2s phòng autoplay bị
     *      chặn/lỗi lạ) rồi MỚI đổi `currentKey`/title/refreshSongNode()/switchToVisualizer() —
     *      UI (kể cả progress bar/tên bài) chỉ nhảy sang bài MỚI đúng lúc hình đã thật sự đổi, không
     *      đổi sớm hơn (theo đúng yêu cầu Giang).
     *
     * BỌC `withLoadingShield(..., false)` (display=false — không hiện lớp che, CÙNG PATTERN
     * `window.playSong()` Song đang dùng, core/playlist/actions.js) — khoá chống bấm Next/Prev
     * chồng lên nhau lúc đang đợi (gọi lại giữa chừng bị chính shield này im lặng bỏ qua, KHÔNG
     * race 2 lần fetch/gán `src` cùng lúc).
     *
     * `switchScreen` (MỚI — TRƯỚC ĐÂY do router/`startFromPlaylist()` tự gọi switchToVisualizer()
     * ngay sau khi gọi hàm này KHÔNG ĐỢI gì — giờ PHẢI dời quyết định switch màn hình/cuộn animated
     * vào ĐÚNG thời điểm sau khi video mới thật sự sẵn sàng, nên dời hẳn logic đó vào TRONG đây,
     * nhận qua tham số thay vì để caller tự gọi tách rời) — mặc định `true` (bấm 1 dòng trong
     * Playlist/vào mode lần đầu); Next/Prev vật lý truyền `false` (core/router/video-player.js).
     * @param {string} videoKey
     * @param {boolean} [switchScreen=true]
     */
    async playVideoByKey(videoKey, switchScreen = true) {
        // FIX (29/07/2026, yêu cầu Giang mục 3 — "chọn lại video đang phát bị restart sai, chỉ cần
        // switch lại visualizer") — Router (event/router/video-player.js, nhánh
        // isVideoPlayerMode===true) gọi THẲNG hàm này cho CẢ 2 tình huống: Next/Prev vật lý (key
        // khác) LẪN bấm lại đúng video ĐANG PHÁT từ Playlist (key giống hệt currentKey) — trước đây
        // KHÔNG hề phân biệt, luôn chạy lại toàn bộ (1)(2)(3) bên dưới -> revoke/tạo lại object URL,
        // gán lại `src` -> video bị RESTART từ đầu dù đang phát đúng bài đó (sai, giống hệt bug cũ
        // của Song trước khi có guard `key === currentKey` ở window.playSong(), core/playlist/
        // actions.js — audio VẫN giữ nguyên vị trí đang phát, chỉ chuyển màn hình).
        // Guard tương tự Song, NHƯNG KHÔNG được chỉ dựa `videoKey === currentKey` đơn thuần: sau
        // `exitVideoPlayerMode()` (revoke `this._objectUrl` -> null, `bgVideoElement.removeAttribute
        // ('src')`), `currentKey` KHÔNG bị xoá theo (xem docstring hàm đó) — nếu chọn lại ĐÚNG video
        // vừa thoát mode, `startFromPlaylist()` vẫn gọi lại hàm này với `videoKey === currentKey`
        // (stale) trong khi `bgVideoElement` đã KHÔNG còn src thật nào -> guard kiểu Song đơn thuần
        // sẽ bỏ qua nhầm, để lại màn hình đen không có video. Điều kiện ĐỦ 3 vế dưới đây phân biệt
        // đúng "đang thật sự tải/phát video này" (this._objectUrl còn tồn tại VÀ khớp đúng src hiện
        // tại của bgVideoElement) với "chỉ trùng currentKey do state cũ chưa dọn".
        if (videoKey === appState.get('currentKey') && this._objectUrl && bgVideoElement.getAttribute('src') === this._objectUrl) {
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated();
            if (bgVideoElement.paused) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
            return;
        }
        return withLoadingShield(t('common.loading.switchingSong'), async () => {
            bgVideoElement.pause(); // (1) đứng hình NGAY — CHƯA đụng src, khung hình cũ giữ nguyên

            const record = await getVideoRecord(videoKey); // (2) service/db.js — trong lúc đợi, màn hình vẫn đứng yên ở khung hình cũ
            if (!record) {
                // guard: video vừa bị xoá ở nơi khác giữa lúc đang phát. KHÔNG gọi playNext(true)
                // NGAY TẠI ĐÂY — vẫn đang ở TRONG withLoadingShield() này (isShieldBusy chỉ được
                // giải phóng SAU KHI fn() resolve), gọi thẳng sẽ bị CHÍNH shield này im lặng chặn
                // (giống hệt lý do notFoundAlert phải mang cờ ra ngoài ở window.playSong(), core/
                // playlist/actions.js) — mang cờ ra ngoài, xử lý ở .then() bên dưới thay.
                this._skipToNextAfterShield = true;
                return;
            }

            const previousKey = appState.get('currentKey'); // đọc TRƯỚC khi ghi đè — refresh đúng dòng cũ sau khi video mới sẵn sàng

            if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
            this._objectUrl = URL.createObjectURL(record.blob);
            if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} }
            this._thumbObjectUrl = URL.createObjectURL(record.thumbBlob);
            // THÊM (30/07/2026, yêu cầu Giang) — thumbFullBlob ĐI KÈM cùng record vừa getVideoRecord()
            // ở (2) rồi, KHÔNG tốn thêm 1 fetch nào — tạo object URL NGAY (record cũ trước 29/07 có
            // thể chưa có field này, guard null: record.thumbFullBlob || null).
            if (this._thumbFullObjectUrl) { try { URL.revokeObjectURL(this._thumbFullObjectUrl); } catch (e) {} this._thumbFullObjectUrl = null; }
            if (record.thumbFullBlob) this._thumbFullObjectUrl = URL.createObjectURL(record.thumbFullBlob);

            // BẮT BUỘC — đảm bảo audioContext/analyser tồn tại (an toàn gọi lại nhiều lần, guard sẵn
            // trong chính 2 hàm) RỒI mới nối bgVideoElement vào — thứ tự ngược sẽ lỗi (analyser chưa
            // có để nối vào).
            setupAudioContext(); // core/audio-engine.js
            connectVideoElementToAnalyser(); // core/video-player.js

            // THÊM (30/07/2026) — chèn thumbFullBlob của video B (SẮP chuyển tới) vào #visual-bg-image
            // NGAY TRƯỚC khi gán src (dòng dưới) — đúng lúc bgVideoElement chuẩn bị reset readyState
            // về HAVE_NOTHING, khung chờ NÀY đã kịp có sẵn đúng nội dung của video MỚI (không phải
            // video A cũ) — null nếu record không có thumbFullBlob thì setVideoTransitionThumb() tự
            // xoá/no-op (guard clause bên trong hàm đó). Xem core/video-player.js cho đầy đủ lý do
            // #visual-bg-image (KHÔNG phải overlay riêng/background-image trên chính bgVideoElement
            // — cả 2 cách đó đã thử và thất bại, xem lịch sử điều tra).
            // SỬA (30/07/2026, phản hồi Giang "vẫn nháy đen") — `await` decode xong THẬT SỰ trước
            // khi gán (xem docstring `_decodeThumbOrTimeout()` ngay trên) — tránh gán CSS
            // background-image lúc ảnh CHƯA decode xong, đúng lúc bgVideoElement cũng đang đổi src
            // (2 tiến trình đua nhau, không có bước này thì thua ngay chính race đang cố né).
            await this._decodeThumbOrTimeout(this._thumbFullObjectUrl);
            setVideoTransitionThumb(this._thumbFullObjectUrl); // core/video-player.js

            // (3) Gán 1 lần liền mạch — KHÔNG còn khoảng hở giữa các dòng để lộ trạng thái dở dang.
            // SỬA (30/07/2026, yêu cầu Giang) — bỏ hẳn việc đụng opacity/hidden ở ĐÂY: bgVideoElement
            // đã un-hidden + opacity='1' NGAY từ lúc vào Video Player mode (setBgVideoElementForPlayerMode
            // ở startFromPlaylist(), CHỈ 1 lần) và giữ nguyên vậy tới lúc thoát — Next/Prev đổi NỘI
            // DUNG (src) bên trong đúng 1 khung đang hiển thị, không phải bật/tắt cái khung đó.
            bgVideoElement.poster = this._thumbObjectUrl;
            bgVideoElement.src = this._objectUrl;
            bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));

            // Đợi ĐÚNG lúc video MỚI thật sự có khung hình (sự kiện 'playing') rồi mới đổi bất kỳ
            // gì lên UI — kèm timeout an toàn (2s) phòng 'playing' không bao giờ bắn (autoplay bị
            // chặn/lỗi định dạng lạ) để không kẹt vĩnh viễn.
            await Promise.race([
                new Promise((resolve) => bgVideoElement.addEventListener('playing', resolve, { once: true })),
                new Promise((resolve) => taskManager.once(resolve, 2000, 'videoPlayingReadyFallback')),
            ]);

            // ===== TỪ ĐÂY: video MỚI đã thật sự hiện ra (hoặc hết 2s chờ) — mới đổi UI =====
            appState.set('currentKey', videoKey);
            console.log(`writer: "playVideoByKey", page: "currentKey", content: "${videoKey}"`);

            // MỚI (phản hồi Giang 28/07/2026) — `bumpSongPlayCount()` (core/listen-stats.js) TRƯỚC
            // ĐÂY CHỈ được gọi trong window.playSong() (core/playlist/actions.js) — nhánh Video
            // dispatch ra KHỎI hàm đó TRƯỚC khi tới dòng gọi, nên Play Count chưa từng tăng cho
            // Video. `songStatsMap` (core/listen-stats.js) vốn đã key-agnostic nên gọi thẳng ở đây
            // là đủ, không cần sửa gì thêm ở listen-stats.js.
            bumpSongPlayCount(videoKey); // core/listen-stats.js

            playerTitle.textContent = record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'); // MỚI (Batch 5, mục 6c) — ưu tiên tên hiển thị người dùng tự đặt; SỬA (phản hồi Giang 28/07) — bỏ đuôi mở rộng khi rơi về filename gốc
            // MỚI (ver12 "Song/Video Unification", Batch 2, mục 3) — artist RỖNG thay vì nhãn
            // "Video Player" cũ, khớp Adapter (Batch 1: playlistCache của Video có tag.artist='') —
            // #player-title/#player-artist dùng CHUNG DOM giữa Playlist/Visualizer nên đồng bộ cả 2 màn.
            playerArtist.textContent = '';
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'), // xem giải thích ngay trên
                    artist: '',
                    artwork: [],
                });
            }

            // MỚI (21/07/2026, Giang yêu cầu "chỉnh cover ở player bottom = dùng ảnh thumb của video")
            // — CÙNG khuôn cách Song dựng lại `recordContainer.innerHTML` (core/playlist/actions.js) —
            // dùng `record.thumbBlob` (đã có sẵn từ lúc upload, core/file-manager/video.js) thay
            // `currentCoverObjectURL` của Song. TÁI DÙNG `this._thumbObjectUrl` vừa tạo ở trên
            // (poster) thay vì tạo + revoke thêm 1 object URL riêng cho cùng 1 Blob.
            recordContainer.innerHTML = `<img id="record-art" src="${this._thumbObjectUrl}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 animate-spin-slow" alt="${t('videoPlayer.untitled')}"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;

            requestWakeLock(); // core/player-controls.js — cùng khuôn playNext()/playPrev()/togglePlayPause() của Song

            if (previousKey && previousKey !== videoKey) refreshSongNode(previousKey); // core/playlist/render.js — dòng video/song TRƯỚC đó, CHỈ khi khác videoKey
            refreshSongNode(videoKey); // core/playlist/render.js — dòng video NÀY, cập nhật isPlaying/eq indicator, ĐỌC ĐÚNG bgVideoElement.paused=false (đã 'playing' ở trên, hoặc hết timeout)
            if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); // core/dom-refs.js — hiện tray icon

            // MỚI (phản hồi Giang 29/07/2026, mục 2 — scroll animated Next/Prev) — dời logic
            // switchToVisualizer()/scrollToCurrentKeyAnimated() vào ĐÂY (TRƯỚC ĐÂY router/
            // startFromPlaylist() tự gọi ngay sau khi gọi hàm này, KHÔNG đợi gì) — giờ chạy ĐÚNG
            // lúc video mới đã thật sự sẵn sàng, khớp yêu cầu "UI chỉ đổi khi hình đã đổi".
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated(); // core/player-controls.js / core/playlist/render.js
        }, false).then(() => {
            if (this._skipToNextAfterShield) {
                this._skipToNextAfterShield = false;
                playNext(true); // core/player-controls.js, dùng CHUNG với Song — gọi SAU khi shield đã đóng hẳn
            }
        });
    },

    /** MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — làm mới lại Playlist
     * (đọc lại DB) TRONG LÚC đang browse nguồn Video — gọi khi video được thêm/xoá (giờ luôn qua
     * chính Playlist — nút "Thêm nhạc"/dropdown 3 chấm, xem event/workflow/file-manager-video.js::
     * uploadVideos(), Batch 6) MÀ KHÔNG cần đổi Nguồn tắt/bật lại mới thấy video mới.
     * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt "video thừa hưởng cơ chế
     * Playlist, không tạo cơ chế riêng"] TRƯỚC ĐÂY hàm này tự quản lý mảng `videoPlaylist` RIÊNG
     * (đã xoá, xem service/state/video-player-mode.js) — giờ refresh ĐÚNG `playlistCache`/
     * `playlistOrder` hợp nhất (Batch 1: `buildVideoPlaylistCache()`, core/playlist/loader.js),
     * TÁI DÙNG y hệt luồng `switchToVideoSource()` (event/workflow/playlist.js) trừ phần reset sort
     * mode (không cần đổi sort mode đang chọn chỉ vì có video mới). Guard đổi từ `isVideoPlayerMode`
     * sang `activeMediaSource` — đúng điều kiện thật cần refresh (Playlist đang browse Video, KHÔNG
     * nhất thiết đang PHÁT — vd đang ở Settings mà vẫn cần list Playlist đúng khi quay lại). */
    async refreshVideoPlaylistIfActive() {
        if (appState.get('activeMediaSource') !== 'video') return;
        const videoRecords = await listVideos(); // core/file-manager/video.js
        const keys = buildVideoPlaylistCache(videoRecords); // core/playlist/loader.js
        appState.set('playlistOrder', keys);
        console.log(`writer: "refreshVideoPlaylistIfActive", page: "playlistOrder", content: "${keys.length} video"`);
        updateShuffleArray(); // core có sẵn (core/playlist/order.js)
        recomputeDisplayOrder(); // core có sẵn (core/playlist/order.js)
        recomputeRenderOrder(); // core có sẵn (core/playlist/order.js)
        renderPlaylistDiff(); // core có sẵn (core/playlist/render.js)
    },

    /** Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=true` — toggle
     * `bgVideoElement` (DUY NHẤT — khác bản đầu từng toggle CẢ audioPlayer). */
    togglePlayPauseVideo() {
        requestWakeLock(); // core/player-controls.js — cùng khuôn togglePlayPause() của Song
        if (bgVideoElement.paused) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
        else bgVideoElement.pause();
    },

    /** Ứng với 'playerControls.video.play' (sự kiện 'play' NGUYÊN BẢN của `bgVideoElement`, xem
     * event/listener/video-player.js) — đổi icon Play->Pause, bật wake lock/listen clock/Media
     * Session, CÙNG Ý NGHĨA `handleAudioPlay()` (core/player-controls.js) nhưng KHÔNG gọi lại hàm
     * đó (hàm đó đụng `refreshSongNode()`/`syncVideoBgToAudio()` — khái niệm của Song, không áp
     * dụng cho Video — viết bản RIÊNG, gọn hơn). */
    handleVideoPlayState() {
        iconPlay.classList.add('hidden'); iconPause.classList.remove('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.remove('paused'); // cùng khuôn handleAudioPlay() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        requestWakeLock(); startListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.pause' — ngược lại `handleVideoPlayState()`. */
    handleVideoPauseState() {
        iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.add('paused'); // cùng khuôn handleAudioPause() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        releaseWakeLock(); stopListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.loadedmetadata' — đặt lại max thanh tiến trình + tổng thời
     * lượng, CÙNG Ý NGHĨA `handleAudioLoadedMetadata()` nhưng đọc `bgVideoElement.duration`. */
    handleVideoLoadedMetadata() {
        progressBar.max = bgVideoElement.duration;
        durationTimeDisplay.textContent = formatTime(bgVideoElement.duration); // core/playlist/state.js
    },

    /** Ứng với 'playerControls.video.timeupdate' (bắn rất dày lúc đang phát) — cập nhật thanh tiến
     * trình (nếu không đang kéo tay) + hiển thị thời gian hiện tại, CÙNG Ý NGHĨA
     * `handleAudioTimeUpdate()` nhưng đọc `bgVideoElement.currentTime` (KHÔNG xử lý phụ đề — video
     * không có phụ đề). */
    handleVideoTimeUpdate() {
        if (!appState.get('isSeeking')) { progressBar.value = bgVideoElement.currentTime; updateProgressBarCSS(); } // core/visualizer/visualizer-display.js
        currentTimeDisplay.textContent = formatTime(bgVideoElement.currentTime);
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi `isVideoPlayerMode=true` — người dùng đang
     * kéo tay, CÙNG Ý NGHĨA `handleProgressBarSeeking()` nhưng không xử lý phụ đề.
     * @param {number} value
     */
    handleVideoSeeking(value) {
        appState.set('isSeeking', true);
        currentTimeDisplay.textContent = formatTime(value);
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi `isVideoPlayerMode=true` — commit vị
     * trí mới THẲNG vào `bgVideoElement.currentTime` (KHÁC bản đầu ghi vào `audioPlayer`).
     * @param {number} value
     */
    handleVideoSeekCommit(value) {
        bgVideoElement.currentTime = value;
        appState.set('isSeeking', false);
    },

    /** Ứng với 'playerControls.video.ended' (sự kiện 'ended' NGUYÊN BẢN của `bgVideoElement` —
     * `loop=false` lúc ở Player mode nên sự kiện này CÓ bắn, xem `setBgVideoElementForPlayerMode()`
     * core/video-player.js) — video hết, tự chuyển video kế tiếp.
     * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt "video thừa hưởng cơ chế
     * Playlist, không tạo cơ chế next riêng"] Gọi `playNext(false)` (core/player-controls.js) —
     * DÙNG CHUNG với Song, THAY `this.nextVideo(false)` riêng đã xoá — tự đọc displayOrder/
     * shuffleIndices/repeatMode, tự gọi lại window.playSong() -> quay lại dispatch mediaType. */
    async handleVideoPlayerEnded() {
        stopListenClock(); // core/player-controls.js, hàm có sẵn — dùng lại nguyên
        playNext(false); // core có sẵn (core/player-controls.js), dùng CHUNG với Song — force=false, tôn trọng repeatMode
    },

    /**
     * XOÁ (phản hồi Giang — "trước đây có video UI enable phải vào Settings, nên phải ẩn Playlist,
     * switch về Visualizer ngay (bao gồm nút back của main Settings). Bây giờ đã hợp nhất Video &
     * Song vào Playlist nên không cần nữa") — 2 hàm từng ở đây, `handleBackToPlaylistFromVideoMode()`
     * (nút "Back" từ Visualizer → cuộn về Settings thay vì Playlist) và
     * `closeSettingsDrawerToVisualizer()` (nút X Main Settings → ẩn Playlist, chuyển thẳng
     * Visualizer) — CẢ HAI chỉ tồn tại vì Video Player mode TỪNG bật được từ 1 checkbox SÂU trong
     * Settings → File Manager → Video (đã xoá hẳn từ Batch 6, "Song/Video Unification"). Giờ Video
     * LUÔN được chọn TỪ Playlist (y hệt Song, qua dropdown/menu 3 chấm thống nhất) nên KHÔNG còn
     * kịch bản "vừa bật Video Player mode trong lúc đang đứng giữa Settings" nữa — router
     * (event/router/player-controls.js, case 'playerControls.backToPlaylist.click'/
     * 'playerControls.settingsDrawer.close') đã bỏ nhánh VirtualMachineState theo `isVideoPlayerMode`
     * tương ứng, gọi THẲNG hành vi gốc `handleBackToPlaylistClick()`/`workflowPlayerControls.
     * closeSettingsDrawer()` — cả 2 đều LUÔN về Playlist đúng, giống hệt Song.
     */
};
