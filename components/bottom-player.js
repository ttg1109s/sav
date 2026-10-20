/**
 * Component: Bottom Player (thanh điều khiển phát nhạc ở dưới cùng) — components/app-mount.js chèn lúc khởi động.
 *
 * Bố cục (assets/css/player-control.css, `.pc-layout`):
 *   - Màn hẹp (< 640px) — xếp 3 hàng kiểu màn "Now Playing" của app nghe nhạc di động: cover + tên/nghệ sĩ, thanh tiến trình
 *     (giờ đang phát / tổng 2 đầu), hàng điều khiển Shuffle · Prev · Play · Next · Repeat (Shuffle/Repeat ở 2 mép ngoài).
 *   - Màn rộng (≥ 640px) — 3 cột kiểu thanh phát nhạc desktop: cover + tên (trái), hàng điều khiển nằm trên thanh tiến trình có
 *     giờ 2 bên (giữa), cột phải để trống cho cân.
 * Màu chữ/nút theo UI theme qua `data-uitk` (key `pc*`, core/ui-theme/*.js); bề mặt (kiểu nền × độ đục) + track/thumb slider theo
 * biến CSS `--viz-*` (themeVars, assets/css/glass.css). `.pc-surface` mang class `group` cho variant
 * `group-data-[pc-style=none]:` của các key `pc*`. Shuffle/Repeat bật = `aria-pressed="true"` (core/player-controls.js).
 */
const TPL_BOTTOM_PLAYER = `
    <!-- z-40: dưới #playlist-view (z-60) -> Playlist trượt vào che kín ngay từ khung hình đầu. #player-container lo vị trí/trượt
         (layout-nav.css); #player-panel là bề mặt có kiểu nền + độ trong suốt theo Settings > Theme > Player control
         (assets/css/player-control.css, core/player-control-style.js). -->
    <div id="player-container" class="fixed bottom-0 left-0 w-full z-40 pointer-events-auto flex flex-col hidden">
        <div id="player-panel" class="pc-surface group" data-pc-style="gradient">
            <div class="pc-layout">
                <div class="pc-info">
                    <div class="relative shrink-0 pc-art" id="record-container">
                        <img id="record-art" src="" class="w-full h-full rounded-full object-cover shadow-lg relative z-20" alt="Record">
                    </div>
                    <div class="pc-meta">
                        <h2 id="player-title" class="pc-title" data-uitk="pcText" data-i18n="bottomPlayer.noSongSelected">${t('bottomPlayer.noSongSelected')}</h2>
                        <p id="player-artist" class="pc-artist" data-uitk="pcAccentText">---</p>
                    </div>
                </div>

                <!-- step 0.001 = seek mịn tới ms: range kẹp giá trị theo step cả khi kéo tay; listener gửi thẳng e.target.value, không
                     làm tròn. Photo Player mode chỉ ẩn #progress-bar-row, 2 ô giờ vẫn hiện. -->
                <div class="pc-progress-block">
                    <span id="current-time" class="pc-time pc-time-current" data-uitk="pcText">0:00</span>
                    <div id="progress-bar-row" class="pc-bar"><input type="range" id="progress-bar" value="0" step="0.001" min="0" class="music-slider block"></div>
                    <span id="duration-time" class="pc-time pc-time-total" data-uitk="pcTextMuted">0:00</span>
                </div>

                <div class="pc-controls">
                    <button id="btn-shuffle" class="pc-toggle" aria-pressed="false" data-uitk="pcToggleBtn" data-i18n-title="bottomPlayer.btnShuffle.title" title="${t('bottomPlayer.btnShuffle.title')}">${iconSvg('switch-horizontal', 'w-5 h-5')}</button>
                    <button id="btn-prev" class="pc-skip" data-uitk="pcIconBtn" data-i18n-title="bottomPlayer.btnPrev.title" title="${t('bottomPlayer.btnPrev.title')}">${iconSvg('rewind', 'w-6 h-6')}</button>
                    <button id="play-pause-btn" class="pc-play focus:outline-none" data-uitk="pcPlayBtn">
                        ${iconSvg('play', 'w-6 h-6 ml-0.5', 'id="icon-play"')}
                        ${iconSvg('pause', 'w-6 h-6 hidden', 'id="icon-pause"')}
                    </button>
                    <button id="btn-next" class="pc-skip" data-uitk="pcIconBtn" data-i18n-title="bottomPlayer.btnNext.title" title="${t('bottomPlayer.btnNext.title')}">${iconSvg('fast-forward', 'w-6 h-6')}</button>
                    <button id="btn-repeat" class="pc-toggle" aria-pressed="false" data-uitk="pcToggleBtn" data-i18n-title="bottomPlayer.btnRepeat.title" title="${t('bottomPlayer.btnRepeat.title')}">${iconSvg('repeat', 'w-5 h-5')}</button>
                </div>
            </div>
        </div>
    </div>
`;

/** #record-art dựng lại mỗi lần đổi media (Song / Video / Photo). `src`/`alt` là dữ liệu từng media — slot rỗng, ghi qua
 * core/record-art-ui.js::mountRecordArt(). Luôn mang `animate-spin-slow`; play/pause chỉ bật/tắt `paused` (dừng tại chỗ).
 * @param {boolean} isPaused - media đang dừng lúc dựng @returns {string} */
function renderRecordArtHtml(isPaused) {
    return `<img id="record-art" src="" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 animate-spin-slow${isPaused ? ' paused' : ''}" alt="">`;
}
