/**
 * event/listener/eq-presets.js — TẤT CẢ listener của cụm "eqPresets".
 *
 * 1 nút TĨNH (Control Center, components/visualizer-overlay.js) + nội dung ĐỘNG bên trong Generic Drawer (List/Edit).
 * SỬA (12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 1) — nội dung Drawer trước đây do event/workflow/eq-presets.js
 * tự querySelector + addEventListener sau mỗi lần vẽ (bỏ qua Listener -> Router và Block gate). Nay ủy quyền 1 lần
 * trên `genericDrawerBody`/`genericDrawerHeader` (khuôn event/listener/custom-effect.js): bảng tuyến
 * `match(target) -> send(el)`, Listener CHỈ đọc giá trị/dataset phần tử làm payload. Selector đều có tiền tố cụm
 * (`data-eq-*`, `#eq-drawer-*`, `#btn-eq-drawer-*`, `.eq-band-slider`) -> Drawer khác dùng chung body/header không
 * khớp tuyến nào, bỏ qua.
 *
 * SỬA (12/08/2026, Giang yêu cầu "gộp eq edit vào hold 3s, bỏ icon edit riêng") — #btn-edit-eq (2
 * listener 'click' cũ) ĐÃ BỎ HẲN cùng nút. #btn-cycle-eq giờ nghe THÊM `pointerdown`/`pointerup`/
 * `pointercancel`/`pointerleave` (Pointer Events — CÙNG khuôn event/listener/image-edit.js,
 * event/listener/video-preview.js đã dùng — 1 bộ event duy nhất cho CẢ chuột lẫn chạm) chỉ để ĐẾM
 * GIỜ giữ 1.5s — 4 listener này chỉ GỬI msg qua eventBus, KHÔNG tự đếm giờ ở đây (đếm giờ là việc
 * của `taskManager`, CHỈ Workflow được dùng — xem readme/task-manager-conventions.md mục 2).
 * `pointerleave` xử lý case ngón tay/chuột trượt ra khỏi nút TRƯỚC khi thả (huỷ hẹn giờ, không
 * cycle) — CÙNG tinh thần touchmove huỷ seek-hold ở event/listener/visualizer-gesture.js.
 *
 * VẪN GIỮ NGUYÊN listener `click` riêng (KHÔNG gộp vào `pointerup`) — lý do: nút này còn là 1
 * trong 8 (nay 7) target của hệ Tap-3-lần/Action-slot (GESTURE_TRIPLE_TAP_TARGET_ELS, event/
 * workflow/visualizer-gesture.js), cơ chế đó gọi THẲNG `targetEl.click()` để "bấm hộ" — 1 lệnh
 * `.click()` JS chỉ phát sinh đúng 1 sự kiện `click` DOM, KHÔNG kéo theo `pointerdown`/`pointerup`
 * nào cả, nên logic cycle THẬT SỰ phải nằm ở nhánh `click` (chạy được CẢ lúc người dùng bấm tay
 * thật LẪN lúc bị gesture bấm hộ) — nhánh pointerup chỉ lo huỷ hẹn giờ, không tự cycle (tránh cycle
 * 2 lần cho đúng 1 lần bấm tay thật: 1 lần từ pointerup THEO THIẾT KẾ CŨ + 1 lần từ click tự nhiên
 * ngay sau đó). Cờ `_cycleHoldFired` (event/workflow/eq-presets.js) chặn nhánh `click` KHÔNG chạy
 * thêm nếu vừa giữ đủ 1.5s xong (Drawer đã mở) — xem onCycleClick().
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

// ===================== Nội dung Generic Drawer (List / Edit) — MỚI 12/10/2026 =====================

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
