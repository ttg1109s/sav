/**
 * core/motion-presets.js — Core THUẦN (Rule 1-5) cho hệ thống "Cấu hình Motion" lưu DB — preset
 * đặt tên/thêm/xoá được, mirror hệ preset EQ (core/eq-presets.js).
 *
 * Preset = {id, name, transitionEnabled, transitionType, transitionDurationMs, transitionInOutRatio,
 * transitionEasing, transitionDirection, transitionZoomDirection, transitionSpinDirection,
 * transitionWipeDirection, transitionCurtainDirection, edgeFlipVariant, edgeFlipStaticOld,
 * pointMoves, pointMoveRunMode, pointMoveOneOrder, reactBeatAudio}. Danh sách preset SỐNG ở
 * `appState.motionPresets` (nạp lúc boot từ `meta.motionPresets`), xem event/workflow/
 * motion-presets.js::loadPresetsOnBoot(). Preset ĐANG GẮN vào Visual Background (Photo) là 1 field
 * tham chiếu đơn giản `appConfigVisualBg.motionPresetId` (null = chưa gắn preset nào).
 *
 * Danh sách rỗng vẫn hợp lệ (Photo VBG không gắn gì thì đơn giản không animate).
 *
 * `transitionEnabled` — công tắc ĐỘC LẬP quyết định preset có áp dụng Transition hay không — các
 * field chi tiết (`transitionType`...) LUÔN hiển thị/chỉnh được trong UI bất kể công tắc đang bật
 * hay tắt, chỉ CÓ ÁP DỤNG LÚC PHÁT hay không mới phụ thuộc công tắc này.
 *
 * VIẾT LẠI (phản hồi Giang — "xoá toàn bộ Ken Burns, thay bằng Point Move") — Ken Burns (1 chế độ
 * pan/zoom TỰ ĐỘNG chọn sẵn, không kiểm soát được biên độ/hướng cụ thể) XOÁ HẲN. Thay bằng
 * "Point Move" — danh sách điểm chuyển động NGƯỜI DÙNG tự định nghĩa, mỗi điểm có 6 thông số
 * (Linear X/Y, Rotate, Zoom, Flip X/Y) + `pointMoveEnabled` (công tắc tổng, CÙNG khuôn
 * `transitionEnabled` — chi tiết LUÔN hiển thị/chỉnh được bất kể bật/tắt, chỉ ẢNH HƯỞNG lúc phát)
 * + 2 chế độ chạy:
 *   `pointMoveRunMode: 'all'` — chạy TẤT CẢ point move đã tick, theo đúng vị trí thời gian
 *      (`pointMove.timingX`, % trên trục 0-100 của `advanceMs`) + cường độ (`pointMove.timingY`) đã
 *      xếp trên đường cong Timing (xem components/motion-settings-drawer.js, core/
 *      point-move-timing-ui.js). Cường độ và toạ độ THỜI GIAN là 2 trục ĐỘC LẬP (progress-domain
 *      thuần, KHÔNG biết gì về đơn vị thật của 6 field) — công thức áp dụng cuối cùng ở event/
 *      workflow/motion-engine.js::_buildPointMoveAllKeyframes(). Animation LUÔN xuất phát từ 1
 *      "vị trí ban đầu" ẩn (mốc trung tính CỐ ĐỊNH ở 0%, KHÔNG thuộc `pointMoves`, không chỉnh
 *      được) rồi mới tới point move gần nhất theo thời gian — point move #0 KHÔNG bắt buộc đứng ở
 *      0% (phản hồi Giang — có thể ở n% bất kỳ, tự do kéo/nhập số như mọi point move khác).
 *   `pointMoveRunMode: 'one'` — mỗi lượt kích hoạt Motion, CHỈ 1 point move (trong số đã tick)
 *      được chọn để tween từ baseline -> target trong suốt `advanceMs`, chọn theo
 *      `pointMoveOneOrder` ('sequential' — tăng dần theo vị trí trong mảng; 'random' — loại trừ
 *      lượt liền trước, cùng convention resolveMotionEngineTransitionOption()).
 * Point move VỊ TRÍ ĐẦU (index 0) LUÔN checked=true, KHÔNG bỏ tick được — ràng buộc theo VỊ TRÍ,
 * không theo id (xem sanitizeMotionPointMoves()). `timingX` của nó KHÔNG bị khoá.
 *
 * 6 field/point move — mỗi field {mode:'single'|'randomRange', unit, single, rangeMin, rangeMax}:
 * `mode==='single'` dùng thẳng `single`; `mode==='randomRange'` mỗi lượt resolve random đều trong
 * [rangeMin,rangeMax] (xem resolvePointMoveFieldValue(), core/motion-engine.js). Baseline (0) LUÔN
 * là "không đổi" cho MỌI field — 0 = không dịch/không xoay/không zoom/không lật.
 *   linearX/linearY — dịch chuyển, đơn vị `unit` ('%' hoặc 'px'), biên [-200,200] (%) / [-1000,1000] (px).
 *   rotate          — xoay 2D quanh tâm, độ, biên [-360,360].
 *   zoom            — scale cộng thêm vào 1 (0 = scale 1, không zoom), biên [-2,2].
 *   flipX/flipY     — lật 3D (rotateY/rotateX tương ứng, phối cảnh CSS `.motion-layer` có sẵn),
 *                     độ, biên [-360,360] (CÙNG Rotate — Giang chốt "flip theo rotate").
 *
 * `reactBeatAudio` — pulse zoom/pan/rotate LIÊN TỤC theo `appState.beatScale` (năng lượng bass tức
 * thời, cùng tín hiệu mọi hiệu ứng "beatscale" khác). `replaceMovement` ĐÃ XOÁ (phản hồi Giang —
 * hết ý nghĩa từ khi Ken Burns không còn tồn tại để "thay thế") — giờ LUÔN chạy song song với
 * Point Move, transform cộng dồn theo cây DOM. 3 hiệu ứng con (zoom/pan/rotate) ĐỘC LẬP nhau, mỗi
 * cái CHỈ có field `max` NGƯỜI DÙNG chỉnh — biên DƯỚI (baseline) CỐ ĐỊNH CỨNG trong công thức nội
 * suy (core/motion-engine.js::computeMotionEngineBeatReactZoomScale()/...Offset()):
 *   zoom.maxPct  — % zoom (100 = không zoom), nội suy liên tục [100,maxPct].
 *   pan.maxPct   — % dịch chuyển theo `direction`, nội suy liên tục [100,maxPct].
 *   rotate.maxDeg — độ xoay theo `direction`, nội suy liên tục [0,maxDeg].
 * `pan.direction`/`rotate.direction` (MOTION_BEAT_REACT_DIRECTIONS) — "left"/"right": dấu CỐ ĐỊNH.
 * "leftToRight"/"rightToLeft": XEN KẼ dấu mỗi lượt "beat mới" (envelope attack lại sau decay, xem
 * event/workflow/motion-engine.js::_tickBeatReact()); "leftToRight" mặc định lượt 1 lệch PHẢI,
 * "rightToLeft" mặc định lệch TRÁI — `reverse` (boolean) đảo cực lượt ĐẦU TIÊN.
 */
