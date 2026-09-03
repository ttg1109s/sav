/**
 * event/workflow/motion-engine.js — Motion Engine: RENDERER THUẦN cho transition/Point Move/React
 * Beat Audio của Visual Background (`type='photo'`). File này KHÔNG timer chuyển ảnh, KHÔNG biết
 * `source.list`/`nextOrder`/`listPlaybackMode`/`motionPresetId` tồn tại — CHỈ còn 4 hàm public:
 *   `reveal(imageKey, preset, advanceMs)`      — hiện ảnh ĐẦU tĩnh (Point Move/BeatReact áp được
 *                                     cho ảnh đơn, transition thì KHÔNG vì cần 2 ảnh để chuyển).
 *   `transitionTo(imageKey, preset, advanceMs)` — 1 lượt CHUYỂN từ ảnh đang hiện sang `imageKey`;
 *                                     trả `true` (thành công) / `false` (record mất — nơi gọi tự lo
 *                                     self-heal/thử lại, Engine KHÔNG tự thử index khác).
 *   `pause()`/`resume()`            — đóng băng/tiếp tục animation ĐANG chạy (nơi gọi tự quyết lúc
 *                                     nào — vd Song dừng/phát lại).
 *   `stop()`                        — dọn sạch layer/state.
 * `preset` LUÔN được TRUYỀN VÀO (đã resolve sẵn) — nơi gọi (workflowVisualBg) là chỗ DUY NHẤT đọc
 * `motionPresetId`/tra `appState.motionPresets` (xem `workflowVisualBg._currentMotionPreset()`).
 * `advanceMs` LUÔN được TRUYỀN VÀO — nơi gọi tự tính theo `durationMode`/`durationSeconds`/
 * `record.duration` của MÌNH (Engine không đọc field nào trong số đó nữa).
 *
 * Point Move (thay Ken Burns, phản hồi Giang) — KHÔNG có công tắc "enabled" riêng: mặc định chỉ có
 * đúng point move #0 (mọi field = 0, tức "không đổi") nên tự nhiên vô hại nếu Giang chưa thêm point
 * move nào khác — xem core/motion-presets.js. 2 chế độ chạy (`pointMoveRunMode`):
 *   'one' — `_activatePointMoveOne()`: chọn 1 point move (trong số đã tick) tween thẳng baseline ->
 *      target suốt `advanceMs`.
 *   'all' — `_activatePointMoveAll()`: sample đường cong Timing (`computePointMoveCurveIntensityAt()`,
 *      core) thành N keyframe rồi feed WAAPI easing 'linear' — xem `_buildPointMoveAllKeyframes()`.
 *
 * NẠP SAU: core/motion-engine.js, core/dom-refs.js (motionEngineContainer/motionEngineLayer1,2/
 * motionEngineLayer1,2Pan/motionEngineReactLayer), service/task-manager.js (chỉ còn dùng cho
 * MOTION_ENGINE_BEATREACT_TASK — animation per-frame CỦA ẢNH ĐANG HIỆN, KHÔNG phải hẹn giờ chuyển
 * ảnh — cái đó sống ở workflowVisualBg).
 */

/** Preset "tắt hết" — dùng khi nơi gọi truyền `null`/`undefined` (chưa gắn Motion) — KHÔNG fallback
 * về bất kỳ hiệu ứng mặc định nào. Vẫn export ở đây (không phải nơi gọi) vì đây là "hình dạng
 * preset hợp lệ tối thiểu", thuộc kiến thức của Engine. */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', pointMoves: [], pointMoveEnabled: false, pointMoveRunMode: 'all', pointMoveOneOrder: 'sequential', reactBeatAudio: { enabled: false, zoom: { enabled: false }, pan: { enabled: false }, rotate: { enabled: false } } };

