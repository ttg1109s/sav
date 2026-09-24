/**
 * event/workflow/motion-stage.js — "Motion Stage": HOST DÙNG CHUNG gói 3 Runner Motion (Transition/
 * Point Move/React Beat) cho ĐÚNG 1 bề mặt render ĐANG hoạt động. MỚI (25/09/2026, Giang duyệt mô hình
 * 3 tầng: Motion (cơ chế) -> Bề mặt media (theo loại nội dung) -> Nơi tiêu thụ (quyết định)).
 *
 * NGUYÊN TẮC TUA VÍT (Giang — áp cho MỌI việc về Motion): Stage là CÁI TUA VÍT — chỉ cung cấp cơ chế,
 * KHÔNG biết/không quan tâm ai đang dùng, dùng vào việc gì. Stage KHÔNG biết nội dung (ảnh/video),
 * KHÔNG biết nơi tiêu thụ (VBG/Player), KHÔNG tự tra preset, KHÔNG tự hẹn giờ — mọi thứ đó do bên gọi
 * truyền vào (element, preset, advanceMs, getter preset React Beat/tốc độ).
 *
 * VÌ SAO CẦN — 4 nơi tiêu thụ Motion (VBG Photo, VBG Video, Player Photo, Player Video) dùng CHUNG
 * `motionEngineReactLayer` (React Beat) và luân phiên nhau dùng các wrapper Point Move, nhưng tại 1 thời
 * điểm CHỈ có ĐÚNG 1 nơi hoạt động (Song -> VBG; Video Player mode -> Player Video; Photo Player mode ->
 * Player Photo). Stage SỞ HỮU 3 Runner (không phải nơi tiêu thụ sở hữu) + cơ chế MƯỢN (lease) có token
 * thế hệ -> loại HẲN rủi ro 2 bộ Runner cùng ghi `transform` lên 1 element, và mọi lệnh từ bên đã bị
 * "thay ca" (token cũ, vd callback async về muộn) TỰ BỊ BỎ QUA.
 *
 * Luồng dùng:
 *   `const token = workflowMotionStage.acquire({ getPointMoveTargetFn, getBeatPresetFn, getBeatSpeedFn })`
 *     — dừng sạch MỌI Runner của bên mượn TRƯỚC (trả transform về gốc trên ĐÚNG target cũ), rồi mới
 *     đổi sang bên mới.
 *   Mọi lệnh sau đều kèm `token` — sai token -> no-op (trả false).
 *   `release(token)` — dừng sạch + trả Stage.
 *
 * NẠP SAU: event/workflow/motion-transition-runner.js, motion-point-move-runner.js,
 * motion-beat-react-runner.js (factory), core/dom-refs.js (motionEngineReactLayer).
 * NẠP TRƯỚC: không bắt buộc — mọi nơi dùng đều gọi lúc chạy (event/workflow/visual-bg-photo-motion.js
 * nạp TRƯỚC file này nhưng chỉ gọi `workflowMotionStage` bên trong hàm).
 */

// Tên task — DỜI NGUYÊN từ event/workflow/visual-bg-photo-motion.js (25/09/2026), GIỮ NGUYÊN chuỗi cũ,
// không đổi cách debug taskManager.plan[...].
const MOTION_ENGINE_BEATREACT_TASK = 'motionEngineBeatReactTick';
const MOTION_ENGINE_TRANSITION_CLEANUP_TASK = 'motionEngineTransitionCleanup';

