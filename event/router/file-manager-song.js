/**
 * event/router/file-manager-song.js — Router tên "fileManagerSong", tự đăng ký với eventBus lúc
 * nạp. Ver 12 "Multi Media" (plan-v12-multimedia.md mục 3/4.b1).
 *
 * 3 nhánh:
 *   - Folder (MỚI, mục 4.b1) — CRUD folder nhạc.
 *   - Folder Detail Drawer (Phase 2, MỚI mục 1b/c/e, CHỐT 03/07/2026) — xem/gỡ bài trong 1 folder,
 *     "Áp dụng cho Playlist" (scoping thật), xoá folder đang là scope hiện tại.
 *   - Quản lý dung lượng (DỜI NGUYÊN VẸN từ event/router/settings-misc.js — nhánh storageDrawer cũ,
 *     chỉ đổi tiền tố msg.type 'settingsMisc.' -> 'fileManagerSong.', xem bảng đối chiếu cuối file).
 *     event/router/settings-misc.js đã BỎ nhánh này (chỉ còn aboutDrawer + appRecovery).
 *
 * STATE CONTEXT: `lastScanResults` (nhánh quét lỗi) + `currentFolderDetailId` (Phase 2, folder
 * đang mở trong Folder Detail Drawer) sống Ở ĐÂY — GIỮ NGUYÊN cách router "settingsMisc" cũ làm
 * (closure `let`, không dùng EventStore).
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (showFileManagerSongDrawer/
 * hideFileManagerSongDrawer/showFileManagerFolderDetailDrawer/hideFileManagerFolderDetailDrawer,
 * CHỐT 03/07/2026 mục 1a/7), core/file-manager/folder.js, core/file-manager/folder-list-ui.js,
 * core/file-manager/folder-detail-ui.js, core/file-manager/folder-picker-ui.js,
 * core/playlist/scope.js, event/workflow/playlist-scope.js (workflowPlaylistScope),
 * core/storage-manager.js (cần các hàm core), event/workflow/file-manager-song.js (cần
 * workflowFileManagerSong tồn tại).
 * NẠP TRƯỚC: event/listener/file-manager-song.js.
 */
