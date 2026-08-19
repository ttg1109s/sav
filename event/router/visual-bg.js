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

            // MỚI (12/08/2026, Giang yêu cầu mục 6 — "Movement" + "Color swap") — xem docstring
            // event/workflow/visual-bg.js phía trên các hàm tương ứng.
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

            // Bài hát vừa ĐỔI THẬT — gửi từ event/workflow/player.js::playMedia() (CHỈ Song — VBG
            // photo/video KHÔNG áp dụng lúc Video Player mode, đúng vì VBG lúc đó không hiển thị,
            // bị video chính che hết). Rẽ theo `type` (2 nhánh độc lập thật -> VirtualMachineState);
            // `listPlaybackMode`/số lượng item tự guard bên trong từng hàm nhận (Rule: nơi nhận
            // validate, router chỉ rẽ theo state).
            // [SỬA — phản hồi Giang "visualBg.songChanged liên quan gì tới video play mode?"] Nhánh
            // Game Mode (thứ 3, MỚI 16/08/2026) ĐÃ TÁCH RA KHỎI ĐÂY — sự kiện này CHƯA TỪNG có liên
            // hệ khái niệm nào với Game Mode, chỉ từng bị gắn ké tạm vào đây vì tiện tái dùng công
            // phát hiện "bài đổi thật" đã có sẵn. Giờ Game Mode có tín hiệu RIÊNG, trung lập, KHÔNG
            // thuộc domain "visualBg" nữa — xem 'gameplay.mediaChanged' (event/router/gameplay.js),
            // gửi từ CẢ Song (playMedia()) LẪN Video (workflowVideoPlayer.playVideoByKey()).
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

            // SỬA (08/08/2026, phản hồi Giang — icon(1) toggle ngay, %(2) mở modal — 2 case riêng).
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
