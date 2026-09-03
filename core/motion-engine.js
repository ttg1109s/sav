/**
 * core/motion-engine.js — MotionEngine nền Visual (nguồn nền thứ 3, cạnh ảnh tĩnh/video —
 * xem core/state-and-video-bg.js). Transition + Point Move (thay Ken Burns, phản hồi Giang) +
 * React Beat Audio.
 *
 * CHỈ chứa hàm THUẦN, tuân đủ core-function-conventions.md Rule 1-4:
 *   - Rule 1 (đơn tuyến): mỗi hàm ĐÚNG 1 kịch bản — vd chọn index kế tiếp sequential/random tách 2
 *     hàm riêng (pickNextMotionEngineIndexSequential/pickPointMoveOneIndexSequential/Random).
 *   - Rule 2 (không tự đọc appState): mọi hàm nhận objectUrl/transitionType/durationMs/index/
 *     preset field qua THAM SỐ — nơi gọi (event/workflow/motion-engine.js) tự appState.get() trước.
 *   - Rule 3 (cấm core gọi core + cấm taskManager trong core): KHÔNG hàm nào trong file này gọi hàm
 *     khác trong CHÍNH file này hay dùng `taskManager` — Workflow tự `taskManager.once()`/`.animate()`
 *     cleanup + tự gọi TỪNG hàm core theo đúng thứ tự.
 *   - Rule 4: file này không tự appState.set()/mutate() (chỉ thao tác DOM thuần) -> N/A.
 *
 * ORCHESTRATION THẬT (đọc appState.motionEngineConfig, đọc DB ảnh, quản lý task lặp qua taskManager,
 * pause/resume theo vizConfig.videoBgEnabled) sống ở event/workflow/motion-engine.js — KHÔNG đặt ở đây
 * (workflow được phép đọc appState/dùng taskManager, core thì không — xem comment đầu file đó).
 *
 * DOM: 2 lớp ảnh xen kẽ #visual-motionEngine-layer-1/2 (index.html) trong #visual-motionEngine-container
 * (z-index -1, mốc đã chừa sẵn ở assets/css/style.css) — animation nhiều kiểu transition (xem
 * MOTION_ENGINE_TRANSITION_TYPES) ở
 * assets/css/motion-engine.css, chọn qua thuộc tính [data-transition] gán trên container.
 *
 * NẠP SAU: không phụ thuộc gì (không còn dùng taskManager kể từ 04/07/2026) — mọi phần tử DOM
 * nhận qua tham số, không tự getElementById, không có ràng buộc thứ tự nào.
 */

/** Kiểu transition hợp lệ (Ken Burns KHÔNG nằm trong danh sách này — đã thay bằng Point Move, xem
 * cuối file) — dùng để validate config đã lưu (phòng giá trị hỏng/cũ) và đổ vào <select>.
 * VIẾT LẠI HOÀN TOÀN (30/08/2026, phản hồi Giang — "gộp các type có hướng lại, thêm field
 * direction") — nhiều lượt trước đã tách slide/wipe/flip/zoom thành TỪNG type riêng theo hướng (vd
 * slideLeft/slideRight/slideUp/slideDown) — giờ GỘP LẠI, hướng chuyển thành field `direction`/
 * `transitionZoomDirection`/`transitionSpinDirection` RIÊNG (core/motion-presets.js), CSS đọc qua
 * `data-direction`/`data-zoom-direction`/`data-spin-direction` (setMotionEngineTransitionType() ngay
 * dưới) kết hợp `[data-transition]` — xem MOTION_ENGINE_TYPES_WITH_DIRECTION/
 * MOTION_ENGINE_TYPES_WITH_ZOOM_DIRECTION/`transitionSupportsDirection()`/
 * `transitionSupportsZoomDirection()`/`transitionSupportsSpinDirection()` ngay dưới. 'flip' (center)
 * đổi tên 'flipCard'; 'spinIn' đổi tên 'spin'. Còn lại 13 type. */
const MOTION_ENGINE_TRANSITION_TYPES = [
    'fade', 'slide', 'wipe', 'flipCard', 'flipEdge', 'zoom',
    'blur', 'rotateFade', 'curtain', 'circleReveal', 'glitch', 'whipPan', 'spin',
];

/** MỚI (30/08/2026, phản hồi Giang) — CHỈ 'flipEdge' có 2 field phụ RIÊNG (`edgeFlipVariant`/
 * `edgeFlipStaticOld`, core/motion-presets.js) — pivot MÉP mới có khái niệm open/close/static-old,
 * pivot GIỮA ('flipCard') thì không. Dùng để Settings Drawer tự ẨN/HIỆN 2 field phụ đó — xem
 * event/workflow/motion-presets.js::_syncEditUI(). */
function transitionIsEdgeFlip(transitionType) {
    return transitionType === 'flipEdge';
}

/** MỚI (30/08/2026, phản hồi Giang); SỬA (30/08/2026, phản hồi Giang — "thêm direction cho wipe"
 * với 4 hướng CHÉO riêng) — BỎ 'wipe' khỏi nhóm này (giờ dùng field RIÊNG `transitionWipeDirection`,
 * xem `transitionSupportsWipeDirection()` ngay dưới — field chung này chỉ có 4 hướng thẳng, không
 * hợp lệ cho 4 hướng chéo wipe cần). CHỈ còn 3 type CÓ field phụ `transitionDirection` (left/right/
 * up/down) — slide (hướng cả cặp layer di chuyển), flipCard/flipEdge (trục + chiều xoay). Dùng để
 * Settings Drawer tự ẨN/HIỆN dòng select "Direction". */
