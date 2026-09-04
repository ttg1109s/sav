/**
 * core/visual-bg-photo.js — Core thuần domain "Visual Background", phần RIÊNG cho Photo: áp DOM
 * nền ảnh tĩnh (#visual-bg-image). Phần chung (type/list/màu nền): xem core/visual-bg-common.js.
 * Điều phối ở event/workflow/visual-bg-photo.js; render/transition/Point Move của ảnh nền sống ở
 * event/workflow/motion-engine.js (Motion Engine).
 * NẠP SAU: core/visual-bg-common.js.
 */

/**
 * Rule 2: nhận `objectUrl` qua tham số, KHÔNG tự đọc state/DB. Chỉ `.hidden` (display:none) quyết
 * định hiện/ẩn, KHÔNG dùng `style.opacity` (Video Player mode cần "cưỡng chế hiện" lớp này tức
 * thời làm khung chớp thumb, xem core/video-player.js::forceShowVisualBgImageForVideoPlayer()).
 * @param {boolean} enabled
 * @param {string} objectUrl - '' hoặc URL không hợp lệ -> coi như ẩn.
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
