/**
 * core/video-player.js — MỚI (21/07/2026, mục 4). "Video Player mode": phát video làm nội dung
 * chính trên màn Visualizer (KHÁC hẳn "Video nền" trang trí — core/state-and-video-bg.js, file đó
 * KHÔNG đụng gì ở đây). Next/Prev/Play/Pause tái dùng ĐÚNG nút vật lý của Playlist nhạc (event/
 * router/player-controls.js branch qua VirtualMachineState theo `isVideoPlayerMode`) — file NÀY
 * chỉ chứa phần LÕI thuần: tính key kế tiếp/trước, mutate state, toggle UI nút — KHÔNG đụng
 * `bgVideoElement` trực tiếp cho việc phát (điều phối cần async đọc DB -> thuộc Workflow, xem
 * event/workflow/video-player.js).
 *
 * KIẾN TRÚC LẦN 2 (21/07/2026, VIẾT LẠI — Giang phát hiện qua video test: play/pause không phản
 * hồi, current time đứng yên, dù audio NGHE RÕ đang phát) — BẢN ĐẦU dùng `audioPlayer` (thẻ
 * `<audio>`) làm nguồn "câm, chỉ nuôi analyser" bằng cách gán thẳng blob VIDEO vào `src` của nó
 * (dựa trên giả định `<audio>` tự động chỉ giải mã track âm thanh của file video) — GIẢ ĐỊNH NÀY
 * KHÔNG ĐÁNG TIN CẬY trên mọi trình duyệt/thiết bị (đặc biệt Safari/iOS vốn nổi tiếng khắt khe hơn
 * Chrome về khớp định dạng container-với-thẻ-media — `<audio src="video.mp4">` có thể bị từ chối
 * giải mã/phát hoàn toàn, `audioPlayer.play()` fail ÂM THẦM vì có `.catch(() => {})` nuốt lỗi) —
 * ĐÚNG các triệu chứng Giang báo: `bgVideoElement` (thẻ `<video>` thật, LUÔN giải mã được chính nó)
 * phát tiếng bình thường, nhưng `audioPlayer` (nguồn DUY NHẤT nuôi progress bar/current time/
 * analyser/icon play-pause qua các sự kiện 'play'/'pause'/'timeupdate'/'ended' của CHÍNH NÓ) không
 * hề chạy -> mọi UI phụ thuộc nó đứng yên, nút Play/Pause bấm vào chỉ gọi lại `.play()` y hệt, vẫn
 * fail y hệt, im lặng.
 *
 * SỬA: BỎ HẲN `audioPlayer` khỏi luồng Video Player — `bgVideoElement` giờ là NGUỒN DUY NHẤT, vừa
 * hiển thị + phát tiếng thật (native, không qua Web Audio) VỪA nuôi analyser qua 1
 * `MediaElementSourceNode` RIÊNG tạo trực tiếp từ chính nó (`connectVideoElementToAnalyser()` ngay
 * dưới) — dùng CHUNG `audioContext`/`analyser`/`analyserPitch` đã có sẵn từ `setupAudioContext()`
 * (core/audio-engine.js, KHÔNG đụng file đó, KHÔNG tạo AudioContext thứ 2), chỉ thêm ĐÚNG 1 source
 * node mới (browser cho phép — giới hạn "1 lần" là theo TỪNG element, `audioPlayer` đã có source
 * riêng của nó rồi, KHÔNG liên quan gì tới việc tạo thêm 1 source cho `bgVideoElement`).
 * `createMediaElementSource()` "CHIẾM" audio output mặc định của element — BẮT BUỘC phải tự
 * `.connect(audioContext.destination)` thêm, nếu không `bgVideoElement` sẽ CÂM hoàn toàn (mất tiếng
 * vẫn đang phát bình thường trước đó).
 * Progress bar/current time/duration/seek/play-pause-icon/ended giờ có bộ handler RIÊNG trong
 * event/workflow/video-player.js (đọc/ghi THẲNG `bgVideoElement`, KHÔNG phải `audioPlayer`), gắn
 * qua sự kiện NGUYÊN BẢN của chính `bgVideoElement` (event/listener/video-player.js) — KHÔNG còn
 * lẫn lộn với luồng Song (audioPlayer) nữa, tách bạch hoàn toàn 2 nguồn.
 *
 * `bgVideoElement` (#bg-video, TÁI DÙNG — không tạo element mới, "giống cách bg video" đúng yêu cầu
 * Giang) — `muted`/`loop`/`opacity`/`z-index`/`pointer-events` đổi qua lại giữa 2 chế độ (nền trang
 * trí: muted+loop=true, z-index/pointer-events mặc định CSS; Player mode: muted=false+loop=false,
 * z-index nâng lên trên canvas, pointer-events bật lại để nhận cử chỉ vuốt) — xem
 * `setBgVideoElementForPlayerMode()` ngay dưới. KHÔNG dùng chung cơ chế `videoBgEnabled`/
 * `videoBgUrl`/`syncVideoBgToAudio()` của Video nền (cố ý TÁCH HẲN, tránh rò rỉ state giữa 2 tính
 * năng — khoá chéo qua Block gate, xem event/block.js).
 *
 * ĐƠN GIẢN HOÁ Ở BẢN ĐẦU (đã báo Giang) — danh sách video phát TUẦN TỰ theo thứ tự thêm vào (cũ ->
 * mới), KHÔNG có shuffle/repeat riêng cho video.
 *
 * NẠP SAU: service/state.js.
 */

