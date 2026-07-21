/**
 * event/workflow/video-player.js — "THẰNG THỰC THI CUỐI" của router "videoPlayer" (nút toggle) VÀ
 * được GỌI TỪ router "playerControls" (Next/Prev/Play-Pause/'ended' khi `isVideoPlayerMode=true` —
 * xem event/router/player-controls.js, VirtualMachineState branch theo cờ này).
 *
 * BẢN ĐẦU (21/07/2026, đã báo Giang là đơn giản hoá) — KHÔNG có shuffle/repeat/wake-lock/Media-
 * Session RIÊNG cho video (audioPlayer vẫn đang thật sự phát dù muted, nên các cơ chế đó của SONG
 * vẫn chạy nguyên, "ăn theo" miễn phí — xem handleAudioPlay()/handleAudioPause() core/player-
 * controls.js, KHÔNG bị đụng). Danh sách video phát TUẦN TỰ theo thứ tự thêm vào (cũ -> mới).
 *
 * NẠP SAU: core/video-player.js, core/file-manager/video.js (listVideos/sortVideosByAddedDateDesc),
 * service/db.js (getVideoRecord), core/state-and-video-bg.js (handleVideoBackground — tắt/khôi phục
 * Video nền lúc vào/ra mode).
 */
const workflowVideoPlayer = {
    _objectUrl: null, // object URL HIỆN TẠI đang gán cho CẢ audioPlayer LẪN bgVideoElement (revoke trước khi tạo url mới)
    _prevVideoBgEnabled: false, // nhớ lại vizConfig.videoBgEnabled TRƯỚC lúc vào mode, để khôi phục đúng lúc thoát
    _swipeStartY: null, // toạ độ Y lúc touchstart — dùng bởi event/listener/video-player.js (cử chỉ vuốt)

    /** Ứng với 'videoPlayer.toggle.click' — bật nếu đang tắt, tắt nếu đang bật. */
    toggleVideoPlayerMode() {
        if (appState.get('isVideoPlayerMode')) this.exitVideoPlayerMode();
        else this.enterVideoPlayerMode();
    },

    /** Vào Video Player mode: đọc danh sách video, tắt SẠCH Video nền trang trí (tránh 2 tính năng
     * cùng tranh chấp `bgVideoElement`), phát video đầu tiên trong danh sách. */
    async enterVideoPlayerMode() {
        const videos = await listVideos(); // core/file-manager/video.js
        if (videos.length === 0) { await alertModal(t('videoPlayer.empty')); return; }

        // Thứ tự phát: cũ -> mới (đảo ngược sortVideosByAddedDateDesc — hàm đó trả mới -> cũ).
        const videoPlaylist = sortVideosByAddedDateDesc(videos).reverse().map((v) => v.key); // core/file-manager/video.js

        // Tắt Video nền trang trí SẠCH (nếu đang bật) TRƯỚC khi Player mode chiếm bgVideoElement —
        // KHÔNG gọi saveConfig() (đây là chiếm dụng TẠM THỜI, không phải đổi lựa chọn thật của
        // người dùng) — cùng lý do event/workflow/file-manager-video.js không gọi saveConfig() khi
        // không cần thiết.
        this._prevVideoBgEnabled = appState.get('vizConfig').videoBgEnabled;
        if (this._prevVideoBgEnabled) {
            appState.mutate('vizConfig', (cfg) => { cfg.videoBgEnabled = false; });
            handleVideoBackground(); // core/state-and-video-bg.js, di sản — ẩn/pause bgVideoElement đúng cách
        }

        enterVideoPlayerModeState(videoPlaylist); // core/video-player.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop
        updateVideoPlayerToggleButtonUI(true); // core/video-player.js

        await this.playVideoByKey(videoPlaylist[0]);
    },

    /** Thoát Video Player mode: dừng + dọn 2 element, khôi phục Video nền trang trí về ĐÚNG trạng
     * thái trước lúc vào mode (không đổi lựa chọn thật của người dùng). */
    async exitVideoPlayerMode() {
        audioPlayer.pause();
        bgVideoElement.pause();
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, ẩn
        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }
        audioPlayer.removeAttribute('src');
        audioPlayer.load(); // buộc <audio> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)

        exitVideoPlayerModeState(); // core/video-player.js
        updateVideoPlayerToggleButtonUI(false); // core/video-player.js

        // Khôi phục Video nền trang trí (nếu trước đó đang bật) — vizConfig.videoBgUrl KHÔNG hề bị
        // đụng suốt lúc Player mode chạy, nên chỉ cần bật lại cờ + gọi lại handleVideoBackground().
        if (this._prevVideoBgEnabled) {
            appState.mutate('vizConfig', (cfg) => { cfg.videoBgEnabled = true; });
            handleVideoBackground(); // core/state-and-video-bg.js, di sản
        }
    },

    /** Nạp 1 video vào CẢ 2 element (audioPlayer muted nuôi analyser + bgVideoElement thật) + phát
     * ngay. Dùng CHUNG 1 object URL cho cả 2 (`URL.createObjectURL()` gán được cho nhiều element).
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
};
