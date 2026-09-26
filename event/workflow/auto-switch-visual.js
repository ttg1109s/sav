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
 *   - (`onSongChanged()` ĐÃ BỎ 26/09/2026 — thay bằng `onMediaChanged()`, xem khối VIẾT LẠI ngay dưới.)
 *   - `killAllTasks()` — event/workflow/playlist.js, event/workflow/file-manager-storage.js (xoá bài đang phát/Clear all).
 *   - `startBranch()` — 3 setter Settings ngay dưới.
 *
 * NẠP SAU: core/auto-switch-visual.js, core/config.js (saveConfig, MODES), core/visualizer/visualizer-display.js
 * (updateTypeUI), service/task-manager.js, core/dom-refs.js (audioPlayer).
 */
// VIẾT LẠI (26/09/2026, Giang "cải tiến lại Auto-Switch Effect") — 2 nhánh thời gian:
//   - 'fixed' (const | random [min,max]): đồng hồ độc lập qua taskManager (y như nhánh 1 cũ) — chạy khi media đang
//     phát (song/video/photo — trước đây chỉ Song), đứng khi pause/ẩn app, KHÔNG reset khi đổi media.
//   - 'perMedia': KHÔNG task — đổi hiệu ứng mỗi khi 1 media MỚI bắt đầu (`onMediaChanged()`, gọi ngay sau khi
//     currentKey đổi ở event/workflow/player.js / video-player.js / photo-player.js). Media đầu tiên sau khi bật
//     chỉ được ghi nhận, không đổi.
// Nhánh 'duration' (mốc theo độ dài bài) + task marks ĐÃ BỎ. Chọn style kế tiếp theo danh sách group/style
// (core/auto-switch-visual.js). Panel Settings luôn hiện đủ tuỳ chọn; mọi thay đổi cấu trúc vẽ lại panel qua
// workflowAppSettings._renderAutoSwitch() (giữ vị trí cuộn).
const AUTO_SWITCH_VISUAL_TASK_TIMER = 'autoSwitchVisualTimer';

