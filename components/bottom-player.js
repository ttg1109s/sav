/**
 * Component: Bottom Player (thanh điều khiển phát nhạc ở dưới cùng)
 * Biến này chứa chuỗi HTML, được main.js chèn vào DOM lúc khởi động.
 */
const TPL_BOTTOM_PLAYER = `
    <!-- FIX (04/07/2026, mục 4 phản hồi Giang) — z-index HẠ từ 70 xuống 40 (nằm GIỮA
         #visualizer-ui z-30 và #control-center-overlay z-45, LUÔN THẤP HƠN #playlist-view z-60).
         Trước đây z-70 CAO HƠN #playlist-view (60) — khi Playlist trượt vào che màn hình,
         player-container vẫn nổi TRÊN nó cho tới khi bị ẩn CƯỠNG BỨC bằng JS đúng 300ms sau (xem
         core/player-controls.js::forceBackToPlaylistUI) — LỆCH với thời lượng trượt thật
         (duration-500 ở #playlist-view) nên biến mất ĐỘT NGỘT giữa chừng lúc còn đang trượt, nhìn
         "rất cứng" (đúng mô tả bug). Hạ z-index xuống DƯỚI #playlist-view giải quyết TẬN GỐC: giờ
         Playlist tự nhiên CHE KÍN player-container ngay từ khung hình đầu tiên của lúc trượt vào —
         không còn khoảnh khắc "nổi rồi biến mất" nào để nhìn thấy nữa. Lệnh ẩn (classList.add
         'hidden') ở JS vẫn giữ (dọn dẹp/accessibility), giờ chỉ là dọn "âm thầm" phía sau lớp phủ
         đã che kín từ trước, không còn là cú thay đổi NHÌN THẤY ĐƯỢC. -->
    <div id="player-container" class="bg-gradient-to-t from-black via-black/70 to-transparent fixed bottom-0 left-0 w-full z-40 pointer-events-auto flex flex-col hidden">
        <div class="w-full p-2"><input type="range" id="progress-bar" value="0" step="0.1" min="0" class="music-slider block"></div>

        <div class="w-full  pt-3 pb-3 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-6">
            
            <div class="flex items-center gap-3 w-1/3 min-w-[120px]">
                <div class="relative shrink-0 w-12 h-12 sm:w-14 sm:h-14" id="record-container">
                    <img id="record-art" src="" class="w-full h-full rounded-full object-cover shadow-lg relative z-20" alt="Record">
                    <div class="absolute inset-0 m-auto w-3 h-3 bg-slate-900 rounded-full border border-slate-700 z-30"></div>
                </div>
                <div class="flex-grow flex flex-col justify-center overflow-hidden z-20 relative">
                    <h2 id="player-title" class="text-white font-bold text-xs sm:text-sm truncate drop-shadow-md" data-i18n="bottomPlayer.noSongSelected">${t('bottomPlayer.noSongSelected')}</h2>
                    <p id="player-artist" class="text-sky-300 text-[10px] sm:text-xs truncate font-medium mt-0.5">---</p>
                </div>
            </div>

            <div class="flex items-center justify-center gap-4 sm:gap-6 w-1/3">
                <button id="btn-prev" class="w-8 h-8 flex items-center justify-center text-white hover:text-sky-400 transition-colors" data-i18n-title="bottomPlayer.btnPrev.title" title="${t('bottomPlayer.btnPrev.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" /></svg></button>
                <button id="play-pause-btn" class="shrink-0 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-white text-black hover:bg-sky-100 hover:scale-105 transition-all focus:outline-none shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    <svg id="icon-play" class="w-6 h-6 sm:w-7 sm:h-7 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    <svg id="icon-pause" class="w-6 h-6 sm:w-7 sm:h-7 hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                <button id="btn-next" class="w-8 h-8 flex items-center justify-center text-white hover:text-sky-400 transition-colors" data-i18n-title="bottomPlayer.btnNext.title" title="${t('bottomPlayer.btnNext.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path d="M11.555 14.832A1 1 0 0010 14v-2.798l-5.445 3.63A1 1 0 013 14V6a1 1 0 011.555-.832L10 8.798V6a1 1 0 011.555-.832l6 4a1 1 0 010 1.664l-6 4z" /></svg></button>
            </div>

            <div class="flex items-center justify-end w-1/3 text-[10px] sm:text-xs font-mono text-slate-400 pr-2">
                <span id="current-time" class="text-white font-semibold">0:00</span>&nbsp;/&nbsp;<span id="duration-time">0:00</span>
            </div>
        </div>
    </div>
`;
