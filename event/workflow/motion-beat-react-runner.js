/**
 * event/workflow/motion-beat-react-runner.js — React Beat Runner dùng chung mọi nơi tiêu thụ (VBG, Video/Photo Player) —
 * cơ chế thuần (nguyên tắc tua vít), không nhân bản logic theo từng nơi tiêu thụ.
 *
 * Event-driven: CACHE preset, chỉ tra lại (`getPresetFn()`) lúc `sync()` — vào/thoát mode, đổi preset gắn, hoặc registry báo
 * "có preset vừa sửa nội dung" (`notifyMotionBeatReactPresetsChanged()`, Motion Edit gọi sau mỗi lần lưu — broadcast tới mọi
 * runner, runner tự biết có liên quan không qua `getPresetFn()` của nó). `_tick()` (mỗi frame) chỉ đọc cache.
 *
 * `createMotionBeatReactRunner(taskName, getTargetElementFn, getPresetFn, getSpeedFn)` -> `{ sync, stop, pause, resume,
 * release }`:
 *   `getTargetElementFn()` — element nhận `style.transform`, gọi lại mỗi frame (target có thể đổi, vd Video Player di nội
 *   dung vào/ra 1 element dùng chung).
 *   `sync()` — đang chạy + preset đổi (vẫn hợp lệ) -> không restart (envelope/cực giữ nguyên), frame kế đọc bản mới.
 *   `stop()` — dừng hẳn + trả transform về rỗng. `pause()`/`resume()` — đóng băng/tiếp tục đúng vị trí.
 *   `release(durationMs?)` — nhả về baseline (task chạy tiếp, không đọc nhạc): có `durationMs` thì tuyến tính chạm baseline
 *   đúng hạn (theo Transition), không thì decay chuẩn; trong lúc release `pause()` no-op, `resume()` đọc nhạc lại.
 * Tính toán mỗi frame: core/motion-runner.js (envelope follower, beat mới, Random Max, đảo cực, transform).
 *
 * NẠP SAU: core/motion-runner.js, service/task-manager.js, service/audio-analysis.js.
 *
 * @param {string} taskName - tên task taskManager, duy nhất theo nơi tiêu thụ.
 * @param {() => HTMLElement|null} getTargetElementFn
 * @param {() => object|null} getPresetFn - preset {reactBeatAudio:{...}} hoặc null.
 * @param {(() => number)=} getSpeedFn - tuỳ chọn: tốc độ phát (Video Player — decay co giãn theo), VBG không truyền (1).
 * @returns {{sync: () => void, stop: () => void, pause: () => void, resume: () => void, release: (durationMs?: number) => void}}
 */

/** Mọi runner đã tạo (vài instance — mỗi nơi tiêu thụ tạo 1 lần rồi dùng lại). */
const _motionBeatReactRunnerRegistry = [];

/** Báo mọi runner tự `sync()` lại — runner không liên quan tự no-op. Gọi từ event/workflow/motion-presets.js::_patchEditing(). */
function notifyMotionBeatReactPresetsChanged() {
    _motionBeatReactRunnerRegistry.forEach((r) => r.sync());
}

/** Tín hiệu nhạc của frame: đang nhả về baseline -> 0 (envelope tự decay). */
const BEAT_REACT_BEAT_SCALE_BY_RELEASING = {
    true: () => 0,
    false: () => audioAnalysis.beatScale(), // service/audio-analysis.js
};
/** Envelope frame mới: follower chuẩn (gồm cả nhả không hẹn giờ) / nhả tuyến tính có hẹn giờ. */
const BEAT_REACT_ENVELOPE_BY_MODE = {
    follow: (envelope, beatScale, deltaMs, decayMs) => computeMotionEngineBeatReactEnvelope(envelope, beatScale, deltaMs, decayMs), // core/motion-runner.js
    timedRelease: (envelope, beatScale, deltaMs, decayMs, release, nowMs) => computeMotionBeatReactReleaseEnvelope(release, nowMs),
};
/** Frame không còn preset (bình thường sync() đã dừng task trước) -> dừng hẳn. */
const BEAT_REACT_TICK_BY_HAS_PRESET = {
    true: (ops) => ops.tickFrame(),
    false: (ops) => ops.stop(),
};
/** Việc của sync() (core/motion-runner.js::resolveMotionBeatReactSyncAction()). */
const BEAT_REACT_SYNC_BY_ACTION = {
    start: (ops) => ops.start(),
    stop: (ops) => ops.stop(),
    keep: () => {},
};
/** Đọc tốc độ phát: nơi tiêu thụ có truyền hàm hay không. */
const BEAT_REACT_SPEED_READER_BY_PROVIDED = {
    true: (getSpeedFn) => getSpeedFn,
    false: () => () => 1,
};

