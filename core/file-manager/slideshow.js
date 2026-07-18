/**
 * core/file-manager/slideshow.js — Slideshow nền Visual (nguồn nền thứ 3, cạnh ảnh tĩnh/video —
 * xem core/state-and-video-bg.js), Batch 8, ver 12 "Multi Media"
 * (plan-v12-multimedia.md mục 4.b3 + plan-v12-multimedia-update-3.md mục 1.2/2.4).
 *
 * CHỈ chứa hàm THUẦN, tuân đủ core-function-conventions.md Rule 1-4 (Rule 3 ĐÃ SIẾT CHẶT HƠN
 * 04/07/2026 — xem chi tiết ở file đó):
 *   - Rule 1 (đơn tuyến): "chọn ảnh kế tiếp" theo sequential/random là 2 TIẾN TRÌNH khác nhau ->
 *     TÁCH RIÊNG 2 hàm (pickNextSlideshowIndexSequential/Random), KHÔNG gộp 1 hàm rồi if/else theo
 *     tham số `mode` (đúng ví dụ "SAI" handleUpload(file, isVideo) ở core-function-conventions.md).
 *   - Rule 2 (không tự đọc appState): mọi hàm nhận objectUrl/transitionType/durationMs/index/
 *     variant qua THAM SỐ — nơi gọi (event/workflow/slideshow.js) tự appState.get() trước.
 *   - Rule 3 (CẤM TUYỆT ĐỐI core gọi core + CẤM TUYỆT ĐỐI taskManager trong core, VIẾT LẠI
 *     04/07/2026): KHÔNG hàm nào trong file này gọi hàm khác trong CHÍNH file này hay dùng
 *     `taskManager` — `startSlideshowTransitionVisuals()`/`finishSlideshowTransitionVisuals()` cố
 *     tình tách rời (trước đây gộp `beginSlideshowTransition()` tự gọi `taskManager.once()` rồi
 *     tự gọi `setSlideshowLayerImage()`/`stopSlideshowKenBurnsAnimation()` bên trong — VI PHẠM CẢ HAI theo
 *     rule mới). Workflow (event/workflow/slideshow.js) tự `taskManager.once()` + tự gọi TỪNG hàm
 *     core theo đúng thứ tự.
 *   - Rule 4: file này không tự appState.set()/mutate() (chỉ thao tác DOM thuần) -> N/A.
 *
 * ORCHESTRATION THẬT (đọc appState.slideshowConfig/activeBackgroundAlbum, đọc DB album/ảnh, quản
 * lý task lặp qua taskManager, pause/resume theo vizConfig.videoBgEnabled) sống ở
 * event/workflow/slideshow.js — KHÔNG đặt ở đây (workflow được phép đọc appState/dùng taskManager,
 * core thì không — xem comment đầu file đó).
 *
 * DOM: 2 lớp ảnh xen kẽ #visual-slideshow-layer-1/2 (index.html) trong #visual-slideshow-container
 * (z-index -1, mốc đã chừa sẵn ở assets/css/style.css) — animation 13 kiểu transition ở
 * assets/css/slideshow.css, chọn qua thuộc tính [data-transition] gán trên container.
 *
 * NẠP SAU: không phụ thuộc gì (không còn dùng taskManager kể từ 04/07/2026) — mọi phần tử DOM
 * nhận qua tham số, không tự getElementById, không có ràng buộc thứ tự nào.
 */

// ĐÃ XOÁ (18/07/2026, phản hồi Giang — phát hiện lúc soát bug) — `SLIDESHOW_TRANSITION_DURATION_MS`
// (từng = 900) không còn được DÙNG THẬT ở đâu nữa (giá trị mặc định THẬT giờ nằm ở
// `service/state.js::DEFAULT_SLIDESHOW_CONFIG.transitionDurationMs`, hiện = 1000 — khớp đúng
// SLIDESHOW_TRANSITION_MIN_TIME_MS đã chốt) — giữ hằng số CŨ nằm im ở đây SẼ lệch với giá trị THẬT
// (900 vs 1000), gây hiểu lầm khi đọc code. Xoá hẳn thay vì để "chết" không đồng bộ.


/** 12 kiểu transition hợp lệ (plan-v12-multimedia.md mục 4.b3: 7 cơ bản + 5 mở rộng — Ken Burns
 * ĐÃ TÁCH khỏi danh sách này, xem SLIDESHOW_KENBURNS_MODES) — dùng để validate config đã lưu
 * (phòng giá trị hỏng/cũ) và đổ vào <select> Settings Drawer. */
const SLIDESHOW_TRANSITION_TYPES = [
    'fade', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'wipe', 'flip',
    'blur', 'rotateFade', 'curtain', 'circleReveal', 'glitch',
];

/** MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") — 3 kiểu KHÔNG có
 * pha "out" độc lập: layer CŨ đứng yên bất động (`animation: none; opacity: 1;`, xem assets/css/
 * slideshow.css mục 6/10/11), hiệu ứng CHỈ đến từ layer MỚI phủ dần lên bằng clip-path. Khái niệm
 * "tỉ lệ In/Out" KHÔNG áp dụng được cho 3 kiểu này — Settings Drawer tự ẨN mục đó khi 1 trong 3
 * đang được chọn (xem `transitionSupportsInOutRatio()` ngay dưới + event/workflow/slideshow.js). */
const SLIDESHOW_TRANSITION_TYPES_NO_OUT = ['wipe', 'curtain', 'circleReveal'];

/** Biên thời gian transition [1s, 60s] — Giang chốt: min 1s (tránh transition "0 giây" vô nghĩa),
 * max 60s (khớp modal picker mới, format 's-ms'). Cũng dùng làm 2 mốc validate config đã lưu. */
