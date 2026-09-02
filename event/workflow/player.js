/**
 * event/workflow/player.js — [MỚI, plan-playmedia-reorg.md] `workflowPlayer.playMedia()`.
 *
 * DỜI NGUYÊN XI thân `window.playSong()` (TRƯỚC ĐÂY khai báo global trong core/playlist/actions.js)
 * sang ĐÚNG tầng Workflow — hàm này CHƯA TỪNG là Core thuần (đọc DB bất đồng bộ qua getSongRecord(),
 * dựng UI, dispatch eventBus, gọi workflowVideoPlayer — đúng bản chất Workflow, core-function-
 * conventions.md Rule 3b "Core là tầng THI HÀNH, Workflow là tầng CHUẨN BỊ"), chỉ SAI CHỖ Ở (global
 * gắn vào `window` thay vì method của 1 Workflow có tổ chức, không có Router riêng dẫn vào) — xem
 * plan-playmedia-reorg.md mục 2 để biết đầy đủ lý do.
 *
 * KHÔNG ĐỔI 1 DÒNG LOGIC bên trong thân hàm so với `window.playSong()` gốc — CHỈ đổi khai báo
 * (`window.playSong = function(key, options) {...}` -> `playMedia(key, options) {...}` là method của
 * object `workflowPlayer`), xoá tiền tố `window.` ở nơi gọi (đổi hết sang `workflowPlayer.playMedia`).
 *
 * `workflowPlayer` KHÔNG gắn với 1 Router riêng nào — đây là Workflow "dùng chung xuyên miền" (TH2,
 * event-bus-flow.md mục 3a), được gọi THẲNG từ NHIỀU router/Workflow khác miền:
 *   - `playerControls` — qua `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` (event/
 *     workflow/player-controls.js, thay cho `playNext()`/`playPrev()` cũ đã xoá)
 *   - `playlist` — case 'playlist.item.playClick' (event/router/playlist.js), gọi thẳng khi
 *     `selectionMode=false`
 *   - `playlistEmptyState` — 2 nút to "Phát"/"Trộn bài" (event/router/playlist-empty-state.js +
 *     event/workflow/playlist-empty-state.js)
 * và từ 2 chỗ Core gọi THẲNG (core/player-controls.js — `togglePlayPause()` lúc `currentKey===null`,
 * `handleAudioEnded()` cho case tương đương "hết bài -> next") — Core gọi Workflow trực tiếp ở các điểm này là
 * nợ kỹ thuật ĐÃ CÓ SẴN, CÙNG KHUÔN với `handleAudioPlay()`/`handleAudioPause()` (chính file đó, gọi
 * thẳng `workflowVisualBg.syncPlaybackToAudio()`) — KHÔNG phát sinh mới do đợt reorg này, xem
 * docstring từng hàm ở core/player-controls.js.
 *
 * NẠP SAU: core/playlist/actions.js (removeKeyFromDisplay), core/playlist/render.js
 * (attachCoverFallback/scrollToCurrentKeyAnimated), core/playlist/order.js, core/player-controls.js
 * (requestWakeLock/switchToVisualizer), core/listen-stats.js (bumpSongPlayCount), core/subtitle/
 * subtitle-display.js (clearAllActiveSubBlocks), core/audio-engine.js (setupAudioContext),
 * core/visualizer/visualizer-display.js (updateTypeUI), event/bus.js, event/workflow/video-player.js
 * (workflowVideoPlayer.exitVideoPlayerMode). NẠP TRƯỚC: event/workflow/player-controls.js,
 * event/router/playlist.js, event/router/playlist-empty-state.js (cả 3 đều gọi
 * `workflowPlayer.playMedia()`).
 */
