/**
 * event/workflow/playlist-scope.js — "THẰNG THỰC THI CUỐI" cho scoping Playlist theo folder.
 *
 * SỬA LẠI 03/07/2026 (đợt 3 — theo đúng góp ý): tách bạch RÕ 2 việc trước đây gộp chung trong 1
 * lần gọi ("lưu lựa chọn" + "áp dụng ngay vào phiên đang chạy"):
 *   - `persistScopeChoice(folderId)` — CHỈ lưu bền vào `meta`, KHÔNG đụng RAM/DOM của phiên đang
 *     chạy. Scope mới chỉ thật sự "có hiệu lực" từ lần TẢI TRANG kế tiếp.
 *   - `applyFolderScope(folderId)` — áp NGAY vào phiên đang chạy (RAM + DOM). CHỈ còn 1 nơi gọi
 *     duy nhất: boot sequence (core/visualizer/draw-visualizer.js), NGAY SAU initPlaylistFromDB().
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
 * NẠP SAU: core/playlist/scope.js (loadAllSongs/loadSongsFromFolder), core/db.js (setMeta),
 * core/playlist/order.js (updateShuffleArray/recomputeDisplayOrder/recomputeRenderOrder),
 * core/playlist/render.js (renderPlaylistDiff/updateEmptyState), core/modal-choice.js (modalChoice).
 */
const workflowPlaylistScope = {

    /**
     * CHỈ lưu bền lựa chọn scope mới vào `meta` — KHÔNG áp dụng vào phiên đang chạy. Dùng ở MỌI
     * nơi thay đổi `activePlayListFolder` NGOÀI boot (bấm "Áp dụng cho Playlist", xoá folder đang
     * active) — luôn đi kèm `askReloadToApplyNow()` ngay sau, để người dùng tự quyết có muốn thấy
     * kết quả ngay hay không.
     * @param {string|null} folderId - null = bỏ scope (về "Tất cả bài")
     */
    async persistScopeChoice(folderId) {
        await setMeta('activePlayListFolder', folderId ?? null);
        console.log(`writer: "persistScopeChoice", page: "meta.activePlayListFolder", content: "${folderId ?? 'null'}"`);
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
