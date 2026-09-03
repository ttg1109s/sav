/**
 * core/point-move-timing-ui.js — Core-UI (Rule 5, hậu tố `-ui.js` bắt buộc vì tự `createElement`
 * dựng cụm DOM MỚI) dựng đường cong Timing cho Point Move 'all' mode (Settings > Motion > sửa 1
 * cấu hình > Point move > Timing) — SVG kéo-thả N node + lưới (grid) tham chiếu:
 *   trục X = `timingX` (0-100%, thời điểm trong `advanceMs`).
 *   trục Y = `timingY` (cường độ, [POINT_MOVE_TIMING_Y_MIN, POINT_MOVE_TIMING_Y_MAX]).
 *
 * 3 LOẠI node:
 *   - Node ẢO 2 đầu (`id` = `POINT_MOVE_TIMING_START_ID`/`POINT_MOVE_TIMING_END_ID`) — LUÔN có mặt
 *     bất kể bao nhiêu point move đã tick (phản hồi Giang — "dù có 1 point duy nhất đều tạo được
 *     đường cong"), THUẦN HIỂN THỊ (phản hồi Giang — "không được kéo X/Y gì hết") — KHÔNG gắn
 *     listener nào (`dataset.interactive='false'`), CỐ ĐỊNH CỨNG tại (0%, 0) và (100%, 0) — hằng
 *     số thuần (phản hồi Giang — "phải ở vị trí 0-0 và 100-0"), KHÔNG lưu trong preset, KHÔNG có
 *     đường nào đổi được từ UI.
 *   - Node "khoá" (`locked:true`, ứng point move index 0) — CHỈ khác biệt MÀU (viền xanh, đánh dấu
 *     "không bỏ tick được") — kéo tự do CẢ X LẪN Y như node thường.
 *   - Node thường — mọi point move khác đã tick.
 *
 * KÉO vs TAP (2 node ẢO 2 đầu KHÔNG áp dụng — thuần hiển thị) — `pointerup` KHÔNG di chuyển đủ xa
 * (`POINT_MOVE_TIMING_TAP_THRESHOLD_PX`, tính bằng PIXEL MÀN HÌNH thật, không phải đơn vị SVG) tính
 * là TAP (mở modal nhập số chính xác, xem event/workflow/motion-presets.js::
 * openPointMoveTimingNodeModal()) THAY VÌ kéo — tránh tap nhẹ bị hiểu nhầm thành kéo lệch 1-2 đơn vị.
 *
 * KHOÁ TRỤC — 2 checkbox ĐỘC LẬP "Điều khiển X"/"Điều khiển Y" (`id="ptmove-timing-axis-x"`/
 * `"ptmove-timing-axis-y"`, KHÔNG loại trừ nhau — phản hồi Giang) nằm NGOÀI cụm DOM này (component
 * tĩnh, xem components/motion-settings-drawer.js) — callback kéo tự `document.getElementById(...)
 * .checked` đọc TRỰC TIẾP lúc kéo (KHÔNG cần truyền qua tham số hàm hay eventBus, đơn giản là đọc
 * state DOM hiện có — không phải gọi hàm khác, không vi phạm Rule 5a): CẢ HAI tick = kéo tự do cả 2
 * trục; chỉ 1 tick = khoá trục còn lại (giữ nguyên giá trị TỪ LÚC `pointerdown`, tránh giật nhẹ trên
 * trục không mong muốn); KHÔNG tick nào = không di chuyển (giữ nguyên cả 2).
 *
 * VỊ TRÍ TRỰC QUAN của node ĐANG KÉO được cập nhật NGAY trong callback `pointermove` (set thẳng
 * `cx`/`cy` lên CHÍNH phần tử đang kéo) — KHÔNG đợi vòng qua eventBus/Workflow mới thấy di chuyển,
 * đảm bảo bám ngón tay/con trỏ tức thời (phản hồi Giang). Đường CONG (polyline) vẫn phải qua
 * Workflow vì cần gọi `computePointMoveCurveIntensityAt()` (core, cấm core gọi core).
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
const POINT_MOVE_TIMING_PAD_X = 16; // SỬA (phản hồi Giang — "thu hẹp gap") — 30 -> 16, nhường thêm không gian vẽ thật
const POINT_MOVE_TIMING_PAD_Y = 14; // 24 -> 14
const POINT_MOVE_TIMING_Y_MIN = -150;
const POINT_MOVE_TIMING_Y_MAX = 150;
const POINT_MOVE_TIMING_NODE_RADIUS = 11;
/** Bước lưới — 5% cho CẢ 2 trục (X: 5% của 0-100; Y: 5% của biên [Y_MIN,Y_MAX] = 300 đơn vị -> 15/bước). */
const POINT_MOVE_TIMING_GRID_STEP_X = 5;
const POINT_MOVE_TIMING_GRID_STEP_Y = (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN) * 0.05;
/** id 2 node ẢO 2 đầu — namespace riêng (`ptmove_...` là id THẬT sinh bởi generatePointMoveId(),
 * core/motion-presets.js — không bao giờ trùng). */
