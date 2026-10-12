/**
 * components/image-edit-modals.js — [MỚI 12/10/2026, plan-event-bus-wiring-07-10-2026 đợt 6a] Markup body các modal
 * nhỏ của trình sửa ảnh Photo (event/workflow/image-edit.js) — trước đây Workflow tự dựng chuỗi HTML (Workflow tự dựng
 * template HTML, Rule 5d: markup thuộc `render*()` ở components/).
 *
 * NẠP SAU: lang/lang.js (t). Lúc chạy: core/modal-choice-ui.js (escapeHtml).
 */

/** Body modal "Sửa nội dung" layer Text — 1 `<textarea>` (`#layer-edit-content-textarea`), Workflow đọc `.value` lúc
 * bấm Lưu. @param {string} text - nội dung hiện tại của layer */
function renderLayerEditContentModalBody(text) {
    return `<textarea id="layer-edit-content-textarea" rows="3" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900">${escapeHtml(text)}</textarea>`;
}
