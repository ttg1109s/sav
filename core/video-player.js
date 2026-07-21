/**
 * core/video-player.js — MỚI (21/07/2026, mục 4). "Video Player mode": phát video làm nội dung
 * chính trên màn Visualizer (KHÁC hẳn "Video nền" trang trí — core/state-and-video-bg.js, file đó
 * KHÔNG đụng gì ở đây). Next/Prev/Play/Pause tái dùng ĐÚNG nút vật lý của Playlist nhạc (event/
 * router/player-controls.js branch qua VirtualMachineState theo `isVideoPlayerMode`) — file NÀY
 * chỉ chứa phần LÕI thuần: tính key kế tiếp/trước, mutate state, toggle UI nút — KHÔNG đụng
 * `audioPlayer`/`bgVideoElement` (điều phối 2 element đó cần async đọc DB -> thuộc Workflow, xem
 * event/workflow/video-player.js).
 *
 * QUYẾT ĐỊNH KIẾN TRÚC (đã bàn với Giang) — 2 element ĐỘC LẬP cùng trỏ 1 blob video:
 *   - `audioPlayer` (thẻ <audio> có sẵn, ĐÃ gắn cứng `createMediaElementSource()` nuôi analyser ở
 *     core/audio-engine.js — KHÔNG đụng file đó) — nhận blob video, tự ĐỘNG chỉ giải mã track ÂM
 *     THANH (hành vi chuẩn của thẻ audio), MUTED — vai trò DUY NHẤT: nuôi FFT cho visualizer.
 *   - `bgVideoElement` (#bg-video, TÁI DÙNG — không tạo element mới, "giống cách bg video" đúng
 *     yêu cầu Giang) — cùng blob, giải mã ĐẦY ĐỦ hình + tiếng, KHÔNG muted — đây là cái người dùng
 *     thấy + nghe thật. `muted`/`loop` đổi qua lại giữa 2 chế độ (nền trang trí: muted+loop=true;
 *     Player mode: muted=false+loop=false) — xem `setBgVideoElementForPlayerMode()` ngay dưới.
 *   - 2 element KHÔNG dùng chung cơ chế `videoBgEnabled`/`videoBgUrl`/`syncVideoBgToAudio()` của
 *     Video nền (cố ý TÁCH HẲN, tránh rò rỉ state giữa 2 tính năng — xem event/workflow/video-
 *     player.js::enterVideoPlayerMode(), tự tắt Video nền SẠCH trước khi chiếm `bgVideoElement`).
 *
 * ĐƠN GIẢN HOÁ Ở BẢN ĐẦU (đã báo Giang) — danh sách video phát TUẦN TỰ theo thứ tự thêm vào (cũ ->
 * mới), KHÔNG có shuffle/repeat/wake-lock/Media-Session riêng cho video (dùng lại nguyên các cơ chế
 * đó của audioPlayer — vì audioPlayer vẫn đang thật sự phát, dù muted).
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

/** Đổi `muted`/`loop`/`opacity` của `bgVideoElement` (#bg-video, TÁI DÙNG — xem docstring đầu file)
 * giữa 2 chế độ. `enabled=true` (vào Player mode): bỏ muted (nghe tiếng thật) + tắt loop (cần bắt
 * được sự kiện hết video để tự chuyển tiếp — thật ra 'ended' bắt trên `audioPlayer`, xem event/
 * router/player-controls.js, nhưng tắt loop ở ĐÂY để 2 element hết video CÙNG LÚC, không lệch pha)
 * + hiện luôn (`opacity: 1`, KHÔNG dùng class `.hidden` — cơ chế gốc của #bg-video (core/state-and-
 * video-bg.js) CHỈ dùng `opacity`, KHÔNG bao giờ đụng `.hidden`; nếu ở đây thêm `.hidden` thì lúc
 * thoát Player mode + khôi phục Video nền thật, `handleVideoBackground()` chỉ biết sửa `opacity`
 * chứ KHÔNG gỡ `.hidden` — video nền sẽ kẹt vô hình `display:none` mãi mãi, dù opacity đã về 1).
 * `enabled=false` (thoát Player mode): trả lại ĐÚNG mặc định trang trí (muted+loop=true) + ẩn
 * (`opacity: 0`) — nếu Video nền thật cần hiện lại, `handleVideoBackground()` (gọi NGAY SAU hàm
 * này, xem event/workflow/video-player.js::exitVideoPlayerMode()) sẽ tự sửa lại opacity đúng, ở
 * đây chỉ cần đặt giá trị TẠM AN TOÀN (ẩn) phòng trường hợp không có Video nền nào cần khôi phục.
 * @param {boolean} enabled
 */
function setBgVideoElementForPlayerMode(enabled) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.loop = !enabled;
    bgVideoElement.style.opacity = enabled ? '1' : '0';
}

// SỬA (21/07/2026, cùng ngày) — `updateVideoPlayerToggleButtonUI()` (đổi màu nút header) ĐÃ XOÁ —
// nút "Play mode" ở header Visualizer đã dời hẳn sang checkbox trong panel File Manager -> Video
// (components/file-manager.js::renderFileManagerVideoPanelBody()) — checkbox tự đồng bộ `.checked`
// trực tiếp trong event/workflow/file-manager-video.js lúc mở panel, không cần hàm core riêng.
