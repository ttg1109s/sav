/**
 * core/eq-presets-drawer-ui.js — cập nhật tại chỗ phần tử của Generic Drawer "Edit EQ" khi đang kéo slider (cùng khuôn
 * core/custom-effect-drawer-ui.js). Gọi từ event/workflow/eq-presets.js. Mỗi hàm 1 việc, chỉ thao tác trong `bodyEl`
 * nhận vào (genericDrawerBody), không đọc appState, không gọi core khác. Phần tử không có (Drawer đã đổi nội dung) ->
 * bỏ qua.
 */

/** Số dB hiển thị cạnh slider kênh thứ `index` (`#eq-edit-val-<index>`, components/eq-presets-drawer.js).
 * @param {HTMLElement} bodyEl @param {number} index @param {string} text */
function setEqBandValueText(bodyEl, index, text) {
    const el = bodyEl.querySelector(`#eq-edit-val-${index}`);
    if (!el) return;
    el.textContent = text;
}
