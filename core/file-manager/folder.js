/**
 * core/file-manager/folder.js — nghiệp vụ Folder (Song/Video/Photo).
 *
 * Core chỉ GHI (service/db.js: setFolderRecord/setFolderSongMap/setMeta/updateMediaMetaBatch...) hoặc TÍNH THUẦN trên dữ
 * liệu nhận qua tham số. Mọi việc ĐỌC DB (folder record, folder_song, meta, meta media) do Workflow
 * `workflowFolder` (event/workflow/folder.js) làm rồi truyền vào (Rule 3b).
 *
 * Schema:
 *   folders     : { [folderId]: { id, name, type, excludeFromMainPlaylist, isReadOnly, applyFilter, filterConfig } }
 *     - type: 'song'|'video'|'photo', gán lúc tạo. Folder cũ có thể `type` null -> đọc là 'song'.
 *     - excludeFromMainPlaylist (Hidden, vắng = false): item bị loại khỏi view "Tất cả" và khỏi picker
 *       chọn ảnh/video; không ảnh hưởng view Scope của chính folder đó.
 *     - isReadOnly (vắng = false): chặn thêm/gỡ item + đổi tên; KHÔNG chặn xoá folder.
 *     - applyFilter (vắng = TRUE — đọc bằng `!== false`) + filterConfig (null = chưa cấu hình, cùng
 *       shape `playlistFilterConfig[mediaType]`) — công thức áp: event/workflow/playlist-scope.js::applyFolderScope().
 *   folder_song : { [folderId]: { list: [key|null, ...], empty: number } } — gỡ item = tombstone null
 *                 (không splice, giữ nguyên vị trí).
 *   meta media  : meta.folder = { [folderId]: position } — vị trí của item trong folder_song.list.
 *   meta.folderIndex      : { song: [], video: [], photo: [] } — folderId gom sẵn theo type, duy trì
 *                           bởi createFolder()/deleteFolder(); build 1 lần lúc boot (workflowFolder.migrateOnBoot()).
 *   meta.deletedFolderIds : id đã từng bị xoá — không bao giờ cấp lại (xem computeUniqueFolderId()).
 *
 * NẠP SAU: service/db.js, lang (t/tFormat).
 */

const FOLDER_INDEX_EMPTY = Object.freeze({ song: [], video: [], photo: [] });

// ============================== Tính thuần ==============================

/** Pure — id folder của ĐÚNG 1 type (`folderIndex` vắng/thiếu nhóm -> []). Type null (folder cũ) -> []. */
function pickFolderIndexIdsOfType(folderIndex, type) {
    return ((folderIndex || FOLDER_INDEX_EMPTY)[type]) || [];
}

/** Pure — id folder theo type; không truyền `type` -> cả 3 loại (thứ tự song, video, photo). */
function resolveFolderIndexIds(folderIndex, type) {
    const index = folderIndex || FOLDER_INDEX_EMPTY;
    return type ? (index[type] || []) : [...(index.song || []), ...(index.video || []), ...(index.photo || [])];
}

/** Pure — bỏ record null (folder vừa bị xoá giữa lúc đọc). */
function pickExistingFolderRecords(records) {
    return records.filter(Boolean);
}

/** Pure — trùng tên (case-sensitive) với 1 folder khác `exceptFolderId` trong danh sách cùng type. */
function isFolderNameTaken(sameTypeFolders, name, exceptFolderId) {
    return sameTypeFolders.some((f) => f.id !== exceptFolderId && f.name === name);
}

/**
 * Pure — sinh folderId duy nhất: `${slug}-${type}` (+ `-2`, `-3`... nếu trùng). Không cấp lại id nằm trong
 * `deletedIds` — item từng bị tombstone trước khi folder bị xoá vẫn còn `meta.folder[id]` cũ; tái dùng id sẽ khiến
 * addSongsToFolder() đọc nhầm vị trí đó thành 'đã ở trong folder'.
 * @param {string} name @param {'song'|'video'|'photo'} type
 * @param {string[]} takenIds - mọi key store `folders` @param {string[]|undefined} deletedIds - meta.deletedFolderIds
 * @returns {string}
 */
