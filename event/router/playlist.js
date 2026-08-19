/**
 * event/router/playlist.js — Router tên "playlist", tự đăng ký với eventBus lúc nạp.
 *
 * PHẠM VI: gộp CẢ 3 file gốc của "module Playlist" (actions.js, loader.js, main.js) vào CÙNG 1
 * router — đúng tinh thần "ranh giới nhóm theo CHỨC NĂNG" của plan.md (không tách theo tên file
 * core cũ). Cả 3 đều thuộc 1 khái niệm chức năng "màn hình Playlist": hành động trên 1 bài (menu
 * 3 chấm, modal lỗi phát/sửa/info), nạp nhạc mới, sắp xếp/kiểu xem/tìm kiếm.
 *
 * QUY TẮC RẼ NHÁNH (giống router/storage.js):
 *   - Nghiệp vụ chỉ cần ĐÚNG 1 HÀM CORE -> router tự gọi thẳng hàm đó, BỎ QUA workflow hoàn toàn.
 *   - Nghiệp vụ cần >1 hàm core (hoặc cần phối hợp shield/modal) -> router giao cho
 *     workflowPlaylist xử lý (chỉ 'playlist.playbackError.delete', 'playlist.editCover.pickFromLibrary',
 *     'playlist.edit.save' rơi vào nhánh này — xem workflow/playlist.js).
 *
 * NGOẠI LỆ ĐÃ CHỐT: handleFilePickerChange()/handleFolderPickerChange() (nạp nhạc mới) GIỮ
 * NGUYÊN là hàm core "lớn" có sẵn withLoadingShield + nhiều alertModal LỒNG SẴN bên trong (giống
 * `workflowPlayer.playMedia()`/window.removeSong) — router gọi THẲNG, KHÔNG tách shield/modal ra
 * workflow riêng. Lý do: logic quá phức tạp (jsmediatags đọc tag, timeout an toàn nhiều lớp, vòng
 * lặp xử lý từng file) để tách an toàn mà không viết lại gần như toàn bộ — rủi ro cao hơn lợi ích.
 *
 * KHÔNG đưa vào /event/ (không phải "lượt bấm người dùng", chỉ là chi tiết triển khai nội bộ của
 * 1 hàm core dùng 1 lần rồi tự gỡ): listener 'error' trên từng <img> cụ thể (attachCoverFallback,
 * render.js) và 2 listener 'loadedmetadata'/'error' trên 1 <audio> tạm (readAudioDuration,
 * loader.js) — không có message nghiệp vụ nào tương ứng, đưa vào sẽ phá vỡ ý nghĩa "router xử
 * lý nghiệp vụ" thành "router xử lý sự kiện DOM thô".
 *
 * STATE CONTEXT: TRƯỚC ĐÂY (mẫu storage) state context sống Ở ROUTER. Ở cụm playlist này, sau khi
 * cân nhắc, đã CHỐT khác đi: 5 field state của các modal (songActionMenuKey, playbackErrorKey,
 * songEditCurrentKey, songEditPendingCover, songEditPendingCoverPreviewUrl — `songInfoCurrentKey`
 * ĐÃ XOÁ cùng #song-info-modal, 10/07/2026, gộp vào tab đầu song-edit-modal)
 * SỐNG TRONG `playlistStore` (event/store.js), được CÁC HÀM CORE trong core/playlist/actions.js trực
 * tiếp đọc/ghi — KHÔNG sống ở đây. Lý do: đây là state "modal nào đang mở, đang hiện bài gì" —
 * gắn chặt với vòng đời UI của modal (mở/đóng/đổi tab/đổi preview), không phải "hồ sơ vụ việc
 * giữa 2 lượt nghiệp vụ" như lastScanResults ở storage. Router playlist do đó KHÔNG giữ state
 * riêng nào của mình — mọi msg.type ở đây chỉ gọi thẳng hoặc giao workflow, không có nhánh
 * if (state...) nào dựa trên context riêng của router.
 *
 * NẠP SAU: event/bus.js, event/store.js (playlistStore đã được new ở core/playlist/actions.js, KHÔNG
 * phải ở file này), core/playlist/actions.js + core/playlist/loader.js + core/playlist/main.js (cần toàn bộ hàm
 * core), event/workflow/playlist.js (cần workflowPlaylist tồn tại), event/workflow/player.js (cần
 * `workflowPlayer.playMedia()` — MỚI, plan-playmedia-reorg.md, thay `window.playSong()` cũ).
 * NẠP TRƯỚC: event/listener/playlist.js.
 */