const routerFileManagerSong = (() => {
    let lastScanResults = []; // context state CỦA RIÊNG nhánh quét lỗi — KHÔNG export ra ngoài
    let currentFolderDetailId = null; // Phase 2, MỚI — folder đang mở trong Folder Detail Drawer

    function handle(msg) {
        switch (msg.type) {

            // ===================== Mở/đóng drawer (CHỐT 03/07/2026, mục 1a/7) =====================

            case 'fileManagerSong.open': {
                workflowFileManagerSong.openDrawer(); // >1 hàm core (patch DOM + refresh) -> workflow
                break;
            }

            case 'fileManagerSong.close': {
                hideFileManagerSongDrawer(); // CHỈ 1 hàm core (patch DOM thuần) -> gọi thẳng
                break;
            }

            // ===================== Folder (mục 4.b1) =====================

            case 'fileManagerSong.folder.create': {
                workflowFileManagerSong.createFolderFromInput(); // CẦN đọc input + I/O + vẽ lại -> workflow
                break;
            }

            case 'fileManagerSong.folder.actionClick': {
                const { action, folderId } = msg.payload;
                // 2 giá trị LOẠI TRỪ NHAU (đúng data-folder-action ở core/file-manager/folder-list-ui.js)
                // -> BẮT BUỘC qua VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'rename', callback: () => workflowFileManagerSong.renameFolderById(folderId) },
                    // Phase 2, MỚI (mục 1e, CHỐT 03/07/2026): nhánh 'delete' cần biết folder sắp
                    // xoá có ĐANG là activePlayListFolder hay không — đọc appState KHÁC -> LỒNG
                    // thêm 1 VirtualMachineState nữa NGAY TRONG callback này (callback là code
                    // Router bình thường, được phép chứa VMState tiếp — xem event-bus-flow.md
                    // mục 5: "callback là 1 arrow function router tự viết").
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        const isActiveFolder = folderId === appState.get('activePlayListFolder');
                        VirtualMachineState.run([
                            { state: isActiveFolder, operation: '===', value: true, callback: () => workflowFileManagerSong.deleteActiveFolderById(folderId) },
                            { state: isActiveFolder, operation: '===', value: false, callback: () => workflowFileManagerSong.deleteFolderById(folderId) },
                        ]);
                    } },
                ]);
                break;
            }

            // ===================== Folder Detail Drawer (Phase 2, MỚI — mục 1b/c, CHỐT 03/07/2026) =====================

            case 'fileManagerSong.folder.openDetail': {
                const { folderId } = msg.payload;
                currentFolderDetailId = folderId; // context CỦA RIÊNG nhánh này — cùng pattern lastScanResults
                workflowFileManagerSong.openFolderDetail(folderId); // >1 hàm core nối tiếp -> workflow
                break;
            }

            case 'fileManagerSong.folder.closeDetail': {
                hideFileManagerFolderDetailDrawer(); // CHỈ 1 hàm core (patch DOM thuần) -> gọi thẳng
                currentFolderDetailId = null;
                break;
            }

            case 'fileManagerSong.folder.removeSong': {
                if (!currentFolderDetailId) return; // guard: không có context nào đang mở (không nên xảy ra)
                const { songKey } = msg.payload;
                workflowFileManagerSong.removeSongFromFolderById(currentFolderDetailId, songKey); // >1 hàm core -> workflow
                break;
            }

            case 'fileManagerSong.folder.applyToPlaylist.click': {
                if (!currentFolderDetailId) return; // guard: nút chỉ hiện trong drawer đã mở 1 folder cụ thể
                workflowFileManagerSong.applyFolderToPlaylist(currentFolderDetailId); // >1 hàm core -> workflow
                break;
            }

            // ===================== Quản lý dung lượng (nguyên vẹn logic từ router "settingsMisc" cũ) =====================

            case 'fileManagerSong.deleteBroken.click': {
                if (lastScanResults.length === 0) return;
                workflowFileManagerSong.askDeleteBroken({
                    scanResults: lastScanResults,
                    onConfirmSend: () => eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.deleteBroken.confirm', payload: {} })
                });
                break;
            }

            case 'fileManagerSong.deleteBroken.confirm': {
                if (lastScanResults.length === 0) return;
                workflowFileManagerSong.executeDeleteBroken({
                    scanResults: lastScanResults,
                    currentKey: appState.get('currentKey')
                });
                break;
            }

            case 'fileManagerSong.downloadThenClear.click': {
                workflowFileManagerSong.askDownloadThenClear({
                    onConfirmSend: () => eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.downloadThenClear.confirm', payload: {} })
                });
                break;
            }

            case 'fileManagerSong.downloadThenClear.confirm': {
                workflowFileManagerSong.executeDownloadThenClear();
                break;
            }

            case 'fileManagerSong.clearNoDownload.click': {
                workflowFileManagerSong.askClearNoDownload({
                    onConfirmSend: () => eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.clearNoDownload.confirm', payload: {} })
                });
                break;
            }

            case 'fileManagerSong.clearNoDownload.confirm': {
                workflowFileManagerSong.executeClearNoDownload();
                break;
            }

            case 'fileManagerSong.scanBroken.click': {
                workflowFileManagerSong.executeScanBroken({
                    onScanComplete: (results) => { lastScanResults = results; }
                });
                break;
            }

            case 'fileManagerSong.dismissScan.click': {
                resetScanResultUI(); // CHỈ 1 hàm core -> gọi thẳng
                lastScanResults = [];
                break;
            }

            default:
                console.warn(`[router:fileManagerSong] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerSong', routerFileManagerSong);

/**
 * Bảng đối chiếu msg.type CŨ (router "settingsMisc", nhánh storageDrawer, ĐÃ BỎ) -> MỚI (router
 * "fileManagerSong") — chỉ đổi tiền tố, ý nghĩa nghiệp vụ giữ y nguyên:
 *   settingsMisc.storageDrawer.open        -> fileManagerSong.open (CHỐT 03/07/2026, mục 1a/7 —
 *                                              Song giờ là drawer con độc lập, tự mở + tự refresh,
 *                                              không còn màn "File Manager" cha điều phối)
 *   settingsMisc.deleteBroken.click/.confirm      -> fileManagerSong.deleteBroken.click/.confirm
 *   settingsMisc.downloadThenClear.click/.confirm -> fileManagerSong.downloadThenClear.click/.confirm
 *   settingsMisc.clearNoDownload.click/.confirm   -> fileManagerSong.clearNoDownload.click/.confirm
 *   settingsMisc.scanBroken.click          -> fileManagerSong.scanBroken.click
 *   settingsMisc.dismissScan.click         -> fileManagerSong.dismissScan.click
 */
