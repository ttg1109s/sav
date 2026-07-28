/**
 * event/router/file-manager-song.js — Router tên "fileManagerSong", tự đăng ký với eventBus lúc
 * nạp. Panel này giờ tên hiển thị "Song & Video" (ver12 "Song/Video Unification").
 *
 * SỬA (Batch 5, "Song/Video Unification" mục 6e) — TOÀN BỘ case Folder/Folder Detail Drawer ĐÃ XOÁ
 * khỏi router này, chuyển sang router MỚI "fileManagerFolderBrowser" (Generic Drawer List↔Read,
 * xem event/router/file-manager-folder-browser.js) — router này giờ CHỈ còn 2 nhánh:
 *   - Mở panel ('openPanel.click').
 *   - Quản lý dung lượng (DỜI NGUYÊN VẸN từ event/router/settings-misc.js — nhánh storageDrawer cũ,
 *     chỉ đổi tiền tố msg.type 'settingsMisc.' -> 'fileManagerSong.', xem bảng đối chiếu cuối file).
 *
 * STATE CONTEXT: `lastScanResults` (nhánh quét lỗi) sống Ở ĐÂY — GIỮ NGUYÊN cách router
 * "settingsMisc" cũ làm (closure `let`, không dùng EventStore).
 *
 * NẠP SAU: event/bus.js, core/storage-manager.js (cần các hàm core), core/settings-panel-
 * stack.js (pushSettingsPanel), event/workflow/file-manager-song.js (cần workflowFileManagerSong
 * tồn tại).
 * NẠP TRƯỚC: event/listener/file-manager-song.js.
 */
const routerFileManagerSong = (() => {
    let lastScanResults = []; // context state CỦA RIÊNG nhánh quét lỗi — KHÔNG export ra ngoài

    function handle(msg) {
        switch (msg.type) {

            // ===================== Mở panel (Batch D5 — đóng dùng CHUNG Back) =====================

            case 'fileManagerSong.openPanel.click': {
                workflowFileManagerSong.openPanel(); // >1 hàm core (push + refresh) -> workflow
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
                workflowFileManagerSong.dismissScan(); // Batch D5: CẦN querySelector bên trong panel -> workflow
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
 *   settingsMisc.storageDrawer.open        -> fileManagerSong.openPanel.click (CHỐT 03/07/2026,
 *                                              mục 1a/7; Batch D5 06/07/2026 — đổi tiếp 'open'
 *                                              thành 'openPanel.click', push động)
 *   settingsMisc.deleteBroken.click/.confirm      -> fileManagerSong.deleteBroken.click/.confirm
 *   settingsMisc.downloadThenClear.click/.confirm -> fileManagerSong.downloadThenClear.click/.confirm
 *   settingsMisc.clearNoDownload.click/.confirm   -> fileManagerSong.clearNoDownload.click/.confirm
 *   settingsMisc.scanBroken.click          -> fileManagerSong.scanBroken.click
 *   settingsMisc.dismissScan.click         -> fileManagerSong.dismissScan.click
 */