const SLIDESHOW_TRANSITION_MIN_TIME_MS = 1000;
const SLIDESHOW_TRANSITION_MAX_TIME_MS = 60000;

/** 5 easing hợp lệ cho transition — 'linear' = Giang gọi "không easing" (tốc độ đều tăm tắp),
 * 4 còn lại là 4 đường cong CSS chuẩn. Dùng để validate config đã lưu + đổ vào <select>. */
const SLIDESHOW_TRANSITION_EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];

/**
 * Core thuần: kiểm tra 1 kiểu transition CÓ pha "out" độc lập hay không (xem
 * SLIDESHOW_TRANSITION_TYPES_NO_OUT ngay trên để biết lý do 3 kiểu không có).
 * @param {string} transitionType
 * @returns {boolean}
 */
function transitionSupportsInOutRatio(transitionType) {
    return !SLIDESHOW_TRANSITION_TYPES_NO_OUT.includes(transitionType);
}

/**
 * Core thuần: từ TỔNG thời gian transition + tỉ lệ % (Giang gọi "in/out ratio" — % dành cho "in",
 * phần còn lại là "out"), TÍNH RA 2 thời lượng riêng cho pha "in" (layer MỚI, `.ss-layer-enter`) và
 * pha "out" (layer CŨ, `.ss-layer-exit`). Đúng ví dụ Giang đưa: totalMs=10000, ratioPercent=60 ->
 * {inMs:6000, outMs:4000}; ratioPercent=30 -> {inMs:3000, outMs:7000}.
 * @param {number} totalMs
 * @param {number} ratioPercent - 0-100, % dành cho "in".
 * @returns {{inMs: number, outMs: number}}
 */
function computeSlideshowTransitionInOutMs(totalMs, ratioPercent) {
    const clampedRatio = Math.max(0, Math.min(100, ratioPercent));
    const inMs = Math.round(totalMs * clampedRatio / 100);
    return { inMs, outMs: totalMs - inMs };
}

/**
 * Core thuần: KẸP thời gian transition đã cấu hình về KHÔNG VƯỢT QUÁ thời gian hiển thị mỗi ảnh
 * (interval) — tránh xung đột: transition dài hơn khoảng cách tới lượt đổi ảnh KẾ TIẾP sẽ bị
 * `_tick()` mới cắt ngang giữa chừng (dùng lại ĐÚNG 2 layer đó cho lượt mới trong khi animation cũ
 * chưa xong) — giật/lỗi hình, ĐÚNG vấn đề đã lường trước với Giang trước khi code.
 * @param {number} configuredMs
 * @param {number} intervalMs
 * @returns {number}
 */
function capSlideshowTransitionDurationMs(configuredMs, intervalMs) {
    return Math.min(configuredMs, intervalMs);
}

/**
 * Core thuần: set duration + easing của animation TRÊN 1 layer — PHẢI gọi TRƯỚC khi
 * `startSlideshowTransitionVisuals()` thêm class enter/exit (đổi thứ tự sẽ khiến animation đã lỡ
 * bắt đầu chạy với giá trị CŨ 1-2 frame trước khi kịp áp giá trị mới). TÁCH RIÊNG khỏi
 * `startSlideshowTransitionVisuals()` (Rule 1 — "set thời lượng/easing" và "bắt đầu animation
 * bằng cách thêm class" là 2 việc khác nhau, cùng tinh thần tách `setSlideshowLayerImage()` khỏi
 * `startSlideshowTransitionVisuals()` đã có từ trước). Nơi gọi (Workflow) tự gọi 2 LẦN — 1 lần cho
 * layer NGOÀI (incoming, dùng `inMs`) + 1 lần cho layer NGOÀI (outgoing, dùng `outMs`) — TỰ tính
 * `inMs`/`outMs` khác nhau trước khi gọi (computeSlideshowTransitionInOutMs()).
 * @param {HTMLElement} layerEl - layer NGOÀI (`.slideshow-layer`, KHÔNG phải layer con Ken Burns).
 * @param {number} durationMs
 * @param {string} easing - 1 trong SLIDESHOW_TRANSITION_EASINGS.
 */
function setSlideshowTransitionTiming(layerEl, durationMs, easing) {
    if (!layerEl) return;
    layerEl.style.animationDuration = `${durationMs}ms`;
    layerEl.style.animationTimingFunction = easing;
}

/**
 * Core thuần: chọn index KẾ TIẾP theo THỨ TỰ (tuần tự, có vòng lặp). Guard clause thuần (Rule 1
 * cho phép — vẫn đúng 1 kịch bản, chỉ dừng sớm khi chưa đủ điều kiện): `length<=0` (album rỗng)
 * hoặc `currentIndex<0` (lượt đầu tiên, chưa có ảnh nào đang hiện) không phải "tiến trình khác".
 * @param {number} currentIndex - -1 nếu chưa có ảnh nào đang hiện.
 * @param {number} length
 * @returns {number} -1 nếu length<=0.
 */
function pickNextSlideshowIndexSequential(currentIndex, length) {
    if (length <= 0) return -1;
    if (currentIndex < 0) return 0;
    return (currentIndex + 1) % length;
}

/**
 * Core thuần: chọn index KẾ TIẾP NGẪU NHIÊN, khác currentIndex nếu length>1 — TÁCH RIÊNG khỏi bản
 * sequential ở trên (Rule 1: xem giải thích đầu file). Nơi gọi tự chọn gọi hàm nào theo đúng
 * slideshowConfig.mode hiện tại.
 * @param {number} currentIndex
 * @param {number} length
 * @returns {number} -1 nếu length<=0.
 */
