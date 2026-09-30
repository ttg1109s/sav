/**
 * core/file-manager/folder.js — nghiệp vụ Folder (Song/Video/Photo).
 *
 * CRUD thô ở service/db.js (getFolderRecord/setFolderRecord/deleteFolderRecord/getAllFolderKeys,
 * getFolderSongMap/setFolderSongMap/deleteFolderSongMap, get/set*Record, getMeta/setMeta) là TẦNG DỮ
 * LIỆU — gọi thẳng không tính là "core gọi core" (Rule 3). Mỗi hàm dưới đây vẫn đúng 1 tiến trình (Rule 1).
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
 *   record media: record.folder = { [folderId]: position } — vị trí của item trong folder_song.list.
 *   meta.folderIndex      : { song: [], video: [], photo: [] } — folderId gom sẵn theo type, duy trì
 *                           bởi createFolder()/deleteFolder(); build 1 lần bởi migrateFolderIndexIfNeeded().
 *   meta.deletedFolderIds : id đã từng bị xoá — không bao giờ cấp lại (xem resolveFolderId()).
 *
 * NẠP SAU: service/db.js. addSongsToFolder() dùng VirtualMachineState (event/virtual-machine-state.js)
 * lúc chạy — nạp sau file này vẫn an toàn.
 */

/**
 * Sinh folderId duy nhất: `${slug}-${type}` (+ `-2`, `-3`... nếu trùng). Không cấp lại id nằm trong
 * `meta.deletedFolderIds` — item từng bị tombstone trước khi folder bị xoá vẫn còn `record.folder[id]`
 * cũ; tái dùng id sẽ khiến addSongsToFolder() đọc nhầm vị trí đó thành 'active'.
 * @param {string} name
 * @param {'song'|'video'|'photo'} type
 * @returns {Promise<string>}
 */
async function resolveFolderId(name, type) {
    const baseSlug = `${slugify(name) || 'folder'}-${type}`;
    console.log(`[resolveFolderId] callTo: "slugify", request: "chuẩn hoá tên '${name}' + type '${type}' thành slug làm base cho id"`);
    const deletedIds = new Set((await getMeta('deletedFolderIds')) || []); // data layer
    let candidate = baseSlug;
    let suffix = 2;
    while (true) {
        const existing = await getFolderRecord(candidate);
        if (!existing && !deletedIds.has(candidate)) return candidate;
        candidate = `${baseSlug}-${suffix}`; suffix++;
    }
}

/**
 * Tạo 1 folder rỗng với `folderId` đã resolve sẵn (Workflow gọi resolveFolderId() trước). Trùng tên
 * (case-sensitive) trong cùng type -> 'duplicateName'. Tạo xong push id vào `folderIndex[type]`.
 * @param {string} folderId
 * @param {string} name
 * @param {'song'|'video'|'photo'} type
 * @returns {Promise<{status: 'duplicateName'|'ok', folderId?: string}>}
 */
async function createFolder(folderId, name, type) {
    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    const sameTypeIds = folderIndex[type] || [];
    const sameTypeFolders = (await Promise.all(sameTypeIds.map((id) => getFolderRecord(id)))).filter(Boolean); // service/db.js
    if (sameTypeFolders.some(f => f.name === name)) return { status: 'duplicateName' };

    await setFolderRecord(folderId, { id: folderId, name, type, isReadOnly: false, applyFilter: true, filterConfig: null });
    await setFolderSongMap(folderId, { list: [], empty: 0 });

    if (!folderIndex[type]) folderIndex[type] = [];
    folderIndex[type].push(folderId);
    await setMeta('folderIndex', folderIndex); // data layer
    return { status: 'ok', folderId };
}

/**
 * Đổi tên 1 folder. Trùng tên (case-sensitive) với folder KHÁC cùng type -> 'duplicateName'.
 * @param {string} folderId
 * @param {string} newName
 * @returns {Promise<{status: 'notFound'|'duplicateName'|'ok'}>}
 */
