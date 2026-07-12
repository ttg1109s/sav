/**
 * event/router/equalizer-settings.js — Router tên "equalizerSettings".
 *
 * Xử lý tương tác slider EQ (10 băng tần) qua delegation từ eqSlidersWrapper.
 * Chỉ có 1 msg.type duy nhất: 'equalizerSettings.band.input'.
 *
 * SỬA (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 16) — logic ĐÃ DỜI
 * sang `event/workflow/equalizer-settings.js` (MỚI). Câu "gọi thẳng — không cần workflow" ở bản cũ
 * SAI theo quy ước hiện hành: case này tự đọc `appState.get('eqBandNodes')` để chuẩn bị input cho
 * audio node — "chuẩn bị state cho Core" tự nó là Workflow (readme/event-bus-flow.md mục 4B), dù
 * chỉ có 1 msg.type, dù không có shield/modal.
 *
 * NẠP SAU: event/bus.js, event/workflow/equalizer-settings.js.
 * NẠP TRƯỚC: event/listener/equalizer-settings.js.
 */
const routerEqualizerSettings = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            case 'equalizerSettings.band.input': {
                workflowEqualizerSettings.applyBandInput(msg.payload);
                break;
            }

            default:
                console.warn(`[routerEqualizerSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('equalizerSettings', routerEqualizerSettings);
