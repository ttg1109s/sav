/**
 * core/visualizer/groups/rain/common.js — Registry style con của group "rain" (đăng ký theo yêu
 * cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng). Trước đây
 * `core/visualizer/types/rain.js` gộp 2 style 'glass'/'street' — giờ mỗi style 1 file riêng
 * (`glass.js`/`street.js`, cùng thư mục).
 *
 * `computeRainFlashAlpha()` là cơ chế CHUNG (Rule 3 — thuần) dùng bởi CẢ 2 style — đặt ở đây để 2
 * file đó không phải định nghĩa trùng lặp. [SỬA 19/09/2026, yêu cầu Giang] `paintRainFlash()` ĐÃ
 * XOÁ (cap 0.4 cứng cũ cũng bỏ) — chớp vẽ bằng `drawScreenFlash()` (core/visualizer/draw/
 * screen-flash.js, cap opacity chung), Workflow gọi trực tiếp.
 *
 * NẠP: TRƯỚC `glass.js`/`street.js`.
 */

/** Danh sách style con thuộc group "rain" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). */
const RAIN_GROUP_STYLE_KEYS = ['glass', 'street'];

// ================================ Nhóm dùng chung: chớp sáng =================================

/** Guard clause + công thức chớp — thuần. @returns {number} flashAlpha (0 nếu không kích hoạt). */
function computeRainFlashAlpha(glassFlashEnabled, isPlaying, smoothedEnergy, vizDataArray) {
    if (!glassFlashEnabled || !isPlaying) return 0;
    const energySpike = smoothedEnergy * ((vizDataArray[3] || 0) / 255);
    return energySpike > 0.4 ? (energySpike - 0.4) * 1.2 : 0;
}
