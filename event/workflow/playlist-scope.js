/**
 * event/workflow/playlist-scope.js — "THẰNG THỰC THI CUỐI" cho scoping Playlist theo folder.
 *
 * SỬA LẠI 06/09/2026 (Giang chốt "bỏ hỏi reload, áp sống luôn" + "mỗi Nguồn tự nhớ folder riêng")
 * — thay thế HẲN mô hình cũ (03/07/2026, đợt 3/4: tách "lưu ý định" khỏi "áp dụng thật", mọi nơi
 * NGOÀI boot chỉ lưu rồi hỏi tải lại trang qua `askReloadToApplyNow()`):
 *   - `persistScopeChoice(folderId, mediaType)` — cập nhật ĐÚNG field `mediaType` trong object
 *     `appState.activePlayListFolder` (`{song,video,photo}`, xem service/state/file-manager.js) +
 *     lưu bền `meta` — vẫn KHÔNG tự đụng `playlistOrder`/DOM, đó là việc của 2 hàm dưới.
 *   - `applyFolderScope(folderId, mediaType)`/`applyAllSongsScope(mediaType)` — áp THẬT vào
 *     `playlistOrder`/DOM. TRƯỚC ĐÂY chỉ gọi được lúc boot; giờ gọi được BẤT KỲ LÚC NÀO scope đổi
 *     (tap folder, toggle, gỡ hết item, xoá folder, ĐỔI SANG 1 Nguồn khác — xem
 *     event/workflow/playlist.js::switchToSongSource()/switchToVideoSource()/switchToPhotoSource(),
 *     mỗi hàm tự đọc `activePlayListFolder[Nguồn đó]` rồi áp lại folder đã nhớ, hoặc "Tất cả bài"
 *     nếu chưa từng scope) — không còn cần reload để thấy kết quả.
 *   - Đánh đổi CHỦ Ý (Giang xác nhận): áp sống KHÔNG dừng 1 bài đang phát NẰM NGOÀI scope mới — bài
 *     đó chỉ biến mất khỏi danh sách hiển thị, tự phát hết bình thường — ĐÚNG cùng hành vi vốn đã
 *     có sẵn khi đổi Nguồn Playlist (switchToSongSource() v.v. cũng không dừng bài đang phát), nay
 *     dùng CHUNG 1 chủ trương cho cả 2 tình huống, không phải hành vi mới phát sinh riêng.
 *   - `askReloadToApplyNow(bodyText)` — GIỮ NGUYÊN, KHÔNG xoá: vẫn đang được
 *     `event/workflow/playlist.js::applyFilterChanges()` dùng (Playlist Filter, tính năng KHÁC,
 *     không thuộc phạm vi sửa đợt này) — chỉ THÔI dùng ở các chỗ scope-theo-folder (Folder Browser
 *     Read, xem event/workflow/file-manager-folder-browser.js).
 *
 * `clearScope()` (bản cũ) ĐÃ XOÁ — không còn nơi nào gọi tới sau khi deleteActiveFolderById()
 * chuyển sang persistScopeChoice(null) + askReloadToApplyNow() (xem
 * event/workflow/file-manager-song.js).
 *
 * NẠP SAU: core/playlist/scope.js (loadAllSongs/loadSongsFromFolder), service/db.js (setMeta),
 * event/workflow/playlist-order.js (workflowPlaylistOrder.updateShuffleArray/recomputeDisplayOrder/
 * recomputeRenderOrder — dời từ core/playlist/order.js), core/playlist/render.js
 * (renderPlaylistDiff/updateEmptyState), core/modal-choice-ui.js (modalChoice),
 * core/file-manager/folder.js (getExcludedSongKeysFromFolders() — MỚI, Batch 4, dùng bởi
 * applyAllSongsScope()), core/playlist/filter.js (applyPlaylistFilter() — MỚI, mục 1d).
 */
