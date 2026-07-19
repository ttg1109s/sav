/**
 * Tự động đổi hiệu ứng Visualizer theo thời gian (ver 10).
 *
 * QUAN TRỌNG — 2 KHÁI NIỆM HOÀN TOÀN TÁCH BIỆT, KHÔNG ĐƯỢC GỘP CHUNG:
 *
 *   (A) "Loại hình visual sắp tới là gì" — vizConfig.autoSwitchVisualMode ('sequential' | 'random').
 *       Chỉ quyết định CÁCH CHỌN kiểu kế tiếp, độc lập hoàn toàn với CÁCH TÍNH THỜI GIAN ở (B).
 *
 *   (B) "Tới giây nào thì nhảy sang visual khác" — vizConfig.autoSwitchVisualTimeMode, có 2 NHÁNH
 *       cơ chế khác nhau hẳn (không phải biến thể của nhau):
 *
 *       NHÁNH 1 — 'fixed' (c1) và 'random' (c2): ĐỒNG HỒ ĐỘC LẬP, không quan tâm bài nào đang
 *       phát, không quan tâm currentTime/duration của bài. Chỉ đơn giản: cứ đếm đủ X giây (c1: X
 *       cố định người điền; c2: X random lại mỗi vòng trong [10, X người điền]) là đổi, rồi đếm
 *       lại từ đầu — CHẠY XUYÊN QUA NHIỀU BÀI, không reset/không liên quan gì tới việc đổi bài hay
 *       vị trí cụ thể trong bài. Cơ chế: 1 task qua taskManager, mode 'timeout' (bù trôi), đếm lùi
 *       y hệt kiểu _listenTickHandle (player-controls.js) — pause()/resume() theo đúng audioPlayer
 *       play/pause (nhạc dừng thì đồng hồ phụ này cũng dừng, đúng cảm giác "không tính giờ chết"),
 *       nhưng KHÔNG đụng gì tới currentTime/seek — seek tới/lùi tuỳ ý không ảnh hưởng đồng hồ này.
 *
 *       NHÁNH 2 — 'duration' (c3): DUY NHẤT mode này thực sự gắn với KHUNG THỜI GIAN của bài đang
 *       phát — X người điền là số chia trong công thức (duration / X), hệ thống tự kẹp X không
 *       vượt round(duration/2) để đảm bảo LUÔN có tối thiểu 1 lần đổi xảy ra giữa bài (nếu không
 *       kẹp, X quá lớn so với duration sẽ làm phép chia ra 0 lần đổi — vô nghĩa với 1 tính năng
 *       "tự động đổi"). Vì mode này phụ thuộc TRỰC TIẾP vị trí trong bài, cần xử lý đúng khi người
 *       dùng SEEK (tua) tới/lùi tay: build trước 1 mảng mốc TUYỆT ĐỐI theo giây của bài (không
 *       phải khoảng cách tương đối), mỗi mốc TỰ NHỚ visual của riêng nó — lần đầu đi qua 1 đoạn
 *       mới chọn visual MỚI và ghi nhớ vào mốc đó; mọi lần SAU đó rơi lại đúng đoạn này (kể cả do
 *       tua lùi về) chỉ áp dụng LẠI đúng visual đã nhớ, KHÔNG chọn mới — tua qua tua lại vẫn nhất
 *       quán, không bị "nhảy ngẫu nhiên" mỗi lần đi qua lại 1 chỗ đã từng qua.
 *
 *       CHỈ 1 trong 2 nhánh chạy tại 1 thời điểm, theo đúng vizConfig.autoSwitchVisualTimeMode —
 *       2 task riêng (tên khác nhau trong taskManager), không bao giờ chạy đồng thời.
 *
 * Build lại marks (nhánh 2) khi: đổi bài (loadedmetadata, vì duration mới khác hẳn), hoặc đổi
 * autoSwitchVisualSecondsFixed/Random/Duration (field tương ứng nhánh đang chạy). Reset đồng hồ
 * (nhánh 1) khi: bật tính năng, đổi autoSwitchVisualTimeMode sang 'fixed'/'random', hoặc đổi field
 * giây tương ứng — KHÔNG reset khi đổi bài (đặc điểm cốt
 * lõi của nhánh 1: không quan tâm bài nào đang phát).
 *
 * PHẢI nạp SAU: core/config.js (AUTO_SWITCH_VISUAL_MIN_SECONDS, MODES), core/dom-refs.js
 * (currentModeIndex, audioPlayer), service/task-manager.js (taskManager), core/equalizer-settings.js
 * (saveConfig), core/visualizer/visualizer-display.js (updateTypeUI — ver 11: hàm này đã dời từ
 * player-controls.js sang đây, xem comment đầu file đó) — xem index.html.
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * Panel Visualizer Settings (chứa cả section "Tự động đổi hiệu ứng") giờ PUSH/POP động — 4 hàm
 * `set*`/`syncAutoSwitchTimeModeBlocks()` REFACTOR ĐẦY ĐỦ Rule 1-4 theo CHỐT của Giang (Batch D2):
 * bỏ hẳn `saveConfig()`/`updateCycleModeButtonState()`/`startAutoSwitchVisualBranch()` nội bộ, dời
 * ra `event/workflow/auto-switch-visual.js`. `initAutoSwitchVisualUI()` cũ TÁCH LÀM 2: phần Control
 * Center (`#btn-cycle-mode`, KHÔNG di chuyển) đổi tên `initAutoSwitchCycleButtonFromConfig()`, vẫn
 * gọi từ loadConfig(); phần đồng bộ panel (7 field) dời sang
 * `workflowVisualizerDisplay.openPanel()` (core/visualizer/visualizer-display.js đảm nhiệm push
 * panel, sync CẢ 2 section trong CÙNG 1 panel — xem file đó).
 */
        const AUTO_SWITCH_VISUAL_TASK_TIMER = 'autoSwitchVisualTimer';   // nhánh 1 (fixed/random) — đồng hồ độc lập
        const AUTO_SWITCH_VISUAL_TASK_MARKS = 'autoSwitchVisualMarks';  // nhánh 2 (duration) — tick theo mốc bài hát

        /** Chọn 1 giá trị MODES MỚI theo đúng autoSwitchVisualMode hiện tại (KHÔNG tự áp dụng/lưu gì cả). */
        function pickNextAutoSwitchVisualType() {
            const currentModeIndex = appState.get('currentModeIndex');
            if (appState.get('vizConfig').autoSwitchVisualMode === 'random' && MODES.length > 1) {
                let idx = currentModeIndex;
                while (idx === currentModeIndex) idx = Math.floor(Math.random() * MODES.length);
                return MODES[idx];
            }
            return MODES[(currentModeIndex + 1) % MODES.length]; // 'sequential' — đúng cơ chế #btn-cycle-mode
        }

        /** Áp dụng 1 kiểu hiệu ứng cụ thể (đã biết trước, KHÔNG tự chọn) — dùng khi mark đã có visual sẵn. */
        function applyAutoSwitchVisualType(type) {
            const idx = MODES.indexOf(type);
            if (idx === -1 || idx === appState.get('currentModeIndex')) return; // type lạ hoặc đã đúng kiểu hiện tại -> không làm gì
            appState.set('currentModeIndex', idx);
            updateTypeUI();
            saveConfig();
        }

        // ============================================================================
        // NHÁNH 1 — 'fixed' (c1) / 'random' (c2): đồng hồ đếm lùi ĐỘC LẬP, không liên
        // quan currentTime/duration/bài nào đang phát. Y hệt kiểu _listenTickHandle.
        // ============================================================================

        /** Tính số giây (ms) cho LẦN ĐẾM KẾ TIẾP — chỉ gọi lúc bắt đầu 1 vòng đếm mới. */
        function computeAutoSwitchVisualTimerDelayMs() {
            const cfg = appState.get('vizConfig');
            if (cfg.autoSwitchVisualTimeMode === 'random') {
                // (c2) Random LẠI mỗi vòng trong [10, X người điền] — không phải 1 số cố định.
                const maxSeconds = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, cfg.autoSwitchVisualSecondsRandom);
                return (AUTO_SWITCH_VISUAL_MIN_SECONDS + Math.random() * (maxSeconds - AUTO_SWITCH_VISUAL_MIN_SECONDS)) * 1000;
            }
            return Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, cfg.autoSwitchVisualSecondsFixed) * 1000; // (c1) 'fixed' — khoảng cố định
        }

        /**
         * Đặt lịch CHO VÒNG ĐẾM KẾ TIẾP — task count:1, callback tự đổi visual rồi tự gọi lại hàm
         * này để "tái tạo" vòng đếm mới (cần thiết cho 'random' vì mỗi vòng delay khác nhau — Loop
         * không hỗ trợ đổi time giữa chừng của 1 task count vô hạn, xem giải thích ở task-manager.js).
         */
        function scheduleNextAutoSwitchVisualTimer() {
            taskManager.kill(AUTO_SWITCH_VISUAL_TASK_TIMER);
            taskManager.addNew(AUTO_SWITCH_VISUAL_TASK_TIMER, {
                time: computeAutoSwitchVisualTimerDelayMs(),
                exe: () => {
                    applyAutoSwitchVisualType(pickNextAutoSwitchVisualType());
                    // Chỉ tự tái tạo vòng đếm nếu tính năng VẪN đang ở đúng nhánh 1 VÀ nhạc VẪN
                    // đang phát — tránh tái tạo vô nghĩa nếu người dùng vừa tắt/đổi mode/dừng nhạc
                    // đúng lúc callback này chạy.
                    if (appState.get('vizConfig').autoSwitchVisualEnabled && appState.get('vizConfig').autoSwitchVisualTimeMode !== 'duration'
                        && typeof audioPlayer !== 'undefined' && !audioPlayer.paused) {
                        scheduleNextAutoSwitchVisualTimer();
                    }
                },
                mode: 'timeout',
                count: 1
            });
            taskManager.operator(AUTO_SWITCH_VISUAL_TASK_TIMER, 'enabled');
        }

        // ============================================================================
        // NHÁNH 2 — 'duration' (c3): mốc TUYỆT ĐỐI theo audioPlayer.currentTime, mỗi mốc
        // tự nhớ visual của riêng nó (xử lý đúng khi người dùng tua tới/lùi).
        // ============================================================================

        /** Mảng mốc của BÀI ĐANG PHÁT hiện tại — [{ time: giây tuyệt đối, visual: 'bar'|null }, ...].
         *  STATE — xem service/state.js. */

        /**
         * Build mảng mốc MỚI cho bài đang phát (nhánh 2 — 'duration' — DUY NHẤT mode dùng tới
         * mảng này). X (vizConfig.autoSwitchVisualSecondsDuration) là SỐ CHIA trong (duration / X), tự kẹp
         * không vượt round(duration/2) để đảm bảo tối thiểu 1 lần đổi thật sự xảy ra giữa bài —
         * nếu không kẹp, X quá lớn (gần/vượt duration) sẽ cho (duration/X) ra một khoảng còn lớn
         * hơn cả bài, tức 0 lần đổi nào xảy ra — vô nghĩa với 1 tính năng "tự động đổi".
         */
        function buildAutoSwitchVisualMarks() {
            const duration = (typeof audioPlayer !== 'undefined' && isFinite(audioPlayer.duration) && audioPlayer.duration > 0)
                ? audioPlayer.duration : 0;
            // Mark ĐẦU TIÊN (t=0) GIỮ NGUYÊN kiểu đang chọn hiện tại — KHÔNG coi là "1 lần đổi".
            // Người dùng vừa mới bắt đầu nghe, chưa có lý do gì để auto-switch nhảy hiệu ứng NGAY
            // GIÂY ĐẦU TIÊN trước khi mốc thời gian thật nào trôi qua.
            const marks = [{ time: 0, visual: MODES[appState.get('currentModeIndex')] }];
            // FIX (13/07/2026, bug "đóng/mở lại app -> visual đứng yên hết bài hiện tại") — trả về
            // false khi chưa có duration hợp lệ (chỉ 1 mốc, không đổi gì) để nơi gọi
            // (startAutoSwitchVisualBranch()) BIẾT lần build này KHÔNG đầy đủ — xem giải thích đầy
            // đủ ở startAutoSwitchVisualBranch().
            if (duration <= 0) { appState.set('autoSwitchVisualMarks', marks); return false; }

            const maxAllowed = Math.round(duration / 2);
            const step = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, Math.min(appState.get('vizConfig').autoSwitchVisualSecondsDuration, maxAllowed));
            let t = step;
            while (t < duration) { marks.push({ time: t, visual: null }); t += step; }
            appState.set('autoSwitchVisualMarks', marks);
            return true;
        }

        /**
         * Tick định kỳ (mỗi 1s, qua taskManager) — đọc THẲNG audioPlayer.currentTime hiện tại
         * (đúng dù nhạc tự trôi tự nhiên hay người dùng vừa seek tay), tìm mark mà currentTime
         * đang thuộc vào, áp dụng ĐÚNG quy tắc "nhớ visual theo mốc" (xem giải thích đầu file).
         */
        function autoSwitchVisualMarksTick() {
            const marks = appState.get('autoSwitchVisualMarks');
            if (typeof audioPlayer === 'undefined' || marks.length === 0) return;
            const t = audioPlayer.currentTime;

            // Tìm mark CUỐI CÙNG có time <= t (mark mà currentTime đang thuộc đoạn của nó). Nếu t
            // đã vượt qua mark cuối cùng trong mảng, idx tự nhiên DỪNG LẠI ở chính mark cuối đó —
            // KHÔNG cần code riêng để "stop đổi visual sau mark cuối": không có mark nào sau nó
            // trong mảng, applyAutoSwitchVisualType() sẽ chỉ áp dụng LẠI đúng visual đã gán cho
            // mark cuối, không bao giờ "nhảy tiếp" sang visual khác nữa.
            let idx = 0;
            for (let i = 0; i < marks.length; i++) {
                if (marks[i].time <= t) idx = i; else break;
            }

            const mark = marks[idx];
            if (mark.visual === null) {
                // Lần ĐẦU TIÊN đi qua đoạn này -> chọn visual MỚI, GHI NHỚ vào chính mark đó.
                const type = pickNextAutoSwitchVisualType();
                appState.mutate('autoSwitchVisualMarks', arr => { arr[idx].visual = type; });
                applyAutoSwitchVisualType(type);
            } else {
                // Đã từng đi qua đoạn này rồi (kể cả do tua/seek lùi về) -> áp dụng LẠI đúng giá
                // trị đã nhớ, KHÔNG chọn mới — đúng yêu cầu nhất quán khi tua qua tua lại.
                applyAutoSwitchVisualType(mark.visual);
            }
        }

        // ============================================================================
        // ĐIỀU PHỐI CHUNG — chọn đúng 1 trong 2 nhánh, start/stop/pause/resume.
        // ============================================================================

        /** Dừng/dọn CẢ HAI task của 2 nhánh — dùng khi tắt tính năng/hết bài/clear all. */
        function killAllAutoSwitchVisualTasks() {
            taskManager.kill(AUTO_SWITCH_VISUAL_TASK_TIMER);
            taskManager.kill(AUTO_SWITCH_VISUAL_TASK_MARKS);
        }

        /** Key của bài đã build/gán marks LẦN GẦN NHẤT — dùng để onAutoSwitchVisualSongChanged()
         * (gọi từ 'loadedmetadata') biết liệu startAutoSwitchVisualBranch() đã chạy đúng cho bài
         * hiện tại rồi chưa (qua event 'play' bắn TRƯỚC 'loadedmetadata' trong playSong() — xem
         * giải thích đầy đủ ở comment startAutoSwitchVisualBranch()) — tránh build/gán LẠI LẦN 2,
         * đè mất marks vừa phục hồi đúng từ applyResumeStateToRam() (resume-state-storage.js).
         * STATE — xem service/state.js. */

        /**
         * Bắt đầu ĐÚNG 1 nhánh theo vizConfig.autoSwitchVisualTimeMode hiện tại — luôn kill cả 2
         * task trước (đảm bảo không bao giờ có 2 nhánh chạy song song), rồi khởi động lại nhánh
         * tương ứng từ đầu. Gọi khi: bật tính năng, đổi autoSwitchVisualTimeMode, đổi field giây
         * riêng của nhánh đang chạy (autoSwitchVisualSecondsFixed/Random/Duration), đổi bài (chỉ
         * nhánh 2 cần build lại marks — nhánh 1 KHÔNG được reset khi đổi bài, xem
         * onAutoSwitchVisualSongChanged() gọi có điều kiện).
         *
         * FIX (ver 10 refine #3 — khôi phục sau "ẩn tab -> reload"): nếu
         * resume-state-storage.js (applyResumeStateToRam(), gọi từ nhánh "Tiếp tục phát"/"Nghe lại"
         * của showResumeChoiceModal()) vừa đặt window._resumeAutoSwitchVisualMarks — nghĩa là có 1
         * mảng marks ĐÃ LƯU từ trước khi ẩn tab, ghi nhớ đúng hiệu ứng cho từng đoạn đã nghe qua —
         * ƯU TIÊN gán đè mảng đó vào autoSwitchVisualMarks NGAY, KHÔNG gọi buildAutoSwitchVisualMarks()
         * (hàm đó sẽ tạo mảng MỚI HOÀN TOÀN, xoá hết các mốc đã "nhớ" visual, phá vỡ tính nhất quán
         * "tua qua tua lại không đổi ngẫu nhiên" mà tính năng này được thiết kế để đảm bảo). Đọc
         * marks đã lưu CHỈ 1 LẦN rồi xoá cờ ngay (window._resumeAutoSwitchVisualMarks = null) — các
         * lần startAutoSwitchVisualBranch() SAU đó (đổi bài tiếp/đổi field giây...) phải build mới
         * như bình thường, không dùng lại marks cũ của bài trước.
         */
        function startAutoSwitchVisualBranch() {
            killAllAutoSwitchVisualTasks();
            const cfg = appState.get('vizConfig');
            const currentKey = appState.get('currentKey');
            if (!cfg.autoSwitchVisualEnabled || !currentKey) return;

            if (cfg.autoSwitchVisualTimeMode === 'duration') {
                // FIX (13/07/2026, bug Giang báo — "đóng và vào lại app, visual cuối trong lượt
                // auto chạy tới hết bài hiện tại, bài sau mới auto-switch lại bình thường") —
                // NGUYÊN NHÂN GỐC: 'play' bắn TRƯỚC 'loadedmetadata' trong playSong() (xem giải
                // thích ở onAutoSwitchVisualSongChanged() dưới) — trên 1 phiên VỪA khởi động lại
                // (app mới mở/đóng-mở lại), AudioContext/pipeline decode CHƯA "khởi động nóng"
                // (setupAudioContext() ở audio-engine.js chạy nặng hơn hẳn so với các lần đổi bài
                // SAU đó trong cùng phiên) — 'play' bắn ra khi audioPlayer.duration CHƯA kịp có giá
                // trị hợp lệ (vẫn NaN). buildAutoSwitchVisualMarks() lúc đó rơi vào nhánh
                // "duration <= 0" — CHỈ tạo ĐÚNG 1 mốc (t=0) rồi return false — nhưng bản TRƯỚC ĐÂY
                // vẫn cứ appState.set('_lastMarksBuiltForKey', currentKey) VÔ ĐIỀU KIỆN ngay sau
                // đó — khiến 'loadedmetadata' bắn SAU (lúc này duration đã có thật) bị
                // onAutoSwitchVisualSongChanged() TƯỞNG NHẦM là "bài này đã build marks xong rồi",
                // bỏ qua không rebuild — mảng marks CHỈ 1 MỐC đó tồn tại SUỐT hết bài (không mốc
                // nào khác để tick nhảy tới) -> visual đứng yên tới hết bài, đúng triệu chứng Giang
                // mô tả. Bài SAU đó hoạt động lại bình thường vì lúc này pipeline đã "ấm", duration
                // có sẵn ngay lúc 'play' bắn, build đủ mốc ngay từ đầu.
                // SỬA: chỉ đánh dấu `_lastMarksBuiltForKey` khi ĐÃ THẬT SỰ build đủ mốc (marks phục
                // hồi từ resume snapshot LUÔN coi là đủ — đã có sẵn từ 1 phiên có duration hợp lệ
                // trước đó; buildAutoSwitchVisualMarks() chỉ coi là đủ khi trả về `true`) — nếu
                // KHÔNG đủ (duration chưa sẵn sàng), để nguyên `_lastMarksBuiltForKey` (không khớp
                // currentKey), 'loadedmetadata' bắn sau đó sẽ tự phát hiện chưa khớp và rebuild lại
                // ĐÚNG với duration thật, không còn bị chặn nhầm nữa.
                let marksReady;
                if (typeof window !== 'undefined' && Array.isArray(window._resumeAutoSwitchVisualMarks) && window._resumeAutoSwitchVisualMarks.length > 0) {
                    appState.set('autoSwitchVisualMarks', window._resumeAutoSwitchVisualMarks);
                    window._resumeAutoSwitchVisualMarks = null; // chỉ dùng 1 lần — lần sau build lại bình thường
                    marksReady = true;
                } else {
                    marksReady = buildAutoSwitchVisualMarks();
                }
                if (marksReady) appState.set('_lastMarksBuiltForKey', currentKey); // đánh dấu ĐÃ build/gán marks đúng cho bài này — xem onAutoSwitchVisualSongChanged()
                taskManager.addNew(AUTO_SWITCH_VISUAL_TASK_MARKS, { time: 1000, exe: autoSwitchVisualMarksTick, mode: 'timeout', count: 0 });
                taskManager.operator(AUTO_SWITCH_VISUAL_TASK_MARKS, 'enabled');
                if (typeof audioPlayer !== 'undefined' && audioPlayer.paused) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_MARKS);
            } else {
                scheduleNextAutoSwitchVisualTimer();
                if (typeof audioPlayer !== 'undefined' && audioPlayer.paused) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER);
            }
        }

        /**
         * Gọi khi BÀI ĐANG PHÁT THAY ĐỔI (loadedmetadata) — CHỈ nhánh 2 ('duration') cần build lại
         * marks (duration mới khác hẳn bài cũ). Nhánh 1 ('fixed'/'random') KHÔNG được đụng tới ở
         * đây — đặc điểm cốt lõi của nhánh 1 là "không quan tâm bài nào đang phát", đổi bài giữa 1
         * vòng đếm không reset gì cả, đồng hồ cứ tiếp tục đếm xuyên qua bài mới.
         *
         * FIX (ver 10 refine #3, bổ sung — race condition 'play' bắn TRƯỚC 'loadedmetadata' trong
         * playSong(), đã xác nhận bằng test thực tế): listener 'play' (player-controls.js) gọi
         * syncAutoSwitchVisualPlayState() → thấy task CHƯA tồn tại (bài mới) → tự gọi
         * startAutoSwitchVisualBranch() lần 1, đọc ĐÚNG window._resumeAutoSwitchVisualMarks (nếu có
         * từ applyResumeStateToRam()) rồi XOÁ cờ đó ngay (chỉ dùng 1 lần). Event 'loadedmetadata' bắn
         * SAU 'play' — nếu hàm này (gọi bởi event đó) CỨ gọi lại startAutoSwitchVisualBranch() VÔ
         * ĐIỀU KIỆN như bản trước, marks vừa phục hồi đúng (lần 1) sẽ bị build LẠI MỚI HOÀN TOÀN ở
         * lần 2 này (cờ window._resumeAutoSwitchVisualMarks đã null từ lần 1) — mất hết các mốc đã
         * "nhớ" visual của đoạn đã nghe qua trước khi ẩn tab, đúng triệu chứng quan sát được khi
         * test phục hồi resume state.
         *
         * SỬA: chỉ gọi startAutoSwitchVisualBranch() ở đây nếu marks CHƯA từng build cho ĐÚNG bài
         * hiện tại (_lastMarksBuiltForKey !== currentKey) — startAutoSwitchVisualBranch() tự cập
         * nhật _lastMarksBuiltForKey mỗi khi nó thực sự build/gán marks (cho dù gọi từ 'play' hay
         * từ đây), nên lần gọi thứ 2 (nếu có, cho CÙNG 1 bài) sẽ tự nhận ra không cần làm lại.
         */
        function onAutoSwitchVisualSongChanged() {
            if (appState.get('vizConfig').autoSwitchVisualTimeMode === 'duration' && appState.get('_lastMarksBuiltForKey') !== appState.get('currentKey')) {
                startAutoSwitchVisualBranch();
            }
            // Nhánh 1: không làm gì — task vẫn đang đếm tiếp, không liên quan việc đổi bài.
            // Nhánh 2 nhưng marks đã build đúng cho bài hiện tại (từ event 'play' bắn trước) -> bỏ
            // qua, không làm gì thêm.
        }

        /**
         * Gọi lúc nhạc play/pause (player-controls.js, trong listener đã có sẵn) — pause/resume
         * ĐÚNG task của nhánh đang chạy (không biết/không cần biết nhánh nào — chỉ task nào thật
         * sự có trong taskManager.plan mới được pause/resume, task không tồn tại thì no-op).
         */
        function syncAutoSwitchVisualPlayState() {
            const cfg = appState.get('vizConfig');
            if (!cfg.autoSwitchVisualEnabled || !appState.get('currentKey')) { killAllAutoSwitchVisualTasks(); return; }
            const taskName = (cfg.autoSwitchVisualTimeMode === 'duration') ? AUTO_SWITCH_VISUAL_TASK_MARKS : AUTO_SWITCH_VISUAL_TASK_TIMER;
            if (!taskManager.plan[taskName]) { startAutoSwitchVisualBranch(); return; } // chưa từng bắt đầu -> bắt đầu mới
            if (typeof audioPlayer !== 'undefined' && audioPlayer.paused) taskManager.pause(taskName);
            else taskManager.resume(taskName);
        }

        // ===================== UI binding (Settings, section "Tự động đổi hiệu ứng") =====================

        /**
         * Đồng bộ trạng thái khoá/mở của nút "Đổi hiệu ứng" (#btn-cycle-mode, Control Center màn
         * Visualizer) theo ĐÚNG vizConfig.autoSwitchVisualEnabled hiện tại.
         *
         * YÊU CẦU MỚI: khi tự động đổi hiệu ứng đang BẬT, nút này phải vô hiệu HOÀN TOÀN — không
         * bấm được, bấm cũng không có tác dụng — tránh xung đột giữa đổi tự động (theo giờ) và
         * đổi tay (theo ý người dùng) cùng lúc. Trước đây nút luôn hoạt động bất kể auto-switch
         * đang bật hay tắt, đây CHÍNH là hành vi gây xung đột cần sửa.
         *
         * Đặt thuộc tính HTML `disabled` THẬT (không chỉ class CSS mờ) — input/button có
         * `disabled` tự động không nhận click/focus/keyboard ở tầng trình duyệt, là lớp chặn đáng
         * tin cậy nhất. player-controls.js (btnCycleMode click listener) vẫn tự kiểm tra thêm
         * `vizConfig.autoSwitchVisualEnabled` làm lớp chặn THỨ HAI — phòng trường hợp nút bị gọi
         * `.click()` bằng JS từ nơi khác (lúc đó thuộc tính `disabled` không chặn được vì đó chỉ
         * chặn tương tác CHUỘT/BÀN PHÍM THẬT của người dùng, không chặn gọi hàm JS trực tiếp).
         *
         * Gọi hàm này ở MỌI nơi autoSwitchVisualEnabled có thể thay đổi: đồng bộ UI lúc
         * initAutoSwitchVisualUI() chạy (kể cả mỗi lần loadConfig() — đảm bảo đúng trạng thái
         * ngay từ lúc mở app, không cần đợi người dùng vào Settings trước), và lúc listener
         * 'change' của toggle bật/tắt chạy.
         */
        function updateCycleModeButtonState() {
            if (typeof btnCycleMode === 'undefined' || !btnCycleMode) return;
            const locked = appState.get('vizConfig').autoSwitchVisualEnabled === true;
            btnCycleMode.disabled = locked;
            btnCycleMode.classList.toggle('opacity-40', locked);
            btnCycleMode.classList.toggle('cursor-not-allowed', locked);
            btnCycleMode.title = locked
                ? 'Đổi hiệu ứng (đang khoá — tắt "Tự động đổi hiệu ứng" trong Cài đặt để bấm tay)'
                : 'Đổi hiệu ứng';
        }

        /**
         * FIX BUG (19/07/2026, yêu cầu Giang — mục 5) — khi "Tự động đổi hiệu ứng" đang BẬT, select
         * "Kiểu hiệu ứng" (#setting-visualizer-type, Settings chính) VẪN chọn tay được, dù nút cycle
         * (#btn-cycle-mode, Control Center) đã bị khoá đúng — 2 đường CÙNG đổi visual tay nhưng chỉ
         * 1 đường được khoá, người dùng vẫn lách qua được bằng select. Khoá CẢ 2 nơi, CÙNG lý do và
         * CÙNG cách làm như updateCycleModeButtonState() ngay trên (thuộc tính `disabled` HTML thật,
         * không chỉ CSS mờ) — gọi hàm này ở ĐÚNG những chỗ đã gọi updateCycleModeButtonState().
         * Truy vấn TƯƠI (không dom-refs tĩnh) dù select này thực ra tĩnh từ lúc boot — chỉ để nhất
         * quán với các hàm truy vấn tươi khác trong file này.
         */
        function updateVisualizerTypeSelectState() {
            const selectEl = document.getElementById('setting-visualizer-type');
            if (!selectEl) return;
            const locked = appState.get('vizConfig').autoSwitchVisualEnabled === true;
            selectEl.disabled = locked;
            selectEl.classList.toggle('opacity-40', locked);
            selectEl.classList.toggle('cursor-not-allowed', locked);
        }

        /**
         * Hiện ĐÚNG 1 trong 3 khối input theo `timeModeValue`, ẩn 2 khối còn lại.
         *
         * Batch D3 (Settings restructure, 06/07/2026) — panel Visualizer Settings giờ PUSH/POP
         * động (core/settings-panel-stack.js), 3 khối `elAutoSwitchBlockFixed/Random/Duration` KHÔNG
         * còn là dom-refs tĩnh hợp lệ (đã xoá khỏi core/dom-refs.js) — hàm giờ nhận CẢ 4 tham số
         * (giá trị + 3 khối) từ nơi gọi, nơi gọi tự tìm phần tử BÊN TRONG panel đang mở (delegation,
         * xem event/listener/auto-switch-visual.js) thay vì dựa vào biến toàn cục.
         * @param {string} timeModeValue @param {HTMLElement} blockFixedEl @param {HTMLElement} blockRandomEl @param {HTMLElement} blockDurationEl
         */
        function syncAutoSwitchTimeModeBlocks(timeModeValue, blockFixedEl, blockRandomEl, blockDurationEl) {
            if (!blockFixedEl) return;
            blockFixedEl.classList.toggle('hidden', timeModeValue !== 'fixed');
            blockRandomEl.classList.toggle('hidden', timeModeValue !== 'random');
            blockDurationEl.classList.toggle('hidden', timeModeValue !== 'duration');
        }

        /**
         * Đồng bộ boot-time PHẦN KHÔNG PHỤ THUỘC PANEL — nút cycle Control Center (#btn-cycle-mode)
         * theo `autoSwitchVisualEnabled` đã lưu. Batch D3 — ĐỔI TÊN từ `initAutoSwitchVisualUI()`
         * (hàm cũ gộp cả phần Control Center lẫn phần đồng bộ panel; phần panel giờ tách sang
         * `workflowVisualizerDisplay.openPanel()` vì panel không còn tồn tại lúc boot — gọi hàm cũ
         * lúc boot sẽ luôn no-op do guard `if (!elAutoSwitchEnable...) return` ở đầu, khiến
         * `updateCycleModeButtonState()` KHÔNG BAO GIỜ chạy được lúc boot nữa nếu để nguyên trong
         * cùng 1 hàm — tách riêng để phần Control Center luôn chạy đúng bất kể panel đóng/mở).
         * Gọi từ loadConfig() (core/config.js) qua guard `typeof === 'function'`.
         */
        function initAutoSwitchCycleButtonFromConfig() {
            updateCycleModeButtonState();
            updateVisualizerTypeSelectState(); // FIX BUG 19/07/2026 (mục 5) — xem docstring hàm này ở trên
        }

        /** Core thuần: ứng với toggle bật/tắt "Tự động đổi hiệu ứng". Batch D3 — nhận `optionsEl`
         * qua tham số (panel động, xem docstring syncAutoSwitchTimeModeBlocks ở trên); BỎ
         * `saveConfig()`/`updateCycleModeButtonState()`/`startAutoSwitchVisualBranch()` nội bộ —
         * dời ra `workflowVisualizerDisplay.setAutoSwitchEnabled()` (Rule 3).
         * @param {boolean} checked @param {HTMLElement} [optionsEl] */
        function setAutoSwitchVisualEnabled(checked, optionsEl) {
            appState.mutate('vizConfig', cfg => { cfg.autoSwitchVisualEnabled = checked; });
            if (optionsEl) optionsEl.classList.toggle('hidden', !checked);
        }

        /** Core thuần: ứng với select "Cách chọn kiểu kế tiếp" (sequential/random). Batch D3 — BỎ `saveConfig()`. */
        function setAutoSwitchVisualMode(value) {
            appState.mutate('vizConfig', cfg => { cfg.autoSwitchVisualMode = value; });
        }

        /** Core thuần: ứng với select "Cách tính thời gian" (fixed/random/duration). Batch D3 — BỎ
         * `syncAutoSwitchTimeModeBlocks()`/`saveConfig()`/`startAutoSwitchVisualBranch()` nội bộ. */
        function setAutoSwitchVisualTimeMode(value) {
            appState.mutate('vizConfig', cfg => { cfg.autoSwitchVisualTimeMode = value; });
        }

        /** Core thuần: ứng với 1 trong 3 input số giây (fieldName tương ứng đúng field vizConfig).
         * Batch D3 — BỎ `saveConfig()`/`startAutoSwitchVisualBranch()` nội bộ. */
        function setAutoSwitchVisualSecondsField(fieldName, rawValue, inputEl) {
            let v = parseInt(rawValue, 10);
            if (!Number.isFinite(v) || v < AUTO_SWITCH_VISUAL_MIN_SECONDS) v = AUTO_SWITCH_VISUAL_MIN_SECONDS;
            if (inputEl) inputEl.value = v;
            appState.mutate('vizConfig', cfg => { cfg[fieldName] = v; });
        }

        // ===================== Liên kết với trạng thái phát nhạc =====================
        // KHÔNG thêm listener 'play'/'pause'/'loadedmetadata' MỚI ở đây (tránh rải listener cho
        // cùng 1 <audio> element ở nhiều file, khó theo dõi thứ tự chạy) — player-controls.js (nơi
        // đã có sẵn các listener đó) sẽ gọi syncAutoSwitchVisualPlayState()/onAutoSwitchVisualSongChanged()
        // trực tiếp trong chính các listener đó. Xem player-controls.js.
