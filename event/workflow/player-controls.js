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
 * NẠP SAU: core/player-controls.js (toggleShuffle, scrollSideLeftToSettingsSmooth/
 * scrollSideLeftToPlaylistSmooth/jumpSideLeftScrollToSettings/revealSideLeftContainer/
 * hideSideLeftContainer/resetSideLeftScrollToPlaylist/validateVideoBgOnClose — VIẾT LẠI
 * 08/07/2026, HOTFIX 8), core/playlist/order.js (updateShuffleArrayFromQueue),
 * core/settings-panel-stack.js (resetSettingsStackToMain), event/virtual-machine-state.js
 * (VirtualMachineState).
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
     * Ứng với 'playerControls.settingsDrawer.open', NHÁNH "đang ở Visualizer" — Router (event/
     * router/player-controls.js) đã tự đọc `appState.get('isVisualizerActive')` MỘT LẦN và chỉ gọi
     * method này khi giá trị đó `=== true` (nhánh "đang ở Playlist" Router gọi THẲNG core
     * `scrollSideLeftToSettingsSmooth()`, không qua Workflow — chỉ 1 hàm, không có bước 2 phụ
     * thuộc).
     *
     * VIẾT LẠI HOÀN TOÀN (08/07/2026, HOTFIX 8, theo đúng quy trình Giang chốt) — 2 BƯỚC NỐI TIẾP,
     * PHỤ THUỘC THỨ TỰ THẬT (bước 2 chỉ chạy nếu bước 1 xác nhận xong bằng giá trị trả về, không
     * phải core tự gọi core):
     *   1. `jumpSideLeftScrollToSettings()` (core) — nhảy cuộn nội bộ sang Settings NGAY (không
     *      animation, vì `#side-left-container` đang ẩn ngoài màn hình, không ai nhìn thấy) — TRẢ
     *      VỀ boolean.
     *   2. CHỈ KHI bước 1 trả `true` -> `revealSideLeftContainer()` (core) — gỡ `playlist-hidden`,
     *      trượt CẢ KHỐI vào lại (animation transform có sẵn) — lúc này bên trong đã sẵn Settings.
     * `isVisualizerActive` GIỮ NGUYÊN `true` suốt quá trình này (KHÔNG đổi ở đây) — chỉ đổi `false`
     * khi thật sự rời Visualizer hẳn qua nút Back riêng (core/player-controls.js::
     * forceBackToPlaylistUI(), không liên quan gì tới Settings).
     */
    openSettingsDrawerFromVisualizer() {
        const jumped = jumpSideLeftScrollToSettings(); // core — trả boolean
        if (jumped) {
            revealSideLeftContainer(); // core — CHỈ chạy khi bước 1 xác nhận xong
        }
    },

    /**
     * Ứng với 'playerControls.settingsDrawer.close', NHÁNH "đang ở Playlist" — `#side-left-
     * container` vẫn đang HIỂN THỊ SẴN suốt lúc đóng (không cần trượt cả khối ra/vào, chỉ cuộn nội
     * bộ về lại trang Playlist). 3 hàm core side-effect nối tiếp (validate video nền + reset ngăn
     * xếp panel con + cuộn về Playlist) — dù không phụ thuộc DỮ LIỆU lẫn nhau, vẫn đúng hình dạng
     * Workflow theo event-bus-flow.md mục 4B ("≥2 lời gọi side-effect nối tiếp... LUÔN Workflow").
     */
    closeSettingsDrawerToPlaylist() {
        validateVideoBgOnClose(); // core
        resetSettingsStackToMain(); // core
        scrollSideLeftToPlaylistSmooth(); // core
    },

    /**
     * Ứng với 'playerControls.settingsDrawer.close', NHÁNH "đang ở Visualizer" — NGƯỢC LẠI đúng
     * quy trình của `openSettingsDrawerFromVisualizer()`:
     *   1. `validateVideoBgOnClose()` + `resetSettingsStackToMain()` (core, như nhánh Playlist).
     *   2. `hideSideLeftContainer()` (core) — thêm lại `playlist-hidden`, trượt CẢ KHỐI ra (về
     *      Visualizer) — TRẢ VỀ boolean.
     *   3. CHỈ KHI bước 2 trả `true` -> xếp lịch qua `taskManager` (Rule 3: taskManager CHỈ được
     *      dùng ở Workflow) đợi ĐÚNG thời lượng animation transform (500ms, khớp 0.5s ở assets/css/
     *      style.css) rồi mới gọi `resetSideLeftScrollToPlaylist()` (core) — an toàn vì lúc này
     *      container đã trượt ra ngoài màn hình hẳn, không ai nhìn thấy bước nhảy cuộn.
     */
    closeSettingsDrawerToVisualizer() {
        validateVideoBgOnClose(); // core
        resetSettingsStackToMain(); // core
        const hidden = hideSideLeftContainer(); // core — trả boolean
        if (hidden) {
            taskManager.once(() => {
                resetSideLeftScrollToPlaylist(); // core — gọi SAU khi animation transform chạy xong hẳn
            }, 500, 'resetSideLeftScrollAfterSettingsToVisualizer');
        }
    },
};
