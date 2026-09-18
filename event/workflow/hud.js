/**
 * event/workflow/hud.js — Workflow cụm "hud": Volume + Speed, 2 panel nổi kiểu popup hệ thống iOS
 * (components/visualizer-overlay.js) dùng chung cơ chế mở/auto-hide.
 *
 * NẠP SAU: core/hud.js (syncVolumeHudIcon/syncVolumeHudSliderFill/PLAYBACK_SPEED_STEPS/
 * syncSpeedHudOptions), core/dom-refs.js, core/player-controls.js (applyPlaybackSpeedToActiveMedia),
 * service/task-manager.js, service/state/... (appConfigViz, appState), event/bus.js.
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
        syncSpeedHudOptions(speedHudOptions, speedBadgeLabel, appConfigViz.getAll().playbackSpeed); // core/hud.js
        visualizerSpeedHud.classList.remove('hidden');
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    /** Ứng với 'hud.speed.option.click' (.speed-hud-option) — áp NGAY lên media đang active (Song/
     * Video Player), lưu global (không reset theo bài). VBG-video sync riêng, xem
     * event/workflow/visual-bg-video.js::_applyVideoPlaybackSpeedSetting().
     * @param {string} value */
    selectSpeed(value) {
        const speed = parseFloat(value);
        if (!PLAYBACK_SPEED_STEPS.includes(speed)) return; // core/hud.js
        appConfigViz.mutateAll((cfg) => { cfg.playbackSpeed = speed; });
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        applyPlaybackSpeedToActiveMedia(isVideoPlayerMode, appState.get('isPhotoPlayerMode'), speed); // core/player-controls.js
        if (isVideoPlayerMode && typeof workflowPlayerDisplaySettings !== 'undefined') {
            workflowPlayerDisplaySettings.resyncVideoPlayerPointMovePreset(); // advanceMs phụ thuộc speed, tính lại NGAY, KHÔNG restart hành trình
        }
        syncSpeedHudOptions(speedHudOptions, speedBadgeLabel, speed); // core/hud.js
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    _scheduleAutoHide(panelEl, taskName) {
        taskManager.once(() => panelEl.classList.add('hidden'), HUD_AUTO_HIDE_DELAY, taskName);
    },
};
