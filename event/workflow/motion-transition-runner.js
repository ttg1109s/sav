/**
 * event/workflow/motion-transition-runner.js — "Transition Runner" DÙNG CHUNG cho MỌI nơi tiêu thụ
 * muốn chạy Transition (crossfade/cắt cứng giữa 2 layer) — TÁCH RA khỏi workflowMotionEngine, ĐÚNG
 * nguyên tắc "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi của mình và dùng cơ chế đó như gọi
 * API" (Giang chỉ ra) — CÙNG tinh thần 2 Runner đã làm (React Beat, Point Move).
 *
 * PHỨC TẠP HƠN 2 Runner kia — Transition không chỉ áp lên 1 target, mà quản lý NGUYÊN 1 CẶP layer
 * A/B LUÂN PHIÊN vai trò (`layerToggle`) + vòng đời object URL (nhận ownership lúc `showImage()`,
 * tự revoke lúc dọn) + timer dọn dẹp SAU khi animation CSS kết thúc (`taskManager.once()`).
 *
 * `createMotionTransitionRunner(taskName, layers)` — factory, trả về `{ showImage(), stop(),
 * hasResource() }`:
 *   `taskName` — tên task dọn dẹp SAU transition (taskManager.once(), PHẢI duy nhất — không trùng
 *   nơi tiêu thụ khác, giống taskName của 2 Runner kia).
 *   `layers` — `{ container, layer1, layer1Pan, layer2, layer2Pan }`, CỐ ĐỊNH lúc tạo runner
 *   (KHÔNG như target của React Beat/Point Move Runner — bộ 5 element NÀY luôn là CỦA RIÊNG 1 nơi
 *   tiêu thụ, không có khái niệm "dùng chung/di chuyển vào ra" như `motionEngineReactLayer`).
 *
 * `showImage(objectUrl, preset, advanceMs)` — GIAO ownership `objectUrl` cho Runner NGAY khi gọi
 * (Runner giữ/chuyển layer/revoke, nơi gọi KHÔNG revoke lại) — Runner TỰ QUYẾT hiện tĩnh (chưa có
 * gì trước đó, `hasResource()===false`) hay transition (đã có). KHÔNG tự xử lý `objectUrl` rỗng/null
 * (khác bản gốc `workflowMotionEngine.showImage()`) — nơi gọi (workflowMotionEngine, giờ là 1 "nơi
 * tiêu thụ" của chính Runner này) tự check rỗng rồi gọi `stop()` thẳng, vì rỗng/null nghĩa là "dừng
 * HẲN mọi thứ" (cả React Beat/Point Move — 2 Runner khác, Transition Runner không biết/không nên
 * biết chúng tồn tại) — KHÔNG chỉ riêng Transition.
 * `stop()` — dọn sạch layer + revoke URL đang giữ + huỷ timer dọn dẹp còn treo.
 * `hasResource()` — có đang giữ/hiện 1 resource hay không — nơi gọi dùng để tự quyết có nên
 * activate Point Move/React Beat hay không (Transition Runner không tự gọi 2 Runner đó — không
 * biết chúng tồn tại, đúng nguyên tắc tách bạch).
 *
 * TÁI DÙNG NGUYÊN các hàm THUẦN đã có sẵn (core/motion-engine.js) — KHÔNG viết lại:
 * setMotionEngineContainerVisible()/setMotionEngineLayerImage()/setMotionEngineTransitionType()/
 * setMotionEngineEdgeFlipOptions()/setMotionEngineTransitionDirections()/
 * resolveMotionEngineTransitionOption()/transitionSupportsInOutRatio()/
 * computeMotionEngineTransitionInOutMs()/capMotionEngineTransitionDurationMs()/
 * setMotionEngineTransitionTiming()/startMotionEngineTransitionVisuals()/
 * finishMotionEngineTransitionVisuals()/resetMotionEngineLayerClasses() — TẤT CẢ vốn ĐÃ nhận
 * element/tham số qua đối số, KHÔNG hardcode gì (giống Point Move — phần LÕI vốn đã đúng nguyên tắc
 * từ trước, chỉ tầng ĐIỀU PHỐI [file này] là chưa tách). 5 hằng số hướng
 * (MOTION_ENGINE_TRANSITION_DIRECTIONS/...ZOOM.../...SPIN.../...WIPE.../...CURTAIN_DIRECTIONS,
 * core/motion-presets.js) dùng THẲNG — hằng số toàn cục, không cần truyền qua tham số.
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (5 hằng số hướng), service/task-manager.js.
 * NẠP TRƯỚC: event/workflow/motion-engine.js (dùng làm Runner cho VBG).
 *
 * @param {string} taskName
 * @param {{container: HTMLElement, layer1: HTMLElement, layer1Pan: HTMLElement, layer2: HTMLElement, layer2Pan: HTMLElement}} layers
 * @returns {{showImage: (objectUrl: string, preset: object, advanceMs: number) => Promise<void>,
 *            stop: () => void, hasResource: () => boolean}}
 */
