/**
 * event/workflow/gesture-settings.js — "THẰNG THỰC THI CUỐI" của router "gestureSettings".
 *
 * 6 toggle đều là boolean đơn giản trong vizConfig — `setToggle(field, checked)` DÙNG CHUNG 1
 * method cho cả 6 (khác field, CÙNG process: ghi appConfigViz[field] + saveConfig(), không phải 6
 * "kịch bản nghiệp vụ" khác nhau — xem VirtualMachineState/Rule 1 test ở readme/core-function-
 * conventions.md). msg.type vẫn TÁCH RIÊNG cho từng toggle (đúng khuôn project, dễ trace log) —
 * chỉ gộp phần THỰC THI.
 */
const workflowGestureSettings = {

    /** Ứng với 'gestureSettings.openPanel.click'. */
    openPanel() {
        const panelEl = pushSettingsPanel({ title: t('gestureSettings.title'), bodyHtml: renderGestureSettingsPanelBody() });
        const cfg = appConfigViz.getAll();
        panelEl.querySelector('#setting-gesture-video-nav').checked = cfg.gestureVideoNavEnabled !== false;
        panelEl.querySelector('#setting-gesture-song-nav').checked = cfg.gestureSongNavEnabled !== false;
        panelEl.querySelector('#setting-gesture-tap-play-pause').checked = cfg.gestureTapPlayPauseEnabled !== false;
        panelEl.querySelector('#setting-gesture-double-tap-playlist').checked = cfg.gestureDoubleTapPlaylistEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-top').checked = cfg.gestureEdgeTopEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-bottom').checked = cfg.gestureEdgeBottomEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-bottom-target').value = cfg.gestureEdgeBottomTarget || 'cycleMode';
    },

    /** Ứng với 6 msg.type 'gestureSettings.*.change' (xem event/router/gesture-settings.js).
     * @param {string} field - tên field trong vizConfig (khớp core/config.js schema domain 'viz').
     * @param {boolean} checked */
    setToggle(field, checked) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = checked; });
        console.log(`writer: "workflowGestureSettings.setToggle", page: "vizConfig.${field}", content: "${checked}"`);
        saveConfig();
    },

    /** Ứng với 'gestureSettings.edgeBottomTarget.change'. @param {string} value */
    setEdgeBottomTarget(value) {
        appConfigViz.mutateAll((cfg) => { cfg.gestureEdgeBottomTarget = value; });
        console.log(`writer: "workflowGestureSettings.setEdgeBottomTarget", page: "vizConfig.gestureEdgeBottomTarget", content: "${value}"`);
        saveConfig();
    },
};
