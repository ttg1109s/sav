/**
 * event/workflow/visual-bg-common.js — Workflow domain "Visual Background", phần CHUNG cho cả
 * Photo lẫn Video: boot/persist, dispatch áp nền, quản lý `source.list`/chọn nguồn/picker, panel
 * màu (solid/gradient + Movement), panel Settings. Phần riêng từng loại: event/workflow/
 * visual-bg-video.js, event/workflow/visual-bg-photo.js — CẢ 3 file cùng ghép vào 1 object
 * `workflowVisualBg` DUY NHẤT (common định nghĩa, 2 file kia `Object.assign()` thêm method/field
 * riêng vào) — vẫn 1 hệ thống Settings > Visualizer > Visual Background, đây chỉ là tách file tổ
 * chức + tên gọi.
 * Xung đột Video Player mode <-> Visual Background giải quyết bằng `clearMediaLayers()` +
 * `applyCurrentVisualBg()` (gọi chéo domain từ event/workflow/video-player.js).
 *
 * NẠP SAU: core/config.js, core/visual-bg-common.js, core/color-utils.js, service/db.js,
 * service/state.js. NẠP TRƯỚC: event/workflow/visual-bg-video.js, event/workflow/visual-bg-photo.js,
 * event/router/visual-bg.js.
 */
let visualBgSettingsPanelEl = null;
let visualBgGradientPanelEl = null;

