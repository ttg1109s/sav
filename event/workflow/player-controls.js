/**
 * event/workflow/player-controls.js — "THẰNG THỰC THI CUỐI" của router "playerControls".
 *
 * MỚI (fix 03/07/2026, mục 3b yêu cầu — "Nút shuffle trong Control Center phải chỉ random cho
 * playlist hiện hành"). File này TRƯỚC ĐÂY không tồn tại (comment cũ ở event/router/player-controls.js
 * ghi rõ "17 msg.type chỉ cần ĐÚNG 1 HÀM CORE, KHÔNG có workflow") — giờ CẦN vì
 * 'playerControls.shuffle.click' đã đổi hình dạng: toggleShuffle() (core/player-controls.js) giờ
 * đơn tuyến, chỉ đảo cờ + đồng bộ UI, trả về giá trị MỚI; bước "tính lại shuffleIndices theo hiện
 * hành" là 1 lời gọi core THỨ HAI (updateShuffleArrayFromQueue(), core/playlist/order.js) — 2 hàm
 * core nối tiếp, có phụ thuộc thứ tự (bước 2 cần giá trị isShuffle MỚI từ bước 1) -> đúng hình dạng
 * Workflow (event-bus-flow.md mục 4B), không còn "gọi thẳng core" 1 bước như 16 msg.type còn lại
 * của cụm này.
 *
 * MỚI (plan-playmedia-reorg.md) — 4 method THÊM: `goToNextTrack()`/`goToPrevTrack()` (thay
 * `playNext()`/`playPrev()` cũ, core/player-controls.js, ĐÃ XOÁ), `handleMediaEnded()` (thay
 * `handleAudioEnded()` cũ VÀ `workflowVideoPlayer.handleVideoPlayerEnded()` cũ, gộp 2 hàm trùng
 * thân thành 1, dùng chung cho cả 'audio.ended' lẫn 'video.ended'), `handlePlayPauseClick()` (tách
 * khỏi `togglePlayPause()` cũ — phần "chưa có gì đang tải -> phát bài đầu tiên"). Cả 4 đều đúng
 * hình dạng Workflow (đọc nhiều field appState RỒI gọi ≥1 Core/Workflow khác theo thứ tự phụ
 * thuộc) — xem docstring từng method.
 *
 * MỚI (Game Mode + Video Player mode, phản hồi Giang) — `getActiveMediaElement(isVideoPlayerMode)`
 * (core/player-controls.js) DÙNG CHUNG bởi `goToNextTrack()`/`goToPrevTrack()` ở đây VÀ
 * `workflowGameplay` (event/workflow/gameplay.js) — tránh 2 nơi tự viết lại ternary
 * `isVideoPlayerMode ? bgVideoElement : audioPlayer` riêng.
 *
 * NẠP SAU: core/player-controls.js (toggleShuffle, togglePlayPause, requestWakeLock,
 * scrollSideLeftToSettingsSmooth/scrollSideLeftToPlaylistSmooth/validateVideoBgOnClose — HOTFIX 8,
 * dọn lại HOTFIX 11), core/playlist/order.js (updateShuffleArrayFromQueue, computeListStep/
 * decideBoundaryAction/shouldRestartInsteadOfAdvance/recomputeDisplayOrder — MỚI), core/listen-
 * stats.js (stopListenClock), core/settings-panel-stack.js (resetSettingsStackToMain),
 * event/workflow/player.js (workflowPlayer.playMedia — MỚI, cần cho goToNextTrack/goToPrevTrack/
 * handlePlayPauseClick).
 * NẠP TRƯỚC: event/router/player-controls.js.
 */
// ===== Cổng seek (MỚI 21/09/2026, v2 25/09/2026, v3 25/09/2026) — xem `workflowPlayerControls.runGatedSeek()` =====
const SEEK_GATE_SEEKED_TIMEOUT_MS = 3000; // đợi 'seeked'/'loadedmetadata' tối đa — phòng media không bao giờ xong (file lỗi) để không câm vĩnh viễn
const SEEK_GATE_UNMUTE_RAMP_SEC = 0.03;   // mở tiếng dần 30ms — tránh tiếng "tách"

/** Lặp 1 bài (repeat-one, hết bài tự nhiên) — phát lại từ đầu theo loại media đang phát (readme/event-bus-flow.md mục 7).
 * SỬA (29/09/2026, Giang báo: lặp 1 bài vẫn lọt ĐUÔI tiếng cũ, thanh tiến trình/timer vẫn chạy từ 0 -> tiếng lệch sau
 * currentTime, phụ đề lệch dồn qua mỗi vòng) — Song trước đây gán `currentTime = 0` TRẦN (bỏ qua cổng seek), hàng đợi
 * tiếng cũ của iOS không bị xoá nên vài giây cuối phát lại SAU khi currentTime đã về 0. Nay Song đi qua cổng seek
 * (`_restartSongForRepeatOne()`, nạp lại nguồn = xoá hàng đợi). Video/Photo giữ nguyên hành vi cũ. */
const REPEAT_ONE_RESTART_BY_MEDIA = {
    song: () => workflowPlayerControls._restartSongForRepeatOne(),
    video: (activeEl) => {
        activeEl.currentTime = 0;
        activeEl.play().catch((err) => console.error('[workflowPlayerControls] bgVideoElement.play() lỗi:', err));
    },
    // Photo: không có sự kiện 'play' DOM thật (photoPlayerFakeMediaElement.play() chỉ đổi cờ) nên PHẢI gọi
    // startListenClock() THẲNG — handleMediaEnded() vừa dừng đồng hồ ngay trước (xem goToNextTrack()). SỬA 25/09/2026:
    // + chạy lại Point Move từ đầu (event/workflow/photo-player.js).
    photo: (activeEl) => {
        activeEl.currentTime = 0;
        activeEl.play();
        startListenClock();
        workflowPhotoPlayer.onClockRestarted();
    },
};

