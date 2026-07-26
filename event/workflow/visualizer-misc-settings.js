/**
 * event/workflow/visualizer-misc-settings.js — Workflow cụm "visualizerMiscSettings".
 *
 * MỚI (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 14/16). Router
 * TRƯỚC ĐÂY gọi thẳng Core cho cả 2 msg.type — cả hai đều sai theo đúng quy ước hiện hành
 * (readme/event-bus-flow.md mục 4B):
 *   - `visualizerType.change` gọi 2 hàm side-effect nối tiếp (`updateTypeUI()` + `saveConfig()`)
 *     — đúng hình dạng "≥2 lời gọi nối tiếp" bắt buộc Workflow, bất kể đơn giản.
 *   - `keepScreenOn.change` tự đọc `appState` (`vizConfig.keepScreenOn`) để CHỌN gọi
 *     `requestWakeLock()` hay `releaseWakeLock()` — "chuẩn bị state cho Core" tự nó là Workflow,
 *     không có ngoại lệ "chỉ chọn giữa 2 hàm nên khỏi cần". Việc rẽ nhánh dùng
 *     `VirtualMachineState.run()` NGAY TRONG Workflow — cùng pattern đã có sẵn ở
 *     `workflowPlaylist.toggleSelectionMode()` (event/workflow/playlist.js).
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, core/visualizer/visualizer-display.js
 *           (updateTypeUI), core/config.js (saveConfig, MODES, currentModeIndex),
 *           core/wakelock.js (requestWakeLock, releaseWakeLock).
 * NẠP TRƯỚC: event/router/visualizer-misc-settings.js.
 */
const workflowVisualizerMiscSettings = {
    /** Ứng với 'visualizerMiscSettings.visualizerType.change' — đổi kiểu hiệu ứng Visualizer
     * đang active, đồng bộ UI + lưu config. @param {string} value */
    applyVisualizerType(value) {
        const idx = MODES.indexOf(value);
        if (idx === -1) return;
        appState.set('currentModeIndex', idx);
        updateTypeUI(); // core/visualizer/visualizer-display.js
        saveConfig(); // core/config.js
    },

    /** Ứng với 'visualizerMiscSettings.keepScreenOn.change' — bật/tắt giữ màn hình sáng: đồng bộ
     * `vizConfig` + lưu config, RỒI đọc lại giá trị vừa ghi để chọn xin (nếu đang phát nhạc) hay
     * nhả wake lock ngay theo đúng trạng thái mới. @param {boolean} checked */
    setKeepScreenOn(checked) {
        appConfigViz.mutateAll(cfg => { cfg.keepScreenOn = checked; });
        saveConfig(); // core/config.js
        const keepScreenOn = appConfigViz.getAll().keepScreenOn;
        VirtualMachineState.run([
            {
                state: keepScreenOn, operation: '===', value: true, callback: () => {
                    if (typeof audioPlayer !== 'undefined' && !audioPlayer.paused) requestWakeLock(); // core/wakelock.js
                }
            },
            { state: keepScreenOn, operation: '===', value: false, callback: () => releaseWakeLock() }, // core/wakelock.js
        ]);
    },
};