/**
 * Tính videoKey kế tiếp trong `videoPlaylist` — tuần tự, quay vòng về đầu khi hết danh sách. Hàm
 * THUẦN (Rule 1-4) — nhận tham số, KHÔNG tự appState.get().
 * @param {string[]} videoPlaylist
 * @param {string|null} currentVideoKey
 * @returns {string|null} null nếu danh sách rỗng
 */
function computeNextVideoKey(videoPlaylist, currentVideoKey) {
    if (videoPlaylist.length === 0) return null;
    const currentPos = videoPlaylist.indexOf(currentVideoKey);
    if (currentPos === -1 || currentPos === videoPlaylist.length - 1) return videoPlaylist[0];
    return videoPlaylist[currentPos + 1];
}

/**
 * Tính videoKey trước đó trong `videoPlaylist` — tuần tự, quay vòng về cuối khi ở đầu danh sách.
 * Hàm THUẦN, cùng khuôn `computeNextVideoKey()`.
 * @param {string[]} videoPlaylist
 * @param {string|null} currentVideoKey
 * @returns {string|null} null nếu danh sách rỗng
 */
function computePrevVideoKey(videoPlaylist, currentVideoKey) {
    if (videoPlaylist.length === 0) return null;
    const currentPos = videoPlaylist.indexOf(currentVideoKey);
    if (currentPos <= 0) return videoPlaylist[videoPlaylist.length - 1];
    return videoPlaylist[currentPos - 1];
}

/** Bật state Video Player mode + gán danh sách phát — gọi lúc BẮT ĐẦU vào mode (Workflow đã đọc
 * xong danh sách video từ DB trước khi gọi hàm này). `currentVideoKey` reset về null — Workflow tự
 * gọi `setCurrentVideoKey()` ngay sau khi phát video đầu tiên.
 * @param {string[]} videoPlaylist
 */
function enterVideoPlayerModeState(videoPlaylist) {
    appState.mutate('videoPlaylist', (arr) => { arr.length = 0; arr.push(...videoPlaylist); }); // in-place — mutate() không nhận giá trị return (xem service/state.js)
    appState.set('isVideoPlayerMode', true);
    appState.set('currentVideoKey', null);
}

/** Tắt state Video Player mode + dọn sạch danh sách phát/video hiện tại. */
function exitVideoPlayerModeState() {
    appState.set('isVideoPlayerMode', false);
    appState.mutate('videoPlaylist', (arr) => { arr.length = 0; });
    appState.set('currentVideoKey', null);
}

/** @param {string} videoKey */
function setCurrentVideoKey(videoKey) {
    appState.set('currentVideoKey', videoKey);
}

