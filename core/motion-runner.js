/**
 * core/motion-runner.js — tính toán (+ vài lệnh thi hành DOM/Web Animation nhỏ) cho 3 runner Motion dùng chung mọi nơi tiêu
 * thụ: event/workflow/motion-transition-runner.js, motion-point-move-runner.js, motion-beat-react-runner.js. Runner giữ
 * state phiên + điều phối (taskManager, object map), mọi phép tính ở đây. Không đọc appState, không gọi core khác.
 *
 * NẠP SAU: core/motion-engine.js (hằng `MOTION_ENGINE_TRANSITION_MIN_TIME_MS`, dùng lúc chạy).
 */

// ===================== Transition =====================

/** Thời lượng 1 lượt Transition: kẹp dưới (thời lượng hiển thị − 200ms, tối thiểu MIN) để tick kế không cắt ngang.
 * `advanceMs` <= 0 chỉ ở mode 'perSong' (đổi theo bài, không có tick để tranh chấp) -> dùng thẳng thời lượng cấu hình.
 * @param {number} configuredMs - preset.transitionDurationMs @param {number} advanceMs @returns {number} */
function resolveMotionTransitionTotalMs(configuredMs, advanceMs) {
    if (!(advanceMs > 0)) return configuredMs;
    return Math.min(configuredMs, Math.max(MOTION_ENGINE_TRANSITION_MIN_TIME_MS, advanceMs - 200)); // core/motion-engine.js (hằng)
}

/** Kiểu không có pha "out" độc lập (`transitionSupportsInOutRatio()` = false): 2 layer cùng thời lượng.
 * @param {number} totalMs @returns {{inMs: number, outMs: number}} */
function computeMotionTransitionUniformMs(totalMs) {
    return { inMs: totalMs, outMs: totalMs };
}

/** Mốc dọn lượt Transition (layer ra "xong việc") = pha dài hơn. @param {{inMs: number, outMs: number}} inOutMs @returns {number} */
function computeMotionTransitionSettleMs(inOutMs) {
    return Math.max(inOutMs.inMs, inOutMs.outMs);
}

/** Cắt cứng (Transition tắt): đi thẳng tới trạng thái nghỉ của 1 lượt, không enter/exit, không animation.
 * @param {HTMLElement} outgoingEl @param {HTMLElement} incomingEl */
function cutMotionEngineLayers(outgoingEl, incomingEl) {
    outgoingEl.classList.remove('me-current');
    incomingEl.classList.add('me-current');
}

// ===================== Point Move =====================

/** Baseline "không đổi" — điểm xuất phát tween 'one' và mốc x=100 của `pointMoveEndForceBaseline`. */
const POINT_MOVE_RUNNER_BASELINE_TARGET = { linearX: 0, linearXUnit: '%', linearY: 0, linearYUnit: '%', rotate: 0, zoom: 0, flipX: 0, flipY: 0 };
/** Số khoảng sample đường cong 'all' (51 keyframe, ~2%/mẫu — đủ mượt, không nặng cho `.animate()`). */
const POINT_MOVE_RUNNER_ALL_STEPS = 50;

/** Kiểu kích hoạt Point Move: 'stop' (tắt / không có thời lượng), 'static' (không thời lượng + mode 'all': áp tĩnh điểm ở
 * 0%), 'one', 'all'. @param {object} preset @param {number} advanceMs @returns {'stop'|'static'|'one'|'all'} */
function resolvePointMoveActivationKind(preset, advanceMs) {
    if (!preset.pointMoveEnabled) return 'stop';
    if (advanceMs <= 0) return preset.pointMoveRunMode === 'all' ? 'static' : 'stop';
    return preset.pointMoveRunMode === 'one' ? 'one' : 'all';
}

/** Điểm đã tick đứng ở 0% (áp tĩnh khi không có thời lượng). @param {object[]} pointMoves @returns {object|null} */
function findStaticZeroPointMove(pointMoves) {
    return pointMoves.find((p) => p.checked && p.timingX === 0) || null;
}