const MOTION_ENGINE_TYPES_WITH_DIRECTION = ['slide', 'flipCard', 'flipEdge'];
function transitionSupportsDirection(transitionType) {
    return MOTION_ENGINE_TYPES_WITH_DIRECTION.includes(transitionType);
}

/** MỚI (30/08/2026, phản hồi Giang — "fade, zoom sẽ hiện select in/out"; 'spin' cũng dùng field
 * này làm "hướng zoom", field thứ 2) — 3 type CÓ field phụ `transitionZoomDirection` (in/out).
 * Dùng để Settings Drawer tự ẨN/HIỆN dòng select "In/Out". */
const MOTION_ENGINE_TYPES_WITH_ZOOM_DIRECTION = ['fade', 'zoom', 'spin'];
function transitionSupportsZoomDirection(transitionType) {
    return MOTION_ENGINE_TYPES_WITH_ZOOM_DIRECTION.includes(transitionType);
}

/** MỚI (30/08/2026, phản hồi Giang) — CHỈ 'spin' có field phụ `transitionSpinDirection`
 * (clockwise/counterclockwise) — chiều XOAY 2D, KHÁC hẳn `transitionDirection` (trục/hướng của
 * slide/flip). Dùng để Settings Drawer tự ẨN/HIỆN dòng select "Spin direction". */
function transitionSupportsSpinDirection(transitionType) {
    return transitionType === 'spin';
}

/** MỚI (30/08/2026, phản hồi Giang — "thêm direction cho wipe") — CHỈ 'wipe' có field phụ RIÊNG
 * `transitionWipeDirection` (8 hướng: 4 thẳng + 4 chéo — core/motion-presets.js), TÁCH khỏi
 * `transitionSupportsDirection()` (dùng chung, chỉ 4 hướng thẳng). Dùng để Settings Drawer tự
 * ẨN/HIỆN dòng select "Direction" RIÊNG cho wipe. */
function transitionSupportsWipeDirection(transitionType) {
    return transitionType === 'wipe';
}

/** MỚI (30/08/2026, phản hồi Giang — "thêm cho Curtain direction ngang/dọc/chéo phải/chéo trái") —
 * CHỈ 'curtain' có field phụ RIÊNG `transitionCurtainDirection` (4 hướng — core/motion-presets.js).
 * Dùng để Settings Drawer tự ẨN/HIỆN dòng select "Direction" RIÊNG cho curtain. */
function transitionSupportsCurtainDirection(transitionType) {
    return transitionType === 'curtain';
}

/** MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") — kiểu KHÔNG có
 * pha "out" độc lập: layer CŨ đứng yên bất động (`animation: none; opacity: 1;`, xem assets/css/
 * motion-engine.css), hiệu ứng CHỈ đến từ layer MỚI phủ dần lên bằng clip-path. Khái niệm "tỉ lệ
 * In/Out" KHÔNG áp dụng được cho các kiểu này — Settings Drawer tự ẨN mục đó khi 1 trong số đang
 * được chọn (xem `transitionSupportsInOutRatio()` ngay dưới + event/workflow/motion-engine.js). */
const MOTION_ENGINE_TRANSITION_TYPES_NO_OUT = ['wipe', 'curtain', 'circleReveal'];

/** Biên thời gian transition [300ms, 60s] — SỬA (phản hồi Giang — hạ min 1s xuống 300ms) — max 60s
 * (khớp modal picker, format 's-ms'). Cũng dùng làm 2 mốc validate config đã lưu. */
const MOTION_ENGINE_TRANSITION_MIN_TIME_MS = 300;
const MOTION_ENGINE_TRANSITION_MAX_TIME_MS = 60000;

/** 5 easing hợp lệ cho transition — 'linear' = Giang gọi "không easing" (tốc độ đều tăm tắp),
 * 4 còn lại là 4 đường cong CSS chuẩn. Dùng để validate config đã lưu + đổ vào <select>. */
const MOTION_ENGINE_TRANSITION_EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];

/**
 * Core thuần: kiểm tra 1 kiểu transition CÓ pha "out" độc lập hay không (xem
 * MOTION_ENGINE_TRANSITION_TYPES_NO_OUT ngay trên để biết lý do các kiểu đó không có).
 * @param {string} transitionType
 * @returns {boolean}
 */
function transitionSupportsInOutRatio(transitionType) {
    return !MOTION_ENGINE_TRANSITION_TYPES_NO_OUT.includes(transitionType);
}

/**
 * Core thuần: từ TỔNG thời gian transition + tỉ lệ % (Giang gọi "in/out ratio" — % dành cho "in",
 * phần còn lại là "out"), TÍNH RA 2 thời lượng riêng cho pha "in" (layer MỚI, `.me-layer-enter`) và
 * pha "out" (layer CŨ, `.me-layer-exit`). Đúng ví dụ Giang đưa: totalMs=10000, ratioPercent=60 ->
 * {inMs:6000, outMs:4000}; ratioPercent=30 -> {inMs:3000, outMs:7000}.
 * @param {number} totalMs
 * @param {number} ratioPercent - 0-100, % dành cho "in".
 * @returns {{inMs: number, outMs: number}}
 */
function computeMotionEngineTransitionInOutMs(totalMs, ratioPercent) {
    const clampedRatio = Math.max(0, Math.min(100, ratioPercent));
    const inMs = Math.round(totalMs * clampedRatio / 100);
    return { inMs, outMs: totalMs - inMs };
}

