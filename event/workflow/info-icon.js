/**
 * event/workflow/info-icon.js — Workflow của router "infoIcon": popover giải thích của icon (i) dùng chung
 * (core/info-icon-ui.js, template components/info-icon.js).
 */
const workflowInfoIcon = {
    /** 'infoIcon.click' — popover neo tại icon. Theme áp trước khi đo (padding/viền đổi kích thước).
     * @param {string} text @param {HTMLElement} anchorEl - icon (i) vừa bấm */
    show(text, anchorEl) {
        removeInfoPopover(); // core/info-icon-ui.js — popover cũ còn sót
        const handle = mountInfoPopover(renderInfoPopoverHtml(), text); // core/info-icon-ui.js + components/info-icon.js
        applyUiThemeToDom(handle.scrim, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
        placeInfoPopover(handle, anchorEl); // core/info-icon-ui.js
    },

    /** 'infoIcon.popover.close' — nút X hoặc bấm ra ngoài (scrim). */
    close() {
        removeInfoPopover(); // core/info-icon-ui.js
    },
};
