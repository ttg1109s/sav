/**
 * event/router/file-manager-storage.js — Router tên "fileManagerStorage", tự đăng ký với eventBus
 * lúc nạp. MỚI (29/07/2026, yêu cầu Giang) — THAY HẲN event/router/file-manager-song.js đã xoá.
 *
 * STATE CONTEXT (đóng closure, KHÔNG dùng EventStore — cùng cách router "settingsMisc"/
 * "fileManagerSong" cũ làm):
 *   - `lastScanResults` — nhánh quét lỗi.
 *   - `storageSources = {song,video,photo,document}` (MỚI — THAY `storageMediaScope` enum
 *     'song'|'video'|'both' cũ) — 4 toggle ĐỘC LẬP, không loại trừ nhau. CHỈ dùng cho section
 *     "Delete & Backup" (tải xuống/xoá) — KHÔNG còn dùng chung cho nhánh quét lỗi nữa (xem mục
 *     "Dọn file lỗi" ngay dưới).
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
 * SỬA (29/07/2026, yêu cầu Giang — "Scan Broken File: thay vì dùng toggle của Delete & Backup ->
 * mở modal choice có dropdown chọn loại scan") — nhánh "Dọn file lỗi" giờ TÁCH HẲN khỏi
 * `storageSources` ở trên: bấm nút Quét mở `askScanBrokenScope()` (modalChoice() + `<select>` nhúng
 * trong modal, event/workflow/file-manager-storage.js) hỏi phạm vi RIÊNG (Tất cả/Song/Video/Photo/
 * Document), Huỷ hoặc Thực hiện NGAY TRONG modal đó — KHÔNG còn phụ thuộc trạng thái 4 toggle ở
 * "Delete & Backup" nữa (dễ nhầm/quên đang bật gì ở đó trước khi quét). ĐỒNG THỜI bỏ hẳn Block gate
 * + field `appState.storageAnySourceEnabled` từng đăng ký riêng cho tình huống "quét khi chưa chọn
 * nguồn nào" (đợt trước) — tình huống đó KHÔNG CÒN THỂ XẢY RA nữa vì `<select>` LUÔN có 1 giá trị
 * được chọn (mặc định "Tất cả"), không có khái niệm "rỗng" như 4 checkbox độc lập từng có.
 *
 * NẠP SAU: event/bus.js, core/storage-manager.js, core/settings-panel-stack.js, event/workflow/
 * file-manager-storage.js.
 * NẠP TRƯỚC: event/listener/file-manager-storage.js.
 */
const routerFileManagerStorage = (() => {
    let lastScanResults = []; // context state CỦA RIÊNG nhánh quét lỗi

    // Mặc định CẢ 4 nguồn TẮT + CẢ 2 toggle hành động TẮT (an toàn — hành động phá huỷ dữ liệu
    // không nên có sẵn "đã chọn xong", buộc người dùng chủ động bật trước khi nút Thực hiện khả dụng).
    let storageSources = { song: false, video: false, photo: false, document: false };
    let storageDownloadEnabled = false;
    let storageDeleteEnabled = false;

    function handle(msg) {
        switch (msg.type) {

            // ===================== Mở panel =====================

            case 'fileManagerStorage.openPanel.click': {
                // Mở lại panel luôn RESET về mặc định an toàn — không giữ lựa chọn phiên trước.
                storageSources = { song: false, video: false, photo: false, document: false };
                storageDownloadEnabled = false; storageDeleteEnabled = false;
                lastScanResults = [];
                workflowFileManagerStorage.openPanel(); // >1 hàm core (push + refresh) -> workflow
                break;
            }

            // MỚI (đợt tái cấu trúc bottom nav App Panel) — Storage giờ dùng Generic Drawer
            // (openGenericDrawer/closeFully), KHÔNG còn Back button dùng chung của settings-panel-
            // stack — nút X riêng (dựng động lúc openPanel(), wire trực tiếp trong workflow đó,
            // Rule 5a) bắn message này để đóng.
            case 'fileManagerStorage.closePanel.click': {
                workflowFileManagerStorage.closePanel();
                break;
            }

            // MỚI (29/07/2026, yêu cầu Giang mục 2) — ấn vào 1 đoạn thanh dung lượng -> hiện số
            // byte thật của ĐÚNG đoạn đó (alertModal, xem showSegmentBytes()) — hành động THUẦN
            // đọc, không đụng state gì của router này.
            case 'fileManagerStorage.storageBarSegment.click': {
                workflowFileManagerStorage.showSegmentBytes(msg.payload);
                break;
            }

            // ===================== Delete & Backup — 4 nguồn độc lập + 2 toggle hành động =====

            case 'fileManagerStorage.sourceToggle.change': {
                const { source, checked } = msg.payload; // source: 'song'|'video'|'photo'|'document'
                if (source in storageSources) storageSources[source] = checked;
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
                workflowFileManagerStorage.updateStorageActionUI(storageSources, storageDownloadEnabled, storageDeleteEnabled);
                // Gọi THẲNG 1 method (KHÔNG VirtualMachineState) — xem giải thích đầy đủ ở docstring đầu file.
                workflowFileManagerStorage.executeStorageAction(sources, download, del);
                break;
            }

            // ===================== Dọn file lỗi — tự hỏi phạm vi qua modal riêng =====================

            case 'fileManagerStorage.scanBroken.click': {
                // SỬA (29/07/2026) — KHÔNG còn đọc storageSources ở đây nữa — mở modal hỏi phạm vi
                // RIÊNG (Huỷ/Thực hiện nằm ngay trong modal đó, xem askScanBrokenScope()).
                workflowFileManagerStorage.askScanBrokenScope({
                    onConfirmSend: (scope) => eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.scanBroken.confirm', payload: { scope } })
                });
                break;
            }

            case 'fileManagerStorage.scanBroken.confirm': {
                // MỚI — quy đổi lựa chọn dropdown ('all'|'song'|'video'|'photo'|'document') thành
                // đúng shape `sources` mà executeScanBroken() cần (hàm đó GIỮ NGUYÊN, không quan
                // tâm sources tới từ đâu).
                const sources = workflowFileManagerStorage._scopeToSources(msg.payload.scope);
                workflowFileManagerStorage.executeScanBroken({
                    sources,
                    onScanComplete: (results) => { lastScanResults = results; }
                });
                break;
            }

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
