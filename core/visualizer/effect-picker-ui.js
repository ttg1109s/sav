/**
 * core/visualizer/effect-picker-ui.js — DOM của modal chọn effect (thân: components/settings/visualizer-display-panel.js
 * ::renderEffectPickerBodyHtml(); mở bằng modalChoice() ở event/workflow/visualizer-display.js::openEffectPicker()).
 */

/** Đổ lại dropdown style con sau khi đổi group. @param {HTMLSelectElement} styleSelectEl @param {string} optionsHtml */
function setEffectPickerStyleOptionsUi(styleSelectEl, optionsHtml) {
    styleSelectEl.innerHTML = optionsHtml;
}
