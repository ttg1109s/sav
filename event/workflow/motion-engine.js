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
 *                                     NGAY. No-op nếu chưa có ảnh nào đang hiện.
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
 * SỬA (Giang chỉ ra: "Motion cung cấp cơ chế THUẦN [như cái tua vít] — không quan tâm ai dùng/dùng
 * vào việc gì, nơi tiêu thụ tự quyết gắn ở đâu, dùng ra sao") — React Beat/Point Move ĐÃ chuyển hẳn
 * ra Runner DÙNG CHUNG (event/workflow/motion-beat-react-runner.js/motion-point-move-runner.js).
 * Transition CŨNG vậy (event/workflow/motion-transition-runner.js) — NHƯNG bản Runner Transition
 * ĐẦU (audit lần trước) vẫn CÒN SAI: tự ý quản lý object URL + tự gọi `setMotionEngineLayerImage()`
 * gán/gỡ nội dung layer — ĐÓ là quyết định CỦA VBG (ảnh lấy từ URL, nội dung là background-image),
 * KHÔNG phải bản chất "transition" (bằng chứng: Video Player mode dùng layer A = `<video>`, không
 * có background-image, "chuẩn bị nội dung" của nó là KHÔNG LÀM GÌ — Runner cũ ép `setMotionEngineLayerImage()`
 * lên layer A sẽ vô nghĩa). SỬA LẦN 2 — Runner giờ CHỈ còn `runTransition(containerEl, outgoingEl,
 * incomingEl, preset, advanceMs, onSettle)`: set thuộc tính transition + class + timing + hẹn giờ,
 * gọi `onSettle()` khi outgoing "xong việc" — KHÔNG đụng nội dung. File NÀY (nơi tiêu thụ CỦA
 * Transition Runner, đại diện VBG) giờ tự giữ LẠI toàn bộ state/quyết định thuộc về mình:
 * `_layerToggle`/`_hasCurrentResource`/`_currentObjectUrl`/`_currentLayer()`/`_idleLayer()`/
 * `_currentPanLayer()`/`_idlePanLayer()` — VÀ tự gán/gỡ `background-image` (`setMotionEngineLayerImage()`)
 * + tự revoke URL NGAY TRONG callback `onSettle` truyền cho `runTransition()`.
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (findMotionPresetById()/isReactBeatPresetActive() — dùng ở
 * livePointMoveToggle()/_getBeatReactPreset()), event/workflow/motion-beat-react-runner.js
 * (createMotionBeatReactRunner()), event/workflow/motion-point-move-runner.js
 * (createMotionPointMoveRunner()), event/workflow/motion-transition-runner.js
 * (createMotionTransitionRunner()), core/dom-refs.js (motionEngineContainer/
 * motionEnginePointMoveWrapper/motionEngineLayer1,2/motionEngineLayer1,2Pan/motionEngineReactLayer).
 * service/task-manager.js — CHỈ còn dùng cho `_thumbFullBlobDecode`-style chờ gì đó CỦA RIÊNG file
 * này nếu có (hiện KHÔNG dùng trực tiếp — cả 3 mảng React Beat/Point Move/Transition đều nằm HẲN
 * trong Runner riêng của chúng). KHÔNG còn phụ thuộc service/db.js — Engine không tự đọc record nữa.
 */

/** Preset "tắt hết" — dùng khi nơi gọi truyền `null`/`undefined` (chưa gắn Motion) — KHÔNG fallback
 * về bất kỳ hiệu ứng mặc định nào. Vẫn export ở đây (không phải nơi gọi) vì đây là "hình dạng
 * preset hợp lệ tối thiểu", thuộc kiến thức của Engine. */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', pointMoves: [], pointMoveEnabled: false, pointMoveRunMode: 'all', pointMoveOneOrder: 'sequential', pointMoveEndForceBaseline: false, reactBeatAudio: { enabled: false, zoom: { enabled: false }, panX: { enabled: false }, panY: { enabled: false }, rotate: { enabled: false } } }; // SỬA (phản hồi Giang) — bỏ pointMoveStartForceBaseline (field đã xoá), pan -> panX/panY

// Task RAF RIÊNG, per-frame, CHỈ chạy khi preset đang HIỂN THỊ có `reactBeatAudio.enabled` + ít
// nhất 1 hiệu ứng con bật (xem `_syncBeatReactLoop()`) — animation của ẢNH ĐANG HIỆN, không phải
// hẹn giờ "khi nào chuyển ảnh" (sống ở workflowVisualBg).
const MOTION_ENGINE_BEATREACT_TASK = 'motionEngineBeatReactTick';
// Tốc độ decay envelope (đọc appState.beatScale mỗi frame, core/motion-engine.js::
// computeMotionEngineBeatReactEnvelope()) — 250ms đủ nhanh để cảm được nhịp, đủ chậm để không giật.
const MOTION_ENGINE_BEATREACT_DECAY_MS = 250;
// Tên task dọn dẹp SAU transition (taskManager.once(), event/workflow/motion-transition-runner.js)
// — GIỮ NGUYÊN chuỗi cũ, không đổi hành vi debug taskManager.plan[...].
const MOTION_ENGINE_TRANSITION_CLEANUP_TASK = 'motionEngineTransitionCleanup';

const workflowMotionEngine = {
    _activePreset: MOTION_ENGINE_NO_OP_PRESET, // preset của LƯỢT HIỂN THỊ GẦN NHẤT — React Beat đọc id từ đây rồi tự tra tươi (Point Move giờ Runner tự giữ preset riêng qua tham số mỗi lệnh gọi)
    _layerToggle: false,    // false = layer1 đang 'current', true = layer2 — SỞ HỮU của VBG (Runner KHÔNG còn giữ khái niệm này, xem docstring đầu file)
    _hasCurrentResource: false, // Engine đang giữ/hiện 1 resource hay chưa — QUYẾT ĐỊNH showImage() gọi
        // _staticReveal() (chưa có) hay _showNext() (đã có, cần transition/hard-cut). KHÔNG liên quan
        // animation đang chạy hay đang pause — pause()/resume() KHÔNG đụng cờ này.
    _currentObjectUrl: null, // object URL ẢNH ĐANG HIỆN — SỞ HỮU của VBG (Runner KHÔNG còn quản lý URL, xem docstring đầu file)

    // SỬA (Giang chỉ ra — "tách bạch trách nhiệm motion phải quản lý apply live bất kể nơi tiêu
    // thụ" + "Motion cung cấp cơ chế THUẦN, nơi tiêu thụ quyết hành vi... giống cái tua vít") — CẢ 3
    // mảng (React Beat, Point Move, Transition) giờ đều là 1 THAM CHIẾU tới 1 instance Runner DÙNG
    // CHUNG, KHÔNG còn field state THẬT của riêng chúng ở file này nữa — TRỪ Transition, phần STATE
    // THUỘC VỀ VBG (layerToggle/hasCurrentResource/currentObjectUrl ở trên) vẫn Ở ĐÂY vì Runner mới
    // KHÔNG còn quản lý nội dung/resource nữa, đúng nguyên tắc.
    _beatReactRunner: null, // tạo LƯỜI — xem _ensureBeatReactRunner()
    _pointMoveRunner: null, // tạo LƯỜI — xem _ensurePointMoveRunner()
    _transitionRunner: null, // tạo LƯỜI — xem _ensureTransitionRunner()

    _currentLayer() { return this._layerToggle ? motionEngineLayer2 : motionEngineLayer1; },
    _idleLayer() { return this._layerToggle ? motionEngineLayer1 : motionEngineLayer2; },
    _currentPanLayer() { return this._layerToggle ? motionEngineLayer2Pan : motionEngineLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? motionEngineLayer1Pan : motionEngineLayer2Pan; },

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

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionTransitionRunner()` — CHỈ còn tham số
     * `taskName` (Runner MỚI không giữ "layers" cố định nữa, xem docstring đầu file + event/
     * workflow/motion-transition-runner.js) — mỗi lần gọi `runTransition()` VBG tự truyền
     * `motionEngineContainer`/2 layer hiện hành của MÌNH.
     * @returns {ReturnType<typeof createMotionTransitionRunner>} */
    _ensureTransitionRunner() {
        if (!this._transitionRunner) {
            this._transitionRunner = createMotionTransitionRunner(MOTION_ENGINE_TRANSITION_CLEANUP_TASK); // event/workflow/motion-transition-runner.js
        }
        return this._transitionRunner;
    },

    /** Public — ĐIỂM VÀO DUY NHẤT để hiện 1 resource. `objectUrl` rỗng/null -> `stop()` HẲN (cả 3
     * Runner). Có nội dung -> `_hasCurrentResource` (CỦA VBG, KHÔNG phải Runner) quyết tĩnh hay
     * transition.
     * @param {string|null} objectUrl - ĐÃ resolve sẵn (createBlobUrl(), service/blob-url.js) — VBG
     *        nhận ownership NGAY khi hàm này được gọi (giữ/chuyển layer/revoke), nơi gọi không
     *        revoke lại. Rỗng/null -> coi như `stop()`.
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
     * chỉ Point Move/React Beat chuyển sang preset mới NGAY. No-op nếu chưa có resource nào đang hiện.
     * @param {object} preset - preset MỚI (MOTION_ENGINE_NO_OP_PRESET nếu chọn "Không") @param {number} advanceMs */
    updatePreset(preset, advanceMs) {
        if (!this._hasCurrentResource) return;
        this._setActivePreset(preset || MOTION_ENGINE_NO_OP_PRESET);
        this._ensurePointMoveRunner().activateForPresetChange(this._activePreset, advanceMs); // event/workflow/motion-point-move-runner.js
        this._syncBeatReactLoop();
    },

    /** Internal — hiện resource ĐẦU tĩnh (chưa có ảnh "cũ" nào để transition từ đó). CHỈ gọi từ
     * `showImage()` khi `_hasCurrentResource===false`. KHÔNG gọi Transition Runner — không có gì để
     * transition TỪ, chỉ set nội dung/class thẳng lên layer hiện hành. */
    async _staticReveal(objectUrl, preset, advanceMs) {
        this.stop();
        setMotionEngineContainerVisible(motionEngineContainer, true); // core
        this._currentObjectUrl = objectUrl;
        const panEl = this._currentPanLayer();
        const layerEl = this._currentLayer();
        setMotionEngineLayerImage(panEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('me-current');
        this._setActivePreset(preset);
        this._hasCurrentResource = true;
        this._ensurePointMoveRunner().activateForNewContent(preset, advanceMs); // event/workflow/motion-point-move-runner.js
        this._syncBeatReactLoop();
    },

    /** Internal — 1 lượt CHUYỂN từ resource đang hiện sang `objectUrl` — GÁN nội dung layer đích
     * TRƯỚC (LUÔN cần, bất kể có Transition hay không), rồi giao cho Transition Runner CHẠY animation
     * (hoặc cắt cứng) — VBG tự dọn nội dung layer nguồn (`outgoingPan`) + revoke URL cũ NGAY TRONG
     * `onSettle` (callback Runner gọi khi outgoing layer "xong việc").
     * @param {string} objectUrl @param {object} preset @param {number} advanceMs */
    async _showNext(objectUrl, preset, advanceMs) {
        this._setActivePreset(preset);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setMotionEngineLayerImage(incomingPan, objectUrl); // core — LUÔN cần, bất kể có Transition hay không
        this._ensurePointMoveRunner().activateForNewContent(preset, advanceMs); // event/workflow/motion-point-move-runner.js — KHÔNG còn theo layer, activate CHUNG cho cả 2 (trên motionEnginePointMoveWrapper)

        const staleUrl = this._currentObjectUrl; // capture LOCAL trước khi gán mới — revoke qua closure trong onSettle, không đọc lại field (có thể đã bị lượt SAU ghi đè lúc onSettle chạy)
        this._ensureTransitionRunner().runTransition( // event/workflow/motion-transition-runner.js
            motionEngineContainer, outgoingLayer, incomingLayer, preset, advanceMs,
            () => { // onSettle — outgoingLayer "xong việc", VBG tự dọn NỘI DUNG của nó (Runner không biết/không đụng)
                setMotionEngineLayerImage(outgoingPan, ''); // core
                if (staleUrl) { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }
            },
        );

        this._currentObjectUrl = objectUrl;
        this._layerToggle = !this._layerToggle;
        this._syncBeatReactLoop();
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

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionPointMoveRunner()` cho Point Move của VBG —
     * target CỐ ĐỊNH `motionEnginePointMoveWrapper` (VBG luôn sở hữu nó tại chỗ). Toàn bộ điều phối
     * Point Move (dispatcher 'one'/'all', đường cong Timing, force-baseline, suy vị trí SỐNG liền
     * mạch...) nằm HẲN trong Runner DÙNG CHUNG (event/workflow/motion-point-move-runner.js) — file
     * NÀY giờ CHỈ còn gọi ĐÚNG lúc (`activateForNewContent()` ở `_staticReveal()`/`_showNext()`,
     * `activateForPresetChange()` ở `updatePreset()`), KHÔNG còn giữ state/logic gì của chính
     * Point Move nữa.
     * @returns {ReturnType<typeof createMotionPointMoveRunner>} */
    _ensurePointMoveRunner() {
        if (!this._pointMoveRunner) {
            this._pointMoveRunner = createMotionPointMoveRunner(() => motionEnginePointMoveWrapper); // event/workflow/motion-point-move-runner.js, core/dom-refs.js
        }
        return this._pointMoveRunner;
    },

    /** Đóng băng animation (Point Move + BeatReact) TẠI ĐÚNG VỊ TRÍ đang chạy — nơi gọi
     * (workflowVisualBg) tự quyết lúc nào (Song dừng). KHÔNG dừng hẳn (khác `stop()`) — `resume()`
     * tiếp tục đúng chỗ. Transition KHÔNG cần pause/resume — animation CSS 1 lần tự hoàn tất, không
     * phải vòng lặp vô hạn như React Beat/Point Move. */
    pause() {
        if (this._beatReactRunner) this._beatReactRunner.pause(); // event/workflow/motion-beat-react-runner.js
        if (this._pointMoveRunner) this._pointMoveRunner.pause(); // event/workflow/motion-point-move-runner.js
    },

    resume() {
        if (this._beatReactRunner) this._beatReactRunner.resume(); // event/workflow/motion-beat-react-runner.js
        if (this._pointMoveRunner) this._pointMoveRunner.resume(); // event/workflow/motion-point-move-runner.js
    },

    /** Dừng hẳn — dọn CẢ 3 Runner (Transition Runner giờ chỉ huỷ timer treo + gọi `onSettle` dở
     * dang nếu có, KHÔNG còn tự dọn layer — VBG tự dọn NGAY dưới) + dọn layer/URL/state CỦA VBG +
     * reset preset active. */
    stop() {
        if (this._transitionRunner) this._transitionRunner.stop(); // event/workflow/motion-transition-runner.js
        if (this._beatReactRunner) this._beatReactRunner.stop(); // event/workflow/motion-beat-react-runner.js — kill task + trả transform về rỗng
        if (this._pointMoveRunner) this._pointMoveRunner.stop(); // event/workflow/motion-point-move-runner.js — dừng animation + dọn state suy tiếp
        setMotionEngineContainerVisible(motionEngineContainer, false); // core
        [[motionEngineLayer1, motionEngineLayer1Pan], [motionEngineLayer2, motionEngineLayer2Pan]].forEach(([layerEl, panEl]) => {
            setMotionEngineLayerImage(panEl, ''); // core
            resetMotionEngineLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._hasCurrentResource = false;
        this._setActivePreset(MOTION_ENGINE_NO_OP_PRESET);
    },

    /** Preset dùng cho React Beat Audio — gọi bởi Runner LÚC `sync()` (event-driven, KHÔNG mỗi
     * frame, xem event/workflow/motion-beat-react-runner.js). Tra LẠI theo id (KHÔNG dùng thẳng
     * `this._activePreset` — object đó có thể đã CŨ nếu preset bị sửa nội dung SAU lúc gán, Motion
     * Edit thay hẳn bằng object MỚI mỗi lần lưu field bất kỳ, xem event/workflow/motion-presets.js
     * ::_mutateEditing()) — tra tươi Ở ĐÂY thì LUÔN bắt đúng bản mới nhất, không sót field nào. `id`
     * giữ NGUYÊN dù nội dung đổi (chỉ object reference đổi), nên tra theo id vẫn đúng.
     * SỬA (gộp trùng lặp với `workflowPlayerDisplaySettings._getAssignedVideoShowingPreset()` —
     * 2 bản check `reactBeatAudio` từng lệch nhau: bản Player thiếu điều kiện "phải có ít nhất 1
     * hiệu ứng con bật") — phần check giờ DÙNG CHUNG qua `isReactBeatPresetActive()` (core/motion-
     * presets.js). Phần TÌM + fallback (`|| this._activePreset` khi preset vừa bị XOÁ hẳn, hiếm)
     * GIỮ NGUYÊN ở ĐÂY như cũ — riêng của VBG (có cache `_activePreset` để fallback), KHÔNG gộp
     * chung vì Player không có/không cần khái niệm fallback này.
     * @returns {object|null} */
    _getBeatReactPreset() {
        if (!this._hasCurrentResource) return null;
        const presetId = this._activePreset.id;
        if (!presetId) return null; // MOTION_ENGINE_NO_OP_PRESET (chưa gắn gì) không có field `id`
        const preset = findMotionPresetById(appState.get('motionPresets'), presetId) || this._activePreset; // core/motion-presets.js — preset vừa bị XOÁ hẳn (hiếm) -> fallback bản cache cũ
        return isReactBeatPresetActive(preset) ? preset : null; // core/motion-presets.js
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
