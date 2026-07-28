/**
 * event/router/file-manager-video.js — Router tên "fileManagerVideo", tự đăng ký với eventBus lúc
 * nạp.
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — TOÀN BỘ case của panel
 * "File Manager → Video" (`openPanel.click`/`uploadTrigger.click`/`upload.change`/`video.click`/
 * `tileMenu.action.click`/`deleteMode.click`) ĐÃ XOÁ cùng lúc xoá panel đó — `videoQuickDeleteMode`/
 * `quickDeleteSelectedKeys` (closure state riêng của panel) không còn cần thiết. Router này giờ
 * CHỈ còn 2 case của picker Generic Drawer "Use background video"
 * (event/workflow/visualizer-control-center.js) — KHÔNG liên quan panel đã xoá.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-video.js (workflowFileManagerVideo).
 * NẠP TRƯỚC: event/listener/file-manager-video.js.
 */
const routerFileManagerVideo = (() => {
    function handle(msg) {
        switch (msg.type) {
            // ===================== Picker Generic Drawer "Use background video" =====================
            // Router CHỈ relay message, KHÔNG giữ state picker nào (session sống trong Workflow,
            // `_videoPickerSession`) — cùng nguyên tắc đã áp dụng cho picker ảnh (file-manager-photo.js).
            case 'fileManagerVideo.videoPicker.tile.click': {
                const { videoKey } = msg.payload;
                workflowFileManagerVideo.handleVideoPickerTileClick(videoKey);
                break;
            }

            case 'fileManagerVideo.videoPicker.close.click': {
                workflowFileManagerVideo.handleVideoPickerCloseClick();
                break;
            }

            default:
                console.warn(`[router:fileManagerVideo] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerVideo', routerFileManagerVideo);
