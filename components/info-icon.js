/**
 * components/info-icon.js — template icon (i) dùng chung và popover giải thích của nó (core/info-icon-ui.js).
 *
 * NẠP SAU: core/ui-theme/icon-svg-ui.js (iconSvg). Dùng lúc runtime: escapeHtml() (core/modal-choice-ui.js).
 */

/** Nút (i) nhỏ, nhúng vào bất kỳ template nào; bấm vào do event/listener/info-icon.js bắt (ủy quyền trên body).
 * @param {string} text - văn bản thuần (tự escape vào `data-info-text`) @returns {string} */
function renderInfoIconHtml(text) {
    return `<button type="button" class="info-icon-btn inline-flex items-center justify-center h-[18px] w-[18px] rounded-full text-[10px] font-bold leading-none shrink-0" data-uitk="accentIconBoxBg accentIconBoxText" data-info-text="${escapeHtml(text)}">i</button>`;
}

/** Scrim trong suốt phủ màn (bấm = đóng) + card (chữ + nút X) + ô vuông mũi tên (anh em sau card, đè lên viền card).
 * Card ẩn (`visibility:hidden`) tới khi core đo xong và đặt vị trí. Chữ là slot `[data-info-popover-text]`. */
function renderInfoPopoverHtml() {
    return '<div id="info-popover-scrim" class="fixed inset-0">'
        + '<div data-info-popover-card role="status" class="fixed rounded-xl p-3 shadow-2xl flex items-start gap-2" data-uitk="modalCardBg modalCardBorder" style="left: 0px; top: 0px; visibility: hidden;">'
        + '<p data-info-popover-text class="text-sm leading-relaxed flex-1" data-uitk="modalBodyText"></p>'
        + `<button type="button" data-info-popover-close class="w-6 h-6 flex items-center justify-center rounded-full transition-colors shrink-0" data-uitk="headerCloseHover headerCloseIcon">${iconSvg('x', 'h-4 w-4')}</button>`
        + '</div>'
        // box-shadow none: theme kính có bóng — bóng của ô vuông xoay sẽ lộ ra ngoài tam giác
        + '<div data-info-popover-arrow class="fixed" data-uitk="modalCardBg modalCardBorder" style="box-shadow: none;"></div>'
        + '</div>';
}
