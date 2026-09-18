/**
 * event/workflow/motion-beat-react-runner.js — "Beat React Runner" DÙNG CHUNG cho MỌI nơi tiêu thụ
 * muốn chạy React Beat Audio lên 1 target element bất kỳ — TÁCH RA khỏi workflowMotionEngine để
 * KHÔNG PHẢI nhân bản logic mỗi lần có thêm 1 nơi tiêu thụ mới (Giang chỉ ra: "đã tách bạch rõ
 * trách nhiệm motion phải quản lý việc apply live bất kể nơi tiêu thụ... sau này có N nơi tiêu thụ
 * thì cũng ko thể nhân bản để áp dụng + thêm code và phí hiệu năng theo dõi live").
 *
 * SỬA (bản đầu SAI — Giang chỉ ra qua việc soát lại chính VBG cũ: `_tickBeatReact()` gốc CHỦ ĐỘNG
 * quyết KHÔNG tự `.find()` preset mỗi frame — đọc `this._activePreset`, 1 bản CACHE, và có 1 kênh
 * RIÊNG `liveBeatReactToggle()` để "đẩy" cache mới lúc cần, comment gốc ghi rõ: "event-driven,
 * KHÔNG phải 1 task liên tục poll state — tốn hiệu năng vô ích vì thay đổi CHỈ đến từ 1 hành động
 * bấm rời rạc") — bản Runner NÀY giờ theo ĐÚNG nguyên tắc đó: CACHE preset, CHỈ tra lại (`.find()`)
 * lúc `sync()` được gọi (event-driven — lúc vào/thoát mode, đổi preset gắn, HOẶC lúc registry dưới
 * đây báo "có preset vừa bị sửa nội dung") — `_tick()` (chạy mỗi frame, 60 lần/giây) chỉ ĐỌC cache,
 * KHÔNG bao giờ tự quét mảng.
 *
 * ĐỂ vẫn LIVE đúng khi sửa NỘI DUNG 1 preset đang chạy (không chỉ lúc đổi hẳn preset khác) — module
 * này giữ 1 REGISTRY nhỏ (mọi runner đã tạo, list ngắn — hiện tại nhiều nhất vài instance, KHÔNG
 * phải hàng nghìn) + hàm `notifyMotionBeatReactPresetsChanged()` — Motion Edit
 * (event/workflow/motion-presets.js::_mutateEditing(), DUY NHẤT 1 chỗ, chạy sau MỌI lần lưu field
 * bất kỳ) gọi hàm này SAU MỖI lần lưu — broadcast "có gì đó vừa đổi" tới TẤT CẢ runner đang tồn tại,
 * mỗi runner tự `sync()` lại (rẻ — bằng đúng 1 lần `.find()` mỗi runner, KHÔNG phải mỗi frame) và tự
 * biết mình có LIÊN QUAN hay không (`getPresetFn()` của riêng nó tự quyết). Motion (Edit) hoàn toàn
 * KHÔNG cần biết ai đang tồn tại/dùng field nào — chỉ "hét lên" 1 tiếng, đúng tinh thần "Motion tách
 * khỏi nơi tiêu thụ": nơi tiêu thụ tự lọc xem tiếng hét đó có liên quan tới mình không.
 *
 * `createMotionBeatReactRunner(taskName, getTargetElementFn, getPresetFn)` — factory, trả về
 * `{ sync(), stop(), pause(), resume() }`:
 *   `getTargetElementFn()` — trả element sẽ nhận `style.transform` (gọi lại mỗi lần `sync()`,
 *   KHÔNG cache cứng lúc tạo runner — target CÓ THỂ đổi giữa các lần sync, vd Video Player mode di
 *   chuyển nội dung của mình vào/ra 1 element DÙNG CHUNG, xem event/workflow/video-player.js).
 *   `getPresetFn()` — trả preset ĐANG áp dụng cho nơi tiêu thụ đó (hoặc `null`) — CHỈ gọi lúc
 *   `sync()` (event-driven), KHÔNG gọi trong `_tick()`.
 *
 * TÁI DÙNG NGUYÊN 4 hàm THUẦN tính toán + hằng số decay đã có sẵn — CÙNG công thức/cảm giác cho MỌI
 * nơi tiêu thụ, không viết lại: computeMotionEngineBeatReactEnvelope()/...ZoomScale()/...Offset()/
 * ...NextPolarity() (core/motion-engine.js), MOTION_ENGINE_BEATREACT_DECAY_MS (event/workflow/
 * visual-bg-photo-motion.js).
 *
 * `sync()` — gọi mỗi khi context CÓ THỂ vừa đổi (vào/thoát mode tiêu thụ, đổi preset gắn) — tra lại
 * `getPresetFn()`, cập nhật cache, tự bật/tắt task theo kết quả. Đang chạy + preset đổi (khác
 * object/nội dung nhưng vẫn hợp lệ) -> KHÔNG restart animation dở dang, chỉ thay cache — `_tick()`
 * đọc bản MỚI NGAY frame kế tiếp.
 * `stop()` — dừng hẳn task + trả `target.style.transform` về rỗng (tránh kẹt ở giá trị cuối).
 * `pause()`/`resume()` — đóng băng/tiếp tục TẠI ĐÚNG VỊ TRÍ đang chạy (KHÁC `stop()` — không dọn
 * transform, không reset envelope) — dùng lúc Song/Video dừng tạm (không phải thoát hẳn mode).
 *
 * workflowVisualBgPhotoMotion (VBG) ĐÃ CHUYỂN sang dùng Runner này (xem event/workflow/visual-bg-
 * photo-motion.js) — KHÔNG còn `_tickBeatReact()`/`_beatReact*` state riêng nữa, VBG giờ là 1 "nơi
 * tiêu thụ" như Player, đúng nghĩa "Motion tách khỏi nơi tiêu thụ".
 *
 * NẠP SAU: core/motion-engine.js (4 hàm computeMotionEngineBeatReact*), event/workflow/
 * visual-bg-photo-motion.js (MOTION_ENGINE_BEATREACT_DECAY_MS), service/task-manager.js (taskManager),
 * service/state.js (appState).
 * NẠP TRƯỚC: event/workflow/visual-bg-photo-motion.js (dùng createMotionBeatReactRunner(), đổi tên
 * 17/09/2026 từ event/workflow/motion-engine.js),
 * event/workflow/motion-presets.js (dùng notifyMotionBeatReactPresetsChanged()),
 * event/workflow/player-display-settings.js.
 *
 * @param {string} taskName - tên task taskManager, PHẢI duy nhất (không trùng nơi tiêu thụ khác).
 * @param {() => HTMLElement|null} getTargetElementFn
 * @param {() => object|null} getPresetFn - trả preset {reactBeatAudio:{...}} hoặc null.
 * @returns {{sync: () => void, stop: () => void, pause: () => void, resume: () => void}}
 */

