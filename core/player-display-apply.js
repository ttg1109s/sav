/**
 * core/player-display-apply.js — Core-DOM (mirror `core/video-player.js`::setBgVideoElementForPlayerMode()
 * — Rule 2: nhận giá trị QUA THAM SỐ, KHÔNG tự `appState.get()`/`appConfigPlayerDisplay.getAll()`,
 * nhưng ĐƯỢC PHÉP đọc/ghi trực tiếp `bgVideoElement`/`visualBgImageElement`/
 * `videoPlayerMotionPointMoveElement`/`motionEngineReactLayer` (biến DOM tĩnh toàn cục từ
 * core/dom-refs.js)) — áp Resolution + di chuyển vào/ra khỏi lớp React Beat DÙNG CHUNG với VBG.
 *
 * SỬA (Giang chỉ ra: "khi ở player video thì video và bg image được coi là layer A, layer B, mô
 * hình giống hệt VBG" — bản trước gọi `visualBgImageElement` là "thumb dự phòng", NGỤ Ý nó là 1 thứ
 * PHỤ, khác hẳn `bgVideoElement` — SAI khung hình dung) — Video Player mode dùng ĐÚNG mô hình 2 layer
 * NGANG HÀNG như VBG (`motionEngineLayer1`/`motionEngineLayer2`), CHỈ khác: VBG có 2 layer THẬT SỰ
 * độc lập (mỗi layer giữ 1 ảnh khác nhau, luân phiên vai trò để crossfade — xem event/workflow/
 * motion-transition-runner.js), còn ở đây "layer A" (`bgVideoElement`, nội dung THẬT, luôn hiện) và
 * "layer B" (`visualBgImageElement`, TÁI DÙNG với VBG) chỉ có nội dung KHÁC NHAU lúc swap video
 * (layer B tạm giữ 1 khung hình tĩnh chống nháy đen) — nhưng VỀ CẤU TRÚC, CẢ 2 vẫn là 2 layer NGANG
 * HÀNG, PHẢI nhận CÙNG xử lý (CÙNG cha nhận transform Motion, CÙNG giá trị Resolution áp cho từng
 * cái) — KHÔNG phải "layer A chính, layer B chỉ là bản vá phụ".
 *
 * Resolution — tính 1 giá trị mode DUY NHẤT (`appConfigPlayerDisplay.getAll().videoResolutionMode`),
 * áp cho layer A (`object-fit`) VÀ áp CÙNG giá trị đó cho layer B (`background-size`) — 2 hàm riêng
 * CHỈ vì layer A là `<video>` (CSS `object-fit`) còn layer B là div nền (CSS `background-size`, KHÔNG
 * CÓ `object-fit`) nên cần 2 CÔNG THỨC tính khác nhau (`resolvePlayerObjectFitCss()`/
 * `resolvePlayerBackgroundSizeCss()`, core/player-display-settings.js) — GIỐNG HỆT cách VBG tính
 * `inMs`/`outMs` khác nhau cho `incomingLayer`/`outgoingLayer` (2 công thức, CÙNG 1 preset nguồn) —
 * KHÔNG phải bất thường/giới hạn gì, chỉ là 2 layer khác LOẠI phần tử DOM thì tính CSS khác cú pháp,
 * vẫn CÙNG 1 giá trị mode nguồn.
 *
 * Motion (React Beat/Point Move) — CẢ layer A LẪN layer B cùng làm con của `motionEngineReactLayer`
 * (CÓ SẴN, DÙNG CHUNG với VBG — KHÔNG tạo element mới, `attachVideoPlayerMotionToSharedReactLayer()`/
 * `detachVideoPlayerMotionFromSharedReactLayer()` cuối file) — transform áp 1 LẦN lên lớp cha là ảnh
 * hưởng CẢ 2 layer CÙNG LÚC, tự động, không cần biết gì về nhau — Motion Engine hoàn toàn KHÔNG
 * biết/không cần biết việc di chuyển này, Runner của nó chỉ hỏi `() => motionEngineReactLayer`, luôn
 * đúng 1 element cố định.
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
 * (resolvePlayerObjectFitCss()/resolvePlayerBackgroundSizeCss()), core/motion-engine.js
 * (resetMotionEngineLayerClasses() — dùng ở detachVideoPlayerMotionFromSharedReactLayer()).
 * NẠP TRƯỚC: event/workflow/player-display-settings.js, event/workflow/video-player.js.
 */