function computeUniqueFolderId(name, type, takenIds, deletedIds) {
    const baseSlug = `${slugify(name) || 'folder'}-${type}`; // service/db.js
    const usedIds = new Set([...(takenIds || []), ...(deletedIds || [])]);
    let candidate = baseSlug;
    let suffix = 2;
    while (usedIds.has(candidate)) { candidate = `${baseSlug}-${suffix}`; suffix++; }
    return candidate;
}

/** Pure — id các folder Hidden (`excludeFromMainPlaylist`). */
function pickExcludedFolderIds(records) {
    return records.filter((r) => r.excludeFromMainPlaylist).map((r) => r.id);
}

/** Pure — hợp mọi key thật (bỏ tombstone) của các folder_song; map null (folder vừa bị xoá) bỏ qua. @returns {Set<string>} */
function collectFolderItemKeySet(folderMaps) {
    const keys = new Set();
    for (const folderMap of folderMaps) {
        if (!folderMap) continue; // guard: folder vừa bị xoá giữa lúc gom
        for (const key of folderMap.list) { if (key != null) keys.add(key); }
    }
    return keys;
}

/** Pure — chỉ giữ folder có ≥1 item thật; `folderMaps` thẳng hàng với `folders`. */
function pickNonEmptyFolders(folders, folderMaps) {
    return folders.filter((_, i) => folderMaps[i] && folderMaps[i].list.some((k) => k != null));
}

/** Pure — id các folder item đang thuộc (theo `meta.folder`). */
function listItemFolderIds(itemMeta) {
    return Object.keys((itemMeta && itemMeta.folder) || {});
}

/** Pure — tổng dung lượng Blob chính của các record (record null / thiếu blob tính 0). */
function sumFolderRecordBytes(records) {
    return records.reduce((sum, record) => sum + (record && record.blob ? record.blob.size : 0), 0);
}

/** Pure — build `meta.folderIndex` từ toàn bộ record `folders` (folder chưa có type xếp vào 'song', bỏ id lặp). */
function buildFolderIndexFromRecords(records) {
    const folderIndex = { song: [], video: [], photo: [] };
    const seenIds = new Set();
    for (const record of records) {
        const type = record.type || 'song';
        if (seenIds.has(`${type}:${record.id}`)) continue; // guard: id lặp
        seenIds.add(`${type}:${record.id}`);
        folderIndex[type] = [...(folderIndex[type] || []), record.id];
    }
    return folderIndex;
}

/** Pure — `meta.activePlayListFolder` dạng cũ (string phẳng) -> `{song, video, photo}`; giá trị cũ gán vào đúng field theo
 * type của folder đó (`folderRecord` null = folder đã mất -> bỏ). */
function computeMigratedActivePlayListFolder(oldValue, folderRecord) {
    const next = { song: null, video: null, photo: null };
    const type = folderRecord ? (folderRecord.type || 'song') : null;
    if (type && Object.prototype.hasOwnProperty.call(next, type)) next[type] = oldValue;
    return next;
}

/** Pure — key đang thật sự trong folder (bỏ tombstone null). */
function getFolderSongKeys(folderMap) {
    return folderMap.list.filter(k => k != null);
}

/** Pure — folder rỗng hoàn toàn, O(1). */
function isFolderEmpty(folderMap) {
    return folderMap.empty === folderMap.list.length;
}

/** Pure — tên mặc định "Thư mục N" cho folder mới (Folder Browser), chưa trùng tên folder nào trong `folders`. */
function computeNextFolderName(folders) {
    const existingNames = new Set(folders.map((f) => f.name));
    let n = folders.length + 1;
    let name = tFormat('fileManager.folderBrowser.defaultNewFolderName', { n });
    while (existingNames.has(name)) { n++; name = tFormat('fileManager.folderBrowser.defaultNewFolderName', { n }); }
    return name;
}

/** Pure — tên mặc định "Thư mục mới" / "Thư mục mới 2"… cho folder tạo từ picker "Thêm vào thư mục". */
function computeNextPickerFolderName(folders) {
    const base = t('fileManager.folderPicker.defaultNewFolderName');
    const existingNames = new Set(folders.map((f) => f.name));
    let name = base;
    let n = 2;
    while (existingNames.has(name)) { name = `${base} ${n}`; n++; }
    return name;
}

