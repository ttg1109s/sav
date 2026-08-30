/**
 * core/slideshow-presets.js — Core THUẦN (Rule 1-5) cho hệ thống "Cấu hình Slideshow" lưu DB, MỚI
 * (29/08/2026, phản hồi Giang — "Settings > Slideshow" đổi từ 1 cấu hình DUY NHẤT nhúng thẳng trong
 * Visual Background config sang danh sách preset có thể đặt tên/thêm/xoá, CÙNG KHUÔN hệ preset EQ
 * đã có (core/eq-presets.js) — mirror 1-1 cấu trúc, chỉ đổi field cho khớp Slideshow).
 *
 * Preset = {id, name, transitionEnabled, transitionType, transitionDurationMs, transitionInOutRatio,
 * transitionEasing, kenBurnsEnabled, kenBurnsMode}. Danh sách preset SỐNG ở `appState.slideshowPresets`
 * (nạp lúc boot từ `meta.slideshowPresets`), xem event/workflow/slideshow-presets.js::
 * loadPresetsOnBoot(). Preset ĐANG GẮN vào Visual Background (Photo) là 1 field tham chiếu đơn giản
 * `appConfigVisualBg.slideshowPresetId` (null = chưa gắn preset nào — Photo hiện KHÔNG transition/
 * Ken Burns gì cả, chuyển cứng).
 *
 * KHÁC EQ (luôn có `flat` khoá sửa/xoá làm lưới an toàn) — Slideshow KHÔNG cần preset khoá nào: danh
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
 * xem event/workflow/slideshow.js::_tickBeatReact()). `enabled` bật cả cụm; `replaceMovement` quyết
 * định layer `.ss-beat-react` (MỚI, xem index.html/assets/css/slideshow.css) THAY THẾ hẳn chuyển
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
const SLIDESHOW_BEAT_REACT_DIRECTIONS = ['left', 'right', 'leftToRight', 'rightToLeft'];
const SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MIN = 1;
const SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MAX = 32;

/** 1 preset "trắng" — dùng làm giá trị khởi tạo lúc "Thêm cấu hình" (nút + ở header danh sách) —
 * CÙNG mặc định với `DEFAULT_VISUAL_BG_CONFIG.slideshow` cũ (trước khi tách preset), giữ trải
 * nghiệm "cấu hình mới" quen thuộc thay vì mọi field về 0/rỗng.
 * @param {string} name
 * @returns {object} */
function buildBlankSlideshowPreset(name) {
    return {
        id: generateSlideshowPresetId(),
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
function findSlideshowPresetById(presets, id) {
    return presets.find((p) => p.id === id) || null;
}

/** Id RIÊNG cho preset mới — cùng khuôn generateEqPresetId() (core/eq-presets.js).
 * @returns {string} */
function generateSlideshowPresetId() {
    return `slideshow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Validate 1 preset đọc từ DB (phòng dữ liệu hỏng/thiếu field — record cũ trước khi có field nào
 * đó) — trả bản đã làm sạch, KHÔNG throw. Dùng bởi `loadPresetsOnBoot()` (event/workflow/
 * slideshow-presets.js) cho TỪNG preset trong mảng đọc lên, và bởi migration (xem
 * event/workflow/visual-bg.js::loadPersistedSettingsOnBoot()) khi dựng preset ĐẦU TIÊN từ
 * `slideshow` nhúng cũ.
 * @param {object} raw
 * @returns {object}
 */
function sanitizeSlideshowPreset(raw) {
    const blank = buildBlankSlideshowPreset(typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Slideshow');
    return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : blank.id,
        name: blank.name,
        transitionEnabled: typeof raw.transitionEnabled === 'boolean' ? raw.transitionEnabled : blank.transitionEnabled,
        transitionType: SLIDESHOW_TRANSITION_TYPES.includes(raw.transitionType) ? raw.transitionType : blank.transitionType, // core/file-manager/slideshow.js
        transitionDurationMs: (typeof raw.transitionDurationMs === 'number' && raw.transitionDurationMs >= SLIDESHOW_TRANSITION_MIN_TIME_MS && raw.transitionDurationMs <= SLIDESHOW_TRANSITION_MAX_TIME_MS) ? raw.transitionDurationMs : blank.transitionDurationMs, // core/file-manager/slideshow.js
        transitionInOutRatio: (typeof raw.transitionInOutRatio === 'number' && raw.transitionInOutRatio >= 0 && raw.transitionInOutRatio <= 100) ? raw.transitionInOutRatio : blank.transitionInOutRatio,
        transitionEasing: SLIDESHOW_TRANSITION_EASINGS.includes(raw.transitionEasing) ? raw.transitionEasing : blank.transitionEasing, // core/file-manager/slideshow.js
        kenBurnsEnabled: typeof raw.kenBurnsEnabled === 'boolean' ? raw.kenBurnsEnabled : blank.kenBurnsEnabled,
        kenBurnsMode: SLIDESHOW_KENBURNS_MODES.includes(raw.kenBurnsMode) ? raw.kenBurnsMode : blank.kenBurnsMode, // core/file-manager/slideshow.js
        reactBeatAudio: sanitizeSlideshowBeatReact(raw.reactBeatAudio, blank.reactBeatAudio),
    };
}

/** Validate riêng cụm `reactBeatAudio` — tách khỏi `sanitizeSlideshowPreset()` chính vì lồng nhau
 * (object trong object, 3 cụm con zoom/pan/rotate CÙNG hình dạng {enabled, everyNBeats, ...}) — gộp
 * chung sẽ rất khó đọc. `raw` không phải object hợp lệ -> trả nguyên `blank` (mặc định tắt hết,
 * không throw).
 * @param {*} raw
 * @param {object} blank - `buildBlankSlideshowPreset(...).reactBeatAudio`, dùng làm fallback từng field.
 * @returns {object}
 */
function sanitizeSlideshowBeatReact(raw, blank) {
    if (!raw || typeof raw !== 'object') return blank;
    const everyN = (v, fallback) => (typeof v === 'number' && v >= SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MIN && v <= SLIDESHOW_BEAT_REACT_EVERY_N_BEATS_MAX) ? v : fallback;
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
            direction: SLIDESHOW_BEAT_REACT_DIRECTIONS.includes(pan.direction) ? pan.direction : blank.pan.direction,
            amountPct: (typeof pan.amountPct === 'number' && pan.amountPct >= 100 && pan.amountPct <= 150) ? pan.amountPct : blank.pan.amountPct,
        },
        rotate: {
            enabled: typeof rotate.enabled === 'boolean' ? rotate.enabled : blank.rotate.enabled,
            everyNBeats: everyN(rotate.everyNBeats, blank.rotate.everyNBeats),
            direction: SLIDESHOW_BEAT_REACT_DIRECTIONS.includes(rotate.direction) ? rotate.direction : blank.rotate.direction,
            amountDeg: (typeof rotate.amountDeg === 'number' && rotate.amountDeg >= 0 && rotate.amountDeg <= 360) ? rotate.amountDeg : blank.rotate.amountDeg,
        },
    };
}
