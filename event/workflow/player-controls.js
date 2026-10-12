/**
 * event/workflow/player-controls.js — Workflow của router "playerControls".
 *
 * - Shuffle: `toggleShuffle()` (core, trả giá trị MỚI) rồi tính lại thứ tự (updateShuffleArrayFromQueue()) — 2 core nối
 *   tiếp có phụ thuộc thứ tự.
 * - `goToNextTrack()`/`goToPrevTrack()`, `handleMediaEnded()` (dùng chung 'audio.ended' lẫn 'video.ended'),
 *   `handlePlayPauseClick()` (chưa có gì đang tải -> phát bài đầu tiên).
 * - Cổng seek (`runGatedSeek()`): pause -> nạp lại nguồn -> seek -> mở tiếng -> play, chờ sự kiện qua
 *   event/workflow/media-wait.js.
 * - Sân khấu Visualizer khi ra/vào Playlist (`switchToVisualizer()`/`returnToPlaylistUI()`).
 * `getActiveMediaElement(isVideoPlayerMode)` (core/player-controls.js) dùng chung với `workflowGameplay`.
 *
 * NẠP SAU: core/player-controls.js, core/playlist/order.js, core/listen-stats.js, core/settings-panel-stack.js,
 * event/workflow/player.js (workflowPlayer.playMedia), event/workflow/media-wait.js (lúc chạy).
 * NẠP TRƯỚC: event/router/player-controls.js.
 */
// ===== Cổng seek — xem `workflowPlayerControls.runGatedSeek()` =====
const SEEK_GATE_SEEKED_TIMEOUT_MS = 3000; // đợi 'seeked'/'loadedmetadata' tối đa — phòng media không bao giờ xong (file lỗi) để không câm vĩnh viễn
const SEEK_GATE_UNMUTE_RAMP_SEC = 0.03;   // mở tiếng dần 30ms — tránh tiếng "tách"

/** Hook mặc định của cổng seek (Song không cần đóng băng hình). Video truyền hook của riêng nó
 * (workflowVideoPlayer.seekGateHooks()) — cổng KHÔNG biết gì về layer A/B (nguyên tắc tua vít). */
const SEEK_GATE_NO_HOOKS = {
    beforeReload: async () => {}, // trước `load()` — media còn khung hình/vị trí cũ
    afterSeek: () => {},          // seek xong, ngay TRƯỚC khi mở tiếng/play() — KHÔNG chờ gì (Video giao khung che cho 'playing')
    abort: () => {},              // cổng huỷ (media đổi giữa chừng) — dọn ngay mọi thứ hook đã dựng
};

/** Cổng xong: đồng bộ thanh/nhãn thời gian 1 lần theo vị trí MỚI ('timeupdate' lúc seek đã bị hold nuốt —
 * media đang dừng thì thanh đứng sai chỗ tới lần phát kế tiếp, vd cử chỉ seek-hold). Song thêm Media Session (nạp lại đã reset). */
const SEEK_GATE_DONE_SYNC_BY_MEDIA = {
    song: () => {
        updateMediaPositionState(); // core/player-controls.js
        workflowPlayerControls.handleAudioTimeUpdateEvent();
    },
    video: () => workflowVideoPlayer.handleVideoTimeUpdate(), // event/workflow/video-player.js
};

/** Lặp 1 bài (repeat-one, hết bài tự nhiên) — phát lại từ đầu theo loại media đang phát (readme/event-bus-flow.md mục 7).
 * Song/Video đi qua cổng seek (nạp lại nguồn = xoá hàng đợi tiếng của iOS — gán `currentTime = 0` trần thì lọt đuôi
 * tiếng cũ, phụ đề lệch dồn qua mỗi vòng). */
const REPEAT_ONE_RESTART_BY_MEDIA = {
    song: () => workflowPlayerControls._restartSongForRepeatOne(),
    video: () => workflowVideoPlayer.restartForRepeatOne(), // event/workflow/video-player.js
    // Photo: không có sự kiện 'play' DOM thật (photoPlayerFakeMediaElement.play() chỉ đổi cờ) nên PHẢI gọi
    // startListenClock() THẲNG — handleMediaEnded() vừa dừng đồng hồ ngay trước (xem goToNextTrack()); + chạy lại Point
    // Move từ đầu (event/workflow/photo-player.js).
    photo: (activeEl) => {
        activeEl.currentTime = 0;
        activeEl.play();
        workflowListenStats.startClock(); // event/workflow/listen-stats.js
        workflowPhotoPlayer.onClockRestarted();
    },
};

/** Đổi bài xong: bấm tay 1 dòng Playlist (switchScreen=true) -> sang Visualizer; Next/Prev/tự chuyển (false) -> chỉ cuộn
 * Playlist tới bài mới. Dùng chung cho player.js/video-player.js/photo-player.js. */
const TRACK_CHANGE_SCREEN_BY_SWITCH = {
    true: () => workflowPlayerControls.switchToVisualizer(),
    false: () => workflowPlaylistRender.scrollToCurrentOrDefer(), // event/workflow/playlist-render.js
};

// Sân khấu Visualizer khi ra/vào Playlist (tránh giật video/motion/visual khi vào lại) — xem
// switchToVisualizer()/returnToPlaylistUI()/_suspendVisualStage()/_revealEffectsWhenMediaReady().
const PLAYLIST_OFFSTAGE_TASK = 'playlistOffstageAfterSlide'; // hẹn đưa Playlist ra khỏi cây render sau khi trượt xong
const HIDE_VISUALIZER_UI_TASK = 'hideVisualizerUiAfterFade'; // hẹn ẩn UI + sân khấu Visualizer sau khi Playlist trượt vào xong
const SCREEN_SLIDE_MS = 500; // khớp transition transform 0.5s của #app-stack (assets/css/layout-nav.css)
const MEDIA_READY_TIMEOUT_TASK = 'visualizerMediaReadyTimeout';
const MEDIA_READY_TIMEOUT_MS = 6000; // lưới an toàn: media không bao giờ báo 'canplaythrough' -> vẫn hiện effect, ghi log

/** Đổi bố cục màn hình lúc đang chạy (xoay iPad/kéo cửa sổ qua mốc 1024px), key = bố cục xếp chồng. */
const SCREEN_LAYOUT_CHANGE_BY_STACKED = {
    true: () => workflowPlayerControls._applyStackedLayout(),
    false: () => workflowPlayerControls._applyDesktopLayout(),
};

