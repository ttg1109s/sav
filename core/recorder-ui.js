/**
 * core/recorder-ui.js — Core-UI chế độ Ghi âm (MỚI 01/10/2026). Rule 5c: file có `wireRecorderReviewBody()` gắn sự
 * kiện lên DOM ĐỘNG (bodyHtml của modalChoice — tạo mới mỗi lần mở, không có sẵn lúc boot nên không wire được ở
 * event/listener/) -> hậu tố -ui. Các hàm còn lại chỉ đọc/ghi DOM nhận qua tham số, không tự quyết định nghiệp vụ.
 * Điều phối: event/workflow/recorder.js.
 *
 * NẠP SAU: event/bus.js chỉ cần lúc CLICK (không lúc nạp) — vị trí nạp tự do sau core/dom-refs.js.
 */

/** Màu mini waveform — phần đã phát / chưa phát (cố định, đọc rõ trên cả nền sáng lẫn tối của modal). */
const RECORDER_WAVE_PLAYED_COLOR = '#0ea5e9';
const RECORDER_WAVE_REST_COLOR = 'rgba(148, 163, 184, 0.55)';
const RECORDER_WAVE_BAR_GAP_RATIO = 0.35;
const RECORDER_WAVE_MIN_BAR_HEIGHT = 2;

/** @param {HTMLElement} layerEl */
function showRecorderLayer(layerEl) { layerEl.classList.remove('hidden'); }
/** @param {HTMLElement} layerEl */
function hideRecorderLayer(layerEl) { layerEl.classList.add('hidden'); }

/** @param {HTMLElement} timerEl @param {string} text */
function setRecorderTimerText(timerEl, text) { timerEl.textContent = text; }

/** 5 vạch mức mic co giãn theo 1 biến CSS (assets/css/recorder.css tự tính độ cao từng vạch) — 1 lần ghi DOM/tick.
 * @param {HTMLElement} levelEl @param {number} level 0..1 */
function setRecorderLevel(levelEl, level) { levelEl.style.setProperty('--rec-level', level.toFixed(3)); }

/**
 * Wire modal nghe lại (Rule 5a — callback CHỈ eventBus.send, gom 1 khối). Tỉ lệ vị trí chạm trên waveform tính ngay
 * trong callback để làm payload (cùng cách event/listener/gameplay.js tính x/y), không quyết định gì thêm.
 * @param {HTMLElement} bodyEl - #modal-choice-body
 */
function wireRecorderReviewBody(bodyEl) {
    const toggleBtn = bodyEl.querySelector('#btn-recorder-preview-toggle');
    const waveCanvas = bodyEl.querySelector('#recorder-review-wave');

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    if (toggleBtn) toggleBtn.addEventListener('click', () => eventBus.send({ router: 'recorder', type: 'recorder.preview.toggle.click', payload: {} }));
    if (waveCanvas) waveCanvas.addEventListener('pointerdown', (e) => {
        const rect = waveCanvas.getBoundingClientRect();
        const ratio = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
        eventBus.send({ router: 'recorder', type: 'recorder.preview.seek', payload: { ratio } });
    });
}

/**
 * Vẽ mini waveform: cột đối xứng quanh trục giữa, cột trước `progressRatio` tô màu "đã phát". Tự khớp kích thước
 * canvas theo CSS × devicePixelRatio (modal đổi cỡ theo màn hình).
 * @param {HTMLCanvasElement} canvasEl @param {Float32Array} peaks 0..1 @param {number} progressRatio 0..1 @param {number} dpr
 */
function drawRecorderWaveform(canvasEl, peaks, progressRatio, dpr) {
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvasEl.width !== w) canvasEl.width = w;
    if (canvasEl.height !== h) canvasEl.height = h;
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const count = peaks.length;
    const slot = w / count;
    const barW = Math.max(1, slot * (1 - RECORDER_WAVE_BAR_GAP_RATIO));
    const mid = h / 2;
    const playedBars = Math.floor(Math.max(0, Math.min(1, progressRatio)) * count);
    for (let i = 0; i < count; i++) {
        const barH = Math.max(RECORDER_WAVE_MIN_BAR_HEIGHT * dpr, peaks[i] * (h - 2 * dpr));
        ctx.fillStyle = i < playedBars ? RECORDER_WAVE_PLAYED_COLOR : RECORDER_WAVE_REST_COLOR;
        ctx.fillRect(i * slot + (slot - barW) / 2, mid - barH / 2, barW, barH);
    }
}

/**
 * Đồng bộ nút phát/dừng + nhãn giờ của modal nghe lại.
 * @param {HTMLElement} bodyEl @param {boolean} isPlaying @param {string} timeText
 */
function setRecorderPreviewState(bodyEl, isPlaying, timeText) {
    const playIcon = bodyEl.querySelector('#recorder-preview-icon-play');
    const pauseIcon = bodyEl.querySelector('#recorder-preview-icon-pause');
    const timeEl = bodyEl.querySelector('#recorder-preview-time');
    if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
    if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);
    if (timeEl && timeEl.textContent !== timeText) timeEl.textContent = timeText;
}

/** Nhãn giá trị slider bù trễ (Settings > Player > Ghi âm) cập nhật trong lúc kéo. @param {HTMLElement} bodyEl @param {number} ms */
function setRecorderLatencyLabel(bodyEl, ms) {
    const labelEl = bodyEl.querySelector('#setting-recorder-latency-value');
    if (labelEl) labelEl.textContent = `${ms} ms`;
}
