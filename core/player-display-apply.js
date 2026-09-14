/**
 * core/player-display-apply.js — Core-DOM (mirror `core/video-player.js`::setBgVideoElementForPlayerMode()
 * — Rule 2: nhận giá trị QUA THAM SỐ, KHÔNG tự `appState.get()`/`appConfigPlayerDisplay.getAll()`,
 * nhưng ĐƯỢC PHÉP đọc/ghi trực tiếp `bgVideoElement`/`visualBgImageElement`/
 * `videoPlayerMotionPointMoveElement`/`motionEngineReactLayer` (biến DOM tĩnh toàn cục từ
 * core/dom-refs.js)) — áp/gỡ Resolution (Video/Photo) + di chuyển `#bg-video` vào/ra khỏi lớp React
 * Beat DÙNG CHUNG với VBG.
 *
 * SỬA (Giang chỉ ra: "React beat, point move khi ở player áp dụng motion beat, point thì phải gán
 * lên 1 lớp cha của nó giống như cấu trúc của hệ thống visual background" — rồi "tôi tưởng motion đã
 * tách khỏi nơi tiêu thụ?" khi thấy bản đầu tạo hẳn 1 lớp cha MỚI riêng cho Video thay vì dùng lại
 * lớp CÓ SẴN của Motion Engine) — 2 hàm React Beat từng ở ĐÂY
 * (`applyVideoPlayerReactBeatTransformToDOM()`/`clearVideoPlayerReactBeatTransformFromDOM()`) ĐÃ
 * CHUYỂN HẲN sang `event/workflow/motion-beat-react-runner.js` (`createMotionBeatReactRunner()`,
 * module DÙNG CHUNG cho MỌI nơi tiêu thụ React Beat — Motion CHỈ cung cấp CƠ CHẾ [Runner], nơi tiêu
 * thụ tự quyết dùng cơ chế đó cho TARGET nào của mình, giống gọi API). File NÀY giờ giữ 2 việc:
 * Resolution (`object-fit`/`background-size`) VÀ 2 hàm MỚI `attachVideoPlayerMotionToSharedReactLayer()`/
 * `detachVideoPlayerMotionFromSharedReactLayer()` — DI CHUYỂN `videoPlayerMotionPointMoveElement`
 * (bọc `#bg-video`) vào/ra khỏi `motionEngineReactLayer` (CÓ SẴN, DÙNG CHUNG với VBG, KHÔNG tạo
 * element mới) — Motion Engine hoàn toàn KHÔNG biết/không cần biết việc di chuyển này, Runner của
 * nó chỉ hỏi `() => motionEngineReactLayer`, luôn đúng 1 element cố định.
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
    // SỬA BUG (Giang chỉ ra: "video bị lộ ảnh bg dưới khi cài resolution nhỏ hơn") — gỡ LUÔN override
    // đồng bộ ở `visualBgImageElement` (xem applyVideoPlayerResolutionToVisualBgFallbackDOM() cuối
    // file) — field NÀY cũng do Video Player mode ghi, nên cũng phải dọn cùng lúc thoát mode, đúng
    // lý do docstring đầu file (trả lại default cho VBG).
    if (visualBgImageElement) visualBgImageElement.style.backgroundSize = '';
}

/** MỚI (Giang chỉ ra bug: Photo/Video Player mode dùng CHUNG `visualBgImageElement` — lúc Next/Prev/
 * hết bài TRONG Video Player mode, `swapBgVideoSource()` (event/workflow/video-player.js) chèn 1
 * ảnh thumb full-res VÀO ĐÚNG element này làm lớp dự phòng chống nháy đen [nằm Z-INDEX THẤP HƠN
 * `bgVideoElement`, luôn bị nó che khi video phủ HẾT khung — nhưng NẾU Resolution đang cài kiểu có
 * khoảng hở, vd 'fit'/'trueMax', phần hở đó sẽ LỘ RA đúng cái thumb này, mà thumb lại luôn
 * `background-size: cover` mặc định — khác kích thước với video -> lộ ảnh không khớp]) — hàm này áp
 * ĐÚNG Resolution hiện tại của Video CHO CẢ lớp thumb dự phòng đó, để khoảng hở (nếu có) của thumb
 * KHỚP luôn với khoảng hở của video thật (cùng tỉ lệ khung hình → 2 lớp trùng khít, khoảng hở lộ ra
 * đúng màu nền đen phía sau `#visualizer-solid-bg`, KHÔNG lộ ảnh thumb sai kích thước nữa).
 *
 * `naturalWidth`/`naturalHeight` dùng `bgVideoElement.videoWidth`/`.videoHeight` (KHÔNG dùng
 * `record.width`/`.height` như Photo — Video không có field đó) — tại thời điểm gọi từ
 * `swapBgVideoSource()` (đã `pause()` nhưng CHƯA đổi `src`), 2 giá trị này vẫn PHẢN ÁNH ĐÚNG video
 * VỪA dừng (chính là video mà thumb vừa chèn là ảnh chụp lại) — trùng tỉ lệ khung hình, đúng ý.
 * @param {string} resolutionMode - appConfigPlayerDisplay.getAll().videoResolutionMode */
