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