function pickNextSlideshowIndexRandom(currentIndex, length) {
    if (length <= 0) return -1;
    if (length === 1) return 0;
    let idx = currentIndex;
    while (idx === currentIndex) idx = Math.floor(Math.random() * length);
    return idx;
}

/** Core thuần: hiện/ẩn toàn bộ container slideshow. */
function setSlideshowContainerVisible(containerEl, visible) {
    if (!containerEl) return;
    containerEl.classList.toggle('hidden', !visible);
}

/** Core thuần: set kiểu transition ĐANG dùng lên container (CSS đọc qua [data-transition], xem
 * assets/css/slideshow.css). Guard clause thuần — type lạ (dữ liệu hỏng/cũ) thì bỏ qua, giữ
 * nguyên giá trị cũ trên DOM thay vì set giá trị rác.
 */
function setSlideshowTransitionType(containerEl, transitionType) {
    if (!containerEl || !SLIDESHOW_TRANSITION_TYPES.includes(transitionType)) return;
    containerEl.dataset.transition = transitionType;
}

/** Core thuần: gán ảnh cho 1 layer (KHÔNG tự tạo objectUrl — nhận sẵn qua tham số, Rule 2). */
function setSlideshowLayerImage(layerEl, objectUrl) {
    if (!layerEl) return;
    layerEl.style.backgroundImage = objectUrl ? `url(${objectUrl})` : '';
}

/**
 * VIẾT LẠI LẦN 2 (Ken Burns "Nhóm 2" — BẢN ĐÚNG, 18/07/2026, phản hồi Giang) — bản trước (13 chế
 * độ CÓ TÊN nhưng vẫn CSS @keyframes tĩnh) CHỈ đúng phần "chia tuỳ chọn", CHƯA đúng phần "dùng kỹ
 * thuật Nhóm 2" (Web Animations API + biên tính theo TỈ LỆ ẢNH THẬT) — Giang chỉ ra rõ, sửa lại
 * ĐÚNG cả 2 vế cùng lúc. XOÁ SẠCH toàn bộ hạ tầng CSS keyframe/classList của bản trước
 * (SLIDESHOW_KENBURNS_CLASS_BY_MODE/ALL_CLASSES/END_TRANSFORMS + 10 class .ss-kenburns-* +
 * @keyframes tương ứng ở assets/css/slideshow.css) — THAY bằng `panEl.animate()` (Web Animations
 * API), vì lý do CĂN BẢN: CSS @keyframes là TĨNH (viết cứng % cố định), trong khi biên pan AN TOÀN
 * giờ PHỤ THUỘC tỉ lệ ẢNH THẬT (record.width/height, core/file-manager/image.js) so với tỉ lệ
 * khung — MỖI ảnh 1 biên khác nhau, không thể viết cố định sẵn cho MỌI ảnh bằng CSS tĩnh được;
 * chỉ JS tính runtime (`computeSlideshowKenBurnsSafeBounds()`) + feed thẳng vào Animation API mới
 * làm được. 13 SLIDESHOW_KENBURNS_MODES GIỮ NGUYÊN (không đổi field/<select> Settings) — chỉ đổi
 * CÁCH áp dụng bên trong.
 *
 * KỸ THUẬT PAN "THẬT" (background-position) — THAY vì luôn giả lập pan bằng overscan cố định +
 * transform translate (bản trước, LUÔN áp dụng bất kể ảnh gì): `background-size: cover` cắt bớt 1
 * chiều của ảnh để phủ kín khung — chiều bị cắt CÀNG NHIỀU (ảnh lệch tỉ lệ khung càng xa) thì càng
 * "dư" pixel ẢNH GỐC THẬT sẵn có để pan qua bằng `background-position` — LỘ pixel THẬT bị cắt mất,
 * KHÁC HẲN zoom transform (chỉ phóng to lại phần ĐÃ hiển thị, không có pixel mới). Chỉ khi ảnh gần
 * khớp tỉ lệ khung (không có "dư" thật đáng kể) mới rơi về phương án dự phòng (overscan cố định
 * nhỏ qua transform, xem `pickSlideshowKenBurnsKeyframes()`) — đảm bảo LUÔN có chuyển động, không
 * đứng yên, dù ảnh không có "dư" gì để khai thác.
 *
 * HỆ QUẢ PHỤ (bỏ được nợ cũ) — `fill: 'forwards'` của Web Animations API TỰ giữ trạng thái CUỐI
 * khi animation chạy hết tự nhiên, ĐÁNG TIN CẬY hơn `animation-fill-mode: forwards` qua CSS class
 * (bản CSS cũ từng phải tự `taskManager.once()` lịch riêng để "đóng băng" bằng tay — xem lịch sử
 * bug 04/07/2026 mục 6, `freezeSlideshowKenBurnsEndState()` — HÀM ĐÓ + toàn bộ cơ chế
 * `slideshowKenBurnsFreeze1`/`2` task ĐÃ XOÁ, KHÔNG CÒN CẦN THIẾT với kỹ thuật này).
 */
const SLIDESHOW_KENBURNS_MODES = [
    'panLeft', 'panRight', 'panTop', 'panBottom', 'panRandom',
    'zoomIn', 'zoomOut', 'zoomRandom',
    'zoomPanLeft', 'zoomPanRight', 'zoomPanTop', 'zoomPanBottom', 'zoomPanRandom',
];

/** 3 chế độ META (*Random) -> danh sách direction CỤ THỂ trong ĐÚNG nhóm con của nó — dùng bởi
 * `resolveSlideshowKenBurnsDirection()` để random ĐÚNG PHẠM VI, không lẫn nhóm. */
