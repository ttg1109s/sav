/**
 * components/image-edit-modals.js — markup body các modal nhỏ của trình sửa ảnh Photo (event/workflow/image-edit.js).
 * Markup thuộc `render*()` ở components/ (Rule 5d), Workflow chỉ gọi hàm.
 *
 * NẠP SAU: lang/lang.js (t). Lúc chạy: core/modal-choice-ui.js (escapeHtml).
 */

/** Body modal "Sửa nội dung" layer Text — 1 `<textarea>` (`#layer-edit-content-textarea`), Workflow đọc `.value` lúc
 * bấm Lưu. @param {string} text - nội dung hiện tại của layer */
function renderLayerEditContentModalBody(text) {
    return `<textarea id="layer-edit-content-textarea" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900">${escapeHtml(text)}</textarea>`;
}
