/**
 * Điều khiển phát nhạc: toggle play/pause của track đã tải, chuyển sang màn hình visualizer, nút
 * shuffle/repeat, Media Session API, thanh tiến trình, sự kiện audio (play/pause/loadedmetadata/
 * error/timeupdate/seeked), bộ đếm thời gian nghe thật.
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
         * HOTFIX 10 (08/07/2026, Giang chỉ ra — "sao cứ nghĩ hàm này BẮT BUỘC phải set state, bỏ
         * dòng đó ra rồi tái dùng") — ĐÃ BỎ `appState.set('isVisualizerActive', false)` VÀ dòng
         * `scrollLeft = 0` (phòng thủ thêm trước đó) khỏi hàm. Hàm giờ THUẦN 1 việc — "trượt cả
         * khối #side-left-container vào + tắt hẳn UI Visualizer (fade-out canvas, gỡ
         * visualizer-active, ẩn sau khi fade xong)" — KHÔNG tự set cờ gì (đúng Rule 1: 1 hàm =
         * 1 việc). Tách riêng `setVisualizerActiveFalse()` (core mới, ngay dưới) — NƠI GỌI PHẢI TỰ
         * THÊM hàm đó nếu muốn state đổi thành `false` (4 nơi hiện tại ĐANG cần:
         * handleBackToPlaylistClick() ngay dưới, clearAllStoredData() storage-manager.js,
         * deleteMediaFromActionMenu()/xoá hàng loạt (event/workflow/playlist.js)
         * — đã cập nhật đủ cả 4).
         *
         * (HOTFIX 11, 08/07/2026 — batch này TỪNG có thêm 1 nơi gọi nữa, tái dùng hàm này cho "mở
         * Settings từ Visualizer" mà CỐ Ý không gọi setVisualizerActiveFalse(); nút đó đã bị BỎ
         * HẲN, xem components/visualizer-overlay.js — không còn liên quan tới hàm này nữa, nhưng
         * việc tách state ra khỏi hàm ở HOTFIX 10 vẫn giữ nguyên vì tự nó đã đúng Rule 1.)
         */
        // SỬA (24/09/2026, dọn nợ "taskManager trong core" + core gọi core/Workflow) — hàm cũ `forceBackToPlaylistUI()`
        // TÁCH: core giờ CHỈ còn phần trượt/đổi class (`slideBackToPlaylistUi()` ngay dưới) + phần ẩn sau khi trượt xong
        // (`hideVisualizerUiAfterFade()`). Điều phối (cuộn Playlist trước, đóng Control Center, hẹn 500ms bằng
        // taskManager rồi ẩn + renderPlaylistDiff) nằm ở event/workflow/player-controls.js::`returnToPlaylistUI()` —
        // MỌI nơi muốn "về Playlist" gọi hàm Workflow đó. Docstring bên trên giữ nguyên làm lịch sử.
        function slideBackToPlaylistUi() {
            // MỚI (phản hồi Giang 29/07/2026, "scroll tức thì trước khi ra vào playlist") — gọi
            // NGAY ĐẦU hàm, lúc `#app-stack` VẪN còn class 'playlist-hidden' (dịch ra ngoài khung
            // nhìn qua transform, KHÔNG phải display:none — scrollIntoView() vẫn hoạt động bình
            // thường) — cuộn xong TRƯỚC dòng gỡ class ngay dưới, nên lúc Playlist TRƯỢT VÀO thấy
            // ĐÃ ở đúng vị trí dòng đang phát từ đầu, không có pha nhảy/cuộn nào lộ ra mắt.
            // DỜI (24/09/2026) — `scrollToCurrentKeyInstant()` (core gọi core) ra Workflow `returnToPlaylistUI()`, vẫn
            // chạy TRƯỚC hàm này (đúng lý do cũ: cuộn xong lúc Playlist còn nằm ngoài khung nhìn).
            // SỬA (05/10/2026, Giang báo "bấm về Playlist thì icon Control Center/thông số nhạc/nút về Playlist ẩn luôn dù
            // lớp dưới chưa ẩn, Playlist chưa che kín") — BỎ dòng `visualizerUI.classList.remove('fade-enter-active')`:
            // gỡ class đó làm #visualizer-ui rơi về `.fade-enter { opacity:0 }` NGAY (transition opacity của
            // `.fade-enter-active` bị `#visualizer-ui { transition: transform … }` ở layout-nav.css — selector ID — ghi đè
            // hẳn, nên không có fade). Giờ UI trượt ra bằng transform cùng nhịp thanh player dưới; tới mốc 500ms ẩn cùng
            // #visualizer-stage (lớp cha, xem components/app-mount.js) + `hideVisualizerUiAfterFade()`. Chặn chạm trong lúc trượt:
            // `setVisualizerUiInert()` (Workflow gọi).
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
            // DỜI (24/09/2026) — closeControlCenter() (core gọi core) + `taskManager.once(..., 500)` (taskManager cấm trong
            // core) + renderPlaylistDiff() (core gọi Workflow) ra event/workflow/player-controls.js::returnToPlaylistUI().
        }

        /** MỚI (24/09/2026) — tách từ callback taskManager cũ của `forceBackToPlaylistUI()`: ẩn hẳn UI Visualizer SAU khi
         * slide ngang chạy xong (Workflow `returnToPlaylistUI()` tự hẹn giờ rồi gọi). Core lá, chỉ đổi class. */
        function hideVisualizerUiAfterFade() {
            visualizerUI.classList.add('hidden');
            playerContainer.classList.add('hidden');
        }

        /**
         * MỚI (08/07/2026, HOTFIX 10) — tách RIÊNG khỏi `forceBackToPlaylistUI()` (xem docstring
         * đầy đủ ở đó) để hàm đó tái dùng được cho cả trường hợp KHÔNG muốn đổi state (mở Settings
         * từ Visualizer). Nơi gọi `forceBackToPlaylistUI()` mà THẬT SỰ muốn rời Visualizer (không
         * phải mở Settings) phải tự gọi thêm hàm này — xem danh sách nơi gọi ở docstring
         * `forceBackToPlaylistUI()`.
         */
        // ===== MỚI (05/10/2026, Giang chốt hướng sửa "về Playlist rồi vào lại thì giật toàn bộ video/motion/visual") =====
        // 3 nhóm hàm LÁ dưới đây chỉ thao tác DOM/đọc trạng thái phần tử nhận vào — điều phối (khi nào gọi, chờ ra sao,
        // huỷ lượt chờ cũ) nằm ở event/workflow/player-controls.js. CSS đi kèm: assets/css/layout-nav.css (khối
        // "playlist-offstage" / "visual-stage-offstage", CHỈ có hiệu lực <1024px — desktop 2 cột hiện song song).

        /** Media query của bố cục xếp chồng — khớp breakpoint 1024px ở assets/css/layout-nav.css. Dùng chung cho
         * isStackedScreenLayout() và listener đổi bố cục (event/listener/player-controls.js, MỚI 05/10/2026). */
        const STACKED_SCREEN_LAYOUT_QUERY = '(max-width: 1023px)';

        /** Bố cục xếp chồng (<1024px): Playlist và Visualizer trượt đè nhau — CHỈ bố cục này mới ẩn được 1 bên.
         * Desktop (>=1024px) 2 cột hiện song song vĩnh viễn (layout-nav.css). @returns {boolean} */
        function isStackedScreenLayout() {
            return window.matchMedia(STACKED_SCREEN_LAYOUT_QUERY).matches;
        }

        /** MỚI (05/10/2026) — chặn/mở mọi tương tác trong #visualizer-ui (nút, cử chỉ, Control Center) bằng thuộc tính
         * `inert`. Bật lúc UI đang trượt ra về Playlist (bấm lại nút về Playlist/mở Control Center giữa chừng không còn
         * lọt); `showVisualizerUi()` tự tắt khi vào lại. @param {boolean} isInert */
        function setVisualizerUiInert(isInert) {
            visualizerUI.inert = isInert;
        }

        /** Đưa Playlist ra khỏi cây render (`display:none` cho #side-left-container qua class trên #app-stack) hoặc trả
         * lại. Gọi SAU khi Playlist trượt ra xong / TRƯỚC khi cuộn tới bài đang phát lúc quay về.
         * @param {boolean} isOffstage */
        function setPlaylistOffstage(isOffstage) {
            appStack.classList.toggle('playlist-offstage', isOffstage);
        }

        /** Đưa lớp cha sân khấu hình Visualizer (`#visualizer-stage`, index.html — video/ảnh nền, lớp Motion, 2 canvas
         * effect) ra khỏi cây render hoặc trả lại. Media vẫn phát tiếng (chỉ ẩn hình). @param {boolean} isOffstage */
        function setVisualStageOffstage(isOffstage) {
            document.getElementById('visualizer-stage').classList.toggle('visualizer-stage-offstage', isOffstage);
        }

        /** Video nền đang thật sự hiển thị (VBG-Video của Song: `#bg-video` gỡ 'hidden' + có nguồn). @returns {boolean} */
        function isBgVideoShown() {
            return !bgVideoElement.classList.contains('hidden') && !!bgVideoElement.currentSrc;
        }

        /** Chờ 1 phần tử media đủ dữ liệu phát liền mạch (readyState HAVE_ENOUGH_DATA = 'canplaythrough'). Lỗi/huỷ
         * nạp/đổi nguồn cũng kết thúc lượt chờ (không treo) — trả về lý do để nơi gọi ghi log.
         * @param {HTMLMediaElement} el @returns {Promise<string>} 'ready' | 'canplaythrough' | 'error' | 'abort' | 'emptied' */
        function waitMediaCanPlayThrough(el) {
            if (el.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return Promise.resolve('ready');
            return new Promise((resolve) => {
                const EVENTS = ['canplaythrough', 'error', 'abort', 'emptied'];
                const onDone = (e) => {
                    EVENTS.forEach((type) => el.removeEventListener(type, onDone));
                    resolve(e.type);
                };
                EVENTS.forEach((type) => el.addEventListener(type, onDone));
            });
        }

        /** URL ảnh (blob:/http:) đang làm nền HIỂN THỊ trên sân khấu: `#visual-bg-image` (VBG-Photo tĩnh / Photo Player
         * mode / lớp dự phòng của Video) + 2 lớp ảnh Motion (VBG-Photo) nếu container đang hiện. @returns {string[]} */
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

        /** Chờ 1 ảnh giải mã xong (cùng URL -> lấy lại từ bộ nhớ đệm của trình duyệt). Lỗi cũng kết thúc lượt chờ.
         * @param {string} url @returns {Promise<string>} 'decoded' | 'error' */
        function waitImageUrlDecoded(url) {
            const img = new Image();
            img.src = url;
            return img.decode().then(() => 'decoded', () => 'error');
        }

        function setVisualizerActiveFalse() {
            appState.set('isVisualizerActive', false);
            console.log(`writer: "setVisualizerActiveFalse", page: "isVisualizerActive", content: "false"`);
        }

        // DỜI (02/10/2026, xử lý nợ ghi ở readme/core-legacy-audit.md mục 02/10/2026) — `switchToVisualizer()` (core tự gọi
        // core scrollToCurrentKeyInstant() + tự dùng taskManager + tự đọc appConfigViz — Rule 2/3) tách thành 3 hàm lá dưới;
        // điều phối (cuộn Playlist tới bài đang phát, hẹn 50ms fade-in) sang workflowPlayerControls.switchToVisualizer()
        // (event/workflow/player-controls.js). Thứ tự & nội dung từng bước GIỮ NGUYÊN. Lịch sử: HOTFIX 12 (08/07/2026) đã
        // xoá dòng `sideLeftContainer.scrollLeft = 0` — xem changelog; KHÔNG gọi handleVideoBackground() ở đây (chuyển màn
        // KHÔNG điều khiển video, video chỉ bám theo nhạc).

        /** Bước 1 — bắt đầu trượt Playlist ra (class 'playlist-hidden' trên #app-stack, FIX 04/07/2026 dọc -> ngang). */
        function slidePlaylistOut() {
            appStack.classList.add('playlist-hidden');
        }

        /** Bước 2 — đánh dấu đang ở Visualizer + hiện UI Visualizer (slide ngang chạy đồng thời với Playlist thoát). */
        function showVisualizerUi() {
            appState.set('isVisualizerActive', true); // MỚI (07/07/2026, phản hồi Giang mục 1)
            console.log(`writer: "showVisualizerUi", page: "isVisualizerActive", content: "true"`); // MỚI (02/10/2026) — Rule 4 vốn thiếu
            visualizerUI.classList.remove('hidden'); playerContainer.classList.remove('hidden');
            visualizerUI.classList.add('visualizer-active'); playerContainer.classList.add('visualizer-active');
            // SỬA (05/10/2026) — UI (nút/thông số) hiện NGAY cùng lúc trượt vào, không đợi media nạp đủ như effect.
            // Trước đây `fade-enter-active` gắn ở `revealVisualizerCanvas()` (sau khi media nạp đủ) nên nút hiện trễ.
            visualizerUI.classList.add('fade-enter-active');
            visualizerUI.inert = false;
        }

        /** Bước 3 (sau 50ms) — fade-in canvas. `vizType` do Workflow đọc từ appConfigViz truyền vào.
         * @param {string} vizType */
        function revealVisualizerCanvas(vizType) {
            canvas.classList.remove('opacity-0'); // SỬA (05/10/2026) — `fade-enter-active` của #visualizer-ui dời sang showVisualizerUi()
                // FIX (Giang báo — "Vortex mất render mỗi lần ra/vào Playlist") — thiếu check
                // 'vortex' ở đây từng gây bug tương tự khi còn group "space" dùng chung
                // #webgl-canvas (xem core/visualizer/visualizer-display.js::updateTypeUI()).
                // Quay lại Playlist (forceBackToPlaylistUI()) luôn ADD opacity-0 vô điều kiện, nên
                // ở Vortex, canvas kẹt vô hình dù JS vẫn tính/vẽ bình thường phía sau — chỉ "tự
                // khỏi" khi có hành động khác gọi updateTypeUI() (không phân biệt type) như đổi bài.
                // SỬA (bug Giang báo — "connector synapse: ban đầu ở video mode -> phát video ->
                // không hiện -> phải Next/Prev mới hiện lại") — 'connector' CŨNG dùng chung
                // #webgl-canvas nhưng bị thiếu ở check này (chỉ có 'vortex'). Video Player mode gọi
                // updateTypeUI() (trong beforePlay của swapBgVideoSource()) TRƯỚC switchToVisualizer()
                // (sau waitBgVideoReady()) — lúc đó #app-stack CHƯA có 'playlist-hidden' nên nhánh
                // connector của updateTypeUI() không gỡ opacity-0; canvas kẹt vô hình tới khi Next/
                // Prev (đã ở Visualizer sẵn -> updateTypeUI() thấy 'playlist-hidden' -> gỡ). Nhánh Song
                // không dính vì player.js gọi switchToVisualizer() TRƯỚC updateTypeUI().
            if (vizType !== 'vortex' && vizType !== 'connector') return; // guard — chỉ 2 type này dùng chung #webgl-canvas
            document.getElementById('webgl-canvas').classList.remove('opacity-0');
        }

        /**
         * MỚI (02/09/2026, Giang yêu cầu "game mode chặn luôn toàn bộ thao tác ở player control
         * bottom") — CSS `pointer-events` thuần (Giang chốt "css hay js cũng được, cái nào đơn giản
         * thì làm" — đây là cách ít code nhất, KHÔNG cần disable từng nút/progress-bar riêng lẻ).
         *
         * LÝ DO CẦN — KHÔNG chỉ "phòng hờ": `#player-container` (z-40, position:fixed) và
         * `#gameplay-layer` (z-[65]) TƯỞNG như gameplay-layer luôn nổi trên do z-index cao hơn,
         * nhưng z-65 đó CHỈ LÀ z-index NỘI BỘ trong stacking context riêng của `#visualizer-ui`
         * (chính #visualizer-ui lại chỉ z-30 — xem comment forceBackToPlaylistUI() phía trên) —
         * #player-container đứng NGANG HÀNG #visualizer-ui (không lồng trong nhau), nên stacking
         * thật sự so z-30 (#visualizer-ui) với z-40 (#player-container): thanh điều khiển phát nhạc
         * VẪN nổi trên toàn bộ overlay Game Mode kể cả full-screen tap-surface bên trong — bấm được
         * Prev/Play-Pause/Next/kéo progress-bar ngay giữa lúc đang chơi, phá timing wave. Sửa TẬN
         * GỐC stacking context là việc lớn hơn nhiều (đụng cấu trúc DOM nhiều file) — chặn tương tác
         * bằng `pointer-events: none` giải quyết ĐÚNG vấn đề Giang nêu (chặn thao tác) mà không cần
         * động tới cấu trúc z-index hiện có.
         *
         * @param {boolean} blocked - true: gắn `pointer-events: none` (CSS, assets/css/gameplay.css)
         *   lên #player-container. false: gỡ lại. */
        function setPlayerControlsBlocked(blocked) {
            playerContainer.classList.toggle('gameplay-controls-blocked', blocked);
        }

        // DỜI (24/09/2026) — `handleBackToPlaylistClick()` (core gọi 2 core) sang event/workflow/player-controls.js::
        // `workflowPlayerControls.handleBackToPlaylistClick()`.

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

        /** Áp tốc độ phát lên media element đang active — Song/Video Player có `playbackRate` thật,
         * Photo bỏ qua (không có khái niệm này, nút mở HUD Speed cũng ẩn ở mode đó). Gọi lúc chọn
         * tốc độ mới (event/workflow/hud.js) VÀ mỗi lần bài/video mới sẵn sàng phát (loadedmetadata)
         * để tốc độ đã lưu áp lại đúng cho nội dung mới. Core thuần (Rule 2).
         *
         * Set tường minh `preservesPitch=true` (giữ nguyên cao độ, mặc định trình duyệt hiện đại —
         * Baseline 2023 — nhưng vẫn set tay để chắc chắn trên WebView cũ/thiết bị không rõ) mỗi lần
         * set `playbackRate`, kèm 2 fallback tiền tố cũ (`mozPreservesPitch`/`webkitPreservesPitch`)
         * cho engine chưa hỗ trợ tên chuẩn — không có tên nào tồn tại thì gán vào cũng vô hại
         * (thuộc tính lạ, trình duyệt bỏ qua).
         * @param {boolean} isVideoPlayerMode @param {boolean} isPhotoPlayerMode @param {number} speed */
        function applyPlaybackSpeedToActiveMedia(isVideoPlayerMode, isPhotoPlayerMode, speed) {
            if (isPhotoPlayerMode) return;
            const el = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode);
            el.playbackRate = speed;
            el.preservesPitch = true; el.mozPreservesPitch = true; el.webkitPreservesPitch = true;
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
        /** SỬA (05/09/2026, yêu cầu Giang "bỏ đánh dấu 1 đi, dùng icon repeat nhưng có số 1 ở
         * giữa") — trước đây bật/tắt `repeatBadge` (span góc riêng NGOÀI icon, `#repeat-badge`) —
         * giờ bật/tắt `repeatOneDigit` (`#repeat-one-digit`, phần tử `<text>` NẰM TRONG chính SVG
         * icon repeat, components/visualizer-overlay.js) — cùng cơ chế ẩn/hiện qua class `hidden`,
         * chỉ đổi phần tử đích. */
        function syncRepeatUI(repeatModeNow) {
            if (repeatModeNow === 0) { btnRepeat.classList.remove('!text-sky-400'); btnRepeat.classList.add('text-slate-400'); repeatOneDigit.classList.add('hidden'); }
            else if (repeatModeNow === 1) { btnRepeat.classList.remove('text-slate-400'); btnRepeat.classList.add('!text-sky-400'); repeatOneDigit.classList.add('hidden'); }
            else if (repeatModeNow === 2) { btnRepeat.classList.add('!text-sky-400'); repeatOneDigit.classList.remove('hidden'); }
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


        // SỬA (25/09/2026, Giang yêu cầu) — nexttrack/previoustrack ĐÃ MỞ LẠI (thông báo/màn hình khoá/tai nghe), đăng ký
        // ở event/listener/player-controls.js, gửi đúng message nút Next/Prev. Phần ghi chú Ver 8 dưới đây chỉ còn đúng cho
        // các hành động KHÁC (seek...).
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

        // DỜI (06/10/2026, plan-media-db-split.md mục 6) — đồng hồ nghe (LISTEN_CLOCK_TASK/_listenTick/startListenClock/
        // stopListenClock — core tự appState.get + đọc DB, vi phạm Rule 2/3b) sang event/workflow/listen-stats.js
        // (`workflowListenStats.startClock()/stopClock()/_tick()`), logic giữ nguyên, cộng giờ theo ĐÚNG loại media đang phát.

        /**
         * Audio bắt đầu phát (sự kiện 'play' của audioPlayer) — cập nhật icon, record-art quay,
         * Media Session, refresh node danh sách, bắt đầu đếm thời gian nghe, đồng bộ auto-switch +
         * video nền. Ứng với msg.type 'playerControls.audio.play'.
         * MỚI (18/07/2026, mục 1 phản hồi Giang — "chưa phát nhạc slideshow đã tự chạy") — báo
         * TRỰC TIẾP cho Visual Background biết nhạc vừa phát, để nó tự hiện lần đầu (nếu đang chờ)
         * hoặc chạy tiếp từ vị trí đã đóng băng (nếu đang pause) — xem
         * workflowVisualBg.syncPlaybackToAudio() (SỬA 29/08/2026 — Motion Engine không còn tự nghe
         * play/pause nữa, VBG tự gọi pause()/resume() của nó BÊN TRONG hàm này, xem docstring đó).
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
            // DỜI (24/09/2026) — `workflowPlaylistRender.refreshSongNode(currentKey)` ra
            // event/workflow/player-controls.js::handleAudioPlayEvent() (core gọi Workflow + tự đọc appState).
            // DỜI (06/10/2026) — `startListenClock()` (core gọi core) ra event/workflow/player-controls.js::handleAudioPlayEvent()
            // (`workflowListenStats.startClock()`), ngay sau lời gọi hàm này.
            // DỜI (25/09/2026) — đồng bộ auto-switch-visual (`syncAutoSwitchVisualPlayState()`, nay là
            // `workflowAutoSwitchVisual.syncPlayState()`) ra event/workflow/player-controls.js::handleAudioPlayEvent().
            // DỜI (24/09/2026) — đồng bộ video nền theo nhạc (`workflowVisualBg.syncPlaybackToAudio()`, core gọi
            // Workflow) ra event/workflow/player-controls.js::handleAudioPlayEvent().
        }

        /**
         * Audio bị dừng (sự kiện 'pause') — ngược lại handleAudioPlay(), cộng thêm
         * releaseWakeLock(). Ứng với msg.type 'playerControls.audio.pause'.
         * MỚI (18/07/2026, mục 1 phản hồi Giang) — báo TRỰC TIẾP cho Visual Background biết nhạc
         * vừa pause, để nó tự tạm dừng + đóng băng Ken Burns TẠI ĐÚNG vị trí hiện tại (qua
         * workflowVisualBg.syncPlaybackToAudio(), SỬA 29/08/2026 — cùng lý do handleAudioPlay() trên).
         */
        function handleAudioPause() {
            iconPlay.classList.remove('hidden'); iconPause.classList.add('hidden'); 
            let recordArtDynamic = document.getElementById('record-art'); if(recordArtDynamic) recordArtDynamic.classList.add('paused');
            // DỜI (06/10/2026, dọn nợ Rule 3a) — `releaseWakeLock()` (core gọi core) ra event/workflow/player-controls.js::
            // handleAudioPauseEvent(), ngay sau lời gọi hàm này.
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
            // DỜI (24/09/2026) — refreshSongNode + workflowVisualBg.syncPlaybackToAudio() ra
            // event/workflow/player-controls.js::handleAudioPauseEvent() (cùng lý do handleAudioPlay() ngay trên).
            // DỜI (06/10/2026) — `stopListenClock()` ra event/workflow/player-controls.js::handleAudioPauseEvent()
            // (`workflowListenStats.stopClock()`), ngay sau lời gọi hàm này.
            // DỜI (25/09/2026) — auto-switch-visual ra event/workflow/player-controls.js::handleAudioPauseEvent().
        }

        /**
         * MỚI (29/09/2026, Giang chọn "xả hàng đợi lúc pause") — 'pause' vừa tới có phải lần DỪNG THẬT của đúng bài Song
         * đang nạp (sẽ resume lại chính bài này) không, để Workflow xả hàng đợi tiếng iOS ngay (nạp lại + seek về chỗ dừng).
         * Loại trừ: media vẫn đang phát (đã play lại trước khi sự kiện tới), hết bài ('pause' đi trước 'ended' — nạp lại lúc
         * này sẽ xoá luôn sự kiện 'ended' đang chờ, hỏng Next/lặp bài), đang ở Video/Photo Player mode hoặc đã bỏ bài
         * (currentKey null), nguồn đã đổi/thu hồi (đổi bài: playMedia() thu hồi blob URL + pause trước khi gán src mới).
         * Thuần — mọi giá trị do Workflow đọc sẵn. @returns {boolean}
         */
        function shouldFlushSongQueueOnPause({ isPaused, isEnded, isVideoPlayerMode, isPhotoPlayerMode, currentKey, currentObjectURL, mediaSrc }) {
            return isPaused && !isEnded && !isVideoPlayerMode && !isPhotoPlayerMode && currentKey !== null && !!currentObjectURL && mediaSrc === currentObjectURL;
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
            applyPlaybackSpeedToActiveMedia(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode'), appConfigViz.getAll().playbackSpeed);
            // DỜI (25/09/2026) — build lại marks auto-switch-visual khi bài MỚI có duration (`onAutoSwitchVisualSongChanged()`,
            // nay là `workflowAutoSwitchVisual.onSongChanged()`) ra event/workflow/player-controls.js::handleAudioLoadedMetadataEvent().
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
         * tiến trình (nếu không đang kéo tay), hiển thị thời gian hiện tại, đồng bộ Media Session mỗi 5s.
         * Phụ đề: workflowPlayerControls.handleAudioTimeUpdateEvent() gọi workflowSubtitleDisplay.sync() sau hàm này.
         */
        function handleAudioTimeUpdate() {
            // SỬA (07/10/2026) — nhãn giờ cũng KHÔNG cập nhật lúc đang kéo (trước đây vẫn ghi đè): kéo tay thì 'input' liên tục ghi
            // lại nên không thấy, nhưng cử chỉ seek-hold ("ngón tay ảo") chỉ gửi 'seeking' mỗi Time 2 -> nhãn nhảy qua lại giữa giờ
            // đang phát và mốc tua. Cùng cách Video (workflowVideoPlayer.handleVideoTimeUpdate()).
            if (!appState.get('isSeeking')) { progressBar.value = audioPlayer.currentTime; updateProgressBarCSS(); currentTimeDisplay.textContent = formatTime(audioPlayer.currentTime); }
            if (Date.now() - lastPositionSync > 5000) { updateMediaPositionState(); lastPositionSync = Date.now(); }
            // (Thống kê thời lượng nghe KHÔNG còn tính ở đây — xem "Bộ đếm thời gian nghe thật"
            //  phía trên: đo bằng đồng hồ thực, độc lập với currentTime/thanh tiến trình.)
        }

        /**
         * Người dùng ĐANG kéo tay thanh tiến trình (sự kiện 'input' trên progressBar, bắn liên tục
         * khi kéo) — đặt cờ isSeeking để handleAudioTimeUpdate() không đè giá trị, hiển thị tạm
         * thời gian theo VỊ TRÍ ĐANG KÉO (chưa commit). Phụ đề theo vị trí kéo: workflowPlayerControls.handleSongSeeking().
         * @param {number} value - progressBar.value tại thời điểm kéo
         */
        /** MỚI (07/10/2026) — đặt thumb thanh tiến trình tới `value` khi KHÔNG có ngón tay thật trên thanh (cử chỉ seek-hold —
         * "ngón tay ảo", event/workflow/visualizer-gesture.js). Kéo tay thật thì trình duyệt tự đặt. Màu phần đã chạy do handler
         * 'seeking' (updateProgressBarCSS) vẽ lại ngay sau. @param {number} value */
        function setProgressBarValue(value) {
            progressBar.value = value;
        }

        function handleProgressBarSeeking(value) {
            appState.set('isSeeking', true); currentTimeDisplay.textContent = formatTime(value); updateProgressBarCSS();
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