/** Áp Resolution lên layer A (`bgVideoElement`, `<video>` — CSS `object-fit`) — gọi lúc VÀO Video
 * Player mode + mỗi lần Settings đổi sống trong lúc đang ở mode (KHÔNG cần gọi lại mỗi lần
 * Next/Prev video — CSS `object-fit` trình duyệt tự tính lại theo kích thước gốc của video hiện
 * tại, không như layer B).
 * @param {string} resolutionMode - appConfigPlayerDisplay.getAll().videoResolutionMode */
function applyVideoPlayerResolutionToDOM(resolutionMode) {
    if (!bgVideoElement) return; // core/dom-refs.js
    bgVideoElement.style.objectFit = resolvePlayerObjectFitCss(resolutionMode); // core/player-display-settings.js
}

/** Gỡ override Resolution khỏi layer A (`bgVideoElement`) — gọi lúc THOÁT Video Player mode (BẮT
 * BUỘC, xem docstring đầu file) — để CSS tĩnh mặc định (`object-fit: cover`) quay lại phục vụ VBG. */
function clearVideoPlayerResolutionFromDOM() {
    if (!bgVideoElement) return;
    bgVideoElement.style.objectFit = '';
    // Gỡ LUÔN override Resolution của layer B (`visualBgImageElement`) — CÙNG lúc, CÙNG lý do (field
    // Resolution của Video Player mode ghi lên CẢ 2 layer, nên phải dọn CẢ 2 khi thoát mode).
    if (visualBgImageElement) visualBgImageElement.style.backgroundSize = '';
}

/** Áp Resolution lên layer B (`visualBgImageElement`, div nền — CSS `background-size`, KHÔNG CÓ
 * `object-fit` như layer A nên cần công thức riêng) — CÙNG `resolutionMode` với layer A, chỉ khác
 * công thức tính (`resolvePlayerBackgroundSizeCss()` thay vì `resolvePlayerObjectFitCss()`).
 *
 * Layer B TÁI DÙNG với VBG — lúc Next/Prev/hết bài trong Video Player mode, `swapBgVideoSource()`
 * (event/workflow/video-player.js) đổi nội dung layer B thành 1 khung hình tĩnh (ảnh chụp video vừa
 * dừng), giữ chỗ trong lúc video mới đang buffer (chống nháy đen). Layer B lúc đó PHẢI cùng kích
 * thước/tỉ lệ với layer A — nếu không, gọi hàm này với `resolutionMode` khác layer A (hoặc bỏ qua
 * luôn) sẽ khiến 2 layer LỆCH kích thước, lộ layer B không khớp layer A qua khoảng hở (nếu
 * Resolution đang là kiểu có khoảng hở, vd 'fit'/'trueMax').
 *
 * `naturalWidth`/`naturalHeight` dùng `bgVideoElement.videoWidth`/`.videoHeight` (KHÔNG dùng
 * `record.width`/`.height` như Photo Player mode — Video không có field đó) — tại thời điểm gọi từ
 * `swapBgVideoSource()` (đã `pause()` nhưng CHƯA đổi `src`), 2 giá trị này vẫn PHẢN ÁNH ĐÚNG video
 * VỪA dừng (chính là video mà layer B vừa chụp lại) — trùng tỉ lệ khung hình, đúng ý.
 * @param {string} resolutionMode - appConfigPlayerDisplay.getAll().videoResolutionMode, CÙNG giá
 *        trị vừa/đang áp cho layer A. */
