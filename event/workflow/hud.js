/**
 * event/workflow/hud.js — Workflow cụm "hud": Volume + Speed, 2 panel nổi kiểu popup hệ thống iOS
 * (components/visualizer-overlay.js) dùng chung cơ chế mở/auto-hide.
 *
 * NẠP SAU: core/hud.js (syncVolumeHudIcon/syncVolumeHudSliderFill/PLAYBACK_SPEED_PRESETS/
 * syncSpeedHudUI/clampAndRoundPlaybackSpeed), core/dom-refs.js, core/player-controls.js
 * (applyPlaybackSpeedToActiveMedia), core/config.js (saveConfig — MỚI 18/09/2026, xem SỬA TIẾP ở
 * docstring selectSpeed()), service/task-manager.js, service/state/... (appConfigViz, appState),
 * event/bus.js.
 * NẠP TRƯỚC: event/router/hud.js.
 */
const HUD_AUTO_HIDE_DELAY = 2500;
const VOLUME_HUD_AUTO_HIDE_TASK = 'hudVolumeAutoHide';
const SPEED_HUD_AUTO_HIDE_TASK = 'hudSpeedAutoHide';

const workflowHud = {
    /** Ứng với 'hud.volume.open.click' (#btn-open-volume). */
    openVolume() {
        const volume = appConfigViz.getAll().volume;
        volumeHudSlider.value = volume;
        syncVolumeHudIcon(volume); // core/hud.js
        syncVolumeHudSliderFill(volumeHudSlider, volume); // core/hud.js
        visualizerVolumeHud.classList.remove('hidden');
        this._scheduleAutoHide(visualizerVolumeHud, VOLUME_HUD_AUTO_HIDE_TASK);
    },

    /** Ứng với 'hud.volume.slider.input' (#volume-hud-slider). @param {string} value */
    handleVolumeSliderInput(value) {
        syncVolumeHudSliderFill(volumeHudSlider, parseInt(value, 10)); // core/hud.js
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.volume.input', payload: { value } });
        this._scheduleAutoHide(visualizerVolumeHud, VOLUME_HUD_AUTO_HIDE_TASK);
    },

    /** Ứng với 'hud.speed.open.click' (#btn-open-speed). */
    openSpeed() {
        syncSpeedHudUI(speedHudSlider, speedHudValueLabel, speedHudOptions, speedBadgeLabel, appConfigViz.getAll().playbackSpeed); // core/hud.js
        visualizerSpeedHud.classList.remove('hidden');
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    /** Ứng với CẢ 'hud.speed.option.click' (.speed-hud-option, ấn 1 mốc — nhảy thẳng) LẪN
     * 'hud.speed.slider.input' (#speed-hud-slider, kéo liên tục — gọi liên tục trong lúc kéo) —
     * CÙNG 1 hàm, áp NGAY lên media đang active (Song/Video Player), lưu global (không reset theo
     * bài). VBG-video sync riêng, xem event/workflow/visual-bg-video.js::
     * _applyVideoPlaybackSpeedSetting().
     *
     * SỬA (18/09/2026, Giang cho phép dải liên tục 0.5-2, làm tròn 2 chữ số thập phân) — TRƯỚC ĐÂY
     * validate bằng `PLAYBACK_SPEED_STEPS.includes(speed)` (CHỈ 6 giá trị cố định, mọi giá trị khác
     * — kể cả hợp lệ trong dải — bị `return` bỏ qua thẳng). Giờ dùng
     * `clampAndRoundPlaybackSpeed()` (core/hud.js): kẹp về [0.5, 2] + làm tròn 2 chữ số, KHÔNG còn
     * khái niệm "từ chối" — mọi số đưa vào đều tự sửa về 1 giá trị hợp lệ.
     *
     * SỬA TIẾP (cùng ngày, Giang báo bug "mở lại app -> toàn bị set luôn lại giá trị 1.5x") — THIẾU
     * HẲN `saveConfig()` từ TRƯỚC (bug CÓ SẴN, không phải mới phát sinh do đợt sửa này —
     * `appConfigViz.mutateAll()` CHỈ đổi object trong RAM, không tự ghi IndexedDB gì cả, xem
     * service/state.js::mutateAll()). So khớp `setVolume()` (core/visualizer/visualizer-display.js)
     * — HUD Volume ĐÃ gọi `saveConfig()` ngay sau mutate, Speed thì KHÔNG — nên mọi lần đổi tốc độ
     * (kéo slider/ấn mốc/cử chỉ) chỉ tồn tại trong phiên hiện tại, KHÔNG BAO GIỜ persist. Giá trị
     * "1.5x" cố định người dùng thấy KHÔNG PHẢI bị code chủ động set lại — đó là giá trị CÒN SÓT
     * trong IndexedDB từ LẦN GẦN NHẤT `saveConfig()` chạy vì lý do KHÁC (vd đổi 1 setting khác cũng
     * gọi saveConfig(), lúc đó `playbackSpeed` trong RAM tình cờ đang là 1.5) — mọi lần đổi tốc độ
     * sau đó chỉ sống trong RAM, mất sạch lúc reload, quay về ĐÚNG bản IndexedDB cũ đó mỗi lần mở
     * lại app. Thêm `saveConfig()` NGAY sau mutate (CÙNG vị trí tương đối với setVolume()) là đủ.
     * @param {string|number} value */
    selectSpeed(value) {
        const speed = clampAndRoundPlaybackSpeed(parseFloat(value)); // core/hud.js
        appConfigViz.mutateAll((cfg) => { cfg.playbackSpeed = speed; });
        saveConfig(); // core/config.js — MỚI 18/09/2026, xem SỬA TIẾP ở docstring trên
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        applyPlaybackSpeedToActiveMedia(isVideoPlayerMode, appState.get('isPhotoPlayerMode'), speed); // core/player-controls.js
        if (isVideoPlayerMode && typeof workflowPlayerDisplaySettings !== 'undefined') {
            workflowPlayerDisplaySettings.resyncVideoPlayerPointMovePreset(); // advanceMs phụ thuộc speed, tính lại NGAY, KHÔNG restart hành trình
        } else if (!appState.get('isPhotoPlayerMode') && typeof workflowVisualBg !== 'undefined') {
            // VÁ (25/09/2026) — Song đang là nguồn chính: VBG Video (nếu bật "Đồng bộ tốc độ phát") áp tốc độ mới NGAY lên
            // video nền + tính lại Point Move — trước đây chỉ có hiệu lực từ video/vòng lặp kế tiếp.
            workflowVisualBg.onGlobalPlaybackSpeedChanged(); // event/workflow/visual-bg-video.js
        }
        syncSpeedHudUI(speedHudSlider, speedHudValueLabel, speedHudOptions, speedBadgeLabel, speed); // core/hud.js
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    _scheduleAutoHide(panelEl, taskName) {
        taskManager.once(() => panelEl.classList.add('hidden'), HUD_AUTO_HIDE_DELAY, taskName);
    },
};
