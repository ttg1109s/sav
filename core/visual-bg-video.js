/**
 * core/visual-bg-video.js — Core domain "Visual Background", phần RIÊNG cho Video: thời lượng/lặp/kẹp "Fix time", thi hành
 * trên `bgVideoElement` khi là nền VBG (câm, phát, loop, tiếng, play/pause theo Song), tiếng từng video trong source list
 * và Resolution layer A/B. Phần chung: core/visual-bg-common.js. Điều phối: event/workflow/visual-bg-video.js; vòng đời
 * nguồn của `bgVideoElement` (đổi nguồn/ẩn/hiện/object URL) ở event/workflow/video-player.js (dùng chung Video Player).
 * NẠP SAU: core/visual-bg-common.js, core/dom-refs.js (lúc chạy).
 */

const VISUAL_BG_VIDEO_LOOP_WRAP_SEC = 0.5; // 'timeupdate' lùi quá ngưỡng này = vòng lặp mới (tránh nhiễu)

/** Thời lượng tự nhiên của video (ms thực) = độ dài video / `playbackRate` thật. Trình duyệt chưa/không báo được độ dài
 * (NaN/Infinity, vd webm ghi từ MediaRecorder) -> dùng `record.duration` đo lúc upload; cả 2 đều không có -> 0 (Runner bỏ
 * qua Point Move). @param {number} elementDurationSec @param {number|undefined} recordDurationSec @param {number} playbackRate
 * @returns {number} */
function computeVisualBgVideoNaturalMs(elementDurationSec, recordDurationSec, playbackRate) {
    const fromElement = Number.isFinite(elementDurationSec) && elementDurationSec > 0 ? elementDurationSec : 0;
    const fromRecord = Number.isFinite(recordDurationSec) && recordDurationSec > 0 ? recordDurationSec : 0;
    return ((fromElement || fromRecord) * 1000) / (playbackRate || 1);
}

/** Có cần hẹn "Fix time" cắt video không: chỉ khi biết độ dài và video dài hơn `durationSeconds` (ngắn hơn thì 'ended'
 * tự bắn đúng/sớm hơn). @param {number} videoDurationSec @param {number} durationSeconds @returns {boolean} */
function isVisualBgVideoFixtimeCutNeeded(videoDurationSec, durationSeconds) {
    return Number.isFinite(videoDurationSec) && videoDurationSec > durationSeconds;
}

/** Native loop chỉ khi không cycle nhiều video VÀ video không bật Audio B (iOS coi lần lặp native lúc video đang audible là
 * giành audio session mới -> pause Song; Audio B bật thì tự lặp thủ công). @param {boolean} isCycling @param {boolean} hasAudioB
 * @returns {boolean} */
function shouldVisualBgVideoLoopNatively(isCycling, hasAudioB) {
    return !isCycling && !hasAudioB;
}

/** 'timeupdate' cho thấy video vừa LÙI về đầu (vòng lặp mới). @param {number} currentSec @param {number} lastSec @returns {boolean} */
function isVisualBgVideoLoopWrapped(currentSec, lastSec) {
    return currentSec + VISUAL_BG_VIDEO_LOOP_WRAP_SEC < lastSec;
}

/** Tên hiển thị của 1 hàng màn Âm thanh Video (không có trong bản chụp -> key). @param {Array<{key: string, name: string}>} rows
 * @param {string} videoKey @returns {string} */
function findVisualBgVideoAudioRowName(rows, videoKey) {
    const row = rows.find((r) => r.key === videoKey);
    return row ? row.name : videoKey;
}

/** Câm cứng `bgVideoElement` trước khi play() (play() lúc video đang audible bị iOS coi là giành audio session). */
function muteVisualBgVideo() {
    bgVideoElement.muted = true;
}

/** Phát `bgVideoElement`, bỏ qua lỗi (bị chặn/ngắt — lượt sau tự thử lại). */
function playVisualBgVideo() {
    bgVideoElement.play().catch(() => {});
}

/** @param {boolean} loop */
function setVisualBgVideoLoop(loop) {
    bgVideoElement.loop = loop;
}

/** Hiện layer video trước khi đổi nguồn. */
function showVisualBgVideoLayer() {
    bgVideoElement.classList.remove('hidden');
}

/** Tiếng của video nền theo cấu hình (gain thật đặt riêng qua setVideoBgGain() khi đã nối graph). @param {boolean} enabled
 * @param {number} gain - 0..0.9 */
function setVisualBgVideoAudioElement(enabled, gain) {
    bgVideoElement.muted = !enabled;
    bgVideoElement.volume = gain;
}

/**
 * Đồng bộ play/pause của video nền theo nhạc — KHÔNG đụng src/hidden. Gọi mỗi lần nhạc play/pause
 * hoặc Next/Prev.
 * @param {boolean} isAudioPaused - `audioPlayer.paused` do Workflow đọc sẵn.
 */
function syncVisualBgVideoPlayback(isAudioPaused) {
    if (!bgVideoElement || bgVideoElement.classList.contains('hidden')) return;
    if (isAudioPaused) bgVideoElement.pause(); else bgVideoElement.play().catch(() => {});
}

// ===================== Tiếng riêng từng video (`source.videoAudio`: videoKey -> { enabled, volumePercent }) =====================

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

// Thang 0-100 trên UI/DB; gain thật trần 90% — luôn còn "chỗ thở" cho tiếng bài hát chính.
const VISUAL_BG_VIDEO_AUDIO_GAIN_CEILING = 0.9;

/** Core thuần — đổi `volumePercent` (0-100, thang UI/DB) sang gain thật (0-0.9) áp vào
 * bgVideoElement.volume/GainNode.
 * @param {number} volumePercent - 0-100 @returns {number} 0-0.9 */
function resolveVisualBgVideoAudioGain(volumePercent) {
    const clamped = Math.min(VISUAL_BG_VIDEO_AUDIO_VOLUME_MAX, Math.max(VISUAL_BG_VIDEO_AUDIO_VOLUME_MIN, volumePercent));
    return (clamped / 100) * VISUAL_BG_VIDEO_AUDIO_GAIN_CEILING;
}

// ===================== Resolution VBG — layer A `bgVideoElement` (object-fit) + layer B `visualBgImageElement` (background-size,
// thumb cầu nối / placeholder). Nhận chuỗi CSS đã tính (core/player-display-settings.js, Workflow gọi); '' = gỡ override. =====================

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
