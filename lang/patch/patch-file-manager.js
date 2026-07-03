/**
 * patch-file-manager.js — patch default-language keys (tiếng Anh), namespace `fileManager.*`.
 * MỚI thêm ver 12 "Multi Media" (plan-v12-multimedia.md mục 2) — bước đầu chỉ có phần Folder
 * Picker (dùng bởi core/file-manager/folder-picker-ui.js + hành động "Thêm vào thư mục" trong
 * chế độ chọn nhiều của Playlist). Các namespace `fileManager.song.*`/`fileManager.image.*`/
 * `reader.*` sẽ bổ sung ở các bước sau khi khung điều hướng File Manager được code.
 *
 * Đây KHÔNG phải file JSON — xem comment đầu patch-playlist.js để biết lý do (project chạy qua
 * file://, không fetch() được file tĩnh).
 *
 * Nạp TRƯỚC /lang/lang.js (xem index.html).
 */
const LANG_PATCH_FILE_MANAGER = {
    'fileManager.folderPicker.title': 'Add to folder',
    'fileManager.folderPicker.empty': 'No folders yet. Create one below.',
    'fileManager.folderPicker.newNamePlaceholder': 'New folder name',
    'fileManager.folderPicker.btnCreate': 'Create',
    'fileManager.folderPicker.addSuccess': 'Added {count} song(s) to the folder.',
    'fileManager.folderPicker.duplicateName': 'A folder named "{name}" already exists (folder names are case-sensitive — different capitalization counts as a different name).',
    // ── Section "File Manager" trong Settings (CHỐT 03/07/2026 — xem
    // plan-v12-multimedia-decisions.md mục 1a/7): KHÔNG còn 1 overlay cấp cao riêng với tab bar
    // nữa — đây giờ là 1 section thường trong Settings (giống "Hệ thống & Playlist"...), 3 hàng
    // bấm vào push thẳng sang drawer con tương ứng (nav-stack, cùng pattern About/Visualizer
    // Settings), KHÔNG qua màn trung gian nào.
    'fileManager.sectionTitle': 'File Manager',
    'fileManager.entry.song': 'Song',
    'fileManager.entry.photo': 'Photo & Album',
    'fileManager.entry.document': 'Documents',
    'fileManager.comingSoon': 'Coming soon.',
    // ── Drawer con: Song ──────────────────────────────────────────────────────────────────
    'fileManager.song.title': 'File Manager · Song',
    'fileManager.song.back.title': 'Back to Settings',
    // ── Drawer con: Photo & Album (placeholder, chưa code — b2/b3) ──────────────────────────
    'fileManager.photo.title': 'File Manager · Photo & Album',
    'fileManager.photo.back.title': 'Back to Settings',
    // ── Batch 3 (03/07/2026) ──────────────────────────────────────────────────────────────
    'fileManager.photo.uploadTitle': 'Add photos',
    'fileManager.photo.image.empty': 'No photos yet. Tap the + button above to add some.',
    'fileManager.photo.image.btnDelete': 'Remove from library',
    'fileManager.photo.image.uploadSuccess': 'Added {count} photo(s).',
    'fileManager.photo.album.all': 'All',
    'fileManager.photo.album.new': 'New',
    'fileManager.photo.album.createTitle': 'New album',
    'fileManager.photo.album.namePlaceholder': 'Album name',
    'fileManager.photo.album.btnCreate': 'Create',
    // ── Drawer con: Documents (placeholder, chưa code — b4) ─────────────────────────────────
    'fileManager.document.title': 'File Manager · Documents',
    'fileManager.document.back.title': 'Back to Settings',
    // ── File Manager -> Song: Folder (mục 4.b1) ──────────────────────────────────────────────
    'fileManager.song.folderSectionTitle': 'Folders',
    'fileManager.song.newFolderPlaceholder': 'New folder name',
    'fileManager.song.btnCreateFolder': 'Create',
    'fileManager.song.folderEmpty': 'No folders yet.',
    'fileManager.song.activeFolderBadge': 'Currently applied to Playlist',
    'fileManager.song.renameFolderTitle': 'Rename folder',
    'fileManager.song.deleteFolderTitle': 'Delete folder',
    'fileManager.song.deleteFolderConfirm': 'Delete folder "{name}"? Songs inside stay in your library, only the folder is removed.',
    'fileManager.song.btnDeleteFolder': 'Delete',
    // ── File Manager -> Song -> Folder Detail Drawer (Phase 2, CHỐT 03/07/2026) ──────────────
    'fileManager.song.folderDetail.back.title': 'Back to folders',
    'fileManager.song.folderDetail.btnApply': 'Apply to Playlist',
    'fileManager.song.folderDetail.btnUnapply': 'Remove from Playlist',
    'fileManager.song.folderDetail.songListTitle': 'Songs in this folder',
    'fileManager.song.folderDetail.empty': 'No songs in this folder yet.',
    'fileManager.song.folderDetail.removeSongTitle': 'Remove from folder',
    'fileManager.song.folderDetail.reloadTitle': 'Apply now?',
    'fileManager.song.folderDetail.reloadBtnNo': 'Not now',
    'fileManager.song.folderDetail.reloadBtnNow': 'Reload now',
    'fileManager.song.folderDetail.applyReloadBody': 'Saved — the Playlist will show songs from "{name}" after reloading. Reload now?',
    'fileManager.song.folderDetail.unapplyReloadBody': 'Saved — the Playlist will show all songs again after reloading. Reload now?',
    'fileManager.song.folderDetail.autoUnapplyReloadBody': 'This folder is now empty, so it was removed as the Playlist source. The Playlist will show all songs again after reloading. Reload now?',
    'fileManager.song.folderDetail.deleteReloadBody': 'Folder deleted — the Playlist will show all songs again after reloading. Reload now?',
    'fileManager.song.folderDetail.applyBlockedEmpty': 'This folder is empty — add songs to it before applying it to the Playlist.',
    'fileManager.song.deleteActiveFolderConfirm': 'Delete folder "{name}"? This folder is currently applied to the Playlist.',
};
