/**
 * event/workflow/video-player.js — orchestrator (Workflow) cho Video Player mode.
 *
 * Entry point DUY NHẤT vào mode: `startFromPlaylist(startKey)`, gọi từ `workflowPlayer.playMedia()`
 * (event/workflow/player.js — [SỬA, plan-playmedia-reorg.md] thay `window.playSong()` cũ,
 * core/playlist/actions.js) qua eventBus router 'videoPlayer' (event/router/video-player.js —
 * Block gate chặn ở đó). Next/Prev (nút vật lý/cử chỉ vuốt) LUÔN đi qua
 * `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` (event/workflow/player-controls.js —
 * [SỬA] thay `playNext()`/`playPrev()` cũ, core/player-controls.js, ĐÃ XOÁ; Workflow gọi Workflow
 * khác miền, tự do) → `workflowPlayer.playMedia()` → router này lần nữa → VirtualMachineState chọn
 * `playVideoByKey()` (đã ở mode) thay vì `startFromPlaylist()` (vào mode lần đầu).
 * `exitVideoPlayerMode()` có 2 caller: `workflowPlayer.playMedia()` (chọn Song khi đang ở mode) và
 * `workflowPlaylist` (đổi Nguồn).
 *
 * `bgVideoElement` là NGUỒN DUY NHẤT (không `audioPlayer`) — progress bar/current time/duration/
 * seek/play-pause/ended có handler riêng trong file này, đọc/ghi thẳng `bgVideoElement`, gắn qua
 * sự kiện nguyên bản của chính nó (event/listener/video-player.js). Next/Prev/shuffle/repeat DÙNG
 * CHUNG cơ chế Playlist (`displayOrder`/`shuffleIndices`/`currentKey`) — không có mảng/cơ chế
 * riêng cho Video.
 *
 * NẠP SAU: core/video-player.js, core/playlist/order.js (updateShuffleArray/recomputeDisplayOrder/
 * recomputeRenderOrder), service/db.js (getVideoRecord), core/audio-engine.js (setupAudioContext),
 * event/workflow/player-controls.js (`workflowPlayerControls.goToNextTrack()` — dùng ở
 * handleVideoPlayerEnded() bên dưới), event/workflow/playlist-scope.js
 * (`applyFolderScope()`/`applyAllSongsScope()` — dùng ở refreshVideoPlaylistIfActive() bên dưới).
 */
// Khoảng cách tối thiểu (giây) giữ lại trước cuối video khi người dùng kéo/nhả thanh seek tới sát/đúng
// duration — xem `_clampSeekTarget()`. Seek KHÔNG được đặt currentTime chạm EOF (làm `ended` bắn theo
// ĐƯỜNG SEEK thay vì do video THẬT SỰ phát hết, tuỳ engine; và `play()` từ đúng EOF có thể restart về 0).
const VIDEO_SEEK_END_GUARD_SEC = 0.05;

