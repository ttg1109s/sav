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
 * Next/Prev/Phát lại rẽ theo loại media đang phát (`resolvePlayingMediaType()`); Photo đi thẳng đồng hồ của workflowPhotoPlayer.
 *
 * NẠP SAU: core/player-controls.js, core/playlist/{order,state,actions,render}.js, core/media-element-ui.js,
 * core/visualizer/visualizer-display.js (updateProgressBarCSS), core/visualizer-control-center.js (closeControlCenter),
 * core/listen-stats.js. Lúc chạy: event/workflow/{player,video-player,photo-player,media-wait}.js.
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

/** Sau mỗi lần chờ của cổng (resolveSeekGateStatus()) — trả true = dừng cổng. Media đổi giữa chừng: thả mọi thứ. */
const SEEK_GATE_INTERRUPT_BY_STATUS = {
    running: () => false,
    superseded: () => true, // lệnh seek mới hơn đã tiếp quản — nó tự lo phần còn lại
    mediaChanged: (gateHooks) => {
        workflowPlayerControls._abortSeekGate(gateHooks);
        return true;
    },
};

/** Kết quả play() cuối cổng — trả true = cổng chạy tiếp. Lỗi mà cổng còn giữ media: thả hold + báo 'pause' THẬT cho UI. */
const SEEK_GATE_AFTER_PLAY_BY_OK = {
    true: () => true,
    false: (mediaEl, err) => workflowPlayerControls._handleSeekGatePlayFailure(mediaEl, err),
};
const SEEK_GATE_PLAY_FAILURE_BY_HELD = {
    true: (mediaEl) => {
        workflowPlayerControls._releaseSeekGateHold(mediaEl, true);
        return false;
    },
    false: () => true,
};

/** Xin phát lại: đang có lệnh cổng trên media này -> để cổng play() sau khi seek xong; không -> play() ngay. */
const PLAY_AFTER_SEEK_GATE_BY_GATE_ACTIVE = {
    true: () => { workflowPlayerControls._seekGatePlayRequested = true; },
    false: (mediaEl) => playMediaElement(mediaEl, '[workflowPlayerControls] playAfterSeekGate:'), // core/media-element-ui.js
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
    // Photo: đồng hồ ảnh không có sự kiện 'play' — tua về 0, bật lại đồng hồ nghe THẲNG (handleMediaEnded() vừa dừng) + chạy
    // lại Point Move từ đầu (event/workflow/photo-player.js).
    photo: () => {
        workflowPhotoPlayer.seekClock(0);
        workflowPhotoPlayer.setPaused(false);
        workflowListenStats.startClock(); // event/workflow/listen-stats.js
        workflowPhotoPlayer.onClockRestarted();
    },
};

/** Next — việc theo kết quả `resolveNextTrackAction()` (core/playlist/order.js). `s` = state đã đọc, `stepKey` = bài kế (chỉ 'step'). */
const NEXT_TRACK_BY_ACTION = {
    restart: (s) => REPEAT_ONE_RESTART_BY_MEDIA[resolvePlayingMediaType(s.isVideoPlayerMode, s.isPhotoPlayerMode)](), // core/playlist/render.js
    stopAtEnd: (s) => workflowPlayerControls._stopAtPlaylistEnd(resolvePlayingMediaType(s.isVideoPlayerMode, s.isPhotoPlayerMode)),
    wrap: (s) => workflowPlayerControls._playWrapped(s, 1, 'next'),
    step: (s, stepKey) => workflowPlayer.playMedia(stepKey, { switchScreen: false, direction: 'next' }), // event/workflow/player.js
};

/** Prev — chạm biên đầu luôn wrap (không có "dừng ở đầu" hay "lặp 1 bài"), key = computeListStep().atBoundary. */
const PREV_TRACK_BY_BOUNDARY = {
    true: (s) => workflowPlayerControls._playWrapped(s, -1, 'prev'),
    false: (s, stepKey) => workflowPlayer.playMedia(stepKey, { switchScreen: false, direction: 'prev' }),
};

/** Danh sách để wrap tại biên (resolveWrapQueueMode()). 'resort': bài mới thêm giữa lúc nghe -> áp lại sort thật, lấy
 * displayOrder MỚI. */
