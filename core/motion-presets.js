/**
 * core/motion-presets.js — Core THUẦN (Rule 1-5) cho hệ thống "Cấu hình Motion" lưu DB, MỚI
 * (29/08/2026, phản hồi Giang — "Settings > Motion" đổi từ 1 cấu hình DUY NHẤT nhúng thẳng trong
 * Visual Background config sang danh sách preset có thể đặt tên/thêm/xoá, CÙNG KHUÔN hệ preset EQ
 * đã có (core/eq-presets.js) — mirror 1-1 cấu trúc, chỉ đổi field cho khớp Motion).
 *
 * Preset = {id, name, transitionEnabled, transitionType, transitionDurationMs, transitionInOutRatio,
 * transitionEasing, kenBurnsEnabled, kenBurnsMode}. Danh sách preset SỐNG ở `appState.motionPresets`
 * (nạp lúc boot từ `meta.motionPresets`), xem event/workflow/motion-presets.js::
 * loadPresetsOnBoot(). Preset ĐANG GẮN vào Visual Background (Photo) là 1 field tham chiếu đơn giản
 * `appConfigVisualBg.motionPresetId` (null = chưa gắn preset nào — Photo hiện KHÔNG transition/
 * Ken Burns gì cả, chuyển cứng).
 *
 * KHÁC EQ (luôn có `flat` khoá sửa/xoá làm lưới an toàn) — Motion KHÔNG cần preset khoá nào: danh
 * sách rỗng vẫn hợp lệ (Photo VBG không gắn gì thì đơn giản không animate, không phải fallback lỗi).
 *
 * `transitionEnabled`/`kenBurnsEnabled` — MỚI, THAY cho việc suy luận gián tiếp qua ẩn/hiện DOM cũ:
 * đây là 2 CÔNG TẮC ĐỘC LẬP quyết định 1 preset có áp dụng Transition/Ken Burns hay không — các field
 * chi tiết (`transitionType`/`kenBurnsMode`...) LUÔN hiển thị/chỉnh được trong UI bất kể công tắc
 * đang bật hay tắt (Giang chốt — "bỏ ẩn/hiện DOM theo toggle"), chỉ CÓ ÁP DỤNG LÚC PHÁT hay không mới
 * phụ thuộc 2 công tắc này. Cả 2 `false` -> preset đó không tạo hiệu ứng gì (ảnh chuyển cứng).
 *
 * `reactBeatAudio` — MỚI (29/08/2026, phản hồi Giang) — pulse zoom/pan/rotate BẮN THEO BEAT nhạc
 * (đọc `appState.beatScale`/`beatTimes`, tính mỗi frame trong event/workflow/visualizer-render.js —
 * xem event/workflow/motion.js::_tickBeatReact()). `enabled` bật cả cụm; `replaceMovement` quyết
 * định layer `.ss-beat-react` (MỚI, xem index.html/assets/css/motion.css) THAY THẾ hẳn chuyển
 * động Ken Burns thường (`true`) hay chạy SONG SONG, transform 2 layer nhân dồn (`false`). 3 hiệu
 * ứng con (zoom/pan/rotate) ĐỘC LẬP nhau — bật được 1, vài, hay cả 3 cùng lúc (checkbox riêng từng
 * cái), mỗi cái tự đếm `everyNBeats` RIÊNG (khác N thì bắn lệch nhịp nhau, không đồng bộ):
 *   zoom.everyNBeats   — cứ mỗi N beat, phóng to từ 100% lên `amountPct` (100-200) rồi tự thu về.
 *   pan.everyNBeats    — cứ mỗi N beat, dịch chuyển theo `direction` (left/right/leftToRight/
 *                        rightToLeft — 2 cái sau là ĐI QUA LẠI giữa 2 biên, 2 cái đầu chỉ đi 1 hướng
 *                        rồi tự về) với biên độ `amountPct` (100-150) rồi tự về vị trí gốc.
 *   rotate.everyNBeats — cứ mỗi N beat, xoay theo `direction` (CÙNG 4 lựa chọn pan, "left"=ngược
 *                        chiều kim đồng hồ/"right"=thuận) biên độ `amountDeg` (0-360) rồi tự về 0°.
 */
const MOTION_BEAT_REACT_DIRECTIONS = ['left', 'right', 'leftToRight', 'rightToLeft'];
const MOTION_BEAT_REACT_EVERY_N_BEATS_MIN = 1;
const MOTION_BEAT_REACT_EVERY_N_BEATS_MAX = 32;

/** 1 preset "trắng" — dùng làm giá trị khởi tạo lúc "Thêm cấu hình" (nút + ở header danh sách) —
 * CÙNG mặc định với `DEFAULT_VISUAL_BG_CONFIG.motion` cũ (trước khi tách preset), giữ trải
 * nghiệm "cấu hình mới" quen thuộc thay vì mọi field về 0/rỗng.
 * @param {string} name
 * @returns {object} */
function buildBlankMotionPreset(name) {
    return {
        id: generateMotionPresetId(),
        name,
        transitionEnabled: true,
        transitionType: 'fade',
        transitionDurationMs: 1000,
        transitionInOutRatio: 50,
        transitionEasing: 'ease',
        kenBurnsEnabled: false,
        kenBurnsMode: 'zoomPanRandom',
        reactBeatAudio: {
            enabled: false,
            replaceMovement: false,
            zoom: { enabled: false, everyNBeats: 4, amountPct: 150 },
            pan: { enabled: false, everyNBeats: 4, direction: 'leftToRight', amountPct: 120 },
            rotate: { enabled: false, everyNBeats: 4, direction: 'leftToRight', amountDeg: 90 },
        },
    };
}

