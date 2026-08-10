/**
 * core/visualizer-ui-chrome.js — Core thuần: ẩn/hiện cụm UI cố định trên màn Visualizer (thanh
 * phát nhạc dưới cùng + nút Playlist + nút mở Control Center) — "chế độ xem toàn màn hình",
 * Settings -> Tuỳ chỉnh Visualizer -> Hiển thị Visualizer.
 *
 * Dùng class RIÊNG `.force-hidden` (assets/css/style.css, !important) — KHÔNG dùng `.hidden`:
 * `#player-container` đang bị core/player-controls.js tự quản lý `.hidden` cho việc chuyển
 * Playlist<->Visualizer (switchToVisualizer()/forceBackToPlaylistUI()) — dùng chung sẽ đụng nhau
 * (vd chuyển sang Visualizer sẽ vô tình gỡ hidden dù đang bật chế độ toàn màn hình).
 */

/** @param {boolean} hidden */
function setPlayerUiHidden(hidden) {
    if (typeof playerContainer !== 'undefined' && playerContainer) playerContainer.classList.toggle('force-hidden', hidden);
    if (typeof btnBackPlaylist !== 'undefined' && btnBackPlaylist) btnBackPlaylist.classList.toggle('force-hidden', hidden);
    if (typeof btnOpenControlCenter !== 'undefined' && btnOpenControlCenter) btnOpenControlCenter.classList.toggle('force-hidden', hidden);
}
