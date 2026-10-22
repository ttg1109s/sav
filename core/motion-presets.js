/**
 * core/motion-presets.js — Core THUẦN cho "Cấu hình Motion" (preset lưu `meta.motionPresets`, sống ở `appState.motionPresets`,
 * khuôn preset EQ). Không đọc appState/DB, không gọi core khác: id mới, preset/point move trắng do Workflow
 * (event/workflow/motion-presets.js) tạo rồi truyền vào; mọi hàm biến đổi trả bản MỚI (không sửa tại chỗ). DOM:
 * core/motion-presets-ui.js.
 *
 * Preset = {id, name, transition* (bật/tắt độc lập, field chi tiết luôn chỉnh được), edgeFlipVariant, edgeFlipStaticOld,
 * pointMoves, pointMoveEnabled, pointMoveRunMode, pointMoveOneOrder, pointMoveEndForceBaseline, reactBeatAudio}. Nơi tiêu
 * thụ tự giữ id preset của mình (VBG Photo: `motionPresetId`; Player: `*PresetId`) — null = chưa gắn. Danh sách rỗng hợp lệ.
 *
 * Point Move — danh sách điểm do người dùng định nghĩa, mỗi điểm 6 field (linearX/Y, rotate, zoom, flipX/Y), mỗi field
 * {mode:'single'|'randomRange', unit, single, rangeMin, rangeMax}; 0 = không đổi. `pointMoveRunMode`:
 *   'all' — chạy mọi điểm đã tick theo `timingX` (% trên trục thời gian 0-100, nội suy tuyến tính giữa 2 điểm liền kề,
 *           event/workflow/motion-point-move-runner.js).
 *   'one' — mỗi lượt chỉ 1 điểm tween baseline -> target, chọn theo `pointMoveOneOrder` ('sequential' | 'random').
 * Point 0 (index 0) là start point: luôn `checked` + `timingX` = 0, không xoá/không đổi chỗ, 6 field vẫn sửa được.
 * `pointMoveEndForceBaseline` (chỉ với 'all'): chèn mốc ảo x=100=baseline cuối mỗi vòng — khi bật, điểm đứng đúng 100% bị
 * đẩy về 99.9 và biên kéo/nhập là 99.9 (resolvePointMoveTimingBounds()).
 * Biên: linear [-200,200] % / [-1000,1000] px, rotate [-360,360]°, zoom [-2,2] (cộng vào scale 1), flipX/Y [-360,360]°.
 *
 * `reactBeatAudio` — pulse theo năng lượng bass (`audioAnalysis.beatScale`), chạy song song Point Move, 4 hiệu ứng độc lập
 * (zoom/panX/panY/rotate), biên dưới cố định (100% / 0°), `max` người dùng chỉnh. `direction`: 'left'/'right' ('up'/'down'
 * cho panY) = dấu cố định; 'leftToRight'/'rightToLeft' ('upToDown'/'downToUp') = đảo dấu mỗi beat mới, `reverse` đảo lượt
 * đầu. `randomMax`: mỗi beat mới chọn ngẫu nhiên đỉnh trong [biên dưới, max] (event/workflow/motion-beat-react-runner.js).
 */
/** Hướng Zoom/Rotate/Pan X. */
const MOTION_BEAT_REACT_DIRECTIONS = ['left', 'right', 'leftToRight', 'rightToLeft'];
/** Hướng Pan Y (trục dọc). */
const MOTION_BEAT_REACT_DIRECTIONS_Y = ['up', 'down', 'upToDown', 'downToUp'];
/** Biên `maxPct` theo hiệu ứng React Beat (rotate dùng `maxDeg` 0-360). */
const MOTION_BEAT_REACT_MAX_PCT_BOUNDS = { zoom: { min: 100, max: 200 }, panX: { min: 100, max: 150 }, panY: { min: 100, max: 150 } };
const MOTION_BEAT_REACT_MAX_DEG_BOUNDS = { min: 0, max: 360 };

/** Chỉ với 'flipEdge' (`transitionIsEdgeFlip()`, core/motion-engine.js): "open" — ảnh cũ lật ra lộ ảnh mới đứng yên;
 * "close" — ảnh mới lật vào (`edgeFlipStaticOld`: ảnh cũ đứng yên hay cùng xoay). */
const MOTION_ENGINE_EDGE_FLIP_VARIANTS = ['open', 'close'];

/** 'slide'/'flipCard'/'flipEdge' (`transitionSupportsDirection()`) — 4 hướng thẳng, kèm 'random'. */
const MOTION_ENGINE_TRANSITION_DIRECTIONS = ['left', 'right', 'up', 'down'];
const MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_TRANSITION_DIRECTIONS, 'random'];

/** 'wipe' — 4 cạnh + 4 góc (co đồng thời 2 cạnh kề). */
const MOTION_ENGINE_WIPE_DIRECTIONS = [
    'left', 'right', 'up', 'down',
    'cornerTopLeft', 'cornerTopRight', 'cornerBottomLeft', 'cornerBottomRight',
];
const MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_WIPE_DIRECTIONS, 'random'];

/** 'curtain' — ngang/dọc/2 chéo qua tâm + 4 góc. */
const MOTION_ENGINE_CURTAIN_DIRECTIONS = [
    'horizontal', 'vertical', 'diagonalRight', 'diagonalLeft',
    'cornerTopLeft', 'cornerTopRight', 'cornerBottomLeft', 'cornerBottomRight',
];
const MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_CURTAIN_DIRECTIONS, 'random'];

