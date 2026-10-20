/**
 * core/playlist/scope.js — phạm vi Playlist (hàm thuần + ghi `playlistOrder`): view "Tất cả" bỏ item thuộc folder Hidden
 * (`excludeFromMainPlaylist`), Scope 1 folder (key của folder, Filter của folder, folder đang Scope theo Nguồn).
 * `playlistCache` luôn khớp đúng phạm vi hiện tại (nạp bởi `workflowPlaylistScope.loadPlaylistCacheForSource()`), nên
 * không cần giao lại với folder. Tập key bị loại: `workflowFolder.readExcludedKeys()` (event/workflow/folder.js).
 *
 * NẠP SAU: (không phụ thuộc — chỉ đọc tham số).
 */

/**
 * Ghi `playlistOrder` = mọi key trong `playlistCache` trừ `excludedKeys` (truyền `new Set()` khi đang Scope 1 folder —
 * Hidden chỉ có nghĩa ở view "Tất cả"). Không tự chạy pipeline render.
 * @param {Map} playlistCache @param {Set<string>} excludedKeys
 * @returns {string[]} playlistOrder vừa ghi
 */
function loadAllSongs(playlistCache, excludedKeys) {
    const keys = Array.from(playlistCache.keys()).filter((k) => !excludedKeys.has(k));
    appState.set('playlistOrder', keys);
    console.log(`writer: "loadAllSongs", page: "playlistOrder", content: "${keys.length} bài (đã loại ${excludedKeys.size} bài exclude)"`);
    return keys;
}

/**
 * Bỏ item thuộc folder Hidden khỏi 1 danh sách media thư viện (picker chọn ảnh/video) — cùng quy tắc `loadAllSongs()`.
 * @param {Array<{key: string}>} items @param {Set<string>} excludedKeys @returns {Array<{key: string}>}
 */
function filterOutExcludedMedia(items, excludedKeys) {
    return items.filter((item) => !excludedKeys.has(item.key));
}

/** `activePlayListFolder` mới với folder đang Scope của 1 Nguồn (null = bỏ Scope).
 * @param {Object<string, string|null>} activePlayListFolder @param {'song'|'video'|'photo'} mediaType
 * @param {string|null|undefined} folderId @returns {Object<string, string|null>} */
function withScopeFolder(activePlayListFolder, mediaType, folderId) {
    return { ...activePlayListFolder, [mediaType]: folderId ?? null };
}

/** Key media của 1 folder (bỏ ô null), theo thứ tự trong folder. @param {{list: Array<string|null>}|undefined} folderMap @returns {string[]} */
function resolveFolderMapKeys(folderMap) {
    return folderMap ? folderMap.list.filter((k) => k != null) : [];
}

/** Gộp `key` vào record đọc theo danh sách key (cùng chỉ số), bỏ record không còn.
 * @param {string[]} keys @param {Array<object|undefined>} records @returns {Array<object>} */
function pairRecordsWithKeys(keys, records) {
    return keys.map((key, i) => (records[i] ? { key, ...records[i] } : null)).filter(Boolean);
}

/**
 * Read-only + Filter áp cho Scope 1 folder. Filter tổng (`playlistFilterConfig`) kèm quyền "cho mượn"
 * (`playlistFilterAppliesToFolder`, checkbox trong Filter Presets); từng folder tự quyết qua `applyFilter`/`filterConfig`
 * (core/file-manager/folder.js):
 *   1. `applyFilter === false` -> bucket mặc định (không lọc gì).
 *   2. `filterConfig` riêng có field hợp lệ -> dùng nó, luôn thắng.
 *   3. Folder chưa tự cấu hình -> mượn Filter tổng nếu được cho mượn, không thì bucket mặc định.
 * Record null (hiếm) coi như applyFilter true, không Read-only.
 * @param {object|undefined} folderRecord
 * @param {boolean} hasOwnFilterField - `hasValidPlaylistFilterField(folderRecord.filterConfig)` (core/playlist/filter-presets.js)
 * @param {boolean} globalAppliesToFolder - `playlistFilterAppliesToFolder[mediaType]`
 * @param {object} globalRulesBucket - `playlistFilterConfig[mediaType]` @param {object} defaultRulesBucket - bucket mặc định của Nguồn
 * @returns {{isReadOnly: boolean, applyFilter: boolean, ownFilter: boolean, rulesBucket: object}}
 */
function resolveFolderScopeFilter(folderRecord, hasOwnFilterField, globalAppliesToFolder, globalRulesBucket, defaultRulesBucket) {
    const applyFilter = !folderRecord || folderRecord.applyFilter !== false;
    const ownFilter = applyFilter && hasOwnFilterField;
    const borrowedBucket = globalAppliesToFolder ? globalRulesBucket : defaultRulesBucket;
    const rulesBucket = !applyFilter ? defaultRulesBucket : (ownFilter ? folderRecord.filterConfig : borrowedBucket);
    return { isReadOnly: !!(folderRecord && folderRecord.isReadOnly), applyFilter, ownFilter, rulesBucket };
}
