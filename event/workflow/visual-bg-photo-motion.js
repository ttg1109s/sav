/**
 * event/workflow/visual-bg-photo-motion.js — "Image surface": bề mặt hiện ẢNH A/B (2 layer luân phiên, `background-image`)
 * dùng chung cho mọi nơi tiêu thụ nội dung ảnh (VBG Photo, Player Photo). Biết nội dung là ảnh (giữ + revoke object URL)
 * nhưng không biết ai dùng: không tra preset, không hẹn giờ, không biết `source.list`. Transition / Point Move / React
 * Beat mượn `workflowMotionStage` (event/workflow/motion-stage.js) qua token.
 *
 *   `showImage(objectUrl, options)` — điểm vào duy nhất: chưa có ảnh / owner khác / Stage đã bị bên khác thay ca -> hiện
 *     TĨNH; còn lại -> Transition. options `{owner, transitionPreset, pointMovePreset, advanceMs, transitionCapMs?,
 *     backgroundSize?, getBeatPresetFn?, onShown?}`; `objectUrl` rỗng = `stop()`. Surface nhận ownership URL ngay.
 *   `updatePreset` / `restartPointMove` / `updateBackgroundSize` / `pause` / `resume` — chỉ tác dụng khi đúng `owner` đang
 *     giữ ảnh (chuỗi mờ do nơi tiêu thụ đặt, chỉ so bằng). `stop()` dọn vô điều kiện (đổi mode — clearMediaLayers()).
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (MOTION_ENGINE_NO_OP_PRESET), event/workflow/motion-stage.js,
 * core/dom-refs.js (visualBgPhotoMotionContainer/PointMoveWrapper/Layer1,2/Layer1,2Pan), service/blob-url.js.
 */

// showImage(): URL rỗng -> dọn; owner đang giữ ảnh -> Transition, còn lại hiện tĩnh.
const IMAGE_SURFACE_SHOW_BY_HAS_URL = {
    true: (objectUrl, options) => workflowVisualBgPhotoMotion._showOwnedImage(objectUrl, options),
    false: () => workflowVisualBgPhotoMotion.stop(),
};
const IMAGE_SURFACE_SHOW_BY_HAS_CONTENT = {
    true: (objectUrl, opts) => workflowVisualBgPhotoMotion._showNext(objectUrl, opts),
    false: (objectUrl, opts, owner) => workflowVisualBgPhotoMotion._staticReveal(objectUrl, opts, owner),
};

