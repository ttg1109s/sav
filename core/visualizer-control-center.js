/**
 * core/visualizer-control-center.js — ĐỔI TÊN từ `core/state-and-video-bg.js` (v13 Batch A,
 * plan-v13-visual-background-unification.md). Tên cũ mô tả 2 thứ mà file này KHÔNG còn chứa: phần
 * "state" đã dời hết sang service/state/*.js từ đợt tái cấu trúc 25/07/2026, phần "video bg" vừa
 * dời sang domain "Visual Background" (core/visual-bg.js + event/listener,router,workflow/visual-bg.js) trong chính đợt
 * này. Nội dung CÒN LẠI đúng 1 nhóm duy nhất — Control Center của màn Visualizer:
 *   returnToVisualizer / openControlCenter / closeControlCenter / toggleControlCenter /
 *   handleControlCenterGridClick / setVisualEnabled
 * — khớp đúng cụm router "visualizerControlCenter" (event/listener,router,workflow/
 * visualizer-control-center.js), nên tên file giờ phản ánh ĐÚNG nội dung + đúng nơi gọi.
 *
 * `addEventListener` của các phần tử này sống ở event/listener/visualizer-control-center.js —
 * KHÔNG có listener nào trong file này (Rule 5a).
 *
 * XOÁ THỦ CÔNG file cũ `core/state-and-video-bg.js` (đã đổi tên, không còn dùng).
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

        // ===================== XOÁ HẲN (v13 Batch A, plan-v13-visual-background-unification.md)
        // =====================================================================================
        // 7 hàm video/ảnh nền màn Visualizer từng sống ở đây ĐÃ BỊ THAY THẾ HOÀN TOÀN bởi domain
        // "Visual Background" (core/visual-bg.js + event/workflow,router,listener/visual-bg.js):
        //   validateVideoBgOnClose()  -> (v14: không còn cần — schema mới tự nhất quán, xem
        //                                event/workflow/player-controls.js::closeSettingsDrawer())
        //   setupVideoBgSource()      -> showVisualBgVideoElement(objectUrl, loadedUrl)
        //   syncVideoBgToAudio()      -> syncVisualBgVideoPlayback(isAudioPaused)
        //   handleVideoBackground()   -> workflowVisualBg.applyCurrentVisualBg() (+ hide/show core)
        //   enableVideoBackground()   -> (v14: không còn toggle riêng — chọn nguồn = bật, xem
        //                                workflowVisualBg._resolveAndCommitSource())
        //   disableVideoBackgroundState() -> workflowVisualBg.clearSource()
        //   applyUploadedVideoBg()    -> KHÔNG còn khái niệm "upload/copy Blob làm nền": nguồn giờ
        //                                tham chiếu bằng KEY (`visualBgConfig.source.list`),
        //                                Blob gốc nằm nguyên trong store `videos`.
        // Lý do KHÔNG giữ lại/không kế thừa: 2 vi phạm cụ thể (Core tự `appConfigViz.getAll()` —
        // Rule 2; Core gọi Core khác `handleVideoBackground()`/`saveConfig()` — Rule 3a) phải được
        // sửa dứt điểm trong đợt này, KHÔNG viện cớ "code cũ đã vậy" (plan nguyên tắc #3).
        // `meta.videoBg` (bản sao Blob video nền của cơ chế cũ) trở thành dữ liệu MỒ CÔI — dọn ở
        // Batch F cùng `meta.visualBgImage`.

        /** Core thuần: ứng với toggle "Tắt Visual" — độc lập hoàn toàn khỏi video nền. */
        function setVisualEnabled(checked) {
            appConfigViz.mutateAll(cfg => { cfg.visualEnabled = checked; });
            saveConfig();
        }

        // ===================== XOÁ HẲN (v13 Batch A) — Nền tĩnh Visual (ảnh) =================
        // `applyVisualBgImageToDOM()` DỜI NGUYÊN sang core/visual-bg.js (đúng domain của nó, thân
        // hàm không đổi). `applyVisualBgImage(blob)`/`disableVisualBgImageState()` XOÁ HẲN — 2 hàm
        // đó ghi 1 BẢN SAO Blob vào `meta.visualBgImage` rồi tự đồng bộ `settingVisualBgImageEnableToggle`
        // (toggle đã xoá) + tự gọi `saveConfig()` (Rule 3a). Cơ chế mới: chỉ lưu `imageKey`, Blob
        // gốc nằm nguyên trong store `images`, Workflow tự resolve mỗi session.
        // Thứ tự z-index 4 lớp nền (nền màu < ảnh tĩnh < slideshow < video < canvas visualizer)
        // KHÔNG đổi — vẫn thuần CSS (assets/css/style.css), không hàm nào chủ động tắt hàm khác.
