/**
 * event/listener/eq-presets.js — TẤT CẢ listener của cụm "eqPresets".
 *
 * Chỉ 1 nút TĨNH (Control Center, components/visualizer-overlay.js). Nội dung ĐỘNG bên trong
 * Generic Drawer (list preset/sửa preset) do event/workflow/eq-presets.js tự wire trực tiếp —
 * KHÔNG qua eventBus, xem docstring đầu file đó.
 *
 * SỬA (12/08/2026, Giang yêu cầu "gộp eq edit vào hold 3s, bỏ icon edit riêng") — #btn-edit-eq (2
 * listener 'click' cũ) ĐÃ BỎ HẲN cùng nút. #btn-cycle-eq giờ nghe THÊM `pointerdown`/`pointerup`/
 * `pointercancel`/`pointerleave` (Pointer Events — CÙNG khuôn event/listener/image-edit.js,
 * event/listener/video-preview.js đã dùng — 1 bộ event duy nhất cho CẢ chuột lẫn chạm) chỉ để ĐẾM
 * GIỜ giữ 3s — 4 listener này chỉ GỬI msg qua eventBus, KHÔNG tự đếm giờ ở đây (đếm giờ là việc
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
 * thêm nếu vừa giữ đủ 3s xong (Drawer đã mở) — xem onCycleClick().
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