/** Pure — chuẩn hoá tên gõ ở ô sửa tên folder (bỏ khoảng trắng 2 đầu; null/undefined -> ''). */
function normalizeFolderNameInput(name) {
    return (name || '').trim();
}

/** Pure — Map<folderId, thứ tự chọn (từ 1)> cho badge số trên tile picker multi-select; không multi-select -> null
 * (không badge). @param {string[]} selectedIds @param {boolean} isMultiSelect @returns {Map<string, number>|null} */
function computeFolderSelectionOrder(selectedIds, isMultiSelect) {
    return isMultiSelect ? new Map(selectedIds.map((id, i) => [id, i + 1])) : null;
}

/** Pure — tuỳ chọn mở picker folder (workflowPlaylist._openFolderPickerDrawer()) -> đủ field; thiếu -> mặc định của 2
 * luồng "Thêm vào thư mục" Playlist (có tile "Tạo folder mới", chọn 1, đóng hẳn Drawer). `selectedIds` chỉ giữ khi
 * multi-select. @param {object} [options] @returns {object} */
function resolveFolderPickerOptions(options) {
    const opts = options || {};
    return {
        folders: opts.folders || null,
        showAddTile: opts.showAddTile !== false,
        emptyMsg: opts.emptyMsg || '',
        onClose: opts.onClose || null,
        multiSelect: !!opts.multiSelect,
        selectedIds: opts.multiSelect ? (opts.selectedIds || []) : [],
        typeOptions: opts.typeOptions || null,
        onTypeChange: opts.onTypeChange || null,
    };
}

/** Pure — loại folder đang duyệt trong picker có dropdown đổi loại; không có dropdown -> null.
 * @param {{current: string}|null} typeOptions @returns {string|null} */
function resolveFolderPickerType(typeOptions) {
    return typeOptions ? typeOptions.current : null;
}

/** Pure — @param {Array<{id: string}>} folders @param {string} folderId @returns {object|undefined} */
function findFolderById(folders, folderId) {
    return folders.find((f) => f.id === folderId);
}

/** Pure — bật/tắt chọn 1 folder trong danh sách đã chọn (giữ thứ tự chọn), trả mảng MỚI. */
function toggleFolderSelection(selectedIds, folderId) {
    return selectedIds.includes(folderId) ? selectedIds.filter((id) => id !== folderId) : [...selectedIds, folderId];
}

/** Pure — folder làm đích được cho picker "Thêm vào thư mục": bỏ folder đang là Scope (mục đã hiện qua nó) và folder
 * Read-only. @param {Array<{id: string, isReadOnly?: boolean}>} folders @param {string|null} activeFolderId @returns {Array} */
function pickFoldersForAddPicker(folders, activeFolderId) {
    return folders.filter((f) => f.id !== activeFolderId && !f.isReadOnly);
}

// ============================== Ghi ==============================

/**
 * Tạo 1 folder rỗng với `folderId` đã resolve sẵn (computeUniqueFolderId()) — Workflow đã kiểm tên trùng. Tạo xong push id
 * vào `folderIndex[type]`.
 * @param {string} folderId @param {string} name @param {'song'|'video'|'photo'} type
 * @param {{song: string[], video: string[], photo: string[]}|undefined} folderIndex - meta.folderIndex hiện tại
 * @returns {Promise<{status: 'ok', folderId: string}>}
 */
async function createFolder(folderId, name, type, folderIndex) {
    await setFolderRecord(folderId, { id: folderId, name, type, isReadOnly: false, applyFilter: true, filterConfig: null }); // service/db.js
    await setFolderSongMap(folderId, { list: [], empty: 0 }); // service/db.js
    const nextIndex = { ...FOLDER_INDEX_EMPTY, ...(folderIndex || {}) };
    nextIndex[type] = [...(nextIndex[type] || []), folderId];
    await setMeta('folderIndex', nextIndex); // service/db.js
    return { status: 'ok', folderId };
}

/** Ghi tên mới cho record đã đọc sẵn (Workflow đã kiểm tên trùng). @param {object} record @param {string} newName */
async function renameFolder(record, newName) {
    record.name = newName;
    await setFolderRecord(record.id, record); // service/db.js
}