function applyVideoPlayerResolutionToLayerBDOM(resolutionMode) {
    if (!visualBgImageElement) return; // core/dom-refs.js
    const containerWidth = visualBgImageElement.clientWidth || window.innerWidth;
    const containerHeight = visualBgImageElement.clientHeight || window.innerHeight;
    const naturalWidth = (bgVideoElement && bgVideoElement.videoWidth) || null;
    const naturalHeight = (bgVideoElement && bgVideoElement.videoHeight) || null;
    visualBgImageElement.style.backgroundSize = resolvePlayerBackgroundSizeCss(resolutionMode, naturalWidth, naturalHeight, containerWidth, containerHeight); // core/player-display-settings.js
}

/** Áp Resolution lên `visualBgImageElement` — gọi lúc mỗi lần ảnh MỚI hiện ra trong Photo Player
 * mode (vào mode lần đầu HOẶC Next/Prev — `trueMax` cần biết kích thước GỐC của ĐÚNG ảnh đang hiện,
 * KHÁC Video) + mỗi lần Settings đổi sống (dùng lại kích thước ảnh đang hiện hiện tại). Photo Player
 * mode CHỈ có 1 layer (chính ảnh đang hiện) — KHÔNG có layer A/B như Video Player mode.
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

/** Di chuyển CẢ layer A (`videoPlayerMotionPointMoveElement`, bọc `bgVideoElement`) LẪN layer B
 * (`visualBgImageElement`) VÀO LÀM CON của `motionEngineReactLayer` (CÓ SẴN, DÙNG CHUNG với VBG —
 * KHÔNG tạo element mới) — gọi lúc VÀO Video Player mode (event/workflow/video-player.js
 * ::startFromPlaylist()) — 2 layer NGANG HÀNG, CÙNG được di chuyển, CÙNG nhận transform Motion sau
 * đó (xem docstring đầu file). Layer B chèn TRƯỚC layer A (DOM order sớm hơn) — z-index -2 riêng
 * của nó (assets/css/base.css) đã tự đứng SAU trong stacking context MỚI mà `motionEngineReactLayer`
 * tạo ra, thứ tự DOM chỉ để chắc chắn thêm.
 *
 * FIX (Giang báo bug "chọn Motion cho Next/Prev nhưng Transition không kích hoạt") — TOÀN BỘ cơ
 * chế opacity/z-index của Transition (`.motion-layer`/`.me-current`/`.me-layer-enter`/
 * `.me-layer-exit`, assets/css/motion-engine.css) đọc qua class NỀN `.motion-layer` — class này
 * TRƯỚC ĐÂY chỉ hard-code sẵn trong index.html cho 2 layer RIÊNG của VBG
 * (`#visual-motion-layer-1`/`-2`), KHÔNG hề được gán cho `bgVideoElement`/`visualBgImageElement`
 * (2 layer A/B THẬT của Video Player mode, truyền thẳng vào `runTransition()` — xem
 * event/workflow/player-display-settings.js::runVideoPlayerTransition()) — thiếu `.motion-layer`
 * khiến rule z-index promotion (`.motion-layer.me-layer-enter{z-index:3}`) không bao giờ áp dụng,
 * layer ĐANG VÀO kẹt mãi ở z-index tĩnh (bgVideoElement:0/visualBgImageElement:-2, base.css) —
 * `bgVideoElement` LUÔN đè lên `visualBgImageElement` bất kể animation nào đang chạy, nên hầu hết
 * kiểu Transition (slide/wipe/zoom/flip/spin...) không thấy gì cả. Gán `.motion-layer` NGAY tại
 * đây (gỡ lại ở `detachVideoPlayerMotionFromSharedReactLayer()` — BẮT BUỘC đi cặp, xem hàm đó) +
 * `.me-current` CHỈ cho `bgVideoElement` (layer A, ĐANG là layer hiện tại lúc mới vào mode —
 * `visualBgImageElement` lúc này CHƯA có nội dung gì, giữ `.motion-layer` mặc định `opacity:0` là
 * ĐÚNG, không cần `.me-current`).
 *
 * AN TOÀN với VBG: `clearMediaLayers()` (event/workflow/visual-bg-common.js, LUÔN chạy TRƯỚC bước
 * này trong `startFromPlaylist()`) đã gọi `workflowMotionEngine.stop()` — dọn SẠCH transform + dừng
 * hẳn Runner của VBG, VÀ ẩn `visualBgImageElement` (`applyVisualBgImageToDOM(false, ...)`, core/
 * visual-bg.js) TRƯỚC KHI hàm này chạy — VBG không đang dùng CẢ `motionEngineReactLayer` LẪN
 * `visualBgImageElement` lúc này (2 mode loại trừ nhau TUYỆT ĐỐI), nên mượn cả 2 là an toàn. */
