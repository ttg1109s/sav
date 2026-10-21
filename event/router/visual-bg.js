/**
 * event/router/visual-bg.js — Router "visualBg": mọi case giao `workflowVisualBg` (event/workflow/visual-bg-common.js +
 * visual-bg-video.js + visual-bg-photo.js); màn Gradient đi qua ngăn xếp Settings (workflowAppSettings.navigateTo()).
 * NẠP SAU: event/bus.js, event/workflow/visual-bg-*.js. NẠP TRƯỚC: event/listener/visual-bg.js.
 */
const routerVisualBg = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'visualBg.openPanel.click':
                workflowVisualBg.openPanel();
                break;

            case 'visualBg.listPlaybackMode.change':
                workflowVisualBg.changeListPlaybackMode(msg.payload.value);
                break;

            case 'visualBg.nextOrder.change':
                workflowVisualBg.changeNextOrder(msg.payload.value);
                break;

            case 'visualBg.durationMode.change':
                workflowVisualBg.changeDurationMode(msg.payload.value);
                break;

            case 'visualBg.durationSeconds.openPicker':
                workflowVisualBg.openDurationSecondsPicker();
                break;

            case 'visualBg.motionPicker.open.click':
                workflowVisualBg.openMotionPicker();
                break;

            case 'visualBg.enabled.change':
                workflowVisualBg.toggleEnabled(msg.payload.checked);
                break;

            case 'visualBg.syncPlaybackSpeed.change':
                workflowVisualBg.changeSyncPlaybackSpeed(msg.payload.checked);
                break;

            case 'visualBg.resolutionMode.change':
                workflowVisualBg.changeResolutionMode(msg.payload.value);
                break;

            case 'visualBg.openGradientPanel.click':
                workflowAppSettings.navigateTo(() => workflowAppSettings._renderVisualBgGradient());
                break;

            case 'visualBg.colorMode.change':
                workflowVisualBg.changeColorMode(msg.payload.value);
                break;

            case 'visualBg.solidColor.input':
                workflowVisualBg.changeSolidColor(msg.payload.value);
                break;

            case 'visualBg.gradientAngle.input':
                workflowVisualBg.changeGradientAngle(msg.payload.value);
                break;

            case 'visualBg.gradientStop.change':
                workflowVisualBg.changeGradientStop(msg.payload.index, msg.payload.field, msg.payload.value);
                break;

            case 'visualBg.gradientStop.add.click':
                workflowVisualBg.addGradientStop();
                break;

            case 'visualBg.gradientStop.remove.click':
                workflowVisualBg.removeGradientStop(msg.payload.index);
                break;

            case 'visualBg.gradientMovement.enable.change':
                workflowVisualBg.toggleGradientMovement(msg.payload.checked);
                break;

            case 'visualBg.gradientMovement.mode.change':
                workflowVisualBg.changeGradientMovementMode(msg.payload.value);
                break;

            case 'visualBg.gradientMovement.openDurationPicker.click':
                workflowVisualBg.openGradientMovementDurationPicker();
                break;

            case 'visualBg.gradientMovement.audioRotateFrom.change':
                workflowVisualBg.changeGradientMovementAudioRange('audioRotateFrom', msg.payload.value);
                break;

            case 'visualBg.gradientMovement.audioRotateTo.change':
                workflowVisualBg.changeGradientMovementAudioRange('audioRotateTo', msg.payload.value);
                break;

            case 'visualBg.gradientMovement.audioSpreadFrom.change':
                workflowVisualBg.changeGradientMovementAudioRange('audioStopSpreadFrom', msg.payload.value);
                break;

            case 'visualBg.gradientMovement.audioSpreadTo.change':
                workflowVisualBg.changeGradientMovementAudioRange('audioStopSpreadTo', msg.payload.value);
                break;

            case 'visualBg.gradientMovement.colorSwapEnable.change':
                workflowVisualBg.toggleGradientColorSwap(msg.payload.checked);
                break;

            case 'visualBg.gradientMovement.openColorSwapIntervalPicker.click':
                workflowVisualBg.openGradientColorSwapIntervalPicker();
                break;

            case 'visualBg.gradientMovement.openColorSwapTransitionPicker.click':
                workflowVisualBg.openGradientColorSwapTransitionPicker();
                break;

            case 'visualBg.pickVideo.click':
                workflowVisualBg.openPickVideo();
                break;

            case 'visualBg.pickPhoto.click':
                workflowVisualBg.openPickPhoto();
                break;

            case 'visualBg.pickFolder.click':
                workflowVisualBg.openPickFolder();
                break;

            case 'visualBg.refreshSource.click':
                workflowVisualBg.refreshSource();
                break;

            case 'visualBg.clearSource.click':
                workflowVisualBg.clearSource();
                break;

            case 'visualBg.videoPicker.tile.click':
                workflowVisualBg.toggleVideoPickerTile(msg.payload.videoKey);
                break;

            case 'visualBg.videoPicker.confirm.click':
                workflowVisualBg.confirmVideoPickerSelection();
                break;

            case 'visualBg.videoPicker.close.click':
                workflowVisualBg.cancelVideoPicker();
                break;

            case 'visualBg.photoPicker.tile.click':
                workflowVisualBg.togglePhotoPickerTile(msg.payload.imageKey);
                break;

            case 'visualBg.photoPicker.confirm.click':
                workflowVisualBg.confirmPhotoPickerSelection();
                break;

            case 'visualBg.photoPicker.close.click':
                workflowVisualBg.cancelPhotoPicker();
                break;

            case 'visualBg.songChanged':
                workflowVisualBg.advanceForSongChange();
                break;

            case 'visualBg.video.ended':
                workflowVisualBg._onVideoEnded();
                break;

            case 'visualBg.video.timeupdate':
                workflowVisualBg._onVideoTimeUpdate(msg.payload.currentTime);
                break;

            case 'visualBg.openVideoAudioPanel.click':
                workflowVisualBg.openVideoAudioPanel(); // event/workflow/visual-bg-video.js — đọc tên video trước rồi tự navigateTo()
                break;

            case 'visualBg.videoAudio.toggle.click':
                workflowVisualBg.toggleVideoAudioEnabled(msg.payload.videoKey);
                break;

            case 'visualBg.videoAudio.openVolumeModal.click':
                workflowVisualBg.openVideoAudioVolumeModal(msg.payload.videoKey);
                break;

            default:
                console.warn(`[routerVisualBg] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualBg', routerVisualBg);
