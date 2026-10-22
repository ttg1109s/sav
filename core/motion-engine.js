/**
 * core/motion-engine.js — MotionEngine nền Visual (nguồn nền thứ 3, cạnh ảnh tĩnh/video —
 * xem core/state-and-video-bg.js). Transition + Point Move (thay Ken Burns, phản hồi Giang) +
 * React Beat Audio.
 *
 * CHỈ chứa hàm THUẦN, tuân đủ core-function-conventions.md Rule 1-4:
 *   - Rule 1 (đơn tuyến): mỗi hàm ĐÚNG 1 kịch bản — vd chọn index kế tiếp sequential/random tách 2
 *     hàm riêng (pickNextMotionEngineIndexSequential/pickPointMoveOneIndexSequential/Random).
 *   - Rule 2 (không tự đọc appState): mọi hàm nhận objectUrl/transitionType/durationMs/index/
 *     preset field qua THAM SỐ — nơi gọi (event/workflow/visual-bg-photo-motion.js, đổi tên
 *     17/09/2026 từ event/workflow/motion-engine.js) tự appState.get() trước.
 *   - Rule 3 (cấm core gọi core + cấm taskManager trong core): KHÔNG hàm nào trong file này gọi hàm
 *     khác trong CHÍNH file này hay dùng `taskManager` — Workflow tự `taskManager.once()`/`.animate()`
 *     cleanup + tự gọi TỪNG hàm core theo đúng thứ tự.
 *   - Rule 4: file này không tự appState.set()/mutate() (chỉ thao tác DOM thuần) -> N/A.
 *
 * ORCHESTRATION THẬT (đọc appState.motionEngineConfig, đọc DB ảnh, quản lý task lặp qua taskManager,
 * pause/resume theo vizConfig.videoBgEnabled) sống ở event/workflow/visual-bg-photo-motion.js — KHÔNG đặt ở đây
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
 * được chọn (xem `transitionSupportsInOutRatio()` ngay dưới + event/workflow/visual-bg-photo-motion.js). */
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
 * (event/workflow/visual-bg-photo-motion.js) tự lo validate range/kiểu dữ liệu của 2 field trước khi gọi).
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

/** `background-size` của 1 layer ảnh ('' = mặc định CSS). @param {HTMLElement|null} layerEl @param {string} backgroundSize */
function setMotionEngineLayerBackgroundSize(layerEl, backgroundSize) {
    if (!layerEl) return;
    layerEl.style.backgroundSize = backgroundSize || '';
}

/** Đánh dấu layer đang hiện (`.me-current`) — ảnh đầu hiện tĩnh, không qua Transition. @param {HTMLElement|null} layerEl */
function markMotionEngineLayerCurrent(layerEl) {
    if (!layerEl) return;
    layerEl.classList.add('me-current');
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
 * transition kích hoạt LIỀN TRƯỚC — nơi gọi tự nhớ, xem event/workflow/motion-transition-runner.js) — CÙNG
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
 * (`visualBgPhotoMotionPointMoveWrapper`, bọc CHUNG cả 2 layer A/B — SỬA, phản hồi Giang: "point move phải
 * là 1 div cha bao quanh layer A, B", xem docstring đầu assets/css/motion-engine.css). Nơi gọi
 * (event/workflow/motion-point-move-runner.js, Runner DÙNG CHUNG — VBG-Photo qua event/workflow/
 * visual-bg-photo-motion.js, đổi tên 17/09/2026 từ motion-engine.js) tự giữ tham chiếu phần tử đó +
 * tự giữ luôn `Animation` object
 * trả về (để `.cancel()` lúc cần) — Rule 2, hàm này KHÔNG tự quản lý vòng đời Animation, cũng KHÔNG
 * tự biết/quan tâm phần tử truyền vào là gì (generic, nhận bất kỳ `panEl` nào).
 * `easing`/`durationMs` do nơi gọi quyết định — 'one' mode tween thẳng baseline->target 2 keyframe
 * (dùng `ease-in-out`); 'all' mode PHẢI dùng `'linear'` (nhiều keyframe ĐÃ sample sẵn theo đường
 * cong Timing — easing khác 'linear' ở tầng WAAPI sẽ làm méo lại đường cong đã tính, xem
 * event/workflow/motion-point-move-runner.js::_buildPointMoveAllKeyframes()).
 * @param {HTMLElement} panEl - phần tử NHẬN transform (thực tế: `visualBgPhotoMotionPointMoveWrapper`).
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
 * motion-point-move-runner.js). `.cancel()` Animation đang giữ (nếu có) TRƯỚC khi reset
 * inline style — `cancel()` tự gỡ hiệu lực `fill:'forwards'` đang áp, không làm vậy trước thì set
 * lại style ngay sau có thể bị animation "forwards" ghi đè lại.
 * @param {HTMLElement} panEl - phần tử NHẬN transform (thực tế: `visualBgPhotoMotionPointMoveWrapper`).
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
// xem event/workflow/visual-bg-photo-motion.js.

/**
 * Core thuần: dọn class DOM của 1 layer về trạng thái nghỉ (KHÔNG đụng ảnh — Workflow tự gọi riêng
 * `setMotionEngineLayerImage()` cho TỪNG layer + `stopPointMoveAnimation()` MỘT LẦN cho
 * `visualBgPhotoMotionPointMoveWrapper` (bọc chung cả 2 layer, không phải theo từng layer nữa — xem
 * event/workflow/visual-bg-photo-motion.js::stop() — Rule 3 CẤM hàm này tự gọi 2 hàm đó nội bộ).
 * @param {HTMLElement} layerEl
 */
function resetMotionEngineLayerClasses(layerEl) {
    if (!layerEl) return;
    layerEl.classList.remove('me-current', 'me-layer-enter', 'me-layer-exit');
}

