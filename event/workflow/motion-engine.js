/**
 * event/workflow/motion-engine.js — Motion Engine: RENDERER THUẦN cho transition/Ken Burns/React Beat
 * Audio của Visual Background (`type='photo'`). VIẾT LẠI TOÀN BỘ (29/08/2026, phản hồi Giang —
 * "Motion cung cấp CƠ CHẾ, nơi tiêu thụ quyết định KHI NÀO/CÓ dùng hay không") — trước đây file này
 * TỰ GIỮ timer/`_sourceKeys`/`_sourceIndex` + TỰ ĐỌC `appConfigVisualBg.motionPresetId` — nghĩa là
 * việc "khi nào chuyển từ ảnh A sang B" (đáng lẽ KHÔNG liên quan gì Motion) bị GẮN CHẶT vào vòng đời
 * riêng của Engine, nên gắn/gỡ Motion (đổi `motionPresetId` — 1 thao tác của workflowMotionPresets,
 * KHÔNG hề gọi lại engine) có thể để lại timer đứng hình, phải áp lại nguồn mới chạy lại được — ĐÚNG
 * bug Giang báo. Bỏ HẲN kiểu ghép đó — file NÀY giờ KHÔNG timer, KHÔNG biết `source.list`/`nextOrder`/
 * `listPlaybackMode`/`motionPresetId` tồn tại, CHỈ còn 4 hàm public:
 *   `reveal(imageKey, preset)`      — hiện ảnh ĐẦU tĩnh (Ken Burns/BeatReact áp được cho ảnh đơn,
 *                                     transition thì KHÔNG vì cần 2 ảnh để chuyển).
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
 * NẠP SAU: core/motion-engine.js, core/dom-refs.js (motionEngineContainer/motionEngineLayer1,2/
 * motionEngineLayer1,2Pan/motionEngineReactLayer), service/task-manager.js (chỉ còn dùng cho
 * MOTION_ENGINE_BEATREACT_TASK — animation per-frame CỦA ẢNH ĐANG HIỆN, KHÔNG phải hẹn giờ chuyển
 * ảnh — cái đó đã dời sang workflowVisualBg).
 */

/** Preset "tắt hết" — dùng khi nơi gọi truyền `null`/`undefined` (chưa gắn Motion) — Giang chốt "2
 * công tắc cùng false thì không chạy hiệu ứng gì cả", KHÔNG fallback về bất kỳ hiệu ứng mặc định
 * nào. Vẫn export ở đây (không phải nơi gọi) vì đây là "hình dạng preset hợp lệ tối thiểu" — thuộc
 * kiến thức của Engine (nó biết field nào mình cần), không phải của nơi tiêu thụ. */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', kenBurnsEnabled: false, kenBurnsMode: 'zoomPanRandom', reactBeatAudio: { enabled: false, replaceMovement: false, zoom: { enabled: false }, pan: { enabled: false }, rotate: { enabled: false } } };

// MỚI (29/08/2026, "React Beat Audio") — task RAF RIÊNG, per-frame, CHỈ chạy khi preset đang HIỂN
// THỊ (truyền vào lúc reveal()/transitionTo() gần nhất) có `reactBeatAudio.enabled` + ít nhất 1 hiệu
// ứng con bật (xem `_syncBeatReactLoop()`). ĐÂY LÀ TASK DUY NHẤT còn lại trong file — animation của
// ẢNH ĐANG HIỆN, không phải hẹn giờ "khi nào chuyển ảnh" (đã dời sang workflowVisualBg).
// VIẾT LẠI (30/08/2026, phản hồi Giang mục 1 — "loại bỏ cơ chế beat trong motion, tự động theo nhạc
// giống beatscale visualizer effect") — bỏ hẳn cơ chế đếm `beatCount`/bắn pulse rời rạc mỗi N beat,
// giờ đọc THẲNG `appState.beatScale` (tín hiệu năng lượng LIÊN TỤC, tính mỗi frame ở
// event/workflow/visualizer-render.js — CÙNG nguồn mọi hiệu ứng "beatscale" khác trong app đang
// dùng, vd core/visualizer/types/bar.js) mỗi tick, nội suy tuyến tính — xem `_tickBeatReact()` dưới.
const MOTION_ENGINE_BEATREACT_TASK = 'motionEngineBeatReactTick';

