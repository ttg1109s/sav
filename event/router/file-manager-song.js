/**
 * event/router/file-manager-song.js — Router tên "fileManagerSong", tự đăng ký với eventBus lúc
 * nạp. Ver 12 "Multi Media" (plan-v12-multimedia.md mục 3/4.b1).
 *
 * 2 nhánh:
 *   - Folder (MỚI, mục 4.b1) — CRUD folder nhạc.
 *   - Quản lý dung lượng (DỜI NGUYÊN VẸN từ event/router/settings-misc.js — nhánh storageDrawer cũ,
 *     chỉ đổi tiền tố msg.type 'settingsMisc.' -> 'fileManagerSong.', xem bảng đối chiếu cuối file).
 *     event/router/settings-misc.js đã BỎ nhánh này (chỉ còn aboutDrawer + appRecovery).
 *
 * STATE CONTEXT: `lastScanResults` (nhánh quét lỗi) sống Ở ĐÂY — GIỮ NGUYÊN cách router
 * "settingsMisc" cũ làm (closure `let`, không dùng EventStore).
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (showFileManagerSongDrawer/
 * hideFileManagerSongDrawer, CHỐT 03/07/2026 mục 1a/7), core/file-manager/folder.js,
 * core/file-manager/folder-list-ui.js, core/file-manager/folder-picker-ui.js,
 * core/storage-manager.js (cần các hàm core), event/workflow/file-manager-song.js (cần
 * workflowFileManagerSong tồn tại).
 * NẠP TRƯỚC: event/listener/file-manager-song.js.
 */
const routerFileManagerSong = (() => {
    let lastScanResults = []; // context state CỦA RIÊNG nhánh quét lỗi — KHÔNG export ra ngoài

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
                    { state: action, operation: '===', value: 'delete', callback: () => workflowFileManagerSong.deleteFolderById(folderId) },
                ]);
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