const SLIDESHOW_KENBURNS_RANDOM_GROUPS = {
    panRandom: ['panLeft', 'panRight', 'panTop', 'panBottom'],
    zoomRandom: ['zoomIn', 'zoomOut'],
    zoomPanRandom: ['zoomPanLeft', 'zoomPanRight', 'zoomPanTop', 'zoomPanBottom'],
};

/** Dưới ngưỡng này (%) coi như ảnh KHÔNG có "dư" thật đáng kể ở trục đó -> dùng phương án dự
 * phòng (overscan cố định qua transform) thay vì background-position. */
/** Biên thời gian [5s, 60s] dùng làm 2 mốc nội suy "Scl" (computeSlideshowKenBurnsTargetMagnitude())
 * — KHỚP ĐÚNG min/max của `slideshowConfig.intervalSeconds` (components/slideshow-settings-drawer.js,
 * cũng sẽ là min/max của modal chọn thời gian mới — xem core/time-picker-modal.js). */
const SLIDESHOW_KENBURNS_MIN_TIME_MS = 5000;
const SLIDESHOW_KENBURNS_MAX_TIME_MS = 60000;

const SLIDESHOW_KENBURNS_MIN_MEANINGFUL_PAN_PCT = 4;
/** Trần an toàn (%) dù ảnh lệch tỉ lệ khung CỰC ĐOAN (vd ảnh panorama) — tránh pan xa tới mức mất
 * tự nhiên/lộ hết bố cục gốc của ảnh. */
const SLIDESHOW_KENBURNS_MAX_PAN_PCT = 35;
/** Biên độ dự phòng CỐ ĐỊNH (kỹ thuật cũ, giữ lại làm phương án AN TOÀN) — dùng khi pan-only mà
 * ảnh không có "dư" thật đủ dùng, đảm bảo LUÔN có chuyển động thay vì đứng yên.
 * SỬA (18/07/2026, mục 3 phản hồi Giang — "pan left/right còn thiếu") — TĂNG biên độ (1.06->1.10,
 * 1.5%->2.5-4% random) so bản đầu. Lý do: khung hiển thị (desktop, thường rất RỘNG — vd 16:9) so
 * với đa số ảnh chụp thường (4:3, 3:2 — thường "thấp" hơn tỉ lệ khung) khiến TRỤC NGANG hiếm khi có
 * "dư" thật (đa số ảnh dư ở trục DỌC) — pan trái/phải RƠI VÀO nhánh dự phòng này GẦN NHƯ MỌI LÚC
 * trong thực tế, trong khi bản đầu (1.06/1.5%) cho chuyển động quá nhỏ, gần như không thấy được —
 * trông như "bị thiếu" dù code vẫn chạy đúng. Random hoá magnitude luôn (thay vì hằng số CỐ ĐỊNH)
 * — vừa đa dạng hơn, vừa tránh lặp lại y hệt mọi lần (mục 2 phản hồi Giang). */
const SLIDESHOW_KENBURNS_FALLBACK_OVERSCAN_SCALE = 1.10;
const SLIDESHOW_KENBURNS_FALLBACK_PAN_MIN_PCT = 2.5;
const SLIDESHOW_KENBURNS_FALLBACK_PAN_MAX_PCT = 4;

/**
 * Core thuần: tính biên AN TOÀN để pan bằng `background-position` (LỘ pixel THẬT bị
 * `background-size: cover` cắt mất) — dựa trên tỉ lệ ẢNH GỐC (record.width/record.height) so với
 * tỉ lệ KHUNG hiển thị hiện tại. Trả về % TỐI ĐA an toàn để dao động quanh tâm (50%) MỖI TRỤC — 0
 * nghĩa là KHÔNG có "dư" ở trục đó (ảnh khớp gần đúng tỉ lệ khung), nơi gọi
 * (`pickSlideshowKenBurnsKeyframes()`) tự biết cần rơi về phương án dự phòng.
 * @param {number} imgW - record.width (ẢNH GỐC, có thể 0/undefined nếu record cũ thiếu field).
 * @param {number} imgH - record.height.
 * @param {number} frameW - chiều rộng khung hiển thị (window.innerWidth lúc gọi).
 * @param {number} frameH - chiều cao khung hiển thị (window.innerHeight lúc gọi).
 * @returns {{panXRangePct: number, panYRangePct: number}}
 */
function computeSlideshowKenBurnsSafeBounds(imgW, imgH, frameW, frameH) {
    if (!imgW || !imgH || !frameW || !frameH) return { panXRangePct: 0, panYRangePct: 0 }; // record cũ thiếu width/height -> an toàn: coi như không có dư, rơi về dự phòng
    const imgRatio = imgW / imgH;
    const frameRatio = frameW / frameH;
    if (imgRatio > frameRatio) {
        // Ảnh "rộng" hơn khung theo tỉ lệ -> cover cắt bớt 2 bên trái/phải -> dư THEO TRỤC NGANG.
        const hiddenFraction = 1 - (frameRatio / imgRatio); // 0..1 — phần TRĂM chiều rộng ảnh bị cắt mất
        return { panXRangePct: Math.min(SLIDESHOW_KENBURNS_MAX_PAN_PCT, hiddenFraction * 50), panYRangePct: 0 };
    }
    if (imgRatio < frameRatio) {
        // Ảnh "cao" hơn khung theo tỉ lệ -> cover cắt bớt trên/dưới -> dư THEO TRỤC DỌC.
        const hiddenFraction = 1 - (imgRatio / frameRatio);
        return { panXRangePct: 0, panYRangePct: Math.min(SLIDESHOW_KENBURNS_MAX_PAN_PCT, hiddenFraction * 50) };
    }
    return { panXRangePct: 0, panYRangePct: 0 }; // khớp gần đúng tỉ lệ khung -> không trục nào có dư
}

