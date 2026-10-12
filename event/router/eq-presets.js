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
 * SỬA (12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 1) — thêm các case 'eqPresets.list.*' / 'eqPresets.edit.*' cho
 * nội dung Generic Drawer (trước đây Workflow tự gắn sự kiện, bỏ qua Router) — mỗi case gọi ĐÚNG method mà callback cũ
 * của `_wireListView()`/`_wireEditView()` đã gọi.
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
            case 'eqPresets.list.page.change': // MỚI 23/09/2026 — thanh phân trang của List (core/pagination-ui.js)
                workflowEqPresets.setListPage(msg.payload.pageIndex);
                break;
            // --- MỚI 12/10/2026 — nội dung Drawer (event/listener/eq-presets.js ủy quyền) ---
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
