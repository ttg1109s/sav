/**
 * Component: overlay Ghi âm — khung TĨNH, mount 1 LẦN lúc boot bên trong TPL_VISUALIZER_OVERLAY
 * (components/visualizer-overlay.js nội suy `${TPL_RECORDER_OVERLAY}` — PHẢI nạp file NÀY TRƯỚC file đó). Khi ghi, chặn
 * mọi cử chỉ/điều khiển như Game.
 *
 * `#recorder-layer` — cùng khuôn `#gameplay-layer` (components/gameplay-overlay.js): trong stacking context của
 * `#visualizer-ui`, z 66 (trên #gameplay-layer 65, trên phụ đề 60) — lớp phủ TRONG SUỐT nuốt mọi chạm của
 * #visualizer-gesture-surface/top bar/Control Center; visualizer + phụ đề karaoke vẫn thấy bên dưới. Thanh player dưới
 * đáy (#player-container, ngoài stacking context này) chặn riêng bằng setPlayerControlsBlocked() như Game.
 *
 * `#btn-recorder-stop` (X) — đúng vị trí #btn-open-control-center (top-4 left-3 sm:left-6), cùng #btn-gameplay-exit.
 * `#recorder-indicator` — chấm đỏ nhấp nháy + "REC" + đồng hồ + 5 vạch mức mic (`.is-clipping` tô đỏ — Clip warning);
 * viền đỏ thở quanh màn hình (`.recorder-edge-glow`). `#recorder-countin` — số đếm ngược lớn giữa màn (Count-in);
 * `.is-counting` trên #recorder-layer làm mờ viên REC lúc đếm. CSS: assets/css/recorder.css.
 *
 * `renderRecorderReviewBody()` — bodyHtml của modal nghe lại (modalChoice): canvas mini waveform + nút phát/dừng + nhãn
 * giờ. Tương tác wire ở core/recorder-ui.js::wireRecorderReviewBody().
 */
const TPL_RECORDER_OVERLAY = `
            <div id="recorder-layer" class="hidden absolute inset-0 pointer-events-auto">
                <div class="recorder-edge-glow"></div>

                <button id="btn-recorder-stop" class="absolute top-4 left-3 sm:left-6 z-20 w-10 h-10 shrink-0 flex items-center justify-center glass-panel hover:bg-white/10 rounded-full transition-colors shadow-lg pointer-events-auto" data-i18n-title="recorder.stop.title" title="${t('recorder.stop.title')}">
                    ${iconSvg('x', 'h-5 w-5 text-slate-300')}
                </button>

                <div id="recorder-indicator" class="recorder-indicator glass-panel">
                    <span class="recorder-dot"></span>
                    <span class="recorder-label">REC</span>
                    <span id="recorder-timer" class="recorder-timer">0:00</span>
                    <span id="recorder-level" class="recorder-level"><i></i><i></i><i></i><i></i><i></i></span>
                </div>

                <div id="recorder-countin" class="recorder-countin hidden" aria-live="assertive"></div>
            </div>
`;

/** bodyHtml modal nghe lại — hàm render vì nội suy t() lúc mở; không có dữ liệu người dùng trong chuỗi. Kích thước khung
 * đặt inline (không phụ thuộc recorder.css đã nạp chưa) + canvas position:absolute: kích thước nội tại của canvas không
 * đẩy được layout — drawRecorderWaveform() đo theo KHUNG, không đo canvas. */
function renderRecorderReviewBody() {
    return `
        <div class="flex flex-col gap-3">
            <div class="recorder-review-wave-wrap" style="position:relative;width:100%;height:72px;overflow:hidden;border-radius:0.75rem;">
                <canvas id="recorder-review-wave" class="recorder-review-wave" style="position:absolute;left:0;top:0;width:100%;height:100%;display:block;"></canvas>
            </div>
            <div class="flex items-center gap-3">
                <button type="button" id="btn-recorder-preview-toggle" class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center" data-uitk="btnPrimaryBg textOnAccent" title="${t('recorder.review.playPause')}">
                    ${iconSvg('play', 'h-5 w-5', 'id="recorder-preview-icon-play"')}
                    ${iconSvg('pause', 'hidden h-5 w-5', 'id="recorder-preview-icon-pause"')}
                </button>
                <div class="flex flex-col min-w-0">
                    <span id="recorder-preview-time" class="text-sm font-medium tabular-nums">0:00 / 0:00</span>
                    <span class="text-xs" data-uitk="textSecondary">${t('recorder.review.hint')}</span>
                </div>
            </div>
        </div>
    `;
}
