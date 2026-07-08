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
 * scrollSideLeftToPlaylistSmooth/validateVideoBgOnClose — HOTFIX 8, dọn lại HOTFIX 11),
 * core/playlist/order.js (updateShuffleArrayFromQueue), core/settings-panel-stack.js
 * (resetSettingsStackToMain).
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
     * Ứng với 'playerControls.settingsDrawer.close' — trước batch HOTFIX 11 (08/07/2026) từng có
     * 2 nhánh ("đang ở Playlist"/"đang ở Visualizer", xem lịch sử ở event/router/player-
     * controls.js) — Settings giờ CHỈ mở được từ Playlist (nút #btn-settings trong Control Center
     * của Visualizer đã bỏ hẳn, xem components/visualizer-overlay.js) nên đóng cũng LUÔN về
     * Playlist, không còn nhánh nào để rẽ — đổi tên lại `closeSettingsDrawer()` cho khớp (trước
     * đây `closeSettingsDrawerToPlaylist()`, phân biệt với `closeSettingsDrawerToVisualizer()` đã
     * xoá).
     *
     * `#side-left-container` vẫn đang HIỂN THỊ SẴN suốt lúc đóng (không cần trượt cả khối ra/vào,
     * chỉ cuộn nội bộ về lại trang Playlist). 3 hàm core side-effect nối tiếp (validate video nền +
     * reset ngăn xếp panel con + cuộn về Playlist) — dù không phụ thuộc DỮ LIỆU lẫn nhau, vẫn đúng
     * hình dạng Workflow theo event-bus-flow.md mục 4B ("≥2 lời gọi side-effect nối tiếp... LUÔN
     * Workflow").
     */
    closeSettingsDrawer() {
        validateVideoBgOnClose(); // core
        resetSettingsStackToMain(); // core
        scrollSideLeftToPlaylistSmooth(); // core
    },
};
