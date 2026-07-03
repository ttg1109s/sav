/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. CHỐT 03/07/2026 (mục 1a/3/7) — drawer con "Photo & Album" (gộp UI Ảnh + Album).
 *
 * Batch 3 (03/07/2026) — nội dung thật: story slider album + masonry ảnh, xem
 * core/file-manager/photo-ui.js + event/workflow/file-manager-photo.js.
 *
 * STATE CONTEXT: `activeAlbumId` (album đang lọc masonry, null = "Tất cả") sống Ở ĐÂY — cùng cách
 * router "fileManagerSong" giữ `currentFolderDetailId`/`lastScanResults` (closure `let`, không
 * dùng EventStore, không phải appState vì đây chỉ là ngữ cảnh hiển thị tạm thời của riêng drawer
 * này, không cần sống qua reload).
 *
 * NẠP SAU: event/bus.js, core/file-manager/nav.js (showFileManagerPhotoDrawer/
 * hideFileManagerPhotoDrawer), event/workflow/file-manager-photo.js (workflowFileManagerPhoto).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    let activeAlbumId = null; // context state CỦA RIÊNG drawer Photo — reset về null mỗi lần mở lại

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.open': {
                activeAlbumId = null; // luôn mở lại từ "Tất cả", không nhớ lọc phiên trước
                workflowFileManagerPhoto.openDrawer(); // >1 hàm core nối tiếp (patch DOM + đọc DB + vẽ) -> workflow
                break;
            }

            case 'fileManagerPhoto.close': {
                hideFileManagerPhotoDrawer(); // CHỈ 1 hàm core (patch DOM thuần) -> gọi thẳng
                break;
            }

            // ===================== Album (story slider) =====================

            case 'fileManagerPhoto.album.storyClick': {
                const { action, albumId } = msg.payload;
                // 3 giá trị LOẠI TRỪ NHAU (đúng data-album-story-action khai báo ở
                // components/file-manager.js/core/file-manager/photo-ui.js) -> BẮT BUỘC qua VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'all', callback: () => {
                        activeAlbumId = null;
                        workflowFileManagerPhoto.refresh(activeAlbumId);
                    } },
                    { state: action, operation: '===', value: 'select', callback: () => {
                        // Bấm lại đúng album đang lọc -> bỏ lọc (toggle), giống hành vi tab.
                        activeAlbumId = (activeAlbumId === albumId) ? null : albumId;
                        workflowFileManagerPhoto.refresh(activeAlbumId);
                    } },
                    { state: action, operation: '===', value: 'create', callback: () => {
                        workflowFileManagerPhoto.promptCreateAlbum(activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== Ảnh (masonry) =====================

            case 'fileManagerPhoto.image.click': {
                const { imageKey } = msg.payload;
                workflowFileManagerPhoto.openImagePreview(imageKey, activeAlbumId); // >1 hàm core -> workflow
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