const WRAP_QUEUE_BY_MODE = {
    shuffle: (s) => s.shuffleIndices,
    resort: () => workflowPlaylistOrder.recomputeDisplayOrder(), // event/workflow/playlist-order.js
    sequential: (s) => s.displayOrder,
};

/** Hết hẳn playlist (Next tự nhiên ở cuối, không lặp): dừng media đang phát — Photo dừng đồng hồ ảnh. */
const STOP_AT_END_PAUSE_BY_MEDIA = {
    song: () => pauseMediaElement(audioPlayer), // core/media-element-ui.js
    video: () => pauseMediaElement(bgVideoElement),
    photo: () => workflowPhotoPlayer.setPaused(true), // event/workflow/photo-player.js
};

/** Icon "Phát lại": nội dung đang phát về đầu, GIỮ trạng thái phát/dừng. Song/Video qua cổng seek (không lọt tiếng/hình cũ). */
const RESTART_TRACK_BY_MEDIA = {
    song: () => {
        workflowPlayerControls.runGatedSeek(audioPlayer, 0, false, null);
        updateMediaPositionState(); // core/player-controls.js — Media Session về 0 ngay như seek thường
    },
    video: () => workflowPlayerControls.runGatedSeek(bgVideoElement, 0, false, VIDEO_SEEK_VERIFY_TOLERANCE_SEC), // event/workflow/video-player.js
    photo: () => {
        workflowPhotoPlayer.seekClock(0); // event/workflow/photo-player.js
        workflowPhotoPlayer.onClockRestarted();
    },
};

/** Key appState Next/Prev cần (1 lần get([…])). */
const TRACK_STEP_STATE_KEYS = ['isVideoPlayerMode', 'isPhotoPlayerMode', 'repeatMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys'];

