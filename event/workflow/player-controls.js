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
const workflowPlayerControls = {

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
            activeEl.currentTime = 0;
            if (isVideoPlayerMode) activeEl.play().catch((err) => console.error('[workflowPlayerControls] bgVideoElement.play() lỗi:', err));
            else if (isPhotoPlayerMode) activeEl.play(); // photoPlayerFakeMediaElement.play() KHÔNG async, KHÔNG cần .catch()
            else activeEl.play();
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
            if (!isShuffle && pendingResortKeys.size > 0) recomputeDisplayOrder(); // core có sẵn (order.js), side-effect -> đọc lại displayOrder MỚI ngay dưới
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            nextKey = freshList[0];
        } else {
            nextKey = list[step.index];
        }
        workflowPlayer.playMedia(nextKey, { switchScreen: false }); // event/workflow/player.js
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
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js — SỬA (Giang yêu cầu, Photo tích hợp duration) thêm isPhotoPlayerMode

        // "Quá 3s vào bài/video hiện tại -> chỉ tua về đầu" — ĐÚNG hành vi gốc `playPrev()`.
        if (activeEl.currentTime > 3) { activeEl.currentTime = 0; return; }

        const list = isShuffle ? shuffleIndices : displayOrder;
        const step = computeListStep(list, currentKey, -1); // core mới (order.js)
        let prevKey;
        if (step.atBoundary) {
            if (!isShuffle && pendingResortKeys.size > 0) recomputeDisplayOrder(); // CHỈ nhánh tuần tự, ĐÚNG hành vi gốc
            const freshList = isShuffle ? shuffleIndices : appState.get('displayOrder');
            prevKey = freshList[freshList.length - 1];
        } else {
            prevKey = list[step.index];
        }
        workflowPlayer.playMedia(prevKey, { switchScreen: false }); // event/workflow/player.js
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
