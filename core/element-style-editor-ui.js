/**
 * core/element-style-editor-ui.js — cập nhật tại chỗ phần tử của Generic Drawer "Element Style Editor" (ô màu đối ứng,
 * danh sách font khi gõ tìm, khung preview) — cùng khuôn core/custom-effect-drawer-ui.js. Gọi từ
 * workflowElementStyleEditor. Mỗi hàm 1 việc, không đọc appState, không gọi core khác. Phần tử không có -> bỏ qua.
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

/** Xoá toàn bộ inline style của khung preview trước khi sơn lại — applyElementStyleToDom() chỉ setProperty() từng
 * khai báo, không tự gỡ property vừa bị tắt. @param {HTMLElement} previewEl */
function clearEsePreviewStyle(previewEl) {
    if (!previewEl) return;
    previewEl.removeAttribute('style');
}
