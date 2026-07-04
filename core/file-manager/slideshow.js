/**
 * core/file-manager/slideshow.js — Slideshow nền Visual (nguồn nền thứ 3, cạnh ảnh tĩnh/video —
 * xem core/state-and-video-bg.js), Batch 8, ver 12 "Multi Media"
 * (plan-v12-multimedia.md mục 4.b3 + plan-v12-multimedia-update-3.md mục 1.2/2.4).
 *
 * CHỈ chứa hàm THUẦN, tuân đủ core-function-conventions.md Rule 1-4:
 *   - Rule 1 (đơn tuyến): "chọn ảnh kế tiếp" theo sequential/random là 2 TIẾN TRÌNH khác nhau ->
 *     TÁCH RIÊNG 2 hàm (pickNextSlideshowIndexSequential/Random), KHÔNG gộp 1 hàm rồi if/else theo
 *     tham số `mode` (đúng ví dụ "SAI" handleUpload(file, isVideo) ở core-function-conventions.md).
 *   - Rule 2 (không tự đọc appState): mọi hàm nhận objectUrl/transitionType/durationMs/index qua
 *     THAM SỐ — nơi gọi (event/workflow/slideshow.js) tự appState.get() trước.
 *   - Rule 3 (core gọi core): beginSlideshowTransition() gọi taskManager.once() BẤT ĐỒNG BỘ và
 *     KHÔNG await -> ngoại lệ hợp lệ (không tạo phụ thuộc thứ tự), được giữ trong core.
 *   - Rule 4: file này không tự appState.set()/mutate() (chỉ thao tác DOM thuần) -> N/A.
 *
 * ORCHESTRATION THẬT (đọc appState.slideshowConfig/activeBackgroundAlbum, đọc DB album/ảnh, quản
 * lý task lặp qua taskManager, pause/resume theo vizConfig.videoBgEnabled) sống ở
 * event/workflow/slideshow.js — KHÔNG đặt ở đây (workflow được phép đọc appState trực tiếp, core
 * thì không — xem comment đầu file đó).
 *
 * DOM: 2 lớp ảnh xen kẽ #visual-slideshow-layer-1/2 (index.html) trong #visual-slideshow-container
 * (z-index -1, mốc đã chừa sẵn ở assets/css/style.css) — animation 13 kiểu transition ở
 * assets/css/slideshow.css, chọn qua thuộc tính [data-transition] gán trên container.
 *
 * NẠP SAU: core/task-manager.js (taskManager, dùng trong beginSlideshowTransition()). KHÔNG phụ
 * thuộc DOM refs cụ thể nào (mọi phần tử nhận qua tham số) nên không có ràng buộc thứ tự nào khác.
 */

/** Thời lượng 1 lượt chuyển cảnh (ms) — PHẢI khớp animation-duration ở assets/css/slideshow.css
 * (`.ss-layer-enter`/`.ss-layer-exit`) — đổi 1 chỗ phải đổi luôn chỗ kia. */
const SLIDESHOW_TRANSITION_DURATION_MS = 900;

/** 13 kiểu transition hợp lệ (plan-v12-multimedia.md mục 4.b3: 7 cơ bản + 6 mở rộng) — dùng để
 * validate config đã lưu (phòng giá trị hỏng/cũ) và đổ vào <select> Settings Drawer. */