/**
 * Xoá 1 folder: dọn `meta.folder[folderId]` trên từng item đang có trong folder -> xoá folder_song -> xoá record folders
 * -> bớt khỏi `folderIndex` (dò cả 3 nhóm) -> ghi vào `deletedFolderIds`. Workflow đọc sẵn dữ liệu rồi truyền vào.
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} mediaType
 * @param {{list: Array<string|null>, empty: number}} folderMap
 * @param {{song: string[], video: string[], photo: string[]}|undefined} folderIndex - meta.folderIndex hiện tại
 * @param {string[]|undefined} deletedIds - meta.deletedFolderIds hiện tại
 * @returns {Promise<{status: 'ok'}>}
 */
async function deleteFolder(folderId, mediaType, folderMap, folderIndex, deletedIds) {
    const itemKeys = folderMap.list.filter((k) => k != null);
    await updateMediaMetaBatch(itemKeys.map((key) => ({ // service/db.js
        type: mediaType,
        key,
        mutate: (meta) => {
            if (!meta.folder) return meta; // item không còn field folder — giữ nguyên
            const folder = { ...meta.folder };
            delete folder[folderId];
            return { ...meta, folder };
        },
    })));

    await deleteFolderSongMap(folderId);
    await deleteFolderRecord(folderId);

    const nextIndex = { ...FOLDER_INDEX_EMPTY, ...(folderIndex || {}) };
    ['song', 'video', 'photo'].forEach((type) => { nextIndex[type] = (nextIndex[type] || []).filter((id) => id !== folderId); });
    await setMeta('folderIndex', nextIndex); // service/db.js
    const prevDeletedIds = deletedIds || [];
    if (!prevDeletedIds.includes(folderId)) await setMeta('deletedFolderIds', [...prevDeletedIds, folderId]);
    console.log(`[deleteFolder] xoá folder "${folderId}" (${mediaType}), dọn field folder trên ${itemKeys.length} item`);
    return { status: 'ok' };
}

/** Đặt mọi folder về rỗng (giữ record `folders`) — dùng khi xoá sạch thư viện. @param {string[]} folderIds */
async function clearAllFolderSongData(folderIds) {
    for (const id of folderIds) {
        await setFolderSongMap(id, { list: [], empty: 0 }); // service/db.js
    }
}

/**
 * Thêm nhiều item vào 1 folder. Vị trí của từng item: chưa từng ở folder -> nối cuối `list`; từng bị gỡ (tombstone) ->
 * điền lại đúng vị trí cũ; đang ở trong -> bỏ qua (guard). Tính ngay trong `mutate` của `updateMediaMetaBatch()`
 * (service/db.js — 1 transaction, request chạy đúng thứ tự `itemKeys` nên vị trí nối cuối giữ đúng thứ tự); item không
 * tồn tại tự bị bỏ qua (`notFound`). UI chỉ đưa vào folder cùng type nên không validate type.
 * @param {string[]} itemKeys
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} mediaType
 * @param {{list: Array<string|null>, empty: number}} folderMap - Workflow đã đọc; hàm này SỬA tại chỗ rồi ghi lại
 * @returns {Promise<{status: 'ok', addedCount: number}>}
 */
async function addSongsToFolder(itemKeys, folderId, mediaType, folderMap) {
    let addedCount = 0;
    await updateMediaMetaBatch(itemKeys.map((itemKey) => ({ // service/db.js
        type: mediaType,
        key: itemKey,
        mutate: (meta) => {
            const folder = { ...(meta.folder || {}) };
            const hasPosition = folderId in folder;
            if (hasPosition && folderMap.list[folder[folderId]] !== null) return meta; // guard: đã ở trong folder
            const position = hasPosition ? folder[folderId] : folderMap.list.length;
            folder[folderId] = position;
            folderMap.list[position] = itemKey;
            folderMap.empty -= hasPosition ? 1 : 0;
            addedCount++;
            return { ...meta, folder };
        },
    })));
    await setFolderSongMap(folderId, folderMap); // service/db.js
    console.log(`[addSongsToFolder] thêm ${addedCount}/${itemKeys.length} ${mediaType} vào folder "${folderId}"`);
    return { status: 'ok', addedCount };
}

