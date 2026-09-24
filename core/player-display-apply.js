/**
 * core/player-display-apply.js — Core-DOM (mirror `core/video-player.js`::setBgVideoElementForPlayerMode()
 * — Rule 2: nhận giá trị QUA THAM SỐ, KHÔNG tự `appState.get()`/`appConfigPlayerDisplay.getAll()`,
 * nhưng ĐƯỢC PHÉP đọc/ghi trực tiếp `bgVideoElement`/`visualBgImageElement`/
 * `videoPlayerMotionPointMoveElement`/`motionEngineReactLayer` (biến DOM tĩnh toàn cục từ
 * core/dom-refs.js)) — áp Resolution + di chuyển vào/ra khỏi lớp Motion DÙNG CHUNG với VBG.
 *
 * Video Player mode dùng ĐÚNG mô hình 2 layer A/B của VBG: "layer A" (`bgVideoElement`, nội dung
 * thật, luôn hiện) và "layer B" (`visualBgImageElement`, TÁI DÙNG với VBG, tạm giữ khung hình tĩnh
 * chống nháy đen lúc swap video). Resolution tính 1 giá trị mode DUY NHẤT
 * (`appConfigPlayerDisplay.getAll().videoResolutionMode`), áp cho layer A (`object-fit`) và layer B
 * (`background-size`) qua 2 công thức khác nhau (`resolvePlayerObjectFitCss()`/
 * `resolvePlayerBackgroundSizeCss()`, core/player-display-settings.js — chỉ khác cú pháp CSS theo
 * loại phần tử, cùng 1 giá trị mode nguồn).
 *
 * Motion (Point Move/React Beat) — layer B làm con của `videoPlayerMotionPointMoveElement` (bọc
 * layer A, CÙNG cấu trúc `.me-pointmove-players` của VBG-Photo — Point Move áp 1 lần lên đúng phần
 * tử này ảnh hưởng CẢ 2 layer cùng lúc như 1 khối cứng), rồi CẢ wrapper đó làm con của
 * `motionEngineReactLayer` (CÓ SẴN, DÙNG CHUNG với VBG — KHÔNG tạo element mới, xem
 * `attachVideoPlayerMotionToSharedReactLayer()`/`detachVideoPlayerMotionFromSharedReactLayer()`
 * cuối file) để nhận thêm transform React Beat. Motion Engine hoàn toàn KHÔNG biết việc di chuyển
 * này — Runner của nó chỉ hỏi `() => motionEngineReactLayer`/`() => videoPlayerMotionPointMoveElement`,
 * luôn đúng 1 element cố định.
 *
 * CHỈ ÁP DỤNG lúc CHÍNH Video/Photo đang phát làm nội dung (Video/Photo Player mode) — 2 hàm
 * `apply*()` do event/workflow/player-display-settings.js gọi lúc VÀO mode (+ mỗi lần đổi ảnh cho
 * Photo, vì `trueMax` phụ thuộc kích thước GỐC của TỪNG ảnh) VÀ mỗi lần Settings đổi sống trong lúc
 * đang ở mode. 2 hàm `clear*()` do CHÍNH workflow đó gọi lúc THOÁT mode — BẮT BUỘC, nếu không
 * `bgVideoElement`/`visualBgImageElement` (2 element DÙNG CHUNG với Visual Background) sẽ giữ
 * NGUYÊN style override cũ, làm SAI cách VBG hiển thị — xoá `.style.objectFit`/`.style.backgroundSize`
 * (chuỗi rỗng) trả CSS tĩnh mặc định (`object-fit: cover`/`background-size: cover`,
 * assets/css/base.css) lại quyền cho VBG.
 *
 * SỬA (25/09/2026, đợt 3 Motion) — PHOTO không còn áp/gỡ gì lên `visualBgImageElement` (Player Photo giờ hiện
 * qua Image surface dùng chung, event/workflow/visual-bg-photo-motion.js): 2 hàm Photo apply/clear ĐÃ XOÁ, thay
 * bằng `computePhotoPlayerBackgroundSizeCss()` CHỈ TÍNH chuỗi `background-size` — phần "apply/clear" ở trên từ
 * nay CHỈ còn đúng cho VIDEO.
 *
 * NẠP SAU: core/dom-refs.js (bgVideoElement/visualBgImageElement/videoPlayerMotionPointMoveElement/visualBgPhotoMotionContainer/
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

/** SỬA (25/09/2026, đợt 3 Motion — Player Photo chuyển sang Image surface dùng chung, event/workflow/visual-bg-
 * photo-motion.js) — THAY `applyPhotoPlayerResolutionToDOM()`/`clearPhotoPlayerResolutionFromDOM()` (từng áp/gỡ
 * thẳng `background-size` trên `visualBgImageElement` — Player Photo KHÔNG còn dùng element đó nữa). Giờ CHỈ
 * TÍNH chuỗi `background-size` cho 1 ảnh, việc áp lên ĐÚNG layer (2 layer A/B luân phiên, mỗi layer 1 ảnh với
 * kích thước gốc RIÊNG — `trueMax`) do surface làm (option `backgroundSize` của `showImage()`). Không còn gì
 * cần "gỡ" lúc thoát mode — surface tự xoá `background-size` khi dừng.
 * Đo khung theo `visualBgPhotoMotionContainer` (khung CHỨA 2 layer ảnh); đang ẩn (0) -> fallback viewport.
 * @param {string} resolutionMode - appConfigPlayerDisplay.getAll().photoResolutionMode
 * @param {number|null|undefined} naturalWidth - record.width (có thể thiếu ở record cũ)
 * @param {number|null|undefined} naturalHeight - record.height
 * @returns {string} */
