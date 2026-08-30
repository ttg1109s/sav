/**
 * Điều khiển phát nhạc: toggle play/pause của track đã tải, chuyển sang màn hình visualizer, nút
 * shuffle/repeat, Media Session API, thanh tiến trình, sự kiện audio (play/pause/loadedmetadata/
 * error/timeupdate/seeked), bộ đếm thời gian nghe thật, modal "Tiếp tục nghe?".
 *
 * [SỬA — plan-playmedia-reorg.md] `playNext()`/`playPrev()`/`handleAudioEnded()` ĐÃ XOÁ khỏi file
 * này — 3 hàm đó thật ra luôn là ĐIỀU PHỐI (đọc appState nhiều lần, gọi Core khác nối tiếp), sai
 * tầng từ đầu (core-legacy-audit.md từng track các vi phạm Rule 2/3 tương ứng). Logic "tiến 1 bước
 * trong hàng đợi" tách thành Core thuần dùng chung (`computeListStep`/`decideBoundaryAction`/
 * `shouldRestartInsteadOfAdvance`, core/playlist/order.js); phần điều phối (đọc state, gọi Core,
 * gọi `workflowPlayer.playMedia()`) chuyển hẳn sang `workflowPlayerControls.goToNextTrack()`/
 * `goToPrevTrack()`/`handleSongEnded()` (event/workflow/player-controls.js). Router
 * (event/router/player-controls.js) giờ gọi thẳng 3 method Workflow đó thay vì hàm Core cũ.
 *
 * `togglePlayPause()` (còn lại trong file này) cũng ĐÃ TÁCH — trước đây tự gộp 2 tiến trình khác
 * nhau ("chưa có bài nào đang tải -> phát bài đầu tiên" / "toggle play-pause") trong 1 hàm, vi
 * phạm Rule 1. Phần "chưa có gì đang tải -> phát bài đầu tiên" dời sang
 * `workflowPlayerControls.handlePlayPauseClick()` — hàm CÒN LẠI ở đây giờ CHỈ còn ĐÚNG 1 việc,
 * nhận `audioContext` qua tham số (Rule 2 hợp lệ, KHÔNG tự `appState.get()` nữa).
 *
 * TÁCH FILE (ver 11, tái cấu trúc /event/): phần "Settings hiệu ứng hình ảnh/màu/EQ/volume" +
 * nút Cycle hiệu ứng (#btn-cycle-mode) trước đây nằm CHUNG file này đã dời sang
 * core/visualizer/visualizer-display.js (đúng ranh giới nghiệp vụ — phần đó là cấu hình Visualizer,
 * không phải điều khiển phát nhạc). `updateTypeUI`/`updateProgressBarCSS` định nghĩa ở
 * visualizer-display.js — file đó PHẢI nạp SAU file này (xem index.html, khu vực 4 VISUALIZERS)
 * vì mọi lệnh gọi 2 hàm đó từ file này (dòng dưới) đều nằm trong callback (lazy — chạy sau khi
 * mọi script đã nạp xong), KHÔNG có lệnh gọi nào chạy ngay lúc parse, nên thứ tự nạp này an toàn
 * dù visualizer-display.js đứng sau.
 *
 * ÁP DỤNG /event/ (ver 11, patch 2): TOÀN BỘ `addEventListener` cũ của file này (click UI +
 * audioPlayer/progressBar event) đã CHUYỂN HẾT sang event/listener/player-controls.js. Mọi logic
 * nghiệp vụ TRƯỚC ĐÂY nằm thẳng trong callback đã rút thành HÀM CORE THUẦN ở file này — xem từng
 * hàm bên dưới, đối chiếu event/router/player-controls.js để biết msg.type nào gọi hàm nào.
 */

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
         * HOTFIX 10 (08/07/2026, Giang chỉ ra — "sao cứ nghĩ hàm này BẮT BUỘC phải set state, bỏ
         * dòng đó ra rồi tái dùng") — ĐÃ BỎ `appState.set('isVisualizerActive', false)` VÀ dòng
         * `scrollLeft = 0` (phòng thủ thêm trước đó) khỏi hàm. Hàm giờ THUẦN 1 việc — "trượt cả
         * khối #side-left-container vào + tắt hẳn UI Visualizer (fade-out canvas, gỡ
         * visualizer-active, ẩn sau khi fade xong)" — KHÔNG tự set cờ gì (đúng Rule 1: 1 hàm =
         * 1 việc). Tách riêng `setVisualizerActiveFalse()` (core mới, ngay dưới) — NƠI GỌI PHẢI TỰ
         * THÊM hàm đó nếu muốn state đổi thành `false` (4 nơi hiện tại ĐANG cần:
         * handleBackToPlaylistClick() ngay dưới, clearAllStoredData() storage-manager.js,
         * window.removeSong()/xoá hàng loạt core/playlist/actions.js + event/workflow/playlist.js
         * — đã cập nhật đủ cả 4).
         *
         * (HOTFIX 11, 08/07/2026 — batch này TỪNG có thêm 1 nơi gọi nữa, tái dùng hàm này cho "mở
         * Settings từ Visualizer" mà CỐ Ý không gọi setVisualizerActiveFalse(); nút đó đã bị BỎ
         * HẲN, xem components/visualizer-overlay.js — không còn liên quan tới hàm này nữa, nhưng
         * việc tách state ra khỏi hàm ở HOTFIX 10 vẫn giữ nguyên vì tự nó đã đúng Rule 1.)
         */
        function forceBackToPlaylistUI() {
            // MỚI (phản hồi Giang 29/07/2026, "scroll tức thì trước khi ra vào playlist") — gọi
            // NGAY ĐẦU hàm, lúc `#app-stack` VẪN còn class 'playlist-hidden' (dịch ra ngoài khung
            // nhìn qua transform, KHÔNG phải display:none — scrollIntoView() vẫn hoạt động bình
            // thường) — cuộn xong TRƯỚC dòng gỡ class ngay dưới, nên lúc Playlist TRƯỢT VÀO thấy
            // ĐÃ ở đúng vị trí dòng đang phát từ đầu, không có pha nhảy/cuộn nào lộ ra mắt.
            scrollToCurrentKeyInstant(); // core/playlist/render.js
            visualizerUI.classList.remove('fade-enter-active');
            canvas.classList.add('opacity-0');
            const webglCanvasEl = document.getElementById('webgl-canvas');
            if (webglCanvasEl) webglCanvasEl.classList.add('opacity-0');
            // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full' (dọc -> ngang) +
            // gỡ NGAY 'visualizer-active' khỏi CẢ 2 (visualizerUI/playerContainer) CÙNG LÚC với
            // Playlist hiện lại — đúng yêu cầu "đẩy đồng thời cả hai", không chờ callback trễ.
            // SỬA (07/07/2026, batch gộp container) — class dời sang `#side-left-container`.
            // HOTFIX 16 (08/07/2026) — dời TIẾP sang `#app-stack` (khung ngoài cùng MỚI, xem
            // components/app-view-stack.js) — `#side-left-container` giờ CHỈ còn lo cuộn ngang,
            // không tự transform/định vị gì nữa.
            appStack.classList.remove('playlist-hidden');
            visualizerUI.classList.remove('visualizer-active');
            playerContainer.classList.remove('visualizer-active');
            if (typeof closeControlCenter === 'function') closeControlCenter(); // phòng panel còn mở sót
            // 300 -> 500ms, khớp ĐÚNG duration của transition transform (0.5s, assets/css/style.css)
            // — dọn hidden/renderPlaylistDiff() SAU KHI slide ngang chạy xong hẳn.
            taskManager.once(() => { visualizerUI.classList.add('hidden'); playerContainer.classList.add('hidden'); renderPlaylistDiff(); }, 500, 'hideVisualizerUiAfterFade');
        }

        /**
         * MỚI (08/07/2026, HOTFIX 10) — tách RIÊNG khỏi `forceBackToPlaylistUI()` (xem docstring
         * đầy đủ ở đó) để hàm đó tái dùng được cho cả trường hợp KHÔNG muốn đổi state (mở Settings
         * từ Visualizer). Nơi gọi `forceBackToPlaylistUI()` mà THẬT SỰ muốn rời Visualizer (không
         * phải mở Settings) phải tự gọi thêm hàm này — xem danh sách nơi gọi ở docstring
         * `forceBackToPlaylistUI()`.
         */
        function setVisualizerActiveFalse() {
            appState.set('isVisualizerActive', false);
            console.log(`writer: "setVisualizerActiveFalse", page: "isVisualizerActive", content: "false"`);
        }

        /**
         * Modal "Bạn có muốn tiếp tục nghe bài XXX không?" — hiện ra NGAY LÚC KHỞI ĐỘNG trang (sau
         * reload do tab/app bị ẩn — xem resume-state-storage.js, checkPendingResumeStateOnBoot(),
         * gọi hàm này NGAY SAU loadConfig(), KHÔNG đợi initPlaylistFromDB()). Dùng modalChoice()
         * (file riêng, js/core/modal-choice-ui.js).
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
                        // applyResumeStateToRam() PHẢI gọi TRƯỚC workflowPlayer.playMedia(key) —
                        // hàm đó set window._resumeAutoSwitchVisualMarks (đọc bởi
                        // startAutoSwitchVisualBranch() trong auto-switch-visual.js, tự kích hoạt
                        // qua sự kiện 'play' bên trong playMedia()) và phục hồi shuffle/repeat/
                        // displayOrder cần có TRƯỚC khi người dùng bấm Next/Prev ngay sau đó.
                        // [SỬA — plan-playmedia-reorg.md] `window.playSong()` -> `workflowPlayer.
                        // playMedia()` (event/workflow/player.js), CHỈ đổi tên gọi — vẫn nằm trong
                        // diện ngoại lệ Rule 5a đã audit (onClick bên trong modalChoice()), Core
                        // gọi thẳng Workflow tại 2 điểm này KHÔNG phải kiến trúc mới, CÙNG KHUÔN
                        // đã có sẵn ở handleAudioPlay()/handleAudioPause() (gọi thẳng
                        // workflowVisualBg) trong CHÍNH file này.
                        onClick: async () => {
                            appState.set('isResumeModalOpen', false);
                            if (typeof applyResumeStateToRam === 'function') applyResumeStateToRam();
                            await workflowPlayer.playMedia(key);
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
                        // (playMedia() đã tự đặt currentTime = 0 khi gán src mới — không cần seek
                        // thêm), mọi state khác vẫn nên khôi phục đúng như đã lưu.
                        onClick: () => {
                            appState.set('isResumeModalOpen', false);
                            if (typeof applyResumeStateToRam === 'function') applyResumeStateToRam();
                            workflowPlayer.playMedia(key);
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
            // SỬA (07/07/2026, batch gộp container) — class dời sang `#side-left-container`.
            // HOTFIX 16 (08/07/2026) — dời TIẾP sang `#app-stack` (xem forceBackToPlaylistUI() ở
            // trên, cùng lý do).
            appStack.classList.add('playlist-hidden');
            // MỚI (phản hồi Giang 29/07/2026, "scroll tức thì trước khi ra vào playlist") — cuộn
            // NGAY SAU khi bắt đầu dịch Playlist ra khỏi khung nhìn (transform vừa thêm ở trên) —
            // đảm bảo lần quay lại TIẾP THEO (kể cả không đi qua forceBackToPlaylistUI(), hiếm khi
            // xảy ra nhưng để đối xứng đúng yêu cầu "cả 2 chiều ra/vào") danh sách đã sẵn đúng vị
            // trí dòng đang phát, không cần đợi thêm bước nào khác.
            scrollToCurrentKeyInstant(); // core/playlist/render.js
            // HOTFIX 12 (08/07/2026, Giang truy đúng gốc) — ĐÃ XOÁ dòng `sideLeftContainer.
            // scrollLeft = 0;` từng nằm ở đây (thêm HOTFIX 7/8, tưởng "phòng thủ rẻ, vô hại" —
            // SAI). `#side-left-container` có CSS `scroll-behavior: smooth` (assets/css/
            // style.css) — theo đúng đặc tả CSSOM View, gán TRỰC TIẾP `.scrollLeft = x` dùng
            // "auto" behavior, và "auto" LUÔN phân giải theo `scroll-behavior` tính toán của phần
            // tử: đã khai `smooth` thì gán thẳng `scrollLeft` KHÔNG hề nhảy tức thời như tưởng —
            // nó tự ANIMATE, chạy CÙNG LÚC với transition `transform` 0.5s (do vừa thêm class
            // `playlist-hidden` ngay trên) trên CHÍNH 1 phần tử — 2 animation khác cơ chế
            // (transform-transition CSS thuần vs scroll smooth-animation) chồng lên nhau, đúng
            // nguồn gây hiện tượng "giật đi giật lại" Giang báo, dù bug chỉ LỘ RA muộn hơn (lúc
            // quay lại Playlist rồi mở Settings) vì đó là lần đầu người dùng THẤY lại
            // #side-left-container sau khi trạng thái cuộn nội bộ của nó bị animation này làm
            // lệch. Dòng đó cũng CHƯA BAO GIỜ thật sự cần: cả 3 nơi gọi switchToVisualizer()
            // (tap bài hát trong Playlist, core/playlist/actions.js x2; nút "Quay lại Visualizer"
            // #btn-return-visual, core/state-and-video-bg.js::returnToVisualizer()) ĐỀU chỉ có
            // thể bấm được lúc trang Playlist đang hiện — tức `scrollLeft` LUÔN đã ≈0 sẵn từ
            // trước, gán lại 0 chưa từng có tác dụng thật, chỉ có tác dụng PHỤ (bug) như trên.
            appState.set('isVisualizerActive', true); // MỚI (07/07/2026, phản hồi Giang mục 1)
            visualizerUI.classList.remove('hidden'); playerContainer.classList.remove('hidden');
            visualizerUI.classList.add('visualizer-active'); playerContainer.classList.add('visualizer-active');
            // KHÔNG gọi handleVideoBackground() ở đây nữa: chuyển màn hình KHÔNG được điều khiển video
            // (video chỉ bám theo trạng thái nhạc). Playlist đè z-[60] tự che video khi cần.
            taskManager.once(() => { 
                visualizerUI.classList.add('fade-enter-active'); canvas.classList.remove('opacity-0'); 
                // FIX (Giang báo — "Space mất render mỗi lần ra/vào Playlist") — thiếu 'space' ở
                // đây, CHỈ check 'vortex' trong khi Vortex/Space DÙNG CHUNG #webgl-canvas (xem
                // core/visualizer/visualizer-display.js::updateTypeUI(), dòng check ĐÚNG cả 2).
                // Quay lại Playlist (forceBackToPlaylistUI()) luôn ADD opacity-0 vô điều kiện, nên
                // ở Space, canvas kẹt vô hình dù JS vẫn tính/vẽ bình thường phía sau — chỉ "tự
                // khỏi" khi có hành động khác gọi updateTypeUI() (không phân biệt type) như đổi bài.
                const t = appConfigViz.getAll().type;
                if (t === 'vortex' || t === 'space') document.getElementById('webgl-canvas').classList.remove('opacity-0');
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
            setVisualizerActiveFalse(); // MỚI (08/07/2026, HOTFIX 10) — forceBackToPlaylistUI() không còn tự set nữa
        }

        /**
         * Element ĐANG THỰC SỰ PHÁT — `bgVideoElement` (Video Player mode) hay `audioPlayer` (Song).
         * DÙNG CHUNG bởi MỌI domain cần biết "element nào đang chạy" — trước đây mỗi nơi (Next/Prev,
         * Game Mode) tự viết lại ternary `isVideoPlayerMode ? bgVideoElement : audioPlayer` riêng
         * (2 lần ở event/workflow/player-controls.js, SẮP thêm 6 lần nữa ở event/workflow/
         * gameplay.js nếu không gộp) — tách ra ĐÚNG 1 chỗ, Core thuần (Rule 2: nhận
         * `isVideoPlayerMode` qua tham số, KHÔNG tự `appState.get()`), mọi nơi gọi lại.
         * @param {boolean} isVideoPlayerMode
         * @returns {HTMLMediaElement}
         */
        function getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode) {
            // SỬA (Giang yêu cầu — Photo tích hợp `duration` như Song/Video) — thêm tham số
            // `isPhotoPlayerMode`, trả `photoPlayerFakeMediaElement` (core/photo-player.js) khi
            // true — KHÔNG phải HTMLMediaElement thật (ảnh không có), nhưng mô phỏng ĐÚNG 4 thành
            // viên (`currentTime` get/set, `paused` get, `play()`/`pause()`) mà 2 nơi gọi hiện có
            // (goToNextTrack()/goToPrevTrack(), event/workflow/player-controls.js VÀ event/
            // workflow/gameplay.js) cần — nơi gọi KHÔNG cần sửa gì thêm ngoài truyền thêm tham số
            // này, mọi `activeEl.currentTime`/`.paused`/`.play()`/`.pause()` hiện có tự hoạt động
            // đúng. Rule 2 vẫn giữ (2 tham số đều do nơi gọi tự đọc appState rồi truyền vào).
            if (isPhotoPlayerMode) return photoPlayerFakeMediaElement; // core/photo-player.js
            return isVideoPlayerMode ? bgVideoElement : audioPlayer;
        }

        /**
         * Toggle play/pause của track ĐÃ TẢI. Ứng với nhánh "đã có currentKey" của msg.type
         * 'playerControls.playPause.click' — nhánh "chưa có gì đang tải -> phát bài đầu tiên" dời
         * sang `workflowPlayerControls.handlePlayPauseClick()` (event/workflow/player-controls.js).
         *
         * [SỬA — plan-playmedia-reorg.md, xử lý triệt để] TRƯỚC ĐÂY hàm này tự gộp 2 TIẾN TRÌNH
         * khác nhau — "chưa có bài nào đang tải -> phát bài đầu tiên" (gọi `window.playSong()`) và
         * "đang có bài đã tải -> toggle play/pause" — vi phạm Rule 1 (core-function-conventions.md:
         * "if/else chọn giữa ≥2 tiến trình nghiệp vụ khác nhau"), cộng thêm tự `appState.get()` 3
         * lần (vi phạm Rule 2). Tách đúng theo Rule 1: hàm NÀY giờ CHỈ còn ĐÚNG 1 việc; quyết định
         * "có cần phát bài đầu tiên trước không" (đọc `currentKey`/`playlistOrder`/`displayOrder`)
         * dời hẳn sang Workflow — nơi DUY NHẤT được đọc appState để chọn gọi Core nào. Rule 2: nhận
         * `audioContext` qua tham số, KHÔNG tự `appState.get()` nữa.
         * @param {AudioContext|null} audioContext - appState.get('audioContext') tại thời điểm gọi,
         *        nơi gọi (workflow) tự đọc rồi truyền vào.
         */
        function togglePlayPause(audioContext) {
            // FIX (log 9->10): 'interrupted' là trạng thái RIÊNG của iOS Safari khi audio bị hệ điều
            // hành "ngắt" lúc tab/app bị ẩn (khác 'suspended' — xem giải thích đầy đủ ở
            // setupAudioContext(), audio-engine.js). Thiếu check này thì audioContext.resume() không
            // được gọi, dù audioPlayer.play() có chạy thì vẫn không nghe được tiếng gì.
            if (audioPlayer.paused) { audioPlayer.play(); if (audioContext && (audioContext.state === 'suspended' || audioContext.state === 'interrupted')) audioContext.resume(); } else { audioPlayer.pause(); }
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
        /** Đồng bộ class/màu nút Shuffle theo ĐÚNG state hiện có — TÁCH từ toggleShuffle() (phần
         * "đồng bộ UI", KHÔNG đụng phần đảo cờ), phản hồi Giang mục 3 ("nhớ trạng thái shuffle/
         * repeat/stats") — cần "set thẳng" UI về giá trị ĐÃ LƯU lúc boot, không thể gọi
         * toggleShuffle() cho việc này vì hàm đó LUÔN đảo ngược giá trị hiện tại. */
        function syncShuffleUI(isShuffleNow) {
            btnShuffle.classList.toggle('!text-sky-400', isShuffleNow);
            btnShuffle.classList.toggle('text-slate-400', !isShuffleNow);
        }

        function toggleShuffle(isShuffleCurrent) {
            const next = !isShuffleCurrent;
            appState.set('isShuffle', next);
            console.log(`writer: "toggleShuffle", page: "isShuffle", content: "${next}"`);
            syncShuffleUI(next);
            return next;
        }

        /**
         * Xoay vòng 3 trạng thái Repeat (tắt -> lặp danh sách -> lặp 1 bài) + đồng bộ class/badge.
         * Ứng với msg.type 'playerControls.repeat.click'.
         */
        /** Đồng bộ class/badge nút Repeat theo ĐÚNG state hiện có — TÁCH từ cycleRepeatMode(),
         * CÙNG LÝ DO syncShuffleUI() ngay trên (phản hồi Giang mục 3). */
        function syncRepeatUI(repeatModeNow) {
            if (repeatModeNow === 0) { btnRepeat.classList.remove('!text-sky-400'); btnRepeat.classList.add('text-slate-400'); repeatBadge.classList.add('hidden'); }
            else if (repeatModeNow === 1) { btnRepeat.classList.remove('text-slate-400'); btnRepeat.classList.add('!text-sky-400'); repeatBadge.classList.add('hidden'); }
            else if (repeatModeNow === 2) { btnRepeat.classList.add('!text-sky-400'); repeatBadge.classList.remove('hidden'); }
        }

        function cycleRepeatMode() {
            appState.set('repeatMode', (appState.get('repeatMode') + 1) % 3);
            syncRepeatUI(appState.get('repeatMode'));
        }

        /**
         * ===================== HOTFIX 11 (08/07/2026) — BỎ HẲN nhánh "mở Settings từ Visualizer" =====================
         * Lịch sử ngắn gọn (chi tiết đầy đủ từng bước xem lịch sử chat/changelog nếu cần tra cứu):
         * batch 07/07/2026 (Nhóm D, "gộp container") thêm khả năng mở Settings NGAY TỪ Visualizer
         * (nút #btn-settings trong Control Center), kéo theo 1 chuỗi hotfix (7/8/9/10) chỉnh lại
         * kiến trúc mở/đóng cho đúng Rule 1-3 (core đơn tuyến, không core-gọi-core, Workflow điều
         * phối). Dù kiến trúc cuối cùng ĐÃ ĐÚNG theo mọi rule, thực tế trên thiết bị thật VẪN không
         * ổn định — Giang quyết định BỎ HẲN nút đó (xem components/visualizer-overlay.js) thay vì
         * tiếp tục vá. Settings giờ CHỈ mở được từ Playlist (#btn-settings-playlist) — 2 hàm
         * "smooth" ngay dưới đây là TOÀN BỘ những gì còn lại của cụm core Settings, không còn
         * nhánh/rẽ nhánh/boolean-trả-về nào nữa. Router (event/router/player-controls.js) gọi
         * THẲNG core cho mở, giao Workflow (event/workflow/player-controls.js::
         * closeSettingsDrawer()) cho đóng — không còn đọc `isVisualizerActive`/VirtualMachineState
         * ở đây nữa.
         */


        // XOÁ (đợt tái cấu trúc bottom nav App Panel, phản hồi Giang) —
        // scrollSideLeftToSettingsSmooth()/scrollSideLeftToPlaylistSmooth() KHÔNG còn ý nghĩa:
        // #side-left-container giờ CHỈ còn 1 "trang" (#playlist-view), Settings đã chuyển hẳn sang
        // core/generic-drawer.js (xem event/workflow/app-settings.js) — không còn gì để "cuộn
        // sang" nữa. Mở/đóng Settings giờ đi qua workflowAppSettings.open()/close() (Router:
        // event/router/player-controls.js, case 'playerControls.settingsDrawer.open'/'.close').


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
         * MỚI (18/07/2026, mục 1 phản hồi Giang — "chưa phát nhạc slideshow đã tự chạy") — báo
         * TRỰC TIẾP cho Slideshow biết nhạc vừa phát, để nó tự hiện lần đầu (nếu đang chờ) hoặc
         * chạy tiếp từ vị trí đã đóng băng (nếu đang pause) — xem workflowMotionEngine.syncPlaybackGate().
         */
        function handleAudioPlay() {
            // MỚI (09/08/2026) — bất kỳ lúc nào audio THẬT SỰ phát lại, trạng thái "hết hẳn
            // playlist" không còn đúng nữa — reset ngay tại đây (nguồn signal DUY NHẤT, không cần
            // rải rác chỗ khác). Rule 2: chỉ `set()`, không đọc. Rule 4: log ngay dưới.
            appState.set('playbackStoppedAtPlaylistEnd', false);
            console.log(`writer: "handleAudioPlay", page: "playbackStoppedAtPlaylistEnd", content: "false"`);
            iconPlay.classList.add('hidden'); iconPause.classList.remove('hidden'); 
            let recordArtDynamic = document.getElementById('record-art'); if(recordArtDynamic) recordArtDynamic.classList.remove('paused');
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
            if (appState.get('currentKey')) refreshSongNode(appState.get('currentKey'));
            startListenClock();
            if (typeof syncAutoSwitchVisualPlayState === 'function') syncAutoSwitchVisualPlayState(); // ver 10: xem auto-switch-visual.js
            // Chỉ ĐỒNG BỘ phát video nền theo nhạc — nguồn đã thiết lập 1 lần lúc bật/chọn nguồn/
            // nạp trang (workflowVisualBg.applyCurrentVisualBg()), nên Next/Prev không nạp lại src.
            // SỬA (v13 Batch A) — `syncVideoBgToAudio()` (core cũ, tự đọc `vizConfig.videoBgEnabled`
            // — vi phạm Rule 2) ĐÃ XOÁ; thay bằng Workflow domain `visualBg` (nó tự đọc
            // `audioPlayer.paused` rồi gọi core thuần `syncVisualBgVideoPlayback(isPaused)`).
            // CÙNG hình dạng lời gọi core->workflow đã có sẵn ở dòng ngay dưới (nợ kỹ thuật di sản
            // của chính hàm này, KHÔNG phát sinh mới — file này không thuộc phạm vi viết lại đợt v13).
            if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.syncPlaybackToAudio();
            if (typeof workflowMotionEngine !== 'undefined') workflowMotionEngine.syncPlaybackGate();
        }

        /**
         * Audio bị dừng (sự kiện 'pause') — ngược lại handleAudioPlay(), cộng thêm
         * releaseWakeLock(). Ứng với msg.type 'playerControls.audio.pause'.
         * MỚI (18/07/2026, mục 1 phản hồi Giang) — báo TRỰC TIẾP cho Slideshow biết nhạc vừa
         * pause, để nó tự tạm dừng + đóng băng Ken Burns TẠI ĐÚNG vị trí hiện tại.
         */
        function handleAudioPause() {
            iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden'); 
            let recordArtDynamic = document.getElementById('record-art'); if(recordArtDynamic) recordArtDynamic.classList.add('paused');
            releaseWakeLock(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            if (appState.get('currentKey')) refreshSongNode(appState.get('currentKey'));
            stopListenClock();
            if (typeof syncAutoSwitchVisualPlayState === 'function') syncAutoSwitchVisualPlayState(); // ver 10: xem auto-switch-visual.js
            if (typeof workflowVisualBg !== 'undefined') workflowVisualBg.syncPlaybackToAudio(); // v13 Batch A — xem handleAudioPlay() ngay trên
            if (typeof workflowMotionEngine !== 'undefined') workflowMotionEngine.syncPlaybackGate();
        }

        // [SỬA — plan-playmedia-reorg.md, xử lý triệt để] `handleAudioEnded()` ĐÃ XOÁ khỏi đây —
        // 2 lời gọi Core nối tiếp (stopListenClock() rồi playNext()) VỐN ĐÃ vi phạm Rule 3 (Core
        // gọi Core, core-legacy-audit.md từng track), đúng bản chất Workflow. Chuyển hẳn thành
        // `workflowPlayerControls.handleSongEnded()` (event/workflow/player-controls.js) — Router
        // (case 'playerControls.audio.ended') gọi thẳng method đó khi gameplayPhase==='idle'.

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