const POINT_MOVE_TIMING_START_ID = '__timing_start__';
const POINT_MOVE_TIMING_END_ID = '__timing_end__';
/** Ngưỡng phân biệt TAP/KÉO — pixel MÀN HÌNH thật (không phải đơn vị SVG, ổn định bất kể zoom CSS). */
const POINT_MOVE_TIMING_TAP_THRESHOLD_PX = 6;

/**
 * Dựng SVG đường cong Timing.
 * @param {{id:string, timingX:number, timingY:number, locked:boolean}[]} points -
 *   ĐÃ gồm sẵn 2 node ảo 2 đầu (nơi gọi tự thêm, xem event/workflow/motion-presets.js::
 *   _computeTimingCurveData()), sort theo `timingX` tăng dần (nơi gọi tự sort — Rule 2, hàm này chỉ
 *   vẽ theo thứ tự nhận được, không tự sắp xếp lại).
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

    const usableW = POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X - 6;
    const usableH = POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y * 2;
    const zeroY = POINT_MOVE_TIMING_PAD_Y + (1 - (0 - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN)) * usableH;
    const maxY = POINT_MOVE_TIMING_PAD_Y;
    const minY = POINT_MOVE_TIMING_SVG_H - POINT_MOVE_TIMING_PAD_Y;

    // --- lưới (grid) tham chiếu, bước 5%:5% — TĨNH, vẽ TRƯỚC TIÊN (nằm dưới mọi thứ khác) ---
    for (let gx = 0; gx <= 100; gx += POINT_MOVE_TIMING_GRID_STEP_X) {
        const x = POINT_MOVE_TIMING_PAD_X + (gx / 100) * usableW;
        const gridV = document.createElementNS(svgNs, 'line');
        gridV.setAttribute('x1', x); gridV.setAttribute('x2', x);
        gridV.setAttribute('y1', maxY); gridV.setAttribute('y2', minY);
        gridV.setAttribute('class', 'ptmove-timing-grid');
        svg.appendChild(gridV);
        if (gx % 25 === 0) {
            const labelX = document.createElementNS(svgNs, 'text');
            labelX.setAttribute('x', x); labelX.setAttribute('y', minY + 10); // SỬA — offset giảm theo PAD_Y mới (14, trước 24) để nhãn không tràn ra ngoài viewBox
            labelX.setAttribute('class', 'ptmove-timing-grid-label');
            labelX.setAttribute('text-anchor', gx === 0 ? 'start' : (gx === 100 ? 'end' : 'middle'));
            labelX.textContent = `${gx}%`;
            svg.appendChild(labelX);
        }
    }
    for (let gy = POINT_MOVE_TIMING_Y_MIN; gy <= POINT_MOVE_TIMING_Y_MAX; gy += POINT_MOVE_TIMING_GRID_STEP_Y) {
        const y = POINT_MOVE_TIMING_PAD_Y + (1 - (gy - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN)) * usableH;
        const gridH = document.createElementNS(svgNs, 'line');
        gridH.setAttribute('x1', POINT_MOVE_TIMING_PAD_X); gridH.setAttribute('x2', POINT_MOVE_TIMING_SVG_W - 6);
        gridH.setAttribute('y1', y); gridH.setAttribute('y2', y);
        gridH.setAttribute('class', 'ptmove-timing-grid');
        svg.appendChild(gridH);
    }

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

    // --- đường cong mượt (polyline, toạ độ ĐÃ tính sẵn từ nơi gọi) ---
    const curveEl = document.createElementNS(svgNs, 'polyline');
    curveEl.setAttribute('points', curvePolylinePoints);
    curveEl.setAttribute('class', 'ptmove-timing-curve');
    svg.appendChild(curveEl);

    // --- node (2 node ẢO 2 đầu + 1 node/point move đã tick) ---
    const nodeEls = points.map((p) => {
        const cx = POINT_MOVE_TIMING_PAD_X + (p.timingX / 100) * usableW;
        const cy = POINT_MOVE_TIMING_PAD_Y + (1 - (p.timingY - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN)) * usableH;
        const nodeEl = document.createElementNS(svgNs, 'circle');
        nodeEl.setAttribute('cx', cx); nodeEl.setAttribute('cy', cy);
        nodeEl.setAttribute('r', POINT_MOVE_TIMING_NODE_RADIUS);
        const isPhantom = p.id === POINT_MOVE_TIMING_START_ID || p.id === POINT_MOVE_TIMING_END_ID;
        nodeEl.setAttribute('class', `ptmove-timing-node${isPhantom ? ' ptmove-timing-node-phantom' : ''}`);
        nodeEl.dataset.pointMoveId = p.id;
        nodeEl.dataset.locked = p.locked ? 'true' : 'false'; // CHỈ còn ý nghĩa MÀU SẮC
        nodeEl.dataset.timingX = p.timingX;
        nodeEl.dataset.timingY = p.timingY;
        nodeEl.dataset.interactive = isPhantom ? 'false' : 'true'; // 2 node ẢO 2 đầu THUẦN hiển thị — phản hồi Giang, KHÔNG kéo/tap được, không gắn listener nào
        svg.appendChild(nodeEl);
        return nodeEl;
    });

    wrapper.appendChild(svg);

    // ===================== addEventListener: gom cuối hàm (Rule 5a) =====================
    let draggingEl = null;
    let dragStartClientX = 0;
    let dragStartClientY = 0;
    let dragStartTimingX = 0;
    let dragStartTimingY = 0;
    let dragMoved = false;

    nodeEls.filter((nodeEl) => nodeEl.dataset.interactive === 'true').forEach((nodeEl) => {
        nodeEl.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingEl = nodeEl;
            dragStartClientX = e.clientX;
            dragStartClientY = e.clientY;
            dragStartTimingX = Number(nodeEl.dataset.timingX);
            dragStartTimingY = Number(nodeEl.dataset.timingY);
            dragMoved = false;
        });
    });
    document.addEventListener('pointermove', (e) => {
        if (!draggingEl) return;
        const distPx = Math.hypot(e.clientX - dragStartClientX, e.clientY - dragStartClientY);
        if (distPx < POINT_MOVE_TIMING_TAP_THRESHOLD_PX) return; // chưa đủ xa -> coi như chưa kéo, KHÔNG gửi preview (tránh tap nhẹ lệch 1-2 đơn vị)
        dragMoved = true;

        const rect = svg.getBoundingClientRect();
        const scaleX = POINT_MOVE_TIMING_SVG_W / rect.width;
        const scaleY = POINT_MOVE_TIMING_SVG_H / rect.height;
        const svgX = (e.clientX - rect.left) * scaleX;
        const svgY = (e.clientY - rect.top) * scaleY;
        const rawXPercent = Math.max(0, Math.min(100, ((svgX - POINT_MOVE_TIMING_PAD_X) / usableW) * 100));
        const yRatio = Math.max(0, Math.min(1, (POINT_MOVE_TIMING_PAD_Y + usableH - svgY) / usableH));
        const rawYValue = POINT_MOVE_TIMING_Y_MIN + yRatio * (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN);

        // 2 checkbox ĐỘC LẬP (KHÔNG loại trừ nhau, phản hồi Giang) — cả 2 tick = kéo tự do CẢ 2 trục;
        // chỉ 1 tick = khoá trục còn lại; KHÔNG tick nào = giữ nguyên cả 2 (không di chuyển).
        const xEnabled = document.getElementById('ptmove-timing-axis-x') ? document.getElementById('ptmove-timing-axis-x').checked : true; // mặc định X nếu không tìm thấy checkbox (phòng hờ)
        const yEnabled = document.getElementById('ptmove-timing-axis-y') ? document.getElementById('ptmove-timing-axis-y').checked : false;
        const xPercent = xEnabled ? rawXPercent : dragStartTimingX;
        const yValue = yEnabled ? rawYValue : dragStartTimingY;

        // Cập nhật NGAY vị trí trực quan của CHÍNH node đang kéo (không đợi vòng qua eventBus/Workflow)
        // — đảm bảo node LUÔN bám theo ngón tay/con trỏ tức thời, không phụ thuộc round-trip nào khác.
        const cx = POINT_MOVE_TIMING_PAD_X + (xPercent / 100) * usableW;
        const cy = POINT_MOVE_TIMING_PAD_Y + (1 - (yValue - POINT_MOVE_TIMING_Y_MIN) / (POINT_MOVE_TIMING_Y_MAX - POINT_MOVE_TIMING_Y_MIN)) * usableH;
        draggingEl.setAttribute('cx', cx);
        draggingEl.setAttribute('cy', cy);

        eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeDrag.preview', payload: { id: draggingEl.dataset.pointMoveId, timingX: xPercent, timingY: yValue } });
    });
    document.addEventListener('pointerup', () => {
        if (!draggingEl) return;
        if (dragMoved) {
            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeDrag.end', payload: {} });
        } else {
            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeTap', payload: { id: draggingEl.dataset.pointMoveId } });
        }
        draggingEl = null;
    });

    return wrapper;
}
