/**
 * core/point-move-timing-ui.js — Core-UI (Rule 5, hậu tố `-ui.js` bắt buộc vì tự `createElement`
 * dựng cụm DOM MỚI) dựng thanh Timing cho Point Move 'all' mode (Settings > Motion > sửa 1 cấu
 * hình > Point move > Timing) — CHỈ 1 TRỤC DUY NHẤT (phản hồi Giang — "loại bỏ toàn bộ timing Y") —
 * kéo-thả N node dọc theo 1 thanh ngang, biểu diễn `timingX` (0-100%, thời điểm trong `advanceMs`).
 *
 * KÉO vs TAP — `pointerup` KHÔNG di chuyển đủ xa (`POINT_MOVE_TIMING_TAP_THRESHOLD_PX`, tính bằng
 * PIXEL MÀN HÌNH thật, không phải đơn vị SVG) tính là TAP (mở modal nhập số chính xác, xem
 * event/workflow/motion-presets.js::openPointMoveTimingNodeModal()) THAY VÌ kéo — tránh tap nhẹ bị
 * hiểu nhầm thành kéo lệch 1-2 đơn vị.
 *
 * 2 NHÃN hiện NGAY lúc `pointerdown` (phản hồi Giang — "label Point N ngay trên mỗi node khi ấn
 * vào" + "toạ độ X ghi và chạy theo node dùng DOM chung ở góc trái bên trên"), ẩn lại lúc thả tay:
 *   - "Point N" — BÁM THEO node (SVG text, x luôn = cx node, y cố định phía trên thanh).
 *   - "X: NN%" — CỐ ĐỊNH ở góc trái bên trên đồ thị (KHÔNG bám node — 1 phần tử DUY NHẤT dùng
 *     chung cho MỌI node, chỉ đổi nội dung theo node ĐANG được ấn).
 *
 * Rule 3 (core cấm gọi core khác) — mọi phép tính ở đây THUẦN HÌNH HỌC (quy đổi %/pixel qua lại),
 * KHÔNG có nghiệp vụ nào cần gọi core khác.
 *
 * Rule 5a: `addEventListener` gom CUỐI hàm, callback CHỈ bắn `eventBus.send()` (không gọi core/
 * workflow nào khác trực tiếp) — kể cả `pointermove`/`pointerup` gắn trên `document` để theo dõi
 * kéo (node nhỏ, dễ tuột khỏi phạm vi phần tử lúc kéo nhanh) vẫn ĐÚNG Rule 5a, chỉ khác THỜI ĐIỂM
 * đăng ký (ngay trong hàm dựng UI, không phải `event/listener/*.js` tĩnh) — không ảnh hưởng nội
 * dung callback. Cập nhật 2 nhãn sống + vị trí node đang kéo là thao tác DOM THUẦN trên chính cụm
 * phần tử hàm này vừa tạo — KHÔNG phải gọi hàm khác, không vi phạm Rule 5a.
 */

const POINT_MOVE_TIMING_SVG_W = 700;
const POINT_MOVE_TIMING_SVG_H = 110;
const POINT_MOVE_TIMING_PAD_X = 20;
const POINT_MOVE_TIMING_TRACK_Y = 62; // vị trí Y CỐ ĐỊNH của thanh + MỌI node (không còn biến thiên theo trục Y nữa)
const POINT_MOVE_TIMING_NODE_RADIUS = 16; // SỬA (phản hồi Giang — "node trông to hơn") — 11 -> 16
/** Bước tick trên thanh — 5% (giữ nguyên mật độ đã chốt trước đó, chỉ còn áp cho 1 trục duy nhất). */
const POINT_MOVE_TIMING_TICK_STEP = 5;
/** Ngưỡng phân biệt TAP/KÉO — pixel MÀN HÌNH thật (không phải đơn vị SVG, ổn định bất kể zoom CSS). */
const POINT_MOVE_TIMING_TAP_THRESHOLD_PX = 6;

/**
 * Dựng thanh Timing.
 * @param {{id:string, timingX:number, locked:boolean, n:number}[]} points - point move ĐÃ tick, sort
 *   theo `timingX` tăng dần (nơi gọi tự sort — Rule 2, hàm này chỉ vẽ theo thứ tự nhận được). `n` =
 *   số thứ tự "Point move N" hiển thị lúc ấn vào node.
 * @param {number} [minX] - biên kéo trái, mặc định 0. (SỬA LẦN 2, phản hồi Giang — hiện LUÔN 0, mốc
 *   x=0 không còn bị field nào khoá nữa, xem event/workflow/motion-engine.js::_activatePointMoveAll();
 *   tham số vẫn giữ lại cho tổng quát/phòng cần lại sau này).
 * @param {number} [maxX] - biên kéo phải, mặc định 100. Nơi gọi truyền <100 (99.9) khi 1 trong 2
 *   field `pointMoveStartForceBaseline`/`pointMoveEndForceBaseline` (core/motion-presets.js) đang
 *   bật — mốc x=100 lúc đó do baseline CỐ ĐỊNH chiếm, không cho kéo/tap-nhập 1 point move khác đè
 *   lên đúng mốc đó.
 * @returns {HTMLElement} phần tử wrapper chứa SVG, sẵn sàng append vào DOM.
 */
