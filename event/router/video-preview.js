/**
 * event/router/video-preview.js — Router "videoPreview", tự đăng ký với eventBus. THAY router
 * "videoEdit" (event/router/video-editor.js, ĐÃ XOÁ cùng `video-editor.html` — "Song/Video
 * Unification" v12, gộp vào modal xem Video đúng khuôn modal xem Ảnh). Nạp ở `index.html` (modal
 * sống ngay trong trang chính, KHÔNG còn trang riêng).
 *
 * NẠP SAU: event/bus.js, event/workflow/video-preview.js (workflowVideoPreview).
 */
const routerVideoPreview = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoPreview.metadata.loaded': { workflowVideoPreview.handleMetadataLoaded(); break; }
            case 'videoPreview.close.click': { workflowVideoPreview.handleClose(); break; }

            case 'videoPreview.scrub.input': { workflowVideoPreview.handleScrubInput(msg.payload.value); break; }

            case 'videoPreview.trimDrag.start': { workflowVideoPreview.handleTrimDragStart(msg.payload.handle); break; }
            case 'videoPreview.trimDrag.move': { workflowVideoPreview.handleTrimDragMove(msg.payload.clientX); break; }
            case 'videoPreview.trimDrag.end': { workflowVideoPreview.handleTrimDragEnd(); break; }

            case 'videoPreview.cropRatio.select': { workflowVideoPreview.handleCropRatioSelect(msg.payload.ratio); break; }
            case 'videoPreview.cropRatio.flip': { workflowVideoPreview.handleCropRatioFlip(); break; }
            case 'videoPreview.cropCanvas.pointerDown': { workflowVideoPreview.handleCropCanvasPointerDown(msg.payload); break; }
            case 'videoPreview.cropCanvas.pointerMove': { workflowVideoPreview.handleCropCanvasPointerMove(msg.payload); break; }
            case 'videoPreview.cropCanvas.pointerUp': { workflowVideoPreview.handleCropCanvasPointerUp(); break; }

            case 'videoPreview.rotateLeft.click': { workflowVideoPreview.handleRotateLeft(); break; }
            case 'videoPreview.rotateRight.click': { workflowVideoPreview.handleRotateRight(); break; }
            case 'videoPreview.reset.click': { workflowVideoPreview.handleReset(); break; }
            case 'videoPreview.extractFrame.click': { workflowVideoPreview.handleExtractFrame(); break; }

            case 'videoPreview.save.click': { workflowVideoPreview.handleSaveClick(msg.payload.anchorEl); break; }
            case 'videoPreview.saveOverwrite.click': { workflowVideoPreview.handleSaveOverwrite(); break; }
            case 'videoPreview.saveAsNew.click': { workflowVideoPreview.handleSaveAsNew(); break; }

            default:
                console.warn(`[router:videoPreview] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('videoPreview', routerVideoPreview);
