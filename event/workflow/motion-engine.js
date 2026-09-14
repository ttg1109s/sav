/**
 * event/workflow/motion-engine.js — Motion Engine: RENDERER THUẦN cho transition/Point Move/React
 * Beat Audio của Visual Background (`type='photo'`). File này KHÔNG timer chuyển ảnh, KHÔNG biết
 * `source.list`/`nextOrder`/`listPlaybackMode`/`motionPresetId` tồn tại, KHÔNG biết ảnh đến từ đâu
 * (không tự đọc DB, không có khái niệm imageKey) — CHỈ còn 5 hàm public:
 *   `showImage(objectUrl, preset, advanceMs)` — hiện `objectUrl` lên layer hiện hành; Engine TỰ QUYẾT
 *                                     hiện tĩnh (chưa có ảnh nào) hay transition từ ảnh đang hiện sang
 *                                     (đã có), dựa trên `hasResource()` CỦA Transition Runner — nơi
 *                                     gọi (VBG) không cần/không được biết đây là ảnh đầu hay ảnh kế.
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
 * SỬA (Giang chỉ ra: "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi của mình và sử dụng cơ chế
 * đó như thế nào, giống như gọi API" — audit toàn diện, "tiếp tục làm Transition cho VBG") — TOÀN
 * BỘ 3 mảng (React Beat, Point Move, Transition) giờ ĐÃ CHUYỂN HẲN ra Runner DÙNG CHUNG:
 *   `createMotionBeatReactRunner()` (event/workflow/motion-beat-react-runner.js) — `_beatReactRunner`.
 *   `createMotionPointMoveRunner()` (event/workflow/motion-point-move-runner.js) — `_pointMoveRunner`.
 *   `createMotionTransitionRunner()` (event/workflow/motion-transition-runner.js) — `_transitionRunner`.
 * Đọc docstring TỪNG file Runner cho toàn bộ chi tiết cơ chế + lịch sử bugfix, giữ NGUYÊN VẸN,
 * không tóm tắt lại ở đây tránh 2 nguồn sự thật lệch nhau. File NÀY giờ CHỈ còn ĐIỀU PHỐI — biết KHI
 * NÀO gọi Runner nào, KHÔNG còn giữ state/logic THẬT của bất kỳ mảng nào trong 3 mảng trên. VBG giờ
 * là 1 "nơi tiêu thụ" của cả 3 Runner, đúng nghĩa "Motion tách khỏi nơi tiêu thụ" — Player (Video/
 * Photo) CHƯA dùng Transition Runner (chưa quyết cách "chuyển bài" nên trông thế nào — crossfade 2
 * layer như Photo, cắt cứng, hay tái dùng cơ chế thumb chống nháy đen sẵn có), NHƯNG cơ chế đã sẵn
 * sàng dùng ngay khi cần, không cần rút lại lần nữa.
 *
 * NẠP SAU: core/motion-engine.js, core/motion-presets.js (findMotionPresetById() — dùng ở
 * livePointMoveToggle()/_getBeatReactPreset()), event/workflow/motion-beat-react-runner.js
 * (createMotionBeatReactRunner()), event/workflow/motion-point-move-runner.js
 * (createMotionPointMoveRunner()), event/workflow/motion-transition-runner.js
 * (createMotionTransitionRunner()), core/dom-refs.js (motionEngineContainer/
 * motionEnginePointMoveWrapper/motionEngineLayer1,2/motionEngineLayer1,2Pan/motionEngineReactLayer).
 * KHÔNG còn phụ thuộc service/task-manager.js trực tiếp — Cả 3 mảng (React Beat/Point Move/
 * Transition) đều nằm HẲN trong Runner riêng của chúng. KHÔNG còn phụ thuộc service/db.js — Engine
 * không tự đọc record nữa (SỬA, tách "resolve ảnh" khỏi "hiện ảnh").
 */

