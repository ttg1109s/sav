/**
 * event/workflow/photo-player.js — Photo Player mode: phát 1 ảnh làm nội dung chính trên màn Visualizer, dùng chung cơ chế
 * Play/Next-Prev/Shuffle/Repeat của Playlist. Ảnh phát im lặng (audioPlayer/bgVideoElement dừng), visualizer ở trạng thái
 * nghỉ. Không có Game Mode (không có audio để phân tích — workflowGameCatalog.armGame() không mở phiên lúc đang phát ảnh).
 *
 * Lối vào: `workflowPlayer.playMedia()` (event/workflow/player.js) gọi thẳng `startFromPlaylist()` (vào mode) hoặc
 * `playPhotoByKey()` (đã ở mode, đổi ảnh). Không có Listener/Router riêng: ảnh không có sự kiện DOM, "đồng hồ giả" là task
 * `taskManager` 1 giây/lần (`_tick()`), hết ảnh gửi 'playerControls.photo.ended' (cùng case với audio/video ended).
 *
 * Ảnh hiện qua Image surface dùng chung với VBG (`workflowVisualBgPhotoMotion`, owner PHOTO_PLAYER_IMAGE_SURFACE_OWNER):
 * Transition Next/Prev + Point Move theo 3 slot Player, `background-size` theo Resolution từng ảnh. Surface sở hữu và tự
 * thu hồi URL ảnh chính; file này chỉ giữ URL thumb của #record-art. Đồng hồ bị GIỮ (`photoPlayerClockHeld`) từ lúc đổi
 * ảnh tới khi surface báo `onShown` (Giang chốt "Transition xong mới đếm").
 *
 * `PHOTO_PLAYER_CLOCK_MEDIA` là "media giả" cho Next/Prev (workflowPlayerControls.goToNextTrack()/restartCurrentTrack(), qua
 * `resolveActiveMedia()`): `currentTime = 0`, `play()`, `pause()` đi vào đúng các method của file này.
 *
 * NẠP SAU: core/photo-player.js, core/record-art-ui.js, components/bottom-player.js, core/media-element-ui.js,
 * core/file-manager/image.js (DURATION_MIN_SEC), service/blob-url.js, event/workflow/visual-bg-common.js. Gọi lúc chạy:
 * event/workflow/player-controls.js, listen-stats.js, playlist-render.js, visual-bg-photo-motion.js,
 * player-display-settings.js, auto-switch-visual.js, player-zoom.js, subtitle-display.js, video-player.js.
 */
const PHOTO_PLAYER_TICK_TASK = 'photoPlayerTick';
const PHOTO_PLAYER_IMAGE_SURFACE_OWNER = 'photoPlayer'; // chuỗi owner mờ — surface chỉ so bằng, chặn chéo với VBG
const PHOTO_PLAYER_TICK_INTERVAL_MS = 1000; // thanh seek đã ẩn, chỉ còn nhãn giờ
const PHOTO_PLAYER_CLOCK_KEYS = [
    'photoPlayerPaused', 'photoPlayerClockHeld', 'photoPlayerEnded',
    'photoPlayerElapsedBeforePauseSec', 'photoPlayerStartedAtMs', 'photoPlayerDurationSec',
];

const PHOTO_PLAYER_TRANSITION_SLOT_BY_DIRECTION = { next: 'transitionNext', prev: 'transitionPrev' };

// Ảnh vừa đọc từ DB: mất blob (bị xoá ở nơi khác giữa lúc phát) -> tự sang ảnh kế; còn -> hiện.
const PHOTO_PLAYER_PLAY_BY_HAS_BLOB = {
    false: () => workflowPlayerControls.goToNextTrack(true), // event/workflow/player-controls.js
    true: (record, photoKey, switchScreen, direction) => workflowPhotoPlayer._showRecord(record, photoKey, switchScreen, direction),
};

