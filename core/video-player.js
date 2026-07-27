/**
 * core/video-player.js — MỚI (21/07/2026, mục 4). "Video Player mode": phát video làm nội dung
 * chính trên màn Visualizer (KHÁC hẳn "Video nền" trang trí — core/state-and-video-bg.js, file đó
 * KHÔNG đụng gì ở đây).
 * [SỬA — ver12 "Song/Video Unification", Batch 2] Next/Prev KHÔNG còn branch VirtualMachineState
 * theo `isVideoPlayerMode` nữa — LUÔN gọi `playNext()`/`playPrev()` (core/player-controls.js,
 * dùng CHUNG với Song) bất kể nguồn nào, xem event/router/player-controls.js. CHỈ Play/Pause + 5
 * sự kiện DOM của `bgVideoElement` + progressBar seek CÒN branch theo `isVideoPlayerMode` (khác
 * biệt DUY NHẤT còn lại là ELEMENT nào đang thực sự phát — `bgVideoElement` hay `audioPlayer` —
 * KHÔNG phải "danh sách phát tiếp theo là gì", cái đó dùng chung 100%). File NÀY chỉ chứa phần LÕI
 * thuần: mutate state, toggle UI nút — KHÔNG đụng `bgVideoElement` trực tiếp cho việc phát (điều
 * phối cần async đọc DB -> thuộc Workflow, xem event/workflow/video-player.js).
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
 * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt: "video thừa hưởng cơ chế Playlist
 * sẵn có, không tạo cơ chế next/prev riêng — có là đang tạo exception"] TOÀN BỘ đoạn "ĐƠN GIẢN HOÁ
 * Ở BẢN ĐẦU" trên ĐÃ LỖI THỜI — Next/Prev/shuffle/repeat của Video giờ KHÔNG còn mảng
 * `videoPlaylist`/`currentVideoKey` RIÊNG nữa, dùng CHUNG `displayOrder`/`shuffleIndices`/
 * `currentKey` (package `playlist`, đã có sẵn `sortKeysByMode()` newest/oldest cho Video từ Batch
 * 1) qua ĐÚNG 1 cơ chế `playNext()`/`playPrev()` (core/player-controls.js, xem comment tại đó) —
 * `computeNextVideoKey()`/`computePrevVideoKey()`/`pickRandomVideoKeyExcluding()` ĐÃ XOÁ (dead code,
 * không còn ai gọi). `enterVideoPlayerModeState()`/`exitVideoPlayerModeState()` giờ CHỈ còn việc
 * DUY NHẤT: toggle `isVideoPlayerMode` — cờ này vẫn cần riêng (quyết định `bgVideoElement` hay
 * `audioPlayer` đang thực sự phát, dùng ở Router/nhiều Core khác), KHÔNG liên quan gì tới việc
 * TÍNH key kế tiếp/trước nữa.
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

/** Đổi `muted`/`loop`/`pointer-events`/`.hidden` của `bgVideoElement` (#bg-video, TÁI DÙNG — xem
 * docstring đầu file) giữa 2 chế độ. KHÔNG đụng `opacity` ở ĐÂY nữa (SỬA 21/07/2026, đợt so sánh
 * 2 luồng — xem event/workflow/video-player.js::playVideoByKey()) — `handleVideoBackground()`
 * (core/state-and-video-bg.js, luồng bg video THAM CHIẾU) cũng KHÔNG set opacity trong nhánh bật,
 * mà giao hẳn cho `setupVideoBgSource()` (gọi RIÊNG mỗi lần đổi URL) tự quản lý fade-in — file NÀY
 * mirror ĐÚNG cách chia việc đó: hàm này (gọi 1 LẦN lúc vào/ra mode) chỉ lo phần "khung"
 * (hidden/muted/loop/pointer-events), còn "nội dung" (opacity theo TỪNG video) do
 * `playVideoByKey()` tự lo (gọi mỗi lần đổi video, kể cả Next/Prev).
 * SỬA (21/07/2026, Giang chỉ ra video vẫn không hiện dù đã tắt cả Visual — z-index/canvas KHÔNG
 * PHẢI nguyên nhân) — ĐỐI CHIẾU với `handleVideoBackground()` phát hiện dòng
 * `bgVideoElement.classList.remove('hidden')` (bật)/`classList.add('hidden')` (tắt) — bản trước
 * của hàm NÀY CHỈ đổi `style.opacity`, KHÔNG BAO GIỜ gỡ class `.hidden` (Tailwind, `display:
 * none`) — `display:none` THẮNG TUYỆT ĐỐI mọi `opacity` khác.
 * SỬA LẦN 2 (cùng ngày — Giang chỉnh lại: "index đang nằm TRÊN visual effect, phải đưa xuống THẤP
 * HƠN visual") — bỏ HẲN việc set `z-index` qua inline style — trả về ĐÚNG z-index TĨNH mặc định
 * của CSS (`#bg-video { z-index: 0; }`, GIỐNG HỆT cách "Video nền" trang trí vẫn dùng).
 * `enabled=true`: gỡ `.hidden` + bỏ muted + tắt loop (BẮT BUỘC — cần `bgVideoElement` tự bắn
 * 'ended' để tự chuyển video kế tiếp) + bật lại `pointer-events:auto` (nhận cử chỉ vuốt).
 * `enabled=false`: thêm lại `.hidden` (an toàn — Block gate đảm bảo Video nền THẬT không hề bật
 * lúc này) + trả lại muted+loop=true + ẩn hẳn (`opacity:0`, CHỈ trường hợp NÀY hàm mới đụng
 * opacity — khớp `handleVideoBackground()` nhánh tắt: `bgVideoElement.style.opacity = '0';` ngay
 * dòng đầu) + pointer-events mặc định (`''`).
 * @param {boolean} enabled
 */
function setBgVideoElementForPlayerMode(enabled) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.loop = !enabled;
    bgVideoElement.classList.toggle('hidden', !enabled); // BẮT BUỘC — display:none thắng tuyệt đối opacity
    if (!enabled) bgVideoElement.style.opacity = '0'; // khớp handleVideoBackground() nhánh tắt — enabled=true KHÔNG đụng opacity, xem docstring
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
