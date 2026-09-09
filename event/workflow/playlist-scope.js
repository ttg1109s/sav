/**
 * event/workflow/playlist-scope.js — "THẰNG THỰC THI CUỐI" cho scoping Playlist theo folder + nạp
 * lại playlistCache theo Nguồn (Song/Video/Photo).
 *
 * Luồng chuẩn (dùng chung cho app boot, đổi Nguồn, tap folder, thoát folder, upload-refresh):
 *   `applyFolderScope(folderId, mediaType, onProgress?)` hoặc `applyAllSongsScope(mediaType, onProgress?)`
 *   — GỌI ĐÚNG 1 TRONG 2, KHÔNG cần gọi gì thêm trước đó. Bên trong tự làm:
 *     1. List  — `listMediaRecords()`: có `folderId` -> CHỈ đọc key của folder đó (`getFolderSongMap`,
 *        progress "x/total" luôn khớp số THẬT sẽ hiển thị); không có -> đọc toàn bộ thư viện.
 *     2. Validate — CHỈ Song (`filterValidSongRecords`, lọc broken/MIME/thiếu tag).
 *     3. Adapt — `buildAdaptedPlaylistCache()` (Video/Photo, bảng `MEDIA_ADAPTER_SHAPE` ở
 *        core/playlist/loader.js) hoặc `buildSongPlaylistCache()` (Song riêng, tag/cover có sẵn thật).
 *     4. Scope + Filter — `playlistCache` giờ CHỈ chứa đúng phạm vi cần (folder hoặc toàn bộ) nên
 *        chỉ cần `loadAllSongs(cache, excludedKeys)` (core/playlist/scope.js) là đủ suy ra
 *        `playlistOrder` — KHÔNG cần giao (intersect) với danh sách folder nữa. Rồi
 *        `applyPlaylistFilter()` (core/playlist/filter.js) lọc tiếp theo Playlist Filter đang bật.
 *     5. Render — updateShuffleArray/recompute*Order/renderPlaylistDiff/updateEmptyState + badge.
 *   Vì cache LUÔN khớp đúng phạm vi hiện tại, MỌI nơi đổi scope (tap folder khác, thoát folder, xoá
 *   hết item, upload thêm vào folder đang active...) chỉ cần gọi lại applyFolderScope()/
 *   applyAllSongsScope() — KHÔNG cần tự lo nạp cache riêng, tự động đúng.
 *
 *   `persistScopeChoice(folderId, mediaType)` — CHỈ lưu Ý ĐỊNH (meta + badge phản ánh ngay), KHÔNG
 *   đụng playlistOrder/cache — gọi trước applyFolderScope()/applyAllSongsScope() ở nơi cần lưu bền
 *   (vd tap tile folder); nơi KHÔNG cần lưu ý định riêng (đổi Nguồn, upload-refresh) chỉ cần gọi
 *   thẳng applyFolderScope()/applyAllSongsScope(), tự đọc field đã lưu từ trước.
 *
 *   `askReloadToApplyNow(bodyText)` — modal dùng chung, KHÔNG liên quan Scope — phục vụ
 *   `event/workflow/playlist-filter-presets.js::selectPreset()` (chọn áp dụng 1 preset Filter qua
 *   Settings, bắt reload trang, tính năng riêng — SỬA 08/09/2026, hàm cũ `workflowPlaylist.
 *   applyFilterChanges()` đã xoá, hệ Filter giờ dùng preset).
 *
 * Rule 3 (siết 03/08/2026, readme/core-function-conventions.md) — Core CẤM tự đọc service/db.js;
 * `listMediaRecords()` đọc DB trực tiếp nên PHẢI nằm ở Workflow này, không phải Core.
 *
 * NẠP SAU: core/playlist/scope.js (loadAllSongs), service/db.js (setMeta, getFolderSongMap,
 * getAllSongKeys/getAllVideoKeys/getAllImageKeys, getSongRecord/getVideoRecord/getImageRecord),
 * event/workflow/playlist-order.js (workflowPlaylistOrder.*), core/playlist/render.js
 * (renderPlaylistDiff/updateEmptyState), core/modal-choice-ui.js (modalChoice),
 * core/file-manager/folder.js (getFolderRecord/getExcludedSongKeysFromFolders),
 * core/playlist/filter.js (applyPlaylistFilter), core/playlist/loader.js
 * (buildAdaptedPlaylistCache/filterValidSongRecords/buildSongPlaylistCache).
 */
