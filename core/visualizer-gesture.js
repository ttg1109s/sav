/**
 * core/visualizer-gesture.js — Core THUẦN (Rule 1-5), phân loại toạ độ 1 lần chạm/vuốt trên
 * #visualizer-gesture-surface (components/visualizer-overlay.js). Mỗi hàm chỉ tính TOÁN, không
 * đụng appState/DOM/taskManager — điều phối (đọc config, đếm double-tap, dispatch eventBus) thuộc
 * event/workflow/visualizer-gesture.js.
 *
 * Thiết kế: tách "chạm ở rìa" khỏi "vuốt lên/xuống thường" NGAY TỪ toạ độ Y lúc touchstart (không
 * suy đoán từ chiều vuốt) — Workflow gọi isInTopEdgeZone()/isInBottomEdgeZone() lúc touchstart để
 * quyết định luồng xử lý đi hẳn theo nhánh cạnh hay nhánh thường, 2 nhánh loại trừ nhau.
 */

/** true nếu toạ độ Y lúc chạm nằm trong dải rìa TRÊN màn hình.
 * @param {number} y @param {number} edgeZonePx @returns {boolean} */
function isInTopEdgeZone(y, edgeZonePx) {
    return y <= edgeZonePx;
}

/** true nếu toạ độ Y lúc chạm nằm trong dải rìa DƯỚI màn hình.
 * @param {number} y @param {number} viewportHeight @param {number} edgeZonePx @returns {boolean} */
function isInBottomEdgeZone(y, viewportHeight, edgeZonePx) {
    return y >= viewportHeight - edgeZonePx;
}

/** true nếu cử chỉ đủ ngắn + đủ đứng yên để coi là 1 lần chạm (tap), không phải vuốt.
 * @param {number} distancePx @param {number} elapsedMs @param {number} maxDistancePx @param {number} maxDurationMs @returns {boolean} */
function isTapGesture(distancePx, elapsedMs, maxDistancePx, maxDurationMs) {
    return distancePx <= maxDistancePx && elapsedMs <= maxDurationMs;
}

/** Trục vuốt chiếm ưu thế giữa 2 điểm đầu/cuối — 'x' | 'y' | null (null nếu chưa đủ khoảng cách
 * tối thiểu để tính là 1 lần vuốt thật, tránh nhầm với rung tay/tap trượt nhẹ).
 * @param {number} deltaX @param {number} deltaY @param {number} minDistancePx @returns {'x'|'y'|null} */
function resolveDominantSwipeAxis(deltaX, deltaY, minDistancePx) {
    const absX = Math.abs(deltaX), absY = Math.abs(deltaY);
    if (Math.max(absX, absY) < minDistancePx) return null;
    return absX > absY ? 'x' : 'y';
}

/** Chiều vuốt trên 1 trục, quy ước từ điểm đầu -> điểm cuối. 1 = xuôi trục dương (phải/xuống),
 * -1 = ngược trục (trái/lên).
 * @param {number} delta @returns {1|-1} */
function resolveSwipeDirection(delta) {
    return delta > 0 ? 1 : -1;
}

/** true nếu toạ độ X nằm ở nửa TRÁI màn hình — xác định chiều seek-hold (trái = lùi, phải = tiến)
 * theo VỊ TRÍ chạm, không phải theo chiều di chuyển (giữ yên tay, không vuốt).
 * @param {number} x @param {number} viewportWidth @returns {boolean} */
function isInLeftHalf(x, viewportWidth) {
    return x < viewportWidth / 2;
}

/** Kẹp vị trí seek đích vào [0, durationSec - 1] — biên dưới/trên kết thúc phiên seek-hold (thả
 * tay hoặc chạm biên đều dừng, xem event/workflow/visualizer-gesture.js).
 * @param {number} targetSec @param {number} durationSec
 * @returns {{clampedSec: number, hitBoundary: boolean}} */
function clampSeekPosition(targetSec, durationSec) {
    const min = 0, max = Math.max(0, durationSec - 1);
    const clampedSec = Math.max(min, Math.min(max, targetSec));
    return { clampedSec, hitBoundary: clampedSec !== targetSec };
}

let _seekHoldIndicatorEl = null; // badge nổi "+X.Xs"/"-X.Xs" tại vị trí giữ tay — tạo 1 lần, tái dùng xuyên phiên

/** Hiện/cập nhật badge nổi tại toạ độ chạm — gọi lại nhiều lần trong 1 phiên seek-hold (mỗi tick)
 * chỉ đổi text, không tạo lại DOM. Neo giữa (translate -50%/-50%) đúng tại (x,y).
 * @param {number} x @param {number} y @param {string} text */
function showSeekHoldIndicator(x, y, text) {
    if (!_seekHoldIndicatorEl) {
        _seekHoldIndicatorEl = document.createElement('div');
        _seekHoldIndicatorEl.id = 'visualizer-seek-hold-indicator';
        _seekHoldIndicatorEl.className = 'fixed z-[70] -translate-x-1/2 -translate-y-1/2 pointer-events-none px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 text-white text-sm font-mono font-bold shadow-lg';
        document.body.appendChild(_seekHoldIndicatorEl);
    }
    _seekHoldIndicatorEl.style.left = `${x}px`;
    _seekHoldIndicatorEl.style.top = `${y}px`;
    _seekHoldIndicatorEl.textContent = text;
}

/** Gỡ badge nổi (nếu đang hiện) — gọi lúc dừng seek-hold (thả tay/chạm biên/touchcancel). */
function hideSeekHoldIndicator() {
    if (_seekHoldIndicatorEl) { _seekHoldIndicatorEl.remove(); _seekHoldIndicatorEl = null; }
}
