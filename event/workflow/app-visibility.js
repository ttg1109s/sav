/**
 * event/workflow/app-visibility.js — Workflow cụm "appVisibility": ẩn tab / PWA (khoá máy, chuyển app/tab) thì chỉ để tiếng
 * Song phát nền và dừng render Visualizer (khi không chơi Game).
 *
 * Giữ tiếng nền (mọi gameplayPhase): `audioPlayer` đi qua Web Audio, ẩn app thì iOS chuyển AudioContext sang 'interrupted'
 * (câm) trong khi <audio> vẫn chạy. 2 lớp: (1) Audio Session 'playback' (applyPlaybackAudioSession(), core/audio-engine.js)
 * lúc boot + mỗi lần vào nền; (2) task keep-alive mỗi giây: Song đang phát mà AudioContext bị ngắt/treo -> resume().
 *
 * Chế độ nền tối giản (chỉ khi ẩn lúc gameplayPhase === 'idle' — Router rẽ): `isBackgroundSuspended = true`, tạm dừng 2 task
 * render Visualizer, VBG + auto-switch tự đứng yên theo cờ đó, Video/Photo Player đang phát thì tạm dừng (ghi nhớ để phát tiếp;
 * Playlist tự Next sang Video/Photo lúc ẩn cũng bị bắt ở nhịp keep-alive kế tiếp). Hiện lại -> đảo ngược đúng những gì đã dừng.
 * Không đụng: đồng hồ nghe, 'ended' -> Next, video nền App Panel (cụm theme tự lo).
 * Điều kiện phát nền gộp ở core thuần computeBackgroundPlaybackView() (core/app-visibility.js).
 *
 * NẠP SAU: core/app-visibility.js, core/audio-engine.js, core/media-element-ui.js, core/dom-refs.js, service/task-manager.js;
 * lúc chạy: event/workflow/{visualizer-render,visual-bg-common,photo-player,player-controls,wakelock,subtitle-display}.js.
 * NẠP TRƯỚC: event/router/app-visibility.js.
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
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — đồng hồ/mốc tự đổi hiệu ứng đứng yên
        this._enforcePlayerMediaPaused(this._readPlaybackView().view);
    },

    /** Ứng 'appVisibility.document.change' khi app hiện lại — tắt keep-alive, đánh thức AudioContext nếu cần, rồi
     * khôi phục đúng những gì chế độ nền đã tạm dừng (không vào chế độ nền -> chỉ phần audio). */
    exitBackground() {
        taskManager.kill(BACKGROUND_AUDIO_KEEPALIVE_TASK);
        this._lastLoggedContextState = '';
        const { state, view } = this._readPlaybackView();
        resumeAudioContextIfInterrupted(state.audioContext, view.shouldWakeContextOnShow); // core/audio-engine.js
        this._exitBackgroundSuspend(state.isBackgroundSuspended);
        this._reacquireWakeLockIfPlaying();
        workflowSubtitleDisplay.resync(); // event/workflow/subtitle-display.js — ẩn lâu: karaoke/hiệu ứng phụ đề về đúng vị trí đang phát
    },

    /** Trạng thái Player + kết luận phát nền (core thuần) đọc 1 lần. @returns {{state: object, view: object}} */
    _readPlaybackView() {
        const state = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'photoPlayerPaused', 'isBackgroundSuspended', 'audioContext']);
        const view = computeBackgroundPlaybackView({ // core/app-visibility.js
            isVideoPlayerMode: state.isVideoPlayerMode,
            isPhotoPlayerMode: state.isPhotoPlayerMode,
            photoPlayerPaused: state.photoPlayerPaused,
            isAudioPaused: audioPlayer.paused,
            isVideoPaused: bgVideoElement.paused,
            pausedVideoPlayer: this._pausedVideoPlayer,
            pausedPhotoPlayer: this._pausedPhotoPlayer,
        });
        return { state, view };
    },

    /** Khôi phục đúng những gì chế độ nền đã tạm dừng. @param {boolean} isBackgroundSuspended */
    _exitBackgroundSuspend(isBackgroundSuspended) {
        if (!isBackgroundSuspended) return; // guard: không vào chế độ nền (vd đang chơi Game)
        appState.set('isBackgroundSuspended', false);
        console.log(`writer: "workflowAppVisibility.exitBackground", page: "isBackgroundSuspended", content: "false"`);
        workflowVisualizerRender.resumeFromBackground(); // event/workflow/visualizer-render.js
        workflowVisualBg.onBackgroundSuspendChange(); // event/workflow/visual-bg-common.js — tự bỏ qua nếu đang Player mode
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — chạy tiếp nếu Song đang phát
        this._restorePlayerMedia();
    },

    /** Trình duyệt TỰ nhả Wake Lock khi app ẩn; hiện lại mà media vẫn đang phát (Song phát nền, hoặc Video/Photo vừa được
     * `_restorePlayerMedia()` phát tiếp) thì xin lại. Chạy SAU `_exitBackgroundSuspend()` để thấy đúng trạng thái đã phát tiếp. */
    _reacquireWakeLockIfPlaying() {
        if (!this._readPlaybackView().view.isAnyPlaying) return; // guard: không có gì đang phát
        workflowWakeLock.request(); // event/workflow/wakelock.js
        console.log('[workflowAppVisibility] (app hiện lại) media đang phát -> xin lại Wake Lock');
    },

    /** 1 nhịp keep-alive (mỗi giây lúc app ẩn): đánh thức AudioContext nếu Song đang phát mà bị ngắt; ở chế độ nền thì
     * giữ Video/Photo Player mode đứng yên (bắt cả ca playlist tự Next sang Video/Photo giữa lúc ẩn). */
    _keepAliveTick() {
        const { state, view } = this._readPlaybackView();
        const contextState = resumeAudioContextIfInterrupted(state.audioContext, view.isSongPlaying); // core/audio-engine.js
        this._logContextStateChange(contextState, view.isSongPlaying);
        if (state.isBackgroundSuspended) this._enforcePlayerMediaPaused(view);
    },

    /** Chỉ log khi trạng thái AudioContext ĐỔI. */
    _logContextStateChange(contextState, isSongPlaying) {
        if (contextState === this._lastLoggedContextState) return; // guard
        this._lastLoggedContextState = contextState;
        console.log(formatKeepAliveContextLog(contextState, isSongPlaying)); // core/app-visibility.js
    },

    /** Chế độ nền: CHỈ Song được phát — Video Player mode đang phát -> pause video (sự kiện 'pause' nguyên bản tự lo
     * icon/wake lock/listen clock/Motion); Photo Player mode đang chạy -> pause đồng hồ ảnh (đúng nút Play/Pause của Photo).
     * Ghi nhớ để `_restorePlayerMedia()` phát tiếp. @param {object} view - computeBackgroundPlaybackView() */
    _enforcePlayerMediaPaused(view) {
        this._pauseVideoPlayer(view.shouldPauseVideo);
        this._pausePhotoPlayer(view.shouldPausePhoto);
    },

    _pauseVideoPlayer(shouldPause) {
        if (!shouldPause) return; // guard
        this._pausedVideoPlayer = true;
        pauseMediaElement(bgVideoElement); // core/media-element-ui.js
        console.log('[workflowAppVisibility] (app ẩn) tạm dừng Video Player mode');
    },

    _pausePhotoPlayer(shouldPause) {
        if (!shouldPause) return; // guard
        this._pausedPhotoPlayer = true;
        workflowPhotoPlayer.togglePlayPausePhoto(); // event/workflow/photo-player.js
        console.log('[workflowAppVisibility] (app ẩn) tạm dừng Photo Player mode');
    },

    /** Ngược lại `_enforcePlayerMediaPaused()` — chỉ phát tiếp cái CHÍNH workflow này đã dừng, và chỉ khi vẫn còn ở đúng mode
     * đó + vẫn đang dừng. */
    _restorePlayerMedia() {
        const { view } = this._readPlaybackView();
        this._resumeVideoPlayer(view.shouldRestoreVideo);
        this._resumePhotoPlayer(view.shouldRestorePhoto);
        this._pausedVideoPlayer = false;
        this._pausedPhotoPlayer = false;
    },

    /** Phát tiếp qua `playAfterSeekGate()`: 'pause' lúc ẩn đã kích cổng xả hàng đợi (nạp lại nguồn) — cổng còn chạy thì để cổng
     * play() sau khi seek xong. */
    _resumeVideoPlayer(shouldResume) {
        if (!shouldResume) return; // guard
        workflowPlayerControls.playAfterSeekGate(bgVideoElement); // event/workflow/player-controls.js
    },

    _resumePhotoPlayer(shouldResume) {
        if (!shouldResume) return; // guard
        workflowPhotoPlayer.togglePlayPausePhoto(); // event/workflow/photo-player.js
    },
};
