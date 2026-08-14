/**
 * event/workflow/playlist-scope.js — "THẰNG THỰC THI CUỐI" cho scoping Playlist theo folder.
 *
 * SỬA LẠI 03/07/2026 (đợt 3, tinh chỉnh thêm ở đợt 4): tách bạch RÕ 2 việc trước đây gộp chung
 * trong 1 lần gọi ("ghi nhận Ý ĐỊNH scope mới" + "áp dụng THẬT vào playlistOrder/DOM đang chạy"):
 *   - `persistScopeChoice(folderId)` — cập nhật `appState.activePlayListFolder` (để badge/nút
 *     trong UI phản ánh đúng NGAY LẬP TỨC) + lưu bền vào `meta` (để sống qua F5/reload) — nhưng
 *     KHÔNG đụng `playlistOrder`/`displayOrder`/`renderOrder`/DOM danh sách bài — Playlist ĐANG
 *     hiển thị vẫn giữ nguyên nội dung cũ cho tới khi thật sự tải lại trang.
 *   - `applyFolderScope(folderId)` — áp THẬT vào `playlistOrder`/DOM. CHỈ còn 1 nơi gọi duy nhất:
 *     boot sequence (core/visualizer/draw-visualizer.js), NGAY SAU initPlaylistFromDB().
 *   - `askReloadToApplyNow(bodyText)` — modal dùng CHUNG, hỏi "tải lại trang để áp dụng ngay
 *     không?" — "Có" = `location.reload()` (boot sequence tự áp dụng lại đúng scope MỚI đã lưu ở
 *     persistScopeChoice() — không cần tự tay dọn audio/object URL/DOM/đưa UI về Playlist nữa,
 *     reload lo sạch toàn bộ). "Không" = không làm gì thêm, phiên đang chạy giữ nguyên hiện trạng.
 *
 * LÝ DO tách: trước đây `applyFolderScope()`/`clearScope()` tự làm cả 2 việc cùng lúc — nghĩa là
 * mọi thao tác đổi scope (bấm Áp dụng, xoá folder đang active, gỡ/thêm bài vào folder đang active)
 * đều LẶNG LẼ patch DOM/hàng đợi phát ngay lập tức, kể cả khi đang phát 1 bài ngoài scope mới (bài
 * đó biến mất khỏi list dù vẫn đang kêu — dễ gây khó hiểu, xem trao đổi 03/07/2026). Giờ CHỈ boot
 * (tải trang) mới thật sự "áp dụng" — mọi nơi khác chỉ LƯU lựa chọn rồi HỎI trước khi tải lại.
 *
 * `clearScope()` (bản cũ) ĐÃ XOÁ — không còn nơi nào gọi tới sau khi deleteActiveFolderById()
 * chuyển sang persistScopeChoice(null) + askReloadToApplyNow() (xem
 * event/workflow/file-manager-song.js).
 *
 * NẠP SAU: core/playlist/scope.js (loadAllSongs/loadSongsFromFolder), service/db.js (setMeta),
 * core/playlist/order.js (updateShuffleArray/recomputeDisplayOrder/recomputeRenderOrder),
 * core/playlist/render.js (renderPlaylistDiff/updateEmptyState), core/modal-choice.js (modalChoice),
 * core/file-manager/folder.js (getExcludedSongKeysFromFolders() — MỚI, Batch 4, dùng bởi
 * applyAllSongsScope()), core/playlist/filter.js (applyPlaylistFilter() — MỚI, mục 1d).
 */
