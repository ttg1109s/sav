/**
 * event/listener/auto-switch-visual.js — TẤT CẢ listener của cụm "autoSwitchVisual".
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * 6 input (enable/mode/timeMode/3 số giây) sống BÊN TRONG panel Visualizer Settings (cùng panel
 * với event/listener/visualizer-display.js, section "Tự động đổi hiệu ứng") — ĐỔI sang delegation
 * trên `settingsStackBody`, CHUẨN đã dùng từ Batch D2. Payload mỗi loại KHÁC NHAU đủ nhiều (cần
 * thêm phần tử phụ: optionsEl cho enable, 3 block cho timeMode) nên viết THEO ID riêng thay vì ép
 * vào 1 bảng tra chung như visualizer-display.js.
 */

/*
 * VIẾT LẠI (26/09/2026, Giang "cải tiến lại Auto-Switch Effect") — panel vẽ lại từ model mỗi khi đổi cấu trúc
 * (components/settings/visualizer-auto-switch-drawer.js), mọi phần tử ĐỀU delegate trên `genericDrawerBody`:
 *   - 'change': 5 select/toggle theo ID + checkbox item (data-as-check) + dropdown style của group (data-as-group-style).
 *   - 'click' : nút mở time picker (data-as-seconds = tên field giây).
 * Kéo thả item: SỬA (12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 4) — trước đây
 * workflowVisualizerDisplay.openAutoSwitchPanel() tự gắn 4 listener pointer lên từng tay cầm; nay delegate
 * 'pointerdown'/'pointermove'/'pointerup'/'pointercancel' ở cuối file (Workflow gọi setPointerCapture qua core -ui
 * nên các pha sau tới đúng tay cầm rồi nổi bọt lên đây).
 * Bỏ: 3 input số giây + 3 block ẩn/hiện theo timeMode (thay bằng time picker + vẽ lại panel).
 */

/** Danh sách đang hiện trên panel ('group' | 'style') — đọc thẳng dropdown, khỏi tra config. */
function _autoSwitchPanelListBy(panel) {
    const el = panel.querySelector('#setting-auto-switch-list-by');
    return el && el.value === 'group' ? 'group' : 'style';
}

function handleAutoSwitchVisualDelegatedChange(e) {
    const panel = genericDrawerBody;
    if (!panel) return;
    const target = e.target;

    if (target.dataset && target.dataset.asCheck) {
        eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.item.toggle', payload: { listBy: _autoSwitchPanelListBy(panel), key: target.dataset.asCheck, checked: target.checked } });
        return;
    }
    if (target.dataset && target.dataset.asGroupStyle) {
        eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.groupStyle.change', payload: { groupKey: target.dataset.asGroupStyle, style: target.value } });
        return;
    }

    switch (target.id) {
        case 'setting-auto-switch-enable':
            eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.enable.change', payload: { checked: target.checked } });
            break;
        case 'setting-auto-switch-list-by':
            eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.listBy.change', payload: { value: target.value } });
            break;
        case 'setting-auto-switch-mode':
            eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.mode.change', payload: { value: target.value } });
            break;
        case 'setting-auto-switch-time-mode':
            eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.timeMode.change', payload: { value: target.value } });
            break;
        case 'setting-auto-switch-fixed-kind':
            eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.fixedKind.change', payload: { value: target.value } });
            break;
    }
}

function handleAutoSwitchVisualDelegatedClick(e) {
    if (e.target.closest && e.target.closest('#btn-auto-switch-open-list')) { // MỚI 26/09/2026 — sub panel "Effect list"
        eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.openList.click', payload: {} });
        return;
    }
    const btn = e.target.closest ? e.target.closest('[data-as-seconds]') : null;
    if (!btn || !genericDrawerBody.contains(btn)) return;
    eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.seconds.click', payload: { fieldName: btn.dataset.asSeconds } });
}

/** Tay cầm kéo của 1 item (`data-as-drag` = khoá item, components/settings/visualizer-auto-switch-drawer.js). */
function _autoSwitchDragHandle(target) {
    return target.closest ? target.closest('[data-as-drag]') : null;
}

/** MỚI (12/10/2026) — mỗi pha kéo 1 msg.type; `pointerdown` chặn mặc định (không cuộn/bôi chữ) như bản gắn trực tiếp cũ.
 * listBy đọc thẳng dropdown của panel (cùng cách 'autoSwitchVisual.item.toggle'). */
function handleAutoSwitchVisualDragPointerDown(e) {
    const handle = _autoSwitchDragHandle(e.target);
    if (!handle) return;
    e.preventDefault();
    eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.drag.start', payload: { listBy: _autoSwitchPanelListBy(genericDrawerBody), key: handle.dataset.asDrag, clientY: e.clientY, handleEl: handle, pointerId: e.pointerId } });
}

function handleAutoSwitchVisualDragPointerMove(e) {
    if (!_autoSwitchDragHandle(e.target)) return;
    eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.drag.move', payload: { clientY: e.clientY } });
}

function handleAutoSwitchVisualDragPointerUp(e) {
    if (!_autoSwitchDragHandle(e.target)) return;
    eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.drag.end', payload: {} });
}

function handleAutoSwitchVisualDragPointerCancel(e) {
    if (!_autoSwitchDragHandle(e.target)) return;
    eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.drag.cancel', payload: {} });
}

if (genericDrawerBody) { // SỬA (đợt migrate Visualizer Screen) — settingsStackBody nay thuộc Photo
    genericDrawerBody.addEventListener('change', handleAutoSwitchVisualDelegatedChange);
    genericDrawerBody.addEventListener('click', handleAutoSwitchVisualDelegatedClick);
    genericDrawerBody.addEventListener('pointerdown', handleAutoSwitchVisualDragPointerDown); // MỚI 12/10/2026
    genericDrawerBody.addEventListener('pointermove', handleAutoSwitchVisualDragPointerMove);
    genericDrawerBody.addEventListener('pointerup', handleAutoSwitchVisualDragPointerUp);
    genericDrawerBody.addEventListener('pointercancel', handleAutoSwitchVisualDragPointerCancel);
}