async function renameFolder(folderId, newName) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };

    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    const sameTypeIds = folderIndex[record.type] || [];
    const sameTypeFolders = (await Promise.all(sameTypeIds.map((id) => getFolderRecord(id)))).filter(Boolean); // service/db.js
    if (sameTypeFolders.some(f => f.id !== folderId && f.name === newName)) return { status: 'duplicateName' };

    record.name = newName;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Xoá 1 folder: dọn `record.folder[folderId]` trên từng item đang có trong folder -> xoá folder_song
 * -> xoá record folders -> bớt khỏi `folderIndex` (dò cả 3 nhóm) -> ghi vào `deletedFolderIds`.
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} [mediaType] - chọn store record; vắng = 'song'.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function deleteFolder(folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
    const setRecordFn = mediaType === 'video' ? setVideoRecord : mediaType === 'photo' ? setImageRecord : setSongRecord; // service/db.js

    const songKeys = folderMap.list.filter((k) => k != null); // inline getFolderSongKeys() — Rule 3
    for (const songKey of songKeys) {
        const record = await getRecordFn(songKey);
        if (!record || !record.folder) continue; // guard: record đã mất/hỏng — không chặn xoá folder
        delete record.folder[folderId];
        await setRecordFn(songKey, record);
    }

    await deleteFolderSongMap(folderId);
    await deleteFolderRecord(folderId);

    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    let indexChanged = false;
    for (const t of ['song', 'video', 'photo']) {
        if (!folderIndex[t]) continue;
        const idx = folderIndex[t].indexOf(folderId);
        if (idx !== -1) { folderIndex[t].splice(idx, 1); indexChanged = true; }
    }
    if (indexChanged) await setMeta('folderIndex', folderIndex); // data layer

    const deletedIds = (await getMeta('deletedFolderIds')) || [];
    if (!deletedIds.includes(folderId)) {
        deletedIds.push(folderId);
        await setMeta('deletedFolderIds', deletedIds);
    }

    return { status: 'ok' };
}

/**
 * Đặt mọi folder về rỗng (giữ record `folders`) — dùng khi xoá sạch thư viện.
 * @returns {Promise<void>}
 */
async function clearAllFolderSongData() {
    const ids = await getAllFolderKeys(); // data layer
    for (const id of ids) {
        await setFolderSongMap(id, { list: [], empty: 0 }); // data layer
    }
}

/**
 * Thêm nhiều item vào 1 folder. Trạng thái thành viên từng item: 'new' (push cuối), 'tombstoned'
 * (điền lại đúng vị trí cũ), 'active' (bỏ qua) — chọn qua VirtualMachineState, callback là closure
 * nội bộ (không gọi core khác). UI chỉ đưa vào folder cùng type nên không validate type.
 * @param {string[]} songKeys
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} mediaType - chọn store record.
 * @returns {Promise<{status: 'notFound'|'ok', addedCount: number}>}
 */
async function addSongsToFolder(songKeys, folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound', addedCount: 0 };

    let addedCount = 0;
    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
    const setRecordFn = mediaType === 'video' ? setVideoRecord : mediaType === 'photo' ? setImageRecord : setSongRecord; // service/db.js
    for (const songKey of songKeys) {
        const record = await getRecordFn(songKey);
        if (!record) continue; // guard: item không còn tồn tại — không chặn cả lô
        if (!record.folder) record.folder = {};

        const membershipState = !(folderId in record.folder)
            ? 'new'
            : (folderMap.list[record.folder[folderId]] === null ? 'tombstoned' : 'active');
        VirtualMachineState.run([
            { state: membershipState, operation: '===', value: 'new', callback: () => {
                const position = folderMap.list.length;
                folderMap.list.push(songKey);
                record.folder[folderId] = position;
                addedCount++;
            } },
            { state: membershipState, operation: '===', value: 'tombstoned', callback: () => {
                const position = record.folder[folderId];
                folderMap.list[position] = songKey;
                folderMap.empty--;
                addedCount++;
            } },
            { state: membershipState, operation: '===', value: 'active', callback: () => {} }, // đã ở trong — no-op có chủ đích
        ]);
        await setRecordFn(songKey, record);
    }
    await setFolderSongMap(folderId, folderMap);
    return { status: 'ok', addedCount };
}

/**
 * Tombstone 1 item khỏi MỌI folder nó thuộc — dùng khi item bị xoá hẳn khỏi thư viện. Không ghi lại
 * record (nơi gọi xoá record ngay sau).
 * @param {Object} songRecord - record đầy đủ của item sắp bị xoá.
 */
