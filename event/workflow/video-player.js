/**
 * event/workflow/video-player.js — GỌI TỪ 2 nơi: (1) `workflowFileManagerVideo.
 * enablePlayerModeFromPanel()`/`disablePlayerModeFromPanel()` — checkbox "Video Player mode" trong
 * panel File Manager -> Video; (2) router "playerControls" — Next/Prev/Play-Pause (VirtualMachineState
 * theo `isVideoPlayerMode`) + 5 sự kiện RIÊNG của `bgVideoElement` (video.timeupdate/
 * loadedmetadata/play/pause/ended — xem event/listener/video-player.js) + progressBar seek
 * (VirtualMachineState).
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
 * NẠP SAU: core/video-player.js, core/file-manager/video.js (listVideos/sortVideosByAddedDateDesc),
 * service/db.js (getVideoRecord), core/audio-engine.js (setupAudioContext).
 */
const workflowVideoPlayer = {
    _objectUrl: null, // object URL HIỆN TẠI đang gán cho bgVideoElement (revoke trước khi tạo url mới)
    _swipeStartY: null, // toạ độ Y lúc touchstart — dùng bởi event/listener/video-player.js (cử chỉ vuốt)

    /** Vào Video Player mode: đọc danh sách video, phát video đầu tiên, CHUYỂN MÀN HÌNH sang
     * Visualizer. GỌI TỪ `workflowFileManagerVideo.enablePlayerModeFromPanel()` (checkbox trong
     * panel File Manager -> Video) — nơi gọi ĐÃ tự đảm bảo Video nền trang trí đang TẮT trước khi
     * gọi hàm này (Block gate, xem event/block.js).
     * `switchToVisualizer()` (core/player-controls.js, hàm CÓ SẴN) — ẩn `#app-stack` (Playlist+
     * Settings), hiện `#player-container` (bar dưới cùng — nếu không gọi hàm này, mang class
     * `hidden` mãi mãi, mọi cập nhật UI bên trong dù đúng vẫn KHÔNG AI THẤY ĐƯỢC). CHỈ gọi 1 LẦN
     * lúc VÀO mode. */
    async enterVideoPlayerMode() {
        const videos = await listVideos(); // core/file-manager/video.js
        if (videos.length === 0) { await alertModal(t('videoPlayer.empty')); return; }

        // Thứ tự phát: cũ -> mới (đảo ngược sortVideosByAddedDateDesc — hàm đó trả mới -> cũ).
        const videoPlaylist = sortVideosByAddedDateDesc(videos).reverse().map((v) => v.key); // core/file-manager/video.js

        enterVideoPlayerModeState(videoPlaylist); // core/video-player.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + z-index + pointer-events

        await this.playVideoByKey(videoPlaylist[0]);
        switchToVisualizer(); // core/player-controls.js, hàm CÓ SẴN
    },

    /** Thoát Video Player mode: dừng + dọn `bgVideoElement`, trả về mặc định trang trí. */
    async exitVideoPlayerMode() {
        bgVideoElement.pause();
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, ẩn, z-index/pointer-events mặc định
        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }
        bgVideoElement.removeAttribute('src');
        bgVideoElement.load(); // buộc <video> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)

        exitVideoPlayerModeState(); // core/video-player.js
        releaseWakeLock(); stopListenClock(); // core/player-controls.js — dọn nốt 2 cơ chế đã bật lúc phát
    },

    /** Nạp 1 video vào `bgVideoElement` (DUY NHẤT — xem docstring đầu file) + phát ngay + cập nhật
     * title/artist/MediaSession + nuôi analyser.
     * @param {string} videoKey
     */
    async playVideoByKey(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) { // guard: video vừa bị xoá ở nơi khác giữa lúc đang phát — thử bỏ qua sang video kế tiếp
            const fallbackKey = computeNextVideoKey(appState.get('videoPlaylist'), videoKey); // core/video-player.js
            if (fallbackKey && fallbackKey !== videoKey) await this.playVideoByKey(fallbackKey);
            return;
        }

        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
        this._objectUrl = URL.createObjectURL(record.blob);
        bgVideoElement.src = this._objectUrl;

        setCurrentVideoKey(videoKey); // core/video-player.js

        // BẮT BUỘC — đảm bảo audioContext/analyser tồn tại (an toàn gọi lại nhiều lần, guard sẵn
        // trong chính 2 hàm) RỒI mới nối bgVideoElement vào — thứ tự ngược sẽ lỗi (analyser chưa
        // có để nối vào).
        setupAudioContext(); // core/audio-engine.js
        connectVideoElementToAnalyser(); // core/video-player.js

        playerTitle.textContent = record.filename || t('videoPlayer.untitled');
        playerArtist.textContent = t('videoPlayer.nowPlayingLabel');
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: record.filename || t('videoPlayer.untitled'),
                artist: t('videoPlayer.nowPlayingLabel'),
                artwork: [],
            });
        }

        requestWakeLock(); // core/player-controls.js — cùng khuôn playNext()/playPrev()/togglePlayPause() của Song
        bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
    },

    /** Ứng với 'playerControls.next.click' khi `isVideoPlayerMode=true` (xem event/router/
     * player-controls.js). */
    async nextVideo() {
        const nextKey = computeNextVideoKey(appState.get('videoPlaylist'), appState.get('currentVideoKey')); // core/video-player.js
        if (!nextKey) return; // guard: danh sách rỗng (hiếm — video vừa bị xoá hết giữa lúc đang ở mode)
        await this.playVideoByKey(nextKey);
    },

    /** Ứng với 'playerControls.prev.click' khi `isVideoPlayerMode=true`. */
    async prevVideo() {
        const prevKey = computePrevVideoKey(appState.get('videoPlaylist'), appState.get('currentVideoKey')); // core/video-player.js
        if (!prevKey) return;
        await this.playVideoByKey(prevKey);
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
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        requestWakeLock(); startListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.pause' — ngược lại `handleVideoPlayState()`. */
    handleVideoPauseState() {
        iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden');
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
     * core/video-player.js) — video hết, tự chuyển video kế tiếp (KHÔNG có repeatMode riêng cho
     * video ở bản đầu — LUÔN tự next, quay vòng về đầu danh sách khi hết). */
    async handleVideoPlayerEnded() {
        stopListenClock(); // core/player-controls.js, hàm có sẵn — dùng lại nguyên
        await this.nextVideo();
    },

    /** MỚI (21/07/2026, Giang chỉ ra: "nút về playlist UI ... cần quy trình khác, phải dùng
     * vmstate") — ứng với 'playerControls.backToPlaylist.click' khi `isVideoPlayerMode=true` (xem
     * event/router/player-controls.js, VirtualMachineState branch theo cờ này — nhánh false vẫn
     * gọi THẲNG `handleBackToPlaylistClick()` gốc, KHÔNG đổi gì).
     * LÝ DO CẦN NHÁNH RIÊNG: `switchToVisualizer()` (gọi ở `enterVideoPlayerMode()`) trong MỌI
     * trường hợp khác (tap bài hát, nút "Quay lại Visualizer") LUÔN được gọi lúc trang Playlist
     * ĐANG hiện sẵn trong `#side-left-container` (`scrollLeft≈0` từ trước) — nhưng Video Player
     * mode BẬT TỪ trang SETTINGS (checkbox trong File Manager -> Video), nên `#side-left-container`
     * vẫn đang cuộn Ở TRANG SETTINGS lúc gọi `switchToVisualizer()`. Nếu chỉ gọi
     * `handleBackToPlaylistClick()` gốc, người dùng bấm "Quay lại Danh sách" sẽ thấy LẠI trang
     * Settings/panel Video, không phải Playlist — PHẢI tự cuộn thêm bằng
     * `scrollSideLeftToPlaylistSmooth()` (core/player-controls.js, hàm CÓ SẴN). KHÔNG dừng video
     * (giữ ĐÚNG hành vi "quay lại Playlist không dừng nhạc" đã áp dụng cho Song). */
    handleBackToPlaylistFromVideoMode() {
        handleBackToPlaylistClick(); // core/player-controls.js — hành vi gốc (ẩn Visualizer, hiện lại #app-stack, KHÔNG dừng phát)
        scrollSideLeftToPlaylistSmooth(); // core/player-controls.js, hàm CÓ SẴN — tự cuộn về ĐÚNG trang Playlist
    },
};