/** Nút Play/Pause (Song): chưa có gì đang tải -> phát bài đầu ("hiện hành" trước, top-level sau); có rồi -> play/pause. */
const PLAY_PAUSE_BY_HAS_CURRENT = {
    false: (s) => workflowPlayer.playMedia(s.displayOrder[0] || s.playlistOrder[0]), // event/workflow/player.js
    true: (s) => togglePlayPause(s.audioContext), // core/player-controls.js
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

/** Sự kiện kết thúc lượt chờ "media nạp đủ": đủ dữ liệu, hoặc lỗi/huỷ nạp/đổi nguồn (không treo). */
const MEDIA_PLAY_THROUGH_END_EVENTS = ['canplaythrough', 'error', 'abort', 'emptied'];

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
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        const mode = resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode); // core/playlist/render.js
        const mediaWaits = MEDIA_ELEMENTS_TO_WAIT_BY_MODE[mode]().map((el) => this._waitMediaCanPlayThrough(el));
        const imageWaits = collectVisualStageImageUrls().map((url) => waitImageUrlDecoded(url)); // core/player-controls.js
        const results = await Promise.all([...mediaWaits, ...imageWaits]);
        return `${mode} [${results.join(', ') || 'không có media'}]`;
    },

    /** Chờ 1 media tĩnh nạp đủ để phát liền mạch; lỗi/huỷ/đổi nguồn cũng kết thúc lượt chờ.
     * @param {HTMLMediaElement} mediaEl @returns {Promise<string>} 'ready' hoặc tên sự kiện kết thúc (cho log) */
    _waitMediaCanPlayThrough(mediaEl) {
        if (isMediaReadyToPlayThrough(mediaEl.readyState)) return Promise.resolve('ready'); // guard — core/player-controls.js
        return workflowMediaWait.waitFirst(mediaEl, MEDIA_PLAY_THROUGH_END_EVENTS); // event/workflow/media-wait.js
    },

    /** Lớp cha sân khấu hình trở lại cây render (gọi lặp vô hại). 2 task Visualizer KHÔNG chạy lại ở
     * đây — chờ `_revealEffectsWhenMediaReady()`. */
    _resumeVisualStage() {
        setVisualStageOffstage(false, false); // core/player-controls.js
    },

    /** Về Playlist: hold audioAnalysis + visualizerRender + ẩn lớp cha sân khấu (gồm #visualizer-ui, components/
     * app-mount.js) — gọi lúc Playlist đã trượt vào xong. Media (Song/Video/Photo) VẪN phát tiếng. Bỏ qua ở desktop (2 cột
     * hiện song song) hoặc nếu lúc tới hẹn người dùng đã vào lại Visualizer. */
    _suspendVisualStage() {
        if (appStack.classList.contains('playlist-hidden')) return; // guard — đã vào lại Visualizer trước khi tới hẹn
        if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
        workflowVisualizerRender.holdForPlaylist(); // event/workflow/visualizer-render.js
        setVisualStageOffstage(true, appState.get('isVideoPlayerMode')); // core/player-controls.js — Video Player: giữ <video> trong cây render
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
        closeControlCenter(); // core/visualizer-control-center.js — phòng panel còn mở sót
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
        setVisualStageOffstage(true, false); // core/player-controls.js
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
        pauseMediaElement(mediaEl); // core/media-element-ui.js

        // Video: đóng băng khung hiện tại TRƯỚC khi nạp lại (no-op với Song).
        await gateHooks.beforeReload();
        if (this._isSeekGateInterrupted(token, mediaEl, srcAtStart, gateHooks)) return false;

        // Nạp lại nguồn = xoá hàng đợi tiếng cũ của iOS.
        const metaPromise = this._waitMediaEvent(mediaEl, 'loadedmetadata');
        reloadMediaElement(mediaEl); // core/media-element-ui.js
        await metaPromise;
        if (this._isSeekGateInterrupted(token, mediaEl, srcAtStart, gateHooks)) return false;

        // Seek — LUÔN gán, kể cả mốc 0 (sau `load()` currentTime đã = 0, nhưng gán vẫn chạy đủ thuật toán seek: 'seeked' +
        // tải khung — không thì video đang dừng không có khung nào). Video kiểm lại vị trí (tối đa 3 lần).
        const maxAttempts = verifyToleranceSec === null ? 1 : 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const seekedPromise = this._waitMediaEvent(mediaEl, 'seeked'); // đăng ký lượt chờ TRƯỚC khi gán currentTime
            seekMediaElement(mediaEl, targetSec); // core/media-element-ui.js
            await seekedPromise;
            if (token !== this._seekGateToken) return false; // guard — lệnh seek mới hơn đã tiếp quản
            if (isSeekPositionSettled(mediaEl.currentTime, targetSec, verifyToleranceSec)) break; // core/player-controls.js
        }
        if (this._isSeekGateInterrupted(token, mediaEl, srcAtStart, gateHooks)) return false;

        // Video: giao khung đóng băng cho sự kiện 'playing' — không chờ gì ở đây (no-op với Song).
        gateHooks.afterSeek();

        // Mở tiếng TRƯỚC rồi mới play() (play() lúc trang không ra tiếng làm iOS bỏ Next/Prev ở màn hình khoá).
        this._setMasterGainForSeekGate(false);
        const resume = resolveSeekGateResume({ // core/player-controls.js
            resumeAfter, heldByGate: this.isHeldBySeekGate(mediaEl), gateResume: this._seekGateResume, playRequested: this._seekGatePlayRequested,
        });
        this._releaseHoldForVisiblePlay(mediaEl, resume.isVisiblePlay);
        if (!(await this._resumePlaybackAfterGate(mediaEl, token, resume.shouldPlay))) return false;
        this._clearSeekGateActive();
        if (this.isHeldBySeekGate(mediaEl)) this._releaseSeekGateHold(mediaEl, false);
        // Bước đồng bộ thanh/nhãn/phụ đề CHỈ là hiển thị: bắt lỗi tại chỗ (vd phụ đề), cổng vẫn báo chạy trọn.
        try {
            SEEK_GATE_DONE_SYNC_BY_MEDIA[mediaKind]();
        } catch (err) {
            console.error('[workflowPlayerControls] runGatedSeek: đồng bộ hiển thị sau seek lỗi:', err);
        }
        console.log(formatSeekGateLog(mediaKind, wasPlaying, targetSec, performance.now() - startMs)); // core/player-controls.js
        return true;
    },

    /** Sau 1 lần chờ: lệnh mới hơn đã tiếp quản, hoặc media đã đổi (thả mọi thứ) -> true = dừng cổng.
     * @param {number} token @param {HTMLMediaElement} mediaEl @param {string} srcAtStart @param {object} gateHooks @returns {boolean} */
    _isSeekGateInterrupted(token, mediaEl, srcAtStart, gateHooks) {
        const status = resolveSeekGateStatus(token, this._seekGateToken, mediaEl.currentSrc, srcAtStart); // core/player-controls.js
        return SEEK_GATE_INTERRUPT_BY_STATUS[status](gateHooks);
    },

    /** Bước play() cuối cổng (khi cần phát lại). Promise của play() xong SAU khi sự kiện 'play' đã qua listener -> hold còn
     * nguyên lúc đó -> 'play' tạm bị bỏ qua đúng ý. @returns {Promise<boolean>} false = cổng dừng ở đây */
    async _resumePlaybackAfterGate(mediaEl, token, shouldPlay) {
        if (!shouldPlay) return true; // guard — không cần phát lại
        const result = await playMediaElementAwaitable(mediaEl).then(() => ({ ok: true }), (err) => ({ ok: false, err })); // core/media-element-ui.js
        if (!SEEK_GATE_AFTER_PLAY_BY_OK[result.ok](mediaEl, result.err)) return false; // guard
        return token === this._seekGateToken;
    },

    /** play() cuối cổng lỗi: dọn mốc; cổng còn giữ media thì không phát lại được -> thả hold + báo 'pause' THẬT, dừng cổng.
     * @returns {boolean} true = cổng chạy tiếp */
    _handleSeekGatePlayFailure(mediaEl, err) {
        console.error('[workflowPlayerControls] runGatedSeek: play() lỗi sau seek:', err);
        this._clearSeekGateActive();
        return SEEK_GATE_PLAY_FAILURE_BY_HELD[this.isHeldBySeekGate(mediaEl)](mediaEl);
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
        PLAY_AFTER_SEEK_GATE_BY_GATE_ACTIVE[this._seekGateActiveEl === mediaEl](mediaEl);
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

    /** Mute/mở tiếng `masterGainNode` cho cổng seek (mở dần SEEK_GATE_UNMUTE_RAMP_SEC). Chưa có audio graph -> no-op.
     * @param {boolean} muted */
    _setMasterGainForSeekGate(muted) {
        const { masterGainNode, audioContext } = appState.get(['masterGainNode', 'audioContext']);
        if (!masterGainNode || !audioContext) return; // guard
        applySeekGateGain(masterGainNode, audioContext.currentTime, muted, SEEK_GATE_UNMUTE_RAMP_SEC); // core/player-controls.js
    },

    /** Ứng với 'playerControls.audio.timeupdate'. Lúc cổng seek đang nạp lại nguồn, currentTime tạm về 0 -> bỏ qua để
     * thanh/nhãn thời gian + phụ đề không nhảy về 0:00. */
    handleAudioTimeUpdateEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return;
        const isSeeking = appState.get('isSeeking');
        this._paintSongProgress(isSeeking);
        this._syncMediaPositionIfDue(Date.now());
        // Đang kéo (tay hoặc cử chỉ seek-hold): phụ đề đang theo mốc kéo (handleSongSeeking), không kéo về giờ đang phát.
        if (isSeeking) return; // guard
        workflowSubtitleDisplay.sync(audioPlayer.currentTime); // event/workflow/subtitle-display.js
    },

    /** Thanh tiến trình + nhãn giờ theo vị trí đang phát. Đang kéo thì không ghi đè — kể cả nhãn: cử chỉ seek-hold chỉ gửi
     * 'seeking' theo nhịp nên nhãn sẽ nhảy qua lại giữa giờ đang phát và mốc tua (cùng cách Video). @param {boolean} isSeeking */
    _paintSongProgress(isSeeking) {
        if (isSeeking) return; // guard
        const positionSec = audioPlayer.currentTime;
        setPlayerProgressUi(positionSec, formatTime(positionSec)); // core/player-controls.js + core/playlist/state.js
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    _lastMediaPositionSyncMs: 0, // lần gần nhất đồng bộ vị trí Media Session từ 'timeupdate'

    /** Đồng bộ vị trí Media Session thưa (mỗi MEDIA_POSITION_SYNC_INTERVAL_MS) thay vì mỗi 'timeupdate'. @param {number} nowMs */
    _syncMediaPositionIfDue(nowMs) {
        if (!isMediaPositionSyncDue(nowMs, this._lastMediaPositionSyncMs)) return; // guard — core/player-controls.js
        updateMediaPositionState(); // core/player-controls.js
        this._lastMediaPositionSyncMs = nowMs;
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi Song (kéo tay hoặc cử chỉ seek-hold) — cùng cơ chế Video
     * (workflowVideoPlayer.handleVideoSeeking()): nhịp ĐẦU của phiên kéo dừng bài + nhớ trạng thái phát, các nhịp sau chỉ hiển
     * thị mốc kéo (thanh/nhãn/phụ đề). Bài đứng yên suốt lúc kéo nên 'timeupdate' không kéo thanh về giờ đang phát; thả tay thì
     * cổng seek tự phát lại (handleSongSeekCommit()). @param {string|number} value */
    handleSongSeeking(value) {
        this._beginSongSeekSession(appState.get('isSeeking'));
        setSeekingPositionUi(formatTime(value)); // core/player-controls.js + core/playlist/state.js — ghi isSeeking = true cùng nhịp với pause ('pause' tới sau, không xả hàng đợi)
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
        workflowSubtitleDisplay.preview(Number(value)); // event/workflow/subtitle-display.js — phụ đề + karaoke theo mốc kéo
    },

    _songWasPlayingBeforeSeek: false, // bài đang phát lúc bắt đầu phiên kéo -> thả tay cổng seek phát lại

    /** Nhịp đầu phiên kéo: nhớ đang phát/dừng rồi dừng bài ('pause' THẬT tới UI như Video). @param {boolean} isSeeking */
    _beginSongSeekSession(isSeeking) {
        if (isSeeking) return; // guard — đang trong phiên kéo
        this._songWasPlayingBeforeSeek = !audioPlayer.paused;
        pauseMediaElement(audioPlayer); // core/media-element-ui.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi Song — thả tay/chạm chọn điểm: cổng seek (`runGatedSeek()`, không gán
     * `currentTime` trần — lọt âm thanh cũ), phát lại nếu lúc bắt đầu kéo đang phát. @param {string|number} value */
    handleSongSeekCommit(value) {
        const resumeAfter = this._songWasPlayingBeforeSeek;
        this._songWasPlayingBeforeSeek = false;
        appState.set('isSeeking', false);
        console.log(`writer: "workflowPlayerControls.handleSongSeekCommit", page: "isSeeking", content: "false"`);
        this.runGatedSeek(audioPlayer, Number(value), resumeAfter); // KHÔNG await — 'seeked' cập nhật Media Session qua listener sẵn có
        updateMediaPositionState(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.playPause.click' ở Song (router chọn theo loại media): xin wake lock (cả khi playlist rỗng),
     * chưa có bài đang tải -> phát bài đầu, có rồi -> play/pause. */
    handlePlayPauseClick() {
        workflowWakeLock.request();
        const s = appState.get(['playlistOrder', 'currentKey', 'displayOrder', 'audioContext']);
        if (s.playlistOrder.length === 0) return; // guard
        PLAY_PAUSE_BY_HAS_CURRENT[s.currentKey !== null](s);
    },

    /**
     * Ứng với 'playerControls.next.click' (force=true — bấm Next là ý định rõ ràng) và tái dùng bởi `handleMediaEnded()`
     * (force=false — hết bài tự nhiên, tôn trọng repeatMode), event/workflow/video-player.js, event/workflow/photo-player.js
     * (ảnh mất blob), event/workflow/gameplay.js (nút "Bài tiếp theo"). Chọn danh sách (shuffleIndices hay displayOrder), tính
     * bước (computeListStep()), việc cần làm theo resolveNextTrackAction() (core/playlist/order.js).
     * @param {boolean} [force=false]
     */
    goToNextTrack(force = false) {
        workflowWakeLock.request();
        const s = appState.get(TRACK_STEP_STATE_KEYS);
        if (s.playlistOrder.length === 0) return; // guard
        const list = s.isShuffle ? s.shuffleIndices : s.displayOrder; // NGUỒN danh sách
        const step = computeListStep(list, s.currentKey, 1); // core/playlist/order.js
        NEXT_TRACK_BY_ACTION[resolveNextTrackAction(s.repeatMode, force, step.atBoundary)](s, list[step.index]); // core/playlist/order.js
    },

    /**
     * Ứng với 'playerControls.prev.click'. Cùng khuôn `goToNextTrack()` nhưng không có force / lặp 1 bài / dừng ở đầu — LUÔN
     * wrap khi chạm biên đầu (bất đối xứng có chủ đích). Prev LUÔN sang bài trước (nút, cử chỉ, Media Session); phát lại từ
     * đầu là icon riêng -> `restartCurrentTrack()`.
     */
    goToPrevTrack() {
        workflowWakeLock.request();
        const s = appState.get(TRACK_STEP_STATE_KEYS);
        if (s.playlistOrder.length === 0) return; // guard
        const list = s.isShuffle ? s.shuffleIndices : s.displayOrder;
        const step = computeListStep(list, s.currentKey, -1); // core/playlist/order.js
        PREV_TRACK_BY_BOUNDARY[step.atBoundary](s, list[step.index]);
    },

    /** Chạm biên: phát bài đầu (Next) / cuối (Prev) của danh sách wrap. `direction`: Next/Prev dùng 2 preset Transition riêng
     * (core/player-display-settings.js::PLAYER_MOTION_SLOTS). @param {object} s @param {1|-1} step @param {'next'|'prev'} direction */
    _playWrapped(s, step, direction) {
        const queue = WRAP_QUEUE_BY_MODE[resolveWrapQueueMode(s.isShuffle, s.pendingResortKeys.size)](s); // core/playlist/order.js
        workflowPlayer.playMedia(resolveWrapKey(queue, step), { switchScreen: false, direction }); // core/playlist/order.js + event/workflow/player.js
    },

    /** Next tự nhiên ở cuối playlist, không lặp: báo "hết hẳn playlist" cho domain khác (vd visualBg) rồi dừng media.
     * @param {'song'|'video'|'photo'} mediaType */
    _stopAtPlaylistEnd(mediaType) {
        appState.set('playbackStoppedAtPlaylistEnd', true);
        console.log(`writer: "workflowPlayerControls._stopAtPlaylistEnd", page: "playbackStoppedAtPlaylistEnd", content: "true"`);
        STOP_AT_END_PAUSE_BY_MEDIA[mediaType]();
    },

    /** Ứng với 'playerControls.restart.click' (icon "Phát lại" ở Control Center) — xem RESTART_TRACK_BY_MEDIA. Chưa có gì
     * đang phát -> bỏ qua. */
    restartCurrentTrack() {
        const { isVideoPlayerMode, isPhotoPlayerMode, currentKey } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'currentKey']);
        if (!currentKey) return; // guard
        RESTART_TRACK_BY_MEDIA[resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode)](); // core/playlist/render.js
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
        clearPlaybackStoppedAtPlaylistEnd(); // core/player-controls.js
        setPlayerPlayingUi(true); // core/player-controls.js
        workflowListenStats.startClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — EQ bars "đang phát"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
        workflowSubtitleDisplay.sync(audioPlayer.currentTime); // event/workflow/subtitle-display.js — hiệu ứng phụ đề chạy tiếp ngay, không đợi 'timeupdate'
    },

    /** Ứng với 'playerControls.audio.pause', đối xứng `handleAudioPlayEvent()` ngay trên. Cuối cùng xả hàng đợi tiếng iOS (`_flushSongQueueAfterPause()`), xem docblock method đó. */
    handleAudioPauseEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // pause() tạm của cổng seek, không đổi icon/đồng hồ/VBG
        setPlayerPlayingUi(false); // core/player-controls.js
        workflowWakeLock.release();
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
        const { currentKey, currentObjectURL, isVideoPlayerMode, isPhotoPlayerMode, isSeeking } = appState.get(['currentKey', 'currentObjectURL', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'isSeeking']);
        const shouldFlush = shouldFlushSongQueueOnPause({ // core/player-controls.js
            isPaused: audioPlayer.paused, isEnded: audioPlayer.ended, isVideoPlayerMode, isPhotoPlayerMode, isSeeking,
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

    /** Ứng với 'playerControls.audio.loadedmetadata': tổng thời lượng lên thanh/nhãn, Media Session, áp lại tốc độ đã lưu
     * (`load()` của cổng seek / bài mới đưa playbackRate về mặc định). */
    handleAudioLoadedMetadataEvent() {
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        const durationSec = audioPlayer.duration;
        setPlayerDurationUi(durationSec, formatTime(durationSec)); // core/player-controls.js + core/playlist/state.js
        updateMediaPositionState(); // core/player-controls.js
        this.applySpeedToActiveMedia(isVideoPlayerMode, isPhotoPlayerMode, appConfigViz.getAll().playbackSpeed);
    },

    /** Áp tốc độ lên media đang active (Song/Video Player). Photo không có playbackRate (nút HUD Speed cũng ẩn) — bỏ qua.
     * Dùng chung: loadedmetadata của Song, chọn tốc độ ở HUD (event/workflow/hud.js).
     * @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode @param {number} speed */
    applySpeedToActiveMedia(isVideoPlayerMode, isPhotoPlayerMode, speed) {
        if (isPhotoPlayerMode) return; // guard
        applyPlaybackSpeed(getActiveMediaElement(isVideoPlayerMode), speed); // core/player-controls.js
    },

    /** Ứng với 'playerControls.audio.error' — lỗi giải mã THẬT (file hỏng dù qua được kiểm lúc nạp) -> modal lỗi. Chỉ khi
     * audio vẫn gắn đúng bài đang chọn: lỗi bắn trễ sau khi đã đổi sang bài khác thì bỏ qua. */
    handleAudioErrorEvent() {
        const { currentKey, currentObjectURL, playlistCache } = appState.get(['currentKey', 'currentObjectURL', 'playlistCache']);
        if (!currentKey || !currentObjectURL || audioPlayer.src !== currentObjectURL) return; // guard
        const cached = playlistCache.get(currentKey);
        handlePlaybackError(currentKey, cached ? cached.filename : currentKey); // core/playlist/actions.js
    },

    /**
     * Ứng với 'playerControls.shuffle.click' — đảo Shuffle rồi random lại shuffleIndices dựa trên
     * "hiện hành" (displayOrder tại thời điểm bấm — có thể đang là 1 section vừa chọn-phát qua
     * playSelectedSongs(), event/workflow/playlist.js, KHÁC hẳn top-level playlistOrder). So sánh
     * với 2 nút to "Phát"/"Trộn bài" (event/workflow/playlist-empty-state.js) — 2 nút đó LUÔN ép về
     * top-level trước khi phát/trộn, còn Shuffle ở đây LUÔN tôn trọng hiện hành — 2 hành vi khác nhau CHỦ ĐÍCH.
     */
    toggleShuffleAndReshuffle() {
        const { isShuffle, displayOrder, playlistOrder } = appState.get(['isShuffle', 'displayOrder', 'playlistOrder']);
        const next = toggleShuffle(isShuffle); // core/player-controls.js — trả giá trị MỚI
        syncShuffleUI(next); // core/player-controls.js
        updateShuffleArrayFromQueue(displayOrder, playlistOrder, next); // core/playlist/order.js — displayOrder = "hiện hành" (section HOẶC top-level)
        this._persistPlayerConfig(); // nhớ trạng thái Shuffle
    },

    /** Ứng với 'playerControls.repeat.click' — xoay vòng Repeat, đồng bộ nút, lưu bền. */
    cycleRepeatModeAndPersist() {
        const next = cycleRepeatMode(appState.get('repeatMode')); // core/player-controls.js
        syncRepeatUI(next); // core/player-controls.js
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
        const { isShuffle, repeatMode, isStatsPanelVisible } = appState.get(['isShuffle', 'repeatMode', 'isStatsPanelVisible']);
        appConfigPlayer.setAll({ isShuffle, repeatMode, isStatsPanelVisible });
        await setMeta('playerConfig', appConfigPlayer.getAll());
    },

    /**
     * Khôi phục 2 nút toggle Shuffle/Repeat (Bottom Player) đã lưu bền LÚC BOOT — gọi từ
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
        const isShuffle = !!cfg.isShuffle;
        const repeatMode = cfg.repeatMode || 0;
        appState.set('isShuffle', isShuffle);
        appState.set('repeatMode', repeatMode);
        console.log(`writer: "loadPersistedPlayerConfigOnBoot", page: "isShuffle/repeatMode", content: "khôi phục từ meta.playerConfig"`);
        syncShuffleUI(isShuffle); // core/player-controls.js
        syncRepeatUI(repeatMode); // core/player-controls.js
        setStatsPanelVisible(cfg.isStatsPanelVisible !== false); // core/visualizer-ui-visibility.js
    },
};
