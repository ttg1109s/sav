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
 * docstring đầu file) giữa 2 chế độ — gọi ĐÚNG 1 LẦN lúc vào/thoát Video Player mode, KHÔNG liên
 * quan gì tới Next/Prev bên trong mode (xem `playVideoByKey()`, event/workflow/video-player.js).
 *
 * SỬA (30/07/2026, yêu cầu Giang — "bỏ hẳn opacity") — XOÁ HOÀN TOÀN `style.opacity` khỏi hàm này
 * (LẪN khỏi `handleVideoBackground()`/`setupVideoBgSource()`, core/state-and-video-bg.js — Video
 * nền decoration, cùng đợt sửa) — CHỈ còn `.hidden` (display:none) quyết định hiện/ẩn. Opacity
 * chưa từng có tác dụng THẬT nào riêng biệt: `display:none` đã khiến opacity vô nghĩa hoàn toàn lúc
 * ẩn, còn lúc hiện luôn set '1' NGAY CẠNH việc gỡ `.hidden` nên không có khoảng nào opacity một
 * mình quyết định trạng thái hiện/ẩn cả — thuần dư thừa, giữ lại chỉ gây hiểu nhầm có 2 cơ chế độc
 * lập trong khi thực chất chỉ 1 (`hidden`). CSS `#bg-video` cũng bỏ `opacity: 0` mặc định (assets/
 * css/style.css) — thêm `class="hidden"` NGAY TỪ HTML (index.html) làm trạng thái ẩn mặc định.
 *
 * LỊCH SỬ opacity (đã xoá, giữ lại để hiểu bối cảnh) — 21/07 tách "khung" (hàm này)/"nội dung"
 * (opacity, để `playVideoByKey()` tự set); 30/07 LẦN 1 gộp opacity vào lại đây (SAI CHỖ — chạy lặp
 * ở `playVideoByKey()` mỗi Next/Prev, vô nghĩa vì giá trị không đổi); 30/07 LẦN 2 (bản NÀY) — nhận
 * ra opacity CHƯA TỪNG cần thiết dù ở đâu, xoá hẳn, không dời đi đâu nữa.
 * SỬA (21/07/2026, Giang chỉ ra video vẫn không hiện dù đã tắt cả Visual — z-index/canvas KHÔNG
 * PHẢI nguyên nhân) — ĐỐI CHIẾU với `handleVideoBackground()` phát hiện dòng
 * `bgVideoElement.classList.remove('hidden')` (bật)/`classList.add('hidden')` (tắt) — `display:
 * none` THẮNG TUYỆT ĐỐI mọi `opacity` khác.
 * SỬA LẦN 2 (cùng ngày — Giang chỉnh lại: "index đang nằm TRÊN visual effect, phải đưa xuống THẤP
 * HƠN visual") — bỏ HẲN việc set `z-index` qua inline style — trả về ĐÚNG z-index TĨNH mặc định
 * của CSS (`#bg-video { z-index: 0; }`, GIỐNG HỆT cách "Video nền" trang trí vẫn dùng).
 * `enabled=true`: gỡ `.hidden` + bỏ muted + tắt loop (BẮT BUỘC — cần `bgVideoElement` tự bắn
 * 'ended' để tự chuyển video kế tiếp) + bật lại `pointer-events:auto` (nhận cử chỉ vuốt).
 * `enabled=false`: thêm lại `.hidden` (an toàn — Block gate đảm bảo Video nền THẬT không hề bật
 * lúc này) + trả lại muted+loop=true + pointer-events mặc định (`''`).
 * @param {boolean} enabled
 */
function setBgVideoElementForPlayerMode(enabled) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.loop = !enabled;
    bgVideoElement.classList.toggle('hidden', !enabled); // BẮT BUỘC — display:none thắng tuyệt đối opacity — DUY NHẤT cơ chế hiện/ẩn, KHÔNG còn opacity
    bgVideoElement.style.pointerEvents = enabled ? 'auto' : '';
}

/** Core thuần — hiện/ẩn overlay thumb full-res (`videoThumbOverlay`, #video-player-thumb-overlay,
 * core/dom-refs.js) nằm NGAY TRÊN `bgVideoElement` (z-index, xem assets/css/style.css). MỚI
 * (30/07/2026, yêu cầu Giang — lấp khoảng chớp đen lúc Next/Prev Video Player mode): `bgVideoElement`
 * đổi `src` LUÔN reset readyState về HAVE_NOTHING tức thời (xem docstring `playVideoByKey()`,
 * event/workflow/video-player.js) — trong khoảng đó overlay này hiện tạm khung `thumbFullBlob`
 * (full-res, frame 1, service/db.js) của ĐÚNG video mới đang tải, che đúng chỗ đen lộ ra.
 *
 * KHÔNG tự `URL.createObjectURL`/`revokeObjectURL` — lifecycle object URL do Workflow tự quản lý
 * (`_thumbFullObjectUrl`, event/workflow/video-player.js), giống hệt cách `_objectUrl`/
 * `_thumbObjectUrl` đã làm — hàm này CHỈ nhận `url` (string đã tạo sẵn, hoặc `null`) qua tham số
 * (Rule 2 — không tự đọc gì), guard clause đơn tuyến (Rule 1 — `null` thì ẩn+xoá, có giá trị thì
 * hiện+gán, CÙNG 1 nghiệp vụ "đồng bộ overlay theo url truyền vào", không phải 2 tiến trình khác
 * nhau — cùng khuôn `setBgVideoElementForPlayerMode()` ở trên).
 * @param {string|null} url - object URL của thumbFullBlob, hoặc `null` để ẩn/xoá.
 */
/** Core thuần — THỬ NGHIỆM (30/07/2026, yêu cầu Giang, sau khi overlay `<div>` riêng
 * (`#video-player-thumb-overlay`) không ăn thua dù log DOM đúng — nghi compositing-layer riêng của
 * `<video>` trên WKWebView không composite đúng thứ tự với 1 ELEMENT KHÁC đứng cạnh nó dù z-index
 * cao hơn) — gán/xoá `background-image` THẲNG lên CHÍNH `bgVideoElement` (không qua `videoThumbOverlay`
 * nữa — element đó tạm thời KHÔNG dùng, còn nguyên trong DOM/CSS, chưa xoá vì đây mới là thử
 * nghiệm). `<video>` là "replaced element": lúc `readyState=HAVE_NOTHING` (chưa có khung hình),
 * `background-image` của CHÍNH nó hiện ra thay thế — không có 2 element khác nhau để trình duyệt
 * "đấu" thứ tự compositing nữa, né hẳn nghi vấn quirk ở trên.
 *
 * KHÔNG tự `URL.createObjectURL`/`revokeObjectURL` — lifecycle object URL do Workflow tự quản lý
 * (`_thumbFullObjectUrl`, event/workflow/video-player.js). Guard clause đơn tuyến (Rule 1) — `null`
 * thì xoá, có giá trị thì gán, cùng 1 nghiệp vụ "đồng bộ background-image theo url truyền vào".
 * @param {string|null} url - object URL của thumbFullBlob, hoặc `null` để xoá.
 */
function setVideoThumbOverlay(url) {
    console.log('[DBG-video] setVideoThumbOverlay(url=', url, ') — trước — bgVideoElement.style.backgroundImage:', bgVideoElement.style.backgroundImage);
    bgVideoElement.style.backgroundImage = url ? `url(${url})` : '';
    console.log('[DBG-video] setVideoThumbOverlay() — sau — bgVideoElement.style.backgroundImage:', bgVideoElement.style.backgroundImage);
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
