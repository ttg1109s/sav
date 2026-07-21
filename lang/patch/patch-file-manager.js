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
    // MỚI (14/07/2026, tích hợp Generic Drawer grid — Giang yêu cầu, thay modal cũ) —
    // 'newTileLabel': nhãn dưới tile "+" cuối grid. 'defaultNewFolderName': tên tự sinh khi bấm
    // tile đó (createFolderInPicker(), event/workflow/playlist.js) — CÙNG chuỗi gốc, "newTileLabel"
    // chỉ là NHÃN hiển thị trên tile (có thể khác nếu sau này muốn), "defaultNewFolderName" là TÊN
    // THẬT ghi vào DB — cố ý tách 2 key dù value hiện giống nhau, để đổi riêng từng cái sau này
    // không ảnh hưởng nhau.
    'fileManager.folderPicker.newTileLabel': 'New folder',
    'fileManager.folderPicker.defaultNewFolderName': 'New folder',
    // ── Section "File Manager" trong Settings (CHỐT 03/07/2026 — xem
    // plan-v12-multimedia-decisions.md mục 1a/7): KHÔNG còn 1 overlay cấp cao riêng với tab bar
    // nữa — đây giờ là 1 section thường trong Settings (giống "Hệ thống & Playlist"...), 3 hàng
    // bấm vào push thẳng sang drawer con tương ứng (nav-stack, cùng pattern About/Visualizer
    // Settings), KHÔNG qua màn trung gian nào.
    'fileManager.sectionTitle': 'File Manager',
    'fileManager.entry.song': 'Song',
    'fileManager.entry.photo': 'Photo & Album',
    'fileManager.entry.video': 'Video', // MỚI (21/07/2026)
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
    // Batch D5 (06/07/2026) — 'fileManager.song.back.title' XOÁ, dùng CHUNG
    // 'settingsDrawer.back.title' (Batch D1) cho mọi panel.
    // ── Drawer con: Photo & Album (placeholder, chưa code — b2/b3) ──────────────────────────
    'fileManager.photo.title': 'Photo & Album',
    'fileManager.photo.loadingTitle': 'Loading photos...',
    // Batch D6 (06/07/2026) — 'fileManager.photo.back.title' XOÁ, dùng CHUNG
    // 'settingsDrawer.back.title' (Batch D1).
    // ── Batch 3 (03/07/2026) ──────────────────────────────────────────────────────────────
    'fileManager.photo.uploadTitle': 'Add photos',
    'fileManager.photo.image.empty': 'No photos yet. Tap the + button above to add some.',
    // MỚI (04/07/2026, mục 2 phản hồi Giang) — carousel chọn ảnh nền (Visual/Playlist).
    'fileManager.photo.carousel.confirmButton': 'Use this photo',
    // MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — carousel xem ảnh trong album (KHÁC carousel
    // chọn nền ngay trên — nút đáy ở đây là "Xoá khỏi album", không phải "Dùng ảnh này").
    'fileManager.photo.album.carousel.removeButton': 'Remove from album',
    'fileManager.photo.album.carousel.infoTitle': 'Album name',
    // MỚI (Giai đoạn 3b) — Album List sub-panel (THAY story slider ngang cũ).
    'fileManager.photo.albumList.title': 'Photo Albums',
    'fileManager.photo.albumList.entryButton': 'Photo Albums',
    'fileManager.photo.albumList.empty': 'No albums yet.',
    'fileManager.photo.albumList.createNew': 'New album',
    'fileManager.photo.albumList.photoCount': '{count} photos',
    'fileManager.photo.albumList.menuTitle': 'Album options',
    'fileManager.photo.image.btnDelete': 'Remove from library',
    'fileManager.photo.image.btnRemoveFromAlbum': 'Remove from album',
    'fileManager.photo.image.uploadSuccess': 'Added {count} photo(s).',
    // ── Batch tiếp theo (03/07/2026, hạ tầng z-index nền Visual) — "Đặt làm nền" trên ảnh ─────
    // RÚT GỌN (14/07/2026, mục cuối — icon hoá menu action ảnh, Giang yêu cầu tên ngắn gọn).
    'fileManager.photo.image.btnSetPlaylistBg': 'Set as background',
    'fileManager.photo.image.btnSetVisualBg': 'Set as background visualizer',
    'fileManager.photo.image.setPlaylistBgSuccess': 'Set as Playlist background.',
    'fileManager.photo.image.setVisualBgSuccess': 'Set as Visualizer background.',
    // MỚI (14/07/2026, mục cuối) — action mới trong menu (đã icon hoá) + tiêu đề Generic Drawer.
    'fileManager.photo.image.btnEditImage': 'Edit image',
    'fileManager.photo.image.menuTitle': 'Photo options',
    // MỚI (14/07/2026, mục cuối, mục 2.2) — chế độ xoá nhanh.
    'fileManager.photo.image.quickDeleteTitle': 'Quick delete',
    'fileManager.photo.image.quickDeleteConfirm.title': 'Enable quick delete?',
    // SỬA (Giai đoạn 3, rewrite Photo/Album — redesign chế độ xoá nhanh) — hành vi MỚI: bấm ảnh chỉ
    // ĐÁNH DẤU (không xoá ngay), bấm lại icon thùng rác mới thật sự xoá TOÀN BỘ đã đánh dấu 1 lần.
    'fileManager.photo.image.quickDeleteConfirm.desc': 'While enabled, tap photos to mark them for deletion. Tap the trash icon again to delete all marked photos at once.',
    'fileManager.photo.image.quickDeleteConfirm.confirmBtn': 'Enable',
    // MỚI (Giai đoạn 3) — xác nhận xoá batch (chỉ hỏi khi có ≥1 ảnh đã đánh dấu — 0 ảnh thì thoát
    // thẳng, không hỏi gì, xem event/router/file-manager-photo.js). Đúng khuôn modalChoice() ở
    // deleteAlbumById() ngay dưới: `.confirm` (text động, có {count}) -> tham số 1; `.title` (tiêu đề
    // ngắn TĨNH) -> option {title}.
    'fileManager.photo.image.quickDeleteBatchConfirm.confirm': 'Delete {count} photos? This cannot be undone.',
    'fileManager.photo.image.quickDeleteBatchConfirm.title': 'Delete photos?',
    'fileManager.photo.image.quickDeleteBatchConfirm.confirmBtn': 'Delete',
    'fileManager.photo.album.all': 'All',
    'fileManager.photo.album.new': 'New',
    'fileManager.photo.album.createTitle': 'New album',
    'fileManager.photo.album.namePlaceholder': 'Album name',
    'fileManager.photo.album.btnCreate': 'Create',
    // ── Batch tiếp theo (03/07/2026, mục 2.2/2.3) — Đổi tên/Xoá album ────────────────────────
    // MỚI (Batch 8, 03/07/2026, slideshow nền Visual).
    'fileManager.photo.album.setSlideshowBgTitle': 'Use as Slideshow background',
    'fileManager.photo.album.setSlideshowBgSuccess': 'Set as Slideshow background.',
    'fileManager.photo.album.renameTitle': 'Rename album',
    'fileManager.photo.album.deleteTitle': 'Delete album',
    'fileManager.photo.album.deleteConfirm': 'Delete album "{name}"? Photos inside stay in your library, only the album is removed.',
    'fileManager.photo.album.btnDelete': 'Delete',
    'fileManager.photo.album.selectedCount': '{count} selected',
    // RESTORE (18/07/2026, Giang yêu cầu "khôi phục add photo vào album") — 17/07/2026 từng xoá 3
    // key ngay dưới cùng lúc bỏ picker multi-select, nay khôi phục lại (picker quay lại, điểm vào
    // đổi — xem workflowFileManagerPhoto.openAlbumImagePicker()).
    'fileManager.photo.album.addImagesTitle': 'Add photos',
    'fileManager.photo.album.btnAddSelected': 'Add to album',
    'fileManager.photo.album.addImagesSuccess': 'Added {count} photo(s) to the album.',
    // MỚI (18/07/2026) — 2 lựa chọn trong dropdown nút "+" khi đang lọc theo album (xem
    // workflowFileManagerPhoto.openAddToAlbumChoiceMenu()).
    'fileManager.photo.album.addChoiceUploadTitle': 'Upload new photos',
    'fileManager.photo.album.addChoiceExistingTitle': 'Choose from library',
    // ── Drawer con: Video (MỚI, 21/07/2026) — KHÔNG có Album, đơn giản hơn hẳn Photo ─────────
    'fileManager.video.title': 'Video',
    'fileManager.video.loadingTitle': 'Loading videos...',
    'fileManager.video.uploadTitle': 'Add videos',
    'fileManager.video.empty': 'No videos yet. Tap the + button above to add some.',
    'fileManager.video.uploadSuccess': 'Added {count} video(s).',
    'fileManager.video.btnDelete': 'Delete video',
    'fileManager.video.deleteConfirm.title': 'Delete video?',
    'fileManager.video.deleteConfirm.desc': 'Delete this video? This cannot be undone.',
    'fileManager.video.deleteConfirm.confirmBtn': 'Delete',
    'fileManager.video.quickDeleteTitle': 'Quick delete',
    'fileManager.video.quickDeleteConfirm.title': 'Enable quick delete?',
    'fileManager.video.quickDeleteConfirm.desc': 'While enabled, tap videos to mark them for deletion. Tap the trash icon again to delete all marked videos at once.',
    'fileManager.video.quickDeleteConfirm.confirmBtn': 'Enable',
    'fileManager.video.quickDeleteBatchConfirm.title': 'Delete videos?',
    'fileManager.video.quickDeleteBatchConfirm.confirm': 'Delete {count} videos? This cannot be undone.',
    'fileManager.video.quickDeleteBatchConfirm.confirmBtn': 'Delete',
    // ── Drawer con: Documents (mục 4.b4, ĐÃ CODE THẬT 04/07/2026) ────────────────────────────
    'fileManager.document.title': 'Documents',
    // Batch D7 (06/07/2026, batch cuối Nhóm D) — 'fileManager.document.back.title' XOÁ, dùng
    // CHUNG 'settingsDrawer.back.title' (Batch D1).
    'fileManager.document.btnUpload': 'Upload document',
    'fileManager.document.btnCreate': 'Create new',
    'fileManager.document.empty': 'No documents yet.',
    'fileManager.document.badgeUser': 'Created in app',
    'fileManager.document.badgeUpload': 'Uploaded',
    'fileManager.document.btnRename': 'Rename',
    'fileManager.document.btnDelete': 'Delete',
    'fileManager.document.btnDownload': 'Download',
    'fileManager.document.titlePlaceholder': 'Document title',
    'fileManager.document.createTitle': 'New document',
    'fileManager.document.renameTitle': 'Rename document',
    'fileManager.document.invalidType': 'Only .txt or .docx files are supported.',
    'fileManager.document.docxWarningTitle': 'Some formatting may not carry over',
    // VIẾT LẠI (10/07/2026, Nhóm A — mục 1.2 plan-v12-extended.md): mammoth.js -> HTML ->
    // sanitizeDocumentHtml() TRỰC TIẾP (KHÔNG còn qua Markdown/Turndown) — nội dung cảnh báo vẫn
    // ĐÚNG Ý NGHĨA cũ (giữ đậm/nghiêng/tiêu đề/danh sách, mất ảnh/bảng/định dạng phức tạp khác),
    // chỉ đổi từ "Markdown" sang "formatted text" cho khớp cơ chế mới.
    'fileManager.document.docxWarningBody': 'Uploading a .docx file converts it to formatted text: bold, italic, headings, and lists are kept, but images, tables, and other complex formatting will be discarded. Continue?',
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
    // ── Document Picker (danh sách chọn tài liệu, trong Generic Drawer trắng) ─────────────────
    'documentPicker.title': 'Choose document',
    'documentPicker.empty': 'No documents yet — add one in File Manager.',
    // ── Document Editor Surface — toolbar contentEditable dùng CHUNG (MỚI 10/07/2026, Nhóm A —
    // mục 1.3 plan-v12-extended.md, THAY Toast UI Editor). Xem
    // core/file-manager/document-ui.js::buildDocumentEditorSurface(). ──────────────────────────
    'documentEditor.toolbar.bold': 'Bold',
    'documentEditor.toolbar.italic': 'Italic',
    'documentEditor.toolbar.underline': 'Underline',
    'documentEditor.toolbar.heading': 'Heading (tap to cycle)',
    'documentEditor.toolbar.quote': 'Quote',
    'documentEditor.toolbar.bulletList': 'Bullet list',
    'documentEditor.toolbar.numberedList': 'Numbered list',
    'documentEditor.toolbar.link': 'Link',
    'documentEditor.linkPrompt': 'Enter the link URL',
    // ── File Manager -> Song: Folder (mục 4.b1) ──────────────────────────────────────────────
    'fileManager.song.folderSectionTitle': 'Folders',
    'fileManager.song.newFolderPlaceholder': 'New folder name',
    'fileManager.song.btnCreateFolder': 'Create',
    'fileManager.song.folderEmpty': 'No folders yet.',
    // MỚI (14/07/2026, Giang yêu cầu) — hiển thị số bài trong mỗi hàng folder.
    'fileManager.song.folderSongCount': '{count} songs',
    'fileManager.song.activeFolderBadge': 'Currently applied to Playlist',
    'fileManager.song.renameFolderTitle': 'Rename folder',
    'fileManager.song.deleteFolderTitle': 'Delete folder',
    'fileManager.song.deleteFolderConfirm': 'Delete folder "{name}"? Songs inside stay in your library, only the folder is removed.',
    'fileManager.song.btnDeleteFolder': 'Delete',
    // ── File Manager -> Song -> Folder Detail Drawer (Phase 2, CHỐT 03/07/2026) ──────────────
    // Batch D5 (06/07/2026) — 'fileManager.song.folderDetail.back.title' XOÁ, dùng CHUNG
    // 'settingsDrawer.back.title'. THÊM 'headerTitle' — header dùng chung chỉ nhận title CỐ ĐỊNH
    // lúc push (không tự cập nhật lại được sau khi biết tên folder thật) — tên folder thật giờ
    // hiển thị bằng 1 heading NGAY TRONG BODY panel (xem components/file-manager.js).
    'fileManager.song.folderDetail.headerTitle': 'Folder Detail',
    'fileManager.song.folderDetail.loadingTitle': 'Loading songs...',
    'fileManager.song.folderDetail.btnApply': 'Apply to Playlist',
    // SỬA (14/07/2026, Giang yêu cầu) — "Remove from Playlist" GÂY HIỂU NHẦM (nghe như xoá bài
    // khỏi playlist, trong khi thật ra chỉ HUỶ scope "folder đang active" — playlist quay lại hiện
    // TOÀN BỘ thư viện, không mất bài nào). Đổi tên rõ nghĩa hơn.
    'fileManager.song.folderDetail.btnUnapply': 'Unset Active Playlist',
    // 'songListTitle' XOÁ (14/07/2026, Giang yêu cầu — bỏ tiêu đề "SONGS IN THIS FOLDER") — KHÔNG
    // còn nơi nào dùng, xem components/file-manager.js::renderFileManagerFolderDetailPanelBody().
    'fileManager.song.folderDetail.empty': 'No songs in this folder yet.',
    'fileManager.song.folderDetail.removeSongTitle': 'Remove from folder',
    // MỚI (14/07/2026, Giang yêu cầu layout lại — icon Sửa tên cạnh tên folder).
    'fileManager.song.folderDetail.renameTitle': 'Rename folder',
    // MỚI (14/07/2026, Giang yêu cầu — nút "Xoá hết bài" CĂN GIỮA cuối panel, CHỈ dọn rỗng folder,
    // KHÔNG xoá folder — khác hẳn "Xoá folder" ở panel Song, deleteActiveFolderById()).
    'fileManager.song.folderDetail.btnRemoveAll': 'Remove all songs',
    'fileManager.song.folderDetail.removeAllTitle': 'Remove all songs',
    'fileManager.song.folderDetail.removeAllConfirm': 'Remove all songs from this folder? The folder itself stays — only its contents are cleared. Songs remain in your library.',
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
