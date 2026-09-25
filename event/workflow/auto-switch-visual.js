/**
 * event/workflow/auto-switch-visual.js — "THẰNG THỰC THI CUỐI" của router "autoSwitchVisual".
 *
 * MỚI (Batch D3, Settings restructure, 06/07/2026) — TRƯỚC ĐÂY router gọi thẳng core (mỗi
 * msg.type chỉ cần 1 hàm, không cần workflow). GIỜ CẦN workflow vì core/auto-switch-visual.js đã
 * refactor Rule 1-4 đầy đủ (bỏ `saveConfig()`/`updateCycleModeButtonState()`/
 * `startAutoSwitchVisualBranch()`/`syncAutoSwitchTimeModeBlocks()` nội bộ) — mọi msg.type giờ là
 * >1 hàm core nối tiếp.
 *
 * [MỚI — 25/09/2026, dọn nợ readme/task-manager-conventions.md mục 6, cùng đợt "ẩn tab/PWA dừng render Visualizer"]
 * Toàn bộ phần ĐIỀU PHỐI 2 nhánh (taskManager, đọc appState, áp visual + lưu config) dời từ core/auto-switch-visual.js
 * về ĐÂY theo đúng mẫu mục 5 của tài liệu đó — core giờ chỉ còn hàm thuần (pickNextAutoSwitchVisualType,
 * computeAutoSwitchVisualTimerDelayMs, buildAutoSwitchVisualMarks, findAutoSwitchVisualMarkIndex). Hành vi 2 nhánh GIỮ
 * NGUYÊN, chỉ THÊM 1 điều kiện chạy: `_isRunAllowed()` = Song đang phát VÀ app KHÔNG ở chế độ nền
 * (`isBackgroundSuspended`, event/workflow/app-visibility.js) -> ẩn app thì đồng hồ/mốc đổi hiệu ứng đứng yên, kể cả khi
 * Song tự Next giữa lúc ẩn (sự kiện 'play' của bài mới gọi `syncPlayState()` cũng đọc điều kiện này).
 * Điểm gọi (thay các lời gọi core cũ):
 *   - `syncPlayState()` — event/workflow/player-controls.js (handleAudioPlayEvent/handleAudioPauseEvent),
 *     event/workflow/app-visibility.js (vào/ra chế độ nền).
 *   - `onSongChanged()` — event/workflow/player-controls.js::handleAudioLoadedMetadataEvent().
 *   - `killAllTasks()` — event/workflow/playlist.js, event/workflow/file-manager-storage.js (xoá bài đang phát/Clear all).
 *   - `startBranch()` — 3 setter Settings ngay dưới.
 *
 * NẠP SAU: core/auto-switch-visual.js, core/config.js (saveConfig, MODES), core/visualizer/visualizer-display.js
 * (updateTypeUI), service/task-manager.js, core/dom-refs.js (audioPlayer).
 */
const AUTO_SWITCH_VISUAL_TASK_TIMER = 'autoSwitchVisualTimer';   // nhánh 1 (fixed/random) — đồng hồ độc lập
const AUTO_SWITCH_VISUAL_TASK_MARKS = 'autoSwitchVisualMarks';   // nhánh 2 (duration) — tick theo mốc bài hát

