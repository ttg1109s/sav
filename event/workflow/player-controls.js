/**
 * event/workflow/player-controls.js — "THẰNG THỰC THI CUỐI" của router "playerControls".
 *
 * MỚI (fix 03/07/2026, mục 3b yêu cầu — "Nút shuffle trong Control Center phải chỉ random cho
 * playlist hiện hành"). File này TRƯỚC ĐÂY không tồn tại (comment cũ ở event/router/player-controls.js
 * ghi rõ "17 msg.type chỉ cần ĐÚNG 1 HÀM CORE, KHÔNG có workflow") — giờ CẦN vì
 * 'playerControls.shuffle.click' đã đổi hình dạng: toggleShuffle() (core/player-controls.js) giờ
 * đơn tuyến, chỉ đảo cờ + đồng bộ UI, trả về giá trị MỚI; bước "tính lại shuffleIndices theo hiện
 * hành" là 1 lời gọi core THỨ HAI (updateShuffleArrayFromQueue(), core/playlist/order.js) — 2 hàm
 * core nối tiếp, có phụ thuộc thứ tự (bước 2 cần giá trị isShuffle MỚI từ bước 1) -> đúng hình dạng
 * Workflow (event-bus-flow.md mục 4B), không còn "gọi thẳng core" 1 bước như 16 msg.type còn lại
 * của cụm này.
 *
 * MỚI (plan-playmedia-reorg.md) — 4 method THÊM: `goToNextTrack()`/`goToPrevTrack()` (thay
 * `playNext()`/`playPrev()` cũ, core/player-controls.js, ĐÃ XOÁ), `handleMediaEnded()` (thay
 * `handleAudioEnded()` cũ VÀ `workflowVideoPlayer.handleVideoPlayerEnded()` cũ, gộp 2 hàm trùng
 * thân thành 1, dùng chung cho cả 'audio.ended' lẫn 'video.ended'), `handlePlayPauseClick()` (tách
 * khỏi `togglePlayPause()` cũ — phần "chưa có gì đang tải -> phát bài đầu tiên"). Cả 4 đều đúng
 * hình dạng Workflow (đọc nhiều field appState RỒI gọi ≥1 Core/Workflow khác theo thứ tự phụ
 * thuộc) — xem docstring từng method.
 *
 * MỚI (Game Mode + Video Player mode, phản hồi Giang) — `getActiveMediaElement(isVideoPlayerMode)`
 * (core/player-controls.js) DÙNG CHUNG bởi `goToNextTrack()`/`goToPrevTrack()` ở đây VÀ
 * `workflowGameplay` (event/workflow/gameplay.js) — tránh 2 nơi tự viết lại ternary
 * `isVideoPlayerMode ? bgVideoElement : audioPlayer` riêng.
 *
 * NẠP SAU: core/player-controls.js (toggleShuffle, togglePlayPause, requestWakeLock,
 * scrollSideLeftToSettingsSmooth/scrollSideLeftToPlaylistSmooth/validateVideoBgOnClose — HOTFIX 8,
 * dọn lại HOTFIX 11), core/playlist/order.js (updateShuffleArrayFromQueue, computeListStep/
 * decideBoundaryAction/shouldRestartInsteadOfAdvance/recomputeDisplayOrder — MỚI), core/listen-
 * stats.js (stopListenClock), core/settings-panel-stack.js (resetSettingsStackToMain),
 * event/workflow/player.js (workflowPlayer.playMedia — MỚI, cần cho goToNextTrack/goToPrevTrack/
 * handlePlayPauseClick).
 * NẠP TRƯỚC: event/router/player-controls.js.
 */
// ===== Cổng seek (MỚI 21/09/2026, v2 25/09/2026, v3 25/09/2026) — xem `workflowPlayerControls.runGatedSeek()` =====
const SEEK_GATE_SEEKED_TIMEOUT_MS = 3000; // đợi 'seeked'/'loadedmetadata' tối đa — phòng media không bao giờ xong (file lỗi) để không câm vĩnh viễn
const SEEK_GATE_UNMUTE_RAMP_SEC = 0.03;   // mở tiếng dần 30ms — tránh tiếng "tách"

/** MỚI (07/10/2026) — hook mặc định của cổng seek (Song không cần đóng băng hình). Video truyền hook của riêng nó
 * (workflowVideoPlayer.seekGateHooks()) — cổng KHÔNG biết gì về layer A/B (nguyên tắc tua vít). */
const SEEK_GATE_NO_HOOKS = {
    beforeReload: async () => {}, // trước `load()` — media còn khung hình/vị trí cũ
    afterSeek: () => {},          // seek xong, ngay TRƯỚC khi mở tiếng/play() — SỬA 07/10/2026: KHÔNG chờ gì (Video giao khung che cho 'playing')
    abort: () => {},              // cổng huỷ (media đổi giữa chừng) — dọn ngay mọi thứ hook đã dựng
};

/** MỚI (07/10/2026) — cổng xong: đồng bộ thanh/nhãn thời gian 1 lần theo vị trí MỚI ('timeupdate' lúc seek đã bị hold nuốt —
 * media đang dừng thì thanh đứng sai chỗ tới lần phát kế tiếp, vd cử chỉ seek-hold). Song thêm Media Session (nạp lại đã reset). */
const SEEK_GATE_DONE_SYNC_BY_MEDIA = {
    song: () => {
        updateMediaPositionState(); // core/player-controls.js
        workflowPlayerControls.handleAudioTimeUpdateEvent();
    },
    video: () => workflowVideoPlayer.handleVideoTimeUpdate(), // event/workflow/video-player.js
};

/** Lặp 1 bài (repeat-one, hết bài tự nhiên) — phát lại từ đầu theo loại media đang phát (readme/event-bus-flow.md mục 7).
 * SỬA (29/09/2026, Giang báo: lặp 1 bài vẫn lọt ĐUÔI tiếng cũ, thanh tiến trình/timer vẫn chạy từ 0 -> tiếng lệch sau
 * currentTime, phụ đề lệch dồn qua mỗi vòng) — Song trước đây gán `currentTime = 0` TRẦN (bỏ qua cổng seek), hàng đợi
 * tiếng cũ của iOS không bị xoá nên vài giây cuối phát lại SAU khi currentTime đã về 0. Nay Song đi qua cổng seek
 * (`_restartSongForRepeatOne()`, nạp lại nguồn = xoá hàng đợi). Photo giữ nguyên hành vi cũ. SỬA 07/10/2026 — Video cũng qua cổng. */
