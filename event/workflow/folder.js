/**
 * event/workflow/folder.js — `workflowFolder`: tầng CHUẨN BỊ + ĐIỀU PHỐI của nghiệp vụ Folder (Song/Video/Photo).
 *
 * Mọi việc ĐỌC DB của miền Folder (record `folders`, `folder_song`, `meta.folderIndex`/`deletedFolderIds`, meta media) nằm
 * ở đây; core/file-manager/folder.js chỉ tính thuần hoặc ghi (Rule 3b). Dùng chung cho Folder Browser
 * (workflowFileManagerFolderBrowser), picker "Thêm vào thư mục" (workflowPlaylist), Playlist Scope (workflowPlaylistScope),
 * Visual Background, Storage, Restore default và boot.
 *
 * Không có Router riêng — các Workflow khác gọi thẳng (TH2, readme/event-bus-flow.md mục 3a).
 *
 * Cũng giữ phiên chạm/giữ tay tile của 2 lưới Folder (Folder Browser, picker "Thêm vào thư mục"): giữ FOLDER_TILE_HOLD_MS
 * -> `${msgPrefix}.tile.longpress`, chạm thường -> `${msgPrefix}.tile.tap`, click tự phát ngay sau khi giữ bị nuốt. Router
 * của lưới quyết định làm gì với 2 message đó.
 *
 * NẠP SAU: service/db.js, core/file-manager/folder.js. Gọi lúc chạy: event/workflow/playlist-scope.js (badge),
 * service/task-manager.js, event/bus.js, core/file-manager/folder-picker-ui.js.
 */

// Ngưỡng giữ tay mở menu hành động của 1 folder tile.
const FOLDER_TILE_HOLD_MS = 1000;
const FOLDER_TILE_HOLD_TASK = 'folderTileLongPress';

// Click tới sau pointerup: vừa giữ đủ lâu -> nuốt (click tự phát của long-press); không -> chạm thường.
const FOLDER_TILE_CLICK_BY_HOLD_FIRED = {
    true: () => workflowFolder._clearTileHoldFired(),
    false: (routerName, msgPrefix, folderId) => eventBus.send({ router: routerName, type: `${msgPrefix}.tile.tap`, payload: { folderId } }),
};

// Ghi 1 trường cài đặt của folder — khoá = tên trường phía Workflow gọi.
const FOLDER_SETTING_WRITER_BY_FIELD = { // core/file-manager/folder.js
    readOnly: (record, value) => setFolderReadOnlyFlag(record, value),
    hidden: (record, value) => setFolderExcludeFlag(record, value),
    applyFilter: (record, value) => setFolderApplyFilterFlag(record, value),
    filterConfig: (record, value) => setFolderFilterConfig(record, value),
};

