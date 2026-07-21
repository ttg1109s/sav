/**
 * event/workflow/video-player.js — GỌI TỪ 2 nơi: (1) `workflowFileManagerVideo.
 * enablePlayerModeFromPanel()`/`disablePlayerModeFromPanel()` — checkbox "Video Player mode" trong
 * panel File Manager -> Video (Batch 3 ban đầu đặt nút này ở header Visualizer — Giang yêu cầu
 * 21/07/2026 dời hẳn sang đây, xem lịch sử patch); (2) router "playerControls" (Next/Prev/Play-
 * Pause/'ended' khi `isVideoPlayerMode=true` — xem event/router/player-controls.js,
 * VirtualMachineState branch theo cờ này).
 *
 * KHOÁ CHÉO với Video nền trang trí (SỬA 21/07/2026 — Giang yêu cầu đổi "tự tắt hộ lẫn nhau" thành
 * "khoá cứng + báo lý do"; SỬA LẦN 2 cùng ngày — chuyển từ `if/alertModal` thủ công sang Block gate
 * khai báo, xem event/block.js) — file NÀY KHÔNG đụng `vizConfig.videoBgEnabled`/
 * `handleVideoBackground()` — Block gate (event/block.js, đăng ký trên msg.type
 * 'fileManagerVideo.playerModeToggle.enable.click'/'visualizerControlCenter.videoEnable.enable.click')
 * tự chặn TRƯỚC KHI message tới router, đảm bảo 2 tính năng KHÔNG BAO GIỜ cùng bật — file này không
 * cần biết gì về Video nền trang trí nữa (tách bạch hoàn toàn 2 domain, chỉ còn dùng chung
 * `bgVideoElement`).
 *
 * BẢN ĐẦU (21/07/2026, đã báo Giang là đơn giản hoá) — KHÔNG có shuffle/repeat/wake-lock/Media-
 * Session RIÊNG cho video (audioPlayer vẫn đang thật sự phát dù muted, nên các cơ chế đó của SONG
 * vẫn chạy nguyên, "ăn theo" miễn phí — xem handleAudioPlay()/handleAudioPause() core/player-
 * controls.js, KHÔNG bị đụng). Danh sách video phát TUẦN TỰ theo thứ tự thêm vào (cũ -> mới).
 *
 * NẠP SAU: core/video-player.js, core/file-manager/video.js (listVideos/sortVideosByAddedDateDesc),
 * service/db.js (getVideoRecord).
 */
