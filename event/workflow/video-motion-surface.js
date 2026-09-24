/**
 * event/workflow/video-motion-surface.js — "VIDEO SURFACE": tầng 2 "bề mặt media" cho nội dung VIDEO A/B,
 * DÙNG CHUNG cho mọi nơi tiêu thụ nội dung video nền (hiện: Player Video; kế tiếp — đợt 5: VBG Video).
 * MỚI (25/09/2026, đợt 4 — Giang duyệt mô hình 3 tầng: Motion (cơ chế) -> Bề mặt media -> Nơi tiêu thụ).
 *
 * NGUYÊN TẮC TUA VÍT: file này NẰM NGOÀI domain Motion — biết nội dung là video A/B (layer A = `bgVideoElement`
 * bọc trong `videoPlayerMotionPointMoveElement`, layer B = `visualBgImageElement` làm cầu nối thumb full-res),
 * nhưng KHÔNG biết ai dùng nó: không tra preset, không tính thời lượng, không hẹn giờ, không biết VBG/Player.
 * Mọi quyết định (preset nào, advanceMs bao nhiêu, React Beat lấy preset gì, tốc độ) do nơi tiêu thụ truyền vào.
 *
 * GOM về đây (trước nằm rải ở event/workflow/player-display-settings.js — 3 Runner RIÊNG của Player Video):
 *   - Mượn `workflowMotionStage` (event/workflow/motion-stage.js) — 3 Runner giờ là của Stage, KHÔNG còn bộ
 *     Runner riêng nào cho video (hết rủi ro 2 bộ Runner cùng ghi transform lên `motionEngineReactLayer`).
 *   - Gắn/gỡ cấu trúc DOM A/B vào `motionEngineReactLayer` (`attachVideoPlayerMotionToSharedReactLayer()`/
 *     `detachVideoPlayerMotionFromSharedReactLayer()`, core/player-display-apply.js — GIỮ NGUYÊN tên, Giang
 *     chốt không đổi tên) — gắn lúc `acquire()`, gỡ lúc `release()`.
 *   - Transition giữa layer A (frame đóng băng) và layer B (thumb mới) — container `motionEngineReactLayer`.
 *
 * `owner` — chuỗi MỜ do nơi tiêu thụ tự đặt, surface chỉ so bằng (CÙNG khuôn Image surface): mọi lệnh sai
 * owner -> no-op, chặn chéo giữa các nơi tiêu thụ luân phiên dùng chung DOM.
 *
 * Phần CƠ CHẾ ĐỔI NGUỒN video (pause frame cũ -> decode thumb full-res vào layer B -> [Transition] -> ẩn A ->
 * gán src -> hiện lại khi 'playing') VẪN ở `workflowVideoPlayer.swapBgVideoSource()` (event/workflow/video-
 * player.js) — hàm đó giờ nhận HOOK (`runTransition`/`onLayerBFilled`) do nơi gọi truyền, KHÔNG còn tự rẽ nhánh
 * Player hay gọi thẳng workflowPlayerDisplaySettings cho phần Motion.
 *
 * NẠP SAU: core/player-display-apply.js, core/dom-refs.js. Gọi `workflowMotionStage` lúc chạy.
 */

