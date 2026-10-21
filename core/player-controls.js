/**
 * core/player-controls.js — Core điều khiển phát: chuyển màn Playlist <-> Visualizer, nút Shuffle/Repeat, Media Session,
 * thanh tiến trình + nhãn giờ, icon play/pause theo sự kiện audio.
 *
 * Điều phối (đọc state, hẹn giờ, chọn hàm) ở event/workflow/player-controls.js; sự kiện DOM ở
 * event/listener/player-controls.js → event/router/player-controls.js.
 */

        /** Về Playlist: trượt #app-stack vào + gỡ trạng thái Visualizer (canvas mờ đi, UI trượt ra cùng nhịp thanh player).
         * Không đổi `isVisualizerActive` — nơi gọi tự `setVisualizerActiveFalse()` nếu cần. Workflow `returnToPlaylistUI()`
         * cuộn Playlist trước, hẹn ẩn hẳn bằng `hideVisualizerUiAfterFade()`. */
        function slideBackToPlaylistUi() {
            canvas.classList.add('opacity-0');
            const webglCanvasEl = document.getElementById('webgl-canvas');
            if (webglCanvasEl) webglCanvasEl.classList.add('opacity-0');
            appStack.classList.remove('playlist-hidden');
            visualizerUI.classList.remove('visualizer-active');
            playerContainer.classList.remove('visualizer-active');
        }

        /** Ẩn hẳn UI Visualizer sau khi Playlist trượt vào xong. */
        function hideVisualizerUiAfterFade() {
            visualizerUI.classList.add('hidden');
            playerContainer.classList.add('hidden');
        }

        // Sân khấu Visualizer khi ra/vào Playlist — CSS: assets/css/layout-nav.css ("playlist-offstage" /
        // "visual-stage-offstage", chỉ có hiệu lực <1024px; desktop 2 cột hiện song song).

        /** Media query của bố cục xếp chồng — khớp breakpoint 1024px ở layout-nav.css (cũng dùng ở event/listener/player-controls.js). */
        const STACKED_SCREEN_LAYOUT_QUERY = '(max-width: 1023px)';

        /** Bố cục xếp chồng (<1024px): Playlist và Visualizer trượt đè nhau. @returns {boolean} */
        function isStackedScreenLayout() {
            return window.matchMedia(STACKED_SCREEN_LAYOUT_QUERY).matches;
        }

        /** Chặn/mở mọi tương tác trong #visualizer-ui (`inert`) — bật lúc UI đang trượt ra về Playlist. @param {boolean} isInert */
        function setVisualizerUiInert(isInert) {
            visualizerUI.inert = isInert;
        }

        /** Đưa Playlist ra khỏi cây render (class trên #app-stack) hoặc trả lại. @param {boolean} isOffstage */
        function setPlaylistOffstage(isOffstage) {
            appStack.classList.toggle('playlist-offstage', isOffstage);
        }

        /** Đưa `#visualizer-stage` (video/ảnh nền, lớp Motion, 2 canvas) ra khỏi cây render hoặc trả lại — media vẫn phát
         * tiếng. `keepVideo` (Video Player mode): chỉ ẩn bằng visibility — `<video>` bị display:none thì iOS tự pause nó.
         * @param {boolean} isOffstage @param {boolean} keepVideo */
        function setVisualStageOffstage(isOffstage, keepVideo) {
            const stageEl = document.getElementById('visualizer-stage');
            stageEl.classList.toggle('visualizer-stage-offstage', isOffstage && !keepVideo);
            stageEl.classList.toggle('visualizer-stage-offstage-keep-video', isOffstage && keepVideo);
        }

        /** Video nền đang thật sự hiển thị (VBG-Video của Song: `#bg-video` gỡ 'hidden' + có nguồn). @returns {boolean} */
        function isBgVideoShown() {
            return !bgVideoElement.classList.contains('hidden') && !!bgVideoElement.currentSrc;
        }

        /** Media đã đủ dữ liệu phát liền mạch (readyState HAVE_ENOUGH_DATA). @param {number} readyState @returns {boolean} */
        function isMediaReadyToPlayThrough(readyState) {
            return readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA;
        }

        /** URL ảnh (blob:/http:) đang làm nền HIỂN THỊ trên sân khấu: `#visual-bg-image` + 2 lớp ảnh Motion (VBG-Photo) nếu
         * container đang hiện. @returns {string[]} */
        function collectVisualStageImageUrls() {
            const els = [document.getElementById('visual-bg-image')];
            const motionContainer = document.getElementById('visual-bg-photo-motion-container');
            if (motionContainer && !motionContainer.classList.contains('hidden')) {
                els.push(...motionContainer.querySelectorAll('.me-pointmove-pan'));
            }
            const urls = [];
            els.forEach((el) => {
                if (!el || el.classList.contains('hidden')) return; // guard — lớp đang ẩn không cần chờ
                const match = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage || '');
                if (match) urls.push(match[1]);
            });
            return urls;
        }

        /** Chờ 1 ảnh giải mã xong (cùng URL -> lấy lại từ bộ nhớ đệm). Lỗi cũng kết thúc lượt chờ.
         * @param {string} url @returns {Promise<string>} 'decoded' | 'error' */
        function waitImageUrlDecoded(url) {
            const img = new Image();
            img.src = url;
            return img.decode().then(() => 'decoded', () => 'error');
        }

        /** Nhãn Bottom Player — chuỗi rỗng thì ô đó trống chữ (vẫn giữ chỗ). @param {string} title @param {string} artist @param {string} album */
        function setPlayerTrackLabels(title, artist, album) {
            playerTitle.textContent = title;
            playerArtist.textContent = artist; playerAlbum.textContent = album;
        }

        /** Thông tin media trên thông báo/màn khoá (Media Session); trình duyệt không hỗ trợ thì bỏ qua.
         * @param {string} title @param {string} artist @param {Array<{src: string, sizes: string, type: string}>} artwork */
        function setMediaSessionMetadata(title, artist, artwork) {
            if (!('mediaSession' in navigator)) return; // guard — trình duyệt không có Media Session
            navigator.mediaSession.metadata = new MediaMetadata({ title, artist, artwork });
        }

        function setVisualizerActiveFalse() {
            appState.set('isVisualizerActive', false);
            console.log(`writer: "setVisualizerActiveFalse", page: "isVisualizerActive", content: "false"`);
        }

        // Vào Visualizer — 3 bước, Workflow `switchToVisualizer()` điều phối (cuộn Playlist, hẹn fade-in canvas).

        /** Bước 1 — bắt đầu trượt Playlist ra. */
        function slidePlaylistOut() {
            appStack.classList.add('playlist-hidden');
        }

        /** Bước 2 — đánh dấu đang ở Visualizer + hiện UI Visualizer ngay (trượt vào cùng lúc Playlist thoát). */
        function showVisualizerUi() {
            appState.set('isVisualizerActive', true);
            console.log(`writer: "showVisualizerUi", page: "isVisualizerActive", content: "true"`);
            visualizerUI.classList.remove('hidden'); playerContainer.classList.remove('hidden');
            visualizerUI.classList.add('visualizer-active'); playerContainer.classList.add('visualizer-active');
            visualizerUI.classList.add('fade-enter-active');
            visualizerUI.inert = false;
        }

        /** Bước 3 — fade-in canvas. 'vortex'/'connector' vẽ trên #webgl-canvas nên gỡ cả lớp mờ của canvas đó
         * (về Playlist luôn thêm opacity-0 cho cả 2). @param {string} vizType */
        function revealVisualizerCanvas(vizType) {
            canvas.classList.remove('opacity-0');
            if (vizType !== 'vortex' && vizType !== 'connector') return; // guard — chỉ 2 type này dùng chung #webgl-canvas
            document.getElementById('webgl-canvas').classList.remove('opacity-0');
        }

        /** Khoá/mở tương tác thanh điều khiển lúc Game Mode (`pointer-events: none`, assets/css/gameplay.css) — #player-container
         * (z-40) nằm ngoài stacking context của #visualizer-ui (z-30) nên luôn nổi trên overlay Game.
         * @param {boolean} blocked */
        function setPlayerControlsBlocked(blocked) {
            playerContainer.classList.toggle('gameplay-controls-blocked', blocked);
        }

        /** Media element thật đang phát: `bgVideoElement` (Video Player mode) hoặc `audioPlayer` (Song). Photo không có
         * element — Next/Prev đi thẳng đồng hồ ảnh (workflowPhotoPlayer.seekClock()/setPaused()).
         * @param {boolean} isVideoPlayerMode @returns {HTMLMediaElement} */
        function getActiveMediaElement(isVideoPlayerMode) {
            return isVideoPlayerMode ? bgVideoElement : audioPlayer;
        }

        /** Áp tốc độ phát lên 1 media element, giữ cao độ (`preservesPitch` + 2 tên tiền tố cho engine cũ — tên không tồn
         * tại thì gán vào vô hại). @param {HTMLMediaElement} mediaEl @param {number} speed */
        function applyPlaybackSpeed(mediaEl, speed) {
            mediaEl.playbackRate = speed;
            mediaEl.preservesPitch = true; mediaEl.mozPreservesPitch = true; mediaEl.webkitPreservesPitch = true;
        }

        /** Play/pause bài Song ĐÃ TẢI. Phát lại thì đánh thức AudioContext nếu đang 'suspended' hoặc 'interrupted' (iOS ngắt
         * audio lúc tab/app ẩn — thiếu bước này thì play() chạy mà không ra tiếng).
         * @param {AudioContext|null} audioContext */
        function togglePlayPause(audioContext) {
            if (audioPlayer.paused) { audioPlayer.play(); if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) audioContext.resume(); } else { audioPlayer.pause(); }
        }

        /** Nút Shuffle theo đúng state truyền vào — chỉ ghi `aria-pressed`; màu bật do key `pcToggleBtn` (variant
         * `aria-pressed:`, core/ui-theme/*.js). @param {boolean} isShuffleNow */
        function syncShuffleUI(isShuffleNow) {
            btnShuffle.setAttribute('aria-pressed', String(isShuffleNow));
        }

        /** Đảo Shuffle, ghi state. @param {boolean} isShuffleCurrent - giá trị TRƯỚC khi đảo @returns {boolean} giá trị MỚI */
        function toggleShuffle(isShuffleCurrent) {
            const next = !isShuffleCurrent;
            appState.set('isShuffle', next);
            console.log(`writer: "toggleShuffle", page: "isShuffle", content: "${next}"`);
            return next;
        }

        /** Nút Repeat theo đúng state truyền vào — `aria-pressed` bật ở 1 (lặp danh sách) / 2 (lặp 1 bài); số "1"
         * (`#repeat-one-digit`) chỉ hiện ở mode 2. @param {0|1|2} repeatModeNow */
        function syncRepeatUI(repeatModeNow) {
            btnRepeat.setAttribute('aria-pressed', String(repeatModeNow !== 0));
            repeatOneDigit.classList.toggle('hidden', repeatModeNow !== 2);
        }

        /** Xoay vòng Repeat tắt -> lặp danh sách -> lặp 1 bài, ghi state. @param {0|1|2} repeatModeCurrent @returns {0|1|2} mode MỚI */
        function cycleRepeatMode(repeatModeCurrent) {
            const next = (repeatModeCurrent + 1) % 3;
            appState.set('repeatMode', next);
            console.log(`writer: "cycleRepeatMode", page: "repeatMode", content: "${next}"`);
            return next;
        }

        // Media Session: chỉ hiển thị một chiều (metadata, playbackState, vị trí). Nút điều khiển từ ngoài app: chỉ
        // nexttrack/previoustrack (event/listener/player-controls.js), không có seek/play/pause.

        /** Vị trí phát của Song trên thông báo/màn khoá. */
        function updateMediaPositionState() {
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
                if (isFinite(audioPlayer.duration) && isFinite(audioPlayer.currentTime) && isFinite(audioPlayer.playbackRate)) {
                    try { navigator.mediaSession.setPositionState({ duration: audioPlayer.duration, playbackRate: audioPlayer.playbackRate, position: audioPlayer.currentTime }); } catch(e) {}
                }
            }
        }

        /** Khoảng cách tối thiểu giữa 2 lần đồng bộ vị trí Media Session lúc 'timeupdate' (sự kiện bắn rất dày). */
        const MEDIA_POSITION_SYNC_INTERVAL_MS = 5000;

        /** Đã tới lượt đồng bộ vị trí Media Session chưa. @param {number} nowMs @param {number} lastSyncMs @returns {boolean} */
        function isMediaPositionSyncDue(nowMs, lastSyncMs) {
            return nowMs - lastSyncMs > MEDIA_POSITION_SYNC_INTERVAL_MS;
        }

        /** Song vừa phát lại ('play'): trạng thái "hết hẳn playlist" không còn đúng. */
        function clearPlaybackStoppedAtPlaylistEnd() {
            appState.set('playbackStoppedAtPlaylistEnd', false);
            console.log(`writer: "clearPlaybackStoppedAtPlaylistEnd", page: "playbackStoppedAtPlaylistEnd", content: "false"`);
        }

        /** UI phát/dừng của Bottom Player (Song/Video dùng chung): icon Play/Pause, đĩa #record-art quay/dừng, Media Session
         * playbackState. @param {boolean} isPlaying */
        function setPlayerPlayingUi(isPlaying) {
            iconPlay.classList.toggle('hidden', isPlaying); iconPause.classList.toggle('hidden', !isPlaying);
            const recordArtEl = document.getElementById('record-art'); if (recordArtEl) recordArtEl.classList.toggle('paused', !isPlaying);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }

        /**
         * 'pause' vừa tới có phải lần DỪNG THẬT của đúng bài Song đang nạp (sẽ resume lại chính bài này) không — để Workflow
         * xả hàng đợi tiếng iOS ngay. Loại trừ: media đã play lại trước khi sự kiện tới, hết bài ('pause' đi trước 'ended' —
         * nạp lại lúc này xoá luôn 'ended' đang chờ), đang kéo thanh seek / seek-hold, đang Video/Photo Player mode, đã bỏ
         * bài (currentKey null), nguồn đã đổi/thu hồi. @returns {boolean}
         */
        function shouldFlushSongQueueOnPause({ isPaused, isEnded, isVideoPlayerMode, isPhotoPlayerMode, isSeeking, currentKey, currentObjectURL, mediaSrc }) {
            return isPaused && !isEnded && !isVideoPlayerMode && !isPhotoPlayerMode && !isSeeking && currentKey !== null && !!currentObjectURL && mediaSrc === currentObjectURL;
        }

        /** Tổng thời lượng lên thanh tiến trình + nhãn. @param {number} durationSec @param {string} durationLabel - đã formatTime() */
        function setPlayerDurationUi(durationSec, durationLabel) {
            progressBar.max = durationSec;
            durationTimeDisplay.textContent = durationLabel;
        }

        /** Vị trí đang phát lên thanh tiến trình + nhãn giờ. Màu phần đã chạy: updateProgressBarCSS() (Workflow gọi sau).
         * @param {number} positionSec @param {string} positionLabel - đã formatTime() */
        function setPlayerProgressUi(positionSec, positionLabel) {
            progressBar.value = positionSec;
            currentTimeDisplay.textContent = positionLabel;
        }

        /** Nhãn giờ hiện tại (Video lúc kéo seek). @param {string} positionLabel - đã formatTime() */
        function setCurrentTimeLabel(positionLabel) {
            currentTimeDisplay.textContent = positionLabel;
        }

        /** Đặt thumb thanh tiến trình khi KHÔNG có ngón tay thật trên thanh (cử chỉ seek-hold). @param {number} value */
        function setProgressBarValue(value) {
            progressBar.value = value;
        }

        /** Đang kéo thanh tiến trình (tay hoặc seek-hold): bật `isSeeking` ('timeupdate' thôi ghi đè thanh/nhãn) + nhãn theo
         * mốc kéo. @param {string} positionLabel - đã formatTime() */
        function setSeekingPositionUi(positionLabel) {
            appState.set('isSeeking', true);
            console.log(`writer: "setSeekingPositionUi", page: "isSeeking", content: "true"`);
            currentTimeDisplay.textContent = positionLabel;
        }

        // ===== Cổng seek (event/workflow/player-controls.js::runGatedSeek()) — tính thuần + ghi gain =====

        /** Lệnh cổng còn được chạy tiếp không sau 1 lần chờ: 'superseded' (lệnh seek mới hơn đã tiếp quản), 'mediaChanged'
         * (nguồn đã đổi — Next/chọn bài), 'running'. @param {number} token @param {number} activeToken
         * @param {string} currentSrc @param {string} srcAtStart @returns {'superseded'|'mediaChanged'|'running'} */
        function resolveSeekGateStatus(token, activeToken, currentSrc, srcAtStart) {
            if (token !== activeToken) return 'superseded';
            return currentSrc !== srcAtStart ? 'mediaChanged' : 'running';
        }

        /** Vị trí sau 'seeked' đã đúng mốc chưa — `toleranceSec` null = không kiểm (Song). @param {number} currentSec
         * @param {number} targetSec @param {number|null} toleranceSec @returns {boolean} */
        function isSeekPositionSettled(currentSec, targetSec, toleranceSec) {
            return toleranceSec === null || Math.abs(currentSec - targetSec) <= toleranceSec;
        }

        /** Cổng seek xong có play() lại không, và 'play' đó có phải lần phát THẬT cần tới UI không ('pause' trước đó là thật
         * mà cổng sắp play() lại theo `resumeAfter`). @returns {{shouldPlay: boolean, isVisiblePlay: boolean}} */
        function resolveSeekGateResume({ resumeAfter, heldByGate, gateResume, playRequested }) {
            const resumeByGate = heldByGate && gateResume;
            return { shouldPlay: resumeAfter || resumeByGate || playRequested, isVisiblePlay: heldByGate && resumeAfter && !resumeByGate };
        }

        /** Dòng log 1 lệnh cổng seek. @param {'song'|'video'} mediaKind @param {boolean} wasPlaying @param {number} targetSec
         * @param {number} elapsedMs @returns {string} */
        function formatSeekGateLog(mediaKind, wasPlaying, targetSec, elapsedMs) {
            return `[seekGate] ${mediaKind} (nạp lại) ${wasPlaying ? 'đang phát' : 'đang dừng'} -> ${targetSec.toFixed(2)}s | tổng ${Math.round(elapsedMs)}ms`;
        }

        /** Mute / mở tiếng dần `masterGainNode` cho cổng seek (âm lượng người dùng ở `volumeGainNode` nên master chỉ là cổng:
         * mở về 1). @param {GainNode} masterGainNode @param {number} nowSec - audioContext.currentTime @param {boolean} muted
         * @param {number} rampSec */
        function applySeekGateGain(masterGainNode, nowSec, muted, rampSec) {
            masterGainNode.gain.cancelScheduledValues(nowSec);
            masterGainNode.gain.setValueAtTime(0, nowSec);
            if (!muted) masterGainNode.gain.linearRampToValueAtTime(1, nowSec + rampSec);
        }

        // ===== Phát 1 item Playlist (event/workflow/player.js::playMedia()) =====

        /** Tuỳ chọn của playMedia(): `switchScreen` mặc định true (chỉ Next/Prev/tự chuyển truyền false), `direction` mặc định
         * 'next' (Video/Photo chọn slot Transition). @param {{switchScreen?: boolean, direction?: 'next'|'prev'}} [options]
         * @returns {{switchScreen: boolean, direction: 'next'|'prev'}} */
        function resolvePlayMediaRequest(options) {
            return { switchScreen: !options || options.switchScreen !== false, direction: (options && options.direction) || 'next' };
        }

        /** Đang Photo Player mode mà item mới không phải ảnh -> thoát mode trước. @param {boolean} isPhotoPlayerMode
         * @param {'song'|'video'|'photo'} mediaType @returns {boolean} */
        function shouldExitPhotoPlayerMode(isPhotoPlayerMode, mediaType) {
            return isPhotoPlayerMode && mediaType !== 'photo';
        }

        /** Nhãn Bottom Player của 1 Song từ tag: nghệ sĩ là chuỗi thay thế lúc thiếu tag ("Unknown artist"…) coi như không có.
         * @param {{title?: string, artist?: string, album?: string}} tag @param {string[]} placeholderArtists
         * @returns {{title: string, artist: string, album: string}} */
        function resolveSongTrackLabels(tag, placeholderArtists) {
            const artist = (tag.artist || '').trim();
            return { title: tag.title || '', artist: placeholderArtists.includes(artist) ? '' : artist, album: (tag.album || '').trim() };
        }
