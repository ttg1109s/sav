/**
 * event/workflow/equalizer-settings.js — Workflow cụm "equalizerSettings".
 *
 * MỚI (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 16). Router TRƯỚC
 * ĐÂY tự đọc `appState.get('eqBandNodes')` rồi gọi thẳng audio node + `saveConfig()` — "chuẩn bị
 * state cho Core" tự nó là Workflow theo đúng quy ước hiện hành (readme/event-bus-flow.md mục 4B),
 * dù chỉ 1 msg.type, dù chỉ đọc đúng 1 key. Logic bên trong GIỮ NGUYÊN 100% so với bản cũ trong
 * router — chỉ đổi TẦNG chứa nó, không đổi hành vi.
 *
 * NẠP SAU: event/bus.js, core/config.js (vizConfig, saveConfig, eqBandNodes), core/dom-refs.js
 *           (eqSelect).
 * NẠP TRƯỚC: event/router/equalizer-settings.js.
 */
const workflowEqualizerSettings = {
    /** Ứng với 'equalizerSettings.band.input' — cập nhật 1 băng tần EQ (giá trị dB): đồng bộ số
     * hiển thị cạnh slider, ghi vào `vizConfig.manualEq` (tự chuyển `eqMode` sang 'manual' nếu
     * chưa đúng), áp thật lên audio node đang chạy (nếu đã khởi tạo), rồi lưu config.
     * @param {{index: number, value: number}} payload */
    applyBandInput({ index, value }) {
        const valEl = document.getElementById(`eq-val-${index}`);
        if (valEl) valEl.textContent = value > 0 ? `+${value}` : value;
        appConfigViz.mutateAll(cfg => {
            cfg.manualEq[index] = value;
            if (cfg.eqMode !== 'manual') {
                cfg.eqMode = 'manual';
                eqSelect.value = 'manual';
            }
        });
        const eqBandNodes = appState.get('eqBandNodes');
        if (eqBandNodes[index]) eqBandNodes[index].gain.value = value;
        saveConfig(); // core/config.js
    },
};
