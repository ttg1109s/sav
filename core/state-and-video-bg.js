/**
 * State playlist/subtitle bổ sung + xử lý video nền (handleVideoBackground và các hàm liên quan).
 *
 * ÁP DỤNG /event/ (cụm "visualizerControlCenter"): `addEventListener` cũ của btnReturnVisual/
 * btnOpenControlCenter/controlCenterOverlay/visualizerControlCenter/videoEnableToggle/
 * visualEnabledToggle đã CHUYỂN sang event/listener/visualizer-control-center.js (`videoUploadInput`
 * — XOÁ HẲN 21/07/2026, dọn dẹp sau Batch 2 module Video, xem event/workflow/file-manager-video.js).
 * 2 nhánh cần shield/modal (đổi videoEnableToggle, upload video) đặt ở
 * event/workflow/visualizer-control-center.js — core không biết withLoadingShield/alertModal tồn
 * tại.
 *
 * XOÁ (29/07/2026, yêu cầu Giang mục 4 — "xoá bỏ logic fade in out của bg video") — bỏ hẳn cơ chế
 * fade-in/fade-out cũ của Video nền (opacity 0->1 chờ 'loadeddata'/'playing' của `bgVideoElement` +
 * CSS `transition: opacity 0.5s` + độ trễ 500ms trước khi ẩn hẳn) — `setupVideoBgSource()`/
 * `handleVideoBackground()` giờ hiện/ẩn Video nền TỨC THÌ, không còn animation/listener nội bộ nào
 * cho việc này nữa.
 *
 * MỚI (batch 03/07/2026, hạ tầng z-index nền Visual) — thêm `applyVisualBgImageToDOM()` cuối file:
 * nền tĩnh (ảnh) cho màn Visualizer, tham chiếu qua `imageKey` vào store `images` (Batch 3). CẢ 4
 * lớp nền (màu/ảnh/slideshow-chưa-code/video) ĐỀU BẬT SONG SONG được, xếp lớp thuần qua CSS
 * z-index — xem comment riêng ngay trước hàm đó để biết đầy đủ thứ tự + lưu ý hiệu năng slideshow.
 */

        // subtitles, isSubtitlesEnabled, activeSubIds, editingSubId, currentCalculatedBpm,
        // isShuffle, shuffleIndices, repeatMode, lastValidNoteStr, lastValidNoteTime,
        // lastValidMidiNote — STATE, xem service/state.js. isSubtitlesEnabled giá trị khởi tạo
        // `true` chỉ là tạm — được ĐỒNG BỘ LẠI từ vizConfig.subtitlesEnabled (đã lưu) ngay trong
        // loadConfig() (ver 8 refine, xem equalizer-settings.js), nên giá trị thật sau khi trang
        // nạp xong luôn khớp với Cài đặt. 3 key lastValid* MỚI MIGRATE (trước đây gán trực tiếp
        // `window.x = null/0` ngay tại dòng này — dòng đó đã XOÁ vì thừa: STATE đã tự khởi tạo
        // đúng giá trị mặc định qua buildDefaultState(), service/state.js).
        //
        // window.currentMediaSessionCover ĐÃ XOÁ HẲN (không migrate) — kiểm tra lại thấy đây là
        // biến MỒ CÔI: chỉ bị reset về null + revoke phòng hờ ở app-cleanup.js, KHÔNG có bất kỳ
        // nơi nào trong project thực sự gán giá trị khác null cho nó. navigator.mediaSession.metadata
        // (2 chỗ ở playlist/actions.js) dùng thẳng currentCoverObjectURL cho artwork, không đụng
        // biến này — rõ ràng là sót lại từ 1 đợt refactor cũ (từng tách cover riêng cho MediaSession,
        // sau gộp lại dùng chung currentCoverObjectURL nhưng quên xoá biến cũ). Xoá hẳn thay vì giữ
        // 1 state key vĩnh viễn null không ai đọc/ghi thật.

        /** Core thuần: quay về màn Visualizer (nếu đang có bài hiện tại). */
        function returnToVisualizer() {
            if (appState.get('currentKey')) switchToVisualizer();
        }

        // ===================== "Control Center" của màn Visualizer (ver 8 refine) =====================
        // 1 nút mở ở góc trái, panel grid icon PHÓNG RA TỪ TRUNG TÂM (scale từ vị trí nút bấm).
        // Đóng bằng 3 cách: bấm lại nút mở, bấm overlay mờ phía dưới panel, hoặc bấm 1 icon bên
        // trong grid (data-cc-action — tự đóng sau khi chọn).
        function openControlCenter() {
            visualizerControlCenter.classList.remove('scale-0', 'opacity-0');
            controlCenterOverlay.classList.remove('hidden');
            iconControlCenterDown.classList.add('rotate-180');
        }
        function closeControlCenter() {
            visualizerControlCenter.classList.add('scale-0', 'opacity-0');
            controlCenterOverlay.classList.add('hidden');
            iconControlCenterDown.classList.remove('rotate-180');
        }
        /** Core thuần: toggle mở/đóng Control Center theo trạng thái hiện tại. */
        function toggleControlCenter() {
            const isOpen = !visualizerControlCenter.classList.contains('scale-0');
            if (isOpen) closeControlCenter(); else openControlCenter();
        }
        /** Core thuần: bấm icon trong grid (data-cc-action) -> đóng panel ngay, không đợi animation. */
        function handleControlCenterGridClick(target) {
            if (target.closest('[data-cc-action]')) closeControlCenter();
        }

        // Khi đóng drawer Cài đặt: nếu người dùng đã bật "Sử dụng Video Background" nhưng CHƯA
        // chọn video nào (vizConfig.videoBgUrl rỗng) thì tự tắt lại — tránh trạng thái "on" ảo
        // không có video thật phía sau. "Tắt Visual" (ver 8 refine) KHÔNG còn phụ thuộc video bg
        // nên không tắt theo nữa.
        function validateVideoBgOnClose() {
            const cfg = appConfigViz.getAll();
            if (cfg.videoBgEnabled && !cfg.videoBgUrl) {
                appConfigViz.mutateAll(c => { c.videoBgEnabled = false; });
                videoEnableToggle.checked = false;
                handleVideoBackground(); saveConfig();
            }
        }

        /**
         * Chỉ lo NGUỒN video — thiết lập MỘT LẦN cho mỗi URL. Gọi khi cấu hình video đổi (bật/tắt,
         * upload, nạp lại lúc mở trang) — KHÔNG gọi mỗi lần chuyển bài.
         * XOÁ (29/07/2026, yêu cầu Giang mục 4 — "xoá bỏ logic fade in out của bg video") — bỏ hẳn
         * cơ chế fade-in cũ (opacity giữ 0 cho tới khi bắt được sự kiện 'loadeddata'/'playing' của
         * chính `bgVideoElement` rồi mới nhảy lên 1) — video nền giờ hiện NGAY khi gán `src`, không
         * còn khoảng đen chờ khung hình đầu tiên/không còn 2 listener nội bộ tự gỡ sau 1 lần nữa.
         * SỬA (30/07/2026, yêu cầu Giang — "đồng nhất hidden/opacity") — bỏ hẳn dòng
         * `bgVideoElement.style.opacity = '1'` từng nằm ở ĐÂY: hàm này CHỈ còn 1 caller DUY NHẤT
         * (`handleVideoBackground()` nhánh bật, ngay dưới) — dồn opacity LÊN ĐÓ, đứng CÙNG CHỖ với
         * `classList.remove('hidden')`, khớp đúng cách `setBgVideoElementForPlayerMode()` (core/
         * video-player.js) đang làm cho Video Player mode — hidden+opacity LUÔN xử lý CÙNG NHAU tại
         * 1 điểm bật/tắt DUY NHẤT, không tách rời 2 nơi nữa.
         */
        function setupVideoBgSource() {
            const videoBgUrl = appConfigViz.getAll().videoBgUrl;
            // Đã đúng URL và đã gán rồi -> không làm gì (tránh gán lại src thừa mỗi lần Next/Prev).
            if (bgVideoElement.getAttribute('src') === videoBgUrl && appState.get('_videoBgLoadedUrl') === videoBgUrl) return;
            bgVideoElement.src = videoBgUrl;
            appState.set('_videoBgLoadedUrl', videoBgUrl);
        }

        /**
         * CHỈ đồng bộ play/pause của video theo nhạc — KHÔNG đụng src/opacity/fade.
         * Đây là hàm được gọi mỗi lần nhạc play/pause hoặc Next/Prev, nên KHÔNG được
         * gây ra cú "nền đen rồi fade video" lần nữa.
         */
        function syncVideoBgToAudio() {
            const cfg = appConfigViz.getAll();
            if (!(cfg.videoBgEnabled && cfg.videoBgUrl)) return;
            if (!audioPlayer.paused) { bgVideoElement.play().catch(() => {}); } else { bgVideoElement.pause(); }
        }

        function handleVideoBackground() {
            // QUY TẮC v6 (đã sửa):
            //  - Video nền BẬT/TẮT chỉ phụ thuộc cấu hình + trạng thái NHẠC, KHÔNG phụ thuộc đang ở
            //    màn Playlist hay Visualizer.
            //  - NGUỒN chỉ thiết lập MỘT LẦN cho mỗi URL (setupVideoBgSource). Next/Prev chỉ
            //    gọi syncVideoBgToAudio() (xem player-controls.js) nên KHÔNG gán lại src nữa.
            //  - Nền đen cưỡng chế phía sau video.
            // XOÁ (30/07/2026, yêu cầu Giang — "bỏ hẳn opacity") — opacity BỊ XOÁ HOÀN TOÀN khỏi
            // bgVideoElement (CẢ 2 nhánh dưới đây, LẪN setBgVideoElementForPlayerMode() bên Video
            // Player mode, core/video-player.js) — `.hidden` (display:none) ĐÃ TỰ ĐỦ để hiện/ẩn,
            // opacity chỉ là dư thừa (display:none khiến opacity vô nghĩa hoàn toàn khi ẩn, và lúc
            // hiện luôn set '1' ngay cạnh hidden nên chưa từng có tác dụng thật riêng biệt nào).
            // CSS `#bg-video` cũng bỏ `opacity: 0` mặc định (assets/css/style.css) — thêm `class=
            // "hidden"` NGAY TỪ HTML (index.html) làm trạng thái ẩn mặc định thay thế.
            const cfg = appConfigViz.getAll();
            if (cfg.videoBgEnabled && cfg.videoBgUrl) {
                visualizerSolidBg.style.backgroundColor = '#000000'; // FIX (04/07/2026, mục 1a) — nền đen cưỡng chế sau video, đổi target khỏi document.body
                bgVideoElement.classList.remove('hidden');
                setupVideoBgSource(); // nạp nguồn nếu là URL mới; no-op nếu đã sẵn sàng
                syncVideoBgToAudio();
            } else {
                bgVideoElement.pause();
                bgVideoElement.classList.add('hidden');
                bgVideoElement.removeAttribute('src');
                bgVideoElement.src = '';
                appState.set('_videoBgLoadedUrl', null);
                updateDOMBackground();
            }
        }

        /** Core thuần: thực thi BẬT video nền (đã biết chắc videoBgUrl đã có sẵn từ trước). */
        function enableVideoBackground() {
            appConfigViz.mutateAll(cfg => { cfg.videoBgEnabled = true; });
            handleVideoBackground(); saveConfig();
        }

        /** Core thuần: thực thi TẮT video nền — CHỈ dọn object URL runtime + đồng bộ state/UI.
         *  FIX (04/07/2026, mục 1 phản hồi Giang — ĐẢO NGƯỢC quyết định trước, xem lịch sử patch):
         *  KHÔNG còn xoá `meta.videoBg` trong IndexedDB nữa — Blob GIỮ NGUYÊN để lần "gạt On" kế
         *  tiếp kích hoạt lại NGAY qua `applyUploadedVideoBg()` (đọc lại chính blob này) mà KHÔNG
         *  cần mở lại hộp thoại chọn file. */
        function disableVideoBackgroundState() {
            appConfigViz.mutateAll(cfg => {
                cfg.videoBgEnabled = false;
                if (cfg.videoBgUrl && cfg.videoBgUrl.startsWith('blob:')) URL.revokeObjectURL(cfg.videoBgUrl);
                cfg.videoBgUrl = '';
            });
            handleVideoBackground(); saveConfig();
        }

        /** Core thuần: ứng với toggle "Tắt Visual" — độc lập hoàn toàn khỏi video nền. */
        function setVisualEnabled(checked) {
            appConfigViz.mutateAll(cfg => { cfg.visualEnabled = checked; });
            saveConfig();
        }

        /** Core thuần: lưu blob video mới vào IndexedDB + áp dụng làm video nền hiện tại (phần
         *  KHÔNG cần shield — shield bọc quanh lệnh setMeta() ở workflow). Trả {status} rõ ràng,
         *  KHÔNG tự alertModal (đặt ở workflow). */
        function applyUploadedVideoBg(file) {
            const check = validateVideoFile(file);
            if (!check.valid) return { status: 'invalid', reason: check.reason };
            appConfigViz.mutateAll(cfg => {
                if (cfg.videoBgUrl && cfg.videoBgUrl.startsWith('blob:')) URL.revokeObjectURL(cfg.videoBgUrl);
                cfg.videoBgUrl = URL.createObjectURL(file);
                cfg.videoBgEnabled = true;
            });
            videoEnableToggle.checked = true;
            handleVideoBackground(); saveConfig();
            return { status: 'ok' };
        }

        // ===================== Nền tĩnh Visual (ảnh) — MỚI (batch 03/07/2026, hạ tầng z-index nền
        // Visual, plan-v12-multimedia-update-2.md bước 2) =====================================
        //
        // CHỐT 03/07/2026 (Giang xác nhận, ĐÈ LÊN giả định "loại trừ" ban đầu của batch trước — xem
        // git blame/lịch sử patch nếu cần đối chiếu): CẢ 4 lớp nền màn Visualizer ĐỀU CÓ THỂ BẬT
        // SONG SONG, không loại trừ nhau — thứ tự z-index (thấp -> cao, sau chồng trước):
        //   nền màu Settings (bgColor, DOM body) < ẢNH TĨNH NÀY (#visual-bg-image) < nền slideshow
        //   album (CHƯA code — chừa sẵn 1 mốc z-index ngay dưới video, xem assets/css/style.css) <
        //   video nền (#bg-video) < chính visualizer đang vẽ (#webgl-canvas/#visualizer, luôn trên
        //   cùng, KHÔNG đổi). Lớp NÀO có z-index cao hơn VÀ đang thực sự hiển thị (bật + có nội
        //   dung) thì che lớp thấp hơn — KHÔNG cần bất kỳ hàm nào chủ động tắt hàm khác, thuần tuý
        //   là hệ quả tự nhiên của CSS z-index (đặt đúng thứ tự 1 lần ở style.css, không cần rẽ
        //   nhánh loại trừ trong handleVideoBackground()/applyVisualBgImageToDOM() — code liên quan
        //   video là DI SẢN nợ kỹ thuật NẶNG, core-legacy-audit.md, cố tình KHÔNG đụng).
        //
        // VẤN ĐỀ HIỆU NĂNG (Giang lưu ý riêng, ÁP DỤNG CHO SLIDESHOW) — VIẾT LẠI (04/07/2026, mục 2
        // phản hồi Giang, bỏ watchdog poll 3s/lần): task 'slideshowTimer' pause/resume giờ do
        // event/workflow/visualizer-control-center.js GỌI TRỰC TIẾP (`workflowSlideshow.
        // pauseForVideoBg()`/`resumeFromVideoBg()`) NGAY LÚC video nền bật/tắt thành công —
        // KHÔNG còn tự poll `videoBgEnabled` lặp lại (đã có sẵn sự kiện click để biết, poll thêm
        // là thừa — đúng góp ý Giang). KHÔNG đụng `enableVideoBackground()`/
        // `disableVideoBackgroundState()`/`applyUploadedVideoBg()` (di sản, giữ nguyên như đề xuất
        // ban đầu — không thêm lời gọi void nào vào các hàm đó).

        /** Core thuần: hiện/ẩn + set `background-image` DOM cho nền tĩnh Visual — KHÔNG biết gì về
         * IndexedDB/store `images` (nơi gọi tự resolve Blob -> objectUrl trước, xem
         * event/workflow/file-manager-photo.js).
         * Rule 2: nhận objectUrl qua tham số, KHÔNG tự appState.get().
         * @param {boolean} enabled
         * @param {string} objectUrl - '' hoặc URL không hợp lệ -> coi như ẩn (guard clause thuần)
         */
        function applyVisualBgImageToDOM(enabled, objectUrl) {
            if (!visualBgImageElement) return; // guard: DOM chưa sẵn sàng (hiếm, race lúc mount)
            if (enabled && objectUrl) {
                visualBgImageElement.style.backgroundImage = `url(${objectUrl})`;
                visualBgImageElement.style.opacity = '1';
            } else {
                visualBgImageElement.style.opacity = '0';
            }
        }

        /**
         * CÙNG KHUÔN `applyBgImage()` (core/visualizer/visualizer-display.js, nền Playlist) — DÙNG
         * CHUNG bởi CẢ 2 nơi đặt nền Visual (Settings -> gạt "On" MỚI CHỌN LẦN ĐẦU, VÀ menu "Đặt
         * làm nền Visual" trên ảnh ở Photo & Album), tránh lặp lại logic 2 chỗ. Core thuần, KHÔNG tự
         * bọc shield (nơi gọi tự withLoadingShield() quanh lệnh gọi hàm async này). CŨNG dùng lại
         * để "kích hoạt lại" 1 blob ĐÃ CÓ SẴN trong IndexedDB (setMeta ghi đè cùng giá trị — rẻ,
         * không cần tách hàm riêng "chỉ áp dụng không ghi" — xem workflow gọi hàm này).
         * @param {Blob} blob
         */
        async function applyVisualBgImage(blob) {
            await setMeta('visualBgImage', blob);
            let objectUrl;
            appConfigViz.mutateAll(cfg => {
                if (cfg.visualBgImage && cfg.visualBgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.visualBgImage);
                objectUrl = URL.createObjectURL(blob);
                cfg.visualBgImage = objectUrl;
                cfg.visualBgImageEnabled = true;
            });
            if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = true;
            applyVisualBgImageToDOM(true, objectUrl);
            saveConfig();
        }

        /**
         * FIX (04/07/2026, mục 1 phản hồi Giang — ĐẢO NGƯỢC quyết định trước đó, xem lịch sử patch):
         * "tắt" KHÔNG CÒN xoá Blob đã lưu trong IndexedDB nữa — chỉ dọn object URL runtime
         * (`vizConfig.visualBgImage`) + ẩn DOM + tắt cờ `visualBgImageEnabled`. Blob thật
         * (`meta.visualBgImage`) GIỮ NGUYÊN trong IndexedDB, để lần "gạt On" kế tiếp có thể kích
         * hoạt lại NGAY LẬP TỨC qua `applyVisualBgImage()` (đọc lại chính blob này) mà KHÔNG cần mở
         * lại picker — xem event/workflow/visualizer-control-center.js::onVisualBgImageEnableChange().
         * Core thuần — KHÔNG tự bọc shield (không còn đụng IndexedDB nữa nên thực ra không còn cần
         * shield thật sự, nhưng workflow vẫn giữ nguyên lệnh gọi qua withLoadingShield cho nhất
         * quán — vô hại).
         */
        function disableVisualBgImageState() {
            appConfigViz.mutateAll(cfg => {
                if (cfg.visualBgImage && cfg.visualBgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.visualBgImage);
                cfg.visualBgImageEnabled = false;
                cfg.visualBgImage = '';
            });
            if (typeof settingVisualBgImageEnableToggle !== 'undefined' && settingVisualBgImageEnableToggle) settingVisualBgImageEnableToggle.checked = false;
            applyVisualBgImageToDOM(false, '');
            saveConfig();
        }