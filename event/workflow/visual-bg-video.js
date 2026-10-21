/**
 * event/workflow/visual-bg-video.js — Workflow domain "Visual Background", phần RIÊNG cho Video: áp/chuyển video trong
 * `source.list`, "Fix time", phục hồi khi kẹt, màn "Âm thanh Video", picker Video. `Object.assign()` thêm vào
 * `workflowVisualBg` (event/workflow/visual-bg-common.js, nạp trước). Vòng đời nguồn của `bgVideoElement` (đổi nguồn/ẩn/
 * hiện/object URL) ở event/workflow/video-player.js (dùng chung Video Player mode).
 *
 * Motion: Video surface dùng chung với Player Video (event/workflow/video-motion-surface.js, owner
 * `VISUAL_BG_VIDEO_SURFACE_OWNER`) — file này chỉ giữ QUYẾT ĐỊNH của VBG:
 *   - 1 preset (`motionPresetId`) lái Transition + Point Move + React Beat (cùng VBG Photo).
 *   - Video ĐẦU hiện tĩnh qua cầu thumb, không Transition; các lượt đổi sau có Transition (kẹp "Fix time" khi cycle + fixtime).
 *   - Point Move trải theo thời lượng tự nhiên của video (độ dài / playbackRate thật; trình duyệt không báo được độ dài ->
 *     `record.duration`), kẹp "Fix time" khi cycle + fixtime; chạy lại mỗi vòng lặp (phát hiện qua 'timeupdate' lùi về đầu).
 *   - Đứng/chạy theo Song (syncPlaybackToAudio()). Thumb placeholder tĩnh (Song dừng) không mượn surface.
 * Resolution VBG: layer A/B khớp `videoResolutionMode` của VBG (khối "Resolution" bên dưới).
 *
 * Video luôn vào `play()` ở trạng thái câm cứng (play() lúc đã audible bị iOS cưỡng chế giành audio session / pause Song);
 * tiếng thật áp sau khi video ổn định. Native loop chỉ khi không cycle và video không bật Audio B — có Audio B thì tự lặp
 * thủ công (`_restartCurrentVideoInPlace()`).
 *
 * NẠP SAU: event/workflow/visual-bg-common.js, core/visual-bg-video.js, core/media-element-ui.js. Gọi lúc chạy:
 * event/workflow/media-wait.js.
 */
let visualBgVideoAudioPanelEl = null;

/** "Fix time": cưỡng chế chuyển video kế sau đúng `durationSeconds` giây, không chờ video tự phát hết. */
const VISUAL_BG_VIDEO_FIXTIME_TASK = 'visualBgVideoFixTime';
/** Item hiện tại mất giữa lúc cycle -> không video nào phát -> 'ended' không bắn: tự bước tiếp sau 5 s. */
const VISUAL_BG_VIDEO_STUCK_RECOVERY_TASK = 'visualBgVideoStuckRecovery';
const VISUAL_BG_VIDEO_STUCK_RECOVERY_MS = 5000;

