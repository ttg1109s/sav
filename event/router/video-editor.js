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

            case 'videoEdit.tab.click': { workflowVideoEditor.handleTabClick(msg.payload.targetId); break; }
            case 'videoEdit.panelClose.click': { workflowVideoEditor.handlePanelClose(); break; }

            // Kéo-thả timeline (Cut trên track Video, Text move/resize, Audio offset drag).
            case 'videoEdit.timelineDrag.start': { workflowVideoEditor.handleTimelineDragStart(msg.payload.handle, msg.payload.clientX); break; }
            case 'videoEdit.timelineDrag.move': { workflowVideoEditor.handleTimelineDragMove(msg.payload.clientX); break; }
            case 'videoEdit.timelineDrag.end': { workflowVideoEditor.handleTimelineDragEnd(); break; }

            case 'videoEdit.crop.click': { workflowVideoEditor.handleCropOpen(); break; }
            case 'videoEdit.cropConfirm.click': { workflowVideoEditor.handleCropConfirm(); break; }
            case 'videoEdit.cropCancel.click': { workflowVideoEditor.handleCropCancel(); break; }
            case 'videoEdit.cropReset.click': { workflowVideoEditor.handleCropReset(); break; }
            case 'videoEdit.rotateLeft.click': { workflowVideoEditor.handleRotateLeft(); break; }
            case 'videoEdit.rotateRight.click': { workflowVideoEditor.handleRotateRight(); break; }
            case 'videoEdit.filter.change': { workflowVideoEditor.handleFilterChange(); break; }
            case 'videoEdit.reset.click': { workflowVideoEditor.handleReset(); break; }
            case 'videoEdit.extractFrame.click': { workflowVideoEditor.handleExtractFrame(); break; }

            case 'videoEdit.volVideo.change': { workflowVideoEditor.handleVolVideoChange(msg.payload.value); break; }
            case 'videoEdit.volSong.change': { workflowVideoEditor.handleVolSongChange(msg.payload.value); break; }

            // Nhạc chèn.
            case 'videoEdit.songSearch.input': { workflowVideoEditor.handleSongSearchInput(msg.payload.value); break; }
            case 'videoEdit.songSearchClear.click': { workflowVideoEditor.handleSongSearchClear(); break; }
            case 'videoEdit.songSelect.click': { workflowVideoEditor.handleSongSelect(msg.payload.songKey); break; }
            case 'videoEdit.removeSong.click': { workflowVideoEditor.handleRemoveSong(); break; }

            // Text overlay.
            case 'videoEdit.addText.click': { workflowVideoEditor.handleAddText(); break; }
            case 'videoEdit.removeText.click': { workflowVideoEditor.handleRemoveText(); break; }
            case 'videoEdit.textValue.input': { workflowVideoEditor.handleTextValueInput(msg.payload.value); break; }
            case 'videoEdit.textSize.change': { workflowVideoEditor.handleTextSizeChange(msg.payload.value); break; }
            case 'videoEdit.textColor.change': { workflowVideoEditor.handleTextColorChange(msg.payload.value); break; }
            case 'videoEdit.textPosY.change': { workflowVideoEditor.handleTextPosYChange(msg.payload.value); break; }

            // Lưu (Batch 4).
            case 'videoEdit.save.click': { workflowVideoEditor.handleSaveClick(msg.payload.anchorEl); break; }
            case 'videoEdit.saveOverwrite.click': { workflowVideoEditor.handleSaveOverwrite(); break; }
            case 'videoEdit.saveAsNew.click': { workflowVideoEditor.handleSaveAsNew(); break; }

            // Split (Batch 4).
            case 'videoEdit.split.click': { workflowVideoEditor.handleSplitOpen(); break; }
            case 'videoEdit.splitCancel.click': { workflowVideoEditor.handleSplitCancel(); break; }
            case 'videoEdit.splitStart.click': { workflowVideoEditor.handleSplitStart(); break; }

            default:
                console.warn(`[router:videoEdit] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('videoEdit', routerVideoEdit);
