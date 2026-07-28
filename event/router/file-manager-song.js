/**
 * event/router/file-manager-song.js — Router tên "fileManagerSong", tự đăng ký với eventBus lúc
 * nạp. Panel này giờ tên hiển thị "Song & Video" (ver12 "Song/Video Unification").
 *
 * SỬA (Batch 5, "Song/Video Unification" mục 6e) — TOÀN BỘ case Folder/Folder Detail Drawer ĐÃ XOÁ
 * khỏi router này, chuyển sang router MỚI "fileManagerFolderBrowser" (Generic Drawer List↔Read,
 * xem event/router/file-manager-folder-browser.js).
 *
 * SỬA (Batch 5, mục 6b) — 4 case "download/clear" cũ (2 nút tách rời) THAY bằng 5 case cho 3 field
 * cấu hình độc lập (mediaScope/downloadEnabled/deleteEnabled, đọc CHỐT ở mục 6b: "Router dùng
 * VirtualMachineState.run() đọc cả 3 field, gọi đúng tổ hợp hàm thực thi"). 3 field này sống Ở
 * ĐÂY (đóng closure, cùng khuôn `videoQuickDeleteMode` ở router "fileManagerVideo") — mediaScope là
 * trục QUYẾT ĐỊNH "gọi core nào" (Song/Video là 2 domain hoàn toàn khác hàm) nên bắt buộc qua
 * VirtualMachineState ở case 'storageExecute.confirm'; downloadEnabled/deleteEnabled chỉ là 2 BƯỚC
 * tuần tự bên trong CÙNG 1 tiến trình "thực hiện" (không phải 2 domain khác nhau) nên truyền thẳng
 * làm tham số cho Workflow xử lý bằng if bình thường — xem giải thích đầy đủ ở
 * event/workflow/file-manager-song.js.
 *
 * Router này giờ 3 nhánh:
 *   - Mở panel ('openPanel.click').
 *   - Giải phóng bộ nhớ (3 field cấu hình MỚI, mục 6b).
 *   - Dọn file lỗi (DỜI NGUYÊN VẸN từ event/router/settings-misc.js — nhánh storageDrawer cũ, chỉ
 *     đổi tiền tố msg.type 'settingsMisc.' -> 'fileManagerSong.', xem bảng đối chiếu cuối file).
 *
 * STATE CONTEXT: `lastScanResults` (nhánh quét lỗi) + `storageMediaScope`/`storageDownloadEnabled`/
 * `storageDeleteEnabled` (nhánh giải phóng bộ nhớ, MỚI mục 6b) sống Ở ĐÂY — GIỮ NGUYÊN cách router
 * "settingsMisc" cũ làm (closure `let`, không dùng EventStore).
 *
 * NẠP SAU: event/bus.js, core/storage-manager.js (cần các hàm core), core/settings-panel-
 * stack.js (pushSettingsPanel), event/workflow/file-manager-song.js (cần workflowFileManagerSong
 * tồn tại).
 * NẠP TRƯỚC: event/listener/file-manager-song.js.
 */
