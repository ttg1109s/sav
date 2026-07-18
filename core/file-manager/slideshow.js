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

/** Thời lượng 1 lượt chuyển cảnh (ms) — PHẢI khớp animation-duration ở assets/css/slideshow.css
 * (`.ss-layer-enter`/`.ss-layer-exit`) — đổi 1 chỗ phải đổi luôn chỗ kia. */
const SLIDESHOW_TRANSITION_DURATION_MS = 900;

/** 12 kiểu transition hợp lệ (plan-v12-multimedia.md mục 4.b3: 7 cơ bản + 5 mở rộng — Ken Burns
 * ĐÃ TÁCH khỏi danh sách này, xem SLIDESHOW_KENBURNS_MODES) — dùng để validate config đã lưu
 * (phòng giá trị hỏng/cũ) và đổ vào <select> Settings Drawer. */
const SLIDESHOW_TRANSITION_TYPES = [
    'fade', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'wipe', 'flip',
    'blur', 'rotateFade', 'curtain', 'circleReveal', 'glitch',
];

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
 * Core thuần: TỪ 1 direction CỤ THỂ (đã resolve xong *Random) + biên an toàn ẢNH THẬT
 * (computeSlideshowKenBurnsSafeBounds()), TÍNH NGẪU NHIÊN 1 cặp keyframe {transform,
 * backgroundPosition} để feed thẳng vào `panEl.animate([from, to], {...})`. Biên độ zoom/pan
 * random NHẸ MỖI LẦN gọi (KHÔNG cố định như CSS @keyframes trước đây) — biến thể gần như vô hạn
 * dù cùng 1 direction, cùng 1 ảnh.
 * @param {string} direction - 1 trong 10 direction CỤ THỂ.
 * @param {{panXRangePct: number, panYRangePct: number}} bounds
 * @returns {[Object, Object]} [from, to] — mỗi phần tử {transform, backgroundPosition}.
 */
function pickSlideshowKenBurnsKeyframes(direction, bounds) {
    const rand = (min, max) => min + Math.random() * (max - min);
    const isZoomOnly = direction === 'zoomIn' || direction === 'zoomOut';
    const isPan = !isZoomOnly; // mọi direction TRỪ 2 cái zoom-only đều có thành phần pan

    let scaleFrom = 1, scaleTo = 1;
    if (direction === 'zoomIn' || direction.startsWith('zoomPan')) { scaleFrom = 1; scaleTo = rand(1.08, 1.16); }
    else if (direction === 'zoomOut') { scaleFrom = rand(1.08, 1.16); scaleTo = 1; }

    let bgFrom = '50% 50%', bgTo = '50% 50%';
    let translateFromX = 0, translateFromY = 0, translateToX = 0, translateToY = 0;

    if (isPan) {
        const axis = (direction.endsWith('Left') || direction.endsWith('Right')) ? 'x' : 'y';
        const sign = (direction.endsWith('Left') || direction.endsWith('Top')) ? -1 : 1; // Left/Top: kết thúc lệch ÂM so với tâm 50%
        const rangePct = axis === 'x' ? bounds.panXRangePct : bounds.panYRangePct;
        const isZoomPan = direction.startsWith('zoomPan');

        if (rangePct >= SLIDESHOW_KENBURNS_MIN_MEANINGFUL_PAN_PCT) {
            // PAN THẬT bằng background-position — ảnh có "dư" pixel thật đủ dùng ở trục này.
            const mag = rand(SLIDESHOW_KENBURNS_MIN_MEANINGFUL_PAN_PCT, rangePct);
            const startPct = 50 - sign * mag, endPct = 50 + sign * mag;
            if (axis === 'x') { bgFrom = `${startPct}% 50%`; bgTo = `${endPct}% 50%`; }
            else { bgFrom = `50% ${startPct}%`; bgTo = `50% ${endPct}%`; }
        } else if (!isZoomPan) {
            // Pan-only nhưng ảnh KHÔNG có dư thật -> dự phòng overscan cố định (kỹ thuật cũ) để
            // vẫn có chuyển động, không đứng yên. SỬA (mục 2+3 phản hồi Giang) — random hoá
            // magnitude (KHÔNG dùng hằng số cố định) — vừa tránh lặp lại y hệt mọi lần, vừa biên
            // độ đủ lớn để KHÔNG trông như "thiếu" khi so với nhánh pan thật ở trên.
            scaleFrom = SLIDESHOW_KENBURNS_FALLBACK_OVERSCAN_SCALE;
            scaleTo = SLIDESHOW_KENBURNS_FALLBACK_OVERSCAN_SCALE;
            const mag = rand(SLIDESHOW_KENBURNS_FALLBACK_PAN_MIN_PCT, SLIDESHOW_KENBURNS_FALLBACK_PAN_MAX_PCT);
            if (axis === 'x') { translateFromX = -sign * mag; translateToX = sign * mag; }
            else { translateFromY = -sign * mag; translateToY = sign * mag; }
        } else {
            // zoomPan* nhưng ảnh không có dư thật trục đó -> pan NHẸ bằng translate (biên nhỏ hơn
            // pan-only vì bản thân zoom đã "che" phần rìa scale ra rồi, không cần overscan dự
            // phòng nữa — chỉ translate thêm 1 chút cho có phương hướng rõ ràng). Random hoá
            // magnitude (mục 2 phản hồi Giang) — tránh lặp lại y hệt mọi lần.
            const mag = rand(1.5, 3);
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
 * @param {number} durationMs - khớp khoảng cách giữa 2 lần đổi ảnh.
 * @returns {Animation|null}
 */
function startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs) {
    if (!panEl) return null;
    return panEl.animate(keyframes, { duration: Math.max(1000, durationMs), easing: 'ease-in-out', fill: 'forwards' });
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
