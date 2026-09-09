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
 *      ĐÃ XOÁ hẳn. `playlistEmptyState.play.click` giờ rẽ nhánh THÊM 1 tầng, TỰ TÍNH LẠI trực tiếp
 *      từ `currentKey`/`displayOrder` (ĐÚNG công thức updatePlayButtonPlayingState() dùng để đặt
 *      nhãn nút — core/playlist/render.js, KHÔNG đọc `dataset.playing` cache của nút — SỬA tiếp
 *      cùng ngày, Giang báo bug "hiện Phát nhưng bấm vẫn vào Visualizer": cache lệch nếu lỡ sót 1
 *      đường gọi lại updatePlayButtonPlayingState() sau khi đổi playlist, tự tính lại loại bỏ hẳn
 *      rủi ro đó) TRƯỚC khi xét sectionQueueActive như cũ: đang phát (còn nằm trong displayOrder
 *      hiện hành) -> gọi thẳng `returnToVisualizer()` (core/visualizer-control-center.js), KHÔNG
 *      phát lại.
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
                // SỬA (09/09/2026, Giang báo bug "hiện Play nhưng bấm vẫn vào Visualizer") — TRƯỚC
                // ĐÂY đọc `btnPlaylistEmptyPlay.dataset.playing` (giá trị CACHE, chỉ đúng nếu
                // updatePlayButtonPlayingState() — core/playlist/render.js — vừa được gọi lại đúng
                // lúc trước khi bấm; lỡ sót 1 đường gọi nào đó sau khi đổi playlist là cache lệch
                // khỏi state thật NGAY, dataset vẫn 'true' dù nhãn đã về "Phát"). Giờ TỰ TÍNH LẠI
                // trực tiếp từ `currentKey`/`displayOrder` — ĐÚNG 1 nguồn sự thật DUY NHẤT, y hệt
                // công thức `updatePlayButtonPlayingState()` dùng để đặt nhãn — không còn phụ thuộc
                // cache nào phải nhớ đồng bộ đúng lúc nữa, tự nhiên khớp nhãu 100% mọi lúc.
                const currentKey = appState.get('currentKey');
                const isPlayingState = currentKey != null && appState.get('displayOrder').includes(currentKey);
                VirtualMachineState.run([
                    { state: isPlayingState, operation: '===', value: true, callback: () => returnToVisualizer() }, // core/visualizer-control-center.js
                    { state: isPlayingState, operation: '===', value: false, callback: () => {
                        const sectionActive = appState.get('sectionQueueActive');
                        VirtualMachineState.run([
                            { state: sectionActive, operation: '===', value: true, callback: () => workflowPlaylistEmptyState.resetToTopLevelThenPlay() },
                            { state: sectionActive, operation: '===', value: false, callback: () => {
                                const displayOrder = appState.get('displayOrder');
                                if (displayOrder.length > 0) workflowPlayer.playMedia(currentKey || displayOrder[0]);
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
