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
 * `reactBeatAudio` — MỚI (29/08/2026, phản hồi Giang); VIẾT LẠI HOÀN TOÀN (30/08/2026, phản hồi
 * Giang — "loại bỏ cơ chế beat trong motion, tự động theo nhạc giống beatscale visualizer effect")
 * — KHÔNG còn "bắn theo N beat rồi tự về gốc" (đã bỏ hẳn field `everyNBeats`) — giờ zoom/pan/rotate
 * LIÊN TỤC nội suy tuyến tính theo `appState.beatScale` (năng lượng tức thời, tính mỗi frame ở
 * event/workflow/visualizer-render.js — CÙNG tín hiệu mọi hiệu ứng "beatscale" khác trong app đang
 * dùng, xem event/workflow/motion-engine.js::_tickBeatReact()). `enabled` bật cả cụm;
 * `replaceMovement` quyết định layer `.me-beat-react` (MỚI, bao TRỌN cả 2 player A/B — xem
 * index.html/assets/css/motion-engine.css) THAY THẾ hẳn chuyển động Ken Burns thường (`true`) hay
 * chạy SONG SONG, transform cộng dồn theo cây DOM (`false`). 3 hiệu ứng con (zoom/pan/rotate) ĐỘC
 * LẬP nhau — bật được 1, vài, hay cả 3 cùng lúc (checkbox riêng từng cái), mỗi cái CHỈ còn 1 field
 * `max` NGƯỜI DÙNG tự chỉnh — biên DƯỚI (baseline lúc nhạc im lặng) CỐ ĐỊNH CỨNG, KHÔNG phải field
 * trong preset/KHÔNG có slider riêng (Giang chốt — "min là cố định cứng, không phải tuỳ chọn"),
 * hardcode ngay trong công thức nội suy (core/motion-engine.js::computeMotionEngineBeatReactZoomScale()/
 * computeMotionEngineBeatReactOffset()):
  *   zoom.maxPct     — % zoom (100 = không zoom, baseline CỐ ĐỊNH), nội suy liên tục [100,maxPct].
 *   pan.maxPct      — % dịch chuyển theo `direction`, 100 = không dịch (baseline CỐ ĐỊNH), nội suy
 *                     liên tục [100,maxPct] (biên độ — LUÔN không âm, xem `direction` dưới).
 *   rotate.maxDeg   — độ xoay theo `direction`, 0 = không xoay (baseline CỐ ĐỊNH), nội suy liên tục
 *                     [0,maxDeg] (biên độ).
 * `maxPct`/`maxDeg` (trần 200/150/360) vốn là mốc DUY NHẤT trước đây người dùng chỉnh được — vẫn
 * NGUYÊN như cũ, chỉ khác chỗ trước đây LÀ giá trị đích cố định (bắn tới rồi về), giờ là biên TRÊN
 * của phép nội suy liên tục.
 * `pan.direction`/`rotate.direction` — 4 lựa chọn (`MOTION_BEAT_REACT_DIRECTIONS`): "left"/"right" —
 * dấu CỐ ĐỊNH, biên độ luôn lệch 1 bên. "leftToRight"/"rightToLeft" — VIẾT LẠI (30/08/2026, phản hồi
 * Giang — checkbox "reverse") — KHÔNG còn quét liên tục theo năng lượng nữa, mà XEN KẼ dấu MỖI LƯỢT
 * "beat mới" (envelope attack lại sau 1 đợt decay, xem event/workflow/motion-engine.js::
 * _tickBeatReact()): lượt 1 lệch 1 bên, lượt 2 tự đảo sang bên kia, lượt 3 lại đảo về bên đầu, cứ
 * thế — "leftToRight" mặc định lượt 1 lệch PHẢI (dương), "rightToLeft" mặc định lượt 1 lệch TRÁI
 * (âm), xem `pan.reverse`/`rotate.reverse` MỚI ngay dưới.
 *   pan.reverse/rotate.reverse (boolean, MỚI) — CHỈ có tác dụng khi `direction` là "leftToRight"/
 *   "rightToLeft" — `true` ĐẢO cực lượt ĐẦU TIÊN (không đổi gì việc "cứ mỗi lượt lại xen kẽ" ở các
 *   lượt sau) — xem core/motion-engine.js::computeMotionEngineBeatReactNextPolarity().
 */
const MOTION_BEAT_REACT_DIRECTIONS = ['left', 'right', 'leftToRight', 'rightToLeft'];

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
            zoom: { enabled: false, maxPct: 150 },
            pan: { enabled: false, direction: 'leftToRight', maxPct: 120, reverse: false },
            rotate: { enabled: false, direction: 'leftToRight', maxDeg: 90, reverse: false },
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
 * (object trong object, 3 cụm con zoom/pan/rotate CÙNG hình dạng {enabled, max..., [direction]}) —
 * gộp chung sẽ rất khó đọc. `raw` không phải object hợp lệ -> trả nguyên `blank` (mặc định tắt hết,
 * không throw). VIẾT LẠI (30/08/2026, phản hồi Giang — bỏ hẳn `everyNBeats`; SỬA LẠI NGAY sau đó,
 * phản hồi Giang — "min là cố định cứng, không phải tuỳ chọn") — CHỈ còn `max` là field NGƯỜI DÙNG
 * chỉnh, biên dưới (baseline) CỐ ĐỊNH CỨNG trong công thức nội suy (core/motion-engine.js), KHÔNG
 * còn validate/lưu field `min` nào trong preset nữa.
 * @param {*} raw
 * @param {object} blank - `buildBlankMotionPreset(...).reactBeatAudio`, dùng làm fallback từng field.
 * @returns {object}
 */
function sanitizeMotionBeatReact(raw, blank) {
    if (!raw || typeof raw !== 'object') return blank;
    const inRange = (v, lo, hi, fallback) => (typeof v === 'number' && v >= lo && v <= hi) ? v : fallback;
    const zoom = raw.zoom && typeof raw.zoom === 'object' ? raw.zoom : {};
    const pan = raw.pan && typeof raw.pan === 'object' ? raw.pan : {};
    const rotate = raw.rotate && typeof raw.rotate === 'object' ? raw.rotate : {};

    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : blank.enabled,
        replaceMovement: typeof raw.replaceMovement === 'boolean' ? raw.replaceMovement : blank.replaceMovement,
        zoom: {
            enabled: typeof zoom.enabled === 'boolean' ? zoom.enabled : blank.zoom.enabled,
            maxPct: inRange(zoom.maxPct, 100, 200, blank.zoom.maxPct),
        },
        pan: {
            enabled: typeof pan.enabled === 'boolean' ? pan.enabled : blank.pan.enabled,
            direction: MOTION_BEAT_REACT_DIRECTIONS.includes(pan.direction) ? pan.direction : blank.pan.direction,
            maxPct: inRange(pan.maxPct, 100, 150, blank.pan.maxPct),
            reverse: typeof pan.reverse === 'boolean' ? pan.reverse : blank.pan.reverse,
        },
        rotate: {
            enabled: typeof rotate.enabled === 'boolean' ? rotate.enabled : blank.rotate.enabled,
            direction: MOTION_BEAT_REACT_DIRECTIONS.includes(rotate.direction) ? rotate.direction : blank.rotate.direction,
            maxDeg: inRange(rotate.maxDeg, 0, 360, blank.rotate.maxDeg),
            reverse: typeof rotate.reverse === 'boolean' ? rotate.reverse : blank.rotate.reverse,
        },
    };
}