const workflowVideoMotionSurface = {
    _stageToken: 0,       // token mượn workflowMotionStage — 0 = chưa mượn
    _owner: null,         // chuỗi MỜ của nơi tiêu thụ đang giữ surface
    _getBeatPresetFn: null,
    _getBeatSpeedFn: null,

    /** Nơi tiêu thụ `owner` đang giữ surface (và Stage chưa bị bên khác thay ca) hay không.
     * @param {string} owner @returns {boolean} */
    hasLease(owner) {
        return !!owner && this._owner === owner && workflowMotionStage.isCurrent(this._stageToken); // event/workflow/motion-stage.js
    },

    /** Mượn surface: gắn DOM A/B vào lớp React Beat + mượn Stage. Cùng owner gọi lại -> chỉ cập nhật getter.
     * Owner KHÁC đang giữ -> trả hộ trước (dừng Runner + gỡ DOM) rồi mới giao cho owner mới.
     * @param {string} owner @param {{getBeatPresetFn?: () => (object|null), getBeatSpeedFn?: () => number}} [config] */
    acquire(owner, config) {
        const c = config || {};
        this._getBeatPresetFn = typeof c.getBeatPresetFn === 'function' ? c.getBeatPresetFn : null;
        this._getBeatSpeedFn = typeof c.getBeatSpeedFn === 'function' ? c.getBeatSpeedFn : null;
        if (this.hasLease(owner)) return;
        if (this._owner) this.release(this._owner);
        attachVideoPlayerMotionToSharedReactLayer(); // core/player-display-apply.js
        this._stageToken = workflowMotionStage.acquire({ // event/workflow/motion-stage.js
            getPointMoveTargetFn: () => videoPlayerMotionPointMoveElement, // core/dom-refs.js
            getBeatPresetFn: () => (this._getBeatPresetFn ? this._getBeatPresetFn() : null),
            getBeatSpeedFn: () => (this._getBeatSpeedFn ? this._getBeatSpeedFn() : 1),
        });
        this._owner = owner;
    },

    /** Trả surface: dừng sạch Runner (Transition dở dang tự settle -> Promise của runTransition() resolve) + trả
     * DOM A/B về vị trí "nhà". No-op nếu `owner` không phải bên đang giữ. @param {string} owner */
    release(owner) {
        if (!owner || this._owner !== owner) return;
        workflowMotionStage.release(this._stageToken); // event/workflow/motion-stage.js — no-op nếu đã bị thay ca
        detachVideoPlayerMotionFromSharedReactLayer(); // core/player-display-apply.js
        this._stageToken = 0;
        this._owner = null;
        this._getBeatPresetFn = null;
        this._getBeatSpeedFn = null;
    },

    /** Transition giữa layer A (`bgVideoElement`, đang đứng hình frame CŨ) và layer B (`visualBgImageElement`,
     * VỪA nhận thumb MỚI) — nơi gọi tự lo NỘI DUNG 2 layer trước/sau (surface không đụng). Sai owner -> resolve
     * ngay (coi như cắt cứng, không chặn luồng đổi nguồn).
     * @param {string} owner @param {object} preset @param {number} capMs - 0 = không kẹp
     * @returns {Promise<void>} resolve khi layer A "xong việc" */
    runTransition(owner, preset, capMs) {
        if (!this.hasLease(owner)) return Promise.resolve();
        return new Promise((resolve) => {
            const started = workflowMotionStage.runTransition( // event/workflow/motion-stage.js
                this._stageToken, motionEngineReactLayer, bgVideoElement, visualBgImageElement, // core/dom-refs.js — container, outgoing (A), incoming (B)
                preset || MOTION_ENGINE_NO_OP_PRESET, capMs, resolve, // core/motion-presets.js
            );
            if (!started) resolve();
        });
    },

    /** Point Move cho video MỚI / chạy LẠI hành trình từ đầu (vd vòng lặp mới).
     * @param {string} owner @param {object} preset @param {number} advanceMs */
    activatePointMoveForNewContent(owner, preset, advanceMs) {
        if (!this.hasLease(owner)) return;
        workflowMotionStage.activatePointMoveForNewContent(this._stageToken, preset || MOTION_ENGINE_NO_OP_PRESET, advanceMs);
    },

    /** Point Move đổi preset/thời lượng cho video ĐANG phát (không ghi lại mốc "bắt đầu hiện").
     * @param {string} owner @param {object} preset @param {number} advanceMs */
    activatePointMoveForPresetChange(owner, preset, advanceMs) {
        if (!this.hasLease(owner)) return;
        workflowMotionStage.activatePointMoveForPresetChange(this._stageToken, preset || MOTION_ENGINE_NO_OP_PRESET, advanceMs);
    },

    /** React Beat tự tra lại preset qua getter của owner. @param {string} owner */
    syncBeat(owner) {
        if (!this.hasLease(owner)) return;
        workflowMotionStage.syncBeat(this._stageToken);
    },

    /** @param {string} owner */
    pause(owner) {
        if (!this.hasLease(owner)) return;
        workflowMotionStage.pause(this._stageToken);
    },

    /** @param {string} owner */
    resume(owner) {
        if (!this.hasLease(owner)) return;
        workflowMotionStage.resume(this._stageToken);
    },
};
