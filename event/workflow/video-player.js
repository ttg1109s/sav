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

        await this.playVideoByKey(startKey);
        switchToVisualizer(); // core/player-controls.js, hàm CÓ SẴN
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
        bgVideoElement.removeAttribute('src');
        bgVideoElement.load(); // buộc <video> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)
        updateDOMBackground(); // core/color-utils.js, hàm CÓ SẴN — trả visualizerSolidBg về cfg.bgColor

        exitVideoPlayerModeState(); // core/video-player.js
        releaseWakeLock(); stopListenClock(); // core/player-controls.js — dọn nốt 2 cơ chế đã bật lúc phát
    },

    /** Nạp 1 video vào `bgVideoElement` (DUY NHẤT — xem docstring đầu file) + phát ngay + cập nhật
     * title/artist/MediaSession + nuôi analyser.
     * @param {string} videoKey
     */
    async playVideoByKey(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) {
            // guard: video vừa bị xoá ở nơi khác giữa lúc đang phát — TRƯỚC ĐÂY tự tính fallback
            // qua computeNextVideoKey(videoPlaylist,...) RIÊNG (đã xoá, Batch 2). Giờ dùng ĐÚNG cơ
            // chế Next DÙNG CHUNG với Song (playNext(), core/player-controls.js) — hàm đó tự đọc
            // displayOrder/shuffleIndices hiện tại (đã lọc key hỏng qua confirmedBrokenKeys nếu có)
            // rồi tự gọi lại window.playSong() -> quay lại đúng dispatch mediaType từ đầu.
            playNext(true); // core có sẵn (core/player-controls.js), dùng CHUNG với Song
            return;
        }

        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
        this._objectUrl = URL.createObjectURL(record.blob);

        // SỬA (21/07/2026, đợt so sánh 2 luồng — Giang yêu cầu) — mirror ĐÚNG `setupVideoBgSource()`
        // (core/state-and-video-bg.js, luồng bg video THAM CHIẾU): ẩn TRƯỚC (opacity=0) tránh chớp
        // khung hình cũ/đen, gán `src`, RỒI chờ 'loadeddata'/'playing' (bất kỳ cái nào bắn trước,
        // {once:true} tự gỡ) mới fade hiện — KHÁC bản trước set opacity=1 NGAY LẬP TỨC (từ
        // `setBgVideoElementForPlayerMode()`, giờ đã bỏ hẳn phần opacity ở đó, xem core/video-
        // player.js) khi khung hình THẬT chưa chắc đã sẵn sàng.
        bgVideoElement.style.opacity = '0';
        bgVideoElement.src = this._objectUrl;
        const fadeVideoIn = () => { bgVideoElement.style.opacity = '1'; };
        bgVideoElement.addEventListener('loadeddata', fadeVideoIn, { once: true });
        bgVideoElement.addEventListener('playing', fadeVideoIn, { once: true });

        // MỚI (ver12 "Song/Video Unification", Batch 2, Giang chốt) — ghi `currentKey` (package
        // `playlist`, DÙNG CHUNG với Song, THAY hẳn `currentVideoKey` riêng đã xoá) — ĐÂY là điểm
        // mấu chốt để playNext()/playPrev() (core/player-controls.js, đọc displayOrder/
        // shuffleIndices.indexOf(currentKey)) tính đúng vị trí hiện tại cho CẢ Video, không cần
        // biết gì riêng về "đang phát video" — hành vi/tên field GIỐNG HỆT Song (`appState.set(
        // 'currentKey', key)` trong window.playSong(), core/playlist/actions.js).
        appState.set('currentKey', videoKey);
        console.log(`writer: "playVideoByKey", page: "currentKey", content: "${videoKey}"`);
        // MỚI (phản hồi Giang 28/07/2026) — `bumpSongPlayCount()` (core/listen-stats.js) TRƯỚC ĐÂY
        // CHỈ được gọi trong window.playSong() (core/playlist/actions.js) — nhánh Video dispatch ra
        // KHỎI hàm đó TRƯỚC khi tới dòng gọi, nên Play Count chưa từng tăng cho Video (trong khi
        // "Listened" — addSongListenTime(), core/player-controls.js — vẫn chạy vì đọc thẳng
        // `currentKey` chung, không phân biệt loại). `songStatsMap` (core/listen-stats.js) vốn đã
        // key-agnostic (Map<string,...>, không quan tâm key là songKey hay videoKey) nên gọi thẳng
        // ở đây là đủ, không cần sửa gì thêm ở listen-stats.js.
        bumpSongPlayCount(videoKey); // core/listen-stats.js

        // BẮT BUỘC — đảm bảo audioContext/analyser tồn tại (an toàn gọi lại nhiều lần, guard sẵn
        // trong chính 2 hàm) RỒI mới nối bgVideoElement vào — thứ tự ngược sẽ lỗi (analyser chưa
        // có để nối vào).
        setupAudioContext(); // core/audio-engine.js
        connectVideoElementToAnalyser(); // core/video-player.js

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
        // `currentCoverObjectURL` của Song. `animate-spin-slow` LUÔN có mặt (video vừa gọi
        // `bgVideoElement.play()` ngay dưới), lớp `.paused` (nếu cần) do `handleVideoPlayState()`/
        // `handleVideoPauseState()` tự toggle sau, cùng cách Song đang làm (core/player-
        // controls.js, KHÔNG đụng).
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} }
        this._thumbObjectUrl = URL.createObjectURL(record.thumbBlob);
        recordContainer.innerHTML = `<img id="record-art" src="${this._thumbObjectUrl}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 animate-spin-slow" alt="${t('videoPlayer.untitled')}"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;

        requestWakeLock(); // core/player-controls.js — cùng khuôn playNext()/playPrev()/togglePlayPause() của Song
        bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
    },

    /** MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — làm mới lại Playlist
     * (đọc lại DB) TRONG LÚC đang browse nguồn Video — gọi khi video được thêm/xoá ở File Manager
     * (vẫn tới được panel đó lúc Playlist đang mở ở nguồn Video, xem
     * `handleBackToPlaylistFromVideoMode()`) MÀ KHÔNG cần đổi Nguồn tắt/bật lại mới thấy video mới.
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

    /** MỚI (21/07/2026, Giang chỉ ra: "nút về playlist UI ... cần quy trình khác, phải dùng
     * vmstate") — ứng với 'playerControls.backToPlaylist.click' khi `isVideoPlayerMode=true` (xem
     * event/router/player-controls.js, VirtualMachineState branch theo cờ này — nhánh false vẫn
     * gọi THẲNG `handleBackToPlaylistClick()` gốc, KHÔNG đổi gì).
     * SỬA (21/07/2026, cùng ngày — Giang chỉnh lại: "từ visualizer bấm back -> phải chuyển ngay về
     * SETTINGS", KHÔNG PHẢI Playlist như bản trước) — Video Player mode BẬT TỪ trang SETTINGS
     * (checkbox trong File Manager -> Video, panel đang mở SÂU trong đó) — bấm "Back" hợp lý nhất
     * là trở về ĐÚNG chỗ vừa bật nó (Settings/panel Video), KHÔNG PHẢI Playlist (khác hẳn hành vi
     * "Back" của Song — Song luôn được chọn TỪ trang Playlist nên back về Playlist là đúng, nhưng
     * Video Player không có tương đương "chọn từ trang Playlist" nào cả).
     * `scrollSideLeftToSettingsSmooth()` (core/player-controls.js, hàm CÓ SẴN — cùng cặp với
     * `scrollSideLeftToPlaylistSmooth()`) — tự cuộn `#side-left-container` về ĐÚNG trang Settings.
     * KHÔNG dừng video (giữ ĐÚNG hành vi "quay lại không dừng phát" đã áp dụng cho Song). */
    handleBackToPlaylistFromVideoMode() {
        handleBackToPlaylistClick(); // core/player-controls.js — hành vi gốc (ẩn Visualizer, hiện lại #app-stack, KHÔNG dừng phát)
        scrollSideLeftToSettingsSmooth(); // core/player-controls.js, hàm CÓ SẴN — tự cuộn về ĐÚNG trang Settings (KHÁC Song — xem docstring)
    },

    /** MỚI (21/07/2026, Giang yêu cầu "nút X Main Settings khi Video Player đang bật phải chuyển
     * thẳng về Visualizer") — ứng với 'playerControls.settingsDrawer.close' khi
     * `isVideoPlayerMode=true` (xem event/router/player-controls.js, VirtualMachineState branch —
     * nhánh false vẫn gọi `workflowPlayerControls.closeSettingsDrawer()` gốc, KHÔNG đổi gì).
     * `resetSettingsStackToMain()` (core, dùng lại nguyên từ `closeSettingsDrawer()` gốc) — dọn
     * ngăn xếp panel con (File Manager -> Video đang mở SÂU) về lại trang gốc Settings, để lần mở
     * lại sau LUÔN sạch — KHÔNG gọi `scrollSideLeftToPlaylistSmooth()` như nhánh Song (không cần,
     * `switchToVisualizer()` NGAY SAU đã ẩn hẳn `#app-stack`, vị trí cuộn bên trong không còn ai
     * nhìn thấy lúc này) — KHÔNG gọi `validateVideoBgOnClose()` (chỉ liên quan Video nền trang trí,
     * Block gate đã đảm bảo tính năng đó luôn TẮT suốt lúc Video Player mode bật, xem event/
     * block.js — gọi vào cũng chỉ no-op, bỏ cho gọn). */
    closeSettingsDrawerToVisualizer() {
        resetSettingsStackToMain(); // core, dùng lại nguyên
        switchToVisualizer(); // core/player-controls.js, hàm CÓ SẴN
    },
};
