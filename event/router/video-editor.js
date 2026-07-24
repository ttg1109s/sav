/**
 * event/router/video-editor.js — Router "videoEdit", tự đăng ký với eventBus. Trang
 * `video-editor.html` DUY NHẤT dùng router này (KHÔNG nạp ở `index.html`).
 *
 * [23/07/2026] — BỎ các case của nội dung BÊN TRONG Generic Drawer (Chỉnh/Sửa chữ/Chọn nhạc/Dịch
 * chuyển đoạn) — nay Workflow tự querySelector + addEventListener TRỰC TIẾP ngay sau khi gọi
 * `openGenericDrawer()` (đúng quy ước sẵn có của Generic Drawer trong toàn app, xem
 * event/workflow/video-editor.js::handleVideoClipVolumeOpen()/handleTextEditOpen()/...), KHÔNG qua
 * eventBus.send() nữa. CHỈ giữ lại case MỞ (videoClipVolume.open/addMusic.open/textEdit.open/
 * songShift.open — do TOOLBAR dispatch qua eventBus như bình thường).
 * [SỬA 24/07/2026, mục d] — `videoEdit.props.open` ("Chỉnh" toàn cục, bỏ hẳn) đổi thành
 * `videoEdit.videoClipVolume.open` (Volume RIÊNG của đoạn Video đang chọn).
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
            case 'videoEdit.previewTextDrag.start': { workflowVideoEditor.handlePreviewTextDragStart(msg.payload.canvasX, msg.payload.canvasY); break; }
            case 'videoEdit.previewTextDrag.move': { workflowVideoEditor.handlePreviewTextDragMove(msg.payload.canvasX, msg.payload.canvasY); break; }
            case 'videoEdit.previewTextDrag.end': { workflowVideoEditor.handlePreviewTextDragEnd(); break; }
            case 'videoEdit.previewTextPinch.start': { workflowVideoEditor.handlePreviewTextPinchStart(); break; }
            case 'videoEdit.previewTextPinch.move': { workflowVideoEditor.handlePreviewTextPinchMove(msg.payload.startDist, msg.payload.startAngleDeg, msg.payload.currentDist, msg.payload.currentAngleDeg); break; }
            case 'videoEdit.previewTextPinch.end': { workflowVideoEditor.handlePreviewTextPinchEnd(); break; }

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
            case 'videoEdit.reset.click': { workflowVideoEditor.handleReset(); break; }
            case 'videoEdit.videoClipVolume.open': { workflowVideoEditor.handleVideoClipVolumeOpen(); break; }
            case 'videoEdit.extractFrame.click': { workflowVideoEditor.handleExtractFrame(); break; }

            case 'videoEdit.addMusic.open': { workflowVideoEditor.handleAddMusicOpen(); break; }

            case 'videoEdit.addText.click': { workflowVideoEditor.handleAddText(); break; }
            case 'videoEdit.textEdit.open': { workflowVideoEditor.handleTextEditOpen(); break; }

            case 'videoEdit.songShift.open': { workflowVideoEditor.handleSongShiftOpen(); break; }

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
