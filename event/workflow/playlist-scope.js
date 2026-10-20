/**
 * event/workflow/playlist-scope.js — Scope Playlist theo folder + nạp lại playlistCache theo Nguồn (Song/Video/Photo).
 *
 * Luồng chuẩn (tap/thoát folder, upload-refresh; boot + đổi Nguồn qua `applyRememberedScope()`): gọi đúng 1 trong 2 —
 * `applyFolderScope(folderId, mediaType, onProgress?)` hoặc `applyAllSongsScope(mediaType, onProgress?)`. Bên trong:
 *   1. List — `listMediaRecords()`: có `folderId` -> chỉ đọc key của folder đó (progress "x/total" khớp số thật);
 *      không có -> cả thư viện. Đọc cả lô trong 1 transaction.
 *   2. Validate — chỉ Song (`filterValidSongRecords`).
 *   3. Adapt — `buildAdaptedPlaylistCache()` (Video/Photo) hoặc `buildSongPlaylistCache()` (core/playlist/loader.js).
 *   4. Scope + Filter — cache chỉ chứa đúng phạm vi nên `loadAllSongs(cache, excludedKeys)` suy ra `playlistOrder`,
 *      rồi `applyPlaylistFilter()` lọc tiếp (Filter của folder: `resolveFolderScopeFilter()`, core/playlist/scope.js).
 *   5. Render + badge.
 * Cache luôn khớp phạm vi hiện tại -> mọi nơi đổi scope chỉ cần gọi lại 1 trong 2 hàm trên.
 *
 * `persistScopeChoice()` — chỉ lưu ý định (meta + badge), gọi trước apply*Scope() ở nơi cần lưu bền (tap tile folder).
 * `listPickableMedia()` — ảnh/video thư viện trừ item thuộc folder Hidden, cho mọi picker.
 * `askReloadToApplyNow()` — modal dùng chung (event/workflow/playlist-filter-presets.js::selectPreset()).
 *
 * NẠP SAU: core/playlist/{scope,filter,filter-presets,loader}.js, core/song-search.js, core/file-manager/video.js,
 * service/db.js, core/modal-choice-ui.js. Lúc chạy: event/workflow/{folder,playlist-order,playlist-render}.js.
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

// Dựng playlistCache theo Nguồn: Song (lọc record hợp lệ rồi dựng cache Song) / Video-Photo (Adapter).
const PLAYLIST_CACHE_BUILD_BY_SOURCE = {
    song: (records) => workflowPlaylistScope._buildSongCache(records),
    video: (records) => workflowPlaylistScope._buildAdaptedCache(records, 'video'),
    photo: (records) => workflowPlaylistScope._buildAdaptedCache(records, 'photo'),
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
        const keys = resolveFolderMapKeys(await getFolderSongMap(folderId)); // service/db.js + core/playlist/scope.js
        const records = await accessor.getRecordsByKeys(keys, onProgress);
        return pairRecordsWithKeys(keys, records); // core/playlist/scope.js
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
        PLAYLIST_CACHE_BUILD_BY_SOURCE[mediaSource](records);
    },

    /** Validate + Adapt Song: lọc record hợp lệ, chuẩn hoá tên cho `songNameIndex`, dựng cache.
     * @param {Array<object>} records @returns {string[]} key đã nạp */
    _buildSongCache(records) {
        const validRecords = filterValidSongRecords(records, appState.get('confirmedBrokenKeys')); // core/playlist/loader.js
        const nameKeys = validRecords.map((record) => normalizeSongName(record.tag.title)); // core/song-search.js
        return buildSongPlaylistCache(validRecords, nameKeys); // core/playlist/loader.js
    },

    /** Adapt Video/Photo: tên hiển thị (customName, hoặc filename bỏ đuôi) + tên chuẩn hoá cho `songNameIndex`, dựng cache.
     * @param {Array<object>} records @param {'video'|'photo'} mediaType @returns {string[]} key đã nạp */
    _buildAdaptedCache(records, mediaType) {
        const titles = records.map((record) => record.customName || stripFileExtension(record.filename)); // core/file-manager/video.js
        const nameKeys = titles.map((title) => normalizeSongName(title)); // core/song-search.js
        return buildAdaptedPlaylistCache(records, mediaType, titles, nameKeys); // core/playlist/loader.js
    },

    /**
     * Lưu ý định scope mới (`meta` + `appState.activePlayListFolder`) — không đụng playlistOrder/cache, đó là việc của
     * applyFolderScope()/applyAllSongsScope() gọi sau.
     * @param {string|null} folderId - null = bỏ scope
     * @param {'song'|'video'|'photo'} mediaType
     */
    async persistScopeChoice(folderId, mediaType) {
        const next = withScopeFolder(appState.get('activePlayListFolder'), mediaType, folderId); // core/playlist/scope.js
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
     * Áp Scope 1 folder — nạp cache chỉ folder này rồi tính playlistOrder + Filter của folder + render + badge. Gọi được bất
     * kỳ lúc nào scope đổi. Chủ ý: không dừng bài đang phát nằm ngoài scope mới (chỉ biến khỏi list, phát hết bình thường).
     * Progress: lúc tải chỉ biết `total` = số record thô trong scope (Filter cần cache dựng xong mới chạy được), nên sau
     * Filter báo lại `onProgress()` 1 lần với số cuối cùng — con số đọng lại trên màn loading khớp số item hiện ra.
     * @param {string} folderId @param {'song'|'video'|'photo'} mediaType @param {(done:number,total:number)=>void} [onProgress]
     */
    async applyFolderScope(folderId, mediaType, onProgress) {
        const progress = this._trackProgress(onProgress);
        await this.loadPlaylistCacheForSource(mediaType, folderId, progress.onProgress);
        const { activePlayListFolder, playlistCache, mediaStatsMap, playlistFilterAppliesToFolder, playlistFilterConfig } = appState.get([
            'activePlayListFolder', 'playlistCache', 'mediaStatsMap', 'playlistFilterAppliesToFolder', 'playlistFilterConfig',
        ]);
        const next = withScopeFolder(activePlayListFolder, mediaType, folderId); // core/playlist/scope.js
        appState.set('activePlayListFolder', next);
        console.log(`writer: "applyFolderScope", page: "activePlayListFolder", content: "${JSON.stringify(next)}"`);
        const folderRecord = await getFolderRecord(folderId); // service/db.js
        const scope = resolveFolderScopeFilter( // core/playlist/scope.js
            folderRecord,
            hasValidPlaylistFilterField(folderRecord && folderRecord.filterConfig), // core/playlist/filter-presets.js
            playlistFilterAppliesToFolder[mediaType],
            playlistFilterConfig[mediaType],
            clonePlaylistFilterConfigDefaults()[mediaType], // core/playlist/filter-presets.js
        );
        appState.set('isActiveFolderReadOnly', scope.isReadOnly);
        console.log(`writer: "applyFolderScope", page: "isActiveFolderReadOnly", content: "${scope.isReadOnly}"`);
        const scopedKeys = loadAllSongs(playlistCache, new Set()); // core/playlist/scope.js — cache chỉ chứa đúng folder này, không có Exclude
        const filteredKeys = applyPlaylistFilter(scopedKeys, playlistCache, mediaStatsMap, scope.rulesBucket, mediaType); // core/playlist/filter.js
        await this._finishScope(filteredKeys, progress, onProgress,
            `Filter: ${filteredKeys.length}/${scopedKeys.length} sau lọc (source=${mediaType}, applyFilter=${scope.applyFilter}, ownFilter=${scope.ownFilter}, globalAppliesToFolder=${playlistFilterAppliesToFolder[mediaType]})`);
    },

    /**
     * Áp "Tất cả" — nạp lại toàn bộ cache rồi tính playlistOrder (trừ Exclude) + Filter tổng + render + badge. Cùng nguyên
     * tắc và cách báo progress với `applyFolderScope()`.
     * @param {'song'|'video'|'photo'} mediaType @param {(done:number,total:number)=>void} [onProgress]
     */
    async applyAllSongsScope(mediaType, onProgress) {
        const progress = this._trackProgress(onProgress);
        await this.loadPlaylistCacheForSource(mediaType, null, progress.onProgress);
        this._clearFolderScopeOf(mediaType);
        appState.set('isActiveFolderReadOnly', false);
        console.log(`writer: "applyAllSongsScope", page: "isActiveFolderReadOnly", content: "false"`);
        const excludedKeys = await workflowFolder.readExcludedKeys(mediaType); // event/workflow/folder.js — chỉ Exclude của đúng mediaType
        const { playlistCache, mediaStatsMap, playlistFilterConfig } = appState.get(['playlistCache', 'mediaStatsMap', 'playlistFilterConfig']);
        const scopedKeys = loadAllSongs(playlistCache, excludedKeys); // core/playlist/scope.js
        const filteredKeys = applyPlaylistFilter(scopedKeys, playlistCache, mediaStatsMap, playlistFilterConfig[mediaType], mediaType); // core/playlist/filter.js
        await this._finishScope(filteredKeys, progress, onProgress, `Filter: ${filteredKeys.length}/${scopedKeys.length} sau lọc (source=${mediaType})`);
    },

    /** Bọc onProgress để biết lượt tải có báo tiến độ không (thư viện/folder rỗng -> không lần nào, lớp loading không hiện).
     * @param {Function} [onProgress] @returns {{called: boolean, onProgress: Function|undefined}} */
    _trackProgress(onProgress) {
        const progress = { called: false, onProgress: undefined };
        if (typeof onProgress === 'function') progress.onProgress = (done, total) => { progress.called = true; onProgress(done, total); };
        return progress;
    },

    /** Phần chung cuối 2 kiểu Scope: ghi playlistOrder đã lọc, báo số cuối cùng, tính lại thứ tự, vẽ lại + badge. */
    async _finishScope(filteredKeys, progress, onProgress, logContent) {
        appState.set('playlistOrder', filteredKeys);
        console.log(`writer: "workflowPlaylistScope._finishScope", page: "playlistOrder", content: "${logContent}"`);
        this._reportFinalProgress(progress.called, onProgress, filteredKeys.length);
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
        const next = withScopeFolder(current, mediaType, null); // core/playlist/scope.js
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
