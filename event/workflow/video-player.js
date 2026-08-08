/**
 * event/workflow/video-player.js — orchestrator (Workflow) cho Video Player mode.
 *
 * Entry point DUY NHẤT vào mode: `startFromPlaylist(startKey)`, gọi từ `window.playSong()`
 * (core/playlist/actions.js) qua eventBus router 'videoPlayer' (event/router/video-player.js —
 * Block gate chặn ở đó). Next/Prev (nút vật lý/cử chỉ vuốt) LUÔN đi qua `playNext()`/`playPrev()`
 * (core/player-controls.js, DÙNG CHUNG với Song) → `window.playSong()` → router này lần nữa →
 * VirtualMachineState chọn `playVideoByKey()` (đã ở mode) thay vì `startFromPlaylist()` (vào mode
 * lần đầu). `exitVideoPlayerMode()` có 2 caller: `window.playSong()` (chọn Song khi đang ở mode)
 * và `workflowPlaylist` (đổi Nguồn).
 *
 * `bgVideoElement` là NGUỒN DUY NHẤT (không `audioPlayer`) — progress bar/current time/duration/
 * seek/play-pause/ended có handler riêng trong file này, đọc/ghi thẳng `bgVideoElement`, gắn qua
 * sự kiện nguyên bản của chính nó (event/listener/video-player.js). Next/Prev/shuffle/repeat DÙNG
 * CHUNG cơ chế Playlist (`displayOrder`/`shuffleIndices`/`currentKey`) — không có mảng/cơ chế
 * riêng cho Video.
 *
 * NẠP SAU: core/video-player.js, core/file-manager/video.js (listVideos), core/playlist/loader.js
 * (buildVideoPlaylistCache), core/playlist/order.js (updateShuffleArray/recomputeDisplayOrder/
 * recomputeRenderOrder), service/db.js (getVideoRecord), core/audio-engine.js (setupAudioContext).
 */
