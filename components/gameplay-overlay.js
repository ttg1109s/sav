/**
 * Component: Game Mode overlay (Circle mode v1, MỚI 16/08/2026) — khung TĨNH, mount 1 LẦN lúc boot
 * bên trong TPL_VISUALIZER_OVERLAY (components/visualizer-overlay.js nội suy `${TPL_GAMEPLAY_OVERLAY}`
 * — PHẢI nạp file NÀY TRƯỚC file đó, xem index.html). Rule 5d: khung không đổi giữa các lần mở/đóng
 * -> hằng số chuỗi tĩnh, KHÔNG dựng bằng createElement. Phần THẬT SỰ động (số lượng cặp circle+wave,
 * tier popup) do core/gameplay/circle-mode-ui.js tự createElement runtime, chèn vào 2 container rỗng
 * `#gameplay-waves-container`/`#gameplay-tier-popup-layer` đã có sẵn ở đây.
 *
 * SỬA (16/08/2026, Giang yêu cầu) — BỎ HẲN 2 màn tĩnh riêng `#gameplay-ready-screen`/`#gameplay-
 * score-screen` (Start/Kết quả) — dùng LẠI `modalChoice()` có sẵn (core/modal-choice.js, đã dùng
 * khắp app cho mọi loại hỏi quyết định) thay vì tự dựng UI riêng cho gameplay, xem event/workflow/
 * gameplay.js::start()/onSongEnded(). Chỉ còn `#gameplay-countdown-screen` (số đếm ngược — KHÔNG
 * phải 1 "quyết định" nào, không có nút, modalChoice() không phù hợp) là màn tĩnh riêng còn lại.
 *
 * z-[65]: PHẢI cao hơn mốc cao nhất hiện có trong stacking context `#visualizer-ui` (z-[60] của
 * #subtitle-display) — Giang chốt "lớp game hiển chèn lên cao nhất lúc vào" (16/08/2026).
 * `#gameplay-tap-surface` là lớp bắt chạm RIÊNG cho gameplay (KHÔNG dùng chung
 * #visualizer-gesture-surface — 2 hệ thống input khác nghĩa hẳn) — nằm TRÊN gesture-surface về mặt
 * DOM/z-index nên chiếm chạm trước, tự nhiên không cần thêm cờ appState nào để "khoá" gesture cũ
 * (đúng hướng đã bàn ở plan gameplay §13, tái dùng right pattern control-center-overlay/generic-
 * drawer-overlay đang có sẵn — chỉ cần đứng cao hơn về DOM, không cần block gate).
 *
 * `#btn-gameplay-exit` (z-20, cố định top-4 left, ĐÚNG vị trí #btn-open-control-center thật) bị
 * modalChoice() (z-[130], TOÀN CỤC, gắn thẳng document.body) CHE MẤT lúc màn Start/Kết quả đang mở
 * — CHỦ Ý, không phải bug: modalChoice() tự có nút "Cancel"/"Về Playlist" riêng cho 2 trường hợp
 * đó (xem event/workflow/gameplay.js), nút exit cố định chỉ cần lo phần 'playing'/'countdown' (2
 * phase KHÔNG có màn hỏi nào khác để thoát).
 */
const TPL_GAMEPLAY_OVERLAY = `
            <div id="gameplay-layer" class="hidden absolute inset-0 z-[65]">
                <div id="gameplay-tap-surface" class="absolute inset-0 pointer-events-auto"></div>

                <!-- Nút Thoát CỐ ĐỊNH — MỚI (16/08/2026, Giang yêu cầu) — ĐÚNG vị trí #btn-open-
                     control-center thật (bị #gameplay-layer che mất suốt lúc overlay hiện). Lo 2
                     phase 'playing'/'countdown' (không có màn hỏi nào khác để thoát) — 'ready'/
                     'ended' đã có nút riêng ngay trong modalChoice(). -->
                <button id="btn-gameplay-exit" class="absolute top-4 left-3 sm:left-6 z-20 w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors shadow-lg pointer-events-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <!-- Mỗi note tự tạo CẶP circle+wave riêng, vị trí riêng lúc runtime — xem core/
                     gameplay/circle-mode-ui.js::syncCircleWaveElements(). 2 container dưới đây CHỈ
                     còn là điểm neo rỗng cho core-ui tự createElement (Rule 5d). -->
                <div id="gameplay-waves-container" class="absolute inset-0 pointer-events-none"></div>
                <div id="gameplay-tier-popup-layer" class="absolute inset-0 pointer-events-none"></div>

                <div id="gameplay-hud" class="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none flex items-baseline gap-2 sub-text-glow">
                    <span id="gameplay-hud-score" class="font-mono text-white font-bold text-xl">0.00</span>
                    <span id="gameplay-hud-combo" class="font-mono text-sky-400 font-bold text-sm"></span>
                </div>

                <div id="gameplay-countdown-screen" class="hidden absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div id="gameplay-countdown-number" class="gameplay-countdown-number">5</div>
                </div>
            </div>
`;
