/**
 * event/workflow/playlist-scope.js — "THẰNG THỰC THI CUỐI" cho scoping Playlist theo folder.
 * CHỐT 03/07/2026 (đã sửa sau góp ý — VMState KHÔNG nằm ở đây): mỗi method dưới đây ĐƠN TUYẾN,
 * KHÔNG tự chọn nhánh gì cả — nơi GỌI (Router cụm `fileManagerSong`, hoặc boot sequence ở
 * core/visualizer/draw-visualizer.js) chịu trách nhiệm đọc `appState`/`meta` rồi tự quyết định gọi
 * `applyFolderScope(folderId)` hay `clearScope()`, qua `VirtualMachineState.run()`.
 *
 * Dùng CHUNG cho 3 nơi gọi (đảm bảo nhất quán data/UX/UI DOM — đúng yêu cầu bác chốt 03/07/2026):
 *   1. Router `fileManagerSong`, case 'fileManagerSong.folder.applyToPlaylist.click' (bấm "Áp
 *      dụng cho Playlist" trong Folder Detail Drawer).
 *   2. Boot sequence (core/visualizer/draw-visualizer.js), NGAY SAU initPlaylistFromDB() — khôi
 *      phục đúng scope đã lưu trong `meta` (nếu có), gọi TRỰC TIẾP không qua eventBus — cùng quy
 *      ước với chính initPlaylistFromDB()/loadConfig() (lifecycle boot, đứng ngoài /event/).
 *   3. Workflow `fileManagerSong`, method `deleteActiveFolderById()` — xoá xong 1 folder đang là
 *      scope hiện tại thì hoàn nguyên về "Tất cả bài".
 *
 * NẠP SAU: core/playlist/scope.js (loadAllSongs/loadSongsFromFolder), core/db.js (setMeta),
 * core/playlist/order.js (updateShuffleArray/recomputeDisplayOrder/recomputeRenderOrder),
 * core/playlist/render.js (renderPlaylistDiff/updateEmptyState).
 */
const workflowPlaylistScope = {

    /**
     * Áp scope = ĐÚNG 1 folder cụ thể. KHÔNG tự kiểm tra folderId null/undefined — nơi gọi (Router/
     * boot) đã tách nhánh qua VirtualMachineState TRƯỚC khi gọi tới đây, method này chỉ còn ĐÚNG 1
     * kịch bản duy nhất.
     * @param {string} folderId
     */
    async applyFolderScope(folderId) {
        appState.set('activePlayListFolder', folderId);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${folderId}"`);
        await setMeta('activePlayListFolder', folderId); // lưu bền — sống qua F5/resume tab (mục 2, CHỐT 03/07/2026)

        await loadSongsFromFolder(folderId, appState.get('playlistCache'));
        this._refreshPlaylistRender();
    },

    /** Bỏ scope, về "Tất cả bài". Cùng nguyên tắc đơn tuyến như applyFolderScope() ở trên. */
    async clearScope() {
        appState.set('activePlayListFolder', null);
        console.log(`writer: "clearScope", page: "activePlayListFolder", content: "null"`);
        await setMeta('activePlayListFolder', null);

        loadAllSongs(appState.get('playlistCache'));
        this._refreshPlaylistRender();
    },

    /** Chạy lại đúng pipeline render playlist (giống hệt bộ 5 bước cuối initPlaylistFromDB() dùng
     * — CHỦ ĐỘNG lặp lại ở đây thay vì gọi ra initPlaylistFromDB(), vì hàm đó còn làm nhiều việc
     * khác (quét DB, phòng thủ clearingInProgress...) không liên quan tới việc "đổi scope"). */
    _refreshPlaylistRender() {
        updateShuffleArray();
        recomputeDisplayOrder();
        recomputeRenderOrder();
        renderPlaylistDiff();
        updateEmptyState();
    }
};
