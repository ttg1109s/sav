/**
 * core/video-player.js — Video Player mode: phát video làm nội dung chính trên màn Visualizer (khác Video nền trang trí VBG).
 *
 * `bgVideoElement` (#bg-video, dùng chung với Video nền — không tạo element mới) vừa hiển thị + phát tiếng native vừa nuôi
 * analyser qua 1 `MediaElementSourceNode` riêng (`connectVideoElementToAnalyser()`). Không dùng `audioPlayer` cho video
 * (`<audio src="video">` không đáng tin cậy cross-browser). Next/Prev/Shuffle/Repeat dùng chung hàng đợi Playlist
 * (workflowPlayerControls); `isVideoPlayerMode` cho biết `bgVideoElement` hay `audioPlayer` đang phát thật.
 *
 * File này chỉ ghi state/DOM tức thời + tính thuần; điều phối (đọc DB, chờ sự kiện, hẹn khung) ở
 * event/workflow/video-player.js.
 *
 * Lớp dự phòng lúc đổi video: `<video>` decode phần cứng (WKWebView/iOS Safari) nằm trong compositing layer riêng của OS,
 * không tuân z-index — không thể che LÊN TRÊN nó bằng CSS. Vì vậy thumb khung đầu chỉ chèn vào `#visual-bg-image` NẰM DƯỚI
 * làm lớp dự phòng, không chủ động ẩn/hiện `bgVideoElement` giữa Next/Prev (Giang chốt: an toàn multi-browser là đủ).
 *
 * NẠP SAU: service/state.js, core/dom-refs.js.
 */

/** Bật state Video Player mode (lúc VÀO mode). `currentKey` (dùng chung với Song) do Workflow tự lo. */
function enterVideoPlayerModeState() {
    appState.set('isVideoPlayerMode', true);
    console.log(`writer: "enterVideoPlayerModeState", page: "isVideoPlayerMode", content: "true"`);
}

/** Tắt state Video Player mode. */
function exitVideoPlayerModeState() {
    appState.set('isVideoPlayerMode', false);
    console.log(`writer: "exitVideoPlayerModeState", page: "isVideoPlayerMode", content: "false"`);
}

/** Đổi `bgVideoElement` giữa Video Player mode và nền trang trí — gọi ĐÚNG 1 LẦN lúc vào/thoát mode (Next/Prev trong mode chỉ
 * đổi `src`). `enabled=true`: bỏ muted, tắt loop (cần 'ended' để sang video kế), gỡ `.hidden` (cơ chế hiện/ẩn duy nhất —
 * display:none thắng tuyệt đối), bật pointer-events, hiện nút chụp khung hình. `false`: về mặc định CSS tĩnh. `.muted` chỉ là
 * dự phòng lúc graph Web Audio chưa nối — âm lượng tin cậy là `setVideoBgGain()` (Workflow gọi cùng lúc).
 * @param {boolean} enabled */
function setBgVideoElementForPlayerMode(enabled) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.loop = !enabled;
    bgVideoElement.classList.toggle('hidden', !enabled);
    bgVideoElement.style.pointerEvents = enabled ? 'auto' : '';
    if (btnCaptureVideoFrame) btnCaptureVideoFrame.classList.toggle('hidden', !enabled);
}

/** Nền đen cưỡng chế phía sau video lúc vào Video Player mode (cùng kết quả updateDOMBackground() cho nhánh video nền). */
function paintVisualizerSolidBlack() {
    visualizerSolidBg.style.backgroundColor = '#000000';
}

// ===== Đổi nguồn `bgVideoElement` (event/workflow/video-player.js::swapBgVideoSource()) =====

/** Kế hoạch 1 lượt đổi video (tính 1 lần từ tham số + trạng thái surface + record).
 * - `isSurfaceEntry`: lần hiện TĨNH đầu qua cầu thumb (không Transition, ẩn tới khi sẵn sàng, đang trên Video surface, có thumb
 *   full-res) -> thumb vào layer B, ẩn video tới 'playing'.
 * - `hideVideoUntilReady`: ẩn hẳn `bgVideoElement` (`.hidden`) trước khi gán src — ngoài surface, hoặc đúng lần hiện tĩnh đầu.
 * - `hasTransitionHook`: lượt có Transition A/B do nơi gọi chạy.
 * - `fillLayerB`: có đưa thumb full-res vào layer B không (Transition hoặc hiện tĩnh đầu, record có thumb).
 * - `revealReturnCurrent`: lúc lộ video trả `.me-current` về layer A (hiện tĩnh đầu hoặc sau Transition).
 * @returns {{isSurfaceEntry: boolean, hideVideoUntilReady: boolean, hasTransitionHook: boolean, fillLayerB: boolean, revealReturnCurrent: boolean}} */
