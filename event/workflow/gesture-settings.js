/**
 * event/workflow/gesture-settings.js — "THẰNG THỰC THI CUỐI" của router "gestureSettings".
 *
 * setField(field, value) DÙNG CHUNG cho cả 6 dropdown action picker (4 hướng vuốt + 2 tap) LẪN
 * dropdown gestureEdgeBottomTarget LẪN gestureSeekStepMs (số, ghi từ openSeekStepPicker()) — tất
 * cả CÙNG process: ghi 1 field vào vizConfig + saveConfig() (khác giá trị/field, không phải khác
 * kịch bản nghiệp vụ — xem readme/core-function-conventions.md, Rule 1 test). setToggle(field,
 * checked) tương tự cho 3 checkbox còn lại (vuốt cạnh trên/dưới, seek-hold — đều boolean).
 */
const workflowGestureSettings = {

    /** Ứng với 'gestureSettings.openPanel.click'. */
    openPanel() {
        const panelEl = pushSettingsPanel({ title: t('gestureSettings.title'), bodyHtml: renderGestureSettingsPanelBody() });
        const cfg = appConfigViz.getAll();
        panelEl.querySelector('#setting-gesture-action-swipe-up').value = cfg.gestureActionSwipeUp || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-down').value = cfg.gestureActionSwipeDown || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-left').value = cfg.gestureActionSwipeLeft || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-right').value = cfg.gestureActionSwipeRight || 'none';
        panelEl.querySelector('#setting-gesture-action-tap-single').value = cfg.gestureActionTapSingle || 'none';
        panelEl.querySelector('#setting-gesture-action-tap-double').value = cfg.gestureActionTapDouble || 'none';
        panelEl.querySelector('#setting-gesture-seek-hold-enable').checked = cfg.gestureSeekHoldEnabled !== false;
        panelEl.querySelector('#gesture-seek-step-value').textContent = this._formatSeekStepMs(cfg.gestureSeekStepMs);
        panelEl.querySelector('#setting-gesture-edge-top').checked = cfg.gestureEdgeTopEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-bottom').checked = cfg.gestureEdgeBottomEnabled !== false;
        panelEl.querySelector('#setting-gesture-edge-bottom-target').value = cfg.gestureEdgeBottomTarget || 'cycleMode';
    },

    /** Ứng với 3 msg.type 'gestureSettings.edgeTop/edgeBottom/seekHoldEnable.change'.
     * @param {string} field @param {boolean} checked */
    setToggle(field, checked) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = checked; });
        console.log(`writer: "workflowGestureSettings.setToggle", page: "vizConfig.${field}", content: "${checked}"`);
        saveConfig();
    },

    /** Ứng với 7 msg.type còn lại (6 action picker + edgeBottomTarget). Cũng gọi trực tiếp (không
     * qua router) từ onConfirm của openSeekStepPicker() bên dưới cho gestureSeekStepMs.
     * @param {string} field @param {string|number} value */
    setField(field, value) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = value; });
        console.log(`writer: "workflowGestureSettings.setField", page: "vizConfig.${field}", content: "${value}"`);
        saveConfig();
    },

    /** Ứng với 'gestureSettings.openSeekStepPicker.click' — mở modal "bánh xe cuộn số" DÙNG CHUNG
     * (core/time-picker-modal.js, cùng khuôn workflowSubtitleEditor.openTimePickerModal()) chọn
     * bước tua Seek-hold, format 's-ms' (giây + phần mười giây) — min 500ms, max 59s900ms (hết cỡ
     * format này biểu diễn được, khớp yêu cầu "min 500ms, max 59s:59..."). */
    openSeekStepPicker() {
        const cfg = appConfigViz.getAll();
        openTimePickerModal({ // core/time-picker-modal.js — dùng chung
            title: t('gestureSettings.seekStep.pickerTitle'),
            format: 's-ms',
            valueMs: cfg.gestureSeekStepMs || 2000,
            minMs: 500,
            maxMs: 59900,
            onConfirm: (resultMs) => {
                this.setField('gestureSeekStepMs', resultMs);
                if (settingsStackBody) {
                    const el = settingsStackBody.querySelector('#gesture-seek-step-value');
                    if (el) el.textContent = this._formatSeekStepMs(resultMs);
                }
            },
        });
    },

    /** @param {number} ms @returns {string} vd "2.0s" — 1 số lẻ, đủ phân biệt bước 500ms/59900ms. */
    _formatSeekStepMs(ms) {
        return `${((ms || 0) / 1000).toFixed(1)}s`;
    },
};
