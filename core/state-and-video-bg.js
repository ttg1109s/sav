/**
 * State playlist/subtitle bổ sung + xử lý video nền (handleVideoBackground và các hàm liên quan).
 *
 * ÁP DỤNG /event/ (cụm "visualizerControlCenter"): `addEventListener` cũ của btnReturnVisual/
 * btnOpenControlCenter/controlCenterOverlay/visualizerControlCenter/videoEnableToggle/
 * visualEnabledToggle/videoUploadInput đã CHUYỂN sang event/listener/visualizer-control-center.js.
 * 2 nhánh cần shield/modal (đổi videoEnableToggle, upload video) đặt ở
 * event/workflow/visualizer-control-center.js — core không biết withLoadingShield/alertModal tồn
 * tại. `bgVideoElement.addEventListener('loadeddata'/'playing', fadeVideoIn, {once:true})` GIỮ
 * NGUYÊN ở setupVideoBgSource() — đây là listener nội bộ tự gỡ sau 1 lần (mục 2b.6), KHÔNG thuộc
 * `/event/`.
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
            const cfg = appState.get('vizConfig');
            if (cfg.videoBgEnabled && !cfg.videoBgUrl) {
                appState.mutate('vizConfig', c => { c.videoBgEnabled = false; });
                videoEnableToggle.checked = false;
                handleVideoBackground(); saveConfig();
            }
        }

        // URL đã thực sự nạp xong + fade vào <video>. Dùng để KHÔNG fade lại khi Next/Prev:
        // cú "nền đen -> hiện video" chỉ xảy ra MỘT LẦN cho mỗi URL video, lúc nạp lần đầu.
        // STATE — xem service/state.js.

        /**
         * Chỉ lo NGUỒN video + fade-in MỘT LẦN cho mỗi URL. Gọi khi cấu hình video đổi
         * (bật/tắt, upload, nạp lại lúc mở trang) — KHÔNG gọi mỗi lần chuyển bài.
         */
        function setupVideoBgSource() {
            const videoBgUrl = appState.get('vizConfig').videoBgUrl;
            // Đã đúng URL và đã fade xong rồi -> không làm gì (tránh fade lặp lại khi Next/Prev).
            if (bgVideoElement.getAttribute('src') === videoBgUrl && appState.get('_videoBgLoadedUrl') === videoBgUrl) return;
            appState.set('_videoBgLoadedUrl', null);
            bgVideoElement.style.opacity = '0'; // ẩn cho tới khi có khung hình thật -> không chớp trắng
            bgVideoElement.src = videoBgUrl;
            const fadeVideoIn = () => { bgVideoElement.style.opacity = '1'; appState.set('_videoBgLoadedUrl', appState.get('vizConfig').videoBgUrl); };
            // Listener NỘI BỘ tự gỡ sau 1 lần (mục 2b.6) — KHÔNG thuộc /event/.
            bgVideoElement.addEventListener('loadeddata', fadeVideoIn, { once: true });
            bgVideoElement.addEventListener('playing', fadeVideoIn, { once: true });
        }

        /**
         * CHỈ đồng bộ play/pause của video theo nhạc — KHÔNG đụng src/opacity/fade.
         * Đây là hàm được gọi mỗi lần nhạc play/pause hoặc Next/Prev, nên KHÔNG được
         * gây ra cú "nền đen rồi fade video" lần nữa.
         */
        function syncVideoBgToAudio() {
            const cfg = appState.get('vizConfig');
            if (!(cfg.videoBgEnabled && cfg.videoBgUrl)) return;
            if (!audioPlayer.paused) { bgVideoElement.play().catch(() => {}); } else { bgVideoElement.pause(); }
        }

        function handleVideoBackground() {
            // QUY TẮC v6 (đã sửa):
            //  - Video nền BẬT/TẮT chỉ phụ thuộc cấu hình + trạng thái NHẠC, KHÔNG phụ thuộc đang ở
            //    màn Playlist hay Visualizer.
            //  - NGUỒN + fade chỉ thiết lập MỘT LẦN cho mỗi URL (setupVideoBgSource). Next/Prev chỉ
            //    gọi syncVideoBgToAudio() (xem player-controls.js) nên KHÔNG fade lại nữa.
            //  - Nền đen cưỡng chế phía sau video.
            const cfg = appState.get('vizConfig');
            if (cfg.videoBgEnabled && cfg.videoBgUrl) {
                document.body.style.backgroundColor = '#000000'; // nền đen cưỡng chế sau video
                bgVideoElement.classList.remove('hidden');
                setupVideoBgSource(); // nạp nguồn + fade nếu là URL mới; no-op nếu đã sẵn sàng
                if (appState.get('_videoBgLoadedUrl') === cfg.videoBgUrl) bgVideoElement.style.opacity = '1'; // đã sẵn sàng -> hiện ngay
                syncVideoBgToAudio();
            } else {
                bgVideoElement.style.opacity = '0';
                bgVideoElement.pause();
                appState.set('_videoBgLoadedUrl', null);
                taskManager.once(() => {
                    if (!appState.get('vizConfig').videoBgEnabled) { bgVideoElement.classList.add('hidden'); bgVideoElement.removeAttribute('src'); bgVideoElement.src = ''; }
                }, 500, 'hideVideoBgAfterFade');
                updateDOMBackground();
            }
        }

        /** Core thuần: thực thi BẬT video nền (đã biết chắc videoBgUrl đã có sẵn từ trước). */
        function enableVideoBackground() {
            appState.mutate('vizConfig', cfg => { cfg.videoBgEnabled = true; });
            handleVideoBackground(); saveConfig();
        }

        /** Core thuần: thực thi TẮT video nền + xoá blob/meta đã lưu (phần KHÔNG cần shield —
         *  shield bọc quanh phần xoá IndexedDB ở workflow, core chỉ làm phần đồng bộ state/UI). */
        function disableVideoBackgroundState() {
            appState.mutate('vizConfig', cfg => {
                cfg.videoBgEnabled = false;
                if (cfg.videoBgUrl && cfg.videoBgUrl.startsWith('blob:')) URL.revokeObjectURL(cfg.videoBgUrl);
                cfg.videoBgUrl = '';
            });
            handleVideoBackground(); saveConfig();
        }

        /** Core thuần: ứng với toggle "Tắt Visual" — độc lập hoàn toàn khỏi video nền. */
        function setVisualEnabled(checked) {
            appState.mutate('vizConfig', cfg => { cfg.visualEnabled = checked; });
            saveConfig();
        }

        /** Core thuần: lưu blob video mới vào IndexedDB + áp dụng làm video nền hiện tại (phần
         *  KHÔNG cần shield — shield bọc quanh lệnh setMeta() ở workflow). Trả {status} rõ ràng,
         *  KHÔNG tự alertModal (đặt ở workflow). */
        function applyUploadedVideoBg(file) {
            const check = validateVideoFile(file);
            if (!check.valid) return { status: 'invalid', reason: check.reason };
            appState.mutate('vizConfig', cfg => {
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
        // VẤN ĐỀ HIỆU NĂNG (Giang lưu ý riêng, ÁP DỤNG CHO SLIDESHOW — CHƯA CODE, ghi lại đây làm
        // THIẾT KẾ CHO BATCH SAU): ảnh tĩnh (#visual-bg-image, hàm applyVisualBgImageToDOM() ngay
        // dưới đây) là DOM TĨNH — không có vòng lặp/timer nào chạy, bị video che thì đơn thuần
        // "vẽ vô ích 1 lần" (không đáng kể) -> KHÔNG cần pause/resume gì cả. Slideshow album THÌ
        // KHÁC — bản chất là 1 task lặp qua `taskManager` (đổi ảnh mỗi vài giây), nếu bị video che
        // hoàn toàn mà vẫn chạy ngầm là lãng phí CPU/pin thật. THIẾT KẾ khi code slideshow: task đó
        // PHẢI tự `taskManager.pause('slideshowTimer')` khi `vizConfig.videoBgEnabled` chuyển
        // true, và `taskManager.resume('slideshowTimer')` khi chuyển về false. Vì
        // `enableVideoBackground()`/`disableVideoBackgroundState()`/`applyUploadedVideoBg()` (nơi
        // cờ `videoBgEnabled` thực sự đổi) đều là code DI SẢN đã có nợ Rule 3 sẵn (gọi void
        // `handleVideoBackground()`) — KHÔNG nên thêm 1 lời gọi void nữa vào đó (sẽ buộc đưa CẢ HÀM
        // về đúng 4 rule ngay lúc đó, core-function-conventions.md mục 0.5). ĐỀ XUẤT: để chính
        // module slideshow (khi code) tự đọc `appState.get('vizConfig').videoBgEnabled` NGAY ĐẦU
        // tick của nó (task lặp tự thấy trạng thái mới nhất mỗi lần chạy, không cần ai "báo" nó) —
        // nếu true thì tự pause chính mình, không tick tiếp cho tới khi 1 tick SAU ĐÓ (do 1 timer
        // "canh chừng" nhẹ khác, hoặc chính video-toggle gọi resume qua hàm MỚI/riêng — cần thiết
        // kế cụ thể hơn lúc code thật batch đó) phát hiện `videoBgEnabled` đã về false.

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