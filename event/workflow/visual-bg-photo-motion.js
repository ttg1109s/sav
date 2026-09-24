/**
 * event/workflow/visual-bg-photo-motion.js — Motion Engine VBG-Photo: RENDERER THUẦN cho
 *
 * ==== SỬA (25/09/2026, Giang duyệt mô hình 3 tầng — ĐỌC PHẦN NÀY TRƯỚC, nó thay nghĩa phần cũ bên dưới) ====
 * File này giờ là "IMAGE SURFACE" — tầng 2 "bề mặt media" cho nội dung ẢNH A/B, DÙNG CHUNG cho mọi nơi
 * tiêu thụ nội dung ảnh (hiện: VBG Photo; kế tiếp: Player Photo). GIỮ NGUYÊN tên file/object/DOM (Giang
 * chốt KHÔNG đổi tên). Nằm NGOÀI domain Motion (Motion = cái tua vít, không biết nội dung): file này biết
 * nội dung là ảnh (2 layer luân phiên, `background-image`, sở hữu + revoke object URL) nhưng KHÔNG biết ai
 * dùng nó (không tra preset, không hẹn giờ, không biết VBG/Player).
 *   - 3 Runner KHÔNG còn nằm ở đây — MƯỢN `workflowMotionStage` (event/workflow/motion-stage.js) qua token.
 *   - `showImage(objectUrl, options)` — options `{transitionPreset, pointMovePreset, advanceMs,
 *     transitionCapMs?, backgroundSize?, getBeatPresetFn?}`: 2 preset TÁCH RIÊNG (VBG truyền cùng 1 preset
 *     2 lần; Player truyền preset theo slot), `backgroundSize` do nơi tiêu thụ tự tính (trống = cover mặc
 *     định CSS), getter React Beat do nơi tiêu thụ quyết.
 *   - BỎ `livePointMoveToggle()` + `appState.motionRunning` — thay bằng broadcast
 *     `notifyMotionPointMoveEnabledChanged()` (event/workflow/motion-point-move-runner.js).
 *   - `MOTION_ENGINE_NO_OP_PRESET` dời sang core/motion-presets.js; `MOTION_ENGINE_BEATREACT_DECAY_MS` dời
 *     sang event/workflow/motion-beat-react-runner.js; 2 tên task dời sang event/workflow/motion-stage.js.
 *   - ĐỢT 3 (25/09/2026, Player Photo dùng chung): thêm `owner` (chuỗi MỜ do nơi tiêu thụ tự đặt — surface
 *     KHÔNG hiểu nghĩa, chỉ so bằng) — mọi lệnh "sửa nội dung đang hiện" (updatePreset/restartPointMove/
 *     pause/resume/updateBackgroundSize) CHỈ có tác dụng nếu đúng owner đang hiện, chặn chéo (vd VBG nhận
 *     sự kiện 'pause' của Song lúc Player Photo đang giữ surface). showImage() với owner KHÁC owner đang
 *     hiện -> hiện TĨNH (không transition giữa 2 nơi tiêu thụ). `stop()` GIỮ vô điều kiện (dọn lớp lúc đổi
 *     mode — xem workflowVisualBg.clearMediaLayers()). Thêm option `onShown` (ảnh mới hiện TRỌN: tĩnh ->
 *     ngay; transition -> lúc Transition xong) + `hasContent(owner)`.
 * =====================================================================================================
 *
 * transition/Point Move/React Beat Audio của Visual Background (`type='photo'`). File này KHÔNG
 * timer chuyển ảnh, KHÔNG biết `source.list`/`nextOrder`/`listPlaybackMode`/`motionPresetId` tồn
 * tại, KHÔNG biết ảnh đến từ đâu (không tự đọc DB, không có khái niệm imageKey) — CHỈ còn 5 hàm
 * public:
 *   `showImage(objectUrl, preset, advanceMs)` — hiện `objectUrl` lên layer hiện hành; Engine TỰ QUYẾT
 *                                     hiện tĩnh (chưa có ảnh nào) hay transition từ ảnh đang hiện sang
 *                                     (đã có), dựa trên `_hasCurrentResource` CỦA CHÍNH NÓ — nơi gọi
 *                                     không cần/không được biết đây là ảnh đầu hay ảnh kế.
 *                                     `objectUrl` rỗng/null -> coi như `stop()`.
 *   `updatePreset(preset, advanceMs)` — đổi preset đang áp cho ẢNH ĐANG HIỆN, KHÔNG đổi ảnh/không
 *                                     chạy transition — chỉ Point Move/React Beat đổi theo preset mới
 *                                     NGAY. No-op nếu chưa có ảnh nào đang hiện.
 *   `pause()`/`resume()`            — đóng băng/tiếp tục animation ĐANG chạy (nơi gọi tự quyết lúc
 *                                     nào — vd Song dừng/phát lại).
 *   `stop()`                        — dọn sạch layer/state.
 * `preset` LUÔN được TRUYỀN VÀO (đã resolve sẵn) — nơi gọi (workflowVisualBg) là chỗ DUY NHẤT đọc
 * `motionPresetId`/tra `appState.motionPresets` (xem `workflowVisualBg._currentMotionPreset()`).
 * `advanceMs` LUÔN được TRUYỀN VÀO — nơi gọi tự tính theo `durationMode`/`durationSeconds`/
 * `record.duration` của MÌNH (Engine không đọc field nào trong số đó nữa).
 * `objectUrl` do nơi gọi tự resolve (`getImageRecord()` + `createBlobUrl()`, service/db.js +
 * service/blob-url.js) rồi GIAO ownership cho Engine ngay khi gọi `showImage()` — kể từ đó Engine
 * chịu trách nhiệm giữ/chuyển layer/revoke URL đó, nơi gọi KHÔNG revoke lại. Ranh giới này tách hẳn
 * "ảnh lấy từ đâu" (VBG/service, có thể đổi nguồn sau này) khỏi "hiện ảnh như thế nào" (Engine).
 *
 * SỬA (Giang chỉ ra: "Motion cung cấp cơ chế THUẦN [như cái tua vít] — không quan tâm ai dùng/dùng
 * vào việc gì, nơi tiêu thụ tự quyết gắn ở đâu, dùng ra sao") — React Beat/Point Move ĐÃ chuyển hẳn
 * ra Runner DÙNG CHUNG (event/workflow/motion-beat-react-runner.js/motion-point-move-runner.js).
 * Transition CŨNG vậy (event/workflow/motion-transition-runner.js) — NHƯNG bản Runner Transition
 * ĐẦU (audit lần trước) vẫn CÒN SAI: tự ý quản lý object URL + tự gọi `setMotionEngineLayerImage()`
 * gán/gỡ nội dung layer — ĐÓ là quyết định CỦA VBG (ảnh lấy từ URL, nội dung là background-image),
 * KHÔNG phải bản chất "transition" (bằng chứng: Video Player mode dùng layer A = `<video>`, không
 * có background-image, "chuẩn bị nội dung" của nó là KHÔNG LÀM GÌ — Runner cũ ép `setMotionEngineLayerImage()`
 * lên layer A sẽ vô nghĩa). SỬA LẦN 2 — Runner giờ CHỈ còn `runTransition(containerEl, outgoingEl,
 * incomingEl, preset, advanceMs, onSettle)`: set thuộc tính transition + class + timing + hẹn giờ,
 * gọi `onSettle()` khi outgoing "xong việc" — KHÔNG đụng nội dung. File NÀY (nơi tiêu thụ CỦA
 * Transition Runner, đại diện VBG) giờ tự giữ LẠI toàn bộ state/quyết định thuộc về mình:
 * `_layerToggle`/`_hasCurrentResource`/`_currentObjectUrl`/`_currentLayer()`/`_idleLayer()`/
 * `_currentPanLayer()`/`_idlePanLayer()` — VÀ tự gán/gỡ `background-image` (`setMotionEngineLayerImage()`)
 * + tự revoke URL NGAY TRONG callback `onSettle` truyền cho `runTransition()`.
 *
 * ĐỔI TÊN (17/09/2026, Giang chỉ ra: "motion lại phải biết tôi đang sử dụng cho cái gì?" — soát lại
 * xác nhận file NÀY (workflow) THẬT SỰ là code CỦA VBG (chỉ phục vụ đúng `type='photo'`, guard
 * `cfg.type !== 'video'` ở event/workflow/visual-bg-common.js loại trừ VBG-Video hẳn) — KHÁC
 * `core/motion-engine.js` (hàm thuần, thật sự trung lập, dùng chung với Player Display Settings) và
 * KHÁC `motionEngineReactLayer`/`#visual-motion-react` (DOM dùng chung thật với Video Player mode,
 * GIỮ NGUYÊN tên, KHÔNG đổi) — từ `event/workflow/motion-engine.js`/`workflowMotionEngine` sang
 * tên NÀY/`workflowVisualBgPhotoMotion`, kèm 5 biến DOM VBG-Photo-exclusive (container/players/
 * layer1,2/layer1,2Pan — xem core/dom-refs.js) đổi prefix `motionEngine*` -> `visualBgPhotoMotion*`.
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (findMotionPresetById()/isReactBeatPresetActive() — dùng ở
 * livePointMoveToggle()/_getBeatReactPreset()), event/workflow/motion-beat-react-runner.js
 * (createMotionBeatReactRunner()), event/workflow/motion-point-move-runner.js
 * (createMotionPointMoveRunner()), event/workflow/motion-transition-runner.js
 * (createMotionTransitionRunner()), core/dom-refs.js (visualBgPhotoMotionContainer/
 * visualBgPhotoMotionPointMoveWrapper/visualBgPhotoMotionLayer1,2/visualBgPhotoMotionLayer1,2Pan/
 * motionEngineReactLayer — biến CUỐI GIỮ NGUYÊN tên, dùng chung với Player Display Settings).
 * service/task-manager.js — CHỈ còn dùng cho `_thumbFullBlobDecode`-style chờ gì đó CỦA RIÊNG file
 * này nếu có (hiện KHÔNG dùng trực tiếp — cả 3 mảng React Beat/Point Move/Transition đều nằm HẲN
 * trong Runner riêng của chúng). KHÔNG còn phụ thuộc service/db.js — Engine không tự đọc record nữa.
 */

