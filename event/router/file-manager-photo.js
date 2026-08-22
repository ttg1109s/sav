/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. Panel Photo (quản lý thư viện ảnh).
 *
 * XOÁ (loại bỏ Album khỏi Photo Panel) — toàn bộ case liên quan Album (Album List sub-panel,
 * add-to-album picker, chip lọc, `activeAlbumId` context) bỏ hẳn cùng tính năng — lưới ảnh LUÔN
 * hiện toàn bộ, không còn khái niệm "đang lọc theo 1 album". Sẽ thay bằng Folder Photo trong File
 * Browser ở đợt riêng (pending).
 *
 * STATE CONTEXT còn lại: `imageQuickDeleteMode` (chế độ xoá nhanh), `quickDeleteSelectedKeys` (Set
 * closure — bấm ảnh chỉ TOGGLE vào/ra Set này, patch DOM, không refresh/không DB). Nút xoá nhanh ở
 * header dùng `VirtualMachineState.run()` 3 nhánh LOẠI TRỪ NHAU — tránh gọi `deleteImage()`/
 * `refresh()` lãng phí khi Set rỗng. 2 chế độ khi bấm 1 ảnh trong lưới (imageQuickDeleteMode/bình
 * thường) LOẠI TRỪ NHAU.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto),
 * core/settings-panel-stack-ui.js (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    let imageQuickDeleteMode = false; // true = đang ở chế độ xoá nhanh (KHÔNG tự xoá ngay lúc bấm ảnh — xem quickDeleteSelectedKeys)
    let quickDeleteSelectedKeys = new Set(); // ảnh đã đánh dấu chờ xoá trong lưới chính

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.openPanel.click': {
                imageQuickDeleteMode = false;
                quickDeleteSelectedKeys = new Set();
                workflowFileManagerPhoto.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
                break;
            }

            // ===================== Ảnh (lưới chính) =====================

            case 'fileManagerPhoto.image.click': {
                const { imageKey } = msg.payload;
                VirtualMachineState.run([
                    { state: imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.toggleQuickDeleteMarkInSet(imageKey, quickDeleteSelectedKeys); // mutate Set qua tham chiếu + patch DOM surgical, KHÔNG xoá/KHÔNG refresh
                    } },
                    { state: !imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.openImagePreview(imageKey); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== Chế độ xoá nhanh =====================
            // VirtualMachineState 3 nhánh LOẠI TRỪ NHAU (Giang chỉ ra "tránh lãng phí khi không xoá
            // gì" — SỬA thêm sau: "tại sao phải có refresh?" — nhánh 1/2 KHÔNG đổi dữ liệu ảnh, chỉ
            // đổi UI):
            //   1. Chưa bật mode -> hỏi xác nhận, bật mode + Set rỗng -> CHỈ đổi UI nút/badge
            //      (updateQuickDeleteModeUI()), KHÔNG đọc lại DB/KHÔNG dựng lại lưới.
            //   2. Đang bật, CHƯA đánh dấu ảnh nào -> tắt mode NGAY -> CŨNG chỉ đổi UI, cùng lý do
            //      trên — KHÔNG gọi deleteImage() nào, KHÔNG refresh() nào.
            //   3. Đang bật, ĐÃ đánh dấu ≥1 ảnh -> hỏi xác nhận kèm số lượng -> xoá batch 1 lần —
            //      NHÁNH DUY NHẤT còn refresh() thật (bên trong confirmQuickDeleteBatch()), vì ảnh
            //      THẬT SỰ bị xoá khỏi DB, lưới bắt buộc phải đọc lại/dựng lại.

            case 'fileManagerPhoto.image.deleteMode.click': {
                VirtualMachineState.run([
                    { state: !imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.promptQuickDeleteMode(() => { // >1 hàm core (modal + cập nhật UI) -> workflow
                            imageQuickDeleteMode = true;
                            quickDeleteSelectedKeys = new Set();
                            // SỬA (Giang chỉ ra "tại sao phải có refresh?") — bật mode KHÔNG cần đọc
                            // lại DB/dựng lại lưới, dữ liệu ảnh không đổi — chỉ đổi màu nút + bật
                            // badge trên tile đang hiển thị.
                            workflowFileManagerPhoto.updateQuickDeleteModeUI(imageQuickDeleteMode, quickDeleteSelectedKeys);
                        });
                    } },
                    { state: (imageQuickDeleteMode && quickDeleteSelectedKeys.size === 0), operation: '===', value: true, callback: () => {
                        imageQuickDeleteMode = false;
                        // SỬA (Giang chỉ ra "tại sao phải có refresh?") — tắt mode (chưa đánh dấu gì)
                        // CŨNG không cần đọc lại DB/dựng lại lưới — cùng lý do nhánh trên.
                        workflowFileManagerPhoto.updateQuickDeleteModeUI(imageQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    { state: (imageQuickDeleteMode && quickDeleteSelectedKeys.size > 0), operation: '===', value: true, callback: () => {
                        // onConfirmed: Router KHÔNG tự đặt imageQuickDeleteMode=false NGAY ở đây —
                        // modalChoice() còn đang MỞ, user có thể Huỷ (khi đó mode PHẢI vẫn đang bật,
                        // UI vẫn đang hiện badge đỏ đúng thực tế) — Workflow tự gọi callback này ĐÚNG
                        // lúc xoá xong thật (bên trong onClick nút xác nhận), Router lúc đó mới đồng
                        // bộ biến của mình. NHÁNH NÀY VẪN GỌI refresh() THẬT (bên trong
                        // confirmQuickDeleteBatch()) — ảnh THẬT SỰ bị xoá khỏi DB, lưới bắt buộc phải
                        // đọc lại/dựng lại, khác 2 nhánh trên (chỉ đổi UI, không đổi dữ liệu).
                        workflowFileManagerPhoto.confirmQuickDeleteBatch(quickDeleteSelectedKeys, () => { imageQuickDeleteMode = false; }); // >1 hàm core (modal + shield + deleteImage*N + refresh) -> workflow
                    } },
                ]);
                break;
            }

            // ===================== Upload =====================

            case 'fileManagerPhoto.uploadTrigger.click': {
                workflowFileManagerPhoto.triggerUploadInput();
                break;
            }

            case 'fileManagerPhoto.upload.change': {
                const { files } = msg.payload;
                workflowFileManagerPhoto.uploadImages(files); // >1 hàm core -> workflow
                break;
            }

            // Đích dispatch của dropdown (openImageActionMenu()).
            // SỬA (31/07/2026, Giang chỉ ra "đừng viện dẫn workflow xuyên miền để biện minh giữ
            // routing sai chỗ") — "Lưu đè"/"Lưu mới" ĐÃ CHUYỂN hẳn sang router `imageEdit` (msg.type
            // riêng, xem event/router/image-edit.js) — case này giờ CHỈ còn 2 action là trách nhiệm
            // THẬT của miền Photo (setPlaylistBg/delete).
            case 'fileManagerPhoto.imageMenu.setPlaylistBg.click': {
                workflowFileManagerPhoto.setAsPlaylistBackground(msg.payload.imageKey);
                break;
            }

            case 'fileManagerPhoto.imageMenu.delete.click': {
                deleteImage(msg.payload.imageKey).then(() => workflowFileManagerPhoto.refresh()); // core/file-manager/image.js
                break;
            }

            // Nút X modal xem ảnh — Block gate (event/block.js) chặn HẲN msg.type này khi
            // imagePreviewMode !== 'view' (đang Zoom/Edit), tự hiện notify.
            case 'fileManagerPhoto.imagePreview.close.click': {
                workflowFileManagerPhoto.closeImagePreview();
                break;
            }

            case 'fileManagerPhoto.imagePreview.menu.click': {
                workflowFileManagerPhoto.openImageActionMenu(msg.payload.menuBtn);
                break;
            }

            // Item "Zoom view" trong dropdown "..." — TOGGLE, đọc imagePreviewMode 1 lần, gộp vào
            // `state` thành boolean loại trừ nhau. "Edit" là mode khác (router `imageEdit`, khoá
            // chéo qua event/block.js) — nên KHÔNG gộp chung case dù cùng là toggle imagePreviewMode.
            case 'fileManagerPhoto.imagePreview.zoomToggle.click': {
                const isCurrentlyZooming = appState.get('imagePreviewMode') === 'zoom';
                VirtualMachineState.run([
                    { state: isCurrentlyZooming, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.exitImagePreviewMode();
                    } },
                    { state: isCurrentlyZooming, operation: '===', value: false, callback: () => {
                        workflowFileManagerPhoto.enterZoomMode();
                    } },
                ]);
                break;
            }

            default:
                console.warn(`[router:fileManagerPhoto] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerPhoto', routerFileManagerPhoto);
