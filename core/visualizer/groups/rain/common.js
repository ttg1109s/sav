/**
 * core/visualizer/groups/rain/common.js — phần dùng chung của group "rain" (`glass.js`, `street.js`):
 * `computeRainFlashEnergy()` (thuần). Chớp màn hình vẽ bằng `drawScreenFlash()` (core/visualizer/draw/screen-flash.js),
 * Workflow gọi trực tiếp.
 *
 * NẠP TRƯỚC: `glass.js`, `street.js`.
 */

// ================================ Nhóm dùng chung: chớp sáng =================================

/** NGUỒN năng lượng chớp của Rain (dải tần thứ 4, nhân smoothedEnergy cho mượt) — thuần. Ngưỡng/cap/bật-tắt
 * KHÔNG còn ở đây: dùng chung `computeScreenFlashAlpha()` (core/visualizer/draw/screen-flash-alpha.js) +
 * customEffect.rain.flashEnabled/flashThreshold/flashMaxOpacity. @returns {number} 0..1 */
function computeRainFlashEnergy(smoothedEnergy, vizDataArray) {
    return smoothedEnergy * ((vizDataArray[3] || 0) / 255);
}
