/**
 * event/workflow/visual-bg.js — Workflow domain "Visual Background" (v14, source hợp nhất 1 mảng).
 * Xung đột Video Player mode <-> Visual Background giải quyết bằng `clearMediaLayers()` (PUBLIC,
 * gọi chéo domain từ event/workflow/video-player.js lúc vào mode) + `applyCurrentVisualBg()` (gọi
 * lại lúc thoát) — KHÔNG còn Block gate chặn 2 chiều nào cho cặp này (Giang chốt).
 *
 * NẠP SAU: core/config.js, core/visual-bg.js, core/color-utils.js, service/db.js, service/state.js.
 * NẠP TRƯỚC: event/router/visual-bg.js.
 */
let visualBgSettingsPanelEl = null; // SỬA (đợt migrate Visualizer Screen) — giờ luôn trỏ genericDrawerBody (core/generic-drawer.js) SAU lần openPanel() đầu, dùng genericDrawerPanel.classList.contains('hidden') để biết đang mở/đóng thay vì so null (xem refreshPanelUI())
let visualBgGradientPanelEl = null; // SỬA (đợt migrate Visualizer Screen) — giờ luôn trỏ genericDrawerBody SAU lần openGradientPanel() đầu, dùng genericDrawerPanel.classList.contains('hidden') thay so null
let visualBgVideoAudioPanelEl = null; // SỬA (đợt migrate Visualizer Screen) — giờ luôn trỏ genericDrawerBody SAU lần openVideoAudioPanel() đầu, dùng genericDrawerPanel.classList.contains('hidden') thay so null