const workflowAutoSwitchVisual = {

    setEnabled(checked) {
        setAutoSwitchVisualEnabled(checked); // core/auto-switch-visual.js
        saveConfig();
        updateCycleModeButtonState(); // làm mờ/bỏ mờ #btn-cycle-mode (click chọn effect bị chặn khi bật)
        updateVisualizerTypeSelectState();
        appState.set('_autoSwitchLastMediaKey', appState.get('currentKey')); // perMedia: media đang phát không tính là "mới"
        this.startBranch();
    },

    setMode(value) {
        setAutoSwitchVisualMode(value);
        saveConfig();
    },

    setTimeMode(value) {
        setAutoSwitchVisualTimeMode(value);
        saveConfig();
        appState.set('_autoSwitchLastMediaKey', appState.get('currentKey'));
        this.startBranch();
        this._rerenderPanel();
    },

    setFixedKind(value) {
        setAutoSwitchVisualFixedKind(value);
        saveConfig();
        this.startBranch();
        this._rerenderPanel();
    },

    setListBy(value) {
        setAutoSwitchVisualListBy(value);
        saveConfig();
        this._rerenderPanel();
    },

    setItemEnabled(listBy, key, checked) {
        this._ensureLists();
        setAutoSwitchVisualItemEnabled(listBy, key, checked);
        saveConfig();
    },

    setGroupStyle(groupKey, style) {
        this._ensureLists();
        setAutoSwitchVisualGroupStyle(groupKey, style);
        saveConfig();
    },

    moveItem(listBy, fromKey, toKey) {
        this._ensureLists();
        moveAutoSwitchVisualItem(listBy, fromKey, toKey);
        saveConfig();
        this._rerenderPanel();
    },

    /** Mở time picker (core/time-picker-modal.js, format giờ-phút-giây, 10s-1h) cho 1 trong 3 field giây. */
    openSecondsPicker(fieldName) {
        const cfg = appConfigViz.getAll();
        openTimePickerModal({
            title: t(`visualizerSettingsDrawer.autoSwitchPicker.${fieldName}`),
            format: 'h-m-s',
            valueMs: (cfg[fieldName] || AUTO_SWITCH_VISUAL_MIN_SECONDS) * 1000,
            minMs: AUTO_SWITCH_VISUAL_MIN_SECONDS * 1000,
            maxMs: AUTO_SWITCH_VISUAL_MAX_SECONDS * 1000,
            onConfirm: (resultMs) => {
                setAutoSwitchVisualSeconds(fieldName, resultMs); // core/auto-switch-visual.js
                console.log(`writer: "workflowAutoSwitchVisual.openSecondsPicker", page: "vizConfig", content: "${fieldName}=${appConfigViz.getAll()[fieldName]}"`);
                saveConfig();
                this.startBranch();
                this._rerenderPanel();
            },
        });
    },

    /** Dữ liệu vẽ panel (components/settings/visualizer-auto-switch-drawer.js) — danh sách đã chuẩn hoá theo
     * registry hiện tại, ĐÚNG thứ tự người dùng xếp. */
    buildPanelModel() {
        const cfg = appConfigViz.getAll();
        const listBy = cfg.autoSwitchVisualListBy === 'group' ? 'group' : 'style';
        const items = listBy === 'group'
            ? normalizeAutoSwitchGroupList(cfg.autoSwitchVisualGroupList, EFFECT_GROUPS) // core/auto-switch-visual.js
            : normalizeAutoSwitchStyleList(cfg.autoSwitchVisualStyleList, MODES);
        return { cfg, listBy, items };
    },

    /** Config cũ/reset có thể chưa có danh sách — chuẩn hoá theo registry hiện tại trước khi sửa từng mục. */
    _ensureLists() {
        appConfigViz.mutateAll((cfg) => {
            cfg.autoSwitchVisualGroupList = normalizeAutoSwitchGroupList(cfg.autoSwitchVisualGroupList, EFFECT_GROUPS); // core/auto-switch-visual.js
            cfg.autoSwitchVisualStyleList = normalizeAutoSwitchStyleList(cfg.autoSwitchVisualStyleList, MODES);
        });
    },

    /** Mở sub panel "Effect list" (danh sách group/style) — đẩy panel chính vào ngăn xếp để Back quay lại. */
    openListPanel() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderAutoSwitchList()); // event/workflow/app-settings.js
    },

    /** Vẽ lại ĐÚNG màn Auto-Switch đang mở — sub panel danh sách hoặc panel chính (giữ vị trí cuộn — cùng scrollKey
     * độ sâu, event/workflow/app-settings.js). Quay lại panel chính từ sub panel tự vẽ lại (số mục tick mới). */
    _rerenderPanel() {
        if (!genericDrawerBody) return;
        if (genericDrawerBody.querySelector('#auto-switch-item-list')) workflowAppSettings._renderAutoSwitchList();
        else if (genericDrawerBody.querySelector('#setting-auto-switch-enable')) workflowAppSettings._renderAutoSwitch();
    },

    // ===================== Điều phối =====================

    /** Media đang phát thật (song / video / photo theo chế độ player hiện tại). MỚI 26/09/2026 — trước đây chỉ Song. */
    _isMediaPlaying() {
        if (appState.get('isPhotoPlayerMode')) return !appState.get('photoPlayerPaused');
        if (appState.get('isVideoPlayerMode')) return !bgVideoElement.paused;
        return !audioPlayer.paused;
    },

    /** Đồng hồ được phép chạy: media đang phát + app không ở chế độ nền. */
    _isRunAllowed() {
        return this._isMediaPlaying() && !appState.get('isBackgroundSuspended');
    },

    /** Style kế tiếp theo danh sách đang chọn (core thuần). null = không mục nào được tick. */
    _pickNextStyle() {
        const cfg = appConfigViz.getAll();
        const currentStyle = MODES[appState.get('currentModeIndex')];
        if (cfg.autoSwitchVisualListBy === 'group') {
            const groupList = normalizeAutoSwitchGroupList(cfg.autoSwitchVisualGroupList, EFFECT_GROUPS); // core/auto-switch-visual.js
            return pickNextAutoSwitchStyleFromGroupList(groupList, cfg.autoSwitchVisualMode, currentStyle, STYLE_TO_GROUP, EFFECT_GROUPS);
        }
        const styleList = normalizeAutoSwitchStyleList(cfg.autoSwitchVisualStyleList, MODES);
        return pickNextAutoSwitchStyleFromStyleList(styleList, cfg.autoSwitchVisualMode, currentStyle);
    },

    /** Áp 1 style (null/trùng style đang chạy -> bỏ qua). SỬA (26/09/2026) — đi qua applyVisualizerStyleChoice()
     * (CÙNG đường chọn tay) để có luôn resizeCanvas() (rain)/updateVortexVisibility() (vortex) — bản cũ thiếu. */
    _applyStyle(style) {
        if (!style || MODES.indexOf(style) === appState.get('currentModeIndex')) return;
        console.log(`writer: "workflowAutoSwitchVisual._applyStyle", page: "currentModeIndex", content: "${style}"`);
        applyVisualizerStyleChoice(style); // core/visualizer/visualizer-display.js
    },

    /** Nhánh 'fixed' — đặt lịch cho VÒNG ĐẾM KẾ TIẾP (task count:1; kiểu random đổi delay mỗi vòng). */
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

    /** Nhánh 'fixed' — hết 1 vòng: đổi hiệu ứng rồi tái tạo vòng mới (không được phép chạy lúc này -> tái tạo
     * nhưng pause ngay, chờ `syncPlayState()`). */
    _onTimerFired() {
        this._applyStyle(this._pickNextStyle());
        const cfg = appConfigViz.getAll();
        if (!cfg.autoSwitchVisualEnabled || cfg.autoSwitchVisualTimeMode !== 'fixed') return;
        this._scheduleNextTimer();
        if (!this._isRunAllowed()) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER);
    },

    /** Dừng/dọn task — tắt tính năng/xoá media đang phát/Clear all. */
    killAllTasks() {
        taskManager.kill(AUTO_SWITCH_VISUAL_TASK_TIMER);
    },

    /** Bắt đầu lại theo cấu hình: 'fixed' -> đồng hồ mới (pause ngay nếu chưa được chạy); 'perMedia' -> không task. */
    startBranch() {
        this.killAllTasks();
        const cfg = appConfigViz.getAll();
        if (!cfg.autoSwitchVisualEnabled || !appState.get('currentKey')) return;
        if (cfg.autoSwitchVisualTimeMode !== 'fixed') return;
        this._scheduleNextTimer();
        if (!this._isRunAllowed()) taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER);
    },

    /** Nhánh 'perMedia' — gọi NGAY SAU khi currentKey đổi sang 1 media mới (song/video/photo). Chỉ đổi khi key khác
     * key đã ghi nhận lần trước (1 media = 1 lần đổi, kể cả khi nhiều sự kiện cùng báo). Không phụ thuộc
     * `isBackgroundSuspended`: media mới bắt đầu thì đổi luôn, lúc quay lại app đã đúng hiệu ứng mới. */
    onMediaChanged() {
        const cfg = appConfigViz.getAll();
        const key = appState.get('currentKey');
        if (!key) return;
        const lastKey = appState.get('_autoSwitchLastMediaKey');
        appState.set('_autoSwitchLastMediaKey', key);
        if (!cfg.autoSwitchVisualEnabled || cfg.autoSwitchVisualTimeMode !== 'perMedia') return;
        if (lastKey === null || lastKey === key) return;
        this._applyStyle(this._pickNextStyle());
    },

    /** Media play/pause (song/video/photo) hoặc app vào/ra chế độ nền — pause/resume đồng hồ 'fixed'; chưa từng
     * bắt đầu -> bắt đầu; tính năng tắt/không có media -> kill. 'perMedia' không có gì để pause. */
    syncPlayState() {
        const cfg = appConfigViz.getAll();
        if (!cfg.autoSwitchVisualEnabled || !appState.get('currentKey') || cfg.autoSwitchVisualTimeMode !== 'fixed') { this.killAllTasks(); return; }
        if (!taskManager.plan[AUTO_SWITCH_VISUAL_TASK_TIMER]) { this.startBranch(); return; }
        if (this._isRunAllowed()) taskManager.resume(AUTO_SWITCH_VISUAL_TASK_TIMER);
        else taskManager.pause(AUTO_SWITCH_VISUAL_TASK_TIMER);
    },
};