/** @param {object[]} presets @param {string} id @returns {object|null} */
function findMotionPresetById(presets, id) {
    return presets.find((p) => p.id === id) || null;
}

/** Id RIÊNG cho preset mới — cùng khuôn generateEqPresetId() (core/eq-presets.js).
 * @returns {string} */
function generateMotionPresetId() {
    return `motion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate 1 preset đọc từ DB (phòng dữ liệu hỏng/thiếu field — record cũ trước khi có field nào
 * đó) — trả bản đã làm sạch, KHÔNG throw. Dùng bởi `loadPresetsOnBoot()` (event/workflow/
 * motion-presets.js) cho TỪNG preset trong mảng đọc lên, và bởi migration (xem
 * event/workflow/visual-bg.js::loadPersistedSettingsOnBoot()) khi dựng preset ĐẦU TIÊN từ
 * `motion` nhúng cũ.
 * @param {object} raw
 * @returns {object}
 */
function sanitizeMotionPreset(raw) {
    const blank = buildBlankMotionPreset(typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Motion');
    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : blank.id,
        name: blank.name,
        transitionEnabled: typeof raw.transitionEnabled === 'boolean' ? raw.transitionEnabled : blank.transitionEnabled,
        transitionType: MOTION_ENGINE_TRANSITION_TYPES.includes(raw.transitionType) ? raw.transitionType : blank.transitionType, // core/motion-engine.js
        transitionDurationMs: (typeof raw.transitionDurationMs === 'number' && raw.transitionDurationMs >= MOTION_ENGINE_TRANSITION_MIN_TIME_MS && raw.transitionDurationMs <= MOTION_ENGINE_TRANSITION_MAX_TIME_MS) ? raw.transitionDurationMs : blank.transitionDurationMs, // core/motion-engine.js
        transitionInOutRatio: (typeof raw.transitionInOutRatio === 'number' && raw.transitionInOutRatio >= 0 && raw.transitionInOutRatio <= 100) ? raw.transitionInOutRatio : blank.transitionInOutRatio,
        transitionEasing: MOTION_ENGINE_TRANSITION_EASINGS.includes(raw.transitionEasing) ? raw.transitionEasing : blank.transitionEasing, // core/motion-engine.js
        kenBurnsEnabled: typeof raw.kenBurnsEnabled === 'boolean' ? raw.kenBurnsEnabled : blank.kenBurnsEnabled,
        kenBurnsMode: MOTION_ENGINE_KENBURNS_MODES.includes(raw.kenBurnsMode) ? raw.kenBurnsMode : blank.kenBurnsMode, // core/motion-engine.js
        reactBeatAudio: sanitizeMotionBeatReact(raw.reactBeatAudio, blank.reactBeatAudio),
    };
}

/** Validate riêng cụm `reactBeatAudio` — tách khỏi `sanitizeMotionPreset()` chính vì lồng nhau
 * (object trong object, 3 cụm con zoom/pan/rotate CÙNG hình dạng {enabled, everyNBeats, ...}) — gộp
 * chung sẽ rất khó đọc. `raw` không phải object hợp lệ -> trả nguyên `blank` (mặc định tắt hết,
 * không throw).
 * @param {*} raw
 * @param {object} blank - `buildBlankMotionPreset(...).reactBeatAudio`, dùng làm fallback từng field.
 * @returns {object}
 */
function sanitizeMotionBeatReact(raw, blank) {
    if (!raw || typeof raw !== 'object') return blank;
    const everyN = (v, fallback) => (typeof v === 'number' && v >= MOTION_BEAT_REACT_EVERY_N_BEATS_MIN && v <= MOTION_BEAT_REACT_EVERY_N_BEATS_MAX) ? v : fallback;
    const zoom = raw.zoom && typeof raw.zoom === 'object' ? raw.zoom : {};
    const pan = raw.pan && typeof raw.pan === 'object' ? raw.pan : {};
    const rotate = raw.rotate && typeof raw.rotate === 'object' ? raw.rotate : {};
    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : blank.enabled,
        replaceMovement: typeof raw.replaceMovement === 'boolean' ? raw.replaceMovement : blank.replaceMovement,
        zoom: {
            enabled: typeof zoom.enabled === 'boolean' ? zoom.enabled : blank.zoom.enabled,
            everyNBeats: everyN(zoom.everyNBeats, blank.zoom.everyNBeats),
            amountPct: (typeof zoom.amountPct === 'number' && zoom.amountPct >= 100 && zoom.amountPct <= 200) ? zoom.amountPct : blank.zoom.amountPct,
        },
        pan: {
            enabled: typeof pan.enabled === 'boolean' ? pan.enabled : blank.pan.enabled,
            everyNBeats: everyN(pan.everyNBeats, blank.pan.everyNBeats),
            direction: MOTION_BEAT_REACT_DIRECTIONS.includes(pan.direction) ? pan.direction : blank.pan.direction,
            amountPct: (typeof pan.amountPct === 'number' && pan.amountPct >= 100 && pan.amountPct <= 150) ? pan.amountPct : blank.pan.amountPct,
        },
        rotate: {
            enabled: typeof rotate.enabled === 'boolean' ? rotate.enabled : blank.rotate.enabled,
            everyNBeats: everyN(rotate.everyNBeats, blank.rotate.everyNBeats),
            direction: MOTION_BEAT_REACT_DIRECTIONS.includes(rotate.direction) ? rotate.direction : blank.rotate.direction,
            amountDeg: (typeof rotate.amountDeg === 'number' && rotate.amountDeg >= 0 && rotate.amountDeg <= 360) ? rotate.amountDeg : blank.rotate.amountDeg,
        },
    };
}
