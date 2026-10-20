/**
 * Component: Bottom Player (thanh điều khiển phát nhạc ở dưới cùng) — components/app-mount.js chèn lúc khởi động.
 * Giao diện: assets/css/player-control.css (bề mặt, bố cục) + assets/css/sliders.css (.music-slider).
 */
const TPL_BOTTOM_PLAYER = `
    <!-- z-40: dưới #playlist-view (z-60) -> Playlist trượt vào che kín ngay từ khung hình đầu. #player-container lo vị trí/trượt
         (layout-nav.css); #player-panel là bề mặt có kiểu nền + độ trong suốt theo Settings > Theme > Player control
         (assets/css/player-control.css, core/player-control-style.js). -->
    <div id="player-container" class="fixed bottom-0 left-0 w-full z-40 pointer-events-auto flex flex-col hidden">
        <div id="player-panel" class="pc-surface" data-pc-style="gradient">
            <div class="pc-progress-block">
                <!-- step 0.001 = seek mịn tới ms: range kẹp giá trị theo step cả khi kéo tay; listener gửi thẳng
                     e.target.value, không làm tròn. Photo Player mode chỉ ẩn hàng thanh kéo, hàng giờ vẫn hiện. -->
                <div id="progress-bar-row" class="w-full"><input type="range" id="progress-bar" value="0" step="0.001" min="0" class="music-slider block"></div>
                <div id="progress-time-row" class="pc-time-row">
                    <span id="current-time" class="pc-time-current">0:00</span><span id="duration-time">0:00</span>
                </div>
            </div>

            <div class="pc-main-row">
                <div class="pc-info">
                    <div class="relative shrink-0 pc-art" id="record-container">
                        <img id="record-art" src="" class="w-full h-full rounded-full object-cover shadow-lg relative z-20" alt="Record">
                        <div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>
                    </div>
                    <div class="pc-meta">
                        <h2 id="player-title" class="text-white font-bold text-xs sm:text-sm truncate drop-shadow-md" data-i18n="bottomPlayer.noSongSelected">${t('bottomPlayer.noSongSelected')}</h2>
                        <p id="player-artist" class="text-sky-300 text-[10px] sm:text-xs truncate font-medium mt-0.5">---</p>
                    </div>
                </div>

                <div class="pc-controls">
                    <button id="btn-prev" class="pc-skip" data-i18n-title="bottomPlayer.btnPrev.title" title="${t('bottomPlayer.btnPrev.title')}">${iconSvg('rewind', 'w-6 h-6')}</button>
                    <button id="play-pause-btn" class="pc-play focus:outline-none">
                        ${iconSvg('play', 'w-6 h-6 ml-0.5', 'id="icon-play"')}
                        ${iconSvg('pause', 'w-6 h-6 hidden', 'id="icon-pause"')}
                    </button>
                    <button id="btn-next" class="pc-skip" data-i18n-title="bottomPlayer.btnNext.title" title="${t('bottomPlayer.btnNext.title')}">${iconSvg('fast-forward', 'w-6 h-6')}</button>
                </div>
            </div>
        </div>
    </div>
`;

/** #record-art dựng lại mỗi lần đổi media (Song / Video / Photo). `src`/`alt` là dữ liệu từng media — slot rỗng, ghi qua
 * core/record-art-ui.js::mountRecordArt(). @param {string} stateClass - 'animate-spin-slow' (đang quay) hoặc 'paused'
 * @returns {string} */
function renderRecordArtHtml(stateClass) {
    return `<img id="record-art" src="" class="w-full h-full rounded-full object-cover shadow-lg relative z-20 ${stateClass}" alt=""><div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>`;
}
