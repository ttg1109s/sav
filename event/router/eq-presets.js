/**
 * event/router/eq-presets.js — Router tên "eqPresets".
 *
 * Nút #btn-cycle-eq: 3 case 'eqPresets.cyclePress.*' (start/end/cancel — pointerdown/pointerup/pointercancel+leave)
 * chỉ lo ĐẾM GIỜ giữ 1.5s; 'eqPresets.cycle.click' (sự kiện `click` DOM thật — xem docstring event/listener/eq-presets.js
 * lý do tách khỏi pointerup) mới chạy cyclePreset() (qua onCycleClick(), có chặn nếu vừa giữ đủ 1.5s).
 * Các case 'eqPresets.list.*' / 'eqPresets.edit.*' — nội dung Generic Drawer List/Edit (event/listener/eq-presets.js
 * ủy quyền).
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
            case 'eqPresets.list.page.change': // thanh phân trang của List (core/pagination-ui.js)
                workflowEqPresets.setListPage(msg.payload.pageIndex);
                break;
            // --- nội dung Drawer (event/listener/eq-presets.js ủy quyền) ---
            case 'eqPresets.list.close.click':
                workflowEqPresets.closeDrawer();
                break;
            case 'eqPresets.list.add.click':
                workflowEqPresets._createPresetWithDefaultName();
                break;
            case 'eqPresets.list.row.click':
                workflowEqPresets._openEditView(msg.payload.id);
                break;
            case 'eqPresets.edit.back.click':
                workflowEqPresets.openListView();
                break;
            case 'eqPresets.edit.apply.click':
                workflowEqPresets.onApplyClick(msg.payload.id);
                break;
            case 'eqPresets.edit.reset.click':
                workflowEqPresets._resetEditToDefault(msg.payload.id);
                break;
            case 'eqPresets.edit.name.input':
                workflowEqPresets.setDraftName(msg.payload.value);
                break;
            case 'eqPresets.edit.name.change':
                workflowEqPresets._commitName();
                break;
            case 'eqPresets.edit.band.input':
                workflowEqPresets._previewBandGain(msg.payload.index, msg.payload.raw);
                break;
            case 'eqPresets.edit.band.change':
                workflowEqPresets._commitGains();
                break;
            case 'eqPresets.edit.delete.click':
                workflowEqPresets._deletePreset(msg.payload.id);
                break;
            default:
                console.warn(`[routerEqPresets] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('eqPresets', routerEqPresets);