const workflowVisualBg = {
    _listIndex: -1,            // vị trí hiện tại trong `source.list` — CHỈ dùng cho nhánh video ở đây
    _isSwappingVideo: false,   // MỚI (08/08/2026, fix race "video chạy/lặp/đen màn thất thường") — xem docstring _playVideoKey()/syncPlaybackToAudio()
    _currentVideoKey: null,    // MỚI (08/08/2026, viết lại theo đúng khuôn Play mode) — key video ĐANG THẬT SỰ nạp trong bgVideoElement, RIÊNG của domain này (KHÔNG dùng appState.currentKey — khoá đó thuộc bài hát/video ĐANG PHÁT THẬT, video nền trang trí không được đụng, xem ver12 Song/Video Unification). Dùng làm nguồn so sánh cho guard "đã đúng video này rồi" ở _playVideoKey(), y hệt cách playVideoByKey() so appState.currentKey.
    _colorPersistTimer: null,
    _videoAudioRows: null,     // MỚI (08/08/2026) — cache {key,name}[] đọc lúc mở panel "Âm thanh Video", xem openVideoAudioPanel()/openVideoAudioVolumeModal()
    _stuckRecoveryTimer: null, // MỚI (09/08/2026, mục 3) — fallback taskManager.once() khi key hiện tại !record/null giữa lúc cycle mode 'slideshow' (không video nào phát -> 'ended' không bao giờ bắn -> treo), xem _scheduleStuckRecoveryTimer()/_killStuckRecoveryTimer()

    // MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement") — state RIÊNG của animation tick
    // (_tickGradientMovement()), KHÔNG lưu DB (hiệu ứng nhất thời, tự khởi tạo lại mỗi lần bật).
    _gradientMovementStartTime: null,     // mốc Date.now() lúc task bắt đầu chạy — mode 'time' dùng để tính elapsed
    _gradientMovementBaseStops: null,     // stops "nghỉ" hiện tại (đã CHỐT màu qua lần tráo gần nhất, position GỐC — chưa cộng spread)
    _gradientMovementSwapStartTime: null, // null = không đang tráo; khác null = mốc bắt đầu transition tráo màu
    _gradientMovementSwapFromColors: null,
    _gradientMovementSwapToColors: null,
    _gradientMovementLastSwapTime: null,  // mốc lần tráo GẦN NHẤT hoàn tất (hoặc lúc bật task) — tính khi nào tới lượt tráo kế tiếp

    // MỚI (13/08/2026, Giang yêu cầu — xoay theo PHA, không giật) — mode 'audio' CHỈ dùng nhóm này.
    // 1 pha = xoay/giãn mượt từ *From -> *To trong `_gradientMovementPhaseDurationMs`, hết pha mới
    // lấy mẫu BPM/energy MỚI chốt pha kế tiếp — xem _commitNextGradientPhase().
    _gradientMovementPhaseStartTime: null,
    _gradientMovementPhaseDurationMs: null,
    _gradientMovementPhaseFromAngle: null,
    _gradientMovementPhaseToAngle: null,
    _gradientMovementPhaseFromSpread: null,
    _gradientMovementPhaseToSpread: null,

    // ===================== Boot / persist =====================

    /** Đọc lại `meta.visualBgConfig` + áp nền — gọi 1 lần lúc boot, SAU loadConfig(). */
    async loadPersistedSettingsOnBoot() {
        const saved = await getMeta('visualBgConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigVisualBg.mutateAll((cfg) => {
                if (VISUAL_BG_TYPES.includes(saved.type)) cfg.type = saved.type;
                if (saved.source && typeof saved.source === 'object') {
                    // MỞ RỘNG (29/08/2026) — thêm 'multi' (nhiều ảnh/video chọn tay) và 'groupMulti'
                    // (nhiều Thư mục gộp lại) vào whitelist originKind — xem docstring
                    // `_readOriginKeys()` ngay dưới.
                    if (saved.source.originKind === null || VISUAL_BG_ORIGIN_KINDS.includes(saved.source.originKind)) cfg.source.originKind = saved.source.originKind;
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
                // MỚI (09/08/2026, cơ chế pending) — validate CÙNG khuôn `saved.source` ở trên.
                if (saved.pending && typeof saved.pending === 'object') {
                    if ((saved.pending.originKind === null || VISUAL_BG_ORIGIN_KINDS.includes(saved.pending.originKind)) && Array.isArray(saved.pending.list)) {
                        cfg.pending.originKind = saved.pending.originKind;
                        cfg.pending.originId = typeof saved.pending.originId === 'string' ? saved.pending.originId : null;
                        cfg.pending.list = saved.pending.list.filter((k) => k === null || typeof k === 'string');
                    }
                }
                if (VISUAL_BG_LIST_PLAYBACK_MODES.includes(saved.listPlaybackMode)) cfg.listPlaybackMode = saved.listPlaybackMode;
                if (VISUAL_BG_NEXT_ORDERS.includes(saved.nextOrder)) cfg.nextOrder = saved.nextOrder;
                if (VISUAL_BG_COLOR_MODES.includes(saved.colorMode)) cfg.colorMode = saved.colorMode;
                if (typeof saved.solidColor === 'string') cfg.solidColor = saved.solidColor;
                if (typeof saved.gradientAngleDeg === 'number') cfg.gradientAngleDeg = saved.gradientAngleDeg;
                if (Array.isArray(saved.gradientStops) && saved.gradientStops.length >= VISUAL_BG_GRADIENT_MIN_STOPS && saved.gradientStops.length <= VISUAL_BG_GRADIENT_MAX_STOPS) cfg.gradientStops = saved.gradientStops;
                // MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement") — validate TỪNG field con
                // (KHÔNG gán nguyên cục saved.gradientMovement — CÙNG triết lý defensive với mọi
                // field khác ở trên, tránh dữ liệu DB hỏng/thiếu field làm vỡ animation sau này).
                if (saved.gradientMovement && typeof saved.gradientMovement === 'object') {
                    const gm = saved.gradientMovement;
                    if (typeof gm.enabled === 'boolean') cfg.gradientMovement.enabled = gm.enabled;
                    if (VISUAL_BG_GRADIENT_MOVEMENT_MODES.includes(gm.mode)) cfg.gradientMovement.mode = gm.mode;
                    if (typeof gm.rotateDurationMs === 'number' && gm.rotateDurationMs >= VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS && gm.rotateDurationMs <= VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS) cfg.gradientMovement.rotateDurationMs = gm.rotateDurationMs;
                    if (typeof gm.audioRotateFrom === 'number') cfg.gradientMovement.audioRotateFrom = Math.max(0, Math.min(360, gm.audioRotateFrom));
                    if (typeof gm.audioRotateTo === 'number') cfg.gradientMovement.audioRotateTo = Math.max(0, Math.min(360, gm.audioRotateTo));
                    if (typeof gm.audioStopSpreadFrom === 'number') cfg.gradientMovement.audioStopSpreadFrom = Math.max(0, Math.min(50, gm.audioStopSpreadFrom));
                    if (typeof gm.audioStopSpreadTo === 'number') cfg.gradientMovement.audioStopSpreadTo = Math.max(0, Math.min(50, gm.audioStopSpreadTo));
                    if (typeof gm.colorSwapEnabled === 'boolean') cfg.gradientMovement.colorSwapEnabled = gm.colorSwapEnabled;
                    if (typeof gm.colorSwapIntervalMs === 'number' && gm.colorSwapIntervalMs >= VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS && gm.colorSwapIntervalMs <= VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS) cfg.gradientMovement.colorSwapIntervalMs = gm.colorSwapIntervalMs;
                    if (typeof gm.colorSwapTransitionMs === 'number' && gm.colorSwapTransitionMs >= VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS && gm.colorSwapTransitionMs <= VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS) cfg.gradientMovement.colorSwapTransitionMs = gm.colorSwapTransitionMs;
                }
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
        // MỚI (09/08/2026, phản hồi Giang mục 4 — "app boot tự check pending") — boot = tự coi như
        // ĐÃ ở "lượt kế tiếp": phiên trước đóng app giữa lúc có pending chưa kịp áp (video chưa hết/
        // chưa đổi bài hát) -> áp NGAY ở đây, đè `source` cũ, không đợi thêm sự kiện nào nữa (không
        // còn media nào đang dở dang để mà "làm phiền" cả — app vừa mở lại từ đầu).
        // KHÔNG await ở đây (fix bug boot chặn playlist, mục 4 cũ) — CẢ 2 nhánh
        // (_checkAndApplyPendingSource() lẫn applyCurrentVisualBg()) đều tự lo phần video nạp/phát
        // ngầm, không giữ chuỗi boot() phía app-boot.js chờ.
        if (appConfigVisualBg.getAll().pending.originKind) this._checkAndApplyPendingSource();
        else this.applyCurrentVisualBg();
        this._syncGradientMovementTaskState(); // MỚI (12/08/2026, mục 6) — khởi động animation NGAY nếu đã bật từ phiên trước
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
    // 2 hàm dưới đây là ĐIỂM TÍNH TOÁN DUY NHẤT cho "bước tiếp theo/lượt đầu" trong `source.list` —
    // nhánh video (_applyVideo/_advanceVideo ngay dưới) gọi NỘI BỘ, nhánh ảnh (workflowSlideshow,
    // event/workflow/slideshow.js) gọi LIÊN TUYẾN DOMAIN sang đây thay vì tự viết lại (nguồn sự thật
    // `source.list` vẫn thuộc domain này — cùng nguyên tắc ownership đã áp cho
    // persistSourceListMutation()/selfHealEmptySource() ở dưới).
    //
    // VIẾT LẠI HẲN (08/08/2026, phản hồi Giang — "list không hề random, lặp lại liên tục", verify
    // bằng cách chạy thử: N=2/3 item, random-loại-trừ-liền-kề cũ suy biến gần hệt tuần tự thuần) —
    // BỎ `pickNextSlideshowIndexRandom()` (đã xoá, core/file-manager/slideshow.js) + block
    // `shuffleVisualBgListKeepingIndex()` cũ (xáo VỊ TRÍ LƯU TRỮ không đổi được PHÂN PHỐI của
    // `Math.random()*length` — code chết, không có tác dụng thật). Đổi hẳn sang shuffle-bag ĐÚNG
    // NGHĨA: `nextOrder==='random'` giờ CŨNG bước TUẦN TỰ (`pickNextSlideshowIndexSequential()`,
    // DÙNG CHUNG với `sequential`) qua mảng — chỉ khác `sequential` ở chỗ mảng được XÁO LẠI
    // (`shuffleVisualBgList()`, core/visual-bg.js — Fisher-Yates TOÀN mảng) mỗi khi vừa đi hết 1
    // vòng (`nextIndex===0`), đảm bảo mọi item được phát ĐỦ 1 lượt trước khi có item nào lặp lại —
    // đúng tinh thần "mô hình shuffle-bag như Space visualizer" đã định làm từ đầu nhưng bản cũ chưa
    // đạt được. Item VỪA phát (cuối vòng cũ) được loại trừ khỏi vị trí ĐẦU mảng mới xáo (nếu random
    // rơi trúng) — tránh lặp liền kề ngay điểm nối 2 vòng, cùng convention đã dùng cho
    // `resolveSlideshowKenBurnsDirection()` (core/file-manager/slideshow.js).

    /** Chọn index LƯỢT ĐẦU (`currentIndex=-1`). `sequential`: index 0, mảng giữ nguyên thứ tự gốc.
     * `random`: xáo cả mảng 1 lần rồi bắt đầu từ index 0 của mảng đã xáo.
     * @param {Array<string|null>} list
     * @param {boolean} isRandom
     * @returns {{ list: Array<string|null>, index: number }}
     */
    firstIndex(list, isRandom) {
        if (!isRandom) return { list, index: pickNextSlideshowIndexSequential(-1, list.length) }; // core/file-manager/slideshow.js
        return { list: shuffleVisualBgList(list), index: 0 }; // core/visual-bg.js — lượt đầu, chưa có gì để loại trừ
    },

    /** Chọn index MỖI LƯỢT SAU (cycle) — bước tuần tự qua mảng hiện tại; `random` xáo lại TOÀN mảng
     * (loại trừ item vừa phát khỏi vị trí đầu mảng mới) đúng lúc vừa đi hết 1 vòng, rồi mới sweep
     * null qua `advanceVisualBgList()` (core, không đổi — vẫn ĐÚNG chỗ dọn null cho cả 2 nextOrder).
     * @param {Array<string|null>} list
     * @param {number} currentIndex
     * @param {boolean} isRandom
     * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn.
     */
    advanceList(list, currentIndex, isRandom) {
        const nextIndex = pickNextSlideshowIndexSequential(currentIndex, list.length); // core/file-manager/slideshow.js — DÙNG CHUNG cho cả 2 nextOrder, khác nhau ở việc random có xáo lại mảng hay không
        if (isRandom && nextIndex === 0 && list.length > 1) {
            const justPlayedKey = currentIndex >= 0 ? list[currentIndex] : null;
            let reshuffled = shuffleVisualBgList(list); // core/visual-bg.js
            if (reshuffled[0] === justPlayedKey) { // tránh lặp liền kề ngay điểm nối 2 vòng
                const swapWith = 1 + Math.floor(Math.random() * (reshuffled.length - 1));
                [reshuffled[0], reshuffled[swapWith]] = [reshuffled[swapWith], reshuffled[0]];
            }
            return advanceVisualBgList(reshuffled, nextIndex); // core/visual-bg.js — vẫn sweep null như cũ
        }
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

    /**
     * MỚI (09/08/2026, cơ chế pending, phản hồi Giang) — kiểm tra + áp `cfg.pending` nếu có. Dùng
     * CHUNG cho MỌI điểm "lượt kế tiếp" của CẢ 2 type (photo lẫn video) — video hết/đổi bài hát
     * (`advanceForSongChange()`/`_onVideoEnded()` ở dưới), ảnh hết tick/đổi bài hát
     * (`workflowSlideshow._tick()`/`advanceForSongChange()`, liên tuyến domain gọi NGAY hàm này),
     * và boot (`loadPersistedSettingsOnBoot()` ở trên) — Giang chốt "1 cơ chế, không tách riêng
     * theo listPlaybackMode/type". PUBLIC (không dấu `_`) vì `workflowSlideshow` cần gọi liên tuyến
     * domain (nguồn sự thật `pending`/`source` vẫn thuộc domain này, cùng nguyên tắc ownership đã
     * áp cho `persistSourceListMutation()`/`selfHealEmptySource()`).
     * KHÔNG tự tính lại `firstIndex()`/mảng — giao thẳng cho `applyCurrentVisualBg()` (CHÍNH XÁC
     * quy trình "chọn nguồn mới" đã có sẵn, tự `clearMediaLayers()` reset `_listIndex=-1`/
     * `_currentVideoKey=null` rồi mới `firstIndex()` + phát item đầu — không viết lại logic đó ở
     * đây, Rule 3c).
     * @returns {Promise<boolean>} true nếu VỪA áp pending — nơi gọi PHẢI return ngay, KHÔNG chạy
     *   tiếp logic advance()/tick() cũ (nguồn đã đổi hẳn, index/task cũ không còn ý nghĩa gì nữa).
     */
    async _checkAndApplyPendingSource() {
        const cfg = appConfigVisualBg.getAll();
        if (!cfg.pending.originKind) return false; // guard: không có gì đang chờ
        const { originKind, originId, list } = cfg.pending;
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = list;
            c.source.videoAudio = {}; // xem docstring _resolveAndCommitSource() — đọc lại origin luôn xoá sạch
            c.pending = { originKind: null, originId: null, list: [] };
        });
        console.log(`writer: "workflowVisualBg._checkAndApplyPendingSource", page: "visualBgConfig", content: "áp pending source=${originKind}:${originId}, count=${list.length}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return true;
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
        this._currentVideoKey = null; // MỚI — dọn theo, xem docstring khai báo field ở đầu object
        this._killStuckRecoveryTimer(); // MỚI (09/08/2026, mục 3) — VBG đang bị dọn hẳn, huỷ fallback đang chờ (nếu có)
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

    /** MỚI (09/08/2026, gate load video theo Song, phản hồi Giang — "video phát/audio trước khi
     * Song từng phát là sai lầm thiết kế") — video THẬT (nạp `bgVideoElement`/`play()`) CHỈ nạp khi
     * Song đang THẬT SỰ phát (`!audioPlayer.paused`); nếu chưa, hiện thumb full-res TĨNH của đúng
     * item sẽ phát (`workflowVideoPlayer.showStaticBgThumb()`, liên tuyến domain) — KHÔNG đụng
     * `bgVideoElement` gì cả, tức KHÔNG có `play()` nào chạy lúc Song còn im lặng. Lúc Song bắt đầu
     * phát thật, `syncPlaybackToAudio()` (dưới) tự nạp lại THẬT cho đúng `list[_listIndex]` này.
     */
    async _applyVideo(cfg) {
        const list = cfg.source.list;
        let startList = list;
        let index = 0;
        if (list.length > 1) {
            const r = this.firstIndex(list, cfg.nextOrder === 'random');
            startList = r.list; index = r.index;
            if (startList !== list) { // random bốc trúng vị trí cuối ngay lượt đầu -> đã xáo lại, ghi lại mảng mới
                appConfigVisualBg.mutateAll((c) => { c.source.list = startList; });
                await this._persist();
            }
        }
        this._listIndex = index;
        const key = startList[index];
        if (!key) return;
        if (audioPlayer.paused) { if (typeof workflowVideoPlayer !== 'undefined') await workflowVideoPlayer.showStaticBgThumb(key); return; } // event/workflow/video-player.js
        await this._playVideoKey(key);
        // SỬA (08/08/2026, phản hồi Giang — mục "video chạy/dừng/lặp/đen màn thất thường") — BỎ HẲN
        // taskManager hẹn giờ cố định (`cfg.slideshow.intervalSeconds`) từng dùng để tự chuyển video
        // kế. Field đó vốn thiết kế cho ẢNH (không có độ dài riêng, hẹn giờ CHÍNH LÀ định nghĩa "hiện
        // bao lâu"), bê nguyên sang VIDEO là sai — video có độ dài thật, hẹn giờ cố định không khớp
        // độ dài đó gây 3 kiểu lỗi tuỳ video ngắn/dài/vừa hơn mốc (xem báo cáo). Giang chốt: mode
        // 'slideshow' giờ đợi video tự phát HẾT thật (`loop=false`, xem `_playVideoKey()`), advance
        // qua sự kiện `ended` thật (`bgVideoElement` 'ended' -> event/listener/visual-bg.js ->
        // `visualBg.video.ended` -> `_onVideoEnded()` dưới) — KHÔNG còn hẹn giờ nào ở đây nữa.
    },

    /** Ứng với bài hát đổi thật ('visualBg.songChanged', router) khi type='video'. Check pending
     * TRƯỚC guard `listPlaybackMode==='perSong'` — MỚI (09/08/2026, cơ chế pending) — đây là điểm
     * "lượt kế tiếp" DUY NHẤT còn lại cho ca `source.list.length<=1` (phát tĩnh, không cycle gì cả
     * -> `_advanceVideo()` luôn no-op cho ca đó, xem guard đầu hàm), nên phải check ở ĐÂY, KHÔNG
     * được gộp chung điều kiện `perSong` phía dưới. */
    async advanceForSongChange() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video') return;
        if (await this._checkAndApplyPendingSource()) return;
        if (cfg.listPlaybackMode !== 'perSong') return;
        await this._advanceVideo();
    },

    /** Ứng với `bgVideoElement` tự bắn 'ended' khi KHÔNG ở Video Player mode (guard đã lọc ở
     * event/listener/visual-bg.js, xem comment ở đó). MỚI (08/08/2026, phản hồi Giang) — THAY cho
     * taskManager hẹn giờ cố định đã bỏ (xem `_applyVideo()`) — video mode 'slideshow' giờ advance
     * đúng lúc video ĐÓ THẬT SỰ phát hết (`loop=false`, xem `_playVideoKey()`).
     * SỬA (09/08/2026, mục 1, phản hồi Giang — "video loop mà có Audio B bật thì tự pause Song") —
     * BỎ giả định cũ "perSong/list.length<=1 luôn loop=true nên KHÔNG BAO GIỜ bắn ended": giả định
     * đó SAI từ lúc `loop` phụ thuộc thêm Audio B (xem docstring `_playVideoKey()`) — video CÓ
     * Audio B bật ở 2 case đó giờ `loop=false`, `ended` bắn THẬT, cần tự lặp lại CHÍNH NÓ (không
     * advance sang video khác — vẫn cùng 1 video, chỉ khác là PHẢI dừng thật ở cuối rồi mình tự
     * seek+play() lại thay vì native tự làm ngầm, xem `_restartCurrentVideoInPlace()`). */
    async _onVideoEnded() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video') return;
        // SỬA (09/08/2026, mục 1 vòng 2, tự soát lại) — DÙNG `_effectiveCount()` (loại null) THAY
        // vì `cfg.source.list.length` thô (tính cả null): `_playVideoKey()` tính `isCyclingSlideshow`
        // bằng `_effectiveCount()` — nếu 1 trong N item bị đánh dấu null (record mất, xem
        // `_markCurrentMissing()`) mà chỉ còn ĐÚNG 1 item sống, `_playVideoKey()` đã tự coi là
        // "tĩnh" (`loop=!hasAudioB`) nhưng hàm NÀY (bản cũ dùng `.length` thô) vẫn coi là "đang
        // cycle" nếu length thô >1 — 2 nơi tính LỆCH NHAU, dẫn `_onVideoEnded()` chọn nhầm nhánh
        // advance thay vì tự lặp lại. Đồng bộ lại dùng CHUNG `_effectiveCount()`.
        const isCyclingSlideshow = cfg.listPlaybackMode === 'slideshow' && this._effectiveCount(cfg) > 1;
        if (!isCyclingSlideshow) { this._restartCurrentVideoInPlace(); return; } // perSong hoặc còn ≤1 item sống — CÙNG video, tự lặp lại thủ công
        if (await this._checkAndApplyPendingSource()) return; // MỚI (09/08/2026, cơ chế pending) — video VỪA hết, đúng "lượt kế tiếp"
        await this._advanceVideo();
    },

    /** SỬA (09/08/2026, mục 1 vòng 4, phản hồi Giang — "không cần dùng lại cơ chế swap, vấn đề
     * chung là phát 1 video có tiếng trong lúc audio khác đang phát, slideshow cũng dính rủi ro y
     * hệt, chỉ là ca này lộ ra qua việc lặp lại chính nó") — video tự lặp lại CHÍNH NÓ (perSong,
     * hoặc slideshow còn ≤1 item sống) khi `loop=false` (vì có Audio B bật — xem `_playVideoKey()`),
     * THAY cho native `loop=true`. Đúng khuôn Giang chốt: video hết -> mute cưỡng chế -> seek 0 ->
     * play() -> đợi 'playing' thật -> bỏ mute cưỡng chế -> áp theo setting đã lưu — CÙNG pattern
     * `_playVideoKey()`. KHÔNG qua `swapBgVideoSource()`/tải lại record — vẫn CÙNG 1 video, chỉ
     * seek về 0.
     */
    _restartCurrentVideoInPlace() {
        const videoKey = this._currentVideoKey;
        if (!videoKey) return; // guard: không có video thật nào đang phát (đang placeholder) — không có gì để lặp
        bgVideoElement.muted = true;
        setVideoBgGain(0); // core/video-player.js
        bgVideoElement.currentTime = 0;
        bgVideoElement.play().catch(() => {});
        if (typeof workflowVideoPlayer === 'undefined') return; // liên tuyến domain
        workflowVideoPlayer.waitForNextPlaying().then(() => {
            if (this._currentVideoKey === videoKey) this._applyVideoAudioSettingToElement(videoKey); // core/visual-bg.js lookup + gán muted/volume
        });
    },

    /**
     * VIẾT LẠI (08/08/2026, fix "video chạy/hết/lặp lại chính nó/đen màn thất thường", đợt 2) —
     * coi `source.list` tương đương `displayOrder` của Playlist, "video hết" tương đương "có key
     * mới -> nạp nó" — ĐÚNG quy trình `playNext()` (core/player-controls.js): tính XONG HẲN, ĐỒNG
     * BỘ, "đứng ở đâu -> key kế tiếp là gì" TRƯỚC, không còn khoảng hở `await` nào chen giữa lúc
     * tính `index` và lúc gán `this._listIndex` như bản trước (`await this._persist()` từng nằm
     * TRƯỚC dòng gán `this._listIndex = index` — nếu bị gọi chồng đúng lúc đó, lượt gọi sau đọc
     * `this._listIndex` CŨ, tính lại trúng đúng video vừa phát -> `_playVideoKey()` nạp lại y hệt
     * video đó từ đầu, đúng hiện tượng "lặp lại chính nó"). Việc ghi lại `source.list` đã sweep/
     * reshuffle (nếu chạm biên) giờ chạy NGẦM (không `await`) — Play mode không hề persist gì
     * xuống DB mỗi lần next() cả, VBG cũng không được phép chặn/làm chậm việc phát video kế chỉ vì
     * đang ghi DB.
     * list.length<=1 -> không cycle (phát tĩnh, xem `_applyVideo`).
     */
    async _advanceVideo() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.source.list.length <= 1) return;
        const { list, index } = this.advanceList(cfg.source.list, this._listIndex, cfg.nextOrder === 'random');
        if (index === -1) { await this.selfHealEmptySource(); return; }
        this._listIndex = index; // gán NGAY, đồng bộ — TRƯỚC bất kỳ việc gì khác (kể cả persist ngầm ngay dưới)
        if (list !== cfg.source.list) {
            appConfigVisualBg.mutateAll((c) => { c.source.list = list; });
            this._persist(); // KHÔNG await — ghi ngầm, không chặn việc phát video kế tiếp
        }
        const key = list[index];
        // null -> ẩn, chờ advance() lần sau; MỚI (09/08/2026, mục 3) — mode 'slideshow' advance CHỈ
        // qua 'ended' thật, không video nào đang phát thì KHÔNG bao giờ tự bắn -> đặt fallback timer.
        if (!key) { this._hideVideoOnly(); this._scheduleStuckRecoveryTimer(cfg.listPlaybackMode, list); return; }
        await this._playVideoKey(key);
    },

    /** Chỉ ẩn video (KHÔNG đụng task/index) — dùng khi item hiện tại là null giữa lúc đang cycle. */
    _hideVideoOnly() {
        this._currentVideoKey = null;
        if (typeof workflowVideoPlayer !== 'undefined') workflowVideoPlayer.clearBgVideoSource(); // event/workflow/video-player.js — liên tuyến domain
    },

    /**
     * MỚI (09/08/2026, mục 3, phản hồi Giang — "key !record/undefined treo vĩnh viễn") — advance
     * mode 'slideshow' CHỈ chạy qua sự kiện `ended` thật của `bgVideoElement` (xem `_onVideoEnded()`).
     * Key hiện tại null/mất record -> `_hideVideoOnly()` -> KHÔNG video nào đang phát -> `ended`
     * không bao giờ bắn -> treo vĩnh viễn. Đặt fallback `taskManager.once()` 5s — CÙNG khuôn
     * `videoPlayingReadyFallback` đã có ở `swapBgVideoSource()` — tự gọi lại `_advanceVideo()` nếu
     * chưa có video nào khác kịp nạp trong lúc chờ. CHỈ áp dụng mode 'slideshow' + còn >1 item sống
     * (list.length<=1 hoặc hết sạch item sống đã tự xử lý riêng — clearSource()/không cycle gì cả,
     * không phải ca "treo").
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
     * SỬA THÊM (09/08/2026, phản hồi Giang — "video loop mà có Audio B bật thì tự pause Song") —
     * ĐIỀU KIỆN `loop=true` Ở TRÊN chỉ còn ĐÚNG khi video này KHÔNG bật Audio B: loop-restart NATIVE
     * (trình duyệt tự seek về 0 + tiếp tục phát ngầm, KHÔNG bắn sự kiện `ended`, KHÔNG có lệnh
     * `play()` nào lộ ra JS) VẪN bị iOS Safari/WKWebView coi là 1 lần giành audio session MỚI nếu
     * video đó đang audible thật (cùng cơ chế đã phân tích ở docstring dưới — chỉ khác là lần này
     * trình duyệt tự kích hoạt, không qua code của mình nên không có chỗ nào để câm-trước-play()
     * được) — Song bị cưỡng chế pause. Video CÓ Audio B bật -> `loop=false`, tự lặp THỦ CÔNG qua
     * `_onVideoEnded()`/`_restartCurrentVideoInPlace()` (câm cứng lúc seek+play() lại, unmute SAU
     * khi ổn định — CÙNG pattern muted-rồi-confirm đã dùng khắp file này) — giành lại quyền kiểm
     * soát đúng thời điểm "become audible", né được đúng cửa sổ trình duyệt tự ý giành session.
     * SỬA (09/08/2026, mục 1+2 vòng 2, phản hồi Giang — "video kế tiếp đè Song/đơ cả hai" +
     * "chưa phát Song nhưng bật audio VBG đã phát") — RETRACT thứ tự 08/08/2026 (áp
     * `_applyVideoAudioSettingToElement()` TRƯỚC `swapBgVideoSource()`): `play()` bên trong swap là
     * 1 LỆNH PLAY MỚI trên `<video>` native — gọi lệnh đó trong lúc video ĐÃ audible (muted đã gỡ ở
     * dòng trước) đúng là điều kiện khiến iOS Safari/WKWebView cưỡng chế giành audio session (pause
     * Song, hoặc đơ cả hai do race) — xem thread Apple Developer Forums đã dẫn ở docstring
     * `_applyVideoAudioSettingToElement()` dưới. Trường hợp Giang tìm ra "lách" được (bật audio cho
     * video ĐANG PHÁT SẴN, không qua swap) sống sót đúng vì KHÔNG có lệnh `play()` nào chạy lại lúc
     * đó — chỉ đổi `gain.value`. Áp dụng lại đúng cùng nguyên tắc vào nhánh swap: video LUÔN vào
     * `play()` ở trạng thái câm cứng (không đọc setting), setting audio THẬT chỉ áp SAU khi
     * `waitBgVideoReady()` báo video đã ổn định ('playing' hoặc timeout 2s) — xem cuối hàm. Đánh đổi
     * đã bàn với Giang: mất đúng đoạn audio [0, mốc 'playing'] (thường <1s, tối đa 2s ca hiếm) —
     * CÙNG mốc `hideUntilReady` đang dùng để lộ hình thật, nên không tạo lệch hình/tiếng mới.
     * @param {string} videoKey
     */
    async _playVideoKey(videoKey) {
        // MỚI (08/08/2026, viết lại theo đúng khuôn Play mode) — guard "đã đúng video này rồi" — Y
        // HỆT check đầu `playVideoByKey()` (event/workflow/video-player.js): gọi lại hàm này với
        // key ĐANG THẬT SỰ nạp (so cả `_currentVideoKey` lẫn `src` thật trên DOM, phòng lệch do nơi
        // khác vừa dọn `bgVideoElement`) thì KHÔNG được nạp lại từ đầu — nạp lại = object URL mới +
        // gán lại `src` = video restart về 0, đúng hiện tượng "lặp lại chính nó" đã báo cáo.
        // Guard "khoá chống gọi chồng" — Y HỆT tinh thần `withLoadingShield` của Play mode (không
        // cần lớp che UI vì VBG không có UI nào phải chờ) — 1 lượt swap đang dở dang thì lượt gọi
        // chồng lên phải bỏ qua, không được phép cùng lúc đụng `bgVideoElement`.
        if (
            (videoKey === this._currentVideoKey && workflowVideoPlayer._objectUrl && bgVideoElement.getAttribute('src') === workflowVideoPlayer._objectUrl)
            || this._isSwappingVideo
        ) return;
        this._killStuckRecoveryTimer(); // MỚI (09/08/2026, mục 3) — video mới thật sự bắt đầu nạp, không còn "treo" nữa
        // SỬA (09/08/2026, mục 1+2 vòng 2) — ép câm CỨNG, KHÔNG đọc setting của videoKey ở đây nữa
        // (xem docstring trên). `setVideoBgGain(0)` an toàn no-op nếu graph Web Audio chưa từng nối.
        bgVideoElement.muted = true;
        setVideoBgGain(0); // core/video-player.js
        const cfg = appConfigVisualBg.getAll();
        const isCyclingSlideshow = cfg.listPlaybackMode === 'slideshow' && this._effectiveCount(cfg) > 1;
        const { enabled: hasAudioB } = getVisualBgVideoAudioSetting(cfg.source.videoAudio, videoKey); // core/visual-bg.js
        bgVideoElement.loop = !isCyclingSlideshow && !hasAudioB; // xem docstring trên — SỬA 08/08/2026 + 09/08/2026
        bgVideoElement.classList.remove('hidden');
        this._isSwappingVideo = true;
        // SỬA (08/08/2026, phản hồi Giang — màn đen ở video cuối `source.list`) — thêm tham số thứ 4
        // `hideUntilReady=true`: VBG (KHÁC Video Player mode thật — nhánh đó vẫn ổn định, KHÔNG
        // truyền tham số này, giữ nguyên hành vi) ẩn hẳn `bgVideoElement` quanh lúc đổi src, lộ đúng
        // lớp thumb full-res đã chèn (bên trong swapBgVideoSource), tự gỡ ẩn khi video mới sẵn sàng.
        // `beforePlay` vẫn `null` — video vào play() lúc câm cứng ở trên, không cần hook nối Web
        // Audio ngay lúc này (chỉ nối LƯỜI bên trong `_applyVideoAudioSettingToElement()`, chạy SAU
        // khi ready — xem cuối hàm).
        const record = await workflowVideoPlayer.swapBgVideoSource(videoKey, true, null, true); // event/workflow/video-player.js — liên tuyến domain, isTransition=true LUÔN (VBG cần lớp dự phòng cả lúc áp lần đầu, không phân biệt như Video Player mode) — bên trong: pause video cũ -> đọc record -> chèn full-res thumb dự phòng -> ẩn bgVideoElement -> nạp blob mới -> gán poster/src -> play() -> gỡ ẩn khi sẵn sàng
        this._isSwappingVideo = false;
        if (!record) { await this._markCurrentMissing(); return; }
        this._currentVideoKey = videoKey; // MỚI — ghi NGAY sau khi swap thành công, làm nguồn so sánh cho guard dedupe ở đầu hàm
        updateDOMBackground(); // core/color-utils.js
        // SỬA (09/08/2026, mục 1, phản hồi Giang — "guard .hidden nuốt mất lệnh pause") — DỜI
        // `syncVisualBgVideoPlayback()` từ NGAY ĐÂY (lúc bgVideoElement CÒN `.hidden` do
        // `hideUntilReady`, guard đầu hàm đó tự return sớm -> lệnh pause() KHÔNG BAO GIỜ chạy tới)
        // sang TRONG `.then()` dưới — SAU khi `.hidden` đã gỡ (`waitBgVideoReady()` xong). Gọi
        // TRƯỚC `_applyVideoAudioSettingToElement()`: quyết định play/pause theo Song trước, MỚI
        // xét có unmute hay không — tránh unmute 1 video sắp bị pause ngay sau đó.
        // KHÔNG await (fix bug boot chặn playlist, mục 4 cũ). Guard `_currentVideoKey === videoKey`:
        // bỏ qua nếu đã có video KHÁC nạp đè lên trong lúc chờ (advance nhanh liên tiếp).
        workflowVideoPlayer.waitBgVideoReady().then(() => {
            if (this._currentVideoKey !== videoKey) return;
            syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js — ĐÚNG mốc .hidden đã gỡ, guard không còn nuốt lệnh pause() nữa
            this._applyVideoAudioSettingToElement(videoKey); // core/visual-bg.js lookup + gán muted/volume
        });
    },

    /** Đọc cấu hình audio riêng của `videoKey` (core `getVisualBgVideoAudioSetting()`) rồi gán thẳng
     * `bgVideoElement.muted`/`.volume`. 2 nơi gọi: (1) `_playVideoKey()` — SAU khi
     * `waitBgVideoReady()` báo video đã ổn định (KHÔNG còn gọi TRƯỚC `play()` nữa, xem SỬA
     * 09/08/2026 vòng 2 ở docstring `_playVideoKey()` — play() là lệnh play() MỚI, gọi lúc video đã
     * audible mới là nguồn cưỡng chế giành audio session, không phải bản thân việc unmute); (2) lúc
     * user Áp dụng modal audio ngay khi video đó đang là video ĐANG PHÁT, KHÔNG qua swap/play() nào
     * cả (áp live, không cần đợi vòng cycle sau — xem `setVideoAudioSetting()`/`_applyLiveIfCurrentVideo()`).
     * SỬA (09/08/2026, mục 1+2, phản hồi Giang) — RETRACT bản trước (native song song hoàn toàn,
     * không đụng Web Audio): đã thử THẬT, Song vẫn bị cưỡng chế pause. Nghiên cứu trước dẫn thread
     * Apple Developer Forums ("HTMLAudioElement on iOS is paused when video plays again") dùng demo
     * Web Audio API THAY THẾ HOÀN TOÀN thẻ `<audio>` (buffer thuần, không còn element `<audio>` nào
     * chạy dưới) — KHÁC app này: `audioPlayer` vẫn là 1 thẻ `<audio>` THẬT (chỉ tap tín hiệu ra qua
     * `createMediaElementSource`), bản thân element đó iOS vẫn coi là 1 "phiên media" độc lập, vẫn
     * bị video native cưỡng chế pause như thường — kết luận trước SAI cho đúng kiến trúc này.
     * Quay lại nối `bgVideoElement` vào CHUNG graph với `audioPlayer` — nhưng LƯỜI, CHỈ đúng lúc
     * `enabled=true` (Audio B thật sự cần phát cùng lúc Song) — mặc định câm (đa số) vẫn KHÔNG đụng
     * Web Audio, giữ đúng tinh thần đơn giản Giang muốn cho trường hợp phổ biến nhất. Một khi đã nối
     * graph thì `.muted`/`.volume` không đáng tin (Firefox bugzilla #966247) nên PHẢI dùng
     * `setVideoBgGain()` (GainNode riêng, core/video-player.js) làm nguồn tin cậy chính. */
    _applyVideoAudioSettingToElement(videoKey) {
        const { enabled, volumePercent } = getVisualBgVideoAudioSetting(appConfigVisualBg.getAll().source.videoAudio, videoKey); // core/visual-bg.js
        // FIX (12/08/2026, Giang báo "video bg 50% đã át gần hết tiếng song") — GAIN THẬT áp vào
        // element/GainNode giờ qua resolveVisualBgVideoAudioGain() (core/visual-bg.js, trần 90%),
        // KHÔNG còn tự chia volumePercent/100 thẳng — volumePercent (0-100) LƯU DB/HIỂN THỊ UI
        // giữ nguyên, chỉ gain THẬT bị trần lại.
        const gain = resolveVisualBgVideoAudioGain(volumePercent); // core/visual-bg.js — 0-0.9
        bgVideoElement.muted = !enabled;
        bgVideoElement.volume = gain;
        if (enabled) {
            setupAudioContext(); // core/audio-engine.js — đảm bảo context tồn tại
            connectVideoElementToAnalyser(); // core/video-player.js — LƯỜI, chỉ nối đúng lúc thật sự cần Audio B
            setVideoBgGain(gain); // core/video-player.js
        } else {
            setVideoBgGain(0); // core/video-player.js — no-op nếu graph chưa nối (đa số trường hợp — không đụng gì tới Web Audio)
        }
    },

    /** Đánh dấu vị trí hiện tại là mất + ẩn — KHÔNG reset index/task, chờ advance() lần sau tự bước
     * tiếp (Giang chốt, cơ chế null-sweep). Dọn xong mà KHÔNG còn item sống nào -> tự chữa lành hẳn
     * (gỡ source) luôn, không đợi advance() phát hiện ra ở lượt sau. Còn item sống -> MỚI (09/08/2026,
     * mục 3) đặt fallback timer tránh treo, xem `_scheduleStuckRecoveryTimer()`. */
    async _markCurrentMissing() {
        const cfg = appConfigVisualBg.getAll();
        const newList = markVisualBgListItemMissing(cfg.source.list, this._listIndex); // core/visual-bg.js
        if (newList.filter((k) => k !== null).length === 0) { await this.clearSource(); return; }
        appConfigVisualBg.mutateAll((c) => { c.source.list = newList; });
        console.log(`writer: "workflowVisualBg._markCurrentMissing", page: "visualBgConfig", content: "source.list[${this._listIndex}]=null"`);
        await this._persist();
        this._hideVideoOnly();
        this._scheduleStuckRecoveryTimer(cfg.listPlaybackMode, newList);
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
     * VIẾT LẠI (09/08/2026, gate load video theo Song, phản hồi Giang mục 1+4) — `type==='photo'`
     * GIỮ NGUYÊN hành vi cũ (`syncVisualBgVideoPlayback`, ngoài phạm vi gate lần này — Rule 1: đây
     * là guard clause, KHÔNG phải "bớt việc", nhánh photo đơn thuần đi lối cũ). `type==='video'` có
     * 4 khả năng:
     * (1) Song ĐANG phát + video THẬT CHƯA từng nạp (`_currentVideoKey===null`, đang chỉ hiện
     *     placeholder tĩnh hoặc chưa hiện gì cả) -> nạp THẬT lần đầu qua `_playVideoKey()` (tự câm
     *     cứng lúc `play()`, unmute sau khi ổn định — xem docstring hàm đó).
     * (2) Song ĐANG phát + video THẬT đã nạp rồi (đang đứng hình vì pause tạm) -> RESUME — CÙNG
     *     nguyên tắc "câm cứng lúc `play()`, unmute sau khi ổn định" (tránh cưỡng chế giành audio
     *     session iOS đúng lúc Song cũng vừa `.play()` — xem phân tích đã thống nhất với Giang),
     *     nhưng KHÔNG qua `waitBgVideoReady()` (gắn với lần SWAP gần nhất, không hợp lệ cho resume
     *     — xem docstring `workflowVideoPlayer.waitForNextPlaying()`).
     * (3) Song vừa PAUSE TẠM (`playbackStoppedAtPlaylistEnd===false`) -> pause video, giữ nguyên
     *     khung hình đang đứng (Giang chốt mục 1 — KHÔNG về placeholder).
     * (4) Song vừa DỪNG HẲN (`playbackStoppedAtPlaylistEnd===true`, hết playlist thật — xem
     *     `core/player-controls.js::stopPlaybackAtPlaylistEnd()`) -> quay về placeholder tĩnh CỦA
     *     ĐÚNG video đang phát (Giang chốt mục 1 — "placeholder của chính video current đó", không
     *     phải `list[0]`) — xem `_revertToPlaceholder()`.
     * Guard `_isSwappingVideo` GIỮ NGUYÊN (xem docstring `_playVideoKey()`). */
    syncPlaybackToAudio() {
        if (this._isSwappingVideo) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video') { syncVisualBgVideoPlayback(audioPlayer.paused); return; } // core/visual-bg.js — ảnh: giữ nguyên hành vi cũ
        if (!audioPlayer.paused) {
            if (this._currentVideoKey === null) { this._playVideoKey(cfg.source.list[this._listIndex]); return; } // (1)
            this._resumeVideoWithDelayedAudio(this._currentVideoKey); // (2)
            return;
        }
        if (appState.get('playbackStoppedAtPlaylistEnd')) { this._revertToPlaceholder(); return; } // (4)
        syncVisualBgVideoPlayback(true); // core/visual-bg.js — (3) pause tạm, đứng hình
    },

    /** (2) trong `syncPlaybackToAudio()` — resume video ĐÃ nạp sẵn, câm cứng lúc `play()`, unmute
     * SAU khi ổn định (`waitForNextPlaying()`) — CÙNG pattern `_playVideoKey()`, tránh cưỡng chế
     * giành audio session iOS đúng lúc Song cũng vừa `.play()`. Guard `_currentVideoKey ===
     * videoKey`: bỏ qua nếu đã có video KHÁC nạp đè lên trong lúc chờ.
     * @param {string} videoKey
     */
    _resumeVideoWithDelayedAudio(videoKey) {
        bgVideoElement.muted = true;
        setVideoBgGain(0); // core/video-player.js
        bgVideoElement.play().catch(() => {});
        if (typeof workflowVideoPlayer === 'undefined') return; // liên tuyến domain
        workflowVideoPlayer.waitForNextPlaying().then(() => {
            if (this._currentVideoKey === videoKey) this._applyVideoAudioSettingToElement(videoKey); // core/visual-bg.js lookup + gán muted/volume
        });
    },

    /** (4) trong `syncPlaybackToAudio()` — Song vừa dừng hẳn, video thật đang phát -> quay về
     * placeholder tĩnh CỦA ĐÚNG video đó (KHÔNG phải `list[0]`). Video thật bị dỡ hẳn (không chỉ
     * pause) — lần Song phát lại tiếp theo tự rơi vào nhánh (1), nạp lại từ đầu.
     */
    async _revertToPlaceholder() {
        const key = this._currentVideoKey;
        if (!key) return; // guard: không có video thật nào đang phát để mà "quay về" cả (đã là placeholder/chưa hiện gì)
        this._currentVideoKey = null;
        if (typeof workflowVideoPlayer !== 'undefined') await workflowVideoPlayer.showStaticBgThumb(key); // event/workflow/video-player.js — liên tuyến domain
    },

    // ===================== Chọn / Làm tươi / Gỡ nguồn =====================

    /** Đọc key THẬT của 1 origin tại thời điểm gọi — 1 key (single) hay N key (group), đã sắp theo
     * `nextOrder`. Không cache.
     * MỞ RỘNG (29/08/2026) — thêm 2 originKind: 'multi' (nhiều ảnh/video chọn tay qua picker
     * multi-select) và 'groupMulti' (nhiều Thư mục gộp lại) — CẢ 2 dùng chung `originId` = JSON
     * mảng (key thật/folderId) theo ĐÚNG thứ tự chọn, xem `_encodeMultiOriginId()`/
     * `_decodeMultiOriginId()` ngay dưới. Cùng dịp SỬA — 'group' giờ dùng được CẢ `type==='photo'`
     * (Thư mục Photo, KHÁC Album đã xoá — Photo giờ có Folder qua File Manager Folder Browser
     * chung với Song/Video, xem core/file-manager/folder.js::listFolders()).
     * @param {'photo'|'video'} type
     * @param {'single'|'group'|'multi'|'groupMulti'} originKind
     * @param {string} originId
     * @returns {Promise<string[]>}
     */
    async _readOriginKeys(type, originKind, originId) {
        if (originKind === 'single') return originId ? [originId] : [];
        if (originKind === 'multi') {
            const keys = this._decodeMultiOriginId(originId);
            // Self-heal: key nào không còn tồn tại (đã bị xoá sau lúc chọn) thì loại khỏi list,
            // GIỮ NGUYÊN thứ tự chọn của các key còn lại (KHÔNG sort lại theo `nextOrder` — đây là
            // danh sách người dùng TỰ TAY xếp bằng thứ tự chọn, khác `group` đọc nguyên khối 1
            // folder không có thứ tự "chọn tay" nào để giữ).
            const records = await Promise.all(keys.map((k) => (type === 'video' ? getVideoRecord(k) : getImageRecord(k)))); // service/db.js
            return keys.filter((_, i) => records[i]);
        }
        if (originKind === 'groupMulti') {
            const folderIds = this._decodeMultiOriginId(originId);
            const merged = [];
            for (const folderId of folderIds) { // tuần tự, giữ ĐÚNG thứ tự Thư mục đã chọn — mỗi Thư mục nối tiếp Thư mục trước
                const map = await getFolderSongMap(folderId); // service/db.js
                merged.push(...(await this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []))); // core/file-manager/folder.js
            }
            return merged;
        }
        // 'group' — 1 Thư mục duy nhất. SỬA (29/08/2026) — bỏ hẳn nhánh riêng theo `type`: Photo giờ
        // CŨNG có Folder (khác Album đã xoá), đọc y hệt Video, không còn cần loại trừ.
        const map = await getFolderSongMap(originId); // service/db.js
        return this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []); // core/file-manager/folder.js
    },

    /** MỚI (29/08/2026) — mã hoá 1 mảng key (originKind='multi') hoặc folderId (originKind=
     * 'groupMulti') thành `originId` (string) để lưu vào `source.originId`/`pending.originId` —
     * CẢ 2 field đó vốn chỉ nhận 1 string, không sửa schema DB, tận dụng JSON string sẵn có. */
    _encodeMultiOriginId(keys) {
        return JSON.stringify(keys);
    },

    /** MỚI (29/08/2026) — chiều ngược lại `_encodeMultiOriginId()`. JSON hỏng/không phải mảng (dữ
     * liệu cũ trước khi có originKind này, hoặc DB hỏng) -> mảng rỗng, tự self-heal qua đường "origin
     * đọc ra rỗng -> gỡ hẳn" đã có sẵn ở `_resolveAndCommitSource()`, KHÔNG throw. */
    _decodeMultiOriginId(originId) {
        try {
            const parsed = JSON.parse(originId);
            return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
        } catch (e) {
            return [];
        }
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

    // XOÁ (loại bỏ Album khỏi Photo Panel) — applyAlbumAsBackground() (lối tắt "Dùng làm nền
    // Slideshow" từ thanh quản lý Album) bỏ hẳn cùng tính năng — caller (event/workflow/file-
    // manager-photo.js) đã xoá.

    /** So sánh 2 mảng key — THUẬT TOÁN DUY NHẤT cho "list mới có khác list cũ không, khác bao
     * nhiêu" — dùng CHUNG cho MỌI nơi cần biết diff: `_resolveAndCommitSource()` (quyết định có bỏ
     * qua/pending hay không) và `_commitSourceNow()` (số liệu hiện modal). Giang chốt (29/08/2026)
     * — trước đây có 2 phép tính lệch nhau (1 chỗ so ĐÚNG THỨ TỰ để quyết định "có coi là đổi
     * không", 1 chỗ so THEO TẬP HỢP để đếm added/removed) — nay gộp làm 1 hàm, trả CẢ HAI cùng lúc,
     * KHÔNG tính rời rạc ở 2 nơi nữa.
     * `unchanged` NGHIÊM NGẶT hơn `added===0 && removed===0` — 1 danh sách ĐỔI CHỖ (cùng thành
     * viên, khác thứ tự) vẫn tính là "CÓ thay đổi" (`unchanged:false`) vì thứ tự có ý nghĩa thật với
     * playback khi `nextOrder` là 'sequential'/'playlist' — nhưng added/removed lúc đó vẫn ra 0/0
     * (đúng bản chất: không thêm/bớt THÀNH VIÊN nào, chỉ đổi thứ tự).
     * @param {string[]} oldList - có thể chứa `null` (slot đã gỡ) — bị lọc bỏ trước khi so.
     * @param {string[]} newList
     * @returns {{unchanged: boolean, added: number, removed: number, total: number}}
     */
    _diffKeyLists(oldList, newList) {
        const oldKeys = oldList.filter((k) => k !== null);
        // SỬA (29/08/2026, Giang báo — "Làm tươi list không đổi vẫn hiện modal chờ lượt mới, FAIL")
        // — so `newList` với `oldList` GỐC (có thể chứa `null` — slot bị quét rỗng lúc 1 ảnh/video
        // ĐANG cycle bị xoá giữa chừng, xem `persistSourceListMutation()`) khiến 2 danh sách CÙNG
        // nội dung sống vẫn bị coi "có đổi" chỉ vì lệch SỐ LƯỢNG slot (null có tính, key thật thì
        // không) — `_readOriginKeys()` không bao giờ trả `null`. Phải so với `oldKeys` (ĐÃ lọc bỏ
        // null) mới đúng "nội dung sống có đổi hay không".
        const unchanged = newList.length === oldKeys.length && newList.every((k, i) => k === oldKeys[i]);
        const oldSet = new Set(oldKeys);
        const newSet = new Set(newList);
        const added = newList.filter((k) => !oldSet.has(k)).length;
        const removed = oldKeys.filter((k) => !newSet.has(k)).length;
        return { unchanged, added, removed, total: newList.length };
    },

    /** Hiện modal phản ánh kết quả `_resolveAndCommitSource()` — DÙNG CHUNG cho nút "Làm tươi" VÀ 3
     * nút Chọn nguồn mới (Video/Ảnh/Thư mục, `_commitPickedKeys()`/`_commitFolderMultiSelection()`)
     * — Giang chốt (29/08/2026) "so sánh thay đổi phải nhất quán mọi nơi", không riêng gì "Làm tươi".
     * `queued:true` đã tự hiện modal "sẽ áp ở lượt kế" BÊN TRONG `_resolveAndCommitSource()` rồi —
     * gọi hàm này với case đó vẫn AN TOÀN, chỉ no-op (không hiện chồng thêm modal nào nữa).
     * @param {{queued: false, added: number, removed: number, total: number}|{queued: true, total: number}|null} result
     */
    async _showCommitResultModal(result) {
        if (!result) { await alertModal(t('visualBgSettingsDrawer.commitResult.cleared')); return; } // core/modal-choice-ui.js
        if (result.queued) return;
        if (result.added === 0 && result.removed === 0) { await alertModal(tFormat('visualBgSettingsDrawer.commitResult.unchanged', { total: result.total })); return; }
        await alertModal(tFormat('visualBgSettingsDrawer.commitResult.changed', { added: result.added, removed: result.removed, total: result.total }));
    },

    /** Đọc lại origin + ghi đè `source.list` — dùng CHUNG cho lúc CHỌN nguồn lẫn bấm "Làm tươi".
     * Origin đọc ra rỗng (folder/ảnh/video không còn tồn tại) -> gỡ hẳn (Giang chốt mục 2).
     * SỬA (08/08/2026, phản hồi Giang — "video key không còn tồn tại nữa là lưu trữ không cần
     * thiết") — XOÁ HẲN `source.videoAudio` (không giữ lại bất kỳ entry nào, kể cả video vẫn còn
     * mặt trong list mới) mỗi lần gọi hàm này — tức CẢ chọn nguồn MỚI lẫn "Làm tươi" nguồn CŨ đều
     * làm sạch. Trước đây field này sống ĐỘC LẬP với `source.list`/`originKind`/`originId` (chỉ bị
     * xoá lúc đổi `type`/`clearSource()`) — Giang chốt: KHÔNG còn "nhớ mãi theo video" nữa, ghi đè
     * lại từ đầu theo ĐÚNG source hiện tại mỗi lần origin được đọc lại, tránh tích luỹ rác của
     * video key không còn dùng.
     * SỬA (29/08/2026) — check "có đổi gì không" tách hẳn ra `_diffKeyLists()` (dùng CHUNG, xem
     * docstring hàm đó) thay vì tự so sánh riêng ở đây.
     * @param {'single'|'group'|'multi'|'groupMulti'} originKind
     * @param {string} originId
     * @returns {Promise<{queued: false, added: number, removed: number, total: number}|{queued: true, total: number}|null>}
     *   `queued:false` = đã áp NGAY, `added/removed` là diff so với `source.list` TRƯỚC lúc gọi.
     *   `queued:true` = đã xếp vào `pending`, CHƯA áp — modal "sẽ áp ở lượt kế" đã tự hiện BÊN TRONG
     *   hàm này (xem đoạn dưới), caller KHÔNG cần tự hiện modal nào thêm cho case này (vẫn nên gọi
     *   `_showCommitResultModal()` — hàm đó tự biết bỏ qua case `queued:true`, xem docstring nó).
     *   `null` nếu bị gỡ hẳn (origin rỗng).
     */
    async _resolveAndCommitSource(originKind, originId) {
        const cfg = appConfigVisualBg.getAll();
        const keys = await this._readOriginKeys(cfg.type, originKind, originId);
        if (keys.length === 0) {
            appConfigVisualBg.mutateAll((c) => { c.pending = { originKind: null, originId: null, list: [] }; }); // MỚI — origin mới đọc ra rỗng, huỷ luôn pending dở dang (nếu có), không còn gì để chờ áp nữa
            await this.clearSource();
            return null;
        }
        // MỚI (09/08/2026, mục 3, phản hồi Giang — "refresh làm mất modal thêm/bớt") — nguồn đọc ra
        // GIỐNG HỆT `source.list` hiện tại (cùng thứ tự, cùng key) -> KHÔNG có gì thay đổi thật ->
        // KHÔNG cần chế độ pending/modal "sẽ áp ở lượt kế" nào cả (không có gì để mà chờ áp) — trả
        // thẳng "0 thay đổi", để caller (refreshSource()/_commitPickedKeys()/
        // _commitFolderMultiSelection()) tự hiện đúng modal "không có gì đổi" qua
        // `_showCommitResultModal()`. Bug trước: dù danh sách y hệt vẫn bị coi là "có pending đang
        // chờ" (vì `_effectiveCount>0`), nuốt mất modal diff thật — chỉ còn hiện modal pending chung
        // chung, sai ngữ cảnh.
        const diff = this._diffKeyLists(cfg.source.list, keys);
        if (diff.unchanged) return { queued: false, added: 0, removed: 0, total: diff.total };
        // MỚI (09/08/2026, cơ chế pending, phản hồi Giang — "đổi nguồn giữa lúc đang cycle làm giật/
        // mất khung đang phát") — CÒN media đang active (photo lẫn video, Giang chốt áp dụng CẢ 2,
        // không tách riêng theo type) -> KHÔNG ghi đè `source` ngay, xếp vào `pending`, đợi đúng
        // "lượt kế tiếp" (video hết/tick ảnh kế/đổi bài hát — xem `_checkAndApplyPendingSource()`).
        // KHÔNG có gì đang active (list rỗng, hoặc vừa gỡ nguồn) -> áp ngay, không có gì để "chờ" cả.
        if (this._effectiveCount(cfg) > 0) {
            appConfigVisualBg.mutateAll((c) => { c.pending = { originKind, originId, list: keys }; }); // đè lên pending cũ nếu có (Giang chốt, chỉ giữ 1 pending duy nhất)
            console.log(`writer: "workflowVisualBg._resolveAndCommitSource", page: "visualBgConfig", content: "queued pending=${originKind}:${originId}, count=${keys.length}"`);
            await this._persist();
            // MỚI (09/08/2026, mục 2, phản hồi Giang — "tên nguồn ở Settings phải cập nhật ngay dù
            // còn pending") — TRƯỚC ĐÂY thiếu dòng này: queue xong nhưng panel KHÔNG tự vẽ lại, tên
            // nguồn cũ vẫn đứng yên tới khi có lý do khác gọi `refreshPanelUI()`. Gọi NGAY ở đây,
            // `_refreshSourceNameLabel()` giờ tự ưu tiên đọc `cfg.pending` (xem
            // `_effectiveDisplayedOrigin()`) nên sẽ hiện đúng tên nguồn VỪA chọn ngay lập tức.
            await this.refreshPanelUI();
            await alertModal(t(cfg.type === 'video' ? 'visualBgSettingsDrawer.pendingSource.video' : 'visualBgSettingsDrawer.pendingSource.photo')); // core/modal-choice-ui.js
            return { queued: true, total: keys.length };
        }
        return await this._commitSourceNow(originKind, originId, keys, diff);
    },

    /** Ghi đè `source` NGAY (không qua pending) — tách khỏi `_resolveAndCommitSource()` (09/08/2026,
     * cơ chế pending) vì `_checkAndApplyPendingSource()` KHÔNG dùng nhánh này (áp thẳng, không cần
     * diff added/removed — không có UI nào cần hiện diff lúc áp pending).
     * SỬA (29/08/2026) — nhận thẳng `diff` (đã tính SẴN ở `_resolveAndCommitSource()` qua
     * `_diffKeyLists()`) thay vì tự tính lại added/removed ở đây — 1 phép tính, không lặp 2 nơi.
     * @param {'single'|'group'|'multi'|'groupMulti'} originKind
     * @param {string} originId
     * @param {string[]} keys
     * @param {{unchanged: boolean, added: number, removed: number, total: number}} diff - từ `_diffKeyLists()`.
     * @returns {Promise<{queued: false, added: number, removed: number, total: number}>}
     */
    async _commitSourceNow(originKind, originId, keys, diff) {
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = keys;
            c.source.videoAudio = {}; // xem docstring _resolveAndCommitSource() cũ — Giang chốt, xoá sạch mỗi lần đọc lại origin
            c.pending = { originKind: null, originId: null, list: [] }; // huỷ pending cũ (nếu có) — cái mới đã áp thẳng, không còn gì chờ
        });
        console.log(`writer: "workflowVisualBg._commitSourceNow", page: "visualBgConfig", content: "source=${originKind}:${originId}, count=${keys.length}, +${diff.added}/-${diff.removed}, videoAudio=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return { queued: false, added: diff.added, removed: diff.removed, total: keys.length };
    },

    /** Ứng nút "Làm tươi" — đọc lại ĐÚNG origin ĐANG HIỂN THỊ (`_effectiveDisplayedOrigin()` — ưu
     * tiên pending nếu có, xem docstring hàm đó), ghi đè `source.list` (hoặc xếp/đè pending nếu
     * đang active — xem `_resolveAndCommitSource()`). Có hiệu ứng xoay trên nút trong lúc đọc DB +
     * modal báo THAY ĐỔI GÌ sau khi xong (Giang chốt mục 2 cũ) — SỬA (29/08/2026) modal giờ qua
     * `_showCommitResultModal()` dùng chung, xem docstring hàm đó. */
    async refreshSource() {
        const { originKind, originId } = this._effectiveDisplayedOrigin(appConfigVisualBg.getAll());
        if (!originKind || !originId) return; // guard: chưa có nguồn
        const btn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-refresh-source') : null;
        if (btn) { btn.disabled = true; btn.classList.add('animate-spin'); }
        try {
            const result = await this._resolveAndCommitSource(originKind, originId);
            await this._showCommitResultModal(result);
        } finally {
            if (btn) { btn.disabled = false; btn.classList.remove('animate-spin'); }
        }
    },

    /** Gỡ hẳn nguồn hiện tại — về "chưa chọn" (đường DUY NHẤT, không còn Block gate chặn xoá ảnh/
     * video/folder — Batch 3). */
    async clearSource() {
        // MỚI (09/08/2026, cơ chế pending, phản hồi Giang mục 2) — huỷ luôn pending dở dang (nếu
        // có): user chủ động gỡ hẳn = không còn gì để "chờ áp" nữa, KHÔNG áp ngay như bình thường.
        appConfigVisualBg.mutateAll((cfg) => { cfg.source = { originKind: null, originId: null, list: [], videoAudio: {} }; cfg.pending = { originKind: null, originId: null, list: [] }; });
        console.log(`writer: "workflowVisualBg.clearSource", page: "visualBgConfig", content: "source=cleared, pending=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    // XOÁ (29/08/2026) — changeType() (ứng dropdown "Kiểu" cũ) bỏ hẳn cùng dropdown đó (0 lời gọi
    // còn lại) — `type` giờ là HỆ QUẢ của nút chọn nguồn vừa bấm (Video/Ảnh/Thư mục), gán NGAY
    // trong `_commitPickedKeys()`/`_commitFolderMultiSelection()` (đọc thẳng khi cần đổi, không
    // qua hàm trung gian riêng nữa — chỉ 1 chỗ gọi thì không cần tách hàm, Rule 3c).

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
        // MỚI (12/08/2026, mục 6) — SỬA BUG: nếu Movement đang chạy VÀ vừa sửa gradientStops (kéo
        // vị trí/đổi màu/thêm/xoá chặng) trong lúc panel đang mở, cache `_gradientMovementBaseStops`
        // (chỉ chụp 1 lần lúc task bắt đầu) sẽ LỆCH khỏi DB, tick tiếp tục vẽ theo bản CŨ — đồng bộ
        // lại NGAY tại đây (nơi DUY NHẤT mọi thay đổi màu/stop đều đi qua) thay vì rải rác ở từng
        // hàm gọi _commitColorChange() riêng lẻ.
        if (taskManager.isTaskRunning(VISUAL_BG_GRADIENT_MOVEMENT_TASK)) { // core/visual-bg.js
            this._gradientMovementBaseStops = appConfigVisualBg.getAll().gradientStops.slice();
        }
        clearTimeout(this._colorPersistTimer);
        this._colorPersistTimer = setTimeout(() => this._persist(), 300);
    },

    async changeColorMode(value) {
        if (!VISUAL_BG_COLOR_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.colorMode = value; });
        console.log(`writer: "workflowVisualBg.changeColorMode", page: "visualBgConfig", content: "colorMode=${value}"`);
        updateDOMBackground();
        this._syncGradientMovementTaskState(); // MỚI (12/08/2026, mục 6) — rời khỏi 'gradient' phải dừng animation, chuyển VÀO 'gradient' (đã bật Movement từ trước) phải chạy lại
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
        if (genericDrawerPanel.classList.contains('hidden')) return;
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
        if (genericDrawerPanel.classList.contains('hidden')) return;
        if (field === 'position') visualBgGradientPanelEl.querySelector(`[data-visual-bg-stop-label="${index}"]`).textContent = `${parsed}%`;
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    addGradientStop() {
        this._commitColorChange((cfg) => { cfg.gradientStops = addVisualBgGradientStop(cfg.gradientStops); }, 'gradientStops +1'); // core/visual-bg.js
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    removeGradientStop(index) {
        this._commitColorChange((cfg) => { cfg.gradientStops = removeVisualBgGradientStop(cfg.gradientStops, index); }, `gradientStops -1 (index ${index})`); // core/visual-bg.js
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    // SỬA (đợt migrate Visualizer Screen) — KHÔNG còn pushSettingsPanel(), bodyHtml do
    // event/workflow/app-settings.js cung cấp SẴN qua navigateTo().
    openGradientPanel() {
        visualBgGradientPanelEl = genericDrawerBody;
        const cfg = appConfigVisualBg.getAll();
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-angle').value = cfg.gradientAngleDeg;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = `${cfg.gradientAngleDeg}°`;
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);

        // MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement") — đồng bộ toàn bộ input Movement +
        // Color swap lúc mở panel, CÙNG khuôn phần angle/stops ngay trên.
        const gm = cfg.gradientMovement;
        const elMovementEnable = visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-movement-enable');
        elMovementEnable.checked = gm.enabled;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-options').classList.toggle('hidden', !gm.enabled);
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-movement-mode').value = gm.mode;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-time-block').classList.toggle('hidden', gm.mode !== 'time');
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-audio-block').classList.toggle('hidden', gm.mode !== 'audio');
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-duration-value').textContent = this._formatMovementMs(gm.rotateDurationMs);
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-movement-audio-rotate-from').value = gm.audioRotateFrom;
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-movement-audio-rotate-to').value = gm.audioRotateTo;
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-movement-audio-spread-from').value = gm.audioStopSpreadFrom;
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-movement-audio-spread-to').value = gm.audioStopSpreadTo;

        const elSwapEnable = visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-colorswap-enable');
        elSwapEnable.checked = gm.colorSwapEnabled;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-options').classList.toggle('hidden', !gm.colorSwapEnabled);
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-interval-value').textContent = this._formatMovementMs(gm.colorSwapIntervalMs);
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-transition-value').textContent = this._formatMovementMs(gm.colorSwapTransitionMs);
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

    // ===================== "Movement" cho Gradient (MỚI, 12/08/2026, Giang yêu cầu mục 6) =====================
    // Xoay/dao động linear-gradient theo thời gian HOẶC theo nhạc, + tráo màu ngẫu nhiên định kỳ.
    // CHỈ chạy khi `colorMode==='gradient' && gradientMovement.enabled`
    // (_syncGradientMovementTaskState() tự bật/tắt task đúng điều kiện, gọi lại mỗi khi 1 trong 2
    // field đổi HOẶC lúc boot). Vẽ MỖI TICK bằng applyGradientCssFrame() (core/visual-bg.js) — GHI
    // TRỰC TIẾP DOM, KHÔNG ghi ngược lại appConfigVisualBg/DB (animation là hiệu ứng NHẤT THỜI, DB
    // chỉ giữ cấu hình GỐC tĩnh — angle/stops LƯU DB KHÔNG đổi trong lúc Movement chạy).
    //
    // Ô preview vuông trong panel (_paintGradientPreview() ngay trên) CỐ Ý KHÔNG chạy animation này
    // — chỉ vẽ tĩnh theo cấu hình gốc, giữ preview đơn giản/nhẹ (xem docstring components/
    // visual-bg-gradient-drawer.js).

    /** Đăng ký + bật task tick (taskManager, mode 'timeout' tự lặp — Rule "TaskManager CHỈ Workflow
     * được dùng"). An toàn gọi nhiều lần — no-op nếu task đã chạy (KHÔNG reset lại pha animation
     * giữa chừng, tránh giật hình mỗi lần _syncGradientMovementTaskState() được gọi lại). */
    _startGradientMovementTask() {
        if (taskManager.isTaskRunning(VISUAL_BG_GRADIENT_MOVEMENT_TASK)) return;
        this._gradientMovementStartTime = Date.now();
        this._gradientMovementBaseStops = appConfigVisualBg.getAll().gradientStops.slice();
        this._gradientMovementSwapStartTime = null;
        this._gradientMovementLastSwapTime = Date.now();
        this._gradientMovementPhaseStartTime = null; // bootstrap lại — tick đầu tiên tự chốt pha
        this._gradientMovementPhaseDurationMs = null;
        this._gradientMovementPhaseFromAngle = null;
        this._gradientMovementPhaseToAngle = null;
        this._gradientMovementPhaseFromSpread = null;
        this._gradientMovementPhaseToSpread = null;
        taskManager.addNew(VISUAL_BG_GRADIENT_MOVEMENT_TASK, { time: VISUAL_BG_GRADIENT_MOVEMENT_TICK_MS, exe: () => this._tickGradientMovement(), mode: 'timeout', count: 0 }); // core/visual-bg.js (hằng số tick+tên task)
        taskManager.operator(VISUAL_BG_GRADIENT_MOVEMENT_TASK, 'enabled');
    },

    /** Dừng hẳn + dọn state transition tráo màu (nếu đang dở) — gọi khi tắt Movement/chuyển khỏi
     * colorMode 'gradient'. Nền gradient TĨNH (đứng yên tại giá trị GỐC lưu DB) tự động quay lại
     * qua nhánh updateDOMBackground() bình thường ở nơi khác — KHÔNG cần vẽ lại gì thêm ở đây. */
    _stopGradientMovementTask() {
        taskManager.kill(VISUAL_BG_GRADIENT_MOVEMENT_TASK);
        this._gradientMovementSwapStartTime = null;
        // Khung hình LIVE hết hiệu lực — visual 2D đọc (rain.js) tự rơi về gradientAngleDeg/
        // gradientStops TĨNH lưu DB, xem core/visual-bg.js::getVisualBgFillStyle().
        appState.set('visualBgGradientLiveAngle', null, { skipCheck: true });
        appState.set('visualBgGradientLiveStops', null, { skipCheck: true });
    },

    /** Bật/tắt task animation theo ĐÚNG điều kiện hiện tại — gọi lại mỗi khi colorMode/
     * gradientMovement.* đổi (changeColorMode(), toggleGradientMovement(), thay đổi mode...) HOẶC
     * lúc boot (loadPersistedSettingsOnBoot()). */
    _syncGradientMovementTaskState() {
        const cfg = appConfigVisualBg.getAll();
        const shouldRun = cfg.colorMode === 'gradient' && cfg.gradientMovement.enabled;
        if (shouldRun) this._startGradientMovementTask();
        else this._stopGradientMovementTask();
    },

    /** 1 khung hình animation — đọc cfg MỚI NHẤT mỗi lần (cho phép đổi setting giữa lúc đang chạy
     * mà không cần restart task), tính angle+stops rồi vẽ + ghi khung hình LIVE vào appState (cho
     * visual 2D khác đọc lại, xem core/visual-bg.js::getVisualBgFillStyle()).
     * Mode 'audio' xoay THEO PHA (Giang chốt 13/08/2026) — 1 pha chạy TRỌN VẸN mượt tới đích rồi
     * mới lấy mẫu nhạc MỚI chốt pha kế (_commitNextGradientPhase()), KHÔNG map trực tiếp
     * energy->angle mỗi tick (map thẳng khiến góc "giật", đảo chiều bất cứ lúc nào năng lượng đổi —
     * xem phân tích đầy đủ ở đó). */
    _tickGradientMovement() {
        const cfg = appConfigVisualBg.getAll();
        const gm = cfg.gradientMovement;
        const now = Date.now();

        // ----- Góc xoay + độ giãn stop theo mode -----
        let angle;
        let stops = this._gradientMovementBaseStops;
        if (gm.mode === 'audio') {
            if (this._gradientMovementPhaseStartTime === null) this._commitNextGradientPhase(gm); // tick đầu tiên — chưa có pha nào để nội suy từ
            const progress = Math.min(1, (now - this._gradientMovementPhaseStartTime) / this._gradientMovementPhaseDurationMs);
            const eased = easeInOutSine(progress); // core/visual-bg.js
            angle = lerpGradientMovementValue(this._gradientMovementPhaseFromAngle, this._gradientMovementPhaseToAngle, eased); // core/visual-bg.js
            const spread = lerpGradientMovementValue(this._gradientMovementPhaseFromSpread, this._gradientMovementPhaseToSpread, eased);
            stops = computeGradientStopSpread(stops, spread); // core/visual-bg.js
            if (progress >= 1) this._commitNextGradientPhase(gm); // pha vừa xong — lấy mẫu nhạc NGAY LÚC NÀY, chốt pha kế tiếp
        } else {
            const elapsed = now - this._gradientMovementStartTime;
            angle = computeGradientTimeRotateAngle(elapsed, gm.rotateDurationMs); // core/visual-bg.js
        }

        // ----- Tráo màu (ĐỘC LẬP với mode ở trên, chạy song song nếu bật) -----
        if (gm.colorSwapEnabled) {
            if (this._gradientMovementSwapStartTime === null && now - this._gradientMovementLastSwapTime >= gm.colorSwapIntervalMs) {
                const randomFactors = stops.map(() => Math.random()); // Workflow tự tạo ngẫu nhiên (Rule 3d — core không nhận callback sống)
                const shuffled = shuffleGradientStopColors(this._gradientMovementBaseStops, randomFactors); // core/visual-bg.js
                this._gradientMovementSwapFromColors = this._gradientMovementBaseStops.map((s) => s.color);
                this._gradientMovementSwapToColors = shuffled.map((s) => s.color);
                this._gradientMovementSwapStartTime = now;
                // SỬA (12/08/2026) — đặt lại đồng hồ NGAY LÚC BẮT ĐẦU tráo (không đợi hết transition
                // mới đặt lại) — đúng ngữ nghĩa "tráo mỗi X giây" = khoảng cách giữa 2 lần BẮT ĐẦU
                // tráo liên tiếp, KHÔNG cộng dồn thêm colorSwapTransitionMs vào chu kỳ (nếu đặt lại
                // lúc HẾT transition, interval=1s + transition=3s sẽ ra chu kỳ thật 4s, sai kỳ vọng).
                this._gradientMovementLastSwapTime = now;
            }
            if (this._gradientMovementSwapStartTime !== null) {
                const progress = Math.min(1, (now - this._gradientMovementSwapStartTime) / gm.colorSwapTransitionMs);
                const interpolated = this._gradientMovementSwapFromColors.map((c, i) => interpolateColor(c, this._gradientMovementSwapToColors[i], progress)); // core/color-utils.js
                stops = applyGradientStopColors(stops, interpolated); // core/visual-bg.js
                if (progress >= 1) {
                    // Tráo xong — CHỐT làm base MỚI (giữ nguyên vị trí %, chỉ đổi màu). Đồng hồ
                    // interval ĐÃ đặt lại ở trên rồi, không đặt lại lần 2 ở đây.
                    this._gradientMovementBaseStops = applyGradientStopColors(this._gradientMovementBaseStops, this._gradientMovementSwapToColors); // core/visual-bg.js
                    this._gradientMovementSwapStartTime = null;
                }
            }
        }

        applyGradientCssFrame(buildVisualBgGradientCss(stops, angle)); // core/visual-bg.js — 2 lệnh RIÊNG (Rule 3), Workflow tự nối chuỗi CSS rồi mới ghi DOM
        // Khung hình LIVE cho visual 2D khác đọc lại (rain.js) — xem core/visual-bg.js::getVisualBgFillStyle().
        appState.set('visualBgGradientLiveAngle', angle, { skipCheck: true });
        appState.set('visualBgGradientLiveStops', stops, { skipCheck: true });
    },

    /** Chốt 1 pha xoay/giãn MỚI cho mode 'audio' — lấy mẫu BPM/energy TẠI THỜI ĐIỂM GỌI (Giang
     * chốt: không hằng số cố định, không bám sát tuyệt đối theo nhịp nhạc, chỉ lấy dữ liệu Ở ĐÚNG
     * thời điểm pha cũ vừa xong) — CÙNG công thức tốc độ theo nhạc mà core/visualizer/types/
     * space.js dùng cho camera Space. Pha MỚI luôn bắt đầu từ đúng giá trị pha CŨ vừa dừng (không
     * "nhảy" góc). */
    _commitNextGradientPhase(gm) {
        const bpm = parseInt(appState.get('currentCalculatedBpm'), 10) || 120;
        const energy = appState.get('smoothedEnergy') || 0;
        const musicSpeedFactor = computeMusicSpeedFactor(bpm, energy, VISUAL_BG_GRADIENT_MUSIC_FACTOR_MIN, VISUAL_BG_GRADIENT_MUSIC_FACTOR_MAX); // core/visual-bg.js
        const duration = computeGradientPhaseDuration(VISUAL_BG_GRADIENT_PHASE_BASE_MS, musicSpeedFactor); // core/visual-bg.js

        this._gradientMovementPhaseFromAngle = this._gradientMovementPhaseToAngle !== null ? this._gradientMovementPhaseToAngle : gm.audioRotateFrom;
        this._gradientMovementPhaseToAngle = lerpGradientMovementValue(gm.audioRotateFrom, gm.audioRotateTo, energy); // core/visual-bg.js
        this._gradientMovementPhaseFromSpread = this._gradientMovementPhaseToSpread !== null ? this._gradientMovementPhaseToSpread : gm.audioStopSpreadFrom;
        this._gradientMovementPhaseToSpread = lerpGradientMovementValue(gm.audioStopSpreadFrom, gm.audioStopSpreadTo, energy);
        this._gradientMovementPhaseStartTime = Date.now();
        this._gradientMovementPhaseDurationMs = duration;
    },

    /** Ứng với toggle bật/tắt Movement. */
    async toggleGradientMovement(checked) {
        this._commitColorChange((cfg) => { cfg.gradientMovement.enabled = checked; }, `gradientMovement.enabled=${checked}`);
        this._syncGradientMovementTaskState();
        if (genericDrawerPanel.classList.contains('hidden')) return;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-options').classList.toggle('hidden', !checked);
    },

    /** Ứng với select đổi mode Movement ('time'/'audio'). */
    changeGradientMovementMode(value) {
        if (!VISUAL_BG_GRADIENT_MOVEMENT_MODES.includes(value)) return; // core/visual-bg.js
        this._commitColorChange((cfg) => { cfg.gradientMovement.mode = value; }, `gradientMovement.mode=${value}`);
        this._gradientMovementStartTime = Date.now(); // mode 'time' — tính lại pha animation từ đầu, tránh nhảy góc đột ngột
        this._gradientMovementPhaseStartTime = null;  // mode 'audio' — bootstrap lại pha, tick kế tiếp tự chốt pha đầu
        if (genericDrawerPanel.classList.contains('hidden')) return;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-time-block').classList.toggle('hidden', value !== 'time');
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-audio-block').classList.toggle('hidden', value !== 'audio');
    },

    /** Ứng với nút mở time-picker "Hết 1 vòng sau" (mode 'time'). */
    openGradientMovementDurationPicker() {
        const cfg = appConfigVisualBg.getAll();
        openTimePickerModal({ // core/time-picker-modal.js — dùng chung
            title: t('visualBgSettingsDrawer.gradientMovement.duration.pickerTitle'),
            format: 's-ms',
            valueMs: cfg.gradientMovement.rotateDurationMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS, // core/visual-bg.js
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS,
            onConfirm: (resultMs) => {
                this._commitColorChange((c) => { c.gradientMovement.rotateDurationMs = resultMs; }, `gradientMovement.rotateDurationMs=${resultMs}`);
                this._gradientMovementStartTime = Date.now(); // đổi thời lượng = tính lại pha, tránh nhảy góc
                if (visualBgGradientPanelEl) visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-duration-value').textContent = this._formatMovementMs(resultMs);
            },
        });
    },

    /** 2 hàng number input "From/To" mode 'audio' — góc xoay (0-360) + độ giãn stop (0-50%). Cả 4
     * field CÙNG 1 process (ghi 1 số vào field tương ứng), gộp 1 hàm nhận tên field — Rule 1. */
    changeGradientMovementAudioRange(field, value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return;
        this._commitColorChange((cfg) => { cfg.gradientMovement[field] = num; }, `gradientMovement.${field}=${num}`);
    },

    /** Ứng với toggle bật/tắt "Tráo màu". */
    toggleGradientColorSwap(checked) {
        this._commitColorChange((cfg) => { cfg.gradientMovement.colorSwapEnabled = checked; }, `gradientMovement.colorSwapEnabled=${checked}`);
        this._gradientMovementLastSwapTime = Date.now(); // bật lại = đợi đủ 1 interval mới tráo lần đầu, không tráo ngay lập tức
        if (genericDrawerPanel.classList.contains('hidden')) return;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-options').classList.toggle('hidden', !checked);
    },

    /** Ứng với nút mở time-picker "Tráo mỗi". */
    openGradientColorSwapIntervalPicker() {
        const cfg = appConfigVisualBg.getAll();
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.gradientMovement.colorSwapInterval.pickerTitle'),
            format: 's-ms',
            valueMs: cfg.gradientMovement.colorSwapIntervalMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS, // core/visual-bg.js — CÙNG khoảng biên 1s-60s với rotateDurationMs
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS,
            onConfirm: (resultMs) => {
                this._commitColorChange((c) => { c.gradientMovement.colorSwapIntervalMs = resultMs; }, `gradientMovement.colorSwapIntervalMs=${resultMs}`);
                if (visualBgGradientPanelEl) visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-interval-value').textContent = this._formatMovementMs(resultMs);
            },
        });
    },

    /** Ứng với nút mở time-picker "Thời gian chuyển cảnh". */
    openGradientColorSwapTransitionPicker() {
        const cfg = appConfigVisualBg.getAll();
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.gradientMovement.colorSwapTransition.pickerTitle'),
            format: 's-ms',
            valueMs: cfg.gradientMovement.colorSwapTransitionMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS, // core/visual-bg.js — 500ms-3s
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS,
            onConfirm: (resultMs) => {
                this._commitColorChange((c) => { c.gradientMovement.colorSwapTransitionMs = resultMs; }, `gradientMovement.colorSwapTransitionMs=${resultMs}`);
                if (visualBgGradientPanelEl) visualBgGradientPanelEl.querySelector('#visual-bg-gradient-colorswap-transition-value').textContent = this._formatMovementMs(resultMs);
            },
        });
    },

    /** @param {number} ms @returns {string} vd "2.0s" — CÙNG khuôn workflowGestureSettings._formatSeekMs(). */
    _formatMovementMs(ms) {
        return `${((ms || 0) / 1000).toFixed(1)}s`;
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
        // SỬA (đợt migrate Visualizer Screen) — KHÔNG còn pushSettingsPanel(), bodyHtml do
        // event/workflow/app-settings.js cung cấp SẴN qua navigateTo().
        visualBgVideoAudioPanelEl = genericDrawerBody;
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

    // ===================== Panel Settings =====================

    /** SỬA (đợt migrate Visualizer Screen, phản hồi Giang "làm nốt visualizer") — KHÔNG còn
     * `pushSettingsPanel()`, bodyHtml do event/workflow/app-settings.js cung cấp SẴN qua
     * `navigateTo()` — chỉ còn gán biến (đọc lại bởi mọi hàm bên dưới) + đồng bộ giá trị. */
    async openPanel() {
        visualBgSettingsPanelEl = genericDrawerBody;
        await this.refreshPanelUI();
    },

    /** Đồng bộ UI panel theo config hiện tại — gọi lúc mở panel + sau mọi thay đổi field.
     *
     * SỬA (phát hiện bug boot treo, phản hồi Giang) — bản trước tự gọi
     * `workflowAppSettings._renderVisualBg()` khi thấy Generic Drawer đang ĐÓNG (ý định: tự mở lại
     * Visual Background sau khi picker con đóng xong) — SAI: hàm này CÒN được gọi từ
     * `_checkAndApplyPendingSource()` (CHẠY LÚC BOOT, `loadPersistedSettingsOnBoot()`, KHÔNG liên
     * quan gì tới Settings/picker) — khiến app TỰ Ý bật Setting lên giữa chừng boot, treo cả chuỗi.
     * QUAY LẠI guard đơn thuần — việc "quay lại đúng Visual Background sau khi picker con đóng" đã
     * xử lý RIÊNG, ĐÚNG chỗ ở `_closePickerDrawer()`/`openPickPhoto()` (gọi
     * `workflowAppSettings._renderVisualBg()` tường minh ngay tại điểm đóng picker, không mượn qua
     * đây) — hàm này KHÔNG được tự ý mở màn nào cả, chỉ đồng bộ NẾU đang mở sẵn. */
    async refreshPanelUI() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        const q = (sel) => visualBgSettingsPanelEl.querySelector(sel);

        // XOÁ (29/08/2026) — dropdown "Kiểu" + đồng bộ nhãn 2 nút "Chọn 1"/"Chọn nhóm" bỏ hẳn cùng
        // UI cũ (components/visual-bg-settings-drawer.js) — 3 nút Video/Ảnh/Thư mục mới dùng nhãn
        // TĨNH (data-i18n, không phụ thuộc `cfg.type` nữa — type giờ là HỆ QUẢ của nút vừa bấm,
        // không phải điều kiện hiển thị của nút).

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
     * có origin hay không.
     * SỬA (09/08/2026, mục 2, phản hồi Giang — "đổi source list vẫn pending nhưng tên nguồn ở
     * Settings phải cập nhật ngay") — ưu tiên đọc `cfg.pending` nếu có (origin VỪA chọn, CHƯA áp
     * vào `source` thật vì đang có media active — xem `_resolveAndCommitSource()`): user đã chọn
     * xong, panel PHẢI phản ánh lựa chọn đó ngay lập tức, không đợi tới lúc pending thật sự áp vào
     * `source` (video/ảnh hiện tại VẪN tiếp tục phát bình thường, KHÔNG bị gián đoạn — chỉ có nhãn
     * hiển thị "chạy trước" so với nội dung thật). Dùng CHUNG `_effectiveDisplayedOrigin()` với
     * `refreshSource()` — "Làm tươi" lúc đang có pending PHẢI đọc lại ĐÚNG origin đang HIỂN THỊ
     * (pending), không phải origin CŨ còn đang phát. */
    async _refreshSourceNameLabel(cfg) {
        const labelEl = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#visual-bg-source-name') : null;
        const refreshBtn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-refresh-source') : null;
        const clearBtn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-clear-source') : null;
        const { originKind, originId } = this._effectiveDisplayedOrigin(cfg);
        if (refreshBtn) refreshBtn.classList.toggle('hidden', !originId);
        if (clearBtn) clearBtn.classList.toggle('hidden', !originId);
        if (!labelEl) return;
        if (!originId) { labelEl.textContent = t('visualBgSettingsDrawer.pickSource.none'); return; }
        labelEl.textContent = await this._readSourceDisplayName(cfg.type, originKind, originId);
    },

    /** MỚI (09/08/2026, mục 2, phản hồi Giang) — origin nên HIỂN THỊ ở Settings (KHÁC origin đang
     * THẬT SỰ phát nếu có pending) — `cfg.pending` (nếu có) LUÔN thắng `cfg.source` (origin cũ đang
     * phát chỉ còn ý nghĩa cho tới lúc pending áp xong). Dùng CHUNG cho `_refreshSourceNameLabel()`
     * lẫn `refreshSource()` (Rule 3c — hàm con phục vụ tái dùng).
     * @param {object} cfg
     * @returns {{originKind: string|null, originId: string|null}}
     */
    _effectiveDisplayedOrigin(cfg) {
        return cfg.pending.originKind ? { originKind: cfg.pending.originKind, originId: cfg.pending.originId } : { originKind: cfg.source.originKind, originId: cfg.source.originId };
    },

    /** Đọc tên hiển thị thật của 1 origin (imageKey/videoKey/folderId, hoặc đếm số lượng cho 2
     * originKind gộp nhiều — 'multi'/'groupMulti', KHÔNG có 1 cái tên đơn lẻ nào để đọc).
     * MỞ RỘNG (29/08/2026) — 'group' giờ đọc được CẢ `type==='photo'` (Thư mục Photo, khác Album đã
     * xoá — xem `_readOriginKeys()`).
     */
    async _readSourceDisplayName(type, originKind, originId) {
        const none = t('visualBgSettingsDrawer.pickSource.none');
        if (originKind === 'multi') {
            const count = this._decodeMultiOriginId(originId).length;
            return tFormat(type === 'video' ? 'visualBgSettingsDrawer.sourceLabel.multiVideo' : 'visualBgSettingsDrawer.sourceLabel.multiPhoto', { count });
        }
        if (originKind === 'groupMulti') {
            const count = this._decodeMultiOriginId(originId).length;
            return tFormat('visualBgSettingsDrawer.sourceLabel.groupMulti', { count });
        }
        if (originKind === 'group') {
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

    // ===================== "Chọn nguồn" — 3 nút Video/Ảnh/Thư mục, MỚI (29/08/2026) =====================
    // Thay hẳn 4 tổ hợp single/group cũ. Video + Ảnh giờ CÙNG 1 khuôn: picker Generic Drawer
    // multi-select (đánh số theo thứ tự chọn, xem event/workflow/photo-gallery-window.js
    // /video-gallery-window.js::badgeMode='multiSelect') + nút "Chọn (N)" trong body xác nhận —
    // commit qua `_commitPickedKeys()`, originKind='multi' (1 item chọn = hệt "chọn 1" cũ, mảng độ
    // dài 1). Thư mục giờ multi-select GỘP nhiều folder (originKind='groupMulti'), dropdown
    // Video/Ảnh ngay trong header picker (workflowPlaylist._openFolderPickerDrawer(), phần mở rộng
    // 'typeOptions'/'onTypeChange').
    // CẢ 2 picker Video/Ảnh giờ dùng `updateGenericDrawer()` (updateInPlace=true, xem
    // core/media-picker-drawer-helper.js) — panel VBG ĐÃ SỐNG SẴN trong Generic Drawer (Settings),
    // không cần mở chồng lần nữa (đúng nguồn cơn bug isGenericDrawerOpen cũ, xem event/block.js).

    _pickerCleanup: null,
    _pickerSelectedKeys: [], // ordered — thứ tự CHỌN, dùng chung cho picker Video LẪN Ảnh (không bao giờ mở đồng thời)
    _photoPickerRowHeightPx: 120, // CÙNG giá trị PHOTO_ROW_HEIGHT_PX (event/workflow/file-manager-photo.js) — tách hằng số riêng, không phụ thuộc thứ tự nạp file

    /** SỬA (đợt migrate Visualizer Screen) — TRƯỚC ĐÂY `closeFully()` (Visual BG là khung riêng
     * biệt bên dưới picker, đóng picker xong picker biến mất, Visual BG hiện lại tự nhiên). Nay
     * Visual BG SỐNG TRONG CHÍNH Generic Drawer picker vừa mượn — `closeFully()` sẽ đóng LUÔN Visual
     * BG, không có gì để quay lại. TỰ MỞ LẠI màn Visual Background (event/workflow/app-settings.js,
     * liên tuyến domain TH2) thay vì đóng hẳn. */
    _closePickerDrawer() {
        if (this._pickerCleanup) { this._pickerCleanup(); this._pickerCleanup = null; }
        workflowAppSettings._renderVisualBg();
    },

    /** HTML khung picker Video/Ảnh: scroll container (grid windowing chèn vào TRONG) + nút "Chọn"
     * xác nhận cố định phía dưới (id khớp `openMediaPickerDrawerUi()`'s `showConfirmButton`, core/
     * media-picker-drawer-helper.js — tự wire click -> `${msgPrefix}.confirm.click`). */
    _buildMultiPickerBodyHtml(scrollId, emptyId, emptyText) {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="${scrollId}">
                <p id="${emptyId}" class="hidden text-sm text-slate-400 text-center py-10 px-6">${emptyText}</p>
            </div>
            <div class="px-5 py-3 border-t border-slate-200 shrink-0">
                <button type="button" id="btn-file-manager-image-picker-confirm" class="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled>${t('visualBgSettingsDrawer.picker.confirmEmpty')}</button>
            </div>
        `;
    },

    /** Cập nhật nhãn/trạng thái nút "Chọn" theo SỐ LƯỢNG đang chọn — gọi lại SAU mỗi lần toggle 1
     * tile (KHÔNG dựng lại cả header/nút, chỉ patch text/disabled — nút đã được wire click 1 LẦN lúc
     * mở picker). */
    _syncPickerConfirmButton() {
        const btn = genericDrawerBody.querySelector('#btn-file-manager-image-picker-confirm');
        if (!btn) return;
        const count = this._pickerSelectedKeys.length;
        btn.disabled = count === 0;
        btn.textContent = count === 0 ? t('visualBgSettingsDrawer.picker.confirmEmpty') : tFormat('visualBgSettingsDrawer.picker.confirm', { count });
    },

    /** Thêm/bớt 1 key khỏi `_pickerSelectedKeys` — ĐANG chọn thì bỏ (đúng ý "bấm lại để huỷ chọn"),
     * chưa có thì thêm vào CUỐI mảng (thứ tự mảng = thứ tự chọn, Giang chốt mục 5 "đánh số theo thứ
     * tự"). */
    _togglePickerKey(key) {
        const idx = this._pickerSelectedKeys.indexOf(key);
        if (idx >= 0) this._pickerSelectedKeys.splice(idx, 1); else this._pickerSelectedKeys.push(key);
    },

    /** `Map<key, order>` từ `_pickerSelectedKeys` — truyền vào `setBadgeMode()` để vẽ LẠI số thứ tự
     * của MỌI tile đang chọn (không chỉ tile vừa bấm — bỏ chọn 1 item ở giữa làm lệch số các item
     * sau nó, phải vẽ lại đồng loạt mới đúng, xem docstring `setBadgeMode()`). */
    _pickerKeyOrderMap() {
        const map = new Map();
        this._pickerSelectedKeys.forEach((k, i) => map.set(k, i + 1));
        return map;
    },

    /** Video — mở picker multi-select (thay `openSingleVideoPicker()` cũ). */
    async openPickVideo() {
        this._pickerSelectedKeys = [];
        this._pickerCleanup = openMediaPickerDrawerUi(
            'visualBg', 'visualBg.videoPicker', t('fileManager.video.pickerTitle'),
            this._buildMultiPickerBodyHtml('file-manager-video-picker-scroll', 'file-manager-video-picker-empty', t('fileManager.video.empty')),
            '.video-tile', 'videoKey', true, true, // showConfirmButton=true, updateInPlace=true
        ); // core/media-picker-drawer-helper.js

        const videos = await listVideos(); // core/file-manager/video.js
        if (!this._pickerCleanup) return; // guard: đóng picker rất nhanh trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: 'multiSelect', selectedKeys: new Map() }); // event/workflow/video-gallery-window.js
    },

    /** Ứng 'visualBg.videoPicker.tile.click' — toggle chọn (KHÔNG commit/đóng ngay như "chọn 1" cũ). */
    toggleVideoPickerTile(videoKey) {
        this._togglePickerKey(videoKey);
        workflowVideoGalleryWindow.setBadgeMode('genericDrawer', 'multiSelect', this._pickerKeyOrderMap());
        this._syncPickerConfirmButton();
    },

    /** Ứng 'visualBg.videoPicker.confirm.click' — commit toàn bộ `_pickerSelectedKeys`. */
    async confirmVideoPickerSelection() {
        if (this._pickerSelectedKeys.length === 0) return; // guard — nút đã disabled, phòng thủ kép
        const keys = this._pickerSelectedKeys.slice();
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
        await this._commitPickedKeys('video', keys);
    },

    cancelVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },

    /** Ảnh — mở picker multi-select RIÊNG (thay `openSingleImagePicker()` cũ, TRƯỚC ĐÂY tái dùng
     * `workflowFileManagerPhoto.openCoverImagePicker()` — picker ĐÓ vẫn single-select, dùng CHUNG
     * bởi bìa bài hát/Theme Background, KHÔNG được đụng — Visual Background giờ có picker riêng,
     * cùng khuôn `openPickVideo()` ngay trên). */
    async openPickPhoto() {
        this._pickerSelectedKeys = [];
        this._pickerCleanup = openMediaPickerDrawerUi(
            'visualBg', 'visualBg.photoPicker', t('visualBgSettingsDrawer.pickPhoto.label'),
            this._buildMultiPickerBodyHtml('visual-bg-photo-picker-scroll', 'visual-bg-photo-picker-empty', t('fileManager.photo.image.empty')),
            '[data-image-key]', 'imageKey', true, true, // showConfirmButton=true, updateInPlace=true
        ); // core/media-picker-drawer-helper.js

        const images = await listImages(); // core/file-manager/image.js
        if (!this._pickerCleanup) return; // guard: đóng picker rất nhanh trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#visual-bg-photo-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#visual-bg-photo-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        workflowPhotoGalleryWindow.mount('genericDrawer', { scrollEl, images, rowHeightPx: this._photoPickerRowHeightPx, badgeMode: 'multiSelect', selectedKeys: new Map() }); // event/workflow/photo-gallery-window.js
    },

    /** Ứng 'visualBg.photoPicker.tile.click' — cùng khuôn `toggleVideoPickerTile()`. */
    togglePhotoPickerTile(imageKey) {
        this._togglePickerKey(imageKey);
        workflowPhotoGalleryWindow.setBadgeMode('genericDrawer', 'multiSelect', this._pickerKeyOrderMap());
        this._syncPickerConfirmButton();
    },

    /** Ứng 'visualBg.photoPicker.confirm.click'. */
    async confirmPhotoPickerSelection() {
        if (this._pickerSelectedKeys.length === 0) return; // guard — nút đã disabled, phòng thủ kép
        const keys = this._pickerSelectedKeys.slice();
        workflowPhotoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
        await this._commitPickedKeys('photo', keys);
    },

    cancelPhotoPicker() {
        workflowPhotoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },

    /** Commit chung cho picker Video/Ảnh — đổi `type` NẾU khác (gỡ hẳn source/pending cũ, cùng lý
     * do `changeType()` cũ), rồi giao `_resolveAndCommitSource('multi', ...)` xử lý tiếp (pending/
     * áp ngay, persist, refreshPanelUI, applyCurrentVisualBg — ĐÃ có sẵn), rồi hiện modal kết quả
     * qua `_showCommitResultModal()` — MỚI (29/08/2026, Giang chốt "so sánh thay đổi phải nhất quán
     * mọi nơi, không riêng Làm tươi") — trước đó bấm chọn lại y hệt list cũ thì im lặng, không rõ có
     * nhận hay không.
     * @param {'video'|'photo'} type
     * @param {string[]} keys - thứ tự CHỌN, giữ nguyên khi lưu (xem `_readOriginKeys()`).
     */
    async _commitPickedKeys(type, keys) {
        if (keys.length === 0) return;
        appConfigVisualBg.mutateAll((c) => {
            if (c.type !== type) { c.type = type; c.source = { originKind: null, originId: null, list: [], videoAudio: {} }; c.pending = { originKind: null, originId: null, list: [] }; }
        });
        const result = await this._resolveAndCommitSource('multi', this._encodeMultiOriginId(keys));
        await this._showCommitResultModal(result);
    },

    /** Thư mục — multi-select GỘP nhiều folder (originKind='groupMulti'), dropdown Video/Ảnh ngay
     * trong header picker (đổi loại đang duyệt, tự re-fetch danh sách folder + re-render tại chỗ,
     * KHÔNG đóng/mở lại picker). Mặc định mở đúng `cfg.type` hiện tại (photo/video), rơi về 'video'
     * nếu chưa từng chọn gì. */
    async openPickFolder() {
        const currentType = appConfigVisualBg.getAll().type;
        await this._openFolderPickerForType(VISUAL_BG_TYPES.includes(currentType) ? currentType : 'video');
    },

    /** Đọc danh sách folder ĐÚNG `type`, lọc bỏ folder RỖNG (0 item — không đóng góp gì khi gộp,
     * KHÁC ngưỡng `VISUAL_BG_MIN_LIST_ITEMS` cũ của "group" đơn: nhiều folder giờ GỘP lại với nhau
     * nên 1 folder có ít item vẫn có ích, không cần tự nó đủ ≥2), rồi mở/vẽ lại picker Thư mục dùng
     * chung với Playlist (`workflowPlaylist._openFolderPickerDrawer()`, phần mở rộng multi-select +
     * typeOptions/onTypeChange — xem docstring hàm đó).
     * @param {'photo'|'video'} type
     * @param {boolean} [isUpdate] - true khi gọi LẠI từ `onTypeChange` (picker ĐANG mở, chỉ đổi
     *        loại) -> vẽ lại TẠI CHỖ (`updateGenericDrawer()`); bỏ trống = mở MỚI (lần đầu, từ
     *        `openPickFolder()`) -> `openGenericDrawer()`. THIẾU tham số này ở lần viết đầu
     *        (29/08/2026) khiến đổi dropdown lại mở Drawer từ đầu (giật/trượt lại) thay vì cập nhật
     *        mượt — sửa cùng ngày, xem `_openFolderPickerDrawer()` (event/workflow/playlist.js).
     */
    async _openFolderPickerForType(type, isUpdate) {
        const folders = await listFolders(type); // core/file-manager/folder.js
        const counts = await Promise.all(folders.map(async (f) => {
            const map = await getFolderSongMap(f.id); // service/db.js
            return map ? getFolderSongKeys(map).length : 0; // core/file-manager/folder.js
        }));
        const eligible = folders.filter((_, i) => counts[i] > 0);

        await workflowPlaylist._openFolderPickerDrawer(
            (folderIds, pickedType) => this._commitFolderMultiSelection(folderIds, pickedType),
            {
                folders: eligible,
                showAddTile: false,
                emptyMsg: eligible.length === 0
                    ? t(type === 'video' ? 'visualBgSettingsDrawer.folderPicker.emptyNoFolder.video' : 'visualBgSettingsDrawer.folderPicker.emptyNoFolder.photo')
                    : '',
                // SỬA (phản hồi Giang — sửa lỗ hổng "Cancel picker thư mục không tự quay lại") —
                // dù bấm X hay vừa Chọn xong, luôn tự mở lại Visual Background (thay vì đóng trắng
                // cả Setting) — xem docstring _openFolderPickerDrawer() (event/workflow/playlist.js).
                onClose: () => workflowAppSettings._renderVisualBg(),
                multiSelect: true,
                typeOptions: { current: type },
                // MỚI (29/08/2026) — dropdown đổi loại (header picker) gọi LẠI CHÍNH hàm này với
                // type mới, `isUpdate=true` — tự re-fetch + lọc lại + vẽ lại TẠI CHỖ, không đóng/mở
                // picker (xem docstring tham số `isUpdate` ở trên).
                onTypeChange: (newType) => this._openFolderPickerForType(newType, true),
            },
            isUpdate,
        );
    },

    /** Commit picker Thư mục — gộp `folderIds` (đã theo ĐÚNG thứ tự chọn) thành 1 nguồn
     * 'groupMulti'. Cùng lý do đổi `type` như `_commitPickedKeys()`, cùng modal kết quả qua
     * `_showCommitResultModal()`.
     * @param {string[]} folderIds
     * @param {'photo'|'video'} type
     */
    async _commitFolderMultiSelection(folderIds, type) {
        if (!folderIds || folderIds.length === 0) return;
        appConfigVisualBg.mutateAll((c) => {
            if (c.type !== type) { c.type = type; c.source = { originKind: null, originId: null, list: [], videoAudio: {} }; c.pending = { originKind: null, originId: null, list: [] }; }
        });
        const result = await this._resolveAndCommitSource('groupMulti', this._encodeMultiOriginId(folderIds));
        await this._showCommitResultModal(result);
    },
};