/** 'fade'/'zoom'/'spin' (`transitionSupportsZoomDirection()`): "in" — ảnh mới hiện dần trên ảnh cũ đứng yên; "out" —
 * ảnh cũ mờ/nhỏ dần lộ ảnh mới đứng yên. */
const MOTION_ENGINE_ZOOM_DIRECTIONS = ['in', 'out'];
const MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_ZOOM_DIRECTIONS, 'random'];

/** Chỉ 'spin'. */
const MOTION_ENGINE_SPIN_DIRECTIONS = ['clockwise', 'counterclockwise'];
const MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM = [...MOTION_ENGINE_SPIN_DIRECTIONS, 'random'];

const MOTION_POINT_MOVE_LINEAR_UNITS = ['%', 'px'];
const MOTION_POINT_MOVE_FIELD_MODES = ['single', 'randomRange'];
const MOTION_POINT_MOVE_RUN_MODES = ['all', 'one'];
/** Chỉ có ý nghĩa khi `pointMoveRunMode === 'one'`. */
const MOTION_POINT_MOVE_ONE_ORDERS = ['sequential', 'random'];

/** Biên số học từng field/point move. */
const MOTION_POINT_MOVE_BOUNDS = {
    linearPct: { min: -200, max: 200 },
    linearPx: { min: -1000, max: 1000 },
    rotate: { min: -360, max: 360 },
    zoom: { min: -2, max: 2 },
    flip: { min: -360, max: 360 },
};
const MOTION_POINT_MOVE_TIMING_X_BOUNDS = { min: 0, max: 100 };
/** Vị trí điểm bị đẩy ra khỏi mốc x=100 khi bật `pointMoveEndForceBaseline`. */
const MOTION_POINT_MOVE_END_NUDGED_X = 99.9;
/** Điểm mới nối cuối: sau mốc muộn nhất bao nhiêu %. */
const MOTION_POINT_MOVE_APPEND_STEP_X = 0.2;
/** Tên dự phòng khi preset đọc từ DB không có tên hợp lệ. */
const MOTION_PRESET_FALLBACK_NAME = 'Motion';

/** Zoom màn Timing — "mức giãn thêm" trục thời gian (0 = không giãn, 100% -> scaleX 2), chỉ view. */
const POINT_MOVE_TIMING_ZOOM_STEPS_PCT = [0, 25, 50, 75, 100];
const POINT_MOVE_TIMING_ZOOM_MAX_EXTRA_SCALE_X = 1;

// ===================== Tạo mới =====================

