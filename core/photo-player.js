/**
 * core/photo-player.js — Photo Player mode: ảnh tĩnh phát làm nội dung chính trên màn Visualizer (có thời lượng như
 * Song/Video, phát im lặng). Đồng hồ giả là các field của package `photo-player-mode` (service/state/photo-player-mode.js);
 * file này chỉ tính thuần từ các field đó và ghi UI của player. Vòng tick, đọc/ghi state, tua/dừng đồng hồ cho Next/Prev ở
 * event/workflow/photo-player.js.
 *
 * `clock` dùng chung cho các hàm tính: { photoPlayerPaused, photoPlayerClockHeld, photoPlayerEnded,
 * photoPlayerElapsedBeforePauseSec, photoPlayerStartedAtMs, photoPlayerDurationSec } (đúng tên key appState).
 *
 * NẠP SAU: service/state.js, core/dom-refs.js.
 */

/** Vào mode: ảnh không có tốc độ phát, không ghi âm cùng, không tua tay — ẩn icon Speed, icon Ghi âm, thanh seek. Nhãn
 * giờ vẫn cập nhật mỗi giây. */
function enterPhotoPlayerModeState() {
    appState.set('isPhotoPlayerMode', true);
    console.log(`writer: "enterPhotoPlayerModeState", page: "isPhotoPlayerMode", content: "true"`);
    if (progressBarRow) progressBarRow.classList.add('hidden');
    if (btnOpenSpeed) btnOpenSpeed.classList.add('hidden');
    if (btnRecordStart) btnRecordStart.classList.add('hidden');
}

function exitPhotoPlayerModeState() {
    appState.set('isPhotoPlayerMode', false);
    console.log(`writer: "exitPhotoPlayerModeState", page: "isPhotoPlayerMode", content: "false"`);
    if (progressBarRow) progressBarRow.classList.remove('hidden');
    if (btnOpenSpeed) btnOpenSpeed.classList.remove('hidden');
    if (btnRecordStart) btnRecordStart.classList.remove('hidden');
}

/** Elapsed (giây) hiện tại. Đang dừng hoặc đang giữ (chờ Transition vào xong) thì đồng hồ đứng yên. Không kẹp trần.
 * @param {object} clock @param {number} nowMs - performance.now() @returns {number} */
function computePhotoPlayerElapsedSec(clock, nowMs) {
    if (clock.photoPlayerPaused || clock.photoPlayerClockHeld) return clock.photoPlayerElapsedBeforePauseSec;
    return clock.photoPlayerElapsedBeforePauseSec + Math.max(0, (nowMs - clock.photoPlayerStartedAtMs) / 1000);
}

/** Kết quả 1 nhịp tick: `frozen` (dừng / giữ / đã báo hết — không làm gì), `ended` (vừa chạm thời lượng), `running`
 * (cập nhật nhãn giờ, kẹp trần theo thời lượng).
 * @param {object} clock @param {number} elapsedSec - computePhotoPlayerElapsedSec()
 * @returns {{ phase: 'frozen'|'ended'|'running', displayElapsedSec: number }} */
function computePhotoPlayerTickView(clock, elapsedSec) {
    const isFrozen = clock.photoPlayerPaused || clock.photoPlayerClockHeld || clock.photoPlayerEnded;
    const isEnded = elapsedSec >= clock.photoPlayerDurationSec;
    return {
        phase: isFrozen ? 'frozen' : (isEnded ? 'ended' : 'running'),
        displayElapsedSec: Math.min(elapsedSec, clock.photoPlayerDurationSec),
    };
}

/** Đồng hồ sau khi Pause: chốt elapsed tại thời điểm bấm.
 * @param {object} clock @param {number} elapsedSec - computePhotoPlayerElapsedSec() lúc bấm
 * @returns {{ elapsedBeforePauseSec: number, startedAtMs: number, ended: boolean, restarted: boolean }} */
function computePhotoPlayerClockOnPause(clock, elapsedSec) {
    return { elapsedBeforePauseSec: elapsedSec, startedAtMs: clock.photoPlayerStartedAtMs, ended: clock.photoPlayerEnded, restarted: false };
}

/** Đồng hồ sau khi Play: chạy tiếp từ chỗ đã chốt; ảnh đã báo hết (dừng ở cuối playlist) thì phát lại từ 0 — cùng cách
 * HTMLMediaElement đã `ended` được play() lại.
 * @param {object} clock @param {number} nowMs
 * @returns {{ elapsedBeforePauseSec: number, startedAtMs: number, ended: boolean, restarted: boolean }} */
function computePhotoPlayerClockOnResume(clock, nowMs) {
    return {
        elapsedBeforePauseSec: clock.photoPlayerEnded ? 0 : clock.photoPlayerElapsedBeforePauseSec,
        startedAtMs: nowMs,
        ended: false,
        restarted: clock.photoPlayerEnded,
    };
}

/** Thời lượng Point Move và mốc "advance" giao Image surface: Point Move trải hết thời gian ảnh thật sự hiện = Transition
 * vào (chỉ khi surface đang có ảnh và slot bật Transition) + thời lượng ảnh.
 * @param {number} durationSec @param {boolean} surfaceHasContent @param {{transitionEnabled: boolean, transitionDurationMs: number}} transitionPreset
 * @returns {{ pointMoveDurationMs: number, advanceMs: number }} */
function computePhotoPlayerSurfaceTiming(durationSec, surfaceHasContent, transitionPreset) {
    const pointMoveDurationMs = durationSec * 1000;
    const transitionMs = (surfaceHasContent && transitionPreset.transitionEnabled) ? transitionPreset.transitionDurationMs : 0;
    return { pointMoveDurationMs, advanceMs: pointMoveDurationMs + transitionMs };
}

/** Tên + album + Media Session của ảnh đang phát (Photo không có artist). @param {string} title @param {string} album */
function applyPhotoPlayerTrackInfo(title, album) {
    setPlayerTitleText(title);
    playerArtist.textContent = ''; playerAlbum.textContent = album;
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title, artist: '', artwork: [] });
}

/** Nhãn current/duration (thanh seek đã ẩn). @param {string} currentLabel @param {string} durationLabel - đã formatTime() */
function updatePhotoPlayerTimeLabels(currentLabel, durationLabel) {
    currentTimeDisplay.textContent = currentLabel;
    durationTimeDisplay.textContent = durationLabel;
}

/** Icon Play/Pause, record-art quay/dừng, trạng thái Media Session. @param {boolean} isPlaying */
function updatePhotoPlayerPlayPauseIcon(isPlaying) {
    iconPlay.classList.toggle('hidden', isPlaying);
    iconPause.classList.toggle('hidden', !isPlaying);
    const recordArtDynamic = document.getElementById('record-art');
    if (recordArtDynamic) recordArtDynamic.classList.toggle('paused', !isPlaying);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}