const routerPlaylist = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== Menu 3 chấm =====================
            case 'playlist.actionOverlay.click': {
                // CHỈ CẦN ĐÚNG 1 HÀM CORE -> gọi THẲNG, BỎ QUA workflow hoàn toàn.
                closeSongActionMenu();
                break;
            }

            // SỬA (v13 Batch F) — 'playlist.actionMenu.select' + core `handleSongActionMenuSelect()`
            // ĐÃ XOÁ HẲN. Hàm core đó vừa tự đọc `playlistStore` (Rule 2) vừa if/else giữa 2 nghiệp
            // vụ khác hẳn nhau — xoá bài / mở modal sửa (Rule 1); comment ở event/listener/playlist.js
            // đã 3 lần né nó thay vì sửa. Mỗi hành động giờ là 1 msg.type + 1 Workflow riêng.
            // Cả 2 đều cần ≥2 lời gọi side-effect nối tiếp (đóng menu + hành động) -> (B) Workflow.
            case 'playlist.actionMenu.delete.click': {
                workflowPlaylist.deleteSongFromActionMenu(msg.payload.songKey);
                break;
            }

            case 'playlist.actionMenu.edit.click': {
                workflowPlaylist.openSongEditFromActionMenu();
                break;
            }

            // MỚI (mục 1d, CHỐT 03/07/2026) — cần ≥2 lời gọi nối tiếp (đọc key + đóng menu + mở
            // picker folder) -> workflow, KHÔNG nhét vào handleSongActionMenuSelect() cũ (đã có
            // sẵn 4 nhánh if/else vi phạm Rule 1 — không mở rộng thêm, tránh phát sinh nghĩa vụ
            // đưa nguyên hàm cũ về đủ 4 rule).
            case 'playlist.actionMenu.addToFolder': {
                workflowPlaylist.openAddToFolderPickerForSongMenu();
                break;
            }

            // ===================== Add to Folder — Generic Drawer grid (MỚI 14/07/2026) =====================
            // SỬA (31/07/2026) — wiring giờ ở core/file-manager/folder-picker-ui.js::
            // wirePlaylistFolderPickerEvents() (Rule 5a), KHÔNG còn ở Workflow. Mỗi case dưới đây
            // vẫn CHỈ 1 hàm core (hoặc cần đọc thêm dữ liệu closure của Workflow như
            // `_folderPickerOnPick`) nên router gọi THẲNG workflow, không cần VirtualMachineState.

            case 'playlist.folderPicker.tile.click': {
                workflowPlaylist.pickFolderInPicker(msg.payload.folderId);
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
                // Ver 12 "Multi Media": rẽ nhánh theo appState KHÁC (selectionMode) -> BẮT BUỘC qua
                // VirtualMachineState. Nhánh selectionMode=true gọi WORKFLOW (không phải core thẳng)
                // vì cần ĐỌC thêm domNodesByKey/selectedSongKeys rồi patch DOM nối tiếp — đúng hình
                // dạng Workflow (event-bus-flow.md mục 4B), xem toggleSongSelectionAndRefresh().
                const selectionMode = appState.get('selectionMode');
                VirtualMachineState.run([
                    { state: selectionMode, operation: '===', value: true, callback: () => workflowPlaylist.toggleSongSelectionAndRefresh(key) },
                    // [SỬA — plan-playmedia-reorg.md] `window.playSong()` -> `workflowPlayer.playMedia()`
                    // (event/workflow/player.js, MỚI) — chỉ đổi tên gọi, hình dạng lời gọi không đổi.
                    { state: selectionMode, operation: '===', value: false, callback: () => workflowPlayer.playMedia(key) },
                ]);
                break;
            }

            // ===================== Modal: Bài hát lỗi lúc phát =====================
            case 'playlist.playbackError.keep': {
                // CHỈ CẦN ĐÚNG 1 HÀM CORE (không shield/modal) -> gọi THẲNG.
                confirmKeepBrokenSong();
                break;
            }

            case 'playlist.playbackError.delete': {
                // CẦN shield + >1 hàm core -> giao workflow.
                workflowPlaylist.executePlaybackErrorDelete();
                break;
            }

            // ===================== Modal: Sửa thông tin (Thông tin + Ảnh bìa) =====================
            case 'playlist.editTab.select': {
                const { tab } = msg.payload;
                setSongEditTab(tab); // CHỈ 1 hàm core thuần UI -> gọi thẳng
                break;
            }

            // MỚI (batch 03/07/2026); VIẾT LẠI (04/07/2026, mục 3 — bỏ hẳn nút Upload/case
            // 'playlist.editCover.change', chỉ còn "Choose photo" mở picker). >1 hàm core nối
            // tiếp (đọc danh sách ảnh + mở picker) -> workflow.
            case 'playlist.editCover.pickFromLibrary': {
                workflowPlaylist.pickCoverFromLibrary();
                break;
            }

            case 'playlist.editCover.remove': {
                // CHỈ CẦN ĐÚNG 1 HÀM CORE (không shield/modal) -> gọi THẲNG.
                removeSongEditCover();
                break;
            }

            case 'playlist.edit.cancel': {
                closeSongEditModal(); // CHỈ 1 hàm core -> gọi thẳng
                break;
            }

            case 'playlist.edit.save': {
                // CẦN shield + đọc state + >1 hàm core + dọn dẹp UI sau cùng -> giao workflow.
                workflowPlaylist.executeSaveEdit();
                break;
            }

            // ===================== "Sửa phụ đề" (menu 3 chấm) — MỚI (10/07/2026) =====================
            // #song-info-modal cũ ĐÃ XOÁ (gộp vào tab đầu song-edit-modal) — 'playlist.info.close'/
            // 'playlist.info.export' KHÔNG còn ý nghĩa gì, xoá luôn 2 case đó.
            // CẦN ≥2 lời gọi nối tiếp (đọc key + đóng menu + mã hoá key + điều hướng trang) ->
            // workflow, CÙNG PRECEDENT với 'playlist.actionMenu.addToFolder' phía trên — KHÔNG
            // nhét vào handleSongActionMenuSelect() cũ (lý do y hệt comment ở case addToFolder).
            case 'playlist.actionMenu.editSubtitles': {
                workflowPlaylist.openSubtitleEditorForSongMenu();
                break;
            }

            // MỚI (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — hành động
            // RIÊNG của Video trong menu 3 chấm, CÙNG PRECEDENT với 'editSubtitles' ngay trên.
            // 'playlist.actionMenu.setAsBgVideo' ĐÃ XOÁ (phản hồi Giang — bỏ hẳn "Set làm nền"
            // khỏi dropdown Video).
            case 'playlist.actionMenu.editVideoFile': {
                workflowPlaylist.navigateToActiveMenuVideoEdit();
                break;
            }

            // MỚI (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — "Xuất file", CÙNG PRECEDENT
            // với 'editSubtitles' ở trên — quyết định "Song hay Video" (tự đọc key + đóng menu)
            // giao HẲN cho workflowPlaylist (Rule 1 chỉ áp cho Core, Workflow không bị ràng buộc).
            case 'playlist.actionMenu.restore': {
                workflowPlaylist.exportActiveMenuItem();
                break;
            }

            // ===================== Nạp nhạc mới (file rời / cả thư mục) =====================
            case 'playlist.upload.fileChange': {
                const { fileList } = msg.payload;
                handleFilePickerChange(fileList); // core "lớn" có sẵn shield/modal bên trong (giống window.playSong) -> gọi thẳng
                break;
            }

            case 'playlist.upload.folderChange': {
                const { fileList } = msg.payload;
                handleFolderPickerChange(fileList); // tương tự — đã có sẵn try/catch + alertModal riêng cho trường hợp thư mục rỗng
                break;
            }

            case 'playlist.uploadMenu.open': {
                // Ver 12 "Multi Media": rẽ nhánh theo appState (selectionMode) -> BẮT BUỘC qua
                // VirtualMachineState. KHÔNG dùng event/block.js ở đây — block.js CHỈ dùng cho
                // "chặn hẳn, không chạy gì cả" (xem comment đầu event/block.js); ở đây cần CHẠY 1
                // thứ khi bị chặn (hiện modal thông báo), nên đúng là việc của switch/if/VMState
                // trong router, không phải block gate.
                // SỬA (FIX 28/07/2026, "bỏ dropdown Video, input luôn", khôi phục 29/07/2026) —
                // BỎ nhánh VMState lồng theo `activeMediaSource` (`openVideoUploadMenu()` — hàm đó
                // đã xoá cùng đợt fix này, KHÔNG còn cần nữa) — #btn-upload-audio giờ CHỈ hiện khi
                // activeMediaSource='song' (đổi ẩn/hiện với #btn-upload-video ở
                // switchToSongSource()/switchToVideoSource(), event/workflow/playlist.js), nên
                // msg.type này CHỈ CÒN bắn ra được từ ngữ cảnh Song — Video giờ có nút RIÊNG
                // (<label id="btn-upload-video">, components/playlist-view.js) mở file picker
                // NATIVE thẳng, không qua eventBus/router nào cả.
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

            // MỚI (ver12 "Song/Video Unification", Batch 6, mục 7) — file(s) video đã chọn xong từ
            // #video-upload-input. Tái dùng NGUYÊN `uploadVideos()` (event/workflow/file-manager-
            // SỬA (phản hồi Giang — dẹp tầng trung gian) — `uploadVideos()`/`_extractVideoThumbAndMeta()`
            // đã DỜI THẲNG vào workflowPlaylist (event/workflow/playlist.js) — file-manager-video.js
            // (workflow/router/listener) đã xoá hẳn, vì cụm này CHỈ được gọi từ đây.
            case 'playlist.upload.videoFileChange': {
                const { fileList } = msg.payload;
                workflowPlaylist.uploadVideos(fileList);
                break;
            }

            // ===================== Sắp xếp / Kiểu xem / Tìm kiếm =====================
            // SỬA (phản hồi Giang, mục 5 "Đồng bộ lại config Playlist Settings") — trước đây gọi
            // THẲNG 1 hàm core (setDisplaySortMode()/setPlaylistViewMode()) — giờ cần thêm bước lưu
            // bền config (`_persistPlaylistConfig()`, async, đụng IndexedDB) NGAY SAU, thành ≥2
            // bước phối hợp -> giao cho workflowPlaylist đúng quy ước đầu file này.
            case 'playlist.sortMode.change': {
                const { mode } = msg.payload;
                workflowPlaylist.changeSortMode(mode);
                break;
            }

            // MỚI (mục 1b/1c, Sort subpanel; SỬA mục 3 — tách field/hướng thành 2 case) — trục (2).
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

            // MỚI (mục 1b, Sort subpanel) — nút mở panel "Sắp xếp" (Settings → Playlist).
            case 'playlist.sortPanel.open.click': {
                workflowPlaylist.openSortPanel();
                break;
            }

            // ===================== Ver 12 "Filter subpanel" (mục 1d) =====================
            case 'playlist.filterPanel.open.click': {
                workflowPlaylist.openFilterPanel();
                break;
            }

            case 'playlist.filterPanel.field.change': {
                const { field, prop, value } = msg.payload;
                workflowPlaylist.setFilterField(field, prop, value);
                break;
            }

            // MỚI (phản hồi Giang — "totalTime/duration dùng time picker modal, h:m:s").
            case 'playlist.filterPanel.openTimePicker.click': {
                const { field, prop } = msg.payload;
                workflowPlaylist.openFilterTimePicker(field, prop);
                break;
            }

            case 'playlist.filterPanel.apply.click': {
                workflowPlaylist.applyFilterChanges();
                break;
            }

            case 'playlist.viewMode.change': {
                const { mode } = msg.payload;
                workflowPlaylist.changeViewMode(mode);
                break;
            }

            // MỚI (ver12 "Song/Video Unification", Batch 1) — đổi Nguồn (Song/Video), select mới ở
            // Settings → Playlist. `source` ('song'|'video') LOẠI TRỪ NHAU, tới từ msg.payload —
            // cùng khuôn VirtualMachineState.run() đơn đích như case 'playlist.selection.moreMenu.
            // select' phía dưới (mutual-exclusive dispatch giữa ≥2 Workflow).
            case 'playlist.mediaSource.change': {
                const { source } = msg.payload;
                VirtualMachineState.run([
                    { state: source, operation: '===', value: 'video', callback: () => workflowPlaylist.switchToVideoSource() },
                    { state: source, operation: '===', value: 'song', callback: () => workflowPlaylist.switchToSongSource() },
                ]);
                break;
            }

            case 'playlist.search.input': {
                const { value } = msg.payload;
                handlePlaylistSearchInput(value); // CHỈ 1 hàm core -> gọi thẳng
                break;
            }

            case 'playlist.search.clear': {
                clearPlaylistSearch(); // CHỈ 1 hàm core -> gọi thẳng
                break;
            }

            // ===================== Ver 12 "Multi Media" — Chọn nhiều (mục 4.b1) =====================
            case 'playlist.selection.toggle': {
                workflowPlaylist.toggleSelectionMode(); // CẦN đọc domNodesByKey + patch DOM nối tiếp sau khi đổi state -> workflow
                break;
            }

            case 'playlist.selection.moreMenu.open': {
                openSelectionMoreMenu(); // CHỈ 1 hàm core thuần UI -> gọi thẳng
                break;
            }

            case 'playlist.selection.moreMenu.close': {
                closeSelectionMoreMenu(); // CHỈ 1 hàm core thuần UI -> gọi thẳng
                break;
            }

            case 'playlist.selection.moreMenu.select': {
                const { action } = msg.payload;
                closeSelectionMoreMenu(); // đóng menu trước khi chạy hành động, giống handleSongActionMenuSelect()
                // 4 giá trị LOẠI TRỪ NHAU (đúng data-menu-action khai báo ở components/playlist-view.js)
                // -> BẮT BUỘC qua VirtualMachineState, không viết switch/if tay.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'play', callback: () => workflowPlaylist.playSelectedSongs() },
                    { state: action, operation: '===', value: 'export', callback: () => {
                        // SỬA (Batch "Export dọn nợ kiến trúc", phản hồi Giang) — LỒNG thêm 1
                        // VirtualMachineState.run() đọc activeMediaSource, CÙNG KHUÔN nested VMState
                        // đã dùng ở 'playlist.uploadMenu.open' — Song GIỮ NGUYÊN
                        // exportSelectedSongsZip() (không đụng), Video dùng exportSelectedVideosZip() MỚI.
                        const mediaSource = appState.get('activeMediaSource');
                        VirtualMachineState.run([
                            { state: mediaSource, operation: '===', value: 'video', callback: () => workflowPlaylist.exportSelectedVideosZip() },
                            { state: mediaSource, operation: 'notIn', value: ['video'], callback: () => workflowPlaylist.exportSelectedSongsZip() },
                        ]);
                    } },
                    { state: action, operation: '===', value: 'addToFolder', callback: () => workflowPlaylist.openAddToFolderPicker() },
                    { state: action, operation: '===', value: 'delete', callback: () => workflowPlaylist.deleteSelectedSongs() },
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