/** Vừa chuyển sang bố cục xếp chồng — key = đang ở Visualizer (#app-stack có 'playlist-hidden'). */
const STACKED_LAYOUT_BY_ON_VISUALIZER = {
    true: () => setPlaylistOffstage(true), // core/player-controls.js — Playlist đang bị che: ra khỏi cây render
    false: () => workflowPlayerControls._suspendVisualStage(), // đang ở Playlist: dừng Visualizer + ẩn sân khấu
};

/** Phần tử media cần chờ 'canplaythrough' trước khi hiện lại effect, theo chế độ phát (object map, key = chế độ).
 * Photo Player mode: ảnh — chờ qua collectVisualStageImageUrls() (chung cho mọi chế độ). Song: audio + video nền VBG
 * nếu đang hiển thị (VBG ảnh cũng đi đường ảnh chung). */
const MEDIA_ELEMENTS_TO_WAIT_BY_MODE = {
    video: () => [bgVideoElement],
    photo: () => [],
    song: () => (isBgVideoShown() ? [audioPlayer, bgVideoElement] : [audioPlayer]), // core/player-controls.js
};

const workflowPlayerControls = {

    // ===== Sân khấu Visualizer khi ra/vào Playlist — state nội bộ (KHÔNG thuộc STATE) =====
    _mediaReadyToken: 0, // tăng mỗi lần vào Visualizer / về Playlist — lượt chờ media cũ thấy token lệch thì tự bỏ

    /** Trượt Playlist ra -> cuộn Playlist tới bài đang phát NGAY lúc nó vừa rời khung nhìn -> hiện UI Visualizer -> sân
     * khấu hình trở lại cây render -> effect chạy lại khi media nạp đủ. */
    switchToVisualizer() {
        // Vào lại Visualizer TRONG lúc Playlist còn đang trượt vào (<500ms) thì huỷ hẹn ẩn
        // của lượt về Playlist trước: không huỷ thì tới hẹn `hideVisualizerUiAfterFade()` vẫn gắn 'hidden' cho
        // #visualizer-ui/#player-container ngay khi người dùng đang ở Visualizer (mất nút + thanh điều khiển).
        taskManager.kill(HIDE_VISUALIZER_UI_TASK);
        slidePlaylistOut(); // core/player-controls.js
        workflowPlaylistRender.scrollToCurrentInstant(); // event/workflow/playlist-render.js
        showVisualizerUi(); // core/player-controls.js
        // (1) sân khấu hình trở lại cây render NGAY (video/ảnh hiện + nạp tiếp), (2) Playlist trượt ra xong thì ra khỏi
        // cây render, (3) effect (2 task Visualizer + fade-in canvas) CHỈ chạy lại khi media hiện tại nạp đủ
        // ('canplaythrough' / ảnh giải mã xong).
        this._resumeVisualStage();
        this._schedulePlaylistOffstage();
        const token = ++this._mediaReadyToken;
        taskManager.once(() => this._revealEffectsWhenMediaReady(token), 50, 'showVisualizerFadeIn'); // service/task-manager.js
    },

    /** Playlist trượt ra xong (SCREEN_SLIDE_MS) -> ra khỏi cây render. Bỏ qua nếu lúc tới hẹn
     * người dùng đã quay về Playlist, hoặc đang ở bố cục desktop (2 cột hiện song song). */
    _schedulePlaylistOffstage() {
        taskManager.once(() => {
            if (!appStack.classList.contains('playlist-hidden')) return; // guard — đã quay về Playlist
            if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
            setPlaylistOffstage(true); // core/player-controls.js
        }, SCREEN_SLIDE_MS, PLAYLIST_OFFSTAGE_TASK);
    },

    /** Chờ media hiện tại nạp đủ rồi mới chạy lại effect + fade-in canvas. Lượt chờ bị thay thế
     * (đổi màn tiếp/vào lại) thì tự bỏ. Lưới an toàn MEDIA_READY_TIMEOUT_MS: hết hạn vẫn hiện effect (ghi log lý do).
     * @param {number} token */
    async _revealEffectsWhenMediaReady(token) {
        const result = await Promise.race([
            this._waitCurrentMediaReady(),
            new Promise((resolve) => { taskManager.once(() => resolve('timeout'), MEDIA_READY_TIMEOUT_MS, MEDIA_READY_TIMEOUT_TASK); }),
        ]);
        if (token !== this._mediaReadyToken) return; // guard — đã có lượt đổi màn mới hơn
        taskManager.kill(MEDIA_READY_TIMEOUT_TASK);
        if (!appState.get('isVisualizerActive')) return; // guard — không còn ở Visualizer
        console.log(`[workflowPlayerControls] media hiện tại: ${result} -> hiện lại effect`); // log điều phối — không ghi appState
        workflowVisualizerRender.releasePlaylistHold(); // event/workflow/visualizer-render.js
        revealVisualizerCanvas(appConfigViz.getAll().type); // core/player-controls.js
    },

    /** Chờ MỌI media đang dùng trên sân khấu: phần tử audio/video theo chế độ phát
     * (MEDIA_ELEMENTS_TO_WAIT_BY_MODE) + mọi ảnh nền đang hiển thị. @returns {Promise<string>} tóm tắt kết quả cho log */
    async _waitCurrentMediaReady() {
        const mode = appState.get('isVideoPlayerMode') ? 'video' : (appState.get('isPhotoPlayerMode') ? 'photo' : 'song'); // chọn GIÁ TRỊ (key object map)
        const mediaWaits = MEDIA_ELEMENTS_TO_WAIT_BY_MODE[mode]().map((el) => waitMediaCanPlayThrough(el)); // core/player-controls.js
        const imageWaits = collectVisualStageImageUrls().map((url) => waitImageUrlDecoded(url)); // core/player-controls.js
        const results = await Promise.all([...mediaWaits, ...imageWaits]);
        return `${mode} [${results.join(', ') || 'không có media'}]`;
    },

    /** Lớp cha sân khấu hình trở lại cây render (gọi lặp vô hại). 2 task Visualizer KHÔNG chạy lại ở
     * đây — chờ `_revealEffectsWhenMediaReady()`. */
    _resumeVisualStage() {
        setVisualStageOffstage(false); // core/player-controls.js
    },

    /** Về Playlist: hold audioAnalysis + visualizerRender + ẩn lớp cha sân khấu (gồm #visualizer-ui, components/
     * app-mount.js) — gọi lúc Playlist đã trượt vào xong. Media (Song/Video/Photo) VẪN phát tiếng. Bỏ qua ở desktop (2 cột
     * hiện song song) hoặc nếu lúc tới hẹn người dùng đã vào lại Visualizer. */
    _suspendVisualStage() {
        if (appStack.classList.contains('playlist-hidden')) return; // guard — đã vào lại Visualizer trước khi tới hẹn
        if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
        workflowVisualizerRender.holdForPlaylist(); // event/workflow/visualizer-render.js
        setVisualStageOffstage(true); // core/player-controls.js
    },

    /** Quay về Visualizer nếu đang có bài. */
    returnToVisualizer() {
        if (!appState.get('currentKey')) return; // guard — chưa phát gì
        this.switchToVisualizer();
    },

    /** Bước tuỳ chọn cho luồng Song (event/workflow/player.js::playMedia() — sang Visualizer TRƯỚC khi refresh node, cuộn
     * Playlist (nhánh không chuyển màn) làm riêng SAU đó, nên không dùng chung showTrackChange()). @param {boolean} switchScreen */
    switchToVisualizerIfRequested(switchScreen) {
        if (!switchScreen) return; // guard
        this.switchToVisualizer();
    },

    /** Đổi bài xong — chọn màn theo `switchScreen` (xem TRACK_CHANGE_SCREEN_BY_SWITCH). @param {boolean} switchScreen */
    showTrackChange(switchScreen) {
        TRACK_CHANGE_SCREEN_BY_SWITCH[!!switchScreen]();
    },

    /** MỌI nơi "về Playlist" (nút Back, xoá bài/video đang là currentKey, xoá hàng loạt, Clear All). Thứ tự: cuộn
     * Playlist tới bài đang phát (lúc còn nằm ngoài khung nhìn) -> trượt/đổi class -> đóng Control Center ->
     * 500ms sau (khớp transition transform 0.5s, assets/css/style.css) ẩn hẳn UI Visualizer + diff lại danh sách.
     * KHÔNG đụng `isVisualizerActive` — nơi gọi tự `setVisualizerActiveFalse()` nếu cần. */
    returnToPlaylistUI() {
        // Huỷ hẹn ẩn Playlist + lượt chờ media đang dở, trả Playlist vào cây render TRƯỚC bước cuộn
        // (node phải có hộp để đo vị trí).
        taskManager.kill(PLAYLIST_OFFSTAGE_TASK);
        taskManager.kill(MEDIA_READY_TIMEOUT_TASK);
        this._mediaReadyToken++;
        setPlaylistOffstage(false); // core/player-controls.js
        workflowPlaylistRender.scrollToCurrentInstant(); // event/workflow/playlist-render.js
        slideBackToPlaylistUi(); // core/player-controls.js
        // UI còn hiện suốt lúc trượt ra -> chặn chạm trong lúc đó. Desktop: UI Visualizer vẫn hiện song song, không chặn. (chọn GIÁ TRỊ, không rẽ tiến trình)
        setVisualizerUiInert(isStackedScreenLayout()); // core/player-controls.js
        if (typeof closeControlCenter === 'function') closeControlCenter(); // core/visualizer-control-center.js — phòng panel còn mở sót
        // `_suspendVisualStage()` chạy ĐẦU TIÊN — `renderPlaylistDiff()` ném lỗi (taskManager nuốt lỗi của cả callback) thì
        // sân khấu vẫn ẩn + 2 task Visualizer vẫn dừng.
        taskManager.once(() => {
            this._suspendVisualStage(); // Playlist đã che kín: dừng Visualizer + ẩn sân khấu (gồm #visualizer-ui)
            hideVisualizerUiAfterFade(); // core/player-controls.js
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
        }, SCREEN_SLIDE_MS, HIDE_VISUALIZER_UI_TASK);
    },

    /** Boot (event/workflow/app-boot.js): app luôn mở ở Playlist -> đưa sân khấu Visualizer ra khỏi
     * cây render ngay từ đầu (bố cục xếp chồng), để "đang ở Playlist = sân khấu offstage" đúng cả trước lần vào
     * Visualizer đầu tiên. Chưa có task Visualizer nào lúc này (chỉ dựng khi phát lần đầu) nên không cần hold. */
    offstageVisualStageOnBoot() {
        if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
        setVisualStageOffstage(true); // core/player-controls.js
    },

    /** Ứng 'playerControls.screenLayout.change' (event/listener/player-controls.js): bố cục đổi qua mốc 1024px lúc đang
     * chạy (sang desktop lúc 2 task đang hold thì phải chạy lại, không thì Visualizer đứng hình). @param {boolean} isStacked */
    handleScreenLayoutChange(isStacked) {
        SCREEN_LAYOUT_CHANGE_BY_STACKED[isStacked === true]();
    },

    _applyStackedLayout() {
        STACKED_LAYOUT_BY_ON_VISUALIZER[appStack.classList.contains('playlist-hidden')](); // core/dom-refs.js
    },

    /** Desktop: Visualizer luôn hiện song song -> gỡ chặn chạm, chạy lại 2 task nếu đang hold, hiện canvas nếu đang có bài
     * (class offstage của Playlist/sân khấu không cần gỡ — CSS chỉ có hiệu lực <1024px). */
    _applyDesktopLayout() {
        setVisualizerUiInert(false); // core/player-controls.js
        workflowVisualizerRender.releasePlaylistHold(); // event/workflow/visualizer-render.js
        this._revealCanvasIfHasTrack();
    },

    _revealCanvasIfHasTrack() {
        if (!appState.get('currentKey')) return; // guard — chưa có bài, canvas để ẩn như lúc boot
        revealVisualizerCanvas(appConfigViz.getAll().type); // core/player-controls.js
    },

    /** Ứng với 'playerControls.backToPlaylist.click'. Video vẫn chạy theo nhạc; hình video/effect được ẩn khỏi cây render
     * + Visualizer dừng sau khi Playlist trượt vào xong (`returnToPlaylistUI()` -> `_suspendVisualStage()`),
     * tiếng vẫn phát. */
    handleBackToPlaylistClick() {
        this.returnToPlaylistUI();
        setVisualizerActiveFalse(); // core/player-controls.js
    },

    // ===== Cổng seek — state nội bộ (KHÔNG thuộc STATE) =====
    _seekGateToken: 0, // tăng mỗi lần `runGatedSeek()` — lệnh seek mới HƠN thay thế lệnh cũ (lệnh cũ tự bỏ dở, KHÔNG mở tiếng/không play() nữa)
    _seekGateHeldEl: null,  // media mà CỔNG tự pause/nạp lại và sẽ tự play() lại — sự kiện của nó bị bỏ qua, xem isHeldBySeekGate()
    _seekGateHeldSrc: '',   // currentSrc lúc cổng giữ — media đổi (Next/chọn bài) thì hold tự hết hiệu lực
    // Lệnh cổng đang chạy: Song/Video nạp lại nguồn nên
    // trong lúc chờ 'loadedmetadata' currentTime = 0, duration = NaN -> nơi khác đọc vị trí lúc đó sẽ ra 0. Xem getSeekGatePosition().
    _seekGateActiveEl: null,     // media có lệnh cổng đang chạy (null = không có)
    _seekGateTargetSec: 0,       // mốc của lệnh cổng đang chạy — vị trí "thật" trong lúc cổng chạy
    _seekGatePlayRequested: false, // nơi gọi xin play() SAU khi cổng xong (playAfterSeekGate()) — không play() giữa lúc nạp lại

    /**
     * Seek KHÔNG lọt âm thanh CŨ. Trên iOS tiếng cũ nằm trong 1 hàng đợi GIỮA trình phát và Web Audio
     * (createMediaElementSource): seek chỉ đổi vị trí, mute masterGain không chặn được, pause chỉ ĐÓNG BĂNG hàng đợi
     * (đã đo trên iPhone). Cách duy nhất xoá được là NẠP LẠI nguồn — `load()` (cùng blob URL) dựng lại trình phát nội bộ.
     * Trình tự: mute masterGain -> giữ (hold) + `load()` -> đợi 'loadedmetadata' -> gán currentTime -> đợi 'seeked' -> mở
     * tiếng dần -> play() nếu trước đó đang phát. Chờ sự kiện qua event/workflow/media-wait.js. Trong lúc giữ,
     * 'pause'/'play'/'timeupdate' do chính cổng gây ra bị bỏ qua (xem `isHeldBySeekGate()`); 'loadedmetadata' VẪN chạy
     * bình thường vì `load()` trả `playbackRate` về mặc định và handler đó áp lại đúng tốc độ phát.
     * Video: `load()` làm `<video>` mất khung tới khi seek xong -> nơi gọi truyền `hooks` đóng băng khung hiện tại (xem
     * SEEK_GATE_NO_HOOKS + workflowVideoPlayer.seekGateHooks()): chụp khung -> che -> nạp lại -> seek -> mở tiếng -> play()
     * NGAY; khung che giữ tới sự kiện 'playing' (bỏ che sớm theo readyState thì chớp đen).
     *
     * @param {HTMLMediaElement} mediaEl - audioPlayer (Song) hoặc bgVideoElement (Video)
     * @param {number} targetSec
     * @param {boolean} resumeAfter - true = `play()` sau seek dù cổng không tự giữ lúc đang phát (Video đã bị pause THẬT lúc
     *   kéo tay — 'play' khi đó được thả cho tới UI, xem `_releaseHoldForVisiblePlay()`)
     * @param {number|null} [verifyToleranceSec] - Video: sau 'seeked' đọc lại currentTime, lệch > mức này thì gán lại; null = không kiểm (Song)
     * @param {{beforeReload: () => Promise<void>, afterSeek: () => void, abort: () => void}|null} [hooks] - xem
     *   SEEK_GATE_NO_HOOKS. null = không hook (Song).
     * @returns {Promise<boolean>} true = cổng chạy TRỌN (đã seek + mở tiếng + thả hold); false = bị lệnh seek mới hơn tiếp
     *   quản / media đổi giữa chừng / play() lỗi.
     */
    async runGatedSeek(mediaEl, targetSec, resumeAfter, verifyToleranceSec = null, hooks = null) {
        const token = ++this._seekGateToken;
        const srcAtStart = mediaEl.currentSrc;
        const startMs = performance.now();
        const mediaKind = mediaEl === audioPlayer ? 'song' : 'video'; // chọn GIÁ TRỊ (key object map)
        const gateHooks = hooks || SEEK_GATE_NO_HOOKS;
        this._seekGateActiveEl = mediaEl;
        this._seekGateTargetSec = targetSec;
        this._setMasterGainForSeekGate(true);

        // Giữ media — LUÔN giữ (nạp lại làm 'timeupdate' về 0 + 'loadedmetadata' bắn lại cả lúc đang dừng). Lệnh trước (bị
        // thay giữa chừng) đã giữ sẵn -> hold còn hiệu lực, lệnh này kế thừa `_seekGateResume`.
        const wasPlaying = !mediaEl.paused || this.isHeldBySeekGate(mediaEl) && this._seekGateResume;
        if (!this.isHeldBySeekGate(mediaEl)) this._seekGateResume = !mediaEl.paused;
        this._seekGateHeldEl = mediaEl;
        this._seekGateHeldSrc = srcAtStart;
        if (!mediaEl.paused) mediaEl.pause();

        // Video: đóng băng khung hiện tại TRƯỚC khi nạp lại (no-op với Song).
        await gateHooks.beforeReload();
        if (token !== this._seekGateToken) return false; // lệnh seek mới hơn đã tiếp quản — nó tự lo phần còn lại
        if (mediaEl.currentSrc !== srcAtStart) { this._abortSeekGate(gateHooks); return false; } // media đã đổi (Next/chọn bài)

        // Nạp lại nguồn = xoá hàng đợi tiếng cũ của iOS.
        const metaPromise = this._waitMediaEvent(mediaEl, 'loadedmetadata');
        mediaEl.load();
        await metaPromise;
        if (token !== this._seekGateToken) return false;
        if (mediaEl.currentSrc !== srcAtStart) { this._abortSeekGate(gateHooks); return false; }

        // Seek — LUÔN gán, kể cả mốc 0 (sau `load()` currentTime đã = 0, nhưng gán vẫn chạy đủ thuật toán seek: 'seeked' +
        // tải khung — không thì video đang dừng không có khung nào). Video kiểm lại vị trí (tối đa 3 lần).
        const maxAttempts = verifyToleranceSec === null ? 1 : 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const seekedPromise = this._waitMediaEvent(mediaEl, 'seeked'); // đăng ký lượt chờ TRƯỚC khi gán currentTime
            mediaEl.currentTime = targetSec;
            await seekedPromise;
            if (token !== this._seekGateToken) return false;
            if (verifyToleranceSec === null || Math.abs(mediaEl.currentTime - targetSec) <= verifyToleranceSec) break;
        }
        if (token !== this._seekGateToken) return false;
        if (mediaEl.currentSrc !== srcAtStart) { this._abortSeekGate(gateHooks); return false; }

        // Video: giao khung đóng băng cho sự kiện 'playing' — không chờ gì ở đây (no-op với Song).
        gateHooks.afterSeek();

        // Mở tiếng TRƯỚC rồi mới play() (play() lúc trang không ra tiếng làm iOS bỏ Next/Prev ở màn hình khoá).
        this._setMasterGainForSeekGate(false);
        const heldByGate = this.isHeldBySeekGate(mediaEl);
        const resumeByGate = heldByGate && this._seekGateResume;
        const shouldPlay = resumeAfter || resumeByGate || this._seekGatePlayRequested;
        this._releaseHoldForVisiblePlay(mediaEl, heldByGate && resumeAfter && !resumeByGate);
        if (shouldPlay) {
            try {
                await mediaEl.play(); // promise xong SAU khi sự kiện 'play' đã qua listener -> hold còn nguyên lúc đó -> bị bỏ qua đúng ý
            } catch (err) {
                console.error('[workflowPlayerControls] runGatedSeek: play() lỗi sau seek:', err);
                this._clearSeekGateActive();
                if (this.isHeldBySeekGate(mediaEl)) { this._releaseSeekGateHold(mediaEl, true); return false; } // không phát lại được -> báo 'pause' THẬT cho UI
            }
            if (token !== this._seekGateToken) return false;
        }
        this._clearSeekGateActive();
        if (this.isHeldBySeekGate(mediaEl)) this._releaseSeekGateHold(mediaEl, false);
        // Bước đồng bộ thanh/nhãn/phụ đề CHỈ là hiển thị: bắt lỗi tại chỗ (vd phụ đề), cổng vẫn báo chạy trọn.
        try {
            SEEK_GATE_DONE_SYNC_BY_MEDIA[mediaKind]();
        } catch (err) {
            console.error('[workflowPlayerControls] runGatedSeek: đồng bộ hiển thị sau seek lỗi:', err);
        }
        console.log(`[seekGate] ${mediaKind} (nạp lại) ${wasPlaying ? 'đang phát' : 'đang dừng'} -> ${targetSec.toFixed(2)}s | tổng ${Math.round(performance.now() - startMs)}ms`);
        return true;
    },

    /** 'pause' trước đó là THẬT (Video: kéo thanh seek tự pause lúc chưa có cổng -> UI đã đổi sang dừng)
     * mà cổng sắp play() lại (`resumeAfter`) -> thả hold TRƯỚC để 'play' cũng THẬT tới UI (icon/đồng hồ nghe/Point Move).
     * Ngược lại (pause do cổng/cử chỉ tự gây ra, đã bị hold nuốt) thì giữ hold -> 'play' cũng bị nuốt, UI không nháy.
     * @param {HTMLMediaElement} mediaEl @param {boolean} isVisiblePlay */
    _releaseHoldForVisiblePlay(mediaEl, isVisiblePlay) {
        if (!isVisiblePlay) return; // guard
        this._releaseSeekGateHold(mediaEl, false);
    },

    /** Lặp 1 bài cho Song: cổng seek về 0 (nạp lại nguồn -> xoá hàng đợi tiếng cũ của iOS) và để CỔNG tự play()
     * (resumeAfter = true) ngay sau khi mở tiếng, trước bước đồng bộ hiển thị. 'pause' lúc 'ended' là THẬT nên cổng thả
     * hold trước khi play (`_releaseHoldForVisiblePlay()`) -> 'play' cũng THẬT tới UI (icon, đồng hồ nghe, VBG,
     * auto-switch). Người dùng seek/đổi bài giữa chừng -> lệnh mới tự lo. */
    _restartSongForRepeatOne() {
        this.runGatedSeek(audioPlayer, 0, true); // KHÔNG await — cổng tự phát lại
    },

    /** Sự kiện của `mediaEl` lúc này là do CỔNG tự pause/nạp lại/play tạm (Workflow bỏ qua: handleAudioPlayEvent/
     * handleAudioPauseEvent/handleAudioTimeUpdateEvent ở đây + workflowVideoPlayer.handleVideoPlayState/PauseState).
     * So thêm currentSrc — media đã đổi thì hold không còn hiệu lực. @param {HTMLMediaElement} mediaEl @returns {boolean} */
    isHeldBySeekGate(mediaEl) {
        return this._seekGateHeldEl === mediaEl && mediaEl.currentSrc === this._seekGateHeldSrc;
    },
    _seekGateResume: false, // media ĐANG PHÁT lúc cổng bắt đầu giữ -> cuối cổng play() lại

    /** Vị trí hiện tại của `mediaEl` cho nơi cần TÍNH mốc seek tiếp theo (cử chỉ seek-hold): đang có lệnh
     * cổng chạy trên media này -> trả mốc của lệnh đó (Song nạp lại nguồn, currentTime tạm = 0 tới khi seek xong); không có
     * -> currentTime thật. @param {HTMLMediaElement} mediaEl @returns {number} */
    getSeekGatePosition(mediaEl) {
        if (this._seekGateActiveEl === mediaEl) return this._seekGateTargetSec;
        return mediaEl.currentTime || 0;
    },

    /** Xin phát lại `mediaEl`: đang có lệnh cổng chạy trên nó -> để cổng play() SAU khi seek xong + mở
     * tiếng (play() giữa lúc Song nạp lại nguồn sẽ phát từ 0:00 rồi mới nhảy tới mốc, lọt tiếng đầu bài); không có -> play() ngay.
     * @param {HTMLMediaElement} mediaEl */
    playAfterSeekGate(mediaEl) {
        if (this._seekGateActiveEl === mediaEl) { this._seekGatePlayRequested = true; return; }
        mediaEl.play().catch((err) => console.error('[workflowPlayerControls] playAfterSeekGate: play() lỗi:', err));
    },

    /** Lệnh cổng đang chạy đã xong/huỷ hẳn — dọn mốc + lời xin play(). */
    _clearSeekGateActive() {
        this._seekGateActiveEl = null;
        this._seekGateTargetSec = 0;
        this._seekGatePlayRequested = false;
    },

    /** Bỏ hold. `notifyPaused` = true khi media vẫn đứng yên (play() lỗi) — gửi lại 'pause' THẬT để UI/đồng hồ đồng bộ đúng.
     * @param {HTMLMediaElement} mediaEl @param {boolean} notifyPaused */
    _releaseSeekGateHold(mediaEl, notifyPaused) {
        this._seekGateHeldEl = null;
        this._seekGateHeldSrc = '';
        this._seekGateResume = false;
        if (notifyPaused && mediaEl.paused) {
            eventBus.send({ router: 'playerControls', type: mediaEl === audioPlayer ? 'playerControls.audio.pause' : 'playerControls.video.pause', payload: {} });
        }
    },

    /** Media đổi giữa lúc cổng đang chạy — thả mọi thứ: bỏ hold (media mới tự lo play/pause của nó), dọn hook, mở tiếng ngay.
     * @param {object} [gateHooks] - hook của lệnh cổng đang huỷ (xem SEEK_GATE_NO_HOOKS) */
    _abortSeekGate(gateHooks = SEEK_GATE_NO_HOOKS) {
        gateHooks.abort(); // Video: bỏ khung đóng băng ngay
        this._clearSeekGateActive(); // media mới tự lo play/pause — bỏ luôn lời xin play() của media cũ
        this._seekGateHeldEl = null;
        this._seekGateHeldSrc = '';
        this._seekGateResume = false;
        this._setMasterGainForSeekGate(false);
    },

    /** Đợi 1 sự kiện 1 lần của `mediaEl` qua event/workflow/media-wait.js (kèm timeout an toàn — cùng 1 task tên cố định,
     * lệnh sau thay timeout lệnh trước).
     * @param {HTMLMediaElement} mediaEl @param {'seeked'|'loadedmetadata'} eventName @returns {Promise<void>} */
    _waitMediaEvent(mediaEl, eventName) {
        return workflowMediaWait.wait(mediaEl, eventName, SEEK_GATE_SEEKED_TIMEOUT_MS, 'seekGateEventTimeout').then(() => {}); // event/workflow/media-wait.js
    },

    /** Mute/mở tiếng `masterGainNode` cho cổng seek. Âm lượng người dùng nằm ở `volumeGainNode` (event/workflow/
     * audio-engine.js) nên master chỉ là CỔNG — mở tiếng về 1, mở dần 30ms. Chưa có audio graph -> no-op. @param {boolean} muted */
    _setMasterGainForSeekGate(muted) {
        const { masterGainNode, audioContext } = appState.get(['masterGainNode', 'audioContext']);
        if (!masterGainNode || !audioContext) return;
        const now = audioContext.currentTime;
        masterGainNode.gain.cancelScheduledValues(now);
        masterGainNode.gain.setValueAtTime(0, now);
        if (!muted) masterGainNode.gain.linearRampToValueAtTime(1, now + SEEK_GATE_UNMUTE_RAMP_SEC);
    },

    /** Ứng với 'playerControls.audio.timeupdate'. Lúc cổng seek đang nạp lại nguồn, currentTime tạm về 0 -> bỏ qua để
     * thanh/nhãn thời gian + phụ đề không nhảy về 0:00. */
    handleAudioTimeUpdateEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return;
        handleAudioTimeUpdate(); // core/player-controls.js
        // Đang kéo (tay hoặc cử chỉ seek-hold): phụ đề đang theo mốc kéo (handleSongSeeking), không kéo về giờ đang phát.
        if (appState.get('isSeeking')) return; // guard
        workflowSubtitleDisplay.sync(audioPlayer.currentTime); // event/workflow/subtitle-display.js
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi Song — hiển thị theo vị trí đang kéo (chưa commit), phụ đề theo luôn.
     * @param {string|number} value */
    handleSongSeeking(value) {
        handleProgressBarSeeking(value); // core/player-controls.js
        workflowSubtitleDisplay.sync(Number(value)); // event/workflow/subtitle-display.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi `isVideoPlayerMode=false` (Song) — thả tay/chạm chọn
     * điểm, commit vị trí + cổng seek (xem `runGatedSeek()`) — không gán `currentTime` trần (lọt âm thanh cũ). @param {string|number} value */
    handleSongSeekCommit(value) {
        appState.set('isSeeking', false);
        console.log(`writer: "workflowPlayerControls.handleSongSeekCommit", page: "isSeeking", content: "false"`);
        this.runGatedSeek(audioPlayer, Number(value), false); // KHÔNG await — 'seeked' cập nhật Media Session qua listener sẵn có
        updateMediaPositionState(); // core/player-controls.js — vị trí mới ngay như bản cũ; 'seeked' cập nhật lại khi seek xong
    },

    /**
     * Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=false` (xem
     * VirtualMachineState ở event/router/player-controls.js):
     *   1. `requestWakeLock()` — vô điều kiện (cả khi playlist rỗng).
     *   2. Guard `playlistOrder.length === 0`.
     *   3. `currentKey === null` -> `workflowPlayer.playMedia()` bài đầu tiên (`displayOrder[0] || playlistOrder[0]`).
     *   4. Ngược lại -> `togglePlayPause(audioContext)` (core).
     */
    handlePlayPauseClick() {
        requestWakeLock(); // core
        const { playlistOrder, currentKey, displayOrder, audioContext } = appState.get(['playlistOrder', 'currentKey', 'displayOrder', 'audioContext']);
        if (playlistOrder.length === 0) return;
        if (currentKey === null) {
            workflowPlayer.playMedia(displayOrder[0] || playlistOrder[0]); // event/workflow/player.js
            return;
        }
        togglePlayPause(audioContext); // core/player-controls.js
    },

    /**
     * Ứng với 'playerControls.next.click' (force=true, LUÔN — bấm nút Next là ý định người dùng
     * rõ ràng) và được TÁI DÙNG (Workflow gọi Workflow khác
     * miền, tự do) bởi: `handleSongEnded()` ngay dưới (force=false — hết bài tự động, tôn trọng
     * repeatMode), `event/workflow/video-player.js` (video hết/bị xoá giữa lúc phát — force=false/
     * true tuỳ tình huống, DÙNG CHUNG với Song), `event/workflow/gameplay.js::nextSong()`
     * (force=true — nút "Bài tiếp theo" trong Game Mode).
     * Core thuần (core/playlist/order.js): `computeListStep()` (tiến 1 bước, không quan tâm list shuffle hay tuần tự),
     * `decideBoundaryAction()` (tại biên làm gì theo repeatMode/force), `shouldRestartInsteadOfAdvance()` (lặp 1 bài).
     * Method này đọc state, chọn ĐÚNG list (shuffleIndices hay displayOrder) rồi quyết định phát bài nào.
     * @param {boolean} [force=false]
     */
    goToNextTrack(force = false) {
        requestWakeLock(); // core
        const { isVideoPlayerMode, isPhotoPlayerMode, repeatMode, isShuffle, currentKey, shuffleIndices, displayOrder, playlistOrder, pendingResortKeys } = appState.get([
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'repeatMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys',
        ]);
        if (playlistOrder.length === 0) return;
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js — DÙNG CHUNG Song/Video/Photo (Next/Prev + Game Mode)

        if (shouldRestartInsteadOfAdvance(repeatMode, force)) { // core/playlist/order.js — repeat-mode-2, KHÔNG force
            // Nhánh này CHỈ tới được từ `handleMediaEnded()` (hết tự nhiên) — đồng hồ nghe vừa bị dừng ngay trước. Song/Video
            // tự khởi động lại đồng hồ qua sự kiện 'play' THẬT; Photo gọi thẳng (xem REPEAT_ONE_RESTART_BY_MEDIA).
            const mediaKind = isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
            REPEAT_ONE_RESTART_BY_MEDIA[mediaKind](activeEl);
            return;
        }

        const list = isShuffle ? shuffleIndices : displayOrder; // NGUỒN danh sách
        const step = computeListStep(list, currentKey, 1); // core/playlist/order.js
        let nextKey;
        if (step.atBoundary) {
            const action = decideBoundaryAction(repeatMode, force); // core/playlist/order.js
            if (action === 'stopAtEnd') {
                // Tín hiệu "hết hẳn playlist" cho domain khác (vd visualBg). Rule 4: log ngay dưới set().
                appState.set('playbackStoppedAtPlaylistEnd', true);
                console.log(`writer: "workflowPlayerControls.goToNextTrack", page: "playbackStoppedAtPlaylistEnd", content: "true"`);
                activeEl.pause();
                return;
            }
            // wrapToStart — CHỈ nhánh tuần tự (KHÔNG shuffle) mới áp lại sort thật cho bài mới thêm giữa lúc nghe
            // (pendingResortKeys).
            if (!isShuffle && pendingResortKeys.size > 0) workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js — side-effect -> đọc lại displayOrder MỚI ngay dưới
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            nextKey = freshList[0];
        } else {
            nextKey = list[step.index];
        }
        workflowPlayer.playMedia(nextKey, { switchScreen: false, direction: 'next' }); // event/workflow/player.js — `direction`: Next/Prev dùng 2 preset Transition RIÊNG (core/player-display-settings.js::PLAYER_MOTION_SLOTS)
    },

    /**
     * Ứng với 'playerControls.prev.click'. CÙNG KHUÔN `goToNextTrack()` nhưng KHÔNG có `force`/`decideBoundaryAction()`/
     * `shouldRestartInsteadOfAdvance()` — Prev không có "dừng hẳn ở đầu playlist" hay "lặp 1 bài", LUÔN wrap khi chạm biên
     * đầu (bất đối xứng có chủ đích). Prev LUÔN sang bài trước (mọi đường gửi: nút, cử chỉ, Media Session); phát lại từ
     * đầu là icon riêng -> `restartCurrentTrack()`.
     */
    goToPrevTrack() {
        requestWakeLock(); // core
        const { isVideoPlayerMode, isPhotoPlayerMode, isShuffle, currentKey, shuffleIndices, displayOrder, playlistOrder, pendingResortKeys } = appState.get([
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys',
        ]);
        if (playlistOrder.length === 0) return;
        const list = isShuffle ? shuffleIndices : displayOrder;
        const step = computeListStep(list, currentKey, -1); // core/playlist/order.js
        let prevKey;
        if (step.atBoundary) {
            if (!isShuffle && pendingResortKeys.size > 0) workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js — CHỈ nhánh tuần tự
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            prevKey = freshList[freshList.length - 1];
        } else {
            prevKey = list[step.index];
        }
        workflowPlayer.playMedia(prevKey, { switchScreen: false, direction: 'prev' }); // event/workflow/player.js — `direction`, cùng lý do goToNextTrack()
    },

    /** Ứng với 'playerControls.restart.click' (icon "Phát lại" ở Control Center): phát lại nội dung ĐANG phát từ đầu, GIỮ
     * nguyên trạng thái phát/dừng. Song/Video đi qua cổng seek `runGatedSeek()` (không lọt tiếng/hình vị trí cũ); Photo tua
     * đồng hồ giả về 0 + chạy lại Point Move. Chưa có gì đang phát -> bỏ qua. */
    restartCurrentTrack() {
        const { isVideoPlayerMode, isPhotoPlayerMode, currentKey } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'currentKey']);
        if (!currentKey) return;
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js
        if (isPhotoPlayerMode) {
            activeEl.currentTime = 0;
            workflowPhotoPlayer.onClockRestarted(); // event/workflow/photo-player.js
            return;
        }
        this.runGatedSeek(activeEl, 0, false, isVideoPlayerMode ? VIDEO_SEEK_VERIFY_TOLERANCE_SEC : null); // VIDEO_SEEK_VERIFY_TOLERANCE_SEC — event/workflow/video-player.js
        if (!isVideoPlayerMode) updateMediaPositionState(); // core/player-controls.js — Media Session về 0 ngay như seek thường
    },

    /**
     * Ứng với CẢ 'playerControls.audio.ended' LẪN 'playerControls.video.ended' khi
     * `gameplayPhase==='idle'` (xem VirtualMachineState ở event/router/player-controls.js, 1 case
     * DÙNG CHUNG cho cả 2 msg.type — audio/video hết bài xử lý Y HỆT nhau, không có lý do tách 2
     * đường) — bài/video phát hết, dừng đếm giờ nghe rồi tự chuyển bài kế tiếp (không force, tôn
     * trọng repeatMode/wrap-around như Next thường).
     */
    handleMediaEnded() {
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js
        this.goToNextTrack(false); // Workflow gọi method khác trong CÙNG object — tự do
    },

    /** Ứng với 'playerControls.audio.play' — core cập nhật UI, rồi đồng hồ nghe, auto-switch, vẽ lại hàng đang phát,
     * đồng bộ Visual BG (đúng thứ tự). */
    handleAudioPlayEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // play() tạm của cổng seek, không phải người dùng phát lại
        handleAudioPlay(); // core/player-controls.js
        workflowListenStats.startClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — EQ bars "đang phát"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
    },

    /** Ứng với 'playerControls.audio.pause', đối xứng `handleAudioPlayEvent()` ngay trên. Cuối cùng xả hàng đợi tiếng iOS (`_flushSongQueueAfterPause()`), xem docblock method đó. */
    handleAudioPauseEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // pause() tạm của cổng seek, không đổi icon/đồng hồ/VBG
        handleAudioPause(); // core/player-controls.js
        releaseWakeLock(); // core/wakelock.js
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — chấm "đang pause"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
        this._flushSongQueueAfterPause();
    },

    /**
     * Xả hàng đợi tiếng lúc pause. iOS không xả hàng đợi tiếng (giữa <audio> và Web Audio) khi pause mà chỉ ĐÓNG BĂNG nó
     * -> resume phát phần đóng băng trước (nghe như dư âm), currentTime đi trước tiếng thật -> thanh/timer/phụ đề lệch dồn
     * qua mỗi lần pause. Xả NGAY lúc pause bằng đúng cơ chế cổng seek: nạp lại nguồn + seek về chỗ dừng (cổng giữ hold -> sự kiện tạm không lọt ra
     * UI). Mọi đường resume sau đó (nút trong app, cử chỉ, màn hình khoá, tai nghe, Control Center iOS) chỉ là play()
     * thường, không trễ. Pause bị loại trừ: xem shouldFlushSongQueueOnPause() (core/player-controls.js).
     */
    async _flushSongQueueAfterPause() {
        const { currentKey, currentObjectURL, isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['currentKey', 'currentObjectURL', 'isVideoPlayerMode', 'isPhotoPlayerMode']);
        const shouldFlush = shouldFlushSongQueueOnPause({ // core/player-controls.js
            isPaused: audioPlayer.paused, isEnded: audioPlayer.ended, isVideoPlayerMode, isPhotoPlayerMode,
            currentKey, currentObjectURL, mediaSrc: audioPlayer.src,
        });
        if (!shouldFlush) return;
        const completed = await this.runGatedSeek(audioPlayer, audioPlayer.currentTime, false);
        this._syncSongPlayAfterFlush(completed);
    },

    /** Người dùng bấm phát lại NGAY trong lúc cổng đang xả (vài chục-trăm ms): sự kiện 'play' thật đã bị hold nuốt -> cổng
     * xong mà media đang phát thì gửi lại 'play' cho UI/đồng hồ nghe/VBG đồng bộ. Cổng không chạy trọn (seek/đổi bài giữa
     * chừng) -> lệnh mới tự lo sự kiện của nó. */
    _syncSongPlayAfterFlush(completed) {
        if (!completed || audioPlayer.paused) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.play', payload: {} });
    },

    /** Ứng với 'playerControls.audio.loadedmetadata': core cập nhật thanh tiến trình/Media Session/tốc độ. */
    handleAudioLoadedMetadataEvent() {
        handleAudioLoadedMetadata(); // core/player-controls.js
    },

    /**
     * Ứng với 'playerControls.shuffle.click' — đảo Shuffle rồi random lại shuffleIndices dựa trên
     * "hiện hành" (displayOrder tại thời điểm bấm — có thể đang là 1 section vừa chọn-phát qua
     * playSelectedSongs(), event/workflow/playlist.js, KHÁC hẳn top-level playlistOrder). So sánh
     * với 2 nút to "Phát"/"Trộn bài" (event/workflow/playlist-empty-state.js) — 2 nút đó LUÔN ép về
     * top-level trước khi phát/trộn, còn Shuffle ở đây LUÔN tôn trọng hiện hành — 2 hành vi khác nhau CHỦ ĐÍCH.
     */
    toggleShuffleAndReshuffle() {
        const isShuffleCurrent = appState.get('isShuffle');
        const next = toggleShuffle(isShuffleCurrent); // core/player-controls.js — trả giá trị MỚI

        const activeQueueKeys = appState.get('displayOrder'); // "hiện hành" — section HOẶC top-level
        const topLevelKeys = appState.get('playlistOrder');
        updateShuffleArrayFromQueue(activeQueueKeys, topLevelKeys, next); // core/playlist/order.js
        this._persistPlayerConfig(); // nhớ trạng thái Shuffle
    },

    /**
     * Ứng với 'playerControls.repeat.click' — `cycleRepeatMode()` (core) rồi lưu bền (`_persistPlayerConfig()`) — ≥2 bước
     * nên giao cho Workflow (quy ước đầu event/router/player-controls.js).
     */
    cycleRepeatModeAndPersist() {
        cycleRepeatMode(); // core/player-controls.js
        this._persistPlayerConfig();
    },

    /**
     * Ghi bền Shuffle/Repeat/Stats-visible vào `appConfigPlayer` + `meta.playerConfig` (IndexedDB)
     * — CÙNG KHUÔN domain 'playlist' (`_persistPlaylistConfig()`, event/workflow/playlist.js) —
     * `setMeta()` trực tiếp mỗi lần đổi, KHÔNG debounce (tần suất đổi thấp, thao tác bấm tay/
     * checkbox). DÙNG CHUNG bởi `workflowVisualizerDisplay.setStatsPanelEnabled()` (Workflow gọi
     * Workflow miền khác, tự do) — tránh lặp logic ghi bền ở 2 nơi.
     */
    async _persistPlayerConfig() {
        appConfigPlayer.setAll({
            isShuffle: appState.get('isShuffle'),
            repeatMode: appState.get('repeatMode'),
            isStatsPanelVisible: appState.get('isStatsPanelVisible'),
        });
        await setMeta('playerConfig', appConfigPlayer.getAll());
    },

    /**
     * Khôi phục 2 icon toggle Control Center đã lưu bền LÚC BOOT (Shuffle/Repeat) — gọi từ
     * event/workflow/app-boot.js. Đồng bộ UI qua syncShuffleUI()/syncRepeatUI() (core/player-
     * controls.js — 2 hàm đó LUÔN "set thẳng", khác toggleShuffle()/cycleRepeatMode() luôn đảo
     * ngược giá trị hiện tại). Stats panel dùng chung domain config này (KHÔNG còn là icon Control
     * Center — checkbox trong Settings, xem event/workflow/visualizer-display.js), đồng bộ qua
     * setStatsPanelVisible() (core/visualizer-ui-visibility.js), cùng khuôn 2 icon kia.
     */
    async loadPersistedPlayerConfigOnBoot() {
        const saved = await getMeta('playerConfig');
        if (saved && typeof saved === 'object') {
            appConfigPlayer.mutateAll((cfg) => Object.assign(cfg, saved));
        }
        const cfg = appConfigPlayer.getAll();
        appState.set('isShuffle', !!cfg.isShuffle);
        appState.set('repeatMode', cfg.repeatMode || 0);
        console.log(`writer: "loadPersistedPlayerConfigOnBoot", page: "isShuffle/repeatMode/isStatsPanelVisible", content: "khôi phục từ meta.playerConfig"`);
        syncShuffleUI(appState.get('isShuffle')); // core/player-controls.js
        syncRepeatUI(appState.get('repeatMode')); // core/player-controls.js
        setStatsPanelVisible(cfg.isStatsPanelVisible !== false); // core/visualizer-ui-visibility.js
    },
};
