/**
 * core/custom-effect-drawer-ui.js — [MỚI 28/09/2026] Cập nhật tại chỗ các phần tử của Custom Effect Drawer sau khi
 * người dùng đổi 1 giá trị (ẩn/hiện hàng theo color mode/blur, số hiển thị cạnh slider, ô màu đối ứng).
 *
 * Tách từ event/workflow/custom-effect.js — trước đây Workflow tự `querySelector` + `addEventListener` từng phần tử
 * sau mỗi lần vẽ Drawer và tự sửa DOM ngay trong callback (bỏ qua Listener -> Router). Nay: listener ủy quyền
 * (event/listener/custom-effect.js) -> router 'customEffect' -> workflowCustomEffect -> các hàm dưới đây.
 * Mỗi hàm 1 việc, chỉ thao tác trong `bodyEl` nhận vào (genericDrawerBody), không đọc appState, không gọi core khác.
 * Phần tử không có (Drawer đã đổi nội dung) -> bỏ qua.
 */

/** Hàng chọn màu solid / 2 màu dynamic / bảng 7 màu gradient chỉ hiện theo đúng mode đang chọn. */
function syncCustomEffectColorModeRows(bodyEl, mode) {
    const rows = [['#ce-solid-color-row', 'solid'], ['#ce-dynamic-color-row', 'dynamic'], ['#ce-gradient-palette-row', 'gradient']];
    rows.forEach(([selector, rowMode]) => {
        const row = bodyEl.querySelector(selector);
        if (!row) return;
        row.classList.toggle('hidden', mode !== rowMode);
        row.classList.toggle('flex', mode === rowMode);
    });
}

/** Bảng 7 màu vừa được tuỳ chỉnh: bật nút Reset + đổi dòng trạng thái. @param {HTMLElement} bodyEl @param {string} statusText */
function markCustomEffectGradientPaletteCustom(bodyEl, statusText) {
    const resetBtn = bodyEl.querySelector('#ce-gradient-palette-reset');
    if (resetBtn) { resetBtn.disabled = false; resetBtn.classList.remove('opacity-40'); }
    const statusEl = bodyEl.querySelector('#ce-gradient-palette-status');
    if (statusEl) statusEl.textContent = statusText;
}

/** Hàng slider cường độ blur chỉ hiện khi bật blur. */
function syncCustomEffectBlurRow(bodyEl, enabled) {
    const row = bodyEl.querySelector('#ce-blur-intensity-row');
    if (!row) return;
    row.classList.toggle('hidden', !enabled);
    row.classList.toggle('flex', enabled);
}

/** Ghi giá trị cho 1 ô input theo id (ô màu solid đối ứng: picker <-> ô chữ hex). */
function setCustomEffectInputValueById(bodyEl, id, value) {
    const el = bodyEl.querySelector(`#${id}`);
    if (!el) return;
    el.value = value;
}

/** Ghi chữ cho 1 phần tử theo id (vd số % cạnh slider blur). */
function setCustomEffectTextById(bodyEl, id, text) {
    const el = bodyEl.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = text;
}

/** Số hiển thị cạnh slider của 1 field thường (`.ce-field-val[data-field-val="<field>"]`). */
function setCustomEffectFieldValueText(bodyEl, field, text) {
    const el = bodyEl.querySelector(`.ce-field-val[data-field-val="${field}"]`);
    if (!el) return;
    el.textContent = text;
}

/** Số hiển thị cạnh 1 slider của đèn thứ `index` (Rain street) — `unitKey` = 'x' | 'height' | 'flare'. */
function setCustomEffectLampValueText(bodyEl, index, unitKey, text) {
    const el = bodyEl.querySelector(`.ce-lamp-row[data-lamp-index="${index}"] .ce-lamp-val[data-lamp-val="${unitKey}"]`);
    if (!el) return;
    el.textContent = text;
}
