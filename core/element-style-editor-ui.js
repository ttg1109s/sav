/**
 * core/element-style-editor-ui.js — cập nhật tại chỗ phần tử của Generic Drawer "Element Style Editor" (ô màu đối ứng,
 * danh sách font khi gõ tìm) — cùng khuôn core/custom-effect-drawer-ui.js. Luồng: event/listener/element-style-editor.js
 * -> router 'elementStyleEditor' -> workflowElementStyleEditor -> các hàm dưới đây. Mỗi hàm 1 việc, không đọc appState,
 * không gọi core khác. Phần tử không có -> bỏ qua.
 */

/** Đồng bộ ô đối ứng của 1 cặp màu (ô chữ hex <-> color picker, `data-cross-target`). `targetId` rỗng (ô không thuộc
 * cặp màu) -> bỏ qua. @param {HTMLElement} bodyEl @param {string|null} targetId @param {string} value */
function setEseCrossTargetValue(bodyEl, targetId, value) {
    if (!targetId) return;
    const el = bodyEl.querySelector(`#${targetId}`);
    if (!el) return;
    el.value = value;
}

/** Thay danh sách font của màn con "Chọn Google Font" (lọc theo ô tìm kiếm — chỉ thay danh sách, KHÔNG vẽ lại cả màn
 * để ô tìm không mất focus). @param {HTMLElement} listEl @param {string} html */
function setEseFontPickerListHtml(listEl, html) {
    if (!listEl) return;
    listEl.innerHTML = html;
}
