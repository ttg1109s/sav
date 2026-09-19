/**
 * core/visualizer/groups/rain/common.js — Registry style con của group "rain" (đăng ký theo yêu
 * cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng). Trước đây
 * `core/visualizer/types/rain.js` gộp 2 style 'glass'/'street' — giờ mỗi style 1 file riêng
 * (`glass.js`/`street.js`, cùng thư mục).
 *
 * `computeRainFlashEnergy()` là cơ chế CHUNG (Rule 3 — thuần) dùng bởi CẢ 2 style — đặt ở đây để 2
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

/** NGUỒN năng lượng chớp của Rain (dải tần thứ 4, nhân smoothedEnergy cho mượt) — thuần. Ngưỡng/cap/bật-tắt
 * KHÔNG còn ở đây: dùng chung `computeScreenFlashAlpha()` (core/visualizer/draw/screen-flash-alpha.js) +
 * customEffect.rain.flashEnabled/flashThreshold/flashMaxOpacity. @returns {number} 0..1 */
function computeRainFlashEnergy(smoothedEnergy, vizDataArray) {
    return smoothedEnergy * ((vizDataArray[3] || 0) / 255);
}