const REPEAT_ONE_RESTART_BY_MEDIA = {
    song: () => workflowPlayerControls._restartSongForRepeatOne(),
    // SỬA (07/10/2026, Giang chốt) — Video cũng qua cổng seek v3 (cùng lỗi Song 29/09: gán currentTime=0 trần lọt đuôi tiếng cũ).
    video: () => workflowVideoPlayer.restartForRepeatOne(), // event/workflow/video-player.js
    // Photo: không có sự kiện 'play' DOM thật (photoPlayerFakeMediaElement.play() chỉ đổi cờ) nên PHẢI gọi
    // startListenClock() THẲNG — handleMediaEnded() vừa dừng đồng hồ ngay trước (xem goToNextTrack()). SỬA 25/09/2026:
    // + chạy lại Point Move từ đầu (event/workflow/photo-player.js).
    photo: (activeEl) => {
        activeEl.currentTime = 0;
        activeEl.play();
        workflowListenStats.startClock(); // event/workflow/listen-stats.js (SỬA 06/10/2026 — dời từ core)
        workflowPhotoPlayer.onClockRestarted();
    },
};

/** MỚI (02/10/2026, xử lý nợ 02/10/2026) — đổi bài xong: bấm tay 1 dòng Playlist (switchScreen=true) -> sang Visualizer;
 * Next/Prev/tự chuyển (false) -> chỉ cuộn Playlist tới bài mới. Trước đây mỗi player (player.js/video-player.js/
 * photo-player.js) tự viết `if (switchScreen) switchToVisualizer(); else ...scrollToCurrentOrDefer();`. */
const TRACK_CHANGE_SCREEN_BY_SWITCH = {
    true: () => workflowPlayerControls.switchToVisualizer(),
    false: () => workflowPlaylistRender.scrollToCurrentOrDefer(), // event/workflow/playlist-render.js
};

// MỚI (05/10/2026, Giang chốt hướng sửa "về Playlist rồi vào lại thì giật toàn bộ video/motion/visual") — xem
// switchToVisualizer()/returnToPlaylistUI()/_suspendVisualStage()/_revealEffectsWhenMediaReady().
const PLAYLIST_OFFSTAGE_TASK = 'playlistOffstageAfterSlide'; // hẹn đưa Playlist ra khỏi cây render sau khi trượt xong
const HIDE_VISUALIZER_UI_TASK = 'hideVisualizerUiAfterFade'; // hẹn ẩn UI + sân khấu Visualizer sau khi Playlist trượt vào xong
const SCREEN_SLIDE_MS = 500; // khớp transition transform 0.5s của #app-stack (assets/css/layout-nav.css)
const MEDIA_READY_TIMEOUT_TASK = 'visualizerMediaReadyTimeout';
const MEDIA_READY_TIMEOUT_MS = 6000; // lưới an toàn: media không bao giờ báo 'canplaythrough' -> vẫn hiện effect, ghi log

