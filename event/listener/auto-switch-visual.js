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
 * Kéo thả item gắn ở workflowVisualizerDisplay.openAutoSwitchPanel() (cần pointer capture trên từng tay cầm).
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
    const btn = e.target.closest ? e.target.closest('[data-as-seconds]') : null;
    if (!btn || !genericDrawerBody.contains(btn)) return;
    eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.seconds.click', payload: { fieldName: btn.dataset.asSeconds } });
}

if (genericDrawerBody) { // SỬA (đợt migrate Visualizer Screen) — settingsStackBody nay thuộc Photo
    genericDrawerBody.addEventListener('change', handleAutoSwitchVisualDelegatedChange);
    genericDrawerBody.addEventListener('click', handleAutoSwitchVisualDelegatedClick);
}
