/**
 * event/workflow/hud.js — Workflow cụm "hud": Volume + Speed, 2 panel nổi kiểu popup hệ thống iOS
 * (components/visualizer-overlay.js) dùng chung cơ chế mở/auto-hide.
 *
 * NẠP SAU: core/hud.js, core/dom-refs.js, core/playlist/render.js (resolvePlayingMediaType), event/workflow/config.js
 * (workflowConfig.save), service/task-manager.js. Lúc chạy: event/workflow/player-controls.js (applySpeedToActiveMedia).
 * NẠP TRƯỚC: event/router/hud.js.
 */
const HUD_AUTO_HIDE_DELAY = 2500;
const VOLUME_HUD_AUTO_HIDE_TASK = 'hudVolumeAutoHide';
const SPEED_HUD_AUTO_HIDE_TASK = 'hudSpeedAutoHide';

/** Sau khi đổi tốc độ: Video Player -> tính lại Point Move (advanceMs phụ thuộc speed, không restart hành trình); Song ->
 * VBG Video áp tốc độ mới ngay (nếu bật "Đồng bộ tốc độ phát"); Photo -> không có gì thêm. */
const HUD_SPEED_FOLLOW_UP_BY_MEDIA_TYPE = {
    video: () => workflowPlayerDisplaySettings.resyncVideoPlayerPointMovePreset(), // event/workflow/player-display-settings.js
    song: () => workflowVisualBg.onGlobalPlaybackSpeedChanged(), // event/workflow/visual-bg-video.js
    photo: () => {},
};

const workflowHud = {
    /** 'hud.volume.open.click' (#btn-open-volume). */
    openVolume() {
        const volume = appConfigViz.getAll().volume;
        setVolumeHudSliderValue(volumeHudSlider, volume); // core/hud.js
        syncVolumeHudIcon(resolveVolumeIconLevel(volume));
        syncVolumeHudSliderFill(volumeHudSlider, volume);
        showHudPanel(visualizerVolumeHud);
        this._scheduleAutoHide(visualizerVolumeHud, VOLUME_HUD_AUTO_HIDE_TASK);
    },

    /** 'hud.volume.slider.input' (#volume-hud-slider). @param {string} value */
    handleVolumeSliderInput(value) {
        syncVolumeHudSliderFill(volumeHudSlider, parseInt(value, 10)); // core/hud.js
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.volume.input', payload: { value } });
        this._scheduleAutoHide(visualizerVolumeHud, VOLUME_HUD_AUTO_HIDE_TASK);
    },

    /** 'hud.speed.open.click' (#btn-open-speed). */
    openSpeed() {
        this.syncSpeedUI(appConfigViz.getAll().playbackSpeed);
        showHudPanel(visualizerSpeedHud); // core/hud.js
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    /** Đồng bộ toàn bộ UI Speed HUD theo `speed` — gọi thêm lúc boot (event/workflow/app-boot.js, sau workflowConfig.loadOnBoot()) để
     * badge trên nút khớp tốc độ đã lưu ngay từ đầu. @param {number} speed */
    syncSpeedUI(speed) {
        syncSpeedHudUI(speedHudSlider, speedHudValueLabel, speedHudOptions, speedBadgeLabel, resolveSpeedHudView(speed)); // core/hud.js
    },

    /** 'hud.speed.option.click' (ấn 1 mốc) và 'hud.speed.slider.input' (kéo liên tục) — kẹp + làm tròn, lưu global (không
     * reset theo bài), áp ngay lên media đang active. Cử chỉ tăng/giảm mốc cũng gọi thẳng (visualizer-gesture.js).
     * @param {string|number} value */
    selectSpeed(value) {
        const speed = clampAndRoundPlaybackSpeed(value); // core/hud.js
        appConfigViz.mutateAll((cfg) => { cfg.playbackSpeed = speed; });
        workflowConfig.save(); // core/config.js
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        workflowPlayerControls.applySpeedToActiveMedia(isVideoPlayerMode, isPhotoPlayerMode, speed); // event/workflow/player-controls.js
        HUD_SPEED_FOLLOW_UP_BY_MEDIA_TYPE[resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode)](); // core/playlist/render.js
        this.syncSpeedUI(speed);
        this._scheduleAutoHide(visualizerSpeedHud, SPEED_HUD_AUTO_HIDE_TASK);
    },

    _scheduleAutoHide(panelEl, taskName) {
        taskManager.once(() => hideHudPanel(panelEl), HUD_AUTO_HIDE_DELAY, taskName); // core/hud.js
    },
};
