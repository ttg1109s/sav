/**
 * event/router/file-manager-storage.js — Router tên "fileManagerStorage", tự đăng ký với eventBus
 * lúc nạp. MỚI (29/07/2026, yêu cầu Giang) — THAY HẲN event/router/file-manager-song.js đã xoá.
 *
 * STATE CONTEXT (đóng closure, KHÔNG dùng EventStore — cùng cách router "settingsMisc"/
 * "fileManagerSong" cũ làm):
 *   - `lastScanResults` — nhánh quét lỗi.
 *   - `storageSources = {song,video,photo,document}` (MỚI — THAY `storageMediaScope` enum
 *     'song'|'video'|'both' cũ) — 4 toggle ĐỘC LẬP, không loại trừ nhau.
 *   - `storageDownloadEnabled`/`storageDeleteEnabled` — 2 toggle hành động, GIỮ NGUYÊN ý nghĩa cũ.
 *
 * KHÁC BIỆT KIẾN TRÚC quan trọng so với router cũ — case 'storageExecute.confirm' KHÔNG còn dùng
 * `VirtualMachineState.run()` để chọn "gọi core nào": trước đây `mediaScope` là 1 ENUM 3 giá trị
 * loại trừ nhau ('song'|'video'|'both'), khớp hoàn hảo mẫu VMState (so khớp 1 giá trị -> chọn
 * callback). Giờ 4 nguồn là tổ hợp BOOLEAN ĐỘC LẬP (2^4 = 16 khả năng, KHÔNG phải 1 giá trị enum
 * hữu hạn để "so khớp") — Router gọi THẲNG 1 method DUY NHẤT
 * (`workflowFileManagerStorage.executeStorageAction(sources, download, del)`), method đó tự LẶP
 * qua từng nguồn đang bật bên trong (xem docstring đầu event/workflow/file-manager-storage.js) —
 * đây là case (A)/(B) bình thường theo event-bus-flow.md mục 4 (Router chuyển tiếp cho Workflow xử
 * lý ≥2 bước nối tiếp), KHÔNG phải case (C) (Router tự đọc state KHÁC để chọn đích).
 *
 * NẠP SAU: event/bus.js, core/storage-manager.js, core/settings-panel-stack.js, event/workflow/
 * file-manager-storage.js.
 * NẠP TRƯỚC: event/listener/file-manager-storage.js.
 *
 * MỚI (29/07/2026, yêu cầu Giang — "Scan khi không bật nguồn nào thì bị block") —
 * `fileManagerStorage.scanBroken.click` giờ có Block gate đăng ký ở event/block.js (chặn HẲN +
 * notify khi cả 4 nguồn đều tắt) — ĐÚNG tiêu chí dùng Block (chặn hẳn, không chọn giữa nhiều
 * workflow khác nhau). Block gate CHỈ đọc được `appState`, KHÔNG đọc được closure `storageSources`
 * của router này — nên router tự gương (mirror) 1 field dẫn xuất `appState.storageAnySourceEnabled`
 * (service/state/file-manager.js) mỗi khi `storageSources` đổi, xem `syncAnySourceEnabledToAppState()`.
 */
