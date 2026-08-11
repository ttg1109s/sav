/**
 * event/workflow/gesture-settings.js — "THẰNG THỰC THI CUỐI" của router "gestureSettings".
 *
 * setField(field, value) DÙNG CHUNG cho cả 6 dropdown action picker (4 hướng vuốt + 2 tap) LẪN
 * dropdown gestureEdgeBottomTarget LẪN 2 số Seek-hold (gestureSeekStepMs = Time 1 đơn vị nhảy /
 * gestureSeekHoldIntervalMs = Time 2 nhịp giữ để tua tiếp — TÁCH BIỆT HOÀN TOÀN, xem docstring
 * event/workflow/visualizer-gesture.js — ghi từ _openSeekTimePicker() bên dưới) — tất cả CÙNG
 * process: ghi 1 field vào vizConfig + saveConfig() (khác giá trị/field, không phải khác kịch bản
 * nghiệp vụ — xem readme/core-function-conventions.md, Rule 1 test). setToggle(field, checked)
 * tương tự cho 3 checkbox còn lại (vuốt cạnh trên/dưới, bật/tắt seek-hold — đều boolean).
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
        panelEl.querySelector('#gesture-seek-step-value').textContent = this._formatSeekMs(cfg.gestureSeekStepMs);
        panelEl.querySelector('#gesture-seek-hold-interval-value').textContent = this._formatSeekMs(cfg.gestureSeekHoldIntervalMs);
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
     * qua router) từ onConfirm của _openSeekTimePicker() bên dưới cho 2 số Seek-hold.
     * @param {string} field @param {string|number} value */
    setField(field, value) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = value; });
        console.log(`writer: "workflowGestureSettings.setField", page: "vizConfig.${field}", content: "${value}"`);
        saveConfig();
    },

    /** Ứng với 'gestureSettings.openSeekStepPicker.click' — Time 1: ĐƠN VỊ NHẢY mỗi lần seek. */
    openSeekStepPicker() {
        this._openSeekTimePicker('gestureSeekStepMs', 'gesture-seek-step-value', 'gestureSettings.seekStep.pickerTitle');
    },

    /** Ứng với 'gestureSettings.openSeekHoldIntervalPicker.click' — Time 2: SAU KHI đã vào seek
     * mode, giữ thêm bao lâu thì kích hoạt 1 lệnh seek theo Time 1 (KHÁC ngưỡng kích hoạt 2s CỐ
     * ĐỊNH — xem docstring event/workflow/visualizer-gesture.js). */
    openSeekHoldIntervalPicker() {
        this._openSeekTimePicker('gestureSeekHoldIntervalMs', 'gesture-seek-hold-interval-value', 'gestureSettings.seekHoldInterval.pickerTitle');
    },

    /** Dùng chung bởi 2 hàm trên — mở modal "bánh xe cuộn số" DÙNG CHUNG (core/time-picker-modal.js,
     * cùng khuôn workflowSubtitleEditor.openTimePickerModal()), format 's-ms' (giây + phần mười
     * giây) — min 500ms, max 59900ms (hết cỡ format này biểu diễn được, khớp yêu cầu "min 500ms,
     * max 59s:59...").
     * @param {string} field @param {string} valueElId - id span hiển thị giá trị trong panel.
     * @param {string} titleKey */
    _openSeekTimePicker(field, valueElId, titleKey) {
        const cfg = appConfigViz.getAll();
        openTimePickerModal({ // core/time-picker-modal.js — dùng chung
            title: t(titleKey),
            format: 's-ms',
            valueMs: cfg[field] || 2000,
            minMs: 500,
            maxMs: 59900,
            onConfirm: (resultMs) => {
                this.setField(field, resultMs);
                if (settingsStackBody) {
                    const el = settingsStackBody.querySelector(`#${valueElId}`);
                    if (el) el.textContent = this._formatSeekMs(resultMs);
                }
            },
        });
    },

    /** @param {number} ms @returns {string} vd "2.0s" — 1 số lẻ, đủ phân biệt bước 500ms/59900ms. */
    _formatSeekMs(ms) {
        return `${((ms || 0) / 1000).toFixed(1)}s`;
    },
};