const MOTION_BEAT_REACT_DIRECTIONS = ['left', 'right', 'leftToRight', 'rightToLeft'];

/** CHỈ áp dụng khi `transitionType` là 'flipEdge' (`transitionIsEdgeFlip()`, core/motion-engine.js).
 * "open" — ảnh CŨ lật RA để lộ ảnh MỚI đứng YÊN bên dưới. "close" — ảnh MỚI lật VÀO; có thêm
 * `edgeFlipStaticOld` quyết định ảnh CŨ đứng yên hay cùng xoay. */
const MOTION_ENGINE_EDGE_FLIP_VARIANTS = ['open', 'close'];

/** CHỈ áp dụng khi `transitionType` là 'slide'/'flipCard'/'flipEdge' (`transitionSupportsDirection()`,
 * core/motion-engine.js) — 4 hướng thẳng, dùng làm "nguồn random" khi field = 'random'. */
const MOTION_ENGINE_TRANSITION_DIRECTIONS = ['left', 'right', 'up', 'down'];
const MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_TRANSITION_DIRECTIONS, 'random'];

/** Field RIÊNG cho 'wipe' (`transitionSupportsWipeDirection()`, core/motion-engine.js) — 4 cạnh +
 * 4 góc (co dần ĐỒNG THỜI 2 cạnh kề, neo cố định 2 cạnh còn lại). */
const MOTION_ENGINE_WIPE_DIRECTIONS = [
    'left', 'right', 'up', 'down',
    'cornerTopLeft', 'cornerTopRight', 'cornerBottomLeft', 'cornerBottomRight',
];
const MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_WIPE_DIRECTIONS, 'random'];

/** Field RIÊNG cho 'curtain' (`transitionSupportsCurtainDirection()`, core/motion-engine.js) —
 * ngang/dọc/2 chéo qua tâm + 4 góc (cùng cơ chế polygon "kite" như wipe). */
