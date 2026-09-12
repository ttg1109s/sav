/**
 * core/player-display-apply.js — Core-DOM (mirror `core/video-player.js`::setBgVideoElementForPlayerMode()
 * — Rule 2: nhận giá trị QUA THAM SỐ, KHÔNG tự `appState.get()`/`appConfigPlayerDisplay.getAll()`,
 * nhưng ĐƯỢC PHÉP đọc/ghi trực tiếp `bgVideoElement`/`visualBgImageElement`, biến DOM tĩnh toàn cục
 * từ core/dom-refs.js) — áp/gỡ Resolution + React Beat Audio (Video, xem docstring nhóm hàm
 * `applyVideoPlayerReactBeatTransformToDOM()` cuối file — Photo không có, không có audio) THẬT lên
 * đúng 2 element Video/Photo Player mode TÁI DÙNG với Visual Background.
 *
 * CHỈ ÁP DỤNG lúc CHÍNH Video/Photo đang phát làm nội dung (Video/Photo Player mode) — 2 hàm
 * `apply*()` do event/workflow/player-display-settings.js gọi lúc VÀO mode (+ mỗi lần đổi ảnh cho
 * Photo, vì `trueMax` phụ thuộc kích thước GỐC của TỪNG ảnh) VÀ mỗi lần Settings đổi sống trong lúc
 * đang ở mode. 2 hàm `clear*()` do CHÍNH workflow đó gọi lúc THOÁT mode — BẮT BUỘC, nếu không
 * `bgVideoElement`/`visualBgImageElement` (2 element DÙNG CHUNG với Visual Background) sẽ giữ
 * NGUYÊN style override cũ, làm SAI cách VBG hiển thị dù Giang chốt "không liên quan gì tới VBG" —
 * xoá `.style.objectFit`/`.style.backgroundSize` (chuỗi rỗng) trả CSS tĩnh mặc định
 * (`object-fit: cover`/`background-size: cover`, assets/css/base.css) lại quyền cho VBG.
 *
 * NẠP SAU: core/dom-refs.js (bgVideoElement/visualBgImageElement), core/player-display-settings.js
 * (resolvePlayerObjectFitCss()/resolvePlayerBackgroundSizeCss()).
 * NẠP TRƯỚC: event/workflow/player-display-settings.js.
 */

/** Áp Resolution lên `bgVideoElement` — gọi lúc VÀO Video Player mode + mỗi lần Settings đổi
 * sống trong lúc đang ở mode (KHÔNG cần gọi lại mỗi lần Next/Prev video — CSS `object-fit` trình
 * duyệt tự tính lại theo kích thước gốc của video hiện tại, không như Photo).
 * @param {string} resolutionMode - appConfigPlayerDisplay.getAll().videoResolutionMode */
function applyVideoPlayerResolutionToDOM(resolutionMode) {
    if (!bgVideoElement) return; // core/dom-refs.js
    bgVideoElement.style.objectFit = resolvePlayerObjectFitCss(resolutionMode); // core/player-display-settings.js
}

/** Gỡ override Resolution khỏi `bgVideoElement` — gọi lúc THOÁT Video Player mode (BẮT BUỘC, xem
 * docstring đầu file) — để CSS tĩnh mặc định (`object-fit: cover`) quay lại phục vụ VBG. */
function clearVideoPlayerResolutionFromDOM() {
    if (!bgVideoElement) return;
    bgVideoElement.style.objectFit = '';
}

/** Áp Resolution lên `visualBgImageElement` — gọi lúc mỗi lần ảnh MỚI hiện ra trong Photo Player
 * mode (vào mode lần đầu HOẶC Next/Prev — `trueMax` cần biết kích thước GỐC của ĐÚNG ảnh đang hiện,
 * KHÁC Video) + mỗi lần Settings đổi sống (dùng lại kích thước ảnh đang hiện hiện tại).
 * @param {string} resolutionMode - appConfigPlayerDisplay.getAll().photoResolutionMode
 * @param {number|null|undefined} naturalWidth - record.width (ảnh đang hiện, có thể thiếu ở record cũ)
 * @param {number|null|undefined} naturalHeight - record.height */
function applyPhotoPlayerResolutionToDOM(resolutionMode, naturalWidth, naturalHeight) {
    if (!visualBgImageElement) return; // core/dom-refs.js
    const containerWidth = visualBgImageElement.clientWidth || window.innerWidth; // element .hidden lúc đo (chưa kịp bỏ class) -> 0, fallback viewport
    const containerHeight = visualBgImageElement.clientHeight || window.innerHeight;
    visualBgImageElement.style.backgroundSize = resolvePlayerBackgroundSizeCss(resolutionMode, naturalWidth, naturalHeight, containerWidth, containerHeight); // core/player-display-settings.js
}

/** Gỡ override Resolution khỏi `visualBgImageElement` — gọi lúc THOÁT Photo Player mode (BẮT BUỘC,
 * xem docstring đầu file) — để CSS tĩnh mặc định (`background-size: cover`) quay lại phục vụ VBG. */
function clearPhotoPlayerResolutionFromDOM() {
    if (!visualBgImageElement) return;
    visualBgImageElement.style.backgroundSize = '';
}

/** MỚI (Giang yêu cầu "bổ sung backend react — chỉ Video vì Photo không có audio") — áp transform
 * React Beat Audio LÊN THẲNG `bgVideoElement` (KHÁC VBG: Motion Engine áp lên `motionEngineReactLayer`,
 * 1 layer riêng CHỈ tồn tại cho slideshow ảnh nền, xem event/workflow/motion-engine.js — Video Player
 * mode không có layer trung gian nào, `bgVideoElement` CHÍNH LÀ nội dung đang hiện nên áp thẳng lên
 * nó luôn). 3 số đã tính sẵn (Rule 2 — nhận qua tham số, KHÔNG tự đọc appState/preset) do
 * event/workflow/player-display-settings.js::_tickVideoBeatReact() gọi mỗi frame, TÁI DÙNG NGUYÊN 4
 * hàm THUẦN tính toán của core/motion-engine.js (computeMotionEngineBeatReactZoomScale()/...Offset()).
 * @param {number} zoomScale - hệ số scale (1 = không zoom) @param {number} panPct - % translateX
 * @param {number} rotateDeg - độ rotate */
function applyVideoPlayerReactBeatTransformToDOM(zoomScale, panPct, rotateDeg) {
    if (!bgVideoElement) return;
    bgVideoElement.style.transform = `scale(${zoomScale}) translateX(${panPct}%) rotate(${rotateDeg}deg)`;
}

/** Gỡ transform React Beat khỏi `bgVideoElement` — gọi lúc: (1) THOÁT Video Player mode (BẮT BUỘC,
 * cùng lý do Resolution — tránh kẹt transform ảnh hưởng VBG dùng chung element), (2) preset gắn cho
 * `videoShowingPresetId` bị gỡ/tắt/xoá giữa chừng (vòng lặp tự dừng, xem event/workflow/player-
 * display-settings.js::stopVideoPlayerReactBeat()) — trả về khung hình "đứng yên" bình thường, KHÔNG
 * kẹt ở giá trị scale/pan/rotate cuối cùng trước lúc dừng. */
function clearVideoPlayerReactBeatTransformFromDOM() {
    if (!bgVideoElement) return;
    bgVideoElement.style.transform = '';
}
