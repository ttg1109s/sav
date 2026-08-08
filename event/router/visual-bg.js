/**
 * event/router/visual-bg.js — Router "visualBg". Mọi case ≥2 bước phụ thuộc thứ tự -> giao hết cho
 * `workflowVisualBg`/`workflowSlideshow`, không case nào gọi thẳng Core.
 * NGOẠI LỆ: 'visualBg.pickSingleSource.click'/'visualBg.pickGroupSource.click'/'visualBg.songChanged'
 * — rẽ theo `type`/`listPlaybackMode` qua VirtualMachineState (rẽ nhánh theo state đi qua đây,
 * không viết switch/if tay trong case).
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, event/workflow/visual-bg.js.
 * NẠP TRƯỚC: event/listener/visual-bg.js.
 */
const routerVisualBg = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'visualBg.openPanel.click':
                workflowVisualBg.openPanel();
                break;

            case 'visualBg.type.change':
                workflowVisualBg.changeType(msg.payload.value);
                break;

            case 'visualBg.listPlaybackMode.change':
                workflowVisualBg.changeListPlaybackMode(msg.payload.value);
                break;

            case 'visualBg.nextOrder.change':
                workflowVisualBg.changeNextOrder(msg.payload.value);
                break;

            case 'visualBg.openGradientPanel.click':
                workflowVisualBg.openGradientPanel();
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

            // "Chọn 1 ảnh/video" — 2 nhánh loại trừ theo `type` (KHÔNG còn tổ hợp sourceMode).
            case 'visualBg.pickSingleSource.click': {
                const type = appConfigVisualBg.getAll().type;
                VirtualMachineState.run([
                    { state: type, operation: '===', value: 'photo', callback: () => workflowVisualBg.openSingleImagePicker() },
                    { state: type, operation: '===', value: 'video', callback: () => workflowVisualBg.openSingleVideoPicker() },
                ]);
                break;
            }

            // "Chọn Album/Thư mục" — cùng khuôn, khác 2 picker.
            case 'visualBg.pickGroupSource.click': {
                const type = appConfigVisualBg.getAll().type;
                VirtualMachineState.run([
                    { state: type, operation: '===', value: 'photo', callback: () => workflowVisualBg.openListAlbumPicker() },
                    { state: type, operation: '===', value: 'video', callback: () => workflowVisualBg.openListFolderPicker() },
                ]);
                break;
            }

            case 'visualBg.refreshSource.click':
                workflowVisualBg.refreshSource();
                break;

            case 'visualBg.clearSource.click':
                workflowVisualBg.clearSource();
                break;

            // Kết quả 3 picker Generic Drawer (picker ảnh đơn là modal callback-based có sẵn, KHÔNG
            // đi qua bus — xem workflowVisualBg.openSingleImagePicker()).
            case 'visualBg.videoPicker.tile.click':
                workflowVisualBg.selectVideoFromPicker(msg.payload.videoKey);
                break;

            case 'visualBg.videoPicker.close.click':
                workflowVisualBg.cancelVideoPicker();
                break;

            case 'visualBg.albumPicker.tile.click':
                workflowVisualBg.selectAlbumFromPicker(msg.payload.albumId);
                break;

            case 'visualBg.albumPicker.cancel.click':
                workflowVisualBg.cancelAlbumPicker();
                break;

            // Bài hát vừa ĐỔI THẬT — gửi từ core/playlist/actions.js::playSong(). Rẽ theo `type`
            // (2 nhánh độc lập thật -> VirtualMachineState); `listPlaybackMode`/số lượng item tự
            // guard bên trong từng hàm nhận (Rule: nơi nhận validate, router chỉ rẽ theo state).
            case 'visualBg.songChanged': {
                const type = appConfigVisualBg.getAll().type;
                VirtualMachineState.run([
                    { state: type, operation: '===', value: 'photo', callback: () => workflowSlideshow.advanceForSongChange() },
                    { state: type, operation: '===', value: 'video', callback: () => workflowVisualBg.advanceForSongChange() },
                ]);
                break;
            }

            // MỚI (08/08/2026, phản hồi Giang — mục "video chạy/dừng/lặp/đen màn thất thường") — THAY
            // cho taskManager hẹn giờ cố định đã bỏ, xem event/listener/visual-bg.js + _onVideoEnded().
            case 'visualBg.video.ended':
                workflowVisualBg._onVideoEnded();
                break;

            case 'visualBg.openSlideshowPanel.click':
                workflowSlideshow.openPanel();
                break;

            // MỚI (08/08/2026) — sub-panel "Âm thanh Video".
            case 'visualBg.openVideoAudioPanel.click':
                workflowVisualBg.openVideoAudioPanel();
                break;

            case 'visualBg.videoAudio.enable.change':
                workflowVisualBg.setVideoAudioEnabled(msg.payload.videoKey, msg.payload.checked);
                break;

            case 'visualBg.videoAudio.volume.input':
                workflowVisualBg.setVideoAudioVolume(msg.payload.videoKey, msg.payload.value);
                break;

            default:
                console.warn(`[routerVisualBg] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualBg', routerVisualBg);
