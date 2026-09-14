/**
 * core/player-display-apply.js — Core-DOM (mirror `core/video-player.js`::setBgVideoElementForPlayerMode()
 * — Rule 2: nhận giá trị QUA THAM SỐ, KHÔNG tự `appState.get()`/`appConfigPlayerDisplay.getAll()`,
 * nhưng ĐƯỢC PHÉP đọc/ghi trực tiếp `bgVideoElement`/`visualBgImageElement`/
 * `videoPlayerMotionPointMoveElement`/`motionEngineReactLayer` (biến DOM tĩnh toàn cục từ
 * core/dom-refs.js)) — áp/gỡ Resolution (Video/Photo) + di chuyển CẢ `#bg-video` LẪN
 * `visualBgImageElement` (thumb dự phòng) vào/ra khỏi lớp React Beat DÙNG CHUNG với VBG.
 *
 * SỬA (Giang chỉ ra: "React beat, point move khi ở player áp dụng motion beat, point thì phải gán
 * lên 1 lớp cha của nó giống như cấu trúc của hệ thống visual background" — rồi "VBG chỉ hoạt động
 * ở Song, Video/Photo Player mode dùng `visualBgImageElement` không bao giờ tranh quyền/xung đột —
 * vậy đặt lớp cha lên trên đó có vấn đề gì?") — bản đầu chỉ di chuyển `videoPlayerMotionPointMoveElement`
 * (bọc `#bg-video`) vào `motionEngineReactLayer`, CÒN `visualBgImageElement` (thumb dự phòng chống
 * nháy đen) vẫn đứng NGOÀI — kết quả: React Beat chỉ di chuyển video, thumb đứng yên, càng LỘ RÕ
 * lệch nhau lúc animation chạy nếu Resolution đang có khoảng hở. SỬA — GIỜ CẢ 2 element cùng được
 * `attachVideoPlayerMotionToSharedReactLayer()` di chuyển vào `motionEngineReactLayer` lúc vào
 * mode, `detachVideoPlayerMotionFromSharedReactLayer()` trả VỀ ĐÚNG "nhà" gốc của TỪNG đứa lúc
 * thoát — AN TOÀN vì VBG không bao giờ dùng `visualBgImageElement` cùng lúc Video Player mode đang
 * mượn nó (2 mode loại trừ nhau tuyệt đối). Resolution (`object-fit`/`background-size`) VẪN phải
 * đồng bộ THỦ CÔNG riêng — 2 CSS property khác hẳn nhau giữa <video>/div nền, DOM lồng chung cha
 * KHÔNG tự giải quyết được sự khác biệt kích thước NÀY, chỉ giải quyết được việc TRANSFORM (React
 * Beat/Point Move) áp CHUNG cho cả 2 — Motion Engine hoàn toàn KHÔNG biết/không cần biết việc di
 * chuyển này, Runner của nó chỉ hỏi `() => motionEngineReactLayer`, luôn đúng 1 element cố định.
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
 * NẠP SAU: core/dom-refs.js (bgVideoElement/visualBgImageElement/videoPlayerMotionPointMoveElement/
 * visualBgImageHomeParent,NextSibling/videoPlayerMotionPointMoveHomeParent,NextSibling/
 * motionEngineReactLayer), core/player-display-settings.js
 * (resolvePlayerObjectFitCss()/resolvePlayerBackgroundSizeCss()).
 * NẠP TRƯỚC: event/workflow/player-display-settings.js, event/workflow/video-player.js.
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

/** SỬA (Giang chỉ ra: "VBG chỉ hoạt động ở Song, Video/Photo Player mode dùng `visualBgImageElement`
 * không bao giờ tranh quyền/xung đột — vậy đặt lớp cha lên trên đó có vấn đề gì?") — DI CHUYỂN CẢ 2
 * `videoPlayerMotionPointMoveElement` (bọc `#bg-video`) LẪN `visualBgImageElement` (lớp thumb dự
 * phòng chống nháy đen, core/dom-refs.js) VÀO LÀM CON của `motionEngineReactLayer` (CÓ SẴN, DÙNG
 * CHUNG với VBG — KHÔNG tạo element mới) — gọi lúc VÀO Video Player mode (event/workflow/
 * video-player.js::startFromPlaylist()). `visualBgImageElement` chèn TRƯỚC (DOM order sớm hơn) —
 * z-index -2 riêng của nó (assets/css/base.css) đã tự đứng SAU video trong stacking context MỚI mà
 * `motionEngineReactLayer` tạo ra, thứ tự DOM chỉ để chắc chắn thêm (không phụ thuộc z-index parse
 * đúng hay không) — thumb LUÔN núp sau video, đúng vai trò "dự phòng chống nháy đen" của nó.
 *
 * CẢ 2 giờ CÙNG NHẬN transform React Beat/Point Move (giai đoạn sau) của Video Player mode — KHÔNG
 * còn lệch nhau lúc animation chạy (bug Giang chỉ ra trước đó: transform chỉ di chuyển video, thumb
 * đứng yên) — Resolution (`object-fit`/`background-size`) vẫn phải đồng bộ THỦ CÔNG riêng (2 CSS
 * property khác hẳn nhau giữa <video> và div nền background-image, DOM lồng nhau không tự giải
 * quyết được sự khác biệt NÀY, xem applyVideoPlayerResolutionToVisualBgFallbackDOM() bên dưới) —
 * nhưng giờ 2 lớp DI CHUYỂN CÙNG NHAU nên khoảng hở (nếu có do Resolution) không còn bị transform
 * kéo lệch pha giữa 2 lớp nữa.
 *
 * AN TOÀN với VBG: `clearMediaLayers()` (event/workflow/visual-bg-common.js, LUÔN chạy TRƯỚC bước
 * này trong `startFromPlaylist()`) đã gọi `workflowMotionEngine.stop()` — dọn SẠCH transform +
 * dừng hẳn Runner của VBG TRƯỚC KHI hàm này chạy, nên `motionEngineReactLayer` LUÔN ở trạng thái
 * "sạch" (transform rỗng, không task nào đang chạy) lúc Video Player mode bắt đầu dùng — không có
 * xung đột ghi `style.transform` giữa 2 bên (2 mode loại trừ nhau, KHÔNG BAO GIỜ cùng lúc dùng
 * chung element này để chạy React Beat thật) — VÀ VBG cũng KHÔNG đang hiển thị `visualBgImageElement`
 * lúc này (clearMediaLayers() đã ẩn nó qua applyVisualBgImageToDOM(false, ...), core/visual-bg.js),
 * nên mượn nó đi là hoàn toàn an toàn. */
