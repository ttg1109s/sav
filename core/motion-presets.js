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
 * LẬP nhau — bật được 1, vài, hay cả 3 cùng lúc (checkbox riêng từng cái), mỗi cái tự có 1 cặp
 * `min`/`max` RIÊNG — KHÔNG còn là 1 mốc "phóng cứng" duy nhất, mà là 2 biên NGƯỜI DÙNG tự chỉnh để
 * nội suy tuyến tính theo năng lượng nhạc (nhạc càng mạnh càng gần `max`, càng nhẹ/im lặng càng gần
 * `min`):
 *   zoom.minPct/maxPct     — % zoom (100 = không zoom), nội suy liên tục trong [100,200].
 *   pan.minPct/maxPct      — % dịch chuyển theo `direction` (left/right/leftToRight/rightToLeft —
 *                            2 cái sau LỆCH LIÊN TỤC giữa 2 biên theo năng lượng, 2 cái đầu chỉ lệch
 *                            1 hướng cố định), 100 = không dịch, nội suy liên tục trong [100,150].
 *   rotate.minDeg/maxDeg   — độ xoay theo `direction` (CÙNG 4 lựa chọn pan, "left"=ngược chiều kim
 *                            đồng hồ/"right"=thuận), 0 = không xoay, nội suy liên tục trong [0,360].
 * `max` (200/150/360 là trần) vốn là mốc DUY NHẤT trước đây người dùng chỉnh được — giờ vẫn là mốc
 * đó, chỉ thêm `min` làm biên dưới của phép nội suy.
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
            zoom: { enabled: false, minPct: 100, maxPct: 150 },
            pan: { enabled: false, direction: 'leftToRight', minPct: 100, maxPct: 120 },
            rotate: { enabled: false, direction: 'leftToRight', minDeg: 0, maxDeg: 90 },
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
 * (object trong object, 3 cụm con zoom/pan/rotate CÙNG hình dạng {enabled, min.../max...}) — gộp
 * chung sẽ rất khó đọc. `raw` không phải object hợp lệ -> trả nguyên `blank` (mặc định tắt hết,
 * không throw). VIẾT LẠI (30/08/2026, phản hồi Giang — bỏ hẳn `everyNBeats`, thêm cặp `min`/`max`
 * nội suy liên tục) — mỗi cặp validate ĐỘC LẬP trong đúng biên hợp lệ của field đó rồi kẹp `max` về
 * tối thiểu bằng `min` (`Math.max`) — phòng dữ liệu hỏng/cũ đảo ngược (min>max sẽ khiến phép nội suy
 * ở core/motion-engine.js chạy NGƯỢC, không sai về mặt kỹ thuật nhưng không phải ý người dùng).
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

    const zoomMinPct = inRange(zoom.minPct, 100, 200, blank.zoom.minPct);
    const panMinPct = inRange(pan.minPct, 100, 150, blank.pan.minPct);
    const rotateMinDeg = inRange(rotate.minDeg, 0, 360, blank.rotate.minDeg);

    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : blank.enabled,
        replaceMovement: typeof raw.replaceMovement === 'boolean' ? raw.replaceMovement : blank.replaceMovement,
        zoom: {
            enabled: typeof zoom.enabled === 'boolean' ? zoom.enabled : blank.zoom.enabled,
            minPct: zoomMinPct,
            maxPct: Math.max(zoomMinPct, inRange(zoom.maxPct, 100, 200, blank.zoom.maxPct)),
        },
        pan: {
            enabled: typeof pan.enabled === 'boolean' ? pan.enabled : blank.pan.enabled,
            direction: MOTION_BEAT_REACT_DIRECTIONS.includes(pan.direction) ? pan.direction : blank.pan.direction,
            minPct: panMinPct,
            maxPct: Math.max(panMinPct, inRange(pan.maxPct, 100, 150, blank.pan.maxPct)),
        },
        rotate: {
            enabled: typeof rotate.enabled === 'boolean' ? rotate.enabled : blank.rotate.enabled,
            direction: MOTION_BEAT_REACT_DIRECTIONS.includes(rotate.direction) ? rotate.direction : blank.rotate.direction,
            minDeg: rotateMinDeg,
            maxDeg: Math.max(rotateMinDeg, inRange(rotate.maxDeg, 0, 360, blank.rotate.maxDeg)),
        },
    };
}
