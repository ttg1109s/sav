/**
 * event/workflow/player.js — `workflowPlayer.playMedia()`: điểm vào DUY NHẤT để phát 1 item của Playlist (Song/Video/
 * Photo), và `reloadCurrentSongKeepingPosition()` (nạp lại bài đang phát sau khi file bị thay).
 *
 * Không có Router riêng — Workflow dùng chung xuyên miền (TH2, readme/event-bus-flow.md mục 3a), gọi thẳng từ:
 * workflowPlayerControls (Next/Prev, hết bài, Play khi chưa có bài), case 'playlist.item.playClick' (event/router/playlist.js),
 * workflowPlaylistEmptyState (2 nút "Phát"/"Trộn bài"), workflowPlaylist (phát mục đã chọn).
 *
 * Luồng Song (`_loadSong()` → `_startLoadedSong()`): THỨ TỰ CÁC BƯỚC giữ nguyên tuyệt đối — đổi thứ tự từng gây bug.
 *
 * NẠP SAU: core/playlist/{actions,render,order}.js, core/player-controls.js, core/record-art-ui.js, core/media-element-ui.js,
 * components/bottom-player.js (renderRecordArtHtml), core/loading-shield-util.js, service/{db,blob-url}.js, event/bus.js.
 * Lúc chạy: event/workflow/{player-controls,video-player,photo-player,wakelock,listen-stats,playlist-render,playlist-order,
 * subtitle-display,audio-engine,visualizer-render,auto-switch-visual,media-wait,playlist}.js.
 */
/** Nạp lại bài đang phát xong: đang phát thì phát tiếp, đang dừng thì để yên. */
const RELOAD_SONG_RESUME_BY_WAS_PLAYING = {
    true: () => playMediaElement(audioPlayer, '[workflow:player] nạp lại —'), // core/media-element-ui.js
    false: () => {},
};

/** Phát theo loại item (resolvePlaylistItemMediaType()). Video đi qua eventBus (router 'videoPlayer') để Block gate chặn
 * được — điểm DUY NHẤT phủ mọi đường vào video; router tự phân biệt "đã ở mode" / "vào mode lần đầu". */
const PLAY_MEDIA_BY_TYPE = {
    video: (key, request) => eventBus.send({ router: 'videoPlayer', type: 'videoPlayer.startFromPlaylist.click', payload: { key, switchScreen: request.switchScreen, direction: request.direction } }),
    photo: (key, request, isPhotoPlayerMode) => PHOTO_PLAY_BY_IN_MODE[isPhotoPlayerMode](key, request),
    song: (key, request) => workflowPlayer._playSong(key, request.switchScreen),
};

/** Photo: đã ở mode -> chỉ đổi ảnh (`direction` chọn slot Transition Next/Prev); chưa -> vào mode (ảnh đầu hiện tĩnh). Tự chuyển
 * bài lúc đang xem Playlist (`switchScreen` false) không ép mở Visualizer. */
const PHOTO_PLAY_BY_IN_MODE = {
    true: (key, request) => workflowPhotoPlayer.playPhotoByKey(key, request.switchScreen, request.direction), // event/workflow/photo-player.js
    false: (key, request) => workflowPhotoPlayer.startFromPlaylist(key, request.switchScreen),
};

/** Song: bấm lại ĐÚNG bài đang nạp -> chỉ đổi màn + phát tiếp; bài khác -> nạp mới. */
const SONG_PLAY_BY_SAME_KEY = {
    true: (key, switchScreen, gameplayArmedGameId) => workflowPlayer._replayCurrentSong(switchScreen, gameplayArmedGameId),
    false: (key, switchScreen) => workflowPlayer._playNewSong(key, switchScreen),
};

/** Đọc bản ghi Song xong (trong shield): mất bản ghi -> gỡ khỏi hàng đợi, báo sau khi shield đóng; còn -> phát. */
const SONG_LOAD_BY_HAS_RECORD = {
    false: (key) => {
        workflowPlaylistOrder.removeKeyFromDisplay(key); // event/workflow/playlist-order.js
        return 'notFound';
    },
    true: (key, record, previousKey, switchScreen) => {
        workflowPlayer._startLoadedSong(key, record, previousKey, switchScreen);
        return 'loaded';
    },
};

