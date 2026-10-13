/**
 * core/playlist/filter-rule-ui.js — ghi DOM tại chỗ cho các hàng rule filter đang hiện trong Generic Drawer (màn Edit preset
 * Filter + màn "Cài đặt filter" của folder; template components/playlist-filter-drawer.js, control mang `data-filter-*`).
 * Gọi từ workflowFilterRuleEdit (event/workflow/filter-rule-edit.js). Không đọc appState, không gọi core khác. Phần tử
 * không có -> bỏ qua.
 */

/** Ô bật/tắt + select toán tử + select mode của 1 hàng theo `rule` (null = field tắt: chỉ bỏ tick).
 * @param {HTMLElement} rowEl @param {object|null} rule */
function fillFilterRuleRowControls(rowEl, rule) {
    const enableEl = rowEl.querySelector('[data-filter-prop="enabled"]');
    if (enableEl) enableEl.checked = !!rule;
    if (!rule) return;
    const opEl = rowEl.querySelector('[data-filter-prop="op"]');
    if (opEl && rule.op !== undefined) opEl.value = rule.op;
    const modeEl = rowEl.querySelector('[data-filter-prop="mode"]');
    if (modeEl && rule.mode !== undefined) modeEl.value = rule.mode;
}

/** Ghi giá trị hiển thị lên 1 control: `prop` = 'textContent' (nút time picker) hoặc 'value' (`<input>`).
 * @param {HTMLElement|null} el @param {'textContent'|'value'} prop @param {string|number} text */
function setFilterRuleControlDisplay(el, prop, text) {
    if (!el) return;
    el[prop] = text;
}

/** Mờ + khoá thân hàng khi field tắt (checkbox nằm ngoài `data-filter-body` nên không bị khoá theo).
 * @param {HTMLElement|null} rowEl @param {boolean} enabled */
function setFilterRuleRowBodyEnabled(rowEl, enabled) {
    const bodyBlockEl = rowEl && rowEl.querySelector('[data-filter-body]');
    if (!bodyBlockEl) return;
    bodyBlockEl.classList.toggle('opacity-40', !enabled);
    bodyBlockEl.classList.toggle('pointer-events-none', !enabled);
}

/** Hiện khối single hoặc range theo mode. @param {HTMLElement|null} rowEl @param {string|undefined} mode */
function setFilterRuleRowMode(rowEl, mode) {
    if (!rowEl || mode === undefined) return;
    const rangeBlock = rowEl.querySelector('[data-filter-range-block]');
    const singleBlock = rowEl.querySelector('[data-filter-single-block]');
    if (!rangeBlock || !singleBlock) return;
    rangeBlock.classList.toggle('hidden', mode === 'single');
    singleBlock.classList.toggle('hidden', mode !== 'single');
}
