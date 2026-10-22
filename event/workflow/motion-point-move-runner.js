/**
 * event/workflow/motion-point-move-runner.js — Point Move Runner dùng chung mọi nơi tiêu thụ (cơ chế thuần, nguyên tắc tua
 * vít — cùng tinh thần React Beat Runner). Khác React Beat: không chạy per-frame tự trị — 1 animation WAAPI kích hoạt tại
 * thời điểm rời rạc rồi tự chạy, nên nơi tiêu thụ gọi đúng lúc:
 *   `activateForNewContent(preset, advanceMs)` — nội dung MỚI vừa hiện: ghi mốc "bắt đầu hiện" (cho `liveToggle()`).
 *   `activateForPresetChange(preset, advanceMs)` — preset đổi, nội dung vẫn đang hiện: GIỮ mốc "bắt đầu hiện".
 * Preset luôn do nơi gọi truyền vào (không cần `getPresetFn`). Áp sống công tắc: `notifyMotionPointMoveEnabledChanged()`
 * (Motion Edit gọi) broadcast tới mọi Runner, Runner nào đang chạy nội dung với đúng preset id đó tự `liveToggle()` — chỉ
 * công tắc bật/tắt, field khác đợi lượt kích hoạt kế tiếp.
 *
 * Tính toán: core/motion-runner.js (kế hoạch điểm, nội suy, keyframe) + core/motion-engine.js (resolve field, chuỗi
 * transform, chọn điểm mode 'one', điều khiển WAAPI).
 *
 * NẠP SAU: core/motion-engine.js, core/motion-runner.js.
 *
 * @param {() => HTMLElement|null} getTargetElementFn
 * @returns {{activateForNewContent: (preset: object, advanceMs: number) => void,
 *            activateForPresetChange: (preset: object, advanceMs: number) => void,
 *            stop: () => void, pause: () => void, resume: () => void,
 *            liveToggle: (preset: object, enabled: boolean) => void}}
 */

/** Registry mọi Runner — mỗi phần tử là hàm xử lý broadcast riêng của 1 Runner. */
const _motionPointMoveRunnerRegistry = [];

/** Broadcast "công tắc Point Move của preset này vừa đổi" — Runner tự lọc theo `preset.id`.
 * @param {object} preset - bản mới nhất sau khi lưu (có `id`) @param {boolean} enabled */
function notifyMotionPointMoveEnabledChanged(preset, enabled) {
    if (!preset || !preset.id) return;
    _motionPointMoveRunnerRegistry.forEach((handleFn) => handleFn(preset, enabled));
}

/** Kích hoạt theo kiểu (core/motion-runner.js::resolvePointMoveActivationKind()). */
const POINT_MOVE_ACTIVATION_BY_KIND = {
    stop: (ops) => ops.stopAndForget(),
    static: (ops, preset) => { ops.stopAndForget(); ops.applyStaticAtZero(preset); },
    one: (ops, preset) => ops.activateOne(preset),
    all: (ops, preset) => ops.activateAll(preset),
};
/** Mode 'one': cách chọn point move kế (thứ tự khác 'random' = tuần tự). */
const POINT_MOVE_ONE_PICK_BY_ORDER = {
    random: (indices, lastIndex) => pickPointMoveOneIndexRandom(indices, lastIndex), // core/motion-engine.js
    sequential: (indices, lastIndex) => pickPointMoveOneIndexSequential(indices, lastIndex),
};
/** Bật/tắt sống. */
const POINT_MOVE_LIVE_TOGGLE_BY_ENABLED = {
    false: (ops) => ops.stopAndForget(),
    true: (ops, preset) => ops.resumeLive(preset),
};