function attachVideoPlayerMotionToSharedReactLayer() {
    if (!motionEngineReactLayer) return; // core/dom-refs.js
    if (visualBgImageElement) motionEngineReactLayer.appendChild(visualBgImageElement);
    if (videoPlayerMotionPointMoveElement) motionEngineReactLayer.appendChild(videoPlayerMotionPointMoveElement);
}

/** Trả CẢ 2 `videoPlayerMotionPointMoveElement`/`visualBgImageElement` VỀ ĐÚNG vị trí "nhà" gốc của
 * TỪNG đứa (đo lúc boot, trước khi bất kỳ ai di chuyển gì — core/dom-refs.js) — gọi lúc THOÁT Video
 * Player mode (event/workflow/video-player.js::exitVideoPlayerMode()) — BẮT BUỘC, TRƯỚC khi
 * `workflowVisualBg.applyCurrentVisualBg()` tái sử dụng CẢ `motionEngineReactLayer` LẪN
 * `visualBgImageElement` cho chính VBG — nếu không, VBG sẽ tìm `visualBgImageElement` tại vị trí cũ
 * mà không thấy (đã bị dời đi), hỏng hẳn cách VBG hiển thị ảnh nền. */
function detachVideoPlayerMotionFromSharedReactLayer() {
    if (videoPlayerMotionPointMoveElement && videoPlayerMotionPointMoveHomeParent) {
        videoPlayerMotionPointMoveHomeParent.insertBefore(videoPlayerMotionPointMoveElement, videoPlayerMotionPointMoveHomeNextSibling); // core/dom-refs.js
    }
    if (visualBgImageElement && visualBgImageHomeParent) {
        visualBgImageHomeParent.insertBefore(visualBgImageElement, visualBgImageHomeNextSibling); // core/dom-refs.js
    }
}