/**
 * Core thuần: KẸP thời gian transition đã cấu hình về NHỎ HƠN thời gian hiển thị mỗi ảnh (interval)
 * TỐI THIỂU 200ms (SỬA, phản hồi Giang — hạ khoảng cách bắt buộc từ 1s xuống 200ms) — tránh xung
 * đột: transition dài hơn (hoặc bằng) khoảng cách tới lượt đổi ảnh KẾ TIẾP sẽ bị `_tick()` mới cắt
 * ngang giữa chừng (dùng lại ĐÚNG 2 layer đó cho lượt mới trong khi animation cũ chưa xong) —
 * giật/lỗi hình. `Math.max(MOTION_ENGINE_TRANSITION_MIN_TIME_MS, ...)` — sàn an toàn phòng
 * `intervalMs` cực nhỏ.
 * GENERIC — chỉ nhận 2 SỐ THUẦN, không tự đọc/biết bất kỳ consumer/domain nào — nơi gọi tự tính
 * `intervalMs` theo đúng ngữ cảnh của mình rồi truyền vào (xem event/workflow/motion-engine.js::
 * _tick(), event/workflow/motion-presets.js::openTransitionDurationPicker()).
 * @param {number} configuredMs
 * @param {number} intervalMs
 * @returns {number}
 */
function capMotionEngineTransitionDurationMs(configuredMs, intervalMs) {
    return Math.min(configuredMs, Math.max(MOTION_ENGINE_TRANSITION_MIN_TIME_MS, intervalMs - 200));
}

/**
 * Core thuần: set duration + easing của animation TRÊN 1 layer — PHẢI gọi TRƯỚC khi
 * `startMotionEngineTransitionVisuals()` thêm class enter/exit (đổi thứ tự sẽ khiến animation đã lỡ
 * bắt đầu chạy với giá trị CŨ 1-2 frame trước khi kịp áp giá trị mới). TÁCH RIÊNG khỏi
 * `startMotionEngineTransitionVisuals()` (Rule 1 — "set thời lượng/easing" và "bắt đầu animation
 * bằng cách thêm class" là 2 việc khác nhau, cùng tinh thần tách `setMotionEngineLayerImage()` khỏi
 * `startMotionEngineTransitionVisuals()` đã có từ trước). Nơi gọi (Workflow) tự gọi 2 LẦN — 1 lần cho
 * layer NGOÀI (incoming, dùng `inMs`) + 1 lần cho layer NGOÀI (outgoing, dùng `outMs`) — TỰ tính
 * `inMs`/`outMs` khác nhau trước khi gọi (computeMotionEngineTransitionInOutMs()).
 * @param {HTMLElement} layerEl - layer NGOÀI (`.motionEngine-layer`, KHÔNG phải layer con Point Move).
 * @param {number} durationMs
 * @param {string} easing - 1 trong MOTION_ENGINE_TRANSITION_EASINGS.
 */
function setMotionEngineTransitionTiming(layerEl, durationMs, easing) {
    if (!layerEl) return;
    layerEl.style.animationDuration = `${durationMs}ms`;
    layerEl.style.animationTimingFunction = easing;
}

/**
 * Core thuần: chọn index KẾ TIẾP theo THỨ TỰ (tuần tự, có vòng lặp). Guard clause thuần (Rule 1
 * cho phép — vẫn đúng 1 kịch bản, chỉ dừng sớm khi chưa đủ điều kiện): `length<=0` (danh sách rỗng)
 * hoặc `currentIndex<0` (lượt đầu tiên, chưa có ảnh nào đang hiện) không phải "tiến trình khác".
 * @param {number} currentIndex - -1 nếu chưa có ảnh nào đang hiện.
 * @param {number} length
 * @returns {number} -1 nếu length<=0.
 */
function pickNextMotionEngineIndexSequential(currentIndex, length) {
    if (length <= 0) return -1;
    if (currentIndex < 0) return 0;
    return (currentIndex + 1) % length;
}

// XOÁ (08/08/2026, phản hồi Giang) — `pickNextMotionEngineIndexRandom()` (random-loại-trừ-liền-kề trên
// TOÀN mảng mỗi bước) đã bỏ hẳn — thay bằng shuffle-bag (`shuffleVisualBgList()`, core/visual-bg.js
// + `pickNextMotionEngineIndexSequential()` DÙNG CHUNG cho cả 2 nextOrder, xem
// `workflowVisualBg.advanceList()`/`firstIndex()`) — xem docstring `shuffleVisualBgList()` cho lý do
// đổi hẳn thuật toán, không phải xoá suông.

/** Core thuần: hiện/ẩn toàn bộ container motionEngine. */
function setMotionEngineContainerVisible(containerEl, visible) {
    if (!containerEl) return;
    containerEl.classList.toggle('hidden', !visible);
}

/** Core thuần: set kiểu transition ĐANG dùng lên container (CSS đọc qua [data-transition], xem
 * assets/css/motion-engine.css). Guard clause thuần — type lạ (dữ liệu hỏng/cũ) thì bỏ qua, giữ
 * nguyên giá trị cũ trên DOM thay vì set giá trị rác.
 */
function setMotionEngineTransitionType(containerEl, transitionType) {
    if (!containerEl || !MOTION_ENGINE_TRANSITION_TYPES.includes(transitionType)) return;
    containerEl.dataset.transition = transitionType;
}