const MOTION_ENGINE_CURTAIN_DIRECTIONS = [
    'horizontal', 'vertical', 'diagonalRight', 'diagonalLeft',
    'cornerTopLeft', 'cornerTopRight', 'cornerBottomLeft', 'cornerBottomRight',
];
const MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_CURTAIN_DIRECTIONS, 'random'];

/** CHỈ áp dụng khi `transitionType` là 'fade'/'zoom'/'spin' (`transitionSupportsZoomDirection()`,
 * core/motion-engine.js). "in" — ảnh MỚI animate lớn/hiện dần TRÊN ảnh CŨ đứng yên. "out" — NGƯỢC
 * LẠI, ảnh CŨ animate nhỏ/mờ dần để lộ ảnh MỚI đứng yên (z-index đảo ngược quy ước chung). */
const MOTION_ENGINE_ZOOM_DIRECTIONS = ['in', 'out'];
const MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_ZOOM_DIRECTIONS, 'random'];

/** CHỈ áp dụng khi `transitionType` là 'spin' (`transitionSupportsSpinDirection()`, core/motion-engine.js). */
const MOTION_ENGINE_SPIN_DIRECTIONS = ['clockwise', 'counterclockwise'];
const MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_SPIN_DIRECTIONS, 'random'];

/** Đơn vị hợp lệ cho `linearX`/`linearY`. */
const MOTION_POINT_MOVE_LINEAR_UNITS = ['%', 'px'];
/** Chế độ giá trị hợp lệ cho MỌI field/point move. */
const MOTION_POINT_MOVE_FIELD_MODES = ['single', 'randomRange'];
/** Chế độ chạy hợp lệ cho `pointMoveRunMode`. */
const MOTION_POINT_MOVE_RUN_MODES = ['all', 'one'];
/** Thứ tự chọn hợp lệ cho `pointMoveOneOrder` (CHỈ có ý nghĩa khi `pointMoveRunMode==='one'`). */
const MOTION_POINT_MOVE_ONE_ORDERS = ['sequential', 'random'];

/** Biên số học từng field/point move — đơn vị THẬT tương ứng ghi ở docstring đầu file. */
const MOTION_POINT_MOVE_BOUNDS = {
    linearPct: { min: -200, max: 200 },
    linearPx: { min: -1000, max: 1000 },
    rotate: { min: -360, max: 360 },
    zoom: { min: -2, max: 2 },
    flip: { min: -360, max: 360 },
};
/** Biên toạ độ Timing (chỉ dùng khi `pointMoveRunMode==='all'`) — `timingX` % trên trục thời gian,
 * `timingY` cường độ (100 = đạt ĐỦ giá trị 6 field đã cấu hình của point move đó; 0 = baseline,
 * cho phép âm/vượt 100 để undershoot/overshoot — xem event/workflow/motion-engine.js). */
const MOTION_POINT_MOVE_TIMING_X_BOUNDS = { min: 0, max: 100 };
const MOTION_POINT_MOVE_TIMING_Y_BOUNDS = { min: -150, max: 150 };

/** 1 field trắng ({mode, unit, single, rangeMin, rangeMax}) — dùng cho cả 6 thông số/point move,
 * `unit` chỉ có ý nghĩa với linearX/linearY (null cho 4 field còn lại).
 * @param {string|null} unit @returns {object} */
function buildBlankPointMoveField(unit) {
    return { mode: 'single', unit: unit || null, single: 0, rangeMin: 0, rangeMax: 0 };
}

/** 1 point move trắng — `checked:true` mặc định (point move ĐẦU danh sách khoá true vĩnh viễn theo
 * VỊ TRÍ, xem sanitizeMotionPointMoves()); `timingY:100` mặc định = "đạt đủ giá trị đã cấu hình"
 * khi vừa thêm (chưa tuỳ chỉnh đường cong Timing thì hành vi vẫn đúng như mong đợi).
 * @returns {object} */
function buildBlankPointMove() {
    return {
        id: generatePointMoveId(),
        checked: true,
        timingX: 0,
        timingY: 100,
        linearX: buildBlankPointMoveField('%'),
        linearY: buildBlankPointMoveField('%'),
        rotate: buildBlankPointMoveField(null),
        zoom: buildBlankPointMoveField(null),
        flipX: buildBlankPointMoveField(null),
        flipY: buildBlankPointMoveField(null),
    };
}