/**
 * Core thuần: từ `mode` (1 trong 13 SLIDESHOW_KENBURNS_MODES), nếu là 1 trong 3 chế độ META
 * (*Random) thì chọn NGẪU NHIÊN 1 direction CỤ THỂ trong ĐÚNG nhóm con (SLIDESHOW_KENBURNS_RANDOM_GROUPS,
 * không lẫn nhóm — panRandom KHÔNG BAO GIỜ ra kết quả có zoom), ngược lại trả thẳng. TÁCH RIÊNG
 * khỏi việc tính animation thật (Rule 1: "chọn direction" và "tính keyframe" là 2 việc khác nhau).
 *
 * SỬA (18/07/2026, mục 2 phản hồi Giang — "mỗi lượt kế tiếp dù giống ảnh trước đó đều phải ngẫu
 * nhiên chứ không dùng vị trí cũ") — nhận thêm `excludeDirection` (direction ĐÃ DÙNG ở lượt kích
 * hoạt liền trước, do Workflow tự nhớ — xem `_lastKenBurnsDirection`, event/workflow/slideshow.js),
 * LOẠI TRỪ nó khỏi lượt random này — CÙNG CONVENTION `pickNextSlideshowIndexRandom()` ở trên (vòng
 * lặp while loại trừ index liền trước) — đảm bảo *Random KHÔNG BAO GIỜ lặp lại Y HỆT direction vừa
 * dùng, kể cả khi random tự nhiên "trúng" lại (khác hẳn chỉ random suông có thể trùng liên tiếp).
 * Chế độ CỤ THỂ (không phải *Random) KHÔNG bị ảnh hưởng — luôn trả về chính nó dù trùng lượt trước
 * (đúng ý người dùng khi CHỌN CỐ ĐỊNH 1 hướng).
 * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES.
 * @param {string|null} excludeDirection - direction dùng ở lượt liền trước (null nếu chưa có).
 * @returns {string} 1 trong 10 direction CỤ THỂ.
 */
function resolveSlideshowKenBurnsDirection(mode, excludeDirection) {
    const randomGroup = SLIDESHOW_KENBURNS_RANDOM_GROUPS[mode];
    if (!randomGroup) return mode; // chế độ CỤ THỂ -> luôn trả chính nó, không random/loại trừ gì cả
    if (randomGroup.length <= 1) return randomGroup[0]; // guard: nhóm chỉ có 1 lựa chọn (hiếm, phòng hờ)
    let picked = randomGroup[Math.floor(Math.random() * randomGroup.length)];
    while (picked === excludeDirection) picked = randomGroup[Math.floor(Math.random() * randomGroup.length)];
    return picked;
}

/**
 * Core thuần: "KẸP" thời gian hiệu ứng Ken Burns về [5s, 60s] — dùng CẢ lúc tính biên độ
 * (magnitude, xem computeSlideshowKenBurnsTargetMagnitude()) LẪN lúc set duration animation THẬT
 * (startSlideshowKenBurnsAnimation()) — 2 nơi PHẢI dùng CÙNG 1 giá trị đã kẹp, không thì biên độ
 * tính theo 1 con số còn animation chạy theo con số khác -> lệch tốc độ, y hệt bug gốc.
 *
 * LÝ DO KẸP TRẦN 60s (18/07/2026, mục "photo per song" phản hồi Giang) — chế độ "Photo per song"
 * có thể cho thời gian hiển thị 1 ảnh RẤT DÀI (vài phút, hết cả bài hát dài) — animation Ken Burns
 * KHÔNG nên kéo dài y hệt thời gian đó (biên độ pan/zoom bị "giãn" quá mỏng trên khoảng thời gian
 * quá dài -> giật, đúng vấn đề Giang phát hiện). Kẹp trần 60s -> Ken Burns hoàn thành 1 lượt
 * chuyển động trong tối đa 60s rồi ĐÓNG BĂNG (fill:'forwards') cho hết phần thời gian còn lại của
 * ảnh — ĐÚNG cách Ken Burns thật hoạt động (lia máy chậm 1 lượt rồi giữ yên, không lia liên tục
 * suốt nhiều phút).
 * @param {number} durationMs
 * @returns {number}
 */
function capSlideshowKenBurnsDurationMs(durationMs) {
    return Math.max(SLIDESHOW_KENBURNS_MIN_TIME_MS, Math.min(SLIDESHOW_KENBURNS_MAX_TIME_MS, durationMs));
}

/**
 * Core thuần: nội suy tuyến tính (Giang gọi "Scl") — TỪ `durationMs` (ĐÃ KẸP [5s,60s] bởi
 * capSlideshowKenBurnsDurationMs() TRƯỚC KHI truyền vào đây) + 1 cặp biên [minPct, maxPct], TÍNH
 * RA 1 điểm "mục tiêu" tỉ lệ thuận với thời gian — thời gian chuyển cảnh CÀNG DÀI thì mục tiêu
 * CÀNG GẦN `maxPct`, CÀNG NGẮN thì CÀNG GẦN `minPct`. Nơi gọi (pickSlideshowKenBurnsKeyframes())
 * KHÔNG dùng thẳng con số này — cộng thêm ±20% jitter ngẫu nhiên quanh nó (giữ đúng yêu cầu mục 2
 * — mỗi lượt vẫn phải khác nhau, không dùng lại y hệt 1 vị trí) rồi mới kẹp vào [minPct, maxPct]
 * lần cuối.
 * DÙNG CHUNG cho MỌI biên độ cần "tỉ lệ thuận thời gian" trong file này (pan thật/dự phòng/zoom) —
 * đơn vị của minPct/maxPct KHÔNG quan trọng (% hay hệ số scale đều nội suy tuyến tính y hệt).
 * @param {number} durationMs - ĐÃ kẹp [5000,60000] (dùng capSlideshowKenBurnsDurationMs() trước).
 * @param {number} minPct - giá trị tại durationMs = 5000ms.
 * @param {number} maxPct - giá trị tại durationMs = 60000ms.
 * @returns {number}
 */