/** Index các point move đã tick (nguồn chọn của mode 'one'). @param {object[]} pointMoves @returns {number[]} */
function listCheckedPointMoveIndices(pointMoves) {
    return pointMoves.map((p, i) => (p.checked ? i : -1)).filter((i) => i !== -1);
}

/** Keyframe tween mode 'one': vị trí đang hiện -> target. @param {string} fromTransform @param {string} toTransform */
function buildPointMoveTweenKeyframes(fromTransform, toTransform) {
    return [{ transform: fromTransform }, { transform: toTransform }];
}

/** Mode 'all': các point move "giữa đường" (đã tick, trừ Point 0 — chính là mốc 0%; bỏ điểm ở 100% khi bật Return
 * baseline) theo thứ tự `timingX`. @param {object} preset @returns {{pointMoves: object[], forceBaselineTail: boolean}} */
function planPointMoveAllPoints(preset) {
    const forceBaselineTail = preset.pointMoveEndForceBaseline;
    const pointMoves = preset.pointMoves
        .filter((p, i) => i !== 0 && p.checked && (!forceBaselineTail || p.timingX < 100))
        .sort((a, b) => a.timingX - b.timingX);
    return { pointMoves, forceBaselineTail };
}

/** Mốc đường cong 'all': [0% = start target, ...điểm giữa, (100% = baseline nếu Return baseline)].
 * @param {object} startTarget - vị trí thật đang hiện (tiếp diễn) hoặc Point 0 @param {object[]} pointMoves - planPointMoveAllPoints()
 * @param {object[]} targets - giá trị đã resolve, thẳng hàng `pointMoves` @param {boolean} forceBaselineTail
 * @returns {Array<{x: number, target: object}>} */
function assemblePointMoveAllTargets(startTarget, pointMoves, targets, forceBaselineTail) {
    const middle = pointMoves.map((p, i) => ({ x: p.timingX, target: targets[i] }));
    const tail = forceBaselineTail ? [{ x: 100, target: POINT_MOVE_RUNNER_BASELINE_TARGET }] : [];
    return [{ x: 0, target: startTarget }, ...middle, ...tail];
}

/** Vị trí % của từng mẫu đường cong 'all'. @returns {number[]} */
function computePointMoveSampleXs() {
    return Array.from({ length: POINT_MOVE_RUNNER_ALL_STEPS + 1 }, (_, i) => (i / POINT_MOVE_RUNNER_ALL_STEPS) * 100);
}

/**
 * Giá trị 6 field tại `xPercent` trên đường cong: tìm đoạn [A, B] liền kề chứa x rồi nội suy tuyến tính theo thời gian (đơn
 * vị linear lấy theo A). Ngoài 2 đầu / 1 mốc -> giữ mốc đầu/cuối.
 * @param {Array<{x: number, target: object}>} targetPoints - đã sort theo x @param {number} xPercent @returns {object}
 */
function interpolatePointMoveTargets(targetPoints, xPercent) {
    const findSegment = () => {
        const last = targetPoints[targetPoints.length - 1];
        if (targetPoints.length === 1 || xPercent <= targetPoints[0].x) return { a: targetPoints[0], b: targetPoints[0], progress: 0 };
        if (xPercent >= last.x) return { a: last, b: last, progress: 0 };
        for (let i = 0; i < targetPoints.length - 1; i++) {
            const a = targetPoints[i];
            const b = targetPoints[i + 1];
            if (xPercent >= a.x && xPercent <= b.x) {
                const span = b.x - a.x;
                return { a, b, progress: span <= 0 ? 0 : (xPercent - a.x) / span };
            }
        }
        return { a: last, b: last, progress: 0 };
    };
    const { a, b, progress } = findSegment();
    const from = a.target;
    const to = b.target;
    return {
        linearX: from.linearX + (to.linearX - from.linearX) * progress,
        linearXUnit: from.linearXUnit,
        linearY: from.linearY + (to.linearY - from.linearY) * progress,
        linearYUnit: from.linearYUnit,
        rotate: from.rotate + (to.rotate - from.rotate) * progress,
        zoom: from.zoom + (to.zoom - from.zoom) * progress,
        flipX: from.flipX + (to.flipX - from.flipX) * progress,
        flipY: from.flipY + (to.flipY - from.flipY) * progress,
    };
}

