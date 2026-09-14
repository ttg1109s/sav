/**
 * event/workflow/motion-engine.js — Motion Engine: RENDERER THUẦN cho transition/Point Move/React
 * Beat Audio của Visual Background (`type='photo'`). File này KHÔNG timer chuyển ảnh, KHÔNG biết
 * `source.list`/`nextOrder`/`listPlaybackMode`/`motionPresetId` tồn tại, KHÔNG biết ảnh đến từ đâu
 * (không tự đọc DB, không có khái niệm imageKey) — CHỈ còn 5 hàm public:
 *   `showImage(objectUrl, preset, advanceMs)` — hiện `objectUrl` lên layer hiện hành; Engine TỰ QUYẾT
 *                                     hiện tĩnh (chưa có ảnh nào) hay transition từ ảnh đang hiện sang
 *                                     (đã có), dựa trên `_hasCurrentResource` CỦA CHÍNH NÓ — nơi gọi
 *                                     không cần/không được biết đây là ảnh đầu hay ảnh kế.
 *                                     `objectUrl` rỗng/null -> coi như `stop()`.
 *   `updatePreset(preset, advanceMs)` — đổi preset đang áp cho ẢNH ĐANG HIỆN, KHÔNG đổi ảnh/không
 *                                     chạy transition — chỉ Point Move/React Beat đổi theo preset mới
 *                                     NGAY. No-op nếu chưa có ảnh nào (`_hasCurrentResource=false`).
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
 * SỬA (Giang chỉ ra: "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi của mình và sử dụng cơ chế
 * đó như thế nào, giống như gọi API" — audit sau khi làm xong React Beat) — TOÀN BỘ điều phối Point
 * Move (dispatcher 'one'/'all', đường cong Timing sample N keyframe, suy vị trí SỐNG liền mạch giữa
 * 2 lượt preset đổi, force-baseline start/end — cùng LỊCH SỬ đầy đủ các bug đã sửa qua nhiều lần
 * phản hồi) ĐÃ CHUYỂN HẲN sang `createMotionPointMoveRunner()` (event/workflow/motion-point-move-
 * runner.js, DÙNG CHUNG — đọc docstring file đó cho toàn bộ chi tiết cơ chế + lịch sử bugfix, giữ
 * NGUYÊN VẸN, không tóm tắt lại ở đây tránh 2 nguồn sự thật lệch nhau). File NÀY giờ CHỈ còn gọi
 * ĐÚNG lúc (`activateForNewContent()` ở `_staticReveal()`/`_showNext()`, `activateForPresetChange()`
 * ở `updatePreset()`, `liveToggle()` ở `livePointMoveToggle()`) qua 1 instance Runner LƯỜI
 * (`_pointMoveRunner`, xem `_ensurePointMoveRunner()`) — KHÔNG còn giữ state/logic gì của chính
 * Point Move nữa, y hệt React Beat đã làm trước đó (`_beatReactRunner`).
 *
 * Transition (2 layer A/B crossfade, `motionEngineLayer1`/`motionEngineLayer2`) — CHƯA rút ra Runner
 * dùng chung (audit cùng đợt, Giang đồng ý trì hoãn) — lõi CSS/timing (core/motion-engine.js) đã
 * nhận element qua tham số đúng chuẩn, chỉ tầng điều phối `_staticReveal()`/`_showNext()` ở file này
 * còn gắn cứng 2 layer — chưa có nơi tiêu thụ thứ 2 thật để đối chiếu hình dạng API đúng (Video có
 * cần crossfade 2 layer hay cơ chế khác hẳn — CHƯA quyết).
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (findMotionPresetById() — dùng ở
 * livePointMoveToggle()/_getBeatReactPreset()), event/workflow/motion-beat-react-runner.js
 * (createMotionBeatReactRunner()), event/workflow/motion-point-move-runner.js
 * (createMotionPointMoveRunner()), core/dom-refs.js (motionEngineContainer/
 * motionEnginePointMoveWrapper/motionEngineLayer1,2/motionEngineLayer1,2Pan/motionEngineReactLayer).
 * KHÔNG còn phụ thuộc service/task-manager.js trực tiếp (Point Move VÀ React Beat đều nằm HẲN trong
 * Runner riêng của chúng — file này chỉ còn dùng `taskManager.kill('motionEngineTransitionCleanup')`
 * cho Transition). KHÔNG còn phụ thuộc service/db.js — Engine không tự đọc record nữa (SỬA, tách
 * "resolve ảnh" khỏi "hiện ảnh").
 */