/** Registry MỌI runner đã tạo — dùng bởi notifyMotionBeatReactPresetsChanged() ngay dưới. List
 * NGẮN (vài instance, mỗi nơi tiêu thụ tạo ĐÚNG 1 lần rồi dùng lại — xem
 * event/workflow/player-display-settings.js::_ensureVideoShowingRunner() làm ví dụ), KHÔNG bao giờ
 * lớn, nên broadcast tới TẤT CẢ là rẻ, không cần cơ chế lọc theo presetId phức tạp hơn. */
const _motionBeatReactRunnerRegistry = [];

/** Gọi từ NƠI LƯU EDIT preset (event/workflow/motion-presets.js::_mutateEditing(), DUY NHẤT 1 chỗ,
 * chạy sau MỌI lần lưu field bất kỳ của MỌI preset) — báo TẤT CẢ runner đang tồn tại tự `sync()`
 * lại. Runner nào KHÔNG liên quan (preset của nó không phải preset vừa sửa, hoặc nó chưa từng chạy
 * gì) thì `sync()` tự no-op (so `shouldRun` cũ/mới, không đổi thì không làm gì) — CHI PHÍ chỉ bằng
 * số runner ĐANG TỒN TẠI (cực ít), KHÔNG phải theo dõi liên tục. */
function notifyMotionBeatReactPresetsChanged() {
    _motionBeatReactRunnerRegistry.forEach((r) => r.sync());
}

