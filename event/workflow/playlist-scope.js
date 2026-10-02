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
 * `listPickableMedia(mediaType)` — ảnh/video thư viện trừ item thuộc folder Hidden, cho mọi picker.
 *
 * NẠP SAU: core/playlist/scope.js (loadAllSongs/filterOutExcludedMedia), service/db.js (setMeta, getFolderSongMap,
 * getAll{Song,Video,Image}Records/get{Song,Video,Image}RecordsByKeys — SỬA 02/10/2026, thay listImages()/listVideos()
 * + getAll*Keys/get*Record từng key),
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
// SỬA (02/10/2026, Giang duyệt — thư viện 10000 record làm sập trang) — trước đây {getAllKeys, getRecord} rồi đọc
// `Promise.all(keys.map(getRecord))`: MỖI record 1 transaction, mở cùng lúc. Giờ đọc cả lô trong 1 transaction qua
// 2 hàm data layer mới (service/db.js): toàn thư viện = cursor, theo danh sách key (folder) = nhiều get trong 1 tx.
const MEDIA_DB_ACCESSOR = {
    song: { getAllRecords: getAllSongRecords, getRecordsByKeys: getSongRecordsByKeys },
    video: { getAllRecords: getAllVideoRecords, getRecordsByKeys: getVideoRecordsByKeys },
    photo: { getAllRecords: getAllImageRecords, getRecordsByKeys: getImageRecordsByKeys },
};

// map mediaType -> hàm liệt kê thư viện, dùng bởi listPickableMedia(). SỬA (02/10/2026) — trước đây gọi listImages()/
// listVideos() (core/file-manager/image.js | video.js): 2 hàm core TỰ ĐỌC DB (vi phạm Rule 3b) và cũng đọc mỗi record
// 1 transaction song song -> xoá 2 hàm đó, gọi thẳng data layer (Workflow được đọc DB).
const PICKABLE_MEDIA_LISTER = {
    photo: () => getAllImageRecords(), // service/db.js
    video: () => getAllVideoRecords(), // service/db.js
};

// MỚI (02/10/2026) — listMediaRecords(): có folderId -> chỉ đọc key của folder đó; không -> cả thư viện. 2 tiến trình
// đọc khác nhau -> object map (event-bus-flow.md mục 7), khoá boolean thật `!!folderId`.
// MỚI (02/10/2026, rà mục 7) — loadPlaylistCacheForSource(): Song (lọc record hợp lệ rồi dựng cache Song) vs
// Video/Photo (Adapter). Trước đây if/else.
const PLAYLIST_CACHE_BUILD_BY_IS_SONG = {
    true: (records) => buildSongPlaylistCache(filterValidSongRecords(records, appState.get('confirmedBrokenKeys'))), // core/playlist/loader.js
    false: (records, mediaSource) => buildAdaptedPlaylistCache(records, mediaSource), // core/playlist/loader.js
};

const MEDIA_RECORDS_BY_FOLDER_SCOPED = {
    true: (accessor, folderId, onProgress) => workflowPlaylistScope._listFolderMediaRecords(accessor, folderId, onProgress),
    false: (accessor, folderId, onProgress) => accessor.getAllRecords(onProgress),
};

