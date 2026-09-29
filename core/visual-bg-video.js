/**
 * core/visual-bg-video.js — Core thuần domain "Visual Background", phần RIÊNG cho Video: đồng bộ
 * play/pause + cấu hình audio từng video trong source list. Phần chung (type/list/màu nền): xem
 * core/visual-bg-common.js. Điều phối ở event/workflow/visual-bg-video.js — vòng đời DOM thật của
 * `bgVideoElement` (đổi nguồn/ẩn/hiện/dọn object URL) sống ở event/workflow/video-player.js
 * (workflowVideoPlayer), dùng chung cho cả Video Player mode thật lẫn VBG trang trí.
 * NẠP SAU: core/visual-bg-common.js. 3 hàm Resolution cuối file (MỚI 30/09/2026) đọc core/dom-refs.js lúc CHẠY.
 */

/**
 * Đồng bộ play/pause của video nền theo nhạc — KHÔNG đụng src/hidden. Gọi mỗi lần nhạc play/pause
 * hoặc Next/Prev.
 * @param {boolean} isAudioPaused - `audioPlayer.paused` do Workflow đọc sẵn.
 */
function syncVisualBgVideoPlayback(isAudioPaused) {
    if (!bgVideoElement || bgVideoElement.classList.contains('hidden')) return;
    if (isAudioPaused) bgVideoElement.pause(); else bgVideoElement.play().catch(() => {});
}

// ===================== Audio riêng từng video trong source list =====================
// `source.videoAudio` — map videoKey -> { enabled, volumePercent }. 2 hàm dưới THUẦN đọc/ghi map
// đó (validate + clamp), KHÔNG đụng DOM/appState — Workflow tự đọc appConfigVisualBg + tự gán
// bgVideoElement.muted/.volume sau khi gọi 2 hàm này.

const VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN = 0;
const VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX = 100;
const VISUAL_BG_VIDEO_AUDIO_DEFAULT = Object.freeze({ enabled: false, volumePercent: 50 });

/**
 * Core thuần — đọc cấu hình audio của 1 video trong map, trả mặc định nếu chưa có/dữ liệu hỏng.
 * @param {Object<string, {enabled: boolean, volumePercent: number}>} videoAudioMap
 * @param {string} videoKey @returns {{enabled: boolean, volumePercent: number}}
 */
function getVisualBgVideoAudioSetting(videoAudioMap, videoKey) {
    const entry = videoAudioMap ? videoAudioMap[videoKey] : null;
    if (!entry || typeof entry !== 'object') return { ...VISUAL_BG_VIDEO_AUDIO_DEFAULT };
    const enabled = typeof entry.enabled === 'boolean' ? entry.enabled : VISUAL_BG_VIDEO_AUDIO_DEFAULT.enabled;
    const rawVolume = typeof entry.volumePercent === 'number' ? entry.volumePercent : VISUAL_BG_VIDEO_AUDIO_DEFAULT.volumePercent;
    const volumePercent = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, rawVolume));
    return { enabled, volumePercent };
}

/**
 * Core thuần — patch cấu hình audio của 1 video vào map, trả map MỚI. Nhận `current` qua tham số
 * (Workflow tự gọi getVisualBgVideoAudioSetting() trước) làm nền, `patch` đè lên rồi validate lại.
 * @param {Object<string, {enabled: boolean, volumePercent: number}>} videoAudioMap
 * @param {string} videoKey
 * @param {{enabled: boolean, volumePercent: number}} current
 * @param {{enabled?: boolean, volumePercent?: number}} patch
 * @returns {Object<string, {enabled: boolean, volumePercent: number}>} map MỚI.
 */
function setVisualBgVideoAudioSetting(videoAudioMap, videoKey, current, patch) {
    const merged = { ...current, ...patch };
    const enabled = typeof merged.enabled === 'boolean' ? merged.enabled : VISUAL_BG_VIDEO_AUDIO_DEFAULT.enabled;
    const rawVolume = typeof merged.volumePercent === 'number' ? merged.volumePercent : VISUAL_BG_VIDEO_AUDIO_DEFAULT.volumePercent;
    const volumePercent = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, rawVolume));
    return { ...(videoAudioMap || {}), [videoKey]: { enabled, volumePercent } };
}

// Thang 0-100 trên UI/DB GIỮ NGUYÊN ý nghĩa cũ — chỉ trần GAIN THẬT áp vào bgVideoElement.volume/
// GainNode ở 90%, luôn còn "chỗ thở" cho tiếng bài hát chính dù kéo audio video nền lên tối đa.
const VISUAL_BG_VIDEO_AUDIO_GAIN_CEILING = 0.9;

/** Core thuần — đổi `volumePercent` (0-100, thang UI/DB) sang gain thật (0-0.9) áp vào
 * bgVideoElement.volume/GainNode.
 * @param {number} volumePercent - 0-100 @returns {number} 0-0.9 */
function resolveVisualBgVideoAudioGain(volumePercent) {
    const clamped = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, volumePercent));
    return (clamped / 100) * VISUAL_BG_VIDEO_AUDIO_GAIN_CEILING;
}

// ===================== Resolution VBG Video (MỚI 30/09/2026, Giang — dropdown Resolution ở card Media VBG,
// giống Player) — 3 hàm Core-DOM dưới: KHÔNG tự đọc config/appState (Rule 2), nhận chuỗi CSS ĐÃ TÍNH SẴN qua tham
// số (Workflow tính bằng resolvePlayerObjectFitCss()/resolvePlayerBackgroundSizeCss(), core/player-display-
// settings.js — KHÔNG gọi chéo core->core ở đây), CHỈ gán lên 2 biến DOM tĩnh `bgVideoElement` (layer A) /
// `visualBgImageElement` (layer B — cầu nối thumb full-res của Video surface / thumb placeholder lúc Song dừng),
// core/dom-refs.js. Chuỗi rỗng = gỡ override, trả CSS tĩnh mặc định (`cover`, assets/css/base.css). =====================

/** Core-DOM — `object-fit` của layer A (`bgVideoElement`). @param {string} objectFitCss - '' = gỡ override */
function applyVisualBgVideoResolutionToDOM(objectFitCss) {
    if (!bgVideoElement) return; // core/dom-refs.js
    bgVideoElement.style.objectFit = objectFitCss || '';
}

/** Core-DOM — `background-size` của layer B (`visualBgImageElement`), PHẢI khớp layer A để thumb cầu nối/placeholder
 * không lệch kích thước với video thật. @param {string} backgroundSizeCss - '' = gỡ override */
function applyVisualBgVideoBridgeSizeToDOM(backgroundSizeCss) {
    if (!visualBgImageElement) return; // core/dom-refs.js
    visualBgImageElement.style.backgroundSize = backgroundSizeCss || '';
}

/** Core-DOM (chỉ ĐỌC) — kích thước khung chứa layer B (đang ẩn/đo ra 0 -> fallback viewport, cùng cách
 * applyVideoPlayerResolutionToLayerBDOM() của Player). @returns {{width:number, height:number}} */
function measureVisualBgVideoFrame() {
    const width = (visualBgImageElement && visualBgImageElement.clientWidth) || window.innerWidth; // core/dom-refs.js
    const height = (visualBgImageElement && visualBgImageElement.clientHeight) || window.innerHeight;
    return { width, height };
}