/** Keyframe đường cong 'all' — mẫu đầu thay bằng vị trí đang hiện (tiếp diễn mượt). @param {string[]} transforms
 * @param {string} fromTransform @returns {Array<{transform: string}>} */
function buildPointMoveAllKeyframes(transforms, fromTransform) {
    return transforms.map((transform, i) => ({ transform: i === 0 ? fromTransform : transform }));
}

/** % thời gian đã chạy của đường cong 'all' lượt trước (suy vị trí đang hiện). @param {number} currentTimeMs
 * @param {number} durationMs @returns {number} 0-100 */
function computePointMoveLiveXPercent(currentTimeMs, durationMs) {
    return Math.max(0, Math.min(100, ((currentTimeMs || 0) / (durationMs || 1)) * 100));
}

/** Bật lại Point Move giữa lúc đang hiện: mốc thời gian animation đáng lẽ đã tới. @param {number} advanceMs
 * @param {number} nowMs @param {number} startMs - lúc nội dung bắt đầu hiện @returns {number} */
function computePointMoveLiveElapsedMs(advanceMs, nowMs, startMs) {
    return Math.min(advanceMs, Math.max(0, nowMs - startMs));
}

/** Transform đang áp thật của layer ('none' nếu không có layer). @param {HTMLElement|null} el @returns {string} */
function readMotionLayerTransform(el) {
    return el ? getComputedStyle(el).transform : 'none';
}

/** Áp tĩnh 1 transform (không animation). @param {HTMLElement} el @param {string} transform */
function applyPointMoveStaticTransform(el, transform) {
    el.style.transform = transform;
}

/** Nhảy animation Point Move tới mốc thời gian. @param {Animation} animation @param {number} ms */
function seekPointMoveAnimation(animation, ms) {
    try { animation.currentTime = ms; } catch (e) {} // animation đã bị huỷ — bỏ qua
}

// ===================== React Beat =====================

/** Tốc độ decay envelope chuẩn (ms) — đủ nhanh để cảm được nhịp, đủ chậm để không giật; co giãn theo tốc độ phát. */
const MOTION_ENGINE_BEATREACT_DECAY_MS = 250;
/** Khoảng hở giữa 2 tick lớn hơn mức này = runner vừa ĐỨNG (pause/resume, ẩn tab, đổi video) chứ không phải thời gian chạy
 * thật -> coi như 1 frame (~16ms), envelope decay tiếp đúng từ vị trí đang có thay vì rơi cứng về baseline. Trên mọi frame
 * thật (kể cả 30fps ~33ms, giật nhẹ), nên không đổi cảm giác decay lúc chạy bình thường. */
const MOTION_BEATREACT_MAX_FRAME_GAP_MS = 100;

/** State nhịp lúc bắt đầu vòng mới: chưa attack, biên trần chưa roll (null), chưa có cực. */
function buildMotionBeatReactInitialBeat() {
    return { wasAttacking: false, maxes: { zoom: null, panX: null, panY: null, rotate: null }, polarities: { panX: 0, panY: 0, rotate: 0 } };
}

/** Khoảng thời gian frame này (tick đầu chưa có mốc = 16ms; hở quá ngưỡng = 16ms). @param {number} nowMs
 * @param {number} lastTickMs - 0 = chưa có tick nào @returns {number} */
