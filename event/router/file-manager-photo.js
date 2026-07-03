/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. CHỐT 03/07/2026 (mục 1a/3/7) — drawer con "Photo & Album" (gộp UI Ảnh + Album).
 *
 * Batch 3 (03/07/2026) — nội dung thật: story slider album + masonry ảnh, xem
 * core/file-manager/photo-ui.js + event/workflow/file-manager-photo.js.
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): Đổi tên/Xoá album đang lọc (`fileManagerPhoto.album.manageClick`) + chế độ
 * chọn nhiều ảnh để thêm vào album đang lọc (`fileManagerPhoto.imageSelection.*`).
 *
 * STATE CONTEXT: `activeAlbumId` (album đang lọc masonry, null = "Tất cả"), `imageSelectionMode`/
 * `selectedImageKeys` (MỚI — chế độ chọn nhiều ảnh có sẵn để thêm vào `activeAlbumId`) sống Ở ĐÂY —
 * cùng cách router "fileManagerSong" giữ `currentFolderDetailId`/`lastScanResults` (closure `let`,
 * không dùng EventStore, không phải appState vì đây chỉ là ngữ cảnh hiển thị tạm thời của riêng
 * drawer này, không cần sống qua reload). `selectedImageKeys` là 1 `Set` — workflow được phép mutate
 * TRỰC TIẾP qua tham chiếu (không cần callback reset như `activeAlbumId`/`imageSelectionMode`, vốn
 * là primitive — reassign primitive chỉ làm được TẠI ĐÂY, không truyền ngược được từ workflow).
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (showFileManagerPhotoDrawer/
 * hideFileManagerPhotoDrawer), event/workflow/file-manager-photo.js (workflowFileManagerPhoto).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    let activeAlbumId = null; // context state CỦA RIÊNG drawer Photo — reset về null mỗi lần mở lại
    let imageSelectionMode = false; // MỚI — true = đang chọn nhiều ảnh để thêm vào activeAlbumId
    let selectedImageKeys = new Set(); // MỚI — tập imageKey đang được chọn khi imageSelectionMode=true

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.open': {
                activeAlbumId = null; // luôn mở lại từ "Tất cả", không nhớ lọc phiên trước
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                workflowFileManagerPhoto.openDrawer(); // >1 hàm core nối tiếp (patch DOM + đọc DB + vẽ) -> workflow
                break;
            }

            case 'fileManagerPhoto.close': {
                hideFileManagerPhotoDrawer(); // CHỈ 1 hàm core (patch DOM thuần) -> gọi thẳng
                break;
            }

            // ===================== Album (story slider) =====================

            case 'fileManagerPhoto.album.storyClick': {
                if (imageSelectionMode) break; // guard: đang chọn nhiều ảnh -> KHÔNG cho đổi lọc/tạo album giữa chừng (chỉ Huỷ/Xác nhận mới thoát chế độ này, xem 2 case bên dưới)
                const { action, albumId } = msg.payload;
                // 3 giá trị LOẠI TRỪ NHAU (đúng data-album-story-action khai báo ở
                // components/file-manager.js/core/file-manager/photo-ui.js) -> BẮT BUỘC qua VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'all', callback: () => {
                        activeAlbumId = null;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys);
                    } },
                    { state: action, operation: '===', value: 'select', callback: () => {
                        // Bấm lại đúng album đang lọc -> bỏ lọc (toggle), giống hành vi tab.
                        activeAlbumId = (activeAlbumId === albumId) ? null : albumId;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys);
                    } },
                    { state: action, operation: '===', value: 'create', callback: () => {
                        workflowFileManagerPhoto.promptCreateAlbum(activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== MỚI (batch tiếp theo, mục 2.2) — thanh quản lý album đang lọc:
            // Đổi tên / Xoá / mở chế độ "Thêm ảnh có sẵn" =====================

            case 'fileManagerPhoto.album.manageClick': {
                if (!activeAlbumId) break; // guard: không có album nào đang lọc thì thanh này vốn đang ẩn, không có đích để thao tác
                const { action } = msg.payload;
                const albumId = activeAlbumId;
                // 3 giá trị LOẠI TRỪ NHAU (đúng data-album-manage-action khai báo ở components/file-manager.js) -> VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'addImages', callback: () => {
                        imageSelectionMode = true;
                        selectedImageKeys = new Set();
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys);
                    } },
                    { state: action, operation: '===', value: 'rename', callback: () => {
                        workflowFileManagerPhoto.renameAlbumById(albumId); // >1 hàm core -> workflow
                    } },
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        // onDeleted: reset activeAlbumId về null NGAY TẦNG NÀY — workflow không tự
                        // mutate được biến closure primitive của router (xem comment đầu file).
                        workflowFileManagerPhoto.deleteAlbumById(albumId, () => { activeAlbumId = null; });
                    } },
                ]);
                break;
            }

            // ===================== Ảnh (masonry) =====================

            case 'fileManagerPhoto.image.click': {
                const { imageKey } = msg.payload;
                // Click 1 ảnh có 2 Ý NGHĨA loại trừ nhau tuỳ imageSelectionMode: mở preview (bình
                // thường) HAY toggle chọn/bỏ (đang chọn nhiều để thêm vào album) -> VirtualMachineState.
                VirtualMachineState.run([
                    { state: imageSelectionMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.toggleImageSelectionInSet(imageKey, selectedImageKeys, activeAlbumId); // mutate Set qua tham chiếu -> KHÔNG cần callback reset
                    } },
                    { state: imageSelectionMode, operation: '===', value: false, callback: () => {
                        workflowFileManagerPhoto.openImagePreview(imageKey, activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== MỚI (batch tiếp theo, mục 2.3) — thanh hành động chọn nhiều ==

            case 'fileManagerPhoto.imageSelection.cancel': {
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys);
                break;
            }

            case 'fileManagerPhoto.imageSelection.confirm': {
                const albumId = activeAlbumId; // luôn hợp lệ tại đây: chỉ vào được selectionMode qua 'addImages' (đã guard activeAlbumId ở trên), và storyClick bị khoá suốt lúc đang chọn (guard đầu case đó) -> activeAlbumId không thể đổi/về null giữa chừng
                const keysToAdd = selectedImageKeys;
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                workflowFileManagerPhoto.confirmAddSelectedImages(albumId, keysToAdd, albumId); // >1 hàm core (shield + addImagesToAlbum) -> workflow
                break;
            }

            // ===================== Upload (Batch 3 — nút riêng của Photo drawer, CHƯA phải bộ
            // phân loại thông minh dùng chung với upload nhạc — đó là Batch 8 theo kế hoạch) =====

            case 'fileManagerPhoto.upload.click': {
                fileManagerImageUploadInput.click(); // core DOM API thuần, gọi thẳng
                break;
            }

            case 'fileManagerPhoto.upload.change': {
                const { files } = msg.payload;
                workflowFileManagerPhoto.uploadImages(files, activeAlbumId); // >1 hàm core -> workflow
                break;
            }

            default:
                console.warn(`[router:fileManagerPhoto] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerPhoto', routerFileManagerPhoto);
