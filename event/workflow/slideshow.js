/**
 * event/workflow/slideshow.js — Engine render ảnh (transition/Ken Burns) cho Visual Background khi
 * `type='photo'` + `source.list` > 1 item. KHÔNG còn tự chọn nguồn (album) — nhận thẳng danh sách
 * key đã dựng sẵn từ `workflowVisualBg.startFromList()`, đọc/ghi `source.list` qua các method public
 * của domain đó — `persistSourceListMutation()`/`selfHealEmptySource()` (Rule ownership: field vẫn
 * thuộc domain `visualBg`, file này chỉ BÁO thay đổi), CỘNG `firstIndex()`/`advanceList()` (SỬA
 * 08/08/2026 — bước index giờ tính CHUNG bên `workflowVisualBg`, file này không tự gọi
 * `pickNextSlideshowIndexRandom/Sequential`/`advanceVisualBgList` nữa, xem comment 2 hàm đó).
 *
 * 2 vai trò: (1) Workflow bình thường cho router "slideshowSettings" (panel "Tuỳ chỉnh Trình
 * chiếu"); (2) "Router" cho task lặp tự sinh (`_tick()`, taskManager, ngoài eventBus — cùng khuôn
 * core/auto-switch-visual.js).
 *
 * NẠP SAU: core/file-manager/slideshow.js, core/visual-bg.js (markVisualBgListItemMissing),
 * core/file-manager/image.js, service/db.js, core/dom-refs.js (slideshowContainer/
 * slideshowLayer1,2/slideshowLayer1,2Pan), core/settings-panel-stack.js, service/task-manager.js,
 * event/workflow/visual-bg.js (workflowVisualBg).
 * NẠP TRƯỚC: event/router/slideshow.js.
 */
let slideshowSettingsPanelEl = null;

const SLIDESHOW_TASK = 'slideshowTimer';