const workflowPlaylistScope = {

    /**
     * Lưu bền lựa chọn scope mới vào `meta` VÀ cập nhật `appState.activePlayListFolder` (bookkeeping
     * "ý định hiện tại", để badge/nút trong UI phản ánh đúng NGAY) — KHÔNG đụng
     * `playlistOrder`/DOM Playlist thật, đó là việc RIÊNG của `applyFolderScope()`/
     * `applyAllSongsScope()` ngay dưới, gọi NGAY SAU hàm này (SỬA 06/09/2026 — không còn tách rời
     * bằng `askReloadToApplyNow()` nữa, xem docstring đầu file).
     * SỬA (06/09/2026, Giang chốt "mỗi Nguồn tự nhớ folder riêng") — nhận thêm `mediaType`, chỉ
     * patch ĐÚNG field đó trong object `activePlayListFolder`, giữ nguyên 2 field còn lại — đổi
     * Nguồn không còn xoá mất lựa chọn Scope của Nguồn kia.
     * @param {string|null} folderId - null = bỏ scope (về "Tất cả bài")
     * @param {'song'|'video'|'photo'} mediaType - Nguồn ĐANG áp dụng/bỏ scope này — nơi gọi luôn
     *        đã biết chắc chắn đúng Nguồn nào (vd `this._readFolderRecord.type` ở Folder Browser
     *        Read), KHÔNG tự suy ra `activeMediaSource` ngầm bên trong (Rule 2).
     */
    async persistScopeChoice(folderId, mediaType) {
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId ?? null };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "persistScopeChoice", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        await setMeta('activePlayListFolder', next);
        // XOÁ (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") — lời gọi
        // `PlaylistMain.updateActiveFolderUI(...)` (khoá <select> Settings → Playlist) từng ở đây
        // đã bỏ — badge mới (`PlaylistMain.updateActiveFolderBadge()`) được gọi từ
        // `applyFolderScope()`/`applyAllSongsScope()` ngay dưới thay vì ở đây, vì đó mới là nơi
        // phản ánh SCOPE THẬT SỰ đang áp dụng (persistScopeChoice() chỉ lưu Ý ĐỊNH).
    },

    /**
     * Áp scope THẬT vào `playlistOrder`/DOM đang chạy. SỬA (06/09/2026, Giang chốt "bỏ hỏi
     * reload, áp sống luôn") — TRƯỚC ĐÂY chỉ dùng lúc BOOT; giờ gọi được BẤT KỲ LÚC NÀO scope đổi
     * (tap folder, toggle, gỡ hết item khỏi folder đang active, xoá folder, ĐỔI SANG 1 Nguồn khác
     * — xem event/workflow/playlist.js). Xem docstring đầu file cho đánh đổi CHỦ Ý về bài đang
     * phát nằm ngoài scope mới (không dừng, chỉ biến mất khỏi list).
     * SỬA (06/09/2026, per-source) — nhận `mediaType` thay vì tự đọc `appState.activeMediaSource`
     * bên trong: hàm này giờ CŨNG được gọi lúc ĐỔI SANG 1 Nguồn khác, tại thời điểm đó
     * `activeMediaSource` có thể đã đổi xong hay chưa tuỳ thứ tự gọi — dùng tham số tường minh
     * tránh phụ thuộc ngầm vào thứ tự đó (Rule 2).
     * @param {string} folderId
     * @param {'song'|'video'|'photo'} mediaType
     */
    async applyFolderScope(folderId, mediaType) {
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);

        await loadSongsFromFolder(folderId, appState.get('playlistCache'));
        // MỚI (mục 1d, Playlist Filter) — áp filter (nếu có) NGAY SAU khi playlistOrder vừa được
        // Scope tính lại theo folder, TRƯỚC updateShuffleArray()/recompute*Order() — xem docstring
        // đầu core/playlist/filter.js.
        const beforeCount = appState.get('playlistOrder').length; // MỚI (mục 2, log) — số lượng TRƯỚC khi lọc, để so log rõ ràng
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType]);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyFolderScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        updateEmptyState();
        // MỚI (06/09/2026, Giang chốt mục 3.1 — "badge thay HẲN UI khoá select") — cập nhật badge
        // NGAY sau khi scope đã THẬT SỰ áp xong (không đặt ở persistScopeChoice() — xem docstring
        // hàm đó).
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderBadge();
    },

    /**
     * Áp "Tất cả bài" THẬT vào `playlistOrder`/DOM đang chạy, có lọc Exclude. SỬA (06/09/2026,
     * cùng lý do applyFolderScope() ngay trên) — TRƯỚC ĐÂY chỉ dùng lúc BOOT khi KHÔNG có
     * `activePlayListFolder` đã lưu; giờ CŨNG dùng cho nút X "thoát thư mục" (áp sống). Nhận
     * `mediaType` tường minh (Rule 2, cùng lý do applyFolderScope()) VÀ tự ghi
     * `activePlayListFolder[mediaType] = null` (trước đây hàm này không đụng field đó — chỉ đúng
     * lúc CHỈ được gọi khi vốn dĩ đã null sẵn; giờ còn được gọi để CHỦ ĐỘNG thoát 1 scope đang có,
     * nên phải tự dọn field này cho khớp thực tế, không phụ thuộc persistScopeChoice() đã chạy
     * trước đó hay chưa).
     * @param {'song'|'video'|'photo'} mediaType
     */
    async applyAllSongsScope(mediaType) {
        const current = appState.get('activePlayListFolder');
        if (current[mediaType] != null) {
            const next = { ...current, [mediaType]: null };
            appState.set('activePlayListFolder', next);
            console.log(`writer: "applyAllSongsScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        }
        // FIX (Giang báo — "Exclude của Folder có thể loại nhầm media khác loại nếu key trùng") —
        // getExcludedSongKeysFromFolders() (core/file-manager/folder.js) nhận `mediaType` qua tham
        // số, CHỈ gom Exclude của ĐÚNG loại folder đang browse — dùng THẲNG tham số của chính hàm
        // này (SỬA 06/09/2026, trước đây tự đọc appState.get('activeMediaSource'), cùng lý do
        // applyFolderScope()).
        const excludedKeys = await getExcludedSongKeysFromFolders(mediaType); // core/file-manager/folder.js
        loadAllSongs(appState.get('playlistCache'), excludedKeys); // core/playlist/scope.js
        // MỚI (mục 1d, Playlist Filter) — CÙNG LÝ DO applyFolderScope() ngay trên.
        const beforeCount = appState.get('playlistOrder').length; // MỚI (mục 2, log)
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType]);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyAllSongsScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        updateEmptyState();
        // MỚI (06/09/2026) — CÙNG LÝ DO applyFolderScope() ngay trên.
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderBadge();
    },

    /**
     * Modal DÙNG CHUNG — hỏi "tải lại trang để áp dụng ngay không?". GIỮ NGUYÊN (KHÔNG xoá dù đã
     * bỏ dùng ở scope-theo-folder, 06/09/2026) — vẫn đang phục vụ
     * `event/workflow/playlist.js::applyFilterChanges()` (Playlist Filter, tính năng KHÁC).
     * @param {string} bodyText - nội dung mô tả CỤ THỂ vừa lưu gì (khác nhau tuỳ nơi gọi)
     */
    askReloadToApplyNow(bodyText) {
        modalChoice(
            bodyText,
            [
                { label: t('fileManager.song.folderDetail.reloadBtnNow'), className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors', onClick: () => { window.location.reload(); } }
            ],
            { title: t('fileManager.song.folderDetail.reloadTitle') }
        );
    }
};
