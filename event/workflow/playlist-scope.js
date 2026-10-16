/**
 * event/workflow/playlist-scope.js — Scope Playlist theo folder + nạp lại playlistCache theo Nguồn (Song/Video/Photo).
 *
 * Luồng chuẩn (tap/thoát folder, upload-refresh; boot + đổi Nguồn qua `applyRememberedScope()`): gọi ĐÚNG 1 trong 2 —
 * `applyFolderScope(folderId, mediaType, onProgress?)` hoặc `applyAllSongsScope(mediaType, onProgress?)`. Bên trong:
 *   1. List — `listMediaRecords()`: có `folderId` -> chỉ đọc key của folder đó (progress "x/total" khớp số thật);
 *      không có -> cả thư viện. Đọc cả lô trong 1 transaction.
 *   2. Validate — chỉ Song (`filterValidSongRecords`).
 *   3. Adapt — `buildAdaptedPlaylistCache()` (Video/Photo) hoặc `buildSongPlaylistCache()` (core/playlist/loader.js).
 *   4. Scope + Filter — cache chỉ chứa đúng phạm vi nên `loadAllSongs(cache, excludedKeys)` suy ra `playlistOrder`,
 *      rồi `applyPlaylistFilter()` lọc tiếp.
 *   5. Render + badge.
 * Cache luôn khớp phạm vi hiện tại -> mọi nơi đổi scope chỉ cần gọi lại 1 trong 2 hàm trên.
 *
 * `persistScopeChoice()` — chỉ lưu ý định (meta + badge), gọi trước apply*Scope() ở nơi cần lưu bền (tap tile folder).
 * `listPickableMedia()` — ảnh/video thư viện trừ item thuộc folder Hidden, cho mọi picker.
 * `askReloadToApplyNow()` — modal dùng chung (event/workflow/playlist-filter-presets.js::selectPreset()).
 *
 * NẠP SAU: core/playlist/{scope,filter,filter-presets,loader}.js, service/db.js, event/workflow/playlist-order.js,
 * core/modal-choice-ui.js. Lúc chạy: event/workflow/{folder,playlist-render}.js.
 */
// mediaType -> đọc record cả lô trong 1 transaction (toàn thư viện = cursor; theo danh sách key = nhiều get trong 1 tx).
// Thêm loại media mới: 1 dòng ở đây + 1 entry MEDIA_ADAPTER_SHAPE (core/playlist/loader.js).
const MEDIA_DB_ACCESSOR = {
    song: { getAllRecords: getAllSongRecords, getRecordsByKeys: getSongRecordsByKeys },
    video: { getAllRecords: getAllVideoRecords, getRecordsByKeys: getVideoRecordsByKeys },
    photo: { getAllRecords: getAllImageRecords, getRecordsByKeys: getImageRecordsByKeys },
};

// mediaType -> liệt kê thư viện cho listPickableMedia().
const PICKABLE_MEDIA_LISTER = {
    photo: () => getAllImageRecords(), // service/db.js
    video: () => getAllVideoRecords(), // service/db.js
};

// Dựng playlistCache: Song (lọc record hợp lệ rồi dựng cache Song) / Video-Photo (Adapter).
const PLAYLIST_CACHE_BUILD_BY_IS_SONG = {
    true: (records) => buildSongPlaylistCache(filterValidSongRecords(records, appState.get('confirmedBrokenKeys'))), // core/playlist/loader.js
    false: (records, mediaSource) => buildAdaptedPlaylistCache(records, mediaSource), // core/playlist/loader.js
};

// listMediaRecords(): có folderId -> chỉ đọc key của folder đó; không -> cả thư viện.
const MEDIA_RECORDS_BY_FOLDER_SCOPED = {
    true: (accessor, folderId, onProgress) => workflowPlaylistScope._listFolderMediaRecords(accessor, folderId, onProgress),
    false: (accessor, folderId, onProgress) => accessor.getAllRecords(onProgress),
};

// applyRememberedScope(): Nguồn có folder Scope đang nhớ -> áp folder đó; không -> cả thư viện.
const PLAYLIST_SCOPE_APPLY_BY_HAS_FOLDER = {
    true: (folderId, mediaType, onProgress) => workflowPlaylistScope.applyFolderScope(folderId, mediaType, onProgress),
    false: (folderId, mediaType, onProgress) => workflowPlaylistScope.applyAllSongsScope(mediaType, onProgress),
};

