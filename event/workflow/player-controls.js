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
 * scrollSideLeftToPlaylistSmooth/jumpSideLeftScrollToSettings/validateVideoBgOnClose/
 * switchToVisualizer/forceBackToPlaylistUI/setVisualizerActiveFalse — VIẾT LẠI 08/07/2026,
 * HOTFIX 8+9+10), core/playlist/order.js (updateShuffleArrayFromQueue), core/settings-panel-
 * stack.js (resetSettingsStackToMain), event/virtual-machine-state.js (VirtualMachineState).
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
     * VIẾT LẠI (08/07/2026, HOTFIX 10, Giang chỉ ra) — KHÔNG còn `revealSideLeftContainer()` riêng
     * nữa. Từ khi `forceBackToPlaylistUI()` được tách sạch khỏi việc set state (xem docstring đầy
     * đủ ở core/player-controls.js), nó trở thành "trượt cả khối #side-left-container vào + tắt UI
     * Visualizer" THUẦN TUÝ, KHÔNG quan tâm cuộn nội bộ đang là trang nào — TÁI DÙNG được nguyên
     * vẹn ở đây, chỉ khác duy nhất: KHÔNG gọi thêm `setVisualizerActiveFalse()` sau nó (giữ
     * `isVisualizerActive = true` suốt phiên Settings che lên Visualizer — đây chính là lý do
     * DUY NHẤT còn cần method riêng này thay vì Router gọi thẳng `forceBackToPlaylistUI()`).
     *
     * 2 BƯỚC NỐI TIẾP, PHỤ THUỘC THỨ TỰ THẬT (bước 2 chỉ chạy nếu bước 1 xác nhận xong bằng giá
     * trị trả về, không phải core tự gọi core):
     *   1. `jumpSideLeftScrollToSettings()` (core) — nhảy cuộn nội bộ sang Settings NGAY (không
     *      animation, vì `#side-left-container` đang ẩn ngoài màn hình, không ai nhìn thấy) — TRẢ
     *      VỀ boolean.
     *   2. CHỈ KHI bước 1 trả `true` -> `forceBackToPlaylistUI()` (core, TÁI DÙNG) — trượt CẢ KHỐI
     *      vào lại (animation transform có sẵn) — lúc này bên trong đã sẵn Settings, không phải
     *      Playlist.
     */
    openSettingsDrawerFromVisualizer() {
        const jumped = jumpSideLeftScrollToSettings(); // core — trả boolean
        if (jumped) {
            forceBackToPlaylistUI(); // core CÓ SẴN, tái dùng — KHÔNG gọi setVisualizerActiveFalse() theo sau
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
     * Ứng với 'playerControls.settingsDrawer.close', NHÁNH "đang ở Visualizer".
     *
     * VIẾT LẠI (08/07/2026, HOTFIX 9, Giang chỉ ra bản HOTFIX 8 tự vẽ thêm việc) — KHÔNG viết hàm
     * "hide + trả boolean" mới nữa. Tái dùng THẲNG 2 core CÓ SẴN, dùng cho đúng mục đích gốc của
     * chúng:
     *   1. `validateVideoBgOnClose()` + `resetSettingsStackToMain()` (core, như nhánh Playlist).
     *   2. `scrollSideLeftToPlaylistSmooth()` (core CÓ SẴN — chính hàm nhánh "đang ở Playlist" của
     *      msg.type này cũng dùng) — cuộn MƯỢT `#side-left-container` (lúc này vẫn đang HIỂN THỊ)
     *      về lại trang Playlist. Người dùng sẽ thấy Playlist thoáng qua đúng 1 nhịp trước khi cả
     *      khối trượt ra — CHỦ Ý, không phải bug, để bước 3 dưới đây luôn xuất phát từ đúng trạng
     *      thái "Playlist đang hiện" mà nó vốn được viết ra để xử lý.
     *   3. Đợi cuộn mượt chạy xong (native `scrollTo({behavior:'smooth'})` không có CSS duration cố
     *      định để canh chính xác như animation transform 0.5s — 400ms là ước lượng đủ an toàn cho
     *      quãng cuộn 1 màn hình, có thể chỉnh nếu đo thực tế lệch nhiều) rồi gọi
     *      `switchToVisualizer()` (core CÓ SẴN, dùng khi bấm bài hát ở core/playlist/actions.js) —
     *      TÁI DÙNG NGUYÊN VẸN, không bóc tách gì thêm. Hàm này tiện thể set lại
     *      `isVisualizerActive = true` — VÔ HẠI TUYỆT ĐỐI ở đây vì giá trị ĐÃ LÀ `true` từ trước
     *      (đúng điều kiện để nhánh này được chọn) — và tiện thể re-add `visualizer-active`/gỡ
     *      `hidden` trên visualizerUI/playerContainer — CŨNG VÔ HẠI vì suốt lúc Settings che lên,
     *      Visualizer chưa từng bị gỡ 2 class đó (canvas vẫn chạy ngầm nguyên vẹn) — mọi thao tác
     *      classList ở đây đều là ghi đè ĐÚNG giá trị đã có, không phải trạng thái mới.
     */
    closeSettingsDrawerToVisualizer() {
        validateVideoBgOnClose(); // core
        resetSettingsStackToMain(); // core
        scrollSideLeftToPlaylistSmooth(); // core CÓ SẴN — tái dùng, KHÔNG viết core "hide" riêng
        taskManager.once(() => {
            switchToVisualizer(); // core CÓ SẴN — tái dùng NGUYÊN VẸN, trượt cả khối ra + về Visualizer
        }, 400, 'switchToVisualizerAfterSettingsScrollBack');
    },
};