/** Core thuần: set 2 field phụ của flip-mép lên container (CSS đọc qua [data-flip-variant]/
 * [data-flip-static-old], xem assets/css/motion-engine.css) — MỚI (30/08/2026, phản hồi Giang —
 * "chỉ giữ lại flip page ở các edge... đóng/mở chuyển thành dropdown"). LUÔN set (kể cả type ĐANG
 * chọn không phải edge flip — 2 attribute này vô hại/không ai đọc tới khi selector `[data-transition
 * ="flipXEdge"]` không khớp, đỡ phải thêm guard `transitionIsEdgeFlip()` ở ĐÂY — nơi gọi
 * (event/workflow/motion-engine.js) tự lo validate range/kiểu dữ liệu của 2 field trước khi gọi).
 */
function setMotionEngineEdgeFlipOptions(containerEl, variant, staticOld) {
    if (!containerEl) return;
    containerEl.dataset.flipVariant = variant;
    containerEl.dataset.flipStaticOld = staticOld ? 'true' : 'false';
}

/** Core thuần: set 5 field phụ "hướng" (`transitionDirection`/`transitionZoomDirection`/
 * `transitionSpinDirection`/`transitionWipeDirection`/`transitionCurtainDirection`,
 * core/motion-presets.js) lên container (CSS đọc qua [data-direction]/[data-zoom-direction]/
 * [data-spin-direction]/[data-wipe-direction]/[data-curtain-direction]) — MỚI (30/08/2026, phản hồi
 * Giang — gộp các type có hướng); BỔ SUNG (30/08/2026, phản hồi Giang — field riêng cho wipe/
 * curtain). LUÔN set cả 5 (kể cả type ĐANG chọn không dùng tới field nào — vô hại, selector CSS
 * tương ứng chỉ khớp khi `[data-transition]` cũng khớp type cần).
 */
function setMotionEngineTransitionDirections(containerEl, direction, zoomDirection, spinDirection, wipeDirection, curtainDirection) {
    if (!containerEl) return;
    containerEl.dataset.direction = direction;
    containerEl.dataset.zoomDirection = zoomDirection;
    containerEl.dataset.spinDirection = spinDirection;
    containerEl.dataset.wipeDirection = wipeDirection;
    containerEl.dataset.curtainDirection = curtainDirection;
}

/** Core thuần: gán ảnh cho 1 layer (KHÔNG tự tạo objectUrl — nhận sẵn qua tham số, Rule 2). */
function setMotionEngineLayerImage(layerEl, objectUrl) {
    if (!layerEl) return;
    layerEl.style.backgroundImage = objectUrl ? `url(${objectUrl})` : '';
}

/**
 * Core thuần: resolve giá trị THẬT 1 field/point move ({mode,single,rangeMin,rangeMax}) —
 * `mode==='single'` trả thẳng `single`; `mode==='randomRange'` trả 1 số random ĐỀU trong
 * [rangeMin,rangeMax] (tự sort min/max, phòng UI lỡ đảo ngược 2 tay kéo). Dùng cho CẢ 6 field/point
 * move (linearX/Y, rotate, zoom, flipX/Y) — hình dạng field giống hệt nhau.
 * @param {{mode:string, single:number, rangeMin:number, rangeMax:number}} field
 * @returns {number}
 */
function resolvePointMoveFieldValue(field) {
    if (!field) return 0;
    if (field.mode !== 'randomRange') return field.single;
    const lo = Math.min(field.rangeMin, field.rangeMax);
    const hi = Math.max(field.rangeMin, field.rangeMax);
    return lo + Math.random() * (hi - lo);
}

/**
 * Core thuần: ghép chuỗi `transform` CSS từ 6 giá trị ĐÃ RESOLVE (số thuần, không phải field
 * object) — `zoom` là ĐỘ LỆCH cộng vào scale gốc 1 (0 = scale 1, không zoom — xem docstring
 * core/motion-presets.js). `flipX`/`flipY` dùng `rotateY`/`rotateX` tương ứng (lật 3D, phối cảnh
 * đọc từ `perspective` có sẵn trên `.motion-layer` cha, xem assets/css/motion-engine.css).
 * @param {{linearX:number, linearXUnit:string, linearY:number, linearYUnit:string, rotate:number, zoom:number, flipX:number, flipY:number}} v
 * @returns {string}
 */
function buildPointMoveTransformString(v) {
    return `translate(${v.linearX}${v.linearXUnit}, ${v.linearY}${v.linearYUnit}) rotate(${v.rotate}deg) scale(${1 + v.zoom}) rotateY(${v.flipX}deg) rotateX(${v.flipY}deg)`;
}

/**
 * Core thuần: nội suy tuyến tính thuần (không đơn vị) — dùng CHUNG cho MỌI cặp giá trị cần lerp
 * trong Point Move (từng field/segment, LẪN cường độ đường cong Timing).
 * @param {number} from @param {number} to @param {number} progress01 - 0-1.
 * @returns {number}
 */
function lerpPointMoveNumber(from, to, progress01) {
    return from + (to - from) * progress01;
}

/**
 * Core thuần: cường độ (`timingY`) tại 1 thời điểm `xPercent` bất kỳ trên đường cong Timing — nội
 * suy MƯỢT (Catmull-Rom) qua toàn bộ node đã sắp theo `x` tăng dần. `xPercent` ngoài 2 đầu mút ->
 * kẹp về giá trị node đầu/cuối (không ngoại suy). Công thức viết THẲNG (không gọi hàm con khác) —
 * Rule 3 cấm core gọi core, nên toán Catmull-Rom nằm nguyên trong hàm này.
 * @param {{x:number, y:number}[]} nodesSortedByX - ÍT NHẤT 1 phần tử, đã sắp theo `x` tăng dần.
 * @param {number} xPercent
 * @returns {number}
 */
