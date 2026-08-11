/**
 * core/volume-hud.js — Core thuần (Rule 1-5) cho icon loa của #visualizer-volume-hud
 * (components/visualizer-overlay.js) — 5 mốc âm lượng theo phản hồi Giang (icon BÊN TRÁI slider,
 * đổi theo 0/1-25/26-50/51-75/76-100%). Mở/đóng panel + slider input thuộc
 * event/workflow/volume-hud.js.
 */

/** Mốc icon loa theo âm lượng — 0 = câm (hiện dấu X), 1 = chỉ loa (không sóng), 2/3/4 = thêm dần
 * 1/2/3 vòng sóng. 5 mốc đúng yêu cầu (0-100%, chia 4 khoảng đều + câm).
 * @param {number} volume - 0-100 @returns {0|1|2|3|4} */
function resolveVolumeIconLevel(volume) {
    if (volume <= 0) return 0;
    if (volume <= 25) return 1;
    if (volume <= 50) return 2;
    if (volume <= 75) return 3;
    return 4;
}

/** Đồng bộ icon loa Volume HUD theo âm lượng hiện tại — gọi lúc mở HUD + mỗi lần âm lượng đổi
 * (setVolume(), core/visualizer/visualizer-display.js) để icon luôn khớp dù đổi từ đâu.
 * @param {number} volume - 0-100 */
function syncVolumeHudIcon(volume) {
    const level = resolveVolumeIconLevel(volume);
    if (typeof volumeHudMute !== 'undefined' && volumeHudMute) volumeHudMute.classList.toggle('hidden', level !== 0);
    if (typeof volumeHudWave1 !== 'undefined' && volumeHudWave1) volumeHudWave1.classList.toggle('hidden', level < 2);
    if (typeof volumeHudWave2 !== 'undefined' && volumeHudWave2) volumeHudWave2.classList.toggle('hidden', level < 3);
    if (typeof volumeHudWave3 !== 'undefined' && volumeHudWave3) volumeHudWave3.classList.toggle('hidden', level < 4);
}