function computeSlideshowKenBurnsTargetMagnitude(durationMs, minPct, maxPct) {
    const ratio = (durationMs - SLIDESHOW_KENBURNS_MIN_TIME_MS) / (SLIDESHOW_KENBURNS_MAX_TIME_MS - SLIDESHOW_KENBURNS_MIN_TIME_MS);
    return minPct + (maxPct - minPct) * Math.max(0, Math.min(1, ratio));
}

/**
 * Core thuần: TỪ 1 direction CỤ THỂ (đã resolve xong *Random) + biên an toàn ẢNH THẬT
 * (computeSlideshowKenBurnsSafeBounds()) + `durationMs` (ĐÃ KẸP — capSlideshowKenBurnsDurationMs()),
 * TÍNH cặp keyframe {transform, backgroundPosition} để feed thẳng vào `panEl.animate([from, to],
 * {...})`.
 *
 * SỬA (18/07/2026, "time-scaled magnitude" phản hồi Giang: "thời gian chuyển a->b lớn mà vị trí
 * ken từ x-y lại quá ngắn thì motion giật") — biên độ pan/zoom KHÔNG còn random ĐỘC LẬP với
 * `durationMs` như bản trước (random hẳn giữa 2 cận cố định bất kể thời gian chạy bao lâu — thời
 * gian dài + biên độ ngắn = tốc độ cực chậm = giật do làm tròn subpixel). Giờ TÍNH mục tiêu tỉ lệ
 * thuận `durationMs` trước (computeSlideshowKenBurnsTargetMagnitude() — "Scl"), RỒI MỚI random
 * NHẸ quanh mục tiêu đó (±20%, giữ đúng yêu cầu mục 2 — vẫn đa dạng, không lặp lại y hệt) — giữ
 * TỐC ĐỘ (biên độ/thời gian) tương đối ổn định dù `durationMs` là 5s hay 60s, thay vì để 2 biến
 * độc lập nhau dẫn tới tốc độ cực chậm (giật) hoặc cực nhanh (giật kiểu khác — "lia" quá gấp).
 * @param {string} direction - 1 trong 10 direction CỤ THỂ.
 * @param {{panXRangePct: number, panYRangePct: number}} bounds
 * @param {number} durationMs - ĐÃ kẹp [5000,60000] bởi capSlideshowKenBurnsDurationMs().
 * @returns {[Object, Object]} [from, to] — mỗi phần tử {transform, backgroundPosition}.
 */
function pickSlideshowKenBurnsKeyframes(direction, bounds, durationMs) {
    const rand = (min, max) => min + Math.random() * (max - min);
    /** Random NHẸ (±20%) quanh 1 mục tiêu đã tính theo thời gian, rồi kẹp cứng vào [floor, ceil]
     * lần cuối (phòng jitter đẩy vượt biên hợp lệ). */
    const jitterAround = (target, floor, ceil) => {
        const jitter = Math.max((ceil - floor) * 0.05, target * 0.2); // tối thiểu 1 chút dù target ~0
        return Math.max(floor, Math.min(ceil, rand(target - jitter, target + jitter)));
    };
    const isZoomOnly = direction === 'zoomIn' || direction === 'zoomOut';
    const isPan = !isZoomOnly; // mọi direction TRỪ 2 cái zoom-only đều có thành phần pan

    let scaleFrom = 1, scaleTo = 1;
    if (direction === 'zoomIn' || direction.startsWith('zoomPan')) {
        const targetDelta = computeSlideshowKenBurnsTargetMagnitude(durationMs, 0.08, 0.16);
        scaleFrom = 1; scaleTo = 1 + jitterAround(targetDelta, 0.08, 0.16);
    } else if (direction === 'zoomOut') {
        const targetDelta = computeSlideshowKenBurnsTargetMagnitude(durationMs, 0.08, 0.16);
        scaleFrom = 1 + jitterAround(targetDelta, 0.08, 0.16); scaleTo = 1;
    }

    let bgFrom = '50% 50%', bgTo = '50% 50%';
    let translateFromX = 0, translateFromY = 0, translateToX = 0, translateToY = 0;

    if (isPan) {
        const axis = (direction.endsWith('Left') || direction.endsWith('Right')) ? 'x' : 'y';
        const sign = (direction.endsWith('Left') || direction.endsWith('Top')) ? -1 : 1; // Left/Top: kết thúc lệch ÂM so với tâm 50%
        const rangePct = axis === 'x' ? bounds.panXRangePct : bounds.panYRangePct;
        const isZoomPan = direction.startsWith('zoomPan');

        if (rangePct >= SLIDESHOW_KENBURNS_MIN_MEANINGFUL_PAN_PCT) {
            // PAN THẬT bằng background-position — ảnh có "dư" pixel thật đủ dùng ở trục này.
            const target = computeSlideshowKenBurnsTargetMagnitude(durationMs, SLIDESHOW_KENBURNS_MIN_MEANINGFUL_PAN_PCT, rangePct);
            const mag = jitterAround(target, SLIDESHOW_KENBURNS_MIN_MEANINGFUL_PAN_PCT, rangePct);
            const startPct = 50 - sign * mag, endPct = 50 + sign * mag;
            if (axis === 'x') { bgFrom = `${startPct}% 50%`; bgTo = `${endPct}% 50%`; }
            else { bgFrom = `50% ${startPct}%`; bgTo = `50% ${endPct}%`; }
        } else if (!isZoomPan) {
            // Pan-only nhưng ảnh KHÔNG có dư thật -> dự phòng overscan cố định (kỹ thuật cũ) để
            // vẫn có chuyển động, không đứng yên.
            scaleFrom = SLIDESHOW_KENBURNS_FALLBACK_OVERSCAN_SCALE;
            scaleTo = SLIDESHOW_KENBURNS_FALLBACK_OVERSCAN_SCALE;
            const target = computeSlideshowKenBurnsTargetMagnitude(durationMs, SLIDESHOW_KENBURNS_FALLBACK_PAN_MIN_PCT, SLIDESHOW_KENBURNS_FALLBACK_PAN_MAX_PCT);
            const mag = jitterAround(target, SLIDESHOW_KENBURNS_FALLBACK_PAN_MIN_PCT, SLIDESHOW_KENBURNS_FALLBACK_PAN_MAX_PCT);
            if (axis === 'x') { translateFromX = -sign * mag; translateToX = sign * mag; }
            else { translateFromY = -sign * mag; translateToY = sign * mag; }
        } else {
            // zoomPan* nhưng ảnh không có dư thật trục đó -> pan NHẸ bằng translate (biên nhỏ hơn
            // pan-only vì bản thân zoom đã "che" phần rìa scale ra rồi, không cần overscan dự
            // phòng nữa — chỉ translate thêm 1 chút cho có phương hướng rõ ràng).
            const target = computeSlideshowKenBurnsTargetMagnitude(durationMs, 1.5, 3);
            const mag = jitterAround(target, 1.5, 3);
            if (axis === 'x') { translateFromX = -sign * mag; translateToX = sign * mag; }
            else { translateFromY = -sign * mag; translateToY = sign * mag; }
        }
    }

    return [
        { transform: `scale(${scaleFrom}) translate(${translateFromX}%, ${translateFromY}%)`, backgroundPosition: bgFrom },
        { transform: `scale(${scaleTo}) translate(${translateToX}%, ${translateToY}%)`, backgroundPosition: bgTo },
    ];
}