function resolveVideoSwapPlan({ isTransition, hideUntilReady, isOnMotionSurface, hasThumbFull, hasTransitionHookFn }) {
    const isSurfaceEntry = !isTransition && hideUntilReady && isOnMotionSurface && hasThumbFull;
    const hasTransitionHook = isTransition && hasTransitionHookFn;
    return {
        isSurfaceEntry,
        hideVideoUntilReady: hideUntilReady && (!isOnMotionSurface || isSurfaceEntry),
        hasTransitionHook,
        fillLayerB: (isTransition || isSurfaceEntry) && hasThumbFull,
        revealReturnCurrent: isSurfaceEntry || hasTransitionHook,
    };
}

/** Lộ video sau lượt đổi còn hợp lệ không: lần hiện tĩnh đầu mà lượt đã bị thay (Next/Prev/chọn khác) hoặc đã trả Video
 * surface (thoát mode) -> không đụng layer nữa. @returns {boolean} */
function isSwapRevealStillValid(isSurfaceEntry, swapGeneration, currentGeneration, isSurfaceAttached) {
    return !isSurfaceEntry || (swapGeneration === currentGeneration && isSurfaceAttached);
}

/** Lộ video hoãn tới 'playing' (Game Mode armed) còn hợp lệ không: lượt chưa bị thay, và nếu lúc đổi đang trên surface thì
 * surface vẫn còn. @returns {boolean} */
function isDeferredSwapRevealStillValid(swapGeneration, currentGeneration, wasOnMotionSurface, isSurfaceAttached) {
    return swapGeneration === currentGeneration && (!wasOnMotionSurface || isSurfaceAttached);
}

/** Trước khi gán src mới: ẩn layer A bằng opacity sau Transition (không lộ frame trước lúc video MỚI buffer; `transform=''`
 * phòng hờ) và/hoặc ẩn hẳn (`.hidden`) để lộ thumb full-res nằm dưới. @param {boolean} hideByOpacity @param {boolean} hideFully */
function hideVideoLayerForSwap(hideByOpacity, hideFully) {
    if (hideByOpacity) {
        bgVideoElement.style.opacity = '0';
        bgVideoElement.style.transform = '';
    }
    if (hideFully) bgVideoElement.classList.add('hidden');
}

/** Gán poster + src mới 1 lần liền mạch. @param {string} posterUrl @param {string} srcUrl */
function setBgVideoPosterAndSource(posterUrl, srcUrl) {
    bgVideoElement.poster = posterUrl;
    bgVideoElement.src = srcUrl;
}

/** Video MỚI đã có khung (hoặc hết giờ chờ): gỡ ẩn, trả opacity, trả `.me-current` về layer A (layer B về lớp dự phòng
 * nằm dưới). @param {boolean} unhide @param {boolean} restoreOpacity @param {boolean} returnCurrent */
function revealVideoLayerAfterSwap(unhide, restoreOpacity, returnCurrent) {
    if (unhide) bgVideoElement.classList.remove('hidden');
    if (restoreOpacity) bgVideoElement.style.opacity = '1';
    if (!returnCurrent) return; // guard
    bgVideoElement.classList.add('me-current');
    if (visualBgImageElement) visualBgImageElement.classList.remove('me-current');
}

/** Dừng + gỡ nguồn/poster + ẩn `bgVideoElement` (không đụng muted/loop/pointer-events). */
function stripBgVideoSource() {
    bgVideoElement.pause();
    bgVideoElement.classList.add('hidden');
    bgVideoElement.removeAttribute('poster');
    bgVideoElement.removeAttribute('src');
    bgVideoElement.src = '';
}

/** Trả opacity mặc định — thoát giữa lúc opacity đang '0' (Transition bị ngắt) thì lần vào mode sau video kẹt vô hình. */
function resetBgVideoOpacity() {
    bgVideoElement.style.opacity = '';
}

/** "Bấm lại đúng video đang phát": cùng key VÀ `bgVideoElement` vẫn mang đúng object URL đang giữ (sau khi thoát mode
 * currentKey không bị xoá dù video đã mất src). @returns {boolean} */
function isSameVideoLoaded(videoKey, currentKey, objectUrl, srcAttr) {
    return videoKey === currentKey && !!objectUrl && srcAttr === objectUrl;
}

/** Kẹp mốc seek sát/đúng cuối video về `duration - endGuardSec` — seek không được đặt currentTime chạm EOF ('ended' phải là
 * tín hiệu video THẬT chạy hết; play() từ EOF có thể restart về 0). Chưa biết duration -> giữ nguyên.
 * @param {number} value @param {number} durationSec @param {number} endGuardSec @returns {number} */
function clampVideoSeekTarget(value, durationSec, endGuardSec) {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return value;
    return Math.min(value, Math.max(0, durationSec - endGuardSec));
}

let _videoAnalyserSourceNode = null; // MediaElementSourceNode của bgVideoElement — tạo ĐÚNG 1 LẦN (trình duyệt cấm tạo lại trên cùng element)
let _videoBgGainNode = null; // GainNode riêng của bgVideoElement — xem setVideoBgGain()