/** Preset "tắt hết" — dùng khi nơi gọi truyền `null`/`undefined` (chưa gắn Motion) — KHÔNG fallback
 * về bất kỳ hiệu ứng mặc định nào. Vẫn export ở đây (không phải nơi gọi) vì đây là "hình dạng
 * preset hợp lệ tối thiểu", thuộc kiến thức của Engine. */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', pointMoves: [], pointMoveEnabled: false, pointMoveRunMode: 'all', pointMoveOneOrder: 'sequential', pointMoveStartForceBaseline: false, pointMoveEndForceBaseline: false, reactBeatAudio: { enabled: false, zoom: { enabled: false }, pan: { enabled: false }, rotate: { enabled: false } } };

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
    _activePreset: MOTION_ENGINE_NO_OP_PRESET, // preset của LƯỢT HIỂN THỊ GẦN NHẤT — React Beat đọc id từ đây rồi tự tra tươi (Point Move/Transition giờ Runner tự giữ preset riêng qua tham số mỗi lệnh gọi)

    // SỬA (Giang chỉ ra — "tách bạch trách nhiệm motion phải quản lý apply live bất kể nơi tiêu
    // thụ" + "Motion cung cấp cơ chế, nơi tiêu thụ quyết hành vi... giống gọi API") — CẢ 3 mảng
    // (React Beat, Point Move, Transition) giờ đều là 1 THAM CHIẾU tới 1 instance Runner DÙNG
    // CHUNG, KHÔNG còn field state THẬT của riêng chúng ở file này nữa.
    _beatReactRunner: null, // tạo LƯỜI — xem _ensureBeatReactRunner()
    _pointMoveRunner: null, // tạo LƯỜI — xem _ensurePointMoveRunner()
    _transitionRunner: null, // tạo LƯỜI — xem _ensureTransitionRunner()

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

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionTransitionRunner()` cho Transition của VBG —
     * 5 element CỐ ĐỊNH (VBG luôn sở hữu chúng tại chỗ, KHÔNG như `motionEngineReactLayer` mà Video
     * Player mode phải tự di chuyển nội dung vào/ra). SỬA (Giang chỉ ra, "tiếp tục làm Transition
     * cho VBG") — toàn bộ điều phối Transition (2 layer A/B luân phiên, vòng đời object URL, timer
     * dọn dẹp sau animation, 5 field hướng random) ĐÃ CHUYỂN HẲN sang Runner DÙNG CHUNG (event/
     * workflow/motion-transition-runner.js) — file NÀY giờ CHỈ còn gọi `showImage()`/`stop()`/
     * `hasResource()`, KHÔNG còn giữ state/logic gì của chính Transition nữa.
     * @returns {ReturnType<typeof createMotionTransitionRunner>} */
    _ensureTransitionRunner() {
        if (!this._transitionRunner) {
            this._transitionRunner = createMotionTransitionRunner( // event/workflow/motion-transition-runner.js
                MOTION_ENGINE_TRANSITION_CLEANUP_TASK,
                { // core/dom-refs.js
                    container: motionEngineContainer,
                    layer1: motionEngineLayer1,
                    layer1Pan: motionEngineLayer1Pan,
                    layer2: motionEngineLayer2,
                    layer2Pan: motionEngineLayer2Pan,
                },
            );
        }
        return this._transitionRunner;
    },

    /** Public — ĐIỂM VÀO DUY NHẤT để hiện 1 resource. `objectUrl` rỗng/null -> `stop()` HẲN (cả 3
     * Runner — Transition Runner tự nó KHÔNG xử lý rỗng/null, xem docstring event/workflow/motion-
     * transition-runner.js). Có nội dung -> giao THẲNG cho Transition Runner quyết tĩnh hay
     * transition (`hasResource()` CỦA CHÍNH NÓ, KHÔNG phải field nào ở đây) — xong thì Point
     * Move/React Beat mới activate theo, ĐÚNG thứ tự bản gốc (Transition set xong DOM rồi Point
     * Move/React Beat mới bắt đầu animate lên đó).
     * @param {string|null} objectUrl - ĐÃ resolve sẵn (createBlobUrl(), service/blob-url.js) —
     *        Transition Runner nhận ownership NGAY khi hàm này được gọi (giữ/chuyển layer/revoke),
     *        nơi gọi (VBG) không revoke lại. Rỗng/null -> coi như `stop()`.
     * @param {object} preset - ĐÃ resolve sẵn (MOTION_ENGINE_NO_OP_PRESET nếu chưa gắn Motion).
     * @param {number} advanceMs - thời lượng hiển thị ảnh NÀY — nơi gọi tự tính, dùng làm thời lượng
     *        chạy Point Move/transition.
     */
    async showImage(objectUrl, preset, advanceMs) {
        if (!objectUrl) { this.stop(); return; }
        this._setActivePreset(preset);
        await this._ensureTransitionRunner().showImage(objectUrl, preset, advanceMs); // event/workflow/motion-transition-runner.js
        this._ensurePointMoveRunner().activateForNewContent(this._activePreset, advanceMs); // event/workflow/motion-point-move-runner.js
        this._syncBeatReactLoop();
    },

    /** Public — đổi preset đang áp cho ẢNH ĐANG HIỆN tại chỗ: KHÔNG đổi ảnh, KHÔNG chạy transition,
     * chỉ Point Move/React Beat chuyển sang preset mới NGAY (`activateForPresetChange()` của Runner
     * tự tiếp diễn mượt từ vị trí thật đang hiển thị, không giật về baseline — xem docstring
     * event/workflow/motion-point-move-runner.js). No-op nếu chưa có resource nào đang hiện
     * (`_ensureTransitionRunner().hasResource()`).
     * @param {object} preset - preset MỚI (MOTION_ENGINE_NO_OP_PRESET nếu chọn "Không") @param {number} advanceMs */
    updatePreset(preset, advanceMs) {
        if (!this._ensureTransitionRunner().hasResource()) return; // event/workflow/motion-transition-runner.js
        this._setActivePreset(preset || MOTION_ENGINE_NO_OP_PRESET);
        this._ensurePointMoveRunner().activateForPresetChange(this._activePreset, advanceMs); // event/workflow/motion-point-move-runner.js
        this._syncBeatReactLoop();
    },

    /** Tạo (LƯỜI, ĐÚNG 1 LẦN) instance `createMotionPointMoveRunner()` cho Point Move của VBG —
     * target CỐ ĐỊNH `motionEnginePointMoveWrapper` (VBG luôn sở hữu nó tại chỗ). Toàn bộ điều phối
     * Point Move (dispatcher 'one'/'all', đường cong Timing, force-baseline, suy vị trí SỐNG liền
     * mạch...) nằm HẲN trong Runner DÙNG CHUNG (event/workflow/motion-point-move-runner.js) — file
     * NÀY giờ CHỈ còn gọi ĐÚNG lúc (`activateForNewContent()` ở `showImage()`,
     * `activateForPresetChange()` ở `updatePreset()`), KHÔNG còn giữ state/logic gì của chính
     * Point Move nữa.
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
        if (!this._ensureTransitionRunner().hasResource() || appState.get('motionRunning') !== presetId) return; // event/workflow/motion-transition-runner.js
        const preset = findMotionPresetById(appState.get('motionPresets'), presetId); // core/motion-presets.js
        if (!preset) return;
        this._setActivePreset(preset); // đồng bộ bản cache theo đúng dữ liệu vừa lưu (enabled mới)
        this._ensurePointMoveRunner().liveToggle(preset, enabled); // event/workflow/motion-point-move-runner.js
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

    /** Dừng hẳn — dọn CẢ 3 Runner + reset preset active. Transition Runner tự lo dọn layer/URL/
     * timer treo của chính nó (event/workflow/motion-transition-runner.js::stop()). */
    stop() {
        if (this._transitionRunner) this._transitionRunner.stop(); // event/workflow/motion-transition-runner.js
        if (this._beatReactRunner) this._beatReactRunner.stop(); // event/workflow/motion-beat-react-runner.js — kill task + trả transform về rỗng
        if (this._pointMoveRunner) this._pointMoveRunner.stop(); // event/workflow/motion-point-move-runner.js — dừng animation + dọn state suy tiếp
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
        if (!this._ensureTransitionRunner().hasResource()) return null; // event/workflow/motion-transition-runner.js
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
     * (`showImage()`/`updatePreset()`). CHỈ còn 1 dòng gọi thẳng Runner — KHÔNG tự quản lý task/
     * state gì nữa (xem event/workflow/motion-beat-react-runner.js). */
    _syncBeatReactLoop() {
        this._ensureBeatReactRunner().sync();
    },
};
