/**
 * event/workflow/motion-point-move-runner.js — "Point Move Runner" DÙNG CHUNG cho MỌI nơi tiêu thụ
 * muốn chạy Point Move lên 1 target element bất kỳ — TÁCH RA khỏi workflowMotionEngine, ĐÚNG nguyên
 * tắc "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi của mình và dùng cơ chế đó như gọi API"
 * (Giang chỉ ra) — CÙNG tinh thần event/workflow/motion-beat-react-runner.js đã làm cho React Beat.
 *
 * KHÁC React Beat ở 1 điểm quan trọng: Point Move KHÔNG chạy per-frame tự trị (không có khái niệm
 * "mỗi frame tự đọc 1 tín hiệu ngoài rồi vẽ") — nó là 1 animation WAAPI được KÍCH HOẠT tại NHỮNG THỜI
 * ĐIỂM RỜI RẠC (lúc nội dung mới hiện ra / preset đổi) rồi TỰ CHẠY, nên API ở đây là các hàm nơi
 * tiêu thụ CHỦ ĐỘNG gọi ĐÚNG lúc, KHÔNG phải 1 vòng lặp nền tự sync().
 *
 * 2 kiểu kích hoạt TÁCH BIỆT (mirror ĐÚNG 2 điểm gọi gốc của VBG — `_staticReveal()`/`_showNext()`
 * so với `updatePreset()`, workflowMotionEngine cũ — RÚT ĐÚNG từ hành vi ĐÃ CHỨNG MINH đúng, KHÔNG
 * đoán mới):
 *   `activateForNewContent(preset, advanceMs)` — nội dung MỚI vừa bắt đầu hiện (ảnh/video mới) —
 *     ghi mốc "bắt đầu hiện" (dùng bởi `liveToggle()` để nhảy đúng thời điểm sau này).
 *   `activateForPresetChange(preset, advanceMs)` — preset đổi NHƯNG nội dung VẪN đang hiện từ
 *     trước (KHÔNG phải nội dung mới) — KHÔNG ghi lại mốc "bắt đầu hiện" (giữ nguyên, nếu không
 *     `liveToggle()` sau này sẽ tính sai thời điểm cần nhảy tới).
 *
 * TÁI DÙNG NGUYÊN các hàm THUẦN đã có sẵn (core/motion-engine.js) — KHÔNG viết lại: resolvePointMoveFieldValue()/
 * buildPointMoveTransformString()/lerpPointMoveNumber()/pickPointMoveOneIndexSequential()/
 * pickPointMoveOneIndexRandom()/startPointMoveAnimation()/stopPointMoveAnimation()/
 * pausePointMoveAnimation()/resumePointMoveAnimation() — TẤT CẢ vốn ĐÃ nhận element/tham số qua
 * đối số, KHÔNG hardcode gì (khác React Beat bản đầu — Point Move phần LÕI vốn đã đúng nguyên tắc
 * từ trước, chỉ tầng ĐIỀU PHỐI [file này] là chưa tách).
 *
 * `createMotionPointMoveRunner(getTargetElementFn)` — factory, trả về `{ activateForNewContent(),
 * activateForPresetChange(), stop(), pause(), resume(), liveToggle() }`. KHÔNG cần `getPresetFn`
 * như React Beat Runner — Point Move không tự trị theo frame, preset LUÔN được nơi gọi truyền THẲNG
 * vào từng lệnh gọi (mirror ĐÚNG cách `_activatePointMove(preset)` gốc nhận preset qua tham số).
 *
 * NẠP SAU: core/motion-engine.js (các hàm pure kể trên).
 * NẠP TRƯỚC: event/workflow/motion-engine.js (dùng làm Runner cho VBG).
 *
 * @param {() => HTMLElement|null} getTargetElementFn
 * @returns {{activateForNewContent: (preset: object, advanceMs: number) => void,
 *            activateForPresetChange: (preset: object, advanceMs: number) => void,
 *            stop: () => void, pause: () => void, resume: () => void,
 *            liveToggle: (preset: object, enabled: boolean) => void}}
 */

/** Baseline "không đổi" — dùng làm điểm XUẤT PHÁT khi tween 'one' mode (baseline -> target) VÀ làm
 * `target` của node ảo "vị trí ban đầu" ở 'all' mode. CÙNG hằng số gốc (event/workflow/motion-
 * engine.js trước đây) — copy nguyên, KHÔNG đổi giá trị. */
