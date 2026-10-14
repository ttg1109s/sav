/**
 * core/visualizer-gesture.js — Core cử chỉ trên #visualizer-gesture-surface (components/visualizer-overlay.js): phân loại
 * chạm/vuốt/tap (thuần) + mũi tên seek-hold (phần tử tĩnh #visualizer-seek-hold-indicator). Điều phối (đọc config, đếm
 * tap, hẹn giờ, gửi eventBus): event/workflow/visualizer-gesture.js.
 *
 * Rìa TRÊN tách khỏi vuốt thường ngay từ toạ độ Y lúc touchstart (2 nhánh loại trừ nhau từ điểm bắt đầu).
 */

/** Lúc chạm: có thuộc dải rìa trên không, có hẹn seek-hold không (không rìa, không Photo, đang bật), chiều seek-hold theo
 * nửa màn chạm (trái = lùi, phải = tiến — theo VỊ TRÍ, không theo chiều di chuyển).
 * @returns {{startEdge: 'top'|null, armSeekHold: boolean, seekHoldDirection: 1|-1}} */
function computeGestureTouchStart(x, y, viewportWidth, edgeZonePx, isPhotoPlayerMode, seekHoldEnabled) {
    const isTopEdge = y <= edgeZonePx;
    return {
        startEdge: isTopEdge ? 'top' : null,
        armSeekHold: !isTopEdge && !isPhotoPlayerMode && seekHoldEnabled,
        seekHoldDirection: x < viewportWidth / 2 ? -1 : 1,
    };
}

/** Tay đã rời điểm chạm quá `limitPx` (đang thành vuốt, không còn giữ yên). @returns {boolean} */
function isGestureMovedBeyond(x, y, startX, startY, limitPx) {
    return Math.hypot(x - startX, y - startY) > limitPx;
}

/** Phân loại lúc thả tay. Bắt đầu ở rìa trên: chỉ 'edgeOpen' (vuốt xuống đủ xa) hoặc 'none' — không rơi xuống tap/vuốt
 * thường. Còn lại: 'tap' (ngắn + đứng yên), 'swipe' (đủ xa — trục chiếm ưu thế + chiều: 1 = phải/xuống, -1 = trái/lên),
 * 'none'.
 * @param {{x: number, y: number, timeMs: number, edge: 'top'|null}} start @param {number} x @param {number} y @param {number} nowMs
 * @param {{edgeMinPx: number, tapMaxPx: number, tapMaxMs: number, swipeMinPx: number}} limits
 * @returns {{kind: 'edgeOpen'|'tap'|'swipe'|'none', axis: 'x'|'y', direction: 1|-1}} */
function classifyGestureRelease(start, x, y, nowMs, limits) {
    const deltaX = x - start.x, deltaY = y - start.y;
    const absX = Math.abs(deltaX), absY = Math.abs(deltaY);
    const distance = Math.hypot(deltaX, deltaY);
    const axis = absX > absY ? 'x' : 'y';
    const isEdgeOpen = distance >= limits.edgeMinPx && deltaY > 0;
    const isTap = distance <= limits.tapMaxPx && (nowMs - start.timeMs) <= limits.tapMaxMs;
    const isSwipe = Math.max(absX, absY) >= limits.swipeMinPx;
    const freeKind = isTap ? 'tap' : (isSwipe ? 'swipe' : 'none');
    return {
        kind: start.edge ? (isEdgeOpen ? 'edgeOpen' : 'none') : freeKind,
        axis,
        direction: (axis === 'x' ? deltaX : deltaY) > 0 ? 1 : -1,
    };
}

/** Thêm 1 lần chạm vào chuỗi tap. @returns {{count: number, isTriple: boolean}} */
function computeTapStep(tapCount, tripleCount) {
    const count = tapCount + 1;
    return { count, isTriple: count >= tripleCount };
}

/** 1 nhịp seek-hold: dời mốc thêm `stepMs` theo chiều, kẹp [0, thời lượng - 1s] (chạm biên = tự nhả), cộng dồn phần thật
 * sự tua, nhãn badge "+X.Xs"/"-X.Xs".
 * @returns {{positionSec: number, totalSec: number, hitBoundary: boolean, label: string}} */
function computeSeekHoldTick(positionSec, direction, stepMs, durationSec, totalSec) {
    const targetSec = positionSec + direction * (stepMs / 1000);
    const clampedSec = Math.max(0, Math.min(Math.max(0, durationSec - 1), targetSec));
    const nextTotalSec = totalSec + Math.abs(clampedSec - positionSec);
    return {
        positionSec: clampedSec,
        totalSec: nextTotalSec,
        hitBoundary: clampedSec !== targetSec,
        label: `${direction > 0 ? '+' : '-'}${nextTotalSec.toFixed(1)}s`,
    };
}

/** Hiện/cập nhật mũi tên + số giây đã tua — giữa màn theo chiều dọc, tâm nửa phải (tiến) / trái (lùi).
 * @param {HTMLElement} indicatorEl - #visualizer-seek-hold-indicator @param {1|-1} direction @param {string} text */
function showSeekHoldIndicator(indicatorEl, direction, text) {
    const arrowEl = indicatorEl.querySelector('.seek-hold-arrow');
    indicatorEl.classList.remove('hidden');
    indicatorEl.style.left = direction > 0 ? '75%' : '25%';
    arrowEl.textContent = direction > 0 ? '››' : '‹‹';
    arrowEl.style.setProperty('--seek-arrow-dx', direction > 0 ? '10px' : '-10px');
    indicatorEl.querySelector('.seek-hold-text').textContent = text;
}

function hideSeekHoldIndicator(indicatorEl) {
    indicatorEl.classList.add('hidden');
}
