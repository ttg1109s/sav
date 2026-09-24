/**
 * event/workflow/player-display-settings.js — "THẰNG THỰC THI CUỐI" cho domain 'playerDisplay'
 * (Settings > Visualizer Screen > Player) — persist qua `meta.playerDisplayConfig` (IndexedDB,
 * `setMeta()` trực tiếp mỗi lần đổi, KHÔNG debounce — tần suất đổi cực thấp).
 *
 * Resolution (Video + Photo) — áp LIVE ngay nếu đang Ở ĐÚNG mode vừa đổi (không cần thoát/vào lại).
 * React Beat + Point Move Video (cùng field `videoShowingPresetId`, gộp 1) — dùng
 * `createMotionBeatReactRunner()`/`createMotionPointMoveRunner()` DÙNG CHUNG (event/workflow/
 * motion-beat-react-runner.js/motion-point-move-runner.js), KHÔNG tự viết logic riêng. Cả 2 Runner
 * áp lên hạ tầng DOM DÙNG CHUNG với VBG (`motionEngineReactLayer`/`videoPlayerMotionPointMoveElement`
 * — xem docstring core/player-display-apply.js), tự động co giãn theo `playbackSpeed`
 * (core/config.js) — decay React Beat qua `getSpeedFn` truyền cho Runner, `advanceMs` Point Move
 * tính lại mỗi lần tốc độ đổi (xem `syncVideoPlayerPointMove()`).
 * Transition Video (2 field `videoTransitionNextPresetId`/`videoTransitionPrevPresetId`, preset
 * riêng cho next/prev) — chạy giữa layer A (`bgVideoElement`)/layer B (`visualBgImageElement`),
 * mirror mô hình layer A/B của VBG, dùng `createMotionTransitionRunner()` DÙNG CHUNG.
 * Transition/Point Move Photo — ĐÃ làm (đợt 3, 25/09/2026), xem nhóm "Player Photo" + event/workflow/photo-player.js.
 *
 * ==== SỬA (25/09/2026, đợt 4 Motion — Giang duyệt mô hình 3 tầng) ====
 * BỎ 3 Runner RIÊNG của Player Video (`_videoShowingRunner`/`_videoPointMoveRunner`/`_videoTransitionRunner` +
 * 3 hàm `_ensure*`, 3 hàm `stop*`) — Player Video giờ MƯỢN Video surface dùng chung (event/workflow/video-
 * motion-surface.js, owner `PLAYER_VIDEO_MOTION_SURFACE_OWNER`), surface mượn tiếp `workflowMotionStage`. File
 * này CHỈ còn QUYẾT ĐỊNH của Player Video (nguyên tắc tua vít): preset theo vai trò (Next/Prev/Showing), advanceMs
 * = thời lượng video / tốc độ phát, React Beat lấy preset nào + tốc độ decay. Vào/thoát mode:
 * `acquireVideoMotion()`/`releaseVideoMotion()` (gọi từ event/workflow/video-player.js).
 * ===================================================================
 *
 * Router/Listener: CHƯA có router riêng — được gọi TRỰC TIẾP từ `workflowAppSettings`
 * (event/workflow/app-settings.js, cùng cách `handleThemeSelectMode()` gọi qua router 'theme')
 * vì Player chưa cần luồng eventBus riêng nào khác ngoài Settings. RIÊNG hàng Motion (SỬA
 * 24/09/2026, Giang yêu cầu — xoá cơ chế đăng ký Motion vào nơi tiêu thụ): router 'appSettings' gọi
 * thẳng `openMotionSlotPicker()` -> mở màn Chọn của Motion (workflowMotionPresets.openPicker(),
 * liên tuyến domain), nút Apply ở đó gọi lại `changeMotionSlot()` qua `onApply`.
 *
 * NẠP SAU: core/config.js (appConfigPlayerDisplay), core/player-display-settings.js
 * (PLAYER_MOTION_SLOTS/resolvePlayerMotionPresetField/resolvePlayerResolutionField),
 * core/player-display-apply.js (apply*ToDOM()/clear*FromDOM()), core/dom-refs.js
 * (motionEngineReactLayer/bgVideoElement/visualBgImageElement), core/motion-presets.js
 * (findMotionPresetById()/isReactBeatPresetActive()), event/workflow/visual-bg-photo-motion.js
 * (MOTION_ENGINE_NO_OP_PRESET đã dời về core/motion-presets.js 25/09/2026),
 * event/workflow/motion-presets.js (workflowMotionPresets.openPicker() — chỉ gọi lúc chạy),
 * event/workflow/motion-beat-react-runner.js (createMotionBeatReactRunner()), event/workflow/
 * motion-point-move-runner.js (createMotionPointMoveRunner()), event/workflow/
 * motion-transition-runner.js (createMotionTransitionRunner()), service/db.js
 * (getMeta/setMeta/getImageRecord).
 * NẠP TRƯỚC: event/workflow/video-player.js, event/workflow/photo-player.js,
 * event/workflow/app-settings.js, event/workflow/app-boot.js.
 */