/** @returns {string} */
function generatePointMoveId() {
    return `ptmove_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 1 preset "trắng" — dùng làm giá trị khởi tạo lúc "Thêm cấu hình".
 * @param {string} name @returns {object} */
function buildBlankMotionPreset(name) {
    return {
        id: generateMotionPresetId(),
        name,
        transitionEnabled: true,
        transitionType: 'fade',
        transitionDurationMs: 1000,
        transitionInOutRatio: 50,
        transitionEasing: 'ease',
        transitionDirection: 'left',
        transitionZoomDirection: 'in',
        transitionSpinDirection: 'counterclockwise',
        transitionWipeDirection: 'left',
        transitionCurtainDirection: 'horizontal',
        edgeFlipVariant: 'open',
        edgeFlipStaticOld: false,
        pointMoves: [buildBlankPointMove()],
        pointMoveEnabled: true,
        pointMoveRunMode: 'all',
        pointMoveOneOrder: 'sequential',
        reactBeatAudio: {
            enabled: false,
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

/** @param {object[]} pointMoves @param {string} id @returns {object|null} */
function findPointMoveById(pointMoves, id) {
    return pointMoves.find((p) => p.id === id) || null;
}

/** @returns {string} */
function generateMotionPresetId() {
    return `motion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate 1 preset đọc từ DB (phòng dữ liệu hỏng/thiếu field) — trả bản đã làm sạch, KHÔNG throw.
 * Dùng bởi `loadPresetsOnBoot()` cho TỪNG preset đọc lên.
 * @param {object} raw @returns {object} */
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
        transitionDirection: MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM.includes(raw.transitionDirection) ? raw.transitionDirection : blank.transitionDirection,
        transitionZoomDirection: MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM.includes(raw.transitionZoomDirection) ? raw.transitionZoomDirection : blank.transitionZoomDirection,
        transitionSpinDirection: MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM.includes(raw.transitionSpinDirection) ? raw.transitionSpinDirection : blank.transitionSpinDirection,
        transitionWipeDirection: MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM.includes(raw.transitionWipeDirection) ? raw.transitionWipeDirection : blank.transitionWipeDirection,
        transitionCurtainDirection: MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM.includes(raw.transitionCurtainDirection) ? raw.transitionCurtainDirection : blank.transitionCurtainDirection,
        edgeFlipVariant: MOTION_ENGINE_EDGE_FLIP_VARIANTS.includes(raw.edgeFlipVariant) ? raw.edgeFlipVariant : blank.edgeFlipVariant,
        edgeFlipStaticOld: typeof raw.edgeFlipStaticOld === 'boolean' ? raw.edgeFlipStaticOld : blank.edgeFlipStaticOld,
        pointMoves: sanitizeMotionPointMoves(raw.pointMoves),
        pointMoveEnabled: typeof raw.pointMoveEnabled === 'boolean' ? raw.pointMoveEnabled : blank.pointMoveEnabled,
        pointMoveRunMode: MOTION_POINT_MOVE_RUN_MODES.includes(raw.pointMoveRunMode) ? raw.pointMoveRunMode : blank.pointMoveRunMode,
        pointMoveOneOrder: MOTION_POINT_MOVE_ONE_ORDERS.includes(raw.pointMoveOneOrder) ? raw.pointMoveOneOrder : blank.pointMoveOneOrder,
        reactBeatAudio: sanitizeMotionBeatReact(raw.reactBeatAudio, blank.reactBeatAudio),
    };
}

/** Validate danh sách `pointMoves` — LUÔN trả về ÍT NHẤT 1 phần tử ("luôn có point move = 0",
 * phản hồi Giang), và ÉP CỨNG phần tử VỊ TRÍ ĐẦU (index 0) `checked:true` — ràng buộc theo VỊ TRÍ
 * trong mảng (không theo `id`), nên vẫn đúng kể cả sau khi thêm/xoá làm đổi thứ tự. `timingX` của
 * điểm này KHÔNG bị khoá (phản hồi Giang — "không nhất định phải ở gốc 0%") — nó là 1 node kéo tự
 * do như mọi point move khác; "vị trí ban đầu" (mốc trung tính LUÔN cố định ở 0%, animation xuất
 * phát từ đó) là 1 khái niệm TÁCH RIÊNG khỏi point move #0, xem event/workflow/motion-engine.js::
 * _buildPointMoveAllKeyframes() (implicit baseline node, không thuộc `pointMoves`).
 * @param {*} raw @returns {object[]} */
function sanitizeMotionPointMoves(raw) {
    const list = Array.isArray(raw) && raw.length > 0 ? raw.map((p) => sanitizePointMove(p)) : [buildBlankPointMove()];
    list[0].checked = true;
    return list;
}

/** Validate 1 point move — trả bản đã làm sạch, KHÔNG throw.
 * @param {*} raw @returns {object} */