/**
 * Core thuần: BẮT ĐẦU Ken Burns bằng Web Animations API trên layer CON `.ss-kenburns-pan` (KHÔNG
 * phải layer ngoài — tách 2 phần tử từ trước, xem docstring đầu assets/css/slideshow.css). Nơi gọi
 * (event/workflow/slideshow.js) tự giữ tham chiếu layer con + tự giữ luôn `Animation` object trả
 * về (để `.cancel()` lúc cần — đổi ảnh mới/tắt Ken Burns, xem `stopSlideshowKenBurnsAnimation()`
 * ngay dưới) — Rule 2, hàm này KHÔNG tự quản lý vòng đời Animation, chỉ tạo ra rồi trả lại.
 * `fill: 'forwards'` tự giữ trạng thái CUỐI khi animation chạy hết tự nhiên (xem docstring đầu
 * file — bỏ hẳn được cơ chế "đóng băng" thủ công của bản CSS cũ).
 * @param {HTMLElement} panEl - layer CON `.ss-kenburns-pan`.
 * @param {[Object, Object]} keyframes - từ pickSlideshowKenBurnsKeyframes().
 * @param {number} durationMs - PHẢI là giá trị ĐÃ KẸP bởi `capSlideshowKenBurnsDurationMs()` — nơi
 *   gọi (event/workflow/slideshow.js) tự cap 1 LẦN rồi dùng CHUNG kết quả đó cho cả
 *   `pickSlideshowKenBurnsKeyframes()` LẪN tham số này (2 nơi PHẢI khớp nhau, không thì biên độ
 *   tính theo 1 con số còn animation chạy theo con số khác — lệch tốc độ, đúng bug gốc).
 * @returns {Animation|null}
 */
function startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs) {
    if (!panEl) return null;
    return panEl.animate(keyframes, { duration: Math.max(SLIDESHOW_KENBURNS_MIN_TIME_MS, durationMs), easing: 'ease-in-out', fill: 'forwards' });
}

/**
 * Core thuần: DỪNG + RESET HẲN Ken Burns về trạng thái gốc (transform/backgroundPosition trung
 * lập) — dùng khi tắt Ken Burns HOẶC layer chuyển sang "outgoing" (đổi ảnh mới). `.cancel()`
 * Animation đang giữ (nếu có) TRƯỚC khi reset inline style — `cancel()` tự gỡ hiệu lực
 * `fill:'forwards'` đang áp, không làm vậy trước thì set lại style ngay sau có thể bị animation
 * "forwards" ghi đè lại (animation đã cancel không còn ảnh hưởng gì tới style nữa).
 * @param {HTMLElement} panEl - layer CON `.ss-kenburns-pan`.
 * @param {Animation|null} animation - Animation Workflow đang giữ cho layer này (null nếu chưa
 *   từng kích hoạt hoặc đã dừng trước đó).
 */
function stopSlideshowKenBurnsAnimation(panEl, animation) {
    if (animation) { try { animation.cancel(); } catch (e) {} }
    if (!panEl) return;
    panEl.style.transform = '';
    panEl.style.backgroundPosition = '';
}