function buildPointMoveTimingCurveEl(points, minX, maxX) {
    const boundMinX = typeof minX === 'number' ? minX : 0;
    const boundMaxX = typeof maxX === 'number' ? maxX : 100;
    const wrapper = document.createElement('div');
    wrapper.className = 'ptmove-timing-wrapper';

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${POINT_MOVE_TIMING_SVG_W} ${POINT_MOVE_TIMING_SVG_H}`);
    svg.setAttribute('class', 'ptmove-timing-svg');

    const usableW = POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X * 2;

    // --- thanh ngang (track) + tick 5% — TĨNH, vẽ TRƯỚC TIÊN (nằm dưới node) ---
    const trackEl = document.createElementNS(svgNs, 'line');
    trackEl.setAttribute('x1', POINT_MOVE_TIMING_PAD_X); trackEl.setAttribute('x2', POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X);
    trackEl.setAttribute('y1', POINT_MOVE_TIMING_TRACK_Y); trackEl.setAttribute('y2', POINT_MOVE_TIMING_TRACK_Y);
    trackEl.setAttribute('class', 'ptmove-timing-track');
    svg.appendChild(trackEl);
    for (let gx = 0; gx <= 100; gx += POINT_MOVE_TIMING_TICK_STEP) {
        const x = POINT_MOVE_TIMING_PAD_X + (gx / 100) * usableW;
        const tickEl = document.createElementNS(svgNs, 'line');
        tickEl.setAttribute('x1', x); tickEl.setAttribute('x2', x);
        tickEl.setAttribute('y1', POINT_MOVE_TIMING_TRACK_Y - 4); tickEl.setAttribute('y2', POINT_MOVE_TIMING_TRACK_Y + 4);
        tickEl.setAttribute('class', 'ptmove-timing-tick');
        svg.appendChild(tickEl);
        if (gx % 25 === 0) {
            const labelEl = document.createElementNS(svgNs, 'text');
            labelEl.setAttribute('x', x); labelEl.setAttribute('y', POINT_MOVE_TIMING_TRACK_Y + 20);
            labelEl.setAttribute('class', 'ptmove-timing-tick-label');
            labelEl.setAttribute('text-anchor', gx === 0 ? 'start' : (gx === 100 ? 'end' : 'middle'));
            labelEl.textContent = `${gx}%`;
            svg.appendChild(labelEl);
        }
    }

    // --- node (1 node/point move đã tick, LUÔN cùng 1 độ cao POINT_MOVE_TIMING_TRACK_Y) ---
    const nodeEls = points.map((p) => {
        const cx = POINT_MOVE_TIMING_PAD_X + (p.timingX / 100) * usableW;
        const nodeEl = document.createElementNS(svgNs, 'circle');
        nodeEl.setAttribute('cx', cx); nodeEl.setAttribute('cy', POINT_MOVE_TIMING_TRACK_Y);
        nodeEl.setAttribute('r', POINT_MOVE_TIMING_NODE_RADIUS);
        nodeEl.setAttribute('class', 'ptmove-timing-node');
        nodeEl.dataset.pointMoveId = p.id;
        nodeEl.dataset.locked = p.locked ? 'true' : 'false'; // CHỈ còn ý nghĩa MÀU SẮC — node "không bỏ tick được" (index 0)
        nodeEl.dataset.timingX = p.timingX;
        nodeEl.dataset.n = p.n;
        svg.appendChild(nodeEl);
        return nodeEl;
    });

    // --- 2 nhãn sống, DÙNG CHUNG cho mọi node — ẩn mặc định, chỉ hiện lúc pointerdown/kéo ---
    const pointLabelEl = document.createElementNS(svgNs, 'text'); // "Point N" — bám theo node
    pointLabelEl.setAttribute('class', 'ptmove-timing-point-label');
    pointLabelEl.setAttribute('text-anchor', 'middle');
    pointLabelEl.setAttribute('y', POINT_MOVE_TIMING_TRACK_Y - POINT_MOVE_TIMING_NODE_RADIUS - 10);
    pointLabelEl.setAttribute('visibility', 'hidden');
    svg.appendChild(pointLabelEl);

    const cornerBg = document.createElementNS(svgNs, 'rect'); // "X: NN%" — CỐ ĐỊNH góc trái trên
    cornerBg.setAttribute('class', 'ptmove-timing-corner-bg');
    cornerBg.setAttribute('x', 4); cornerBg.setAttribute('y', 4);
    cornerBg.setAttribute('rx', 4);
    cornerBg.setAttribute('height', 20);
    cornerBg.setAttribute('visibility', 'hidden');
    svg.appendChild(cornerBg);
    const cornerText = document.createElementNS(svgNs, 'text');
    cornerText.setAttribute('class', 'ptmove-timing-corner-text');
    cornerText.setAttribute('x', 10); cornerText.setAttribute('y', 18);
    cornerText.setAttribute('visibility', 'hidden');
    svg.appendChild(cornerText);

    wrapper.appendChild(svg);

    /** Cập nhật CẢ 2 nhãn sống theo `nodeEl` (id + N + timingX HIỆN TẠI) — dùng CHUNG cho pointerdown
     * LẪN pointermove (Rule 5a: thao tác DOM thuần trên cụm phần tử hàm này tự tạo, không gọi hàm
     * khác). `cx` truyền riêng (không đọc lại từ `nodeEl.getAttribute('cx')`) vì lúc gọi TỪ
     * pointermove, giá trị mới có thể CHƯA kịp set lên `nodeEl` (thứ tự set trong callback đó). */
    function showLiveLabels(nodeEl, cx, timingXDisplay) {
        pointLabelEl.setAttribute('x', cx);
        pointLabelEl.textContent = `Point ${nodeEl.dataset.n}`;
        pointLabelEl.setAttribute('visibility', 'visible');
        cornerText.textContent = `X: ${timingXDisplay}%`;
        cornerText.setAttribute('visibility', 'visible');
        const textWidthEstimate = cornerText.textContent.length * 6 + 10;
        cornerBg.setAttribute('width', textWidthEstimate);
        cornerBg.setAttribute('visibility', 'visible');
    }
    function hideLiveLabels() {
        pointLabelEl.setAttribute('visibility', 'hidden');
        cornerText.setAttribute('visibility', 'hidden');
        cornerBg.setAttribute('visibility', 'hidden');
    }

    // ===================== addEventListener: gom cuối hàm (Rule 5a) =====================
    let draggingEl = null;
    let dragStartClientX = 0;
    let dragStartTimingX = 0;
    let dragMoved = false;

    nodeEls.forEach((nodeEl) => {
        nodeEl.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            draggingEl = nodeEl;
            dragStartClientX = e.clientX;
            dragStartTimingX = Number(nodeEl.dataset.timingX);
            dragMoved = false;
            showLiveLabels(nodeEl, Number(nodeEl.getAttribute('cx')), dragStartTimingX.toFixed(1));
        });
    });
    document.addEventListener('pointermove', (e) => {
        if (!draggingEl) return;
        const distPx = Math.abs(e.clientX - dragStartClientX);
        if (distPx < POINT_MOVE_TIMING_TAP_THRESHOLD_PX) return; // chưa đủ xa -> coi như chưa kéo, KHÔNG gửi preview (tránh tap nhẹ lệch 1-2 đơn vị)
        dragMoved = true;

        const rect = svg.getBoundingClientRect();
        const scaleX = POINT_MOVE_TIMING_SVG_W / rect.width;
        const svgX = (e.clientX - rect.left) * scaleX;
        const xPercent = Math.max(boundMinX, Math.min(boundMaxX, ((svgX - POINT_MOVE_TIMING_PAD_X) / usableW) * 100)); // SỬA (phản hồi Giang) — biên ĐỘNG, không còn cố định [0,100]

        const cx = POINT_MOVE_TIMING_PAD_X + (xPercent / 100) * usableW;
        draggingEl.setAttribute('cx', cx); // cập nhật NGAY vị trí trực quan — không đợi vòng qua eventBus/Workflow
        showLiveLabels(draggingEl, cx, xPercent.toFixed(1));

        eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeDrag.preview', payload: { id: draggingEl.dataset.pointMoveId, timingX: xPercent } });
    });
    document.addEventListener('pointerup', () => {
        if (!draggingEl) return;
        hideLiveLabels();
        if (dragMoved) {
            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeDrag.end', payload: {} });
        } else {
            eventBus.send({ router: 'motionPresets', type: 'motionPresets.pointMoveTiming.nodeTap', payload: { id: draggingEl.dataset.pointMoveId } });
        }
        draggingEl = null;
    });

    return wrapper;
}
