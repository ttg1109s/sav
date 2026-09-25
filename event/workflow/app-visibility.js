/**
 * event/workflow/app-visibility.js — Workflow cụm "appVisibility" (MỚI 25/09/2026, Giang yêu cầu): ẩn tab / ẩn PWA
 * (khoá máy, chuyển app, chuyển tab) thì CHỈ để audio của Song (`audioPlayer`) phát nền, đăng ký Audio Session,
 * tạm dừng mọi hoạt động render của Visualizer (khi KHÔNG chơi Game) — chỉ giữ hoạt động tối thiểu.
 *
 * LỖI GỐC được sửa: `audioPlayer` đi qua Web Audio (createMediaElementSource) -> tiếng thật phát ra từ AudioContext;
 * ẩn app thì iOS chuyển AudioContext sang 'interrupted' (câm) trong khi <audio> vẫn chạy (currentTime vẫn tăng); hết
 * bài -> Next -> playSong() -> setupAudioContext() gọi resume() nên bài mới mới có tiếng lại. Sửa bằng 2 lớp:
 *   (1) `applyPlaybackAudioSession()` (core/audio-engine.js) — khai báo session 'playback' (Audio Session API) NGAY lúc
 *       boot + mỗi lần vào nền, để iOS cho phát nền như app nhạc.
 *   (2) Lưới an toàn `BACKGROUND_AUDIO_KEEPALIVE_TASK` — suốt lúc app ẩn, mỗi giây kiểm tra: Song đang phát mà
 *       AudioContext bị ngắt/treo -> resume() (đúng thao tác Next vô tình "chữa" được, nay làm chủ động, không chờ hết
 *       bài). Task này chạy CẢ khi đang chơi Game (tiếng Song là việc chung).
 *
 * CHẾ ĐỘ NỀN TỐI GIẢN (chỉ khi ẩn lúc gameplayPhase === 'idle' — Router tự rẽ nhánh, xem event/router/app-visibility.js):
 *   - Ghi `isBackgroundSuspended = true` (service/state/wakelock-tab.js).
 *   - Tạm dừng 2 task render `audioAnalysis` + `visualizerRender` (workflowVisualizerRender.suspendForBackground()).
 *   - Visual Background đứng yên như lúc Song pause: video nền + âm thanh video nền, Motion, hẹn giờ đổi ảnh, Movement
 *     gradient (workflowVisualBg.onBackgroundSuspendChange() — VBG tự đọc cờ trên qua `_isSongActiveForVbg()`, nên
 *     đổi bài giữa lúc ẩn cũng không phát lại video nền).
 *   - Video/Photo Player mode (không phải Song) -> tạm dừng video/đồng hồ ảnh, ghi nhớ để hiện lại thì phát tiếp
 *     (`_pausedVideoPlayer`/`_pausedPhotoPlayer`). Playlist tự Next từ Song sang Video/Photo lúc đang ẩn cũng bị bắt ở
 *     tick keep-alive kế tiếp (`_enforcePlayerMediaPaused()`).
 *   Hiện lại -> đảo ngược đúng những gì ĐÃ tạm dừng.
 * KHÔNG đụng: đồng hồ đếm thời gian nghe (bài vẫn đang được nghe thật), sự kiện 'ended' -> Next (Song phải tự chuyển
 * bài được lúc ẩn), video nền màn App Panel (cụm theme đã tự dừng khi ẩn app).
 *
 * NẠP SAU: event/workflow/visualizer-render.js, event/workflow/visual-bg-common.js, event/workflow/photo-player.js
 * (chỉ tham chiếu lúc RUNTIME), core/audio-engine.js, service/task-manager.js, core/dom-refs.js (audioPlayer,
 * bgVideoElement). NẠP TRƯỚC: event/router/app-visibility.js.
 */
const BACKGROUND_AUDIO_KEEPALIVE_TASK = 'backgroundAudioKeepAlive';
const BACKGROUND_AUDIO_KEEPALIVE_MS = 1000;

