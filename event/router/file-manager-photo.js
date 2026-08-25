/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. Photo Panel full-screen (lưới ảnh, xoá nhanh, upload) đã xoá — hợp nhất vào Playlist làm 1
 * Source. Router này giờ CHỈ còn phục vụ: nút X đóng modal xem ảnh (View/Zoom/Edit đã GỘP làm 1,
 * không còn dropdown "...") và picker chọn 1 ảnh dùng chung (Generic Drawer).
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto).
 * NẠP TRƯỚC: (không còn listener riêng — mọi msg.type ở đây được gửi từ header modal/picker động,
 * wire trực tiếp tại nơi dựng DOM, xem core/file-manager/photo-ui.js và core/media-picker-drawer-
 * helper.js).
 */
const routerFileManagerPhoto = (() => {
    function handle(msg) {
        switch (msg.type) {

            // Nút X modal xem ảnh — KHÔNG còn Block gate nào chặn (GỘP View/Zoom/Edit làm 1, xem
            // event/block.js) — LUÔN đóng được, bất kể đang xem thường hay đang Edit.
            case 'fileManagerPhoto.imagePreview.close.click': {
                workflowFileManagerPhoto.closeImagePreview();
                break;
            }

            // ===================== Picker ảnh dùng chung (Generic Drawer) =====================

            case 'fileManagerPhoto.imagePicker.tile.click': {
                workflowFileManagerPhoto.handleImagePickerTileClick(msg.payload.imageKey);
                break;
            }

            case 'fileManagerPhoto.imagePicker.close.click': {
                workflowFileManagerPhoto.handleImagePickerCloseClick();
                break;
            }

            default:
                console.warn(`[router:fileManagerPhoto] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerPhoto', routerFileManagerPhoto);