/** Sau khi shield đóng HẲN (isShieldBusy = false — không còn lớp che z-[200] đè modal z-[130]). Shield bận (lệnh bị bỏ) -> undefined. */
const SONG_LOAD_NOTICE_BY_STATUS = {
    notFound: () => alertModal(t('common.playSong.notFound')),
    loaded: () => {},
};

const workflowPlayer = {

    /**
     * @param {string} key
     * @param {{switchScreen?: boolean, direction?: 'next'|'prev'}} [options] - `switchScreen` (mặc định true): CHỈ Next/Prev
     *   và tự chuyển bài truyền false — không cưỡng chế rời Playlist UI. `direction`: chỉ Video/Photo dùng (2 preset Transition).
     */
    playMedia(key, options) {
        const { playlistCache, isPhotoPlayerMode } = appState.get(['playlistCache', 'isPhotoPlayerMode']);
        const mediaType = resolvePlaylistItemMediaType(playlistCache.get(key)); // core/playlist/render.js
        this._exitPhotoPlayerModeIfLeaving(isPhotoPlayerMode, mediaType);
        return (PLAY_MEDIA_BY_TYPE[mediaType] || PLAY_MEDIA_BY_TYPE.song)(key, resolvePlayMediaRequest(options), isPhotoPlayerMode); // core/player-controls.js — loại lạ đi luồng Song
    },

    /** Đang ở Photo Player mode mà item MỚI không phải Photo -> thoát mode TRƯỚC (1 chỗ cho mọi hướng thoát). KHÔNG `await` —
     * `exitPhotoPlayerMode()` dọn MỌI state đồng bộ, phần async chỉ là khôi phục lớp nền VBG. Đích là Video thì không khôi
     * phục VBG (Video Player tự chiếm `bgVideoElement`/`#visual-bg-image`, trả VBG lúc thoát).
     * @param {boolean} isPhotoPlayerMode @param {'song'|'video'|'photo'} mediaType */
    _exitPhotoPlayerModeIfLeaving(isPhotoPlayerMode, mediaType) {
        if (!shouldExitPhotoPlayerMode(isPhotoPlayerMode, mediaType)) return; // guard — core/player-controls.js
        workflowPhotoPlayer.exitPhotoPlayerMode(mediaType !== 'video'); // event/workflow/photo-player.js
    },

    /** @param {string} key @param {boolean} switchScreen */
    _playSong(key, switchScreen) {
        const { currentKey, gameplayArmedGameId } = appState.get(['currentKey', 'gameplayArmedGameId']);
        return SONG_PLAY_BY_SAME_KEY[key === currentKey](key, switchScreen, gameplayArmedGameId);
    },

    /** Bấm lại đúng bài đang nạp: đổi màn, phát nếu đang dừng, vẫn gửi 'gameplay.mediaChanged' (Game Mode đang armed phải tự
     * bắt đầu — cùng lý do bước cuối `_startLoadedSong()`). */
    _replayCurrentSong(switchScreen, gameplayArmedGameId) {
        workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js
        this._playSongUnlessGameArmed(gameplayArmedGameId);
        eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
    },

    /** Game Mode armed: KHÔNG phát — 'gameplay.mediaChanged' kích `workflowGameplay.start()` -> countdown -> `_beginPlaying()`
     * mới phát. play() lúc đang phát không làm gì. @param {string|null} gameplayArmedGameId */
    _playSongUnlessGameArmed(gameplayArmedGameId) {
        if (gameplayArmedGameId != null) return; // guard
        playMediaElement(audioPlayer, '[workflow:player] playMedia —'); // core/media-element-ui.js
    },

    /** Nạp bài mới trong shield `display=false` (khoá chồng lệnh nhưng KHÔNG hiện lớp che — bỏ cú nháy đen mỗi lần Next/Prev).
     * Mọi nơi gọi đều fire-and-forget -> `.catch()` cuối là lớp bảo vệ cuối: thân throw (vd getSongRecord() reject dù db.js
     * đã tự retry) thì báo đúng nguyên văn lỗi thay vì im lặng không tiếng. Modal "không tìm thấy" hiện SAU khi shield đóng
     * (await modal trong shield thì lớp che chặn luôn nút OK của chính modal đó). */
    _playNewSong(key, switchScreen) {
        workflowWakeLock.request();
        return withLoadingShield(t('common.loading.switchingSong'), () => this._loadSong(key, switchScreen), false) // core/loading-shield-util.js
            .then((status) => (SONG_LOAD_NOTICE_BY_STATUS[status] || SONG_LOAD_NOTICE_BY_STATUS.loaded)())
            .catch(async (err) => {
                console.error(`[workflow:player] playMedia("${key}") lỗi không xác định, nhạc có thể không phát ra tiếng được:`, err);
                const rawMsg = `${err && err.name ? err.name + ': ' : ''}${err && err.message ? err.message : String(err)}`;
                await alertModal(tFormat('common.playSong.error', { message: escapeHtml(rawMsg) }));
            });
    },

    /** Thân shield: thoát Video Player mode (await — gồm tái áp VBG, không thì video nền phát đè lúc bài mới vào) -> nhả nguồn
     * bài cũ -> đọc bản ghi -> phát. @returns {Promise<'notFound'|'loaded'>} */
    async _loadSong(key, switchScreen) {
        if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js
        const previousKey = this._releasePreviousSongSource();
        const record = await getSongRecord(key); // service/db.js
        return SONG_LOAD_BY_HAS_RECORD[!!record](key, record, previousKey, switchScreen);
    },

    /** Thu hồi object URL nhạc + ảnh bìa của bài cũ, dừng audio. @returns {string|null} key bài cũ */
    _releasePreviousSongSource() {
        const { currentObjectURL, currentCoverObjectURL, currentKey } = appState.get(['currentObjectURL', 'currentCoverObjectURL', 'currentKey']);
        revokeBlobUrl(currentObjectURL); // service/blob-url.js — null / đĩa than mặc định vô hại
        revokeBlobUrl(currentCoverObjectURL);
        appState.set('currentObjectURL', null);
        appState.set('currentCoverObjectURL', null);
        console.log(`writer: "workflowPlayer._releasePreviousSongSource", page: "currentObjectURL/currentCoverObjectURL", content: "null"`);
        pauseMediaElement(audioPlayer); // core/media-element-ui.js
        return currentKey;
    },

    /** Bài mới đã có bản ghi: gán nguồn + nhãn + ảnh bìa + Media Session, đếm lượt nghe, phát, đổi màn/vẽ lại Playlist, dọn
     * trạng thái visualizer/phụ đề theo bài, báo VBG + Game. */
    _startLoadedSong(key, record, previousKey, switchScreen) {
        const { gameplayArmedGameId, domNodesByKey } = appState.get(['gameplayArmedGameId', 'domNodesByKey']);
        appState.set('currentKey', key);
        workflowAutoSwitchVisual.onMediaChanged(); // event/workflow/auto-switch-visual.js — nhánh 'perMedia'
        const coverUrl = record.cover ? createBlobUrl(record.cover) : DEFAULT_VINYL; // service/blob-url.js
        const songUrl = createBlobUrl(record.blob);
        appState.set('currentCoverObjectURL', coverUrl);
        appState.set('currentObjectURL', songUrl);
        console.log(`writer: "workflowPlayer._startLoadedSong", page: "currentKey/currentObjectURL/currentCoverObjectURL", content: "${key}"`);
        setMediaElementSource(audioPlayer, songUrl); // core/media-element-ui.js

        this.applySongTrackLabels(record.tag);
        // Bài mới vừa gán src nên audio luôn đang dừng -> dựng ở trạng thái quay-tạm-dừng; sự kiện 'play' gỡ `paused` là quay.
        // Cover Blob có thể không decode được (ID3 lỗi/cắt cụt) -> attachCoverFallback() tự về DEFAULT_VINYL.
        attachCoverFallback(mountRecordArt(recordContainer, renderRecordArtHtml(audioPlayer.paused), coverUrl, record.tag.title || '')); // core/playlist/render.js + core/record-art-ui.js + components/bottom-player.js
        const session = resolveSongMediaSessionInfo(record.tag, record.cover, coverUrl); // core/playlist/actions.js
        setMediaSessionMetadata(session.title, session.artist, session.artwork); // core/player-controls.js

        workflowListenStats.bumpPlayCount('song', key); // event/workflow/listen-stats.js — +1 lượt nghe ngay khi bắt đầu phát

        // Chuyển màn Visualizer không phụ thuộc Game Mode. Next/Prev (switchScreen=false) cuộn Playlist tới bài mới — SAU
        // refreshSongNode()/renderPlaylistDiff() để node của `key` chắc chắn đã có.
        this._playSongUnlessGameArmed(gameplayArmedGameId);
        workflowPlayerControls.switchToVisualizerIfRequested(switchScreen); // event/workflow/player-controls.js
        if (previousKey) workflowPlaylistRender.refreshSongNode(previousKey); // event/workflow/playlist-render.js
        workflowPlaylistRender.refreshSongNode(key);
        if (!domNodesByKey.has(key)) workflowPlaylistRender.renderPlaylistDiff(); // Map sửa tại chỗ — has() đọc lúc này
        if (!switchScreen) workflowPlaylistRender.scrollToCurrentOrDefer();
        workflowPlaylistRender.syncPlayButtonPlayingState(); // khớp cả loại media (key trùng giữa các Nguồn)
        appState.set('raindrops', []); appState.set('ripples', []); appState.set('glassStaticDrops', []); appState.set('glassStreaks', []); appState.set('activeLightnings', []);
        workflowVisualizerRender.resetForNewMedia(); // event/workflow/visualizer-render.js — mọi group (và phân tích audio) dọn trạng thái theo bài
        workflowAudioEngine.setup(); workflowVisualizerRender.activateCurrentStyle();

        appState.set('subtitles', record.subtitles ? record.subtitles.slice() : []);
        workflowSubtitleDisplay.clearAll(); // event/workflow/subtitle-display.js — dọn khối phụ đề + karaoke bài cũ

        // Báo Visual Background bài vừa ĐỔI THẬT (so key — seek trong cùng bài không tính); VBG rẽ theo state ở router
        // (event/router/visual-bg.js).
        if (previousKey !== key) eventBus.send({ router: 'visualBg', type: 'visualBg.songChanged', payload: {} });
        // "Media đổi" cho Game Mode — vô điều kiện: phát lại ĐÚNG bài vẫn phải kích Game đang armed (nhánh Video gửi ở
        // workflowVideoPlayer.playVideoByKey()).
        eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
    },

    /** Nhãn tên / nghệ sĩ / album của Song trên Bottom Player — nghệ sĩ mặc định lúc thiếu tag ("Unknown artist", theo mọi
     * ngôn ngữ đã từng ghi) coi như không có -> ô trống chữ. @param {{title?: string, artist?: string, album?: string}} tag */
    applySongTrackLabels(tag) {
        const placeholders = [t('common.unknownArtist'), t('common.song.unknownArtist'), t('common.songEdit.defaultArtist'), 'Unknown artist', 'Unknown Artist'];
        const labels = resolveSongTrackLabels(tag, placeholders); // core/player-controls.js
        setPlayerTrackLabels(labels.title, labels.artist, labels.album); // core/player-controls.js
    },

    /**
     * Nạp lại bài ĐANG load trong audioPlayer từ DB sau khi file của nó vừa bị thay (upload ghi đè trùng tên) — GIỮ vị trí
     * phát + trạng thái phát/dừng, làm mới cover/tiêu đề. CHỈ gọi từ `workflowMediaInUse` (đã kiểm "bài này đang nạp ở
     * Player chính"). Không đếm lượt nghe, không báo 'visualBg.songChanged'/'gameplay.mediaChanged' (cùng 1 bài).
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
        workflowPlayer.applySongTrackLabels(record.tag);
        const session = resolveSongMediaSessionInfo(record.tag, record.cover, newCoverUrl); // core/playlist/actions.js
        setMediaSessionMetadata(session.title, session.artist, session.artwork); // core/player-controls.js
    },
};
