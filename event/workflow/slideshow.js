/**
 * event/workflow/slideshow.js — Engine render ảnh (transition/Ken Burns) cho Visual Background khi
 * `type='photo'` + `source.list` > 1 item. KHÔNG còn tự chọn nguồn (album) — nhận thẳng danh sách
 * key đã dựng sẵn từ `workflowVisualBg.startFromList()`, đọc/ghi `source.list` qua các method public
 * của domain đó — `persistSourceListMutation()`/`selfHealEmptySource()` (Rule ownership: field vẫn
 * thuộc domain `visualBg`, file này chỉ BÁO thay đổi), CỘNG `firstIndex()`/`advanceList()` (SỬA
 * 08/08/2026 — bước index giờ tính CHUNG bên `workflowVisualBg`, file này không tự gọi
 * `pickNextSlideshowIndexRandom/Sequential`/`advanceVisualBgList` nữa, xem comment 2 hàm đó).
 *
 * XOÁ (29/08/2026, phản hồi Giang — Motion tách hệ preset độc lập) — cụm "Settings Drawer" +
 * router "slideshowSettings" (2 file event/router,listener/slideshow.js) bỏ hẳn — panel sửa cấu
 * hình Transition/Ken Burns giờ thuộc `workflowMotionPresets` (System > Motion), file NÀY chỉ
 * còn ĐÚNG 1 vai trò: engine cycle ảnh thật (`_tick()`, taskManager, ngoài eventBus — cùng khuôn
 * core/auto-switch-visual.js), đọc field cấu hình qua `_currentPreset()` (preset ĐANG GẮN cho Photo
 * VBG, `appConfigVisualBg.motionPresetId` — KHÔNG còn `appConfigVisualBg.getAll().slideshow`
 * nhúng thẳng nữa).
 *
 * NẠP SAU: core/file-manager/slideshow.js, core/motion-presets.js (findMotionPresetById),
 * core/visual-bg.js (markVisualBgListItemMissing), core/file-manager/image.js, service/db.js,
 * core/dom-refs.js (slideshowContainer/slideshowLayer1,2/slideshowLayer1,2Pan), service/task-
 * manager.js, event/workflow/visual-bg.js (workflowVisualBg).
 */

/** Preset "tắt hết" — dùng khi `motionPresetId` là null (chưa gắn) HOẶC trỏ tới preset không còn
 * tồn tại (bị xoá ở nơi khác giữa chừng) — Giang chốt "2 công tắc cùng false thì không chạy hiệu ứng
 * gì cả", KHÔNG fallback về bất kỳ hiệu ứng mặc định nào. */
const SLIDESHOW_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', kenBurnsEnabled: false, kenBurnsMode: 'zoomPanRandom' };

const SLIDESHOW_TASK = 'slideshowTimer';
// MỚI (29/08/2026, "React Beat Audio") — task RAF RIÊNG, per-frame, CHỈ chạy khi preset đang gắn có
// `reactBeatAudio.enabled` + ít nhất 1 hiệu ứng con bật (xem `_syncBeatReactLoop()`) — TÁCH khỏi
// SLIDESHOW_TASK (task đó chỉ bắn 1 lần MỖI ảnh, không đủ tần suất theo dõi beat liên tục).
const SLIDESHOW_BEATREACT_TASK = 'slideshowBeatReactTick';
const SLIDESHOW_BEATREACT_PULSE_MS = 500; // thời lượng 1 lượt pulse "bắn rồi trở về" — CỐ ĐỊNH, không phụ thuộc BPM (đơn giản, dễ đoán — không cần ước lượng ms/beat từ beatTimes)

