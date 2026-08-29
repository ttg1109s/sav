/**
 * event/router/visual-bg.js — Router "visualBg". Mọi case ≥2 bước phụ thuộc thứ tự -> giao hết cho
 * `workflowVisualBg`/`workflowSlideshow`, không case nào gọi thẳng Core.
 * NGOẠI LỆ: 'visualBg.pickVideo.click'/'visualBg.pickPhoto.click'/'visualBg.songChanged'
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

            case 'visualBg.listPlaybackMode.change':
                workflowVisualBg.changeListPlaybackMode(msg.payload.value);
                break;

            case 'visualBg.nextOrder.change':
                workflowVisualBg.changeNextOrder(msg.payload.value);
                break;

            // MỚI (29/08/2026) — "Duration mode"/"Seconds per video/photo", dời từ slideshow.
            case 'visualBg.durationMode.change':
                workflowVisualBg.changeDurationMode(msg.payload.value);
                break;

            case 'visualBg.durationSeconds.openPicker':
                workflowVisualBg.openDurationSecondsPicker();
                break;

            case 'visualBg.openGradientPanel.click':
                // SỬA (đợt migrate Visualizer Screen) — điều hướng qua ngăn xếp app-settings.js
                // (liên tuyến domain, TH2) thay vì gọi thẳng — workflowVisualBg.openGradientPanel()
                // giờ CHỈ đồng bộ giá trị, không tự dựng Generic Drawer nữa (xem hàm đó).
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

            // MỚI (29/08/2026) — 3 nút chọn nguồn trực tiếp (thay "Chọn 1"/"Chọn nhóm" +
            // dropdown Kiểu cũ). Cả 2 picker Video/Ảnh đều multi-select (đánh số theo thứ tự
            // chọn), commit qua nút "Chọn" trong header — xem event/workflow/visual-bg.js.
            case 'visualBg.pickVideo.click':
                workflowVisualBg.openPickVideo();
                break;

            case 'visualBg.pickPhoto.click':
                workflowVisualBg.openPickPhoto();
                break;

            // "Thư mục" — dropdown Video/Ảnh ngay trong header picker (đổi loại folder đang duyệt),
            // multi-select + gộp item của mọi folder đã chọn (originKind='groupMulti').
            case 'visualBg.pickFolder.click':
                workflowVisualBg.openPickFolder();
                break;

            case 'visualBg.refreshSource.click':
                workflowVisualBg.refreshSource();
                break;

            case 'visualBg.clearSource.click':
                workflowVisualBg.clearSource();
                break;

            // Kết quả picker Video (Generic Drawer, multi-select — xem openPickVideo()).
            case 'visualBg.videoPicker.tile.click':
                workflowVisualBg.toggleVideoPickerTile(msg.payload.videoKey);
                break;

            case 'visualBg.videoPicker.confirm.click':
                workflowVisualBg.confirmVideoPickerSelection();
                break;

            case 'visualBg.videoPicker.close.click':
                workflowVisualBg.cancelVideoPicker();
                break;

            // Kết quả picker Ảnh (Generic Drawer, multi-select — xem openPickPhoto()). MỚI
            // (29/08/2026) — trước đây picker ảnh đơn dùng CHUNG `workflowFileManagerPhoto.
            // openCoverImagePicker()` (single-select, còn dùng bởi bìa bài hát/Theme, KHÔNG được
            // đụng) — Visual Background giờ có picker RIÊNG (multi-select), tách hẳn.
            case 'visualBg.photoPicker.tile.click':
                workflowVisualBg.togglePhotoPickerTile(msg.payload.imageKey);
                break;

            case 'visualBg.photoPicker.confirm.click':
                workflowVisualBg.confirmPhotoPickerSelection();
                break;

            case 'visualBg.photoPicker.close.click':
                workflowVisualBg.cancelPhotoPicker();
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

            // XOÁ (29/08/2026) — 'visualBg.openSlideshowPanel.click' bỏ hẳn cùng hàng UI, Slideshow
            // giờ chỉ mở được từ System > Slideshow (event/router/app-settings.js), không còn liên
            // kết từ Visual Background.

            // MỚI (08/08/2026) — sub-panel "Âm thanh Video".
            case 'visualBg.openVideoAudioPanel.click':
                // SỬA (đợt migrate Visualizer Screen) — cùng khuôn openGradientPanel.click ngay trên.
                workflowAppSettings.navigateTo(() => workflowAppSettings._renderVisualBgVideoAudio());
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
