/**
 * event/workflow/volume-hud.js — Workflow cụm "volumeHud" (#visualizer-volume-hud, components/
 * visualizer-overlay.js) — panel nổi kiểu popup volume hệ thống iOS, mở bằng #btn-open-volume.
 *
 * FIX (12/08/2026, Giang báo "ấn icon Volume không hiện lên") — file NÀY từng RỖNG hoàn toàn: router
 * (event/router/volume-hud.js) đã gọi `workflowVolumeHud.open()`/`handleSliderInput()` từ trước
 * nhưng chưa ai định nghĩa `workflowVolumeHud` — bấm nút không có gì xảy ra (không lỗi console vì
 * chưa từng chạy tới core/dom nào).
 *
 * `open()`: đồng bộ slider + icon loa (core/volume-hud.js::syncVolumeHudIcon()) theo âm lượng hiện
 * tại (appConfigViz.volume) rồi hiện panel — LUÔN gọi lại được dù panel đang mở (bấm lại nút Volume
 * lúc đang mở chỉ reset lại đồng hồ tự ẩn, không có gì để "chuyển mode" như Generic Drawer).
 *
 * `handleSliderInput()`: gửi tiếp `visualizerDisplay.volume.input` (đã có sẵn case xử lý ở
 * event/router/visualizer-display.js, gọi thẳng `setVolume()` core) — Workflow này KHÔNG tự gọi
 * `setVolume()` (core/visualizer/visualizer-display.js) thẳng để giữ ĐÚNG 1 cửa duy nhất chỉnh
 * volume dù bấm từ HUD hay bất kỳ nơi nào khác sau này, khớp comment đã ghi sẵn ở router đó
 * ("Control Center HUD, event/workflow/volume-hud.js gửi tới").
 *
 * Tự ẩn sau `VOLUME_HUD_AUTO_HIDE_DELAY` ms không thao tác (taskManager.once() cùng tên task — gọi
 * lại tự huỷ hẹn giờ cũ + đặt lại từ đầu, đúng hành vi debounce, xem docstring service/task-manager.js
 * mục B) — reset lại mỗi lần mở HOẶC kéo slider.
 *
 * NẠP SAU: core/volume-hud.js (syncVolumeHudIcon), core/dom-refs.js (visualizerVolumeHud/
 * volumeHudSlider), service/task-manager.js (taskManager), service/state/... (appConfigViz),
 * event/bus.js.
 * NẠP TRƯỚC: event/router/volume-hud.js.
 */
const VOLUME_HUD_AUTO_HIDE_TASK = 'volumeHudAutoHide';
const VOLUME_HUD_AUTO_HIDE_DELAY = 2500;

const workflowVolumeHud = {
    /** Ứng với 'volumeHud.open.click' (#btn-open-volume). */
    open() {
        const volume = appConfigViz.getAll().volume;
        volumeHudSlider.value = volume;
        syncVolumeHudIcon(volume); // core/volume-hud.js
        visualizerVolumeHud.classList.remove('hidden');
        this._scheduleAutoHide();
    },

    /** Ứng với 'volumeHud.slider.input' (#volume-hud-slider). @param {string} value */
    handleSliderInput(value) {
        eventBus.send({ router: 'visualizerDisplay', type: 'visualizerDisplay.volume.input', payload: { value } });
        this._scheduleAutoHide();
    },

    _scheduleAutoHide() {
        taskManager.once(() => visualizerVolumeHud.classList.add('hidden'), VOLUME_HUD_AUTO_HIDE_DELAY, VOLUME_HUD_AUTO_HIDE_TASK);
    },
};