function computePointMoveCurveIntensityAt(nodesSortedByX, xPercent) {
    if (nodesSortedByX.length === 1) return nodesSortedByX[0].y;
    if (xPercent <= nodesSortedByX[0].x) return nodesSortedByX[0].y;
    const lastNode = nodesSortedByX[nodesSortedByX.length - 1];
    if (xPercent >= lastNode.x) return lastNode.y;
    let i = 0;
    while (i < nodesSortedByX.length - 2 && nodesSortedByX[i + 1].x < xPercent) i++;
    const p0 = nodesSortedByX[Math.max(0, i - 1)];
    const p1 = nodesSortedByX[i];
    const p2 = nodesSortedByX[i + 1];
    const p3 = nodesSortedByX[Math.min(nodesSortedByX.length - 1, i + 2)];
    const span = p2.x - p1.x;
    const t = span <= 0 ? 0 : (xPercent - p1.x) / span;
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
}

/**
 * Core thuần: chọn point move KẾ TIẾP theo THỨ TỰ tăng dần vị trí trong `checkedIndices` (vòng lặp)
 * — dùng khi `pointMoveRunMode==='one'` + `pointMoveOneOrder==='sequential'`. Guard clause thuần
 * (mảng rỗng / `lastIndex` không nằm trong danh sách -> về phần tử đầu) — vẫn 1 kịch bản duy nhất.
 * @param {number[]} checkedIndices - index (trong `preset.pointMoves`) của các point move đã tick.
 * @param {number} lastIndex - index dùng ở lượt kích hoạt liền trước (-1 nếu chưa có lượt nào).
 * @returns {number} -1 nếu `checkedIndices` rỗng.
 */
function pickPointMoveOneIndexSequential(checkedIndices, lastIndex) {
    if (checkedIndices.length === 0) return -1;
    const pos = checkedIndices.indexOf(lastIndex);
    if (pos === -1 || pos === checkedIndices.length - 1) return checkedIndices[0];
    return checkedIndices[pos + 1];
}

/**
 * Core thuần: chọn point move NGẪU NHIÊN trong `checkedIndices`, LOẠI TRỪ `lastIndex` (cùng
 * convention `resolveMotionEngineTransitionOption()` — không lặp lại y hệt lượt liền trước, kể cả
 * random tự nhiên "trúng" lại) — dùng khi `pointMoveOneOrder==='random'`.
 * @param {number[]} checkedIndices @param {number} lastIndex
 * @returns {number} -1 nếu `checkedIndices` rỗng.
 */
function pickPointMoveOneIndexRandom(checkedIndices, lastIndex) {
    if (checkedIndices.length === 0) return -1;
    if (checkedIndices.length === 1) return checkedIndices[0];
    let picked = checkedIndices[Math.floor(Math.random() * checkedIndices.length)];
    while (picked === lastIndex) picked = checkedIndices[Math.floor(Math.random() * checkedIndices.length)];
    return picked;
}

/**
 * Core thuần: resolve 1 field "hướng" transition (`transitionDirection`/`transitionZoomDirection`/
 * `transitionSpinDirection`, core/motion-presets.js) — MỚI (30/08/2026, phản hồi Giang — "bổ sung
 * tuỳ chọn random cho mỗi transition có direction/in out"). `value !== 'random'` -> trả thẳng
 * (chế độ CỤ THỂ, người dùng chọn cố định 1 hướng, KHÔNG random/loại trừ gì). `value === 'random'`
 * -> chọn NGẪU NHIÊN 1 phần tử trong `candidates`, LOẠI TRỪ `excludeValue` (giá trị dùng ở lượt
 * transition kích hoạt LIỀN TRƯỚC — nơi gọi tự nhớ, xem event/workflow/motion-engine.js) — CÙNG
 * convention loại-trừ-lượt-liền-trước dùng ở Point Move (đảm bảo 'random' KHÔNG BAO GIỜ lặp lại
 * y hệt lượt liền trước, kể cả khi random tự nhiên "trúng" lại). DÙNG CHUNG cho cả 5 field hướng
 * transition (khác nhau chỉ ở `candidates` truyền vào).
 * @param {string} value - giá trị field hiện tại — 'random' hoặc 1 giá trị CỤ THỂ.
 * @param {string[]} candidates - toàn bộ giá trị CỤ THỂ hợp lệ (core/motion-presets.js, vd
 *   MOTION_ENGINE_TRANSITION_DIRECTIONS) — KHÔNG bao gồm 'random'.
 * @param {string|null} excludeValue - giá trị dùng ở lượt liền trước (null nếu chưa có).
 * @returns {string} 1 giá trị CỤ THỂ trong `candidates`.
 */
function resolveMotionEngineTransitionOption(value, candidates, excludeValue) {
    if (value !== 'random') return value;
    if (candidates.length <= 1) return candidates[0]; // guard: phòng hờ, không xảy ra thực tế (3 field hiện tại đều >=2 lựa chọn)
    let picked = candidates[Math.floor(Math.random() * candidates.length)];
    while (picked === excludeValue) picked = candidates[Math.floor(Math.random() * candidates.length)];
    return picked;
}

