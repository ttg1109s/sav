/**
 * core/statis-panel-ui.js — ghi DOM của panel Statistics (`#statis-panel-body`, core/dom-refs.js): đổ HTML nội dung
 * (components/statis-panel.js) và các khung đếm-lên số liệu. Gọi từ event/workflow/statis-panel.js. Không đọc appState,
 * không gọi core khác.
 */

/** @param {HTMLElement} bodyEl - statisPanelBody @param {string} html - renderStatisPanelSkeletonHtml()/renderStatisPanelBodyHtml() */
function setStatisPanelBodyHtml(bodyEl, html) {
    bodyEl.innerHTML = html;
}

/** Các phần tử cần đếm-lên vừa dựng (`[data-countup]`: số đích; `data-countup-fmt`: 'int' | 'time' | 'bar').
 * @param {HTMLElement} bodyEl @returns {Array<{el: HTMLElement, finalValue: number, fmt: string}>} */
function collectStatisCountupTargets(bodyEl) {
    return [...bodyEl.querySelectorAll('[data-countup]')].map((el) => ({ el, finalValue: Number(el.dataset.countup), fmt: el.dataset.countupFmt }));
}

/** Khung đếm-lên của 1 con số. @param {HTMLElement} el @param {string} text */
function setStatisCountupText(el, text) {
    el.textContent = text;
}

/** Khung đếm-lên của thanh tiến độ "Library played". @param {HTMLElement} el @param {number} percent */
function setStatisCountupBarWidth(el, percent) {
    el.style.width = `${percent}%`;
}