/** @returns {string} */
function generatePointMoveId() {
    return `ptmove_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** @returns {string} */
function generateMotionPresetId() {
    return `motion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 1 field trắng; `unit` chỉ có ý nghĩa với linearX/linearY (null cho 4 field còn lại). @param {string|null} unit */
function buildBlankPointMoveField(unit) {
    return { mode: 'single', unit: unit || null, single: 0, rangeMin: 0, rangeMax: 0 };
}

/** 1 point move trắng (`checked` mặc định bật). @param {string} id - generatePointMoveId()
 * @param {object} linearField - buildBlankPointMoveField('%') @param {object} plainField - buildBlankPointMoveField(null) */
function buildBlankPointMove(id, linearField, plainField) {
    return {
        id,
        checked: true,
        timingX: 0,
        linearX: { ...linearField },
        linearY: { ...linearField },
        rotate: { ...plainField },
        zoom: { ...plainField },
        flipX: { ...plainField },
        flipY: { ...plainField },
    };
}

/** Preset trắng ("Thêm cấu hình", Reset, khuôn sanitize). @param {string} id - generateMotionPresetId()
 * @param {string} name @param {object} pointMove - buildBlankPointMove() (thành Point 0) */
function buildBlankMotionPreset(id, name, pointMove) {
    return {
        id,
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
        pointMoves: [pointMove],
        pointMoveEnabled: true,
        pointMoveRunMode: 'all',
        pointMoveOneOrder: 'sequential',
        pointMoveEndForceBaseline: false,
        reactBeatAudio: {
            enabled: false,
            zoom: { enabled: false, maxPct: 150, randomMax: false },
            panX: { enabled: false, direction: 'leftToRight', maxPct: 120, reverse: false, randomMax: false },
            panY: { enabled: false, direction: 'upToDown', maxPct: 120, reverse: false, randomMax: false },
            rotate: { enabled: false, direction: 'leftToRight', maxDeg: 90, reverse: false, randomMax: false },
        },
    };
}

/** Preset "tắt hết" — nơi tiêu thụ chưa gắn Motion (id null / preset đã xoá), không fallback về hiệu ứng nào. Không có `id`
 * (Point Move Runner coi như không thuộc preset nào — broadcast bỏ qua). */
const MOTION_ENGINE_NO_OP_PRESET = { transitionEnabled: false, transitionType: 'fade', transitionDurationMs: 1000, transitionInOutRatio: 50, transitionEasing: 'linear', pointMoves: [], pointMoveEnabled: false, pointMoveRunMode: 'all', pointMoveOneOrder: 'sequential', pointMoveEndForceBaseline: false, reactBeatAudio: { enabled: false, zoom: { enabled: false }, panX: { enabled: false }, panY: { enabled: false }, rotate: { enabled: false } } };

// ===================== Tra cứu =====================

/** @param {object[]} presets @param {string} id @returns {object|null} */
function findMotionPresetById(presets, id) {
    return presets.find((p) => p.id === id) || null;
}

/** @param {object[]} presets @param {string|null} id @returns {number} -1 nếu không có */
function findMotionPresetIndexById(presets, id) {
    return presets.findIndex((p) => p.id === id);
}

/** @param {object[]} pointMoves @param {string} id @returns {object|null} */
function findPointMoveById(pointMoves, id) {
    return pointMoves.find((p) => p.id === id) || null;
}

/** @param {object[]} pointMoves @param {string} id @returns {number} -1 nếu không có; 0 = Point 0 */
function findPointMoveIndexById(pointMoves, id) {
    return pointMoves.findIndex((p) => p.id === id);
}

/** Preset có thật sự chạy React Beat Audio không: tồn tại + `reactBeatAudio.enabled` + ít nhất 1 hiệu ứng con bật. Không tự
 * tra/fallback — nơi gọi tự quyết (dùng chung VBG + Player). @param {object|null} preset @returns {boolean} */
function isReactBeatPresetActive(preset) {
    if (!preset) return false;
    const rb = preset.reactBeatAudio;
    return !!(rb && rb.enabled && (rb.zoom.enabled || rb.panX.enabled || rb.panY.enabled || rb.rotate.enabled));
}

// ===================== Danh sách preset =====================

/** Số thứ tự cho tên preset mới ("Motion N"). @param {object[]} presets @returns {number} */
function computeNextMotionPresetOrdinal(presets) {
    return presets.length + 1;
}

/** @param {object[]} presets @param {object} preset @returns {object[]} danh sách MỚI */
function appendMotionPreset(presets, preset) {
    return [...presets, preset];
}

/** @param {object[]} presets @param {string} id @returns {object[]} danh sách MỚI */
function removeMotionPresetById(presets, id) {
    return presets.filter((p) => p.id !== id);
}

/** Ghi đè vài field của preset `id`. @param {object[]} presets @param {string} id @param {object} patch @returns {object[]} */
function replaceMotionPresetFields(presets, id, patch) {
    return presets.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

/** Rời ô Tên: tên đã trim; rỗng -> `isBlank` (giữ tên cũ). @param {string} draftName @returns {{isBlank: boolean, name: string}} */
function resolveMotionPresetRename(draftName) {
    const name = draftName.trim();
    return { isBlank: !name, name };
}

/** Field cấu hình để Reset preset về mặc định — mọi field của `blank` trừ id/name. @param {object} blank - buildBlankMotionPreset()
 * @returns {object} patch */
function buildMotionPresetResetFields(blank) {
    const { id, name, ...fields } = blank;
    return fields;
}

// ===================== Đọc từ DB =====================

/**
 * Làm sạch 1 preset đọc từ DB (dữ liệu hỏng/thiếu field) — không throw. Field thiếu/sai lấy từ `blank`; point move thiếu id
 * nhận `${id Point 0 của blank}_${vị trí}`; danh sách rỗng -> [Point 0 của blank]. Ép Point 0 `checked` + `timingX` 0, và
 * đẩy điểm ở đúng 100% về 99.9 khi bật `pointMoveEndForceBaseline`. Dữ liệu cũ chỉ có `reactBeatAudio.pan` -> thành `panX`.
 * @param {*} raw @param {object} blank - buildBlankMotionPreset(id mới, MOTION_PRESET_FALLBACK_NAME, point move trắng)
 * @returns {object}
 */
function sanitizeMotionPreset(raw, blank) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const blankPoint = blank.pointMoves[0];
    const isObject = (v) => !!v && typeof v === 'object';
    const inRange = (v, bounds, fallback) => (typeof v === 'number' && v >= bounds.min && v <= bounds.max ? v : fallback);
    const pickBool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
    const pickListed = (list, v, fallback) => (list.includes(v) ? v : fallback);
    const sanitizeField = (rawField, blankField, bounds) => ({
        mode: pickListed(MOTION_POINT_MOVE_FIELD_MODES, rawField.mode, blankField.mode),
        unit: null,
        single: inRange(rawField.single, bounds, blankField.single),
        rangeMin: inRange(rawField.rangeMin, bounds, blankField.rangeMin),
        rangeMax: inRange(rawField.rangeMax, bounds, blankField.rangeMax),
    });
    // linearX/Y: biên đổi theo đơn vị đang lưu.
    const sanitizeLinearField = (rawField, blankField) => {
        const unit = pickListed(MOTION_POINT_MOVE_LINEAR_UNITS, rawField.unit, blankField.unit);
        const bounds = unit === 'px' ? MOTION_POINT_MOVE_BOUNDS.linearPx : MOTION_POINT_MOVE_BOUNDS.linearPct;
        return { ...sanitizeField(rawField, blankField, bounds), unit };
    };
    const fieldOf = (p, key) => (isObject(p[key]) ? p[key] : {});
    const sanitizePoint = (rawPoint, index) => {
        const p = isObject(rawPoint) ? rawPoint : {};
        return {
            id: typeof p.id === 'string' && p.id ? p.id : `${blankPoint.id}_${index}`,
            checked: pickBool(p.checked, blankPoint.checked),
            timingX: inRange(p.timingX, MOTION_POINT_MOVE_TIMING_X_BOUNDS, blankPoint.timingX),
            linearX: sanitizeLinearField(fieldOf(p, 'linearX'), blankPoint.linearX),
            linearY: sanitizeLinearField(fieldOf(p, 'linearY'), blankPoint.linearY),
            rotate: sanitizeField(fieldOf(p, 'rotate'), blankPoint.rotate, MOTION_POINT_MOVE_BOUNDS.rotate),
            zoom: sanitizeField(fieldOf(p, 'zoom'), blankPoint.zoom, MOTION_POINT_MOVE_BOUNDS.zoom),
            flipX: sanitizeField(fieldOf(p, 'flipX'), blankPoint.flipX, MOTION_POINT_MOVE_BOUNDS.flip),
            flipY: sanitizeField(fieldOf(p, 'flipY'), blankPoint.flipY, MOTION_POINT_MOVE_BOUNDS.flip),
        };
    };

    const sanitizedPoints = Array.isArray(src.pointMoves) && src.pointMoves.length > 0 ? src.pointMoves.map(sanitizePoint) : [blankPoint];
    const startPoints = [{ ...sanitizedPoints[0], checked: true, timingX: 0 }, ...sanitizedPoints.slice(1)];
    const pointMoveEndForceBaseline = pickBool(src.pointMoveEndForceBaseline, blank.pointMoveEndForceBaseline);
    const pointMoves = pointMoveEndForceBaseline
        ? startPoints.map((pm) => (pm.timingX === 100 ? { ...pm, timingX: MOTION_POINT_MOVE_END_NUDGED_X } : pm))
        : startPoints;

    const blankRb = blank.reactBeatAudio;
    const rb = isObject(src.reactBeatAudio) ? src.reactBeatAudio : null;
    const rbPart = (key) => (rb && isObject(rb[key]) ? rb[key] : {});
    const legacyPan = rb && isObject(rb.pan) ? rb.pan : {}; // dữ liệu trước khi tách Pan X/Y
    const panX = rb && isObject(rb.panX) ? rb.panX : legacyPan;
    const [zoom, panY, rotate] = [rbPart('zoom'), rbPart('panY'), rbPart('rotate')];
    const reactBeatAudio = rb ? {
        enabled: pickBool(rb.enabled, blankRb.enabled),
        zoom: {
            enabled: pickBool(zoom.enabled, blankRb.zoom.enabled),
            maxPct: inRange(zoom.maxPct, MOTION_BEAT_REACT_MAX_PCT_BOUNDS.zoom, blankRb.zoom.maxPct),
            randomMax: pickBool(zoom.randomMax, blankRb.zoom.randomMax),
        },
        panX: {
            enabled: pickBool(panX.enabled, blankRb.panX.enabled),
            direction: pickListed(MOTION_BEAT_REACT_DIRECTIONS, panX.direction, blankRb.panX.direction),
            maxPct: inRange(panX.maxPct, MOTION_BEAT_REACT_MAX_PCT_BOUNDS.panX, blankRb.panX.maxPct),
            reverse: pickBool(panX.reverse, blankRb.panX.reverse),
            randomMax: pickBool(panX.randomMax, blankRb.panX.randomMax),
        },
        panY: {
            enabled: pickBool(panY.enabled, blankRb.panY.enabled),
            direction: pickListed(MOTION_BEAT_REACT_DIRECTIONS_Y, panY.direction, blankRb.panY.direction),
            maxPct: inRange(panY.maxPct, MOTION_BEAT_REACT_MAX_PCT_BOUNDS.panY, blankRb.panY.maxPct),
            reverse: pickBool(panY.reverse, blankRb.panY.reverse),
            randomMax: pickBool(panY.randomMax, blankRb.panY.randomMax),
        },
        rotate: {
            enabled: pickBool(rotate.enabled, blankRb.rotate.enabled),
            direction: pickListed(MOTION_BEAT_REACT_DIRECTIONS, rotate.direction, blankRb.rotate.direction),
            maxDeg: inRange(rotate.maxDeg, MOTION_BEAT_REACT_MAX_DEG_BOUNDS, blankRb.rotate.maxDeg),
            reverse: pickBool(rotate.reverse, blankRb.rotate.reverse),
            randomMax: pickBool(rotate.randomMax, blankRb.rotate.randomMax),
        },
    } : blankRb;

    const durationBounds = { min: MOTION_ENGINE_TRANSITION_MIN_TIME_MS, max: MOTION_ENGINE_TRANSITION_MAX_TIME_MS }; // core/motion-engine.js
    return {
        id: typeof src.id === 'string' && src.id ? src.id : blank.id,
        name: typeof src.name === 'string' && src.name.trim() ? src.name.trim() : blank.name,
        transitionEnabled: pickBool(src.transitionEnabled, blank.transitionEnabled),
        transitionType: pickListed(MOTION_ENGINE_TRANSITION_TYPES, src.transitionType, blank.transitionType), // core/motion-engine.js
        transitionDurationMs: inRange(src.transitionDurationMs, durationBounds, blank.transitionDurationMs),
        transitionInOutRatio: inRange(src.transitionInOutRatio, { min: 0, max: 100 }, blank.transitionInOutRatio),
        transitionEasing: pickListed(MOTION_ENGINE_TRANSITION_EASINGS, src.transitionEasing, blank.transitionEasing), // core/motion-engine.js
        transitionDirection: pickListed(MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM, src.transitionDirection, blank.transitionDirection),
        transitionZoomDirection: pickListed(MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM, src.transitionZoomDirection, blank.transitionZoomDirection),
        transitionSpinDirection: pickListed(MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM, src.transitionSpinDirection, blank.transitionSpinDirection),
        transitionWipeDirection: pickListed(MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM, src.transitionWipeDirection, blank.transitionWipeDirection),
        transitionCurtainDirection: pickListed(MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM, src.transitionCurtainDirection, blank.transitionCurtainDirection),
        edgeFlipVariant: pickListed(MOTION_ENGINE_EDGE_FLIP_VARIANTS, src.edgeFlipVariant, blank.edgeFlipVariant),
        edgeFlipStaticOld: pickBool(src.edgeFlipStaticOld, blank.edgeFlipStaticOld),
        pointMoves,
        pointMoveEnabled: pickBool(src.pointMoveEnabled, blank.pointMoveEnabled),
        pointMoveRunMode: pickListed(MOTION_POINT_MOVE_RUN_MODES, src.pointMoveRunMode, blank.pointMoveRunMode),
        pointMoveOneOrder: pickListed(MOTION_POINT_MOVE_ONE_ORDERS, src.pointMoveOneOrder, blank.pointMoveOneOrder),
        pointMoveEndForceBaseline,
        reactBeatAudio,
    };
}

/** Bản cũ (trước khi Motion tách khỏi VBG) lưu cấu hình ngay trong `meta.visualBgConfig.motion` và chưa có `motionPresetId`.
 * @param {*} visualBgRaw - `meta.visualBgConfig` thô @returns {boolean} */
function shouldMigrateLegacyVisualBgMotion(visualBgRaw) {
    return !!visualBgRaw && typeof visualBgRaw === 'object' && !!visualBgRaw.motion && typeof visualBgRaw.motion === 'object'
        && !('motionPresetId' in visualBgRaw);
}

/** Dữ liệu thô để sanitize thành preset từ `motion` cũ — bản cũ luôn bật Transition. @param {object} legacyMotion @param {string} name */
function buildLegacyMotionPresetRaw(legacyMotion, name) {
    return { ...legacyMotion, name, transitionEnabled: true };
}

/** `meta.visualBgConfig` sau di trú: bỏ `motion`, gắn `motionPresetId`. @param {object} visualBgRaw @param {string} presetId */
function buildMigratedVisualBgMeta(visualBgRaw, presetId) {
    const { motion, ...rest } = visualBgRaw;
    return { ...rest, motionPresetId: presetId };
}

// ===================== Transition =====================

/** Kẹp thời lượng chuyển cảnh về [MIN, MAX] của Motion Engine (300ms – 60s). @param {number} ms @returns {number} */
function clampMotionTransitionDurationMs(ms) {
    return Math.max(MOTION_ENGINE_TRANSITION_MIN_TIME_MS, Math.min(MOTION_ENGINE_TRANSITION_MAX_TIME_MS, ms)); // core/motion-engine.js
}

/** @param {number} ratioPercent @returns {number} 0-100 */
function clampMotionTransitionRatio(ratioPercent) {
    return Math.max(0, Math.min(100, ratioPercent));
}

// ===================== Point Move — danh sách =====================

/** Biên kéo/nhập `timingX` của preset: maxX hẹp về 99.9 khi bật `pointMoveEndForceBaseline` (mốc 100 do baseline chiếm).
 * Dùng chung thanh Timing + modal nhập số. @param {object} preset @returns {{minX: number, maxX: number}} */
function resolvePointMoveTimingBounds(preset) {
    return { minX: 0, maxX: preset.pointMoveEndForceBaseline ? MOTION_POINT_MOVE_END_NUDGED_X : 100 };
}

/** Mốc khởi điểm cho point move MỚI nối cuối: +0.2% sau mốc MUỘN NHẤT (không theo phần tử cuối mảng — thứ tự mảng không
 * khớp thứ tự thời gian sau khi kéo/nhập/đổi chỗ). @param {object[]} pointMoves @returns {number} */
function computeAppendedPointMoveTimingSeed(pointMoves) {
    const latest = pointMoves.length > 0 ? Math.max(...pointMoves.map((pm) => pm.timingX)) : 0;
    return latest + MOTION_POINT_MOVE_APPEND_STEP_X;
}

/** `timingX` chốt cho 1 point move: làm tròn 2 chữ số, kẹp [minX, maxX], rồi đẩy từng 0.01 (tăng trước, chạm maxX mới giảm)
 * nếu trùng mốc 1 point move KHÁC — 2 node không đứng đè nhau.
 * @param {object[]} pointMoves @param {string|null} excludeId - chính point move đang đặt (null = điểm mới chưa có trong list)
 * @param {number} rawX @param {{minX: number, maxX: number}} bounds - resolvePointMoveTimingBounds() @returns {number} */
function resolvePointMoveTimingX(pointMoves, excludeId, rawX, bounds) {
    const { minX, maxX } = bounds;
    const round2 = (v) => Math.round(v * 100) / 100;
    const taken = new Set(pointMoves.filter((pm) => pm.id !== excludeId).map((pm) => round2(pm.timingX)));
    let value = Math.max(minX, Math.min(maxX, round2(rawX)));
    while (taken.has(value) && value < maxX) value = round2(value + 0.01);
    while (taken.has(value) && value > minX) value = round2(value - 0.01);
    return value;
}

/** Bật/tắt "Return baseline": bật thì đẩy điểm ở đúng 100% về 99.9. @param {object[]} pointMoves @param {boolean} checked
 * @returns {{pointMoveEndForceBaseline: boolean, pointMoves: object[]}} patch */
function buildPointMoveEndForceBaselinePatch(pointMoves, checked) {
    return {
        pointMoveEndForceBaseline: checked,
        pointMoves: checked ? pointMoves.map((pm) => (pm.timingX === 100 ? { ...pm, timingX: MOTION_POINT_MOVE_END_NUDGED_X } : pm)) : pointMoves,
    };
}

/** Tick 1 point move — Point 0 / id lạ giữ nguyên. @param {object[]} pointMoves @param {string} id @param {boolean} checked */
function setPointMoveChecked(pointMoves, id, checked) {
    const idx = pointMoves.findIndex((pm) => pm.id === id);
    if (idx <= 0) return pointMoves;
    return pointMoves.map((pm, i) => (i === idx ? { ...pm, checked } : pm));
}

/** Đặt `timingX` đã chốt (resolvePointMoveTimingX()) cho 1 point move — Point 0 (khoá 0) / id lạ giữ nguyên.
 * @param {object[]} pointMoves @param {string} id @param {number} timingX */
function setPointMoveTimingX(pointMoves, id, timingX) {
    const idx = pointMoves.findIndex((pm) => pm.id === id);
    if (idx <= 0) return pointMoves;
    return pointMoves.map((pm, i) => (i === idx ? { ...pm, timingX } : pm));
}

/** Nối 1 point move vào cuối với `timingX` đã chốt. @param {object[]} pointMoves @param {object} pointMove @param {number} timingX */
function appendPointMove(pointMoves, pointMove, timingX) {
    return [...pointMoves, { ...pointMove, timingX }];
}

/** Bản sao 1 point move (copy sâu 6 field, id mới, luôn tick). @param {object} original @param {string} id - generatePointMoveId() */
function buildPointMoveCopy(original, id) {
    return {
        ...original,
        id,
        checked: true,
        linearX: { ...original.linearX }, linearY: { ...original.linearY },
        rotate: { ...original.rotate }, zoom: { ...original.zoom },
        flipX: { ...original.flipX }, flipY: { ...original.flipY },
    };
}

/** Hoán đổi TOÀN BỘ 2 point move (kể cả `timingX`) — Point 0 / id lạ / cùng id giữ nguyên. @returns {object[]} */
function swapPointMoves(pointMoves, idA, idB) {
    const idxA = pointMoves.findIndex((pm) => pm.id === idA);
    const idxB = pointMoves.findIndex((pm) => pm.id === idB);
    if (idxA <= 0 || idxB <= 0 || idxA === idxB) return pointMoves;
    const list = [...pointMoves];
    [list[idxA], list[idxB]] = [list[idxB], list[idxA]];
    return list;
}

/** Xoá 1 point move — luôn còn ít nhất 1, Point 0 không xoá được. @returns {object[]} */
function removePointMove(pointMoves, id) {
    if (pointMoves.length <= 1 || pointMoves.findIndex((pm) => pm.id === id) === 0) return pointMoves;
    return pointMoves.filter((pm) => pm.id !== id);
}

/** Ghi đè vài field (cấp point move) của point move `id`. @param {object[]} pointMoves @param {string} id @param {object} patch */
function replacePointMoveFields(pointMoves, id, patch) {
    return pointMoves.map((pm) => (pm.id === id ? { ...pm, ...patch } : pm));
}

/** Ghi đè vài khoá của 1 field (`linearX`…) của point move `id`. @param {object[]} pointMoves @param {string} id
 * @param {string} fieldKey @param {object} fieldPatch */
function replacePointMoveField(pointMoves, id, fieldKey, fieldPatch) {
    return pointMoves.map((pm) => (pm.id === id ? { ...pm, [fieldKey]: { ...pm[fieldKey], ...fieldPatch } } : pm));
}

/** 1 tay kéo dual-range đổi: tay kia bị đẩy theo khi vượt qua (min <= max luôn đúng).
 * @param {{rangeMin: number, rangeMax: number}} field @param {'min'|'max'} which @param {number} value
 * @returns {{rangeMin: number, rangeMax: number}} */
function buildPointMoveFieldRangePatch(field, which, value) {
    return {
        rangeMin: which === 'min' ? value : Math.min(field.rangeMin, value),
        rangeMax: which === 'max' ? value : Math.max(field.rangeMax, value),
    };
}

// ===================== Point Move — kéo-thả + Timing =====================

/** Phiên kéo-sắp-xếp: vị trí hàng đang kéo + hàng không nhận thả (chính nó, Point 0).
 * @param {string[]} rowIds - `data-ptmove-row` từng hàng @param {string} dragId @param {object[]} pointMoves
 * @returns {{dragIndex: number, blocked: boolean[]}} */
function planPointMoveDrag(rowIds, dragId, pointMoves) {
    const point0Id = pointMoves[0] ? pointMoves[0].id : null;
    return { dragIndex: rowIds.indexOf(dragId), blocked: rowIds.map((rowId) => rowId === dragId || rowId === point0Id) };
}

/** @param {number} startY @param {number} clientY @returns {string} CSS transform hàng đang kéo */
function computePointMoveDragTransform(startY, clientY) {
    return `translateY(${clientY - startY}px) scale(1.02)`;
}

/** Index hàng dưới `clientY` làm đích thả; hàng `blocked[i]` không nhận. -1 = không có.
 * @param {Array<{top:number,bottom:number}>} rects @param {number} clientY @param {boolean[]} blocked @returns {number} */
function findPointMoveDropRowIndex(rects, clientY, blocked) {
    return rects.findIndex((rect, i) => !blocked[i] && clientY >= rect.top && clientY <= rect.bottom);
}

/** Node trên thanh Timing: điểm đã tick trừ Point 0, sort theo `timingX`; `overrideId` dùng `overrideTimingX` (preview lúc
 * kéo, chưa lưu). `n` = index trong mảng gốc (khớp tên "Point move N").
 * @returns {Array<{id: string, timingX: number, locked: boolean, n: number}>} */
function computePointMoveTimingNodes(preset, overrideId, overrideTimingX) {
    return preset.pointMoves
        .map((p, n) => ({ id: p.id, timingX: p.id === overrideId ? overrideTimingX : p.timingX, locked: false, n, checked: p.checked }))
        .filter((p) => p.n !== 0 && p.checked)
        .map(({ id, timingX, locked, n }) => ({ id, timingX, locked, n }))
        .sort((a, b) => a.timingX - b.timingX);
}

/** Toạ độ cx của node theo `timingX` (hằng SVG ở core/point-move-timing-ui.js). @param {number} timingX @returns {number} */
function computePointMoveTimingNodeCx(timingX) {
    return POINT_MOVE_TIMING_PAD_X + (timingX / 100) * (POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X * 2);
}

/** Bước zoom màn Timing (+1/-1, kẹp trong bảng bậc): bậc mới + transform scaleX + nhãn.
 * @param {number} zoomIdx @param {number} delta @returns {{zoomIdx: number, transform: string, labelText: string}} */
function computePointMoveTimingZoomView(zoomIdx, delta) {
    const idx = Math.max(0, Math.min(POINT_MOVE_TIMING_ZOOM_STEPS_PCT.length - 1, zoomIdx + delta));
    const extraPct = POINT_MOVE_TIMING_ZOOM_STEPS_PCT[idx];
    return { zoomIdx: idx, transform: `scaleX(${1 + (extraPct / 100) * POINT_MOVE_TIMING_ZOOM_MAX_EXTRA_SCALE_X})`, labelText: `${extraPct}%` };
}

/** Dải tô màu giữa 2 tay kéo dual-range (% theo biên của slider). @param {HTMLInputElement} minInputEl
 * @param {HTMLInputElement} maxInputEl @returns {{left: string, width: string}} */
function computePointMoveRangeFill(minInputEl, maxInputEl) {
    const lo = Number(minInputEl.min);
    const hi = Number(minInputEl.max);
    const leftPct = ((Number(minInputEl.value) - lo) / (hi - lo)) * 100;
    const rightPct = ((Number(maxInputEl.value) - lo) / (hi - lo)) * 100;
    return { left: `${leftPct}%`, width: `${Math.max(0, rightPct - leftPct)}%` };
}

// ===================== Ô nhập số =====================

/** Kẹp giá trị gõ tay về [min, max] của chính ô (rỗng/không hợp lệ -> 0 rồi kẹp). @param {string|number} raw
 * @param {HTMLInputElement} inputEl @returns {number} */
function clampMotionNumberInput(raw, inputEl) {
    return Math.max(Number(inputEl.min), Math.min(Number(inputEl.max), Number(raw) || 0));
}

/** Giá trị đảo dấu của ô (nút "±" — bàn phím decimal iOS không có phím trừ). @param {HTMLInputElement} inputEl @returns {number} */
function negateMotionInputValue(inputEl) {
    return -(Number(inputEl.value) || 0);
}

// ===================== React Beat Audio =====================

/** Kiểm giá trị 1 field React Beat (Workflow chọn hàm theo `fieldKey`). Cùng chữ ký (effectKey, value). */
function isBeatReactToggleValue(effectKey, value) {
    return typeof value === 'boolean';
}

/** `maxPct`: Pan X/Y 100-150, Zoom 100-200. */
function isBeatReactMaxPctValue(effectKey, value) {
    const bounds = MOTION_BEAT_REACT_MAX_PCT_BOUNDS[effectKey] || MOTION_BEAT_REACT_MAX_PCT_BOUNDS.zoom;
    return typeof value === 'number' && value >= bounds.min && value <= bounds.max;
}

/** `maxDeg`: 0-360. */
function isBeatReactMaxDegValue(effectKey, value) {
    return typeof value === 'number' && value >= MOTION_BEAT_REACT_MAX_DEG_BOUNDS.min && value <= MOTION_BEAT_REACT_MAX_DEG_BOUNDS.max;
}

/** `direction`: Pan Y dùng bộ lên/xuống, còn lại trái/phải. */
function isBeatReactDirectionValue(effectKey, value) {
    const directions = effectKey === 'panY' ? MOTION_BEAT_REACT_DIRECTIONS_Y : MOTION_BEAT_REACT_DIRECTIONS;
    return directions.includes(value);
}

/** Ghi field cấp nhóm (`enabled`). @param {object} rb - preset.reactBeatAudio @returns {object} bản MỚI */
function setBeatReactTopField(rb, fieldKey, value) {
    return { ...rb, [fieldKey]: value };
}

/** Ghi field của 1 hiệu ứng con (zoom/panX/panY/rotate). @returns {object} bản MỚI */
function setBeatReactEffectField(rb, effectKey, fieldKey, value) {
    return { ...rb, [effectKey]: { ...rb[effectKey], [fieldKey]: value } };
}

// ===================== Random giá trị slider theo nhóm =====================
// Chỉ đổi CON SỐ của slider (không đụng bật/tắt, hướng, Reverse, Random Max, mode, đơn vị); random trong khoảng nhẹ đã biết
// là đẹp, bám đúng bước slider.

/** Khoảng random slider Max từng hiệu ứng React Beat — bước khớp slider (components/motion-settings-drawer.js). */
const MOTION_BEAT_REACT_RANDOM_RANGES = [
    { effectKey: 'zoom', fieldKey: 'maxPct', lo: 105, hi: 150, step: 5 },
    { effectKey: 'panX', fieldKey: 'maxPct', lo: 105, hi: 130, step: 5 },
    { effectKey: 'panY', fieldKey: 'maxPct', lo: 105, hi: 130, step: 5 },
    { effectKey: 'rotate', fieldKey: 'maxDeg', lo: 15, hi: 90, step: 15 },
];

/** Giá trị Max mới cho cả 4 slider React Beat. @param {() => number} [randomFn=Math.random]
 * @returns {Array<{effectKey:string, fieldKey:string, value:number}>} */
function buildRandomBeatReactMaxValues(randomFn) {
    const rnd = typeof randomFn === 'function' ? randomFn : Math.random;
    const pickStep = (lo, hi, step) => Math.round((lo + Math.floor(rnd() * (Math.round((hi - lo) / step) + 1)) * step) * 100) / 100;
    return MOTION_BEAT_REACT_RANDOM_RANGES.map((r) => ({ effectKey: r.effectKey, fieldKey: r.fieldKey, value: pickStep(r.lo, r.hi, r.step) }));
}

/** Áp các giá trị Max vừa random vào `reactBeatAudio` + chuỗi tóm tắt cho log.
 * @param {object} rb @param {ReturnType<typeof buildRandomBeatReactMaxValues>} values
 * @returns {{reactBeatAudio: object, summary: string}} */
function applyBeatReactMaxValues(rb, values) {
    const next = { ...rb };
    values.forEach(({ effectKey, fieldKey, value }) => { next[effectKey] = { ...next[effectKey], [fieldKey]: value }; });
    return { reactBeatAudio: next, summary: values.map((v) => `${v.effectKey}=${v.value}`).join(', ') };
}

/** Giá trị mới cho 6 field của 1 point move, giữ `mode` + `unit`: field 'single' đổi `single`, 'randomRange' đổi cặp
 * `rangeMin <= rangeMax`. Kiểu Ken Burns không lộ mép: zoom 0.05–0.35, lia X/Y trong biên an toàn theo mức zoom lớn nhất
 * (80% phần dư mỗi bên, làm tròn về phía 0 theo bước slider; px quy đổi xấp xỉ khung 400px); xoay ±15°, lật ±20°.
 * @param {object} pointMove @param {() => number} [randomFn=Math.random]
 * @returns {{linearX:object, linearY:object, rotate:object, zoom:object, flipX:object, flipY:object}} field MỚI */
function buildRandomPointMoveFieldValues(pointMove, randomFn) {
    const rnd = typeof randomFn === 'function' ? randomFn : Math.random;
    // Làm tròn 2 chữ số khử sai số dấu phẩy động (bước 0.05).
    const pickStep = (lo, hi, step) => Math.round((lo + Math.floor(rnd() * (Math.round((hi - lo) / step) + 1)) * step) * 100) / 100;
    // Luôn ghi đủ single/rangeMin/rangeMax — chỉ khoá đúng mode nhận số mới, khoá còn lại giữ giá trị cũ.
    const fillField = (field, lo, hi, step) => {
        const isRange = field.mode === 'randomRange';
        const single = pickStep(lo, hi, step);
        const a = pickStep(lo, hi, step);
        const b = pickStep(lo, hi, step);
        return {
            ...field,
            single: isRange ? field.single : single,
            rangeMin: isRange ? Math.min(a, b) : field.rangeMin,
            rangeMax: isRange ? Math.max(a, b) : field.rangeMax,
        };
    };
    const zoom = fillField(pointMove.zoom, 0.05, 0.35, 0.05);
    const maxZoom = zoom.mode === 'randomRange' ? zoom.rangeMax : zoom.single;
    const safePct = (maxZoom * 100) / 2 * 0.8; // phần dư mỗi bên (% bề rộng) khi scale = 1 + zoom
    const fillLinear = (field) => {
        const isPx = field.unit === 'px';
        const step = isPx ? 10 : 5;
        const limit = Math.floor((isPx ? safePct * 4 : safePct) / step) * step; // về phía 0, bội của step
        return fillField(field, -limit, limit, step);
    };
    return {
        linearX: fillLinear(pointMove.linearX),
        linearY: fillLinear(pointMove.linearY),
        rotate: fillField(pointMove.rotate, -15, 15, 5),
        zoom,
        flipX: fillField(pointMove.flipX, -20, 20, 5),
        flipY: fillField(pointMove.flipY, -20, 20, 5),
    };
}