const workflowFolder = {
    // ============================== Đọc ==============================

    /** Danh sách record folder theo type; không truyền `type` -> cả 3 loại.
     * @param {'song'|'video'|'photo'} [type] @returns {Promise<object[]>} */
    async list(type) {
        const folderIndex = await getMeta('folderIndex'); // service/db.js
        return this._readFolders(resolveFolderIndexIds(folderIndex, type)); // core/file-manager/folder.js
    },

    /** Folder đúng type có ≥1 item (picker "Thư mục" của Visual Background — folder rỗng không làm nguồn được).
     * @param {'song'|'video'|'photo'} type @returns {Promise<object[]>} */
    async listNonEmpty(type) {
        const folders = await this.list(type);
        const folderMaps = await Promise.all(folders.map((f) => getFolderSongMap(f.id))); // service/db.js
        return pickNonEmptyFolders(folders, folderMaps); // core/file-manager/folder.js
    },

    /** Hợp key thuộc MỌI folder Hidden của đúng `mediaType` (key 3 loại có thể trùng slug nên không gộp chéo loại) — view
     * "Tất cả" và picker chọn ảnh/video. @param {'song'|'video'|'photo'} mediaType @returns {Promise<Set<string>>} */
    async readExcludedKeys(mediaType) {
        const folderIndex = await getMeta('folderIndex'); // service/db.js
        const records = await this._readFolders(pickFolderIndexIdsOfType(folderIndex, mediaType)); // core/file-manager/folder.js
        const folderMaps = await Promise.all(pickExcludedFolderIds(records).map((id) => getFolderSongMap(id))); // core + service/db.js
        return collectFolderItemKeySet(folderMaps); // core/file-manager/folder.js
    },

    /** @param {string[]} ids @returns {Promise<object[]>} record còn tồn tại, đúng thứ tự `ids`. */
    async _readFolders(ids) {
        const records = await Promise.all(ids.map((id) => getFolderRecord(id))); // service/db.js
        return pickExistingFolderRecords(records); // core/file-manager/folder.js
    },

    // ============================== Tạo / đổi tên / xoá ==============================

    /** Tạo folder rỗng (id sinh từ tên + type). Trùng tên (case-sensitive) trong cùng type -> 'duplicateName'.
     * @param {string} name @param {'song'|'video'|'photo'} type
     * @returns {Promise<{status: 'duplicateName'|'ok', folderId?: string}>} */
    async create(name, type) {
        const [folderIndex, folderIds, deletedIds] = await Promise.all([getMeta('folderIndex'), getAllFolderKeys(), getMeta('deletedFolderIds')]); // service/db.js
        const sameTypeFolders = await this._readFolders(pickFolderIndexIdsOfType(folderIndex, type)); // core/file-manager/folder.js
        if (isFolderNameTaken(sameTypeFolders, name, null)) return { status: 'duplicateName' }; // core — trả trạng thái cho nơi gọi
        const folderId = computeUniqueFolderId(name, type, folderIds, deletedIds); // core/file-manager/folder.js
        return createFolder(folderId, name, type, folderIndex); // core/file-manager/folder.js
    },

    /** Đổi tên. Trùng tên với folder KHÁC cùng type -> 'duplicateName'. Đổi được thì badge "đang xem folder" trong ô tìm
     * kiếm Playlist cập nhật theo (folder đổi tên có thể chính là folder đang Scope).
     * @param {string} folderId @param {string} name
     * @returns {Promise<{status: 'notFound'|'duplicateName'|'ok'}>} */
    async rename(folderId, name) {
        const record = await getFolderRecord(folderId); // service/db.js
        if (!record) return { status: 'notFound' };
        const folderIndex = await getMeta('folderIndex'); // service/db.js
        const sameTypeFolders = await this._readFolders(pickFolderIndexIdsOfType(folderIndex, record.type)); // core/file-manager/folder.js
        if (isFolderNameTaken(sameTypeFolders, name, folderId)) return { status: 'duplicateName' }; // core/file-manager/folder.js
        await renameFolder(record, name); // core/file-manager/folder.js
        await workflowPlaylistScope.syncActiveFolderBadge(); // event/workflow/playlist-scope.js
        return { status: 'ok' };
    },

    /** Xoá folder (dọn `meta.folder` của item, folder_song, record, folderIndex, ghi deletedFolderIds). Folder_song đã mất
     * thì bỏ qua. @param {string} folderId @param {'song'|'video'|'photo'} mediaType */
    async remove(folderId, mediaType) {
        const [folderMap, folderIndex, deletedIds] = await Promise.all([
            getFolderSongMap(folderId), getMeta('folderIndex'), getMeta('deletedFolderIds'),
        ]); // service/db.js
        if (!folderMap) return; // guard: folder_song không còn
        await deleteFolder(folderId, mediaType, folderMap, folderIndex, deletedIds); // core/file-manager/folder.js
    },

    // ============================== Cài đặt folder ==============================

    /** Ghi 1 trường cài đặt (`readOnly` | `hidden` | `applyFilter` | `filterConfig`). Folder vừa bị xoá -> bỏ qua.
     * @param {string} folderId @param {'readOnly'|'hidden'|'applyFilter'|'filterConfig'} field @param {*} value */
    async writeSetting(folderId, field, value) {
        const record = await getFolderRecord(folderId); // service/db.js
        if (!record) return; // guard: folder vừa bị xoá
        await FOLDER_SETTING_WRITER_BY_FIELD[field](record, value);
    },

    // ============================== Thành viên ==============================

    /** Tombstone 1 item khỏi mọi folder nó thuộc (trước khi xoá hẳn item). @param {{folder?: object}} itemRecord - record/meta */
    async removeItemFromAllFolders(itemRecord) {
        const folderIds = listItemFolderIds(itemRecord); // core/file-manager/folder.js
        const folderMaps = await Promise.all(folderIds.map((id) => getFolderSongMap(id))); // service/db.js
        await removeItemFromFolders(itemRecord.folder, folderIds, folderMaps); // core/file-manager/folder.js
    },

    /** Tombstone nhiều item (theo key) khỏi mọi folder chúng thuộc — trước khi xoá hẳn (Storage: xoá file lỗi). Chạy tuần tự
     * để 2 item cùng folder không ghi đè folder_song của nhau. @param {'song'|'video'|'photo'} mediaType @param {string[]} keys */
    async removeKeysFromAllFolders(mediaType, keys) {
        for (const key of keys) {
            const itemMeta = await getMediaMeta(mediaType, key); // service/db.js
            if (!itemMeta) continue; // guard: item không còn
            await this.removeItemFromAllFolders(itemMeta);
        }
    },

    /** Gỡ các key khỏi 1 folder (không đụng thư viện).
     * @param {string[]} keys @param {string} folderId @param {'song'|'video'|'photo'} mediaType
     * @returns {Promise<object|null>} folder_song SAU khi gỡ (null = folder không còn) */
    async removeItems(keys, folderId, mediaType) {
        const folderMap = await getFolderSongMap(folderId); // service/db.js
        if (!folderMap) return null; // guard: folder không còn
        const itemMetas = await Promise.all(keys.map((key) => getMediaMeta(mediaType, key))); // service/db.js
        await removeSongsFromFolder(itemMetas, folderId, folderMap); // core/file-manager/folder.js
        return folderMap;
    },

    /** Đặt mọi folder về rỗng (giữ record) — xoá sạch thư viện ở Storage. */
    async clearAllItems() {
        await clearAllFolderSongData(await getAllFolderKeys()); // core/file-manager/folder.js + service/db.js
    },

    // ============================== Chạm / giữ tay tile ==============================

    _tileHoldFired: false,

    /** `${msgPrefix}.tile.pointerdown` — bắt đầu đếm giữ tay. Giữ đủ FOLDER_TILE_HOLD_MS -> `${msgPrefix}.tile.longpress`.
     * @param {string} routerName @param {string} msgPrefix @param {string} folderId @param {HTMLElement} anchorEl */
    beginTileHold(routerName, msgPrefix, folderId, anchorEl) {
        this._tileHoldFired = false;
        taskManager.once(() => {
            this._tileHoldFired = true;
            eventBus.send({ router: routerName, type: `${msgPrefix}.tile.longpress`, payload: { folderId, anchorEl } });
        }, FOLDER_TILE_HOLD_MS, FOLDER_TILE_HOLD_TASK);
    },

    /** `${msgPrefix}.tile.pointerup` — thả tay: dừng đếm, giữ cờ "vừa long-press" để nuốt click tự phát ngay sau. */
    endTileHold() {
        taskManager.kill(FOLDER_TILE_HOLD_TASK);
    },

    /** `${msgPrefix}.tile.pointercancel` (cả pointerleave) — huỷ cử chỉ: dừng đếm + bỏ cờ. */
    cancelTileHold() {
        taskManager.kill(FOLDER_TILE_HOLD_TASK);
        this._tileHoldFired = false;
    },

    /** `${msgPrefix}.tile.click` — chạm thường -> `${msgPrefix}.tile.tap`; click ngay sau long-press -> nuốt. */
    resolveTileClick(routerName, msgPrefix, folderId) {
        FOLDER_TILE_CLICK_BY_HOLD_FIRED[this._tileHoldFired](routerName, msgPrefix, folderId);
    },

    _clearTileHoldFired() {
        this._tileHoldFired = false;
    },

    /** `${msgPrefix}.rename.keydown` — Enter bỏ focus ô sửa tên (blur tự bắn `.rename.commit`). @param {string} key */
    handleTileRenameKeydown(key) {
        if (key !== 'Enter') return; // guard: chỉ Enter
        blurFolderTileRenameInput(); // core/file-manager/folder-picker-ui.js
    },

    // ============================== Migrate lúc boot ==============================

    /** Migrate 1 lần (idempotent qua cờ meta) — `folderIndex` rồi `activePlayListFolder`. Gọi lúc boot
     * (event/workflow/app-boot.js), TRƯỚC mọi chỗ đọc 2 field này. */
    async migrateOnBoot() {
        await this._migrateFolderIndex();
        await this._migrateActivePlayListFolder();
    },

    /** Build `meta.folderIndex` từ toàn bộ store `folders` (nơi duy nhất quét toàn bộ, chỉ chạy 1 lần). */
    async _migrateFolderIndex() {
        if (await getMeta('folderIndexMigrated')) return; // guard: đã migrate — service/db.js
        const records = await this._readFolders(await getAllFolderKeys()); // service/db.js
        await writeFolderIndexMigration(buildFolderIndexFromRecords(records)); // core/file-manager/folder.js
    },

    /** `meta.activePlayListFolder` từ string phẳng sang `{song, video, photo}`. */
    async _migrateActivePlayListFolder() {
        if (await getMeta('activePlayListFolderMigrated')) return; // guard: đã migrate — service/db.js
        const oldValue = await getMeta('activePlayListFolder'); // service/db.js — dạng cũ: string|null|undefined
        const folderRecord = await this._readLegacyScopeFolder(oldValue);
        await writeActivePlayListFolderMigration(computeMigratedActivePlayListFolder(oldValue, folderRecord)); // core/file-manager/folder.js
    },

    /** Record folder của giá trị Scope dạng cũ (null nếu không phải id). */
    async _readLegacyScopeFolder(oldValue) {
        if (typeof oldValue !== 'string' || !oldValue) return null; // guard: không phải dạng cũ
        return (await getFolderRecord(oldValue)) || null; // service/db.js
    },
};
