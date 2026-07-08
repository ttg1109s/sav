/**
 * Điều khiển phát nhạc: next/prev, chuyển sang màn hình visualizer, nút play/pause/shuffle/repeat,
 * Media Session API, thanh tiến trình, sự kiện audio (play/pause/ended/loadedmetadata/error/
 * timeupdate/seeked), bộ đếm thời gian nghe thật, modal "Tiếp tục nghe?".
 * (Trích từ file gốc, dòng 802-972 trong khối <script>)
 *
 * TÁCH FILE (ver 11, tái cấu trúc /event/): phần "Settings hiệu ứng hình ảnh/màu/EQ/volume" +
 * nút Cycle hiệu ứng (#btn-cycle-mode) trước đây nằm CHUNG file này đã dời sang
 * core/visualizer/visualizer-display.js (đúng ranh giới nghiệp vụ — phần đó là cấu hình Visualizer,
 * không phải điều khiển phát nhạc). 5 hàm `updateTypeUI`, `updateBarStyleUI`, `updateColorMenuUI`,
 * `applyEQPreset`, `updateProgressBarCSS` GIỜ định nghĩa ở visualizer-display.js — file đó PHẢI
 * nạp SAU file này (xem index.html, khu vực 4 VISUALIZERS) vì mọi lệnh gọi 5 hàm đó từ file này
 * (dòng dưới) đều nằm trong callback (lazy — chạy sau khi mọi script đã nạp xong), KHÔNG có lệnh
 * gọi nào chạy ngay lúc parse, nên thứ tự nạp này an toàn dù visualizer-display.js đứng sau.
 *
 * ÁP DỤNG /event/ (ver 11, patch 2): TOÀN BỘ 17 `addEventListener` cũ của file này (9 click UI +
 * 8 audioPlayer/progressBar event) đã CHUYỂN HẾT sang event/listener/player-controls.js — quyết
 * định CHỐT khác mục 2b.6: dù `audioPlayer`/`progressBar` là DOM cố định (không phải listener nội
 * bộ dùng-1-lần), vẫn đưa vào /event/ theo đúng nghĩa đen "DOM listener cần tách" (xem quyết định
 * người dùng, không phải mục 2b.6 phát sinh từ cụm playlist). Mọi logic nghiệp vụ TRƯỚC ĐÂY nằm
 * thẳng trong callback đã rút thành HÀM CORE THUẦN ở file này — xem từng hàm bên dưới, đối chiếu
 * event/router/player-controls.js để biết msg.type nào gọi hàm nào. Cross-call (vd updateTypeUI,
 * applyEQPreset) vẫn GIỮ NGUYÊN lệnh gọi hàm trực tiếp như cũ — KHÔNG thuộc phạm vi patch này (xem
 * plan.md, đã chốt lùi việc này tới khi 134 listener gốc tách xong hết).
 */
        /**
         * Next/Prev khi KHÔNG shuffle giờ dùng `displayOrder` (thứ tự ĐANG HIỂN THỊ theo sort mode
         * — mục 3 trong playlist.js) làm thứ tự phát, thay cho `playlistOrder` gốc (thứ tự thêm
         * vào) như trước — đúng yêu cầu "thứ tự phát = thứ tự hiển thị" khi không trộn bài.
         *
         * "Chạm biên" (Next từ bài cuối quay về đầu, hoặc Prev từ bài đầu quay về cuối) là điểm áp
         * lại sort thật cho các bài mới thêm vào lúc đang nghe (`pendingResortKeys`, xem
         * applyNewSongsToDisplayOrder trong playlist.js) — chỉ áp dụng khi KHÔNG shuffle, vì khi
         * shuffle thì shuffleIndices đã là nguồn phát riêng, không liên quan displayOrder.
         */
        /**
         * Fix (ver 8 refine): trước đây requestWakeLock() chỉ được gọi RIÊNG ở từng nơi BẤM nút
         * (click Next/Prev) — Media Session ('previoustrack'/'nexttrack', điều khiển từ màn hình
         * khoá/tai nghe) và auto-next khi hết bài ('ended') KHÔNG xin lại wake lock, nên màn hình
         * vẫn có thể tự tắt sau khi chuyển bài bằng những đường đó dù "Giữ màn hình sáng" đang bật.
         * Đưa requestWakeLock() vào ĐẦU playNext()/playPrev() — chạy NGAY khi hàm được gọi, trước
         * mọi điều kiện khác — để MỌI lối gọi (click, mediaSession, ended, và bất kỳ chỗ nào sau
         * này gọi 2 hàm này) đều tự động xin lại, không cần nhớ gọi requestWakeLock() riêng ở từng
         * nơi nữa. requestWakeLock() tự kiểm tra vizConfig.keepScreenOn nội bộ (xem wakelock.js) nên
         * gọi vô điều kiện ở đây không vi phạm tùy chọn "Giữ màn hình sáng" đang tắt.
         */
        function playNext(force = false) {
            requestWakeLock();
            if (appState.get('playlistOrder').length === 0) return;
            if (!force && appState.get('repeatMode') === 2) { audioPlayer.currentTime = 0; audioPlayer.play(); return; }
            let nextKey;
            if (appState.get('isShuffle')) {
                let currentPos = appState.get('shuffleIndices').indexOf(appState.get('currentKey'));
                if (currentPos === -1 || currentPos === appState.get('playlistOrder').length - 1) { if (appState.get('repeatMode') === 1 || force) nextKey = appState.get('shuffleIndices')[0]; else { audioPlayer.pause(); return; } }
                else nextKey = appState.get('shuffleIndices')[currentPos + 1];
            } else {
                let currentPos = appState.get('displayOrder').indexOf(appState.get('currentKey'));
                const isWrappingToStart = (currentPos === appState.get('displayOrder').length - 1);
                if (isWrappingToStart) {
                    if (appState.get('repeatMode') === 1 || force) {
                        if (appState.get('pendingResortKeys').size > 0) recomputeDisplayOrder(); // chạm biên: áp lại sort thật cho bài mới thêm giữa lúc nghe
                        nextKey = appState.get('displayOrder')[0];
                    } else { audioPlayer.pause(); return; }
                } else nextKey = appState.get('displayOrder')[currentPos + 1];
            }
            window.playSong(nextKey, { switchScreen: false }); // fix 03/07/2026 mục 5 — xem comment đầy đủ ở window.playSong (core/playlist/actions.js)
        }

        function playPrev() {
            requestWakeLock();
            if (appState.get('playlistOrder').length === 0) return;
            if (audioPlayer.currentTime > 3) { audioPlayer.currentTime = 0; return; }
            let prevKey;
            if (appState.get('isShuffle')) {
                let currentPos = appState.get('shuffleIndices').indexOf(appState.get('currentKey')); prevKey = (currentPos <= 0) ? appState.get('shuffleIndices')[appState.get('playlistOrder').length - 1] : appState.get('shuffleIndices')[currentPos - 1];
            } else {
                let currentPos = appState.get('displayOrder').indexOf(appState.get('currentKey'));
                const isWrappingToEnd = (currentPos <= 0);
                if (isWrappingToEnd) {
                    if (appState.get('pendingResortKeys').size > 0) recomputeDisplayOrder(); // chạm biên: áp lại sort thật
                    prevKey = appState.get('displayOrder')[appState.get('displayOrder').length - 1];
                } else prevKey = appState.get('displayOrder')[currentPos - 1];
            }
            window.playSong(prevKey, { switchScreen: false }); // fix 03/07/2026 mục 5 — xem comment đầy đủ ở window.playSong (core/playlist/actions.js)
        }

        /**
         * Cache "bài vừa bị dừng" lúc tab/app bị ẩn (xem wakelock.js, saveResumeStateToLocalStorage())
         * — dùng cho modalChoice() hỏi người dùng lúc khởi động lại trang sau reload (xem
         * resume-state-storage.js, checkPendingResumeStateOnBoot() gán lại 2 biến này từ snapshot đã
         * lưu trước khi gọi showResumeChoiceModal()). `lastStoppedTime` là đúng `audioPlayer.currentTime`
         * tại thời điểm bị dừng — để "Tiếp tục phát" phát đúng từ chỗ cũ, "Nghe lại" phát lại từ đầu.
         * STATE — xem service/state.js.
         */

        /**
         * Đưa UI về màn Playlist, ẩn Visualizer/player-container — dùng bởi clearAllStoredData()
         * (Clear All trong Quản lý dung lượng, xem storage-manager.js): sau khi xoá hết nhạc, UI
         * phải bị ép về đúng màn Playlist NGAY, không chờ người dùng tự bấm Back — tránh bug "Clear
         * All xong vẫn thấy current/next/prev trên màn Visualizer" (UI cũ đứng yên dù currentKey đã
         * bị xoá khỏi RAM).
         *
         * KHÔNG đụng tới currentKey/audioPlayer/RAM khác — chỉ lo phần hiển thị (class CSS, panel
         * Control Center). Nơi gọi PHẢI tự reset RAM (currentKey=null, audioPlayer.pause()...)
         * TRƯỚC khi gọi hàm này.
         *
         * FIX (ver 10 refine #3, bổ sung): KHÔNG còn được gọi lúc tab/app bị ẩn nữa (xem wakelock.js
         * — giờ ẩn tab chỉ lưu state + reload thật NGAY, không tự làm gì khác vì reload sẽ tự dọn
         * sạch UI/RAM).
         *
         * 2 nơi gọi hiện tại: clearAllStoredData() (Xoá tất cả) VÀ window.removeSong() (playlist/
         * actions.js) khi bài bị xoá đúng là currentKey (chỉ xảy ra lúc đang pause — xem comment
         * window.removeSong) — cùng 1 lý do: currentKey vừa bị xoá khỏi RAM, UI Visualizer phải bị
         * ép về màn Playlist NGAY, tránh đứng yên hiện current/next/prev của 1 bài đã không còn tồn tại.
         */
        function forceBackToPlaylistUI() {
            visualizerUI.classList.remove('fade-enter-active');
            canvas.classList.add('opacity-0');
            const webglCanvasEl = document.getElementById('webgl-canvas');
            if (webglCanvasEl) webglCanvasEl.classList.add('opacity-0');
            // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full' (dọc -> ngang) +
            // gỡ NGAY 'visualizer-active' khỏi CẢ 2 (visualizerUI/playerContainer) CÙNG LÚC với
            // Playlist hiện lại — đúng yêu cầu "đẩy đồng thời cả hai", không chờ callback trễ.
            // SỬA (07/07/2026, batch gộp container) — class dời sang `#side-left-container` (xem
            // components/app-view-stack.js), KHÔNG còn trên `#playlist-view` nữa.
            sideLeftContainer.classList.remove('playlist-hidden');
            visualizerUI.classList.remove('visualizer-active');
            playerContainer.classList.remove('visualizer-active');
            if (typeof closeControlCenter === 'function') closeControlCenter(); // phòng panel còn mở sót
            // 300 -> 500ms, khớp ĐÚNG duration của transition transform (0.5s, assets/css/style.css)
            // — dọn hidden/renderPlaylistDiff() SAU KHI slide ngang chạy xong hẳn.
            taskManager.once(() => { visualizerUI.classList.add('hidden'); playerContainer.classList.add('hidden'); renderPlaylistDiff(); }, 500, 'hideVisualizerUiAfterFade');
        }

        /**
         * Modal "Bạn có muốn tiếp tục nghe bài XXX không?" — hiện ra NGAY LÚC KHỞI ĐỘNG trang (sau
         * reload do tab/app bị ẩn — xem resume-state-storage.js, checkPendingResumeStateOnBoot(),
         * gọi hàm này NGAY SAU loadConfig(), KHÔNG đợi initPlaylistFromDB()). Dùng modalChoice()
         * (file riêng, js/core/modal-choice.js).
         *
         * FIX (ver 10 refine #3, bổ sung — modal phải hiện NGAY từ đầu, không đợi load playlist
         * xong): vì gọi trước initPlaylistFromDB(), playlistCache có thể CHƯA có dữ liệu lúc modal
         * mở — hiện tạm tiêu đề là chính currentKey (id bài) thay vì tên thật, rồi
         * updateResumeModalTitleIfPending() (gọi từ draw-visualizer.js sau khi playlist load xong)
         * tự cập nhật lại đúng tên một khi có. ĐỒNG THỜI 2 nút "Tiếp tục phát"/"Nghe lại" bị khoá
         * (disabled, đánh dấu data-resume-needs-playlist để enableResumeModalButtonsWhenPlaylistReady()
         * — resume-state-storage.js — tìm đúng nút cần mở khoá) cho tới khi playlist load xong, vì
         * playSong(key) cần playlistCache/getSongRecord() sẵn sàng mới chạy đúng được. Nút "Không"
         * KHÔNG bị khoá — luôn bấm được ngay, không cần biết playlist đã load xong hay chưa.
         *
         * 3 lựa chọn:
         *   - "Không"          -> KHÔNG áp gì vào RAM, chỉ tắt cờ + dọn snapshot (discardPendingResumeState()).
         *   - "Tiếp tục phát"  -> applyResumeStateToRam() (shuffle/repeat/displayOrder/video/auto-switch-marks)
         *                         RỒI playSong(key), seek về đúng lastStoppedTime lúc bị dừng.
         *   - "Nghe lại"       -> applyResumeStateToRam() RỒI playSong(key) phát lại TỪ ĐẦU (currentTime = 0,
         *                         playSong() tự đặt khi gán src mới — không cần seek thêm).
         */
        /**
         * Cờ chống MỞ CHỒNG modal "Tiếp tục nghe?" — phòng trường hợp showResumeChoiceModal() bị
         * gọi 2 lần (hiếm, ví dụ race điều kiện nào đó gọi checkPendingResumeStateOnBoot() lần 2).
         * true  = modal đang mở, đang chờ người dùng chọn -> gọi lại lúc này KHÔNG làm gì cả.
         * false = không có modal nào đang mở. Đặt lại false ngay khi 1 trong 3 nút được bấm.
         * STATE — xem service/state.js.
         */

        /** true khi initPlaylistFromDB() đã chạy xong (xem draw-visualizer.js) — dùng để biết
         * lúc showResumeChoiceModal() mở, có nên disable 2 nút "Tiếp tục phát"/"Nghe lại" hay
         * không (chỉ disable nếu playlist CHƯA load xong tại đúng thời điểm modal mở). STATE —
         * xem service/state.js. */

        function showResumeChoiceModal() {
            if (appState.get('isResumeModalOpen')) return; // modal cũ vẫn đang mở chờ chọn -> không mở chồng/thay thế
            if (!appState.get('lastStoppedKey')) return; // chưa từng nghe gì trước đó -> không có gì để hỏi
            const key = appState.get('lastStoppedKey');
            const resumeTime = appState.get('lastStoppedTime');
            appState.set('lastStoppedKey', null); appState.set('lastStoppedTime', 0); // tránh gọi lại nhầm key cũ nếu hàm bị gọi lần 2
            appState.set('isResumeModalOpen', true);

            // FIX (ver 10 refine #3, bổ sung — modal phải hiện NGAY từ đầu, không đợi load playlist
            // xong): gọi hàm này ngay sau loadConfig(), playlistCache rất có thể CHƯA có dữ liệu —
            // hiện tạm chính key (id bài) làm tiêu đề, updateResumeModalTitleIfPending() (gọi từ
            // draw-visualizer.js sau initPlaylistFromDB()) tự sửa lại đúng tên khi có.
            const cached = (typeof appState !== 'undefined') ? appState.get('playlistCache').get(key) : null;
            const title = cached && cached.tag && cached.tag.title ? cached.tag.title : key;
            const needsPlaylist = !appState.get('_isPlaylistReadyForResumeModal'); // playlist chưa load xong -> khoá tạm 2 nút cần playSong()

            modalChoice(
                tFormat('common.resumeModal.question', { title }),
                [
                    {
                        label: t('common.resumeModal.btnNo'),
                        className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors',
                        // "Không" KHÔNG cần playlist load xong — chỉ tắt cờ/dọn snapshot, không gọi
                        // playSong() nào cả — luôn bấm được ngay từ lúc modal vừa mở.
                        onClick: () => {
                            appState.set('isResumeModalOpen', false);
                            if (typeof discardPendingResumeState === 'function') discardPendingResumeState();
                        }
                    },
                    {
                        label: t('common.resumeModal.btnResume'),
                        className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors',
                        disabled: needsPlaylist,
                        dataset: { resumeNeedsPlaylist: '1' }, // querySelector bởi enableResumeModalButtonsWhenPlaylistReady() (resume-state-storage.js)
                        // applyResumeStateToRam() PHẢI gọi TRƯỚC window.playSong(key) — hàm đó set
                        // window._resumeAutoSwitchVisualMarks (đọc bởi startAutoSwitchVisualBranch()
                        // trong auto-switch-visual.js, tự kích hoạt qua sự kiện 'play' bên trong
                        // playSong()) và phục hồi shuffle/repeat/displayOrder cần có TRƯỚC khi người
                        // dùng bấm Next/Prev ngay sau đó.
                        onClick: async () => {
                            appState.set('isResumeModalOpen', false);
                            if (typeof applyResumeStateToRam === 'function') applyResumeStateToRam();
                            await window.playSong(key);
                            if (appState.get('currentKey') === key) audioPlayer.currentTime = resumeTime;
                        }
                    },
                    {
                        label: t('common.resumeModal.btnRestart'),
                        className: 'flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition-colors',
                        disabled: needsPlaylist,
                        dataset: { resumeNeedsPlaylist: '1' },
                        // CŨNG áp dụng applyResumeStateToRam() (shuffle/repeat/displayOrder/video/
                        // auto-switch-marks) — chỉ riêng VỊ TRÍ ĐANG NGHE của bài là phát lại từ đầu
                        // (playSong() đã tự đặt currentTime = 0 khi gán src mới — không cần seek
                        // thêm), mọi state khác vẫn nên khôi phục đúng như đã lưu.
                        onClick: () => {
                            appState.set('isResumeModalOpen', false);
                            if (typeof applyResumeStateToRam === 'function') applyResumeStateToRam();
                            window.playSong(key);
                        }
                    }
                ],
                { title: t('common.resumeModal.title') }
            );

            // Cache lại key/title hiện tại để updateResumeModalTitleIfPending() (gọi sau khi
            // playlist load xong) biết cần thay tiêu đề tạm bằng tên thật của ĐÚNG bài nào.
            appState.set('_resumeModalPendingKey', needsPlaylist ? key : null);
        }

        /** Key đang chờ cập nhật lại tiêu đề modal (chỉ có giá trị nếu modal đang mở với tiêu đề
         * TẠM — xem showResumeChoiceModal()). null nếu không cần cập nhật gì (đã có tên thật ngay
         * từ đầu, hoặc modal đã đóng). STATE — xem service/state.js. */

        /**
         * Gọi từ enableResumeModalButtonsWhenPlaylistReady() (resume-state-storage.js, sau khi
         * initPlaylistFromDB() xong) — nếu modal đang mở VỚI tiêu đề tạm (_resumeModalPendingKey
         * còn giá trị), sửa lại đúng tên bài thật từ playlistCache. No-op an toàn nếu modal đã đóng
         * hoặc tiêu đề đã đúng từ đầu.
         */
        function updateResumeModalTitleIfPending() {
            if (!appState.get('_resumeModalPendingKey')) return;
            const key = appState.get('_resumeModalPendingKey');
            appState.set('_resumeModalPendingKey', null);
            const textEl = document.getElementById('modal-choice-text');
            if (!textEl) return; // modal đã đóng (người dùng bấm trước khi load xong) -> không có gì để sửa
            const cached = (typeof appState !== 'undefined') ? appState.get('playlistCache').get(key) : null;
            const title = cached && cached.tag && cached.tag.title ? cached.tag.title : key;
            textEl.innerHTML = tFormat('common.resumeModal.question', { title });
        }

        function switchToVisualizer() {
            // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full' (dọc -> ngang)
            // + thêm 'visualizer-active' cho CẢ 2 (visualizerUI/playerContainer) NGAY LÚC NÀY
            // (cùng lúc gỡ 'hidden') để slide ngang chạy đồng thời với Playlist thoát màn hình.
            // SỬA (07/07/2026, batch gộp container) — class dời sang `#side-left-container` (xem
            // components/app-view-stack.js), KHÔNG còn trên `#playlist-view` nữa.
            sideLeftContainer.classList.add('playlist-hidden');
            visualizerUI.classList.remove('hidden'); playerContainer.classList.remove('hidden');
            visualizerUI.classList.add('visualizer-active'); playerContainer.classList.add('visualizer-active');
            // KHÔNG gọi handleVideoBackground() ở đây nữa: chuyển màn hình KHÔNG được điều khiển video
            // (video chỉ bám theo trạng thái nhạc). Playlist đè z-[60] tự che video khi cần.
            taskManager.once(() => { 
                visualizerUI.classList.add('fade-enter-active'); canvas.classList.remove('opacity-0'); 
                if (appState.get('vizConfig').type === 'vortex') document.getElementById('webgl-canvas').classList.remove('opacity-0');
            }, 50, 'showVisualizerFadeIn');
        }

        /**
         * Quay về màn Playlist (nút Back ở Visualizer). Dùng chung với resetPlayerToIdle()/
         * clearAllStoredData() — xem định nghĩa forceBackToPlaylistUI() ở trên.
         * Ứng với msg.type 'playerControls.backToPlaylist.click'.
         */
        function handleBackToPlaylistClick() {
            // KHÔNG dừng/ẩn video ở đây nữa: Playlist (z-[60]) tự che video, video vẫn chạy theo nhạc.
            forceBackToPlaylistUI();
        }

        /**
         * Play/Pause chính — rút nguyên logic từ listener cũ của playPauseBtn. Ứng với msg.type
         * 'playerControls.playPause.click'.
         */
        function togglePlayPause() {
            requestWakeLock(); if (appState.get('playlistOrder').length === 0) return;
            if (appState.get('currentKey') === null) { window.playSong(appState.get('displayOrder')[0] || appState.get('playlistOrder')[0]); return; }
            // FIX (log 9->10): 'interrupted' là trạng thái RIÊNG của iOS Safari khi audio bị hệ điều
            // hành "ngắt" lúc tab/app bị ẩn (khác 'suspended' — xem giải thích đầy đủ ở
            // setupAudioContext(), audio-engine.js). Thiếu check này thì audioContext.resume() không
            // được gọi, dù audioPlayer.play() có chạy thì vẫn không nghe được tiếng gì.
            if (audioPlayer.paused) { audioPlayer.play(); if (appState.get('audioContext') && (appState.get('audioContext').state === 'suspended' || appState.get('audioContext').state === 'interrupted')) appState.get('audioContext').resume(); } else { audioPlayer.pause(); }
        }

        /**
         * Toggle bật/tắt Shuffle + đồng bộ class màu nút. Ứng với msg.type 'playerControls.shuffle.click'.
         *
         * SỬA (fix 03/07/2026, mục 3b) — bản trước tự appState.get('isShuffle') 3 lần (vi phạm
         * Rule 2) RỒI tự gọi updateShuffleArray() (void, đồng bộ -> đúng hình dạng Workflow theo
         * Rule 3, KHÔNG được giữ trong core) ngay bên trong — đây chính là NGUYÊN NHÂN gốc của bug
         * "Shuffle ở Control Center luôn nhảy về playlist chính thay vì hiện hành": updateShuffleArray()
         * (core/playlist/order.js) LUÔN đọc playlistOrder (top-level), không biết gì về 1 section
         * đang active hay không. Sửa đúng: hàm NÀY chỉ còn ĐÚNG 1 việc (đơn tuyến) — đảo cờ + đồng
         * bộ class nút, KHÔNG tự tính lại shuffleIndices nữa. Việc tính lại (dùng hàm MỚI
         * updateShuffleArrayFromQueue(), theo ĐÚNG "hiện hành" thay vì luôn top-level) dời sang
         * workflowPlayerControls.toggleShuffleAndReshuffle() (event/workflow/player-controls.js).
         * Rule 2: nhận isShuffleCurrent qua tham số, KHÔNG tự appState.get().
         * @param {boolean} isShuffleCurrent - appState.get('isShuffle') TRƯỚC khi đảo, nơi gọi
         *        (workflow) tự đọc rồi truyền vào.
         * @returns {boolean} giá trị isShuffle MỚI sau khi đảo — nơi gọi DÙNG để quyết định có cần
         *          random lại shuffleIndices hay không (Rule 3: core-gọi-core hợp lệ vì workflow
         *          THẬT SỰ dùng giá trị trả về).
         */
        function toggleShuffle(isShuffleCurrent) {
            const next = !isShuffleCurrent;
            appState.set('isShuffle', next);
            console.log(`writer: "toggleShuffle", page: "isShuffle", content: "${next}"`);
            btnShuffle.classList.toggle('!text-sky-400', next);
            btnShuffle.classList.toggle('text-slate-400', !next);
            return next;
        }

        /**
         * Xoay vòng 3 trạng thái Repeat (tắt -> lặp danh sách -> lặp 1 bài) + đồng bộ class/badge.
         * Ứng với msg.type 'playerControls.repeat.click'.
         */
        function cycleRepeatMode() {
            appState.set('repeatMode', (appState.get('repeatMode') + 1) % 3);
            if (appState.get('repeatMode') === 0) { btnRepeat.classList.remove('!text-sky-400'); btnRepeat.classList.add('text-slate-400'); repeatBadge.classList.add('hidden'); } 
            else if (appState.get('repeatMode') === 1) { btnRepeat.classList.remove('text-slate-400'); btnRepeat.classList.add('!text-sky-400'); repeatBadge.classList.add('hidden'); } 
            else if (appState.get('repeatMode') === 2) { btnRepeat.classList.add('!text-sky-400'); repeatBadge.classList.remove('hidden'); }
        }

        /**
         * Mở drawer Settings — dùng chung cho cả 2 nút mở (#btn-settings ở Visualizer,
         * #btn-settings-playlist ở Playlist). Ứng với msg.type 'playerControls.settingsDrawer.open'.
         *
         * VIẾT LẠI (07/07/2026, phản hồi Giang mục 2 — gộp Playlist+Settings chung 1 container
         * cuộn ngang): TRƯỚC ĐÂY `drawerSettings.classList.remove('-translate-y-full')` (slide dọc
         * độc lập, luôn nổi lên trên bất kể đang ở Playlist hay Visualizer). GIỜ `#drawer-settings`
         * là 1 "trang" cuộn ngang bên trong `#side-left-container` (components/app-view-stack.js)
         * — mở từ Visualizer (mobile) CẦN thêm bỏ class `playlist-hidden` để chính
         * `#side-left-container` hiện ra trước (nếu không, cuộn nội dung bên trong nó cũng vô
         * nghĩa vì bản thân nó đang trượt ra ngoài màn hình). ĐÁNH ĐỔI ĐƠN GIẢN HOÁ: đóng Settings
         * (bất kể mở từ đâu) LUÔN về lại Playlist — KHÔNG tự nhớ "mở từ Visualizer thì đóng phải về
         * lại Visualizer" (edge case hiếm, thêm state theo dõi không đáng — chấp nhận thay đổi hành
         * vi nhỏ này). Trình duyệt tự animate cuộn ngang (CSS `scroll-behavior: smooth`, xem
         * assets/css/style.css) — KHÔNG cần tự tay viết transition/easing cho việc này.
         */
        function openSettingsDrawer() {
            sideLeftContainer.classList.remove('playlist-hidden'); // đảm bảo hiện ra nếu đang ở Visualizer (mobile)
            sideLeftContainer.scrollTo({ left: sideLeftContainer.clientWidth, behavior: 'smooth' });
        }

        /**
         * Đóng drawer Settings — kèm validateVideoBgOnClose() (kiểm tra lại video nền lúc đóng,
         * giữ đúng hành vi gốc). Ứng với msg.type 'playerControls.settingsDrawer.close'.
         *
         * VIẾT LẠI (07/07/2026, phản hồi Giang mục 2) — cuộn NGANG về lại trang Playlist (left:0)
         * thay vì `classList.add('-translate-y-full')` cũ (xem docstring openSettingsDrawer() ở
         * trên về đánh đổi "luôn về Playlist" đã chấp nhận).
         */
        function closeSettingsDrawer() {
            validateVideoBgOnClose();
            sideLeftContainer.scrollTo({ left: 0, behavior: 'smooth' });
        }

        // Ver 8 refine (mục 2 — loại bỏ can thiệp điều khiển từ ngoài app): KHÔNG còn
        // navigator.mediaSession.setActionHandler(...) nào nữa — play/pause/next/prev/seek từ màn
        // hình khoá, tai nghe, hoặc nút điều khiển trên thông báo hệ thống SẼ KHÔNG còn tác dụng.
        // navigator.mediaSession.metadata (tên bài/ảnh hiển thị trên thông báo, xem playlist/
        // actions.js) và .playbackState (trạng thái playing/paused hiển thị) VẪN GIỮ — đây chỉ là
        // thông tin hiển thị một chiều, không phải đường điều khiển ngược lại vào app.

        function updateMediaPositionState() {
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
                if (isFinite(audioPlayer.duration) && isFinite(audioPlayer.currentTime) && isFinite(audioPlayer.playbackRate)) {
                    try { navigator.mediaSession.setPositionState({ duration: audioPlayer.duration, playbackRate: audioPlayer.playbackRate, position: audioPlayer.currentTime }); } catch(e) {}
                }
            }
        }

        // ===== Bộ đếm THỜI GIAN NGHE THẬT — đồng hồ thực, ĐỘC LẬP với thanh tiến trình =====
        // Trước đây thời lượng nghe được suy ra từ delta của audioPlayer.currentTime (vị trí thanh
        // tiến trình). Cách đó không đáng tin: currentTime nhảy khi seek, khựng khi buffer, và phụ
        // thuộc tốc độ phát — không phản ánh đúng "đã nghe bao lâu theo đồng hồ". Bản này đo bằng
        // performance.now(): một task lặp 1s (qua taskManager, mode 'timeout' — bù trôi, tránh dồn
        // tick khi tab bị throttle nền) chỉ chạy KHI nhạc thực sự đang phát, cộng dồn delta thời
        // gian thực vào cả tổng (meta.totalListenSeconds) lẫn từng bài (addSongListenTime).
        //
        // Mỗi lần play() là 1 "phiên" đếm MỚI (không nối tiếp pha cũ của lần phát trước) — vì vậy
        // startListenClock() luôn kill() task cũ (nếu lỡ còn sót) rồi addNew() + enabled() lại từ
        // đầu, KHÔNG dùng taskManager.resume() (resume() giữ nguyên remainingTime để nối đúng pha
        // — đúng nghĩa cho việc tạm dừng/tiếp tục GIỮA chừng 1 phiên, không phải bắt đầu phiên mới).
        const LISTEN_CLOCK_TASK = 'listenClock';
        // _listenLastTick, pendingListenSeconds — STATE (phần tổng chưa flush vào IndexedDB, cũng
        // được app-cleanup.js flush lúc unload) — xem service/state.js.

        function _listenTick() {
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            let delta = (now - appState.get('_listenLastTick')) / 1000;
            appState.set('_listenLastTick', now, { skipCheck: true }); // chạy mỗi giây qua taskManager — bỏ qua validate để đảm bảo hiệu năng
            if (!(delta > 0)) return;
            // Chặn delta bất thường khi tab bị treo/throttle nền hoặc máy ngủ rồi thức (tránh cộng
            // vọt hàng phút/giờ). Giới hạn 4s/tick (chu kỳ 1s nên bình thường delta ~1s).
            if (delta > 4) delta = 4;
            appState.set('pendingListenSeconds', appState.get('pendingListenSeconds') + delta, { skipCheck: true }); // chạy mỗi giây qua taskManager — bỏ qua validate để đảm bảo hiệu năng
            if (appState.get('currentKey') && typeof addSongListenTime === 'function') addSongListenTime(appState.get('currentKey'), delta);
            if (appState.get('pendingListenSeconds') >= 5) {
                const toFlush = appState.get('pendingListenSeconds'); appState.set('pendingListenSeconds', 0, { skipCheck: true }); // chạy mỗi giây qua taskManager — bỏ qua validate để đảm bảo hiệu năng
                // FIX (log 9->10, mục "Promise bị reject nhưng không ai .catch()"): hàm này chạy mỗi
                // GIÂY qua taskManager (xem startListenClock()) SUỐT lúc nhạc đang phát — nếu tab bị
                // ẩn trên iOS và connection IndexedDB bị hệ điều hành đóng/treo giữa lúc transaction
                // đang mở (db.transaction() throw đồng bộ một DOMException khi connection đã chết —
                // xem db.js, makeStoreAccessor), exception đó tự biến thành promise reject vì nằm
                // trong .then() callback. Thiếu .catch() ở đây khiến nó thoát ra dưới dạng
                // "unhandled promise rejection" — có thể lặp lại MỖI GIÂY nếu trạng thái lỗi kéo dài,
                // đúng log "[FATAL] Promise bị reject nhưng không ai .catch(): TypeError {}" người
                // dùng báo lại qua console-log tool. Best-effort — bỏ qua lỗi (log để dò), không để
                // 1 lượt ghi thống kê lỗi làm crash/spam lỗi ra ngoài.
                getMeta('totalListenSeconds')
                    .then(v => setMeta('totalListenSeconds', (v || 0) + toFlush))
                    .catch(err => console.warn('[player-controls] Không ghi được totalListenSeconds (best-effort, bỏ qua):', err));
            }
        }
        function startListenClock() {
            taskManager.kill(LISTEN_CLOCK_TASK); // phòng còn sót từ phiên trước (an toàn nếu gọi lại)
            appState.set('_listenLastTick', (typeof performance !== 'undefined' ? performance.now() : Date.now())); // chạy 1 lần lúc bắt đầu phiên — giữ validate bình thường
            taskManager.addNew(LISTEN_CLOCK_TASK, { time: 1000, exe: _listenTick, mode: 'timeout', count: 0 });
            taskManager.operator(LISTEN_CLOCK_TASK, 'enabled');
        }
        function stopListenClock() {
            if (!taskManager.isTaskRunning(LISTEN_CLOCK_TASK)) return;
            _listenTick(); // chốt nốt phần lẻ kể từ tick gần nhất trước khi dừng
            taskManager.kill(LISTEN_CLOCK_TASK);
        }

        /**
         * Audio bắt đầu phát (sự kiện 'play' của audioPlayer) — cập nhật icon, record-art quay,
         * Media Session, refresh node danh sách, bắt đầu đếm thời gian nghe, đồng bộ auto-switch +
         * video nền. Ứng với msg.type 'playerControls.audio.play'.
         */
        function handleAudioPlay() {
            iconPlay.classList.add('hidden'); iconPause.classList.remove('hidden'); 
            let recordArtDynamic = document.getElementById('record-art'); if(recordArtDynamic) recordArtDynamic.classList.remove('paused');
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
            if (appState.get('currentKey')) refreshSongNode(appState.get('currentKey'));
            startListenClock();
            if (typeof syncAutoSwitchVisualPlayState === 'function') syncAutoSwitchVisualPlayState(); // ver 10: xem auto-switch-visual.js
            // Chỉ ĐỒNG BỘ phát video theo nhạc — KHÔNG fade lại. Nguồn + fade đã thiết lập 1 lần
            // lúc bật/upload/nạp trang (handleVideoBackground), nên Next/Prev không lặp lại cú fade.
            syncVideoBgToAudio();
        }

        /**
         * Audio bị dừng (sự kiện 'pause') — ngược lại handleAudioPlay(), cộng thêm
         * releaseWakeLock(). Ứng với msg.type 'playerControls.audio.pause'.
         */
        function handleAudioPause() {
            iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden'); 
            let recordArtDynamic = document.getElementById('record-art'); if(recordArtDynamic) recordArtDynamic.classList.add('paused');
            releaseWakeLock(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            if (appState.get('currentKey')) refreshSongNode(appState.get('currentKey'));
            stopListenClock();
            if (typeof syncAutoSwitchVisualPlayState === 'function') syncAutoSwitchVisualPlayState(); // ver 10: xem auto-switch-visual.js
            syncVideoBgToAudio();
        }

        /**
         * Bài hát phát hết (sự kiện 'ended') — dừng đếm giờ nghe, tự chuyển bài kế tiếp (không
         * force, tôn trọng repeatMode/wrap-around như Next thường). Ứng với msg.type
         * 'playerControls.audio.ended'.
         */
        function handleAudioEnded() {
            stopListenClock(); playNext(false);
        }

        /**
         * Đã đọc xong metadata (duration) của bài mới (sự kiện 'loadedmetadata') — đặt lại max
         * thanh tiến trình, hiển thị tổng thời lượng, đồng bộ Media Session, build lại marks cho
         * auto-switch-visual. Ứng với msg.type 'playerControls.audio.loadedmetadata'.
         */
        function handleAudioLoadedMetadata() {
            progressBar.max = audioPlayer.duration; durationTimeDisplay.textContent = formatTime(audioPlayer.duration); updateMediaPositionState();
            // ver 10: bài MỚI bắt đầu (duration vừa có giá trị chính xác) -> build lại marks cho
            // auto-switch-visual — xem onAutoSwitchVisualSongChanged() ở auto-switch-visual.js.
            if (typeof onAutoSwitchVisualSongChanged === 'function') onAutoSwitchVisualSongChanged();
        }

        /**
         * Lỗi decode THẬT (sự kiện 'error', khác với "không tìm thấy record" đã xử lý riêng trong
         * playSong) — trình duyệt gán src xong rồi mới phát hiện không decode được (file hỏng dù
         * qua được check nhanh lúc nạp/quét). Chỉ xử lý khi đang thực sự gắn với currentKey
         * (audioPlayer.src vẫn còn trỏ đúng bài đó) — tránh trường hợp hiếm: lỗi bắn ra sau khi đã
         * playSong() sang bài khác. Ứng với msg.type 'playerControls.audio.error'.
         */
        function handleAudioError() {
            if (appState.get('currentKey') && appState.get('currentObjectURL') && audioPlayer.src === appState.get('currentObjectURL')) {
                handlePlaybackError(appState.get('currentKey'));
            }
        }

        /** Mốc lần gần nhất đồng bộ Media Session position trong handleAudioTimeUpdate() — giới
         * hạn tần suất gọi setPositionState (mỗi 5s) thay vì gọi mỗi tick 'timeupdate' (rất dày). */
        let lastPositionSync = 0;

        /**
         * Cập nhật UI theo thời gian thực lúc đang phát (sự kiện 'timeupdate', bắn rất dày) — thanh
         * tiến trình (nếu không đang kéo tay), hiển thị thời gian hiện tại, xử lý phụ đề, đồng bộ
         * Media Session mỗi 5s. Ứng với msg.type 'playerControls.audio.timeupdate'.
         */
        function handleAudioTimeUpdate() {
            if (!appState.get('isSeeking')) { progressBar.value = audioPlayer.currentTime; updateProgressBarCSS(); } 
            currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime); processSubtitles(audioPlayer.currentTime);
            if (Date.now() - lastPositionSync > 5000) { updateMediaPositionState(); lastPositionSync = Date.now(); }
            // (Thống kê thời lượng nghe KHÔNG còn tính ở đây — xem "Bộ đếm thời gian nghe thật"
            //  phía trên: đo bằng đồng hồ thực, độc lập với currentTime/thanh tiến trình.)
        }

        /**
         * Người dùng ĐANG kéo tay thanh tiến trình (sự kiện 'input' trên progressBar, bắn liên tục
         * khi kéo) — đặt cờ isSeeking để handleAudioTimeUpdate() không đè giá trị, hiển thị tạm
         * thời gian theo VỊ TRÍ ĐANG KÉO (chưa commit), xử lý phụ đề theo vị trí đó luôn. Ứng với
         * msg.type 'playerControls.progressBar.seeking'.
         * @param {number} value - progressBar.value tại thời điểm kéo
         */
        function handleProgressBarSeeking(value) {
            appState.set('isSeeking', true); currentTimeDisplay.textContent = formatTime(value); updateProgressBarCSS(); processSubtitles(value);
        }

        /**
         * Người dùng THẢ tay, commit vị trí mới (sự kiện 'change' trên progressBar) — set thật
         * audioPlayer.currentTime, tắt cờ isSeeking, đồng bộ lại Media Session ngay. Ứng với
         * msg.type 'playerControls.progressBar.seekCommit'.
         * @param {number} value - progressBar.value tại thời điểm commit
         */
        function handleProgressBarSeekCommit(value) {
            audioPlayer.currentTime = value; appState.set('isSeeking', false); updateMediaPositionState();
        }