function createMotionTransitionRunner(taskName, layers) {
    let layerToggle = false; // false = layer1 đang 'current', true = layer2
    let hasCurrentResource = false; // ĐANG giữ/hiện 1 resource hay chưa — quyết showImage() gọi _staticReveal() hay _showNext()
    let currentObjectUrl = null;
    let pendingTransitionCleanup = null; // {outgoingLayer, outgoingPan, incomingLayer} của lượt _showNext() GẦN NHẤT còn đang chờ taskManager.once() tới hẹn, null nếu đã settle
    // Random riêng cho 5 field "hướng" của transition (xem resolveMotionEngineTransitionOption(), core).
    let lastTransitionDirection = null;
    let lastTransitionZoomDirection = null;
    let lastTransitionSpinDirection = null;
    let lastTransitionWipeDirection = null;
    let lastTransitionCurtainDirection = null;

    function _currentLayer() { return layerToggle ? layers.layer2 : layers.layer1; }
    function _idleLayer() { return layerToggle ? layers.layer1 : layers.layer2; }
    function _currentPanLayer() { return layerToggle ? layers.layer2Pan : layers.layer1Pan; }
    function _idlePanLayer() { return layerToggle ? layers.layer1Pan : layers.layer2Pan; }

    /** Ép lượt cleanup transition TRƯỚC (nếu còn treo) chạy NGAY thay vì chờ `taskManager.once()`
     * tới hẹn — gọi ở ĐẦU `_showNext()` (đảm bảo layer đích luôn sạch trước khi bắt đầu lượt mới —
     * KHÔNG còn cộng dồn `.me-layer-exit` cũ + `.me-layer-enter` mới lên cùng 1 layer khi
     * `showImage()` bị gọi dồn dập). */
    function _settlePendingTransition() {
        if (!pendingTransitionCleanup) return;
        taskManager.kill(taskName); // service/task-manager.js
        const { outgoingLayer, outgoingPan, incomingLayer } = pendingTransitionCleanup;
        setMotionEngineLayerImage(outgoingPan, ''); // core
        finishMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
        pendingTransitionCleanup = null;
    }

    /** Resolve 5 field "hướng" transition của `preset` — field nào ĐANG là 'random' thì chọn 1 giá
     * trị CỤ THỂ (loại trừ giá trị dùng lượt liền trước, tự nhớ ở `lastTransitionDirection`/...) rồi
     * CẬP NHẬT LUÔN "lượt vừa dùng" cho lần gọi kế tiếp; field CỤ THỂ giữ nguyên, KHÔNG đụng state
     * nhớ. Gọi ở CẢ 2 nơi set data-attribute xuống DOM (`_staticReveal()`/`_showNext()`).
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

    /** Internal — hiện resource ĐẦU tĩnh (chưa có resource "cũ" nào để transition từ đó). CHỈ gọi
     * từ `showImage()` khi `hasCurrentResource===false`. */
    async function _staticReveal(objectUrl, preset) {
        stop();
        setMotionEngineContainerVisible(layers.container, true); // core
        currentObjectUrl = objectUrl;
        const panEl = _currentPanLayer();
        const layerEl = _currentLayer();
        setMotionEngineLayerImage(panEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('me-current');
        setMotionEngineTransitionType(layers.container, preset.transitionType); // core — chỉ set thuộc tính, KHÔNG chạy animation
        setMotionEngineEdgeFlipOptions(layers.container, preset.edgeFlipVariant, preset.edgeFlipStaticOld); // core
        const revealDirs = _resolveTransitionDirections(preset);
        setMotionEngineTransitionDirections(layers.container, revealDirs.direction, revealDirs.zoomDirection, revealDirs.spinDirection, revealDirs.wipeDirection, revealDirs.curtainDirection); // core
        hasCurrentResource = true;
    }

    /** Internal — 1 lượt CHUYỂN từ resource đang hiện sang `objectUrl` — áp Transition theo
     * `preset`. CHỈ gọi từ `showImage()` khi `hasCurrentResource===true`. GIỮ NGUYÊN thứ tự
     * cleanup/URL gốc (capture `staleUrl` LOCAL trước khi gán `currentObjectUrl` mới, revoke qua
     * closure chứ không đọc lại biến lúc cleanup chạy).
     * @param {string} objectUrl @param {object} preset @param {number} advanceMs */
    async function _showNext(objectUrl, preset, advanceMs) {
        _settlePendingTransition();
        const outgoingLayer = _currentLayer();
        const incomingLayer = _idleLayer();
        const outgoingPan = _currentPanLayer();
        const incomingPan = _idlePanLayer();

        setMotionEngineLayerImage(incomingPan, objectUrl); // core — LUÔN cần, bất kể có Transition hay không

        // transitionEnabled=false -> CẮT CỨNG, đi THẲNG tới đúng trạng thái nghỉ mà 1 lượt
        // Transition bình thường sẽ kết thúc ở đó (xem finishMotionEngineTransitionVisuals(), core),
        // KHÔNG qua bước enter/exit trung gian nào, KHÔNG animation.
        if (preset.transitionEnabled) {
            setMotionEngineTransitionType(layers.container, preset.transitionType); // core
            setMotionEngineEdgeFlipOptions(layers.container, preset.edgeFlipVariant, preset.edgeFlipStaticOld); // core
            const dirs = _resolveTransitionDirections(preset);
            setMotionEngineTransitionDirections(layers.container, dirs.direction, dirs.zoomDirection, dirs.spinDirection, dirs.wipeDirection, dirs.curtainDirection); // core
            // advanceMs<=0 CHỈ xảy ra ở mode 'perSong' (2 nhánh còn lại có sàn cứng, không bao giờ
            // về 0), và perSong KHÔNG có tick tự động nào để tranh chấp — ảnh đổi lúc nào do BÀI HÁT
            // đổi quyết định, không đoán trước được, nên "kẹp để không bị tick cắt ngang" không áp
            // dụng được cho ca này — dùng THẲNG `preset.transitionDurationMs`, không kẹp theo interval.
            const totalMs = advanceMs > 0
                ? capMotionEngineTransitionDurationMs(preset.transitionDurationMs, advanceMs) // core
                : preset.transitionDurationMs;
            const { inMs, outMs } = transitionSupportsInOutRatio(preset.transitionType) // core
                ? computeMotionEngineTransitionInOutMs(totalMs, preset.transitionInOutRatio) // core
                : { inMs: totalMs, outMs: totalMs };
            setMotionEngineTransitionTiming(incomingLayer, inMs, preset.transitionEasing); // core
            setMotionEngineTransitionTiming(outgoingLayer, outMs, preset.transitionEasing); // core

            startMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
            const cleanupDelayMs = Math.max(inMs, outMs);
            pendingTransitionCleanup = { outgoingLayer, outgoingPan, incomingLayer }; // đọc bởi _settlePendingTransition() nếu lượt KẾ gọi tới trước khi timer dưới đây kịp chạy
            taskManager.once(() => { // service/task-manager.js
                setMotionEngineLayerImage(outgoingPan, ''); // core
                finishMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
                pendingTransitionCleanup = null;
            }, cleanupDelayMs, taskName);

            if (currentObjectUrl) {
                const staleUrl = currentObjectUrl;
                // taskManager.once() tên CỐ ĐỊNH tự huỷ bản cũ CÙNG tên khi gọi lại — KHÔNG dùng tên
                // cố định ở đây vì mỗi lượt đóng gói 1 `staleUrl` KHÁC NHAU qua closure, huỷ nhầm lượt
                // trước = URL đó rò rỉ vĩnh viễn. KHÔNG truyền `name` -> mỗi lượt tự sinh tên riêng.
                taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, cleanupDelayMs + 100);
            }
        } else {
            outgoingLayer.classList.remove('me-current');
            incomingLayer.classList.add('me-current');
            setMotionEngineLayerImage(outgoingPan, ''); // core
            if (currentObjectUrl) { try { URL.revokeObjectURL(currentObjectUrl); } catch (e) {} }
        }

        currentObjectUrl = objectUrl;
        layerToggle = !layerToggle;
    }

    /** Public — ĐIỂM VÀO DUY NHẤT để hiện 1 resource. Runner tự đọc `hasCurrentResource` CỦA CHÍNH
     * NÓ để quyết hiện tĩnh hay transition — nơi gọi KHÔNG cần/KHÔNG được biết đây là ảnh đầu hay
     * ảnh kế. KHÔNG tự xử lý `objectUrl` rỗng/null — xem docstring đầu file.
     * @param {string} objectUrl - ĐÃ resolve sẵn — Runner nhận ownership NGAY (giữ/chuyển layer/
     *        revoke), nơi gọi không revoke lại.
     * @param {object} preset @param {number} advanceMs - thời lượng hiển thị resource NÀY. */
    async function showImage(objectUrl, preset, advanceMs) {
        if (hasCurrentResource) { await _showNext(objectUrl, preset, advanceMs); return; }
        await _staticReveal(objectUrl, preset);
    }

    /** Dừng hẳn — dọn layer + object URL + reset bookkeeping. Huỷ trước task cleanup treo (nếu
     * còn) — KHÔNG cần tự chạy `_settlePendingTransition()` đầy đủ ở đây, vòng `forEach` dưới đã tự
     * reset CẢ 2 layer vô điều kiện. KHÔNG cần huỷ task revoke-URL tương ứng: nó không dùng tên cố
     * định nên không ai "chồng lượt" nó — để nó tự nổ trễ vẫn AN TOÀN. */
    function stop() {
        taskManager.kill(taskName); // service/task-manager.js
        pendingTransitionCleanup = null;
        setMotionEngineContainerVisible(layers.container, false); // core
        [[layers.layer1, layers.layer1Pan], [layers.layer2, layers.layer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
            resetMotionEngineLayerClasses(layerEl); // core
        });
        if (currentObjectUrl) { try { URL.revokeObjectURL(currentObjectUrl); } catch (e) {} currentObjectUrl = null; }
        hasCurrentResource = false;
        lastTransitionDirection = null;
        lastTransitionZoomDirection = null;
        lastTransitionSpinDirection = null;
        lastTransitionWipeDirection = null;
        lastTransitionCurtainDirection = null;
    }

    /** Đang giữ/hiện 1 resource hay không — nơi gọi dùng để tự quyết có nên activate Point
     * Move/React Beat (2 Runner khác — Transition Runner không biết/không nên biết chúng tồn tại). */
    function hasResource() { return hasCurrentResource; }

    return { showImage, stop, hasResource };
}