const workflowSlideshow = {
    // Bookkeeping riêng của engine — mirror `visualBgConfig.source.list` (KHÔNG phải nguồn sự thật,
    // chỉ bản làm việc; ghi lại qua workflowVisualBg khi sweep/mark null).
    _sourceKeys: [],        // có thể lẫn null (đã xoá, chờ dọn)
    _sourceIndex: -1,       // vị trí "current" trong _sourceKeys
    _currentObjectUrl: null,
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2
    _isRevealed: false,     // đã start() xong (_sourceKeys sẵn sàng) nhưng CHỈ thật sự hiện khi nhạc phát
    _lastKenBurnsDirection: null,

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

    _computeIntervalMs() {
        return Math.max(5, appConfigVisualBg.getAll().slideshow.intervalSeconds) * 1000;
    },

    /** Ứng với bài hát đổi thật, `listPlaybackMode='perSong'` — gọi chéo domain từ
     * `workflowVisualBg.advanceForSongChange()` (điểm phân phối theo `type`, event/router/visual-bg.js). */
    advanceForSongChange() {
        if (!this._isRevealed) return; // guard: chưa thật sự chiếu (lượt đầu do _reveal() lo)
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') return;
        this._tick();
    },

    // ===================== Nhận nguồn từ workflowVisualBg =====================

    /** Nhận `source.list` đã dựng sẵn (CHỈ gọi khi length > 1 — length<=1 workflowVisualBg tự áp
     * tĩnh, không qua engine này) + `nextOrder` để chọn item đầu.
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
        if (this._shouldBeRunning()) await this._reveal();
        // Chưa đủ điều kiện (nhạc chưa phát/đang pause) -> để yên, chờ syncPlaybackGate().
    },

    _shouldBeRunning() {
        return !audioPlayer.paused;
    },

    async _reveal() {
        if (this._isRevealed) return;
        this._isRevealed = true;
        setSlideshowContainerVisible(slideshowContainer, true); // core
        await this._showFirstImage();
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') {
            taskManager.kill(SLIDESHOW_TASK);
            taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
            taskManager.operator(SLIDESHOW_TASK, 'enabled');
        }
    },

    /** Điểm đồng bộ trạng thái "chạy" — gọi từ audio play/pause (core/player-controls.js). */
    async syncPlaybackGate() {
        if (this._sourceKeys.length === 0) return; // không có gì đang chạy qua engine này
        const shouldRun = this._shouldBeRunning();
        if (shouldRun && !this._isRevealed) await this._reveal();
        else if (shouldRun && this._isRevealed) this._resumeTicking();
        else if (!shouldRun && this._isRevealed) this._pauseTicking();
    },

    _pauseTicking() {
        taskManager.pause(SLIDESHOW_TASK);
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    _resumeTicking() {
        if (taskManager.plan[SLIDESHOW_TASK]) taskManager.resume(SLIDESHOW_TASK);
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** Dừng hẳn engine — dọn task + layer + object URL + reset bookkeeping. */
    stop() {
        taskManager.kill(SLIDESHOW_TASK);
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
        this._isRevealed = false;
        this._lastKenBurnsDirection = null;
    },

    /** Hiện ảnh ĐẦU TIÊN ngay (không transition) lúc reveal. Key null/record mất -> đánh dấu, để
     * trống, chờ tick/advance() sau (KHÔNG tự thử index kế — cùng quy tắc `_tick()`). */
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
        const layerEl = this._currentLayer();
        const panEl = this._currentPanLayer();
        setSlideshowLayerImage(panEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('ss-current');
        const cfg = appConfigVisualBg.getAll().slideshow;
        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        if (cfg.kenBurnsEnabled) this._activateKenBurns(panEl, cfg.kenBurnsMode, record);
    },

    _activateKenBurns(panEl, mode, image) {
        const direction = resolveSlideshowKenBurnsDirection(mode, this._lastKenBurnsDirection); // core
        this._lastKenBurnsDirection = direction;
        const bounds = computeSlideshowKenBurnsSafeBounds(image ? image.width : 0, image ? image.height : 0, window.innerWidth, window.innerHeight); // core
        const durationMs = capSlideshowKenBurnsDurationMs(this._computeIntervalMs()); // core
        const keyframes = pickSlideshowKenBurnsKeyframes(direction, bounds, durationMs); // core
        const anim = startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs); // core
        this._setKenBurnsAnim(panEl, anim);
    },

    /** 1 nhịp cycle: bước index qua `workflowVisualBg.advanceList()` (dọn null nếu vừa hết 1 vòng;
     * riêng random, xáo lại mảng nếu vừa chạm vị trí cuối — xem comment hàm đó), rồi đọc DB cho vị
     * trí đó. Null hoặc record mất -> đánh dấu/giữ nguyên ảnh cũ, KHÔNG tự thử tiếp — chờ tick/
     * advance() sau (Giang chốt). `_sourceKeys.length<=1` (đã sweep về còn 1, hoặc vốn dĩ chỉ 1) ->
     * dừng hẳn cycle, ảnh cuối cùng đứng yên. */
    async _tick() {
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

        const cfg = appConfigVisualBg.getAll().slideshow;
        const image = record;
        const objectUrl = URL.createObjectURL(image.blob);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        setSlideshowLayerImage(incomingPan, objectUrl); // core
        if (cfg.kenBurnsEnabled) this._activateKenBurns(incomingPan, cfg.kenBurnsMode, image);

        const totalMs = capSlideshowTransitionDurationMs(cfg.transitionDurationMs, this._computeIntervalMs()); // core
        const { inMs, outMs } = transitionSupportsInOutRatio(cfg.transitionType) // core
            ? computeSlideshowTransitionInOutMs(totalMs, cfg.transitionInOutRatio) // core
            : { inMs: totalMs, outMs: totalMs };
        setSlideshowTransitionTiming(incomingLayer, inMs, cfg.transitionEasing); // core
        setSlideshowTransitionTiming(outgoingLayer, outMs, cfg.transitionEasing); // core

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
        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;

        if (this._sourceKeys.length === 1) taskManager.kill(SLIDESHOW_TASK); // sweep vừa đưa về 1 -> dừng cycle

    },

    // ===================== Settings Drawer (cụm router "slideshowSettings") =====================

    async openPanel() {
        slideshowSettingsPanelEl = pushSettingsPanel({ title: t('slideshowSettingsDrawer.title'), bodyHtml: renderSlideshowPanelBody() });
        await this.refreshDrawerUI();
    },

    async refreshDrawerUI() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;

        const intervalBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
        const transitionSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition');
        const kenBurnsToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns');
        const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
        const kenBurnsModeSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns-mode');
        const transitionDurationBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
        const transitionRatioRow = slideshowSettingsPanelEl.querySelector('#slideshow-transition-ratio-row');
        const transitionRatioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
        const transitionEasingSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-easing');

        if (intervalBtn) intervalBtn.textContent = `${cfg.intervalSeconds}s`;
        if (transitionSelect) transitionSelect.value = cfg.transitionType;
        if (kenBurnsToggle) kenBurnsToggle.checked = !!cfg.kenBurnsEnabled;
        if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !cfg.kenBurnsEnabled);
        if (kenBurnsModeSelect) kenBurnsModeSelect.value = cfg.kenBurnsMode;
        if (transitionDurationBtn) transitionDurationBtn.textContent = `${(cfg.transitionDurationMs / 1000).toFixed(1)}s`;
        if (transitionRatioRow) transitionRatioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(cfg.transitionType)); // core
        if (transitionRatioSlider) transitionRatioSlider.value = cfg.transitionInOutRatio;
        this._updateTransitionRatioLabel(slideshowSettingsPanelEl, cfg.transitionInOutRatio);
        if (transitionEasingSelect) transitionEasingSelect.value = cfg.transitionEasing;
    },

    openIntervalPicker() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.interval.pickerTitle'),
            format: 's',
            valueMs: cfg.intervalSeconds * 1000,
            minMs: 5000,
            maxMs: 60000,
            onConfirm: async (resultMs) => {
                const v = Math.max(5, Math.round(resultMs / 1000));
                const newIntervalMs = v * 1000;
                let correctedTransitionMs = null; // MỚI — null = không cần sửa gì, có giá trị = ĐÃ bị kẹp xuống
                await workflowVisualBg.mutateSlideshowSetting((ss) => {
                    ss.intervalSeconds = v;
                    const cappedMs = capSlideshowTransitionDurationMs(ss.transitionDurationMs, newIntervalMs); // core — tái dùng NGUYÊN hàm đã có
                    if (cappedMs !== ss.transitionDurationMs) { ss.transitionDurationMs = cappedMs; correctedTransitionMs = cappedMs; }
                }, `intervalSeconds=${v}`);
                if (!slideshowSettingsPanelEl) return;
                const intervalBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
                if (intervalBtn) intervalBtn.textContent = `${v}s`; // đồng bộ lại chữ trên nút
                // MỚI — nếu transitionDurationMs vừa bị kẹp xuống, đồng bộ LẠI nút + nhãn tỉ lệ
                // (phụ thuộc transitionDurationMs) — KHÔNG thì 2 chỗ này hiện SAI (giá trị cũ đã
                // không còn đúng nữa, đúng bug Giang phát hiện).
                if (correctedTransitionMs !== null) {
                    const transitionBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
                    if (transitionBtn) transitionBtn.textContent = `${(correctedTransitionMs / 1000).toFixed(1)}s`;
                    const ratioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
                    this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioSlider ? Number(ratioSlider.value) : appConfigVisualBg.getAll().slideshow.transitionInOutRatio);
                }
                // Loop (task-manager.js) KHÔNG hỗ trợ đổi `time` giữa chừng của task count vô hạn —
                // tự kill + addNew lại với time mới, CÙNG lý do scheduleNextAutoSwitchVisualTimer()
                // làm ở core/auto-switch-visual.js.
                if (this._sourceKeys.length > 1 && taskManager.plan[SLIDESHOW_TASK]) {
                    taskManager.kill(SLIDESHOW_TASK);
                    taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
                    taskManager.operator(SLIDESHOW_TASK, 'enabled');
                }
            },
        });
    },

    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * @param {string} type
     */
    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * SỬA (18/07/2026, phản hồi Giang — mục "thêm thời gian transition") — thêm ẩn/hiện hàng
     * "Tỉ lệ In/Out" NGAY khi đổi kiểu (KHÔNG chờ mở lại panel) — CÙNG KHUÔN
     * `changeKenBurnsEnabled()` tự toggle `#slideshow-kenburns-mode-row` ngay trong hàm, không gọi
     * cả `refreshDrawerUI()` cho 1 thay đổi nhỏ.
     * @param {string} type
     */
    async changeTransitionType(type) {
        if (!SLIDESHOW_TRANSITION_TYPES.includes(type)) return; // guard: giá trị lạ -> bỏ qua
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionType = type; }, `transitionType=${type}`); // event/workflow/visual-bg.js
        setSlideshowTransitionType(slideshowContainer, type); // core — áp ngay cho lần chuyển cảnh kế tiếp
        if (slideshowSettingsPanelEl) {
            const ratioRow = slideshowSettingsPanelEl.querySelector('#slideshow-transition-ratio-row');
            if (ratioRow) ratioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(type)); // core
        }
    },

    /** MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") — ứng với nút
     * "Thời gian chuyển cảnh" — mở modal chọn thời gian DÙNG CHUNG (core/time-picker-modal.js).
     * `format: 's-ms'` (giây + phần mười giây — giữ độ chính xác dưới giây). Min 1s (Giang chốt,
     * SLIDESHOW_TRANSITION_MIN_TIME_MS, core).
     * SỬA (18/07/2026, phản hồi Giang — phát hiện bug: "phải bị max theo seconds chứ, không thể
     * quay hơn, nhưng hiện tại có thể chọn lớn hơn") — Max KHÔNG còn cố định 60s nữa: transition
     * KHÔNG BAO GIỜ nên dài hơn chính thời gian ảnh sẽ hiển thị (nếu không, y hệt bug "chuyển cảnh
     * bị cắt ngang lượt kế tiếp" đã lường trước — capSlideshowTransitionDurationMs() ở `_tick()`
     * VẪN giữ làm lưới an toàn RUNTIME, nhưng để tránh cho phép CHỌN 1 giá trị vô nghĩa ngay từ đầu,
     * modal picker giờ tự kẹp Max = MIN(60s, thời gian ảnh hiển thị hiện tại —
     * `_computeIntervalMs()`).
     * SỬA LẦN 2 (21/07/2026, Giang chốt: "max input transition phải LUÔN nhỏ hơn seconds per photo
     * tối thiểu 1 đơn vị giây" — vd interval=5s thì max=4s, KHÔNG được bằng nhau) — trừ thêm 1000ms
     * khỏi `_computeIntervalMs()` TRƯỚC khi kẹp [MIN,MAX] — CÙNG công thức
     * `capSlideshowTransitionDurationMs()` (core, dùng lại y hệt logic, không viết trùng — Rule 3c).
     * Kẹp thêm 1 lớp an toàn `Math.max(MIN_TIME_MS, ...)` phòng trường hợp hiếm ảnh hiển thị CÒN LẠI
     * dưới 2s (photoPerSong, bài hát sắp hết) khiến max tính ra nhỏ hơn cả min — tránh modal nhận
     * biên [min,max] đảo ngược.
     * Xác nhận -> persist + đồng bộ nhãn nút + đồng bộ LẠI nhãn "Tỉ lệ In/Out" (phụ thuộc TỔNG
     * thời gian vừa đổi, xem `_updateTransitionRatioLabel()`). */
    openTransitionDurationPicker() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;
        const maxMs = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(SLIDESHOW_TRANSITION_MAX_TIME_MS, this._computeIntervalMs() - 1000));
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: Math.min(cfg.transitionDurationMs, maxMs), // kẹp vị trí cuộn ban đầu luôn, tránh mở lên vượt max mới
            minMs: SLIDESHOW_TRANSITION_MIN_TIME_MS, // core
            maxMs, // ĐỘNG theo thời gian ảnh hiển thị hiện tại — KHÔNG còn cố định 60s
            onConfirm: async (resultMs) => {
                const v = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(maxMs, resultMs));
                await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionDurationMs = v; }, `transitionDurationMs=${v}`);
                if (!slideshowSettingsPanelEl) return;
                const btn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
                if (btn) btn.textContent = `${(v / 1000).toFixed(1)}s`;
                const ratioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
                this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioSlider ? Number(ratioSlider.value) : v);
            },
        });
    },

    /** Cập nhật nhãn "In Xs / Out Ys" hiển thị cạnh slider Tỉ lệ In/Out — đọc `transitionDurationMs`
     * hiện tại từ appState + `ratioPercent` truyền vào (KHÔNG đọc lại từ DOM slider — nơi gọi tự
     * quyết định dùng giá trị nào, xem 2 nơi gọi hàm này).
     * @param {HTMLElement} panelEl
     * @param {number} ratioPercent
     */
    _updateTransitionRatioLabel(panelEl, ratioPercent) {
        const labelEl = panelEl ? panelEl.querySelector('#slideshow-transition-ratio-label') : null;
        if (!labelEl) return;
        const cfg = appConfigVisualBg.getAll().slideshow;
        const { inMs, outMs } = computeSlideshowTransitionInOutMs(cfg.transitionDurationMs, ratioPercent); // core
        labelEl.textContent = tFormat('slideshowSettingsDrawer.transitionRatio.previewFormat', { in: (inMs / 1000).toFixed(1), out: (outMs / 1000).toFixed(1) });
    },

    /** Ứng với sự kiện 'input' (LIVE, đang kéo thả) trên slider Tỉ lệ In/Out — CHỈ cập nhật nhãn
     * hiển thị ngay lúc kéo, KHÔNG persist (persist thật ở `changeTransitionRatio()`, bắn lúc
     * 'change' — thả tay ra mới lưu, tránh ghi IndexedDB liên tục mỗi pixel kéo).
     * @param {number} ratioPercent
     */
    previewTransitionRatio(ratioPercent) {
        if (!slideshowSettingsPanelEl) return;
        this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioPercent);
    },

    /** Ứng với sự kiện 'change' (thả tay) trên slider Tỉ lệ In/Out — persist + đồng bộ nhãn (khớp
     * giá trị đã kẹp, nếu có).
     * @param {number} ratioPercent
     */
    async changeTransitionRatio(ratioPercent) {
        const v = Math.max(0, Math.min(100, ratioPercent));
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionInOutRatio = v; }, `transitionInOutRatio=${v}`);
        if (slideshowSettingsPanelEl) this._updateTransitionRatioLabel(slideshowSettingsPanelEl, v);
    },

    /** Ứng với select "Easing" — 5 giá trị hợp lệ (SLIDESHOW_TRANSITION_EASINGS, core) — 'linear'
     * = Giang gọi "không easing" (tốc độ đều tăm tắp).
     * @param {string} easing
     */
    async changeTransitionEasing(easing) {
        if (!SLIDESHOW_TRANSITION_EASINGS.includes(easing)) return; // guard: giá trị lạ -> bỏ qua
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.transitionEasing = easing; }, `transitionEasing=${easing}`);
    },

    /** MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — ứng với toggle "Ken Burns" (ĐỘC LẬP với
     * transitionType, dùng ĐƯỢC cùng lúc với BẤT KỲ kiểu transition nào). CHỈ persist + đồng bộ
     * state — KHÔNG ép reset/dừng ảnh đang hiện hoạt (Giang chốt: bật/tắt áp dụng từ ẢNH KẾ TIẾP,
     * đúng tiền lệ `changeMode()`/`changeTransitionType()` — không đặc cách riêng cho Ken Burns).
     * Cơ chế tick tự nhiên (`_showFirstImage()`/`_tick()`) tự đọc lại field này mỗi lượt đổi ảnh —
     * TẮT giữa chừng: ảnh đang chạy cứ hiện hết BÌNH THƯỜNG (WAAPI tự giữ trạng thái cuối qua
     * `fill:'forwards'`, không cần task freeze nào cả — xem docstring core), layer outgoing ở lượt
     * `_tick()` kế tiếp tự gọi `stopSlideshowKenBurnsAnimation(outgoingPan, ...)` (code cleanup có
     * sẵn) → tự về gốc, không cần xử lý gì thêm ở đây.
     * SỬA ("Nhóm 2", 18/07/2026) — thêm ẩn/hiện hàng <select> chế độ, CÙNG KHUÔN
     * `changePhotoPerSong()` tự toggle `#slideshow-interval-row` ngay trong hàm (không gọi cả
     * `refreshDrawerUI()` cho 1 thay đổi nhỏ).
     * @param {boolean} checked
     */
    async changeKenBurnsEnabled(checked) {
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.kenBurnsEnabled = checked; }, `kenBurnsEnabled=${checked}`);
        if (slideshowSettingsPanelEl) {
            const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
            if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !checked);
        }
    },

    /** MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — ứng với <select> "Kiểu Ken Burns" (13 chế độ,
     * THAY HẲN "Nhóm 1" — 8 biến thể random tự động, không chọn được). CHỈ persist — cơ chế tick
     * tự nhiên tự đọc lại field này mỗi lượt kích hoạt Ken Burns (`_activateKenBurns()`), áp dụng
     * từ ẢNH KẾ TIẾP như mọi field khác trong slideshowConfig.
     * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES.
     */
    async changeKenBurnsMode(mode) {
        if (!SLIDESHOW_KENBURNS_MODES.includes(mode)) return; // guard: giá trị lạ -> bỏ qua
        await workflowVisualBg.mutateSlideshowSetting((ss) => { ss.kenBurnsMode = mode; }, `kenBurnsMode=${mode}`);
    },
};
