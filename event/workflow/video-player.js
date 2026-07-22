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
    _thumbObjectUrl: null, // object URL của thumbBlob HIỆN TẠI (cover ở player bar, #record-container) — revoke trước khi tạo url mới
    _swipeStartY: null, // toạ độ Y lúc touchstart — dùng bởi event/listener/video-player.js (cử chỉ vuốt)

    /** Vào Video Player mode: đọc danh sách video, phát video đầu tiên, CHUYỂN MÀN HÌNH sang
     * Visualizer. GỌI TỪ `workflowFileManagerVideo.enablePlayerModeFromPanel()` (checkbox trong
     * panel File Manager -> Video) — nơi gọi ĐÃ tự đảm bảo Video nền trang trí đang TẮT trước khi
     * gọi hàm này (Block gate, xem event/block.js).
     * SỬA (21/07/2026, Giang yêu cầu "khi enable Video Player, mọi trạng thái phát Song phải về
     * gốc — pause + UI playlist sạch như mới load app — TRƯỚC KHI chuyển màn") — nếu đang có bài
     * hát đang phát/tạm dừng dở (`currentKey` khác null): pause `audioPlayer` + xoá `currentKey` +
     * refresh LẠI đúng 1 hàng đó (`refreshSongNode()`, core/playlist/render.js — patch DOM TRỰC
     * TIẾP, không render lại cả danh sách) để xoá highlight "đang phát". LÀM TRƯỚC `switchToVisualizer()`
     * — đúng thứ tự Giang yêu cầu.
     * ĂN THEO MIỄN PHÍ (không cần code thêm) — `currentKey=null` khiến `saveResumeStateToLocalStorage()`
     * (core/resume-state-storage.js, dòng đầu: `if (currentKey === null) return false;`) tự động
     * KHÔNG lưu gì + KHÔNG set cờ resume nữa mỗi khi tab bị ẩn lúc đang ở Video Player mode — ĐÚNG
     * ý Giang "phải skip chế độ resume tab", không cần sửa gì thêm ở core/tab-hide-reload.js.
     * SỬA LẦN 2 (21/07/2026, Giang yêu cầu "so sánh bg video enable và luồng video player") — ĐỐI
     * CHIẾU `handleVideoBackground()` (core/state-and-video-bg.js) phát hiện 1 dòng CÒN THIẾU:
     * `visualizerSolidBg.style.backgroundColor = '#000000'` — nền đen cưỡng chế PHÍA SAU video
     * (lớp `#visualizer-solid-bg`, z:-3, dưới cùng). KHÔNG set dòng này, nền solid vẫn giữ màu
     * `cfg.bgColor` cũ (vd xanh đậm/tuỳ theme) — tuỳ mắt nhìn CÓ THỂ trông giống "video không che
     * hết màn" hoặc lẫn với suy đoán z-index (đã bác bỏ). Thêm ĐÚNG dòng này, khớp 100% luồng bg
     * video đã chứng minh hoạt động tốt.
     * `switchToVisualizer()` (core/player-controls.js, hàm CÓ SẴN) — ẩn `#app-stack` (Playlist+
     * Settings), hiện `#player-container` (bar dưới cùng — nếu không gọi hàm này, mang class
     * `hidden` mãi mãi, mọi cập nhật UI bên trong dù đúng vẫn KHÔNG AI THẤY ĐƯỢC). CHỈ gọi 1 LẦN
     * lúc VÀO mode. */
    async enterVideoPlayerMode() {
        const videos = await listVideos(); // core/file-manager/video.js
        if (videos.length === 0) { await alertModal(t('videoPlayer.empty')); return; }

        const previousSongKey = appState.get('currentKey');
        if (previousSongKey !== null) {
            audioPlayer.pause(); // bắn sự kiện 'pause' NGUYÊN BẢN -> handleAudioPause() (core/player-controls.js, KHÔNG đụng) tự lo icon/wake lock/Media Session cho Song
            appState.set('currentKey', null);
            refreshSongNode(previousSongKey); // core/playlist/render.js — patch riêng đúng 1 hàng, xoá highlight "đang phát"
        }

        // SỬA (21/07/2026, Giang yêu cầu "phải phát video mới nhất đầu tiên") — BỎ `.reverse()` —
        // `sortVideosByAddedDateDesc()` (core/file-manager/video.js) đã trả SẴN mới -> cũ, dùng
        // THẲNG luôn, video[0] = mới nhất. Next giờ đi từ mới -> cũ dần, quay vòng về mới nhất khi
        // hết (hoặc dừng hẳn nếu repeatMode tắt — xem nextVideo()).
        const videoPlaylist = sortVideosByAddedDateDesc(videos).map((v) => v.key); // core/file-manager/video.js

        visualizerSolidBg.style.backgroundColor = '#000000'; // khớp handleVideoBackground() (core/state-and-video-bg.js) — nền đen cưỡng chế phía sau video
        enterVideoPlayerModeState(videoPlaylist); // core/video-player.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + pointer-events

        await this.playVideoByKey(videoPlaylist[0]);
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
        if (!record) { // guard: video vừa bị xoá ở nơi khác giữa lúc đang phát — thử bỏ qua sang video kế tiếp
            const fallbackKey = computeNextVideoKey(appState.get('videoPlaylist'), videoKey); // core/video-player.js
            if (fallbackKey && fallbackKey !== videoKey) await this.playVideoByKey(fallbackKey);
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

    /** MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — làm mới lại
     * `videoPlaylist` (đọc lại DB) TRONG LÚC Video Player mode đang chạy — gọi khi video được
     * thêm/xoá ở File Manager -> Video (vẫn tới được panel đó lúc video đang phát nền, xem
     * `handleBackToPlaylistFromVideoMode()`) MÀ KHÔNG cần tắt/bật lại mode mới thấy video mới.
     * KHÔNG đụng video ĐANG PHÁT (`currentVideoKey` giữ nguyên) — chỉ cập nhật lại MẢNG danh sách
     * (in-place, `appState.mutate()`) để Next/Prev thấy được ngay video mới thêm.
     * Guard `isVideoPlayerMode` — gọi lúc KHÔNG ở mode này (vd upload bình thường) là no-op.
     */
    async refreshVideoPlaylistIfActive() {
        if (!appState.get('isVideoPlayerMode')) return;
        const videos = await listVideos(); // core/file-manager/video.js
        const videoPlaylist = sortVideosByAddedDateDesc(videos).map((v) => v.key); // mới -> cũ, core/file-manager/video.js
        appState.mutate('videoPlaylist', (arr) => { arr.length = 0; arr.push(...videoPlaylist); }); // in-place — mutate() không nhận giá trị return
    },

    /** Ứng với 'playerControls.next.click' khi `isVideoPlayerMode=true` (xem event/router/
     * player-controls.js) — `force=true` (mặc định, khớp `playNext(true)` của Song khi bấm nút).
     * `handleVideoPlayerEnded()` (video hết TỰ NHIÊN) gọi `force=false` — CÙNG Ý NGHĨA
     * `playNext(force)` (core/player-controls.js): `force=false` tôn trọng ranh giới cuối danh
     * sách khi `repeatMode` TẮT (dừng hẳn thay vì tự quay vòng); `force=true` LUÔN quay vòng.
     * MỚI (21/07/2026, Giang yêu cầu "shuffle/repeat chưa áp dụng cho video player") — thêm
     * `isShuffle`/`repeatMode` (appState CHUNG với Song — tái dùng ĐÚNG 2 nút vật lý, xem docstring
     * đầu file) — `repeatMode===2` (Lặp 1) + kết thúc tự nhiên -> lặp lại chính video, KHÔNG next.
     * @param {boolean} [force]
     */
    async nextVideo(force = true) {
        if (!force && appState.get('repeatMode') === 2) { // Lặp 1, kết thúc TỰ NHIÊN -> lặp lại chính video đó
            bgVideoElement.currentTime = 0;
            bgVideoElement.play().catch(() => {});
            return;
        }

        const videoPlaylist = appState.get('videoPlaylist');
        const currentVideoKey = appState.get('currentVideoKey');
        let nextKey;

        if (appState.get('isShuffle')) {
            nextKey = pickRandomVideoKeyExcluding(videoPlaylist, currentVideoKey); // core/video-player.js — đơn giản hoá, xem docstring hàm đó
        } else {
            const currentPos = videoPlaylist.indexOf(currentVideoKey);
            const isAtEnd = (currentPos === -1 || currentPos === videoPlaylist.length - 1);
            if (isAtEnd && appState.get('repeatMode') === 0 && !force) {
                bgVideoElement.pause(); // Tắt lặp + hết danh sách TỰ NHIÊN -> dừng hẳn, KHÔNG tự quay vòng (giống playNext() Song)
                return;
            }
            nextKey = computeNextVideoKey(videoPlaylist, currentVideoKey); // core/video-player.js — tuần tự, LUÔN wrap (đúng cho force=true/repeatMode=1)
        }

        if (!nextKey) return; // guard: danh sách rỗng (hiếm — video vừa bị xoá hết giữa lúc đang ở mode)
        await this.playVideoByKey(nextKey);
    },

    /** Ứng với 'playerControls.prev.click' khi `isVideoPlayerMode=true`.
     * MỚI (21/07/2026, cùng đợt) — mirror ĐÚNG `playPrev()` (Song, core/player-controls.js): quá
     * 3 giây vào video hiện tại -> "Prev" chỉ tua về đầu chính video đó (KHÔNG lùi video), quy ước
     * chung của hầu hết trình phát nhạc/video. `isShuffle` bật -> chọn ngẫu nhiên (đơn giản hoá,
     * xem `pickRandomVideoKeyExcluding()` core/video-player.js — KHÔNG áp dụng cho Prev lúc shuffle
     * theo đúng "lịch sử vừa xem", chỉ random tương tự Next). */
    async prevVideo() {
        if (bgVideoElement.currentTime > 3) { bgVideoElement.currentTime = 0; return; }

        const videoPlaylist = appState.get('videoPlaylist');
        const currentVideoKey = appState.get('currentVideoKey');
        const prevKey = appState.get('isShuffle')
            ? pickRandomVideoKeyExcluding(videoPlaylist, currentVideoKey) // core/video-player.js
            : computePrevVideoKey(videoPlaylist, currentVideoKey); // core/video-player.js
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
     * core/video-player.js) — video hết, tự chuyển video kế tiếp (KHÔNG có repeatMode riêng cho
     * video ở bản đầu — LUÔN tự next, quay vòng về đầu danh sách khi hết). */
    async handleVideoPlayerEnded() {
        stopListenClock(); // core/player-controls.js, hàm có sẵn — dùng lại nguyên
        await this.nextVideo(false); // force=false — kết thúc TỰ NHIÊN, tôn trọng repeatMode (xem docstring nextVideo())
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
