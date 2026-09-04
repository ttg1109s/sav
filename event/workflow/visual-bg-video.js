/**
 * event/workflow/visual-bg-video.js — Workflow domain "Visual Background", phần RIÊNG cho Video:
 * áp/chuyển video trong `source.list`, "Fix time", stuck-recovery, panel "Âm thanh Video", picker
 * Video. `Object.assign()` thêm vào `workflowVisualBg` (định nghĩa ở event/workflow/
 * visual-bg-common.js, PHẢI nạp trước file này) — cùng 1 object, chỉ tách file tổ chức.
 * Vòng đời DOM thật của `bgVideoElement` (đổi nguồn/ẩn/hiện/dọn object URL) sống ở
 * event/workflow/video-player.js (workflowVideoPlayer), dùng chung cho cả Video Player mode thật
 * lẫn Visual Background trang trí.
 *
 * NẠP SAU: event/workflow/visual-bg-common.js, core/visual-bg-video.js.
 */
let visualBgVideoAudioPanelEl = null;

/** "Fix time": cưỡng chế chuyển video kế sau đúng `durationSeconds` giây, không chờ video tự phát hết. */
const VISUAL_BG_VIDEO_FIXTIME_TASK = 'visualBgVideoFixTime';

Object.assign(workflowVisualBg, {
    _isSwappingVideo: false, // guard chống race "video chạy/lặp/đen màn thất thường"
    _currentVideoKey: null,  // key video ĐANG THẬT SỰ nạp trong bgVideoElement (khác appState.currentKey — của bài hát/video đang phát thật)
    _videoAudioRows: null,   // cache {key,name}[] đọc lúc mở panel "Âm thanh Video"
    _stuckRecoveryTimer: null, // fallback taskManager.once() khi key hiện tại mất giữa lúc cycle mode 'slideshow'

    /** Video thật (nạp `bgVideoElement`/`play()`) chỉ nạp khi Song đang thật sự phát
     * (`!audioPlayer.paused`); nếu chưa, hiện thumb full-res tĩnh của item sẽ phát
     * (`workflowVideoPlayer.showStaticBgThumb()`) — không `play()` gì lúc Song còn im lặng. Song
     * bắt đầu phát thật -> `syncPlaybackToAudio()` tự nạp lại thật cho đúng `list[_listIndex]`. */
    async _applyVideo(cfg) {
        const list = cfg.source.list;
        let startList = list;
        let index = 0;
        if (list.length > 1) {
            const r = this.firstIndex(list, cfg.nextOrder === 'random');
            startList = r.list; index = r.index;
            if (startList !== list) {
                appConfigVisualBg.mutateAll((c) => { c.source.list = startList; });
                await this._persist();
            }
        }
        this._listIndex = index;
        const key = startList[index];
        if (!key) return;
        if (audioPlayer.paused) { if (typeof workflowVideoPlayer !== 'undefined') await workflowVideoPlayer.showStaticBgThumb(key); return; }
        await this._playVideoKey(key);
    },

    /** Ứng `bgVideoElement` tự bắn 'ended' khi KHÔNG ở Video Player mode (guard lọc sẵn ở
     * event/listener/visual-bg.js) — video mode 'slideshow' advance đúng lúc video thật sự phát
     * hết (`loop=false`, xem `_playVideoKey()`). perSong/list≤1 KHÔNG còn mặc định `loop=true` khi
     * có Audio B bật (`loop=false` lúc đó) — `ended` bắn thật, cần tự lặp lại CHÍNH nó thay vì
     * advance sang video khác, xem `_restartCurrentVideoInPlace()`. */
    async _onVideoEnded() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video') return;
        this._killVideoFixTimeTimer();
        const isCyclingSlideshow = cfg.listPlaybackMode === 'slideshow' && this._effectiveCount(cfg.source.list) > 1;
        if (!isCyclingSlideshow) { this._restartCurrentVideoInPlace(); return; }
        if (await this._checkAndApplyPendingSource()) return;
        await this._advanceVideo();
    },

    /** Video tự lặp lại CHÍNH nó (perSong, hoặc slideshow còn ≤1 item sống) khi `loop=false` (vì
     * có Audio B bật — xem `_playVideoKey()`), thay cho native `loop=true`: mute cưỡng chế -> seek
     * 0 -> play() -> đợi 'playing' thật -> bỏ mute -> áp setting đã lưu (cùng pattern
     * `_playVideoKey()`). Không qua `swapBgVideoSource()`/tải lại record — vẫn cùng 1 video. */
    _restartCurrentVideoInPlace() {
        const videoKey = this._currentVideoKey;
        if (!videoKey) return;
        bgVideoElement.muted = true;
        setVideoBgGain(0);
        bgVideoElement.currentTime = 0;
        bgVideoElement.play().catch(() => {});
        if (typeof workflowVideoPlayer === 'undefined') return;
        workflowVideoPlayer.waitForNextPlaying().then(() => {
            if (this._currentVideoKey === videoKey) this._applyVideoAudioSettingToElement(videoKey);
        });
    },

    /** Tính index/key kế tiếp ĐỒNG BỘ, xong hẳn rồi mới gán `this._listIndex` (không để khoảng hở
     * `await` chen giữa — gọi chồng giữa lúc đó sẽ đọc index CŨ, nạp lại y hệt video vừa phát).
     * Ghi lại `source.list` đã sweep/reshuffle (nếu chạm biên) chạy NGẦM, không `await` — không
     * chặn việc phát video kế chỉ vì đang ghi DB. list.length<=1 -> không cycle (`_applyVideo`). */
    async _advanceVideo() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.source.list.length <= 1) return;
        const { list, index } = this.advanceList(cfg.source.list, this._listIndex, cfg.nextOrder === 'random');
        if (index === -1) { await this.selfHealEmptySource(); return; }
        this._listIndex = index;
        if (list !== cfg.source.list) {
            appConfigVisualBg.mutateAll((c) => { c.source.list = list; });
            this._persist();
        }
        const key = list[index];
        if (!key) { this._killVideoFixTimeTimer(); this._hideVideoOnly(); this._scheduleStuckRecoveryTimer(cfg.listPlaybackMode, list); return; }
        await this._playVideoKey(key);
    },

    /** Chỉ ẩn video (KHÔNG đụng task/index) — dùng khi item hiện tại là null giữa lúc đang cycle. */
    _hideVideoOnly() {
        this._currentVideoKey = null;
        if (typeof workflowVideoPlayer !== 'undefined') workflowVideoPlayer.clearBgVideoSource();
    },

    /**
     * Advance mode 'slideshow' chỉ chạy qua sự kiện `ended` thật của `bgVideoElement` (xem
     * `_onVideoEnded()`). Key hiện tại null/mất record -> `_hideVideoOnly()` -> không video nào
     * đang phát -> `ended` không bao giờ bắn -> treo vĩnh viễn. Đặt fallback `taskManager.once()`
     * 5s (cùng khuôn `videoPlayingReadyFallback` ở `swapBgVideoSource()`) — tự gọi lại
     * `_advanceVideo()` nếu chưa có video nào khác kịp nạp. Chỉ áp dụng mode 'slideshow' + còn >1
     * item sống (list<=1 hoặc hết sạch item sống đã tự xử lý riêng, không phải ca "treo").
     * @param {string} listPlaybackMode
     * @param {Array<string|null>} list
     */
    _scheduleStuckRecoveryTimer(listPlaybackMode, list) {
        this._killStuckRecoveryTimer();
        if (listPlaybackMode !== 'slideshow' || list.filter((k) => k !== null).length <= 1) return;
        this._stuckRecoveryTimer = taskManager.once(() => { this._stuckRecoveryTimer = null; this._advanceVideo(); }, 5000, 'visualBgVideoStuckRecovery');
    },

    /** Huỷ fallback timer đang chờ (nếu có) — gọi mỗi khi hết "treo" (video mới đã nạp) hoặc VBG bị dọn hẳn. */
    _killStuckRecoveryTimer() {
        if (this._stuckRecoveryTimer) { this._stuckRecoveryTimer.kill(); this._stuckRecoveryTimer = null; }
    },

    /** Huỷ hẹn giờ "Fix time" đang chờ (nếu có) — gọi ở mọi điểm 1 video không còn là "video đang
     * phát nền cần theo dõi" nữa (sắp bị video khác đè lên, đã hết/bị cưỡng chế hết, hoặc không
     * còn key nào để hẹn giờ theo). Chỉ 1 task cố định tên `VISUAL_BG_VIDEO_FIXTIME_TASK`. */
    _killVideoFixTimeTimer() {
        taskManager.kill(VISUAL_BG_VIDEO_FIXTIME_TASK);
    },

    /** Đặt hẹn giờ cưỡng chế chuyển sang video kế đúng `cfg.durationSeconds` giây thay vì đợi video
     * tự phát hết — chỉ khi `durationMode==='fixtime'` + đang cycle nhiều video
     * (`isCyclingSlideshow`) + video thật sự dài hơn `durationSeconds` (ngắn hơn/bằng thì `ended`
     * thật đã tự bắn đúng lúc hoặc sớm hơn, không cần đặt thêm). Bắn -> gọi thẳng `_onVideoEnded()`
     * (chạy lại đúng đường advance/pending có sẵn); hàm đó tự đặt lại hẹn giờ mới cho video kế.
     * @param {object} cfg @param {boolean} isCyclingSlideshow */
    _maybeScheduleVideoFixTime(cfg, isCyclingSlideshow) {
        if (cfg.durationMode !== 'fixtime' || !isCyclingSlideshow) return;
        const videoKey = this._currentVideoKey;
        const durationSec = bgVideoElement.duration;
        if (!isFinite(durationSec) || durationSec <= cfg.durationSeconds) return;
        taskManager.once(() => {
            if (this._currentVideoKey !== videoKey) return;
            this._onVideoEnded();
        }, cfg.durationSeconds * 1000, VISUAL_BG_VIDEO_FIXTIME_TASK);
    },

    /**
     * Nạp/đổi video nền qua `workflowVideoPlayer.swapBgVideoSource()`/`waitBgVideoReady()` (dùng
     * chung với Video Player mode thật) — hàm này chỉ lo phần riêng của VBG: tôn trọng play/pause
     * của nhạc, KHÔNG await bước chờ 'playing' (VBG không có UI nào phải đợi).
     * `loop=true` CHỈ khi không cycle nhiều video (`perSong`/1 item) VÀ video không bật Audio B —
     * loop-restart native (trình duyệt tự seek+tiếp tục, không bắn `ended`) vẫn bị iOS
     * Safari/WKWebView coi là giành audio session mới nếu video đang audible thật, cưỡng chế pause
     * Song. Video có Audio B bật -> `loop=false`, tự lặp thủ công qua
     * `_onVideoEnded()`/`_restartCurrentVideoInPlace()` để kiểm soát đúng thời điểm "become audible".
     * Video LUÔN vào `play()` ở trạng thái câm cứng — gọi `play()` lúc video đã audible (muted đã
     * gỡ) là điều kiện khiến iOS cưỡng chế giành audio session/pause Song. Setting audio thật chỉ
     * áp SAU khi `waitBgVideoReady()` báo ổn định ('playing' hoặc timeout 2s) — mất đúng đoạn audio
     * [0, mốc 'playing'] (thường <1s), cùng mốc `hideUntilReady` dùng để lộ hình thật.
     * @param {string} videoKey
     */
    async _playVideoKey(videoKey) {
        if (
            (videoKey === this._currentVideoKey && workflowVideoPlayer._objectUrl && bgVideoElement.getAttribute('src') === workflowVideoPlayer._objectUrl)
            || this._isSwappingVideo
        ) return;
        this._killStuckRecoveryTimer();
        this._killVideoFixTimeTimer();
        bgVideoElement.muted = true;
        setVideoBgGain(0);
        const cfg = appConfigVisualBg.getAll();
        const isCyclingSlideshow = cfg.listPlaybackMode === 'slideshow' && this._effectiveCount(cfg.source.list) > 1;
        const { enabled: hasAudioB } = getVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey);
        bgVideoElement.loop = !isCyclingSlideshow && !hasAudioB;
        bgVideoElement.classList.remove('hidden');
        this._isSwappingVideo = true;
        const record = await workflowVideoPlayer.swapBgVideoSource(videoKey, true, null, true);
        this._isSwappingVideo = false;
        if (!record) { await this._markCurrentMissing(); return; }
        this._currentVideoKey = videoKey;
        updateDOMBackground();
        workflowVideoPlayer.waitBgVideoReady().then(() => {
            if (this._currentVideoKey !== videoKey) return;
            syncVisualBgVideoPlayback(audioPlayer.paused);
            this._applyVideoAudioSettingToElement(videoKey);
            this._maybeScheduleVideoFixTime(cfg, isCyclingSlideshow);
        });
    },

    /** Đọc cấu hình audio riêng của `videoKey` rồi gán thẳng `bgVideoElement.muted`/`.volume`. Gọi
     * SAU khi `waitBgVideoReady()` báo video ổn định (không phải trước `play()` — gọi `play()` lúc
     * video đã audible là nguồn cưỡng chế giành audio session iOS, không phải bản thân unmute).
     * `enabled=true` (Audio B thật sự cần phát cùng Song) mới nối `bgVideoElement` vào chung Web
     * Audio graph với `audioPlayer` — mặc định câm không đụng Web Audio. Đã nối graph thì
     * `.muted`/`.volume` không đáng tin (Firefox bugzilla #966247), dùng `setVideoBgGain()`
     * (GainNode riêng, core/video-player.js) làm nguồn tin cậy chính. */
    _applyVideoAudioSettingToElement(videoKey) {
        const { enabled, volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey);
        const gain = resolveVisualBgVideoAudioGain(volumePercent);
        bgVideoElement.muted = !enabled;
        bgVideoElement.volume = gain;
        if (enabled) {
            setupAudioContext();
            connectVideoElementToAnalyser();
            setVideoBgGain(gain);
        } else {
            setVideoBgGain(0);
        }
    },

    /** Đánh dấu vị trí hiện tại là mất + ẩn — không reset index/task, chờ advance() lần sau tự bước
     * tiếp (null-sweep). Không còn item sống -> tự chữa lành (gỡ source) luôn. Còn item sống -> đặt
     * fallback timer tránh treo, xem `_scheduleStuckRecoveryTimer()`. */
    async _markCurrentMissing() {
        const cfg = appConfigVisualBg.getAll();
        const newList = markVisualBgListItemMissing(cfg.source.list, this._listIndex);
        if (newList.filter((k) => k !== null).length === 0) { await this.clearSource(); return; }
        appConfigVisualBg.mutateAll((c) => { c.source.list = newList; });
        console.log(`writer: "workflowVisualBg._markCurrentMissing", page: "visualBgConfig", content: "source.list[${this._listIndex}]=null"`);
        await this._persist();
        this._hideVideoOnly();
        this._scheduleStuckRecoveryTimer(cfg.listPlaybackMode, newList);
    },

    /** (2) trong `syncPlaybackToAudio()` — resume video ĐÃ nạp sẵn, câm cứng lúc `play()`, unmute
     * SAU khi ổn định (`waitForNextPlaying()`) — CÙNG pattern `_playVideoKey()`, tránh cưỡng chế
     * giành audio session iOS đúng lúc Song cũng vừa `.play()`. Guard `_currentVideoKey ===
     * videoKey`: bỏ qua nếu đã có video KHÁC nạp đè lên trong lúc chờ.
     * @param {string} videoKey
     */
    _resumeVideoWithDelayedAudio(videoKey) {
        bgVideoElement.muted = true;
        setVideoBgGain(0);
        bgVideoElement.play().catch(() => {});
        if (typeof workflowVideoPlayer === 'undefined') return;
        workflowVideoPlayer.waitForNextPlaying().then(() => {
            if (this._currentVideoKey === videoKey) this._applyVideoAudioSettingToElement(videoKey);
        });
    },

    /** (4) trong `syncPlaybackToAudio()` — Song vừa dừng hẳn, video thật đang phát -> quay về
     * placeholder tĩnh CỦA ĐÚNG video đó (KHÔNG phải `list[0]`). Video thật bị dỡ hẳn (không chỉ
     * pause) — lần Song phát lại tiếp theo tự rơi vào nhánh (1), nạp lại từ đầu.
     */
    async _revertToPlaceholder() {
        const key = this._currentVideoKey;
        if (!key) return;
        this._currentVideoKey = null;
        if (typeof workflowVideoPlayer !== 'undefined') await workflowVideoPlayer.showStaticBgThumb(key);
    },

    /** Mở panel — đọc tên từng video (song song) rồi vẽ hàng. `_videoAudioRows` là bản chụp tại
     * thời điểm mở, không tự cập nhật nếu `source.list` đổi sau đó (cycle/reshuffle chạy nền) —
     * đóng mở lại panel để thấy danh sách mới. */
    async openVideoAudioPanel() {
        visualBgVideoAudioPanelEl = genericDrawerBody;
        const cfg = appConfigVisualBg.getAll();
        const keys = cfg.source.list.filter((k) => k !== null);
        const records = await Promise.all(keys.map((k) => getVideoRecord(k)));
        this._videoAudioRows = keys.map((key, i) => ({
            key,
            name: records[i] ? (records[i].customName || stripFileExtension(records[i].filename)) : key,
        }));
        this._renderVideoAudioRows(this._videoAudioRows, appConfigVisualBg.getAll().source.videoAudio);
    },

    /** Vẽ danh sách: tên video | icon loa (1, toggle ngay) | "x%" (2, mở modal chỉnh mức). */
    _renderVideoAudioRows(rows, videoAudioMap) {
        const listEl = visualBgVideoAudioPanelEl.querySelector('#visual-bg-video-audio-list');
        if (rows.length === 0) {
            listEl.innerHTML = `<div class="p-4 text-sm text-slate-400 text-center">${t('visualBgSettingsDrawer.videoAudio.empty')}</div>`;
            return;
        }
        listEl.innerHTML = rows.map(({ key, name }) => {
            const { enabled, volumePercent } = getVisualBgVideoAudioSetting(videoAudioMap, key);
            return `
            <div class="p-4 border-b border-white/5 last:border-b-0 flex items-center gap-2">
                <span class="text-sm font-medium truncate min-w-0 flex-1">${escapeHtml(name)}</span>
                <button type="button" data-visual-bg-video-audio-toggle="${escapeHtml(key)}" class="shrink-0 p-2 transition-colors">${this._videoAudioIconInnerHtml(enabled)}</button>
                <button type="button" data-visual-bg-video-audio-open-volume="${escapeHtml(key)}" class="shrink-0 px-1 py-2 transition-colors"><span data-visual-bg-video-audio-volume-display="${escapeHtml(key)}" class="text-xs font-mono tabular-nums ${enabled ? 'text-sky-400' : 'text-slate-500'}">${volumePercent}%</span></button>
            </div>`;
        }).join('');
    },

    /** Icon loa thường (bật) / loa gạch chéo (tắt) — DÙNG CHUNG lúc vẽ hàng lần đầu
     * (`_renderVideoAudioRows()`) LẪN lúc cập nhật lại đúng 1 nút sau khi toggle
     * (`_refreshVideoAudioRowButtons()`) — tránh viết trùng markup 2 chỗ. */
    _videoAudioIconInnerHtml(enabled) {
        const iconPath = enabled
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6v12M6 9v6a2 2 0 002 2h2l4 4V3l-4 4H8a2 2 0 00-2 2z" />'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12M6 9v6a2 2 0 002 2h2l4 4V3l-4 4H8a2 2 0 00-2 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9l4 6m0-6l-4 6" />';
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ${enabled ? 'text-sky-400' : 'text-slate-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">${iconPath}</svg>`;
    },

    /** Bấm icon (1): toggle bật/tắt ngay, không qua modal — đọc trạng thái hiện tại rồi đảo ngược. */
    async toggleVideoAudioEnabled(videoKey) {
        const { enabled } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey);
        await this.setVideoAudioSetting(videoKey, { enabled: !enabled });
    },

    /** Bấm "%" (2) của 1 hàng — mở modal dùng chung (core/slider-input-modal.js) CHỈ để chỉnh mức
     * âm lượng (không còn công tắc bật/tắt bên trong — đã dời ra icon (1), xem
     * `toggleVideoAudioEnabled()`). Đọc TÊN từ cache `_videoAudioRows` (đọc sẵn lúc mở panel, xem
     * `openVideoAudioPanel()`) — không đọc DB lần 2. */
    openVideoAudioVolumeModal(videoKey) {
        const row = (this._videoAudioRows || []).find((r) => r.key === videoKey);
        const { volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey);
        openSliderInputModal({
            title: t('visualBgSettingsDrawer.videoAudio.volumeModal.title'),
            hintText: row ? row.name : videoKey,
            min: 0,
            max: 100,
            step: 1,
            initialValue: volumePercent,
            unitSuffix: '%',
            onConfirm: (value) => this.setVideoAudioSetting(videoKey, { volumePercent: value }),
        });
    },

    /** Ghi 1 phần (`enabled` HOẶC `volumePercent`, hoặc cả 2) vào `source.videoAudio[videoKey]` —
     * dùng CHUNG cho cả toggle icon LẪN Áp dụng modal volume. Rule 3b: tự đọc `current` qua core A
     * rồi truyền vào core B. */
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

    /** Cập nhật lại ĐÚNG 2 nút (icon + %) của 1 hàng sau khi toggle/Áp dụng — thay `innerHTML`
     * icon qua `_videoAudioIconInnerHtml()` (tái dùng đúng markup lúc vẽ hàng lần đầu) + màu chữ %
     * theo `enabled` mới. */
    _refreshVideoAudioRowButtons(videoKey, setting) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const iconBtn = visualBgVideoAudioPanelEl.querySelector(`[data-visual-bg-video-audio-toggle="${CSS.escape(videoKey)}"]`);
        if (iconBtn) iconBtn.innerHTML = this._videoAudioIconInnerHtml(setting.enabled);
        const display = visualBgVideoAudioPanelEl.querySelector(`[data-visual-bg-video-audio-volume-display="${CSS.escape(videoKey)}"]`);
        if (display) {
            display.textContent = `${setting.volumePercent}%`;
            display.classList.toggle('text-sky-400', setting.enabled);
            display.classList.toggle('text-slate-500', !setting.enabled);
        }
    },

    /** `videoKey` vừa sửa audio TRÙNG video đang phát ngay lúc này -> áp lên DOM NGAY, không đợi
     * vòng cycle sau mới nghe thấy hiệu lực. */
    _applyLiveIfCurrentVideo(videoKey) {
        if (this._listIndex < 0) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type === 'video' && cfg.source.list[this._listIndex] === videoKey) this._applyVideoAudioSettingToElement(videoKey);
    },

    /** Video — mở picker multi-select (thay `openSingleVideoPicker()` cũ). */
    async openPickVideo() {
        this._pickerSelectedKeys = [];
        this._pickerCleanup = openMediaPickerDrawerUi(
            'visualBg', 'visualBg.videoPicker', t('fileManager.video.pickerTitle'),
            this._buildMultiPickerBodyHtml('file-manager-video-picker-scroll', 'file-manager-video-picker-empty', t('fileManager.video.empty')),
            '.video-tile', 'videoKey', true, true,
        );

        const videos = await listVideos();
        if (!this._pickerCleanup) return;

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: 'multiSelect', selectedKeys: new Map() });
    },

    /** Ứng 'visualBg.videoPicker.tile.click' — toggle chọn (KHÔNG commit/đóng ngay như "chọn 1" cũ). */
    toggleVideoPickerTile(videoKey) {
        this._togglePickerKey(videoKey);
        workflowVideoGalleryWindow.setBadgeMode('genericDrawer', 'multiSelect', this._pickerKeyOrderMap());
        this._syncPickerConfirmButton();
    },

    /** Ứng 'visualBg.videoPicker.confirm.click' — commit toàn bộ `_pickerSelectedKeys`. */
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