function computeMotionBeatReactDeltaMs(nowMs, lastTickMs) {
    const rawDeltaMs = lastTickMs ? nowMs - lastTickMs : 16;
    return rawDeltaMs > MOTION_BEATREACT_MAX_FRAME_GAP_MS ? 16 : rawDeltaMs;
}

/** Thời gian decay theo tốc độ phát (không có / 0 -> 1x). @param {number} speed @returns {number} */
function computeMotionBeatReactDecayMs(speed) {
    return MOTION_ENGINE_BEATREACT_DECAY_MS / (speed || 1);
}

/**
 * 1 frame phần "nhịp": phát hiện beat mới (sườn lên của attack), roll lại biên trần (lần đầu hoặc mỗi beat mới — `randomMax`
 * bật: ngẫu nhiên trong [biên dưới, max]), đảo cực cho hướng xen kẽ ('leftToRight'/'rightToLeft', Pan Y 'upToDown'/
 * 'downToUp') mỗi beat mới. Cực lượt đầu: 'leftToRight' (Pan Y 'upToDown') bắt đầu dương, `reverse` đảo lượt đầu; lượt sau
 * luôn đảo lượt trước.
 * @param {ReturnType<typeof buildMotionBeatReactInitialBeat>} beat - state frame trước
 * @param {object} rb - preset.reactBeatAudio @param {number} beatScale @param {number} envelope - envelope frame trước
 * @param {() => number} [randomFn=Math.random] @returns {ReturnType<typeof buildMotionBeatReactInitialBeat>} state MỚI
 */
function advanceMotionBeatReactBeat(beat, rb, beatScale, envelope, randomFn) {
    const rnd = typeof randomFn === 'function' ? randomFn : Math.random;
    const isAttacking = beatScale >= envelope;
    const isNewBeat = isAttacking && !beat.wasAttacking;
    // Biên trần = lerp(biên dưới, max, hệ số): hệ số 1 (đúng max) hoặc ngẫu nhiên khi bật Random Max.
    const roll = (effect, absoluteMin, configuredMax, current) => ((isNewBeat || current === null)
        ? absoluteMin + (effect.randomMax ? rnd() : 1) * (configuredMax - absoluteMin)
        : current);
    const nextPolarity = (prev, startsForward, reverse) => (prev !== 0 ? -prev : (startsForward !== reverse ? 1 : -1));
    const alternates = (direction, forward, backward) => isNewBeat && (direction === forward || direction === backward);
    const { panX, panY, rotate } = beat.polarities;
    return {
        wasAttacking: isAttacking,
        maxes: {
            zoom: roll(rb.zoom, 100, rb.zoom.maxPct, beat.maxes.zoom),
            panX: roll(rb.panX, 100, rb.panX.maxPct, beat.maxes.panX),
            panY: roll(rb.panY, 100, rb.panY.maxPct, beat.maxes.panY),
            rotate: roll(rb.rotate, 0, rb.rotate.maxDeg, beat.maxes.rotate),
        },
        polarities: {
            panX: alternates(rb.panX.direction, 'leftToRight', 'rightToLeft') ? nextPolarity(panX, rb.panX.direction === 'leftToRight', rb.panX.reverse) : panX,
            panY: alternates(rb.panY.direction, 'upToDown', 'downToUp') ? nextPolarity(panY, rb.panY.direction === 'upToDown', rb.panY.reverse) : panY,
            rotate: alternates(rb.rotate.direction, 'leftToRight', 'rightToLeft') ? nextPolarity(rotate, rb.rotate.direction === 'leftToRight', rb.rotate.reverse) : rotate,
        },
    };
}

/** Envelope follower (kiểu VU meter): nhạc mạnh lên (`beatScale` >= envelope) bắt theo tức thời; nhạc yếu đi thì decay êm
 * `deltaMs / decayMs` mỗi frame, kẹp sàn ở `beatScale` hiện tại — react liên tục, không gate.
 * @param {number} prevEnvelope @param {number} beatScale @param {number} deltaMs @param {number} decayMs @returns {number} */
