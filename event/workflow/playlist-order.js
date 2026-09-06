/**
 * event/workflow/playlist-order.js — Lớp điều phối "tính lại thứ tự" cho Playlist (renderOrder/
 * displayOrder/shuffleIndices), MỚI — dời NGUYÊN VẸN 6 hàm TỪ core/playlist/order.js (Giang chỉ ra
 * "không chấp nhận tiền lệ, ngoại lệ trừ chỉ định cụ thể theo tài liệu" — sau khi bị chỉ ra lý lẽ
 * "ghép hàm thuần, không tính Core gọi Core" mà bản thân tôi tự bịa, KHÔNG có trong core-function-
 * conventions.md):
 *   - `recomputeRenderOrder()`/`recomputeDisplayOrder()` — TRƯỚC ĐÂY ở order.js, gọi `liveKeys()`/
 *     `songMatchesQuery()`/`sortKeysByMode()` (đều là hàm core/nghiệp vụ TOP-LEVEL RIÊNG, KHÔNG
 *     phải closure lồng) — đúng định nghĩa Rule 3a cấm tuyệt đối ("1 function core TUYỆT ĐỐI
 *     KHÔNG được gọi bất kỳ function core/nghiệp vụ nào khác"), KHÔNG đủ điều kiện hưởng ngoại lệ
 *     Rule 3c (hàm con chỉ được miễn khi là closure lồng bên trong VÀ tự chứa vòng lặp — 3 hàm bị
 *     gọi ở đây không thoả điều kiện nào).
 *   - `updateShuffleArray()`/`applyNewSongsToDisplayOrder()`/`setDisplaySortMode()`/
 *     `setDisplayStatSortField()`/`setDisplayStatSortDirection()` — TRƯỚC ĐÂY CŨNG tự
 *     `appState.get()` (vi phạm Rule 2) VÀ gọi core khác (`recomputeRenderOrder`/
 *     `recomputeDisplayOrder`/`renderPlaylistDiff` — vi phạm Rule 3a) — đợt sửa trước ĐÃ GHI CHÚ
 *     rõ đây là nợ "ngoài phạm vi", giờ dọn LUÔN cùng đợt vì đằng nào cũng đang sửa nhiều
 *     core/workflow (đúng chỉ đạo "sửa cho triệt để").
 *
 * SỬA TẬN GỐC theo đúng Rule 3b ("Core là tầng THI HÀNH, Workflow là tầng CHUẨN BỊ") — CÙNG tiền lệ
 * `core/playlist/bulk-actions.js` đã làm với `deleteSongsBatch()` cũ ("Bỏ hẳn... khỏi core... dời
 * THẲNG vào workflow"). `core/playlist/order.js` giờ CHỈ còn hàm THUẦN thật sự (Rule 1-4 đầy đủ,
 * không hàm core nào trong file đó tự `appState.get()` hay gọi core khác nữa): `liveKeys()`,
 * `sortKeysByMode()`, `updateShuffleArrayFromQueue()`, `computeListStep()`, `decideBoundaryAction()`,
 * `shouldRestartInsteadOfAdvance()`.
 *
 * Workflow ở ĐÂY ĐƯỢC PHÉP tự `appState.get()` (Rule 2 CHỈ áp cho Core) và gọi nhiều Core nối tiếp
 * nhau (`liveKeys`/`songMatchesQuery`/`sortKeysByMode`/`renderPlaylistDiff` — Rule 3 CHỈ cấm Core
 * gọi Core, không cấm Workflow gọi Core) — đúng vai trò CHUẨN BỊ + ĐIỀU PHỐI.
 *
 * NẠP SAU: core/playlist/order.js (liveKeys/sortKeysByMode), core/song-search.js (songMatchesQuery),
 * core/playlist/render.js (renderPlaylistDiff), service/state.js (appState). NẠP TRƯỚC: mọi
 * event/workflow/*.js hoặc core/*.js gọi 7 method dưới đây (xem danh sách callsite đã cập nhật ở
 * event/workflow/playlist.js, playlist-scope.js, playlist-empty-state.js, player-controls.js,
 * video-player.js, file-manager-storage.js, core/playlist/render.js, actions.js, loader.js,
 * core/storage-manager.js).
 */
