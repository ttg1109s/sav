/**
 * core/point-move-timing-ui.js — Core-UI (Rule 5, hậu tố `-ui.js` bắt buộc vì tự `createElement`
 * dựng cụm DOM MỚI) dựng đường cong Timing cho Point Move 'all' mode (Settings > Motion > sửa 1
 * cấu hình > Point move > Timing) — SVG kéo-thả N node:
 *   trục X = `timingX` (0-100%, thời điểm trong `advanceMs`).
 *   trục Y = `timingY` (cường độ, [POINT_MOVE_TIMING_Y_MIN, POINT_MOVE_TIMING_Y_MAX]).
 * Node VỊ TRÍ ĐẦU (index 0, `locked:true`) khoá trục X = 0 (chỉ kéo được Y) — xem
 * core/motion-presets.js::sanitizeMotionPointMoves().
 *
 * Rule 3 (core cấm gọi core khác) — file NÀY KHÔNG tự tính đường cong mượt (Catmull-Rom sống ở
 * core/motion-engine.js::computePointMoveCurveIntensityAt(), 1 file core KHÁC — cấm gọi). Nơi gọi
 * (event/workflow/motion-presets.js) TỰ sample đường cong (gọi hàm đó trong vòng lặp — Workflow
 * được phép) rồi truyền THẲNG chuỗi toạ độ điểm polyline đã tính sẵn (`curvePolylinePoints`) vào
 * đây — hàm NÀY chỉ vẽ, không tính toán nghiệp vụ nào.
 *
 * Rule 5a: `addEventListener` gom CUỐI hàm, callback CHỈ bắn `eventBus.send()` (không gọi core/
 * workflow nào khác trực tiếp) — kể cả `pointermove`/`pointerup` gắn trên `document` để theo dõi
 * kéo (node nhỏ, dễ tuột khỏi phạm vi phần tử lúc kéo nhanh) vẫn ĐÚNG Rule 5a, chỉ khác THỜI ĐIỂM
 * đăng ký (ngay trong hàm dựng UI, không phải `event/listener/*.js` tĩnh) — không ảnh hưởng nội
 * dung callback. Quy đổi pixel -> % dùng NGAY trong callback (phép tính thuần, không phải gọi hàm).
 */

const POINT_MOVE_TIMING_SVG_W = 700;
const POINT_MOVE_TIMING_SVG_H = 260;
const POINT_MOVE_TIMING_PAD_X = 30;
const POINT_MOVE_TIMING_PAD_Y = 24;
const POINT_MOVE_TIMING_Y_MIN = -150;
const POINT_MOVE_TIMING_Y_MAX = 150;
const POINT_MOVE_TIMING_NODE_RADIUS = 11;

/**
 * Dựng SVG đường cong Timing.
 * @param {{id:string, timingX:number, timingY:number, locked:boolean}[]} points - point move ĐÃ
 *   tick, sort theo `timingX` tăng dần (nơi gọi tự sort — Rule 2, hàm này chỉ vẽ theo thứ tự nhận
 *   được, không tự sắp xếp lại).
 * @param {string} curvePolylinePoints - chuỗi "x1,y1 x2,y2 ..." (toạ độ SVG THẬT, ĐÃ quy đổi sẵn
 *   bởi nơi gọi) cho `<polyline>` — đường cong mượt giữa các node.
 * @returns {HTMLElement} phần tử wrapper chứa SVG, sẵn sàng append vào DOM.
 */