const workflowVisualBgPhotoMotion = {
    _stageToken: 0, // token mượn workflowMotionStage — 0 = chưa mượn
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2
    _hasCurrentResource: false, // đang giữ/hiện 1 ảnh hay chưa — QUYẾT ĐỊNH hiện tĩnh hay transition
    _currentObjectUrl: null, // object URL ẢNH ĐANG HIỆN — SỞ HỮU của surface (tự revoke)
    _getBeatPresetFn: null, // getter preset React Beat của nơi tiêu thụ ĐANG dùng (lượt showImage() gần nhất)
    _owner: null, // chuỗi MỜ của nơi tiêu thụ đang giữ ảnh hiện tại (ĐỢT 3) — chỉ so bằng, không hiểu nghĩa

    _currentLayer() { return this._layerToggle ? visualBgPhotoMotionLayer2 : visualBgPhotoMotionLayer1; },
    _idleLayer() { return this._layerToggle ? visualBgPhotoMotionLayer1 : visualBgPhotoMotionLayer2; },
    _currentPanLayer() { return this._layerToggle ? visualBgPhotoMotionLayer2Pan : visualBgPhotoMotionLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? visualBgPhotoMotionLayer1Pan : visualBgPhotoMotionLayer2Pan; },

    /** Chuẩn hoá options của showImage() — preset thiếu -> MOTION_ENGINE_NO_OP_PRESET (core/motion-presets.js). */
    _normalizeOptions(options) {
        const o = options || {};
        const advanceMs = o.advanceMs || 0;
        return {
            transitionPreset: o.transitionPreset || MOTION_ENGINE_NO_OP_PRESET,
            pointMovePreset: o.pointMovePreset || MOTION_ENGINE_NO_OP_PRESET,
            advanceMs,
            transitionCapMs: typeof o.transitionCapMs === 'number' ? o.transitionCapMs : advanceMs,
            backgroundSize: o.backgroundSize || '',
            getBeatPresetFn: typeof o.getBeatPresetFn === 'function' ? o.getBeatPresetFn : null,
            onShown: typeof o.onShown === 'function' ? o.onShown : null,
        };
    },

    /** Public — `owner` đang giữ 1 ảnh hiện trên surface (và Stage chưa bị bên khác thay ca) hay không.
     * Nơi tiêu thụ dùng để TỰ biết lượt showImage() kế tiếp sẽ là transition hay hiện tĩnh.
     * @param {string} owner @returns {boolean} */
    hasContent(owner) {
        return this._hasCurrentResource && this._owner === owner && workflowMotionStage.isCurrent(this._stageToken); // event/workflow/motion-stage.js
    },

    /** Public — ĐIỂM VÀO DUY NHẤT để hiện 1 ảnh. `objectUrl` rỗng/null -> `stop()`. Surface TỰ QUYẾT hiện
     * tĩnh (chưa có ảnh / owner khác / Stage đã bị bên khác thay ca) hay transition.
     * @param {string|null} objectUrl - surface nhận ownership NGAY (giữ/revoke), nơi gọi không revoke lại.
     * @param {{owner?:string, transitionPreset?:object, pointMovePreset?:object, advanceMs?:number,
     *          transitionCapMs?:number, backgroundSize?:string, getBeatPresetFn?:() => (object|null),
     *          onShown?:() => void}} [options] */
    async showImage(objectUrl, options) {
        if (!objectUrl) { this.stop(); return; }
        const opts = this._normalizeOptions(options);
        const owner = (options && options.owner) || null;
        if (this.hasContent(owner)) { this._getBeatPresetFn = opts.getBeatPresetFn; this._showNext(objectUrl, opts); return; }
        this._staticReveal(objectUrl, opts, owner);
    },

    /** Public — đổi preset Point Move cho ẢNH ĐANG HIỆN tại chỗ (không đổi ảnh, không transition) + đồng bộ
     * lại React Beat (getter của nơi tiêu thụ tự tra preset mới). No-op nếu `owner` không đang giữ ảnh.
     * @param {string} owner @param {object} pointMovePreset @param {number} advanceMs */
    updatePreset(owner, pointMovePreset, advanceMs) {
        if (!this.hasContent(owner)) return;
        workflowMotionStage.activatePointMoveForPresetChange(this._stageToken, pointMovePreset || MOTION_ENGINE_NO_OP_PRESET, advanceMs); // event/workflow/motion-stage.js
        workflowMotionStage.syncBeat(this._stageToken);
    },

    /** Public — chạy LẠI hành trình Point Move từ đầu cho ảnh ĐANG hiện (vd Player tua về 0).
     * @param {string} owner @param {object} pointMovePreset @param {number} advanceMs */
    restartPointMove(owner, pointMovePreset, advanceMs) {
        if (!this.hasContent(owner)) return;
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, pointMovePreset || MOTION_ENGINE_NO_OP_PRESET, advanceMs); // event/workflow/motion-stage.js
    },

    /** Public — đổi `background-size` của ảnh ĐANG hiện (vd Player đổi Resolution sống).
     * @param {string} owner @param {string} backgroundSize - '' = mặc định CSS */
    updateBackgroundSize(owner, backgroundSize) {
        if (!this.hasContent(owner)) return;
        const panEl = this._currentPanLayer();
        if (panEl) panEl.style.backgroundSize = backgroundSize || '';
    },

    /** Internal — hiện ảnh ĐẦU tĩnh + MƯỢN Stage (không có gì để transition TỪ). */
    _staticReveal(objectUrl, opts, owner) {
        this.stop();
        this._getBeatPresetFn = opts.getBeatPresetFn; // stop() vừa xoá — gán lại
        this._owner = owner;
        setMotionEngineContainerVisible(visualBgPhotoMotionContainer, true); // core
        this._currentObjectUrl = objectUrl;
        const panEl = this._currentPanLayer();
        const layerEl = this._currentLayer();
        setMotionEngineLayerImage(panEl, objectUrl); // core
        if (panEl) panEl.style.backgroundSize = opts.backgroundSize;
        if (layerEl) layerEl.classList.add('me-current');
        this._stageToken = workflowMotionStage.acquire({ // event/workflow/motion-stage.js
            getPointMoveTargetFn: () => visualBgPhotoMotionPointMoveWrapper, // core/dom-refs.js
            getBeatPresetFn: () => (this._getBeatPresetFn ? this._getBeatPresetFn() : null),
        });
        this._hasCurrentResource = true;
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, opts.pointMovePreset, opts.advanceMs);
        workflowMotionStage.syncBeat(this._stageToken);
        if (opts.onShown) opts.onShown(); // hiện tĩnh = hiện TRỌN ngay
    },

    /** Internal — CHUYỂN sang ảnh mới: gán nội dung layer đích TRƯỚC, rồi Stage chạy Transition; surface tự
     * dọn layer nguồn + revoke URL cũ trong `onSettle`. */
    _showNext(objectUrl, opts) {
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setMotionEngineLayerImage(incomingPan, objectUrl); // core
        if (incomingPan) incomingPan.style.backgroundSize = opts.backgroundSize;
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, opts.pointMovePreset, opts.advanceMs); // event/workflow/motion-stage.js

        const staleUrl = this._currentObjectUrl; // capture LOCAL — lượt SAU có thể ghi đè field trước khi onSettle chạy
        workflowMotionStage.runTransition(
            this._stageToken, visualBgPhotoMotionContainer, outgoingLayer, incomingLayer, opts.transitionPreset, opts.transitionCapMs,
            () => { // onSettle — layer nguồn xong việc
                setMotionEngineLayerImage(outgoingPan, ''); // core
                if (outgoingPan) outgoingPan.style.backgroundSize = '';
                if (staleUrl) { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }
                if (opts.onShown) opts.onShown(); // Transition xong (hoặc bị lượt sau/stop() cắt ngang — nơi tiêu thụ tự guard thế hệ)
            },
        );

        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;
        workflowMotionStage.syncBeat(this._stageToken);
    },

    /** Đóng băng Point Move + React Beat tại chỗ — nơi tiêu thụ tự quyết lúc nào. No-op nếu sai owner.
     * @param {string} owner */
    pause(owner) { if (this.hasContent(owner)) workflowMotionStage.pause(this._stageToken); }, // event/workflow/motion-stage.js
    /** @param {string} owner */
    resume(owner) { if (this.hasContent(owner)) workflowMotionStage.resume(this._stageToken); },

    /** Dừng hẳn — trả Stage (Transition dở dang tự gọi onSettle), dọn layer/URL/state của surface. */
    stop() {
        workflowMotionStage.release(this._stageToken); // event/workflow/motion-stage.js — no-op nếu đã bị thay ca
        this._stageToken = 0;
        setMotionEngineContainerVisible(visualBgPhotoMotionContainer, false); // core
        [[visualBgPhotoMotionLayer1, visualBgPhotoMotionLayer1Pan], [visualBgPhotoMotionLayer2, visualBgPhotoMotionLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
            if (panEl) panEl.style.backgroundSize = '';
            resetMotionEngineLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._hasCurrentResource = false;
        this._getBeatPresetFn = null;
        this._owner = null;
    },
};