function createMotionPointMoveRunner(getTargetElementFn) {
    let pointMoveAnim = null;
    let activationStartAtRealTime = 0;
    let lastAdvanceMs = 0;
    let lastAllModePoints = null;    // đường cong 'all' lượt trước (suy vị trí đang hiện khi kích hoạt lại)
    let lastAllModeDurationMs = 0;
    let lastPointMoveOneIndex = -1;
    let activePresetId = null;       // broadcast: Runner đang chạy nội dung với preset nào
    let hasActiveContent = false;

    /** 6 field của 1 point move -> số thật (random range resolve 1 lần, giữ suốt lượt hiển thị). */
    function _resolvePointMoveTarget(pointMove) {
        return {
            linearX: resolvePointMoveFieldValue(pointMove.linearX), linearXUnit: pointMove.linearX.unit, // core/motion-engine.js
            linearY: resolvePointMoveFieldValue(pointMove.linearY), linearYUnit: pointMove.linearY.unit,
            rotate: resolvePointMoveFieldValue(pointMove.rotate),
            zoom: resolvePointMoveFieldValue(pointMove.zoom),
            flipX: resolvePointMoveFieldValue(pointMove.flipX),
            flipY: resolvePointMoveFieldValue(pointMove.flipY),
        };
    }

    /** Vị trí đang hiện của đường cong 'all' lượt trước (null nếu không có / animation đã huỷ). */
    function _deriveLivePointMoveTarget() {
        if (!pointMoveAnim || !lastAllModePoints) return null;
        let currentTimeMs = 0;
        try { currentTimeMs = pointMoveAnim.currentTime; } catch (e) { return null; }
        return interpolatePointMoveTargets(lastAllModePoints, computePointMoveLiveXPercent(currentTimeMs, lastAllModeDurationMs)); // core/motion-runner.js
    }

    function _stopAnimation() {
        stopPointMoveAnimation(getTargetElementFn(), pointMoveAnim); // core/motion-engine.js
        pointMoveAnim = null;
    }

    const ops = {
        /** Dừng về baseline + quên đường cong lượt trước. */
        stopAndForget() {
            _stopAnimation();
            lastAllModePoints = null;
        },

        /** Không có thời lượng: áp tĩnh điểm đã tick ở 0% (nếu có). */
        applyStaticAtZero(preset) {
            const zeroPoint = findStaticZeroPointMove(preset.pointMoves); // core/motion-runner.js
            const target = getTargetElementFn();
            if (!zeroPoint || !target) return;
            applyPointMoveStaticTransform(target, buildPointMoveTransformString(_resolvePointMoveTarget(zeroPoint))); // core/motion-runner.js + core/motion-engine.js
        },

        /** Mode 'one': tween từ vị trí đang hiện tới 1 point move đã tick (tuần tự / ngẫu nhiên khác lượt trước). */
        activateOne(preset) {
            const fromTransform = readMotionLayerTransform(getTargetElementFn()); // core/motion-runner.js — đọc TRƯỚC khi dừng (dừng xoá transform)
            _stopAnimation();
            lastAllModePoints = null;
            const pick = POINT_MOVE_ONE_PICK_BY_ORDER[preset.pointMoveOneOrder] || POINT_MOVE_ONE_PICK_BY_ORDER.sequential;
            const index = pick(listCheckedPointMoveIndices(preset.pointMoves), lastPointMoveOneIndex); // core/motion-runner.js
            lastPointMoveOneIndex = index;
            if (index === -1) return;
            const toTransform = buildPointMoveTransformString(_resolvePointMoveTarget(preset.pointMoves[index])); // core/motion-engine.js
            pointMoveAnim = startPointMoveAnimation(getTargetElementFn(), buildPointMoveTweenKeyframes(fromTransform, toTransform), lastAdvanceMs, 'ease-in-out');
        },

        /** Mode 'all': đường cong Point 0 (hoặc vị trí đang hiện, nếu tiếp diễn) -> các điểm theo `timingX` (-> baseline ở 100%
         * nếu Return baseline), nội suy tuyến tính theo thời gian. */
        activateAll(preset) {
            const fromTransform = readMotionLayerTransform(getTargetElementFn()); // core/motion-runner.js
            const liveStartTarget = _deriveLivePointMoveTarget();
            _stopAnimation();
            const plan = planPointMoveAllPoints(preset); // core/motion-runner.js
            const targets = plan.pointMoves.map((pointMove) => _resolvePointMoveTarget(pointMove));
            const startTarget = liveStartTarget || _resolvePointMoveTarget(preset.pointMoves[0]);
            const targetPoints = assemblePointMoveAllTargets(startTarget, plan.pointMoves, targets, plan.forceBaselineTail);
            const transforms = computePointMoveSampleXs().map((xPercent) => buildPointMoveTransformString(interpolatePointMoveTargets(targetPoints, xPercent))); // core/motion-runner.js + core/motion-engine.js
            pointMoveAnim = startPointMoveAnimation(getTargetElementFn(), buildPointMoveAllKeyframes(transforms, fromTransform), lastAdvanceMs, 'linear');
            lastAllModePoints = targetPoints;
            lastAllModeDurationMs = lastAdvanceMs;
        },

        /** Bật lại giữa lúc đang hiện: kích hoạt như đổi preset (giữ mốc bắt đầu hiện) rồi nhảy tới mốc đáng lẽ đã tới. */
        resumeLive(preset) {
            activateForPresetChange(preset, lastAdvanceMs);
            if (!pointMoveAnim) return;
            seekPointMoveAnimation(pointMoveAnim, computePointMoveLiveElapsedMs(lastAdvanceMs, Date.now(), activationStartAtRealTime)); // core/motion-runner.js
        },
    };

    function _runActivate(preset) {
        POINT_MOVE_ACTIVATION_BY_KIND[resolvePointMoveActivationKind(preset, lastAdvanceMs)](ops, preset); // core/motion-runner.js
    }

    /** Nội dung MỚI vừa bắt đầu hiện — ghi mốc "bắt đầu hiện". @param {object} preset @param {number} advanceMs */
    function activateForNewContent(preset, advanceMs) {
        activePresetId = preset.id || null;
        hasActiveContent = true;
        lastAdvanceMs = advanceMs;
        activationStartAtRealTime = Date.now();
        _runActivate(preset);
    }

    /** Preset đổi, nội dung vẫn đang hiện — giữ mốc "bắt đầu hiện". @param {object} preset @param {number} advanceMs */
    function activateForPresetChange(preset, advanceMs) {
        activePresetId = preset.id || null;
        hasActiveContent = true;
        lastAdvanceMs = advanceMs;
        _runActivate(preset);
    }

    /** Dừng hẳn — dọn animation + mọi state suy tiếp. */
    function stop() {
        _stopAnimation();
        lastAllModePoints = null;
        lastAllModeDurationMs = 0;
        lastPointMoveOneIndex = -1;
        activePresetId = null;
        hasActiveContent = false;
    }

    function pause() { pausePointMoveAnimation(pointMoveAnim); } // core/motion-engine.js
    function resume() { resumePointMoveAnimation(pointMoveAnim); }

    /** Bật/tắt Point Move sống (nơi gọi tự bảo đảm đúng preset/context — broadcast lọc ở `_handlePresetEnabledChanged()`).
     * Tắt: về baseline ngay. Bật: kích hoạt lại rồi nhảy tới đúng mốc thời gian tính từ lúc nội dung bắt đầu hiện.
     * @param {object} preset @param {boolean} enabled */
    function liveToggle(preset, enabled) {
        POINT_MOVE_LIVE_TOGGLE_BY_ENABLED[enabled](ops, preset);
    }

    /** Broadcast — chỉ áp khi đang chạy nội dung với đúng preset vừa đổi. */
    function _handlePresetEnabledChanged(preset, enabled) {
        if (!hasActiveContent || preset.id !== activePresetId) return;
        liveToggle(preset, enabled);
    }
    _motionPointMoveRunnerRegistry.push(_handlePresetEnabledChanged);

    return { activateForNewContent, activateForPresetChange, stop, pause, resume, liveToggle };
}
