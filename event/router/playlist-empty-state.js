/**
 * event/router/playlist-empty-state.js — Router tên "playlistEmptyState".
 *
 * SỬA (fix 03/07/2026, mục 3a yêu cầu) — 2 msg.type giờ CẦN đọc appState.sectionQueueActive để
 * quyết định "chèn lại top-level trước khi phát" hay "phát thẳng như cũ" -> BẮT BUỘC qua
 * VirtualMachineState (event-bus-flow.md mục 4C — mọi rẽ nhánh theo state, kể cả đơn đích, không
 * viết if/else tay đọc appState trong case nữa). Nhánh sectionQueueActive=true giao
 * event/workflow/playlist-empty-state.js (Workflow — chuỗi ≥2 bước phụ thuộc thứ tự).
 *
 * SỬA (09/09/2026, Giang yêu cầu 2 việc):
 *   1. "Gộp nút icon visualizer riêng vào nút Phát" — #btn-return-visual (icon nhấp nháy ở header)
 *      ĐÃ XOÁ hẳn. `playlistEmptyState.play.click` giờ rẽ nhánh THÊM 1 tầng qua
 *      `btnPlaylistEmptyPlay.dataset.playing` (tự đồng bộ bởi updatePlayButtonPlayingState(),
 *      core/playlist/render.js) TRƯỚC khi xét sectionQueueActive như cũ: đang "Đang phát" -> gọi
 *      thẳng `returnToVisualizer()` (core/visualizer-control-center.js), KHÔNG phát lại.
 *   2. "Ấn Shuffle bất kể trạng thái đều tạo ngẫu nhiên mới" — nhánh sectionQueueActive=false của
 *      `playlistEmptyState.shuffle.click` KHÔNG còn gọi thẳng tại đây (hành vi cũ: Shuffle đã bật
 *      sẵn thì bấm lại không đổi gì) — giao hẳn `workflowPlaylistEmptyState.
 *      reshuffleTopLevelAlways()` (Workflow, xem docstring hàm đó — luôn trộn MỚI bất kể trạng thái
 *      Shuffle hiện tại).
 *
 * NẠP SAU: event/workflow/playlist-empty-state.js, event/workflow/player.js (cần
 * `workflowPlayer.playMedia()`), core/visualizer-control-center.js (cần `returnToVisualizer()`).
 */
const routerPlaylistEmptyState = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'playlistEmptyState.play.click': {
                // MỚI (09/09/2026, Giang yêu cầu "gộp nút icon visualizer riêng vào nút Phát") —
                // nút đang ở trạng thái "Đang phát" (dataset.playing, tự đồng bộ bởi
                // updatePlayButtonPlayingState(), core/playlist/render.js) -> bấm vào CHUYỂN SANG
                // Visualizer, KHÔNG phát lại từ đầu. Đọc thẳng dataset (đã tính sẵn, không cần suy
                // lại currentKey/displayOrder ở đây — đúng vai trò Router "chỉ đọc state để rẽ
                // nhánh", không tính toán nghiệp vụ).
                const isPlayingState = btnPlaylistEmptyPlay.dataset.playing === 'true';
                VirtualMachineState.run([
                    { state: isPlayingState, operation: '===', value: true, callback: () => returnToVisualizer() }, // core/visualizer-control-center.js
                    { state: isPlayingState, operation: '===', value: false, callback: () => {
                        const sectionActive = appState.get('sectionQueueActive');
                        VirtualMachineState.run([
                            { state: sectionActive, operation: '===', value: true, callback: () => workflowPlaylistEmptyState.resetToTopLevelThenPlay() },
                            { state: sectionActive, operation: '===', value: false, callback: () => {
                                const displayOrder = appState.get('displayOrder');
                                if (displayOrder.length > 0) workflowPlayer.playMedia(appState.get('currentKey') || displayOrder[0]);
                            } },
                        ]);
                    } },
                ]);
                break;
            }
            case 'playlistEmptyState.shuffle.click': {
                // SỬA (09/09/2026, Giang yêu cầu "ấn Shuffle bất kể trạng thái đều tạo ngẫu nhiên
                // MỚI, kể cả đang phát") — TRƯỚC ĐÂY chỉ bật+trộn NẾU đang tắt Shuffle (đã bật sẵn
                // thì bấm lại không đổi gì) — giờ LUÔN trộn mới, giao workflowPlaylistEmptyState.
                // reshuffleTopLevelAlways() (≥2 bước: có thể cần bật cờ + LUÔN trộn lại + phát —
                // đúng hình dạng Workflow, không còn gọi thẳng như nhánh sectionActive=false cũ).
                const sectionActive = appState.get('sectionQueueActive');
                VirtualMachineState.run([
                    { state: sectionActive, operation: '===', value: true, callback: () => workflowPlaylistEmptyState.resetToTopLevelThenShuffle() },
                    { state: sectionActive, operation: '===', value: false, callback: () => workflowPlaylistEmptyState.reshuffleTopLevelAlways() },
                ]);
                break;
            }
            default:
                console.warn(`[routerPlaylistEmptyState] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('playlistEmptyState', routerPlaylistEmptyState);
