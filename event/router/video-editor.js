/**
 * event/router/video-editor.js — Router "videoEdit", tự đăng ký với eventBus. Trang
 * `video-editor.html` DUY NHẤT dùng router này (KHÔNG nạp ở `index.html`).
 */
const routerVideoEdit = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoEdit.back.click': { workflowVideoEditor.handleBack(); break; }
            case 'videoEdit.togglePlay.click': { workflowVideoEditor.handleTogglePlay(); break; }
            case 'videoEdit.skipStart.click': { workflowVideoEditor.handleSkipStart(); break; }
            case 'videoEdit.skipEnd.click': { workflowVideoEditor.handleSkipEnd(); break; }

            case 'videoEdit.selectClip.click': { workflowVideoEditor.handleSelectClip(msg.payload.track, msg.payload.index); break; }
            case 'videoEdit.deselect.click': { workflowVideoEditor.handleDeselect(); break; }
            case 'videoEdit.scrub.move': { workflowVideoEditor.handleScrub(msg.payload.clientX); break; }
            case 'videoEdit.previewTextDrag.start': { workflowVideoEditor.handlePreviewTextDragStart(msg.payload.canvasY); break; }
            case 'videoEdit.previewTextDrag.move': { workflowVideoEditor.handlePreviewTextDragMove(msg.payload.canvasY); break; }
            case 'videoEdit.previewTextDrag.end': { workflowVideoEditor.handlePreviewTextDragEnd(); break; }

            case 'videoEdit.timelineDrag.start': { workflowVideoEditor.handleTimelineDragStart(msg.payload.track, msg.payload.index, msg.payload.handleType, msg.payload.clientX); break; }
            case 'videoEdit.timelineDrag.move': { workflowVideoEditor.handleTimelineDragMove(msg.payload.clientX); break; }
            case 'videoEdit.timelineDrag.end': { workflowVideoEditor.handleTimelineDragEnd(); break; }

            case 'videoEdit.cutAtCurrent.click': { workflowVideoEditor.handleCutAtCurrent(); break; }
            case 'videoEdit.duplicateClip.click': { workflowVideoEditor.handleDuplicateClip(); break; }
            case 'videoEdit.deleteClip.click': { workflowVideoEditor.handleDeleteClip(); break; }
            case 'videoEdit.moveClipEarlier.click': { workflowVideoEditor.handleMoveClipEarlier(); break; }
            case 'videoEdit.moveClipLater.click': { workflowVideoEditor.handleMoveClipLater(); break; }

            case 'videoEdit.crop.click': { workflowVideoEditor.handleCropOpen(); break; }
            case 'videoEdit.cropRatio.select': { workflowVideoEditor.handleCropRatioSelect(msg.payload.ratio); break; }
            case 'videoEdit.cropConfirm.click': { workflowVideoEditor.handleCropConfirm(); break; }
            case 'videoEdit.cropCancel.click': { workflowVideoEditor.handleCropCancel(); break; }
            case 'videoEdit.cropReset.click': { workflowVideoEditor.handleCropReset(); break; }
            case 'videoEdit.rotateLeft.click': { workflowVideoEditor.handleRotateLeft(); break; }
            case 'videoEdit.rotateRight.click': { workflowVideoEditor.handleRotateRight(); break; }
            case 'videoEdit.filter.change': { workflowVideoEditor.handleFilterChange(); break; }
            case 'videoEdit.reset.click': { workflowVideoEditor.handleReset(); break; }
            case 'videoEdit.props.open': { workflowVideoEditor.handlePropsOpen(); break; }
            case 'videoEdit.props.close': { workflowVideoEditor.handlePropsClose(); break; }
            case 'videoEdit.volVideo.change': { workflowVideoEditor.handleVolVideoChange(msg.payload.value); break; }
            case 'videoEdit.extractFrame.click': { workflowVideoEditor.handleExtractFrame(); break; }

            case 'videoEdit.addMusic.open': { workflowVideoEditor.handleAddMusicOpen(); break; }
            case 'videoEdit.songPicker.close': { workflowVideoEditor.handleSongPickerClose(); break; }
            case 'videoEdit.songSearch.input': { workflowVideoEditor.handleSongSearchInput(msg.payload.value); break; }
            case 'videoEdit.songSearchClear.click': { workflowVideoEditor.handleSongSearchClear(); break; }
            case 'videoEdit.songPicker.select': { workflowVideoEditor.handleSongPickerSelect(msg.payload.songKey); break; }

            case 'videoEdit.addText.click': { workflowVideoEditor.handleAddText(); break; }
            case 'videoEdit.textEdit.open': { workflowVideoEditor.handleTextEditOpen(); break; }
            case 'videoEdit.textEdit.close': { workflowVideoEditor.handleTextEditClose(); break; }
            case 'videoEdit.textValue.input': { workflowVideoEditor.handleTextValueInput(msg.payload.value); break; }
            case 'videoEdit.textSize.change': { workflowVideoEditor.handleTextSizeChange(msg.payload.value); break; }
            case 'videoEdit.textColor.change': { workflowVideoEditor.handleTextColorChange(msg.payload.value); break; }
            case 'videoEdit.textPosY.change': { workflowVideoEditor.handleTextPosYChange(msg.payload.value); break; }

            case 'videoEdit.songShift.open': { workflowVideoEditor.handleSongShiftOpen(); break; }
            case 'videoEdit.songShift.close': { workflowVideoEditor.handleSongShiftClose(); break; }
            case 'videoEdit.songShiftDrag.start': { workflowVideoEditor.handleSongShiftDragStart(msg.payload.clientX); break; }
            case 'videoEdit.songShiftDrag.move': { workflowVideoEditor.handleSongShiftDragMove(msg.payload.clientX); break; }
            case 'videoEdit.songShiftDrag.end': { workflowVideoEditor.handleSongShiftDragEnd(); break; }
            case 'videoEdit.clipVolume.change': { workflowVideoEditor.handleClipVolumeChange(msg.payload.value); break; }

            case 'videoEdit.save.click': { workflowVideoEditor.handleSaveClick(msg.payload.anchorEl); break; }
            case 'videoEdit.saveOverwrite.click': { workflowVideoEditor.handleSaveOverwrite(); break; }
            case 'videoEdit.saveAsNew.click': { workflowVideoEditor.handleSaveAsNew(); break; }

            default:
                console.warn(`[router:videoEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('videoEdit', routerVideoEdit);
