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
 * NẠP SAU: core/video-player.js, core/playlist/order.js, service/db.js (getVideoRecord), core/media-element-ui.js,
 * event/workflow/audio-engine.js, event/workflow/player-controls.js, event/workflow/playlist-scope.js,
 * event/workflow/media-wait.js (lúc chạy), core/record-art-ui.js + components/bottom-player.js (#record-art).
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
    _seekFreeze: null,         // { generation, layerState, cancelOnPlaying, cancelOnPlay, frameHandle } lúc đang che; null = không che
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
     * hiện `bgVideoElement` (xem BÀI HỌC ở core/video-player.js — hardware compositing layer trên
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
     *   `decodeForcedBgThumb()` core/video-player.js) làm lớp dự phòng multi-browser cho
     *   `#visual-bg-image` hay không. Video Player mode: `false` lúc vào mode lần đầu (chưa có gì
     *   đang hiện để mà "chớp"), `true` lúc Next/Prev/end. Visual Background: LUÔN `true` (áp lần
     *   đầu cũng cần — thumb đứng yên tới khi video thật sự sẵn sàng, xem docstring
     *   `workflowVisualBg._playVideoKey()`).
     * @param {Function} [beforePlay=null] - hook chạy NGAY TRƯỚC khi gán `poster`/`src`/`play()` —
     *   CHỈ để `playVideoByKey()` chèn `workflowAudioEngine.setup()`/`connectVideoElementToAnalyser()` ĐÚNG
     *   VỊ TRÍ. Visual Background KHÔNG truyền (VBG nối Web Audio LƯỜI ở
     *   `workflowVisualBg._applyVideoAudioSettingToElement()` — chỉ khi Audio B thật sự bật).
     * @param {boolean} [hideUntilReady=false] - ẩn hẳn `bgVideoElement` (`.hidden`, display:none) NGAY TRƯỚC khi đụng
     *   `src` (lúc `#visual-bg-image` đã có thumb full-res PAINT XONG — decodeForcedBgThumb() tự đợi double-rAF), rồi gỡ
     *   `.hidden` khi `_swapReadyPromise` xong ('playing' hoặc timeout 2s). Trên WKWebView/iOS KHÔNG thể che 1 `<video>`
     *   đang hiện bằng lớp ĐÈ LÊN — chỉ lộ được lớp NẰM DƯỚI bằng cách ẩn chính nó (BÀI HỌC ở core/video-player.js).
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
        const swapGeneration = this._mediaGeneration; // chốt để `finish()` (bên dưới) biết lượt swap này đã bị lượt mới hơn/thoát mode thay thế chưa
        // Bỏ khung đóng băng của cổng seek (nếu đang che) TRƯỚC mọi thao tác layer A/B của lượt swap; cổng
        // đang chạy dở tự huỷ khi thấy src đổi. Đánh dấu đang swap: 'pause' ngay dưới không được xả hàng đợi (nạp lại video CŨ).
        this._cancelSeekFreeze();
        this._swapInProgress = true;
        bgVideoElement.pause(); // (1) đứng hình NGAY — CHƯA đụng src, khung hình cũ giữ nguyên
        const record = await getVideoRecord(videoKey); // (2) service/db.js — trong lúc đợi, màn hình vẫn đứng yên ở khung hình cũ
        if (!record) { this._swapInProgress = false; return null; }

        // Lần hiện TĨNH đầu qua cầu thumb (`isSurfaceEntry`): layer A/B đang nằm trên Video surface (Player Video lẫn VBG
        // Video đều mượn, event/workflow/video-motion-surface.js), không Transition, record có `thumbFullBlob` -> decode
        // thumb full-res vào layer B (`#visual-bg-image`), ẨN `bgVideoElement` tới 'playing'. Thiếu `thumbFullBlob` ->
        // không ẩn video (giữ poster).
        const isOnMotionSurface = workflowVideoMotionSurface.isAttached(); // event/workflow/video-motion-surface.js
        const isSurfaceEntry = !isTransition && hideUntilReady && isOnMotionSurface && !!record.thumbFullBlob;
        const hideVideoUntilReady = hideUntilReady && (!isOnMotionSurface || isSurfaceEntry);

        // Lượt swap có Transition layer A (video) / B (ảnh): nơi gọi truyền hook `runTransition`.
        const hasTransitionHook = isTransition && !!(hooks && typeof hooks.runTransition === 'function');

        if ((isTransition || isSurfaceEntry) && record.thumbFullBlob) {
            const forcedUrl = await decodeForcedBgThumb(record.thumbFullBlob); // core/video-player.js — TỰ đợi double-rAF, đảm bảo đã PAINT xong tới đây
            if (this._forcedBgObjectUrl) { try { URL.revokeObjectURL(this._forcedBgObjectUrl); } catch (e) {} }
            this._forcedBgObjectUrl = forcedUrl;
            applyVisualBgImageToDOM(true, forcedUrl); // core/visual-bg.js
            // Layer B vừa đổi nội dung — PHẢI khớp Resolution hiện tại (khoảng hở của video lúc 'trueMax' lộ đúng layer B
            // này). Hook nhận `record` — cần `record.width/height` của video MỚI (bgVideoElement lúc này vẫn mang kích thước
            // video trước).
            if (hooks && typeof hooks.onLayerBFilled === 'function') hooks.onLayerBFilled(record);

            // Lần VÀO mode (không Transition): layer B mang `.motion-layer` (attachVideoPlayerMotionToSharedReactLayer())
            // nên MẶC ĐỊNH opacity:0 — phải gán `.me-current` (opacity 1, z-index 2) thì mới thấy được lúc video bị ẩn.
            // `finish()` bên dưới gỡ lại đúng cặp này khi video thật đã 'playing'.
            if (isSurfaceEntry && visualBgImageElement) visualBgImageElement.classList.add('me-current');

            // Layer B ĐÃ có nội dung MỚI, layer A vẫn đứng hình frame trước (chỉ pause()) — ĐÚNG lúc chạy Transition giữa
            // 2 layer (layer A là frame đóng băng nên an toàn để animate).
            if (hasTransitionHook) await hooks.runTransition(); // hook của nơi gọi
        }

        // Transition xong — ẨN layer A (opacity, khác `hideUntilReady`) trước khi đụng src để không lộ frame trước trong
        // lúc video MỚI buffer; layer B đứng thay chỗ. `transform=''` phòng hờ (class animation đã gỡ).
        if (hasTransitionHook) {
            bgVideoElement.style.opacity = '0';
            bgVideoElement.style.transform = '';
        }

        // Thumb full-res (nếu có) đã PAINT xong — ẩn `bgVideoElement` lộ đúng thumb đó. Thứ tự: pause khung trước -> gán
        // thumb full-res -> ẩn video -> gán src mới -> gỡ ẩn khi sẵn sàng.
        if (hideVideoUntilReady) bgVideoElement.classList.add('hidden');

        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
        this._objectUrl = URL.createObjectURL(record.blob);
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} }
        this._thumbObjectUrl = URL.createObjectURL(record.thumbBlob);

        if (beforePlay) beforePlay(); // sau khi tạo object URL, TRƯỚC khi gán poster/src/play()

        // (3) Gán 1 lần liền mạch — KHÔNG còn khoảng hở giữa các dòng.
        bgVideoElement.poster = this._thumbObjectUrl;
        bgVideoElement.src = this._objectUrl;
        this._swapInProgress = false; // src mới đã gán, hết khoảng cấm xả
        // skipAutoplay (Game Mode armed): chỉ nạp khung hình tĩnh (poster), không .play().
        if (!skipAutoplay) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));

        // z-index của 2 layer do class `.me-current` quyết định (assets/css/motion-engine.css) — cuối Transition layer ảnh giữ
        // `.me-current` (đè lên video). Khi video THẬT sẵn sàng, `revealVideo()` trả `.me-current` về `bgVideoElement` và gỡ
        // khỏi `visualBgImageElement` (ảnh chỉ còn là lớp DỰ PHÒNG) — trạng thái sạch cho lượt Transition kế tiếp.
        this._swapReadyPromise = new Promise((resolve) => {
            let done = false;
            // "Lộ video thật" (gỡ ẩn, trả `.me-current` về layer A, opacity 1) tách khỏi `resolve()` để nhánh skipAutoplay
            // (Game Mode armed) hoãn RIÊNG phần này.
            const revealVideo = () => {
                if (hideVideoUntilReady) bgVideoElement.classList.remove('hidden'); // video thật đã có khung hình (hoặc hết 2s chờ) -> gỡ ẩn, dùng CHUNG đúng 1 mốc sẵn có, không thêm cơ chế chờ riêng
                if (isSurfaceEntry) { // lần hiện TĨNH đầu (vào Player mode / VBG Video hiện video đầu): trả `.me-current` về video, layer B về lớp dự phòng nằm dưới (cùng cặp `finish()` của nhánh Transition ngay dưới)
                    bgVideoElement.classList.add('me-current');
                    if (visualBgImageElement) visualBgImageElement.classList.remove('me-current');
                }
                // Video MỚI đã có khung hình thật (hoặc hết 2s chờ) -> LỘ layer A (opacity 1).
                if (hasTransitionHook) {
                    bgVideoElement.style.opacity = '1';
                    bgVideoElement.classList.add('me-current'); // xem comment trên _swapReadyPromise
                    if (visualBgImageElement) visualBgImageElement.classList.remove('me-current');
                }
            };
            const finish = () => {
                if (done) return;
                done = true;
                // Lần vào Video Player mode: nếu lượt swap này đã bị lượt mới hơn thay thế (Next/Prev/chọn video khác)
                // hoặc đã thoát mode (clearBgVideoSource() đã ẩn + dọn) thì KHÔNG gỡ ẩn/đụng class layer nữa — sẽ hiện
                // video đã bị dọn, hoặc phá state lượt mới (nó tự có `finish()` riêng).
                if (isSurfaceEntry && (swapGeneration !== this._mediaGeneration || !workflowVideoMotionSurface.isAttached())) { resolve(); return; }
                revealVideo();
                resolve();
            };
            if (skipAutoplay) {
                // Không .play() nên 'playing' không tới cho tới lúc _beginPlaying() (event/workflow/gameplay.js) phát sau
                // countdown -> `resolve()` NGAY (waitBgVideoReady() không treo oan 2s), còn `revealVideo()` hoãn tới
                // 'playing' THẬT đầu tiên (lộ sớm thì layer A còn rỗng/đen đè lên thumb full-res). Suốt countdown thumb layer
                // B đứng thay chỗ. KHÔNG timeout fallback (countdown dài hơn 2s). Lượt swap đã bị thay (`_mediaGeneration`)
                // hoặc đã trả Video surface -> bỏ qua.
                done = true;
                resolve();
                workflowMediaWait.once(bgVideoElement, 'playing', () => { // event/workflow/media-wait.js
                    if (swapGeneration !== this._mediaGeneration) return;
                    if (isOnMotionSurface && !workflowVideoMotionSurface.isAttached()) return;
                    revealVideo();
                });
            } else {
                workflowMediaWait.once(bgVideoElement, 'playing', finish); // event/workflow/media-wait.js
                taskManager.once(finish, 2000, 'videoPlayingReadyFallback');
            }
        });

        return record;
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
     * (`record.thumbFullBlob` -> `decodeForcedBgThumb()` -> `applyVisualBgImageToDOM()`), bỏ bước gán `src`/`play()`.
     * @param {string} videoKey
     * @param {((record: object) => void)|null} [onLayerBFilled=null] - HOOK của nơi gọi, CÙNG ý nghĩa hook `onLayerBFilled`
     *   của `swapBgVideoSource()`: gọi NGAY sau khi thumb vừa vào layer B (VBG: khớp `background-size` theo Resolution VBG
     *   + kích thước gốc `record.width/height`).
     * @returns {Promise<boolean>} true nếu hiện được (record tồn tại + có `thumbFullBlob`).
     */
    async showStaticBgThumb(videoKey, onLayerBFilled = null) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record || !record.thumbFullBlob) return false;
        bgVideoElement.pause();
        bgVideoElement.classList.add('hidden');
        bgVideoElement.removeAttribute('poster');
        bgVideoElement.removeAttribute('src');
        bgVideoElement.src = '';
        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} this._thumbObjectUrl = null; }
        const forcedUrl = await decodeForcedBgThumb(record.thumbFullBlob); // core/video-player.js — tự đợi double-rAF, đảm bảo đã PAINT xong
        if (this._forcedBgObjectUrl) { try { URL.revokeObjectURL(this._forcedBgObjectUrl); } catch (e) {} }
        this._forcedBgObjectUrl = forcedUrl;
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
        bgVideoElement.pause();
        bgVideoElement.classList.add('hidden');
        bgVideoElement.removeAttribute('poster');
        bgVideoElement.removeAttribute('src');
        bgVideoElement.src = '';
        // Phòng hờ: thoát giữa lúc `opacity` đang '0' (Transition bị ngắt) thì lần vào mode kế tiếp video KẸT VÔ HÌNH
        // (lượt "vào mode lần đầu" không đụng opacity) — reset ở mọi lần dọn.
        bgVideoElement.style.opacity = '';
        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} this._objectUrl = null; }
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} this._thumbObjectUrl = null; }
        if (this._forcedBgObjectUrl) {
            applyVisualBgImageToDOM(false, ''); // core/visual-bg.js
            try { URL.revokeObjectURL(this._forcedBgObjectUrl); } catch (e) {}
            this._forcedBgObjectUrl = null;
        }
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
        // Video không dùng phụ đề: dọn `subtitles` + khối đang hiện TRƯỚC audioPlayer.pause() (pause còn bắn
        // 'timeupdate' -> sync phụ đề sẽ vẽ lại dòng cũ). Quay lại Song: currentKey null nên playMedia() nạp lại.
        appState.set('subtitles', []);
        workflowSubtitleDisplay.clearAll(); // event/workflow/subtitle-display.js
        const previousSongKey = appState.get('currentKey');
        if (previousSongKey !== null) {
            audioPlayer.pause(); // bắn sự kiện 'pause' NGUYÊN BẢN -> handleAudioPause() (core/player-controls.js, KHÔNG đụng) tự lo icon/wake lock/Media Session cho Song
            appState.set('currentKey', null);
            workflowPlaylistRender.refreshSongNode(previousSongKey); // event/workflow/playlist-render.js — patch riêng đúng 1 hàng, xoá highlight "đang phát"
        }

        visualizerSolidBg.style.backgroundColor = '#000000'; // nền đen cưỡng chế phía sau video — cùng kết quả updateDOMBackground() (core/color-utils.js) cho nhánh video nền
        enterVideoPlayerModeState(); // core/video-player.js — CHỈ còn set isVideoPlayerMode=true
        // Nhường bgVideoElement cho Video Player mode NGAY tại đây (dọn task/object URL/DOM của Visual Background, KHÔNG
        // đụng visualBgConfig đã lưu).
        if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.clearMediaLayers(); // event/workflow/visual-bg.js — liên tuyến domain, ĐỒNG THỜI dừng hẳn Runner React Beat của VBG (workflowVisualBgPhotoMotion.stop()) — đảm bảo motionEngineReactLayer "sạch" (transform rỗng, không task nào chạy) TRƯỚC khi Video Player mode dùng chung nó ngay dưới
        // Mượn Video surface dùng chung (event/workflow/video-motion-surface.js): surface TỰ gắn DOM A/B vào
        // `motionEngineReactLayer` + mượn Stage, rồi Player bật React Beat theo slot 'showing'.
        workflowPlayerDisplaySettings.acquireVideoMotion(); // event/workflow/player-display-settings.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + pointer-events
        workflowPlayerZoom.onPlayerModeEnter('video'); // event/workflow/player-zoom.js — hiện kính lúp Control Center + áp lại zoom/pan đã lưu của Video
        // Resolution của Player Video (không liên quan VBG) — áp NGAY lúc vào mode, đọc từ config đã lưu.
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.applyVideoPlayerResolutionOnEnter(); // event/workflow/player-display-settings.js

        await this.playVideoByKey(startKey, switchScreen);
    },

    /** Thoát Video Player mode: dừng + dọn `bgVideoElement`, trả về mặc định trang trí + khôi phục
     * `#visual-bg-image` về ĐÚNG cài đặt Settings thật (trong lúc ở mode, lớp này bị chèn cưỡng chế
     * thumb của video hiện tại — xem `swapBgVideoSource()` — KHÔNG phản ánh cấu hình Visual
     * Background thật, phải trả lại đúng lúc thoát). `workflowVisualBg.paintSolidBg()` trả `visualizerSolidBg` về đúng
     * màu/gradient cấu hình. */
    async exitVideoPlayerMode() {
        workflowPlayerZoom.onPlayerModeLeave(); // event/workflow/player-zoom.js — tắt Zoom mode + về mức 1 + ẩn kính lúp (ĐỒNG BỘ, trước mọi await)
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, pointer-events mặc định
        // Gỡ override Resolution NGAY lúc thoát mode — BẮT BUỘC, để #bg-video trả về CSS mặc định (object-fit: cover) phục
        // vụ ĐÚNG Visual Background, xem docstring core/player-display-apply.js.
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.clearVideoPlayerResolution(); // event/workflow/player-display-settings.js
        // Trả Video surface: dừng HẲN React Beat/Point Move + gỡ transform, settle Transition còn treo, trả `#bg-video` +
        // `#visual-bg-image` về vị trí "nhà" — BẮT BUỘC TRƯỚC khi VBG tái dùng `motionEngineReactLayer` (ngay dưới).
        workflowPlayerDisplaySettings.releaseVideoMotion(); // event/workflow/player-display-settings.js
        this.clearBgVideoSource(); // dừng + dọn HẲN (pause, ẩn, gỡ src/poster, revoke cả 3 URL) — CƠ CHẾ DÙNG CHUNG
        bgVideoElement.load(); // buộc <video> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)
        workflowVisualBg.paintSolidBg(); // event/workflow/visual-bg-common.js — trả visualizerSolidBg về màu/gradient cấu hình

        // Khôi phục VBG đúng cấu hình (cặp với `clearMediaLayers()` lúc VÀO mode). `restoreAfterPlayerMode()` thay
        // `applyCurrentVisualBg()` vì bản thường tự CHẶN khi đang ở Player mode (isVideoPlayerMode còn `true` tới
        // exitVideoPlayerModeState() ngay dưới).
        if (typeof workflowVisualBg !== 'undefined') await workflowVisualBg.restoreAfterPlayerMode(); // liên tuyến domain

        exitVideoPlayerModeState(); // core/video-player.js
        workflowWakeLock.release(); workflowListenStats.stopClock(); // event/workflow/listen-stats.js — dọn nốt 2 cơ chế đã bật lúc phát
    },

    /** Nạp 1 video vào `bgVideoElement` (DUY NHẤT — xem docstring đầu file) + phát ngay + cập nhật
     * title/artist/MediaSession + nuôi analyser. Cơ chế chống chớp đen ĐÃ TÁCH RIÊNG ở
     * `swapBgVideoSource()`/`waitBgVideoReady()` (dùng chung với Visual Background) — hàm này chỉ
     * còn lo phần RIÊNG của Video Player mode THẬT: currentKey/UI/analyser/wake lock.
     *
     * BỌC `withLoadingShield(..., false)` (không hiện lớp che, CÙNG PATTERN `workflowPlayer.
     * playMedia()`, event/workflow/player.js) — khoá chống bấm Next/Prev chồng lên nhau lúc đang đợi.
     *
     * @param {string} videoKey
     * @param {boolean} [switchScreen=true] - đổi màn hình/cuộn animated sau khi video sẵn sàng —
     *        `true` (bấm 1 dòng trong Playlist/vào mode lần đầu); Next/Prev vật lý truyền `false`.
     * @param {boolean} [isTransition=false] - `true` khi hàm này chạy do Next/Prev/end lúc ĐÃ ở
     *        Video Player mode (event/router/video-player.js truyền vào), `false` lúc vào mode lần
     *        đầu (`startFromPlaylist()` không truyền) — xem docstring `swapBgVideoSource()`.
     * @param {'next'|'prev'} [direction='next'] - truyền THẲNG xuống `swapBgVideoSource()` (resolve preset Transition Next/Prev
     *        RIÊNG) — chỉ có ý nghĩa khi `isTransition===true`.
     */
    async playVideoByKey(videoKey, switchScreen = true, isTransition = false, direction = 'next') {
        // Guard "bấm lại đúng video đang phát" (chỉ đổi màn hình, KHÔNG restart) — 3 vế bắt buộc,
        // không chỉ `videoKey === currentKey`: sau `exitVideoPlayerMode()`, `currentKey` KHÔNG bị
        // xoá theo dù `bgVideoElement` đã mất src thật — phải xác nhận `this._objectUrl` còn khớp
        // đúng src hiện tại mới coi là "đang thật sự phát", tránh bỏ qua nhầm để lại màn đen.
        if (videoKey === appState.get('currentKey') && this._objectUrl && bgVideoElement.getAttribute('src') === this._objectUrl) {
            workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js
            // Game Mode armed: KHÔNG .play() — _beginPlaying() tự phát sau countdown qua 'gameplay.mediaChanged' ngay dưới.
            if (appState.get('gameplayArmedGameId') == null && bgVideoElement.paused) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
            // Return sớm nhưng vẫn gửi 'gameplay.mediaChanged' (cùng lý do event/workflow/player.js).
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
            return;
        }
        return withLoadingShield(t('common.loading.switchingSong'), async () => {
            const previousKey = appState.get('currentKey'); // đọc TRƯỚC khi ghi đè — refresh đúng dòng cũ sau khi video mới sẵn sàng

            // BẮT BUỘC — đảm bảo audioContext/analyser tồn tại (an toàn gọi lại nhiều lần, guard sẵn
            // trong chính 2 hàm) RỒI mới nối bgVideoElement vào — thứ tự ngược sẽ lỗi (analyser chưa
            // có để nối vào). Truyền qua `beforePlay` để chạy ĐÚNG vị trí: sau khi tạo object
            // URL, TRƯỚC khi gán poster/src/play().
            const record = await this.swapBgVideoSource(videoKey, isTransition, () => {
                workflowAudioEngine.setup(); // event/workflow/audio-engine.js — dùng CHUNG với Song/Photo/Visual BG
                // AudioContext mới tạo có thể 'suspended' (video câm + analyser rỗng) -> resume() TƯỜNG MINH (no-op nếu đã chạy).
                appState.get('audioContext').resume().catch(() => {});
                connectVideoElementToAnalyser(); // core/video-player.js
                // `_videoBgGainNode` (core/video-player.js) mặc định gain=0 NGAY LÚC vừa tạo (đúng ý,
                // dùng chung với "Audio B" nền trang trí — workflowVisualBg tự set mức riêng).
                // setVideoBgGain(1) ở setBgVideoElementForPlayerMode(true) chạy lúc node CHƯA tồn tại (no-op) -> gọi LẠI ở
                // đây, sau connectVideoElementToAnalyser() (muted=false không đủ một khi audio đã qua Web Audio graph).
                setVideoBgGain(1); // core/video-player.js
                // Cùng bên Song: kích hoạt lại style hiện tại (canvas WebGL, fftSize/buffers) + dọn trạng thái theo bài, SAU
                // khi audio graph đã nối xong.
                workflowVisualizerRender.activateCurrentStyle(); // event/workflow/visualizer-render.js
                workflowVisualizerRender.resetForNewMedia(); // cùng lý do bên Song
            }, !isTransition, appState.get('gameplayArmedGameId') != null, { // hook: Player tự quyết Transition (preset Next/Prev) + khớp Resolution layer B, xem docstring swapBgVideoSource()
                onLayerBFilled: (record) => workflowPlayerDisplaySettings.syncVideoPlayerResolutionLayerB(record), // event/workflow/player-display-settings.js — kích thước gốc của video MỚI
                runTransition: () => workflowPlayerDisplaySettings.runVideoPlayerTransition(direction), // event/workflow/player-display-settings.js
            }); // hideUntilReady=!isTransition — CHỈ lần VÀO mode (ẩn video tới 'playing', lộ thumb full-res layer B); skipAutoplay khi Game Mode armed
            if (!record) {
                // guard: video vừa bị xoá ở nơi khác giữa lúc đang phát. KHÔNG gọi
                // workflowPlayerControls.goToNextTrack(true) NGAY TẠI ĐÂY — vẫn đang ở TRONG
                // withLoadingShield() này (isShieldBusy chỉ được giải phóng SAU KHI fn() resolve),
                // gọi thẳng sẽ bị CHÍNH shield này im lặng chặn (giống hệt lý do notFoundAlert
                // phải mang cờ ra ngoài ở workflowPlayer.playMedia(), event/workflow/player.js) —
                // mang cờ ra ngoài, xử lý ở .then() bên dưới thay.
                this._skipToNextAfterShield = true;
                return;
            }

            // UI player bottom (currentKey, tên, cover, MediaSession, dòng Playlist, chuyển màn/scroll) đổi NGAY khi
            // `swapBgVideoSource()` trả về (ảnh video MỚI đã decode + Transition xong) — cùng nhịp với hình, không đợi
            // 'playing'. Riêng đếm lượt xem + 'gameplay.mediaChanged' đợi video THẬT sự chạy — xem dưới.
            appState.set('currentKey', videoKey);
            console.log(`writer: "playVideoByKey", page: "currentKey", content: "${videoKey}"`);
            workflowAutoSwitchVisual.onMediaChanged(); // event/workflow/auto-switch-visual.js — nhánh 'perMedia'

            // Tên: ưu tiên tên người dùng tự đặt, filename thì bỏ đuôi mở rộng. Video không có nghệ sĩ; album rỗng thì ô trống chữ.
            setPlayerTrackLabels(record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'), '', record.album || ''); // core/player-controls.js
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'), // xem giải thích ngay trên
                    artist: '',
                    artwork: [],
                });
            }

            // Cover ở player bottom = thumb của video — TÁI DÙNG `this._thumbObjectUrl` (poster) thay vì tạo thêm URL.
            mountRecordArt(recordContainer, renderRecordArtHtml(false), this._thumbObjectUrl, t('videoPlayer.untitled')); // core/record-art-ui.js + components/bottom-player.js

            workflowWakeLock.request();

            if (previousKey && previousKey !== videoKey) workflowPlaylistRender.refreshSongNode(previousKey); // event/workflow/playlist-render.js — dòng video/song TRƯỚC đó, CHỈ khi khác videoKey
            workflowPlaylistRender.refreshSongNode(videoKey); // event/workflow/playlist-render.js — dòng video NÀY, cập nhật isPlaying/eq indicator, đọc bgVideoElement.paused — `.play()` vừa gọi trong swapBgVideoSource() đã đặt paused=false ngay (dù 'playing' chưa bắn; armed Game Mode thì skipAutoplay nên vẫn paused như trước), và handleVideoPlayState() sẽ refresh lại lúc sự kiện 'play' bắn
            workflowPlaylistRender.syncPlayButtonPlayingState(); // event/workflow/playlist-render.js — khớp cả loại media (key trùng giữa các Nguồn)

            workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js — chuyển màn / cuộn Playlist

            // Đợi ĐÚNG lúc video MỚI thật sự có khung hình (sự kiện 'playing') — kèm timeout an toàn
            // (2s) phòng 'playing' không bao giờ bắn (autoplay bị chặn/lỗi định dạng lạ) để không kẹt
            // vĩnh viễn. Vẫn nằm TRONG withLoadingShield() (display=false, chỉ là khoá isShieldBusy) nên
            // Next/Prev bấm dồn trong lúc video đang nạp vẫn bị chặn như cũ.
            await this.waitBgVideoReady();

            // ===== TỪ ĐÂY: video MỚI đã thật sự chạy (hoặc hết 2s chờ) — mới tính lượt phát + báo Game Mode =====
            workflowListenStats.bumpPlayCount('video', videoKey); // event/workflow/listen-stats.js

            // Tín hiệu "media đổi" cho Game Mode (cùng msg.type nhánh Song, event/workflow/player.js) — gửi VÔ ĐIỀU KIỆN.
            // Video không gửi 'visualBg.songChanged' (VBG không hiển thị lúc Video Player mode).
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
        }, false).then(() => {
            if (this._skipToNextAfterShield) {
                this._skipToNextAfterShield = false;
                workflowPlayerControls.goToNextTrack(true); // event/workflow/player-controls.js, dùng CHUNG với Song — gọi SAU khi shield đã đóng hẳn
            }
        });
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
        if (appState.get('activeMediaSource') !== 'video') return;
        const activeFolderIdForVideo = appState.get('activePlayListFolder').video;
        if (activeFolderIdForVideo) await workflowPlaylistScope.applyFolderScope(activeFolderIdForVideo, 'video');
        else await workflowPlaylistScope.applyAllSongsScope('video');
        console.log(`writer: "refreshVideoPlaylistIfActive", page: "playlistOrder", content: "${appState.get('playlistOrder').length} video"`);
    },

    /** Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=true` — toggle
     * `bgVideoElement` (DUY NHẤT — khác bản đầu từng toggle CẢ audioPlayer). */
    togglePlayPauseVideo() {
        workflowWakeLock.request();
        // Phát qua playAfterSeekGate(): bấm phát lại ĐÚNG lúc cổng đang xả hàng đợi sau pause (nạp lại nguồn) thì để cổng
        // play() sau khi seek xong — play() thẳng lúc đó phát từ 0:00 + lọt tiếng đầu video.
        if (bgVideoElement.paused) workflowPlayerControls.playAfterSeekGate(bgVideoElement); // event/workflow/player-controls.js
        else bgVideoElement.pause();
    },

    /** Ứng với 'playerControls.video.play' (sự kiện 'play' NGUYÊN BẢN của `bgVideoElement`, xem
     * event/listener/video-player.js) — đổi icon Play->Pause, bật wake lock/listen clock/Media
     * Session, CÙNG Ý NGHĨA `handleAudioPlay()` (core/player-controls.js) nhưng KHÔNG gọi lại hàm
     * đó (hàm đó đụng `refreshSongNode()`/`syncVideoBgToAudio()` — khái niệm của Song, không áp
     * dụng cho Video — viết bản RIÊNG, gọn hơn). */
    handleVideoPlayState() {
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // play() tạm của cổng seek (event/workflow/player-controls.js)
        iconPlay.classList.add('hidden'); iconPause.classList.remove('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.remove('paused'); // cùng khuôn handleAudioPlay() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        // Vẽ lại dòng Playlist (EQ bars đang phát / chấm đang pause — refreshSongNode() đọc bgVideoElement.paused cho video).
        if (appState.get('currentKey')) workflowPlaylistRender.refreshSongNode(appState.get('currentKey'));
        workflowWakeLock.request(); workflowListenStats.startClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — đồng hồ đổi hiệu ứng chạy theo Video
        workflowPlayerDisplaySettings.resumeVideoMotion(); // Point Move/React Beat chạy tiếp theo video (no-op nếu Player không giữ Video surface), event/workflow/player-display-settings.js
    },

    /** Ứng với 'playerControls.video.pause' — ngược lại `handleVideoPlayState()`. */
    handleVideoPauseState() {
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // pause() tạm của cổng seek
        iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.add('paused'); // cùng khuôn handleAudioPause() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        if (appState.get('currentKey')) workflowPlaylistRender.refreshSongNode(appState.get('currentKey')); // xem handleVideoPlayState()
        workflowWakeLock.release(); workflowListenStats.stopClock(); // event/workflow/listen-stats.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js
        workflowPlayerDisplaySettings.pauseVideoMotion(); // Point Move/React Beat đứng yên cùng video (no-op nếu Player không giữ Video surface), event/workflow/player-display-settings.js
        this._flushVideoQueueAfterPause(); // xả hàng đợi tiếng iOS ngay lúc pause (cùng hướng Song)
    },

    /** Ứng với 'playerControls.video.loadedmetadata' — đặt lại max thanh tiến trình + tổng thời
     * lượng, CÙNG Ý NGHĨA `handleAudioLoadedMetadata()` nhưng đọc `bgVideoElement.duration`. */
    handleVideoLoadedMetadata() {
        progressBar.max = bgVideoElement.duration;
        durationTimeDisplay.textContent = formatTime(bgVideoElement.duration); // core/playlist/state.js
        applyPlaybackSpeedToActiveMedia(true, false, appConfigViz.getAll().playbackSpeed); // core/player-controls.js
        // Cổng seek nạp lại CÙNG video (không phải nội dung mới): chỉ cần áp lại tốc độ (`load()` reset
        // playbackRate) ở trên, KHÔNG chạy lại Point Move từ đầu.
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // guard — event/workflow/player-controls.js
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.syncVideoPlayerPointMove(); // event/workflow/player-display-settings.js — advanceMs cần bgVideoElement.duration, chỉ có ĐÚNG tại đây
    },

    /** Ứng với 'playerControls.video.timeupdate' (bắn rất dày lúc đang phát) — cập nhật thanh tiến
     * trình (nếu không đang kéo tay) + hiển thị thời gian hiện tại, CÙNG Ý NGHĨA
     * `handleAudioTimeUpdate()` nhưng đọc `bgVideoElement.currentTime` (KHÔNG xử lý phụ đề — video
     * không có phụ đề). */
    handleVideoTimeUpdate() {
        // Đang kéo tay thì KHÔNG đụng cả nhãn giờ (scrub xếp hàng làm currentTime chạy sau ngón tay -> nhãn nhấp nháy giữa 2 giá trị)
        if (appState.get('isSeeking')) return;
        if (workflowPlayerControls.isHeldBySeekGate(bgVideoElement)) return; // cổng seek đang nạp lại nguồn, currentTime tạm = 0 (cùng guard Song)
        progressBar.value = bgVideoElement.currentTime; updateProgressBarCSS(); // core/visualizer/visualizer-display.js
        currentTimeDisplay.textContent = formatTime(bgVideoElement.currentTime);
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi `isVideoPlayerMode=true` — người dùng đang
     * kéo tay THANH SEEK — hoặc cử chỉ giữ tay seek-hold ("ngón tay ảo" trên thanh, gửi đúng message này mỗi tick,
     * event/workflow/visualizer-gesture.js). KHÁC
     * `handleProgressBarSeeking()` (Song, chỉ đổi text) — Video có HÌNH để xem trước nên PAUSE +
     * scrub `currentTime` NGAY theo từng nhịp kéo (trình duyệt tự decode/vẽ đúng khung dù đang
     * pause — kỹ thuật scrub chuẩn, không cần xử lý riêng "không bật âm": đang pause thì tiếng tự
     * im). Chỉ pause + ghi nhớ trạng thái trước đó ở TICK ĐẦU TIÊN của phiên kéo (isSeeking false->true) —
     * các tick sau CHỈ còn scrub `currentTime`, không pause lại/không ghi đè `_wasPlayingBeforeSeek`.
     * @param {number} value
     */
    handleVideoSeeking(value) {
        if (!appState.get('isSeeking')) {
            this._wasPlayingBeforeSeek = !bgVideoElement.paused;
            this._seekGeneration = this._mediaGeneration;
            bgVideoElement.pause();
            appState.set('isSeeking', true);
            console.log(`writer: "workflowVideoPlayer.handleVideoSeeking", page: "isSeeking", content: "true"`);
        }
        // Phiên kéo này bắt đầu ở media trước, giữa chừng media đã đổi (ended -> auto-next, bấm Next...) —
        // BỎ QUA tick còn lại, không scrub nhầm lên video mới. `isSeeking` vẫn true tới khi thả tay
        // (handleVideoSeekCommit() dọn), thanh tiến trình video mới chỉ tạm đứng tới lúc đó.
        if (this._seekGeneration !== this._mediaGeneration) return;
        // Scrub = seek CHÍNH XÁC (`currentTime`) nhưng XẾP HÀNG — bắn 1 lệnh mỗi nhịp kéo thì seek LÙI (giải mã lại từ
        // keyframe trước) chưa xong đã bị lệnh kế tiếp huỷ -> hình không kịp vẽ.
        this._requestScrubSeek(this._clampSeekTarget(Number(value)));
        currentTimeDisplay.textContent = formatTime(value);
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
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
        this._seekFreeze = { generation, layerState: readSeekFreezeLayerState(), cancelOnPlaying: null, cancelOnPlay: null, frameHandle: null }; // core/video-player.js
        applySeekFreezeLayersToDOM(); // core/video-player.js
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); // khung che đã PAINT rồi mới để cổng load()
    },

    /** Chụp khung hiện tại của video -> layer B (khớp Resolution). Trả object URL đã gắn, null nếu không chụp được (chưa có khung,
     * app đang ẩn — rAF dừng lúc ẩn, decode sẽ treo) hoặc video đã đổi giữa lúc chụp. @returns {Promise<string|null>} */
    async _captureSeekFrameToLayerB() {
        if (!bgVideoElement.videoWidth || bgVideoElement.readyState < 2) return null; // guard — chưa có khung (HAVE_CURRENT_DATA)
        if (document.hidden) return null; // guard
        const generation = this._mediaGeneration;
        const naturalSize = { width: bgVideoElement.videoWidth, height: bgVideoElement.videoHeight };
        const canvas = captureVideoFrameToCanvasMaxSide(bgVideoElement, VIDEO_SEEK_FREEZE_MAX_SIDE_PX); // core/video-player-capture.js
        const blob = await canvasToJpegBlob(canvas, VIDEO_SEEK_FREEZE_JPEG_QUALITY); // core/video-player-capture.js
        const url = await decodeForcedBgThumb(blob); // core/video-player.js — decode xong + double-rAF
        if (!url) return null; // guard — mã hoá lỗi
        if (generation !== this._mediaGeneration) { URL.revokeObjectURL(url); return null; } // guard — đã đổi video giữa lúc chụp
        if (this._forcedBgObjectUrl) { try { URL.revokeObjectURL(this._forcedBgObjectUrl); } catch (e) {} }
        this._forcedBgObjectUrl = url; // layer B giữ khung này làm lớp dự phòng tới lượt swap kế tiếp (clearBgVideoSource() tự thu hồi)
        applyVisualBgImageToDOM(true, url); // core/visual-bg-photo.js
        workflowPlayerDisplaySettings.syncVideoPlayerResolutionLayerB(naturalSize); // event/workflow/player-display-settings.js — layer B khớp Resolution theo kích thước video
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
        if (typeof bgVideoElement.requestVideoFrameCallback !== 'function') return; // guard — trình duyệt không hỗ trợ
        this._cancelSeekFrameWatch(freeze);
        freeze.frameHandle = bgVideoElement.requestVideoFrameCallback(() => {
            freeze.frameHandle = null;
            if (this._seekFreeze !== freeze) return; // guard — khung che này đã bỏ
            if (!bgVideoElement.paused) return; // guard — đang phát: chờ 'playing'
            this._cancelSeekFreeze();
        });
    },

    /** @param {object} freeze */
    _cancelSeekFrameWatch(freeze) {
        if (freeze.frameHandle === null) return; // guard
        bgVideoElement.cancelVideoFrameCallback(freeze.frameHandle);
        freeze.frameHandle = null;
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
        if (this._seekFreezeRefreshing) { this._seekFreezeRefreshPending = true; return; } // guard — đang chụp
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
            isSwapping: this._swapInProgress, hasFrame: bgVideoElement.readyState >= 2,
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

    /** Kẹp mốc seek tới sát/đúng cuối video về `duration - VIDEO_SEEK_END_GUARD_SEC` — seek KHÔNG
     * được đặt currentTime chạm EOF: `ended` phải là tín hiệu video THẬT SỰ chạy hết (playback),
     * không phải hệ quả của lệnh seek. Nhả tay ở cuối lúc đang phát -> video chạy nốt phần còn lại,
     * tự bắn `ended` -> `handleMediaEnded()` -> next như thường. duration chưa biết -> giữ nguyên.
     * @param {number} value @returns {number} */
    _clampSeekTarget(value) {
        const duration = bgVideoElement.duration;
        if (!Number.isFinite(duration) || duration <= 0) return value;
        return Math.min(value, Math.max(0, duration - VIDEO_SEEK_END_GUARD_SEC));
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