async function removeSongFromAllFolders(songRecord) {
    if (!songRecord || !songRecord.folder) return;
    for (const folderId of Object.keys(songRecord.folder)) {
        const folderMap = await getFolderSongMap(folderId);
        if (!folderMap) continue; // guard: folder đã bị xoá, record chỉ còn sót field cũ
        const position = songRecord.folder[folderId];
        if (folderMap.list[position] != null) {
            folderMap.list[position] = null;
            folderMap.empty++;
            await setFolderSongMap(folderId, folderMap);
        }
    }
}

/**
 * Gỡ 1 item khỏi 1 folder (tombstone) — không xoá item khỏi thư viện.
 * @param {string} songKey
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} [mediaType] - vắng = 'song'.
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function removeSongFromFolder(songKey, folderId, mediaType) {
    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
    const record = await getRecordFn(songKey);
    if (!record || !record.folder || !(folderId in record.folder)) return { status: 'notFound' };

    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound' };

    const position = record.folder[folderId];
    if (folderMap.list[position] !== null) {
        folderMap.list[position] = null;
        folderMap.empty++;
        await setFolderSongMap(folderId, folderMap);
    }
    return { status: 'ok' };
}

/**
 * Gỡ nhiều item khỏi 1 folder trong 1 lượt đọc/ghi folder_song (Selection mode).
 * @param {string[]} songKeys
 * @param {string} folderId
 * @param {'song'|'video'|'photo'} [mediaType] - vắng = 'song'.
 * @returns {Promise<{status: 'notFound'|'ok', removedCount: number}>}
 */
async function removeSongsFromFolder(songKeys, folderId, mediaType) {
    const folderMap = await getFolderSongMap(folderId);
    if (!folderMap) return { status: 'notFound', removedCount: 0 };

    const getRecordFn = mediaType === 'video' ? getVideoRecord : mediaType === 'photo' ? getImageRecord : getSongRecord; // service/db.js
    let removedCount = 0;
    for (const songKey of songKeys) {
        const record = await getRecordFn(songKey);
        if (!record || !record.folder || !(folderId in record.folder)) continue; // guard: không thuộc folder này — bỏ qua
        const position = record.folder[folderId];
        if (folderMap.list[position] !== null) {
            folderMap.list[position] = null;
            folderMap.empty++;
            removedCount++;
        }
    }
    await setFolderSongMap(folderId, folderMap);
    return { status: 'ok', removedCount };
}

/**
 * Ghi cờ Hidden (`excludeFromMainPlaylist`).
 * @param {string} folderId
 * @param {boolean} enabled
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setFolderExcludeFlag(folderId, enabled) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };
    record.excludeFromMainPlaylist = enabled;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Ghi cờ Read-only (`isReadOnly`).
 * @param {string} folderId
 * @param {boolean} enabled
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setFolderReadOnlyFlag(folderId, enabled) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };
    record.isReadOnly = enabled;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Ghi cờ "Áp dụng filter" (`applyFilter`).
 * @param {string} folderId
 * @param {boolean} enabled
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setFolderApplyFilterFlag(folderId, enabled) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };
    record.applyFilter = enabled;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
}

/**
 * Ghi bộ rule filter riêng của folder (`filterConfig`, null = chưa cấu hình).
 * @param {string} folderId
 * @param {object|null} config
 * @returns {Promise<{status: 'notFound'|'ok'}>}
 */
