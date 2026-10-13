/**
 * core/info-icon-ui.js — popover giải thích (toggletip) của icon (i) dùng chung. Template: components/info-icon.js
 * (`renderInfoIconHtml()`, `renderInfoPopoverHtml()`). Luồng: event/listener/info-icon.js -> router 'infoIcon' ->
 * workflowInfoIcon -> mountInfoPopover() -> (Workflow áp theme) -> placeInfoPopover().
 *
 * Vị trí kiểu Floating UI: ưu tiên nằm dưới icon, thiếu chỗ thì lật lên trên; trượt ngang để cách mép màn
 * `INFO_POPOVER_EDGE_PX`. Mũi tên = ô vuông xoay 45° cùng theme key card, `clip-path` cắt còn nửa tam giác nhô ra ngoài
 * (không chồng lên thân card — Morphin là kính trong suốt); đáy lấn vào card 1px để che viền; đỉnh thẳng tâm icon.
 * Popover bị kẹp dọc (màn quá thấp) -> ẩn mũi tên.
 *
 * Bấm ra ngoài: scrim trong suốt phủ màn — bấm vào là đóng và nuốt luôn cú bấm (bấm lại icon (i) cũng rơi vào scrim nên
 * tự thành toggle). Callback chỉ eventBus.send (Rule 5a).
 *
 * NẠP SAU: service/z-index.js (Z_INDEX), service/component-dynamic.js (instantiateComponent).
 */

const INFO_POPOVER_MAX_WIDTH_PX = 280;
const INFO_POPOVER_EDGE_PX = 8;        // khoảng cách tối thiểu tới mép màn hình
const INFO_POPOVER_ARROW_PX = 12;      // cạnh ô vuông mũi tên (trước khi xoay)
const INFO_POPOVER_TIP_GAP_PX = 2;     // khoảng cách đỉnh mũi tên <-> icon
// Phần mũi tên nhô ra khỏi card = nửa đường chéo trừ 1px lấn vào card (che viền).
const INFO_POPOVER_ARROW_OUT_PX = (INFO_POPOVER_ARROW_PX * Math.SQRT2) / 2 - 1;
const INFO_POPOVER_GAP_PX = INFO_POPOVER_ARROW_OUT_PX + INFO_POPOVER_TIP_GAP_PX; // khoảng cách card <-> icon
const INFO_POPOVER_ARROW_INSET_PX = 16; // mũi tên không sát góc bo của card (rounded-xl = 12px)
// clip-path nửa ô vuông nhô ra ngoài: xoay 45° thì góc trên-trái chỉ LÊN, góc dưới-phải chỉ XUỐNG.
const INFO_POPOVER_ARROW_CLIP_UP = 'polygon(0 0, 100% 0, 0 100%)';
const INFO_POPOVER_ARROW_CLIP_DOWN = 'polygon(100% 0, 100% 100%, 0 100%)';

/** Dựng popover (card còn ẩn, chưa đặt vị trí) từ template, gắn vào <body>.
 * @param {string} html - renderInfoPopoverHtml() @param {string} text - văn bản thuần (gán textContent)
 * @returns {{scrim: HTMLElement, popover: HTMLElement, arrow: HTMLElement}} */
function mountInfoPopover(html, text) {
    const fragment = instantiateComponent(html, { // service/component-dynamic.js
        text: { selector: '[data-info-popover-text]', prop: 'textContent', value: text },
    });
    const scrim = fragment.firstElementChild;
    const popover = scrim.querySelector('[data-info-popover-card]');
    const arrow = scrim.querySelector('[data-info-popover-arrow]');
    const closeBtn = scrim.querySelector('[data-info-popover-close]');
    scrim.style.zIndex = String(Z_INDEX.INFO_POPUP);
    popover.style.width = `${Math.min(INFO_POPOVER_MAX_WIDTH_PX, window.innerWidth - INFO_POPOVER_EDGE_PX * 2)}px`;
    arrow.style.width = `${INFO_POPOVER_ARROW_PX}px`;
    arrow.style.height = `${INFO_POPOVER_ARROW_PX}px`;
    document.body.appendChild(scrim);

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    closeBtn.addEventListener('click', () => eventBus.send({ router: 'infoIcon', type: 'infoIcon.popover.close', payload: {} }));
    scrim.addEventListener('click', (e) => {
        if (e.target !== scrim) return; // bấm trong card (chữ) thì giữ nguyên
        eventBus.send({ router: 'infoIcon', type: 'infoIcon.popover.close', payload: {} });
    });

    return { scrim, popover, arrow };
}

/** Đo card (theme đã áp — padding/viền đổi kích thước), đặt vị trí card + mũi tên neo tại `anchorEl`, rồi hiện.
 * @param {{popover: HTMLElement, arrow: HTMLElement}} handle @param {HTMLElement} anchorEl - icon (i) vừa bấm */
function placeInfoPopover(handle, anchorEl) {
    const { popover, arrow } = handle;
    const anchorRect = anchorEl.getBoundingClientRect();
    const popW = popover.offsetWidth, popH = popover.offsetHeight;
    const viewW = window.innerWidth, viewH = window.innerHeight;
    const belowTop = anchorRect.bottom + INFO_POPOVER_GAP_PX;
    const aboveTop = anchorRect.top - INFO_POPOVER_GAP_PX - popH;
    const placeAbove = belowTop + popH > viewH - INFO_POPOVER_EDGE_PX && aboveTop >= INFO_POPOVER_EDGE_PX;
    const rawTop = placeAbove ? aboveTop : belowTop;
    const top = Math.max(INFO_POPOVER_EDGE_PX, Math.min(rawTop, viewH - INFO_POPOVER_EDGE_PX - popH));
    const anchorCenterX = anchorRect.left + anchorRect.width / 2;
    const left = Math.max(INFO_POPOVER_EDGE_PX, Math.min(anchorCenterX - popW / 2, viewW - INFO_POPOVER_EDGE_PX - popW));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.transformOrigin = `${anchorCenterX - left}px ${placeAbove ? '100%' : '0%'}`; // phóng ra từ phía icon
    popover.style.visibility = '';

    // Mũi tên: tâm ô vuông nằm trên mép card (lấn vào 1px), x = tâm icon kẹp trong phần cạnh thẳng của card
    const arrowCenterX = Math.max(left + INFO_POPOVER_ARROW_INSET_PX, Math.min(anchorCenterX, left + popW - INFO_POPOVER_ARROW_INSET_PX));
    const arrowCenterY = placeAbove ? top + popH - 1 : top + 1;
    arrow.style.left = `${arrowCenterX - INFO_POPOVER_ARROW_PX / 2}px`;
    arrow.style.top = `${arrowCenterY - INFO_POPOVER_ARROW_PX / 2}px`;
    arrow.style.transform = 'rotate(45deg)';
    arrow.style.clipPath = placeAbove ? INFO_POPOVER_ARROW_CLIP_DOWN : INFO_POPOVER_ARROW_CLIP_UP;
    arrow.style.webkitClipPath = arrow.style.clipPath;
    arrow.style.display = top === rawTop ? '' : 'none'; // bị kẹp dọc -> đỉnh không còn chỉ đúng icon

    if (typeof popover.animate === 'function') {
        popover.animate([{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' });
        arrow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    }
}

/** Gỡ popover đang mở (nếu có) — listener đi theo phần tử. */
function removeInfoPopover() {
    const scrim = document.getElementById('info-popover-scrim');
    if (scrim) scrim.remove();
}
