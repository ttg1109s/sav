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
    // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — "Thêm vào thư mục" (menu 3
    // chấm Playlist) LUÔN hiển thị bất kể đang browse nguồn nào (không gate theo mediaType) nên
    // Video cũng đi qua thông báo này — trước đây LUÔN nói "song(s)" kể cả khi vừa thêm Video.
    'fileManager.folderPicker.addSuccessVideo': 'Added {count} video(s) to the folder.',
    // MỚI (hợp nhất Photo vào Playlist).
    'fileManager.folderPicker.addSuccessPhoto': 'Added {count} photo(s) to the folder.',
    'fileManager.folderPicker.duplicateName': 'A folder named "{name}" already exists (folder names are case-sensitive — different capitalization counts as a different name).',
    // XOÁ (hợp nhất Photo vào Playlist, cấu trúc folderIndex) — 'typeMismatch' bỏ hẳn:
    // addSongsToFolder() không còn trả trạng thái đó nữa (picker chỉ đưa vào folder ĐÚNG type).
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
    // SỬA (29/07/2026, yêu cầu Giang) — "Song & Video" -> "Song & Video Folder", khớp đúng chức
    // năng thật của hàng này (mở thẳng Generic Drawer duyệt THƯ MỤC, không còn dẫn vào panel thống
    // kê/quản lý gì nữa — panel đó đã tách hẳn thành "Quản lý lưu trữ" riêng).
    'fileManager.entry.song': 'Song & Video Folder',
    'fileManager.entry.photo': 'Photo & Album',
    // XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — 'fileManager.entry.
    // video' (hàng Settings riêng cho panel Video) — đã gộp hẳn vào "Song & Video" ở trên, panel
    // Video độc lập không còn tồn tại. XOÁ (loại bỏ Document Reader khỏi app) —
    // 'fileManager.entry.document'.
    // MỚI (04/07/2026, mục 2 phản hồi Giang) — công cụ dọn rác chung File Manager.
    'fileManager.cleanup.label': 'Clean up data',
    'fileManager.cleanup.hint': 'Scan and remove leftover orphaned data across File Manager',
    'fileManager.cleanup.running': 'Scanning…',
    'fileManager.cleanup.resultFound': 'Cleaned up {count} item(s).',
    'fileManager.cleanup.resultClean': 'Everything is clean — nothing to remove.',
    'fileManager.comingSoon': 'Coming soon.',
    // ── Drawer con: Song ──────────────────────────────────────────────────────────────────
    // FIX (03/07/2026, mục 4 yêu cầu) — bỏ tiền tố "File Manager · " khỏi CẢ 2 tiêu đề drawer con
    // (Song/Photo & Album): tiêu đề section cha "File Manager" đã hiện rõ ở hàng Settings
    // trước khi push vào, lặp lại tiền tố trên thanh bar tiêu đề của chính drawer con là thừa —
    // khớp đúng các key `fileManager.entry.*` (nhãn hàng trong Settings) vốn đã KHÔNG có tiền tố.
    'fileManager.song.title': 'Song & Video',
    // Batch D5 (06/07/2026) — 'fileManager.song.back.title' XOÁ, dùng CHUNG
    // 'settingsDrawer.back.title' (Batch D1) cho mọi panel.
    // ── Drawer con: Photo — hợp nhất vào Playlist làm 1 Source, không còn panel/title riêng.
    // 'fileManager.photo.title'/'.loadingTitle'/'.uploadTitle'/'.carousel.confirmButton'/
    // '.image.btnDelete'/'.image.quickDeleteTitle'/'.image.quickDeleteConfirm.*'/
    // '.image.quickDeleteBatchConfirm.*' bỏ hẳn cùng Photo Panel/carousel picker/nút xoá dropdown.
    'fileManager.photo.image.empty': 'No photos yet. Tap the + button above to add some.',
    'fileManager.photo.image.uploadSuccess': 'Added {count} photo(s).',
    // XOÁ (Giang yêu cầu bỏ "Đặt làm nền Playlist") — btnSetPlaylistBg/setPlaylistBgSuccess bỏ hẳn
    // cùng tính năng.
    // GỘP View/Zoom/Edit làm 1 modal (bỏ dropdown "...") — header giờ 2 icon cố định: Save (dropdown
    // 2 lựa chọn Ghi đè/Lưu mới), Edit (mở lưới tool phẳng, tiêu đề editGridTitle). Không còn "mode"
    // nào cần tên riêng (btnZoom/btnEditImage/menuTitle/closeBlockedByMode/zoomBlockedByEdit/
    // editBlockedByZoom bỏ hẳn) — cũng không còn group header trong lưới tool (editGroupAdjust/
    // Tools/Draw bỏ hẳn, lưới giờ phẳng).
    'fileManager.photo.image.saveMenuTitle': 'Save',
    'fileManager.photo.image.editGridTitle': 'Edit tools',
    'fileManager.photo.image.editToolBrightness': 'Brightness',
    'fileManager.photo.image.editToolContrast': 'Contrast',
    'fileManager.photo.image.editToolSaturation': 'Saturation',
    'fileManager.photo.image.editToolTemperature': 'Temperature',
    'fileManager.photo.image.editToolTint': 'Tint',
    'fileManager.photo.image.editToolSharpen': 'Sharpen',
    'fileManager.photo.image.editToolCrop': 'Crop',
    // MỚI (bổ sung danh sách chọn tỉ lệ Crop, Giang yêu cầu) — nhãn 2 nút không tự hiển thị số
    // ('Free'/'Square'), 4 tỉ lệ còn lại hiện thẳng "4:3" v.v. không cần key riêng.
    'fileManager.photo.image.cropRatioFree': 'Free',
    'fileManager.photo.image.cropRatioSquare': 'Square',
    'fileManager.photo.image.editToolText': 'Text',
    'fileManager.photo.image.editToolDraw': 'Draw',
    'fileManager.photo.image.btnSaveOverwrite': 'Save (overwrite)',
    'fileManager.photo.image.btnSaveNew': 'Save as new',
    'fileManager.photo.image.editSaveOverwriteSuccess': 'Saved — original photo updated.',
    'fileManager.photo.image.editSaveNewSuccess': 'Saved as a new photo.',
    'fileManager.photo.image.editTextPlaceholder': 'Text',
    'fileManager.photo.image.editDrawBrush': 'Brush',
    'fileManager.photo.image.editDrawEraser': 'Eraser',
    // MỚI (Shape tool + layer Text/Shape, Giang yêu cầu "text/shape là layer chỉnh sửa lại được" +
    // "thêm tool shape/hoạ tiết").
    'fileManager.photo.image.editToolShape': 'Shape',
    // Menu long-press (nhấn giữ 1.5s) trên 1 layer có sẵn.
    // SỬA (Giang chỉ ra `workflowElementStyleEditor` vốn đã là công cụ CHUNG dùng bởi Subtitle
    // Styling, KHÔNG tự chế Generic Drawer riêng cho Photo layer nữa) — "Sửa" cũ TÁCH thành 2 mục:
    // "layerMenuEditContent" (CHỈ Text — sửa nội dung chữ qua modalChoice(), core/modal-choice-
    // ui.js) + "layerMenuEdit" (giữ nguyên tên/nghĩa cũ, giờ mở workflowElementStyleEditor thay vì
    // Drawer tự chế — event/workflow/image-edit.js::openLayerStyleEditor()). 6 key
    // layerStyleTitleText/Shape/FontSize/Color/Fill/Stroke/StrokeWidth (dùng bởi
    // `_buildLayerStyleDrawerHtml()` cũ) đã XOÁ HẲN cùng lúc — Element Style Editor tự có nhãn field
    // riêng của nó (components/element-style-editor-drawer.js), không cần bộ key này nữa.
    'fileManager.photo.image.layerMenuEditContent': 'Edit text',
    'fileManager.photo.image.layerMenuEdit': 'Edit style',
    'fileManager.photo.image.layerMenuDuplicate': 'Duplicate',
    'fileManager.photo.image.layerMenuDelete': 'Delete',
    // Tiêu đề modalChoice() "Sửa nội dung" (layer Text).
    'fileManager.photo.image.layerEditContentTitle': 'Edit text content',
    // ── Drawer con: Video — ĐÃ XOÁ HẲN panel riêng (ver12 "Song/Video Unification", Batch 6, mục
    // 6d, phản hồi Giang) — gộp vào "Song & Video" (Batch 5). CHỈ CÒN 3 key dưới đây (dùng bởi
    // uploadVideos()/picker "Use background video" — xem event/workflow/file-manager-video.js) —
    // mọi key khác (title/loadingTitle/uploadTitle/quickDelete*/deleteConfirm.*/editVideo.label/
    // btnSetAsBgVideo/btnDelete/info.* — modal Info riêng đã xoá ở mục trước) ĐÃ XOÁ, không còn nơi
    // gọi. "Sửa video" giờ ở menu 3 chấm CHUNG Playlist, dùng key
    // playlistView.songMenu.editVideoFile (lang/patch/patch-playlist.js) — "Set làm nền" (dropdown)
    // ĐÃ BỎ HẲN (phản hồi Giang), `setAsBgVideo.blockedByPlayerMode`/`.success` mồ côi theo, XOÁ
    // luôn (hàm setVideoAsBackground() dùng 2 key này cũng đã xoá, 0 lời gọi còn lại). Nút "Xoá"
    // dùng chung window.removeSong(), key playlistView.songMenu.deleteBlockedPlaying(Video)/
    // deleteSuccess (đã có sẵn ở patch-playlist.js).
    'fileManager.video.empty': 'No videos yet. Tap the + button above to add some.',
    'fileManager.video.uploadSuccess': 'Added {count} video(s).',
    'fileManager.video.pickerTitle': 'Choose a video',
    // XOÁ (30/07/2026, cùng ngày) — 'fileManager.video.thumbFullRegenProgress' (tiến trình regen
    // lúc boot) + 'fileManager.video.noFullResThumbForBgImage' (test picker chọn nền Visual từ
    // video) ĐÃ XOÁ — cả 2 tính năng liên quan đều đã bỏ/hoàn tác trong cùng ngày, xem
    // event/workflow/file-manager-video.js + event/workflow/visualizer-control-center.js.
    // XOÁ (loại bỏ Document Reader khỏi app) — toàn bộ key 'fileManager.document.*'/
    // 'documentReader.*'/'documentPicker.*'/'documentEditor.*' (Drawer con Documents + Document
    // Reader/Picker + Document Editor Surface) bỏ hẳn cùng tính năng.
    // ── File Manager -> Song & Video: Folder Browser (Generic Drawer, Batch 5 mục 6e) ─────────
    // SỬA (Batch 5) — 'folderSectionTitle'/'newFolderPlaceholder'/'btnCreateFolder'/'folderEmpty'/
    // 'folderSongCount'/'activeFolderBadge'/'folderDetail.headerTitle'/'folderDetail.loadingTitle'/
    // 'folderTypeSong'/'folderTypeVideo'/'folderTypeUndetermined' ĐÃ XOÁ — thuộc
    // core/file-manager/folder-list-ui.js (ĐÃ XOÁ HẲN, thay bằng grid Generic Drawer tái dùng
    // itemTemplateFolderTile() có sẵn — không hiện số bài/type badge nữa, đúng "không mở rộng gì").
    'fileManager.folderBrowser.entryButton': 'Browse folders',
    'fileManager.folderBrowser.listTitle': 'Folders',
    'fileManager.folderBrowser.defaultNewFolderName': 'Folder {n}',
    'fileManager.song.renameFolderTitle': 'Rename folder',
    'fileManager.song.deleteFolderTitle': 'Delete folder',
    'fileManager.song.deleteFolderConfirm': 'Delete folder "{name}"? Songs inside stay in your library, only the folder is removed.',
    // MỚI (phản hồi Giang, mục "ngôn ngữ theo ngữ cảnh Song/Video") — Folder Browser Read (Generic
    // Drawer, event/workflow/file-manager-folder-browser.js::_folderText()) dùng CHUNG UI cho Song
    // lẫn Video (Video ra đời SAU, bộ chuỗi gốc chỉ viết cho ngữ cảnh Song) — mọi key "...Video"
    // dưới đây là biến thể áp dụng khi folder đang xem là Video, chọn qua `_folderText()`.
    'fileManager.song.deleteFolderConfirmVideo': 'Delete folder "{name}"? Videos inside stay in your library, only the folder is removed.',
    // MỚI (khôi phục — thêm biến thể Photo song song Video, xem docstring _folderTypeSuffix()
    // event/workflow/file-manager-folder-browser.js).
    'fileManager.song.deleteFolderConfirmPhoto': 'Delete folder "{name}"? Photos inside stay in your library, only the folder is removed.',
    'fileManager.song.btnDeleteFolder': 'Delete',
    // ── File Manager -> Song & Video: Giải phóng bộ nhớ, 3 chiều độc lập (Batch 5, mục 6b) ────
    // THAY 2 nút tách rời cũ (storageDrawer.downloadThenClear/clearNoDownload, lang/patch/
    // patch-settings-misc.js) bằng: phạm vi (Song/Video/Cả hai) + 2 toggle (Tải xuống/Xoá) + 1 nút
    // Thực hiện.
    'fileManager.song.storageAction.sectionTitle': 'Free up storage',
    'fileManager.song.storageAction.scopeLabel': 'Scope',
    'fileManager.song.storageAction.scope.song': 'Songs',
    'fileManager.song.storageAction.scope.video': 'Videos',
    'fileManager.song.storageAction.scope.both': 'Songs & videos',
    'fileManager.song.storageAction.downloadToggle.label': 'Download first',
    'fileManager.song.storageAction.downloadToggle.hint': 'Pack the original files into a zip and download them before doing anything else.',
    'fileManager.song.storageAction.deleteToggle.label': 'Delete from library',
    'fileManager.song.storageAction.deleteToggle.hint': 'Remove the selected files from this device — cannot be undone.',
    'fileManager.song.storageAction.btnExecute': 'Execute',
    'fileManager.song.storageAction.confirmTitle': 'Confirm',
    'fileManager.song.storageAction.confirmDownloadAndDelete': 'Download all {scope} as a zip file, then DELETE them from this device? The delete action cannot be undone once the download finishes.',
    'fileManager.song.storageAction.confirmDownloadOnly': 'Download all {scope} as a zip file? Nothing will be deleted.',
    'fileManager.song.storageAction.confirmDeleteOnly': 'Delete all {scope} from this device? This action CANNOT be undone.',
    'fileManager.song.storageAction.confirmBtnDownload': 'Download',
    'fileManager.song.storageAction.confirmBtnDelete': 'Delete',
    'fileManager.song.storageAction.zipNameSong': 'songs',
    'fileManager.song.storageAction.zipNameVideo': 'videos',
    'fileManager.song.storageAction.doneDownloadAndDelete': 'Zip file(s) downloaded and {scope} deleted from this device.',
    'fileManager.song.storageAction.doneDownloadOnly': 'Zip file(s) downloaded.',
    'fileManager.song.storageAction.doneDeleteOnly': '{scope} deleted from this device.',
    'fileManager.song.storageAction.zipErrorSkippedDelete': "Couldn't build the zip file: {message}. Deletion was skipped to avoid losing data without a backup.",
    // ── File Manager -> Song & Video -> Folder Browser Read (nội dung 1 folder) ───────────────
    // MỚI (Batch 4, "Song/Video Unification" mục 5) — 2 toggle ĐỘC LẬP THAY nút Áp dụng/Bỏ áp
    // dụng cũ ('btnApply'/'btnUnapply' XOÁ, không còn nút chữ đổi nhãn).
    'fileManager.song.folderDetail.scopeToggle.label': 'Use as Playlist source',
    'fileManager.song.folderDetail.scopeToggle.hint': 'When on, the Playlist only shows songs from this folder.',
    'fileManager.song.folderDetail.scopeToggle.hintVideo': 'When on, the Playlist only shows videos from this folder.',
    'fileManager.song.folderDetail.scopeToggle.hintPhoto': 'When on, the Playlist only shows photos from this folder.',
    'fileManager.song.folderDetail.excludeToggle.label': 'Hide from "All songs" view',
    'fileManager.song.folderDetail.excludeToggle.labelVideo': 'Hide from "All videos" view',
    'fileManager.song.folderDetail.excludeToggle.labelPhoto': 'Hide from "All photos" view',
    'fileManager.song.folderDetail.excludeToggle.hint': 'When on, songs in this folder are skipped while browsing all songs (does not affect any specific folder scope).',
    'fileManager.song.folderDetail.excludeToggle.hintVideo': 'When on, videos in this folder are skipped while browsing all videos (does not affect any specific folder scope).',
    'fileManager.song.folderDetail.excludeToggle.hintPhoto': 'When on, photos in this folder are skipped while browsing all photos (does not affect any specific folder scope).',
    'fileManager.song.folderDetail.empty': 'No songs in this folder yet.',
    'fileManager.song.folderDetail.emptyVideo': 'No videos in this folder yet.',
    'fileManager.song.folderDetail.emptyPhoto': 'No photos in this folder yet.',
    'fileManager.song.folderDetail.removeSongTitle': 'Remove from folder',
    // MỚI (14/07/2026, Giang yêu cầu layout lại — icon Sửa tên cạnh tên folder).
    'fileManager.song.folderDetail.renameTitle': 'Rename folder',
    // MỚI (14/07/2026, Giang yêu cầu — nút "Xoá hết bài" CĂN GIỮA cuối panel, CHỈ dọn rỗng folder,
    // KHÔNG xoá folder — khác hẳn "Xoá folder" ở panel Song, deleteActiveFolderById()).
    'fileManager.song.folderDetail.btnRemoveAll': 'Remove all songs',
    'fileManager.song.folderDetail.btnRemoveAllVideo': 'Remove all videos',
    'fileManager.song.folderDetail.btnRemoveAllPhoto': 'Remove all photos',
    'fileManager.song.folderDetail.removeAllTitle': 'Remove all songs',
    'fileManager.song.folderDetail.removeAllTitleVideo': 'Remove all videos',
    'fileManager.song.folderDetail.removeAllTitlePhoto': 'Remove all photos',
    'fileManager.song.folderDetail.removeAllConfirm': 'Remove all songs from this folder? The folder itself stays — only its contents are cleared. Songs remain in your library.',
    'fileManager.song.folderDetail.removeAllConfirmVideo': 'Remove all videos from this folder? The folder itself stays — only its contents are cleared. Videos remain in your library.',
    'fileManager.song.folderDetail.removeAllConfirmPhoto': 'Remove all photos from this folder? The folder itself stays — only its contents are cleared. Photos remain in your library.',
    'fileManager.song.folderDetail.reloadTitle': 'Apply now?',
    'fileManager.song.folderDetail.reloadBtnNow': 'Reload now',
    'fileManager.song.folderDetail.applyReloadBody': 'Saved — the Playlist will show songs from "{name}" after reloading. Reload now?',
    'fileManager.song.folderDetail.applyReloadBodyVideo': 'Saved — the Playlist will show videos from "{name}" after reloading. Reload now?',
    'fileManager.song.folderDetail.applyReloadBodyPhoto': 'Saved — the Playlist will show photos from "{name}" after reloading. Reload now?',
    'fileManager.song.folderDetail.unapplyReloadBody': 'Saved — the Playlist will show all songs again after reloading. Reload now?',
    'fileManager.song.folderDetail.unapplyReloadBodyVideo': 'Saved — the Playlist will show all videos again after reloading. Reload now?',
    'fileManager.song.folderDetail.unapplyReloadBodyPhoto': 'Saved — the Playlist will show all photos again after reloading. Reload now?',
    'fileManager.song.folderDetail.autoUnapplyReloadBody': 'This folder is now empty, so it was removed as the Playlist source. The Playlist will show all songs again after reloading. Reload now?',
    'fileManager.song.folderDetail.autoUnapplyReloadBodyVideo': 'This folder is now empty, so it was removed as the Playlist source. The Playlist will show all videos again after reloading. Reload now?',
    'fileManager.song.folderDetail.autoUnapplyReloadBodyPhoto': 'This folder is now empty, so it was removed as the Playlist source. The Playlist will show all photos again after reloading. Reload now?',
    'fileManager.song.folderDetail.deleteReloadBody': 'Folder deleted — the Playlist will show all songs again after reloading. Reload now?',
    'fileManager.song.folderDetail.deleteReloadBodyVideo': 'Folder deleted — the Playlist will show all videos again after reloading. Reload now?',
    'fileManager.song.folderDetail.deleteReloadBodyPhoto': 'Folder deleted — the Playlist will show all photos again after reloading. Reload now?',
    'fileManager.song.deleteActiveFolderConfirm': 'Delete folder "{name}"? This folder is currently applied to the Playlist.',
    // MỚI (Batch 4, "Song/Video Unification" mục 5) — toggle Exclude.
    'fileManager.song.folderDetail.excludeOnReloadBody': 'Saved — songs in this folder will be hidden from the "All songs" view after reloading. Reload now?',
    'fileManager.song.folderDetail.excludeOnReloadBodyVideo': 'Saved — videos in this folder will be hidden from the "All videos" view after reloading. Reload now?',
    'fileManager.song.folderDetail.excludeOnReloadBodyPhoto': 'Saved — photos in this folder will be hidden from the "All photos" view after reloading. Reload now?',
    'fileManager.song.folderDetail.excludeOffReloadBody': 'Saved — songs in this folder will show again in the "All songs" view after reloading. Reload now?',
    'fileManager.song.folderDetail.excludeOffReloadBodyVideo': 'Saved — videos in this folder will show again in the "All videos" view after reloading. Reload now?',
    'fileManager.song.folderDetail.excludeOffReloadBodyPhoto': 'Saved — photos in this folder will show again in the "All photos" view after reloading. Reload now?',
};