/**
 * Core thuần: TẠM DỪNG Ken Burns TẠI ĐÚNG VỊ TRÍ HIỆN TẠI — dùng khi nhạc bị pause (MỚI, 18/07/2026,
 * mục 1 phản hồi Giang: "khi pause phải tạm dừng và đóng băng luôn dù nó đang ở vị trí nào"). KHÁC
 * HẲN `stopSlideshowKenBurnsAnimation()` (huỷ + reset về gốc) — `.pause()` của Web Animations API
 * GIỮ NGUYÊN `currentTime` (vị trí đang chạy dở, bất kỳ đâu giữa from/to), sẵn sàng chạy tiếp ĐÚNG
 * chỗ đó qua `resumeSlideshowKenBurnsAnimation()` khi nhạc phát lại — không cần biết/tính lại
 * transform hiện tại là gì (khỏi phải tự tính "vị trí đang ở đâu", trình duyệt tự lo).
 * @param {Animation|null} animation - Animation Workflow đang giữ cho layer này (null nếu chưa
 *   từng kích hoạt/đã dừng hẳn).
 */
function pauseSlideshowKenBurnsAnimation(animation) {
    if (animation) { try { animation.pause(); } catch (e) {} }
}

/**
 * Core thuần: CHẠY TIẾP Ken Burns từ ĐÚNG vị trí đã tạm dừng — dùng khi nhạc phát lại sau khi
 * pause (MỚI, 18/07/2026, mục 1 phản hồi Giang). `.play()` của Web Animations API tự tiếp tục từ
 * `currentTime` đã giữ nguyên lúc `pauseSlideshowKenBurnsAnimation()` — KHÔNG restart từ đầu.
 * @param {Animation|null} animation
 */
function resumeSlideshowKenBurnsAnimation(animation) {
    if (animation) { try { animation.play(); } catch (e) {} }
}

/**
 * Core thuần: bắt đầu 1 lượt chuyển cảnh — CHỈ phần tức thời (đổi class ngay lập tức).
 *
 * VIẾT LẠI (04/07/2026, phản hồi Giang mục 3 — Rule 3 siết chặt: CẤM TUYỆT ĐỐI `taskManager`
 * trong core + CẤM TUYỆT ĐỐI core gọi core khác). Bản cũ `beginSlideshowTransition()` tự gọi
 * `taskManager.once()` rồi bên trong callback tự gọi `setSlideshowLayerImage()`/
 * `stopSlideshowKenBurnsAnimation()` — VI PHẠM CẢ HAI. Tách thành 2 hàm ĐỘC LẬP (hàm này + `finish...`
 * dưới), KHÔNG hàm nào gọi hàm kia hay gọi taskManager — Workflow
 * (event/workflow/slideshow.js::_tick()) tự `taskManager.once()` + tự gọi TỪNG hàm core cần thiết
 * (kể cả `setSlideshowLayerImage()`/`stopSlideshowKenBurnsAnimation()` cho outgoing layer) theo đúng thứ
 * tự, xem ví dụ ở core-function-conventions.md Rule 3.
 * @param {HTMLElement} outgoingLayerEl - layer đang có class 'ss-current'.
 * @param {HTMLElement} incomingLayerEl - layer đang ẩn, ĐÃ được set ảnh mới (Workflow tự gọi
 *   `setSlideshowLayerImage()` TRƯỚC khi gọi hàm này).
 */
function startSlideshowTransitionVisuals(outgoingLayerEl, incomingLayerEl) {
    if (!outgoingLayerEl || !incomingLayerEl) return;
    incomingLayerEl.classList.add('ss-layer-enter');
    outgoingLayerEl.classList.remove('ss-current');
    outgoingLayerEl.classList.add('ss-layer-exit');
}

/**
 * Core thuần: KẾT THÚC 1 lượt chuyển cảnh — dọn class 2 layer về trạng thái nghỉ mới.
 * Workflow gọi hàm này SAU KHI đã tự gọi `setSlideshowLayerImage(outgoingLayerEl, '')` +
 * `stopSlideshowKenBurnsAnimation(outgoingLayerEl, ...)` riêng (xem comment
 * `startSlideshowTransitionVisuals()` ở trên) — hàm này KHÔNG tự gọi lại 2 hàm đó.
 * @param {HTMLElement} outgoingLayerEl
 * @param {HTMLElement} incomingLayerEl
 */
function finishSlideshowTransitionVisuals(outgoingLayerEl, incomingLayerEl) {
    if (!outgoingLayerEl || !incomingLayerEl) return;
    outgoingLayerEl.classList.remove('ss-layer-exit');
    incomingLayerEl.classList.remove('ss-layer-enter');
    incomingLayerEl.classList.add('ss-current');
}

// ===================== ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1) — hiện/ẩn panel chọn Album
// kiểu "notify center" =============================================================================
// `setSlideshowAlbumPickerVisible()` (bản trước ở đây) XOÁ HẲN — panel chọn Album giờ dùng
// `openGenericDrawer()`/`closeGenericDrawer()` (core/generic-drawer.js) như mọi Generic Drawer khác,
// xem event/workflow/slideshow.js::openAlbumPicker()/_closeAlbumPickerDrawer().

/**
 * Core thuần: dọn class DOM của 1 layer về trạng thái nghỉ (KHÔNG đụng ảnh/Ken Burns — Workflow tự
 * gọi riêng `setSlideshowLayerImage()`/`stopSlideshowKenBurnsAnimation()` cho từng layer, xem
 * event/workflow/slideshow.js::stop() — Rule 3 CẤM hàm này tự gọi 2 hàm đó nội bộ).
 * @param {HTMLElement} layerEl
 */
function resetSlideshowLayerClasses(layerEl) {
    if (!layerEl) return;
    layerEl.classList.remove('ss-current', 'ss-layer-enter', 'ss-layer-exit');
}
