/**
 * Component: Game Mode overlay (Circle mode v1, MỚI 16/08/2026) — khung TĨNH, mount 1 LẦN lúc boot
 * bên trong TPL_VISUALIZER_OVERLAY (components/visualizer-overlay.js nội suy `${TPL_GAMEPLAY_OVERLAY}`
 * — PHẢI nạp file NÀY TRƯỚC file đó, xem index.html). Rule 5d: khung không đổi giữa các lần mở/đóng
 * -> hằng số chuỗi tĩnh, KHÔNG dựng bằng createElement. Phần THẬT SỰ động (số lượng wave-ring, tier
 * popup) do core/gameplay/circle-mode-ui.js tự createElement runtime, chèn vào 2 container rỗng
 * `#gameplay-waves-container`/`#gameplay-tier-popup-layer` đã có sẵn ở đây.
 *
 * z-[65]: PHẢI cao hơn mốc cao nhất hiện có trong stacking context `#visualizer-ui` (z-[60] của
 * #subtitle-display) — Giang chốt "lớp game hiển chèn lên cao nhất lúc vào" (16/08/2026).
 * `#gameplay-tap-surface` là lớp bắt chạm RIÊNG cho gameplay (KHÔNG dùng chung
 * #visualizer-gesture-surface — 2 hệ thống input khác nghĩa hẳn) — nằm TRÊN gesture-surface về mặt
 * DOM/z-index nên chiếm chạm trước, tự nhiên không cần thêm cờ appState nào để "khoá" gesture cũ
 * (đúng hướng đã bàn ở plan gameplay §13, tái dùng right pattern control-center-overlay/generic-
 * drawer-overlay đang có sẵn — chỉ cần đứng cao hơn về DOM, không cần block gate).
 */
const TPL_GAMEPLAY_OVERLAY = `
            <div id="gameplay-layer" class="hidden absolute inset-0 z-[65]">
                <div id="gameplay-tap-surface" class="absolute inset-0 pointer-events-auto"></div>

                <!-- Nút Thoát CỐ ĐỊNH — MỚI (16/08/2026, Giang yêu cầu) — ĐÚNG vị trí #btn-open-
                     control-center thật (bị #gameplay-layer che mất suốt lúc overlay hiện, kể cả
                     phase 'playing'/'countdown' vốn không có màn nào khác để thoát — xem điểm 3
                     đã trả lời trước đó "point 2... cơ bản không cần fix", giờ Giang đổi ý thêm nút
                     RIÊNG luôn hiện, không phụ thuộc phase). z-20 > z-10 của 3 màn ready/countdown/
                     score bên dưới — LUÔN bấm được bất kể đang ở màn nào. -->
                <button id="btn-gameplay-exit" class="absolute top-4 left-3 sm:left-6 z-20 w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors shadow-lg pointer-events-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div id="gameplay-center-circle" class="gameplay-center-circle pointer-events-none"></div>
                <div id="gameplay-waves-container" class="absolute inset-0 pointer-events-none"></div>
                <div id="gameplay-tier-popup-layer" class="gameplay-tier-popup-layer pointer-events-none"></div>

                <div id="gameplay-hud" class="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none flex items-baseline gap-2 sub-text-glow">
                    <span id="gameplay-hud-score" class="font-mono text-white font-bold text-xl">0.00</span>
                    <span id="gameplay-hud-combo" class="font-mono text-sky-400 font-bold text-sm"></span>
                </div>

                <div id="gameplay-ready-screen" class="hidden absolute inset-0 z-10 flex items-center justify-center px-6 pointer-events-auto bg-black/60">
                    <div class="glass-control-center rounded-3xl shadow-2xl p-6 w-full max-w-xs text-center">
                        <div class="text-white font-semibold text-lg mb-1">Circle</div>
                        <div class="text-slate-300 text-xs mb-6">Chạm đúng lúc wave khớp vòng tròn tâm — càng gần biên càng nhiều điểm.</div>
                        <button id="btn-gameplay-start" class="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-semibold transition-colors">Start</button>
                    </div>
                </div>

                <div id="gameplay-countdown-screen" class="hidden absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div id="gameplay-countdown-number" class="gameplay-countdown-number">5</div>
                </div>

                <div id="gameplay-score-screen" class="hidden absolute inset-0 z-10 flex items-center justify-center px-6 pointer-events-auto bg-black/60">
                    <div class="glass-control-center rounded-3xl shadow-2xl p-6 w-full max-w-xs text-center">
                        <div class="text-slate-300 text-xs font-semibold tracking-wider mb-1">ĐIỂM TRUNG BÌNH</div>
                        <div id="gameplay-final-score" class="text-white font-mono font-bold text-4xl mb-6">0.000</div>
                        <div class="flex flex-col gap-2">
                            <button id="btn-gameplay-replay" class="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-semibold transition-colors">Chơi lại</button>
                            <button id="btn-gameplay-next" class="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors">Bài tiếp theo</button>
                        </div>
                    </div>
                </div>
            </div>
`;