/**
 * Core thuần: BẮT ĐẦU Point Move bằng Web Animations API trên phần tử NHẬN transform Point Move
 * (`motionEnginePointMoveWrapper`, bọc CHUNG cả 2 layer A/B — SỬA, phản hồi Giang: "point move phải
 * là 1 div cha bao quanh layer A, B", xem docstring đầu assets/css/motion-engine.css). Nơi gọi
 * (event/workflow/motion-engine.js) tự giữ tham chiếu phần tử đó + tự giữ luôn `Animation` object
 * trả về (để `.cancel()` lúc cần) — Rule 2, hàm này KHÔNG tự quản lý vòng đời Animation, cũng KHÔNG
 * tự biết/quan tâm phần tử truyền vào là gì (generic, nhận bất kỳ `panEl` nào).
 * `easing`/`durationMs` do nơi gọi quyết định — 'one' mode tween thẳng baseline->target 2 keyframe
 * (dùng `ease-in-out`); 'all' mode PHẢI dùng `'linear'` (nhiều keyframe ĐÃ sample sẵn theo đường
 * cong Timing — easing khác 'linear' ở tầng WAAPI sẽ làm méo lại đường cong đã tính, xem
 * event/workflow/motion-engine.js::_buildPointMoveAllKeyframes()).
 * @param {HTMLElement} panEl - phần tử NHẬN transform (thực tế: `motionEnginePointMoveWrapper`).
 * @param {object[]} keyframes - mảng {transform} cho `panEl.animate()`.
 * @param {number} durationMs
 * @param {string} easing - 1 trong MOTION_ENGINE_TRANSITION_EASINGS, hoặc 'linear' cho 'all' mode.
 * @returns {Animation|null}
 */
function startPointMoveAnimation(panEl, keyframes, durationMs, easing) {
    if (!panEl) return null;
    return panEl.animate(keyframes, { duration: Math.max(1, durationMs), easing, fill: 'forwards' });
}

/**
 * Core thuần: DỪNG + RESET HẲN Point Move về trạng thái gốc (transform trung lập) — dùng khi đổi
 * ảnh mới (SỬA, phản hồi Giang — Point Move giờ CHUNG 1 phần tử cho cả 2 layer A/B, nơi gọi tự dừng
 * animation LƯỢT TRƯỚC trên chính phần tử đó trước khi bắt animation MỚI, xem event/workflow/
 * motion-engine.js::_activatePointMove()). `.cancel()` Animation đang giữ (nếu có) TRƯỚC khi reset
 * inline style — `cancel()` tự gỡ hiệu lực `fill:'forwards'` đang áp, không làm vậy trước thì set
 * lại style ngay sau có thể bị animation "forwards" ghi đè lại.
 * @param {HTMLElement} panEl - phần tử NHẬN transform (thực tế: `motionEnginePointMoveWrapper`).
 * @param {Animation|null} animation - Animation Workflow đang giữ (null nếu chưa từng kích hoạt
 *   hoặc đã dừng trước đó).
 */
function stopPointMoveAnimation(panEl, animation) {
    if (animation) { try { animation.cancel(); } catch (e) {} }
    if (!panEl) return;
    panEl.style.transform = '';
}

/**
 * Core thuần: TẠM DỪNG Point Move TẠI ĐÚNG VỊ TRÍ HIỆN TẠI — dùng khi nhạc bị pause. `.pause()` của
 * Web Animations API GIỮ NGUYÊN `currentTime`, sẵn sàng chạy tiếp ĐÚNG chỗ đó qua
 * `resumePointMoveAnimation()` khi nhạc phát lại.
 * @param {Animation|null} animation
 */
function pausePointMoveAnimation(animation) {
    if (animation) { try { animation.pause(); } catch (e) {} }
}

/**
 * Core thuần: CHẠY TIẾP Point Move từ ĐÚNG vị trí đã tạm dừng — `.play()` tự tiếp tục từ
 * `currentTime` đã giữ nguyên lúc `pausePointMoveAnimation()`, KHÔNG restart từ đầu.
 * @param {Animation|null} animation
 */
function resumePointMoveAnimation(animation) {
    if (animation) { try { animation.play(); } catch (e) {} }
}


/**
 * Core thuần: bắt đầu 1 lượt chuyển cảnh — CHỈ phần tức thời (đổi class ngay lập tức).
 *
 * VIẾT LẠI (04/07/2026, phản hồi Giang mục 3 — Rule 3 siết chặt: CẤM TUYỆT ĐỐI `taskManager`
 * trong core + CẤM TUYỆT ĐỐI core gọi core khác). Bản cũ `beginMotionEngineTransition()` tự gọi
 * `taskManager.once()` rồi bên trong callback tự gọi `setMotionEngineLayerImage()`/
 * `stopPointMoveAnimation()` — vi phạm cả 2 rule. Tách thành 2 hàm ĐỘC LẬP (hàm này + `finish...`
 * dưới), KHÔNG hàm nào gọi hàm kia hay gọi taskManager — Workflow (event/workflow/
 * motion-engine.js::_tick()) tự `taskManager.once()` + tự gọi TỪNG hàm core cần thiết (kể cả
 * `setMotionEngineLayerImage()`/`stopPointMoveAnimation()` cho outgoing layer) theo đúng thứ tự.
 * @param {HTMLElement} outgoingLayerEl - layer đang có class 'me-current'.
 * @param {HTMLElement} incomingLayerEl - layer đang ẩn, ĐÃ được set ảnh mới (Workflow tự gọi
 *   `setMotionEngineLayerImage()` TRƯỚC khi gọi hàm này).
 */
function startMotionEngineTransitionVisuals(outgoingLayerEl, incomingLayerEl) {
    if (!outgoingLayerEl || !incomingLayerEl) return;
    incomingLayerEl.classList.add('me-layer-enter');
    outgoingLayerEl.classList.remove('me-current');
    outgoingLayerEl.classList.add('me-layer-exit');
}