function createMotionBeatReactRunner(taskName, getTargetElementFn, getPresetFn) {
    // State RIÊNG của runner NÀY — mỗi lần gọi createMotionBeatReactRunner() tạo 1 closure state
    // ĐỘC LẬP, nên N nơi tiêu thụ gọi N lần là có N runner tách biệt hoàn toàn, không đụng nhau.
    let envelope = 0;
    let wasAttacking = false;
    // SỬA (phản hồi Giang — "chia Pan thành Pan X/Pan Y") — `panPolarity` tách thành
    // `panXPolarity`/`panYPolarity`, 2 trục ĐỘC LẬP hoàn toàn (đảo cực riêng theo beat của CHÍNH nó).
    let panXPolarity = 0;
    let panYPolarity = 0;
    let rotatePolarity = 0;
    let lastTickMs = 0;
    // MỚI (phản hồi Giang — "bổ sung tick Random Max") — biên trần THẬT SỰ đang dùng cho lượt "beat"
    // hiện tại, mỗi hiệu ứng 1 biến riêng — `null` = CHƯA roll lần nào (khởi tạo lười ở `_tick()` đầu
    // tiên), reset về `null` mỗi lần `sync()` bắt đầu 1 vòng chạy MỚI (xem `sync()` bên dưới).
    let zoomEffectiveMax = null;
    let panXEffectiveMax = null;
    let panYEffectiveMax = null;
    let rotateEffectiveMax = null;
    let cachedPreset = null; // CHỈ cập nhật lúc sync() chạy (event-driven) — _tick() ĐỌC từ đây, KHÔNG tự .find() mỗi frame

    /** MỚI (phản hồi Giang — Random Max) — biên trần dùng cho 1 lượt "beat": `randomMax` tắt -> LUÔN
     * đúng `configuredMax` (hành vi CŨ, không đổi). `randomMax` bật -> resolve NGẪU NHIÊN 1 lần mỗi
     * lượt beat, trong [absoluteMin, configuredMax] — vd configuredMax=60°, mỗi beat có thể đạt bất
     * kỳ đỉnh nào trong [0°,60°], không phải luôn đúng 60°.
     * @param {{randomMax:boolean}} effect @param {number} absoluteMin - biên dưới TUYỆT ĐỐI (100 cho
     *   zoom/panX/panY, 0 cho rotate). @param {number} configuredMax @returns {number} */
    function _rollEffectiveMax(effect, absoluteMin, configuredMax) {
        if (!effect.randomMax) return configuredMax;
        return absoluteMin + Math.random() * (configuredMax - absoluteMin);
    }

    /** 1 frame RAF — CÙNG công thức `_tickBeatReact()` gốc của workflowMotionEngine NGUYÊN VẸN:
     * envelope follower + zoom/panX/panY/rotate nội suy theo `energy` + đảo cực mỗi beat mới cho
     * hướng leftToRight/rightToLeft (panX/rotate) hoặc upToDown/downToUp (panY) — CHỈ đọc
     * `cachedPreset` (KHÔNG gọi `getPresetFn()` ở đây). */
    function _tick() {
        if (!cachedPreset) { stop(); return; } // phòng hờ — bình thường sync() đã dừng task TRƯỚC khi cachedPreset về null
        const rb = cachedPreset.reactBeatAudio;
        const target = getTargetElementFn();
        const now = performance.now();
        const deltaMs = lastTickMs ? (now - lastTickMs) : 16; // lượt tick đầu (chưa có mốc trước) -> giả định 1 frame ~16ms
        lastTickMs = now;
        const beatScale = appState.get('beatScale'); // service/state/visualizer-runtime.js

        const isAttacking = beatScale >= envelope;
        const isNewBeat = isAttacking && !wasAttacking; // rising edge — "beat mới"
        wasAttacking = isAttacking;
        // Khởi tạo LƯỜI (lượt tick đầu tiên, effectiveMax vẫn null) + roll LẠI mỗi khi có "beat mới"
        // — CÙNG NHỊP với đảo polarity ngay dưới (1 lượt beat = 1 lần roll, không phải mỗi frame).
        if (isNewBeat || zoomEffectiveMax === null) zoomEffectiveMax = _rollEffectiveMax(rb.zoom, 100, rb.zoom.maxPct);
        if (isNewBeat || panXEffectiveMax === null) panXEffectiveMax = _rollEffectiveMax(rb.panX, 100, rb.panX.maxPct);
        if (isNewBeat || panYEffectiveMax === null) panYEffectiveMax = _rollEffectiveMax(rb.panY, 100, rb.panY.maxPct);
        if (isNewBeat || rotateEffectiveMax === null) rotateEffectiveMax = _rollEffectiveMax(rb.rotate, 0, rb.rotate.maxDeg);
        if (isNewBeat) {
            if (rb.panX.direction === 'leftToRight' || rb.panX.direction === 'rightToLeft') {
                panXPolarity = computeMotionEngineBeatReactNextPolarity(panXPolarity, rb.panX.direction, rb.panX.reverse); // core/motion-engine.js
            }
            if (rb.panY.direction === 'upToDown' || rb.panY.direction === 'downToUp') {
                // MIRROR ĐÚNG panX — "upToDown"/"downToUp" cùng cơ chế "leftToRight"/"rightToLeft",
                // computeMotionEngineBeatReactNextPolarity() chỉ so sánh CHUỖI direction với hằng số
                // 'leftToRight' để quyết cực khởi đầu -> truyền thẳng 'leftToRight' khi upToDown (cùng
                // ngữ nghĩa "chiều thuận"), 'rightToLeft' khi downToUp, KHÔNG cần sửa hàm core dùng chung.
                const mappedDirection = rb.panY.direction === 'upToDown' ? 'leftToRight' : 'rightToLeft';
                panYPolarity = computeMotionEngineBeatReactNextPolarity(panYPolarity, mappedDirection, rb.panY.reverse); // core/motion-engine.js
            }
            if (rb.rotate.direction === 'leftToRight' || rb.rotate.direction === 'rightToLeft') {
                rotatePolarity = computeMotionEngineBeatReactNextPolarity(rotatePolarity, rb.rotate.direction, rb.rotate.reverse); // core/motion-engine.js
            }
        }

        envelope = computeMotionEngineBeatReactEnvelope(envelope, beatScale, deltaMs, MOTION_ENGINE_BEATREACT_DECAY_MS); // core/motion-engine.js + event/workflow/visual-bg-photo-motion.js
        const energy = envelope;

        const zoomScale = rb.zoom.enabled ? computeMotionEngineBeatReactZoomScale(zoomEffectiveMax, energy) : 1; // core/motion-engine.js
        // panX dùng NGUYÊN 'left'/'right'/'leftToRight'/'rightToLeft'; panY MIRROR qua 'up'->'left',
        // 'down'->'right' (computeMotionEngineBeatReactOffset() chỉ so sánh CHUỖI 'left'/'right' để
        // quyết dấu cố định — 'up'/'down' cũng cần map lại, KHÔNG cần sửa hàm core dùng chung).
        const panXPct = rb.panX.enabled ? computeMotionEngineBeatReactOffset(rb.panX.direction, panXEffectiveMax - 100, energy, panXPolarity || 1) : 0; // core/motion-engine.js — trừ baseline 100% trước khi truyền
        const panYDirectionForOffset = rb.panY.direction === 'up' ? 'left' : (rb.panY.direction === 'down' ? 'right' : rb.panY.direction);
        const panYPct = rb.panY.enabled ? computeMotionEngineBeatReactOffset(panYDirectionForOffset, panYEffectiveMax - 100, energy, panYPolarity || 1) : 0; // core/motion-engine.js
        const rotateDeg = rb.rotate.enabled ? computeMotionEngineBeatReactOffset(rb.rotate.direction, rotateEffectiveMax, energy, rotatePolarity || 1) : 0; // core/motion-engine.js — baseline 0°

        if (target) target.style.transform = `scale(${zoomScale}) translateX(${panXPct}%) translateY(${panYPct}%) rotate(${rotateDeg}deg)`;
    }

    /** Tra lại `getPresetFn()` (EVENT-DRIVEN — gọi lúc context CÓ THỂ vừa đổi, KHÔNG phải mỗi
     * frame), cập nhật cache, tự bật/tắt task theo kết quả. Đang chạy + preset đổi (khác object
     * hoặc nội dung nhưng VẪN hợp lệ) -> KHÔNG restart animation dở dang (envelope/polarity GIỮ
     * NGUYÊN), chỉ thay `cachedPreset` — `_tick()` đọc bản MỚI NGAY frame kế tiếp. */
    function sync() {
        const preset = getPresetFn();
        cachedPreset = preset;
        const shouldRun = !!preset;
        const isRunning = taskManager.isTaskRunning(taskName); // service/task-manager.js
        if (shouldRun && !isRunning) {
            envelope = 0; wasAttacking = false; panXPolarity = 0; panYPolarity = 0; rotatePolarity = 0; lastTickMs = 0; // bắt đầu vòng MỚI luôn từ baseline
            zoomEffectiveMax = null; panXEffectiveMax = null; panYEffectiveMax = null; rotateEffectiveMax = null; // reset Random Max — roll LẠI ngay lượt beat đầu của vòng mới
            taskManager.addNew(taskName, { time: 0, exe: _tick, mode: 'raf', count: 0 }); // service/task-manager.js — CHỈ đăng ký, CHƯA chạy
            taskManager.operator(taskName, 'enabled'); // BẮT BUỘC — addNew() không tự bật
        } else if (!shouldRun && isRunning) {
            stop();
        }
    }

    /** Dừng hẳn task + trả target về KHÔNG transform (tránh kẹt ở giá trị cuối trước lúc dừng). */
    function stop() {
        cachedPreset = null;
        if (taskManager.plan[taskName]) taskManager.kill(taskName); // service/task-manager.js
        const target = getTargetElementFn();
        if (target) target.style.transform = '';
    }

    /** Đóng băng TẠI ĐÚNG VỊ TRÍ đang chạy — KHÁC `stop()`, KHÔNG dọn transform/reset state, chỉ
     * tạm ngưng task. `resume()` tiếp tục đúng chỗ. No-op nếu chưa từng chạy. */
    function pause() {
        if (taskManager.plan[taskName]) taskManager.pause(taskName); // service/task-manager.js
    }

    function resume() {
        if (taskManager.plan[taskName]) taskManager.resume(taskName); // service/task-manager.js
    }

    const runnerHandle = { sync, stop, pause, resume };
    _motionBeatReactRunnerRegistry.push(runnerHandle); // đăng ký NGAY lúc tạo — notifyMotionBeatReactPresetsChanged() cần thấy nó dù chưa từng sync() lần nào
    return runnerHandle;
}