const workflowMotionStage = {
    _leaseCounter: 0,
    _lease: null, // {token, getPointMoveTargetFn, getBeatPresetFn, getBeatSpeedFn} — null = không ai mượn
    _transitionRunner: null, // tạo LƯỜI — _ensureRunners()
    _pointMoveRunner: null,
    _beatReactRunner: null,

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) 3 Runner — target/preset/tốc độ đều đọc QUA `_lease` hiện hành (getter,
     * KHÔNG cache cứng), nên đổi bên mượn KHÔNG cần tạo lại Runner. */
    _ensureRunners() {
        if (this._transitionRunner) return;
        this._transitionRunner = createMotionTransitionRunner(MOTION_ENGINE_TRANSITION_CLEANUP_TASK); // event/workflow/motion-transition-runner.js
        this._pointMoveRunner = createMotionPointMoveRunner(() => (this._lease ? this._lease.getPointMoveTargetFn() : null)); // event/workflow/motion-point-move-runner.js
        this._beatReactRunner = createMotionBeatReactRunner( // event/workflow/motion-beat-react-runner.js
            MOTION_ENGINE_BEATREACT_TASK,
            () => motionEngineReactLayer, // core/dom-refs.js — lớp React Beat DÙNG CHUNG cho mọi nơi tiêu thụ
            () => (this._lease ? this._lease.getBeatPresetFn() : null),
            () => (this._lease && this._lease.getBeatSpeedFn ? this._lease.getBeatSpeedFn() : 1),
        );
    },

    /** Dừng HẲN cả 3 Runner — gọi TRƯỚC khi đổi/trả `_lease` (Point Move cần target CŨ để trả transform về gốc). */
    _stopRunners() {
        if (!this._transitionRunner) return;
        this._transitionRunner.stop();
        this._pointMoveRunner.stop();
        this._beatReactRunner.stop();
    },

    /** Mượn Stage — bên đang mượn (nếu có) bị thay ca: Runner dừng sạch, token cũ hết hiệu lực.
     * @param {{getPointMoveTargetFn: () => (HTMLElement|null), getBeatPresetFn?: () => (object|null), getBeatSpeedFn?: () => number}} config
     * @returns {number} token */
    acquire(config) {
        this._ensureRunners();
        this._stopRunners();
        this._leaseCounter += 1;
        this._lease = {
            token: this._leaseCounter,
            getPointMoveTargetFn: config.getPointMoveTargetFn,
            getBeatPresetFn: config.getBeatPresetFn || (() => null),
            getBeatSpeedFn: config.getBeatSpeedFn || null,
        };
        return this._leaseCounter;
    },

    /** Trả Stage — no-op nếu token đã bị thay ca (bên sau đang dùng, không được dừng hộ). @param {number} token */
    release(token) {
        if (!this.isCurrent(token)) return;
        this._stopRunners();
        this._lease = null;
    },

    /** @param {number} token @returns {boolean} */
    isCurrent(token) {
        return !!this._lease && this._lease.token === token;
    },

    /** Transition giữa 2 layer do BÊN GỌI chọn — Stage không biết layer chứa gì (xem nguyên tắc Runner).
     * @param {number} token @param {HTMLElement} containerEl @param {HTMLElement} outgoingEl
     * @param {HTMLElement} incomingEl @param {object} preset @param {number} capMs - kẹp thời lượng
     * (0 = không kẹp) @param {() => void} [onSettle] @returns {boolean} false nếu token hết hiệu lực */
    runTransition(token, containerEl, outgoingEl, incomingEl, preset, capMs, onSettle) {
        if (!this.isCurrent(token)) return false;
        this._transitionRunner.runTransition(containerEl, outgoingEl, incomingEl, preset, capMs, onSettle);
        return true;
    },

    /** Point Move cho nội dung MỚI (ghi lại mốc "bắt đầu hiện"). Cũng dùng khi nơi tiêu thụ muốn chạy
     * LẠI hành trình từ đầu (tua về 0 / video lặp vòng mới).
     * @param {number} token @param {object} preset @param {number} advanceMs @returns {boolean} */
    activatePointMoveForNewContent(token, preset, advanceMs) {
        if (!this.isCurrent(token)) return false;
        this._pointMoveRunner.activateForNewContent(preset, advanceMs);
        return true;
    },

    /** Point Move đổi preset/thời lượng cho nội dung ĐANG hiện (không ghi lại mốc).
     * @param {number} token @param {object} preset @param {number} advanceMs @returns {boolean} */
    activatePointMoveForPresetChange(token, preset, advanceMs) {
        if (!this.isCurrent(token)) return false;
        this._pointMoveRunner.activateForPresetChange(preset, advanceMs);
        return true;
    },

    /** React Beat tự tra lại preset qua `getBeatPresetFn` của bên mượn. @param {number} token */
    syncBeat(token) {
        if (!this.isCurrent(token)) return;
        this._beatReactRunner.sync();
    },

    /** Đóng băng Point Move + React Beat tại chỗ (Transition là CSS 1 lần, tự hoàn tất). @param {number} token */
    pause(token) {
        if (!this.isCurrent(token)) return;
        this._pointMoveRunner.pause();
        this._beatReactRunner.pause();
    },

    /** @param {number} token */
    resume(token) {
        if (!this.isCurrent(token)) return;
        this._pointMoveRunner.resume();
        this._beatReactRunner.resume();
    },
};