async function setFolderFilterConfig(folderId, config) {
    const record = await getFolderRecord(folderId);
    if (!record) return { status: 'notFound' };
    record.filterConfig = config;
    await setFolderRecord(folderId, record);
    return { status: 'ok' };
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

/**
 * Hợp các key thuộc MỌI folder Hidden của đúng `mediaType` (key 3 loại media có thể trùng slug nên
 * không gộp chéo loại). Dùng cho view "Tất cả" và picker chọn ảnh/video.
 * @param {'song'|'video'|'photo'} mediaType
 * @returns {Promise<Set<string>>}
 */
async function getExcludedSongKeysFromFolders(mediaType) {
    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    const ids = folderIndex[mediaType] || [];
    const records = await Promise.all(ids.map((id) => getFolderRecord(id))); // service/db.js
    const excludedFolderIds = records.filter((r) => r && r.excludeFromMainPlaylist).map((r) => r.id);

    const folderMaps = await Promise.all(excludedFolderIds.map((folderId) => getFolderSongMap(folderId))); // service/db.js
    const excludedKeys = new Set();
    for (const folderMap of folderMaps) {
        if (!folderMap) continue; // guard: folder vừa bị xoá giữa lúc gom
        for (const key of folderMap.list) { if (key != null) excludedKeys.add(key); }
    }
    return excludedKeys;
}

/**
 * Liệt kê record folder theo type (đọc `meta.folderIndex`); không truyền `type` -> cả 3 loại.
 * @param {'song'|'video'|'photo'} [type]
 * @returns {Promise<Array<{id: string, name: string, type: string}>>}
 */
async function listFolders(type) {
    const folderIndex = (await getMeta('folderIndex')) || { song: [], video: [], photo: [] }; // data layer
    const ids = type ? (folderIndex[type] || []) : [...(folderIndex.song || []), ...(folderIndex.video || []), ...(folderIndex.photo || [])];
    const records = await Promise.all(ids.map((id) => getFolderRecord(id))); // service/db.js
    return records.filter(Boolean);
}

/**
 * Migrate 1 lần (idempotent qua `meta.folderIndexMigrated`) — build `meta.folderIndex` từ toàn bộ
 * `folders`; folder chưa có type xếp vào 'song'. Gọi lúc boot (event/workflow/app-boot.js).
 * @returns {Promise<void>}
 */
async function migrateFolderIndexIfNeeded() {
    const migrated = await getMeta('folderIndexMigrated'); // data layer
    if (migrated) return;

    const ids = await getAllFolderKeys(); // data layer — nơi duy nhất quét toàn bộ, chỉ chạy 1 lần
    const records = await Promise.all(ids.map((id) => getFolderRecord(id)));
    const folderIndex = { song: [], video: [], photo: [] };
    const seenIds = { song: new Set(), video: new Set(), photo: new Set() };
    for (const record of records) {
        if (!record) continue;
        const t = record.type || 'song';
        if (!folderIndex[t]) { folderIndex[t] = []; seenIds[t] = new Set(); }
        if (!seenIds[t].has(record.id)) { seenIds[t].add(record.id); folderIndex[t].push(record.id); }
    }
    await setMeta('folderIndex', folderIndex);
    await setMeta('folderIndexMigrated', true);
}

/**
 * Migrate 1 lần (idempotent qua `meta.activePlayListFolderMigrated`) — `meta.activePlayListFolder`
 * từ string phẳng sang `{song, video, photo}`; giá trị cũ gán vào đúng field theo type của folder đó
 * (folder đã mất -> bỏ). Gọi lúc boot, trước mọi chỗ đọc field này.
 * @returns {Promise<void>}
 */
async function migrateActivePlayListFolderIfNeeded() {
    const migrated = await getMeta('activePlayListFolderMigrated'); // data layer
    if (migrated) return;

    const old = await getMeta('activePlayListFolder'); // data layer — dạng cũ: string|null|undefined
    const next = { song: null, video: null, photo: null };
    if (typeof old === 'string' && old) {
        const folderRecord = await getFolderRecord(old); // service/db.js
        const type = folderRecord ? (folderRecord.type || 'song') : null;
        if (type && Object.prototype.hasOwnProperty.call(next, type)) next[type] = old;
    }
    await setMeta('activePlayListFolder', next);
    await setMeta('activePlayListFolderMigrated', true);
}

/** Pure — key đang thật sự trong folder (bỏ tombstone null). */
function getFolderSongKeys(folderMap) {
    return folderMap.list.filter(k => k != null);
}

/** Pure — folder rỗng hoàn toàn, O(1). */
function isFolderEmpty(folderMap) {
    return folderMap.empty === folderMap.list.length;
}

/** Pure — tên mặc định "Thư mục N" cho folder mới, chưa trùng tên folder nào trong `folders`. */
function computeNextFolderName(folders) {
    const existingNames = new Set(folders.map((f) => f.name));
    let n = folders.length + 1;
    let name = tFormat('fileManager.folderBrowser.defaultNewFolderName', { n });
    while (existingNames.has(name)) { n++; name = tFormat('fileManager.folderBrowser.defaultNewFolderName', { n }); }
    return name;
}