// Thoát mode: đích là Song (true) khôi phục lớp nền VBG (async); đích là Video (false) chỉ dọn lớp media — Video Player tự
// chiếm các lớp nền và trả VBG lúc thoát Video.
const PHOTO_PLAYER_EXIT_VISUAL_BG_BY_RESTORE = {
    true: () => workflowVisualBg.restoreAfterPlayerMode(), // event/workflow/visual-bg-common.js
    false: () => workflowVisualBg.clearMediaLayers(),
};

// 1 nhịp đồng hồ (computePhotoPlayerTickView()).
const PHOTO_PLAYER_TICK_BY_PHASE = {
    frozen: () => {},
    ended: () => workflowPhotoPlayer._signalEnded(),
    running: (view, durationSec) => updatePhotoPlayerTimeLabels(formatTime(view.displayElapsedSec), formatTime(durationSec)), // core/photo-player.js + core/playlist/state.js
};

// Pause/Play: đồng hồ mới (cùng 4 field), đồng hồ nghe, Point Move.
const PHOTO_PLAYER_CLOCK_BY_PAUSED = {
    true: (clock, nowMs) => computePhotoPlayerClockOnPause(clock, computePhotoPlayerElapsedSec(clock, nowMs)), // core/photo-player.js
    false: (clock, nowMs) => computePhotoPlayerClockOnResume(clock, nowMs),
};
const PHOTO_PLAYER_LISTEN_CLOCK_BY_PAUSED = {
    true: () => workflowListenStats.stopClock(), // event/workflow/listen-stats.js — giờ đứng yên không tính là đã xem
    false: () => workflowListenStats.startClock(),
};
const PHOTO_PLAYER_MOTION_BY_PAUSED = {
    true: () => workflowVisualBgPhotoMotion.pause(PHOTO_PLAYER_IMAGE_SURFACE_OWNER), // event/workflow/visual-bg-photo-motion.js
    false: () => workflowVisualBgPhotoMotion.resume(PHOTO_PLAYER_IMAGE_SURFACE_OWNER),
};

