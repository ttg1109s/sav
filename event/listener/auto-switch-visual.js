/**
 * event/listener/auto-switch-visual.js — TẤT CẢ listener của cụm "autoSwitchVisual". Panel Auto-Switch vẽ lại từ model
 * mỗi khi đổi cấu trúc (components/settings/visualizer-auto-switch-drawer.js), mọi phần tử ĐỀU delegate trên
 * `genericDrawerBody`:
 *   - 'change': 5 select/toggle theo ID + checkbox item (data-as-check) + dropdown style của group (data-as-group-style).
 *   - 'click' : nút mở sub panel "Effect list" + nút mở time picker (data-as-seconds = tên field giây).
 *   - 'pointerdown'/'pointermove'/'pointerup'/'pointercancel': kéo thả item theo tay cầm `data-as-drag` (Workflow gọi
 *     setPointerCapture qua core -ui nên các pha sau tới đúng tay cầm rồi nổi bọt lên đây — không gắn lên `document`).
 * Payload mỗi loại khác nhau nên viết theo ID/attribute riêng thay vì 1 bảng tra chung.
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
    if (e.target.closest && e.target.closest('#btn-auto-switch-open-list')) { // sub panel "Effect list"
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

/** Mỗi pha kéo 1 msg.type; `pointerdown` chặn mặc định (không cuộn/bôi chữ).
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

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('change', handleAutoSwitchVisualDelegatedChange);
    genericDrawerBody.addEventListener('click', handleAutoSwitchVisualDelegatedClick);
    genericDrawerBody.addEventListener('pointerdown', handleAutoSwitchVisualDragPointerDown);
    genericDrawerBody.addEventListener('pointermove', handleAutoSwitchVisualDragPointerMove);
    genericDrawerBody.addEventListener('pointerup', handleAutoSwitchVisualDragPointerUp);
    genericDrawerBody.addEventListener('pointercancel', handleAutoSwitchVisualDragPointerCancel);
}