const workflowPlayer = {

    /**
     * FIX (03/07/2026, mục 5 yêu cầu — "next/prev không được cưỡng chế rời khỏi Playlist UI").
     * Tham số THỨ 2 tuỳ chọn `options.switchScreen` (mặc định `true`, GIỮ NGUYÊN 100% hành vi cũ
     * cho MỌI lời gọi hiện có chưa truyền — bấm 1 bài trong danh sách, "Phát"/"Trộn bài" ở header,
     * modal "Tiếp tục nghe?"...). CHỈ `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()`
     * (event/workflow/player-controls.js, thay cho `playNext()`/`playPrev()` cũ) truyền
     * `{ switchScreen: false }` — 2 hàm ĐÓ là nguồn DUY NHẤT của next/prev "không phải người dùng
     * chủ động chọn bài này" (bấm nút Next/Prev ở thanh dưới — CHỈ hiện khi đã đang ở màn
     * Visualizer, xem switchToVisualizer()/forceBackToPlaylistUI() — hoặc tự động chuyển bài khi 1
     * bài kết thúc, handleAudioEnded() -> workflowPlayerControls.goToNextTrack(false)). Vì nút
     * Next/Prev chỉ hiện lúc ĐÃ ở Visualizer, "không switch" ở đó vô hại (đang sẵn ở đó); còn tự
     * động chuyển bài lúc đang xem Playlist thì "không switch" đúng là điều cần sửa — 1 điều kiện
     * `switchScreen: false` phủ ĐÚNG cả 2 trường hợp, không cần biết màn hình nào đang hiện tại
     * thời điểm gọi.
     *
     * GHI NHẬN THẲNG THẮN (không né tránh) — hàm này là hàm CORE/WORKFLOW DI SẢN cực lớn, nhiều
     * chục vi phạm Rule 1/2/3 nếu soi theo core-function-conventions.md (đúng ra hàm này vốn chưa
     * từng thuộc phạm vi 4 rule đó, vì bản chất là Workflow — chỉ SAI CHỖ Ở như đã nói ở docstring
     * đầu file). Đưa hàm này về gọn gàng hơn (tách nhỏ theo từng bước) là việc LỚN hơn RẤT nhiều so
     * với phạm vi đợt reorg này (chỉ đổi CHỖ Ở, không đổi logic) — KHÔNG động thêm gì trong thân
     * hàm ngoài việc bỏ tiền tố `window.`/đổi khai báo hàm.
     * @param {string} key
     * @param {{switchScreen?: boolean}} [options]
     */
    playMedia(key, options) {
        // ===================== Ver 12 "Song/Video Unification" — Batch 2 (mục 3) =====================
        // Guard clause ĐẦU hàm — hàm "phát nhạc hợp nhất" giờ đọc `cached.mediaType` (chuẩn hoá
        // bởi buildVideoPlaylistCache(), Batch 1) để quyết định delegate hẳn sang Video Player
        // mode hay tiếp tục luồng Song gốc bên dưới. Rule 1: đây là guard clause thuần — bỏ 2
        // khối if này đi, phần còn lại của hàm vẫn giữ NGUYÊN 100% ĐÚNG 1 kịch bản (phát Song),
        // không đổi bất kỳ dòng nào — đúng nguyên tắc riêng của plan "KHÔNG sửa/động code đang
        // phục vụ RIÊNG cho Song".
        const cachedForDispatch = appState.get('playlistCache').get(key);

        // MỚI (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — nếu đang ở Photo Player
        // mode và bài/video/ảnh MỚI KHÔNG phải Photo, dọn dẹp mode đó TRƯỚC (kill task đồng hồ,
        // khôi phục #visual-bg-image về ĐÚNG cấu hình VBG thật, trả canvas về bình thường) rồi mới
        // để 2 guard clause Video/Song bên dưới chạy TIẾP như chưa từng có gì thay đổi — CHỈ 1 chỗ
        // xử lý mọi hướng thoát (Photo -> Song, Photo -> Video), không rải rác guard riêng ở từng
        // nhánh. KHÔNG `await` (playMedia() không async, giữ nguyên) — `exitPhotoPlayerMode()` giờ
        // async (gọi `applyCurrentVisualBg()`, event/workflow/visual-bg.js) nhưng an toàn để
        // fire-and-forget: thuần cập nhật lớp nền TRANG TRÍ, không chặn/ảnh hưởng gì tới việc phát
        // Song/Video mới ngay sau đây — nếu nhánh Video chạy tiếp, `startFromPlaylist()` TỰ gọi lại
        // `clearMediaLayers()` của chính nó nên không có race thật nào đáng lo.
        if (appState.get('isPhotoPlayerMode') && (!cachedForDispatch || cachedForDispatch.mediaType !== 'photo')) {
            workflowPhotoPlayer.exitPhotoPlayerMode(); // event/workflow/photo-player.js
        }

        if (cachedForDispatch && cachedForDispatch.mediaType === 'video') {
            // SỬA (Giang chốt: "chọn Video thì cũng phải kiểm tra block gate mới được cho
            // chọn") — đi qua eventBus (router 'videoPlayer') THAY VÌ gọi thẳng
            // workflowVideoPlayer.startFromPlaylist() như bản đầu. Block gate (event/block.js)
            // CHỈ chặn được message đi qua eventBus.send(), không chặn được lời gọi hàm trực
            // tiếp — nên đường vào Video Player mode BẮT BUỘC phải đi qua bus tại ĐÚNG điểm
            // này để tái tạo khoá chéo với "Use Video Background" (vizConfig.videoBgEnabled)
            // mà checkbox cũ từng có (xem event/block.js). ĐẶT dispatch ở NGAY guard clause
            // này (không phải ở từng nơi gọi playMedia()) vì đây là điểm DUY NHẤT chắc
            // chắn chặn được MỌI đường vào video: click 1 video trong Playlist, "Phát tất
            // cả"/"Trộn bài"/resume lúc activeMediaSource='video', VÀ (Giang chốt tiếp: "video
            // thừa hưởng cơ chế Playlist, không tạo cơ chế next/prev riêng") CẢ Next/Prev vật
            // lý/cử chỉ vuốt (workflowPlayerControls.goToNextTrack()/goToPrevTrack(), event/
            // workflow/player-controls.js, DÙNG CHUNG với Song) đều đi qua ĐÚNG dòng này mỗi lần
            // chuyển bài — router 'videoPlayer' (event/router/video-player.js) tự phân biệt "đã
            // ở mode, chỉ đổi video" hay "vào mode lần đầu" bằng VirtualMachineState theo
            // isVideoPlayerMode.
            //
            // SỬA (fix router video, phản hồi Giang 29/07/2026, "về visualizer không hoạt
            // động") — TRƯỚC ĐÂY payload chỉ có `key`, làm rớt mất `options.switchScreen`
            // (Next/Prev truyền `{switchScreen:false}`, xem core/player-controls.js) — router
            // không có cách nào biết "có cần chuyển màn hình không", nên tự conflate việc đó
            // với `isVideoPlayerMode` (nhánh "đã ở mode" gọi thẳng playVideoByKey(), KHÔNG bao
            // giờ switchToVisualizer() — đúng cho Next/Prev vật lý vì đang đứng sẵn ở
            // Visualizer, nhưng SAI khi Giang bấm lại video đang phát TỪ màn Playlist — mode
            // vẫn `true` do video chạy nền, nên rơi đúng nhánh đó, không quay lại Visualizer
            // được). Tính `switchScreen` GIỐNG HỆT công thức Song ở dòng dưới (`!options ||
            // options.switchScreen !== false`) rồi gửi kèm — router giờ quyết định switch màn
            // hình dựa vào ĐÚNG ý định của người gọi, không dựa vào isVideoPlayerMode nữa.
            const switchScreen = !options || options.switchScreen !== false;
            eventBus.send({ router: 'videoPlayer', type: 'videoPlayer.startFromPlaylist.click', payload: { key, switchScreen } });
            return;
        }

        // MỚI (Giang yêu cầu — Photo tích hợp `duration` như Song/Video, "quy chế phát của nó cũng
        // không khác biệt") — mirror ĐÚNG guard clause Video ngay trên, nhưng KHÔNG đi qua eventBus/
        // Block Gate (khác Video — Photo không cần khoá chéo với tính năng nào khác, xem docstring
        // đầu event/workflow/photo-player.js) — gọi THẲNG Workflow miền "photoPlayer" (Workflow gọi
        // Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B). `isPhotoPlayerMode` phân biệt
        // "đã ở mode, chỉ đổi ảnh" (Next/Prev vật lý, bấm lại đúng ảnh đang hiện) hay "vào mode lần
        // đầu" — CÙNG Ý NGHĨA video dùng router phân biệt qua VirtualMachineState, chỉ khác chỗ
        // quyết định (ở đây, không phải ở router — Photo không có router riêng).
        if (cachedForDispatch && cachedForDispatch.mediaType === 'photo') {
            const switchScreen = !options || options.switchScreen !== false;
            if (appState.get('isPhotoPlayerMode')) {
                workflowPhotoPlayer.playPhotoByKey(key, switchScreen); // event/workflow/photo-player.js — đã ở mode, chỉ đổi ảnh
            } else {
                workflowPhotoPlayer.startFromPlaylist(key); // event/workflow/photo-player.js — vào mode lần đầu, tự switchToVisualizer() bên trong (switchScreen mặc định true, mirror Video)
            }
            return;
        }
        const switchScreen = !options || options.switchScreen !== false;
        // [SỬA — 02/09/2026, Giang chỉ ra bug "exit game mode rồi vào lại ĐÚNG song vừa phát thì
        // không kích hoạt start game, nhạc vẫn chạy tiếp bình thường"] Nhánh NÀY (bấm lại ĐÚNG bài
        // đang load sẵn, `key === currentKey`) `return` NGAY — dòng gửi 'gameplay.mediaChanged'
        // TRƯỚC ĐÂY đứng SAU trong thân hàm (đợt sửa gate `previousKey !== key` hôm trước) KHÔNG
        // BAO GIỜ chạy tới được ở nhánh này, nên bug vẫn còn dù đã bỏ gate đó. Gửi NGAY TẠI ĐÂY —
        // cùng lý do đã giải thích ở dòng gửi phía dưới (playMedia() CHỈ gọi từ hành động "muốn
        // phát" thật, an toàn gửi vô điều kiện).
        if (key === appState.get('currentKey')) {
            if (switchScreen) switchToVisualizer(); else scrollToCurrentKeyAnimated();
            if (audioPlayer.paused) audioPlayer.play();
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
            return;
        }
        requestWakeLock();

        // display=false: chuyển bài chạy logic trong shield (khoá chồng lệnh) nhưng KHÔNG hiện
        // lớp che -> bỏ cú nháy đen bg-black/80 mỗi lần Next/Prev (rõ nhất khi có video nền).
        //
        // FIX (log 9->10): trước đây withLoadingShield() KHÔNG có .catch() ở đây, và mọi nơi
        // gọi playMedia(...) (playPauseBtn, Next/Prev, click bài trong list) đều
        // gọi fire-and-forget (không await, không .catch()). Nếu thân hàm bên dưới throw — ví
        // dụ await getSongRecord(key) reject vì connection IndexedDB đã chết (xem giải thích
        // đầy đủ ở db.js, đã sửa thêm cơ chế tự mở lại connection + retry 1 lần ở đó) — lỗi đó
        // dừng hàm NGAY TẠI ĐÓ, audioPlayer.src/audioPlayer.play() ở các dòng sau KHÔNG BAO GIỜ
        // chạy tới (im lặng hoàn toàn, không alert, không crash gì khác — đúng kiểu "vẫn
        // next/prev được vì chỉ tính index trong RAM, nhưng không có tiếng vì không lấy được
        // blob thật từ IndexedDB"), rồi thoát ra ngoài dưới dạng unhandled promise rejection.
        // Sau khi db.js đã tự retry, trường hợp này hiếm xảy ra hơn nhiều, nhưng vẫn cần lớp
        // bảo vệ cuối: nếu thật sự thất bại (retry cũng lỗi, hoặc lỗi khác hẳn), alertModal()
        // đúng nguyên văn lỗi thay vì im lặng — cùng tinh thần đã áp dụng cho luồng upload.
        // FIX (patch alert -> alertModal): trước đây dùng alert() native (chặn luồng JS) — đổi
        // sang alertModal() (modal-choice-ui.js) để không bị chặn/crash khi gọi đúng lúc 1
        // #loading-shield khác đang chạy (alert() native từng gây "đứng" cảm giác app crash).
        let notFoundAlert = false; // cờ mang ra ngoài withLoadingShield — KHÔNG await alertModal() ngay trong fn() của shield (xem giải thích dưới)
        return withLoadingShield(t('common.loading.switchingSong'), async () => {
            // FIX (09/08/2026, mục 1 phản hồi Giang — "video bg vẫn không mute, phát đè tới lúc
            // song chèn vào") — TRƯỚC ĐÂY exitVideoPlayerMode() gọi KHÔNG await NGAY TRƯỚC shield
            // này: phần đồng bộ (mute/pause bgVideoElement) chạy kịp, nhưng phần BẤT ĐỒNG BỘ của
            // nó (applyCurrentVisualBg() — nạp lại Audio B của VBG nếu type='video') chạy ngầm,
            // không đồng bộ với audioPlayer.play() bên dưới. AWAIT ngay đầu shield — đảm bảo dọn
            // Video Player mode + tái áp VBG XONG HẲN trước khi Song bắt đầu phát.
            if (appState.get('isVideoPlayerMode')) await workflowVideoPlayer.exitVideoPlayerMode(); // event/workflow/video-player.js

            if (appState.get('currentObjectURL')) { URL.revokeObjectURL(appState.get('currentObjectURL')); appState.set('currentObjectURL', null); }
            if (appState.get('currentCoverObjectURL')) { URL.revokeObjectURL(appState.get('currentCoverObjectURL')); appState.set('currentCoverObjectURL', null); }
            audioPlayer.pause();
            const previousKey = appState.get('currentKey');

            const record = await getSongRecord(key);
            if (!record) {
                removeKeyFromDisplay(key);
                // FIX (xung đột shield/modal): KHÔNG await alertModal() ở đây — fn() này còn đang
                // chạy TRONG withLoadingShield(), và isShieldBusy chỉ được giải phóng ở finally
                // SAU KHI fn() resolve (xem loading-shield-util.js). alertModal() trả Promise chỉ
                // resolve khi người dùng bấm OK -> nếu await ngay tại đây, #loading-shield (lớp
                // che z-[200], phủ kín màn hình) sẽ TIẾP TỤC hiện + chặn pointer-events suốt thời
                // gian modal đang mở (modalChoice() chỉ z-[130], thấp hơn, nằm DƯỚI lớp che) —
                // người dùng thấy modal nhưng không bấm được nút OK, shield "treo" vô thời hạn vì
                // đang tự chờ chính cái modal mà nó đang che. Đặt cờ, return ngay để fn() (và do
                // đó isShieldBusy) đóng lại HẲN trước, rồi mới hiện modal ở ngoài (xem dưới).
                notFoundAlert = true;
                return;
            }

            appState.set('currentKey', key);
            appState.set('currentCoverObjectURL', record.cover ? URL.createObjectURL(record.cover) : DEFAULT_VINYL);
            appState.set('currentObjectURL', URL.createObjectURL(record.blob));
            audioPlayer.src = appState.get('currentObjectURL');

            playerTitle.textContent = record.tag.title; playerArtist.textContent = record.tag.artist;
            recordContainer.innerHTML = `<img id="record-art" src="${appState.get('currentCoverObjectURL')}" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 ${audioPlayer.paused ? 'paused' : 'animate-spin-slow'}" alt="Record"><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;
            // Ver 8 refine (mục 4): cover Blob có thể không decode được làm ảnh thật (ID3 cover
            // lỗi/cắt cụt, jsmediatags đọc nhầm định dạng...) -> <img> "vỡ" thay vì hiện vinyl
            // mặc định. attachCoverFallback() (định nghĩa ở render.js) gắn onerror tự fallback
            // về DEFAULT_VINYL — tái dùng đúng 1 hàm cho mọi nơi hiển thị cover trong app.
            attachCoverFallback(document.getElementById('record-art'));

            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: record.tag.title || "Visual Master",
                    artist: record.tag.artist || "Unknown Artist",
                    // Ver 8 refine (mục 4): dùng ĐÚNG record.cover.type thật (đã được validate
                    // ở loader.js, đảm bảo là MIME ảnh hợp lệ) thay cho hard-code 'image/jpeg'
                    // trước đây — khai báo sai MIME (ví dụ cover thật là PNG nhưng báo JPEG) có
                    // thể khiến hệ điều hành/màn hình khóa từ chối hiển thị artwork dù dữ liệu
                    // ảnh hoàn toàn hợp lệ. Fallback 'image/jpeg' chỉ dùng khi vì lý do nào đó
                    // record.cover.type rỗng (hiếm, nhưng Blob.type có thể rỗng trên 1 số trình
                    // duyệt cũ dù nội dung vẫn đúng).
                    artwork: record.cover ? [{ src: appState.get('currentCoverObjectURL'), sizes: '512x512', type: record.cover.type || 'image/jpeg' }] : []
                });
            }

            bumpSongPlayCount(key); // +1 số lần nghe ngay khi bắt đầu phát bài mới

            // SỬA (phản hồi Giang 29/07/2026, mục 2 — "next/prev... phải scroll tới nhưng có
            // hiệu ứng cuộn") — nhánh switchScreen=false (Next/Prev vật lý) giờ gọi
            // scrollToCurrentKeyAnimated() (core/playlist/render.js) THAY vì không làm gì cả —
            // hàm đó tự no-op nếu Playlist đang ẩn (đứng ở Visualizer), chỉ thật sự cuộn khi
            // Playlist đang hiển thị (vd bấm Next/Prev từ thanh player mini trong lúc đang
            // xem Playlist).
            // FIX (29/07/2026, "scroll tại playlist đang không đúng vị trí") — TRƯỚC ĐÂY gọi
            // scrollToCurrentKeyAnimated() NGAY TẠI ĐÂY, tức là TRƯỚC cả refreshSongNode(key)/
            // renderPlaylistDiff() ngay dưới — hàm đó tự tra `domNodesByKey.get(key)` (xem
            // render.js), mà lúc này `key` có thể CHƯA có node nào trong `domNodesByKey` (bài
            // vừa lọc/chưa từng render, renderPlaylistDiff() dưới đây mới là chỗ thật sự thêm
            // node cho nó) -> guard `if (!node) return` của hàm đó lặng lẽ bỏ qua, cuộn KHÔNG hề
            // chạy, Playlist đứng yên ở vị trí CŨ (đúng triệu chứng "không đúng vị trí"). Dời
            // xuống SAU refreshSongNode()/renderPlaylistDiff() để `domNodesByKey` chắc chắn đã
            // có node ĐÚNG (mới nhất) cho `key` trước khi tính offset cuộn — cùng thứ tự đã đúng
            // ở luồng Video (event/workflow/video-player.js::playVideoByKey(), refreshSongNode()
            // xong rồi mới switchToVisualizer()/scrollToCurrentKeyAnimated()).
            audioPlayer.play(); if (switchScreen) switchToVisualizer();
            if (previousKey) refreshSongNode(previousKey);
            refreshSongNode(key);
            if (!appState.get('domNodesByKey').has(key)) renderPlaylistDiff();
            if (!switchScreen) scrollToCurrentKeyAnimated();
            if (appState.get('currentKey')) btnReturnVisual.classList.remove('hidden');
            appState.set('beatTimes', []); appState.set('fluxHistory', []); appState.set('currentCalculatedBpm', "---"); statBpm.textContent = "---"; statNote.textContent = "---";
            // Reset trạng thái pitch worker — tránh hiện sót nốt nhạc của bài VỪA đổi trong vài
            // chục ms đầu (worker là bất đồng bộ, kết quả cũ có thể vẫn đang "bay" lúc đổi bài).
            appState.set('latestPitchFrequency', -1); appState.set('lastValidNoteStr', null); appState.set('lastValidNoteTime', 0); appState.set('lastValidMidiNote', null);
            appState.set('rubikPitchHistory', []); appState.set('rubikPitchAvg', 0);
            appState.set('raindrops', []); appState.set('ripples', []); appState.set('glassStaticDrops', []); appState.set('glassStreaks', []); appState.set('activeLightnings', []); appState.set('starFlashes', []);
            setupAudioContext(); updateTypeUI();

            appState.set('subtitles', record.subtitles ? record.subtitles.slice() : []);
            // SỬA (10/07/2026, Subtitle Editor chuyển sang trang riêng): resetAutoSub()/
            // renderSubList() ĐÃ XOÁ cùng modal cũ — không còn UI soạn phụ đề nào ở trang
            // chính để "reset trạng thái ghi âm timing"/"vẽ lại danh sách" nữa.
            // clearAllActiveSubBlocks() GIỮ NGUYÊN (core/subtitle/subtitle-display.js — hiển
            // thị phụ đề lúc phát, KHÔNG liên quan gì tới việc soạn nội dung).
            clearAllActiveSubBlocks();

            // MỚI (v13 Batch D, hoàn thiện ở Batch E) — báo cho domain "Visual Background" biết
            // bài hát vừa ĐỔI THẬT, thay cho task poll `currentKey` mỗi 1s mà engine slideshow
            // từng tự dựng (`_startSongWatcher()`, đã xoá). So sánh KEY chứ không phải
            // currentTime: seek trong CÙNG bài KHÔNG lọt vào đây, đúng hành vi cũ.
            // Đây là NƠI DUY NHẤT biết chắc "bài hát vừa đổi" (next/prev/hết bài tự next/chọn
            // bài khác đều đi qua đúng hàm này), nên hook đặt ở đây thay vì rải 3 chỗ.
            // Gửi QUA BUS (không gọi thẳng Workflow): việc quyết định nguồn nền nào cần phản
            // ứng là rẽ nhánh theo state -> thuộc tầng Router, xử lý bằng
            // `VirtualMachineState.run()` ở event/router/visual-bg.js.
            if (previousKey !== key) eventBus.send({ router: 'visualBg', type: 'visualBg.songChanged', payload: {} });
            // [SỬA — phản hồi Giang "visualBg.songChanged liên quan gì tới video play mode?"] Tín
            // hiệu "media đổi thật" cho Game Mode giờ TÁCH RIÊNG khỏi 'visualBg.songChanged' ở trên
            // (2 domain không liên quan nhau) — gửi qua router "gameplay" (event/router/gameplay.js).
            // Video (workflowVideoPlayer.playVideoByKey(), event/workflow/video-player.js) cũng
            // dispatch CÙNG msg.type này ở đúng điểm tương đương — Game Mode tự mở khi bài đổi giờ
            // hoạt động ĐÚNG cho cả 2 nguồn.
            //
            // [SỬA — 02/09/2026, Giang chỉ ra bug "exit game mode rồi vào lại ĐÚNG video/song vừa
            // phát thì không kích hoạt start game, nhạc vẫn chạy tiếp bình thường"] TRƯỚC ĐÂY gate
            // `previousKey !== key` (GIỐNG dòng visualBg trên) — bấm Play lại ĐÚNG bài đang load sẵn
            // (key KHÔNG đổi) thì KHÔNG gửi tín hiệu này, nên `workflowGameplay.start()` không có cơ
            // hội chạy dù đang armed. Bỏ hẳn gate cho DÒNG NÀY — `playMedia()` CHỈ được gọi từ hành
            // động "muốn phát" thật của người dùng (click Playlist/Next/Prev/hết bài tự next, KHÔNG
            // có nơi nào poll/gọi lặp), nên gửi VÔ ĐIỀU KIỆN ở đây an toàn, không spam. GIỮ NGUYÊN
            // gate cho 'visualBg.songChanged' phía trên — đó là domain KHÁC (đổi ảnh/video nền), đúng
            // ý ban đầu "seek/phát lại CÙNG bài không tính là đổi nền".
            eventBus.send({ router: 'gameplay', type: 'gameplay.mediaChanged', payload: {} });
        }, false).then(async () => {
            // Shield đã đóng HẲN (isShieldBusy = false) tới đây — an toàn để hiện modal, không
            // còn lớp che z-[200] nào đè lên modalChoice() (z-[130]) nữa.
            if (notFoundAlert) await alertModal(t('common.playSong.notFound'));
        }).catch(async err => {
            console.error(`[workflow:player] playMedia("${key}") lỗi không xác định, nhạc có thể không phát ra tiếng được:`, err);
            const rawMsg = `${err && err.name ? err.name + ': ' : ''}${err && err.message ? err.message : String(err)}`;
            await alertModal(tFormat('common.playSong.error', { message: escapeHtml(rawMsg) }));
        });
    },
};
