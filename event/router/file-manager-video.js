/**
 * event/router/file-manager-video.js — Router tên "fileManagerVideo", tự đăng ký với eventBus lúc
 * nạp. MỚI (21/07/2026). Mirror event/router/file-manager-photo.js — đơn giản hơn hẳn: KHÔNG có
 * `activeAlbumId` (Video không có Album), nên `uploadTrigger.click` gọi THẲNG 1 đích duy nhất
 * (option B, không cần VirtualMachineState — không có `appState` nào cần đọc để CHỌN đích).
 *
 * STATE CONTEXT: `videoQuickDeleteMode` (chế độ xoá nhanh) + `quickDeleteSelectedKeys` (Set closure,
 * video đã đánh dấu chờ xoá) — CÙNG khuôn `imageQuickDeleteMode`/`quickDeleteSelectedKeys` ở router
 * Photo.
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-video.js (workflowFileManagerVideo),
 * core/settings-panel-stack-ui.js (pushSettingsPanel).
 * NẠP TRƯỚC: event/listener/file-manager-video.js.
 */
const routerFileManagerVideo = (() => {
    let videoQuickDeleteMode = false; // true = đang ở chế độ xoá nhanh
    let quickDeleteSelectedKeys = new Set(); // video đã đánh dấu chờ xoá

    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerVideo.openPanel.click': {
                videoQuickDeleteMode = false;
                quickDeleteSelectedKeys = new Set();
                workflowFileManagerVideo.openPanel(); // >1 hàm core nối tiếp (push + đọc DB + vẽ) -> workflow
                break;
            }

            case 'fileManagerVideo.uploadTrigger.click': {
                // KHÔNG cần VirtualMachineState — chỉ 1 đích duy nhất, không có appState nào cần đọc
                // để CHỌN đích (khác Photo, vốn rẽ nhánh theo activeAlbumId).
                workflowFileManagerVideo.triggerUploadInput();
                break;
            }

            case 'fileManagerVideo.upload.change': {
                const { files } = msg.payload;
                workflowFileManagerVideo.uploadVideos(files); // >1 hàm core -> workflow
                break;
            }

            case 'fileManagerVideo.video.click': {
                const { videoKey, anchorEl } = msg.payload;
                // 2 Ý NGHĨA loại trừ nhau: đánh dấu chờ xoá (xoá nhanh) / mở menu action (bình
                // thường, SỬA 21/07/2026 — trước đây mở preview fullscreen, giờ mở dropdown, xem
                // workflowFileManagerVideo.openVideoTileActionMenu()) — cần đọc `videoQuickDeleteMode`
                // (state RIÊNG của Router) để CHỌN đích -> LUÔN VirtualMachineState (event-bus-
                // flow.md mục 4C).
                VirtualMachineState.run([
                    { state: videoQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerVideo.toggleQuickDeleteMarkInSet(videoKey, quickDeleteSelectedKeys);
                    } },
                    { state: !videoQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerVideo.openVideoTileActionMenu(videoKey, anchorEl);
                    } },
                ]);
                break;
            }

            // MỚI (21/07/2026, Giang yêu cầu "bấm video hiện dropdown menu: Set as bg video/Edit
            // video/Xoá") — đích dispatch của dropdown (workflowFileManagerVideo.openVideoTileActionMenu()).
            case 'fileManagerVideo.tileMenu.action.click': {
                const { action, videoKey } = msg.payload;
                VirtualMachineState.run([
                    { state: action, operation: '===', value: 'setAsBgVideo', callback: () => {
                        workflowFileManagerVideo.setVideoAsBackground(videoKey);
                    } },
                    { state: action, operation: '===', value: 'editVideo', callback: () => {
                        workflowFileManagerVideo.showEditVideoPlaceholder();
                    } },
                    { state: action, operation: '===', value: 'delete', callback: () => {
                        workflowFileManagerVideo.confirmDeleteSingleVideo(videoKey);
                    } },
                ]);
                break;
            }

            // MỚI (21/07/2026, Giang yêu cầu "toggle Video Player chuyển vào Video UI") — checkbox
            // trong panel (components/file-manager.js::renderFileManagerVideoPanelBody()).
            case 'fileManagerVideo.playerModeToggle.change': {
                const { checked } = msg.payload;
                workflowFileManagerVideo.togglePlayerModeFromPanel(checked); // >1 hàm core (đọc vizConfig + gọi workflowVideoPlayer) -> workflow
                break;
            }

            // ===================== Chế độ xoá nhanh — 3 nhánh loại trừ nhau, cùng khuôn Photo =====
            case 'fileManagerVideo.deleteMode.click': {
                VirtualMachineState.run([
                    { state: !videoQuickDeleteMode, operation: '===', value: true, callback: () => {
                        workflowFileManagerVideo.promptQuickDeleteMode(() => {
                            videoQuickDeleteMode = true;
                            quickDeleteSelectedKeys = new Set();
                            workflowFileManagerVideo.updateQuickDeleteModeUI(videoQuickDeleteMode, quickDeleteSelectedKeys);
                        });
                    } },
                    { state: (videoQuickDeleteMode && quickDeleteSelectedKeys.size === 0), operation: '===', value: true, callback: () => {
                        videoQuickDeleteMode = false;
                        workflowFileManagerVideo.updateQuickDeleteModeUI(videoQuickDeleteMode, quickDeleteSelectedKeys);
                    } },
                    { state: (videoQuickDeleteMode && quickDeleteSelectedKeys.size > 0), operation: '===', value: true, callback: () => {
                        workflowFileManagerVideo.confirmQuickDeleteBatch(quickDeleteSelectedKeys, () => { videoQuickDeleteMode = false; });
                    } },
                ]);
                break;
            }

            // ===================== Batch 2 (21/07/2026) — Picker Generic Drawer "Use background
            // video" (event/workflow/visualizer-control-center.js). Router CHỈ relay message, KHÔNG
            // giữ state picker nào (session sống trong Workflow, `_videoPickerSession`) — cùng
            // nguyên tắc đã áp dụng cho picker ảnh (file-manager-photo.js).
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