const routerFileManagerStorage = (() => {
    let lastScanResults = []; // context state CỦA RIÊNG nhánh quét lỗi

    // Mặc định CẢ 4 nguồn TẮT + CẢ 2 toggle hành động TẮT (an toàn — hành động phá huỷ dữ liệu
    // không nên có sẵn "đã chọn xong", buộc người dùng chủ động bật trước khi nút Thực hiện khả dụng).
    let storageSources = { song: false, video: false, photo: false, document: false };
    let storageDownloadEnabled = false;
    let storageDeleteEnabled = false;

    /** MỚI (29/07/2026, yêu cầu Giang — "Scan khi không bật nguồn nào thì bị block") — gương lại
     * "có ít nhất 1/4 nguồn đang bật" từ `storageSources` (closure RIÊNG của router này) lên
     * `appState.storageAnySourceEnabled` — CHỈ field NÀY cần lên appState, vì Block gate
     * (event/block.js -> event/bus.js::resolveFieldPath()) BẮT BUỘC đọc điều kiện qua appState,
     * không đọc được closure của router. Gọi lại SAU MỖI lần `storageSources` đổi (sourceToggle,
     * reset lúc mở panel, reset sau khi Thực hiện xong). */
    function syncAnySourceEnabledToAppState() {
        appState.set('storageAnySourceEnabled', storageSources.song || storageSources.video || storageSources.photo || storageSources.document);
    }

    function handle(msg) {
        switch (msg.type) {

            // ===================== Mở panel =====================

            case 'fileManagerStorage.openPanel.click': {
                // Mở lại panel luôn RESET về mặc định an toàn — không giữ lựa chọn phiên trước.
                storageSources = { song: false, video: false, photo: false, document: false };
                storageDownloadEnabled = false; storageDeleteEnabled = false;
                lastScanResults = [];
                syncAnySourceEnabledToAppState();
                workflowFileManagerStorage.openPanel(); // >1 hàm core (push + refresh) -> workflow
                break;
            }

            // ===================== Chọn mục xoá — 4 nguồn độc lập + 2 toggle hành động =========

            case 'fileManagerStorage.sourceToggle.change': {
                const { source, checked } = msg.payload; // source: 'song'|'video'|'photo'|'document'
                if (source in storageSources) storageSources[source] = checked;
                syncAnySourceEnabledToAppState();
                workflowFileManagerStorage.updateStorageActionUI(storageSources, storageDownloadEnabled, storageDeleteEnabled);
                break;
            }

            case 'fileManagerStorage.storageDownloadToggle.change': {
                storageDownloadEnabled = msg.payload.checked;
                workflowFileManagerStorage.updateStorageActionUI(storageSources, storageDownloadEnabled, storageDeleteEnabled);
                break;
            }

            case 'fileManagerStorage.storageDeleteToggle.change': {
                storageDeleteEnabled = msg.payload.checked;
                workflowFileManagerStorage.updateStorageActionUI(storageSources, storageDownloadEnabled, storageDeleteEnabled);
                break;
            }

            case 'fileManagerStorage.storageExecute.click': {
                if (!storageDownloadEnabled && !storageDeleteEnabled) return; // guard: nút lẽ ra đã disabled
                workflowFileManagerStorage.askExecuteStorageAction({
                    sources: storageSources,
                    downloadEnabled: storageDownloadEnabled,
                    deleteEnabled: storageDeleteEnabled,
                    onConfirmSend: () => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageExecute.confirm', payload: {} })
                });
                break;
            }

            case 'fileManagerStorage.storageExecute.confirm': {
                const sources = storageSources, download = storageDownloadEnabled, del = storageDeleteEnabled;
                // Reset NGAY về mặc định an toàn (trước khi bắt đầu chạy async) — tránh bấm lại
                // "Thực hiện" trong lúc loading shield đang che. Đọc snapshot ra biến const Ở TRÊN
                // trước khi reset, dùng đúng giá trị lúc bấm xác nhận cho lời gọi bên dưới.
                storageSources = { song: false, video: false, photo: false, document: false };
                storageDownloadEnabled = false; storageDeleteEnabled = false;
                syncAnySourceEnabledToAppState();
                workflowFileManagerStorage.updateStorageActionUI(storageSources, storageDownloadEnabled, storageDeleteEnabled);
                // Gọi THẲNG 1 method (KHÔNG VirtualMachineState) — xem giải thích đầy đủ ở docstring đầu file.
                workflowFileManagerStorage.executeStorageAction(sources, download, del);
                break;
            }

            // ===================== Dọn file lỗi =====================

            case 'fileManagerStorage.deleteBroken.click': {
                if (lastScanResults.length === 0) return;
                workflowFileManagerStorage.askDeleteBroken({
                    scanResults: lastScanResults,
                    onConfirmSend: () => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.deleteBroken.confirm', payload: {} })
                });
                break;
            }

            case 'fileManagerStorage.deleteBroken.confirm': {
                if (lastScanResults.length === 0) return;
                workflowFileManagerStorage.executeDeleteBroken({
                    scanResults: lastScanResults,
                    currentKey: appState.get('currentKey')
                });
                lastScanResults = [];
                break;
            }

            // MỚI (29/07/2026, yêu cầu Giang) — Block gate (event/block.js) đã chặn CASE NÀY THẲNG
            // TỪ eventBus.send() nếu KHÔNG có nguồn nào đang bật (`storageAnySourceEnabled===false`)
            // — tự bật alertModal() báo lý do, xem event/block.js — case bên dưới CHỈ còn chạy tới
            // khi ĐÃ chắc chắn có ít nhất 1 nguồn được chọn, không cần guard lại lần nữa ở đây.
            case 'fileManagerStorage.scanBroken.click': {
                // Quét ĐÚNG các nguồn đang bật ở "Chọn mục xoá" — DÙNG CHUNG storageSources, KHÔNG
                // rẽ nhánh tại đây (nhánh thật nằm trong Workflow, xem executeScanBroken()).
                workflowFileManagerStorage.executeScanBroken({
                    sources: storageSources,
                    onScanComplete: (results) => { lastScanResults = results; }
                });
                break;
            }

            case 'fileManagerStorage.dismissScan.click': {
                workflowFileManagerStorage.dismissScan();
                lastScanResults = [];
                break;
            }

            default:
                console.warn(`[router:fileManagerStorage] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerStorage', routerFileManagerStorage);
