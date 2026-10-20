/**
 * core/hud.js — panel HUD nổi kiểu popup hệ thống iOS (Volume, Speed) ở components/visualizer-overlay.js: phép tính +
 * ghi DOM tĩnh (core/dom-refs.js). Mở/đóng/auto-hide: event/workflow/hud.js.
 */

/** Mốc icon loa theo âm lượng — 0 = câm, 1 = chỉ loa, 2/3/4 = thêm dần 1/2/3 vòng sóng.
 * @param {number} volume - 0-100 @returns {0|1|2|3|4} */
function resolveVolumeIconLevel(volume) {
    if (volume <= 0) return 0;
    if (volume <= 25) return 1;
    if (volume <= 50) return 2;
    if (volume <= 75) return 3;
    return 4;
}

/** Đồng bộ icon loa Volume HUD theo mốc (resolveVolumeIconLevel(), Workflow tính trước).
 * @param {0|1|2|3|4} level */
function syncVolumeHudIcon(level) {
    if (typeof volumeHudMute !== 'undefined' && volumeHudMute) volumeHudMute.classList.toggle('hidden', level !== 0);
    if (typeof volumeHudWave1 !== 'undefined' && volumeHudWave1) volumeHudWave1.classList.toggle('hidden', level < 2);
    if (typeof volumeHudWave2 !== 'undefined' && volumeHudWave2) volumeHudWave2.classList.toggle('hidden', level < 3);
    if (typeof volumeHudWave3 !== 'undefined' && volumeHudWave3) volumeHudWave3.classList.toggle('hidden', level < 4);
}

/** Đặt vị trí slider volume. @param {HTMLElement} sliderEl - #volume-hud-slider @param {number} volume - 0-100 */
function setVolumeHudSliderValue(sliderEl, volume) {
    sliderEl.value = volume;
}

/** Hiện 1 panel HUD (Volume/Speed). @param {HTMLElement} panelEl */
function showHudPanel(panelEl) {
    panelEl.classList.remove('hidden');
}

/** Ẩn 1 panel HUD (hết giờ auto-hide). @param {HTMLElement} panelEl */
function hideHudPanel(panelEl) {
    panelEl.classList.add('hidden');
}

/** Phần "đã kéo" của slider volume — biến `--hud-fill-pct`, `.setting-slider` (sliders.css) tô theo UI theme.
 * @param {HTMLElement} sliderEl - #volume-hud-slider @param {number} volume - 0-100 */
function syncVolumeHudSliderFill(sliderEl, volume) {
    sliderEl.style.setProperty('--hud-fill-pct', `${Math.max(0, Math.min(100, volume))}%`);
}

// ===================== Speed HUD =====================

/** 6 mốc "nhảy nhanh" trên slider liên tục 0.5-2 — phải giữ sort tăng dần (findAdjacentPlaybackSpeedPreset()). */
const PLAYBACK_SPEED_PRESETS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);
const PLAYBACK_SPEED_MIN = 0.5;
const PLAYBACK_SPEED_MAX = 2;

/** Giá trị thô (chuỗi slider/mốc hoặc số) -> kẹp [PLAYBACK_SPEED_MIN, PLAYBACK_SPEED_MAX] + làm tròn 2 chữ số — nguồn duy
 * nhất cho mọi nơi ghi playbackSpeed (tránh sai số dấu phẩy động của range step 0.01, vd 1.2299999999999998).
 * @param {string|number} speed @returns {number} */
function clampAndRoundPlaybackSpeed(speed) {
    return Math.round(Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, parseFloat(speed))) * 100) / 100;
}

/** Mốc trong PLAYBACK_SPEED_PRESETS liền kề `currentSpeed` theo `direction` — dùng được cả khi đang ở giá trị lẻ (1.35 ->
 * tăng 1.5 / giảm 1.25); đã ở mốc ngoài cùng -> giữ mốc đó.
 * @param {number} currentSpeed @param {1|-1} direction @returns {number} */
function findAdjacentPlaybackSpeedPreset(currentSpeed, direction) {
    if (direction > 0) {
        const next = PLAYBACK_SPEED_PRESETS.find((p) => p > currentSpeed);
        return next !== undefined ? next : PLAYBACK_SPEED_PRESETS[PLAYBACK_SPEED_PRESETS.length - 1];
    }
    const lowerMatches = PLAYBACK_SPEED_PRESETS.filter((p) => p < currentSpeed);
    return lowerMatches.length > 0 ? lowerMatches[lowerMatches.length - 1] : PLAYBACK_SPEED_PRESETS[0];
}

/** Mọi giá trị hiển thị của Speed HUD cho 1 tốc độ: nhãn "1.25x" + % tô slider trong dải [MIN, MAX].
 * @param {number} speed @returns {{speed: number, label: string, fillPercent: number}} */
function resolveSpeedHudView(speed) {
    return {
        speed,
        label: `${speed}x`,
        fillPercent: ((speed - PLAYBACK_SPEED_MIN) / (PLAYBACK_SPEED_MAX - PLAYBACK_SPEED_MIN)) * 100,
    };
}

/** Đồng bộ toàn bộ UI Speed HUD (badge trên nút mở, nhãn trong popup, vị trí + tô slider, nút mốc active) theo `view`
 * — lúc boot, lúc mở HUD và mỗi lần tốc độ đổi.
 * @param {HTMLElement} sliderEl - #speed-hud-slider @param {HTMLElement} valueLabelEl - #speed-hud-value
 * @param {NodeListOf<HTMLElement>} optionEls - .speed-hud-option @param {HTMLElement} badgeEl - #speed-badge-label
 * @param {{speed: number, label: string, fillPercent: number}} view - resolveSpeedHudView() */
function syncSpeedHudUI(sliderEl, valueLabelEl, optionEls, badgeEl, view) {
    if (sliderEl) {
        sliderEl.value = view.speed;
        sliderEl.style.setProperty('--hud-fill-pct', `${view.fillPercent}%`); // tô theo UI theme — .setting-slider, sliders.css
    }
    if (valueLabelEl) valueLabelEl.textContent = view.label;
    optionEls.forEach((el) => el.setAttribute('aria-pressed', String(parseFloat(el.dataset.speedOption) === view.speed))); // màu bật: key vizChip (aria-pressed:)
    if (badgeEl) badgeEl.textContent = view.label;
}