/**
 * Core thuần: KẾT THÚC 1 lượt chuyển cảnh — dọn class 2 layer về trạng thái nghỉ mới.
 * Workflow gọi hàm này SAU KHI đã tự gọi `setMotionEngineLayerImage(outgoingLayerEl, '')` +
 * `stopPointMoveAnimation(outgoingLayerEl, ...)` riêng (xem comment
 * `startMotionEngineTransitionVisuals()` ở trên) — hàm này KHÔNG tự gọi lại 2 hàm đó.
 * @param {HTMLElement} outgoingLayerEl
 * @param {HTMLElement} incomingLayerEl
 */
function finishMotionEngineTransitionVisuals(outgoingLayerEl, incomingLayerEl) {
    if (!outgoingLayerEl || !incomingLayerEl) return;
    outgoingLayerEl.classList.remove('me-layer-exit');
    incomingLayerEl.classList.remove('me-layer-enter');
    incomingLayerEl.classList.add('me-current');
}

// ===================== ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — hiện/ẩn panel chọn nguồn
// kiểu "notify center" =============================================================================
// `setMotionEngineAlbumPickerVisible()` (bản trước ở đây) XOÁ HẲN — panel chọn nguồn giờ dùng
// `openGenericDrawer()`/`closeGenericDrawer()` (core/generic-drawer.js) như mọi Generic Drawer khác,
// xem event/workflow/motion-engine.js.

/**
 * Core thuần: dọn class DOM của 1 layer về trạng thái nghỉ (KHÔNG đụng ảnh — Workflow tự gọi riêng
 * `setMotionEngineLayerImage()` cho TỪNG layer + `stopPointMoveAnimation()` MỘT LẦN cho
 * `motionEnginePointMoveWrapper` (bọc chung cả 2 layer, không phải theo từng layer nữa — xem
 * event/workflow/motion-engine.js::stop() — Rule 3 CẤM hàm này tự gọi 2 hàm đó nội bộ).
 * @param {HTMLElement} layerEl
 */
function resetMotionEngineLayerClasses(layerEl) {
    if (!layerEl) return;
    layerEl.classList.remove('me-current', 'me-layer-enter', 'me-layer-exit');
}

/**
 * Core thuần: tỉ lệ ZOOM react-beat LIÊN TỤC — VIẾT LẠI (30/08/2026, phản hồi Giang, bỏ hẳn cơ chế
 * "bắn theo N beat rồi tự về gốc") — không còn pulse rời rạc, giờ nội suy TUYẾN TÍNH từ baseline
 * 100% (không zoom) CỐ ĐỊNH CỨNG (Giang chốt — "min không phải tuỳ chọn", KHÔNG phải field trong
 * preset/không có slider riêng) lên `maxPct` (NGƯỜI DÙNG tự chỉnh, trần 200 — nơi gọi validate, xem
 * core/motion-presets.js) theo `energy` (0-1, đọc `beatScale` mỗi frame — cùng tín hiệu năng lượng
 * liên tục các hiệu ứng "beatscale" khác trong app đang dùng, vd core/visualizer/types/bar.js) —
 * nhạc CÀNG mạnh, zoom CÀNG gần `maxPct`; nhạc nhẹ/im lặng, zoom về gần 100% (không zoom).
 * @param {number} maxPct
 * @param {number} energy - 0-1 (nơi gọi tự đọc `appState.beatScale`, hàm này tự kẹp phòng hờ).
 * @returns {number} hệ số scale (vd 1.5 = phóng 150%).
 */
function computeMotionEngineBeatReactZoomScale(maxPct, energy) {
    const e = Math.max(0, Math.min(1, energy));
    return (100 + (maxPct - 100) * e) / 100;
}

/**
 * Core thuần: offset pan/rotate react-beat LIÊN TỤC theo `direction` + `energy` — DÙNG CHUNG pan
 * (đơn vị %, `maxVal` = `maxPct-100` ĐÃ trừ baseline, nơi gọi tự trừ trước khi truyền) LẪN rotate
 * (đơn vị độ, `maxVal` = `maxDeg` thẳng, baseline vốn đã là 0 — xem
 * event/workflow/motion-engine.js::_tickBeatReact()). Biên độ nội suy tuyến tính từ 0 (baseline CỐ
 * ĐỊNH CỨNG, Giang chốt — "min không phải tuỳ chọn", KHÔNG phải field trong preset) lên `maxVal`
 * theo `energy`.
 * "left"/"right" — biên độ (luôn không âm) nội suy tuyến tính [0,maxVal] theo `energy`, DẤU CỐ ĐỊNH
 * theo hướng. VIẾT LẠI (30/08/2026, phản hồi Giang — "reverse" checkbox) — "leftToRight"/
 * "rightToLeft" KHÔNG còn quét liên tục theo `energy` nữa (bản cũ `magnitude*(2*energy-1)` đã bỏ) —
 * giờ CÙNG công thức biên độ với "left"/"right" (`maxVal * energy`), CHỈ khác ở dấu: dấu (`polarity`,
 * 1 hoặc -1) do NƠI GỌI tự tính + ĐẢO mỗi lần có "beat mới" (xem
 * `computeMotionEngineBeatReactNextPolarity()` + event/workflow/motion-engine.js::_tickBeatReact())
 * — lượt beat NÀY lệch 1 bên, lượt KẾ TIẾP tự đảo sang bên kia, cứ thế xen kẽ.
 * @param {'left'|'right'|'leftToRight'|'rightToLeft'} direction
 * @param {number} maxVal - biên độ tại energy=1 (ĐÃ trừ baseline, luôn >=0).
 * @param {number} energy - 0-1 (nơi gọi tự đọc `appState.beatScale`, hàm này tự kẹp phòng hờ).
 * @param {number} polarity - 1 hoặc -1 — CHỈ dùng khi `direction` là "leftToRight"/"rightToLeft"
 *   (nơi gọi tự tính/đảo, xem `computeMotionEngineBeatReactNextPolarity()`); "left"/"right" bỏ qua
 *   tham số này (dấu đã cố định theo hướng).
 * @returns {number}
 */