// [MỚI 21/09/2026 — sửa "seek lùi video lệch nhiều + hình không load liên tục"] Video ngắn (10–30s) chỉ có vài
// keyframe -> `fastSeek()` đáp xuống keyframe cách mốc kéo hàng giây. Giờ scrub = seek CHÍNH XÁC nhưng XẾP HÀNG
// (mỗi lần chỉ 1 lệnh seek đang bay, lệnh mới nhất thắng) và lúc thả tay kiểm chứng `currentTime` thật.
const VIDEO_SEEK_VERIFY_TOLERANCE_SEC = 0.15; // sau 'seeked', lệch > mức này so với mốc thả tay -> gán lại (tối đa 3 lần, xem runGatedSeek())
const VIDEO_SCRUB_SEEKED_TIMEOUT_MS = 1500;   // đợi 'seeked' của 1 lệnh scrub tối đa — phòng seek không bao giờ xong để hàng đợi không kẹt
const VIDEO_SCRUB_TIMEOUT_TASK = 'videoScrubSeekedTimeout';

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
    _scrubSeq: 0,              // tăng mỗi lệnh scrub/lần huỷ — listener 'seeked'/timeout của lệnh cũ tự bỏ qua nếu lệch số

    /**
     * Nạp `videoKey` vào `bgVideoElement` — CƠ CHẾ SWAP DUY NHẤT, DÙNG CHUNG giữa Video Player mode
     * THẬT (`playVideoByKey()` bên dưới) và Visual Background TRANG TRÍ (event/workflow/visual-
     * bg.js — liên tuyến domain, KHÔNG tự viết lại logic này nữa, Giang chốt: bỏ hẳn bản VBG tự
     * làm, tránh lệch hành vi/bug lặp lại giữa 2 nơi).
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
     *   CHỈ để `playVideoByKey()` chèn `setupAudioContext()`/`connectVideoElementToAnalyser()` ĐÚNG
     *   VỊ TRÍ như bản gốc. Visual Background KHÔNG truyền (SỬA 09/08/2026, mục 1+2 — nối Web Audio
     *   dời sang `workflowVisualBg._applyVideoAudioSettingToElement()`, chạy TRƯỚC lời gọi này, LƯỜI
     *   — chỉ nối đúng lúc Audio B thật sự bật cho video đó, mặc định câm không đụng Web Audio).
     * @param {boolean} [hideUntilReady=false] - MỚI (08/08/2026, phản hồi Giang — màn đen ở VBG
     *   video slideshow, RIÊNG video cuối `source.list`) — ẩn hẳn `bgVideoElement` (`.hidden`,
     *   display:none) NGAY TRƯỚC khi đụng `src` (đúng lúc `#visual-bg-image` đã có sẵn thumb full-
     *   res PAINT XONG ở bước trên — decodeForcedBgThumb() đã tự đợi double-rAF, KHÔNG cần đợi thêm
     *   gì nữa, xem BÀI HỌC core/video-player.js: KHÔNG thể che 1 `<video>` đang hiện bằng lớp ĐÈ
     *   LÊN TRÊN nó trên WKWebView/iOS — chỉ có thể lộ lớp NẰM DƯỚI bằng cách ẩn hẳn chính nó), rồi
     *   tự gỡ `.hidden` NGAY khi `_swapReadyPromise` xong (sự kiện 'playing' hoặc timeout 2s ĐÃ CÓ
     *   SẴN — không thêm cơ chế chờ nào khác). Video Player mode KHÔNG truyền (mặc định `false`,
     *   giữ NGUYÊN hành vi đang ổn định — Giang chốt lấy nhánh đó làm chuẩn, không đụng) — CHỈ
     *   `workflowVisualBg._playVideoKey()` truyền `true`.
     *   [MỞ RỘNG 21/09/2026] Video Player mode giờ CŨNG truyền `hideUntilReady=true` nhưng CHỈ ở lần VÀO mode
     *   (`isTransition=false`) và chỉ khi record có `thumbFullBlob` — xem `isVideoPlayerModeEntry` ở đầu hàm:
     *   decode thumb full-res vào layer B, ẩn video tới 'playing', KHÔNG Transition. Next/Prev vẫn `false`.
     * @param {boolean} [skipAutoplay=false] - MỚI (08/09/2026, Game Mode gate, phản hồi Giang
     *   "toàn bộ case không được phát trước khi cooldown xong") — gán poster/src NHƯ CŨ nhưng
     *   KHÔNG gọi .play() ở bước (3) — playVideoByKey() truyền true khi phát hiện đang armed Game
     *   Mode (gameplayArmedGameId != null), nhường việc gọi .play() thật cho
     *   workflowGameplay._beginPlaying() (event/workflow/gameplay.js) sau khi countdown xong.
     *   _swapReadyPromise bên dưới TỰ resolve ngay (KHÔNG đợi sự kiện 'playing' — sẽ không bao
     *   giờ bắn tới lúc .play() thật sự chạy) để waitBgVideoReady() không treo oan 2s.
     *   Visual Background KHÔNG truyền (luôn false mặc định — VBG là lớp trang trí, KHÔNG thuộc
     *   phạm vi gate Game Mode, chỉ áp dụng cho media THẬT đang chọn qua Playlist).
     * @param {'next'|'prev'} [direction='next'] - MỚI (Giang yêu cầu Transition Video Player mode)
     *   — CHỈ có ý nghĩa khi `isVideoPlayerMode` (resolve preset Transition Next/Prev RIÊNG, xem
     *   workflowPlayerDisplaySettings::_resolveVideoTransitionPreset()) — Visual Background KHÔNG
     *   truyền (bỏ qua, VBG có hệ Transition riêng của chính nó, không liên quan).
     * @returns {Promise<object|null>} record đã đọc (null nếu không tồn tại — caller tự lo, KHÔNG throw).
     */
    async swapBgVideoSource(videoKey, isTransition = false, beforePlay = null, hideUntilReady = false, skipAutoplay = false, direction = 'next') {
        this._mediaGeneration++; // MỚI (21/09/2026) — vô hiệu hoá mọi phiên seek đang treo của media CŨ, xem handleVideoSeekCommit()
        const swapGeneration = this._mediaGeneration; // chốt để `finish()` (bên dưới) biết lượt swap này đã bị lượt mới hơn/thoát mode thay thế chưa
        bgVideoElement.pause(); // (1) đứng hình NGAY — CHƯA đụng src, khung hình cũ giữ nguyên
        const record = await getVideoRecord(videoKey); // (2) service/db.js — trong lúc đợi, màn hình vẫn đứng yên ở khung hình cũ
        if (!record) return null;

        // MỚI (21/09/2026, yêu cầu Giang) — LẦN VÀO Video Player mode (`isTransition=false`, gọi từ
        // `startFromPlaylist()`) cũng dùng lớp thumb full-res như Next/Prev: decode `thumbFullBlob` vào layer B
        // (`#visual-bg-image`), ẨN `bgVideoElement` cho tới khi 'playing' (lộ đúng layer B nằm dưới) — KHÔNG có
        // animation Transition (không có gì đang hiện để chuyển từ). Bản cũ chỉ dùng `poster = thumbBlob` (ảnh
        // nhỏ) phủ TRÊN layer B nên full-res không bao giờ được thấy. Record cũ thiếu `thumbFullBlob` -> không có
        // gì để lộ, KHÔNG ẩn video (giữ poster như trước). Visual Background (không ở Video Player mode) KHÔNG
        // đổi — `hideUntilReady`/`isTransition` vẫn theo đúng tham số truyền vào.
        const isInVideoPlayerMode = appState.get('isVideoPlayerMode');
        const isVideoPlayerModeEntry = !isTransition && hideUntilReady && isInVideoPlayerMode && !!record.thumbFullBlob;
        const hideVideoUntilReady = hideUntilReady && (!isInVideoPlayerMode || isVideoPlayerModeEntry);

        // MỚI (Giang yêu cầu Transition Video Player mode — "video và bg image là layer A/B, mô
        // hình giống VBG") — CHỈ áp dụng lúc THẬT SỰ đang ở Video Player mode (hàm này DÙNG CHUNG
        // với Visual Background, workflowVisualBg._playVideoKey() — KHÔNG liên quan gì tới Transition
        // của Player, VBG có hệ Transition riêng của chính nó, xem event/workflow/visual-bg-photo-motion.js).
        const isVideoPlayerModeSwap = isTransition && appState.get('isVideoPlayerMode');

        if ((isTransition || isVideoPlayerModeEntry) && record.thumbFullBlob) {
            const forcedUrl = await decodeForcedBgThumb(record.thumbFullBlob); // core/video-player.js — TỰ đợi double-rAF, đảm bảo đã PAINT xong tới đây
            if (this._forcedBgObjectUrl) { try { URL.revokeObjectURL(this._forcedBgObjectUrl); } catch (e) {} }
            this._forcedBgObjectUrl = forcedUrl;
            applyVisualBgImageToDOM(true, forcedUrl); // core/visual-bg.js
            // Layer B (visualBgImageElement, NGANG HÀNG với layer A #bg-video, xem docstring
            // core/player-display-apply.js) vừa đổi nội dung — PHẢI khớp Resolution hiện tại của
            // Video, nếu không khoảng hở của video (lúc Resolution 'fit'/'trueMax') sẽ lộ ra đúng
            // layer B NÀY với kích thước KHÔNG khớp (mặc định luôn 'cover'). CHỈ áp lúc THẬT SỰ
            // đang ở Video Player mode — hàm swapBgVideoSource() này DÙNG CHUNG với Visual
            // Background (workflowVisualBg._playVideoKey()), không liên quan gì tới Resolution của
            // Player.
            if (appState.get('isVideoPlayerMode') && typeof workflowPlayerDisplaySettings !== 'undefined') {
                workflowPlayerDisplaySettings.syncVideoPlayerResolutionLayerB(); // event/workflow/player-display-settings.js
            }

            // Lần VÀO mode (không Transition): layer B mang `.motion-layer` (attachVideoPlayerMotionToSharedReactLayer())
            // nên MẶC ĐỊNH opacity:0 — phải gán `.me-current` (opacity 1, z-index 2) thì mới thấy được lúc video bị ẩn.
            // `finish()` bên dưới gỡ lại đúng cặp này khi video thật đã 'playing'.
            if (isVideoPlayerModeEntry && visualBgImageElement) visualBgImageElement.classList.add('me-current');

            // MỚI (Giang yêu cầu Transition) — layer B ĐÃ có nội dung MỚI (dòng applyVisualBgImageToDOM()
            // ngay trên) — layer A (bgVideoElement) vẫn ĐANG đứng hình frame CŨ (chỉ pause(), CHƯA
            // đụng gì khác) — ĐÚNG lúc để chạy Transition GIỮA 2 layer đó (crossfade/cắt cứng tuỳ
            // preset Next/Prev đang gắn) — "chen vào giữa" bước decode thumb xong và bước phát video
            // mới, đúng như Giang mô tả. Layer A hoàn toàn AN TOÀN để animate/transform ở đây — nó
            // đang là 1 FRAME ĐÓNG BĂNG (video đã pause), KHÔNG phải nội dung đang sống/phát.
            if (isVideoPlayerModeSwap && typeof workflowPlayerDisplaySettings !== 'undefined') {
                await workflowPlayerDisplaySettings.runVideoPlayerTransition(direction); // event/workflow/player-display-settings.js
            }
        }

        // MỚI (Giang yêu cầu Transition) — Transition (nếu có) VỪA kết thúc — layer A giờ "xong
        // việc", ẨN NGAY (opacity, KHÔNG phải `.hidden`/display:none — khác hẳn `hideUntilReady`
        // bên dưới, cơ chế RIÊNG của Video Player mode) trước khi đụng src, để KHÔNG lộ khoảng
        // trống/frame cũ trong lúc video MỚI đang buffer — layer B (đã lộ ra qua Transition ở trên,
        // hoặc vẫn đang hiện nếu preset tắt Transition) đứng thay chỗ. `transform=''` "set cứng về
        // vị trí gốc, không animation" (Giang chỉ ra) — PHÒNG HỜ (finishMotionEngineTransitionVisuals()
        // đã gỡ class animation nên transform lẽ ra đã tự về `none` theo CSS, xem docstring
        // event/workflow/motion-transition-runner.js — dòng này chỉ để chắc chắn tuyệt đối).
        if (isVideoPlayerModeSwap) {
            bgVideoElement.style.opacity = '0';
            bgVideoElement.style.transform = '';
        }

        // Lớp thumb full-res (nếu có) đã PAINT xong ở bước trên — ẩn `bgVideoElement` ngay bây giờ
        // là an toàn, lộ đúng thumb đó (KHÔNG có khoảng đen giữa 2 lớp). Đặt SAU bước chèn thumb,
        // TRƯỚC khi đụng src — đúng thứ tự Giang yêu cầu (pause khung cũ -> gán thumb full res -> ẩn
        // video -> gán src mới -> gỡ ẩn khi sẵn sàng).
        if (hideVideoUntilReady) bgVideoElement.classList.add('hidden');

        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
        this._objectUrl = URL.createObjectURL(record.blob);
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} }
        this._thumbObjectUrl = URL.createObjectURL(record.thumbBlob);

        if (beforePlay) beforePlay(); // ĐÚNG vị trí bản gốc: sau khi tạo object URL, TRƯỚC khi gán poster/src/play()

        // (3) Gán 1 lần liền mạch — KHÔNG còn khoảng hở giữa các dòng.
        bgVideoElement.poster = this._thumbObjectUrl;
        bgVideoElement.src = this._objectUrl;
        // SỬA (08/09/2026, Game Mode gate) — skipAutoplay=true (playVideoByKey() truyền lúc đang
        // armed) bỏ hẳn .play() ở đây, chỉ nạp khung hình tĩnh (poster) — xem docstring tham số
        // skipAutoplay đầu hàm.
        if (!skipAutoplay) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));

        // SỬA (Giang báo bug "video không hiện lại, chỉ còn lớp ảnh full-res đứng mãi") — TRƯỚC ĐÂY
        // comment dưới đây giả định z-index CỐ ĐỊNH `#visual-bg-image:-2` < `#bg-video:0` (base.css)
        // nên "không cần dọn/đổi gì thêm" — giả định đó SAI kể từ khi z-index của 2 layer này được
        // ĐIỀU KHIỂN SỐNG theo class `.me-current`/`.me-layer-enter`/`.me-layer-exit`
        // (assets/css/motion-engine.css, fix trước) — cuối 1 lượt Transition, `visualBgImageElement`
        // LÀ bên giữ `.me-current` (z-index 2), còn `bgVideoElement` chỉ còn `.motion-layer` trơn
        // (z-index 1) — tức layer ẢNH giờ ĐÈ LÊN TRÊN layer VIDEO, dù JS có set lại
        // `bgVideoElement.style.opacity='1'` thì cũng bị ảnh che mất, KHÔNG bao giờ lộ lại. `finish()`
        // dưới đây giờ tự trả `.me-current` VỀ ĐÚNG `bgVideoElement` (video THẬT, giờ đã sẵn sàng/
        // đang phát) VÀ gỡ khỏi `visualBgImageElement` (ảnh full-res chỉ còn là lớp DỰ PHÒNG, không
        // cần đứng "current" nữa) — khôi phục ĐÚNG trật tự z-index (video trên, ảnh dưới) trước khi
        // lượt Transition KẾ TIẾP cần trạng thái sạch này làm điểm xuất phát.
        this._swapReadyPromise = new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                // Lần vào Video Player mode: nếu lượt swap này đã bị lượt mới hơn thay thế (Next/Prev/chọn video khác)
                // hoặc đã thoát mode (clearBgVideoSource() đã ẩn + dọn) thì KHÔNG gỡ ẩn/đụng class layer nữa — sẽ hiện
                // video đã bị dọn, hoặc phá state lượt mới (nó tự có `finish()` riêng).
                if (isVideoPlayerModeEntry && (swapGeneration !== this._mediaGeneration || !appState.get('isVideoPlayerMode'))) { resolve(); return; }
                if (hideVideoUntilReady) bgVideoElement.classList.remove('hidden'); // video thật đã có khung hình (hoặc hết 2s chờ) -> gỡ ẩn, dùng CHUNG đúng 1 mốc sẵn có, không thêm cơ chế chờ riêng
                if (isVideoPlayerModeEntry) { // lần VÀO mode: trả `.me-current` về video, layer B về lớp dự phòng nằm dưới (cùng cặp `finish()` của nhánh Transition ngay dưới)
                    bgVideoElement.classList.add('me-current');
                    if (visualBgImageElement) visualBgImageElement.classList.remove('me-current');
                }
                // MỚI (Giang yêu cầu Transition) — video MỚI đã có khung hình thật (hoặc hết 2s chờ,
                // best-effort — CÙNG mốc `hideUntilReady` dùng, không thêm cơ chế chờ riêng) -> LỘ
                // layer A (opacity 1), đúng bước CUỐI Giang mô tả ("playing check -> ok -> opacity
                // 1 và phát").
                if (isVideoPlayerModeSwap) {
                    bgVideoElement.style.opacity = '1';
                    bgVideoElement.classList.add('me-current'); // FIX — xem comment trên _swapReadyPromise
                    if (visualBgImageElement) visualBgImageElement.classList.remove('me-current');
                }
                resolve();
            };
            if (skipAutoplay) {
                // SỬA (08/09/2026, Game Mode gate) — KHÔNG gọi .play() ở bước (3) nên sự kiện
                // 'playing' sẽ KHÔNG bắn tới lúc _beginPlaying() (event/workflow/gameplay.js) tự
                // .play() sau cooldown — coi "sẵn sàng" NGAY (đã có poster tĩnh), tránh
                // waitBgVideoReady() phía dưới treo oan hết 2s timeout vô ích.
                finish();
            } else {
                bgVideoElement.addEventListener('playing', finish, { once: true });
                taskManager.once(finish, 2000, 'videoPlayingReadyFallback');
            }
        });

        return record;
    },

    /** Đợi khung hình thật (sự kiện 'playing', kèm timeout an toàn 2s) từ lần `swapBgVideoSource()`
     * GẦN NHẤT. Video Player mode LUÔN await (cần biết chắc mới đổi UI); Visual Background KHÔNG
     * await lúc boot/áp lần đầu (fix bug chặn playlist, mục 4 — không ai chờ Promise không await
     * cả, an toàn bỏ qua). */
    async waitBgVideoReady() {
        if (this._swapReadyPromise) await this._swapReadyPromise;
    },

    /** MỚI (09/08/2026, gate resume-play theo Song, phản hồi Giang mục 4) — đợi `bgVideoElement`
     * bắn `'playing'` (hoặc timeout an toàn) cho lần `.play()` KẾ TIẾP. KHÁC `waitBgVideoReady()`
     * ở trên (gắn với `_swapReadyPromise` — CHỈ hợp lệ ngay sau 1 lần `swapBgVideoSource()` thật):
     * hàm NÀY dùng cho case RESUME — `.play()` lại video ĐÃ nạp sẵn, KHÔNG qua swap/đổi `src` nào
     * (vd `workflowVisualBg.syncPlaybackToAudio()` lúc Song phát lại sau pause tạm) — nếu tái dùng
     * `waitBgVideoReady()` cho case này sẽ đọc trúng Promise CŨ đã resolve từ lần swap trước, trả
     * về ngay lập tức, không đợi đúng lần `.play()` MỚI.
     * @param {number} [timeoutMs=2000]
     * @returns {Promise<void>}
     */
    waitForNextPlaying(timeoutMs = 2000) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                bgVideoElement.removeEventListener('playing', finish);
                resolve();
            };
            bgVideoElement.addEventListener('playing', finish, { once: true });
            taskManager.once(finish, timeoutMs, 'visualBgVideoResumePlayingFallback');
        });
    },

    /** MỚI (09/08/2026, gate load video theo Song, phản hồi Giang) — hiện thumb full-res TĨNH của
     * `videoKey` làm nền, KHÔNG chạm `bgVideoElement.src`/`play()` — video THẬT không hề được nạp.
     * Dùng khi VBG `type==='video'` nhưng Song CHƯA thật sự phát (xem
     * `workflowVisualBg._applyVideo()`/`syncPlaybackToAudio()`). Tái dùng ĐÚNG cơ chế lớp thumb dự
     * phòng đã có sẵn trong `swapBgVideoSource()` (`record.thumbFullBlob` ->
     * `decodeForcedBgThumb()` -> `applyVisualBgImageToDOM()`, core/video-player.js +
     * core/visual-bg.js) — KHÔNG viết lại logic decode/paint đó, chỉ bỏ hẳn bước gán `src`/`play()`
     * theo sau (Rule 3c: hàm con phục vụ tái dùng, không phải copy-paste).
     * @param {string} videoKey
     * @returns {Promise<boolean>} true nếu hiện được (record tồn tại + có `thumbFullBlob`).
     */
    async showStaticBgThumb(videoKey) {
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
        this._swapReadyPromise = null;
        return true;
    },

    /** Dừng + dọn HẲN `bgVideoElement` (pause, ẩn, gỡ `src`/`poster`, revoke cả 3 object URL đang
     * giữ) — CƠ CHẾ DÙNG CHUNG giữa `exitVideoPlayerMode()` (thoát mode thật) và Visual Background
     * (dừng nhánh video trang trí, event/workflow/visual-bg.js). KHÔNG đụng muted/loop/pointer-
     * events/currentKey/isVideoPlayerMode/wake-lock — việc riêng của `exitVideoPlayerMode()`. */
    clearBgVideoSource() {
        bgVideoElement.pause();
        bgVideoElement.classList.add('hidden');
        bgVideoElement.removeAttribute('poster');
        bgVideoElement.removeAttribute('src');
        bgVideoElement.src = '';
        // SỬA (Giang yêu cầu Transition Video Player mode) — PHÒNG HỜ: nếu vì lý do gì đó thoát mode
        // giữa lúc `opacity` đang là '0' (transition bị ngắt giữa chừng, lỗi bất ngờ...), video sẽ
        // KẸT VÔ HÌNH vĩnh viễn ở lần vào mode KẾ TIẾP (chỉ lượt swap có `isTransition=true` mới
        // đụng lại opacity, lượt "vào mode lần đầu" thì không) — reset về rỗng ở ĐÂY, gọi ở MỌI lần
        // thoát mode, đảm bảo LUÔN vào lại với trạng thái sạch.
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
     * ===================== Ver 12 "Song/Video Unification" — Batch 2 (mục 3) =====================
     * [SỬA] Entry point DUY NHẤT còn lại để vào Video Player mode — TRƯỚC ĐÂY tên
     * `enterVideoPlayerMode()`, gọi từ `workflowFileManagerVideo.enablePlayerModeFromPanel()`
     * (checkbox "Video Player mode" trong panel File Manager -> Video, ĐÃ BỎ HẲN — xem cleanup mục
     * Batch 2, plan-v12-song-video-unification.md). Checkbox đó là caller DUY NHẤT nên ĐỔI TÊN +
     * ĐỔI CHỮ KÝ luôn tại đây (không phải rewrite hồi tố — hàm chỉ có đúng 1 caller, caller đó vừa
     * bị xoá): giờ nhận `startKey` — videoKey CỤ THỂ vừa được chọn trong Playlist.
     * [SỬA LẦN 2 — Giang chốt: "video thừa hưởng cơ chế Playlist sẵn có, không tạo cơ chế next/
     * prev riêng"] BỎ HẲN việc tự `listVideos()`/`sortVideosByAddedDateDesc()` dựng 1 mảng
     * `videoPlaylist` RIÊNG — Next/Prev giờ đọc THẲNG `displayOrder`/`shuffleIndices` (package
     * `playlist`, đã đúng danh sách + đúng sort mode Video từ Batch 1) qua `workflowPlayerControls.
     * goToNextTrack()`/`goToPrevTrack()` (event/workflow/player-controls.js — [SỬA] thay
     * `playNext()`/`playPrev()` cũ) DÙNG CHUNG với Song, nên hàm NÀY không cần tự dựng gì
     * cho việc đó nữa — chỉ còn lo dọn Song cũ + bật state + phát ĐÚNG video vừa click.
     *
     * FIX (10/09/2026, Giang báo bug "hết bài lúc đang duyệt Playlist Video/Photo bị ép mở
     * Visualizer") — TRƯỚC ĐÂY hàm này LUÔN gọi `playVideoByKey(startKey)` KHÔNG kèm
     * `switchScreen` -> tự rơi về mặc định `true` VÔ ĐIỀU KIỆN, bất kể người GỌI hàm này
     * (event/router/video-player.js) đã tính đúng `switchScreen=false` (Next/Prev vật lý, hoặc
     * auto-next lúc hết bài — xem workflowPlayer.playMedia()) hay chưa — tham số đó bị RỚT MẤT
     * ngay tại điểm "vào mode lần đầu" này. Hệ quả: Song đang phát, đang duyệt Playlist ở Nguồn
     * Video/Photo (KHÔNG đổi màn hình), Song hết bài tự next mà "bài tiếp theo" tính ra lại rơi
     * vào 1 Video/Photo (danh sách Next/Prev dùng chung `displayOrder` đang phản ánh ĐÚNG Nguồn
     * đang duyệt) -> vào Video Player mode LẦN ĐẦU qua `startFromPlaylist()`, ép
     * `switchToVisualizer()` dù đang đứng ở Playlist. Giờ nhận thêm `switchScreen` (mirror ĐÚNG
     * tham số `playVideoByKey()` đã có sẵn) rồi truyền xuống ĐÚNG ý định người gọi.
     * @param {string} startKey - videoKey vừa được chọn để phát.
     * @param {boolean} [switchScreen=true] - đổi màn hình sau khi video sẵn sàng, xem
     *        docstring `playVideoByKey()` — Next/Prev vật lý/auto-next truyền `false`.
     */
    async startFromPlaylist(startKey, switchScreen = true) {
        const previousSongKey = appState.get('currentKey');
        if (previousSongKey !== null) {
            audioPlayer.pause(); // bắn sự kiện 'pause' NGUYÊN BẢN -> handleAudioPause() (core/player-controls.js, KHÔNG đụng) tự lo icon/wake lock/Media Session cho Song
            appState.set('currentKey', null);
            workflowPlaylistRender.refreshSongNode(previousSongKey); // event/workflow/playlist-render.js (dời từ core/playlist/render.js) — patch riêng đúng 1 hàng, xoá highlight "đang phát"
        }

        visualizerSolidBg.style.backgroundColor = '#000000'; // nền đen cưỡng chế phía sau video — cùng kết quả updateDOMBackground() (core/color-utils.js) cho nhánh video nền
        enterVideoPlayerModeState(); // core/video-player.js — CHỈ còn set isVideoPlayerMode=true
        // MỚI (v14, Giang chốt mục 2) — nhường bgVideoElement cho Video Player mode NGAY tại đây
        // (dọn task/object URL/DOM của Visual Background, KHÔNG đụng visualBgConfig đã lưu) — thay
        // cho Block gate cũ từng chặn HẲN việc vào mode này khi Visual Background đang hiện media.
        if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.clearMediaLayers(); // event/workflow/visual-bg.js — liên tuyến domain, ĐỒNG THỜI dừng hẳn Runner React Beat của VBG (workflowVisualBgPhotoMotion.stop()) — đảm bảo motionEngineReactLayer "sạch" (transform rỗng, không task nào chạy) TRƯỚC khi Video Player mode dùng chung nó ngay dưới
        // SỬA (Giang chỉ ra: "React beat, point move khi ở player... phải gán lên 1 lớp cha của nó
        // giống như cấu trúc của hệ thống visual background" — rồi "tôi tưởng motion đã tách khỏi
        // nơi tiêu thụ?") — di chuyển `#bg-video` (qua `videoPlayerMotionPointMoveElement`) VÀO
        // THẲNG `motionEngineReactLayer` — lớp CÓ SẴN, DÙNG CHUNG với VBG (KHÔNG tạo element mới).
        attachVideoPlayerMotionToSharedReactLayer(); // core/player-display-apply.js
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + pointer-events
        // MỚI (Giang yêu cầu "Resolution cho player video&photo, không liên quan VBG") — áp NGAY
        // lúc vào mode, đọc từ config đã lưu (Settings > Visualizer Screen > Player > Video).
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.applyVideoPlayerResolutionOnEnter(); // event/workflow/player-display-settings.js
        // MỚI (Giang yêu cầu "bổ sung backend react — chỉ Video vì Photo không có audio") — bật vòng
        // lặp React Beat NẾU đang có preset gắn cho videoShowingPresetId + preset đó enabled.
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.syncVideoPlayerReactBeat(); // event/workflow/player-display-settings.js

        await this.playVideoByKey(startKey, switchScreen); // FIX (10/09/2026) — truyền ĐÚNG switchScreen của người gọi thay vì luôn mặc định true, xem docstring startFromPlaylist() ở trên
    },

    /** Thoát Video Player mode: dừng + dọn `bgVideoElement`, trả về mặc định trang trí + khôi phục
     * `#visual-bg-image` về ĐÚNG cài đặt Settings thật (trong lúc ở mode, lớp này bị chèn cưỡng chế
     * thumb của video hiện tại — xem `swapBgVideoSource()` — KHÔNG phản ánh cấu hình Visual
     * Background thật, phải trả lại đúng lúc thoát). `updateDOMBackground()` (core/color-utils.js)
     * trả `visualizerSolidBg` về đúng màu/gradient cấu hình. */
    async exitVideoPlayerMode() {
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, pointer-events mặc định
        // MỚI (Giang yêu cầu "Resolution cho player video&photo, không liên quan VBG") — gỡ override
        // NGAY lúc thoát mode — BẮT BUỘC, để #bg-video trả về CSS mặc định (object-fit: cover) phục
        // vụ ĐÚNG Visual Background, xem docstring core/player-display-apply.js.
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.clearVideoPlayerResolution(); // event/workflow/player-display-settings.js
        // MỚI (Giang yêu cầu "bổ sung backend react — chỉ Video") — dừng HẲN vòng lặp React Beat +
        // gỡ transform — BẮT BUỘC, cùng lý do Resolution ngay trên (tránh kẹt transform ảnh hưởng
        // VBG dùng chung `bgVideoElement`).
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.stopVideoPlayerReactBeat(); // event/workflow/player-display-settings.js
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.stopVideoPlayerPointMove(); // event/workflow/player-display-settings.js
        // MỚI (Giang yêu cầu Transition Video Player mode) — huỷ timer dọn dẹp Transition còn treo
        // (nếu vừa Next/Prev xong thoát mode NGAY, chưa kịp settle) — cùng lý do React Beat ngay trên.
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.stopVideoPlayerTransition(); // event/workflow/player-display-settings.js
        // SỬA (cùng lý do attach lúc vào mode, xem startFromPlaylist()) — trả `#bg-video` VỀ ĐÚNG
        // vị trí "nhà" gốc — BẮT BUỘC, TRƯỚC khi VBG tái dùng `motionEngineReactLayer` cho chính nó
        // (applyCurrentVisualBg() ngay dưới) — nếu không, #bg-video (đã ẩn, vô hại hiển thị) vẫn
        // kẹt làm con của layer đó, rò rỉ cấu trúc DOM không cần thiết.
        detachVideoPlayerMotionFromSharedReactLayer(); // core/player-display-apply.js
        this.clearBgVideoSource(); // dừng + dọn HẲN (pause, ẩn, gỡ src/poster, revoke cả 3 URL) — CƠ CHẾ DÙNG CHUNG
        bgVideoElement.load(); // buộc <video> bỏ hẳn tham chiếu blob URL vừa revoke (tránh giữ RAM)
        updateDOMBackground(); // core/color-utils.js, hàm CÓ SẴN — trả visualizerSolidBg về cfg.bgColor

        // SỬA (v14, Giang chốt mục 2) — gọi THẲNG `applyCurrentVisualBg()` (điểm đồng bộ DUY NHẤT
        // của domain, event/workflow/visual-bg.js) — khôi phục ĐÚNG bất kể đang cấu hình gì (video/
        // ảnh đơn/ảnh danh sách), đúng cặp với `clearMediaLayers()` đã gọi lúc VÀO mode ở
        // `startFromPlaylist()`.
        if (typeof workflowVisualBg !== 'undefined') await workflowVisualBg.applyCurrentVisualBg(); // liên tuyến domain

        exitVideoPlayerModeState(); // core/video-player.js
        releaseWakeLock(); stopListenClock(); // core/player-controls.js — dọn nốt 2 cơ chế đã bật lúc phát
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
     * @param {'next'|'prev'} [direction='next'] - MỚI (Giang yêu cầu Transition Video Player mode)
     *        — truyền THẲNG xuống `swapBgVideoSource()` (resolve preset Transition Next/Prev
     *        RIÊNG) — chỉ có ý nghĩa khi `isTransition===true`.
     */
    async playVideoByKey(videoKey, switchScreen = true, isTransition = false, direction = 'next') {
        // Guard "bấm lại đúng video đang phát" (chỉ đổi màn hình, KHÔNG restart) — 3 vế bắt buộc,
        // không chỉ `videoKey === currentKey`: sau `exitVideoPlayerMode()`, `currentKey` KHÔNG bị
        // xoá theo dù `bgVideoElement` đã mất src thật — phải xác nhận `this._objectUrl` còn khớp
        // đúng src hiện tại mới coi là "đang thật sự phát", tránh bỏ qua nhầm để lại màn đen.
        if (videoKey === appState.get('currentKey') && this._objectUrl && bgVideoElement.getAttribute('src') === this._objectUrl) {
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated();
            // SỬA (08/09/2026, Game Mode gate, cùng lý do event/workflow/player.js) — armed thì
            // KHÔNG .play() ở đây kể cả đang pause — _beginPlaying() tự phát sau cooldown qua
            // 'gameplay.mediaChanged' gửi ngay dưới.
            if (appState.get('gameplayArmedGameId') == null && bgVideoElement.paused) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
            // [SỬA — 02/09/2026, cùng lý do event/workflow/player.js] Nhánh "bấm lại đúng video đang
            // phát" `return` NGAY — dòng gửi 'gameplay.mediaChanged' ở cuối hàm (đợt sửa gate
            // `previousKey !== videoKey` hôm trước) KHÔNG BAO GIỜ chạy tới được ở nhánh này.
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
            return;
        }
        return withLoadingShield(t('common.loading.switchingSong'), async () => {
            const previousKey = appState.get('currentKey'); // đọc TRƯỚC khi ghi đè — refresh đúng dòng cũ sau khi video mới sẵn sàng

            // BẮT BUỘC — đảm bảo audioContext/analyser tồn tại (an toàn gọi lại nhiều lần, guard sẵn
            // trong chính 2 hàm) RỒI mới nối bgVideoElement vào — thứ tự ngược sẽ lỗi (analyser chưa
            // có để nối vào). Truyền qua `beforePlay` để chạy ĐÚNG vị trí bản gốc: sau khi tạo object
            // URL, TRƯỚC khi gán poster/src/play() — Visual Background không cần nên không truyền.
            const record = await this.swapBgVideoSource(videoKey, isTransition, () => {
                setupAudioContext(); // core/audio-engine.js — dùng CHUNG với Song/Visual BG, KHÔNG đụng file đó
                // FIX (phản hồi Giang — tách riêng khỏi core/audio-engine.js, CHỈ áp cho luồng Video
                // Player mode, không đụng luồng Visual BG video/Song dùng chung hàm setupAudioContext()
                // ở trên) — nghi vấn: AudioContext mới tạo (lần đầu/phiên) có thể ở 'suspended' tuỳ
                // trình duyệt/thời điểm gesture, khiến video câm + analyser đọc rỗng (BPM/Pitch/Energy
                // không nhảy). resume() TƯỜNG MINH riêng ở ĐÂY — an toàn dù context đã 'running' (no-op).
                appState.get('audioContext').resume().catch(() => {});
                connectVideoElementToAnalyser(); // core/video-player.js
                // `_videoBgGainNode` (core/video-player.js) mặc định gain=0 NGAY LÚC vừa tạo (đúng ý,
                // dùng chung với "Audio B" nền trang trí — workflowVisualBg tự set mức riêng).
                // `setBgVideoElementForPlayerMode(true)` (gọi ở startFromPlaylist(), TRƯỚC dòng này)
                // đã LỠ gọi setVideoBgGain(1) rồi — nhưng lúc đó node CHƯA tồn tại (chỉ tạo ra ở dòng
                // connectVideoElementToAnalyser() ngay trên) nên lệnh đó no-op, gain kẹt ở 0 vĩnh viễn
                // (câm, dù bgVideoElement.muted=false — không đáng tin cậy 1 khi audio đã "chảy" qua
                // Web Audio graph, xem docstring connectVideoElementToAnalyser()). Gọi LẠI ở ĐÂY, ngay
                // sau khi node chắc chắn đã tồn tại — luôn đúng bất kể lần đầu tạo node hay node đã có
                // sẵn từ trước (Next/Prev/vào lại mode).
                setVideoBgGain(1); // core/video-player.js
                // SỬA (phản hồi Giang — "video mode phải chọn lại visualizer mới hiện, đổi video
                // này sang video khác còn mất") — nhánh Song (event/workflow/player.js) gọi
                // `setupAudioContext(); updateTypeUI();` mỗi lần đổi bài; nhánh Video trước đây
                // CHỈ gọi `setupAudioContext()`, không bao giờ gọi `updateTypeUI()` — canvas
                // #webgl-canvas (vortex/connector) không có gì tự làm hiện lại sau khi bị ẩn, và
                // fftSize/allocateBuffers() không được refresh cho video mới. Gọi thêm ở đây,
                // ĐÚNG vị trí tương ứng bên Song (sau khi audio graph đã nối xong).
                updateTypeUI(); // core/visualizer/visualizer-display.js
                resetConnectorPerTrackState(); // core/webgl/three-connector.js — cùng lý do bên Song
            }, !isTransition, appState.get('gameplayArmedGameId') != null, direction); // hideUntilReady=!isTransition — CHỈ lần VÀO mode (SỬA 21/09/2026: ẩn video tới khi 'playing', lộ thumb full-res layer B; Next/Prev đã có Transition lo) — SỬA (08/09/2026) thêm skipAutoplay: armed Game Mode thì chỉ nạp khung hình tĩnh, KHÔNG .play() ở swapBgVideoSource(), xem docstring hàm đó. `direction` MỚI (Giang yêu cầu Transition Video Player mode) — truyền THẲNG xuống, xem docstring swapBgVideoSource().
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

            // [SỬA — 21/09/2026, yêu cầu Giang] UI player bottom (currentKey, tên, cover, MediaSession,
            // dòng Playlist, chuyển màn/scroll) đổi NGAY khi `swapBgVideoSource()` trả về — tức ảnh
            // video MỚI đã decode xong VÀ Transition (nếu preset có) đã chạy xong, video thật vừa được
            // gán src + .play() nhưng CHƯA cần có khung hình. TRƯỚC ĐÂY đợi 'playing' (tối đa 2s) mới đổi UI
            // nên thanh player lệch nhịp so với hình đã đổi. Không có khoảng trống để trình duyệt paint
            // giữa `swapBgVideoSource()` return và đây (chỉ microtask), nên UI đổi cùng nhịp với hình.
            // Riêng `bumpSongPlayCount()` + 'gameplay.mediaChanged' vẫn đợi video THẬT sự chạy — xem dưới.
            appState.set('currentKey', videoKey);
            console.log(`writer: "playVideoByKey", page: "currentKey", content: "${videoKey}"`);

            playerTitle.textContent = record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'); // MỚI (Batch 5, mục 6c) — ưu tiên tên hiển thị người dùng tự đặt; SỬA (phản hồi Giang 28/07) — bỏ đuôi mở rộng khi rơi về filename gốc
            // MỚI (ver12 "Song/Video Unification", Batch 2, mục 3) — artist RỖNG thay vì nhãn
            // "Video Player" cũ, khớp Adapter (Batch 1: playlistCache của Video có tag.artist='') —
            // #player-title/#player-artist dùng CHUNG DOM giữa Playlist/Visualizer nên đồng bộ cả 2 màn.
            playerArtist.textContent = '';
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: record.customName || stripFileExtension(record.filename) || t('videoPlayer.untitled'), // xem giải thích ngay trên
                    artist: '',
                    artwork: [],
                });
            }

            // MỚI (21/07/2026, Giang yêu cầu "chỉnh cover ở player bottom = dùng ảnh thumb của video")
            // — CÙNG khuôn cách Song dựng lại `recordContainer.innerHTML` (core/playlist/actions.js) —
            // dùng `record.thumbBlob` (đã có sẵn từ lúc upload, core/file-manager/video.js) thay
            // `currentCoverObjectURL` của Song. TÁI DÙNG `this._thumbObjectUrl` vừa tạo ở trên
            // (poster) thay vì tạo + revoke thêm 1 object URL riêng cho cùng 1 Blob.
            recordContainer.innerHTML = `<img id="record-art" src="${this._thumbObjectUrl}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 animate-spin-slow" alt="${t('videoPlayer.untitled')}"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;

            requestWakeLock(); // core/player-controls.js — cùng khuôn goToNextTrack()/goToPrevTrack()/togglePlayPause() của Song

            if (previousKey && previousKey !== videoKey) workflowPlaylistRender.refreshSongNode(previousKey); // event/workflow/playlist-render.js (dời từ core/playlist/render.js) — dòng video/song TRƯỚC đó, CHỈ khi khác videoKey
            workflowPlaylistRender.refreshSongNode(videoKey); // event/workflow/playlist-render.js (dời từ core/playlist/render.js) — dòng video NÀY, cập nhật isPlaying/eq indicator, đọc bgVideoElement.paused — `.play()` vừa gọi trong swapBgVideoSource() đã đặt paused=false ngay (dù 'playing' chưa bắn; armed Game Mode thì skipAutoplay nên vẫn paused như trước), và handleVideoPlayState() sẽ refresh lại lúc sự kiện 'play' bắn
            updatePlayButtonPlayingState(appState.get('currentKey'), appState.get('displayOrder')); // core/playlist/render.js — FIX (10/09/2026) Rule 2: Core nhận tham số, không tự appState.get()

            // MỚI (phản hồi Giang 29/07/2026, mục 2 — scroll animated Next/Prev) — dời logic
            // switchToVisualizer()/scrollToCurrentKeyAnimated() vào ĐÂY (TRƯỚC ĐÂY router/
            // startFromPlaylist() tự gọi ngay sau khi gọi hàm này, KHÔNG đợi gì) — [SỬA 21/09/2026] giờ
            // chạy ngay khi ảnh video MỚI đã decode + Transition xong (không đợi 'playing'), khớp yêu
            // cầu "UI chỉ đổi khi hình đã đổi".
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated(); // core/player-controls.js / core/playlist/render.js

            // Đợi ĐÚNG lúc video MỚI thật sự có khung hình (sự kiện 'playing') — kèm timeout an toàn
            // (2s) phòng 'playing' không bao giờ bắn (autoplay bị chặn/lỗi định dạng lạ) để không kẹt
            // vĩnh viễn. Vẫn nằm TRONG withLoadingShield() (display=false, chỉ là khoá isShieldBusy) nên
            // Next/Prev bấm dồn trong lúc video đang nạp vẫn bị chặn như cũ.
            await this.waitBgVideoReady();

            // ===== TỪ ĐÂY: video MỚI đã thật sự chạy (hoặc hết 2s chờ) — mới tính lượt phát + báo Game Mode =====
            // MỚI (phản hồi Giang 28/07/2026) — `bumpSongPlayCount()` (core/listen-stats.js) TRƯỚC
            // ĐÂY CHỈ được gọi trong `workflowPlayer.playMedia()` (event/workflow/player.js) —
            // nhánh Video dispatch ra KHỎI hàm đó TRƯỚC khi tới dòng gọi, nên Play Count chưa
            // từng tăng cho Video. `mediaStatsMap` (core/listen-stats.js) vốn đã key-agnostic nên
            // gọi thẳng ở đây là đủ, không cần sửa gì thêm ở listen-stats.js.
            bumpSongPlayCount(videoKey); // core/listen-stats.js

            // MỚI (phản hồi Giang "visualBg.songChanged liên quan gì tới video play mode?") — tín
            // hiệu "media đổi thật" cho Game Mode, CÙNG msg.type `workflowPlayer.playMedia()`
            // dispatch cho Song (event/workflow/player.js) — Game Mode tự mở khi bài đổi (nếu đang
            // bật) giờ hoạt động ĐÚNG cho Video, KHÔNG đi qua router "visualBg" (video KHÔNG dispatch
            // 'visualBg.songChanged' — VBG không hiển thị lúc Video Player mode, xem event/router/
            // visual-bg.js).
            //
            // [SỬA — 02/09/2026, cùng lý do event/workflow/player.js — bug "exit game mode rồi vào
            // lại ĐÚNG video vừa phát thì không kích hoạt start game"] Bỏ gate `previousKey !==
            // videoKey` — gửi VÔ ĐIỀU KIỆN, cùng lý do đã giải thích ở player.js (playVideoByKey()
            // cũng CHỈ gọi từ hành động "muốn phát" thật của người dùng).
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
        }, false).then(() => {
            if (this._skipToNextAfterShield) {
                this._skipToNextAfterShield = false;
                workflowPlayerControls.goToNextTrack(true); // event/workflow/player-controls.js, dùng CHUNG với Song — gọi SAU khi shield đã đóng hẳn
            }
        });
    },

    /** Làm mới lại Playlist (đọc lại DB) TRONG LÚC đang browse Nguồn Video — gọi khi video được
     * thêm/xoá (nút "Thêm nhạc"/dropdown 3 chấm, event/workflow/file-manager-video.js::uploadVideos())
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
        requestWakeLock(); // core/player-controls.js — cùng khuôn togglePlayPause() của Song
        if (bgVideoElement.paused) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
        else bgVideoElement.pause();
    },

    /** Ứng với 'playerControls.video.play' (sự kiện 'play' NGUYÊN BẢN của `bgVideoElement`, xem
     * event/listener/video-player.js) — đổi icon Play->Pause, bật wake lock/listen clock/Media
     * Session, CÙNG Ý NGHĨA `handleAudioPlay()` (core/player-controls.js) nhưng KHÔNG gọi lại hàm
     * đó (hàm đó đụng `refreshSongNode()`/`syncVideoBgToAudio()` — khái niệm của Song, không áp
     * dụng cho Video — viết bản RIÊNG, gọn hơn). */
    handleVideoPlayState() {
        iconPlay.classList.add('hidden'); iconPause.classList.remove('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.remove('paused'); // cùng khuôn handleAudioPlay() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        // FIX (31/07/2026) — THIẾU dòng này so với handleAudioPlay() (core/player-controls.js) —
        // refreshSongNode() (core/playlist/render.js, ĐÃ video-aware từ ver12 Unification, đọc
        // bgVideoElement.paused cho row mediaType='video') mới là nơi vẽ lại EQ bars (đang phát)
        // hay chấm tròn xanh (đang pause) cho dòng Playlist — thiếu nó khiến dòng đứng yên ở trạng
        // thái lúc `playVideoByKey()` gọi lần cuối (lúc 'playing'), không cập nhật theo Play/Pause.
        if (appState.get('currentKey')) workflowPlaylistRender.refreshSongNode(appState.get('currentKey'));
        requestWakeLock(); startListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.pause' — ngược lại `handleVideoPlayState()`. */
    handleVideoPauseState() {
        iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.add('paused'); // cùng khuôn handleAudioPause() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        if (appState.get('currentKey')) workflowPlaylistRender.refreshSongNode(appState.get('currentKey')); // FIX (31/07/2026) — xem giải thích ở handleVideoPlayState()
        releaseWakeLock(); stopListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.loadedmetadata' — đặt lại max thanh tiến trình + tổng thời
     * lượng, CÙNG Ý NGHĨA `handleAudioLoadedMetadata()` nhưng đọc `bgVideoElement.duration`. */
    handleVideoLoadedMetadata() {
        progressBar.max = bgVideoElement.duration;
        durationTimeDisplay.textContent = formatTime(bgVideoElement.duration); // core/playlist/state.js
        applyPlaybackSpeedToActiveMedia(true, false, appConfigViz.getAll().playbackSpeed); // core/player-controls.js
        if (typeof workflowPlayerDisplaySettings !== 'undefined') workflowPlayerDisplaySettings.syncVideoPlayerPointMove(); // event/workflow/player-display-settings.js — advanceMs cần bgVideoElement.duration, chỉ có ĐÚNG tại đây
    },

    /** Ứng với 'playerControls.video.timeupdate' (bắn rất dày lúc đang phát) — cập nhật thanh tiến
     * trình (nếu không đang kéo tay) + hiển thị thời gian hiện tại, CÙNG Ý NGHĨA
     * `handleAudioTimeUpdate()` nhưng đọc `bgVideoElement.currentTime` (KHÔNG xử lý phụ đề — video
     * không có phụ đề). */
    handleVideoTimeUpdate() {
        // SỬA 21/09/2026 — đang kéo tay thì KHÔNG đụng cả nhãn giờ (scrub xếp hàng làm currentTime chạy sau ngón tay -> nhãn nhấp nháy giữa 2 giá trị)
        if (appState.get('isSeeking')) return;
        progressBar.value = bgVideoElement.currentTime; updateProgressBarCSS(); // core/visualizer/visualizer-display.js
        currentTimeDisplay.textContent = formatTime(bgVideoElement.currentTime);
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi `isVideoPlayerMode=true` — người dùng đang
     * kéo tay THANH SEEK (KHÔNG phải cử chỉ giữ tay — cử chỉ đó có cơ chế pause/resume RIÊNG, xem
     * `_activateSeekHold()`/`_stopSeekHold()`, event/workflow/visualizer-gesture.js). KHÁC
     * `handleProgressBarSeeking()` (Song, chỉ đổi text) — Video có HÌNH để xem trước nên PAUSE +
     * scrub `currentTime` NGAY theo từng nhịp kéo (trình duyệt tự decode/vẽ đúng khung dù đang
     * pause — kỹ thuật scrub chuẩn, không cần xử lý riêng "không bật âm": đang pause thì tiếng tự
     * im). Chỉ pause + ghi nhớ trạng thái CŨ ở TICK ĐẦU TIÊN của phiên kéo (isSeeking false->true) —
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
        // Phiên kéo này bắt đầu ở media CŨ, giữa chừng media đã đổi (ended -> auto-next, bấm Next...) —
        // BỎ QUA tick còn lại, không scrub nhầm lên video mới. `isSeeking` vẫn true tới khi thả tay
        // (handleVideoSeekCommit() dọn), thanh tiến trình video mới chỉ tạm đứng tới lúc đó.
        if (this._seekGeneration !== this._mediaGeneration) return;
        // [SỬA 21/09/2026] Scrub = seek CHÍNH XÁC (`currentTime`) nhưng XẾP HÀNG — bản cũ dùng `fastSeek()` (chỉ tới keyframe,
        // video 10–30s vài keyframe nên lệch hàng giây) và bắn 1 lệnh mỗi nhịp kéo: seek LÙI phải giải mã lại từ keyframe trước
        // nên chưa xong đã bị lệnh kế tiếp huỷ -> hình không kịp vẽ (seek tiến rẻ hơn nên vẫn ra hình liên tục).
        this._requestScrubSeek(this._clampSeekTarget(Number(value)));
        currentTimeDisplay.textContent = formatTime(value);
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi `isVideoPlayerMode=true` — thả tay,
     * commit vị trí cuối cùng + resume phát lại NẾU trước lúc kéo đang phát (không tự ý phát nếu
     * người dùng đã chủ động pause từ trước — xem `handleVideoSeeking()`).
     *
     * [SỬA 21/09/2026 — race "kéo seek video A tới cuối -> B nhảy tới cùng mốc"] Sự kiện `change`
     * của thanh seek tới TRỄ hơn `ended` -> auto-next -> `swapBgVideoSource(B)`, mà `bgVideoElement`
     * là MỘT phần tử dùng chung cho A và B nên lệnh ghi `currentTime` của phiên A rơi nhầm lên B.
     * Giờ mỗi phiên kéo gắn với `_mediaGeneration` lúc bắt đầu — media đã đổi giữa chừng thì chỉ dọn
     * `isSeeking`, KHÔNG đụng currentTime/play của video mới. `null` (không có phiên — commit tới mà
     * chưa từng có 'seeking' ở nhánh Video) cũng coi như phiên cũ: không có gì hợp lệ để commit.
     * @param {number} value
     */
    handleVideoSeekCommit(value) {
        const isStaleSession = this._seekGeneration !== this._mediaGeneration;
        this._seekGeneration = null;
        this._resetScrubSeek(); // huỷ lệnh scrub đang bay/chờ — mốc CUỐI do runGatedSeek() bên dưới lo
        appState.set('isSeeking', false);
        console.log(`writer: "workflowVideoPlayer.handleVideoSeekCommit", page: "isSeeking", content: "false${isStaleSession ? ' (phiên cũ — bỏ qua commit)' : ''}"`);
        if (isStaleSession) return;
        // [SỬA 21/09/2026] Cổng seek: mute -> gán currentTime -> ĐỢI 'seeked' -> play() (nếu trước đó đang phát) ->
        // mở tiếng — không còn `play()` ngay khi seek chưa xong (video/audio lọt vị trí cũ/trung gian).
        workflowPlayerControls.runGatedSeek(bgVideoElement, this._clampSeekTarget(Number(value)), this._wasPlayingBeforeSeek, VIDEO_SEEK_VERIFY_TOLERANCE_SEC); // event/workflow/player-controls.js
    },

    /** Huỷ toàn bộ hàng đợi scrub (đầu phiên kéo mới / lúc thả tay). Tăng `_scrubSeq` để listener/timeout của lệnh đang bay tự bỏ qua. */
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
            bgVideoElement.removeEventListener('seeked', onDone);
            taskManager.kill(VIDEO_SCRUB_TIMEOUT_TASK);
            this._scrubInFlight = false;
            if (this._seekGeneration !== this._mediaGeneration) { this._scrubPendingTarget = null; return; } // media đã đổi giữa lúc kéo
            this._flushScrubSeek(); // còn mốc mới hơn -> gửi tiếp
        };
        bgVideoElement.addEventListener('seeked', onDone, { once: true });
        taskManager.once(onDone, VIDEO_SCRUB_SEEKED_TIMEOUT_MS, VIDEO_SCRUB_TIMEOUT_TASK);
        bgVideoElement.currentTime = target;
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

    // [SỬA — Game Mode + Video Player mode, xử lý triệt để] `handleVideoPlayerEnded()` ĐÃ XOÁ
    // khỏi đây — thân hàm TRÙNG Y HỆT `workflowPlayerControls.handleMediaEnded()` (event/workflow/
    // player-controls.js), chỉ khác object chứa. Router (case 'playerControls.audio.ended'/
    // 'playerControls.video.ended', gộp 1 case DÙNG CHUNG) giờ gọi thẳng
    // `workflowPlayerControls.handleMediaEnded()` cho CẢ 2 msg.type — tránh 2 hàm trùng thân, và
    // ĐỒNG THỜI khiến video.ended giờ CŨNG check gameplayPhase (trước đây audio.ended có
    // VirtualMachineState rẽ sang `workflowGameplay.onSongEnded()` khi đang chơi Game Mode,
    // video.ended KHÔNG hề có — video hết bài lúc đang chơi Game Mode trước đây tự next im lặng,
    // không hiện màn kết quả — nay đã khớp hành vi Song).

    /** Ứng với 'videoPlayer.captureFrame.click' (nút Control Center, chỉ hiện lúc Video Player
     * mode — xem setBgVideoElementForPlayerMode(), core/video-player.js) — chụp khung hình ĐANG
     * PHÁT của `bgVideoElement`, lưu vào thư viện Photo. Tái dùng core/video-player-capture.js
     * (di dời từ core/video-editor/frame-extract.js, nút "Trích xuất ảnh" trong modal Video
     * Preview đã bỏ hẳn — KHÔNG viết lại logic, chỉ đổi nguồn video từ modal sang bgVideoElement).
     * SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — thêm bước gọi
     * `workflowFileManagerPhoto.computePhotoDuration()` (Workflow gọi Workflow miền khác, TỰ DO
     * theo event-bus-flow.md mục 4B) TRƯỚC `saveImage()` — ảnh chụp từ khung hình video CŨNG phải
     * có `duration` như mọi ảnh khác, không có ngoại lệ. `await` thêm `saveImage()` (trước đây
     * fire-and-forget) — cần chờ `computePhotoDuration()` (đọc `blob.arrayBuffer()`) xong TRƯỚC,
     * nên hàm chờ nốt luôn bước ghi record cho gọn 1 mạch async. */
    async captureCurrentFrame() {
        const sourceCanvas = captureVideoFrameToCanvas(bgVideoElement); // core/video-player-capture.js
        const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob) { await alertModal(t('videoPlayer.captureFrame.failed')); return; }
        const thumbBlob = await buildExtractedPhotoThumbnail(sourceCanvas, 0.2); // core/video-player-capture.js
        const filename = `${buildExtractedPhotoFilename()}.jpg`; // core/video-player-capture.js
        const duration = await workflowFileManagerPhoto.computePhotoDuration(blob, sourceCanvas.width, sourceCanvas.height); // event/workflow/file-manager-photo.js
        await saveImage(blob, filename, thumbBlob, sourceCanvas.width, sourceCanvas.height, duration); // core/file-manager/image.js
        await alertModal(t('videoPlayer.captureFrame.success'));
    },

    /**
     * XOÁ (phản hồi Giang — "trước đây có video UI enable phải vào Settings, nên phải ẩn Playlist,
     * switch về Visualizer ngay (bao gồm nút back của main Settings). Bây giờ đã hợp nhất Video &
     * Song vào Playlist nên không cần nữa") — 2 hàm từng ở đây, `handleBackToPlaylistFromVideoMode()`
     * (nút "Back" từ Visualizer → cuộn về Settings thay vì Playlist) và
     * `closeSettingsDrawerToVisualizer()` (nút X Main Settings → ẩn Playlist, chuyển thẳng
     * Visualizer) — CẢ HAI chỉ tồn tại vì Video Player mode TỪNG bật được từ 1 checkbox SÂU trong
     * Settings → File Manager → Video (đã xoá hẳn từ Batch 6, "Song/Video Unification"). Giờ Video
     * LUÔN được chọn TỪ Playlist (y hệt Song, qua dropdown/menu 3 chấm thống nhất) nên KHÔNG còn
     * kịch bản "vừa bật Video Player mode trong lúc đang đứng giữa Settings" nữa — router
     * (event/router/player-controls.js, case 'playerControls.backToPlaylist.click'/
     * 'playerControls.settingsDrawer.close') đã bỏ nhánh VirtualMachineState theo `isVideoPlayerMode`
     * tương ứng, gọi THẲNG hành vi gốc `handleBackToPlaylistClick()`/`workflowPlayerControls.
     * closeSettingsDrawer()` — cả 2 đều LUÔN về Playlist đúng, giống hệt Song.
     */
};