function buildPointMoveTimingCurveEl(points, curvePolylinePoints) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ptmove-timing-wrapper';

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${POINT_MOVE_TIMING_SVG_W} ${POINT_MOVE_TIMING_SVG_H}`);
    svg.setAttribute('class', 'ptmove-timing-svg');

    const zeroY = POINT_MOVE_TIMING_PAD_Y + (1 - (0 - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN)) * (POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y * 2);
    const maxY = POINT_MOVE_TIMING_PAD_Y;
    const minY = POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y;

    // --- trục + biên trên/dưới (đường nét đứt, tham chiếu — TĨNH, không tương tác) ---
    const axisEl = document.createElementNS(svgNs, 'line');
    axisEl.setAttribute('x1', POINT_MOVE_TIMING_PAD_X); axisEl.setAttribute('x2', POINT_MOVE_TIMING_SVG_W - 6);
    axisEl.setAttribute('y1', zeroY); axisEl.setAttribute('y2', zeroY);
    axisEl.setAttribute('class', 'ptmove-timing-axis');
    svg.appendChild(axisEl);
    [maxY, minY].forEach((y) => {
        const boundEl = document.createElementNS(svgNs, 'line');
        boundEl.setAttribute('x1', POINT_MOVE_TIMING_PAD_X); boundEl.setAttribute('x2', POINT_MOVE_TIMING_SVG_W - 6);
        boundEl.setAttribute('y1', y); boundEl.setAttribute('y2', y);
        boundEl.setAttribute('class', 'ptmove-timing-bound');
        svg.appendChild(boundEl);
    });
    const vAxisEl = document.createElementNS(svgNs, 'line');
    vAxisEl.setAttribute('x1', POINT_MOVE_TIMING_PAD_X); vAxisEl.setAttribute('x2', POINT_MOVE_TIMING_PAD_X);
    vAxisEl.setAttribute('y1', maxY); vAxisEl.setAttribute('y2', minY);
    vAxisEl.setAttribute('class', 'ptmove-timing-vaxis');
    svg.appendChild(vAxisEl);

    // --- mốc "bắt đầu" tĩnh (tham chiếu trực quan, KHÔNG phải node — xem docstring) ---
    const startMarker = document.createElementNS(svgNs, 'circle');
    startMarker.setAttribute('cx', POINT_MOVE_TIMING_PAD_X - 18); startMarker.setAttribute('cy', zeroY);
    startMarker.setAttribute('r', POINT_MOVE_TIMING_NODE_RADIUS);
    startMarker.setAttribute('class', 'ptmove-timing-start-marker');
    svg.appendChild(startMarker);

    // --- đường cong mượt (polyline, toạ độ ĐÃ tính sẵn từ nơi gọi) ---
    const curveEl = document.createElementNS(svgNs, 'polyline');
    curveEl.setAttribute('points', curvePolylinePoints);
    curveEl.setAttribute('class', 'ptmove-timing-curve');
    svg.appendChild(curveEl);

    // --- node (1 node/point move đã tick) ---
    const nodeEls = points.map((p) => {
        const cx = POINT_MOVE_TIMING_PAD_X + (p.timingX / 100) * (POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X - 6);
        const cy = POINT_MOVE_TIMING_PAD_Y + (1 - (p.timingY - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN)) * (POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y * 2);
        const nodeEl = document.createElementNS(svgNs, 'circle');
        nodeEl.setAttribute('cx', cx); nodeEl.setAttribute('cy', cy);
        nodeEl.setAttribute('r', POINT_MOVE_TIMING_NODE_RADIUS);
        nodeEl.setAttribute('class', 'ptmove-timing-node');
        nodeEl.dataset.pointMoveId = p.id;
        nodeEl.dataset.locked = p.locked ? 'true' : 'false';
        svg.appendChild(nodeEl);
        return nodeEl;
    });

    wrapper.appendChild(svg);

    // ===================== addEventListener: gom cuối hàm (Rule 5a) =====================
    let draggingEl = null;
    nodeEls.forEach((nodeEl) => {
        nodeEl.addEventListener('pointerdown', (e) => { e.preventDefault(); draggingEl = nodeEl; });
    });
    document.addEventListener('pointermove', (e) => {
        if (!draggingEl) return;
        const rect = svg.getBoundingClientRect();
        const scaleX = POINT_MOVE_TIMING_SVG_W / rect.width;
        const scaleY = POINT_MOVE_TIMING_SVG_H / rect.height;
        const svgX = (e.clientX - rect.left) * scaleX;
        const svgY = (e.clientY - rect.top) * scaleY;
        const usableW = POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X - 6;
        const usableH = POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y * 2;
        const isLocked = draggingEl.dataset.locked === 'true';
        const xPercent = isLocked ? 0 : Math.max(0, Math.min(100, ((svgX - POINT_MOVE_TIMING_PAD_X) / usableW) * 100));
        const yRatio = Math.max(0, Math.min(1, (POINT_MOVE_TIMING_PAD_Y + usableH - svgY) / usableH));
        const yValue = POINT_MOVE_TIMING_Y_MIN + yRatio * (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN);
        eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeDrag.preview', payload: { id: draggingEl.dataset.pointMoveId, timingX: xPercent, timingY: yValue } });
    });
    document.addEventListener('pointerup', () => {
        if (!draggingEl) return;
        eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeDrag.end', payload: {} });
        draggingEl = null;
    });

    return wrapper;
}