const workflowAppVisibility = {
    _pausedVideoPlayer: false, // Video Player mode đang phát bị app-visibility tạm dừng lúc ẩn -> hiện lại phát tiếp
    _pausedPhotoPlayer: false, // tương tự cho đồng hồ Photo Player mode
    _lastLoggedContextState: '', // chỉ log khi trạng thái AudioContext ĐỔI (xem được trong Debug console)

    /** Gọi 1 lần lúc boot (event/workflow/app-boot.js) — đăng ký Audio Session TRƯỚC lần phát nhạc đầu tiên. */
    registerAudioSessionOnBoot() {
        applyPlaybackAudioSession(); // core/audio-engine.js
    },

    /** Ứng 'appVisibility.document.change' khi app ẩn (MỌI gameplayPhase) — Audio Session + bật lưới keep-alive. */
    startBackgroundAudioKeepAlive() {
        applyPlaybackAudioSession(); // core/audio-engine.js — idempotent
        this._keepAliveTick(); // kiểm tra ngay 1 lần, không chờ hết giây đầu
        taskManager.addNew(BACKGROUND_AUDIO_KEEPALIVE_TASK, { time: BACKGROUND_AUDIO_KEEPALIVE_MS, exe: () => this._keepAliveTick(), mode: 'timeout', count: 0 });
        taskManager.operator(BACKGROUND_AUDIO_KEEPALIVE_TASK, 'enabled');
    },

    /** Ứng 'appVisibility.document.change' khi app ẩn lúc gameplayPhase === 'idle' — vào chế độ nền tối giản. */
    enterBackgroundSuspend() {
        appState.set('isBackgroundSuspended', true);
        console.log(`writer: "workflowAppVisibility.enterBackgroundSuspend", page: "isBackgroundSuspended", content: "true"`);
        workflowVisualizerRender.suspendForBackground(); // event/workflow/visualizer-render.js
        workflowVisualBg.onBackgroundSuspendChange(); // event/workflow/visual-bg-common.js
        this._enforcePlayerMediaPaused();
    },

    /** Ứng 'appVisibility.document.change' khi app hiện lại — tắt keep-alive, đánh thức AudioContext nếu cần, rồi
     * khôi phục đúng những gì chế độ nền đã tạm dừng (không vào chế độ nền -> chỉ phần audio). */
    exitBackground() {
        taskManager.kill(BACKGROUND_AUDIO_KEEPALIVE_TASK);
        this._lastLoggedContextState = '';
        const resumingVideo = this._pausedVideoPlayer && appState.get('isVideoPlayerMode');
        resumeAudioContextIfInterrupted(appState.get('audioContext'), this._isAnyMediaPlaying() || resumingVideo); // core/audio-engine.js
        if (!appState.get('isBackgroundSuspended')) return;

        appState.set('isBackgroundSuspended', false);
        console.log(`writer: "workflowAppVisibility.exitBackground", page: "isBackgroundSuspended", content: "false"`);
        workflowVisualizerRender.resumeFromBackground(); // event/workflow/visualizer-render.js
        workflowVisualBg.onBackgroundSuspendChange(); // event/workflow/visual-bg-common.js — tự bỏ qua nếu đang Player mode
        this._restorePlayerMedia();
    },

    /** Media đang THẬT SỰ phát (Song, hoặc video của Video Player mode). */
    _isAnyMediaPlaying() {
        if (appState.get('isVideoPlayerMode')) return !bgVideoElement.paused;
        return !audioPlayer.paused;
    },

    /** 1 nhịp keep-alive (mỗi giây lúc app ẩn): đánh thức AudioContext nếu Song đang phát mà bị ngắt; ở chế độ nền thì
     * giữ Video/Photo Player mode đứng yên (bắt cả ca playlist tự Next sang Video/Photo giữa lúc ẩn). */
    _keepAliveTick() {
        const isSongPlaying = !appState.get('isVideoPlayerMode') && !appState.get('isPhotoPlayerMode') && !audioPlayer.paused;
        const state = resumeAudioContextIfInterrupted(appState.get('audioContext'), isSongPlaying); // core/audio-engine.js
        if (state !== this._lastLoggedContextState) {
            this._lastLoggedContextState = state;
            console.log(`[workflowAppVisibility] (app ẩn) AudioContext state="${state}", Song ${isSongPlaying ? 'đang phát' : 'không phát'}${isSongPlaying && state !== 'running' ? ' -> resume()' : ''}`);
        }
        if (appState.get('isBackgroundSuspended')) this._enforcePlayerMediaPaused();
    },

    /** Chế độ nền: CHỈ Song được phát — Video Player mode đang phát -> pause video (sự kiện 'pause' nguyên bản tự lo
     * icon/wake lock/listen clock/Motion); Photo Player mode đang chạy -> pause đồng hồ ảnh (dùng đúng nút Play/Pause
     * của Photo). Ghi nhớ để `_restorePlayerMedia()` phát tiếp. */
    _enforcePlayerMediaPaused() {
        if (appState.get('isVideoPlayerMode') && !bgVideoElement.paused) {
            this._pausedVideoPlayer = true;
            bgVideoElement.pause();
            console.log('[workflowAppVisibility] (app ẩn) tạm dừng Video Player mode');
        }
        if (appState.get('isPhotoPlayerMode') && !appState.get('photoPlayerPaused')) {
            this._pausedPhotoPlayer = true;
            workflowPhotoPlayer.togglePlayPausePhoto(); // event/workflow/photo-player.js
            console.log('[workflowAppVisibility] (app ẩn) tạm dừng Photo Player mode');
        }
    },

    /** Ngược lại `_enforcePlayerMediaPaused()` — chỉ phát tiếp cái CHÍNH workflow này đã dừng, và chỉ khi vẫn còn ở
     * đúng mode đó + vẫn đang dừng (người dùng không thể thao tác lúc ẩn, nhưng vẫn guard cho chắc). */
    _restorePlayerMedia() {
        if (this._pausedVideoPlayer && appState.get('isVideoPlayerMode') && bgVideoElement.paused) {
            bgVideoElement.play().catch((err) => console.warn('[workflowAppVisibility] phát tiếp video lỗi (bỏ qua):', err));
        }
        if (this._pausedPhotoPlayer && appState.get('isPhotoPlayerMode') && appState.get('photoPlayerPaused')) {
            workflowPhotoPlayer.togglePlayPausePhoto(); // event/workflow/photo-player.js
        }
        this._pausedVideoPlayer = false;
        this._pausedPhotoPlayer = false;
    },
};
