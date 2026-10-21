/**
 * event/workflow/video-player.js — Workflow của Video Player mode.
 *
 * Entry point DUY NHẤT vào mode: `startFromPlaylist(startKey)`, từ `workflowPlayer.playMedia()` (event/workflow/player.js)
 * qua eventBus router 'videoPlayer' (event/router/video-player.js — Block gate chặn ở đó). Next/Prev (nút/cử chỉ vuốt)
 * LUÔN đi qua `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` → `workflowPlayer.playMedia()` → router này lần
 * nữa → VirtualMachineState chọn `playVideoByKey()` (đã ở mode) thay vì `startFromPlaylist()` (vào mode lần đầu).
 * `exitVideoPlayerMode()` có 2 caller: `workflowPlayer.playMedia()` (chọn Song khi đang ở mode) và `workflowPlaylist`
 * (đổi Nguồn).
 *
 * `bgVideoElement` là NGUỒN DUY NHẤT (không `audioPlayer`) — progress bar/current time/duration/seek/play-pause/ended có
 * handler riêng trong file này (sự kiện qua event/listener/video-player.js; chờ sự kiện 1 lần qua
 * event/workflow/media-wait.js). Next/Prev/shuffle/repeat DÙNG CHUNG cơ chế Playlist (`displayOrder`/`shuffleIndices`/
 * `currentKey`).
 *
 * NẠP SAU: core/video-player.js, core/video-player-capture.js, core/player-controls.js, core/media-element-ui.js, core/dynamic-object-ui.js,
 * core/audio-engine.js, core/playlist/state.js, core/file-manager/video.js, core/visual-bg*.js, core/visualizer/visualizer-display.js,
 * core/record-art-ui.js + components/bottom-player.js (#record-art), core/loading-shield-util.js, service/{db,blob-url}.js.
 * Lúc chạy: event/workflow/{audio-engine,player-controls,playlist-scope,playlist-render,media-wait,video-motion-surface,
 * player-display-settings,visual-bg-common,…}.js.
 */
// Khoảng cách tối thiểu (giây) giữ lại trước cuối video khi người dùng kéo/nhả thanh seek tới sát/đúng
// duration — xem `_clampSeekTarget()`. Seek KHÔNG được đặt currentTime chạm EOF (làm `ended` bắn theo
// ĐƯỜNG SEEK thay vì do video THẬT SỰ phát hết, tuỳ engine; và `play()` từ đúng EOF có thể restart về 0).
const VIDEO_SEEK_END_GUARD_SEC = 0.05;

// Scrub = seek CHÍNH XÁC nhưng XẾP HÀNG (mỗi lần chỉ 1 lệnh seek đang bay, lệnh mới nhất thắng) — `fastSeek()` đáp xuống
// keyframe cách mốc kéo hàng giây với video ít keyframe. Lúc thả tay kiểm chứng `currentTime` thật.
const VIDEO_SEEK_VERIFY_TOLERANCE_SEC = 0.15; // sau 'seeked', lệch > mức này so với mốc thả tay -> gán lại (tối đa 3 lần, xem runGatedSeek())
const VIDEO_SCRUB_SEEKED_TIMEOUT_MS = 1500;   // đợi 'seeked' của 1 lệnh scrub tối đa — phòng seek không bao giờ xong để hàng đợi không kẹt
const VIDEO_SCRUB_TIMEOUT_TASK = 'videoScrubSeekedTimeout';

// Đóng băng khung hình hiện tại lúc cổng seek nạp lại nguồn — xem `seekGateHooks()`.
const VIDEO_SEEK_FREEZE_MAX_SIDE_PX = 1920;    // khung đóng băng chỉ hiện vài trăm ms — thu nhỏ cho mã hoá JPEG nhanh (video 4K)
const VIDEO_SEEK_FREEZE_JPEG_QUALITY = 0.85;
const VIDEO_SEEK_FREEZE_PLAYING_FALLBACK_MS = 2000; // đã play() mà 'playing' không tới -> vẫn bỏ che (cùng mốc `videoPlayingReadyFallback` của swapBgVideoSource())
const VIDEO_SEEK_FREEZE_PLAYING_FALLBACK_TASK = 'videoSeekFreezePlayingFallback';
/** Huỷ 2 lượt chờ 'playing'/'play' của khung đóng băng (event/workflow/media-wait.js) — chưa giao thì không có gì để huỷ. */
const SEEK_FREEZE_WAIT_CANCEL_BY_ASSIGNED = {
    true: (freeze) => { freeze.cancelOnPlaying(); freeze.cancelOnPlay(); },
    false: () => {},
};
/** Scrub: 'seeked' (hoặc timeout) xong — media còn nguyên thì xem trước qua layer B (video còn che sau lệnh cổng) rồi gửi
 * tiếp mốc mới hơn; media đã đổi giữa lúc kéo thì bỏ mốc đang chờ. */
const SCRUB_AFTER_SEEKED_BY_MEDIA_UNCHANGED = {
    true: (player) => { player._refreshFrozenSeekFrame(); player._flushScrubSeek(); },
    false: (player) => { player._scrubPendingTarget = null; },
};

/** Đổi video: đọc được record -> đổi nguồn; không (vừa bị xoá ở nơi khác) -> hết khoảng cấm xả, trả null (nơi gọi tự lo). */
const VIDEO_SWAP_BY_HAS_RECORD = {
    false: () => {
        workflowVideoPlayer._swapInProgress = false;
        return null;
    },
    true: (record, swap) => workflowVideoPlayer._swapToRecord(record, swap),
};

/** Chờ video MỚI có khung thật sau lượt đổi. Game Mode armed (không play()): 'playing' chỉ tới lúc `_beginPlaying()`
 * (event/workflow/gameplay.js) phát sau countdown -> resolve NGAY (waitBgVideoReady() không treo oan), phần lộ video hoãn
 * tới 'playing' THẬT đầu tiên, không timeout (countdown dài hơn 2s). Thường: 'playing' hoặc hết 2s, cái nào tới trước. */
const SWAP_READY_WAIT_BY_SKIP_AUTOPLAY = {
    true: (resolve, swap) => {
        resolve();
        workflowMediaWait.once(bgVideoElement, 'playing', () => workflowVideoPlayer._revealDeferredSwap(swap)); // event/workflow/media-wait.js
    },
    false: (resolve, swap) => {
        let done = false;
        const finish = () => {
            if (done) return; // guard — 'playing' / hết giờ, cái nào tới trước
            done = true;
            workflowVideoPlayer._revealSwappedVideo(swap);
            resolve();
        };
        workflowMediaWait.once(bgVideoElement, 'playing', finish); // event/workflow/media-wait.js
        taskManager.once(finish, 2000, 'videoPlayingReadyFallback');
    },
};

/** Bấm lại đúng video đang nạp -> chỉ đổi màn + phát tiếp; video khác -> nạp mới trong shield. */
const VIDEO_PLAY_BY_SAME_LOADED = {
    true: (request) => workflowVideoPlayer._replayCurrentVideo(request.switchScreen, request.gameplayArmedGameId),
    false: (request) => workflowVideoPlayer._playNewVideo(request),
};

/** Đổi nguồn xong (trong shield): mất record -> báo sang video kế SAU khi shield đóng (gọi trong shield sẽ bị chính shield
 * chặn); còn -> cập nhật UI + chờ video chạy. */
const VIDEO_SHOW_BY_HAS_RECORD = {
    false: () => 'missing',
    true: (record, request, previousKey) => workflowVideoPlayer._showLoadedVideo(record, request, previousKey).then(() => 'loaded'),
};

/** Sau khi shield đóng hẳn. Shield bận (lệnh bị bỏ) -> undefined. */
const VIDEO_AFTER_SHIELD_BY_STATUS = {
    missing: () => workflowPlayerControls.goToNextTrack(true), // event/workflow/player-controls.js — dùng chung với Song
    loaded: () => {},
};

/** Làm mới Playlist Nguồn Video: đang Scope 1 folder -> nạp lại đúng folder đó; không -> toàn bộ. */
const VIDEO_PLAYLIST_REFRESH_BY_HAS_FOLDER = {
    true: (folderId) => workflowPlaylistScope.applyFolderScope(folderId, 'video'), // event/workflow/playlist-scope.js
    false: () => workflowPlaylistScope.applyAllSongsScope('video'),
};

/** Khung đóng băng vừa chụp: video chưa đổi -> gắn vào layer B; đã đổi giữa lúc chụp -> thu hồi, bỏ. */
const SEEK_FRAME_BY_SAME_MEDIA = {
    true: (url, naturalSize) => workflowVideoPlayer._applySeekFrameToLayerB(url, naturalSize),
    false: (url) => {
        revokeBlobUrl(url); // service/blob-url.js
        return null;
    },
};

/** Kéo seek lúc còn che: đang chụp dở -> chụp thêm 1 lần sau; rảnh -> chụp ngay. */
const SEEK_FREEZE_REFRESH_BY_BUSY = {
    true: () => { workflowVideoPlayer._seekFreezeRefreshPending = true; },
    false: () => workflowVideoPlayer._startSeekFreezeRefresh(),
};