const workflowPhotoPlayer = {

    _thumbObjectUrl: null,   // URL thumb của #record-art — thu hồi lúc đổi ảnh/thoát mode
    _currentRecord: null,    // record ảnh đang hiện (Resolution sống cần width/height)
    _photoGeneration: 0,     // tăng mỗi lần đổi ảnh/thoát mode; `onShown` của lượt cũ về muộn tự bỏ qua
    _pointMoveDurationMs: 0, // thời lượng Point Move khi chạy lại từ đầu / đổi preset sống

    /** Vào mode lần đầu (từ Song/Video hoặc chưa phát gì): dựng audio engine (vòng vẽ Visual phải chạy dù chưa phát
     * Song/Video lần nào), dọn phụ đề, dừng nguồn cũ, thoát Video Player, bỏ highlight dòng cũ, dọn lớp VBG, rồi hiện ảnh.
     * @param {string} startKey @param {boolean} [switchScreen=true] - false khi auto-next/Next/Prev (không ép mở Visualizer) */
    async startFromPlaylist(startKey, switchScreen = true) {
        workflowAudioEngine.setup(); // event/workflow/audio-engine.js — tự guard, gọi lại an toàn
        const { currentKey: previousKey, isVideoPlayerMode } = appState.get(['currentKey', 'isVideoPlayerMode']);

        appState.set('subtitles', []);
        workflowSubtitleDisplay.clearAll(); // event/workflow/subtitle-display.js
        pauseMediaElement(audioPlayer); // core/media-element-ui.js — 'pause' nguyên bản lo icon/wake lock/Media Session của Song
        pauseMediaElement(bgVideoElement);
        if (isVideoPlayerMode) await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js
        if (previousKey !== null) {
            appState.set('currentKey', null);
            workflowPlaylistRender.refreshSongNode(previousKey); // event/workflow/playlist-render.js
        }

        workflowVisualBg.clearMediaLayers(); // event/workflow/visual-bg-common.js — dọn lớp VBG đang hiện, giữ cấu hình

        enterPhotoPlayerModeState(); // core/photo-player.js
        workflowPlayerZoom.onPlayerModeEnter('photo'); // event/workflow/player-zoom.js
        await this.playPhotoByKey(startKey, switchScreen);
    },

    /** Thoát mode (gọi từ `workflowPlayer.playMedia()` trước khi sang Song/Video, không await). Mọi state dọn ĐỒNG BỘ trước
     * lần await duy nhất (lớp nền VBG) — media mới bắt đầu ngay sau lời gọi không bị tắt nhầm wake lock/đồng hồ nghe.
     * @param {boolean} [restoreVisualBg=true] - false khi đích là Video */
    async exitPhotoPlayerMode(restoreVisualBg = true) {
        workflowPlayerZoom.onPlayerModeLeave(); // event/workflow/player-zoom.js
        taskManager.kill(PHOTO_PLAYER_TICK_TASK);
        this._photoGeneration += 1;
        this._currentRecord = null;
        appState.set('photoPlayerClockHeld', false, { skipCheck: true });
        appState.set('photoPlayerEnded', false, { skipCheck: true });

        const restorePromise = PHOTO_PLAYER_EXIT_VISUAL_BG_BY_RESTORE[restoreVisualBg](); // phần đồng bộ (dọn lớp, dừng surface) chạy ngay
        this._revokeThumbUrl();
        exitPhotoPlayerModeState(); // core/photo-player.js
        workflowWakeLock.release();
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js

        await restorePromise;
    },

    /** Đổi ảnh đang hiển thị (vào mode lần đầu hoặc Next/Prev trong mode).
     * @param {string} photoKey @param {boolean} [switchScreen=true] @param {'next'|'prev'} [direction='next'] - slot Transition */
    async playPhotoByKey(photoKey, switchScreen = true, direction = 'next') {
        const record = await getImageRecord(photoKey); // service/db.js
        PHOTO_PLAYER_PLAY_BY_HAS_BLOB[!!(record && record.blob)](record, photoKey, switchScreen, direction);
    },

    _showRecord(record, photoKey, switchScreen, direction) {
        const previousKey = appState.get('currentKey'); // đọc trước khi ghi đè — refresh dòng cũ
        this._revokeThumbUrl();
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js — giao Image surface, surface tự thu hồi
        this._thumbObjectUrl = createBlobUrl(record.thumbBlob || record.blob);
        this._photoGeneration += 1;
        const generation = this._photoGeneration;
        this._currentRecord = record;

        appState.set('currentKey', photoKey);
        console.log(`writer: "workflowPhotoPlayer._showRecord", page: "currentKey", content: "${photoKey}"`);
        workflowAutoSwitchVisual.onMediaChanged(); // event/workflow/auto-switch-visual.js
        workflowListenStats.bumpPlayCount('photo', photoKey); // event/workflow/listen-stats.js

        const durationSec = record.duration || DURATION_MIN_SEC; // core/file-manager/image.js — record cũ thiếu field
        appState.set('photoPlayerDurationSec', durationSec, { skipCheck: true });
        appState.set('photoPlayerElapsedBeforePauseSec', 0, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
        appState.set('photoPlayerPaused', false, { skipCheck: true });
        appState.set('photoPlayerEnded', false, { skipCheck: true });
        workflowAutoSwitchVisual.syncPlayState();

        const title = record.customName || stripFileExtension(record.filename) || t('photoPlayer.untitled'); // core/file-manager/video.js
        applyPhotoPlayerTrackInfo(title, record.album || ''); // core/photo-player.js
        mountRecordArt(recordContainer, renderRecordArtHtml(false), this._thumbObjectUrl, title); // core/record-art-ui.js + components/bottom-player.js

        this._showOnSurface(objectUrl, record, durationSec, direction, generation);
        updatePhotoPlayerTimeLabels(formatTime(0), formatTime(durationSec)); // core/photo-player.js + core/playlist/state.js
        updatePhotoPlayerPlayPauseIcon(true);

        workflowWakeLock.request();
        workflowListenStats.startClock(); // event/workflow/listen-stats.js — Photo cũng đếm totalTime ("Watch time")

        if (previousKey && previousKey !== photoKey) workflowPlaylistRender.refreshSongNode(previousKey); // event/workflow/playlist-render.js
        workflowPlaylistRender.refreshSongNode(photoKey);
        workflowPlaylistRender.syncPlayButtonPlayingState();

        workflowPlayerControls.showTrackChange(switchScreen); // event/workflow/player-controls.js

        // Mỗi ảnh 1 phiên đếm mới (kill bản cũ rồi tạo lại, không resume).
        taskManager.kill(PHOTO_PLAYER_TICK_TASK);
        taskManager.addNew(PHOTO_PLAYER_TICK_TASK, { time: PHOTO_PLAYER_TICK_INTERVAL_MS, exe: () => this._tick(), mode: 'timeout', count: 0 });
        taskManager.operator(PHOTO_PLAYER_TICK_TASK, 'enabled');
    },

    /** 'playerControls.playPause.click' khi đang Photo (router player-controls), và app ẩn/hiện (workflowAppVisibility). */
    togglePlayPausePhoto() {
        this.setPaused(!appState.get('photoPlayerPaused'));
    },

    /** Dừng / phát tiếp. Vòng tick không dừng theo — tự đứng yên khi `photoPlayerPaused`. Đã đúng trạng thái -> bỏ qua.
     * Phát tiếp ảnh đã báo hết (dừng ở cuối playlist) thì phát lại từ đầu, kể cả Point Move. @param {boolean} paused */
    setPaused(paused) {
        const clock = appState.get(PHOTO_PLAYER_CLOCK_KEYS);
        if (clock.photoPlayerPaused === paused) return;
        const next = PHOTO_PLAYER_CLOCK_BY_PAUSED[paused](clock, performance.now());
        appState.set('photoPlayerElapsedBeforePauseSec', next.elapsedBeforePauseSec, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', next.startedAtMs, { skipCheck: true });
        appState.set('photoPlayerEnded', next.ended, { skipCheck: true });
        PHOTO_PLAYER_LISTEN_CLOCK_BY_PAUSED[paused]();
        appState.set('photoPlayerPaused', paused, { skipCheck: true });
        updatePhotoPlayerPlayPauseIcon(!paused); // core/photo-player.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js
        PHOTO_PLAYER_MOTION_BY_PAUSED[paused]();
        if (next.restarted) this.onClockRestarted();
    },

    /** Tua đồng hồ tới `sec` (Next/Prev chỉ gán 0 — repeat-one, icon "Phát lại"). @param {number} sec */
    seekClock(sec) {
        appState.set('photoPlayerElapsedBeforePauseSec', sec, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
        appState.set('photoPlayerEnded', false, { skipCheck: true });
    },

    /** Media đang phát cho Next/Prev: đồng hồ giả của Photo, hoặc audio/video thật. Chọn giá trị.
     * @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode */
    resolveActiveMedia(isVideoPlayerMode, isPhotoPlayerMode) {
        return isPhotoPlayerMode ? PHOTO_PLAYER_CLOCK_MEDIA : getActiveMediaElement(isVideoPlayerMode); // core/player-controls.js
    },

    /** Task mỗi PHOTO_PLAYER_TICK_INTERVAL_MS: cập nhật nhãn giờ, chạm thời lượng thì báo hết ảnh. */
    _tick() {
        const clock = appState.get(PHOTO_PLAYER_CLOCK_KEYS);
        const view = computePhotoPlayerTickView(clock, computePhotoPlayerElapsedSec(clock, performance.now())); // core/photo-player.js
        PHOTO_PLAYER_TICK_BY_PHASE[view.phase](view, clock.photoPlayerDurationSec);
    },

    /** Hết ảnh: đánh dấu trước (tick sau không báo lặp) rồi gửi cùng msg.type với audio/video ended — router tự chọn auto
     * next / ghi âm. */
    _signalEnded() {
        appState.set('photoPlayerEnded', true, { skipCheck: true });
        eventBus.send({ router: 'playerControls', type: 'playerControls.photo.ended', payload: {} });
    },

    /** Giao ảnh cho Image surface — surface tự chọn hiện tĩnh (ảnh đầu) hay Transition. Đồng hồ GIỮ tới `onShown`.
     * @param {string} objectUrl @param {object} record @param {number} durationSec @param {'next'|'prev'} direction @param {number} generation */
    _showOnSurface(objectUrl, record, durationSec, direction, generation) {
        const transitionSlot = PHOTO_PLAYER_TRANSITION_SLOT_BY_DIRECTION[direction] || PHOTO_PLAYER_TRANSITION_SLOT_BY_DIRECTION.next;
        const transitionPreset = workflowPlayerDisplaySettings.resolvePhotoMotionPreset(transitionSlot); // event/workflow/player-display-settings.js
        const pointMovePreset = workflowPlayerDisplaySettings.resolvePhotoMotionPreset('pointMove');
        const surfaceHasContent = workflowVisualBgPhotoMotion.hasContent(PHOTO_PLAYER_IMAGE_SURFACE_OWNER); // event/workflow/visual-bg-photo-motion.js
        const timing = computePhotoPlayerSurfaceTiming(durationSec, surfaceHasContent, transitionPreset); // core/photo-player.js
        this._pointMoveDurationMs = timing.pointMoveDurationMs;
        appState.set('photoPlayerClockHeld', true, { skipCheck: true }); // hiện tĩnh thì nhả ngay trong lời gọi dưới
        try {
            workflowVisualBgPhotoMotion.showImage(objectUrl, {
                owner: PHOTO_PLAYER_IMAGE_SURFACE_OWNER,
                transitionPreset,
                pointMovePreset,
                advanceMs: timing.advanceMs,
                transitionCapMs: 0, // không kẹp Transition vào
                backgroundSize: workflowPlayerDisplaySettings.computePhotoPlayerBackgroundSize(record), // event/workflow/player-display-settings.js
                onShown: () => this._onPhotoShown(generation),
            });
        } catch (e) {
            revokeBlobUrl(objectUrl); // service/blob-url.js — surface chưa kịp nhận
            appState.set('photoPlayerClockHeld', false, { skipCheck: true });
            throw e;
        }
    },

    /** Ảnh hiện trọn (Transition xong / hiện tĩnh) — nhả đồng hồ, đếm từ 0. Lượt cũ về muộn tự bỏ qua; đang pause thì
     * chỉ nhả cờ (Play đặt lại mốc). @param {number} generation */
    _onPhotoShown(generation) {
        const { isPhotoPlayerMode, photoPlayerClockHeld } = appState.get(['isPhotoPlayerMode', 'photoPlayerClockHeld']);
        if (generation !== this._photoGeneration || !isPhotoPlayerMode || !photoPlayerClockHeld) return;
        appState.set('photoPlayerClockHeld', false, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
    },

    /** Đồng hồ vừa về 0 (repeat-one / icon "Phát lại" / Play lại ảnh đã hết) — chạy lại Point Move từ đầu (không
     * Transition); đang pause thì đứng yên. */
    onClockRestarted() {
        const { isPhotoPlayerMode, photoPlayerPaused } = appState.get(['isPhotoPlayerMode', 'photoPlayerPaused']);
        if (!isPhotoPlayerMode) return;
        workflowVisualBgPhotoMotion.restartPointMove(PHOTO_PLAYER_IMAGE_SURFACE_OWNER, workflowPlayerDisplaySettings.resolvePhotoMotionPreset('pointMove'), this._pointMoveDurationMs); // event/workflow/visual-bg-photo-motion.js
        if (photoPlayerPaused) workflowVisualBgPhotoMotion.pause(PHOTO_PLAYER_IMAGE_SURFACE_OWNER);
    },

    /** Slot Point Move vừa đổi trong Settings (workflowPlayerDisplaySettings.changeMotionSlot()) — áp sống lên ảnh đang
     * hiện; đang pause thì đứng yên. */
    refreshPointMovePreset() {
        const { isPhotoPlayerMode, photoPlayerPaused } = appState.get(['isPhotoPlayerMode', 'photoPlayerPaused']);
        if (!isPhotoPlayerMode) return;
        workflowVisualBgPhotoMotion.updatePreset(PHOTO_PLAYER_IMAGE_SURFACE_OWNER, workflowPlayerDisplaySettings.resolvePhotoMotionPreset('pointMove'), this._pointMoveDurationMs); // event/workflow/visual-bg-photo-motion.js
        if (photoPlayerPaused) workflowVisualBgPhotoMotion.pause(PHOTO_PLAYER_IMAGE_SURFACE_OWNER);
    },

    /** Resolution Photo vừa đổi trong Settings (workflowPlayerDisplaySettings.changeResolutionMode()) — áp sống. */
    refreshResolution() {
        if (!appState.get('isPhotoPlayerMode') || !this._currentRecord) return;
        workflowVisualBgPhotoMotion.updateBackgroundSize(PHOTO_PLAYER_IMAGE_SURFACE_OWNER, workflowPlayerDisplaySettings.computePhotoPlayerBackgroundSize(this._currentRecord)); // event/workflow/visual-bg-photo-motion.js
    },

    /** Vẽ lại ảnh đang hiện từ DB sau khi file của nó bị thay (sửa ảnh "Ghi đè", upload ghi đè) — chỉ gọi từ
     * `workflowMediaInUse` (đã kiểm state). Không reset đồng hồ, không đếm lượt xem; cập nhật thời lượng mới. */
    async reloadCurrentPhoto() {
        const photoKey = appState.get('currentKey');
        const record = await getMediaRecord('photo', photoKey); // service/db.js
        if (!record || !record.blob) return; // ảnh vừa bị xoá ở nơi khác
        this._revokeThumbUrl();
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js — giao Image surface
        this._thumbObjectUrl = createBlobUrl(record.thumbBlob || record.blob);
        this._photoGeneration += 1;
        const generation = this._photoGeneration;
        this._currentRecord = record;
        const durationSec = record.duration || DURATION_MIN_SEC; // core/file-manager/image.js
        appState.set('photoPlayerDurationSec', durationSec, { skipCheck: true });
        console.log(`writer: "workflowPhotoPlayer.reloadCurrentPhoto", page: "photoPlayerDurationSec", content: "${photoKey} -> ${durationSec}"`);
        setRecordArtSrc(this._thumbObjectUrl); // core/record-art-ui.js
        this._showOnSurface(objectUrl, record, durationSec, 'next', generation);
    },

    _revokeThumbUrl() {
        revokeBlobUrl(this._thumbObjectUrl); // service/blob-url.js — null vô hại
        this._thumbObjectUrl = null;
    },
};

// "Media giả" của Photo cho Next/Prev — chỉ 3 thành viên nơi gọi dùng (workflowPlayerControls: repeat-one, dừng ở cuối
// playlist, icon "Phát lại").
const PHOTO_PLAYER_CLOCK_MEDIA = {
    set currentTime(sec) { workflowPhotoPlayer.seekClock(sec); },
    play() { workflowPhotoPlayer.setPaused(false); },
    pause() { workflowPhotoPlayer.setPaused(true); },
};