const workflowPlaylistScope = {

    /**
     * List — đọc record (toàn bộ thư viện, hoặc chỉ của 1 folder) qua `MEDIA_DB_ACCESSOR`, cả lô trong 1 transaction.
     * `onProgress(done, total)` — `total` khớp đúng số record sẽ đọc.
     * @param {'song'|'video'|'photo'} mediaType
     * @param {string|null} [folderId] - có giá trị -> CHỈ đọc key của folder này
     * @param {(done:number,total:number)=>void} [onProgress]
     * @returns {Promise<Array<object>>} mảng record (đã gộp `key`), record null/rỗng đã lọc bỏ
     */
    async listMediaRecords(mediaType, folderId, onProgress) {
        return MEDIA_RECORDS_BY_FOLDER_SCOPED[!!folderId](MEDIA_DB_ACCESSOR[mediaType], folderId, onProgress);
    },

    /** Record của đúng các key trong 1 folder, đọc trong 1 transaction.
     * @param {{getRecordsByKeys: Function}} accessor @param {string} folderId @param {Function} [onProgress] */
    async _listFolderMediaRecords(accessor, folderId, onProgress) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        const keys = folderMap ? folderMap.list.filter((k) => k != null) : []; // chọn GIÁ TRỊ
        const records = await accessor.getRecordsByKeys(keys, onProgress);
        return keys.map((key, i) => (records[i] ? { key, ...records[i] } : null)).filter(Boolean);
    },

    /**
     * List + Validate + Adapt — nạp lại `playlistCache`/`songNameIndex` đúng phạm vi. Không đụng `playlistOrder`/render
     * (việc của apply*Scope(), gọi hàm này bên trong).
     * @param {'song'|'video'|'photo'} mediaSource
     * @param {string|null} [folderId]
     * @param {(done:number,total:number)=>void} [onProgress]
     */
    async loadPlaylistCacheForSource(mediaSource, folderId, onProgress) {
        const records = await this.listMediaRecords(mediaSource, folderId, onProgress);
        PLAYLIST_CACHE_BUILD_BY_IS_SONG[mediaSource === 'song'](records, mediaSource);
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

    /** Áp Scope đang nhớ của 1 Nguồn (boot, đổi Nguồn): `folderId` null -> cả thư viện (vẫn lọc Exclude).
     * @param {string|null} folderId @param {'song'|'video'|'photo'} mediaType @param {Function} [onProgress] */
    applyRememberedScope(folderId, mediaType, onProgress) {
        return PLAYLIST_SCOPE_APPLY_BY_HAS_FOLDER[!!folderId](folderId, mediaType, onProgress);
    },

    /**
     * Áp Scope 1 folder — nạp cache chỉ folder này rồi tính playlistOrder + Filter + render + badge. Gọi được bất kỳ lúc
     * nào scope đổi. Chủ ý: không dừng bài đang phát nằm ngoài scope mới (chỉ biến khỏi list, phát hết bình thường).
     * Progress: lúc tải chỉ biết `total` = số record thô trong scope (Filter cần cache dựng xong mới chạy được), nên sau
     * Filter báo lại `onProgress()` 1 lần với số cuối cùng — con số đọng lại trên màn loading khớp số item hiện ra.
     * Filter của folder: công thức 3 nhánh, ghi tại chỗ tính `rulesBucket`. `applyAllSongsScope()` luôn áp Filter tổng.
     * @param {string} folderId
     * @param {'song'|'video'|'photo'} mediaType
     * @param {(done:number,total:number)=>void} [onProgress]
     */
    async applyFolderScope(folderId, mediaType, onProgress) {
        // Bọc onProgress để biết lượt tải có báo tiến độ không (thư viện/folder rỗng -> không lần nào, lớp loading không
        // hiện) — nếu không thì bỏ bước báo lại số cuối, tránh làm hiện overlay.
        let progressWasCalled = false;
        const trackedOnProgress = typeof onProgress === 'function' ? (done, total) => { progressWasCalled = true; onProgress(done, total); } : undefined;
        await this.loadPlaylistCacheForSource(mediaType, folderId, trackedOnProgress);
        const next = { ...appState.get('activePlayListFolder'), [mediaType]: folderId };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        const folderRecordForReadOnly = await getFolderRecord(folderId); // service/db.js
        appState.set('isActiveFolderReadOnly', !!(folderRecordForReadOnly && folderRecordForReadOnly.isReadOnly));
        console.log(`writer: "applyFolderScope", page: "isActiveFolderReadOnly", content: "${appState.get('isActiveFolderReadOnly')}"`);

        // cache vừa nạp CHỈ chứa đúng folder này -> không cần giao (intersect) lại, không có Exclude
        loadAllSongs(appState.get('playlistCache'), new Set()); // core/playlist/scope.js
        const beforeCount = appState.get('playlistOrder').length;
        // Filter của folder — Filter tổng (`playlistFilterConfig`) kèm quyền "cho mượn" (`playlistFilterAppliesToFolder`,
        // checkbox trong Filter Presets); từng folder tự quyết qua `applyFilter`/`filterConfig` (core/file-manager/folder.js):
        //   1. `applyFilter === false` -> bucket rỗng (không áp gì).
        //   2. `filterConfig` riêng có field hợp lệ (`hasValidPlaylistFilterField()`) -> dùng nó, luôn thắng.
        //   3. Folder chưa tự cấu hình -> `playlistFilterAppliesToFolder[mediaType]`: true = mượn Filter tổng, false = rỗng.
        const folderRecordForFilter = folderRecordForReadOnly; // dùng lại record vừa đọc
        const folderApplyFilter = !folderRecordForFilter || folderRecordForFilter.applyFilter !== false; // record null hiếm -> coi như true
        const folderHasOwnFilter = folderApplyFilter && hasValidPlaylistFilterField(folderRecordForFilter && folderRecordForFilter.filterConfig); // core/playlist/filter-presets.js
        const globalAppliesToFolder = appState.get('playlistFilterAppliesToFolder')[mediaType]; // service/state/playlist.js
        const defaultRulesBucket = clonePlaylistFilterConfigDefaults()[mediaType]; // core/playlist/filter-presets.js
        const globalRulesBucket = appState.get('playlistFilterConfig')[mediaType];
        const rulesBucket = !folderApplyFilter
            ? defaultRulesBucket
            : (folderHasOwnFilter ? folderRecordForFilter.filterConfig : (globalAppliesToFolder ? globalRulesBucket : defaultRulesBucket));
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), rulesBucket, mediaType); // core/playlist/filter.js
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyFolderScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType}, applyFilter=${folderApplyFilter}, ownFilter=${folderHasOwnFilter}, globalAppliesToFolder=${globalAppliesToFolder})"`);
        this._reportFinalProgress(progressWasCalled, onProgress, filteredKeys.length); // số cuối cùng sau Filter
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        workflowPlaylistRender.syncEmptyState();
        await this.syncActiveFolderBadge();
    },

    /**
     * Áp "Tất cả" — nạp lại toàn bộ cache rồi tính playlistOrder (trừ Exclude) + Filter + render + badge. Cùng nguyên
     * tắc và cách báo progress với `applyFolderScope()`.
     * @param {'song'|'video'|'photo'} mediaType
     * @param {(done:number,total:number)=>void} [onProgress]
     */
    async applyAllSongsScope(mediaType, onProgress) {
        let progressWasCalled = false;
        const trackedOnProgress = typeof onProgress === 'function' ? (done, total) => { progressWasCalled = true; onProgress(done, total); } : undefined;
        await this.loadPlaylistCacheForSource(mediaType, null, trackedOnProgress);
        this._clearFolderScopeOf(mediaType);
        appState.set('isActiveFolderReadOnly', false);
        console.log(`writer: "applyAllSongsScope", page: "isActiveFolderReadOnly", content: "false"`);
        const excludedKeys = await workflowFolder.readExcludedKeys(mediaType); // event/workflow/folder.js — CHỈ Exclude của ĐÚNG mediaType
        loadAllSongs(appState.get('playlistCache'), excludedKeys); // core/playlist/scope.js
        const beforeCount = appState.get('playlistOrder').length;
        const filteredKeys = applyPlaylistFilter(appState.get('playlistOrder'), appState.get('playlistCache'), appState.get('mediaStatsMap'), appState.get('playlistFilterConfig')[mediaType], mediaType); // core/playlist/filter.js
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "applyAllSongsScope", page: "playlistOrder", content: "Filter: ${filteredKeys.length}/${beforeCount} sau lọc (source=${mediaType})"`);
        this._reportFinalProgress(progressWasCalled, onProgress, filteredKeys.length);
        workflowPlaylistOrder.updateShuffleArray();
        workflowPlaylistOrder.recomputeDisplayOrder();
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff();
        workflowPlaylistRender.syncEmptyState();
        await this.syncActiveFolderBadge();
    },

    /** Báo lại tiến độ với số cuối cùng sau Filter — chỉ khi lượt nạp vừa rồi thật sự đã báo tiến độ. */
    _reportFinalProgress(progressWasCalled, onProgress, finalCount) {
        if (!progressWasCalled) return; // guard
        onProgress(finalCount, finalCount);
    },

    /** Bỏ Scope folder của Nguồn `mediaType` nếu đang có. */
    _clearFolderScopeOf(mediaType) {
        const current = appState.get('activePlayListFolder');
        if (current[mediaType] == null) return; // guard — vốn không Scope
        const next = { ...current, [mediaType]: null };
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyAllSongsScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
    },

    /** Badge "đang xem folder" trong ô tìm kiếm: đọc folder đang Scope của Nguồn hiện tại (tên đọc lại từ DB) rồi giao
     * core applyActiveFolderBadge() vẽ. Gọi sau mỗi lần áp Scope và sau khi đổi tên folder (workflowFolder.rename()). */
    async syncActiveFolderBadge() {
        const { activePlayListFolder, activeMediaSource } = appState.get(['activePlayListFolder', 'activeMediaSource']);
        const folderId = activePlayListFolder[activeMediaSource];
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
            PICKABLE_MEDIA_LISTER[mediaType](), // service/db.js
            workflowFolder.readExcludedKeys(mediaType), // event/workflow/folder.js
        ]);
        return filterOutExcludedMedia(items, excludedKeys); // core/playlist/scope.js
    },

    /**
     * Modal dùng chung — hỏi "tải lại trang để áp dụng ngay?" (event/workflow/playlist-filter-presets.js::selectPreset()).
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