// Registry Workflow — map mediaType -> {getAllKeys, getRecord} ở tầng service/db.js, dùng bởi
// listMediaRecords() ngay dưới. Thêm 1 loại media MỚI theo Adapter pattern (đã có sẵn 1 mảng record
// đầy đủ) chỉ cần thêm 1 dòng ở đây + 1 entry MEDIA_ADAPTER_SHAPE (core/playlist/loader.js) — KHÔNG
// cần viết thêm hàm listX() ở tầng Core.
const MEDIA_DB_ACCESSOR = {
    song: { getAllKeys: getAllSongKeys, getRecord: getSongRecord },
    video: { getAllKeys: getAllVideoKeys, getRecord: getVideoRecord },
    photo: { getAllKeys: getAllImageKeys, getRecord: getImageRecord },
};

const workflowPlaylistScope = {

    /**
     * List — đọc key (toàn bộ thư viện, hoặc CHỈ của 1 folder nếu có `folderId`) rồi fetch từng
     * record qua `MEDIA_DB_ACCESSOR`. `onProgress(done, total)` — `total` LUÔN khớp đúng số record
     * SẼ đọc (folder nhỏ thì total nhỏ, không còn hiện nhầm tổng thư viện khi đang Scope).
     * @param {'song'|'video'|'photo'} mediaType
     * @param {string|null} [folderId] - có giá trị -> CHỈ đọc key của folder này
     * @param {(done:number,total:number)=>void} [onProgress]
     * @returns {Promise<Array<object>>} mảng record (đã gộp `key`), record null/rỗng đã lọc bỏ
     */
    async listMediaRecords(mediaType, folderId, onProgress) {
        const { getAllKeys, getRecord } = MEDIA_DB_ACCESSOR[mediaType];
        let keys;
        if (folderId) {
            const folderMap = await getFolderSongMap(folderId); // service/db.js
            keys = folderMap ? folderMap.list.filter((k) => k != null) : [];
        } else {
            keys = await getAllKeys();
        }
        let done = 0;
        const records = await Promise.all(keys.map(async (key) => {
            const record = await getRecord(key);
            done++;
            if (typeof onProgress === 'function') onProgress(done, keys.length);
            return record ? { key, ...record } : null;
        }));
        return records.filter(Boolean);
    },

    /**
     * List + Validate + Adapt — nạp lại `playlistCache`/`songNameIndex` ĐÚNG phạm vi (`folderId`
     * hoặc toàn bộ) — KHÔNG đụng `playlistOrder`/render, đó là việc của `applyFolderScope()`/
     * `applyAllSongsScope()` (gọi hàm NÀY ngay bên trong, nơi khác không cần gọi trực tiếp nữa).
     * @param {'song'|'video'|'photo'} mediaSource
     * @param {string|null} [folderId]
     * @param {(done:number,total:number)=>void} [onProgress]
     */
    async loadPlaylistCacheForSource(mediaSource, folderId, onProgress) {
        const records = await this.listMediaRecords(mediaSource, folderId, onProgress);
        if (mediaSource === 'song') {
            const validRecords = filterValidSongRecords(records, appState.get('confirmedBrokenKeys'));
            buildSongPlaylistCache(validRecords);
        } else {
            buildAdaptedPlaylistCache(records, mediaSource);
        }
    },

    /**
     * Lưu Ý ĐỊNH scope mới (`meta` + `appState.activePlayListFolder`, badge phản ánh ngay) — KHÔNG
     * đụng playlistOrder/cache, đó là việc của applyFolderScope()/applyAllSongsScope() gọi sau.
     * @param {string|null} folderId - null = bỏ scope
     * @param {'song'|'video'|'photo'} mediaType
     */
    async persistScopeChoice(folderId, mediaType) {
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId ?? null };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "persistScopeChoice", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        await setMeta('activePlayListFolder', next);
    },

    /**
     * Áp Scope 1 folder THẬT — nạp cache CHỈ folder này (List scope-aware) rồi tính playlistOrder +
     * Filter + render + badge. Gọi được BẤT KỲ LÚC NÀO scope đổi (tap folder, đổi Nguồn, boot,
     * upload-refresh) — mỗi lần gọi tự nạp lại cache đúng theo `folderId` truyền vào, không phụ
     * thuộc cache cũ. Đánh đổi CHỦ Ý: không dừng bài đang phát nằm ngoài scope mới, chỉ biến mất
     * khỏi list, tự phát hết bình thường (giống hệt hành vi đổi Nguồn).
     * SỬA (09/09/2026, phản hồi Giang — "loading x/total phải tính theo số lượng cuối cùng sau
     * filter, kể cả appboot lẫn đổi Nguồn") — `onProgress(done, total)` gọi bên trong
     * `loadPlaylistCacheForSource()` (qua `listMediaRecords()`) chỉ báo được `total` = số record THÔ
     * trong scope (folder/toàn thư viện) — filter CHỈ tính được SAU khi cache đã dựng xong (Filter
     * cần đọc `playlistCache`/`mediaStatsMap`, KHÔNG THỂ chạy trước lúc còn đang fetch record), nên
     * không thể biết trước tổng SAU lọc trong lúc đang tải. Khắc phục bằng cách gọi LẠI
     * `onProgress()` 1 LẦN NỮA ngay sau khi Filter xong, với số ĐÃ SAU LỌC — đây là con số CUỐI CÙNG
     * người dùng thấy đọng lại trên màn hình loading (`#playlist-loading-text`, core/playlist/
     * render.js::updatePlaylistLoading()) ngay trước khi nó ẩn đi (updateEmptyState() dưới), khớp
     * ĐÚNG số item thật sự hiện ra trong Playlist — KHÔNG còn lệch với số THÔ đã thấy trong lúc tải.
     * MỚI (09/09/2026, phản hồi Giang — checkbox preset "Có áp dụng cho thư mục hay không") — CHỈ
     * hàm NÀY đọc `playlistFilterAppliesToFolder[mediaType]` (mặc định BẬT) — tắt thì Filter KHÔNG
     * áp dụng lúc đang xem 1 thư mục cụ thể (vẫn áp bình thường lúc xem "Tất cả",
     * `applyAllSongsScope()` không đọc field này).
     * @param {string} folderId
     * @param {'song'|'video'|'photo'} mediaType
     * @param {(done:number,total:number)=>void} [onProgress]
     */
    async applyFolderScope(folderId, mediaType, onProgress) {
        // MỚI (09/09/2026) — bọc onProgress để biết nó CÓ thực sự được gọi lần nào trong lúc fetch
        // thô hay không (thư viện/folder rỗng -> KHÔNG lần nào, xem event/workflow/app-boot.js —
        // "lớp loading tự nhiên KHÔNG hiện" khi rỗng) — nếu KHÔNG, bỏ qua bước sửa lại total cuối
        // hàm, tránh vô tình LÀM HIỆN overlay loading (qua lần gọi sửa lại) cho trường hợp vốn dĩ
        // không nên hiện gì cả.
        let progressWasCalled = false;
        const trackedOnProgress = typeof onProgress === 'function' ? (done, total) => { progressWasCalled = true; onProgress(done, total); } : undefined;
        await this.loadPlaylistCacheForSource(mediaType, folderId, trackedOnProgress);
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        const folderRecordForReadOnly = await getFolderRecord(folderId); // core/file-manager/folder.js
        appState.set('isActiveFolderReadOnly', !!(folderRecordForReadOnly && folderRecordForReadOnly.isReadOnly));

        // cache vừa nạp CHỈ chứa đúng folder này -> không cần giao (intersect) lại, không có Exclude
        loadAllSongs(appState.get('playlistCache'), new Set()); // core/playlist/scope.js
        const beforeCount = appState.get('playlistOrder').length;
        // MỚI (09/09/2026, phản hồi Giang — checkbox preset "Có áp dụng cho thư mục hay không",
        // mặc định BẬT) — CHỈ applyFolderScope() (đang xem 1 thư mục cụ thể) đọc field này;
        // applyAllSongsScope() ("Tất cả") LUÔN áp Filter bình thường, không liên quan field này.
        // Tắt (`false`) -> rơi về bucket rỗng (clonePlaylistFilterConfigDefaults()[mediaType], mọi
        // field null) -> applyPlaylistFilter() fast-path trả nguyên keys, tức KHÔNG lọc gì cả cho
        // Nguồn này trong lúc đang xem thư mục.
        const appliesToFolder = appState.get('playlistFilterAppliesToFolder')[mediaType];
        const rulesBucket = appliesToFolder ? appState.get('playlistFilterConfig')[mediaType] : clonePlaylistFilterConfigDefaults()[mediaType];
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), rulesBucket);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyFolderScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType}, appliesToFolder=${appliesToFolder})"`);
        if (progressWasCalled) onProgress(filteredKeys.length, filteredKeys.length); // sửa lại "x/total" đọng lại trên màn loading — số CUỐI CÙNG sau Filter, xem docstring trên
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        updateEmptyState();
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderBadge();
    },

    /**
     * Áp "Tất cả bài" THẬT — nạp lại TOÀN BỘ cache rồi tính playlistOrder (trừ Exclude) + Filter +
     * render + badge. CÙNG nguyên tắc `applyFolderScope()` — gọi lại bất kỳ lúc nào, tự nạp cache
     * đúng (toàn bộ) mỗi lần.
     * SỬA (09/09/2026) — CÙNG lý do/cách sửa `applyFolderScope()` ở trên, xem docstring hàm đó.
     * @param {'song'|'video'|'photo'} mediaType
     * @param {(done:number,total:number)=>void} [onProgress]
     */
    async applyAllSongsScope(mediaType, onProgress) {
        // MỚI (09/09/2026) — CÙNG lý do/cách bọc onProgress như applyFolderScope() ở trên.
        let progressWasCalled = false;
        const trackedOnProgress = typeof onProgress === 'function' ? (done, total) => { progressWasCalled = true; onProgress(done, total); } : undefined;
        await this.loadPlaylistCacheForSource(mediaType, null, trackedOnProgress);
        const current = appState.get('activePlayListFolder');
        if (current[mediaType] != null) {
            const next = { ...current, [mediaType]: null };
            appState.set('activePlayListFolder', next);
            console.log(`writer: "applyAllSongsScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        }
        appState.set('isActiveFolderReadOnly', false);
        const excludedKeys = await getExcludedSongKeysFromFolders(mediaType); // core/file-manager/folder.js — CHỈ Exclude của ĐÚNG mediaType
        loadAllSongs(appState.get('playlistCache'), excludedKeys); // core/playlist/scope.js
        const beforeCount = appState.get('playlistOrder').length;
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType]);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyAllSongsScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        if (progressWasCalled) onProgress(filteredKeys.length, filteredKeys.length); // sửa lại "x/total" đọng lại trên màn loading — số CUỐI CÙNG sau Filter, xem docstring applyFolderScope()
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        updateEmptyState();
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderBadge();
    },

    /**
     * Modal dùng chung — hỏi "tải lại trang để áp dụng ngay?". Phục vụ
     * `event/workflow/playlist.js::applyFilterChanges()` (Playlist Filter, không liên quan Scope).
     * @param {string} bodyText
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