/** Baseline "không đổi" — dùng làm điểm XUẤT PHÁT khi tween 'one' mode (baseline -> target). */
const POINT_MOVE_BASELINE_TARGET = { linearX: 0, linearXUnit: '%', linearY: 0, linearYUnit: '%', rotate: 0, zoom: 0, flipX: 0, flipY: 0 };

/** Số keyframe sample cho đường cong Timing ('all' mode) — càng cao càng mượt, đổi lại nặng hơn 1
 * chút cho `.animate()`. 50 mẫu (~2%/mẫu) đủ mượt cho mắt người ở tốc độ chuyển ảnh thông thường. */
const MOTION_ENGINE_POINT_MOVE_ALL_STEPS = 50;

// Task RAF RIÊNG, per-frame, CHỈ chạy khi preset đang HIỂN THỊ có `reactBeatAudio.enabled` + ít
// nhất 1 hiệu ứng con bật (xem `_syncBeatReactLoop()`) — animation của ẢNH ĐANG HIỆN, không phải
// hẹn giờ "khi nào chuyển ảnh" (sống ở workflowVisualBg).
const MOTION_ENGINE_BEATREACT_TASK = 'motionEngineBeatReactTick';
// Tốc độ decay envelope (đọc appState.beatScale mỗi frame, core/motion-engine.js::
// computeMotionEngineBeatReactEnvelope()) — 250ms đủ nhanh để cảm được nhịp, đủ chậm để không giật.
const MOTION_ENGINE_BEATREACT_DECAY_MS = 250;

