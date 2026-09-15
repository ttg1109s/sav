/**
 * event/workflow/gesture-settings.js — "THẰNG THỰC THI CUỐI" của router "gestureSettings".
 *
 * setField(field, value) DÙNG CHUNG cho cả 7 dropdown action picker (4 hướng vuốt + 2 tap + tap 3
 * lần — SỬA 12/08/2026, Giang yêu cầu "tap 3 dùng chung select giống tap/cử chỉ khác": tripleTapTarget
 * giờ CÙNG LOẠI với 6 cái kia, không còn tách riêng) LẪN 2 số Seek-hold (gestureSeekStepMs = Time 1
 * đơn vị nhảy / gestureSeekHoldIntervalMs = Time 2 nhịp giữ để tua tiếp — TÁCH BIỆT HOÀN TOÀN, xem
 * docstring event/workflow/visualizer-gesture.js — ghi từ _openSeekTimePicker() bên dưới) — tất cả
 * CÙNG process: ghi 1 field vào vizConfig + saveConfig() (khác giá trị/field, không phải khác kịch
 * bản nghiệp vụ — xem readme/core-function-conventions.md, Rule 1 test). setToggle(field, checked)
 * tương tự cho 2 checkbox còn lại (vuốt cạnh trên, bật/tắt seek-hold — đều boolean; tap 3 lần
 * KHÔNG phải checkbox — SỬA lại chú thích cũ ghi nhầm 3 checkbox, xem GESTURE_SETTINGS_INPUT_MAP,
 * event/listener/gesture-settings.js — nó là 1 dropdown select, đi qua setField() ở trên).
 */