/** Preset "tắt hết" — dùng khi nơi gọi truyền `null`/`undefined` (chưa gắn Motion) — KHÔNG fallback
 * về bất kỳ hiệu ứng mặc định nào. Vẫn export ở đây (không phải nơi gọi) vì đây là "hình dạng
 * preset hợp lệ tối thiểu", thuộc kiến thức của Engine. */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', pointMoves: [], pointMoveEnabled: false, pointMoveRunMode: 'all', pointMoveOneOrder: 'sequential', pointMoveStartForceBaseline: false, pointMoveEndForceBaseline: false, reactBeatAudio: { enabled: false, zoom: { enabled: false }, pan: { enabled: false }, rotate: { enabled: false } } };

// POINT_MOVE_BASELINE_TARGET/MOTION_ENGINE_POINT_MOVE_ALL_STEPS ĐÃ XOÁ — dời hẳn vào
// event/workflow/motion-point-move-runner.js (POINT_MOVE_RUNNER_BASELINE_TARGET/
// POINT_MOVE_RUNNER_ALL_STEPS) cùng lúc rút toàn bộ điều phối Point Move ra Runner DÙNG CHUNG
// (Giang chỉ ra: "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi... giống gọi API").

// Task RAF RIÊNG, per-frame, CHỈ chạy khi preset đang HIỂN THỊ có `reactBeatAudio.enabled` + ít
// nhất 1 hiệu ứng con bật (xem `_syncBeatReactLoop()`) — animation của ẢNH ĐANG HIỆN, không phải
// hẹn giờ "khi nào chuyển ảnh" (sống ở workflowVisualBg).
const MOTION_ENGINE_BEATREACT_TASK = 'motionEngineBeatReactTick';
// Tốc độ decay envelope (đọc appState.beatScale mỗi frame, core/motion-engine.js::
// computeMotionEngineBeatReactEnvelope()) — 250ms đủ nhanh để cảm được nhịp, đủ chậm để không giật.
const MOTION_ENGINE_BEATREACT_DECAY_MS = 250;

