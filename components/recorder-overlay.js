/**
 * Component: overlay Ghi âm (MỚI 01/10/2026, Giang yêu cầu "khi ghi chặn tất cả cử chỉ/control, giống như game") —
 * khung TĨNH, mount 1 LẦN lúc boot bên trong TPL_VISUALIZER_OVERLAY (components/visualizer-overlay.js nội suy
 * `${TPL_RECORDER_OVERLAY}` — PHẢI nạp file NÀY TRƯỚC file đó). Rule 5d: khung không đổi giữa các lần -> hằng chuỗi tĩnh.
 *
 * `#recorder-layer` — CÙNG khuôn `#gameplay-layer` (components/gameplay-overlay.js): nằm trong stacking context của
 * `#visualizer-ui`, z 66 (trên #gameplay-layer 65, trên phụ đề 60) — lớp phủ TRONG SUỐT, chiếm mọi chạm của
 * #visualizer-gesture-surface/top bar/Control Center; visualizer + phụ đề karaoke vẫn nhìn thấy bên dưới. Thanh player
 * dưới đáy (#player-container, ngoài stacking context này) chặn riêng bằng setPlayerControlsBlocked() như Game.
 *
 * `#btn-recorder-stop` (X) — ĐÚNG vị trí #btn-open-control-center (top-4 left-3 sm:left-6), cùng #btn-gameplay-exit.
 * `#recorder-indicator` — chấm đỏ nhấp nháy + "REC" + đồng hồ + 5 vạch mức mic; viền đỏ thở quanh màn hình
 * (`.recorder-edge-glow`). CSS: assets/css/recorder.css.
 *
 * `renderRecorderReviewBody()` — bodyHtml của modal nghe lại (modalChoice, core/modal-choice-ui.js): canvas mini
 * waveform + nút phát/dừng + nhãn giờ. Tương tác wire ở core/recorder-ui.js::wireRecorderReviewBody().
 */
const TPL_RECORDER_OVERLAY = `
            <div id="recorder-layer" class="hidden absolute inset-0 pointer-events-auto">
                <div class="recorder-edge-glow"></div>

                <button id="btn-recorder-stop" class="absolute top-4 left-3 sm:left-6 z-20 w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors shadow-lg pointer-events-auto" data-i18n-title="recorder.stop.title" title="${t('recorder.stop.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div id="recorder-indicator" class="recorder-indicator glass-panel">
                    <span class="recorder-dot"></span>
                    <span class="recorder-label">REC</span>
                    <span id="recorder-timer" class="recorder-timer">0:00</span>
                    <span id="recorder-level" class="recorder-level"><i></i><i></i><i></i><i></i><i></i></span>
                </div>
            </div>
`;

/** bodyHtml modal nghe lại — hàm render (Rule 5d) vì nội suy t() lúc mở. Không có dữ liệu người dùng nào trong chuỗi. */
function renderRecorderReviewBody() {
    return `
        <div class="flex flex-col gap-3">
            <!-- SỬA (02/10/2026, Giang báo lỗi layout) — kích thước khung đặt INLINE (không phụ thuộc assets/css/recorder.css
                 đã nạp hay chưa) + canvas position:absolute: kích thước nội tại của canvas KHÔNG BAO GIỜ đẩy được layout,
                 drawRecorderWaveform() đo theo KHUNG chứ không đo chính canvas (xem core/recorder-ui.js). -->
            <div class="recorder-review-wave-wrap" style="position:relative;width:100%;height:72px;overflow:hidden;border-radius:0.75rem;">
                <canvas id="recorder-review-wave" class="recorder-review-wave" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block;"></canvas>
            </div>
            <div class="flex items-center gap-3">
                <button type="button" id="btn-recorder-preview-toggle" class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" data-uitk="btnPrimaryBg textOnAccent" title="${t('recorder.review.playPause')}">
                    <svg id="recorder-preview-icon-play" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
                    <svg id="recorder-preview-icon-pause" xmlns="http://www.w3.org/2000/svg" class="hidden h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
                </button>
                <div class="flex flex-col min-w-0">
                    <span id="recorder-preview-time" class="text-sm font-medium tabular-nums">0:00 / 0:00</span>
                    <span class="text-xs" data-uitk="textSecondary">${t('recorder.review.hint')}</span>
                </div>
            </div>
        </div>
    `;
}
