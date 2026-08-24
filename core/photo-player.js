/**
 * core/photo-player.js — "Photo Player mode": ảnh tĩnh phát làm nội dung chính trên màn Visualizer
 * (MỚI Giang yêu cầu — Photo tích hợp `duration` như Song/Video).
 *
 * SỬA (Giang chỉ ra đúng — "vbg chỉ hợp lệ với song thì quan tâm gì đang phát video/photo bị ngắt
 * quãng, kiểm tra lại logic") — TRƯỚC ĐÂY dựng RIÊNG `#photo-player-image` (lo sợ tranh giành nội
 * dung với `#visual-bg-image` của VBG) — THỪA: VBG chỉ có ý nghĩa lúc Song đang phát (nền trang trí
 * đằng sau visualizer phản ứng audio), tự nhiên KHÔNG áp dụng lúc Photo (hay Video) đang phát —
 * không có gì để "tranh giành" cả. Video Player mode đã giải quyết ĐÚNG bài toán này từ trước bằng
 * `workflowVisualBg.clearMediaLayers()` (gọi lúc VÀO mode — dọn lớp VBG đang hiện, KHÔNG đụng cấu
 * hình đã lưu) + `applyCurrentVisualBg()` (gọi lúc THOÁT mode — khôi phục ĐÚNG theo cấu hình) — xem
 * event/workflow/visual-bg.js. Photo giờ dùng LẠI ĐÚNG cặp hàm đó (event/workflow/photo-player.js),
 * hiện ảnh qua `applyVisualBgImageToDOM()` (core/visual-bg.js, tái dùng `#visual-bg-image`) — file
 * này KHÔNG còn hàm toggle DOM nào của riêng Photo nữa, ĐÃ XOÁ `setPhotoPlayerElementForMode()`
 * (dọn code thừa) + element `#photo-player-image`/`photoPlayerImageEl` (assets/css/base.css,
 * index.html, core/dom-refs.js).
 *
 * Ảnh KHÔNG có audio/HTMLMediaElement thật — "đồng hồ" (elapsed/pause/resume) là state tự viết
 * (`photoPlayerElapsedBeforePauseSec`/`photoPlayerStartedAtMs`/`photoPlayerPaused`, package
 * "photo-player-mode", service/state/photo-player-mode.js), file này chỉ tính TOÁN THUẦN từ 3 field
 * đó (Rule 2 — nhận qua tham số, không tự appState.get()) + toggle UI progress bar/icon. Vòng lặp
 * taskManager tự đếm giờ + đọc/ghi appState sống ở event/workflow/photo-player.js (Rule 3 — core
 * không dùng taskManager).
 *
 * Next/Prev/shuffle/repeat DÙNG CHUNG cơ chế Playlist (`workflowPlayerControls.goToNextTrack()`/
 * `goToPrevTrack()`) — không có logic riêng cho Photo, giống hệt Video đã làm.
 *
 * NẠP SAU: service/state.js.
 */

/** Bật/tắt state Photo Player mode — gọi lúc BẮT ĐẦU/KẾT THÚC mode (event/workflow/photo-player.js
 * ::startFromPlaylist()/exitPhotoPlayerMode()). `currentKey` (package `playlist`, DÙNG CHUNG với
 * Song/Video) do Workflow tự lo riêng, KHÔNG thuộc phạm vi 2 hàm này — mirror enterVideoPlayerModeState()/
 * exitVideoPlayerModeState() (core/video-player.js). */
function enterPhotoPlayerModeState() {
    appState.set('isPhotoPlayerMode', true);
}
function exitPhotoPlayerModeState() {
    appState.set('isPhotoPlayerMode', false);
}

/** Tính elapsed (giây) HIỆN TẠI từ 3 field đồng hồ giả — THUẦN, không side-effect, gọi lại nhiều
 * lần tuỳ ý (progress bar tick, seek, kiểm tra "đã hết chưa" mỗi lần taskManager tick). Lúc đang
 * pause: elapsed = `elapsedBeforePauseSec` (đồng hồ đứng yên). Lúc đang chạy: cộng thêm khoảng thời
 * gian THẬT đã trôi kể từ `startedAtMs` (performance.now() lúc resume/seek gần nhất).
 * @param {number} elapsedBeforePauseSec
 * @param {number} startedAtMs
 * @param {boolean} paused
 * @param {number} nowMs - performance.now() tại thời điểm gọi (Rule 2 — nhận qua tham số)
 * @returns {number} giây, số thực, KHÔNG kẹp trần theo durationSec (nơi gọi tự so sánh để biết
 *          "đã hết" — xem event/workflow/photo-player.js::_photoPlayerTick()).
 */
function computePhotoPlayerElapsedSec(elapsedBeforePauseSec, startedAtMs, paused, nowMs) {
    if (paused) return elapsedBeforePauseSec;
    return elapsedBeforePauseSec + Math.max(0, (nowMs - startedAtMs) / 1000);
}