const workflowSlideshow = {
    // Bookkeeping riêng của engine — mirror `visualBgConfig.source.list` (KHÔNG phải nguồn sự thật,
    // chỉ bản làm việc; ghi lại qua workflowVisualBg khi sweep/mark null).
    _sourceKeys: [],        // có thể lẫn null (đã xoá, chờ dọn)
    _sourceIndex: -1,       // vị trí "current" trong _sourceKeys
    _currentObjectUrl: null,
    _currentRecord: null,   // MỚI (14/08/2026) — record ảnh ĐANG hiện, giữ lại để _activate() dùng tính bounds Ken Burns mà không phải đọc DB lại
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2
    // SỬA (14/08/2026, Giang báo "on background visual photo -> phải phát mới on ảnh, tạo khoảng
    // hở giữa color/gradient với ảnh") — TÁCH `_isRevealed` (container + ảnh ĐẦU đã hiện, ngay lập
    // tức, KHÔNG chờ Song — né khoảng hở) ra khỏi `_isActive` (Ken Burns đang pan + hẹn giờ tự
    // chuyển ảnh đang chạy — CHỈ bật khi Song thật sự phát, giữ nguyên tinh thần gốc "không animate/
    // tick khi đang im lặng"). Trước đây 2 khái niệm gộp làm 1 (`_isRevealed`), khiến ảnh bị ẩn hẳn
    // (chỉ còn color/gradient) tới tận lúc Song phát mới "bật" đột ngột.
    _isRevealed: false,     // container + ảnh ĐẦU đã hiện tĩnh (luôn true ngay sau startFromList() nếu có nguồn hợp lệ)
    _isActive: false,       // Ken Burns/timer đang chạy — chỉ true khi Song đang thật sự phát
    _lastKenBurnsDirection: null,
    // MỚI (29/08/2026, "React Beat Audio") — 3 hiệu ứng ĐỘC LẬP, mỗi cái tự nhớ `beatCount` lúc
    // lần cuối BẮN (so lệch >= everyNBeats mới bắn tiếp) + mốc thời gian VỪA bắn (null = đang nghỉ ở
    // baseline, không có pulse nào đang chạy) — xem `_tickBeatReact()`.
    _beatReactActive: false, // task RAF đang chạy hay không (tránh addNew() trùng tên nhiều lần)
    _beatReactLastSeenBeatCount: { zoom: 0, pan: 0, rotate: 0 },
    _beatReactTriggeredAtMs: { zoom: null, pan: null, rotate: null },

    _currentLayer() { return this._layerToggle ? slideshowLayer2 : slideshowLayer1; },
    _idleLayer() { return this._layerToggle ? slideshowLayer1 : slideshowLayer2; },
    _currentPanLayer() { return this._layerToggle ? slideshowLayer2Pan : slideshowLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? slideshowLayer1Pan : slideshowLayer2Pan; },

    _kenBurnsAnim1: null,
    _kenBurnsAnim2: null,
    _getKenBurnsAnim(panEl) { return panEl === slideshowLayer1Pan ? this._kenBurnsAnim1 : this._kenBurnsAnim2; },
    _setKenBurnsAnim(panEl, anim) {
        if (panEl === slideshowLayer1Pan) this._kenBurnsAnim1 = anim; else this._kenBurnsAnim2 = anim;
    },

    /** MỚI (29/08/2026, phản hồi Giang — Motion tách hệ preset độc lập) — đọc preset ĐANG GẮN
     * cho Photo VBG (`appConfigVisualBg.motionPresetId` -> tra `appState.motionPresets`, xem
     * core/motion-presets.js). Chưa gắn/preset không còn tồn tại -> `SLIDESHOW_NO_OP_PRESET`
     * (xem docstring hằng số đó) — KHÔNG throw, KHÔNG tự chọn preset khác thay thế. */
    _currentPreset() {
        const presetId = appConfigVisualBg.getAll().motionPresetId; // liên tuyến domain
        const preset = presetId ? findMotionPresetById(appState.get('motionPresets'), presetId) : null; // core/motion-presets.js
        return preset || SLIDESHOW_NO_OP_PRESET;
    },

    /** MỞ RỘNG (29/08/2026, phản hồi Giang — dời "Seconds per photo" sang panel VBG, dùng chung
     * video/ảnh, đổi tên khỏi "interval" theo đúng yêu cầu) — 2 nhánh theo `durationMode`
     * (`appConfigVisualBg`, top-level, xem docstring core/config.js):
     *   'fixtime'  — DÙNG CHUNG 1 số `durationSeconds` cho MỌI ảnh (bỏ qua field `duration` riêng
     *               của từng ảnh).
     *   'duration' (mặc định) — ảnh CŨNG có "duration" RIÊNG (record.duration, giây, số thực —
     *               Photo đã tích hợp như Song/Video, xem core/file-manager/image.js) — dùng ĐÚNG
     *               ảnh ĐANG hiện (`_currentRecord` đã cache sẵn, không đọc lại DB), fallback 5s cho
     *               record cũ thiếu field (CÙNG fallback event/workflow/photo-player.js:151).
     * Đổi TÊN (KHÔNG còn "interval" — field/hàm này giờ có thể trả giá trị KHÁC NHAU mỗi ảnh, không
     * còn là 1 "khoảng lặp cố định" nữa). */
    _computeAdvanceMs() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.durationMode === 'fixtime') return Math.max(5, cfg.durationSeconds) * 1000;
        const durationSec = (this._currentRecord && this._currentRecord.duration) || 5;
        return Math.max(1000, durationSec * 1000); // sàn 1s — phòng record.duration hỏng/âm
    },

    /** Ứng với bài hát đổi thật — gọi TRỰC TIẾP từ router ('visualBg.songChanged', event/router/
     * visual-bg.js) khi `type==='photo'`, KHÔNG còn qua `workflowVisualBg.advanceForSongChange()`
     * nữa (2 nhánh type khác nhau hoàn toàn, router tự phân theo `type`).
     * SỬA (09/08/2026, cơ chế pending, phản hồi Giang) — check `_checkAndApplyPendingSource()`
     * (liên tuyến domain, nguồn sự thật `pending` thuộc `workflowVisualBg`) TRƯỚC CẢ guard
     * `_isRevealed` — đây là điểm "lượt kế tiếp" DUY NHẤT còn lại cho ca `source.list.length<=1`
     * (ảnh tĩnh, không qua engine này — `workflowVisualBg._applyPhoto()` tự áp thẳng,
     * `_isRevealed` không bao giờ `true`), nên KHÔNG được gộp chung điều kiện `_isRevealed`/
     * `perSong` phía dưới — cùng nguyên tắc đã áp cho `workflowVisualBg.advanceForSongChange()`.
     * SỬA (14/08/2026, tách `_isRevealed`/`_isActive`) — guard đổi từ `!_isRevealed` sang
     * `!_isActive`: `_isRevealed` giờ true NGAY LẬP TỨC (ảnh tĩnh hiện ngay, xem `startFromList()`)
     * kể cả trước khi Song từng phát lần nào — advance() ở đây (đổi SANG ảnh kế) chỉ có ý nghĩa khi
     * engine đã thật sự ĐANG CHẠY (`_isActive`), giữ đúng nguyên bản chất "guard chưa thật sự chạy". */
    async advanceForSongChange() {
        if (typeof workflowVisualBg !== 'undefined' && await workflowVisualBg._checkAndApplyPendingSource()) return;
        if (!this._isActive) return; // guard: chưa thật sự ĐANG CHẠY (Ken Burns/timer) — lượt đầu do _activate() lo
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') return;
        this._tick();
    },

    // ===================== Nhận nguồn từ workflowVisualBg =====================

    /** Nhận `source.list` đã dựng sẵn (CHỈ gọi khi length > 1 — length<=1 workflowVisualBg tự áp
     * tĩnh, không qua engine này) + `nextOrder` để chọn item đầu.
     * SỬA (14/08/2026, Giang báo "phải phát mới on ảnh -> khoảng hở color/gradient") — TRƯỚC ĐÂY
     * chỉ `_reveal()` (hiện ảnh) khi `_shouldBeRunning()` — nếu Song CHƯA phát lúc chọn nguồn, ảnh
     * bị ẩn hẳn tới tận lúc Song phát mới hiện, tạo khoảng hở rõ rệt giữa màn color/gradient và ảnh
     * (CÙNG lớp bug UX mà nhánh Video đã né bằng cách hiện thumbnail tĩnh ngay — `showStaticBgThumb()`,
     * event/workflow/video-player.js). SỬA: LUÔN `_revealStatic()` ngay (hiện container + ảnh ĐẦU,
     * KHÔNG animate/tick) bất kể Song đang phát hay không — chỉ phần "ĐANG SỐNG" (Ken Burns pan +
     * hẹn giờ tự chuyển ảnh) mới còn gate theo `_shouldBeRunning()`, qua `_activate()`.
     * @param {Array<string|null>} list
     * @param {'random'|'sequential'|'playlist'} nextOrder
     */
    async startFromList(list, nextOrder) {
        this.stop();
        this._sourceKeys = list.slice();
        if (this._sourceKeys.filter((k) => k !== null).length === 0) {
            setSlideshowContainerVisible(slideshowContainer, false); // core
            return;
        }
        // Bước index (lượt đầu) DÙNG CHUNG với nhánh video — nguồn sự thật source.list thuộc domain
        // workflowVisualBg (liên tuyến domain, xem comment workflowVisualBg.firstIndex()).
        const { list: startList, index } = workflowVisualBg.firstIndex(this._sourceKeys, nextOrder === 'random'); // event/workflow/visual-bg.js
        if (startList !== this._sourceKeys) { // random bốc trúng vị trí cuối ngay lượt đầu -> đã xáo lại
            this._sourceKeys = startList;
            await workflowVisualBg.persistSourceListMutation(startList); // event/workflow/visual-bg.js
        }
        this._sourceIndex = index;
        this._layerToggle = false;
        await this._revealStatic(); // LUÔN hiện ảnh đầu ngay — né khoảng hở, xem docstring trên
        if (this._shouldBeRunning()) this._activate(); // Ken Burns/timer CHỈ bắt đầu khi Song đang thật sự phát
        // Chưa đủ điều kiện (nhạc chưa phát/đang pause) -> ảnh vẫn đứng yên hiện sẵn, chờ
        // syncPlaybackGate() gọi _activate() khi Song bắt đầu phát.
    },

    _shouldBeRunning() {
        return !audioPlayer.paused;
    },

    /** MỚI (14/08/2026, tách khỏi `_reveal()` cũ — xem docstring `startFromList()`) — hiện
     * container + ảnh ĐẦU TIÊN ngay lập tức, KHÔNG bật Ken Burns/hẹn giờ (phần đó thuộc
     * `_activate()`). Idempotent — no-op nếu đã revealed. */
    async _revealStatic() {
        if (this._isRevealed) return;
        this._isRevealed = true;
        setSlideshowContainerVisible(slideshowContainer, true); // core
        await this._showFirstImage();
    },

    /** MỚI (14/08/2026, tách khỏi `_reveal()` cũ) — bật phần "ĐANG SỐNG": Ken Burns pan cho ảnh
     * hiện tại (nếu bật, dùng `_currentRecord` đã có sẵn từ `_showFirstImage()` — không đọc lại
     * DB) + hẹn giờ tự chuyển ảnh kế (nếu KHÔNG phải perSong). CHỈ gọi khi Song đang thật sự phát
     * (`startFromList()`/`syncPlaybackGate()`). Idempotent — no-op nếu đã active. */
    _activate() {
        if (this._isActive) return;
        this._isActive = true;
        const preset = this._currentPreset(); // MỚI (29/08/2026) — thay `appConfigVisualBg.getAll().slideshow` đã xoá
        // SỬA (29/08/2026, "React Beat Audio") — `replaceMovement=true` -> KHÔNG chạy Ken Burns
        // thường nữa (layer react MỘT MÌNH điều khiển chuyển động, xem `_tickBeatReact()`); `false`
        // (hoặc cả cụm reactBeatAudio tắt hẳn) -> giữ NGUYÊN hành vi cũ.
        const skipNormalKenBurns = preset.reactBeatAudio.enabled && preset.reactBeatAudio.replaceMovement;
        if (preset.kenBurnsEnabled && this._currentRecord && !skipNormalKenBurns) this._activateKenBurns(this._currentPanLayer(), preset.kenBurnsMode, this._currentRecord);
        this._syncBeatReactLoop(); // MỚI (29/08/2026) — bật/tắt vòng lặp per-frame theo dõi beat nếu preset yêu cầu
        // SỬA (29/08/2026) — `taskManager.once()` (tự kill sau khi bắn, KHÔNG count:0 lặp vô hạn với
        // 1 `time` cố định như trước) — mode 'duration' giờ có thể ra giá trị KHÁC NHAU mỗi ảnh
        // (field `duration` riêng của từng ảnh, xem `_computeAdvanceMs()`), phải TÍNH LẠI mỗi vòng —
        // `_tick()` tự rearm lại chính task NÀY (CÙNG tên `SLIDESHOW_TASK`) ở cuối, nối tiếp vòng
        // đời — pause()/resume() không đổi gì (vẫn thao tác trên CÙNG tên task, xem service/task-
        // manager.js::once() — bên trong CŨNG chỉ là `addNew()` với count:1, không phải cơ chế khác).
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') {
            taskManager.once(() => this._tick(), this._computeAdvanceMs(), SLIDESHOW_TASK);
        }
    },

    /** Điểm đồng bộ trạng thái "chạy" — gọi từ audio play/pause (core/player-controls.js).
     * SỬA (14/08/2026, tách `_isRevealed`/`_isActive`) — nhánh đầu đổi từ "chưa revealed -> reveal"
     * sang "chưa active -> activate" (ảnh tĩnh đã hiện sẵn từ `startFromList()` rồi, giờ chỉ cần
     * bật Ken Burns/timer). 2 nhánh pause/resume ticking giữ NGUYÊN — vẫn thao tác trên Ken Burns
     * anim/task đã tồn tại từ lúc `_activate()`. */
    async syncPlaybackGate() {
        if (this._sourceKeys.length === 0) return; // không có gì đang chạy qua engine này
        const shouldRun = this._shouldBeRunning();
        if (shouldRun && !this._isActive) this._activate();
        else if (shouldRun && this._isActive) this._resumeTicking();
        else if (!shouldRun && this._isActive) this._pauseTicking();
    },

    _pauseTicking() {
        taskManager.pause(SLIDESHOW_TASK);
        // MỚI (29/08/2026, "React Beat Audio") — cùng lý do Ken Burns ngay dưới: đóng băng TẠI ĐÚNG
        // VỊ TRÍ đang pulse dở, không tiếp tục chạy trong lúc nhạc dừng.
        if (taskManager.plan[SLIDESHOW_BEATREACT_TASK]) taskManager.pause(SLIDESHOW_BEATREACT_TASK);
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    _resumeTicking() {
        if (taskManager.plan[SLIDESHOW_TASK]) taskManager.resume(SLIDESHOW_TASK);
        if (taskManager.plan[SLIDESHOW_BEATREACT_TASK]) taskManager.resume(SLIDESHOW_BEATREACT_TASK); // MỚI (29/08/2026)
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** Dừng hẳn engine — dọn task + layer + object URL + reset bookkeeping. */
    stop() {
        taskManager.kill(SLIDESHOW_TASK);
        // MỚI (29/08/2026, "React Beat Audio") — dọn hẳn task riêng + reset transform, cùng lý do
        // dọn SLIDESHOW_TASK ngay trên (Slideshow dừng hẳn thì không còn gì để mà theo dõi beat).
        taskManager.kill(SLIDESHOW_BEATREACT_TASK);
        this._beatReactActive = false;
        this._resetBeatReactTransform();
        setSlideshowContainerVisible(slideshowContainer, false); // core
        [[slideshowLayer1, slideshowLayer1Pan], [slideshowLayer2, slideshowLayer2Pan]].forEach(([layerEl, panEl]) => {
            setSlideshowLayerImage(panEl, ''); // core
            stopSlideshowKenBurnsAnimation(panEl, this._getKenBurnsAnim(panEl)); // core
            this._setKenBurnsAnim(panEl, null);
            resetSlideshowLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._sourceKeys = [];
        this._sourceIndex = -1;
        this._currentRecord = null; // MỚI (14/08/2026)
        this._isRevealed = false;
        this._isActive = false; // MỚI (14/08/2026)
        this._lastKenBurnsDirection = null;
    },

    /** Hiện ảnh ĐẦU TIÊN ngay (không transition) lúc reveal. Key null/record mất -> đánh dấu, để
     * trống, chờ tick/advance() sau (KHÔNG tự thử index kế — cùng quy tắc `_tick()`).
     * SỬA (14/08/2026) — KHÔNG còn tự `_activateKenBurns()` ở đây nữa (dời sang `_activate()`, chỉ
     * chạy khi Song thật sự phát) — hàm này giờ CHỈ lo hiện ảnh TĨNH, lưu lại `record` vào
     * `_currentRecord` để `_activate()` dùng sau mà không phải đọc DB lại. */
    async _showFirstImage() {
        const key = this._sourceKeys[this._sourceIndex];
        if (!key) return;
        const record = await getImageRecord(key); // service/db.js
        if (!record || !record.blob) {
            this._sourceKeys = markVisualBgListItemMissing(this._sourceKeys, this._sourceIndex); // core/visual-bg.js
            if (typeof workflowVisualBg !== 'undefined') await workflowVisualBg.persistSourceListMutation(this._sourceKeys);
            return;
        }
        const objectUrl = URL.createObjectURL(record.blob);
        this._currentObjectUrl = objectUrl;
        this._currentRecord = record; // MỚI (14/08/2026) — giữ lại cho _activate() dùng
        const layerEl = this._currentLayer();
        const panEl = this._currentPanLayer();
        setSlideshowLayerImage(panEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('ss-current');
        setSlideshowTransitionType(slideshowContainer, this._currentPreset().transitionType); // core — MỚI (29/08/2026), thay `appConfigVisualBg.getAll().slideshow` đã xoá
        // Ken Burns KHÔNG tự bật ở đây nữa — xem _activate().
    },

    _activateKenBurns(panEl, mode, image) {
        const direction = resolveSlideshowKenBurnsDirection(mode, this._lastKenBurnsDirection); // core
        this._lastKenBurnsDirection = direction;
        const bounds = computeSlideshowKenBurnsSafeBounds(image ? image.width : 0, image ? image.height : 0, window.innerWidth, window.innerHeight); // core
        const durationMs = capSlideshowKenBurnsDurationMs(this._computeAdvanceMs()); // core
        const keyframes = pickSlideshowKenBurnsKeyframes(direction, bounds, durationMs); // core
        const anim = startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs); // core
        this._setKenBurnsAnim(panEl, anim);
    },

    _currentReactLayer() { return this._layerToggle ? slideshowLayer2React : slideshowLayer1React; },
    _idleReactLayer() { return this._layerToggle ? slideshowLayer1React : slideshowLayer2React; },

    /** Bật/tắt vòng lặp per-frame theo dõi beat — MỚI (29/08/2026, "React Beat Audio"). Gọi ở MỌI
     * điểm preset đang gắn (hoặc field `reactBeatAudio` của nó) CÓ THỂ vừa đổi trạng thái cần chạy:
     * `_activate()` (bắt đầu cycle) và mỗi vòng `_tick()` (đổi ảnh — preset có thể đã bị gỡ/đổi từ
     * lúc tick trước, cùng quy ước "field mới áp dụng từ tick kế" đã dùng cho mọi field slideshow
     * khác). KHÔNG addNew() trùng tên nếu đã chạy sẵn (`_beatReactActive` guard).
     */
    _syncBeatReactLoop() {
        const rb = this._currentPreset().reactBeatAudio;
        const shouldRun = this._isActive && rb.enabled && (rb.zoom.enabled || rb.pan.enabled || rb.rotate.enabled);
        if (shouldRun && !this._beatReactActive) {
            this._beatReactActive = true;
            const beatCount = appState.get('beatCount');
            this._beatReactLastSeenBeatCount = { zoom: beatCount, pan: beatCount, rotate: beatCount }; // bắt đầu đếm từ NGAY BÂY GIỜ — không bắn dồn cho số beat đã trôi qua TRƯỚC lúc bật
            this._beatReactTriggeredAtMs = { zoom: null, pan: null, rotate: null };
            taskManager.addNew(SLIDESHOW_BEATREACT_TASK, { time: 0, exe: () => this._tickBeatReact(), mode: 'raf', count: 0 }); // service/task-manager.js
            taskManager.operator(SLIDESHOW_BEATREACT_TASK, 'enabled');
        } else if (!shouldRun && this._beatReactActive) {
            this._beatReactActive = false;
            taskManager.kill(SLIDESHOW_BEATREACT_TASK);
            this._resetBeatReactTransform(); // về identity — không để kẹt giữa chừng 1 pulse dở lúc tắt
        }
    },

    /** Xoá `transform` khỏi CẢ 2 layer react (identity, vô hình) — gọi lúc tắt hẳn beat-react VÀ lúc
     * `stop()` dọn toàn bộ Slideshow. */
    _resetBeatReactTransform() {
        if (slideshowLayer1React) slideshowLayer1React.style.transform = '';
        if (slideshowLayer2React) slideshowLayer2React.style.transform = '';
    },

    /** Tick per-frame (RAF) — kiểm tra beat MỚI cho TỪNG hiệu ứng ĐỘC LẬP (N khác nhau -> bắn lệch
     * nhịp nhau, KHÔNG đồng bộ), rồi nội suy giá trị HIỆN TẠI của cả 3 (đang nghỉ = 0, đang giữa 1
     * lượt pulse = nội suy theo thời gian đã trôi) và CỘNG DỒN thành 1 chuỗi `transform` áp đúng 1
     * LẦN vào layer react ĐANG "current" (layer kia đang ẩn/chờ swap ảnh kế, không ai nhìn thấy —
     * không cần animate). Lý do KHÔNG dùng Web Animations API cho pulse này, xem docstring
     * `evaluateSlideshowPulseStops()` (core/file-manager/slideshow.js). */
    _tickBeatReact() {
        const rb = this._currentPreset().reactBeatAudio;
        if (!rb.enabled) { this._syncBeatReactLoop(); return; } // preset vừa bị gỡ/tắt beat-react giữa chừng -> tự dừng vòng lặp ĐÚNG NGAY frame này, không đợi tick ảnh kế
        const beatCount = appState.get('beatCount'); // service/state/visualizer-runtime.js
        const now = performance.now();

        const checkTrigger = (key, effect) => {
            if (!effect.enabled) return;
            if (beatCount - this._beatReactLastSeenBeatCount[key] >= effect.everyNBeats) {
                this._beatReactLastSeenBeatCount[key] = beatCount;
                this._beatReactTriggeredAtMs[key] = now;
            }
        };
        checkTrigger('zoom', rb.zoom);
        checkTrigger('pan', rb.pan);
        checkTrigger('rotate', rb.rotate);

        const readProgress = (key) => {
            const triggeredAt = this._beatReactTriggeredAtMs[key];
            if (triggeredAt === null) return null; // chưa từng bắn/đã nghỉ hẳn -> baseline, không nội suy
            const elapsed = now - triggeredAt;
            if (elapsed >= SLIDESHOW_BEATREACT_PULSE_MS) { this._beatReactTriggeredAtMs[key] = null; return null; }
            return elapsed / SLIDESHOW_BEATREACT_PULSE_MS;
        };

        const zoomT = readProgress('zoom');
        const zoomScale = (rb.zoom.enabled && zoomT !== null) ? 1 + evaluateSlideshowPulseStops([0, (rb.zoom.amountPct - 100) / 100, 0], zoomT) : 1; // core
        const panT = readProgress('pan');
        const panPct = (rb.pan.enabled && panT !== null) ? evaluateSlideshowPulseStops(buildSlideshowPulseStops(rb.pan.direction, rb.pan.amountPct - 100), panT) : 0; // core
        const rotateT = readProgress('rotate');
        const rotateDeg = (rb.rotate.enabled && rotateT !== null) ? evaluateSlideshowPulseStops(buildSlideshowPulseStops(rb.rotate.direction, rb.rotate.amountDeg), rotateT) : 0; // core

        const reactLayer = this._currentReactLayer();
        if (reactLayer) reactLayer.style.transform = `scale(${zoomScale}) translateX(${panPct}%) rotate(${rotateDeg}deg)`;
    },

    /** 1 nhịp cycle: bước index qua `workflowVisualBg.advanceList()` (dọn null nếu vừa hết 1 vòng;
     * riêng random, xáo lại mảng nếu vừa chạm vị trí cuối — xem comment hàm đó), rồi đọc DB cho vị
     * trí đó. Null hoặc record mất -> đánh dấu/giữ nguyên ảnh cũ, KHÔNG tự thử tiếp — chờ tick/
     * advance() sau (Giang chốt). `_sourceKeys.length<=1` (đã sweep về còn 1, hoặc vốn dĩ chỉ 1) ->
     * dừng hẳn cycle, ảnh cuối cùng đứng yên. */
    async _tick() {
        // MỚI (09/08/2026, cơ chế pending, phản hồi Giang) — check TRƯỚC guard length<=1: nếu VỪA
        // áp pending, `applyCurrentVisualBg()` bên trong `_checkAndApplyPendingSource()` đã tự
        // `workflowSlideshow.stop()` (qua `clearMediaLayers()`) rồi dựng lại state MỚI từ đầu (hoặc
        // chuyển hẳn sang nhánh video/áp tĩnh nếu pending đổi type/list<=1) — KHÔNG được chạy tiếp
        // logic tick CŨ bên dưới (đọc `this._sourceKeys` lúc này đã lỗi thời/bị `stop()` reset).
        if (typeof workflowVisualBg !== 'undefined' && await workflowVisualBg._checkAndApplyPendingSource()) return;
        if (this._sourceKeys.length <= 1) { taskManager.kill(SLIDESHOW_TASK); return; }

        const isRandom = appConfigVisualBg.getAll().nextOrder === 'random';
        const { list, index } = workflowVisualBg.advanceList(this._sourceKeys, this._sourceIndex, isRandom); // event/workflow/visual-bg.js
        if (index === -1) { if (typeof workflowVisualBg !== 'undefined') await workflowVisualBg.selfHealEmptySource(); return; }
        if (list !== this._sourceKeys) {
            this._sourceKeys = list;
            if (typeof workflowVisualBg !== 'undefined') await workflowVisualBg.persistSourceListMutation(list);
        }
        this._sourceIndex = index;
        const key = this._sourceKeys[index];
        if (!key) return; // null -> giữ nguyên ảnh đang hiện, chờ tick sau

        const record = await getImageRecord(key); // service/db.js
        if (!record || !record.blob) {
            this._sourceKeys = markVisualBgListItemMissing(this._sourceKeys, index); // core/visual-bg.js
            if (typeof workflowVisualBg !== 'undefined') await workflowVisualBg.persistSourceListMutation(this._sourceKeys);
            return; // giữ nguyên ảnh đang hiện
        }

        const preset = this._currentPreset(); // MỚI (29/08/2026) — thay `appConfigVisualBg.getAll().slideshow` đã xoá
        const image = record;
        // SỬA (29/08/2026) — gán `_currentRecord = image` NGAY TẠI ĐÂY (trước là dưới cuối hàm) —
        // `_computeAdvanceMs()` (mode 'duration') đọc `this._currentRecord.duration`, và dòng
        // `totalMs` ngay dưới gọi hàm đó để KẸP trần transition-duration theo đúng thời gian ảnh SẮP
        // hiện (`image`, ảnh INCOMING) — gán TRỄ (như code cũ) khiến lúc đó `_currentRecord` vẫn
        // trỏ ảnh CŨ (outgoing), kẹp sai theo duration ảnh vừa rời đi thay vì ảnh sắp hiện.
        this._currentRecord = image;
        const objectUrl = URL.createObjectURL(image.blob);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();
        const outgoingReact = this._currentReactLayer(); // MỚI (29/08/2026, "React Beat Audio")

        setSlideshowLayerImage(incomingPan, objectUrl); // core — LUÔN cần (pan layer giữ ảnh thật), bất kể có chạy Transition hay không
        // SỬA (29/08/2026, "React Beat Audio") — `replaceMovement=true` -> KHÔNG chạy Ken Burns
        // thường nữa, cùng lý do/điều kiện `_activate()` ngay trên.
        const skipNormalKenBurns = preset.reactBeatAudio.enabled && preset.reactBeatAudio.replaceMovement;
        if (preset.kenBurnsEnabled && !skipNormalKenBurns) this._activateKenBurns(incomingPan, preset.kenBurnsMode, image);

        // MỚI (29/08/2026, Giang chốt "2 công tắc cùng false thì không chạy hiệu ứng gì cả") —
        // `transitionEnabled=false` -> CẮT CỨNG, đi THẲNG tới đúng trạng thái nghỉ mà 1 lượt
        // Transition bình thường sẽ kết thúc ở đó (xem finishSlideshowTransitionVisuals(), core/
        // file-manager/slideshow.js) — KHÔNG qua bước enter/exit trung gian nào, KHÔNG animation.
        if (preset.transitionEnabled) {
            setSlideshowTransitionType(slideshowContainer, preset.transitionType); // core
            const totalMs = capSlideshowTransitionDurationMs(preset.transitionDurationMs, this._computeAdvanceMs()); // core
            const { inMs, outMs } = transitionSupportsInOutRatio(preset.transitionType) // core
                ? computeSlideshowTransitionInOutMs(totalMs, preset.transitionInOutRatio) // core
                : { inMs: totalMs, outMs: totalMs };
            setSlideshowTransitionTiming(incomingLayer, inMs, preset.transitionEasing); // core
            setSlideshowTransitionTiming(outgoingLayer, outMs, preset.transitionEasing); // core

            startSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core
            const cleanupDelayMs = Math.max(inMs, outMs);
            taskManager.once(() => {
                setSlideshowLayerImage(outgoingPan, ''); // core
                stopSlideshowKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core
                this._setKenBurnsAnim(outgoingPan, null);
                finishSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core
            }, cleanupDelayMs, 'slideshowTransitionCleanup');

            if (this._currentObjectUrl) {
                const staleUrl = this._currentObjectUrl;
                taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, cleanupDelayMs + 100, 'slideshowRevokeStale');
            }
        } else {
            outgoingLayer.classList.remove('ss-current');
            incomingLayer.classList.add('ss-current');
            setSlideshowLayerImage(outgoingPan, ''); // core — dọn ảnh cũ khỏi pan layer NGAY (không có animation nào đang chạy chồng lên cần chờ)
            stopSlideshowKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core
            this._setKenBurnsAnim(outgoingPan, null);
            if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} } // dọn NGAY (không cần trễ 100ms như nhánh có Transition — không animation nào còn tham chiếu)
        }

        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;
        // MỚI (29/08/2026, "React Beat Audio") — layer VỪA thành "outgoing" (idle) reset transform
        // về identity NGAY — tránh giữ lại giá trị pulse dở dang từ lượt trước, lộ ra SAI lúc layer
        // này được tái sử dụng làm "current" ở 1-2 vòng cycle sau. Đồng bộ lại vòng lặp beat-react
        // theo preset MỚI (có thể đã đổi/gỡ từ lúc tick trước — cùng quy ước "áp dụng từ tick kế"
        // đã dùng cho mọi field slideshow khác).
        if (outgoingReact) outgoingReact.style.transform = '';
        this._syncBeatReactLoop();

        // SỬA (29/08/2026) — thay dòng `if (length===1) kill` cũ bằng rearm/kill tường minh: còn >1
        // item sống -> tự đặt lại `taskManager.once()` cho vòng KẾ (tính LẠI `_computeAdvanceMs()`
        // NGAY BÂY GIỜ — sau khi `_currentRecord` đã là ảnh MỚI ở trên — mode 'duration' cần giá trị
        // ĐÚNG ảnh này, không phải ảnh cũ); length===1 (sweep vừa đưa về 1) -> dừng hẳn cycle, giữ
        // NGUYÊN điều kiện gốc (raw `.length`, KHÔNG đổi ngữ nghĩa so với bản cũ).
        if (this._sourceKeys.length === 1) {
            taskManager.kill(SLIDESHOW_TASK); // sweep vừa đưa về 1 -> dừng cycle
        } else {
            taskManager.once(() => this._tick(), this._computeAdvanceMs(), SLIDESHOW_TASK);
        }
    },

};
