/**
 * event/workflow/hud.js — Workflow cụm "hud": Volume + Speed, 2 panel nổi kiểu popup hệ thống iOS
 * (components/visualizer-overlay.js) dùng chung cơ chế mở/auto-hide.
 *
 * NẠP SAU: core/hud.js (syncVolumeHudIcon/syncVolumeHudSliderFill/PLAYBACK_SPEED_PRESETS/
 * syncSpeedHudUI/clampAndRoundPlaybackSpeed), core/dom-refs.js, core/player-controls.js
 * (applyPlaybackSpeedToActiveMedia), service/task-manager.js, service/state/... (appConfigViz,
 * appState), event/bus.js.
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
     * @param {string|number} value */
    selectSpeed(value) {
        const speed = clampAndRoundPlaybackSpeed(parseFloat(value)); // core/hud.js
        appConfigViz.mutateAll((cfg) => { cfg.playbackSpeed = speed; });
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        applyPlaybackSpeedToActiveMedia(isVideoPlayerMode, appState.get('isPhotoPlayerMode'), speed); // core/player-controls.js
        if (isVideoPlayerMode && typeof workflowPlayerDisplaySettings !== 'undefined') {
            workflowPlayerDisplaySettings.resyncVideoPlayerPointMovePreset(); // advanceMs phụ thuộc speed, tính lại NGAY, KHÔNG restart hành trình
        }
        syncSpeedHudUI(speedHudSlider, speedHudValueLabel, speedHudOptions, speedBadgeLabel, speed); // core/hud.js
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    _scheduleAutoHide(panelEl, taskName) {
        taskManager.once(() => panelEl.classList.add('hidden'), HUD_AUTO_HIDE_DELAY, taskName);
    },
};