// MỚI (25/09/2026, đợt 4) — chuỗi owner MỜ của Player Video khi mượn Video surface (surface chỉ so bằng).
const PLAYER_VIDEO_MOTION_SURFACE_OWNER = 'playerVideo';

const workflowPlayerDisplaySettings = {

    /** Resolve preset Transition cho `direction` ('next'|'prev') của Video — đọc field TƯƠNG ỨNG
     * (`videoTransitionNextPresetId`/`videoTransitionPrevPresetId`, core/config.js — 2 field TÁCH
     * RIÊNG, Giang chốt từ đầu "transition tách ra chọn riêng motion transition cho next, prev"),
     * tra `appState.motionPresets`. Preset chưa gắn/preset đã bị xoá -> `MOTION_ENGINE_NO_OP_PRESET`
     * (event/workflow/visual-bg-photo-motion.js — `transitionEnabled:false`) — Runner tự cắt cứng, không
     * animation gì, ĐÚNG hành vi "chưa gắn Motion" cho vai trò này.
     * @param {'next'|'prev'} direction @returns {object} */
    _resolveVideoTransitionPreset(direction) {
        const field = direction === 'prev' ? 'videoTransitionPrevPresetId' : 'videoTransitionNextPresetId';
        const presetId = appConfigPlayerDisplay.getAll()[field]; // core/config.js
        if (!presetId) return MOTION_ENGINE_NO_OP_PRESET; // core/motion-presets.js
        return findMotionPresetById(appState.get('motionPresets'), presetId) || MOTION_ENGINE_NO_OP_PRESET; // core/motion-presets.js
    },

    /** Chạy Transition (hoặc cắt cứng, tuỳ preset Next/Prev) giữa layer A (frame CŨ đóng băng) và layer B (thumb
     * MỚI) — truyền làm hook `runTransition` cho `workflowVideoPlayer.swapBgVideoSource()` (event/workflow/video-
     * player.js::playVideoByKey()). SỬA (25/09/2026, đợt 4) — không còn Runner riêng: giao cho Video surface
     * (event/workflow/video-motion-surface.js). `capMs = 0` — Video KHÔNG có mốc thời gian định trước để kẹp
     * (Giang chỉ ra: next/prev/end tự nhiên), Runner dùng thẳng `preset.transitionDurationMs`.
     * @param {'next'|'prev'} direction @returns {Promise<void>} resolve khi layer A "xong việc". */
    runVideoPlayerTransition(direction) {
        return workflowVideoMotionSurface.runTransition(PLAYER_VIDEO_MOTION_SURFACE_OWNER, this._resolveVideoTransitionPreset(direction), 0); // event/workflow/video-motion-surface.js
    },

    /** MỚI (25/09/2026, đợt 4) — VÀO Video Player mode: mượn Video surface (gắn DOM A/B vào lớp React Beat +
     * mượn Stage) rồi bật React Beat theo slot 'showing'. THAY `attachVideoPlayerMotionToSharedReactLayer()` +
     * `syncVideoPlayerReactBeat()` từng gọi rời ở event/workflow/video-player.js::startFromPlaylist(). */
    acquireVideoMotion() {
        workflowVideoMotionSurface.acquire(PLAYER_VIDEO_MOTION_SURFACE_OWNER, { // event/workflow/video-motion-surface.js
            getBeatPresetFn: () => this._getAssignedVideoShowingPreset(),
            getBeatSpeedFn: () => appConfigViz.getAll().playbackSpeed, // core/config.js — decay co giãn theo tốc độ phát
        });
        this.syncVideoPlayerReactBeat();
    },

    /** MỚI (25/09/2026, đợt 4) — THOÁT Video Player mode: trả Video surface (dừng sạch Point Move/React Beat/
     * Transition dở dang + trả DOM A/B về "nhà"). THAY 3 hàm `stopVideoPlayerReactBeat()`/`stopVideoPlayerPointMove()`/
     * `stopVideoPlayerTransition()` + `detachVideoPlayerMotionFromSharedReactLayer()` từng gọi rời. */
    releaseVideoMotion() {
        workflowVideoMotionSurface.release(PLAYER_VIDEO_MOTION_SURFACE_OWNER); // event/workflow/video-motion-surface.js
    },

    /** MỚI (25/09/2026, đợt 4) — Point Move/React Beat đứng/chạy theo video Player (sự kiện 'pause'/'play' thật
     * của `bgVideoElement`, event/workflow/video-player.js). No-op nếu Player không giữ surface. */
    pauseVideoMotion() { workflowVideoMotionSurface.pause(PLAYER_VIDEO_MOTION_SURFACE_OWNER); }, // event/workflow/video-motion-surface.js
    resumeVideoMotion() { workflowVideoMotionSurface.resume(PLAYER_VIDEO_MOTION_SURFACE_OWNER); },

    /** Khôi phục lựa chọn đã lưu bền LÚC BOOT — gọi từ event/workflow/app-boot.js. Chưa từng lưu
     * (boot lần đầu) -> `saved` rỗng, giữ nguyên default đã seed sẵn trong appConfigPlayerDisplay
     * (Resolution 'fit', mọi *PresetId null). KHÔNG áp dụng gì lên DOM lúc boot — chưa ở Video/Photo
     * Player mode nào (mode chỉ vào được từ Playlist, không tự động lúc boot). */
    async loadPersistedPlayerDisplayOnBoot() {
        const saved = await getMeta('playerDisplayConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigPlayerDisplay.mutateAll((cfg) => Object.assign(cfg, saved)); // core/config.js
            console.log('writer: "loadPersistedPlayerDisplayOnBoot", page: "playerDisplayConfig", content: "khôi phục từ meta.playerDisplayConfig"');
        }
    },

    /** Ứng select Resolution đổi (màn Player > Video hoặc Photo). KHÔNG validate `value` khớp
     * PLAYER_RESOLUTION_MODES ở đây — `<select>` chỉ có đúng 4 `<option>` hợp lệ nên giá trị luôn
     * sạch, cùng tinh thần các select đơn giản khác trong app-settings.js (vd Theme mode).
     *
     * ÁP LIVE ngay nếu đang Ở ĐÚNG mode kind vừa đổi — người dùng thấy hiệu ứng NGAY trong lúc
     * Video/Photo đang phát (không cần thoát/vào lại mode). Photo cần `record` của ảnh ĐANG hiện
     * (đọc lại `currentKey`, `trueMax` phụ thuộc kích thước ảnh) — Video KHÔNG cần (object-fit
     * trình duyệt tự tính lại, xem docstring core/player-display-apply.js).
     * @param {'video'|'photo'} kind @param {string} value */
    async changeResolutionMode(kind, value) {
        const field = resolvePlayerResolutionField(kind); // core/player-display-settings.js
        appConfigPlayerDisplay.mutateAll((cfg) => { cfg[field] = value; }); // core/config.js
        console.log(`writer: "workflowPlayerDisplaySettings.changeResolutionMode", page: "playerDisplayConfig", content: "${field}=${value}"`);
        await setMeta('playerDisplayConfig', appConfigPlayerDisplay.getAll()); // service/db.js

        if (kind === 'video' && appState.get('isVideoPlayerMode')) {
            applyVideoPlayerResolutionToDOM(value); // core/player-display-apply.js — layer A
            applyVideoPlayerResolutionToLayerBDOM(value); // core/player-display-apply.js — layer B, CÙNG giá trị `value` vừa áp cho layer A
        } else if (kind === 'photo' && appState.get('isPhotoPlayerMode')) {
            workflowPhotoPlayer.refreshResolution(); // event/workflow/photo-player.js — SỬA 25/09/2026: Photo giữ record + surface của mình, tự áp lại lên ĐÚNG layer đang hiện
        }
    },

    /** MỚI (24/09/2026, Giang yêu cầu — THAY select Motion + cơ chế đăng ký consumer 'player' cũ) — ứng
     * tap 1 hàng Motion (Player > Video/Photo): mở THẲNG danh sách Motion ở chế độ CHỌN, tiêu đề = nhãn
     * của vai trò, nháp ban đầu = preset đang gắn. Apply ở màn Chọn -> `changeMotionSlot()` ghi field
     * riêng của vai trò này, rồi màn Chọn tự back() về màn Player (tự vẽ lại tên preset mới).
     * @param {'video'|'photo'} kind @param {string} slot - 1 trong PLAYER_MOTION_SLOTS[].slot */
    openMotionSlotPicker(kind, slot) {
        const field = resolvePlayerMotionPresetField(kind, slot); // core/player-display-settings.js
        if (!field) return; // guard: slot lạ / không thuộc kind này -> không mở
        const slotDef = getPlayerMotionSlotsForKind(kind).find((s) => s.slot === slot); // core/player-display-settings.js
        workflowMotionPresets.openPicker({ // event/workflow/motion-presets.js — liên tuyến domain
            title: t(slotDef.labelKey),
            currentId: appConfigPlayerDisplay.getAll()[field], // core/config.js
            onApply: (id) => this.changeMotionSlot(kind, slot, id),
        });
    },

    /** Ghi preset cho 1 trong 6 vai trò Motion (3 vai trò x Video: transitionNext/transitionPrev/showing;
     * 3 vai trò x Photo: transitionNext/transitionPrev/pointMove — xem core/player-display-settings.js
     * ::PLAYER_MOTION_SLOTS). `value` rỗng ('')/null -> gỡ (null). SỬA (24/09/2026) — gọi từ `onApply`
     * của màn Chọn Motion (xem `openMotionSlotPicker()` ngay trên), không còn từ select.
     *
     * Slot 'showing' của Video ÁP LIVE ngay nếu đang ở Video Player mode (cùng tinh thần
     * Resolution) — cả React Beat lẫn Point Move (preset gộp 1 field, Giang chốt) tự đọc lại preset
     * MỚI vừa gắn (hoặc gỡ hẳn) NGAY sau khi ghi. Transition Next/Prev + Point Move (Photo) CHƯA có
     * gì để áp (giai đoạn sau).
     * @param {'video'|'photo'} kind @param {string} slot - 1 trong PLAYER_MOTION_SLOTS[].slot @param {string|null} value */
    async changeMotionSlot(kind, slot, value) {
        const field = resolvePlayerMotionPresetField(kind, slot); // core/player-display-settings.js
        if (!field) return; // slot lạ (không nên xảy ra — hàng chỉ dựng từ PLAYER_MOTION_SLOTS) -> bỏ qua an toàn
        appConfigPlayerDisplay.mutateAll((cfg) => { cfg[field] = value || null; }); // core/config.js
        console.log(`writer: "workflowPlayerDisplaySettings.changeMotionSlot", page: "playerDisplayConfig", content: "${field}=${value || null}"`);
        await setMeta('playerDisplayConfig', appConfigPlayerDisplay.getAll()); // service/db.js

        if (kind === 'video' && slot === 'showing' && appState.get('isVideoPlayerMode')) {
            this.syncVideoPlayerReactBeat();
            this.resyncVideoPlayerPointMovePreset();
        }
        // MỚI (25/09/2026, đợt 3) — Point Move Photo áp SỐNG lên ảnh đang hiện (2 slot Transition tự có hiệu
        // lực ở lượt chuyển ảnh kế tiếp, không cần làm gì).
        if (kind === 'photo' && slot === 'pointMove' && appState.get('isPhotoPlayerMode')) {
            workflowPhotoPlayer.refreshPointMovePreset(); // event/workflow/photo-player.js
        }
    },

    /** Áp Resolution Video (đọc từ config đã lưu) lên CẢ layer A (`bgVideoElement`) LẪN layer B
     * (`visualBgImageElement`, xem docstring core/player-display-apply.js — 2 layer NGANG HÀNG,
     * mô hình giống VBG) — gọi ĐÚNG 1 LẦN lúc VÀO Video Player mode (event/workflow/video-player.js
     * ::startFromPlaylist()) — không cần gọi lại mỗi lần Next/Prev cho RIÊNG layer A (CSS
     * `object-fit` trình duyệt tự tính lại), NHƯNG layer B thì CÓ, xem
     * `syncVideoPlayerResolutionLayerB()` ngay dưới. */
    applyVideoPlayerResolutionOnEnter() {
        const mode = appConfigPlayerDisplay.getAll().videoResolutionMode; // core/config.js
        applyVideoPlayerResolutionToDOM(mode); // core/player-display-apply.js — layer A
        applyVideoPlayerResolutionToLayerBDOM(mode); // core/player-display-apply.js — layer B, CÙNG giá trị `mode`
    },

    /** Đồng bộ lại Resolution cho layer B (`visualBgImageElement`) NGAY sau khi nội dung layer B
     * vừa đổi lúc swap video (event/workflow/video-player.js::swapBgVideoSource(), CHỈ lúc THẬT SỰ
     * đang ở Video Player mode — hàm đó DÙNG CHUNG với Visual Background, guard ở nơi gọi) — layer A
     * KHÔNG cần gọi lại tương ứng (CSS `object-fit` tự tính theo video hiện tại, xem docstring
     * `applyVideoPlayerResolutionOnEnter()`) nhưng layer B (`background-size`, tính tay) THÌ CÓ —
     * mỗi lần nội dung layer B đổi (ảnh khác), phải tính LẠI theo kích thước ảnh MỚI đó. Đọc
     * `bgVideoElement.videoWidth`/`.videoHeight` của video VỪA pause (layer B vừa chụp lại đúng
     * video đó) làm kích thước gốc cho mode 'trueMax' — xem docstring core/player-display-
     * apply.js::applyVideoPlayerResolutionToLayerBDOM(). */
    syncVideoPlayerResolutionLayerB() {
        applyVideoPlayerResolutionToLayerBDOM(appConfigPlayerDisplay.getAll().videoResolutionMode); // core/player-display-apply.js + core/config.js
    },

    /** Gỡ override Resolution khỏi `bgVideoElement` — gọi lúc THOÁT Video Player mode
     * (event/workflow/video-player.js::exitVideoPlayerMode()) — BẮT BUỘC, xem docstring core/
     * player-display-apply.js (không gọi sẽ làm sai VBG dù 2 thứ không liên quan). */
    clearVideoPlayerResolution() {
        clearVideoPlayerResolutionFromDOM(); // core/player-display-apply.js
    },

    // ===================== Player Photo — MỚI (25/09/2026, đợt 3 Motion) =====================
    // THAY `applyPhotoPlayerResolutionForRecord()`/`clearPhotoPlayerResolution()` (áp thẳng lên
    // `visualBgImageElement` — Player Photo không còn dùng element đó). Domain 'playerDisplay' chỉ TRẢ LỜI
    // "cấu hình Player nói gì" (preset theo vai trò, background-size theo Resolution) — nơi tiêu thụ
    // (event/workflow/photo-player.js) tự đem giá trị đó giao cho Image surface.

    /** Preset Motion đang gắn cho 1 vai trò của Photo — chưa gắn / preset đã xoá -> MOTION_ENGINE_NO_OP_PRESET.
     * @param {'transitionNext'|'transitionPrev'|'pointMove'} slot @returns {object} */
    resolvePhotoMotionPreset(slot) {
        const field = resolvePlayerMotionPresetField('photo', slot); // core/player-display-settings.js
        const presetId = field ? appConfigPlayerDisplay.getAll()[field] : null; // core/config.js
        return (presetId && findMotionPresetById(appState.get('motionPresets'), presetId)) || MOTION_ENGINE_NO_OP_PRESET; // core/motion-presets.js
    },

    /** `background-size` cho 1 record ảnh theo Resolution Photo đang lưu (`trueMax` cần kích thước gốc RIÊNG
     * của từng ảnh). @param {{width?:number, height?:number}|null|undefined} record @returns {string} */
    computePhotoPlayerBackgroundSize(record) {
        const mode = appConfigPlayerDisplay.getAll().photoResolutionMode; // core/config.js
        return computePhotoPlayerBackgroundSizeCss(mode, record && record.width, record && record.height); // core/player-display-apply.js
    },

    /** Core thuần phụ — preset ĐANG gắn cho `videoShowingPresetId` (gộp 1 field cho CẢ Point Move
     * lẫn React Beat, Giang chốt) — CHỈ trả về nếu preset đó còn tồn tại (chưa bị xoá) VÀ THẬT SỰ
     * có React Beat để chạy. KHÔNG xét `pointMoveEnabled` ở đây — hàm này CHỈ phục vụ React Beat
     * (Point Move tự resolve riêng, xem `syncVideoPlayerPointMove()`, không qua bộ lọc
     * `isReactBeatPresetActive()`). Đọc TƯƠI mỗi lần gọi (KHÔNG cache) — Runner (event/
     * workflow/motion-beat-react-runner.js) tự gọi lại hàm này MỖI FRAME, nên tự động bắt kịp NGAY
     * nếu người dùng đổi preset khác giữa chừng HOẶC sửa nội dung preset đang gắn (Motion Edit thay
     * preset bằng object MỚI mỗi lần lưu, xem event/workflow/motion-presets.js::_mutateEditing() —
     * tra lại theo id ở ĐÂY mỗi lần là điều BẮT BUỘC để không stale, không cần logic "restart" riêng).
     * SỬA (gộp trùng lặp với `workflowVisualBgPhotoMotion._getBeatReactPreset()`, event/workflow/
     * visual-bg-photo-motion.js — 2 bản check `reactBeatAudio` từng lệch nhau: bản NÀY trước đây chỉ check
     * `reactBeatAudio.enabled`, THIẾU điều kiện "phải có ít nhất 1 hiệu ứng con [zoom/panX/panY/
     * rotate] đang bật" — VÁ lỗ hổng đó khi gộp về `isReactBeatPresetActive()` [core/motion-
     * presets.js]; đồng thời đổi `.find()` tự chế sang `findMotionPresetById()` [core/motion-
     * presets.js] cho ĐÚNG helper chung, tránh viết lại lookup lần nữa) — Player KHÔNG có cache
     * riêng nên KHÔNG cần fallback như VBG, preset không tìm thấy/không active đều trả `null`.
     * @returns {object|null} */
    _getAssignedVideoShowingPreset() {
        const presetId = appConfigPlayerDisplay.getAll().videoShowingPresetId; // core/config.js
        if (!presetId) return null;
        const preset = findMotionPresetById(appState.get('motionPresets'), presetId); // core/motion-presets.js
        return isReactBeatPresetActive(preset) ? preset : null; // core/motion-presets.js
    },

    /** Bật/tắt React Beat Video CHO ĐÚNG hiện trạng — gọi lúc VÀO mode (`acquireVideoMotion()`) VÀ mỗi lần đổi
     * slot 'showing' trong Settings lúc đang ở mode (changeMotionSlot()). SỬA (25/09/2026, đợt 4) — qua Video
     * surface, getter preset đã giao lúc acquire. */
    syncVideoPlayerReactBeat() {
        workflowVideoMotionSurface.syncBeat(PLAYER_VIDEO_MOTION_SURFACE_OWNER); // event/workflow/video-motion-surface.js
    },

    /** Kích hoạt lại Point Move Video cho ĐÚNG video đang phát — `advanceMs` = thời lượng video
     * chia cho tốc độ phát hiện tại (video CHẠY nhanh/chậm bao nhiêu thì Point Move đi hết hành
     * trình trong đúng ngần đó thời gian thực, luôn khớp hình). Gọi lúc video MỚI `loadedmetadata`
     * (event/workflow/video-player.js — CHỈ lúc đó `bgVideoElement.duration` mới có giá trị đúng)
     * HOẶC đổi slot 'showing' lúc đang ở mode (changeMotionSlot()) — 2 trường hợp NỘI DUNG thật sự
     * mới/đổi hẳn cấu hình, dùng `activateForNewContent()`. Đổi tốc độ giữa lúc VẪN đang phát video
     * CŨ thì dùng `resyncVideoPlayerPointMovePreset()` ngay dưới (KHÔNG restart hành trình đang chạy
     * dở). Preset chưa gắn/không có point nào -> Runner tự no-op, không cần check trước ở đây. */
    syncVideoPlayerPointMove() {
        workflowVideoMotionSurface.activatePointMoveForNewContent(PLAYER_VIDEO_MOTION_SURFACE_OWNER, this._resolveVideoShowingPreset(), this._computeVideoPointMoveAdvanceMs()); // event/workflow/video-motion-surface.js — SỬA 25/09/2026: no-op nếu Player không giữ surface
    },

    /** Đổi preset/tốc độ phát giữa lúc VẪN đang phát ĐÚNG video cũ (event/workflow/hud.js
     * ::selectSpeed(), changeMotionSlot() ngay trên) — chỉ tính lại preset + `advanceMs` theo cấu
     * hình MỚI, dùng `activateForPresetChange()` (KHÔNG ghi lại mốc "bắt đầu hiện" như
     * `activateForNewContent()` — giữ hành trình Point Move đang chạy dở đúng vị trí, chỉ đổi cấu
     * hình đi tiếp). No-op nếu Player không giữ Video surface (SỬA 25/09/2026 — thay guard "chưa có Runner"). */
    resyncVideoPlayerPointMovePreset() {
        workflowVideoMotionSurface.activatePointMoveForPresetChange(PLAYER_VIDEO_MOTION_SURFACE_OWNER, this._resolveVideoShowingPreset(), this._computeVideoPointMoveAdvanceMs()); // event/workflow/video-motion-surface.js
    },

    /** Core thuần phụ — preset ĐANG gắn cho `videoShowingPresetId`, KHÔNG qua bộ lọc
     * `isReactBeatPresetActive()` (đó CHỈ dành cho React Beat, xem `_getAssignedVideoShowingPreset()`)
     * — Point Move Runner tự no-op nếu preset tắt `pointMoveEnabled`/không có point nào.
     * @returns {object} */
    _resolveVideoShowingPreset() {
        const presetId = appConfigPlayerDisplay.getAll().videoShowingPresetId; // core/config.js
        return (presetId && findMotionPresetById(appState.get('motionPresets'), presetId)) || MOTION_ENGINE_NO_OP_PRESET; // core/motion-presets.js
    },

    /** Core thuần phụ — thời lượng hành trình Point Move Video: thời lượng video chia tốc độ phát
     * hiện tại. `bgVideoElement.duration` chưa sẵn sàng (NaN/Infinity) hoặc 0 -> trả 0 (Runner tự
     * hiểu là bỏ qua Point Move hoàn toàn). @returns {number} */
    _computeVideoPointMoveAdvanceMs() {
        const durationSec = bgVideoElement.duration;
        const speed = appConfigViz.getAll().playbackSpeed || 1; // core/config.js
        return isFinite(durationSec) && durationSec > 0 ? (durationSec * 1000) / speed : 0;
    },
};
