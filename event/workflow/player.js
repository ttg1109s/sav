/**
 * event/workflow/player.js — `workflowPlayer.playMedia()`: điểm vào DUY NHẤT để phát 1 item của Playlist (Song/Video/
 * Photo), và `reloadCurrentSongKeepingPosition()` (nạp lại bài đang phát sau khi file bị thay).
 *
 * `workflowPlayer` KHÔNG gắn với 1 Router riêng — Workflow "dùng chung xuyên miền" (TH2, event-bus-flow.md mục 3a), được
 * gọi THẲNG từ:
 *   - `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` (event/workflow/player-controls.js — Next/Prev, hết bài)
 *   - case 'playlist.item.playClick' (event/router/playlist.js)
 *   - 2 nút "Phát"/"Trộn bài" của Playlist rỗng (event/workflow/playlist-empty-state.js)
 * và từ core/player-controls.js (`togglePlayPause()` lúc `currentKey===null`, `handleAudioEnded()`) — Core gọi Workflow
 * là nợ kỹ thuật đã có sẵn, xem docstring từng hàm ở file đó.
 *
 * NẠP SAU: core/playlist/actions.js, core/playlist/render.js (attachCoverFallback), core/playlist/order.js,
 * core/player-controls.js (requestWakeLock), core/listen-stats.js, core/media-element-ui.js, event/workflow/
 * subtitle-display.js (chỉ gọi lúc chạy), event/workflow/audio-engine.js (workflowAudioEngine.setup), event/bus.js,
 * event/workflow/video-player.js, event/workflow/media-wait.js (lúc chạy). NẠP TRƯỚC: event/workflow/player-controls.js,
 * event/router/playlist.js, event/router/playlist-empty-state.js (cả 3 đều gọi `workflowPlayer.playMedia()`).
 */
/** Nạp lại bài đang phát xong: đang phát thì phát tiếp, đang dừng thì để yên. */
const RELOAD_SONG_RESUME_BY_WAS_PLAYING = {
    true: () => playMediaElement(audioPlayer, '[workflow:player] nạp lại —'), // core/media-element-ui.js
    false: () => {},
};