const workflowPlaylistOrder = {
    /** Tính lại renderOrder = các bài hợp lệ, lọc theo ô tìm kiếm, sắp theo mode hiện tại. KHÔNG
     * bao giờ phụ thuộc currentKey/pending/hàng đợi phát — UI luôn "đúng như mắt thấy". Dời NGUYÊN
     * VẸN logic từ core/playlist/order.js::recomputeRenderOrder() (đã xoá khỏi đó) — chỉ khác chỗ
     * tự `appState.get()` ngay tại đây (Workflow được phép), không còn nhận qua tham số nữa. */
    recomputeRenderOrder() {
        const _t0 = performance.now(); // MỚI (chẩn đoán boot chậm, phản hồi Giang) — đo thời gian THẬT, không đổi logic
        const { playlistOrder, confirmedBrokenKeys, searchQuery, playlistCache, displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, mediaStatsMap } = appState.get([
            'playlistOrder', 'confirmedBrokenKeys', 'searchQuery', 'playlistCache', 'displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'mediaStatsMap',
        ]);
        const filtered = liveKeys(playlistOrder, confirmedBrokenKeys).filter((key) => { // core/playlist/order.js
            const cached = playlistCache.get(key);
            return songMatchesQuery(searchQuery, cached ? cached.tag.title : key, cached ? cached.tag.artist : '', cached ? cached.tag.album : ''); // core/song-search.js
        });
        const sorted = sortKeysByMode(filtered, nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap); // core/playlist/order.js
        appState.set('renderOrder', sorted);
        console.log(`writer: "workflowPlaylistOrder.recomputeRenderOrder", page: "renderOrder", content: "${(performance.now() - _t0).toFixed(0)}ms cho ${sorted.length} item"`);
    },

    /** Tính lại displayOrder thật (sort theo mode), xoá pending. Dùng khi đổi mode/chạm biên. FIX
     * (03/07/2026, mục 3a/3b, GIỮ NGUYÊN qua đợt dời này) — displayOrder sau lời gọi này LUÔN phản
     * ánh ĐÚNG top-level (liveKeys(), tức playlistOrder đã lọc bài lỗi) — nghĩa là bất kỳ "section"
     * nào đang active (playSelectedSongs(), event/workflow/playlist.js) coi như đã kết thúc tại đây
     * -> đặt lại sectionQueueActive=false cho khớp. Dời NGUYÊN VẸN từ core/playlist/order.js::
     * recomputeDisplayOrder() (đã xoá khỏi đó). */
    recomputeDisplayOrder() {
        const { playlistOrder, confirmedBrokenKeys, displaySortMode: nameMode, displayStatSortField: statField, displayStatSortDirection: statDirection, songNameIndex, playlistCache, mediaStatsMap } = appState.get([
            'playlistOrder', 'confirmedBrokenKeys', 'displaySortMode', 'displayStatSortField', 'displayStatSortDirection', 'songNameIndex', 'playlistCache', 'mediaStatsMap',
        ]);
        const sorted = sortKeysByMode(liveKeys(playlistOrder, confirmedBrokenKeys), nameMode, statField, statDirection, songNameIndex, playlistCache, mediaStatsMap); // core/playlist/order.js
        appState.set('displayOrder', sorted);
        console.log(`writer: "workflowPlaylistOrder.recomputeDisplayOrder", page: "displayOrder", content: "resort lại theo displaySortMode, về top-level"`);
        appState.mutate('pendingResortKeys', s => s.clear());
        console.log(`writer: "workflowPlaylistOrder.recomputeDisplayOrder", page: "pendingResortKeys", content: "clear toàn bộ"`);
        appState.set('sectionQueueActive', false);
        console.log(`writer: "workflowPlaylistOrder.recomputeDisplayOrder", page: "sectionQueueActive", content: "false"`);
    },

    /** Reset shuffleIndices theo TOÀN BỘ top-level (playlistOrder) — dùng ở boot/thêm bài/clear
     * storage/áp scope folder (LUÔN muốn shuffle toàn bộ, không liên quan section — khác hẳn
     * `updateShuffleArrayFromQueue()`, core/playlist/order.js, dùng cho nút Shuffle Control Center
     * cần trộn ĐÚNG "hiện hành"). Dời NGUYÊN VẸN từ core/playlist/order.js::updateShuffleArray()
     * (đã xoá khỏi đó) — THÊM console.log (Rule 4) cho 2 lượt ghi vốn thiếu từ bản gốc, tiện dọn
     * luôn vì đã đụng tới hàm này. */
    updateShuffleArray() {
        appState.set('shuffleIndices', appState.get('playlistOrder').slice());
        console.log(`writer: "workflowPlaylistOrder.updateShuffleArray", page: "shuffleIndices", content: "reset theo toàn bộ playlistOrder"`);
        if (appState.get('isShuffle')) {
            appState.mutate('shuffleIndices', arr => {
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
            });
            console.log(`writer: "workflowPlaylistOrder.updateShuffleArray", page: "shuffleIndices", content: "đã trộn ngẫu nhiên (isShuffle=true)"`);
        }
    },

    /** Thêm bài MỚI vào hàng đợi phát: không đang phát gì -> resort ngay; đang phát -> nối cuối +
     * ghi nhận pending (chỉ resort khi chạm biên), không làm gãy thứ tự đang nghe (KHÔNG ảnh hưởng
     * renderOrder/UI). Dời NGUYÊN VẸN từ core/playlist/order.js::applyNewSongsToDisplayOrder() (đã
     * xoá khỏi đó) — 2 lời gọi `recomputeDisplayOrder()` đổi thành `this.recomputeDisplayOrder()`
     * (method cùng object, không còn cần gom tham số ở callsite nữa — method đó tự đọc appState). */
    applyNewSongsToDisplayOrder(newKeys) {
        if (newKeys.length === 0) {
            const playlistOrder = appState.get('playlistOrder');
            const confirmedBrokenKeys = appState.get('confirmedBrokenKeys');
            if (appState.get('displayOrder').length !== liveKeys(playlistOrder, confirmedBrokenKeys).length) this.recomputeDisplayOrder(); // core/playlist/order.js (liveKeys)
            return;
        }
        if (!appState.get('currentKey')) { this.recomputeDisplayOrder(); return; }
        const displaySet = new Set(appState.get('displayOrder')); // tra cứu O(1) thay cho .includes() O(n)
        for (const k of newKeys) {
            if (!displaySet.has(k)) {
                appState.mutate('displayOrder', arr => arr.push(k));
                displaySet.add(k);
            }
            appState.mutate('pendingResortKeys', s => s.add(k));
        }
    },

    /** Đổi kiểu sắp xếp hiển thị — cập nhật CẢ render lẫn hàng đợi phát rồi vẽ lại. az/za/newest/
     * oldest — DÙNG CHUNG cho cả Song/Video/Photo. Dời NGUYÊN VẸN từ core/playlist/order.js::
     * setDisplaySortMode() (đã xoá khỏi đó) — THÊM console.log (Rule 4) cho lượt ghi
     * `displaySortMode` vốn thiếu từ bản gốc. */
    setDisplaySortMode(mode) {
        if (!['az', 'za', 'newest', 'oldest'].includes(mode)) return;
        appState.set('displaySortMode', mode);
        console.log(`writer: "workflowPlaylistOrder.setDisplaySortMode", page: "displaySortMode", content: "${mode}"`);
        this.recomputeDisplayOrder();   // hàng đợi: resort thật (đổi mode là hành động chủ động)
        this.recomputeRenderOrder();    // UI: sắp lại ngay
        renderPlaylistDiff(); // core/playlist/render.js
    },

    /** Đổi trục (2) — field thống kê. Dời NGUYÊN VẸN từ core/playlist/order.js::
     * setDisplayStatSortField() (đã xoá khỏi đó). CÙNG KHUÔN setDisplaySortMode() ở trên. */
    setDisplayStatSortField(field) {
        if (!['none', 'count', 'times', 'size', 'duration'].includes(field)) return;
        appState.set('displayStatSortField', field);
        console.log(`writer: "workflowPlaylistOrder.setDisplayStatSortField", page: "displayStatSortField", content: "${field}"`);
        this.recomputeDisplayOrder();
        this.recomputeRenderOrder();
        renderPlaylistDiff(); // core/playlist/render.js
    },

    /** Đổi trục (2) — hướng sắp xếp. Dời NGUYÊN VẸN từ core/playlist/order.js::
     * setDisplayStatSortDirection() (đã xoá khỏi đó). CÙNG KHUÔN 2 setter trên. */
    setDisplayStatSortDirection(direction) {
        if (!['desc', 'asc'].includes(direction)) return;
        appState.set('displayStatSortDirection', direction);
        console.log(`writer: "workflowPlaylistOrder.setDisplayStatSortDirection", page: "displayStatSortDirection", content: "${direction}"`);
        this.recomputeDisplayOrder();
        this.recomputeRenderOrder();
        renderPlaylistDiff(); // core/playlist/render.js
    },
};