const workflowMotionEngine = {
    _currentObjectUrl: null,
    _currentRecord: null,   // record ảnh ĐANG hiện — giữ lại để _activatePointMove() dùng mà không đọc DB lại
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2
    _isActive: false,       // Point Move/BeatReact animation ĐANG chạy (khác "đứng yên chờ") — pause()/resume() thao tác trên cờ này
    // Random riêng cho 5 field "hướng" của transition (xem resolveMotionEngineTransitionOption(), core).
    _lastTransitionDirection: null,
    _lastTransitionZoomDirection: null,
    _lastTransitionSpinDirection: null,
    _lastTransitionWipeDirection: null,
    _lastTransitionCurtainDirection: null,
    _lastPointMoveOneIndex: -1, // index (trong preset.pointMoves) dùng ở lượt 'one' mode LIỀN TRƯỚC — loại trừ, xem pickPointMoveOneIndexRandom()/Sequential() (core)
    _activePreset: MOTION_ENGINE_NO_OP_PRESET, // preset của LƯỢT HIỂN THỊ GẦN NHẤT — _tickBeatReact() (chạy mỗi frame, không có tham số) đọc lại từ đây
    _lastAdvanceMs: 5000, // advanceMs của LƯỢT HIỂN THỊ GẦN NHẤT (gán ở reveal()/transitionTo()) — _activatePointMove() dùng thẳng, KHÔNG tự tính nữa

    _beatReactActive: false,
    _beatReactEnvelope: 0,       // 0-1 — giá trị THẬT dùng tính transform (không phải beatScale thô), xem computeMotionEngineBeatReactEnvelope()
    _beatReactLastTickMs: 0,     // dùng tính deltaMs cho decay không phụ thuộc framerate — 0 = "lượt tick đầu, chưa có gì để trừ"
    _beatReactWasAttacking: false, // frame TRƯỚC: envelope đang ở pha "attack" (bắt theo beatScale) hay "decay" — dùng phát hiện rising-edge "beat mới" cho polarity pan/rotate leftToRight/rightToLeft
    _beatReactPanPolarity: 0,      // 1/-1 — cực HIỆN TẠI cho pan khi direction leftToRight/rightToLeft; 0 = CHƯA có lượt nào (xem computeMotionEngineBeatReactNextPolarity())
    _beatReactRotatePolarity: 0,   // tương tự, riêng cho rotate — pan/rotate có thể khác direction/reverse nên tách state riêng

    _currentLayer() { return this._layerToggle ? motionEngineLayer2 : motionEngineLayer1; },
    _idleLayer() { return this._layerToggle ? motionEngineLayer1 : motionEngineLayer2; },
    _currentPanLayer() { return this._layerToggle ? motionEngineLayer2Pan : motionEngineLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? motionEngineLayer1Pan : motionEngineLayer2Pan; },

    _pointMoveAnim1: null,
    _pointMoveAnim2: null,
    _getPointMoveAnim(panEl) { return panEl === motionEngineLayer1Pan ? this._pointMoveAnim1 : this._pointMoveAnim2; },
    _setPointMoveAnim(panEl, anim) {
        if (panEl === motionEngineLayer1Pan) this._pointMoveAnim1 = anim; else this._pointMoveAnim2 = anim;
    },

    /** Hiện ẢNH ĐẦU tĩnh (không transition — chỉ có 1 ảnh, chưa có ảnh "cũ" nào để chuyển từ đó) +
     * bật Point Move/BeatReact NGAY nếu `preset` có gì để chạy.
     * `imageKey` rỗng/null -> ẩn hẳn container, dọn sạch (coi như `stop()`).
     * @param {string|null} imageKey
     * @param {object} preset - ĐÃ resolve sẵn (MOTION_ENGINE_NO_OP_PRESET nếu chưa gắn Motion).
     * @param {number} advanceMs - thời lượng hiển thị ảnh NÀY — nơi gọi tự tính (durationMode/
     *        durationSeconds/record.duration đều thuộc VBG) — dùng làm thời lượng chạy Point Move.
     */
    async reveal(imageKey, preset, advanceMs) {
        this.stop();
        if (!imageKey) { setMotionEngineContainerVisible(motionEngineContainer, false); return; } // core
        setMotionEngineContainerVisible(motionEngineContainer, true); // core
        const ok = await this._loadImageIntoLayer(imageKey, this._currentPanLayer(), this._currentLayer());
        if (!ok) return; // record mất — nơi gọi (workflowVisualBg) tự lo self-heal, Engine không tự thử ảnh khác
        this._activePreset = preset;
        this._lastAdvanceMs = advanceMs;
        this._isActive = true;
        this._activatePointMove(this._currentPanLayer(), preset);
        this._syncBeatReactLoop();
    },

    /** 1 lượt CHUYỂN từ ảnh đang hiện sang `imageKey` — áp Transition/Point Move theo `preset`.
     * @param {string} imageKey
     * @param {object} preset
     * @param {number} advanceMs
     * @returns {Promise<boolean>} false nếu record mất (nơi gọi tự lo self-heal/thử ảnh khác, KHÔNG
     *   đổi gì trên layer — ảnh ĐANG hiện vẫn đứng yên).
     */
    async transitionTo(imageKey, preset, advanceMs) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !record.blob) return false;

        this._activePreset = preset;
        this._lastAdvanceMs = advanceMs;
        const image = record;
        this._currentRecord = image; // NGAY TẠI ĐÂY (không phải cuối hàm) — nếu sau này có chỗ nào cần duration ảnh SẮP hiện thì đã sẵn
        const objectUrl = URL.createObjectURL(image.blob);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setMotionEngineLayerImage(incomingPan, objectUrl); // core — LUÔN cần, bất kể có Transition hay không
        this._activatePointMove(incomingPan, preset);

        // transitionEnabled=false -> CẮT CỨNG, đi THẲNG tới đúng trạng thái nghỉ mà 1 lượt
        // Transition bình thường sẽ kết thúc ở đó (xem finishMotionEngineTransitionVisuals(), core),
        // KHÔNG qua bước enter/exit trung gian nào, KHÔNG animation.
        if (preset.transitionEnabled) {
            setMotionEngineTransitionType(motionEngineContainer, preset.transitionType); // core
            setMotionEngineEdgeFlipOptions(motionEngineContainer, preset.edgeFlipVariant, preset.edgeFlipStaticOld); // core
            const dirs = this._resolveTransitionDirections(preset);
            setMotionEngineTransitionDirections(motionEngineContainer, dirs.direction, dirs.zoomDirection, dirs.spinDirection, dirs.wipeDirection, dirs.curtainDirection); // core
            const totalMs = capMotionEngineTransitionDurationMs(preset.transitionDurationMs, advanceMs); // core
            const { inMs, outMs } = transitionSupportsInOutRatio(preset.transitionType) // core
                ? computeMotionEngineTransitionInOutMs(totalMs, preset.transitionInOutRatio) // core
                : { inMs: totalMs, outMs: totalMs };
            setMotionEngineTransitionTiming(incomingLayer, inMs, preset.transitionEasing); // core
            setMotionEngineTransitionTiming(outgoingLayer, outMs, preset.transitionEasing); // core

            startMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
            const cleanupDelayMs = Math.max(inMs, outMs);
            taskManager.once(() => { // service/task-manager.js
                setMotionEngineLayerImage(outgoingPan, ''); // core
                stopPointMoveAnimation(outgoingPan, this._getPointMoveAnim(outgoingPan)); // core
                this._setPointMoveAnim(outgoingPan, null);
                finishMotionEngineTransitionVisuals(outgoingLayer, incomingLayer); // core
            }, cleanupDelayMs, 'motionEngineTransitionCleanup');

            if (this._currentObjectUrl) {
                const staleUrl = this._currentObjectUrl;
                taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, cleanupDelayMs + 100, 'motionEngineRevokeStale');
            }
        } else {
            outgoingLayer.classList.remove('me-current');
            incomingLayer.classList.add('me-current');
            setMotionEngineLayerImage(outgoingPan, ''); // core
            stopPointMoveAnimation(outgoingPan, this._getPointMoveAnim(outgoingPan)); // core
            this._setPointMoveAnim(outgoingPan, null);
            if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} }
        }

        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;
        this._syncBeatReactLoop();
        return true;
    },

    /** Đọc record + gán ảnh vào layer (dùng CHUNG cho `reveal()` — KHÔNG dùng cho `transitionTo()`,
     * hàm đó tự inline vì cần cả outgoing/incoming layer cùng lúc). Trả false nếu record mất. */
    async _loadImageIntoLayer(imageKey, panEl, layerEl) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !record.blob) return false;
        const objectUrl = URL.createObjectURL(record.blob);
        this._currentObjectUrl = objectUrl;
        this._currentRecord = record;
        setMotionEngineLayerImage(panEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('me-current');
        setMotionEngineTransitionType(motionEngineContainer, this._activePreset.transitionType); // core — chỉ set thuộc tính, KHÔNG chạy animation nào ở đây
        setMotionEngineEdgeFlipOptions(motionEngineContainer, this._activePreset.edgeFlipVariant, this._activePreset.edgeFlipStaticOld); // core
        const revealDirs = this._resolveTransitionDirections(this._activePreset);
        setMotionEngineTransitionDirections(motionEngineContainer, revealDirs.direction, revealDirs.zoomDirection, revealDirs.spinDirection, revealDirs.wipeDirection, revealDirs.curtainDirection); // core
        return true;
    },

    /** Resolve 5 field "hướng" transition của `preset` — field nào ĐANG là 'random' thì chọn 1 giá
     * trị CỤ THỂ (loại trừ giá trị dùng lượt liền trước, tự nhớ ở `_lastTransitionDirection`/...)
     * rồi CẬP NHẬT LUÔN "lượt vừa dùng" cho lần gọi kế tiếp; field CỤ THỂ giữ nguyên, KHÔNG đụng
     * state nhớ. Gọi ở CẢ 2 nơi set data-attribute xuống DOM (`_loadImageIntoLayer()`/`transitionTo()`).
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

    /** Dispatcher — `pointMoveEnabled=false` -> bỏ qua HẲN (công tắc tổng, cùng khuôn
     * `transitionEnabled`). Nếu bật, chọn `_activatePointMoveOne()`/`_activatePointMoveAll()` theo
     * `preset.pointMoveRunMode`. Đây là Workflow (được phép rẽ nhánh chọn Core/logic nào chạy),
     * KHÔNG phải Core — Rule 1 (đơn tuyến) chỉ áp cho `core/`.
     * @param {HTMLElement} panEl - layer CON `.me-pointmove-pan` SẮP/ĐANG hiện.
     * @param {object} preset
     */
    _activatePointMove(panEl, preset) {
        if (!preset.pointMoveEnabled) return;
        if (preset.pointMoveRunMode === 'one') { this._activatePointMoveOne(panEl, preset); return; }
        this._activatePointMoveAll(panEl, preset);
    },

    /** 'one' mode — chọn ĐÚNG 1 point move (trong số đã tick) theo `pointMoveOneOrder`, tween
     * baseline -> target suốt `_lastAdvanceMs`. */
    _activatePointMoveOne(panEl, preset) {
        const checkedIndices = [];
        preset.pointMoves.forEach((p, i) => { if (p.checked) checkedIndices.push(i); });
        const pickFn = preset.pointMoveOneOrder === 'random' ? pickPointMoveOneIndexRandom : pickPointMoveOneIndexSequential; // core
        const index = pickFn(checkedIndices, this._lastPointMoveOneIndex);
        this._lastPointMoveOneIndex = index;
        if (index === -1) return; // không point move nào được tick (không nên xảy ra — #0 luôn checked — phòng hờ dữ liệu hỏng)
        const target = this._resolvePointMoveTarget(preset.pointMoves[index]);
        const keyframes = [
            { transform: buildPointMoveTransformString(POINT_MOVE_BASELINE_TARGET) }, // core
            { transform: buildPointMoveTransformString(target) }, // core
        ];
        const anim = startPointMoveAnimation(panEl, keyframes, this._lastAdvanceMs, 'ease-in-out'); // core
        this._setPointMoveAnim(panEl, anim);
    },

    /** 'all' mode — sample đường cong Timing của TẤT CẢ point move đã tick thành N keyframe, feed
     * WAAPI easing 'linear' (đường cong ĐÃ tự mượt qua sampling, easing khác sẽ làm méo lại). */
    _activatePointMoveAll(panEl, preset) {
        const checked = preset.pointMoves.filter((p) => p.checked);
        if (checked.length === 0) return;
        const points = checked
            .map((p) => ({ x: p.timingX, y: p.timingY, target: this._resolvePointMoveTarget(p) }))
            .sort((a, b) => a.x - b.x);
        const keyframes = this._buildPointMoveAllKeyframes(points);
        const anim = startPointMoveAnimation(panEl, keyframes, this._lastAdvanceMs, 'linear'); // core
        this._setPointMoveAnim(panEl, anim);
    },

    /** Resolve 6 field/point move thành giá trị SỐ THẬT (random range resolve 1 LẦN, giữ nguyên
     * suốt lượt hiển thị đó — không resolve lại mỗi frame). */
    _resolvePointMoveTarget(pointMove) {
        return {
            linearX: resolvePointMoveFieldValue(pointMove.linearX), linearXUnit: pointMove.linearX.unit, // core
            linearY: resolvePointMoveFieldValue(pointMove.linearY), linearYUnit: pointMove.linearY.unit, // core
            rotate: resolvePointMoveFieldValue(pointMove.rotate), // core
            zoom: resolvePointMoveFieldValue(pointMove.zoom), // core
            flipX: resolvePointMoveFieldValue(pointMove.flipX), // core
            flipY: resolvePointMoveFieldValue(pointMove.flipY), // core
        };
    },

    /** Sample `points` (đã sort theo `x`, mỗi phần tử {x,y,target}) thành mảng keyframe {transform}
     * — mỗi mẫu: (1) tìm đoạn [A,B] chứa `xPercent` (`_findPointMoveSegment()`) trong
     * `targetPoints` (= `points` + 1 node "vị trí ban đầu" ẢO chèn đầu, x=0/target trung tính —
     * phản hồi Giang: animation LUÔN xuất phát từ mốc trung tính CỐ ĐỊNH này trước khi tới point
     * move gần nhất, point move #0 KHÔNG còn bị ép đứng ở 0% nữa), lerp 6 field giữa `A.target`/
     * `B.target` theo tiến độ THỜI GIAN cục bộ trong đoạn đó; (2) nhân thêm cường độ `Y(xPercent)`
     * đọc từ `points` GỐC (`computePointMoveCurveIntensityAt()`, core — nội suy Catmull-Rom qua
     * ĐÚNG các node đã tick, KHÔNG tính node ảo — khớp nguyên trạng đường cong hiển thị trên SVG,
     * xem core/point-move-timing-ui.js) — 2 trục X (thời gian/vị trí target) và Y (cường độ) tách
     * biệt hoàn toàn, không giẫm chân nhau dù field nào đang randomRange (đã resolve xong 1 lần
     * trước khi vào đây).
     * @param {{x:number,y:number,target:object}[]} points
     * @returns {object[]}
     */
    _buildPointMoveAllKeyframes(points) {
        const targetPoints = [{ x: 0, y: 100, target: POINT_MOVE_BASELINE_TARGET }, ...points]; // node ảo "vị trí ban đầu" — CHỈ dùng nội suy target, không thuộc đường cong cường độ hiển thị
        const keyframes = [];
        for (let i = 0; i <= MOTION_ENGINE_POINT_MOVE_ALL_STEPS; i++) {
            const xPercent = (i / MOTION_ENGINE_POINT_MOVE_ALL_STEPS) * 100;
            const seg = this._findPointMoveSegment(targetPoints, xPercent);
            const intensity = computePointMoveCurveIntensityAt(points, xPercent) / 100; // core — dùng `points` GỐC, không phải `targetPoints`
            const v = {
                linearX: lerpPointMoveNumber(seg.a.target.linearX, seg.b.target.linearX, seg.progress) * intensity, // core
                linearXUnit: seg.a.target.linearXUnit,
                linearY: lerpPointMoveNumber(seg.a.target.linearY, seg.b.target.linearY, seg.progress) * intensity, // core
                linearYUnit: seg.a.target.linearYUnit,
                rotate: lerpPointMoveNumber(seg.a.target.rotate, seg.b.target.rotate, seg.progress) * intensity, // core
                zoom: lerpPointMoveNumber(seg.a.target.zoom, seg.b.target.zoom, seg.progress) * intensity, // core
                flipX: lerpPointMoveNumber(seg.a.target.flipX, seg.b.target.flipX, seg.progress) * intensity, // core
                flipY: lerpPointMoveNumber(seg.a.target.flipY, seg.b.target.flipY, seg.progress) * intensity, // core
            };
            keyframes.push({ transform: buildPointMoveTransformString(v) }); // core
        }
        return keyframes;
    },

    /** Tìm đoạn [A,B] (2 point move LIỀN KỀ trong `points`, đã sort theo `x`) chứa `xPercent`, +
     * tiến độ THỜI GIAN cục bộ (0-1) trong đoạn đó — plain JS thuần (không phải Core, Workflow được
     * tự do tính toán), KHÔNG liên quan `computePointMoveCurveIntensityAt()` (hàm đó tính CƯỜNG ĐỘ
     * trên toàn đường cong, hàm NÀY tìm 2 target để lerp — 2 việc độc lập nhau). */
    _findPointMoveSegment(points, xPercent) {
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
    },

    /** Đóng băng animation (Point Move + BeatReact) TẠI ĐÚNG VỊ TRÍ đang chạy — nơi gọi
     * (workflowVisualBg) tự quyết lúc nào (Song dừng). KHÔNG dừng hẳn (khác `stop()`) — `resume()`
     * tiếp tục đúng chỗ. */
    pause() {
        if (taskManager.plan[MOTION_ENGINE_BEATREACT_TASK]) taskManager.pause(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        pausePointMoveAnimation(this._pointMoveAnim1); // core
        pausePointMoveAnimation(this._pointMoveAnim2); // core
    },

    resume() {
        if (taskManager.plan[MOTION_ENGINE_BEATREACT_TASK]) taskManager.resume(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        resumePointMoveAnimation(this._pointMoveAnim1); // core
        resumePointMoveAnimation(this._pointMoveAnim2); // core
    },

    /** Dừng hẳn — dọn layer + object URL + reset bookkeeping. */
    stop() {
        taskManager.kill(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        this._beatReactActive = false;
        this._resetBeatReactTransform();
        setMotionEngineContainerVisible(motionEngineContainer, false); // core
        [[motionEngineLayer1, motionEngineLayer1Pan], [motionEngineLayer2, motionEngineLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
            stopPointMoveAnimation(panEl, this._getPointMoveAnim(panEl)); // core
            this._setPointMoveAnim(panEl, null);
            resetMotionEngineLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._currentRecord = null;
        this._isActive = false;
        this._lastTransitionDirection = null;
        this._lastTransitionZoomDirection = null;
        this._lastTransitionSpinDirection = null;
        this._lastTransitionWipeDirection = null;
        this._lastTransitionCurtainDirection = null;
        this._lastPointMoveOneIndex = -1;
        this._activePreset = MOTION_ENGINE_NO_OP_PRESET;
    },

    /** Bật/tắt vòng lặp per-frame react-beat. Gọi ở MỌI điểm `_activePreset` CÓ THỂ vừa đổi
     * (`reveal()`/`transitionTo()`). KHÔNG addNew() trùng tên nếu đã chạy sẵn (`_beatReactActive` guard). */
    _syncBeatReactLoop() {
        const rb = this._activePreset.reactBeatAudio;
        const shouldRun = this._isActive && rb.enabled && (rb.zoom.enabled || rb.pan.enabled || rb.rotate.enabled);
        if (shouldRun && !this._beatReactActive) {
            this._beatReactActive = true;
            this._beatReactEnvelope = 0; // bắt đầu vòng MỚI luôn từ baseline — không kế thừa envelope dở từ lượt trước
            this._beatReactLastTickMs = 0;
            this._beatReactWasAttacking = false;
            this._beatReactPanPolarity = 0;    // reset về "chưa có lượt nào" — lượt beat ĐẦU của ảnh/preset MỚI tự tính lại cực khởi đầu theo direction/reverse
            this._beatReactRotatePolarity = 0;
            taskManager.addNew(MOTION_ENGINE_BEATREACT_TASK, { time: 0, exe: () => this._tickBeatReact(), mode: 'raf', count: 0 }); // service/task-manager.js
            taskManager.operator(MOTION_ENGINE_BEATREACT_TASK, 'enabled');
        } else if (!shouldRun && this._beatReactActive) {
            this._beatReactActive = false;
            taskManager.kill(MOTION_ENGINE_BEATREACT_TASK);
            this._resetBeatReactTransform(); // về identity — tắt là về ngay baseline
        }
    },

    /** Xoá `transform` khỏi lớp react DUY NHẤT (identity, vô hình) — gọi lúc tắt hẳn beat-react VÀ
     * lúc `stop()` dọn toàn bộ MotionEngine. */
    _resetBeatReactTransform() {
        if (motionEngineReactLayer) motionEngineReactLayer.style.transform = '';
    },

    /** Tick per-frame (RAF) — đọc `beatScale` (năng lượng bass tức thời, 0-1, CÙNG tín hiệu mọi
     * hiệu ứng "beatscale" khác trong app) MỖI FRAME qua 1 bước ENVELOPE (attack tức thời theo đỉnh,
     * decay êm về nhưng KHÔNG khoá/gate gì cả — computeMotionEngineBeatReactEnvelope(), core). Mỗi
     * lần envelope CHUYỂN từ pha decay sang pha attack (rising edge — "beat mới", xem
     * `_beatReactWasAttacking`) thì ĐẢO cực (computeMotionEngineBeatReactNextPolarity(), core) cho
     * pan/rotate ĐANG dùng direction "leftToRight"/"rightToLeft" — 2 cực TÁCH RIÊNG (pan/rotate có
     * thể khác direction/reverse). Nội suy tuyến tính rồi CỘNG DỒN cả 3 hiệu ứng thành 1 chuỗi
     * `transform` áp lên lớp react DUY NHẤT (bao cả 2 player A/B). */
    _tickBeatReact() {
        const rb = this._activePreset.reactBeatAudio;
        if (!rb.enabled) { this._syncBeatReactLoop(); return; } // preset vừa bị gỡ/tắt beat-react giữa chừng -> tự dừng vòng lặp ĐÚNG NGAY frame này
        const now = performance.now();
        const deltaMs = this._beatReactLastTickMs ? (now - this._beatReactLastTickMs) : 16; // lượt tick đầu (chưa có mốc trước) -> giả định 1 frame ~16ms
        this._beatReactLastTickMs = now;
        const beatScale = appState.get('beatScale'); // service/state/visualizer-runtime.js — năng lượng bass tức thời, tính mỗi frame ở event/workflow/visualizer-render.js

        const isAttacking = beatScale >= this._beatReactEnvelope; // SO với envelope CŨ (trước khi update) — đúng điều kiện "attack" bên trong computeMotionEngineBeatReactEnvelope()
        const isNewBeat = isAttacking && !this._beatReactWasAttacking; // rising edge — vừa hết 1 đợt decay, bắt đầu attack MỚI = "beat mới"
        this._beatReactWasAttacking = isAttacking;
        if (isNewBeat) {
            if (rb.pan.direction === 'leftToRight' || rb.pan.direction === 'rightToLeft') {
                this._beatReactPanPolarity = computeMotionEngineBeatReactNextPolarity(this._beatReactPanPolarity, rb.pan.direction, rb.pan.reverse); // core
            }
            if (rb.rotate.direction === 'leftToRight' || rb.rotate.direction === 'rightToLeft') {
                this._beatReactRotatePolarity = computeMotionEngineBeatReactNextPolarity(this._beatReactRotatePolarity, rb.rotate.direction, rb.rotate.reverse); // core
            }
        }

        this._beatReactEnvelope = computeMotionEngineBeatReactEnvelope(this._beatReactEnvelope, beatScale, deltaMs, MOTION_ENGINE_BEATREACT_DECAY_MS); // core
        const energy = this._beatReactEnvelope;

        const zoomScale = rb.zoom.enabled ? computeMotionEngineBeatReactZoomScale(rb.zoom.maxPct, energy) : 1; // core
        const panPct = rb.pan.enabled ? computeMotionEngineBeatReactOffset(rb.pan.direction, rb.pan.maxPct - 100, energy, this._beatReactPanPolarity || 1) : 0; // core — trừ baseline 100% (cố định) trước khi truyền; polarity||1 phòng lượt ĐẦU (0) chưa kịp tính khi left/right (bỏ qua tham số này)
        const rotateDeg = rb.rotate.enabled ? computeMotionEngineBeatReactOffset(rb.rotate.direction, rb.rotate.maxDeg, energy, this._beatReactRotatePolarity || 1) : 0; // core — baseline 0° (cố định), không cần trừ

        if (motionEngineReactLayer) motionEngineReactLayer.style.transform = `scale(${zoomScale}) translateX(${panPct}%) rotate(${rotateDeg}deg)`;
    },
};
