/**
 * event/workflow/photo-player.js — "Photo Player mode": phát 1 ảnh làm nội dung chính trên màn
 * Visualizer, thừa hưởng ĐÚNG cơ chế Play/Next-Prev/Shuffle của Playlist (MỚI, Giang yêu cầu —
 * Photo tích hợp `duration` như Song/Video: "quy chế phát của nó cũng không khác biệt, chỉ khác
 * biệt duy nhất là photo không có duration"). Ảnh KHÔNG có audio — im lặng hoàn toàn lúc đang hiển
 * thị (audioPlayer/bgVideoElement đều pause), visualizer về trạng thái idle/tĩnh (xác nhận qua
 * trao đổi trực tiếp).
 *
 * Entry point DUY NHẤT vào mode: `startFromPlaylist(startKey)`, gọi từ `workflowPlayer.playMedia()`
 * (event/workflow/player.js) — mirror ĐÚNG khuôn `workflowVideoPlayer.startFromPlaylist()`
 * (event/workflow/video-player.js). KHÁC Video — KHÔNG có router/listener riêng: ảnh không có sự
 * kiện DOM thật (play/pause/timeupdate) để 1 listener lắng nghe, "đồng hồ" tự viết ngay trong
 * chính Workflow này (taskManager, mode 'timeout' tự lặp — CÙNG mẫu LISTEN_CLOCK/Slideshow, xem
 * core/player-controls.js/event/workflow/slideshow.js) gọi thẳng handler nội bộ, không cần round-
 * trip qua eventBus. `playMedia()` cũng gọi THẲNG `startFromPlaylist()`/`playPhotoByKey()` (Workflow
 * gọi Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B) — không cần Block Gate (event/
 * block.js) vì Photo KHÔNG cần khoá chéo với tính năng nào khác (khác Video — VBG dùng hẳn element
 * DOM riêng `#photo-player-image`, không tranh giành `#visual-bg-image`, xem assets/css/base.css).
 *
 * Vòng lặp taskManager CHẠY LIÊN TỤC suốt lúc `isPhotoPlayerMode=true` (KHÔNG kill lúc pause, CHỈ
 * kill lúc đổi ảnh/thoát mode) — mỗi tick tự đọc lại `photoPlayerPaused`, nên `getActiveMediaElement()`
 * (core/player-controls.js)'s `photoPlayerFakeMediaElement.play()/.pause()` (gọi từ Next/Prev repeat-
 * single/Game Mode, KHÔNG đi qua file này) vẫn được vòng lặp nhận lại đúng ở chu kỳ kế tiếp mà
 * KHÔNG cần chính object đó đụng gì tới taskManager (Rule 3 — core cấm dùng taskManager, xem docstring
 * core/photo-player.js).
 *
 * KHÔNG bắn `'gameplay.mediaChanged'` (khác Song/Video) — Game Mode "Circle" spawn theo beat/pitch/
 * energy PHÂN TÍCH TỪ AUDIO THẬT (core/audio-analysis.js) — ảnh im lặng hoàn toàn nên không có tín
 * hiệu gì để spawn, mở overlay Game Mode cho 1 track câm là vô nghĩa.
 *
 * NẠP SAU: core/photo-player.js, core/playlist/loader.js (đọc duration qua playlistCache), event/
 * workflow/player-controls.js (goToNextTrack/goToPrevTrack, requestWakeLock/releaseWakeLock/
 * stopListenClock).
 */
const PHOTO_PLAYER_TICK_TASK = 'photoPlayerTick';
const PHOTO_PLAYER_TICK_INTERVAL_MS = 200; // 5 lần/giây — đủ mượt cho progress bar, rẻ cho pin/CPU

