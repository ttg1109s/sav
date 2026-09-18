/**
 * core/hud.js — Core thuần (Rule 1-5) cho các panel HUD nổi kiểu popup hệ thống iOS (Volume, Speed)
 * ở components/visualizer-overlay.js. Mở/đóng/auto-hide/routing: event/workflow/hud.js.
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

/** Đồng bộ icon loa Volume HUD theo âm lượng hiện tại.
 * @param {number} volume - 0-100 */
function syncVolumeHudIcon(volume) {
    const level = resolveVolumeIconLevel(volume);
    if (typeof volumeHudMute !== 'undefined' && volumeHudMute) volumeHudMute.classList.toggle('hidden', level !== 0);
    if (typeof volumeHudWave1 !== 'undefined' && volumeHudWave1) volumeHudWave1.classList.toggle('hidden', level < 2);
    if (typeof volumeHudWave2 !== 'undefined' && volumeHudWave2) volumeHudWave2.classList.toggle('hidden', level < 3);
    if (typeof volumeHudWave3 !== 'undefined' && volumeHudWave3) volumeHudWave3.classList.toggle('hidden', level < 4);
}

/** Tô phần "đã kéo" của slider volume (`.setting-slider` dùng chung không tự tô).
 * @param {HTMLElement} sliderEl - #volume-hud-slider @param {number} volume - 0-100 */
function syncVolumeHudSliderFill(sliderEl, volume) {
    const percentage = Math.max(0, Math.min(100, volume));
    sliderEl.style.background = `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
}

// ===================== Speed HUD =====================

/** 6 mốc "nhảy nhanh" — hiển thị trên slider liên tục, KHÔNG còn là toàn bộ giá trị hợp lệ (SỬA
 * 18/09/2026, Giang cho phép dải liên tục 0.5-2, làm tròn 2 chữ số thập phân) — ĐỔI TÊN từ
 * PLAYBACK_SPEED_STEPS (tên cũ ngụ ý "đây là MỌI giá trị được phép", không còn đúng nữa). 0.7/1.2
 * cũ đổi thành 0.75/1.25 (yêu cầu Giang). PHẢI giữ SORT TĂNG DẦN — findAdjacentPlaybackSpeedPreset()
 * dưới dựa vào thứ tự này để tìm mốc kế tiếp/trước đó.
 */
const PLAYBACK_SPEED_PRESETS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);
const PLAYBACK_SPEED_MIN = 0.5;
const PLAYBACK_SPEED_MAX = 2;

/** Kẹp về dải [PLAYBACK_SPEED_MIN, PLAYBACK_SPEED_MAX] + làm tròn 2 chữ số thập phân — NGUỒN SỰ
 * THẬT DUY NHẤT cho MỌI nơi ghi appConfigViz.playbackSpeed (kéo slider, ấn mốc, cử chỉ tăng/giảm) —
 * tránh rải rác `Math.round(x*100)/100` ở nhiều chỗ, và tránh sai số dấu phẩy động cộng dồn khi
 * <input type=range step="0.01"> thi thoảng trả về vd 1.2299999999999998.
 * @param {number} speed @returns {number} */
function clampAndRoundPlaybackSpeed(speed) {
    return Math.round(Math.min(PLAYBACK_SPEED_MAX, Math.max(PLAYBACK_SPEED_MIN, speed)) * 100) / 100;
}

/** Nhãn hiển thị 1 mốc tốc độ ("1x"/"0.5x"...). @param {number} speed @returns {string} */
function formatPlaybackSpeedLabel(speed) {
    return `${speed}x`;
}

/** MỚI (18/09/2026, cử chỉ "tăng/giảm theo mốc tốc độ") — tìm mốc trong PLAYBACK_SPEED_PRESETS
 * liền kề currentSpeed theo direction, DÙNG ĐƯỢC CẢ khi currentSpeed đang là 1 giá trị liên tục
 * KHÔNG khớp mốc nào (vd 1.35 -> tăng -> 1.5, giảm -> 1.25) LẪN khi đang khớp đúng 1 mốc (vd 1.25
 * -> tăng -> 1.5). Đã ở mốc NGOÀI CÙNG theo đúng chiều -> giữ nguyên mốc đó (không tràn dải).
 * @param {number} currentSpeed @param {1|-1} direction - 1 = tăng (mốc kế tiếp LỚN hơn), -1 = giảm
 *        (mốc trước đó NHỎ hơn) @returns {number} */
function findAdjacentPlaybackSpeedPreset(currentSpeed, direction) {
    if (direction > 0) {
        const next = PLAYBACK_SPEED_PRESETS.find((p) => p > currentSpeed);
        return next !== undefined ? next : PLAYBACK_SPEED_PRESETS[PLAYBACK_SPEED_PRESETS.length - 1];
    }
    const lowerMatches = PLAYBACK_SPEED_PRESETS.filter((p) => p < currentSpeed);
    return lowerMatches.length > 0 ? lowerMatches[lowerMatches.length - 1] : PLAYBACK_SPEED_PRESETS[0];
}

/** Tô phần "đã kéo" của slider Speed — CÙNG khuôn syncVolumeHudSliderFill() ngay trên, chỉ khác
 * dải quy đổi % là [PLAYBACK_SPEED_MIN, PLAYBACK_SPEED_MAX] thay vì cố định [0,100].
 * @param {HTMLElement} sliderEl - #speed-hud-slider @param {number} speed */
function syncSpeedHudSliderFill(sliderEl, speed) {
    const percentage = ((speed - PLAYBACK_SPEED_MIN) / (PLAYBACK_SPEED_MAX - PLAYBACK_SPEED_MIN)) * 100;
    sliderEl.style.background = `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${percentage}%, rgba(255,255,255,0.1) ${percentage}%, rgba(255,255,255,0.1) 100%)`;
}

/** Đồng bộ TOÀN BỘ UI Speed HUD (badge trên nút mở, nhãn giá trị TRONG popup, vị trí+tô slider,
 * trạng thái active của 6 nút mốc) theo ĐÚNG 1 giá trị speed — gọi lúc mở HUD + mỗi lần tốc độ đổi
 * từ bất kỳ đâu (kéo slider/ấn mốc/cử chỉ/boot). SỬA (18/09/2026) — ĐỔI TÊN + GỘP từ
 * syncSpeedHudOptions() (trước đây chỉ lo badge + active nút, chưa có slider/nhãn giá trị) — mọi
 * nơi đổi speed giờ chỉ cần gọi ĐÚNG 1 hàm này, không tự nhớ rải rác 4 bước.
 * @param {HTMLElement} sliderEl - #speed-hud-slider
 * @param {HTMLElement} valueLabelEl - #speed-hud-value
 * @param {NodeListOf<HTMLElement>} optionEls - .speed-hud-option (data-speed-option)
 * @param {HTMLElement} badgeEl - #speed-badge-label
 * @param {number} speed */
function syncSpeedHudUI(sliderEl, valueLabelEl, optionEls, badgeEl, speed) {
    if (sliderEl) { sliderEl.value = speed; syncSpeedHudSliderFill(sliderEl, speed); }
    if (valueLabelEl) valueLabelEl.textContent = formatPlaybackSpeedLabel(speed);
    optionEls.forEach((el) => el.classList.toggle('bg-white/20', parseFloat(el.dataset.speedOption) === speed));
    if (badgeEl) badgeEl.textContent = formatPlaybackSpeedLabel(speed);
}
