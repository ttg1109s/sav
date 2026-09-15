/**
 * event/workflow/motion-transition-runner.js — "Transition Runner" DÙNG CHUNG cho MỌI nơi tiêu thụ
 * muốn chạy Transition (crossfade/cắt cứng giữa 2 layer bất kỳ) — TÁCH RA khỏi workflowMotionEngine,
 * ĐÚNG nguyên tắc "Motion cung cấp CƠ CHẾ THUẦN (cái tua vít), nơi tiêu thụ tự quyết dùng nó vào việc
 * gì/gắn ở đâu — công cụ không quan tâm ai dùng, dùng để xoáy ốc hay đục tường" (Giang chỉ ra, sau
 * khi phát hiện bản đầu TỰ Ý gán/gỡ `background-image` lên 2 layer — hardcode SẴN "công dụng" thay
 * vì để nơi tiêu thụ tự quyết).
 *
 * SỬA (bản đầu SAI) — Runner cũ tự quản lý: object URL (nhận/giữ/revoke), `layerToggle` (layer nào
 * đang "current"), VÀ tự gọi `setMotionEngineLayerImage()` gán/gỡ `background-image` — TẤT CẢ đều
 * là quyết định CỦA VBG (ảnh lấy từ URL, layer1/layer2 luân phiên, nội dung là background-image),
 * KHÔNG phải bản chất của "transition". Bằng chứng rõ nhất: Video Player mode dùng layer A = MỘT
 * `<video>` (KHÔNG có background-image, tự hiển thị frame đã decode — "chuẩn bị nội dung" của nó là
 * KHÔNG LÀM GÌ) — Runner cũ ép buộc `setMotionEngineLayerImage()` sẽ vô nghĩa/sai cho layer A.
 *
 * Runner GIỜ chỉ còn ĐÚNG 1 việc: `runTransition(containerEl, outgoingEl, incomingEl, preset,
 * advanceMs, onSettle)` — set thuộc tính transition (`data-transition`/hướng) lên `containerEl`, set
 * timing + class `.me-current`/`.me-layer-enter`/`.me-layer-exit` lên 2 layer để CSS animation chạy
 * (hoặc cắt cứng nếu `preset.transitionEnabled===false`), hẹn giờ, rồi gọi `onSettle()` khi
 * `outgoingEl` "xong việc" (animation/cắt cứng đã kết thúc, layer đó có thể bị TÁI SỬ DỤNG) — KHÔNG
 * đụng NỘI DUNG BÊN TRONG `outgoingEl`/`incomingEl` ở BẤT KỲ bước nào, KHÔNG giữ tham chiếu layer
 * nào giữa các lần gọi, KHÔNG biết "ảnh"/"video" là gì. Nơi gọi (workflowMotionEngine cho VBG, sau
 * này Video Player mode) tự:
 *   - Gán nội dung vào `incomingEl` TRƯỚC khi gọi `runTransition()` (VBG: `setMotionEngineLayerImage()`
 *     — Video: memory KHÔNG CẦN vì layer A/video đã có sẵn frame đóng băng).
 *   - Dọn nội dung `outgoingEl` BÊN TRONG `onSettle()` (VBG: gỡ background-image + revoke URL cũ —
 *     Video: opacity 0 + snap transform về gốc + gán src mới + đợi playing + opacity 1).
 *   - Tự giữ state "layer nào đang current"/"có resource nào đang hiện chưa" — Runner KHÔNG còn
 *     `hasResource()` nữa (VBG tự giữ field riêng của nó, xem event/workflow/motion-engine.js).
 *
 * TÁI DÙNG NGUYÊN các hàm THUẦN đã có sẵn (core/motion-engine.js) — KHÔNG viết lại:
 * setMotionEngineTransitionType()/setMotionEngineEdgeFlipOptions()/setMotionEngineTransitionDirections()/
 * resolveMotionEngineTransitionOption()/transitionSupportsInOutRatio()/
 * computeMotionEngineTransitionInOutMs()/capMotionEngineTransitionDurationMs()/
 * setMotionEngineTransitionTiming()/startMotionEngineTransitionVisuals()/
 * finishMotionEngineTransitionVisuals() — TẤT CẢ vốn ĐÃ nhận element/tham số qua đối số, KHÔNG hardcode
 * gì. 5 hằng số hướng (MOTION_ENGINE_TRANSITION_DIRECTIONS/...ZOOM.../...SPIN.../...WIPE.../
 * ...CURTAIN_DIRECTIONS, core/motion-presets.js) dùng THẲNG — hằng số toàn cục.
 *
 * `_resolveTransitionDirections()` (chọn cụ thể 1 giá trị khi field đang 'random', tự nhớ tránh lặp
 * lượt liền trước) VẪN nằm trong Runner — đây LÀ cơ chế thuần (không đụng nội dung/element cụ thể
 * nào), mỗi instance Runner tự giữ bộ nhớ RIÊNG của mình.
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (5 hằng số hướng), service/task-manager.js.
 * NẠP TRƯỚC: event/workflow/motion-engine.js (dùng làm Runner cho VBG).
 *
 * @param {string} taskName - tên task taskManager.once() dọn dẹp SAU transition — PHẢI duy nhất,
 *        không trùng nơi tiêu thụ khác (giống 2 Runner kia).
 * @returns {{runTransition: (containerEl: HTMLElement, outgoingEl: HTMLElement, incomingEl: HTMLElement, preset: object, advanceMs: number, onSettle?: () => void) => void,
 *            stop: () => void}}
 */
