/**
 * core/gameplay/game-panel-ui.js — ghi DOM của Game Panel (`#game-panel-list`, core/dom-refs.js): đổ HTML danh sách card
 * (components/game-panel.js::renderGamePanelListHtml()). Gọi từ event/workflow/game-catalog.js. Không đọc appState, không gọi
 * core khác.
 */

/** @param {HTMLElement} listEl - gamePanelList @param {string} html */
function setGamePanelListHtml(listEl, html) {
    listEl.innerHTML = html;
}
