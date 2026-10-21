/**
 * core/visual-bg-photo.js — Core domain "Visual Background", phần RIÊNG cho Photo: thời lượng hiển thị 1 ảnh, tuyến hẹn
 * giờ (chuyển ảnh / lặp Point Move) và nền ảnh tĩnh #visual-bg-image. Phần chung: core/visual-bg-common.js. Điều phối:
 * event/workflow/visual-bg-photo.js; hiện ảnh/Transition/Point Move: event/workflow/visual-bg-photo-motion.js.
 * NẠP SAU: core/visual-bg-common.js, core/dom-refs.js.
 */

const VISUAL_BG_PHOTO_FALLBACK_SECONDS = 5; // record cũ thiếu `duration` — cùng mức sàn DURATION_MIN_SEC (core/file-manager/image.js)
const VISUAL_BG_PHOTO_MIN_MS = 1000;

/** Thời lượng tự nhiên của 1 ảnh (ms) — field `duration` của record (giây, tính lúc upload). @param {number|undefined} recordDurationSec
 * @returns {number} */
function computeVisualBgPhotoNaturalMs(recordDurationSec) {
    return Math.max(VISUAL_BG_PHOTO_MIN_MS, (recordDurationSec || VISUAL_BG_PHOTO_FALLBACK_SECONDS) * 1000);
}

/** Record ảnh còn dùng được (có blob). @param {object|null|undefined} record @returns {boolean} */
function isVisualBgPhotoRecordUsable(record) {
    return !!record && !!record.blob;
}

/**
 * Hẹn giờ của ảnh VBG lúc này: 'advance' = chuyển ảnh kế (cycle slideshow); 'replay' = chạy lại Point Move của ảnh đang
 * hiện mỗi thời lượng ảnh (1 nguồn / perSong — ảnh đứng yên như video tự lặp); 'off' = không hẹn (tắt, không phải Photo,
 * Song dừng, chưa có ảnh).
 * @param {{isMediaEnabled: boolean, isPhotoType: boolean, isSongActive: boolean, isCycling: boolean, hasPhoto: boolean}} s
 * @returns {'advance'|'replay'|'off'}
 */
function resolveVisualBgPhotoTickRoute(s) {
    if (!s.isMediaEnabled || !s.isPhotoType || !s.isSongActive) return 'off';
    if (s.isCycling) return 'advance';
    if (s.hasPhoto) return 'replay';
    return 'off';
}

/**
 * Nền ảnh tĩnh #visual-bg-image. Chỉ `.hidden` quyết định hiện/ẩn, không dùng `style.opacity` (Video Player mode cưỡng chế
 * hiện lớp này làm khung chớp thumb).
 * @param {boolean} enabled @param {string} objectUrl - '' -> ẩn
 */
function applyVisualBgImageToDOM(enabled, objectUrl) {
    if (!visualBgImageElement) return;
    if (enabled && objectUrl) {
        visualBgImageElement.style.backgroundImage = `url(${objectUrl})`;
        visualBgImageElement.classList.remove('hidden');
    } else {
        visualBgImageElement.classList.add('hidden');
    }
}