/**
 * Nối `bgVideoElement` vào ĐIỂM VÀO chuỗi EQ (cùng điểm `audioPlayer` nối vào — Song/Video không phát đồng thời nên dùng
 * chung an toàn; chuỗi EQ tự chảy ra masterGainNode) QUA 1 GainNode riêng. Lý do GainNode: sau `createMediaElementSource()`,
 * `.muted`/`.volume` của element không đáng tin cậy để câm phần audio đã vào graph (Firefox bug #966247; MDN khuyến nghị
 * GainNode). Gain mặc định 0 (câm) — nơi gọi tự đặt lại mức ngay sau lần nối đầu. Gọi lặp vô hại.
 * @param {AudioContext} audioContext - đã dựng (workflowAudioEngine.setup()) @param {AudioNode} eqEntryNode - eqBandNodes[0], hoặc masterGainNode khi chưa có EQ
 */
function connectVideoElementToAnalyser(audioContext, eqEntryNode) {
    if (_videoAnalyserSourceNode) return; // guard — chỉ tạo 1 lần
    _videoAnalyserSourceNode = audioContext.createMediaElementSource(bgVideoElement);
    _videoBgGainNode = audioContext.createGain();
    _videoBgGainNode.gain.value = 0;
    _videoAnalyserSourceNode.connect(_videoBgGainNode);
    _videoBgGainNode.connect(eqEntryNode);
}

/** Âm lượng tin cậy của `bgVideoElement` khi đã nối graph; chưa nối thì no-op (`.muted` là dự phòng).
 * @param {number} value - 0..1 (0 = câm hoàn toàn) */
function setVideoBgGain(value) {
    if (_videoBgGainNode) _videoBgGainNode.gain.value = value;
}

// ===================== Cổng seek cho Video: đóng băng khung hình =====================
// Cổng seek nạp lại nguồn (`load()`) để xoá hàng đợi tiếng cũ của iOS -> `<video>` mất khung hình tới khi seek xong. Trong
// lúc đó khung hiện tại (đã chụp) nằm ở layer B (`#visual-bg-image`), layer A (`#bg-video`) trong suốt. Cả 2 layer cùng nằm
// trong wrapper React Beat/Point Move/Zoom nên di chuyển cùng 1 khối. Đổi bằng opacity + `.me-current` (không `display:none`).

/** Đưa layer B (#visual-bg-image) lên làm "current" của Video surface ngay (layer đang ở `.motion-layer` mặc định
 * `opacity:0`) — dùng khi VBG Video mượn surface lúc layer B đang hiện sẵn thumb tĩnh. @param {HTMLElement} imageEl */
function markBridgeLayerCurrent(imageEl) {
    imageEl.classList.add('me-current');
}

/** Trạng thái layer A/B trước khi đóng băng — để trả lại ĐÚNG như cũ. @returns {{videoOpacity: string, videoCurrent: boolean, imageCurrent: boolean}} */
function readSeekFreezeLayerState() {
    return {
        videoOpacity: bgVideoElement.style.opacity,
        videoCurrent: bgVideoElement.classList.contains('me-current'),
        imageCurrent: !!visualBgImageElement && visualBgImageElement.classList.contains('me-current'),
    };
}

/** Lộ layer B (khung đóng băng vừa gắn vào), ẩn layer A bằng opacity. `.me-current` trên layer B chỉ có hiệu lực khi layer
 * mang `.motion-layer` (Video surface); ngoài surface, layer B vốn nằm dưới layer A nên chỉ cần ẩn A. */
function applySeekFreezeLayersToDOM() {
    if (visualBgImageElement) visualBgImageElement.classList.add('me-current');
    bgVideoElement.style.opacity = '0';
}

/** Trả layer A/B về đúng trạng thái trước khi đóng băng. @param {{videoOpacity: string, videoCurrent: boolean, imageCurrent: boolean}} state */
function restoreSeekFreezeLayersToDOM(state) {
    bgVideoElement.style.opacity = state.videoOpacity;
    bgVideoElement.classList.toggle('me-current', state.videoCurrent);
    if (visualBgImageElement) visualBgImageElement.classList.toggle('me-current', state.imageCurrent);
}

/**
 * 'pause' vừa tới có phải lần DỪNG THẬT của đúng video đang phát ở Player Video không, để Workflow xả hàng đợi tiếng iOS (nạp lại + seek về chỗ dừng).
 * Loại trừ: đã phát lại, hết video ('pause' đi trước 'ended'), không ở Player Video / đã bỏ media, đang kéo thanh seek (kéo
 * tay tự pause để scrub — cổng chạy lúc thả tay), đang đổi video (swap tự pause trước khi gán src mới), nguồn đã đổi, video
 * chưa có khung hình (vừa nạp, chưa có gì để xả). Thuần — mọi giá trị do Workflow đọc sẵn. @returns {boolean}
 */
function shouldFlushVideoQueueOnPause({ isPaused, isEnded, isVideoPlayerMode, isSeeking, isSwapping, hasFrame, currentKey, currentObjectURL, mediaSrc }) {
    return isPaused && !isEnded && isVideoPlayerMode && !isSeeking && !isSwapping && hasFrame && currentKey !== null && !!currentObjectURL && mediaSrc === currentObjectURL;
}