function createMotionBeatReactRunner(taskName, getTargetElementFn, getPresetFn, getSpeedFn) {
    const readSpeed = BEAT_REACT_SPEED_READER_BY_PROVIDED[typeof getSpeedFn === 'function'](getSpeedFn);
    let envelope = 0;
    let beat = buildMotionBeatReactInitialBeat(); // core/motion-runner.js — beat mới, biên trần Random Max, cực xen kẽ
    let lastTickMs = 0;
    let cachedPreset = null; // chỉ cập nhật lúc sync() — _tick() đọc từ đây
    let releasing = false;   // đang nhả về baseline (release()) — xoá bởi resume()/sync() vòng mới/stop()
    let envelopeMode = 'follow';
    let release = null;      // {fromEnvelope, startMs, durationMs} của lượt nhả có hẹn giờ

    const ops = {
        /** 1 frame: tín hiệu -> nhịp (beat mới / Random Max / cực) -> envelope -> transform. */
        tickFrame() {
            const rb = cachedPreset.reactBeatAudio;
            const nowMs = performance.now();
            const deltaMs = computeMotionBeatReactDeltaMs(nowMs, lastTickMs); // core/motion-runner.js
            lastTickMs = nowMs;
            const beatScale = BEAT_REACT_BEAT_SCALE_BY_RELEASING[releasing]();
            beat = advanceMotionBeatReactBeat(beat, rb, beatScale, envelope); // core/motion-runner.js
            envelope = BEAT_REACT_ENVELOPE_BY_MODE[envelopeMode](envelope, beatScale, deltaMs, computeMotionBeatReactDecayMs(readSpeed()), release, nowMs);
            setMotionBeatReactTransform(getTargetElementFn(), computeMotionBeatReactTransform(rb, beat.maxes, beat.polarities, envelope)); // core/motion-runner.js
        },

        /** Vòng mới luôn từ baseline, đọc nhạc thật, roll lại Random Max ngay beat đầu. */
        start() {
            releasing = false;
            envelopeMode = 'follow';
            envelope = 0;
            beat = buildMotionBeatReactInitialBeat(); // core/motion-runner.js
            lastTickMs = 0;
            taskManager.addNew(taskName, { time: 0, exe: _tick, mode: 'raf', count: 0 }); // service/task-manager.js — chỉ đăng ký
            taskManager.operator(taskName, 'enabled'); // addNew() không tự bật
        },

        stop,
    };

    function _tick() {
        BEAT_REACT_TICK_BY_HAS_PRESET[Boolean(cachedPreset)](ops);
    }

    /** Tra lại preset, cập nhật cache, tự bật/tắt task. */
    function sync() {
        const preset = getPresetFn();
        cachedPreset = preset;
        BEAT_REACT_SYNC_BY_ACTION[resolveMotionBeatReactSyncAction(Boolean(preset), taskManager.isTaskRunning(taskName))](ops); // core/motion-runner.js
    }

    /** Dừng hẳn task + trả target về không transform. */
    function stop() {
        cachedPreset = null;
        releasing = false;
        envelopeMode = 'follow';
        if (taskManager.plan[taskName]) taskManager.kill(taskName); // service/task-manager.js
        setMotionBeatReactTransform(getTargetElementFn(), ''); // core/motion-runner.js
    }

    /** Đóng băng đúng vị trí (không dọn transform/state); đang nhả về baseline thì không đóng băng giữa chừng. */
    function pause() {
        if (releasing) return;
        if (taskManager.plan[taskName]) taskManager.pause(taskName); // service/task-manager.js
    }

    /** Đọc nhạc thật lại (thoát cả pause lẫn release), tiếp đúng envelope hiện tại. */
    function resume() {
        releasing = false;
        envelopeMode = 'follow';
        if (taskManager.plan[taskName]) taskManager.resume(taskName); // service/task-manager.js
    }

    /** Nhả về baseline (xem docstring đầu file). No-op nếu runner chưa chạy. @param {number} [durationMs] */
    function releaseToBaseline(durationMs) {
        if (!taskManager.plan[taskName]) return;
        release = resolveMotionBeatReactRelease(envelope, performance.now(), durationMs); // core/motion-runner.js
        envelopeMode = release.envelopeMode;
        releasing = true;
        taskManager.resume(taskName); // service/task-manager.js — resume task đang chạy là vô hại
    }

    const runnerHandle = { sync, stop, pause, resume, release: releaseToBaseline };
    _motionBeatReactRunnerRegistry.push(runnerHandle); // đăng ký ngay lúc tạo — broadcast cần thấy cả runner chưa sync()
    return runnerHandle;
}