const workflowAutoSwitchVisual = {

    setEnabled(checked, optionsEl) {
        setAutoSwitchVisualEnabled(checked, optionsEl);
        saveConfig();
        updateCycleModeButtonState(); // khoá/mở #btn-cycle-mode NGAY khi người dùng bật/tắt
        updateVisualizerTypeSelectState(); // FIX BUG 19/07/2026 (mục 5) — khoá luôn select "Kiểu hiệu ứng"
        this.startBranch(); // bật -> khởi động đúng nhánh; tắt -> tự kill hết
    },

    setMode(value) {
        setAutoSwitchVisualMode(value);
        saveConfig();
        // KHÔNG cần khởi động lại gì — đổi cách CHỌN MỚI chỉ ảnh hưởng lần CHỌN MỚI kế tiếp.
    },

    setTimeMode(value, blockFixedEl, blockRandomEl, blockDurationEl) {
        setAutoSwitchVisualTimeMode(value);
        syncAutoSwitchTimeModeBlocks(value, blockFixedEl, blockRandomEl, blockDurationEl);
        saveConfig();
        this.startBranch(); // đổi NHÁNH hẳn -> kill nhánh cũ, khởi động nhánh mới từ đầu
    },

    setSecondsField(fieldName, rawValue, inputEl) {
        setAutoSwitchVisualSecondsField(fieldName, rawValue, inputEl);
        saveConfig();
        this.startBranch(); // đổi X giây -> áp dụng lại từ đầu cho nhánh đang chạy
    },

    // ===================== Điều phối 2 nhánh (dời từ core 25/09/2026) =====================

    /** Đồng hồ/mốc được phép chạy: Song đang phát thật + app không ở chế độ nền. */
    _isRunAllowed() {
        return !audioPlayer.paused && !appState.get('isBackgroundSuspended');
    },

    /** Tên task của nhánh đang cấu hình. @param {object} cfg */
    _taskNameFor(cfg) {
        return cfg.autoSwitchVisualTimeMode === 'duration' ? AUTO_SWITCH_VISUAL_TASK_MARKS : AUTO_SWITCH_VISUAL_TASK_TIMER;
    },

    /** Chọn kiểu kế tiếp theo cấu hình hiện tại (core thuần). */
    _pickNextType() {
        return pickNextAutoSwitchVisualType(appState.get('currentModeIndex'), appConfigViz.getAll().autoSwitchVisualMode); // core/auto-switch-visual.js
    },

    /** Áp 1 kiểu hiệu ứng đã biết (type lạ hoặc trùng kiểu hiện tại -> bỏ qua) + vẽ lại UI + lưu config. */
    _applyType(type) {
        const idx = MODES.indexOf(type);
        if (idx === -1 || idx === appState.get('currentModeIndex')) return;
        appState.set('currentModeIndex', idx);
        console.log(`writer: "workflowAutoSwitchVisual._applyType", page: "currentModeIndex", content: "${idx} (${type})"`);
        updateTypeUI(); // core/visualizer/visualizer-display.js
        saveConfig(); // core/config.js
    },

    /** NHÁNH 1 — đặt lịch cho VÒNG ĐẾM KẾ TIẾP (task count:1, mỗi vòng 1 delay — 'random' đổi delay mỗi vòng). */
    _scheduleNextTimer() {
        taskManager.kill(AUTO_SWITCH_VISUAL_TASK_TIMER);
        taskManager.addNew(AUTO_SWITCH_VISUAL_TASK_TIMER, {
            time: computeAutoSwitchVisualTimerDelayMs(appConfigViz.getAll()), // core/auto-switch-visual.js
            exe: () => this._onTimerFired(),
            mode: 'timeout',
            count: 1,
        });
        taskManager.operator(AUTO_SWITCH_VISUAL_TASK_TIMER, 'enabled');
    },

    /** NHÁNH 1 — hết 1 vòng: đổi hiệu ứng rồi tái tạo vòng mới nếu vẫn đúng nhánh 1. Không được phép chạy lúc này
     * (vừa pause/ẩn app đúng lúc) -> vẫn tái tạo nhưng pause ngay, để `syncPlayState()` sau này resume được (bản cũ bỏ
     * hẳn không tái tạo -> task count:1 đã tự tắt nằm lại trong plan, resume() no-op, đồng hồ chết tới khi đổi Settings). */
    _onTimerFired() {
        this._applyType(this._pickNextType());
        const cfg = appConfigViz.getAll();
        if (!cfg.autoSwitchVisualEnabled || cfg.autoSwitchVisualTimeMode === 'duration') return;
        this._scheduleNextTimer();
        if (!this._isRunAllowed()) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER);
    },

    /** NHÁNH 2 — tick mỗi giây: tìm mốc currentTime đang thuộc; lần đầu qua mốc thì chọn kiểu MỚI và ghi nhớ vào mốc,
     * các lần sau (kể cả tua lùi) áp LẠI đúng kiểu đã nhớ. */
    _marksTick() {
        const marks = appState.get('autoSwitchVisualMarks');
        if (marks.length === 0) return;
        const idx = findAutoSwitchVisualMarkIndex(marks, audioPlayer.currentTime); // core/auto-switch-visual.js
        const mark = marks[idx];
        if (mark.visual === null) {
            const type = this._pickNextType();
            appState.mutate('autoSwitchVisualMarks', (arr) => { arr[idx].visual = type; });
            console.log(`writer: "workflowAutoSwitchVisual._marksTick", page: "autoSwitchVisualMarks", content: "mark[${idx}].visual=${type}"`);
            this._applyType(type);
        } else {
            this._applyType(mark.visual);
        }
    },

    /** Dừng/dọn CẢ HAI task — tắt tính năng/xoá bài đang phát/Clear all. */
    killAllTasks() {
        taskManager.kill(AUTO_SWITCH_VISUAL_TASK_TIMER);
        taskManager.kill(AUTO_SWITCH_VISUAL_TASK_MARKS);
    },

    /** Bắt đầu ĐÚNG 1 nhánh theo cấu hình (luôn kill cả 2 trước — không bao giờ 2 nhánh song song). Chưa được phép chạy
     * -> đăng ký xong pause ngay (chờ `syncPlayState()`). */
    startBranch() {
        this.killAllTasks();
        const cfg = appConfigViz.getAll();
        const currentKey = appState.get('currentKey');
        if (!cfg.autoSwitchVisualEnabled || !currentKey) return;

        if (cfg.autoSwitchVisualTimeMode === 'duration') {
            const { marks, complete } = buildAutoSwitchVisualMarks(audioPlayer.duration, MODES[appState.get('currentModeIndex')], cfg.autoSwitchVisualSecondsDuration); // core/auto-switch-visual.js
            appState.set('autoSwitchVisualMarks', marks);
            console.log(`writer: "workflowAutoSwitchVisual.startBranch", page: "autoSwitchVisualMarks", content: "${marks.length} mốc${complete ? '' : ' (chưa có duration)'}"`);
            // Chỉ đánh dấu khi build ĐỦ mốc — xem docstring buildAutoSwitchVisualMarks() (FIX 13/07/2026).
            if (complete) {
                appState.set('_lastMarksBuiltForKey', currentKey);
                console.log(`writer: "workflowAutoSwitchVisual.startBranch", page: "_lastMarksBuiltForKey", content: "${currentKey}"`);
            }
            taskManager.addNew(AUTO_SWITCH_VISUAL_TASK_MARKS, { time: 1000, exe: () => this._marksTick(), mode: 'timeout', count: 0 });
            taskManager.operator(AUTO_SWITCH_VISUAL_TASK_MARKS, 'enabled');
            if (!this._isRunAllowed()) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_MARKS);
        } else {
            this._scheduleNextTimer();
            if (!this._isRunAllowed()) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER);
        }
    },

    /** Đổi bài (loadedmetadata) — CHỈ nhánh 2 build lại mốc, và chỉ khi CHƯA build đủ cho đúng bài này ('play' bắn
     * TRƯỚC 'loadedmetadata' có thể đã build rồi). Nhánh 1 không reset khi đổi bài (đặc điểm cốt lõi). */
    onSongChanged() {
        if (appConfigViz.getAll().autoSwitchVisualTimeMode === 'duration' && appState.get('_lastMarksBuiltForKey') !== appState.get('currentKey')) {
            this.startBranch();
        }
    },

    /** Song play/pause hoặc app vào/ra chế độ nền — pause/resume ĐÚNG task của nhánh đang chạy; chưa từng bắt đầu ->
     * bắt đầu mới; tính năng tắt/không có bài -> kill hết. */
    syncPlayState() {
        const cfg = appConfigViz.getAll();
        if (!cfg.autoSwitchVisualEnabled || !appState.get('currentKey')) { this.killAllTasks(); return; }
        const taskName = this._taskNameFor(cfg);
        if (!taskManager.plan[taskName]) { this.startBranch(); return; }
        if (this._isRunAllowed()) taskManager.resume(taskName);
        else taskManager.pause(taskName);
    },
};
