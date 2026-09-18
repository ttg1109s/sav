/**
 * core/hud.js — Core thuần (Rule 1-5) cho các panel HUD nổi kiểu popup hệ thống iOS (Volume, Speed)
 * ở components/visualizer-overlay.js. Mở/đóng/auto-hide/routing: event/workflow/hud.js.
 */

/** Mốc icon loa theo âm lượng — 0 = câm, 1 = chỉ loa, 2/3/4 = thêm dần 1/2/3 vòng sóng.
 * @param {number} volume - 0-100 @returns {0|1|2|3|4} */
function resolveVolumeIconLevel(volume) {
    if (volume <= 0) return 0;
    if (volume <= 25) return 1;
    if (volume <= 50) return 2;
    if (volume <= 75) return 3;
    return 4;
}

/** Đồng bộ icon loa Volume HUD theo âm lượng hiện tại.
 * @param {number} volume - 0-100 */
function syncVolumeHudIcon(volume) {
    const level = resolveVolumeIconLevel(volume);
    if (typeof volumeHudMute !== 'undefined' && volumeHudMute) volumeHudMute.classList.toggle('hidden', level !== 0);
    if (typeof volumeHudWave1 !== 'undefined' && volumeHudWave1) volumeHudWave1.classList.toggle('hidden', level < 2);
    if (typeof volumeHudWave2 !== 'undefined' && volumeHudWave2) volumeHudWave2.classList.toggle('hidden', level < 3);
    if (typeof volumeHudWave3 !== 'undefined' && volumeHudWave3) volumeHudWave3.classList.toggle('hidden', level < 4);
}

/** Tô phần "đã kéo" của slider volume (`.setting-slider` dùng chung không tự tô).
 * @param {HTMLElement} sliderEl - #volume-hud-slider @param {number} volume - 0-100 */
function syncVolumeHudSliderFill(sliderEl, volume) {
    const percentage = Math.max(0, Math.min(100, volume));
    sliderEl.style.background = `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
}

// ===================== Speed HUD =====================

/** 5 nấc hợp lệ — nguồn sự thật DUY NHẤT, khớp 5 nút tĩnh trong index.html/visualizer-overlay.js. */
const PLAYBACK_SPEED_STEPS = Object.freeze([0.5, 0.7, 1, 1.2, 1.5, 2]);

/** Nhãn hiển thị 1 mốc tốc độ ("1x"/"0.5x"...). @param {number} speed @returns {string} */
function formatPlaybackSpeedLabel(speed) {
    return `${speed}x`;
}

/** Đồng bộ badge + trạng thái active của 5 nút mốc theo tốc độ hiện tại — gọi lúc mở HUD + mỗi
 * lần tốc độ đổi từ bất kỳ đâu.
 * @param {NodeListOf<HTMLElement>} optionEls - .speed-hud-option (data-speed-option)
 * @param {HTMLElement} badgeEl - #speed-badge-label @param {number} speed */
function syncSpeedHudOptions(optionEls, badgeEl, speed) {
    optionEls.forEach((el) => el.classList.toggle('bg-white/20', parseFloat(el.dataset.speedOption) === speed));
    if (badgeEl) badgeEl.textContent = formatPlaybackSpeedLabel(speed);
}
