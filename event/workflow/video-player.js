/**
 * event/workflow/video-player.js — GỌI TỪ 2 nơi: (1) `workflowFileManagerVideo.
 * togglePlayerModeFromPanel()` — checkbox "Video Player mode" trong panel File Manager -> Video
 * (Batch 3 ban đầu đặt nút này ở header Visualizer — Giang yêu cầu 21/07/2026 dời hẳn sang đây,
 * xem lịch sử patch); (2) router "playerControls" (Next/Prev/Play-Pause/'ended' khi
 * `isVideoPlayerMode=true` — xem event/router/player-controls.js, VirtualMachineState branch theo
 * cờ này).
 *
 * KHOÁ CHÉO với Video nền trang trí (SỬA 21/07/2026 — Giang yêu cầu đổi "tự tắt hộ lẫn nhau" thành
 * "khoá cứng + báo lý do") — file NÀY KHÔNG còn tự đụng `vizConfig.videoBgEnabled`/
 * `handleVideoBackground()` nữa (khác Batch 3 gốc): nơi GỌI (`workflowFileManagerVideo`/
 * `workflowVisualizerControlCenter`) tự kiểm tra chéo TRƯỚC khi gọi `enterVideoPlayerMode()`/mở
 * picker Video nền — đảm bảo 2 tính năng KHÔNG BAO GIỜ cùng bật, nên file này không cần biết gì về
 * Video nền trang trí nữa (tách bạch hoàn toàn 2 domain, chỉ còn dùng chung `bgVideoElement`).
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

    /** Vào Video Player mode: đọc danh sách video, phát video đầu tiên. GỌI TỪ
     * `workflowFileManagerVideo.togglePlayerModeFromPanel()` (checkbox trong panel File Manager ->
     * Video) — nơi gọi ĐÃ tự đảm bảo Video nền trang trí đang TẮT trước khi gọi hàm này (khoá chéo
     * cứng, xem event/workflow/file-manager-video.js — KHÔNG còn silent auto-tắt/khôi phục
     * `vizConfig.videoBgEnabled` ở ĐÂY nữa như bản Batch 3 đầu tiên, Giang yêu cầu đổi "tự tắt hộ"
     * thành "khoá cứng + báo lý do" ở CẢ 2 nút, xem event/workflow/visualizer-control-center.js::
     * enableVideoBackgroundToggle()). */
    async enterVideoPlayerMode() {
        const videos = await listVideos(); // core/file-manager/video.js
        if (videos.length === 0) { await alertModal(t('videoPlayer.empty')); return; }

        // Thứ tự phát: cũ -> mới (đảo ngược sortVideosByAddedDateDesc — hàm đó trả mới -> cũ).
        const videoPlaylist = sortVideosByAddedDateDesc(videos).reverse().map((v) => v.key); // core/file-manager/video.js

        enterVideoPlayerModeState(videoPlaylist); // core/video-player.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện

        await this.playVideoByKey(videoPlaylist[0]);
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