const workflowPlayer = {

    /**
     * `options.switchScreen` (mặc định `true`): CHỈ `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` truyền
     * `false` — Next/Prev và tự chuyển bài khi hết bài KHÔNG cưỡng chế rời Playlist UI. Hàm lớn còn nợ Rule 1/2/3 (sổ
     * vi phạm) — tách nhỏ là việc riêng.
     * @param {string} key
     * @param {{switchScreen?: boolean, direction?: 'next'|'prev'}} [options] - `direction` CHỈ Video/Photo Player mode dùng
     *        (Next/Prev dùng 2 preset Transition riêng), Song bỏ qua.
     */
    playMedia(key, options) {
        // Guard clause theo `cached.mediaType` (buildAdaptedPlaylistCache()): Video/Photo chuyển hẳn sang Player mode của
        // nó; phần còn lại của hàm là luồng Song.
        const cachedForDispatch = appState.get('playlistCache').get(key);

        // Đang ở Photo Player mode mà item MỚI không phải Photo -> thoát mode đó TRƯỚC (1 chỗ cho mọi hướng thoát). KHÔNG
        // `await` — `exitPhotoPlayerMode()` dọn MỌI state ĐỒNG BỘ trước khi trả promise, phần async còn lại chỉ là khôi phục
        // lớp nền VBG. Đích là Video thì KHÔNG khôi phục VBG (`false`): Video Player mode tự chiếm `bgVideoElement`/
        // `#visual-bg-image`, VBG được trả lại lúc thoát Video Player.
        if (appState.get('isPhotoPlayerMode') && (!cachedForDispatch || cachedForDispatch.mediaType !== 'photo')) {
            const isDestinationVideo = !!cachedForDispatch && cachedForDispatch.mediaType === 'video';
            workflowPhotoPlayer.exitPhotoPlayerMode(!isDestinationVideo); // event/workflow/photo-player.js
        }

        if (cachedForDispatch && cachedForDispatch.mediaType === 'video') {
            // Đi qua eventBus (router 'videoPlayer') để Block gate (event/block.js) chặn được — đây là điểm DUY NHẤT phủ MỌI
            // đường vào video (click Playlist, Phát tất cả/Trộn bài/resume, Next/Prev/vuốt). Router tự phân biệt "đã ở mode,
            // chỉ đổi video" hay "vào mode lần đầu" (VirtualMachineState theo isVideoPlayerMode); `switchScreen` gửi kèm để
            // router chuyển màn theo ĐÚNG ý định người gọi.
            const switchScreen = !options || options.switchScreen !== false;
            const direction = (options && options.direction) || 'next'; // mặc định 'next' (tự chuyển khi hết bài, không có "hướng" thật)
            eventBus.send({ router: 'videoPlayer', type: 'videoPlayer.startFromPlaylist.click', payload: { key, switchScreen, direction } });
            return;
        }

        // Photo: cùng khuôn guard Video nhưng KHÔNG qua eventBus/Block gate (Photo không cần khoá chéo) — gọi THẲNG
        // workflowPhotoPlayer (event-bus-flow.md mục 4B). `isPhotoPlayerMode` phân biệt "đã ở mode, chỉ đổi ảnh" hay "vào
        // mode lần đầu".
        if (cachedForDispatch && cachedForDispatch.mediaType === 'photo') {
            const switchScreen = !options || options.switchScreen !== false;
            if (appState.get('isPhotoPlayerMode')) {
                // `direction` chọn slot Transition Next/Prev. Vào mode lần đầu (nhánh dưới) không cần — ảnh đầu hiện tĩnh.
                const direction = (options && options.direction) || 'next';
                workflowPhotoPlayer.playPhotoByKey(key, switchScreen, direction); // event/workflow/photo-player.js — đã ở mode, chỉ đổi ảnh
            } else {
                // Truyền `switchScreen` — tự chuyển bài lúc đang xem Playlist không được ép mở Visualizer.
                workflowPhotoPlayer.startFromPlaylist(key, switchScreen); // event/workflow/photo-player.js — vào mode lần đầu
            }
            return;
        }
        const switchScreen = !options || options.switchScreen !== false;
        // Bấm lại ĐÚNG bài đang load sẵn: return sớm, nhưng vẫn gửi 'gameplay.mediaChanged' (Game Mode đang armed phải tự
        // bắt đầu — cùng lý do dòng gửi ở cuối hàm).
        if (key === appState.get('currentKey')) {
            workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js
            // Game Mode đang armed: KHÔNG .play() ở đây — `gameplay.mediaChanged` kích `workflowGameplay.start()` -> countdown
            // -> `_beginPlaying()` mới phát. Không armed: đang pause thì phát.
            if (appState.get('gameplayArmedGameId') == null && audioPlayer.paused) audioPlayer.play();
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
            return;
        }
        requestWakeLock();

        // display=false: chuyển bài chạy logic trong shield (khoá chồng lệnh) nhưng KHÔNG hiện
        // lớp che -> bỏ cú nháy đen bg-black/80 mỗi lần Next/Prev (rõ nhất khi có video nền).
        //
        // Mọi nơi gọi playMedia() đều fire-and-forget -> `.catch()` cuối chuỗi là lớp bảo vệ cuối: thân hàm throw (vd
        // getSongRecord() reject dù db.js đã tự retry) thì alertModal() đúng nguyên văn lỗi thay vì im lặng không tiếng.
        let notFoundAlert = false; // cờ mang ra ngoài withLoadingShield — KHÔNG await alertModal() ngay trong fn() của shield (xem giải thích dưới)
        return withLoadingShield(t('common.loading.switchingSong'), async () => {
            // AWAIT thoát Video Player mode (gồm tái áp VBG) XONG HẲN trước khi Song bắt đầu phát — không thì video nền
            // còn phát đè lúc bài mới vào.
            if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js

            if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
            if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
            audioPlayer.pause();
            const previousKey = appState.get('currentKey');

            const record = await getSongRecord(key);
            if (!record) {
                workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
                // KHÔNG await alertModal() ở đây — fn() này còn đang
                // chạy TRONG withLoadingShield(), và isShieldBusy chỉ được giải phóng ở finally
                // SAU KHI fn() resolve (xem loading-shield-util.js). alertModal() trả Promise chỉ
                // resolve khi người dùng bấm OK -> nếu await ngay tại đây, #loading-shield (lớp
                // che z-[200], phủ kín màn hình) sẽ TIẾP TỤC hiện + chặn pointer-events suốt thời
                // gian modal đang mở (modalChoice() chỉ z-[130], thấp hơn, nằm DƯỚI lớp che) —
                // người dùng thấy modal nhưng không bấm được nút OK, shield "treo" vô thời hạn vì
                // đang tự chờ chính cái modal mà nó đang che. Đặt cờ, return ngay để fn() (và do
                // đó isShieldBusy) đóng lại HẲN trước, rồi mới hiện modal ở ngoài (xem dưới).
                notFoundAlert = true;
                return;
            }

            appState.set('currentKey', key);
            workflowAutoSwitchVisual.onMediaChanged(); // event/workflow/auto-switch-visual.js — nhánh 'perMedia'
            appState.set('currentCoverObjectURL', record.cover ? URL.createObjectURL(record.cover) : DEFAULT_VINYL);
            appState.set('currentObjectURL', URL.createObjectURL(record.blob));
            audioPlayer.src = appState.get('currentObjectURL');

            playerTitle.textContent = record.tag.title; playerArtist.textContent = record.tag.artist;
            recordContainer.innerHTML = `<img id="record-art" src="${appState.get('currentCoverObjectURL')}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 ${audioPlayer.paused ? 'paused' : 'animate-spin-slow'}" alt="Record"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;
            // Cover Blob có thể không decode được (ID3 lỗi/cắt cụt) -> attachCoverFallback() (render.js) tự về DEFAULT_VINYL.
            attachCoverFallback(document.getElementById('record-art'));

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: record.tag.title || "Visual Master",
                    artist: record.tag.artist || "Unknown Artist",
                    // MIME thật của cover (khai sai MIME thì màn hình khoá có thể không hiện artwork); 'image/jpeg' chỉ khi rỗng.
                    artwork: record.cover ? [{ src: appState.get('currentCoverObjectURL'), sizes: '512x512', type: record.cover.type || 'image/jpeg' }] : []
                });
            }

            workflowListenStats.bumpPlayCount('song', key); // event/workflow/listen-stats.js — +1 số lần nghe ngay khi bắt đầu phát bài mới

            // Game Mode armed: KHÔNG .play() — `_beginPlaying()` (event/workflow/gameplay.js) phát sau countdown. Chuyển màn
            // Visualizer không phụ thuộc Game Mode. Next/Prev (switchScreen=false) cuộn Playlist tới bài mới — SAU
            // refreshSongNode()/renderPlaylistDiff() để node của `key` chắc chắn đã có.
            if (appState.get('gameplayArmedGameId') == null) audioPlayer.play();
            workflowPlayerControls.switchToVisualizerIfRequested(switchScreen); // event/workflow/player-controls.js
            if (previousKey) workflowPlaylistRender.refreshSongNode(previousKey);
            workflowPlaylistRender.refreshSongNode(key);
            if (!appState.get('domNodesByKey').has(key)) workflowPlaylistRender.renderPlaylistDiff();
            if (!switchScreen) workflowPlaylistRender.scrollToCurrentOrDefer();
            workflowPlaylistRender.syncPlayButtonPlayingState(); // event/workflow/playlist-render.js — khớp cả loại media (key trùng giữa các Nguồn)
            appState.set('raindrops', []); appState.set('ripples', []); appState.set('glassStaticDrops', []); appState.set('glassStreaks', []); appState.set('activeLightnings', []);
            workflowVisualizerRender.resetForNewMedia(); // event/workflow/visualizer-render.js — mọi group (và phân tích audio) dọn trạng thái theo bài
            workflowAudioEngine.setup(); workflowVisualizerRender.activateCurrentStyle();

            appState.set('subtitles', record.subtitles ? record.subtitles.slice() : []);
            workflowSubtitleDisplay.clearAll(); // event/workflow/subtitle-display.js — dọn khối phụ đề + karaoke bài cũ

            // Báo domain "Visual Background" bài vừa ĐỔI THẬT (so KEY — seek trong cùng bài không tính). Đây là NƠI DUY NHẤT
            // biết chắc bài vừa đổi (next/prev/hết bài/chọn bài khác đều đi qua hàm này).
            // Gửi QUA BUS (không gọi thẳng Workflow): việc quyết định nguồn nền nào cần phản
            // ứng là rẽ nhánh theo state -> thuộc tầng Router, xử lý bằng
            // `VirtualMachineState.run()` ở event/router/visual-bg.js.
            if (previousKey !== key) eventBus.send({ router: 'visualBg', type: 'visualBg.songChanged', payload: {} });
            // Tín hiệu "media đổi" cho Game Mode (router "gameplay", tách khỏi 'visualBg.songChanged'; nhánh Video gửi ở
            // workflowVideoPlayer.playVideoByKey()). Gửi VÔ ĐIỀU KIỆN — playMedia() chỉ chạy từ hành động "muốn phát" thật,
            // phát lại ĐÚNG bài vẫn phải kích Game Mode đang armed.
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
        }, false).then(async () => {
            // Shield đã đóng HẲN (isShieldBusy = false) tới đây — an toàn để hiện modal, không
            // còn lớp che z-[200] nào đè lên modalChoice() (z-[130]) nữa.
            if (notFoundAlert) await alertModal(t('common.playSong.notFound'));
        }).catch(async err => {
            console.error(`[workflow:player] playMedia("${key}") lỗi không xác định, nhạc có thể không phát ra tiếng được:`, err);
            const rawMsg = `${err && err.name ? err.name + ': ' : ''}${err && err.message ? err.message : String(err)}`;
            await alertModal(tFormat('common.playSong.error', { message: escapeHtml(rawMsg) }));
        });
    },

    /**
     * Nạp lại bài ĐANG load trong audioPlayer từ DB sau khi file của nó
     * vừa bị thay (upload ghi đè trùng tên) — GIỮ vị trí phát + trạng thái phát/dừng, làm mới cover/tiêu đề. CHỈ gọi
     * từ request trung tâm `workflowMediaInUse` (event/workflow/media-in-use.js) — nơi đó đã kiểm state "bài này đang
     * nạp ở Player chính". KHÔNG đếm lượt nghe, không báo 'visualBg.songChanged'/'gameplay.mediaChanged' (cùng 1 bài).
     */
    async reloadCurrentSongKeepingPosition() {
        const { currentKey: key, currentObjectURL: oldUrl } = appState.get(['currentKey', 'currentObjectURL']);
        const record = await getMediaRecord('song', key); // service/db.js
        if (!record || !record.blob) return; // guard: bài vừa bị xoá ở nơi khác
        const resumeAtSec = audioPlayer.currentTime;
        const wasPlaying = !audioPlayer.paused;
        const newUrl = createBlobUrl(record.blob); // service/blob-url.js
        appState.set('currentObjectURL', newUrl);
        console.log(`writer: "workflowPlayer.reloadCurrentSongKeepingPosition", page: "currentObjectURL", content: "${key} — nạp lại tại ${resumeAtSec.toFixed(1)}s (${wasPlaying ? 'đang phát' : 'đang dừng'})"`);
        workflowMediaWait.once(audioPlayer, 'loadedmetadata', () => { // event/workflow/media-wait.js
            seekMediaElementClamped(audioPlayer, resumeAtSec); // core/media-element-ui.js
            RELOAD_SONG_RESUME_BY_WAS_PLAYING[wasPlaying]();
        });
        setMediaElementSource(audioPlayer, newUrl); // core/media-element-ui.js
        if (oldUrl) revokeBlobUrl(oldUrl); // service/blob-url.js

        const newCoverUrl = record.cover ? createBlobUrl(record.cover) : DEFAULT_VINYL; // service/blob-url.js
        workflowPlaylist.replaceCurrentCoverUrl(newCoverUrl); // event/workflow/playlist.js
        playerTitle.textContent = record.tag.title; playerArtist.textContent = record.tag.artist;
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: record.tag.title || "Visual Master",
                artist: record.tag.artist || "Unknown Artist",
                artwork: record.cover ? [{ src: newCoverUrl, sizes: '512x512', type: record.cover.type || 'image/jpeg' }] : []
            });
        }
    },
};
