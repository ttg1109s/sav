/**
 * event/router/file-manager-photo.js — Router tên "fileManagerPhoto", tự đăng ký với eventBus lúc
 * nạp. Photo Panel full-screen (lưới ảnh, xoá nhanh, upload) đã xoá — hợp nhất vào Playlist làm 1
 * Source. Router này giờ CHỈ còn phục vụ: modal xem ảnh (Zoom/Edit mode + dropdown action-menu) và
 * picker chọn 1 ảnh dùng chung (Generic Drawer).
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-photo.js (workflowFileManagerPhoto).
 * NẠP TRƯỚC: (không còn listener riêng — mọi msg.type ở đây được gửi từ dropdown/picker động, wire
 * trực tiếp tại nơi dựng DOM, xem core/file-manager/photo-ui.js và core/media-picker-drawer-
 * helper.js).
 */
const routerFileManagerPhoto = (() => {
    function handle(msg) {
        switch (msg.type) {

            // Đích dispatch của dropdown (openImageActionMenu()) — "Lưu đè"/"Lưu mới" thuộc router
            // `imageEdit` riêng (xem event/router/image-edit.js). Nút xoá ảnh đã bỏ khỏi dropdown
            // (Giang yêu cầu — dropdown này không có cách refresh lại Playlist đứng sau modal; xoá
            // ảnh dùng action-menu của dòng Photo trong Playlist, core/playlist/actions.js).
            case 'fileManagerPhoto.imageMenu.setPlaylistBg.click': {
                workflowFileManagerPhoto.setAsPlaylistBackground(msg.payload.imageKey);
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
