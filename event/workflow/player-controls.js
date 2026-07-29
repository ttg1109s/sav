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
        this._persistPlayerConfig(); // MỚI (phản hồi Giang, mục 3) — nhớ trạng thái Shuffle
    },

    /**
     * Ứng với 'playerControls.repeat.click' — MỚI, tách khỏi router (phản hồi Giang, mục 3 "nhớ
     * trạng thái shuffle/repeat/stats"): trước đây router gọi thẳng `cycleRepeatMode()` (đúng "1
     * hàm core" theo quy ước router này) — giờ cần thêm bước lưu bền (`_persistPlayerConfig()`,
     * async, đụng IndexedDB) NGAY SAU, thành ≥2 bước -> đúng quy ước router "giao cho Workflow"
     * (xem docstring đầu event/router/player-controls.js).
     */
    cycleRepeatModeAndPersist() {
        cycleRepeatMode(); // core có sẵn (core/player-controls.js)
        this._persistPlayerConfig();
    },

    /**
     * Ghi bền 3 icon toggle Control Center (Shuffle/Repeat/Stats — `#btn-shuffle`/`#btn-repeat`/
     * `#btn-toggle-stats-panel`, components/visualizer-overlay.js) vào `appConfigPlayer` +
     * `meta.playerConfig` (IndexedDB) — CÙNG KHUÔN domain 'playlist' (`_persistPlaylistConfig()`,
     * event/workflow/playlist.js) — `setMeta()` trực tiếp mỗi lần đổi, KHÔNG debounce (tần suất
     * đổi thấp, thao tác bấm tay). DÙNG CHUNG bởi `workflowStatsPanel` (event/workflow/
     * stats-panel.js — Workflow gọi Workflow miền khác, tự do) — tránh lặp logic ghi bền ở 2 nơi.
     */
    async _persistPlayerConfig() {
        appConfigPlayer.setAll({
            isShuffle: appState.get('isShuffle'),
            repeatMode: appState.get('repeatMode'),
            isStatsPanelVisible: appState.get('isStatsPanelVisible'),
        });
        await setMeta('playerConfig', appConfigPlayer.getAll());
    },

    /**
     * Khôi phục 3 icon toggle Control Center đã lưu bền LÚC BOOT — gọi từ event/workflow/
     * app-boot.js. Đồng bộ lại UI qua 2 hàm Core MỚI TÁCH RIÊNG (`syncShuffleUI()`/`syncRepeatUI()`,
     * core/player-controls.js) — KHÔNG gọi `toggleShuffle()`/`cycleRepeatMode()` cho việc này vì 2
     * hàm đó LUÔN đảo/xoay ngược giá trị HIỆN TẠI, không "set thẳng" được về giá trị đã lưu.
     * `#stats-panel`/2 icon ẩn-hiện đồng bộ TRỰC TIẾP ở đây (không có hàm Core "set thẳng" riêng
     * sẵn có cho stats panel như 2 icon kia — `toggleStatsPanelVisibility()` cũng LUÔN đảo ngược,
     * cùng lý do — nhưng chỉ 3 dòng classList đơn giản nên viết thẳng tại đây thay vì tách thêm 1
     * hàm Core chỉ dùng đúng 1 chỗ).
     */
    async loadPersistedPlayerConfigOnBoot() {
        const saved = await getMeta('playerConfig');
        if (saved && typeof saved === 'object') {
            appConfigPlayer.mutateAll((cfg) => Object.assign(cfg, saved));
        }
        const cfg = appConfigPlayer.getAll();
        appState.set('isShuffle', !!cfg.isShuffle);
        appState.set('repeatMode', cfg.repeatMode || 0);
        appState.set('isStatsPanelVisible', cfg.isStatsPanelVisible !== false);
        console.log(`writer: "loadPersistedPlayerConfigOnBoot", page: "isShuffle/repeatMode/isStatsPanelVisible", content: "khôi phục từ meta.playerConfig"`);
        syncShuffleUI(appState.get('isShuffle')); // core mới (core/player-controls.js)
        syncRepeatUI(appState.get('repeatMode')); // core mới (core/player-controls.js)
        const visible = appState.get('isStatsPanelVisible');
        if (typeof statsPanel !== 'undefined' && statsPanel) statsPanel.classList.toggle('hidden', !visible);
        if (typeof iconStatsPanelVisible !== 'undefined' && iconStatsPanelVisible) iconStatsPanelVisible.classList.toggle('hidden', !visible);
        if (typeof iconStatsPanelHidden !== 'undefined' && iconStatsPanelHidden) iconStatsPanelHidden.classList.toggle('hidden', visible);
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
