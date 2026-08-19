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

/** Factory: tạo handler riêng cho 1 field cụ thể — mỗi input gửi đúng fieldName của NÓ. */
function makeAutoSwitchSecondsInputListener(fieldName) {
    return (e) => {
        eventBus.send({
            router: 'autoSwitchVisual',
            type: 'autoSwitchVisual.secondsField.change',
            payload: { fieldName, rawValue: e.target.value, inputEl: e.target }
        });
    };
}

function handleAutoSwitchVisualDelegatedChange(e) {
    // SỬA (đợt migrate Visualizer Screen) — panel Auto-Switch giờ sống thẳng trong genericDrawerBody
    // (KHÔNG còn bọc class `.settings-stack-panel` của pushSettingsPanel() cũ) — dùng THẲNG
    // genericDrawerBody thay vì .closest() dò lên.
    const panel = genericDrawerBody;
    if (!panel) return;

    switch (e.target.id) {
        case 'setting-auto-switch-enable':
            eventBus.send({
                router: 'autoSwitchVisual',
                type: 'autoSwitchVisual.enable.change',
                payload: { checked: e.target.checked, optionsEl: panel.querySelector('#auto-switch-options') }
            });
            break;

        case 'setting-auto-switch-mode':
            eventBus.send({ router: 'autoSwitchVisual', type: 'autoSwitchVisual.mode.change', payload: { value: e.target.value } });
            break;

        case 'setting-auto-switch-time-mode':
            eventBus.send({
                router: 'autoSwitchVisual',
                type: 'autoSwitchVisual.timeMode.change',
                payload: {
                    value: e.target.value,
                    blockFixedEl: panel.querySelector('#auto-switch-time-fixed-block'),
                    blockRandomEl: panel.querySelector('#auto-switch-time-random-block'),
                    blockDurationEl: panel.querySelector('#auto-switch-time-duration-block')
                }
            });
            break;

        case 'setting-auto-switch-seconds-fixed':
            makeAutoSwitchSecondsInputListener('autoSwitchVisualSecondsFixed')(e);
            break;

        case 'setting-auto-switch-seconds-random':
            makeAutoSwitchSecondsInputListener('autoSwitchVisualSecondsRandom')(e);
            break;

        case 'setting-auto-switch-seconds-duration':
            makeAutoSwitchSecondsInputListener('autoSwitchVisualSecondsDuration')(e);
            break;
    }
}

if (genericDrawerBody) { // SỬA (đợt migrate Visualizer Screen) — settingsStackBody nay thuộc Photo
    genericDrawerBody.addEventListener('change', handleAutoSwitchVisualDelegatedChange);
}
