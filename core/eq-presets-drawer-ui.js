/**
 * core/eq-presets-drawer-ui.js — [MỚI 12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 1] Cập nhật tại chỗ phần tử của
 * Generic Drawer "Edit EQ" khi đang kéo slider (cùng khuôn core/custom-effect-drawer-ui.js).
 *
 * Tách từ event/workflow/eq-presets.js::_previewBandGain() — trước đây Workflow tự `querySelector` + ghi `textContent`
 * (Workflow tự thao tác DOM). Mỗi hàm 1 việc, chỉ thao tác trong `bodyEl` nhận vào (genericDrawerBody), không đọc
 * appState, không gọi core khác. Phần tử không có (Drawer đã đổi nội dung) -> bỏ qua.
 */

/** Số dB hiển thị cạnh slider kênh thứ `index` (`#eq-edit-val-<index>`, components/eq-presets-drawer.js).
 * @param {HTMLElement} bodyEl @param {number} index @param {string} text */
function setEqBandValueText(bodyEl, index, text) {
    const el = bodyEl.querySelector(`#eq-edit-val-${index}`);
    if (!el) return;
    el.textContent = text;
}
