/**
 * event/workflow/player-display-settings.js — "THẰNG THỰC THI CUỐI" cho domain 'playerDisplay'
 * (Settings > Visualizer Screen > Player) — CÙNG khuôn tối giản `event/workflow/ui-theme.js`
 * (persist qua `meta.playerDisplayConfig`, IndexedDB, `setMeta()` trực tiếp mỗi lần đổi, KHÔNG
 * debounce — tần suất đổi cực thấp, chỉ lúc người dùng vào Settings chỉnh tay).
 *
 * GIAI ĐOẠN 1 (ĐÃ XONG) — đăng ký + hiển thị/lưu list.
 * GIAI ĐOẠN 2 — RESOLUTION (ĐÃ XONG) — `changeResolutionMode()` ÁP LIVE ngay (qua core/player-
 * display-apply.js) NẾU đang Ở ĐÚNG Video/Photo Player mode lúc đổi — mirror ĐÚNG tinh thần
 * `workflowVisualBg.changeMotionPresetId()` (event/workflow/visual-bg-common.js) áp LIVE qua
 * `workflowMotionEngine.updatePreset()`. 4 hàm `apply*OnEnter()`/`clear*()` do event/workflow/
 * video-player.js/photo-player.js gọi lúc VÀO/THOÁT mode (bắt buộc gọi cặp — xem docstring core/
 * player-display-apply.js, KHÔNG gọi clear() lúc thoát sẽ làm SAI VBG dù 2 thứ không liên quan
 * nhau về Ý NGHĨA).
 * GIAI ĐOẠN 2 — REACT BEAT AUDIO, CHỈ VIDEO (ĐÃ XONG, Giang chỉ ra Photo Player mode không có
 * audio nên bỏ hẳn, xem core/player-display-settings.js::PLAYER_MOTION_SLOTS field `kinds`) — vòng
 * lặp RAF RIÊNG (`PLAYER_VIDEO_BEATREACT_TASK`, TÁCH BIỆT HẲN task của Motion Engine — 2 vòng ĐỘC
 * LẬP, không dùng chung state, dù TÁI DÙNG NGUYÊN 4 hàm THUẦN tính toán của core/motion-engine.js
 * — pure, không lý do viết lại) — `bgVideoElement` đã nối SẴN vào CHUNG analyser từ trước
 * (core/video-player.js::connectBgVideoElementToAnalyser()) nên `appState.beatScale` PHẢN ÁNH ĐÚNG
 * audio của chính video đang phát, không cần thiết lập gì thêm. `syncVideoPlayerReactBeat()`/
 * `stopVideoPlayerReactBeat()` do video-player.js gọi lúc vào/thoát mode + `changeMotionSlot()` tự
 * gọi lại lúc đổi slot 'showing' trong lúc đang ở mode (LIVE, cùng tinh thần Resolution).
 * GIAI ĐOẠN 2 — TRANSITION/POINT MOVE (CHƯA làm) — 4 field còn lại vẫn CHỈ ghi/đọc.
 *
 * Router/Listener: CHƯA có router riêng — được gọi TRỰC TIẾP từ `workflowAppSettings`
 * (event/workflow/app-settings.js, cùng cách `handleThemeSelectMode()` gọi qua router 'theme')
 * vì Player chưa cần luồng eventBus riêng nào khác ngoài Settings.
 *
 * NẠP SAU: core/config.js (appConfigPlayerDisplay), core/player-display-settings.js
 * (PLAYER_MOTION_SLOTS/resolvePlayerMotionPresetField/resolvePlayerResolutionField),
 * core/player-display-apply.js (apply*ToDOM()/clear*FromDOM()), core/motion-engine.js
 * (computeMotionEngineBeatReactZoomScale()/...Offset()/...NextPolarity()/...Envelope() — TÁI DÙNG,
 * pure), event/workflow/motion-engine.js (MOTION_ENGINE_BEATREACT_DECAY_MS — TÁI DÙNG hằng số decay
 * CHUNG cảm giác với VBG), service/task-manager.js (taskManager), service/db.js
 * (getMeta/setMeta/getImageRecord).
 * NẠP TRƯỚC: event/workflow/video-player.js, event/workflow/photo-player.js,
 * event/workflow/app-settings.js, event/workflow/app-boot.js.
 */

/** Tên task RAF của vòng lặp React Beat Video Player — TÁCH RIÊNG HẲN `MOTION_ENGINE_BEATREACT_TASK`
 * (event/workflow/motion-engine.js), 2 vòng không bao giờ chạy cùng lúc trên CÙNG 1 element trong
 * thực tế (Video Player mode và VBG Photo slideshow loại trừ nhau, xem docstring core/photo-player.js)
 * nhưng vẫn để tên riêng cho rõ ràng/dễ debug (taskManager.plan[...] theo tên). */