const SLIDESHOW_TRANSITION_TYPES = [
    'fade', 'slideLeft', 'slideRight', 'zoomIn', 'zoomOut', 'wipe', 'flip',
    'kenburns', 'blur', 'rotateFade', 'curtain', 'circleReveal', 'glitch',
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

/** 4 biến thể hướng pan/zoom Ken Burns (mục 4 phản hồi Giang: bản cũ CHỈ 1 hướng cố định — luôn
 * scale nhẹ + đẩy về góc trên-trái, linear, "đơ"/máy móc). Mỗi lần 1 ảnh trở thành "current", chọn
 * NGẪU NHIÊN 1 trong 4 để cảm giác sống động, không lặp lại y hệt liên tục. CSS tương ứng ở
 * assets/css/slideshow.css (`.ss-kenburns-1`..`.ss-kenburns-4`, `ease-in-out` thay vì `linear`). */
const SLIDESHOW_KENBURNS_VARIANTS = ['ss-kenburns-1', 'ss-kenburns-2', 'ss-kenburns-3', 'ss-kenburns-4'];

/**
 * Core thuần: chọn NGẪU NHIÊN 1 trong 4 biến thể Ken Burns — TÁCH RIÊNG khỏi
 * applySlideshowKenBurns() (Rule 1: "chọn biến thể" và "áp dụng" là 2 việc khác nhau; hàm áp dụng
 * nhận biến thể qua tham số, không tự chọn bên trong).
 * @returns {string} 1 trong 4 class ở SLIDESHOW_KENBURNS_VARIANTS.
 */
function pickRandomSlideshowKenBurnsVariant() {
    return SLIDESHOW_KENBURNS_VARIANTS[Math.floor(Math.random() * SLIDESHOW_KENBURNS_VARIANTS.length)];
}

/**
 * Core thuần: bật/tắt hiệu ứng Ken Burns (pan/zoom chậm SUỐT thời gian hiển thị — khác transition
 * lúc đổi cảnh) trên 1 layer. `durationMs` khớp khoảng cách giữa 2 lần đổi
 * (slideshowConfig.intervalSeconds * 1000) để pan/zoom "vừa khít" đúng 1 chu kỳ hiển thị.
 * `variant` (1 trong SLIDESHOW_KENBURNS_VARIANTS, do nơi gọi chọn qua
 * pickRandomSlideshowKenBurnsVariant() — Rule 2: nhận qua tham số, không tự chọn ở đây).
 */
function applySlideshowKenBurns(layerEl, active, durationMs, variant) {
    if (!layerEl) return;
    if (active) {
        layerEl.style.animationDuration = `${Math.max(1000, durationMs)}ms`;
        layerEl.classList.remove(...SLIDESHOW_KENBURNS_VARIANTS);
        layerEl.classList.add('ss-kenburns', variant && SLIDESHOW_KENBURNS_VARIANTS.includes(variant) ? variant : SLIDESHOW_KENBURNS_VARIANTS[0]);
    } else {
        layerEl.classList.remove('ss-kenburns', ...SLIDESHOW_KENBURNS_VARIANTS);
        layerEl.style.animationDuration = '';
    }
}

/**
 * Core thuần: thực hiện 1 lượt chuyển cảnh — layer đang ẩn (`incomingLayerEl`, ĐÃ được set ảnh
 * mới qua setSlideshowLayerImage() TRƯỚC khi gọi hàm này) chuyển sang "current", layer đang hiện
 * (`outgoingLayerEl`) rời khỏi "current" rồi tự dọn sạch sau `durationMs`.
 *
 * Gọi taskManager.once() BẤT ĐỒNG BỘ và KHÔNG await — NGOẠI LỆ Rule 3
 * (core-function-conventions.md: "gọi bất đồng bộ và KHÔNG chờ" không tạo phụ thuộc thứ tự nên
 * KHÔNG tính là Workflow, được giữ trong core).
 * @param {HTMLElement} outgoingLayerEl - layer đang có class 'ss-current'.
 * @param {HTMLElement} incomingLayerEl - layer đang ẩn, ĐÃ được set ảnh mới.
 * @param {number} durationMs
 */
function beginSlideshowTransition(outgoingLayerEl, incomingLayerEl, durationMs) {
    if (!outgoingLayerEl || !incomingLayerEl) return;
    incomingLayerEl.classList.add('ss-layer-enter');
    outgoingLayerEl.classList.remove('ss-current');
    outgoingLayerEl.classList.add('ss-layer-exit');
    taskManager.once(() => {
        outgoingLayerEl.classList.remove('ss-layer-exit');
        setSlideshowLayerImage(outgoingLayerEl, '');
        applySlideshowKenBurns(outgoingLayerEl, false, 0);
        incomingLayerEl.classList.remove('ss-layer-enter');
        incomingLayerEl.classList.add('ss-current');
    }, durationMs, 'slideshowTransitionCleanup');
}

/**
 * Core thuần: hiện/ẩn panel chọn Album (Batch 9, mục 4) — CÙNG kiểu animation với
 * #visualizer-control-center (scale-0/opacity-0 <-> bỏ, xem core/state-and-video-bg.js::
 * openControlCenter/closeControlCenter). 2 phần tử riêng (overlay mờ phía sau + panel nổi) vì
 * panel này có thể mở TỪ Slideshow Settings Drawer (đã là 1 lớp overlay khác) — cần lớp overlay
 * riêng để bắt sự kiện "bấm ra ngoài -> đóng" mà không đóng nhầm luôn cả Settings Drawer bên dưới.
 * @param {HTMLElement} overlayEl
 * @param {HTMLElement} panelEl
 * @param {boolean} visible
 */
function setSlideshowAlbumPickerVisible(overlayEl, panelEl, visible) {
    if (!overlayEl || !panelEl) return;
    if (visible) {
        overlayEl.classList.remove('hidden');
        panelEl.classList.remove('scale-0', 'opacity-0');
    } else {
        overlayEl.classList.add('hidden');
        panelEl.classList.add('scale-0', 'opacity-0');
    }
}

/**
 * Core thuần: dọn sạch DOM của 2 layer về trạng thái nghỉ hoàn toàn (dùng khi dừng hẳn engine —
 * đổi/tắt album, xem event/workflow/slideshow.js::stop()).
 * @param {HTMLElement[]} layerEls
 */
function resetSlideshowLayers(layerEls) {
    layerEls.forEach((layerEl) => {
        if (!layerEl) return;
        setSlideshowLayerImage(layerEl, '');
        applySlideshowKenBurns(layerEl, false, 0);
        layerEl.classList.remove('ss-current', 'ss-layer-enter', 'ss-layer-exit');
    });
}