const workflowMotionEngine = {
    _currentObjectUrl: null,
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2
    _hasCurrentResource: false, // Engine đang giữ/hiện 1 resource hay chưa — QUYẾT ĐỊNH showImage() gọi
        // _staticReveal() (chưa có) hay _showNext() (đã có, cần transition/hard-cut). KHÔNG liên quan
        // animation đang chạy hay đang pause — pause()/resume() KHÔNG đụng cờ này (chúng tự pause/resume
        // thẳng trên animation/task, xem pause()/resume() bên dưới). ĐỔI TÊN từ `_isActive` (SỬA — tên cũ
        // + comment cũ nói cờ này theo animation, nhưng thực tế pause()/resume() chưa từng đụng nó; giữ
        // tên sai dễ khiến người sau "sửa cho khớp comment" rồi phá logic showImage() dựa vào cờ này).
    _pendingTransitionCleanup: null, // {outgoingLayer, outgoingPan, incomingLayer} của lượt _showNext()
        // GẦN NHẤT còn đang chờ taskManager.once('motionEngineTransitionCleanup') tới hẹn, null nếu đã
        // settle. Đọc bởi _settlePendingTransition() — xem docstring hàm đó.
    // Random riêng cho 5 field "hướng" của transition (xem resolveMotionEngineTransitionOption(), core).
    _lastTransitionDirection: null,
    _lastTransitionZoomDirection: null,
    _lastTransitionSpinDirection: null,
    _lastTransitionWipeDirection: null,
    _lastTransitionCurtainDirection: null,
    // _lastPointMoveOneIndex ĐÃ XOÁ — dời vào Runner (xem _pointMoveRunner ngay dưới).
    _activePreset: MOTION_ENGINE_NO_OP_PRESET, // preset của LƯỢT HIỂN THỊ GẦN NHẤT — Transition đọc từ đây (Point Move giờ Runner tự giữ preset riêng qua tham số mỗi lệnh gọi)

    // SỬA (Giang chỉ ra — "tách bạch trách nhiệm motion phải quản lý apply live bất kể nơi tiêu
    // thụ" + "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi... giống gọi API") — 6 field
    // `_beatReact*` ĐÃ XOÁ trước đó (dời vào createMotionBeatReactRunner()); giờ THÊM 6 field Point
    // Move (`_pointMoveAnim`/`_activationStartAtRealTime`/`_lastAdvanceMs`/`_lastAllModePoints`/
    // `_lastAllModeDurationMs`/`_lastPointMoveOneIndex`) CŨNG XOÁ, dời hẳn vào
    // createMotionPointMoveRunner() (event/workflow/motion-point-move-runner.js) — Runner giữ state
    // RIÊNG của chính nó, VBG giờ chỉ còn giữ 2 THAM CHIẾU tới 2 instance.
    _beatReactRunner: null, // tạo LƯỜI — xem _ensureBeatReactRunner()
    _pointMoveRunner: null, // tạo LƯỜI — xem _ensurePointMoveRunner()

    _currentLayer() { return this._layerToggle ? motionEngineLayer2 : motionEngineLayer1; },
    _idleLayer() { return this._layerToggle ? motionEngineLayer1 : motionEngineLayer2; },
    _currentPanLayer() { return this._layerToggle ? motionEngineLayer2Pan : motionEngineLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? motionEngineLayer1Pan : motionEngineLayer2Pan; },

    // _lastAllModePoints/_lastAllModeDurationMs (snapshot đường cong 'all' mode cho
    // _deriveLivePointMoveTarget()) ĐÃ XOÁ khỏi ĐÂY — dời hẳn vào createMotionPointMoveRunner()
    // (event/workflow/motion-point-move-runner.js) cùng lúc rút toàn bộ điều phối Point Move.

    /** Gán preset ĐANG active + đẩy `appState.motionRunning` — DUY NHẤT 1 chỗ ghi state này. Motion
     * Engine là engine render THẬT, tự quyết "cái gì đang thật sự chạy" — khác `motionPresetId`
     * phía nơi tiêu thụ (đó là "đang CHỌN gì", vẫn có giá trị dù Engine chưa/không chạy gì). Preset
     * không có `.id` (MOTION_ENGINE_NO_OP_PRESET) -> `motionRunning` về null. Màn Edit Motion đọc
     * lại field này để biết mình có đang là preset ĐANG CHẠY hay không mà áp SỐNG toggle Point
     * Move (`livePointMoveToggle()` ngay dưới) — React Beat KHÔNG còn cần field này nữa, giờ dùng
     * broadcast chung `notifyMotionBeatReactPresetsChanged()` (event/workflow/motion-beat-react-
     * runner.js), phủ MỌI field + MỌI nơi tiêu thụ, không chỉ VBG.
     * @param {object} preset */
    _setActivePreset(preset) {
        this._activePreset = preset;
        appState.set('motionRunning', preset.id || null);
    },

    /** SỬA (đối chiếu đánh giá, mục concurrency — xử lý dứt điểm, không chỉ "cần test" nữa) — ép
     * lượt cleanup transition TRƯỚC (nếu còn treo) chạy NGAY thay vì chờ `taskManager.once()` tới
     * hẹn. Gọi ở ĐẦU `_showNext()` (đảm bảo layer đích luôn sạch trước khi bắt đầu lượt mới — KHÔNG
     * còn cộng dồn `.me-layer-exit` cũ + `.me-layer-enter` mới lên cùng 1 layer khi `showImage()` bị
     * gọi dồn dập) và trong `stop()` (kill timer treo, không cần chạy settle logic vì `stop()` đã tự
     * reset CẢ 2 layer vô điều kiện ngay sau đó — chỉ cần đảm bảo timer cũ không nổ TRỄ sau khi
     * `stop()`/lượt reveal kế tiếp đã xong, gắn nhầm class lên layer đã bị dùng lại). */
    _settlePendingTransition() {
        if (!this._pendingTransitionCleanup) return;
        taskManager.kill('motionEngineTransitionCleanup');
        const { outgoingLayer, outgoingPan, incomingLayer } = this._pendingTransitionCleanup;
        setMotionEngineLayerImage(outgoingPan, ''); // core
        finishMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
        this._pendingTransitionCleanup = null;
    },

    /** Public — ĐIỂM VÀO DUY NHẤT để hiện 1 resource. Engine tự đọc `_hasCurrentResource` CỦA CHÍNH
     * NÓ để quyết hiện tĩnh hay transition — nơi gọi (VBG) KHÔNG cần/KHÔNG được biết đây là ảnh đầu
     * hay ảnh kế, KHÔNG đọc `_hasCurrentResource`/gọi thẳng `_staticReveal()`/`_showNext()`.
     * @param {string|null} objectUrl - ĐÃ resolve sẵn (createBlobUrl(), service/blob-url.js) — Engine
     *        nhận ownership NGAY khi hàm này được gọi (giữ/chuyển layer/revoke), nơi gọi không revoke
     *        lại. Rỗng/null -> coi như `stop()`.
     * @param {object} preset - ĐÃ resolve sẵn (MOTION_ENGINE_NO_OP_PRESET nếu chưa gắn Motion).
     * @param {number} advanceMs - thời lượng hiển thị ảnh NÀY — nơi gọi tự tính, dùng làm thời lượng
     *        chạy Point Move/transition.
     */
    async showImage(objectUrl, preset, advanceMs) {
        if (!objectUrl) { this.stop(); return; }
        if (this._hasCurrentResource) { await this._showNext(objectUrl, preset, advanceMs); return; }
        await this._staticReveal(objectUrl, preset, advanceMs);
    },

    /** Public — đổi preset đang áp cho ẢNH ĐANG HIỆN tại chỗ: KHÔNG đổi ảnh, KHÔNG chạy transition,
     * chỉ Point Move/React Beat chuyển sang preset mới NGAY (`activateForPresetChange()` của Runner
     * tự tiếp diễn mượt từ vị trí thật đang hiển thị, không giật về baseline — xem docstring
     * event/workflow/motion-point-move-runner.js). No-op nếu chưa có resource nào đang hiện.
     * @param {object} preset - preset MỚI (MOTION_ENGINE_NO_OP_PRESET nếu chọn "Không") @param {number} advanceMs */
    updatePreset(preset, advanceMs) {
        if (!this._hasCurrentResource) return;
        this._setActivePreset(preset || MOTION_ENGINE_NO_OP_PRESET);
        this._ensurePointMoveRunner().activateForPresetChange(this._activePreset, advanceMs); // event/workflow/motion-point-move-runner.js
        this._syncBeatReactLoop();
    },

    /** Internal — hiện resource ĐẦU tĩnh (chưa có ảnh "cũ" nào để transition từ đó). CHỈ gọi từ
     * `showImage()` khi `_hasCurrentResource===false`.
     * SỬA (Giang yêu cầu đối chiếu invariant trước khi coi là xong) — bản `reveal()`/
     * `_loadImageIntoLayer()` cũ set `[data-transition]`/edge-flip/direction TRƯỚC khi
     * `_setActivePreset(preset)` chạy, nên vô tình dùng preset CŨ (NO_OP còn sót từ `stop()`) thay vì
     * preset thật. Hàm này gọi `_setActivePreset(preset)` TRƯỚC, dùng đúng `preset` tham số cho các
     * lệnh set attribute — ĐÃ XÁC MINH đổi thứ tự này không đổi bất kỳ hiển thị nào: mọi rule CSS
     * khớp `[data-transition=...]` (assets/css/motion-engine.css) đều SCOPE THEO `.me-layer-enter`/
     * `.me-layer-exit` — 2 class đó CHỈ được gắn trong `_showNext()` (transition thật), KHÔNG BAO GIỜ
     * gắn ở đây (`_staticReveal()` chỉ gắn `.me-current`, style của nó không phụ thuộc
     * `[data-transition]`); và trước khi `_showNext()` chạy transition đầu tiên, nó tự ghi đè lại
     * đúng attribute theo preset thật (dòng ~214) — nên attribute set ở ĐÂY chưa từng được CSS đọc
     * lúc còn giá trị cũ. Không cần giữ nguyên thứ tự gốc. */
    async _staticReveal(objectUrl, preset, advanceMs) {
        this.stop();
        setMotionEngineContainerVisible(motionEngineContainer, true); // core
        this._currentObjectUrl = objectUrl;
        const panEl = this._currentPanLayer();
        const layerEl = this._currentLayer();
        setMotionEngineLayerImage(panEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('me-current');
        this._setActivePreset(preset);
        setMotionEngineTransitionType(motionEngineContainer, preset.transitionType); // core — chỉ set thuộc tính, KHÔNG chạy animation
        setMotionEngineEdgeFlipOptions(motionEngineContainer, preset.edgeFlipVariant, preset.edgeFlipStaticOld); // core
        const revealDirs = this._resolveTransitionDirections(preset);
        setMotionEngineTransitionDirections(motionEngineContainer, revealDirs.direction, revealDirs.zoomDirection, revealDirs.spinDirection, revealDirs.wipeDirection, revealDirs.curtainDirection); // core
        this._hasCurrentResource = true;
        this._ensurePointMoveRunner().activateForNewContent(preset, advanceMs); // event/workflow/motion-point-move-runner.js
        this._syncBeatReactLoop();
    },

    /** Internal — 1 lượt CHUYỂN từ resource đang hiện sang `objectUrl` — áp Transition/Point Move
     * theo `preset`. CHỈ gọi từ `showImage()` khi `_hasCurrentResource===true`. GIỮ NGUYÊN thứ tự
     * cleanup/URL của bản `transitionTo()` cũ (capture `staleUrl` LOCAL trước khi gán
     * `_currentObjectUrl` mới, revoke qua closure chứ không đọc lại field lúc cleanup chạy).
     * SỬA (đối chiếu đánh giá, mục concurrency) — gọi `_settlePendingTransition()` NGAY ĐẦU hàm:
     * nếu `showImage()` bị gọi dồn dập (lượt TRƯỚC chưa kịp cleanup — vd đổi nguồn/preset nhanh tay
     * giữa lúc 1 transition đang chạy), layer đích của lượt NÀY có thể vẫn còn `.me-layer-exit`/
     * `.me-layer-enter` sót lại từ lượt TRƯỚC (KHÔNG được `startMotionEngineTransitionVisuals()`
     * dưới đây tự dọn — nó chỉ THÊM class, không gỡ class cũ) — cộng dồn 2 lượt lên cùng 1 layer sẽ
     * xung đột animation. `_settlePendingTransition()` ép lượt cleanup TRƯỚC chạy NGAY (thay vì đợi
     * timer), đưa layer về trạng thái sạch trước khi lượt MỚI bắt đầu — không còn cần "lượt mới nhất
     * tự dọn đúng layer" (nhận định cũ SAI — lượt mới không hề gỡ class cũ, chỉ thêm class mới).
     * @param {string} objectUrl @param {object} preset @param {number} advanceMs */
    async _showNext(objectUrl, preset, advanceMs) {
        this._settlePendingTransition();
        this._setActivePreset(preset);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setMotionEngineLayerImage(incomingPan, objectUrl); // core — LUÔN cần, bất kể có Transition hay không
        this._ensurePointMoveRunner().activateForNewContent(preset, advanceMs); // event/workflow/motion-point-move-runner.js — SỬA (phản hồi Giang) — KHÔNG còn theo layer, activate CHUNG cho cả 2 (trên motionEnginePointMoveWrapper)

        // transitionEnabled=false -> CẮT CỨNG, đi THẲNG tới đúng trạng thái nghỉ mà 1 lượt
        // Transition bình thường sẽ kết thúc ở đó (xem finishMotionEngineTransitionVisuals(), core),
        // KHÔNG qua bước enter/exit trung gian nào, KHÔNG animation.
        if (preset.transitionEnabled) {
            setMotionEngineTransitionType(motionEngineContainer, preset.transitionType); // core
            setMotionEngineEdgeFlipOptions(motionEngineContainer, preset.edgeFlipVariant, preset.edgeFlipStaticOld); // core
            const dirs = this._resolveTransitionDirections(preset);
            setMotionEngineTransitionDirections(motionEngineContainer, dirs.direction, dirs.zoomDirection, dirs.spinDirection, dirs.wipeDirection, dirs.curtainDirection); // core
            // SỬA (Giang báo — perSong transition không theo cài đặt Motion) — capMotionEngineTransitionDurationMs()
            // kẹp transition NGẮN HƠN khoảng cách tới lượt tick TỰ ĐỘNG kế tiếp (đúng cho slideshow —
            // xem docstring hàm đó, core/motion-engine.js) — nhưng `advanceMs<=0` CHỈ xảy ra ở mode
            // 'perSong' (_computePhotoAdvanceMs() — 2 nhánh còn lại có sàn cứng 500ms/1000ms, không
            // bao giờ về 0), và perSong KHÔNG có tick tự động nào để tranh chấp (`_syncPhotoTicking()`
            // tắt hẳn hẹn giờ khi `listPlaybackMode==='perSong'`) — ảnh đổi lúc nào là do BÀI HÁT đổi
            // quyết định, không đoán trước được, nên "kẹp để không bị tick cắt ngang" không áp dụng
            // được cho ca này. Trước đây vẫn gọi chung 1 hàm nên advanceMs=0 bị hiểu nhầm thành
            // "khoảng cách 0ms", kẹp cứng transition xuống còn 300ms (MOTION_ENGINE_TRANSITION_MIN_TIME_MS)
            // bất kể preset cấu hình bao nhiêu. Giờ perSong dùng THẲNG `preset.transitionDurationMs`,
            // không kẹp theo interval.
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
            this._pendingTransitionCleanup = { outgoingLayer, outgoingPan, incomingLayer }; // đọc bởi _settlePendingTransition() nếu lượt KẾ gọi tới trước khi timer dưới đây kịp chạy
            taskManager.once(() => { // service/task-manager.js
                setMotionEngineLayerImage(outgoingPan, ''); // core
                finishMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
                this._pendingTransitionCleanup = null;
            }, cleanupDelayMs, 'motionEngineTransitionCleanup');

            if (this._currentObjectUrl) {
                const staleUrl = this._currentObjectUrl;
                // taskManager.once() tên CỐ ĐỊNH tự huỷ bản cũ CÙNG tên khi gọi lại (xem docstring
                // taskManager.once(), service/task-manager.js dòng ~38-41) — KHÔNG dùng tên cố định
                // ở đây vì mỗi lượt đóng gói 1 `staleUrl` KHÁC NHAU qua closure, huỷ nhầm lượt trước
                // = URL đó rò rỉ vĩnh viễn. KHÔNG truyền `name` -> mỗi lượt tự sinh tên riêng, luôn
                // chạy đủ, không lượt nào đè lượt nào (khác `motionEngineTransitionCleanup` ở trên —
                // task đó ĐÚNG khi debounce theo tên, vì `_settlePendingTransition()` đã đảm bảo lượt
                // TRƯỚC luôn được ép chạy xong trước khi lượt SAU kịp đăng ký task cùng tên).
                taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, cleanupDelayMs + 100);
            }
        } else {
            outgoingLayer.classList.remove('me-current');
            incomingLayer.classList.add('me-current');
            setMotionEngineLayerImage(outgoingPan, ''); // core
            if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} }
        }

        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;
        this._syncBeatReactLoop();
    },

    /** Resolve 5 field "hướng" transition của `preset` — field nào ĐANG là 'random' thì chọn 1 giá
     * trị CỤ THỂ (loại trừ giá trị dùng lượt liền trước, tự nhớ ở `_lastTransitionDirection`/...)
     * rồi CẬP NHẬT LUÔN "lượt vừa dùng" cho lần gọi kế tiếp; field CỤ THỂ giữ nguyên, KHÔNG đụng
     * state nhớ. Gọi ở CẢ 2 nơi set data-attribute xuống DOM (`_staticReveal()`/`_showNext()`).
     * @param {object} preset
     * @returns {{direction: string, zoomDirection: string, spinDirection: string, wipeDirection: string, curtainDirection: string}}
     */
    _resolveTransitionDirections(preset) {
        const direction = resolveMotionEngineTransitionOption(preset.transitionDirection, MOTION_ENGINE_TRANSITION_DIRECTIONS, this._lastTransitionDirection); // core/core
        const zoomDirection = resolveMotionEngineTransitionOption(preset.transitionZoomDirection, MOTION_ENGINE_ZOOM_DIRECTIONS, this._lastTransitionZoomDirection); // core/core
        const spinDirection = resolveMotionEngineTransitionOption(preset.transitionSpinDirection, MOTION_ENGINE_SPIN_DIRECTIONS, this._lastTransitionSpinDirection); // core/core
        const wipeDirection = resolveMotionEngineTransitionOption(preset.transitionWipeDirection, MOTION_ENGINE_WIPE_DIRECTIONS, this._lastTransitionWipeDirection); // core/core
        const curtainDirection = resolveMotionEngineTransitionOption(preset.transitionCurtainDirection, MOTION_ENGINE_CURTAIN_DIRECTIONS, this._lastTransitionCurtainDirection); // core/core
        this._lastTransitionDirection = direction;
        this._lastTransitionZoomDirection = zoomDirection;
        this._lastTransitionSpinDirection = spinDirection;
        this._lastTransitionWipeDirection = wipeDirection;
        this._lastTransitionCurtainDirection = curtainDirection;
        return { direction, zoomDirection, spinDirection, wipeDirection, curtainDirection };
    },

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionPointMoveRunner()` cho Point Move của VBG —
     * target CỐ ĐỊNH `motionEnginePointMoveWrapper` (VBG luôn sở hữu nó tại chỗ). SỬA (Giang chỉ
     * ra: "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi của mình... giống gọi API") — toàn bộ
     * điều phối Point Move (dispatcher 'one'/'all', đường cong Timing, force-baseline, suy vị trí
     * SỐNG liền mạch...) ĐÃ CHUYỂN HẲN sang Runner DÙNG CHUNG (event/workflow/motion-point-move-
     * runner.js) — file NÀY giờ CHỈ còn gọi ĐÚNG lúc (`activateForNewContent()` ở `_staticReveal()`/
     * `_showNext()`, `activateForPresetChange()` ở `updatePreset()`), KHÔNG còn giữ state/logic gì
     * của chính Point Move nữa.
     * @returns {ReturnType<typeof createMotionPointMoveRunner>} */
    _ensurePointMoveRunner() {
        if (!this._pointMoveRunner) {
            this._pointMoveRunner = createMotionPointMoveRunner(() => motionEnginePointMoveWrapper); // event/workflow/motion-point-move-runner.js, core/dom-refs.js
        }
        return this._pointMoveRunner;
    },

    // ===================== Toggle sống từ màn Edit Motion (phản hồi Giang — "off/on Point
    // move giữa lúc ảnh đang hiện phải áp NGAY, không đợi ảnh đổi") =====================
    // `workflowMotionPresets` gọi THẲNG sang ĐÂY (KHÔNG qua nơi tiêu thụ nào — Motion Engine +
    // Motion Preset cùng 1 domain "Motion", nơi tiêu thụ có thể là bất kỳ ai trong tương lai, Motion
    // không cần/không nên biết) mỗi lần công tắc tổng Point Move đổi — event-driven (Giang chốt,
    // phương án B) thay vì 1 task liên tục poll state (phương án A, tốn hiệu năng vô ích vì thay
    // đổi CHỈ đến từ 1 hành động bấm rời rạc của người dùng). Hàm dưới tự guard bằng
    // `appState.motionRunning` (SSOT "preset nào đang THẬT SỰ render" do chính `_setActivePreset()`
    // ghi — KHÁC `motionPresetId` phía nơi tiêu thụ, đó là "đang CHỌN gì") — caller (workflowMotionPresets)
    // cũng tự check field này TRƯỚC khi gọi (tránh gọi thừa), 2 lớp guard không xung đột.

    /** Bật/tắt Point Move SỐNG — CHỈ có tác dụng nếu `presetId` TRÙNG `appState.motionRunning`
     * (preset đang THẬT SỰ render, xem `_setActivePreset()`) — sửa preset KHÁC preset đang chạy
     * thì bỏ qua, không có gì đang chạy cũng bỏ qua. Đồng bộ `_activePreset` rồi giao THẲNG cho
     * Runner (`liveToggle()`, event/workflow/motion-point-move-runner.js) — Runner tự lo dừng/dựng
     * lại + nhảy đúng mốc thời gian, VBG chỉ còn việc GUARD "đúng preset đang chạy hay không".
     * @param {string} presetId @param {boolean} enabled
     */
    livePointMoveToggle(presetId, enabled) {
        if (!this._hasCurrentResource || appState.get('motionRunning') !== presetId) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), presetId); // core/motion-presets.js
        if (!preset) return;
        this._setActivePreset(preset); // đồng bộ bản cache theo đúng dữ liệu vừa lưu (enabled mới)
        this._ensurePointMoveRunner().liveToggle(preset, enabled); // event/workflow/motion-point-move-runner.js
    },


    /** Đóng băng animation (Point Move + BeatReact) TẠI ĐÚNG VỊ TRÍ đang chạy — nơi gọi
     * (workflowVisualBg) tự quyết lúc nào (Song dừng). KHÔNG dừng hẳn (khác `stop()`) — `resume()`
     * tiếp tục đúng chỗ. */
    pause() {
        if (this._beatReactRunner) this._beatReactRunner.pause(); // event/workflow/motion-beat-react-runner.js
        if (this._pointMoveRunner) this._pointMoveRunner.pause(); // event/workflow/motion-point-move-runner.js
    },

    resume() {
        if (this._beatReactRunner) this._beatReactRunner.resume(); // event/workflow/motion-beat-react-runner.js
        if (this._pointMoveRunner) this._pointMoveRunner.resume(); // event/workflow/motion-point-move-runner.js
    },

    /** Dừng hẳn — dọn layer + object URL + reset bookkeeping.
     * SỬA — huỷ trước task `'motionEngineTransitionCleanup'` + clear `_pendingTransitionCleanup`
     * (nếu đang chờ từ 1 lượt `_showNext()` chưa kịp cleanup) — nếu không, callback đó có thể nổ
     * TRỄ sau khi `stop()` đã dọn xong (hoặc sau khi 1 lượt reveal MỚI đã dùng lại đúng 2 layer đó),
     * gắn nhầm `.me-current`/xoá nhầm ảnh MỚI. KHÔNG cần tự chạy `_settlePendingTransition()` đầy đủ
     * ở đây — vòng `forEach` dưới đã tự reset CẢ 2 layer vô điều kiện, không cần chạy lại. KHÔNG cần
     * huỷ revoke-URL task tương ứng: nó không còn dùng tên cố định (xem `_showNext()`) nên không ai
     * "chồng lượt" nó — để nó tự nổ trễ vẫn AN TOÀN (revoke 1 URL không còn cần dùng không bao giờ
     * là lỗi, chỉ cần đảm bảo nó CÓ chạy, không cần đảm bảo chạy ĐÚNG LÚC). */
    stop() {
        taskManager.kill('motionEngineTransitionCleanup');
        this._pendingTransitionCleanup = null;
        if (this._beatReactRunner) this._beatReactRunner.stop(); // event/workflow/motion-beat-react-runner.js — kill task + trả transform về rỗng
        if (this._pointMoveRunner) this._pointMoveRunner.stop(); // event/workflow/motion-point-move-runner.js — dừng animation + dọn state suy tiếp
        setMotionEngineContainerVisible(motionEngineContainer, false); // core
        [[motionEngineLayer1, motionEngineLayer1Pan], [motionEngineLayer2, motionEngineLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
            resetMotionEngineLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._hasCurrentResource = false;
        this._lastTransitionDirection = null;
        this._lastTransitionZoomDirection = null;
        this._lastTransitionSpinDirection = null;
        this._lastTransitionWipeDirection = null;
        this._lastTransitionCurtainDirection = null;
        this._setActivePreset(MOTION_ENGINE_NO_OP_PRESET);
    },

    /** Preset dùng cho React Beat Audio — gọi bởi Runner LÚC `sync()` (event-driven, KHÔNG mỗi
     * frame, xem event/workflow/motion-beat-react-runner.js). Tra LẠI theo id (KHÔNG dùng thẳng
     * `this._activePreset` — object đó có thể đã CŨ nếu preset bị sửa nội dung SAU lúc gán, Motion
     * Edit thay hẳn bằng object MỚI mỗi lần lưu field bất kỳ, xem event/workflow/motion-presets.js
     * ::_mutateEditing()) — SỬA bug (Giang chỉ ra qua soát lại): trước đây chỉ
     * `reactBeatAudio.enabled` có kênh "đẩy" cache riêng (`liveBeatReactToggle()`, ĐÃ XOÁ — thay
     * bằng broadcast chung), mọi field khác (vd `zoom.maxPct`) sửa xong KHÔNG live theo — giờ tra
     * tươi Ở ĐÂY thì LUÔN bắt đúng bản mới nhất, không sót field nào. `id` giữ NGUYÊN dù nội dung
     * đổi (chỉ object reference đổi), nên tra theo id vẫn đúng.
     * @returns {object|null} */
    _getBeatReactPreset() {
        if (!this._hasCurrentResource) return null;
        const presetId = this._activePreset.id;
        if (!presetId) return null; // MOTION_ENGINE_NO_OP_PRESET (chưa gắn gì) không có field `id`
        const preset = findMotionPresetById(appState.get('motionPresets'), presetId) || this._activePreset; // core/motion-presets.js — preset vừa bị XOÁ hẳn (hiếm) -> fallback bản cache cũ
        const rb = preset.reactBeatAudio;
        return (rb.enabled && (rb.zoom.enabled || rb.pan.enabled || rb.rotate.enabled)) ? preset : null;
    },

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionBeatReactRunner()` cho React Beat của VBG —
     * target CỐ ĐỊNH `motionEngineReactLayer` (VBG luôn sở hữu nó tại chỗ — KHÁC Video Player mode,
     * nơi phải TỰ di chuyển nội dung của mình vào/ra element này, xem event/workflow/video-player.js).
     * @returns {{sync: () => void, stop: () => void, pause: () => void, resume: () => void}} */
    _ensureBeatReactRunner() {
        if (!this._beatReactRunner) {
            this._beatReactRunner = createMotionBeatReactRunner( // event/workflow/motion-beat-react-runner.js
                MOTION_ENGINE_BEATREACT_TASK, // giữ NGUYÊN tên task cũ — không đổi cách debug taskManager.plan[...]
                () => motionEngineReactLayer, // core/dom-refs.js
                () => this._getBeatReactPreset(),
            );
        }
        return this._beatReactRunner;
    },

    /** Bật/tắt React Beat Audio CHO ĐÚNG hiện trạng — gọi ở MỌI điểm `_activePreset` CÓ THỂ vừa đổi
     * (`_staticReveal()`/`_showNext()`/`updatePreset()`). CHỈ còn 1 dòng gọi thẳng Runner — KHÔNG
     * tự quản lý task/state gì nữa (xem event/workflow/motion-beat-react-runner.js). */
    _syncBeatReactLoop() {
        this._ensureBeatReactRunner().sync();
    },
};