const PLAYER_VIDEO_BEATREACT_TASK = 'playerVideoBeatReactTick';

const workflowPlayerDisplaySettings = {
    // State RIÊNG của vòng lặp React Beat Video — CÙNG khuôn `workflowMotionEngine` giữ
    // `_beatReactEnvelope`/`_beatReactPanPolarity`/... của nó, TÁCH BIỆT HẲN (không đọc/ghi lẫn nhau).
    _videoBeatReactEnvelope: 0,
    _videoBeatReactWasAttacking: false,
    _videoBeatReactPanPolarity: 0,
    _videoBeatReactRotatePolarity: 0,
    _videoBeatReactLastTickMs: 0,

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
     * PLAYER_RESOLUTION_MODES ở đây — `<select>` chỉ có đúng 3 `<option>` hợp lệ nên giá trị luôn
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
            applyVideoPlayerResolutionToDOM(value); // core/player-display-apply.js
        } else if (kind === 'photo' && appState.get('isPhotoPlayerMode')) {
            const record = await getImageRecord(appState.get('currentKey')); // service/db.js — ảnh ĐANG hiện
            applyPhotoPlayerResolutionToDOM(value, record && record.width, record && record.height); // core/player-display-apply.js
        }
    },

    /** Ứng 1 trong 6 select Motion đổi (3 vai trò x Video: transitionNext/transitionPrev/showing;
     * 3 vai trò x Photo: transitionNext/transitionPrev/pointMove — xem core/player-display-settings.js
     * ::PLAYER_MOTION_SLOTS). `value` rỗng ('') -> gỡ (null).
     *
     * MỚI — slot 'showing' của Video giờ ÁP LIVE ngay nếu đang ở Video Player mode (cùng tinh
     * thần Resolution) — `syncVideoPlayerReactBeat()` tự đọc lại preset MỚI vừa gắn (hoặc gỡ hẳn)
     * NGAY sau khi ghi. Transition Next/Prev + Point Move (Photo) CHƯA có gì để áp (giai đoạn sau);
     * phần Point Move CỦA CHÍNH preset gắn ở 'showing' cũng CHƯA có cơ chế hoạt động (Giang chốt rõ
     * "chưa backend point move cho video"), chỉ phần React Beat của nó là THẬT SỰ chạy.
     * @param {'video'|'photo'} kind @param {string} slot - 1 trong PLAYER_MOTION_SLOTS[].slot @param {string} value */
    async changeMotionSlot(kind, slot, value) {
        const field = resolvePlayerMotionPresetField(kind, slot); // core/player-display-settings.js
        if (!field) return; // slot lạ (không nên xảy ra — select chỉ dựng từ PLAYER_MOTION_SLOTS) -> bỏ qua an toàn
        appConfigPlayerDisplay.mutateAll((cfg) => { cfg[field] = value || null; }); // core/config.js
        console.log(`writer: "workflowPlayerDisplaySettings.changeMotionSlot", page: "playerDisplayConfig", content: "${field}=${value || null}"`);
        await setMeta('playerDisplayConfig', appConfigPlayerDisplay.getAll()); // service/db.js

        if (kind === 'video' && slot === 'showing' && appState.get('isVideoPlayerMode')) {
            this.syncVideoPlayerReactBeat();
        }
    },

    /** Áp Resolution Video (đọc từ config đã lưu) lên `bgVideoElement` — gọi ĐÚNG 1 LẦN lúc VÀO
     * Video Player mode (event/workflow/video-player.js::startFromPlaylist()) — không cần gọi lại
     * mỗi lần Next/Prev, xem docstring core/player-display-apply.js. */
    applyVideoPlayerResolutionOnEnter() {
        applyVideoPlayerResolutionToDOM(appConfigPlayerDisplay.getAll().videoResolutionMode); // core/player-display-apply.js + core/config.js
    },

    /** Gỡ override Resolution khỏi `bgVideoElement` — gọi lúc THOÁT Video Player mode
     * (event/workflow/video-player.js::exitVideoPlayerMode()) — BẮT BUỘC, xem docstring core/
     * player-display-apply.js (không gọi sẽ làm sai VBG dù 2 thứ không liên quan). */
    clearVideoPlayerResolution() {
        clearVideoPlayerResolutionFromDOM(); // core/player-display-apply.js
    },

    /** Áp Resolution Photo (đọc từ config đã lưu) lên `visualBgImageElement` cho 1 `record` ảnh cụ
     * thể — gọi MỖI LẦN 1 ảnh MỚI hiện ra trong Photo Player mode (vào mode lần đầu HOẶC Next/Prev,
     * event/workflow/photo-player.js::playPhotoByKey()) — `trueMax` phụ thuộc kích thước GỐC của
     * TỪNG ảnh nên KHÔNG thể chỉ áp 1 lần như Video.
     * @param {{width?:number, height?:number}|null|undefined} record - record ảnh vừa hiện (getImageRecord()) */
    applyPhotoPlayerResolutionForRecord(record) {
        const mode = appConfigPlayerDisplay.getAll().photoResolutionMode; // core/config.js
        applyPhotoPlayerResolutionToDOM(mode, record && record.width, record && record.height); // core/player-display-apply.js
    },

    /** Gỡ override Resolution khỏi `visualBgImageElement` — gọi lúc THOÁT Photo Player mode
     * (event/workflow/photo-player.js::exitPhotoPlayerMode()) — BẮT BUỘC, cùng lý do Video ở trên. */
    clearPhotoPlayerResolution() {
        clearPhotoPlayerResolutionFromDOM(); // core/player-display-apply.js
    },

    /** Core thuần phụ — preset ĐANG gắn cho `videoShowingPresetId` (SỬA — Giang chốt GỘP Point
     * Move + React Beat của Video thành 1 field DUY NHẤT, KHÔNG còn field reactBeat riêng) — CHỈ
     * trả về nếu preset đó còn tồn tại (chưa bị xoá) VÀ `reactBeatAudio.enabled === true` — ngược
     * lại `null` (coi như chưa có gì để React Beat chạy). KHÔNG xét `pointMoveEnabled` ở đây —
     * Point Move của preset này CHƯA có cơ chế hoạt động (Giang chốt rõ), hàm này chỉ phục vụ
     * React Beat. Đọc TƯƠI mỗi lần gọi (KHÔNG cache) — `_tickVideoBeatReact()` gọi lại MỖI FRAME
     * nên tự động bắt kịp NGAY nếu người dùng đổi preset khác giữa chừng (không cần logic
     * "restart" riêng, xem `syncVideoPlayerReactBeat()`).
     * @returns {object|null} */
    _getAssignedVideoShowingPreset() {
        const presetId = appConfigPlayerDisplay.getAll().videoShowingPresetId; // core/config.js
        if (!presetId) return null;
        const preset = (appState.get('motionPresets') || []).find((p) => p.id === presetId); // core/motion-presets.js
        return (preset && preset.reactBeatAudio && preset.reactBeatAudio.enabled) ? preset : null;
    },

    /** Bật/tắt vòng lặp React Beat Video CHO ĐÚNG hiện trạng (preset đang gắn cho `videoShowingPresetId`
     * có tồn tại+enabled hay không, VÀ có đang ở Video Player mode hay không) — gọi lúc VÀO mode
     * (event/workflow/video-player.js::startFromPlaylist()) VÀ mỗi lần đổi slot 'showing' trong
     * Settings lúc đang ở mode (changeMotionSlot() ở trên). Đang chạy + preset đổi sang 1 preset
     * KHÁC nhưng VẪN enabled -> KHÔNG cần restart gì — _tickVideoBeatReact() tự đọc preset mới NGAY
     * frame kế tiếp (xem docstring _getAssignedVideoShowingPreset()). */
    syncVideoPlayerReactBeat() {
        const preset = this._getAssignedVideoShowingPreset();
        const shouldRun = !!preset && appState.get('isVideoPlayerMode');
        const isRunning = !!taskManager.plan[PLAYER_VIDEO_BEATREACT_TASK]; // service/task-manager.js
        if (shouldRun && !isRunning) {
            this._videoBeatReactEnvelope = 0; this._videoBeatReactWasAttacking = false; // bắt đầu vòng MỚI luôn từ baseline, CÙNG quy ước workflowMotionEngine.updatePreset() lúc bật lại beat-react
            this._videoBeatReactPanPolarity = 0; this._videoBeatReactRotatePolarity = 0;
            this._videoBeatReactLastTickMs = 0;
            taskManager.addNew(PLAYER_VIDEO_BEATREACT_TASK, { time: 0, exe: () => this._tickVideoBeatReact(), mode: 'raf', count: 0 }); // service/task-manager.js
        } else if (!shouldRun && isRunning) {
            this.stopVideoPlayerReactBeat();
        }
    },

    /** Dừng HẲN vòng lặp React Beat Video + trả `bgVideoElement` về KHÔNG transform — gọi lúc THOÁT
     * Video Player mode (event/workflow/video-player.js::exitVideoPlayerMode()) — BẮT BUỘC, cùng lý
     * do Resolution (tránh kẹt transform ảnh hưởng VBG dùng chung element) — VÀ tự gọi từ
     * `_tickVideoBeatReact()` nếu preset bị gỡ/tắt/xoá giữa chừng. */
    stopVideoPlayerReactBeat() {
        if (taskManager.plan[PLAYER_VIDEO_BEATREACT_TASK]) taskManager.kill(PLAYER_VIDEO_BEATREACT_TASK); // service/task-manager.js
        clearVideoPlayerReactBeatTransformFromDOM(); // core/player-display-apply.js
    },

    /** 1 frame RAF của vòng lặp React Beat Video — CÙNG công thức `workflowMotionEngine.
     * _tickBeatReact()` (event/workflow/motion-engine.js) NGUYÊN VẸN (envelope follower + zoom/pan/
     * rotate nội suy theo `energy` + đảo cực mỗi beat mới cho hướng leftToRight/rightToLeft), CHỈ
     * khác: đọc state RIÊNG (`_videoBeatReact*`, không đụng state của Motion Engine) + áp transform
     * LÊN `bgVideoElement` (core/player-display-apply.js) THAY VÌ `motionEngineReactLayer`. */
    _tickVideoBeatReact() {
        const preset = this._getAssignedVideoShowingPreset();
        if (!preset) { this.stopVideoPlayerReactBeat(); return; } // preset vừa bị gỡ/tắt/xoá giữa chừng -> tự dừng NGAY frame này
        const rb = preset.reactBeatAudio;
        const now = performance.now();
        const deltaMs = this._videoBeatReactLastTickMs ? (now - this._videoBeatReactLastTickMs) : 16; // lượt tick đầu (chưa có mốc trước) -> giả định 1 frame ~16ms
        this._videoBeatReactLastTickMs = now;
        const beatScale = appState.get('beatScale'); // service/state/visualizer-runtime.js — bgVideoElement đã nối CHUNG analyser (core/video-player.js) nên PHẢN ÁNH ĐÚNG audio của video đang phát

        const isAttacking = beatScale >= this._videoBeatReactEnvelope;
        const isNewBeat = isAttacking && !this._videoBeatReactWasAttacking; // rising edge — "beat mới"
        this._videoBeatReactWasAttacking = isAttacking;
        if (isNewBeat) {
            if (rb.pan.direction === 'leftToRight' || rb.pan.direction === 'rightToLeft') {
                this._videoBeatReactPanPolarity = computeMotionEngineBeatReactNextPolarity(this._videoBeatReactPanPolarity, rb.pan.direction, rb.pan.reverse); // core/motion-engine.js — TÁI DÙNG, pure
            }
            if (rb.rotate.direction === 'leftToRight' || rb.rotate.direction === 'rightToLeft') {
                this._videoBeatReactRotatePolarity = computeMotionEngineBeatReactNextPolarity(this._videoBeatReactRotatePolarity, rb.rotate.direction, rb.rotate.reverse); // core/motion-engine.js
            }
        }

        this._videoBeatReactEnvelope = computeMotionEngineBeatReactEnvelope(this._videoBeatReactEnvelope, beatScale, deltaMs, MOTION_ENGINE_BEATREACT_DECAY_MS); // core/motion-engine.js + event/workflow/motion-engine.js (hằng số decay) — TÁI DÙNG
        const energy = this._videoBeatReactEnvelope;

        const zoomScale = rb.zoom.enabled ? computeMotionEngineBeatReactZoomScale(rb.zoom.maxPct, energy) : 1; // core/motion-engine.js
        const panPct = rb.pan.enabled ? computeMotionEngineBeatReactOffset(rb.pan.direction, rb.pan.maxPct - 100, energy, this._videoBeatReactPanPolarity || 1) : 0; // core/motion-engine.js — trừ baseline 100% trước khi truyền
        const rotateDeg = rb.rotate.enabled ? computeMotionEngineBeatReactOffset(rb.rotate.direction, rb.rotate.maxDeg, energy, this._videoBeatReactRotatePolarity || 1) : 0; // core/motion-engine.js — baseline 0°

        applyVideoPlayerReactBeatTransformToDOM(zoomScale, panPct, rotateDeg); // core/player-display-apply.js
    },
};
