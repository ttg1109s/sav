/**
 * event/listener/eq-presets.js — TẤT CẢ listener của cụm "eqPresets": 1 nút TĨNH (#btn-cycle-eq, Control Center) + nội
 * dung ĐỘNG bên trong Generic Drawer (List/Edit).
 *
 * #btn-cycle-eq nghe `pointerdown`/`pointerup`/`pointercancel`/`pointerleave` (1 bộ event cho cả chuột lẫn chạm) chỉ để
 * ĐẾM GIỜ giữ 1.5s — chỉ gửi msg, đếm giờ là việc của `taskManager` ở Workflow (readme/task-manager-conventions.md mục
 * 2). `pointerleave`: ngón tay/chuột trượt ra khỏi nút TRƯỚC khi thả -> huỷ hẹn giờ, không cycle.
 * Listener `click` riêng (KHÔNG gộp vào `pointerup`): nút này là 1 target của hệ Tap-3-lần/Action-slot
 * (GESTURE_TRIPLE_TAP_TARGET_ELS, event/workflow/visualizer-gesture.js) — cơ chế đó gọi `targetEl.click()`, chỉ phát
 * sinh `click` chứ không có pointer event, nên cycle THẬT nằm ở nhánh `click`; nhánh pointerup chỉ huỷ hẹn giờ (tránh
 * cycle 2 lần cho 1 lần bấm tay). Cờ `_cycleHoldFired` (Workflow) chặn `click` ngay sau khi vừa giữ đủ 1.5s.
 *
 * Nội dung Drawer: ủy quyền 1 lần trên `genericDrawerBody`/`genericDrawerHeader` (khuôn event/listener/custom-effect.js),
 * bảng tuyến `match(target) -> send(el)`, chỉ đọc giá trị/dataset phần tử làm payload. Selector có tiền tố cụm
 * (`data-eq-*`, `#eq-drawer-*`, `#btn-eq-drawer-*`, `.eq-band-slider`) -> Drawer khác dùng chung body/header bỏ qua.
 */
if (btnCycleEq) {
    btnCycleEq.addEventListener('pointerdown', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.cyclePress.start', payload: {} });
    });
    btnCycleEq.addEventListener('pointerup', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.cyclePress.end', payload: {} });
    });
    btnCycleEq.addEventListener('pointercancel', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.cyclePress.cancel', payload: {} });
    });
    btnCycleEq.addEventListener('pointerleave', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.cyclePress.cancel', payload: {} });
    });
    btnCycleEq.addEventListener('click', () => {
        eventBus.send({ router: 'eqPresets', type: 'eqPresets.cycle.click', payload: {} });
    });
}

// ===================== Nội dung Generic Drawer (List / Edit) =====================

const EQ_PRESETS_HEADER_CLICK_ROUTES = [
    { match: (t) => (t.closest ? t.closest('[data-eq-close]') : null), send: () => ['eqPresets.list.close.click', {}] },
    { match: (t) => (t.closest ? t.closest('#btn-eq-drawer-add') : null), send: () => ['eqPresets.list.add.click', {}] },
    { match: (t) => (t.closest ? t.closest('[data-eq-back]') : null), send: () => ['eqPresets.edit.back.click', {}] },
    { match: (t) => (t.closest ? t.closest('[data-eq-reset-id]') : null), send: (el) => ['eqPresets.edit.reset.click', { id: el.dataset.eqResetId }] },
];

const EQ_PRESETS_BODY_CLICK_ROUTES = [
    { match: (t) => (t.closest ? t.closest('[data-eq-id]') : null), send: (el) => ['eqPresets.list.row.click', { id: el.dataset.eqId }] },
    { match: (t) => (t.closest ? t.closest('[data-eq-apply-id]') : null), send: (el) => ['eqPresets.edit.apply.click', { id: el.dataset.eqApplyId }] },
    { match: (t) => (t.closest ? t.closest('[data-eq-delete-id]') : null), send: (el) => ['eqPresets.edit.delete.click', { id: el.dataset.eqDeleteId }] },
];

const EQ_PRESETS_BODY_INPUT_ROUTES = [
    { match: (t) => (t.id === 'eq-drawer-name' ? t : null), send: (el) => ['eqPresets.edit.name.input', { value: el.value }] },
    { match: (t) => (t.classList && t.classList.contains('eq-band-slider') ? t : null), send: (el) => ['eqPresets.edit.band.input', { index: el.dataset.index, raw: el.value }] },
];

const EQ_PRESETS_BODY_CHANGE_ROUTES = [
    { match: (t) => (t.id === 'eq-drawer-name' ? t : null), send: () => ['eqPresets.edit.name.change', {}] },
    { match: (t) => (t.classList && t.classList.contains('eq-band-slider') ? t : null), send: () => ['eqPresets.edit.band.change', {}] },
];

/** Tìm tuyến đầu tiên khớp phần tử bị tác động rồi chuyển thư cho Router 'eqPresets' (không khớp -> bỏ qua). */
function _eqDispatch(routes, e) {
    for (const route of routes) {
        const el = route.match(e.target);
        if (!el) continue;
        const [type, payload] = route.send(el);
        eventBus.send({ router: 'eqPresets', type, payload });
        return;
    }
}

if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => _eqDispatch(EQ_PRESETS_HEADER_CLICK_ROUTES, e));
}
if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', (e) => _eqDispatch(EQ_PRESETS_BODY_CLICK_ROUTES, e));
    genericDrawerBody.addEventListener('input', (e) => _eqDispatch(EQ_PRESETS_BODY_INPUT_ROUTES, e));
    genericDrawerBody.addEventListener('change', (e) => _eqDispatch(EQ_PRESETS_BODY_CHANGE_ROUTES, e));
}
