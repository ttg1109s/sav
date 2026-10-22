/**
 * event/workflow/motion-transition-runner.js — Transition Runner dùng chung mọi nơi tiêu thụ (VBG Photo, Video/Photo Player):
 * cơ chế thuần (nguyên tắc tua vít) — chỉ chạy 1 lượt chuyển cảnh giữa 2 layer bất kỳ, KHÔNG đụng nội dung bên trong layer,
 * không giữ tham chiếu layer giữa các lần gọi, không biết "ảnh"/"video" là gì. Nơi gọi tự gán nội dung `incomingEl` TRƯỚC
 * khi gọi, tự dọn nội dung `outgoingEl` trong `onSettle()`, tự giữ "layer nào đang current".
 *
 * Runner giữ bộ nhớ "hướng lượt trước" riêng cho 5 field hướng (tránh lặp khi field là 'random') + lượt dọn đang treo.
 * Tính toán: core/motion-engine.js + core/motion-runner.js.
 *
 * NẠP SAU: core/motion-engine.js, core/motion-runner.js, core/motion-presets.js (5 bộ hướng), service/task-manager.js.
 *
 * @param {string} taskName - tên task taskManager.once() dọn sau transition — duy nhất theo nơi tiêu thụ.
 * @returns {{runTransition: (containerEl: HTMLElement, outgoingEl: HTMLElement, incomingEl: HTMLElement, preset: object,
 *            advanceMs: number, onSettle?: () => void) => number, stop: () => void}}
 */

/** Thời lượng in/out theo kiểu Transition: có tỉ lệ in/out riêng hay 2 layer cùng thời lượng. */
const MOTION_TRANSITION_IN_OUT_BY_RATIO_SUPPORT = {
    true: (totalMs, ratioPercent) => computeMotionEngineTransitionInOutMs(totalMs, ratioPercent), // core/motion-engine.js
    false: (totalMs) => computeMotionTransitionUniformMs(totalMs), // core/motion-runner.js
};

/** 1 lượt: cắt cứng (Transition tắt) hay chạy animation. */
const MOTION_TRANSITION_RUN_BY_ENABLED = {
    false: (ops, args) => ops.hardCut(args),
    true: (ops, args) => ops.animate(args),
};

