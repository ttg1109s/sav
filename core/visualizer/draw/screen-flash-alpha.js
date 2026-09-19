/**
 * core/visualizer/draw/screen-flash-alpha.js — CÔNG THỨC alpha CHUNG của chớp sáng toàn màn hình, thay
 * cho 3 hàm riêng cũ (computeLightningFlashAlpha / computeFireworksFlashAlpha / computeRainFlashAlpha
 * — mỗi cái 1 hệ số/1 cap khác nhau). [MỚI — 19/09/2026, yêu cầu Giang, "đồng bộ + đơn giản hoá"]
 *
 * Cả 4 effect (Thunder/Fireworks/Rain Glass/Rain Street) đọc CÙNG 3 field customEffect.<group>:
 *   flashEnabled (bật/tắt) — flashThreshold (ngưỡng năng lượng 0-1) — flashMaxOpacity (trần opacity).
 * Mỗi effect chỉ khác NGUỒN `energy` (tự tính ở group của mình rồi truyền vào): Thunder = năng lượng
 * bin 5, Rain = năng lượng bin 3, Fireworks = beatScale tại lúc rocket nổ.
 *
 * Thuần — không appState (Rule 2), không gọi core khác (Rule 3). Vẽ bằng `drawScreenFlash()`
 * (screen-flash.js) — Workflow gọi cả hai.
 *
 * NẠP SAU: core/custom-effect.js (hằng SCREEN_FLASH_MAX_ALPHA).
 */

const SCREEN_FLASH_GAIN = 2.5; // hệ số khuếch đại phần năng lượng vượt ngưỡng (thống nhất, bản cũ Rain dùng 1.2)

/**
 * @param {boolean} enabled  customEffect.<group>.flashEnabled
 * @param {boolean} isPlaying
 * @param {number} energy    0-1, nguồn do từng effect tự tính.
 * @param {number} threshold customEffect.<group>.flashThreshold
 * @param {number} maxOpacity customEffect.<group>.flashMaxOpacity — luôn bị kẹp <= SCREEN_FLASH_MAX_ALPHA.
 * @returns {number} alpha 0..min(maxOpacity, SCREEN_FLASH_MAX_ALPHA); 0 nếu không kích hoạt.
 */
function computeScreenFlashAlpha(enabled, isPlaying, energy, threshold, maxOpacity) {
    if (!enabled || !isPlaying || !(energy > threshold)) return 0;
    const cap = Number.isFinite(maxOpacity) ? Math.max(0, Math.min(maxOpacity, SCREEN_FLASH_MAX_ALPHA)) : SCREEN_FLASH_MAX_ALPHA;
    return Math.min(cap, (energy - threshold) * SCREEN_FLASH_GAIN);
}
