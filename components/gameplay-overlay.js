/**
 * Component: Game Mode overlay (Circle mode) — khung TĨNH, mount 1 LẦN lúc boot bên trong
 * TPL_VISUALIZER_OVERLAY (components/visualizer-overlay.js nội suy `${TPL_GAMEPLAY_OVERLAY}` — PHẢI
 * nạp file NÀY TRƯỚC file đó, xem index.html). Rule 5d: khung không đổi giữa các lần mở/đóng ->
 * hằng số chuỗi tĩnh, KHÔNG dựng bằng createElement.
 *
 * `#gameplay-canvas` — vẽ circle+wave (core/gameplay/circle-mode-ui.js, canvas 2D, nền TRONG SUỐT
 * để visualizer phía sau xuyên qua). `#gameplay-tier-popup-layer` vẫn DOM+CSS (text nổi PERFECT/
 * MISS... — CSS animation đơn giản hơn tự vẽ trên canvas, không cần đổi công nghệ chỗ này).
 *
 * HUD chỉ còn combo (`#gameplay-hud-combo`) — KHÔNG hiển thị điểm số lúc đang chơi (chỉ hiện ở modal
 * kết thúc qua `modalChoice()`, xem event/workflow/gameplay.js::onSongEnded()).
 *
 * z-[65]: cao hơn mốc cao nhất hiện có trong stacking context `#visualizer-ui` (z-[60] của
 * #subtitle-display). `#gameplay-tap-surface` là lớp bắt chạm RIÊNG cho gameplay (KHÔNG dùng chung
 * #visualizer-gesture-surface) — nằm TRÊN gesture-surface về DOM/z-index nên chiếm chạm trước,
 * không cần thêm cờ appState nào để "khoá" gesture cũ.
 *
 * `#btn-gameplay-exit` (z-20, cố định top-4 left, ĐÚNG vị trí #btn-open-control-center thật) bị
 * modalChoice() (z-[130], TOÀN CỤC, gắn thẳng document.body) CHE MẤT lúc màn Start/Kết quả đang mở —
 * CHỦ Ý, không phải bug: modalChoice() tự có nút riêng cho 2 trường hợp đó, nút exit cố định chỉ lo
 * phần 'playing'/'countdown' (2 phase không có màn hỏi nào khác để thoát).
 */
const TPL_GAMEPLAY_OVERLAY = `
            <div id="gameplay-layer" class="hidden absolute inset-0 z-[65]">
                <div id="gameplay-tap-surface" class="absolute inset-0 pointer-events-auto"></div>

                <button id="btn-gameplay-exit" class="absolute top-4 left-3 sm:left-6 z-20 w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors shadow-lg pointer-events-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <canvas id="gameplay-canvas" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
                <div id="gameplay-tier-popup-layer" class="absolute inset-0 pointer-events-none"></div>

                <div id="gameplay-hud" class="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none flex items-baseline gap-2 sub-text-glow">
                    <span id="gameplay-hud-combo" class="font-mono text-sky-400 font-bold text-sm"></span>
                </div>

                <div id="gameplay-countdown-screen" class="hidden absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div id="gameplay-countdown-number" class="gameplay-countdown-number">5</div>
                </div>
            </div>
`;