function attachVideoPlayerMotionToSharedReactLayer() {
    if (!motionEngineReactLayer) return; // core/dom-refs.js
    if (visualBgImageElement) {
        motionEngineReactLayer.appendChild(visualBgImageElement);
        visualBgImageElement.classList.add('motion-layer'); // FIX — xem docstring hàm này
    }
    if (videoPlayerMotionPointMoveElement) motionEngineReactLayer.appendChild(videoPlayerMotionPointMoveElement);
    if (bgVideoElement) bgVideoElement.classList.add('motion-layer', 'me-current'); // FIX — xem docstring hàm này
}

/** Trả CẢ layer A (`videoPlayerMotionPointMoveElement`) LẪN layer B (`visualBgImageElement`) VỀ
 * ĐÚNG vị trí "nhà" gốc của TỪNG đứa (đo lúc boot, trước khi bất kỳ ai di chuyển gì — core/dom-refs.js)
 * — gọi lúc THOÁT Video Player mode (event/workflow/video-player.js::exitVideoPlayerMode()) — BẮT
 * BUỘC, TRƯỚC khi `workflowVisualBg.applyCurrentVisualBg()` tái sử dụng CẢ `motionEngineReactLayer`
 * LẪN `visualBgImageElement` cho chính VBG — nếu không, VBG sẽ tìm `visualBgImageElement` tại vị
 * trí cũ mà không thấy (đã bị dời đi), hỏng hẳn cách VBG hiển thị ảnh nền.
 *
 * FIX (đi CẶP với `.motion-layer`/`.me-current` gán ở `attachVideoPlayerMotionToSharedReactLayer()`
 * — xem docstring hàm đó) — gỡ SẠCH `.motion-layer` + 3 class trạng thái Transition còn sót
 * (`resetMotionEngineLayerClasses()`, core/motion-engine.js) khỏi `bgVideoElement`/
 * `visualBgImageElement` TRƯỚC khi trả 2 phần tử về "nhà" — BẮT BUỘC, không thì `bgVideoElement`
 * (dùng chung với Video nền trang trí của VBG) kẹt mãi `opacity:0` mặc định của `.motion-layer`
 * (chỉ thoát nhờ trùng hợp inline `style.opacity` đang set, không phải cơ chế đúng), và
 * `visualBgImageElement` kẹt z-index promotion sai lúc VBG tái dùng lại chính layer đó cho ảnh nền
 * thật của nó. */
function detachVideoPlayerMotionFromSharedReactLayer() {
    if (bgVideoElement) {
        resetMotionEngineLayerClasses(bgVideoElement); // core/motion-engine.js — gỡ me-current/me-layer-enter/me-layer-exit còn sót
        bgVideoElement.classList.remove('motion-layer');
    }
    if (visualBgImageElement) {
        resetMotionEngineLayerClasses(visualBgImageElement); // core/motion-engine.js
        visualBgImageElement.classList.remove('motion-layer');
    }
    if (videoPlayerMotionPointMoveElement && videoPlayerMotionPointMoveHomeParent) {
        videoPlayerMotionPointMoveHomeParent.insertBefore(videoPlayerMotionPointMoveElement, videoPlayerMotionPointMoveHomeNextSibling); // core/dom-refs.js
    }
    if (visualBgImageElement && visualBgImageHomeParent) {
        visualBgImageHomeParent.insertBefore(visualBgImageElement, visualBgImageHomeNextSibling); // core/dom-refs.js
    }
}
