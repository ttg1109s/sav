/**
 * event/workflow/visual-bg.js — Workflow domain "Visual Background" (v14, source hợp nhất 1 mảng).
 * Xung đột Video Player mode <-> Visual Background giải quyết bằng `clearMediaLayers()` (PUBLIC,
 * gọi chéo domain từ event/workflow/video-player.js lúc vào mode) + `applyCurrentVisualBg()` (gọi
 * lại lúc thoát) — KHÔNG còn Block gate chặn 2 chiều nào cho cặp này (Giang chốt).
 *
 * NẠP SAU: core/config.js, core/visual-bg.js, core/color-utils.js, service/db.js, service/state.js.
 * NẠP TRƯỚC: event/router/visual-bg.js.
 */
let visualBgSettingsPanelEl = null;
let visualBgGradientPanelEl = null;
let visualBgVideoAudioPanelEl = null;

const workflowVisualBg = {
    _listIndex: -1,            // vị trí hiện tại trong `source.list` — CHỈ dùng cho nhánh video ở đây
    _isSwappingVideo: false,   // MỚI (08/08/2026, fix race "video chạy/lặp/đen màn thất thường") — xem docstring _playVideoKey()/syncPlaybackToAudio()
    _colorPersistTimer: null,
    _videoAudioRows: null,     // MỚI (08/08/2026) — cache {key,name}[] đọc lúc mở panel "Âm thanh Video", xem openVideoAudioPanel()/openVideoAudioVolumeModal()

    // ===================== Boot / persist =====================

    /** Đọc lại `meta.visualBgConfig` + áp nền — gọi 1 lần lúc boot, SAU loadConfig(). */
    async loadPersistedSettingsOnBoot() {
        const saved = await getMeta('visualBgConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigVisualBg.mutateAll((cfg) => {
                if (VISUAL_BG_TYPES.includes(saved.type)) cfg.type = saved.type;
                if (saved.source && typeof saved.source === 'object') {
                    if (saved.source.originKind === null || ['single', 'group'].includes(saved.source.originKind)) cfg.source.originKind = saved.source.originKind;
                    if (saved.source.originId === null || typeof saved.source.originId === 'string') cfg.source.originId = saved.source.originId;
                    if (Array.isArray(saved.source.list)) cfg.source.list = saved.source.list.filter((k) => k === null || typeof k === 'string');
                    if (saved.source.videoAudio && typeof saved.source.videoAudio === 'object') {
                        // Validate TỪNG entry qua chính core getVisualBgVideoAudioSetting() (Rule 3b:
                        // Workflow tự gọi, không để core tự lặp/tự đọc object ngoài tham số) — clamp
                        // volumePercent + fallback enabled hỏng, loại key không phải string.
                        const cleaned = {};
                        Object.keys(saved.source.videoAudio).forEach((k) => {
                            if (typeof k !== 'string') return;
                            cleaned[k] = getVisualBgVideoAudioSetting(saved.source.videoAudio, k); // core/visual-bg.js
                        });
                        cfg.source.videoAudio = cleaned;
                    }
                }
                if (VISUAL_BG_LIST_PLAYBACK_MODES.includes(saved.listPlaybackMode)) cfg.listPlaybackMode = saved.listPlaybackMode;
                if (VISUAL_BG_NEXT_ORDERS.includes(saved.nextOrder)) cfg.nextOrder = saved.nextOrder;
                if (VISUAL_BG_COLOR_MODES.includes(saved.colorMode)) cfg.colorMode = saved.colorMode;
                if (typeof saved.solidColor === 'string') cfg.solidColor = saved.solidColor;
                if (typeof saved.gradientAngleDeg === 'number') cfg.gradientAngleDeg = saved.gradientAngleDeg;
                if (Array.isArray(saved.gradientStops) && saved.gradientStops.length >= VISUAL_BG_GRADIENT_MIN_STOPS && saved.gradientStops.length <= VISUAL_BG_GRADIENT_MAX_STOPS) cfg.gradientStops = saved.gradientStops;
                if (saved.slideshow && typeof saved.slideshow === 'object') {
                    const ss = saved.slideshow;
                    if (typeof ss.intervalSeconds === 'number' && ss.intervalSeconds >= 5) cfg.slideshow.intervalSeconds = ss.intervalSeconds;
                    if (SLIDESHOW_TRANSITION_TYPES.includes(ss.transitionType)) cfg.slideshow.transitionType = ss.transitionType;
                    if (typeof ss.transitionDurationMs === 'number' && ss.transitionDurationMs >= SLIDESHOW_TRANSITION_MIN_TIME_MS && ss.transitionDurationMs <= SLIDESHOW_TRANSITION_MAX_TIME_MS) cfg.slideshow.transitionDurationMs = ss.transitionDurationMs;
                    if (typeof ss.transitionInOutRatio === 'number' && ss.transitionInOutRatio >= 0 && ss.transitionInOutRatio <= 100) cfg.slideshow.transitionInOutRatio = ss.transitionInOutRatio;
                    if (SLIDESHOW_TRANSITION_EASINGS.includes(ss.transitionEasing)) cfg.slideshow.transitionEasing = ss.transitionEasing;
                    if (typeof ss.kenBurnsEnabled === 'boolean') cfg.slideshow.kenBurnsEnabled = ss.kenBurnsEnabled;
                    if (SLIDESHOW_KENBURNS_MODES.includes(ss.kenBurnsMode)) cfg.slideshow.kenBurnsMode = ss.kenBurnsMode;
                }
            });
            console.log(`writer: "workflowVisualBg.loadPersistedSettingsOnBoot", page: "visualBgConfig", content: "nạp lại từ meta"`);
        }
        // KHÔNG await ở đây (fix bug boot chặn playlist, mục 4) — applyCurrentVisualBg() cho nhánh
        // video tự nạp/phát nền ngầm, không giữ chuỗi boot() phía app-boot.js chờ nó.
        this.applyCurrentVisualBg();
    },

    async _persist() {
        await setMeta('visualBgConfig', appConfigVisualBg.getAll()); // service/db.js
    },

    /** Sửa 1 field con `slideshow` + persist — dùng bởi workflowSlideshow (panel "Tuỳ chỉnh Trình
     * chiếu", config sống ở domain này, liên tuyến domain Workflow->Workflow). */
    async mutateSlideshowSetting(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll((cfg) => { mutatorFn(cfg.slideshow); });
        console.log(`writer: "workflowVisualBg.mutateSlideshowSetting", page: "visualBgConfig", content: "slideshow.${logContent}"`);
        await this._persist();
    },

    // ===================== Áp dụng nền =====================

    /** Số item CÒN SỐNG trong `source.list` (loại null) — 3 trạng thái suy ra từ số này: 0 = ẩn
     * media, 1 = phát tĩnh, >1 = cycle. */
    _effectiveCount(cfg) {
        return cfg.source.list.filter((k) => k !== null).length;
    },

    // ===================== Bước index trong source.list — DÙNG CHUNG ảnh + video =====================
    // 3 hàm dưới đây là ĐIỂM TÍNH TOÁN DUY NHẤT cho "bước tiếp theo/lượt đầu" trong `source.list` —
    // nhánh video (_applyVideo/_advanceVideo ngay dưới) gọi NỘI BỘ, nhánh ảnh (workflowSlideshow,
    // event/workflow/slideshow.js) gọi LIÊN TUYẾN DOMAIN sang đây thay vì tự viết lại (nguồn sự thật
    // `source.list` vẫn thuộc domain này — cùng nguyên tắc ownership đã áp cho
    // persistSourceListMutation()/selfHealEmptySource() ở dưới).
    // SỬA 08/08/2026 (phản hồi Giang, thay cho core `advanceVisualBgList()` TỰ gọi
    // pickNextSlideshowIndexRandom/Sequential — core-gọi-core, vi phạm Rule 3): Workflow đứng NGOÀI,
    // tự gọi core A (`pickNext...`) lấy index, rồi tự chọn gọi core B nào (`advanceVisualBgList()`
    // hay `shuffleVisualBgListKeepingIndex()`) — đúng Rule 3b.

    /** RIÊNG `nextOrder==='random'`: index vừa tính rơi ĐÚNG vị trí CUỐI mảng -> xáo lại mảng NGAY
     * cho vòng sau (Giang chốt, core `shuffleVisualBgListKeepingIndex()` — giữ nguyên key tại vị trí
     * đó, không đổi ảnh/video đang phát). `sequential`/`playlist` không qua nhánh này. */
    _maybeReshuffleAtBoundary(list, index, isRandom) {
        if (!isRandom || index !== list.length - 1) return list;
        return shuffleVisualBgListKeepingIndex(list, index); // core/visual-bg.js
    },

    /** Chọn index LƯỢT ĐẦU (`currentIndex=-1`) — không qua `advanceVisualBgList()` (mảng vừa đọc từ
     * origin luôn sạch, chưa lẫn null nào cần dọn). Vẫn áp `_maybeReshuffleAtBoundary()` — lượt đầu
     * bốc trúng đúng vị trí cuối mảng thì cũng xáo lại như mọi lượt khác (đối xứng).
     * @param {Array<string|null>} list
     * @param {boolean} isRandom
     * @returns {{ list: Array<string|null>, index: number }}
     */
    firstIndex(list, isRandom) {
        const index = isRandom
            ? pickNextSlideshowIndexRandom(-1, list.length)      // core/file-manager/slideshow.js
            : pickNextSlideshowIndexSequential(-1, list.length); // core/file-manager/slideshow.js
        return { list: this._maybeReshuffleAtBoundary(list, index, isRandom), index };
    },

    /** Chọn index MỖI LƯỢT SAU (cycle) — tính `nextIndex` rồi hoặc xáo lại (chạm vị trí cuối, random)
     * hoặc áp bình thường qua core `advanceVisualBgList()` (tự sweep null nếu vừa hết 1 vòng).
     * @param {Array<string|null>} list
     * @param {number} currentIndex
     * @param {boolean} isRandom
     * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn.
     */
    advanceList(list, currentIndex, isRandom) {
        const nextIndex = isRandom
            ? pickNextSlideshowIndexRandom(currentIndex, list.length)      // core/file-manager/slideshow.js
            : pickNextSlideshowIndexSequential(currentIndex, list.length); // core/file-manager/slideshow.js
        const reshuffled = this._maybeReshuffleAtBoundary(list, nextIndex, isRandom);
        if (reshuffled !== list) return { list: reshuffled, index: nextIndex };
        return advanceVisualBgList(list, nextIndex); // core/visual-bg.js
    },

    /** Điểm đồng bộ DUY NHẤT giữa config và DOM — gọi lúc boot + sau mọi thay đổi. Màu LUÔN sơn
     * (kể cả media rỗng); media chỉ áp khi `source.list` còn ít nhất 1 item sống. */
    async applyCurrentVisualBg() {
        this.clearMediaLayers();
        updateDOMBackground(); // core/color-utils.js — độc lập, luôn vẽ
        const cfg = appConfigVisualBg.getAll();
        const count = this._effectiveCount(cfg);
        if (count === 0) return; // guard: chưa có nguồn/nguồn rỗng -> chỉ còn màu
        if (cfg.type === 'video') return this._applyVideo(cfg);
        return this._applyPhoto(cfg);
    },

    /** Dọn sạch lớp media đang hiện (video + ảnh dự phòng) — gọi TRƯỚC mọi lần áp lại. PUBLIC
     * (không dấu `_`) — `workflowVideoPlayer` cũng gọi được lúc vào Video Player mode, để nhường
     * `bgVideoElement` (liên tuyến domain, KHÔNG đụng `visualBgConfig` đã lưu — chỉ dọn DOM/task/
     * object URL runtime, resume lại nguyên vẹn lúc thoát Video Player mode qua
     * `applyCurrentVisualBg()`). */
    clearMediaLayers() {
        const { visualBgImageObjectUrl } = appState.get(['visualBgImageObjectUrl']);
        if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.stop();
        this._listIndex = -1;
        // SỬA (Giang chốt — bỏ hẳn logic video tự viết ở VBG, dùng THẲNG cơ chế dùng chung của
        // workflowVideoPlayer) — thay `hideVisualBgVideoElement()` (core/visual-bg.js, ĐÃ XOÁ) bằng
        // `clearBgVideoSource()`: cùng 1 nơi sở hữu vòng đời `bgVideoElement`/object URL của nó,
        // KHÔNG còn 2 bản logic lệch nhau giữa VBG và Video Player mode nữa.
        if (typeof workflowVideoPlayer !== 'undefined') workflowVideoPlayer.clearBgVideoSource(); // event/workflow/video-player.js — liên tuyến domain
        applyVisualBgImageToDOM(false, ''); // core/visual-bg.js — lớp ẢNH TĨNH (single photo); lớp thumb-dự-phòng-video workflowVideoPlayer tự lo riêng ở clearBgVideoSource()
        if (visualBgImageObjectUrl) revokeBlobUrl(visualBgImageObjectUrl);
        appState.set('visualBgImageObjectUrl', '');
    },

    /** list.length<=1 -> áp tĩnh trực tiếp (không qua engine ảnh); >1 -> giao cho
     * `workflowSlideshow` (transition/Ken Burns, đọc DB theo key khi cần). */
    async _applyPhoto(cfg) {
        const list = cfg.source.list;
        if (list.length <= 1) {
            if (list[0]) await this._playSinglePhotoKey(list[0]);
            return;
        }
        if (typeof workflowSlideshow !== 'undefined') await workflowSlideshow.startFromList(list, cfg.nextOrder);
    },

    /** Nguồn duy nhất mất (record không đọc được) -> không có gì để chờ advance() tiếp, tự chữa
     * lành hẳn (gỡ source) luôn thay vì đánh dấu null. */
    async _playSinglePhotoKey(imageKey) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !record.blob) { await this.clearSource(); return; }
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js
        appState.set('visualBgImageObjectUrl', objectUrl);
        applyVisualBgImageToDOM(true, objectUrl); // core/visual-bg.js
    },

    async _applyVideo(cfg) {
        const list = cfg.source.list;
        if (list.length <= 1) {
            if (list[0]) { this._listIndex = 0; await this._playVideoKey(list[0]); }
            return;
        }
        const { list: startList, index } = this.firstIndex(list, cfg.nextOrder === 'random');
        if (startList !== list) { // random bốc trúng vị trí cuối ngay lượt đầu -> đã xáo lại, ghi lại mảng mới
            appConfigVisualBg.mutateAll((c) => { c.source.list = startList; });
            await this._persist();
        }
        this._listIndex = index;
        await this._playVideoKey(startList[this._listIndex]);
        // SỬA (08/08/2026, phản hồi Giang — mục "video chạy/dừng/lặp/đen màn thất thường") — BỎ HẲN
        // taskManager hẹn giờ cố định (`cfg.slideshow.intervalSeconds`) từng dùng để tự chuyển video
        // kế. Field đó vốn thiết kế cho ẢNH (không có độ dài riêng, hẹn giờ CHÍNH LÀ định nghĩa "hiện
        // bao lâu"), bê nguyên sang VIDEO là sai — video có độ dài thật, hẹn giờ cố định không khớp
        // độ dài đó gây 3 kiểu lỗi tuỳ video ngắn/dài/vừa hơn mốc (xem báo cáo). Giang chốt: mode
        // 'slideshow' giờ đợi video tự phát HẾT thật (`loop=false`, xem `_playVideoKey()`), advance
        // qua sự kiện `ended` thật (`bgVideoElement` 'ended' -> event/listener/visual-bg.js ->
        // `visualBg.video.ended` -> `_onVideoEnded()` dưới) — KHÔNG còn hẹn giờ nào ở đây nữa.
    },

    /** Ứng với bài hát đổi thật ('visualBg.songChanged', router) khi type='video' + perSong. */
    async advanceForSongChange() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video' || cfg.listPlaybackMode !== 'perSong') return;
        await this._advanceVideo();
    },

    /** Ứng với `bgVideoElement` tự bắn 'ended' khi KHÔNG ở Video Player mode (guard đã lọc ở
     * event/listener/visual-bg.js, xem comment ở đó). MỚI (08/08/2026, phản hồi Giang) — THAY cho
     * taskManager hẹn giờ cố định đã bỏ (xem `_applyVideo()`) — video mode 'slideshow' giờ advance
     * đúng lúc video ĐÓ THẬT SỰ phát hết (`loop=false`, xem `_playVideoKey()`).
     * Guard `listPlaybackMode==='slideshow'` phòng thủ: `perSong`/`list.length<=1` luôn `loop=true`
     * nên trình duyệt vốn KHÔNG BAO GIỜ bắn `ended` cho 2 trường hợp đó — nhánh dưới chỉ chạy khi
     * đổi cấu hình đúng lúc sự kiện đang bay tới (hiếm, phòng thủ thuần, không phải luồng chính). */
    async _onVideoEnded() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video' || cfg.listPlaybackMode !== 'slideshow' || cfg.source.list.length <= 1) return;
        await this._advanceVideo();
    },

    /** 1 nhịp cycle nhánh video: bước index (dọn null nếu vừa hết 1 vòng) rồi phát/ẩn theo kết quả.
     * list.length<=1 -> không cycle (phát tĩnh, xem `_applyVideo`). */
    async _advanceVideo() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.source.list.length <= 1) return;
        const { list, index } = this.advanceList(cfg.source.list, this._listIndex, cfg.nextOrder === 'random');
        if (index === -1) { await this.selfHealEmptySource(); return; }
        if (list !== cfg.source.list) {
            appConfigVisualBg.mutateAll((c) => { c.source.list = list; });
            await this._persist();
        }
        this._listIndex = index;
        const key = list[index];
        if (!key) { this._hideVideoOnly(); return; } // null -> ẩn, chờ advance() lần sau
        await this._playVideoKey(key);
    },

    /** Chỉ ẩn video (KHÔNG đụng task/index) — dùng khi item hiện tại là null giữa lúc đang cycle. */
    _hideVideoOnly() {
        if (typeof workflowVideoPlayer !== 'undefined') workflowVideoPlayer.clearBgVideoSource(); // event/workflow/video-player.js — liên tuyến domain
    },

    /**
     * Nạp/đổi video nền — KHÔNG tự viết logic đổi src/poster/thumb nữa (Giang chốt: bỏ hẳn bản VBG
     * tự làm, dùng THẲNG cơ chế dùng chung với Video Player mode thật —
     * `workflowVideoPlayer.swapBgVideoSource()`/`waitBgVideoReady()`, event/workflow/video-
     * player.js). Hàm này chỉ còn lo phần RIÊNG của VBG: tôn trọng play/pause của nhạc, và KHÔNG
     * await bước chờ 'playing' (fix bug boot chặn playlist, mục 4 — Video Player mode LUÔN đợi vì
     * cần biết chắc mới đổi UI, VBG không có UI nào phải đợi cả).
     * SỬA (08/08/2026, phản hồi Giang — mục "video chạy/dừng/lặp/đen màn thất thường") — `loop`
     * KHÔNG còn cứng `true`: CHỈ `true` khi KHÔNG phải cycle nhiều video theo mode 'slideshow' (tức
     * `perSong` hoặc chỉ 1 item — video ĐÓ là toàn bộ nội dung, phải tự lặp mãi, không có gì để
     * chuyển sang). Cycle nhiều video mode 'slideshow' -> `loop=false`, đợi `ended` thật (xem
     * `_onVideoEnded()`) mới chuyển video kế — THAY cho taskManager hẹn giờ cố định đã bỏ.
     * SỬA (08/08/2026, phản hồi Giang) — `muted` KHÔNG còn cứng `true`: áp `_applyVideoAudioSettingToElement()`
     * TRƯỚC `swapBgVideoSource()` (đúng thứ tự cũ, để trình duyệt nhận đúng trạng thái muted NGAY
     * lúc `play()` bên trong hàm đó chạy — gỡ muted SAU khi play() đã gọi có thể vẫn bị autoplay
     * policy chặn âm). Coi việc người dùng đã bấm Play nhạc chính là đủ điều kiện tương tác để gỡ
     * muted an toàn (Giang chốt) — không thêm gate/catch riêng.
     * @param {string} videoKey
     */
    async _playVideoKey(videoKey) {
        this._applyVideoAudioSettingToElement(videoKey); // core/visual-bg.js lookup + gán muted/volume — xem docstring trên
        const cfg = appConfigVisualBg.getAll();
        const isCyclingSlideshow = cfg.listPlaybackMode === 'slideshow' && this._effectiveCount(cfg) > 1;
        bgVideoElement.loop = !isCyclingSlideshow; // xem docstring trên — SỬA 08/08/2026
        bgVideoElement.classList.remove('hidden');
        // MỚI (08/08/2026, fix "video chạy/hết/lặp lại chính nó/đen màn thất thường") — bọc
        // `_isSwappingVideo` quanh TOÀN BỘ khoảng chờ `swapBgVideoSource()` (có `await
        // getVideoRecord()` bên trong, độ trễ đọc DB thật, không phải 0ms). Video vừa hết
        // (`ended`) nhưng CHƯA đổi `src` xong (đang ở khoảng chờ này) mà `syncPlaybackToAudio()`
        // bắn TRÙNG lúc (bài hát đang nghe tự play/pause — HOÀN TOÀN độc lập với video, không liên
        // quan gì tới việc video vừa hết) sẽ gọi `bgVideoElement.play()` lên video VỪA HẾT đó —
        // theo đúng spec HTML, `play()` trên 1 `<video>` đã ở cuối (currentTime=duration, loop=
        // false) tự động SEEK VỀ 0 rồi phát lại — đúng hiện tượng "lặp lại chính nó vài giây" đã
        // báo cáo. Guard ở `syncPlaybackToAudio()` (ngay dưới) chặn lời gọi rơi đúng khoảng chờ
        // này — trạng thái play/pause của nhạc vẫn được áp lại ĐÚNG ngay sau khi swap xong (dòng
        // `syncVisualBgVideoPlayback()` cuối hàm này), không mất hiệu lực, chỉ dời lại đúng lúc an
        // toàn.
        this._isSwappingVideo = true;
        const record = await workflowVideoPlayer.swapBgVideoSource(videoKey, true); // event/workflow/video-player.js — liên tuyến domain, isTransition=true LUÔN (VBG cần lớp dự phòng cả lúc áp lần đầu, không phân biệt như Video Player mode)
        this._isSwappingVideo = false;
        if (!record) { await this._markCurrentMissing(); return; }
        updateDOMBackground(); // core/color-utils.js
        syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js — video trang trí phải tôn trọng trạng thái pause/play của nhạc
        workflowVideoPlayer.waitBgVideoReady(); // KHÔNG await (fix bug boot chặn playlist, mục 4) — chỉ để dọn lớp thumb dự phòng đúng lúc
    },

    /** Đọc cấu hình audio riêng của `videoKey` (core `getVisualBgVideoAudioSetting()`) rồi gán thẳng
     * `bgVideoElement.muted`/`.volume` — DOM 1 dòng, không cần core DOM riêng (cùng khuôn `.loop`/
     * `.classList` viết thẳng ở Workflow trước giờ). Gọi lúc phát video (TRƯỚC play(), xem
     * `_playVideoKey()`) VÀ lúc user Áp dụng modal audio ngay khi video đó đang là video ĐANG PHÁT
     * (áp live, không cần đợi vòng cycle sau — xem `setVideoAudioSetting()`). */
    _applyVideoAudioSettingToElement(videoKey) {
        const { enabled, volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey); // core/visual-bg.js
        bgVideoElement.muted = !enabled;
        bgVideoElement.volume = volumePercent / 100;
    },

    /** Đánh dấu vị trí hiện tại là mất + ẩn — KHÔNG reset index/task, chờ advance() lần sau tự bước
     * tiếp (Giang chốt, cơ chế null-sweep). Dọn xong mà KHÔNG còn item sống nào -> tự chữa lành hẳn
     * (gỡ source) luôn, không đợi advance() phát hiện ra ở lượt sau. */
    async _markCurrentMissing() {
        const newList = markVisualBgListItemMissing(appConfigVisualBg.getAll().source.list, this._listIndex); // core/visual-bg.js
        if (newList.filter((k) => k !== null).length === 0) { await this.clearSource(); return; }
        appConfigVisualBg.mutateAll((cfg) => { cfg.source.list = newList; });
        console.log(`writer: "workflowVisualBg._markCurrentMissing", page: "visualBgConfig", content: "source.list[${this._listIndex}]=null"`);
        await this._persist();
        this._hideVideoOnly();
    },

    /** `source.list` rỗng sau sweep -> tự gỡ hẳn nguồn (cùng hành vi nút "Gỡ nguồn" thủ công). PUBLIC
     * (không dấu `_`) — `workflowSlideshow` cũng gọi được (liên tuyến domain, nguồn sự thật vẫn ở
     * domain này). */
    async selfHealEmptySource() {
        console.log(`writer: "workflowVisualBg.selfHealEmptySource", page: "visualBgConfig", content: "source rỗng sau sweep -> tự gỡ"`);
        await this.clearSource();
    },

    /** `workflowSlideshow` gọi khi tự sweep/mark-null mảng ảnh lúc cycle — nguồn sự thật `source.list`
     * vẫn thuộc domain này (Rule ownership), nơi kia chỉ BÁO thay đổi lại. */
    async persistSourceListMutation(list) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source.list = list; });
        await this._persist();
    },

    /** Đồng bộ play/pause video nền theo nhạc — gọi từ core/player-controls.js + mỗi lần Next/Prev.
     * Guard `_isSwappingVideo` (xem docstring `_playVideoKey()`) — bỏ qua lời gọi rơi đúng lúc đang
     * đổi src video (video CŨ vừa hết, video MỚI chưa gán xong): gọi `play()`/`pause()` lên
     * `bgVideoElement` lúc này sẽ nhắm NHẦM vào video CŨ đã ở cuối, gây phát lại từ đầu ngoài ý
     * muốn. An toàn bỏ qua — `_playVideoKey()` tự áp lại ĐÚNG trạng thái này ngay khi swap xong. */
    syncPlaybackToAudio() {
        if (this._isSwappingVideo) return;
        syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js
    },

    // ===================== Chọn / Làm tươi / Gỡ nguồn =====================

    /** Đọc key THẬT của 1 origin tại thời điểm gọi — 1 key (single) hay N key (group), đã sắp theo
     * `nextOrder`. Không cache.
     * @param {'photo'|'video'} type
     * @param {'single'|'group'} originKind
     * @param {string} originId
     * @returns {Promise<string[]>}
     */
    async _readOriginKeys(type, originKind, originId) {
        if (originKind === 'single') return originId ? [originId] : [];
        if (type === 'video') {
            const map = await getFolderSongMap(originId); // service/db.js
            return this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []); // core/file-manager/folder.js
        }
        const album = await getAlbumRecord(originId); // service/db.js
        return this._applyNextOrderToKeys(type, album && Array.isArray(album.imageKeys) ? album.imageKeys.slice() : []);
    },

    /** Sắp `keys` theo `nextOrder` hiện tại — 'sequential'/'random' giữ nguyên thứ tự gốc (random tự
     * bốc mỗi lượt advance, không cần sắp trước); 'playlist' đọc thêm record để áp
     * `appConfigPlaylist.displaySortMode`. */
    async _applyNextOrderToKeys(type, keys) {
        if (appConfigVisualBg.getAll().nextOrder !== 'playlist' || keys.length === 0) return keys;
        const records = await Promise.all(keys.map((k) => (type === 'video' ? getVideoRecord(k) : getImageRecord(k)))); // service/db.js
        const items = keys.map((k, i) => ({
            key: k,
            name: records[i] ? (type === 'video' ? (records[i].customName || stripFileExtension(records[i].filename)) : records[i].filename) : k, // core/file-manager/video.js
            addedAt: records[i] ? records[i].addedAt : 0,
        }));
        const mode = appConfigPlaylist.getAll().displaySortMode;
        const sorted = (mode === 'newest' || mode === 'oldest') ? sortVisualBgItemsByAddedAt(items, mode === 'newest') : sortVisualBgItemsByName(items, mode === 'za'); // core/visual-bg.js
        return sorted.map((it) => it.key);
    },

    /** Lối tắt "Dùng làm nền Slideshow" từ thanh quản lý Album — đặt `type='photo'` + nguồn = album
     * vừa chọn trong 1 lần gọi. Gọi chéo domain từ event/workflow/file-manager-photo.js.
     * @param {string} albumId
     */
    async applyAlbumAsBackground(albumId) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.type = 'photo'; });
        await this._resolveAndCommitSource('group', albumId);
    },

    /** Đọc lại origin + ghi đè `source.list` — dùng CHUNG cho lúc CHỌN nguồn lẫn bấm "Làm tươi".
     * Origin đọc ra rỗng (album/folder/ảnh/video không còn tồn tại) -> gỡ hẳn (Giang chốt mục 2).
     * SỬA (08/08/2026, phản hồi Giang — "video key không còn tồn tại nữa là lưu trữ không cần
     * thiết") — XOÁ HẲN `source.videoAudio` (không giữ lại bất kỳ entry nào, kể cả video vẫn còn
     * mặt trong list mới) mỗi lần gọi hàm này — tức CẢ chọn nguồn MỚI lẫn "Làm tươi" nguồn CŨ đều
     * làm sạch. Trước đây field này sống ĐỘC LẬP với `source.list`/`originKind`/`originId` (chỉ bị
     * xoá lúc đổi `type`/`clearSource()`) — Giang chốt: KHÔNG còn "nhớ mãi theo video" nữa, ghi đè
     * lại từ đầu theo ĐÚNG source hiện tại mỗi lần origin được đọc lại, tránh tích luỹ rác của
     * video key không còn dùng.
     * @param {'single'|'group'} originKind
     * @param {string} originId
     * @returns {Promise<{added: number, removed: number, total: number}|null>} diff so với
     *   `source.list` TRƯỚC lúc gọi — CHỈ có ý nghĩa khi origin GIỮ NGUYÊN (nút "Làm tươi"); lúc
     *   chọn nguồn MỚI (origin khác), diff này không mang nghĩa gì, caller tự bỏ qua. `null` nếu bị
     *   gỡ hẳn (origin rỗng).
     */
    async _resolveAndCommitSource(originKind, originId) {
        const cfg = appConfigVisualBg.getAll();
        const previousKeys = new Set(cfg.source.list.filter((k) => k !== null));
        const keys = await this._readOriginKeys(cfg.type, originKind, originId);
        if (keys.length === 0) { await this.clearSource(); return null; }
        const newKeysSet = new Set(keys);
        const added = keys.filter((k) => !previousKeys.has(k)).length;
        const removed = [...previousKeys].filter((k) => !newKeysSet.has(k)).length;
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = keys;
            c.source.videoAudio = {}; // xem docstring trên — Giang chốt, xoá sạch mỗi lần đọc lại origin
        });
        console.log(`writer: "workflowVisualBg._resolveAndCommitSource", page: "visualBgConfig", content: "source=${originKind}:${originId}, count=${keys.length}, +${added}/-${removed}, videoAudio=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return { added, removed, total: keys.length };
    },

    /** Ứng nút "Làm tươi" — đọc lại ĐÚNG origin đã lưu, ghi đè `source.list`. Có hiệu ứng xoay trên
     * nút trong lúc đọc DB + modal báo THAY ĐỔI GÌ sau khi xong (Giang chốt mục 2). */
    async refreshSource() {
        const { originKind, originId } = appConfigVisualBg.getAll().source;
        if (!originKind || !originId) return; // guard: chưa có nguồn
        const btn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-refresh-source') : null;
        if (btn) { btn.disabled = true; btn.classList.add('animate-spin'); }
        try {
            const result = await this._resolveAndCommitSource(originKind, originId);
            if (!result) { await alertModal(t('visualBgSettingsDrawer.refreshSource.resultCleared')); return; }
            if (result.added === 0 && result.removed === 0) { await alertModal(tFormat('visualBgSettingsDrawer.refreshSource.resultUnchanged', { total: result.total })); return; }
            await alertModal(tFormat('visualBgSettingsDrawer.refreshSource.result', { added: result.added, removed: result.removed, total: result.total }));
        } finally {
            if (btn) { btn.disabled = false; btn.classList.remove('animate-spin'); }
        }
    },

    /** Gỡ hẳn nguồn hiện tại — về "chưa chọn" (đường DUY NHẤT, không còn Block gate chặn xoá ảnh/
     * video/album/folder — Batch 3). */
    async clearSource() {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source = { originKind: null, originId: null, list: [], videoAudio: {} }; });
        console.log(`writer: "workflowVisualBg.clearSource", page: "visualBgConfig", content: "source=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Kiểu: Ảnh/Video" — chỉ 1 đường source (Giang chốt), đổi type = gỡ hẳn source cũ
     * (key khác kiểu vô nghĩa ở type mới), chọn lại từ đầu. */
    async changeType(value) {
        if (!VISUAL_BG_TYPES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.type = value; cfg.source = { originKind: null, originId: null, list: [], videoAudio: {} }; });
        console.log(`writer: "workflowVisualBg.changeType", page: "visualBgConfig", content: "type=${value} (gỡ source cũ)"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Cách phát" (chỉ có ý nghĩa khi list.length > 1). */
    async changeListPlaybackMode(value) {
        if (!VISUAL_BG_LIST_PLAYBACK_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.listPlaybackMode = value; });
        console.log(`writer: "workflowVisualBg.changeListPlaybackMode", page: "visualBgConfig", content: "listPlaybackMode=${value}"`);
        await this._persist();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Thứ tự kế tiếp" — origin là group thì dựng lại `source.list` theo thứ tự mới
     * ngay (đọc lại origin, như 1 lượt Làm tươi); origin single thì thứ tự không có ý nghĩa. */
    async changeNextOrder(value) {
        if (!VISUAL_BG_NEXT_ORDERS.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.nextOrder = value; });
        console.log(`writer: "workflowVisualBg.changeNextOrder", page: "visualBgConfig", content: "nextOrder=${value}"`);
        await this._persist();
        const { originKind, originId } = appConfigVisualBg.getAll().source;
        if (originKind === 'group') await this._resolveAndCommitSource(originKind, originId);
        else await this.applyCurrentVisualBg();
    },

    // ===================== Panel màu (độc lập, luôn active) =====================

    _commitColorChange(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll(mutatorFn);
        console.log(`writer: "workflowVisualBg._commitColorChange", page: "visualBgConfig", content: "${logContent}"`);
        updateDOMBackground(); // core/color-utils.js
        clearTimeout(this._colorPersistTimer);
        this._colorPersistTimer = setTimeout(() => this._persist(), 300);
    },

    async changeColorMode(value) {
        if (!VISUAL_BG_COLOR_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.colorMode = value; });
        console.log(`writer: "workflowVisualBg.changeColorMode", page: "visualBgConfig", content: "colorMode=${value}"`);
        updateDOMBackground();
        await this._persist();
        await this.refreshPanelUI();
    },

    changeSolidColor(value) {
        this._commitColorChange((cfg) => { cfg.solidColor = value; }, `solidColor=${value}`);
    },

    changeGradientAngle(value) {
        const deg = Number(value);
        if (!Number.isFinite(deg)) return;
        this._commitColorChange((cfg) => { cfg.gradientAngleDeg = deg; }, `gradientAngleDeg=${deg}`);
        if (!visualBgGradientPanelEl) return;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = `${deg}°`;
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    changeGradientStop(index, field, value) {
        const parsed = field === 'position' ? Number(value) : value;
        if (field === 'position' && !Number.isFinite(parsed)) return;
        this._commitColorChange((cfg) => {
            if (!cfg.gradientStops[index]) return; // guard: hàng vừa bị xoá ở thao tác khác
            cfg.gradientStops[index] = { ...cfg.gradientStops[index], [field]: parsed };
        }, `gradientStops[${index}].${field}=${parsed}`);
        if (!visualBgGradientPanelEl) return;
        if (field === 'position') visualBgGradientPanelEl.querySelector(`[data-visual-bg-stop-label="${index}"]`).textContent = `${parsed}%`;
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    addGradientStop() {
        this._commitColorChange((cfg) => { cfg.gradientStops = addVisualBgGradientStop(cfg.gradientStops); }, 'gradientStops +1'); // core/visual-bg.js
        if (!visualBgGradientPanelEl) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    removeGradientStop(index) {
        this._commitColorChange((cfg) => { cfg.gradientStops = removeVisualBgGradientStop(cfg.gradientStops, index); }, `gradientStops -1 (index ${index})`); // core/visual-bg.js
        if (!visualBgGradientPanelEl) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    openGradientPanel() {
        visualBgGradientPanelEl = pushSettingsPanel({ title: t('visualBgSettingsDrawer.openGradient.label'), bodyHtml: renderVisualBgGradientPanelBody() }); // core/settings-panel-stack-ui.js
        const cfg = appConfigVisualBg.getAll();
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-angle').value = cfg.gradientAngleDeg;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = `${cfg.gradientAngleDeg}°`;
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    _renderGradientStopRows(stops) {
        const listEl = visualBgGradientPanelEl.querySelector('#visual-bg-gradient-stop-list');
        const canRemove = stops.length > VISUAL_BG_GRADIENT_MIN_STOPS; // core/visual-bg.js
        listEl.innerHTML = stops.map((stop, i) => `
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" data-visual-bg-stop-color="${i}" value="${stop.color}" class="w-11 h-11 -m-2 cursor-pointer bg-transparent border-0"></div>
                <input type="range" data-visual-bg-stop-position="${i}" min="0" max="100" step="1" value="${stop.position}" class="flex-1 accent-sky-500">
                <span data-visual-bg-stop-label="${i}" class="text-xs text-slate-400 w-10 text-right tabular-nums">${stop.position}%</span>
                <button type="button" data-visual-bg-stop-remove="${i}" class="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors shrink-0 ${canRemove ? '' : 'opacity-30 pointer-events-none'}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `).join('');
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-add').classList.toggle('opacity-30', stops.length >= VISUAL_BG_GRADIENT_MAX_STOPS); // core/visual-bg.js
    },

    _paintGradientPreview(cfg) {
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-preview').style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg); // core/visual-bg.js
    },

    // ===================== Sub-panel "Âm thanh Video" (MỚI, 08/08/2026, phản hồi Giang) =====================
    // Bật/tắt + volume% audio RIÊNG cho từng video trong `source.list` — áp dụng CẢ single lẫn list
    // (Giang chốt). CÙNG khuôn sub-panel Gradient ngay trên: push/pop qua Settings Stack, danh sách
    // hàng vẽ ĐỘNG bởi `_renderVideoAudioRows()`, template khung rỗng ở
    // components/visual-bg-video-audio-drawer.js.

    /** Mở panel — đọc TÊN từng video (song song, giống `_applyNextOrderToKeys()`) rồi vẽ hàng.
     * SỬA (08/08/2026, phản hồi Giang, mục "kiểm tra" 1) — `_videoAudioRows` là bản CHỤP (snapshot)
     * tại thời điểm mở, KHÔNG tự đổi theo nếu `source.list` đổi SAU đó trong lúc panel đang mở (ví
     * dụ video tự cycle/null-sweep/reshuffle chạy NỀN — có thể xảy ra thật, không chỉ giả thuyết, kể
     * từ khi video mode 'slideshow' tự advance qua `ended()` thay vì hẹn giờ). Giang CHƯA yêu cầu
     * làm sống động real-time — giữ nguyên hành vi snapshot, đóng mở lại panel để thấy danh sách
     * mới nếu source.list đã đổi. */
    async openVideoAudioPanel() {
        visualBgVideoAudioPanelEl = pushSettingsPanel({ title: t('visualBgSettingsDrawer.openVideoAudio.label'), bodyHtml: renderVisualBgVideoAudioPanelBody() }); // core/settings-panel-stack-ui.js
        const cfg = appConfigVisualBg.getAll();
        const keys = cfg.source.list.filter((k) => k !== null);
        const records = await Promise.all(keys.map((k) => getVideoRecord(k))); // service/db.js
        this._videoAudioRows = keys.map((key, i) => ({
            key,
            name: records[i] ? (records[i].customName || stripFileExtension(records[i].filename)) : key, // core/file-manager/video.js
        })); // cache TÊN — dùng lại lúc mở modal volume (openVideoAudioVolumeModal()), tránh đọc DB lần 2
        this._renderVideoAudioRows(this._videoAudioRows, appConfigVisualBg.getAll().source.videoAudio);
    },

    /** SỬA (08/08/2026, phản hồi Giang — "Name video | icon (1) | x% (2), nhấn (1) toggle, nhấn (2)
     * mở modal") — TÁCH lại thành 2 control riêng biệt (khác bản gộp-1-nút-mở-modal-có-công-tắc lượt
     * trước): (1) icon loa — bấm là TOGGLE bật/tắt NGAY, không qua modal; (2) "x%" — bấm mở modal
     * dùng chung CHỈ để chỉnh %, không còn công tắc bên trong (đã dời hẳn ra icon (1)). */
    _renderVideoAudioRows(rows, videoAudioMap) {
        const listEl = visualBgVideoAudioPanelEl.querySelector('#visual-bg-video-audio-list');
        if (rows.length === 0) {
            listEl.innerHTML = `<div class="p-4 text-sm text-slate-400 text-center">${t('visualBgSettingsDrawer.videoAudio.empty')}</div>`;
            return;
        }
        listEl.innerHTML = rows.map(({ key, name }) => {
            const { enabled, volumePercent } = getVisualBgVideoAudioSetting(videoAudioMap, key); // core/visual-bg.js
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
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6v12M6 9v6a2 2 0 002 2h2l4 4V3l-4 4H8a2 2 0 00-2 2z" />' // loa thường (2 vòng sóng)
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12M6 9v6a2 2 0 002 2h2l4 4V3l-4 4H8a2 2 0 00-2 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9l4 6m0-6l-4 6" />'; // loa GẠCH CHÉO (thay vòng sóng bằng dấu X)
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ${enabled ? 'text-sky-400' : 'text-slate-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">${iconPath}</svg>`;
    },

    /** MỚI (08/08/2026) — bấm icon (1): toggle bật/tắt NGAY, không qua modal. Đọc trạng thái hiện
     * tại rồi đảo ngược — Rule 3b (tự đọc current qua core A rồi truyền patch vào core B, xem
     * `setVideoAudioSetting()`). */
    async toggleVideoAudioEnabled(videoKey) {
        const { enabled } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey); // core/visual-bg.js
        await this.setVideoAudioSetting(videoKey, { enabled: !enabled });
    },

    /** Bấm "%" (2) của 1 hàng — mở modal dùng chung (core/slider-input-modal.js) CHỈ để chỉnh mức
     * âm lượng (không còn công tắc bật/tắt bên trong — đã dời ra icon (1), xem
     * `toggleVideoAudioEnabled()`). Đọc TÊN từ cache `_videoAudioRows` (đọc sẵn lúc mở panel, xem
     * `openVideoAudioPanel()`) — không đọc DB lần 2. */
    openVideoAudioVolumeModal(videoKey) {
        const row = (this._videoAudioRows || []).find((r) => r.key === videoKey);
        const { volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey); // core/visual-bg.js
        openSliderInputModal({ // core/slider-input-modal.js
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
        const current = getVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey); // core/visual-bg.js
        const nextMap = setVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey, current, patch); // core/visual-bg.js
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
        if (!visualBgVideoAudioPanelEl) return;
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

    // ===================== Panel Settings =====================

    async openPanel() {
        visualBgSettingsPanelEl = pushSettingsPanel({ title: t('visualBgSettingsDrawer.title'), bodyHtml: renderVisualBgPanelBody() }); // core/settings-panel-stack-ui.js
        await this.refreshPanelUI();
    },

    /** Đồng bộ UI panel theo config hiện tại — gọi lúc mở panel + sau mọi thay đổi field. */
    async refreshPanelUI() {
        if (!visualBgSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll();
        const q = (sel) => visualBgSettingsPanelEl.querySelector(sel);

        const typeSelect = q('#setting-visual-bg-type');
        if (typeSelect) typeSelect.value = cfg.type;

        // Nhãn 2 nút Chọn phải đúng ngữ cảnh Ảnh/Video (Giang chốt) — gán qua DOM API (Rule 5d),
        // không phải data-i18n tĩnh vì phụ thuộc `cfg.type`.
        const pickSingleBtn = q('#setting-visual-bg-pick-single');
        const pickGroupBtn = q('#setting-visual-bg-pick-group');
        if (pickSingleBtn) pickSingleBtn.textContent = t(cfg.type === 'video' ? 'visualBgSettingsDrawer.pickSingle.video' : 'visualBgSettingsDrawer.pickSingle.photo');
        if (pickGroupBtn) pickGroupBtn.textContent = t(cfg.type === 'video' ? 'visualBgSettingsDrawer.pickGroup.video' : 'visualBgSettingsDrawer.pickGroup.photo');

        const listPlaybackSelect = q('#setting-visual-bg-list-playback-mode');
        const listPlaybackRow = q('#visual-bg-list-playback-row');
        const nextOrderRow = q('#visual-bg-next-order-row');
        const nextOrderSelect = q('#setting-visual-bg-next-order');
        const slideshowRow = q('#setting-visual-bg-open-slideshow');
        if (listPlaybackSelect) listPlaybackSelect.value = cfg.listPlaybackMode;
        if (nextOrderSelect) nextOrderSelect.value = cfg.nextOrder;

        const count = this._effectiveCount(cfg);
        const isList = count > 1;
        const isListPhoto = isList && cfg.type === 'photo';
        if (listPlaybackRow) listPlaybackRow.classList.toggle('hidden', !isList);
        if (nextOrderRow) nextOrderRow.classList.toggle('hidden', !isList);
        if (slideshowRow) slideshowRow.classList.toggle('hidden', !(isListPhoto && cfg.listPlaybackMode === 'slideshow'));

        // MỚI (08/08/2026) — hàng mở panel "Âm thanh Video": hiện khi type='video' VÀ còn ≥1 item
        // sống (Giang chốt — áp dụng CẢ single lẫn list, khác `slideshowRow` chỉ dành cho list ảnh).
        const videoAudioRow = q('#setting-visual-bg-open-video-audio');
        if (videoAudioRow) videoAudioRow.classList.toggle('hidden', !(cfg.type === 'video' && count >= 1));

        const colorModeSelect = q('#setting-visual-bg-color-mode');
        const openGradientBtn = q('#setting-visual-bg-open-gradient');
        const solidColorRow = q('#visual-bg-solid-color-row');
        const solidColorInput = q('#setting-visual-bg-solid-color');
        const gradientSwatch = q('#visual-bg-gradient-swatch');
        const isGradient = cfg.colorMode === 'gradient';
        if (colorModeSelect) colorModeSelect.value = cfg.colorMode;
        if (solidColorRow) solidColorRow.classList.toggle('hidden', isGradient);
        if (openGradientBtn) openGradientBtn.classList.toggle('hidden', !isGradient);
        if (solidColorInput) solidColorInput.value = cfg.solidColor;
        if (gradientSwatch) gradientSwatch.style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg); // core/visual-bg.js

        await this._refreshSourceNameLabel(cfg);
    },

    /** Ghi tên nguồn đang chọn vào `#visual-bg-source-name` + hiện/ẩn nút Làm tươi/Gỡ nguồn theo
     * có origin hay không. */
    async _refreshSourceNameLabel(cfg) {
        const labelEl = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#visual-bg-source-name') : null;
        const refreshBtn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-refresh-source') : null;
        const clearBtn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-clear-source') : null;
        const { originKind, originId } = cfg.source;
        if (refreshBtn) refreshBtn.classList.toggle('hidden', !originId);
        if (clearBtn) clearBtn.classList.toggle('hidden', !originId);
        if (!labelEl) return;
        if (!originId) { labelEl.textContent = t('visualBgSettingsDrawer.pickSource.none'); return; }
        labelEl.textContent = await this._readSourceDisplayName(cfg.type, originKind, originId);
    },

    /** Đọc tên hiển thị thật của 1 origin (imageKey/videoKey/albumId/folderId). */
    async _readSourceDisplayName(type, originKind, originId) {
        const none = t('visualBgSettingsDrawer.pickSource.none');
        if (originKind === 'group' && type === 'photo') {
            const album = await getAlbumRecord(originId); // service/db.js
            return album ? album.name : none;
        }
        if (originKind === 'group' && type === 'video') {
            const folder = await getFolderRecord(originId); // service/db.js
            return folder ? folder.name : none;
        }
        if (type === 'video') {
            const record = await getVideoRecord(originId); // service/db.js
            return record ? (record.customName || stripFileExtension(record.filename)) : none; // core/file-manager/video.js
        }
        const record = await getImageRecord(originId); // service/db.js
        return record ? record.filename : none;
    },

    // ===================== "Chọn nguồn" — 4 tổ hợp, picker CÓ SẴN =====================
    // Giữ NGUYÊN 4 picker đã có (Batch 2 sẽ nối lại router/msg.type gọi vào) — chỉ đổi hàm COMMIT
    // cuối cùng sang `_resolveAndCommitSource(originKind, originId)`.

    _pickerCleanup: null,

    _closePickerDrawer() {
        if (this._pickerCleanup) { this._pickerCleanup(); this._pickerCleanup = null; }
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** photo + single — tái dùng picker "chọn ảnh bìa bài hát" đã có sẵn. */
    openSingleImagePicker() {
        workflowFileManagerPhoto.openCoverImagePicker(
            (imageKey) => this._resolveAndCommitSource('single', imageKey),
            () => {},
        );
    },

    /** video + single. */
    async openSingleVideoPicker() {
        this._pickerCleanup = openMediaPickerDrawerUi('visualBg', 'visualBg.videoPicker', t('fileManager.video.pickerTitle'), `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-video-picker-scroll">
                <p id="file-manager-video-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.video.empty')}</p>
            </div>
        `, '.video-tile', 'videoKey', false); // core/file-manager/photo-ui.js

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        const videos = await listVideos(); // core/file-manager/video.js
        if (!this._pickerCleanup) return; // guard: đóng picker rất nhanh trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null, selectedKeys: new Set() }); // event/workflow/video-gallery-window.js
    },

    async selectVideoFromPicker(videoKey) {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
        await this._resolveAndCommitSource('single', videoKey);
    },

    cancelVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },

    /** photo + group (Album). */
    async openListAlbumPicker() {
        const [albums, images] = await Promise.all([listAlbums(), listImages()]); // core/file-manager/album.js + image.js
        const eligibleAlbums = albums.filter((a) => Array.isArray(a.imageKeys) && a.imageKeys.length >= VISUAL_BG_MIN_LIST_ITEMS); // core/visual-bg.js
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));

        openGenericDrawer({ // core/generic-drawer.js
            zIndex: Z_INDEX.GENERIC_DRAWER,
            headerHtml: this._buildPickerHeaderHtml(t('visualBgSettingsDrawer.albumPicker.title')),
            bodyHtml: `
                <div id="visual-bg-album-picker-grid" class="grid grid-cols-3 gap-x-2 gap-y-5"></div>
                <p id="visual-bg-album-picker-empty" class="hidden text-sm text-slate-300 text-center py-8">${t('visualBgSettingsDrawer.albumPicker.empty')}</p>
            `,
            bodyClass: 'overflow-y-auto px-4 pb-6 pt-2',
        });
        this._pickerCleanup = wireAlbumPickerDrawerActions('visualBg', 'visualBg.albumPicker'); // core/file-manager/photo-ui.js

        const gridEl = genericDrawerBody.querySelector('#visual-bg-album-picker-grid');
        const emptyEl = genericDrawerBody.querySelector('#visual-bg-album-picker-empty');
        renderAlbumPickerGrid(gridEl, eligibleAlbums, appConfigVisualBg.getAll().source.originId, imageRecordsByKey, 'visualBg', 'visualBg.albumPicker'); // core/file-manager/photo-ui.js
        if (emptyEl) emptyEl.classList.toggle('hidden', eligibleAlbums.length > 0);
    },

    async selectAlbumFromPicker(albumId) {
        this._closePickerDrawer();
        await this._resolveAndCommitSource('group', albumId);
    },

    cancelAlbumPicker() {
        this._closePickerDrawer();
    },

    /** video + group (Folder type='video'). */
    async openListFolderPicker() {
        const folders = await listFolders(); // core/file-manager/folder.js
        const videoFolders = folders.filter((f) => f.type === 'video');
        const counts = await Promise.all(videoFolders.map(async (f) => {
            const map = await getFolderSongMap(f.id); // service/db.js
            return map ? getFolderSongKeys(map).length : 0; // core/file-manager/folder.js
        }));
        const eligible = videoFolders.filter((_, i) => counts[i] >= VISUAL_BG_MIN_LIST_ITEMS);

        await workflowPlaylist._openFolderPickerDrawer(
            (folderId) => this._resolveAndCommitSource('group', folderId),
            {
                folders: eligible,
                showAddTile: false,
                emptyMsg: videoFolders.length === 0
                    ? t('visualBgSettingsDrawer.folderPicker.emptyNoFolder')
                    : tFormat('visualBgSettingsDrawer.folderPicker.emptyTooFew', { count: VISUAL_BG_MIN_LIST_ITEMS }),
            },
        );
    },

    _buildPickerHeaderHtml(title) {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },
};