/** MỚI (05/10/2026) — đổi bố cục màn hình lúc đang chạy (xoay iPad/kéo cửa sổ qua mốc 1024px), key = bố cục xếp chồng. */
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

    /** DỜI (02/10/2026) từ core/player-controls.js::switchToVisualizer() — thứ tự giữ nguyên: trượt Playlist ra -> cuộn
     * Playlist tới bài đang phát NGAY lúc nó vừa rời khung nhìn (yêu cầu Giang 29/07/2026 "scroll tức thì cả 2 chiều")
     * -> hiện UI Visualizer -> 50ms sau fade-in canvas. */
    switchToVisualizer() {
        // MỚI (05/10/2026, sửa race) — vào lại Visualizer TRONG lúc Playlist còn đang trượt vào (<500ms) thì huỷ hẹn ẩn
        // của lượt về Playlist trước: không huỷ thì tới hẹn `hideVisualizerUiAfterFade()` vẫn gắn 'hidden' cho
        // #visualizer-ui/#player-container ngay khi người dùng đang ở Visualizer (mất nút + thanh điều khiển).
        taskManager.kill(HIDE_VISUALIZER_UI_TASK);
        slidePlaylistOut(); // core/player-controls.js
        workflowPlaylistRender.scrollToCurrentInstant(); // event/workflow/playlist-render.js
        showVisualizerUi(); // core/player-controls.js
        // SỬA (05/10/2026, Giang chốt) — (1) sân khấu hình trở lại cây render NGAY (video/ảnh hiện + nạp tiếp), (2)
        // Playlist trượt ra xong thì ra khỏi cây render, (3) effect (2 task Visualizer + fade-in canvas) CHỈ chạy lại khi
        // media hiện tại nạp đủ ('canplaythrough' / ảnh giải mã xong) — trước đây fade-in canvas cố định sau 50ms.
        // Ý "tạo 1 thao tác chạm giả" Giang đề xuất: KHÔNG làm được — sự kiện chạm do JS tạo (dispatchEvent) luôn
        // isTrusted=false, không đi qua hệ cử chỉ native của iOS.
        this._resumeVisualStage();
        this._schedulePlaylistOffstage();
        const token = ++this._mediaReadyToken;
        taskManager.once(() => this._revealEffectsWhenMediaReady(token), 50, 'showVisualizerFadeIn'); // service/task-manager.js
    },

    /** MỚI (05/10/2026) — Playlist trượt ra xong (SCREEN_SLIDE_MS) -> ra khỏi cây render. Bỏ qua nếu lúc tới hẹn
     * người dùng đã quay về Playlist, hoặc đang ở bố cục desktop (2 cột hiện song song). */
    _schedulePlaylistOffstage() {
        taskManager.once(() => {
            if (!appStack.classList.contains('playlist-hidden')) return; // guard — đã quay về Playlist
            if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
            setPlaylistOffstage(true); // core/player-controls.js
        }, SCREEN_SLIDE_MS, PLAYLIST_OFFSTAGE_TASK);
    },

    /** MỚI (05/10/2026) — chờ media hiện tại nạp đủ rồi mới chạy lại effect + fade-in canvas. Lượt chờ bị thay thế
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

    /** MỚI (05/10/2026) — chờ MỌI media đang dùng trên sân khấu: phần tử audio/video theo chế độ phát
     * (MEDIA_ELEMENTS_TO_WAIT_BY_MODE) + mọi ảnh nền đang hiển thị. @returns {Promise<string>} tóm tắt kết quả cho log */
    async _waitCurrentMediaReady() {
        const mode = appState.get('isVideoPlayerMode') ? 'video' : (appState.get('isPhotoPlayerMode') ? 'photo' : 'song'); // chọn GIÁ TRỊ (key object map)
        const mediaWaits = MEDIA_ELEMENTS_TO_WAIT_BY_MODE[mode]().map((el) => waitMediaCanPlayThrough(el)); // core/player-controls.js
        const imageWaits = collectVisualStageImageUrls().map((url) => waitImageUrlDecoded(url)); // core/player-controls.js
        const results = await Promise.all([...mediaWaits, ...imageWaits]);
        return `${mode} [${results.join(', ') || 'không có media'}]`;
    },

    /** MỚI (05/10/2026) — lớp cha sân khấu hình trở lại cây render (gọi lặp vô hại). 2 task Visualizer KHÔNG chạy lại ở
     * đây — chờ `_revealEffectsWhenMediaReady()`. */
    _resumeVisualStage() {
        setVisualStageOffstage(false); // core/player-controls.js
    },

    /** MỚI (05/10/2026, Giang chốt — "về Playlist -> pause audioAnalysis + visualizerRender + ẩn ở lớp cha
     * visualizer") — gọi lúc Playlist đã trượt vào xong. Từ 05/10/2026 (lượt 2) #visualizer-ui cũng nằm trong lớp cha
     * này (main.js) nên ẩn cùng. Media (Song/Video/Photo) VẪN phát tiếng. Bỏ qua ở desktop (2 cột
     * hiện song song) hoặc nếu lúc tới hẹn người dùng đã vào lại Visualizer. */
    _suspendVisualStage() {
        if (appStack.classList.contains('playlist-hidden')) return; // guard — đã vào lại Visualizer trước khi tới hẹn
        if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
        workflowVisualizerRender.holdForPlaylist(); // event/workflow/visualizer-render.js
        setVisualStageOffstage(true); // core/player-controls.js
    },

    /** DỜI (02/10/2026) từ core/visualizer-control-center.js::returnToVisualizer() — quay về Visualizer nếu đang có bài. */
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

    /** MỚI (24/09/2026, dọn nợ "taskManager trong core") — THAY core `forceBackToPlaylistUI()` cũ ở MỌI nơi "về
     * Playlist" (nút Back, xoá bài/video đang là currentKey, xoá hàng loạt, Clear All). Thứ tự giữ đúng bản cũ:
     * cuộn Playlist tới bài đang phát (lúc còn nằm ngoài khung nhìn) -> trượt/đổi class -> đóng Control Center ->
     * 500ms sau (khớp transition transform 0.5s, assets/css/style.css) ẩn hẳn UI Visualizer + diff lại danh sách.
     * KHÔNG đụng `isVisualizerActive` — nơi gọi tự `setVisualizerActiveFalse()` nếu cần (y như bản cũ). */
    returnToPlaylistUI() {
        // MỚI (05/10/2026) — huỷ hẹn ẩn Playlist + lượt chờ media đang dở, trả Playlist vào cây render TRƯỚC bước cuộn
        // (node phải có hộp để đo vị trí).
        taskManager.kill(PLAYLIST_OFFSTAGE_TASK);
        taskManager.kill(MEDIA_READY_TIMEOUT_TASK);
        this._mediaReadyToken++;
        setPlaylistOffstage(false); // core/player-controls.js
        workflowPlaylistRender.scrollToCurrentInstant(); // SỬA (02/10/2026) — bản đúng rule (core scrollToCurrentKeyInstant() tự appState.get())
        slideBackToPlaylistUi(); // core/player-controls.js
        // MỚI (05/10/2026) — UI giờ còn hiện suốt lúc trượt ra (không còn tắt opacity tức thì) -> chặn chạm trong lúc
        // đó. Desktop: UI Visualizer vẫn hiện song song, không chặn. (chọn GIÁ TRỊ, không rẽ tiến trình)
        setVisualizerUiInert(isStackedScreenLayout()); // core/player-controls.js
        if (typeof closeControlCenter === 'function') closeControlCenter(); // core/visualizer-control-center.js — phòng panel còn mở sót
        // SỬA (05/10/2026) — `_suspendVisualStage()` chạy ĐẦU TIÊN: trước đây đứng sau `renderPlaylistDiff()`, diff
        // ném lỗi (taskManager nuốt lỗi của cả callback) thì sân khấu không ẩn + 2 task Visualizer chạy tiếp ở Playlist.
        taskManager.once(() => {
            this._suspendVisualStage(); // Playlist đã che kín: dừng Visualizer + ẩn sân khấu (gồm #visualizer-ui)
            hideVisualizerUiAfterFade(); // core/player-controls.js
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
        }, SCREEN_SLIDE_MS, HIDE_VISUALIZER_UI_TASK);
    },

    /** MỚI (05/10/2026) — boot (event/workflow/app-boot.js): app luôn mở ở Playlist -> đưa sân khấu Visualizer ra khỏi
     * cây render ngay từ đầu (bố cục xếp chồng), để "đang ở Playlist = sân khấu offstage" đúng cả trước lần vào
     * Visualizer đầu tiên. Chưa có task Visualizer nào lúc này (chỉ dựng khi phát lần đầu) nên không cần hold. */
    offstageVisualStageOnBoot() {
        if (!isStackedScreenLayout()) return; // guard — desktop, core/player-controls.js
        setVisualStageOffstage(true); // core/player-controls.js
    },

    /** MỚI (05/10/2026) — ứng 'playerControls.screenLayout.change' (event/listener/player-controls.js): bố cục đổi qua
     * mốc 1024px lúc đang chạy. Trước đây: đang ở Playlist (2 task bị hold) mà chuyển sang desktop thì Visualizer hiện
     * lại nhưng đứng hình tới lần vào Visualizer kế tiếp. @param {boolean} isStacked */
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

    /** DỜI (24/09/2026) từ core/player-controls.js::handleBackToPlaylistClick() — ứng với
     * 'playerControls.backToPlaylist.click'. Video vẫn chạy theo nhạc. SỬA (05/10/2026) — hình video/effect giờ được ẩn
     * khỏi cây render + Visualizer dừng sau khi Playlist trượt vào xong (`returnToPlaylistUI()` -> `_suspendVisualStage()`),
     * tiếng vẫn phát. */
    handleBackToPlaylistClick() {
        this.returnToPlaylistUI();
        setVisualizerActiveFalse(); // core/player-controls.js
    },

    // ===== Cổng seek — state nội bộ (KHÔNG thuộc STATE) =====
    _seekGateToken: 0, // tăng mỗi lần `runGatedSeek()` — lệnh seek mới HƠN thay thế lệnh cũ (lệnh cũ tự bỏ dở, KHÔNG mở tiếng/không play() nữa)
    _seekGateHeldEl: null,  // media mà CỔNG tự pause/nạp lại và sẽ tự play() lại — sự kiện của nó bị bỏ qua, xem isHeldBySeekGate()
    _seekGateHeldSrc: '',   // currentSrc lúc cổng giữ — media đổi (Next/chọn bài) thì hold tự hết hiệu lực
    // MỚI (07/10/2026, sửa "cử chỉ seek tiến/lùi đều bị phát lại từ đầu") — lệnh cổng đang chạy: Song nạp lại nguồn nên
    // trong lúc chờ 'loadedmetadata' currentTime = 0, duration = NaN -> nơi khác đọc vị trí lúc đó sẽ ra 0. Xem getSeekGatePosition().
    _seekGateActiveEl: null,     // media có lệnh cổng đang chạy (null = không có)
    _seekGateTargetSec: 0,       // mốc của lệnh cổng đang chạy — vị trí "thật" trong lúc cổng chạy
    _seekGatePlayRequested: false, // nơi gọi xin play() SAU khi cổng xong (playAfterSeekGate()) — không play() giữa lúc nạp lại

    /**
     * [v3 — 25/09/2026] Seek KHÔNG lọt âm thanh CŨ. Lịch sử + số liệu đo trên máy thật (iPhone, log Debug console):
     *   - v1 (21/09): mute masterGain -> seek -> 'seeked' (~47ms) -> mở tiếng sau ~140ms. Gain=0 đúng lúc seek, vậy mà
     *     vẫn nghe tiếng cũ SAU khi mở -> tiếng cũ nằm trong 1 hàng đợi GIỮA trình phát iOS và Web Audio
     *     (createMediaElementSource), seek chỉ đổi vị trí phần tử, không xoá hàng đợi đó.
     *   - v2: pause rồi chờ analyser im lặng (đuôi cũ chảy hết) mới seek. Đo được "chờ đuôi" LUÔN ~150ms (analyser im gần
     *     như ngay khi pause) mà vẫn lọt tiếng cũ -> iOS KHÔNG xả hàng đợi khi pause, chỉ ĐÓNG BĂNG nó; play() lại thì
     *     phần cũ phát tiếp. Không đo/chờ nào xả được.
     *   - v3 (Song): XOÁ hàng đợi bằng cách NẠP LẠI nguồn — `load()` (cùng blob URL) dựng lại trình phát nội bộ của iOS,
     *     hàng đợi cũ bị bỏ cùng nó (cùng lý do đổi bài không lọt đuôi bài trước). Trình tự: mute masterGain -> giữ (hold)
     *     + `load()` -> đợi 'loadedmetadata' -> gán currentTime -> đợi 'seeked' -> mở tiếng dần -> play() nếu trước đó đang
     *     phát. Trong lúc giữ, 'pause'/'play'/'timeupdate' do chính cổng gây ra bị bỏ qua (không nháy icon/đồng hồ nghe/
     *     VBG/auto-switch, thanh thời gian không nhảy về 0:00 — xem `isHeldBySeekGate()`); 'loadedmetadata' VẪN chạy bình
     *     thường vì `load()` trả `playbackRate` về mặc định và handler đó áp lại đúng tốc độ phát.
     *   - v3 cho Video (MỚI 07/10/2026, Giang chốt "làm luôn, đóng băng khung hình hiện tại"): Video cũng nạp lại nguồn như
     *     Song, và cũng LUÔN giữ (trước đây chỉ giữ khi đang phát) — nạp lại làm 'timeupdate' về 0 + 'loadedmetadata' bắn lại
     *     dù đang dừng. `load()` làm `<video>` mất khung hình tới khi seek xong -> nơi gọi truyền `hooks` đóng băng khung
     *     hiện tại (xem SEEK_GATE_NO_HOOKS + workflowVideoPlayer.seekGateHooks()): chụp khung -> che -> nạp lại -> seek ->
     *     mở tiếng -> play() NGAY; khung che giữ tới sự kiện 'playing' (như swapBgVideoSource() — SỬA 07/10/2026, Giang báo
     *     chớp đen khi bỏ che sớm theo readyState).
     * Bỏ hẳn phần ngắt nhánh ra loa + đo analyser của v2 (không còn tác dụng) — core/audio-engine.js xoá 2 hàm tương ứng.
     *
     * @param {HTMLMediaElement} mediaEl - audioPlayer (Song) hoặc bgVideoElement (Video)
     * @param {number} targetSec
     * @param {boolean} resumeAfter - true = `play()` sau seek dù cổng không tự giữ lúc đang phát (Video đã bị pause THẬT lúc
     *   kéo tay — 'play' khi đó được thả cho tới UI, xem `_releaseHoldForVisiblePlay()`)
     * @param {number|null} [verifyToleranceSec] - Video: sau 'seeked' đọc lại currentTime, lệch > mức này thì gán lại; null = không kiểm (Song)
     * @param {{beforeReload: () => Promise<void>, afterSeek: () => void, abort: () => void}|null} [hooks] - MỚI
     *   07/10/2026, xem SEEK_GATE_NO_HOOKS. null = không hook (Song).
     * @returns {Promise<boolean>} MỚI (29/09/2026) — true = cổng chạy TRỌN (đã seek + mở tiếng + thả hold); false = bị lệnh seek
     *   mới hơn tiếp quản / media đổi giữa chừng / play() lỗi. Nơi gọi cũ không await — không ảnh hưởng.
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

        // Giữ media — LUÔN giữ (SỬA 07/10/2026: Video cũng nạp lại nên giữ cả lúc đang dừng, như Song). Lệnh cũ (bị thay giữa
        // chừng) đã giữ sẵn -> hold còn hiệu lực, lệnh này kế thừa `_seekGateResume`.
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

        // Seek. SỬA (07/10/2026) — LUÔN gán (bỏ điều kiện "lệch mốc" cũ): sau `load()` currentTime = 0 nên mốc 0 (lặp 1 bài) trước
        // đây bị bỏ qua -> video đang dừng không được tải khung nào (khung che phải đợi hết hạn). Gán currentTime = 0 vẫn chạy
        // đủ thuật toán seek ('seeked' + tải khung). Video kiểm lại vị trí (tối đa 3 lần).
        const maxAttempts = verifyToleranceSec === null ? 1 : 3;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const seekedPromise = this._waitMediaEvent(mediaEl, 'seeked'); // đăng ký listener TRƯỚC khi gán currentTime
            mediaEl.currentTime = targetSec;
            await seekedPromise;
            if (token !== this._seekGateToken) return false;
            if (verifyToleranceSec === null || Math.abs(mediaEl.currentTime - targetSec) <= verifyToleranceSec) break;
        }
        if (token !== this._seekGateToken) return false;
        if (mediaEl.currentSrc !== srcAtStart) { this._abortSeekGate(gateHooks); return false; }

        // Video: giao khung đóng băng cho sự kiện 'playing' — không chờ gì ở đây (no-op với Song).
        gateHooks.afterSeek();

        // Mở tiếng TRƯỚC rồi mới play() (play() lúc trang không ra tiếng làm iOS bỏ Next/Prev ở màn hình khoá — xem lịch sử v2).
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
        // SỬA (07/10/2026, Giang báo lặp 1 bài quay về đầu rồi đứng) — bước đồng bộ thanh/nhãn/phụ đề CHỈ là hiển thị: lỗi ở
        // đây (vd phụ đề) trước đây làm cả lệnh cổng ném lỗi -> nơi gọi await (lặp 1 bài) không bao giờ tới play(). Bắt lỗi tại
        // chỗ, cổng vẫn báo chạy trọn.
        try {
            SEEK_GATE_DONE_SYNC_BY_MEDIA[mediaKind]();
        } catch (err) {
            console.error('[workflowPlayerControls] runGatedSeek: đồng bộ hiển thị sau seek lỗi:', err);
        }
        console.log(`[seekGate] ${mediaKind} (nạp lại) ${wasPlaying ? 'đang phát' : 'đang dừng'} -> ${targetSec.toFixed(2)}s | tổng ${Math.round(performance.now() - startMs)}ms`);
        return true;
    },

    /** MỚI (07/10/2026) — 'pause' trước đó là THẬT (Video: kéo thanh seek tự pause lúc chưa có cổng -> UI đã đổi sang dừng)
     * mà cổng sắp play() lại (`resumeAfter`) -> thả hold TRƯỚC để 'play' cũng THẬT tới UI (icon/đồng hồ nghe/Point Move).
     * Ngược lại (pause do cổng/cử chỉ tự gây ra, đã bị hold nuốt) thì giữ hold -> 'play' cũng bị nuốt, UI không nháy.
     * @param {HTMLMediaElement} mediaEl @param {boolean} isVisiblePlay */
    _releaseHoldForVisiblePlay(mediaEl, isVisiblePlay) {
        if (!isVisiblePlay) return; // guard
        this._releaseSeekGateHold(mediaEl, false);
    },

    /** MỚI (29/09/2026) — lặp 1 bài cho Song: cổng seek về 0 (nạp lại nguồn -> xoá hàng đợi tiếng cũ của iOS) rồi phát lại.
     * SỬA (07/10/2026, Giang báo "lặp 1 bài quay về đầu rồi pause") — trước đây cổng chạy với resumeAfter = false rồi nơi gọi
     * TỰ play() sau `await`: mọi lỗi/huỷ ở cuối cổng (vd bước đồng bộ hiển thị mới thêm hôm nay) làm play() không bao giờ chạy.
     * Nay để CỔNG tự play() (resumeAfter = true) ngay sau khi mở tiếng, TRƯỚC bước đồng bộ hiển thị: 'pause' lúc 'ended' là
     * THẬT nên cổng thả hold trước khi play (`_releaseHoldForVisiblePlay()`) -> sự kiện 'play' cũng THẬT tới UI (icon, đồng
     * hồ nghe, VBG, auto-switch) — đúng ý bản cũ. Người dùng seek/đổi bài giữa chừng -> lệnh mới tự lo. */
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

    /** MỚI (07/10/2026) — vị trí hiện tại của `mediaEl` cho nơi cần TÍNH mốc seek tiếp theo (cử chỉ seek-hold): đang có lệnh
     * cổng chạy trên media này -> trả mốc của lệnh đó (Song nạp lại nguồn, currentTime tạm = 0 tới khi seek xong); không có
     * -> currentTime thật. @param {HTMLMediaElement} mediaEl @returns {number} */
    getSeekGatePosition(mediaEl) {
        if (this._seekGateActiveEl === mediaEl) return this._seekGateTargetSec;
        return mediaEl.currentTime || 0;
    },

    /** MỚI (07/10/2026) — xin phát lại `mediaEl`: đang có lệnh cổng chạy trên nó -> để cổng play() SAU khi seek xong + mở
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
        gateHooks.abort(); // MỚI 07/10/2026 — Video: bỏ khung đóng băng ngay
        this._clearSeekGateActive(); // media mới tự lo play/pause — bỏ luôn lời xin play() của media cũ
        this._seekGateHeldEl = null;
        this._seekGateHeldSrc = '';
        this._seekGateResume = false;
        this._setMasterGainForSeekGate(false);
    },

    /** Đợi 1 sự kiện 1 lần của `mediaEl` (kèm timeout an toàn — cùng 1 task tên cố định, lệnh sau huỷ timeout lệnh trước).
     * @param {HTMLMediaElement} mediaEl @param {'seeked'|'loadedmetadata'} eventName @returns {Promise<void>} */
    _waitMediaEvent(mediaEl, eventName) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                mediaEl.removeEventListener(eventName, finish);
                resolve();
            };
            mediaEl.addEventListener(eventName, finish, { once: true });
            taskManager.once(finish, SEEK_GATE_SEEKED_TIMEOUT_MS, 'seekGateEventTimeout');
        });
    },

    /** Mute/mở tiếng `masterGainNode` cho cổng seek (v1 — đã xác nhận có hiệu lực, gain=0 trong log). SỬA 01/10/2026: âm
     * lượng người dùng đã tách sang `volumeGainNode` (event/workflow/audio-engine.js) nên master chỉ còn là CỔNG — mở tiếng
     * về 1 (không còn đọc `appConfigViz.volume`), mở dần 30ms. Chưa có audio graph -> no-op. @param {boolean} muted */
    _setMasterGainForSeekGate(muted) {
        const { masterGainNode, audioContext } = appState.get(['masterGainNode', 'audioContext']);
        if (!masterGainNode || !audioContext) return;
        const now = audioContext.currentTime;
        masterGainNode.gain.cancelScheduledValues(now);
        masterGainNode.gain.setValueAtTime(0, now);
        if (!muted) masterGainNode.gain.linearRampToValueAtTime(1, now + SEEK_GATE_UNMUTE_RAMP_SEC);
    },

    /** Ứng với 'playerControls.audio.timeupdate'. Lúc cổng seek v3 đang nạp lại nguồn, currentTime tạm về 0 -> bỏ qua để
     * thanh/nhãn thời gian + phụ đề không nhảy về 0:00. */
    handleAudioTimeUpdateEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return;
        handleAudioTimeUpdate(); // core/player-controls.js
        // MỚI (07/10/2026) — đang kéo (tay hoặc cử chỉ seek-hold): phụ đề đang theo mốc kéo (handleSongSeeking), không kéo về giờ đang phát.
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
     * điểm, commit vị trí + cổng seek (xem `runGatedSeek()`). THAY `handleProgressBarSeekCommit()` (core,
     * core/player-controls.js) — hàm đó chỉ gán `currentTime` trần, không kiểm soát được phần lọt âm thanh cũ,
     * và không dùng được `taskManager` (Rule 3, chỉ Workflow). @param {string|number} value */
    handleSongSeekCommit(value) {
        appState.set('isSeeking', false);
        console.log(`writer: "workflowPlayerControls.handleSongSeekCommit", page: "isSeeking", content: "false"`);
        this.runGatedSeek(audioPlayer, Number(value), false); // KHÔNG await — 'seeked' cập nhật Media Session qua listener sẵn có
        updateMediaPositionState(); // core/player-controls.js — vị trí mới ngay như bản cũ; 'seeked' cập nhật lại khi seek xong
    },

    /**
     * Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=false` (xem
     * VirtualMachineState ở event/router/player-controls.js).
     *
     * [SỬA — plan-playmedia-reorg.md, xử lý triệt để, KHÔNG chỉ đổi tên] TRƯỚC ĐÂY
     * `togglePlayPause()` (Core, core/player-controls.js) tự gộp 2 TIẾN TRÌNH nghiệp vụ khác nhau
     * trong 1 hàm — "chưa có bài nào đang tải -> phát bài đầu tiên" (gọi thẳng `window.playSong()`)
     * và "đang có bài đã tải -> toggle play/pause" — vi phạm Rule 1 (core-function-conventions.md:
     * phép thử "xoá điều kiện if đi, hàm còn lại có còn là 1 kịch bản duy nhất không" — ở đây bỏ
     * nhánh `currentKey===null` đi, phần còn lại VẪN là 1 kịch bản hoàn chỉnh khác hẳn, không phải
     * guard clause), cộng thêm tự `appState.get()` 3 lần bên trong (vi phạm Rule 2). Method NÀY
     * (Workflow — tầng DUY NHẤT được đọc appState để chọn gọi Core nào) giờ đứng ra:
     *   1. `requestWakeLock()` — core, side-effect vô điều kiện (giữ ĐÚNG hành vi gốc: gọi trước
     *      cả khi playlist rỗng).
     *   2. Guard `playlistOrder.length === 0` — không làm gì (giữ nguyên vị trí guard gốc).
     *   3. `currentKey === null` -> gọi `workflowPlayer.playMedia()` (Workflow gọi Workflow khác
     *      miền, tự do — event-bus-flow.md mục 3a) với bài đầu tiên (`displayOrder[0] ||
     *      playlistOrder[0]`, ĐÚNG công thức gốc).
     *   4. Ngược lại -> gọi `togglePlayPause(audioContext)` (Core, giờ CHỈ còn ĐÚNG 1 việc, nhận
     *      audioContext qua tham số — Rule 2 hợp lệ).
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
     * rõ ràng, giữ ĐÚNG hành vi gốc `playNext(true)`) và được TÁI DÙNG (Workflow gọi Workflow khác
     * miền, tự do) bởi: `handleSongEnded()` ngay dưới (force=false — hết bài tự động, tôn trọng
     * repeatMode), `event/workflow/video-player.js` (video hết/bị xoá giữa lúc phát — force=false/
     * true tuỳ tình huống, DÙNG CHUNG với Song), `event/workflow/gameplay.js::nextSong()`
     * (force=true — nút "Bài tiếp theo" trong Game Mode).
     *
     * [SỬA — plan-playmedia-reorg.md] TRƯỚC ĐÂY là `playNext()` (Core, core/player-controls.js) —
     * tự `appState.get()` 7-10 lần + if/else gộp shuffle/tuần tự (2 tiến trình khác nhau theo Rule
     * 1) + gọi thẳng `window.playSong()` (Core gọi Workflow trá hình) — ĐÃ XOÁ. Logic "tiến 1 bước"
     * tách thành Core thuần dùng chung `computeListStep()` (core/playlist/order.js, KHÔNG quan tâm
     * list là shuffle hay tuần tự); quyết định "tại biên làm gì" tách thành `decideBoundaryAction()`
     * (repeatMode/force); case đặc biệt lặp-1-bài tách thành `shouldRestartInsteadOfAdvance()`.
     * Method NÀY (Workflow) đọc state, chọn ĐÚNG list (shuffleIndices hay displayOrder) truyền vào
     * `computeListStep()`, rồi tự quyết định phát bài nào — GIỮ NGUYÊN 100% kết quả cuối cùng so
     * với `playNext()` gốc ở mọi tình huống (xem checklist đối chiếu, plan-playmedia-reorg.md mục 4).
     * @param {boolean} [force=false]
     */
    goToNextTrack(force = false) {
        requestWakeLock(); // core
        const { isVideoPlayerMode, isPhotoPlayerMode, repeatMode, isShuffle, currentKey, shuffleIndices, displayOrder, playlistOrder, pendingResortKeys } = appState.get([
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'repeatMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys',
        ]);
        if (playlistOrder.length === 0) return;
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js — DÙNG CHUNG Song/Video/Photo (Next/Prev + Game Mode) — SỬA (Giang yêu cầu, Photo tích hợp duration) thêm isPhotoPlayerMode

        if (shouldRestartInsteadOfAdvance(repeatMode, force)) { // core mới (order.js) — repeat-mode-2, KHÔNG force
            // Nhánh này CHỈ tới được từ `handleMediaEnded()` (hết tự nhiên) — đồng hồ nghe vừa bị dừng ngay trước. Song/Video
            // tự khởi động lại đồng hồ qua sự kiện 'play' THẬT; Photo gọi thẳng (xem REPEAT_ONE_RESTART_BY_MEDIA).
            const mediaKind = isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
            REPEAT_ONE_RESTART_BY_MEDIA[mediaKind](activeEl);
            return;
        }

        const list = isShuffle ? shuffleIndices : displayOrder; // NGUỒN danh sách — chỉ khác biệt CHỦ Ý giữa 2 nhánh cũ
        const step = computeListStep(list, currentKey, 1); // core mới (order.js)
        let nextKey;
        if (step.atBoundary) {
            const action = decideBoundaryAction(repeatMode, force); // core mới (order.js)
            if (action === 'stopAtEnd') {
                // Tín hiệu "hết hẳn playlist" cho domain khác (vd visualBg) — ĐÚNG hành vi gốc
                // (playNext() cũ, MỚI 09/08/2026). Rule 4: log ngay dưới set().
                appState.set('playbackStoppedAtPlaylistEnd', true);
                console.log(`writer: "workflowPlayerControls.goToNextTrack", page: "playbackStoppedAtPlaylistEnd", content: "true"`);
                activeEl.pause();
                return;
            }
            // wrapToStart — CHỈ nhánh tuần tự (KHÔNG shuffle) mới áp lại sort thật cho bài mới
            // thêm giữa lúc nghe (pendingResortKeys), ĐÚNG hành vi gốc — shuffle KHÔNG có bước này.
            if (!isShuffle && pendingResortKeys.size > 0) workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js (dời từ core/playlist/order.js), side-effect -> đọc lại displayOrder MỚI ngay dưới
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            nextKey = freshList[0];
        } else {
            nextKey = list[step.index];
        }
        workflowPlayer.playMedia(nextKey, { switchScreen: false, direction: 'next' }); // event/workflow/player.js — MỚI `direction` (Giang yêu cầu Transition Video Player mode — Next/Prev dùng 2 preset RIÊNG, xem core/player-display-settings.js::PLAYER_MOTION_SLOTS)
    },

    /**
     * Ứng với 'playerControls.prev.click'. CÙNG KHUÔN `goToNextTrack()` ở trên nhưng KHÔNG có
     * `force`/`decideBoundaryAction()`/`shouldRestartInsteadOfAdvance()` — hành vi gốc `playPrev()`
     * CHƯA TỪNG có khái niệm "dừng hẳn ở đầu playlist" hay "lặp 1 bài", LUÔN wrap vô điều kiện khi
     * chạm biên đầu — giữ ĐÚNG bất đối xứng đó, KHÔNG tự thêm cho "đối xứng" giả tạo với Next.
     */
    goToPrevTrack() {
        requestWakeLock(); // core
        const { isVideoPlayerMode, isPhotoPlayerMode, isShuffle, currentKey, shuffleIndices, displayOrder, playlistOrder, pendingResortKeys } = appState.get([
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys',
        ]);
        if (playlistOrder.length === 0) return;
        // XOÁ (25/09/2026, Giang yêu cầu "Prev đúng chuẩn prev bài trước") — nhánh cũ "quá 3s vào bài/video hiện tại -> chỉ
        // tua về đầu" (hành vi gốc `playPrev()`). Prev giờ LUÔN sang bài trước; phát lại từ đầu dời sang icon riêng ở Control
        // Center -> `restartCurrentTrack()` ngay dưới. Áp dụng cho MỌI đường gửi 'playerControls.prev.click' (nút, cử chỉ,
        // Media Session màn hình khoá).
        const list = isShuffle ? shuffleIndices : displayOrder;
        const step = computeListStep(list, currentKey, -1); // core mới (order.js)
        let prevKey;
        if (step.atBoundary) {
            if (!isShuffle && pendingResortKeys.size > 0) workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js (dời từ core/playlist/order.js) — CHỈ nhánh tuần tự, ĐÚNG hành vi gốc
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            prevKey = freshList[freshList.length - 1];
        } else {
            prevKey = list[step.index];
        }
        workflowPlayer.playMedia(prevKey, { switchScreen: false, direction: 'prev' }); // event/workflow/player.js — MỚI `direction`, cùng lý do goToNextTrack() ở trên
    },

    /** MỚI (25/09/2026, Giang yêu cầu) — ứng với 'playerControls.restart.click' (icon "Phát lại" ở Control Center): phát lại
     * nội dung ĐANG phát từ đầu, GIỮ nguyên trạng thái phát/dừng (thay nhánh "Prev quá 3s" đã xoá ở `goToPrevTrack()`).
     * Song/Video đi qua cổng seek `runGatedSeek()` (không lọt tiếng/hình vị trí cũ); Photo tua đồng hồ giả về 0 + chạy lại
     * Point Move (cùng cách nhánh cũ). Chưa có gì đang phát -> bỏ qua. */
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
     *
     * [SỬA — plan-playmedia-reorg.md, xử lý triệt để] TRƯỚC ĐÂY là 2 hàm RIÊNG, TRÙNG Y HỆT thân —
     * `handleAudioEnded()` (Core, core/player-controls.js, ĐÃ XOÁ ở đợt trước — 2 lời gọi Core nối
     * tiếp `stopListenClock()` rồi `playNext(false)`, vốn đã vi phạm Rule 3, đúng bản chất Workflow)
     * VÀ `workflowVideoPlayer.handleVideoPlayerEnded()` (event/workflow/video-player.js, ĐÃ XOÁ —
     * thân giống hệt, chỉ khác object chứa). Gộp làm 1 — dùng chung cho cả 2 nguồn, đúng yêu cầu
     * "không viết thêm hàm nào chỉ để tạo ra hai đường không cần thiết".
     */
    handleMediaEnded() {
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js (SỬA 06/10/2026 — dời từ core)
        this.goToNextTrack(false); // Workflow gọi method khác trong CÙNG object — tự do
    },

    /** MỚI (24/09/2026, rà soát refresh DOM — dọn nợ "Core gọi Workflow") — ứng với 'playerControls.audio.play'.
     * `handleAudioPlay()` (core/player-controls.js) trước đây TỰ gọi `workflowPlaylistRender.refreshSongNode()` +
     * `workflowVisualBg.syncPlaybackToAudio()` bên trong (core gọi Workflow, kèm tự `appState.get('currentKey')`).
     * 2 lời gọi đó dời RA đây, đứng cạnh lời gọi core — thứ tự giữ nguyên như bản cũ (core trước, vẽ lại hàng
     * đang phát, rồi đồng bộ Visual BG). */
    handleAudioPlayEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // MỚI 25/09/2026 — play() tạm của cổng seek v2, không phải người dùng phát lại
        handleAudioPlay(); // core/player-controls.js
        workflowListenStats.startClock(); // event/workflow/listen-stats.js — DỜI 06/10/2026 từ trong core handleAudioPlay() (cùng vị trí thứ tự)
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — DỜI 25/09/2026 từ trong core handleAudioPlay() (cùng vị trí thứ tự)
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — EQ bars "đang phát"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
    },

    /** MỚI (24/09/2026) — ứng với 'playerControls.audio.pause', đối xứng `handleAudioPlayEvent()` ngay trên.
     * SỬA (29/09/2026) — cuối cùng xả hàng đợi tiếng iOS (`_flushSongQueueAfterPause()`), xem docblock method đó. */
    handleAudioPauseEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // MỚI 25/09/2026 — pause() tạm của cổng seek v2 (chờ đuôi tiếng cũ), không đổi icon/đồng hồ/VBG
        handleAudioPause(); // core/player-controls.js
        releaseWakeLock(); // core/wakelock.js — DỜI 06/10/2026 từ trong core handleAudioPause() (Rule 3a)
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js — DỜI 06/10/2026 từ trong core handleAudioPause()
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — DỜI 25/09/2026 từ trong core handleAudioPause()
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — chấm "đang pause"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
        this._flushSongQueueAfterPause();
    },

    /**
     * MỚI (29/09/2026, Giang báo resume Song còn dư âm; Giang chọn hướng B "xả hàng đợi lúc pause"). iOS không xả hàng đợi
     * tiếng (giữa <audio> và Web Audio) khi pause mà chỉ ĐÓNG BĂNG nó (đo ở cổng seek v2) -> resume phát phần đóng băng
     * trước (nghe như dư âm), currentTime đi trước tiếng thật -> thanh/timer/phụ đề lệch dồn qua mỗi lần pause. Xả NGAY lúc
     * pause bằng đúng cơ chế cổng seek v3: nạp lại nguồn + seek về chỗ dừng (cổng giữ hold -> sự kiện tạm không lọt ra
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

    /** MỚI (25/09/2026) — ứng với 'playerControls.audio.loadedmetadata': core cập nhật thanh tiến trình/Media Session/tốc độ,
     * rồi auto-switch-visual build lại mốc cho bài mới (trước đây core `handleAudioLoadedMetadata()` tự gọi
     * `onAutoSwitchVisualSongChanged()` — core gọi core; phần điều phối đó giờ là Workflow). */
    handleAudioLoadedMetadataEvent() {
        handleAudioLoadedMetadata(); // core/player-controls.js
        // SỬA 26/09/2026 — bỏ workflowAutoSwitchVisual.onSongChanged() (mode 'duration' đã bỏ; 'perMedia' báo qua
        // onMediaChanged() ngay lúc currentKey đổi, event/workflow/player.js).
    },

    /**
     * Ứng với 'playerControls.shuffle.click' — đảo Shuffle rồi random lại shuffleIndices dựa trên
     * "hiện hành" (displayOrder tại thời điểm bấm — có thể đang là 1 section vừa chọn-phát qua
     * playSelectedSongs(), event/workflow/playlist.js, KHÁC hẳn top-level playlistOrder). So sánh
     * với 2 nút to "Phát"/"Trộn bài" (event/workflow/playlist-empty-state.js) — 2 nút đó LUÔN ép về
     * top-level trước khi phát/trộn (đúng ý mục 3a), còn Shuffle ở đây LUÔN tôn trọng hiện hành
     * (đúng ý mục 3b) — 2 hành vi khác nhau CHỦ ĐÍCH, không phải thiếu nhất quán.
     */
    toggleShuffleAndReshuffle() {
        const isShuffleCurrent = appState.get('isShuffle');
        const next = toggleShuffle(isShuffleCurrent); // core có sẵn, CÓ return, DÙNG ngay dưới

        const activeQueueKeys = appState.get('displayOrder'); // "hiện hành" — section HOẶC top-level
        const topLevelKeys = appState.get('playlistOrder');
        updateShuffleArrayFromQueue(activeQueueKeys, topLevelKeys, next); // core mới (order.js), Rule 2 nhận qua tham số
        this._persistPlayerConfig(); // MỚI (phản hồi Giang, mục 3) — nhớ trạng thái Shuffle
    },

    /**
     * Ứng với 'playerControls.repeat.click' — MỚI, tách khỏi router (phản hồi Giang, mục 3 "nhớ
     * trạng thái shuffle/repeat/stats"): trước đây router gọi thẳng `cycleRepeatMode()` (đúng "1
     * hàm core" theo quy ước router này) — giờ cần thêm bước lưu bền (`_persistPlayerConfig()`,
     * async, đụng IndexedDB) NGAY SAU, thành ≥2 bước -> đúng quy ước router "giao cho Workflow"
     * (xem docstring đầu event/router/player-controls.js).
     */
    cycleRepeatModeAndPersist() {
        cycleRepeatMode(); // core có sẵn (core/player-controls.js)
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
        syncShuffleUI(appState.get('isShuffle')); // core mới (core/player-controls.js)
        syncRepeatUI(appState.get('repeatMode')); // core mới (core/player-controls.js)
        setStatsPanelVisible(cfg.isStatsPanelVisible !== false); // core/visualizer-ui-visibility.js
    },

    // XOÁ (đợt tái cấu trúc bottom nav App Panel, phản hồi Giang) — closeSettingsDrawer() (từng
    // gọi resetSettingsStackToMain()/scrollSideLeftToPlaylistSmooth(), 2 core ĐÃ XOÁ) không còn ý
    // nghĩa: đóng Settings giờ do workflowAppSettings.close() đảm nhiệm (event/workflow/
    // app-settings.js) — Router (event/router/player-controls.js, case
    // 'playerControls.settingsDrawer.close') đã trỏ thẳng sang đó, KHÔNG còn gọi qua đây nữa.
};