/**
 * Tombstone 1 item khỏi MỌI folder nó thuộc — dùng khi item bị xoá hẳn khỏi thư viện (nơi gọi xoá record ngay sau).
 * @param {Object<string, number>} itemFolder - `meta.folder` của item
 * @param {string[]} folderIds - listItemFolderIds() @param {Array<object|null>} folderMaps - thẳng hàng với `folderIds`
 */
async function removeItemFromFolders(itemFolder, folderIds, folderMaps) {
    for (let i = 0; i < folderIds.length; i++) {
        const folderMap = folderMaps[i];
        if (!folderMap) continue; // guard: folder đã bị xoá, meta chỉ còn sót field cũ
        const position = itemFolder[folderIds[i]];
        if (folderMap.list[position] == null) continue; // guard: vị trí đã là tombstone
        folderMap.list[position] = null;
        folderMap.empty++;
        await setFolderSongMap(folderIds[i], folderMap); // service/db.js
    }
}

/**
 * Gỡ nhiều item khỏi 1 folder (tombstone) trong 1 lượt ghi folder_song — không xoá item khỏi thư viện.
 * @param {Array<object|null>} itemMetas - meta của từng item (null = không còn) @param {string} folderId
 * @param {{list: Array<string|null>, empty: number}} folderMap - Workflow đã đọc; SỬA tại chỗ rồi ghi lại
 * @returns {Promise<{status: 'ok', removedCount: number}>}
 */
async function removeSongsFromFolder(itemMetas, folderId, folderMap) {
    let removedCount = 0;
    for (const meta of itemMetas) {
        if (!meta || !meta.folder || !(folderId in meta.folder)) continue; // guard: không thuộc folder này
        const position = meta.folder[folderId];
        if (folderMap.list[position] === null) continue; // guard: đã gỡ từ trước
        folderMap.list[position] = null;
        folderMap.empty++;
        removedCount++;
    }
    await setFolderSongMap(folderId, folderMap); // service/db.js
    return { status: 'ok', removedCount };
}

/** Ghi cờ Hidden (`excludeFromMainPlaylist`) lên record đã đọc sẵn. */
async function setFolderExcludeFlag(record, enabled) {
    record.excludeFromMainPlaylist = enabled;
    await setFolderRecord(record.id, record); // service/db.js
}

/** Ghi cờ Read-only (`isReadOnly`) lên record đã đọc sẵn. */
async function setFolderReadOnlyFlag(record, enabled) {
    record.isReadOnly = enabled;
    await setFolderRecord(record.id, record); // service/db.js
}

/** Ghi cờ "Áp dụng filter" (`applyFilter`) lên record đã đọc sẵn. */
async function setFolderApplyFilterFlag(record, enabled) {
    record.applyFilter = enabled;
    await setFolderRecord(record.id, record); // service/db.js
}

/** Ghi bộ rule filter riêng của folder (`filterConfig`, null = chưa cấu hình) lên record đã đọc sẵn. */
async function setFolderFilterConfig(record, config) {
    record.filterConfig = config;
    await setFolderRecord(record.id, record); // service/db.js
}

/**
 * Restore default settings — đưa 4 cờ cài đặt về giá trị lúc tạo; giữ id/tên/type/nội dung (dữ liệu,
 * không phải cài đặt). Nhận `record` đã đọc sẵn từ Workflow.
 * @param {{id: string}} record
 * @returns {Promise<void>}
 */
async function resetFolderRecordSettings(record) {
    record.excludeFromMainPlaylist = false;
    record.isReadOnly = false;
    record.applyFilter = true;
    record.filterConfig = null;
    await setFolderRecord(record.id, record); // service/db.js
}

/** Ghi kết quả migrate 1 lần `meta.folderIndex` + cờ đã migrate. */
async function writeFolderIndexMigration(folderIndex) {
    await setMeta('folderIndex', folderIndex); // service/db.js
    await setMeta('folderIndexMigrated', true);
}

/** Ghi kết quả migrate 1 lần `meta.activePlayListFolder` (dạng `{song, video, photo}`) + cờ đã migrate. */
async function writeActivePlayListFolderMigration(next) {
    await setMeta('activePlayListFolder', next); // service/db.js
    await setMeta('activePlayListFolderMigrated', true);
}
