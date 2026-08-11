/**
 * event/listener/eq-presets.js — TẤT CẢ listener của cụm "eqPresets".
 *
 * Chỉ 2 nút TĨNH (Control Center, components/visualizer-overlay.js). Nội dung ĐỘNG bên trong
 * Generic Drawer (list preset/sửa preset) do event/workflow/eq-presets.js tự wire trực tiếp —
 * KHÔNG qua eventBus, xem docstring đầu file đó.
 */
if (btnCycleEq) {
    btnCycleEq.addEventListener('click', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.cycle.click', payload: {} });
    });
}

if (btnEditEq) {
    btnEditEq.addEventListener('click', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.openDrawer.click', payload: {} });
    });
}
