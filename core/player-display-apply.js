/**
 * core/player-display-apply.js — ghi DOM của Resolution + Motion cho Video Player mode lên các phần tử tĩnh dùng chung với
 * VBG (core/dom-refs.js: `bgVideoElement`, `visualBgImageElement`, `videoPlayerMotionPointMoveElement`,
 * `motionEngineReactLayer`). Nhận giá trị qua tham số; chuỗi CSS do Workflow tính (core/player-display-settings.js).
 *
 * Video Player dùng mô hình 2 layer A/B của VBG: layer A `bgVideoElement` (nội dung thật, CSS `object-fit`), layer B
 * `visualBgImageElement` (khung hình tĩnh chống nháy đen lúc swap video, CSS `background-size`) — cùng 1 mode Resolution.
 * Motion: layer B làm con của `videoPlayerMotionPointMoveElement` (bọc layer A — Point Move di chuyển cả 2 như 1 khối), cả
 * wrapper làm con của `motionEngineReactLayer` (nhận React Beat). Thoát mode BẮT BUỘC gỡ override + trả phần tử về "nhà",
 * không thì VBG hiển thị sai.
 *
 * Photo Player hiện qua Image surface dùng chung (event/workflow/visual-bg-photo-motion.js) — ở đây chỉ đo khung
 * (measurePhotoPlayerContainer()).
 *
 * NẠP SAU: core/dom-refs.js. NẠP TRƯỚC: event/workflow/player-display-settings.js, event/workflow/video-player.js.
 */

/** Áp Resolution lên layer A (`<video>`) — lúc vào Video Player mode + mỗi lần Settings đổi trong mode (Next/Prev không
 * cần: `object-fit` tự tính theo video hiện tại). @param {string} objectFitCss - resolvePlayerObjectFitCss() */
function applyVideoPlayerResolutionToDOM(objectFitCss) {
    if (!bgVideoElement) return; // core/dom-refs.js
    bgVideoElement.style.objectFit = objectFitCss;
}

/** Gỡ override Resolution khỏi CẢ 2 layer lúc thoát Video Player mode — CSS tĩnh mặc định (`cover`) quay lại cho VBG. */
function clearVideoPlayerResolutionFromDOM() {
    if (!bgVideoElement) return;
    bgVideoElement.style.objectFit = '';
    if (visualBgImageElement) visualBgImageElement.style.backgroundSize = '';
}

/** Số đo để tính `background-size` của layer B: khung (0 khi đang ẩn -> viewport) + kích thước gốc của video có thumb đang ở
 * layer B — `naturalSize` của record video MỚI khi gọi từ hook swap (lúc đó `bgVideoElement` còn là video CŨ); bỏ trống
 * (vào mode / đổi Settings) -> đọc `bgVideoElement.videoWidth/Height`.
 * @param {{width: (number|null), height: (number|null)}} [naturalSize]
 * @returns {{naturalWidth: (number|null), naturalHeight: (number|null), containerWidth: number, containerHeight: number}} */
function measureVideoPlayerLayerB(naturalSize) {
    return {
        naturalWidth: naturalSize ? naturalSize.width : ((bgVideoElement && bgVideoElement.videoWidth) || null),
        naturalHeight: naturalSize ? naturalSize.height : ((bgVideoElement && bgVideoElement.videoHeight) || null),
        containerWidth: (visualBgImageElement && visualBgImageElement.clientWidth) || window.innerWidth,
        containerHeight: (visualBgImageElement && visualBgImageElement.clientHeight) || window.innerHeight,
    };
}

/** Áp Resolution lên layer B — phải cùng mode với layer A (lệch thì lộ khoảng hở khi swap). Mỗi lần nội dung layer B đổi
 * phải tính lại. @param {string} backgroundSizeCss - resolvePlayerBackgroundSizeCss() */
function applyVideoPlayerResolutionToLayerBDOM(backgroundSizeCss) {
    if (!visualBgImageElement) return; // core/dom-refs.js
    visualBgImageElement.style.backgroundSize = backgroundSizeCss;
}

/** Khung chứa 2 layer ảnh của Image surface (`visualBgPhotoMotionContainer`) — dùng tính `background-size` ảnh Player Photo /
 * VBG Photo; đang ẩn (0) -> viewport. @returns {{width: number, height: number}} */
function measurePhotoPlayerContainer() {
    return {
        width: (visualBgPhotoMotionContainer && visualBgPhotoMotionContainer.clientWidth) || window.innerWidth, // core/dom-refs.js
        height: (visualBgPhotoMotionContainer && visualBgPhotoMotionContainer.clientHeight) || window.innerHeight,
    };
}

/** Vào Video Player mode: wrapper Point Move (bọc layer A) vào `motionEngineReactLayer`, layer B vào trong wrapper (ngang
 * hàng layer A). Gán `.motion-layer` cho 2 layer (thiếu thì z-index promotion `.me-layer-enter` của Transition không áp —
 * assets/css/motion-engine.css) + `.me-current` cho layer A. An toàn với VBG: `clearMediaLayers()` đã dừng Runner VBG và ẩn
 * layer B trước bước này (2 mode loại trừ nhau). */
function attachVideoPlayerMotionToSharedReactLayer() {
    if (!motionEngineReactLayer || !videoPlayerMotionPointMoveElement) return;
    motionEngineReactLayer.appendChild(videoPlayerMotionPointMoveElement);
    if (visualBgImageElement) {
        videoPlayerMotionPointMoveElement.appendChild(visualBgImageElement);
        visualBgImageElement.classList.add('motion-layer');
    }
    if (bgVideoElement) bgVideoElement.classList.add('motion-layer', 'me-current');
}

/** Thoát Video Player mode: gỡ `.motion-layer` (Workflow đã gỡ 3 class trạng thái Transition qua
 * resetMotionEngineLayerClasses() trước) rồi trả wrapper + layer B về vị trí "nhà" đo lúc boot — BẮT BUỘC trước khi VBG tái
 * dùng 2 phần tử (không thì `bgVideoElement` kẹt `opacity:0` của `.motion-layer`). */
function detachVideoPlayerMotionFromSharedReactLayer() {
    if (bgVideoElement) bgVideoElement.classList.remove('motion-layer');
    if (visualBgImageElement) visualBgImageElement.classList.remove('motion-layer');
    if (videoPlayerMotionPointMoveElement && videoPlayerMotionPointMoveHomeParent) {
        videoPlayerMotionPointMoveHomeParent.insertBefore(videoPlayerMotionPointMoveElement, videoPlayerMotionPointMoveHomeNextSibling); // core/dom-refs.js
    }
    if (visualBgImageElement && visualBgImageHomeParent) {
        visualBgImageHomeParent.insertBefore(visualBgImageElement, visualBgImageHomeNextSibling); // core/dom-refs.js
    }
}