function createMotionTransitionRunner(taskName) {
    // Random riêng cho 5 field "hướng" của transition — CƠ CHẾ THUẦN, không đụng nội dung/element.
    let lastTransitionDirection = null;
    let lastTransitionZoomDirection = null;
    let lastTransitionSpinDirection = null;
    let lastTransitionWipeDirection = null;
    let lastTransitionCurtainDirection = null;
    // {outgoingEl, incomingEl, onSettle} của lượt runTransition() GẦN NHẤT còn đang chờ
    // taskManager.once() tới hẹn, null nếu đã settle.
    let pendingCleanup = null;

    /** Resolve 5 field "hướng" transition của `preset` — field nào ĐANG là 'random' thì chọn 1 giá
     * trị CỤ THỂ (loại trừ giá trị dùng lượt liền trước, tự nhớ ở `lastTransitionDirection`/...) rồi
     * CẬP NHẬT LUÔN "lượt vừa dùng" cho lần gọi kế tiếp; field CỤ THỂ giữ nguyên, KHÔNG đụng state nhớ.
     * @param {object} preset
     * @returns {{direction: string, zoomDirection: string, spinDirection: string, wipeDirection: string, curtainDirection: string}} */
    function _resolveTransitionDirections(preset) {
        const direction = resolveMotionEngineTransitionOption(preset.transitionDirection, MOTION_ENGINE_TRANSITION_DIRECTIONS, lastTransitionDirection); // core/core
        const zoomDirection = resolveMotionEngineTransitionOption(preset.transitionZoomDirection, MOTION_ENGINE_ZOOM_DIRECTIONS, lastTransitionZoomDirection); // core/core
        const spinDirection = resolveMotionEngineTransitionOption(preset.transitionSpinDirection, MOTION_ENGINE_SPIN_DIRECTIONS, lastTransitionSpinDirection); // core/core
        const wipeDirection = resolveMotionEngineTransitionOption(preset.transitionWipeDirection, MOTION_ENGINE_WIPE_DIRECTIONS, lastTransitionWipeDirection); // core/core
        const curtainDirection = resolveMotionEngineTransitionOption(preset.transitionCurtainDirection, MOTION_ENGINE_CURTAIN_DIRECTIONS, lastTransitionCurtainDirection); // core/core
        lastTransitionDirection = direction;
        lastTransitionZoomDirection = zoomDirection;
        lastTransitionSpinDirection = spinDirection;
        lastTransitionWipeDirection = wipeDirection;
        lastTransitionCurtainDirection = curtainDirection;
        return { direction, zoomDirection, spinDirection, wipeDirection, curtainDirection };
    }

    /** Ép lượt cleanup TRƯỚC (nếu còn treo) chạy NGAY thay vì chờ `taskManager.once()` tới hẹn —
     * gọi ở ĐẦU `runTransition()` (đảm bảo layer đích luôn sạch trước khi bắt đầu lượt mới — KHÔNG
     * còn cộng dồn `.me-layer-exit` cũ + `.me-layer-enter` mới lên cùng 1 layer nếu bị gọi dồn dập). */
    function _settlePending() {
        if (!pendingCleanup) return;
        taskManager.kill(taskName); // service/task-manager.js
        const { outgoingEl, incomingEl, onSettle } = pendingCleanup;
        finishMotionEngineTransitionVisuals(outgoingEl, incomingEl); // core — CHỈ đổi class, KHÔNG đụng nội dung
        pendingCleanup = null;
        if (onSettle) onSettle();
    }

    /** CHẠY 1 lượt Transition (hoặc cắt cứng nếu `preset.transitionEnabled===false`) giữa
     * `outgoingEl` (đang hiện) -> `incomingEl` (sắp hiện) — set thuộc tính transition lên
     * `containerEl`, set timing/class lên 2 layer để CSS animation chạy, hẹn giờ dọn dẹp SAU khi
     * kết thúc. KHÔNG đụng NỘI DUNG bên trong `outgoingEl`/`incomingEl` — nơi gọi tự gán nội dung
     * `incomingEl` TRƯỚC khi gọi hàm này, tự dọn nội dung `outgoingEl` BÊN TRONG `onSettle()`.
     * @param {HTMLElement} containerEl - nhận data-transition/hướng (SỞ HỮU của nơi gọi, KHÔNG cố
     *        định trong Runner — mỗi lần gọi tự truyền, cho phép nơi gọi đổi container giữa các lượt
     *        nếu cần).
     * @param {HTMLElement} outgoingEl @param {HTMLElement} incomingEl
     * @param {object} preset @param {number} advanceMs - thời lượng hiển thị SAU khi incomingEl
     *        "current" — dùng kẹp thời lượng transition (xem capMotionEngineTransitionDurationMs()).
     * @param {() => void} [onSettle] - gọi ĐÚNG 1 LẦN khi `outgoingEl` "xong việc" — animation/cắt
     *        cứng đã kết thúc, layer đó CÓ THỂ bị nơi gọi tái sử dụng/dọn/gán nội dung mới. */
    function runTransition(containerEl, outgoingEl, incomingEl, preset, advanceMs, onSettle) {
        _settlePending();

        if (!preset.transitionEnabled) {
            // CẮT CỨNG — đi THẲNG tới đúng trạng thái nghỉ mà 1 lượt Transition bình thường sẽ kết
            // thúc ở đó, KHÔNG qua bước enter/exit trung gian nào, KHÔNG animation.
            outgoingEl.classList.remove('me-current');
            incomingEl.classList.add('me-current');
            if (onSettle) onSettle();
            return;
        }

        setMotionEngineTransitionType(containerEl, preset.transitionType); // core
        setMotionEngineEdgeFlipOptions(containerEl, preset.edgeFlipVariant, preset.edgeFlipStaticOld); // core
        const dirs = _resolveTransitionDirections(preset);
        setMotionEngineTransitionDirections(containerEl, dirs.direction, dirs.zoomDirection, dirs.spinDirection, dirs.wipeDirection, dirs.curtainDirection); // core

        // advanceMs<=0 CHỈ xảy ra ở mode 'perSong' (2 nhánh còn lại có sàn cứng, không bao giờ về 0),
        // và perSong KHÔNG có tick tự động nào để tranh chấp — ảnh đổi lúc nào do BÀI HÁT đổi quyết
        // định, không đoán trước được, nên "kẹp để không bị tick cắt ngang" không áp dụng được cho
        // ca này — dùng THẲNG `preset.transitionDurationMs`, không kẹp theo interval.
        const totalMs = advanceMs > 0
            ? capMotionEngineTransitionDurationMs(preset.transitionDurationMs, advanceMs) // core
            : preset.transitionDurationMs;
        const { inMs, outMs } = transitionSupportsInOutRatio(preset.transitionType) // core
            ? computeMotionEngineTransitionInOutMs(totalMs, preset.transitionInOutRatio) // core
            : { inMs: totalMs, outMs: totalMs };
        setMotionEngineTransitionTiming(incomingEl, inMs, preset.transitionEasing); // core
        setMotionEngineTransitionTiming(outgoingEl, outMs, preset.transitionEasing); // core

        startMotionEngineTransitionVisuals(outgoingEl, incomingEl); // core
        const cleanupDelayMs = Math.max(inMs, outMs);
        pendingCleanup = { outgoingEl, incomingEl, onSettle }; // đọc bởi _settlePending() nếu lượt KẾ gọi tới trước khi timer dưới đây kịp chạy
        taskManager.once(() => { // service/task-manager.js
            finishMotionEngineTransitionVisuals(outgoingEl, incomingEl); // core
            pendingCleanup = null;
            if (onSettle) onSettle();
        }, cleanupDelayMs, taskName);
    }

    /** Dừng hẳn — huỷ timer cleanup còn treo (gọi `onSettle` NGAY nếu có, để nơi gọi vẫn kịp dọn
     * nội dung dở dang thay vì treo mãi) + reset bộ nhớ hướng random. KHÔNG đụng class/nội dung của
     * bất kỳ layer nào — Runner KHÔNG giữ tham chiếu layer cố định, nơi gọi tự lo dọn (thường qua
     * `resetMotionEngineLayerClasses()`, core/motion-engine.js, gọi trực tiếp không cần qua Runner). */
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