/** Audio B của VBG video bật / tắt. Khoá = `!!enabled`. */
const VISUAL_BG_VIDEO_AUDIO_BY_ENABLED = {
    true: (gain) => workflowVisualBg._connectVideoAudio(gain),
    false: () => setVideoBgGain(0), // core/video-player.js
};
// Item đầu: list > 1 item mới chọn theo nextOrder; 0–1 item lấy index 0.
const VISUAL_BG_VIDEO_START_BY_MULTI = {
    true: (list, cfg) => workflowVisualBg.firstIndex(list, cfg.nextOrder === 'random'),
    false: (list) => ({ list, index: 0 }),
};
// Song đang chạy -> nạp video thật; dừng (hoặc app ẩn) -> chỉ hiện thumb tĩnh của item sẽ phát.
const VISUAL_BG_VIDEO_FIRST_SHOW_BY_SONG_ACTIVE = {
    true: (key) => workflowVisualBg._playVideoKey(key),
    false: (key) => workflowVideoPlayer.showStaticBgThumb(key, (record) => workflowVisualBg._onVideoLayerBFilled(record)), // event/workflow/video-player.js
};
// 'ended': đang cycle -> sang video kế (pending trước); không cycle -> tự lặp lại chính nó (loop=false vì Audio B).
const VISUAL_BG_VIDEO_ENDED_BY_CYCLING = {
    true: () => workflowVisualBg._advanceAfterVideoEnded(),
    false: () => workflowVisualBg._restartCurrentVideoInPlace(),
};
const VISUAL_BG_VIDEO_ADVANCE_BY_EMPTY = {
    true: () => workflowVisualBg.selfHealEmptySource(),
    false: (next, cfg) => workflowVisualBg._stepVideoTo(next, cfg),
};
const VISUAL_BG_VIDEO_STEP_BY_HAS_KEY = {
    true: (key) => workflowVisualBg._playVideoKey(key),
    false: (key, cfg, list) => workflowVisualBg._parkOnMissingVideo(cfg.listPlaybackMode, list),
};
const VISUAL_BG_VIDEO_SWAP_RESULT_BY_HAS_RECORD = {
    true: (videoKey, record, cfg, durationSource) => workflowVisualBg._onVideoSwapped(videoKey, record, cfg, durationSource),
    false: () => workflowVisualBg._markCurrentMissing(),
};
// Thời lượng theo resolveVisualBgItemDurationSource() (core/visual-bg-common.js).
const VISUAL_BG_VIDEO_POINT_MOVE_MS_BY_SOURCE = {
    natural: (naturalMs) => naturalMs,
    fixtime: (naturalMs, cfg) => capVisualBgDurationMs(naturalMs, computeVisualBgFixtimeMs(cfg.durationSeconds)), // core/visual-bg-common.js
};
const VISUAL_BG_VIDEO_TRANSITION_CAP_BY_SOURCE = {
    natural: () => 0, // 0 = không kẹp
    fixtime: (cfg) => computeVisualBgFixtimeMs(cfg.durationSeconds),
};
const VISUAL_BG_VIDEO_POINT_MOVE_BY_NEW_CONTENT = {
    true: (preset, advanceMs) => workflowVideoMotionSurface.activatePointMoveForNewContent(VISUAL_BG_VIDEO_SURFACE_OWNER, preset, advanceMs), // event/workflow/video-motion-surface.js
    false: (preset, advanceMs) => workflowVideoMotionSurface.activatePointMoveForPresetChange(VISUAL_BG_VIDEO_SURFACE_OWNER, preset, advanceMs),
};
const VISUAL_BG_VIDEO_MISSING_BY_NO_LIVE_LEFT = {
    true: () => workflowVisualBg.clearSource(),
    false: (newList, cfg) => workflowVisualBg._keepMissingMarked(newList, cfg),
};