/** Đổi `muted`/`loop`/`opacity`/`z-index`/`pointer-events` của `bgVideoElement` (#bg-video, TÁI
 * DÙNG — xem docstring đầu file) giữa 2 chế độ.
 * `enabled=true` (vào Player mode): bỏ muted (nghe tiếng thật) + tắt loop (BẮT BUỘC — cần
 * `bgVideoElement` tự bắn sự kiện 'ended' để tự chuyển video kế tiếp, `loop=true` sẽ KHÔNG BAO GIỜ
 * bắn 'ended') + hiện luôn (`opacity: 1`, KHÔNG dùng class `.hidden` — cơ chế gốc của #bg-video
 * (core/state-and-video-bg.js) CHỈ dùng `opacity`, KHÔNG bao giờ đụng `.hidden`; nếu ở đây thêm
 * `.hidden` thì lúc thoát Player mode + khôi phục Video nền thật, `handleVideoBackground()` chỉ
 * biết sửa `opacity` chứ KHÔNG gỡ `.hidden` — video nền sẽ kẹt vô hình `display:none` mãi mãi).
 * z-index nâng lên `15` — TRÊN cả `#visualizer` (z:10)/`#webgl-canvas` (z:1), cả 2 đều con TRỰC
 * TIẾP của `<body>` — bất kể loại visualizer nào đang chạy có tự vẽ nền đục hay không, video LUÔN
 * đảm bảo hiển thị ĐÈ LÊN TRÊN canvas (KHÔNG phải sửa từng file `core/visualizer/types/*.js`).
 * z:15 vẫn THẤP HƠN UI chrome (`#visualizer-ui` z:30, `#player-container`, `#app-stack` z:60) — nút
 * điều khiển/player bar vẫn hiện đè trên video. `pointer-events: auto` — `#bg-video` mặc định có
 * CSS cứng `pointer-events: none` (để click xuyên qua trong chế độ nền trang trí) — Player mode cần
 * nhận cử chỉ vuốt (event/listener/video-player.js), phải bật lại qua inline style.
 * `enabled=false` (thoát Player mode): trả lại ĐÚNG mặc định trang trí (muted+loop=true, ẩn opacity
 * 0, z-index/pointer-events về `''` để CSS tĩnh tự áp dụng lại).
 * @param {boolean} enabled
 */
function setBgVideoElementForPlayerMode(enabled) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.loop = !enabled;
    bgVideoElement.style.opacity = enabled ? '1' : '0';
    bgVideoElement.style.zIndex = enabled ? '15' : '';
    bgVideoElement.style.pointerEvents = enabled ? 'auto' : '';
}

let _videoAnalyserSourceNode = null; // MediaElementSourceNode của bgVideoElement — tạo ĐÚNG 1 LẦN (trình duyệt cấm tạo lại trên CÙNG 1 element, KHÁC audioPlayer đã có source riêng của nó)

/**
 * Nối `bgVideoElement` (KHÔNG PHẢI `audioPlayer`) trực tiếp vào analyser đã có sẵn — THAY hẳn
 * kiến trúc "audioPlayer câm nuôi analyser" cũ (xem docstring đầu file vì sao bỏ). PHẢI gọi
 * `setupAudioContext()` (core/audio-engine.js) TRƯỚC hàm này ít nhất 1 lần trong phiên (đảm bảo
 * `audioContext`/`masterGainNode`/`analyser`/`analyserPitch` tồn tại — dùng CHUNG, KHÔNG tạo
 * AudioContext thứ 2).
 * Nối qua `masterGainNode` (KHÔNG nối thẳng `analyser`/`destination`) — `masterGainNode` ĐÃ sẵn
 * `.connect(analyser)`/`.connect(analyserPitch)`/(qua analyser) `.connect(destination)` từ
 * `setupAudioContext()`, nên chỉ cần nối 1 ĐƯỜNG DUY NHẤT là có đủ CẢ 3. Nối thẳng `destination`
 * (bỏ qua `masterGainNode`) sẽ khiến video LUÔN phát ở gain mặc định (100%), KHÔNG tôn trọng thanh
 * trượt Âm lượng (`vizConfig.volume`) người dùng đã chỉnh cho Song — video cũng nên theo ĐÚNG mức
 * âm lượng chung của app.
 * `createMediaElementSource()` "chiếm" luôn audio output mặc định của element — nối qua
 * `masterGainNode` (rồi tới analyser rồi tới destination) chính là cách duy nhất để nghe lại được
 * tiếng — KHÔNG nối gì cả thì `bgVideoElement` sẽ CÂM HOÀN TOÀN dù trước đó đang phát bình thường.
 */
function connectVideoElementToAnalyser() {
    if (_videoAnalyserSourceNode) return; // guard — chỉ tạo 1 lần, gọi lại nhiều lần vô hại
    const audioContext = appState.get('audioContext');
    _videoAnalyserSourceNode = audioContext.createMediaElementSource(bgVideoElement);
    _videoAnalyserSourceNode.connect(appState.get('masterGainNode')); // -> analyser/analyserPitch/destination đã nối sẵn từ setupAudioContext()
}