const workflowPlayerControls = {

    /** MỚI (24/09/2026, dọn nợ "taskManager trong core") — THAY core `forceBackToPlaylistUI()` cũ ở MỌI nơi "về
     * Playlist" (nút Back, xoá bài/video đang là currentKey, xoá hàng loạt, Clear All). Thứ tự giữ đúng bản cũ:
     * cuộn Playlist tới bài đang phát (lúc còn nằm ngoài khung nhìn) -> trượt/đổi class -> đóng Control Center ->
     * 500ms sau (khớp transition transform 0.5s, assets/css/style.css) ẩn hẳn UI Visualizer + diff lại danh sách.
     * KHÔNG đụng `isVisualizerActive` — nơi gọi tự `setVisualizerActiveFalse()` nếu cần (y như bản cũ). */
    returnToPlaylistUI() {
        workflowPlaylistRender.scrollToCurrentInstant(); // SỬA (02/10/2026) — bản đúng rule (core scrollToCurrentKeyInstant() tự appState.get())
        slideBackToPlaylistUi(); // core/player-controls.js
        if (typeof closeControlCenter === 'function') closeControlCenter(); // core/visualizer-control-center.js — phòng panel còn mở sót
        taskManager.once(() => {
            hideVisualizerUiAfterFade(); // core/player-controls.js
            workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
        }, 500, 'hideVisualizerUiAfterFade');
    },

    /** DỜI (24/09/2026) từ core/player-controls.js::handleBackToPlaylistClick() — ứng với
     * 'playerControls.backToPlaylist.click'. KHÔNG dừng/ẩn video: Playlist (z-[60]) tự che video, video vẫn chạy theo nhạc. */
    handleBackToPlaylistClick() {
        this.returnToPlaylistUI();
        setVisualizerActiveFalse(); // core/player-controls.js
    },

    // ===== Cổng seek — state nội bộ (KHÔNG thuộc STATE) =====
    _seekGateToken: 0, // tăng mỗi lần `runGatedSeek()` — lệnh seek mới HƠN thay thế lệnh cũ (lệnh cũ tự bỏ dở, KHÔNG mở tiếng/không play() nữa)
    _seekGateHeldEl: null,  // media mà CỔNG tự pause/nạp lại và sẽ tự play() lại — sự kiện của nó bị bỏ qua, xem isHeldBySeekGate()
    _seekGateHeldSrc: '',   // currentSrc lúc cổng giữ — media đổi (Next/chọn bài) thì hold tự hết hiệu lực

    /**
     * [v3 — 25/09/2026] Seek KHÔNG lọt âm thanh CŨ. Lịch sử + số liệu đo trên máy thật (iPhone, log Debug console):
     *   - v1 (21/09): mute masterGain -> seek -> 'seeked' (~47ms) -> mở tiếng sau ~140ms. Gain=0 đúng lúc seek, vậy mà
     *     vẫn nghe tiếng cũ SAU khi mở -> tiếng cũ nằm trong 1 hàng đợi GIỮA trình phát iOS và Web Audio
     *     (createMediaElementSource), seek chỉ đổi vị trí phần tử, không xoá hàng đợi đó.
     *   - v2: pause rồi chờ analyser im lặng (đuôi cũ chảy hết) mới seek. Đo được "chờ đuôi" LUÔN ~150ms (analyser im gần
     *     như ngay khi pause) mà vẫn lọt tiếng cũ -> iOS KHÔNG xả hàng đợi khi pause, chỉ ĐÓNG BĂNG nó; play() lại thì
     *     phần cũ phát tiếp. Không đo/chờ nào xả được.
     *   - v3 (Song): XOÁ hàng đợi bằng cách NẠP LẠI nguồn — `load()` (cùng blob URL) dựng lại trình phát nội bộ của iOS,
     *     hàng đợi cũ bị bỏ cùng nó (cùng lý do đổi bài không lọt đuôi bài trước). Trình tự: mute masterGain -> giữ (hold)
     *     + `load()` -> đợi 'loadedmetadata' -> gán currentTime -> đợi 'seeked' -> mở tiếng dần -> play() nếu trước đó đang
     *     phát. Trong lúc giữ, 'pause'/'play'/'timeupdate' do chính cổng gây ra bị bỏ qua (không nháy icon/đồng hồ nghe/
     *     VBG/auto-switch, thanh thời gian không nhảy về 0:00 — xem `isHeldBySeekGate()`); 'loadedmetadata' VẪN chạy bình
     *     thường vì `load()` trả `playbackRate` về mặc định và handler đó áp lại đúng tốc độ phát.
     *   - Video: CHƯA nạp lại (Giang chưa chốt — `load()` với video sẽ hiện ảnh poster một nhịp). Giữ cổng mute -> (giữ +
     *     pause nếu đang phát) -> seek -> mở tiếng -> play().
     * Bỏ hẳn phần ngắt nhánh ra loa + đo analyser của v2 (không còn tác dụng) — core/audio-engine.js xoá 2 hàm tương ứng.
     *
     * @param {HTMLMediaElement} mediaEl - audioPlayer (Song) hoặc bgVideoElement (Video)
     * @param {number} targetSec
     * @param {boolean} resumeAfter - true = `play()` sau seek dù cổng không tự giữ (Video đã bị pause lúc kéo tay)
     * @param {number|null} [verifyToleranceSec] - Video: sau 'seeked' đọc lại currentTime, lệch > mức này thì gán lại; null = không kiểm (Song)
     * @returns {Promise<boolean>} MỚI (29/09/2026) — true = cổng chạy TRỌN (đã seek + mở tiếng + thả hold); false = bị lệnh seek
     *   mới hơn tiếp quản / media đổi giữa chừng / play() lỗi. Nơi gọi cũ không await — không ảnh hưởng.
     */
    async runGatedSeek(mediaEl, targetSec, resumeAfter, verifyToleranceSec = null) {
        const token = ++this._seekGateToken;
        const srcAtStart = mediaEl.currentSrc;
        const startMs = performance.now();
        const isSong = mediaEl === audioPlayer;
        this._setMasterGainForSeekGate(true);

        // Giữ media: Song LUÔN giữ (nạp lại tự pause, kể cả đang dừng — để 'timeupdate' về 0 không lọt ra UI); Video chỉ
        // giữ khi đang phát. Lệnh cũ (bị thay giữa chừng) đã giữ sẵn -> hold còn hiệu lực, lệnh này kế thừa.
        const wasPlaying = !mediaEl.paused || this.isHeldBySeekGate(mediaEl) && this._seekGateResume;
        if (isSong || !mediaEl.paused) {
            if (!this.isHeldBySeekGate(mediaEl)) this._seekGateResume = !mediaEl.paused;
            this._seekGateHeldEl = mediaEl;
            this._seekGateHeldSrc = srcAtStart;
            if (!mediaEl.paused) mediaEl.pause();
        }

        if (isSong) {
            // Nạp lại nguồn = xoá hàng đợi tiếng cũ của iOS.
            const metaPromise = this._waitMediaEvent(mediaEl, 'loadedmetadata');
            mediaEl.load();
            await metaPromise;
            if (token !== this._seekGateToken) return false; // lệnh seek mới hơn đã tiếp quản — nó tự lo play()/mở tiếng
            if (mediaEl.currentSrc !== srcAtStart) { this._abortSeekGate(); return false; } // media đã đổi giữa lúc chờ (Next/chọn bài)
        }

        // Seek. [SỬA 21/09/2026 — giữ nguyên] còn seek dở HOẶC lệch mốc -> luôn gán lại (seek mới huỷ seek dở); Video kiểm lại vị trí.
        const needsAssign = mediaEl.seeking || Math.abs(mediaEl.currentTime - targetSec) > 0.001;
        if (needsAssign) {
            const maxAttempts = verifyToleranceSec === null ? 1 : 3;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const seekedPromise = this._waitMediaEvent(mediaEl, 'seeked'); // đăng ký listener TRƯỚC khi gán currentTime
                mediaEl.currentTime = targetSec;
                await seekedPromise;
                if (token !== this._seekGateToken) return false;
                if (verifyToleranceSec === null || Math.abs(mediaEl.currentTime - targetSec) <= verifyToleranceSec) break;
            }
        }
        if (token !== this._seekGateToken) return false;
        if (mediaEl.currentSrc !== srcAtStart) { this._abortSeekGate(); return false; }

        // Mở tiếng TRƯỚC rồi mới play() (play() lúc trang không ra tiếng làm iOS bỏ Next/Prev ở màn hình khoá — xem lịch sử v2).
        this._setMasterGainForSeekGate(false);
        const heldByGate = this.isHeldBySeekGate(mediaEl);
        const shouldPlay = resumeAfter || (heldByGate && this._seekGateResume);
        if (shouldPlay) {
            try {
                await mediaEl.play(); // promise xong SAU khi sự kiện 'play' đã qua listener -> hold còn nguyên lúc đó -> bị bỏ qua đúng ý
            } catch (err) {
                console.error('[workflowPlayerControls] runGatedSeek: play() lỗi sau seek:', err);
                if (heldByGate) { this._releaseSeekGateHold(mediaEl, true); return false; } // không phát lại được -> báo 'pause' THẬT cho UI
            }
            if (token !== this._seekGateToken) return false;
        }
        if (heldByGate) this._releaseSeekGateHold(mediaEl, false);
        if (isSong) updateMediaPositionState(); // core/player-controls.js — Media Session đúng vị trí mới (nạp lại đã reset)
        console.log(`[seekGate] ${isSong ? 'song (nạp lại)' : 'video'} ${wasPlaying ? 'đang phát' : 'đang dừng'} -> ${targetSec.toFixed(2)}s | tổng ${Math.round(performance.now() - startMs)}ms`);
        return true;
    },

    /** MỚI (29/09/2026) — lặp 1 bài cho Song: cổng seek về 0 (nạp lại nguồn -> xoá hàng đợi tiếng cũ của iOS) rồi MỚI play().
     * Không để cổng tự play (resumeAfter = false): sau 'ended' media đã dừng THẬT (sự kiện 'pause' thật đã tới UI/đồng hồ
     * nghe/VBG), play() trong lúc cổng còn giữ sẽ bị bỏ qua -> UI kẹt ở trạng thái dừng. play() SAU khi cổng thả hold phát
     * sự kiện 'play' thật -> icon, đồng hồ nghe, VBG, auto-switch chạy lại như bản cũ. Cổng không chạy trọn (người dùng
     * seek/đổi bài giữa chừng) -> lệnh mới tự lo, không play() chồng. */
    async _restartSongForRepeatOne() {
        const completed = await this.runGatedSeek(audioPlayer, 0, false);
        if (!completed) return;
        audioPlayer.play().catch((err) => console.error('[workflowPlayerControls] audioPlayer.play() lỗi khi lặp 1 bài:', err));
    },

    /** Sự kiện của `mediaEl` lúc này là do CỔNG tự pause/nạp lại/play tạm (Workflow bỏ qua: handleAudioPlayEvent/
     * handleAudioPauseEvent/handleAudioTimeUpdateEvent ở đây + workflowVideoPlayer.handleVideoPlayState/PauseState).
     * So thêm currentSrc — media đã đổi thì hold không còn hiệu lực. @param {HTMLMediaElement} mediaEl @returns {boolean} */
    isHeldBySeekGate(mediaEl) {
        return this._seekGateHeldEl === mediaEl && mediaEl.currentSrc === this._seekGateHeldSrc;
    },
    _seekGateResume: false, // media ĐANG PHÁT lúc cổng bắt đầu giữ -> cuối cổng play() lại

    /** Bỏ hold. `notifyPaused` = true khi media vẫn đứng yên (play() lỗi) — gửi lại 'pause' THẬT để UI/đồng hồ đồng bộ đúng.
     * @param {HTMLMediaElement} mediaEl @param {boolean} notifyPaused */
    _releaseSeekGateHold(mediaEl, notifyPaused) {
        this._seekGateHeldEl = null;
        this._seekGateHeldSrc = '';
        this._seekGateResume = false;
        if (notifyPaused && mediaEl.paused) {
            eventBus.send({ router: 'playerControls', type: mediaEl === audioPlayer ? 'playerControls.audio.pause' : 'playerControls.video.pause', payload: {} });
        }
    },

    /** Media đổi giữa lúc cổng đang chạy — thả mọi thứ: bỏ hold (media mới tự lo play/pause của nó), mở tiếng ngay. */
    _abortSeekGate() {
        this._seekGateHeldEl = null;
        this._seekGateHeldSrc = '';
        this._seekGateResume = false;
        this._setMasterGainForSeekGate(false);
    },

    /** Đợi 1 sự kiện 1 lần của `mediaEl` (kèm timeout an toàn — cùng 1 task tên cố định, lệnh sau huỷ timeout lệnh trước).
     * @param {HTMLMediaElement} mediaEl @param {'seeked'|'loadedmetadata'} eventName @returns {Promise<void>} */
    _waitMediaEvent(mediaEl, eventName) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                mediaEl.removeEventListener(eventName, finish);
                resolve();
            };
            mediaEl.addEventListener(eventName, finish, { once: true });
            taskManager.once(finish, SEEK_GATE_SEEKED_TIMEOUT_MS, 'seekGateEventTimeout');
        });
    },

    /** Mute/mở tiếng `masterGainNode` cho cổng seek (v1 — đã xác nhận có hiệu lực, gain=0 trong log). SỬA 01/10/2026: âm
     * lượng người dùng đã tách sang `volumeGainNode` (event/workflow/audio-engine.js) nên master chỉ còn là CỔNG — mở tiếng
     * về 1 (không còn đọc `appConfigViz.volume`), mở dần 30ms. Chưa có audio graph -> no-op. @param {boolean} muted */
    _setMasterGainForSeekGate(muted) {
        const { masterGainNode, audioContext } = appState.get(['masterGainNode', 'audioContext']);
        if (!masterGainNode || !audioContext) return;
        const now = audioContext.currentTime;
        masterGainNode.gain.cancelScheduledValues(now);
        masterGainNode.gain.setValueAtTime(0, now);
        if (!muted) masterGainNode.gain.linearRampToValueAtTime(1, now + SEEK_GATE_UNMUTE_RAMP_SEC);
    },

    /** Ứng với 'playerControls.audio.timeupdate'. Lúc cổng seek v3 đang nạp lại nguồn, currentTime tạm về 0 -> bỏ qua để
     * thanh/nhãn thời gian + phụ đề không nhảy về 0:00. */
    handleAudioTimeUpdateEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return;
        handleAudioTimeUpdate(); // core/player-controls.js
        workflowSubtitleDisplay.sync(audioPlayer.currentTime); // event/workflow/subtitle-display.js
    },

    /** Ứng với 'playerControls.progressBar.seeking' khi Song — hiển thị theo vị trí đang kéo (chưa commit), phụ đề theo luôn.
     * @param {string|number} value */
    handleSongSeeking(value) {
        handleProgressBarSeeking(value); // core/player-controls.js
        workflowSubtitleDisplay.sync(Number(value)); // event/workflow/subtitle-display.js
    },

    /** Ứng với 'playerControls.progressBar.seekCommit' khi `isVideoPlayerMode=false` (Song) — thả tay/chạm chọn
     * điểm, commit vị trí + cổng seek (xem `runGatedSeek()`). THAY `handleProgressBarSeekCommit()` (core,
     * core/player-controls.js) — hàm đó chỉ gán `currentTime` trần, không kiểm soát được phần lọt âm thanh cũ,
     * và không dùng được `taskManager` (Rule 3, chỉ Workflow). @param {string|number} value */
    handleSongSeekCommit(value) {
        appState.set('isSeeking', false);
        console.log(`writer: "workflowPlayerControls.handleSongSeekCommit", page: "isSeeking", content: "false"`);
        this.runGatedSeek(audioPlayer, Number(value), false); // KHÔNG await — 'seeked' cập nhật Media Session qua listener sẵn có
        updateMediaPositionState(); // core/player-controls.js — vị trí mới ngay như bản cũ; 'seeked' cập nhật lại khi seek xong
    },

    /**
     * Ứng với 'playerControls.playPause.click' khi `isVideoPlayerMode=false` (xem
     * VirtualMachineState ở event/router/player-controls.js).
     *
     * [SỬA — plan-playmedia-reorg.md, xử lý triệt để, KHÔNG chỉ đổi tên] TRƯỚC ĐÂY
     * `togglePlayPause()` (Core, core/player-controls.js) tự gộp 2 TIẾN TRÌNH nghiệp vụ khác nhau
     * trong 1 hàm — "chưa có bài nào đang tải -> phát bài đầu tiên" (gọi thẳng `window.playSong()`)
     * và "đang có bài đã tải -> toggle play/pause" — vi phạm Rule 1 (core-function-conventions.md:
     * phép thử "xoá điều kiện if đi, hàm còn lại có còn là 1 kịch bản duy nhất không" — ở đây bỏ
     * nhánh `currentKey===null` đi, phần còn lại VẪN là 1 kịch bản hoàn chỉnh khác hẳn, không phải
     * guard clause), cộng thêm tự `appState.get()` 3 lần bên trong (vi phạm Rule 2). Method NÀY
     * (Workflow — tầng DUY NHẤT được đọc appState để chọn gọi Core nào) giờ đứng ra:
     *   1. `requestWakeLock()` — core, side-effect vô điều kiện (giữ ĐÚNG hành vi gốc: gọi trước
     *      cả khi playlist rỗng).
     *   2. Guard `playlistOrder.length === 0` — không làm gì (giữ nguyên vị trí guard gốc).
     *   3. `currentKey === null` -> gọi `workflowPlayer.playMedia()` (Workflow gọi Workflow khác
     *      miền, tự do — event-bus-flow.md mục 3a) với bài đầu tiên (`displayOrder[0] ||
     *      playlistOrder[0]`, ĐÚNG công thức gốc).
     *   4. Ngược lại -> gọi `togglePlayPause(audioContext)` (Core, giờ CHỈ còn ĐÚNG 1 việc, nhận
     *      audioContext qua tham số — Rule 2 hợp lệ).
     */
    handlePlayPauseClick() {
        requestWakeLock(); // core
        const { playlistOrder, currentKey, displayOrder, audioContext } = appState.get(['playlistOrder', 'currentKey', 'displayOrder', 'audioContext']);
        if (playlistOrder.length === 0) return;
        if (currentKey === null) {
            workflowPlayer.playMedia(displayOrder[0] || playlistOrder[0]); // event/workflow/player.js
            return;
        }
        togglePlayPause(audioContext); // core/player-controls.js
    },

    /**
     * Ứng với 'playerControls.next.click' (force=true, LUÔN — bấm nút Next là ý định người dùng
     * rõ ràng, giữ ĐÚNG hành vi gốc `playNext(true)`) và được TÁI DÙNG (Workflow gọi Workflow khác
     * miền, tự do) bởi: `handleSongEnded()` ngay dưới (force=false — hết bài tự động, tôn trọng
     * repeatMode), `event/workflow/video-player.js` (video hết/bị xoá giữa lúc phát — force=false/
     * true tuỳ tình huống, DÙNG CHUNG với Song), `event/workflow/gameplay.js::nextSong()`
     * (force=true — nút "Bài tiếp theo" trong Game Mode).
     *
     * [SỬA — plan-playmedia-reorg.md] TRƯỚC ĐÂY là `playNext()` (Core, core/player-controls.js) —
     * tự `appState.get()` 7-10 lần + if/else gộp shuffle/tuần tự (2 tiến trình khác nhau theo Rule
     * 1) + gọi thẳng `window.playSong()` (Core gọi Workflow trá hình) — ĐÃ XOÁ. Logic "tiến 1 bước"
     * tách thành Core thuần dùng chung `computeListStep()` (core/playlist/order.js, KHÔNG quan tâm
     * list là shuffle hay tuần tự); quyết định "tại biên làm gì" tách thành `decideBoundaryAction()`
     * (repeatMode/force); case đặc biệt lặp-1-bài tách thành `shouldRestartInsteadOfAdvance()`.
     * Method NÀY (Workflow) đọc state, chọn ĐÚNG list (shuffleIndices hay displayOrder) truyền vào
     * `computeListStep()`, rồi tự quyết định phát bài nào — GIỮ NGUYÊN 100% kết quả cuối cùng so
     * với `playNext()` gốc ở mọi tình huống (xem checklist đối chiếu, plan-playmedia-reorg.md mục 4).
     * @param {boolean} [force=false]
     */
    goToNextTrack(force = false) {
        requestWakeLock(); // core
        const { isVideoPlayerMode, isPhotoPlayerMode, repeatMode, isShuffle, currentKey, shuffleIndices, displayOrder, playlistOrder, pendingResortKeys } = appState.get([
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'repeatMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys',
        ]);
        if (playlistOrder.length === 0) return;
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js — DÙNG CHUNG Song/Video/Photo (Next/Prev + Game Mode) — SỬA (Giang yêu cầu, Photo tích hợp duration) thêm isPhotoPlayerMode

        if (shouldRestartInsteadOfAdvance(repeatMode, force)) { // core mới (order.js) — repeat-mode-2, KHÔNG force
            // Nhánh này CHỈ tới được từ `handleMediaEnded()` (hết tự nhiên) — đồng hồ nghe vừa bị dừng ngay trước. Song/Video
            // tự khởi động lại đồng hồ qua sự kiện 'play' THẬT; Photo gọi thẳng (xem REPEAT_ONE_RESTART_BY_MEDIA).
            const mediaKind = isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
            REPEAT_ONE_RESTART_BY_MEDIA[mediaKind](activeEl);
            return;
        }

        const list = isShuffle ? shuffleIndices : displayOrder; // NGUỒN danh sách — chỉ khác biệt CHỦ Ý giữa 2 nhánh cũ
        const step = computeListStep(list, currentKey, 1); // core mới (order.js)
        let nextKey;
        if (step.atBoundary) {
            const action = decideBoundaryAction(repeatMode, force); // core mới (order.js)
            if (action === 'stopAtEnd') {
                // Tín hiệu "hết hẳn playlist" cho domain khác (vd visualBg) — ĐÚNG hành vi gốc
                // (playNext() cũ, MỚI 09/08/2026). Rule 4: log ngay dưới set().
                appState.set('playbackStoppedAtPlaylistEnd', true);
                console.log(`writer: "workflowPlayerControls.goToNextTrack", page: "playbackStoppedAtPlaylistEnd", content: "true"`);
                activeEl.pause();
                return;
            }
            // wrapToStart — CHỈ nhánh tuần tự (KHÔNG shuffle) mới áp lại sort thật cho bài mới
            // thêm giữa lúc nghe (pendingResortKeys), ĐÚNG hành vi gốc — shuffle KHÔNG có bước này.
            if (!isShuffle && pendingResortKeys.size > 0) workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js (dời từ core/playlist/order.js), side-effect -> đọc lại displayOrder MỚI ngay dưới
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            nextKey = freshList[0];
        } else {
            nextKey = list[step.index];
        }
        workflowPlayer.playMedia(nextKey, { switchScreen: false, direction: 'next' }); // event/workflow/player.js — MỚI `direction` (Giang yêu cầu Transition Video Player mode — Next/Prev dùng 2 preset RIÊNG, xem core/player-display-settings.js::PLAYER_MOTION_SLOTS)
    },

    /**
     * Ứng với 'playerControls.prev.click'. CÙNG KHUÔN `goToNextTrack()` ở trên nhưng KHÔNG có
     * `force`/`decideBoundaryAction()`/`shouldRestartInsteadOfAdvance()` — hành vi gốc `playPrev()`
     * CHƯA TỪNG có khái niệm "dừng hẳn ở đầu playlist" hay "lặp 1 bài", LUÔN wrap vô điều kiện khi
     * chạm biên đầu — giữ ĐÚNG bất đối xứng đó, KHÔNG tự thêm cho "đối xứng" giả tạo với Next.
     */
    goToPrevTrack() {
        requestWakeLock(); // core
        const { isVideoPlayerMode, isPhotoPlayerMode, isShuffle, currentKey, shuffleIndices, displayOrder, playlistOrder, pendingResortKeys } = appState.get([
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'isShuffle', 'currentKey', 'shuffleIndices', 'displayOrder', 'playlistOrder', 'pendingResortKeys',
        ]);
        if (playlistOrder.length === 0) return;
        // XOÁ (25/09/2026, Giang yêu cầu "Prev đúng chuẩn prev bài trước") — nhánh cũ "quá 3s vào bài/video hiện tại -> chỉ
        // tua về đầu" (hành vi gốc `playPrev()`). Prev giờ LUÔN sang bài trước; phát lại từ đầu dời sang icon riêng ở Control
        // Center -> `restartCurrentTrack()` ngay dưới. Áp dụng cho MỌI đường gửi 'playerControls.prev.click' (nút, cử chỉ,
        // Media Session màn hình khoá).
        const list = isShuffle ? shuffleIndices : displayOrder;
        const step = computeListStep(list, currentKey, -1); // core mới (order.js)
        let prevKey;
        if (step.atBoundary) {
            if (!isShuffle && pendingResortKeys.size > 0) workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js (dời từ core/playlist/order.js) — CHỈ nhánh tuần tự, ĐÚNG hành vi gốc
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            prevKey = freshList[freshList.length - 1];
        } else {
            prevKey = list[step.index];
        }
        workflowPlayer.playMedia(prevKey, { switchScreen: false, direction: 'prev' }); // event/workflow/player.js — MỚI `direction`, cùng lý do goToNextTrack() ở trên
    },

    /** MỚI (25/09/2026, Giang yêu cầu) — ứng với 'playerControls.restart.click' (icon "Phát lại" ở Control Center): phát lại
     * nội dung ĐANG phát từ đầu, GIỮ nguyên trạng thái phát/dừng (thay nhánh "Prev quá 3s" đã xoá ở `goToPrevTrack()`).
     * Song/Video đi qua cổng seek `runGatedSeek()` (không lọt tiếng/hình vị trí cũ); Photo tua đồng hồ giả về 0 + chạy lại
     * Point Move (cùng cách nhánh cũ). Chưa có gì đang phát -> bỏ qua. */
    restartCurrentTrack() {
        const { isVideoPlayerMode, isPhotoPlayerMode, currentKey } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'currentKey']);
        if (!currentKey) return;
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js
        if (isPhotoPlayerMode) {
            activeEl.currentTime = 0;
            workflowPhotoPlayer.onClockRestarted(); // event/workflow/photo-player.js
            return;
        }
        this.runGatedSeek(activeEl, 0, false, isVideoPlayerMode ? VIDEO_SEEK_VERIFY_TOLERANCE_SEC : null); // VIDEO_SEEK_VERIFY_TOLERANCE_SEC — event/workflow/video-player.js
        if (!isVideoPlayerMode) updateMediaPositionState(); // core/player-controls.js — Media Session về 0 ngay như seek thường
    },

    /**
     * Ứng với CẢ 'playerControls.audio.ended' LẪN 'playerControls.video.ended' khi
     * `gameplayPhase==='idle'` (xem VirtualMachineState ở event/router/player-controls.js, 1 case
     * DÙNG CHUNG cho cả 2 msg.type — audio/video hết bài xử lý Y HỆT nhau, không có lý do tách 2
     * đường) — bài/video phát hết, dừng đếm giờ nghe rồi tự chuyển bài kế tiếp (không force, tôn
     * trọng repeatMode/wrap-around như Next thường).
     *
     * [SỬA — plan-playmedia-reorg.md, xử lý triệt để] TRƯỚC ĐÂY là 2 hàm RIÊNG, TRÙNG Y HỆT thân —
     * `handleAudioEnded()` (Core, core/player-controls.js, ĐÃ XOÁ ở đợt trước — 2 lời gọi Core nối
     * tiếp `stopListenClock()` rồi `playNext(false)`, vốn đã vi phạm Rule 3, đúng bản chất Workflow)
     * VÀ `workflowVideoPlayer.handleVideoPlayerEnded()` (event/workflow/video-player.js, ĐÃ XOÁ —
     * thân giống hệt, chỉ khác object chứa). Gộp làm 1 — dùng chung cho cả 2 nguồn, đúng yêu cầu
     * "không viết thêm hàm nào chỉ để tạo ra hai đường không cần thiết".
     */
    handleMediaEnded() {
        stopListenClock(); // core (core/player-controls.js)
        this.goToNextTrack(false); // Workflow gọi method khác trong CÙNG object — tự do
    },

    /** MỚI (24/09/2026, rà soát refresh DOM — dọn nợ "Core gọi Workflow") — ứng với 'playerControls.audio.play'.
     * `handleAudioPlay()` (core/player-controls.js) trước đây TỰ gọi `workflowPlaylistRender.refreshSongNode()` +
     * `workflowVisualBg.syncPlaybackToAudio()` bên trong (core gọi Workflow, kèm tự `appState.get('currentKey')`).
     * 2 lời gọi đó dời RA đây, đứng cạnh lời gọi core — thứ tự giữ nguyên như bản cũ (core trước, vẽ lại hàng
     * đang phát, rồi đồng bộ Visual BG). */
    handleAudioPlayEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // MỚI 25/09/2026 — play() tạm của cổng seek v2, không phải người dùng phát lại
        handleAudioPlay(); // core/player-controls.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — DỜI 25/09/2026 từ trong core handleAudioPlay() (cùng vị trí thứ tự)
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — EQ bars "đang phát"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
    },

    /** MỚI (24/09/2026) — ứng với 'playerControls.audio.pause', đối xứng `handleAudioPlayEvent()` ngay trên.
     * SỬA (29/09/2026) — cuối cùng xả hàng đợi tiếng iOS (`_flushSongQueueAfterPause()`), xem docblock method đó. */
    handleAudioPauseEvent() {
        if (this.isHeldBySeekGate(audioPlayer)) return; // MỚI 25/09/2026 — pause() tạm của cổng seek v2 (chờ đuôi tiếng cũ), không đổi icon/đồng hồ/VBG
        handleAudioPause(); // core/player-controls.js
        workflowAutoSwitchVisual.syncPlayState(); // event/workflow/auto-switch-visual.js — DỜI 25/09/2026 từ trong core handleAudioPause()
        const currentKey = appState.get('currentKey');
        if (currentKey) workflowPlaylistRender.refreshSongNode(currentKey); // event/workflow/playlist-render.js — chấm "đang pause"
        workflowVisualBg.syncPlaybackToAudio(); // event/workflow/visual-bg-common.js
        this._flushSongQueueAfterPause();
    },

    /**
     * MỚI (29/09/2026, Giang báo resume Song còn dư âm; Giang chọn hướng B "xả hàng đợi lúc pause"). iOS không xả hàng đợi
     * tiếng (giữa <audio> và Web Audio) khi pause mà chỉ ĐÓNG BĂNG nó (đo ở cổng seek v2) -> resume phát phần đóng băng
     * trước (nghe như dư âm), currentTime đi trước tiếng thật -> thanh/timer/phụ đề lệch dồn qua mỗi lần pause. Xả NGAY lúc
     * pause bằng đúng cơ chế cổng seek v3: nạp lại nguồn + seek về chỗ dừng (cổng giữ hold -> sự kiện tạm không lọt ra
     * UI). Mọi đường resume sau đó (nút trong app, cử chỉ, màn hình khoá, tai nghe, Control Center iOS) chỉ là play()
     * thường, không trễ. Pause bị loại trừ: xem shouldFlushSongQueueOnPause() (core/player-controls.js).
     */
    async _flushSongQueueAfterPause() {
        const { currentKey, currentObjectURL, isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['currentKey', 'currentObjectURL', 'isVideoPlayerMode', 'isPhotoPlayerMode']);
        const shouldFlush = shouldFlushSongQueueOnPause({ // core/player-controls.js
            isPaused: audioPlayer.paused, isEnded: audioPlayer.ended, isVideoPlayerMode, isPhotoPlayerMode,
            currentKey, currentObjectURL, mediaSrc: audioPlayer.src,
        });
        if (!shouldFlush) return;
        const completed = await this.runGatedSeek(audioPlayer, audioPlayer.currentTime, false);
        this._syncSongPlayAfterFlush(completed);
    },

    /** Người dùng bấm phát lại NGAY trong lúc cổng đang xả (vài chục-trăm ms): sự kiện 'play' thật đã bị hold nuốt -> cổng
     * xong mà media đang phát thì gửi lại 'play' cho UI/đồng hồ nghe/VBG đồng bộ. Cổng không chạy trọn (seek/đổi bài giữa
     * chừng) -> lệnh mới tự lo sự kiện của nó. */
    _syncSongPlayAfterFlush(completed) {
        if (!completed || audioPlayer.paused) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.audio.play', payload: {} });
    },

    /** MỚI (25/09/2026) — ứng với 'playerControls.audio.loadedmetadata': core cập nhật thanh tiến trình/Media Session/tốc độ,
     * rồi auto-switch-visual build lại mốc cho bài mới (trước đây core `handleAudioLoadedMetadata()` tự gọi
     * `onAutoSwitchVisualSongChanged()` — core gọi core; phần điều phối đó giờ là Workflow). */
    handleAudioLoadedMetadataEvent() {
        handleAudioLoadedMetadata(); // core/player-controls.js
        // SỬA 26/09/2026 — bỏ workflowAutoSwitchVisual.onSongChanged() (mode 'duration' đã bỏ; 'perMedia' báo qua
        // onMediaChanged() ngay lúc currentKey đổi, event/workflow/player.js).
    },

    /**
     * Ứng với 'playerControls.shuffle.click' — đảo Shuffle rồi random lại shuffleIndices dựa trên
     * "hiện hành" (displayOrder tại thời điểm bấm — có thể đang là 1 section vừa chọn-phát qua
     * playSelectedSongs(), event/workflow/playlist.js, KHÁC hẳn top-level playlistOrder). So sánh
     * với 2 nút to "Phát"/"Trộn bài" (event/workflow/playlist-empty-state.js) — 2 nút đó LUÔN ép về
     * top-level trước khi phát/trộn (đúng ý mục 3a), còn Shuffle ở đây LUÔN tôn trọng hiện hành
     * (đúng ý mục 3b) — 2 hành vi khác nhau CHỦ ĐÍCH, không phải thiếu nhất quán.
     */
    toggleShuffleAndReshuffle() {
        const isShuffleCurrent = appState.get('isShuffle');
        const next = toggleShuffle(isShuffleCurrent); // core có sẵn, CÓ return, DÙNG ngay dưới

        const activeQueueKeys = appState.get('displayOrder'); // "hiện hành" — section HOẶC top-level
        const topLevelKeys = appState.get('playlistOrder');
        updateShuffleArrayFromQueue(activeQueueKeys, topLevelKeys, next); // core mới (order.js), Rule 2 nhận qua tham số
        this._persistPlayerConfig(); // MỚI (phản hồi Giang, mục 3) — nhớ trạng thái Shuffle
    },

    /**
     * Ứng với 'playerControls.repeat.click' — MỚI, tách khỏi router (phản hồi Giang, mục 3 "nhớ
     * trạng thái shuffle/repeat/stats"): trước đây router gọi thẳng `cycleRepeatMode()` (đúng "1
     * hàm core" theo quy ước router này) — giờ cần thêm bước lưu bền (`_persistPlayerConfig()`,
     * async, đụng IndexedDB) NGAY SAU, thành ≥2 bước -> đúng quy ước router "giao cho Workflow"
     * (xem docstring đầu event/router/player-controls.js).
     */
    cycleRepeatModeAndPersist() {
        cycleRepeatMode(); // core có sẵn (core/player-controls.js)
        this._persistPlayerConfig();
    },

    /**
     * Ghi bền Shuffle/Repeat/Stats-visible vào `appConfigPlayer` + `meta.playerConfig` (IndexedDB)
     * — CÙNG KHUÔN domain 'playlist' (`_persistPlaylistConfig()`, event/workflow/playlist.js) —
     * `setMeta()` trực tiếp mỗi lần đổi, KHÔNG debounce (tần suất đổi thấp, thao tác bấm tay/
     * checkbox). DÙNG CHUNG bởi `workflowVisualizerDisplay.setStatsPanelEnabled()` (Workflow gọi
     * Workflow miền khác, tự do) — tránh lặp logic ghi bền ở 2 nơi.
     */
    async _persistPlayerConfig() {
        appConfigPlayer.setAll({
            isShuffle: appState.get('isShuffle'),
            repeatMode: appState.get('repeatMode'),
            isStatsPanelVisible: appState.get('isStatsPanelVisible'),
        });
        await setMeta('playerConfig', appConfigPlayer.getAll());
    },

    /**
     * Khôi phục 2 icon toggle Control Center đã lưu bền LÚC BOOT (Shuffle/Repeat) — gọi từ
     * event/workflow/app-boot.js. Đồng bộ UI qua syncShuffleUI()/syncRepeatUI() (core/player-
     * controls.js — 2 hàm đó LUÔN "set thẳng", khác toggleShuffle()/cycleRepeatMode() luôn đảo
     * ngược giá trị hiện tại). Stats panel dùng chung domain config này (KHÔNG còn là icon Control
     * Center — checkbox trong Settings, xem event/workflow/visualizer-display.js), đồng bộ qua
     * setStatsPanelVisible() (core/visualizer-ui-visibility.js), cùng khuôn 2 icon kia.
     */
    async loadPersistedPlayerConfigOnBoot() {
        const saved = await getMeta('playerConfig');
        if (saved && typeof saved === 'object') {
            appConfigPlayer.mutateAll((cfg) => Object.assign(cfg, saved));
        }
        const cfg = appConfigPlayer.getAll();
        appState.set('isShuffle', !!cfg.isShuffle);
        appState.set('repeatMode', cfg.repeatMode || 0);
        console.log(`writer: "loadPersistedPlayerConfigOnBoot", page: "isShuffle/repeatMode/isStatsPanelVisible", content: "khôi phục từ meta.playerConfig"`);
        syncShuffleUI(appState.get('isShuffle')); // core mới (core/player-controls.js)
        syncRepeatUI(appState.get('repeatMode')); // core mới (core/player-controls.js)
        setStatsPanelVisible(cfg.isStatsPanelVisible !== false); // core/visualizer-ui-visibility.js
    },

    // XOÁ (đợt tái cấu trúc bottom nav App Panel, phản hồi Giang) — closeSettingsDrawer() (từng
    // gọi resetSettingsStackToMain()/scrollSideLeftToPlaylistSmooth(), 2 core ĐÃ XOÁ) không còn ý
    // nghĩa: đóng Settings giờ do workflowAppSettings.close() đảm nhiệm (event/workflow/
    // app-settings.js) — Router (event/router/player-controls.js, case
    // 'playerControls.settingsDrawer.close') đã trỏ thẳng sang đó, KHÔNG còn gọi qua đây nữa.
};