const workflowMotionEngine = {
    _currentObjectUrl: null,
    _currentRecord: null,   // record ảnh ĐANG hiện — giữ lại để _activateKenBurns() dùng mà không đọc DB lại
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2
    _isActive: false,       // Ken Burns/BeatReact animation ĐANG chạy (khác "đứng yên chờ") — pause()/resume() thao tác trên cờ này
    _lastKenBurnsDirection: null,
    _activePreset: MOTION_ENGINE_NO_OP_PRESET, // preset của LƯỢT HIỂN THỊ GẦN NHẤT — _tickBeatReact() (chạy mỗi frame, không có tham số) đọc lại từ đây
    _lastAdvanceMs: 5000, // advanceMs của LƯỢT HIỂN THỊ GẦN NHẤT (gán ở reveal()/transitionTo()) — _activateKenBurns() dùng kẹp trần, KHÔNG tự tính nữa

    _beatReactActive: false,

    _currentLayer() { return this._layerToggle ? motionEngineLayer2 : motionEngineLayer1; },
    _idleLayer() { return this._layerToggle ? motionEngineLayer1 : motionEngineLayer2; },
    _currentPanLayer() { return this._layerToggle ? motionEngineLayer2Pan : motionEngineLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? motionEngineLayer1Pan : motionEngineLayer2Pan; },

    _kenBurnsAnim1: null,
    _kenBurnsAnim2: null,
    _getKenBurnsAnim(panEl) { return panEl === motionEngineLayer1Pan ? this._kenBurnsAnim1 : this._kenBurnsAnim2; },
    _setKenBurnsAnim(panEl, anim) {
        if (panEl === motionEngineLayer1Pan) this._kenBurnsAnim1 = anim; else this._kenBurnsAnim2 = anim;
    },

    /** Hiện ẢNH ĐẦU tĩnh (không transition — chỉ có 1 ảnh, chưa có ảnh "cũ" nào để chuyển từ đó) +
     * bật Ken Burns/BeatReact NGAY nếu `preset` bật (khác bản trước tách "reveal tĩnh" ra khỏi
     * "activate" theo Song phát/dừng — nơi gọi giờ tự quyết định GỌI reveal() lúc nào, xem
     * workflowVisualBg._startPhotoCycle()/syncPlaybackGate()).
     * `imageKey` rỗng/null -> ẩn hẳn container, dọn sạch (coi như `stop()`).
     * @param {string|null} imageKey
     * @param {object} preset - ĐÃ resolve sẵn (MOTION_ENGINE_NO_OP_PRESET nếu chưa gắn Motion).
     * @param {number} advanceMs - thời lượng hiển thị ảnh NÀY — nơi gọi tự tính (durationMode/
     *        durationSeconds/record.duration đều thuộc VBG, xem workflowVisualBg._computePhotoAdvanceMs()) —
     *        dùng kẹp trần Ken Burns duration (`_activateKenBurns()`).
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
        const skipNormalKenBurns = preset.reactBeatAudio.enabled && preset.reactBeatAudio.replaceMovement;
        if (preset.kenBurnsEnabled && !skipNormalKenBurns) this._activateKenBurns(this._currentPanLayer(), preset.kenBurnsMode, this._currentRecord);
        this._syncBeatReactLoop();
    },

    /** 1 lượt CHUYỂN từ ảnh đang hiện sang `imageKey` — áp Transition/Ken Burns theo `preset` (kẹp
     * trần theo `advanceMs` — thời lượng hiển thị ảnh SẮP hiện, nơi gọi tự tính).
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
        const skipNormalKenBurns = preset.reactBeatAudio.enabled && preset.reactBeatAudio.replaceMovement;
        if (preset.kenBurnsEnabled && !skipNormalKenBurns) this._activateKenBurns(incomingPan, preset.kenBurnsMode, image);

        // Giang chốt "2 công tắc cùng false thì không chạy hiệu ứng gì cả" — transitionEnabled=false
        // -> CẮT CỨNG, đi THẲNG tới đúng trạng thái nghỉ mà 1 lượt Transition bình thường sẽ kết
        // thúc ở đó (xem finishMotionEngineTransitionVisuals(), core/motion-engine.js) — KHÔNG qua
        // bước enter/exit trung gian nào, KHÔNG animation.
        if (preset.transitionEnabled) {
            setMotionEngineTransitionType(motionEngineContainer, preset.transitionType); // core
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
                stopMotionEngineKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core
                this._setKenBurnsAnim(outgoingPan, null);
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
            stopMotionEngineKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core
            this._setKenBurnsAnim(outgoingPan, null);
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
        return true;
    },

    _activateKenBurns(panEl, mode, image) {
        const direction = resolveMotionEngineKenBurnsDirection(mode, this._lastKenBurnsDirection); // core
        this._lastKenBurnsDirection = direction;
        const bounds = computeMotionEngineKenBurnsSafeBounds(image ? image.width : 0, image ? image.height : 0, window.innerWidth, window.innerHeight); // core
        // MỚI — trần Ken Burns giờ đọc THẲNG `advanceMs` truyền kèm preset lúc gọi gần nhất, KHÔNG
        // tự tính `_computeAdvanceMs()` nữa — dùng lại giá trị đã lưu trong `_lastAdvanceMs` (gán ở
        // reveal()/transitionTo() ngay trước khi gọi hàm này).
        const durationMs = capMotionEngineKenBurnsDurationMs(this._lastAdvanceMs); // core
        const keyframes = pickMotionEngineKenBurnsKeyframes(direction, bounds, durationMs); // core
        const anim = startMotionEngineKenBurnsAnimation(panEl, keyframes, durationMs); // core
        this._setKenBurnsAnim(panEl, anim);
    },

    /** Đóng băng animation (Ken Burns + BeatReact) TẠI ĐÚNG VỊ TRÍ đang chạy — nơi gọi (workflowVisualBg)
     * tự quyết lúc nào (Song dừng). KHÔNG dừng hẳn (khác `stop()`) — `resume()` tiếp tục đúng chỗ. */
    pause() {
        if (taskManager.plan[MOTION_ENGINE_BEATREACT_TASK]) taskManager.pause(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        pauseMotionEngineKenBurnsAnimation(this._kenBurnsAnim1); // core
        pauseMotionEngineKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    resume() {
        if (taskManager.plan[MOTION_ENGINE_BEATREACT_TASK]) taskManager.resume(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        resumeMotionEngineKenBurnsAnimation(this._kenBurnsAnim1); // core
        resumeMotionEngineKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** Dừng hẳn — dọn layer + object URL + reset bookkeeping. KHÔNG còn `taskManager.kill()` cho hẹn
     * giờ chuyển ảnh (task đó không còn sống ở file này nữa, xem docstring đầu file). */
    stop() {
        taskManager.kill(MOTION_ENGINE_BEATREACT_TASK); // service/task-manager.js
        this._beatReactActive = false;
        this._resetBeatReactTransform();
        setMotionEngineContainerVisible(motionEngineContainer, false); // core
        [[motionEngineLayer1, motionEngineLayer1Pan], [motionEngineLayer2, motionEngineLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
            stopMotionEngineKenBurnsAnimation(panEl, this._getKenBurnsAnim(panEl)); // core
            this._setKenBurnsAnim(panEl, null);
            resetMotionEngineLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._currentRecord = null;
        this._isActive = false;
        this._lastKenBurnsDirection = null;
        this._activePreset = MOTION_ENGINE_NO_OP_PRESET;
    },

    /** Bật/tắt vòng lặp per-frame react-beat — MỚI (29/08/2026, "React Beat Audio"). Gọi ở MỌI
     * điểm `_activePreset` CÓ THỂ vừa đổi (`reveal()`/`transitionTo()` — mỗi lượt hiện/chuyển ảnh
     * tự gán `_activePreset` MỚI rồi gọi hàm này). KHÔNG addNew() trùng tên nếu đã chạy sẵn
     * (`_beatReactActive` guard). VIẾT LẠI (30/08/2026, phản hồi Giang — bỏ cơ chế đếm beat) — không
     * còn bookkeeping "beat cuối đã thấy"/"thời điểm vừa bắn" nào để khởi tạo lúc bật nữa, vòng lặp
     * CHỈ còn việc bật/tắt task RAF theo đúng điều kiện.
     */
    _syncBeatReactLoop() {
        const rb = this._activePreset.reactBeatAudio;
        const shouldRun = this._isActive && rb.enabled && (rb.zoom.enabled || rb.pan.enabled || rb.rotate.enabled);
        if (shouldRun && !this._beatReactActive) {
            this._beatReactActive = true;
            taskManager.addNew(MOTION_ENGINE_BEATREACT_TASK, { time: 0, exe: () => this._tickBeatReact(), mode: 'raf', count: 0 }); // service/task-manager.js
            taskManager.operator(MOTION_ENGINE_BEATREACT_TASK, 'enabled');
        } else if (!shouldRun && this._beatReactActive) {
            this._beatReactActive = false;
            taskManager.kill(MOTION_ENGINE_BEATREACT_TASK);
            this._resetBeatReactTransform(); // về identity — tắt là về ngay baseline, không có gì để "kẹt giữa chừng" nữa (không còn pulse rời rạc)
        }
    },

    /** Xoá `transform` khỏi lớp react DUY NHẤT (identity, vô hình) — gọi lúc tắt hẳn beat-react VÀ
     * lúc `stop()` dọn toàn bộ MotionEngine. SỬA (30/08/2026, phản hồi Giang mục 3 — lớp react giờ
     * BAO NGOÀI cả 2 player A/B thay vì 1 lớp riêng lồng bên trong từng layer) — chỉ còn 1 phần tử
     * DUY NHẤT (`motionEngineReactLayer`, core/dom-refs.js), không còn "layer1React/layer2React". */
    _resetBeatReactTransform() {
        if (motionEngineReactLayer) motionEngineReactLayer.style.transform = '';
    },

    /** Tick per-frame (RAF) — VIẾT LẠI HOÀN TOÀN (30/08/2026, phản hồi Giang mục 1 — "loại bỏ cơ chế
     * beat trong motion, tự động theo nhạc giống beatscale visualizer effect"). KHÔNG còn đếm beat/
     * bắn pulse rồi tự về gốc — đọc THẲNG `beatScale` (năng lượng LIÊN TỤC, 0-1, CÙNG tín hiệu mọi
     * hiệu ứng "beatscale" khác trong app đang dùng, xem event/workflow/visualizer-render.js) MỖI
     * FRAME, nội suy tuyến tính (`computeMotionEngineBeatReactZoomScale()`/
     * `computeMotionEngineBeatReactOffset()`, core/motion-engine.js) rồi CỘNG DỒN cả 3 hiệu ứng
     * thành 1 chuỗi `transform` áp lên lớp react DUY NHẤT (bao cả 2 player A/B — mục 3 phản hồi
     * Giang, xem `_resetBeatReactTransform()`) — nhạc càng mạnh, transform càng tiến về `max`; nhạc
     * nhẹ/im lặng, transform lui về baseline CỐ ĐỊNH (100%/100%/0°, KHÔNG phải field trong preset —
     * Giang chốt "min không phải tuỳ chọn"), KHÔNG có khái niệm "trigger"/"thời lượng pulse" nào
     * nữa. */
    _tickBeatReact() {
        const rb = this._activePreset.reactBeatAudio;
        if (!rb.enabled) { this._syncBeatReactLoop(); return; } // preset vừa bị gỡ/tắt beat-react giữa chừng -> tự dừng vòng lặp ĐÚNG NGAY frame này
        const energy = appState.get('beatScale'); // service/state/visualizer-runtime.js — năng lượng LIÊN TỤC, tính mỗi frame ở event/workflow/visualizer-render.js

        const zoomScale = rb.zoom.enabled ? computeMotionEngineBeatReactZoomScale(rb.zoom.maxPct, energy) : 1; // core
        const panPct = rb.pan.enabled ? computeMotionEngineBeatReactOffset(rb.pan.direction, rb.pan.maxPct - 100, energy) : 0; // core — trừ baseline 100% (cố định) trước khi truyền
        const rotateDeg = rb.rotate.enabled ? computeMotionEngineBeatReactOffset(rb.rotate.direction, rb.rotate.maxDeg, energy) : 0; // core — baseline 0° (cố định), không cần trừ

        if (motionEngineReactLayer) motionEngineReactLayer.style.transform = `scale(${zoomScale}) translateX(${panPct}%) rotate(${rotateDeg}deg)`;
    },
};
