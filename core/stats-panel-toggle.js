/**
 * core/stats-panel-toggle.js — Ẩn/hiện dải BPM/Pitch/Energy (#stats-panel, xem
 * visualizer-overlay.js). Toggle giờ là 1 checkbox trong Settings -> Tuỳ chỉnh Visualizer ->
 * Hiển thị Visualizer (KHÔNG còn nút riêng ở Control Center) — xem event/workflow/
 * visualizer-display.js::setStatsPanelEnabled().
 *
 * QUAN TRỌNG — chỉ TẠM DỪNG ghi DOM, KHÔNG tạm dừng tính toán: audio-analysis.js
 * (updateStatsDashboard(), chạy mỗi frame) đọc `isStatsPanelVisible` trước mỗi dòng ghi
 * statBpm/statNote/statEnergy.textContent, nhưng vẫn chạy trọn phần tính rubikPitchAvg/
 * currentCalculatedBpm dùng bởi visual Rubik — không phụ thuộc dải số liệu có hiện hay không.
 *
 * Lưu bền qua domain AppConfig 'player' (cùng Shuffle/Repeat) — xem
 * event/workflow/player-controls.js::_persistPlayerConfig()/loadPersistedPlayerConfigOnBoot().
 *
 * PHẢI nạp TRƯỚC audio-analysis.js. Cần dom-refs.js đã chạy (statsPanel/statBpm/statNote/statEnergy).
 */

/** Core thuần: đặt hẳn trạng thái hiện/ẩn dải BPM/Pitch/Energy + dọn số liệu cũ khi ẩn (tránh
 * nhấp nháy giá trị cũ nếu hiện lại trước khi audio-analysis.js kịp ghi giá trị mới).
 * @param {boolean} visible */
function setStatsPanelVisible(visible) {
    appState.set('isStatsPanelVisible', visible);
    console.log(`writer: "setStatsPanelVisible", page: "isStatsPanelVisible", content: "${visible}"`);
    if (typeof statsPanel !== 'undefined' && statsPanel) statsPanel.classList.toggle('hidden', !visible);
    if (!visible) {
        if (typeof statBpm !== 'undefined' && statBpm) statBpm.textContent = '---';
        if (typeof statNote !== 'undefined' && statNote) statNote.textContent = '---';
        if (typeof statEnergy !== 'undefined' && statEnergy) statEnergy.textContent = '0%';
    }
}