function computePhotoPlayerBackgroundSizeCss(resolutionMode, naturalWidth, naturalHeight) {
    const containerWidth = (visualBgPhotoMotionContainer && visualBgPhotoMotionContainer.clientWidth) || window.innerWidth; // core/dom-refs.js
    const containerHeight = (visualBgPhotoMotionContainer && visualBgPhotoMotionContainer.clientHeight) || window.innerHeight;
    return resolvePlayerBackgroundSizeCss(resolutionMode, naturalWidth, naturalHeight, containerWidth, containerHeight); // core/player-display-settings.js
}

/** Di chuyển `videoPlayerMotionPointMoveElement` (wrapper Point Move, bọc layer A `bgVideoElement`)
 * vào làm con của `motionEngineReactLayer` (CÓ SẴN, DÙNG CHUNG với VBG — KHÔNG tạo element mới) —
 * rồi đưa layer B (`visualBgImageElement`) vào làm con của CHÍNH wrapper đó (NGANG HÀNG layer A bên
 * trong wrapper — không còn là con trực tiếp của `motionEngineReactLayer` nữa), để Point Move áp 1
 * lần lên wrapper di chuyển CẢ 2 layer cùng lúc như 1 khối cứng. Gọi lúc VÀO Video Player mode
 * (event/workflow/video-player.js::startFromPlaylist()).
 *
 * FIX (Giang báo bug "chọn Motion cho Next/Prev nhưng Transition không kích hoạt") — `.motion-layer`
 * (assets/css/motion-engine.css) TRƯỚC ĐÂY chỉ hard-code sẵn cho 2 layer RIÊNG của VBG, KHÔNG gán
 * cho `bgVideoElement`/`visualBgImageElement` — thiếu class khiến rule z-index promotion
 * (`.motion-layer.me-layer-enter{z-index:3}`) không bao giờ áp dụng, layer ĐANG VÀO kẹt mãi ở
 * z-index tĩnh, hầu hết kiểu Transition không thấy gì cả. Gán `.motion-layer` NGAY tại đây (gỡ lại ở
 * `detachVideoPlayerMotionFromSharedReactLayer()` — BẮT BUỘC đi cặp) + `.me-current` CHỈ cho
 * `bgVideoElement` (layer A, ĐANG là layer hiện tại lúc mới vào mode — `visualBgImageElement` lúc
 * này CHƯA có nội dung gì, giữ `.motion-layer` mặc định `opacity:0` là ĐÚNG).
 *
 * AN TOÀN với VBG: `clearMediaLayers()` (event/workflow/visual-bg-common.js, LUÔN chạy TRƯỚC bước
 * này trong `startFromPlaylist()`) đã gọi `workflowVisualBgPhotoMotion.stop()` — dọn SẠCH transform + dừng
 * hẳn Runner của VBG, VÀ ẩn `visualBgImageElement` (`applyVisualBgImageToDOM(false, ...)`, core/
 * visual-bg.js) TRƯỚC KHI hàm này chạy — VBG không đang dùng CẢ `motionEngineReactLayer` LẪN
 * `visualBgImageElement` lúc này (2 mode loại trừ nhau TUYỆT ĐỐI), nên mượn cả 2 là an toàn. */
function attachVideoPlayerMotionToSharedReactLayer() {
    if (!motionEngineReactLayer || !videoPlayerMotionPointMoveElement) return;
    motionEngineReactLayer.appendChild(videoPlayerMotionPointMoveElement);
    if (visualBgImageElement) {
        videoPlayerMotionPointMoveElement.appendChild(visualBgImageElement);
        visualBgImageElement.classList.add('motion-layer'); // FIX — xem docstring hàm này
    }
    if (bgVideoElement) bgVideoElement.classList.add('motion-layer', 'me-current'); // FIX — xem docstring hàm này
}

/** Trả CẢ layer A (`videoPlayerMotionPointMoveElement`, mang theo `bgVideoElement` bên trong) LẪN
 * layer B (`visualBgImageElement`, đang lồng TRONG wrapper đó) VỀ ĐÚNG vị trí "nhà" gốc của TỪNG
 * đứa (đo lúc boot — core/dom-refs.js) — gọi lúc THOÁT Video Player mode (event/workflow/
 * video-player.js::exitVideoPlayerMode()) — BẮT BUỘC, TRƯỚC khi `workflowVisualBg.applyCurrentVisualBg()`
 * tái sử dụng CẢ `motionEngineReactLayer` LẪN `visualBgImageElement` cho chính VBG. `insertBefore()`
 * tự "nhặt" phần tử ra khỏi vị trí hiện tại (bất kể đang lồng ở đâu) rồi đặt vào vị trí mới — thứ tự
 * 2 lệnh dưới không quan trọng, `visualBgImageElement` vẫn được lấy đúng ra khỏi wrapper.
 *
 * FIX (đi CẶP với `.motion-layer`/`.me-current` gán ở `attachVideoPlayerMotionToSharedReactLayer()`
 * — xem docstring hàm đó) — gỡ SẠCH `.motion-layer` + 3 class trạng thái Transition còn sót
 * (`resetMotionEngineLayerClasses()`, core/motion-engine.js) khỏi `bgVideoElement`/
 * `visualBgImageElement` TRƯỚC khi trả 2 phần tử về "nhà" — BẮT BUỘC, không thì `bgVideoElement`
 * (dùng chung với Video nền trang trí của VBG) kẹt mãi `opacity:0` mặc định của `.motion-layer`, và
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
