/**
 * event/workflow/player-controls.js — "THẰNG THỰC THI CUỐI" của router "playerControls".
 *
 * MỚI (fix 03/07/2026, mục 3b yêu cầu — "Nút shuffle trong Control Center phải chỉ random cho
 * playlist hiện hành"). File này TRƯỚC ĐÂY không tồn tại (comment cũ ở event/router/player-controls.js
 * ghi rõ "17 msg.type chỉ cần ĐÚNG 1 HÀM CORE, KHÔNG có workflow") — giờ CẦN vì
 * 'playerControls.shuffle.click' đã đổi hình dạng: toggleShuffle() (core/player-controls.js) giờ
 * đơn tuyến, chỉ đảo cờ + đồng bộ UI, trả về giá trị MỚI; bước "tính lại shuffleIndices theo hiện
 * hành" là 1 lời gọi core THỨ HAI (updateShuffleArrayFromQueue(), core/playlist/order.js) — 2 hàm
 * core nối tiếp, có phụ thuộc thứ tự (bước 2 cần giá trị isShuffle MỚI từ bước 1) -> đúng hình dạng
 * Workflow (event-bus-flow.md mục 4B), không còn "gọi thẳng core" 1 bước như 16 msg.type còn lại
 * của cụm này.
 *
 * NẠP SAU: core/player-controls.js (toggleShuffle, openSettingsDrawer/openSettingsDrawerInstant/
 * closeSettingsDrawer/closeSettingsDrawerToVisualizer/resetSideLeftScrollPosition — MỚI
 * 07/07/2026), core/playlist/order.js (updateShuffleArrayFromQueue), core/settings-panel-stack.js
 * (resetSettingsStackToMain), event/virtual-machine-state.js (VirtualMachineState).
 * NẠP TRƯỚC: event/router/player-controls.js.
 */
const workflowPlayerControls = {

    /**
     * Ứng với 'playerControls.shuffle.click' — đảo Shuffle rồi random lại shuffleIndices dựa trên
     * "hiện hành" (displayOrder tại thời điểm bấm — có thể đang là 1 section vừa chọn-phát qua
     * playSelectedSongs(), event/workflow/playlist.js, KHÁC hẳn top-level playlistOrder). So sánh
     * với 2 nút to "Phát"/"Trộn bài" (event/workflow/playlist-empty-state.js) — 2 nút đó LUÔN ép về
     * top-level trước khi phát/trộn (đúng ý mục 3a), còn Shuffle ở đây LUÔN tôn trọng hiện hành
     * (đúng ý mục 3b) — 2 hành vi khác nhau CHỦ ĐÍCH, không phải thiếu nhất quán.
     */
    toggleShuffleAndReshuffle() {
        const isShuffleCurrent = appState.get('isShuffle');
        const next = toggleShuffle(isShuffleCurrent); // core có sẵn, CÓ return, DÙNG ngay dưới

        const activeQueueKeys = appState.get('displayOrder'); // "hiện hành" — section HOẶC top-level
        const topLevelKeys = appState.get('playlistOrder');
        updateShuffleArrayFromQueue(activeQueueKeys, topLevelKeys, next); // core mới (order.js), Rule 2 nhận qua tham số
    },

    /**
     * Ứng với 'playerControls.settingsDrawer.open' (nút mở Settings, cả 2 nguồn: #btn-settings ở
     * Visualizer / #btn-settings-playlist ở Playlist) — THÊM ở batch 07/07/2026 (phản hồi Giang
     * mục 1 — "Sử dụng vmstate để phân nhánh trong workflow"): TRƯỚC ĐÂY router gọi thẳng
     * `openSettingsDrawer()` (core, 1 hàm). Giờ CẦN rẽ nhánh theo `appState.get('isVisualizerActive')`
     * — đang ở Playlist thì cuộn mượt bình thường; đang ở Visualizer thì phải nhảy thẳng (không
     * animation, vì `#side-left-container` đang ẩn ngoài màn hình) RỒI MỚI trượt cả khối vào (2
     * bước nối tiếp, phụ thuộc thứ tự — đúng hình dạng Workflow, không còn "gọi thẳng core" nữa).
     * Dùng VirtualMachineState (KHÔNG if/else trần) vì 2 nhánh LOẠI TRỪ NHAU dựa trên 1 giá trị
     * appState — đúng khuôn mọi router/workflow khác trong app đã dùng.
     */
    openSettingsDrawer() {
        VirtualMachineState.run([
            { state: appState.get('isVisualizerActive'), operation: '===', value: true, callback: () => {
                openSettingsDrawerInstant(); // core — nhảy thẳng + trượt cả khối vào
            } },
            { state: appState.get('isVisualizerActive'), operation: '===', value: false, callback: () => {
                openSettingsDrawer(); // core cùng tên, gọi trần phân giải theo scope từ vựng (xem lưu ý đặt tên đầu file)
            } },
        ]);
    },

    /**
     * Ứng với 'playerControls.settingsDrawer.close' (nút X, id="close-drawer") — THÊM ở Batch D1
     * (Settings restructure, phản hồi Giang 06/07/2026): TRƯỚC ĐÂY chỉ 1 hàm core
     * (closeSettingsDrawer()) nên router gọi thẳng, KHÔNG cần workflow. Từ Batch D1, cần thêm
     * resetSettingsStackToMain() (core/settings-panel-stack.js) để ngăn xếp panel con LUÔN về Main
     * trước khi khung ngoài ẩn — 2 hàm core nối tiếp, không phụ thuộc giá trị trả về của nhau ->
     * đúng hình dạng Workflow (event-bus-flow.md mục 4B), không còn "gọi thẳng core" 1 bước nữa.
     * VIẾT LẠI (06/07/2026, slider thật) — `resetSettingsStackToMain()` không còn cần tham số
     * title (header đã nằm sẵn trong chính panel Main, không cần "khôi phục" gì cả).
     *
     * VIẾT LẠI TIẾP (07/07/2026, phản hồi Giang mục 1) — rẽ nhánh theo `isVisualizerActive` GIỐNG
     * `openSettingsDrawer()` ở trên: đang ở Visualizer thì trượt cả khối `#side-left-container` ra
     * lại (về Visualizer) RỒI MỚI reset cuộn nội bộ về Playlist SAU KHI animation transform chạy
     * xong hẳn (taskManager — Rule 3 CHỈ Workflow được dùng, core không tự chờ được).
     */
    closeSettingsDrawerAndResetStack() {
        resetSettingsStackToMain();
        VirtualMachineState.run([
            { state: appState.get('isVisualizerActive'), operation: '===', value: true, callback: () => {
                closeSettingsDrawerToVisualizer(); // core — trượt cả khối ra lại (về Visualizer)
                taskManager.once(() => { resetSideLeftScrollPosition(); }, 500, 'resetSideLeftScrollAfterSettingsToVisualizer'); // core, gọi SAU khi animation transform (0.5s, assets/css/style.css) chạy xong hẳn
            } },
            { state: appState.get('isVisualizerActive'), operation: '===', value: false, callback: () => {
                closeSettingsDrawer(); // core cùng tên, gọi trần phân giải theo scope từ vựng
            } },
        ]);
    },
};
