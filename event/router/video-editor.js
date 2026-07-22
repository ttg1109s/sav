/**
 * event/router/video-editor.js — Router "videoEdit", tự đăng ký với eventBus. Trang
 * `video-editor.html` DUY NHẤT dùng router này (KHÔNG nạp ở `index.html`) — cùng khuôn
 * `event/router/image-edit.js`.
 */
const routerVideoEdit = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoEdit.back.click': { workflowVideoEditor.handleBack(); break; }
            case 'videoEdit.filter.change': { workflowVideoEditor.handleSliderChange(); break; }
            case 'videoEdit.crop.click': { workflowVideoEditor.handleCropOpen(); break; }
            case 'videoEdit.cropConfirm.click': { workflowVideoEditor.handleCropConfirm(); break; }
            case 'videoEdit.cropCancel.click': { workflowVideoEditor.handleCropCancel(); break; }
            case 'videoEdit.cropReset.click': { workflowVideoEditor.handleCropReset(); break; }
            case 'videoEdit.rotateLeft.click': { workflowVideoEditor.handleRotateLeft(); break; }
            case 'videoEdit.rotateRight.click': { workflowVideoEditor.handleRotateRight(); break; }
            case 'videoEdit.reset.click': { workflowVideoEditor.handleReset(); break; }

            // MỚI (Batch 2) — Cut.
            case 'videoEdit.cut.click': { workflowVideoEditor.handleCutOpen(); break; }
            case 'videoEdit.cutPickStart.click': { workflowVideoEditor.handleCutPickStart(); break; }
            case 'videoEdit.cutPickEnd.click': { workflowVideoEditor.handleCutPickEnd(); break; }
            case 'videoEdit.cutConfirm.click': { workflowVideoEditor.handleCutConfirm(); break; }
            case 'videoEdit.cutCancel.click': { workflowVideoEditor.handleCutCancel(); break; }
            case 'videoEdit.cutReset.click': { workflowVideoEditor.handleCutReset(); break; }

            // MỚI (Batch 2) — Trích xuất ảnh.
            case 'videoEdit.extractFrame.click': { workflowVideoEditor.handleExtractFrame(); break; }

            default:
                console.warn(`[router:videoEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('videoEdit', routerVideoEdit);