Object.assign(workflowVisualBg, {
    _isSwappingVideo: false, // đang đổi nguồn — chặn lượt chồng ("video chạy/lặp/đen màn thất thường")
    _currentVideoKey: null, // key video ĐANG nạp trong bgVideoElement (khác appState.currentKey — của Song đang phát)
    _videoRecordDurationSec: 0, // `record.duration` của video đang nạp — dự phòng khi trình duyệt không báo được độ dài
    _videoAudioRows: null, // bản chụp {key, name}[] lúc mở màn "Âm thanh Video"
    _videoLoopLastTimeSec: 0, // currentTime ở 'timeupdate' gần nhất — phát hiện vòng lặp mới
    _videoNaturalSize: null, // {width,height} gốc của video có thumb VỪA vào layer B ('trueMax' cần)

    /** Áp video đầu của `source.list`: Song đang chạy thì nạp thật, chưa thì hiện thumb tĩnh — Song phát thật sau đó
     * `syncPlaybackToAudio()` tự nạp lại đúng `list[_listIndex]`. */
    async _applyVideo(cfg) {
        const list = cfg.source.list;
        const start = VISUAL_BG_VIDEO_START_BY_MULTI[list.length > 1](list, cfg);
        if (start.list !== list) await this.persistSourceListMutation(start.list);
        this._listIndex = start.index;
        const key = start.list[start.index];
        if (!key) return;
        await VISUAL_BG_VIDEO_FIRST_SHOW_BY_SONG_ACTIVE[this._isSongActiveForVbg()](key);
    },

    /** 'visualBg.video.ended' (Block gate chặn sẵn lúc Video Player mode). 'ended' chỉ bắn khi `loop=false`: cycle slideshow
     * (sang video kế) hoặc không cycle nhưng video bật Audio B (tự lặp chính nó). */
    async _onVideoEnded() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video') return;
        this._killVideoFixTimeTimer();
        await VISUAL_BG_VIDEO_ENDED_BY_CYCLING[this._isSlideshowCycling(cfg)]();
    },

    async _advanceAfterVideoEnded() {
        if (await this._checkAndApplyPendingSource()) return;
        await this._advanceVideo();
    },

    /** Tự lặp lại CHÍNH video đang phát khi `loop=false` (Audio B bật): câm cứng -> về 0 -> play() -> 'playing' thật -> áp
     * lại tiếng + tốc độ. Không tải lại record. */
    _restartCurrentVideoInPlace() {
        const videoKey = this._currentVideoKey;
        if (!videoKey) return;
        muteVisualBgVideo(); // core/visual-bg-video.js
        setVideoBgGain(0); // core/video-player.js
        seekMediaElement(bgVideoElement, 0); // core/media-element-ui.js
        playVisualBgVideo();
        workflowVideoPlayer.waitForNextPlaying().then(() => this._restoreVideoSettingsIfCurrent(videoKey)); // event/workflow/video-player.js
    },

    /** Sau khi video ổn định ('playing'): áp lại tiếng + tốc độ nếu vẫn đúng video đó (không bị video khác đè lên). */
    _restoreVideoSettingsIfCurrent(videoKey) {
        if (this._currentVideoKey !== videoKey) return;
        this._applyVideoAudioSettingToElement(videoKey);
        this._applyVideoPlaybackSpeedSetting();
    },

    /** Bước sang video kế (cycle) — index/key tính ĐỒNG BỘ rồi mới gán `_listIndex` (không để `await` chen giữa: lượt
     * chồng sẽ đọc index cũ). Ghi `source.list` đã dọn/xáo chạy ngầm, không chặn việc phát. */
    async _advanceVideo() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.source.list.length <= 1) return;
        const next = this.advanceList(cfg.source.list, this._listIndex, cfg.nextOrder === 'random');
        await VISUAL_BG_VIDEO_ADVANCE_BY_EMPTY[next.index === -1](next, cfg);
    },

    _stepVideoTo(next, cfg) {
        this._listIndex = next.index;
        if (next.list !== cfg.source.list) this.persistSourceListMutation(next.list); // ghi ngầm
        const key = next.list[next.index];
        return VISUAL_BG_VIDEO_STEP_BY_HAS_KEY[!!key](key, cfg, next.list);
    },

    /** Item kế là null (đã xoá) giữa lúc cycle: ẩn video, hẹn bước tiếp để không treo. */
    _parkOnMissingVideo(listPlaybackMode, list) {
        this._killVideoFixTimeTimer();
        this._hideVideoOnly();
        this._scheduleStuckRecoveryTimer(listPlaybackMode, list);
    },

    /** Chỉ ẩn video (không đụng task/index). */
    _hideVideoOnly() {
        this._currentVideoKey = null;
        workflowVideoPlayer.clearBgVideoSource(); // event/workflow/video-player.js
    },

    /** Không video nào phát (item mất) thì 'ended' không bao giờ bắn -> hẹn tự bước tiếp. Chỉ khi đang cycle slideshow. */
    _scheduleStuckRecoveryTimer(listPlaybackMode, list) {
        this._killStuckRecoveryTimer();
        if (!isVisualBgSlideshowCycling(listPlaybackMode, countVisualBgLiveItems(list))) return; // core/visual-bg-common.js
        taskManager.once(() => this._advanceVideo(), VISUAL_BG_VIDEO_STUCK_RECOVERY_MS, VISUAL_BG_VIDEO_STUCK_RECOVERY_TASK);
    },

    /** Huỷ hẹn phục hồi (video mới đã nạp hoặc VBG bị dọn). */
    _killStuckRecoveryTimer() {
        taskManager.kill(VISUAL_BG_VIDEO_STUCK_RECOVERY_TASK);
    },

    /** Huỷ hẹn "Fix time" — mọi lúc video hiện tại không còn là video cần theo dõi. */
    _killVideoFixTimeTimer() {
        taskManager.kill(VISUAL_BG_VIDEO_FIXTIME_TASK);
    },

    /** Hẹn cưỡng chế chuyển video kế đúng `durationSeconds` — chỉ khi cycle + 'fixtime' và video dài hơn mốc đó (ngắn hơn
     * thì 'ended' thật tự bắn). Bắn -> chạy lại đường `_onVideoEnded()` (tự hẹn lại cho video kế).
     * @param {object} cfg @param {'fixtime'|'natural'} durationSource */
    _maybeScheduleVideoFixTime(cfg, durationSource) {
        if (durationSource !== 'fixtime') return;
        if (!isVisualBgVideoFixtimeCutNeeded(bgVideoElement.duration, cfg.durationSeconds)) return; // core/visual-bg-video.js
        const videoKey = this._currentVideoKey;
        taskManager.once(() => this._onFixtimeReached(videoKey), computeVisualBgFixtimeMs(cfg.durationSeconds), VISUAL_BG_VIDEO_FIXTIME_TASK);
    },

    _onFixtimeReached(videoKey) {
        if (this._currentVideoKey !== videoKey) return;
        this._onVideoEnded();
    },

    /** Key video VBG đang nạp (null nếu chưa) — `workflowMediaInUse` đọc qua getter này. */
    getCurrentVideoKey() {
        return this._currentVideoKey;
    },

    /** Nạp lại video VBG đang chạy sau khi file/thumb của nó vừa bị thay — giữ vị trí, hiện tĩnh qua cầu thumb như video
     * đầu. CHỈ gọi từ `workflowMediaInUse` (đã kiểm state). */
    async reloadCurrentVideoKeepingPosition() {
        const videoKey = this._currentVideoKey;
        if (videoKey === null || this._isSwappingVideo) return;
        const resumeAtSec = bgVideoElement.currentTime;
        this._currentVideoKey = null;
        await this._playVideoKey(videoKey);
        if (this._currentVideoKey !== videoKey) return; // nạp lỗi / đã bị lượt khác thay
        workflowMediaWait.once(bgVideoElement, 'loadedmetadata', () => seekMediaElementClamped(bgVideoElement, resumeAtSec)); // event/workflow/media-wait.js, core/media-element-ui.js
        console.log(`[workflowVisualBg.reloadCurrentVideoKeepingPosition] nạp lại video nền "${videoKey}" tại ${resumeAtSec}s`);
    },

    /** Nạp/đổi video nền qua `workflowVideoPlayer.swapBgVideoSource()` (dùng chung Video Player mode) — phần riêng VBG: câm
     * cứng trước khi đổi, loop theo cấu hình, mượn Video surface, không chờ 'playing' (VBG không có UI phải đợi).
     * @param {string} videoKey */
    async _playVideoKey(videoKey) {
        if (this._isSwappingVideo || isSameVideoLoaded(videoKey, this._currentVideoKey, workflowVideoPlayer._objectUrl, bgVideoElement.getAttribute('src'))) return; // core/video-player.js
        this._killStuckRecoveryTimer();
        this._killVideoFixTimeTimer();
        muteVisualBgVideo(); // core/visual-bg-video.js
        setVideoBgGain(0); // core/video-player.js
        const cfg = appConfigVisualBg.getAll();
        const durationSource = this._itemDurationSource(cfg); // event/workflow/visual-bg-common.js
        setVisualBgVideoLoop(this._computeVideoLoop(cfg, videoKey));
        showVisualBgVideoLayer();
        this._applyVideoLayerAResolution(); // Resolution lên layer A TRƯỚC khi đổi nguồn
        this._isSwappingVideo = true;
        // Video đầu -> hiện tĩnh qua cầu thumb (không Transition); đã có video -> Transition qua hook.
        const isFirstVideo = this._currentVideoKey === null;
        const motionPreset = this._currentMotionPreset(); // event/workflow/visual-bg-photo.js
        workflowVideoMotionSurface.acquire(VISUAL_BG_VIDEO_SURFACE_OWNER, { getBeatPresetFn: () => this._getMotionBeatPreset() }); // event/workflow/video-motion-surface.js
        if (isFirstVideo) workflowVideoMotionSurface.showBridgeLayer(VISUAL_BG_VIDEO_SURFACE_OWNER); // thumb placeholder (nếu đang hiện) không bị .motion-layer ẩn mất
        this._videoLoopLastTimeSec = 0;
        const swapHooks = {
            onLayerBFilled: (swapRecord) => this._onVideoLayerBFilled(swapRecord), // kể cả video đầu
            runTransition: isFirstVideo ? null : () => workflowVideoMotionSurface.runTransition(VISUAL_BG_VIDEO_SURFACE_OWNER, motionPreset, VISUAL_BG_VIDEO_TRANSITION_CAP_BY_SOURCE[durationSource](cfg)),
        };
        let record;
        try {
            record = await workflowVideoPlayer.swapBgVideoSource(videoKey, !isFirstVideo, null, true, false, swapHooks); // event/workflow/video-player.js
        } catch (e) {
            // Lỗi có thể chỉ tạm thời — không đánh dấu mất (sẽ xoá oan khỏi `source.list`), chỉ ẩn; lượt sau tự thử lại.
            // Phải gỡ cờ đổi nguồn, không thì guard đầu hàm chặn mọi lượt sau.
            console.error('[workflowVisualBg] _playVideoKey() lỗi lúc swapBgVideoSource():', e);
            this._isSwappingVideo = false;
            this._hideVideoOnly();
            return;
        }
        this._isSwappingVideo = false;
        await VISUAL_BG_VIDEO_SWAP_RESULT_BY_HAS_RECORD[!!record](videoKey, record, cfg, durationSource);
    },

    /** Video mới đã vào layer: ghi nhận, sơn nền, đợi ổn định ('playing' hoặc hết giờ) rồi áp tiếng/tốc độ/Fix time/Point Move. */
    _onVideoSwapped(videoKey, record, cfg, durationSource) {
        this._currentVideoKey = videoKey;
        this._videoRecordDurationSec = record.duration;
        this.paintSolidBg();
        workflowVideoPlayer.waitBgVideoReady().then(() => this._onVideoReady(videoKey, cfg, durationSource)); // event/workflow/video-player.js
    },

    _onVideoReady(videoKey, cfg, durationSource) {
        if (this._currentVideoKey !== videoKey) return;
        syncVisualBgVideoPlayback(!this._isSongActiveForVbg()); // core/visual-bg-video.js — đổi video giữa lúc app ẩn -> nạp xong vẫn đứng yên
        this._applyVideoAudioSettingToElement(videoKey);
        this._applyVideoPlaybackSpeedSetting();
        this._maybeScheduleVideoFixTime(cfg, durationSource);
        this._videoLoopLastTimeSec = 0;
        this._activateVideoPointMove(true); // duration + playbackRate thật đã có
        workflowVideoMotionSurface.syncBeat(VISUAL_BG_VIDEO_SURFACE_OWNER); // event/workflow/video-motion-surface.js
    },

    // ===================== Resolution VBG Video — cùng mô hình 2 layer với Player Video (core/player-display-apply.js) =====================
    // Layer A `bgVideoElement` (object-fit, áp trước mỗi lượt đổi nguồn) + layer B `visualBgImageElement` (background-size theo
    // kích thước gốc của video có thumb vừa vào layer B). Player vào mode tự đè; thoát mode gỡ về '' rồi VBG áp lại.

    _applyVideoLayerAResolution() {
        applyVisualBgVideoResolutionToDOM(resolvePlayerObjectFitCss(this._resolutionModeFor('video'))); // core/visual-bg-video.js + core/player-display-settings.js
    },

    /** Layer B theo `_videoNaturalSize` (thiếu -> 'trueMax' tự về 'contain'). */
    _applyVideoLayerBResolution() {
        const size = this._videoNaturalSize || { width: null, height: null };
        const frame = measureVisualBgVideoFrame(); // core/visual-bg-video.js
        applyVisualBgVideoBridgeSizeToDOM(resolvePlayerBackgroundSizeCss(this._resolutionModeFor('video'), size.width, size.height, frame.width, frame.height)); // core/player-display-settings.js
    },

    /** Hook `onLayerBFilled` (swapBgVideoSource()/showStaticBgThumb()) — thumb vừa vào layer B: nhớ kích thước gốc, khớp
     * Resolution ngay. @param {object|null} record */
    _onVideoLayerBFilled(record) {
        this._videoNaturalSize = { width: (record && record.width) || null, height: (record && record.height) || null };
        this._applyVideoLayerBResolution();
    },

    /** Đổi Resolution sống (video thật hoặc thumb placeholder) — từ changeResolutionMode(). */
    _refreshVideoResolution() {
        this._applyVideoLayerAResolution();
        this._applyVideoLayerBResolution();
    },

    // ===================== Motion VBG Video =====================

    /** Hành trình Point Move (ms thực) — thời lượng tự nhiên của video, kẹp "Fix time" khi cycle + fixtime.
     * @param {object} cfg @param {'fixtime'|'natural'} durationSource @returns {number} */
    _computeVideoPointMoveAdvanceMs(cfg, durationSource) {
        const naturalMs = computeVisualBgVideoNaturalMs(bgVideoElement.duration, this._videoRecordDurationSec, bgVideoElement.playbackRate); // core/visual-bg-video.js
        return VISUAL_BG_VIDEO_POINT_MOVE_MS_BY_SOURCE[durationSource](naturalMs, cfg);
    },

    /** Kích hoạt Point Move cho video đang hiện — `isNewContent` true: video mới / vòng lặp mới (chạy lại từ đầu); false:
     * đổi preset/tốc độ giữa chừng (giữ mốc). Song đang dừng -> đứng yên luôn. @param {boolean} isNewContent */
    _activateVideoPointMove(isNewContent) {
        if (this._currentVideoKey === null) return;
        const cfg = appConfigVisualBg.getAll();
        const advanceMs = this._computeVideoPointMoveAdvanceMs(cfg, this._itemDurationSource(cfg));
        VISUAL_BG_VIDEO_POINT_MOVE_BY_NEW_CONTENT[isNewContent](this._currentMotionPreset(), advanceMs);
        if (!this._isSongActiveForVbg()) workflowVideoMotionSurface.pause(VISUAL_BG_VIDEO_SURFACE_OWNER); // app ẩn cũng coi như Song dừng
    },

    /** Tốc độ phát CHUNG vừa đổi (event/workflow/hud.js::selectSpeed()) — chỉ khi VBG đang phát video và bật
     * `videoSyncPlaybackSpeed`: áp rate mới + Point Move tính lại (không chạy lại hành trình). */
    onGlobalPlaybackSpeedChanged() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video' || !cfg.videoSyncPlaybackSpeed || this._currentVideoKey === null || this._isSwappingVideo) return;
        this._applyVideoPlaybackSpeedSetting();
        this._refreshVideoMotion();
    },

    /** Preset/tốc độ VBG vừa đổi lúc video đang hiện (changeMotionPresetId()/changeSyncPlaybackSpeed()). */
    _refreshVideoMotion() {
        this._activateVideoPointMove(false);
        workflowVideoMotionSurface.syncBeat(VISUAL_BG_VIDEO_SURFACE_OWNER); // event/workflow/video-motion-surface.js
    },

    /** 'visualBg.video.timeupdate' — video LÙI về đầu (loop native không bắn 'ended'; tự lặp thủ công cũng về 0) -> chạy lại
     * Point Move từ đầu. @param {number} currentTimeSec */
    _onVideoTimeUpdate(currentTimeSec) {
        if (appConfigVisualBg.getAll().type !== 'video' || this._currentVideoKey === null || this._isSwappingVideo) return;
        const wrapped = isVisualBgVideoLoopWrapped(currentTimeSec, this._videoLoopLastTimeSec); // core/visual-bg-video.js
        this._videoLoopLastTimeSec = currentTimeSec;
        if (wrapped) this._activateVideoPointMove(true);
    },

    /** VBG Video mặc định chạy 1x độc lập — chỉ theo tốc độ chung khi bật `videoSyncPlaybackSpeed`. Gọi mỗi lần video mới
     * ổn định / tự lặp (đặt lại tường minh, không giả định giá trị cũ). */
    _applyVideoPlaybackSpeedSetting() {
        applyPlaybackSpeed(bgVideoElement, appConfigVisualBg.getAll().videoSyncPlaybackSpeed ? appConfigViz.getAll().playbackSpeed : 1); // core/player-controls.js
    },

    /** Tiếng riêng của `videoKey` — áp SAU khi video ổn định. Audio B bật mới nối `bgVideoElement` vào Web Audio graph; đã nối
     * thì `.muted`/`.volume` không đáng tin (Firefox #966247) -> GainNode riêng (setVideoBgGain()) là nguồn chính. */
    _applyVideoAudioSettingToElement(videoKey) {
        const { enabled, volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey); // core/visual-bg-video.js
        const gain = resolveVisualBgVideoAudioGain(volumePercent);
        setVisualBgVideoAudioElement(enabled, gain);
        VISUAL_BG_VIDEO_AUDIO_BY_ENABLED[!!enabled](gain);
    },

    /** Audio B bật: dựng audio graph, nối bgVideoElement vào rồi đặt gain. */
    _connectVideoAudio(gain) {
        workflowAudioEngine.setup(); // event/workflow/audio-engine.js
        workflowAudioEngine.connectVideoElement();
        setVideoBgGain(gain); // core/video-player.js
    },

    /** Đánh dấu vị trí hiện tại là mất + ẩn (không reset index/task — advance lượt sau tự dọn null). Không còn item sống ->
     * gỡ nguồn; còn -> hẹn phục hồi để không treo. */
    async _markCurrentMissing() {
        const cfg = appConfigVisualBg.getAll();
        const newList = markVisualBgListItemMissing(cfg.source.list, this._listIndex); // core/visual-bg-common.js
        await VISUAL_BG_VIDEO_MISSING_BY_NO_LIVE_LEFT[countVisualBgLiveItems(newList) === 0](newList, cfg);
    },

    async _keepMissingMarked(newList, cfg) {
        appConfigVisualBg.mutateAll((c) => { c.source.list = newList; });
        console.log(`writer: "workflowVisualBg._keepMissingMarked", page: "visualBgConfig", content: "source.list[${this._listIndex}]=null"`);
        await this._persist();
        this._hideVideoOnly();
        this._scheduleStuckRecoveryTimer(cfg.listPlaybackMode, newList);
    },

    /** Song phát lại sau pause tạm — resume video đã nạp, câm cứng lúc play(), bật tiếng sau 'playing' (tránh iOS giành audio
     * session đúng lúc Song cũng vừa play()). @param {string} videoKey */
    _resumeVideoWithDelayedAudio(videoKey) {
        workflowVideoMotionSurface.resume(VISUAL_BG_VIDEO_SURFACE_OWNER); // event/workflow/video-motion-surface.js
        muteVisualBgVideo(); // core/visual-bg-video.js
        setVideoBgGain(0); // core/video-player.js
        playVisualBgVideo();
        workflowVideoPlayer.waitForNextPlaying().then(() => this._restoreVideoSettingsIfCurrent(videoKey)); // event/workflow/video-player.js
    },

    /** Song dừng hẳn (hết playlist) — dỡ video thật, về thumb placeholder tĩnh của ĐÚNG video đó; Song phát lại thì nạp lại
     * từ đầu. Placeholder không mượn surface: trả trước (DOM A/B về chỗ cũ, layer B hết `.motion-layer`). */
    async _revertToPlaceholder() {
        const key = this._currentVideoKey;
        if (!key) return;
        this._currentVideoKey = null;
        workflowVideoMotionSurface.release(VISUAL_BG_VIDEO_SURFACE_OWNER); // event/workflow/video-motion-surface.js
        await workflowVideoPlayer.showStaticBgThumb(key, (record) => this._onVideoLayerBFilled(record)); // event/workflow/video-player.js
    },

    // ===================== Màn "Âm thanh Video" =====================

    /** 'visualBg.openVideoAudioPanel.click' — đọc tên các video (1 transaction) TRƯỚC rồi mới chuyển màn với danh sách dựng
     * sẵn (chuyển với khung rỗng thì Drawer đo chiều cao sai rồi giãn = giật). `_videoAudioRows` là bản chụp lúc mở. */
    async openVideoAudioPanel() {
        const keys = listVisualBgLiveKeys(appConfigVisualBg.getAll().source.list); // core/visual-bg-common.js
        const records = await getVideoRecordsByKeys(keys); // service/db.js
        this._videoAudioRows = buildVisualBgSortItems(keys, records, records.map((r) => (r ? VISUAL_BG_ITEM_NAME_BY_TYPE.video(r) : null))); // core/visual-bg-common.js
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderVisualBgVideoAudio()); // event/workflow/app-settings.js
    },

    /** onMount màn Video audio — ghi nhận body đang gắn để cập nhật đúng 1 hàng sau khi đổi. */
    mountVideoAudioPanel() {
        visualBgVideoAudioPanelEl = genericDrawerBody;
    },

    /** HTML danh sách từ bản chụp `_videoAudioRows` (đi chung bodyHtml). @returns {string} */
    buildVideoAudioListHtml() {
        return this._buildVideoAudioRowsHtml(this._videoAudioRows || [], appConfigVisualBg.getAll().source.videoAudio);
    },

    /** Tên video | icon loa (bật/tắt ngay) | "x%" (mở modal mức) — markup ở components/visual-bg-video-audio-drawer.js. */
    _buildVideoAudioRowsHtml(rows, videoAudioMap) {
        const rowStates = rows.map(({ key, name }) => {
            const { enabled, volumePercent } = getVisualBgVideoAudioSetting(videoAudioMap, key); // core/visual-bg-video.js
            return { key, name, enabled, volumePercent, stateUitk: this._videoAudioStateUitk(enabled) };
        });
        return renderVisualBgVideoAudioRowsHtml(rowStates); // components/visual-bg-video-audio-drawer.js
    },

    /** Icon loa bật / gạch chéo — dùng chung lúc vẽ hàng và lúc cập nhật 1 nút. */
    _videoAudioIconInnerHtml(enabled) {
        return renderVisualBgVideoAudioIconHtml(enabled, this._videoAudioStateUitk(enabled)); // components/visual-bg-video-audio-drawer.js
    },

    /** Key theme của icon loa + chữ % theo bật/tắt. */
    _videoAudioStateUitk(enabled) {
        return enabled ? 'accentText' : 'textSecondary';
    },

    /** Bấm icon loa: đảo bật/tắt ngay. */
    async toggleVideoAudioEnabled(videoKey) {
        const { enabled } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey);
        await this.setVideoAudioSetting(videoKey, { enabled: !enabled });
    },

    /** Bấm "%": modal chỉnh mức (core/slider-input-modal.js), tên lấy từ bản chụp (không đọc DB lần 2). */
    openVideoAudioVolumeModal(videoKey) {
        const { volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey);
        openSliderInputModal({
            title: t('visualBgSettingsDrawer.videoAudio.volumeModal.title'),
            hintText: findVisualBgVideoAudioRowName(this._videoAudioRows || [], videoKey), // core/visual-bg-video.js
            min: 0,
            max: 100,
            step: 1,
            initialValue: volumePercent,
            unitSuffix: '%',
            onConfirm: (value) => this.setVideoAudioSetting(videoKey, { volumePercent: value }),
        });
    },

    /** Ghi 1 phần (`enabled` / `volumePercent`) vào `source.videoAudio[videoKey]` — dùng chung icon và modal. */
    async setVideoAudioSetting(videoKey, patch) {
        const cfg = appConfigVisualBg.getAll();
        const current = getVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey);
        const nextMap = setVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey, current, patch);
        appConfigVisualBg.mutateAll((c) => { c.source.videoAudio = nextMap; });
        console.log(`writer: "workflowVisualBg.setVideoAudioSetting", page: "visualBgConfig", content: "source.videoAudio[${videoKey}]=${JSON.stringify(nextMap[videoKey])}"`);
        await this._persist();
        this._refreshVideoAudioRowButtons(videoKey, nextMap[videoKey]);
        this._applyLiveIfCurrentVideo(videoKey);
    },

    /** Cập nhật đúng 2 nút (icon + %) của 1 hàng rồi áp theme lại. */
    _refreshVideoAudioRowButtons(videoKey, setting) {
        if (!visualBgVideoAudioPanelEl || genericDrawerPanel.classList.contains('hidden')) return;
        const els = setVisualBgVideoAudioRowState(visualBgVideoAudioPanelEl, videoKey, this._videoAudioIconInnerHtml(setting.enabled), setting.volumePercent, this._videoAudioStateUitk(setting.enabled)); // core/visual-bg-panel-ui.js
        if (els.iconBtn) applyUiThemeToDom(els.iconBtn, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        if (els.display) applyUiThemeToDom(els.display, _activeUiThemeKeyList);
    },

    /** `loop` đúng cho `videoKey` — dùng chung lúc nạp và lúc đổi Audio B giữa chừng. @param {object} cfg @param {string} videoKey
     * @returns {boolean} */
    _computeVideoLoop(cfg, videoKey) {
        const { enabled: hasAudioB } = getVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey); // core/visual-bg-video.js
        return shouldVisualBgVideoLoopNatively(this._isSlideshowCycling(cfg), hasAudioB);
    },

    /** `videoKey` vừa sửa tiếng TRÙNG video đang phát -> áp ngay, kèm tính lại `loop` (bật Audio B -> tự lặp thủ công; tắt ->
     * về native loop). */
    _applyLiveIfCurrentVideo(videoKey) {
        if (this._listIndex < 0) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video' || cfg.source.list[this._listIndex] !== videoKey) return;
        this._applyVideoAudioSettingToElement(videoKey);
        setVisualBgVideoLoop(this._computeVideoLoop(cfg, videoKey)); // core/visual-bg-video.js
    },

    // ===================== Picker Video =====================

    /** Mở picker Video multi-select — danh sách bỏ video thuộc folder Hidden. */
    async openPickVideo() {
        this._pickerSelectedKeys = [];
        workflowGenericDrawerHelpers.mountMediaPicker({
            routerName: 'visualBg', msgPrefix: 'visualBg.videoPicker', title: t('fileManager.video.pickerTitle'),
            bodyHtml: renderVisualBgMultiPickerBodyHtml('file-manager-video-picker-scroll', 'file-manager-video-picker-empty', t('fileManager.video.empty')), // components/visual-bg-settings-drawer.js
            tileSelector: '.video-tile', tileDataKey: 'videoKey', showConfirmButton: true, updateInPlace: true,
        });
        this._pickerOpen = true;

        const videos = await workflowPlaylistScope.listPickableMedia('video'); // event/workflow/playlist-scope.js
        if (!this._pickerOpen) return;
        const scrollEl = fillVisualBgPickerList(genericDrawerBody, 'file-manager-video-picker-scroll', 'file-manager-video-picker-empty', videos.length); // core/visual-bg-panel-ui.js
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: 'multiSelect', selectedKeys: new Map() });
    },

    /** 'visualBg.videoPicker.tile.click' — bật/tắt chọn. */
    toggleVideoPickerTile(videoKey) {
        this._togglePickerKey(videoKey);
        workflowVideoGalleryWindow.setBadgeMode('genericDrawer', 'multiSelect', this._pickerKeyOrderMap());
        this._syncPickerConfirmButton();
    },

    /** 'visualBg.videoPicker.confirm.click' — commit toàn bộ `_pickerSelectedKeys`. */
    async confirmVideoPickerSelection() {
        if (this._pickerSelectedKeys.length === 0) return;
        const keys = this._pickerSelectedKeys.slice();
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
        await this._commitPickedKeys('video', keys);
    },

    cancelVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },
});