const routerFileManagerSong = (() => {
    let lastScanResults = []; // context state CỦA RIÊNG nhánh quét lỗi — KHÔNG export ra ngoài

    // MỚI (Batch 5, mục 6b) — 3 field cấu hình "Giải phóng bộ nhớ", mặc định CẢ 2 toggle TẮT (an
    // toàn — hành động phá huỷ dữ liệu không nên có sẵn "đã chọn xong", buộc người dùng chủ động
    // bật ít nhất 1 toggle trước khi nút Thực hiện khả dụng).
    let storageMediaScope = 'song'; // 'song'|'video'|'both'
    let storageDownloadEnabled = false;
    let storageDeleteEnabled = false;

    function handle(msg) {
        switch (msg.type) {

            // ===================== Mở panel (Batch D5 — đóng dùng CHUNG Back) =====================

            case 'fileManagerSong.openPanel.click': {
                // Mở lại panel luôn RESET về mặc định an toàn — không giữ lại lựa chọn phiên trước
                // (tránh "quên" đã bật sẵn 2 toggle nguy hiểm từ lần mở trước).
                storageMediaScope = 'song'; storageDownloadEnabled = false; storageDeleteEnabled = false;
                workflowFileManagerSong.openPanel(); // >1 hàm core (push + refresh) -> workflow
                break;
            }

            // ===================== Giải phóng bộ nhớ — 3 field độc lập (Batch 5, mục 6b) =========

            case 'fileManagerSong.storageScope.change': {
                storageMediaScope = msg.payload.scope;
                workflowFileManagerSong.updateStorageActionUI(storageMediaScope, storageDownloadEnabled, storageDeleteEnabled);
                break;
            }

            case 'fileManagerSong.storageDownloadToggle.change': {
                storageDownloadEnabled = msg.payload.checked;
                workflowFileManagerSong.updateStorageActionUI(storageMediaScope, storageDownloadEnabled, storageDeleteEnabled);
                break;
            }

            case 'fileManagerSong.storageDeleteToggle.change': {
                storageDeleteEnabled = msg.payload.checked;
                workflowFileManagerSong.updateStorageActionUI(storageMediaScope, storageDownloadEnabled, storageDeleteEnabled);
                break;
            }

            case 'fileManagerSong.storageExecute.click': {
                if (!storageDownloadEnabled && !storageDeleteEnabled) return; // guard: nút lẽ ra đã disabled — phòng vệ thêm
                workflowFileManagerSong.askExecuteStorageAction({
                    mediaScope: storageMediaScope,
                    downloadEnabled: storageDownloadEnabled,
                    deleteEnabled: storageDeleteEnabled,
                    onConfirmSend: () => eventBus.send({ router: 'fileManagerSong', type: 'fileManagerSong.storageExecute.confirm', payload: {} })
                });
                break;
            }

            // mediaScope là trục QUYẾT ĐỊNH "gọi core nào" (Song/Video hoàn toàn khác hàm) — BẮT
            // BUỘC qua VirtualMachineState, đúng CHỐT mục 6b ("Router dùng VMState đọc cả 3 field").
            case 'fileManagerSong.storageExecute.confirm': {
                const scope = storageMediaScope, download = storageDownloadEnabled, del = storageDeleteEnabled;
                // Reset NGAY về mặc định an toàn (trước khi bắt đầu chạy async) — tránh bấm lại
                // "Thực hiện" trong lúc loading shield đang che (vô tình lặp lại thao tác phá huỷ
                // dữ liệu vừa xác nhận). Đọc snapshot ra biến const Ở TRÊN trước khi reset, dùng
                // đúng giá trị lúc bấm xác nhận cho VMState/dispatch bên dưới.
                storageMediaScope = 'song'; storageDownloadEnabled = false; storageDeleteEnabled = false;
                workflowFileManagerSong.updateStorageActionUI(storageMediaScope, storageDownloadEnabled, storageDeleteEnabled);
                VirtualMachineState.run([
                    { state: scope, operation: '===', value: 'song', callback: () => workflowFileManagerSong.executeStorageActionSong(download, del) },
                    { state: scope, operation: '===', value: 'video', callback: () => workflowFileManagerSong.executeStorageActionVideo(download, del) },
                    { state: scope, operation: '===', value: 'both', callback: () => workflowFileManagerSong.executeStorageActionBoth(download, del) },
                ]);
                break;
            }

            // ===================== Dọn file lỗi (nguyên vẹn logic từ router "settingsMisc" cũ) ===

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
 *   settingsMisc.scanBroken.click          -> fileManagerSong.scanBroken.click
 *   settingsMisc.dismissScan.click         -> fileManagerSong.dismissScan.click
 *
 * SỬA (Batch 5, mục 6b) — 'downloadThenClear.click/.confirm'/'clearNoDownload.click/.confirm' (2
 * nút tách rời) ĐÃ XOÁ, thay bằng 'storageScope.change'/'storageDownloadToggle.change'/
 * 'storageDeleteToggle.change'/'storageExecute.click'/'storageExecute.confirm' (3 field cấu hình
 * độc lập, xem docstring đầu file).
 */
