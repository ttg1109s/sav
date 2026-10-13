/**
 * event/router/playlist.js — Router "playlist": màn Playlist (menu 3 chấm, modal lỗi phát/sửa thông tin, nạp media,
 * sắp xếp/kiểu xem/tìm kiếm, chọn nhiều, picker "Thêm vào thư mục"). Tự đăng ký với eventBus lúc nạp.
 *
 * Rẽ nhánh: nghiệp vụ chỉ cần 1 hàm core -> gọi thẳng; cần nhiều bước/shield/modal -> giao Workflow. Rẽ theo appState
 * (activeMediaSource, selectionMode) đi qua VirtualMachineState.
 *
 * State của các modal (songActionMenuKey, playbackErrorKey, songEditCurrentKey, songEditPendingCover…) sống trong
 * `playlistStore` (event/store.js, tạo ở core/playlist/actions.js) — Router không giữ state riêng.
 *
 * NẠP SAU: event/bus.js, core/playlist/{actions,loader,main}.js, event/workflow/{playlist,player}.js.
 * NẠP TRƯỚC: event/listener/playlist.js.
 */
const routerPlaylist = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== Menu 3 chấm =====================
            case 'playlist.actionOverlay.click': {
                // Đóng menu + chạy lượt cuộn đang hoãn (nếu có) -> Workflow.
                workflowPlaylist.closeActionMenu();
                break;
            }

            // Mỗi hành động của menu là 1 msg.type riêng; cần đóng menu + hành động -> Workflow.
            case 'playlist.actionMenu.delete.click': {
                workflowPlaylist.deleteMediaFromActionMenu(msg.payload.songKey);
                break;
            }

            case 'playlist.actionMenu.removeFromFolder.click': {
                workflowPlaylist.removeSongFromFolderMenu(msg.payload.songKey);
                break;
            }

            case 'playlist.actionMenu.edit.click': {
                workflowPlaylist.openSongEditFromActionMenu();
                break;
            }

            // Đọc key + đóng menu + mở picker folder -> Workflow.
            case 'playlist.actionMenu.addToFolder': {
                workflowPlaylist.openAddToFolderPickerForSongMenu();
                break;
            }

            // ===================== Picker "Thêm vào thư mục" (Generic Drawer) =====================
            // Wiring: core/file-manager/folder-picker-ui.js::wireFolderPickerDrawerEvents(). Chạm/giữ tay tile: workflowFolder
            // (event/workflow/folder.js) đếm giữ tay rồi phát lại `.tile.tap` / `.tile.longpress`.

            case 'playlist.folderPicker.tile.pointerdown': {
                workflowFolder.beginTileHold('playlist', 'playlist.folderPicker', msg.payload.folderId, msg.payload.anchorEl);
                break;
            }

            case 'playlist.folderPicker.tile.pointerup': {
                workflowFolder.endTileHold();
                break;
            }

            case 'playlist.folderPicker.tile.pointercancel': {
                workflowFolder.cancelTileHold();
                break;
            }

            case 'playlist.folderPicker.tile.click': {
                workflowFolder.resolveTileClick('playlist', 'playlist.folderPicker', msg.payload.folderId);
                break;
            }

            case 'playlist.folderPicker.tile.tap': {
                workflowPlaylist.pickFolderInPicker(msg.payload.folderId);
                break;
            }

            // Picker không có menu giữ tay — giữ rồi thả chỉ không chọn gì (click tự phát đã bị nuốt).
            case 'playlist.folderPicker.tile.longpress':
                break;

            // Nút "Chọn (N)" + dropdown đổi loại — chỉ có khi picker ở chế độ multiSelect (Visual Background "Thư mục").
            case 'playlist.folderPicker.confirm.click': {
                workflowPlaylist.confirmFolderPickerSelection();
                break;
            }

            case 'playlist.folderPicker.typeChange': {
                workflowPlaylist.changeFolderPickerType(msg.payload.value);
                break;
            }

            case 'playlist.folderPicker.addTile.click': {
                workflowPlaylist.createFolderInPicker();
                break;
            }

            case 'playlist.folderPicker.rename.commit': {
                workflowPlaylist.commitFolderPickerRename(msg.payload.folderId, msg.payload.name);
                break;
            }

            case 'playlist.folderPicker.rename.keydown': {
                workflowFolder.handleTileRenameKeydown(msg.payload.key);
                break;
            }

            case 'playlist.folderPicker.close.click': {
                workflowPlaylist.closeFolderPicker();
                break;
            }

            case 'playlist.item.menuClick': {
                const { key, anchorBtn } = msg.payload;
                openSongActionMenu(key, anchorBtn);
                break;
            }

            case 'playlist.item.playClick': {
                const { key } = msg.payload;
                // Rẽ theo selectionMode qua VirtualMachineState: đang chọn nhiều -> Workflow đảo chọn + patch DOM; không ->
                // phát (Song/Video/Photo chung đường playMedia()).
                const selectionMode = appState.get('selectionMode');
                VirtualMachineState.run([
                    { state: selectionMode, operation: '===', value: true, callback: () => workflowPlaylist.toggleSongSelectionAndRefresh(key) },
                    { state: selectionMode, operation: '===', value: false, callback: () => workflowPlayer.playMedia(key) },
                ]);
                break;
            }

            // ===================== Modal: Bài hát lỗi lúc phát =====================
            case 'playlist.playbackError.keep': {
                // Giữ bài lỗi: bỏ khỏi danh sách hiển thị -> Workflow.
                workflowPlaylist.keepBrokenSong();
                break;
            }

            case 'playlist.playbackError.delete': {
                // Shield + nhiều bước -> Workflow.
                workflowPlaylist.executePlaybackErrorDelete();
                break;
            }

            // ===================== Modal: Sửa thông tin (Thông tin + Ảnh bìa) =====================
            case 'playlist.editTab.select': {
                const { tab } = msg.payload;
                setSongEditTab(tab); // CHỈ 1 hàm core thuần UI -> gọi thẳng
                break;
            }

            // "Choose photo" — đọc danh sách ảnh + mở picker -> Workflow.
            case 'playlist.editCover.pickFromLibrary': {
                workflowPlaylist.pickCoverFromLibrary();
                break;
            }

            // Nút "Choose" xổ dropdown Photo / Video thumbnail (mỗi mục bắn eventBus) -> Workflow.
            case 'playlist.editCover.choose.click': {
                workflowPlaylist.openCoverChooseMenu();
                break;
            }

            // Mục "Video thumbnail": mở picker video, chọn xong đọc record + áp thumb làm ảnh bìa -> Workflow.
            case 'playlist.editCover.pickFromVideoThumb': {
                workflowPlaylist.pickCoverFromVideoThumb();
                break;
            }

            // 2 message của picker video chọn thumb làm ảnh bìa (msgPrefix 'playlist.editCover.videoPicker').
            case 'playlist.editCover.videoPicker.tile.click': {
                workflowPlaylist.handleCoverVideoPickerTileClick(msg.payload.videoKey);
                break;
            }

            case 'playlist.editCover.videoPicker.close.click': {
                workflowPlaylist.handleCoverVideoPickerCloseClick();
                break;
            }

            case 'playlist.editCover.remove': {
                // 1 hàm core -> gọi thẳng.
                removeSongEditCover();
                break;
            }

            case 'playlist.edit.cancel': {
                closeSongEditModal(); // CHỈ 1 hàm core -> gọi thẳng
                break;
            }

            case 'playlist.edit.save': {
                // Shield + đọc state + nhiều bước + dọn UI -> Workflow.
                workflowPlaylist.executeSaveEdit();
                break;
            }

            // ===================== "Sửa phụ đề" (menu 3 chấm) =====================
            // Đọc key + đóng menu + mã hoá key + điều hướng trang -> Workflow.
            case 'playlist.actionMenu.editSubtitles': {
                workflowPlaylist.openSubtitleEditorForSongMenu();
                break;
            }

            // Hành động riêng của Video trong menu 3 chấm.
            case 'playlist.actionMenu.editVideoFile': {
                workflowPlaylist.navigateToActiveMenuVideoEdit();
                break;
            }

            // "Edit image" (Photo) — mở modal xem/sửa ảnh.
            case 'playlist.actionMenu.editImage': {
                workflowPlaylist.navigateToActiveMenuPhotoEdit();
                break;
            }

            // Nút duration ở tab "Sửa" của Photo — mở time-picker (event/workflow/playlist.js::openPhotoEditDurationPicker()).
            case 'playlist.edit.photoDuration.click': {
                workflowPlaylist.openPhotoEditDurationPicker();
                break;
            }

            // "Xuất file" — Workflow tự đọc key, đóng menu, chọn Song/Video.
            case 'playlist.actionMenu.restore': {
                workflowPlaylist.exportActiveMenuItem();
                break;
            }

            // ===================== Nạp media mới (file rời / cả thư mục) — chung Song/Video/Photo =====================
            // 2 input (#media-upload/#media-upload-folder) bắn cùng msg.type bất kể Nguồn; Router rẽ theo activeMediaSource.
            // Video/Photo dùng 1 hàm cho cả 2 case (cùng là FileList phẳng); Song tách 2 hàm (khác câu báo khi rỗng).
            case 'playlist.upload.fileChange': {
                const { fileList } = msg.payload;
                const source = appState.get('activeMediaSource');
                VirtualMachineState.run([
                    { state: source, operation: '===', value: 'song', callback: () => workflowPlaylist.handleSongFilePickerChange(fileList) },
                    { state: source, operation: '===', value: 'video', callback: () => workflowPlaylist.uploadVideos(fileList) },
                    { state: source, operation: '===', value: 'photo', callback: () => workflowPlaylist.uploadPhotos(fileList) },
                ]);
                break;
            }

            case 'playlist.upload.folderChange': {
                const { fileList } = msg.payload;
                const source = appState.get('activeMediaSource');
                VirtualMachineState.run([
                    { state: source, operation: '===', value: 'song', callback: () => workflowPlaylist.handleSongFolderPickerChange(fileList) },
                    { state: source, operation: '===', value: 'video', callback: () => workflowPlaylist.uploadVideos(fileList) },
                    { state: source, operation: '===', value: 'photo', callback: () => workflowPlaylist.uploadPhotos(fileList) },
                ]);
                break;
            }

            case 'playlist.uploadMenu.open': {
                // Rẽ theo selectionMode qua VirtualMachineState (đang chọn nhiều -> báo chặn bằng modal; không dùng
                // event/block.js vì cần chạy 1 việc khi bị chặn). Nút upload chung cho cả 3 Nguồn.
                const selectionMode = appState.get('selectionMode');
                VirtualMachineState.run([
                    { state: selectionMode, operation: '===', value: true, callback: () => workflowPlaylist.showUploadBlockedBySelectionModal() },
                    { state: selectionMode, operation: '===', value: false, callback: () => openUploadActionMenu() },
                ]);
                break;
            }

            case 'playlist.uploadMenu.overlayClick': {
                closeUploadActionMenu(); // CHỈ 1 hàm core -> gọi thẳng
                break;
            }

            case 'playlist.uploadMenu.labelClick': {
                const { target } = msg.payload;
                handleUploadMenuLabelClick(target); // CHỈ 1 hàm core -> gọi thẳng
                break;
            }

            // ===================== Sắp xếp / Kiểu xem / Tìm kiếm =====================
            // Đổi chế độ + lưu bền config -> Workflow.
            case 'playlist.sortMode.change': {
                const { mode } = msg.payload;
                workflowPlaylist.changeSortMode(mode);
                break;
            }

            // Sort trục thống kê: field / hướng.
            case 'playlist.statSortField.change': {
                const { field } = msg.payload;
                workflowPlaylist.changeStatSortField(field);
                break;
            }

            case 'playlist.statSortDirection.change': {
                const { direction } = msg.payload;
                workflowPlaylist.changeStatSortDirection(direction);
                break;
            }

            // Nút mở panel "Sắp xếp" (Settings → Playlist).
            case 'playlist.sortPanel.open.click': {
                workflowPlaylist.openSortPanel();
                break;
            }

            // ===================== Filter (nút duration dùng time picker) =====================

            // totalTime/duration dùng time picker h:m:s.

            case 'playlist.viewMode.change': {
                const { mode } = msg.payload;
                workflowPlaylist.changeViewMode(mode);
                break;
            }

            // Đổi Nguồn (Song/Video/Photo) — select ở Settings → Playlist; `switchSource()` nhận thẳng `source`.
            case 'playlist.mediaSource.change': {
                const { source } = msg.payload;
                workflowPlaylist.switchSource(source);
                break;
            }

            // Ô tìm kiếm: UI ô nhập + lọc + cuộn -> Workflow.
            case 'playlist.search.input': {
                const { value } = msg.payload;
                workflowPlaylistOrder.searchInput(value); // event/workflow/playlist-order.js
                break;
            }

            case 'playlist.search.clear': {
                workflowPlaylistOrder.searchClear(); // event/workflow/playlist-order.js
                break;
            }

            // Khung cuộn Playlist đổi kích thước (xoay máy…) -> đo lại chiều cao ước lượng item (tile Grid cao theo bề rộng cột).
            case 'playlist.viewport.resize': {
                const { width } = msg.payload;
                workflowPlaylistRender.onViewportResize(width); // event/workflow/playlist-render.js — chỉ đo lại khi bề rộng đổi
                break;
            }

            // Node chờ bìa lại gần khung nhìn (IntersectionObserver, event/listener/playlist.js) -> gắn object URL ảnh bìa.
            // Ảnh bìa tải lỗi -> ảnh mặc định (message tự đủ dữ liệu -> gọi thẳng core).
            case 'playlist.cover.error': {
                applyDefaultCover(msg.payload.img); // core/playlist/render.js
                break;
            }

            case 'playlist.cover.nearViewport': {
                const { keys } = msg.payload;
                workflowPlaylistRender.attachCoverUrls(keys); // event/workflow/playlist-render.js
                break;
            }

            // Nút X badge "thoát folder" — lưu ý định + áp "Tất cả" -> Workflow.
            case 'playlist.activeFolderBadge.exit.click': {
                workflowPlaylist.exitActiveFolderScope();
                break;
            }

            // ===================== Chọn nhiều =====================
            case 'playlist.selection.toggle': {
                workflowPlaylist.toggleSelectionMode(); // đọc domNodesByKey + patch DOM sau khi đổi state -> Workflow
                break;
            }

            case 'playlist.selection.moreMenu.open': {
                // Mục "Gỡ khỏi thư mục" chỉ hiện khi đang Scope 1 folder của Nguồn hiện tại — Router tính sẵn boolean.
                const canRemoveFromFolder = appState.get('activePlayListFolder')[appState.get('activeMediaSource')] != null;
                openSelectionMoreMenu(canRemoveFromFolder); // core thuần UI (nhận tham số) -> gọi thẳng
                break;
            }

            case 'playlist.selection.moreMenu.close': {
                closeSelectionMoreMenu(); // CHỈ 1 hàm core thuần UI -> gọi thẳng
                break;
            }

            case 'playlist.selection.moreMenu.select': {
                const { action } = msg.payload;
                closeSelectionMoreMenu(); // đóng menu trước khi chạy hành động
                // 4 hành động loại trừ nhau (data-menu-action, components/playlist-view.js) -> VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'play', callback: () => workflowPlaylist.playSelectedSongs() },
                    { state: action, operation: '===', value: 'export', callback: () => {
                        // Lồng VirtualMachineState theo activeMediaSource: Song / Video / Photo — 3 nhánh loại trừ nhau.
                        const mediaSource = appState.get('activeMediaSource');
                        VirtualMachineState.run([
                            { state: mediaSource, operation: '===', value: 'video', callback: () => workflowPlaylist.exportSelectedVideosZip() },
                            { state: mediaSource, operation: '===', value: 'photo', callback: () => workflowPlaylist.exportSelectedImagesZip() },
                            { state: mediaSource, operation: 'notIn', value: ['video', 'photo'], callback: () => workflowPlaylist.exportSelectedSongsZip() },
                        ]);
                    } },
                    { state: action, operation: '===', value: 'addToFolder', callback: () => workflowPlaylist.openAddToFolderPicker() },
                    { state: action, operation: '===', value: 'delete', callback: () => workflowPlaylist.deleteSelectedMedia() },
                    // Chỉ hiện khi đang Scope 1 folder (xem 'playlist.selection.moreMenu.open') — không cần guard lại.
                    { state: action, operation: '===', value: 'removeFromFolder', callback: () => workflowPlaylist.removeSelectedSongsFromFolder() },
                ]);
                break;
            }

            default:
                console.warn(`[router:playlist] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('playlist', routerPlaylist);
