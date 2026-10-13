/**
 * event/workflow/gesture-settings.js — Workflow của router "gestureSettings".
 *
 * setField(field, value) dùng chung cho 7 action picker (4 vuốt + tap/double tap/tap 3 lần), 3 ô Action và 2 số
 * Seek-hold (gestureSeekStepMs = Time 1 đơn vị nhảy / gestureSeekHoldIntervalMs = Time 2 nhịp giữ để tua tiếp, xem
 * event/workflow/visualizer-gesture.js); setToggle(field, checked) cho 2 checkbox (vuốt cạnh trên, bật/tắt seek-hold).
 * Cả hai cùng 1 tiến trình: ghi 1 field vizConfig + saveConfig().
 *
 * NẠP SAU: core/gesture-settings-ui.js, core/time-picker-modal.js.
 */
const workflowGestureSettings = {

    /** 'gestureSettings.openPanel.click' — body đã do workflowAppSettings.navigateTo() vẽ sẵn
     * (renderGestureSettingsPanelBody()); ở đây chỉ đồng bộ giá trị. */
    openPanel() {
        this._syncPanelValues();
    },

    /** 'gestureSettings.edgeTop/seekHoldEnable.change' @param {string} field @param {boolean} checked */
    setToggle(field, checked) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = checked; });
        console.log(`writer: "workflowGestureSettings.setToggle", page: "vizConfig.${field}", content: "${checked}"`);
        saveConfig();
    },

    /** 10 msg.type select của panel; và onConfirm của _openSeekTimePicker() cho 2 số Seek-hold.
     * @param {string} field @param {string|number} value */
    setField(field, value) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = value; });
        console.log(`writer: "workflowGestureSettings.setField", page: "vizConfig.${field}", content: "${value}"`);
        saveConfig();
    },

    /** 'gestureSettings.openSeekStepPicker.click' — Time 1: đơn vị nhảy mỗi lần seek. */
    openSeekStepPicker() {
        this._openSeekTimePicker('gestureSeekStepMs', 'gestureSettings.seekStep.pickerTitle');
    },

    /** 'gestureSettings.openSeekHoldIntervalPicker.click' — Time 2: đã vào seek mode, giữ thêm bao lâu thì seek tiếp 1
     * bước Time 1 (khác ngưỡng kích hoạt 2s cố định, xem event/workflow/visualizer-gesture.js). */
    openSeekHoldIntervalPicker() {
        this._openSeekTimePicker('gestureSeekHoldIntervalMs', 'gestureSettings.seekHoldInterval.pickerTitle');
    },

    /** Modal bánh xe cuộn số dùng chung (core/time-picker-modal.js), format 's-ms', 100–59900 ms cho cả 2 số. Xác nhận ->
     * ghi field rồi đồng bộ lại panel (nhãn giá trị hiện đúng số mới).
     * @param {string} field @param {string} titleKey */
    _openSeekTimePicker(field, titleKey) {
        const cfg = appConfigViz.getAll();
        openTimePickerModal({ // core/time-picker-modal.js
            title: t(titleKey),
            format: 's-ms',
            valueMs: cfg[field] || 2000,
            minMs: 100,
            maxMs: 59900,
            onConfirm: (resultMs) => {
                this.setField(field, resultMs);
                this._syncPanelValues();
            },
        });
    },

    /** Ghi giá trị vizConfig hiện tại vào panel (genericDrawerBody, core/dom-refs.js). */
    _syncPanelValues() {
        fillGestureSettingsPanel(genericDrawerBody, appConfigViz.getAll()); // core/gesture-settings-ui.js
    },
};