function computeMotionEngineBeatReactOffset(direction, maxVal, energy, polarity) {
    const e = Math.max(0, Math.min(1, energy));
    const magnitude = maxVal * e; // baseline 0 cố định -> nội suy [0,maxVal]
    if (direction === 'left') return -magnitude;
    if (direction === 'right') return magnitude;
    return polarity * magnitude; // 'leftToRight'/'rightToLeft' — dấu do nơi gọi tự đảo mỗi beat mới
}

/**
 * Core thuần: cực (polarity, 1 hoặc -1) cho lượt beat MỚI của "leftToRight"/"rightToLeft" — MỚI
 * (30/08/2026, phản hồi Giang — checkbox "reverse"). Lượt ĐẦU (`prevPolarity===0`, chưa từng có
 * lượt nào) — cực khởi đầu theo `direction` + `reverse`: 'leftToRight' mặc định bắt đầu DƯƠNG
 * (phải), 'rightToLeft' mặc định bắt đầu ÂM (trái) — `reverse=true` ĐẢO lại cực khởi đầu đó (XOR).
 * Lượt SAU (`prevPolarity` đã là 1/-1) — LUÔN đảo ngược lượt trước, bất kể `direction`/`reverse` —
 * đây chính là hành vi "xen kẽ" Giang mô tả (vd left-right 120: lượt 1 dương, lượt 2 ép âm, lượt 3
 * lại dương...; right-left thì khởi đầu âm, xen kẽ ngược lại).
 * @param {number} prevPolarity - 1 hoặc -1 (lượt trước); 0 = CHƯA từng có lượt nào (lượt đầu).
 * @param {'leftToRight'|'rightToLeft'} direction
 * @param {boolean} reverse
 * @returns {number} 1 hoặc -1.
 */
function computeMotionEngineBeatReactNextPolarity(prevPolarity, direction, reverse) {
    if (prevPolarity !== 0) return -prevPolarity; // đã có lượt trước -> luôn đảo, không quan tâm direction/reverse nữa
    const startsPositive = (direction === 'leftToRight') !== reverse; // XOR — reverse lật cực khởi đầu
    return startsPositive ? 1 : -1;
}

/**
 * Core thuần: tiến 1 bước ENVELOPE react-beat — MỚI (30/08/2026, phản hồi Giang báo bug — dùng
 * THẲNG `beatScale` liên tục khiến hiệu ứng "mắc kẹt" ở mức cao suốt đoạn nhạc bass kéo dài, KHÔNG
 * có cảm giác "đập rồi nghỉ"). VIẾT LẠI NGAY sau đó (30/08/2026, phản hồi Giang — bản gate "phải
 * decay HẾT về baseline mới cho attack lại" gây "cục giật": suốt đoạn nhạc bass kéo dài, envelope
 * bị ép chạy 1 chu kỳ sawtooth CỐ ĐỊNH theo `decayMs`, cắt đứt khỏi diễn biến THẬT của nhạc — "vẫn
 * phải có react liên tục chứ không nhất định phải về 100%"). Đổi sang envelope follower CHUẨN
 * (kiểu VU meter, KHÔNG gate/khoá gì cả):
 *   - `beatScale` >= envelope hiện tại -> "attack" TỨC THỜI lên thẳng `beatScale` (nhạc mạnh lên
 *     lúc nào, bắt theo NGAY lúc đó, kể cả đang giữa chừng 1 lượt decay — KHÔNG chờ về baseline).
 *   - `beatScale` < envelope -> "decay" tuyến tính theo THỜI GIAN THẬT (`deltaMs`, không phụ thuộc
 *     framerate) với tốc độ sao cho hết `decayMs` thì đi hết quãng đường 1→0, NHƯNG kẹp SÀN ở đúng
 *     `beatScale` hiện tại (`Math.max`) — không bao giờ rơi THẤP HƠN mức nhạc đang có, nên khi nhạc
 *     bass kéo dài đều đều, envelope tự ổn định BÁM theo `beatScale` (không còn bị ép rơi xuống rồi
 *     bật lên lặp lại giả tạo); khi nhạc THẬT SỰ nhẹ/im lặng (`beatScale` gần 0), sàn cũng gần 0 nên
 *     envelope vẫn tự êm về gần baseline như cũ — chỉ khác là KHÔNG còn bị khoá/ép buộc.
 * @param {number} prevEnvelope - 0-1, giá trị envelope frame TRƯỚC.
 * @param {number} beatScale - 0-1, năng lượng bass tức thời frame NÀY.
 * @param {number} deltaMs - thời gian trôi qua kể từ frame trước (ms).
 * @param {number} decayMs - thời gian để envelope decay hết quãng đường 1→0 (ms) — dùng làm TỐC ĐỘ,
 *   không phải "khoá cứng phải chờ hết mới thôi" như bản trước.
 * @returns {number}
 */
function computeMotionEngineBeatReactEnvelope(prevEnvelope, beatScale, deltaMs, decayMs) {
    if (beatScale >= prevEnvelope) return beatScale; // attack tức thời — nhạc mạnh lên là bắt theo ngay, không cần chờ gì cả
    return Math.max(beatScale, prevEnvelope - (deltaMs / decayMs)); // decay êm, kẹp sàn ở beatScale hiện tại — không rơi thấp hơn mức nhạc đang có
}
