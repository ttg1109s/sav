/**
 * core/media-element-ui.js — thao tác thi hành trên phần tử media (audioPlayer, bgVideoElement) nhận qua tham số: gán
 * nguồn, tua về vị trí cũ, phát, dừng. Không đọc appState, không gọi core khác, không gắn sự kiện.
 * NẠP SAU: không phụ thuộc gì.
 */

/** @param {HTMLMediaElement} mediaEl @param {string} url */
function setMediaElementSource(mediaEl, url) {
    mediaEl.src = url;
}

/** Tua tới `sec` (không kẹp). @param {HTMLMediaElement} mediaEl @param {number} sec */
function seekMediaElement(mediaEl, sec) {
    mediaEl.currentTime = sec;
}

/** Tua về `sec`, kẹp theo thời lượng nếu đã biết (file mới có thể ngắn hơn). @param {HTMLMediaElement} mediaEl @param {number} sec */
function seekMediaElementClamped(mediaEl, sec) {
    mediaEl.currentTime = Math.min(sec, mediaEl.duration || sec);
}

/** Phát; lỗi (vd bị chặn autoplay) chỉ ghi console. @param {HTMLMediaElement} mediaEl @param {string} logTag */
function playMediaElement(mediaEl, logTag) {
    mediaEl.play().catch((err) => console.error(`${logTag} play() lỗi:`, err));
}

/** Dừng nếu đang phát (đang dừng thì không bắn lại 'pause'). @param {HTMLMediaElement} mediaEl */
function pauseMediaElement(mediaEl) {
    if (!mediaEl.paused) mediaEl.pause();
}