function applyVideoPlayerResolutionToVisualBgFallbackDOM(resolutionMode) {
    if (!visualBgImageElement) return; // core/dom-refs.js
    const containerWidth = visualBgImageElement.clientWidth || window.innerWidth;
    const containerHeight = visualBgImageElement.clientHeight || window.innerHeight;
    const naturalWidth = (bgVideoElement && bgVideoElement.videoWidth) || null;
    const naturalHeight = (bgVideoElement && bgVideoElement.videoHeight) || null;
    visualBgImageElement.style.backgroundSize = resolvePlayerBackgroundSizeCss(resolutionMode, naturalWidth, naturalHeight, containerWidth, containerHeight); // core/player-display-settings.js
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

/** SỬA (Giang chỉ ra: "React beat, point move khi ở player áp dụng motion beat, point thì phải gán
 * lên 1 lớp cha của nó giống như cấu trúc của hệ thống visual background" — rồi "tôi tưởng motion
 * đã tách khỏi nơi tiêu thụ?") — DI CHUYỂN `videoPlayerMotionPointMoveElement` (bọc `#bg-video`,
 * core/dom-refs.js) VÀO LÀM CON của `motionEngineReactLayer` (CÓ SẴN, DÙNG CHUNG với VBG — KHÔNG
 * tạo element mới) — gọi lúc VÀO Video Player mode (event/workflow/video-player.js::startFromPlaylist()).
 *
 * AN TOÀN với VBG: `clearMediaLayers()` (event/workflow/visual-bg-common.js, LUÔN chạy TRƯỚC bước
 * này trong `startFromPlaylist()`) đã gọi `workflowMotionEngine.stop()` — dọn SẠCH transform +
 * dừng hẳn Runner của VBG TRƯỚC KHI hàm này chạy, nên `motionEngineReactLayer` LUÔN ở trạng thái
 * "sạch" (transform rỗng, không task nào đang chạy) lúc Video Player mode bắt đầu dùng — không có
 * xung đột ghi `style.transform` giữa 2 bên (2 mode loại trừ nhau, KHÔNG BAO GIỜ cùng lúc dùng
 * chung element này để chạy React Beat thật). */
function attachVideoPlayerMotionToSharedReactLayer() {
    if (!motionEngineReactLayer || !videoPlayerMotionPointMoveElement) return; // core/dom-refs.js
    motionEngineReactLayer.appendChild(videoPlayerMotionPointMoveElement);
}

/** Trả `videoPlayerMotionPointMoveElement` VỀ ĐÚNG vị trí "nhà" gốc (đo lúc boot, trước khi bất kỳ
 * ai di chuyển gì — `videoPlayerMotionPointMoveHomeParent`/`HomeNextSibling`, core/dom-refs.js) —
 * gọi lúc THOÁT Video Player mode (event/workflow/video-player.js::exitVideoPlayerMode()) — BẮT
 * BUỘC, TRƯỚC khi `workflowVisualBg.applyCurrentVisualBg()` tái sử dụng `motionEngineReactLayer`
 * cho chính VBG — nếu không, `#bg-video` (đã ẩn qua `setBgVideoElementForPlayerMode(false)`, vô
 * hại về mặt hiển thị) vẫn còn kẹt làm con của layer đó mãi mãi, rò rỉ cấu trúc DOM không cần thiết. */
function detachVideoPlayerMotionFromSharedReactLayer() {
    if (!videoPlayerMotionPointMoveElement || !videoPlayerMotionPointMoveHomeParent) return; // core/dom-refs.js
    videoPlayerMotionPointMoveHomeParent.insertBefore(videoPlayerMotionPointMoveElement, videoPlayerMotionPointMoveHomeNextSibling);
}