function createMotionTransitionRunner(taskName) {
    // Hướng dùng ở lượt trước — field 'random' chọn khác lượt liền trước.
    let lastTransitionDirection = null;
    let lastTransitionZoomDirection = null;
    let lastTransitionSpinDirection = null;
    let lastTransitionWipeDirection = null;
    let lastTransitionCurtainDirection = null;
    // {outgoingEl, incomingEl, onSettle} của lượt gần nhất còn chờ task dọn tới hẹn — null nếu đã settle.
    let pendingCleanup = null;

    /** Resolve 5 field hướng của `preset` ('random' -> 1 giá trị cụ thể khác lượt trước) và nhớ lại cho lượt sau. */
    function _resolveTransitionDirections(preset) {
        const direction = resolveMotionEngineTransitionOption(preset.transitionDirection, MOTION_ENGINE_TRANSITION_DIRECTIONS, lastTransitionDirection); // core/motion-engine.js
        const zoomDirection = resolveMotionEngineTransitionOption(preset.transitionZoomDirection, MOTION_ENGINE_ZOOM_DIRECTIONS, lastTransitionZoomDirection);
        const spinDirection = resolveMotionEngineTransitionOption(preset.transitionSpinDirection, MOTION_ENGINE_SPIN_DIRECTIONS, lastTransitionSpinDirection);
        const wipeDirection = resolveMotionEngineTransitionOption(preset.transitionWipeDirection, MOTION_ENGINE_WIPE_DIRECTIONS, lastTransitionWipeDirection);
        const curtainDirection = resolveMotionEngineTransitionOption(preset.transitionCurtainDirection, MOTION_ENGINE_CURTAIN_DIRECTIONS, lastTransitionCurtainDirection);
        lastTransitionDirection = direction;
        lastTransitionZoomDirection = zoomDirection;
        lastTransitionSpinDirection = spinDirection;
        lastTransitionWipeDirection = wipeDirection;
        lastTransitionCurtainDirection = curtainDirection;
        return { direction, zoomDirection, spinDirection, wipeDirection, curtainDirection };
    }

    /** Lượt trước còn treo -> dọn NGAY (đầu `runTransition()`: layer đích luôn sạch, không chồng exit cũ + enter mới). */
    function _settlePending() {
        if (!pendingCleanup) return;
        taskManager.kill(taskName); // service/task-manager.js
        const { outgoingEl, incomingEl, onSettle } = pendingCleanup;
        finishMotionEngineTransitionVisuals(outgoingEl, incomingEl); // core/motion-engine.js — chỉ đổi class
        pendingCleanup = null;
        if (onSettle) onSettle();
    }

    const ops = {
        /** Transition tắt: thẳng tới trạng thái nghỉ, không animation. @returns {number} 0 */
        hardCut({ outgoingEl, incomingEl, onSettle }) {
            cutMotionEngineLayers(outgoingEl, incomingEl); // core/motion-runner.js
            if (onSettle) onSettle();
            return 0;
        },

        /** Đặt kiểu/hướng lên container, thời lượng + class lên 2 layer cho CSS animation chạy, hẹn task dọn. @returns {number} */
        animate({ containerEl, outgoingEl, incomingEl, preset, advanceMs, onSettle }) {
            setMotionEngineTransitionType(containerEl, preset.transitionType); // core/motion-engine.js
            setMotionEngineEdgeFlipOptions(containerEl, preset.edgeFlipVariant, preset.edgeFlipStaticOld);
            const dirs = _resolveTransitionDirections(preset);
            setMotionEngineTransitionDirections(containerEl, dirs.direction, dirs.zoomDirection, dirs.spinDirection, dirs.wipeDirection, dirs.curtainDirection);
            const totalMs = resolveMotionTransitionTotalMs(preset.transitionDurationMs, advanceMs); // core/motion-runner.js
            const inOutMs = MOTION_TRANSITION_IN_OUT_BY_RATIO_SUPPORT[transitionSupportsInOutRatio(preset.transitionType)](totalMs, preset.transitionInOutRatio); // core/motion-engine.js
            setMotionEngineTransitionTiming(incomingEl, inOutMs.inMs, preset.transitionEasing);
            setMotionEngineTransitionTiming(outgoingEl, inOutMs.outMs, preset.transitionEasing);
            startMotionEngineTransitionVisuals(outgoingEl, incomingEl);
            const settleMs = computeMotionTransitionSettleMs(inOutMs); // core/motion-runner.js
            pendingCleanup = { outgoingEl, incomingEl, onSettle }; // _settlePending() đọc nếu lượt KẾ tới trước hẹn
            taskManager.once(() => { // service/task-manager.js
                finishMotionEngineTransitionVisuals(outgoingEl, incomingEl); // core/motion-engine.js
                pendingCleanup = null;
                if (onSettle) onSettle();
            }, settleMs, taskName);
            return settleMs;
        },
    };

    /**
     * Chạy 1 lượt Transition (cắt cứng nếu `preset.transitionEnabled` tắt) `outgoingEl` -> `incomingEl`.
     * @param {HTMLElement} containerEl - nhận data-transition/hướng (của nơi gọi, có thể đổi giữa các lượt)
     * @param {HTMLElement} outgoingEl @param {HTMLElement} incomingEl @param {object} preset
     * @param {number} advanceMs - thời lượng hiển thị sau khi `incomingEl` thành current (kẹp thời lượng transition)
     * @param {() => void} [onSettle] - gọi đúng 1 lần khi `outgoingEl` xong việc (có thể tái dùng/dọn/gán nội dung mới)
     * @returns {number} thời lượng thật của lượt (ms, = mốc onSettle); 0 = cắt cứng — nơi gọi đồng bộ việc khác theo đúng
     *          Transition (vd React Beat nhả về baseline)
     */
    function runTransition(containerEl, outgoingEl, incomingEl, preset, advanceMs, onSettle) {
        _settlePending();
        return MOTION_TRANSITION_RUN_BY_ENABLED[Boolean(preset.transitionEnabled)](ops, { containerEl, outgoingEl, incomingEl, preset, advanceMs, onSettle });
    }

    /** Dừng hẳn — huỷ task dọn còn treo (gọi `onSettle` ngay để nơi gọi kịp dọn nội dung dở dang) + quên hướng đã dùng.
     * Không đụng class/nội dung layer — nơi gọi tự dọn (thường `resetMotionEngineLayerClasses()`, core/motion-engine.js). */
    function stop() {
        if (pendingCleanup) {
            taskManager.kill(taskName); // service/task-manager.js
            const { onSettle } = pendingCleanup;
            pendingCleanup = null;
            if (onSettle) onSettle();
        }
        lastTransitionDirection = null;
        lastTransitionZoomDirection = null;
        lastTransitionSpinDirection = null;
        lastTransitionWipeDirection = null;
        lastTransitionCurtainDirection = null;
    }

    return { runTransition, stop };
}
