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
 * `workflowVisualBgPhotoMotion.updatePreset()`. 4 hàm `apply*OnEnter()`/`clear*()` do event/workflow/
 * video-player.js/photo-player.js gọi lúc VÀO/THOÁT mode (bắt buộc gọi cặp — xem docstring core/
 * player-display-apply.js, KHÔNG gọi clear() lúc thoát sẽ làm SAI VBG dù 2 thứ không liên quan
 * nhau về Ý NGHĨA).
 * GIAI ĐOẠN 2 — REACT BEAT AUDIO, CHỈ VIDEO (ĐÃ XONG) — SỬA (Giang chỉ ra: bản đầu tự viết RIÊNG 1
 * task RAF + tick function trùng lặp với `workflowVisualBgPhotoMotion`, VI PHẠM nguyên tắc "trách nhiệm
 * apply live thuộc về Motion, không nhân bản theo từng nơi tiêu thụ") — giờ dùng
 * `createMotionBeatReactRunner()` (event/workflow/motion-beat-react-runner.js, DÙNG CHUNG, KHÔNG
 * viết riêng gì nữa) — `_videoShowingRunner` là 1 INSTANCE của runner đó, tạo LƯỜI lúc cần
 * (`_ensureVideoShowingRunner()`). `syncVideoPlayerReactBeat()`/`stopVideoPlayerReactBeat()` giờ
 * CHỈ còn gọi thẳng `.sync()`/`.stop()` của runner — KHÔNG tự quản lý task/state gì nữa.
 * `bgVideoElement` đã nối SẴN vào CHUNG analyser từ trước (core/video-player.js
 * ::connectBgVideoElementToAnalyser()) nên `appState.beatScale` PHẢN ÁNH ĐÚNG audio của chính video
 * đang phát, không cần thiết lập gì thêm. `syncVideoPlayerReactBeat()` do video-player.js gọi lúc
 * vào mode + `changeMotionSlot()` tự gọi lại lúc đổi slot 'showing' trong lúc đang ở mode (LIVE,
 * cùng tinh thần Resolution) — VÀ giờ sửa nội dung preset ĐANG chạy (Motion Edit, không đổi preset
 * nào đang gắn) cũng LIVE theo THẬT SỰ, vì Runner tự tra `getPresetFn()` lại theo id MỖI FRAME,
 * không cache preset cũ (xem docstring event/workflow/motion-beat-react-runner.js).
 * GIAI ĐOẠN 2 — TRANSITION VIDEO (ĐÃ XONG — 2 field `videoTransitionNextPresetId`/
 * `videoTransitionPrevPresetId`, PRESET RIÊNG cho next/prev, Giang chốt từ đầu) — CHẠY GIỮA layer A
 * (`bgVideoElement`, đang đứng hình frame CŨ) và layer B (`visualBgImageElement`, vừa nhận thumb
 * MỚI) — mirror ĐÚNG mô hình layer A/B của VBG (Giang chỉ ra), dùng `createMotionTransitionRunner()`
 * DÙNG CHUNG (event/workflow/motion-transition-runner.js, ĐÃ viết lại đúng nguyên tắc "tua vít" —
 * không tự quyết nội dung layer). `runVideoPlayerTransition(direction)` do event/workflow/
 * video-player.js::swapBgVideoSource() gọi "chen vào giữa" bước decode thumb xong và bước phát
 * video mới (Giang mô tả chi tiết) — advanceMs truyền `0` (Video KHÔNG tính trước "thời lượng hiển
 * thị" như VBG — next/prev/end tự nhiên, không có mốc thời gian định trước để kẹp theo).
 * GIAI ĐOẠN 2 — TRANSITION PHOTO/POINT MOVE (CHƯA làm) — 2 field còn lại vẫn CHỈ ghi/đọc.
 *
 * Router/Listener: CHƯA có router riêng — được gọi TRỰC TIẾP từ `workflowAppSettings`
 * (event/workflow/app-settings.js, cùng cách `handleThemeSelectMode()` gọi qua router 'theme')
 * vì Player chưa cần luồng eventBus riêng nào khác ngoài Settings.
 *
 * NẠP SAU: core/config.js (appConfigPlayerDisplay), core/player-display-settings.js
 * (PLAYER_MOTION_SLOTS/resolvePlayerMotionPresetField/resolvePlayerResolutionField),
 * core/player-display-apply.js (apply*ToDOM()/clear*FromDOM()), core/dom-refs.js
 * (motionEngineReactLayer/bgVideoElement/visualBgImageElement), core/motion-presets.js
 * (findMotionPresetById()/isReactBeatPresetActive()), event/workflow/visual-bg-photo-motion.js
 * (MOTION_ENGINE_NO_OP_PRESET, đổi tên 17/09/2026 từ event/workflow/motion-engine.js),
 * event/workflow/motion-beat-react-runner.js (createMotionBeatReactRunner()), event/workflow/
 * motion-transition-runner.js (createMotionTransitionRunner()), service/db.js
 * (getMeta/setMeta/getImageRecord).
 * NẠP TRƯỚC: event/workflow/video-player.js, event/workflow/photo-player.js,
 * event/workflow/app-settings.js, event/workflow/app-boot.js.
 */

const workflowPlayerDisplaySettings = {
    _videoShowingRunner: null, // instance createMotionBeatReactRunner(), tạo LƯỜI — xem _ensureVideoShowingRunner()
    _videoTransitionRunner: null, // instance createMotionTransitionRunner(), tạo LƯỜI — xem _ensureVideoTransitionRunner()

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
        if (!presetId) return MOTION_ENGINE_NO_OP_PRESET; // event/workflow/visual-bg-photo-motion.js
        return findMotionPresetById(appState.get('motionPresets'), presetId) || MOTION_ENGINE_NO_OP_PRESET; // core/motion-presets.js
    },

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionTransitionRunner()` RIÊNG của Video Player mode
     * (taskName riêng, KHÔNG trùng VBG — mỗi Runner tự giữ bộ nhớ hướng random + timer dọn dẹp CỦA
     * RIÊNG mình, xem event/workflow/motion-transition-runner.js).
     * @returns {ReturnType<typeof createMotionTransitionRunner>} */
    _ensureVideoTransitionRunner() {
        if (!this._videoTransitionRunner) {
            this._videoTransitionRunner = createMotionTransitionRunner('playerVideoTransitionCleanup'); // event/workflow/motion-transition-runner.js
        }
        return this._videoTransitionRunner;
    },

    /** Chạy Transition (hoặc cắt cứng, tuỳ preset) giữa layer A (`bgVideoElement`, ĐANG đứng hình
     * frame CŨ — gọi hàm này SAU khi đã `pause()`, TRƯỚC khi đụng `src` mới) và layer B
     * (`visualBgImageElement`, VỪA nhận thumb MỚI — gọi SAU khi đã chèn xong thumb đó) — mirror
     * ĐÚNG mô hình layer A/B của VBG (Giang chỉ ra) — CHỈ khác: container DÙNG CHUNG là
     * `motionEngineReactLayer` (element Video Player mode đã mượn làm cha chung của layer A/B,
     * xem core/player-display-apply.js::attachVideoPlayerMotionToSharedReactLayer()), KHÔNG phải
     * `#visual-motion-container` riêng của VBG.
     *
     * KHÔNG gán/gỡ NỘI DUNG layer nào ở đây (Runner không biết/không đụng, xem docstring event/
     * workflow/motion-transition-runner.js — "tua vít") — nơi gọi (event/workflow/video-player.js
     * ::swapBgVideoSource()) đã tự gán nội dung layer B TRƯỚC khi gọi hàm này, và tự lo layer A
     * (opacity/src mới) SAU KHI Promise trả về đây resolve.
     *
     * `advanceMs` truyền `0` — Video KHÔNG tính trước "thời lượng hiển thị" như VBG (Giang chỉ ra:
     * next/prev/end tự nhiên, KHÔNG có mốc thời gian định trước để kẹp theo) — Runner tự hiểu `0`
     * là "không kẹp, dùng thẳng `preset.transitionDurationMs`" (xem docstring `runTransition()`,
     * event/workflow/motion-transition-runner.js — nhánh vốn đã có sẵn cho mode 'perSong' của VBG).
     * @param {'next'|'prev'} direction @returns {Promise<void>} resolve khi layer A "xong việc". */
    runVideoPlayerTransition(direction) {
        const preset = this._resolveVideoTransitionPreset(direction);
        return new Promise((resolve) => {
            this._ensureVideoTransitionRunner().runTransition( // event/workflow/motion-transition-runner.js
                motionEngineReactLayer, // container — core/dom-refs.js
                bgVideoElement, // outgoing (layer A) — core/dom-refs.js
                visualBgImageElement, // incoming (layer B) — core/dom-refs.js
                preset,
                0, // advanceMs — xem docstring trên
                resolve,
            );
        });
    },

    /** Huỷ timer dọn dẹp Transition CÒN TREO (nếu có lượt nào chưa kịp settle — vd vừa Next xong
     * thoát mode ngay) — gọi lúc THOÁT Video Player mode (event/workflow/video-player.js
     * ::exitVideoPlayerMode()) — BẮT BUỘC, cùng lý do `stopVideoPlayerReactBeat()`: Runner gọi
     * `onSettle` (Promise `resolve` của lượt `runVideoPlayerTransition()` dở dang, nếu có) NGAY khi
     * `stop()` chạy, tránh treo mãi 1 Promise không bao giờ resolve. No-op nếu chưa từng tạo Runner. */
    stopVideoPlayerTransition() {
        if (this._videoTransitionRunner) this._videoTransitionRunner.stop(); // event/workflow/motion-transition-runner.js
    },

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
     * trả về nếu preset đó còn tồn tại (chưa bị xoá) VÀ THẬT SỰ có React Beat để chạy. KHÔNG xét
     * `pointMoveEnabled` ở đây — Point Move của preset này CHƯA có cơ chế hoạt động (Giang chốt
     * rõ), hàm này chỉ phục vụ React Beat. Đọc TƯƠI mỗi lần gọi (KHÔNG cache) — Runner (event/
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

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionBeatReactRunner()` cho React Beat của Video —
     * target là `motionEngineReactLayer` (SỬA — Giang chỉ ra "tôi tưởng motion đã tách khỏi nơi
     * tiêu thụ?": KHÔNG tạo lớp cha riêng cho Video nữa, TÁI DÙNG THẲNG lớp CÓ SẴN của Motion
     * Engine, core/dom-refs.js — `videoPlayerMotionPointMoveElement` [bọc `#bg-video`] tự
     * `appendChild`/gỡ vào/ra khỏi lớp đó lúc vào/thoát mode, xem core/player-display-apply.js
     * ::attachVideoPlayerMotionToSharedReactLayer()/detachVideoPlayerMotionFromSharedReactLayer(),
     * gọi từ event/workflow/video-player.js). Motion Engine hoàn toàn không biết việc di chuyển
     * này — Runner chỉ hỏi target qua hàm, KHÔNG quan tâm ai đang thật sự nằm trong đó.
     * @returns {{sync: () => void, stop: () => void, pause: () => void, resume: () => void}} */
    _ensureVideoShowingRunner() {
        if (!this._videoShowingRunner) {
            this._videoShowingRunner = createMotionBeatReactRunner( // event/workflow/motion-beat-react-runner.js
                'playerVideoBeatReactTick',
                () => motionEngineReactLayer, // core/dom-refs.js
                () => this._getAssignedVideoShowingPreset(),
            );
        }
        return this._videoShowingRunner;
    },

    /** Bật/tắt React Beat Video CHO ĐÚNG hiện trạng — gọi lúc VÀO mode (event/workflow/
     * video-player.js::startFromPlaylist()) VÀ mỗi lần đổi slot 'showing' trong Settings lúc đang
     * ở mode (changeMotionSlot() ở trên). CHỈ còn 1 dòng gọi thẳng Runner — KHÔNG tự quản lý
     * task/state gì nữa (xem event/workflow/motion-beat-react-runner.js). */
    syncVideoPlayerReactBeat() {
        this._ensureVideoShowingRunner().sync();
    },

    /** Dừng hẳn React Beat Video — gọi lúc THOÁT Video Player mode (event/workflow/video-player.js
     * ::exitVideoPlayerMode()) — BẮT BUỘC, cùng lý do Resolution (tránh kẹt transform ảnh hưởng VBG
     * dùng chung `bgVideoElement` — dù transform áp lên lớp cha bọc riêng, không phải chính
     * `bgVideoElement`, vẫn phải dọn vì lớp cha đó luôn hiện diện bất kể mode). */
    stopVideoPlayerReactBeat() {
        this._ensureVideoShowingRunner().stop();
    },
};