/** Cập nhật progress bar + hiển thị thời gian — mirror `handleAudioTimeUpdate()`/
 * `workflowVideoPlayer.handleVideoTimeUpdate()` (core/player-controls.js) nhưng nhận `elapsedSec`/
 * `durationSec` tính SẴN qua tham số (Rule 2) thay vì đọc `audioPlayer.currentTime`/`.duration`.
 * KHÔNG gọi lúc `appState.isSeeking===true` — nơi gọi tự guard (xem event/workflow/photo-player.js).
 * @param {number} elapsedSec
 * @param {number} durationSec
 */
function updatePhotoPlayerProgressUI(elapsedSec, durationSec) {
    const clampedElapsed = Math.min(elapsedSec, durationSec);
    progressBar.max = durationSec;
    progressBar.value = clampedElapsed;
    currentTimeDisplay.textContent = formatTime(clampedElapsed); // core/playlist/state.js
    durationTimeDisplay.textContent = formatTime(durationSec);
    updateProgressBarCSS(); // core/player-controls.js
}

/** Đổi icon Play/Pause + trạng thái quay của record-art — mirror `handleAudioPlay()`/
 * `handleAudioPause()` (core/player-controls.js) phần UI thuần (KHÔNG có phần "bắt đầu/dừng đếm
 * thời gian nghe thật" — nghe ẢNH không tính vào "thời gian nghe nhạc", 2 khái niệm khác nhau).
 * @param {boolean} isPlaying
 */
function updatePhotoPlayerPlayPauseIcon(isPlaying) {
    iconPlay.classList.toggle('hidden', isPlaying);
    iconPause.classList.toggle('hidden', !isPlaying);
    const recordArtDynamic = document.getElementById('record-art');
    if (recordArtDynamic) recordArtDynamic.classList.toggle('paused', !isPlaying);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

/** "Media element GIẢ" cho Photo — KHÔNG phải HTMLMediaElement thật, mô phỏng ĐÚNG 4 thành viên mà
 * `getActiveMediaElement()` (core/player-controls.js) cần trả để 2 nơi gọi HIỆN CÓ
 * (`workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()`, event/workflow/player-controls.js
 * VÀ event/workflow/gameplay.js) tiếp tục hoạt động ĐÚNG khi `isPhotoPlayerMode=true` — KHÔNG cần
 * sửa logic bên trong từng nơi gọi đó, chỉ cần chúng truyền thêm `isPhotoPlayerMode` vào
 * `getActiveMediaElement()`.
 *
 * NGOẠI LỆ CÓ CHỦ Ý với Rule 2 (core-function-conventions.md, "core không tự appState.get()") —
 * hình dạng interface BẮT BUỘC là property access (`el.currentTime`/`el.paused`, giống hệt
 * HTMLMediaElement thật — trình duyệt cũng không nhận tham số cho property access), KHÔNG có chỗ
 * nào để "nơi gọi tự đọc appState rồi truyền vào" như quy tắc chuẩn đòi hỏi — getter/setter dưới
 * đây bắt buộc tự đọc/ghi appState ngay bên trong để giữ ĐÚNG hình dạng interface đó.
 *
 * `play()`/`pause()` ở đây CHỈ đổi cờ `photoPlayerPaused` — KHÔNG tự khởi động/dừng vòng lặp
 * taskManager (Rule 3 — core cấm dùng taskManager). Vòng lặp đó (event/workflow/photo-player.js::
 * _photoPlayerTick()) chạy LIÊN TỤC suốt lúc `isPhotoPlayerMode=true` (KHÔNG kill lúc pause, CHỈ
 * kill lúc đổi ảnh/thoát mode) — mỗi tick tự đọc lại `photoPlayerPaused`, nên gọi `play()`/`pause()`
 * qua đường NÀY (vd từ `goToNextTrack()`'s "restart" branch) vẫn được tick nhận lại đúng ở chu kỳ
 * kế tiếp mà không cần chính object này đụng gì tới taskManager.
 */
const photoPlayerFakeMediaElement = {
    get currentTime() {
        const { photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, photoPlayerPaused } = appState.get([
            'photoPlayerElapsedBeforePauseSec', 'photoPlayerStartedAtMs', 'photoPlayerPaused',
        ]);
        return computePhotoPlayerElapsedSec(photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, photoPlayerPaused, performance.now());
    },
    set currentTime(value) {
        // Nơi gọi hiện có CHỈ gán đúng giá trị 0 (repeat-single "tua về đầu", Prev "quá 3s thì về
        // đầu") — seek tuỳ ý THẬT đi qua handlePhotoSeekCommit() (event/workflow/photo-player.js),
        // KHÔNG qua đường này.
        appState.set('photoPlayerElapsedBeforePauseSec', value, { skipCheck: true });
        appState.set('photoPlayerStartedAtMs', performance.now(), { skipCheck: true });
    },
    get paused() {
        return appState.get('photoPlayerPaused');
    },
    get duration() {
        return appState.get('photoPlayerDurationSec');
    },
    play() {
        appState.set('photoPlayerPaused', false, { skipCheck: true });
    },
    pause() {
        appState.set('photoPlayerPaused', true, { skipCheck: true });
    },
};

