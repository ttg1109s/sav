/**
 * event/router/video-preview.js — Router "videoPreview", tự đăng ký với eventBus.
 * NẠP SAU: event/bus.js, event/workflow/video-preview.js (workflowVideoPreview).
 */
const routerVideoPreview = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoPreview.metadata.loaded': { workflowVideoPreview.handleMetadataLoaded(); break; }
            case 'videoPreview.close.click': { workflowVideoPreview.handleClose(); break; }

            case 'videoPreview.video.timeUpdate': { workflowVideoPreview.handleVideoTimeUpdate(msg.payload.currentTime); break; }
            case 'videoPreview.mediaTap.click': { workflowVideoPreview.handleMediaTapClick(); break; }

            case 'videoPreview.trimDrag.start': { workflowVideoPreview.handleTrimDragStart(msg.payload.handle); break; }
            case 'videoPreview.trimDrag.move': { workflowVideoPreview.handleTrimDragMove(msg.payload.clientX); break; }
            case 'videoPreview.trimDrag.end': { workflowVideoPreview.handleTrimDragEnd(); break; }

            case 'videoPreview.cropToggle.click': { workflowVideoPreview.handleCropToggleClick(); break; }
            case 'videoPreview.cropRatio.select': { workflowVideoPreview.handleCropRatioSelect(msg.payload.ratio); break; }
            case 'videoPreview.cropRatio.flip.click': { workflowVideoPreview.handleCropRatioFlip(); break; }
            case 'videoPreview.cropCanvas.pointerDown': { workflowVideoPreview.handleCropCanvasPointerDown(msg.payload); break; }
            case 'videoPreview.cropCanvas.pointerMove': { workflowVideoPreview.handleCropCanvasPointerMove(msg.payload); break; }
            case 'videoPreview.cropCanvas.pointerUp': { workflowVideoPreview.handleCropCanvasPointerUp(); break; }

            case 'videoPreview.rotateLeft.click': { workflowVideoPreview.handleRotateLeft(); break; }
            case 'videoPreview.rotateRight.click': { workflowVideoPreview.handleRotateRight(); break; }
            case 'videoPreview.reset.click': { workflowVideoPreview.handleReset(); break; }
            case 'videoPreview.extractFrame.click': { workflowVideoPreview.handleExtractFrame(); break; }

            case 'videoPreview.undo.click': { workflowVideoPreview.handleUndoClick(); break; }
            case 'videoPreview.redo.click': { workflowVideoPreview.handleRedoClick(); break; }

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