const workflowVideoPlayer = {
    _objectUrl: null, // object URL HIỆN TẠI đang gán cho bgVideoElement (revoke trước khi tạo url mới)
    _thumbObjectUrl: null, // object URL của thumbBlob HIỆN TẠI (poster + cover ở player bar, #record-container) — revoke trước khi tạo url mới
    _forcedBgObjectUrl: null, // object URL của thumbFullBlob đang chèn cưỡng chế vào #visual-bg-image (xem swapBgVideoSource()) — revoke trước khi tạo url mới
    _swapReadyPromise: null, // Promise đợi 'playing' (hoặc timeout) của lần swapBgVideoSource() gần nhất — xem waitBgVideoReady()
    _wasPlayingBeforeSeek: false, // trạng thái play/pause NGAY TRƯỚC lúc bắt đầu kéo tay thanh seek — xem handleVideoSeeking()/handleVideoSeekCommit()
    _mediaGeneration: 0, // tăng 1 mỗi lần `swapBgVideoSource()` BẮT ĐẦU (chốt chặn DUY NHẤT mọi lần đổi src của bgVideoElement) — mốc để biết 1 phiên seek đã thuộc về media CŨ hay chưa. KHÔNG dùng `currentKey`: nó chỉ đổi SAU `waitBgVideoReady()`, còn 1 khoảng hở suốt lúc swap.
    _seekGeneration: null, // giá trị `_mediaGeneration` LÚC phiên kéo tay hiện tại bắt đầu (null = không có phiên) — lệch `_mediaGeneration` = phiên cũ, media đã đổi giữa lúc kéo, xem handleVideoSeeking()/handleVideoSeekCommit()
    _scrubPendingTarget: null, // mốc scrub MỚI NHẤT đang chờ (null = không có) — lệnh seek đang bay xong mới gửi, xem `_requestScrubSeek()`
    _scrubInFlight: false,     // đang có 1 lệnh seek scrub chưa 'seeked'
    _scrubSeq: 0,              // tăng mỗi lệnh scrub/lần huỷ — lượt chờ 'seeked'/timeout của lệnh trước tự bỏ qua nếu lệch số
    // Đóng băng khung hình lúc cổng seek nạp lại nguồn, xem `seekGateHooks()`
    _seekFreeze: null,         // { generation, layerState, cancelOnPlaying, cancelOnPlay, frameWatch } lúc đang che; null = không che
    _seekFreezePromise: null,  // lượt chụp + che đang chạy (lệnh cổng mới hơn tới giữa chừng thì đợi chung lượt này)
    _seekFreezeRefreshing: false, // đang chụp lại khung che (kéo thanh seek lúc video còn che, xem `_refreshFrozenSeekFrame()`)
    _seekFreezeRefreshPending: false, // có mốc scrub mới tới trong lúc đang chụp -> chụp thêm 1 lần sau
    _swapInProgress: false,    // `swapBgVideoSource()` đang đổi video (đã pause, chưa gán src mới) — 'pause' lúc này KHÔNG xả hàng đợi

    /**
     * Nạp `videoKey` vào `bgVideoElement` — CƠ CHẾ SWAP DUY NHẤT, DÙNG CHUNG giữa Video Player mode
     * THẬT (`playVideoByKey()` bên dưới) và Visual Background TRANG TRÍ (`workflowVisualBg._playVideoKey()`).
     *
     * Chống chớp đen lúc đổi `src` (đổi `src` LUÔN reset readyState về HAVE_NOTHING ngay lập tức,
     * xoá khung hình đang hiện) — 3 bước: (1) `bgVideoElement.pause()` NGAY khi hàm bắt đầu, CHƯA
     * đụng `src` — video CŨ đứng hình. (2) `await getVideoRecord()` xong xuôi rồi mới đụng
     * `bgVideoElement`. (3) Gán `poster`+`src`+`play()` ĐÚNG 1 lần liền mạch — KHÔNG chủ động ẩn/
     * hiện `bgVideoElement` (xem header core/video-player.js — hardware compositing layer trên
     * WKWebView/iOS không tuân z-index/CSS, active-toggle không giải quyết được gì thêm mà còn tự
     * tạo 1 nhịp giật riêng — chấp nhận best-effort, không chớp-đen-zero tuyệt đối).
     *
     * KHÔNG đợi 'playing' ở đây — trả `record` ngay để caller biết CÓ đọc được hay không (Visual
     * Background cần biết SỚM để tự chữa lành, không phải đợi hết khung hình mới biết). Gọi
     * `waitBgVideoReady()` riêng (có thể KHÔNG await) để đợi khung hình thật. KHÔNG đụng muted/loop/
     * pointer-events/currentKey/title/MediaSession — việc riêng của TỪNG nơi gọi (Video Player mode
     * thật cần, Visual Background trang trí không cần).
     *
     * @param {string} videoKey
     * @param {boolean} [isTransition=false] - chèn `record.thumbFullBlob` (decode + double-rAF,
     *   `_decodeForcedBgThumb()`) làm lớp dự phòng multi-browser cho
     *   `#visual-bg-image` hay không. Video Player mode: `false` lúc vào mode lần đầu (chưa có gì
     *   đang hiện để mà "chớp"), `true` lúc Next/Prev/end. Visual Background: LUÔN `true` (áp lần
     *   đầu cũng cần — thumb đứng yên tới khi video thật sự sẵn sàng, xem docstring
     *   `workflowVisualBg._playVideoKey()`).
     * @param {Function} [beforePlay=null] - hook chạy NGAY TRƯỚC khi gán `poster`/`src`/`play()` —
     *   CHỈ để `playVideoByKey()` chèn `workflowAudioEngine.setup()`/`connectVideoElement()` ĐÚNG
     *   VỊ TRÍ. Visual Background KHÔNG truyền (VBG nối Web Audio LƯỜI ở
     *   `workflowVisualBg._applyVideoAudioSettingToElement()` — chỉ khi Audio B thật sự bật).
     * @param {boolean} [hideUntilReady=false] - ẩn hẳn `bgVideoElement` (`.hidden`, display:none) NGAY TRƯỚC khi đụng
     *   `src` (lúc `#visual-bg-image` đã có thumb full-res PAINT XONG — _decodeForcedBgThumb() tự đợi 2 khung), rồi gỡ
     *   `.hidden` khi `_swapReadyPromise` xong ('playing' hoặc timeout 2s). Trên WKWebView/iOS KHÔNG thể che 1 `<video>`
     *   đang hiện bằng lớp ĐÈ LÊN — chỉ lộ được lớp NẰM DƯỚI bằng cách ẩn chính nó (header core/video-player.js).
     *   VBG truyền `true`; Video Player mode truyền `true` CHỈ ở lần VÀO mode khi record có `thumbFullBlob` (xem
     *   `isSurfaceEntry`): thumb full-res vào layer B, ẩn video tới 'playing', KHÔNG Transition. Next/Prev `false`.
     * @param {boolean} [skipAutoplay=false] - Game Mode đang armed: gán poster/src nhưng
     *   KHÔNG gọi .play() ở bước (3) — playVideoByKey() truyền true khi phát hiện đang armed Game
     *   Mode (gameplayArmedGameId != null), nhường việc gọi .play() thật cho
     *   workflowGameplay._beginPlaying() (event/workflow/gameplay.js) sau khi countdown xong.
     *   _swapReadyPromise bên dưới TỰ resolve ngay (KHÔNG đợi sự kiện 'playing' — sẽ không bao
     *   giờ bắn tới lúc .play() thật sự chạy) để waitBgVideoReady() không treo oan 2s.
     *   Visual Background KHÔNG truyền (VBG không thuộc phạm vi gate Game Mode).
     * @param {{runTransition?: () => Promise<void>, onLayerBFilled?: () => void}|null} [hooks=null] - HOOK do NƠI GỌI
     *   truyền (nguyên tắc tua vít — cơ chế đổi nguồn không biết ai đang dùng nó):
     *   `onLayerBFilled(record)` — gọi NGAY sau khi thumb full-res vừa vào layer B (khớp Resolution layer B theo
     *   `record.width/height` của video MỚI).
     *   `runTransition()` — CHỈ gọi khi `isTransition` + record có `thumbFullBlob`: chạy Transition A->B rồi
     *   resolve (Player: preset Next/Prev qua Video surface). CÓ hook này thì hàm tự lo trọn bộ cơ chế layer
     *   A/B quanh nó (ẩn A bằng opacity trước khi đụng src, trả `.me-current` về A khi 'playing').
     *   Không truyền -> cắt cứng.
     * @returns {Promise<object|null>} record đã đọc (null nếu không tồn tại — caller tự lo, KHÔNG throw).
     */
    async swapBgVideoSource(videoKey, isTransition = false, beforePlay = null, hideUntilReady = false, skipAutoplay = false, hooks = null) {
        this._mediaGeneration++; // vô hiệu hoá mọi phiên seek đang treo của media trước, xem handleVideoSeekCommit()
        const swapGeneration = this._mediaGeneration; // chốt để bước lộ video biết lượt swap này đã bị lượt mới hơn/thoát mode thay thế chưa
        // Bỏ khung đóng băng của cổng seek (nếu đang che) TRƯỚC mọi thao tác layer A/B của lượt swap; cổng
        // đang chạy dở tự huỷ khi thấy src đổi. Đánh dấu đang swap: 'pause' ngay dưới không được xả hàng đợi (nạp lại video CŨ).
        this._cancelSeekFreeze();
        this._swapInProgress = true;
        pauseMediaElement(bgVideoElement); // (1) core/media-element-ui.js — đứng hình NGAY, CHƯA đụng src, khung hình cũ giữ nguyên
        const record = await getVideoRecord(videoKey); // (2) service/db.js — trong lúc đợi, màn hình vẫn đứng yên ở khung hình cũ
        return VIDEO_SWAP_BY_HAS_RECORD[!!record](record, { swapGeneration, isTransition, beforePlay, hideUntilReady, skipAutoplay, hooks });
    },

    /** Phần còn lại của lượt đổi khi đã có record — thứ tự: thumb full-res vào layer B (+ Transition) -> ẩn layer A -> tạo
     * object URL -> `beforePlay` -> gán poster/src -> play() -> chờ 'playing' rồi lộ video. @returns {Promise<object>} record */
    async _swapToRecord(record, swap) {
        const { isTransition, beforePlay, hideUntilReady, skipAutoplay, hooks } = swap;
        const isOnMotionSurface = workflowVideoMotionSurface.isAttached(); // event/workflow/video-motion-surface.js
        const plan = resolveVideoSwapPlan({ // core/video-player.js
            isTransition, hideUntilReady, isOnMotionSurface,
            hasThumbFull: !!record.thumbFullBlob,
            hasTransitionHookFn: !!(hooks && typeof hooks.runTransition === 'function'),
        });

        if (plan.fillLayerB) await this._fillSwapLayerB(record, plan, hooks);

        // Transition xong / thumb đã PAINT — ẩn layer A trước khi đụng src (thứ tự: pause khung trước -> thumb full-res -> ẩn
        // video -> gán src mới -> lộ lại khi sẵn sàng).
        hideVideoLayerForSwap(plan.hasTransitionHook, plan.hideVideoUntilReady); // core/video-player.js

        revokeBlobUrl(this._objectUrl); // service/blob-url.js — null vô hại
        this._objectUrl = createBlobUrl(record.blob);
        revokeBlobUrl(this._thumbObjectUrl);
        this._thumbObjectUrl = createBlobUrl(record.thumbBlob);

        if (beforePlay) beforePlay(); // sau khi tạo object URL, TRƯỚC khi gán poster/src/play()

        // (3) Gán 1 lần liền mạch — KHÔNG còn khoảng hở giữa các dòng.
        setBgVideoPosterAndSource(this._thumbObjectUrl, this._objectUrl); // core/video-player.js
        this._swapInProgress = false; // src mới đã gán, hết khoảng cấm xả
        this._playSwappedVideoUnlessSkipped(skipAutoplay);

        // z-index 2 layer do `.me-current` quyết định (assets/css/motion-engine.css) — cuối Transition layer ảnh giữ `.me-current`
        // (đè lên video); khi video THẬT sẵn sàng trả `.me-current` về `bgVideoElement`, ảnh chỉ còn là lớp DỰ PHÒNG.
        const readySwap = { generation: swap.swapGeneration, plan, isOnMotionSurface };
        this._swapReadyPromise = new Promise((resolve) => SWAP_READY_WAIT_BY_SKIP_AUTOPLAY[!!skipAutoplay](resolve, readySwap));
        return record;
    },

    /** Thumb full-res vào layer B (`#visual-bg-image`) — đã PAINT xong khi trả về; khớp Resolution qua hook `onLayerBFilled`
     * (cần `record.width/height` của video MỚI — bgVideoElement lúc này vẫn mang kích thước video trước); lần hiện tĩnh đầu:
     * layer B mang `.motion-layer` (mặc định opacity 0) nên gán `.me-current` mới thấy; Transition: layer A đang đứng hình frame
     * trước nên an toàn để animate. */
    async _fillSwapLayerB(record, plan, hooks) {
        const forcedUrl = await this._decodeForcedBgThumb(record.thumbFullBlob); // tự đợi 2 khung
        this._replaceForcedBgUrl(forcedUrl);
        applyVisualBgImageToDOM(true, forcedUrl); // core/visual-bg.js
        if (hooks && typeof hooks.onLayerBFilled === 'function') hooks.onLayerBFilled(record);
        if (plan.isSurfaceEntry && visualBgImageElement) markBridgeLayerCurrent(visualBgImageElement); // core/video-player.js
        if (plan.hasTransitionHook) await hooks.runTransition(); // hook của nơi gọi
    },

    /** Game Mode armed (`skipAutoplay`): chỉ nạp khung tĩnh (poster), `_beginPlaying()` phát sau countdown. @param {boolean} skipAutoplay */
    _playSwappedVideoUnlessSkipped(skipAutoplay) {
        if (skipAutoplay) return; // guard
        playMediaElement(bgVideoElement, '[video-player] bgVideoElement'); // core/media-element-ui.js
    },

    /** Lộ video sau lượt đổi ('playing' / hết giờ) — bỏ qua nếu lần hiện tĩnh đầu đã bị lượt mới hơn thay hoặc đã thoát mode
     * (sẽ hiện video đã bị dọn, hoặc phá state lượt mới). */
    _revealSwappedVideo(swap) {
        if (!isSwapRevealStillValid(swap.plan.isSurfaceEntry, swap.generation, this._mediaGeneration, workflowVideoMotionSurface.isAttached())) return; // guard — core/video-player.js
        revealVideoLayerAfterSwap(swap.plan.hideVideoUntilReady, swap.plan.hasTransitionHook, swap.plan.revealReturnCurrent); // core/video-player.js
    },

    /** Lộ video hoãn tới 'playing' THẬT (Game Mode armed — suốt countdown thumb layer B đứng thay chỗ; lộ sớm thì layer A còn
     * rỗng/đen đè lên thumb). Lượt đã bị thay hoặc đã trả Video surface -> bỏ qua. */
    _revealDeferredSwap(swap) {
        if (!isDeferredSwapRevealStillValid(swap.generation, this._mediaGeneration, swap.isOnMotionSurface, workflowVideoMotionSurface.isAttached())) return; // guard — core/video-player.js
        revealVideoLayerAfterSwap(swap.plan.hideVideoUntilReady, swap.plan.hasTransitionHook, swap.plan.revealReturnCurrent); // core/video-player.js
    },

    /** Thay object URL của khung đang chèn vào layer B (thu hồi URL cũ). @param {string} url */
    _replaceForcedBgUrl(url) {
        revokeBlobUrl(this._forcedBgObjectUrl); // service/blob-url.js — null vô hại
        this._forcedBgObjectUrl = url;
    },

    /** Thu hồi object URL video + thumb đang gán cho `bgVideoElement`. */
    _releaseVideoUrls() {
        revokeBlobUrl(this._objectUrl); // service/blob-url.js
        this._objectUrl = null;
        revokeBlobUrl(this._thumbObjectUrl);
        this._thumbObjectUrl = null;
    },

    /** Gỡ khung đang chèn ở layer B (nếu có) + thu hồi URL của nó. */
    _releaseForcedBgUrl() {
        if (!this._forcedBgObjectUrl) return; // guard
        applyVisualBgImageToDOM(false, ''); // core/visual-bg.js
        revokeBlobUrl(this._forcedBgObjectUrl); // service/blob-url.js
        this._forcedBgObjectUrl = null;
    },

    /** Thumb khung đầu (Blob) -> object URL đã decode + trình duyệt đã PAINT (đợi 2 khung) — lớp dự phòng của `#visual-bg-image`
     * lúc đổi video (xem header core/video-player.js). Lỗi decode vẫn trả URL. Nơi gọi tự thu hồi URL khi không cần nữa.
     * @param {Blob|null} blob - `record.thumbFullBlob` (null với video cũ/lỗi capture) @returns {Promise<string|null>} */
    async _decodeForcedBgThumb(blob) {
        if (!blob) return null; // guard
        const url = createBlobUrl(blob); // service/blob-url.js
        await waitImageUrlDecoded(url); // core/player-controls.js
        await new Promise((resolve) => { taskManager.onceFrame(resolve, 2); }); // service/task-manager.js — tên tự sinh: nhiều lượt chồng nhau không huỷ nhau
        return url;
    },

    /** Đợi khung hình thật (sự kiện 'playing', kèm timeout an toàn 2s) từ lần `swapBgVideoSource()`
     * GẦN NHẤT. Video Player mode LUÔN await (cần biết chắc mới đổi UI); Visual Background KHÔNG
     * await lúc boot/áp lần đầu (không chặn playlist). */
    async waitBgVideoReady() {
        if (this._swapReadyPromise) await this._swapReadyPromise;
    },

    /** Đợi `bgVideoElement` bắn `'playing'` (hoặc timeout an toàn) cho lần `.play()` KẾ TIẾP. KHÁC `waitBgVideoReady()`
     * ở trên (gắn với `_swapReadyPromise` — CHỈ hợp lệ ngay sau 1 lần `swapBgVideoSource()` thật):
     * hàm NÀY dùng cho case RESUME — `.play()` lại video ĐÃ nạp sẵn, KHÔNG qua swap/đổi `src` nào
     * (vd `workflowVisualBg.syncPlaybackToAudio()` lúc Song phát lại sau pause tạm) — `waitBgVideoReady()` ở case này
     * sẽ đọc trúng Promise đã resolve từ lần swap trước. Chờ qua event/workflow/media-wait.js.
     * @param {number} [timeoutMs=2000]
     * @returns {Promise<void>}
     */
    waitForNextPlaying(timeoutMs = 2000) {
        return workflowMediaWait.wait(bgVideoElement, 'playing', timeoutMs, 'visualBgVideoResumePlayingFallback').then(() => {}); // event/workflow/media-wait.js
    },

    /** Hiện thumb full-res TĨNH của
     * `videoKey` làm nền, KHÔNG chạm `bgVideoElement.src`/`play()` — video THẬT không hề được nạp.
     * Dùng khi VBG `type==='video'` nhưng Song CHƯA thật sự phát (xem
     * `workflowVisualBg._applyVideo()`/`syncPlaybackToAudio()`). Cùng cơ chế lớp thumb dự phòng của `swapBgVideoSource()`
     * (`record.thumbFullBlob` -> `_decodeForcedBgThumb()` -> `applyVisualBgImageToDOM()`), bỏ bước gán `src`/`play()`.
     * @param {string} videoKey
     * @param {((record: object) => void)|null} [onLayerBFilled=null] - HOOK của nơi gọi, CÙNG ý nghĩa hook `onLayerBFilled`
     *   của `swapBgVideoSource()`: gọi NGAY sau khi thumb vừa vào layer B (VBG: khớp `background-size` theo Resolution VBG
     *   + kích thước gốc `record.width/height`).
     * @returns {Promise<boolean>} true nếu hiện được (record tồn tại + có `thumbFullBlob`).
     */
    async showStaticBgThumb(videoKey, onLayerBFilled = null) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record || !record.thumbFullBlob) return false; // guard
        stripBgVideoSource(); // core/video-player.js
        this._releaseVideoUrls();
        const forcedUrl = await this._decodeForcedBgThumb(record.thumbFullBlob); // tự đợi 2 khung — đã PAINT xong
        this._replaceForcedBgUrl(forcedUrl);
        applyVisualBgImageToDOM(true, forcedUrl); // core/visual-bg.js
        if (typeof onLayerBFilled === 'function') onLayerBFilled(record); // cùng task với dòng trên, chưa kịp paint size mặc định
        this._swapReadyPromise = null;
        return true;
    },

    /** Dừng + dọn HẲN `bgVideoElement` (pause, ẩn, gỡ `src`/`poster`, revoke cả 3 object URL đang
     * giữ) — CƠ CHẾ DÙNG CHUNG giữa `exitVideoPlayerMode()` (thoát mode thật) và Visual Background
     * (dừng nhánh video trang trí, event/workflow/visual-bg.js). KHÔNG đụng muted/loop/pointer-
     * events/currentKey/isVideoPlayerMode/wake-lock — việc riêng của `exitVideoPlayerMode()`. */
    clearBgVideoSource() {
        this._cancelSeekFreeze(); // thoát mode giữa lúc cổng seek đang che khung
        stripBgVideoSource(); // core/video-player.js
        resetBgVideoOpacity(); // core/video-player.js — mọi lần dọn
        this._releaseVideoUrls();
        this._releaseForcedBgUrl();
        this._swapReadyPromise = null;
    },

    /**
     * Entry point DUY NHẤT vào Video Player mode — `startKey` là video vừa chọn trong Playlist. Next/Prev đọc THẲNG
     * `displayOrder`/`shuffleIndices` qua `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` (dùng chung với Song),
     * nên hàm này chỉ dọn Song đang phát + bật state + phát ĐÚNG video vừa chọn. `switchScreen` truyền xuống đúng ý định
     * người gọi (tự chuyển bài lúc đang xem Playlist không được ép mở Visualizer).
     * @param {string} startKey - videoKey vừa được chọn để phát.
     * @param {boolean} [switchScreen=true] - đổi màn hình sau khi video sẵn sàng, xem
     *        docstring `playVideoByKey()` — Next/Prev vật lý/auto-next truyền `false`.
     */
    async startFromPlaylist(startKey, switchScreen = true) {
        // Video không dùng phụ đề: dọn `subtitles` + khối đang hiện TRƯỚC khi dừng audio (pause còn bắn 'timeupdate' -> sync
        // phụ đề sẽ vẽ lại dòng cũ). Quay lại Song: currentKey null nên playMedia() nạp lại.
        appState.set('subtitles', []);
        workflowSubtitleDisplay.clearAll(); // event/workflow/subtitle-display.js
        this._releaseSongForVideo(appState.get('currentKey'));

        paintVisualizerSolidBlack(); // core/video-player.js
        enterVideoPlayerModeState(); // core/video-player.js
        // Nhường bgVideoElement cho Video Player mode NGAY (dọn task/object URL/DOM của Visual Background, không đụng config đã
        // lưu) — đồng thời dừng hẳn Runner React Beat của VBG để `motionEngineReactLayer` sạch TRƯỚC khi Player dùng chung.
        workflowVisualBg.clearMediaLayers(); // event/workflow/visual-bg-common.js
        // Mượn Video surface dùng chung (event/workflow/video-motion-surface.js): surface TỰ gắn DOM A/B vào
        // `motionEngineReactLayer` + mượn Stage, rồi Player bật React Beat theo slot 'showing'.
        workflowPlayerDisplaySettings.acquireVideoMotion(); // event/workflow/player-display-settings.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + pointer-events
        setVideoBgGain(1); // core/video-player.js — no-op tới lần nối graph đầu (playVideoByKey() đặt lại sau khi nối)
        workflowPlayerZoom.onPlayerModeEnter('video'); // event/workflow/player-zoom.js — hiện kính lúp Control Center + áp lại zoom/pan đã lưu của Video
        workflowPlayerDisplaySettings.applyVideoPlayerResolutionOnEnter(); // Resolution của Player Video (không liên quan VBG), đọc từ config đã lưu

        await this.playVideoByKey(startKey, switchScreen);
    },

    /** Đang có Song nạp sẵn: dừng (sự kiện 'pause' NGUYÊN BẢN -> UI/wake lock/Media Session của Song tự lo), bỏ currentKey,
     * vẽ lại đúng 1 dòng (xoá highlight "đang phát"). @param {string|null} previousSongKey */
    _releaseSongForVideo(previousSongKey) {
        if (previousSongKey === null) return; // guard
        pauseMediaElement(audioPlayer); // core/media-element-ui.js
        appState.set('currentKey', null);
        console.log(`writer: "workflowVideoPlayer._releaseSongForVideo", page: "currentKey", content: "null"`);
        workflowPlaylistRender.refreshSongNode(previousSongKey); // event/workflow/playlist-render.js
    },

    /** Thoát Video Player mode: dừng + dọn `bgVideoElement`, trả về mặc định trang trí + khôi phục
     * `#visual-bg-image` về ĐÚNG cài đặt Settings thật (trong lúc ở mode, lớp này bị chèn cưỡng chế
     * thumb của video hiện tại — xem `swapBgVideoSource()` — KHÔNG phản ánh cấu hình Visual
     * Background thật, phải trả lại đúng lúc thoát). `workflowVisualBg.paintSolidBg()` trả `visualizerSolidBg` về đúng
     * màu/gradient cấu hình. */
    async exitVideoPlayerMode() {
        workflowPlayerZoom.onPlayerModeLeave(); // event/workflow/player-zoom.js — tắt Zoom mode + về mức 1 + ẩn kính lúp (ĐỒNG BỘ, trước mọi await)
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, pointer-events mặc định
        setVideoBgGain(0); // core/video-player.js
        // Gỡ override Resolution NGAY lúc thoát mode — BẮT BUỘC, để #bg-video trả về CSS mặc định (object-fit: cover) phục
        // vụ ĐÚNG Visual Background, xem docstring core/player-display-apply.js.
        workflowPlayerDisplaySettings.clearVideoPlayerResolution(); // event/workflow/player-display-settings.js
        // Trả Video surface: dừng HẲN React Beat/Point Move + gỡ transform, settle Transition còn treo, trả `#bg-video` +
        // `#visual-bg-image` về vị trí "nhà" — BẮT BUỘC TRƯỚC khi VBG tái dùng `motionEngineReactLayer` (ngay dưới).
        workflowPlayerDisplaySettings.releaseVideoMotion(); // event/workflow/player-display-settings.js
        this.clearBgVideoSource(); // dừng + dọn HẲN (pause, ẩn, gỡ src/poster, revoke cả 3 URL) — CƠ CHẾ DÙNG CHUNG
        reloadMediaElement(bgVideoElement); // core/media-element-ui.js — buộc <video> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)
        workflowVisualBg.paintSolidBg(); // event/workflow/visual-bg-common.js — trả visualizerSolidBg về màu/gradient cấu hình

        // Khôi phục VBG đúng cấu hình (cặp với `clearMediaLayers()` lúc VÀO mode). `restoreAfterPlayerMode()` thay
        // `applyCurrentVisualBg()` vì bản thường tự CHẶN khi đang ở Player mode (isVideoPlayerMode còn `true` tới
        // exitVideoPlayerModeState() ngay dưới).
        await workflowVisualBg.restoreAfterPlayerMode(); // event/workflow/visual-bg-common.js — liên tuyến domain

        exitVideoPlayerModeState(); // core/video-player.js
        workflowWakeLock.release(); workflowListenStats.stopClock(); // event/workflow/listen-stats.js — dọn nốt 2 cơ chế đã bật lúc phát
    },

    /** Nạp 1 video vào `bgVideoElement` + phát ngay + cập nhật title/MediaSession + nuôi analyser. Cơ chế chống chớp đen ở
     * `swapBgVideoSource()`/`waitBgVideoReady()` (dùng chung với Visual Background) — hàm này chỉ lo phần RIÊNG của Video
     * Player mode: currentKey/UI/analyser/wake lock. Bọc `withLoadingShield(..., false)` (không hiện lớp che, cùng khuôn
     * `workflowPlayer._playNewSong()`) — khoá chống bấm Next/Prev chồng nhau lúc đang đợi.
     *
     * @param {string} videoKey
     * @param {boolean} [switchScreen=true] - đổi màn hình/cuộn sau khi video sẵn sàng — `true` (bấm 1 dòng Playlist/vào mode
     *        lần đầu); Next/Prev vật lý truyền `false`.
     * @param {boolean} [isTransition=false] - `true` khi Next/Prev/end lúc ĐÃ ở Video Player mode (event/router/video-player.js),
     *        `false` lúc vào mode lần đầu — xem docstring `swapBgVideoSource()`.
     * @param {'next'|'prev'} [direction='next'] - preset Transition Next/Prev — chỉ có ý nghĩa khi `isTransition===true`.
     */
    playVideoByKey(videoKey, switchScreen = true, isTransition = false, direction = 'next') {
        const { currentKey, gameplayArmedGameId } = appState.get(['currentKey', 'gameplayArmedGameId']);
        const isSame = isSameVideoLoaded(videoKey, currentKey, this._objectUrl, bgVideoElement.getAttribute('src')); // core/video-player.js
        return VIDEO_PLAY_BY_SAME_LOADED[isSame]({ videoKey, switchScreen, isTransition, direction, gameplayArmedGameId });
    },

    /** Bấm lại đúng video đang phát: chỉ đổi màn, phát tiếp nếu đang dừng (Game Mode armed: `_beginPlaying()` tự phát sau
     * countdown), vẫn gửi 'gameplay.mediaChanged' (cùng lý do event/workflow/player.js). */
    _replayCurrentVideo(switchScreen, gameplayArmedGameId) {
        workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js
        this._playVideoUnlessGameArmed(gameplayArmedGameId);
        eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
    },

    /** play() lúc đang phát không làm gì. @param {string|null} gameplayArmedGameId */
    _playVideoUnlessGameArmed(gameplayArmedGameId) {
        if (gameplayArmedGameId != null) return; // guard — Game Mode armed
        playMediaElement(bgVideoElement, '[video-player] bgVideoElement'); // core/media-element-ui.js
    },

    /** Video khác: đổi nguồn + UI trong shield, sang video kế nếu record mất. */
    _playNewVideo(request) {
        return withLoadingShield(t('common.loading.switchingSong'), () => this._swapAndShowVideo(request), false) // core/loading-shield-util.js
            .then((status) => (VIDEO_AFTER_SHIELD_BY_STATUS[status] || VIDEO_AFTER_SHIELD_BY_STATUS.loaded)());
    },

    /** Thân shield: đổi nguồn (`beforePlay` dựng/nối audio graph ĐÚNG vị trí; ẩn video tới 'playing' CHỈ lần VÀO mode;
     * skipAutoplay khi Game Mode armed; hook Transition Next/Prev + khớp Resolution layer B). @returns {Promise<'missing'|'loaded'>} */
    async _swapAndShowVideo(request) {
        const { currentKey: previousKey, gameplayArmedGameId } = appState.get(['currentKey', 'gameplayArmedGameId']); // previousKey đọc TRƯỚC khi ghi đè — refresh đúng dòng cũ
        const record = await this.swapBgVideoSource(request.videoKey, request.isTransition, () => this._connectVideoAudio(), !request.isTransition, gameplayArmedGameId != null, {
            onLayerBFilled: (filledRecord) => workflowPlayerDisplaySettings.syncVideoPlayerResolutionLayerB(filledRecord), // event/workflow/player-display-settings.js — kích thước gốc của video MỚI
            runTransition: () => workflowPlayerDisplaySettings.runVideoPlayerTransition(request.direction),
        });
        return VIDEO_SHOW_BY_HAS_RECORD[!!record](record, request, previousKey);
    },

    /** `beforePlay` của Player: đảm bảo audio graph (dùng chung Song/Photo/VBG) RỒI mới nối bgVideoElement — ngược thứ tự thì
     * chưa có graph để nối. Context vừa tạo có thể 'suspended' (video câm + analyser rỗng) -> resume. Gain riêng của video mặc
     * định 0 lúc vừa tạo (dùng chung với Audio B của VBG) — đặt 1 SAU khi nối (muted=false không đủ một khi audio đã qua graph).
     * Rồi kích hoạt lại style hiện tại (canvas WebGL, fftSize/buffers) + dọn trạng thái theo media, như bên Song. */
    _connectVideoAudio() {
        workflowAudioEngine.setup(); // event/workflow/audio-engine.js
        resumeAudioContextIfInterrupted(appState.get('audioContext'), true); // core/audio-engine.js
        workflowAudioEngine.connectVideoElement();
        setVideoBgGain(1); // core/video-player.js
        workflowVisualizerRender.activateCurrentStyle(); // event/workflow/visualizer-render.js
        workflowVisualizerRender.resetForNewMedia();
    },

    /** Record đã nạp: UI Bottom Player (currentKey, tên, cover, Media Session, dòng Playlist, chuyển màn/cuộn) đổi NGAY — cùng
     * nhịp với hình (ảnh MỚI đã decode + Transition xong), không đợi 'playing'. Đếm lượt xem + 'gameplay.mediaChanged' đợi
     * video THẬT sự chạy (hoặc hết 2s — vẫn trong shield nên Next/Prev bấm dồn lúc đang nạp vẫn bị chặn). */
    async _showLoadedVideo(record, request, previousKey) {
        const { videoKey, switchScreen } = request;
        appState.set('currentKey', videoKey);
        console.log(`writer: "workflowVideoPlayer._showLoadedVideo", page: "currentKey", content: "${videoKey}"`);
        workflowAutoSwitchVisual.onMediaChanged(); // event/workflow/auto-switch-visual.js — nhánh 'perMedia'

        // Tên: ưu tiên tên người dùng tự đặt, filename thì bỏ đuôi. Video không có nghệ sĩ; album rỗng thì ô trống chữ.
        const title = record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'); // core/file-manager/video.js
        setPlayerTrackLabels(title, '', record.album || ''); // core/player-controls.js
        setMediaSessionMetadata(title, '', []); // core/player-controls.js
        // Cover ở player bottom = thumb của video — tái dùng `this._thumbObjectUrl` (poster).
        mountRecordArt(recordContainer, renderRecordArtHtml(false), this._thumbObjectUrl, t('videoPlayer.untitled')); // core/record-art-ui.js + components/bottom-player.js

        workflowWakeLock.request();

        if (previousKey && previousKey !== videoKey) workflowPlaylistRender.refreshSongNode(previousKey); // event/workflow/playlist-render.js — dòng TRƯỚC đó
        // Dòng NÀY đọc bgVideoElement.paused — play() vừa gọi đã đặt paused=false (armed Game thì vẫn paused); 'play' sẽ vẽ lại.
        workflowPlaylistRender.refreshSongNode(videoKey);
        workflowPlaylistRender.syncPlayButtonPlayingState(); // khớp cả loại media (key trùng giữa các Nguồn)
        workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js — chuyển màn / cuộn Playlist

        await this.waitBgVideoReady(); // 'playing' (hoặc hết 2s — autoplay bị chặn/định dạng lạ)
        workflowListenStats.bumpPlayCount('video', videoKey); // event/workflow/listen-stats.js
        // "Media đổi" cho Game Mode (cùng msg.type nhánh Song) — vô điều kiện. Video không gửi 'visualBg.songChanged'.
        eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
    },

    /**
     * Nạp lại video ĐANG phát ở Player Video từ DB sau khi file/thumb
     * của nó vừa bị thay (Video editor "Ghi đè", upload ghi đè, sửa thumbnail) — GIỮ vị trí + trạng thái phát/dừng. CHỈ gọi
     * từ request trung tâm `workflowMediaInUse` (đã kiểm state "đang ở Video Player mode với đúng video này"). Đi qua
     * `swapBgVideoSource()` (đọc record mới, tạo object URL mới, thu hồi URL cũ) — không Transition, không đếm lượt xem.
     */
    async reloadCurrentVideoKeepingPosition() {
        const videoKey = appState.get('currentKey');
        const resumeAtSec = bgVideoElement.currentTime;
        const wasPlaying = !bgVideoElement.paused;
        const record = await this.swapBgVideoSource(videoKey, false, null, false, !wasPlaying); // skipAutoplay khi đang dừng
        if (!record) return; // guard: video vừa bị xoá ở nơi khác
        workflowMediaWait.once(bgVideoElement, 'loadedmetadata', () => seekMediaElementClamped(bgVideoElement, resumeAtSec)); // event/workflow/media-wait.js, core/media-element-ui.js
        console.log(`[workflowVideoPlayer.reloadCurrentVideoKeepingPosition] nạp lại "${videoKey}" tại ${resumeAtSec.toFixed(1)}s (${wasPlaying ? 'đang phát' : 'đang dừng'})`);
    },

    /** Làm mới lại Playlist (đọc lại DB) TRONG LÚC đang browse Nguồn Video — gọi khi video được
     * thêm (event/workflow/playlist.js::uploadVideos())
     * MÀ KHÔNG cần đổi Nguồn tắt/bật lại mới thấy video mới. Guard theo `activeMediaSource` (không
     * phải `isVideoPlayerMode` — Playlist đang browse Video KHÔNG nhất thiết đang PHÁT).
     * `applyFolderScope()`/`applyAllSongsScope()` (event/workflow/playlist-scope.js) tự lo HẾT: nạp
     * lại cache ĐÚNG phạm vi (folder đang active nếu có, nhặt luôn video vừa upload) + Filter +
     * render — không cần gọi gì thêm trước đó. */
    async refreshVideoPlaylistIfActive() {
        const { activeMediaSource, activePlayListFolder } = appState.get(['activeMediaSource', 'activePlayListFolder']);
        if (activeMediaSource !== 'video') return; // guard
        await VIDEO_PLAYLIST_REFRESH_BY_HAS_FOLDER[!!activePlayListFolder.video](activePlayListFolder.video);
        this._logVideoPlaylistRefreshed();
    },

    /** Log sau khi nạp lại (đọc playlistOrder MỚI — sau lượt Scope). */
    _logVideoPlaylistRefreshed() {
        console.log(`writer: "refreshVideoPlaylistIfActive", page: "playlistOrder", content: "${appState.get('playlistOrder').length} video"`);
    },

    /** Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=true` — play/pause `bgVideoElement`. Phát qua
     * playAfterSeekGate(): bấm phát lại ĐÚNG lúc cổng đang xả hàng đợi sau pause (nạp lại nguồn) thì để cổng play() sau khi
     * seek xong — play() thẳng lúc đó phát từ 0:00 + lọt tiếng đầu video. */
    togglePlayPauseVideo() {
        workflowWakeLock.request();
        if (bgVideoElement.paused) workflowPlayerControls.playAfterSeekGate(bgVideoElement); // event/workflow/player-controls.js
        else pauseMediaElement(bgVideoElement); // core/media-element-ui.js
    },

    /** Ứng với 'playerControls.video.play' (sự kiện 'play' NGUYÊN BẢN của `bgVideoElement`) — UI phát (dùng chung Song), dòng
     * Playlist (EQ bars — refreshSongNode() đọc bgVideoElement.paused cho video), wake lock, đồng hồ nghe, auto-switch, Point
     * Move/React Beat chạy tiếp (no-op nếu Player không giữ Video surface). */
    handleVideoPlayState() {
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // play() tạm của cổng seek (event/workflow/player-controls.js)
        setPlayerPlayingUi(true); // core/player-controls.js
        this._refreshCurrentVideoNode();
        workflowWakeLock.request(); workflowListenStats.startClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — đồng hồ đổi hiệu ứng chạy theo Video
        workflowPlayerDisplaySettings.resumeVideoMotion(); // event/workflow/player-display-settings.js
    },

    /** Ứng với 'playerControls.video.pause' — ngược lại `handleVideoPlayState()`, cuối cùng xả hàng đợi tiếng iOS (cùng hướng Song). */
    handleVideoPauseState() {
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // pause() tạm của cổng seek
        setPlayerPlayingUi(false); // core/player-controls.js
        this._refreshCurrentVideoNode();
        workflowWakeLock.release(); workflowListenStats.stopClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js
        workflowPlayerDisplaySettings.pauseVideoMotion(); // event/workflow/player-display-settings.js
        this._flushVideoQueueAfterPause();
    },

    _refreshCurrentVideoNode() {
        const currentKey = appState.get('currentKey');
        if (!currentKey) return; // guard
        workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js
    },

    /** Ứng với 'playerControls.video.loadedmetadata' — tổng thời lượng lên thanh/nhãn, áp lại tốc độ (`load()` của cổng seek /
     * video mới reset playbackRate). Cổng seek nạp lại CÙNG video thì dừng ở đó; nội dung mới thì chạy lại Point Move (advanceMs
     * cần bgVideoElement.duration — chỉ có ĐÚNG tại đây). */
    handleVideoLoadedMetadata() {
        const durationSec = bgVideoElement.duration;
        setPlayerDurationUi(durationSec, formatTime(durationSec)); // core/player-controls.js + core/playlist/state.js
        applyPlaybackSpeed(bgVideoElement, appConfigViz.getAll().playbackSpeed); // core/player-controls.js
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // guard — event/workflow/player-controls.js
        workflowPlayerDisplaySettings.syncVideoPlayerPointMove(); // event/workflow/player-display-settings.js
    },

    /** Ứng với 'playerControls.video.timeupdate' (bắn rất dày) — thanh tiến trình + nhãn giờ (Video không có phụ đề). Đang kéo
     * tay thì không đụng cả nhãn (scrub xếp hàng làm currentTime chạy sau ngón tay -> nhãn nhấp nháy); cổng seek đang nạp lại
     * nguồn (currentTime tạm = 0) cũng bỏ qua. */
    handleVideoTimeUpdate() {
        if (appState.get('isSeeking')) return; // guard
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // guard
        const positionSec = bgVideoElement.currentTime;
        setPlayerProgressUi(positionSec, formatTime(positionSec)); // core/player-controls.js + core/playlist/state.js
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi `isVideoPlayerMode=true` — kéo tay thanh seek, hoặc cử chỉ seek-hold
     * ("ngón tay ảo", event/workflow/visualizer-gesture.js). Video có HÌNH để xem trước nên PAUSE + scrub `currentTime` theo từng
     * nhịp kéo (trình duyệt tự decode/vẽ đúng khung dù đang pause). Pause + nhớ trạng thái chỉ ở nhịp ĐẦU của phiên kéo.
     * Phiên bắt đầu ở media trước mà media đã đổi giữa chừng (ended -> auto-next, Next...) -> bỏ qua nhịp còn lại (`isSeeking`
     * vẫn true tới khi thả tay). Scrub = seek CHÍNH XÁC nhưng XẾP HÀNG (bắn 1 lệnh mỗi nhịp thì seek lùi chưa xong đã bị huỷ).
     * @param {number} value */
    handleVideoSeeking(value) {
        this._beginVideoSeekSession(appState.get('isSeeking'));
        if (this._seekGeneration !== this._mediaGeneration) return; // guard
        this._requestScrubSeek(this._clampSeekTarget(Number(value)));
        setCurrentTimeLabel(formatTime(value)); // core/player-controls.js + core/playlist/state.js
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    /** Nhịp đầu phiên kéo: nhớ đang phát/dừng + mốc media, dừng video, bật `isSeeking`. @param {boolean} isSeeking */
    _beginVideoSeekSession(isSeeking) {
        if (isSeeking) return; // guard — đang trong phiên kéo
        this._wasPlayingBeforeSeek = !bgVideoElement.paused;
        this._seekGeneration = this._mediaGeneration;
        pauseMediaElement(bgVideoElement); // core/media-element-ui.js
        appState.set('isSeeking', true);
        console.log(`writer: "workflowVideoPlayer.handleVideoSeeking", page: "isSeeking", content: "true"`);
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi `isVideoPlayerMode=true` — thả tay,
     * commit vị trí cuối cùng + resume phát lại NẾU trước lúc kéo đang phát (không tự ý phát nếu
     * người dùng đã chủ động pause từ trước — xem `handleVideoSeeking()`).
     *
     * Sự kiện `change` của thanh seek có thể tới TRỄ hơn `ended` -> auto-next -> `swapBgVideoSource(B)`, mà `bgVideoElement`
     * dùng chung cho A và B -> mỗi phiên kéo gắn với `_mediaGeneration` lúc bắt đầu; media đã đổi giữa chừng thì chỉ dọn
     * `isSeeking`, KHÔNG đụng currentTime/play của video mới. `null` (commit tới mà chưa từng có 'seeking') cũng coi như
     * phiên cũ. Cử chỉ seek-hold đi đúng hàm này như kéo tay ('seeking' mỗi tick, 'seekCommit' lúc thả).
     * @param {number} value
     */
    handleVideoSeekCommit(value) {
        const isStaleSession = this._seekGeneration !== this._mediaGeneration;
        this._seekGeneration = null;
        this._resetScrubSeek(); // huỷ lệnh scrub đang bay/chờ — mốc CUỐI do runGatedSeek() bên dưới lo
        appState.set('isSeeking', false);
        console.log(`writer: "workflowVideoPlayer.handleVideoSeekCommit", page: "isSeeking", content: "false${isStaleSession ? ' (phiên cũ — bỏ qua commit)' : ''}"`);
        if (isStaleSession) return;
        // Cổng seek (event/workflow/player-controls.js::runGatedSeek()) — không `play()` khi seek chưa xong.
        workflowPlayerControls.runGatedSeek(bgVideoElement, this._clampSeekTarget(Number(value)), this._wasPlayingBeforeSeek, VIDEO_SEEK_VERIFY_TOLERANCE_SEC, this.seekGateHooks()); // event/workflow/player-controls.js
    },

    // ===================== Cổng seek cho Video — đóng băng khung hình =====================
    // Cổng (workflowPlayerControls.runGatedSeek(), dùng cho kéo seek, lặp 1 bài, xả hàng đợi lúc pause) nạp lại nguồn để xoá hàng đợi tiếng cũ của iOS -> `<video>` mất khung hình tới khi seek xong. 3 hook dưới che
    // khoảng đó bằng khung vừa chụp ở layer B — cổng không biết gì về layer (nguyên tắc tua vít).

    /** Hook truyền cho `runGatedSeek()` ở MỌI lệnh cổng của Player Video (kéo thanh seek, cử chỉ seek-hold, lặp 1 bài, xả lúc pause).
     * Cổng seek xong là mở tiếng + play() ngay; khung che giữ tới 'playing' THẬT (bỏ che theo readyState thì chớp đen). Video dừng sau cổng (kéo thanh lúc đang dừng, xả lúc pause) thì giữ che cho tới lần phát kế tiếp — đúng khung đó.
     * @returns {{beforeReload: () => Promise<void>, afterSeek: () => void, abort: () => void}} */
    seekGateHooks() {
        return {
            beforeReload: () => this._freezeSeekFrame(),
            afterSeek: () => this._revealSeekFrameOnPlaying(),
            abort: () => this._cancelSeekFreeze(),
        };
    },

    /** Chụp + che (1 lượt cho cả chuỗi lệnh cổng): đã che sẵn (lệnh trước bị thay giữa chừng, hoặc video vẫn đang dừng từ lần
     * cổng trước — video lúc này có thể không có khung để chụp) -> giữ nguyên; đang chụp dở -> đợi chung lượt đó. @returns {Promise<void>} */
    _freezeSeekFrame() {
        if (this._seekFreeze) return Promise.resolve(); // guard — đang che
        if (this._seekFreezePromise) return this._seekFreezePromise; // guard — đang chụp dở, đợi chung
        this._seekFreezePromise = this._captureAndFreezeSeekFrame().finally(() => { this._seekFreezePromise = null; });
        return this._seekFreezePromise;
    },

    async _captureAndFreezeSeekFrame() {
        if (this._swapInProgress) return; // guard — đang đổi video (layer A/B thuộc lượt swap/Transition), không chen vào
        const generation = this._mediaGeneration;
        const url = await this._captureSeekFrameToLayerB();
        if (!url) return; // guard — không chụp được, bỏ che
        if (generation !== this._mediaGeneration) return; // guard — đã đổi video giữa lúc chụp (swap đã thay layer B)
        this._seekFreeze = { generation, layerState: readSeekFreezeLayerState(), cancelOnPlaying: null, cancelOnPlay: null, frameWatch: null }; // core/video-player.js
        applySeekFreezeLayersToDOM(); // core/video-player.js
        await new Promise((resolve) => { taskManager.onceFrame(resolve, 2); }); // service/task-manager.js — khung che đã PAINT rồi mới để cổng load()
    },

    /** Chụp khung hiện tại của video -> layer B (khớp Resolution). Trả object URL đã gắn, null nếu không chụp được (chưa có khung,
     * app đang ẩn — rAF dừng lúc ẩn, decode sẽ treo) hoặc video đã đổi giữa lúc chụp. @returns {Promise<string|null>} */
    async _captureSeekFrameToLayerB() {
        if (!bgVideoElement.videoWidth || !hasMediaCurrentFrame(bgVideoElement.readyState)) return null; // guard — chưa có khung (core/video-player-capture.js)
        if (document.hidden) return null; // guard
        const generation = this._mediaGeneration;
        const naturalSize = { width: bgVideoElement.videoWidth, height: bgVideoElement.videoHeight };
        const canvas = captureVideoFrameToCanvasMaxSide(bgVideoElement, VIDEO_SEEK_FREEZE_MAX_SIDE_PX); // core/video-player-capture.js
        const blob = await canvasToJpegBlob(canvas, VIDEO_SEEK_FREEZE_JPEG_QUALITY); // core/video-player-capture.js
        const url = await this._decodeForcedBgThumb(blob); // decode xong + đợi 2 khung
        if (!url) return null; // guard — mã hoá lỗi
        return SEEK_FRAME_BY_SAME_MEDIA[generation === this._mediaGeneration](url, naturalSize); // đã đổi video giữa lúc chụp -> thu hồi, bỏ
    },

    /** Gắn khung vừa chụp vào layer B (lớp dự phòng tới lượt swap kế tiếp — clearBgVideoSource() tự thu hồi), khớp Resolution
     * theo kích thước video. @returns {string} url */
    _applySeekFrameToLayerB(url, naturalSize) {
        this._replaceForcedBgUrl(url);
        applyVisualBgImageToDOM(true, url); // core/visual-bg-photo.js
        workflowPlayerDisplaySettings.syncVideoPlayerResolutionLayerB(naturalSize); // event/workflow/player-display-settings.js
        return url;
    },

    /** Cổng seek xong (ngay TRƯỚC khi mở tiếng/play()): giao khung che cho 2 tín hiệu "layer A đã có hình thật":
     *   - đang phát: sự kiện 'playing' (cùng mốc `finish()` của swapBgVideoSource()), qua event/workflow/media-wait.js.
     *     Lưới an toàn: đã 'play' mà 2s chưa có 'playing' -> vẫn bỏ che.
     *   - đang dừng: khung ở mốc seek ĐÃ ĐƯỢC TRÌNH CHIẾU lên màn hình — `requestVideoFrameCallback` (chỉ báo khi khung thật sự
     *     đã tới compositor, không đoán theo readyState). Nhờ vậy video dừng không còn che mãi tới lần phát kế tiếp -> lượt đổi video (Next/Prev lúc đang dừng) bắt đầu
     *     Transition từ layer A ĐÃ có hình, không phải từ 1 video chưa vẽ (đen). Trình duyệt không có API này / không báo -> giữ
     *     che tới 'playing' như trên.
     * Gọi lặp (nhiều lệnh cổng nối nhau) vô hại. */
    _revealSeekFrameOnPlaying() {
        const freeze = this._seekFreeze;
        if (!freeze) return; // guard — không che (không chụp được)
        this._watchSeekFramePresented(freeze); // mốc seek mới -> theo dõi lại khung trình chiếu (lệnh cổng trước có thể đã đăng ký)
        if (freeze.cancelOnPlaying) return; // guard — đã giao cho 'playing' từ lệnh cổng trước
        freeze.cancelOnPlaying = workflowMediaWait.once(bgVideoElement, 'playing', () => this._cancelSeekFreeze()); // event/workflow/media-wait.js
        freeze.cancelOnPlay = workflowMediaWait.once(bgVideoElement, 'play', () => taskManager.once(() => this._cancelSeekFreeze(), VIDEO_SEEK_FREEZE_PLAYING_FALLBACK_MS, VIDEO_SEEK_FREEZE_PLAYING_FALLBACK_TASK));
    },

    /** Đăng ký (lại) báo "khung đã trình chiếu" cho khung che đang có. Khung tới lúc video ĐANG DỪNG = khung ở mốc seek đã lên màn
     * hình -> bỏ che. Tới lúc đang phát -> bỏ qua, để 'playing' quyết. @param {object} freeze */
    _watchSeekFramePresented(freeze) {
        this._cancelSeekFrameWatch(freeze);
        freeze.frameWatch = requestVideoFrameOnce(bgVideoElement, () => this._onSeekFramePresented(freeze)); // core/dynamic-object-ui.js — trình duyệt không hỗ trợ: không báo, giữ che tới 'playing'
    },

    /** Khung đã trình chiếu: video đang dừng -> khung ở mốc seek đã lên màn hình, bỏ che. @param {object} freeze */
    _onSeekFramePresented(freeze) {
        freeze.frameWatch = null;
        if (this._seekFreeze !== freeze) return; // guard — khung che này đã bỏ
        if (!bgVideoElement.paused) return; // guard — đang phát: chờ 'playing'
        this._cancelSeekFreeze();
    },

    /** @param {object} freeze */
    _cancelSeekFrameWatch(freeze) {
        if (!freeze.frameWatch) return; // guard
        freeze.frameWatch.cancel();
        freeze.frameWatch = null;
    },

    /** Bỏ che NGAY: trả layer A/B về đúng trạng thái trước khi che + huỷ lượt chờ 'playing'/'play', báo khung, lưới an toàn. Gọi lặp
     * vô hại ('playing', khung đã trình chiếu lúc dừng, cổng huỷ, swap, thoát mode). */
    _cancelSeekFreeze() {
        const freeze = this._seekFreeze;
        if (!freeze) return; // guard
        this._seekFreeze = null;
        SEEK_FREEZE_WAIT_CANCEL_BY_ASSIGNED[!!freeze.cancelOnPlaying](freeze); // chưa giao cho 'playing' -> không có gì để huỷ
        this._cancelSeekFrameWatch(freeze);
        taskManager.kill(VIDEO_SEEK_FREEZE_PLAYING_FALLBACK_TASK);
        restoreSeekFreezeLayersToDOM(freeze.layerState); // core/video-player.js
    },

    /** Kéo thanh seek / cử chỉ seek-hold lúc video CÒN che (đang dừng sau 1 lệnh cổng — layer A trong suốt): xem trước bằng cách
     * chụp lại khung ở mốc scrub vào layer B sau mỗi 'seeked' (chụp từ dữ liệu khung đã giải mã, không phụ thuộc layer A có được vẽ
     * hay chưa). Đang chụp dở mà có mốc mới -> chụp thêm đúng 1 lần sau (mốc mới nhất). */
    _refreshFrozenSeekFrame() {
        if (!this._seekFreeze) return; // guard — không che: layer A tự hiện khung scrub như cũ
        this._watchSeekFramePresented(this._seekFreeze); // khung scrub lên màn hình -> bỏ che, layer A tự xem trước tiếp
        SEEK_FREEZE_REFRESH_BY_BUSY[this._seekFreezeRefreshing]();
    },

    /** Chụp lại khung che; xong mà có mốc mới chờ -> chụp thêm 1 lần. */
    _startSeekFreezeRefresh() {
        this._seekFreezeRefreshing = true;
        this._captureSeekFrameToLayerB().finally(() => {
            this._seekFreezeRefreshing = false;
            if (!this._seekFreezeRefreshPending) return; // guard
            this._seekFreezeRefreshPending = false;
            this._refreshFrozenSeekFrame();
        });
    },

    /** Lặp 1 bài (hết video tự nhiên): cổng seek về 0 rồi CỔNG tự play() — cùng khuôn `_restartSongForRepeatOne()` (event/workflow/
     * player-controls.js). 'pause' lúc 'ended' là THẬT nên cổng thả hold trước khi play -> 'play' THẬT tới UI. */
    restartForRepeatOne() {
        workflowPlayerControls.runGatedSeek(bgVideoElement, 0, true, VIDEO_SEEK_VERIFY_TOLERANCE_SEC, this.seekGateHooks()); // KHÔNG await
    },

    /** Về đầu qua cổng seek, KHÔNG tự phát (Game: Chơi lại / thoát sau khi hết video — xoá đuôi tiếng cũ của iOS). */
    seekToStartGated() {
        workflowPlayerControls.runGatedSeek(bgVideoElement, 0, false, VIDEO_SEEK_VERIFY_TOLERANCE_SEC, this.seekGateHooks()); // KHÔNG await
    },

    /** Xả hàng đợi tiếng iOS NGAY lúc pause (cùng hướng Song, `_flushSongQueueAfterPause()`): nạp lại + seek về chỗ dừng qua cổng
     * (khung đóng băng che lúc nạp lại). Mọi đường phát lại sau đó chỉ là play() thường. Loại trừ: xem shouldFlushVideoQueueOnPause(). */
    async _flushVideoQueueAfterPause() {
        const { currentKey, isVideoPlayerMode, isSeeking } = appState.get(['currentKey', 'isVideoPlayerMode', 'isSeeking']);
        const shouldFlush = shouldFlushVideoQueueOnPause({ // core/video-player.js
            isPaused: bgVideoElement.paused, isEnded: bgVideoElement.ended, isVideoPlayerMode, isSeeking,
            isSwapping: this._swapInProgress, hasFrame: hasMediaCurrentFrame(bgVideoElement.readyState), // core/video-player-capture.js
            currentKey, currentObjectURL: this._objectUrl, mediaSrc: bgVideoElement.src,
        });
        if (!shouldFlush) return;
        const completed = await workflowPlayerControls.runGatedSeek(bgVideoElement, bgVideoElement.currentTime, false, VIDEO_SEEK_VERIFY_TOLERANCE_SEC, this.seekGateHooks());
        // Bấm phát lại NGAY trong lúc cổng đang xả: 'play' bị hold nuốt -> cổng xong mà video đang phát thì gửi lại 'play' cho UI.
        if (!completed || bgVideoElement.paused) return; // guard
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.play', payload: {} });
    },

    /** Huỷ toàn bộ hàng đợi scrub (đầu phiên kéo mới / lúc thả tay). Tăng `_scrubSeq` để lượt chờ/timeout của lệnh đang bay tự bỏ qua. */
    _resetScrubSeek() {
        this._scrubSeq++;
        this._scrubPendingTarget = null;
        this._scrubInFlight = false;
        taskManager.kill(VIDEO_SCRUB_TIMEOUT_TASK);
    },

    /** Xin scrub tới `target` — ghi đè mốc đang chờ (chỉ mốc MỚI NHẤT có nghĩa); không có lệnh nào đang bay thì gửi ngay. */
    _requestScrubSeek(target) {
        this._scrubPendingTarget = target;
        if (!this._scrubInFlight) this._flushScrubSeek();
    },

    /** Gửi 1 lệnh seek chính xác tới mốc đang chờ, đợi 'seeked' (kèm timeout) rồi gửi tiếp mốc mới nhất nếu người dùng đã kéo đi chỗ khác —
     * mỗi lúc chỉ 1 lệnh bay nên seek lùi (nặng) vẫn hoàn tất + vẽ hình, hình cập nhật liên tục theo tốc độ giải mã của máy. */
    _flushScrubSeek() {
        const target = this._scrubPendingTarget;
        if (target === null) return;
        this._scrubPendingTarget = null;
        this._scrubInFlight = true;
        const seq = ++this._scrubSeq;
        const onDone = () => {
            if (seq !== this._scrubSeq) return; // lệnh này đã bị huỷ (thả tay/phiên mới) — bỏ qua
            cancelSeekedWait();
            taskManager.kill(VIDEO_SCRUB_TIMEOUT_TASK);
            this._scrubInFlight = false;
            SCRUB_AFTER_SEEKED_BY_MEDIA_UNCHANGED[this._seekGeneration === this._mediaGeneration](this);
        };
        const cancelSeekedWait = workflowMediaWait.once(bgVideoElement, 'seeked', onDone); // event/workflow/media-wait.js
        taskManager.once(onDone, VIDEO_SCRUB_SEEKED_TIMEOUT_MS, VIDEO_SCRUB_TIMEOUT_TASK);
        seekMediaElement(bgVideoElement, target); // core/media-element-ui.js
    },

    /** Mốc seek đã kẹp xa EOF (clampVideoSeekTarget()) — nhả tay ở cuối lúc đang phát -> video chạy nốt phần còn lại, tự bắn
     * `ended` -> `handleMediaEnded()` -> next như thường. @param {number} value @returns {number} */
    _clampSeekTarget(value) {
        return clampVideoSeekTarget(value, bgVideoElement.duration, VIDEO_SEEK_END_GUARD_SEC); // core/video-player.js
    },
    // Video hết bài: router gọi `workflowPlayerControls.handleMediaEnded()` (dùng chung với Song, kể cả rẽ Game Mode).

    /** Ứng với 'videoPlayer.captureFrame.click' (nút Control Center, chỉ hiện lúc Video Player
     * mode — xem setBgVideoElementForPlayerMode(), core/video-player.js) — chụp khung hình ĐANG
     * PHÁT của `bgVideoElement`, lưu vào thư viện Photo — thân ở event/workflow/video-frame-capture.js (dùng chung với nút
     * Chụp của video-editor.html). `sourceVideoEl` tuỳ chọn; thiếu (Control Center / gesture) -> `bgVideoElement`.
     * @param {HTMLVideoElement} [sourceVideoEl] */
    async captureCurrentFrame(sourceVideoEl) {
        await workflowVideoFrameCapture.captureToPhoto(sourceVideoEl || bgVideoElement); // event/workflow/video-frame-capture.js
    },
};