const POINT_MOVE_RUNNER_BASELINE_TARGET = { linearX: 0, linearXUnit: '%', linearY: 0, linearYUnit: '%', rotate: 0, zoom: 0, flipX: 0, flipY: 0 };

/** Số keyframe sample cho đường cong Timing ('all' mode) — CÙNG hằng số gốc, giữ NGUYÊN giá trị
 * (50 mẫu, ~2%/mẫu — đủ mượt, không quá nặng cho `.animate()`). */
const POINT_MOVE_RUNNER_ALL_STEPS = 50;

function createMotionPointMoveRunner(getTargetElementFn) {
    // State RIÊNG của runner NÀY — mirror ĐÚNG 6 field gốc của workflowMotionEngine (_pointMoveAnim/
    // _activationStartAtRealTime/_lastAdvanceMs/_lastAllModePoints/_lastAllModeDurationMs/
    // _lastPointMoveOneIndex), giờ sống trong closure thay vì `this.*`.
    let pointMoveAnim = null;
    let activationStartAtRealTime = 0;
    let lastAdvanceMs = 0;
    let lastAllModePoints = null;
    let lastAllModeDurationMs = 0;
    let lastPointMoveOneIndex = -1;

    /** Resolve 6 field/point move thành giá trị SỐ THẬT (random range resolve 1 LẦN, giữ nguyên
     * suốt lượt hiển thị đó — không resolve lại mỗi frame). MIRROR NGUYÊN VẸN logic gốc. */
    function _resolvePointMoveTarget(pointMove) {
        return {
            linearX: resolvePointMoveFieldValue(pointMove.linearX), linearXUnit: pointMove.linearX.unit, // core
            linearY: resolvePointMoveFieldValue(pointMove.linearY), linearYUnit: pointMove.linearY.unit, // core
            rotate: resolvePointMoveFieldValue(pointMove.rotate), // core
            zoom: resolvePointMoveFieldValue(pointMove.zoom), // core
            flipX: resolvePointMoveFieldValue(pointMove.flipX), // core
            flipY: resolvePointMoveFieldValue(pointMove.flipY), // core
        };
    }

    /** Tìm đoạn [A,B] (2 point move LIỀN KỀ trong `points`, đã sort theo `x`) chứa `xPercent`, +
     * tiến độ THỜI GIAN cục bộ (0-1) trong đoạn đó. MIRROR NGUYÊN VẸN logic gốc. */
    function _findPointMoveSegment(points, xPercent) {
        if (points.length === 1 || xPercent <= points[0].x) return { a: points[0], b: points[0], progress: 0 };
        const last = points[points.length - 1];
        if (xPercent >= last.x) return { a: last, b: last, progress: 0 };
        for (let i = 0; i < points.length - 1; i++) {
            if (xPercent >= points[i].x && xPercent <= points[i + 1].x) {
                const span = points[i + 1].x - points[i].x;
                return { a: points[i], b: points[i + 1], progress: span <= 0 ? 0 : (xPercent - points[i].x) / span };
            }
        }
        return { a: last, b: last, progress: 0 };
    }

    /** Sample `targetPoints` thành mảng keyframe {transform}. MIRROR NGUYÊN VẸN logic gốc. */
    function _buildPointMoveAllKeyframes(targetPoints) {
        const keyframes = [];
        for (let i = 0; i <= POINT_MOVE_RUNNER_ALL_STEPS; i++) {
            const xPercent = (i / POINT_MOVE_RUNNER_ALL_STEPS) * 100;
            const seg = _findPointMoveSegment(targetPoints, xPercent);
            const v = {
                linearX: lerpPointMoveNumber(seg.a.target.linearX, seg.b.target.linearX, seg.progress), // core
                linearXUnit: seg.a.target.linearXUnit,
                linearY: lerpPointMoveNumber(seg.a.target.linearY, seg.b.target.linearY, seg.progress), // core
                linearYUnit: seg.a.target.linearYUnit,
                rotate: lerpPointMoveNumber(seg.a.target.rotate, seg.b.target.rotate, seg.progress), // core
                zoom: lerpPointMoveNumber(seg.a.target.zoom, seg.b.target.zoom, seg.progress), // core
                flipX: lerpPointMoveNumber(seg.a.target.flipX, seg.b.target.flipX, seg.progress), // core
                flipY: lerpPointMoveNumber(seg.a.target.flipY, seg.b.target.flipY, seg.progress), // core
            };
            keyframes.push({ transform: buildPointMoveTransformString(v) }); // core
        }
        return keyframes;
    }

    /** Suy 6 giá trị field THẬT tại vị trí ĐANG hiển thị của đường cong 'all' mode LƯỢT TRƯỚC (nếu
     * có). MIRROR NGUYÊN VẸN logic gốc `_deriveLivePointMoveTarget()`. */
    function _deriveLivePointMoveTarget() {
        if (!pointMoveAnim || !lastAllModePoints) return null;
        let currentTimeMs = 0;
        try { currentTimeMs = pointMoveAnim.currentTime || 0; } catch (e) { return null; }
        const oldXPercent = Math.max(0, Math.min(100, (currentTimeMs / (lastAllModeDurationMs || 1)) * 100));
        const seg = _findPointMoveSegment(lastAllModePoints, oldXPercent);
        return {
            linearX: lerpPointMoveNumber(seg.a.target.linearX, seg.b.target.linearX, seg.progress), // core
            linearXUnit: seg.a.target.linearXUnit,
            linearY: lerpPointMoveNumber(seg.a.target.linearY, seg.b.target.linearY, seg.progress), // core
            linearYUnit: seg.a.target.linearYUnit,
            rotate: lerpPointMoveNumber(seg.a.target.rotate, seg.b.target.rotate, seg.progress), // core
            zoom: lerpPointMoveNumber(seg.a.target.zoom, seg.b.target.zoom, seg.progress), // core
            flipX: lerpPointMoveNumber(seg.a.target.flipX, seg.b.target.flipX, seg.progress), // core
            flipY: lerpPointMoveNumber(seg.a.target.flipY, seg.b.target.flipY, seg.progress), // core
        };
    }

    /** `advanceMs<=0` nhưng có ĐÚNG 1 point move tại `timingX===0` -> áp TĨNH (không animation).
     * MIRROR NGUYÊN VẸN logic gốc `_applyStaticPointMoveAtZero()`. */
    function _applyStaticPointMoveAtZero(preset) {
        const zeroPoint = preset.pointMoves.find((p) => p.checked && p.timingX === 0);
        const target = getTargetElementFn();
        if (!zeroPoint || !target) return;
        const resolved = _resolvePointMoveTarget(zeroPoint);
        target.style.transform = buildPointMoveTransformString(resolved); // core
    }

    /** 'one' mode. MIRROR NGUYÊN VẸN logic gốc `_activatePointMoveOne()`. */
    function _activatePointMoveOne(preset, fromTransform) {
        lastAllModePoints = null;
        const checkedIndices = [];
        preset.pointMoves.forEach((p, i) => { if (p.checked) checkedIndices.push(i); });
        const pickFn = preset.pointMoveOneOrder === 'random' ? pickPointMoveOneIndexRandom : pickPointMoveOneIndexSequential; // core
        const index = pickFn(checkedIndices, lastPointMoveOneIndex);
        lastPointMoveOneIndex = index;
        if (index === -1) return;
        const target = _resolvePointMoveTarget(preset.pointMoves[index]);
        const keyframes = [
            { transform: fromTransform },
            { transform: buildPointMoveTransformString(target) }, // core
        ];
        pointMoveAnim = startPointMoveAnimation(getTargetElementFn(), keyframes, lastAdvanceMs, 'ease-in-out'); // core
    }

    /** 'all' mode. MIRROR NGUYÊN VẸN logic gốc `_activatePointMoveAll()`. */
    function _activatePointMoveAll(preset, fromTransform, liveStartTarget) {
        const forceBaselineTail = preset.pointMoveStartForceBaseline || preset.pointMoveEndForceBaseline;
        const checked = preset.pointMoves.filter((p) => p.checked);
        const usable = forceBaselineTail ? checked.filter((p) => p.timingX < 100) : checked;
        if (usable.length === 0 && !forceBaselineTail) return;
        const points = usable
            .map((p) => ({ x: p.timingX, target: _resolvePointMoveTarget(p) }))
            .sort((a, b) => a.x - b.x);
        const startTarget = liveStartTarget || POINT_MOVE_RUNNER_BASELINE_TARGET;
        const targetPoints = [{ x: 0, target: startTarget }, ...points];
        if (forceBaselineTail) targetPoints.push({ x: 100, target: POINT_MOVE_RUNNER_BASELINE_TARGET });

        const keyframes = _buildPointMoveAllKeyframes(targetPoints);
        if (keyframes.length > 0) keyframes[0] = { transform: fromTransform };
        pointMoveAnim = startPointMoveAnimation(getTargetElementFn(), keyframes, lastAdvanceMs, 'linear'); // core
        lastAllModePoints = targetPoints;
        lastAllModeDurationMs = lastAdvanceMs;
    }

    /** Lõi kích hoạt DÙNG CHUNG bởi 2 API public — MIRROR NGUYÊN VẸN logic gốc `_activatePointMove()`. */
    function _runActivate(preset) {
        const target = getTargetElementFn();
        if (!preset.pointMoveEnabled || lastAdvanceMs <= 0) {
            stopPointMoveAnimation(target, pointMoveAnim); // core
            pointMoveAnim = null;
            lastAllModePoints = null;
            if (preset.pointMoveEnabled && lastAdvanceMs <= 0 && preset.pointMoveRunMode === 'all') _applyStaticPointMoveAtZero(preset);
            return;
        }
        const fromTransform = target ? getComputedStyle(target).transform : 'none';
        const liveStartTarget = _deriveLivePointMoveTarget();
        stopPointMoveAnimation(target, pointMoveAnim); // core
        pointMoveAnim = null;
        if (preset.pointMoveRunMode === 'one') { _activatePointMoveOne(preset, fromTransform); return; }
        _activatePointMoveAll(preset, fromTransform, liveStartTarget);
    }

    /** Nội dung MỚI vừa bắt đầu hiện — gọi lúc THAY nội dung (mirror `_staticReveal()`/`_showNext()`
     * gốc) — ghi lại mốc "bắt đầu hiện" (dùng bởi `liveToggle()`).
     * @param {object} preset @param {number} advanceMs */
    function activateForNewContent(preset, advanceMs) {
        lastAdvanceMs = advanceMs;
        activationStartAtRealTime = Date.now();
        _runActivate(preset);
    }

    /** Preset đổi NHƯNG nội dung VẪN đang hiện từ trước — gọi lúc chỉ ĐỔI CẤU HÌNH (mirror
     * `updatePreset()` gốc) — KHÔNG ghi lại mốc "bắt đầu hiện" (giữ nguyên mốc THẬT, nếu không
     * `liveToggle()` sau này tính sai thời điểm cần nhảy tới).
     * @param {object} preset @param {number} advanceMs */
    function activateForPresetChange(preset, advanceMs) {
        lastAdvanceMs = advanceMs;
        _runActivate(preset);
    }

    /** Dừng hẳn — dọn animation + mọi state suy tiếp (không còn gì để lượt SAU dựa vào). */
    function stop() {
        const target = getTargetElementFn();
        stopPointMoveAnimation(target, pointMoveAnim); // core
        pointMoveAnim = null;
        lastAllModePoints = null;
        lastAllModeDurationMs = 0;
        lastPointMoveOneIndex = -1;
    }

    function pause() { pausePointMoveAnimation(pointMoveAnim); } // core
    function resume() { resumePointMoveAnimation(pointMoveAnim); } // core

    /** Bật/tắt Point Move SỐNG — CALLER tự đảm bảo ĐÚNG preset/context TRƯỚC khi gọi (Runner không
     * tự biết "preset này có phải đang thật sự active hay không" trên toàn hệ thống — đó là việc
     * nơi tiêu thụ tự quản, vd VBG dùng `appState.motionRunning`, mirror ĐÚNG guard gốc
     * `livePointMoveToggle()` nhưng đẩy việc guard ra NGOÀI Runner — đúng nguyên tắc "nơi tiêu thụ
     * quyết hành vi của mình"). Tắt: dừng về baseline NGAY. Bật: activateForPresetChange() lại rồi
     * NHẢY THẲNG animation tới đúng mốc thời gian ĐÁNG LẼ đã tới (tính từ `activationStartAtRealTime`
     * — mốc nội dung này bắt đầu hiện, KHÔNG đổi bởi việc tắt/bật giữa chừng).
     * @param {object} preset @param {boolean} enabled */
    function liveToggle(preset, enabled) {
        const target = getTargetElementFn();
        if (!enabled) {
            stopPointMoveAnimation(target, pointMoveAnim); // core
            pointMoveAnim = null;
            lastAllModePoints = null;
            return;
        }
        activateForPresetChange(preset, lastAdvanceMs); // KHÔNG dùng activateForNewContent() — KHÔNG được ghi đè activationStartAtRealTime
        if (pointMoveAnim) {
            const elapsedMs = Math.min(lastAdvanceMs, Math.max(0, Date.now() - activationStartAtRealTime));
            try { pointMoveAnim.currentTime = elapsedMs; } catch (e) {}
        }
    }

    return { activateForNewContent, activateForPresetChange, stop, pause, resume, liveToggle };
}
