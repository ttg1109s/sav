/**
 * core/dynamic-object-ui.js — đối tượng TẠO ĐỘNG lúc app đang chạy (`<video>`/`<audio>`/`<script>` tạm, MediaRecorder,
 * ScriptProcessorNode...): tạo/giải phóng, và đổi sự kiện của chúng thành Promise / callback dữ liệu cho Workflow.
 *
 * NGOẠI LỆ CHÍNH THỨC của Rule 5a (readme/event-bus-flow.md mục "Ngoại lệ: adapter đối tượng tạo động", Giang chốt
 * phương án (y) 13/10/2026): Listener không gắn trước được vì đối tượng chưa tồn tại lúc tải trang; sự kiện ở đây là
 * NỬA SAU bất đồng bộ của chính API đang gọi (đợi xong / thu dữ liệu), không quyết định nghiệp vụ -> callback KHÔNG
 * eventBus.send. Sự kiện mang ý nghĩa nghiệp vụ (vd mic bị hệ điều hành thu hồi) vẫn phải eventBus.send.
 * Chỉ dùng cho đối tượng tạo động — phần tử DOM tĩnh vẫn đi Listener → Router. Ngoại lệ duy nhất cho phần tử tĩnh:
 * `requestVideoFrameOnce()` (Giang chốt mở rộng 21/10/2026) — `requestVideoFrameCallback` là YÊU CẦU 1 lần của chính API
 * đang gọi ("báo khi khung kế tiếp được trình chiếu"), không phải sự kiện DOM để Listener gắn trước được.
 *
 * NẠP SAU: không phụ thuộc gì (chỉ API trình duyệt).
 */

/** Đợi 1 lần sự kiện `eventName` trên `target`. `cancel()` gỡ listener (dùng khi hết giờ / đã có kết quả khác).
 * @param {EventTarget} target @param {string} eventName
 * @returns {{promise: Promise<Event>, cancel: () => void}} */
function listenEventOnce(target, eventName) {
    let handler = null;
    const promise = new Promise((resolve) => {
        handler = (e) => resolve(e);
        target.addEventListener(eventName, handler, { once: true });
    });
    return { promise, cancel: () => target.removeEventListener(eventName, handler) };
}

/** Nhận MỌI lần sự kiện `eventName` (luồng dữ liệu, vd 'dataavailable' của MediaRecorder).
 * @param {EventTarget} target @param {string} eventName @param {(e: Event) => void} onEvent
 * @returns {() => void} hàm gỡ */
function listenEventStream(target, eventName, onEvent) {
    target.addEventListener(eventName, onEvent);
    return () => target.removeEventListener(eventName, onEvent);
}

/** Nhận khối mẫu của ScriptProcessorNode — gán `onaudioprocess` (API cũ, cách gắn chắc chắn chạy trên mọi WebKit).
 * @param {ScriptProcessorNode} processor @param {(e: AudioProcessingEvent) => void} onEvent
 * @returns {() => void} hàm gỡ */
function listenAudioProcess(processor, onEvent) {
    processor.onaudioprocess = onEvent;
    return () => { processor.onaudioprocess = null; };
}

/** `requestVideoFrameCallback` 1 lần: `onFrame(metadata)` chạy ĐỒNG BỘ trong callback — đúng nhịp khung vừa được trình chiếu
 * (nơi gọi chụp khung / đọc trạng thái ngay trong nhịp đó). Dùng cho cả `<video>` tạm lẫn `bgVideoElement` (xem đầu file).
 * Trình duyệt không hỗ trợ -> `supported=false`, không gọi gì. `cancel()` gọi lặp / sau khi đã báo đều vô hại.
 * @param {HTMLVideoElement} videoEl @param {(metadata: VideoFrameCallbackMetadata) => void} onFrame
 * @returns {{supported: boolean, cancel: () => void}} */
function requestVideoFrameOnce(videoEl, onFrame) {
    if (typeof videoEl.requestVideoFrameCallback !== 'function') return { supported: false, cancel: () => {} }; // guard
    let handle = videoEl.requestVideoFrameCallback((now, metadata) => {
        handle = null;
        onFrame(metadata);
    });
    return {
        supported: true,
        cancel: () => {
            if (handle === null) return; // guard — đã báo / đã huỷ
            videoEl.cancelVideoFrameCallback(handle);
            handle = null;
        },
    };
}

/** Thẻ `<video>` tạm (không gắn vào DOM) để đọc metadata/chụp khung: tắt tiếng, phát inline, tải trước. */
function createDetachedVideoElement() {
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    return videoEl;
}

/** Thẻ `<video>` tạm chỉ để kiểm tra blob có nạp được metadata không (quét file lỗi): tắt tiếng, phát inline (iOS không
 * coi là media có tiếng), chỉ tải metadata. */
function createMetadataProbeVideoElement() {
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'metadata';
    return videoEl;
}

/** Thẻ `<audio>` tạm chỉ để đọc thời lượng (event/workflow/audio-duration.js): chỉ tải metadata, không buffer cả file. */
function createMetadataProbeAudioElement() {
    const audioEl = new Audio();
    audioEl.preload = 'metadata';
    return audioEl;
}

/** Gán nguồn rồi đợi 'loadedmetadata' (đăng ký TRƯỚC khi gán src).
 * @param {HTMLMediaElement} mediaEl @param {string} url @returns {{promise: Promise<Event>, cancel: () => void}} */
function loadMediaElementMetadata(mediaEl, url) {
    const wait = listenEventOnce(mediaEl, 'loadedmetadata');
    mediaEl.src = url;
    return wait;
}

/** Giải phóng decoder của thẻ media thật sự (pause + gỡ src + load()), không chờ GC. Lỗi -> bỏ qua.
 * @param {HTMLMediaElement} mediaEl */
function releaseMediaElement(mediaEl) {
    try { mediaEl.pause(); mediaEl.removeAttribute('src'); mediaEl.load(); } catch (e) { /* đã giải phóng */ }
}

/** Nạp 1 file script cục bộ bằng thẻ `<script>` trong `<head>`. Bắt thêm lỗi CHẠY script (vd nhầm bản ESM/Node —
 * script vẫn 'load' nhưng ném lỗi, không tạo biến global): lỗi không có filename phát ra trong lúc chờ cũng tính
 * (file:// che tên file). Không cache — nơi gọi tự nhớ kết quả.
 * @param {string} src - đường dẫn gốc (dùng đối chiếu filename lỗi) @param {string} url - URL nạp thật (có thể kèm query chống cache)
 * @returns {Promise<{loaded: boolean, runError: (string|null), el: HTMLScriptElement}>} */
function loadScriptFile(src, url) {
    const el = document.createElement('script');
    let runError = null;
    const onRunError = (e) => {
        if (!e.filename || e.filename.indexOf(src) !== -1) runError = e.message || String(e.error) || 'Script error';
    };
    const loaded = listenEventOnce(el, 'load');
    const failed = listenEventOnce(el, 'error');
    const result = Promise.race([loaded.promise.then(() => true), failed.promise.then(() => false)]).then((ok) => {
        loaded.cancel();
        failed.cancel();
        window.removeEventListener('error', onRunError);
        return { loaded: ok, runError, el };
    });
    el.src = url;
    window.addEventListener('error', onRunError);
    document.head.appendChild(el);
    return result;
}

/** Gỡ thẻ `<script>` đã nạp hỏng (để lần sau nạp lại từ đầu). @param {HTMLScriptElement} el */
function removeScriptElement(el) {
    el.remove();
}
