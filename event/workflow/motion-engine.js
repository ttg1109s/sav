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
 * Point Move (thay Ken Burns, phản hồi Giang) — công tắc tổng `pointMoveEnabled` (cùng khuôn
 * `transitionEnabled`, xem `_activatePointMove()`). SỬA (phản hồi Giang — "point move phải là 1
 * div cha bao quanh layer A, B chứ không phải chỉ A hoặc B, tránh việc move A rồi lộ B") — transform
 * áp lên `motionEnginePointMoveWrapper` DUY NHẤT (bọc CHUNG cả 2 layer A/B, xem core/dom-refs.js),
 * KHÔNG còn tách riêng per-layer — mỗi lượt `reveal()`/`transitionTo()` tự DỪNG animation lượt
 * TRƯỚC trên phần tử đó rồi mới bắt animation MỚI (`_activatePointMove()` tự lo, xem docstring hàm
 * đó). 2 chế độ chạy (`pointMoveRunMode`):
 *   'one' — `_activatePointMoveOne()`: chọn 1 point move (trong số đã tick) tween thẳng baseline ->
 *      target suốt `advanceMs`.
 *   'all' — `_activatePointMoveAll()`: nội suy tuyến tính TỪNG SEGMENT theo `timingX` giữa 2 point
 *      move liền kề, sample thành N keyframe — xem `_buildPointMoveAllKeyframes()`.
 *
 * SỬA (phản hồi Giang — bug "point move cuối cùng bị kéo cứng về baseline lúc transition/chuyển
 * ảnh, thậm chí không thấy animation") — NGUYÊN NHÂN GỐC: bản trước chỉ vá keyframe ĐẦU tiên bằng
 * `getComputedStyle()` (vị trí thật), còn TOÀN BỘ đường cong phía sau vẫn tính độc lập từ 1 mốc ẢO
 * cố định ở x=0 (baseline) — 2% thời lượng ĐẦU tiên (keyframe 0->1) vì vậy nhảy CỰC NHANH từ vị trí
 * thật về gần baseline trước khi mới đi tiếp theo đường cong thật, nhìn như cắt cứng. FIX: mốc ẢO ở
 * x=0 giờ ĐỘNG — `pointMoveStartForceBaseline` (core/motion-presets.js) quyết định mốc đó là
 * baseline CỐ ĐỊNH (bật) hay chính vị trí THẬT suy ra từ đường cong LƯỢT TRƯỚC (tắt, mặc định — xem
 * `_deriveLivePointMoveTarget()`, tái dùng `_findPointMoveSegment()`/`lerpPointMoveNumber()` trên
 * `_lastAllModePoints`/`_lastAllModeDurationMs` ĐÃ LƯU từ lượt 'all' mode gần nhất, KHÔNG parse
 * ngược ma trận CSS — chính xác tuyệt đối, không mơ hồ như decompose matrix). Tương tự,
 * `pointMoveEndForceBaseline` chèn thêm 1 mốc ẢO ở x=100 = baseline (tắt = giữ nguyên hành vi cũ:
 * đứng yên ở target point move CUỐI cho tới hết 100%). CHỈ được bật 1 trong 2 (phản hồi Giang).
 *
 * NẠP SAU: core/motion-engine.js, core/dom-refs.js (motionEngineContainer/motionEnginePointMoveWrapper/
 * motionEngineLayer1,2/motionEngineLayer1,2Pan/motionEngineReactLayer), service/task-manager.js (chỉ
 * còn dùng cho MOTION_ENGINE_BEATREACT_TASK — animation per-frame CỦA ẢNH ĐANG HIỆN, KHÔNG phải hẹn
 * giờ chuyển ảnh — cái đó sống ở workflowVisualBg).
 */

/** Preset "tắt hết" — dùng khi nơi gọi truyền `null`/`undefined` (chưa gắn Motion) — KHÔNG fallback
 * về bất kỳ hiệu ứng mặc định nào. Vẫn export ở đây (không phải nơi gọi) vì đây là "hình dạng
 * preset hợp lệ tối thiểu", thuộc kiến thức của Engine. */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', pointMoves: [], pointMoveEnabled: false, pointMoveRunMode: 'all', pointMoveOneOrder: 'sequential', pointMoveStartForceBaseline: false, pointMoveEndForceBaseline: false, reactBeatAudio: { enabled: false, zoom: { enabled: false }, pan: { enabled: false }, rotate: { enabled: false } } };

/** Baseline "không đổi" — dùng làm điểm XUẤT PHÁT khi tween 'one' mode (baseline -> target) VÀ làm
 * `target` của node ảo "vị trí ban đầu" ở 'all' mode (xem `_buildPointMoveAllKeyframes()`). */
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

    _pointMoveAnim: null, // Animation DUY NHẤT trên motionEnginePointMoveWrapper (bọc CHUNG cả 2 layer A/B, xem core/dom-refs.js) — SỬA, phản hồi Giang, không còn tách theo từng layer nữa

    // MỚI (phản hồi Giang, sửa bug hard-cut baseline) — snapshot đường cong 'all' mode GẦN NHẤT
    // (mảng {x,target} ĐÃ gồm sẵn 2 mốc ảo đầu/cuối nếu có) + thời lượng của nó — dùng bởi
    // `_deriveLivePointMoveTarget()` để suy CHÍNH XÁC vị trí thật đang hiển thị cho lượt KẾ TIẾP.
    // null = lượt gần nhất KHÔNG phải 'all' mode (hoặc chưa từng chạy) -> không có gì để suy, tự
    // fallback về baseline (xem `_activatePointMoveAll()`).
    _lastAllModePoints: null,
    _lastAllModeDurationMs: 0,

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
        this._activatePointMove(preset);
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
        this._activatePointMove(preset); // SỬA (phản hồi Giang) — KHÔNG còn theo layer, activate CHUNG cho cả 2 (trên motionEnginePointMoveWrapper)

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
     * `transitionEnabled`). Nếu bật, ĐỌC transform THẬT đang hiển thị (`getComputedStyle`) TRƯỚC khi
     * dừng animation cũ (SỬA, phản hồi Giang báo bug — "point move X -> transition -> hard cut cứng
     * về gốc -> rồi mới move point, giật" — bản trước `stopPointMoveAnimation()` set thẳng
     * `transform=''` (về gốc) rồi mới bắt animation MỚI xuất phát từ baseline, tạo 1 bước NHẢY CỨNG
     * ngay lúc chuyển ảnh, LỘ RÕ vì giờ Point Move dùng CHUNG 1 phần tử cho cả 2 layer A/B — layer
     * đang fade-out cũng bị giật theo. Animation MỚI giờ LUÔN xuất phát từ ĐÚNG giá trị ĐANG hiển thị
     * — `getComputedStyle(...).transform` trả `'none'` (= identity, coi như baseline) nếu CHƯA từng
     * chạy animation nào — TỰ ĐÚNG cho lượt `reveal()` đầu tiên mà không cần xử lý riêng) rồi chọn
     * `_activatePointMoveOne()`/`_activatePointMoveAll()` theo `preset.pointMoveRunMode`. Đây là
     * Workflow (được phép rẽ nhánh chọn Core/logic nào chạy, tự đọc DOM), KHÔNG phải Core — Rule 1
     * (đơn tuyến)/Rule 2 (không tự đọc appState — đây là đọc DOM, không phải appState) chỉ áp cho
     * `core/`.
     * @param {object} preset
     */
    _activatePointMove(preset) {
        if (!preset.pointMoveEnabled) return;
        const fromTransform = motionEnginePointMoveWrapper ? getComputedStyle(motionEnginePointMoveWrapper).transform : 'none'; // core/dom-refs.js
        // MỚI (phản hồi Giang, sửa bug hard-cut baseline) — suy vị trí thật (field thật, KHÔNG phải
        // chuỗi transform) TRƯỚC khi huỷ animation cũ (`.currentTime` chỉ đọc được lúc animation còn
        // sống, `stopPointMoveAnimation()` bên dưới `.cancel()` nó ngay) — null nếu lượt trước không
        // phải 'all' mode (`_activatePointMoveOne()` tự reset `_lastAllModePoints`) hoặc chưa từng
        // chạy (lượt `reveal()` đầu tiên).
        const liveStartTarget = this._deriveLivePointMoveTarget();
        stopPointMoveAnimation(motionEnginePointMoveWrapper, this._pointMoveAnim); // core/dom-refs.js, core/motion-engine.js
        this._pointMoveAnim = null;
        if (preset.pointMoveRunMode === 'one') { this._activatePointMoveOne(preset, fromTransform); return; }
        this._activatePointMoveAll(preset, fromTransform, liveStartTarget);
    },

    /** Suy 6 giá trị field THẬT tại vị trí ĐANG hiển thị của đường cong 'all' mode LƯỢT TRƯỚC (nếu
     * có) — dùng `animation.currentTime` (WAAPI) + `_lastAllModePoints`/`_lastAllModeDurationMs` ĐÃ
     * LƯU (snapshot ĐÚNG những gì đã dùng dựng đường cong đó, kể cả random range ĐÃ resolve — không
     * resolve lại, tránh ra số khác) tái dùng THẲNG `_findPointMoveSegment()`/`lerpPointMoveNumber()`
     * — chính xác tuyệt đối, KHÔNG cần decompose ngược ma trận CSS (mơ hồ với rotate/flip/% vs px).
     * @returns {object|null} null nếu không có đường cong 'all' mode nào để suy (lượt trước là 'one'
     *   mode, point move đang tắt, hoặc đây là lượt kích hoạt ĐẦU TIÊN). */
    _deriveLivePointMoveTarget() {
        if (!this._pointMoveAnim || !this._lastAllModePoints) return null;
        let currentTimeMs = 0;
        try { currentTimeMs = this._pointMoveAnim.currentTime || 0; } catch (e) { return null; }
        const oldXPercent = Math.max(0, Math.min(100, (currentTimeMs / (this._lastAllModeDurationMs || 1)) * 100));
        const seg = this._findPointMoveSegment(this._lastAllModePoints, oldXPercent);
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
    },

    /** 'one' mode — chọn ĐÚNG 1 point move (trong số đã tick) theo `pointMoveOneOrder`, tween
     * TỪ VỊ TRÍ THẬT ĐANG HIỂN THỊ (`fromTransform`, xem `_activatePointMove()`) -> target suốt
     * `_lastAdvanceMs` — KHÔNG còn ép về baseline trước (SỬA, phản hồi Giang — tránh giật lúc
     * chuyển ảnh). */
    _activatePointMoveOne(preset, fromTransform) {
        this._lastAllModePoints = null; // lượt này KHÔNG phải 'all' mode -> không còn đường cong nào để lượt SAU suy tiếp (tự fallback baseline)
        const checkedIndices = [];
        preset.pointMoves.forEach((p, i) => { if (p.checked) checkedIndices.push(i); });
        const pickFn = preset.pointMoveOneOrder === 'random' ? pickPointMoveOneIndexRandom : pickPointMoveOneIndexSequential; // core
        const index = pickFn(checkedIndices, this._lastPointMoveOneIndex);
        this._lastPointMoveOneIndex = index;
        if (index === -1) return; // không point move nào được tick (không nên xảy ra — #0 luôn checked — phòng hờ dữ liệu hỏng)
        const target = this._resolvePointMoveTarget(preset.pointMoves[index]);
        const keyframes = [
            { transform: fromTransform },
            { transform: buildPointMoveTransformString(target) }, // core
        ];
        this._pointMoveAnim = startPointMoveAnimation(motionEnginePointMoveWrapper, keyframes, this._lastAdvanceMs, 'ease-in-out'); // core/dom-refs.js, core/motion-engine.js
    },

    /** 'all' mode — sample đường cong Timing của TẤT CẢ point move đã tick thành N keyframe, feed
     * WAAPI easing 'linear' (đường cong ĐÃ tự mượt qua sampling, easing khác sẽ làm méo lại) — GHI
     * ĐÈ keyframe ĐẦU bằng `fromTransform` (giữ ĐÚNG pixel đầu tiên 100%, phòng sai số làm tròn của
     * lerp) — nhưng khác bản trước, giờ TOÀN BỘ đường cong phía sau cũng xuất phát từ vị trí THẬT
     * (`liveStartTarget`, field thật, xem `_deriveLivePointMoveTarget()`) thay vì luôn từ baseline —
     * SỬA (phản hồi Giang, bug hard-cut). Mốc x=0/x=100 giờ ĐỘNG theo `pointMoveStartForceBaseline`/
     * `pointMoveEndForceBaseline` (core/motion-presets.js, CHỈ 1 trong 2 được bật):
     *   - Start: bật -> mốc x=0 = baseline CỐ ĐỊNH (hành vi CŨ); tắt (mặc định) -> mốc x=0 =
     *     `liveStartTarget` nếu có (liền mạch), fallback baseline nếu KHÔNG có (lượt `reveal()` đầu
     *     tiên/lượt trước là 'one' mode).
     *   - End: bật -> CHÈN THÊM 1 mốc ẢO x=100 = baseline, ĐỒNG THỜI loại bỏ mọi point move đang ở
     *     ĐÚNG x=100 khỏi `points` (mốc ảo "vô hiệu hoá và thay thế" nó, phản hồi Giang — phòng dữ
     *     liệu cũ trước khi UI chặn kéo/nhập tới đúng 100%); tắt (mặc định) -> giữ NGUYÊN hành vi cũ,
     *     đứng yên ở target point move CUỐI cho tới hết 100% (`_findPointMoveSegment()` tự clamp).
     * @param {object} preset @param {string} fromTransform
     * @param {object|null} liveStartTarget - từ `_deriveLivePointMoveTarget()`, null nếu không có. */
    _activatePointMoveAll(preset, fromTransform, liveStartTarget) {
        const checked = preset.pointMoves.filter((p) => p.checked);
        const usable = preset.pointMoveEndForceBaseline ? checked.filter((p) => p.timingX < 100) : checked;
        if (usable.length === 0 && !preset.pointMoveEndForceBaseline) return; // không có gì để chạy (giữ nguyên guard cũ)
        const points = usable
            .map((p) => ({ x: p.timingX, target: this._resolvePointMoveTarget(p) }))
            .sort((a, b) => a.x - b.x);
        const startTarget = (preset.pointMoveStartForceBaseline || !liveStartTarget) ? POINT_MOVE_BASELINE_TARGET : liveStartTarget;
        const targetPoints = [{ x: 0, target: startTarget }, ...points];
        if (preset.pointMoveEndForceBaseline) targetPoints.push({ x: 100, target: POINT_MOVE_BASELINE_TARGET });

        const keyframes = this._buildPointMoveAllKeyframes(targetPoints);
        if (keyframes.length > 0) keyframes[0] = { transform: fromTransform };
        this._pointMoveAnim = startPointMoveAnimation(motionEnginePointMoveWrapper, keyframes, this._lastAdvanceMs, 'linear'); // core/dom-refs.js, core/motion-engine.js
        this._lastAllModePoints = targetPoints; // snapshot cho `_deriveLivePointMoveTarget()` LƯỢT KẾ TIẾP
        this._lastAllModeDurationMs = this._lastAdvanceMs;
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

    /** Sample `targetPoints` (ĐÃ sort theo `x`, ĐÃ gồm sẵn mốc ảo đầu/cuối nếu có — xem
     * `_activatePointMoveAll()`, nơi DUY NHẤT gọi hàm này) thành mảng keyframe {transform} — mỗi
     * mẫu: tìm đoạn [A,B] chứa `xPercent` (`_findPointMoveSegment()`), rồi lerp 6 field giữa
     * `A.target`/`B.target` theo tiến độ THỜI GIAN cục bộ trong đoạn đó (phản hồi Giang — "loại bỏ
     * toàn bộ timing Y" — ĐÃ XOÁ HẲN hệ số cường độ/đường cong Y, field LUÔN đạt ĐỦ giá trị đã lerp
     * theo vị trí thời gian, không còn field nào bị nhân thêm gì). SỬA (phản hồi Giang, bug hard-cut)
     * — KHÔNG còn tự chèn mốc ảo x=0=baseline ở ĐÂY nữa (mốc đó giờ ĐỘNG, nơi gọi tự quyết + tự
     * chèn TRƯỚC khi gọi hàm này — xem docstring `_activatePointMoveAll()`).
     * @param {{x:number,target:object}[]} targetPoints
     * @returns {object[]}
     */
    _buildPointMoveAllKeyframes(targetPoints) {
        const keyframes = [];
        for (let i = 0; i <= MOTION_ENGINE_POINT_MOVE_ALL_STEPS; i++) {
            const xPercent = (i / MOTION_ENGINE_POINT_MOVE_ALL_STEPS) * 100;
            const seg = this._findPointMoveSegment(targetPoints, xPercent);
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
    },

    /** Tìm đoạn [A,B] (2 point move LIỀN KỀ trong `points`, đã sort theo `x`) chứa `xPercent`, +
     * tiến độ THỜI GIAN cục bộ (0-1) trong đoạn đó — plain JS thuần (không phải Core, Workflow được
     * tự do tính toán). */
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
        pausePointMoveAnimation(this._pointMoveAnim); // core
    },

    resume() {
        if (taskManager.plan[MOTION_ENGINE_BEATREACT_TASK]) taskManager.resume(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        resumePointMoveAnimation(this._pointMoveAnim); // core
    },

    /** Dừng hẳn — dọn layer + object URL + reset bookkeeping. */
    stop() {
        taskManager.kill(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        this._beatReactActive = false;
        this._resetBeatReactTransform();
        setMotionEngineContainerVisible(motionEngineContainer, false); // core
        stopPointMoveAnimation(motionEnginePointMoveWrapper, this._pointMoveAnim); // core/dom-refs.js, core/motion-engine.js
        this._pointMoveAnim = null;
        this._lastAllModePoints = null; // dọn sạch — dừng hẳn thì không còn gì để lượt SAU suy tiếp
        this._lastAllModeDurationMs = 0;
        [[motionEngineLayer1, motionEngineLayer1Pan], [motionEngineLayer2, motionEngineLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
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
