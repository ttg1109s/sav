/**
 * core/visualizer-gesture.js — Core THUẦN (Rule 1-5), phân loại toạ độ 1 lần chạm/vuốt trên
 * #visualizer-gesture-surface (components/visualizer-overlay.js). Mỗi hàm chỉ tính TOÁN, không
 * đụng appState/DOM/taskManager — điều phối (đọc config, đếm tap, dispatch eventBus) thuộc
 * event/workflow/visualizer-gesture.js.
 *
 * Thiết kế: tách "chạm ở rìa TRÊN" khỏi "vuốt lên/xuống thường" NGAY TỪ toạ độ Y lúc touchstart
 * (không suy đoán từ chiều vuốt) — Workflow gọi isInTopEdgeZone() lúc touchstart để quyết định
 * luồng xử lý đi hẳn theo nhánh cạnh hay nhánh thường, 2 nhánh loại trừ nhau. Rìa DƯỚI đã bỏ hẳn
 * (thay bằng tap 3 lần, event/workflow/visualizer-gesture.js).
 */

/** true nếu toạ độ Y lúc chạm nằm trong dải rìa TRÊN màn hình.
 * @param {number} y @param {number} edgeZonePx @returns {boolean} */
function isInTopEdgeZone(y, edgeZonePx) {
    return y <= edgeZonePx;
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

let _seekHoldIndicatorEl = null; // mũi tên + badge "+X.Xs"/"-X.Xs" — tạo 1 lần, tái dùng xuyên phiên

/** Hiện/cập nhật mũi tên + số giây đã tua — CỐ ĐỊNH ở giữa theo chiều dọc màn hình, tại tâm nửa
 * trái (lùi) hoặc nửa phải (tiến) tuỳ chiều — KHÔNG bám theo toạ độ chạm thật (khác bản cũ). Gọi
 * lại nhiều lần trong 1 phiên seek-hold (mỗi tick), chỉ đổi text; chiều/mũi tên chỉ đổi thật sự
 * khi bắt đầu phiên MỚI (object DOM tái dùng xuyên nhiều phiên, có thể khác chiều phiên trước).
 * @param {1|-1} direction - 1 = tua tiến (nửa phải), -1 = tua lùi (nửa trái).
 * @param {string} text - vd "+4.0s"/"-4.0s". */
function showSeekHoldIndicator(direction, text) {
    if (!_seekHoldIndicatorEl) {
        _seekHoldIndicatorEl = document.createElement('div');
        _seekHoldIndicatorEl.id = 'visualizer-seek-hold-indicator';
        _seekHoldIndicatorEl.className = 'fixed top-1/2 z-[70] pointer-events-none flex flex-col items-center gap-1';
        _seekHoldIndicatorEl.style.transform = 'translate(-50%, -50%)';
        _seekHoldIndicatorEl.innerHTML = `
            <div class="seek-hold-arrow text-white" style="font-size: 3.25rem; line-height: 1; letter-spacing: -0.1em; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.45));"></div>
            <div class="seek-hold-text text-white font-mono font-bold" style="font-size: 1.375rem; filter: drop-shadow(0 1px 4px rgba(0,0,0,0.45));"></div>
        `;
        document.body.appendChild(_seekHoldIndicatorEl);
    }
    _seekHoldIndicatorEl.style.left = direction > 0 ? '75%' : '25%';
    _seekHoldIndicatorEl.querySelector('.seek-hold-arrow').textContent = direction > 0 ? '››' : '‹‹';
    _seekHoldIndicatorEl.querySelector('.seek-hold-arrow').style.setProperty('--seek-arrow-dx', direction > 0 ? '10px' : '-10px');
    _seekHoldIndicatorEl.querySelector('.seek-hold-text').textContent = text;
}

/** Gỡ mũi tên/badge (nếu đang hiện) — gọi lúc dừng seek-hold (thả tay/chạm biên/touchcancel). */
function hideSeekHoldIndicator() {
    if (_seekHoldIndicatorEl) { _seekHoldIndicatorEl.remove(); _seekHoldIndicatorEl = null; }
}