const workflowVideoPlayer = {
    _objectUrl: null, // object URL HIỆN TẠI đang gán cho CẢ audioPlayer LẪN bgVideoElement (revoke trước khi tạo url mới)
    _swipeStartY: null, // toạ độ Y lúc touchstart — dùng bởi event/listener/video-player.js (cử chỉ vuốt)

    /** Vào Video Player mode: đọc danh sách video, phát video đầu tiên, CHUYỂN MÀN HÌNH sang
     * Visualizer. GỌI TỪ `workflowFileManagerVideo.enablePlayerModeFromPanel()` (checkbox trong
     * panel File Manager -> Video) — nơi gọi ĐÃ tự đảm bảo Video nền trang trí đang TẮT trước khi
     * gọi hàm này (Block gate, xem event/block.js).
     * SỬA (21/07/2026, Giang phát hiện 3 lỗi cùng gốc: "chưa ẩn playlist UI"/"chỉ nghe audio không
     * thấy hình"/"player bottom không cập nhật gì cả") — CẢ 3 đều do THIẾU gọi `switchToVisualizer()`
     * (core/player-controls.js, hàm CÓ SẴN, dùng lại NGUYÊN — KHÔNG viết lại): hàm đó vừa ẩn
     * `#app-stack` (Playlist+Settings gộp, đúng ý "ẩn playlist UI" — xem event-bus-flow lịch sử,
     * Settings/Playlist LUÔN gộp 1 khối từ HOTFIX 16), vừa HIỆN `#player-container` (bar dưới cùng
     * — TRƯỚC ĐÓ vẫn mang class `hidden` vì hàm chuyển màn hình chưa từng được gọi, nên progress
     * bar/current time/duration/filename... dù JS vẫn cập nhật giá trị bên trong, hoàn toàn KHÔNG
     * AI THẤY ĐƯỢC), vừa HIỆN `bgVideoElement` (đang có opacity đúng nhưng nằm SAU lớp #app-stack
     * z-[60] che kín, nên "chỉ nghe audio"). CHỈ gọi 1 LẦN lúc VÀO mode (không gọi lại mỗi lần đổi
     * video, screen đã đúng rồi). */
    async enterVideoPlayerMode() {
        const videos = await listVideos(); // core/file-manager/video.js
        if (videos.length === 0) { await alertModal(t('videoPlayer.empty')); return; }

        // Thứ tự phát: cũ -> mới (đảo ngược sortVideosByAddedDateDesc — hàm đó trả mới -> cũ).
        const videoPlaylist = sortVideosByAddedDateDesc(videos).reverse().map((v) => v.key); // core/file-manager/video.js

        enterVideoPlayerModeState(videoPlaylist); // core/video-player.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện

        await this.playVideoByKey(videoPlaylist[0]);
        switchToVisualizer(); // core/player-controls.js, hàm CÓ SẴN — xem docstring trên vì sao bắt buộc
    },

    /** Thoát Video Player mode: dừng + dọn 2 element, trả `bgVideoElement` về mặc định trang trí. */
    async exitVideoPlayerMode() {
        audioPlayer.pause();
        bgVideoElement.pause();
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, ẩn
        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }
        audioPlayer.removeAttribute('src');
        audioPlayer.load(); // buộc <audio> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)

        exitVideoPlayerModeState(); // core/video-player.js
    },

    /** Nạp 1 video vào CẢ 2 element (audioPlayer muted nuôi analyser + bgVideoElement thật) + phát
     * ngay. Dùng CHUNG 1 object URL cho cả 2 (`URL.createObjectURL()` gán được cho nhiều element).
     * SỬA (21/07/2026, Giang chỉ ra "player bottom không hiện file name") — cập nhật
     * `playerTitle`/`playerArtist` (dom-refs có sẵn, DÙNG CHUNG với Song — cùng khuôn `window.
     * playSong()` core/playlist/actions.js, KHÔNG viết field hiển thị riêng) + MediaSession, để
     * player bottom hiện ĐÚNG tên file video đang phát (KHÔNG đổi ảnh vinyl/cover — Giang không yêu
     * cầu, để nguyên ảnh cũ, đơn giản hoá bản đầu). `currentTime`/`duration`/progress bar/seek TỰ
     * hoạt động đúng (handleAudioTimeUpdate()/handleAudioLoadedMetadata()/handleProgressBarSeek*()
     * core/player-controls.js — hàm CÓ SẴN, đọc THẲNG `audioPlayer.currentTime`/`.duration`, KHÔNG
     * cần biết `currentKey`/video gì cả — chỉ KHÔNG HIỂN THỊ ĐƯỢC vì `#player-container` đang
     * `hidden`, xem `enterVideoPlayerMode()` — đã fix bằng switchToVisualizer(), KHÔNG cần sửa gì
     * thêm ở 4 hàm đó).
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

        audioPlayer.src = this._objectUrl;
        audioPlayer.muted = true;
        bgVideoElement.src = this._objectUrl;

        setCurrentVideoKey(videoKey); // core/video-player.js

        // SỬA (21/07/2026, Giang chỉ ra "nguồn phân tích audio chưa được cấp") — `setupAudioContext()`
        // (core/audio-engine.js) tạo `AudioContext`/`analyser`/`createMediaElementSource(audioPlayer)`
        // — nhưng CHỈ tạo ĐÚNG 1 LẦN DUY NHẤT (guard `if (!appState.get('audioContext'))`, an toàn
        // gọi lại nhiều lần). `window.playSong()` LUÔN gọi hàm này mỗi lần phát — nếu người dùng
        // CHƯA TỪNG phát bài hát nào trước khi bật Video Player mode, `audioContext`/`analyser`
        // CHƯA TỪNG được tạo -> BPM/Pitch/Energy đứng yên "---"/"0%" mãi mãi vì không có gì nuôi
        // analyser cả. Gọi Ở ĐÂY (mỗi lần phát video) để đảm bảo pipeline LUÔN sẵn sàng, bất kể đã
        // từng phát bài hát nào trước đó hay chưa.
        setupAudioContext(); // core/audio-engine.js

        playerTitle.textContent = record.filename || t('videoPlayer.untitled');
        playerArtist.textContent = t('videoPlayer.nowPlayingLabel');
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: record.filename || t('videoPlayer.untitled'),
                artist: t('videoPlayer.nowPlayingLabel'),
                artwork: [],
            });
        }

        audioPlayer.play().catch(() => {});
        bgVideoElement.play().catch(() => {});
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

    /** Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=true` — toggle CẢ 2 element
     * cùng lúc (khác `togglePlayPause()` core/player-controls.js — hàm đó CHỈ đụng audioPlayer,
     * không biết gì về bgVideoElement). KHÔNG xử lý AudioContext 'interrupted' riêng cho video (bản
     * đầu, đã báo Giang — nếu gặp bug tương tự bug cũ của Song sẽ vá tiếp sau). */
    togglePlayPauseVideo() {
        if (audioPlayer.paused) { audioPlayer.play().catch(() => {}); bgVideoElement.play().catch(() => {}); }
        else { audioPlayer.pause(); bgVideoElement.pause(); }
    },

    /** Ứng với 'playerControls.audio.ended' khi `isVideoPlayerMode=true` — video hết, tự chuyển
     * video kế tiếp (KHÔNG có repeatMode riêng cho video ở bản đầu — LUÔN tự next, quay vòng về
     * đầu danh sách khi hết). */
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
     * ĐANG hiện sẵn trong `#side-left-container` (`scrollLeft≈0` từ trước, xem chính docstring
     * `switchToVisualizer()` core/player-controls.js) — nhưng Video Player mode BẬT TỪ trang
     * SETTINGS (checkbox trong File Manager -> Video, panel đang mở SÂU trong đó), nên
     * `#side-left-container` vẫn đang cuộn Ở TRANG SETTINGS lúc gọi `switchToVisualizer()`. Nếu chỉ
     * gọi `handleBackToPlaylistClick()` gốc (chỉ ẩn Visualizer + hiện lại `#app-stack`, KHÔNG đụng
     * scroll), người dùng bấm "Quay lại Danh sách" sẽ thấy LẠI trang Settings/panel Video (SAI ý
     * nút), không phải Playlist — PHẢI tự cuộn thêm 1 bước bằng `scrollSideLeftToPlaylistSmooth()`
     * (core/player-controls.js, hàm CÓ SẴN, dùng lại NGUYÊN). KHÔNG dừng video/audio (giữ ĐÚNG hành
     * vi "quay lại Playlist không dừng nhạc" đã áp dụng cho Song). */
    handleBackToPlaylistFromVideoMode() {
        handleBackToPlaylistClick(); // core/player-controls.js — hành vi gốc (ẩn Visualizer, hiện lại #app-stack, KHÔNG dừng phát)
        scrollSideLeftToPlaylistSmooth(); // core/player-controls.js, hàm CÓ SẴN — tự cuộn về ĐÚNG trang Playlist
    },
};
