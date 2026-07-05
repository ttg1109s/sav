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
    // MỚI (04/07/2026, mục 2 phản hồi Giang) — công cụ dọn rác chung File Manager.
    'fileManager.cleanup.label': 'Clean up data',
    'fileManager.cleanup.hint': 'Scan and remove leftover orphaned data across File Manager',
    'fileManager.cleanup.running': 'Scanning…',
    'fileManager.cleanup.resultFound': 'Cleaned up {count} item(s).',
    'fileManager.cleanup.resultClean': 'Everything is clean — nothing to remove.',
    'fileManager.comingSoon': 'Coming soon.',
    // ── Drawer con: Song ──────────────────────────────────────────────────────────────────
    // FIX (03/07/2026, mục 4 yêu cầu) — bỏ tiền tố "File Manager · " khỏi CẢ 3 tiêu đề drawer con
    // (Song/Photo & Album/Documents): tiêu đề section cha "File Manager" đã hiện rõ ở hàng Settings
    // trước khi push vào, lặp lại tiền tố trên thanh bar tiêu đề của chính drawer con là thừa —
    // khớp đúng các key `fileManager.entry.*` (nhãn hàng trong Settings) vốn đã KHÔNG có tiền tố.
    'fileManager.song.title': 'Song',
    'fileManager.song.back.title': 'Back to Settings',
    // ── Drawer con: Photo & Album (placeholder, chưa code — b2/b3) ──────────────────────────
    'fileManager.photo.title': 'Photo & Album',
    'fileManager.photo.back.title': 'Back to Settings',
    // ── Batch 3 (03/07/2026) ──────────────────────────────────────────────────────────────
    'fileManager.photo.uploadTitle': 'Add photos',
    'fileManager.photo.image.empty': 'No photos yet. Tap the + button above to add some.',
    // MỚI (04/07/2026, mục 2 phản hồi Giang) — carousel chọn ảnh nền (Visual/Playlist).
    'fileManager.photo.carousel.confirmButton': 'Use this photo',
    // MỚI (04/07/2026, mục 2 phản hồi Giang) — caption ảnh.
    'fileManager.photo.image.captionLabel': 'Caption',
    'fileManager.photo.image.captionPlaceholder': 'Add a caption for this photo…',
    'fileManager.photo.image.btnDelete': 'Remove from library',
    'fileManager.photo.image.btnRemoveFromAlbum': 'Remove from album',
    'fileManager.photo.image.uploadSuccess': 'Added {count} photo(s).',
    // ── Batch tiếp theo (03/07/2026, hạ tầng z-index nền Visual) — "Đặt làm nền" trên ảnh ─────
    'fileManager.photo.image.btnSetPlaylistBg': 'Set as Playlist background',
    'fileManager.photo.image.btnSetVisualBg': 'Set as Visualizer background',
    'fileManager.photo.image.setPlaylistBgSuccess': 'Set as Playlist background.',
    'fileManager.photo.image.setVisualBgSuccess': 'Set as Visualizer background.',
    'fileManager.photo.album.all': 'All',
    'fileManager.photo.album.new': 'New',
    'fileManager.photo.album.createTitle': 'New album',
    'fileManager.photo.album.namePlaceholder': 'Album name',
    'fileManager.photo.album.btnCreate': 'Create',
    // ── Batch tiếp theo (03/07/2026, mục 2.2/2.3) — Đổi tên/Xoá album + thêm ảnh có sẵn ──────
    'fileManager.photo.album.addImagesTitle': 'Add existing photos',
    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual).
    'fileManager.photo.album.setSlideshowBgTitle': 'Use as Slideshow background',
    'fileManager.photo.album.setSlideshowBgSuccess': 'Set as Slideshow background.',
    'fileManager.photo.album.renameTitle': 'Rename album',
    'fileManager.photo.album.deleteTitle': 'Delete album',
    'fileManager.photo.album.deleteConfirm': 'Delete album "{name}"? Photos inside stay in your library, only the album is removed.',
    'fileManager.photo.album.btnDelete': 'Delete',
    'fileManager.photo.album.selectedCount': '{count} selected',
    'fileManager.photo.album.btnAddSelected': 'Add to album',
    'fileManager.photo.album.addImagesSuccess': 'Added {count} photo(s) to the album.',
    // ── Drawer con: Documents (mục 4.b4, ĐÃ CODE THẬT 04/07/2026) ────────────────────────────
    'fileManager.document.title': 'Documents',
    'fileManager.document.back.title': 'Back to Settings',
    'fileManager.document.btnUpload': 'Upload document',
    'fileManager.document.btnCreate': 'Create new',
    'fileManager.document.empty': 'No documents yet.',
    'fileManager.document.badgeUser': 'Created in app',
    'fileManager.document.badgeUpload': 'Uploaded',
    'fileManager.document.btnRename': 'Rename',
    'fileManager.document.btnDelete': 'Delete',
    'fileManager.document.titlePlaceholder': 'Document title',
    'fileManager.document.createTitle': 'New document',
    'fileManager.document.renameTitle': 'Rename document',
    'fileManager.document.invalidType': 'Only .txt or .docx files are supported.',
    'fileManager.document.docxWarningTitle': 'Formatting will be lost',
    'fileManager.document.docxWarningBody': 'Uploading a .docx file keeps only the plain text — bold, images, tables, and all other formatting will be discarded. Continue?',
    'fileManager.document.docxWarningConfirm': 'Continue',
    'fileManager.document.deleteConfirmTitle': 'Delete this document?',
    'fileManager.document.deleteConfirmBody': 'This cannot be undone.',
    // ── Document Reader (cửa sổ đọc, mở từ Control Center) ───────────────────────────────────
    'documentReader.listTitle': 'Choose document',
    'documentReader.btnEdit': 'Edit',
    'documentReader.empty': 'This document is empty.',
    'documentReader.editTitle': 'Edit document',
    'documentReader.closeWhileEditingBody': 'Save your changes before closing?',
    'documentReader.discardChanges': 'Discard',
    // ── Document Picker Drawer (chọn tài liệu, trắng, trượt từ dưới lên — mục 3 phản hồi Giang) ──
    'documentPicker.title': 'Choose document',
    'documentPicker.empty': 'No documents yet — add one in File Manager.',
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