const workflowPlaylistScope = {

    /**
     * List — đọc record (toàn bộ thư viện, hoặc CHỈ của 1 folder nếu có `folderId`) qua `MEDIA_DB_ACCESSOR`, cả lô
     * trong 1 transaction (SỬA 02/10/2026). `onProgress(done, total)` — `total` LUÔN khớp đúng số record
     * SẼ đọc (folder nhỏ thì total nhỏ, không còn hiện nhầm tổng thư viện khi đang Scope).
     * @param {'song'|'video'|'photo'} mediaType
     * @param {string|null} [folderId] - có giá trị -> CHỈ đọc key của folder này
     * @param {(done:number,total:number)=>void} [onProgress]
     * @returns {Promise<Array<object>>} mảng record (đã gộp `key`), record null/rỗng đã lọc bỏ
     */
    async listMediaRecords(mediaType, folderId, onProgress) {
        // SỬA (02/10/2026) — đọc cả lô trong 1 transaction (xem MEDIA_DB_ACCESSOR); if/else cũ -> object map.
        return MEDIA_RECORDS_BY_FOLDER_SCOPED[!!folderId](MEDIA_DB_ACCESSOR[mediaType], folderId, onProgress);
    },

    /** MỚI (02/10/2026, tách từ listMediaRecords()) — record của ĐÚNG các key trong 1 folder, đọc trong 1 transaction.
     * @param {{getRecordsByKeys: Function}} accessor @param {string} folderId @param {Function} [onProgress] */
    async _listFolderMediaRecords(accessor, folderId, onProgress) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        const keys = folderMap ? folderMap.list.filter((k) => k != null) : []; // chọn GIÁ TRỊ
        const records = await accessor.getRecordsByKeys(keys, onProgress);
        return keys.map((key, i) => (records[i] ? { key, ...records[i] } : null)).filter(Boolean);
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
        PLAYLIST_CACHE_BUILD_BY_IS_SONG[mediaSource === 'song'](records, mediaSource); // SỬA (02/10/2026, mục 7) — if/else -> object map
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
     * SỬA (Giang yêu cầu tính năng "folder tự quyết áp dụng Filter") — checkbox preset "Có áp dụng
     * cho thư mục hay không" (`playlistFilterAppliesToFolder[mediaType]`) VẪN được hàm này đọc,
     * nhưng giờ CHỈ có tác dụng ở ĐÚNG 1 nhánh (folder chưa tự cấu hình `filterConfig` riêng) —
     * kết hợp field RIÊNG của TỪNG folder (`applyFilter`/`filterConfig`, core/file-manager/
     * folder.js) thành công thức 3 nhánh — xem toàn bộ công thức + lý do ngay tại chỗ đọc
     * `folderRecordForFilter` trong thân hàm dưới đây. `applyAllSongsScope()`
     * ("Tất cả") KHÔNG đụng gì tới các field này, LUÔN áp Filter tổng bình thường — CHỈ hàm này
     * (đang xem 1 folder cụ thể) mới có khái niệm "folder tự quyết".
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
        console.log(`writer: "applyFolderScope", page: "isActiveFolderReadOnly", content: "${appState.get('isActiveFolderReadOnly')}"`); // MỚI (02/10/2026) — Rule 4 vốn thiếu

        // cache vừa nạp CHỈ chứa đúng folder này -> không cần giao (intersect) lại, không có Exclude
        loadAllSongs(appState.get('playlistCache'), new Set()); // core/playlist/scope.js
        const beforeCount = appState.get('playlistOrder').length;
        // SỬA (Giang yêu cầu tính năng "folder tự quyết áp dụng Filter" — CHỐT SAU CÙNG, đổi lại lần
        // 2 — xem docstring `applyFilter`/`filterConfig`, core/file-manager/folder.js) — "vua"
        // (Filter tổng, `playlistFilterConfig`) đặt lệnh cho MỌI folder qua 2 field: rule THẬT
        // (`playlistFilterConfig[mediaType]`) VÀ quyền "CHO MƯỢN rule đó lúc folder chưa tự cấu
        // hình" (`playlistFilterAppliesToFolder[mediaType]`, service/state/playlist.js — checkbox
        // "Có áp dụng cho thư mục" trong Filter Presets). TỪNG folder có quyền tự quyết qua
        // `applyFilter` (CÃI LỆNH hẳn nếu `false`, bỏ qua CẢ 2 field vua) VÀ có thể có `filterConfig`
        // RIÊNG (ưu tiên cao nhất, LUÔN thắng — mặc kệ vua cho mượn hay không):
        //   1. `folderRecord.applyFilter === false` -> bucket RỖNG (KHÔNG áp gì, folder cãi lệnh
        //      hoàn toàn — mặc kệ Filter tổng đang gì, mặc kệ filterConfig riêng có gì).
        //   2. `applyFilter !== false` (mặc định `true`) + `filterConfig` CÓ field hợp lệ
        //      (`hasValidPlaylistFilterField()`, core/playlist/filter-presets.js — CÙNG hàm dùng
        //      để chặn "Chọn áp dụng" 1 preset rỗng) -> dùng THẲNG `filterConfig` RIÊNG, KHÔNG
        //      quan tâm Filter tổng/`playlistFilterAppliesToFolder` đang gì.
        //   3. `applyFilter !== false` + `filterConfig` rỗng/null/không field hợp lệ (folder CHƯA
        //      tự cấu hình gì) -> CHỈ nhánh này mới hỏi tới `playlistFilterAppliesToFolder[mediaType]`
        //      (2): `true` -> MƯỢN TẠM Filter tổng đang sống; `false` -> vua TỪ CHỐI cho mượn, bucket
        //      RỖNG (KHÔNG áp gì) dù folder đã bật `applyFilter=true`.
        const folderRecordForFilter = folderRecordForReadOnly; // ĐÃ fetch sẵn ngay trên (readonly) — dùng lại, tránh gọi getFolderRecord() 2 lần cho CÙNG 1 folder trong CÙNG 1 hàm
        const folderApplyFilter = !folderRecordForFilter || folderRecordForFilter.applyFilter !== false; // guard record null hiếm gặp -> coi như mặc định true, KHÔNG chặn hẳn scope
        const folderHasOwnFilter = folderApplyFilter && hasValidPlaylistFilterField(folderRecordForFilter && folderRecordForFilter.filterConfig); // core/playlist/filter-presets.js
        const globalAppliesToFolder = appState.get('playlistFilterAppliesToFolder')[mediaType]; // service/state/playlist.js — CHỈ đọc tới lúc rơi vào nhánh 3 ngay trên
        // SỬA (02/10/2026, rà mục 7) — đọc sẵn 2 bucket TRƯỚC, chuỗi 3 ngôi chỉ còn CHỌN GIÁ TRỊ (trước đây gọi hàm ngay
        // trong nhánh). Công thức 3 nhánh giữ nguyên.
        const defaultRulesBucket = clonePlaylistFilterConfigDefaults()[mediaType]; // core/playlist/filter-presets.js
        const globalRulesBucket = appState.get('playlistFilterConfig')[mediaType];
        const rulesBucket = !folderApplyFilter
            ? defaultRulesBucket
            : (folderHasOwnFilter ? folderRecordForFilter.filterConfig : (globalAppliesToFolder ? globalRulesBucket : defaultRulesBucket));
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), rulesBucket);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyFolderScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType}, applyFilter=${folderApplyFilter}, ownFilter=${folderHasOwnFilter}, globalAppliesToFolder=${globalAppliesToFolder})"`);
        this._reportFinalProgress(progressWasCalled, onProgress, filteredKeys.length); // sửa lại "x/total" đọng lại trên màn loading — số CUỐI CÙNG sau Filter, xem docstring trên
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        workflowPlaylistRender.syncEmptyState(); // SỬA (02/10/2026) — thay core updateEmptyState()
        await this._syncActiveFolderBadge(); // SỬA (02/10/2026) — thay PlaylistMain.updateActiveFolderBadge() (core tự đọc state + DB)
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
        this._clearFolderScopeOf(mediaType); // SỬA (02/10/2026, mục 7) — bước tuỳ chọn -> method mở đầu bằng guard
        appState.set('isActiveFolderReadOnly', false);
        console.log(`writer: "applyAllSongsScope", page: "isActiveFolderReadOnly", content: "false"`); // MỚI (02/10/2026) — Rule 4 vốn thiếu
        const excludedKeys = await getExcludedSongKeysFromFolders(mediaType); // core/file-manager/folder.js — CHỈ Exclude của ĐÚNG mediaType
        loadAllSongs(appState.get('playlistCache'), excludedKeys); // core/playlist/scope.js
        const beforeCount = appState.get('playlistOrder').length;
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType]);
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyAllSongsScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        this._reportFinalProgress(progressWasCalled, onProgress, filteredKeys.length); // xem docstring applyFolderScope()
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        workflowPlaylistRender.syncEmptyState();
        await this._syncActiveFolderBadge();
    },

    /** Tách từ applyFolderScope()/applyAllSongsScope() (02/10/2026, mục 7 — bước tuỳ chọn): báo lại tiến độ với số
     * CUỐI CÙNG sau Filter — chỉ khi lượt nạp vừa rồi THẬT SỰ đã báo tiến độ (có hiện "x/total"). */
    _reportFinalProgress(progressWasCalled, onProgress, finalCount) {
        if (!progressWasCalled) return; // guard
        onProgress(finalCount, finalCount);
    },

    /** Tách từ applyAllSongsScope() (02/10/2026, mục 7) — bỏ Scope folder của Nguồn `mediaType` nếu đang có. */
    _clearFolderScopeOf(mediaType) {
        const current = appState.get('activePlayListFolder');
        if (current[mediaType] == null) return; // guard — vốn không Scope
        const next = { ...current, [mediaType]: null };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyAllSongsScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
    },

    /** Dời từ PlaylistMain.updateActiveFolderBadge() (core/playlist/main.js — core tự appState.get() + tự đọc DB, Rule
     * 2/3b): đọc folder đang Scope của Nguồn hiện tại rồi giao core applyActiveFolderBadge() vẽ. */
    async _syncActiveFolderBadge() {
        const folderId = appState.get('activePlayListFolder')[appState.get('activeMediaSource')];
        applyActiveFolderBadge(!!folderId, await this._readFolderName(folderId)); // core/playlist/main.js
    },

    /** Tên folder theo id ('' nếu không Scope / record không còn). */
    async _readFolderName(folderId) {
        if (!folderId) return ''; // guard — không Scope
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        return folderRecord ? folderRecord.name : '';
    },

    /**
     * Danh sách ảnh/video cho picker chọn từ thư viện — bỏ item thuộc folder Hidden (cùng quy tắc view
     * "Tất cả"). Dùng chung cho mọi picker (bìa bài hát, nền Theme, Visual Background, nền Clock).
     * @param {'photo'|'video'} mediaType
     * @returns {Promise<Array<{key: string}>>}
     */
    async listPickableMedia(mediaType) {
        const [items, excludedKeys] = await Promise.all([
            PICKABLE_MEDIA_LISTER[mediaType](), // service/db.js (SỬA 02/10/2026 — trước đây core/file-manager/image.js | video.js)
            getExcludedSongKeysFromFolders(mediaType), // core/file-manager/folder.js
        ]);
        return filterOutExcludedMedia(items, excludedKeys); // core/playlist/scope.js
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
                { label: t('fileManager.song.folderDetail.reloadBtnNow'), className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent', onClick: () => { window.location.reload(); } }
            ],
            { title: t('fileManager.song.folderDetail.reloadTitle') }
        );
    }
};
