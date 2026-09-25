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
        // [SỬA — 25/09/2026, dọn nợ task-manager-conventions.md mục 6, làm cùng đợt "ẩn tab/PWA dừng render"] Toàn bộ
        // phần ĐIỀU PHỐI (taskManager, đọc appState, start/stop/pause/resume nhánh, áp visual + lưu config) ĐÃ DỜI sang
        // event/workflow/auto-switch-visual.js (workflowAutoSwitchVisual) theo đúng mẫu mục 5 của tài liệu đó. File này
        // giờ CHỈ còn hàm THUẦN (nhận tham số, trả kết quả — Rule 1-3). Hằng tên task AUTO_SWITCH_VISUAL_TASK_TIMER/
        // _MARKS dời theo. Đã XOÁ khỏi đây: applyAutoSwitchVisualType, scheduleNextAutoSwitchVisualTimer,
        // autoSwitchVisualMarksTick, killAllAutoSwitchVisualTasks, startAutoSwitchVisualBranch,
        // onAutoSwitchVisualSongChanged, syncAutoSwitchVisualPlayState (bản Workflow tương ứng: _applyType, _scheduleNextTimer,
        // _marksTick, killAllTasks, startBranch, onSongChanged, syncPlayState). Giải thích cơ chế 2 nhánh ở đầu file VẪN ĐÚNG.

        /** Chọn 1 giá trị MODES MỚI theo cách chọn (KHÔNG tự áp dụng/lưu gì cả).
         * @param {number} currentModeIndex - appState.currentModeIndex hiện tại.
         * @param {'sequential'|'random'} selectMode - vizConfig.autoSwitchVisualMode.
         * @returns {string} 1 phần tử của MODES. */
        function pickNextAutoSwitchVisualType(currentModeIndex, selectMode) {
            if (selectMode === 'random' && MODES.length > 1) {
                let idx = currentModeIndex;
                while (idx === currentModeIndex) idx = Math.floor(Math.random() * MODES.length);
                return MODES[idx];
            }
            return MODES[(currentModeIndex + 1) % MODES.length]; // 'sequential' — đúng cơ chế #btn-cycle-mode
        }

        /** NHÁNH 1 — số ms cho LẦN ĐẾM KẾ TIẾP ('fixed' = khoảng cố định; 'random' = random LẠI mỗi vòng trong
         * [AUTO_SWITCH_VISUAL_MIN_SECONDS, X người điền]).
         * @param {object} cfg - appConfigViz.getAll(). @returns {number} */
        function computeAutoSwitchVisualTimerDelayMs(cfg) {
            if (cfg.autoSwitchVisualTimeMode === 'random') {
                const maxSeconds = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, cfg.autoSwitchVisualSecondsRandom);
                return (AUTO_SWITCH_VISUAL_MIN_SECONDS + Math.random() * (maxSeconds - AUTO_SWITCH_VISUAL_MIN_SECONDS)) * 1000;
            }
            return Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, cfg.autoSwitchVisualSecondsFixed) * 1000;
        }

        /**
         * NHÁNH 2 ('duration') — dựng mảng mốc TUYỆT ĐỐI cho bài đang phát. X (secondsDuration) là SỐ CHIA trong
         * (duration / X), tự kẹp không vượt round(duration/2) để LUÔN có tối thiểu 1 lần đổi giữa bài. Mốc ĐẦU (t=0) giữ
         * NGUYÊN kiểu đang chọn (không coi là 1 lần đổi).
         * `complete` = false khi duration chưa hợp lệ (chỉ có mốc t=0) — nơi gọi KHÔNG được đánh dấu "đã build cho bài
         * này" (FIX 13/07/2026: 'play' bắn TRƯỚC 'loadedmetadata' lúc pipeline còn nguội, duration vẫn NaN — đánh dấu
         * nhầm khiến 'loadedmetadata' bỏ qua rebuild, visual đứng yên hết bài).
         * @param {number} duration - audioPlayer.duration (NaN/0 nếu chưa có).
         * @param {string} currentType - MODES[currentModeIndex].
         * @param {number} secondsDuration - vizConfig.autoSwitchVisualSecondsDuration.
         * @returns {{marks: {time:number, visual:(string|null)}[], complete: boolean}}
         */
        function buildAutoSwitchVisualMarks(duration, currentType, secondsDuration) {
            const marks = [{ time: 0, visual: currentType }];
            if (!(isFinite(duration) && duration > 0)) return { marks, complete: false };
            const maxAllowed = Math.round(duration / 2);
            const step = Math.max(AUTO_SWITCH_VISUAL_MIN_SECONDS, Math.min(secondsDuration, maxAllowed));
            let t = step;
            while (t < duration) { marks.push({ time: t, visual: null }); t += step; }
            return { marks, complete: true };
        }

        /** NHÁNH 2 — index mốc CUỐI CÙNG có time <= t (đoạn currentTime đang thuộc). t vượt mốc cuối -> dừng ở mốc
         * cuối (tự nhiên không "nhảy tiếp" nữa). @param {{time:number}[]} marks @param {number} t @returns {number} */
        function findAutoSwitchVisualMarkIndex(marks, t) {
            let idx = 0;
            for (let i = 0; i < marks.length; i++) {
                if (marks[i].time <= t) idx = i; else break;
            }
            return idx;
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
            const locked = appConfigViz.getAll().autoSwitchVisualEnabled === true;
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
            const locked = appConfigViz.getAll().autoSwitchVisualEnabled === true;
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
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualEnabled = checked; });
            if (optionsEl) optionsEl.classList.toggle('hidden', !checked);
        }

        /** Core thuần: ứng với select "Cách chọn kiểu kế tiếp" (sequential/random). Batch D3 — BỎ `saveConfig()`. */
        function setAutoSwitchVisualMode(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualMode = value; });
        }

        /** Core thuần: ứng với select "Cách tính thời gian" (fixed/random/duration). Batch D3 — BỎ
         * `syncAutoSwitchTimeModeBlocks()`/`saveConfig()`/`startAutoSwitchVisualBranch()` nội bộ. */
        function setAutoSwitchVisualTimeMode(value) {
            appConfigViz.mutateAll(cfg => { cfg.autoSwitchVisualTimeMode = value; });
        }

        /** Core thuần: ứng với 1 trong 3 input số giây (fieldName tương ứng đúng field vizConfig).
         * Batch D3 — BỎ `saveConfig()`/`startAutoSwitchVisualBranch()` nội bộ. */
        function setAutoSwitchVisualSecondsField(fieldName, rawValue, inputEl) {
            let v = parseInt(rawValue, 10);
            if (!Number.isFinite(v) || v < AUTO_SWITCH_VISUAL_MIN_SECONDS) v = AUTO_SWITCH_VISUAL_MIN_SECONDS;
            if (inputEl) inputEl.value = v;
            appConfigViz.mutateAll(cfg => { cfg[fieldName] = v; });
        }

        // ===================== Liên kết với trạng thái phát nhạc =====================
        // SỬA 25/09/2026 — play/pause/loadedmetadata của audioPlayer giờ đi Router -> event/workflow/player-controls.js
        // (handleAudioPlayEvent/handleAudioPauseEvent/handleAudioLoadedMetadataEvent) -> workflowAutoSwitchVisual.
        // syncPlayState()/onSongChanged(); core/player-controls.js KHÔNG còn gọi vào đây nữa.