const workflowPhotoPlayer = {

    _objectUrl: null,      // object URL của blob GỐC đang hiển thị — tự revoke lúc đổi ảnh/thoát mode
    _thumbObjectUrl: null, // object URL của thumbBlob (record-art tròn dưới player) — CÙNG vòng đời _objectUrl

    /** Vào Photo Player mode LẦN ĐẦU (từ Song/Video hoặc chưa phát gì) — mirror ĐÚNG khuôn
     * `workflowVideoPlayer.startFromPlaylist()`. Next/Prev VẬT LÝ trong lúc ĐÃ ở mode dùng
     * `playPhotoByKey()` thẳng (qua `workflowPlayer.playMedia()`, KHÔNG gọi lại hàm này — hàm này
     * CHỈ lo phần "vào mode": im lặng nguồn cũ + set state).
     * @param {string} startKey
     */
    async startFromPlaylist(startKey) {
        const previousKey = appState.get('currentKey');
        // Im lặng NGUỒN CŨ bất kể đang là Song hay Video — Giang chốt "im lặng hoàn toàn" lúc Photo
        // đang hiển thị, không phân biệt trước đó đang phát gì.
        if (!audioPlayer.paused) audioPlayer.pause(); // bắn 'pause' NGUYÊN BẢN -> handleAudioPause() (core/player-controls.js, KHÔNG đụng) tự lo icon/wake lock/Media Session cho Song
        if (!bgVideoElement.paused) bgVideoElement.pause();
        if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js — dọn HẲN bgVideoElement/state trước khi vào Photo mode
        if (previousKey !== null) {
            appState.set('currentKey', null);
            refreshSongNode(previousKey); // core/playlist/render.js — patch riêng đúng 1 hàng, xoá highlight "đang phát"
        }

        enterPhotoPlayerModeState(); // core/photo-player.js
        await this.playPhotoByKey(startKey); // switchScreen mặc định true — TỰ switchToVisualizer() bên trong
    },

    /** Thoát Photo Player mode: dừng đồng hồ, ẩn + dọn `#photo-player-image`, trả visualizer về
     * bình thường (canvas tự hiện lại — xem event/workflow/visualizer-render.js, guard
     * `isPhotoPlayerMode` trong `isVisualOff`). Mirror `workflowVideoPlayer.exitVideoPlayerMode()`.
     * Gọi bởi `workflowPlayer.playMedia()` NGAY TRƯỚC khi chuyển sang nhánh Song/Video (xem
     * docstring đầu file đó) — KHÔNG tự gọi `playMedia()` tiếp, chỉ dọn dẹp phần CỦA Photo mode. */
    exitPhotoPlayerMode() {
        taskManager.kill(PHOTO_PLAYER_TICK_TASK);
        setPhotoPlayerElementForMode(false); // core/photo-player.js — thêm lại .hidden, xoá background-image
        this._revokeObjectUrls();
        exitPhotoPlayerModeState(); // core/photo-player.js
        releaseWakeLock(); // core/player-controls.js — Photo không dùng startListenClock()/stopListenClock() (nghe ảnh không tính "thời gian nghe nhạc")
    },

    /** Đổi ảnh ĐANG hiển thị (vào mode lần đầu HOẶC Next/Prev vật lý trong lúc đã ở mode) — mirror
     * ĐÚNG khuôn `workflowVideoPlayer.playVideoByKey()`, đơn giản hơn nhiều (ảnh không cần chờ
     * "sự kiện sẵn sàng" như video — CSS background-image hiện gần như tức thời, không cần
     * `waitBgVideoReady()`-tương-đương).
     * @param {string} photoKey
     * @param {boolean} [switchScreen=true] - đổi màn hình/cuộn animated sau khi ảnh đã hiện — `true`
     *        (bấm 1 dòng trong Playlist/vào mode lần đầu); Next/Prev vật lý truyền `false` (khớp
     *        ĐÚNG cách `workflowPlayer.playMedia()` gọi cho Song/Video, event/workflow/player.js).
     */
    async playPhotoByKey(photoKey, switchScreen = true) {
        const record = await getImageRecord(photoKey); // service/db.js
        if (!record || !record.blob) {
            // guard: ảnh vừa bị xoá ở nơi khác giữa lúc đang phát — bỏ qua, tự next (CÙNG mẫu
            // `_skipToNextAfterShield` của Video, nhưng Photo không có withLoadingShield() bọc
            // ngoài nên gọi thẳng được luôn, không cần mang cờ ra ngoài).
            workflowPlayerControls.goToNextTrack(true);
            return;
        }

        const previousKey = appState.get('currentKey'); // đọc TRƯỚC khi ghi đè — refresh đúng dòng cũ sau khi ảnh mới sẵn sàng
        this._revokeObjectUrls();
        this._objectUrl = URL.createObjectURL(record.blob);
        this._thumbObjectUrl = URL.createObjectURL(record.thumbBlob || record.blob);

        appState.set('currentKey', photoKey);
        console.log(`writer: "playPhotoByKey", page: "currentKey", content: "${photoKey}"`);
        bumpSongPlayCount(photoKey); // core/listen-stats.js — mediaStatsMap key-agnostic, dùng thẳng được (CÙNG cách Video làm)

        const durationSec = record.duration || 5; // CÙNG fallback core/playlist/loader.js::buildPhotoPlaylistCache() cho record cũ thiếu field
        appState.set('photoPlayerDurationSec', durationSec, { skipCheck: true });
        appState.set('photoPlayerElapsedBeforePauseSec', 0, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
        appState.set('photoPlayerPaused', false, { skipCheck: true });

        const title = record.customName || stripFileExtension(record.filename) || t('photoPlayer.untitled');
        playerTitle.textContent = title;
        playerArtist.textContent = ''; // Adapter shape — Photo không có artist, KHỚP buildPhotoPlaylistCache() (core/playlist/loader.js)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({ title, artist: '', artwork: [] });
        }

        recordContainer.innerHTML = `<img id="record-art" src="${this._thumbObjectUrl}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 animate-spin-slow" alt="${title}"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;

        setPhotoPlayerElementForMode(true, this._objectUrl); // core/photo-player.js
        updatePhotoPlayerProgressUI(0, durationSec); // core/photo-player.js
        updatePhotoPlayerPlayPauseIcon(true); // core/photo-player.js

        requestWakeLock(); // core/player-controls.js — cùng khuôn goToNextTrack()/goToPrevTrack()/togglePlayPause() của Song

        if (previousKey && previousKey !== photoKey) refreshSongNode(previousKey); // core/playlist/render.js
        refreshSongNode(photoKey);
        if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); // core/dom-refs.js — hiện tray icon

        if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated(); // core/player-controls.js / core/playlist/render.js

        // Vòng lặp đồng hồ — kill task CŨ (nếu lỡ còn sót từ ảnh trước) rồi addNew() lại MỖI LẦN đổi
        // ảnh (KHÔNG dùng taskManager.resume() — mỗi ảnh là 1 "phiên" đếm MỚI, cùng lý do
        // startListenClock() làm vậy, xem core/player-controls.js).
        taskManager.kill(PHOTO_PLAYER_TICK_TASK);
        taskManager.addNew(PHOTO_PLAYER_TICK_TASK, { time: PHOTO_PLAYER_TICK_INTERVAL_MS, exe: () => this._photoPlayerTick(), mode: 'timeout', count: 0 });
        taskManager.operator(PHOTO_PLAYER_TICK_TASK, 'enabled');
    },

    /** Toggle Play/Pause — ứng với `mode==='photo'` trong VirtualMachineState của case
     * 'playerControls.playPause.click' (event/router/player-controls.js). CHỈ đổi cờ
     * `photoPlayerPaused` + icon — vòng lặp taskManager tự nhận lại ở tick kế tiếp (KHÔNG
     * start/stop task ở đây, xem docstring đầu file). */
    togglePlayPausePhoto() {
        const nowPaused = !appState.get('photoPlayerPaused');
        if (nowPaused) {
            // Chốt elapsed NGAY lúc pause — tránh tick tiếp theo (dù bị bỏ qua do cờ paused) tính
            // sai nếu lỡ đọc lại startedAtMs cũ.
            const { photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, photoPlayerPaused } = appState.get([
                'photoPlayerElapsedBeforePauseSec', 'photoPlayerStartedAtMs', 'photoPlayerPaused',
            ]);
            const frozenElapsed = computePhotoPlayerElapsedSec(photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, photoPlayerPaused, performance.now()); // core/photo-player.js
            appState.set('photoPlayerElapsedBeforePauseSec', frozenElapsed, { skipCheck: true });
        } else {
            appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
        }
        appState.set('photoPlayerPaused', nowPaused, { skipCheck: true });
        updatePhotoPlayerPlayPauseIcon(!nowPaused); // core/photo-player.js
    },

    /** Ứng với 'playerControls.progressBar.seeking' lúc `mode==='photo'` — kéo tay, CHƯA commit.
     * Mirror `handleProgressBarSeeking()` (core/player-controls.js).
     * @param {number} value */
    handlePhotoSeeking(value) {
        appState.set('isSeeking', true);
        currentTimeDisplay.textContent = formatTime(value); // core/playlist/state.js
        updateProgressBarCSS(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' lúc `mode==='photo'` — thả tay, commit vị
     * trí mới vào đồng hồ giả. Mirror `handleProgressBarSeekCommit()`.
     * @param {number} value */
    handlePhotoSeekCommit(value) {
        appState.set('photoPlayerElapsedBeforePauseSec', value, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
        appState.set('isSeeking', false);
    },

    /** Tick nội bộ (taskManager, mỗi PHOTO_PLAYER_TICK_INTERVAL_MS) — đọc đồng hồ giả, cập nhật
     * progress bar, tự bắn "hết ảnh" khi elapsed chạm duration. KHÔNG kill task khi paused — chỉ
     * no-op, giữ vòng lặp sống (xem docstring đầu file, lý do Rule 3). */
    _photoPlayerTick() {
        if (appState.get('photoPlayerPaused')) return;
        const { photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, photoPlayerDurationSec } = appState.get([
            'photoPlayerElapsedBeforePauseSec', 'photoPlayerStartedAtMs', 'photoPlayerDurationSec',
        ]);
        const elapsedSec = computePhotoPlayerElapsedSec(photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, false, performance.now()); // core/photo-player.js
        if (elapsedSec >= photoPlayerDurationSec) {
            // "Hết ảnh" — CÙNG msg.type router đã DÙNG CHUNG cho audio/video (event/router/
            // player-controls.js, case 'playerControls.audio.ended'/'video.ended') — tự branch
            // ĐÚNG theo gameplayPhase (idle -> auto next, khác idle -> hiện màn kết quả Game Mode),
            // KHÔNG viết logic riêng ở đây.
            eventBus.send({ router: 'playerControls', type: 'playerControls.photo.ended', payload: {} });
            return;
        }
        if (!appState.get('isSeeking')) updatePhotoPlayerProgressUI(elapsedSec, photoPlayerDurationSec); // core/photo-player.js
    },

    /** Dọn CẢ 2 object URL (blob gốc + thumb) — gọi TRƯỚC khi tạo cặp mới (đổi ảnh) hoặc lúc thoát
     * mode hẳn. Tách riêng vì gọi từ ≥2 chỗ (`playPhotoByKey()`/`exitPhotoPlayerMode()`). */
    _revokeObjectUrls() {
        if (this._objectUrl) { URL.revokeObjectURL(this._objectUrl); this._objectUrl = null; }
        if (this._thumbObjectUrl) { URL.revokeObjectURL(this._thumbObjectUrl); this._thumbObjectUrl = null; }
    },
};
