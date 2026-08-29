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
 */

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
    };
}