const workflowVisualBgPhotoMotion = {
    _stageToken: 0, // token mượn workflowMotionStage — 0 = chưa mượn
    _layerToggle: false, // false = layer1 đang 'current', true = layer2
    _hasCurrentResource: false, // đang giữ 1 ảnh — quyết định hiện tĩnh hay Transition
    _currentObjectUrl: null, // object URL ảnh đang hiện — surface sở hữu, tự revoke
    _getBeatPresetFn: null, // getter preset React Beat của nơi tiêu thụ (lượt showImage() gần nhất)
    _owner: null, // nơi tiêu thụ đang giữ ảnh hiện tại

    _currentLayer() { return this._layerToggle ? visualBgPhotoMotionLayer2 : visualBgPhotoMotionLayer1; },
    _idleLayer() { return this._layerToggle ? visualBgPhotoMotionLayer1 : visualBgPhotoMotionLayer2; },
    _currentPanLayer() { return this._layerToggle ? visualBgPhotoMotionLayer2Pan : visualBgPhotoMotionLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? visualBgPhotoMotionLayer1Pan : visualBgPhotoMotionLayer2Pan; },

    /** Chuẩn hoá options của showImage() — preset thiếu -> MOTION_ENGINE_NO_OP_PRESET, cap Transition mặc định = advanceMs. */
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

    /** `owner` đang giữ ảnh trên surface (và Stage chưa bị bên khác thay ca) — nơi tiêu thụ tự biết lượt kế là Transition
     * hay hiện tĩnh. @param {string} owner @returns {boolean} */
    hasContent(owner) {
        return this._hasCurrentResource && this._owner === owner && workflowMotionStage.isCurrent(this._stageToken); // event/workflow/motion-stage.js
    },

    /** Hiện 1 ảnh (rỗng -> `stop()`). @param {string|null} objectUrl - surface nhận ownership NGAY
     * @param {{owner?:string, transitionPreset?:object, pointMovePreset?:object, advanceMs?:number, transitionCapMs?:number,
     *          backgroundSize?:string, getBeatPresetFn?:() => (object|null), onShown?:() => void}} [options] */
    async showImage(objectUrl, options) {
        IMAGE_SURFACE_SHOW_BY_HAS_URL[!!objectUrl](objectUrl, options);
    },

    _showOwnedImage(objectUrl, options) {
        const opts = this._normalizeOptions(options);
        const owner = (options && options.owner) || null;
        IMAGE_SURFACE_SHOW_BY_HAS_CONTENT[this.hasContent(owner)](objectUrl, opts, owner);
    },

    /** Đổi preset Point Move cho ảnh ĐANG hiện tại chỗ + đồng bộ lại React Beat. No-op nếu sai owner.
     * @param {string} owner @param {object} pointMovePreset @param {number} advanceMs */
    updatePreset(owner, pointMovePreset, advanceMs) {
        if (!this.hasContent(owner)) return;
        workflowMotionStage.activatePointMoveForPresetChange(this._stageToken, pointMovePreset || MOTION_ENGINE_NO_OP_PRESET, advanceMs);
        workflowMotionStage.syncBeat(this._stageToken);
    },

    /** Chạy LẠI Point Move từ đầu cho ảnh đang hiện (Player tua về 0, VBG lặp ảnh đứng yên). No-op nếu sai owner.
     * @param {string} owner @param {object} pointMovePreset @param {number} advanceMs */
    restartPointMove(owner, pointMovePreset, advanceMs) {
        if (!this.hasContent(owner)) return;
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, pointMovePreset || MOTION_ENGINE_NO_OP_PRESET, advanceMs);
    },

    /** Đổi `background-size` của ảnh đang hiện (đổi Resolution sống). @param {string} owner @param {string} backgroundSize */
    updateBackgroundSize(owner, backgroundSize) {
        if (!this.hasContent(owner)) return;
        setMotionEngineLayerBackgroundSize(this._currentPanLayer(), backgroundSize); // core/motion-engine.js
    },

    /** Ảnh ĐẦU hiện tĩnh + mượn Stage (không có gì để Transition từ). */
    _staticReveal(objectUrl, opts, owner) {
        this.stop();
        this._getBeatPresetFn = opts.getBeatPresetFn; // stop() vừa xoá — gán lại
        this._owner = owner;
        setMotionEngineContainerVisible(visualBgPhotoMotionContainer, true); // core/motion-engine.js
        this._currentObjectUrl = objectUrl;
        const panEl = this._currentPanLayer();
        setMotionEngineLayerImage(panEl, objectUrl);
        setMotionEngineLayerBackgroundSize(panEl, opts.backgroundSize);
        markMotionEngineLayerCurrent(this._currentLayer());
        this._stageToken = workflowMotionStage.acquire({
            getPointMoveTargetFn: () => visualBgPhotoMotionPointMoveWrapper, // core/dom-refs.js
            getBeatPresetFn: () => (this._getBeatPresetFn ? this._getBeatPresetFn() : null),
        });
        this._hasCurrentResource = true;
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, opts.pointMovePreset, opts.advanceMs);
        workflowMotionStage.syncBeat(this._stageToken);
        if (opts.onShown) opts.onShown(); // hiện tĩnh = hiện trọn ngay
    },

    /** Chuyển sang ảnh mới: gán layer đích trước, Stage chạy Transition; layer nguồn + URL cũ dọn trong `onSettle`. */
    _showNext(objectUrl, opts) {
        this._getBeatPresetFn = opts.getBeatPresetFn;
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();
        setMotionEngineLayerImage(incomingPan, objectUrl); // core/motion-engine.js
        setMotionEngineLayerBackgroundSize(incomingPan, opts.backgroundSize);
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, opts.pointMovePreset, opts.advanceMs);

        const staleUrl = this._currentObjectUrl; // giữ cục bộ — lượt sau có thể ghi đè field trước khi onSettle chạy
        workflowMotionStage.runTransition(
            this._stageToken, visualBgPhotoMotionContainer, outgoingLayer, incomingLayer, opts.transitionPreset, opts.transitionCapMs,
            () => this._settleOutgoing(outgoingPan, staleUrl, opts.onShown),
        );
        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;
        workflowMotionStage.syncBeat(this._stageToken);
    },

    /** Layer nguồn xong việc (Transition xong, hoặc bị lượt sau/stop() cắt ngang — nơi tiêu thụ tự guard thế hệ). */
    _settleOutgoing(outgoingPan, staleUrl, onShown) {
        setMotionEngineLayerImage(outgoingPan, ''); // core/motion-engine.js
        setMotionEngineLayerBackgroundSize(outgoingPan, '');
        if (staleUrl) revokeBlobUrl(staleUrl); // service/blob-url.js
        if (onShown) onShown();
    },

    /** Đóng băng Point Move + React Beat tại chỗ. No-op nếu sai owner. @param {string} owner */
    pause(owner) { if (this.hasContent(owner)) workflowMotionStage.pause(this._stageToken); },
    /** @param {string} owner */
    resume(owner) { if (this.hasContent(owner)) workflowMotionStage.resume(this._stageToken); },

    /** Dừng hẳn — trả Stage (Transition dở tự gọi onSettle), dọn layer/URL/state. */
    stop() {
        workflowMotionStage.release(this._stageToken); // no-op nếu đã bị thay ca
        this._stageToken = 0;
        setMotionEngineContainerVisible(visualBgPhotoMotionContainer, false); // core/motion-engine.js
        [[visualBgPhotoMotionLayer1, visualBgPhotoMotionLayer1Pan], [visualBgPhotoMotionLayer2, visualBgPhotoMotionLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, '');
            setMotionEngineLayerBackgroundSize(panEl, '');
            resetMotionEngineLayerClasses(layerEl);
        });
        if (this._currentObjectUrl) revokeBlobUrl(this._currentObjectUrl);
        this._currentObjectUrl = null;
        this._hasCurrentResource = false;
        this._getBeatPresetFn = null;
        this._owner = null;
    },
};
