/**
 * Component: Bottom Player (thanh điều khiển phát nhạc ở dưới cùng) — components/app-mount.js chèn lúc khởi động.
 *
 * Bố cục 1 cột mọi khổ màn (assets/css/player-control.css, `.pc-layout`; màn rộng chỉ giới hạn bề ngang + căn giữa):
 *   [phụ đề — chỉ khi Settings > Theme > Player control chọn "Inside"] · tên media · thanh tiến trình ·
 *   giờ đang phát | nghệ sĩ (chỉ Song có) | tổng · Shuffle · Prev · Play · Next · Repeat.
 * Ảnh bìa (#record-container) nằm TRONG nút Play/Pause — hiện/ẩn theo `data-pc-cover` của `.pc-surface`; nốt nhạc bay
 * (core/visualizer/draw/flying-note-ui.js) cũng sinh từ đây. #pc-sub-slot là chỗ neo #subtitle-display khi chọn "Inside"
 * (core/player-control-style.js::dockSubtitleDisplay()).
 * Màu chữ/nút theo UI theme qua `data-uitk` (key `pc*`, core/ui-theme/*.js); bề mặt theo biến `--viz-*`. Shuffle/Repeat bật =
 * `aria-pressed="true"` (core/player-controls.js) — Shuffle đổi icon theo `aria-pressed` bằng CSS (`.pc-icon-on/off`).
 */
const TPL_BOTTOM_PLAYER = `
    <!-- z-40: dưới #playlist-view (z-60). #player-container lo vị trí/trượt (layout-nav.css); #player-panel là bề mặt có kiểu nền
         + độ đục theo Settings > Theme > Player control. -->
    <div id="player-container" class="fixed bottom-0 left-0 w-full z-40 pointer-events-auto flex flex-col hidden">
        <div id="player-panel" class="pc-surface group" data-pc-style="glass" data-pc-cover="on">
            <div class="pc-layout">
                <div id="pc-sub-slot" class="pc-sub-slot"></div>
                <h2 id="player-title" class="pc-title" data-uitk="pcText" data-i18n="bottomPlayer.noSongSelected">${t('bottomPlayer.noSongSelected')}</h2>

                <!-- step 0.001 = seek mịn tới ms; listener gửi thẳng e.target.value. Photo Player mode chỉ ẩn #progress-bar-row. -->
                <div id="progress-bar-row" class="pc-bar"><input type="range" id="progress-bar" value="0" step="0.001" min="0" class="music-slider block"></div>
                <div class="pc-meta-row">
                    <span id="current-time" class="pc-time pc-time-current" data-uitk="pcText">0:00</span>
                    <p id="player-artist" class="pc-artist" data-uitk="pcText"></p>
                    <span id="duration-time" class="pc-time pc-time-total" data-uitk="pcTextMuted">0:00</span>
                </div>

                <div class="pc-controls">
                    <button id="btn-shuffle" class="pc-toggle" aria-pressed="false" data-uitk="pcToggleBtn" data-i18n-title="bottomPlayer.btnShuffle.title" title="${t('bottomPlayer.btnShuffle.title')}">${iconSvg('switch-horizontal', 'pc-icon-off w-5 h-5')}${iconSvg('shuffle', 'pc-icon-on w-5 h-5')}</button>
                    <button id="btn-prev" class="pc-skip" data-uitk="pcIconBtn" data-i18n-title="bottomPlayer.btnPrev.title" title="${t('bottomPlayer.btnPrev.title')}">${iconSvg('rewind', 'w-6 h-6')}</button>
                    <button id="play-pause-btn" class="pc-play focus:outline-none" data-uitk="pcPlayBtn">
                        <div id="record-container" class="pc-play-art"></div>
                        ${iconSvg('play', 'pc-play-icon w-6 h-6 ml-0.5', 'id="icon-play"')}
                        ${iconSvg('pause', 'pc-play-icon w-6 h-6 hidden', 'id="icon-pause"')}
                    </button>
                    <button id="btn-next" class="pc-skip" data-uitk="pcIconBtn" data-i18n-title="bottomPlayer.btnNext.title" title="${t('bottomPlayer.btnNext.title')}">${iconSvg('fast-forward', 'w-6 h-6')}</button>
                    <button id="btn-repeat" class="pc-toggle" aria-pressed="false" data-uitk="pcToggleBtn" data-i18n-title="bottomPlayer.btnRepeat.title" title="${t('bottomPlayer.btnRepeat.title')}">${iconSvg('repeat', 'w-5 h-5')}</button>
                </div>
            </div>
        </div>
    </div>
`;

/** Ảnh bìa trong nút Play — dựng lại mỗi lần đổi media (Song / Video / Photo); `src`/`alt` là slot, ghi qua
 * core/record-art-ui.js::mountRecordArt(). Luôn quay (`animate-spin-slow`); play/pause chỉ bật/tắt `paused`.
 * @param {boolean} isPaused - media đang dừng lúc dựng @returns {string} */
function renderRecordArtHtml(isPaused) {
    return `<img id="record-art" src="" class="pc-play-cover animate-spin-slow${isPaused ? ' paused' : ''}" alt="">`;
}
