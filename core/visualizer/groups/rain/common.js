/**
 * core/visualizer/groups/rain/common.js — Registry style con của group "rain" (đăng ký theo yêu
 * cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng). Trước đây
 * `core/visualizer/types/rain.js` gộp 2 style 'glass'/'street' — giờ mỗi style 1 file riêng
 * (`glass.js`/`street.js`, cùng thư mục).
 *
 * `computeRainFlashAlpha()`/`paintRainFlash()` là cơ chế CHUNG (Rule 3 — thuần/chỉ Canvas API)
 * dùng bởi CẢ 2 style — đặt ở đây để 2 file đó không phải định nghĩa trùng lặp.
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

/** Vẽ chớp sáng nếu `flashAlpha > 0` — `flashTint` là closure THUẦN (chỉ định dạng chuỗi màu, do
 * Workflow truyền vào tại chỗ gọi, không gọi hàm core nào) — cùng tinh thần tham số MỜ như
 * `modalChoice()` cho phần KHÔNG liên quan Rule 3 (đây không phải addEventListener, chỉ là style
 * formatter thuần, không cần audit riêng). Chỉ gọi Canvas API. */
function paintRainFlash(ctx, canvasWidth, canvasHeight, flashAlpha, flashTint) {
    if (flashAlpha <= 0) return;
    ctx.fillStyle = flashTint(Math.min(flashAlpha, 0.4));
    ctx.globalAlpha = 1.0;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