const workflowVisualBg = {
    _listIndex: -1, // vị trí hiện tại trong `source.list` — dùng chung video lẫn ảnh
    _colorPersistTimer: null,

    /** State riêng animation tick Movement (`_tickGradientMovement()`), không lưu DB. */
    _gradientMovementStartTime: null,
    _gradientMovementBaseStops: null,
    _gradientMovementSwapStartTime: null,
    _gradientMovementSwapFromColors: null,
    _gradientMovementSwapToColors: null,
    _gradientMovementLastSwapTime: null,

    /** Mode 'audio' — 1 pha xoay/giãn mượt từ *From -> *To trong `_gradientMovementPhaseDurationMs`,
     * hết pha mới lấy mẫu BPM/energy mới chốt pha kế (`_commitNextGradientPhase()`). */
    _gradientMovementPhaseStartTime: null,
    _gradientMovementPhaseDurationMs: null,
    _gradientMovementPhaseFromAngle: null,
    _gradientMovementPhaseToAngle: null,
    _gradientMovementPhaseFromSpread: null,
    _gradientMovementPhaseToSpread: null,

    /** Picker Generic Drawer multi-select dùng chung cho Video/Ảnh (không bao giờ mở đồng thời). */
    _pickerCleanup: null,
    _pickerSelectedKeys: [], // ordered — thứ tự chọn

    /** Đọc lại `meta.visualBgConfig` + áp nền — gọi 1 lần lúc boot, SAU loadConfig(). */
    async loadPersistedSettingsOnBoot() {
        const saved = await getMeta('visualBgConfig');
        if (saved && typeof saved === 'object') {
            appConfigVisualBg.mutateAll((cfg) => {
                if (VISUAL_BG_TYPES.includes(saved.type)) cfg.type = saved.type;
                if (saved.source && typeof saved.source === 'object') {
                    if (saved.source.originKind === null || VISUAL_BG_ORIGIN_KINDS.includes(saved.source.originKind)) cfg.source.originKind = saved.source.originKind;
                    if (saved.source.originId === null || typeof saved.source.originId === 'string') cfg.source.originId = saved.source.originId;
                    if (Array.isArray(saved.source.list)) cfg.source.list = saved.source.list.filter((k) => k === null || typeof k === 'string');
                    if (saved.source.videoAudio && typeof saved.source.videoAudio === 'object') {
                        const cleaned = {};
                        Object.keys(saved.source.videoAudio).forEach((k) => {
                            if (typeof k !== 'string') return;
                            cleaned[k] = getVisualBgVideoAudioSetting(saved.source.videoAudio, k);
                        });
                        cfg.source.videoAudio = cleaned;
                    }
                }
                if (saved.pending && typeof saved.pending === 'object') {
                    if ((saved.pending.originKind === null || VISUAL_BG_ORIGIN_KINDS.includes(saved.pending.originKind)) && Array.isArray(saved.pending.list)) {
                        cfg.pending.originKind = saved.pending.originKind;
                        cfg.pending.originId = typeof saved.pending.originId === 'string' ? saved.pending.originId : null;
                        cfg.pending.list = saved.pending.list.filter((k) => k === null || typeof k === 'string');
                    }
                }
                if (VISUAL_BG_LIST_PLAYBACK_MODES.includes(saved.listPlaybackMode)) cfg.listPlaybackMode = saved.listPlaybackMode;
                if (VISUAL_BG_NEXT_ORDERS.includes(saved.nextOrder)) cfg.nextOrder = saved.nextOrder;
                if (VISUAL_BG_DURATION_MODES.includes(saved.durationMode)) cfg.durationMode = saved.durationMode;
                if (typeof saved.durationSeconds === 'number' && saved.durationSeconds >= 0.5 && saved.durationSeconds <= 60) {
                    cfg.durationSeconds = saved.durationSeconds;
                } else if (saved.slideshow && typeof saved.slideshow.intervalSeconds === 'number' && saved.slideshow.intervalSeconds >= 5) {
                    cfg.durationSeconds = saved.slideshow.intervalSeconds;
                }
                if (VISUAL_BG_COLOR_MODES.includes(saved.colorMode)) cfg.colorMode = saved.colorMode;
                if (typeof saved.solidColor === 'string') cfg.solidColor = saved.solidColor;
                if (typeof saved.gradientAngleDeg === 'number') cfg.gradientAngleDeg = saved.gradientAngleDeg;
                if (Array.isArray(saved.gradientStops) && saved.gradientStops.length >= VISUAL_BG_GRADIENT_MIN_STOPS && saved.gradientStops.length <= VISUAL_BG_GRADIENT_MAX_STOPS) cfg.gradientStops = saved.gradientStops;
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
                if (typeof saved.motionPresetId === 'string' || saved.motionPresetId === null) cfg.motionPresetId = saved.motionPresetId;
            });
            console.log(`writer: "workflowVisualBg.loadPersistedSettingsOnBoot", page: "visualBgConfig", content: "nạp lại từ meta"`);
        }
        if (appConfigVisualBg.getAll().pending.originKind) this._checkAndApplyPendingSource();
        else this.applyCurrentVisualBg();
        this._syncGradientMovementTaskState();
    },

    async _persist() {
        await setMeta('visualBgConfig', appConfigVisualBg.getAll());
    },

    /** Số item CÒN SỐNG trong 1 mảng `list` (loại null) — 3 trạng thái suy ra: 0 = ẩn media, 1 =
     * phát tĩnh, >1 = cycle. Nhận thẳng `list` (mảng) — nơi gọi tự quyết truyền `source.list` (nội
     * dung thật đang phát) hay `_effectiveDisplayedList(cfg)` (nội dung đang hiển thị, có pending).
     * @param {Array<string|null>} list
     */
    _effectiveCount(list) {
        return list.filter((k) => k !== null).length;
    },

    /** Chọn index LƯỢT ĐẦU (`currentIndex=-1`). `sequential`: index 0, mảng giữ nguyên thứ tự gốc.
     * `random`: xáo cả mảng 1 lần rồi bắt đầu từ index 0 của mảng đã xáo.
     * @param {Array<string|null>} list
     * @param {boolean} isRandom
     * @returns {{ list: Array<string|null>, index: number }}
     */
    firstIndex(list, isRandom) {
        if (!isRandom) return { list, index: pickNextMotionEngineIndexSequential(-1, list.length) };
        return { list: shuffleVisualBgList(list), index: 0 };
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
        const nextIndex = pickNextMotionEngineIndexSequential(currentIndex, list.length);
        if (isRandom && nextIndex === 0 && list.length > 1) {
            const justPlayedKey = currentIndex >= 0 ? list[currentIndex] : null;
            let reshuffled = shuffleVisualBgList(list);
            if (reshuffled[0] === justPlayedKey) {
                const swapWith = 1 + Math.floor(Math.random() * (reshuffled.length - 1));
                [reshuffled[0], reshuffled[swapWith]] = [reshuffled[swapWith], reshuffled[0]];
            }
            return advanceVisualBgList(reshuffled, nextIndex);
        }
        return advanceVisualBgList(list, nextIndex);
    },

    /** Điểm đồng bộ DUY NHẤT giữa config và DOM — gọi lúc boot + sau mọi thay đổi. Màu LUÔN sơn
     * (kể cả media rỗng); media chỉ áp khi `source.list` còn ít nhất 1 item sống. */
    async applyCurrentVisualBg() {
        this.clearMediaLayers();
        updateDOMBackground();
        const cfg = appConfigVisualBg.getAll();
        const count = this._effectiveCount(cfg.source.list);
        if (cfg.type === 'video') return this._applyVideo(cfg);
        return this._applyPhoto(cfg);
    },

    /**
     * Kiểm tra + áp `cfg.pending` nếu có — dùng chung cho mọi điểm "lượt kế tiếp" của cả 2 type
     * (video hết/đổi bài, ảnh hết tick/đổi bài, và boot). Public — `workflowVideoPlayer`/router
     * cũng gọi được, nguồn sự thật `pending`/`source` vẫn thuộc domain này. Không tự tính lại
     * `firstIndex()`/mảng — giao thẳng cho `applyCurrentVisualBg()` (quy trình "chọn nguồn mới" có
     * sẵn, tự reset `_listIndex`/`_currentVideoKey` rồi phát item đầu).
     * @returns {Promise<boolean>} true nếu vừa áp pending — nơi gọi phải return ngay, không chạy
     *   tiếp logic advance()/tick() cũ (index/task cũ không còn ý nghĩa).
     */
    async _checkAndApplyPendingSource() {
        const cfg = appConfigVisualBg.getAll();
        if (!cfg.pending.originKind) return false;
        const { originKind, originId, list } = cfg.pending;
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = list;
            c.source.videoAudio = {};
            c.pending = { originKind: null, originId: null, list: [] };
        });
        console.log(`writer: "workflowVisualBg._checkAndApplyPendingSource", page: "visualBgConfig", content: "áp pending source=${originKind}:${originId}, count=${list.length}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return true;
    },

    /** Dọn sạch lớp media đang hiện (video + ảnh dự phòng) — gọi trước mọi lần áp lại. Public —
     * `workflowVideoPlayer` cũng gọi được lúc vào Video Player mode để nhường `bgVideoElement`
     * (không đụng `visualBgConfig` đã lưu — chỉ dọn DOM/task/object URL runtime, resume nguyên vẹn
     * lúc thoát qua `applyCurrentVisualBg()`). */
    clearMediaLayers() {
        const { visualBgImageObjectUrl } = appState.get(['visualBgImageObjectUrl']);
        if (typeof workflowMotionEngine !== 'undefined') workflowMotionEngine.stop();
        taskManager.kill(VISUAL_BG_PHOTO_ADVANCE_TASK);
        this._listIndex = -1;
        this._photoRecord = null;
        this._currentVideoKey = null;
        this._killStuckRecoveryTimer();
        this._killVideoFixTimeTimer();
        if (typeof workflowVideoPlayer !== 'undefined') workflowVideoPlayer.clearBgVideoSource();
        applyVisualBgImageToDOM(false, '');
        if (visualBgImageObjectUrl) revokeBlobUrl(visualBgImageObjectUrl);
        appState.set('visualBgImageObjectUrl', '');
    },

    /** Ứng với bài hát đổi thật ('visualBg.songChanged', router). Check pending trước guard
     * `listPlaybackMode==='perSong'` — điểm "lượt kế tiếp" duy nhất còn lại cho ca
     * `source.list.length<=1`. Dùng chung cho cả ảnh lẫn video — mọi quyết định "khi nào chuyển
     * ảnh" đều qua đúng 1 điểm này. */
    async advanceForSongChange() {
        const cfg = appConfigVisualBg.getAll();
        if (await this._checkAndApplyPendingSource()) return;
        if (cfg.listPlaybackMode !== 'perSong') return;
        if (cfg.type === 'video') { await this._advanceVideo(); return; }
        await this._photoTick();
    },

    /** `source.list` rỗng sau sweep -> tự gỡ hẳn nguồn (cùng hành vi nút "Gỡ nguồn" thủ công). PUBLIC
     * (không dấu `_`) — `workflowMotionEngine` cũng gọi được (liên tuyến domain, nguồn sự thật vẫn ở
     * domain này). */
    async selfHealEmptySource() {
        console.log(`writer: "workflowVisualBg.selfHealEmptySource", page: "visualBgConfig", content: "source rỗng sau sweep -> tự gỡ"`);
        await this.clearSource();
    },

    /** `workflowMotionEngine` gọi khi tự sweep/mark-null mảng ảnh lúc cycle — nguồn sự thật `source.list`
     * vẫn thuộc domain này (Rule ownership), nơi kia chỉ BÁO thay đổi lại. */
    async persistSourceListMutation(list) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source.list = list; });
        await this._persist();
    },

    /** Đồng bộ play/pause video nền theo nhạc — gọi từ core/player-controls.js + mỗi lần Next/Prev.
     * `type==='photo'` giữ nguyên hành vi cũ (`syncVisualBgVideoPlayback`). `type==='video'` có 4
     * khả năng: (1) Song đang phát + video thật chưa từng nạp -> nạp lần đầu qua `_playVideoKey()`
     * (câm cứng lúc `play()`, unmute sau khi ổn định); (2) Song đang phát + video thật đã nạp rồi
     * (đứng hình vì pause tạm) -> resume cùng nguyên tắc câm-rồi-unmute, không qua
     * `waitBgVideoReady()` (gắn với lần swap gần nhất, không hợp lệ cho resume); (3) Song vừa pause
     * tạm -> pause video, giữ nguyên khung hình đang đứng; (4) Song vừa dừng hẳn (hết playlist
     * thật) -> quay về placeholder tĩnh của đúng video đang phát, xem `_revertToPlaceholder()`. */
    syncPlaybackToAudio() {
        if (this._isSwappingVideo) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video') {
            syncVisualBgVideoPlayback(audioPlayer.paused);
            if (typeof workflowMotionEngine !== 'undefined') { if (audioPlayer.paused) workflowMotionEngine.pause(); else workflowMotionEngine.resume(); }
            this._syncPhotoTicking();
            return;
        }
        if (!audioPlayer.paused) {
            if (this._currentVideoKey === null) { this._playVideoKey(cfg.source.list[this._listIndex]); return; }
            this._resumeVideoWithDelayedAudio(this._currentVideoKey);
            return;
        }
        if (appState.get('playbackStoppedAtPlaylistEnd')) { this._revertToPlaceholder(); return; }
        syncVisualBgVideoPlayback(true);
    },

    /** Đọc key THẬT của 1 origin tại thời điểm gọi — 1 key (single) hay N key (group/multi/
     * groupMulti), đã sắp theo `nextOrder`. Không cache. 'multi'/'groupMulti' dùng chung `originId`
     * = JSON mảng (key thật/folderId) theo đúng thứ tự chọn, xem `_encodeMultiOriginId()`/
     * `_decodeMultiOriginId()` ngay dưới.
     * @param {'photo'|'video'} type
     * @param {'single'|'group'|'multi'|'groupMulti'} originKind
     * @param {string} originId
     * @returns {Promise<string[]>}
     */
    async _readOriginKeys(type, originKind, originId) {
        if (originKind === 'single') return originId ? [originId] : [];
        if (originKind === 'multi') {
            const keys = this._decodeMultiOriginId(originId);
            const records = await Promise.all(keys.map((k) => (type === 'video' ? getVideoRecord(k) : getImageRecord(k))));
            return keys.filter((_, i) => records[i]);
        }
        if (originKind === 'groupMulti') {
            const folderIds = this._decodeMultiOriginId(originId);
            const merged = [];
            for (const folderId of folderIds) {
                const map = await getFolderSongMap(folderId);
                merged.push(...(await this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : [])));
            }
            return merged;
        }
        const map = await getFolderSongMap(originId);
        return this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []);
    },

    /** Mã hoá 1 mảng key (originKind='multi') hoặc folderId (originKind='groupMulti') thành
     * `originId` (string) để lưu vào `source.originId`/`pending.originId`. */
    _encodeMultiOriginId(keys) {
        return JSON.stringify(keys);
    },

    /** Chiều ngược lại `_encodeMultiOriginId()`. JSON hỏng/không phải mảng -> mảng rỗng, tự
     * self-heal qua đường "origin đọc ra rỗng -> gỡ hẳn" ở `_resolveAndCommitSource()`. */
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
        const records = await Promise.all(keys.map((k) => (type === 'video' ? getVideoRecord(k) : getImageRecord(k))));
        const items = keys.map((k, i) => ({
            key: k,
            name: records[i] ? (type === 'video' ? (records[i].customName || stripFileExtension(records[i].filename)) : records[i].filename) : k,
            addedAt: records[i] ? records[i].addedAt : 0,
        }));
        const mode = appConfigPlaylist.getAll().displaySortMode;
        const sorted = (mode === 'newest' || mode === 'oldest') ? sortVisualBgItemsByAddedAt(items, mode === 'newest') : sortVisualBgItemsByName(items, mode === 'za');
        return sorted.map((it) => it.key);
    },

    /** So sánh 2 mảng key — thuật toán duy nhất cho "list mới có khác list cũ không, khác bao
     * nhiêu" — dùng chung cho `_resolveAndCommitSource()` (quyết định bỏ qua/pending) và
     * `_commitSourceNow()` (số liệu hiện modal).
     * `unchanged` nghiêm ngặt hơn `added===0 && removed===0` — 1 danh sách đổi CHỖ (cùng thành
     * viên, khác thứ tự) vẫn tính là "có thay đổi" (thứ tự có ý nghĩa thật với playback khi
     * `nextOrder` là 'sequential'/'playlist'), nhưng added/removed lúc đó vẫn ra 0/0.
     * @param {string[]} oldList - có thể chứa `null` (slot đã gỡ) — bị lọc bỏ trước khi so.
     * @param {string[]} newList
     * @returns {{unchanged: boolean, added: number, removed: number, total: number}}
     */
    _diffKeyLists(oldList, newList) {
        const oldKeys = oldList.filter((k) => k !== null);
        const unchanged = newList.length === oldKeys.length && newList.every((k, i) => k === oldKeys[i]);
        const oldSet = new Set(oldKeys);
        const newSet = new Set(newList);
        const added = newList.filter((k) => !oldSet.has(k)).length;
        const removed = oldKeys.filter((k) => !newSet.has(k)).length;
        return { unchanged, added, removed, total: newList.length };
    },

    /** Hiện modal phản ánh kết quả `_resolveAndCommitSource()` — dùng chung cho nút "Làm tươi" và 3
     * nút Chọn nguồn mới. `queued:true` đã tự hiện modal "sẽ áp ở lượt kế" bên trong
     * `_resolveAndCommitSource()` rồi — gọi hàm này với case đó vẫn an toàn, chỉ no-op.
     * @param {{queued: false, added: number, removed: number, total: number}|{queued: true, total: number}|null} result
     */
    async _showCommitResultModal(result) {
        if (!result) { await alertModal(t('visualBgSettingsDrawer.commitResult.cleared')); return; }
        if (result.queued) return;
        if (result.added === 0 && result.removed === 0) { await alertModal(tFormat('visualBgSettingsDrawer.commitResult.unchanged', { total: result.total })); return; }
        await alertModal(tFormat('visualBgSettingsDrawer.commitResult.changed', { added: result.added, removed: result.removed, total: result.total }));
    },

    /** Đọc lại origin + ghi đè `source.list` — dùng chung cho lúc chọn nguồn lẫn bấm "Làm tươi".
     * Origin đọc ra rỗng (folder/ảnh/video không còn tồn tại) -> gỡ hẳn. Xoá hẳn `source.videoAudio`
     * mỗi lần gọi (không giữ lại entry nào, kể cả video vẫn còn mặt trong list mới) — ghi đè lại từ
     * đầu theo đúng source hiện tại mỗi lần origin được đọc lại. Check "có đổi gì không" qua
     * `_diffKeyLists()` (dùng chung).
     * @param {'single'|'group'|'multi'|'groupMulti'} originKind
     * @param {string} originId
     * @returns {Promise<{queued: false, added: number, removed: number, total: number}|{queued: true, total: number}|null>}
     *   `queued:false` = đã áp NGAY, `added/removed` là diff so với nội dung đang hiển thị thật
     *   trước lúc gọi (pending nếu có, else `source.list`).
     *   `queued:true` = đã xếp vào `pending`, chưa áp — modal "sẽ áp ở lượt kế" đã tự hiện bên
     *   trong hàm này, caller không cần tự hiện modal thêm cho case này.
     *   `null` nếu bị gỡ hẳn (origin rỗng).
     */
    async _resolveAndCommitSource(originKind, originId) {
        const cfg = appConfigVisualBg.getAll();
        const keys = await this._readOriginKeys(cfg.type, originKind, originId);
        if (keys.length === 0) {
            appConfigVisualBg.mutateAll((c) => { c.pending = { originKind: null, originId: null, list: [] }; });
            await this.clearSource();
            return null;
        }
        const effectiveOldList = cfg.pending.originKind ? cfg.pending.list : cfg.source.list;
        const diff = this._diffKeyLists(effectiveOldList, keys);
        if (diff.unchanged) return { queued: false, added: 0, removed: 0, total: diff.total };
        if (this._effectiveCount(cfg.source.list) > 0) {
            appConfigVisualBg.mutateAll((c) => { c.pending = { originKind, originId, list: keys }; });
            console.log(`writer: "workflowVisualBg._resolveAndCommitSource", page: "visualBgConfig", content: "queued pending=${originKind}:${originId}, count=${keys.length}"`);
            await this._persist();
            await this.refreshPanelUI();
            await alertModal(t(cfg.type === 'video' ? 'visualBgSettingsDrawer.pendingSource.video' : 'visualBgSettingsDrawer.pendingSource.photo'));
            return { queued: true, total: keys.length };
        }
        return await this._commitSourceNow(originKind, originId, keys, diff);
    },

    /** Ghi đè `source` NGAY (không qua pending) — `_checkAndApplyPendingSource()` KHÔNG dùng nhánh
     * này (áp thẳng, không cần diff added/removed). Nhận thẳng `diff` (đã tính sẵn ở
     * `_resolveAndCommitSource()` qua `_diffKeyLists()`).
     * @param {'single'|'group'|'multi'|'groupMulti'} originKind
     * @param {string} originId
     * @param {string[]} keys
     * @param {{unchanged: boolean, added: number, removed: number, total: number}} diff
     * @returns {Promise<{queued: false, added: number, removed: number, total: number}>}
     */
    async _commitSourceNow(originKind, originId, keys, diff) {
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = keys;
            c.source.videoAudio = {};
            c.pending = { originKind: null, originId: null, list: [] };
        });
        console.log(`writer: "workflowVisualBg._commitSourceNow", page: "visualBgConfig", content: "source=${originKind}:${originId}, count=${keys.length}, +${diff.added}/-${diff.removed}, videoAudio=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return { queued: false, added: diff.added, removed: diff.removed, total: keys.length };
    },

    /** Ứng nút "Làm tươi" — đọc lại đúng origin đang hiển thị (`_effectiveDisplayedOrigin()`, ưu
     * tiên pending nếu có), ghi đè `source.list` (hoặc xếp/đè pending nếu đang active — xem
     * `_resolveAndCommitSource()`). Hiệu ứng xoay trên nút trong lúc đọc DB + modal báo thay đổi
     * sau khi xong qua `_showCommitResultModal()`. */
    async refreshSource() {
        const { originKind, originId } = this._effectiveDisplayedOrigin(appConfigVisualBg.getAll());
        if (!originKind || !originId) return;
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
        appConfigVisualBg.mutateAll((cfg) => { cfg.source = { originKind: null, originId: null, list: [], videoAudio: {} }; cfg.pending = { originKind: null, originId: null, list: [] }; });
        console.log(`writer: "workflowVisualBg.clearSource", page: "visualBgConfig", content: "source=cleared, pending=cleared"`);
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
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Duration mode" — dùng chung video/ảnh (xem docstring `durationMode`,
     * core/config.js). Đổi mode không retroactive lên item đang hiện — video: hẹn giờ "Fix time"
     * của video đang phát giữ nguyên, chỉ video kế theo mode mới; ảnh: tick kế tiếp tự đọc
     * `_computePhotoAdvanceMs()` mới khi rearm. */
    async changeDurationMode(value) {
        if (!VISUAL_BG_DURATION_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.durationMode = value; });
        console.log(`writer: "workflowVisualBg.changeDurationMode", page: "visualBgConfig", content: "durationMode=${value}"`);
        await this._persist();
        await this.refreshPanelUI();
    },

    /** Ứng nút "Seconds per video/photo" — áp cho cả video (`durationMode='fixtime'`), không riêng
     * ảnh. Format 's-ms' để chọn được granularity dưới giây (x100ms). */
    openDurationSecondsPicker() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.durationSeconds.pickerTitle'),
            format: 's-ms',
            valueMs: cfg.durationSeconds * 1000,
            minMs: 500,
            maxMs: 60000,
            onConfirm: async (resultMs) => {
                const v = Math.max(0.5, Math.round(resultMs / 100) / 10);
                appConfigVisualBg.mutateAll((c) => { c.durationSeconds = v; });
                console.log(`writer: "workflowVisualBg.openDurationSecondsPicker", page: "visualBgConfig", content: "durationSeconds=${v}"`);
                await this._persist();
                if (genericDrawerPanel.classList.contains('hidden')) return;
                const btn = visualBgSettingsPanelEl.querySelector('#setting-visual-bg-duration-seconds');
                if (btn) btn.textContent = `${v.toFixed(1)}s`;
            },
        });
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

    _commitColorChange(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll(mutatorFn);
        console.log(`writer: "workflowVisualBg._commitColorChange", page: "visualBgConfig", content: "${logContent}"`);
        updateDOMBackground();
        if (taskManager.isTaskRunning(VISUAL_BG_GRADIENT_MOVEMENT_TASK)) {
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
        this._syncGradientMovementTaskState();
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
            if (!cfg.gradientStops[index]) return;
            cfg.gradientStops[index] = { ...cfg.gradientStops[index], [field]: parsed };
        }, `gradientStops[${index}].${field}=${parsed}`);
        if (genericDrawerPanel.classList.contains('hidden')) return;
        if (field === 'position') visualBgGradientPanelEl.querySelector(`[data-visual-bg-stop-label="${index}"]`).textContent = `${parsed}%`;
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    addGradientStop() {
        this._commitColorChange((cfg) => { cfg.gradientStops = addVisualBgGradientStop(cfg.gradientStops); }, 'gradientStops +1');
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    removeGradientStop(index) {
        this._commitColorChange((cfg) => { cfg.gradientStops = removeVisualBgGradientStop(cfg.gradientStops, index); }, `gradientStops -1 (index ${index})`);
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    openGradientPanel() {
        visualBgGradientPanelEl = genericDrawerBody;
        const cfg = appConfigVisualBg.getAll();
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-angle').value = cfg.gradientAngleDeg;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = `${cfg.gradientAngleDeg}°`;
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);

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
        const canRemove = stops.length > VISUAL_BG_GRADIENT_MIN_STOPS;
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
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-add').classList.toggle('opacity-30', stops.length >= VISUAL_BG_GRADIENT_MAX_STOPS);
    },

    _paintGradientPreview(cfg) {
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-preview').style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg);
    },

    /** Đăng ký + bật task tick (taskManager, mode 'timeout' tự lặp — Rule "TaskManager CHỈ Workflow
     * được dùng"). An toàn gọi nhiều lần — no-op nếu task đã chạy (KHÔNG reset lại pha animation
     * giữa chừng, tránh giật hình mỗi lần _syncGradientMovementTaskState() được gọi lại). */
    _startGradientMovementTask() {
        if (taskManager.isTaskRunning(VISUAL_BG_GRADIENT_MOVEMENT_TASK)) return;
        this._gradientMovementStartTime = Date.now();
        this._gradientMovementBaseStops = appConfigVisualBg.getAll().gradientStops.slice();
        this._gradientMovementSwapStartTime = null;
        this._gradientMovementLastSwapTime = Date.now();
        this._gradientMovementPhaseStartTime = null;
        this._gradientMovementPhaseDurationMs = null;
        this._gradientMovementPhaseFromAngle = null;
        this._gradientMovementPhaseToAngle = null;
        this._gradientMovementPhaseFromSpread = null;
        this._gradientMovementPhaseToSpread = null;
        taskManager.addNew(VISUAL_BG_GRADIENT_MOVEMENT_TASK, { time: VISUAL_BG_GRADIENT_MOVEMENT_TICK_MS, exe: () => this._tickGradientMovement(), mode: 'timeout', count: 0 });
        taskManager.operator(VISUAL_BG_GRADIENT_MOVEMENT_TASK, 'enabled');
    },

    /** Dừng hẳn + dọn state transition tráo màu (nếu đang dở) — gọi khi tắt Movement/chuyển khỏi
     * colorMode 'gradient'. Nền gradient TĨNH (đứng yên tại giá trị GỐC lưu DB) tự động quay lại
     * qua nhánh updateDOMBackground() bình thường ở nơi khác — KHÔNG cần vẽ lại gì thêm ở đây. */
    _stopGradientMovementTask() {
        taskManager.kill(VISUAL_BG_GRADIENT_MOVEMENT_TASK);
        this._gradientMovementSwapStartTime = null;
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

    /** 1 khung hình animation — đọc cfg mới nhất mỗi lần (đổi setting giữa lúc chạy không cần
     * restart task), tính angle+stops rồi vẽ + ghi khung hình LIVE vào appState (cho visual 2D
     * khác đọc lại, xem core/visual-bg-common.js::getVisualBgFillStyle()).
     * Mode 'audio' xoay THEO PHA — 1 pha chạy trọn vẹn mượt tới đích rồi mới lấy mẫu nhạc mới chốt
     * pha kế (`_commitNextGradientPhase()`), không map trực tiếp energy->angle mỗi tick (map thẳng
     * khiến góc giật, đảo chiều bất cứ lúc nào năng lượng đổi). */
    _tickGradientMovement() {
        const cfg = appConfigVisualBg.getAll();
        const gm = cfg.gradientMovement;
        const now = Date.now();

        let angle;
        let stops = this._gradientMovementBaseStops;
        if (gm.mode === 'audio') {
            if (this._gradientMovementPhaseStartTime === null) this._commitNextGradientPhase(gm);
            const progress = Math.min(1, (now - this._gradientMovementPhaseStartTime) / this._gradientMovementPhaseDurationMs);
            const eased = easeInOutSine(progress);
            angle = lerpGradientMovementValue(this._gradientMovementPhaseFromAngle, this._gradientMovementPhaseToAngle, eased);
            const spread = lerpGradientMovementValue(this._gradientMovementPhaseFromSpread, this._gradientMovementPhaseToSpread, eased);
            stops = computeGradientStopSpread(stops, spread);
            if (progress >= 1) this._commitNextGradientPhase(gm);
        } else {
            const elapsed = now - this._gradientMovementStartTime;
            angle = computeGradientTimeRotateAngle(elapsed, gm.rotateDurationMs);
        }

        if (gm.colorSwapEnabled) {
            if (this._gradientMovementSwapStartTime === null && now - this._gradientMovementLastSwapTime >= gm.colorSwapIntervalMs) {
                const randomFactors = stops.map(() => Math.random());
                const shuffled = shuffleGradientStopColors(this._gradientMovementBaseStops, randomFactors);
                this._gradientMovementSwapFromColors = this._gradientMovementBaseStops.map((s) => s.color);
                this._gradientMovementSwapToColors = shuffled.map((s) => s.color);
                this._gradientMovementSwapStartTime = now;
                this._gradientMovementLastSwapTime = now;
            }
            if (this._gradientMovementSwapStartTime !== null) {
                const progress = Math.min(1, (now - this._gradientMovementSwapStartTime) / gm.colorSwapTransitionMs);
                const interpolated = this._gradientMovementSwapFromColors.map((c, i) => interpolateColor(c, this._gradientMovementSwapToColors[i], progress));
                stops = applyGradientStopColors(stops, interpolated);
                if (progress >= 1) {
                    this._gradientMovementBaseStops = applyGradientStopColors(this._gradientMovementBaseStops, this._gradientMovementSwapToColors);
                    this._gradientMovementSwapStartTime = null;
                }
            }
        }

        applyGradientCssFrame(buildVisualBgGradientCss(stops, angle));
        appState.set('visualBgGradientLiveAngle', angle, { skipCheck: true });
        appState.set('visualBgGradientLiveStops', stops, { skipCheck: true });
    },

    /** Chốt 1 pha xoay/giãn mới cho mode 'audio' — lấy mẫu BPM/energy tại thời điểm gọi (không
     * hằng số cố định, không bám sát tuyệt đối theo nhịp nhạc). Cùng công thức tốc độ theo nhạc mà
     * core/visualizer/types/space.js dùng cho camera Space. Pha mới luôn bắt đầu từ đúng giá trị
     * pha cũ vừa dừng (không "nhảy" góc). */
    _commitNextGradientPhase(gm) {
        const bpm = parseInt(appState.get('currentCalculatedBpm'), 10) || 120;
        const energy = appState.get('smoothedEnergy') || 0;
        const musicSpeedFactor = computeMusicSpeedFactor(bpm, energy, VISUAL_BG_GRADIENT_MUSIC_FACTOR_MIN, VISUAL_BG_GRADIENT_MUSIC_FACTOR_MAX);
        const duration = computeGradientPhaseDuration(VISUAL_BG_GRADIENT_PHASE_BASE_MS, musicSpeedFactor);

        this._gradientMovementPhaseFromAngle = this._gradientMovementPhaseToAngle !== null ? this._gradientMovementPhaseToAngle : gm.audioRotateFrom;
        this._gradientMovementPhaseToAngle = lerpGradientMovementValue(gm.audioRotateFrom, gm.audioRotateTo, energy);
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
        if (!VISUAL_BG_GRADIENT_MOVEMENT_MODES.includes(value)) return;
        this._commitColorChange((cfg) => { cfg.gradientMovement.mode = value; }, `gradientMovement.mode=${value}`);
        this._gradientMovementStartTime = Date.now();
        this._gradientMovementPhaseStartTime = null;
        if (genericDrawerPanel.classList.contains('hidden')) return;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-time-block').classList.toggle('hidden', value !== 'time');
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-movement-audio-block').classList.toggle('hidden', value !== 'audio');
    },

    /** Ứng với nút mở time-picker "Hết 1 vòng sau" (mode 'time'). */
    openGradientMovementDurationPicker() {
        const cfg = appConfigVisualBg.getAll();
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.gradientMovement.duration.pickerTitle'),
            format: 's-ms',
            valueMs: cfg.gradientMovement.rotateDurationMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS,
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS,
            onConfirm: (resultMs) => {
                this._commitColorChange((c) => { c.gradientMovement.rotateDurationMs = resultMs; }, `gradientMovement.rotateDurationMs=${resultMs}`);
                this._gradientMovementStartTime = Date.now();
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
        this._gradientMovementLastSwapTime = Date.now();
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
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS,
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
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS,
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

    /** bodyHtml do event/workflow/app-settings.js cung cấp sẵn qua `navigateTo()` — chỉ còn gán
     * biến (đọc lại bởi mọi hàm bên dưới) + đồng bộ giá trị. */
    async openPanel() {
        visualBgSettingsPanelEl = genericDrawerBody;
        await this.refreshPanelUI();
    },

    /** Đồng bộ UI panel theo config hiện tại — gọi lúc mở panel + sau mọi thay đổi field. Guard
     * đơn thuần: chỉ đồng bộ NẾU đang mở sẵn, không tự ý mở màn nào (kể cả khi gọi từ
     * `_checkAndApplyPendingSource()` lúc boot). */
    async refreshPanelUI() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const cfg = appConfigVisualBg.getAll();
        const q = (sel) => visualBgSettingsPanelEl.querySelector(sel);

        const listPlaybackSelect = q('#setting-visual-bg-list-playback-mode');
        const listPlaybackRow = q('#visual-bg-list-playback-row');
        const nextOrderRow = q('#visual-bg-next-order-row');
        const nextOrderSelect = q('#setting-visual-bg-next-order');
        if (listPlaybackSelect) listPlaybackSelect.value = cfg.listPlaybackMode;
        if (nextOrderSelect) nextOrderSelect.value = cfg.nextOrder;

        const count = this._effectiveCount(this._effectiveDisplayedList(cfg));
        const isList = count > 1;
        if (listPlaybackRow) listPlaybackRow.classList.toggle('hidden', !isList);
        if (nextOrderRow) nextOrderRow.classList.toggle('hidden', !isList);

        const durationModeRow = q('#visual-bg-duration-mode-row');
        const durationModeSelect = q('#setting-visual-bg-duration-mode');
        const durationSecondsRow = q('#visual-bg-duration-seconds-row');
        const durationSecondsLabel = q('#visual-bg-duration-seconds-label');
        const durationSecondsBtn = q('#setting-visual-bg-duration-seconds');
        if (durationModeSelect) durationModeSelect.value = cfg.durationMode;
        const isSlideshowCycling = isList && cfg.listPlaybackMode === 'slideshow';
        if (durationModeRow) durationModeRow.classList.toggle('hidden', !isSlideshowCycling);
        if (durationSecondsRow) durationSecondsRow.classList.toggle('hidden', !(isSlideshowCycling && cfg.durationMode === 'fixtime'));
        if (durationSecondsLabel) durationSecondsLabel.textContent = t(cfg.type === 'video' ? 'visualBgSettingsDrawer.durationSeconds.labelVideo' : 'visualBgSettingsDrawer.durationSeconds.labelPhoto');
        if (durationSecondsBtn) durationSecondsBtn.textContent = `${cfg.durationSeconds.toFixed(1)}s`;

        const videoAudioRow = q('#setting-visual-bg-open-video-audio');
        if (videoAudioRow) videoAudioRow.classList.toggle('hidden', !(cfg.type === 'video' && count >= 1));

        const motionRow = q('#visual-bg-motion-row');
        if (motionRow) motionRow.classList.toggle('hidden', cfg.type !== 'photo');
        const motionSelect = q('#setting-visual-bg-motion-preset');
        if (motionSelect && cfg.type === 'photo') this._renderMotionPresetOptions(motionSelect, cfg.motionPresetId);

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
        if (gradientSwatch) gradientSwatch.style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg);

        await this._refreshSourceNameLabel(cfg);
    },

    /** Đổ `<option>` cho dropdown Motion — CHỈ preset ĐÃ đăng ký cho 'photoVisualBg' trong
     * `appState.motionApply` (xem core/motion-presets.js), luôn kèm 1 option "Không" (value='').
     * `currentId` không nằm trong danh sách đã đăng ký (vừa bị huỷ đăng ký) -> chọn "Không" tự
     * nhiên (không ép xoá `motionPresetId`, chỉ đơn giản không còn hiện trong lựa chọn).
     * @param {HTMLSelectElement} selectEl @param {string|null} currentId */
    _renderMotionPresetOptions(selectEl, currentId) {
        const subscribedIds = appState.get('motionApply').photoVisualBg || []; // core/motion-presets.js — MOTION_APPLY_CONSUMERS
        const presets = appState.get('motionPresets').filter((p) => subscribedIds.includes(p.id));
        const noneOption = `<option value="">${t('visualBgSettingsDrawer.motion.none')}</option>`;
        selectEl.innerHTML = noneOption + presets.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
        selectEl.value = presets.some((p) => p.id === currentId) ? currentId : '';
    },

    /** Ứng select Motion đổi — ghi thẳng `motionPresetId` ('' -> null = gỡ). Có hiệu lực NGAY lần
     * transition ảnh kế tiếp (Motion Engine tự đọc `motionPresetId` mới mỗi lần kích hoạt, không
     * cần gọi lại applyCurrentVisualBg()).
     * @param {string} value */
    async changeMotionPresetId(value) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.motionPresetId = value || null; });
        console.log(`writer: "workflowVisualBg.changeMotionPresetId", page: "visualBgConfig", content: "motionPresetId=${value || null}"`);
        await this._persist();
    },

    /** Ghi tên nguồn đang chọn vào `#visual-bg-source-name` + hiện/ẩn nút Làm tươi/Gỡ nguồn theo
     * có origin hay không. Ưu tiên đọc `cfg.pending` nếu có (origin vừa chọn, chưa áp vào `source`
     * thật vì đang có media active) — panel phải phản ánh lựa chọn đó ngay, không đợi pending áp
     * xong (media hiện tại vẫn tiếp tục phát, không gián đoạn). Dùng chung
     * `_effectiveDisplayedOrigin()` với `refreshSource()`. */
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

    /** Origin nên hiển thị ở Settings (khác origin đang thật sự phát nếu có pending) — `cfg.pending`
     * (nếu có) luôn thắng `cfg.source`. Dùng chung cho `_refreshSourceNameLabel()`/`refreshSource()`.
     * @param {object} cfg
     * @returns {{originKind: string|null, originId: string|null}}
     */
    _effectiveDisplayedOrigin(cfg) {
        return cfg.pending.originKind ? { originKind: cfg.pending.originKind, originId: cfg.pending.originId } : { originKind: cfg.source.originKind, originId: cfg.source.originId };
    },

    /** Mảng list song song với `_effectiveDisplayedOrigin()` (cùng ưu tiên pending nếu có) — dùng
     * cho mọi chỗ cần đếm số lượng item đang hiển thị cho người dùng (`refreshPanelUI()`), khác
     * `cfg.source.list` thô (nội dung thật đang phát, dùng cho playback logic thật).
     * @param {object} cfg
     * @returns {Array<string|null>}
     */
    _effectiveDisplayedList(cfg) {
        return cfg.pending.originKind ? cfg.pending.list : cfg.source.list;
    },

    /** Đọc tên hiển thị thật của 1 origin (imageKey/videoKey/folderId, hoặc đếm số lượng cho 2
     * originKind gộp nhiều — 'multi'/'groupMulti', không có tên đơn lẻ nào để đọc). 'group' đọc
     * được cả `type==='photo'` (Thư mục Photo). */
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
            const folder = await getFolderRecord(originId);
            return folder ? folder.name : none;
        }
        if (type === 'video') {
            const record = await getVideoRecord(originId);
            return record ? (record.customName || stripFileExtension(record.filename)) : none;
        }
        const record = await getImageRecord(originId);
        return record ? record.filename : none;
    },

    /** Visual BG sống trong chính Generic Drawer picker vừa mượn — `closeFully()` sẽ đóng luôn
     * Visual BG, không có gì để quay lại, nên tự mở lại màn Visual Background thay vì đóng hẳn. */
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

    /** Commit chung cho picker Video/Ảnh — đổi `type` nếu khác (gỡ hẳn source/pending cũ), rồi giao
     * `_resolveAndCommitSource('multi', ...)` xử lý tiếp (pending/áp ngay, persist, refreshPanelUI,
     * applyCurrentVisualBg), rồi hiện modal kết quả qua `_showCommitResultModal()`.
     * @param {'video'|'photo'} type
     * @param {string[]} keys - thứ tự chọn, giữ nguyên khi lưu.
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

    /** Đọc danh sách folder đúng `type`, lọc bỏ folder rỗng (0 item — không đóng góp gì khi gộp),
     * rồi mở/vẽ lại picker Thư mục dùng chung với Playlist
     * (`workflowPlaylist._openFolderPickerDrawer()`, phần mở rộng multi-select +
     * typeOptions/onTypeChange).
     * @param {'photo'|'video'} type
     * @param {boolean} [isUpdate] - true khi gọi lại từ `onTypeChange` (picker đang mở, chỉ đổi
     *        loại) -> vẽ lại tại chỗ (`updateGenericDrawer()`); bỏ trống = mở mới, từ
     *        `openPickFolder()` -> `openGenericDrawer()`.
     */
    async _openFolderPickerForType(type, isUpdate) {
        const folders = await listFolders(type);
        const counts = await Promise.all(folders.map(async (f) => {
            const map = await getFolderSongMap(f.id);
            return map ? getFolderSongKeys(map).length : 0;
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
                onClose: () => workflowAppSettings._renderVisualBg(),
                multiSelect: true,
                typeOptions: { current: type },
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