const workflowPlaylistScope = {

    /**
     * Lưu bền lựa chọn scope mới vào `meta` VÀ cập nhật `appState.activePlayListFolder` (bookkeeping
     * "ý định hiện tại", để badge/nút trong UI phản ánh đúng NGAY — xem folder-list-ui.js/
     * folder-detail-ui.js) — KHÔNG đụng `playlistOrder`/DOM Playlist thật (đó là việc RIÊNG của
     * applyFolderScope(), chỉ chạy lúc boot). Dùng ở MỌI nơi thay đổi scope NGOÀI boot (bấm "Áp
     * dụng"/"Bỏ áp dụng" cho Playlist, xoá folder đang active, folder tự trống) — luôn đi kèm
     * `askReloadToApplyNow()` ngay sau, để người dùng tự quyết có muốn thấy kết quả ngay hay không.
     * @param {string|null} folderId - null = bỏ scope (về "Tất cả bài")
     */
    async persistScopeChoice(folderId) {
        appState.set('activePlayListFolder', folderId ?? null);
        console.log(`writer: "persistScopeChoice", page: "activePlayListFolder", content: "${folderId ?? 'null'}"`);
        await setMeta('activePlayListFolder', folderId ?? null);
        // MỚI (phản hồi Giang, mục 5 — "thêm dòng folder đang active source" + mục 2 — "khoá đổi
        // Nguồn khi có Scope") — phản ánh đúng NGAY ở Settings → Playlist, không cần đợi reload
        // (đúng tinh thần "badge phản ánh đúng NGAY" đã ghi ở docstring hàm này).
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderUI();
    },

    /**
     * Áp scope NGAY vào phiên đang chạy (RAM + DOM) — CHỈ dùng lúc BOOT (đọc lại đúng scope đã lưu
     * ở persistScopeChoice() từ phiên trước, xem core/visualizer/draw-visualizer.js). KHÔNG tự
     * setMeta() nữa — lưu là việc RIÊNG của persistScopeChoice(), method này chỉ lo phần "hiển thị
     * đúng theo state đã lưu sẵn".
     * @param {string} folderId
     */
    async applyFolderScope(folderId) {
        appState.set('activePlayListFolder', folderId);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${folderId}"`);

        await loadSongsFromFolder(folderId, appState.get('playlistCache'));
        // MỚI (mục 1d, Playlist Filter) — áp filter (nếu có) NGAY SAU khi playlistOrder vừa được
        // Scope tính lại theo folder, TRƯỚC updateShuffleArray()/recompute*Order() — xem docstring
        // đầu core/playlist/filter.js.
        const source = appState.get('activeMediaSource');
        const beforeCount = appState.get('playlistOrder').length; // MỚI (mục 2, log) — số lượng TRƯỚC khi lọc, để so log rõ ràng
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('songStatsMap'), appState.get('playlistFilterConfig')[source]);
        appState.set('playlistOrder', filteredKeys);
        // MỚI (mục 2, phản hồi Giang — "thêm log của filter xem") — log NGAY sau khi ghi
        // playlistOrder, TRƯỚC updateShuffleArray()/recompute*Order() — nếu boot bị treo NGAY SAU
        // dòng này thì chắc chắn KHÔNG phải do applyPlaylistFilter(), mà do 1 trong 4 hàm ngay dưới.
        console.log(`writer: "applyFolderScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${source})"`);
        updateShuffleArray();
        recomputeDisplayOrder();
        recomputeRenderOrder();
        renderPlaylistDiff();
        updateEmptyState();
    },

    /**
     * Áp "Tất cả bài" NGAY vào phiên đang chạy (RAM + DOM), có lọc Exclude — CHỈ dùng lúc BOOT khi
     * KHÔNG có `activePlayListFolder` đã lưu (đối xứng applyFolderScope() ngay trên, xem
     * event/workflow/app-boot.js). MỚI (Batch 4, "Song/Video Unification" mục 5) — TRƯỚC batch này
     * nhánh "không có scope" của boot sequence là no-op (initPlaylistFromDB() tự nạp playlistOrder
     * = toàn bộ playlistCache rồi, loadAllSongs() lúc đó CHƯA từng có nơi gọi) — giờ CẦN chạy lại
     * để Exclude (mới, chỉ ảnh hưởng view "Tất cả") có tác dụng đúng ngay từ lúc boot.
     */
    async applyAllSongsScope() {
        const excludedKeys = await getExcludedSongKeysFromFolders(); // core/file-manager/folder.js
        loadAllSongs(appState.get('playlistCache'), excludedKeys); // core/playlist/scope.js
        // MỚI (mục 1d, Playlist Filter) — CÙNG LÝ DO applyFolderScope() ngay trên.
        const source = appState.get('activeMediaSource');
        const beforeCount = appState.get('playlistOrder').length; // MỚI (mục 2, log)
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('songStatsMap'), appState.get('playlistFilterConfig')[source]);
        appState.set('playlistOrder', filteredKeys);
        // MỚI (mục 2, phản hồi Giang — "thêm log của filter xem") — CÙNG LÝ DO applyFolderScope().
        console.log(`writer: "applyAllSongsScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${source})"`);

        updateShuffleArray();
        recomputeDisplayOrder();
        recomputeRenderOrder();
        renderPlaylistDiff();
        updateEmptyState();
    },

    /**
     * Modal DÙNG CHUNG — hỏi "tải lại trang để áp dụng ngay không?", gọi NGAY SAU
     * persistScopeChoice() ở mọi nơi cần. "Có" = reload (áp dụng thật qua boot sequence, tự dọn
     * sạch mọi state/DOM/audio đang phát — không cần tự tay xử lý gì thêm ở đây). "Không" = không
     * làm gì, giữ nguyên phiên đang chạy.
     * @param {string} bodyText - nội dung mô tả CỤ THỂ vừa lưu gì (khác nhau tuỳ nơi gọi)
     */
    askReloadToApplyNow(bodyText) {
        modalChoice(
            bodyText,
            [
                { label: t('fileManager.song.folderDetail.reloadBtnNo'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.song.folderDetail.reloadBtnNow'), className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors', onClick: () => { window.location.reload(); } }
            ],
            { title: t('fileManager.song.folderDetail.reloadTitle') }
        );
    }
};
