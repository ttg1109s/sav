/**
 * core/recorder-ui.js — Core-UI chế độ Ghi âm: ghi DOM nhận qua tham số, tạo `<audio>` nghe thử, vẽ mini waveform, và
 * wire DOM/đối tượng tạo động (modal nghe lại — bodyHtml của modalChoice; track mic — tạo mỗi lần xin mic; callback chỉ
 * eventBus.send). Điều phối: event/workflow/recorder.js.
 *
 * NẠP SAU: core/dom-refs.js. event/bus.js chỉ cần lúc chạm.
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

/** `<audio>` nghe lại bản ghi — NGOÀI audio graph chính (visualizer không nhảy theo), phát lặp, tải trước.
 * @returns {HTMLAudioElement} */
function createRecorderPreviewAudio() {
    const audioEl = new Audio();
    audioEl.loop = true;
    audioEl.preload = 'auto';
    return audioEl;
}

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
 * Track mic bị hệ điều hành thu hồi ('ended') -> eventBus 'recorder.mic.ended' (Rule 5a — callback CHỈ eventBus.send).
 * @param {MediaStream} stream
 */
function wireRecorderMicEnded(stream) {
    stream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', () => eventBus.send({ router: 'recorder', type: 'recorder.mic.ended', payload: {} }), { once: true });
    });
}

/**
 * Vẽ mini waveform: cột đối xứng quanh trục giữa, cột trước `progressRatio` tô màu "đã phát". Kích thước bộ đệm
 * canvas = kích thước KHUNG CHỨA × devicePixelRatio (modal đổi cỡ theo màn hình). Đo KHUNG CHỨA (parentElement, cỡ cố
 * định 72px) chứ không đo chính canvas — đo canvas thì cỡ hiển thị = thuộc tính vừa gán, mỗi frame nhân thêm dpr.
 * @param {HTMLCanvasElement} canvasEl @param {Float32Array} peaks 0..1 @param {number} progressRatio 0..1 @param {number} dpr
 */
function drawRecorderWaveform(canvasEl, peaks, progressRatio, dpr) {
    const boxEl = canvasEl.parentElement;
    if (!boxEl) return;
    const cssW = boxEl.clientWidth;
    const cssH = boxEl.clientHeight;
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
 * Đồng bộ nút phát/dừng + nhãn giờ "vị trí / thời lượng" của modal nghe lại (ghi nhãn chỉ khi đổi).
 * @param {HTMLElement} bodyEl @param {boolean} isPlaying @param {string} currentLabel @param {string} durationLabel
 */
function setRecorderPreviewState(bodyEl, isPlaying, currentLabel, durationLabel) {
    const playIcon = bodyEl.querySelector('#recorder-preview-icon-play');
    const pauseIcon = bodyEl.querySelector('#recorder-preview-icon-pause');
    const timeEl = bodyEl.querySelector('#recorder-preview-time');
    const timeText = `${currentLabel} / ${durationLabel}`;
    if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
    if (pauseIcon) pauseIcon.classList.toggle('hidden', !isPlaying);
    if (timeEl && timeEl.textContent !== timeText) timeEl.textContent = timeText;
}

/** Count-in: hiện số giây còn lại (lớp .is-counting trên #recorder-layer làm mờ viên REC); `seconds`
 * <= 0 -> ẩn số + gỡ lớp. @param {HTMLElement} layerEl @param {HTMLElement} countEl @param {number} seconds */
function setRecorderCountIn(layerEl, countEl, seconds) {
    const counting = seconds > 0;
    layerEl.classList.toggle('is-counting', counting);
    countEl.classList.toggle('hidden', !counting);
    countEl.textContent = counting ? String(seconds) : '';
}

/** Clip warning: tô đỏ vạch mức mic. @param {HTMLElement} indicatorEl @param {boolean} clipping */
function setRecorderClip(indicatorEl, clipping) {
    indicatorEl.classList.toggle('is-clipping', clipping);
}

/** Nút Latency calibration (Settings > System > Ghi âm) lúc đang đo: khoá nút + đổi nhãn. Không có nút
 * (đang ở màn khác / chế độ Speaker) -> bỏ qua. @param {HTMLElement} bodyEl @param {boolean} busy @param {string} label */
function setRecorderCalibrationBusy(bodyEl, busy, label) {
    const btn = bodyEl.querySelector('#setting-recorder-calibrate');
    if (!btn) return;
    btn.disabled = busy;
    btn.style.opacity = busy ? '0.6' : '';
    btn.textContent = label;
}

/** Đo xong: đặt slider Sync + nhãn theo giá trị mới (màn không cần vẽ lại). @param {HTMLElement} bodyEl @param {number} ms */
function setRecorderLatencyControl(bodyEl, ms) {
    const slider = bodyEl.querySelector('#setting-recorder-latency');
    const labelEl = bodyEl.querySelector('#setting-recorder-latency-value');
    if (slider) slider.value = String(ms);
    if (labelEl) labelEl.textContent = `${ms} ms`;
}

/** Nhãn giá trị slider Sync cập nhật trong lúc kéo. @param {HTMLElement} bodyEl @param {number} ms */
function setRecorderLatencyLabel(bodyEl, ms) {
    const labelEl = bodyEl.querySelector('#setting-recorder-latency-value');
    if (labelEl) labelEl.textContent = `${ms} ms`;
}
