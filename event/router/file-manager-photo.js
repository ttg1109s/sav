/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. CHỐT 03/07/2026 (mục 1a/3/7) — panel "Photo & Album" (gộp UI Ảnh + Album).
 *
 * Batch 3 (03/07/2026) — nội dung thật: story slider album + masonry ảnh, xem
 * core/file-manager/photo-ui.js + event/workflow/file-manager-photo.js.
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): Đổi tên/Xoá album đang lọc (`fileManagerPhoto.album.manageClick`) + chế độ
 * chọn nhiều ảnh để thêm vào album đang lọc (`fileManagerPhoto.imageSelection.*`).
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * 'open' ĐỔI TÊN 'openPanel.click'. Case 'close' ĐÃ XOÁ — đóng dùng CHUNG
 * 'settingsStackNav.back.click'. Case 'upload.click' ĐÃ XOÁ — nút trigger giờ click thẳng input
 * file panel-scoped NGAY TRONG listener (DOM proxy thuần, không cần round-trip qua router — xem
 * event/listener/file-manager-photo.js).
 *
 * STATE CONTEXT: `activeAlbumId` (album đang lọc masonry, null = "Tất cả"), `imageSelectionMode`/
 * `selectedImageKeys` sống Ở ĐÂY — cùng cách router "fileManagerSong" giữ `currentFolderDetailId`.
 * MỚI (14/07/2026, mục cuối): `albumStoryPageIndex` (trang hiện tại của story album, arrow
 * pagination) + `imageQuickDeleteMode` (chế độ xoá nhanh — bấm ảnh nào xoá ảnh đó, không hỏi lại).
 * 3 chế độ khi bấm 1 ảnh (`imageSelectionMode`/`imageQuickDeleteMode`/bình thường) LOẠI TRỪ NHAU —
 * KHÔNG BAO GIỜ bật đồng thời 2 cái (guard ở case tương ứng).
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto),
 * core/settings-panel-stack.js (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-photo.js.
 */
const routerFileManagerPhoto = (() => {
    let activeAlbumId = null; // context state CỦA RIÊNG panel Photo — reset về null mỗi lần mở lại
    let imageSelectionMode = false; // MỚI — true = đang chọn nhiều ảnh để thêm vào activeAlbumId
    let selectedImageKeys = new Set(); // MỚI — tập imageKey đang được chọn khi imageSelectionMode=true
    let albumStoryPageIndex = 0; // MỚI (14/07/2026) — trang hiện tại của story album (arrow pagination)
    let imageQuickDeleteMode = false; // MỚI (14/07/2026) — true = bấm ảnh nào xoá ngay ảnh đó, không hỏi lại

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerPhoto.openPanel.click': {
                activeAlbumId = null; // luôn mở lại từ "Tất cả", không nhớ lọc phiên trước
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                albumStoryPageIndex = 0;
                imageQuickDeleteMode = false;
                workflowFileManagerPhoto.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
                break;
            }

            // ===================== Album (story slider) =====================

            case 'fileManagerPhoto.album.storyClick': {
                if (imageSelectionMode || imageQuickDeleteMode) break; // guard: đang chọn nhiều ảnh/xoá nhanh -> KHÔNG cho đổi lọc/tạo album giữa chừng
                const { action, albumId } = msg.payload;
                // 3 giá trị LOẠI TRỪ NHAU (đúng data-album-story-action khai báo ở
                // components/file-manager.js/core/file-manager/photo-ui.js) -> BẮT BUỘC qua VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'all', callback: () => {
                        activeAlbumId = null;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode);
                    } },
                    { state: action, operation: '===', value: 'select', callback: () => {
                        // Bấm lại đúng album đang lọc -> bỏ lọc (toggle), giống hành vi tab.
                        activeAlbumId = (activeAlbumId === albumId) ? null : albumId;
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode);
                    } },
                    { state: action, operation: '===', value: 'create', callback: () => {
                        workflowFileManagerPhoto.promptCreateAlbum(activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // MỚI (14/07/2026, mục 2.3) — pagination "arrow" cho story album. Giang ĐƠN GIẢN HOÁ:
            // CHỈ toggle CSS (`workflowFileManagerPhoto.navigateAlbumStoryPage()`), KHÔNG gọi lại
            // `refresh()` (không cần đọc lại DB/dựng lại DOM chỉ để đổi trang xem).
            case 'fileManagerPhoto.albumStory.prev.click': {
                albumStoryPageIndex = workflowFileManagerPhoto.navigateAlbumStoryPage(albumStoryPageIndex - 1);
                break;
            }
            case 'fileManagerPhoto.albumStory.next.click': {
                albumStoryPageIndex = workflowFileManagerPhoto.navigateAlbumStoryPage(albumStoryPageIndex + 1);
                break;
            }

            // ===================== MỚI (batch tiếp theo, mục 2.2) — thanh quản lý album đang lọc:
            // Đổi tên / Xoá / mở chế độ "Thêm ảnh có sẵn" =====================

            case 'fileManagerPhoto.album.manageClick': {
                if (!activeAlbumId) break; // guard: không có album nào đang lọc thì thanh này vốn đang ẩn, không có đích để thao tác
                const { action } = msg.payload;
                const albumId = activeAlbumId;
                // 4 giá trị LOẠI TRỪ NHAU (đúng id nút khai báo ở components/file-manager.js, map
                // qua actionById trong event/listener/file-manager-photo.js) -> VirtualMachineState.
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'addImages', callback: () => {
                        imageSelectionMode = true;
                        selectedImageKeys = new Set();
                        workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode);
                    } },
                    // MỚI (Batch 8, slideshow) — "Dùng làm nền Slideshow" cho album đang lọc.
                    { state: action, operation: '===', value: 'setSlideshowBg', callback: () => {
                        workflowFileManagerPhoto.setAsSlideshowBackground(albumId); // >1 hàm core -> workflow
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
                // Click 1 ảnh có 3 Ý NGHĨA LOẠI TRỪ NHAU tuỳ chế độ hiện tại: chọn/bỏ (đang thêm
                // ảnh vào album) / xoá ngay (chế độ xoá nhanh, MỚI 14/07/2026) / mở preview (bình
                // thường) -> VirtualMachineState (3 state loại trừ nhau, chỉ ĐÚNG 1 khớp tại 1 thời
                // điểm — bất biến đảm bảo ở 2 case bật/tắt tương ứng, không bao giờ bật đồng thời).
                VirtualMachineState.run([
                    { state: imageSelectionMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.toggleImageSelectionInSet(imageKey, selectedImageKeys); // mutate Set qua tham chiếu + patch DOM surgical -> KHÔNG cần activeAlbumId (fix mục 3, không còn refresh() toàn bộ)
                    } },
                    { state: imageQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.quickDeleteImage(imageKey, activeAlbumId, albumStoryPageIndex); // >1 hàm core -> workflow
                    } },
                    { state: (!imageSelectionMode && !imageQuickDeleteMode), operation: '===', value: true, callback: () => {
                        workflowFileManagerPhoto.openImagePreview(imageKey, activeAlbumId); // >1 hàm core -> workflow
                    } },
                ]);
                break;
            }

            // ===================== MỚI (14/07/2026, mục 2.2) — chế độ xoá nhanh ===================

            case 'fileManagerPhoto.image.deleteMode.click': {
                if (imageSelectionMode) break; // guard: đang chọn nhiều ảnh để thêm vào album -> không cho bật xoá nhanh giữa chừng
                if (imageQuickDeleteMode) {
                    // Đang bật sẵn -> bấm lại = TẮT NGAY, không cần hỏi lại (chỉ BẬT mới cần xác nhận).
                    imageQuickDeleteMode = false;
                    workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode);
                    break;
                }
                workflowFileManagerPhoto.promptQuickDeleteMode(() => { // >1 hàm core (modal + refresh) -> workflow
                    imageQuickDeleteMode = true;
                    workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode);
                });
                break;
            }

            // ===================== MỚI (batch tiếp theo, mục 2.3) — thanh hành động chọn nhiều ==

            case 'fileManagerPhoto.imageSelection.cancel': {
                imageSelectionMode = false;
                selectedImageKeys = new Set();
                workflowFileManagerPhoto.refresh(activeAlbumId, imageSelectionMode, selectedImageKeys, albumStoryPageIndex, imageQuickDeleteMode);
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

            // (case 'upload.click' ĐÃ XOÁ — Batch D6, xem docstring đầu file)

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
