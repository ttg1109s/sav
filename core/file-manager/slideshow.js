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
 *     tự gọi `setSlideshowLayerImage()`/`applySlideshowKenBurns()` bên trong — VI PHẠM CẢ HAI theo
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

/** Giá trị `transform` ở đúng keyframe `to` của mỗi variant (assets/css/slideshow.css) — dùng bởi
 * `freezeSlideshowKenBurnsEndState()` để "đóng băng" ĐÚNG vị trí cuối bằng inline style. Đổi 1 chỗ
 * (CSS keyframe) PHẢI đổi luôn chỗ kia (bảng này) — 2 nơi phải khớp nhau tuyệt đối. */
const SLIDESHOW_KENBURNS_END_TRANSFORMS = {
    'ss-kenburns-1': 'scale(1.12) translate(-2.5%, -2.5%)',
    'ss-kenburns-2': 'scale(1.12) translate(2.5%, 2.5%)',
    'ss-kenburns-3': 'scale(1) translate(0, 0)',
    'ss-kenburns-4': 'scale(1) translate(0, 0)',
};

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
        layerEl.style.transform = ''; // dọn luôn transform "đóng băng" nếu freezeSlideshowKenBurnsEndState() đã set trước đó
    }
}

/**
 * Core thuần: "ĐÓNG BĂNG" trạng thái CUỐI của hiệu ứng Ken Burns bằng INLINE STYLE thay vì tiếp
 * tục dựa vào CSS `animation-fill-mode: forwards` giữ hộ.
 *
 * LÝ DO (fix bug 04/07/2026, mục 6 phản hồi Giang: "zoom pan đến xy nhưng khi kết thúc thì nó lại
 * nhảy về xy gốc") — thay vì cố xác định CHÍNH XÁC vì sao `animation-fill-mode: forwards` không
 * giữ được trạng thái cuối lúc animation tự hết `animation-duration` (nghi vấn hợp lý nhất:
 * `.ss-kenburns` khai `animation-fill-mode`, còn `animation-name` khai riêng ở
 * `.ss-kenburns-1..4` — 2 rule cùng specificity nhưng khác thuộc tính, VỀ LÝ THUYẾT vẫn phải hợp
 * nhất đúng, nhưng thực tế observed lại nhảy — không đáng tin cậy 100% qua mọi trình duyệt/thiết
 * bị), giải pháp CHẮC CHẮN ĐÚNG hơn: gọi hàm này NGAY KHI hết đúng `durationMs` (Workflow tự
 * `taskManager.once()` lịch đúng thời điểm, xem event/workflow/slideshow.js) để tự tay set
 * `transform` bằng INLINE STYLE (đè lên MỌI animation/class, không phụ thuộc `fill-mode` gì nữa)
 * = ĐÚNG giá trị `to` của keyframe variant đó (tra `SLIDESHOW_KENBURNS_END_TRANSFORMS`) + gỡ hẳn
 * animation (đổi classList) — từ thời điểm này layer đứng yên ở đúng vị trí cuối, không animation
 * nào chạy nữa nên không còn gì có thể "nhảy" được nữa.
 * @param {HTMLElement} layerEl
 * @param {string} variant - ĐÚNG variant đã dùng lúc applySlideshowKenBurns(..., true, ..., variant)
 */
function freezeSlideshowKenBurnsEndState(layerEl, variant) {
    if (!layerEl) return;
    layerEl.classList.remove('ss-kenburns', ...SLIDESHOW_KENBURNS_VARIANTS);
    layerEl.style.animationDuration = '';
    const endTransform = SLIDESHOW_KENBURNS_END_TRANSFORMS[variant];
    if (endTransform) layerEl.style.transform = endTransform;
}

/**
 * Core thuần: bắt đầu 1 lượt chuyển cảnh — CHỈ phần tức thời (đổi class ngay lập tức).
 *
 * VIẾT LẠI (04/07/2026, phản hồi Giang mục 3 — Rule 3 siết chặt: CẤM TUYỆT ĐỐI `taskManager`
 * trong core + CẤM TUYỆT ĐỐI core gọi core khác). Bản cũ `beginSlideshowTransition()` tự gọi
 * `taskManager.once()` rồi bên trong callback tự gọi `setSlideshowLayerImage()`/
 * `applySlideshowKenBurns()` — VI PHẠM CẢ HAI. Tách thành 2 hàm ĐỘC LẬP (hàm này + `finish...`
 * dưới), KHÔNG hàm nào gọi hàm kia hay gọi taskManager — Workflow
 * (event/workflow/slideshow.js::_tick()) tự `taskManager.once()` + tự gọi TỪNG hàm core cần thiết
 * (kể cả `setSlideshowLayerImage()`/`applySlideshowKenBurns()` cho outgoing layer) theo đúng thứ
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
 * `applySlideshowKenBurns(outgoingLayerEl, false, 0)` riêng (xem comment
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
 * Core thuần: dọn class DOM của 1 layer về trạng thái nghỉ (KHÔNG đụng ảnh/Ken Burns — Workflow tự
 * gọi riêng `setSlideshowLayerImage()`/`applySlideshowKenBurns()` cho từng layer, xem
 * event/workflow/slideshow.js::stop() — Rule 3 CẤM hàm này tự gọi 2 hàm đó nội bộ).
 * @param {HTMLElement} layerEl
 */
function resetSlideshowLayerClasses(layerEl) {
    if (!layerEl) return;
    layerEl.classList.remove('ss-current', 'ss-layer-enter', 'ss-layer-exit');
}
