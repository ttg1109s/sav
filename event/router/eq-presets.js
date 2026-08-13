/**
 * event/router/eq-presets.js — Router tên "eqPresets".
 *
 * SỬA (12/08/2026, Giang yêu cầu "gộp eq edit vào hold 3s") — case 'eqPresets.openDrawer.click' cũ
 * (1 nút riêng #btn-edit-eq, ĐÃ BỎ) THAY bằng 3 case 'eqPresets.cyclePress.*' (start/end/cancel,
 * ứng pointerdown/pointerup/pointercancel+leave trên DUY NHẤT #btn-cycle-eq) chỉ lo ĐẾM GIỜ giữ —
 * 'eqPresets.cycle.click' (ứng sự kiện `click` DOM thật, GIỮ NGUYÊN — xem docstring event/
 * listener/eq-presets.js lý do không gộp vào pointerup) mới THẬT SỰ chạy cyclePreset() (qua
 * onCycleClick(), có chặn nếu vừa giữ đủ 1.5s) — xem event/workflow/eq-presets.js.
 *
 * NẠP SAU: event/bus.js, event/workflow/eq-presets.js.
 * NẠP TRƯỚC: event/listener/eq-presets.js.
 */
const routerEqPresets = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'eqPresets.cyclePress.start':
                workflowEqPresets.startCycleHold();
                break;
            case 'eqPresets.cyclePress.end':
                workflowEqPresets.endCycleHold();
                break;
            case 'eqPresets.cyclePress.cancel':
                workflowEqPresets.cancelCycleHold();
                break;
            case 'eqPresets.cycle.click':
                workflowEqPresets.onCycleClick();
                break;
            default:
                console.warn(`[routerEqPresets] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('eqPresets', routerEqPresets);