function computeMotionEngineBeatReactEnvelope(prevEnvelope, beatScale, deltaMs, decayMs) {
    if (beatScale >= prevEnvelope) return beatScale;
    return Math.max(beatScale, prevEnvelope - (deltaMs / decayMs));
}

/** Nhả về baseline có hẹn giờ: envelope đi tuyến tính theo thời gian thật về 0, chạm 0 đúng hạn.
 * @param {{fromEnvelope: number, startMs: number, durationMs: number}} release @param {number} nowMs @returns {number} */
function computeMotionBeatReactReleaseEnvelope(release, nowMs) {
    return release.fromEnvelope * (1 - Math.min(1, (nowMs - release.startMs) / release.durationMs));
}

/** Bắt đầu nhả về baseline: `durationMs` > 0 -> tuyến tính theo thời gian ('timedRelease'); không -> decay chuẩn ('follow',
 * beatScale coi như 0). @param {number} envelope @param {number} nowMs @param {number} [durationMs]
 * @returns {{fromEnvelope: number, startMs: number, durationMs: number, envelopeMode: 'timedRelease'|'follow'}} */
function resolveMotionBeatReactRelease(envelope, nowMs, durationMs) {
    const timed = durationMs > 0;
    return { fromEnvelope: envelope, startMs: nowMs, durationMs: timed ? durationMs : 0, envelopeMode: timed ? 'timedRelease' : 'follow' };
}

/**
 * CSS transform của frame: zoom nội suy [100%, max] theo `energy`; pan (% — max đã trừ baseline 100) / rotate (độ, baseline
 * 0) nội suy [0, max], dấu cố định với 'left'/'right' ('up'/'down' cho Pan Y), theo cực đang có với hướng xen kẽ. Hiệu ứng
 * tắt = baseline.
 * @param {object} rb @param {{zoom: number, panX: number, panY: number, rotate: number}} maxes @param {{panX: number,
 *        panY: number, rotate: number}} polarities @param {number} energy - envelope 0-1 @returns {string}
 */
function computeMotionBeatReactTransform(rb, maxes, polarities, energy) {
    const e = Math.max(0, Math.min(1, energy));
    const DIRECTION_SIGN = { left: -1, right: 1, up: -1, down: 1 };
    const offset = (direction, maxVal, polarity) => (DIRECTION_SIGN[direction] || polarity || 1) * maxVal * e;
    const zoomScale = rb.zoom.enabled ? (100 + (maxes.zoom - 100) * e) / 100 : 1;
    const panXPct = rb.panX.enabled ? offset(rb.panX.direction, maxes.panX - 100, polarities.panX) : 0;
    const panYPct = rb.panY.enabled ? offset(rb.panY.direction, maxes.panY - 100, polarities.panY) : 0;
    const rotateDeg = rb.rotate.enabled ? offset(rb.rotate.direction, maxes.rotate, polarities.rotate) : 0;
    return `scale(${zoomScale}) translateX(${panXPct}%) translateY(${panYPct}%) rotate(${rotateDeg}deg)`;
}

/** Việc của `sync()`: 'start' (cần chạy, chưa chạy), 'stop' (không cần, đang chạy), 'keep'.
 * @param {boolean} shouldRun @param {boolean} isRunning @returns {'start'|'stop'|'keep'} */
function resolveMotionBeatReactSyncAction(shouldRun, isRunning) {
    if (shouldRun && !isRunning) return 'start';
    return !shouldRun && isRunning ? 'stop' : 'keep';
}

/** Ghi transform lên target React Beat ('' = trả về không transform). @param {HTMLElement|null} el @param {string} transform */
function setMotionBeatReactTransform(el, transform) {
    if (el) el.style.transform = transform;
}
