/**
 * event/workflow/playlist-empty-state.js — "THẰNG THỰC THI CUỐI" của router "playlistEmptyState"
 * (2 nút to "Phát"/"Trộn bài" ở Hàng 3 header Playlist, #btn-playlist-empty-play/
 * #btn-playlist-empty-shuffle — tên cụm/router "playlistEmptyState" giữ nguyên từ ver 11 dù không
 * còn CHỈ dùng cho trạng thái rỗng, xem comment đầu event/router/playlist-empty-state.js).
 *
 * MỚI (fix 03/07/2026, mục 3a yêu cầu — "section chọn bài -> phát" PHẢI khác "danh sách phát của
 * playlist"): trước đây 2 nút này chỉ cần gọi THẲNG core (đọc displayOrder/playlistOrder rồi
 * playSong(), xem router) — KHÔNG cần workflow. Từ khi "Phát bài đã chọn" (section,
 * event/workflow/playlist.js::playSelectedSongs) có thể ghi đè displayOrder thành 1 tập con, 2 nút
 * to này cần "thoát khỏi" section đó TRƯỚC khi phát/trộn nếu đang active — chuỗi ≥2 bước phụ thuộc
 * thứ tự (reset displayOrder/shuffleIndices/renderOrder/DOM RỒI MỚI playSong) -> đúng hình dạng
 * Workflow (event-bus-flow.md mục 4B). Router (xem event/router/playlist-empty-state.js) tự đọc
 * appState.sectionQueueActive rồi VirtualMachineState chọn: true -> 2 method dưới đây; false -> vẫn
 * gọi thẳng core như cũ (giữ nguyên hành vi gốc khi không có section nào active).
 *
 * NẠP SAU: core/playlist/order.js (recomputeDisplayOrder/updateShuffleArray/recomputeRenderOrder/
 * updateShuffleArrayFromQueue), core/playlist/render.js (renderPlaylistDiff), core/playlist/actions.js
 * (window.playSong — global), core/dom-refs.js (btnShuffle). NẠP TRƯỚC: event/router/playlist-empty-state.js.
 */
const workflowPlaylistEmptyState = {

    /**
     * Ứng với 'playlistEmptyState.play.click' khi sectionQueueActive=true (xem router) — đưa
     * displayOrder về ĐÚNG top-level (thoát khỏi section — recomputeDisplayOrder() tự đặt
     * sectionQueueActive=false bên trong, xem core/playlist/order.js) rồi phát tiếp: ưu tiên
     * currentKey nếu bài đang phát vẫn còn hợp lệ trong top-level mới, không thì phát bài đầu.
     */
    resetToTopLevelThenPlay() {
        recomputeDisplayOrder(); // core có sẵn (order.js) — tự đặt sectionQueueActive=false bên trong
        recomputeRenderOrder();  // core có sẵn (order.js)
        renderPlaylistDiff();    // core có sẵn (render.js)

        const displayOrder = appState.get('displayOrder');
        updateShuffleArrayFromQueue(displayOrder, appState.get('playlistOrder'), appState.get('isShuffle')); // core mới (order.js) — resync shuffleIndices theo top-level luôn, phòng trường hợp Shuffle đang bật

        if (displayOrder.length === 0) return;
        const currentKey = appState.get('currentKey');
        const stillValid = currentKey != null && displayOrder.includes(currentKey);
        window.playSong(stillValid ? currentKey : displayOrder[0]);
    },

    /**
     * Ứng với 'playlistEmptyState.shuffle.click' khi sectionQueueActive=true (xem router) — đưa
     * displayOrder về ĐÚNG top-level RỒI bật Shuffle (nếu chưa bật) RỒI phát bài đầu hàng đợi
     * shuffle. "Trộn bài" từ nút to LUÔN là trộn TOÀN BỘ top-level (khác Shuffle ở Control Center —
     * playerControls.shuffle.click, event/workflow/player-controls.js — vốn trộn "hiện hành") —
     * đúng CHỐT mục 3a: 2 nút to luôn "chèn lại top-level" khi đang phát 1 section.
     */
    resetToTopLevelThenShuffle() {
        recomputeDisplayOrder(); // tự đặt sectionQueueActive=false bên trong
        recomputeRenderOrder();
        renderPlaylistDiff();

        if (!appState.get('isShuffle')) {
            btnShuffle.click(); // bấm hộ nút thật -> tự chạy workflowPlayerControls.toggleShuffleAndReshuffle() qua bus, tự bật cờ + tự shuffle theo displayOrder (đã là top-level ở trên)
        } else {
            updateShuffleArrayFromQueue(appState.get('displayOrder'), appState.get('playlistOrder'), true); // đã bật Shuffle sẵn từ trước -> btnShuffle.click() sẽ KHÔNG chạy, tự tay resync theo top-level
        }

        if (appState.get('playlistOrder').length > 0) window.playSong(appState.get('shuffleIndices')[0]);
    },
};
