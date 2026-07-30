/**
 * core/video-player.js — "Video Player mode": phát video làm nội dung chính trên màn Visualizer
 * (KHÁC "Video nền" trang trí — core/state-and-video-bg.js, không đụng gì ở đây).
 *
 * `bgVideoElement` (#bg-video, TÁI DÙNG chung với Video nền, KHÔNG tạo element mới) là NGUỒN DUY
 * NHẤT vừa hiển thị + phát tiếng thật (native) vừa nuôi analyser qua 1 `MediaElementSourceNode`
 * riêng (`connectVideoElementToAnalyser()`) — KHÔNG dùng `audioPlayer` (đã thử, không đáng tin cậy
 * cross-browser cho `<audio src="video">`). Progress bar/seek/play-pause/ended có handler riêng ở
 * event/workflow/video-player.js, đọc/ghi thẳng `bgVideoElement`.
 *
 * Next/Prev/shuffle/repeat DÙNG CHUNG cơ chế Playlist (`playNext()`/`playPrev()`, core/player-
 * controls.js) — không có logic riêng cho Video. `isVideoPlayerMode` là cờ DUY NHẤT còn cần riêng
 * (biết `bgVideoElement` hay `audioPlayer` đang thực sự phát).
 *
 * File này chỉ chứa phần LÕI thuần (mutate state, toggle UI/DOM tức thời) — điều phối async (đọc
 * DB, đợi sự kiện) thuộc event/workflow/video-player.js.
 *
 * NẠP SAU: service/state.js.
 */

/** Bật state Video Player mode — gọi lúc BẮT ĐẦU vào mode (event/workflow/video-player.js::
 * startFromPlaylist()). `currentKey` (package `playlist`, DÙNG CHUNG với Song) do Workflow tự lo
 * riêng (xem docstring startFromPlaylist()), KHÔNG thuộc phạm vi hàm này. */
function enterVideoPlayerModeState() {
    appState.set('isVideoPlayerMode', true);
}

/** Tắt state Video Player mode. */
function exitVideoPlayerModeState() {
    appState.set('isVideoPlayerMode', false);
}

/** Đổi `muted`/`loop`/`pointer-events`/`.hidden` của `bgVideoElement` giữa 2 chế độ — gọi ĐÚNG 1
 * LẦN lúc vào/thoát Video Player mode, KHÔNG đụng gì tới Next/Prev bên trong mode (xem
 * `playVideoByKey()`, event/workflow/video-player.js — Next/Prev chỉ đổi `src`, không toggle hàm
 * này). `.hidden` (display:none) là cơ chế hiện/ẩn DUY NHẤT (không dùng opacity — display:none
 * thắng tuyệt đối). `enabled=true`: gỡ `.hidden` + bỏ muted + tắt loop (cần `bgVideoElement` tự
 * bắn 'ended' để chuyển video kế tiếp) + bật pointer-events. `enabled=false`: ngược lại, về mặc
 * định CSS tĩnh (`#bg-video { z-index: 0; }`, giống Video nền trang trí).
 * @param {boolean} enabled
 */
function setBgVideoElementForPlayerMode(enabled) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.loop = !enabled;
    bgVideoElement.classList.toggle('hidden', !enabled);
    bgVideoElement.style.pointerEvents = enabled ? 'auto' : '';
}

/** BÀI HỌC giữ lại (đã thử 3 cách che ảnh LÊN TRÊN `bgVideoElement` đang decode — overlay div
 * riêng, background-image thẳng lên chính nó — cả 3 đều thất bại): `<video>` decode hardware trên
 * WKWebView/iOS Safari nằm trong 1 compositing layer riêng do OS quản lý, không tuân z-index/DOM
 * order, đè cả CSS của chính nó. KHÔNG thể che/lấp bằng CSS lên TRÊN 1 `<video>` đang hiển thị —
 * chỉ có thể lộ ra thứ NẰM DƯỚI nó bằng cách ẩn hẳn (`.hidden`) chính `bgVideoElement`. Đây là lý
 * do `decodeForcedBgThumb()` (event/workflow/video-player.js gọi) chỉ chèn ảnh vào lớp
 * `#visual-bg-image` NẰM DƯỚI (z-index -2, luôn bị `bgVideoElement` che khi nó đang hiện) làm lớp
 * dự phòng — KHÔNG chủ động ẩn/hiện `bgVideoElement` giữa Next/Prev (Giang chốt 31/07/2026: chỉ
 * cần multi-browser an toàn, không cần chớp-đen-zero tuyệt đối bằng active toggle). */

let _videoAnalyserSourceNode = null; // MediaElementSourceNode của bgVideoElement — tạo ĐÚNG 1 LẦN (trình duyệt cấm tạo lại trên CÙNG 1 element, KHÁC audioPlayer đã có source riêng của nó)

/**
 * Nối `bgVideoElement` (KHÔNG PHẢI `audioPlayer`) trực tiếp vào analyser đã có sẵn. PHẢI gọi
 * `setupAudioContext()` (core/audio-engine.js) trước hàm này ít nhất 1 lần trong phiên. Nối qua
 * `masterGainNode` (KHÔNG nối thẳng `analyser`/`destination`) — node đó đã sẵn `.connect(analyser)`/
 * `.connect(analyserPitch)`/`.connect(destination)` từ `setupAudioContext()`, nên video cũng tôn
 * trọng thanh Âm lượng chung thay vì luôn phát gain mặc định 100%. `createMediaElementSource()`
 * chiếm audio output mặc định của element — KHÔNG nối gì thì `bgVideoElement` sẽ câm hoàn toàn.
 */
function connectVideoElementToAnalyser() {
    if (_videoAnalyserSourceNode) return; // guard — chỉ tạo 1 lần, gọi lại nhiều lần vô hại
    const audioContext = appState.get('audioContext');
    _videoAnalyserSourceNode = audioContext.createMediaElementSource(bgVideoElement);
    _videoAnalyserSourceNode.connect(appState.get('masterGainNode')); // -> analyser/analyserPitch/destination đã nối sẵn từ setupAudioContext()
}

/**
 * MỚI (31/07/2026) — decode `thumbFullBlob` (full-res, frame 1) của video SẮP chuyển tới + xác
 * nhận trình duyệt đã thực sự PAINT (không chỉ decode xong) qua double-`requestAnimationFrame`.
 * Dùng làm lớp dự phòng multi-browser cho `#visual-bg-image` lúc Next/Prev/end (xem docstring
 * `setBgVideoElementForPlayerMode()` ngay trên — KHÔNG chủ động ẩn/hiện `bgVideoElement`, chỉ chèn
 * sẵn ảnh vào lớp NẰM DƯỚI đề phòng thiết bị nào đó lộ khoảng hở lúc đổi `src`).
 * Core thuần — không đụng appState/taskManager (1 lần chờ paint, không phải task lặp).
 * @param {Blob} blob - `record.thumbFullBlob`, có thể null (video cũ/lỗi capture)
 * @returns {Promise<string|null>} object URL đã sẵn sàng paint, hoặc `null` nếu `blob` rỗng —
 *          nơi gọi tự revoke khi không cần nữa (KHÔNG tự revoke trong hàm này).
 */
function decodeForcedBgThumb(blob) {
    if (!blob) return Promise.resolve(null);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    return (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(url)));
    }));
}
