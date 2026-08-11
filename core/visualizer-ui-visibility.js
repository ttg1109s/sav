/**
 * core/visualizer-ui-visibility.js — GỘP core/stats-panel-toggle.js + core/visualizer-ui-chrome.js
 * (2 file cũ, đã xoá) thành 1 — Core thuần cho toàn bộ toggle ẩn/hiện thành phần UI trên màn
 * Visualizer, Settings -> Tuỳ chỉnh Visualizer -> Hiển thị Visualizer. 4 hàm ĐỘC LẬP, KHÔNG gọi
 * chéo nhau (Rule 3a — core không được gọi core khác dù cùng file) — trước đây "chế độ xem toàn
 * màn hình" là 1 toggle gộp ẩn cả 3 phần tử cùng lúc, giờ tách hẳn thành 3 toggle riêng, mỗi cái
 * gate qua 1 field boolean riêng trong vizConfig.
 *
 * 3/4 hàm dùng class RIÊNG `.force-hidden` (assets/css/style.css, !important) — KHÔNG dùng
 * `.hidden`: `#player-container` đang bị core/player-controls.js tự quản lý `.hidden` cho việc
 * chuyển Playlist<->Visualizer (switchToVisualizer()/forceBackToPlaylistUI()) — dùng chung sẽ đụng
 * nhau. `#stats-panel` không bị quản lý ở đâu khác nên dùng thẳng `.hidden` như cũ.
 *
 * QUAN TRỌNG (setStatsPanelVisible) — chỉ TẠM DỪNG ghi DOM, KHÔNG tạm dừng tính toán:
 * audio-analysis.js (updateStatsDashboard(), chạy mỗi frame) đọc `isStatsPanelVisible` trước mỗi
 * dòng ghi statBpm/statNote/statEnergy.textContent, nhưng vẫn chạy trọn phần tính toán dùng bởi
 * visual Rubik — không phụ thuộc dải số liệu có hiện hay không.
 */

/** Đặt hẳn trạng thái hiện/ẩn dải BPM/Pitch/Energy + dọn số liệu cũ khi ẩn (tránh nhấp nháy giá
 * trị cũ nếu hiện lại trước khi audio-analysis.js kịp ghi giá trị mới). Lưu bền qua domain
 * AppConfig 'player' (cùng Shuffle/Repeat) — xem event/workflow/player-controls.js.
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

/** @param {boolean} visible */
function setBottomPlayerVisible(visible) {
    if (typeof playerContainer !== 'undefined' && playerContainer) playerContainer.classList.toggle('force-hidden', !visible);
}

/** @param {boolean} visible */
function setPlaylistButtonVisible(visible) {
    if (typeof btnBackPlaylist !== 'undefined' && btnBackPlaylist) btnBackPlaylist.classList.toggle('force-hidden', !visible);
}

/** @param {boolean} visible */
function setControlCenterButtonVisible(visible) {
    if (typeof btnOpenControlCenter !== 'undefined' && btnOpenControlCenter) btnOpenControlCenter.classList.toggle('force-hidden', !visible);
}
