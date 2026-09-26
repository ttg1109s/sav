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
            case 'videoPreview.video.playState': { workflowVideoPreview.handleVideoPlayState(msg.payload.playing); break; }
            case 'videoPreview.mediaTap.click': { workflowVideoPreview.handleMediaTapClick(); break; }

            case 'videoPreview.trimDrag.start': { workflowVideoPreview.handleTrimDragStart(msg.payload.handle); break; }
            case 'videoPreview.trimDrag.move': { workflowVideoPreview.handleTrimDragMove(msg.payload.clientX); break; }
            case 'videoPreview.trimDrag.end': { workflowVideoPreview.handleTrimDragEnd(); break; }
            case 'videoPreview.trimTrack.pointerDown': { workflowVideoPreview.handleTrimTrackPointerDown(msg.payload.clientX); break; }

            // MỚI (26/09/2026, khung UI kiểu Story) — rail dọc + công cụ Cắt/Cắt khung (thay 'cropToggle.click')
            case 'videoPreview.railExpand.click': { workflowVideoPreview.handleRailExpandClick(); break; }
            case 'videoPreview.tool.open': { workflowVideoPreview.handleToolOpen(msg.payload.tool); break; }
            case 'videoPreview.tool.cancel': { workflowVideoPreview.handleToolCancel(); break; }
            case 'videoPreview.tool.done': { workflowVideoPreview.handleToolDone(); break; }
            case 'videoPreview.mute.click': { workflowVideoPreview.handleMuteClick(); break; }

            case 'videoPreview.cropRatio.select': { workflowVideoPreview.handleCropRatioSelect(msg.payload.ratio); break; }
            case 'videoPreview.cropCanvas.pointerDown': { workflowVideoPreview.handleCropCanvasPointerDown(msg.payload.clientX, msg.payload.clientY); break; }
            case 'videoPreview.cropCanvas.pointerMove': { workflowVideoPreview.handleCropCanvasPointerMove(msg.payload.clientX, msg.payload.clientY); break; }
            case 'videoPreview.cropCanvas.pointerUp': { workflowVideoPreview.handleCropCanvasPointerUp(); break; }

            case 'videoPreview.rotate.click': { workflowVideoPreview.handleRotateClick(); break; }
            case 'videoPreview.flip.click': { workflowVideoPreview.handleFlipClick(); break; }
            case 'videoPreview.reset.click': { workflowVideoPreview.handleReset(); break; }

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