const workflowGestureSettings = {

    /** Ứng với 'gestureSettings.openPanel.click'. SỬA (đợt tái cấu trúc bottom nav + phân phối lại
     * Settings) — KHÔNG còn `pushSettingsPanel()` (Settings không còn sống trong `#drawer-settings`
     * cũ) — bodyHtml giờ do event/workflow/app-settings.js cung cấp SẴN qua `navigateTo()` TRƯỚC
     * khi gọi hàm này (Generic Drawer đã hiện `renderGestureSettingsPanelBody()`) — hàm này CHỈ
     * còn đồng bộ giá trị vào `genericDrawerBody` (core/generic-drawer.js, LUÔN có sẵn). */
    openPanel() {
        const panelEl = genericDrawerBody;
        const cfg = appConfigViz.getAll();
        panelEl.querySelector('#setting-gesture-action-swipe-up').value = cfg.gestureActionSwipeUp || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-down').value = cfg.gestureActionSwipeDown || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-left').value = cfg.gestureActionSwipeLeft || 'none';
        panelEl.querySelector('#setting-gesture-action-swipe-right').value = cfg.gestureActionSwipeRight || 'none';
        panelEl.querySelector('#setting-gesture-action-tap-single').value = cfg.gestureActionTapSingle || 'none';
        panelEl.querySelector('#setting-gesture-action-tap-double').value = cfg.gestureActionTapDouble || 'none';
        panelEl.querySelector('#setting-gesture-triple-tap-target').value = cfg.gestureTripleTapTarget || 'none';
        // MỚI (12/08/2026, Giang yêu cầu — "Action")
        panelEl.querySelector('#setting-gesture-action-slot-1').value = cfg.gestureActionSlot1 || 'none';
        panelEl.querySelector('#setting-gesture-action-slot-2').value = cfg.gestureActionSlot2 || 'none';
        panelEl.querySelector('#setting-gesture-action-slot-3').value = cfg.gestureActionSlot3 || 'none';
        panelEl.querySelector('#setting-gesture-seek-hold-enable').checked = cfg.gestureSeekHoldEnabled !== false;
        panelEl.querySelector('#gesture-seek-step-value').textContent = this._formatSeekMs(cfg.gestureSeekStepMs);
        panelEl.querySelector('#gesture-seek-hold-interval-value').textContent = this._formatSeekMs(cfg.gestureSeekHoldIntervalMs);
        panelEl.querySelector('#setting-gesture-edge-top').checked = cfg.gestureEdgeTopEnabled !== false;
    },

    /** Ứng với 3 msg.type 'gestureSettings.edgeTop/tripleTapEnable/seekHoldEnable.change'.
     * @param {string} field @param {boolean} checked */
    setToggle(field, checked) {
        appConfigViz.mutateAll((cfg) => { cfg[field] = checked; });
        console.log(`writer: "workflowGestureSettings.setToggle", page: "vizConfig.${field}", content: "${checked}"`);
        saveConfig();
    },

    /** Ứng với 7 msg.type còn lại (7 action picker — 4 vuốt + 2 tap + tap-3-lần, SỬA 12/08/2026:
     * tripleTapTarget giờ CÙNG LOẠI với 6 cái kia, không còn tách riêng). Cũng gọi trực tiếp (không
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
     * ĐỊNH — xem docstring event/workflow/visualizer-gesture.js). min dùng ĐÚNG mặc định 100ms của
     * _openSeekTimePicker() (SỬA — trước đây truyền riêng qua tham số thứ 4, giờ Time 1 CŨNG đã hạ
     * xuống 100ms nên không còn cần truyền khác Time 1 nữa, xem docstring _openSeekTimePicker()). */
    openSeekHoldIntervalPicker() {
        this._openSeekTimePicker('gestureSeekHoldIntervalMs', 'gesture-seek-hold-interval-value', 'gestureSettings.seekHoldInterval.pickerTitle');
    },

    /** Dùng chung bởi 2 hàm trên — mở modal "bánh xe cuộn số" DÙNG CHUNG (core/time-picker-modal.js,
     * cùng khuôn workflowSubtitleEditor.openTimePickerModal()), format 's-ms' (giây + phần mười
     * giây) — max 59900ms cả 2 (hết cỡ format này biểu diễn được). SỬA (phản hồi Giang — "giới hạn
     * lại min của cả hai là 0.1") — min CHUNG 100ms (0.1s) cho CẢ Time 1 lẫn Time 2 (trước đây Time 1
     * min 500ms, Time 2 min 100ms riêng qua tham số thứ 4 — giờ cả 2 CÙNG 100ms nên bỏ hẳn tham số
     * đó, không còn khác biệt giữa 2 picker nữa).
     * @param {string} field @param {string} valueElId - id span hiển thị giá trị trong panel.
     * @param {string} titleKey */
    _openSeekTimePicker(field, valueElId, titleKey) {
        const cfg = appConfigViz.getAll();
        openTimePickerModal({ // core/time-picker-modal.js — dùng chung
            title: t(titleKey),
            format: 's-ms',
            valueMs: cfg[field] || 2000,
            minMs: 100,
            maxMs: 59900,
            onConfirm: (resultMs) => {
                this.setField(field, resultMs);
                // FIX BUG (phản hồi Giang — "UI giá trị Seek step, Hold time per step không cập nhật
                // theo") — `settingsStackBody` là tham chiếu CŨ từ trước đợt tái cấu trúc bottom nav
                // (Gesture Settings giờ sống trong Generic Drawer, `#settings-stack-body` KHÔNG còn
                // tồn tại trong index.html nữa) — CÙNG lớp bug đã fix ở `viewModeSelect`/
                // `updateActiveFolderUI()` (dom-refs.js tham chiếu "chết" sau khi nội dung migrate
                // sang Generic Drawer). Đổi sang `genericDrawerBody` — ĐÚNG container panel này đang
                // sống trong (khớp `openPanel()` ngay trên, đã dùng đúng `genericDrawerBody`).
                if (genericDrawerBody) {
                    const el = genericDrawerBody.querySelector(`#${valueElId}`);
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