const workflowVideoPlayer = {
    _objectUrl: null, // object URL HIỆN TẠI đang gán cho bgVideoElement (revoke trước khi tạo url mới)
    _thumbObjectUrl: null, // object URL của thumbBlob HIỆN TẠI (poster + cover ở player bar, #record-container) — revoke trước khi tạo url mới
    _forcedBgObjectUrl: null, // object URL của thumbFullBlob đang chèn cưỡng chế vào #visual-bg-image (xem swapBgVideoSource()) — revoke trước khi tạo url mới
    _swapReadyPromise: null, // Promise đợi 'playing' (hoặc timeout) của lần swapBgVideoSource() gần nhất — xem waitBgVideoReady()
    _swipeStartY: null, // toạ độ Y lúc touchstart — dùng bởi event/listener/video-player.js (cử chỉ vuốt)

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
     *   CHỈ để `playVideoByKey()` chèn `setupAudioContext()`/`connectVideoElementToAnalyser()`
     *   ĐÚNG VỊ TRÍ như bản gốc (Visual Background không cần, không truyền).
     * @returns {Promise<object|null>} record đã đọc (`null` nếu không tồn tại — caller tự lo, KHÔNG throw).
     */
    async swapBgVideoSource(videoKey, isTransition = false, beforePlay = null) {
        bgVideoElement.pause(); // (1) đứng hình NGAY — CHƯA đụng src, khung hình cũ giữ nguyên
        const record = await getVideoRecord(videoKey); // (2) service/db.js — trong lúc đợi, màn hình vẫn đứng yên ở khung hình cũ
        if (!record) return null;

        if (isTransition && record.thumbFullBlob) {
            const forcedUrl = await decodeForcedBgThumb(record.thumbFullBlob); // core/video-player.js
            if (this._forcedBgObjectUrl) { try { URL.revokeObjectURL(this._forcedBgObjectUrl); } catch (e) {} }
            this._forcedBgObjectUrl = forcedUrl;
            applyVisualBgImageToDOM(true, forcedUrl); // core/visual-bg.js
        }

        if (this._objectUrl) { try { URL.revokeObjectURL(this._objectUrl); } catch (e) {} }
        this._objectUrl = URL.createObjectURL(record.blob);
        if (this._thumbObjectUrl) { try { URL.revokeObjectURL(this._thumbObjectUrl); } catch (e) {} }
        this._thumbObjectUrl = URL.createObjectURL(record.thumbBlob);

        if (beforePlay) beforePlay(); // ĐÚNG vị trí bản gốc: sau khi tạo object URL, TRƯỚC khi gán poster/src/play()

        // (3) Gán 1 lần liền mạch — KHÔNG còn khoảng hở giữa các dòng.
        bgVideoElement.poster = this._thumbObjectUrl;
        bgVideoElement.src = this._objectUrl;
        bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));

        // KHÔNG dọn/ẩn `_forcedBgObjectUrl` ở đây sau khi 'playing' bắn — GIỮ NGUYÊN quyết định gốc
        // (31/07/2026): cứ để đó, lần transition/swap KẾ TIẾP tự ghi đè (đầu hàm này, guard revoke
        // phía trên) — layer đó z-index -2, NẰM DƯỚI `bgVideoElement` (z-index 0), vô hại khi video
        // đang phát thật đè lên trên, không cần dọn ngay.
        this._swapReadyPromise = new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            bgVideoElement.addEventListener('playing', finish, { once: true });
            taskManager.once(finish, 2000, 'videoPlayingReadyFallback');
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
     * `playlist`, đã đúng danh sách + đúng sort mode Video từ Batch 1) qua `playNext()`/
     * `playPrev()` (core/player-controls.js) DÙNG CHUNG với Song, nên hàm NÀY không cần tự dựng gì
     * cho việc đó nữa — chỉ còn lo dọn Song cũ + bật state + phát ĐÚNG video vừa click.
     * @param {string} startKey - videoKey vừa được chọn để phát.
     */
    async startFromPlaylist(startKey) {
        const previousSongKey = appState.get('currentKey');
        if (previousSongKey !== null) {
            audioPlayer.pause(); // bắn sự kiện 'pause' NGUYÊN BẢN -> handleAudioPause() (core/player-controls.js, KHÔNG đụng) tự lo icon/wake lock/Media Session cho Song
            appState.set('currentKey', null);
            refreshSongNode(previousSongKey); // core/playlist/render.js — patch riêng đúng 1 hàng, xoá highlight "đang phát"
        }

        visualizerSolidBg.style.backgroundColor = '#000000'; // nền đen cưỡng chế phía sau video — cùng kết quả updateDOMBackground() (core/color-utils.js) cho nhánh video nền
        enterVideoPlayerModeState(); // core/video-player.js — CHỈ còn set isVideoPlayerMode=true
        // MỚI (v14, Giang chốt mục 2) — nhường bgVideoElement cho Video Player mode NGAY tại đây
        // (dọn task/object URL/DOM của Visual Background, KHÔNG đụng visualBgConfig đã lưu) — thay
        // cho Block gate cũ từng chặn HẲN việc vào mode này khi Visual Background đang hiện media.
        if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.clearMediaLayers(); // event/workflow/visual-bg.js — liên tuyến domain
        setBgVideoElementForPlayerMode(true); // core/video-player.js — bỏ muted + tắt loop + hiện + pointer-events

        await this.playVideoByKey(startKey); // switchScreen mặc định true — TỰ switchToVisualizer() BÊN TRONG (sau khi video mới thật sự sẵn sàng), xem docstring playVideoByKey()
    },

    /** Thoát Video Player mode: dừng + dọn `bgVideoElement`, trả về mặc định trang trí + khôi phục
     * `#visual-bg-image` về ĐÚNG cài đặt Settings thật (trong lúc ở mode, lớp này bị chèn cưỡng chế
     * thumb của video hiện tại — xem `swapBgVideoSource()` — KHÔNG phản ánh cấu hình Visual
     * Background thật, phải trả lại đúng lúc thoát). `updateDOMBackground()` (core/color-utils.js)
     * trả `visualizerSolidBg` về đúng màu/gradient cấu hình. */
    async exitVideoPlayerMode() {
        setBgVideoElementForPlayerMode(false); // core/video-player.js — trả lại muted+loop=true, pointer-events mặc định
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
     * BỌC `withLoadingShield(..., false)` (không hiện lớp che, CÙNG PATTERN `window.playSong()`,
     * core/playlist/actions.js) — khoá chống bấm Next/Prev chồng lên nhau lúc đang đợi.
     *
     * @param {string} videoKey
     * @param {boolean} [switchScreen=true] - đổi màn hình/cuộn animated sau khi video sẵn sàng —
     *        `true` (bấm 1 dòng trong Playlist/vào mode lần đầu); Next/Prev vật lý truyền `false`.
     * @param {boolean} [isTransition=false] - `true` khi hàm này chạy do Next/Prev/end lúc ĐÃ ở
     *        Video Player mode (event/router/video-player.js truyền vào), `false` lúc vào mode lần
     *        đầu (`startFromPlaylist()` không truyền) — xem docstring `swapBgVideoSource()`.
     */
    async playVideoByKey(videoKey, switchScreen = true, isTransition = false) {
        // Guard "bấm lại đúng video đang phát" (chỉ đổi màn hình, KHÔNG restart) — 3 vế bắt buộc,
        // không chỉ `videoKey === currentKey`: sau `exitVideoPlayerMode()`, `currentKey` KHÔNG bị
        // xoá theo dù `bgVideoElement` đã mất src thật — phải xác nhận `this._objectUrl` còn khớp
        // đúng src hiện tại mới coi là "đang thật sự phát", tránh bỏ qua nhầm để lại màn đen.
        if (videoKey === appState.get('currentKey') && this._objectUrl && bgVideoElement.getAttribute('src') === this._objectUrl) {
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated();
            if (bgVideoElement.paused) bgVideoElement.play().catch((err) => console.error('[video-player] bgVideoElement.play() lỗi:', err));
            return;
        }
        return withLoadingShield(t('common.loading.switchingSong'), async () => {
            const previousKey = appState.get('currentKey'); // đọc TRƯỚC khi ghi đè — refresh đúng dòng cũ sau khi video mới sẵn sàng

            // BẮT BUỘC — đảm bảo audioContext/analyser tồn tại (an toàn gọi lại nhiều lần, guard sẵn
            // trong chính 2 hàm) RỒI mới nối bgVideoElement vào — thứ tự ngược sẽ lỗi (analyser chưa
            // có để nối vào). Truyền qua `beforePlay` để chạy ĐÚNG vị trí bản gốc: sau khi tạo object
            // URL, TRƯỚC khi gán poster/src/play() — Visual Background không cần nên không truyền.
            const record = await this.swapBgVideoSource(videoKey, isTransition, () => {
                setupAudioContext(); // core/audio-engine.js
                connectVideoElementToAnalyser(); // core/video-player.js
            });
            if (!record) {
                // guard: video vừa bị xoá ở nơi khác giữa lúc đang phát. KHÔNG gọi playNext(true)
                // NGAY TẠI ĐÂY — vẫn đang ở TRONG withLoadingShield() này (isShieldBusy chỉ được
                // giải phóng SAU KHI fn() resolve), gọi thẳng sẽ bị CHÍNH shield này im lặng chặn
                // (giống hệt lý do notFoundAlert phải mang cờ ra ngoài ở window.playSong(), core/
                // playlist/actions.js) — mang cờ ra ngoài, xử lý ở .then() bên dưới thay.
                this._skipToNextAfterShield = true;
                return;
            }

            // Đợi ĐÚNG lúc video MỚI thật sự có khung hình (sự kiện 'playing') rồi mới đổi bất kỳ
            // gì lên UI — kèm timeout an toàn (2s) phòng 'playing' không bao giờ bắn (autoplay bị
            // chặn/lỗi định dạng lạ) để không kẹt vĩnh viễn.
            await this.waitBgVideoReady();

            // ===== TỪ ĐÂY: video MỚI đã thật sự hiện ra (hoặc hết 2s chờ) — mới đổi UI =====
            appState.set('currentKey', videoKey);
            console.log(`writer: "playVideoByKey", page: "currentKey", content: "${videoKey}"`);

            // MỚI (phản hồi Giang 28/07/2026) — `bumpSongPlayCount()` (core/listen-stats.js) TRƯỚC
            // ĐÂY CHỈ được gọi trong window.playSong() (core/playlist/actions.js) — nhánh Video
            // dispatch ra KHỎI hàm đó TRƯỚC khi tới dòng gọi, nên Play Count chưa từng tăng cho
            // Video. `songStatsMap` (core/listen-stats.js) vốn đã key-agnostic nên gọi thẳng ở đây
            // là đủ, không cần sửa gì thêm ở listen-stats.js.
            bumpSongPlayCount(videoKey); // core/listen-stats.js

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

            requestWakeLock(); // core/player-controls.js — cùng khuôn playNext()/playPrev()/togglePlayPause() của Song

            if (previousKey && previousKey !== videoKey) refreshSongNode(previousKey); // core/playlist/render.js — dòng video/song TRƯỚC đó, CHỈ khi khác videoKey
            refreshSongNode(videoKey); // core/playlist/render.js — dòng video NÀY, cập nhật isPlaying/eq indicator, ĐỌC ĐÚNG bgVideoElement.paused=false (đã 'playing' ở trên, hoặc hết timeout)
            if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden'); // core/dom-refs.js — hiện tray icon

            // MỚI (phản hồi Giang 29/07/2026, mục 2 — scroll animated Next/Prev) — dời logic
            // switchToVisualizer()/scrollToCurrentKeyAnimated() vào ĐÂY (TRƯỚC ĐÂY router/
            // startFromPlaylist() tự gọi ngay sau khi gọi hàm này, KHÔNG đợi gì) — giờ chạy ĐÚNG
            // lúc video mới đã thật sự sẵn sàng, khớp yêu cầu "UI chỉ đổi khi hình đã đổi".
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated(); // core/player-controls.js / core/playlist/render.js
        }, false).then(() => {
            if (this._skipToNextAfterShield) {
                this._skipToNextAfterShield = false;
                playNext(true); // core/player-controls.js, dùng CHUNG với Song — gọi SAU khi shield đã đóng hẳn
            }
        });
    },

    /** MỚI (21/07/2026, Giang chỉ ra "không cập nhật lại list của video") — làm mới lại Playlist
     * (đọc lại DB) TRONG LÚC đang browse nguồn Video — gọi khi video được thêm/xoá (giờ luôn qua
     * chính Playlist — nút "Thêm nhạc"/dropdown 3 chấm, xem event/workflow/file-manager-video.js::
     * uploadVideos(), Batch 6) MÀ KHÔNG cần đổi Nguồn tắt/bật lại mới thấy video mới.
     * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt "video thừa hưởng cơ chế
     * Playlist, không tạo cơ chế riêng"] TRƯỚC ĐÂY hàm này tự quản lý mảng `videoPlaylist` RIÊNG
     * (đã xoá, xem service/state/video-player-mode.js) — giờ refresh ĐÚNG `playlistCache`/
     * `playlistOrder` hợp nhất (Batch 1: `buildVideoPlaylistCache()`, core/playlist/loader.js),
     * TÁI DÙNG y hệt luồng `switchToVideoSource()` (event/workflow/playlist.js) trừ phần reset sort
     * mode (không cần đổi sort mode đang chọn chỉ vì có video mới). Guard đổi từ `isVideoPlayerMode`
     * sang `activeMediaSource` — đúng điều kiện thật cần refresh (Playlist đang browse Video, KHÔNG
     * nhất thiết đang PHÁT — vd đang ở Settings mà vẫn cần list Playlist đúng khi quay lại). */
    async refreshVideoPlaylistIfActive() {
        if (appState.get('activeMediaSource') !== 'video') return;
        const videoRecords = await listVideos(); // core/file-manager/video.js
        const keys = buildVideoPlaylistCache(videoRecords); // core/playlist/loader.js
        appState.set('playlistOrder', keys);
        console.log(`writer: "refreshVideoPlaylistIfActive", page: "playlistOrder", content: "${keys.length} video"`);
        updateShuffleArray(); // core có sẵn (core/playlist/order.js)
        recomputeDisplayOrder(); // core có sẵn (core/playlist/order.js)
        recomputeRenderOrder(); // core có sẵn (core/playlist/order.js)
        renderPlaylistDiff(); // core có sẵn (core/playlist/render.js)
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
        if (appState.get('currentKey')) refreshSongNode(appState.get('currentKey'));
        requestWakeLock(); startListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.pause' — ngược lại `handleVideoPlayState()`. */
    handleVideoPauseState() {
        iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden');
        const recordArtDynamic = document.getElementById('record-art'); if (recordArtDynamic) recordArtDynamic.classList.add('paused'); // cùng khuôn handleAudioPause() core/player-controls.js
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        if (appState.get('currentKey')) refreshSongNode(appState.get('currentKey')); // FIX (31/07/2026) — xem giải thích ở handleVideoPlayState()
        releaseWakeLock(); stopListenClock(); // core/player-controls.js
    },

    /** Ứng với 'playerControls.video.loadedmetadata' — đặt lại max thanh tiến trình + tổng thời
     * lượng, CÙNG Ý NGHĨA `handleAudioLoadedMetadata()` nhưng đọc `bgVideoElement.duration`. */
    handleVideoLoadedMetadata() {
        progressBar.max = bgVideoElement.duration;
        durationTimeDisplay.textContent = formatTime(bgVideoElement.duration); // core/playlist/state.js
    },

    /** Ứng với 'playerControls.video.timeupdate' (bắn rất dày lúc đang phát) — cập nhật thanh tiến
     * trình (nếu không đang kéo tay) + hiển thị thời gian hiện tại, CÙNG Ý NGHĨA
     * `handleAudioTimeUpdate()` nhưng đọc `bgVideoElement.currentTime` (KHÔNG xử lý phụ đề — video
     * không có phụ đề). */
    handleVideoTimeUpdate() {
        if (!appState.get('isSeeking')) { progressBar.value = bgVideoElement.currentTime; updateProgressBarCSS(); } // core/visualizer/visualizer-display.js
        currentTimeDisplay.textContent = formatTime(bgVideoElement.currentTime);
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi `isVideoPlayerMode=true` — người dùng đang
     * kéo tay, CÙNG Ý NGHĨA `handleProgressBarSeeking()` nhưng không xử lý phụ đề.
     * @param {number} value
     */
    handleVideoSeeking(value) {
        appState.set('isSeeking', true);
        currentTimeDisplay.textContent = formatTime(value);
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi `isVideoPlayerMode=true` — commit vị
     * trí mới THẲNG vào `bgVideoElement.currentTime` (KHÁC bản đầu ghi vào `audioPlayer`).
     * @param {number} value
     */
    handleVideoSeekCommit(value) {
        bgVideoElement.currentTime = value;
        appState.set('isSeeking', false);
    },

    /** Ứng với 'playerControls.video.ended' (sự kiện 'ended' NGUYÊN BẢN của `bgVideoElement` —
     * `loop=false` lúc ở Player mode nên sự kiện này CÓ bắn, xem `setBgVideoElementForPlayerMode()`
     * core/video-player.js) — video hết, tự chuyển video kế tiếp.
     * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt "video thừa hưởng cơ chế
     * Playlist, không tạo cơ chế next riêng"] Gọi `playNext(false)` (core/player-controls.js) —
     * DÙNG CHUNG với Song, THAY `this.nextVideo(false)` riêng đã xoá — tự đọc displayOrder/
     * shuffleIndices/repeatMode, tự gọi lại window.playSong() -> quay lại dispatch mediaType. */
    async handleVideoPlayerEnded() {
        stopListenClock(); // core/player-controls.js, hàm có sẵn — dùng lại nguyên
        playNext(false); // core có sẵn (core/player-controls.js), dùng CHUNG với Song — force=false, tôn trọng repeatMode
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