function sanitizePointMove(raw) {
    const blank = buildBlankPointMove();
    if (!raw || typeof raw !== 'object') return blank;
    const inRange = (v, bounds, fallback) => (typeof v === 'number' && v >= bounds.min && v <= bounds.max) ? v : fallback;
    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : blank.id,
        checked: typeof raw.checked === 'boolean' ? raw.checked : blank.checked,
        timingX: inRange(raw.timingX, MOTION_POINT_MOVE_TIMING_X_BOUNDS, blank.timingX),
        timingY: inRange(raw.timingY, MOTION_POINT_MOVE_TIMING_Y_BOUNDS, blank.timingY),
        linearX: sanitizePointMoveLinearField(raw.linearX, blank.linearX),
        linearY: sanitizePointMoveLinearField(raw.linearY, blank.linearY),
        rotate: sanitizePointMoveField(raw.rotate, blank.rotate, MOTION_POINT_MOVE_BOUNDS.rotate),
        zoom: sanitizePointMoveField(raw.zoom, blank.zoom, MOTION_POINT_MOVE_BOUNDS.zoom),
        flipX: sanitizePointMoveField(raw.flipX, blank.flipX, MOTION_POINT_MOVE_BOUNDS.flip),
        flipY: sanitizePointMoveField(raw.flipY, blank.flipY, MOTION_POINT_MOVE_BOUNDS.flip),
    };
}

/** Validate 1 field {mode,unit,single,rangeMin,rangeMax} KHÔNG có unit (rotate/zoom/flipX/flipY) —
 * biên số học CỐ ĐỊNH truyền thẳng qua `bounds` (mỗi field 1 loại biên riêng, tra ở nơi gọi).
 * @param {*} raw @param {object} blank @param {{min:number,max:number}} bounds @returns {object} */
function sanitizePointMoveField(raw, blank, bounds) {
    if (!raw || typeof raw !== 'object') return blank;
    const inRange = (v, fallback) => (typeof v === 'number' && v >= bounds.min && v <= bounds.max) ? v : fallback;
    return {
        mode: MOTION_POINT_MOVE_FIELD_MODES.includes(raw.mode) ? raw.mode : blank.mode,
        unit: null,
        single: inRange(raw.single, blank.single),
        rangeMin: inRange(raw.rangeMin, blank.rangeMin),
        rangeMax: inRange(raw.rangeMax, blank.rangeMax),
    };
}

/** Validate riêng field linearX/linearY — CÓ unit ('%'/'px'), biên số học ĐỔI theo unit đang lưu
 * (tách khỏi `sanitizePointMoveField()` — 2 TIẾN TRÌNH khác nhau thật sự, không phải guard clause).
 * @param {*} raw @param {object} blank @returns {object} */
function sanitizePointMoveLinearField(raw, blank) {
    if (!raw || typeof raw !== 'object') return blank;
    const unit = MOTION_POINT_MOVE_LINEAR_UNITS.includes(raw.unit) ? raw.unit : blank.unit;
    const bounds = unit === 'px' ? MOTION_POINT_MOVE_BOUNDS.linearPx : MOTION_POINT_MOVE_BOUNDS.linearPct;
    const inRange = (v, fallback) => (typeof v === 'number' && v >= bounds.min && v <= bounds.max) ? v : fallback;
    return {
        mode: MOTION_POINT_MOVE_FIELD_MODES.includes(raw.mode) ? raw.mode : blank.mode,
        unit,
        single: inRange(raw.single, blank.single),
        rangeMin: inRange(raw.rangeMin, blank.rangeMin),
        rangeMax: inRange(raw.rangeMax, blank.rangeMax),
    };
}

/** Validate riêng cụm `reactBeatAudio` — `raw` không hợp lệ -> trả nguyên `blank`. `replaceMovement`
 * ĐÃ XOÁ (xem docstring đầu file) — KHÔNG còn field này trong shape trả về.
 * @param {*} raw @param {object} blank @returns {object} */
function sanitizeMotionBeatReact(raw, blank) {
    if (!raw || typeof raw !== 'object') return blank;
    const inRange = (v, lo, hi, fallback) => (typeof v === 'number' && v >= lo && v <= hi) ? v : fallback;
    const zoom = raw.zoom && typeof raw.zoom === 'object' ? raw.zoom : {};
    const pan = raw.pan && typeof raw.pan === 'object' ? raw.pan : {};
    const rotate = raw.rotate && typeof raw.rotate === 'object' ? raw.rotate : {};

    return {
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : blank.enabled,
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
