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
 * NẠP SAU: event/workflow/playlist-order.js (workflowPlaylistOrder.recomputeDisplayOrder/
 * recomputeRenderOrder — dời từ core/playlist/order.js, xem docstring đầu file đó), core/playlist/
 * order.js (updateShuffleArrayFromQueue — vẫn core, thuần), core/playlist/render.js
 * (renderPlaylistDiff), event/workflow/player.js (`workflowPlayer.playMedia()` — [SỬA,
 * plan-playmedia-reorg.md] thay `window.playSong()` cũ), core/dom-refs.js (btnShuffle). NẠP TRƯỚC:
 * event/router/playlist-empty-state.js.
 */
const workflowPlaylistEmptyState = {

    /**
     * Ứng với 'playlistEmptyState.play.click' khi sectionQueueActive=true (xem router) — đưa
     * displayOrder về ĐÚNG top-level (thoát khỏi section — recomputeDisplayOrder() tự đặt
     * sectionQueueActive=false bên trong, xem event/workflow/playlist-order.js) rồi phát tiếp: ưu tiên
     * currentKey nếu bài đang phát vẫn còn hợp lệ trong top-level mới, không thì phát bài đầu.
     */
    resetToTopLevelThenPlay() {
        // SỬA (Giang chỉ ra "không chấp nhận tiền lệ, ngoại lệ") — recomputeDisplayOrder()/
        // recomputeRenderOrder() ĐÃ DỜI hẳn sang event/workflow/playlist-order.js
        // (workflowPlaylistOrder) — gọi trực tiếp, không cần tự gom tham số nữa.
        workflowPlaylistOrder.recomputeDisplayOrder(); // tự đặt sectionQueueActive=false bên trong
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();    // event/workflow/playlist-render.js (dời từ core/playlist/render.js)

        const displayOrder = appState.get('displayOrder');
        updateShuffleArrayFromQueue(displayOrder, appState.get('playlistOrder'), appState.get('isShuffle')); // core mới (order.js) — resync shuffleIndices theo top-level luôn, phòng trường hợp Shuffle đang bật

        if (displayOrder.length === 0) return;
        const currentKey = appState.get('currentKey');
        const stillValid = currentKey != null && displayOrder.includes(currentKey);
        workflowPlayer.playMedia(stillValid ? currentKey : displayOrder[0]); // [SỬA — plan-playmedia-reorg.md] thay window.playSong() cũ
    },

    /**
     * Ứng với 'playlistEmptyState.shuffle.click' khi sectionQueueActive=true (xem router) — đưa
     * displayOrder về ĐÚNG top-level RỒI bật Shuffle (nếu chưa bật) RỒI phát bài đầu hàng đợi
     * shuffle. "Trộn bài" từ nút to LUÔN là trộn TOÀN BỘ top-level (khác Shuffle ở Control Center —
     * playerControls.shuffle.click, event/workflow/player-controls.js — vốn trộn "hiện hành") —
     * đúng CHỐT mục 3a: 2 nút to luôn "chèn lại top-level" khi đang phát 1 section.
     */
    resetToTopLevelThenShuffle() {
        // SỬA — CÙNG LÝ DO resetToTopLevelThenPlay() ngay trên.
        workflowPlaylistOrder.recomputeDisplayOrder(); // tự đặt sectionQueueActive=false bên trong
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();

        if (!appState.get('isShuffle')) {
            btnShuffle.click(); // bấm hộ nút thật -> tự chạy workflowPlayerControls.toggleShuffleAndReshuffle() qua bus, tự bật cờ + tự shuffle theo displayOrder (đã là top-level ở trên)
        } else {
            updateShuffleArrayFromQueue(appState.get('displayOrder'), appState.get('playlistOrder'), true); // đã bật Shuffle sẵn từ trước -> btnShuffle.click() sẽ KHÔNG chạy, tự tay resync theo top-level
        }

        if (appState.get('playlistOrder').length > 0) workflowPlayer.playMedia(appState.get('shuffleIndices')[0]); // [SỬA — plan-playmedia-reorg.md] thay window.playSong() cũ
    },

    /**
     * MỚI (09/09/2026, Giang yêu cầu "ấn Shuffle bất kể trạng thái đều tạo ngẫu nhiên MỚI, kể cả
     * đang phát") — ứng với 'playlistEmptyState.shuffle.click' khi sectionQueueActive=false (nhánh
     * "bình thường", KHÔNG đang phát 1 section con). TRƯỚC ĐÂY (xem git blame/docstring cũ) router
     * gọi thẳng: Shuffle đang TẮT -> bấm hộ `btnShuffle.click()` (tự bật + tự trộn); Shuffle ĐÃ BẬT
     * SẴN -> bỏ qua, chỉ phát lại `shuffleIndices[0]` CŨ — bấm nút to nhiều lần khi đang phát không
     * hề đổi thứ tự. Giờ LUÔN trộn MỚI bất kể trạng thái: Shuffle đang TẮT vẫn bấm hộ nút thật như
     * cũ (tự bật cờ + tự trộn qua toggleShuffleAndReshuffle() — 1 bước, đủ dùng); Shuffle ĐÃ BẬT SẴN
     * thì KHÔNG được bấm hộ nút thật nữa (`toggleShuffleAndReshuffle()` sẽ TẮT cờ đi, sai ý) — tự
     * gọi thẳng `updateShuffleArrayFromQueue()` với cờ `true` cố định (bỏ qua bước toggle), hàm đó
     * luôn dùng `Math.random()` mới nên KẾT QUẢ LUÔN NGẪU NHIÊN LẠI dù cờ không đổi.
     */
    reshuffleTopLevelAlways() {
        if (!appState.get('isShuffle')) {
            btnShuffle.click();
        } else {
            updateShuffleArrayFromQueue(appState.get('displayOrder'), appState.get('playlistOrder'), true); // core (order.js) — gọi THẲNG, KHÔNG qua btnShuffle.click() (sẽ tắt cờ) — cờ true cố định + Math.random() mới bên trong đảm bảo luôn ra thứ tự khác
        }
        if (appState.get('playlistOrder').length > 0) workflowPlayer.playMedia(appState.get('shuffleIndices')[0]);
    },
};
